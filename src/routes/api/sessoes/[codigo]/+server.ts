import { json } from '@sveltejs/kit';
import { isDbConfigured } from '$lib/server/db';
import { usuarioDaRequisicao } from '$lib/server/auth';
import {
	buscarSessaoPorCodigo,
	minhasRespostas,
	participanteDaSessao,
	perguntasDoQuiz,
	rankingDaSessao
} from '$lib/server/sessoes';
import type { RequestHandler } from './$types';

/**
 * Estado da sala para quem está jogando (e o código não devolve o gabarito, nunca).
 * - modo `conduzida`: devolve só a pergunta que está no ar;
 * - modo `livre`: devolve todas, cada um no seu ritmo;
 * - o placar só aparece para o dono ou depois de encerrar.
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta para abrir a sala.' }, { status: 401 });

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) return json({ erro: 'Sala não encontrada: confira o código.' }, { status: 404 });

	const { sessao, quiz } = achado;
	const souDono = sessao.donoUid === usuario.uid;
	const participante = souDono ? null : await participanteDaSessao(sessao.id, usuario.uid);

	const todas = await perguntasDoQuiz(quiz.id);
	const visiveis =
		sessao.modo === 'conduzida' ? todas.filter((item) => item.ordem === sessao.perguntaAtual) : todas;

	const minhas = participante ? await minhasRespostas(sessao.id, participante.id) : [];
	const ranking =
		souDono || sessao.status === 'encerrada' ? await rankingDaSessao(sessao.id) : null;

	return json({
		sessao: {
			codigo: sessao.codigo,
			modo: sessao.modo,
			status: sessao.status,
			perguntaAtual: sessao.perguntaAtual
		},
		quiz: { titulo: quiz.titulo, totalPerguntas: quiz.totalPerguntas },
		souDono,
		participei: Boolean(participante),
		participanteId: participante?.id ?? null,
		perguntas: visiveis,
		minhasRespostas: minhas,
		ranking
	});
};
