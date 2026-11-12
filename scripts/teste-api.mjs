/**
 * Teste ponta a ponta da API + Neon, com idToken real do Firebase Auth.
 *   node --env-file=.env scripts/teste-api.mjs      (exige `npm run dev` rodando)
 *
 * Parte 1: CRUD do questionário. Parte 2: sessão ao vivo (conduzida e livre), pontuação no
 * servidor e placar final. Tudo que é criado é apagado no fim.
 */
import postgres from 'postgres';

const apiKey = process.env.PUBLIC_FIREBASE_API_KEY;
const base = process.env.TESTE_BASE ?? 'http://127.0.0.1:5174';
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 12 });

let falhas = 0;
function conferir(rotulo, obtido, esperado) {
	const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
	if (!ok) falhas++;
	console.log(
		`${ok ? 'OK  ' : 'FALHA'} ${rotulo} -> ${JSON.stringify(obtido)}${ok ? '' : ` (esperado ${JSON.stringify(esperado)})`}`
	);
}

async function criarUsuario(rotulo) {
	const email = `teste-api-${rotulo}-${Date.now()}@example.com`;
	const resposta = await fetch(
		`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email, password: 'TesteApi#2026x', returnSecureToken: true })
		}
	);
	const dados = await resposta.json();
	if (!dados.idToken) throw new Error(`signUp ${rotulo} falhou: ${JSON.stringify(dados)}`);
	return { email, idToken: dados.idToken, uid: dados.localId };
}

async function apagarUsuario(idToken) {
	const resposta = await fetch(
		`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ idToken })
		}
	);
	return resposta.ok;
}

const sessoesPorToken = new Map();

/** Abre (uma vez) a sessão do app para um usuário — o id vai no cabeçalho X-Sessao. */
async function sessaoDe(idToken) {
	if (!idToken) return '';
	if (sessoesPorToken.has(idToken)) return sessoesPorToken.get(idToken);

	const resposta = await fetch(`${base}/api/sessao`, {
		method: 'POST',
		headers: { Authorization: `Bearer ${idToken}` }
	});
	const corpo = await resposta.json().catch(() => ({}));
	const id = corpo?.sessao?.id ?? '';
	sessoesPorToken.set(idToken, id);

	return id;
}

async function chamar(caminho, idToken, opcoes = {}) {
	const cabecalhos = {};
	if (idToken) {
		cabecalhos.Authorization = `Bearer ${idToken}`;

		const sessao = opcoes.sessao ?? (opcoes.semSessao ? '' : await sessaoDe(idToken));
		if (sessao) cabecalhos['X-Sessao'] = sessao;
	}
	if (opcoes.corpo) cabecalhos['Content-Type'] = 'application/json';

	const resposta = await fetch(`${base}${caminho}`, {
		method: opcoes.metodo ?? 'GET',
		headers: cabecalhos,
		body: opcoes.corpo ? JSON.stringify(opcoes.corpo) : undefined
	});

	return { status: resposta.status, corpo: await resposta.json().catch(() => ({})) };
}

const id = () => crypto.randomUUID();
const item = (texto) => ({ id: id(), texto });

// ---------- questionário de teste: um exemplo de cada tipo ----------
const opcoes = [item('Brasília'), item('Rio de Janeiro'), item('São Paulo')];
const itensCategoria = [item('Cachorro'), item('Águia')];
const categorias = [item('Mamífero'), item('Ave')];
const itensOrdem = [item('Primeiro passo'), item('Segundo passo'), item('Terceiro passo')];
const parA = { id: id(), esquerda: 'Brasil', direita: 'Brasília', idDireita: id() };
const parB = { id: id(), esquerda: 'Chile', direita: 'Santiago', idDireita: id() };

const ERRO_MC = { itemId: opcoes[1].id, alvoId: 'marcada' };
const CERTO_MC = { itemId: opcoes[0].id, alvoId: 'marcada' };

