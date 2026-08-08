# Santa Fe en Foco — ETAPA 11 — Super Admin + acceso automático

**Fecha:** 2026-08-07  
**Alcance:** Preview/Staging — **sin Production**  
**Branch:** `feat/sfef-etapa11`

## Reuso

ETAPA 09B + Super Admin canónico ya cubrían:

- selector de rol eliminado;
- `resolveHomeCapabilities` / `resolvePostLoginPath`;
- hub `/mi-actividad`;
- panel `/super-admin`;
- `User.globalRole = SUPER_ADMIN` para `cuart.daniel@gmail.com`;
- «Actuar como organizador» + auditoría.

## Ampliaciones 11

- «Actuar como» participante / jurado / organizador (contexto UI, misma identidad).
- Empty state: “No tenés actividad todavía.” + CTAs.
- Selfcheck permisos + matriz E2E 8 casos (`sfef11-*@fotorank.test`).
- Email contacto SFPR verificado canónico: `sfprosario@gmail.com` (org `contactEmail`).

## Comandos

```bash
# selfchecks
pnpm --filter fotorank run test:access:home-capabilities
pnpm --filter fotorank run test:access:permissions

# fixtures staging
SFEF11_ALLOW_FIXTURES=1 DATABASE_URL=...staging... \
  pnpm --filter fotorank run ops:sfef-11:fixtures

# e2e preview/staging
PLAYWRIGHT_BASE_URL=https://fotorank.staging.dnxsuite.com \
  pnpm --filter fotorank run test:e2e:sfef-11:staging

# cleanup
SFEF11_ALLOW_CLEANUP=1 DATABASE_URL=...staging... \
  pnpm --filter fotorank run ops:sfef-11:cleanup
```
