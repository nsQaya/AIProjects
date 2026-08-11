import { AppError } from "../../common/errors";
import { inTransaction, type DbClient } from "../../infrastructure/database";
import type { CreateCostCenterInput, UpdateCostCenterInput } from "./cost-center.schemas";

const projection = `id,book_id AS "bookId",name,description,sort_order AS "sortOrder",
  is_active AS "isActive",version`;

export async function listCostCenters(
  client: DbClient,
  bookId: string,
  includeInactive = false,
) {
  const result = await client.query(
    `SELECT ${projection} FROM cost_centers
     WHERE book_id=$1 AND ($2::boolean OR is_active=true)
     ORDER BY sort_order,name`,
    [bookId,includeInactive],
  );
  return { items: result.rows };
}

export async function createCostCenter(
  client: DbClient,
  userId: string,
  input: CreateCostCenterInput,
) {
  return inTransaction(client,async transaction=>{
    const result = await transaction.query(
      `INSERT INTO cost_centers(book_id,name,description,sort_order)
       VALUES($1,$2,$3,$4) RETURNING ${projection}`,
      [input.bookId,input.name,input.description??null,input.sortOrder],
    );
    await audit(transaction,input.bookId,userId,result.rows[0].id,"CREATE",result.rows[0]);
    return result.rows[0];
  });
}

export async function updateCostCenter(
  client: DbClient,
  userId: string,
  costCenterId: string,
  input: UpdateCostCenterInput,
) {
  return inTransaction(client,async transaction=>{
    const found = await transaction.query<{ book_id: string }>(
      `SELECT book_id FROM cost_centers WHERE id=$1 FOR UPDATE`,
      [costCenterId],
    );
    const costCenter = found.rows[0];
    if (!costCenter) throw new AppError(404,"COST_CENTER_NOT_FOUND","Cost center was not found");
    const result = await transaction.query(
      `UPDATE cost_centers SET name=COALESCE($2,name),
         description=CASE WHEN $3::boolean THEN $4 ELSE description END,
         sort_order=COALESCE($5,sort_order),is_active=COALESCE($6,is_active),
         updated_at=now(),version=version+1
       WHERE id=$1 AND version=$7 RETURNING ${projection}`,
      [costCenterId,input.name??null,input.description!==undefined,input.description??null,input.sortOrder??null,input.isActive??null,input.version],
    );
    if (!result.rows[0]) throw new AppError(409,"VERSION_CONFLICT","Cost center changed on another device");
    await audit(transaction,costCenter.book_id,userId,costCenterId,"UPDATE",result.rows[0]);
    return result.rows[0];
  });
}

export async function deleteOrDeactivateCostCenter(
  client: DbClient,
  userId: string,
  costCenterId: string,
  version: number,
) {
  return inTransaction(client,async transaction=>{
    const found = await transaction.query<{ book_id: string }>(
      `SELECT book_id FROM cost_centers WHERE id=$1 FOR UPDATE`,
      [costCenterId],
    );
    const costCenter = found.rows[0];
    if (!costCenter) throw new AppError(404,"COST_CENTER_NOT_FOUND","Cost center was not found");
    const used = await transaction.query(
      `SELECT 1 FROM transactions WHERE cost_center_id=$1
       UNION ALL SELECT 1 FROM scheduled_transactions WHERE cost_center_id=$1 LIMIT 1`,
      [costCenterId],
    );
    const result = used.rowCount
      ? await transaction.query(
          `UPDATE cost_centers SET is_active=false,updated_at=now(),version=version+1
           WHERE id=$1 AND version=$2 RETURNING id,is_active AS "isActive",version`,
          [costCenterId,version],
        )
      : await transaction.query(
          `DELETE FROM cost_centers WHERE id=$1 AND version=$2 RETURNING id,true AS deleted,version+1 AS version`,
          [costCenterId,version],
        );
    if (!result.rows[0]) throw new AppError(409,"VERSION_CONFLICT","Cost center changed on another device");
    await audit(transaction,costCenter.book_id,userId,costCenterId,used.rowCount?"DEACTIVATE":"DELETE",result.rows[0]);
    return result.rows[0];
  });
}

export async function costCenterBookId(client: DbClient, costCenterId: string) {
  const result = await client.query<{ book_id: string }>(
    `SELECT book_id FROM cost_centers WHERE id=$1`,
    [costCenterId],
  );
  if (!result.rows[0]) throw new AppError(404,"COST_CENTER_NOT_FOUND","Cost center was not found");
  return result.rows[0].book_id;
}

async function audit(
  client: DbClient,
  bookId: string,
  userId: string,
  costCenterId: string,
  action: string,
  value: unknown,
) {
  await client.query(
    `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values)
     VALUES($1,$2,'COST_CENTER',$3,$4,$5)`,
    [bookId,userId,costCenterId,action,JSON.stringify(value)],
  );
}
