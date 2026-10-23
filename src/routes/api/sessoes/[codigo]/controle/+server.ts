import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { sessoes } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { exigirSessao } from '$lib/server/sessao-usuario';
import { buscarSessaoPorCodigo, payloadDoPainel } from '$lib/server/sessoes';
import type { RequestHandler } from './$types';

const ACOES = ['avancar', 'voltar', 'encerrar'] as const;

/** Painel do apresentador: pergunta no ar, quem já respondeu e o placar. */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) return json({ erro: 'Sala não encontrada.' }, { status: 404 });

	if (achado.sessao.donoUid !== usuario.uid) {
		return json({ erro: 'Só quem criou o questionário acessa o painel.' }, { status: 403 });
	}

	return json(await payloadDoPainel(achado.sessao, achado.quiz));
};

/** Controle do ritual: avançar, voltar ou encerrar a sessão. */
export const POST: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const semSessao = await exigirSessao(request, usuario);
	if (semSessao) return semSessao;

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
