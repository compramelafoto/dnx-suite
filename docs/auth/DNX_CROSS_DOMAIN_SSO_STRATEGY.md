# Estrategia SSO cross-domain DNX

**Estado:** DISEÑO (complementa ADR-DNX-001 / ADR-DNX-002 / `DNX_SSO_CENTRAL_DESIGN.md`)  
**Prerrequisito:** Estrategia A (DB identidad compartida) operativa en Staging.

---

## Nivel 1 (obligatorio ahora)

Login independiente por dominio con:

- mismo `User.id`;
- mismas credenciales;
- mismo contrato `@repo/auth`;
- cookie local `dnx_session` por app.

No compartir cookie entre dominios.

## Nivel 2 (SSO transparente — Fase E/F)

Autoridad `auth.dnxsuite.com`:

```text
App → /authorize (PKCE) → login central → code → callback app → dnx_session local
```

Ver `DNX_SSO_CENTRAL_DESIGN.md`.

## Regla

El release de Cuenta Universal **no** espera al Nivel 2 si el Nivel 1 funciona sobre DB compartida.
