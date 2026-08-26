# Partners — Manifiesto de migraciones (Stage 04 Imp 01)
**Fecha:** 2026-08-03
**Alcance:** solo staging. No aplicar en producción sin aprobación aparte.

| Migración | Disco | Líneas | Notas de seguridad |
|---|---|---:|---|
| `20260802120000_dnx_partners_domain` | PRESENT | 224 | none |
| `20260802150000_dnx_partner_benefit_access` | PRESENT | 28 | none |
| `20260802160000_dnx_partner_assets` | PRESENT | 147 | none |
| `20260803120000_dnx_partner_benefit_eligibility` | PRESENT | 63 | DROP INDEX (constraint replace), DROP NOT NULL (nullable widen) |
| `20260803180000_dnx_partner_benefit_auto_sync_caps` | PRESENT | 9 | none |

## Evaluación

- Dominio / access / assets / auto-sync caps: **aditivas** (CREATE TYPE/TABLE/INDEX, ALTER ADD).
- Elegibilidad: **aditiva compatible** — reemplaza unique `(benefitId,userId)` por `accessKey`, amplía `userId` a nullable, añade statuses/source/SyncRun.
- `DROP INDEX IF EXISTS` + `DROP NOT NULL` no borran datos; requieren backup igual.
- Rollback: documentado en SQL comments; no automatizado.
- Orden: domain → benefit_access → assets → eligibility → auto_sync_caps.

## Estado de aplicación

**NO APLICADAS en esta etapa** — bloqueado por identidad DB / backup / confirmación.

---

## Imp 02

Comando protegido disponible:

```bash
pnpm --filter @repo/db partners:migrate:staging -- \
  --confirm-staging-migration --backup-ref=<id>
```

**Aún no aplicadas** — falta URL staging + backup verificado.

---

## Imp 03

Lectura incidental (no autorizada como cierre): con URL staging temporal de otro flujo, Partners migrations aparecen **aplicadas** (`pending=[]`, ~12 tablas `DnxPartner*`).

**No se ejecutó** `partners:migrate:staging` en Imp 03 — falta bloque operador + backup Partners dedicado verificable.

---

## Imp 04

Pivot a **producción**. Ver `PARTNERS_STAGE_04_IMPLEMENTATION_04_RESULT.md`. Staging Sponsors fuera de alcance.
