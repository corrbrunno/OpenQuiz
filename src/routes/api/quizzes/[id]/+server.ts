import { json } from '@sveltejs/kit';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { gabaritos, perguntas, quizzes, sessoes } from '$lib/server/db/schema';
import { usuarioDaRequisicao, type UsuarioAutenticado } from '$lib/server/auth';
import { exigirSessao } from '$lib/server/sessao-usuario';
import { validarPerguntaRecebida, type PerguntaRecebida } from '$lib/quiz/validacao';
import type { TipoPergunta } from '$lib/quiz/tipos';
import type { RequestHandler } from './$types';

const MAXIMO_PERGUNTAS = 30;

type Requisicao = { titulo?: string; perguntas?: PerguntaRecebida[] };
type PerguntaComId = PerguntaRecebida & { id?: string };

type AcessoAoQuiz =
	| { liberado: true; usuario: UsuarioAutenticado; quiz: typeof quizzes.$inferSelect }
	| { liberado: false; resposta: Response };

async function donoDaRequisicao(request: Request, quizId: string): Promise<AcessoAoQuiz> {
	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) {
		return { liberado: false, resposta: json({ erro: 'Entre na sua conta.' }, { status: 401 }) };
	}

	const db = getDb();
	const [quiz] = await db
		.select()
		.from(quizzes)
		.where(and(eq(quizzes.id, quizId), eq(quizzes.donoUid, usuario.uid)))
		.limit(1);

	if (!quiz) {
		return { liberado: false, resposta: json({ erro: 'Questionário não encontrado.' }, { status: 404 }) };
	}

	return { liberado: true, usuario, quiz };
}

/** Carrega o questionário com perguntas e gabaritos para alimentar o editor. */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const acesso = await donoDaRequisicao(request, params.id);
	if (!acesso.liberado) return acesso.resposta;

	const db = getDb();
	const lista = await db
		.select({
			id: perguntas.id,
			ordem: perguntas.ordem,
			enunciado: perguntas.enunciado,
			imagemUrl: perguntas.imagemUrl,
			tipo: perguntas.tipo,
			conteudo: perguntas.conteudo,
			atribuicoes: gabaritos.atribuicoes,
			tipoGabarito: gabaritos.tipo
		})
		.from(perguntas)
		.leftJoin(gabaritos, eq(gabaritos.perguntaId, perguntas.id))
		.where(eq(perguntas.quizId, acesso.quiz.id))
		.orderBy(perguntas.ordem);

	return json({
		quiz: { id: acesso.quiz.id, titulo: acesso.quiz.titulo },
		perguntas: lista.map((linha) => ({
			id: linha.id,
			ordem: linha.ordem,
			enunciado: linha.enunciado,
			imagemUrl: linha.imagemUrl,
			tipo: linha.tipo,
			conteudo: linha.conteudo,
			gabarito:
				linha.atribuicoes && linha.tipoGabarito
					? { perguntaId: linha.id, tipo: linha.tipoGabarito, atribuicoes: linha.atribuicoes }
					: null
		}))
	});
};

/** Salva a edição preservando o id das perguntas que já existiam (e as respostas delas). */
export const PUT: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const acesso = await donoDaRequisicao(request, params.id);
	if (!acesso.liberado) return acesso.resposta;

	const semSessao = await exigirSessao(request, acesso.usuario);
	if (semSessao) return semSessao;

	const corpo = (await request.json().catch(() => null)) as Requisicao | null;
	const titulo = corpo?.titulo?.trim() ?? '';
	const recebidas = (Array.isArray(corpo?.perguntas) ? corpo.perguntas : []) as PerguntaComId[];

	if (!titulo) return json({ erro: 'Informe o título do questionário.' }, { status: 400 });
	if (recebidas.length === 0) return json({ erro: 'Adicione pelo menos uma pergunta.' }, { status: 400 });
	if (recebidas.length > MAXIMO_PERGUNTAS) {
		return json({ erro: `Máximo de ${MAXIMO_PERGUNTAS} perguntas.` }, { status: 400 });
	}

	for (const [indice, recebida] of recebidas.entries()) {
		const problema = validarPerguntaRecebida(recebida);
		if (problema) return json({ erro: `Pergunta ${indice + 1}: ${problema}` }, { status: 400 });
	}

	const db = getDb();
	const [aberta] = await db
		.select({ id: sessoes.id })
		.from(sessoes)
		.where(and(eq(sessoes.quizId, acesso.quiz.id), eq(sessoes.status, 'aberta')))
		.limit(1);

	if (aberta) {
		return json(
			{ erro: 'Existe uma sessão aberta com este questionário: encerre a sessão para poder editar.' },
			{ status: 409 }
		);
	}

	await db.transaction(async (tx) => {
		const existentes = await tx
			.select({ id: perguntas.id })
			.from(perguntas)
			.where(eq(perguntas.quizId, acesso.quiz.id));
		const idsExistentes = new Set(existentes.map((linha) => linha.id));
		const idsMantidos = recebidas
			.map((recebida) => recebida.id)
			.filter((id): id is string => Boolean(id) && idsExistentes.has(id as string));

		if (idsMantidos.length > 0) {
			await tx
				.delete(perguntas)
				.where(and(eq(perguntas.quizId, acesso.quiz.id), notInArray(perguntas.id, idsMantidos)));
			// libera o índice único (quiz_id, ordem) antes de reaplicar a ordem final
			await tx.execute(
				sql`update perguntas set ordem = -ordem where quiz_id = ${acesso.quiz.id}`
			);
		} else {
			await tx.delete(perguntas).where(eq(perguntas.quizId, acesso.quiz.id));
		}

		for (const [indice, recebida] of recebidas.entries()) {
			const conteudo = recebida.conteudo!;
			const dados = {
				ordem: indice + 1,
				enunciado: recebida.enunciado!.trim(),
				imagemUrl: recebida.imagemUrl ?? null,
				tipo: conteudo.tipo,
				conteudo
			};
			const gabarito = {
				tipo: (recebida.gabarito?.tipo ?? conteudo.tipo) as TipoPergunta,
				atribuicoes: recebida.gabarito!.atribuicoes!
			};

			if (recebida.id && idsExistentes.has(recebida.id)) {
				await tx.update(perguntas).set(dados).where(eq(perguntas.id, recebida.id));
				await tx.update(gabaritos).set(gabarito).where(eq(gabaritos.perguntaId, recebida.id));
			} else {
				const [nova] = await tx
					.insert(perguntas)
					.values({ quizId: acesso.quiz.id, ...dados })
					.returning({ id: perguntas.id });

				await tx.insert(gabaritos).values({
					perguntaId: nova.id,
					quizId: acesso.quiz.id,
					donoUid: acesso.usuario.uid,
					...gabarito
				});
			}
		}

		await tx
			.update(quizzes)
			.set({ titulo, totalPerguntas: recebidas.length, atualizadoEm: new Date() })
			.where(eq(quizzes.id, acesso.quiz.id));
	});

	return json({ id: acesso.quiz.id });
};

export const DELETE: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const acesso = await donoDaRequisicao(request, params.id);
	if (!acesso.liberado) return acesso.resposta;

	const semSessao = await exigirSessao(request, acesso.usuario);
	if (semSessao) return semSessao;

	const db = getDb();
	// As sessões, perguntas, gabaritos e respostas caem em cascata.
	await db.delete(quizzes).where(eq(quizzes.id, acesso.quiz.id));

	return json({ removido: acesso.quiz.id });
};
