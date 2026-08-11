import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { Button, InlineFeedback } from "../../components/ui";
import type { ScheduledTransactionView } from "../../finance/finance-views";
import { errorMessage } from "../../lib/error-message";
import { dateText, signedMoney } from "../../lib/format";

export type UpcomingFilter = "OPEN" | "COMPLETED" | "ALL";

interface UpcomingPageProps {
  items: readonly ScheduledTransactionView[];
  onDelete: (item: ScheduledTransactionView) => Promise<void>;
  onEdit: (item: ScheduledTransactionView) => void;
  onNew: () => void;
  onRealize: (item: ScheduledTransactionView) => Promise<void>;
}

const recurrenceLabels = { WEEKLY: "Her hafta", MONTHLY: "Her ay", YEARLY: "Her yıl" } as const;

export function UpcomingPage({ items, onDelete, onEdit, onNew, onRealize }: UpcomingPageProps) {
  const [filter, setFilter] = useState<UpcomingFilter>("OPEN");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const openCount = items.filter((item) => item.status !== "COMPLETED").length;
  const completedCount = items.filter((item) => item.status === "COMPLETED").length;
  const visibleItems = useMemo(
    () => items.filter((item) => filter === "ALL" || (filter === "COMPLETED" ? item.status === "COMPLETED" : item.status !== "COMPLETED")),
    [filter, items],
  );

  const act = async (item: ScheduledTransactionView, action: () => Promise<void>) => {
    setPendingId(item.id);
    setFeedback("");
    try {
      await action();
    } catch (caught) {
      setFeedback(errorMessage(caught));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="page-section">
      {feedback ? <InlineFeedback tone="error">{feedback}</InlineFeedback> : null}
      <article className="panel schedule-panel">
        <header className="panel-head">
          <div><h2>Yaklaşan ödeme ve tahsilatlar</h2><p>Tek seferlik ve tekrar eden planlar; gerçekleşenler doğrudan işlemlere aktarılır</p></div>
          <Button id="open-scheduled-dialog" onClick={onNew}>+ Planlı işlem</Button>
        </header>
        <div className="status-filter" aria-label="Yaklaşan işlem durumu">
          <button type="button" data-upcoming-filter="OPEN" className={filter === "OPEN" ? "active" : undefined} onClick={() => setFilter("OPEN")}>Gerçekleşmeyenler <b>{openCount}</b></button>
          <button type="button" data-upcoming-filter="COMPLETED" className={filter === "COMPLETED" ? "active" : undefined} onClick={() => setFilter("COMPLETED")}>Gerçekleşenler <b>{completedCount}</b></button>
          <button type="button" data-upcoming-filter="ALL" className={filter === "ALL" ? "active" : undefined} onClick={() => setFilter("ALL")}>Tümü <b>{items.length}</b></button>
        </div>
        <div className="schedule-list">
          {visibleItems.map((item, index) => {
            const completed = item.status === "COMPLETED";
            const recurrence = item.recurrenceFrequency ? recurrenceLabels[item.recurrenceFrequency] : null;
            const details = [item.ui.costCenterName, item.ui.categoryName, recurrence]
              .filter(Boolean)
              .join(" · ") || "—";
            return (
              <div className={`schedule-row${completed ? " completed" : ""}`} key={item.id}>
                <span className="timeline-dot"><i />{index < visibleItems.length - 1 ? <b /> : null}</span>
                <time>{dateText(item.ui.date)}</time>
                <div><strong>{item.title}</strong><small>{details}</small></div>
                <span className={`status-pill${completed ? " completed-pill" : ""}`}>{completed ? "Gerçekleşti" : item.status === "OVERDUE" ? "Gecikmiş" : "Planlandı"}</span>
                <b className={item.ui.kind}>{signedMoney(item.amount, item.ui.kind)}</b>
                {completed ? (
                  <span className="row-actions schedule-actions"><Link className="success-link" to="/transactions">İşlemi gör</Link></span>
                ) : (
                  <span className="row-actions schedule-actions">
                    <button
                      type="button"
                      className="success-link"
                      data-realize-scheduled={item.id}
                      disabled={pendingId === item.id}
                      onClick={() => {
                        if (globalThis.confirm(`“${item.title}” gerçekleşti olarak işlemlere aktarılsın mı?`)) void act(item, () => onRealize(item));
                      }}
                    >Gerçekleşti</button>
                    <button type="button" data-edit-scheduled={item.id} disabled={pendingId === item.id} onClick={() => onEdit(item)}>Düzenle</button>
                    <button
                      type="button"
                      className="danger-link"
                      data-delete-scheduled={item.id}
                      disabled={pendingId === item.id}
                      onClick={() => {
                        if (globalThis.confirm(`“${item.title}” planı silinsin mi?`)) void act(item, () => onDelete(item));
                      }}
                    >Sil</button>
                  </span>
                )}
              </div>
            );
          })}
          {visibleItems.length === 0 ? <div className="empty-state">Bu filtrede kayıt yok.</div> : null}
        </div>
      </article>
    </section>
  );
}
