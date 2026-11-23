import type { User } from 'firebase/auth';
import { sair } from './auth.svelte';

/** Limite de inatividade da disciplina: 120 s. */
export const LIMITE_INATIVIDADE_MS = 120_000;
const INTERVALO_TOQUE_MS = 20_000;
const INTERVALO_VIGIA_MS = 3_000;

export const sessaoUsuario = $state({
	id: '',
	iniciadaEm: '',
	expiraEm: 0,
	/** Mensagem mostrada depois de uma expiração por inatividade. */
	aviso: ''
});

async function abrir(usuario: User): Promise<void> {
	const resposta = await fetch('/api/sessao', {
		method: 'POST',
		headers: { Authorization: `Bearer ${await usuario.getIdToken()}` }
	});

	const corpo = (await resposta.json().catch(() => ({}))) as {
		sessao?: { id: string; iniciadaEm: string; expiraEm: string };
		erro?: string;
	};

	if (!resposta.ok || !corpo.sessao) {
		throw new Error(corpo.erro ?? 'Não foi possível abrir a sessão.');
	}

	sessaoUsuario.id = corpo.sessao.id;
	sessaoUsuario.iniciadaEm = corpo.sessao.iniciadaEm;
	sessaoUsuario.expiraEm = new Date(corpo.sessao.expiraEm).getTime();
	sessaoUsuario.aviso = '';
}

/** Garante uma sessão válida antes de cada chamada de API (a mutação exige `X-Sessao`). */
export async function garantirSessao(usuario: User): Promise<string> {
	if (sessaoUsuario.id && Date.now() < sessaoUsuario.expiraEm) return sessaoUsuario.id;

	await abrir(usuario);
	return sessaoUsuario.id;
}

export async function tocarSessao(usuario: User): Promise<boolean> {
	if (!sessaoUsuario.id) return false;

	const resposta = await fetch('/api/sessao/touch', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${await usuario.getIdToken()}`,
			'X-Sessao': sessaoUsuario.id
		}
	});

	if (!resposta.ok) return false;

	const corpo = (await resposta.json().catch(() => ({}))) as {
		sessao?: { expiraEm: string };
	};
	if (corpo.sessao?.expiraEm) sessaoUsuario.expiraEm = new Date(corpo.sessao.expiraEm).getTime();

	return true;
}

/** Logout: encerra a sessão no servidor e limpa o estado local. */
export async function encerrarSessao(usuario: User | null): Promise<void> {
	if (usuario && sessaoUsuario.id) {
		await fetch('/api/sessao', {
			method: 'DELETE',
			headers: {
				Authorization: `Bearer ${await usuario.getIdToken()}`,
				'X-Sessao': sessaoUsuario.id
			}
		}).catch(() => undefined);
	}

	limparSessao();
}

export function limparSessao(): void {
	sessaoUsuario.id = '';
	sessaoUsuario.iniciadaEm = '';
	sessaoUsuario.expiraEm = 0;
}

/**
 * Observa a atividade do usuário (toque, tecla, scroll, voltar para a aba) e expira a sessão
 * depois do limite de inatividade — desmontando a área privada, porque o logout zera o usuário.
 */
export function acompanharAtividade(usuario: User): () => void {
	let ultimoToque = 0;

	const tocar = () => {
		const agora = Date.now();
		if (agora - ultimoToque < INTERVALO_TOQUE_MS) return;
		ultimoToque = agora;
		// sem rede o POST falha: não pode virar unhandled rejection no console
		void tocarSessao(usuario).catch(() => undefined);
	};

	const eventos: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'scroll', 'touchstart'];
	for (const evento of eventos) window.addEventListener(evento, tocar, { passive: true });

	const aoTrocarVisibilidade = () => {
		if (document.visibilityState === 'visible') tocar();
	};
	document.addEventListener('visibilitychange', aoTrocarVisibilidade);

	const vigia = setInterval(() => {
		if (!sessaoUsuario.id || !sessaoUsuario.expiraEm) return;
		if (Date.now() <= sessaoUsuario.expiraEm) return;

		// Sem rede não existe como autenticar de novo: deslogar aqui apagaria a tela e
		// deixaria a fila de respostas órfã. A sessão do servidor já está vencida de
		// qualquer forma (ele recusa tudo), então a área privada só é desmontada quando
		// a conexão volta — aí sim o usuário é obrigado a entrar de novo.
		if (typeof navigator !== 'undefined' && !navigator.onLine) {
			sessaoUsuario.aviso =
				'Sem conexão. A sessão será revalidada assim que a rede voltar — o que você responder agora fica guardado.';
			return;
		}

		sessaoUsuario.aviso = 'Sessão expirada por inatividade (2 min). Entre novamente.';
		limparSessao();
		void sair();
	}, INTERVALO_VIGIA_MS);

	void tocar();

	return () => {
		for (const evento of eventos) window.removeEventListener(evento, tocar);
		document.removeEventListener('visibilitychange', aoTrocarVisibilidade);
		clearInterval(vigia);
	};
}

export function limparAviso(): void {
	sessaoUsuario.aviso = '';
}
