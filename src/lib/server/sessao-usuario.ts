import { and, eq, gt, isNull } from 'drizzle-orm';
import { json } from '@sveltejs/kit';
import { getDb } from './db';
import { sessoesUsuario } from './db/schema';
import type { UsuarioAutenticado } from './auth';

/** Limite de inatividade exigido no material da disciplina (120 s). */
export const LIMITE_INATIVIDADE_MS = 120_000;

const FORMATO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function daquiA(ms: number): Date {
	return new Date(Date.now() + ms);
}

export async function abrirSessao(usuario: UsuarioAutenticado) {
	const db = getDb();

	const [linha] = await db
		.insert(sessoesUsuario)
		.values({
			uid: usuario.uid,
			email: usuario.email,
			expiraEm: daquiA(LIMITE_INATIVIDADE_MS)
		})
		.returning();

	return linha;
}

export async function tocarSessao(usuario: UsuarioAutenticado, sessaoId: string) {
	if (!FORMATO_UUID.test(sessaoId)) return null;

	const db = getDb();
	const [linha] = await db
		.update(sessoesUsuario)
		.set({ ultimaAtividadeEm: new Date(), expiraEm: daquiA(LIMITE_INATIVIDADE_MS) })
		.where(
			and(
				eq(sessoesUsuario.id, sessaoId),
				eq(sessoesUsuario.uid, usuario.uid),
				isNull(sessoesUsuario.encerradaEm)
			)
		)
		.returning();

	return linha ?? null;
}

export async function encerrarSessao(usuario: UsuarioAutenticado, sessaoId: string) {
	if (!FORMATO_UUID.test(sessaoId)) return;

	const db = getDb();
	await db
		.update(sessoesUsuario)
		.set({ encerradaEm: new Date() })
		.where(and(eq(sessoesUsuario.id, sessaoId), eq(sessoesUsuario.uid, usuario.uid)));
}

/** Sessão válida = existe, é do usuário, não foi encerrada e ainda não venceu. */
export async function sessaoValida(usuario: UsuarioAutenticado, sessaoId: string) {
	if (!FORMATO_UUID.test(sessaoId)) return null;

	const db = getDb();
	const [linha] = await db
		.select()
		.from(sessoesUsuario)
		.where(
			and(
				eq(sessoesUsuario.id, sessaoId),
				eq(sessoesUsuario.uid, usuario.uid),
				isNull(sessoesUsuario.encerradaEm),
				gt(sessoesUsuario.expiraEm, new Date())
			)
		)
		.limit(1);

	return linha ?? null;
}

/** Id da sessão do app vem no cabeçalho (o EventSource não manda header, ver `/eventos`). */
export function sessaoDoCabecalho(request: Request): string {
	return request.headers.get('x-sessao') ?? '';
}

type SessaoVigente = NonNullable<Awaited<ReturnType<typeof sessaoValida>>>;

/**
 * Sessão validada UMA vez por requisição: o hook do servidor faz a guarda e os handlers
 * reaproveitam o resultado. A chave é o próprio `Request`, então não existe cache entre
 * requisições — revogar a sessão vale imediatamente para a próxima chamada.
 */
const sessoesPorRequisicao = new WeakMap<Request, SessaoVigente | null>();

export async function sessaoDaRequisicao(
	request: Request,
	usuario: UsuarioAutenticado
): Promise<SessaoVigente | null> {
	if (sessoesPorRequisicao.has(request)) return sessoesPorRequisicao.get(request) ?? null;

	const sessao = await sessaoValida(usuario, sessaoDoCabecalho(request));
	sessoesPorRequisicao.set(request, sessao);

	return sessao;
}

/**
 * Guarda das rotas que MUDAM dados: sem sessão de app válida, a operação não passa.
 * É o cenário "operar com sessão revogada/expirada → o backend bloqueia".
 *
 * A mesma regra vale para toda a API no `hooks.server.ts`; esta checagem continua aqui
 * como segunda barreira (e é o que garante o 401 correto se a rota for chamada de outro lugar).
 */
export async function exigirSessao(request: Request, usuario: UsuarioAutenticado) {
	const sessao = await sessaoDaRequisicao(request, usuario);
	if (sessao) return null;

	return json(
		{
			erro: 'Sua sessão expirou por inatividade. Entre novamente.',
			codigo: 'sessao-invalida'
		},
		{ status: 401 }
	);
}
