<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import { Button } from '$lib/components/ui/button';
	import { montarResposta, type RascunhoResposta } from '$lib/quiz/rascunhos';
	import type { ConteudoDe, PerguntaSalva, RespostaComum } from '$lib/quiz/tipos';
	import { embaralharComSemente, moverItem } from '$lib/quiz/utils';

	let {
		pergunta,
		responder,
		estadoInicial = null,
		desabilitado = false
	}: {
		pergunta: PerguntaSalva;
		responder: (resposta: RespostaComum) => void;
		estadoInicial?: RascunhoResposta | null;
		desabilitado?: boolean;
	} = $props();

	const conteudo = $derived(pergunta.conteudo as ConteudoDe<'reordenar'>);
	const textos = $derived(new Map(conteudo.itens.map((item) => [item.id, item.texto])));
	const ordemInicial = $derived(
		embaralharComSemente(
			conteudo.itens.map((item) => item.id),
			pergunta.id
		)
	);

	function ordemInicialEscolhida(): string[] | null {
		return estadoInicial?.tipo === 'reordenar' && estadoInicial.ordem.length > 0
			? [...estadoInicial.ordem]
			: null;
	}

	let ordemEscolhida = $state<string[] | null>(ordemInicialEscolhida());
	const ordem = $derived(ordemEscolhida ?? ordemInicial);

	function mover(indice: number, delta: number) {
		if (desabilitado) return;

		const atual = [...ordem];
		moverItem(atual, indice, indice + delta);
		ordemEscolhida = atual;
		responder(montarResposta(pergunta.id, { tipo: 'reordenar', ordem: [...atual] }));
	}
</script>

<div class="flex flex-col gap-2">
	{#each ordem as itemId, indice (itemId)}
		<div class="flex items-center gap-2">
			<span class="bg-muted text-muted-foreground grid size-7 shrink-0 place-items-center rounded-md text-xs font-medium">
				{indice + 1}
			</span>
			<span class="flex-1 text-sm">{textos.get(itemId) ?? '(item)'}</span>
			<Button
				variant="ghost"
				size="icon"
				disabled={desabilitado || indice === 0}
				onclick={() => mover(indice, -1)}
				aria-label="Mover para cima"
			>
				<ArrowUpIcon class="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				disabled={desabilitado || indice === ordem.length - 1}
				onclick={() => mover(indice, 1)}
				aria-label="Mover para baixo"
			>
				<ArrowDownIcon class="size-4" />
			</Button>
		</div>
	{/each}

	<Button
		variant="outline"
		size="sm"
		class="w-fit"
		disabled={desabilitado}
		onclick={() => responder(montarResposta(pergunta.id, { tipo: 'reordenar', ordem: [...ordem] }))}
	>
		Confirmar esta ordem
	</Button>
</div>
