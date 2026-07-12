# ComprameLaFoto — assets de fotos staging (álbum demo)

**Fecha:** 2026-07-11  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Álbum:** `staging-clf-demo-album` (3 fotos seed)  
**DB:** Neon staging `ep-round-fog`  
**Restricciones:** sin producción · sin R2 production · sin DNS · sin MP

---

## Cómo resuelve imágenes la app

| Campo / pieza | Rol |
| ------------- | --- |
| `Photo.originalKey` | Key R2 del original (compra / cover / source) |
| `Photo.previewUrl` | URL o key derivable vía `urlToR2Key` (fallback source) |
| `Photo.thumbWatermarkedKey` | Variante pregenerada thumb (si `PHOTO_VARIANTS_SERVE_PREGENERATED`) |
| `Photo.previewWatermarkedKey` | Variante pregenerada preview |
| Storage | Cloudflare R2 vía `lib/r2-client.ts` (S3 API) |
| Visor / grilla | `GET /api/photos/{id}/view?mode=thumb\|preview\|cover\|bought` |

El endpoint **siempre** intenta leer buffers desde R2 (`readFromR2`).  
Placehold.co en `previewUrl` **no** alcanza: `urlToR2Key` no produce un objeto R2 válido → **404** `Preview no disponible`.

En Vercel el filesystem es read-only → **no** sirve `/public/uploads` para este flujo.

Envs R2 requeridas por la app:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`
- `R2_BUCKET_NAME` (o `R2_BUCKET`)
- `R2_PUBLIC_URL` (o `R2_PUBLIC_BASE_URL` / `NEXT_PUBLIC_R2_PUBLIC_URL`)

---

## Estrategia elegida: **A — bucket R2 staging separado**

| Opción | Decisión |
| ------ | -------- |
| A. Bucket R2 staging | **Elegida** (alineada con el runtime) |
| B. Assets locales `/public` | Descartada (Vercel read-only; view usa R2) |
| C. URLs externas (placehold) | Descartada (view exige keys/objetos R2) |

### Estado de infraestructura (auditoría)

| Recurso | Estado |
| ------- | ------ |
| Vercel Preview envs R2 | **Ausentes** (solo DB + auth Google) |
| Bucket staging dedicado | **No encontrado** |
| Bucket legacy local | `compramelafoto-prod` → **PROHIBIDO** usar |

**Acción tomada:** se preparó script + documentación y se **detuvo** antes de crear recursos Cloudflare o subir a prod.

---

## Script

`apps/compramelafoto/scripts/staging/seed-photo-assets.ts`

Idempotente. Genera 3 JPEG sintéticos pequeños, sube:

| Key | Uso |
| --- | --- |
| `staging/clf-minimal-v1/photo-0N.jpg` | `originalKey` |
| `photo-variants/{photoId}/thumb_wm_v7.jpg` | `thumbWatermarkedKey` |
| `photo-variants/{photoId}/preview_wm_v7.jpg` | `previewWatermarkedKey` + base de `previewUrl` |

Actualiza DB solo esas 3 fotos; `variantsStatus=READY`.

### Guards

- `ALLOW_CLF_STAGING_PHOTO_ASSETS=1`
- DB host debe contener `ep-round-fog`
- Rechaza bucket `compramelafoto-prod` / patrones `prod`
- Si faltan envs R2 → exit 2 + checklist (sin crear recursos)

### Uso (cuando exista bucket staging)

```bash
# desde monorepo root (tsx en @repo/db)
export DATABASE_URL="…" DIRECT_URL="…"   # ep-round-fog
export ALLOW_CLF_STAGING_PHOTO_ASSETS=1
export R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=…
export R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com
export R2_BUCKET_NAME=compramelafoto-staging   # nombre staging real
export R2_PUBLIC_URL=https://pub-….r2.dev
pnpm --filter @repo/db exec tsx ../../apps/compramelafoto/scripts/staging/seed-photo-assets.ts
# opcional: --check  |  --force
```

También hay que cargar las mismas `R2_*` (+ `NEXT_PUBLIC_R2_PUBLIC_URL` si aplica) en **Vercel Preview** para que el runtime del preview pueda leer los objetos.

---

## Checklist pendiente (cerrar assets staging)

1. Crear bucket R2 staging (no prod)
2. Access keys scoped al bucket staging
3. Public URL (r2.dev o custom staging)
4. Setear envs en Vercel Preview + local
5. Ejecutar `seed-photo-assets.ts` contra `ep-round-fog`
6. Probar bypass: álbum → thumb → preview; confirmar que `mode=bought` / original no se expone sin compra
7. (Fuera de alcance) Mercado Pago sandbox

---

## Validaciones locales del cambio

| Check | Resultado |
| ----- | --------- |
| `pnpm --filter compramelafoto typecheck` | **OK** |
| `pnpm --filter compramelafoto build` | **OK** |
| `pnpm --filter compramelafoto lint` | **OK** (warnings preexistentes) |

## Ejecución / pruebas preview

| Check | Resultado |
| ----- | --------- |
| Script `--check` | **Detenido** exit 2 — faltan envs R2 staging (esperado) |
| Upload ejecutado | **NO** — sin bucket staging |
| Fotos visibles / visor | Sin cambio (sigue 404 de negocio en `/api/photos/{id}/view`) |
| Bucket/host usado | N/A (prod `compramelafoto-prod` no usado) |
| Keys creadas | N/A |
