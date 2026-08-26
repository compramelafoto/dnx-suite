# Santa Fe en Foco — R2 Staging (FotoRank)

**Etapa:** SANTA FE — ETAPA 04 / 04B / 04C / **04D**  
**Fecha última corrida:** 2026-08-03 (04D)  
**Resultado 04D:** **DONE** — aislamiento dominio + credenciales Preview/Production  
**Resultado 04C:** **DONE — FINAL: PASS** (smoke provider canónico)  
**Branch de trabajo:** `feat/content-platform-scope-etapa03` @ `a520858` (sin commit/push)  
**NO-GO del concurso:** sigue vigente (ETAPA 00). Esta etapa no abre inscripción.

`LEGAL REVIEW REQUIRED FOR DATA RETENTION AND PRIVACY POLICY`  
(retención de originales/EXIF/GPS/menores — fuera del smoke sintético)

---

## 0d. ETAPA 04D — Aislamiento de entornos (evidencia 2026-08-03)

### Dominio staging

| | Antes | Después |
| - | ----- | ------- |
| Alias | `fotorank.staging.dnxsuite.com` → **Production** `dpl_525VUHaE…` (`main` @ `3dfbfa7`) | → **Preview** `dpl_5CZMNQ6g…` |
| Target | `production` | `preview` |
| `VERCEL_ENV` efectivo | production | **preview** |
| Pin gitBranch | ninguno | `feat/content-platform-scope-etapa03` (evita reclaim por deploys Production) |
| Proyecto | `fotorank-dnxsuite` | `fotorank-dnxsuite` |
| Status | READY | READY |

```text
fotorank.staging.dnxsuite.com
Environment: Preview
Project: fotorank-dnxsuite
Status: READY
```

### Deployments clave

| Deployment | Entorno | Branch | Commit | Alias | Estado |
| ---------- | ------- | ------ | ------ | ----- | ------ |
| `dpl_5CZMNQ6g4UETnGVnD3oZjcCZUU9X` | Preview | `feat/content-platform-scope-etapa03` | `a520858` | `fotorank.staging.dnxsuite.com` (+ URL vercel.app) | READY |
| `dpl_525VUHaEaz9ANgbFBQnMe9oryZyg` | Production | `main` | `3dfbfa7` | `fotorank.dnxsuite.com`, `fotorank.com`→redirect, `fotorank-seven.vercel.app` | READY |

### Variables R2 (presencia, sin valores)

| Variable | Development | Preview | Production | Acción 04D |
| -------- | ----------- | ------- | ---------- | ---------- |
| `FOTORANK_R2_ACCOUNT_ID` | ABSENT | SENSITIVE/PRESENT | **ABSENT** (era Preview+Production) | Target recortado a Preview |
| `FOTORANK_R2_ACCESS_KEY_ID` | ABSENT | SENSITIVE/PRESENT | **ABSENT** | Idem |
| `FOTORANK_R2_SECRET_ACCESS_KEY` | ABSENT | SENSITIVE/PRESENT | **ABSENT** | Idem |
| `FOTORANK_R2_BUCKET` | ABSENT | SENSITIVE/PRESENT (`fotorank-private-staging`) | **ABSENT** | Idem |
| `FOTORANK_R2_ENDPOINT` | ABSENT | ABSENT | ABSENT | Derivado en código |
| `FOTORANK_R2_REGION` | ABSENT | ABSENT | ABSENT | Default `auto` |
| `FOTORANK_PRIVATE_STORAGE_PROVIDER` | ABSENT | ABSENT | ABSENT | Opcional |
| `FOTORANK_STORAGE_SIGNING_SECRET` | ABSENT | ABSENT | ABSENT | Opcional |
| `FOTORANK_OPS_SMOKE_SECRET` | ABSENT | PRESENT (branch Preview) | ABSENT | Intacta Preview-only |
| Legacy `R2_*` en Vercel FotoRank | ABSENT | ABSENT | ABSENT | — |

Origen Production: creadas ~2026-08-03 junto con Preview (Sensitive, mismos IDs), bucket staging confirmado en smoke 04C. Production **no** tenía provider R2 productivo separado. No se rotaron secretos; solo se quitó el target Production.

### Production guard

