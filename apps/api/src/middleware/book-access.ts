import { AppError } from "../common/errors";
import type { BookRole } from "@defterx/contracts";
import type { DbClient } from "../infrastructure/database";

const rank: Record<BookRole, number> = { VIEWER: 0, ACCOUNTANT: 1, EDITOR: 2, ADMIN: 3, OWNER: 4 };

export async function requireBookRole(pool: DbClient, bookId: string, userId: string, minimum: BookRole): Promise<BookRole> {
  const result = await pool.query<{ role: BookRole }>(
    `SELECT role FROM book_members WHERE book_id=$1 AND user_id=$2 AND status='ACTIVE' AND deleted_at IS NULL`,
    [bookId, userId],
  );
  const role = result.rows[0]?.role;
  if (!role) throw new AppError(403, "BOOK_ACCESS_DENIED", "You do not have access to this book");
  if (rank[role] < rank[minimum]) throw new AppError(403, "INSUFFICIENT_ROLE", `This action requires ${minimum} access`);
  return role;
}
