import type { DbClient } from "../../infrastructure/database";
import { AppError } from "../../common/errors";
import type { TransactionMutationInput } from "./transaction.schemas";
import type { LedgerEntryDraft } from "../ledger/ledger.types";

export async function insertPostedTransaction(client:DbClient,userId:string,input:TransactionMutationInput,entries:LedgerEntryDraft[]){
  await assertAccountPostingLimits(client,entries);
  const tx=await client.query(`INSERT INTO transactions(book_id,transaction_type,account_id,target_account_id,category_id,cost_center_id,contact_id,title,description,transaction_date,due_date,status,currency_code,client_operation_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'POSTED',$12,$13,$14) RETURNING id,book_id AS "bookId",transaction_no::text AS "transactionNo",transaction_type AS type,account_id AS "accountId",target_account_id AS "targetAccountId",category_id AS "categoryId",cost_center_id AS "costCenterId",contact_id AS "contactId",title,description,transaction_date AS "transactionDate",due_date AS "dueDate",status,currency_code AS "currencyCode",client_operation_id AS "clientOperationId",version,created_at AS "createdAt"`,[input.bookId,input.type,input.accountId,input.targetAccountId??null,input.categoryId??null,input.costCenterId??null,input.contactId??null,input.title,input.description??null,input.transactionDate,input.dueDate??null,input.currencyCode,input.clientOperationId,userId]);
  const transaction={...tx.rows[0],amount:input.amount,accountId:input.accountId,targetAccountId:input.targetAccountId??null,categoryId:input.categoryId??null,costCenterId:input.costCenterId??null,contactId:input.contactId??null};
  for(const item of entries)await client.query(`INSERT INTO transaction_entries(transaction_id,account_id,direction,amount,currency_code,base_amount) VALUES($1,$2,$3,$4,$5,$6)`,[transaction.id,item.accountId,item.direction,item.amount,item.currencyCode,item.baseAmount]);
  await client.query(`INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values) VALUES($1,$2,'TRANSACTION',$3,'POST',$4)`,[input.bookId,userId,transaction.id,JSON.stringify(transaction)]);
  await client.query(`INSERT INTO sync_changes(book_id,entity_type,entity_id,action,entity_version,payload) VALUES($1,'TRANSACTION',$2,'UPSERT',$3,$4)`,[input.bookId,transaction.id,transaction.version,JSON.stringify(transaction)]);
  return transaction;
}

export async function assertAccountPostingLimits(client:DbClient,entries:LedgerEntryDraft[]){
  const grouped=new Map<string,{direction:"DEBIT"|"CREDIT";amount:string}>();
  for(const item of entries){
    const existing=grouped.get(item.accountId);
    if(existing)throw new AppError(422,"DUPLICATE_ACCOUNT_ENTRY","A transaction cannot post multiple entries to the same account");
    grouped.set(item.accountId,{direction:item.direction,amount:item.baseAmount});
  }
  const ids=[...grouped.keys()];
  const accounts=await client.query<{
    id:string;normal_balance:"DEBIT"|"CREDIT";allow_negative_balance:boolean;credit_limit:string|null;is_system:boolean;
  }>(`SELECT id,normal_balance,allow_negative_balance,credit_limit::text,is_system
      FROM accounts WHERE id=ANY($1::uuid[]) ORDER BY id FOR UPDATE`,[ids]);
  for(const account of accounts.rows){
    if(account.is_system)continue;
    const draft=grouped.get(account.id)!;
    const result=await client.query<{new_balance:string;allowed:boolean}>(
      `WITH current_balance AS (
         SELECT CASE WHEN $2='DEBIT'
           THEN COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.base_amount ELSE -e.base_amount END),0)
           ELSE COALESCE(SUM(CASE WHEN e.direction='CREDIT' THEN e.base_amount ELSE -e.base_amount END),0)
         END AS value
         FROM transaction_entries e JOIN transactions t ON t.id=e.transaction_id AND t.status IN ('POSTED','REVERSED')
         WHERE e.account_id=$1
       ), projected AS (
         SELECT value + CASE WHEN $2=$3 THEN $4::numeric ELSE -$4::numeric END AS value FROM current_balance
       )
       SELECT value::text AS new_balance,
         CASE
           WHEN $2='DEBIT' AND NOT $5::boolean THEN value>=0
           WHEN $2='DEBIT' AND $6::numeric IS NOT NULL THEN value>=-$6::numeric
           WHEN $2='CREDIT' AND NOT $5::boolean THEN value<=0
           WHEN $2='CREDIT' AND $6::numeric IS NOT NULL THEN value<=$6::numeric
           ELSE true
         END AS allowed
       FROM projected`,
      [account.id,account.normal_balance,draft.direction,draft.amount,account.allow_negative_balance,account.credit_limit],
    );
    if(!result.rows[0]!.allowed){
      const code=account.credit_limit==null?"NEGATIVE_BALANCE_NOT_ALLOWED":"ACCOUNT_LIMIT_EXCEEDED";
      throw new AppError(422,code,"Transaction would exceed the account balance rule");
    }
  }
}

export async function resolveLedgerAccounts(client:DbClient,input:TransactionMutationInput,options:{allowInactiveCostCenter?:boolean}={}){
  const ids=[input.accountId,input.targetAccountId].filter(Boolean) as string[];
  if(ids.length){const accounts=await client.query<{id:string}>(`SELECT id FROM accounts WHERE book_id=$1 AND id=ANY($2::uuid[]) AND deleted_at IS NULL AND is_archived=false`,[input.bookId,ids]);if(accounts.rowCount!==new Set(ids).size)throw new AppError(422,"ACCOUNT_UNAVAILABLE","An account is deleted, archived, or belongs to another book");}
  let categoryAccountId:string|undefined;
  if(input.categoryId){const expected=['INCOME','SALE'].includes(input.type)?'INCOME':'EXPENSE';const result=await client.query<{system_account_id:string}>(`SELECT system_account_id FROM categories WHERE id=$1 AND book_id=$2 AND category_type=$3 AND is_active=true AND deleted_at IS NULL`,[input.categoryId,input.bookId,expected]);if(!result.rows[0])throw new AppError(422,"CATEGORY_INVALID","Category is unavailable or has the wrong type");categoryAccountId=result.rows[0].system_account_id;}
  if(input.costCenterId){const result=await client.query(`SELECT 1 FROM cost_centers WHERE id=$1 AND book_id=$2 AND ($3::boolean OR is_active=true)`,[input.costCenterId,input.bookId,options.allowInactiveCostCenter===true]);if(!result.rowCount)throw new AppError(422,"COST_CENTER_INVALID","Cost center is unavailable or belongs to another book");}
  let contactAccountId:string|undefined;
  if(input.contactId){const result=await client.query<{id:string}>(`SELECT a.id FROM contacts c JOIN accounts a ON a.contact_id=c.id WHERE c.id=$1 AND c.book_id=$2 AND c.deleted_at IS NULL AND a.deleted_at IS NULL AND a.is_archived=false`,[input.contactId,input.bookId]);if(!result.rows[0])throw new AppError(422,"CONTACT_ACCOUNT_INVALID","Contact account is unavailable");contactAccountId=result.rows[0].id;}
  let equityAccountId:string|undefined;
  if(input.type==='OPENING_BALANCE'){const result=await client.query<{id:string}>(`SELECT id FROM accounts WHERE book_id=$1 AND account_type='SYSTEM_EQUITY' AND deleted_at IS NULL LIMIT 1`,[input.bookId]);equityAccountId=result.rows[0]?.id;}
  return{categoryAccountId,contactAccountId,equityAccountId};
}
