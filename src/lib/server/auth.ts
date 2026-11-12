import { env as envPublico } from '$env/dynamic/public';

export interface UsuarioAutenticado {
	uid: string;
	email: string | null;
	nome: string | null;
}

/**
 * Valida o idToken do Firebase Auth pela API pública (accounts:lookup), sem Admin SDK:
 * quem chama precisa mandar o token do usuário logado.
 */
export async function usuarioDoToken(idToken: string): Promise<UsuarioAutenticado | null> {
	const apiKey = envPublico.PUBLIC_FIREBASE_API_KEY;
	if (!apiKey || !idToken) return null;

	const resposta = await fetch(
		`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken })
		}
	);

	if (!resposta.ok) return null;

	const dados = (await resposta.json()) as {
		users?: { localId?: string; email?: string; displayName?: string; disabled?: boolean }[];
	};
	const usuario = dados.users?.[0];

	// conta apagada → lookup falha; conta desativada → vem com disabled=true (bloqueia igual)
	if (!usuario?.localId || usuario.disabled) return null;

	return {
		uid: usuario.localId,
		email: usuario.email ?? null,
		nome: usuario.displayName ?? null
	};
}

/**
 * Cache por requisição: o hook do servidor já validou o token, então o handler reaproveita
 * o resultado em vez de bater de novo na API do Firebase. Chave = o próprio `Request`
 * (morre junto com a requisição, sem TTL e sem risco de servir token revogado depois).
 */
const usuariosPorRequisicao = new WeakMap<Request, UsuarioAutenticado | null>();

export async function usuarioDaRequisicao(request: Request): Promise<UsuarioAutenticado | null> {
	if (usuariosPorRequisicao.has(request)) return usuariosPorRequisicao.get(request) ?? null;

	const autorizacao = request.headers.get('authorization') ?? '';
	const idToken = autorizacao.startsWith('Bearer ') ? autorizacao.slice(7) : '';
	const usuario = await usuarioDoToken(idToken);

	usuariosPorRequisicao.set(request, usuario);

	return usuario;
}
