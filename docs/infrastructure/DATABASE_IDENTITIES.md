# Database identities (DNX Suite)

**Última reconciliación:** 2026-08-01 (Imp09 Communications)
**Advertencia:** `DO NOT USE CURRENT LOCAL DATABASE_URL FOR STAGING MIGRATIONS`

No incluir connection strings, usuarios ni passwords en este documento.

---

## Tabla operativa

| Entorno | Proyecto Vercel / uso | Neon host sanitizado | Database | Uso permitido |
| ------- | --------------------- | -------------------- | -------- | ------------- |
| **Clickatón staging (vigente)** | `clickaton-staging` → `clickaton-staging.vercel.app` | `ep-round-fog-a4xgibtv***` (pooler) | `neondb` (efectiva en host compartido) | migrate/test staging Clickatón / Communications |
| Staging identidad compartida (histórica CLF preview) | Preview CLF monorepo | `ep-round-fog-a4xgibtv***` | `neondb` | preview/shared identity |
| Clickatón staging **histórico** | Documentado en 10B1 / Orders 1:N | `ep-divine-smoke-av8hmt7s***` | `clickaton_staging` | **histórico** — no asumir vigente sin revalidar |
| Producción / denylist | Nunca staging | `ep-dawn-dew***` | `neondb` | **production only — DO NOT USE FOR STAGING** |
| Producción Clickatón web | `maratonfotografica.com` / `clickaton-dnxsuite` | (ver runbook prod) | (prod) | production only |

---

## Identidad vigente Clickatón staging (Imp09)

```text
STAGING DATABASE IDENTITY: RESOLVED
```

| Campo | Valor |
| ----- | ----- |
| `STAGING_NEON_HOST_EXPECTED` | `ep-round-fog` (prefijo) |
| `STAGING_DATABASE_NAME` | `neondb` |
| `STAGING_VERCEL_PROJECT` | `clickaton-staging` |
| Fuente de verdad | (1) Health remoto efectivo `GET /api/public/health/db` → host hint `ep-round-fog-a4xgibtv-pooler`; (2) proyecto Vercel `clickaton-staging` apunta a esa DB (ediciones publicadas > 0) |

### Resolución `ep-round-fog` vs `ep-divine-smoke`

| Host | Clasificación Imp09 |
| ---- | ------------------- |
| `ep-round-fog*` | **Vigente** para Clickatón staging Vercel (2026-08-01) |
| `ep-divine-smoke*` | **Histórica** (docs 10B1 / Orders 1:N / `clickaton_staging`) — conservar en evidencia; no usar sin revalidar metadata Neon |
| `ep-dawn-dew*` | **Productiva / denylist** — `DO NOT USE FOR STAGING` |

---

## Variables explícitas (Communications)

```bash
# Obligatorio para identity/migrate — SIN fallback a DATABASE_URL
export COMMUNICATIONS_STAGING_DATABASE_URL="…"   # no commitear
export COMMUNICATIONS_EXPECTED_DATABASE_ENV=staging
export COMMUNICATIONS_EXPECTED_HOST_PREFIX=ep-round-fog
export COMMUNICATIONS_EXPECTED_DATABASE_NAME=neondb

pnpm --filter @repo/db communications:db:identity
pnpm --filter @repo/db communications:migrate:webhook-staging -- --confirm-staging-migration
```

---

## Precedencia peligrosa local

| Fuente | Host típico | Riesgo |
| ------ | ----------- | ------ |
| `packages/db/.env` | `ep-dawn-dew***` | **HIGH** — no migrar staging |
| `apps/clickaton/.env.local` | `ep-dawn-dew***` | **HIGH** |
| shell `DATABASE_URL` | variable | verificar siempre |
| `COMMUNICATIONS_STAGING_DATABASE_URL` | debe ser `ep-round-fog***` | único permitido para migrate Communications |
