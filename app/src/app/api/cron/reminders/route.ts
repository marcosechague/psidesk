import { timingSafeEqual } from "node:crypto";
import { dispatchDueCheckins } from "@/server/checkins";
import { sendSessionReminders } from "@/server/reminders";
import { sendDueTestReminders } from "@/server/testReminders";

/** Comparación en tiempo constante (evita timing attacks sobre el secret). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Procesa recordatorios pendientes (tests con fecha tope, sesiones y check-ins).
// Idempotente: no reenvía lo ya enviado.
// Protegido con CRON_SECRET: header Authorization: Bearer <secret> (preferido)
// o ?secret=... (evitar: queda en logs). Vercel Cron envía el header solo.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(req.url);
  const provided =
    req.headers.get("authorization")?.replace("Bearer ", "") ??
    url.searchParams.get("secret") ??
    "";
  if (!secret || !safeEqual(provided, secret)) {
    return new Response("No autorizado", { status: 401 });
  }

  const emailConfigured = Boolean(process.env.RESEND_API_KEY);
  const now = new Date();

  // ── Tests con fecha tope (WhatsApp con respaldo a email, múltiples offsets) ─
  const testReminders = await sendDueTestReminders(now);

  // ── Sesiones (WhatsApp con respaldo a email) ──────────────────────────
  const sessionReminders = await sendSessionReminders(now);

  // ── Check-ins de seguimiento (WhatsApp) ───────────────────────────────
  const checkins = await dispatchDueCheckins(now);

  return Response.json({
    ok: true,
    emailConfigured,
    testReminders,
    sessionReminders,
    checkins,
  });
}
