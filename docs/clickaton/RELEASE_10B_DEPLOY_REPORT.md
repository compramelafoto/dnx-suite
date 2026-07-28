# RELEASE 10B — Informe de deploy controlado

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD final:** `b3b3c78`  
**Readiness inicial 10A.1:** `READY FOR ETAPA 10B WITH WARNINGS`

## Veredicto

**DEPLOY BLOCKED**

Código committeado y pusheado; Preview/Staging Vercel del proyecto `clickaton-staging` en **READY**; migraciones aplicadas sobre la Neon apuntada por `packages/db/.env` (`ep-dawn-dew-adyr8f1v`).  
Bloquea el cierre completo:

1. **Production host** `maratonfotografica.com` (`clickaton-dnxsuite`) **no** redeployado (faltan variables críticas).
2. Staging runtime: `/maratones` → **500** (Prisma error en logs).
3. No se pudo confirmar que la `DATABASE_URL` de Vercel Staging/Prod sea la misma Neon migrada (pull de secretos vacíos).
4. OAuth Mercado Pago LIVE / login Tammy en producción: **no ejecutados**.
5. `gh` sin autenticación → PR no creado.

Inscripciones siguen cerradas. No hubo cobros reales. `DNX_SOCIAL_PUBLISHER_LIVE=false` seteado en Staging/Prod Vercel (Production env).

---

## 1. Readiness inicial

| Fuente | Estado |
|--------|--------|
| `RELEASE_10A1_REMEDIATION_REPORT.md` | READY FOR ETAPA 10B WITH WARNINGS |
| OAuth stubs | NO_STUBS (connect/callback/revoke/reconnect) |
| Auth0 | N/A — identidad DNX + Google |

## 2–5. Git / push / PR

| Ítem | Valor |
|------|--------|
| Repo | `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite` |
| Remote | `origin` → `https://github.com/compramelafoto/dnx-suite.git` |
| Commits 10B | `3870015` feat(clickaton): prepare controlled production registration release |
| | `b3b3c78` fix(db): make Clickaton photo upload migration order-safe |
| Push | OK (`3870015`…`b3b3c78` → `origin/migration-legacy-clf-to-monorepo`) |
| PR | **MANUAL ACTION REQUIRED** — `gh auth login` |

### Ramas → entornos

| Entorno | Proyecto Vercel | Disparo observado |
|---------|-----------------|-------------------|
| Staging | `clickaton-staging` | Deploy CLI desde monorepo root; alias `https://clickaton-staging.vercel.app` |
| Production | `clickaton-dnxsuite` | Dominios `maratonfotografica.com` / `www`; **sin redeploy 10B** |
| Histórico | branch `clickaton-staging` | Deploys previos en ERROR/CANCELED (commit `657562f`) |

## 6–7. Archivos incluidos / WIP excluido

**Incluido (335 paths en commit principal):** `apps/clickaton`, `packages/payments`, `packages/promotions`, `packages/media-composition`, `packages/social-publisher`, `packages/db` schema+migrations, `docs/clickaton`, `docs/social-publisher`, lockfile, `turbo.json`, `.gitignore`, root `package.json` (`clickaton:release:check-env`).

**Excluido (WIP intacto):** `apps/infospot/**`, `packages/editorial-intelligence/**`, `packages/recommendations/**`, `apps/fotorank/**` (app P0), `apps/compramelafoto`, `apps/dnx-sales-assistant`, `services/dnx-mcp`, `.env*`, `packages/db/.data`.

## 8. Secret scan

Staged scan: **CLEAN** (solo fixtures cortos `APP_USR-test…` / `TEST-abc…` en tests de payments; no `.env` reales).

## 9. Tests / build

