# Bandeja de WhatsApp: filtros, buscador, derivar, mejoras operativas y Telegram

Fecha: 24/11/2026 · Pedido y aprobación de Daniel en charla · Workspace piloto: DNX Estudio (`cmv5z6qxwwmmhf0q5gp8qja1j`)

## 1. Para qué

En la Bandeja trabajan cuatro personas: Sabina, Camila, Giuli y Daniel, además del bot. Hoy los filtros mezclan cosas distintas («Míos», «Sin asignar», «Atiende el bot»). No se le puede pasar un chat a otra persona: sólo existe «Tomar» para uno mismo. Tampoco se ve de qué campaña llegó cada cliente. Daniel quiere:

- ver **todos** los chats y filtrar por separado **quién atiende** (sin asignar, bot o cada persona), **campaña**, canal y estado;
- **derivar** un chat a otra persona o al bot;
- buscar **por palabra** dentro de los mensajes;
- una pantalla más cómoda (lista y chat a la vez);
- las cuatro mejoras operativas recomendadas: respuestas rápidas, notas internas, tiempo de espera y aviso al derivar;
- que los chats **asignados a él** le lleguen por **Telegram**, con un resumen para entender de qué se trata, y poder **responderle al cliente y derivar desde ahí**.

Éxito: nadie tiene que preguntar «¿quién agarra este?». Cada persona encuentra sus chats y los de una campaña en un toque, y Daniel atiende sus chats desde el celular sin abrir FOTOFFICE.

## 2. No es / anti-objetivos

- No cambia la lógica del bot ni cuándo contesta. Sólo se agrega «derivar al bot» como acción explícita, equivalente a «Devolver al bot».
- No hay modo conversación en Telegram (descartado por Daniel). Cada respuesta va **citando** un mensaje, así nunca le llega al cliente equivocado.
- Fracaso aunque funcione: que una respuesta escrita en Telegram le llegue a otro cliente; que el bot o el cliente lean una nota interna; que Telegram le saque un chat a Sabina sin que Daniel lo decida; que la lista se vuelva lenta (hoy tiene un tope de 200 chats).

## 3. Cómo se eligió

**Telegram, responder:**
- **A. Responder citando (elegida).** Cada mensaje del cliente reenviado a Telegram queda atado a su chat. Al citarlo, la respuesta va a ese chat y a ningún otro.
- B. Modo conversación: más cómodo, pero si uno se olvida de cambiar de chat, la respuesta le llega a otra persona. Ya pasó un error así en WhatsApp Web. Descartada.

**Qué bot de Telegram usar:** el de la institución, `@Dnxestuio_ventas_bot` (tabla `FotofficeTelegramConexion`), que ya está vinculado al chat privado de Daniel y hoy aprueba cotizaciones. El bot de agentes (`telegram-agentes`) es global de Super Admin y no sirve para un workspace. No se crea un bot nuevo.

**Nombre de la campaña:**
- **Preguntárselo a Meta una vez por anuncio y guardarlo (elegida).**
- Cargar a mano la relación anuncio → campaña: descartada, porque se olvida y queda vieja.
- Usar el título del anuncio: no sirve. De 128 chats que llegaron por anuncios, 99 dicen «Chatea con nosotros».

**Orden:** cuatro etapas. Cada una sale a producción sola:
1. filtros, buscador, derivar y pantalla nueva;
2. respuestas rápidas, notas internas, tiempo de espera y aviso al derivar (con el resumen);
3. Telegram;
4. campañas.

La campaña va última porque depende de un permiso en Meta (§9).

## 4. Cómo funciona hoy (lo que se toca)

