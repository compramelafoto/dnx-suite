/**
 * Contrato del adaptador editorial para `InfoSpotEvent`
 *
 * Implementado en `event-adapter.ts` + `app/actions/event-editorial-workflow.ts`.
 *
 * ## Content type
 *
 * `EditorialContentType` incluye `"EVENT"`.
 *
 * ## Observaciones
 *
 * Se usa `InfoSpotEventObservation` (tabla hermana de Article) para no
 * arriesgar el historial de noticias. Misma semántica: RETURN + NOTE.
 *
 * ## Intake público
 *
 * `/publicar-evento` crea el evento en `IN_REVIEW` + `InfoSpotEventSubmission`
 * en `PENDING_REVIEW` (estado de intake, no editorial).
 *
 * ## CLF (futuro)
 *
 * Importaciones desde CLF deben nacer en `DRAFT` vía
 * `initialEventStatusForOrigin("CLF_IMPORT_FUTURE")`.
 */
