const query=(values)=>new URLSearchParams(Object.entries(values).filter(([,value])=>value!==undefined&&value!==null&&value!=="")).toString();
const isoDay=(value)=>String(value||"").slice(0,10);
const nowIso=()=>new Date().toISOString();
const monthStart=()=>{const d=new Date();return new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),1)).toISOString();};
const subtractUtcMonths=(date,count)=>{const result=new Date(date),day=result.getUTCDate();result.setUTCDate(1);result.setUTCMonth(result.getUTCMonth()-count);const lastDay=new Date(Date.UTC(result.getUTCFullYear(),result.getUTCMonth()+1,0)).getUTCDate();result.setUTCDate(Math.min(day,lastDay));return result;};
const cashflowWindow=(selection="6M")=>{const now=new Date(),year=now.getUTCFullYear(),month=now.getUTCMonth();let start,granularity="month";switch(selection){case"1M":start=subtractUtcMonths(now,1);granularity="day";break;case"3M":start=subtractUtcMonths(now,3);granularity="week";break;case"YTD":start=new Date(Date.UTC(year,0,1));break;case"1Y":start=new Date(Date.UTC(year,month-11,1));break;case"5Y":start=new Date(Date.UTC(year-4,0,1));granularity="year";break;case"10Y":start=new Date(Date.UTC(year-9,0,1));granularity="year";break;default:start=new Date(Date.UTC(year,month-5,1));selection="6M";}return{selection,from:start.toISOString(),to:now.toISOString(),granularity};};
const cashflowLabel=(item,granularity)=>{const date=new Date(item.periodStart||`${item.period}-01T12:00:00Z`);if(granularity==="year")return String(date.getUTCFullYear());if(granularity==="day")return new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",timeZone:"UTC"}).format(date);if(granularity==="week")return new Intl.DateTimeFormat("tr-TR",{day:"2-digit",month:"short",timeZone:"UTC"}).format(date);return new Intl.DateTimeFormat("tr-TR",{month:"short",timeZone:"UTC"}).format(date);};

export class LiveFinanceRepository {
  constructor(api){
    this.api=api;
    this.state={user:null,book:null,accounts:[],categories:[],transactions:[],transactionOpeningBalance:0,upcoming:[],upcomingFilter:"OPEN",dashboard:{month:{income:"0",expense:"0"},importantAccounts:[],recentTransactions:[],upcoming:[]},cashflow:[],cashflowRange:"6M",cashflowMeta:null,cashflowVisible:{income:true,expense:true,balance:true},cashflowAccountIds:[],cashflowAccountsInitialized:false,reportItems:[],investmentTypes:[],instruments:[],lots:[],sales:[],portfolio:[]};
  }
  snapshot(){return this.state;}
  async initialize(){
    if(!this.api.hasSession())throw new Error("AUTH_REQUIRED");
    this.state.user=this.api.session?.user||null;
    let books=await this.api.request("/api/v1/books");
    if(books.items[0])this.state.book=books.items[0];
    else{
      try{this.state.book=await this.api.request("/api/v1/books",{method:"POST",body:{name:"Kişisel Defter",bookType:"PERSONAL",baseCurrency:"TRY"}});}
      catch(error){
        if(error.status<500)throw error;
        await new Promise(resolve=>setTimeout(resolve,350));
        books=await this.api.request("/api/v1/books");
        this.state.book=books.items[0]||await this.api.request("/api/v1/books",{method:"POST",body:{name:"Kişisel Defter",bookType:"PERSONAL",baseCurrency:"TRY"}});
      }
    }
    await this.refresh();
    return this.state;
  }
  async refresh(){
    const bookId=this.state.book.id;
    const revision=Date.now();
    const base=`bookId=${encodeURIComponent(bookId)}&_=${revision}`;
    const [accounts,categories,transactions,scheduled]=await Promise.all([
      this.api.request(`/api/v1/accounts?${base}&includeArchived=true`),
      this.api.request(`/api/v1/categories?${base}&includeInactive=true`),
      this.api.request(`/api/v1/transactions?${base}&limit=1000`),
      this.api.request(`/api/v1/scheduled-transactions?${base}&view=all`),
    ]);
    const mappedAccounts=accounts.items.map(item=>({...item,balance:Number(item.displayBalance??item.balance)||0}));
    const previousActiveIds=this.state.accounts.filter(item=>!item.isArchived).map(item=>item.id);
    const allWereSelected=this.state.cashflowAccountsInitialized&&previousActiveIds.every(id=>this.state.cashflowAccountIds.includes(id));
    const activeIds=mappedAccounts.filter(item=>!item.isArchived).map(item=>item.id);
    if(!this.state.cashflowAccountsInitialized||allWereSelected)this.state.cashflowAccountIds=activeIds;
    else this.state.cashflowAccountIds=this.state.cashflowAccountIds.filter(id=>activeIds.includes(id));
    this.state.cashflowAccountsInitialized=true;
    this.state.accounts=mappedAccounts;
    const cashWindow=cashflowWindow(this.state.cashflowRange);
    const [dashboard,cashflow,reports]=await Promise.all([
      this.api.request(`/api/v1/reports/dashboard?${query({bookId,from:monthStart(),to:nowIso(),_:revision})}`),
      this.api.request(`/api/v1/reports/cash-flow?${query({bookId,from:cashWindow.from,to:cashWindow.to,granularity:cashWindow.granularity,accountIds:this.cashflowAccountFilter(),_:revision})}`),
      this.api.request(`/api/v1/reports/income-expense?${query({bookId,from:monthStart(),to:nowIso(),_:revision})}`),
    ]);
    const [types,instruments,lots,sales,portfolio]=await Promise.all([
      this.api.request(`/api/v1/investments/asset-types?${base}&includeInactive=true`),
      this.api.request(`/api/v1/investments/instruments?${base}&includeInactive=true`),
      this.api.request(`/api/v1/investments/lots?${base}`),
      this.api.request(`/api/v1/investments/sales?${base}`),
      this.api.request(`/api/v1/investments/portfolio?${base}`),
    ]);
    this.state.categories=categories.items.map(item=>({...item,kind:item.categoryType.toLowerCase()}));
    this.applyTransactions(transactions);
    this.state.upcoming=scheduled.items.map(item=>({...item,kind:item.transactionType.toLowerCase(),date:isoDay(item.scheduledAt),amount:Number(item.amount)||0,category:this.state.categories.find(c=>c.id===item.categoryId)?.name||""}));
    this.state.dashboard=dashboard;
    this.applyCashflow(cashflow,cashWindow);
    this.state.reportItems=reports.items.map(item=>({...item,amount:Number(item.amount)||0,kind:item.type.toLowerCase()}));
    this.state.investmentTypes=types.items;
    this.state.instruments=instruments.items;
    this.state.lots=lots.items;
    this.state.sales=sales.items;
    this.state.portfolio=portfolio.items;
    return this.state;
  }
  bookId(){return this.state.book.id;}
  applyTransactions(result){this.state.transactionOpeningBalance=Number(result.openingBalance)||0;this.state.transactions=result.items.map(item=>({...item,kind:item.type.toLowerCase(),description:item.title,date:isoDay(item.transactionDate),amount:Number(item.amount)||0,balanceDelta:Number(item.balanceDelta)||0,runningBalance:Number(item.runningBalance)||0}));return this.state.transactions;}
  async loadTransactions({accountIds,from="",to=""}={}){const accountFilter=accountIds===undefined?undefined:(accountIds.length?accountIds.join(","):"none"),result=await this.api.request(`/api/v1/transactions?${query({bookId:this.bookId(),limit:1000,accountIds:accountFilter,from:from?`${from}T00:00:00.000Z`:undefined,to:to?`${to}T23:59:59.999Z`:undefined,_:Date.now()})}`);return this.applyTransactions(result);}
  cashflowAccountFilter(){return this.state.cashflowAccountIds.length?this.state.cashflowAccountIds.join(","):"none";}
  applyCashflow(result,window){this.state.cashflowRange=window.selection;this.state.cashflowMeta={from:window.from,to:window.to,granularity:result.granularity||window.granularity};this.state.cashflow=result.items.map(item=>({...item,label:cashflowLabel(item,result.granularity||window.granularity),income:Number(item.income)||0,expense:Number(item.expense)||0,net:Number(item.net)||0,balance:Number(item.balance)||0}));}
  async loadCashflow(selection){const window=cashflowWindow(selection),result=await this.api.request(`/api/v1/reports/cash-flow?${query({bookId:this.bookId(),from:window.from,to:window.to,granularity:window.granularity,accountIds:this.cashflowAccountFilter(),_:Date.now()})}`);this.applyCashflow(result,window);return this.state.cashflow;}
  async loadCashflowAccounts(accountIds){const activeIds=new Set(this.state.accounts.filter(item=>!item.isArchived).map(item=>item.id)),previous=this.state.cashflowAccountIds;this.state.cashflowAccountIds=[...new Set(accountIds)].filter(id=>activeIds.has(id));try{return await this.loadCashflow(this.state.cashflowRange);}catch(error){this.state.cashflowAccountIds=previous;throw error;}}
  async createTransaction(input){return this.api.request("/api/v1/transactions",{method:"POST",headers:{"Idempotency-Key":crypto.randomUUID()},body:{bookId:this.bookId(),currencyCode:"TRY",clientOperationId:crypto.randomUUID(),...input}});}
  async correctTransaction(id,input){return this.api.request(`/api/v1/transactions/${id}/correct?bookId=${this.bookId()}`,{method:"POST",headers:{"Idempotency-Key":crypto.randomUUID()},body:{reason:"Web arayüzünden düzeltildi",reversalClientOperationId:crypto.randomUUID(),replacement:{bookId:this.bookId(),currencyCode:"TRY",clientOperationId:crypto.randomUUID(),...input}}});}
  async deleteTransaction(id){return this.api.request(`/api/v1/transactions/${id}/reverse?bookId=${this.bookId()}`,{method:"POST",headers:{"Idempotency-Key":crypto.randomUUID()},body:{reason:"Web arayüzünden silindi",clientOperationId:crypto.randomUUID()}});}
  async createAccount(input){return this.api.request("/api/v1/accounts",{method:"POST",body:{bookId:this.bookId(),currencyCode:"TRY",...input}});}
  async updateAccount(id,input){return this.api.request(`/api/v1/accounts/${id}`,{method:"PATCH",body:input});}
  async deleteAccount(id,version){return this.api.request(`/api/v1/accounts/${id}?version=${version}`,{method:"DELETE"});}
  async createScheduled(input){return this.api.request("/api/v1/scheduled-transactions",{method:"POST",body:{bookId:this.bookId(),currencyCode:"TRY",...input}});}
  async updateScheduled(id,input){return this.api.request(`/api/v1/scheduled-transactions/${id}`,{method:"PATCH",body:input});}
  async deleteScheduled(id,version){return this.api.request(`/api/v1/scheduled-transactions/${id}?version=${version}`,{method:"DELETE"});}
  async realizeScheduled(id,version){return this.api.request(`/api/v1/scheduled-transactions/${id}/realize`,{method:"POST",body:{version,transactionDate:new Date().toISOString(),clientOperationId:crypto.randomUUID()}});}
  async createCategory(input){return this.api.request("/api/v1/categories",{method:"POST",body:{bookId:this.bookId(),currencyCode:"TRY",...input}});}
  async updateCategory(id,input){return this.api.request(`/api/v1/categories/${id}`,{method:"PATCH",body:input});}
  async deleteCategory(id,version){return this.api.request(`/api/v1/categories/${id}?version=${version}`,{method:"DELETE"});}
  async createAssetType(input){return this.api.request("/api/v1/investments/asset-types",{method:"POST",body:{bookId:this.bookId(),...input}});}
  async updateAssetType(id,input){return this.api.request(`/api/v1/investments/asset-types/${id}`,{method:"PATCH",body:input});}
  async deleteAssetType(id,version){return this.api.request(`/api/v1/investments/asset-types/${id}?version=${version}`,{method:"DELETE"});}
  async createInstrument(input){return this.api.request("/api/v1/investments/instruments",{method:"POST",body:{bookId:this.bookId(),currencyCode:"TRY",...input}});}
  async updateInstrument(id,input){return this.api.request(`/api/v1/investments/instruments/${id}`,{method:"PATCH",body:input});}
  async deleteInstrument(id,version){return this.api.request(`/api/v1/investments/instruments/${id}?version=${version}`,{method:"DELETE"});}
  async setPrice(id,input){return this.api.request(`/api/v1/investments/instruments/${id}/prices`,{method:"POST",body:input});}
  async createLot(input){return this.api.request("/api/v1/investments/lots",{method:"POST",body:{bookId:this.bookId(),...input}});}
  async updateLot(id,input){return this.api.request(`/api/v1/investments/lots/${id}`,{method:"PATCH",body:input});}
  async deleteLot(id,version){return this.api.request(`/api/v1/investments/lots/${id}?version=${version}`,{method:"DELETE"});}
  async createSale(input){return this.api.request("/api/v1/investments/sales",{method:"POST",body:{bookId:this.bookId(),clientOperationId:crypto.randomUUID(),...input}});}
  async updateSale(id,input){return this.api.request(`/api/v1/investments/sales/${id}`,{method:"PATCH",body:{clientOperationId:crypto.randomUUID(),reversalClientOperationId:crypto.randomUUID(),...input}});}
  async deleteSale(id,version){return this.api.request(`/api/v1/investments/sales/${id}?version=${version}`,{method:"DELETE"});}
}
