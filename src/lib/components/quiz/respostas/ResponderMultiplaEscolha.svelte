<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { montarResposta } from '$lib/quiz/rascunhos';
	import type { ConteudoDe, PerguntaSalva, RespostaComum } from '$lib/quiz/tipos';
	import { alternar } from '$lib/quiz/utils';

	let {
		pergunta,
		responder
	}: { pergunta: PerguntaSalva; responder: (resposta: RespostaComum) => void } = $props();

	const conteudo = $derived(pergunta.conteudo as ConteudoDe<'multipla-escolha'>);
	let marcadas = $state<string[]>([]);

	function marcar(id: string) {
		if (conteudo.permiteMultiplas) alternar(marcadas, id);
		else marcadas = marcadas[0] === id ? [] : [id];

		responder(montarResposta(pergunta.id, { tipo: 'multipla-escolha', marcadas }));
	}
</script>

<div class="grid gap-2 sm:grid-cols-2">
	{#each conteudo.opcoes as opcao (opcao.id)}
		<Button
			variant={marcadas.includes(opcao.id) ? 'default' : 'outline'}
			class="h-auto justify-start py-3 text-left whitespace-normal"
			onclick={() => marcar(opcao.id)}
			aria-pressed={marcadas.includes(opcao.id)}
		>
			{opcao.texto}
		</Button>
	{/each}
</div>