const perguntasDoQuiz = [
	{
		enunciado: 'Qual é a capital do Brasil?',
		imagemUrl: null,
		tipo: 'multipla-escolha',
		conteudo: { tipo: 'multipla-escolha', opcoes, permiteMultiplas: false },
		gabarito: { tipo: 'multipla-escolha', atribuicoes: [CERTO_MC] }
	},
	{
		enunciado: 'A Terra é plana.',
		imagemUrl: null,
		tipo: 'verdadeiro-falso',
		conteudo: { tipo: 'verdadeiro-falso' },
		gabarito: { tipo: 'verdadeiro-falso', atribuicoes: [{ itemId: 'falso', alvoId: 'escolhida' }] }
	},
	{
		enunciado: 'Separe os animais.',
		imagemUrl: null,
		tipo: 'categorizar',
		conteudo: { tipo: 'categorizar', itens: itensCategoria, categorias },
		gabarito: {
			tipo: 'categorizar',
			atribuicoes: [
				{ itemId: itensCategoria[0].id, alvoId: categorias[0].id },
				{ itemId: itensCategoria[1].id, alvoId: categorias[1].id }
			]
		}
	},
	{
		enunciado: 'Ordene as etapas.',
		imagemUrl: null,
		tipo: 'reordenar',
		conteudo: { tipo: 'reordenar', itens: itensOrdem },
		gabarito: {
			tipo: 'reordenar',
			atribuicoes: itensOrdem.map((i, indice) => ({ itemId: i.id, alvoId: String(indice + 1) }))
		}
	},
	{
		enunciado: 'Ligue os países às capitais.',
		imagemUrl: null,
		tipo: 'correspondencia',
		conteudo: { tipo: 'correspondencia', pares: [parA, parB] },
		gabarito: {
			tipo: 'correspondencia',
			atribuicoes: [
				{ itemId: parA.id, alvoId: parA.idDireita },
				{ itemId: parB.id, alvoId: parB.idDireita }
			]
		}
	}
];

console.log('=== LIMPEZA DE RESIDUO DE TESTES ANTERIORES ===');
const residuo = await sql`
	delete from quizzes where dono_email like 'teste-api-%' returning id
`;
console.log('questionarios de teste removidos:', residuo.length);

console.log('\n=== USUARIOS DE TESTE ===');
const dono = await criarUsuario('dono');
const jogadorA = await criarUsuario('a');
const jogadorB = await criarUsuario('b');
console.log('criados:', dono.email, '|', jogadorA.email, '|', jogadorB.email);

console.log('\n=== SESSAO DO APP (blocos 2 e 6) ===');
const sessaoDono = await sessaoDe(dono.idToken);
conferir('sessao do app criada (uuid)', /^[0-9a-f-]{36}$/i.test(sessaoDono), true);

const estadoDaSessao = await chamar('/api/sessao', dono.idToken);
conferir('GET /api/sessao -> 200', estadoDaSessao.status, 200);
conferir('id da sessao confere', estadoDaSessao.corpo.sessao.id, sessaoDono);
conferir('existe expiracao', typeof estadoDaSessao.corpo.sessao.expiraEm, 'string');

const renovacao = await chamar('/api/sessao/touch', dono.idToken, { metodo: 'POST' });
conferir('renovar sessao pela atividade (touch) -> 200', renovacao.status, 200);
conferir(
	'expiraEm foi empurrado para frente',
	new Date(renovacao.corpo.sessao.expiraEm) >= new Date(estadoDaSessao.corpo.sessao.expiraEm),
	true
);

const payloadMinimo = { titulo: 'x', perguntas: [] };
const semCabecalho = await chamar('/api/quizzes', dono.idToken, {
	metodo: 'POST',
	corpo: payloadMinimo,
	semSessao: true
});
conferir('mutacao sem X-Sessao -> 401', semCabecalho.status, 401);
conferir('codigo sessao-invalida', semCabecalho.corpo.codigo, 'sessao-invalida');

const sessaoFalsa = await chamar('/api/quizzes', dono.idToken, {
	metodo: 'POST',
	corpo: payloadMinimo,
	sessao: crypto.randomUUID()
});
conferir('mutacao com sessao inexistente -> 401', sessaoFalsa.status, 401);

console.log('\n=== PARTE 1: QUESTIONARIO (CRIAR, LISTAR, EDITAR) ===');
const criado = await chamar('/api/quizzes', dono.idToken, {
	metodo: 'POST',
	corpo: { titulo: 'Prova de teste (sessao)', perguntas: perguntasDoQuiz }
});
conferir('criado -> 201', criado.status, 201);
const quizId = criado.corpo.id;

