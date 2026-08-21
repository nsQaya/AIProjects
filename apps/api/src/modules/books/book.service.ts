import { inTransaction } from "../../infrastructure/database";
import { AppError } from "../../common/errors";
import type { DbClient } from "../../infrastructure/database";
import { getSystemAccountType } from "../accounts/system-accounts";

export async function createBook(pool: DbClient, userId: string, input: { name: string; bookType: string; baseCurrency: string }) {
  return inTransaction(pool, (client) => createBookWithClient(client,userId,input));
}

export async function createBookWithClient(client: DbClient, userId: string, input: { name: string; bookType: string; baseCurrency: string }) {
    const result = await client.query(
      `INSERT INTO books(name,book_type,base_currency,owner_user_id) VALUES($1,$2,$3,$4)
       RETURNING id,name,book_type AS "bookType",base_currency AS "baseCurrency",version,created_at AS "createdAt"`,
      [input.name, input.bookType, input.baseCurrency, userId],
    );
    const book = result.rows[0];
    await client.query(`INSERT INTO book_members(book_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`, [book.id, userId]);
    await client.query(`SELECT seed_default_account_types($1)`, [book.id]);
    const equityType = await getSystemAccountType(client, book.id, "SYSTEM_EQUITY");
    await client.query(
      `INSERT INTO accounts(book_id,name,account_type_id,normal_balance,currency_code,is_system)
       VALUES($1,'Opening Equity',$2,'CREDIT',$3,true)`, [book.id, equityType.id, input.baseCurrency],
    );
    await client.query(`SELECT seed_default_categories($1,$2)`, [book.id, input.baseCurrency]);
    await client.query(`SELECT seed_default_investment_types($1)`, [book.id]);
    await client.query(
      `INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values) VALUES($1,$2,'BOOK',$1,'CREATE',$3)`,
      [book.id, userId, JSON.stringify(book)],
    );
    return book;
}

export async function addBookMember(pool: DbClient, bookId: string, actorId: string, input: { email: string; role: string }) {
  return inTransaction(pool, async (client) => {
    const user = await client.query<{ id: string }>(`SELECT id FROM users WHERE lower(email)=lower($1) AND status='ACTIVE' AND deleted_at IS NULL`, [input.email]);
    if (!user.rows[0]) throw new AppError(404, "INVITEE_NOT_FOUND", "No active user has that email");
    try {
      const result = await client.query(
        `INSERT INTO book_members(book_id,user_id,role,status) VALUES($1,$2,$3,'ACTIVE')
         RETURNING id,book_id AS "bookId",user_id AS "userId",role,status,version`,
        [bookId, user.rows[0].id, input.role],
      );
      await client.query(`INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values) VALUES($1,$2,'BOOK_MEMBER',$3,'CREATE',$4)`, [bookId, actorId, result.rows[0].id, JSON.stringify(result.rows[0])]);
      return result.rows[0];
    } catch (error) {
      if ((error as { code?: string }).code === "23505") throw new AppError(409, "MEMBER_EXISTS", "User is already a member");
      throw error;
    }
  });
}
