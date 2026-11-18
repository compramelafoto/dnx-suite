# Instagram en la Bandeja y el bot — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** que los mensajes directos de @dnxestudio entren a la Bandeja como chats `canal = INSTAGRAM`, que el bot los conteste y que una consulta de evento se cargue con origen «Instagram» y se cotice por Instagram + correo.

**Architecture:** un canal más dentro de la Bandeja. `FotofficeWaChat.canal` distingue WhatsApp de Instagram (en Instagram `waId` = IGSID). Una ruta nueva `/api/webhooks/instagram` traduce los avisos de Meta a los mismos `EventoWa`; `enviarTexto` decide por canal. El circuito de cotización trata `INSTAGRAM` como `WHATSAPP` y suma Instagram como canal de salida.

**Tech Stack:** Next.js (leer `node_modules/next/dist/docs/` antes de tocar rutas), Prisma (`packages/db`), Vitest, Graph API de Meta (Messenger Platform para Instagram).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-11-18-bandeja-instagram-design.md`

## Global Constraints

- Todo texto de pantalla en español rioplatense; nunca loguear textos, teléfonos, IGSID ni tokens.
- WhatsApp no cambia de comportamiento: los tests actuales de `lib/bandeja`, `lib/presupuesto-automatico` y `app/api/webhooks/whatsapp` pasan sin editar sus expectativas (sólo se adaptan llamadas por la clave única nueva).
- Canal por omisión `"WHATSAPP"`. Constante `CANALES = ["WHATSAPP", "INSTAGRAM"] as const` en `lib/bandeja/constantes.ts`.
- Envío Instagram: `POST https://graph.facebook.com/${WHATSAPP_API_VERSION||"v21.0"}/${igPageId}/messages`, cuerpo `{ recipient: { id: igsid }, message: { text } }`, token de página. Texto ≤ 1000 bytes por mensaje.
- Ventana de Instagram: 24 h (`VENTANA_HORAS`), igual que WhatsApp. La extensión a 7 días por anuncio queda fuera de esta entrega.
- Migración `packages/db/prisma/migrations/20270213090000_fotoffice_bandeja_instagram/`; se aplica a mano en producción (rama `development` de Neon) y se registra con su sha256 antes de fusionar.
- Origen de la consulta: `FotofficeOrigen` con `name = "Instagram"` del workspace (buscar sin distinguir mayúsculas; si no existe, crearlo al final del orden).
- Clave del baúl para el token de página: `INSTAGRAM_INTEGRATION_KEY = "instagram"`, provider `"INSTAGRAM"`.

## Review Focus

1. Eco de una respuesta del bot que llega antes de guardar su `mid` → no debe pausar al bot (Task 3, test `eco propio sin mid todavía`).
2. Un IGSID que coincide en dígitos con un teléfono de otro chat de WhatsApp → son chats distintos y la búsqueda por teléfono no lo ve (Task 1, test `mismo waId en dos canales`).
3. Respuesta del bot de más de 1000 bytes (con emojis) → se parte en varios mensajes sin cortar un carácter (Task 4, test `partir por bytes`).
4. Cliente de Instagram que no quiere dar su WhatsApp → la consulta se carga igual sin teléfono y pasa a persona (Task 5, test `sin whatsapp`).
5. Aviso de Instagram de una cuenta no conectada o con conexión SIMULADA → se ignora con 200 (Task 3, test `cuenta desconocida`).

---

### Task 1: Datos: canal en chats, conexión de Instagram y aprobación

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (`FotofficeWaChat`, `FotofficeWaConexion`, `FotofficePresupuestoAprobacion`)
- Create: `packages/db/prisma/migrations/20270213090000_fotoffice_bandeja_instagram/migration.sql`
- Modify: `apps/fotoffice/lib/bandeja/constantes.ts`, todos los usos de `workspaceId_waId` y los `findFirst({ where: { workspaceId, waId } })` en `lib/bandeja/**`, `lib/presupuesto-automatico/**`, `lib/presupuestos/seguimiento-whatsapp-servidor.ts`, `lib/proyectos/aviso-listo-servidor.ts`, `lib/impresiones/*whatsapp*`, `lib/pedidos/whatsapp-servidor.ts`, `lib/circuitos/base-en-memoria.ts`
- Test: `apps/fotoffice/lib/bandeja/migracion.test.ts`, `apps/fotoffice/lib/bandeja/registro.test.ts`

