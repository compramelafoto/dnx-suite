# FotOffice (DNX Suite)

App de FotOffice dentro del monorepo `dnx-suite`.

## Desarrollo local

```bash
pnpm --filter fotoffice dev
```

Puerto por defecto: **3010**.

## Autenticación unificada

Identidad DNX (Google OAuth + cookie `dnx_session`). **No Auth0.**

Documentación: [`docs/AUTH.md`](./docs/AUTH.md).

Logo oficial (PNG con transparencia): `public/fotoffice.png`.

## Variables de entorno

Usar `apps/fotoffice/.env.example` → `.env.local`.

Incluye Google OAuth (`GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`), `APP_URL`, `COOKIE_DOMAIN` y Mercado Pago.

### Nota de seguridad webhook

- En `development`, si `MP_WEBHOOK_SECRET` no está definido, el webhook permite pruebas y registra un warning.
- En `production`, `MP_WEBHOOK_SECRET` es obligatorio.

## Migración onboarding

`packages/db/prisma/migrations/20260718140000_fotoffice_photographer_onboarding/`

No aplicar a producción sin autorización explícita.

## Validación

```bash
pnpm --filter fotoffice test
pnpm --filter fotoffice lint
pnpm --filter fotoffice build
```
