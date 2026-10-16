import {
	ALVO_ESCOLHIDA,
	ALVO_MARCADA,
	type Atribuicao,
	type ConteudoPergunta,
	type GabaritoConfig,
	type GabaritoDe,
	type ParCorrespondencia,
	type PerguntaSalva,
	type RespostaComum,
	type TipoPergunta
} from './tipos';
import { novoId, novoItem, novoPar } from './utils';

/** O que o editor guarda enquanto a pergunta não foi salva. */
export interface RascunhoPergunta {
	id: string;
	enunciado: string;
	/** Arquivo escolhido agora (opcional). */
	imagem: File | null;
	/** Pré-visualização local do arquivo escolhido agora. */
	previa: string | null;
	/** Imagem já salva no servidor — mantida quando o editor não troca o arquivo. */
	imagemUrl: string | null;
	conteudo: ConteudoPergunta;
	gabarito: GabaritoConfig;
}

/** O que o componente de resposta guarda enquanto o jogador decide. */
export type RascunhoResposta =
	| { tipo: 'multipla-escolha'; marcadas: string[] }
	| { tipo: 'verdadeiro-falso'; escolha: 'verdadeiro' | 'falso' | null }
	| { tipo: 'categorizar'; associacoes: Record<string, string> }
	| { tipo: 'reordenar'; ordem: string[] }
	| { tipo: 'correspondencia'; associacoes: Record<string, string> };

export function conteudoPadrao(tipo: TipoPergunta): ConteudoPergunta {
	switch (tipo) {
		case 'multipla-escolha':
			return {
				tipo,
				opcoes: [novoItem(), novoItem(), novoItem(), novoItem()],
				permiteMultiplas: false
			};
		case 'verdadeiro-falso':
			return { tipo };
		case 'categorizar':
			return {
				tipo,
				itens: [novoItem(), novoItem()],
				categorias: [novoItem('Categoria A'), novoItem('Categoria B')]
			};
		case 'reordenar':
			return { tipo, itens: [novoItem(), novoItem(), novoItem()] };
		case 'correspondencia':
			return { tipo, pares: [novoPar(), novoPar()] };
	}
}

export function gabaritoPadrao(tipo: TipoPergunta): GabaritoConfig {
	switch (tipo) {
		case 'multipla-escolha':
			return { tipo, corretas: [] };
		case 'verdadeiro-falso':
			return { tipo, correta: 'verdadeiro' };
		case 'categorizar':
			return { tipo, associacoes: {} };
		case 'reordenar':
			return { tipo };
		case 'correspondencia':
			return { tipo };
	}
}

export function novaPergunta(tipo: TipoPergunta = 'multipla-escolha'): RascunhoPergunta {
	return {
		id: novoId(),
		enunciado: '',
		imagem: null,
		previa: null,
		imagemUrl: null,
		conteudo: conteudoPadrao(tipo),
		gabarito: gabaritoPadrao(tipo)
	};
}

/**
 * Caminho de volta: do formato comum (banco) para o estado de configuração do editor.
 * É o inverso de `montarGabarito` — sem isso, editar um questionário perderia a resposta certa.
 */
export function desmontarGabarito(
	conteudo: ConteudoPergunta,
	gabarito: RespostaComum | null
): GabaritoConfig {
	const atribuicoes = gabarito?.atribuicoes ?? [];

	switch (conteudo.tipo) {
		case 'multipla-escolha':
			return {
				tipo: conteudo.tipo,
				corretas: atribuicoes
					.filter((atribuicao) => atribuicao.alvoId === ALVO_MARCADA)
					.map((atribuicao) => atribuicao.itemId)
			};
		case 'verdadeiro-falso': {
			const escolhida = atribuicoes.find((atribuicao) => atribuicao.alvoId === ALVO_ESCOLHIDA);
			return { tipo: conteudo.tipo, correta: escolhida?.itemId === 'falso' ? 'falso' : 'verdadeiro' };
		}
		case 'categorizar':
			return {
				tipo: conteudo.tipo,
				associacoes: Object.fromEntries(
					atribuicoes.map((atribuicao) => [atribuicao.itemId, atribuicao.alvoId])
				)
			};
		case 'reordenar':
			return { tipo: conteudo.tipo };
		case 'correspondencia':
			return { tipo: conteudo.tipo };
	}
}

