import type { User } from 'firebase/auth';
import { garantirSessao } from './stores/sessao-usuario.svelte';

/** Erro vindo da API, com o status HTTP para a tela decidir o que mostrar. */
export class ErroApi extends Error {
	readonly status: number;
	readonly codigo: string;

	constructor(mensagem: string, status: number, codigo = '') {
		super(mensagem);
		this.name = 'ErroApi';
		this.status = status;
		this.codigo = codigo;
	}
}

type OpcoesChamada = { metodo?: string; corpo?: unknown };

/** Cabeçalhos comuns: token do Firebase + id da sessão do app (exigido nas mutações). */
export async function cabecalhosDe(usuario: User): Promise<Record<string, string>> {
	const idToken = await usuario.getIdToken();
	const sessaoId = await garantirSessao(usuario);

	return { Authorization: `Bearer ${idToken}`, 'X-Sessao': sessaoId };
}

export async function chamar<T>(
	caminho: string,
	usuario: User,
	opcoes: OpcoesChamada = {}
): Promise<T> {
	const cabecalhos = await cabecalhosDe(usuario);
	if (opcoes.corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

	const resposta = await fetch(caminho, {
		method: opcoes.metodo ?? 'GET',
		headers: cabecalhos,
		body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined
	});

	const corpo = (await resposta.json().catch(() => ({}))) as T & { erro?: string; codigo?: string };
	if (!resposta.ok) {
		throw new ErroApi(
			corpo?.erro ?? 'Não foi possível concluir a operação.',
			resposta.status,
			corpo?.codigo ?? ''
		);
	}

	return corpo;
}

export async function enviarImagem(arquivo: File, usuario: User): Promise<string> {
	const formulario = new FormData();
	formulario.append('arquivo', arquivo);

	const resposta = await fetch('/api/upload', {
		method: 'POST',
		headers: await cabecalhosDe(usuario),
		body: formulario
	});

	const corpo = (await resposta.json().catch(() => ({}))) as {
		url?: string;
		erro?: string;
		codigo?: string;
	};
	if (!resposta.ok || !corpo.url) {
		throw new ErroApi(corpo.erro ?? 'Falha ao enviar a imagem.', resposta.status, corpo.codigo ?? '');
	}

	return corpo.url;
}

/**
 * Falha de transporte: `fetch` rejeitou (sem rede, DNS, servidor fora). É diferente de uma
 * resposta de erro do servidor — só neste caso faz sentido guardar a operação para depois.
 */
export function semRede(erro: unknown): boolean {
	return erro instanceof TypeError || (typeof navigator !== 'undefined' && !navigator.onLine);
}

export function mensagemDeErro(erro: unknown): string {
	if (erro instanceof ErroApi) {
		if (erro.codigo === 'sessao-invalida') {
			return 'Sua sessão expirou por inatividade (2 min). Entre novamente.';
		}
		return erro.message;
	}

	if (erro instanceof TypeError) {
		return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
	}

	return erro instanceof Error ? erro.message : 'Não foi possível concluir a operação.';
}
