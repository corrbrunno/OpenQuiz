<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { ROTULOS_TIPO, TIPOS_PERGUNTA, type TipoPergunta } from '$lib/quiz/tipos';

	let {
		valor,
		onMudar
	}: { valor: TipoPergunta; onMudar: (tipo: TipoPergunta) => void } = $props();
</script>

<div class="flex flex-wrap gap-2" role="group" aria-label="Tipo de pergunta">
	{#each TIPOS_PERGUNTA as tipo (tipo)}
		<Button
			variant={valor === tipo ? 'default' : 'outline'}
			size="sm"
			onclick={() => onMudar(tipo)}
			aria-pressed={valor === tipo}
		>
			{ROTULOS_TIPO[tipo]}
		</Button>
	{/each}
</div>
