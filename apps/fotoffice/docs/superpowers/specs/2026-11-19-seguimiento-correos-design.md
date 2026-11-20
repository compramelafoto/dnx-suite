# Seguimiento de correos a clientes y consultas (diseño corto)

Fecha: 19/11/2026. Daniel quiere saber si un correo que se le mandó a un cliente fue abierto, si el
cliente hizo clic o si el correo rebotó.

## Antes

- Resend ya avisaba a `/api/webhooks/resend` cuando un correo se entregaba, se abría, recibía un clic,
  rebotaba o lo marcaban como spam.
- FOTOFFICE sólo guardaba esos avisos para las campañas a socios (`FotofficeEmailDelivery`). Los
  correos de consultas, cotizaciones, contratos y pedidos (`FotofficeMessage`, que guarda el
  `providerId` de Resend) se descartaban.
- El dominio `mail.fotoffice.com` no tenía encendido el seguimiento de aperturas y clics. En 60 días
  hubo 0 aperturas y 0 clics.

## Qué se hizo

- **Resend (19/11, con el sí de Daniel):**
  - Se encendió el seguimiento de aperturas y de clics en `mail.fotoffice.com`, con el subdominio
    `links.mail.fotoffice.com`.
  - En DonWeb se agregó el CNAME `links.mail.fotoffice.com` → `links2.resend-dns.com`.
- **Base:**
  - Columnas nuevas en `FotofficeMessage`: `deliveredAt`, `openedAt`, `clickedAt`, `bouncedAt` y
    `complainedAt`.
  - Índice nuevo sobre `providerId`.
  - Migración `20270215090000_fotoffice_mensajes_seguimiento_correo`, aplicada y registrada en la base
    de FOTOFFICE, que es la única que tiene la tabla.
- **Webhook:**
  - Primero mira si el aviso es de una campaña; si no, de un `FotofficeMessage`; si tampoco, del
    agente Vendedor.
  - Se guarda la primera vez de cada aviso.
  - Si rebota o lo marcan como spam un correo de una consulta o de su cotización, el responsable
    recibe la tarea «Correo rebotado: conseguí otra dirección». Hay una sola abierta por consulta.
- **Pantalla:** cada correo del historial de la consulta, de la ficha del cliente y de la ficha del
  pedido muestra sus avisos: «Entregado 15/11 21:39», «Abierto…», «Hizo clic…» y, en rojo, «Rebotó…».

## Aclaración que se le dio a Daniel

La apertura puede aparecer sola en algunos programas de correo, como Apple Mail, que abren las
imágenes automáticamente. El clic es la señal segura.
