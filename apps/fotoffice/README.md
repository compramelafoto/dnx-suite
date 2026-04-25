# Fotoffice (DNX Suite)

App de Fotoffice dentro del monorepo `dnx-suite`.

## Desarrollo local

Desde la raíz del monorepo:

```bash
pnpm --filter fotoffice dev
```

## Variables de entorno (cursos + Mercado Pago)

Usar `apps/fotoffice/.env.example` como base y copiarlo a `.env.local`.

Variables necesarias para el flujo de cursos con Mercado Pago:

- `MP_ACCESS_TOKEN`: token de Mercado Pago para crear preferencias y consultar pagos.
- `MP_WEBHOOK_SECRET`: secreto configurado en Mercado Pago para validar firma del webhook.
- `APP_URL`: URL pública/canónica de Fotoffice usada para `back_urls` y `notification_url`.
- `NEXT_PUBLIC_APP_URL`: URL pública del cliente (mantener consistente con `APP_URL` por entorno).

### Nota de seguridad webhook

- En `development`, si `MP_WEBHOOK_SECRET` no está definido, el webhook permite pruebas y registra un warning.
- En `production`, `MP_WEBHOOK_SECRET` es obligatorio; si falta o la firma es inválida, el webhook se rechaza.

## Validación

```bash
pnpm --filter fotoffice lint
pnpm --filter fotoffice build
```
