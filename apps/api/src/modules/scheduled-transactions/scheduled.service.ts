import { AppError } from "../../common/errors";
import { inTransaction, type DbClient } from "../../infrastructure/database";
import type { CreateScheduledInput, UpdateScheduledInput } from "./scheduled.schemas";
import { createTransactionWithClient } from "../transactions/transaction.service";
import { advanceRecurrence, type Frequency } from "../recurring-transactions/recurrence";

const projection = `id,book_id AS "bookId",account_id AS "accountId",target_account_id AS "targetAccountId",
  transaction_type AS "transactionType",category_id AS "categoryId",
  cost_center_id AS "costCenterId",
  (SELECT name FROM cost_centers cc WHERE cc.id=scheduled_transactions.cost_center_id) AS "costCenterName",
  contact_id AS "contactId",
  title,amount::text,currency_code AS "currencyCode",scheduled_at AS "scheduledAt",
  reminder_at AS "reminderAt",status,series_id AS "seriesId",
  recurrence_frequency AS "recurrenceFrequency",recurrence_interval AS "recurrenceInterval",
  recurrence_end_at AS "recurrenceEndAt",completed_transaction_id AS "completedTransactionId",version`;

export async function listScheduled(client: DbClient, bookId: string, includeCompleted = false) {
  await client.query(
    `UPDATE scheduled_transactions SET status='OVERDUE',updated_at=now(),version=version+1
     WHERE book_id=$1 AND status='PENDING' AND scheduled_at<now()`,
    [bookId],
  );
  const result = await client.query(
    `SELECT ${projection} FROM scheduled_transactions
     WHERE book_id=$1 AND deleted_at IS NULL
       AND (status IN ('PENDING','OVERDUE') OR ($2::boolean AND status='COMPLETED'))
     ORDER BY CASE WHEN status IN ('PENDING','OVERDUE') THEN 0 ELSE 1 END,
              CASE WHEN status IN ('PENDING','OVERDUE') THEN scheduled_at END,
              scheduled_at DESC`,
    [bookId,includeCompleted],
  );
  const groups: Record<"overdue"|"today"|"thisWeek"|"thisMonth"|"later", unknown[]> = { overdue:[],today:[],thisWeek:[],thisMonth:[],later:[] };
  const now = new Date();
  const todayEnd = Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);
  const weekEnd = todayEnd + 6*86_400_000;
  const monthEnd = Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,1);
  for (const item of result.rows) {
    const at = new Date(item.scheduledAt).getTime();
    if (item.status === "OVERDUE" || at < Date.now()) groups.overdue.push(item);
    else if (at < todayEnd) groups.today.push(item);
    else if (at < weekEnd) groups.thisWeek.push(item);
    else if (at < monthEnd) groups.thisMonth.push(item);
    else groups.later.push(item);
  }
  return { items: result.rows, groups };
}

export async function createScheduled(client: DbClient, userId: string, input: CreateScheduledInput) {
  return inTransaction(client, async (transaction) => {
    await validateScope(transaction,input.bookId,input.accountId,input.targetAccountId,input.categoryId,input.transactionType,input.costCenterId);
    const occurrences = recurrenceDates(input);
    const seriesId = input.recurrence ? crypto.randomUUID() : null;
    const created = [];
    for (const scheduledAt of occurrences) {
      const result = await transaction.query(
        `INSERT INTO scheduled_transactions(
           book_id,account_id,target_account_id,transaction_type,category_id,cost_center_id,contact_id,title,
           amount,currency_code,scheduled_at,reminder_at,series_id,recurrence_frequency,
           recurrence_interval,recurrence_end_at
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING ${projection}`,
        [input.bookId,input.accountId,input.targetAccountId??null,input.transactionType,input.categoryId??null,input.costCenterId??null,input.contactId??null,input.title,input.amount,input.currencyCode,scheduledAt,input.reminderAt??null,seriesId,input.recurrence?.frequency??null,input.recurrence?.interval??null,input.recurrence?.until??null],
      );
      created.push(result.rows[0]);
      await audit(transaction,input.bookId,userId,result.rows[0].id,"CREATE",result.rows[0]);
    }
    return {...created[0],createdCount:created.length};
  });
}

function recurrenceDates(input: CreateScheduledInput) {
  if (!input.recurrence) return [input.scheduledAt];
  const start = new Date(input.scheduledAt);
  const end = new Date(input.recurrence.until);
  const values: string[] = [];
  for (let occurrence = 0; ; occurrence += 1) {
    const date = occurrence === 0
      ? start
      : advanceRecurrence(start,input.recurrence.frequency as Frequency,input.recurrence.interval*occurrence);
    if (date > end) break;
    if (values.length >= 240) throw new AppError(422,"RECURRENCE_TOO_LONG","A recurring plan can contain at most 240 occurrences");
    values.push(date.toISOString());
  }
  return values;
}

