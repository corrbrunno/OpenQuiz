import type { User } from 'firebase/auth';
import { montarGabarito, type RascunhoPergunta } from '$lib/quiz/rascunhos';
import type {
	Atribuicao,
	PerguntaSalva,
	RespostaComum,
	TipoPergunta
} from '$lib/quiz/tipos';

export type SalaCarregada = {
	id: string;
	titulo: string;
	codigo: string;
	totalPerguntas: number;
	souDono: boolean;
	perguntas: PerguntaSalva[];
};

/** Erro vindo da API, com o status HTTP para a tela decidir o que mostrar. */
export class ErroApi extends Error {
	readonly status: number;

	constructor(mensagem: string, status: number) {
		super(mensagem);
		this.name = 'ErroApi';
		this.status = status;
	}
}

type OpcoesChamada = { metodo?: string; corpo?: unknown; formulario?: FormData };

async function chamar<T>(caminho: string, usuario: User, opcoes: OpcoesChamada = {}): Promise<T> {
	const cabecalhos: Record<string, string> = {
		Authorization: `Bearer ${await usuario.getIdToken()}`
	};
	if (opcoes.corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';

	const resposta = await fetch(caminho, {
		method: opcoes.metodo ?? 'GET',
		headers: cabecalhos,
		body:
			opcoes.formulario ??
			(opcoes.corpo !== undefined ? JSON.stringify(opcoes.corpo) : undefined)
	});

	const corpo = (await resposta.json().catch(() => ({}))) as T & { erro?: string };
	if (!resposta.ok) {
		throw new ErroApi(corpo?.erro ?? 'Não foi possível concluir a operação.', resposta.status);
	}

	return corpo;
}

async function enviarImagem(arquivo: File, usuario: User): Promise<string> {
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

export async function salvarQuestionario(
	titulo: string,
	perguntas: RascunhoPergunta[],
	usuario: User
): Promise<{ id: string; codigo: string }> {
	const envio = [];

	for (const rascunho of perguntas) {
		const imagemUrl = rascunho.imagem ? await enviarImagem(rascunho.imagem, usuario) : null;
		const gabarito = montarGabarito(rascunho);

		envio.push({
			enunciado: rascunho.enunciado.trim(),
			imagemUrl,
			tipo: rascunho.conteudo.tipo,
			conteudo: rascunho.conteudo,
			gabarito: { tipo: gabarito.tipo, atribuicoes: gabarito.atribuicoes }
		});
	}

	return chamar<{ id: string; codigo: string }>('/api/quizzes', usuario, {
		metodo: 'POST',
		corpo: { titulo: titulo.trim(), perguntas: envio }
	});
}

export async function buscarPorCodigo(
	codigoDigitado: string,
	usuario: User
): Promise<SalaCarregada | null> {
	const codigo = encodeURIComponent(codigoDigitado.trim().toUpperCase());

	try {
		const { sala } = await chamar<{ sala: SalaCarregada }>(`/api/quizzes/${codigo}`, usuario);
		return sala;
	} catch (falha) {
		if (falha instanceof ErroApi && falha.status === 404) return null;
		throw falha;
	}
}

/** Devolve `null` quando quem pediu não é o dono — é a API que decide isso. */
export async function carregarGabaritos(
	codigoDigitado: string,
	usuario: User
): Promise<Map<string, RespostaComum> | null> {
	const codigo = encodeURIComponent(codigoDigitado.trim().toUpperCase());

	try {
		const { gabaritos } = await chamar<{
			gabaritos: { perguntaId: string; tipo: TipoPergunta; atribuicoes: Atribuicao[] }[];
		}>(`/api/quizzes/${codigo}/gabaritos`, usuario);

		return new Map(
			gabaritos.map((item) => [
				item.perguntaId,
				{ perguntaId: item.perguntaId, tipo: item.tipo, atribuicoes: item.atribuicoes }
			])
		);
	} catch (falha) {
		if (falha instanceof ErroApi && falha.status === 403) return null;
		throw falha;
	}
}

export function mensagemDeErro(erro: unknown): string {
	if (erro instanceof ErroApi) {
		if (erro.status === 401) return 'Sua sessão expirou. Entre novamente para continuar.';
		if (erro.status === 503) return erro.message;
		return erro.message;
	}

	if (erro instanceof TypeError) {
		return 'Sem conexão com o servidor. Verifique a internet e tente de novo.';
	}

	return erro instanceof Error ? erro.message : 'Não foi possível concluir a operação.';
}
