# Tools MCP — Cloudflare / R2

Registradas vía `registerCloudflareTools`.

Defaults seguros: **`dryRun=true`**, **`confirm=false`**. Mutaciones requieren `dryRun: false` + `confirm: true`.

## Lectura

| Tool                 | Descripción                                               |
| -------------------- | --------------------------------------------------------- |
| `cloudflare_status`  | Token, account health, buckets                            |
| `r2_bucket_list`     | Lista buckets                                             |
| `r2_bucket_validate` | Valida naming/existencia/CORS/dominio                     |
| `r2_staging_plan`    | Plan staging por `platformId` (catalog + prepare dry-run) |

## Mutables

| Tool                        | Descripción                        |
| --------------------------- | ---------------------------------- |
| `r2_bucket_create`          | Crear bucket (bloquea prod)        |
| `r2_bucket_delete`          | Eliminar bucket (bloquea prod)     |
| `r2_cors_update`            | Actualizar CORS                    |
| `r2_public_domain_enable`   | Habilitar r2.dev managed           |
| `r2_object_upload`          | Upload objeto (credenciales S3 R2) |
| `r2_object_delete`          | Delete objeto                      |
| `r2_prepare_staging_bucket` | Auditar/crear staging              |

## Ejemplo seguro (plan staging)

```json
{
  "platformId": "compramelafoto",
  "dryRun": true
}
```

Tool: `r2_staging_plan` — no crea recursos.
