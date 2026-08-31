/**
 * Shared, dependency-free export for the report grid tables. Excel gets a real
 * `.xlsx` (numeric cells stay numbers a user can sum and filter); PDF opens a
 * print-ready window and lets the browser save.
 */
import { buildXlsx, type XlsxSheet } from "./xlsx";

/** A numeric cell keeps its raw value for Excel and its on-screen text for PDF. */
export type ExportCell = string | number | null | { value: number; text: string };

export interface ExportColumn {
  header: string;
  align?: "left" | "right";
}

export interface ExportTable {
  /** Document / sheet / file title, e.g. "Yatırım Performansı". */
  title: string;
  /** Context lines under the title (date range, account filter). */
  meta?: readonly string[];
  columns: readonly ExportColumn[];
  rows: readonly (readonly ExportCell[])[];
  /** Optional bold summary row appended after the data. */
  totalRow?: readonly ExportCell[];
}

function cellText(cell: ExportCell): string {
  if (cell === null || cell === undefined) return "";
  if (typeof cell === "object") return cell.text;
  return String(cell);
}

/** Excel worksheet names cap at 31 chars and forbid `: \ / ? * [ ]`. */
export function sheetName(title: string): string {
  return (title.replace(/[:\\/?*[\]]/g, " ").replace(/\s+/g, " ").trim() || "Rapor").slice(0, 31);
}

/** Turns an export table into the single-sheet workbook `buildXlsx` expects. */
export function toXlsxSheet(table: ExportTable): XlsxSheet {
  const rows: XlsxSheet["rows"] = [
    { cells: [table.title], style: "bold" },
    ...(table.meta ?? []).map((line) => ({ cells: [line] as ExportCell[] })),
    { cells: [] },
    { cells: table.columns.map((column) => column.header), style: "bold" as const },
    ...table.rows.map((row) => ({ cells: row })),
    ...(table.totalRow ? [{ cells: table.totalRow, style: "total" as const }] : []),
  ];
  return {
    name: sheetName(table.title),
    rows,
    columnWidths: table.columns.map((column) => (column.align === "right" ? 16 : 22)),
  };
}

/** Builds the print-ready HTML document for a table (pure, so it is unit-tested). */
export function buildPrintHtml(table: ExportTable): string {
  const esc = (value: string) => value.replace(/[&<>]/g, (char) =>
    char === "&" ? "&amp;" : char === "<" ? "&lt;" : "&gt;");
  const align = (index: number) => table.columns[index]?.align ?? "left";
  const headCells = table.columns
    .map((column, index) => `<th style="text-align:${align(index)}">${esc(column.header)}</th>`)
    .join("");
  const bodyRow = (cells: readonly ExportCell[], className = "") =>
    `<tr${className ? ` class="${className}"` : ""}>${cells
      .map((cell, index) => `<td style="text-align:${align(index)}">${esc(cellText(cell))}</td>`)
      .join("")}</tr>`;
  const bodyRows = table.rows.map((row) => bodyRow(row)).join("");
  const totalRow = table.totalRow ? bodyRow(table.totalRow, "total") : "";
  const meta = (table.meta ?? []).map(esc).join(" &nbsp;·&nbsp; ");

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${esc(table.title)}</title>
<style>
  body { margin: 32px; color: #1c2924; font-family: Arial, Helvetica, sans-serif; }
  h1 { font-family: Georgia, "Times New Roman", serif; font-size: 20px; margin: 0 0 4px; }
  .meta { color: #667; font-size: 12px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #cbd5cf; padding: 6px 9px; }
  th { background: #eef3f0; }
  tr.total td { font-weight: bold; border-top: 2px solid #1c2924; }
  footer { margin-top: 22px; color: #99a; font-size: 10px; }
  @media print { body { margin: 0; } @page { margin: 16mm; } }
</style></head><body>
<h1>${esc(table.title)}</h1>
<div class="meta">${meta}</div>
<table><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}${totalRow}</tbody></table>
<footer>DefterX · ${esc(new Date().toLocaleString("tr-TR"))}</footer>
</body></html>`;
}

function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportTableToExcel(table: ExportTable, filenameBase: string): void {
  downloadBlob(`${filenameBase}.xlsx`, buildXlsx(toXlsxSheet(table)));
}

/** Opens a print-ready window; returns false when a popup blocker stopped it. */
export function exportTableToPdf(table: ExportTable): boolean {
  const printWindow = window.open("", "_blank", "noopener,noreferrer,width=920,height=720");
  if (!printWindow) return false;
  printWindow.document.write(buildPrintHtml(table));
  printWindow.document.close();
  printWindow.focus();
  printWindow.setTimeout(() => printWindow.print(), 250);
  return true;
}