export async function updateScheduled(client: DbClient, userId: string, scheduledId: string, input: UpdateScheduledInput) {
  return inTransaction(client, async (transaction) => {
    const found = await transaction.query<{ book_id: string; account_id: string; target_account_id: string | null; category_id: string | null; cost_center_id: string | null; transaction_type:string }>(
      `SELECT book_id,account_id,target_account_id,category_id,cost_center_id,transaction_type FROM scheduled_transactions
       WHERE id=$1 AND deleted_at IS NULL AND status IN ('PENDING','OVERDUE') FOR UPDATE`,
      [scheduledId],
    );
    const existing = found.rows[0];
    if (!existing) throw new AppError(404,"SCHEDULED_TRANSACTION_NOT_FOUND","Scheduled transaction was not found");
    await validateScope(
      transaction,existing.book_id,input.accountId??existing.account_id,
      input.targetAccountId===undefined?existing.target_account_id:input.targetAccountId,
      input.categoryId===undefined?existing.category_id:input.categoryId,
      input.transactionType??existing.transaction_type,
      input.costCenterId===undefined?existing.cost_center_id:input.costCenterId,
      input.costCenterId===undefined||input.costCenterId===existing.cost_center_id,
    );
    const result = await transaction.query(
      `UPDATE scheduled_transactions SET
         account_id=COALESCE($2,account_id),
         target_account_id=CASE WHEN $3::boolean THEN $4 ELSE target_account_id END,
         transaction_type=COALESCE($5,transaction_type),
         category_id=CASE WHEN $6::boolean THEN $7 ELSE category_id END,
         cost_center_id=CASE WHEN $8::boolean THEN $9 ELSE cost_center_id END,
         contact_id=CASE WHEN $10::boolean THEN $11 ELSE contact_id END,
         title=COALESCE($12,title),amount=COALESCE($13,amount),
         scheduled_at=COALESCE($14,scheduled_at),
         reminder_at=CASE WHEN $15::boolean THEN $16 ELSE reminder_at END,
         status=CASE WHEN status='OVERDUE' AND COALESCE($14,scheduled_at)>=now() THEN 'PENDING' ELSE status END,
         updated_at=now(),version=version+1
       WHERE id=$1 AND version=$17 RETURNING ${projection}`,
      [scheduledId,input.accountId??null,input.targetAccountId!==undefined,input.targetAccountId??null,input.transactionType??null,input.categoryId!==undefined,input.categoryId??null,input.costCenterId!==undefined,input.costCenterId??null,input.contactId!==undefined,input.contactId??null,input.title??null,input.amount??null,input.scheduledAt??null,input.reminderAt!==undefined,input.reminderAt??null,input.version],
    );
    if (!result.rows[0]) throw new AppError(409,"VERSION_CONFLICT","Scheduled transaction changed on another device");
    await audit(transaction,existing.book_id,userId,scheduledId,"UPDATE",result.rows[0]);
    return result.rows[0];
  });
}

export async function setScheduledStatus(client: DbClient, userId: string, scheduledId: string, status: string, version: number) {
  return inTransaction(client,async transaction=>{
    const found = await scheduledBookId(transaction,scheduledId);
    const result = await transaction.query(
      `UPDATE scheduled_transactions SET status=$2,updated_at=now(),version=version+1
       WHERE id=$1 AND version=$3 AND deleted_at IS NULL RETURNING id,status,version`,
      [scheduledId,status,version],
    );
    if (!result.rows[0]) throw new AppError(409,"VERSION_CONFLICT","Scheduled transaction changed on another device");
    await audit(transaction,found,userId,scheduledId,"STATUS",result.rows[0]);
    return result.rows[0];
  });
}