const lista = await chamar('/api/quizzes', dono.idToken);
conferir('lista do dono tem 1', lista.corpo.quizzes.length, 1);
conferir(
	'sem codigo na lista (o codigo nasce na sessao)',
	'codigo' in lista.corpo.quizzes[0],
	false
);

const listaDeOutro = await chamar('/api/quizzes', jogadorA.idToken);
conferir('outro usuario nao ve o questionario', listaDeOutro.corpo.quizzes.length, 0);

const paraEditar = await chamar(`/api/quizzes/${quizId}`, dono.idToken);
conferir('carregar para edicao -> 200', paraEditar.status, 200);
conferir('perguntas com gabarito para o editor', paraEditar.corpo.perguntas.length, 5);
conferir(
	'gabarito veio no formato comum',
	paraEditar.corpo.perguntas[0].gabarito.atribuicoes.length,
	1
);
const idsOriginais = paraEditar.corpo.perguntas.map((p) => p.id);

const semPermissao = await chamar(`/api/quizzes/${quizId}`, jogadorA.idToken);
conferir('quem nao e dono nao carrega para editar -> 404', semPermissao.status, 404);

// edita: título novo + inverte as duas primeiras perguntas (testa a reordenação com índice único)
const paraAtualizar = paraEditar.corpo.perguntas.map((p) => ({
	id: p.id,
	enunciado: p.enunciado,
	imagemUrl: p.imagemUrl,
	tipo: p.tipo,
	conteudo: p.conteudo,
	gabarito: { tipo: p.gabarito.tipo, atribuicoes: p.gabarito.atribuicoes }
}));
const [primeira, segunda] = paraAtualizar;
const atualizado = await chamar(`/api/quizzes/${quizId}`, dono.idToken, {
	metodo: 'PUT',
	corpo: {
		titulo: 'Prova de teste (editada)',
		perguntas: [segunda, primeira, ...paraAtualizar.slice(2)]
	}
});
conferir('editar -> 200', atualizado.status, 200);

const depoisDaEdicao = await chamar(`/api/quizzes/${quizId}`, dono.idToken);
conferir('titulo atualizado', depoisDaEdicao.corpo.quiz.titulo, 'Prova de teste (editada)');
conferir('ordem invertida', depoisDaEdicao.corpo.perguntas[0].id, idsOriginais[1]);
conferir(
	'ids das perguntas preservados (respostas antigas nao morrem)',
	[...depoisDaEdicao.corpo.perguntas].map((p) => p.id).sort(),
	[...idsOriginais].sort()
);

// volta à ordem original para o resto do teste
await chamar(`/api/quizzes/${quizId}`, dono.idToken, {
	metodo: 'PUT',
	corpo: { titulo: 'Prova de teste (editada)', perguntas: paraAtualizar }
});
const ordenado = await chamar(`/api/quizzes/${quizId}`, dono.idToken);
const pergunta1 = ordenado.corpo.perguntas[0];
const pergunta2 = ordenado.corpo.perguntas[1];
conferir('voltou a ordem original', pergunta1.ordem, 1);

console.log('\n=== PARTE 2: SESSAO CONDUZIDA ===');
const sessaoCriada = await chamar('/api/sessoes', dono.idToken, {
	metodo: 'POST',
	corpo: { quizId, modo: 'conduzida' }
});
conferir('iniciar sessao -> 201', sessaoCriada.status, 201);
const codigo = sessaoCriada.corpo.sessao.codigo;
conferir('codigo com 6 caracteres', String(codigo ?? '').length, 6);

const semLogin = await chamar(`/api/sessoes/${codigo}`, null);
conferir('sala sem login -> 401', semLogin.status, 401);

const estadoDono = await chamar(`/api/sessoes/${codigo}`, dono.idToken);
conferir('dono abrindo a sala -> 200', estadoDono.status, 200);
conferir('dono reconhecido', estadoDono.corpo.souDono, true);
conferir('modo conduzida entrega so a pergunta no ar', estadoDono.corpo.perguntas.length, 1);
conferir('e ela e a primeira', estadoDono.corpo.perguntas[0].id, pergunta1.id);

const donoEntrando = await chamar(`/api/sessoes/${codigo}/entrar`, dono.idToken, {
	metodo: 'POST',
	corpo: {}
});
conferir('dono nao entra como jogador -> 409', donoEntrando.status, 409);

