import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScrollToTopButton } from "./ScrollToTopButton";

function scrollWindowTo(value: number) {
  (window as unknown as { scrollY: number }).scrollY = value;
  act(() => {
    window.dispatchEvent(new Event("scroll"));
  });
}

afterEach(() => {
  (window as unknown as { scrollY: number }).scrollY = 0;
  vi.restoreAllMocks();
});

describe("ScrollToTopButton", () => {
  it("stays hidden until the page is scrolled past the reveal threshold", () => {
    render(<ScrollToTopButton />);
    const button = screen.getByLabelText("Sayfanın başına dön");
    expect(button).not.toBeVisible();

    scrollWindowTo(800);

    expect(button).toBeVisible();
  });

  it("scrolls back to the top when clicked", async () => {
    const user = userEvent.setup();
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    render(<ScrollToTopButton />);
    scrollWindowTo(800);

    await user.click(screen.getByRole("button", { name: "Sayfanın başına dön" }));

    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "smooth" });
  });
});
