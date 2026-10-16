<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { montarResposta, type RascunhoResposta } from '$lib/quiz/rascunhos';
	import type { PerguntaSalva, RespostaComum } from '$lib/quiz/tipos';

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

	function escolhaInicial(): 'verdadeiro' | 'falso' | null {
		return estadoInicial?.tipo === 'verdadeiro-falso' ? estadoInicial.escolha : null;
	}

	let escolha = $state<'verdadeiro' | 'falso' | null>(escolhaInicial());

	const OPCOES = [
		{ valor: 'verdadeiro' as const, rotulo: 'Verdadeiro' },
		{ valor: 'falso' as const, rotulo: 'Falso' }
	];

	function marcar(valor: 'verdadeiro' | 'falso') {
		if (desabilitado) return;

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
			disabled={desabilitado}
			aria-pressed={escolha === opcao.valor}
		>
			{opcao.rotulo}
		</Button>
	{/each}
</div>
