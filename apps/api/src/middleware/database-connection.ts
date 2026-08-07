import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../config/bindings";
import { database } from "../infrastructure/database";

export const databaseConnection = createMiddleware<AppEnv>(async (c, next) => {
  const client = database(c.env);
  await client.connect();
  c.set("database", client);
  try {
    await next();
  } finally {
    await client.end();
  }
});
