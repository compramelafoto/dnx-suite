# Santa Fe en Foco — Admisión técnica y revisión operativa (ETAPA 06)

**BORRADOR — LEGAL REVIEW REQUIRED — NO PUBLICAR**

Palabra clave: **SANTA FE** · App: FotoRank · Concurso slug: `santa-fe-en-foco`

## Principio central

Una carga exitosa **no** implica admisión. El participante distingue: archivo recibido → análisis técnico → revisión manual → admitida / rechazada / reemplazo / evidencia → congelada. **Ninguna obra entra al jurado** sin `admissionStatus = FROZEN_FOR_JURY`.

## Arquitectura

Reutiliza el pipeline nativo FotoRank + enums Etapa 13:

| Pieza | Ubicación |
|---|---|
| Reason codes | `apps/fotorank/app/lib/fotorank/admission/reason-codes.ts` |
| Matriz automática | `…/admission/auto-matrix.ts` |
| Cola / admit / reject / evidence / ARGRA / freeze | `…/admission/admission-service.ts` |
| Estados lógicos | `…/admission/state-mapping.ts` |
| Upload + elegibilidad 05 | `…/entries/entry-service.ts` |
| UI cola | `/dashboard/concursos/[id]/admision` |
| UI detalle | `/dashboard/concursos/[id]/inscripciones/[entryId]` |
| APIs | `/api/fotorank/contests/[contestId]/admission/*` |

No existe un segundo sistema paralelo ni modelos `SantaFeAdmission*`.

## Modelos (sin migración nueva)

- `FotorankContestEntry.status` / `technicalSummaryStatus` / `manualReviewStatus` / `admissionStatus`
- `FotorankContestEntryReview` (historial)
- `FotorankContestEntryCheck` (checklist)
- `FotorankAdmissionBatch` + `FotorankJuryEntrySnapshot` (freeze)
- `metadataJson.eligibility` (ETAPA 05)
- `metadataJson.admissionOps` (evidencia, reason codes, notification intents)
- `FotorankContestRegistration.answersJson` (ARGRA)
- Auditoría: `FotorankJudgeAuditEvent` (`ADMISSION_*`)

## Estados — mapping

| Lógico | `admissionStatus` | `status` típico | `manualReviewStatus` | Jurado |
|---|---|---|---|---|
| UPLOADED | null / PENDING_AUTOMATIC | UPLOADED/PROCESSING | NONE | No |
| AUTO_CHECK_PENDING | PENDING_AUTOMATIC_REVIEW | PROCESSING | NONE | No |
| AUTO_CHECK_PASSED | ELIGIBLE | READY_TO_CONFIRM / CONFIRMED | NONE | No |
| AUTO_CHECK_FAILED | REJECTED | REJECTED | — | No |
| MANUAL_REVIEW_REQUIRED | PENDING_MANUAL_REVIEW | REQUIRES_REVIEW | PENDING | No |
| EVIDENCE_REQUESTED | PENDING_MANUAL_REVIEW | REQUIRES_REVIEW | PENDING + ops.evidence OPEN | No |
| REPLACEMENT_ALLOWED | PENDING_MANUAL_REVIEW | * | REPLACEMENT_REQUESTED | No |
| ADMITTED | ADMITTED | CONFIRMED | APPROVED | No |
| REJECTED | REJECTED | REJECTED | REJECTED | No |
| WITHDRAWN | WITHDRAWN | WITHDRAWN | — | No |
| FROZEN | FROZEN_FOR_JURY | CONFIRMED | APPROVED | **Sí** |

Confirmación del participante (`CONFIRMED`) ≠ admisión formal.

## Transiciones principales

1. Upload → matriz automática → `ELIGIBLE` | `PENDING_MANUAL_REVIEW` | `REJECTED`
2. Organizer `admit` → `ADMITTED` (cierra evidencia/ARGRA si aplica)
3. Organizer `reject` → `REJECTED` (reason obligatorio)
4. `requestEvidence` → ops.evidence OPEN
5. `allowReplacement` → `REPLACEMENT_REQUESTED` (bloqueado si FROZEN)
6. Replace upload → reanálisis (`PENDING_*` / `ELIGIBLE`), invalida evidencia previa
7. Freeze dry-run / apply → solo `ADMITTED` → `FROZEN_FOR_JURY` + snapshot anónimo

## Reason codes

Catálogo en `ADMISSION_REASON_CODES` (archivo, dispositivo, territorio, período, autoría, operación). Cada código: mensaje público/interno, severidad, acción, evidencia, visibilidad, `allowsReplacement`, `blocksJury`.

APIs rechazan codes no registrados.

## Reglas automáticas

- **Auto-pass:** Amateur+celular, Profesional+cámara, Aérea+dron ID, territorio+localidad+período, ARGRA verificado si aplica.
- **Revisión:** EXIF/fecha/GPS inconsistente, dispositivo unknown, profesional+celular, aérea sin dron ID, ARGRA pendiente, software edición, duplicado.
- **Auto-reject permitido:** formato/corrupto/límites, segunda obra (vía policy), territorio/localidad faltantes, ARGRA vacío Reportero, dispositivo inequívocamente incompatible.
- **Nunca auto-reject definitivo:** GPS ausente, EXIF ausente, IA sospechada, edición sospechada, reloj incorrecto, metadata eliminada, falta RAW inicial.

