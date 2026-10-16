<script lang="ts">
	import type { LinhaRanking } from '$lib/client/sessao';

	let {
		ranking,
		destaqueId = null,
		titulo = 'Placar'
	}: { ranking: LinhaRanking[]; destaqueId?: string | null; titulo?: string } = $props();
</script>

<div class="flex flex-col gap-2">
	<h3 class="text-sm font-semibold">{titulo}</h3>

	{#if ranking.length === 0}
		<p class="text-muted-foreground text-sm">Ninguém entrou na sala ainda.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="w-full text-sm">
				<thead>
					<tr class="text-muted-foreground border-b text-left">
						<th class="w-10 py-1">#</th>
						<th class="py-1">Quem</th>
						<th class="py-1 text-right">Acertos</th>
						<th class="py-1 text-right">Respondidas</th>
					</tr>
				</thead>
				<tbody>
					{#each ranking as linha, indice (linha.participanteId)}
						<tr
							class="border-b last:border-0"
							class:font-semibold={linha.participanteId === destaqueId}
						>
							<td class="py-1">{indice + 1}º</td>
							<td class="py-1">
								{linha.nome}
								{#if linha.participanteId === destaqueId}
									<span class="text-muted-foreground">(você)</span>
								{/if}
							</td>
							<td class="py-1 text-right">{linha.acertos}</td>
							<td class="py-1 text-right">{linha.respondidas}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>