| Check | Resultado |
|-------|-----------|
| `pnpm install --frozen-lockfile` | OK |
| `@repo/payments test` | 221 pass |
| selfchecks phases / finance / allocations / merch / email / social / FR sync / welcome / timeline | OK |
| `clickaton check-types` | OK (tras fix vault cast) |
| `clickaton build` | OK con `next build --webpack` + extensionAlias `.js`→`.ts` |
| Fix cliente | `google-oauth` ya no reexporta session-cookie (evita `node:crypto` en client) |
| Lint monorepo completo | no bloqueante documentado |

## 10. Variables

### Staging (`clickaton-staging`) — nombres presentes

`DATABASE_URL`, `APP_URL`, `AUTH_*`, `CRON_SECRET`, `CLICKATON_CRON_SECRET`, MP **TEST** tokens, webhook staging, `CLICKATON_PUBLIC_URL`, provider test, etc.

**Ausentes staging (bloquean OAuth/login Google en staging):**  
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CLICKATON_MP_CLIENT_*`, `CLICKATON_MP_REDIRECT_URI`, `DNX_FINANCIAL_CREDENTIAL_MASTER_KEY`, `RESEND_API_KEY`, `EMAIL_FROM`, flags owner OAuth.

**Seteado en 10B:** `DNX_SOCIAL_PUBLISHER_LIVE=false` (Production).

### Production (`clickaton-dnxsuite`) — solo 5 vars + social flag

Presentes: `APP_URL`, `CLICKATON_PUBLIC_WEB_BASE_URL`, `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `DNX_SOCIAL_PUBLISHER_LIVE`.

**Ausentes prod (bloquean 10B completo):** cron secrets, webhook DNX Payments, MP OAuth LIVE, vault key, Resend, public URL/checkout URLs, owner OAuth flags, etc.

### MANUAL ACTION REQUIRED — variables

Completar vía Vercel Dashboard/CLI (sin pegar secretos en git), luego:

```bash
CLICKATON_RELEASE_ENV=staging pnpm clickaton:release:check-env
CLICKATON_RELEASE_ENV=production pnpm clickaton:release:check-env
```

## 11. Auth0

**N/A.** Login previsto: Google → `@repo/auth` → cookie `dnx_session`.  
Email Tammy: `tammyytamer@gmail.com` (allowlist admin; sin contraseña nueva).

## 12. URLs

| Superficie | URL | Estado 10B |
|------------|-----|------------|
| Staging alias | `https://clickaton-staging.vercel.app` | Deploy READY |
| Staging deploy | `https://clickaton-staging-r1rr92y2v-compramelafotos-projects.vercel.app` | READY `dpl_HGn9SpVLAbx4Sn8rFUTcMkocQPak` |
| Preview previo | `https://clickaton-staging-jp2tr40zi-compramelafotos-projects.vercel.app` | READY `dpl_CxXK4dEeaHFvPemZdLGghRHmJjqv` |
| Production | `https://maratonfotografica.com` | **sin redeploy 10B** |
| MP connect/callback/reconnect/revoke | `/api/clickaton/payments/mercadopago/*` | cableados; staging responde **401** sin sesión |
| Cron reconcile | `/api/cron/payments-reconciliation` | **401** sin secret (esperado) |

## 13–16. Mercado Pago / OAuth / Tammy

| Ítem | Estado |
|------|--------|
| Callback/reconnect/revoke runtime | Código READY |
| Redirect URI / app LIVE MP | **MANUAL ACTION REQUIRED** (vars ausentes) |
| Autorización personal Tammy | **NO hecha** — no automatizar |
| `DnxPaymentAccount` Tammy | No verificada en esta etapa |

## 17. Migraciones

| Paso | Resultado |
|------|-----------|
| DB host (local `.env`) | `ep-dawn-dew-adyr8f1v…neon.tech` / `neondb` |
| Fallback `contact_messages` failed (tabla ya existía) | `migrate resolve --applied` |
| Fallo orden `photo_upload` vs enum FR | SQL remediado + `resolve --rolled-back` + redeploy |
| `prisma migrate deploy` | **All migrations successfully applied** (status up to date) |
| Backup Neon CLI | **MANUAL ACTION REQUIRED** (neonctl no autenticado) |
| Confirmación DB = Vercel Staging/Prod | **NO confirmada** (secret pull vacío) |

