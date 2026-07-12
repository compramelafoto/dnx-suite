# Info Spot — Gate final de staging (Etapa 13)

**Fecha:** 2026-07-12  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Decisión:** **NO-GO** a producción hasta cerrar bloqueantes listados abajo.  
**Producción:** no migrada; sin merge; sin deploy a dominios productivos en esta etapa.

---

## 1. Entornos auditados (sin secretos)

| Pieza | Hallazgo |
|-------|----------|
| Info Spot `DATABASE_URL` | Neon `ep-dawn-dew-…` (staging IS) |
| `CLF_READONLY_DATABASE_URL` | Neon `ep-falling-darkness-…` (DB operativa CLF, ≠ IS) |
| `CLF_WRITE_DATABASE_URL` | No configurada de forma segura para un sandbox aislado |
| `COMPRAMELAFOTO_PUBLIC_URL` | `compramelafoto.com` (**producción**) |
| Staging CLF app | `https://compramelafoto.dnxsuite.com` (HTTP 200; `/api/health` 404) |
| Info Spot staging | `https://infospot-dnxsuite.vercel.app` health OK |
| R2 local | Ausente en `.env.local` del gate |
| Licencia | `INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT` no seteada (correcto para no-prod) |

**Seguridad:** no se escribió en la DB CLF con ~648 usuarios ni se usaron eventos reales (“Leoncito…”) para join/leave.

**Drift de schema:** la tabla `Event` en la DB de Info Spot staging tiene 25 columnas y **no** incluye `status`; la DB CLF readonly tiene 38 columnas con `status`. No usar la DB IS como destino de write CLF.

---

## 2. Qué se cerró en Etapa 13

| Ítem | Estado |
|------|--------|
| Matriz OPEN / REQUEST / INVITE_ONLY / CLOSED / cupos (reglas) | Cerrado — `smoke:e13-gate` 21/21 |
| Elegibilidad “Buscan fotógrafos” (cupo/CLOSED/REQUEST) | Cerrado |
| Licencia editorial (bloquea AUTHORIZED sin CONTRACT) | Cerrado |
| Sync inbound dry-run (`reconcilePublicClfEvents`) | Cerrado (scanned=5, failed=0) |
| Rutas cron staging-safe + auth `CRON_SECRET` | Cerrado (código; **no** programadas en prod) |
| Safari WebKit 390×844 home local + staging Vercel | Cerrado parcial (sin overflow, sin pageerrors) |
| Separación IS vs CLF hosts | Cerrado |

### Jobs día uno (clasificación)

| Proceso | Clasificación | Cómo |
|---------|---------------|------|
| Sync inbound eventos CLF | **Obligatorio día uno** | CLI `sync:clf-events` o cron `/api/cron/clf-events-sync` con `CRON_SECRET` |
| Reconcile comercial fotos | **Obligatorio día uno** | CLI `reconcile:public-coverage` o `/api/cron/reconcile-public-coverage` |
| Provisioning outbound | **Manual aceptable** | Acción redacción / CLI `provision:clf-event` |
| Sync álbumes/coberturas | **Obligatorio** (manual al inicio) | Acción sync cobertura; cron posterior |
| Derivados editoriales | **Bloqueante si request HTTP se agota** | Hoy síncrono; worker async pendiente |
| Métricas | Posterior / OK | Ya vía API |
| Cleanup jobs fallidos | Posterior | Runbook |

**No se activaron crons en Vercel production.**

---

## 3. Bloqueantes restantes (impeditivos)

1. **Join/leave HTTP real en staging CLF**  
   Requiere: DB CLF staging con schema completo + write, URL pública **no** `compramelafoto.com` (usar `compramelafoto.dnxsuite.com` o localhost), usuarios fotógrafo de prueba y sesión real.

2. **R2/storage staging** con assets reales (preview → derivados 640/960/1280/1920, WebP/JPEG, sin original en cliente).

3. **Safari/iOS real** (iPhone) para mapa Leaflet drag, galería swipe, lightbox; WebKit headless solo cubrió home.

4. **Worker async de derivados** si el selector editorial en staging con fotos grandes degrada el request (pendiente medición con R2 real).

5. **`INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT=1`** solo al autorizar contrato — **no** configurar en prod todavía.

---

## 4. Condiciones exactas para producción

1. Backup DB Info Spot + plan rollback.  
2. `prisma migrate deploy` en ventana controlada (sin `db push` / `migrate reset`).  
3. Variables: `DATABASE_URL`, `DIRECT_URL`, `CLF_READONLY_DATABASE_URL`, write path seguro, `NEXT_PUBLIC_INFOSPOT_URL`, `COMPRAMELAFOTO_PUBLIC_URL` (prod), R2_*, `CRON_SECRET`, licencia.  
4. Dominio Info Spot + health.  
5. Jobs: al menos sync eventos + reconcile comercial (cron o runbook CLI el día 1).  
6. Smoke post-deploy: home, evento, noticia, `/api/health`, un join CLF de prueba en **staging** previo.  
7. Sin datos smoke residuales.

---

## 5. Artefactos

- Gate: `pnpm --filter infospot smoke:e13-gate`
- Crons: `app/api/cron/clf-events-sync`, `app/api/cron/reconcile-public-coverage`
- Readiness actualizado: `docs/infospot/30-production-readiness-report.md`
