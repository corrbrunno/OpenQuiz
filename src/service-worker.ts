/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

/**
 * Service worker do Online Quiz — é o que faz o app abrir sem internet.
 *
 * Estratégia por tipo de requisição:
 *  - `_app/immutable/*`: cache primeiro (o nome tem hash, então o conteúdo nunca muda);
 *  - navegação (HTML): rede primeiro, com prazo curto, caindo para a última cópia salva;
 *  - `/api/*`: **nunca** passa pelo cache — sem rede a chamada falha e é a camada de
 *    aplicação (fila offline) que decide o que fazer. Servir resposta velha de API
 *    esconderia erro e poderia duplicar dados.
 *
 * O `Cache-Control: no-store` que o servidor manda no HTML continua valendo para o cache
 * HTTP do WebView; o service worker escreve no CacheStorage de propósito, com versão no
 * nome, então build novo nunca é mascarado por build velho.
 */

const trabalhador = self as unknown as ServiceWorkerGlobalScope;

const CACHE_APP = `oq-app-${version}`;
const CACHE_PAGINAS = `oq-paginas-${version}`;

const PRECACHE = [...new Set([...build, ...files])];

const PRAZO_REDE_MS = 5000;

const ehAsset = (url: URL) => url.pathname.startsWith('/_app/immutable/');
const ehApi = (url: URL) => url.pathname.startsWith('/api/');

/** Chave estável por rota: `/sala/ABC?v=1` e `/sala/ABC` são a mesma página para o cache. */
const chaveDaPagina = (url: URL) => url.pathname;

async function comPrazo<T>(promessa: Promise<T>, ms: number): Promise<T> {
	let relogio: ReturnType<typeof setTimeout> | undefined;

	const prazo = new Promise<never>((_, rejeitar) => {
		relogio = setTimeout(() => rejeitar(new Error('tempo esgotado')), ms);
	});

	try {
		return await Promise.race([promessa, prazo]);
	} finally {
		clearTimeout(relogio);
	}
}

async function cachePrimeiro(requisicao: Request): Promise<Response> {
	const cache = await caches.open(CACHE_APP);
	const salva = await cache.match(requisicao);
	if (salva) return salva;

	try {
		const resposta = await fetch(requisicao);

		// Guarda também o que não veio no precache. Assim, se o deploy publicou um build
		// novo e este service worker ainda é o antigo (o script dele fica em cache no
		// edge por horas), o primeiro acesso online já deixa o aparelho consistente — e
		// a próxima abertura offline não fica com HTML novo apontando para arquivo velho.
		if (resposta.ok) await cache.put(requisicao, resposta.clone());

		return resposta;
	} catch {
		return new Response('', { status: 504, statusText: 'Sem conexão' });
	}
}

async function redePrimeiro(requisicao: Request): Promise<Response> {
	const cache = await caches.open(CACHE_PAGINAS);
	const chave = new Request(chaveDaPagina(new URL(requisicao.url)));

	try {
		const resposta = await comPrazo(fetch(requisicao), PRAZO_REDE_MS);
		if (resposta.ok) await cache.put(chave, resposta.clone());
		return resposta;
	} catch {
		const salva = await cache.match(chave);
		if (salva) return salva;

		// Rota nunca visitada: entrega o início salvo em vez da tela de erro do navegador.
		const inicio = await cache.match(new Request('/'));
		if (inicio) return inicio;

		return new Response(paginaSemConexao(), {
			status: 503,
			headers: { 'Content-Type': 'text/html; charset=utf-8' }
		});
	}
}

function paginaSemConexao(): string {
	return `<!doctype html>
<html lang="pt-BR">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>Online Quiz — sem conexão</title>
	</head>
	<body style="font-family: system-ui, sans-serif; padding: 2rem; line-height: 1.5">
		<h1>Sem conexão</h1>
		<p>Esta tela ainda não tinha sido aberta neste aparelho, então não há cópia para mostrar offline.</p>
		<p>Conecte-se à internet e recarregue.</p>
	</body>
</html>`;
}

trabalhador.addEventListener('install', (evento) => {
	evento.waitUntil(
		(async () => {
			const cache = await caches.open(CACHE_APP);

			// Um 404 isolado não pode derrubar a instalação do service worker.
			await Promise.all(
				PRECACHE.map(async (caminho) => {
					try {
						const resposta = await fetch(caminho, { cache: 'reload' });
						if (resposta.ok) await cache.put(caminho, resposta);
					} catch {
						// arquivo opcional indisponível: segue
					}
				})
			);

			// O HTML do início vai para o cache AQUI: no primeiro acesso o service worker
			// ainda não controlava a página, então nenhuma navegação passou por ele e o app
			// abriria offline direto na tela de "sem conexão".
			try {
				const inicio = await fetch('/', { cache: 'reload' });
				if (inicio.ok) {
					await (await caches.open(CACHE_PAGINAS)).put(new Request('/'), inicio);
				}
			} catch {
				// sem rede agora: a primeira navegação online que passar pelo SW guarda a página
			}

			await trabalhador.skipWaiting();
		})()
	);
});

trabalhador.addEventListener('activate', (evento) => {
	evento.waitUntil(
		(async () => {
			const nomes = await caches.keys();
			await Promise.all(
				nomes.filter((nome) => nome !== CACHE_APP && nome !== CACHE_PAGINAS).map((nome) => caches.delete(nome))
			);
			await trabalhador.clients.claim();
		})()
	);
});

trabalhador.addEventListener('fetch', (evento) => {
	const requisicao = evento.request;
	if (requisicao.method !== 'GET') return;

	const url = new URL(requisicao.url);
	if (url.origin !== trabalhador.location.origin) return;

	// A API é sempre rede: offline quem responde é a fila do app, não o cache.
	if (ehApi(url)) return;

	if (ehAsset(url)) {
		evento.respondWith(cachePrimeiro(requisicao));
		return;
	}

	if (requisicao.mode === 'navigate') {
		evento.respondWith(redePrimeiro(requisicao));
	}
});
