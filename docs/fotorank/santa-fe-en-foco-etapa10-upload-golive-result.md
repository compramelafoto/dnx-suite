# Santa Fe en Foco — ETAPA 10 — GO-LIVE 2 (apertura productiva de carga)

**Fecha:** 2026-08-06  
**Estado R2 smoke:** **FINAL: PASS**  
**Estado apertura upload:** **aún OFF** (NO-GO de go-live completo hasta persistencia / admisión / email / E2E)  
**Autorización institucional vigente:** CAMINO B — Mario Alberto Laus, Presidente SFPR  
**Versión legal:** `sfef-provisional-institutional-v1`  
**Revisión legal profesional:** pendiente (sin cambio respecto de ETAPA 09)

## Veredicto (smoke R2)

Preflight + smoke R2 productivo **PASS** contra bucket allowlist `fotorank-private-prod`.

`publicUploadOpen` permanece `false`; `submissionOpensAt=2099-01-01`. Jurado/resultados no tocados.

Deployment smoke: `dpl_9yZw4F9tgxKCvRJ2STfibWq4ZHTk` → alias `https://fotorank.dnxsuite.com`.

## Preflight R2 Production (corrida PASS)

| # | Chequeo | Resultado |
|---|---------|-----------|
| 1 | Identidad del entorno | **PASS** (`VERCEL_ENV=production`, bucket `foto…prod`) |
| 2 | Allowlist `fotorank-private-prod` | **PASS** |
| 3 | Denylist staging / otros productos | **PASS** |
| 4 | Autenticación provider | **PASS** |
| 5 | Upload fixture sintético | **PASS** |
| 6 | Head | **PASS** |
| 7 | Lectura autorizada | **PASS** |
| 8 | Acceso público denegado | **PASS** |
| 9 | Checksum | **PASS** (`d6ad79754ddf…`) |
| 10 | Delete | **PASS** |
| 11 | Cleanup | **PASS** |
| — | **FINAL** | **PASS** |

Endpoint: `POST /api/fotorank/ops/r2-production-smoke` (Production + header ops).  
Execution ID: `1786003902518-61a5f599`. Prefix cleanup: `_internal/smoke-tests/prod/…`.

### Env Production (presencia, sin valores)

Presentes: `FOTORANK_R2_ACCOUNT_ID`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `BUCKET` (Production+Preview), `FOTORANK_PRIVATE_STORAGE_PROVIDER=r2`, `FOTORANK_R2_REGION=auto`, `FOTORANK_ALLOW_PROD_R2=1`, `FOTORANK_OPS_SMOKE_SECRET`.  
Ausentes (no bloqueantes para este smoke): `FOTORANK_R2_ENDPOINT` (derivado de account), `FOTORANK_STORAGE_SIGNING_SECRET` (fallback `AUTH_SECRET`).

## Siguiente (sin abrir upload todavía)

1. Persistencia de obra + cola de admisión interna  
2. Email transaccional  
3. E2E punta a punta  
4. Solo con todo PASS → `ops-sfef-10-open-upload-production.ts`

## Backup previo a esta etapa

| Campo | Valor |
|-------|--------|
| Archivo | `/tmp/fotorank-prod-backups/fotorank-prod-etapa10-20260806T070155Z.dump` |
| SHA-256 | `8043dd5269e127c29974c5af4fa77256c8c1454b6869041c1965e1ca9fdcf271` |
| Herramienta | `pg_dump` PostgreSQL 17 (custom format) |
| Backup ETAPA 09 (referencia, no sustituye) | `/tmp/fotorank-prod-backups/fotorank-prod-20260806T052301Z.dump` (`a22c9606…`) |

## Estado productivo auditado (antes de apertura)

| Superficie | Estado |
|------------|--------|
| Landing | ON |
| Inscripción FREE | ON (`registrationEnabled=true`) |
| Upload | OFF (`submissionOpensAt=2099-01-01`, `publicUploadOpen=false`) |
| Jurado / scoring / ranking / resultados públicos | OFF (sin freeze ni publicación; fechas futuras en DB no activan UI) |
| Contest ID | `cmsf1je750005xpzcrizp52rd` |
| Slug | `santa-fe-en-foco` |
| TZ | `America/Argentina/Cordoba` |

Deployment tip Production al momento de esta corrida: `dpl_44JQj8kLNLqfG8DMyK5HDUa6YVbZ` (alias `fotorank.com` → `fotorank.dnxsuite.com`). El deployment citado en el brief ETAPA 09 (`dpl_93WphuCU…`) ya fue supersedido.

## R2 Production

| Ítem | Estado |
|------|--------|
| Bucket `fotorank-private-prod` | **CREADO** (CF API, 2026-08-06T06:49:31Z, ENAM, privado) |
| Bucket `fotorank-private-staging` | Existe (Preview / staging) |
| Access Key S3 para prod | **AUSENTE** — token CF actual puede listar/crear buckets pero **403** en `/accounts/{id}/tokens` |
| `FOTORANK_R2_*` en Vercel **production** | **AUSENTES** (solo `preview`) |
| `FOTORANK_PRIVATE_STORAGE_PROVIDER` production | **AUSENTE** |
| `FOTORANK_ALLOW_PROD_R2` production | **AUSENTE** |
| Smoke put/head/delete prod | **NO EJECUTADO** (sin keys) |
| MCP `user-DNX MCP` en esta sesión | No disponible |

