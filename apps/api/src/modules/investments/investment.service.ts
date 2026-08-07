import { AppError } from "../../common/errors";
import { inTransaction, type DbClient } from "../../infrastructure/database";
import { createTransactionWithClient,reverseWithClient } from "../transactions/transaction.service";
import type {
  CreateAssetTypeInput,CreateInstrumentInput,CreateLotInput,CreatePriceInput,CreateSaleInput,
  UpdateAssetTypeInput,UpdateInstrumentInput,UpdateLotInput,UpdateSaleInput,
} from "./investment.schemas";

const typeProjection = `id,book_id AS "bookId",name,icon,is_system AS "isSystem",is_active AS "isActive",sort_order AS "sortOrder",version`;
const instrumentProjection = `i.id,i.book_id AS "bookId",i.asset_type_id AS "assetTypeId",t.name AS "assetTypeName",
  i.name,i.symbol,i.currency_code AS "currencyCode",i.is_active AS "isActive",i.version,
  latest.price::text AS "latestPrice",latest.priced_at AS "latestPriceAt"`;
const lotProjection = `l.id,l.book_id AS "bookId",l.instrument_id AS "instrumentId",i.name AS "instrumentName",i.symbol,
  l.account_id AS "accountId",a.name AS "accountName",l.quantity::text,l.unit_price::text AS "unitPrice",
  (l.quantity*l.unit_price)::text AS "costBasis",l.purchased_at AS "purchasedAt",l.notes,l.version`;
const saleProjection = `s.id,s.book_id AS "bookId",s.instrument_id AS "instrumentId",i.name AS "instrumentName",i.symbol,
  s.destination_account_id AS "destinationAccountId",a.name AS "destinationAccountName",s.transaction_id AS "transactionId",
  s.quantity::text,s.unit_price::text AS "unitPrice",(s.quantity*s.unit_price)::text AS proceeds,
  s.cost_basis::text AS "costBasis",(s.quantity*s.unit_price-s.cost_basis)::text AS gain,
  s.sold_at AS "soldAt",s.notes,s.version`;

export async function listAssetTypes(client:DbClient,bookId:string,includeInactive=false){
  const result=await client.query(`SELECT ${typeProjection} FROM investment_asset_types WHERE book_id=$1 AND deleted_at IS NULL AND ($2::boolean OR is_active=true) ORDER BY sort_order,name`,[bookId,includeInactive]);
  return {items:result.rows};
}

export async function createAssetType(client:DbClient,userId:string,input:CreateAssetTypeInput){
  return inTransaction(client,async transaction=>{
    const result=await transaction.query(`INSERT INTO investment_asset_types(book_id,name,icon,sort_order) VALUES($1,$2,$3,$4) RETURNING ${typeProjection}`,[input.bookId,input.name,input.icon??null,input.sortOrder]);
    await audit(transaction,input.bookId,userId,"INVESTMENT_ASSET_TYPE",result.rows[0].id,"CREATE",result.rows[0]);
    return result.rows[0];
  });
}

export async function updateAssetType(client:DbClient,userId:string,id:string,input:UpdateAssetTypeInput){
  return inTransaction(client,async transaction=>{
    const found=await assetTypeBookId(transaction,id);
    const result=await transaction.query(
      `UPDATE investment_asset_types SET name=COALESCE($2,name),icon=CASE WHEN $3::boolean THEN $4 ELSE icon END,
       sort_order=COALESCE($5,sort_order),is_active=COALESCE($6,is_active),updated_at=now(),version=version+1
       WHERE id=$1 AND version=$7 AND deleted_at IS NULL RETURNING ${typeProjection}`,
      [id,input.name??null,input.icon!==undefined,input.icon??null,input.sortOrder??null,input.isActive??null,input.version],
    );
    if(!result.rows[0])throw new AppError(409,"VERSION_CONFLICT","Investment type changed on another device");
    await audit(transaction,found,userId,"INVESTMENT_ASSET_TYPE",id,"UPDATE",result.rows[0]);
    return result.rows[0];
  });
}

