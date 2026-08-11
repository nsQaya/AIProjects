import type { HTMLAttributes, ReactNode } from "react";

type FeedbackTone = "error" | "success" | "warning" | "info";

export interface InlineFeedbackProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  tone?: FeedbackTone;
}

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function InlineFeedback({
  children,
  className,
  role,
  tone = "info",
  ...props
}: InlineFeedbackProps) {
  const liveRole = role ?? (tone === "error" ? "alert" : "status");

  return (
    <div
      {...props}
      className={joinClassNames("inline-feedback", `inline-feedback-${tone}`, className)}
      role={liveRole}
      aria-live={liveRole === "alert" ? "assertive" : "polite"}
    >
      {children}
    </div>
  );
}

export interface DialogFeedbackProps extends Omit<HTMLAttributes<HTMLParagraphElement>, "children"> {
  message?: ReactNode;
}

/** Error feedback rendered inside the open dialog, above its actions. */
export function DialogFeedback({ className, message, ...props }: DialogFeedbackProps) {
  if (message === null || message === undefined || message === "") {
    return null;
  }

  return (
    <p
      {...props}
      className={joinClassNames("dialog-feedback", className)}
      role="alert"
      aria-live="assertive"
    >
      {message}
    </p>
  );
}

export interface FormErrorProps extends Omit<HTMLAttributes<HTMLParagraphElement>, "children"> {
  message?: ReactNode;
  reserveSpace?: boolean;
}

/** Auth/form error region that can retain the legacy reserved vertical space. */
export function FormError({
  className,
  message,
  reserveSpace = true,
  ...props
}: FormErrorProps) {
  if (!reserveSpace && (message === null || message === undefined || message === "")) {
    return null;
  }

  return (
    <p
      {...props}
      className={joinClassNames("form-error", className)}
      role="alert"
      aria-live="assertive"
    >
      {message}
    </p>
  );
}