### Acción operador (desbloqueo P0)

1. Cloudflare Dashboard → R2 → Manage R2 API Tokens → Create Account API token  
   - Permissions: Object Read & Write  
   - Bucket: **solo** `fotorank-private-prod`  
   - Sin acceso público / sin custom domain público
2. Anotar: Access Key ID, Secret Access Key, Account ID  
3. Cargar en Vercel project `fotorank-dnxsuite`, environment **Production** (Sensitive):

```text
FOTORANK_PRIVATE_STORAGE_PROVIDER=r2
FOTORANK_R2_ACCOUNT_ID=<account>
FOTORANK_R2_ACCESS_KEY_ID=<key>
FOTORANK_R2_SECRET_ACCESS_KEY=<secret>
FOTORANK_R2_BUCKET=fotorank-private-prod
FOTORANK_R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
FOTORANK_R2_REGION=auto
FOTORANK_ALLOW_PROD_R2=1
```

4. Redeploy Production (env nuevas no aplican al deployment ya READY sin redeploy).  
5. Smoke local/ops contra prod bucket (put → head → get autorizado → delete; GET público debe fallar).  
6. Recién entonces ejecutar apertura de ventana (script abajo).

## Código preparado (local, pendiente deploy Santa Fe)

| Pieza | Ubicación |
|-------|-----------|
| Apertura controlada upload | `packages/db/prisma/scripts/ops-sfef-10-open-upload-production.ts` |
| Instagram obligatorio (Santa Fe) | `InscriptionForm.tsx`, `registration-service.ts`, `registrations/route.ts` |
| Declaraciones autoría / edición / IA + Instagram en upload | `EntryUploadPanel.tsx`, `entry-service.ts`, rutas `upload` / `replace` |
| Normalización IG | `eligibility/types.ts` → `normalizeInstagramHandle` |

**No ejecutado en Production:**

```bash
SFEF_ALLOW_PRODUCTION_UPLOAD_OPEN=1 \
SFEF_INSTITUTIONAL_AUTH=1 \
DATABASE_URL=<prod> \
pnpm --filter @repo/db exec tsx prisma/scripts/ops-sfef-10-open-upload-production.ts
```

Efecto previsto del script (cuando se autorice):

- `submissionOpensAt` → `2026-08-01T03:00:00.000Z` (override con env)
- `submissionDeadline` → `2026-10-01T03:00:00.000Z`
- `publicUploadOpen=true`, JPEG ≤ 25 MB, replace hasta cierre
- **No** habilita jurado, scoring, ranking ni resultados públicos

## Checklist GO (pendiente)

| # | Chequeo | Resultado |
|---|---------|-----------|
| 1 | Backup Production fresco | **PASS** (`…etapa10-20260806T070155Z.dump`) |
| 2 | Bucket R2 prod exclusivo | **PASS** (`fotorank-private-prod`) |
| 3 | Credenciales S3 + Vercel Production | **FAIL** |
| 4 | Smoke R2 prod | **BLOCKED** |
| 5 | Deploy con IG + declaraciones | **PENDIENTE** |
| 6 | Ops open-upload | **NO EJECUTADO** (a propósito) |
| 7 | E2E prod: login → inscripción → categoría → upload → confirmación → estado → cola admisión | **PENDIENTE** |
| 8 | Reemplazo hasta deadline | **PENDIENTE** |
| 9 | Jurado / ranking / resultados siguen OFF | **PENDIENTE** (DB hoy: upload OFF) |
| 10 | Sin publicación pública de fotos / social | **PASS** (no tocado) |

## Alcance objetivo (cuando GO)

```text
Landing              ON
Inscripción FREE     ON
Upload fotografía    ON
Reemplazo            ON hasta deadline
Admisión interna     ON
Jurado               OFF
Ranking              OFF
Resultados públicos  OFF
Votación pública     OFF
```

Decisiones funcionales a respetar en E2E: participación abierta; foto tomada en Provincia de Santa Fe; captura 1-ago-2026 → 30-sep-2026; TZ Cordoba; 1 inscripción / 1 foto / 1 categoría; Instagram obligatorio; edad ≥16 + tutor 16–17; FREE; promo opt-in separado; categorías profesional / amateur / reportero-gráfico (ARGRA) / fotografía aérea (dron).

## Rollback (cuando se haya abierto)

1. Cerrar ventana de carga en DB: `submissionOpensAt` / `submissionDeadline` a fechas futuras (2099) y `publicUploadOpen=false` (o script inverso).  
2. Opcional: `registrationEnabled=false` si hay incidente de inscripción.  
3. Re-alias Production al deployment previo estable.  
4. Restore DB desde dump ETAPA 10 solo si corrupción severa (no borrar obras reales sin decisión explícita).  
5. Revocar Access Key R2 comprometida en Cloudflare.

## Notas

- No se reabrió CAMINO A; autorización CAMINO B vigente.  
- No se habilitó jurado ni resultados.  
- No se promovió Clickatón / CLF como parte de esta etapa.  
- Seed productivo ETAPA 09 dejó upload cerrado a propósito; no re-seedear Production sin `SFEF_KEEP_UPLOAD_OPEN` (si se agrega) o se volverá a cerrar la ventana.
