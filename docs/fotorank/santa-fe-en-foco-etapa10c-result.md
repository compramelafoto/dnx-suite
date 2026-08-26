# Santa Fe en Foco — ETAPA 10C — Resultado

**Fecha:** 2026-08-06  
**Veredicto:** PARTIAL  
**Deployment productivo:** `dpl_2ZErbfBwZ2jQpLX8UdW6bkQxMcuP`  
**Rollback L2 (previo estable 10B):** `dpl_Bn4Qj9MbKf5WUPy2wgLDi5pBPDdb`

## Objetivo

Endurecer email (`PHOTO_RECEIVED` / `PHOTO_REPLACEMENT_RECEIVED`), reemplazo y admisión E2E sin cerrar inscripción ni upload.

## Entregado

### Idempotencia email
- Tabla `FotorankTransactionalEmailOutbox` (migración aditiva aplicada en prod).
- Clave canónica: `PHOTO_RECEIVED:<entryId>:<assetVersion>` / `PHOTO_REPLACEMENT_RECEIVED:<entryId>:<assetVersion>`.
- SENT solo tras respuesta Resend OK + `providerMessageId`.
- Selfcheck concurrencia: PASS (`email-idempotency.selfcheck.ts`).

### Reemplazo
- Asset anterior retenido `isActive=false` (delete físico solo con `FOTORANK_DELETE_REPLACED_ASSETS=1`).
- Reset de `ADMITTED` al reemplazar → `PENDING_MANUAL_REVIEW`.
- Email diferenciado por `assetVersion > 1`.

### Checklist / participante
- `AdmissionChecklistView` con conteos 🟢/🟡/🔴 y resultado global.
- Copy público en `/participaciones` vía `resolvePublicEntryStatus`.

### E2E producción (parcial)
- PASS: checklist, admitir, rechazar, evidencia, permitir reemplazo (CTA), estados públicos, privacidad, jurado OFF, resultados OFF, landing/inscripción ON (10/12 en slice 03–12).
- FAIL: upload JPEG A + confirm (wizard queda en “Estamos verificando el archivo” — POST upload/process no completa E2E).
- FAIL derivado: reemplazo E2E completo (depende del upload).

### Cleanup
- `ops-sfef-10c-cleanup-fixtures.ts` apply: residual users/entries/assets/outbox = 0.

### Selfchecks
- entries.selfcheck PASS (top-level await envuelto en `main()`).
- email idempotency, upload-window flag, admission, privacy, R2 guard, eligibility: PASS.
- typecheck PASS; lint focalizado PASS.

## No cerrado (queda PARTIAL)

1. Upload/confirm E2E productivo no estabilizado (timeout en verificación de archivo).
2. Email real SENT no verificado (sin confirmación de obra en E2E).
3. Reemplazo punta a punta no validado E2E.

## Rollback

- L1: `SFEF_ALLOW_PRODUCTION_UPLOAD_CLOSE=1` + `ops-sfef-10-close-upload-production.ts`
- L2: re-alias `dpl_Bn4Qj9MbKf5WUPy2wgLDi5pBPDdb`
- Upload e inscripción permanecen ON tras 10C.

## Worktree

`/tmp/fotorank-etapa10c-wt` branch `feat/sfef-etapa10c`
