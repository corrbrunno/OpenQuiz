import type { User } from 'firebase/auth';
import { cabecalhosDe, chamar } from './api';

export type MensagemSala = {
	id: string;
	autorUid: string;
	autorNome: string;
	texto: string;
	criadoEm: string;
};

/**
 * Estado do chat de uma sala. Duas fontes caem no mesmo lugar: o histórico (GET) e o evento
 * do stream (SSE). O dedupe é estrutural — um Set de ids — então a mesma mensagem vinda das
 * duas fontes aparece uma vez só.
 */
export function criarChat() {
	let mensagens = $state<MensagemSala[]>([]);
	let ativo = $state(true);
	let encerrada = $state(false);
	let carregando = $state(true);
	let conexao = $state<'conectando' | 'aberta' | 'caindo'>('conectando');
	let erro = $state('');

	const ids = new Set<string>();

	function juntar(novas: MensagemSala[]): void {
		let entrou = false;

		for (const mensagem of novas) {
			if (!mensagem?.id || ids.has(mensagem.id)) continue;
			ids.add(mensagem.id);
			mensagens.push(mensagem);
			entrou = true;
		}

		if (entrou) {
			mensagens.sort((a, b) => a.criadoEm.localeCompare(b.criadoEm) || a.id.localeCompare(b.id));
		}
	}

	async function carregarHistorico(usuario: User, codigo: string): Promise<void> {
		try {
			const resposta = await chamar<{ chatAtivo: boolean; mensagens: MensagemSala[] }>(
				`/api/sessoes/${codigo}/mensagens`,
				usuario
			);
			ativo = resposta.chatAtivo;
			juntar(resposta.mensagens);
			erro = '';
		} catch (falha) {
			erro = falha instanceof Error ? falha.message : 'Não foi possível carregar o chat.';
		} finally {
			carregando = false;
		}
	}

	/** Assina o stream; a cada (re)conexão refaz o histórico, o que recupera o que passou. */
	function assinar(codigo: string, usuario: User): () => void {
		let vivo = true;
		let controle: AbortController | null = null;
		let espera = 1000;

		const conectar = async () => {
			while (vivo) {
				controle = new AbortController();

				try {
					const resposta = await fetch(`/api/sessoes/${codigo}/chat/eventos`, {
						headers: await cabecalhosDe(usuario),
						signal: controle.signal
					});

					// Sessão revogada/expirada (401) ou fora da sala (403): reconectar não resolve.
					if (resposta.status === 401 || resposta.status === 403) return;

					if (!resposta.ok || !resposta.body) throw new Error(`stream ${resposta.status}`);

					conexao = 'aberta';
					espera = 1000;

					// histórico DEPOIS de assinado (a ordem que o material pede)
					await carregarHistorico(usuario, codigo);

					const leitor = resposta.body.getReader();
					const decodificador = new TextDecoder();
					let buffer = '';

					while (vivo) {
						const { value, done } = await leitor.read();
						if (done) break;

						buffer += decodificador.decode(value, { stream: true });

						let corte = buffer.indexOf('\n\n');
						while (corte !== -1) {
							const bloco = buffer.slice(0, corte);
							buffer = buffer.slice(corte + 2);

							const nomeEvento =
								bloco
									.split('\n')
									.find((linha) => linha.startsWith('event:'))
									?.slice(6)
									.trim() ?? 'message';
							const linhaDados = bloco.split('\n').find((linha) => linha.startsWith('data:'));

							if (linhaDados) {
								try {
									const dados = JSON.parse(linhaDados.slice(5).trim());

									if (nomeEvento === 'chat') {
										ativo = Boolean(dados.ativo);
										encerrada = Boolean(dados.encerrada);
									} else if (nomeEvento === 'mensagem') {
										juntar([dados as MensagemSala]);
									}
								} catch {
									// evento malformado não derruba o stream
								}
							}

							corte = buffer.indexOf('\n\n');
						}
					}
				} catch {
					if (!vivo) break;
					conexao = 'caindo';
				}

				if (!vivo) break;
				await new Promise((resolver) => setTimeout(resolver, espera));
				espera = Math.min(espera * 2, 8000);
			}
		};

		void conectar();

		return () => {
			vivo = false;
			controle?.abort();
		};
	}

	async function enviar(texto: string, usuario: User, codigo: string): Promise<boolean> {
		const limpo = texto.trim();
		if (!limpo) return false;

		erro = '';
		try {
			const resposta = await chamar<{ mensagem: MensagemSala }>(
				`/api/sessoes/${codigo}/mensagens`,
				usuario,
				{ metodo: 'POST', corpo: { texto: limpo } }
			);
			juntar([resposta.mensagem]);
			return true;
		} catch (falha) {
			// nunca fingimos entrega: a mensagem não entra na lista
			erro = falha instanceof Error ? falha.message : 'Não foi possível enviar.';
			return false;
		}
	}

	async function alternarChat(usuario: User, codigo: string, ligado: boolean): Promise<void> {
		erro = '';
		try {
			await chamar(`/api/sessoes/${codigo}/controle`, usuario, {
				metodo: 'POST',
				corpo: { acao: 'chat', ativo: ligado }
			});
			ativo = ligado;
		} catch (falha) {
			erro = falha instanceof Error ? falha.message : 'Não foi possível alterar o chat.';
		}
	}

	return {
		get mensagens() {
			return mensagens;
		},
		get ativo() {
			return ativo;
		},
		get encerrada() {
			return encerrada;
		},
		get carregando() {
			return carregando;
		},
		get conexao() {
			return conexao;
		},
		get erro() {
			return erro;
		},
		limparErro() {
			erro = '';
		},
		assinar,
		carregarHistorico,
		enviar,
		alternarChat
	};
}
