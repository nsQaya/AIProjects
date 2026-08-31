import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FxConversionDialog } from "./FxConversionDialog";
import type { FxAccountOption } from "./fx-types";

const accounts: readonly FxAccountOption[] = [
  { id: "account-try", name: "Ziraat TL", currencyCode: "TRY", isArchived: false },
  { id: "account-usd", name: "Piapiri USD", currencyCode: "USD", isArchived: false },
];

describe("FxConversionDialog", () => {
  it("submits a buy conversion with the entered TL and foreign amounts", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => Promise.resolve(undefined));
    const onClose = vi.fn();
    render(<FxConversionDialog accounts={accounts} onClose={onClose} onSubmit={onSubmit} />);

    await screen.findByRole("dialog", { name: "Döviz al" });
    await user.selectOptions(screen.getByLabelText("TL hesabı"), "account-try");
    await user.selectOptions(screen.getByLabelText("Döviz hesabı"), "account-usd");
    await user.type(screen.getByLabelText(/Ödenen tutar/), "35240");
    await user.type(screen.getByLabelText(/Alınan tutar \(USD\)/), "1000");

    expect(screen.getByTestId("fx-effective-rate")).toHaveTextContent("35,24");

    await user.click(screen.getByRole("button", { name: "Dövizi al" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          fromAccountId: "account-try",
          toAccountId: "account-usd",
          fromAmount: "35240",
          toAmount: "1000",
          notes: null,
        }),
      );
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("flips source and target for a sell conversion", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => Promise.resolve(undefined));
    render(
      <FxConversionDialog
        accounts={accounts}
        initialMode="sell"
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    await screen.findByRole("dialog", { name: "Döviz sat" });
    await user.selectOptions(screen.getByLabelText("TL hesabı"), "account-try");
    await user.selectOptions(screen.getByLabelText("Döviz hesabı"), "account-usd");
    await user.type(screen.getByLabelText(/Alınan tutar \(TL\)/), "40000");
    await user.type(screen.getByLabelText(/Satılan tutar/), "1000");
    await user.click(screen.getByRole("button", { name: "Dövizi sat" }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          fromAccountId: "account-usd",
          toAccountId: "account-try",
          fromAmount: "1000",
          toAmount: "40000",
        }),
      );
    });
  });

  it("rejects a non-numeric amount", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn(() => Promise.resolve(undefined));
    render(<FxConversionDialog accounts={accounts} onClose={vi.fn()} onSubmit={onSubmit} />);

    await screen.findByRole("dialog", { name: "Döviz al" });
    await user.selectOptions(screen.getByLabelText("TL hesabı"), "account-try");
    await user.selectOptions(screen.getByLabelText("Döviz hesabı"), "account-usd");
    await user.type(screen.getByLabelText(/Ödenen tutar/), "35240");
    await user.type(screen.getByLabelText(/Alınan tutar \(USD\)/), "abc");
    await user.click(screen.getByRole("button", { name: "Dövizi al" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("sıfırdan büyük");
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
