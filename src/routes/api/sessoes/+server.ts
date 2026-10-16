import { json } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import { getDb, isDbConfigured } from '$lib/server/db';
import { perguntas, quizzes, sessoes, MODOS_SESSAO, type ModoSessao } from '$lib/server/db/schema';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { gerarCodigo } from '$lib/server/sessoes';
import type { RequestHandler } from './$types';

const TENTATIVAS_CODIGO = 5;

function codigoDuplicado(falha: unknown): boolean {
	const erro = falha as { code?: string; constraint_name?: string };
	return erro?.code === '23505' && erro?.constraint_name === 'sessoes_codigo_unico';
}

/**
 * Inicia uma sessão: é AQUI que o código da sala nasce (o questionário em si não tem código).
 * Quem inicia decide o ritmo: `conduzida` (o apresentador controla) ou `livre` (cada um no seu).
 */
export const POST: RequestHandler = async ({ request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada no servidor.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta para iniciar a sessão.' }, { status: 401 });

	const corpo = (await request.json().catch(() => null)) as {
		quizId?: string;
		modo?: string;
	} | null;

	const modo = corpo?.modo ?? 'conduzida';
	if (!(MODOS_SESSAO as readonly string[]).includes(modo)) {
		return json({ erro: 'Ritmo inválido: use "conduzida" ou "livre".' }, { status: 400 });
	}

	const db = getDb();
	const [quiz] = await db
		.select()
		.from(quizzes)
		.where(and(eq(quizzes.id, corpo?.quizId ?? ''), eq(quizzes.donoUid, usuario.uid)))
		.limit(1);

	if (!quiz) return json({ erro: 'Questionário não encontrado.' }, { status: 404 });

	const [primeiraPergunta] = await db
		.select({ id: perguntas.id })
		.from(perguntas)
		.where(eq(perguntas.quizId, quiz.id))
		.limit(1);

	if (!primeiraPergunta) return json({ erro: 'Este questionário não tem perguntas.' }, { status: 400 });

	for (let tentativa = 1; tentativa <= TENTATIVAS_CODIGO; tentativa++) {
		const codigo = gerarCodigo();

		try {
			const [sessao] = await db
				.insert(sessoes)
				.values({
					quizId: quiz.id,
					donoUid: usuario.uid,
					codigo,
					modo: modo as ModoSessao,
					perguntaAtual: 1
				})
				.returning({ codigo: sessoes.codigo, modo: sessoes.modo });

			return json({ sessao }, { status: 201 });
		} catch (falha) {
			if (codigoDuplicado(falha) && tentativa < TENTATIVAS_CODIGO) continue;
			if (codigoDuplicado(falha)) {
				return json({ erro: 'Não foi possível reservar um código livre. Tente de novo.' }, { status: 503 });
			}
			throw falha;
		}
	}

	return json({ erro: 'Não foi possível iniciar a sessão.' }, { status: 500 });
};
