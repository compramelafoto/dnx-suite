# Mensajes directos de Instagram en la Bandeja y el bot — diseño

Fecha: 18/11/2026 · Workspace piloto: DNX Estudio (`cmv5z6qxwwmmhf0q5gp8qja1j`, slug `dnx-estudio`)

## 1. Para qué

DNX Estudio suma una vendedora (Giuli) que atiende las consultas desde la Bandeja de WhatsApp de
FOTOFFICE. Muchas consultas llegan por Instagram (@dnxestudio: anuncios «clic a Direct» y mensajes
directos) y hoy no entran al sistema: se pierden o se cargan a mano. Queremos que un mensaje directo
de Instagram entre a la misma Bandeja, que el bot lo atienda y que, si es un evento, quede cargado
como consulta con origen «Instagram».

**Listo significa:** un mensaje directo de prueba a @dnxestudio aparece en la Bandeja, el bot lo
contesta y la consulta queda cargada en DNX Estudio con origen «Instagram».

## 2. Objetivos, no-objetivos, anti-objetivos

- **Objetivos**
  - Los chats de Instagram se ven en la Bandeja junto a los de WhatsApp, con su ícono, y se pueden
    filtrar por canal. Tomar / Devolver al bot, el estado, la asignación y los no leídos andan igual.
  - El bot contesta por Instagram con la misma guía (precios, catálogo, datos del estudio, cursos).
  - **Decisión de Daniel (18/11):** una consulta de evento que llega por Instagram **pasa a
    WhatsApp**: el bot pide el WhatsApp del cliente, se carga la consulta con ese teléfono y origen
    «Instagram», y la cotización aprobada (Telegram, como hoy) le llega por WhatsApp.
  - Si Giuli contesta desde la app de Instagram, el bot se calla en ese chat (como el eco del celular).
  - Si el chat vino de un anuncio «clic a Direct», el bot lo sabe (igual que `anuncio.ts` en WhatsApp).
- **No-objetivos (por ahora)**
  - Comentarios de publicaciones, menciones en historias como chats aparte, Messenger de Facebook.
  - Vender copias, impresiones o fotolibros por Instagram: el bot invita a seguir por WhatsApp (ver §5.4).
  - Seguimientos automáticos por Instagram (no hay plantillas; los hace WhatsApp con el teléfono).
- **Anti-objetivos**
  - Que un mensaje de Instagram se pierda en silencio o quede duplicado.
  - Que el bot conteste a un chat que una persona ya tomó desde la app de Instagram.
  - Que se rompa algo de WhatsApp (es el canal que hoy vende).

## 3. Restricciones de Meta

- Se usa **la misma app** «FOTOFFICE DNX Estudio» (2188321802064982), camino **«API de Instagram con
  inicio de sesión de Facebook»** (Messenger Platform para Instagram): la página «DNX Estudio»
  (340720999117999) ya está vinculada a @dnxestudio (17841411698803966) y el usuario del sistema
  FOTOFFICE ya existe. El otro camino («con inicio de sesión de Instagram») exige otra app.
- Permisos: `instagram_basic`, `instagram_manage_messages`, `pages_manage_metadata`,
  `pages_show_list` (+ `business_management`, que ya tiene).
- **Acceso estándar vs avanzado:** sin revisión de la app, sólo llegan los mensajes de personas con
  rol en la app (Daniel, Camila, Sabina; sumar a Giuli como tester). Para clientes reales hace falta
  **acceso avanzado** de `instagram_manage_messages` (revisión con video) y, antes, la
  **verificación del negocio** (hoy rechazada por documento). La prueba de «listo» no lo necesita.
- La app tiene que estar publicada (ya lo está) y la cuenta de Instagram con «Permitir acceso a los
  mensajes» encendido (Configuración → Mensajes → Herramientas conectadas).
- Ventana: se puede responder hasta 24 h después del último mensaje del cliente (7 días si vino de
  un anuncio «clic a Direct»). No hay plantillas. Texto de hasta 1000 bytes por mensaje.
- Envío: `POST https://graph.facebook.com/{version}/{page-id}/messages` con el **token de página**,
  `recipient: { id: IGSID }`. El IGSID (id del cliente para esta cuenta) llega en el webhook.

## 4. Enfoques considerados

1. **Un canal más dentro de la Bandeja (elegido).** Cada chat suma `canal` (`WHATSAPP` |
   `INSTAGRAM`); en Instagram el `waId` guarda el IGSID. Se reusan registro, estados, bot, pausas,
   archivos y pantalla; sólo cambian la entrada (webhook nuevo) y la salida (envío por canal).
2. Tablas propias para Instagram: duplica la Bandeja y el bot; descartado.
3. Un servicio externo que junte canales (ManyChat, etc.): costo mensual, los datos quedan afuera y
   el bot no ve FOTOFFICE; descartado.

## 5. Diseño

### 5.1 Datos (migración chica, se aplica a mano en producción antes de fusionar)