**Interfaces:**
- Produces: `FotofficeWaChat.canal String @default("WHATSAPP")`, `usuarioInstagram String?`, único `@@unique([workspaceId, canal, waId])` (clave Prisma `workspaceId_canal_waId`); `FotofficeWaConexion.igAccountId String? @unique`, `igPageId String?`, `igUsuario String?`, `igActivo Boolean @default(false)`; `FotofficePresupuestoAprobacion.igChatId String?` y comentario de `origin` = `WEB | WHATSAPP | INSTAGRAM`. `type Canal = (typeof CANALES)[number]`.

- [ ] **Step 1:** test en `migracion.test.ts` que lea el SQL de la migración y verifique: `ADD COLUMN "canal" TEXT NOT NULL DEFAULT 'WHATSAPP'`, borra el índice único viejo `FotofficeWaChat_workspaceId_waId_key` y crea `FotofficeWaChat_workspaceId_canal_waId_key`, `ADD COLUMN "igAccountId"` con índice único, `ADD COLUMN "igChatId"` en `FotofficePresupuestoAprobacion`.
- [ ] **Step 2:** correr `npx vitest run lib/bandeja/migracion.test.ts` → FAIL.
- [ ] **Step 3:** schema + `migration.sql` (sólo `ALTER TABLE` / `CREATE UNIQUE INDEX` / `DROP INDEX`, sin tocar datos) + `npx prisma generate` en `packages/db`.
- [ ] **Step 4:** cambiar cada `workspaceId_waId: { workspaceId, waId }` a `workspaceId_canal_waId: { workspaceId, canal, waId }` (WhatsApp pasa `"WHATSAPP"`) y sumar `canal: "WHATSAPP"` a toda búsqueda de chat por teléfono (`estadoWhatsappDe`, `enviarAvisoPorWhatsapp`, `condicionEnPreparacion`, seguimientos, pedidos, impresiones). La base en memoria reconoce la clave nueva.
- [ ] **Step 5:** test `mismo waId en dos canales` en `registro.test.ts`: con un chat INSTAGRAM `waId="5493411234567"`, un ENTRANTE de WhatsApp del mismo número crea otro chat; `estadoWhatsappDe` mira sólo el de WhatsApp.
- [ ] **Step 6:** `npm test -- lib/bandeja lib/presupuesto-automatico` (desde `apps/fotoffice`) → PASS.
- [ ] **Step 7:** commit «Sumar el canal Instagram a los chats de la Bandeja».

### Task 2: Lector del webhook de Instagram (puro)

**Files:**
- Create: `apps/fotoffice/lib/bandeja/instagram/webhook.ts`, `apps/fotoffice/lib/bandeja/instagram/__fixtures__/{texto,imagen,eco,anuncio,historia,borrado,reaccion}.json`
- Modify: `apps/fotoffice/lib/bandeja/webhook.ts` (tipos)
- Test: `apps/fotoffice/lib/bandeja/instagram/webhook.test.ts`

**Interfaces:**
- Consumes: `Canal` (Task 1), `anuncioDeReferral` de `lib/bandeja/anuncio.ts`.
- Produces: en `webhook.ts`, `Comun` suma `canal?: Canal` (ausente = WhatsApp) y `MediaWa` suma `url?: string` y `appId?: string`; para Instagram `phoneNumberId` lleva el `igAccountId`. `leerWebhookInstagram(json: unknown): EventoWa[]` (nunca lanza).

- [ ] **Step 1:** fixtures con el formato de Meta (`object: "instagram"`, `entry[].id` = cuenta, `entry[].messaging[]` con `sender.id`, `recipient.id`, `timestamp` en ms, `message.mid`, `message.text`, `message.attachments[{type, payload.url}]`, `message.is_echo`, `message.app_id`, `message.is_deleted`, `message.reply_to.story`, `referral` / `message.referral`) y tests:
  - texto → `{ tipo:"ENTRANTE", canal:"INSTAGRAM", phoneNumberId:<cuenta>, waId:<sender>, waMessageId:<mid>, mensajeTipo:"TEXTO", texto }`, `en` = `new Date(timestamp)` (milisegundos, no segundos).
  - imagen → `mensajeTipo:"IMAGEN"`, `media.url`; `audio`→AUDIO, `video`→VIDEO, `file`→DOCUMENTO, otro → OTRO.
  - eco → `tipo:"ECO"`, `waId` = `recipient.id`, `media.appId` si viene.
  - historia → texto `"[respondió a tu historia] " + texto`; `story_mention` → `"[te mencionó en una historia]"`.
  - anuncio → `media.anuncio` igual que `anuncioDeReferral`.
  - borrado, reacción, `read`/visto, JSON roto → `[]`.
