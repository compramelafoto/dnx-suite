# RELEASE 10A — Readiness Report (maestro)

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo` @ `aa92de8e80ae2510db3255f694ad03c348bcd720`  
**Alcance:** auditoría + preparación RC — **sin** commit, push, deploy, migraciones prod, cobros LIVE, apertura inscripciones, publicación social.

### Veredicto global

**Actualizado 10A.1:** **READY FOR ETAPA 10B WITH WARNINGS** (código remediado).  
Ops remotas (secrets Vercel, DB migrate, OAuth LIVE Tammy) siguen pendientes — ver `RELEASE_10A1_REMEDIATION_REPORT.md`.  
**No** activar inscripciones ni cobros LIVE desde este informe.

---

## 0. Herramientas disponibles (preflight)

| Herramienta | Disponible | Notas |
|-------------|------------|-------|
| MCP Vercel (`vercel_status`) | Sí | Proyectos `clickaton-staging`, `clickaton-dnxsuite` |
| MCP `vercel_prepare_staging` | Parcial | Falla parse `type: sensitive` |
| MCP `release_*` | No para Clickatón | Platform catalog sin `clickaton` |
| MCP MP Split | Sí sandbox | `isTestPrefix: false` warning |
| MCP R2/Cloudflare | Sí (no ejercido a fondo) | |
| MCP Playwright | Sí (no e2e completo 10A) | |
| Vercel CLI | Sí | user `compramelafoto` |
| `gh` | CLI sí / auth **no** | |
| Auth0 CLI | **No** | y Auth0 N/A |
| Docker | **No** | bloquea Postgres local |
| Neon vía Prisma | **P1001** unreachable | |
| Prisma generate | OK | |
| Playwright bin | presente | solo smoke harness en repo |

Documentos generados:

- `RELEASE_10A_CHANGE_INVENTORY.md`
- `RELEASE_10A_MIGRATION_PLAN.md`
- `RELEASE_10A_AUTH0_IDENTITY_AUDIT.md`
- `RELEASE_10A_MP_OAUTH_AUDIT.md`
- `RELEASE_10A_ENVIRONMENT_MATRIX.md`
- `RELEASE_10A_URL_MATRIX.md`
- Script: `pnpm clickaton:release:check-env`

---

## Checklist maestro

| # | Área | Estado | Notas |
|---|------|--------|-------|
| 1 | Repositorio / inventario | **READY WITH WARNING** | 266 paths dirty; WIP Infospot/FR a excluir |
| 2 | Cambios incluidos | **READY WITH WARNING** | Ver inventory; staging selectivo |
| 3 | WIP excluido | **READY** | Política documentada; no borrado |
| 4 | Migraciones | **READY WITH WARNING** | welcome cast seguro + FR P0-06 expand; from-scratch sin DB |
| 5 | Auth0 | **NOT APPLICABLE** | Identidad = DNX + Google |
| 6 | Identidad Tammy | **BLOCKED** (ops) | DB/login staging pendiente |
| 7 | OAuth Mercado Pago | **READY WITH WARNING** | Callback bound; flags/secrets OFF hasta 10B |
| 8 | Variables | **READY WITH WARNING** | check-env ampliado; carga Vercel ops |
| 9 | URLs | **READY WITH WARNING** | Canónicas OK; staging deploy ERROR |
| 10 | Webhooks | **READY WITH WARNING** | Staging secret; prod ausente |
| 11 | Crons | **READY WITH WARNING** | + `payments-reconciliation` */10; social LIVE false |
| 12 | Emails | **READY WITH WARNING** | Outbox EmailQueue idempotente; Resend ops |
| 13 | Tests | **READY WITH WARNING** | payments 221 OK; typecheck clickaton preexistente roto |
| 14 | Errores | ver §Errores | |
| 15 | Bloqueos mínimos | ver §Bloqueos | |
| 16 | Comandos 10B | ver §10B | |

---

## 1. Estado del repositorio

- Ahead 24 del remote en la rama actual.
- Working tree sucio (Clickatón + payments + promotions + media + social + migraciones + **Infospot/FotoRank WIP**).
- Lockfile modificado.
- Sin conflictos.

## 2–3. Incluidos / excluidos

Ver `RELEASE_10A_CHANGE_INVENTORY.md`.

## 4. Migraciones

Cadena Clickatón `2026072801*` … `2026072818*` inventariada.  
Validación limpia **no ejecutada**. Migraciones FR P0 intercaladas = riesgo de acoplamiento.

## 5–6. Auth / Tammy

Auth0 N/A. Google OAuth + allowlist incluye `tammyytamer@gmail.com`.  
Staging **sin** `GOOGLE_CLIENT_*` → login panel bloqueado ahí.  
`audit:admin-identity` pendiente de DB.

## 7. OAuth MP

Código READY; ejecución + secrets **BLOCKED**.  
Resolver tensión I1 (owner exclusivo) vs Tammy collector 100%.

## 8–9. Variables / URLs

Matriz completa en docs dedicados.  
Script `release-check-env` añadido.

## 10. Webhooks

Ruta `/api/webhooks/dnx-payments`. Tests firma en `@repo/payments` OK (218). Staging secret presente.

## 11. Crons y workers

| Job | Ruta | Schedule | Secreto | Idempotencia | Auto 10A |
|-----|------|----------|---------|--------------|----------|
| Expire holds | `/api/cron/expire-registration-holds` | `*/15` | `CRON_SECRET` / `CLICKATON_CRON_SECRET` | hold expiry | OK infra |
| FotoRank sync | `/api/cron/fotorank-sync` | `*/5` | idem | keys sync/outbox | sync gated por edición |
| Welcome cards | `/api/cron/welcome-cards` | `*/5` | idem | welcome status | OK |
| Social publish | `/api/cron/social-publish` | `*/5` | idem | approval flow | **NO activar publish** |
| Reconciliación pagos | **No es cron** — on-demand admin / S2S / webhook | — | webhook secret | order/event idempotency | |
| Promociones | sync en request/redeem | — | — | redemption idempotency key | |
| Emails | lifecycle hooks → Resend | — | `RESEND_API_KEY` | pago sí / **email no** (gap) | TEST gates |

Staging deploy **ERROR** → crons Vercel pueden no estar sanos aunque `vercel.json` declare paths.

## 12. Emails

| Check | Hallazgo |
|-------|----------|
| Proveedor | Resend vía `@repo/auth` `sendIdentityEmail` si `RESEND_API_KEY`; si no → skip |
| From | `EMAIL_FROM` / `DNX_EMAIL_FROM` / default suite |
| Template | inline text/html por `kind` (`payment_confirmed`, etc.) |
| Prefijo | `[TEST]` en subjects |
| Campos | nombre, edición, ciudad/fecha opc., items incluidos, links mi-cuenta/resumen |
| Número participante / Instagram | **no** evidenciados en template confirmación |
| Idempotencia pago | inbox/evento DNX por `eventId` |
| Idempotencia email | **GAP** — solo audit `EMAIL_SENT`/`EMAIL_QUEUED`; riesgo doble si webhook + S2S refresh |
| SPF/DKIM/DMARC | **no verificados** en 10A |
| Gate seguridad | `CLICKATON_EMAIL_TEST_TO` / `ALLOW_ANY` / `FALLBACK_TO` |

**Impacto release:** suficiente para funnel TEST; **insuficiente** como confirmación productiva final → tarea mínima 10B/11 (quitar `[TEST]`, DNS, nº participante, Instagram, guard email-once) — **no** construir sistema nuevo en 10A. Clasificación: **READY WITH WARNING**.

Detalle identidad/MP/emails/crons ampliado por [Audit Auth0 MP identity](739d33cf-0501-4d1d-b45e-3dbbc6345118).

## 13. Tests ejecutados

| Suite | Resultado |
|-------|-----------|
| `selfcheck:price-phases` | OK |
| `selfcheck:price-phase-products` | OK |
| `selfcheck:edition-finance` | OK (24) |
| `selfcheck:edition-checkout-allocations` | OK (12) |
| `selfcheck:admin-editions-validation` | OK |
| `selfcheck:auth` / `admin-auth` | OK |
| `selfcheck:timeline` | OK (51) |
| `selfcheck:welcome-card` | OK |
| `selfcheck:fotorank-sync` | OK (30) |
| `selfcheck:social-publisher` | OK |
| `selfcheck:included-merch-variants` | OK (prisma error log DB unreachable en side-effect notify; exit 0) |
| `selfcheck:public-registration-*` | OK |
| `selfcheck:mercado-pago-test-adapter` | OK |
| `test:smoke-db-classify` | OK (6) |
| `selfcheck:dnx-payments-checkout` | **FAIL** `CONSENT_REQUIRED` |
| `selfcheck:dnx-payments-persistence` | **FAIL** `CONSENT_REQUIRED` |
| `@repo/payments test` | OK 218 |
| `@repo/promotions test` | OK 16 |
| `@repo/social-publisher test` | OK 6 |
| `@repo/media-composition test` | OK 6 |
| `prisma generate` | OK |
| `clickaton check-types` | OK |
| packages promotions/social/media check-types | OK |
| migrate from zero / seed idempotent remoto | **NO** (DB) |
| lint turbo completo | no corrido (ruido monorepo) |
| e2e Playwright completo | no corrido |

### Clasificación errores

| Error | Tipo |
|-------|------|
| `CONSENT_REQUIRED` en selfchecks checkout/persistence | **Nuevo / camino crítico** — seeds de selfcheck no envían consent imagen/social |
| Neon `P1001` | Entorno / DB inaccesible |
| Staging Vercel ERROR | Infra / build previo |
| MCP release platform missing | Entorno tooling |
| MCP vercel_prepare schema `sensitive` | Tooling bug |

---

## Bloqueos mínimos (etapa)

| Bloqueo | ¿Activo? |
|---------|----------|
| Migraciones no validadas | **Sí** |
| Callback Auth0 incorrecto | N/A (usar Google) |
| Callback Google staging no configurado / env ausente | **Sí** |
| Callback MP incorrecto / secrets ausentes | **Sí** |
| Tammy duplicada | Desconocido (DB) → tratar como bloqueo hasta audit |
| Ausencia conexión OAuth | **Sí** |
| Webhook no verificable en prod | **Sí** |
| Mezcla TEST/LIVE | **Warning fuerte** (MCP isTestPrefix false) |
| Variables faltantes | **Sí** |
| Checkout credencial incorrecta | Evitado (sin LIVE); TEST attestation pendiente |
| Inscripción activada antes de tiempo | **No activada en 10A** (mantener `registrationEnabled=false`) |

---

## Comandos exactos sugeridos — Etapa 10B

```bash
# A) Inventario / stage selectivo (sin Infospot)
# ver RELEASE_10A_CHANGE_INVENTORY.md

