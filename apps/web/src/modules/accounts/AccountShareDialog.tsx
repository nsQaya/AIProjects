import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { AccountShareDTO, AccountSharePermission } from "@defterx/contracts";

import {
  Button,
  Dialog,
  DialogActions,
  DialogCancelButton,
  DialogFeedback,
  DialogHeader,
} from "../../components/ui";
import { errorMessage } from "../../lib/error-message";
import type { AccountSharingApi } from "./account-types";

const PERMISSION_LABEL: Record<AccountSharePermission, string> = {
  VIEW: "Görüntüleme",
  OPERATE: "İşlem yapabilir",
};

interface AccountShareDialogProps {
  account: { id: string; name: string };
  sharing: Pick<AccountSharingApi, "listShares" | "shareAccount" | "updateShare" | "revokeShare">;
  onClose: () => void;
}

export function AccountShareDialog({ account, sharing, onClose }: AccountShareDialogProps) {
  const [shares, setShares] = useState<readonly AccountShareDTO[] | null>(null);
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<AccountSharePermission>("VIEW");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try {
      setShares(await sharing.listShares(account.id));
    } catch (error) {
      setFeedback(errorMessage(error));
    }
  }, [account.id, sharing]);

  useEffect(() => {
    let active = true;
    sharing
      .listShares(account.id)
      .then((items) => {
        if (active) setShares(items);
      })
      .catch((error: unknown) => {
        if (active) setFeedback(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [account.id, sharing]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setFeedback("");
    try {
      await action();
      await reload();
      return true;
    } catch (error) {
      setFeedback(errorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const submitInvite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      setFeedback("Paylaşılacak kişinin e-postasını girin.");
      return;
    }
    if (await run(() => sharing.shareAccount(account.id, { email: trimmed, permission }))) {
      setEmail("");
      setPermission("VIEW");
    }
  };

  return (
    <Dialog
      className="compact-dialog"
      id="account-share-dialog"
      open
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <DialogHeader
        closeLabel="Paylaşım penceresini kapat"
        eyebrow="Hesap paylaşımı"
        title={`“${account.name}” paylaşımı`}
      />

      <div className="account-share-list">
        {shares === null ? (
          <p className="muted">Yükleniyor…</p>
        ) : shares.length === 0 ? (
          <p className="muted">Bu hesap henüz kimseyle paylaşılmadı.</p>
        ) : (
          <ul>
            {shares.map((share) => (
              <li key={share.id} className="account-share-row">
                <div>
                  <strong>{share.granteeDisplayName || share.granteeEmail}</strong>
                  <small>{share.granteeEmail}</small>
                </div>
                <label className="visually-hidden" htmlFor={`share-permission-${share.id}`}>
                  {share.granteeEmail} için yetki
                </label>
                <select
                  id={`share-permission-${share.id}`}
                  value={share.permission}
                  disabled={busy}
                  onChange={(event) =>
                    void run(() =>
                      sharing.updateShare(account.id, share.id, {
                        permission: event.target.value as AccountSharePermission,
                        version: share.version,
                      }),
                    )
                  }
                >
                  {(["VIEW", "OPERATE"] as const).map((value) => (
                    <option key={value} value={value}>
                      {PERMISSION_LABEL[value]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="danger-link"
                  disabled={busy}
                  onClick={() => void run(() => sharing.revokeShare(account.id, share.id))}
                >
                  Kaldır
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form id="account-share-form" className="account-share-invite" onSubmit={(event) => void submitInvite(event)}>
        <label className="full-field">
          <span>Kişi e-postası</span>
          <input
            name="email"
            type="email"
            autoComplete="off"
            placeholder="ornek@eposta.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          <span>Yetki</span>
          <select
            name="permission"
            value={permission}
            onChange={(event) => setPermission(event.target.value as AccountSharePermission)}
          >
            {(["VIEW", "OPERATE"] as const).map((value) => (
              <option key={value} value={value}>
                {PERMISSION_LABEL[value]}
              </option>
            ))}
          </select>
        </label>
        <p className="muted">
          <strong>Görüntüleme:</strong> hesabı ve hareketlerini görür.{" "}
          <strong>İşlem yapabilir:</strong> ayrıca hesaba gelir/gider ekler. Eklediği işlemler bu
          deftere yazılır.
        </p>
        <DialogFeedback message={feedback} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Kapat</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            Paylaş
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