const entraA = await chamar(`/api/sessoes/${codigo}/entrar`, jogadorA.idToken, {
	metodo: 'POST',
	corpo: {}
});
conferir('jogador A entra -> 201', entraA.status, 201);

const entraB = await chamar(`/api/sessoes/${codigo}/entrar`, jogadorB.idToken, {
	metodo: 'POST',
	corpo: {}
});
conferir('jogador B entra -> 201', entraB.status, 201);

const entraDeNovo = await chamar(`/api/sessoes/${codigo}/entrar`, jogadorA.idToken, {
	metodo: 'POST',
	corpo: {}
});
conferir('entrar de novo e idempotente -> 201', entraDeNovo.status, 201);

const salaDoJogador = await chamar(`/api/sessoes/${codigo}`, jogadorA.idToken);
conferir('jogador ve so a pergunta no ar', salaDoJogador.corpo.perguntas.length, 1);
conferir(
	'gabarito do apresentador NAO aparece para o jogador',
	JSON.stringify(salaDoJogador.corpo).includes('gabaritoAtual'),
	false
);
conferir('placar escondido enquanto a sessao esta aberta', salaDoJogador.corpo.ranking, null);

const respostaSemEntrar = await chamar(`/api/sessoes/${codigo}/respostas`, dono.idToken, {
	metodo: 'POST',
	corpo: { perguntaId: pergunta1.id, atribuicoes: [CERTO_MC] }
});
conferir('quem nao esta na sala nao responde -> 403', respostaSemEntrar.status, 403);

const respostaA1 = await chamar(`/api/sessoes/${codigo}/respostas`, jogadorA.idToken, {
	metodo: 'POST',
	corpo: { perguntaId: pergunta1.id, atribuicoes: [CERTO_MC] }
});
conferir('A responde a pergunta 1 -> 201', respostaA1.status, 201);
conferir('A acertou (correcao no servidor)', respostaA1.corpo.resposta.acertos, 1);

const respostaB1 = await chamar(`/api/sessoes/${codigo}/respostas`, jogadorB.idToken, {
	metodo: 'POST',
	corpo: { perguntaId: pergunta1.id, atribuicoes: [ERRO_MC] }
});
conferir('B responde a pergunta 1 -> 201', respostaB1.status, 201);
conferir('B errou', respostaB1.corpo.resposta.acertos, 0);

const reenvio = await chamar(`/api/sessoes/${codigo}/respostas`, jogadorA.idToken, {
	metodo: 'POST',
	corpo: { perguntaId: pergunta1.id, atribuicoes: [ERRO_MC] }
});
conferir('reenvio nao sobrescreve -> 200', reenvio.status, 200);
conferir('reenvio devolve o que ja estava gravado', reenvio.corpo.resposta.acertos, 1);
conferir('reenvio marcado como ja respondida', reenvio.corpo.resposta.jaRespondida, true);

const foraDoAr = await chamar(`/api/sessoes/${codigo}/respostas`, jogadorA.idToken, {
	metodo: 'POST',
	corpo: { perguntaId: pergunta2.id, atribuicoes: [{ itemId: 'falso', alvoId: 'escolhida' }] }
});
conferir('responder pergunta fora do ar -> 409', foraDoAr.status, 409);

const itemFantasma = await chamar(`/api/sessoes/${codigo}/respostas`, jogadorA.idToken, {
	metodo: 'POST',
	corpo: { perguntaId: pergunta1.id, atribuicoes: [{ itemId: id(), alvoId: 'marcada' }] }
});
conferir('resposta apontando item inexistente -> 400', itemFantasma.status, 400);

console.log('\n=== PAINEL DO APRESENTADOR ===');
const painel = await chamar(`/api/sessoes/${codigo}/controle`, dono.idToken);
conferir('painel do dono -> 200', painel.status, 200);
conferir('2 participantes', painel.corpo.participantes.length, 2);
conferir('2 responderam a pergunta no ar', painel.corpo.responderamAtual, 2);
conferir(
	'gabarito disponivel para o apresentador',
	painel.corpo.gabaritoAtual.atribuicoes.length,
	1
);
conferir('placar: A na frente', painel.corpo.ranking[0].acertos, 1);
conferir('placar: B atras', painel.corpo.ranking[1].acertos, 0);

