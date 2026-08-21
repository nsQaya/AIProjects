import { AppError } from "../../common/errors";
import { inTransaction, type DbClient } from "../../infrastructure/database";
import type { CreateAccountTypeInput, UpdateAccountTypeInput } from "./account-type.schemas";

const projection = `id,book_id AS "bookId",name,icon,normal_balance AS "normalBalance",
  default_allow_negative_balance AS "defaultAllowNegativeBalance",purpose,
  is_system AS "isSystem",is_active AS "isActive",sort_order AS "sortOrder",version`;

export async function listAccountTypes(client: DbClient, bookId: string, includeInactive = false) {
  const result = await client.query(
    `SELECT ${projection} FROM account_types
     WHERE book_id=$1 AND deleted_at IS NULL AND ($2::boolean OR is_active=true)
     ORDER BY sort_order,name`,
    [bookId, includeInactive],
  );
  return { items: result.rows };
}

export async function accountTypeBookId(client: DbClient, id: string) {
  const result = await client.query<{ book_id: string }>(
    `SELECT book_id FROM account_types WHERE id=$1 AND deleted_at IS NULL`,
    [id],
  );
  if (!result.rows[0]) throw new AppError(404, "ACCOUNT_TYPE_NOT_FOUND", "Account type was not found");
  return result.rows[0].book_id;
}

export async function createAccountType(client: DbClient, userId: string, input: CreateAccountTypeInput) {
  return inTransaction(client, async (transaction) => {
    const result = await transaction.query(
      `INSERT INTO account_types(book_id,name,icon,normal_balance,default_allow_negative_balance,sort_order)
       VALUES($1,$2,$3,$4,$5,$6) RETURNING ${projection}`,
      [input.bookId,input.name,input.icon??null,input.normalBalance,input.defaultAllowNegativeBalance,input.sortOrder],
    );
    await audit(transaction,input.bookId,userId,result.rows[0].id,"CREATE",result.rows[0]);
    return result.rows[0];
  });
}

export async function updateAccountType(client: DbClient, userId: string, id: string, input: UpdateAccountTypeInput) {
  return inTransaction(client, async (transaction) => {
    const found = await transaction.query<{ book_id: string; is_system: boolean; purpose: string | null }>(
      `SELECT book_id,is_system,purpose FROM account_types WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    const accountType = found.rows[0];
    if (!accountType) throw new AppError(404, "ACCOUNT_TYPE_NOT_FOUND", "Account type was not found");
    if (accountType.purpose !== null && input.normalBalance !== undefined) {
      throw new AppError(422, "SYSTEM_ACCOUNT_TYPE_IMMUTABLE_BALANCE", "This account type's balance direction is fixed by the system and cannot change");
    }

    const result = await transaction.query(
      `UPDATE account_types SET
         name=COALESCE($2,name),
         icon=CASE WHEN $3::boolean THEN $4 ELSE icon END,
         normal_balance=COALESCE($5,normal_balance),
         default_allow_negative_balance=COALESCE($6,default_allow_negative_balance),
         sort_order=COALESCE($7,sort_order),is_active=COALESCE($8,is_active),
         updated_at=now(),version=version+1
       WHERE id=$1 AND version=$9 RETURNING ${projection}`,
      [id,input.name??null,input.icon!==undefined,input.icon??null,input.normalBalance??null,input.defaultAllowNegativeBalance??null,input.sortOrder??null,input.isActive??null,input.version],
    );
    if (!result.rows[0]) throw new AppError(409, "VERSION_CONFLICT", "Account type changed on another device");
    await audit(transaction,accountType.book_id,userId,id,"UPDATE",result.rows[0]);
    return result.rows[0];
  });
}

export async function deleteOrDeactivateAccountType(client: DbClient, userId: string, id: string, version: number) {
  return inTransaction(client, async (transaction) => {
    const found = await transaction.query<{ book_id: string; is_system: boolean }>(
      `SELECT book_id,is_system FROM account_types WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    const accountType = found.rows[0];
    if (!accountType) throw new AppError(404, "ACCOUNT_TYPE_NOT_FOUND", "Account type was not found");
    const used = await transaction.query(`SELECT 1 FROM accounts WHERE account_type_id=$1 AND deleted_at IS NULL LIMIT 1`, [id]);
    const mustDeactivateOnly = accountType.is_system || used.rowCount;
    const result = mustDeactivateOnly
      ? await transaction.query(`UPDATE account_types SET is_active=false,updated_at=now(),version=version+1 WHERE id=$1 AND version=$2 RETURNING id,false AS "isActive",version`, [id, version])
      : await transaction.query(`UPDATE account_types SET is_active=false,deleted_at=now(),updated_at=now(),version=version+1 WHERE id=$1 AND version=$2 RETURNING id,true AS deleted,version`, [id, version]);
    if (!result.rows[0]) throw new AppError(409, "VERSION_CONFLICT", "Account type changed on another device");
    await audit(transaction,accountType.book_id,userId,id,mustDeactivateOnly?"DEACTIVATE":"DELETE",result.rows[0]);
    return result.rows[0];
  });
}

async function audit(client: DbClient, bookId: string, userId: string, entityId: string, action: string, value: unknown) {
  await client.query(
    `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values) VALUES($1,$2,'ACCOUNT_TYPE',$3,$4,$5)`,
    [bookId,userId,entityId,action,JSON.stringify(value)],
  );
}
