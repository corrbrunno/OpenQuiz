import type { User } from 'firebase/auth';
import { cabecalhosDe, chamar } from './api';
import type { Atribuicao, PerguntaSalva, RespostaComum } from '$lib/quiz/tipos';

export type ModoSessao = 'conduzida' | 'livre';
export type StatusSessao = 'aberta' | 'encerrada';

export type LinhaRanking = {
	participanteId: string;
	nome: string;
	acertos: number;
	respondidas: number;
	ultimaRespostaEm: string | null;
};

export type RespostaGravada = {
	perguntaId: string;
	atribuicoes: Atribuicao[];
	acertos: number;
	total: number;
};

export type EstadoDaSala = {
	sessao: { codigo: string; modo: ModoSessao; status: StatusSessao; perguntaAtual: number };
	quiz: { titulo: string; totalPerguntas: number };
	souDono: boolean;
	participei: boolean;
	participanteId: string | null;
	perguntas: PerguntaSalva[];
	minhasRespostas: RespostaGravada[];
	ranking: LinhaRanking[] | null;
};

export type PainelDoApresentador = {
	sessao: {
		codigo: string;
		modo: ModoSessao;
		status: StatusSessao;
		perguntaAtual: number;
		abertaEm: string;
		encerradaEm: string | null;
	};
	quiz: { id: string; titulo: string; totalPerguntas: number };
	perguntaAtual: PerguntaSalva | null;
	gabaritoAtual: RespostaComum | null;
	participantes: (LinhaRanking & { respondeuAtual: boolean })[];
	responderamAtual: number;
	ranking: LinhaRanking[];
};

/** Inicia a rodada: é aqui que o código da sala nasce. */
export async function iniciarSessao(
	quizId: string,
	modo: ModoSessao,
	usuario: User
): Promise<{ codigo: string; modo: ModoSessao }> {
	const { sessao } = await chamar<{ sessao: { codigo: string; modo: ModoSessao } }>(
		'/api/sessoes',
		usuario,
		{ metodo: 'POST', corpo: { quizId, modo } }
	);

	return sessao;
}

export async function estadoDaSala(codigo: string, usuario: User): Promise<EstadoDaSala> {
	return chamar<EstadoDaSala>(`/api/sessoes/${encodeURIComponent(codigo)}`, usuario);
}

export async function entrarNaSala(
	codigo: string,
	usuario: User
): Promise<{ id: string; nome: string }> {
	const { participante } = await chamar<{ participante: { id: string; nome: string } }>(
		`/api/sessoes/${encodeURIComponent(codigo)}/entrar`,
		usuario,
		{ metodo: 'POST', corpo: {} }
	);

	return participante;
}

export async function responderPergunta(
	codigo: string,
	perguntaId: string,
	atribuicoes: Atribuicao[],
	usuario: User
): Promise<RespostaGravada & { jaRespondida: boolean }> {
	const { resposta } = await chamar<{
		resposta: RespostaGravada & { jaRespondida: boolean };
	}>(`/api/sessoes/${encodeURIComponent(codigo)}/respostas`, usuario, {
		metodo: 'POST',
		corpo: { perguntaId, atribuicoes }
	});

	return resposta;
}

export async function painelDoApresentador(
	codigo: string,
	usuario: User
): Promise<PainelDoApresentador> {
	return chamar<PainelDoApresentador>(
		`/api/sessoes/${encodeURIComponent(codigo)}/controle`,
		usuario
	);
}

export async function controlarSessao(
	codigo: string,
	acao: 'avancar' | 'voltar' | 'encerrar',
	usuario: User
): Promise<void> {
	await chamar(`/api/sessoes/${encodeURIComponent(codigo)}/controle`, usuario, {
		metodo: 'POST',
		corpo: { acao }
	});
}

/**
 * Assinatura de eventos da sala (SSE) com reconexão automática.
 * O `EventSource` nativo não manda cabeçalho, então lemos o stream com `fetch` e
 * refazemos a conexão com espera crescente quando ela cai.
 */
export function assinarSala(
	codigo: string,
	usuario: User,
	aoReceber: (dados: unknown) => void
): () => void {
	let ativo = true;
	let controle: AbortController | null = null;
	let espera = 1000;

	const conectar = async () => {
		while (ativo) {
			controle = new AbortController();

			try {
				const resposta = await fetch(`/api/sessoes/${encodeURIComponent(codigo)}/eventos`, {
					headers: await cabecalhosDe(usuario),
					signal: controle.signal
				});

				// Sessão revogada/expirada (401) ou fora da sala (403): reconectar não resolve.
				if (resposta.status === 401 || resposta.status === 403) return;

				if (!resposta.ok || !resposta.body) throw new Error(`stream ${resposta.status}`);

				espera = 1000;
				const leitor = resposta.body.getReader();
				const decodificador = new TextDecoder();
				let buffer = '';

				while (ativo) {
					const { value, done } = await leitor.read();
					if (done) break;

					buffer += decodificador.decode(value, { stream: true });

					let corte = buffer.indexOf('\n\n');
					while (corte !== -1) {
						const bloco = buffer.slice(0, corte);
						buffer = buffer.slice(corte + 2);

						const linha = bloco.split('\n').find((item) => item.startsWith('data:'));
						if (linha) {
							try {
								aoReceber(JSON.parse(linha.slice(5).trim()));
							} catch {
								// evento malformado: ignora
							}
						}

						corte = buffer.indexOf('\n\n');
					}
				}
			} catch {
				// queda de rede/servidor: cai no backoff abaixo
			}

			if (!ativo) break;
			await new Promise((resolver) => setTimeout(resolver, espera));
			espera = Math.min(espera * 2, 8000);
		}
	};

	void conectar();

	return () => {
		ativo = false;
		controle?.abort();
	};
}
