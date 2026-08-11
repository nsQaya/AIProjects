import { Hono } from "hono";

import { AppError } from "../../common/errors";
import { parseJson } from "../../common/validation";
import type { AppEnv } from "../../config/bindings";
import { requireBookRole } from "../../middleware/book-access";
import { createCostCenterSchema, updateCostCenterSchema } from "./cost-center.schemas";
import {
  costCenterBookId,
  createCostCenter,
  deleteOrDeactivateCostCenter,
  listCostCenters,
  updateCostCenter,
} from "./cost-center.service";

export const costCenterRoutes = new Hono<AppEnv>();

costCenterRoutes.get("/",async c=>{
  const client = c.get("database");
  const bookId = c.req.query("bookId")??"";
  await requireBookRole(client,bookId,c.get("user").id,"VIEWER");
  return c.json(await listCostCenters(client,bookId,c.req.query("includeInactive")==="true"));
});
costCenterRoutes.post("/",async c=>{
  const input = await parseJson(c.req.raw,createCostCenterSchema);
  const client = c.get("database");
  await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");
  return c.json(await createCostCenter(client,c.get("user").id,input),201);
});

costCenterRoutes.patch("/:costCenterId",async c=>{
  const client = c.get("database");
  const costCenterId = c.req.param("costCenterId");
  await requireBookRole(client,await costCenterBookId(client,costCenterId),c.get("user").id,"EDITOR");
  const input = await parseJson(c.req.raw,updateCostCenterSchema);
  return c.json(await updateCostCenter(client,c.get("user").id,costCenterId,input));
});

costCenterRoutes.delete("/:costCenterId",async c=>{
  const client = c.get("database");
  const costCenterId = c.req.param("costCenterId");
  const version = Number(c.req.query("version"));
  if (!Number.isInteger(version)||version<1) {
    throw new AppError(422,"INVALID_VERSION","A positive version is required");
  }
  await requireBookRole(client,await costCenterBookId(client,costCenterId),c.get("user").id,"EDITOR");
  return c.json(await deleteOrDeactivateCostCenter(client,c.get("user").id,costCenterId,version));
});
