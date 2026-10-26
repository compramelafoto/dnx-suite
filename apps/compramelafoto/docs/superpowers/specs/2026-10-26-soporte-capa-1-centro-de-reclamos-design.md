# Centro de reclamos con diagnóstico automático (soporte, capa 1) — diseño

Fecha: 2026-10-26 · Plataforma: CompraMeLaFoto (CLF) · Pedido por Daniel.

## Para qué y por qué

Daniel quiere que el soporte de CLF se resuelva lo más posible solo y poder ver qué pasó con cada
caso. Hoy `/admin/soporte` es una tabla de tickets sin contexto: para entender cada uno hay que
revisar a mano pedidos, pagos y álbumes, y los compradores invitados (sin cuenta) no tienen cómo
contestar una respuesta del equipo.

El DNX Bot ya es la primera línea: entre el 12/10 y el 26/10 tuvo 496 conversaciones (463 de
compradores y 33 de fotógrafos). De esas, 335 fueron un solo toque en una pregunta sugerida, 147
fueron charlas reales y 14 se derivaron a ticket. Los tickets son lo que el bot no pudo resolver.

Esta es la **capa 1** de un plan de tres:
1. **Capa 1 (este documento):** diagnóstico automático, tablero por columnas y la ida y vuelta con
   el cliente a través del bot.
2. Capa 2 (más adelante): una rutina nocturna que toma los tickets marcados como "probable error de
   código", investiga y abre un PR para que Daniel lo apruebe.
3. Capa 3 (más adelante): un informe diario.

**Éxito:** Daniel abre `/admin/soporte`, ve de un vistazo qué está atrasado, entiende cada caso
sin salir de la ficha y lo contesta con un clic. Los clientes pueden seguir la conversación y
cerrar el caso ellos mismos.

## Objetivos

1. **Resumen del bot** arriba de `/admin/soporte`: cuántas consultas atendió el bot, cuántas
   resolvió solo y cuántas pasaron a ticket, separado entre compradores y fotógrafos. Las
   conversaciones de un solo toque **solo se cuentan**, no se listan.
2. **Pestaña "Conversaciones resueltas por el bot":** la lista de conversaciones que **no** terminaron
   en ticket y en las que la persona escribió al menos dos veces. Cada una se abre y se lee completa:
   qué preguntó, qué contestó el bot y qué acciones hizo.
3. **Tablero por columnas (embudo)**, con fichas que se arrastran entre columnas:
   **Nuevo → En curso → Esperando al cliente → Resuelto**.
4. **Vencimiento de 24 horas corridas** (incluye noches y fines de semana) desde que llega el
   ticket o desde la última respuesta del cliente. La ficha es verde, después amarilla y, pasado
   el plazo, roja.
5. **Diagnóstico automático** en cada ticket nuevo: tipo de caso, qué se encontró en los datos,
   una respuesta sugerida y acciones preparadas.
6. **Ficha completa** del ticket con la conversación previa con el bot, el diagnóstico, las acciones
   preparadas (con casilla para tildar), la respuesta editable y los botones **"Enviar y aplicar
   acciones"** y **"Solo enviar respuesta"**.
7. **Ida y vuelta por la ventana del DNX Bot** (ver "Cómo sigue la conversación con el cliente").
8. **Aviso por Telegram** cuando un cliente responde o pide hablar con una persona.

## Fuera de alcance

- Arreglar código automáticamente (capa 2) y el informe diario (capa 3).
- Responder por mail con "Responder" de Gmail. Se descartó a favor del link a la ventana del bot,
  así no hace falta configurar la recepción de mails en el dominio.
- Mover dinero: devoluciones, marcar pagos como cobrados o tocar montos de pedidos. El diagnóstico
  puede **informar** sobre pagos, pero no actuar sobre ellos.
- Inventar acciones nuevas: el diagnóstico solo propone acciones que el bot ya sabe hacer.
- Que la respuesta salga sin que Daniel la revise. En esta etapa, **todo envío lo aprieta una
  persona**. La única excepción es que el cliente cierre su propio caso desde el bot.

## Lo que haría que esto falle aunque funcione

- Que el cliente crea que está chateando con una persona y quede esperando. El bot **siempre se
  presenta como bot**.
- Que el bot prometa algo que no controla, como "ya te contesto" o una hora exacta. Esta regla ya
  existe en el DNX Bot y se mantiene.
- Que el tablero tape lo importante con ruido. Por eso las conversaciones de un solo toque no se
  listan.