- [ ] **Step 2:** `npx vitest run lib/bandeja/instagram/webhook.test.ts` → FAIL.
- [ ] **Step 3:** implementar `leerWebhookInstagram` con el mismo estilo tolerante de `leerWebhook`.
- [ ] **Step 4:** test → PASS; los de `lib/bandeja/webhook.test.ts` siguen PASS.
- [ ] **Step 5:** commit «Leer los mensajes directos de Instagram que avisa Meta».

### Task 3: Registro y ruta `/api/webhooks/instagram`

**Files:**
- Modify: `apps/fotoffice/lib/bandeja/registro.ts`, `apps/fotoffice/lib/bandeja/medios.ts`, `apps/fotoffice/lib/bandeja/archivo-de-mensaje.ts`
- Create: `apps/fotoffice/app/api/webhooks/instagram/route.ts`, `apps/fotoffice/lib/bandeja/instagram/perfil.ts`
- Test: `apps/fotoffice/lib/bandeja/registro.test.ts`, `apps/fotoffice/app/api/webhooks/instagram/route.test.ts`, `apps/fotoffice/lib/bandeja/medios.test.ts`

**Interfaces:**
- Consumes: `leerWebhookInstagram` (Task 2), `leerTokenInstagram` (Task 4).
- Produces: `aplicarEventos` resuelve la conexión por `igAccountId` cuando `ev.canal === "INSTAGRAM"` (sólo `modo REAL` e `igActivo`); `perfilInstagram(workspaceId: string, igsid: string, deps?): Promise<{ nombre: string | null; usuario: string | null }>` (GET `/{igsid}?fields=name,username`, nunca lanza).

- [ ] **Step 1:** tests en `registro.test.ts`:
  - ENTRANTE Instagram crea chat `canal:"INSTAGRAM"`, `clientId:null` (no se busca por teléfono), `nombre`/`usuarioInstagram` del perfil.
  - `eco propio sin mid todavía`: con un SALIENTE BOT en PENDIENTE de hace 30 s y el mismo texto, el ECO le asigna el `mid`, no crea mensaje y NO pausa al bot.
  - eco con `media.appId` igual a `process.env.META_APP_ID` → propio.
  - eco ajeno → autor CELULAR y pausa (como WhatsApp).
  - `cuenta desconocida`: `igAccountId` sin conexión o SIMULADA → `ignorados: 1`.
- [ ] **Step 2:** tests → FAIL.
- [ ] **Step 3:** implementar en `registro.ts`: conexión por canal, la regla del eco propio (PENDIENTE ≤ `MINUTOS_PENDIENTE_INCIERTO` con texto igual vía `mismoTextoSeguro`, o `appId` igual a `META_APP_ID`), `clienteDelTelefono` sólo en WhatsApp, perfil al crear chat de Instagram.
- [ ] **Step 4:** `medios.ts`: si `media.url` (Instagram) se baja directo de la URL sin token, con el mismo tope `MAX_BYTES_MEDIO` y la misma clave R2; `archivoDeMensaje` acepta `url` en lugar de `id`. Test en `medios.test.ts`.
- [ ] **Step 5:** ruta: `GET` igual a la de WhatsApp (mismo `WHATSAPP_WEBHOOK_VERIFY_TOKEN`); `POST` igual pero con `leerWebhookInstagram`; mismo `firmaValida` con `WHATSAPP_APP_SECRET`; `programarTrasRegistro`. `route.test.ts`: firma mala → 401, payload válido → 200 y chat creado, JSON roto → 400.
- [ ] **Step 6:** `npm test -- lib/bandeja app/api/webhooks` → PASS.
- [ ] **Step 7:** commit «Registrar en la Bandeja los mensajes directos de Instagram».

