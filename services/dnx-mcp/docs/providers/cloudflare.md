# Cloudflare Provider

Provider empresarial de **Cloudflare** para DNX-MCP. Usa la API oficial (Management API) con `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.

## Principios

- API oficial de Cloudflare exclusivamente
- Nunca loguea tokens ni secrets
- Retry exponencial en 429 / 5xx
- Errores tipados (`CloudflareAuthError`, `CloudflareGuardError`, …)
- Mutaciones con `dryRun=true` y `confirm=false` por defecto
- Producción R2 marcada **NO TOCAR**

## Configuración

| Variable                | Descripción                              |
| ----------------------- | ---------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Token Bearer (Account / R2)              |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID                               |
| `R2_ACCESS_KEY_ID`      | Opcional — objetos vía API S3-compatible |
| `R2_SECRET_ACCESS_KEY`  | Opcional — objetos vía API S3-compatible |

El provider está **configurado** cuando hay token + account id.

## Estructura

```
src/providers/cloudflare/
├── provider.ts
├── config.ts
├── errors.ts
├── client/          # HTTP Management + S3 R2
├── services/        # account, buckets, objects, cors, domain
├── helpers/         # guards, staging-bucket, release-readiness
└── types/
```

## API (cuenta)

| Método               | Descripción               |
| -------------------- | ------------------------- |
| `verifyToken()`      | `GET /user/tokens/verify` |
| `getAccount()`       | Cuenta actual             |
| `getAccountHealth()` | Salud consolidada         |

Ver también [cloudflare-r2.md](./cloudflare-r2.md) y [tools](../tools/cloudflare-r2.md).
