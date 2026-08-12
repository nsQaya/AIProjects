import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { APIClient } from "../platform/api/api-client";
import { SessionStore } from "../platform/auth/session-store";
import { AuthPage } from "./AuthPage";
import { AuthProvider } from "./AuthProvider";

describe("AuthPage", () => {
  it("giriş ve kayıt formları arasında geçiş yapar", async () => {
    const user = userEvent.setup();
    const api = new APIClient("https://api.example.test", new SessionStore(null), {
      fetch: vi.fn(),
    });

    render(
      <AuthProvider api={api}>
        <AuthPage />
      </AuthProvider>,
    );

    expect(screen.getByRole("button", { name: "Canlı deftere gir" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hesap oluştur" }));
    expect(screen.getByLabelText("Ad soyad")).toBeInTheDocument();
  });

  it("sends a forgot-password request without exposing account existence", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ accepted: true }), {
        status: 202,
        headers: { "content-type": "application/json" },
      }),
    );
    const api = new APIClient("https://api.example.test", new SessionStore(null), {
      fetch: fetchMock,
    });

    render(
      <AuthProvider api={api}>
        <AuthPage />
      </AuthProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Şifremi unuttum" }));
    await user.type(screen.getByLabelText("E-posta"), "nihat@example.test");
    await user.click(screen.getByRole("button", { name: "Sıfırlama bağlantısı gönder" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "kayıtlı bir hesap varsa",
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/api/v1/auth/forgot-password",
      expect.objectContaining({
        body: JSON.stringify({ email: "nihat@example.test" }),
        method: "POST",
      }),
    );
  });
});