- `lib/bandeja/lecturas.ts`: `FILTROS_BANDEJA = todos|bot|mios|sin-asignar|resueltos` (un solo eje), `FILTROS_CANAL`. Búsqueda `q` sólo por nombre del perfil, número, @usuario o cliente vinculado. Tope `MAXIMO_CHATS = 200`.
- `lib/bandeja/reglas.ts` (puro): `atiendeElBot`, `alTomar`, `alDevolver`, `alResolver`, `alResponderDesdePanel` (responder desde el panel toma el chat). `lib/bandeja/acciones.ts`: `transicion()` con candado de fila y mensaje SISTEMA; `responder()` con `clientToken`, ventana de 24 h y envío por canal.
- Permisos: `lib/bandeja/acceso.ts` (`ver` = Ver, `operar` = Gestionar sobre `whatsapp-inbox`).
- Pantallas: `app/(shell)/bandeja/page.tsx` (lista) y `app/(shell)/bandeja/[chatId]/page.tsx` (chat), que son páginas separadas. Componentes en `components/bandeja/`.
- Anuncio: `lib/bandeja/anuncio.ts`. El webhook guarda `referral` en `FotofficeWaMensaje.media.anuncio` (id, título, texto, `ctwaClid`). El chat no tiene una columna con su anuncio.
- Telegram: `lib/telegram/{api,webhook,conexion}.ts`. `leerUpdate` ya reconoce `START`, `BOTON` y `RESPUESTA` (texto que cita un mensaje del bot). El webhook de la institución (`app/api/webhooks/telegram/[conexionId]/route.ts`) hoy **ignora** `RESPUESTA`. Los botones de aprobar cotización usan `aprobacionDelBoton(data)`.
- Historial del bot (`lib/bandeja/bot/historial.ts`): salta todo mensaje con `direccion === "SISTEMA"`, pero usa un SISTEMA con «como resuelto» como corte.

## 5. Etapa 1: filtros, buscador, derivar y pantalla

### 5.1 Filtros (ejes independientes, en la URL)

| Parámetro | Valores | Significado |
|---|---|---|
| `quien` | `todos` (omisión) · `sin-asignar` · `bot` · `<userId>` | **Bot** = `atiendeElBot(chat)`. **Sin asignar** = sin persona asignada y no lo atiende el bot (derivado «a persona» sin nombre, bot pausado o número excluido). **`<userId>`** = `asignadoUserId`. |
| `canal` | `todos` · `WHATSAPP` · `INSTAGRAM` | igual que hoy |
| `estado` | `abiertos` (omisión) · `esperando` · `resueltos` | **Esperando** = abiertos cuyo último mensaje real es del cliente (§6.3), **incluidos los que atiende el bot** (así se ven los que el bot no pudo contestar, por ejemplo con el tope de gasto agotado), ordenados del que más espera al que menos. **Resueltos + persona** = los que resolvió esa persona (columna nueva `resueltoPorUserId`, §5.3). |
| `campana` | `todas` · `<campaignId>` · `sin-anuncio` | etapa 4 |
| `q` | texto | §5.2 |

- La lista de personas de `quien` sale de quienes hoy tienen nivel Ver o más en `whatsapp-inbox` en el workspace (dueño, admins y roles con ese módulo), con el nombre de `etiquetaDeUsuario`. Al lado de cada nombre va su contador de chats abiertos.
- «Míos» desaparece. Para ver lo propio se elige el propio nombre, que va primero y dice «(vos)».
- Un enlace viejo con `?filtro=mios|bot|sin-asignar|resueltos` se traduce a los parámetros nuevos para no romper favoritos.
- Se ve como fila de «chips» por eje en escritorio y como desplegables en el celular. Cada chip activo se puede quitar (×), y hay un botón «Limpiar filtros».

### 5.2 Buscador por palabra

- Un solo cuadro: «Buscar nombre, número o palabra…».
- Además de lo de hoy, busca `q` dentro de `FotofficeWaMensaje.texto` (sin distinguir mayúsculas ni tildes si la base lo permite; si no, sólo sin distinguir mayúsculas) de los mensajes ENTRANTE y SALIENTE del workspace, y también en las notas internas de la etapa 2 (las ve todo el que ve la Bandeja). Nunca en los SISTEMA automáticos.
- El resultado es la lista de chats que coinciden, con el fragmento del mensaje encontrado (±40 caracteres, la palabra resaltada) en lugar de la vista previa.
- Mínimo 2 caracteres y tope de 80 (como hoy). Se combina con los demás filtros.
- Rendimiento: si hace falta, índice trigram (`pg_trgm`) sobre `texto`. Decide quien construye después de medir. Hoy son unos miles de mensajes.

