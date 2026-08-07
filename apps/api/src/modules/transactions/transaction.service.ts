import { sha256 } from "../../common/crypto";
import { AppError } from "../../common/errors";
import { inTransaction, type DbClient } from "../../infrastructure/database";
import { assertBalancedEntries, mapTransactionToEntries } from "../ledger/ledger-mapper";
import { assertAccountPostingLimits, insertPostedTransaction, resolveLedgerAccounts } from "./transaction.repository";
import type { TransactionMutationInput } from "./transaction.schemas";

export async function createTransactionWithClient(client: DbClient, userId: string, input: TransactionMutationInput) {
  const duplicate = await client.query(
    `SELECT id,book_id AS "bookId",transaction_no::text AS "transactionNo",
            transaction_type AS type,account_id AS "accountId",target_account_id AS "targetAccountId",
            title,status,currency_code AS "currencyCode",client_operation_id AS "clientOperationId",
            version,created_at AS "createdAt"
     FROM transactions WHERE book_id=$1 AND client_operation_id=$2`,
    [input.bookId,input.clientOperationId],
  );
  if (duplicate.rows[0]) return duplicate.rows[0];
  const resolved = await resolveLedgerAccounts(client,input);
  const entries = mapTransactionToEntries({...input,...resolved});
  assertBalancedEntries(entries);
  return insertPostedTransaction(client,userId,input,entries);
}

export async function createTransaction(pool: DbClient, userId: string, input: TransactionMutationInput, idempotencyKey?: string) {
  return inTransaction(pool,async (client) => {
    const requestHash = await sha256(JSON.stringify(input));
    let ownsKey = false;
    if (idempotencyKey) {
      if (idempotencyKey.length > 200) throw new AppError(422,"INVALID_IDEMPOTENCY_KEY","Idempotency-Key is too long");
      const inserted = await client.query(
        `INSERT INTO idempotency_keys(user_id,key,request_hash,locked_until,expires_at)
         VALUES($1,$2,$3,now()+interval '30 seconds',now()+interval '24 hours')
         ON CONFLICT DO NOTHING RETURNING id`,
        [userId,idempotencyKey,requestHash],
      );
      ownsKey = Boolean(inserted.rowCount);
      if (!ownsKey) {
        const existing = await client.query<{request_hash:string;response_body:unknown}>(
          `SELECT request_hash,response_body FROM idempotency_keys WHERE user_id=$1 AND key=$2 FOR UPDATE`,
          [userId,idempotencyKey],
        );
        const key = existing.rows[0]!;
        if (key.request_hash !== requestHash) throw new AppError(409,"IDEMPOTENCY_KEY_REUSED","Idempotency-Key was used with another payload");
        if (key.response_body) return key.response_body;
        throw new AppError(409,"REQUEST_IN_PROGRESS","A request with this key is still being processed");
      }
    }
    const result = await createTransactionWithClient(client,userId,input);
    if (idempotencyKey && ownsKey) {
      await client.query(
        `UPDATE idempotency_keys SET status_code=201,response_body=$3 WHERE user_id=$1 AND key=$2`,
        [userId,idempotencyKey,JSON.stringify(result)],
      );
    }
    return result;
  });
}

