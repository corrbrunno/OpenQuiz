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
			return 'O login por e-mail e senha está desativado no projeto Firebase.';
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
