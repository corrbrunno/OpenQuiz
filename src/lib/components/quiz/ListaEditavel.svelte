<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import type { Snippet } from 'svelte';
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import type { Item } from '$lib/quiz/tipos';
	import { adicionarItem, moverItem, removerItem } from '$lib/quiz/utils';

	let {
		itens,
		rotulo,
		placeholder = '',
		rotuloAdicionar = 'Adicionar',
		minimo = 1,
		maximo = 12,
		antes,
		depois
	}: {
		itens: Item[];
		rotulo: string;
		placeholder?: string;
		rotuloAdicionar?: string;
		minimo?: number;
		maximo?: number;
		antes?: Snippet<[{ item: Item; indice: number }]>;
		depois?: Snippet<[{ item: Item; indice: number }]>;
	} = $props();
</script>

<div class="flex flex-col gap-2">
	<span class="text-sm font-medium">{rotulo}</span>

	{#each itens as item, indice (item.id)}
		<div class="flex items-center gap-2">
			{#if antes}
				{@render antes({ item, indice })}
			{/if}

			<Input placeholder={placeholder} bind:value={itens[indice].texto} />

			{#if depois}
				{@render depois({ item, indice })}
			{/if}

			<Button
				variant="ghost"
				size="icon"
				disabled={itens.length <= minimo}
				onclick={() => removerItem(itens, indice, minimo)}
				aria-label="Remover este item"
			>
				<TrashIcon class="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				disabled={indice === 0}
				onclick={() => moverItem(itens, indice, indice - 1)}
				aria-label="Mover para cima"
			>
				<ArrowUpIcon class="size-4" />
			</Button>
			<Button
				variant="ghost"
				size="icon"
				disabled={indice === itens.length - 1}
				onclick={() => moverItem(itens, indice, indice + 1)}
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
		disabled={itens.length >= maximo}
		onclick={() => adicionarItem(itens)}
	>
		<PlusIcon class="size-4" />
		{rotuloAdicionar}
	</Button>
</div>
