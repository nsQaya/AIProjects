import type { DbClient } from "../../infrastructure/database";

export interface ReopenedScheduledTransaction {
  id: string;
  status: "PENDING" | "OVERDUE";
  version: number;
  scheduledAt: Date;
}

export interface RelinkedScheduledTransaction {
  id: string;
  status: "COMPLETED";
  version: number;
}

/**
 * Reopens the one completed plan backed by the reversed transaction, if any.
 * The caller must already be inside the same database transaction as the
 * reversal so the ledger event, plan state and audit record commit together.
 */
export async function reopenScheduledAfterTransactionReversal(
  client: DbClient,
  userId: string,
  bookId: string,
  transactionId: string,
  reversalTransactionId: string,
): Promise<ReopenedScheduledTransaction | null> {
  const result = await client.query<ReopenedScheduledTransaction>(
    `UPDATE scheduled_transactions
     SET status=CASE WHEN scheduled_at<now() THEN 'OVERDUE' ELSE 'PENDING' END,
         completed_transaction_id=NULL,updated_at=now(),version=version+1
     WHERE book_id=$1 AND completed_transaction_id=$2 AND status='COMPLETED'
       AND deleted_at IS NULL
     RETURNING id,status,version,scheduled_at AS "scheduledAt"`,
    [bookId,transactionId],
  );
  const reopened = result.rows[0];
  if (!reopened) return null;

  await client.query(
    `INSERT INTO audit_logs(
       book_id,actor_user_id,entity_type,entity_id,action,old_values,new_values
     ) VALUES($1,$2,'SCHEDULED_TRANSACTION',$3,'REOPEN_AFTER_REVERSAL',$4,$5)`,
    [
      bookId,
      userId,
      reopened.id,
      JSON.stringify({
        status: "COMPLETED",
        completedTransactionId: transactionId,
        version: reopened.version - 1,
      }),
      JSON.stringify({
        status: reopened.status,
        completedTransactionId: null,
        version: reopened.version,
        reversalTransactionId,
      }),
    ],
  );
  return reopened;
}

/**
 * Keeps a realized plan completed while moving its completion link from the
 * corrected (now reversed) transaction to the replacement transaction.
 */
export async function relinkScheduledAfterTransactionCorrection(
  client: DbClient,
  userId: string,
  bookId: string,
  correctedTransactionId: string,
  replacementTransactionId: string,
): Promise<RelinkedScheduledTransaction | null> {
  const result = await client.query<RelinkedScheduledTransaction>(
    `UPDATE scheduled_transactions
     SET completed_transaction_id=$3,updated_at=now(),version=version+1
     WHERE book_id=$1 AND completed_transaction_id=$2 AND status='COMPLETED'
       AND deleted_at IS NULL
     RETURNING id,status,version`,
    [bookId,correctedTransactionId,replacementTransactionId],
  );
  const relinked = result.rows[0];
  if (!relinked) return null;

  await client.query(
    `INSERT INTO audit_logs(
       book_id,actor_user_id,entity_type,entity_id,action,old_values,new_values
     ) VALUES($1,$2,'SCHEDULED_TRANSACTION',$3,'RELINK_AFTER_CORRECTION',$4,$5)`,
    [
      bookId,
      userId,
      relinked.id,
      JSON.stringify({
        status: "COMPLETED",
        completedTransactionId: correctedTransactionId,
        version: relinked.version - 1,
      }),
      JSON.stringify({
        status: "COMPLETED",
        completedTransactionId: replacementTransactionId,
        version: relinked.version,
      }),
    ],
  );
  return relinked;
}
