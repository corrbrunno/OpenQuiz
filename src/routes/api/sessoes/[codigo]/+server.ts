import { json } from '@sveltejs/kit';
import { isDbConfigured } from '$lib/server/db';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { buscarSessaoPorCodigo, payloadDaSala } from '$lib/server/sessoes';
import type { RequestHandler } from './$types';

/**
 * Estado da sala para quem está jogando (e o código não devolve o gabarito, nunca).
 * - modo `conduzida`: devolve só a pergunta que está no ar;
 * - modo `livre`: devolve todas, cada um no seu ritmo;
 * - o placar só aparece para o dono ou depois de encerrar.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta para abrir a sala.' }, { status: 401 });

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) return json({ erro: 'Sala não encontrada: confira o código.' }, { status: 404 });

	return json(await payloadDaSala(achado.sessao, achado.quiz, usuario));
};
