import { describe, expect, it, vi } from "vitest";

import type { DbClient } from "../../src/infrastructure/database";
import {
  relinkScheduledAfterTransactionCorrection,
  reopenScheduledAfterTransactionReversal,
} from "../../src/modules/scheduled-transactions/scheduled-reversal.service";

const BOOK_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const TRANSACTION_ID = "00000000-0000-4000-8000-000000000003";
const REVERSAL_ID = "00000000-0000-4000-8000-000000000004";
const SCHEDULED_ID = "00000000-0000-4000-8000-000000000005";
const REPLACEMENT_ID = "00000000-0000-4000-8000-000000000006";

function databaseMock(...responses: unknown[]) {
  const query = vi.fn();
  for (const response of responses) query.mockResolvedValueOnce(response);
  return { client: { query } as unknown as DbClient, query };
}

describe("scheduled realization reversal reconciliation", () => {
  it("does nothing when no completed plan points at the reversed transaction", async () => {
    const { client, query } = databaseMock({ rows: [] });

    await expect(
      reopenScheduledAfterTransactionReversal(
        client,USER_ID,BOOK_ID,TRANSACTION_ID,REVERSAL_ID,
      ),
    ).resolves.toBeNull();

    expect(query).toHaveBeenCalledOnce();
    const [statement, parameters] = query.mock.calls[0]!;
    expect(statement).toContain("completed_transaction_id=$2");
    expect(statement).toContain("status='COMPLETED'");
    expect(parameters).toEqual([BOOK_ID,TRANSACTION_ID]);
  });

  it("clears the completion link, increments once and audits the reopened plan", async () => {
    const scheduledAt = new Date("2026-08-10T12:00:00.000Z");
    const reopened = { id:SCHEDULED_ID,status:"OVERDUE",version:4,scheduledAt };
    const { client, query } = databaseMock({ rows:[reopened] },{ rows:[] });

    await expect(
      reopenScheduledAfterTransactionReversal(
        client,USER_ID,BOOK_ID,TRANSACTION_ID,REVERSAL_ID,
      ),
    ).resolves.toEqual(reopened);

    const updateStatement = String(query.mock.calls[0]![0]);
    expect(updateStatement).toContain("scheduled_at<now()");
    expect(updateStatement).toContain("completed_transaction_id=NULL");
    expect(updateStatement).toContain("version=version+1");

    const [auditStatement, auditParameters] = query.mock.calls[1]!;
    expect(auditStatement).toContain("REOPEN_AFTER_REVERSAL");
    expect(JSON.parse(String(auditParameters[3]))).toEqual({
      status:"COMPLETED",completedTransactionId:TRANSACTION_ID,version:3,
    });
    expect(JSON.parse(String(auditParameters[4]))).toEqual({
      status:"OVERDUE",completedTransactionId:null,version:4,
      reversalTransactionId:REVERSAL_ID,
    });
  });

  it("relinks a corrected realization once and leaves an idempotent retry unchanged", async () => {
    const relinked = { id:SCHEDULED_ID,status:"COMPLETED",version:7 };
    const { client, query } = databaseMock(
      { rows:[relinked] },
      { rows:[] },
      { rows:[] },
    );

    await expect(
      relinkScheduledAfterTransactionCorrection(
        client,USER_ID,BOOK_ID,TRANSACTION_ID,REPLACEMENT_ID,
      ),
    ).resolves.toEqual(relinked);
    await expect(
      relinkScheduledAfterTransactionCorrection(
        client,USER_ID,BOOK_ID,TRANSACTION_ID,REPLACEMENT_ID,
      ),
    ).resolves.toBeNull();

    const [updateStatement, updateParameters] = query.mock.calls[0]!;
    expect(updateStatement).toContain("completed_transaction_id=$3");
    expect(updateStatement).toContain("status='COMPLETED'");
    expect(updateStatement).toContain("version=version+1");
    expect(updateParameters).toEqual([BOOK_ID,TRANSACTION_ID,REPLACEMENT_ID]);

    const [auditStatement, auditParameters] = query.mock.calls[1]!;
    expect(auditStatement).toContain("RELINK_AFTER_CORRECTION");
    expect(JSON.parse(String(auditParameters[3]))).toEqual({
      status:"COMPLETED",completedTransactionId:TRANSACTION_ID,version:6,
    });
    expect(JSON.parse(String(auditParameters[4]))).toEqual({
      status:"COMPLETED",completedTransactionId:REPLACEMENT_ID,version:7,
    });
    expect(query).toHaveBeenCalledTimes(3);
  });
});
