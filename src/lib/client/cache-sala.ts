import type { EstadoDaSala } from './sessao';

/**
 * Última versão da sala vista por este usuário neste aparelho.
 *
 * Serve só para **leitura**: com a tela já carregada e sem rede, a sala continua mostrando a
 * pergunta e as opções, em vez de estourar em "Sem conexão com o servidor". A cópia é por
 * conta e por sala — conta B no mesmo aparelho não vê o cache da conta A.
 */

export type SalaGuardada = {
	estado: EstadoDaSala;
	salvoEm: string;
};

const PREFIXO = 'sala-cache';

const chaveDe = (uid: string, codigo: string) => `${PREFIXO}:${uid}:${codigo.toUpperCase()}`;

const temArmazenamento = () => typeof localStorage !== 'undefined';

export function guardarSala(uid: string, codigo: string, estado: EstadoDaSala): string {
	const salvoEm = new Date().toISOString();

	if (!uid || !codigo || !temArmazenamento()) return salvoEm;

	try {
		localStorage.setItem(chaveDe(uid, codigo), JSON.stringify({ estado, salvoEm }));
	} catch {
		// sem espaço: seguir sem cache é melhor que quebrar a tela
	}

	return salvoEm;
}

export function lerSala(uid: string, codigo: string): SalaGuardada | null {
	if (!uid || !codigo || !temArmazenamento()) return null;

	try {
		const bruto = localStorage.getItem(chaveDe(uid, codigo));
		if (!bruto) return null;

		const dados = JSON.parse(bruto) as SalaGuardada;
		return dados?.estado?.sessao ? dados : null;
	} catch {
		return null;
	}
}

export function esquecerSala(uid: string, codigo: string): void {
	if (!uid || !codigo || !temArmazenamento()) return;

	try {
		localStorage.removeItem(chaveDe(uid, codigo));
	} catch {
		// nada a fazer
	}
}

/** "23/11 15:42" — usado no aviso de cópia offline. */
export function horaCurta(iso: string): string {
	const data = new Date(iso);
	if (Number.isNaN(data.getTime())) return '';

	return data.toLocaleString('pt-BR', {
		day: '2-digit',
		month: '2-digit',
		hour: '2-digit',
		minute: '2-digit'
	});
}
