import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { gabaritos, perguntas, quizzes } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { validarPerguntaRecebida, type PerguntaRecebida } from '$lib/quiz/validacao';
import type { TipoPergunta } from '$lib/quiz/tipos';
import type { RequestHandler } from './$types';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TENTATIVAS_CODIGO = 5;
const MAXIMO_PERGUNTAS = 30;

function gerarCodigo(tamanho = 6): string {
	const valores = new Uint32Array(tamanho);
	crypto.getRandomValues(valores);
	return Array.from(valores, (valor) => ALFABETO[valor % ALFABETO.length]).join('');
}

function codigoDuplicado(falha: unknown): boolean {
	const erro = falha as { code?: string; constraint_name?: string };
	return erro?.code === '23505' && erro?.constraint_name === 'quizzes_codigo_unico';
}

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

	for (let tentativa = 1; tentativa <= TENTATIVAS_CODIGO; tentativa++) {
		const codigo = gerarCodigo();

		try {
			const salvo = await db.transaction(async (tx) => {
				const [quiz] = await tx
					.insert(quizzes)
					.values({
						titulo,
						codigo,
						donoUid: usuario.uid,
						donoEmail: usuario.email,
						totalPerguntas: recebidas.length
					})
					.returning({ id: quizzes.id, codigo: quizzes.codigo });

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

			return json({ id: salvo.id, codigo: salvo.codigo }, { status: 201 });
		} catch (falha) {
			if (codigoDuplicado(falha) && tentativa < TENTATIVAS_CODIGO) continue;
			if (codigoDuplicado(falha)) {
				return json(
					{ erro: 'Não foi possível reservar um código de sala livre. Tente novamente.' },
					{ status: 503 }
				);
			}
			throw falha;
		}
	}

	return json({ erro: 'Não foi possível salvar o questionário.' }, { status: 500 });
};

/** Perguntas já salvas, para reuso em telas de edição futuras. */
export const GET: RequestHandler = async ({ request, url }) => {
	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const codigo = (url.searchParams.get('codigo') ?? '').trim().toUpperCase();
	if (!codigo) return json({ erro: 'Informe o código da sala.' }, { status: 400 });

	const db = getDb();
	const [quiz] = await db.select().from(quizzes).where(eq(quizzes.codigo, codigo)).limit(1);
	if (!quiz) return json({ erro: 'Sala não encontrada.' }, { status: 404 });

	return json({ id: quiz.id, codigo: quiz.codigo, titulo: quiz.titulo, souDono: quiz.donoUid === usuario.uid });
};
