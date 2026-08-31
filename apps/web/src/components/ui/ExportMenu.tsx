import { useRef } from "react";

export interface ExportMenuProps {
  /** Trigger label; defaults to "Dışa aktar". */
  label?: string;
  onExcel: () => void;
  onPdf: () => void;
  id?: string;
}

/**
 * A compact "Dışa aktar" trigger that reveals a joined Excel / PDF button group
 * beneath it. Built on <details> to match the app's other dropdowns and to stay
 * keyboard-operable without extra state.
 */
export function ExportMenu({ label = "Dışa aktar", onExcel, onPdf, id }: ExportMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);

  const pick = (action: () => void) => {
    action();
    const node = detailsRef.current;
    if (node) node.open = false;
  };

  return (
    <details ref={detailsRef} id={id} className="export-menu">
      <summary>{label}</summary>
      <div className="export-menu-options" role="group" aria-label="Dışa aktarma biçimi">
        <button type="button" data-export="excel" onClick={() => pick(onExcel)}>
          Excel
        </button>
        <button type="button" data-export="pdf" onClick={() => pick(onPdf)}>
          PDF
        </button>
      </div>
    </details>
  );
}
