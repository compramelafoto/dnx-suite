# Clickatón → FotoRank — Arquitectura de integración canónica

**Etapa:** 11C (auditoría + contrato)  
**Fecha:** 2026-08-08  
**Estado:** contrato técnico — **no inventa** reglas de producto  
**Principio:** no construir un segundo FotoRank dentro de Clickatón.

---

## 1. Responsabilidades

| Dominio | Dueño | Notas |
|---------|-------|-------|
| Comercialización, pago, acreditación, kit, referidos | **Clickatón** | Fuente de verdad comercial |
| Dinámica del evento, consignas, horarios, UX maratón | **Clickatón** | Timeline + prompts |
| Identidad humana | **User DNX** compartido | Una cuenta |
| Roster postpago → elegible para entregar | **FotoRank** `FotorankContestParticipant` | Sync CK→FR |
| Inscripción nativa / pago concurso clásico | **FotoRank** `FotorankContestRegistration` | Santa Fe; **no** reutilizar para maratón CK |
| Recepción canónica de obra, entry, jury, scoring, ranking, resultados | **FotoRank** | Motor fotográfico |
| Storage original de obras maratón (hoy) | **Clickatón** (híbrido) | **GAP:** original en path CK; entry FR sin `FotorankContestEntryAsset` completo |
| EXIF / validación técnica (hoy) | Pipeline CK + summary en entry FR | **GAP:** unificar ownership hacia FR |

---

## 2. Source of truth

| Concepto | SoT | Consumidor |
|----------|-----|------------|
| Compra / pago / devolución | `ClickatonRegistration` | CK |
| Acreditación / kit / talle | Clickatón | CK |
| Vínculo edición↔concurso | `ClickatonEdition.fotorankContestId` (soft) | Sync / upload |
| Roster elegible | `FotorankContestParticipant` | FR |
| Consignas / ventanas / secreto | `ClickatonPrompt` + timeline | CK UI + gates |
| Obra (entry lógica) | `FotorankContestEntry` + soft refs `external*` | FR admission/jury |
| Submission operativa maratón | `ClickatonPhotoSubmission` | Orquestación CK |
| Admisión / freeze / jury / score / rank | Motores FotoRank | FR; CK resume |

**Regla:** FotoRank **no** duplica pagos. Clickatón **no** duplica jurado/ranking.

---

## 3. Vínculo evento / concurso

```
ClickatonEdition
  fotorankContestId ──soft──► FotorankContest
                               experienceType = MARATHON
                               distributionChannel = CLICKATON
```

- Relación por **ID**, no por slug/nombre.
- Multi-evento: N ediciones → N concursos (Rosario / Córdoba / BA / futuras).
- Gates: `fotoRankSyncEnabled`, `fotoRankSyncMode`, `fotoRankValidationStatus` (`NOT_CONFIGURED`…`VALID`…).
- Seed: sync OFF, `fotorankContestId=null` hasta validación operativa.

---

## 4. Sync de participantes

```
PAID/CONFIRMED (Clickatón)
  → outbox CLICKATON_REGISTRATION_PAID
  → ClickatonFotoRankSync (idempotent)
  → upsert FotorankContestParticipant
```

| Propiedad | Estado |
|-----------|--------|
| Idempotencia | Unique `(registrationId, fotoRankContestId)` + `idempotencyKey` |
| Retry | Cron `apps/clickaton/app/api/cron/fotorank-sync` |
| Soft-fail postpago | Pago no se revierte si falla sync |
| Estados | `PENDING` / `PROCESSING` / `SYNCED` / `RETRY_PENDING` / `FAILED` / `MANUAL_REVIEW` / `DISABLED` |

Payload mínimo conceptual (sin PII innecesaria): editionId, registrationId, userId, fotorankContestId, timestamp, integrationVersion.

Docs detalle: `docs/clickaton/CLICKATON_FOTORANK_SYNC.md`.

---

## 5. Consignas → entries

```
1 ClickatonEdition = 1 FotorankContest (maratón)
N ClickatonPrompt  = N slots de entrega
1 prompt × 1 registration → 1 ClickatonPhotoSubmission
                         → 1 FotorankContestEntry (externalPromptId)
```

- Unique CK: `(registrationId, promptId)`
- Unique FR: `(contestId, externalRegistrationId, externalPromptId)`
- Entry FR maratón: `registrationId = null` (no usa inscripción nativa)
- **No** crear 10 concursos FR por consignas

### Cantidad de obras (crítico vs Santa Fe)

| Formato | Regla |
|---------|--------|
| Concurso clásico (Santa Fe) | `maxEntriesPerRegistration = 1` (config FR) |
| Maratón Clickatón | hasta N obras = N consignas con `maxEntries=1` por prompt |

Configurable por concurso/formato — **nunca** hardcodear slug.  
`maxEntries>1` por consigna: campo existe; unique actual lo impide → `PENDING_ORGANIZER_DECISION` si se requiere multi-foto por consigna.

---

## 6. Horarios y secreto

