# 42 — Info Spot production go-live

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**HEAD Production:** `78efb7e`  
**Proyecto Vercel:** `infospot-dnxsuite`  
**Decisión:** **GO operativo** en `https://infospot-dnxsuite.vercel.app` · **NO-GO** dominio propio `infospot.com.ar`  
**Estado:** servicios críticos (Neon, CLF readonly, crons, deploy) listos; faltan keys S3 R2 + Director + DNS DonWeb.

**Actualización 2026-07-13 (Etapa 22C):** reauditoría R2 — `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` siguen sin `updatedAt` fresco (2026-07-11). Smoke no ejecutado. Ver [`47-r2-production-smoke-report.md`](./47-r2-production-smoke-report.md).

Este documento es el runbook de salida a producción y rollback. **No incluye secretos.**

---

## 1. Resumen ejecutivo

| Área | Resultado |
|------|-----------|
| Git / working tree | Limpio; branch tracking `origin` |
| Build preview HEAD | READY (`dpl_AcMUk…`, commit `d4f6894`) |
| Promote a Production | READY (`dpl_9ryaLBGCrwkpDosHVyZVWnZ8NmbE`) |
| Migraciones Prisma | 3 pendientes aplicadas en DB actual de Production env |
| Health prod alias | `status=ok`, `db=ok`, `version=d4f6894` |
| Smoke público (vercel.app) | Home / noticias / eventos / robots / sitemap OK |
| DNS `infospot.com.ar` | **No resuelve** (A/NS vacíos en 1.1.1.1) |
| Variables críticas | Varias **listadas pero vacías** en Production |
| R2 Info Spot | **Sin bucket propio**; credenciales prod vacías |
| Cron | **503** — `CRON_SECRET not configured` |
| Platform Catalog DNX-MCP | Info Spot **no registrado** (`release_*` no aplica) |

**Recomendación:** no anunciar dominio propio ni activar crons/comercial hasta cerrar bloqueantes de la §12.

---

## 2. Infraestructura

| Pieza | Valor |
|-------|--------|
| Hosting | Vercel monorepo (`apps/infospot`, `vercel.json`) |
| Production deployment | `dpl_9ryaLBGCrwkpDosHVyZVWnZ8NmbE` |
| Alias estable | `https://infospot-dnxsuite.vercel.app` |
| Dominios verificados en Vercel | `infospot.com.ar`, `www.infospot.com.ar` |
| DNS público | **Falla** — registrar/apuntar NS o records A/CNAME a Vercel |
| Postgres (env Production) | Neon host `ep-dawn-dew-…` (**mismo endpoint que staging histórico**) |
| R2 Cloudflare | Buckets visibles: `compramelafoto-prod`, `compramelafoto-staging` — **no** hay bucket `infospot-*` |
| CLF lectura | Variable presente en panel; valor **vacío** en pull Production |

---

## 3. Variables (presencia, sin valores)

### Presentes con valor no vacío (Production pull)

- `DATABASE_URL`, `DIRECT_URL`
- `NEXT_PUBLIC_INFOSPOT_URL`, `APP_URL`, `AUTH_URL` → aún apuntan a `*.vercel.app`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`

### Presentes en panel Vercel pero valor vacío (bloqueante)

- `CLF_READONLY_DATABASE_URL`
- `COMPRAMELAFOTO_PUBLIC_URL`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`
- `INFOSPOT_IP_HASH_SALT`

### Ausentes

- `CRON_SECRET` (crons responden 503)
- `COOKIE_DOMAIN` (opcional hasta dominio propio)
- MercadoPago / SMTP / Analytics IDs (no bloquean home; no verificados como requeridos día 1)
- `INFOSPOT_CLF_EDITORIAL_LICENSE_CONTRACT` (correcto **no** setear en prod salvo contrato)

### Acción requerida (manual)

1. Completar valores no vacíos de R2 + CLF readonly + `COMPRAMELAFOTO_PUBLIC_URL` + `INFOSPOT_IP_HASH_SALT`.
2. Generar y setear `CRON_SECRET` (Production) antes de programar Vercel Cron.
3. Cuando DNS esté vivo: actualizar `NEXT_PUBLIC_INFOSPOT_URL` / `APP_URL` / `AUTH_URL` / `GOOGLE_REDIRECT_URI` a `https://infospot.com.ar` (sin slash final) y registrar callback Google.
4. Preferible: **base Postgres de producción dedicada** (no reutilizar `ep-dawn-dew` de staging).

---

## 4. Migraciones

### Comando usado

```bash
# Con DATABASE_URL/DIRECT_URL de Production (nunca imprimir)
pnpm --filter @repo/db exec prisma migrate deploy
```

**Prohibido:** `db push`, `migrate reset`, seeds demo en prod.

### Aplicadas en esta sesión

1. `20260713010000_event_status_and_commercial_columns`
2. `20260713020000_event_member_terms_columns`
3. `20260713030000_infospot_editorial_workflow_simplified`

### Post-estado

`prisma migrate status` → **Database schema is up to date.**

