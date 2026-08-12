import { useState, type FormEvent } from "react";

import { Button, FormError, InlineFeedback } from "../components/ui";
import { errorMessage } from "../lib/error-message";
import { useAuth } from "./AuthProvider";

type AuthMode = "forgot" | "login" | "register";

function formText(values: FormData, key: string): string {
  const value = values.get(key);
  return typeof value === "string" ? value : "";
}

export function AuthPage() {
  const { forgotPassword, login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const chooseMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError("");
    setNotice("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>, formMode: AuthMode) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setSubmitting(true);
    setError("");
    setNotice("");

    try {
      if (formMode === "login") {
        await login({
          email: formText(values, "email"),
          password: formText(values, "password"),
        });
      } else if (formMode === "register") {
        await register({
          displayName: formText(values, "displayName"),
          email: formText(values, "email"),
          password: formText(values, "password"),
        });
      } else {
        await forgotPassword({ email: formText(values, "email") });
        setNotice(
          "Bu adresle kayıtlı bir hesap varsa şifre sıfırlama bağlantısı e-posta adresinize gönderildi.",
        );
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

        {mode === "forgot" ? (
          <div className="auth-mode-head">
            <h2>Şifrenizi sıfırlayın</h2>
            <p>Üyelik e-posta adresinizi girin; size güvenli bir bağlantı gönderelim.</p>
          </div>
        ) : (
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
        )}

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
            <button
              className="auth-text-button"
              type="button"
              onClick={() => chooseMode("forgot")}
            >
              Şifremi unuttum
            </button>
            <Button variant="primary" type="submit" loading={submitting}>
              Canlı deftere gir
            </Button>
          </form>
        ) : mode === "register" ? (
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
        ) : (
          <form
            id="forgot-password-form"
            className="auth-form"
            onSubmit={(event) => void submit(event, "forgot")}
          >
            <label>
              <span>E-posta</span>
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <Button variant="primary" type="submit" loading={submitting}>
              Sıfırlama bağlantısı gönder
            </Button>
            <button
              className="auth-text-button auth-back-button"
              type="button"
              onClick={() => chooseMode("login")}
            >
              Giriş ekranına dön
            </button>
          </form>
        )}

        {notice ? <InlineFeedback tone="success">{notice}</InlineFeedback> : null}
        <FormError id="auth-error" message={error} />
      </article>
    </section>
  );
}
