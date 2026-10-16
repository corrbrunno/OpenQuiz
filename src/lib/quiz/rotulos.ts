import {
	ALVO_ESCOLHIDA,
	ALVO_MARCADA,
	type ConteudoPergunta,
	type ConteudoDe
} from './tipos';

function busca(itens: Array<{ id: string; texto: string }>, id: string): string | null {
	return itens.find((item) => item.id === id)?.texto ?? null;
}

/** Rótulo legível do item respondido (alternativa, item, par da coluna A). */
export function rotuloItem(conteudo: ConteudoPergunta, itemId: string): string {
	switch (conteudo.tipo) {
		case 'multipla-escolha':
			return busca(conteudo.opcoes, itemId) ?? '(alternativa removida)';
		case 'verdadeiro-falso':
			return itemId === 'verdadeiro' ? 'Verdadeiro' : 'Falso';
		case 'categorizar':
			return busca(conteudo.itens, itemId) ?? '(item removido)';
		case 'reordenar':
			return busca(conteudo.itens, itemId) ?? '(item removido)';
		case 'correspondencia': {
			const par = conteudo.pares.find((item) => item.id === itemId);
			return par?.esquerda ?? '(par removido)';
		}
	}
}

/** Rótulo legível do alvo escolhido (posição, categoria, coluna B). */
export function rotuloAlvo(conteudo: ConteudoPergunta, alvoId: string): string {
	switch (conteudo.tipo) {
		case 'multipla-escolha':
			return alvoId === ALVO_MARCADA ? 'marcada' : 'não marcada';
		case 'verdadeiro-falso':
			return alvoId === ALVO_ESCOLHIDA ? 'escolhida' : alvoId;
		case 'categorizar':
			return busca(conteudo.categorias, alvoId) ?? '(categoria removida)';
		case 'reordenar':
			return `posição ${alvoId}`;
		case 'correspondencia': {
			const par = conteudo.pares.find((item) => item.idDireita === alvoId);
			return par?.direita ?? '(item removido)';
		}
	}
}

export function quantosItens(conteudo: ConteudoDe<ConteudoPergunta['tipo']>): number {
	switch (conteudo.tipo) {
		case 'multipla-escolha':
			return conteudo.opcoes.length;
		case 'verdadeiro-falso':
			return 1;
		case 'categorizar':
			return conteudo.itens.length;
		case 'reordenar':
			return conteudo.itens.length;
		case 'correspondencia':
			return conteudo.pares.length;
	}
}
