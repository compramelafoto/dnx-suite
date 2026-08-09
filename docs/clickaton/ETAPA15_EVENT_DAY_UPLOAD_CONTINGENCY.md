# ETAPA 15 — Contingencias día del evento (uploads)

Edición de referencia: `1er-clickaton` / `cmrvq7liy0000l904s25767xe`.

## Activación comercial (NO automática)

| Flag | Scope | Valor go-live |
|------|-------|----------------|
| `ClickatonEditionUploadConfig.uploadsEnabled` | **solo esta edición** | `true` |
| `ClickatonEditionUploadConfig.canonicalAssetsEnabled` | edición | decisión aparte |
| `CLICKATON_FOTORANK_CANONICAL_ASSETS` | env global | `1` solo si canonical ON |
| JURY / RESULTS | — | OFF |

Kill switch: `uploadsEnabled=false` (no apaga reveal ni consignas).

## Contingencia Internet

| Caso | Comportamiento actual | Decisión |
|------|----------------------|----------|
| Sin Internet en captura | Foto puede tomarse offline; EXIF valida captura | OK técnico |
| Upload cortado mid-stream | Reintento: nuevo `processPromptUpload` si ventana OPEN | Retry permitido |
| Request antes del cierre, process después | **Rechazo** `UPLOAD_WINDOW_CLOSED` (sin grace) | **PENDING_ORGANIZER_DECISION** |
| Retry después del cierre | Bloqueado server-side | Extender ventana o política grace |

## Contingencia deadline

Acción admin: **Extender ventana de carga** (`extendUploadWindowAction`).

Registra en auditoría:

- `previousUploadWindowEndsAt`
- `nextUploadWindowEndsAt`
- `minutes`
- `reason`
- `actorUserId`
- `timestamp`

## Contingencia reveal

- **Reveal de emergencia:** `emergencyRevealAction` (motivo obligatorio). No prende `uploadsEnabled`.
- **Rollback a LOCKED:** `rollbackRevealToLockedAction` (solo emergencia; no borra submissions).

Reveal normal: `eventRevealAt` automático + `globalPromptReveal=true`.

## Canonical assets — GO / NO-GO

- Path legacy CK funciona con `canonicalAssetsEnabled=false`.
- FR SoT exige env AND edición.
- **NO-GO canonical en go-live inicial** salvo prueba staging previa del endpoint interno.
- **GO uploads legacy** con FotoRank entry + checklist (flujo ya validado en Modo Test).

## Rollback deploy

Redeploy CK anterior en Vercel; flags DB no se revierten solos — verificar `uploadsEnabled` tras rollback.
