import type { ConteudoPergunta, Item, ParCorrespondencia } from './tipos';

/** Todos os ids que existem dentro de um conteúdo de pergunta (itens, opções, pares, coluna B). */
export function idsDoConteudo(conteudo: ConteudoPergunta): string[] {
	switch (conteudo.tipo) {
		case 'multipla-escolha':
			return conteudo.opcoes.map((opcao) => opcao.id);
		case 'verdadeiro-falso':
			return ['verdadeiro', 'falso'];
		case 'categorizar':
			return [...conteudo.itens, ...conteudo.categorias].map((item) => item.id);
		case 'reordenar':
			return conteudo.itens.map((item) => item.id);
		case 'correspondencia':
			return conteudo.pares.flatMap((par) => [par.id, par.idDireita]);
	}
}

export function novoId(): string {
	return crypto.randomUUID();
}

export function novoItem(texto = ''): Item {
	return { id: novoId(), texto };
}

export function novoPar(esquerda = '', direita = ''): ParCorrespondencia {
	return { id: novoId(), esquerda, direita, idDireita: novoId() };
}

export function adicionarItem(itens: Item[], texto = ''): Item {
	const item = novoItem(texto);
	itens.push(item);
	return item;
}

export function removerItem<T>(itens: T[], indice: number, minimo = 1): void {
	if (itens.length <= minimo) return;
	itens.splice(indice, 1);
}

export function moverItem<T>(itens: T[], de: number, para: number): void {
	if (para < 0 || para >= itens.length || de === para) return;
	const [item] = itens.splice(de, 1);
	itens.splice(para, 0, item);
}

export function alternar(lista: string[], id: string): void {
	const indice = lista.indexOf(id);
	if (indice === -1) lista.push(id);
	else lista.splice(indice, 1);
}

/** Embaralhamento determinístico: a mesma pergunta sempre gera a mesma ordem. */
export function embaralharComSemente<T>(valores: T[], semente: string): T[] {
	let estado = 0;
	for (const caractere of semente) estado = (estado * 31 + caractere.charCodeAt(0)) % 2147483647;

	const proximo = () => {
		estado = (estado * 48271) % 2147483647;
		return estado / 2147483647;
	};

	const copia = [...valores];
	for (let i = copia.length - 1; i > 0; i--) {
		const j = Math.floor(proximo() * (i + 1));
		[copia[i], copia[j]] = [copia[j], copia[i]];
	}
	return copia;
}
