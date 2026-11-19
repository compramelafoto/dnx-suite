# Bandeja: enviar plantillas aprobadas de Meta (diseño corto)

Fecha: 18/11/2026. Daniel eligió «Elegir las de Meta» en la conversación.

## Para qué

Pasadas 24 horas desde el último mensaje del cliente, WhatsApp sólo deja escribirle con una plantilla
aprobada. En DNX Estudio 98 de 160 chats estaban fuera de esa ventana y la caja de respuesta quedaba
bloqueada, sin ninguna salida. Giuli, la vendedora, no podía retomar a quien dejó de contestar.

## Qué se hace

- La pantalla del chat de WhatsApp muestra «Enviar una plantilla aprobada». Fuera de las 24 h aparece
  abierto; dentro de la ventana, cerrado.
- La lista sale de Meta (`GET /{waba}/message_templates?status=APPROVED`) y se guarda en memoria 5 minutos.
  Quedan afuera las que FOTOFFICE todavía no sabe completar:
  - encabezado con imagen, video, documento o variable;
  - variables con nombre;
  - botones de código o de formulario.
- Las variables vienen propuestas:
  - {{1}} es el nombre de pila;
  - en `retomar_consulta` y `seguimiento_cotizacion`, el evento de la última consulta del cliente;
  - en `recordatorio_entrevista`, el día y la hora de su próxima cita.

  La persona las puede corregir. La vista previa muestra lo que va a llegar y un aviso según la
  categoría (Meta cobra cada envío; marketing es lo más caro).
- El envío es igual que `responder`:
  - toma el chat;
  - guarda el mensaje PENDIENTE de tipo PLANTILLA con el texto armado;
  - llama a Meta fuera de la transacción;
  - se puede reintentar sin mandar dos veces (`clientToken`).

## Enfoques

1. **Leer las plantillas aprobadas de Meta (elegido).** Se crean en el Administrador de WhatsApp.
2. Crearlas desde FOTOFFICE y mandarlas a aprobar: más trabajo y Meta igual tarda. Queda para más adelante.

## Plantillas creadas en Meta el 18/11 (en revisión)

- `retomar_consulta` (marketing)
- `coordinar_entrevista` (marketing, con un botón a /w/dnx-estudio/turnos)
- `recordatorio_entrevista` (utilidad)

Sin cambios de base.