### 5.3 Derivar

- En el encabezado del chat, botón **«Derivar a…»** con un menú: cada persona con **Gestionar** en `whatsapp-inbox` (no sólo Ver) y **«Bot»** al final. «Tomar» queda como atajo para uno mismo.
- Regla pura nueva en `reglas.ts`: `alDerivar(chat, destino, quien)`.
  - A una persona: `estado = HUMANO`, `asignadoUserId = destino`. SISTEMA: «Sabina se lo derivó a Camila».
  - Al bot: lo mismo que `alDevolver`. SISTEMA: «Sabina se lo derivó al bot».
  - Derivar a quien ya lo tiene: no hace nada.
  - En un chat con `botExcluido`, «Bot» aparece deshabilitado y explica por qué.
- Acción `derivar(ctx, chatId, destino)` con `transicion()`. El servidor valida que el destino tenga Gestionar en el módulo en **este** workspace.
- Un chat RESUELTO también se puede derivar: queda abierto y asignado.
- Resolver (panel o Telegram) guarda además `resueltoPorUserId` en el chat; `alResolver` sigue dejando `asignadoUserId = null` (no se toca cuándo vuelve a contestar el bot). Reabrir lo borra. Migración de la etapa 1. *(Decisión de diseño de Claude.)*

### 5.4 Pantalla nueva (estilo WhatsApp Web)

- En escritorio (≥ lg) van dos columnas: la **lista** a la izquierda (~24 rem, con los filtros arriba) y el **chat** a la derecha. Al cambiar de chat se conservan los filtros (van en la URL de ambas rutas).
- En el celular, una pantalla por vez, como hoy. «← Volver» vuelve a la lista con los mismos filtros.
- Fila de la lista: ícono de canal, nombre, hora, vista previa o fragmento, no leídos, **chip de quién atiende** (Bot / nombre / Sin asignar), **chip de campaña** (etapa 4) y **tiempo de espera** (etapa 2).
- Chat: encabezado fijo con nombre, número, chip de estado, «Derivar a…», «Resolver» y el menú ⋯ («Que el bot no atienda nunca este número», «Volver a activarlo»). Conversación con alto completo y desplazamiento propio. **Caja de respuesta siempre visible abajo**, con la plantilla como pestaña al lado cuando la ventana de 24 h está cerrada. El panel del cliente va a la derecha en pantallas anchas; en las medianas, plegable.
- Se mantienen: el refresco periódico (lista 10 s, chat 5 s), `MarcarLeido`, la miniatura de archivos y «Verificar comprobante».
- Estilo: los tokens `--fo-*` y las clases `fo-*` existentes. Nada de colores sueltos, salvo los del canal, que ya existen.
- Next: esta versión tiene cambios de API (ver `AGENTS.md`). Cómo compartir la lista entre `/bandeja` y `/bandeja/[chatId]` (layout con componente de cliente que lee `useSearchParams`, o la lista renderizada en las dos páginas) lo decide quien construye después de leer la guía de `node_modules/next/dist/docs/`. Condición: los layouts no reciben `searchParams`.

## 6. Etapa 2: mejoras operativas

### 6.1 Respuestas rápidas

- Tabla nueva `FotofficeWaRespuestaRapida` {id, workspaceId, atajo (ej. `carnet`, único por workspace, minúsculas, sin espacios, ≤ 30), titulo (≤ 60), texto (≤ 4096), orden, activa, timestamps}.
- Se administran en Configuración → WhatsApp → «Respuestas rápidas» (dueño y admins: `configurar`).
- En la caja de respuesta, escribir `/` al principio abre una lista filtrable por atajo o título. También hay un botón ⚡ con la misma lista. Elegir **inserta** el texto en la caja (no lo envía) para poder retocarlo. Variable `{nombre}` = primer nombre del cliente o del perfil (vacío si no hay).
- Arranque: vacía. Daniel o el equipo las cargan.

### 6.2 Notas internas

