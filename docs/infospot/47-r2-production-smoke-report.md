# 47 — R2 production smoke report (Etapa 22C)

**Estado de etapa:** **`BLOCKED_BY_VERCEL_ENV`** (Etapa 22D — keys S3 sin `updatedAt` fresco)  
**Antes:** `BLOCKED_BY_MANUAL_R2_TOKEN` (22B/22C)  
**Production alias:** `https://infospot-dnxsuite.vercel.app`  
**Commit servido (runtime):** `78efb7e` · health `db:ok`  

No se ejecutó smoke upload/read/delete ni pipeline de derivados.  
No se hizo redeploy en 22D (las keys no muestran reemplazo).

---

## 0. Etapa 22D — activación de credenciales (2026-07-13)

Auditoría Vercel Production (solo presencia + `updatedAt`, sin valores):

| Variable | Estado | updatedAt (UTC) |
|----------|--------|-----------------|
| `R2_ACCESS_KEY_ID` | PRESENTE | **2026-07-11T23:22:49Z** (vieja) |
| `R2_SECRET_ACCESS_KEY` | PRESENTE | **2026-07-11T23:22:53Z** (vieja) |
| `R2_ACCOUNT_ID` | PRESENTE | 2026-07-13T09:10:24Z |
| `R2_BUCKET_NAME` | PRESENTE | 2026-07-13T09:10:28Z |
| `R2_ENDPOINT` | PRESENTE | 2026-07-13T09:10:32Z |
| `R2_PUBLIC_URL` | PRESENTE | 2026-07-13T09:10:36Z |

**¿Vercel tomó nuevas credenciales S3?** No — ambas keys siguen en la revisión del 11-jul.  
**Redeploy 22D:** No.  
**R2 credentials activated:** No.

Para pasar a COMPLETE en una re-corrida 22D: regrabar las dos keys en Production hasta que `vercel env ls` muestre minutos/segundos (no «1d ago»), luego redeploy.

---

## 1. Auditoría de variables (sin valores)

| Variable | Estado | Evidencia |
|----------|--------|-----------|
| `R2_ACCESS_KEY_ID` | **AUSENTE / no actualizada** | Entrada Production existe pero `updatedAt` = **2026-07-11** («1d ago» en CLI) |
| `R2_SECRET_ACCESS_KEY` | **AUSENTE / no actualizada** | Idem **2026-07-11** |
| `R2_ACCOUNT_ID` | **PRESENTE** | Actualizada 2026-07-13 |
| `R2_BUCKET_NAME` | **PRESENTE** | Actualizada 2026-07-13 (`R2_BUCKET` no definida; el código acepta `R2_BUCKET_NAME`) |
| `R2_ENDPOINT` | **PRESENTE** | Actualizada 2026-07-13 |
| `R2_PUBLIC_URL` | **PRESENTE** | Actualizada 2026-07-13 |

`vercel env pull` / `vercel env run -e production` **no revelan** valores `sensitive` (aparecen vacíos aunque existan). La evidencia de «cargadas de verdad» es el **timestamp de update** + prueba runtime. Las keys S3 no fueron retocadas desde el placeholder del 11-jul.

---

## 2. Fases no ejecutadas (bloqueo)

| Fase | Resultado |
|------|-----------|
| Redeploy por R2 | Omitido (nada nuevo que inyectar) |
| Smoke upload/read/delete | No |
| Errores R2 | No |
| Pipeline derivados | No |
| Selector / previews / OG | No (requiere media + Director) |
| Medición worker | No |
| Cleanup R2 smoke | N/A |

Crons / CLF readonly / health: sin regresión observada (cron sin secret → 401).

---

## 3. Qué hacer para desbloquear 22C

1. Vercel → `infospot-dnxsuite` → Settings → Environment Variables → **Production**.  
2. **Edit** (o remove + add) `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY` con el token Cloudflare scoped a `infospot-media`.  
3. Confirmar en `vercel env ls production` que ambas pasan a «hace unos segundos / minutos» (no «1d ago»).  
4. Redeploy Production.  
5. Re-lanzar Etapa 22C.

Procedimiento Cloudflare: [`46-r2-production-readiness.md`](./46-r2-production-readiness.md).

---

## 4. Confirmaciones

- Google Cloud **no** configurado.  
- `infospot.com.ar` **no** lanzado públicamente.  
- No se imprimieron ni guardaron secretos.  
- No se simuló éxito de media.