/** Reconstrói o rascunho do editor a partir de uma pergunta salva (usado ao editar). */
export function rascunhoDePerguntaSalva(
	pergunta: PerguntaSalva,
	gabarito: RespostaComum | null
): RascunhoPergunta {
	const conteudo = structuredClone(pergunta.conteudo);

	// No reordenar, a ordem certa é o gabarito: reordena os itens como estavam ao salvar.
	if (conteudo.tipo === 'reordenar' && gabarito) {
		const posicao = new Map(gabarito.atribuicoes.map((a) => [a.itemId, Number(a.alvoId)]));
		conteudo.itens = [...conteudo.itens].sort(
			(a, b) => (posicao.get(a.id) ?? 0) - (posicao.get(b.id) ?? 0)
		);
	}

	return {
		id: pergunta.id,
		enunciado: pergunta.enunciado,
		imagem: null,
		previa: null,
		imagemUrl: pergunta.imagemUrl,
		conteudo,
		gabarito: desmontarGabarito(conteudo, gabarito)
	};
}

export function trocarTipo(rascunho: RascunhoPergunta, tipo: TipoPergunta): void {
	if (rascunho.conteudo.tipo === tipo) return;

	rascunho.conteudo = conteudoPadrao(tipo);
	rascunho.gabarito = gabaritoPadrao(tipo);
}

/** Converte o estado do jogador para o formato comum. */
export function montarResposta(perguntaId: string, rascunho: RascunhoResposta): RespostaComum {
	let atribuicoes: Atribuicao[] = [];

	switch (rascunho.tipo) {
		case 'multipla-escolha':
			atribuicoes = rascunho.marcadas.map((itemId) => ({ itemId, alvoId: ALVO_MARCADA }));
			break;
		case 'verdadeiro-falso':
			atribuicoes = rascunho.escolha ? [{ itemId: rascunho.escolha, alvoId: ALVO_ESCOLHIDA }] : [];
			break;
		case 'categorizar':
		case 'correspondencia':
			atribuicoes = Object.entries(rascunho.associacoes).map(([itemId, alvoId]) => ({
				itemId,
				alvoId
			}));
			break;
		case 'reordenar':
			atribuicoes = rascunho.ordem.map((itemId, indice) => ({
				itemId,
				alvoId: String(indice + 1)
			}));
			break;
	}

	return { perguntaId, tipo: rascunho.tipo, atribuicoes };
}

/** Converte o gabarito do editor para o MESMO formato comum. */
export function montarGabarito(rascunho: RascunhoPergunta): RespostaComum {
	const conteudo = rascunho.conteudo;
	let atribuicoes: Atribuicao[] = [];

	switch (conteudo.tipo) {
		case 'multipla-escolha': {
			const config = rascunho.gabarito as GabaritoDe<'multipla-escolha'>;
			const validas = new Set(conteudo.opcoes.map((opcao) => opcao.id));
			atribuicoes = config.corretas
				.filter((id) => validas.has(id))
				.map((itemId) => ({ itemId, alvoId: ALVO_MARCADA }));
			break;
		}
		case 'verdadeiro-falso': {
			const config = rascunho.gabarito as GabaritoDe<'verdadeiro-falso'>;
			atribuicoes = [{ itemId: config.correta, alvoId: ALVO_ESCOLHIDA }];
			break;
		}
		case 'categorizar': {
			const config = rascunho.gabarito as GabaritoDe<'categorizar'>;
			const itens = new Set(conteudo.itens.map((item) => item.id));
			const categorias = new Set(conteudo.categorias.map((categoria) => categoria.id));
			atribuicoes = Object.entries(config.associacoes)
				.filter(([itemId, alvoId]) => itens.has(itemId) && categorias.has(alvoId))
				.map(([itemId, alvoId]) => ({ itemId, alvoId }));
			break;
		}
		case 'reordenar':
			atribuicoes = conteudo.itens.map((item, indice) => ({
				itemId: item.id,
				alvoId: String(indice + 1)
			}));
			break;
		case 'correspondencia':
			atribuicoes = conteudo.pares
				.filter((par) => par.direita.trim() !== '')
				.map((par) => ({ itemId: par.id, alvoId: par.idDireita }));
			break;
	}

	return { perguntaId: rascunho.id, tipo: conteudo.tipo, atribuicoes };
}

export function novoRascunhoResposta(conteudo: ConteudoPergunta): RascunhoResposta {
	switch (conteudo.tipo) {
		case 'multipla-escolha':
			return { tipo: conteudo.tipo, marcadas: [] };
		case 'verdadeiro-falso':
			return { tipo: conteudo.tipo, escolha: null };
		case 'categorizar':
			return { tipo: conteudo.tipo, associacoes: {} };
		case 'reordenar':
			return { tipo: conteudo.tipo, ordem: conteudo.itens.map((item) => item.id) };
		case 'correspondencia':
			return { tipo: conteudo.tipo, associacoes: {} };
	}
}

