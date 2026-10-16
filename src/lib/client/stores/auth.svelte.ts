import { browser } from '$app/environment';
import type { User } from 'firebase/auth';
import { getFirebase } from '../firebase';

export const authState = $state({
	user: null as User | null,
	carregando: true,
	erro: ''
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

export async function iniciarAuth(): Promise<void> {
	if (!browser || iniciado) return;
	iniciado = true;

	try {
		const { auth, authMod } = await getFirebase();
		authMod.onAuthStateChanged(auth, (user) => {
			authState.user = user;
			authState.carregando = false;
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
		await authMod.signInWithEmailAndPassword(auth, email.trim(), senha);
		return true;
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
			await authMod.signInWithPopup(auth, provedor);
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
		await authMod.getRedirectResult(auth);
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
	try {
		const { auth, authMod } = await getFirebase();
		await authMod.signOut(auth);
	} catch (erro) {
		authState.erro = mensagemDeErro(erro);
	}
}
