import { randomBytes, randomUUID } from "node:crypto";

const apiBaseUrl = String(process.argv[2] || "").replace(/\/$/, "");
const webOrigin = String(process.argv[3] || "").replace(/\/$/, "");
if (!apiBaseUrl || !webOrigin) throw new Error("Usage: smoke-live.mjs <api-base-url> <web-origin>");

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { Origin: webOrigin, "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const code = payload?.error?.code || "UNKNOWN";
    const message = payload?.error?.message || "Request failed";
    throw new Error(`${options.method || "GET"} ${path} returned ${response.status} ${code}: ${message}`);
  }
  return { response, payload };
}

const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
const email = `smoke+${runId}@defterx.invalid`;
const password = randomBytes(32).toString("base64url");

const health = await request("/health");
const registration = await request("/api/v1/auth/register", {
  method: "POST",
  body: JSON.stringify({ email, password, displayName: "Production Smoke Test" })
});
if (registration.response.headers.get("access-control-allow-origin") !== webOrigin) {
  throw new Error("Live web origin was not accepted by API CORS policy");
}

const authorization = { Authorization: `Bearer ${registration.payload.accessToken}` };
const book = (await request("/api/v1/books", {
  method: "POST", headers: authorization,
  body: JSON.stringify({ name: `Smoke Test ${runId}`, bookType: "PERSONAL", baseCurrency: "TRY" })
})).payload;
const accountTypes = (await request(`/api/v1/account-types?bookId=${book.id}`, { headers: authorization })).payload;
const bankType = accountTypes.items.find((item) => item.name === "Banka");
const cashType = accountTypes.items.find((item) => item.name === "Nakit");
if (!bankType || !cashType) throw new Error("Seeded default account types were not found");
const account = (await request("/api/v1/accounts", {
  method: "POST", headers: authorization,
  body: JSON.stringify({ bookId: book.id, name: "Smoke Bank", accountTypeId: bankType.id, normalBalance: "DEBIT", currencyCode: "TRY", openingBalance: "1000" })
})).payload;
if (account.balance !== "1000.000000") throw new Error(`Opening balance was not posted: ${account.balance}`);
const immediateAccounts = (await request(`/api/v1/accounts?bookId=${book.id}&includeArchived=true&_=${Date.now()}`, { headers: authorization })).payload;
if (!immediateAccounts.items.some((item) => item.id === account.id)) throw new Error("Created account was not immediately visible in the live account list");
const category = (await request("/api/v1/categories", {
  method: "POST", headers: authorization,
  body: JSON.stringify({ bookId: book.id, name: "Smoke Expense", categoryType: "EXPENSE", currencyCode: "TRY" })
})).payload;
const costCenter = (await request("/api/v1/cost-centers", {
  method: "POST", headers: authorization,
  body: JSON.stringify({ bookId: book.id, name: "Smoke Vehicle", description: "Live cost-center check", sortOrder: 10 })
})).payload;

const idempotencyKey = randomUUID();
const transactionInput = {
  bookId: book.id,
  type: "EXPENSE",
  title: "Cloudflare Neon smoke transaction",
  amount: "125.50",
  currencyCode: "TRY",
  accountId: account.id,
  categoryId: category.id,
  costCenterId: costCenter.id,
  transactionDate: "2026-08-07T12:00:00.000Z",
  clientOperationId: randomUUID()
};
const transaction = (await request("/api/v1/transactions", {
  method: "POST", headers: { ...authorization, "Idempotency-Key": idempotencyKey }, body: JSON.stringify(transactionInput)
})).payload;
const repeated = (await request("/api/v1/transactions", {
  method: "POST", headers: { ...authorization, "Idempotency-Key": idempotencyKey }, body: JSON.stringify(transactionInput)
})).payload;
if (transaction.id !== repeated.id) throw new Error("Idempotency check returned a different transaction");

