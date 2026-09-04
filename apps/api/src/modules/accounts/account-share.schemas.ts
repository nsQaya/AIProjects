import { z } from "zod";
import { version } from "../../common/schemas";

export const accountSharePermission = z.enum(["VIEW", "OPERATE"]);

export const shareAccountSchema = z.object({
  email: z.string().trim().email().max(320),
  permission: accountSharePermission,
});

export const updateAccountShareSchema = z.object({
  permission: accountSharePermission,
  version,
});

export type ShareAccountInput = z.infer<typeof shareAccountSchema>;
export type UpdateAccountShareInput = z.infer<typeof updateAccountShareSchema>;