- Se guardan como `FotofficeWaMensaje` con una **dirección propia `direccion = "NOTA"`** (autor `USUARIO`, `autorUserId`, `autorLabel`), no como SISTEMA: así ningún proceso automático que lee SISTEMA (corte «como resuelto» y pausas de 24 h de `historial.ts`, `recordatorio-anuncio.ts`, `recordatorio-pago-servidor.ts`, `comprobante/auto-decision.ts`) las toma por marcas. **Hay que** revisar todo lugar que filtra por `direccion` (historial del bot, vista previa, `noLeidos`, envío a Meta, resumen de la etapa 2, búsqueda) para que una NOTA sólo aparezca donde se la quiere: la conversación del panel, la búsqueda y el resumen. Una nota no cuenta como respuesta al cliente (no frena recordatorios ni el tiempo de espera). *(Decisión de diseño de Claude.)*
- Se escriben desde la caja de respuesta con una pestaña **«Nota interna»**: fondo amarillo y aviso «Sólo la ve el equipo». Pide Gestionar.
- Se ven como burbuja amarilla centrada con autor y hora. No mueven `ultimoMensajeEn` del chat.

### 6.3 Tiempo de espera

- Un chat abierto **espera respuesta** si su último mensaje real (sin SISTEMA ni NOTA) es ENTRANTE. Desde: `ultimoEntranteEn`. Se calcula con las columnas existentes. Si hace falta precisión, se agrega `ultimoSalienteEn` al chat, con migración y relleno desde los mensajes; decide quien construye.
- En la lista y en el encabezado del chat se ve «espera hace 12 min»: gris hasta 15 min, ámbar de 15 a 60 min y rojo después.
- Cuenta sólo si el chat no lo atiende el bot. Si lo atiende el bot, no se muestra.
- El filtro `estado=esperando` los ordena del que más espera al que menos.

### 6.4 Aviso al derivar y resumen

- **Resumen:** al derivar a una persona, se arma en segundo plano (`after()`) un resumen de 3 a 5 líneas: qué pide el cliente, qué se le respondió, qué falta y montos o fechas mencionados. Se usa Claude con el mismo cliente y modelo de configuración que el bot (`lib/bandeja/bot/`) y un tope bajo de tokens. Entran los últimos 40 mensajes reales y las notas. Se guarda en columnas nuevas del chat: `resumen` (≤ 800) y `resumenEn`.
- Se muestra arriba de la conversación como tarjeta plegable «Resumen (hace 3 min) · Actualizar». Actualizar vuelve a generarlo a pedido.
- Si falla o se agotó el tope de gasto del bot, no hay resumen y no se rompe nada.
- Cuenta en el tope mensual de gasto del bot (`lib/bandeja/bot/uso.ts`).
- **Aviso en FOTOFFICE:**
  - En el menú, el ítem «Bandeja de WhatsApp» muestra, además del total sin leer, un punto con la cantidad de chats **derivados a mí que todavía no abrí**. Columna nueva del chat `derivadoSinVerUserId` (o equivalente): se pone al derivar y se borra cuando esa persona abre el chat.
  - En la lista, esos chats llevan la marca «Nuevo para vos».

## 7. Etapa 3: Telegram para los chats asignados a Daniel

### 7.1 A quién le llega

- La persona de FOTOFFICE dueña del chat de Telegram es `connectedByUserId` (ya existe: quien conectó el bot). Si hace falta separarla, columna `userId Int?` con ese valor por omisión. Para DNX se verifica que sea el usuario 4 (Daniel) y si no se corrige a mano.
- Sólo los chats con `asignadoUserId = conexion.userId` usan Telegram. Una sola persona por workspace, que es lo que hay hoy.
- Interruptor en Configuración → Telegram: «Mandarme por Telegram los chats de la Bandeja asignados a mí» (columna `bandejaActiva Boolean @default(true)` en `FotofficeTelegramConexion`).

### 7.2 Qué le llega