const balance = (await request(`/api/v1/accounts/${account.id}/balance`, { headers: authorization })).payload;
const dashboard = (await request(`/api/v1/reports/dashboard?bookId=${book.id}&from=2026-08-01&to=2026-08-31`, { headers: authorization })).payload;
const transactions = (await request(`/api/v1/transactions?bookId=${book.id}`, { headers: authorization })).payload;
if (balance.balance !== "874.500000") throw new Error(`Unexpected account balance: ${balance.balance}`);
if (dashboard.month.expense !== "125.500000") throw new Error(`Unexpected dashboard expense: ${dashboard.month.expense}`);
if (transactions.items.length !== 2) throw new Error(`Unexpected transaction count: ${transactions.items.length}`);
if (!transactions.items.some((item) => item.id === transaction.id && item.costCenterId === costCenter.id && item.costCenterName === costCenter.name)) throw new Error("Transaction cost center projection failed");
const costCenterFiltered = (await request(`/api/v1/transactions?bookId=${book.id}&costCenterId=${costCenter.id}`, { headers: authorization })).payload;
if (costCenterFiltered.items.length !== 1 || costCenterFiltered.items[0].id !== transaction.id) throw new Error("Transaction cost-center filter failed");
const expenseBreakdown = (await request(`/api/v1/reports/income-expense?bookId=${book.id}&from=2026-08-01&to=2026-08-31`, { headers: authorization })).payload;
if (!expenseBreakdown.costCenters.some((item) => item.id === costCenter.id && Number(item.amount) === -125.5)) throw new Error("Cost-center report did not include the live expense");
const cashflow = (await request(`/api/v1/reports/cash-flow?bookId=${book.id}&from=2026-08-01&to=2026-08-31`, { headers: authorization })).payload;
const analytics = (await request(`/api/v1/reports/analytics?bookId=${book.id}&from=2026-08-01T00:00:00.000Z&to=2026-08-31T23:59:59.999Z&granularity=day&accountIds=${account.id}`, { headers: authorization })).payload;
if (!Array.isArray(analytics.trend) || !Array.isArray(analytics.accountBalances?.items)
  || !Array.isArray(analytics.categoryDetail?.transactions) || !Array.isArray(analytics.liquidity?.items)
  || !Array.isArray(analytics.netWorth?.items) || !Array.isArray(analytics.netWorth?.cashAccounts)
  || !Array.isArray(analytics.instrumentComparison?.instruments) || !Array.isArray(analytics.instrumentComparison?.instrumentPoints)
  || !Array.isArray(analytics.instrumentComparison?.accounts) || !Array.isArray(analytics.instrumentComparison?.accountPoints)
  || analytics.granularity !== "day") {
  throw new Error("Analytics report suite response is incomplete");
}
if (analytics.netWorth.cashAccounts.some(
  (row) => typeof row.accountId !== "string" || typeof row.accountTypeName !== "string" || typeof row.balanceTry !== "string",
)) {
  throw new Error(`Net-worth cash breakdown rows are malformed: ${JSON.stringify(analytics.netWorth.cashAccounts)}`);
}
if (!cashflow.items.some((item) => item.month === "2026-08" && Number(item.expense) === 125.5)) throw new Error(`Cash-flow report did not use the posted live expense: ${JSON.stringify(cashflow)}`);

const restrictedAccount = (await request("/api/v1/accounts", {
  method:"POST",headers:authorization,
  body:JSON.stringify({bookId:book.id,name:"Restricted Cash",accountTypeId:cashType.id,currencyCode:"TRY",openingBalance:"0"})
})).payload;
const changedAccountType=(await request(`/api/v1/accounts/${restrictedAccount.id}`,{
  method:"PATCH",headers:authorization,
  body:JSON.stringify({accountTypeId:bankType.id,version:restrictedAccount.version})
})).payload;
if(changedAccountType.accountTypeId!==bankType.id)throw new Error("Editable account type was not persisted");

