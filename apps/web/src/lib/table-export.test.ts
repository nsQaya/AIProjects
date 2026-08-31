import { buildPrintHtml, sheetName, toXlsxSheet, type ExportTable } from "./table-export";

const table: ExportTable = {
  title: "Yatırım Performansı",
  meta: ["1 Ağu 2026 – 31 Ağu 2026", "Tüm hesaplar"],
  columns: [
    { header: "Varlık" },
    { header: "Tutar (₺)", align: "right" },
  ],
  rows: [
    ["Aselsan (ASELS)", { value: 1909.375, text: "₺1.909,38" }],
    ["Fon <A>", "kur yok"],
  ],
  totalRow: ["TOPLAM", { value: 1909.375, text: "₺1.909,38" }],
};

describe("sheetName", () => {
  it("strips Excel-forbidden characters and clamps to 31 chars", () => {
    const name = sheetName("Çok/Uzun: bir [rapor] başlığı — gerçekten çok uzun");
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[:\\/?*[\]]/);
  });
});

describe("toXlsxSheet", () => {
  it("lays out title, meta, a blank row, a bold header and a total row", () => {
    const sheet = toXlsxSheet(table);
    expect(sheet.name).toBe("Yatırım Performansı");
    expect(sheet.rows[0]).toEqual({ cells: ["Yatırım Performansı"], style: "bold" });
    expect(sheet.rows[1]).toEqual({ cells: ["1 Ağu 2026 – 31 Ağu 2026"] });
    expect(sheet.rows[3]).toEqual({ cells: [] });
    expect(sheet.rows[4]).toEqual({ cells: ["Varlık", "Tutar (₺)"], style: "bold" });
    expect(sheet.rows.at(-1)).toEqual({
      cells: ["TOPLAM", { value: 1909.375, text: "₺1.909,38" }],
      style: "total",
    });
  });

  it("omits the total row when the table has none", () => {
    const sheet = toXlsxSheet({ ...table, totalRow: undefined });
    expect(sheet.rows.some((row) => row.style === "total")).toBe(false);
  });
});

describe("buildPrintHtml", () => {
  it("renders a titled, aligned table with the total row and escapes cells", () => {
    const html = buildPrintHtml(table);
    expect(html).toContain("<h1>Yatırım Performansı</h1>");
    expect(html).toContain("1 Ağu 2026 – 31 Ağu 2026");
    expect(html).toContain('<th style="text-align:right">Tutar (₺)</th>');
    expect(html).toContain('<td style="text-align:right">₺1.909,38</td>');
    expect(html).toContain("Fon &lt;A&gt;");
    expect(html).toContain('<tr class="total">');
    expect(html).toContain("@media print");
  });
});
