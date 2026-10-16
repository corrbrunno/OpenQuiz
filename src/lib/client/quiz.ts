import type { User } from 'firebase/auth';
import { chamar, enviarImagem } from './api';
import { montarGabarito, type RascunhoPergunta } from '$lib/quiz/rascunhos';
import type { Atribuicao, ConteudoPergunta, RespostaComum, TipoPergunta } from '$lib/quiz/tipos';

export type QuestionarioResumo = {
	id: string;
	titulo: string;
	totalPerguntas: number;
	criadoEm: string;
	atualizadoEm: string;
};

export type PerguntaDoQuiz = {
	id: string;
	ordem: number;
	enunciado: string;
	imagemUrl: string | null;
	tipo: TipoPergunta;
	conteudo: ConteudoPergunta;
	gabarito: RespostaComum | null;
};

export type QuestionarioCompleto = {
	quiz: { id: string; titulo: string };
	perguntas: PerguntaDoQuiz[];
};

type PerguntaParaEnvio = {
	id?: string;
	enunciado: string;
	imagemUrl: string | null;
	tipo: TipoPergunta;
	conteudo: ConteudoPergunta;
	gabarito: { tipo: TipoPergunta; atribuicoes: Atribuicao[] };
};

export async function listarMeusQuestionarios(usuario: User): Promise<QuestionarioResumo[]> {
	const { quizzes } = await chamar<{ quizzes: QuestionarioResumo[] }>('/api/quizzes', usuario);
	return quizzes;
}

export async function carregarQuestionario(
	id: string,
	usuario: User
): Promise<QuestionarioCompleto> {
	return chamar<QuestionarioCompleto>(`/api/quizzes/${encodeURIComponent(id)}`, usuario);
}

/** Sobe as imagens novas e monta o payload no formato do formato comum de resposta. */
async function montarEnvio(
	perguntas: RascunhoPergunta[],
	usuario: User
): Promise<PerguntaParaEnvio[]> {
	const envio: PerguntaParaEnvio[] = [];

	for (const rascunho of perguntas) {
		const imagemUrl = rascunho.imagem
			? await enviarImagem(rascunho.imagem, usuario)
			: rascunho.imagemUrl;
		const gabarito = montarGabarito(rascunho);

		envio.push({
			id: rascunho.id,
			enunciado: rascunho.enunciado.trim(),
			imagemUrl,
			tipo: rascunho.conteudo.tipo,
			conteudo: rascunho.conteudo,
			gabarito: { tipo: gabarito.tipo, atribuicoes: gabarito.atribuicoes }
		});
	}

	return envio;
}

export async function criarQuestionario(
	titulo: string,
	perguntas: RascunhoPergunta[],
	usuario: User
): Promise<{ id: string }> {
	const envio = await montarEnvio(perguntas, usuario);

	return chamar<{ id: string }>('/api/quizzes', usuario, {
		metodo: 'POST',
		corpo: { titulo: titulo.trim(), perguntas: envio }
	});
}

export async function atualizarQuestionario(
	id: string,
	titulo: string,
	perguntas: RascunhoPergunta[],
	usuario: User
): Promise<{ id: string }> {
	const envio = await montarEnvio(perguntas, usuario);

	return chamar<{ id: string }>(`/api/quizzes/${encodeURIComponent(id)}`, usuario, {
		metodo: 'PUT',
		corpo: { titulo: titulo.trim(), perguntas: envio }
	});
}

export async function excluirQuestionario(id: string, usuario: User): Promise<void> {
	await chamar(`/api/quizzes/${encodeURIComponent(id)}`, usuario, { metodo: 'DELETE' });
}
