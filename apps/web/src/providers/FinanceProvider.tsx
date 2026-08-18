import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";

import { useAuth } from "../auth/AuthProvider";
import { FinanceService, type FinanceSnapshot } from "../finance";
import { isAPIError } from "../platform/api/api-error";
import type { HealthStatus } from "../platform/api/api-client";
import { useToast } from "../application/ToastProvider";

interface FinanceContextValue {
  apiStatus: HealthStatus | null;
  initializationError: unknown;
  mutationBusy: boolean;
  refresh: () => Promise<void>;
  service: FinanceService;
  snapshot: FinanceSnapshot;
  mutate: <T>(action: () => Promise<T>, successMessage: string) => Promise<T>;
}

const FinanceContext = createContext<FinanceContextValue | null>(null);

function hasTransactionFilter(snapshot: FinanceSnapshot): boolean {
  const filter = snapshot.transactionFilter;
  return filter.accountIds !== undefined || Boolean(filter.from || filter.to || filter.categoryId);
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const { api, invalidateSession } = useAuth();
  const { showToast } = useToast();
  const [service] = useState(() => new FinanceService(api));
  const snapshot = useSyncExternalStore(service.subscribe, service.getSnapshot, service.getSnapshot);
  const [apiStatus, setApiStatus] = useState<HealthStatus | null>(null);
  const [initializationError, setInitializationError] = useState<unknown>(null);
  const [mutationCount, setMutationCount] = useState(0);

  const handleAuthFailure = useCallback(
    (error: unknown) => {
      if ((isAPIError(error) && error.status === 401) || !api.hasSession()) invalidateSession();
    },
    [api, invalidateSession],
  );

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      const healthPromise = api.health();
      try {
        await service.initialize();
        if (active) setInitializationError(null);
      } catch (error) {
        handleAuthFailure(error);
        if (active) setInitializationError(error);
      } finally {
        const health = await healthPromise;
        if (active) setApiStatus(health);
      }
    };

    void initialize();
    return () => {
      active = false;
      service.reset();
    };
  }, [api, handleAuthFailure, service]);

  const refreshPreservingFilters = useCallback(async () => {
    const before = service.getSnapshot();
    const transactionFilter = before.transactionFilter;
    // service.refresh() already re-fetches report analytics using the current
    // explicit range (or a fresh default window when none was set), so no
    // separate report follow-up is needed here.
    await service.refresh();
    if (hasTransactionFilter(before)) await service.loadTransactions(transactionFilter);
  }, [service]);

  const refresh = useCallback(async () => {
    setInitializationError(null);
    const healthPromise = api.health();
    try {
      const current = service.getSnapshot();
      if (!current.book) await service.initialize();
      else await refreshPreservingFilters();
      showToast("Canlı veriler yenilendi.");
    } catch (error) {
      handleAuthFailure(error);
      setInitializationError(error);
      throw error;
    } finally {
      setApiStatus(await healthPromise);
    }
  }, [api, handleAuthFailure, refreshPreservingFilters, service, showToast]);

  const mutate = useCallback(
    async <T,>(action: () => Promise<T>, successMessage: string): Promise<T> => {
      setMutationCount((count) => count + 1);
      try {
        const result = await action();
        await refreshPreservingFilters();
        showToast(successMessage);
        return result;
      } catch (error) {
        handleAuthFailure(error);
        throw error;
      } finally {
        setMutationCount((count) => Math.max(0, count - 1));
      }
    },
    [handleAuthFailure, refreshPreservingFilters, showToast],
  );

  const value = useMemo<FinanceContextValue>(
    () => ({
      apiStatus,
      initializationError,
      mutationBusy: mutationCount > 0,
      refresh,
      service,
      snapshot,
      mutate,
    }),
    [apiStatus, initializationError, mutate, mutationCount, refresh, service, snapshot],
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance(): FinanceContextValue {
  const context = useContext(FinanceContext);
  if (!context) throw new Error("useFinance, FinanceProvider içinde kullanılmalıdır.");
  return context;
}
