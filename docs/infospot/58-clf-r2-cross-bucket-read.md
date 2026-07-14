# 58 — Lectura R2 CLF cross-bucket (thumbs galería)

**Fecha:** 2026-07-14  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Síntoma:** galería editorial muestra «Vista previa no disponible» en todas las fotos CLF.

No incluye secretos.

---

## Causa

El proxy `/api/redaccion/clf-photos/[id]/thumb` lee keys comerciales (`photo-variants/…`, `albums/…`) con el cliente R2 de Info Spot (`R2_BUCKET_NAME=infospot-media`).

Esas keys viven en el bucket CLF (`compramelafoto-prod` / staging), no en `infospot-media`.

Evidencia (staging/local readonly + CDN):

| Origen | Key `photo-variants/184022/thumb_wm_v7.jpg` |
|--------|-----------------------------------------------|
| CDN CLF `pub-994c…r2.dev` | **200** |
| CDN Info Spot `pub-3cc4…r2.dev` | **404** |

El smoke R2 22G validó solo el namespace `infospot/…` en `infospot-media`; no la lectura de material CLF.

---

## Fix (código)

`apps/infospot/lib/r2-read.ts`:

1. Keys `infospot/…` → GetObject en `R2_BUCKET_NAME`.
2. Keys CLF → GetObject en `CLF_R2_BUCKET_NAME` (si hay credenciales con acceso).
3. Fallback → `GET https` allowlisted a `CLF_R2_PUBLIC_URL/{key}` (anti-SSRF: solo ese host).

Import / derivados editoriales reutilizan el mismo helper.

---

## Variables nuevas (Production + Preview)

| Variable | Ejemplo Production | Obligatoria |
|----------|--------------------|-------------|
| `CLF_R2_PUBLIC_URL` | `https://pub-994c690619564473b8ce8b798ffa1eb4.r2.dev` | **Sí** (mínimo para thumbs) |
| `CLF_R2_BUCKET_NAME` | `compramelafoto-prod` | Recomendada (GetObject si el token lo permite) |
| `CLF_R2_ACCESS_KEY_ID` / `SECRET` | opcionales | Solo si el token Info Spot no lee el bucket CLF y se prefiere S3 vs CDN |

Staging: apuntar al bucket/CDN de `compramelafoto-staging`.

Tras cargar envs → **redeploy** Info Spot (Production y Preview).

---

## Validación

```bash
pnpm --filter infospot test:r2-read
# Con sesión redacción, en Network:
# GET /api/redaccion/clf-photos/{id}/thumb?albumId=… → 200 image/jpeg
```

---

## Fuera de alcance

- No rotar keys Info Spot.
- No mezclar writes Info Spot en bucket CLF.
- No DNS / Google Cloud.