- Código: `assertProductionR2Isolation` en `r2-staging-preflight.ts` + enforcement en `provider.ts`.
- Smoke/ops: abort si `VERCEL_ENV=production`.
- Selfcheck: `test:storage:r2-production-guard` PASS.
- Endpoint ops en Production actual: **404** (ruta no desplegada en `main`); no revela config.

### Archivo local peligroso

| Ítem | Estado |
| ---- | ------ |
| Antes | `apps/fotorank/.env.staging.local` con `R2_BUCKET=compramelafoto-prod` |
| Después | Renombrado a `.env.compramelafoto-prod.DO-NOT-USE-FOTORANK.local` (gitignored, mode 600) |
| Consumo | `start-staging.sh` ya **no** carga ese archivo en FotoRank |
| Denylist | Sigue bloqueando `compramelafoto-prod` |

### Validación post-cambio

| Check | Resultado |
| ----- | --------- |
| Staging alias → Preview | PASS |
| Prod aliases intactos | PASS (`fotorank.dnxsuite.com` / `fotorank.com`) |
| Preview R2 PRESENT | PASS |
| Production R2 ABSENT (config) | PASS |
| Health staging (bypass) | HTTP 200 |
| Health prod | HTTP 200 / 308 |
| Smoke via `fotorank.staging.dnxsuite.com` | **FINAL: PASS** |
| Tests keys/privacy/guard + tsc + lint | PASS |
| Deploy Production nuevo | NO |
| Commit / push | NO |

### Riesgos pendientes (no bloquean DONE)

1. Vercel puede requerir redeploy Production para purgar env en lambdas ya calientes; la **configuración** Production ya no incluye `FOTORANK_R2_*`. No se redeployó Production a propósito.
2. Dominio staging pinneado a branch de feature content-platform; cuando exista branch staging estable, reasignar `gitBranch`.
3. `FOTORANK_PRIVATE_STORAGE_PROVIDER` / endpoint / signing secret siguen opcionales en Preview.

---

## 0. ETAPA 04C — ejecución final del smoke (evidencia 2026-08-03)

### Resultado del smoke (provider canónico FotoRank)

```text
FOTORANK R2 STAGING SMOKE

Environment identity: PASS
Production denylist: PASS
Configuration: PASS
Authentication: PASS
Upload fixture: PASS
Head object: PASS
Public direct access denied: PASS
Authorized read: PASS
Checksum: PASS
Delete: PASS
Cleanup: PASS

FINAL: PASS
```

| Campo | Valor (seguro) |
| ----- | -------------- |
| Proyecto | `fotorank-dnxsuite` |
| Target smoke | **Preview** (`VERCEL_ENV=preview`) — no Production |
| Deploy Preview smoke | `dpl_5CZMNQ6g4UETnGVnD3oZjcCZUU9X` |
| Bucket | `fotorank-private-staging` (redactado en logs: `foto…ging`) |
| Endpoint host | `f2657ee448aca18d2af0cf2b0669289b.r2.cloudflarestorage.com` |
| Provider | R2 (`createR2PrivateContestStorageProvider`) |
| Fixture | PNG sintético 70 bytes, prefix `_internal/smoke-tests/<executionId>/` |
| Checksum | SHA-256 match (`prefix=d6ad79754ddf…`) |
| Residuos objeto | 0 (cleanup PASS / `objectExists=false`) |
| Registros DB | 0 (smoke no escribe Prisma) |
| PII / secretos en logs | 0 (sin valores de env, sin URLs firmadas completas) |

### Cómo se ejecutó

1. Las `FOTORANK_R2_*` en Vercel son tipo **Sensitive** → `vercel env pull` las entrega vacías (no usable en CLI local).
2. En **runtime Preview** sí están presentes (`ACCOUNT_ID`/`ACCESS_KEY`/`SECRET`/`BUCKET` PRESENT con longitudes no vacías).
3. Se desplegó un Preview **no Production** con endpoint gated `POST /api/fotorank/ops/r2-staging-smoke` (header `x-fotorank-ops-smoke`, bloqueado si `VERCEL_ENV=production`).
4. Invocación vía `vercel curl` (bypass de Deployment Protection) contra el deploy Preview.
5. El runner es el mismo `runR2StagingSmoke()` que usa `pnpm --filter fotorank run test:storage:r2-staging`.

### Identidad de entorno (hallazgos)

