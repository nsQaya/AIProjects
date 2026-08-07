import { z } from "zod";
import { currency, uuid } from "../../common/schemas";

export const createBookSchema = z.object({ name: z.string().trim().min(1).max(120), bookType: z.enum(["PERSONAL","BUSINESS","OTHER"]), baseCurrency: currency.default("TRY") });
export const addMemberSchema = z.object({ email: z.email(), role: z.enum(["ADMIN","EDITOR","ACCOUNTANT","VIEWER"]) });
export const bookIdParam = z.object({ bookId: uuid });

