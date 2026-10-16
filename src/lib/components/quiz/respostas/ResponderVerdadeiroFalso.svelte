<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { montarResposta } from '$lib/quiz/rascunhos';
	import type { PerguntaSalva, RespostaComum } from '$lib/quiz/tipos';

	let {
		pergunta,
		responder
	}: { pergunta: PerguntaSalva; responder: (resposta: RespostaComum) => void } = $props();

	let escolha = $state<'verdadeiro' | 'falso' | null>(null);

	const OPCOES = [
		{ valor: 'verdadeiro' as const, rotulo: 'Verdadeiro' },
		{ valor: 'falso' as const, rotulo: 'Falso' }
	];

	function marcar(valor: 'verdadeiro' | 'falso') {
		escolha = escolha === valor ? null : valor;
		responder(montarResposta(pergunta.id, { tipo: 'verdadeiro-falso', escolha }));
	}
</script>

<div class="flex gap-2">
	{#each OPCOES as opcao (opcao.valor)}
		<Button
			variant={escolha === opcao.valor ? 'default' : 'outline'}
			class="min-w-32"
			onclick={() => marcar(opcao.valor)}
			aria-pressed={escolha === opcao.valor}
		>
			{opcao.rotulo}
		</Button>
	{/each}
</div>