- Que el link del mail deje ver casos o pedidos de otra persona.
- Que una acción se ejecute dos veces por un doble clic o por un reintento.

## Cómo funciona

### 1. Llega un ticket

Los tickets entran por el bot (`lib/bot/escalamiento.ts` → `escalateToHuman`) o por los formularios
de soporte de cada panel (`POST /api/support/tickets`). En los dos casos:

- La ficha nace en **Nuevo** y el reloj de 24 horas arranca.
- Se lanza el **diagnóstico** en segundo plano. El cliente no espera: su ticket se crea igual,
  aunque el diagnóstico falle o tarde.
- El ticket queda **vinculado a su conversación con el bot** cuando la hay
  (`BotConversation.supportTicketId` ya existe).

### 2. El diagnóstico

Un pedido a la IA, con el mismo modelo y la misma configuración que el DNX Bot
(`CLF_BOT_MODEL`, hoy Sonnet 5.5), con:

- **Entrada:** motivo, descripción, rol de quien consulta, la conversación con el bot si la hubo y
  los identificadores que se puedan reconocer: álbum, pedido y usuario.
- **Herramientas de solo lectura** sobre los datos de esa persona: álbum, pedidos, estado de los
  pagos, conexión con Mercado Pago, packs, preventa escolar y descargas. Se reutilizan las
  herramientas de lectura del bot (`lib/bot/herramientas/lectura.ts`,
  `lib/bot/comprador/herramientas/lectura.ts`), con el alcance del dueño del ticket y no el de un
  administrador.
- **Salida estructurada**, que se guarda:
  - `categoria`: una de *falta información al bot*, *se aclara con datos*, *probable error de
    código*, *operativo (requiere a una persona)* u *otro*.
  - `resumen`: una línea para la ficha.
  - `hallazgos`: qué se encontró en los datos, en lenguaje simple y con montos en pesos.
  - `respuestaSugerida`: el texto para el cliente, en el tono del bot.
  - `accionesSugeridas`: una lista de acciones del catálogo existente del bot, con sus datos
    (por ejemplo `reenviar_descarga`, `reenviar_link_pack`, `reenviar_link_de_descarga`,
    `extender_vencimiento`, `cambiar_venta_de_foto`, `editar_pack`).
  - `confianza`: alta, media o baja.
- Si el diagnóstico falla, la ficha muestra "No se pudo diagnosticar" y un botón **"Volver a
  diagnosticar"**. Ese botón también sirve después de que el caso cambió.
- El costo de cada diagnóstico **se suma al tope mensual del bot** (USD 30, `lib/bot/tope.ts`).
  Si se llegó al tope, no se diagnostica y la ficha lo dice. Costo estimado: USD 0,05 a 0,20 por
  ticket.
- Al publicar esto, se diagnostican también los tickets que ya están abiertos (hoy son 14).

### 3. El tablero `/admin/soporte`

- Arriba, el **resumen del bot**, con período seleccionable (por defecto, los últimos 15 días).
  Definiciones:
  - *Un solo toque:* conversación donde la persona escribió una sola vez.
  - *Resuelta por el bot:* conversación que no terminó en ticket. Incluye las de un solo toque.
  - *Pasó a ticket:* conversación con estado `ESCALATED`.
  - "Mensaje escrito por la persona" es un mensaje `role=user` cuyo contenido es texto. Los
    `tool_result` también se guardan con `role=user` y **no cuentan**.
- Dos pestañas: **Tablero de reclamos** y **Conversaciones resueltas por el bot**.
- Las columnas corresponden a estos estados:

  | Columna | Estado |
  |---|---|
  | Nuevo | `OPEN` |
  | En curso | `IN_PROGRESS` |
  | Esperando al cliente | **nuevo estado** `WAITING_CUSTOMER` |
  | Resuelto | `RESOLVED` (y `CLOSED` de los tickets viejos se muestra acá) |

- **Ficha resumida:** número, motivo, título corto, la línea del diagnóstico, quién consulta
  (comprador o fotógrafo), si vino del bot, el reloj y una marca "el cliente respondió" cuando
  corresponda.
- **Arrastrar** cambia el estado al instante y vuelve atrás si el servidor lo rechaza. Es el mismo
  patrón que el tablero En curso de FOTOFFICE, con `@dnd-kit/core`, que ya está en las
  dependencias de CLF.
- **Reloj:** vence 24 horas corridas después de `slaDesde`, que es la llegada del ticket o la
  última respuesta del cliente. Verde si faltan más de 6 horas, amarillo si faltan 6 o menos, rojo
  si ya venció. En "Esperando al cliente" y "Resuelto" el reloj no corre.