// Opening balance stays editable after the account is in use.
const openingEditable=(await request("/api/v1/accounts",{method:"POST",headers:authorization,body:JSON.stringify({bookId:book.id,name:"Opening Editable",accountTypeId:bankType.id,currencyCode:"TRY",openingBalance:"1000"})})).payload;
if(openingEditable.openingBalance!=="1000.000000")throw new Error(`Opening balance not projected on create: ${openingEditable.openingBalance}`);
const raisedOpening=(await request(`/api/v1/accounts/${openingEditable.id}`,{method:"PATCH",headers:authorization,body:JSON.stringify({openingBalance:"1500",version:openingEditable.version})})).payload;
if(raisedOpening.openingBalance!=="1500.000000"||raisedOpening.displayBalance!=="1500.000000")throw new Error(`Opening balance edit did not re-post: ${JSON.stringify(raisedOpening)}`);
const clearedOpening=(await request(`/api/v1/accounts/${openingEditable.id}`,{method:"PATCH",headers:authorization,body:JSON.stringify({openingBalance:"0",version:raisedOpening.version})})).payload;
if(clearedOpening.openingBalance!=="0"||Number(clearedOpening.displayBalance)!==0)throw new Error(`Opening balance was not cleared: ${JSON.stringify(clearedOpening)}`);
const openingLedger=(await request(`/api/v1/transactions?bookId=${book.id}&accountIds=${openingEditable.id}`,{headers:authorization})).payload;
if(openingLedger.items.some((item)=>item.type==="OPENING_BALANCE"))throw new Error("Cleared opening balance still shows a live posting");

async function expectPostingError(accountId,amount,expectedCode){
  const response=await fetch(`${apiBaseUrl}/api/v1/transactions`,{method:"POST",headers:{Origin:webOrigin,"Content-Type":"application/json",Authorization:authorization.Authorization,"Idempotency-Key":randomUUID()},body:JSON.stringify({bookId:book.id,type:"EXPENSE",title:"Limit rejection probe",amount,currencyCode:"TRY",accountId,categoryId:category.id,transactionDate:"2026-08-07T12:00:00.000Z",clientOperationId:randomUUID()})});
  const payload=await response.json();
  if(response.status!==422||payload?.error?.code!==expectedCode)throw new Error(`Expected ${expectedCode}, received ${response.status} ${payload?.error?.code}`);
}
await expectPostingError(changedAccountType.id,"1","NEGATIVE_BALANCE_NOT_ALLOWED");
const limitedAccount=(await request(`/api/v1/accounts/${changedAccountType.id}`,{method:"PATCH",headers:authorization,body:JSON.stringify({allowNegativeBalance:true,creditLimit:"50",version:changedAccountType.version})})).payload;
await expectPostingError(limitedAccount.id,"60","ACCOUNT_LIMIT_EXCEEDED");

const scheduledSeries=(await request("/api/v1/scheduled-transactions",{
  method:"POST",headers:authorization,
  body:JSON.stringify({bookId:book.id,accountId:account.id,transactionType:"EXPENSE",categoryId:category.id,costCenterId:costCenter.id,title:"Monthly smoke payment",amount:"50",currencyCode:"TRY",scheduledAt:"2026-09-10T12:00:00.000Z",recurrence:{frequency:"MONTHLY",interval:1,until:"2026-11-10T12:00:00.000Z"}})
})).payload;
if(scheduledSeries.createdCount!==3||!scheduledSeries.seriesId)throw new Error("Monthly scheduled series did not create three occurrences");
const scheduledBefore=(await request(`/api/v1/scheduled-transactions?bookId=${book.id}`,{headers:authorization})).payload;
const occurrences=scheduledBefore.items.filter(item=>item.seriesId===scheduledSeries.seriesId);
if(occurrences.length!==3)throw new Error(`Expected 3 scheduled occurrences, received ${occurrences.length}`);
const realized=(await request(`/api/v1/scheduled-transactions/${occurrences[0].id}/realize`,{
  method:"POST",headers:authorization,
  body:JSON.stringify({version:occurrences[0].version,transactionDate:"2026-08-10T12:00:00.000Z",clientOperationId:randomUUID()})
})).payload;
if(realized.scheduled?.status!=="COMPLETED"||realized.scheduled?.completedTransactionId!==realized.transaction?.id)throw new Error("Realized plan was not linked to its posted transaction");
const scheduledAfter=(await request(`/api/v1/scheduled-transactions?bookId=${book.id}`,{headers:authorization})).payload;
if(scheduledAfter.items.filter(item=>item.seriesId===scheduledSeries.seriesId).length!==2)throw new Error("Realized occurrence did not leave two pending plans");
const scheduledAll=(await request(`/api/v1/scheduled-transactions?bookId=${book.id}&view=all`,{headers:authorization})).payload;
if(scheduledAll.items.filter(item=>item.seriesId===scheduledSeries.seriesId&&item.status==="COMPLETED").length!==1)throw new Error("Completed occurrence was not available to status filters");
const transactionsAfterRealization=(await request(`/api/v1/transactions?bookId=${book.id}`,{headers:authorization})).payload;
if(!transactionsAfterRealization.items.some(item=>item.id===realized.transaction.id&&item.title==="Monthly smoke payment"&&item.costCenterId===costCenter.id))throw new Error("Realized plan was not visible in transactions with its cost center");
await request(`/api/v1/transactions/${realized.transaction.id}/reverse?bookId=${book.id}`,{
  method:"POST",headers:{...authorization,"Idempotency-Key":randomUUID()},
  body:JSON.stringify({clientOperationId:randomUUID(),reason:"Scheduled reversal smoke check"})
});
const scheduledAfterReversal=(await request(`/api/v1/scheduled-transactions?bookId=${book.id}&view=all`,{headers:authorization})).payload;
const reopened=scheduledAfterReversal.items.filter(item=>item.seriesId===scheduledSeries.seriesId&&["PENDING","OVERDUE"].includes(item.status));
if(reopened.length!==3||scheduledAfterReversal.items.some(item=>item.seriesId===scheduledSeries.seriesId&&item.status==="COMPLETED"))throw new Error("Reversing a realized transaction did not reopen its scheduled occurrence");