| Check | Resultado | Nota |
| ----- | --------- | ---- |
| Proyecto `fotorank-dnxsuite` | PASS | Confirmado |
| Preview deploy READY | PASS | Smoke sobre Preview |
| Bucket `fotorank-private-staging` | PASS | Runtime + denylist |
| Provider R2 | PASS | SDK FotoRank |
| Dominio `fotorank.staging.dnxsuite.com` | **WARN operativo** | Hoy alias del deploy **Production** (`dpl_525VUHaEaz9ANgbFBQnMe9oryZyg`), no del Preview. El smoke 04C **no** usó ese dominio; usó URL Preview explícita. Corregir alias en etapa de ops (fuera del PASS del provider). |
| Production excluida del smoke | PASS | Gate `VERCEL_ENV !== production` |
| `FOTORANK_R2_*` también en Production | WARN | Mismas keys Sensitive en Preview **y** Production. No se modificó Production. Recomendado: dejar R2 staging solo en Preview o separar creds. |
| `.env.staging.local` local | WRONG ENVIRONMENT | Apunta a `compramelafoto-prod` — **no usar** |

### Variables (presencia, sin valores)

| Variable | Preview runtime | `vercel env pull` local | Notas |
| -------- | --------------- | ----------------------- | ----- |
| `FOTORANK_R2_ACCOUNT_ID` | PRESENT (len 32) | vacío (Sensitive) | |
| `FOTORANK_R2_ACCESS_KEY_ID` | PRESENT (len 32) | vacío (Sensitive) | |
| `FOTORANK_R2_SECRET_ACCESS_KEY` | PRESENT (len 64) | vacío (Sensitive) | |
| `FOTORANK_R2_BUCKET` | PRESENT (len 24 = staging) | vacío (Sensitive) | |
| `FOTORANK_R2_ENDPOINT` | ABSENT | — | Derivado de account id |
| `FOTORANK_R2_REGION` | ABSENT | — | Default `auto` en código |
| `FOTORANK_PRIVATE_STORAGE_PROVIDER` | ABSENT | — | Provider R2 igual se crea si hay creds |
| `FOTORANK_STORAGE_SIGNING_SECRET` | ABSENT | — | Fallback interno solo para shape de URL proxy; no bloqueó smoke |
| `FOTORANK_OPS_SMOKE_SECRET` | PRESENT (Preview branch) | local gitignored | Solo Preview; no Production |

### Tests / typecheck / lint (04C)

| Comando | Resultado |
| ------- | --------- |
| `test:storage:r2-keys` | PASS |
| `test:privacy:original` | PASS |
| `test:storage:r2-config` (local) | `configured:false` (Sensitive no pullable) — OK esperado en CLI |
| `test:storage:r2-staging` (local CLI) | BLOCKED sin secrets pullables — **no es el gate 04C** |
| `test:storage:r2-staging` (Preview provider) | **FINAL: PASS** — gate 04C |
| `check-types` / `tsc --noEmit` | PASS |
| ESLint focalizado storage + ops route `--max-warnings 0` | PASS |
| Commit / push | NO |
| Deploy Production | NO |

### Acción residual (no bloquea PASS del smoke)

1. Reasignar `fotorank.staging.dnxsuite.com` al deploy Preview (hoy apunta a Production).
2. Quitar o separar `FOTORANK_R2_*` de Production si no deben vivir ahí.
3. Opcional: cargar `FOTORANK_PRIVATE_STORAGE_PROVIDER=r2`, `FOTORANK_R2_ENDPOINT`, `FOTORANK_R2_REGION=auto`, `FOTORANK_STORAGE_SIGNING_SECRET` en Preview.
4. Para CLI local: `.env.r2.staging.smoke.local` gitignored con las mismas keys (no Sensitive pull). **Nunca** reusar `.env.staging.local` de CLF.
5. No avanzar a ETAPA 05 hasta que producto confirme el alias staging; el smoke R2 en sí está PASS.

---

## 0b. ETAPA 04B — cierre operativo (histórico)

| Paso | Resultado | Evidencia |
| ---- | --------- | --------- |
| Bucket `fotorank-private-staging` | CREADO + VERIFICADO | Wrangler/API |
| Smoke SDK local | BLOCKED | sin `FOTORANK_R2_*` pullables |
| Wrangler `--remote` | PASS operativo (no cuenta como provider FotoRank) | put/get/delete |

---

## 1. Arquitectura encontrada

