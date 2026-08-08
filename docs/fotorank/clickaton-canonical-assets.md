# Clickatón → FotoRank — ownership canónico de assets

**Fecha:** 2026-08-08  
**Estado:** implementado detrás de feature flag (OFF por defecto)

## Objetivo

FotoRank es SoT de:

- original
- `FotorankContestEntryAsset`
- keys `fotorank/contests/...`
- checksum / EXIF metadata
- derivados (thumbnail / jury)

Clickatón orquesta UX + gates de consigna; dual-write legado CK queda para rollback.

## Flags (AND estricto)

```bash
# Clickatón (env global — puede estar ON sin afectar comercial)
CLICKATON_FOTORANK_CANONICAL_ASSETS=1
FOTORANK_INTERNAL_ASSET_SECRET=<mismo secreto ≥16 chars>
FOTORANK_INTERNAL_ASSET_BASE_URL=https://fotorank.com

# FotoRank
FOTORANK_INTERNAL_ASSET_SECRET=<mismo>
```

**Más** config por edición:

`ClickatonEditionUploadConfig.canonicalAssetsEnabled` (default `false`)

Canonical path solo si:

`env === "1"` **AND** `uploadConfig.canonicalAssetsEnabled === true`

La edición comercial permanece `false`. Marker ops: `ClickatonEdition.isOpsFixture`.

## Flujo

1. CK `processPromptUpload` → storage CK (legado)
2. `ensureFotorankEntryForPrompt`
3. Si flag ON → `POST /api/internal/clickaton/canonical-entry-asset` → `persistCanonicalEntryOriginal`
4. Entry FR: `activeAssetId` + `technicalSummaryJson.assetOwner=FOTORANK`

## Seguridad

- Auth Bearer secreto compartido
- Solo entries existentes; no crea concurso
- No PII en keys
- No altera Santa Fe nativo (`processUploadedFile` intacto)

## Rollback

1. Apagar `CLICKATON_FOTORANK_CANONICAL_ASSETS`
2. Redeploy Clickatón
3. Assets FR ya creados quedan; lectura legacy CK sigue disponible vía `legacyStorageKey`
