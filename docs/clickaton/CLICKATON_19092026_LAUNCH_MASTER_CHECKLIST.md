# Clickatón Argentina 2026 — Checklist maestro pre-lanzamiento

**Etapa:** **10E.1 — Cierre de oferta comercial (remera / first-100 / media / panel %)**  
**Fecha:** 2026-07-31  
**Edición:** Clickatón Argentina 2026 (`clickaton-argentina-2026` / `cms78cthj0000xpc4841bihf4`)  
**Evento:** 19/09/2026 · TZ `America/Argentina/Cordoba`  
**Dominio:** `https://maratonfotografica.com`  
**Inscripciones:** `registrationEnabled=false` (no abiertas)  
**Checkout LIVE:** OFF  
**Legal:** `LEGAL REVIEW REQUIRED` (sin cambios en esta etapa)  
**Deploy Staging:** `dpl_GANX1W8hMF65fTRSi5SPefQNb7K6` → `clickaton-staging.vercel.app`  
**Deploy Production:** `dpl_AJVrV9X5gmp9eoVpjc6xm3zRMv6c` → `maratonfotografica.com`

Estados: `PASS` · `PARTIAL` · `MISSING` · `BLOCKED` · `HUMAN UPLOAD REQUIRED`

### Evidencia ya cerrada (no re-auditar)

R2 READY · Resend vars PRESENT · Partner OAuth PROD · social LIVE OFF · checkout LIVE OFF · DB/migrations/backup PASS (10D / 10E.0).

---

## Veredicto final (10E.1)

```text
CLICKATON COMMERCIAL UI READY — PRODUCT MEDIA HUMAN UPLOAD REQUIRED
```

Implementación técnica de oferta comercial visible: **lista** (regla 100+30/08, copy dinámico, talles, panel allocations genérico, admin media R2).  
Bloqueo restante de oferta: **archivos reales** (foto remera + guía talles) aún no cargados.

No aplica `CLICKATON COMMERCIAL OFFER READY` hasta media humana.  
No aplica `CLICKATON SALES READY`: siguen LIVE pago, legal, Resend smoke, apertura regs.

---

## BLOCKERS PARA ABRIR VENTAS

| # | Ítem | Estado | Evidencia 10E.1 |
|---|------|--------|-----------------|
| 1 | Cobro LIVE Production | **BLOCKED** | Sin cambios; no ejecutar. |
| 2 | Legal | **BLOCKED** | `LEGAL REVIEW REQUIRED`. |
| 3 | Media referencia remera | **PASS** | 10D.3: primary dúo + galería hombre/mujer en `/media/remera-clickaton/` (HTTP 200). |
| 4 | Guía / tabla de talles | **PASS** | SIZE_CHART vertical + DETAIL horizontal reales cargadas. |
| 5 | Regla first-100 **y** ≤30/08/2026 AR | **PASS** (código) | Ver §4. Migración `benefitDeadlineAt` + seed/reconcile. Aplicar en Staging→Prod con regs cerradas. |
| 6 | Smoke Resend Production | **BLOCKED** | Vars PRESENT; smoke humano pendiente. |
| 7 | LIVE E2E pago real | **MISSING** | No autorizado. |
| 8 | UX venta con remera inequívoca | **PARTIAL** | Copy+UI listos; media humana + regs off impiden validación visual final. |

---

## IMPORTANTES NO BLOQUEANTES

| # | Ítem | Estado | Notas |
|---|------|--------|-------|
| 1 | Copy público TEST | **PASS** | Landing sin “Ciudad TEST”. |
| 2 | Plan B financiero DNX 100% | **PASS** | `dnxfotografia@gmail.com` 100%; Tammy fuera. |
| 3 | Permisos % (grants) | **PASS** | Solo `DNX_FINANCE_OWNER` muta. |
| 4 | UI panel % genérico | **PASS** | `EditionDistributionEditor`: select recipient ACTIVE, %, suma 100, add/remove, sin Tammy hardcode. |
| 5 | Producto remera + talles | **PASS** | XS–XXXL catálogo. |
| 6 | Precios $25k/$30k/$35k | **PASS** | Fechas de fase intactas (beneficio separado). |
| 7 | Instagram handle | **PASS** | |
| 8 | Welcome card | **PARTIAL** | Sin cambios 10E.1. |
| 9 | Stories API | **BLOCKED** | Post-legal. |
| 10 | Panel pagos en ficha inscripción | **PARTIAL** | Allocation UI en finanzas edición; ficha inscripción sigue parcial. |

