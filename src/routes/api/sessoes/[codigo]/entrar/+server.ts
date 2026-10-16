import { json } from '@sveltejs/kit';
import { isDbConfigured } from '$lib/server/db';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { buscarSessaoPorCodigo, nomeDoUsuario, registrarParticipante } from '$lib/server/sessoes';
import type { RequestHandler } from './$types';

/** Entrar na sala: registra o participante (idempotente — entrar de novo só atualiza o nome). */
export const POST: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta para participar.' }, { status: 401 });

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) return json({ erro: 'Sala não encontrada: confira o código.' }, { status: 404 });

	if (achado.sessao.status !== 'aberta') {
		return json({ erro: 'Esta sessão já foi encerrada.' }, { status: 409 });
	}

	if (achado.sessao.donoUid === usuario.uid) {
		return json(
			{ erro: 'Você é quem conduz esta sessão: use a tela do apresentador.' },
			{ status: 409 }
		);
	}

	const participante = await registrarParticipante(
		achado.sessao.id,
		usuario.uid,
		nomeDoUsuario(usuario)
	);

	return json({ participante: { id: participante.id, nome: participante.nome } }, { status: 201 });
};
