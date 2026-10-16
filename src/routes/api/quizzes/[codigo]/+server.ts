import { json } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { perguntas, quizzes } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import type { RequestHandler } from './$types';

/**
 * Carrega a sala pelo código. Exige login (a sala é fechada) e devolve apenas o conteúdo
 * das perguntas — o gabarito tem rota própria, liberada só para o dono.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) {
		return json({ erro: 'DATABASE_URL não configurada no servidor.' }, { status: 500 });
	}

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) {
		return json({ erro: 'Entre na sua conta para abrir a sala.' }, { status: 401 });
	}

	const codigo = (params.codigo ?? '').trim().toUpperCase();
	const db = getDb();

	const [quiz] = await db.select().from(quizzes).where(eq(quizzes.codigo, codigo)).limit(1);
	if (!quiz) return json({ erro: 'Sala não encontrada: confira o código.' }, { status: 404 });

	const lista = await db
		.select({
			id: perguntas.id,
			ordem: perguntas.ordem,
			enunciado: perguntas.enunciado,
			imagemUrl: perguntas.imagemUrl,
			tipo: perguntas.tipo,
			conteudo: perguntas.conteudo
		})
		.from(perguntas)
		.where(eq(perguntas.quizId, quiz.id))
		.orderBy(asc(perguntas.ordem));

	return json({
		sala: {
			id: quiz.id,
			titulo: quiz.titulo,
			codigo: quiz.codigo,
			totalPerguntas: quiz.totalPerguntas,
			souDono: quiz.donoUid === usuario.uid,
			perguntas: lista
		}
	});
};