export async function deleteAssetType(client:DbClient,userId:string,id:string,version:number){
  return inTransaction(client,async transaction=>{
    const bookId=await assetTypeBookId(transaction,id);
    const used=await transaction.query(`SELECT 1 FROM investment_instruments WHERE asset_type_id=$1 AND deleted_at IS NULL LIMIT 1`,[id]);
    const result=used.rowCount
      ? await transaction.query(`UPDATE investment_asset_types SET is_active=false,updated_at=now(),version=version+1 WHERE id=$1 AND version=$2 RETURNING id,false AS "isActive",version`,[id,version])
      : await transaction.query(`UPDATE investment_asset_types SET is_active=false,deleted_at=now(),updated_at=now(),version=version+1 WHERE id=$1 AND version=$2 RETURNING id,true AS deleted,version`,[id,version]);
    if(!result.rows[0])throw new AppError(409,"VERSION_CONFLICT","Investment type changed on another device");
    await audit(transaction,bookId,userId,"INVESTMENT_ASSET_TYPE",id,used.rowCount?"DEACTIVATE":"DELETE",result.rows[0]);
    return result.rows[0];
  });
}

export async function listInstruments(client:DbClient,bookId:string,includeInactive=false){
  const result=await client.query(
    `SELECT ${instrumentProjection} FROM investment_instruments i
     JOIN investment_asset_types t ON t.id=i.asset_type_id
     LEFT JOIN LATERAL (SELECT price,priced_at FROM investment_prices WHERE instrument_id=i.id ORDER BY priced_at DESC,id DESC LIMIT 1) latest ON true
     WHERE i.book_id=$1 AND i.deleted_at IS NULL AND ($2::boolean OR i.is_active=true) ORDER BY t.sort_order,i.name`,
    [bookId,includeInactive],
  );
  return {items:result.rows};
}

export async function createInstrument(client:DbClient,userId:string,input:CreateInstrumentInput){
  return inTransaction(client,async transaction=>{
    await assertAssetType(transaction,input.bookId,input.assetTypeId);
    const inserted=await transaction.query<{id:string}>(
      `INSERT INTO investment_instruments(book_id,asset_type_id,name,symbol,currency_code) VALUES($1,$2,$3,$4,$5) RETURNING id`,
      [input.bookId,input.assetTypeId,input.name,input.symbol??null,input.currencyCode],
    );
    const value=(await findInstrument(transaction,inserted.rows[0]!.id))!;
    await audit(transaction,input.bookId,userId,"INVESTMENT_INSTRUMENT",value.id,"CREATE",value);
    return value;
  });
}

export async function updateInstrument(client:DbClient,userId:string,id:string,input:UpdateInstrumentInput){
  return inTransaction(client,async transaction=>{
    const bookId=await instrumentBookId(transaction,id);
    if(input.assetTypeId)await assertAssetType(transaction,bookId,input.assetTypeId);
    const result=await transaction.query(
      `UPDATE investment_instruments SET asset_type_id=COALESCE($2,asset_type_id),name=COALESCE($3,name),
       symbol=CASE WHEN $4::boolean THEN $5 ELSE symbol END,is_active=COALESCE($6,is_active),updated_at=now(),version=version+1
       WHERE id=$1 AND version=$7 AND deleted_at IS NULL RETURNING id`,
      [id,input.assetTypeId??null,input.name??null,input.symbol!==undefined,input.symbol??null,input.isActive??null,input.version],
    );
    if(!result.rows[0])throw new AppError(409,"VERSION_CONFLICT","Investment instrument changed on another device");
    const value=(await findInstrument(transaction,id))!;
    await audit(transaction,bookId,userId,"INVESTMENT_INSTRUMENT",id,"UPDATE",value);
    return value;
  });
}

export async function deleteInstrument(client:DbClient,userId:string,id:string,version:number){
  return inTransaction(client,async transaction=>{
    const bookId=await instrumentBookId(transaction,id);
    const used=await transaction.query(`SELECT 1 FROM investment_lots WHERE instrument_id=$1 AND deleted_at IS NULL LIMIT 1`,[id]);
    const result=used.rowCount
      ? await transaction.query(`UPDATE investment_instruments SET is_active=false,updated_at=now(),version=version+1 WHERE id=$1 AND version=$2 RETURNING id,false AS "isActive",version`,[id,version])
      : await transaction.query(`UPDATE investment_instruments SET is_active=false,deleted_at=now(),updated_at=now(),version=version+1 WHERE id=$1 AND version=$2 RETURNING id,true AS deleted,version`,[id,version]);
    if(!result.rows[0])throw new AppError(409,"VERSION_CONFLICT","Investment instrument changed on another device");
    await audit(transaction,bookId,userId,"INVESTMENT_INSTRUMENT",id,used.rowCount?"DEACTIVATE":"DELETE",result.rows[0]);
    return result.rows[0];
  });
}

