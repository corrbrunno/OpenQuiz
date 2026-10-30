import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { tokensPush } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { exigirSessao } from '$lib/server/sessao-usuario';
import type { RequestHandler } from './$types';

/** Registra o token de push do aparelho (um por aparelho instalado). */
export const POST: RequestHandler = async ({ request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const semSessao = await exigirSessao(request, usuario);
	if (semSessao) return semSessao;

	const corpo = (await request.json().catch(() => null)) as
		| { token?: string; plataforma?: string }
		| null;
	const token = (corpo?.token ?? '').trim();
	if (!token) return json({ erro: 'Token ausente.' }, { status: 400 });

	const plataforma = (corpo?.plataforma ?? 'android').trim() || 'android';
	const db = getDb();

	await db
		.insert(tokensPush)
		.values({ uid: usuario.uid, token, plataforma })
		.onConflictDoUpdate({
			target: tokensPush.token,
			set: { uid: usuario.uid, plataforma, atualizadoEm: new Date() }
		});

	return json({ ok: true });
};

/** Remove o token (logout ou notificações desligadas no aparelho). */
export const DELETE: RequestHandler = async ({ request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const corpo = (await request.json().catch(() => null)) as { token?: string } | null;
	const token = (corpo?.token ?? '').trim();
	if (!token) return json({ erro: 'Token ausente.' }, { status: 400 });

	const db = getDb();
	await db.delete(tokensPush).where(and(eq(tokensPush.token, token), eq(tokensPush.uid, usuario.uid)));

	return json({ ok: true });
};
