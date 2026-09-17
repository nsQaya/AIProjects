import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OnboardingTour } from "./OnboardingTour";

function renderWithNav(active: boolean, onFinish: () => void) {
  return render(
    <div>
      <nav>
        <a data-route="dashboard">Ana Sayfa</a>
        <a data-route="transactions">İşlemler</a>
        <a data-route="accounts">Hesaplar</a>
        <a data-route="savings">Birikimler</a>
        <a data-route="upcoming">Yaklaşan</a>
        <a data-route="reports">Raporlar</a>
        <a data-route="settings">Ayarlar</a>
      </nav>
      <OnboardingTour active={active} onFinish={onFinish} />
    </div>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OnboardingTour", () => {
  it("renders nothing when inactive", () => {
    renderWithNav(false, () => {});
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("starts on the welcome step and walks through every nav item to the end", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    renderWithNav(true, onFinish);

    expect(screen.getByText("1/7")).toBeInTheDocument();
    expect(screen.getByText("DefterX'e hoş geldiniz")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "İleri" }));
    expect(screen.getByRole("heading", { name: "İşlemler" })).toBeInTheDocument();
    expect(document.querySelector('[data-route="transactions"]')).toHaveClass("tour-spotlight-target");

    for (const label of ["Hesaplar", "Birikimler", "Yaklaşan", "Raporlar", "Ayarlar"]) {
      await user.click(screen.getByRole("button", { name: "İleri" }));
      expect(screen.getByRole("heading", { name: label })).toBeInTheDocument();
    }

    expect(screen.getByText("7/7")).toBeInTheDocument();
    expect(onFinish).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Turu bitir" }));
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("removes the spotlight class from the previous step's target when moving on", async () => {
    const user = userEvent.setup();
    renderWithNav(true, () => {});

    await user.click(screen.getByRole("button", { name: "İleri" }));
    expect(document.querySelector('[data-route="transactions"]')).toHaveClass("tour-spotlight-target");

    await user.click(screen.getByRole("button", { name: "İleri" }));
    expect(document.querySelector('[data-route="transactions"]')).not.toHaveClass("tour-spotlight-target");
    expect(document.querySelector('[data-route="accounts"]')).toHaveClass("tour-spotlight-target");
  });

  it("closes immediately from any step via the close button", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    renderWithNav(true, onFinish);

    await user.click(screen.getByRole("button", { name: "İleri" }));
    await user.click(screen.getByRole("button", { name: "Turu kapat" }));

    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it("goes back to the previous step without finishing the tour", async () => {
    const user = userEvent.setup();
    renderWithNav(true, () => {});

    await user.click(screen.getByRole("button", { name: "İleri" }));
    expect(screen.getByRole("heading", { name: "İşlemler" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Geri" }));
    expect(screen.getByText("DefterX'e hoş geldiniz")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Geri" })).not.toBeInTheDocument();
  });

  it("falls back to a centered card without spotlighting on narrow viewports", async () => {
    window.matchMedia = (query: string) => ({
      matches: query.includes("max-width"),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;

    const user = userEvent.setup();
    renderWithNav(true, () => {});

    await user.click(screen.getByRole("button", { name: "İleri" }));

    expect(document.querySelector('[data-route="transactions"]')).not.toHaveClass("tour-spotlight-target");
    expect(document.querySelector(".onboarding-tour-card")).toHaveClass("centered");
  });
});
