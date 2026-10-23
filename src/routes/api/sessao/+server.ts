import { json } from '@sveltejs/kit';
import { isDbConfigured } from '$lib/server/db';
import { usuarioDaRequisicao } from '$lib/server/auth';
import {
	abrirSessao,
	encerrarSessao,
	LIMITE_INATIVIDADE_MS,
	sessaoDoCabecalho,
	sessaoValida
} from '$lib/server/sessao-usuario';
import type { RequestHandler } from './$types';

/** Abre a sessão do app (login) — o id dela vai no cabeçalho `X-Sessao`. */
export const POST: RequestHandler = async ({ request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const sessao = await abrirSessao(usuario);

	return json(
		{
			sessao: {
				id: sessao.id,
				iniciadaEm: sessao.iniciadaEm,
				expiraEm: sessao.expiraEm,
				limiteMs: LIMITE_INATIVIDADE_MS
			}
		},
		{ status: 201 }
	);
};

/** Estado da sessão atual (usado pelo /perfil para mostrar o ID e o tempo restante). */
export const GET: RequestHandler = async ({ request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const sessao = await sessaoValida(usuario, sessaoDoCabecalho(request));
	if (!sessao) {
		return json(
			{ erro: 'Sessão expirada por inatividade.', codigo: 'sessao-invalida' },
			{ status: 401 }
		);
	}

	return json({
		sessao: {
			id: sessao.id,
			iniciadaEm: sessao.iniciadaEm,
			ultimaAtividadeEm: sessao.ultimaAtividadeEm,
			expiraEm: sessao.expiraEm,
			limiteMs: LIMITE_INATIVIDADE_MS
		}
	});
};

/** Logout: encerra a sessão no servidor (não basta limpar o token no cliente). */
export const DELETE: RequestHandler = async ({ request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	await encerrarSessao(usuario, sessaoDoCabecalho(request));

	return json({ encerrada: true });
};
