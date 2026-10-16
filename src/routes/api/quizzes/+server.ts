import { json } from '@sveltejs/kit';
import { desc, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { gabaritos, perguntas, quizzes } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { validarPerguntaRecebida, type PerguntaRecebida } from '$lib/quiz/validacao';
import type { TipoPergunta } from '$lib/quiz/tipos';
import type { RequestHandler } from './$types';

const MAXIMO_PERGUNTAS = 30;

/** Meus questionários (só os do dono autenticado). O código da sala não aparece aqui. */
export const GET: RequestHandler = async ({ request }) => {
	if (!isDbConfigured()) {
		return json({ erro: 'DATABASE_URL não configurada no servidor.' }, { status: 500 });
	}

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta para ver seus questionários.' }, { status: 401 });

	const db = getDb();
	const lista = await db
		.select({
			id: quizzes.id,
			titulo: quizzes.titulo,
			totalPerguntas: quizzes.totalPerguntas,
			criadoEm: quizzes.criadoEm,
			atualizadoEm: quizzes.atualizadoEm
		})
		.from(quizzes)
		.where(eq(quizzes.donoUid, usuario.uid))
		.orderBy(desc(quizzes.atualizadoEm));

	return json({ quizzes: lista });
};

export const POST: RequestHandler = async ({ request }) => {
	if (!isDbConfigured()) {
		return json({ erro: 'DATABASE_URL não configurada no servidor.' }, { status: 500 });
	}

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) {
		return json({ erro: 'Entre na sua conta para salvar o questionário.' }, { status: 401 });
	}

	const corpo = (await request.json().catch(() => null)) as {
		titulo?: string;
		perguntas?: PerguntaRecebida[];
	} | null;

	const titulo = corpo?.titulo?.trim() ?? '';
	const recebidas = Array.isArray(corpo?.perguntas) ? corpo.perguntas : [];

	if (!titulo) return json({ erro: 'Informe o título do questionário.' }, { status: 400 });
	if (recebidas.length === 0) return json({ erro: 'Adicione pelo menos uma pergunta.' }, { status: 400 });
	if (recebidas.length > MAXIMO_PERGUNTAS) {
		return json({ erro: `Máximo de ${MAXIMO_PERGUNTAS} perguntas por questionário.` }, { status: 400 });
	}

	for (const [indice, recebida] of recebidas.entries()) {
		const problema = validarPerguntaRecebida(recebida);
		if (problema) return json({ erro: `Pergunta ${indice + 1}: ${problema}` }, { status: 400 });
	}

	const db = getDb();
	const salvo = await db.transaction(async (tx) => {
		const [quiz] = await tx
			.insert(quizzes)
			.values({
				titulo,
				donoUid: usuario.uid,
				donoEmail: usuario.email,
				totalPerguntas: recebidas.length
			})
			.returning({ id: quizzes.id });

		for (const [indice, recebida] of recebidas.entries()) {
			const conteudo = recebida.conteudo!;
			const [pergunta] = await tx
				.insert(perguntas)
				.values({
					quizId: quiz.id,
					ordem: indice + 1,
					enunciado: recebida.enunciado!.trim(),
					imagemUrl: recebida.imagemUrl ?? null,
					tipo: conteudo.tipo,
					conteudo
				})
				.returning({ id: perguntas.id });

			await tx.insert(gabaritos).values({
				perguntaId: pergunta.id,
				quizId: quiz.id,
				donoUid: usuario.uid,
				tipo: (recebida.gabarito?.tipo ?? conteudo.tipo) as TipoPergunta,
				atribuicoes: recebida.gabarito!.atribuicoes!
			});
		}

		return quiz;
	});

	return json({ id: salvo.id }, { status: 201 });
};
