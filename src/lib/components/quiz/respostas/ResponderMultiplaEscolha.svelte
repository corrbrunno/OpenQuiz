<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { montarResposta, type RascunhoResposta } from '$lib/quiz/rascunhos';
	import type { ConteudoDe, PerguntaSalva, RespostaComum } from '$lib/quiz/tipos';
	import { alternar } from '$lib/quiz/utils';

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

	const conteudo = $derived(pergunta.conteudo as ConteudoDe<'multipla-escolha'>);
	function marcadasIniciais(): string[] {
		return estadoInicial?.tipo === 'multipla-escolha' ? [...estadoInicial.marcadas] : [];
	}

	let marcadas = $state<string[]>(marcadasIniciais());

	function marcar(id: string) {
		if (desabilitado) return;

		if (conteudo.permiteMultiplas) alternar(marcadas, id);
		else marcadas = marcadas[0] === id ? [] : [id];

		responder(montarResposta(pergunta.id, { tipo: 'multipla-escolha', marcadas: [...marcadas] }));
	}
</script>

<div class="grid gap-2 sm:grid-cols-2">
	{#each conteudo.opcoes as opcao (opcao.id)}
		<Button
			variant={marcadas.includes(opcao.id) ? 'default' : 'outline'}
			class="h-auto justify-start py-3 text-left whitespace-normal"
			onclick={() => marcar(opcao.id)}
			disabled={desabilitado}
			aria-pressed={marcadas.includes(opcao.id)}
		>
			{opcao.texto}
		</Button>
	{/each}
</div>
