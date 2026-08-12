import { useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Button, FormError, InlineFeedback } from "../components/ui";
import { errorMessage } from "../lib/error-message";
import { useAuth } from "./AuthProvider";

function formText(values: FormData, key: string): string {
  const value = values.get(key);
  return typeof value === "string" ? value : "";
}

export function ResetPasswordPage() {
  const { resetPassword } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const newPassword = formText(values, "newPassword");
    const confirmation = formText(values, "passwordConfirmation");

    if (newPassword !== confirmation) {
      setError("Yeni şifre ve tekrarı eşleşmiyor.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await resetPassword({ token, newPassword });
      setCompleted(true);
      void navigate("/reset-password", { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="auth-screen" id="reset-password-screen">
      <article className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">D</span>
          <div>
            <h1>DefterX</h1>
            <p>Hesabınız için yeni ve güçlü bir şifre belirleyin.</p>
          </div>
        </div>

        <div className="auth-mode-head">
          <h2>Yeni şifre belirle</h2>
          <p>Yeni şifreniz en az 12 karakter olmalıdır.</p>
        </div>

        {completed ? (
          <div className="auth-completed">
            <InlineFeedback tone="success">
              Şifreniz güncellendi. Artık yeni şifrenizle giriş yapabilirsiniz.
            </InlineFeedback>
            <Button variant="primary" type="button" onClick={() => void navigate("/", { replace: true })}>
              Giriş ekranına dön
            </Button>
          </div>
        ) : token ? (
          <form className="auth-form" id="reset-password-form" onSubmit={(event) => void submit(event)}>
            <label>
              <span>Yeni şifre</span>
              <input
                name="newPassword"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </label>
            <label>
              <span>Yeni şifre tekrarı</span>
              <input
                name="passwordConfirmation"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </label>
            <Button variant="primary" type="submit" loading={submitting}>
              Şifreyi güncelle
            </Button>
          </form>
        ) : (
          <div className="auth-completed">
            <InlineFeedback tone="error">
              Bu şifre sıfırlama bağlantısı eksik veya geçersiz. Yeni bir bağlantı isteyin.
            </InlineFeedback>
            <Button variant="secondary" type="button" onClick={() => void navigate("/", { replace: true })}>
              Giriş ekranına dön
            </Button>
          </div>
        )}

        <FormError id="reset-password-error" message={error} />
      </article>
    </section>
  );
}