const painelDoJogador = await chamar(`/api/sessoes/${codigo}/controle`, jogadorA.idToken);
conferir('jogador nao acessa o painel -> 403', painelDoJogador.status, 403);

const acaoInvalida = await chamar(`/api/sessoes/${codigo}/controle`, dono.idToken, {
	metodo: 'POST',
	corpo: { acao: 'explodir' }
});
conferir('acao invalida -> 400', acaoInvalida.status, 400);

const avancou = await chamar(`/api/sessoes/${codigo}/controle`, dono.idToken, {
	metodo: 'POST',
	corpo: { acao: 'avancar' }
});
conferir('avancar -> 200', avancou.status, 200);
conferir('pergunta no ar agora e a 2', avancou.corpo.sessao.perguntaAtual, 2);

const salaDepoisDeAvancar = await chamar(`/api/sessoes/${codigo}`, jogadorA.idToken);
conferir('jogador recebe a pergunta 2', salaDepoisDeAvancar.corpo.perguntas[0].id, pergunta2.id);

const respostaA2 = await chamar(`/api/sessoes/${codigo}/respostas`, jogadorA.idToken, {
	metodo: 'POST',
	corpo: { perguntaId: pergunta2.id, atribuicoes: [{ itemId: 'falso', alvoId: 'escolhida' }] }
});
conferir('A acerta a pergunta 2', respostaA2.corpo.resposta.acertos, 1);

const voltou = await chamar(`/api/sessoes/${codigo}/controle`, dono.idToken, {
	metodo: 'POST',
	corpo: { acao: 'voltar' }
});
conferir('voltar -> 200', voltou.status, 200);
conferir('voltou para a pergunta 1', voltou.corpo.sessao.perguntaAtual, 1);

for (let passo = 0; passo < 6; passo++) {
	await chamar(`/api/sessoes/${codigo}/controle`, dono.idToken, {
		metodo: 'POST',
		corpo: { acao: 'avancar' }
	});
}
const noFim = await chamar(`/api/sessoes/${codigo}/controle`, dono.idToken);
conferir('nao passa da ultima pergunta', noFim.corpo.sessao.perguntaAtual, 5);

const editComSessaoAberta = await chamar(`/api/quizzes/${quizId}`, dono.idToken, {
	metodo: 'PUT',
	corpo: { titulo: 'Nao pode', perguntas: paraAtualizar }
});
conferir('editar com sessao aberta -> 409', editComSessaoAberta.status, 409);

const encerrou = await chamar(`/api/sessoes/${codigo}/controle`, dono.idToken, {
	metodo: 'POST',
	corpo: { acao: 'encerrar' }
});
conferir('encerrar -> 200', encerrou.status, 200);
conferir('status encerrada', encerrou.corpo.sessao.status, 'encerrada');

const respostaDepoisDeEncerrar = await chamar(
	`/api/sessoes/${codigo}/respostas`,
	jogadorB.idToken,
	{
		metodo: 'POST',
		corpo: { perguntaId: pergunta1.id, atribuicoes: [CERTO_MC] }
	}
);
conferir('responder depois de encerrar -> 409', respostaDepoisDeEncerrar.status, 409);

const finalDoJogador = await chamar(`/api/sessoes/${codigo}`, jogadorB.idToken);
conferir(
	'jogador ve o resumo final depois de encerrar',
	finalDoJogador.corpo.ranking !== null,
	true
);
conferir('resumo final ordenado: A primeiro', finalDoJogador.corpo.ranking[0].acertos, 2);
conferir('resumo final: B com 0', finalDoJogador.corpo.ranking[1].acertos, 0);
conferir('B sabe quem ele e no placar', finalDoJogador.corpo.participanteId !== null, true);

console.log('\n=== SESSAO LIVRE (CADA UM NO SEU RITMO) ===');
const sessaoLivre = await chamar('/api/sessoes', dono.idToken, {
	metodo: 'POST',
	corpo: { quizId, modo: 'livre' }
});
conferir('iniciar sessao livre -> 201', sessaoLivre.status, 201);
const codigoLivre = sessaoLivre.corpo.sessao.codigo;
conferir('modo gravado', sessaoLivre.corpo.sessao.modo, 'livre');

