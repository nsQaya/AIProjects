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
});
