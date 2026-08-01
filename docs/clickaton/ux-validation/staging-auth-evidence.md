# Evidencia de autenticación staging — Imp. 03

**URL:** `https://clickaton-staging.vercel.app`  
**Método:** login email/password unificado (`/login`) — sin bypass, sin cambio de cookies/OAuth.  
**Fecha:** 2026-08-01

## Login / logout

| Rol | Login | Redirect post-login | Logout | Persistencia (reload) |
|-----|-------|---------------------|--------|------------------------|
| Admin SUPER_ADMIN | PASS | Panel / admin usable | PASS (control + salida) | Sesión mantenida en navegación |
| Participante confirmado | PASS | Mi cuenta | PASS | PASS tras reload `/mi-cuenta` |
| Participante vacío | PASS | Mi cuenta | — | PASS |
| Sin permisos | PASS | App pública / cuenta | — | — |

## Acceso denegado

| Perfil | Ruta | Resultado |
|--------|------|-----------|
| `ux.noperm@…` | `/admin` | H1 “No tenés permiso para acceder a esta sección” — **PASS** |
| Visitante | `/admin` | Redirect a login (comportamiento previo) |

## Redirecciones

* Login unificado sirve admin y participante.
* Canonical/OG aún pueden citar dominio productivo (P2 config `APP_URL`) — no bloquea auth.

## Capturas (sanitizadas)

Directorio: `docs/clickaton/ux-validation/screenshots/auth/`

* `admin-login-done-dashboard.png`, `admin-home.png`, `admin-logout.png`
* `participant-mi-cuenta-confirmada.png`, `participant-mi-cuenta-vacia.png`, `participant-logout.png`
* `noperm-admin-denied.png`

Sin contraseñas, tokens ni cookies en docs.

## E2E

`e2e/auth-staging.spec.ts` — se ejecuta solo con `CLICKATON_E2E_ADMIN_*` / `CLICKATON_E2E_USER_*`. Sin vars → skip.