await chamar(`/api/sessoes/${codigoLivre}/entrar`, jogadorA.idToken, { metodo: 'POST', corpo: {} });
const salaLivre = await chamar(`/api/sessoes/${codigoLivre}`, jogadorA.idToken);
conferir('modo livre entrega todas as perguntas', salaLivre.corpo.perguntas.length, 5);

const pergunta5 = ordenado.corpo.perguntas[4];
const livreTarde = await chamar(`/api/sessoes/${codigoLivre}/respostas`, jogadorA.idToken, {
	metodo: 'POST',
	corpo: {
		perguntaId: pergunta5.id,
		atribuicoes: [
			{ itemId: parA.id, alvoId: parA.idDireita },
			{ itemId: parB.id, alvoId: parB.idDireita }
		]
	}
});
conferir('pode comecar pela ultima pergunta', livreTarde.status, 201);
conferir('acertou os dois pares', livreTarde.corpo.resposta.acertos, 2);

const livrePrimeira = await chamar(`/api/sessoes/${codigoLivre}/respostas`, jogadorA.idToken, {
	metodo: 'POST',
	corpo: { perguntaId: pergunta1.id, atribuicoes: [CERTO_MC] }
});
conferir('pode responder a primeira depois', livrePrimeira.status, 201);

const modoInvalido = await chamar('/api/sessoes', dono.idToken, {
	metodo: 'POST',
	corpo: { quizId, modo: 'corrida' }
});
conferir('modo invalido -> 400', modoInvalido.status, 400);

await chamar(`/api/sessoes/${codigoLivre}/controle`, dono.idToken, {
	metodo: 'POST',
	corpo: { acao: 'encerrar' }
});

console.log('\n=== TEMPO REAL (SSE) ===');
{
	const controle = new AbortController();
	const relogio = setTimeout(() => controle.abort(), 8000);
	let texto = '';
	let tipoConteudo = '';

	try {
		const resposta = await fetch(`${base}/api/sessoes/${codigo}/eventos`, {
			headers: {
				Authorization: `Bearer ${jogadorA.idToken}`,
				'X-Sessao': await sessaoDe(jogadorA.idToken)
			},
			signal: controle.signal
		});

		conferir('SSE com sessao vigente -> 200', resposta.status, 200);
		tipoConteudo = String(resposta.headers.get('content-type'));
		const leitor = resposta.body.getReader();
		const primeiro = await leitor.read();
		texto = new TextDecoder().decode(primeiro.value);
		await leitor.cancel();
	} catch {
		// abort esperado depois do primeiro evento
	}
	clearTimeout(relogio);

	conferir('content-type text/event-stream', tipoConteudo.includes('text/event-stream'), true);
	conferir('stream emitiu evento estado', texto.includes('event: estado'), true);
	conferir('stream trouxe o estado da sala', texto.includes('"perguntas"'), true);
	conferir('stream nao traz o gabarito do apresentador', texto.includes('gabaritoAtual'), false);
	conferir('stream reconhece que nao e o dono', texto.includes('"souDono":false'), true);
}

console.log('\n=== BLOCO 6: AUTENTICACAO E AUTORIZACAO (MATRIZ) ===');

// A6-01: cada conta le o que e dela.
const leituraPropria = await chamar(`/api/quizzes/${quizId}`, dono.idToken);
conferir('A6-01 dono le o proprio questionario -> 200', leituraPropria.status, 200);
conferir(
	'A6-01 gabarito disponivel para o dono',
	leituraPropria.corpo.perguntas[0].gabarito !== null,
	true
);

// A6-02: leitura de dado de outra conta.
const leituraAlheia = await chamar(`/api/quizzes/${quizId}`, jogadorA.idToken);
conferir('A6-02 outra conta le o questionario -> 404', leituraAlheia.status, 404);
conferir(
	'A6-02 negativa nao vaza gabarito',
	JSON.stringify(leituraAlheia.corpo).includes('atribuicoes'),
	false
);

