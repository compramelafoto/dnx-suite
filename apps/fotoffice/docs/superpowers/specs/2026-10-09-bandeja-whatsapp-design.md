# Bandeja de WhatsApp (Etapa A: sin conexión real)

Fecha: 09/10/2026 · Rama `feat/fotoffice-bandeja-whatsapp` (sobre `origin/main` 902b06b4) · Pedido de Daniel ("hagamos el panel desde el principio"; "arrancá sin la conexión").

## 1. Para qué

El WhatsApp de DNX Estudio (341 341-9869) es también el de atención al público. Daniel quiere que
se responda 24/7 con un bot y que Camila y Sabina atiendan desde FOTOFFICE con orden: cada chat
con su estado y responsable, todo a nombre de quien inició sesión, vinculado a la ficha del
cliente. Esta etapa construye la Bandeja y la conexión **sin** depender de Meta: el envío funciona
en **modo simulado** (queda registrado, no sale) y hay un **simulador de mensajes entrantes** para
probar. El bot (IA) es una etapa posterior: acá sólo quedan las reglas de quién atiende.

## 2. Modelo de datos (migración `20261027100000_fotoffice_bandeja_whatsapp`, 3 tablas nuevas)

- `FotofficeWaConexion` (1 por workspace): `id`, `workspaceId @unique`, `phoneNumberId String? @unique`,
  `wabaId String?`, `displayPhone String?`, `modo` ("SIMULADO" | "REAL", default SIMULADO),
  `pausaBotHoras Int @default(4)`, `createdAt`, `updatedAt`. El token de Meta NO va acá: va cifrado
  en `WorkspaceIntegration` (proveedor nuevo `WHATSAPP`, key `whatsapp`) con el vault existente
  (`lib/integrations/vault.ts`).
- `FotofficeWaChat`: `id`, `workspaceId`, `waId` (teléfono E.164 sin "+", ej. 5493413419869),
  `nombre String?` (el perfil de WhatsApp), `clientId String?` (FK Client, SetNull), `estado`
  ("BOT" | "HUMANO" | "RESUELTO", default BOT), `asignadoUserId Int?`, `botPausadoHasta DateTime?`,
  `ultimoMensajeEn DateTime`, `ultimoEntranteEn DateTime?` (ventana de 24 h), `noLeidos Int @default(0)`,
  `createdAt`, `updatedAt`. Único `(workspaceId, waId)`; índices `(workspaceId, estado, ultimoMensajeEn)`,
  `(workspaceId, asignadoUserId)`, `(clientId)`.
- `FotofficeWaMensaje`: `id`, `workspaceId`, `chatId` (FK cascade), `direccion` ("ENTRANTE" | "SALIENTE" | "SISTEMA"),
  `autor` ("CLIENTE" | "BOT" | "USUARIO" | "CELULAR" | "SISTEMA"), `autorUserId Int?`, `autorLabel String?`,
  `tipo` ("TEXTO" | "IMAGEN" | "AUDIO" | "DOCUMENTO" | "VIDEO" | "UBICACION" | "PLANTILLA" | "OTRO"),
  `texto String?` (≤ 4096), `media Json?` (id/mime/caption de Meta; no se descarga en esta etapa),
  `waMessageId String?`, `estadoEnvio` ("RECIBIDO" | "SIMULADO" | "PENDIENTE" | "ENVIADO" | "ENTREGADO" | "LEIDO" | "FALLO"),
  `errorCodigo String?`, `createdAt`. Único `(workspaceId, waMessageId)` (idempotencia de webhooks);
  índice `(chatId, createdAt)`.
- Las acciones (tomó, devolvió al bot, resolvió) se guardan como mensajes `SISTEMA` en el chat:
  quedan en la conversación con autor y hora.

## 3. Reglas (módulo puro `lib/bandeja/reglas.ts`)