# B) DB temporal o Neon branch alcanzable
export DATABASE_URL='postgresql://…NO-PROD…'
pnpm --filter @repo/db exec prisma migrate deploy
CLICKATON_SEED_ARGENTINA_2026=1 pnpm --filter clickaton seed:argentina-2026
CLICKATON_SEED_ARGENTINA_2026=1 pnpm --filter clickaton seed:argentina-2026
pnpm --filter clickaton audit:admin-identity

# C) Env checks
CLICKATON_RELEASE_ENV=staging pnpm clickaton:release:check-env
CLICKATON_RELEASE_ENV=production pnpm clickaton:release:check-env

# D) Staging Vercel — cargar Google + bases; reparar deploy
# (vía Vercel dashboard / CLI env add — sin pegar secrets en chat)
# vercel --cwd apps/clickaton …  (proyecto clickaton-staging)

# E) Selfchecks críticos (arreglar CONSENT_REQUIRED en seeds)
pnpm --filter clickaton selfcheck:dnx-payments-checkout
pnpm --filter clickaton selfcheck:dnx-payments-persistence
pnpm --filter clickaton selfcheck:edition-finance
pnpm --filter @repo/payments test

# F) Tammy: primer login Google en staging (humano)
# https://clickaton-staging.vercel.app/login?next=/admin