export async function realizeScheduled(
  client: DbClient,
  userId: string,
  scheduledId: string,
  input: { version: number; transactionDate?: string; clientOperationId: string },
) {
  return inTransaction(client,async transaction=>{
    const found = await transaction.query<{
      id:string;book_id:string;account_id:string;target_account_id:string|null;
      transaction_type:"INCOME"|"EXPENSE"|"TRANSFER"|"SALE"|"PURCHASE"|"COLLECTION"|"PAYMENT";
      category_id:string|null;cost_center_id:string|null;contact_id:string|null;title:string;amount:string;currency_code:string;
      scheduled_at:Date;status:string;version:number;completed_transaction_id:string|null;
    }>(
      `SELECT id,book_id,account_id,target_account_id,transaction_type,category_id,cost_center_id,contact_id,
              title,amount::text,currency_code,scheduled_at,status,version,completed_transaction_id
       FROM scheduled_transactions WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [scheduledId],
    );
    const item = found.rows[0];
    if (!item) throw new AppError(404,"SCHEDULED_TRANSACTION_NOT_FOUND","Scheduled transaction was not found");
    if (item.status === "COMPLETED" && item.completed_transaction_id) {
      return {id:item.id,status:item.status,version:item.version,completedTransactionId:item.completed_transaction_id};
    }
    if (!['PENDING','OVERDUE'].includes(item.status)) throw new AppError(409,"SCHEDULED_TRANSACTION_NOT_ACTIONABLE","Only pending or overdue plans can be realized");
    if (item.version !== input.version) throw new AppError(409,"VERSION_CONFLICT","Scheduled transaction changed on another device");

    const posted = await createTransactionWithClient(transaction,userId,{
      bookId:item.book_id,
      type:item.transaction_type,
      title:item.title,
      amount:item.amount,
      currencyCode:item.currency_code,
      accountId:item.account_id,
      ...(item.target_account_id?{targetAccountId:item.target_account_id}:{}),
      ...(item.category_id?{categoryId:item.category_id}:{}),
      ...(item.cost_center_id?{costCenterId:item.cost_center_id}:{}),
      ...(item.contact_id?{contactId:item.contact_id}:{}),
      transactionDate:input.transactionDate??new Date().toISOString(),
      clientOperationId:input.clientOperationId,
      description:"Yaklaşan işlemden gerçekleşti olarak aktarıldı",
    },{allowInactiveCostCenter:true});
    const updated = await transaction.query(
      `UPDATE scheduled_transactions SET status='COMPLETED',completed_transaction_id=$2,
              updated_at=now(),version=version+1
       WHERE id=$1 AND version=$3 AND status IN ('PENDING','OVERDUE') RETURNING ${projection}`,
      [scheduledId,posted.id,input.version],
    );
    if (!updated.rows[0]) throw new AppError(409,"VERSION_CONFLICT","Scheduled transaction changed on another device");
    await audit(transaction,item.book_id,userId,scheduledId,"REALIZE",{scheduled:updated.rows[0],transactionId:posted.id});
    return {scheduled:updated.rows[0],transaction:posted};
  });
}

export async function deleteScheduled(client: DbClient, userId: string, scheduledId: string, version: number) {
  return inTransaction(client,async transaction=>{
    const bookId = await scheduledBookId(transaction,scheduledId);
    const result = await transaction.query(
      `UPDATE scheduled_transactions SET status='CANCELLED',deleted_at=now(),updated_at=now(),version=version+1
       WHERE id=$1 AND version=$2 AND deleted_at IS NULL RETURNING id,true AS deleted,version`,
      [scheduledId,version],
    );
    if (!result.rows[0]) throw new AppError(409,"VERSION_CONFLICT","Scheduled transaction changed on another device");
    await audit(transaction,bookId,userId,scheduledId,"DELETE",result.rows[0]);
    return result.rows[0];
  });
}

export async function scheduledBookId(client: DbClient, scheduledId: string) {
  const result = await client.query<{ book_id: string }>(`SELECT book_id FROM scheduled_transactions WHERE id=$1 AND deleted_at IS NULL`,[scheduledId]);
  if (!result.rows[0]) throw new AppError(404,"SCHEDULED_TRANSACTION_NOT_FOUND","Scheduled transaction was not found");
  return result.rows[0].book_id;
}

async function validateScope(client: DbClient, bookId: string, accountId: string, targetAccountId?: string | null, categoryId?: string | null, transactionType?: string, costCenterId?: string | null, allowInactiveCostCenter=false) {
  const ids = [accountId,targetAccountId].filter(Boolean);
  const accounts = await client.query(`SELECT id FROM accounts WHERE book_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL AND is_archived=false`,[bookId,ids]);
  if (accounts.rowCount !== new Set(ids).size) throw new AppError(422,"ACCOUNT_UNAVAILABLE","Scheduled transaction account is unavailable");
  if (transactionType === "TRANSFER" && !targetAccountId) throw new AppError(422,"TRANSFER_TARGET_REQUIRED","Scheduled transfer target account is required");
  if (targetAccountId && targetAccountId === accountId) throw new AppError(422,"TRANSFER_ACCOUNTS_MUST_DIFFER","Source and target accounts must differ");
  if (categoryId) {
    const expected=["INCOME","SALE","COLLECTION"].includes(transactionType??"")?"INCOME":"EXPENSE";
    const category = await client.query(`SELECT 1 FROM categories WHERE id=$1 AND book_id=$2 AND category_type=$3 AND deleted_at IS NULL AND is_active=true`,[categoryId,bookId,expected]);
    if (!category.rowCount) throw new AppError(422,"CATEGORY_INVALID","Scheduled transaction category is unavailable");
  }
  if (costCenterId) {
    const costCenter = await client.query(`SELECT 1 FROM cost_centers WHERE id=$1 AND book_id=$2 AND ($3::boolean OR is_active=true)`,[costCenterId,bookId,allowInactiveCostCenter]);
    if (!costCenter.rowCount) throw new AppError(422,"COST_CENTER_INVALID","Scheduled transaction cost center is unavailable");
  }
}

async function audit(client: DbClient, bookId: string, userId: string, scheduledId: string, action: string, value: unknown) {
  await client.query(
    `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values)
     VALUES($1,$2,'SCHEDULED_TRANSACTION',$3,$4,$5)`,
    [bookId,userId,scheduledId,action,JSON.stringify(value)],
  );
}
