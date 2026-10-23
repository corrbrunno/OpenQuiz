import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { gabaritos, perguntas, respostas } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { exigirSessao } from '$lib/server/sessao-usuario';
import { buscarSessaoPorCodigo, participanteDaSessao } from '$lib/server/sessoes';
import { corrigir } from '$lib/quiz/correcao';
import type { Atribuicao, RespostaComum } from '$lib/quiz/tipos';
import { idsDoConteudo } from '$lib/quiz/utils';
import type { RequestHandler } from './$types';

const MAXIMO_ATRIBUICOES = 30;

/**
 * Resposta do jogador. A correção acontece AQUI, no servidor: o gabarito nunca vai para o
 * navegador — o cliente recebe só quantos itens acertou.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta para responder.' }, { status: 401 });

	const semSessao = await exigirSessao(request, usuario);
	if (semSessao) return semSessao;

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) return json({ erro: 'Sala não encontrada.' }, { status: 404 });

	const { sessao, quiz } = achado;
	if (sessao.status !== 'aberta') return json({ erro: 'Esta sessão já foi encerrada.' }, { status: 409 });

	const participante = await participanteDaSessao(sessao.id, usuario.uid);
	if (!participante) return json({ erro: 'Entre na sala antes de responder.' }, { status: 403 });

	const corpo = (await request.json().catch(() => null)) as {
		perguntaId?: string;
		atribuicoes?: Atribuicao[];
	} | null;

	const perguntaId = corpo?.perguntaId ?? '';
	const atribuicoes = Array.isArray(corpo?.atribuicoes) ? corpo.atribuicoes : null;

	if (!perguntaId || !atribuicoes) {
		return json({ erro: 'Resposta incompleta.' }, { status: 400 });
	}
	if (atribuicoes.length > MAXIMO_ATRIBUICOES) {
		return json({ erro: 'Resposta com itens demais.' }, { status: 400 });
	}
	if (
		atribuicoes.some(
			(atribuicao) =>
				typeof atribuicao?.itemId !== 'string' || typeof atribuicao?.alvoId !== 'string'
		)
	) {
		return json({ erro: 'Resposta em formato inválido.' }, { status: 400 });
	}

	const db = getDb();
	const [pergunta] = await db
		.select()
		.from(perguntas)
		.where(and(eq(perguntas.id, perguntaId), eq(perguntas.quizId, quiz.id)))
		.limit(1);

	if (!pergunta) return json({ erro: 'Pergunta não encontrada neste questionário.' }, { status: 404 });

	if (sessao.modo === 'conduzida' && pergunta.ordem !== sessao.perguntaAtual) {
		return json({ erro: 'Esta pergunta não está no ar.' }, { status: 409 });
	}

	const idsValidos = new Set(idsDoConteudo(pergunta.conteudo));
	if (atribuicoes.some((atribuicao) => !idsValidos.has(atribuicao.itemId))) {
		return json({ erro: 'Resposta aponta para um item que não existe na pergunta.' }, { status: 400 });
	}

	const [existente] = await db
		.select()
		.from(respostas)
		.where(
			and(
				eq(respostas.sessaoId, sessao.id),
				eq(respostas.perguntaId, pergunta.id),
				eq(respostas.participanteId, participante.id)
			)
		)
		.limit(1);

	// Reenvio (clique duplo, rede instável): devolve o que já está gravado, sem recontar.
	if (existente) {
		return json({
			resposta: {
				perguntaId: existente.perguntaId,
				acertos: existente.acertos,
				total: existente.total,
				atribuicoes: existente.atribuicoes,
				jaRespondida: true
			}
		});
	}

	const [gabarito] = await db
		.select()
		.from(gabaritos)
		.where(eq(gabaritos.perguntaId, pergunta.id))
		.limit(1);

	if (!gabarito) return json({ erro: 'Esta pergunta está sem gabarito.' }, { status: 500 });

	const resposta: RespostaComum = { perguntaId: pergunta.id, tipo: pergunta.tipo, atribuicoes };
	const correta: RespostaComum = {
		perguntaId: pergunta.id,
		tipo: gabarito.tipo,
		atribuicoes: gabarito.atribuicoes
	};
	const correcao = corrigir(resposta, correta);

	const [salva] = await db
		.insert(respostas)
		.values({
			sessaoId: sessao.id,
			perguntaId: pergunta.id,
			participanteId: participante.id,
			atribuicoes,
			acertos: correcao.acertos,
			total: correcao.total
		})
		.onConflictDoNothing()
		.returning();

	if (!salva) {
		const [jaGravada] = await db
			.select()
			.from(respostas)
			.where(
				and(
					eq(respostas.sessaoId, sessao.id),
					eq(respostas.perguntaId, pergunta.id),
					eq(respostas.participanteId, participante.id)
				)
			)
			.limit(1);

		return json({
			resposta: {
				perguntaId: pergunta.id,
				acertos: jaGravada?.acertos ?? 0,
				total: jaGravada?.total ?? correcao.total,
				atribuicoes: jaGravada?.atribuicoes ?? atribuicoes,
				jaRespondida: true
			}
		});
	}

	return json(
		{
			resposta: {
				perguntaId: salva.perguntaId,
				acertos: salva.acertos,
				total: salva.total,
				atribuicoes: salva.atribuicoes,
				jaRespondida: false
			}
		},
		{ status: 201 }
	);
};