### Task 4: Envío por canal y token de página

**Files:**
- Create: `apps/fotoffice/lib/bandeja/instagram/envio.ts`, `apps/fotoffice/lib/integrations/instagram/credentials.ts`
- Modify: `apps/fotoffice/lib/integrations/registry.ts`, `apps/fotoffice/lib/bandeja/envio.ts`, `apps/fotoffice/lib/bandeja/acciones.ts`, `apps/fotoffice/lib/bandeja/aviso-sistema.ts`, `apps/fotoffice/lib/bandeja/bot/envio-bot.ts`, `apps/fotoffice/lib/bandeja/plantilla-meta.ts`
- Test: `apps/fotoffice/lib/bandeja/instagram/envio.test.ts`, `apps/fotoffice/lib/bandeja/envio.test.ts`, `apps/fotoffice/lib/bandeja/aviso-sistema.test.ts`

**Interfaces:**
- Produces:
  - `guardarTokenInstagram(workspaceId, token, userId?)`, `leerTokenInstagram(workspaceId): Promise<string|null>`, `hayTokenInstagram(workspaceId): Promise<boolean>` (copia de las de WhatsApp con `INSTAGRAM_INTEGRATION_KEY`).
  - `partirPorBytes(texto: string, max = 1000): string[]` (corta en párrafo, si no en espacio, nunca dentro de un carácter).
  - `enviarTextoInstagram(conexion: Pick<Conexion,"workspaceId"|"modo"|"igPageId">, igsid: string, texto: string, deps?: DepsEnvio): Promise<ResultadoEnvio>`: manda cada parte; devuelve el `mid` de la última; códigos `SIN_PAGINA`, `SIN_TOKEN`, de Meta, `RED`.
  - `enviarTexto(conexion, waId, texto, deps = {}, canal: Canal = "WHATSAPP")`: con `"INSTAGRAM"` delega a `enviarTextoInstagram`. `Conexion` suma `igPageId`, `igAccountId`, `igUsuario`, `igActivo`.
  - `enviarAvisoAlChat(workspaceId: string, chatId: string, texto: string, deps?): Promise<SalidaAvisoWhatsapp>` en `aviso-sistema.ts`; `enviarAvisoPorWhatsapp` busca el chat de WhatsApp y la llama.
  - `enviarPlantilla` con un chat de Instagram devuelve `{ ok:false, codigo:"SIN_PLANTILLAS_INSTAGRAM" }` sin llamar a Meta; los llamadores lo tratan como omitido.
- [ ] **Step 1:** tests: `partir por bytes` (2.500 bytes con emojis → partes ≤ 1000 bytes que unidas dan el texto); `enviarTextoInstagram` arma URL/cuerpo de las Global Constraints, SIMULADO no llama a `fetch`, error de Meta devuelve su `code`; `enviarTexto(..., "INSTAGRAM")` no toca la ruta de WhatsApp; `enviarAvisoAlChat` en chat de Instagram con ventana abierta envía.
- [ ] **Step 2:** tests → FAIL.
- [ ] **Step 3:** implementar; los 3 llamadores (`acciones.ts`, `aviso-sistema.ts`, `envio-bot.ts`) leen `canal` del chat y lo pasan.
- [ ] **Step 4:** `npm test -- lib/bandeja lib/integrations` → PASS.
- [ ] **Step 5:** commit «Contestar por Instagram desde la Bandeja y el bot».

### Task 5: El bot y la cotización en Instagram

**Files:**
- Modify: `apps/fotoffice/lib/bandeja/bot/guia.ts`, `apps/fotoffice/lib/bandeja/bot/herramientas.ts`, `apps/fotoffice/lib/bandeja/bot/responder.ts`, `apps/fotoffice/lib/presupuesto-automatico/whatsapp.ts`, `apps/fotoffice/lib/presupuesto-automatico/flujo.ts`, `apps/fotoffice/lib/presupuesto-automatico/canales.ts`, el aviso de Telegram que muestra los canales
- Create: `apps/fotoffice/lib/consultas/origen-instagram.ts`
- Test: `guia.test.ts`, `herramientas.test.ts`, `canales.test.ts`, `whatsapp.test.ts` (presupuesto-automatico), `flujo.test.ts`