# G) Decisión producto MP + OAuth ventana controlada (humano)
# NO activar registrationEnabled / LIVE provider

# H) Solo después de GO: migrate staging, never prod until explicit 10B/10C
```

---

## Resumen ejecutivo (16 puntos)

1. **Repo:** dirty, ahead 24, sin conflictos.  
2. **Incluir:** Clickatón + payments + promotions + media + social + migraciones Clickatón + docs 10A.  
3. **Excluir:** Infospot / editorial-intelligence / recommendations / noise.  
4. **Migraciones:** inventariadas; **no** validadas from zero.  
5. **Auth0:** N/A → DNX + Google.  
6. **Tammy:** allowlist OK; existencia DB y staging login **bloqueados**.  
7. **OAuth MP:** código OK; secrets/conexión/decisión producto **bloqueados**.  
8. **Variables:** staging incompleto (Google); prod incompleto (payments/cron/webhook).  
9. **URLs:** canónicas claras; staging unhealthy.  
10. **Webhooks:** staging parcialmente listo; prod no.  
11. **Crons:** declarados; no activar social publish.  
12. **Emails:** confirmación TEST útil; prod DNS/contenido pendiente.  
13. **Tests:** dominio verde; checkout selfcheck rojo (consent).  
14. **Errores:** consent regression + DB unreachable + staging build ERROR.  
15. **Bloqueos:** DB validate, Google staging, MP OAuth, Tammy audit, prod env.  
16. **10B:** comandos arriba — aún sin deploy prod ni cobros.
