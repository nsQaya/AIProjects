import { z } from "zod";

import { uuid, version } from "../../common/schemas";

export const createCostCenterSchema = z.object({
  bookId: uuid,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export const updateCostCenterSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
  version,
});

export type CreateCostCenterInput = z.infer<typeof createCostCenterSchema>;
export type UpdateCostCenterInput = z.infer<typeof updateCostCenterSchema>;
