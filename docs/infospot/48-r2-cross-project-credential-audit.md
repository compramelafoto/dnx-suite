# 48 — Auditoría de credenciales R2 entre proyectos Vercel (Etapa 22F)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Estado:** **`BLOCKED_SECRET_NOT_EXPORTABLE`**  
**Acción siguiente:** **`MANUAL_CLOUDFLARE_ACTION_REQUIRED`** (crear token scoped a `infospot-media` y pegarlo en Info Spot Production)

No incluye secretos ni fragmentos.

---

## 1. Cuenta Cloudflare de referencia (Info Spot)

- Account ID (misma cuenta que DNX-MCP / buckets listados): presente en metadata Info Spot Production.  
- Buckets en esa cuenta: `compramelafoto-prod`, `compramelafoto-staging`, **`infospot-media`**.  
- MCP: API token activo para gestión de buckets; **`objectCredentialsConfigured: false`** (sin Access/Secret S3 en MCP).  
- Crear User Tokens vía API → **403** (ya documentado en 46).

---

## 2. Proyectos Vercel auditados

Equipo: `compramelafotos-projects` (5 proyectos).

| Proyecto | Entorno | Access key | Secret | Account ID | Bucket | Endpoint | Candidato |
|----------|---------|------------|--------|------------|--------|----------|-----------|
| `infospot-dnxsuite` | Production | Sí | Sí | Sí | oculto (encrypted) | Sí | Parcial* |
| `compramelafoto` | Production | Sí | Sí | Sí | oculto (encrypted) | Sí | Parcial* |
| `compramelafoto` | Preview | Sí | Sí | Sí | oculto | Sí | Parcial* |
| `compramelafoto` | Development | Sí | Sí | Sí | oculto | Sí | Parcial* |
| `compramelafoto-dnxsuite` | Preview | No | No | Sí | `compramelafoto-staging` | Sí | No (sin keys) |
| `fotorank-dnxsuite` | — | No R2_* | — | — | — | — | No |
| `fotoffice-dnxsuite` | — | No R2_* | — | — | — | — | No |

\*Candidato solo si el secreto fuera **exportable** y el scope cubriera `infospot-media`.

---

## 3. Clasificación de cuenta

| Origen | Clasificación | Notas |
|--------|---------------|--------|
| Info Spot Production metadata | SAME_ACCOUNT (referencia) | Account alineado con Cloudflare listada |
| `compramelafoto` / staging dnxsuite | SAME_ACCOUNT_DIFFERENT_BUCKET (probable) | Misma org CF; buckets `compramelafoto-*` |
| MCP `.env.local` | SAME_ACCOUNT (API) / sin S3 keys | Solo `CLOUDFLARE_ACCOUNT_ID`; sin `R2_ACCESS_*` |
| Local `.env.local` apps | UNKNOWN / vacío | Sin keys R2 en disco |

---

## 4. Exportabilidad de secretos (mecanismo oficial)

Probado:

- `vercel env pull --environment production` en apps linkeadas (`infospot`, `compramelafoto-dnxsuite`, `fotorank`)  
- Variables `type=sensitive` → **cadena vacía** en el archivo pull (comportamiento Vercel)

| Proyecto | Access | Secret | Resultado |
|----------|--------|--------|-----------|
| `infospot-dnxsuite` | NOT_EXPORTABLE | NOT_EXPORTABLE | `SECRET_NOT_EXPORTABLE` |
| `compramelafoto-dnxsuite` | NOT_EXPORTABLE / ausente | NOT_EXPORTABLE / ausente | No usable |
| `compramelafoto` (legacy, link a dnxsuite) | NOT_EXPORTABLE | NOT_EXPORTABLE | `SECRET_NOT_EXPORTABLE` |

**No** se inspeccionaron builds, logs ni artefactos.  
**No** se recuperaron secretos por canales no oficiales.

---

## 5. Validación de token / acceso a `infospot-media`

**No ejecutada** — sin secreto recuperable no hay candidato `VALID_TOKEN` para probar.

- Smoke upload/read/delete: omitido  
- Nuevo bucket: **no** creado (no resuelve la falta de Access/Secret; API token create = 403)

---

## 6. Decisión

| Opción | Resultado |
|--------|-----------|
| Copiar keys de otro proyecto Vercel | **Bloqueado** — secretos no exportables |
| Reutilizar token con acceso a `infospot-media` | **No viable** sin secreto |
| Crear `infospot-production-media` | **Descartado** — no hay token S3 recuperable |
| Acción manual Cloudflare | **Requerida** |

**Estado formal:** `BLOCKED_SECRET_NOT_EXPORTABLE`  
**Desbloqueo:** `MANUAL_CLOUDFLARE_ACTION_REQUIRED` — ver [`46-r2-production-readiness.md`](./46-r2-production-readiness.md) §3.

Tras regrabar keys en Info Spot Production con `updatedAt` fresco → re-lanzar etapa de smoke (22E/22C).

---

## 7. Confirmaciones

- Google Cloud no configurado.  
- `infospot.com.ar` no lanzado.  
- Ningún secreto escrito en repo, docs ni chat.  
- Ningún archivo temporal con secretos retenido.
