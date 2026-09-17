import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { APIClient } from "../platform/api/api-client";
import type { AuthSession } from "../platform/auth/auth-schemas";
import { AuthProvider } from "../auth/AuthProvider";
import { PageTour } from "./PageTour";
import type { TourStep } from "./Tour";

const steps: readonly TourStep[] = [
  { selector: null, title: "Filtreler", body: "Test body one." },
  { selector: "#target", title: "Liste", body: "Test body two." },
];

function renderPageTour(session: AuthSession, fetchMock = vi.fn<typeof fetch>()) {
  const api = new APIClient(
    "https://api.example.test",
    { load: () => session, save: vi.fn(), clear: vi.fn() },
    { fetch: fetchMock },
  );
  return { api, ...render(
    <AuthProvider api={api}>
      <div id="target" />
      <PageTour page="transactions" steps={steps} />
    </AuthProvider>,
  ) };
}

function baseSession(overrides: Partial<AuthSession["user"]> = {}): AuthSession {
  return {
    user: { id: "user-1", email: "user@example.test", displayName: "Test User", ...overrides },
    accessToken: "access",
    refreshToken: "refresh",
    expiresIn: 900,
  };
}

describe("PageTour", () => {
  it("stays hidden until the main nav tour is completed", () => {
    renderPageTour(baseSession({ onboardingCompletedAt: null }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows once the nav tour is done and this page hasn't been seen yet", () => {
    renderPageTour(baseSession({ onboardingCompletedAt: "2026-09-16T00:00:00.000Z", onboardingPagesCompleted: [] }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Filtreler")).toBeInTheDocument();
  });

  it("stays hidden if this page's tour was already completed", () => {
    renderPageTour(
      baseSession({ onboardingCompletedAt: "2026-09-16T00:00:00.000Z", onboardingPagesCompleted: ["transactions"] }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("hides immediately on finish and marks the page complete via the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ onboardingPagesCompleted: ["transactions"] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    renderPageTour(
      baseSession({ onboardingCompletedAt: "2026-09-16T00:00:00.000Z", onboardingPagesCompleted: [] }),
      fetchMock,
    );

    await user.click(screen.getByRole("button", { name: "İleri" }));
    await user.click(screen.getByRole("button", { name: "Turu bitir" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/me/onboarding/pages",
      expect.objectContaining({ method: "PATCH" }),
    );
  });
});
