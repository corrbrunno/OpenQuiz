import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { participantes } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { exigirSessao } from '$lib/server/sessao-usuario';
import { buscarSessaoPorCodigo } from '$lib/server/sessoes';
import type { RequestHandler } from './$types';

/**
 * O app avisa se está na frente (emApp=true) ou foi para segundo plano (false).
 * É isso que decide se a próxima pergunta merece notificação.
 */
export const POST: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const semSessao = await exigirSessao(request, usuario);
	if (semSessao) return semSessao;

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) return json({ erro: 'Sala não encontrada.' }, { status: 404 });

	const corpo = (await request.json().catch(() => null)) as { emApp?: boolean } | null;
	const emApp = corpo?.emApp === true;

	const db = getDb();
	const [atualizado] = await db
		.update(participantes)
		.set({ emApp, ultimaAtividadeEm: new Date() })
		.where(and(eq(participantes.sessaoId, achado.sessao.id), eq(participantes.uid, usuario.uid)))
		.returning({ uid: participantes.uid, emApp: participantes.emApp });

	if (!atualizado) return json({ erro: 'Você não está nesta sala.' }, { status: 403 });

	return json({ presenca: atualizado });
};
