# RELEASE 10B.1 — Informe de desbloqueo

**Fecha:** 2026-07-28
**Rama:** `migration-legacy-clf-to-monorepo`

## Estado final

**PRODUCTION DATABASE IDENTITY BLOCKED**

Staging quedó operativo (`/maratones` 200, health DB OK, migraciones aplicadas, engine Prisma corregido).
**No** se redeployó Production (`maratonfotografica.com`) porque no hay Neon Clickatón Production inequívoco en la org y faltan variables OAuth/LIVE.

**Tammy aún NO puede configurar Mercado Pago en producción.**

---

### 1. Rama / commits

| Commit | Nota |
|--------|------|
| `3870015` / `b3b3c78` / `8d59ce0` | Release 10B |
| `f81b422` | Health DB + migration jury_scoring |
| `bf76c69` | binaryTargets rhel + tracing Prisma |
| `6a896cb` | Fix conflicto transpilePackages vs externals |

### 2–4. Herramientas / GitHub

| Tool | Estado |
|------|--------|
| Vercel | autenticado |
| Neon | autenticado |
| `gh` | **MANUAL ACTION REQUIRED: `gh auth login`** — PR no creado |

Comando posterior sugerido (tras login):

```bash
gh pr create --base main --head migration-legacy-clf-to-monorepo \
  --title "feat(clickaton): controlled registration release (inscripciones cerradas)" \
  --body "$(cat docs/clickaton/RELEASE_10B1_DEPLOY_UNBLOCK_REPORT.md | head -80)"
```

(Ajustar `--base` a la rama real de producción del repo.)

### 5–8. Vercel / DB

| Entorno | Proyecto Vercel | Neon | Migrada | Estado |
|---------|-----------------|------|---------|--------|
| Staging | `clickaton-staging` | `plain-sky-50672248` / branch `clickaton-staging` / DB `clickaton_staging` / `ep-divine-smoke-av8hmt7s*` | **Sí** (backup `backup-10b1-pre-migrate`) | OK |
| Local (engañoso) | — | `ep-dawn-dew-adyr8f1v*` / `neondb` | Sí (10B, wrong target) | no usar para Staging |

> **Imp09 (2026-08-01) — nota de identidad:** la fila Staging arriba es **histórica (10B1)**.
> Identidad Clickatón staging **vigente** (health Vercel): host `ep-round-fog*` / DB `neondb`.
> Ver [`docs/infrastructure/DATABASE_IDENTITIES.md`](../infrastructure/DATABASE_IDENTITIES.md).
| Production | `clickaton-dnxsuite` | **no identificada** | desconocido | **BLOCKED** |

### 9–10. `/maratones` 500

Ver `RELEASE_10B1_MARATONES_500_ROOT_CAUSE.md`.

- Causa: Query Engine `rhel-openssl-3.0.x` no empaquetado (+ DB Staging mal apuntada al inicio).
- Corrección: Neon correcta + migrate + binaryTargets + serverExternalPackages.
- Deploy Staging: `dpl_Hd8qr2HPwdECd8yDvVMmKgUaPKc1` → alias `https://clickaton-staging.vercel.app`

### 11–13. Variables / check-env

**Staging Production env (nombres):** `DATABASE_URL`, `DIRECT_URL`, Google, URLs públicas, `CLICKATON_PUBLIC_DATA_SOURCE=prisma`, crons, webhook secret, vault key staging, `DNX_SOCIAL_PUBLISHER_LIVE=false`, owner OAuth flags `false`.

**Ausentes Staging para OAuth LIVE Tammy:** `CLICKATON_MP_CLIENT_ID`, `CLICKATON_MP_CLIENT_SECRET`, (y posiblemente state secret dedicado si no se reutiliza otro).

**Production (`clickaton-dnxsuite`):** siguen faltando la mayoría de vars (cron, webhook, MP OAuth, vault, Resend, URLs checkout). `DATABASE_URL` Production no legible/confirmada.

`pnpm clickaton:release:check-env` contra Production: **no limpio** → no redeploy Prod.

Auth0: **N/A** — Google OAuth DNX (`/api/auth/google/callback`).

### 14–17. Auth / MP / email / crons

| Ítem | Staging | Production |
|------|---------|------------|
| Google login vars | cargadas | parcial / no verificadas runtime nuevo |
| MP OAuth connect route | 401 sin sesión (cableado) | código en rama; **no deploy 10B.1** |
| Owner onboarding flags | `false` | no activar hasta ventana |
| Resend | ausente local/staging | ausente |
| Crons | 401 sin secret (OK) | vars ausentes en proyecto |
| Social LIVE | `false` | `false` seteado antes |

### 18–20. Deploys / smoke Staging

| Path | Resultado |
|------|-----------|
| `/` | 200 |
| `/maratones` | **200** (ediciones smoke visibles) |
| `/api/public/health/db` | **ok:true**, 6 published |
| `/login` | 200 |
| `/admin` | 200/307 login |
| cron / MP connect | 401 |

Production actual (deploy viejo): `/` `/maratones` `/login` 200; health DB 404 (ruta nueva no desplegada).

### 21–22. Tammy / OAuth

| Ítem | Estado |
|------|--------|
| Login prod Tammy | no validado en deploy nuevo |
| Conectar MP en prod | **NO disponible aún** |
| Acción pendiente | identidad DB prod + vars MP LIVE + redeploy + flags controlados |

### 23–24. Riesgos / rollback

- No redeployar Prod hasta Neon Production confirmada.
- Staging secrets regenerados (cron/auth/vault) — rotar si se compartían con otros entornos.
- Rollback Staging: redeploy `dpl` anterior o `vercel rollback`.
- Kill switch: inscripciones off; OAuth flags false; social LIVE false.

### 25. Acciones manuales exactas para desbloquear Tammy en producción

1. **Crear/identificar Neon Production** para Clickatón (proyecto/branch/DB) y documentar host parcial.
2. Backup + `prisma migrate deploy` en esa DB (mismo SQL order-safe).
3. Cargar en `clickaton-dnxsuite` Production: `DATABASE_URL`, `DIRECT_URL`, Google, Resend, cron, webhook, vault,
   `CLICKATON_MP_CLIENT_ID/SECRET`, `CLICKATON_MP_REDIRECT_URI=https://maratonfotografica.com/api/clickaton/payments/mercadopago/callback`,
   `DNX_SOCIAL_PUBLISHER_LIVE=false`, URLs públicas apex.
4. Registrar redirect URI / webhook en app Mercado Pago LIVE.
5. Redeploy `clickaton-dnxsuite` con commit ≥ `6a896cb`.
6. Smoke: `/api/public/health/db`, `/maratones`, login Google Tammy, pantalla “Conectar Mercado Pago” **sin** completar OAuth por terceros.
7. `gh auth login` + PR.

---

## Resumen para Daniel

Staging desbloqueado. Production **bloqueada por identidad de base de datos** (y variables OAuth LIVE).
Cuando completes los pasos 1–6, el estado objetivo pasa a `READY FOR TAMMY OAUTH` / `PENDING TAMMY OAUTH AUTHORIZATION`.
