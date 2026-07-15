# 65 — Gate OAuth humano + contenido real de lanzamiento (Etapa 22X)

**Fecha:** 2026-07-15  
**Rama:** `migration-legacy-clf-to-monorepo`  
**Production:** health `db:ok` · `version=ef63026`  
**Estado etapa:**

```text
BLOCKED_BY_CONTENT_SOURCE
```

(OAuth humano: **PENDING_HUMAN**)  
`READY_FOR_DOMAIN_GO_LIVE`: **NO**  
Anuncio público: **NO-GO**

No incluye emails, cookies, tokens, secretos ni URLs de DB.

Relacionados: [51](./51-go-live-master-checklist.md) · [63](./63-oauth-human-and-day-one-content-readiness.md) · [64](./64-domain-oauth-and-minimum-launch-content.md)

---

## 1. Auditoría mínima

| Área | Estado |
|------|--------|
| Dominio | GO técnico (22W) |
| OAuth humano | **PENDING_HUMAN** |
| Acceso a Redacción (sesión) | No validado (sin login humano) |
| Eventos CLF futuros PUBLIC+slug | **0** |
| Fuentes manuales recibidas | **0** |
| Noticias DRAFT | **5** (4 previas + 1 presentación 22X) |
| Contenido PUBLISHED | **0** |
| Schema | up to date |
| Placements | 0 |

Working tree: cambios ajenos (Clickatón / CLF) — **no mezclados**.

---

## 2. OAuth humano

| Paso | Resultado |
|------|-----------|
| Host inicial requerido | `infospot.com.ar` |
| OAuth start | **307** → Google · callback dominio |
| Google / callback / cookie / sesión / rol / `/redaccion` | **PENDING_HUMAN** |

No se simuló el consentimiento. No se modificó Google Cloud.

Instrucción: `https://infospot.com.ar/ingresar` → Continuar con Google → cuenta editorial → confirmar `/redaccion`.

---

## 3. CLF futuro (readonly)

| Clasificación | Cantidad |
|---------------|---------:|
| Elegibles | **0** |
| Sin geo | 0 |
| Sin portada | 0 |
| Sin descripción | 0 |
| Convocatoria abierta | 0 |
| Duplicados | 0 |
| Incompletos | 0 |
| No públicos futuros | **1** |

Sync escritura: **no ejecutado**.

---

## 4. Fuentes / eventos / agenda

| Ítem | Resultado |
|------|-----------|
| Opción A (CLF PUBLIC) | Sin candidatos |
| Opción B (fuentes usuario) | **No aportadas** en esta etapa |
| Eventos importados | 0 |
| Eventos manuales | 0 |
| Agenda | **`INSUFFICIENT_EVENTS_FOR_AGENDA`** |

No se inventó contenido. No se alteró visibilidad CLF.

---

## 5. Noticias

### Presentación (creada 22X)

| Campo | Estado |
|-------|--------|
| Slug | `presentacion-info-spot` |
| Status | **DRAFT** |
| Tag | REAL |
| Fuente | institucional Info Spot (`infospot.com.ar`) |
| SEO | preliminar OK |
| Categoría | cultura |
| Portada / crédito | **pendiente** |
| Observación | revisión editorial antes de publicar |

### Cuatro previas (sin cambio de copy inventado)

| # | Clasificación | Acción |
|---|---------------|--------|
| 1 | `REAL_NEEDS_SOURCE` | Esperar fuente oficial |
| 2 | `OBSOLETE` | No publicar · archivar con autorización |
| 3 | `REAL_NEEDS_SOURCE` | Esperar fuente oficial |
| 4 | `REAL_NEEDS_SOURCE` | Esperar fuente oficial |

---

## 6. Cobertura / convocatoria

```text
NO_AUTHORIZED_COVERAGE_AVAILABLE
NO_OPEN_PHOTOGRAPHER_CALL_AVAILABLE
```

Ausencias válidas; no bloquean técnicamente si hubiera eventos, pero hoy el mínimo de lanzamiento **no** se cumple.

---

## 7. Mínimo de lanzamiento

| Tipo | Mínimo | Disponible | Completo |
|------|-------:|-----------:|---------:|
| Presentación | 1 | 1 DRAFT | parcial (falta portada) |
| Eventos | 3 | **0** | no |
| Agenda/previa | 1 | 0 | no |
| HERO | 1 | candidato presentación | no listo |
| Cobertura | 0–1 | 0 | — |
| Convocatoria | 0–1 | 0 | — |

### Criterio contenido

```text
NO_GO_CONTENT_EMPTY
```

### Decisión GO

```text
BLOCKED_BY_CONTENT_SOURCE
```

(Si el OAuth humano se completa mañana sin eventos, pasaría a `COMPLETE_PENDING_REAL_CONTENT`.)

---

## 8. Home Día 1 (plan)

| Bloque | Candidato | Estado | Acción Día D |
|--------|-----------|--------|--------------|
| HERO | Presentación | DRAFT · falta portada | publicar + placement |
| Próximos | — | sin eventos | sync/manual reales |
| Destacados | DRAFT 3/4 si se completan | incompletos | publicar |
| Últimas | idem | incompletos | publicar |
| Cobertura | — | opcional | — |
| Fotógrafos | — | ocultar | — |

Home actual estable · **0** PUBLISHED.

---

## 9. Orden de publicación (no ejecutar)

1. Presentación  
2. Eventos (≥3)  
3. Agenda  
4. HERO  
5. Smoke Home  
6. Cobertura / convocatoria si existen  
7. Anuncio solo con autorización  

---

## 10. Validaciones / cleanup

| Check | Resultado |
|-------|-----------|
| `test:google-oauth-start` | OK |
| `test:clf-event-sync` | OK |
| migrate status | up to date |
| health dominio | `db:ok` |
| DEMO/smoke PUBLISHED | **0** |
| Roles alterados | **No** |

---

## 11. Próximos pasos

1. Completar OAuth humano en el dominio.  
2. Aportar ≥3 eventos futuros (CLF PUBLIC+slug **o** URLs/fuentes oficiales).  
3. Completar portada de la presentación.  
4. Completar fuentes de las 3 noticias `REAL_NEEDS_SOURCE`.  
5. Re-evaluar `READY_FOR_DOMAIN_GO_LIVE` / `READY_FOR_DOMAIN_GO_LIVE_PENDING_PUBLICATION`.

## Nota

La presentación DRAFT vive en Production DB (slug `presentacion-info-spot`); no versionada en git.
