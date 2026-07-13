# 46 — R2 production readiness

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado de etapa:** **`COMPLETE`** (credenciales operativas + smoke 22G + gate 22H)  
**R2_STATUS:** **`VERIFIED_WORKING`**  
**Alias:** `https://infospot-dnxsuite.vercel.app` (commit **`fa55a2d`**, health `db:ok`)  
**Bucket:** `infospot-media`

Informe smoke: [`47-r2-production-smoke-report.md`](./47-r2-production-smoke-report.md).  
Gate multimedia: [`50-multimedia-production-gate.md`](./50-multimedia-production-gate.md).  
Lifecycle: [`49-r2-object-lifecycle-and-cleanup.md`](./49-r2-object-lifecycle-and-cleanup.md).

No incluye secretos.

---

## 1. Contexto histórico (22B–22F)

El token API de DNX-MCP puede listar buckets / CORS / r2.dev, pero **no** crear User API Tokens (`POST /user/tokens` → 403).  
`vercel env pull` no exporta valores `sensitive`. Cross-project copy bloqueado → [`48-r2-cross-project-credential-audit.md`](./48-r2-cross-project-credential-audit.md).

Las keys S3 en Production se consideraron “stale” por `updatedAt` del 11-jul; el smoke 22G demostró que **funcionan** (Put/Get/Delete). No renovar ni reimprimir valores.

---

## 2. Auditoría de variables (Production)

| Variable | Estado 22H |
|----------|------------|
| `R2_ACCOUNT_ID` | Presente |
| `R2_ACCESS_KEY_ID` | Presente · **operativa** (smoke) |
| `R2_SECRET_ACCESS_KEY` | Presente · **operativa** (smoke) |
| `R2_BUCKET_NAME` | Presente → `infospot-media` |
| `R2_ENDPOINT` | Presente |
| `R2_PUBLIC_URL` | Presente (r2.dev) |

---

## 3. Capacidades verificadas

| Área | Estado |
|------|--------|
| Upload / PutObject | OK |
| Lectura pública / GetObject | OK |
| Derivados WebP + JPEG | OK |
| DeleteObject idempotente | OK |
| Cleanup smoke | OK (sin residuos) |
| Protección namespace CLF | OK (422) |
| API cleanup autenticada | OK (401 sin sesión) |

---

## 4. Criterio de cierre

- **COMPLETE** — keys operativas + Production `fa55a2d` + smoke upload/read/derivados/delete/cleanup + sin exposición de secretos.  
- Procedimiento manual Cloudflare queda como runbook de **rotación** futura (no acción abierta).

---

## 5. Confirmaciones

- Google Cloud **no** configurado.  
- `infospot.com.ar` **no** lanzado públicamente.  
- No se guardaron credenciales en el repo.  
- No se reintentó creación automática de tokens tras el 403 histórico.
