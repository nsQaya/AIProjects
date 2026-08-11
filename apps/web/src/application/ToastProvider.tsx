import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

interface ToastContextValue {
  showToast: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timeoutRef = useRef<ReturnType<typeof globalThis.setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current !== null) globalThis.clearTimeout(timeoutRef.current);
    },
    [],
  );

  const showToast = useCallback((nextMessage: string) => {
    if (timeoutRef.current !== null) globalThis.clearTimeout(timeoutRef.current);
    setMessage(nextMessage);
    timeoutRef.current = globalThis.setTimeout(() => setMessage(""), 3_200);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={`toast${message ? " visible" : ""}`} id="toast" role="status" aria-live="polite">
        {message}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast, ToastProvider içinde kullanılmalıdır.");
  return context;
}