// Realizing with edited amount / title / account posts the transaction with the overrides.
const overrideTarget=reopened[0];
const overridden=(await request(`/api/v1/scheduled-transactions/${overrideTarget.id}/realize`,{
  method:"POST",headers:authorization,
  body:JSON.stringify({version:overrideTarget.version,clientOperationId:randomUUID(),transactionDate:"2026-08-12T12:00:00.000Z",amount:"73.25",title:"Edited smoke payment"})
})).payload;
if(overridden.transaction?.title!=="Edited smoke payment"||overridden.scheduled?.status!=="COMPLETED")throw new Error(`Realize overrides were not applied: ${JSON.stringify(overridden)}`);
const overriddenTx=(await request(`/api/v1/transactions?bookId=${book.id}`,{headers:authorization})).payload.items.find(item=>item.id===overridden.transaction.id);
if(!overriddenTx||Number(overriddenTx.amount)!==73.25||overriddenTx.title!=="Edited smoke payment")throw new Error(`Overridden realize did not persist: ${JSON.stringify(overriddenTx)}`);
await request(`/api/v1/transactions/${overridden.transaction.id}/reverse?bookId=${book.id}`,{method:"POST",headers:{...authorization,"Idempotency-Key":randomUUID()},body:JSON.stringify({clientOperationId:randomUUID(),reason:"Override realize smoke cleanup"})});

