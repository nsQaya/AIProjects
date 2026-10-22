import { useEffect, useState } from "react";
import type { AccountStatementItemDTO, AccountStatementResponse } from "@defterx/contracts";

import { Button, Dialog, DialogHeader, InlineFeedback } from "../../components/ui";
import { errorMessage } from "../../lib/error-message";
import { dateText, money } from "../../lib/format";

interface AccountStatementDialogProps {
  account: { readonly id: string; readonly name: string };
  loadStatement: (accountId: string, period?: string) => Promise<AccountStatementResponse>;
  onClose: () => void;
}

function periodOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function shiftPeriod(period: string, delta: number): string {
  const [year, month] = period.split("-").map(Number) as [number, number];
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function statusLabel(item: AccountStatementItemDTO): string {
  switch (item.status) {
    case "COMPLETED":
      return item.plannedAmount != null ? "Kısmi ödendi" : "Ödendi";
    case "OVERDUE":
      return "Gecikti";
    case "PENDING":
      return "Planlı";
    default:
      return "Gerçekleşti";
  }
}

export function AccountStatementDialog({ account, loadStatement, onClose }: AccountStatementDialogProps) {
  const [period, setPeriod] = useState<string | undefined>(undefined);
  const [statement, setStatement] = useState<AccountStatementResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    loadStatement(account.id, period)
      .then((result) => {
        if (active) setStatement(result);
      })
      .catch((caught: unknown) => {
        if (active) setError(errorMessage(caught));
      });
    return () => {
      active = false;
    };
  }, [account.id, period, loadStatement]);

  const currentPeriod = statement ? periodOf(statement.closingDate) : period;

  return (
    <Dialog id="account-statement-dialog" open onClose={onClose}>
      <DialogHeader eyebrow={account.name} title="Kart ekstresi" />
      {error ? <InlineFeedback tone="error">{error}</InlineFeedback> : null}
      {statement === null && !error ? <p className="muted">Yükleniyor…</p> : null}
      {statement ? (
        <>
          <div className="statement-nav">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPeriod(shiftPeriod(currentPeriod!, -1))}
            >
              ‹ Önceki
            </Button>
            <span>
              Kesim: {dateText(statement.closingDate)} · Son ödeme: {dateText(statement.dueDate)}
            </span>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setPeriod(shiftPeriod(currentPeriod!, 1))}
            >
              Sonraki ›
            </Button>
          </div>

          {statement.items.length === 0 ? (
            <p className="muted">Bu dönemde kalem yok.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Açıklama</th>
                  <th>Durum</th>
                  <th className="numeric">Tutar</th>
                </tr>
              </thead>
              <tbody>
                {statement.items.map((item) => (
                  <tr key={item.id}>
                    <td>{dateText(item.date)}</td>
                    <td>{item.title}</td>
                    <td>{statusLabel(item)}</td>
                    <td className="numeric">
                      {money(item.amount)}
                      {item.plannedAmount != null ? (
                        <small> / planlanan {money(item.plannedAmount)}</small>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={3}>Toplam</td>
                  <td className="numeric">{money(statement.total)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </>
      ) : null}
    </Dialog>
  );
}