1. **Al quedar asignado a Daniel por otra persona o por derivación** (no cuando Daniel lo toma él mismo desde el panel), una tarjeta:
   ```
   📥 Sabina te derivó un chat
   María López · WhatsApp · Campaña XV Noviembre
   Resumen: quiere cotización de XV para el 14/2, 120 invitados; ya se le pasó el paquete Oro ($850.000); pregunta si incluye video.
   Últimos mensajes:
   👤 ¿Incluye video?
   🏢 (Sabina) Te consulto y te digo
   ⏱ Espera hace 8 min · ventana de 24 h abierta hasta 15:40
   ```
   Botones: **[Derivar ▸]** **[Resolver]** **[Abrir en FOTOFFICE]** (URL).
2. **Cada mensaje nuevo del cliente** mientras el chat siga asignado a Daniel: `💬 María López: <texto>`. Para un archivo: `📷 María López mandó una foto` y el botón «Abrir» (no se reenvía el archivo; queda para después). Los mismos botones.
3. **Respuesta enviada:** después de mandar lo que escribió Daniel, el bot contesta citándolo «✅ Enviado a María López», o «⚠️ No se pudo enviar: <motivo de `MENSAJES_BANDEJA`>».

### 7.3 Responder citando

- Cada mensaje que el bot manda a Telegram por la Bandeja se registra en una tabla nueva `FotofficeWaTelegramAviso` {id, workspaceId, conexionId, chatId (FotofficeWaChat), telegramMessageId, createdAt}, con `@@unique([conexionId, telegramMessageId])`.
- El webhook de la institución pasa a aceptar `RESPUESTA`. Si `respondeA` está en esa tabla y el mensaje viene del chat vinculado (`chatId` y `deId` = `conexion.chatId`), se llama a `responder()` con un contexto armado para `conexion.userId`: su rol y su acceso reales (`resolverAcceso`) y `clientToken` = `tg-<conexionId>-<message_id de Telegram>`, que hace que un reintento de Telegram no mande dos veces.
- Si `respondeA` no está en la tabla (por ejemplo, cita una cotización), se ignora como hoy.
- **Si el chat ahora lo atiende otra persona:** no se envía. Se contesta «Ahora lo atiende Camila. ¿Lo tomás y lo mando?» con el botón **[Tomarlo y enviar]**. El texto pendiente se guarda en la propia fila del aviso (`textoPendiente`, ≤ 4096, se borra al usarlo o a las 24 h).
- **Si el chat lo atiende el bot o no tiene asignado:** se envía y el chat queda tomado por Daniel, igual que responder desde el panel (`alResponderDesdePanel`).
- **Fuera de la ventana de 24 h:** no se envía. Se contesta con el mensaje de `MENSAJES_BANDEJA.fueraDeVentana` y el botón «Abrir en FOTOFFICE» para usar una plantilla.
- Sólo texto. Una foto, un audio o un sticker de Daniel en Telegram se contesta con «Por ahora desde Telegram sólo se puede mandar texto».
- Cambios en `leerUpdate` (`lib/telegram/webhook.ts`): el tope de `RESPUESTA` sube a 4096 (hoy corta en silencio a 2000; el canal de agentes puede seguir recortando del lado suyo); una cita que no es texto vuelve como tipo nuevo `RESPUESTA_NO_TEXTO` (en vez de `OTRO`); un texto citado que empieza con `/` se acepta para la Bandeja.

### 7.4 Botones

- `callback_data` ≤ 64 bytes, con prefijo propio para no chocar con las aprobaciones: `bj:dv:<chatId>` abre el submenú de derivar, `bj:d:<chatId>:<userId|bot>` deriva, `bj:r:<chatId>` resuelve y `bj:t:<avisoId>` es «Tomarlo y enviar».
- El submenú reemplaza los botones del mismo mensaje (`cambiarBotones`) por una fila por persona con Gestionar y «Bot», más «← Volver».
- Mismas validaciones que el panel, con el contexto de `conexion.userId`. Derivar o resolver desde Telegram escribe el SISTEMA igual que en el panel («Daniel se lo derivó a Sabina»).
- Al derivarlo a otra persona, dejan de llegar mensajes de ese chat a Telegram.
- Toda acción contesta el botón (`contestarBoton`) con el resultado.

### 7.5 Envío

