import { Capacitor } from '@capacitor/core';
import type { User } from 'firebase/auth';
import { chamar } from './api';

/**
 * Diz ao servidor se o app está na frente. É o que decide quem recebe a notificação
 * quando o organizador libera a próxima pergunta.
 */
export function acompanharPresenca(codigo: string, usuario: User): () => void {
	if (typeof window === 'undefined') return () => {};

	let emApp = document.visibilityState === 'visible';
	let parado = false;

	const avisar = async (valor: boolean) => {
		if (parado || emApp === valor) return;
		emApp = valor;
		try {
			await chamar(`/api/sessoes/${codigo}/presenca`, usuario, {
				metodo: 'POST',
				corpo: { emApp: valor }
			});
		} catch {
			// sem rede/sessão: o servidor cai no limite de 60 s sem sinal
		}
	};

	const aoTrocarVisibilidade = () => void avisar(document.visibilityState === 'visible');
	const aoTrocarEstado = (estado: { isActive: boolean }) => void avisar(estado.isActive);
	const aoFocar = () => void avisar(true);
	const aoDesfocar = () => void avisar(false);

	document.addEventListener('visibilitychange', aoTrocarVisibilidade);
	window.addEventListener('focus', aoFocar);
	window.addEventListener('blur', aoDesfocar);

	let removerApp: (() => void) | null = null;
	if (Capacitor.isNativePlatform()) {
		void import('@capacitor/app').then(({ App }) => {
			void App.addListener('appStateChange', aoTrocarEstado).then((alca) => {
				removerApp = () => void alca.remove();
			});
		});
	}

	// confirma presença ao entrar na sala (o servidor já criou o participante no /entrar)
	void avisar(true);

	return () => {
		parado = true;
		document.removeEventListener('visibilitychange', aoTrocarVisibilidade);
		window.removeEventListener('focus', aoFocar);
		window.removeEventListener('blur', aoDesfocar);
		removerApp?.();
	};
}