Seeds destructivos: no ejecutados. Inscripciones: no habilitadas.

## 18–19. Preview / Production

| Target | Deploy | Smoke |
|--------|--------|-------|
| Preview staging | READY | `/` `/login` 200; cron/connect 401; `/maratones` **500** |
| Staging production alias | READY + alias | mismo patrón `/maratones` 500 + Prisma en logs |
| Production `clickaton-dnxsuite` | **NO** | bloqueado por env incompleto |

## 20–22. Login Tammy / cuenta / distribución

No ejecutado en producción. Distribución Tammy 100%: no activada.

## 23–25. Email / reconciliación / crons

| Ítem | Código | Ops |
|-------|--------|-----|
| Email outbox idempotente | OK | Resend ausente en Vercel |
| Cron reconcile + FR + welcome + social | en `vercel.json` | secrets ausentes en prod project |
| Social LIVE | flag false seteado | no publicar |

## 26. Riesgos

1. Staging `/maratones` 500 → probable DB Vercel ≠ Neon migrada o `DATABASE_URL` inválida en runtime.
2. Production env incompleta → redeploy rompería pagos/crons/OAuth.
3. Cadena migraciones compartida Clickatón+FotoRank P0.
4. Producto: owner OAuth exclusivo vs collector Tammy 100% (tensión 10A).
5. MCP `vercel_prepare_staging` falla por tipo env `sensitive`.
6. Root Directory Vercel: deploy debe hacerse desde **monorepo root** (path `apps/clickaton/apps/clickaton` si se linkea desde app).

## 27. Rollback

| Palanca | Acción |
|---------|--------|
| Inmediata | Mantener inscripciones off; no activar distribución; OAuth flags off |
| Deploy staging | `vercel rollback` / redeploy SHA anterior en `clickaton-staging` |
| Deploy prod | no cambiado en 10B |
| Migraciones | no DROP destructivo; rollback solo con procedimiento expand/contract |
| Social | `DNX_SOCIAL_PUBLISHER_LIVE=false` |
| Variables | revertir desde Vercel UI |

## 28. Acciones manuales

1. `gh auth login` → crear PR desde `migration-legacy-clf-to-monorepo`.
2. Confirmar host Neon de Staging vs Prod vs `ep-dawn-dew`; si difieren, `prisma migrate deploy` contra cada una con backup.
3. Diagnosticar Prisma 500 en `/maratones` (logs Vercel + `DATABASE_URL`).
4. Cargar vars faltantes (Google staging, MP OAuth LIVE, vault, Resend, crons prod, webhook prod).
5. Configurar redirect URI / webhook MP oficiales HTTPS.
6. Redeploy `clickaton-dnxsuite` solo tras check-env 0 blocks.
7. Tammy: login Google `tammyytamer@gmail.com` → Conectar Mercado Pago (personal).
8. Daniel: validar distribución 10.000 bps sin abrir inscripciones.

## 29. Bloqueos

- Production Clickatón no redeployada.
- Staging funcional parcial (`/maratones` 500).
- OAuth LIVE no operable (vars).
- PR ausente (`gh`).
- Auth0 N/A (esperado).

## 30. Recomendación Etapa 10C

No iniciar 10C (validación e2e / pago real) hasta:

1. Staging `/maratones` 200 y panel usable.
2. Production deploy READY con check-env limpio.
3. Migraciones confirmadas en la DB de Production.
4. Tammy logueada y `DnxPaymentAccount` ACTIVE LIVE (o explícitamente `PENDING TAMMY OAUTH AUTHORIZATION` como único pendiente).

**Próximo estado esperado tras ops manuales:** `PENDING TAMMY OAUTH AUTHORIZATION` o `READY FOR ETAPA 10C WITH WARNINGS`.