**Interfaces:**
- Consumes: `enviarAvisoAlChat` (Task 4), `Canal` (Task 1).
- Produces:
  - `ChatAtencion` y `ChatDelBot` suman `canal: Canal` y `usuarioInstagram: string | null`.
  - `situacionDeAtencion` suma `canal`; con `"INSTAGRAM"` agrega el bloque de texto de §5.4 del spec: pedir nombre y WhatsApp para eventos; para copias/impresiones/fotolibros mandar `https://wa.me/543413419869?text=<texto armado>`; nunca armar pedidos.
  - `herramientasDeAtencion` con chat de Instagram no incluye `armar_pedido_impresion`, `armar_pedido`, `cotizar_fotolibro` ni `estado_de_mi_pedido`; `preparar_presupuesto` suma `whatsapp: z.string().max(30).optional()`.
  - `origenInstagram(tx, workspaceId): Promise<string>` (id del origen, lo crea si falta).
  - `prepararDesdeWhatsapp` con chat de Instagram: teléfono = `waIdDe(datos.whatsapp)` (inválido o ausente → sin teléfono), `originId` = `origenInstagram`, mensaje `Por Instagram (@usuario): …`; si la ficha del chat no tiene teléfono y llegó uno válido, se escribe en la ficha; llama `alLlegarConsulta(workspaceId, leadId, "INSTAGRAM", { waId: telefono, igChatId: chat.id })`. Sin teléfono: carga la consulta y devuelve un mensaje que lleva a `pasar_a_persona`.
  - `OrigenConsulta = "WEB" | "WHATSAPP" | "INSTAGRAM"`; `entroPorElBot(o)` = WHATSAPP o INSTAGRAM, usado donde hoy se compara con `"WHATSAPP"`.
  - `EntradaCanales` suma `instagram: { chatId: string | null; ventanaAbierta: boolean }`; `DecisionCanales` suma `instagram: boolean`; `ResultadoCanales` suma `instagram?: "ENVIADO" | "FALLO" | "VENTANA_CERRADA"`; `textoDeCanales` nombra «Instagram» (texto de §5.4: «Instagram no: pasaron más de 24 h»). `algunoSalio` cuenta Instagram.
  - `aprobarYEnviar`: si la fila tiene `igChatId`, manda `textoWhatsappDelPresupuesto` con `enviarAvisoAlChat(workspaceId, igChatId, texto)`.
- [ ] **Step 1:** tests:
  - guía: con canal INSTAGRAM aparece «WhatsApp» y `wa.me/543413419869`; con WHATSAPP la situación no cambia (snapshot actual).
  - herramientas: nombres de tools en chat de Instagram = buscar_productos, cursos_del_estudio, datos_del_estudio, preparar_presupuesto, pasar_a_persona, no_responder.
  - whatsapp.test: consulta desde Instagram con `whatsapp:"341 555-1234"` → lead con teléfono `+5493415551234`, `originId` del origen «Instagram» (creado), fila de aprobación `origin:"INSTAGRAM"`, `waId:"5493415551234"`, `igChatId`.
  - `sin whatsapp`: sin el campo → consulta cargada sin teléfono y mensaje que pide pasar a persona.
  - canales: con `instagram.chatId` y ventana abierta → `instagram:true`; ventana cerrada → `VENTANA_CERRADA` y sale el correo.
  - flujo: aprobación de una fila INSTAGRAM aplica el presupuesto por horas igual que WHATSAPP.
- [ ] **Step 2:** tests → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** `npm test -- lib/bandeja lib/presupuesto-automatico lib/consultas` → PASS.
- [ ] **Step 5:** commit «Atender y cotizar por Instagram las consultas de evento».

### Task 6: Pantallas: Bandeja, Configuración e instructivo

