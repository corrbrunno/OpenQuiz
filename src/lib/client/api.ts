import type { User } from 'firebase/auth';

/** Erro vindo da API, com o status HTTP para a tela decidir o que mostrar. */
export class ErroApi extends Error {
	readonly status: number;

	constructor(mensagem: string, status: number) {
		super(mensagem);
		this.name = 'ErroApi';
		this.status = status;
	}
}

type OpcoesChamada = { metodo?: string; corpo?: unknown };

export async function chamar<T>(
	caminho: string,
	usuario: User,
	opcoes: OpcoesChamada = {}
): Promise<T> {
	const cabecalhos: Record<string, string> = {
		Authorization: `Bearer ${await usuario.getIdToken()}`
	};
	if (opcoes.corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

	const resposta = await fetch(caminho, {
		method: opcoes.metodo ?? 'GET',
		headers: cabecalhos,
		body: opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined
	});

	const corpo = (await resposta.json().catch(() => ({}))) as T & { erro?: string };
	if (!resposta.ok) {
		throw new ErroApi(corpo?.erro ?? 'Não foi possível concluir a operação.', resposta.status);
	}

	return corpo;
}

export async function enviarImagem(arquivo: File, usuario: User): Promise<string> {
	const formulario = new FormData();
	formulario.append('arquivo', arquivo);

	const resposta = await fetch('/api/upload', {
		method: 'POST',
		headers: { Authorization: `Bearer ${await usuario.getIdToken()}` },
		body: formulario
	});

	const corpo = (await resposta.json().catch(() => ({}))) as { url?: string; erro?: string };
	if (!resposta.ok || !corpo.url) {
		throw new ErroApi(corpo.erro ?? 'Falha ao enviar a imagem.', resposta.status);
	}

	return corpo.url;
}

export function mensagemDeErro(erro: unknown): string {
	if (erro instanceof ErroApi) return erro.message;

	if (erro instanceof TypeError) {
		return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
	}

	return erro instanceof Error ? erro.message : 'Não foi possível concluir a operação.';
}
