/**
 * Teste da camada de lógica (sem navegador): monta gabarito e resposta nos cinco tipos
 * e confere a correção única. Rode com `npm run test:logica`.
 */
import { corrigir } from '../src/lib/quiz/correcao';
import {
	montarGabarito,
	montarResposta,
	novaPergunta,
	validarPergunta,
	type RascunhoPergunta,
	type RascunhoResposta
} from '../src/lib/quiz/rascunhos';
import { novoItem, novoPar } from '../src/lib/quiz/utils';

let falhas = 0;

function conferir(rotulo: string, obtido: unknown, esperado: unknown) {
	const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
	if (!ok) falhas++;
	console.log(`${ok ? 'OK  ' : 'FALHA'} ${rotulo} -> ${JSON.stringify(obtido)}${ok ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
}

function perguntaMultipla(permiteMultiplas: boolean, corretas: string[]): RascunhoPergunta {
	const rascunho = novaPergunta('multipla-escolha');
	rascunho.enunciado = 'Qual é a capital?';

	const conteudo = rascunho.conteudo;
	if (conteudo.tipo !== 'multipla-escolha') throw new Error('tipo inesperado');

	conteudo.opcoes = [novoItem('A'), novoItem('B'), novoItem('C')];
	conteudo.permiteMultiplas = permiteMultiplas;

	if (rascunho.gabarito.tipo === 'multipla-escolha') {
		rascunho.gabarito.corretas = corretas.map((indice) => conteudo.opcoes[Number(indice)].id);
	}

	return rascunho;
}

function respostaMultipla(rascunho: RascunhoPergunta, indices: string[]): RascunhoResposta {
	const conteudo = rascunho.conteudo;
	if (conteudo.tipo !== 'multipla-escolha') throw new Error('tipo inesperado');

	return {
		tipo: 'multipla-escolha',
		marcadas: indices.map((indice) => conteudo.opcoes[Number(indice)].id)
	};
}

console.log('=== MULTIPLA ESCOLHA (uma correta) ===');
const simples = perguntaMultipla(false, ['1']);
const gabaritoSimples = montarGabarito(simples);

conferir('acertou ao marcar a correta', corrigir(montarResposta(simples.id, respostaMultipla(simples, ['1'])), gabaritoSimples).acertou, true);
conferir('total', corrigir(montarResposta(simples.id, respostaMultipla(simples, ['1'])), gabaritoSimples).total, 1);

const errada = corrigir(montarResposta(simples.id, respostaMultipla(simples, ['0'])), gabaritoSimples);
conferir('errou ao marcar outra', errada.acertou, false);
conferir('acertos', errada.acertos, 0);
conferir('sem resposta nao acerta', corrigir(null, gabaritoSimples).acertou, false);

console.log('=== MULTIPLA ESCOLHA (varias corretas) ===');
const multipla = perguntaMultipla(true, ['0', '2']);
const gabaritoMultiplo = montarGabarito(multipla);

conferir(
	'duas marcadas corretas',
	corrigir(montarResposta(multipla.id, respostaMultipla(multipla, ['2', '0'])), gabaritoMultiplo).acertou,
	true
);

const parcial = corrigir(montarResposta(multipla.id, respostaMultipla(multipla, ['0'])), gabaritoMultiplo);
conferir('marcou so uma: acertos', parcial.acertos, 1);
conferir('marcou so uma: acertou', parcial.acertou, false);

console.log('=== VERDADEIRO OU FALSO ===');
const vf = novaPergunta('verdadeiro-falso');
vf.enunciado = 'A terra é plana';
if (vf.gabarito.tipo === 'verdadeiro-falso') vf.gabarito.correta = 'falso';
const gabaritoVf = montarGabarito(vf);

conferir('respondeu falso', corrigir(montarResposta(vf.id, { tipo: 'verdadeiro-falso', escolha: 'falso' }), gabaritoVf).acertou, true);
conferir('respondeu verdadeiro', corrigir(montarResposta(vf.id, { tipo: 'verdadeiro-falso', escolha: 'verdadeiro' }), gabaritoVf).acertou, false);

console.log('=== CATEGORIZAR ===');
const categorizar = novaPergunta('categorizar');
categorizar.enunciado = 'Separe os animais';
const conteudoCat = categorizar.conteudo;
if (conteudoCat.tipo !== 'categorizar' || categorizar.gabarito.tipo !== 'categorizar') {
	throw new Error('tipo inesperado');
}

conteudoCat.itens = [novoItem('Cachorro'), novoItem('Águia')];
conteudoCat.categorias = [novoItem('Mamífero'), novoItem('Ave')];
categorizar.gabarito.associacoes = {
	[conteudoCat.itens[0].id]: conteudoCat.categorias[0].id,
	[conteudoCat.itens[1].id]: conteudoCat.categorias[1].id
};
const gabaritoCat = montarGabarito(categorizar);

conferir(
	'associou tudo certo',
	corrigir(
		montarResposta(categorizar.id, {
			tipo: 'categorizar',
			associacoes: {
				[conteudoCat.itens[0].id]: conteudoCat.categorias[0].id,
				[conteudoCat.itens[1].id]: conteudoCat.categorias[1].id
			}
		}),
		gabaritoCat
	).acertou,
	true
);

const catParcial = corrigir(
	montarResposta(categorizar.id, {
		tipo: 'categorizar',
		associacoes: {
			[conteudoCat.itens[0].id]: conteudoCat.categorias[1].id,
			[conteudoCat.itens[1].id]: conteudoCat.categorias[1].id
		}
	}),
	gabaritoCat
);
conferir('uma certa e uma errada: acertos', catParcial.acertos, 1);
conferir('uma certa e uma errada: acertou', catParcial.acertou, false);

console.log('=== REORDENAR ===');
const reordenar = novaPergunta('reordenar');
reordenar.enunciado = 'Ordene';
const conteudoOrd = reordenar.conteudo;
if (conteudoOrd.tipo !== 'reordenar') throw new Error('tipo inesperado');

conteudoOrd.itens = [novoItem('Primeiro'), novoItem('Segundo'), novoItem('Terceiro')];
const gabaritoOrd = montarGabarito(reordenar);
conferir('gabarito tem 3 posicoes', gabaritoOrd.atribuicoes.length, 3);

const ordemCerta = conteudoOrd.itens.map((item) => item.id);
conferir('ordem certa', corrigir(montarResposta(reordenar.id, { tipo: 'reordenar', ordem: ordemCerta }), gabaritoOrd).acertou, true);

const ordErrada = corrigir(
	montarResposta(reordenar.id, { tipo: 'reordenar', ordem: [...ordemCerta].reverse() }),
	gabaritoOrd
);
conferir('ordem invertida: acertos', ordErrada.acertos, 1);
conferir('ordem invertida: acertou', ordErrada.acertou, false);

console.log('=== CORRESPONDENCIA ===');
const correspondencia = novaPergunta('correspondencia');
correspondencia.enunciado = 'Ligue';
const conteudoCor = correspondencia.conteudo;
if (conteudoCor.tipo !== 'correspondencia') throw new Error('tipo inesperado');

conteudoCor.pares = [novoPar('Brasil', 'Brasília'), novoPar('França', 'Paris')];
const gabaritoCor = montarGabarito(correspondencia);

conferir(
	'ligou certo',
	corrigir(
		montarResposta(correspondencia.id, {
			tipo: 'correspondencia',
			associacoes: {
				[conteudoCor.pares[0].id]: conteudoCor.pares[0].idDireita,
				[conteudoCor.pares[1].id]: conteudoCor.pares[1].idDireita
			}
		}),
		gabaritoCor
	).acertou,
	true
);

conferir(
	'trocou as colunas: acertos',
	corrigir(
		montarResposta(correspondencia.id, {
			tipo: 'correspondencia',
			associacoes: {
				[conteudoCor.pares[0].id]: conteudoCor.pares[1].idDireita,
				[conteudoCor.pares[1].id]: conteudoCor.pares[0].idDireita
			}
		}),
		gabaritoCor
	).acertos,
	0
);

console.log('=== VALIDACAO ===');
conferir('sem enunciado', validarPergunta(novaPergunta('multipla-escolha')) !== null, true);
conferir('multipla sem correta marcada', validarPergunta(perguntaMultipla(false, [])), 'marque a alternativa correta.');
conferir('pergunta valida', validarPergunta(perguntaMultipla(false, ['1'])), null);

const catIncompleta = novaPergunta('categorizar');
catIncompleta.enunciado = 'Separe';
if (catIncompleta.conteudo.tipo === 'categorizar') {
	catIncompleta.conteudo.itens = [novoItem('Item 1')];
	catIncompleta.conteudo.categorias = [novoItem('Cat A'), novoItem('Cat B')];
}
conferir('categorizar com texto mas sem associacao', validarPergunta(catIncompleta), 'associe cada item a uma categoria.');

const catSemTexto = novaPergunta('categorizar');
catSemTexto.enunciado = 'Separe';
conferir('categorizar com item vazio', validarPergunta(catSemTexto), 'preencha o texto de todos os itens.');

console.log(`\n### RESULTADO: ${falhas === 0 ? 'TODOS OS CASOS PASSARAM' : falhas + ' FALHA(S)'} ###`);
process.exit(falhas === 0 ? 0 : 1);
