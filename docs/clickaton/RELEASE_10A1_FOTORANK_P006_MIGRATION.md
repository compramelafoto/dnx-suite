# RELEASE 10A.1 — FotoRank P0-06 migración segura

**Migración:** `20260728140000_fotorank_p0_06_entry_upload_exif_checklist`  
**Fecha remediación:** 2026-07-28

## Riesgo original

- `DROP COLUMN "bucket"` / `"byteSize"` — pérdida irreversible de datos legacy.
- Rewrite de unique `(entryId, kind)` → `(entryId, versionNumber, kind)`.
- Múltiples ALTER en `FotorankContestEntry` / `EntryAsset` (lock potencial).

## Estrategia (expand → migrate → contract)

### Expand (este release — aplicado en SQL)

1. Agregar columnas nuevas (`storageBucket`, `fileSizeBytes`, `versionNumber`, …) con `IF NOT EXISTS`.
2. **No** DROP de `bucket` / `byteSize`.
3. Backfill idempotente: `storageBucket = COALESCE(storageBucket, bucket)`, `fileSizeBytes = COALESCE(fileSizeBytes, byteSize)`.
4. Crear índices/tablas nuevas (metadata/check/review).
5. Reemplazar unique index de kind (índice, no columnas de datos).

### Migrate (validación)

```sql
-- Conteos
SELECT COUNT(*) FILTER (WHERE "bucket" IS NOT NULL AND "storageBucket" IS NULL) AS missing_bucket_copy
FROM "FotorankContestEntryAsset";
SELECT COUNT(*) FILTER (WHERE "byteSize" IS NOT NULL AND "fileSizeBytes" IS NULL) AS missing_size_copy
FROM "FotorankContestEntryAsset";
```

Criterio GO para contract: ambos = 0 y app lee solo columnas nuevas.

### Contract (migración futura — NO en 10A.1)

Solo después de validación en staging con datos reales:

```sql
-- futura: 20YYMMDDHHMMSS_fotorank_p0_06_contract_drop_legacy_asset_cols
ALTER TABLE "FotorankContestEntryAsset" DROP COLUMN IF EXISTS "bucket";
ALTER TABLE "FotorankContestEntryAsset" DROP COLUMN IF EXISTS "byteSize";
```

## Rollback lógico

- Expand es aditivo: rollback = ignorar columnas nuevas (Prisma usa nombres nuevos).
- No restaurar unique antiguo sin análisis de duplicados por version.
- Contract DROP: solo reversible desde backup.

## Criterio futuro DROP

- [ ] Backfill 100%
- [ ] Código sin referencias a `bucket`/`byteSize`
- [ ] Staging OK ≥ 1 ciclo de upload
- [ ] Backup verificado
