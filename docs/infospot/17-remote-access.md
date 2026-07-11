# Info Spot — Acceso remoto (Director / Redactora)

**Fecha:** 2026-07-11  
**Estado:** solución mínima lista en código; requiere env de producción + rol PG read-only CLF.

## Cómo inicia sesión una persona

1. Abre `https://<dominio-infospot>/ingresar`
2. Usa email + contraseña de la identidad DNX (`User` compartida)
3. Info Spot emite cookie `dnx_session` (HttpOnly, Secure en HTTPS, SameSite=Lax, 7 días)
4. Redirect a `/redaccion` (o `?next=`)

No se crea un segundo sistema de contraseñas.

## Emisión de `dnx_session`

| Pieza | Ubicación |
| --- | --- |
| Token + fila `UserSession` | `@repo/auth` → `createUserSession` |
| Cookie en Info Spot | `apps/infospot/lib/session-cookie.ts` |
| Login UI | `/ingresar` |

Atributos: `httpOnly`, `secure` (prod/Vercel/https), `sameSite=lax`, `path=/`, `domain=COOKIE_DOMAIN` si está definido.

## ¿Funciona desde el dominio público?

Sí, **si**:

1. Info Spot está en un host bajo el mismo `COOKIE_DOMAIN` que el resto de DNX (prod: `.dnxsuite.com`)
2. `DATABASE_URL` de Info Spot es la misma suite de identidad (tabla `User` / `UserSession`)
3. La persona tiene `InfoSpotUserRole` ACTIVE (`INFOSPOT_DIRECTOR` o `INFOSPOT_REDACTOR`)

Sin `COOKIE_DOMAIN`, la cookie queda host-only: login en Info Spot funciona en ese host, pero **no** se comparte automáticamente con CLF/FotoRank (y viceversa).

## Cookies entre subdominios

| Escenario | Resultado |
| --- | --- |
| `COOKIE_DOMAIN=.dnxsuite.com` + apps en `*.dnxsuite.com` | SSO entre apps |
| Sin `COOKIE_DOMAIN` | Sesión solo en el host que la emitió |
| Dominios distintos (p. ej. `.com` vs `.com.ar`) | No cruzan; hace falta login en Info Spot |

**No asumir** que una cookie local de `localhost:3004` sirve en producción.

## Redactora desde otra computadora

1. Director asigna rol en `/admin/usuarios` (email DNX existente)
2. Redactora abre `/ingresar` en el dominio público
3. Entra a `/redaccion`
4. `/admin` (settings/usuarios) queda bloqueado para REDACTOR
5. Publicar respeta `canPublish`

## Crear / vincular usuario

- **No** se crean cuentas arbitrarias desde Info Spot
- Debe existir `User` en la DB suite (seed, CLF, FotoRank, etc.)
- Director busca por email → asigna `INFOSPOT_REDACTOR`

## Revocar acceso

En `/admin/usuarios`:

- Estado `DISABLED`, o
- «Revocar acceso» → `DISABLED` + `revokeAllUserSessions`

## Variables Vercel (Info Spot)

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | CMS Info Spot + identidad |
| `CLF_READONLY_DATABASE_URL` | SELECT CLF real (nunca write) |
| `COOKIE_DOMAIN` | p. ej. `.dnxsuite.com` |
| `NEXT_PUBLIC_INFOSPOT_URL` | URL canónica https |
| R2 + `INFOSPOT_IP_HASH_SALT` | assets / anti-spam |
| `COMPRAMELAFOTO_PUBLIC_URL` | links de álbum |

## SQL rol read-only CLF

Ver `docs/infospot/sql/create-clf-readonly-role.sql`.  
**No ejecutar** sin confirmar entorno. No usar la `DATABASE_URL` de escritura de CLF como `CLF_READONLY_DATABASE_URL`.
