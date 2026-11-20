# Bot de WhatsApp: XV y bodas con portfolio, paquetes y pase a ventas (2026-11-20)

Pedido del dueño (aprobado): un circuito propio para las consultas de **XV** (categoría «Fotografía o
Video de Cumpleaños de 15») y de **bodas** (categoría «Boda»). Las demás categorías siguen igual.

## Qué hace

1. **Datos de a una pregunta por mensaje**: nombre y apellido, fecha del evento, salón y localidad,
   horario. Después, si tiene una idea pensada y qué cobertura busca (fotos, video, sesión previa…).
2. **Fecha ocupada**: apenas da la fecha, el bot usa la herramienta nueva `fecha_disponible`.
   - Libre → sigue.
   - «Daniel ya tiene un evento» → el bot dice que ese día el dueño ya tiene un evento, pero que somos
     un equipo y garantizamos la misma calidad, y pregunta si avanzamos igual. Si acepta, sigue; si
     duda o no, `pasar_a_persona`.
   - Fecha completa → `pasar_a_persona` (no se promete nada).
3. **Portfolio temprano**: con la fecha libre (o aceptada), `paquetes_del_evento` le da el enlace del
   portfolio del evento y los paquetes de la propuesta modelo. El bot manda el enlace y pregunta cuál
   le gusta (Básico, Intermedio o Premium). Si el enlace ya salió en el chat (anuncio de XV), no lo repite.
4. **Elige un paquete**: el bot le dice el precio de ESE paquete (el de la propuesta modelo vigente, ya
   aprobado por el dueño) y le ofrece dejarle la cotización con el botón para reservar. Si dice que sí,
   `enviar_cotizacion_del_paquete` da de alta la consulta, arma la cotización con ese paquete y la
   envía sola (sin Telegram) por el camino de siempre (`aprobarYEnviar`: WhatsApp + enlace y correo
   si lo dio).
5. **Personalizado**: si quiere el paquete con agregados o cambios, `preparar_presupuesto` como hoy:
   esa cotización va a aprobación por Telegram.
6. **Pase a ventas**: cuando sale la cotización del paquete o queda pedida la personalizada, el bot
   termina su mensaje con «Te dejo con <nombre>, de nuestro equipo de ventas, que te va a acompañar
   para cerrar todo 😊» y el chat queda **asignado** a la responsable de las consultas nuevas
   (Configuración → Consultas → Avisos). Desde ahí el bot no contesta ese chat y los seguimientos
   automáticos tampoco salen.

## Decisiones (mías, marcadas)

- **[decisión mía] Qué es «Daniel ya tiene un evento ese día»**: la misma definición que el
  semáforo de fechas de Consultas (spec 2026-11-19), que el dueño ya aprobó: un *evento contratado*
  es un pedido no cancelado con esa fecha de evento, o una consulta ganada sin pedido (cobrada por
  fuera). Un presupuesto aceptado genera su pedido, así que queda contado. Las consultas abiertas
  NO ocupan la fecha. Con la capacidad del estudio («eventos por día», DNX cubre dos):
  0 contratados → libre; 1 o más pero menos que la capacidad → «Daniel ya tiene un evento»
  (suponemos que el primero lo cubre el dueño); tantos como la capacidad → fecha completa.
- **[decisión mía] El nombre del dueño y del estudio** en la frase de fecha ocupada salen de la
  base (primer nombre del dueño del workspace y nombre comercial), no escritos en la guía.
- **[decisión mía] Enlaces del portfolio**: no existe un campo de dirección por categoría (el
  «Elegir el portfolio» de Telegram es una lista de fotos para la página del presupuesto). Quedan
  como dato por evento en `lib/bandeja/bot/eventos-con-portfolio.ts` (una tabla: XV y Boda, con el
  patrón que reconoce la categoría), fácil de cambiar y nunca sueltos en la guía.
- **[decisión mía] La cotización del paquete estándar trae SÓLO ese paquete** (los ítems de esa
  opción de la propuesta modelo, sin las otras): es lo que eligió y el precio coincide con el que
  le dijo el bot. Lleva el segundo fotógrafo opcional si corresponde, como hoy (no suma al total).
- **[decisión mía] Precio antes que cotización**: primero el precio y la oferta; la cotización sale
  cuando el cliente dice que sí. El pase a ventas ocurre cuando sale la cotización (paquete) o cuando
  queda pedida la personalizada, no cuando sólo se dijo el precio.
- **[decisión mía] Envío sin Telegram**: se crea la misma fila de aprobación (así queda en el
  historial, el panel «Por aprobar» y los seguimientos de cotización) y se envía con la vía nueva
  `BOT`. Si no sale por ningún canal, la fila queda «Por aprobar» en FOTOFFICE y el bot pasa el chat
  a una persona. Si no se pudo armar, la fila queda en FALLO (no frena otra cotización).
- **[decisión mía] Quién recibe el chat**: la responsable de los ajustes de Consultas si sigue
  pudiendo serlo; si no hay, el dueño (como el aviso de consulta nueva). Con el dueño la frase no
  dice «de nuestro equipo de ventas». El «aviso habitual» es el de la consulta nueva (la tarea
  «Responder consulta» que ya crea el alta para la responsable) más el chat asignado en la Bandeja.
- **Seguimientos**: ya respetan al asignado. El recordatorio de pago y el seguimiento de consulta
  sólo salen si `atiendeElBot` (un chat asignado nunca lo es) y el seguimiento de cotización no sale
  si el chat está en HUMANO. Se agregan pruebas que lo fijan.
- **Sin columnas nuevas**: todo entra en lo que ya existe (`approvedVia` es texto libre).

## Dónde

- Puro: `lib/bandeja/bot/eventos-con-portfolio.ts` (qué categoría es evento con portfolio, estado de
  la fecha, qué paquete, textos del pase) y `soloLaAlternativa` en `lib/presupuestos/alternativas.ts`.
- Servidor: `lib/bandeja/bot/eventos-con-portfolio-servidor.ts` (paquetes, fecha, vendedora),
  `enviarPaqueteEstandar` en `lib/presupuesto-automatico/flujo.ts`, el paquete en
  `prepararDesdeWhatsapp` y `asignarAVentas` en `lib/bandeja/bot/envio-bot.ts`.
- Bot: herramientas nuevas en `herramientas.ts`, el pase en `responder.ts` y el bloque
  «XV Y BODAS» en `guia.ts`.
