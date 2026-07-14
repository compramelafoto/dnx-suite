# 46 — R2 production readiness

**Fecha:** 2026-07-14  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado de etapa:** **`COMPLETE`** (rotación keys + smoke post-deploy 22G + gate 22H)  
**R2_STATUS:** **`VERIFIED_WORKING`**  
**Alias:** `https://infospot-dnxsuite.vercel.app` (deploy **`dpl_F8uop3SQc7aCbEiet59KC2TLjPs1`**, commit **`3d0cd77`**, health `db:ok`)  
**Bucket:** `infospot-media`

Informe smoke histórico: [`47-r2-production-smoke-report.md`](./47-r2-production-smoke-report.md).  
Validación post-rotación: [`56-r2-post-deploy-validation.md`](./56-r2-post-deploy-validation.md).  
Gate multimedia: [`50-multimedia-production-gate.md`](./50-multimedia-production-gate.md).  
Lifecycle: [`49-r2-object-lifecycle-and-cleanup.md`](./49-r2-object-lifecycle-and-cleanup.md).

No incluye secretos.

---

## 1. Contexto histórico (22B–22F)

El token API de DNX-MCP puede listar buckets / CORS / r2.dev, pero **no** crear User API Tokens (`POST /user/tokens` → 403).  
`vercel env pull` no exporta valores `sensitive`. Cross-project copy bloqueado → [`48-r2-cross-project-credential-audit.md`](./48-r2-cross-project-credential-audit.md).

Tras rotación manual (2026-07-14): Access Key / Secret con `updatedAt` fresco; redeploy Production Ready; smoke post-deploy **PASS**.

---

## 2. Auditoría de variables (Production)

| Variable | Estado 22G post-deploy |
|----------|------------------------|
| `R2_ACCOUNT_ID` | Presente |
| `R2_ACCESS_KEY_ID` | Presente · **rotada** · `updatedAt=2026-07-14T00:05:00.719Z` |
| `R2_SECRET_ACCESS_KEY` | Presente · **rotada** · `updatedAt=2026-07-14T00:05:37.157Z` |
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

- **COMPLETE** — keys rotadas con `updatedAt` fresco + Production `dpl_F8uop3SQ…` (`3d0cd77`) + smoke upload/read/derivados/delete/cleanup + sin exposición de secretos.  
- Procedimiento manual Cloudflare queda como runbook de **rotación** futura.

---

## 5. Confirmaciones

- Google Cloud **no** configurado.  
- `infospot.com.ar` **no** lanzado públicamente.  
- No se guardaron credenciales en el repo.  
- No se reintentó creación automática de tokens tras el 403 histórico.
