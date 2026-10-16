import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { gabaritos, quizzes } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Gabaritos da sala — só o dono lê. É aqui (no servidor) que a regra é aplicada:
 * o gabarito nunca chega ao navegador de quem apenas entrou para responder.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) {
		return json({ erro: 'DATABASE_URL não configurada no servidor.' }, { status: 500 });
	}

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const codigo = (params.codigo ?? '').trim().toUpperCase();
	const db = getDb();

	const [quiz] = await db.select().from(quizzes).where(eq(quizzes.codigo, codigo)).limit(1);
	if (!quiz) return json({ erro: 'Sala não encontrada: confira o código.' }, { status: 404 });

	if (quiz.donoUid !== usuario.uid) {
		return json(
			{ erro: 'O gabarito é acessível apenas ao dono do questionário.' },
			{ status: 403 }
		);
	}

	const lista = await db
		.select({
			perguntaId: gabaritos.perguntaId,
			tipo: gabaritos.tipo,
			atribuicoes: gabaritos.atribuicoes
		})
		.from(gabaritos)
		.where(eq(gabaritos.quizId, quiz.id));

	return json({ gabaritos: lista });
};
