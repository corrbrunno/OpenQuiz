<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { ConteudoDe, GabaritoDe } from '$lib/quiz/tipos';
	import type { RascunhoPergunta } from '$lib/quiz/rascunhos';
	import { alternar } from '$lib/quiz/utils';
	import ListaEditavel from '../ListaEditavel.svelte';

	let { rascunho }: { rascunho: RascunhoPergunta } = $props();

	const conteudo = $derived(rascunho.conteudo as ConteudoDe<'multipla-escolha'>);
	const gabarito = $derived(rascunho.gabarito as GabaritoDe<'multipla-escolha'>);

	function marcar(id: string) {
		if (conteudo.permiteMultiplas) {
			alternar(gabarito.corretas, id);
			return;
		}

		gabarito.corretas = gabarito.corretas[0] === id ? [] : [id];
	}

	function alternarMultiplas() {
		conteudo.permiteMultiplas = !conteudo.permiteMultiplas;
		if (!conteudo.permiteMultiplas && gabarito.corretas.length > 1) {
			gabarito.corretas = gabarito.corretas.slice(0, 1);
		}
	}
</script>

<div class="flex flex-col gap-4">
	<ListaEditavel
		itens={conteudo.opcoes}
		rotulo="Alternativas"
		placeholder="Texto da alternativa"
		rotuloAdicionar="Adicionar alternativa"
		minimo={2}
		maximo={8}
	>
		{#snippet antes({ item })}
			<Button
				variant={gabarito.corretas.includes(item.id) ? 'default' : 'outline'}
				size="icon"
				class="size-8 shrink-0"
				onclick={() => marcar(item.id)}
				aria-pressed={gabarito.corretas.includes(item.id)}
				aria-label={conteudo.permiteMultiplas
					? 'Marcar esta alternativa como correta'
					: 'Definir como a alternativa correta'}
			>
				{gabarito.corretas.includes(item.id) ? '✓' : ''}
			</Button>
		{/snippet}
	</ListaEditavel>

	<label class="flex items-center gap-2 text-sm">
		<input
			type="checkbox"
			class="accent-primary size-4"
			checked={conteudo.permiteMultiplas}
			onchange={alternarMultiplas}
		/>
		Permitir mais de uma alternativa correta
	</label>

	<p class="text-muted-foreground text-xs">
		Use o botão à esquerda de cada alternativa para marcar a correta.
	</p>
</div>
