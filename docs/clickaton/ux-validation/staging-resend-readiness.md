# Resend staging — readiness (post-deploy Imp. 05)

**Comando:** `pnpm --filter clickaton readiness:resend-staging`  
**Regla:** no envía correos; no imprime API keys.

## Post-deploy

Con origen staging:

```json
{
  "status": "BLOCKED_NO_DRY_RUN",
  "blockers": [
    "BLOCKED_NO_DRY_RUN",
    "BLOCKED_NO_ALLOWLIST",
    "BLOCKED_NO_RESEND_API_KEY",
    "BLOCKED_NO_WEBHOOK"
  ],
  "origin": "https://clickaton-staging.vercel.app"
}
```

El bloqueo por audiencia productiva (`BLOCKED_PRODUCTION_AUDIENCE`) **ya no aplica** cuando el host público es staging.

## Checks

| Ítem | Estado |
|------|--------|
| Origen staging | PASS |
| Dry-run | BLOCKED |
| Allowlist | BLOCKED |
| API key staging-safe | BLOCKED (ausente en entorno de readiness local) |
| Sender | no ejercido |
| Webhook | BLOCKED |
| Envío real | no realizado |

## Resultado

`RESEND_STAGING_BLOCKED` — ≠ `READY_FOR_SAFE_TEST`.  
E2E Resend: **BLOCKED** (skipped; no PASS).
