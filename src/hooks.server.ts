import { json, type Handle } from '@sveltejs/kit';
import { isDbConfigured } from '$lib/server/db';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { sessaoDaRequisicao } from '$lib/server/sessao-usuario';

/**
 * Rotas que existem justamente para abrir/encerrar a sessão do app: não podem exigir
 * uma sessão vigente (o `POST` é o login e o `DELETE` é o logout).
 */
const SEM_SESSAO = new Set(['/api/sessao', '/api/sessao/touch']);

/**
 * O hook tem duas responsabilidades.
 *
 * 1. **Guarda única de autenticação e sessão da API.** Antes a regra estava copiada em cada
 *    handler e bastava uma rota nova esquecer o `exigirSessao` para um JWT antigo continuar
 *    lendo dados privados (inclusive o gabarito). Aqui ela vale para toda a API: token válido
 *    + sessão do app vigente (não revogada, não expirada). A validação é memoizada por
 *    requisição (`auth.ts` e `sessao-usuario.ts`), então os handlers podem continuar chamando
 *    `usuarioDaRequisicao`/`exigirSessao` sem pagar duas vezes a mesma consulta.
 *
 * 2. **`Cache-Control: no-store` no HTML.** O aplicativo híbrido carrega o site publicado
 *    dentro de um WebView; sem o cabeçalho, o WebView aplica cache heurístico no HTML e
 *    continua abrindo a versão antiga do app depois do deploy. Os arquivos com hash em
 *    `_app/immutable` continuam cacheáveis (o nome muda a cada build).
 */
export const handle: Handle = async ({ event, resolve }) => {
	const { pathname } = event.url;

	if (pathname.startsWith('/api/') && !SEM_SESSAO.has(pathname)) {
		if (!isDbConfigured()) {
			return json({ erro: 'DATABASE_URL não configurada no servidor.' }, { status: 500 });
		}

		const usuario = await usuarioDaRequisicao(event.request);
		if (!usuario) {
			return json({ erro: 'Entre na sua conta.', codigo: 'nao-autenticado' }, { status: 401 });
		}

		const sessao = await sessaoDaRequisicao(event.request, usuario);
		if (!sessao) {
			return json(
				{
					erro: 'Sua sessão expirou por inatividade. Entre novamente.',
					codigo: 'sessao-invalida'
				},
				{ status: 401 }
			);
		}
	}

	const resposta = await resolve(event);

	const tipo = resposta.headers.get('content-type') ?? '';
	if (tipo.includes('text/html')) {
		resposta.headers.set('Cache-Control', 'no-store');
	}

	return resposta;
};
