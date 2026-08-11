import "@testing-library/jest-dom/vitest";

import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import {
  Dialog,
  DialogActions,
  DialogCancelButton,
  DialogHeader
} from "./Dialog";
import { DialogFeedback } from "./Feedback";

describe("Dialog", () => {
  it("closes from an empty required form without submitting or validating it", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());

    render(
      <Dialog open onClose={onClose}>
        <form onSubmit={onSubmit}>
          <DialogHeader eyebrow="Canlı kayıt" title="Yeni işlem" />
          <label>
            Açıklama
            <input aria-label="Açıklama" required />
          </label>
          <DialogActions>
            <DialogCancelButton />
            <button type="submit">Kaydet</button>
          </DialogActions>
        </form>
      </Dialog>
    );

    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(onClose).toHaveBeenCalledWith("cancel-button");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("maps the native cancel event to an Escape close request", () => {
    const onClose = vi.fn();

    render(
      <Dialog open onClose={onClose} aria-label="Örnek pencere">
        İçerik
      </Dialog>
    );

    const dialog = screen.getByRole("dialog", { name: "Örnek pencere" });
    const event = new Event("cancel", { bubbles: false, cancelable: true });
    fireEvent(dialog, event);

    expect(event.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledWith("escape");
  });

  it("keeps mutation errors in the active dialog as an assertive alert", () => {
    render(
      <Dialog open onClose={vi.fn()}>
        <form>
          <DialogHeader title="Hesap ekle" />
          <DialogFeedback message="Bu hesap eksi bakiyeye düşemez." />
        </form>
      </Dialog>
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Bu hesap eksi bakiyeye düşemez."
    );
    expect(screen.getByRole("alert").closest("dialog")).toBe(
      screen.getByRole("dialog", { name: "Hesap ekle" })
    );
  });
});
