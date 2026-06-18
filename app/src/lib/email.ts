import "server-only";

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
}

/**
 * Envía un email vía Resend si hay RESEND_API_KEY configurada.
 * Si no hay key, devuelve { sent: false } (la UI cae al fallback mailto:).
 */
export async function sendEmail({
  to,
  subject,
  html,
}: SendEmailArgs): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false };

  const from = process.env.EMAIL_FROM || "Psidesk <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return { sent: false, error: `Resend ${res.status}: ${detail.slice(0, 150)}` };
    }
    return { sent: true };
  } catch {
    return { sent: false, error: "No se pudo conectar con el servicio de email" };
  }
}
