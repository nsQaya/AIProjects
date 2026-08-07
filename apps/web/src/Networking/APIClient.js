export class APIError extends Error {
  constructor(status, code, message, details=null) { super(message); this.status=status; this.code=code; this.details=details; }
}

export class APIClient {
  constructor(baseUrl,sessionStore) {
    this.baseUrl=baseUrl;
    this.sessionStore=sessionStore;
    this.session=sessionStore.load();
    this.refreshing=null;
  }

  hasSession(){ return Boolean(this.session?.accessToken || this.session?.refreshToken); }
  setSession(value){ this.session=value; value?this.sessionStore.save(value):this.sessionStore.clear(); }

  async health(){
    if(!this.baseUrl)return {online:false,mode:"unconfigured",reason:"API adresi tanımlı değil"};
    try{
      const response=await fetch(`${this.baseUrl}/health/ready`,{cache:"no-store",signal:AbortSignal.timeout(8000)});
      const data=await response.json();
      return {online:response.ok,mode:"api",reason:response.ok?"Canlı API ve veritabanı bağlı":data.status||`HTTP ${response.status}`,data};
    }catch(error){return {online:false,mode:"offline",reason:error instanceof Error?error.message:"Bağlantı kurulamadı"};}
  }

  async register(payload){const data=await this.request("/api/v1/auth/register",{method:"POST",body:payload,auth:false});this.setSession(data);return data;}
  async login(payload){const data=await this.request("/api/v1/auth/login",{method:"POST",body:payload,auth:false});this.setSession(data);return data;}
  async logout(){
    const token=this.session?.refreshToken;
    try{if(token)await this.request("/api/v1/auth/logout",{method:"POST",body:{refreshToken:token},auth:false});}finally{this.setSession(null);}
  }

  async request(path,{method="GET",body,headers={},auth=true,retry=true,serverRetry=0}={}){
    if(!this.baseUrl)throw new APIError(0,"API_NOT_CONFIGURED","Canlı API adresi tanımlı değil");
    const requestHeaders={Accept:"application/json",...headers};
    if(body!==undefined)requestHeaders["Content-Type"]="application/json";
    if(auth&&this.session?.accessToken)requestHeaders.Authorization=`Bearer ${this.session.accessToken}`;
    let response;
    try{
      response=await fetch(`${this.baseUrl}${path}`,{method,headers:requestHeaders,body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
    }catch(error){throw new APIError(0,"NETWORK_ERROR",error instanceof Error?error.message:"Ağa erişilemedi");}
    if(response.status===401&&auth&&retry&&this.session?.refreshToken){
      await this.refresh();
      return this.request(path,{method,body,headers,auth,retry:false,serverRetry});
    }
    if(response.status>=500&&method==="GET"&&serverRetry<2){
      await new Promise(resolve=>setTimeout(resolve,300*(serverRetry+1)));
      return this.request(path,{method,body,headers,auth,retry,serverRetry:serverRetry+1});
    }
    const data=response.status===204?null:await response.json().catch(()=>null);
    if(!response.ok)throw new APIError(response.status,data?.error?.code||`HTTP_${response.status}`,data?.error?.message||"İstek tamamlanamadı",data?.error?.details||null);
    return data;
  }

  async refresh(){
    if(this.refreshing)return this.refreshing;
    this.refreshing=(async()=>{
      try{
        const current=this.session;
        const data=await this.request("/api/v1/auth/refresh",{method:"POST",body:{refreshToken:current.refreshToken},auth:false,retry:false});
        this.setSession({...current,...data});
      }catch(error){this.setSession(null);throw error;}
      finally{this.refreshing=null;}
    })();
    return this.refreshing;
  }
}