export async function reverseWithClient(
  client: DbClient,
  userId: string,
  bookId: string,
  transactionId: string,
  clientOperationId: string,
  reason: string,
  enforceLimits = true,
) {
  const originalResult = await client.query<any>(
    `SELECT * FROM transactions WHERE id=$1 AND book_id=$2 AND deleted_at IS NULL FOR UPDATE`,
    [transactionId,bookId],
  );
  const original = originalResult.rows[0];
  if (!original) throw new AppError(404,"TRANSACTION_NOT_FOUND","Transaction was not found");
  if (original.status === "REVERSED") {
    const prior = await client.query(
      `SELECT id,book_id AS "bookId",transaction_type AS type,title,
              transaction_date AS "transactionDate",status,currency_code AS "currencyCode",
              client_operation_id AS "clientOperationId",version
       FROM transactions WHERE reverses_transaction_id=$1`,
      [transactionId],
    );
    return prior.rows[0];
  }
  if (original.status !== "POSTED" || original.transaction_type === "REVERSAL") {
    throw new AppError(409,"TRANSACTION_NOT_POSTED","Only posted transactions can be reversed");
  }
  const duplicate = await client.query(`SELECT id FROM transactions WHERE book_id=$1 AND client_operation_id=$2`,[bookId,clientOperationId]);
  if (duplicate.rows[0]) throw new AppError(409,"CLIENT_OPERATION_REUSED","Client operation id was already used");
  if (enforceLimits) {
    const originalEntries = await client.query<{account_id:string;direction:"DEBIT"|"CREDIT";amount:string;currency_code:string;base_amount:string}>(
      `SELECT account_id,direction,amount::text,currency_code,base_amount::text FROM transaction_entries WHERE transaction_id=$1`,
      [transactionId],
    );
    await assertAccountPostingLimits(client,originalEntries.rows.map(entry=>({
      accountId:entry.account_id,direction:entry.direction==="DEBIT"?"CREDIT":"DEBIT",
      amount:entry.amount,currencyCode:entry.currency_code,baseAmount:entry.base_amount,
    })));
  }

  const reversal = await client.query(
    `INSERT INTO transactions(
       book_id,transaction_type,account_id,target_account_id,title,description,transaction_date,
       status,currency_code,client_operation_id,reverses_transaction_id,created_by
     ) VALUES($1,'REVERSAL',$2,$3,$4,$5,now(),'POSTED',$6,$7,$8,$9)
     RETURNING id,book_id AS "bookId",transaction_no::text AS "transactionNo",transaction_type AS type,
       account_id AS "accountId",target_account_id AS "targetAccountId",title,
       transaction_date AS "transactionDate",status,currency_code AS "currencyCode",
       client_operation_id AS "clientOperationId",version,created_at AS "createdAt"`,
    [bookId,original.account_id,original.target_account_id,`İptal: ${original.title}`,reason,original.currency_code,clientOperationId,transactionId,userId],
  );
  const sourceEntry = await client.query<{account_id:string;amount:string}>(
    `SELECT account_id,amount::text FROM transaction_entries
     WHERE transaction_id=$1 ORDER BY (account_id=$2) DESC,created_at,id LIMIT 1`,
    [transactionId,original.account_id],
  );
  await client.query(
    `INSERT INTO transaction_entries(transaction_id,account_id,direction,amount,currency_code,base_amount)
     SELECT $1,account_id,CASE direction WHEN 'DEBIT' THEN 'CREDIT' ELSE 'DEBIT' END,
            amount,currency_code,base_amount
     FROM transaction_entries WHERE transaction_id=$2`,
    [reversal.rows[0].id,transactionId],
  );
  await client.query(`UPDATE transactions SET status='REVERSED',updated_at=now(),version=version+1 WHERE id=$1`,[transactionId]);
  const common = {amount:sourceEntry.rows[0]!.amount,accountId:original.account_id,targetAccountId:original.target_account_id};
  const originalPayload = {
    id:original.id,bookId:original.book_id,type:original.transaction_type,title:original.title,
    transactionDate:original.transaction_date,status:"REVERSED",currencyCode:original.currency_code,
    clientOperationId:original.client_operation_id,categoryId:original.category_id,contactId:original.contact_id,
    version:original.version+1,...common,
  };
  const reversalPayload = {...reversal.rows[0],categoryId:null,contactId:null,...common};
  await client.query(
    `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,old_values,new_values)
     VALUES($1,$2,'TRANSACTION',$3,'REVERSE',$4,$5)`,
    [bookId,userId,transactionId,JSON.stringify({status:"POSTED"}),JSON.stringify({status:"REVERSED",reversalId:reversal.rows[0].id,reason})],
  );
  await client.query(
    `INSERT INTO sync_changes(book_id,entity_type,entity_id,action,entity_version,payload)
     VALUES($1,'TRANSACTION',$2,'UPSERT',$3,$4),($1,'TRANSACTION',$5,'UPSERT',1,$6)`,
    [bookId,transactionId,original.version+1,JSON.stringify(originalPayload),reversal.rows[0].id,JSON.stringify(reversalPayload)],
  );
  return reversalPayload;
}

export async function reverseTransaction(pool: DbClient, userId: string, bookId: string, transactionId: string, clientOperationId: string, reason: string) {
  return inTransaction(pool,(client) => reverseWithClient(client,userId,bookId,transactionId,clientOperationId,reason));
}

export async function correctTransaction(
  pool: DbClient,
  userId: string,
  bookId: string,
  transactionId: string,
  reversalClientOperationId: string,
  reason: string,
  replacement: TransactionMutationInput,
) {
  if (replacement.bookId !== bookId) throw new AppError(422,"BOOK_MISMATCH","Replacement must belong to the same book");
  return inTransaction(pool,async (client) => {
    const reversal = await reverseWithClient(client,userId,bookId,transactionId,reversalClientOperationId,reason,false);
    const corrected = await createTransactionWithClient(client,userId,replacement);
    return {reversal,transaction:corrected};
  });
}
