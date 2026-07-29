# ADR-DNX-002 — Topología de runtime de identidad DNX

## Título

Topología de runtime: base de identidad compartida (Estrategia A).

## Estado

`ACCEPTED — MANDATORY`

## Fecha

2026-07-29

## Contexto

Tras 10B.4, el código de autenticación es compatible (`@repo/auth`), pero Clickatón Staging/Production usa Neon/DB propia. Eso impide que el mismo email resuelva el mismo `User.id` en runtime y bloquea registro/reset cross-app reales.

## Decisión

**Estrategia A — DB de identidad compartida.**

Todas las aplicaciones consultan el mismo modelo `User`, credenciales, identidades externas (`googleId` / futuro `ExternalIdentity`) y `UserSession` / `PasswordResetToken` / `EmailVerificationToken` en la **misma instancia de base de identidad**.

### Implicaciones

1. Clickatón Staging debe apuntar `DATABASE_URL` / `DIRECT_URL` a la DB de identidad suite (misma que CLF/FotoRank/InfoSpot/FotoOffice), **o** a un schema compartido de identidad en esa instancia.
2. Las tablas operativas de Clickatón (ediciones, registros, etc.) pueden convivir en el mismo schema Prisma monorepo (estado actual del código) siempre que no colisionen nombres.
3. **Prohibido** copiar hashes/usuarios entre Neons como solución permanente (Estrategia C).
4. Estrategia B (servicio HTTP central) queda como evolución futura alineada a SSO (`auth.dnxsuite.com`), no como bypass de esta etapa.

## Plan Clickatón Staging (operativo)

1. Backup Neon `clickaton_staging`.
2. Inventario de `User` en Clickatón vs suite (`DNX_ACCOUNT_MIGRATION_INVENTORY.md`).
3. Fusiones seguras + `UserIdentityAlias` para conflictos.
4. Apuntar Staging Clickatón a DB identidad suite.
5. `prisma migrate deploy` (nunca `db push`).
6. Validar 6 ediciones + health + login cross-app.
7. Solo entonces Production.

## Consecuencias

- Cross-app login/register/reset dejan de estar bloqueados por infraestructura.
- Migración de usuarios Clickatón históricos requiere revisión manual de duplicados.
- Rollback: restaurar `DATABASE_URL` Clickatón al Neon propio + backup (sin DELETE de usuarios suite).

## Excepciones

Ninguna excepción funcional sin nuevo ADR.  
`FotorankJudgeAccount` sigue siendo deuda de producto (no sustituye User).
