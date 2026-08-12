import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppEnv } from "./config/bindings";
import { errorResponse } from "./common/errors";
import { requestContext } from "./middleware/request-context";
import { databaseConnection } from "./middleware/database-connection";
import { authenticate } from "./middleware/auth";
import { authRoutes } from "./modules/auth/auth.routes";
import { userRoutes } from "./modules/users/user.routes";
import { bookRoutes } from "./modules/books/book.routes";
import { accountRoutes } from "./modules/accounts/account.routes";
import { categoryRoutes } from "./modules/categories/category.routes";
import { costCenterRoutes } from "./modules/cost-centers/cost-center.routes";
import { contactRoutes } from "./modules/contacts/contact.routes";
import { transactionRoutes } from "./modules/transactions/transaction.routes";
import { scheduledRoutes } from "./modules/scheduled-transactions/scheduled.routes";
import { recurringRoutes } from "./modules/recurring-transactions/recurring.routes";
import { reportRoutes } from "./modules/reports/report.routes";
import { syncRoutes } from "./modules/sync/sync.routes";
import { investmentRoutes } from "./modules/investments/investment.routes";
import { openApiYaml } from "./docs/openapi";
import { withDatabase } from "./infrastructure/database";

export const app = new Hono<AppEnv>();
app.use("*", requestContext);
app.use("*", async (c, next) => {
  const allowList = (c.env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()).filter(Boolean);
  return cors({ origin: (origin) => allowList.includes(origin) ? origin : "", allowHeaders: ["Authorization","Content-Type","Idempotency-Key","X-Request-Id"], allowMethods: ["GET","POST","PATCH","DELETE","OPTIONS"], maxAge: 86400 })(c, next);
});
app.get("/health", (c) => c.json({ status: "ok" }));
app.get("/health/ready", async (c) => {
  const secretBytes = new TextEncoder().encode(c.env.JWT_SECRET || "").byteLength;
  const pepperBytes = new TextEncoder().encode(c.env.REFRESH_TOKEN_PEPPER || "").byteLength;
  const passwordResetPepperBytes = new TextEncoder().encode(c.env.PASSWORD_RESET_TOKEN_PEPPER || "").byteLength;
  try {
    const result = await withDatabase(c.env, (client) => client.query<{
      migration_count: number;
      schema_ready: boolean;
      tables_ready: boolean;
      sequence_ready: boolean;
    }>(`SELECT
      (SELECT COUNT(*)::int FROM schema_migrations) AS migration_count,
      to_regclass('public.users') IS NOT NULL AND to_regclass('public.transactions') IS NOT NULL
        AND to_regclass('public.cost_centers') IS NOT NULL
        AND to_regclass('public.password_reset_tokens') IS NOT NULL
        AND to_regclass('public.investment_lots') IS NOT NULL AS schema_ready,
      has_table_privilege(current_user,'public.users','SELECT,INSERT')
        AND has_table_privilege(current_user,'public.transactions','SELECT,INSERT,UPDATE,DELETE')
        AND has_table_privilege(current_user,'public.cost_centers','SELECT,INSERT,UPDATE,DELETE')
        AND has_table_privilege(current_user,'public.password_reset_tokens','SELECT,INSERT,UPDATE,DELETE')
        AND has_table_privilege(current_user,'public.investment_lots','SELECT,INSERT,UPDATE,DELETE') AS tables_ready,
      has_sequence_privilege(current_user,'public.transaction_number_seq','USAGE') AS sequence_ready`));
    const checks = result.rows[0]!;
    const ready = checks.migration_count === 15 && checks.schema_ready && checks.tables_ready
      && checks.sequence_ready && secretBytes >= 32 && pepperBytes >= 32 && passwordResetPepperBytes >= 32;
    return c.json({ status: ready ? "ready" : "not_ready", checks: {
      database: true,
      migrations: checks.migration_count === 15,
      schema: checks.schema_ready,
      tablePrivileges: checks.tables_ready,
      sequencePrivileges: checks.sequence_ready,
      authSecrets: secretBytes >= 32 && pepperBytes >= 32 && passwordResetPepperBytes >= 32
    } }, ready ? 200 : 503);
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "DB_UNAVAILABLE";
    console.error(JSON.stringify({ level: "error", requestId: c.get("requestId"), dependency: "database", code }));
    return c.json({ status: "not_ready", checks: { database: false }, code }, 503);
  }
});
app.get("/api/v1/openapi.yaml", (c) => c.text(openApiYaml, 200, { "Content-Type": "application/yaml; charset=utf-8" }));
app.use("/api/v1/*", async (c,next) => { await next(); c.header("Cache-Control","no-store, private"); });
app.use("/api/v1/*", databaseConnection);
app.route("/api/v1/auth", authRoutes);
app.use("/api/v1/*", authenticate);
app.route("/api/v1/me", userRoutes);
app.route("/api/v1/books", bookRoutes);
app.route("/api/v1/accounts", accountRoutes);
app.route("/api/v1/categories", categoryRoutes);
app.route("/api/v1/cost-centers", costCenterRoutes);
app.route("/api/v1/contacts", contactRoutes);
app.route("/api/v1/transactions", transactionRoutes);
app.route("/api/v1/scheduled-transactions", scheduledRoutes);
app.route("/api/v1/recurring-transactions", recurringRoutes);
app.route("/api/v1/reports", reportRoutes);
app.route("/api/v1/investments", investmentRoutes);
app.route("/api/v1/sync", syncRoutes);
app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route was not found", requestId: c.get("requestId") } }, 404));
app.onError(errorResponse);
