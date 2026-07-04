# Email Marketing - ComprameLaFoto

Módulo de campañas masivas segmentadas por rol (PHOTOGRAPHER / LAB / CLIENT) con editor HTML, envío vía Resend, cola de envíos, métricas y cumplimiento (unsubscribe).

## Acceso

- **Admin**: `/admin/email-marketing`
- Solo usuarios con rol `ADMIN` pueden acceder.

## Estados de campaña

| Estado      | Descripción                           |
|-------------|----------------------------------------|
| DRAFT       | Borrador, editable                     |
| SCHEDULED   | Programada (futuro)                     |
| SENDING     | En cola, enviándose                     |
| SENT        | Completada                              |
| PAUSED      | Pausada, editable                       |
| CANCELED    | Cancelada                               |

## Crear campaña

1. **Datos básicos**: name (interno), subject, previewText, fromName, fromEmail.
2. **Audiencia**: roles (PHOTOGRAPHER, LAB, CLIENT), filtros opcionales (country, province, createdAt, lastLoginAt, hasOrders, isVerifiedEmail).
3. **Contenido**: editor HTML con variables.

## Variables en plantilla

- `{{firstName}}`, `{{lastName}}`, `{{email}}`
- `{{workspaceName}}` (companyName o "ComprameLaFoto")
- `{{role}}`, `{{referralCode}}`
- `{{unsubscribeUrl}}` (se inserta automáticamente; footer estándar si no existe)

## Flujo de envío

1. **Preview destinatarios**: muestra count + sample de 20.
2. **Enviar test**: envía a emails ingresados manualmente (máx. 10).
3. **Enviar campaña**: confirma y encola todos los destinatarios elegibles.
4. **Cron worker**: `/api/cron/process-email-campaigns` corre cada 2 min, procesa N envíos (configurable vía `EMAIL_CAMPAIGN_RATE_LIMIT`, default 15).
5. Se envían solo a usuarios con `marketingOptIn=true` y `unsubscribedAt=null`.

## Unsubscribe

- Link en emails: `{{unsubscribeUrl}}` → `https://compramelafoto.com/unsubscribe?token=...`
- Página: `/unsubscribe` (GET con token en query).
- API: `POST /api/unsubscribe?token=...` o `GET /api/unsubscribe?token=...`
- Marca `unsubscribedAt` en User; futuras campañas excluyen al usuario.

## Seed de tokens

Usuarios con `marketingOptIn=true` necesitan `unsubscribeToken` para el link. Si faltan, al encolar la campaña se generan. Para pregenerar en batch:

```bash
npx tsx scripts/seed-unsubscribe-tokens.ts
```

## Configuración

| Variable                 | Descripción                             |
|--------------------------|-----------------------------------------|
| `RESEND_API_KEY`         | API key de Resend (obligatorio)         |
| `EMAIL_FROM_NAME`        | Nombre por defecto "From"               |
| `EMAIL_FROM`             | Email por defecto "From"                |
| `NEXT_PUBLIC_APP_URL`    | URL base para links unsubscribe         |
| `EMAIL_CAMPAIGN_RATE_LIMIT` | Emails por ejecución cron (default: 15) |
| `CRON_SECRET`            | Header `Authorization: Bearer X` para cron (opcional) |

## Límites

- Máximo 50.000 destinatarios por campaña.
- Máx. 10 emails para envío de prueba.

## Cron (Vercel)

En `vercel.json`:

```json
{"path":"/api/cron/process-email-campaigns","schedule":"*/2 * * * *"}
```

Cada 2 minutos procesa la cola de envíos.