### Nota de riesgo

El historial de `_prisma_migrations` en esa DB incluye migraciones antiguas **no** presentes en el repo local (p. ej. teacher/members). Prisma igual aplicó las pendientes. Documentar divergencia; no “arreglar” con reset.

### Backup recomendado

Antes de próximos `migrate deploy` en una DB realmente productiva: snapshot Neon / `pg_dump` lógico.

---

## 5. Deploy

### Pasos ejecutados

1. Auditoría Git: branch limpia, HEAD `d4f6894` = origin.
2. Preview build READY del mismo SHA.
3. `vercel promote dpl_AcMUkPMDg8bfXeenXgFgG2ZZbdvi` → production `dpl_9ryaLBG…` Ready.
4. Aliases Vercel incluyen `infospot.com.ar` / `www` / `infospot-dnxsuite.vercel.app`.

### Validación local previa (rama)

- Lint / typecheck / build Infospot: OK en etapa editorial previa.
- Suites: assistant, workflow, photos, coverage, distribution, public-coverage: OK.

### DNX release orchestrator

`release_prepare(platformId=infospot)` → plataforma no encontrada.  
`vercel_prepare_production_release` → falla por bug de tipo env `sensitive`.  
Go-live operativo vía CLI Vercel.

---

## 6. Smoke Test

Base verificada: `https://infospot-dnxsuite.vercel.app` (dominio propio no resoluble).

| Ruta | HTTP | Nota |
|------|------|------|
| `/api/health` | 200 | `version=d4f6894`, db ok |
| `/` | 200 | Home |
| `/noticias` | 200 | |
| `/eventos` | 200 | |
| `/publicar-evento` | 200 | |
| `/redaccion` | 200 | Login (esperado sin sesión) |
| `/robots.txt` | 200 | Host/Sitemap aún vercel.app |
| `/sitemap.xml` | 200 | URLs vercel.app |
| `/apple-icon.png` | 200 | |
| `/brand/infospot-favicon.png` | 200 | |
| `/manifest.webmanifest` | 404 | Gap menor |
| `/404-does-not-exist` | 404 | Página Info Spot |
| Editor / Asistente / Biblioteca (auth) | No re-corridos E2E autenticados en esta sesión | Cubiertos por etapas 37–41 + tests |
| Join CLF / CTA compra / álbumes | **Bloqueados** por CLF URL + R2 vacíos | |
| Geo / distribución UI | No re-smoke autenticado | Lógica intacta; no modificada |

---

## 7. SEO

| Ítem | Estado |
|------|--------|
| robots.txt | OK; Disallow admin/redacción/api |
| sitemap.xml | OK; canonical host = vercel.app hasta cambiar env |
| canonical / OG / Twitter | Presentes en home |
| JSON-LD | `NewsMediaOrganization` (+ PostalAddress) en home |
| Favicon / apple-icon | OK |
| Web manifest | 404 |
| Search Console | Pendiente humano (propiedad + sitemap dominio final) |

---

## 8. Analytics

- Eventos de producto (`ARTICLE_VIEW`, `EVENT_VIEW`, CTA, convocatorias) dependen de instrumentación existente; **no** hay IDs de Analytics/GTM en env Production.
- Día 1: no bloqueante para GO técnico en vercel.app; sí pendiente para medición de lanzamiento público.

---

## 9. Cron

Rutas:

- `GET /api/cron/clf-events-sync`
- `GET /api/cron/reconcile-public-coverage`

Auth: `Authorization: Bearer $CRON_SECRET` (o header equivalente).

Estado actual: **503** `CRON_SECRET not configured`.

**Activar solo cuando:**

1. `CRON_SECRET` seteado en Production.
2. CLF readonly + R2 no vacíos.
3. Jobs en Vercel Cron (o scheduler externo) apuntando solo a esas dos rutas — sin jobs experimentales.

Frecuencia sugerida (post-GO): inbound CLF 5–15 min; reconcile cobertura 15–30 min.

---

## 10. Seguridad

| Control | Estado |
|---------|--------|
| HTTPS / HSTS | `strict-transport-security` presente |
| `/redaccion` sin sesión | 200 login (no dump de datos) |
| Cron sin secreto | 503 (no ejecuta) |
| Open redirect | No auditado exhaustivamente en esta sesión; sin cambios de código |
| Storage R2 | Credenciales vacías → uploads/derivados no operativos |
| Permisos / rutas privadas | Sin cambios; tests workflow OK |

---

## 11. Performance

- Health latency observada ~3–225 ms.
- Home 200 sin error de health.
- **No** se midió Lighthouse LCP/CLS/FCP en esta sesión (DNS dominio propio caído; tooling limitado).
- Recomendación post-DNS: PageSpeed + Web Vitals reales mobile/desktop.

---

## 12. Bloqueantes para GO público

