# 13 — ETAPA 04: Huecos de API cerrados + candado de crons corregido

**Fecha:** 2026-08-29
**Rama:** `feat/clf-migracion-monorepo-etapa06`
**Estado:** **P0-08 parcial / P1-01…P1-07 CERRADOS**

---

## 1. El hallazgo que cambió el encuadre

Las rutas que faltaban no eran "APIs pendientes de portar". Eran **funciones rotas**:
la pantalla estaba migrada y llamaba a una dirección que devolvía 404.

Se verificó cruzando, para cada ruta ausente, si algún componente del monorepo la invocaba.

| | Cantidad |
|--|--:|
| Rutas ausentes al empezar | 22 |
| De ellas, **rotas** (la pantalla existe y llama) | **14** |
| Inertes (nadie las llama) | 3 |
| Test / debug | 5 |

---

## 2. Rutas migradas (15)

Todas tenían sus dependencias ya presentes en el monorepo. Adaptaciones aplicadas:

1. `from "@prisma/client"` → `from "@/lib/prisma"` (patrón del monorepo)
2. `prisma.student` → `prisma.schoolStudent`

El control de sesión **no requirió cambios**: `getAuthUser` desde `@/lib/auth` es idéntico
en ambos lados (64 rutas del monorepo ya lo usan así).

| Ruta | Líneas | Pantallas que la llaman |
|--|--:|--:|
| `api/public/album/[slug]/student-roster` | 330 | 4 |
| `api/public/album/[slug]/student-roster/search` | 150 | (idem) |
| `api/public/referral-ambassador/signup` | 372 | 1 |
| `api/interested/[id]/delete-biometric` | 224 | 4 |
| `api/recommend-lab` | 128 | 1 |
| `api/tutorials` | 93 | 1 |
| `api/config` | 74 | **7** (incluye MainLayout) |
| `api/analytics/funnel` | 69 | 2 |
| `api/users/me/marketing-opt-in` | 63 | 2 |
| `api/public/community-upload-logo` | 58 | 2 |
| `api/users/me/revoke-face-consent` | 54 | 1 |
| `api/banner` | 47 | 1 |
| `api/prints/upload-final` | 44 | 2 |
| `api/fotolibros-test/[id]` | 40 | 1 |
| `api/public/community-categories` | 34 | 2 |
| `api/public/cuantocobro/quotes/[token]` | 29 | 2 |

### 2.1 Nota sobre el listado de alumnos

Las once piezas de apoyo del módulo escolar (`lib/school-roster/*`) ya estaban en el monorepo.
Sólo faltaba la ruta pública. Con esto **el sistema escolar queda operativo en el monorepo**.

---

## 3. Auditoría completa de rotos

### 3.1 Llamadas a rutas

Se extrajeron **538** direcciones `/api/…` distintas del código y se cruzaron contra las
**568** rutas existentes, con normalización de grupos de rutas y segmentos dinámicos.

**Resultado: 0 rotas.**

Cuatro falsos positivos verificados a mano:

| Detección | Realidad |
|--|--|
| `/api/admin/template-v2/templates/${encodeURIComponent` | truncado por el extractor; `[templateId]` existe |
| `/api/public/album/${encodeURIComponent` | `[slug]` existe |
| `/api/public/albums/${encodeURIComponent` | `[slug]` existe |
| `/api/photos/` | no es una llamada: es `.includes()` / `.startsWith()` sobre texto |

### 3.2 Enlaces internos

**157** enlaces internos cruzados contra **249** páginas. Dos salieron sin destino:

| Enlace | Veredicto |
|--|--|
| `/organizador/events` (a secas) | `events/new` y `events/[id]` existen; **estructura idéntica en legacy** |
| `/admin/laboratorios/${lab.id}` | legacy tampoco tiene página de detalle; **preexistente** |

**Ninguno es regresión de la migración.**

### 3.3 Compilación

`tsc --noEmit` sobre **6.818 archivos**: **0 errores**.

---

## 4. El candado de los crons — un error ya corregido en legacy que el monorepo arrastraba

### 4.1 El problema

`lib/cron-advisory-lock.ts` existía en el monorepo, pero con el método **viejo**:

```ts
SELECT pg_try_advisory_lock(...)
```

`pg_try_advisory_lock` es un candado **de sesión**. Con el pooler en modo transacción
(Neon/PgBouncer) el `pg_advisory_unlock` del final sale por **otra conexión** y no libera nada.
Cada corrida dejaba un candado huérfano y el cron se bloqueaba a sí mismo para siempre.

**Verificado en producción el 24/08/2026** — legacy lo reemplazó ese día. El monorepo no.

### 4.2 La corrección

Método de *lease* con vencimiento sobre la tabla `CronLease`: si el proceso muere sin liberar,
el candado vence solo y el cron se recupera.

| Archivo | Acción |
|--|--|
| `lib/cron-lease-policy.ts` | **nuevo** (37 líneas) |
| `lib/cron-lease-policy.test.ts` | **nuevo** (47 líneas, 5 pruebas) |
| `lib/cron-advisory-lock.ts` | **reemplazado** (95 líneas) |
| `app/api/internal/analysis/run/route.ts` | 1 línea: `releaseCronLock(id, token)` |
| `app/api/cron/process-camera-ingest-jobs/route.ts` | 1 línea: idem |
| `packages/db/prisma/schema.prisma` | **+ `model CronLease`** |

Los cuatro archivos quedaron **idénticos a legacy**. Pruebas: **5/5 en verde**.

### 4.3 Efecto en la base

La migración ya **no borra** `CronLease` (antes era la única destrucción con datos: 2 filas).

Diferencia restante contra la copia migrada: **29 líneas**, todas esperadas —
5 `DROP DEFAULT` de la columna `platform` del blog (limpieza tras poblar las filas viejas)
y la recreación de `CronLease` (artefacto de haber corrido la migración anterior en esa copia).

---

## 5. Lo que queda sin migrar (7 rutas, decisión consciente)

| Ruta | Motivo |
|--|--|
| `api/upsells/applicable` | nadie la llama en ninguno de los dos |
| `api/system-settings` | nadie la llama en ninguno de los dos |
| `api/cron/analysis-health` | nadie la llama; depende de `lib/analysis/collect-pipeline-health.ts`, no migrado |
| `api/debug-env` | diagnóstico de desarrollo |
| `api/test/whatsapp`, `api/test/env-whatsapp` | pruebas |
| `api/fotolibros-test/[id]` | **migrada igual** (ver §2) |

---

## 6. Estado de bloqueantes

| ID | Antes | Ahora |
|--|--|--|
| P1-01 template-v2 fotógrafo | Abierto | ya estaba cerrado (verificado) |
| P1-02 escolar público | Abierto | **CERRADO** |
| P1-03 consent (marketing, face) | Abierto | **CERRADO** |
| P1-04 print upload-final | Abierto | **CERRADO** |
| P1-05 upsells | Abierto | descartado (nadie la llama) |
| P1-06 comunidad pública | Abierto | **CERRADO** |
| P1-07 Cuánto Cobro público | Abierto | **CERRADO** |
| **Nuevo** — candado de crons roto | no detectado | **CORREGIDO** |
