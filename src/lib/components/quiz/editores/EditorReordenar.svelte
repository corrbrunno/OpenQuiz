<script lang="ts">
	import type { ConteudoDe } from '$lib/quiz/tipos';
	import type { RascunhoPergunta } from '$lib/quiz/rascunhos';
	import ListaEditavel from '../ListaEditavel.svelte';

	let { rascunho }: { rascunho: RascunhoPergunta } = $props();

	const conteudo = $derived(rascunho.conteudo as ConteudoDe<'reordenar'>);
</script>

<div class="flex flex-col gap-3">
	<ListaEditavel
		itens={conteudo.itens}
		rotulo="Itens na ordem correta"
		placeholder="Texto do item"
		rotuloAdicionar="Adicionar item"
		minimo={2}
		maximo={8}
	/>

	<p class="text-muted-foreground text-xs">
		Escreva os itens já na ordem certa. O jogador recebe embaralhado e precisa devolver esta ordem.
	</p>
</div>
