# Cloudflare R2

Módulo R2 del Cloudflare Provider. Buckets / CORS / dominios usan Management API. Objetos usan la API S3-compatible oficial de Cloudflare R2 (requiere Access Key + Secret de R2).

## Buckets

| Método                        | Mutación | Notas                              |
| ----------------------------- | -------- | ---------------------------------- |
| `listBuckets()`               | no       |                                    |
| `getBucket(name)`             | no       |                                    |
| `bucketExists(name)`          | no       |                                    |
| `createBucket(name, options)` | sí       | `dryRun`/`confirm`; bloquea `prod` |
| `deleteBucket(name, confirm)` | sí       | Producción bloqueada               |
| `getBucketUsage(name)`        | no       |                                    |
| `validateBucket(name)`        | no       | Naming + existencia                |

## Objetos

Requieren `R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`.

| Método                               | Mutación |
| ------------------------------------ | -------- |
| `listObjects(bucket, prefix?)`       | no       |
| `objectExists` / `headObject`        | no       |
| `uploadObject(..., confirm, dryRun)` | sí       |
| `deleteObject(..., confirm, dryRun)` | sí       |

## CORS y dominio público

| Método                                                           | Mutación          |
| ---------------------------------------------------------------- | ----------------- |
| `getCors` / `updateCors`                                         | update sí         |
| `getPublicDomain` / `enablePublicDomain` / `disablePublicDomain` | enable/disable sí |

## Helper `prepareStagingBucket`

```ts
await provider.prepareStagingBucket({
  platformId: "compramelafoto",
  bucketName: "compramelafoto-staging",
  dryRun: true,
  confirm: false,
});
```

Reglas:

- `bucketName` debe terminar en `-staging`
- Bloquea nombres con `prod` / `production`
- Crea solo con `confirm=true` y `dryRun=false`
- Status: `READY` | `BLOCKED` | `ACTION_REQUIRED`
- Nunca modifica buckets existentes sin confirm explícito en tools dedicadas

## Helper / tool `r2_prepare_application`

Prepara R2 para una aplicación (staging/preview) a partir de `platformId` del catalog.

```ts
await provider.prepareApplication({
  platformId: "compramelafoto",
  dryRun: true,
  confirm: false,
  loadEnvToVercelPreview: false,
});
```

MCP tool: `r2_prepare_application`

Flujo:

1. Resuelve `r2.stagingBucket` del catalog (nunca production)
2. Verifica que el bucket staging exista
3. Reutiliza `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` del env MCP, o intenta crear Access Key S3 scoped al bucket (User Token API)
4. Valida endpoint `https://{accountId}.r2.cloudflarestorage.com`
5. Genera variables `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_BUCKET_NAME`, `R2_REGION`
6. Audita faltantes en Vercel Preview (`vercelProject` del catalog); con `loadEnvToVercelPreview:true` crea solo target `preview` (nunca production)
7. Smoke upload + download + cleanup de un objeto `smoke/dnx-mcp-prepare-*.txt`
8. Devuelve `READY` solo si bucket + credenciales + endpoint + smoke OK

Defaults seguros: `dryRun=true`, `confirm=false`, `loadEnvToVercelPreview=false`.

Si el token CF no puede crear User Tokens (403), el resultado queda en `ACTION_REQUIRED` con instrucciones de Dashboard — no rompe el flujo ni toca prod.

## Guards

- Staging: `*-staging`
- Producción: `*-prod`, `*production*`, etc. → solo lectura / NO TOCAR
- Mutaciones: `dryRun` o `confirm`
