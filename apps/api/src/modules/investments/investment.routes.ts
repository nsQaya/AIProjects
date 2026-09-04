import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../config/bindings";
import { AppError } from "../../common/errors";
import { parseJson } from "../../common/validation";
import { requireBookRole } from "../../middleware/book-access";
import {
  createAssetTypeSchema,createCapitalIncreaseSchema,createInstrumentSchema,createLotSchema,createPriceSchema,createSaleSchema,
  updateAssetTypeSchema,updateInstrumentSchema,updateLotSchema,updateSaleSchema,
} from "./investment.schemas";
import {
  assetTypeBookId,createAssetType,createCapitalIncrease,createInstrument,createLot,deleteAssetType,deleteInstrument,deleteLot,
  createSale,deleteSale,instrumentBookId,listAssetTypes,listBrokerageAccounts,listInstruments,listLots,listSales,lotBookId,portfolio,saleBookId,setInstrumentPrice,
  updateAssetType,updateInstrument,updateLot,updateSale,
} from "./investment.service";
import {
  createPriceSyncRun,findOrCreateMarketSymbol,latestPriceSyncRun,listBookInstrumentPrices,
  reclaimStalePriceRuns,searchMarketSymbols,
} from "../market-data/market-data.service";

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
const calendarDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>!Number.isNaN(Date.parse(`${value}T00:00:00Z`)));
const priceSyncSchema=z.object({bookId:z.string().uuid(),date:calendarDate});

