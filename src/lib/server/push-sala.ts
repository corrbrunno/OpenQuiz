import { and, eq, inArray, lt, or } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { participantes, tokensPush } from '$lib/server/db/schema';
import { enviarPush, pushConfigurado } from '$lib/server/fcm';

/** Quem conta como "saiu do app": marcou presença falsa ou não dá sinal há mais de 60 s. */
const SEM_SINAL_MS = 60_000;

export type ResumoNotificacao = { ausentes: number; enviados: number; falhas: number };

/**
 * Avisa quem está fora do app que uma pergunta nova entrou no ar.
 * Só faz sentido na sessão conduzida (no ritmo livre ninguém é chamado no meio).
 */
export async function notificarNovaPergunta(
	sessaoId: string,
	codigo: string,
	pergunta: number,
	total: number
): Promise<ResumoNotificacao> {
	const vazio = { ausentes: 0, enviados: 0, falhas: 0 };
	if (!pushConfigurado()) return vazio;

	const db = getDb();
	const limite = new Date(Date.now() - SEM_SINAL_MS);

	const ausentes = await db
		.select({ uid: participantes.uid })
		.from(participantes)
		.where(
			and(
				eq(participantes.sessaoId, sessaoId),
				or(eq(participantes.emApp, false), lt(participantes.ultimaAtividadeEm, limite))
			)
		);

	if (!ausentes.length) return vazio;

	const tokens = await db
		.select({ token: tokensPush.token })
		.from(tokensPush)
		.where(
			inArray(
				tokensPush.uid,
				ausentes.map((a) => a.uid)
			)
		);

	if (!tokens.length) return { ...vazio, ausentes: ausentes.length };

	const envio = await enviarPush(
		tokens.map((t) => t.token),
		{
			titulo: `Pergunta ${pergunta} de ${total} no ar`,
			corpo: 'A sala avançou e você está fora do app. Toque para responder.',
			dados: { codigo, pergunta: String(pergunta) }
		}
	);

	if (envio.tokensInvalidos.length) {
		await db.delete(tokensPush).where(inArray(tokensPush.token, envio.tokensInvalidos));
	}

	return { ausentes: ausentes.length, enviados: envio.enviados, falhas: envio.falhas };
}
