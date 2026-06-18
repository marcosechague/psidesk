# psidesk-cron (Cloudflare Worker)

Despertador del cron de Psidesk. **No tiene lógica de negocio**: cada 15 min le
hace un `GET` autenticado al endpoint de la app (`/api/cron/reminders`), que es
quien lee la base, decide qué enviar y envía. El secret vive cifrado en
Cloudflare, no en el repo.

```
Cloudflare Cron Trigger ──(GET + Bearer)──▶ https://TU-APP/api/cron/reminders ──▶ tu DB
```

## Deploy (una sola vez)

Requiere una cuenta de Cloudflare (plan gratis alcanza para Cron Triggers).

```bash
cd cron-worker
npm install
npx wrangler login                       # autentica con tu cuenta CF

# 1) Apuntá el worker a tu app: editá TARGET_URL en wrangler.toml
#    (o dejalo y sobreescribilo en el dashboard)

# 2) Cargá el secret (NO se commitea). Pegá el mismo valor que CRON_SECRET de la app:
npx wrangler secret put CRON_SECRET

# 3) Deploy
npm run deploy
```

Listo: Cloudflare ejecuta el cron cada 15 min automáticamente.

## Probar

```bash
# Dispara el scheduled localmente (sin esperar al cron real):
npx wrangler dev --test-scheduled
# en otra terminal:
curl "http://localhost:8787/__scheduled?cron=*/15+*+*+*+*"

# Ver logs del worker ya desplegado:
npm run tail
```

## Notas de seguridad

- El secret se manda en el header `Authorization: Bearer ...` (no en la URL).
- Vive como **secret cifrado** en tu cuenta de Cloudflare; no está en el repo ni
  en `wrangler.toml`.
- Para rotarlo: cambiá `CRON_SECRET` en la app y volvé a correr
  `wrangler secret put CRON_SECRET` con el nuevo valor.
- Cambiar la frecuencia: editá `crons` en `wrangler.toml` y `npm run deploy`.
