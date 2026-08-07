import { Configuration } from "../Resources/Configuration.js";
import { SessionStore } from "../Persistence/SessionStore.js";
import { APIClient } from "../Networking/APIClient.js";
import { LiveFinanceRepository } from "../Data/LiveFinanceRepository.js";

export class AppContainer {
  constructor(){
    this.configuration=Configuration;
    this.sessionStore=new SessionStore();
    this.apiClient=new APIClient(Configuration.apiBaseUrl,this.sessionStore);
    this.finance=new LiveFinanceRepository(this.apiClient);
  }
}
