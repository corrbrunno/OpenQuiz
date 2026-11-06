import { json } from '@sveltejs/kit';
import { isDbConfigured } from '$lib/server/db';
import { usuarioDaRequisicao } from '$lib/server/auth';
import { exigirSessao } from '$lib/server/sessao-usuario';
import { buscarSessaoPorCodigo, nomeDoUsuario } from '$lib/server/sessoes';
import { acessoAoChat, criarMensagem, LIMITE_TEXTO, listarMensagens } from '$lib/server/mensagens';
import { publicar } from '$lib/server/barramento';
import type { RequestHandler } from './$types';

/** Histórico do chat. `desde` (ISO) serve à reconexão: devolve só o que passou. */
export const GET: RequestHandler = async ({ params, request, url }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) return json({ erro: 'Sala não encontrada.' }, { status: 404 });

	const acesso = await acessoAoChat(achado.sessao, usuario);
	if (!acesso.podeLer) return json({ erro: acesso.motivo }, { status: 403 });

	return json({
		chatAtivo: achado.sessao.chatAtivo,
		mensagens: await listarMensagens(achado.sessao.id, url.searchParams.get('desde'))
	});
};

/** Envio. A mensagem só volta para o cliente depois de gravada e publicada no barramento. */
export const POST: RequestHandler = async ({ params, request }) => {
	if (!isDbConfigured()) return json({ erro: 'DATABASE_URL não configurada.' }, { status: 500 });

	const usuario = await usuarioDaRequisicao(request);
	if (!usuario) return json({ erro: 'Entre na sua conta.' }, { status: 401 });

	const semSessao = await exigirSessao(request, usuario);
	if (semSessao) return semSessao;

	const achado = await buscarSessaoPorCodigo(params.codigo ?? '');
	if (!achado) return json({ erro: 'Sala não encontrada.' }, { status: 404 });

	const acesso = await acessoAoChat(achado.sessao, usuario);
	if (!acesso.podeLer) return json({ erro: acesso.motivo }, { status: 403 });
	if (!acesso.podeEscrever) return json({ erro: acesso.motivo }, { status: 409 });

	const corpo = (await request.json().catch(() => null)) as { texto?: string } | null;
	const texto = (corpo?.texto ?? '').trim();
	if (!texto) return json({ erro: 'Escreva uma mensagem.' }, { status: 400 });
	if (texto.length > LIMITE_TEXTO) {
		return json({ erro: `Mensagem maior que ${LIMITE_TEXTO} caracteres.` }, { status: 400 });
	}

	const criada = await criarMensagem({
		sessaoId: achado.sessao.id,
		autorUid: usuario.uid,
		autorNome: nomeDoUsuario(usuario),
		texto
	});

	publicar(achado.sessao.id, 'mensagem', criada);

	return json({ mensagem: criada }, { status: 201 });
};
