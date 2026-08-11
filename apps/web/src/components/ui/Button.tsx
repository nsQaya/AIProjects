import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode
} from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "icon"
  | "icon-subtle";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingLabel?: string;
  variant?: ButtonVariant;
}

const variantClasses: Record<ButtonVariant, string> = {
  danger: "danger-button",
  icon: "icon-button",
  "icon-subtle": "icon-button subtle",
  primary: "primary-button",
  secondary: "secondary-button"
};

function joinClassNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

/**
 * Shared button primitive. Its default type is deliberately `button`, so a
 * button added to a financial form cannot submit or trigger validation by
 * accident. Submit actions must opt in with `type="submit"`.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    disabled,
    loading = false,
    loadingLabel = "İşlem sürüyor",
    type = "button",
    variant = "secondary",
    ...props
  },
  ref
) {
  return (
    <button
      {...props}
      ref={ref}
      type={type}
      className={joinClassNames(variantClasses[variant], loading && "is-loading", className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <span className="button-spinner" aria-hidden="true" /> : null}
      <span className="button-label">{children}</span>
      {loading ? <span className="visually-hidden">{loadingLabel}</span> : null}
    </button>
  );
});

export interface IconButtonProps extends Omit<ButtonProps, "aria-label" | "children"> {
  "aria-label": string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ variant = "icon", ...props }, ref) {
    return <Button {...props} ref={ref} variant={variant} />;
  }
);
