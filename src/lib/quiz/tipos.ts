export const TIPOS_PERGUNTA = [
	'multipla-escolha',
	'verdadeiro-falso',
	'categorizar',
	'reordenar',
	'correspondencia'
] as const;

export type TipoPergunta = (typeof TIPOS_PERGUNTA)[number];

export const ROTULOS_TIPO: Record<TipoPergunta, string> = {
	'multipla-escolha': 'Múltipla escolha',
	'verdadeiro-falso': 'Verdadeiro ou falso',
	categorizar: 'Categorizar',
	reordenar: 'Reordenar',
	correspondencia: 'Tabela de correspondência'
};

export const DESCRICOES_TIPO: Record<TipoPergunta, string> = {
	'multipla-escolha': 'Alternativas com uma ou mais corretas.',
	'verdadeiro-falso': 'Uma afirmação para julgar como verdadeira ou falsa.',
	categorizar: 'Cada item deve ser associado a uma categoria.',
	reordenar: 'Os itens são embaralhados e o jogador devolve na ordem certa.',
	correspondencia: 'Ligar cada item da coluna A ao item correspondente da coluna B.'
};

export interface Item {
	id: string;
	texto: string;
}

export interface Categoria extends Item {}

export interface ParCorrespondencia {
	/** o item da coluna A é o que o jogador precisa casar */
	id: string;
	esquerda: string;
	direita: string;
	/** id estável do item da coluna B, usado no gabarito */
	idDireita: string;
}

/**
 * O que a pergunta precisa para ser renderizada — nunca contém a resposta certa.
 * A resposta certa vive no gabarito (formato `RespostaComum`).
 */
export type ConteudoPergunta =
	| { tipo: 'multipla-escolha'; opcoes: Item[]; permiteMultiplas: boolean }
	| { tipo: 'verdadeiro-falso' }
	| { tipo: 'categorizar'; itens: Item[]; categorias: Categoria[] }
	| { tipo: 'reordenar'; itens: Item[] }
	| { tipo: 'correspondencia'; pares: ParCorrespondencia[] };

export type ConteudoDe<T extends TipoPergunta> = Extract<ConteudoPergunta, { tipo: T }>;

/** Estado de configuração da resposta certa, por tipo (só existe no editor). */
export type GabaritoConfig =
	| { tipo: 'multipla-escolha'; corretas: string[] }
	| { tipo: 'verdadeiro-falso'; correta: 'verdadeiro' | 'falso' }
	| { tipo: 'categorizar'; associacoes: Record<string, string> }
	| { tipo: 'reordenar' }
	| { tipo: 'correspondencia' };

export type GabaritoDe<T extends TipoPergunta> = Extract<GabaritoConfig, { tipo: T }>;

/** Valores fixos usados como alvo quando a resposta é apenas "escolhi este item". */
export const ALVO_MARCADA = 'marcada';
export const ALVO_ESCOLHIDA = 'escolhida';

/** Uma associação item → alvo. É a unidade de qualquer resposta. */
export interface Atribuicao {
	itemId: string;
	alvoId: string;
}

/**
 * FORMATO COMUM DE RESPOSTA.
 * O gabarito (configuração) e a resposta do jogador são o mesmo tipo — a correção compara
 * duas destas, sem saber qual é o tipo da pergunta.
 */
export interface RespostaComum {
	perguntaId: string;
	tipo: TipoPergunta;
	atribuicoes: Atribuicao[];
}

export interface CorrecaoItem {
	itemId: string;
	esperado: string | null;
	obtido: string | null;
	ok: boolean;
}

export interface Correcao {
	acertou: boolean;
	acertos: number;
	total: number;
	itens: CorrecaoItem[];
}

export interface PerguntaSalva {
	id: string;
	ordem: number;
	enunciado: string;
	imagemUrl: string | null;
	tipo: TipoPergunta;
	conteudo: ConteudoPergunta;
}
