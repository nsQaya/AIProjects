import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { APIClient } from "../platform/api/api-client";
import { SessionStore } from "../platform/auth/session-store";
import { AuthProvider } from "./AuthProvider";
import { ResetPasswordPage } from "./ResetPasswordPage";

describe("ResetPasswordPage", () => {
  it("submits matching passwords with the URL token and removes the token afterwards", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const clear = vi.fn();
    const api = new APIClient("https://api.example.test", {
      load: () => ({
        user: { id: "user-1", email: "nihat@example.test", displayName: "Nihat" },
        accessToken: "stale-access",
        refreshToken: "stale-refresh",
        expiresIn: 900,
      }),
      save: vi.fn(),
      clear,
    }, {
      fetch: fetchMock,
    });

    render(
      <MemoryRouter initialEntries={["/reset-password?token=secret-token"]}>
        <AuthProvider api={api}>
          <Routes>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Yeni şifre"), "YeniGucluSifre123!");
    await user.type(screen.getByLabelText("Yeni şifre tekrarı"), "YeniGucluSifre123!");
    await user.click(screen.getByRole("button", { name: "Şifreyi güncelle" }));

    expect(await screen.findByText(/Şifreniz güncellendi/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/auth/reset-password",
      expect.objectContaining({
        body: JSON.stringify({ token: "secret-token", newPassword: "YeniGucluSifre123!" }),
        method: "POST",
      }),
    );
    expect(api.session).toBeNull();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it("rejects mismatched confirmation before calling the API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>();
    const api = new APIClient("https://api.example.test", new SessionStore(null), {
      fetch: fetchMock,
    });

    render(
      <MemoryRouter initialEntries={["/reset-password?token=secret-token"]}>
        <AuthProvider api={api}>
          <ResetPasswordPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText("Yeni şifre"), "YeniGucluSifre123!");
    await user.type(screen.getByLabelText("Yeni şifre tekrarı"), "BaskaGucluSifre123!");
    await user.click(screen.getByRole("button", { name: "Şifreyi güncelle" }));

    expect(screen.getByRole("alert")).toHaveTextContent("eşleşmiyor");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
