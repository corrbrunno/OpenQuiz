import { isDbConfigured } from '$lib/server/db';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { buscarSessaoPorCodigo, payloadDaSala, payloadDoPainel } from '$lib/server/sessoes';
import type { RequestHandler } from './$types';

const INTERVALO_MS = 2000;
const BATIMENTO_MS = 20000;

/**
 * Assinatura de eventos da sala (Server-Sent Events).
 * O servidor empurra o estado a cada 2 s; o cliente reconecta sozinho quando o stream cai.
 * Para o dono o payload é o do painel; para os demais, o da sala.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) {
		return new Response(JSON.stringify({ erro: 'DATABASE_URL não configurada.' }), { status: 500 });
	}

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) {
		return new Response(JSON.stringify({ erro: 'Entre na sua conta.' }), { status: 401 });
	}

	const codigo = params.codigo ?? '';
	const inicial = await buscarSessaoPorCodigo(codigo);
	if (!inicial) {
		return new Response(JSON.stringify({ erro: 'Sala não encontrada.' }), { status: 404 });
	}

	const codificador = new TextEncoder();
	let fechado = false;

	const stream = new ReadableStream<Uint8Array>({
		async start(controller) {
			let ultimoBatimento = Date.now();
			let relogio: ReturnType<typeof setInterval> | undefined;

			const enviar = (evento: string, dados: unknown) => {
				if (fechado) return;
				try {
					controller.enqueue(
						codificador.encode(`event: ${evento}\ndata: ${JSON.stringify(dados)}\n\n`)
					);
				} catch {
					fechado = true;
				}
			};

			const empurrar = async () => {
				// relê a sessão a cada tick: quem muda (avançar/encerrar) é o servidor
				const atual = await buscarSessaoPorCodigo(codigo);
				if (!atual) {
					enviar('erro', { erro: 'Sala não encontrada.' });
					return;
				}

				const dados =
					atual.sessao.donoUid === usuario.uid
						? await payloadDoPainel(atual.sessao, atual.quiz)
						: await payloadDaSala(atual.sessao, atual.quiz, usuario);

				enviar('estado', dados);

				if (Date.now() - ultimoBatimento > BATIMENTO_MS) {
					ultimoBatimento = Date.now();
					enviar('batimento', { em: new Date().toISOString() });
				}
			};

			const parar = () => {
				if (fechado) return;
				fechado = true;
				if (relogio) clearInterval(relogio);
				try {
					controller.close();
				} catch {
					// stream já fechado
				}
			};

			await empurrar();
			relogio = setInterval(() => void empurrar(), INTERVALO_MS);
			request.signal.addEventListener('abort', parar);
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
