import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConfirmDialog } from "./ConfirmDialog";

function renderConfirmation(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  const onClose = vi.fn();
  const onConfirm = vi.fn(() => Promise.resolve(undefined));
  render(
    <ConfirmDialog
      open
      title="Kaydı sil"
      description="Bu kaydı silmek istediğinizden emin misiniz?"
      warning="Bu işlem geri alınamaz."
      confirmLabel="Sil"
      onClose={onClose}
      onConfirm={onConfirm}
      {...overrides}
    />,
  );
  return { onClose, onConfirm };
}

describe("ConfirmDialog", () => {
  it("renders its title, description, warning and danger action", () => {
    renderConfirmation();

    const dialog = screen.getByRole("dialog", { name: "Kaydı sil" });
    expect(within(dialog).getByText("Bu kaydı silmek istediğinizden emin misiniz?")).toBeInTheDocument();
    expect(within(dialog).getByText("Bu işlem geri alınamaz.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Sil" })).toHaveClass("danger-button");
  });

  it("cancels without invoking the confirmation mutation", async () => {
    const user = userEvent.setup();
    const { onClose, onConfirm } = renderConfirmation();

    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it.each(["escape", "backdrop"] as const)(
    "closes from %s without invoking the confirmation mutation",
    (closePath) => {
      const { onClose, onConfirm } = renderConfirmation();
      const dialog = screen.getByRole("dialog", { name: "Kaydı sil" });

      if (closePath === "escape") {
        const event = new Event("cancel", { bubbles: false, cancelable: true });
        fireEvent(dialog, event);
        expect(event.defaultPrevented).toBe(true);
      } else {
        fireEvent.click(dialog);
      }

      expect(onClose).toHaveBeenCalledOnce();
      expect(onConfirm).not.toHaveBeenCalled();
    },
  );

  it("blocks duplicate submit and every close path while the mutation is pending", async () => {
    const user = userEvent.setup();
    let resolveMutation: (() => void) | undefined;
    const onClose = vi.fn();
    const onConfirm = vi.fn(
      () => new Promise<void>((resolve) => {
        resolveMutation = resolve;
      }),
    );
    render(
      <ConfirmDialog
        open
        title="Kaydı sil"
        description="Onay açıklaması"
        confirmLabel="Sil"
        onClose={onClose}
        onConfirm={onConfirm}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Kaydı sil" });
    const confirmButton = within(dialog).getByRole("button", { name: /Sil/ });
    await user.click(confirmButton);
    await user.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(confirmButton).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Vazgeç" })).toBeDisabled();
    expect(within(dialog).queryByRole("button", { name: "Onay penceresini kapat" })).not.toBeInTheDocument();

    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute("open");

    resolveMutation?.();
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("keeps a rejected mutation open and shows its error inside the dialog", async () => {
    const user = userEvent.setup();
    const { onClose } = renderConfirmation({
      onConfirm: vi.fn(() => Promise.reject(new Error("Kayıt başka bir yerde değişti."))),
    });

    const dialog = screen.getByRole("dialog", { name: "Kaydı sil" });
    await user.click(within(dialog).getByRole("button", { name: "Sil" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Kayıt başka bir yerde değişti.",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog).toHaveAttribute("open");
  });
});
