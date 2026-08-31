import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ExportMenu } from "./ExportMenu";

describe("ExportMenu", () => {
  it("reveals the Excel / PDF group on open and closes after a pick", async () => {
    const user = userEvent.setup();
    const onExcel = vi.fn();
    const onPdf = vi.fn();
    render(<ExportMenu id="x" onExcel={onExcel} onPdf={onPdf} />);

    const details = document.querySelector<HTMLDetailsElement>("details#x")!;
    expect(details.open).toBe(false);

    await user.click(screen.getByText("Dışa aktar"));
    expect(details.open).toBe(true);

    await user.click(screen.getByRole("button", { name: "Excel" }));
    expect(onExcel).toHaveBeenCalledOnce();
    expect(onPdf).not.toHaveBeenCalled();
    expect(details.open).toBe(false);
  });

  it("triggers the PDF handler from the same group", async () => {
    const user = userEvent.setup();
    const onPdf = vi.fn();
    render(<ExportMenu onExcel={vi.fn()} onPdf={onPdf} label="Aktar" />);

    await user.click(screen.getByText("Aktar"));
    await user.click(screen.getByRole("button", { name: "PDF" }));
    expect(onPdf).toHaveBeenCalledOnce();
  });
});
