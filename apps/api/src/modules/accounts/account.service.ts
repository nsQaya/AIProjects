import { Money } from "@defterx/shared";
import { AppError } from "../../common/errors";
import { inTransaction, type DbClient } from "../../infrastructure/database";
import { insertPostedTransaction } from "../transactions/transaction.repository";
import { reverseWithClient } from "../transactions/transaction.service";
import { resolveSystemEquityAccountId } from "./system-accounts";
import type { CreateAccountInput, UpdateAccountInput } from "./account.schemas";

export const accountProjection = `
  a.id,a.book_id AS "bookId",a.contact_id AS "contactId",a.name,
  a.account_type_id AS "accountTypeId",at.name AS "accountTypeName",at.icon AS "accountTypeIcon",
  at.is_investment AS "isInvestment",
  a.normal_balance AS "normalBalance",
  a.currency_code AS "currencyCode",a.allow_negative_balance AS "allowNegativeBalance",
  a.credit_limit::text AS "creditLimit",a.is_archived AS "isArchived",
  a.sort_order AS "sortOrder",a.version,
  balances.balance::text AS balance,
  (CASE WHEN a.normal_balance='CREDIT' THEN -balances.balance ELSE balances.balance END)::text AS "displayBalance",
  (CASE
    WHEN a.currency_code='TRY'
      THEN (CASE WHEN a.normal_balance='CREDIT' THEN -balances.balance ELSE balances.balance END)
    ELSE ROUND((CASE WHEN a.normal_balance='CREDIT' THEN -balances.balance ELSE balances.balance END)*COALESCE(fx.try_rate,0),2)
  END)::text AS "displayBalanceTry",
  (CASE
    WHEN a.credit_limit IS NULL THEN NULL
    WHEN a.normal_balance='CREDIT' THEN a.credit_limit-balances.balance
    ELSE a.credit_limit+balances.balance
  END)::text AS "availableCredit",
  COALESCE((
    SELECT e.amount
    FROM transaction_entries e
    JOIN transactions t ON t.id=e.transaction_id
    WHERE e.account_id=a.id AND t.account_id=a.id
      AND t.transaction_type='OPENING_BALANCE' AND t.status='POSTED' AND t.deleted_at IS NULL
    ORDER BY t.transaction_date DESC,t.transaction_no DESC LIMIT 1
  ),0)::text AS "openingBalance"`;

export const typeJoin = `JOIN account_types at ON at.id=a.account_type_id`;

// Latest TCMB rate for the account's currency; only joined for non-TRY accounts
// so displayBalanceTry can express a foreign balance in the book base currency.
export const fxRateJoin = `
  LEFT JOIN LATERAL (
    SELECT try_rate FROM currency_daily_rates
    WHERE currency_code=a.currency_code ORDER BY rate_date DESC LIMIT 1
  ) fx ON a.currency_code<>'TRY'`;

// An account's balance is reconstructed in its own currency (e.amount); the
// book-base-currency (base_amount) figure is only used for cross-currency
// rollups. amount == base_amount for every single-currency transaction, so this
// is unchanged for TRY-only books.
export const balanceJoin = `
  LEFT JOIN LATERAL (
    SELECT CASE WHEN a.normal_balance='DEBIT'
      THEN COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.amount ELSE -e.amount END),0)
      ELSE COALESCE(SUM(CASE WHEN e.direction='CREDIT' THEN e.amount ELSE -e.amount END),0)
    END AS balance
    FROM transaction_entries e
    JOIN transactions t ON t.id=e.transaction_id AND t.status IN ('POSTED','REVERSED')
    WHERE e.account_id=a.id
  ) balances ON true`;

export async function listAccounts(client: DbClient, bookId: string, includeArchived = false) {
  const result = await client.query(
    `SELECT ${accountProjection}
     FROM accounts a ${typeJoin} ${balanceJoin} ${fxRateJoin}
     WHERE a.book_id=$1 AND a.deleted_at IS NULL AND a.is_system=false
       AND ($2::boolean OR a.is_archived=false)
     ORDER BY a.sort_order,a.name`,
    [bookId, includeArchived],
  );
  return { items: result.rows };
}

export async function getAccountBalance(client: DbClient, accountId: string) {
  const result = await client.query(
    `SELECT ${accountProjection} FROM accounts a ${typeJoin} ${balanceJoin} ${fxRateJoin}
     WHERE a.id=$1 AND a.deleted_at IS NULL`,
    [accountId],
  );
  return result.rows[0];
}

