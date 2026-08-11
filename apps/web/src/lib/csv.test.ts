import { createCsv, csvCell } from "./csv";

describe("CSV dışa aktarma", () => {
  it("formül enjeksiyonunu etkisizleştirir ve çift tırnakları kaçırır", () => {
    expect(csvCell("=HYPERLINK(\"bad\")")).toBe("\"'=HYPERLINK(\"\"bad\"\")\"");
  });

  it("UTF-8 BOM ve noktalı virgül ayraç üretir", () => {
    expect(createCsv([["Türkçe", "₺"], ["Gelir", 12]])).toBe(
      "\uFEFF\"Türkçe\";\"₺\"\r\n\"Gelir\";\"12\"",
    );
  });
});
