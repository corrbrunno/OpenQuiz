import { browser } from '$app/environment';
import type { User } from 'firebase/auth';
import { getFirebase } from '../firebase';
import {
	confirmarBiometria,
	ehNativo,
	mensagemDaConfirmacao,
	preferenciaNativaAtiva,
	situacaoBiometria
} from '../nativo';
import { esquecerPush } from '../push';

export const authState = $state({
	user: null as User | null,
	carregando: true,
	erro: '',
	/** Recado informativo (não é erro): ex. entrada nativa indisponível no aparelho. */
	aviso: ''
});

let iniciado = false;

function mensagemDeErro(erro: unknown): string {
	const codigo = (erro as { code?: string })?.code ?? '';

	switch (codigo) {
		case 'auth/invalid-credential':
		case 'auth/wrong-password':
		case 'auth/user-not-found':
			return 'E-mail ou senha incorretos.';
		case 'auth/invalid-email':
			return 'E-mail inválido.';
		case 'auth/email-already-in-use':
			return 'Este e-mail já está cadastrado.';
		case 'auth/weak-password':
			return 'Senha muito curta: use pelo menos 6 caracteres.';
		case 'auth/operation-not-allowed':
			return 'Provedor desativado no projeto Firebase. Ative em Authentication → Sign-in method.';
		case 'auth/unauthorized-domain':
			return 'Domínio não autorizado no Firebase Auth (Authentication → Settings → Authorized domains).';
		case 'auth/popup-closed-by-user':
		case 'auth/cancelled-popup-request':
			return 'A janela do Google foi fechada antes de concluir.';
		case 'auth/popup-blocked':
			return 'O navegador bloqueou a janela do Google. Tente de novo ou libere pop-ups.';
		case 'auth/account-exists-with-different-credential':
			return 'Já existe uma conta com esse e-mail usando outro método. Entre com a senha cadastrada.';
		case 'auth/too-many-requests':
			return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
		case 'auth/network-request-failed':
			return 'Falha de rede: verifique sua conexão.';
		default:
			return erro instanceof Error ? erro.message : 'Não foi possível concluir a operação.';
	}
}

let autorizacao: { uid: string; promessa: Promise<boolean> } | null = null;

/** Sai da conta sem passar pelo `sair()`: cancelar a biometria não apaga o token de push. */
async function encerrarSemConfirmacao(): Promise<void> {
	try {
		const { auth, authMod } = await getFirebase();
		await authMod.signOut(auth);
	} catch {
		// se nem deslogar deu, a área privada continua fechada — o usuário não é aplicado
	}
}

/**
 * Porteiro único da área privada. Roda em DOIS caminhos:
 *  - login explícito (senha ou Google);
 *  - restauração da sessão pelo Firebase quando o app reabre, que é justamente a
 *    "entrada" que não passa por senha nenhuma.
 * Chamadas simultâneas para o mesmo usuário compartilham a mesma promessa (um só diálogo).
 */
async function autorizar(usuario: User): Promise<boolean> {
	if (autorizacao?.uid === usuario.uid) return autorizacao.promessa;

	const promessa = (async () => {
		authState.aviso = '';

		if (!ehNativo() || !preferenciaNativaAtiva(usuario.uid)) return true;

		const situacao = await situacaoBiometria();
		if (!situacao.podeConfirmar) {
			// aparelho sem biometria e sem PIN/padrão: trancar aqui seria trancar para sempre
			authState.aviso =
				'Entrada nativa indisponível neste aparelho (sem biometria e sem PIN/padrão). Definimos a entrada por senha até o aparelho ter uma proteção de tela.';
			return true;
		}

		const resultado = await confirmarBiometria('Confirmar entrada no Online Quiz');
		if (resultado.ok) return true;

		authState.erro = mensagemDaConfirmacao(resultado);
		await encerrarSemConfirmacao();
		return false;
	})();

	autorizacao = { uid: usuario.uid, promessa };
	void promessa.finally(() => {
		if (autorizacao?.promessa === promessa) autorizacao = null;
	});

	return promessa;
}

/** Só publica o usuário depois de autorizado — é isso que mantém a tela privada fechada. */
async function aplicarUsuario(usuario: User | null): Promise<void> {
	if (!usuario) {
		authState.user = null;
		authState.carregando = false;
		return;
	}

	const liberado = await autorizar(usuario);
	authState.user = liberado ? usuario : null;
	authState.carregando = false;
}

export async function iniciarAuth(): Promise<void> {
	if (!browser || iniciado) return;
	iniciado = true;

	try {
		const { auth, authMod } = await getFirebase();
		authMod.onAuthStateChanged(auth, (user) => {
			void aplicarUsuario(user);
		});
		await concluirLoginGoogle();
	} catch (erro) {
		authState.carregando = false;
		authState.erro = mensagemDeErro(erro);
	}
}

export async function entrar(email: string, senha: string): Promise<boolean> {
	authState.erro = '';
	try {
		const { auth, authMod } = await getFirebase();
		const credencial = await authMod.signInWithEmailAndPassword(auth, email.trim(), senha);
		return await autorizar(credencial.user);
	} catch (erro) {
		authState.erro = mensagemDeErro(erro);
		return false;
	}
}

export async function criarConta(email: string, senha: string): Promise<boolean> {
	authState.erro = '';
	try {
		const { auth, authMod } = await getFirebase();
		await authMod.createUserWithEmailAndPassword(auth, email.trim(), senha);
		return true;
	} catch (erro) {
		authState.erro = mensagemDeErro(erro);
		return false;
	}
}

export async function entrarComGoogle(): Promise<boolean> {
	authState.erro = '';
	try {
		const { auth, authMod } = await getFirebase();
		const provedor = new authMod.GoogleAuthProvider();
		provedor.setCustomParameters({ prompt: 'select_account' });

		try {
			const credencial = await authMod.signInWithPopup(auth, provedor);
			if (!(await autorizar(credencial.user))) return false;
		} catch (erro) {
			const codigo = (erro as { code?: string })?.code ?? '';
			const semPopup =
				codigo === 'auth/popup-blocked' ||
				codigo === 'auth/operation-not-supported-in-this-environment';

			if (!semPopup) throw erro;
			await authMod.signInWithRedirect(auth, provedor);
		}

		return true;
	} catch (erro) {
		authState.erro = mensagemDeErro(erro);
		return false;
	}
}

export async function concluirLoginGoogle(): Promise<void> {
	if (!browser) return;
	try {
		const { auth, authMod } = await getFirebase();
		const resultado = await authMod.getRedirectResult(auth);
		if (resultado?.user) await autorizar(resultado.user);
	} catch (erro) {
		authState.erro = mensagemDeErro(erro);
	}
}

export async function redefinirSenha(email: string): Promise<boolean> {
	authState.erro = '';
	try {
		const { auth, authMod } = await getFirebase();
		await authMod.sendPasswordResetEmail(auth, email.trim());
		return true;
	} catch (erro) {
		authState.erro = mensagemDeErro(erro);
		return false;
	}
}

export async function sair(): Promise<void> {
	authState.erro = '';
	authState.aviso = '';
	try {
		// o aparelho deixa de receber notificação desta conta
		if (authState.user) await esquecerPush(authState.user);

		const { auth, authMod } = await getFirebase();
		await authMod.signOut(auth);
	} catch (erro) {
		authState.erro = mensagemDeErro(erro);
	}
}
