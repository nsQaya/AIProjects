import { AppError } from "../../common/errors";
import { inTransaction, type DbClient } from "../../infrastructure/database";
import type { CreateCategoryInput, UpdateCategoryInput } from "./category.schemas";

const projection = `id,book_id AS "bookId",parent_id AS "parentId",name,
  category_type AS "categoryType",icon,sort_order AS "sortOrder",
  is_system AS "isSystem",is_active AS "isActive",version`;

export async function listCategories(client: DbClient, bookId: string, includeInactive = false) {
  const result = await client.query(
    `SELECT ${projection} FROM categories
     WHERE book_id=$1 AND deleted_at IS NULL AND ($2::boolean OR is_active=true)
     ORDER BY category_type,sort_order,name`,
    [bookId,includeInactive],
  );
  return { items: result.rows };
}

export async function createCategory(client: DbClient, userId: string, input: CreateCategoryInput) {
  return inTransaction(client, async (transaction) => {
    if (input.parentId) await assertParent(transaction, input.bookId, input.categoryType, input.parentId);
    const account = await transaction.query<{ id: string }>(
      `INSERT INTO accounts(book_id,name,account_type,normal_balance,currency_code,is_system)
       VALUES($1,$2,$3,$4,$5,true) RETURNING id`,
      [input.bookId,`Category: ${input.name}`,input.categoryType==="INCOME"?"SYSTEM_INCOME":"SYSTEM_EXPENSE",input.categoryType==="INCOME"?"CREDIT":"DEBIT",input.currencyCode],
    );
    const result = await transaction.query(
      `INSERT INTO categories(book_id,parent_id,name,category_type,system_account_id,icon,sort_order)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING ${projection}`,
      [input.bookId,input.parentId??null,input.name,input.categoryType,account.rows[0]!.id,input.icon??null,input.sortOrder],
    );
    await audit(transaction,input.bookId,userId,result.rows[0].id,"CREATE",result.rows[0]);
    return result.rows[0];
  });
}

export async function updateCategory(client: DbClient, userId: string, categoryId: string, input: UpdateCategoryInput) {
  return inTransaction(client, async (transaction) => {
    const found = await transaction.query<{ book_id: string; category_type: "INCOME" | "EXPENSE"; system_account_id: string }>(
      `SELECT book_id,category_type,system_account_id FROM categories
       WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [categoryId],
    );
    const category = found.rows[0];
    if (!category) throw new AppError(404,"CATEGORY_NOT_FOUND","Category was not found");
    if (input.parentId === categoryId) throw new AppError(422,"INVALID_CATEGORY_PARENT","Category cannot be its own parent");
    if (input.parentId) await assertParent(transaction,category.book_id,category.category_type,input.parentId);

    const result = await transaction.query(
      `UPDATE categories SET
         parent_id=CASE WHEN $2::boolean THEN $3 ELSE parent_id END,
         name=COALESCE($4,name),icon=CASE WHEN $5::boolean THEN $6 ELSE icon END,
         sort_order=COALESCE($7,sort_order),is_active=COALESCE($8,is_active),
         updated_at=now(),version=version+1
       WHERE id=$1 AND version=$9 RETURNING ${projection}`,
      [categoryId,input.parentId!==undefined,input.parentId??null,input.name??null,input.icon!==undefined,input.icon??null,input.sortOrder??null,input.isActive??null,input.version],
    );
    if (!result.rows[0]) throw new AppError(409,"VERSION_CONFLICT","Category changed on another device");
    if (input.name) await transaction.query(`UPDATE accounts SET name=$2,updated_at=now(),version=version+1 WHERE id=$1`,[category.system_account_id,`Category: ${input.name}`]);
    await audit(transaction,category.book_id,userId,categoryId,"UPDATE",result.rows[0]);
    return result.rows[0];
  });
}

export async function deleteOrDeactivateCategory(client: DbClient, userId: string, categoryId: string, version: number) {
  return inTransaction(client, async (transaction) => {
    const found = await transaction.query<{ book_id: string; system_account_id: string }>(
      `SELECT book_id,system_account_id FROM categories WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [categoryId],
    );
    const category = found.rows[0];
    if (!category) throw new AppError(404,"CATEGORY_NOT_FOUND","Category was not found");
    const used = await transaction.query(
      `SELECT 1 FROM transactions WHERE category_id=$1
       UNION ALL SELECT 1 FROM scheduled_transactions WHERE category_id=$1 AND deleted_at IS NULL
       UNION ALL SELECT 1 FROM recurring_transactions WHERE category_id=$1 AND deleted_at IS NULL LIMIT 1`,
      [categoryId],
    );
    const result = used.rowCount
      ? await transaction.query(
          `UPDATE categories SET is_active=false,updated_at=now(),version=version+1
           WHERE id=$1 AND version=$2 RETURNING id,is_active AS "isActive",version`,
          [categoryId,version],
        )
      : await transaction.query(
          `UPDATE categories SET deleted_at=now(),is_active=false,updated_at=now(),version=version+1
           WHERE id=$1 AND version=$2 RETURNING id,true AS deleted,version`,
          [categoryId,version],
        );
    if (!result.rows[0]) throw new AppError(409,"VERSION_CONFLICT","Category changed on another device");
    if (!used.rowCount) await transaction.query(`UPDATE accounts SET deleted_at=now(),updated_at=now(),version=version+1 WHERE id=$1`,[category.system_account_id]);
    await audit(transaction,category.book_id,userId,categoryId,used.rowCount?"DEACTIVATE":"DELETE",result.rows[0]);
    return result.rows[0];
  });
}

export async function categoryBookId(client: DbClient, categoryId: string) {
  const result = await client.query<{ book_id: string }>(`SELECT book_id FROM categories WHERE id=$1 AND deleted_at IS NULL`,[categoryId]);
  if (!result.rows[0]) throw new AppError(404,"CATEGORY_NOT_FOUND","Category was not found");
  return result.rows[0].book_id;
}

async function assertParent(client: DbClient, bookId: string, categoryType: string, parentId: string) {
  const parent = await client.query(`SELECT 1 FROM categories WHERE id=$1 AND book_id=$2 AND category_type=$3 AND deleted_at IS NULL`,[parentId,bookId,categoryType]);
  if (!parent.rowCount) throw new AppError(422,"INVALID_CATEGORY_PARENT","Parent category is unavailable or has another type");
}

async function audit(client: DbClient, bookId: string, userId: string, categoryId: string, action: string, value: unknown) {
  await client.query(
    `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values)
     VALUES($1,$2,'CATEGORY',$3,$4,$5)`,
    [bookId,userId,categoryId,action,JSON.stringify(value)],
  );
}
