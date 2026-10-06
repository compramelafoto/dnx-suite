# Correo a socios — etapa 4: campañas libres, aprobación y métricas

Fecha: 05/10/2026. Sigue a las etapas 1–3 (base de envíos, blog, fechas y saludos).

## Qué se puede hacer

**Comunicación → Campañas**: la institución redacta un correo propio y lo manda a todos o a una parte.

- Redactar: nombre interno, asunto, texto (párrafos; `{nombre}` e `{institucion}`), imagen opcional y
  botón opcional (texto + dirección https).
- A quién: todos los socios activos, o filtrado por **categoría de socio** y/o **especialidad** (si se
  marcan las dos, tiene que cumplir ambas). Se ve cuántos lo recibirían.
- Vista previa, «Enviarme una prueba».
- **Enviar ahora** o **programar** (fecha y hora argentina; sale en la pasada de la tarea programada
  siguiente, cada 10 minutos).
- **Aprobación** (opcional, en Comunicación → Correo): si está encendida, la campaña queda «Esperando
  aprobación» y la tiene que aprobar otra persona con permiso de gestión en Comunicación (no quien la
  escribió). Recién aprobada se envía o queda programada.
- Cancelar una programada (vuelve a borrador). Borrar un borrador.

Estados: `DRAFT` → (`PENDING_APPROVAL`) → `SCHEDULED` → `SENT` (lanzada: se creó el envío). El envío
real reutiliza la base de la etapa 1 (`FotofficeEmailCampaign` kind `CUSTOM`, tanda, baja).

Tema de baja nuevo: `novedades` («Novedades de la institución»).

## Métricas

- Webhook `/api/webhooks/resend`: verifica la firma (Svix: `svix-id`, `svix-timestamp`,
  `svix-signature`, HMAC-SHA256 con el secreto `whsec_…`, tolerancia de 5 minutos) con `node:crypto`,
  sin dependencias nuevas. Secreto en `RESEND_WEBHOOK_SECRET`; sin secreto responde 404.
- Eventos: `email.delivered`, `email.opened`, `email.clicked`, `email.bounced`, `email.complained`. Se
  busca la fila por `resendId` (los correos de otras apps de la misma cuenta de Resend se ignoran).
  Primer evento de cada tipo gana (`deliveredAt`, `openedAt`, `clickedAt`, `bouncedAt`, `complainedAt`).
- Rebote o queja de spam → baja automática de **todo** para esa casilla en esa institución (cuidar la
  reputación del remitente).
- Historial (Correo y Campañas): enviados, entregados, abiertos (%), clics (%), rebotes.
- Requiere configuración en Resend que hace el usuario: crear el webhook apuntando a
  `https://fotoffice.com/api/webhooks/resend`, copiar el secreto a Vercel y activar el seguimiento de
  aperturas y clics en el dominio. Sin eso todo funciona igual, sin métricas.

## Datos

- Tabla `FotofficeMailingMessage` (la campaña redactada).
- `FotofficeEmailDelivery`: `deliveredAt`, `openedAt`, `clickedAt`, `bouncedAt`, `complainedAt` e
  índice por `resendId`.
- `FotofficeEmailCampaign.messageId`; `FotofficeMailingSettings.requireApproval`.

Sólo columnas nullable o con default y una tabla nueva, todas de FOTOFFICE: se aplican antes del merge.

## Fuera de alcance

Segmento por estado de cuota, campañas a no socios, editor visual con bloques, pruebas A/B.
