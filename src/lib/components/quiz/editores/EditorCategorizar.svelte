<script lang="ts">
	import type { ConteudoDe, GabaritoDe } from '$lib/quiz/tipos';
	import type { RascunhoPergunta } from '$lib/quiz/rascunhos';
	import ListaEditavel from '../ListaEditavel.svelte';

	let { rascunho }: { rascunho: RascunhoPergunta } = $props();

	const conteudo = $derived(rascunho.conteudo as ConteudoDe<'categorizar'>);
	const gabarito = $derived(rascunho.gabarito as GabaritoDe<'categorizar'>);

	function associar(itemId: string, evento: Event) {
		const alvo = (evento.currentTarget as HTMLSelectElement).value;

		if (alvo) gabarito.associacoes[itemId] = alvo;
		else delete gabarito.associacoes[itemId];
	}
</script>

<div class="flex flex-col gap-4">
	<ListaEditavel
		itens={conteudo.itens}
		rotulo="Itens"
		placeholder="Item a categorizar"
		rotuloAdicionar="Adicionar item"
		minimo={1}
		maximo={10}
	>
		{#snippet depois({ item })}
			<select
				class="border-input bg-background h-9 shrink-0 rounded-md border px-2 text-sm"
				value={gabarito.associacoes[item.id] ?? ''}
				onchange={(evento) => associar(item.id, evento)}
				aria-label="Categoria correta deste item"
			>
				<option value="">categoria…</option>
				{#each conteudo.categorias as categoria (categoria.id)}
					<option value={categoria.id}>{categoria.texto || '(sem nome)'}</option>
				{/each}
			</select>
		{/snippet}
	</ListaEditavel>

	<ListaEditavel
		itens={conteudo.categorias}
		rotulo="Categorias"
		placeholder="Nome da categoria"
		rotuloAdicionar="Adicionar categoria"
		minimo={2}
		maximo={6}
	/>

	<p class="text-muted-foreground text-xs">
		Cada item da lista de cima precisa receber a categoria correta na caixa à direita.
	</p>
</div>