- `atiendeElBot(chat, ahora)`: true si `estado === "BOT"`, o si `estado === "HUMANO"`, sin
  `asignadoUserId` y `botPausadoHasta` vencido. Un chat **tomado** por alguien (asignado) nunca
  vuelve solo al bot; sólo con "Devolver al bot" o "#bot".
- Respuesta de una persona desde el **celular** (eco): `estado = HUMANO`, `botPausadoHasta = ahora +
  pausaBotHoras`, sin cambiar el asignado. Si el texto empieza con "#bot": vuelve a `BOT`, sin pausa
  (el mensaje "#bot" se registra como SISTEMA "Devuelto al bot desde el celular").
- **Tomar** (panel): `estado = HUMANO`, `asignadoUserId = yo`, sin pausa. **Devolver al bot**:
  `estado = BOT`, sin asignado. **Resolver**: `estado = RESUELTO`. Un mensaje entrante a un chat
  RESUELTO lo reabre en `BOT` (o `HUMANO` si tenía asignado).
- Ventana de 24 h: `puedeResponderLibre(chat, ahora) = ultimoEntranteEn && ahora - ultimoEntranteEn < 24 h`.
  Fuera de la ventana el panel no deja mandar texto libre (aviso; las plantillas de Meta quedan para la etapa con conexión).
- Responder desde el panel sin haber tomado el chat lo toma automáticamente.

## 4. Teléfono y cliente (`lib/bandeja/telefono.ts`)

`waIdDe(raw)`: normaliza a E.164 sin "+" reutilizando `normalizeWhatsappNumber`
(`lib/contact/whatsapp.ts`). `clienteDelTelefono(workspaceId, waId)`: busca un `Client` del workspace
cuyo `phone` (sólo dígitos) coincida con las variantes argentinas (con/sin 54, con/sin 9, con/sin 0/15;
comparar por los últimos 10 dígitos). Si hay exactamente uno, se vincula solo; si hay varios o
ninguno, el panel ofrece "Vincular a un cliente" / "Crear contacto".

## 5. Entrada: webhook `app/api/webhooks/whatsapp/route.ts`

- `GET`: verificación de Meta (`hub.mode=subscribe`, `hub.verify_token` == `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  → devolver `hub.challenge`; si no, 403). Sin la variable: 404.
- `POST`: lee el cuerpo crudo; verifica `x-hub-signature-256` = `sha256=` + HMAC-SHA256(cuerpo,
  `WHATSAPP_APP_SECRET`) con `timingSafeEqual`; sin la variable 404, firma mala 401, JSON malo 400.
  Responde 200 rápido; el registro es idempotente por `waMessageId`.
- Parser puro `lib/bandeja/webhook.ts` → lista de eventos `{ tipo: "ENTRANTE" | "ECO" | "ESTADO", phoneNumberId, ... }`:
  - `field: "messages"` → `value.messages[]` (ENTRANTE: from, id, timestamp, type, text.body,
    image/audio/document/video/location, `value.contacts[0].profile.name`) y `value.statuses[]`
    (ESTADO: id, status sent|delivered|read|failed, errors[0].code).
  - `field: "smb_message_echoes"` → `value.message_echoes[]` (ECO: from = el negocio, to = el
    cliente, id, timestamp, type, text.body). **A confirmar con el primer payload real**: el parser
    es tolerante (ignora lo que no entiende y nunca lanza).
  - El workspace sale de `metadata.phone_number_id` → `FotofficeWaConexion`. Sin conexión: se ignora.
- `lib/bandeja/registro.ts` aplica los eventos: crea/actualiza chat (waId, nombre, vínculo con
  cliente), guarda el mensaje (idempotente), aplica las reglas (§3), suma `noLeidos` en entrantes,
  actualiza `estadoEnvio` con los ESTADO.

### Requisitos de despliegue

- Una sola app de Meta para FOTOFFICE: una única `WHATSAPP_APP_SECRET`; las instituciones se conectan a través de ella.
- Los números argentinos se envían como `549…` (el parser unifica el móvil sin 9 que a veces manda Meta).
- A confirmar con el primer payload real: el formato del eco (`smb_message_echoes`) y los eventos `sticker` (se guarda como imagen) y `reaction` (se ignora).
- Seguridad: por `phoneNumberId` sólo reciben eventos las conexiones en modo REAL, y pasar a REAL (o cambiar de número en REAL) se verifica contra Meta con el token de la institución. Un aviso de estado de un mensaje todavía desconocido y de menos de 5 minutos hace responder 500 para que Meta reintente.

## 6. Salida: `lib/bandeja/envio.ts`

`enviarTexto(conexion, waId, texto)`: si `modo === "REAL"` y hay token en el vault → POST
`https://graph.facebook.com/<versión>/<phoneNumberId>/messages` (como `apps/compramelafoto/lib/whatsapp/sendTextMessage.ts`;
versión en `WHATSAPP_API_VERSION`, por omisión "v21.0") y devuelve `waMessageId`; si no →
`{ ok: true, simulado: true }`. El mensaje se registra `PENDIENTE` y pasa a `ENVIADO`/`FALLO`
(o `SIMULADO`). Nunca loguea el texto ni el token.

