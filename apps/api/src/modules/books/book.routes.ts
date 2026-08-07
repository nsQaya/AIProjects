import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { database } from "../../infrastructure/database";
import { parseJson } from "../../common/validation";
import { AppError } from "../../common/errors";
import { requireBookRole } from "../../middleware/book-access";
import { addMemberSchema, createBookSchema } from "./book.schemas";
import { addBookMember, createBook } from "./book.service";

export const bookRoutes = new Hono<AppEnv>();
bookRoutes.get("/", async (c) => {
  const result = await c.get("database").query(
    `SELECT b.id,b.name,b.book_type AS "bookType",b.base_currency AS "baseCurrency",m.role,b.version
     FROM books b JOIN book_members m ON m.book_id=b.id
     WHERE m.user_id=$1 AND m.status='ACTIVE' AND m.deleted_at IS NULL AND b.deleted_at IS NULL ORDER BY b.created_at`, [c.get("user").id],
  );
  return c.json({ items: result.rows });
});
bookRoutes.post("/", async (c) => c.json(await createBook(c.get("database"), c.get("user").id, await parseJson(c.req.raw, createBookSchema)), 201));
bookRoutes.get("/:bookId", async (c) => {
  const pool = c.get("database"); await requireBookRole(pool, c.req.param("bookId"), c.get("user").id, "VIEWER");
  const result = await pool.query(`SELECT id,name,book_type AS "bookType",base_currency AS "baseCurrency",version FROM books WHERE id=$1 AND deleted_at IS NULL`, [c.req.param("bookId")]);
  if (!result.rows[0]) throw new AppError(404, "BOOK_NOT_FOUND", "Book was not found"); return c.json(result.rows[0]);
});
bookRoutes.get("/:bookId/members", async (c) => {
  const pool=c.get("database"); await requireBookRole(pool,c.req.param("bookId"),c.get("user").id,"VIEWER");
  const result=await pool.query(`SELECT m.id,m.user_id AS "userId",u.email,u.display_name AS "displayName",m.role,m.status,m.version FROM book_members m JOIN users u ON u.id=m.user_id WHERE m.book_id=$1 AND m.deleted_at IS NULL`,[c.req.param("bookId")]);
  return c.json({items:result.rows});
});
bookRoutes.post("/:bookId/members", async (c) => {
  const pool=c.get("database"); const bookId=c.req.param("bookId"); await requireBookRole(pool,bookId,c.get("user").id,"ADMIN");
  return c.json(await addBookMember(pool,bookId,c.get("user").id,await parseJson(c.req.raw,addMemberSchema)),201);
});

