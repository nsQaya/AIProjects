import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type DialogHTMLAttributes,
  type HTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode
} from "react";

import { Button, IconButton, type ButtonProps } from "./Button";
import { Icon } from "./Icon";

export type DialogCloseReason =
  | "backdrop"
  | "cancel-button"
  | "close-button"
  | "escape"
  | "native";

interface DialogContextValue {
  requestClose: (reason: DialogCloseReason) => void;
  titleId: string;
}

const DialogContext = createContext<DialogContextValue | null>(null);

function useDialogContext(componentName: string) {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error(`${componentName} must be rendered inside Dialog.`);
  }

  return context;
}

export interface DialogProps
  extends Omit<
    DialogHTMLAttributes<HTMLDialogElement>,
    "aria-label" | "aria-labelledby" | "onCancel" | "onClose" | "open"
  > {
  "aria-label"?: string;
  "aria-labelledby"?: string;
  children: ReactNode;
  closeOnBackdrop?: boolean;
  /** Prevents every user-initiated close path while a critical action is pending. */
  dismissible?: boolean;
  onClose: (reason: DialogCloseReason) => void;
  open: boolean;
}

/**
 * Controlled native dialog. It keeps the browser's focus trap and Escape
 * semantics while delegating state changes to React.
 */
export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(function Dialog(
  {
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    children,
    className,
    closeOnBackdrop = true,
    dismissible = true,
    onClose,
    onClick,
    open,
    ...props
  },
  forwardedRef
) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const syncingFromProps = useRef(false);
  const requestedClose = useRef(false);
  const generatedTitleId = useId();

  const setDialogRef = useCallback(
    (node: HTMLDialogElement | null) => {
      dialogRef.current = node;

      if (typeof forwardedRef === "function") {
        forwardedRef(node);
      } else if (forwardedRef) {
        forwardedRef.current = node;
      }
    },
    [forwardedRef]
  );

  const requestClose = useCallback(
    (reason: DialogCloseReason) => {
      if (!dismissible) return;
      const dialog = dialogRef.current;
      if (dialog?.open) {
        requestedClose.current = true;
        dialog.close();
      }
      onClose(reason);
    },
    [dismissible, onClose]
  );

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      requestedClose.current = false;
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        // jsdom and older embedded browsers do not expose showModal.
        dialog.setAttribute("open", "");
      }
      return;
    }

    if (!open && dialog.open) {
      syncingFromProps.current = true;
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
      syncingFromProps.current = false;
    }
  }, [open]);

  const handleClick = (event: ReactMouseEvent<HTMLDialogElement>) => {
    onClick?.(event);
    if (
      !event.defaultPrevented &&
      closeOnBackdrop &&
      event.target === event.currentTarget
    ) {
      requestClose("backdrop");
    }
  };

  const accessibleName = ariaLabel ? undefined : ariaLabelledBy ?? generatedTitleId;

  return (
    <DialogContext.Provider value={{ requestClose, titleId: generatedTitleId }}>
      <dialog
        {...props}
        ref={setDialogRef}
        className={["entry-dialog", className].filter(Boolean).join(" ")}
        aria-label={ariaLabel}
        aria-labelledby={accessibleName}
        onClick={handleClick}
        onCancel={(event) => {
          event.preventDefault();
          requestClose("escape");
        }}
        onClose={() => {
          if (requestedClose.current) {
            requestedClose.current = false;
            return;
          }
          if (!syncingFromProps.current && open) {
            requestClose("native");
          }
        }}
      >
        {children}
      </dialog>
    </DialogContext.Provider>
  );
});

export interface DialogHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  closeLabel?: string;
  eyebrow?: ReactNode;
  showCloseButton?: boolean;
  title: ReactNode;
}

export function DialogHeader({
  children,
  className,
  closeLabel = "Pencereyi kapat",
  eyebrow,
  showCloseButton = true,
  title,
  ...props
}: DialogHeaderProps) {
  const { requestClose, titleId } = useDialogContext("DialogHeader");

  return (
    <div {...props} className={["dialog-head", className].filter(Boolean).join(" ")}>
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
      {showCloseButton ? (
        <IconButton
          variant="icon-subtle"
          aria-label={closeLabel}
          data-close-dialog
          onClick={() => requestClose("close-button")}
        >
          <Icon name="close" />
        </IconButton>
      ) : null}
    </div>
  );
}

export function DialogActions({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={["dialog-actions", className].filter(Boolean).join(" ")}
    />
  );
}

export interface DialogCancelButtonProps
  extends Omit<ButtonProps, "type" | "variant"> {
  variant?: Extract<ButtonProps["variant"], "danger" | "secondary">;
}

export function DialogCancelButton({
  children = "Vazgeç",
  onClick,
  variant = "secondary",
  ...props
}: DialogCancelButtonProps) {
  const { requestClose } = useDialogContext("DialogCancelButton");

  return (
    <Button
      {...props}
      type="button"
      variant={variant}
      data-close-dialog
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) requestClose("cancel-button");
      }}
    >
      {children}
    </Button>
  );
}

export interface DialogCloseButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> {
  reason?: DialogCloseReason;
}

/** A low-level dismissal button for custom dialog layouts. */
export function DialogCloseButton({
  children,
  onClick,
  reason = "close-button",
  ...props
}: DialogCloseButtonProps) {
  const { requestClose } = useDialogContext("DialogCloseButton");

  return (
    <button
      {...props}
      type="button"
      data-close-dialog
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) requestClose(reason);
      }}
    >
      {children}
    </button>
  );
}
