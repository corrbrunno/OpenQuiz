import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { gabaritos, respostas, sessoes } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import {
	buscarSessaoPorCodigo,
	perguntasDoQuiz,
	rankingDaSessao
} from '$lib/server/sessoes';
import type { RequestHandler } from './$types';

const ACOES = ['avancar', 'voltar', 'encerrar'] as const;

/** Painel do apresentador: pergunta no ar, quem já respondeu e o placar. */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) return json({ erro: 'Sala não encontrada.' }, { status: 404 });

	const { sessao, quiz } = achado;
	if (sessao.donoUid !== usuario.uid) {
		return json({ erro: 'Só quem criou o questionário acessa o painel.' }, { status: 403 });
	}

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
		? await db
				.select()
				.from(gabaritos)
				.where(eq(gabaritos.perguntaId, atual.id))
				.limit(1)
		: [];

	return json({
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
	});
};

/** Controle do ritual: avançar, voltar ou encerrar a sessão. */
export const POST: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) return json({ erro: 'Sala não encontrada.' }, { status: 404 });

	const { sessao, quiz } = achado;
	if (sessao.donoUid !== usuario.uid) {
		return json({ erro: 'Só quem criou o questionário controla a sessão.' }, { status: 403 });
	}

	const corpo = (await request.json().catch(() => null)) as { acao?: string } | null;
	const acao = corpo?.acao ?? '';
	if (!(ACOES as readonly string[]).includes(acao)) {
		return json({ erro: 'Ação inválida: use avançar, voltar ou encerrar.' }, { status: 400 });
	}

	const db = getDb();

	if (acao === 'encerrar') {
		const [atualizada] = await db
			.update(sessoes)
			.set({ status: 'encerrada', encerradaEm: new Date() })
			.where(eq(sessoes.id, sessao.id))
			.returning({ codigo: sessoes.codigo, status: sessoes.status });

		return json({ sessao: atualizada });
	}

	if (sessao.status !== 'aberta') {
		return json({ erro: 'Esta sessão já foi encerrada.' }, { status: 409 });
	}

	const total = quiz.totalPerguntas;
	const destino =
		acao === 'avancar'
			? Math.min(sessao.perguntaAtual + 1, Math.max(total, 1))
			: Math.max(sessao.perguntaAtual - 1, 1);

	const [atualizada] = await db
		.update(sessoes)
		.set({ perguntaAtual: destino })
		.where(eq(sessoes.id, sessao.id))
		.returning({ codigo: sessoes.codigo, status: sessoes.status, perguntaAtual: sessoes.perguntaAtual });

	return json({ sessao: atualizada });
};
