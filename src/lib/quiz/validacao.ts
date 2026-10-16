import { TIPOS_PERGUNTA, type Atribuicao, type ConteudoPergunta } from './tipos';
import { idsDoConteudo } from './utils';

/** Formato aceito pela API ao criar um questionário (vem do cliente, por isso é conferido). */
export interface PerguntaRecebida {
	enunciado?: string;
	imagemUrl?: string | null;
	tipo?: string;
	conteudo?: ConteudoPergunta;
	gabarito?: { tipo?: string; atribuicoes?: Atribuicao[] };
}

const MAXIMO_ATRIBUICOES = 30;

/**
 * Conferência do que chega na API. Não valida cada tipo em detalhe (isso é do editor),
 * mas garante o essencial: tipo conhecido, conteúdo coerente e gabarito apontando para itens reais.
 */
export function validarPerguntaRecebida(pergunta: PerguntaRecebida): string | null {
	const conteudo = pergunta?.conteudo;

	if (!conteudo || typeof conteudo !== 'object' || !('tipo' in conteudo)) {
		return 'pergunta sem conteúdo.';
	}
	if (!(TIPOS_PERGUNTA as readonly string[]).includes(conteudo.tipo)) {
		return `tipo de pergunta desconhecido: ${String(conteudo.tipo)}.`;
	}
	if (pergunta.tipo && pergunta.tipo !== conteudo.tipo) {
		return 'o tipo informado não bate com o conteúdo da pergunta.';
	}
	if (!pergunta.enunciado?.trim()) return 'pergunta sem enunciado.';

	const gabarito = pergunta.gabarito;
	if (!gabarito || !Array.isArray(gabarito.atribuicoes) || gabarito.atribuicoes.length === 0) {
		return 'pergunta sem gabarito.';
	}
	if (gabarito.atribuicoes.length > MAXIMO_ATRIBUICOES) return 'gabarito com itens demais.';

	const ids = new Set(idsDoConteudo(conteudo));

	for (const atribuicao of gabarito.atribuicoes) {
		if (typeof atribuicao?.itemId !== 'string' || typeof atribuicao?.alvoId !== 'string') {
			return 'gabarito com atribuição inválida.';
		}
		if (!ids.has(atribuicao.itemId)) {
			return 'o gabarito aponta para um item que não existe na pergunta.';
		}
	}

	return null;
}
