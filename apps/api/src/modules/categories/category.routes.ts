import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { AppError } from "../../common/errors";
import { parseJson } from "../../common/validation";
import { requireBookRole } from "../../middleware/book-access";
import { createCategorySchema, updateCategorySchema } from "./category.schemas";
import { categoryBookId, createCategory, deleteOrDeactivateCategory, listCategories, updateCategory } from "./category.service";

export const categoryRoutes = new Hono<AppEnv>();

categoryRoutes.get("/", async (c) => {
  const client = c.get("database");
  const bookId = c.req.query("bookId") ?? "";
  await requireBookRole(client,bookId,c.get("user").id,"VIEWER");
  return c.json(await listCategories(client,bookId,c.req.query("includeInactive") === "true"));
});

categoryRoutes.post("/", async (c) => {
  const input = await parseJson(c.req.raw,createCategorySchema);
  const client = c.get("database");
  await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");
  return c.json(await createCategory(client,c.get("user").id,input),201);
});

categoryRoutes.patch("/:categoryId", async (c) => {
  const client = c.get("database");
  const categoryId = c.req.param("categoryId");
  await requireBookRole(client,await categoryBookId(client,categoryId),c.get("user").id,"EDITOR");
  return c.json(await updateCategory(client,c.get("user").id,categoryId,await parseJson(c.req.raw,updateCategorySchema)));
});

categoryRoutes.delete("/:categoryId", async (c) => {
  const client = c.get("database");
  const categoryId = c.req.param("categoryId");
  const version = Number(c.req.query("version"));
  if (!Number.isInteger(version) || version < 1) throw new AppError(422,"INVALID_VERSION","A positive version is required");
  await requireBookRole(client,await categoryBookId(client,categoryId),c.get("user").id,"EDITOR");
  return c.json(await deleteOrDeactivateCategory(client,c.get("user").id,categoryId,version));
});
