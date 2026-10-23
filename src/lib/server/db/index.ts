import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '$env/dynamic/private';
import * as schema from './schema';

let client: ReturnType<typeof postgres> | undefined;
let database: PostgresJsDatabase<typeof schema> | undefined;

export function isDbConfigured(): boolean {
	return Boolean(env.DATABASE_URL);
}

export function getDb(): PostgresJsDatabase<typeof schema> {
	if (!database) {
		if (!env.DATABASE_URL) throw new Error('DATABASE_URL is not set');

		// pooler do Neon exige prepare: false.
		// max: 1 só faz sentido em função serverless (uma invocação = um request). Num servidor
		// Node de verdade, com SSE e vários usuários, uma conexão só serializa tudo: se ela morre
		// (o Neon suspende o compute depois de alguns minutos ocioso) a fila inteira trava.
		// idle_timeout/keep_alive reciclam socket morto antes de o Neon derrubar a conexão.
		const maxConexoes = Number(env.DATABASE_MAX_CONEXOES ?? 8);

		client = postgres(env.DATABASE_URL, {
			prepare: false,
			max: Number.isFinite(maxConexoes) && maxConexoes > 0 ? maxConexoes : 8,
			connect_timeout: 10,
			idle_timeout: 20,
			max_lifetime: 60 * 10,
			keep_alive: 30
		});
		database = drizzle(client, { schema });
	}
	return database;
}
