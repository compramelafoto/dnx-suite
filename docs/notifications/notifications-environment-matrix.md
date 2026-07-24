# Matriz de variables — DNX Notifications Engine

Solo **nombres**. No documentar valores secretos.

Leyenda entornos:

- **Local** — desarrollo
- **Preview** — Vercel Preview (`VERCEL_ENV=preview`)
- **Production** — Vercel Production (`VERCEL_ENV=production`)

| Variable | App | Local | Preview | Production | Obligatoria | Descripción / política |
|----------|-----|-------|---------|------------|-------------|-------------------------|
| `DATABASE_URL` | InfoSpot / CLF / db | ✓ | ✓ | ✓ | Sí | DB compartida del flujo |
| `DIRECT_URL` | db / migrate | ✓ | ✓ | ✓ | Recomendada | Migraciones / Prisma |
| `CRON_SECRET` | InfoSpot | opcional | ✓ (branch) | ✓ (ya existe; **no rotar en E23**) | Sí en deploy | Auth cron outbox |
| `CRON_SECRET` | CLF | opcional | ✓ | ✓ | Sí email worker | Auth `process-email-queue` |
| `DNX_NOTIFICATIONS_ENABLED` | InfoSpot | default ON | default ON | **default OFF** | Prod: sí para activar | Master kill switch |
| `DNX_NOTIFICATIONS_CAMPAIGNS_ENABLED` | InfoSpot | default ON | default ON | default OFF* | Canary | Crear/enviar campañas |
| `DNX_NOTIFICATIONS_CRON_ENABLED` | InfoSpot | default ON | default ON | default OFF* | Canary | Worker vía cron HTTP |
| `DNX_NOTIFICATIONS_EMAIL_ENABLED` | InfoSpot | default ON | default ON | default OFF* | Canary email | Encolar EMAIL |
| `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` | InfoSpot | opcional QA | **QA only** | **Forbidden** | No | Redirige destinatarios; ignorado en prod real |
| `RESEND_API_KEY` | CLF | opcional | sandbox | prod key | Para email real | Worker EmailQueue |
| `NEXT_PUBLIC_CLF_SITE_URL` / `CLF_PUBLIC_SITE_URL` | InfoSpot | ✓ | ✓ | ✓ | Sí tracking | Base `/n/[token]` |
| `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` | CLF | ✓ | ✓ | ✓ | Redirect allowlist | Tracking/join |
| `DNX_NOTIFICATIONS_QA_ALLOW_SEED` | InfoSpot | QA only | QA only | **Forbidden** | No | Gate seed/cleanup |
| `DNX_NOTIFICATIONS_QA_PASSWORD` | InfoSpot | QA only | QA only | Forbidden | No | Password browser QA |
| `DNX_NOTIFICATIONS_QA_FORCE_PROD` | InfoSpot | — | — | Forbidden salvo emergencia | No | Bypass gate NODE_ENV |
| `DNX_NOTIFICATIONS_ALLOW_MIGRATE` | @repo/db | staging | staging | Solo runbook controlado | Gate DDL | Apply script migración 18 |
| `DNX_NOTIFICATIONS_ALLOW_MANUAL_PROCESS` | InfoSpot | — | opcional | opcional | No | Botón «Procesar ahora» en prod |
| `DNX_NOTIFICATIONS_ALLOW_RECONCILE_APPLY` | InfoSpot | — | opcional | opcional | No | Reconcile apply en prod |
| `DNX_NOTIFICATIONS_BATCH` | InfoSpot CLI | opcional | — | — | No | Batch worker CLI |
| `VERCEL_ENV` | Vercel | — | `preview` | `production` | Sistema | Distingue prod real vs Preview |
| `AUTH_SECRET` | apps | ✓ | ✓ | ✓ | Sí sesión | No específico notif |
| `GOOGLE_*` | apps | ✓ | ✓ | ✓ | Login | Ajeno al motor |

\* En Production, si `DNX_NOTIFICATIONS_ENABLED` no es `1`, todos los subflags quedan OFF aunque estén en `1`.

## Políticas

| Clase | Variables |
|-------|-----------|
| **QA only** | `DNX_NOTIFICATIONS_QA_*`, `DNX_NOTIFICATIONS_EMAIL_OVERRIDE` |
| **Preview only (recomendado)** | Override email, seed flags |
| **Production required (activación futura)** | `CRON_SECRET`, `DNX_NOTIFICATIONS_ENABLED=1`, subflags canary, URLs CLF |
| **Production forbidden** | Override email, QA seed/password, migrate gate sin checklist |

## Defaults de código (`feature-flags.ts`)

| Runtime | Master default |
|---------|----------------|
| `VERCEL_ENV=production` o (sin Vercel y `NODE_ENV=production`) | OFF |
| Preview / development / test | ON |
