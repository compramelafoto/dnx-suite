# Clickatón — Login unificado (Etapa 10B3)

## Ruta oficial

`/login` — única pantalla visible para usuarios y administradores.

Métodos:

* Continuar con Google (DNX Identity / OAuth Suite)
* Email y contraseña (DNX Identity)

Resultado: cookie `dnx_session` (una sola identidad).

## Autenticación ≠ autorización

| Capa | Resultado |
|------|-----------|
| Autenticación | Quién sos → `dnx_session` |
| Autorización admin | Allowlist / `SUPER_ADMIN` → `/admin` |

Un usuario autenticado sin permiso admin puede usar `/mi-cuenta` y el sitio público. Si pide `/admin`, ve `/admin/acceso-denegado` **sin perder la sesión**.

## `/admin/login`

Redirige a:

```text
/login?next=/admin
```

(conserva `next` administrativo seguro).

## Destinos (`next`)

Válidos: paths internos (`/mi-cuenta`, `/maratones`, `/admin…`, …).  
Inválidos: URLs absolutas, `//…`, `/api…`, `/login`.

Sin `next` → `/mi-cuenta`.

## Header

* Sin sesión: **Iniciar sesión** (derecha).
* Con sesión: menú (Mi cuenta, Panel administrativo si admin, Cerrar sesión).

## Google OAuth

Callback: `{origin}/api/auth/google/callback` (mismo host que el inicio).  
Cookie transit host-only + `Secure` solo en HTTPS.

URIs Google Cloud:

* `http://localhost:3005/api/auth/google/callback`
* `https://maratonfotografica.com/api/auth/google/callback`

## Logout

Invalida `dnx_session` y vuelve al sitio público (`/`).

## Scripts

```bash
pnpm --filter clickaton selfcheck:auth
pnpm --filter clickaton selfcheck:admin-auth
```
