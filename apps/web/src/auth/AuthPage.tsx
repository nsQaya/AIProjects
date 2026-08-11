import { useState, type FormEvent } from "react";

import { Button, FormError } from "../components/ui";
import { errorMessage } from "../lib/error-message";
import { useAuth } from "./AuthProvider";

type AuthMode = "login" | "register";

function formText(values: FormData, key: string): string {
  const value = values.get(key);
  return typeof value === "string" ? value : "";
}

export function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const chooseMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>, formMode: AuthMode) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSubmitting(true);
    setError("");

    try {
      if (formMode === "login") {
        await login({
          email: formText(values, "email"),
          password: formText(values, "password"),
        });
      } else {
        await register({
          displayName: formText(values, "displayName"),
          email: formText(values, "email"),
          password: formText(values, "password"),
        });
      }
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-screen" id="auth-screen">
      <article className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">D</span>
          <div>
            <h1>DefterX</h1>
            <p>Canlı finans çalışma alanınıza bağlanın.</p>
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={mode === "login" ? "active" : undefined}
            data-auth-tab="login"
            type="button"
            onClick={() => chooseMode("login")}
          >
            Giriş yap
          </button>
          <button
            className={mode === "register" ? "active" : undefined}
            data-auth-tab="register"
            type="button"
            onClick={() => chooseMode("register")}
          >
            Hesap oluştur
          </button>
        </div>

        {mode === "login" ? (
          <form id="login-form" className="auth-form" onSubmit={(event) => void submit(event, "login")}>
            <label>
              <span>E-posta</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>Parola</span>
              <input name="password" type="password" autoComplete="current-password" required />
            </label>
            <Button variant="primary" type="submit" loading={submitting}>
              Canlı deftere gir
            </Button>
          </form>
        ) : (
          <form
            id="register-form"
            className="auth-form"
            onSubmit={(event) => void submit(event, "register")}
          >
            <label>
              <span>Ad soyad</span>
              <input name="displayName" maxLength={120} required />
            </label>
            <label>
              <span>E-posta</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>Parola</span>
              <input
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
            <small>En az 12 karakter kullanın.</small>
            <Button variant="primary" type="submit" loading={submitting}>
              Hesap oluştur
            </Button>
          </form>
        )}

        <FormError id="auth-error" message={error} />
      </article>
    </section>
  );
}
