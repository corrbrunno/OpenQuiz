import type { Handle } from '@sveltejs/kit';

/**
 * O aplicativo híbrido carrega o site publicado dentro de um WebView. Sem `Cache-Control`,
 * o WebView aplica cache heurístico no HTML e continua abrindo a versão antiga do app mesmo
 * depois de um deploy — foi assim que uma tela nova "não apareceu" em produção.
 *
 * Aqui o HTML nunca é guardado; os arquivos com hash em `_app/immutable` continuam cacheáveis
 * (o nome muda a cada build, então não há risco de servir código velho).
 */
export const handle: Handle = async ({ event, resolve }) => {
	const resposta = await resolve(event);

	const tipo = resposta.headers.get('content-type') ?? '';
	if (tipo.includes('text/html')) {
		resposta.headers.set('Cache-Control', 'no-store');
	}

	return resposta;
};
