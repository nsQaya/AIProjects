import pg from "pg";
import type { Env } from "../config/bindings";

export type DbClient = pg.Client | pg.Pool;

export function database(env: Env): pg.Client {
  return new pg.Client({ connectionString: env.HYPERDRIVE.connectionString, connectionTimeoutMillis: 10_000 });
}

export async function withDatabase<T>(env: Env, action: (client: DbClient) => Promise<T>): Promise<T> {
  const client = database(env);
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.end();
  }
}

export async function inTransaction<T>(client: DbClient, action: (client: DbClient) => Promise<T>): Promise<T> {
  const pooledClient = client instanceof pg.Pool ? await client.connect() : undefined;
  const transactionClient = pooledClient ?? client;
  await transactionClient.query("BEGIN");
  try {
    const result = await action(transactionClient);
    await transactionClient.query("COMMIT");
    return result;
  } catch (error) {
    await transactionClient.query("ROLLBACK");
    throw error;
  } finally {
    pooledClient?.release();
  }
}
