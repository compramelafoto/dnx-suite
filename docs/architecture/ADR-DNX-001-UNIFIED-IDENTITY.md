# ADR-DNX-001 — Identidad única obligatoria para DNX Suite

## Título

Identidad única obligatoria para DNX Suite.

## Estado

`ACCEPTED — MANDATORY`

## Fecha

2026-07-29

## Contexto

Se comprobó que credenciales de ComprameLaFoto no funcionaban en Clickatón ni FotoRank, y que Clickatón opera con Neon propio pese a compartir el modelo Prisma `User`. Eso contradice el objetivo de DNX Suite: una persona, un usuario, unas credenciales.

## Decisión

Una persona tiene un único `User.id` DNX.

- Credenciales centralizadas en `User` (`packages/db`) operadas solo vía `@repo/auth`.
- External identities centralizadas (hoy `User.googleId`; futuro `ExternalIdentity`).
- Sesiones por contrato central (`UserSession` + cookie `dnx_session`).
- Roles y perfiles por aplicación (no duplicar usuarios).
- Payment accounts globales (`DnxFinancialIdentity` / `DnxPaymentAccount`) con grants por app.
- Prohibición de usuarios locales como fuente de autenticación.
- Auth0 no es fuente de usuarios DNX (si se usa en el futuro: autentica; DNX determina `User.id`).

## Aplicaciones alcanzadas

ComprameLaFoto, Clickatón, FotoRank, InfoSpot, FotoOffice, DNX Payments y **todas las futuras**.

## Reglas

1. Email normalizado = persona.
2. Un único `User.id`.
3. Misma contraseña / proveedor en todas las plataformas.
4. Google reutiliza el mismo User.
5. Sesiones locales por dominio, mismo `User.id`.
6. Mercado Pago vinculado al User DNX global.
7. Ninguna app crea User sin consultar identidad central (`resolveOrCreateUser`).
8. Ninguna app mantiene fuente de verdad auth propia.
9. CI: `pnpm auth:architecture:check`.
10. **UX/UI unificada (10B.7):** todas las apps usan la misma arquitectura de autenticación visual (`@repo/auth-ui`), el mismo orden de elementos y los mismos comportamientos; el branding es por configuración. CI: `pnpm auth:ui:architecture:check`. Ver `docs/auth/DNX_AUTH_UI_SYSTEM.md`.

## Consecuencias

- Migración de hashes bcrypt → scrypt progresiva.
- Compatibilidad temporal: cookie `auth-token`, jueces FotoRank, columnas MP legacy.
- Necesidad de consolidar DB Clickatón (Estrategia A) o servicio central (Estrategia B).
- SSO central (`auth.dnxsuite.com`) como Fase 5 — no bloquea Nivel 1.
- Controles de CI y auditoría.

## Relacionado

- **ADR-DNX-002** — topología runtime (DB identidad compartida).
- Estándares 10B.5: `docs/auth/DNX_ACCOUNT_LIFECYCLE_STANDARD.md` y satélites.
- Estándares 10B.7 UX: `docs/auth/DNX_AUTH_UX_STANDARD.md`, `DNX_AUTH_UI_SYSTEM.md`.

## Excepciones

Ninguna excepción funcional sin nuevo ADR aprobado explícitamente.

Excepciones temporales documentadas (deuda, no permiso permanente):

- `FotorankJudgeAccount` (identidad paralela de jurados).
- Cookie CLF `auth-token` (bridge de lectura).
- Registers role-specific CLF (`register-photographer|lab|organizer`) hasta migrar a `registerDnxAccount`.
- Google callback CLF aún LEGACY.
