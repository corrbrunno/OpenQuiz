type Ouvinte = (evento: string, dados: unknown) => void;

/**
 * Pub/sub em memória, por sala. O app roda em um único processo Node, então isso basta
 * para entregar uma mensagem a todos os assinantes no mesmo instante — sem polling e sem
 * infra nova. (Se um dia rodar em várias instâncias, trocar por LISTEN/NOTIFY do Postgres.)
 */
const ouvintes = new Map<string, Set<Ouvinte>>();

export function assinar(sala: string, ouvinte: Ouvinte): () => void {
	const conjunto = ouvintes.get(sala) ?? new Set<Ouvinte>();
	conjunto.add(ouvinte);
	ouvintes.set(sala, conjunto);

	return () => {
		const atual = ouvintes.get(sala);
		if (!atual) return;
		atual.delete(ouvinte);
		if (atual.size === 0) ouvintes.delete(sala);
	};
}

export function publicar(sala: string, evento: string, dados: unknown): void {
	const conjunto = ouvintes.get(sala);
	if (!conjunto) return;

	for (const ouvinte of conjunto) {
		try {
			ouvinte(evento, dados);
		} catch {
			// ouvinte morto não pode derrubar os outros
		}
	}
}

export function quantosOuvintes(sala: string): number {
	return ouvintes.get(sala)?.size ?? 0;
}
