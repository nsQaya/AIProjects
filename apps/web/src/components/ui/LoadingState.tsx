import type { HTMLAttributes, ReactNode } from "react";

export interface LoadingStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children?: ReactNode;
  loading?: boolean;
}

export function LoadingState({
  children = "Canlı veriler yükleniyor…",
  className,
  loading = true,
  ...props
}: LoadingStateProps) {
  const classes = ["loading-state", className].filter(Boolean).join(" ");

  return (
    <div
      {...props}
      className={classes}
      role="status"
      aria-live="polite"
      aria-busy={loading}
      hidden={!loading}
    >
      {children}
    </div>
  );
}
