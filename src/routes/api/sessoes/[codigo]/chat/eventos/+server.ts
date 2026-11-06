import { isDbConfigured } from '$lib/server/db';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { buscarSessaoPorCodigo } from '$lib/server/sessoes';
import { acessoAoChat } from '$lib/server/mensagens';
import { assinar } from '$lib/server/barramento';
import type { RequestHandler } from './$types';

const BATIMENTO_MS = 20000;

/**
 * Stream do chat. O estado é empurrado na hora em que a mensagem é gravada, via barramento
 * em memória — nada de polling. O cliente recebe `chat` (ligado/desligado) e `mensagem`.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) {
		return new Response(JSON.stringify({ erro: 'DATABASE_URL não configurada.' }), { status: 500 });
	}

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) {
		return new Response(JSON.stringify({ erro: 'Entre na sua conta.' }), { status: 401 });
	}

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) {
		return new Response(JSON.stringify({ erro: 'Sala não encontrada.' }), { status: 404 });
	}

	const acesso = await acessoAoChat(achado.sessao, usuario);
	if (!acesso.podeLer) {
		return new Response(JSON.stringify({ erro: acesso.motivo }), { status: 403 });
	}

	const codificador = new TextEncoder();
	const sessaoId = achado.sessao.id;
	let fechado = false;
	let desassinar: (() => void) | undefined;

	const stream = new ReadableStream<Uint8Array>({
		start(controller) {
			const enviar = (evento: string, dados: unknown) => {
				if (fechado) return;
				try {
					controller.enqueue(codificador.encode(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`));
				} catch {
					fechado = true;
				}
			};

			// primeiro evento: o cliente sabe que a assinatura está de pé e então busca o histórico
			enviar('chat', { ativo: achado.sessao.chatAtivo, encerrada: achado.sessao.status === 'encerrada' });

			desassinar = assinar(sessaoId, enviar);

			const relogio = setInterval(() => {
				enviar('batimento', { em: new Date().toISOString() });
			}, BATIMENTO_MS);

			const parar = () => {
				if (fechado) return;
				fechado = true;
				clearInterval(relogio);
				desassinar?.();
				try {
					controller.close();
				} catch {
					// já fechado
				}
			};

			request.signal.addEventListener('abort', parar);
		},
		cancel() {
			fechado = true;
			desassinar?.();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
