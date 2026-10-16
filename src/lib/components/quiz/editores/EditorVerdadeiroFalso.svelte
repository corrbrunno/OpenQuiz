<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import type { GabaritoDe } from '$lib/quiz/tipos';
	import type { RascunhoPergunta } from '$lib/quiz/rascunhos';

	let { rascunho }: { rascunho: RascunhoPergunta } = $props();

	const gabarito = $derived(rascunho.gabarito as GabaritoDe<'verdadeiro-falso'>);
	const OPCOES = [
		{ valor: 'verdadeiro' as const, rotulo: 'Verdadeiro' },
		{ valor: 'falso' as const, rotulo: 'Falso' }
	];
</script>

<div class="flex flex-col gap-2">
	<span class="text-sm font-medium">Resposta correta</span>
	<div class="flex gap-2">
		{#each OPCOES as opcao (opcao.valor)}
			<Button
				variant={gabarito.correta === opcao.valor ? 'default' : 'outline'}
				onclick={() => (gabarito.correta = opcao.valor)}
				aria-pressed={gabarito.correta === opcao.valor}
			>
				{opcao.rotulo}
			</Button>
		{/each}
	</div>
</div>
