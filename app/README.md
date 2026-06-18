# Psidesk — App (local setup)

Next.js app for the Psidesk platform: patients, psychometric tests, sessions, and
**WhatsApp follow-ups (check-ins)**. This guide covers running it locally, including
the WhatsApp integration.

> The repo-level overview (monorepo layout, deploy) lives in the root [`README.md`](../README.md).

## Prerequisites

- **Node.js** 18+ (tested with 22) and **pnpm** (tested with 10)
- **Docker** for the local Postgres (or any reachable PostgreSQL, e.g. Neon — the
  app only reads `DATABASE_URL`)

## Quick start

```bash
# From the repo root: start Postgres (host port 5350 by default)
cp .env.example .env          # infra vars (POSTGRES_PORT)
docker compose up -d

# App
cd app
cp .env.example .env          # set DATABASE_URL (port 5350) and AUTH_SECRET
pnpm install
pnpm db:push                  # create tables
pnpm db:seed                  # load the bundled tests (DASS-42, PHQ-9, GAD-7)
pnpm admin:create             # seed the super admin (reads ADMIN_EMAIL / ADMIN_PASSWORD)
pnpm dev                      # http://localhost:3001
```

Self sign-up is closed: the **super admin** creates psychologist accounts from
`/admin`. Bootstrap the first admin with `pnpm admin:create` (set `ADMIN_EMAIL`
and `ADMIN_PASSWORD` in `.env`, or pass `--email` / `--password`).

## Environment variables

Copy `.env.example` to `.env` and fill in. Core ones:

| Variable        | Required | Notes                                                        |
|-----------------|----------|--------------------------------------------------------------|
| `DATABASE_URL`  | yes      | Postgres connection (dev uses host port `5350`)              |
| `AUTH_SECRET`   | yes      | `openssl rand -base64 32`                                    |
| `NEXTAUTH_URL`  | yes      | `http://localhost:3001` in dev                               |
| `STORAGE_DRIVER`| no       | `local` (disk) or `r2` (Cloudflare R2)                       |
| `CRON_SECRET`   | no       | protects `/api/cron/reminders`                               |
| `ADMIN_EMAIL`   | no       | super admin seed for `pnpm admin:create`                     |
| `ADMIN_PASSWORD`| no       | super admin seed for `pnpm admin:create`                     |

WhatsApp ones are covered below.

## Tests

```bash
pnpm test            # Vitest (scoring engine + check-in logic)
```

---

# WhatsApp check-ins (follow-ups)

A psychologist configures a recurring question (a "check-in plan") that is sent to a
patient over WhatsApp; the patient taps a button/list option and the parsed answer is
stored. Code map:

- `src/lib/whatsapp/` — pluggable driver (`mock` | `cloud` | `twilio`). `getWhatsApp()`
  picks one from `WHATSAPP_DRIVER`.
- `src/lib/checkins.ts` — pure logic: scheduling (`isDueOn`), message building
  (`buildMessage` → text / buttons / list), reply parsing (`parseReply`).
- `src/server/checkins.ts` — `dispatchDueCheckins()` (cron), send + record reply.
- `src/app/api/whatsapp/webhook/route.ts` — inbound webhook (Meta verification + replies).
- `src/app/api/cron/reminders/route.ts` — cron endpoint that dispatches due check-ins.

## Driver modes

| `WHATSAPP_DRIVER` | Behaviour                                                        |
|-------------------|------------------------------------------------------------------|
| `mock` (default)  | Logs the message to the console, sends nothing. No account needed. Simulate replies from the patient detail page. |
| `cloud`           | Real send via **Meta Cloud API** (`graph.facebook.com`).         |
| `twilio`          | Not implemented yet.                                             |

For most local work, `mock` is enough. Use `cloud` to test real delivery.

## WhatsApp env vars

```bash
WHATSAPP_DRIVER="cloud"
WHATSAPP_TOKEN="EAAG..."             # access token (dev token expires in ~24h)
WHATSAPP_PHONE_NUMBER_ID="123..."    # the sender's Phone number ID (NOT the phone)
WHATSAPP_API_VERSION="v22.0"         # optional, defaults to v22.0
WHATSAPP_VERIFY_TOKEN="any-secret"   # you choose it; must match the value in Meta
```

## Setting up Meta Cloud API (dev)