---

# Detalle 10E.1

## 1. Regla oficial remera — PASS (código)

Canónica:

```text
benefitEligible =
  CONFIRMED
  AND confirmedAt <= 2026-08-30T23:59:59.999-03:00 (America/Argentina/Buenos_Aires)
  AND confirmedBeneficiaries < stockLimit(100)
```

- Cupo = `stockLimit=100` (no capacity general).
- N+1 se inscribe sin beneficio; sin capacity error.
- PENDING+hold = soft anti-oversell; definitivo al confirmar con `FOR UPDATE` + revoke.
- Corte documentado: **fin de día 30/08/2026 AR** (default ante falta de decisión humana distinta).
- Selfcheck: `pnpm --filter clickaton selfcheck:first-n-benefit` → **ok**.

Separación:

| Concepto | Campo / ventana |
|----------|-----------------|
| Precio / fase | `RegistrationPricePhase` starts/ends ($25k hasta 20/08, etc.) |
| Beneficio remera | `ClickatonPricePhaseItem.benefitDeadlineAt` + `stockLimit` |

Seed: remera en fases $25k **y** $30k; Fase $35k (desde 06/09) sin remera.

## 2. Copy público — PASS

- Oferta: `Remera Clickatón incluida para los primeros 100 inscriptos con pago confirmado o hasta el 30 de agosto, lo que ocurra primero.`
- Disponible: `Tu inscripción incluye remera Clickatón.`
- Agotado/vencido: `La promoción de remera incluida ya finalizó.`

## 3. Media producto — PASS (pipeline) / HUMAN UPLOAD REQUIRED (contenido)

Schema soporta PRIMARY / GALLERY / SIZE_CHART + sortOrder + altText.  
Admin: subir principal, adicionales, guía; reemplazar; ordenar; borrar → R2 `clickaton/products/...`.  
Sin inventar medidas ni fotos.

Estados contenido:

```text
PRODUCT MEDIA HUMAN UPLOAD REQUIRED
MEDIA CONTENT HUMAN UPLOAD REQUIRED
```

## 4. Panel allocations — PASS

- Selector recipients ACTIVE (no Tammy-oriented).
- Add/remove, %, validación suma exacta 100.
- Reject: &lt;100, &gt;100, duplicate, identity/account inactive, sin payment account ACTIVE.
- Mutate solo `DNX_FINANCE_OWNER`.
- Production Plan B intacto: DNX ORGANIZATION 100%.

## 5. Tests selfcheck 10E.1 — PASS

Cubre: first 100, N+1, deadline before/after, race final slot, media upload/replace/delete/reorder wires, frontend size guide + copy, allocation 100/80/120/dup, inactive account source, viewer forbidden.

## 6. Staging / Production

Orden:

1. Migrar `benefitDeadlineAt` en Staging.
2. Correr seed AR2026 (idempotente) con regs cerradas.
3. Validar selfcheck + admin UI.
4. Deploy Production **sin** abrir inscripciones ni LIVE.
5. Cargar media real solo si hay archivos humanos.

**Ops 10E.1 ejecutado:**

| Paso | Staging (`ep-round-fog` / `neondb`) | Production (`ep-silent-haze` / `clickaton_production`) |
|------|-------------------------------------|------------------------------------------------------|
| migrate `benefitDeadlineAt` | PASS | PASS |
| seed AR2026 (shirt F1+F2, deadline 30/08 AR) | PASS | PASS |
| `registrationEnabled` | **false** (forzado post-seed; Staging tenía OPEN previo) | **false** |
| Plan B ACTIVE DNX 100% / owner PA | n/a (Tammy DRAFT no activado) | PASS intacto |
| media remera / guía | HUMAN UPLOAD REQUIRED | HUMAN UPLOAD REQUIRED |
| deploy app | PASS `dpl_GANX1…` | PASS `dpl_AJVr…` |

Selfcheck local: `pnpm --filter clickaton selfcheck:first-n-benefit` → **ok**.

---

## Decisiones humanas abiertas

1. ~~Hora de corte 30/08~~ → default documentado fin de día AR (cambiar solo si hay decisión distinta).  
2. `LEGAL APPROVED FOR REGISTRATION`.  
3. Cargar media remera + guía talles reales.  
4. Smoke Resend humano.  
5. Autorizar E2E LIVE.  
6. Cuándo volver % a Tammy.

---

**Fin 10E.1 (código)** — pendiente migrate/seed/deploy + upload humano.
