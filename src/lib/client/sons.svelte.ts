const MUTE_KEY = 'som:mudo';

type JanelaComAudio = Window & { webkitAudioContext?: typeof AudioContext };

function lerMudo(): boolean {
	if (typeof localStorage === 'undefined') return false;
	return localStorage.getItem(MUTE_KEY) === 'true';
}

export const som = $state({ mudo: lerMudo() });

export function alternarSom(): void {
	som.mudo = !som.mudo;
	if (typeof localStorage !== 'undefined') localStorage.setItem(MUTE_KEY, String(som.mudo));
}

let contexto: AudioContext | null = null;

function audio(): AudioContext | null {
	if (typeof window === 'undefined') return null;

	const Ctor = window.AudioContext ?? (window as JanelaComAudio).webkitAudioContext;
	if (!Ctor) return null;
	if (!contexto) contexto = new Ctor();
	if (contexto.state === 'suspended') void contexto.resume();

	return contexto;
}

/** Sons curtos sintetizados (sem arquivo): funcionam offline e não pesam no bundle. */
const TONS: Record<string, number[]> = {
	'nova-pergunta': [660, 880],
	resposta: [520],
	fim: [880, 660, 440]
};

export function tocarSom(tipo: keyof typeof TONS | string): void {
	if (som.mudo) return;

	const ctx = audio();
	if (!ctx) return;

	let quando = ctx.currentTime;
	for (const frequencia of TONS[tipo] ?? TONS.resposta) {
		const oscilador = ctx.createOscillator();
		const ganho = ctx.createGain();

		oscilador.type = 'sine';
		oscilador.frequency.value = frequencia;
		ganho.gain.setValueAtTime(0.0001, quando);
		ganho.gain.exponentialRampToValueAtTime(0.12, quando + 0.02);
		ganho.gain.exponentialRampToValueAtTime(0.0001, quando + 0.18);

		oscilador.connect(ganho).connect(ctx.destination);
		oscilador.start(quando);
		oscilador.stop(quando + 0.2);

		quando += 0.18;
	}
}