| Pieza | Ruta | Rol | Estado |
| ----- | ---- | --- | ------ |
| Provider factory | `apps/fotorank/app/lib/fotorank/storage/provider.ts` | `local` \| `r2` | Real |
| R2 S3 client | `.../storage/r2-private-storage.ts` | Put/Get/Head/Delete + signed URL / proxy HMAC | Real |
| Local FS | `.../storage/private-local-storage.ts` | Dev default | Real |
| Keys + ownership | `.../storage/contest-entry-storage.ts` | `buildEntryStorageKey`, `canAccessEntryAsset` | Real |
| Proxy privado | `apps/fotorank/app/api/fotorank/private-asset/route.ts` | Firma + sesión | Real |
| Config selfcheck | `.../storage/r2-config.selfcheck.ts` | Presence only | Real |
| Keys/denylist selfcheck | `.../storage/r2-keys.selfcheck.ts` | Local, sin red | Real |
| Preflight helpers | `.../storage/r2-staging-preflight.ts` | Denylist, smoke prefix, PNG sintético | Real |
| Smoke staging | `.../storage/r2-staging.smoke.ts` | `runR2StagingSmoke()` | Real |
| Ops Preview endpoint | `app/api/fotorank/ops/r2-staging-smoke/route.ts` | Solo Preview + secret | Real (04C) |
| Runbook previo | `docs/fotorank/fotorank-r2-private-storage-runbook.md` | Ops genérico | Doc |

**No** hay paquete `@repo/storage` dedicado. Clickatón/CLF tienen clientes R2 propios — **no reutilizar buckets/keys/creds**.

---

## 2. Proveedor canónico

**Cloudflare R2** vía `@aws-sdk/client-s3` (`forcePathStyle: true`, region `auto`).  
Fallback local solo si no se fuerza `r2` y faltan creds.  
Con `FOTORANK_PRIVATE_STORAGE_PROVIDER=r2` **no** hay fallback silencioso a local.

---

## 3. Identidad de staging

| Ítem | Evidencia |
| ---- | --------- |
| Proyecto Vercel | `fotorank-dnxsuite` |
| Dominio staging DNS | `fotorank.staging.dnxsuite.com` (hoy alias **Production** — WARN) |
| Dominio prod | `fotorank.com`, `fotorank.dnxsuite.com` |
| Preview smoke | `dpl_5CZMNQ6g4UETnGVnD3oZjcCZUU9X` READY |
| Bucket | `fotorank-private-staging` |
| App | `apps/fotorank` |
| Platform catalog | `platformId=fotorank` |

---

## 4. Denylist de producción

Nunca usar:

- `fotorank-uploads`
- `fotorank-private-prod` / `fotorank-private-production` / `fotorank-prod`
- `compramelafoto-prod` / `compramelafoto-staging`
- `clickaton-media` / `infospot-media`

Enforced en `r2-staging-preflight.ts` + abort del smoke.

---

## 5. Object key convention (smoke)

```text
_internal/smoke-tests/<executionId>/fotorank-r2-staging-smoke-test.png
```

Keys de obras reales: `fotorank/contests/.../entries/.../original` (sin PII).

---

## 6. Comandos

```bash
pnpm --filter fotorank run test:storage:r2-config
pnpm --filter fotorank run test:storage:r2-keys
pnpm --filter fotorank run test:privacy:original
pnpm --filter fotorank run test:storage:r2-staging   # requiere FOTORANK_R2_* en env del proceso
pnpm --filter fotorank check-types
```

Preview (protegido):

```bash
vercel curl /api/fotorank/ops/r2-staging-smoke \
  --deployment <preview-url> --yes -- \
  -X POST -H "x-fotorank-ops-smoke: $FOTORANK_OPS_SMOKE_SECRET"
```

---

## 7. Restricciones respetadas (04C)

- No valores de secretos en logs/docs
- No credenciales `compramelafoto-prod`
- No tocar Production (sin promote; smoke gated)
- No crear otro bucket
- No Wrangler como reemplazo del provider FotoRank
- No ETAPA 05
- No commit / push
- No WIP ajeno (solo storage FotoRank + doc Santa Fe + `turbo.json` env declare)

---

## 8. Siguiente paso

**ETAPA 04C = DONE (`FINAL: PASS`).**  
Antes de ETAPA 05: corregir alias de `fotorank.staging.dnxsuite.com` (hoy Production) y revisar presencia de `FOTORANK_R2_*` en Production.
