/**
 * Recurso nativo (só existe no APK via Capacitor). No navegador tudo vira no-op,
 * então o mesmo bundle serve para a versão web e para o app Android.
 */
import { Capacitor } from '@capacitor/core';

const CHAVE = (uid: string) => `nativo:${uid}`;

const NOMES_BIOMETRIA: Record<number, string> = {
	0: 'nenhuma',
	1: 'Touch ID',
	2: 'Face ID',
	3: 'impressão digital',
	4: 'reconhecimento facial',
	5: 'íris'
};

export function ehNativo(): boolean {
	if (typeof window === 'undefined') return false;
	return Capacitor.isNativePlatform();
}

/** Preferência por conta E por aparelho — sem guardar senha. */
export function preferenciaNativaAtiva(uid: string): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(CHAVE(uid)) === 'true';
}

export function definirPreferenciaNativa(uid: string, ativa: boolean): void {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(CHAVE(uid), String(ativa));
}

export type SituacaoNativa = {
	biometria: boolean;
	aparelhoProtegido: boolean;
	podeConfirmar: boolean;
	tipo: string;
	motivo: string;
};

const SEM_NATIVO: SituacaoNativa = {
	biometria: false,
	aparelhoProtegido: false,
	podeConfirmar: false,
	tipo: 'web',
	motivo: 'Recurso disponível apenas no aplicativo Android'
};

export async function situacaoBiometria(): Promise<SituacaoNativa> {
	if (!ehNativo()) return SEM_NATIVO;

	try {
		const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
		const dados = await BiometricAuth.checkBiometry();
		const biometria = Boolean(dados.isAvailable);
		const aparelhoProtegido = Boolean(dados.deviceIsSecure);

		return {
			biometria,
			aparelhoProtegido,
			podeConfirmar: biometria || aparelhoProtegido,
			tipo: NOMES_BIOMETRIA[Number(dados.biometryType)] ?? 'desconhecida',
			motivo: String(dados.reason ?? '')
		};
	} catch (erro) {
		return {
			...SEM_NATIVO,
			tipo: 'erro',
			motivo: erro instanceof Error ? erro.message : 'Falha ao consultar a biometria'
		};
	}
}

/** Abre o diálogo do sistema (biometria ou PIN/padrão como alternativa). */
export async function confirmarBiometria(motivo: string): Promise<boolean> {
	if (!ehNativo()) return false;

	const situacao = await situacaoBiometria();
	if (!situacao.podeConfirmar) return false;

	try {
		const { BiometricAuth } = await import('@aparajita/capacitor-biometric-auth');
		await BiometricAuth.authenticate({
			reason: motivo,
			cancelTitle: 'Cancelar',
			androidTitle: 'Online Quiz',
			androidSubtitle: motivo,
			allowDeviceCredential: true
		});
		return true;
	} catch {
		// cancelado, falhou ou bloqueado: a área privada continua fechada
		return false;
	}
}