**Files:**
- Modify: `apps/fotoffice/lib/bandeja/lecturas.ts`, `apps/fotoffice/components/bandeja/lista-de-chats.tsx`, `apps/fotoffice/components/bandeja/filtros-y-busqueda.tsx`, `apps/fotoffice/app/(shell)/bandeja/page.tsx`, `apps/fotoffice/app/(shell)/bandeja/[chatId]/page.tsx`, `apps/fotoffice/lib/bandeja/conexion.ts`, `apps/fotoffice/app/workspace/configuracion/whatsapp/{page.tsx,actions.ts,whatsapp-form.tsx}`, instructivo `/instructivos/bandeja-whatsapp`
- Create: `apps/fotoffice/app/workspace/configuracion/whatsapp/instagram-form.tsx`
- Test: `apps/fotoffice/lib/bandeja/lecturas.test.ts`, `apps/fotoffice/lib/bandeja/conexion.test.ts`

**Interfaces:**
- Produces:
  - `ChatDeLista` y `DetalleDeChat` suman `canal: Canal` y `usuarioInstagram: string | null`; `listarChats` acepta `canal?: Canal | "todos"` (parámetro de URL `canal`).
  - `conectarInstagram(ctx, datos: { token: string }, deps?): Promise<ResultadoConexion>` en `conexion.ts`: sólo administradores; con el token busca `GET /me/accounts?fields=id,access_token,instagram_business_account{id,username}` la página que tiene cuenta de Instagram (si hay varias, la que coincide con `igAccountId` ya guardado o la primera); `POST /{page-id}/subscribed_apps?subscribed_fields=messages` con el token de página; guarda `igPageId`, `igAccountId`, `igUsuario`, `igActivo:true` y el token de página con `guardarTokenInstagram`. Errores con el motivo de Meta (como `sinSuscripcion`). `desconectarInstagram(ctx)` pone `igActivo:false` y borra el token.
- [ ] **Step 1:** tests: `listarChats({ canal: "INSTAGRAM" })` sólo trae Instagram; `conectarInstagram` con `fetch` falso guarda página, cuenta y usuario y suscribe; token sin página con Instagram → error «Ese token no ve ninguna página con Instagram vinculado».
- [ ] **Step 2:** tests → FAIL.
- [ ] **Step 3:** implementar lecturas y conexión.
- [ ] **Step 4:** pantallas: ícono de canal (`lucide-react` `Instagram` / `MessageCircle`) a la izquierda del título en la lista; filtro «Todos · WhatsApp · Instagram»; título `@usuario` cuando no hay ficha; encabezado del chat «Instagram · @usuario» con enlace `https://instagram.com/<usuario>`; en Configuración → WhatsApp, sección «Instagram» con estado, @cuenta, campo de token y botones «Conectar Instagram» / «Desconectar»; un párrafo en el instructivo.
- [ ] **Step 5:** `npm test` y `npm run typecheck` (desde `apps/fotoffice`) → PASS; revisar en el navegador con `npm run dev` la lista, el chat y Configuración (con datos de la base en memoria o del simulador).
- [ ] **Step 6:** commit «Mostrar los chats de Instagram y conectarlo desde Configuración».

### Task 7: Producción, Meta y prueba real

- [ ] **Step 1:** `npm test`, `npm run typecheck` y `npm run lint` en `apps/fotoffice` → PASS (con `prisma generate` hecho; ver memoria del typecheck que miente por memoria).
- [ ] **Step 2:** aplicar `migration.sql` en la rama `development` de Neon (producción de FOTOFFICE) y registrar en `_prisma_migrations` con su sha256.
- [ ] **Step 3:** push de la rama y PR «Sumar los mensajes directos de Instagram a la Bandeja y el bot».
- [ ] **Step 4:** Meta (con Daniel): webhook objeto `instagram` → `https://fotoffice.com/api/webhooks/instagram`, campos `messages`, `messaging_postbacks`, `messaging_seen`, `messaging_referral`; Daniel enciende «Permitir acceso a los mensajes» en @dnxestudio, da al usuario del sistema FOTOFFICE acceso total a la página y genera el token; env `META_APP_ID=2188321802064982` en Vercel prod.
- [ ] **Step 5:** después del deploy, Configuración → WhatsApp → Instagram → Conectar con el token.
- [ ] **Step 6:** prueba real: mensaje directo desde la cuenta de Daniel → chat con ícono de Instagram en la Bandeja → el bot contesta → pedir cotización de XV y dar un WhatsApp → consulta en Consultas con origen «Instagram» → aviso en Telegram. Evidencia: captura de la Bandeja y fila de la consulta.
