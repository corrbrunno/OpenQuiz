import { and, asc, desc, eq, gt } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { mensagens, participantes, sessoes } from '$lib/server/db/schema';
import type { UsuarioAutenticado } from '$lib/server/auth';

export const LIMITE_TEXTO = 500;
export const LIMITE_HISTORICO = 100;

export type MensagemSala = {
	id: string;
	autorUid: string;
	autorNome: string;
	texto: string;
	criadoEm: string;
};

/**
 * Quem pode ler e escrever no chat: o dono da sessão e quem entrou na sala.
 * Não existe "entrar no chat" separado — o vínculo é o mesmo da sala.
 */
export async function acessoAoChat(
	sessao: typeof sessoes.$inferSelect,
	usuario: UsuarioAutenticado
): Promise<{ podeLer: boolean; podeEscrever: boolean; motivo: string }> {
	if (sessao.status === 'encerrada') {
		return { podeLer: false, podeEscrever: false, motivo: 'A sala foi encerrada.' };
	}

	const souDono = sessao.donoUid === usuario.uid;
	const vinculo = souDono
		? true
		: Boolean(
				(
					await getDb()
						.select({ id: participantes.id })
						.from(participantes)
						.where(and(eq(participantes.sessaoId, sessao.id), eq(participantes.uid, usuario.uid)))
						.limit(1)
				)[0]
			);

	if (!vinculo) {
		return { podeLer: false, podeEscrever: false, motivo: 'Você não está nesta sala.' };
	}

	return { podeLer: true, podeEscrever: sessao.chatAtivo, motivo: sessao.chatAtivo ? '' : 'O chat está pausado.' };
}

export async function listarMensagens(sessaoId: string, desde?: string | null): Promise<MensagemSala[]> {
	const db = getDb();

	if (desde) {
		// reconexão: só o que passou enquanto o stream estava fora
		const posteriores = await db
			.select()
			.from(mensagens)
			.where(and(eq(mensagens.sessaoId, sessaoId), gt(mensagens.criadoEm, new Date(desde))))
			.orderBy(asc(mensagens.criadoEm))
			.limit(LIMITE_HISTORICO);

		if (posteriores.length) return posteriores.map(paraMensagem);
	}

	const recentes = await db
		.select()
		.from(mensagens)
		.where(eq(mensagens.sessaoId, sessaoId))
		.orderBy(desc(mensagens.criadoEm))
		.limit(LIMITE_HISTORICO);

	return recentes.reverse().map(paraMensagem);
}

function paraMensagem(linha: typeof mensagens.$inferSelect): MensagemSala {
	return {
		id: linha.id,
		autorUid: linha.autorUid,
		autorNome: linha.autorNome,
		texto: linha.texto,
		criadoEm: linha.criadoEm.toISOString()
	};
}

export async function criarMensagem(entrada: {
	sessaoId: string;
	autorUid: string;
	autorNome: string;
	texto: string;
}): Promise<MensagemSala> {
	const texto = entrada.texto.trim().slice(0, LIMITE_TEXTO);

	const [linha] = await getDb()
		.insert(mensagens)
		.values({
			sessaoId: entrada.sessaoId,
			autorUid: entrada.autorUid,
			autorNome: entrada.autorNome,
			texto
		})
		.returning();

	return paraMensagem(linha);
}