## 7. Permisos y módulo

Módulo nuevo `whatsapp-inbox` ("Bandeja de WhatsApp", ruta `/bandeja`, familia comunicación,
AVAILABLE). Ver la bandeja: nivel VIEW. Responder, tomar, devolver, resolver, vincular: MANAGE
(`operar`). Configuración → WhatsApp: `configurar`. Todo con el workspace y el usuario de la sesión;
cada acción queda con `autorUserId` y `autorLabel` (etiqueta del usuario, `etiquetaDeUsuario`).

## 8. Pantallas

- `/bandeja`: lista de chats (nombre o número, último mensaje, hora AR, estado con color, responsable,
  no leídos) con filtros **Todos · Atiende el bot · Míos · Sin asignar · Resueltos** y búsqueda por
  nombre/número. Se refresca sola cada 10 s.
- `/bandeja/[chatId]`: la conversación (burbujas por autor: cliente, bot, persona con su nombre,
  "desde el celular", sistema), caja de respuesta (deshabilitada fuera de la ventana de 24 h, con
  aviso), botones **Tomar · Devolver al bot · Resolver**, panel lateral con el cliente vinculado
  (enlace a su ficha, consultas y presupuestos recientes) o "Vincular / Crear contacto". Al abrir,
  `noLeidos = 0`. Se refresca cada 5 s. En modo SIMULADO, cartel fijo "Modo de prueba: los mensajes
  no salen a WhatsApp".
- Configuración → WhatsApp: estado de la conexión (simulado / real, número), horas de pausa del bot,
  y **Simular un mensaje entrante** (número, nombre, texto; sólo en modo SIMULADO) que pasa por el
  mismo `registro.ts` que el webhook.
- Menú: "Bandeja de WhatsApp" con el total de no leídos.

## 9. Fuera de alcance (etapas siguientes)

Conexión real y alta del número (Meta), plantillas de Meta fuera de las 24 h, descarga de fotos/audios,
el bot con IA y su aprobación por Telegram, métricas, mensajes en la línea de tiempo de la ficha.

## 10. Pruebas

Migración; reglas (todas las transiciones, ventana 24 h, #bot); parser con payloads de ejemplo
(texto, imagen, estados, eco, basura); firma (válida, inválida, sin secreto); registro (idempotencia,
vínculo con cliente único/múltiple/ninguno, reapertura de resuelto, eco pausa al bot); envío
simulado/real con `fetch` simulado; acciones con permisos (VIEW no responde; workspace de la
sesión); pantallas por reglas de fuente; prueba en navegador con una rama Neon de prueba.
