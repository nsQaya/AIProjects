import { createRoot } from "react-dom/client";

import { App } from "./application/App";
import { APIClient } from "./platform/api/api-client";
import { SessionStore } from "./platform/auth/session-store";
import { Configuration } from "./platform/config/runtime-config";
import "./styles/index.css";

const root = document.querySelector<HTMLDivElement>("#root");
if (!root) throw new Error("React kök elemanı bulunamadı.");

const api = new APIClient(Configuration.apiBaseUrl, new SessionStore());
createRoot(root).render(<App api={api} />);