investmentRoutes.get("/portfolio",async c=>{const {client,bookId}=await queryContext(c);return c.json(await portfolio(client,bookId));});
investmentRoutes.get("/brokerage-accounts",async c=>{const {client,bookId}=await queryContext(c);return c.json(await listBrokerageAccounts(client,bookId));});
investmentRoutes.get("/asset-types",async c=>{const {client,bookId}=await queryContext(c);return c.json(await listAssetTypes(client,bookId,c.req.query("includeInactive")==="true"));});
investmentRoutes.post("/asset-types",async c=>{const input=await parseJson(c.req.raw,createAssetTypeSchema),client=c.get("database");await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");return c.json(await createAssetType(client,c.get("user").id,input),201);});
investmentRoutes.patch("/asset-types/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await assetTypeBookId(client,id),c.get("user").id,"EDITOR");return c.json(await updateAssetType(client,c.get("user").id,id,await parseJson(c.req.raw,updateAssetTypeSchema)));});
investmentRoutes.delete("/asset-types/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await assetTypeBookId(client,id),c.get("user").id,"EDITOR");return c.json(await deleteAssetType(client,c.get("user").id,id,requiredVersion(c)));});

investmentRoutes.get("/instruments",async c=>{const {client,bookId}=await queryContext(c);return c.json(await listInstruments(client,bookId,c.req.query("includeInactive")==="true"));});
investmentRoutes.get("/market-symbols",async c=>{
  const client=c.get("database"),query=(c.req.query("q")??"").slice(0,100);
  const marketValue=c.req.query("market"),market=marketValue==="BIST"||marketValue==="US"?marketValue:undefined;
  const result=await searchMarketSymbols(client,query,market,Math.min(50,Math.max(1,Number(c.req.query("limit"))||30)));
  if(result.items.length===0){
    const catalog=await client.query(`SELECT 1 FROM market_symbols LIMIT 1`);
    if(!catalog.rowCount)await c.env.JOBS.send({type:"SYNC_MARKET_CATALOG"});
    // Not in the weekly catalog (e.g. a fresh IPO) - try resolving it live on Yahoo.
    else if(/^[A-Za-z0-9][A-Za-z0-9.-]{2,19}$/.test(query.trim())){
      try{
        const found=await findOrCreateMarketSymbol(client,query.trim(),market);
        if(found)return c.json({items:[found]});
      }catch{/* Yahoo unavailable - fall through to the empty result */}
    }
  }
  return c.json(result);
});
investmentRoutes.get("/prices/by-date",async c=>{
  const {client,bookId}=await queryContext(c),parsed=calendarDate.safeParse(c.req.query("date"));
  if(!parsed.success)throw new AppError(422,"INVALID_DATE","A valid price date is required");
  return c.json(await listBookInstrumentPrices(client,bookId,parsed.data));
});
investmentRoutes.get("/prices/sync-status",async c=>{
  const {client}=await queryContext(c),parsed=calendarDate.safeParse(c.req.query("date"));
  if(!parsed.success)throw new AppError(422,"INVALID_DATE","A valid price date is required");
  await reclaimStalePriceRuns(client);
  return c.json({run:await latestPriceSyncRun(client,parsed.data)});
});
investmentRoutes.post("/prices/sync",async c=>{
  const input=await parseJson(c.req.raw,priceSyncSchema),client=c.get("database"),userId=c.get("user").id;
  await requireBookRole(client,input.bookId,userId,"EDITOR");
  // The manual button wants a price on screen right now, so for today it pulls
  // the live intraday quote and writes it regardless of whether an official
  // close exists yet. Back-dated requests still fetch that day's real close.
  const mode=input.date===new Date().toISOString().slice(0,10)?"LIVE":"CLOSE";
  const run=await createPriceSyncRun(client,input.date,"MANUAL",userId);
  await c.env.JOBS.send({type:"PLAN_MARKET_PRICES",runId:run.id,targetDate:input.date,mode});
  return c.json(run,202);
});
investmentRoutes.post("/instruments",async c=>{const input=await parseJson(c.req.raw,createInstrumentSchema),client=c.get("database");await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");return c.json(await createInstrument(client,c.get("user").id,input),201);});
investmentRoutes.patch("/instruments/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await instrumentBookId(client,id),c.get("user").id,"EDITOR");return c.json(await updateInstrument(client,c.get("user").id,id,await parseJson(c.req.raw,updateInstrumentSchema)));});
investmentRoutes.delete("/instruments/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await instrumentBookId(client,id),c.get("user").id,"EDITOR");return c.json(await deleteInstrument(client,c.get("user").id,id,requiredVersion(c)));});
investmentRoutes.post("/instruments/:id/prices",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await instrumentBookId(client,id),c.get("user").id,"EDITOR");return c.json(await setInstrumentPrice(client,c.get("user").id,id,await parseJson(c.req.raw,createPriceSchema)),201);});

investmentRoutes.get("/lots",async c=>{const {client,bookId}=await queryContext(c);return c.json(await listLots(client,bookId));});
investmentRoutes.post("/lots",async c=>{const input=await parseJson(c.req.raw,createLotSchema),client=c.get("database");await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");return c.json(await createLot(client,c.get("user").id,input),201);});
investmentRoutes.patch("/lots/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await lotBookId(client,id),c.get("user").id,"EDITOR");return c.json(await updateLot(client,c.get("user").id,id,await parseJson(c.req.raw,updateLotSchema)));});
investmentRoutes.delete("/lots/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await lotBookId(client,id),c.get("user").id,"EDITOR");return c.json(await deleteLot(client,c.get("user").id,id,requiredVersion(c)));});
investmentRoutes.post("/capital-increases",async c=>{const input=await parseJson(c.req.raw,createCapitalIncreaseSchema),client=c.get("database");await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");return c.json(await createCapitalIncrease(client,c.get("user").id,input),201);});

investmentRoutes.get("/sales",async c=>{const {client,bookId}=await queryContext(c);return c.json(await listSales(client,bookId));});
investmentRoutes.post("/sales",async c=>{const input=await parseJson(c.req.raw,createSaleSchema),client=c.get("database");await requireBookRole(client,input.bookId,c.get("user").id,"EDITOR");return c.json(await createSale(client,c.get("user").id,input),201);});
investmentRoutes.patch("/sales/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await saleBookId(client,id),c.get("user").id,"EDITOR");return c.json(await updateSale(client,c.get("user").id,id,await parseJson(c.req.raw,updateSaleSchema)));});
investmentRoutes.delete("/sales/:id",async c=>{const client=c.get("database"),id=c.req.param("id");await requireBookRole(client,await saleBookId(client,id),c.get("user").id,"EDITOR");return c.json(await deleteSale(client,c.get("user").id,id,requiredVersion(c)));});
