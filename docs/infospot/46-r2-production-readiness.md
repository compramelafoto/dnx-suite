# 46 — R2 production readiness (Etapa 22B)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado de etapa:** **`BLOCKED_BY_MANUAL_R2_TOKEN`**  
**Alias:** `https://infospot-dnxsuite.vercel.app` (commit servido `78efb7e`, health `db:ok`)  
**Bucket:** `infospot-media`

No incluye secretos. No ejecutar smoke R2 hasta que las keys S3 estén en Vercel Production y se redeploye.

Ver también: [`45-production-services-readiness.md`](./45-production-services-readiness.md).

---

## 1. Por qué Cloudflare devolvió 403

El token de API usado por DNX-MCP puede:

- listar buckets R2;
- validar / CORS / dominio público r2.dev.

**No** puede crear User API Tokens:

```text
POST /client/v4/user/tokens → 403 Unauthorized to access requested resource
```

Sin ese permiso no se pueden generar Access Key ID / Secret Access Key S3 por API.  
**No reintentar** creación automática en bucle: el resultado será el mismo hasta ampliar permisos del token MCP (fuera de alcance) o crear el token **a mano** en el dashboard.

---

## 2. Auditoría de variables (Production)

Nombres reales en código (`apps/infospot/lib/r2-client.ts`, `r2-public-url.ts`):

| Variable | Alias aceptado | Estado 22B |
|----------|----------------|------------|
| `R2_ACCOUNT_ID` | — | **Presente** (metadata seteada 2026-07-13) |
| `R2_ACCESS_KEY_ID` | — | **Ausente / placeholder viejo** (sin update desde 2026-07-11) |
| `R2_SECRET_ACCESS_KEY` | — | **Ausente / placeholder viejo** (sin update desde 2026-07-11) |
| `R2_BUCKET_NAME` | `R2_BUCKET` | **Presente** → `infospot-media` |
| `R2_ENDPOINT` | — | **Presente** |
| `R2_PUBLIC_URL` | `R2_PUBLIC_BASE_URL` | **Presente** (r2.dev) |

Conclusión: metadata OK; **faltan las dos keys S3**. Smoke / derivados / previews de media **no** se ejecutan en esta etapa.

---

## 3. Procedimiento manual exacto (Cloudflare → Vercel)

### A) Crear token en Cloudflare

1. Entrar a [Cloudflare Dashboard](https://dash.cloudflare.com) con la cuenta que posee el bucket.  
2. Ir a **R2** → **Overview**.  
3. En **Account Details**, abrir **Manage** junto a **API Tokens** («Manage R2 API Tokens»).  
4. Crear token nuevo (**Create Account API token** o **Create User API token**).  
5. **Nombre sugerido:** `Info Spot Production Media`  
6. **Permisos mínimos:** Object Read & Write.  
7. **Scope:** Apply to specific buckets only → únicamente **`infospot-media`**.  
8. **No** otorgar Admin Read & Write ni permisos de cuenta globales.  
9. Crear y copiar de inmediato (solo se muestran una vez):
   - Access Key ID  
   - Secret Access Key  
10. Anotar el endpoint S3 mostrado (forma): `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`

### B) Pegar solo en Vercel Production (sensitive)

Proyecto: `infospot-dnxsuite` → Settings → Environment Variables → Environment **Production**.

| Dato Cloudflare | Variable Vercel |
|-----------------|-----------------|
| Access Key ID | `R2_ACCESS_KEY_ID` |
| Secret Access Key | `R2_SECRET_ACCESS_KEY` |
| Account ID | `R2_ACCOUNT_ID` (ya debería estar) |
| Bucket `infospot-media` | `R2_BUCKET_NAME` (y opcionalmente `R2_BUCKET` = mismo valor) |
| Endpoint S3 | `R2_ENDPOINT` |
| URL pública r2.dev | `R2_PUBLIC_URL` |

**Prohibido:** pegar keys en chat, issues, docs, `.env` versionado o commits.

### C) Tras cargar keys

1. Redeploy **Production** del proyecto Info Spot.  
2. Confirmar Ready + health `db:ok`.  
3. Smoke técnico: upload → read → headers → delete bajo prefijo `smoke/production-readiness/`.  
4. Smoke pipeline editorial (derivados / WebP / JPEG / EXIF) con fixture temporal.  
5. Cleanup total — sin residuos.  
6. Actualizar este doc a **COMPLETE** y subir readiness.

---

## 4. Qué queda bloqueado hasta las keys

| Área | Estado |
|------|--------|
| Upload / Biblioteca Material | Bloqueado |
| Derivados (640–1920, WebP, JPEG) | Bloqueado |
| Previews editor / portada / galería vía R2 | Bloqueado |
| Smoke CORS/cache de objetos nuevos | Bloqueado |

| Área | Estado (independiente de R2 keys) |
|------|-----------------------------------|
| Neon + health | OK |
| CLF readonly + crons | OK (401 sin secret) |
| SMTP / GA4 | Opcional no bloqueante |
| Dominio `infospot.com.ar` | Pendiente DonWeb |
| Director | Pendiente primer login + seed |

---

## 5. Criterio de cierre 22B

- **COMPLETE** solo si keys cargadas + redeploy + smoke upload/read/delete + cleanup + sin exposición de secretos.  
- **Ahora:** `BLOCKED_BY_MANUAL_R2_TOKEN` — sin simular pruebas.

---

## 6. Confirmaciones

- Google Cloud **no** configurado.  
- `infospot.com.ar` **no** lanzado públicamente.  
- No se guardaron credenciales en el repo.  
- No se reintentó creación automática de tokens tras el 403.
