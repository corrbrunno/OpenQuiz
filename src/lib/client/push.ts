import { Capacitor } from '@capacitor/core';
import type { User } from 'firebase/auth';
import { chamar } from './api';

/**
 * Push no APK (FCM). No navegador não existe: tudo vira no-op.
 * O token é do aparelho — se a pessoa troca de conta, o mesmo token passa a apontar para o novo uid.
 */
let tokenAtual: string | null = null;
let registradoParaUid: string | null = null;

export function pushDisponivel(): boolean {
	return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

export function tokenDePush(): string | null {
	return tokenAtual;
}

async function guardarNoServidor(token: string, usuario: User): Promise<void> {
	try {
		await chamar('/api/push/token', usuario, {
			metodo: 'POST',
			corpo: { token, plataforma: Capacitor.getPlatform() }
		});
		registradoParaUid = usuario.uid;
	} catch {
		// sessão ainda não aberta: a próxima chamada de registrarPush tenta de novo
		registradoParaUid = null;
	}
}

/** Pede permissão, registra no FCM e manda o token para o servidor. */
export async function registrarPush(usuario: User): Promise<boolean> {
	if (!pushDisponivel()) return false;
	if (registradoParaUid === usuario.uid && tokenAtual) return true;

	const { PushNotifications } = await import('@capacitor/push-notifications');

	// canal de alta prioridade: sem ele o Android 8+ mostra a notificação sem destaque
	await PushNotifications.createChannel({
		id: 'quiz-perguntas',
		name: 'Perguntas da sala',
		description: 'Avisos de pergunta nova quando você está fora do app',
		importance: 5,
		visibility: 1,
		sound: 'default',
		vibration: true
	}).catch(() => {});

	const permissao = await PushNotifications.checkPermissions();
	if (permissao.receive !== 'granted') {
		const pedido = await PushNotifications.requestPermissions();
		if (pedido.receive !== 'granted') return false;
	}

	await PushNotifications.removeAllListeners();

	await PushNotifications.addListener('registration', (token) => {
		tokenAtual = token.value;
		void guardarNoServidor(token.value, usuario);
	});

	await PushNotifications.addListener('registrationError', () => {
		tokenAtual = null;
	});

	// tocar na notificação abre a sala daquela rodada
	await PushNotifications.addListener('pushNotificationActionPerformed', (acao) => {
		const codigo = acao.notification?.data?.codigo;
		if (codigo && typeof codigo === 'string') {
			window.location.href = `/sala/${codigo}`;
		}
	});

	await PushNotifications.register();
	return true;
}

/** Logout: o servidor para de mandar notificação para este aparelho. */
export async function esquecerPush(usuario: User): Promise<void> {
	if (!pushDisponivel()) return;

	if (!tokenAtual) {
		const { PushNotifications } = await import('@capacitor/push-notifications');
		const entrega = await new Promise<string | null>((resolver) => {
			const prazo = setTimeout(() => resolver(null), 3000);
			void PushNotifications.addListener('registration', (token) => {
				clearTimeout(prazo);
				resolver(token.value);
			});
			void PushNotifications.register();
		});
		tokenAtual = entrega;
	}

	if (!tokenAtual) return;

	try {
		await chamar('/api/push/token', usuario, { metodo: 'DELETE', corpo: { token: tokenAtual } });
	} catch {
		// sessão já morta: o token inválido é removido pelo próprio envio
	}

	tokenAtual = null;
	registradoParaUid = null;
}
