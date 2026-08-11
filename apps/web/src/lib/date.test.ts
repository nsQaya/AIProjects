import { cashFlowWindow, isoAtLocalNoon } from "./date";

describe("tarih yardımcıları", () => {
  it("seçilen günün yerel öğlen saatini ISO biçimine dönüştürür", () => {
    const result = new Date(isoAtLocalNoon("2026-08-07"));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(7);
    expect(result.getDate()).toBe(7);
    expect(result.getHours()).toBe(12);
  });

  it("uzun dönem aralığını yıl bazında kurar", () => {
    const window = cashFlowWindow("5Y", new Date("2026-08-07T10:00:00.000Z"));
    expect(window.from).toBe("2022-01-01T00:00:00.000Z");
    expect(window.granularity).toBe("year");
  });
});