// Grouping shape is checked on a fixed 31-day August window; the period-end
// balance is checked on a window that also reaches the account's opening
// balance, which createAccount stamps with the current date.
const balanceTo=encodeURIComponent(new Date(Date.now()+86_400_000).toISOString());
const cashflowDaily=(await request(`/api/v1/reports/cash-flow?bookId=${book.id}&from=2026-08-01T00:00:00.000Z&to=2026-08-31T23:59:59.999Z&granularity=day`,{headers:authorization})).payload;
if(cashflowDaily.granularity!=="day"||cashflowDaily.items.length!==31||!cashflowDaily.items.every(item=>item.period&&item.periodStart))throw new Error("Detailed daily cash-flow grouping failed");
const cashflowBalance=(await request(`/api/v1/reports/cash-flow?bookId=${book.id}&from=2026-08-01T00:00:00.000Z&to=${balanceTo}&granularity=day`,{headers:authorization})).payload;
if(Number(cashflowBalance.items.at(-1)?.balance)!==874.5)throw new Error(`Period-end balance was not calculated from live entries: ${JSON.stringify(cashflowBalance.items.at(-1))}`);
const filteredCashflow=(await request(`/api/v1/reports/cash-flow?bookId=${book.id}&from=2026-08-01T00:00:00.000Z&to=${balanceTo}&granularity=day&accountIds=${account.id}`,{headers:authorization})).payload;
if(Number(filteredCashflow.items.at(-1)?.balance)!==874.5)throw new Error("Selected-account balance filter failed");
const emptyBalanceCashflow=(await request(`/api/v1/reports/cash-flow?bookId=${book.id}&from=2026-08-01T00:00:00.000Z&to=${balanceTo}&granularity=day&accountIds=none`,{headers:authorization})).payload;
if(emptyBalanceCashflow.items.some(item=>Number(item.balance)!==0))throw new Error("Empty account selection did not return a zero balance series");
const accountLedger=(await request(`/api/v1/transactions?bookId=${book.id}&accountIds=${account.id}&from=2026-08-01T00:00:00.000Z&to=${balanceTo}&limit=1000`,{headers:authorization})).payload;
const expenseLedgerRow=accountLedger.items.find(item=>item.id===transaction.id);
if(Number(expenseLedgerRow?.balanceDelta)!==-125.5||Number(accountLedger.items[0]?.runningBalance)!==874.5)throw new Error(`Account running balance failed: ${JSON.stringify(accountLedger.items)}`);
const carryFrom=new Date(Date.now()+86_400_000).toISOString();
const carriedLedger=(await request(`/api/v1/transactions?bookId=${book.id}&accountIds=${account.id}&from=${encodeURIComponent(carryFrom)}&to=2026-08-31T23:59:59.999Z&limit=1000`,{headers:authorization})).payload;
if(Number(carriedLedger.openingBalance)!==874.5||carriedLedger.items.length!==0)throw new Error(`Opening carry balance failed: ${JSON.stringify(carriedLedger)}`);
const noAccountLedger=(await request(`/api/v1/transactions?bookId=${book.id}&accountIds=none&limit=1000`,{headers:authorization})).payload;
if(noAccountLedger.items.length||Number(noAccountLedger.openingBalance)!==0)throw new Error("Empty multi-account transaction filter failed");

const investmentType=accountTypes.items.find((item)=>item.name==="Birikim");
if(!investmentType)throw new Error("Seeded Birikim investment account type was not found");
const brokerage=(await request("/api/v1/accounts",{method:"POST",headers:authorization,body:JSON.stringify({bookId:book.id,name:"Smoke Piapiri",accountTypeId:investmentType.id,currencyCode:"TRY",openingBalance:"0"})})).payload;
const assetTypes=(await request(`/api/v1/investments/asset-types?bookId=${book.id}`,{headers:authorization})).payload;
const instrument=(await request("/api/v1/investments/instruments",{method:"POST",headers:authorization,body:JSON.stringify({bookId:book.id,assetTypeId:assetTypes.items[0].id,name:"Smoke Fund",symbol:"SMK",currencyCode:"TRY"})})).payload;
await request("/api/v1/investments/lots",{method:"POST",headers:authorization,body:JSON.stringify({bookId:book.id,instrumentId:instrument.id,quantity:"10",unitPrice:"100",purchasedAt:"2026-08-01T12:00:00.000Z"})});
const sale=(await request("/api/v1/investments/sales",{method:"POST",headers:authorization,body:JSON.stringify({bookId:book.id,instrumentId:instrument.id,destinationAccountId:brokerage.id,quantity:"4",unitPrice:"120",soldAt:"2026-08-07T12:00:00.000Z",clientOperationId:randomUUID()})})).payload;
if(Number(sale.proceeds)!==480)throw new Error(`Unexpected sale proceeds: ${sale.proceeds}`);
if(Number(sale.gain)!==80)throw new Error(`Unexpected sale gain: ${sale.gain}`);
const positionAfterSale=(await request(`/api/v1/investments/portfolio?bookId=${book.id}`,{headers:authorization})).payload;
if(Number(positionAfterSale.items[0]?.quantity)!==6||Number(positionAfterSale.items[0]?.costBasis)!==600)throw new Error("Investment sale did not reduce portfolio quantity and cost basis");
const balanceAfterSale=(await request(`/api/v1/accounts/${brokerage.id}/balance`,{headers:authorization})).payload;
if(Number(balanceAfterSale.balance)!==480)throw new Error(`Sale proceeds did not reach destination account: ${balanceAfterSale.balance}`);
const updatedSale=(await request(`/api/v1/investments/sales/${sale.id}`,{method:"PATCH",headers:authorization,body:JSON.stringify({instrumentId:instrument.id,destinationAccountId:brokerage.id,quantity:"3",unitPrice:"130",soldAt:"2026-08-08T12:00:00.000Z",notes:"Updated smoke sale",clientOperationId:randomUUID(),reversalClientOperationId:randomUUID(),version:sale.version})})).payload;
if(Number(updatedSale.proceeds)!==390||Number(updatedSale.gain)!==90||updatedSale.transactionId===sale.transactionId)throw new Error(`Investment sale update failed: ${JSON.stringify(updatedSale)}`);
const balanceAfterSaleUpdate=(await request(`/api/v1/accounts/${brokerage.id}/balance`,{headers:authorization})).payload;
if(Number(balanceAfterSaleUpdate.balance)!==390)throw new Error(`Updated sale did not replace account proceeds: ${balanceAfterSaleUpdate.balance}`);
const positionAfterSaleUpdate=(await request(`/api/v1/investments/portfolio?bookId=${book.id}`,{headers:authorization})).payload;
if(Number(positionAfterSaleUpdate.items[0]?.quantity)!==7||Number(positionAfterSaleUpdate.items[0]?.costBasis)!==700)throw new Error("Updated sale did not recalculate portfolio position");
await request(`/api/v1/investments/sales/${sale.id}?version=${updatedSale.version}`,{method:"DELETE",headers:authorization});
const salesAfterDelete=(await request(`/api/v1/investments/sales?bookId=${book.id}`,{headers:authorization})).payload;
const balanceAfterSaleDelete=(await request(`/api/v1/accounts/${brokerage.id}/balance`,{headers:authorization})).payload;
const positionAfterSaleDelete=(await request(`/api/v1/investments/portfolio?bookId=${book.id}`,{headers:authorization})).payload;
if(salesAfterDelete.items.length!==0||Number(balanceAfterSaleDelete.balance)!==0||Number(positionAfterSaleDelete.items[0]?.quantity)!==10)throw new Error("Deleted sale did not restore portfolio and account balance");

