# Diseño SSO central DNX (Fase 5 — no bloqueante)

**Estado:** DISEÑO — Nivel 1 (identidad única + mismas credenciales) es obligatorio primero.

---

## Autoridad

Dominio sugerido: `auth.dnxsuite.com` (configurable por entorno).

## Flujo

```text
Aplicación
→ auth.dnxsuite.com/authorize?client_id&redirect_uri&state&code_challenge
→ login o reutiliza sesión central
→ authorization code (un solo uso, TTL corto)
→ callback de la aplicación
→ intercambio server-to-server (code + code_verifier)
→ cookie local dnx_session de la aplicación
```

## Requisitos

- Authorization code corto + un solo uso
- PKCE (S256)
- `state` + `nonce`
- Redirect URIs allowlist por client
- No tokens en query persistente
- Expiración estricta
- Client por aplicación
- Logout local + logout global (`revokeUserSessions`)
- Auditoría

## Relación con Nivel 1

El release **no** queda bloqueado por SSO transparente si el login independiente con credenciales unificadas funciona sobre la misma fuente `User`.

SSO construye encima de `@repo/auth` — no inventa un segundo almacén de usuarios.