- La columna Resuelto muestra lo de los últimos 30 días, con un enlace a "ver todos".
- El boceto aprobado es el de esta sesión de diseño: resumen arriba, pestañas, cuatro columnas y
  la ficha abierta con el diagnóstico.

### 4. Responder desde la ficha

- La respuesta sugerida se puede editar. Las acciones preparadas tienen una casilla cada una y
  vienen tildadas o no según lo que propuso el diagnóstico.
- **"Enviar y aplicar acciones"** ejecuta las acciones tildadas con la misma maquinaria de acciones
  del bot (`BotAction`, con `before` y `after`) y después envía la respuesta. **"Solo enviar
  respuesta"** no ejecuta nada.
- Si una acción falla, la respuesta **no sale** y la ficha muestra qué falló, para que Daniel
  decida si la envía igual.
- Al enviar, el mensaje se guarda en el ticket (`SupportMessage`), se manda el mail y la ficha
  pasa sola a **Esperando al cliente**.
- Cada envío lleva una clave única para que un doble clic no mande ni ejecute nada dos veces.

### 5. Cómo sigue la conversación con el cliente

- **El mail** (se adapta `emails/templates/support-reply.ts`) incluye la respuesta completa y un
  botón **"Responder"**. Si con eso se resolvió, el cliente no necesita entrar a ningún lado.
- **El botón abre la ventana del DNX Bot**: en la página del álbum o en `/ayuda` si es un
  comprador, y en su panel si es un fotógrafo. La ventana muestra la conversación del caso: lo que
  habló antes con el bot, la respuesta del equipo (firmada "Daniel · equipo CompraMeLaFoto") y un
  espacio para seguir escribiendo.
- **El link identifica a la persona para ese caso y nada más.** Es un token largo y al azar, de un
  solo ticket, que vence a los 30 días. No le pide el código de 6 números. Solo da acceso a ese
  ticket y a los pedidos de ese mismo mail, lo mismo que vería alguien verificado. Si el token
  venció, la ventana le ofrece verificarse con el código por mail, como hoy.
- **El bot responde siempre, al instante, y se presenta como bot.** Contesta con lo que ya se sabe
  del caso: el diagnóstico, la respuesta del equipo y las acciones aplicadas. También puede usar
  sus herramientas habituales.
- **Termina preguntando "¿Se solucionó tu problema?"**
  - **Sí** → el bot cierra el caso solo: la ficha pasa a **Resuelto** y queda anotado "Cerrado por
    el cliente desde el bot".
  - **No, o algo que el bot no puede resolver** → la ficha vuelve a **En curso** con la marca "el
    cliente respondió" y el reloj arranca de nuevo. Le llega un aviso a Daniel por Telegram y el
    bot le dice al cliente, con honestidad, que se lo pasa al equipo y que le van a responder por
    mail.
- Todo lo que el cliente escribe en esa ventana queda también como mensaje del ticket, para que la
  ficha tenga la historia completa.
- **Si el cliente no contesta**, a los 3 días en "Esperando al cliente" la ficha pasa sola a
  Resuelto. Si después escribe, se vuelve a abrir en En curso.

### 6. Avisos

Se usa Telegram, por el canal que ya existe (`@Dnxbot_avisos_bot`, `sendTelegramMessage`). Se avisa
cuando el cliente responde que no se solucionó, cuando pide una persona y cuando una ficha pasa a
roja. Este último aviso sale una sola vez por ficha y por vencimiento.

## Restricciones

- **El schema es compartido:** `packages/db/prisma/schema.prisma` se aplica en varias bases. Las
  migraciones se aplican y se registran a mano en todas, siguiendo la práctica de las migraciones
  del DNX Bot. Los cambios tienen que ser aditivos: el estado `WAITING_CUSTOMER` y las columnas o
  tablas nuevas.
- **No hay entorno de prueba útil para CLF:** las previews de Vercel no sirven. Todo nace detrás de
  una variable de entorno (`CLF_SUPPORT_DIAG_ENABLED`, por ejemplo) y se enciende en producción.
- Los textos van en español rioplatense, con la hora argentina y los montos en pesos (`totalCents`
  de CLF son pesos).
- Las tareas periódicas (pasar a Resuelto a los 3 días y avisar fichas vencidas) se resuelven con el
  cron de Vercel que ya usa CLF.

## Seguridad, permisos y estados (precisiones tras la revisión)

