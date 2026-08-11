import { useRef, useState, type ReactNode } from "react";

import { Button } from "./Button";
import {
  Dialog,
  DialogActions,
  DialogCancelButton,
  DialogHeader,
} from "./Dialog";
import { DialogFeedback, InlineFeedback } from "./Feedback";

export type ConfirmDialogErrorFormatter = (error: unknown) => ReactNode;

export interface ConfirmDialogProps {
  cancelLabel?: ReactNode;
  confirmLabel?: ReactNode;
  description: ReactNode;
  errorFormatter?: ConfirmDialogErrorFormatter;
  eyebrow?: ReactNode;
  id?: string;
  onClose: () => void;
  onConfirm: () => Promise<unknown>;
  open: boolean;
  pendingLabel?: string;
  title: ReactNode;
  warning?: ReactNode;
}

function defaultErrorFormatter(error: unknown): ReactNode {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "İşlem tamamlanamadı.";
}

/**
 * Reusable destructive-action confirmation. It owns pending/error state so the
 * caller only closes it after a successful mutation.
 */
export function ConfirmDialog({
  cancelLabel = "Vazgeç",
  confirmLabel = "Onayla",
  description,
  errorFormatter = defaultErrorFormatter,
  eyebrow = "Onay gerekiyor",
  id,
  onClose,
  onConfirm,
  open,
  pendingLabel = "İşlem sürüyor",
  title,
  warning,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReactNode>(null);
  const pendingRef = useRef(false);

  const submit = () => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setError(null);

    void Promise.resolve()
      .then(onConfirm)
      .then(onClose)
      .catch((caught: unknown) => setError(errorFormatter(caught)))
      .finally(() => {
        pendingRef.current = false;
        setPending(false);
      });
  };

  return (
    <Dialog
      id={id}
      className="compact-dialog confirm-dialog"
      dismissible={!pending}
      open={open}
      onClose={() => onClose()}
    >
      <form
        aria-busy={pending || undefined}
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <DialogHeader
          closeLabel="Onay penceresini kapat"
          eyebrow={eyebrow}
          showCloseButton={!pending}
          title={title}
        />
        <div className="form-grid dialog-form-grid">
          <p className="full-field">{description}</p>
          {warning ? (
            <InlineFeedback className="full-field" tone="warning">
              {warning}
            </InlineFeedback>
          ) : null}
        </div>
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={pending}>{cancelLabel}</DialogCancelButton>
          <Button
            type="submit"
            variant="danger"
            loading={pending}
            loadingLabel={pendingLabel}
          >
            {confirmLabel}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
