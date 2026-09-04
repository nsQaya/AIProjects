import { AppError } from "../../common/errors";
import { inTransaction, type DbClient } from "../../infrastructure/database";
import { assertAccountAccess } from "../../middleware/account-access";
import { listCategories } from "../categories/category.service";
import { listCostCenters } from "../cost-centers/cost-center.service";
import { accountProjection, balanceJoin, fxRateJoin, typeJoin } from "./account.service";
import type { ShareAccountInput, UpdateAccountShareInput } from "./account-share.schemas";

const shareProjection = `
  s.id,s.account_id AS "accountId",s.grantee_user_id AS "granteeUserId",
  u.email AS "granteeEmail",u.display_name AS "granteeDisplayName",
  s.permission,s.status,s.version`;

/** Accounts other users have shared with `userId`, with the standard balance projection. */
export async function listSharedWithMe(client: DbClient, userId: string) {
  const result = await client.query(
    `SELECT ${accountProjection},
       s.id AS "shareId",s.permission,
       s.book_id AS "ownerBookId",
       owner.display_name AS "ownerName",owner.email AS "ownerEmail"
     FROM account_shares s
     JOIN accounts a ON a.id=s.account_id AND a.deleted_at IS NULL
     JOIN books b ON b.id=s.book_id AND b.deleted_at IS NULL
     JOIN users owner ON owner.id=b.owner_user_id
     ${typeJoin} ${balanceJoin} ${fxRateJoin}
     WHERE s.grantee_user_id=$1 AND s.status='ACTIVE' AND s.deleted_at IS NULL
     ORDER BY owner.display_name,a.sort_order,a.name`,
    [userId],
  );
  return { items: result.rows };
}

export async function listAccountShares(client: DbClient, accountId: string) {
  const result = await client.query(
    `SELECT ${shareProjection}
     FROM account_shares s JOIN users u ON u.id=s.grantee_user_id
     WHERE s.account_id=$1 AND s.deleted_at IS NULL
     ORDER BY u.display_name,u.email`,
    [accountId],
  );
  return { items: result.rows };
}

export async function shareAccount(
  client: DbClient,
  actorId: string,
  accountId: string,
  input: ShareAccountInput,
) {
  return inTransaction(client, async (transaction) => {
    const account = await assertAccountAccess(transaction, accountId, actorId, "MANAGE");
    if (account.isSystem) throw new AppError(422, "ACCOUNT_NOT_SHAREABLE", "System accounts cannot be shared");
    if (account.contactId) throw new AppError(422, "ACCOUNT_NOT_SHAREABLE", "Contact accounts cannot be shared");

    const grantee = await transaction.query<{ id: string }>(
      `SELECT id FROM users WHERE lower(email)=lower($1) AND status='ACTIVE' AND deleted_at IS NULL`,
      [input.email],
    );
    const granteeId = grantee.rows[0]?.id;
    if (!granteeId) throw new AppError(404, "GRANTEE_NOT_FOUND", "No active user has that email");
    if (granteeId === actorId) throw new AppError(422, "CANNOT_SHARE_WITH_SELF", "You cannot share an account with yourself");

    const owningMember = await transaction.query(
      `SELECT 1 FROM book_members
       WHERE book_id=$1 AND user_id=$2 AND status='ACTIVE' AND deleted_at IS NULL`,
      [account.bookId, granteeId],
    );
    if (owningMember.rowCount) throw new AppError(422, "GRANTEE_ALREADY_MEMBER", "That user is already a member of this book");

    const upserted = await transaction.query(
      `INSERT INTO account_shares(account_id,book_id,grantee_user_id,granted_by_user_id,permission)
       VALUES($1,$2,$3,$4,$5)
       ON CONFLICT (account_id,grantee_user_id) WHERE deleted_at IS NULL
       DO UPDATE SET permission=EXCLUDED.permission,status='ACTIVE',
         granted_by_user_id=EXCLUDED.granted_by_user_id,updated_at=now(),version=account_shares.version+1
       RETURNING id`,
      [accountId, account.bookId, granteeId, actorId, input.permission],
    );
    const shareId = upserted.rows[0]!.id;
    const share = await shareById(transaction, shareId);
    await audit(transaction, account.bookId, actorId, shareId, "CREATE", share);
    return share;
  });
}

export async function updateAccountShare(
  client: DbClient,
  actorId: string,
  accountId: string,
  shareId: string,
  input: UpdateAccountShareInput,
) {
  return inTransaction(client, async (transaction) => {
    const account = await assertAccountAccess(transaction, accountId, actorId, "MANAGE");
    const result = await transaction.query(
      `UPDATE account_shares SET permission=$3,updated_at=now(),version=version+1
       WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL AND version=$4 RETURNING id`,
      [shareId, accountId, input.permission, input.version],
    );
    if (!result.rows[0]) {
      const exists = await transaction.query(`SELECT 1 FROM account_shares WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL`, [shareId, accountId]);
      throw exists.rowCount
        ? new AppError(409, "VERSION_CONFLICT", "Share changed on another device")
        : new AppError(404, "SHARE_NOT_FOUND", "Share was not found");
    }
    const share = await shareById(transaction, shareId);
    await audit(transaction, account.bookId, actorId, shareId, "UPDATE", share);
    return share;
  });
}

export async function revokeAccountShare(
  client: DbClient,
  actorId: string,
  accountId: string,
  shareId: string,
) {
  return inTransaction(client, async (transaction) => {
    const account = await assertAccountAccess(transaction, accountId, actorId, "MANAGE");
    const result = await transaction.query<{ id: string; version: number }>(
      `UPDATE account_shares SET status='REVOKED',deleted_at=now(),updated_at=now(),version=version+1
       WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL
       RETURNING id,version`,
      [shareId, accountId],
    );
    if (!result.rows[0]) throw new AppError(404, "SHARE_NOT_FOUND", "Share was not found");
    await audit(transaction, account.bookId, actorId, shareId, "REVOKE", result.rows[0]);
    return { id: result.rows[0].id, status: "REVOKED" as const, version: result.rows[0].version };
  });
}

/** Owner-book references a grantee needs to post an OPERATE transaction against the shared account. */
export async function accountPostingContext(client: DbClient, userId: string, accountId: string) {
  const account = await assertAccountAccess(client, accountId, userId, "OPERATE");
  const book = await client.query<{ base_currency: string }>(
    `SELECT base_currency FROM books WHERE id=$1 AND deleted_at IS NULL`,
    [account.bookId],
  );
  const [categories, costCenters] = await Promise.all([
    listCategories(client, account.bookId, false),
    listCostCenters(client, account.bookId, false),
  ]);
  return {
    accountId,
    bookId: account.bookId,
    currencyCode: account.currencyCode,
    baseCurrency: book.rows[0]?.base_currency ?? "TRY",
    categories: categories.items,
    costCenters: costCenters.items,
  };
}

async function shareById(client: DbClient, shareId: string) {
  const result = await client.query(
    `SELECT ${shareProjection}
     FROM account_shares s JOIN users u ON u.id=s.grantee_user_id
     WHERE s.id=$1`,
    [shareId],
  );
  return result.rows[0];
}

async function audit(client: DbClient, bookId: string, actorId: string, shareId: string, action: string, value: unknown) {
  await client.query(
    `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values)
     VALUES($1,$2,'ACCOUNT_SHARE',$3,$4,$5)`,
    [bookId, actorId, shareId, action, JSON.stringify(value)],
  );
}
