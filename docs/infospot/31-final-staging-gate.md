# Info Spot — Gate final de staging (Etapa 13)

**Fecha:** 2026-07-12  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Decisión:** **NO-GO** a producción (bloqueantes operativos restantes).  
**Producción:** no migrada; sin merge; sin deploy a dominios productivos; sin crons en Vercel production.

---

## 1. Entornos (sin secretos)

| Pieza | Host / valor | Uso E13 |
|-------|--------------|---------|
| Info Spot `DATABASE_URL` | Neon `ep-dawn-dew-…` | Staging IS |
| `CLF_READONLY_DATABASE_URL` (local IS) | Neon `ep-falling-darkness-…` | Solo lectura operativa; **no write** |
| CLF staging write sandbox | Neon `ep-round-fog-…` | Join/leave real E13 |
| App CLF local gate | `http://127.0.0.1:3013` | HTTP join/leave |
| App CLF dnxsuite | `https://compramelafoto.dnxsuite.com` | 200; `/e/*` vivo; **DB preview distinta** (`empty-moon`) → 404 para eventos round-fog |
| Info Spot staging | `https://infospot-dnxsuite.vercel.app` | Health OK; WebKit home OK (hydration #418 en deploy) |
| `COMPRAMELAFOTO_PUBLIC_URL` (env IS local) | `compramelafoto.com` | **Producción** — no usar para join |
| R2 local gate | Ausente | Blocker operativo storage |
| Licencia | Términos CLF ≥ 2026-07-21 → AUTHORIZED por defecto; kill switch `CONTRACT=0` | Contrato en términos |

---

## 2. Cerrado en Etapa 13

| Ítem | Evidencia |
|------|-----------|
| Join HTTP real (OPEN) | `e13-clf-http-smoke.ts` 8/8 — `joined_active` + `EventMember` ACTIVE PHOTOGRAPHER |
| Leave HTTP real | DELETE leave → `active=0` |
| Idempotencia join | `already_active` |
| Cupos (`maxPhotographers=1`) | 2.º fotógrafo → 400 mensaje claro |
| Página pública `/e/{shareSlug}` | HTTP 200, título/ciudad/términos/CTA |
| Matriz Prisma OPEN/REQUEST/INVITE/CLOSED | `e13-clf-join-leave.ts` 12/12 |
| Matriz reglas IS + licencia + sync dry-run | `smoke:e13-gate` (policies + scanned=5 failed=0) |
| Cron routes staging-safe | `/api/cron/clf-events-sync`, `/api/cron/reconcile-public-coverage` + `CRON_SECRET` |
| WebKit (Safari engine) 390×844 | Home staging + local: sin overflow, sin `<a>` anidados |
| Cleanup smoke | `cleanup` → 0 leftovers en round-fog |

### Scripts

```bash
# DB-only (round-fog)
E13_CLF_DATABASE_URL=… pnpm --filter @repo/db exec tsx ./scripts/e13-clf-join-leave.ts
E13_CLF_DATABASE_URL=… pnpm --filter @repo/db exec tsx ./scripts/e13-clf-join-leave.ts cleanup

# HTTP (app local + round-fog)
E13_CLF_DATABASE_URL=… E13_CLF_PUBLIC_URL=http://127.0.0.1:3013 \
  pnpm --filter @repo/db exec tsx ./scripts/e13-clf-http-smoke.ts

# Offline IS policies
pnpm --filter infospot smoke:e13-gate
```

Abortan si el host es `falling-darkness` o la URL pública es `compramelafoto.com`.

---

## 3. Jobs día uno

| Proceso | Clasificación | Staging |
|---------|---------------|---------|
| Sync inbound eventos CLF | **Obligatorio** | CLI `sync:clf-events` o cron con `CRON_SECRET` (**no** en vercel prod) |
| Reconcile comercial / cache cobertura | **Obligatorio** | CLI `reconcile:public-coverage` o cron |
| Sync álbumes/coberturas | **Obligatorio** (manual al inicio) | Acción redacción |
| Provisioning outbound | **Manual aceptable** | CLI / UI |
| Derivados Sharp+R2 | **Manual/síncrono**; worker async si fotos grandes agotan request | Sin cola IS hoy |
| Métricas | OK / posterior | API existente |
| Cleanup fallidos | Posterior | Runbook |

Frecuencias sugeridas staging (no prod): inbound 5–15 min; álbumes 10–15; comercial 15–30. **No programadas en producción.**

---

## 4. Bloqueantes restantes (impeditivos para prod)

1. **Alinear staging CLF público** (`compramelafoto.dnxsuite.com` / preview) con la misma DB sandbox (`round-fog`) o documentar URL preview correcta — hoy el host público usa otro endpoint (`empty-moon`) y no sirve para smoke remoto de eventos E13.
2. **R2 staging Info Spot** con derivados reales (640/960/1280/1920 WebP+JPEG, sin original en cliente).
3. **Safari/iPhone físico** — mapa Leaflet drag, swipe galería, lightbox (WebKit headless solo home).
4. **Hydration #418** en deploy Vercel Info Spot (local limpio post-E12; redeploy rama).
5. **Licencia editorial:** contrato en términos CLF (§5 Info Spot). Kill switch `INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT=0` si hace falta desactivar.
6. Medición derivados síncronos con fotos grandes + R2 real (posible blocker UX editor).

---

## 5. Condiciones exactas para autorizar producción

1. Backup DB Info Spot + plan rollback escrito.  
2. `prisma migrate deploy` en ventana (sin `db push` / `migrate reset`).  
3. Variables: `DATABASE_URL`, `DIRECT_URL`, `CLF_READONLY_DATABASE_URL`, write path seguro, `NEXT_PUBLIC_INFOSPOT_URL`, `COMPRAMELAFOTO_PUBLIC_URL`, R2_*, `CRON_SECRET`, licencia.  
4. Dominio Info Spot + `/api/health`.  
5. Jobs día uno: sync eventos + reconcile comercial (cron staging o runbook CLI).  
6. Smoke post-deploy: home, evento, noticia, health, un join CLF de prueba en staging alineado.  
7. Sin datos smoke; sin crons accidentales en prod.

---

## 6. Confirmaciones

- Producción **no** migrada.  
- No se escribió en DB CLF operativa `falling-darkness`.  
- No se usaron eventos/álbumes/fotos de usuarios reales.  
- Datos E13 eliminados de `round-fog`.  
- Fixes/scripts pusheados solo a `migration-legacy-clf-to-monorepo`.
