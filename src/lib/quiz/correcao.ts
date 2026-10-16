import type { Correcao, CorrecaoItem, RespostaComum } from './tipos';

function mapaDe(resposta: RespostaComum | null): Map<string, string> {
	return new Map((resposta?.atribuicoes ?? []).map((atribuicao) => [atribuicao.itemId, atribuicao.alvoId]));
}

/**
 * Correção única para todos os tipos de pergunta: compara duas respostas no formato comum.
 * Não há `switch` por tipo aqui — múltipla escolha, V/F, categorizar, reordenar e
 * correspondência caem todos no mesmo cálculo.
 */
export function corrigir(resposta: RespostaComum | null, gabarito: RespostaComum): Correcao {
	const esperado = mapaDe(gabarito);
	const obtido = mapaDe(resposta);

	const itens: CorrecaoItem[] = [...new Set([...esperado.keys(), ...obtido.keys()])].map((itemId) => {
		const alvoEsperado = esperado.get(itemId) ?? null;
		const alvoObtido = obtido.get(itemId) ?? null;

		return {
			itemId,
			esperado: alvoEsperado,
			obtido: alvoObtido,
			ok: alvoEsperado !== null && alvoEsperado === alvoObtido
		};
	});

	const acertos = itens.filter((item) => item.ok).length;
	const total = esperado.size;

	return {
		acertou: total > 0 && itens.length === total && acertos === total,
		acertos,
		total,
		itens
	};
}

export function resumoCorrecao(correcao: Correcao): string {
	if (correcao.total === 0) return 'Sem gabarito para corrigir.';
	if (correcao.acertou) return 'Resposta correta.';
	return `${correcao.acertos} de ${correcao.total} ${correcao.total === 1 ? 'item' : 'itens'} corretos.`;
}
