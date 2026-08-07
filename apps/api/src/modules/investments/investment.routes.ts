import { Hono } from "hono";
import type { AppEnv } from "../../config/bindings";
import { AppError } from "../../common/errors";
import { parseJson } from "../../common/validation";
import { requireBookRole } from "../../middleware/book-access";
import {
  createAssetTypeSchema,createInstrumentSchema,createLotSchema,createPriceSchema,createSaleSchema,
  updateAssetTypeSchema,updateInstrumentSchema,updateLotSchema,updateSaleSchema,
} from "./investment.schemas";
import {
  assetTypeBookId,createAssetType,createInstrument,createLot,deleteAssetType,deleteInstrument,deleteLot,
  createSale,deleteSale,instrumentBookId,listAssetTypes,listInstruments,listLots,listSales,lotBookId,portfolio,saleBookId,setInstrumentPrice,
  updateAssetType,updateInstrument,updateLot,updateSale,
} from "./investment.service";

export const investmentRoutes=new Hono<AppEnv>();

async function queryContext(c:any,role:"VIEWER"|"EDITOR"="VIEWER"){
  const client=c.get("database"),bookId=c.req.query("bookId")??"";
  await requireBookRole(client,bookId,c.get("user").id,role);
  return {client,bookId};
}
function requiredVersion(c:any){
  const value=Number(c.req.query("version"));
  if(!Number.isInteger(value)||value<1)throw new AppError(422,"INVALID_VERSION","A positive version is required");
  return value;
}

investmentRoutes.get("/portfolio",async c=>{const {client,bookId}=await queryContext(c);return c.json(await portfolio(client,bookId));});
investmentRoutes.get("/asset-types",async c=>{const {client,bookId}=await queryContext(c);return c.json(await listAssetTypes(client,bookId,c.req.query("includeInactive")==="true"));});
investmentRoutes.post("/asset-types",async c=>{const input=await parseJson(c.req.raw,createAssetTypeSchema),client=c.get("database");await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");return c.json(await createAssetType(client,c.get("user").id,input),201);});
investmentRoutes.patch("/asset-types/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await assetTypeBookId(client,id),c.get("user").id,"EDITOR");return c.json(await updateAssetType(client,c.get("user").id,id,await parseJson(c.req.raw,updateAssetTypeSchema)));});
investmentRoutes.delete("/asset-types/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await assetTypeBookId(client,id),c.get("user").id,"EDITOR");return c.json(await deleteAssetType(client,c.get("user").id,id,requiredVersion(c)));});

investmentRoutes.get("/instruments",async c=>{const {client,bookId}=await queryContext(c);return c.json(await listInstruments(client,bookId,c.req.query("includeInactive")==="true"));});
investmentRoutes.post("/instruments",async c=>{const input=await parseJson(c.req.raw,createInstrumentSchema),client=c.get("database");await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");return c.json(await createInstrument(client,c.get("user").id,input),201);});
investmentRoutes.patch("/instruments/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await instrumentBookId(client,id),c.get("user").id,"EDITOR");return c.json(await updateInstrument(client,c.get("user").id,id,await parseJson(c.req.raw,updateInstrumentSchema)));});
investmentRoutes.delete("/instruments/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await instrumentBookId(client,id),c.get("user").id,"EDITOR");return c.json(await deleteInstrument(client,c.get("user").id,id,requiredVersion(c)));});
investmentRoutes.post("/instruments/:id/prices",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await instrumentBookId(client,id),c.get("user").id,"EDITOR");return c.json(await setInstrumentPrice(client,c.get("user").id,id,await parseJson(c.req.raw,createPriceSchema)),201);});

investmentRoutes.get("/lots",async c=>{const {client,bookId}=await queryContext(c);return c.json(await listLots(client,bookId));});
investmentRoutes.post("/lots",async c=>{const input=await parseJson(c.req.raw,createLotSchema),client=c.get("database");await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");return c.json(await createLot(client,c.get("user").id,input),201);});
investmentRoutes.patch("/lots/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await lotBookId(client,id),c.get("user").id,"EDITOR");return c.json(await updateLot(client,c.get("user").id,id,await parseJson(c.req.raw,updateLotSchema)));});
investmentRoutes.delete("/lots/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await lotBookId(client,id),c.get("user").id,"EDITOR");return c.json(await deleteLot(client,c.get("user").id,id,requiredVersion(c)));});

investmentRoutes.get("/sales",async c=>{const {client,bookId}=await queryContext(c);return c.json(await listSales(client,bookId));});
investmentRoutes.post("/sales",async c=>{const input=await parseJson(c.req.raw,createSaleSchema),client=c.get("database");await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");return c.json(await createSale(client,c.get("user").id,input),201);});
investmentRoutes.patch("/sales/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await saleBookId(client,id),c.get("user").id,"EDITOR");return c.json(await updateSale(client,c.get("user").id,id,await parseJson(c.req.raw,updateSaleSchema)));});
investmentRoutes.delete("/sales/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await saleBookId(client,id),c.get("user").id,"EDITOR");return c.json(await deleteSale(client,c.get("user").id,id,requiredVersion(c)));});
