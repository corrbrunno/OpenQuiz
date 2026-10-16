<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { ConteudoDe } from '$lib/quiz/tipos';
	import type { RascunhoPergunta } from '$lib/quiz/rascunhos';
	import { moverItem, novoPar } from '$lib/quiz/utils';

	let { rascunho }: { rascunho: RascunhoPergunta } = $props();

	const conteudo = $derived(rascunho.conteudo as ConteudoDe<'correspondencia'>);

	function removerPar(indice: number) {
		if (conteudo.pares.length <= 2) return;
		conteudo.pares.splice(indice, 1);
	}
</script>

<div class="flex flex-col gap-2">
	<span class="text-sm font-medium">Pares (coluna A → coluna B)</span>

	{#each conteudo.pares as par, indice (par.id)}
		<div class="flex items-center gap-2">
			<Input placeholder="Coluna A" bind:value={conteudo.pares[indice].esquerda} />
			<span class="text-muted-foreground shrink-0">→</span>
			<Input placeholder="Coluna B" bind:value={conteudo.pares[indice].direita} />

			<Button
				variant="ghost"
				size="icon"
				disabled={conteudo.pares.length <= 2}
				onclick={() => removerPar(indice)}
				aria-label="Remover este par"
			>
				<TrashIcon class="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				disabled={indice === 0}
				onclick={() => moverItem(conteudo.pares, indice, indice - 1)}
				aria-label="Mover para cima"
			>
				<ArrowUpIcon class="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				disabled={indice === conteudo.pares.length - 1}
				onclick={() => moverItem(conteudo.pares, indice, indice + 1)}
				aria-label="Mover para baixo"
			>
				<ArrowDownIcon class="size-4" />
			</Button>
		</div>
	{/each}

	<Button variant="outline" size="sm" class="w-fit" onclick={() => conteudo.pares.push(novoPar())}>
		<PlusIcon class="size-4" />
		Adicionar par
	</Button>

	<p class="text-muted-foreground text-xs">
		A coluna B é embaralhada na resposta; cada par desta lista é um acerto esperado.
	</p>
</div>
