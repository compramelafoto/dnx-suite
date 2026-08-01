# FotoRank P0-07 — Informe: panel anónimo de jurado, bases admin y storage R2

**Fecha:** 2026-07-28  
**Rama:** `migration-legacy-clf-to-monorepo`  
**DB prueba:** `fotorank_p0_06_test` (localhost)  
**Sin commit / push / deploy. Neon no intervenido.**

---

## 1. Dominio de jurado reutilizado

Se reutilizan `FotorankJudgeAccount`, invitaciones, assignments, sessions (`judge-auth`) y audit events.  
Nuevo: `FotorankJudgeEntryConflict` (+ enums reason/status + `FotorankJudgeEntryEvalStatus` placeholder).

## 2. Permisos

Jurado activo + assignment en concurso/categoría + obra `CONFIRMED` + no retirada + `JURY_PREVIEW`.  
Bloqueos: categoría ajena, concurso ajeno, ORIGINAL, obra no confirmada, conflicto ACTIVE.

## 3. Anonimización

`serializeEntryForJuror` / allowlist + `assertNoForbiddenJuryFields`.  
Código anónimo = `entryNumber` (estable al reemplazar; no se regenera).

## 4–6. Preview / técnico / orden

- `getJuryPreviewAccess` + proxy `private-asset` con sesión jurado  
- `buildJuryTechnicalSummary` (checks allowlist, sin GPS/raw/hash)  
- Orden: `sha256(judgeId|contestId|entryId)` estable  

## 7. Conflictos

`POST .../conflict` → `CONFLICT_DECLARED`; obra desaparece del listado de ese jurado.

## 8–9. Bases admin + placeholders

UI `/dashboard/concursos/[id]/bases` + APIs draft/publish.  
`production-gate.ts` + `FOTORANK_APP_ENV` / `VERCEL_ENV`.

## 10–11. Storage

`PrivateContestStorageProvider`: local + R2 (`@aws-sdk/client-s3`).  
`getContestEntryStorage()` elige provider. Selfcheck config sin upload.

## 12. Endpoint privado

`/api/fotorank/private-asset`: rol inferido (User vs Judge). Jurado ≠ ORIGINAL.

## 13–14. Métricas / Public API

`getContestOperationalMetrics` + batch `getPublicCountsByContestIds`.  
Público: `confirmedRegistrationCount` (inscripciones) y `confirmedEntryCount` (obras).

## 15. Migración

`20260728160000_fotorank_p0_07_jury_anonymization_rules_storage`  
Solo local (`db push` / migrate deploy en test).

## 16. Tests

| Suite | Resultado esperado |
|-------|--------------------|
| `test:jury:selfcheck` | PASS |
| `test:jury:integration` | PASS en localhost |
| `test:storage:r2-config` | PASS |
| E2E `jury-anonymous-panel.spec.ts` | requiere seed jurado |

## 17. Riesgos

- Rúbricas/votos aún no habilitados (mensaje explícito).  
- R2 prod sin credenciales en este entorno.  
- Seed SF crea categorías; fixtures jurado vía integration / script aparte.  
- EvaluationClient legacy puede necesitar adaptar UI a `anonymousCode` (listEntries ya no manda `imageUrl`).

## 18. Próximo paso

**P1-01 rúbricas mínimas + voto anónimo** sobre `entryNumber` + `JURY_PREVIEW`, o adapter R2 staging real + E2E verde con seed completo.
