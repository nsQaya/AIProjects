export type CsvValue = string | number | null | undefined;

export function csvCell(value: CsvValue): string {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function createCsv(rows: readonly (readonly CsvValue[])[]): string {
  return `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function downloadCsv(filename: string, rows: readonly (readonly CsvValue[])[]): void {
  const url = URL.createObjectURL(new Blob([createCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
