import { HashRouter } from "react-router-dom";

import { AuthPage } from "../auth/AuthPage";
import { AuthProvider, useAuth } from "../auth/AuthProvider";
import type { APIClient } from "../platform/api/api-client";
import { FinanceProvider } from "../providers/FinanceProvider";
import { AuthenticatedApp } from "./AuthenticatedApp";
import { ToastProvider } from "./ToastProvider";

function AuthGate() {
  const { authenticated } = useAuth();
  return authenticated ? (
    <FinanceProvider>
      <AuthenticatedApp />
    </FinanceProvider>
  ) : (
    <AuthPage />
  );
}

export function App({ api }: { api: APIClient }) {
  return (
    <HashRouter>
      <AuthProvider api={api}>
        <ToastProvider>
          <AuthGate />
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  );
}