- Disparadores: (a) la acción de derivar o asignar cuando el destino es `conexion.userId` y quien deriva es otra persona o el sistema; (b) el registro de un ENTRANTE en el webhook de WhatsApp o Instagram cuando el chat está asignado a `conexion.userId`.
- Se manda en `after()` y nunca frena la Bandeja ni el webhook. Si falla, se registra en consola sin texto ni teléfono.
- La tarjeta del punto 1 espera el resumen hasta 8 s. Si no llega, sale sin resumen y no se reenvía después.

## 8. Etapa 4: campañas

- Tabla nueva `FotofficeMetaAnuncio` {workspaceId, adId, adName, adsetName, campaignId, campaignName, consultadoEn, error}, con `@@unique([workspaceId, adId])`.
- `FotofficeWaChat` gana `anuncioId String?`: el anuncio del **primer** mensaje del chat que trajo `referral` (si después llega otro anuncio, se cambia al más reciente; decisión de quien construye, recomendado el más reciente). El webhook lo completa. Hay que rellenarlo para los chats existentes desde `media.anuncio.id`.
- Consulta a Meta: `GET /{adId}?fields=name,adset{name},campaign{id,name}` con el token de WhatsApp del baúl del workspace. Se hace una vez por anuncio nuevo, en `after()` del webhook. Hay un reintento diario (cron existente o uno nuevo) para los que fallaron, como máximo 7 días.
- Si Meta no responde o falta permiso, el chip muestra el título del anuncio y «(sin campaña)», y en el filtro queda agrupado bajo «Anuncio <título>».
- Filtro `campana`: desplegable con las campañas que tienen chats en los últimos 90 días, ordenadas por cantidad, más «Sin anuncio».
- Requiere que el usuario del sistema FOTOFFICE tenga `ads_read` sobre la cuenta publicitaria de DNX Estudio. Si no lo tiene, se le pasan a Daniel los pasos (§9).

## 9. Lo que depende de Daniel

- Etapa 4: darle al usuario del sistema «FOTOFFICE» acceso de lectura a la cuenta publicitaria en Meta Business. Si ya lo tiene, no hace falta nada.
- Cargar respuestas rápidas (opcional, desde Configuración).

## 10. Migraciones (una por etapa, aplicadas en producción según la autorización del 26/10)

- Etapa 1: `FotofficeWaChat.resueltoPorUserId` y posiblemente un índice para la búsqueda.
- Etapa 2: `FotofficeWaRespuestaRapida`; columnas del chat `resumen`, `resumenEn`, `derivadoSinVerUserId` (y `ultimoSalienteEn` si hace falta).
- Etapa 3: `FotofficeTelegramConexion.bandejaActiva` (y `userId` si se separa de `connectedByUserId`), `FotofficeWaTelegramAviso`.
- Etapa 4: `FotofficeMetaAnuncio`, `FotofficeWaChat.anuncioId` y el relleno.

## 11. Pruebas

- Reglas puras (`alDerivar`, espera y quién atiende para el filtro) con casos de borde: número excluido, RESUELTO, pausa vencida.
- Lecturas: filtros combinados y búsqueda en la base en memoria. Ojo: esa base no imita el NULL de SQL en `NOT`/`in`/`notIn`, así que hay que probar el `where` de «Sin asignar» con SQL real o evitar `NOT` con columnas nulas.
- Telegram:
  - responder citando con un aviso conocido;
  - cita desconocida;
  - otro chat de Telegram;
  - reintento con el mismo `message_id`;
  - chat de otra persona → «Tomarlo y enviar»;
  - fuera de ventana;
  - botones con datos inventados o de otro workspace.
- Notas: el bot no las ve, no cuentan como no leídos, no se envían, no cortan el historial y no frenan recordatorios.

## 12. Queda a criterio de quien construye

- Cómo compartir la lista entre las dos rutas (§5.4).
- Si hace falta el índice trigram y la columna `ultimoSalienteEn`.
- Si el chat toma el primer o el último anuncio (recomendado: el último).
- Textos finos de pantalla, siguiendo el tono existente (castellano rioplatense, corto).