async function assertAccountType(client: DbClient, bookId: string, accountTypeId: string) {
  const result = await client.query<{ normal_balance: "DEBIT" | "CREDIT"; default_allow_negative_balance: boolean }>(
    `SELECT normal_balance,default_allow_negative_balance FROM account_types
     WHERE id=$1 AND book_id=$2 AND deleted_at IS NULL AND is_active=true`,
    [accountTypeId, bookId],
  );
  if (!result.rows[0]) throw new AppError(422, "ACCOUNT_TYPE_INVALID", "Account type is unavailable or belongs to another book");
  return result.rows[0];
}

export async function createAccount(client: DbClient, userId: string, input: CreateAccountInput) {
  return inTransaction(client, async (transaction) => {
    const type = await assertAccountType(transaction, input.bookId, input.accountTypeId);
    const normalBalance = input.normalBalance ?? type.normal_balance;
    const allowNegativeBalance = input.allowNegativeBalance ?? type.default_allow_negative_balance;
    if (!allowNegativeBalance && input.creditLimit != null) {
      throw new AppError(422, "CREDIT_LIMIT_REQUIRES_OVERDRAFT", "Credit limit requires negative balance permission");
    }
    if (input.currencyCode !== "TRY") {
      const enabled = await transaction.query(
        `SELECT 1 FROM book_currencies WHERE book_id=$1 AND currency_code=$2`,
        [input.bookId, input.currencyCode],
      );
      if (!enabled.rowCount) throw new AppError(422, "CURRENCY_NOT_ENABLED", "Enable this currency for the book before opening an account in it");
    }

    const inserted = await transaction.query<{ id: string }>(
      `INSERT INTO accounts(
         book_id,name,account_type_id,normal_balance,currency_code,allow_negative_balance,
         credit_limit,is_archived,sort_order
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [input.bookId,input.name,input.accountTypeId,normalBalance,input.currencyCode,allowNegativeBalance,input.creditLimit??null,input.isArchived,input.sortOrder],
    );
    const accountId = inserted.rows[0]!.id;

    if (Money.parse(input.openingBalance).isPositive()) {
      const equityAccountId = await resolveSystemEquityAccountId(transaction, input.bookId, input.currencyCode);
      const posted = await transaction.query<{ id: string }>(
        `INSERT INTO transactions(
           book_id,transaction_type,account_id,title,transaction_date,status,currency_code,client_operation_id,created_by
         ) VALUES($1,'OPENING_BALANCE',$2,$3,now(),'POSTED',$4,$5,$6) RETURNING id`,
        [input.bookId,accountId,`${input.name} açılış bakiyesi`,input.currencyCode,crypto.randomUUID(),userId],
      );
      const accountDirection = normalBalance === "DEBIT" ? "DEBIT" : "CREDIT";
      const equityDirection = accountDirection === "DEBIT" ? "CREDIT" : "DEBIT";
      await transaction.query(
        `INSERT INTO transaction_entries(transaction_id,account_id,direction,amount,currency_code,base_amount)
         VALUES($1,$2,$3,$4,$5,$4),($1,$6,$7,$4,$5,$4)`,
        [posted.rows[0]!.id,accountId,accountDirection,input.openingBalance,input.currencyCode,equityAccountId,equityDirection],
      );
    }

    const account = await getAccountBalance(transaction, accountId);
    await transaction.query(
      `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values)
       VALUES($1,$2,'ACCOUNT',$3,'CREATE',$4)`,
      [input.bookId,userId,accountId,JSON.stringify(account)],
    );
    return account;
  });
}

/**
 * Brings the account's opening balance to `amount`. Ledger entries are immutable
 * once posted, so an existing opening posting is reversed (limits not enforced on
 * the reversal itself) and a fresh one is posted at the original date. The new
 * posting runs the normal balance-rule check, so lowering the opening balance
 * below what has already been spent from a no-overdraft account is rejected and
 * the whole update rolls back. A no-op when the amount is unchanged.
 */
async function applyOpeningBalanceChange(
  client: DbClient,
  userId: string,
  params: {
    bookId: string;
    accountId: string;
    accountName: string;
    currencyCode: string;
    normalBalance: "DEBIT" | "CREDIT";
    amount: string;
  },
) {
  const current = await client.query<{ id: string; amount: string; transaction_date: string }>(
    `SELECT t.id, e.amount::text AS amount, t.transaction_date
     FROM transactions t
     JOIN transaction_entries e ON e.transaction_id=t.id AND e.account_id=$1
     WHERE t.account_id=$1 AND t.transaction_type='OPENING_BALANCE'
       AND t.status='POSTED' AND t.deleted_at IS NULL
     ORDER BY t.transaction_date DESC, t.transaction_no DESC LIMIT 1`,
    [params.accountId],
  );
  const existingOpening = current.rows[0];
  if (Money.parse(params.amount).equals(Money.parse(existingOpening?.amount ?? "0"))) return;

  if (existingOpening) {
    await reverseWithClient(
      client, userId, params.bookId, existingOpening.id, crypto.randomUUID(),
      "Açılış bakiyesi güncellendi", false,
    );
  }
  if (!Money.parse(params.amount).isPositive()) return;

  const equityAccountId = await resolveSystemEquityAccountId(client, params.bookId, params.currencyCode);
  const accountDirection = params.normalBalance === "DEBIT" ? "DEBIT" : "CREDIT";
  const equityDirection = accountDirection === "DEBIT" ? "CREDIT" : "DEBIT";
  const transactionDate = new Date(existingOpening?.transaction_date ?? Date.now()).toISOString();
  await insertPostedTransaction(
    client, userId,
    {
      bookId: params.bookId,
      type: "OPENING_BALANCE",
      accountId: params.accountId,
      title: `${params.accountName} açılış bakiyesi`,
      amount: params.amount,
      currencyCode: params.currencyCode,
      transactionDate,
      clientOperationId: crypto.randomUUID(),
    },
    [
      { accountId: params.accountId, direction: accountDirection, amount: params.amount, currencyCode: params.currencyCode, baseAmount: params.amount },
      { accountId: equityAccountId, direction: equityDirection, amount: params.amount, currencyCode: params.currencyCode, baseAmount: params.amount },
    ],
  );
}

export async function updateAccount(client: DbClient, userId: string, accountId: string, input: UpdateAccountInput) {
  return inTransaction(client, async (transaction) => {
    const locked = await transaction.query<{
      book_id: string;
      name: string;
      account_type_id: string;
      normal_balance: "DEBIT" | "CREDIT";
      currency_code: string;
      allow_negative_balance: boolean;
      credit_limit: string | null;
    }>(
      `SELECT book_id,name,account_type_id,normal_balance,currency_code,allow_negative_balance,credit_limit::text
       FROM accounts WHERE id=$1 AND deleted_at IS NULL AND is_system=false FOR UPDATE`,
      [accountId],
    );
    const existing = locked.rows[0];
    if (!existing) throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account was not found");

    if (input.openingBalance !== undefined) {
      await applyOpeningBalanceChange(transaction, userId, {
        bookId: existing.book_id,
        accountId,
        accountName: input.name?.trim() || existing.name,
        currencyCode: existing.currency_code,
        normalBalance: existing.normal_balance,
        amount: input.openingBalance,
      });
    }

    const accountTypeId = input.accountTypeId ?? existing.account_type_id;
    const type = await assertAccountType(transaction, existing.book_id, accountTypeId);
    const normalBalance = type.normal_balance;
    const allowNegative = input.allowNegativeBalance ?? existing.allow_negative_balance;
    const creditLimit = input.creditLimit === undefined ? existing.credit_limit : input.creditLimit;
    if (!allowNegative && creditLimit != null) {
      throw new AppError(422, "CREDIT_LIMIT_REQUIRES_OVERDRAFT", "Credit limit requires negative balance permission");
    }
    const balanceResult = await transaction.query<{ balance: string }>(
      `SELECT CASE WHEN $2='DEBIT'
         THEN COALESCE(SUM(CASE WHEN e.direction='DEBIT' THEN e.amount ELSE -e.amount END),0)
         ELSE COALESCE(SUM(CASE WHEN e.direction='CREDIT' THEN e.amount ELSE -e.amount END),0)
       END::text AS balance
       FROM transaction_entries e JOIN transactions t ON t.id=e.transaction_id AND t.status IN ('POSTED','REVERSED')
       WHERE e.account_id=$1`,
      [accountId,existing.normal_balance],
    );
    const balance = balanceResult.rows[0]!.balance;
    if (normalBalance !== existing.normal_balance && Number(balance) !== 0) {
      throw new AppError(409, "ACCOUNT_TYPE_BALANCE_CONFLICT", "Account type cannot change balance direction while the account has a balance");
    }
    await assertConfiguredLimit(transaction, normalBalance, balance, allowNegative, creditLimit);

    const result = await transaction.query(
      `UPDATE accounts SET
         name=COALESCE($2,name),account_type_id=$3,normal_balance=$4,
         allow_negative_balance=$5,credit_limit=$6,
         is_archived=COALESCE($7,is_archived),sort_order=COALESCE($8,sort_order),
         updated_at=now(),version=version+1
       WHERE id=$1 AND version=$9 RETURNING id`,
      [accountId,input.name??null,accountTypeId,normalBalance,allowNegative,creditLimit,input.isArchived??null,input.sortOrder??null,input.version],
    );
    if (!result.rows[0]) throw new AppError(409, "VERSION_CONFLICT", "Account changed on another device");
    const account = await getAccountBalance(transaction, accountId);
    await transaction.query(
      `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values)
       VALUES($1,$2,'ACCOUNT',$3,'UPDATE',$4)`,
      [existing.book_id,userId,accountId,JSON.stringify(account)],
    );
    return account;
  });
}

export async function deleteOrArchiveAccount(client: DbClient, userId: string, accountId: string, version: number) {
  return inTransaction(client, async (transaction) => {
    const found = await transaction.query<{ book_id: string; is_system: boolean }>(
      `SELECT book_id,is_system FROM accounts WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
      [accountId],
    );
    const account = found.rows[0];
    if (!account) throw new AppError(404, "ACCOUNT_NOT_FOUND", "Account was not found");
    if (account.is_system) throw new AppError(409, "SYSTEM_ACCOUNT_IMMUTABLE", "System accounts cannot be deleted");
    const used = await transaction.query(
      `SELECT 1 FROM transaction_entries WHERE account_id=$1
       UNION ALL SELECT 1 FROM investment_lots WHERE account_id=$1 AND deleted_at IS NULL LIMIT 1`,
      [accountId],
    );
    const result = used.rowCount
      ? await transaction.query(
          `UPDATE accounts SET is_archived=true,updated_at=now(),version=version+1
           WHERE id=$1 AND version=$2 RETURNING id,is_archived AS "isArchived",version`,
          [accountId,version],
        )
      : await transaction.query(
          `UPDATE accounts SET deleted_at=now(),updated_at=now(),version=version+1
           WHERE id=$1 AND version=$2 RETURNING id,true AS deleted,version`,
          [accountId,version],
        );
    if (!result.rows[0]) throw new AppError(409, "VERSION_CONFLICT", "Account changed on another device");
    if (!used.rowCount) {
      await transaction.query(
        `UPDATE account_shares SET status='REVOKED',deleted_at=now(),updated_at=now(),version=version+1
         WHERE account_id=$1 AND deleted_at IS NULL`,
        [accountId],
      );
    }
    await transaction.query(
      `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values)
       VALUES($1,$2,'ACCOUNT',$3,$4,$5)`,
      [account.book_id,userId,accountId,used.rowCount ? "ARCHIVE" : "DELETE",JSON.stringify(result.rows[0])],
    );
    return result.rows[0];
  });
}

async function assertConfiguredLimit(
  client: DbClient,
  normalBalance: "DEBIT" | "CREDIT",
  balance: string,
  allowNegative: boolean,
  creditLimit: string | null,
) {
  const result = await client.query<{ allowed: boolean }>(
    `SELECT CASE
       WHEN $1='DEBIT' AND NOT $3::boolean THEN $2::numeric >= 0
       WHEN $1='DEBIT' AND $4::numeric IS NOT NULL THEN $2::numeric >= -$4::numeric
       WHEN $1='CREDIT' AND NOT $3::boolean THEN $2::numeric <= 0
       WHEN $1='CREDIT' AND $4::numeric IS NOT NULL THEN $2::numeric <= $4::numeric
       ELSE true
     END AS allowed`,
    [normalBalance,balance,allowNegative,creditLimit],
  );
  if (!result.rows[0]!.allowed) throw new AppError(409, "ACCOUNT_LIMIT_CONFLICT", "Current balance exceeds the requested account limit");
}
