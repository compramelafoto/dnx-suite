# 03 — Paridad de base de datos

**Fecha:** 2026-07-29  
**Fuentes:** schemas live + `docs/architecture/migration/03-prisma-diff.md` + ADR-0001  
**NO se ejecutaron migraciones en esta etapa.**

---

## 1. Conteos verificados

| | Legacy | Monorepo `@repo/db` |
|--|-------:|--------------------:|
| Models | **186** | **365** |
| Enums | **126** | **322** |
| Carpetas migración | **~172** | **~90** |
| Schema path | `…/compramelafoto/prisma/schema.prisma` | `packages/db/prisma/schema.prisma` |

---

## 2. Estado del merge schema

Según reportes `07`–`21` + verificación 2026-07-29:

| Criterio | Estado |
|----------|--------|
| Modelos Legacy ausentes (con `Student`→`SchoolStudent`) | **0** |
| Enums Legacy ausentes | **0** |
| Modelos solo suite (FotoOffice/FotoRank/Clickatón/DNX/InfoSpot…) | **~179** |
| `Role` incluye `SCHOOL_ORGANIZER` | **Sí** |
| `WebhookEvent @@unique([paymentId, status])` | Alineado |
| Commerce Order/Album/Photo | Mergeado (reporte 10) |

### ADR-0001 — D1 SchoolStudent

| Aspecto | Estado |
|---------|--------|
| Modelo Prisma `SchoolStudent` | Presente (`@@map("SchoolStudent")`) |
| Modelo suite `Student` (evaluaciones) | Presente (cuid) |
| Código app usa `prisma.schoolStudent` | Sí |
| Migración SQL `ALTER TABLE "Student" RENAME TO "SchoolStudent"` en historial mono | **NO encontrada** |

**Riesgo cutover prod CLF:** Prisma espera tabla física `SchoolStudent`; prod Legacy tiene `Student` escolar → **ruptura** sin rename.

---

## 3. Compatibilidad con datos de producción CLF

### ¿Puede Monorepo usar la DB prod sin pérdida?

**No de forma segura “apuntar y listo”.**

| Condición | Veredicto |
|-----------|-----------|
| Cobertura lógica de modelos CLF | Sí (superset) |
| Nombres físicos de tablas escolares | **Incompatible** sin rename |
| Historial `_prisma_migrations` | **Incompatible** (no replay 172 migraciones Legacy — ADR D7) |
| Tablas suite/Clickatón/FI en misma DB | Requieren forward plan ordenado; muchas gaps marcadas *Do NOT apply to production yet* |
| Dual-read FI | Default seguro: `DNX_FINANCIAL_IDENTITY_READ_MODE=LEGACY_ONLY` |

### Riesgos de pérdida / ruptura

| ID | Riesgo | Severidad |
|----|--------|-----------|
| DB-01 | Tabla `Student` vs `SchoolStudent` | **CRITICAL** |
| DB-02 | Aplicar migraciones suite a prod CLF sin checklist | HIGH |
| DB-03 | Drift enums si gap incompleto | HIGH |
| DB-04 | FI / `DnxPayment*` aplicadas en staging ≠ prod | MED |
| DB-05 | Backfill FI sin freeze de escrituras MP | MED |

---

## 4. Transformaciones / backfills necesarios (plan, no ejecutar)

1. **Backup** `pg_dump` prod.  
2. **Rename** `Student` → `SchoolStudent` (+ FKs/columnas según ADR D1).  
3. **ADD VALUE** enums faltantes (`IF NOT EXISTS`).  
4. **Forward gaps** solo columnas/tablas CLF faltantes (idempotentes).  
5. **Tablas suite** solo si la misma Neon branch debe servir FotoOffice/etc.  
6. **Backfill FI** (dry-run → apply) — opcional pre-cutover; no requerido para cobro Legacy.  
7. Validar `/api/health/db-schema` + smoke queries críticas.

---

## 5. Modelos centrales de paridad comercial

Presentes en ambos (nombres canónicos mono):

- `User`, `Album`, `Photo`, `Event`, `Order`, `PreCompraOrder`, `PrintOrder`
- `Lab`, `School*`, `SchoolStudent`, `ZipGenerationJob`
- `WebhookEvent`, `OrganizerCommission*`, `Referral*`
- `EmailQueue`, `CameraIngestJob`, `Video*`
- Face/Subject/Rekognition models

Pagos Legacy **no** usan tabla `Payment` genérica dominante: viven en `Order.mp*` + `WebhookEvent` (+ `PaymentSplit` print).

---

## 6. Conclusión DB

| Pregunta | Respuesta |
|----------|-----------|
| ¿Schema mono cubre Legacy? | **Sí (lógico)** |
| ¿Cutover prod seguro hoy? | **NO** |
| Bloquea cutover | **SÍ** — plan SQL + rename obligatorio |
| Complejidad | **XL** (ops + ventana + validación) |