// Aşama 5: cross-currency conversion into a foreign brokerage account.
await request("/api/v1/currencies/USD/enable",{method:"POST",headers:authorization,body:JSON.stringify({bookId:book.id})});
const usdBrokerage=(await request("/api/v1/accounts",{method:"POST",headers:authorization,body:JSON.stringify({bookId:book.id,name:"Smoke Piapiri USD",accountTypeId:investmentType.id,currencyCode:"USD",openingBalance:"0"})})).payload;
const fx=(await request("/api/v1/fx/conversions",{method:"POST",headers:authorization,body:JSON.stringify({bookId:book.id,fromAccountId:account.id,toAccountId:usdBrokerage.id,fromAmount:"350",toAmount:"10",transactionDate:"2026-08-07T12:00:00.000Z",clientOperationId:randomUUID()})})).payload;
if(fx.toCurrency!=="USD"||fx.fromCurrency!=="TRY"||Number(fx.tryAmount)!==350)throw new Error(`FX conversion projection failed: ${JSON.stringify(fx)}`);
const usdBalance=(await request(`/api/v1/accounts/${usdBrokerage.id}/balance`,{headers:authorization})).payload;
if(usdBalance.displayBalance!=="10.000000")throw new Error(`Foreign brokerage balance is not in its own currency: ${usdBalance.displayBalance}`);
if(typeof usdBalance.displayBalanceTry!=="string"||!Number.isFinite(Number(usdBalance.displayBalanceTry)))throw new Error(`Foreign account /balance is missing a TRY figure: ${JSON.stringify(usdBalance)}`);
const tlBalanceAfterFx=(await request(`/api/v1/accounts/${account.id}/balance`,{headers:authorization})).payload;
if(Number(tlBalanceAfterFx.displayBalance)!==524.5)throw new Error(`FX conversion did not debit the TL account: ${tlBalanceAfterFx.displayBalance}`);
if(tlBalanceAfterFx.displayBalanceTry!==tlBalanceAfterFx.displayBalance)throw new Error(`TRY account displayBalanceTry must equal displayBalance: ${tlBalanceAfterFx.displayBalanceTry} vs ${tlBalanceAfterFx.displayBalance}`);
const brokerageAccounts=(await request(`/api/v1/investments/brokerage-accounts?bookId=${book.id}`,{headers:authorization})).payload;
const usdRow=brokerageAccounts.items.find((item)=>item.id===usdBrokerage.id);
if(!usdRow||usdRow.currencyCode!=="USD"||typeof usdRow.displayBalanceTry!=="string")throw new Error("Foreign brokerage account list projection failed");
await request(`/api/v1/transactions/${fx.id}/reverse?bookId=${book.id}`,{method:"POST",headers:{...authorization,"Idempotency-Key":randomUUID()},body:JSON.stringify({clientOperationId:randomUUID(),reason:"FX smoke reversal"})});
const usdBalanceAfterReverse=(await request(`/api/v1/accounts/${usdBrokerage.id}/balance`,{headers:authorization})).payload;
if(Number(usdBalanceAfterReverse.displayBalance)!==0)throw new Error(`Reversing the FX conversion did not clear the foreign balance: ${usdBalanceAfterReverse.displayBalance}`);

