import { json } from '@sveltejs/kit';
import { isDbConfigured } from '$lib/server/db';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { LIMITE_INATIVIDADE_MS, sessaoDoCabecalho, tocarSessao } from '$lib/server/sessao-usuario';
import type { RequestHandler } from './$types';

/** Renova a sessão a cada atividade (toque, tecla, scroll) — é o "touch_session" do material. */
export const POST: RequestHandler = async ({ request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const sessao = await tocarSessao(usuario, sessaoDoCabecalho(request));
	if (!sessao) {
		return json(
			{ erro: 'Sessão expirada por inatividade.', codigo: 'sessao-invalida' },
			{ status: 401 }
		);
	}

	return json({
		sessao: { id: sessao.id, expiraEm: sessao.expiraEm, limiteMs: LIMITE_INATIVIDADE_MS }
	});
};