## Cola y filtros

Ruta admin `…/admision` + `GET …/admission/queue?filter=&page=`.

Filtros: all, requires_review, date/territory/device observed, argra_pending, drone_unidentified, possible_duplicate, evidence_requested, replacement_pending, ready_to_admit, rejected, admitted, frozen.

Orden: crítico → revisión antigua → evidencia → ready_to_admit → resto. Paginación `pageSize≤100`.

## ARGRA

Estados: `NOT_REQUIRED | PENDING_VERIFICATION | VERIFIED | REJECTED | EVIDENCE_REQUESTED`.

- Listados: redactado `•••••123`
- Completo: solo `?revealArgra=1` con permiso organizador
- Sin integración externa · flags `PENDING_INSTITUTIONAL_APPROVAL` · `LEGAL REVIEW REQUIRED`

## Territorio / período / dispositivo

Resolución operativa en detalle + reason codes; GPS exacto no en listados/logs; bounding box = evidencia no geofence legal. Dispositivo por categoría según ETAPA 05; no auto-recategorizar.

## Evidencia

Persistida en `metadataJson.admissionOps.evidenceRequest` (tipos, mensajes, deadline, respuesta texto). Adjuntos de evidencia: estructura mínima texto; R2 público prohibido. Emails: solo `notificationIntents` internos si outbox incompleto.

## Freeze selectivo (ETAPA 06B)

**No** congela implícitamente todas las `ADMITTED` del concurso.

`POST …/admission/freeze` requiere alcance explícito:

* `categorySlugs[]` y/o `entryIds[]` (obligatorio);
* `dryRun: true` (default) → devuelve `selectionHash`, `expectedCount`, counts, `byCategory`, códigos muestra, leaks;
* `dryRun: false` → requiere `selectionHash` + `expectedCount` (+ `confirmPhrase` `CONGELAR N OBRAS`);
* si el conjunto cambió → `SELECTION_HASH_MISMATCH` / abort.

Selection hash: `sha256:v1:<hex>` sobre `contestId|categorySlugsSorted|entryIdsSorted|rulesVersion|expectedCount` (sin PII).

Exclusiones: PENDING_*, EVIDENCE OPEN, REPLACEMENT_REQUESTED, REJECTED, WITHDRAWN, otro concurso/org, ARGRA no VERIFIED (Reportero), leaks de anonimización (sin override UI).

Categorías congelables por separado (Amateur / Profesional / Reportero / Aérea).

Batch metadata registra hash, categorías, entryIds, operador, expectedCount.

## UI validada (06B)

* Cola `/admision` + filtros + freeze selectivo panel.
* Detalle con acciones admit/reject/evidence/replace/ARGRA.
* Credenciales de test: bootstrap `ops-sfef-06b-bootstrap-org.ts` → `/tmp/sfef-06b-creds.env` (nunca en repo). Estados: PRESENT/ABSENT. Dominio `@fotorank.test`.
* Playwright: `e2e/santa-fe-06-admission-staging-matrix.spec.ts` — **7/7 PASS** en `fotorank.staging.dnxsuite.com` (sin SKIP).
* Gate organizador: `canAccessFotorankOrganizerDashboard` admite membresía ACTIVE `ContestOrganization` (además de suite/SUPER_ADMIN).
* Participante: `EntryUploadPanel` carga `/entries/me` al montar (estado público / reemplazo visible).
* Cleanup: `ops-sfef-06b-cleanup-fixtures.ts` (dry-run default; `APPLY=1` explícito; solo `sfef06*@fotorank.test` + contest staging).

## Permisos

Organizer ACTIVE `OWNER|ADMIN|EDITOR` del org del concurso. Participante: solo su obra / respuesta evidencia. Jurado: no revisa admisión; solo ve FROZEN. Validación server-side.

## APIs

| Método | Path |
|---|---|
| GET | `/admission/queue` |
| GET | `/admission/entries/[entryId]` |
| POST | `/admission/entries/[entryId]/admit` |
| POST | `…/reject` |
| POST | `…/evidence` |
| POST | `…/allow-replacement` |
| POST | `…/argra` |
| POST | `/admission/freeze` |

## Tests

- Unit: `pnpm --filter fotorank run test:admission:selfcheck`
- Elegibilidad 05: `test:eligibility:selfcheck`
- E2E staging: `e2e/santa-fe-06-admission-staging-matrix.spec.ts` + fixtures

## Emails (futuro)

Eventos: `EVIDENCE_REQUESTED`, `REPLACEMENT_ALLOWED`, `ADMITTED`, `REJECTED`, `FROZEN`. No bloquear admisión por Resend.

## Riesgos / acción legal

Motivos de rechazo, apelaciones, evidencia, RAW, EXIF, GPS, ARGRA, drones, IA, reemplazos, retención, freeze, menores, notificaciones → **revisión legal obligatoria** antes de publicar bases o abrir concurso real.

## Performance

Índices existentes: `contestId+admissionStatus`, `technicalSummaryStatus`, `status`. Cola server-side con paginación; evitar N+1 (include acotado). Batch freeze iterativo (mejorable con `updateMany` + snapshots por lotes).
