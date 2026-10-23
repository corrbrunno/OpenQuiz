import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { getDb } from './db';
import { gabaritos, participantes, perguntas, quizzes, respostas, sessoes } from './db/schema';
import type { UsuarioAutenticado } from './auth';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function gerarCodigo(tamanho = 6): string {
	const valores = new Uint32Array(tamanho);
	crypto.getRandomValues(valores);
	return Array.from(valores, (valor) => ALFABETO[valor % ALFABETO.length]).join('');
}

/** Nome exibido no placar: displayName quando existir, senão a parte antes do @ do e-mail. */
export function nomeDoUsuario(usuario: UsuarioAutenticado): string {
	const nome = usuario.nome?.trim() || usuario.email?.split('@')[0] || '';
	return nome.slice(0, 40) || 'Participante';
}

export async function buscarSessaoPorCodigo(codigo: string) {
	const db = getDb();

	const [linha] = await db
		.select({ sessao: sessoes, quiz: quizzes })
		.from(sessoes)
		.innerJoin(quizzes, eq(quizzes.id, sessoes.quizId))
		.where(eq(sessoes.codigo, codigo.trim().toUpperCase()))
		.limit(1);

	return linha ?? null;
}

export async function perguntasDoQuiz(quizId: string) {
	const db = getDb();

	return db
		.select({
			id: perguntas.id,
			ordem: perguntas.ordem,
			enunciado: perguntas.enunciado,
			imagemUrl: perguntas.imagemUrl,
			tipo: perguntas.tipo,
			conteudo: perguntas.conteudo
		})
		.from(perguntas)
		.where(eq(perguntas.quizId, quizId))
		.orderBy(asc(perguntas.ordem));
}

/** Entrar é idempotente: quem já está na sessão só tem o nome atualizado. */
export async function registrarParticipante(sessaoId: string, uid: string, nome: string) {
	const db = getDb();

	const [linha] = await db
		.insert(participantes)
		.values({ sessaoId, uid, nome })
		.onConflictDoUpdate({
			target: [participantes.sessaoId, participantes.uid],
			set: { nome }
		})
		.returning();

	return linha;
}

export async function participanteDaSessao(sessaoId: string, uid: string) {
	const db = getDb();

	const [linha] = await db
		.select()
		.from(participantes)
		.where(and(eq(participantes.sessaoId, sessaoId), eq(participantes.uid, uid)))
		.limit(1);

	return linha ?? null;
}

/** Placar: quem acertou mais; empate desempata por quem terminou antes e entrou antes. */
export async function rankingDaSessao(sessaoId: string) {
	const db = getDb();
	const somaAcertos = sql`coalesce(sum(${respostas.acertos}), 0)`;

	return db
		.select({
			participanteId: participantes.id,
			nome: participantes.nome,
			acertos: sql<number>`${somaAcertos}::int`,
			respondidas: sql<number>`count(${respostas.id})::int`,
			ultimaRespostaEm: sql<string | null>`max(${respostas.respondidaEm})`
		})
		.from(participantes)
		.leftJoin(
			respostas,
			and(
				eq(respostas.participanteId, participantes.id),
				eq(respostas.sessaoId, participantes.sessaoId)
			)
		)
		.where(eq(participantes.sessaoId, sessaoId))
		.groupBy(participantes.id, participantes.nome)
		.orderBy(desc(somaAcertos), asc(sql`max(${respostas.respondidaEm})`), asc(participantes.entrouEm));
}

export async function minhasRespostas(sessaoId: string, participanteId: string) {
	const db = getDb();

	return db
		.select({
			perguntaId: respostas.perguntaId,
			atribuicoes: respostas.atribuicoes,
			acertos: respostas.acertos,
			total: respostas.total,
			respondidaEm: respostas.respondidaEm
		})
		.from(respostas)
		.where(and(eq(respostas.sessaoId, sessaoId), eq(respostas.participanteId, participanteId)));
}

/**
 * Payload da sala para quem joga. Fonte única: usado pelo GET e pelo stream de eventos (SSE),
 * para os dois caminhos nunca divergirem.
 */
export async function payloadDaSala(
	sessao: typeof sessoes.$inferSelect,
	quiz: typeof quizzes.$inferSelect,
	usuario: UsuarioAutenticado
) {
	const souDono = sessao.donoUid === usuario.uid;
	const participante = souDono ? null : await participanteDaSessao(sessao.id, usuario.uid);

	const todas = await perguntasDoQuiz(quiz.id);
	const visiveis =
		sessao.modo === 'conduzida' ? todas.filter((item) => item.ordem === sessao.perguntaAtual) : todas;

	const minhas = participante ? await minhasRespostas(sessao.id, participante.id) : [];
	const ranking =
		souDono || sessao.status === 'encerrada' ? await rankingDaSessao(sessao.id) : null;

	return {
		sessao: {
			codigo: sessao.codigo,
			modo: sessao.modo,
			status: sessao.status,
			perguntaAtual: sessao.perguntaAtual
		},
		quiz: { titulo: quiz.titulo, totalPerguntas: quiz.totalPerguntas },
		souDono,
		participei: Boolean(participante),
		participanteId: participante?.id ?? null,
		perguntas: visiveis,
		minhasRespostas: minhas,
		ranking
	};
}

/** Payload do painel do apresentador (inclui o gabarito da pergunta no ar — só o dono recebe). */
export async function payloadDoPainel(
	sessao: typeof sessoes.$inferSelect,
	quiz: typeof quizzes.$inferSelect
) {
	const lista = await perguntasDoQuiz(quiz.id);
	const atual = lista.find((item) => item.ordem === sessao.perguntaAtual) ?? lista[0] ?? null;

	const db = getDb();
	const responderam = atual
		? new Set(
				(
					await db
						.select({ participanteId: respostas.participanteId })
						.from(respostas)
						.where(and(eq(respostas.sessaoId, sessao.id), eq(respostas.perguntaId, atual.id)))
				).map((linha) => linha.participanteId)
			)
		: new Set<string>();

	const ranking = await rankingDaSessao(sessao.id);

	const [gabaritoAtual] = atual
		? await db.select().from(gabaritos).where(eq(gabaritos.perguntaId, atual.id)).limit(1)
		: [];

	return {
		sessao: {
			codigo: sessao.codigo,
			modo: sessao.modo,
			status: sessao.status,
			perguntaAtual: sessao.perguntaAtual,
			abertaEm: sessao.abertaEm,
			encerradaEm: sessao.encerradaEm
		},
		quiz: { id: quiz.id, titulo: quiz.titulo, totalPerguntas: quiz.totalPerguntas },
		perguntaAtual: atual,
		gabaritoAtual: gabaritoAtual
			? { perguntaId: atual!.id, tipo: gabaritoAtual.tipo, atribuicoes: gabaritoAtual.atribuicoes }
			: null,
		participantes: ranking.map((linha) => ({
			...linha,
			respondeuAtual: responderam.has(linha.participanteId)
		})),
		responderamAtual: responderam.size,
		ranking
	};
}
