import { buildXlsx } from "./xlsx";

async function textOf(blob: Blob): Promise<string> {
  return new TextDecoder().decode(new Uint8Array(await blob.arrayBuffer()));
}

describe("buildXlsx", () => {
  it("produces a ZIP container holding the OOXML parts", async () => {
    const blob = buildXlsx({
      name: "Rapor",
      rows: [
        { cells: ["Başlık"], style: "bold" },
        { cells: ["Hesap", "Tutar"], style: "bold" },
        { cells: ["Banka", { value: 1234.5, text: "₺1.234,50" }] },
        { cells: ["TOPLAM", 1234.5], style: "total" },
      ],
    });

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    const raw = await textOf(blob);
    expect(raw.startsWith("PK")).toBe(true); // local file header magic
    expect(raw).toContain("[Content_Types].xml");
    expect(raw).toContain("xl/worksheets/sheet1.xml");
    expect(raw).toContain("xl/styles.xml");
  });

  it("writes numeric cells as <v> and text as inline strings, and escapes XML", async () => {
    const blob = buildXlsx({
      name: "S",
      rows: [{ cells: ["a & b <c>", 42, { value: 3.14, text: "3,14" }] }],
    });
    const raw = await textOf(blob);
    expect(raw).toContain("<v>42</v>");
    expect(raw).toContain("<v>3.14</v>");
    expect(raw).toContain("a &amp; b &lt;c&gt;");
    expect(raw).toContain('t="inlineStr"');
  });
});
