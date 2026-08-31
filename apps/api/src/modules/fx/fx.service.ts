import { AppError } from "../../common/errors";
import { inTransaction, type DbClient } from "../../infrastructure/database";
import { assertAccountPostingLimits } from "../transactions/transaction.repository";
import type { LedgerEntryDraft } from "../ledger/ledger.types";
import type { CreateFxConversionInput } from "./fx.schemas";

interface FxAccount {
  id: string;
  name: string;
  currency_code: string;
  normal_balance: "DEBIT" | "CREDIT";
}

const accountRow = `a.id,a.name,a.currency_code,a.normal_balance`;

function moneyText(value: string) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })
    : value;
}

/**
 * Records a currency conversion (buying or selling foreign cash) as a single
 * cross-currency ADJUSTMENT: the receiving account is debited its own amount,
 * the funding account credited its own amount, and both entries carry the same
 * base_amount (the TRY that actually moved) so the ledger still balances in the
 * book's base currency. One side must be the base currency (TRY); the effective
 * rate is derived from the two amounts and kept only in the description.
 */
export async function createFxConversion(client: DbClient, userId: string, input: CreateFxConversionInput) {
  return inTransaction(client, async (transaction) => {
    const duplicate = await transaction.query<{ id: string }>(
      `SELECT id FROM transactions WHERE book_id=$1 AND client_operation_id=$2`,
      [input.bookId, input.clientOperationId],
    );
    if (duplicate.rows[0]) return findFxConversion(transaction, duplicate.rows[0].id);

    if (input.fromAccountId === input.toAccountId) {
      throw new AppError(422, "FX_SAME_ACCOUNT", "Kaynak ve hedef hesap farklı olmalı");
    }
    const accounts = await transaction.query<FxAccount>(
      `SELECT ${accountRow} FROM accounts a
       WHERE a.book_id=$1 AND a.id=ANY($2::uuid[]) AND a.is_system=false AND a.is_archived=false AND a.deleted_at IS NULL`,
      [input.bookId, [input.fromAccountId, input.toAccountId]],
    );
    const from = accounts.rows.find((row) => row.id === input.fromAccountId);
    const to = accounts.rows.find((row) => row.id === input.toAccountId);
    if (!from || !to) throw new AppError(422, "ACCOUNT_UNAVAILABLE", "An account is deleted, archived, or belongs to another book");
    if (from.currency_code === to.currency_code) {
      throw new AppError(422, "FX_SAME_CURRENCY", "İki hesap da aynı para biriminde; döviz dönüşümü gerekmez");
    }
    if (from.currency_code !== "TRY" && to.currency_code !== "TRY") {
      throw new AppError(422, "FX_REQUIRES_BASE_LEG", "Döviz dönüşümünün bir tarafı TL hesabı olmalı");
    }
    const tryAmount = to.currency_code === "TRY" ? input.toAmount : input.fromAmount;
    const foreignCurrency = from.currency_code === "TRY" ? to.currency_code : from.currency_code;
    const foreignAmount = from.currency_code === "TRY" ? input.toAmount : input.fromAmount;
    const buying = from.currency_code === "TRY";

    const rate = await transaction.query<{ effective: string }>(
      `SELECT ROUND($1::numeric/NULLIF($2::numeric,0),6)::text AS effective`,
      [tryAmount, foreignAmount],
    );
    const effectiveRate = rate.rows[0]?.effective ?? "0";

    // The receiving account grows, the funding account shrinks; both in their
    // own currency, both valued at the TRY that moved.
    const drafts: LedgerEntryDraft[] = [
      { accountId: to.id, direction: "DEBIT", amount: input.toAmount, currencyCode: to.currency_code, baseAmount: tryAmount },
      { accountId: from.id, direction: "CREDIT", amount: input.fromAmount, currencyCode: from.currency_code, baseAmount: tryAmount },
    ];
    await assertAccountPostingLimits(transaction, drafts);

    const title = `${buying ? "Döviz alışı" : "Döviz satışı"}: ${moneyText(foreignAmount)} ${foreignCurrency}`;
    const description = `${input.notes ? `${input.notes} · ` : ""}Efektif kur: ${effectiveRate}`;
    const posted = await transaction.query<{ id: string; transaction_no: string; transaction_date: string }>(
      `INSERT INTO transactions(book_id,transaction_type,account_id,target_account_id,title,description,transaction_date,status,currency_code,client_operation_id,created_by)
       VALUES($1,'ADJUSTMENT',$2,$3,$4,$5,$6,'POSTED',$7,$8,$9)
       RETURNING id,transaction_no::text AS transaction_no,transaction_date::text AS transaction_date`,
      [input.bookId, from.id, to.id, title, description, input.transactionDate, foreignCurrency, input.clientOperationId, userId],
    );
    const transactionId = posted.rows[0]!.id;
    for (const draft of drafts) {
      await transaction.query(
        `INSERT INTO transaction_entries(transaction_id,account_id,direction,amount,currency_code,base_amount)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [transactionId, draft.accountId, draft.direction, draft.amount, draft.currencyCode, draft.baseAmount],
      );
    }
    const value = await findFxConversion(transaction, transactionId);
    await transaction.query(
      `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values) VALUES($1,$2,'TRANSACTION',$3,'POST',$4)`,
      [input.bookId, userId, transactionId, JSON.stringify(value)],
    );
    await transaction.query(
      `INSERT INTO sync_changes(book_id,entity_type,entity_id,action,entity_version,payload) VALUES($1,'TRANSACTION',$2,'UPSERT',1,$3)`,
      [input.bookId, transactionId, JSON.stringify(value)],
    );
    return value;
  });
}

async function findFxConversion(client: DbClient, transactionId: string) {
  const result = await client.query(
    `SELECT t.id,t.transaction_no::text AS "transactionNo",t.title,t.description,
            t.transaction_date AS "transactionDate",t.currency_code AS "currencyCode",
            t.account_id AS "fromAccountId",source.name AS "fromAccountName",
            t.target_account_id AS "toAccountId",target.name AS "toAccountName",
            from_entry.amount::text AS "fromAmount",from_entry.currency_code AS "fromCurrency",
            to_entry.amount::text AS "toAmount",to_entry.currency_code AS "toCurrency",
            to_entry.base_amount::text AS "tryAmount"
     FROM transactions t
     LEFT JOIN accounts source ON source.id=t.account_id
     LEFT JOIN accounts target ON target.id=t.target_account_id
     LEFT JOIN LATERAL (SELECT amount,currency_code FROM transaction_entries WHERE transaction_id=t.id AND account_id=t.account_id LIMIT 1) from_entry ON true
     LEFT JOIN LATERAL (SELECT amount,currency_code,base_amount FROM transaction_entries WHERE transaction_id=t.id AND account_id=t.target_account_id LIMIT 1) to_entry ON true
     WHERE t.id=$1`,
    [transactionId],
  );
  return result.rows[0];
}
