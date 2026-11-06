import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { mensagens, sessoes } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { exigirSessao } from '$lib/server/sessao-usuario';
import { buscarSessaoPorCodigo, payloadDoPainel } from '$lib/server/sessoes';
import { notificarNovaPergunta } from '$lib/server/push-sala';
import { publicar } from '$lib/server/barramento';
import type { RequestHandler } from './$types';

const ACOES = ['avancar', 'voltar', 'encerrar', 'chat'] as const;

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

	const corpo = (await request.json().catch(() => null)) as
		| { acao?: string; ativo?: boolean }
		| null;
	const acao = corpo?.acao ?? '';
	if (!(ACOES as readonly string[]).includes(acao)) {
		return json({ erro: 'Ação inválida: use avançar, voltar ou encerrar.' }, { status: 400 });
	}

	const db = getDb();

	if (acao === 'chat') {
		if (typeof corpo?.ativo !== 'boolean') {
			return json({ erro: 'Informe ativo: true ou false.' }, { status: 400 });
		}

		const [atualizada] = await db
			.update(sessoes)
			.set({ chatAtivo: corpo.ativo })
			.where(eq(sessoes.id, sessao.id))
			.returning({ codigo: sessoes.codigo, chatAtivo: sessoes.chatAtivo });

		// avisa quem está com o chat aberto na hora
		publicar(sessao.id, 'chat', { ativo: corpo.ativo, encerrada: false });

		return json({ sessao: atualizada });
	}

	if (acao === 'encerrar') {
		const [atualizada] = await db
			.update(sessoes)
			.set({ status: 'encerrada', encerradaEm: new Date() })
			.where(eq(sessoes.id, sessao.id))
			.returning({ codigo: sessoes.codigo, status: sessoes.status });

		// o chat desaparece com a rodada
		await db.delete(mensagens).where(eq(mensagens.sessaoId, sessao.id));
		publicar(sessao.id, 'chat', { ativo: false, encerrada: true });

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

	// pergunta nova no ar: avisa quem saiu do app (no ritmo livre ninguém é chamado no meio)
	let notificacao = null;
	if (acao === 'avancar' && sessao.modo === 'conduzida' && destino !== sessao.perguntaAtual) {
		notificacao = await notificarNovaPergunta(sessao.id, sessao.codigo, destino, total).catch(() => null);
	}

	return json({ sessao: atualizada, notificacao });
};