export async function setInstrumentPrice(client:DbClient,userId:string,instrumentId:string,input:CreatePriceInput){
  return inTransaction(client,async transaction=>{
    const bookId=await instrumentBookId(transaction,instrumentId);
    const result=await transaction.query(
      `INSERT INTO investment_prices(instrument_id,price,priced_at) VALUES($1,$2,$3)
       ON CONFLICT(instrument_id,priced_at) DO UPDATE SET price=excluded.price
       RETURNING id,instrument_id AS "instrumentId",price::text,priced_at AS "pricedAt"`,
      [instrumentId,input.price,input.pricedAt],
    );
    await audit(transaction,bookId,userId,"INVESTMENT_PRICE",result.rows[0].id,"UPSERT",result.rows[0]);
    return result.rows[0];
  });
}

export async function listLots(client:DbClient,bookId:string){
  const result=await client.query(
    `SELECT ${lotProjection} FROM investment_lots l JOIN investment_instruments i ON i.id=l.instrument_id
     LEFT JOIN accounts a ON a.id=l.account_id WHERE l.book_id=$1 AND l.deleted_at IS NULL ORDER BY l.purchased_at DESC,l.created_at DESC`,
    [bookId],
  );
  return {items:result.rows};
}

export async function createLot(client:DbClient,userId:string,input:CreateLotInput){
  return inTransaction(client,async transaction=>{
    await transaction.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[input.instrumentId]);
    await assertInvestmentScope(transaction,input.bookId,input.instrumentId,input.accountId);
    const inserted=await transaction.query<{id:string}>(
      `INSERT INTO investment_lots(book_id,instrument_id,account_id,quantity,unit_price,purchased_at,notes)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [input.bookId,input.instrumentId,input.accountId??null,input.quantity,input.unitPrice,input.purchasedAt,input.notes??null],
    );
    const value=(await findLot(transaction,inserted.rows[0]!.id))!;
    await audit(transaction,input.bookId,userId,"INVESTMENT_LOT",value.id,"CREATE",value);
    return value;
  });
}

export async function updateLot(client:DbClient,userId:string,id:string,input:UpdateLotInput){
  return inTransaction(client,async transaction=>{
    const found=await transaction.query<{book_id:string;instrument_id:string;account_id:string|null}>(`SELECT book_id,instrument_id,account_id FROM investment_lots WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,[id]);
    const current=found.rows[0];
    if(!current)throw new AppError(404,"INVESTMENT_LOT_NOT_FOUND","Investment lot was not found");
    await transaction.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[current.instrument_id]);
    await assertLotHistoryEditable(transaction,current.instrument_id);
    await assertInvestmentScope(transaction,current.book_id,input.instrumentId??current.instrument_id,input.accountId===undefined?current.account_id:input.accountId);
    const result=await transaction.query(
      `UPDATE investment_lots SET instrument_id=COALESCE($2,instrument_id),account_id=CASE WHEN $3::boolean THEN $4 ELSE account_id END,
       quantity=COALESCE($5,quantity),unit_price=COALESCE($6,unit_price),purchased_at=COALESCE($7,purchased_at),
       notes=CASE WHEN $8::boolean THEN $9 ELSE notes END,updated_at=now(),version=version+1
       WHERE id=$1 AND version=$10 RETURNING id`,
      [id,input.instrumentId??null,input.accountId!==undefined,input.accountId??null,input.quantity??null,input.unitPrice??null,input.purchasedAt??null,input.notes!==undefined,input.notes??null,input.version],
    );
    if(!result.rows[0])throw new AppError(409,"VERSION_CONFLICT","Investment lot changed on another device");
    const value=(await findLot(transaction,id))!;
    await audit(transaction,current.book_id,userId,"INVESTMENT_LOT",id,"UPDATE",value);
    return value;
  });
}

