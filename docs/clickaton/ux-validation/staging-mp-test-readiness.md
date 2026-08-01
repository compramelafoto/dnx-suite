# Mercado Pago TEST — readiness (post-deploy Imp. 05)

**Comando:** `pnpm --filter clickaton readiness:mp-test`  
**Regla:** no crea pagos ni preferencias; no imprime secretos.

## Post-deploy (URL staging simulada / efectiva)

Con `CLICKATON_PUBLIC_URL=https://clickaton-staging.vercel.app` y target Vercel staging:

```json
{
  "status": "BLOCKED_MISSING_PUBLIC_KEY",
  "blockers": [
    "BLOCKED_MISSING_PUBLIC_KEY",
    "BLOCKED_UNVERIFIED_CREDENTIAL_TYPE",
    "BLOCKED_MISSING_ACCESS_TOKEN",
    "BLOCKED_COLLECTOR_NOT_TEST",
    "BLOCKED_WEBHOOK_CONFIGURATION",
    "BLOCKED_STAGING_OFFER"
  ],
  "origin": "https://clickaton-staging.vercel.app",
  "checks": {
    "publicOrigin": "pass",
    "vercelTarget": "pass",
    "publicKey": "fail",
    "accessToken": "fail",
    "credentialsSource": "fail",
    "cardBrickFlags": "fail",
    "returnUrls": "pass"
  }
}
```

## Componentes

| Componente | Estado post-deploy |
|------------|--------------------|
| Public origin / return URLs | **PASS** (bloqueo de URL productiva resuelto) |
| Public key TEST | Ausente / no verificada |
| Access token TEST | Ausente |
| `MERCADOPAGO_CREDENTIALS_SOURCE` | No verificado como prueba |
| Collector TEST | Ausente |
| Webhook staging | No verificado |
| Flags Brick + oferta | Off / bloqueado |
| Evidencia Brick en navegador | No (readiness ≠ READY) |

## Resultado

`BRICK_STAGING_BLOCKED` — readiness ≠ `READY_FOR_TEST`.  
E2E MP: **BLOCKED** (skipped por gate; no PASS).

## Evidencia pendiente para desbloquear

1. Public key `TEST-…` en staging.  
2. Access token TEST + `MERCADOPAGO_CREDENTIALS_SOURCE=credenciales_de_prueba`.  
3. Collector TEST.  
4. Webhook DNX Payments → staging.  
5. Flags Brick solo TEST.  
6. Smoke Brick sin cobro real (cuando READY).
