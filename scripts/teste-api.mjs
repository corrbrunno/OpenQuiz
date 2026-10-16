/**
 * Teste ponta a ponta da API contra o Neon, com idToken real do Firebase Auth.
 * Rode com: node --env-file=.env teste_api.mjs
 */
import postgres from 'postgres';

const apiKey = process.env.PUBLIC_FIREBASE_API_KEY;
const base = process.env.TESTE_BASE ?? 'http://127.0.0.1:5174';
const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 12 });

let falhas = 0;
function conferir(rotulo, obtido, esperado) {
	const ok = JSON.stringify(obtido) === JSON.stringify(esperado);
	if (!ok) falhas++;
	console.log(`${ok ? 'OK  ' : 'FALHA'} ${rotulo} -> ${JSON.stringify(obtido)}${ok ? '' : ` (esperado ${JSON.stringify(esperado)})`}`);
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

async function chamar(caminho, idToken, opcoes = {}) {
	const cabecalhos = {};
	if (idToken) cabecalhos.Authorization = `Bearer ${idToken}`;
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

// ---------- payload com um exemplo de cada tipo ----------
const opcoes = [item('Brasília'), item('Rio de Janeiro'), item('São Paulo')];
const itensCategoria = [item('Cachorro'), item('Águia')];
const categorias = [item('Mamífero'), item('Ave')];
const itensOrdem = [item('Primeiro passo'), item('Segundo passo'), item('Terceiro passo')];
const parA = { id: id(), esquerda: 'Brasil', direita: 'Brasília', idDireita: id() };
const parB = { id: id(), esquerda: 'Chile', direita: 'Santiago', idDireita: id() };

const corpo = {
	titulo: 'Prova de teste (API + Neon)',
	perguntas: [
		{
			enunciado: 'Qual é a capital do Brasil?',
			imagemUrl: null,
			tipo: 'multipla-escolha',
			conteudo: { tipo: 'multipla-escolha', opcoes, permiteMultiplas: false },
			gabarito: { tipo: 'multipla-escolha', atribuicoes: [{ itemId: opcoes[0].id, alvoId: 'marcada' }] }
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
	]
};

console.log('=== AUTENTICACAO ===');
const dono = await criarUsuario('dono');
const intruso = await criarUsuario('intruso');
console.log('usuarios de teste criados:', dono.email, '|', intruso.email);

console.log('=== CRIAR QUESTIONARIO ===');
const semToken = await chamar('/api/quizzes', null, { metodo: 'POST', corpo });
conferir('sem token -> 401', semToken.status, 401);

const criado = await chamar('/api/quizzes', dono.idToken, { metodo: 'POST', corpo });
conferir('criado -> 201', criado.status, 201);
conferir('codigo com 6 caracteres', String(criado.corpo.codigo ?? '').length, 6);
const codigo = criado.corpo.codigo;

console.log('=== CARREGAR A SALA ===');
const sala = await chamar(`/api/quizzes/${codigo}`, dono.idToken);
conferir('dono carrega -> 200', sala.status, 200);
conferir('total de perguntas', sala.corpo.sala.totalPerguntas, 5);
conferir('souDono', sala.corpo.sala.souDono, true);
conferir(
	'tipos na ordem',
	sala.corpo.sala.perguntas.map((p) => p.tipo),
	['multipla-escolha', 'verdadeiro-falso', 'categorizar', 'reordenar', 'correspondencia']
);
conferir(
	'GABARITO NAO VAZA para quem carrega a sala',
	JSON.stringify(sala.corpo).includes('atribuicoes'),
	false
);

const participante = await chamar(`/api/quizzes/${codigo}`, intruso.idToken);
conferir('outro usuario carrega a sala -> 200', participante.status, 200);
conferir('outro usuario: souDono', participante.corpo.sala.souDono, false);

const codigoInexistente = await chamar('/api/quizzes/ZZZZZZ', dono.idToken);
conferir('codigo inexistente -> 404', codigoInexistente.status, 404);

console.log('=== GABARITO (SO O DONO) ===');
const gabaritoDono = await chamar(`/api/quizzes/${codigo}/gabaritos`, dono.idToken);
conferir('dono -> 200', gabaritoDono.status, 200);
conferir('quantidade de gabaritos', gabaritoDono.corpo.gabaritos.length, 5);

const gabaritoIntruso = await chamar(`/api/quizzes/${codigo}/gabaritos`, intruso.idToken);
conferir('intruso -> 403', gabaritoIntruso.status, 403);

const gabaritoSemToken = await chamar(`/api/quizzes/${codigo}/gabaritos`, null);
conferir('sem token -> 401', gabaritoSemToken.status, 401);

console.log('=== VALIDACAO DO PAYLOAD ===');
const gabaritoFantasma = await chamar('/api/quizzes', dono.idToken, {
	metodo: 'POST',
	corpo: {
		titulo: 'Invalido',
		perguntas: [
			{
				enunciado: 'Item que nao existe',
				tipo: 'multipla-escolha',
				conteudo: { tipo: 'multipla-escolha', opcoes, permiteMultiplas: false },
				gabarito: { tipo: 'multipla-escolha', atribuicoes: [{ itemId: id(), alvoId: 'marcada' }] }
			}
		]
	}
});
conferir('gabarito apontando item inexistente -> 400', gabaritoFantasma.status, 400);

const semEnunciado = await chamar('/api/quizzes', dono.idToken, {
	metodo: 'POST',
	corpo: {
		titulo: 'Invalido',
		perguntas: [
			{
				enunciado: '   ',
				tipo: 'verdadeiro-falso',
				conteudo: { tipo: 'verdadeiro-falso' },
				gabarito: { tipo: 'verdadeiro-falso', atribuicoes: [{ itemId: 'falso', alvoId: 'escolhida' }] }
			}
		]
	}
});
conferir('pergunta sem enunciado -> 400', semEnunciado.status, 400);

const semTitulo = await chamar('/api/quizzes', dono.idToken, {
	metodo: 'POST',
	corpo: { titulo: '', perguntas: corpo.perguntas }
});
conferir('sem titulo -> 400', semTitulo.status, 400);

console.log('=== BANCO (via SQL) ===');
const [linhas] = await sql`
	select
		(select count(*)::int from quizzes) as quizzes,
		(select count(*)::int from perguntas) as perguntas,
		(select count(*)::int from gabaritos) as gabaritos
`;
conferir('1 quiz gravado', linhas.quizzes, 1);
conferir('5 perguntas gravadas', linhas.perguntas, 5);
conferir('5 gabaritos gravados', linhas.gabaritos, 5);

const [primeira] = await sql`select tipo, conteudo from perguntas where ordem = 1`;
conferir('conteudo jsonb da 1a pergunta', primeira.conteudo.opcoes.length, 3);
conferir('tipo da 1a pergunta', primeira.tipo, 'multipla-escolha');

const [gabaritoSalvo] = await sql`
	select g.atribuicoes from gabaritos g
	join perguntas p on p.id = g.pergunta_id
	where p.ordem = 5
`;
conferir('gabarito de correspondencia no banco', gabaritoSalvo.atribuicoes.length, 2);
conferir(
	'gabarito aponta para a coluna B certa',
	gabaritoSalvo.atribuicoes[0].alvoId,
	parA.idDireita
);

console.log('=== LIMPEZA ===');
await sql`delete from quizzes where codigo = ${codigo}`;
const [depois] = await sql`
	select
		(select count(*)::int from quizzes) as quizzes,
		(select count(*)::int from perguntas) as perguntas,
		(select count(*)::int from gabaritos) as gabaritos
`;
conferir('cascade apagou as perguntas', depois.perguntas, 0);
conferir('cascade apagou os gabaritos', depois.gabaritos, 0);
conferir('tabela quizzes limpa', depois.quizzes, 0);

conferir('usuario dono removido', await apagarUsuario(dono.idToken), true);
conferir('usuario intruso removido', await apagarUsuario(intruso.idToken), true);

await sql.end();
console.log(`\n### RESULTADO API: ${falhas === 0 ? 'TODOS OS CASOS PASSARAM' : falhas + ' FALHA(S)'} ###`);
process.exit(falhas === 0 ? 0 : 1);