// A6-03: troca de dono/papel pelo corpo. Autoria e posse nunca vem do cliente.
const trocaDeDono = await chamar(`/api/quizzes/${quizId}`, dono.idToken, {
	metodo: 'PUT',
	corpo: {
		titulo: 'Prova de teste (dono tentando trocar)',
		donoUid: jogadorA.uid,
		dono_uid: jogadorA.uid,
		role: 'professor',
		perguntas: paraAtualizar
	}
});
conferir('A6-03 PUT com dono no corpo -> 200 (campo ignorado)', trocaDeDono.status, 200);
const [donoNoBanco] = await sql`select dono_uid from quizzes where id = ${quizId}`;
conferir('A6-03 dono_uid intacto no banco', donoNoBanco.dono_uid, dono.uid);
const depoisDaTroca = await chamar(`/api/quizzes/${quizId}`, jogadorA.idToken);
conferir('A6-03 conta A continua sem acesso -> 404', depoisDaTroca.status, 404);
const excluirAlheio = await chamar(`/api/quizzes/${quizId}`, jogadorA.idToken, {
	metodo: 'DELETE'
});
conferir('A6-03 conta A nao exclui quiz alheio -> 404', excluirAlheio.status, 404);
const [quizAindaExiste] = await sql`select count(*)::int as n from quizzes where id = ${quizId}`;
conferir('A6-03 questionario continua no banco', quizAindaExiste.n, 1);

// A6-04 e A6-05: chat da sala. A entra, B fica fora.
const salaDoChat = await chamar('/api/sessoes', dono.idToken, {
	metodo: 'POST',
	corpo: { quizId, modo: 'livre' }
});
const codigoChat = salaDoChat.corpo.sessao.codigo;
await chamar(`/api/sessoes/${codigoChat}/entrar`, jogadorA.idToken, { metodo: 'POST', corpo: {} });

const mensagemForjada = await chamar(`/api/sessoes/${codigoChat}/mensagens`, jogadorA.idToken, {
	metodo: 'POST',
	corpo: { texto: 'Mensagem de A', autorUid: jogadorB.uid, autor_uid: jogadorB.uid }
});
conferir('A6-04 A envia no proprio nome -> 201', mensagemForjada.status, 201);
conferir(
	'A6-04 autoria vem do token, nao do corpo',
	mensagemForjada.corpo.mensagem.autorUid,
	jogadorA.uid
);

const historicoAlheio = await chamar(`/api/sessoes/${codigoChat}/mensagens`, jogadorB.idToken);
conferir('A6-05 B le o chat da sala de A -> 403', historicoAlheio.status, 403);
const escritaAlheia = await chamar(`/api/sessoes/${codigoChat}/mensagens`, jogadorB.idToken, {
	metodo: 'POST',
	corpo: { texto: 'invasao' }
});
conferir('A6-05 B escreve na sala de A -> 403', escritaAlheia.status, 403);
const painelAlheio = await chamar(`/api/sessoes/${codigoChat}/controle`, jogadorB.idToken);
conferir('A6-05 B abre o painel do apresentador -> 403', painelAlheio.status, 403);

await chamar(`/api/sessoes/${codigoChat}/controle`, dono.idToken, {
	metodo: 'POST',
	corpo: { acao: 'encerrar' }
});
await sql`delete from sessoes where codigo = ${codigoChat}`;

// A6-07: registrar o proprio token de push (o uid vem do token, nao do corpo).
const tokenAparelho = `ExponentPushToken[teste-${Date.now()}]`;
const registrouToken = await chamar('/api/push/token', jogadorA.idToken, {
	metodo: 'POST',
	corpo: { token: tokenAparelho, plataforma: 'android', uid: jogadorB.uid }
});
conferir('A6-07 A registra o proprio token -> 200', registrouToken.status, 200);
const [donoDoToken] = await sql`select uid from tokens_push where token = ${tokenAparelho}`;
conferir('A6-07 token gravado na conta de A', donoDoToken?.uid, jogadorA.uid);
await sql`delete from tokens_push where token = ${tokenAparelho}`;

console.log('\n=== SESSAO REVOGADA (cenario de defesa do bloco 6) ===');
await fetch(`${base}/api/sessao`, {
	method: 'DELETE',
	headers: { Authorization: `Bearer ${dono.idToken}`, 'X-Sessao': sessaoDono }
});
sessoesPorToken.delete(dono.idToken);

const aposRevogar = await chamar('/api/quizzes', dono.idToken, {
	metodo: 'POST',
	corpo: payloadMinimo,
	sessao: sessaoDono
});
conferir('operar com sessao revogada -> 401', aposRevogar.status, 401);