- `FotofficeWaChat.canal String @default("WHATSAPP")`. El único pasa de `[workspaceId, waId]` a
  `[workspaceId, canal, waId]`. Para Instagram, `waId` = IGSID (comentario del campo actualizado).
  Se suma `usuarioInstagram String?` (el @ del cliente) para mostrar.
- `FotofficePresupuestoAprobacion` suma `igChatId String?` y acepta `origin = INSTAGRAM` (§5.7).
- `FotofficeWaConexion` suma `igAccountId String? @unique`, `igPageId String?`, `igUsuario String?`
  (@dnxestudio) e `igActivo Boolean @default(false)`. El token de página va cifrado al mismo baúl de
  integraciones que el de WhatsApp, con su propia clave (nunca en la tabla).
- Mensajes: sin cambios. `waMessageId` guarda el `mid` de Instagram (idempotencia igual).

### 5.2 Entrada: `/api/webhooks/instagram`

- Mismo secreto (`WHATSAPP_APP_SECRET`, es la misma app) y mismo token de verificación.
  Objeto `instagram`, campos `messages`, `messaging_postbacks`, `messaging_seen`, `messaging_referral`.
- `lib/bandeja/instagram/webhook.ts` (puro) traduce el aviso a los mismos `EventoWa` con
  `canal: "INSTAGRAM"`: la conexión se busca por `entry.id` / `recipient.id` = `igAccountId`.
  - Mensaje del cliente → ENTRANTE. Texto, imágenes, audio, video y archivos (llegan con URL, no con
    id de medio: se bajan al R2 privado como en WhatsApp). Respuesta a historia o mención → texto
    «[respondió a tu historia]» + el texto. Reacciones y «visto» no cuentan como mensajes.
  - `is_echo: true` → ECO (lo mandó la cuenta). Si el `mid` ya está guardado (lo mandó FOTOFFICE) es
    duplicado; si no, lo escribió una persona desde la app → autor CELULAR y pausa del bot.
  - `referral` de anuncio → `media.anuncio` (mismo formato que `anuncio.ts`).
  - Mensajes borrados (`is_deleted`) → se ignoran.
- El nombre del cliente se pide una vez a Meta (`GET /{IGSID}?fields=name,username`) al crear el chat.
- `aplicarEventos` y `registrarMensaje` aceptan el canal; lo que no se entiende se confirma con 200.

### 5.3 Salida: envío por canal

- `enviarTexto(conexion, chat, texto)` decide por `chat.canal`: WhatsApp como hoy; Instagram vía
  `lib/bandeja/instagram/envio.ts` (página + token de página). Textos de más de 1000 bytes se parten
  en varios mensajes por párrafos. Mismos códigos de error y mismo modo SIMULADO / REAL.
- Los 3 puntos que hoy envían (`acciones.ts` del panel, `aviso-sistema.ts`, `bot/envio-bot.ts`) pasan
  el chat completo. Plantillas (`enviarPlantilla`) quedan sólo para WhatsApp: con un chat de
  Instagram se omiten (no fallan).
- La ventana de Instagram usa la misma `ultimoEntranteEn` (24 h). La extensión a 7 días de los anuncios «clic a Direct» queda para después.

### 5.4 El bot en Instagram

- La guía recibe el canal. En Instagram:
  - Contesta igual precios, catálogo, datos del estudio y cursos.
  - **Eventos:** pide el nombre y el WhatsApp («así te mandamos la cotización por ahí»). Con el
    teléfono, `preparar_presupuesto` (que suma el campo `whatsapp`, obligatorio en Instagram) carga
    la consulta con ese teléfono, **origen «Instagram»** (se busca o crea en el catálogo de orígenes
    del workspace) y el mensaje «Por Instagram (@usuario): …». El resto del circuito es el de hoy:
    borrador, aprobación por Telegram, correo.
  - **Pedidos de copias, impresiones y fotolibros:** no se arman por Instagram (las fotos llegan
    comprimidas y el pago y el seguimiento viven en WhatsApp). El bot manda el enlace
    `wa.me/543413419869` con un texto armado. *Mi decisión; Daniel puede cambiarla.*
  - Si el cliente no quiere dar el WhatsApp, se carga la consulta igual (sin teléfono, con correo si
    lo dio) y pasa a persona.
- **Cómo le llega la cotización (decisión de Daniel, 18/11: gratis):** sale **por Instagram y por
  correo**, sin plantillas pagas. Por Instagram se manda el texto de la cotización con el enlace
  (`textoWhatsappDelPresupuesto` sirve igual) si la ventana de Instagram sigue abierta (24 h); si se cerró, queda anotado «Instagram no: pasaron más de 24 h» y sale sólo el
  correo, como hoy con WhatsApp. Si casualmente el cliente ya tiene la ventana de WhatsApp abierta
  con ese teléfono, también sale por WhatsApp (gratis, regla de hoy). El teléfono que dio sirve para
  los **seguimientos** de WhatsApp a los 2, 7 y 12 días (la plantilla `seguimiento_cotizacion` que
  ya existe) y para que la persona del estudio lo contacte.
- El chat de WhatsApp que nace después y el de Instagram quedan atados por la ficha del cliente
  (`clientId`), no se fusionan.

### 5.5 Pantallas