1. **DNS** de `infospot.com.ar` / `www` no publica A/CNAME/NS.
2. **Env Production vacías:** R2*, CLF readonly, `COMPRAMELAFOTO_PUBLIC_URL`, `INFOSPOT_IP_HASH_SALT`.
3. **`CRON_SECRET` ausente.**
4. **URL canónica** aún `*.vercel.app` (SEO/OAuth).
5. **DB Production = staging histórico** (`ep-dawn-dew`) — riesgo operativo/datos.
6. **Sin bucket R2 Info Spot** dedicado.
7. **Info Spot fuera del Platform Catalog** DNX-MCP.

---

## 13. Rollback

### A) Falla de deploy (app)

```bash
cd apps/infospot
# Listar deployments production Ready anteriores
vercel ls --prod
# Promover deployment sano previo (ej. el de hace ~22h si HEAD falla)
vercel promote <deploymentId_previo_sano> --yes --timeout 10m
curl -sS https://infospot-dnxsuite.vercel.app/api/health
```

Alternativa MCP (cuando catalog exista): `vercel_rollback_release` / `release_rollback` con `confirm:true`.

### B) Falla de migración

- Prisma es **forward-only**. No `migrate reset`.
- Si una migración rompe runtime: rollback de **deploy** al SHA anterior compatible con el schema nuevo, o hotfix forward.
- Restaurar snapshot Neon solo si el daño de datos lo exige (intervención DBA).

### C) Falla de storage (R2)

- Desactivar uploads en UI/ops; servir assets ya públicos si existen.
- Corregir credenciales / bucket; redeploy no suele ser necesario si solo env.

### D) Falla CLF (sync / join)

- No programar cron hasta `CLF_READONLY_DATABASE_URL` + `COMPRAMELAFOTO_PUBLIC_URL` correctos.
- Join usa CLF write en el lado CLF — no abrir write desde Info Spot en prod (`ALLOW_CLF_WRITE_FROM_INFOSPOT` no debe estar en prod).

### E) Falla OAuth Google

- Verificar `GOOGLE_REDIRECT_URI` y consola Google Cloud.
- Mientras tanto login email/password (si habilitado) o pausar onboarding Google.

---

## 14. Checklist final

| Ítem | Estado |
|------|--------|
| Build | ✅ Preview + Production Ready |
| Deploy | ✅ Promote `d4f6894` |
| Migraciones | ✅ 3 aplicadas; schema up to date |
| Home | ✅ (vercel.app) |
| Noticias | ✅ |
| Eventos | ✅ |
| Editor | ⚪ auth E2E no re-corrido aquí |
| Asistente | ⚪ idem |
| Biblioteca | ⚪ depende R2/material |
| Coberturas | ⚪ |
| Fotografías | ❌ R2 vacío |
| Convocatorias | ⚪ |
| CLF | ❌ URL/DB readonly vacías |
| CTA Compra | ❌ depende CLF público |
| Distribución | ⚪ |
| Georreferenciación | ⚪ |
| SEO | ✅ parcial (host vercel.app) |
| Analytics | ❌ no configurado |
| Cron | ❌ sin `CRON_SECRET` |
| Responsive | ⚪ no re-medido E12 en esta sesión |
| Consola limpia | ⚪ no browser automation aquí |
| Performance | ⚪ parcial (health only) |
| Seguridad | ✅ básico (HSTS, cron cerrado) |
| DNS dominio propio | ❌ |

---

## 15. Incidentes de esta sesión

1. `release_prepare("infospot")` — plataforma inexistente en catalog.
2. `vercel_prepare_*` — error de schema env `type=sensitive`.
3. `vercel_deploy_release` MCP — endpoint 404; promote vía CLI OK.
4. Variables Production **vacías** pese a aparecer en `vercel env ls`.
5. DNS dominio propio sin resolución pública.
6. Historial Prisma divergente (migraciones huérfanas en DB) — deploy de pendientes igual OK.

### Correcciones realizadas

- `prisma migrate deploy` de las 3 migraciones pendientes.
- Promote production a HEAD `d4f6894`.
- Documentación de go-live / rollback (este archivo).
- **Sin** cambios de features, schema Prisma, UX ni workflow.

---

## 16. Próximos pasos (orden sugerido)

1. Arreglar DNS → Vercel.
2. Completar secrets Production (R2 Infospot + CLF + salt + cron).
3. Apuntar URLs canónicas al dominio final + OAuth callback.
4. (Ideal) provisionar Neon prod dedicado y migrar con backup.
5. Activar solo 2 crons necesarios.
6. Smoke autenticado: editor, asistente, material, coberturas, join CLF, CTA.
7. Registrar plataforma `infospot` en DNX Platform Catalog.
8. Re-evaluar **GO** con checklist §14 en verde.

---

## 17. Confirmación

- **Info Spot está desplegado en el target Production de Vercel** con commit `d4f6894` y health OK en `infospot-dnxsuite.vercel.app`.
- **No** está listo para considerarse “operativo en producción pública” bajo `infospot.com.ar` hasta cerrar DNS + secrets + canónicos + cron.
- **Producción de otros productos / merge a main / db push / migrate reset:** no ejecutados.