**Fotógrafos y el link del mail.** El token **no reemplaza a la sesión** de un fotógrafo, porque
su bot tiene herramientas que modifican datos. El botón "Responder" lleva al panel. Si el fotógrafo
no tiene la sesión iniciada, primero inicia sesión y después cae en la ventana del bot con el caso
abierto. En ese caso el token solo sirve para ubicar el caso y tiene que corresponder al usuario
que inició sesión. Para los **compradores**, que en general no tienen cuenta, el token sí los
identifica, pero solo dentro de ese caso y con las herramientas del bot de compradores.

**Acciones aplicadas desde la ficha.** La aprobación de Daniel, como administrador, reemplaza la
confirmación del dueño. Las acciones corren en el servidor **en nombre del admin** sobre los datos
del dueño del ticket y quedan registradas en `BotAction` con el admin como autor, el ticket de
origen, `before` y `after`. Esto vale también para las acciones de solo lectura que envían algo,
como reenviar una descarga. El dueño se identifica por `requesterEmail`: para un fotógrafo, el
`User` con ese mail; para un comprador, los pedidos de ese mail. Todo envío al cliente (links y
descargas) va **siempre al mail que figura en el pedido**, nunca a otro. Los límites por
conversación del bot (`LIMITES_ACCIONES`) no se aplican al admin. Sí se aplica la clave única
contra el doble envío.

**Compradores con el mail sin verificar.** El diagnóstico **puede leer** los pedidos de ese mail,
porque solo los ve Daniel. En ese caso, la ficha y el diagnóstico muestran una advertencia
visible: "Mail sin verificar: estos pedidos podrían no ser de quien consulta". Como el mail de
respuesta y los envíos van al mail del pedido, quien escribió un mail ajeno no recibe nada. El
diagnóstico nunca pone datos de los pedidos (montos, nombres, links) en la respuesta sugerida si
el mail no está verificado. En ese caso propone primero pedirle que se verifique.

**Estados: todas las entradas del cliente cuentan igual.** El cliente puede responder desde la
ventana del bot (con el link) o desde "Soporte" en su panel, como hoy. Las dos entradas tienen el
mismo efecto:
- Si el cliente escribe y el bot no lo resuelve, la ficha pasa a **En curso**, se marca "el
  cliente respondió", el reloj arranca de nuevo y llega el aviso por Telegram.
- Si el bot contesta y la persona sigue charlando sin decir "sí" ni "no", la ficha **se queda en
  Esperando al cliente** con la marca "el cliente escribió" y sin reloj. Si el bot no puede
  resolver algo, la pasa a En curso.
- **Un caso Resuelto se puede reabrir:** si el cliente vuelve a escribir, desde el bot o desde el
  panel, pasa a En curso. Por eso se levanta el bloqueo actual (`isTicketClosedForUserReply`) para
  `RESOLVED`. `CLOSED` sigue bloqueado y queda para cierres definitivos que haga el admin.
- El mail de respuesta reemplaza el texto "le aparece en Soporte" por el botón "Responder".

## Decisiones de diseño tomadas por Claude (Daniel puede cambiarlas)

- Los fotógrafos tienen que iniciar sesión para responder. Los compradores entran con el link.
- Las acciones corren en nombre del admin y los envíos van siempre al mail del pedido.
- Con el mail sin verificar, el diagnóstico lee los pedidos con una advertencia, pero no pone sus
  datos en la respuesta.
- Un caso Resuelto se reabre si el cliente vuelve a escribir.

- Los nombres y los estados de las columnas, y el nuevo estado `WAITING_CUSTOMER`.
- Amarillo cuando faltan 6 horas o menos para vencer.
- Los links vencen a los 30 días. Los casos pasan solos a Resuelto a los 3 días sin respuesta.
- El costo del diagnóstico se descuenta del mismo tope de USD 30 del bot.
- Se diagnostican los 14 tickets abiertos al encenderlo.
- Las conversaciones "resueltas" se definen como "no terminaron en ticket", porque el bot no puede
  saber si la persona quedó conforme.

## Lo que queda a criterio de quien lo construya

- El modelo de datos exacto del diagnóstico (tabla propia o columnas en `SupportTicket`) y del token.
- Cómo se lanza el diagnóstico en segundo plano (`after()` de Next u otro mecanismo), siempre que
  la creación del ticket no espere y que un reintento no lo duplique.
- El texto exacto del prompt del diagnóstico. Tiene que respetar las reglas del bot: nunca prometer
  lo que no controla y nunca inventar rutas.
- Cómo la ventana del bot reconoce el token y carga la conversación del caso.
- El diseño visual fino. La referencia es el boceto aprobado.