- **Bandeja (lista):** cada chat muestra el ícono del canal (verde WhatsApp / Instagram) al lado del
  nombre; arriba, filtro «Todos · WhatsApp · Instagram». En Instagram se muestra «@usuario».

  ```
  [WA] Karina López          13:02   Hola, ¿cuánto sale la colación?
  [IG] @sofi.rodriguez       12:47   Vi el anuncio de XV 💜
  ```

- **Chat:** encabezado con «Instagram · @usuario» y enlace al perfil; aviso de ventana igual que en
  WhatsApp. Sin botones de plantillas.
- **Configuración → WhatsApp:** sección nueva «Instagram» con el estado (conectado / no), la cuenta
  (@dnxestudio) y el botón «Conectar Instagram»: con el token del usuario del sistema ya guardado,
  FOTOFFICE busca la página vinculada, guarda el token de página, suscribe la página a la app y
  prueba la conexión. Muestra el motivo de Meta si falla (como el PR #814).
- **Instructivo** `/instructivos/bandeja-whatsapp`: un párrafo sobre Instagram.

### 5.6 Qué hace Daniel del lado de Meta

1. En la app de Instagram de @dnxestudio: Configuración → Mensajes y respuestas a historias →
   Herramientas conectadas → «Permitir acceso a los mensajes».
2. En el portfolio DNX Estudio: darle al usuario del sistema FOTOFFICE acceso total a la página
   «DNX Estudio» y a la cuenta de Instagram, y generar un token nuevo con los permisos de §3.
3. Sumar a Giuli (y a quien pruebe) como tester de la app, y aceptar la invitación.
4. Yo dejo cargado el webhook de Instagram en la app (URL `/api/webhooks/instagram`).
5. Después de la prueba: verificación del negocio (documento con nombre legal y teléfono) y pedido
   de acceso avanzado de `instagram_manage_messages` con un video del circuito.

### 5.7 Decisiones tomadas tras la revisión (mis decisiones; Daniel puede cambiarlas)

- **Fila de aprobación:** `FotofficePresupuestoAprobacion.origin` suma `INSTAGRAM`, que el flujo
  trata como `WHATSAPP` (presupuesto por horas, interruptor de Telegram, acuse): un ayudante
  `entroPorElBot(origen)` reemplaza las comparaciones con `"WHATSAPP"`. `waId` = **el teléfono que
  dio el cliente** (549…), para los seguimientos. Columna nueva `igChatId String?` (el chat de
  Instagram) para mandar la cotización por ahí. `decidirCanales` suma el canal Instagram (con chat y
  ventana abierta) y los textos de Telegram / resultado dicen «Instagram». Lo que marca «Instagram»
  en Consultas es el `originId` del catálogo y el texto «Por Instagram (@usuario)».
- **`waId` no es teléfono en Instagram:** en chats de Instagram no se corre `clienteDelTelefono`, el
  alta de ficha desde el panel crea el cliente sin teléfono, y toda búsqueda de chat «por teléfono»
  (`estadoWhatsappDe`, `enPreparacionParaWhatsapp`, seguimientos, pedidos) filtra `canal = WHATSAPP`.
  Si el chat de Instagram ya tiene ficha sin teléfono, el WhatsApp que da el cliente se escribe en esa
  ficha; si la ficha ya tiene otro teléfono, no se pisa y se anota en la consulta.
- **Ecos de lo que manda FOTOFFICE:** un eco se toma como propio si su `mid` ya está guardado, o si
  hay en ese chat un mensaje SALIENTE en PENDIENTE de los últimos 2 minutos con el mismo texto (se le
  asigna el `mid`). Si Meta trae `app_id` en el eco y coincide con la app, también cuenta como propio.
  Sólo lo que no encaja es CELULAR (Giuli desde la app) y pausa al bot.
- **Tokens:** el de WhatsApp no se toca. La sección Instagram pide su propio token del usuario del
  sistema (con los permisos de §3), deriva el token de página y guarda **sólo el token de página**,
  con clave propia en el baúl.

## 6. Verificación

- Pruebas unitarias del lector de webhook de Instagram con avisos de muestra (texto, imagen, eco,
  anuncio, historia, borrado), del envío (partir textos, errores) y del bot en canal Instagram.
- Prueba real: Daniel manda un mensaje directo a @dnxestudio desde su cuenta (con rol en la app) →
  aparece en la Bandeja con ícono de Instagram → el bot contesta → pide cotización de XV y da su
  WhatsApp → la consulta aparece en Consultas con origen «Instagram» → aprobación por Telegram →
  le llega la cotización por Instagram y por correo; el seguimiento a los 2 días sale por WhatsApp.
- WhatsApp sigue andando: los tests actuales de la Bandeja pasan sin cambios de comportamiento.

## 7. Queda para quien construye

- Nombres exactos de funciones y archivos dentro de `lib/bandeja/instagram/`.
- Versión de la Graph API (la misma `WHATSAPP_API_VERSION`).
- Qué suscripción de la página pide Meta (`subscribed_fields`) para Instagram: confirmar con la
  respuesta real.
