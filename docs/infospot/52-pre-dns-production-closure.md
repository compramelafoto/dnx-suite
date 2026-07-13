# 52 — Pre-DNS production closure (Etapa 22J)

**Fecha:** 2026-07-13  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Alias:** `https://infospot-dnxsuite.vercel.app`  
**Production commit (app):** `fa55a2d` · health `db:ok` (sin redeploy en 22J)  
**Neon:** `infospot-production` / `ep-bitter-salad…`  
**Launch Readiness:** **~96%**  
**Dominio `infospot.com.ar`:** **NO-GO** (DNS pendiente)  
**Director:** **PENDIENTE de primer login** (script listo)

No incluye emails, URLs de DB, ni secretos.

Checklist día D: [`51-go-live-master-checklist.md`](./51-go-live-master-checklist.md).

---

## 1. Tabla inicial → acción

| Área | Estado inicial | Acción 22J |
|------|----------------|------------|
| Migraciones | 3 pendientes | **Aplicadas** (`migrate deploy`) |
| Director | 0 users / 0 roles | Script `db:grant-infospot-director` · **espera login OAuth** |
| Login | OAuth en alias OK | Validar tras grant |
| Noticias | 0 | Plan editorial · sin publicar |
| Eventos | 40 DRAFT (todos finalizados) | Auditados · **0 candidatos futuros** |
| Hero | Plataforma (sin placements) | Home 200 OK vacío |
| Placements | 0 | Preparar el día D tras PUBLISHED |
| Convocatorias | 0 calls | No hay convocatoria abierta |

---

## 2. Migraciones

### Clasificación

| Migración | Clasificación | Notas |
|-----------|---------------|-------|
| `20260713120000_add_clf_order_checkout_origin_gap` | **SAFE_ADDITIVE** | Enums + `ALTER … IF NOT EXISTS` en `Order`/`OrderItem` + índices. 0 filas Order. |
| `20260713121000_add_clf_photo_exif_cleanup_gap` | **SAFE_ADDITIVE** | Enums + columnas EXIF/cleanup en `Photo` + índices. 0 filas Photo. |
| `20260713180000_add_platform_metrics` | **SAFE_WITH_BACKFILL** | `CREATE TABLE IF NOT EXISTS` + `INSERT … COUNT(Photo)` idempotente → 0. |

Pertenecen al **schema Prisma compartido** del monorepo. Info Spot Production usa esa misma DB/schema: **sí correspondía aplicarlas** aquí para alinear cliente Prisma (no son “solo CLF remoto”). No contienen DROP/DELETE/TRUNCATE.

### Backup / precondiciones

| Ítem | Valor |
|------|--------|
| Neon PITR / history | `history_retention_seconds = 86400` (24 h) |
| Timestamp previo | `2026-07-13T18:01:32Z` |
| Conteos previos | users 0 · articles 0 · events 40 · coverages 0 · origins 40 · editorial photos 0 · placements 0 · orders 0 · photos 0 |
| Migraciones parciales | Ninguna (`finished_at` null = 0) |
| Host | `bitter-salad` (Info Spot Production) — no staging / no CLF |

### Resultado deploy

| Migración | finished_at (UTC) | steps |
|-----------|-------------------|-------|
| order checkout origin gap | 2026-07-13 18:01:38 | 1 |
| photo exif cleanup gap | 2026-07-13 18:01:39 | 1 |
| platform_metrics | 2026-07-13 18:01:40 | 1 |

Post: `migrate status` → **Database schema is up to date** · `prisma validate` OK · `PlatformMetrics.id=1` con `photosUploadedTotal=0`.  
Conteos Info Spot **sin cambio**.

---

## 3. Smoke post-migración

| Check | Resultado |
|-------|-----------|
| Health | `db:ok` · version `fa55a2d` |
| `/` `/noticias` `/eventos` `/ingresar` | 200 |
| `/redaccion` | 307 (login) |
| Crons sin secret | 401 |
| R2 cleanup sin sesión | 401 |
| Home vacía | 200 · hero plataforma · sin DEMO/smoke · sin imgs rotas |

Redeploy: **no** (solo DB + docs + script CLI).

---

## 4. Director

### Estado

- `User` count = **0** → no se asignó rol.  
- No se inventó email ni se creó usuario arbitrario.

### Procedimiento autorizado

1. Iniciar sesión Google en `https://infospot-dnxsuite.vercel.app/ingresar` (crea `User`).  
2. Ejecutar (email por env, nunca en Git):

