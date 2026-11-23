import type { User } from 'firebase/auth';
import { ErroApi, semRede } from './api';
import { responderPergunta } from './sessao';
import type { Atribuicao } from '$lib/quiz/tipos';

/**
 * Fila de respostas gravadas sem internet.
 *
 * O que fica no aparelho é só o **payload** da resposta (pergunta + itens escolhidos), nunca
 * token nem sessão: o cabeçalho é montado na hora do envio. Isso é o que permite responder
 * offline mesmo com a sessão do servidor já expirada — ao reconectar, o app abre uma sessão
 * nova e só então esvazia a fila.
 *
 * Duplicação não é problema no servidor: `respostas_sessao_pergunta_participante_unico` +
 * `onConflictDoNothing()` devolvem a resposta já gravada em vez de criar outra linha.
 */

export type ItemPendente = {
	codigo: string;
	perguntaId: string;
	atribuicoes: Atribuicao[];
	criadoEm: string;
};

export type ResultadoSincronizacao = {
	enviadas: number;
	descartadas: number;
	restantes: number;
	/** '' quando tudo foi; 'rede' para quando a conexão caiu no meio; 'sessao' para 401. */
	erro: 'rede' | 'sessao' | '';
};

const PREFIXO = 'fila-offline';

const chaveDe = (uid: string) => `${PREFIXO}:${uid}`;

const temArmazenamento = () => typeof localStorage !== 'undefined';

export function pendentes(uid: string): ItemPendente[] {
	if (!uid || !temArmazenamento()) return [];

	try {
		const bruto = localStorage.getItem(chaveDe(uid));
		const itens = bruto ? (JSON.parse(bruto) as ItemPendente[]) : [];
		return Array.isArray(itens) ? itens : [];
	} catch {
		return [];
	}
}

function gravar(uid: string, itens: ItemPendente[]): void {
	if (!uid || !temArmazenamento()) return;

	try {
		localStorage.setItem(chaveDe(uid), JSON.stringify(itens));
	} catch {
		// armazenamento cheio/bloqueado: a fila simplesmente não persiste
	}
}

export function totalPendente(uid: string): number {
	return pendentes(uid).length;
}

export function pendentesDaSala(uid: string, codigo: string): ItemPendente[] {
	return pendentes(uid).filter((item) => item.codigo === codigo);
}

export function estaPendente(uid: string, codigo: string, perguntaId: string): boolean {
	return pendentes(uid).some((item) => item.codigo === codigo && item.perguntaId === perguntaId);
}

/** Enfileira (ou substitui, se a mesma pergunta foi respondida de novo antes de sincronizar). */
export function enfileirar(uid: string, item: ItemPendente): void {
	const atuais = pendentes(uid).filter(
		(entrada) => !(entrada.codigo === item.codigo && entrada.perguntaId === item.perguntaId)
	);

	gravar(uid, [...atuais, item]);
}

export function remover(uid: string, codigo: string, perguntaId: string): void {
	gravar(
		uid,
		pendentes(uid).filter(
			(entrada) => !(entrada.codigo === codigo && entrada.perguntaId === perguntaId)
		)
	);
}

/**
 * Tenta enviar tudo o que está na fila, na ordem em que foi gravado.
 *
 *  - 200/201: enviada (ou já gravada antes — o servidor devolve `jaRespondida`) → sai da fila;
 *  - 400/403/404/409: conflito real (pergunta saiu do ar, sessão encerrada, sala de outro dono)
 *    → sai da fila e é contabilizada como descartada, porque tentar de novo nunca vai passar;
 *  - 401: sessão expirada → **para** e mantém a fila, senão o usuário perderia respostas
 *    por causa do prazo de inatividade;
 *  - falha de rede: **para** e mantém, para tentar no próximo evento `online`.
 */
export async function sincronizarFila(usuario: User): Promise<ResultadoSincronizacao> {
	const itens = pendentes(usuario.uid);
	let enviadas = 0;
	let descartadas = 0;
	let erro: ResultadoSincronizacao['erro'] = '';

	for (const item of itens) {
		try {
			await responderPergunta(item.codigo, item.perguntaId, item.atribuicoes, usuario);
			enviadas += 1;
			remover(usuario.uid, item.codigo, item.perguntaId);
		} catch (falha) {
			if (falha instanceof ErroApi) {
				if (falha.status === 401) {
					erro = 'sessao';
					break;
				}

				if ([400, 403, 404, 409].includes(falha.status)) {
					descartadas += 1;
					remover(usuario.uid, item.codigo, item.perguntaId);
					continue;
				}

				break;
			}

			if (semRede(falha)) {
				erro = 'rede';
				break;
			}

			break;
		}
	}

	return { enviadas, descartadas, restantes: totalPendente(usuario.uid), erro };
}
