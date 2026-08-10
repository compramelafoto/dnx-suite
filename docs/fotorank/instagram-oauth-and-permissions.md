# Instagram OAuth y Permisos (17B)

## Flujo

1. Organizador inicia conexión desde **Configuración → Redes sociales**
2. Server genera `state` HMAC (`createOAuthState`)
3. Redirect a Facebook OAuth dialog
4. Callback server-side (`exchangeInstagramOAuthCode`)
5. Token almacenado como `tokenReference` (vault/mock — nunca plaintext en logs)

## Redirect URI

Debe coincidir exactamente con la configurada en Meta App Dashboard.

## State anti-CSRF

Payload firmado: `organizationId:userId:nonce:timestamp` + HMAC-SHA256.  
TTL: 15 minutos. One-time consume.

## Permisos mostrados en UI

| Permiso UI | Scope Meta | Verificado en dev |
|------------|------------|-------------------|
| Publicar contenido | `instagram_content_publish` | mock/E2E |
| Leer métricas | `instagram_basic` + media read | mock/E2E |
| Insights | `instagram_manage_insights` | mock/E2E |
| Webhooks | N/A likes | **false** |

## Token lifecycle

- `tokenReference`: opaco (`mock://` o `vault://`)
- `tokenExpiresAt`: refresh antes de expiración
- Health `EXPIRED` / `REAUTH_REQUIRED` → alerta organizador
- Revocación: `disconnectSocialConnection` (conserva auditoría)

## Seguridad

- No `console.log` de tokens
- `scrubSecrets()` en telemetría
- Super Admin ve expiry sin token plaintext

## Variables de entorno

| Variable | Uso |
|----------|-----|
| `META_APP_ID` | OAuth client id |
| `META_APP_SECRET` | Server exchange (live) |
| `FOTORANK_OAUTH_STATE_SECRET` | HMAC state |
| `FOTORANK_TOKEN_VAULT_KEY` | AES-GCM seal |
| `FOTORANK_INSTAGRAM_MOCK_OAUTH` | Default mock (≠0) |

## LEGAL/PRIVACY REVIEW REQUIRED

Conexión social almacena account IDs, permisos, referencias token. Revisión legal antes de producción comercial.