/**
 * Inverso de `montarResposta`: reconstrói o estado do jogador a partir das atribuições já gravadas,
 * para a tela mostrar a resposta que ele deu (e não uma tela em branco).
 */
export function estadoDeAtribuicoes(
	conteudo: ConteudoPergunta,
	atribuicoes: Atribuicao[] | null | undefined
): RascunhoResposta {
	const lista = atribuicoes ?? [];
	const porItem = new Map(lista.map((atribuicao) => [atribuicao.itemId, atribuicao.alvoId]));

	switch (conteudo.tipo) {
		case 'multipla-escolha':
			return {
				tipo: conteudo.tipo,
				marcadas: lista
					.filter((atribuicao) => atribuicao.alvoId === ALVO_MARCADA)
					.map((atribuicao) => atribuicao.itemId)
			};
		case 'verdadeiro-falso': {
			const escolhida = lista.find((atribuicao) => atribuicao.alvoId === ALVO_ESCOLHIDA);
			return {
				tipo: conteudo.tipo,
				escolha: escolhida?.itemId === 'falso' ? 'falso' : escolhida ? 'verdadeiro' : null
			};
		}
		case 'categorizar':
		case 'correspondencia':
			return { tipo: conteudo.tipo, associacoes: Object.fromEntries(porItem) };
		case 'reordenar':
			return {
				tipo: conteudo.tipo,
				ordem: [...conteudo.itens]
					.sort((a, b) => Number(porItem.get(a.id) ?? 0) - Number(porItem.get(b.id) ?? 0))
					.map((item) => item.id)
			};
	}
}

export function validarPergunta(rascunho: RascunhoPergunta): string | null {
	if (!rascunho.enunciado.trim()) return 'escreva o enunciado.';

	const conteudo = rascunho.conteudo;

	switch (conteudo.tipo) {
		case 'multipla-escolha': {
			const config = rascunho.gabarito as GabaritoDe<'multipla-escolha'>;
			const comTexto = conteudo.opcoes.filter((opcao) => opcao.texto.trim() !== '');
			if (comTexto.length < 2) return 'informe pelo menos duas alternativas com texto.';
			if (comTexto.length !== conteudo.opcoes.length) {
				return 'remova ou preencha as alternativas vazias.';
			}
			if (config.corretas.length === 0) return 'marque a alternativa correta.';
			if (!conteudo.permiteMultiplas && config.corretas.length > 1) {
				return 'só pode haver uma correta — ative "mais de uma resposta" ou desmarque as extras.';
			}
			return null;
		}
		case 'verdadeiro-falso':
			return null;
		case 'categorizar': {
			const config = rascunho.gabarito as GabaritoDe<'categorizar'>;
			if (conteudo.itens.length < 1) return 'adicione pelo menos um item.';
			if (conteudo.categorias.length < 2) return 'informe pelo menos duas categorias.';
			if (conteudo.itens.some((item) => !item.texto.trim())) return 'preencha o texto de todos os itens.';
			if (conteudo.categorias.some((categoria) => !categoria.texto.trim())) {
				return 'preencha o nome de todas as categorias.';
			}
			const semCategoria = conteudo.itens.filter((item) => !config.associacoes[item.id]);
			if (semCategoria.length > 0) return 'associe cada item a uma categoria.';
			return null;
		}
		case 'reordenar': {
			if (conteudo.itens.length < 2) return 'adicione pelo menos dois itens.';
			if (conteudo.itens.some((item) => !item.texto.trim())) return 'preencha o texto de todos os itens.';
			return null;
		}
		case 'correspondencia': {
			if (conteudo.pares.length < 2) return 'adicione pelo menos dois pares.';
			const invalidos = conteudo.pares.filter(
				(par) => !par.esquerda.trim() || !par.direita.trim()
			);
			if (invalidos.length > 0) return 'preencha as duas colunas de todos os pares.';
			return null;
		}
	}
}

export function limparRascunhoDeResposta(rascunho: RascunhoResposta): void {
	switch (rascunho.tipo) {
		case 'multipla-escolha':
			rascunho.marcadas = [];
			break;
		case 'verdadeiro-falso':
			rascunho.escolha = null;
			break;
		case 'categorizar':
		case 'correspondencia':
			rascunho.associacoes = {};
			break;
		case 'reordenar':
			rascunho.ordem = [];
			break;
	}
}

export type { ParCorrespondencia };