// A6-06 na LEITURA: antes da guarda global so a escrita era barrada.
const leituraRevogada = await chamar('/api/quizzes', dono.idToken, { sessao: sessaoDono });
conferir('A6-06 lista privada com sessao revogada -> 401', leituraRevogada.status, 401);
conferir('A6-06 codigo sessao-invalida', leituraRevogada.corpo.codigo, 'sessao-invalida');

const gabaritoRevogado = await chamar(`/api/quizzes/${quizId}`, dono.idToken, {
	sessao: sessaoDono
});
conferir('A6-06 gabarito com sessao revogada -> 401', gabaritoRevogado.status, 401);

const salaRevogada = await chamar(`/api/sessoes/${codigo}`, dono.idToken, { sessao: sessaoDono });
conferir('A6-06 sala com sessao revogada -> 401', salaRevogada.status, 401);

{
	const resposta = await fetch(`${base}/api/sessoes/${codigo}/eventos`, {
		headers: { Authorization: `Bearer ${dono.idToken}`, 'X-Sessao': sessaoDono }
	});
	conferir('A6-06 stream com sessao revogada -> 401', resposta.status, 401);
}

const semToken = await chamar('/api/quizzes', null);
conferir('A6-06 sem token nenhum -> 401', semToken.status, 401);
conferir('A6-06 codigo nao-autenticado', semToken.corpo.codigo, 'nao-autenticado');

const novaSessao = await chamar('/api/sessao', dono.idToken);
conferir('sessao nova volta a funcionar -> 200', novaSessao.status, 200);
conferir('a sessao nova tem outro id', novaSessao.corpo.sessao.id !== sessaoDono, true);

console.log('\n=== BANCO (SQL) ===');
const contagensDoQuiz = async () => {
	const [linha] = await sql`
		select
			(select count(*)::int from perguntas where quiz_id = ${quizId}) as perguntas,
			(select count(*)::int from gabaritos where quiz_id = ${quizId}) as gabaritos,
			(select count(*)::int from sessoes where quiz_id = ${quizId}) as sessoes,
			(select count(*)::int from participantes p
				join sessoes s on s.id = p.sessao_id where s.quiz_id = ${quizId}) as participantes,
			(select count(*)::int from respostas r
				join sessoes s on s.id = r.sessao_id where s.quiz_id = ${quizId}) as respostas
	`;
	return linha;
};

const contagens = await contagensDoQuiz();
conferir('5 perguntas deste quiz', contagens.perguntas, 5);
conferir('5 gabaritos deste quiz', contagens.gabaritos, 5);
conferir('2 sessoes deste quiz', contagens.sessoes, 2);
conferir('3 participantes (2 na conduzida + 1 na livre)', contagens.participantes, 3);
conferir('5 respostas (3 na conduzida + 2 na livre)', contagens.respostas, 5);

const [sessaoBanco] = await sql`
	select status, modo, pergunta_atual from sessoes
	where quiz_id = ${quizId} and modo = 'conduzida'
	order by aberta_em asc limit 1
`;
conferir('sessao conduzida encerrada no banco', sessaoBanco.status, 'encerrada');
conferir('sessao conduzida parada na ultima pergunta', sessaoBanco.pergunta_atual, 5);

console.log('\n=== LIMPEZA ===');
await sql`delete from quizzes where id = ${quizId}`;
const depois = await contagensDoQuiz();
conferir('cascade limpou tudo deste quiz', Object.values(depois), [0, 0, 0, 0, 0]);
conferir(
	'nao sobrou quiz de teste',
	(await sql`select count(*)::int as n from quizzes where dono_email like 'teste-api-%'`)[0].n,
	0
);
conferir('usuario dono removido', await apagarUsuario(dono.idToken), true);
conferir('usuario A removido', await apagarUsuario(jogadorA.idToken), true);
conferir('usuario B removido', await apagarUsuario(jogadorB.idToken), true);

await sql.end();
console.log(
	`\n### RESULTADO: ${falhas === 0 ? 'TODOS OS CASOS PASSARAM' : falhas + ' FALHA(S)'} ###`
);
process.exit(falhas === 0 ? 0 : 1);