1. At [developers.facebook.com](https://developers.facebook.com), create an app of type
   **Business** linked to a **Business portfolio** (just a free Meta container — no
   registered company required). Add the **WhatsApp** product.
2. In **WhatsApp → API Setup** copy:
   - **Temporary access token** → `WHATSAPP_TOKEN` (expires ~24h in dev).
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
   - Under **To**, add your personal number as a test recipient (dev can only send to
     allow-listed numbers).
3. Put the values in `app/.env` and restart `pnpm dev`.

### Smoke test (no app needed)

Confirm the credentials work by sending the pre-approved `hello_world` template:

```bash
curl -i -X POST "https://graph.facebook.com/v22.0/<PHONE_NUMBER_ID>/messages" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"messaging_product":"whatsapp","to":"<YOUR_NUMBER_DIGITS>","type":"template","template":{"name":"hello_world","language":{"code":"en_US"}}}'
```

A `200` with `"message_status":"accepted"` means it works.

> Keep tokens out of git. Put throwaway test scripts in a `*.secret.sh` file — those are
> gitignored.

## The 24-hour window (important)

Free-form / interactive messages (buttons, lists) are only delivered **within 24h of the
patient last messaging your number**. So to test "Send now" from the app:

1. From your phone, **send any message to the Meta test number** (opens the window).
2. In the app, on a patient: set the phone + consent, create a plan, hit **Send now**.
3. The interactive check-in arrives — tap an option and it gets recorded (once the
   webhook is wired, see below).

**Scheduled check-ins** (the cron sends them outside the window) require an **approved
message template** — see below.

## Message templates (for scheduled / outside-window sends)

Business-initiated messages outside the 24h window must use a Meta-approved template.
The driver supports this: when `WHATSAPP_TEMPLATE_NAME` is set, check-ins are sent as a
template; otherwise they fall back to interactive messages (dev / inside-window only).

The design uses **one generic template with three body variables**: `{{1}}` = the patient's
first name, `{{2}}` = the professional's name (prefix + name, e.g. "Lic. Marcos Echague")
and `{{3}}` = the question alone (no instruction or inline options — in the hybrid flow the
patient answers by tapping buttons, not typing). A single approved template covers all
question types.

It also has a **quick-reply button "Responder"** that enables a **hybrid flow** so the
patient gets nice tap-options even though the scheduled message is a template:

1. The scheduled check-in is sent as the template (text) with a **"Responder"** button.
2. The patient taps **Responder** → this opens the 24h window.
3. The webhook (`sendOptionsForPhone`) detects the tap and sends the interactive
   message (buttons / list) with the real options for that question.
4. The patient taps an option → it's recorded, and an acknowledgement is sent back.

Only the first template message is billed (Utility); everything after the tap is inside
the 24h window and free.

To create it, in **WhatsApp Manager → Message templates → Create template**:
   - Category: **Utility**
   - Name: e.g. `seguimiento_checkin`
   - Language: e.g. **Spanish** (`es`) — note the exact code.
   - Body (a variable can't be first or last, hence the greeting and closing line;
     `*{{3}}*` renders the question in bold — asterisks go in the fixed text, the variable
     stays plain):
     ```
     Hola {{1}} 👋, {{2}} te dejó una pregunta de seguimiento:

     *{{3}}*

     Tu respuesta es confidencial y la verá tu profesional. 🙏
     ```
   - Samples: `{{1}}` → `Juan`, `{{2}}` → `Lic. Marcos Echague`, `{{3}}` → `¿Cómo dormiste anoche?`
   - **Buttons → Quick reply**, add one button with text exactly **`Responder`** (the
     webhook matches this label to trigger the interactive flow).
   - Submit for review (approval takes minutes to hours).

> The button is part of the approved template; the send payload doesn't need to include
> button components (it has no variables). If a send ever errors about buttons, add a
> `quick_reply` button component to the template payload in `cloud.ts`.
2. Once **approved**, set in `.env`:
   ```bash
   WHATSAPP_TEMPLATE_NAME="seguimiento_checkin"
   WHATSAPP_TEMPLATE_LANG="es"          # must match the template's language code
   ```
3. Restart `pnpm dev`. Now "Send now" and the cron use the template and work outside the
   24h window.

## Receiving replies — webhook + tunnel

The webhook (`/api/whatsapp/webhook`) is already implemented; it needs a public URL.

1. Expose localhost with a tunnel:

   ```bash
   # Cloudflare (no account; URL changes each run)
   npx cloudflared tunnel --url http://localhost:3001

   # or localtunnel with a stable subdomain
   npx localtunnel --port 3000 --subdomain psidesk-dev   # -> https://psidesk-dev.loca.lt
   ```

2. In **Meta → WhatsApp → Configuration → Webhooks**:
   - **Callback URL**: `https://<your-tunnel-host>/api/whatsapp/webhook`
   - **Verify token**: the value of `WHATSAPP_VERIFY_TOKEN`
   - Click **Verify and save**, then subscribe to the **`messages`** field.

3. Reply to the check-in from your phone → it appears in the plan's history.

### Tunnel troubleshooting

- **`cloudflared` → `lookup api.trycloudflare.com: no such host`**: your local DNS can't
  resolve Cloudflare's domain. Point your network to a public resolver:

  ```bash
  sudo nmcli connection modify "<your-wifi>" ipv4.dns "1.1.1.1 8.8.8.8" ipv4.ignore-auto-dns yes
  sudo nmcli connection up "<your-wifi>"
  sudo resolvectl flush-caches
  getent hosts api.trycloudflare.com   # should now return an IP
  ```

  Revert with `ipv4.dns "" ipv4.ignore-auto-dns no`.

- **localtunnel interstitial**: localtunnel shows a reminder page on first browser visit
  (the "tunnel password" is your public IP, see `https://loca.lt/mytunnelpassword`).
  Automated requests usually pass through, but if Meta's verification fails, this is the
  likely cause — prefer `cloudflared` for webhooks.

## Cron / scheduled sends

`/api/cron/reminders` (protected by `CRON_SECRET`) calls `dispatchDueCheckins()`. Locally:

```bash
pnpm reminders:run        # runs the dispatch once
```

In production a Cloudflare Worker (see `../cron-worker/`) pings it every 15 minutes.
