import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Caminho A: o WebView carrega o app do servidor (rede local ou domínio publicado).
 * Assim a API, a sessão e o SSE continuam rodando no servidor, sem refatoração.
 * Para a P2 (app autônomo): trocar por build estático + PUBLIC_API_BASE e remover `server`.
 */
const config: CapacitorConfig = {
	appId: 'br.edu.univassouras.onlinequiz',
	appName: 'Online Quiz',
	webDir: 'capacitor-web',
	server: {
		url: process.env.CAPACITOR_SERVER_URL ?? 'http://192.168.18.98:5174',
		cleartext: true
	},
	android: {
		allowMixedContent: true
	}
};

export default config;
