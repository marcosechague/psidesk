# Psidesk — Plataforma de Tests Psicológicos (MVP)

Aplicación web SaaS para psicólogos: crear pacientes, asignarles tests psicométricos,
que el paciente responda desde su celular vía un link único (sin login) y obtener un
informe con puntajes por subescala corregidos automáticamente.

Monorepo simple:

```
psicopy/
├── docker-compose.yml   # Postgres local para desarrollo
├── .env.example         # variables de infra (copiar a .env)
├── app/                 # ← La aplicación SaaS (Next.js). Foco del MVP.
└── landing/             # Esqueleto de landing ("Próximamente"). No desarrollar aún.
```

## Requisitos

- Node.js 18+ (probado con 22) y **pnpm** (probado con 10)
- Docker (para el Postgres de desarrollo) **o** una base PostgreSQL accesible
  (por ejemplo Neon). La app solo lee `DATABASE_URL`: no sabe qué motor hay detrás.

## Puesta en marcha (desarrollo)

```bash
# 1. Variables de infra (define el puerto del host para Postgres)
cp .env.example .env          # POSTGRES_PORT=5350 por defecto en este entorno

# 2. Base de datos con Docker (mapea el puerto definido en .env)
docker compose up -d

# 3. App
cd app
cp .env.example .env          # ajustar DATABASE_URL (puerto 5350) y AUTH_SECRET
pnpm install
pnpm db:push               # crea las tablas en la base
pnpm db:seed               # carga los 3 tests (DASS-42, PHQ-9, GAD-7)
pnpm dev                   # http://localhost:3001
```

> El puerto del host se controla con `POSTGRES_PORT` en el `.env` de la raíz
> (acá está en **5350** para no chocar con otros Postgres). La `DATABASE_URL`
> de `app/.env` debe usar ese mismo puerto.

## Variables de entorno

| Variable        | Dónde      | Dev (Docker)                                                          | Prod (Neon)                                              |
|-----------------|------------|----------------------------------------------------------------------|---------------------------------------------------------|
| `DATABASE_URL`  | `app/.env` | `postgresql://psicopy:psicopy@localhost:5350/psicopy?schema=public`   | `postgresql://USER:PASS@HOST/db?sslmode=require` (Neon)  |
| `AUTH_SECRET`   | `app/.env` | string aleatorio (`openssl rand -base64 32`)                         | string aleatorio distinto                               |
| `NEXTAUTH_URL`  | `app/.env` | `http://localhost:3001`                                              | URL pública de Vercel                                   |
| `POSTGRES_*`    | `.env`     | usuario/clave/db/puerto para el `docker-compose.yml`                 | (no aplica)                                             |

## Tests automáticos

```bash
cd app && pnpm test           # motor de corrección (scoreTest) con Vitest
```

## Deploy (resumen)

- **`app/`** se despliega en **Vercel**. Configurar `DATABASE_URL` (Neon), `AUTH_SECRET`
  y `NEXTAUTH_URL` en las env vars del proyecto. El build corre `prisma generate`;
  aplicar migraciones con `pnpm db:deploy` (`prisma migrate deploy`).
- La base de producción es **Neon** (no se necesita Docker en prod).

> ⚠️ Los textos oficiales de los ítems de cada test NO vienen incluidos (derechos de
> autor). El seed deja placeholders editables; ver `app/prisma/seed.ts`.