const categoryRemoval=(await request(`/api/v1/categories/${category.id}?version=${category.version}`,{method:"DELETE",headers:authorization})).payload;
if(categoryRemoval.isActive!==false)throw new Error("Used category was not deactivated");
const costCenterRemoval=(await request(`/api/v1/cost-centers/${costCenter.id}?version=${costCenter.version}`,{method:"DELETE",headers:authorization})).payload;
if(costCenterRemoval.isActive!==false)throw new Error("Used cost center was not deactivated");
const historicalReport=(await request(`/api/v1/reports/income-expense?bookId=${book.id}&from=2026-08-01&to=2026-08-31`,{headers:authorization})).payload;
if(!historicalReport.items.some((item)=>item.id===category.id&&item.amount==="125.500000"&&item.isActive===false))throw new Error("Inactive used category disappeared from historical reports");
if(!historicalReport.costCenters.some((item)=>item.id===costCenter.id&&Number(item.amount)===-125.5&&item.isActive===false))throw new Error("Inactive used cost center disappeared from historical reports");

const rotated = await request("/api/v1/auth/refresh", {
  method: "POST", body: JSON.stringify({ refreshToken: registration.payload.refreshToken })
});
const reusedResponse = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
  method: "POST", headers: { Origin: webOrigin, "Content-Type": "application/json" },
  body: JSON.stringify({ refreshToken: registration.payload.refreshToken })
});
const reusedPayload = await reusedResponse.json();
if (reusedResponse.status !== 401 || reusedPayload?.error?.code !== "REFRESH_TOKEN_REUSE") {
  throw new Error("Refresh-token reuse protection did not reject the old token");
}

console.log(JSON.stringify({
  status: "passed",
  service: health.payload.service || "defterx-api",
  cors: "passed",
  neonWriteRead: "passed",
  bookId: book.id,
  transactionId: transaction.id,
  idempotency: "passed",
  ledgerBalance: balance.balance,
  dashboardExpense: dashboard.month.expense,
  cashflow: "passed",
  negativeBalanceRule: "passed",
  creditLimitRule: "passed",
  editableAccountType: "passed",
  editableOpeningBalance: "passed",
  scheduledRecurrence: "passed",
  scheduledRealization: "passed",
  scheduledRealizeOverrides: "passed",
  scheduledReopenAfterReversal: "passed",
  scheduledStatusFilter: "passed",
  costCenterCrud: "passed",
  costCenterTransactionFilter: "passed",
  costCenterReport: "passed",
  detailedCashflow: "passed",
  multiAccountLedger: "passed",
  openingCarryBalance: "passed",
  investmentSale: "passed",
  investmentSaleUpdate: "passed",
  investmentSaleDelete: "passed",
  inactiveCategoryHistory: "passed",
  inactiveCostCenterHistory: "passed",
  refreshRotation: Boolean(rotated.payload.refreshToken),
  refreshReuseProtection: "passed"
}, null, 2));
