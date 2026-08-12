import type { Env, PasswordResetMailer } from "../../config/bindings";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);
}

export function createPasswordResetMailer(env: Env): PasswordResetMailer | undefined {
  if (!env.EMAIL || !env.PASSWORD_RESET_FROM_EMAIL || !env.WEB_APP_URL) return undefined;
  return {
    async sendPasswordResetEmail(message) {
      const resetLink = `${env.WEB_APP_URL.replace(/\/$/, "")}/#/reset-password?token=${encodeURIComponent(message.token)}`;
      const safeName = escapeHtml(message.displayName);
      const safeLink = escapeHtml(resetLink);
      await env.EMAIL!.send({
        to: message.recipientEmail,
        from: { email: env.PASSWORD_RESET_FROM_EMAIL, name: env.APP_DISPLAY_NAME || "DefterX" },
        subject: `${env.APP_DISPLAY_NAME || "DefterX"} şifre sıfırlama`,
        text: `Merhaba ${message.displayName},\n\nŞifrenizi 30 dakika içinde sıfırlamak için bu bağlantıyı açın:\n${resetLink}\n\nBu isteği siz yapmadıysanız bu mesajı yok sayabilirsiniz.`,
        html: `<p>Merhaba ${safeName},</p><p>Şifrenizi 30 dakika içinde sıfırlamak için aşağıdaki bağlantıyı açın:</p><p><a href="${safeLink}">Şifremi sıfırla</a></p><p>Bu isteği siz yapmadıysanız bu mesajı yok sayabilirsiniz.</p>`,
      });
    },
  };
}
