# Clickatón — Cierre técnico y admisión de obras para jurado (Etapa 13)

**Fecha:** 2026-07-28  
**Edición:** Clickatón Argentina 2026 — TZ `America/Argentina/Cordoba`  
**Alcance:** contrato de admisión técnica Clickatón → FotoRank. **Sin jurado, scores, ranking ni resultados LIVE.**

Docs: `CLICKATON_PHOTO_UPLOAD_EXIF_GPS.md` · `CLICKATON_FOTORANK_SYNC.md` · `CLICKATON_TIMELINE_AND_PARTICIPANT_EXPERIENCE.md` · `CLICKATON_ACCREDITATION_AND_CHECKIN.md`

---

## 1. Arquitectura

| Responsable | Fuente de verdad |
|---|---|
| **Clickatón** | edición, pago, acreditación, timeline, consignas, ventanas, confirmación, excepciones, evaluación de elegibilidad |
| **FotoRank** | obra (`FotorankContestEntry`), assets, metadata técnica, `admissionStatus`, batch, snapshot de jurado, jurado futuro |

No se duplica el motor de jurado en Clickatón ni el timeline en FotoRank.

---

## 2. Contrato de admisión

Una obra solo avanza si cumple el motor `evaluateTechnicalAdmission` (`lib/technical-admission/rules.ts`):

- inscripción `CONFIRMED` + pago `APPROVED|NOT_REQUIRED`
- submission `CONFIRMED` + declaración (si requerida)
- consigna `RELEASED|CLOSED`
- original + SHA-256 + procesamiento
- entry FotoRank vinculada
- ventanas / excepciones
- duplicados / EXIF / GPS según política
- acreditación según `accreditationRequiredForAdmission`

Resultado estructurado: `TechnicalAdmissionDecision` (eligible, status, blockers, warnings, manual, versiones).

---

## 3. Estados

`NOT_EVALUATED` → `PENDING_*` → `ELIGIBLE` → `ADMITTED` → `FROZEN_FOR_JURY`  
Alternativos: `REJECTED` · `EXCLUDED` · `WITHDRAWN` · `REPLACED`

**Jurado futuro solo ve `FROZEN_FOR_JURY`** (gate en `isEvaluableFotorankContestEntry` + `listAnonymousEntriesForJuror`).

---

## 4. Modelos

### Reutilizados
- `ClickatonPhotoSubmission`, jobs/audit upload
- `FotorankContestEntry` + assets/checks
- Timeline (`UPLOAD_WINDOW_CLOSE`, `JUDGING_OPEN/CLOSE`)
- Capability grants

### Nuevos
- `ClickatonEditionAdmissionConfig`
- `ClickatonTechnicalAdmissionDecision` (historial)
- `ClickatonAdmissionAudit` / `ClickatonAdmissionJob`
- `FotorankAdmissionBatch`
- `FotorankJuryEntrySnapshot`
- Campos entry: `admissionStatus`, `admissionBatchId`, `anonymousJuryCode`, appeal/public-internal rejection

Migración: `packages/db/prisma/migrations/20260728130000_clickaton_technical_admission/`

---

## 5. Batch y congelamiento

1. DRAFT → evaluar pendientes  
2. REVIEW_REQUIRED / READY_TO_CLOSE  
3. CLOSED (bloquea si hay pendientes, salvo force)  
4. FROZEN → snapshots + `JURY_PREVIEW` + código anónimo  

Una vez FROZEN no se reabre silenciosamente (crear nueva versión de lote).

---

## 6. Anonimización

`buildAnonymousJuryCode` (hash estable concurso/categoría/entry/batch).  
Export jurado separado del export admin (sin identidad).

---

## 7. Assets de jurado

MVP: `JURY_PREVIEW` soft desde preview/original Clickatón, sin nombre de archivo ni GPS en metadata. Original privado intacto. Re-render durable vía job futuro.

---

## 8. Panel

`/admin/ediciones/[id]/admision` — KPIs, lote, evaluar/admitir masivo, cerrar/congelar/reabrir, exports.

---

## 9. Permisos

`canViewTechnicalAdmission`, `canReviewTechnicalAdmission`, `canAdmitEntries`, `canRejectEntries`, `canExcludeEntries`, `canCloseAdmissionBatch`, `canReopenAdmissionBatch`, `canResolveEntryIdentity` — vía grants (no emails hardcode).

---

## 10. Seed

`admissionEnabled=false`, `accreditationRequiredForAdmission=NOT_REQUIRED`, reglas DRAFT, grants iniciales. Sin admitir/congelar/abrir jurado.

---

## 11. Tests

```bash
pnpm --filter clickaton selfcheck:technical-admission
pnpm --filter clickaton selfcheck:photo-upload
pnpm --filter clickaton selfcheck:timeline
pnpm --filter clickaton selfcheck:accreditation
```

---

## 12. Etapas siguientes

- **14:** jurado / rúbricas / scoring — `CLICKATON_JURY_SCORING.md`
- **15:** ranking privado / desempates / batch — `CLICKATON_RANKING_AND_RESULTS.md` (sin publicación LIVE)
- **16+:** publicación de resultados / ganadores

## 13. Pendientes

Ranking / desempates / resultados públicos (Etapa 15), apelaciones completas, materialización FR storage nativa del preview.