```bash
INFOSPOT_DIRECTOR_EMAIL="<email-autorizado>" \
DATABASE_URL="<prod pooled>" DIRECT_URL="<prod direct>" \
pnpm --filter @repo/db db:grant-infospot-director
# alias:
# pnpm --filter infospot admin:grant-director
```

3. El script es idempotente: upsert `INFOSPOT_DIRECTOR` + `ACTIVE` + `DIRECT_PUBLISH` + categorías/settings si faltan.  
4. Log JSON: `userId`, email enmascarado, rol previo/nuevo, `activeDirectorsBefore` — **sin** secretos.

También se endureció `db:seed:infospot` para **exigir** `INFOSPOT_DIRECTOR_EMAIL` (sin default hardcodeado).

### Validación de permisos

Pendiente hasta existir Director. Tras grant, verificar:

- `/redaccion`, asistente, eventos, coberturas, distribución  
- publicar / despublicar / archivar  
- cleanup R2 (solo Dirección)  
- visitante sigue 307/401 en privadas

---

## 5. Auditoría de 40 eventos DRAFT

| Clasificación | Conteo |
|---------------|--------|
| Total DRAFT | 40 |
| Futuros válidos | **0** |
| Finalizados | **40** |
| Sin geo | 2 |
| Sin portada | 34 |
| Sin descripción | 0 |
| Ubicación privada | 0 |
| Convocatoria abierta | **0** (ningún `photographerCall`) |
| DEMO/smoke | 0 |
| Origen CLF / content origin | 40 |
| Títulos duplicados | 0 |
| Candidatos lanzamiento (futuro+geo+desc) | **0** |

**Conclusión:** no hay eventos futuros publicables “tal cual”. No se auto-publicó ninguno. El día D el Director debe:

- crear/agendar eventos futuros reales, **o**  
- curar noticias/coberturas nuevas, **o**  
- (opcional) decidir si algún pasado merece nota retrospectiva — nunca como “próximo evento”.

---

## 6. Plan de contenido inicial (sin publicar)

| Pieza | Objetivo | Estado 22J |
|-------|----------|------------|
| Eventos futuros | 3–6 | **Faltan** — 0 candidatos |
| Noticias | 3–5 reales | **Faltan** — 0 artículos |
| Cobertura + fotos | ≥1 autorizada | **Falta** — 0 coverages / 0 fotos |
| Convocatoria | ≥1 si CLF abierta | **No aplica** ahora |
| Home HERO placement | 1 activo día D | 0 placements · requiere PUBLISHED |
| SEO por pieza | title/desc/slug/alt/crédito/OG | Preparar al redactar |

No se ejecutaron seeds DEMO / launch-drafts.

### Home vacía (pre-publish)

Confirmado: 200, hero de plataforma, sin bloques rotos ni DEMO.

### Placements

Modelo exige contenido publicable para HERO activo → acción **día D** tras primeras publicaciones (dejar inactivo no aplica sin targets).

---

## 7. Seguridad

| Check | Estado |
|-------|--------|
| Roles accidentales | Ninguno (0 roles) |
| Usuarios DEMO | 0 |
| Smoke visible | No |
| Crons | 401 unauth |
| R2 cleanup | 401 unauth |
| Secretos en cliente | No observados |
| Script grant | Requiere env; no hardcodea email |

---

## 8. Pendientes DNS (inalterados)

1. Resolución DNS DonWeb  
2. SSL Vercel  
3. Canónicos / `publicUrl`  
4. OAuth redirect `infospot.com.ar`  
5. Redeploy post-env  
6. Publicar piezas aprobadas  
7. Activar HERO  
8. Smoke público dominio  
9. Search Console  
10. Declarar GO  

---

## 9. GO / NO-GO

| Pregunta | Respuesta |
|----------|-----------|
| ¿Schema Production al día? | **SÍ** |
| ¿Listo para asociar dominio técnicamente (DB/R2/crons)? | **SÍ** (tras Director + contenido mínimo recomendado) |
| ¿GO anuncio público ahora? | **NO** |
| ¿Director operativo? | **NO** — falta login + grant |
| ¿Contenido día 1 listo? | **NO** — plan documentado; 0 futuros |
| ¿Production app redeployed 22J? | **NO** (correcto) |

**Readiness ~96%** (+1 pp por migraciones). Resta Director + contenido editorial + DNS cutover → 100%.

---

## 10. Commits de etapa

- Script grant + package scripts + seed sin email default.  
- Docs 42/43/45/51/52.
