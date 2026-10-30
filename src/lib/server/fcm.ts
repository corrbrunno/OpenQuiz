import { createSign } from 'node:crypto';

/**
 * Envio de push pelo FCM v1 (HTTP) sem o Admin SDK: assina um JWT com a conta de serviço,
 * troca por access token e guarda em cache até perto de expirar.
 *
 * Sem FCM_CHAVE_BASE64 no ambiente o recurso fica inerte (web local, testes) — nunca lança.
 */
type Credencial = { client_email: string; private_key: string; project_id: string };

let credencial: Credencial | null = null;
let cache: { token: string; expiraEm: number } | null = null;

function base64url(dado: Buffer | string): string {
	return Buffer.from(dado)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
}

function lerCredencial(): Credencial | null {
	if (credencial) return credencial;
	const bruto = process.env.FCM_CHAVE_BASE64;
	if (!bruto) return null;

	try {
		credencial = JSON.parse(Buffer.from(bruto, 'base64').toString('utf8')) as Credencial;
		return credencial;
	} catch {
		return null;
	}
}

export function pushConfigurado(): boolean {
	return lerCredencial() !== null;
}

async function tokenDeAcesso(): Promise<string | null> {
	const chave = lerCredencial();
	if (!chave) return null;
	if (cache && cache.expiraEm > Date.now() + 60_000) return cache.token;

	const agora = Math.floor(Date.now() / 1000);
	const cabecalho = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
	const corpo = base64url(
		JSON.stringify({
			iss: chave.client_email,
			scope: 'https://www.googleapis.com/auth/firebase.messaging',
			aud: 'https://oauth2.googleapis.com/token',
			iat: agora,
			exp: agora + 3600
		})
	);

	const assinador = createSign('RSA-SHA256');
	assinador.update(`${cabecalho}.${corpo}`);
	const jwt = `${cabecalho}.${corpo}.${base64url(assinador.sign(chave.private_key))}`;

	const resposta = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
			assertion: jwt
		})
	}).catch(() => null);

	if (!resposta || !resposta.ok) return null;

	const dados = (await resposta.json()) as { access_token?: string; expires_in?: number };
	if (!dados.access_token) return null;

	cache = { token: dados.access_token, expiraEm: Date.now() + (dados.expires_in ?? 3600) * 1000 };
	return cache.token;
}

export type ResultadoEnvio = { enviados: number; falhas: number; tokensInvalidos: string[] };

/** Manda a mesma notificação para vários tokens. Token morto volta em `tokensInvalidos`. */
export async function enviarPush(
	tokens: string[],
	mensagem: { titulo: string; corpo: string; dados?: Record<string, string> }
): Promise<ResultadoEnvio> {
	const vazio: ResultadoEnvio = { enviados: 0, falhas: 0, tokensInvalidos: [] };
	if (!tokens.length) return vazio;

	const chave = lerCredencial();
	const acesso = await tokenDeAcesso();
	if (!chave || !acesso) return { ...vazio, falhas: tokens.length };

	const url = `https://fcm.googleapis.com/v1/projects/${chave.project_id}/messages:send`;
	const resultado: ResultadoEnvio = { enviados: 0, falhas: 0, tokensInvalidos: [] };

	await Promise.all(
		tokens.map(async (token) => {
			const resposta = await fetch(url, {
				method: 'POST',
				headers: { Authorization: `Bearer ${acesso}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: {
						token,
						notification: { title: mensagem.titulo, body: mensagem.corpo },
						android: {
							priority: 'high',
							notification: { channel_id: 'quiz-perguntas', sound: 'default' }
						},
						data: mensagem.dados ?? {}
					}
				})
			}).catch(() => null);

			if (resposta?.ok) {
				resultado.enviados += 1;
				return;
			}

			resultado.falhas += 1;
			const corpo = (await resposta?.json().catch(() => null)) as
				| { error?: { status?: string; details?: { errorCode?: string }[] } }
				| null;
			const codigo = corpo?.error?.details?.find((d) => d?.errorCode)?.errorCode;
			if (codigo === 'UNREGISTERED' || codigo === 'INVALID_ARGUMENT') {
				resultado.tokensInvalidos.push(token);
			}
		})
	);

	return resultado;
}
