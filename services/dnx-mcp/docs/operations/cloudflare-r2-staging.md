# Operaciones — Cloudflare R2 Staging (ComprameLaFoto)

## Catalog

| Campo                    | Valor                                |
| ------------------------ | ------------------------------------ |
| productionBucket         | `compramelafoto-prod` (**NO TOCAR**) |
| stagingBucket            | `compramelafoto-staging`             |
| productionProtected      | `true`                               |
| stagingOperationsAllowed | `true`                               |
| expectedPublicUrl        | `https://assets.compramelafoto.com`  |
| smokeTestObjectKey       | `smoke/health-check.txt`             |

## Flujo seguro (sin crear recursos)

1. Verificar token/cuenta: `cloudflare_status` con `dryRun: true` (preview) o `false` (lectura).
2. Planificar staging:

```json
{ "platformId": "compramelafoto", "dryRun": true }
```

Tool: **`r2_staging_plan`**

3. Preparar en dry-run:

```json
{
  "platformId": "compramelafoto",
  "bucketName": "compramelafoto-staging",
  "dryRun": true,
  "confirm": false
}
```

Tool: **`r2_prepare_staging_bucket`**

## Crear bucket (solo cuando se decida)

```json
{
  "platformId": "compramelafoto",
  "bucketName": "compramelafoto-staging",
  "dryRun": false,
  "confirm": true
}
```

Nunca usar nombres con `prod` / `production`. Nunca operar sobre `compramelafoto-prod` desde este flujo.

## Release Orchestrator

`release_prepare` / `release_validate` reportan bloque `cloudflare`:

- `configured`, `bucketExists`, `bucketName`, `corsReady`, `publicDomainReady`
- `riskLevel`, `blockers`, `warnings`
- Ausencia de staging **bloquea QA de fotos** (`assetsRequired`)
- Plataformas sin R2 (p.ej. cuantocobro) **no** se bloquean por Cloudflare
- `execute` no hard-bloquea por R2 (módulos sin assets)