export async function deleteLot(client:DbClient,userId:string,id:string,version:number){
  return inTransaction(client,async transaction=>{
    const found=await transaction.query<{book_id:string;instrument_id:string}>(`SELECT book_id,instrument_id FROM investment_lots WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,[id]);
    if(!found.rows[0])throw new AppError(404,"INVESTMENT_LOT_NOT_FOUND","Investment lot was not found");
    await transaction.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[found.rows[0].instrument_id]);
    await assertLotHistoryEditable(transaction,found.rows[0].instrument_id);
    const result=await transaction.query(`UPDATE investment_lots SET deleted_at=now(),updated_at=now(),version=version+1 WHERE id=$1 AND version=$2 RETURNING id,true AS deleted,version`,[id,version]);
    if(!result.rows[0])throw new AppError(409,"VERSION_CONFLICT","Investment lot changed on another device");
    await audit(transaction,found.rows[0].book_id,userId,"INVESTMENT_LOT",id,"DELETE",result.rows[0]);
    return result.rows[0];
  });
}

export async function portfolio(client:DbClient,bookId:string){
  const result=await client.query(
    `WITH purchases AS (
       SELECT instrument_id,SUM(quantity) quantity,SUM(quantity*unit_price) cost_basis
       FROM investment_lots WHERE book_id=$1 AND deleted_at IS NULL GROUP BY instrument_id
     ), sales AS (
       SELECT instrument_id,SUM(quantity) quantity,SUM(cost_basis) cost_basis,
              SUM(quantity*unit_price-cost_basis) realized_gain
       FROM investment_sales WHERE book_id=$1 AND deleted_at IS NULL GROUP BY instrument_id
     )
     SELECT i.id AS "instrumentId",i.name,i.symbol,t.name AS "assetTypeName",i.currency_code AS "currencyCode",
       (p.quantity-COALESCE(s.quantity,0))::text quantity,
       (p.cost_basis-COALESCE(s.cost_basis,0))::text AS "costBasis",
       COALESCE(s.realized_gain,0)::text AS "realizedGain",
       latest.price::text AS "latestPrice",latest.priced_at AS "latestPriceAt",
       CASE WHEN latest.price IS NULL THEN NULL ELSE ((p.quantity-COALESCE(s.quantity,0))*latest.price)::text END AS "currentValue",
       CASE WHEN latest.price IS NULL THEN NULL ELSE ((p.quantity-COALESCE(s.quantity,0))*latest.price-(p.cost_basis-COALESCE(s.cost_basis,0)))::text END AS gain,
       CASE WHEN latest.price IS NULL OR (p.cost_basis-COALESCE(s.cost_basis,0))=0 THEN NULL
            ELSE ((((p.quantity-COALESCE(s.quantity,0))*latest.price-(p.cost_basis-COALESCE(s.cost_basis,0)))/(p.cost_basis-COALESCE(s.cost_basis,0)))*100)::text END AS "gainPercent"
     FROM purchases p JOIN investment_instruments i ON i.id=p.instrument_id
     JOIN investment_asset_types t ON t.id=i.asset_type_id
     LEFT JOIN sales s ON s.instrument_id=i.id
     LEFT JOIN LATERAL (SELECT price,priced_at FROM investment_prices WHERE instrument_id=i.id ORDER BY priced_at DESC,id DESC LIMIT 1) latest ON true
     WHERE p.quantity-COALESCE(s.quantity,0)>0
     ORDER BY i.name`,
    [bookId],
  );
  return {items:result.rows};
}

export async function listSales(client:DbClient,bookId:string){
  const result=await client.query(
    `SELECT ${saleProjection} FROM investment_sales s
     JOIN investment_instruments i ON i.id=s.instrument_id
     JOIN accounts a ON a.id=s.destination_account_id
     WHERE s.book_id=$1 AND s.deleted_at IS NULL ORDER BY s.sold_at DESC,s.created_at DESC`,
    [bookId],
  );
  return {items:result.rows};
}

export async function createSale(client:DbClient,userId:string,input:CreateSaleInput){
  return inTransaction(client,async transaction=>{
    const duplicate=await transaction.query<{id:string}>(
      `SELECT id FROM investment_sales WHERE book_id=$1 AND client_operation_id=$2 AND deleted_at IS NULL`,
      [input.bookId,input.clientOperationId],
    );
    if(duplicate.rows[0])return findSale(transaction,duplicate.rows[0].id);
    await transaction.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[input.instrumentId]);
    await assertInvestmentScope(transaction,input.bookId,input.instrumentId,input.destinationAccountId);
    const instrument=await transaction.query<{name:string;currency_code:string}>(
      `SELECT name,currency_code FROM investment_instruments WHERE id=$1 AND book_id=$2 AND deleted_at IS NULL`,
      [input.instrumentId,input.bookId],
    );
    const values=await saleValues(transaction,input.bookId,input.instrumentId,input.quantity,input.unitPrice);
    const equity=await transaction.query<{id:string}>(
      `SELECT id FROM accounts WHERE book_id=$1 AND account_type='SYSTEM_EQUITY' AND deleted_at IS NULL LIMIT 1`,
      [input.bookId],
    );
    if(!equity.rows[0])throw new AppError(500,"EQUITY_ACCOUNT_MISSING","Investment sale offset account is missing");
    const posted=await createTransactionWithClient(transaction,userId,{
      bookId:input.bookId,type:"ADJUSTMENT",title:`Birikim satışı: ${instrument.rows[0]!.name}`,
      amount:values.proceeds,currencyCode:instrument.rows[0]!.currency_code,
      accountId:input.destinationAccountId,targetAccountId:equity.rows[0].id,
      transactionDate:input.soldAt,clientOperationId:input.clientOperationId,
      description:input.notes??"Birikim satış bedeli",
    });
    const inserted=await transaction.query<{id:string}>(
      `INSERT INTO investment_sales(book_id,instrument_id,destination_account_id,transaction_id,client_operation_id,
        quantity,unit_price,cost_basis,sold_at,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [input.bookId,input.instrumentId,input.destinationAccountId,posted.id,input.clientOperationId,input.quantity,input.unitPrice,values.cost_basis,input.soldAt,input.notes??null],
    );
    const value=(await findSale(transaction,inserted.rows[0]!.id))!;
    await audit(transaction,input.bookId,userId,"INVESTMENT_SALE",value.id,"CREATE",value);
    return value;
  });
}

export async function updateSale(client:DbClient,userId:string,id:string,input:UpdateSaleInput){
  return inTransaction(client,async transaction=>{
    const found=await transaction.query<{book_id:string;instrument_id:string;transaction_id:string;version:number}>(
      `SELECT book_id,instrument_id,transaction_id,version FROM investment_sales WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,[id],
    );
    const current=found.rows[0];
    if(!current)throw new AppError(404,"INVESTMENT_SALE_NOT_FOUND","Investment sale was not found");
    if(current.version!==input.version)throw new AppError(409,"VERSION_CONFLICT","Investment sale changed on another device");
    for(const instrumentId of [...new Set([current.instrument_id,input.instrumentId])].sort())await transaction.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[instrumentId]);
    await assertInvestmentScope(transaction,current.book_id,input.instrumentId,input.destinationAccountId);
    const instrument=await transaction.query<{name:string;currency_code:string}>(
      `SELECT name,currency_code FROM investment_instruments WHERE id=$1 AND book_id=$2 AND deleted_at IS NULL`,[input.instrumentId,current.book_id],
    );
    const values=await saleValues(transaction,current.book_id,input.instrumentId,input.quantity,input.unitPrice,id);
    const equity=await transaction.query<{id:string}>(
      `SELECT id FROM accounts WHERE book_id=$1 AND account_type='SYSTEM_EQUITY' AND deleted_at IS NULL LIMIT 1`,[current.book_id],
    );
    if(!equity.rows[0])throw new AppError(500,"EQUITY_ACCOUNT_MISSING","Investment sale offset account is missing");
    await reverseWithClient(transaction,userId,current.book_id,current.transaction_id,input.reversalClientOperationId,"Birikim satışı düzeltildi",false);
    const posted=await createTransactionWithClient(transaction,userId,{
      bookId:current.book_id,type:"ADJUSTMENT",title:`Birikim satışı: ${instrument.rows[0]!.name}`,
      amount:values.proceeds,currencyCode:instrument.rows[0]!.currency_code,
      accountId:input.destinationAccountId,targetAccountId:equity.rows[0].id,
      transactionDate:input.soldAt,clientOperationId:input.clientOperationId,
      description:input.notes??"Birikim satış bedeli",
    });
    const updated=await transaction.query<{id:string}>(
      `UPDATE investment_sales SET instrument_id=$2,destination_account_id=$3,transaction_id=$4,client_operation_id=$5,
       quantity=$6,unit_price=$7,cost_basis=$8,sold_at=$9,notes=$10,updated_at=now(),version=version+1
       WHERE id=$1 AND version=$11 AND deleted_at IS NULL RETURNING id`,
      [id,input.instrumentId,input.destinationAccountId,posted.id,input.clientOperationId,input.quantity,input.unitPrice,values.cost_basis,input.soldAt,input.notes??null,input.version],
    );
    if(!updated.rows[0])throw new AppError(409,"VERSION_CONFLICT","Investment sale changed on another device");
    const value=(await findSale(transaction,id))!;
    await audit(transaction,current.book_id,userId,"INVESTMENT_SALE",id,"UPDATE",value);
    return value;
  });
}

export async function deleteSale(client:DbClient,userId:string,id:string,version:number){
  return inTransaction(client,async transaction=>{
    const found=await transaction.query<{book_id:string;instrument_id:string;transaction_id:string;version:number}>(
      `SELECT book_id,instrument_id,transaction_id,version FROM investment_sales WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,[id],
    );
    const current=found.rows[0];
    if(!current)throw new AppError(404,"INVESTMENT_SALE_NOT_FOUND","Investment sale was not found");
    if(current.version!==version)throw new AppError(409,"VERSION_CONFLICT","Investment sale changed on another device");
    await transaction.query(`SELECT pg_advisory_xact_lock(hashtext($1))`,[current.instrument_id]);
    await reverseWithClient(transaction,userId,current.book_id,current.transaction_id,crypto.randomUUID(),"Birikim satışı silindi",false);
    const deleted=await transaction.query(
      `UPDATE investment_sales SET deleted_at=now(),updated_at=now(),version=version+1 WHERE id=$1 AND version=$2 AND deleted_at IS NULL RETURNING id,true AS deleted,version`,[id,version],
    );
    if(!deleted.rows[0])throw new AppError(409,"VERSION_CONFLICT","Investment sale changed on another device");
    await audit(transaction,current.book_id,userId,"INVESTMENT_SALE",id,"DELETE",deleted.rows[0]);
    return deleted.rows[0];
  });
}

async function saleValues(client:DbClient,bookId:string,instrumentId:string,quantity:string,unitPrice:string,excludedSaleId:string|null=null){
  const position=await client.query<{available:string;remaining_cost:string;enough:boolean;cost_basis:string;proceeds:string}>(
    `WITH position_values AS (
       SELECT
         COALESCE((SELECT SUM(quantity) FROM investment_lots WHERE book_id=$1 AND instrument_id=$2 AND deleted_at IS NULL),0)
           -COALESCE((SELECT SUM(quantity) FROM investment_sales WHERE book_id=$1 AND instrument_id=$2 AND deleted_at IS NULL AND ($5::uuid IS NULL OR id<>$5)),0) available,
         COALESCE((SELECT SUM(quantity*unit_price) FROM investment_lots WHERE book_id=$1 AND instrument_id=$2 AND deleted_at IS NULL),0)
           -COALESCE((SELECT SUM(cost_basis) FROM investment_sales WHERE book_id=$1 AND instrument_id=$2 AND deleted_at IS NULL AND ($5::uuid IS NULL OR id<>$5)),0) remaining_cost
     )
     SELECT available::text,remaining_cost::text,available >= $3::numeric AS enough,
            ROUND((remaining_cost/NULLIF(available,0))*$3::numeric,6)::text AS cost_basis,
            ROUND($3::numeric*$4::numeric,6)::text AS proceeds
     FROM position_values`,
    [bookId,instrumentId,quantity,unitPrice,excludedSaleId],
  );
  const values=position.rows[0]!;
  if(!values.enough)throw new AppError(422,"INVESTMENT_QUANTITY_EXCEEDED",`Sale quantity exceeds the available ${values.available} units`);
  return values;
}

async function findInstrument(client:DbClient,id:string){
  const result=await client.query(`SELECT ${instrumentProjection} FROM investment_instruments i JOIN investment_asset_types t ON t.id=i.asset_type_id LEFT JOIN LATERAL (SELECT price,priced_at FROM investment_prices WHERE instrument_id=i.id ORDER BY priced_at DESC,id DESC LIMIT 1) latest ON true WHERE i.id=$1 AND i.deleted_at IS NULL`,[id]);
  return result.rows[0];
}
async function findLot(client:DbClient,id:string){
  const result=await client.query(`SELECT ${lotProjection} FROM investment_lots l JOIN investment_instruments i ON i.id=l.instrument_id LEFT JOIN accounts a ON a.id=l.account_id WHERE l.id=$1 AND l.deleted_at IS NULL`,[id]);
  return result.rows[0];
}
async function findSale(client:DbClient,id:string){
  const result=await client.query(`SELECT ${saleProjection} FROM investment_sales s JOIN investment_instruments i ON i.id=s.instrument_id JOIN accounts a ON a.id=s.destination_account_id WHERE s.id=$1 AND s.deleted_at IS NULL`,[id]);
  return result.rows[0];
}
export async function assetTypeBookId(client:DbClient,id:string){
  const result=await client.query<{book_id:string}>(`SELECT book_id FROM investment_asset_types WHERE id=$1 AND deleted_at IS NULL`,[id]);
  if(!result.rows[0])throw new AppError(404,"INVESTMENT_TYPE_NOT_FOUND","Investment type was not found");
  return result.rows[0].book_id;
}
export async function instrumentBookId(client:DbClient,id:string){
  const result=await client.query<{book_id:string}>(`SELECT book_id FROM investment_instruments WHERE id=$1 AND deleted_at IS NULL`,[id]);
  if(!result.rows[0])throw new AppError(404,"INVESTMENT_INSTRUMENT_NOT_FOUND","Investment instrument was not found");
  return result.rows[0].book_id;
}
export async function lotBookId(client:DbClient,id:string){
  const result=await client.query<{book_id:string}>(`SELECT book_id FROM investment_lots WHERE id=$1 AND deleted_at IS NULL`,[id]);
  if(!result.rows[0])throw new AppError(404,"INVESTMENT_LOT_NOT_FOUND","Investment lot was not found");
  return result.rows[0].book_id;
}
export async function saleBookId(client:DbClient,id:string){
  const result=await client.query<{book_id:string}>(`SELECT book_id FROM investment_sales WHERE id=$1 AND deleted_at IS NULL`,[id]);
  if(!result.rows[0])throw new AppError(404,"INVESTMENT_SALE_NOT_FOUND","Investment sale was not found");
  return result.rows[0].book_id;
}
async function assertAssetType(client:DbClient,bookId:string,id:string){
  const result=await client.query(`SELECT 1 FROM investment_asset_types WHERE id=$1 AND book_id=$2 AND is_active=true AND deleted_at IS NULL`,[id,bookId]);
  if(!result.rowCount)throw new AppError(422,"INVESTMENT_TYPE_INVALID","Investment type is unavailable");
}
async function assertInvestmentScope(client:DbClient,bookId:string,instrumentId:string,accountId?:string|null){
  const instrument=await client.query(`SELECT 1 FROM investment_instruments WHERE id=$1 AND book_id=$2 AND is_active=true AND deleted_at IS NULL`,[instrumentId,bookId]);
  if(!instrument.rowCount)throw new AppError(422,"INVESTMENT_INSTRUMENT_INVALID","Investment instrument is unavailable");
  if(accountId){
    const account=await client.query(`SELECT 1 FROM accounts WHERE id=$1 AND book_id=$2 AND is_system=false AND is_archived=false AND deleted_at IS NULL`,[accountId,bookId]);
    if(!account.rowCount)throw new AppError(422,"ACCOUNT_UNAVAILABLE","Investment account is unavailable");
  }
}
async function assertLotHistoryEditable(client:DbClient,instrumentId:string){
  const sold=await client.query(`SELECT 1 FROM investment_sales WHERE instrument_id=$1 AND deleted_at IS NULL LIMIT 1`,[instrumentId]);
  if(sold.rowCount)throw new AppError(409,"INVESTMENT_HISTORY_LOCKED","Purchase lots cannot change after a sale; add a correcting lot instead");
}
async function audit(client:DbClient,bookId:string,userId:string,entityType:string,entityId:string,action:string,value:unknown){
  await client.query(`INSERT INTO audit_logs(book_id,actor_user_id,entity_type,entity_id,action,new_values) VALUES($1,$2,$3,$4,$5,$6)`,[bookId,userId,entityType,entityId,action,JSON.stringify(value)]);
}
