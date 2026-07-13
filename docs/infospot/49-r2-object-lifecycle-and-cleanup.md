# 49 — R2 object lifecycle and cleanup (Info Spot)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Commit de implementación:** `fa55a2d`  
**Estado:** **Implementado y verificado en Production** (smoke 22G; gate 22H)  
**Gate:** [`50-multimedia-production-gate.md`](./50-multimedia-production-gate.md)

No incluye secretos.

---

## 1. Namespaces borrables

Solo keys bajo:

- `infospot/covers/`
- `infospot/editorial/`
- `infospot/events/`
- `infospot/avatars/`

Código: `apps/infospot/lib/r2-key-policy.ts` (`INFOSPOT_R2_DELETABLE_PREFIXES`).

**Nunca** autorizados: `albums/`, `photo-variants/`, URLs absolutas, `..`, keys vacías, prefijos sin objeto owned.

---

## 2. Operaciones

| Función | Ubicación | Comportamiento |
|---------|-----------|----------------|
| `deleteR2Object` | `r2-client.ts` | `DeleteObject` idempotente; reporta `existedBefore` vía Head previo |
| `r2ObjectExists` | `r2-client.ts` | HeadObject |
| `deleteInfoSpotR2Keys` | `r2-cleanup.ts` | Valida lote ≤32; rechaza si alguna key inválida |
| `purgeEditorialPhotoR2Storage` | `r2-cleanup.ts` | Keys desde DB (`editorialMaster` + variants + delivery; source solo si IS) |
| `purgeEditorialAssetR2Storage` | `r2-cleanup.ts` | Asset por id si key IS |
| API | `POST /api/redaccion/r2-cleanup` | Auth Dirección (`canManageInfoSpotSettings`); **no pública** |
| Action | `app/actions/r2-cleanup.ts` | Misma política server-side |

---

## 3. Reglas de ciclo de vida (diseño vs código)

| Regla | Comportamiento |
|-------|----------------|
| **Quitar usage** | `removeEditorialPhotoUsage` borra solo la fila de usage (+ limpia cover del artículo si aplica). **No** borra representación R2 compartida. |
| **Foto en varios artículos** | Usages independientes; purge R2 es acción explícita de Dirección (`editorialPhoto` / keys). |
| **Procesamiento FAILED** | Retry (`requestEditorialDerivative`) puede regenerar; cleanup de parciales IS queda disponible vía purge explícito antes de reintento operativo. |
| **Álbum CLF eliminado** | Sync oculta CTA (`hideCta` / `publicUrl: null`); **no** borra foto editorial autorizada en R2 IS. |
| **Licencia REVOKED** | Política pública existente (`public-coverage` / mapper) — no entrega pública; no implica delete R2 automático. |
| **Smoke** | 22G limpió R2 + DB; 22H reconfirmó ausencia (404). |

Diferencia vs diseño “ideal”: no hay worker de GC automático ni lifecycle Cloudflare Object Lock; el purge es **explícito** y acotado.

---

## 4. Tests

```bash
pnpm --filter infospot test:r2-cleanup
```

Cubre: safe key, allowlist, rechazo CLF, collect keys (omite source comercial).

---

## 5. Anti-patrones prohibidos

- Borrar por prefijo / list+delete masivo  
- Aceptar `storageKey` arbitraria desde el cliente sin allowlist  
- Endpoint público de delete  
- Tocar originales ComprameLaFoto  
- Renovar / reimprimir credenciales R2 en docs