- Timezone canónica operativa: `America/Argentina/Cordoba` (validar por edición).
- Campos por prompt: reveal / submission open-close / status / order.
- Autorización **server-side**; countdown UI no autoriza.
- Antes de `revealAt`: DTO público LOCKED (número + horario) — sin texto/hints/OG leak.
- Implementación: `apps/clickaton/lib/timeline/prompt-dto.ts` + APIs prompts.

---

## 7. Upload / R2 / EXIF

**Actual (híbrido):**

1. Participante sube vía APIs Clickatón por `promptId`.
2. Storage original: path privado Clickatón.
3. EXIF/hash en pipeline CK.
4. `ensureFotorankEntryForPrompt` actualiza entry FR + summary.

**GAP obligatorio a cerrar (técnico):**

- Original canónico en `FotorankContestEntryAsset` / pipeline FR, **o** contrato explícito de lectura jurado desde soft key CK.
- Comentario en código: *“full FR asset path future”* (`apps/clickaton/lib/photo-upload/service.ts`).
- **No** abrir segundo UI de upload nativo FR para la misma maratón.

Checklist EXIF jornada: 🟢 ventana / 🟡 ausente / 🟡 reloj dudoso / 🔴 solo si bases lo permiten — no auto-rechazo irreversible sin política.

---

## 8. Admisión, anonimización, jurado, scoring, ranking

| Pieza | Motor | Notas |
|-------|-------|-------|
| Admisión técnica | FotoRank (+ tech-admission CK orquestando) | No cola completa duplicada en CK |
| Anonimización | Snapshots FR | Jurado sin PII comercial CK |
| Jury | `FotorankJuryEvaluation` | Assignments por consigna configurables |
| Rúbrica Clickatón | Config genérica | Estado `PENDING_ORGANIZER_DECISION` |
| Scoring | FotoRank | Por consigna + global |
| Ranking global | Engine configurable | Modos A–D documentados; **no elegir fórmula** |
| Resultados | Publicación controlada FR | Un solo motor |

---

## 9. UI / panel operativo

- **Participante CK:** tablero consignas (entregada / disponible / bloqueada) consumiendo capacidades FR detrás de escena.
- **Ops CK:** sync health, entregas por consigna, faltantes — **sin** duplicar cola admisión.
- **Super Admin FR:** source platform `CLICKATON`, external event, sync health, entries — sin datos comerciales innecesarios.

---

## 10. Feature flags (independientes)

**Clickatón:** registration, accreditation, prompts, uploads, jury surface, results surface.  
**FotoRank:** contest, admission, jury, results.  
No un único flag global.

---

## 11. Contingencias (acciones admin, no sistema enorme)

| Riesgo | Acción segura |
|--------|----------------|
| API/R2 caída temporal | Retry upload idempotente; no segunda entry |
| Atraso apertura consigna | Extender deadline con audit (antes/después/operador/motivo) |
| Upload iniciado pre-cierre | Política explícita `PENDING_ORGANIZER_DECISION` |
| Sync fallido | `MANUAL_REVIEW` + cron retry; panel ops |
| Reloj local incorrecto | Server clock; EXIF solo señal |

---

## 12. Decisiones humanas — NO inventar

Marcar `PENDING_ORGANIZER_DECISION`:

1. Duración / horario exacto de cada consigna  
2. Ventanas iguales vs distintas  
3. Política de reemplazo  
4. Fórmula ranking global  
5. Rúbrica oficial Clickatón  
6. Mínimo de jurados / desempate  
7. Tolerancia post-deadline / upload in-flight  
8. Ownership final del blob (migración a assets FR)  
9. Vincular concurso FR real a edición 2026 operativa  

---

## 13. Paths canónicos (código)

- Sync: `apps/clickaton/lib/fotorank-sync/**`, cron `app/api/cron/fotorank-sync`
- Upload: `apps/clickaton/lib/photo-upload/**`
- Prompts: `apps/clickaton/lib/timeline/**`
- Schema: `packages/db/prisma/schema.prisma` (`ClickatonEdition`, `ClickatonPrompt`, `ClickatonPhotoSubmission`, `ClickatonFotoRankSync`, `FotorankContestParticipant`, `FotorankContestEntry`)
- Docs previas: `docs/clickaton/CLICKATON_FOTORANK_SYNC.md`, `CLICKATON_PHOTO_UPLOAD_EXIF_GPS.md`, `CLICKATON_TECHNICAL_ADMISSION.md`, `CLICKATON_RANKING_AND_RESULTS.md`

> Nota: `docs/clickaton/FOTORANK_INTEGRATION_CONTRACT.md` (Etapa 05–07) está **parcialmente histórico** respecto del código Etapas 7–13.

---

## 14. Criterio de avance 11C

| Fase | Estado tras auditoría |
|------|------------------------|
| 1 — Cerrar 11B Production | **BLOCKED** — login Google SA real pendiente |
| 2 — Auditoría | **DONE** (este documento + hallazgos) |
| 3 — Contrato | **DONE** (este documento) |
| 4+ — Sync/consignas/upload/E2E | **Reutilizar implementación existente**; cerrar gaps (assets FR, E2E 18, demo) sin duplicar motores |
