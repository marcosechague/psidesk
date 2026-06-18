/**
 * Despertador del cron de Psidesk.
 *
 * Este Worker NO tiene lógica de negocio: solo le "toca el timbre" al endpoint
 * de la app (que es quien lee la DB, decide y envía). Corre según el Cron
 * Trigger definido en wrangler.toml.
 *
 * Secret y URL viven en Cloudflare:
 *   - TARGET_URL : variable (wrangler.toml [vars])
 *   - CRON_SECRET: secret cifrado  (wrangler secret put CRON_SECRET)
 */
export interface Env {
  TARGET_URL: string;
  CRON_SECRET: string;
}

async function ping(env: Env): Promise<void> {
  const res = await fetch(env.TARGET_URL, {
    method: "GET",
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  });
  if (!res.ok) {
    console.error(`cron ping failed: ${res.status} ${await res.text()}`);
  } else {
    console.log(`cron ping ok: ${res.status}`);
  }
}

export default {
  // Se dispara según el/los cron de wrangler.toml.
  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(ping(env));
  },

  // Endpoint de salud opcional (GET al worker) para verificar que está vivo.
  async fetch(): Promise<Response> {
    return new Response("psidesk-cron ok\n", { status: 200 });
  },
};
