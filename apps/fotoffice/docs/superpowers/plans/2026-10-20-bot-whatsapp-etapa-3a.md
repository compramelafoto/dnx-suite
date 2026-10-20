# Bot de WhatsApp — Etapa 3a: el bot conversa — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Cuando entra un mensaje a un chat de la Bandeja que atiende el bot, el DNX Bot le contesta
al cliente usando el catálogo, la dirección y el horario de DNX Estudio, y pasa el chat a una
persona cuando corresponde. En modo SIMULADO (no sale a Meta).

**Architecture:** Orquestación en `lib/bandeja/bot/` (fuera de `lib/dnx-bot`, cuya prueba de
arquitectura prohíbe enviar). Reutiliza `runBotTurn` del paquete `@repo/dnx-bot`, el cliente de
Anthropic, `costMicroUsd`, el verificador de cifras y los incidentes. El historial sale de
`FotofficeWaMensaje` (el chat ES la conversación: no se usa `BotConversation`). El uso se registra
en `BotUsageDaily` con `actorKey = "wa:<chatId>"` y `userId = null`. El disparo es `after()` en el
webhook y en el simulador, con los chats que `aplicarEventos` marca como "para el bot". Interruptor
por workspace: fila `WorkspaceFeatureModule` `whatsapp-bot` (como `dnx-bot`, fuera del registry).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-20-bot-whatsapp-24x7-design.md` (etapa 3;
la 3a es la parte de conversación; armar pedido y link de pago quedan para la 3b).

## Global Constraints

- Sin migraciones ni dependencias nuevas.
- El bot nunca dice un monto que no haya salido de una herramienta o del cliente (`cifrasNoRespaldadas`); si lo hace, NO se envía y el chat pasa a persona.
- Sólo responde dentro de la ventana de 24 h y si `atiendeElBot` es verdadero al enviar.
- Si una persona responde o entra otro mensaje mientras el bot piensa, el bot no envía.
- Ante cualquier falla: el cliente recibe "Gracias por escribir. En un rato te responde alguien del estudio." (una vez) y el chat pasa a persona.
- Tope por chat: 30 respuestas del bot por día argentino; además valen los topes mensuales de FOTOFFICE y del workspace.
- Texto al cliente: español rioplatense, breve, sin markdown (WhatsApp), montos en pesos con punto de miles.
- Nunca loguear textos ni teléfonos.

## Review Focus

1. Tres mensajes seguidos del cliente → una sola respuesta del bot (la del último), no tres.
2. Una persona toma el chat mientras el bot piensa → el bot no envía.
3. Un cliente que pide "hablar con alguien" → el bot avisa y el chat queda en persona; el siguiente mensaje no lo contesta el bot.
4. Mensaje con foto o audio sin texto → el bot no se rompe (ve "[el cliente mandó una foto]").
5. Interruptor apagado, sin clave o con el bot de FOTOFFICE apagado → nada pasa (ni error al cliente).

---

### Task 1: Historial del chat → mensajes del modelo (puro)

**Files:** Create `lib/bandeja/bot/historial.ts`, Test `lib/bandeja/bot/historial.test.ts`

**Produces:** `historialParaElBot(mensajes: MensajeChat[], max = 40): { history: { role: "user" | "assistant"; content: string }[]; userText: string } | null`
con `MensajeChat = { direccion: "ENTRANTE" | "SALIENTE" | "SISTEMA"; autor: string; tipo: string; texto: string | null }` en orden cronológico.

Reglas: SISTEMA se omite; ENTRANTE → user, SALIENTE → assistant; los de una persona del equipo
(`USUARIO`/`CELULAR`) también van como assistant; sin texto → "[el cliente mandó una foto]" /
"[…un audio]" / "[…un archivo]" / "[…un video]" / "[…un sticker]"; mensajes seguidos del mismo
rol se unen con "\n"; `userText` = el bloque final de user; si el último bloque no es user → `null`;
el historial empieza en user (se descarta un assistant inicial); se queda con los últimos `max`.

### Task 2: Herramientas del bot de atención

**Files:** Create `lib/bandeja/bot/herramientas.ts`, Test `lib/bandeja/bot/herramientas.test.ts`

**Produces:** `herramientasDeAtencion(workspaceId: string, deps?): { tools: BotTool[]; pedidoDePersona: () => string | null }`
- `buscar_productos({ texto })` (read): `listProducts(workspaceId, { search, onlyActive: true })`, sólo precio > 0, hasta 15, devuelve líneas "Nombre — $12.000"; sin resultados → mensaje que lo dice.
- `datos_del_estudio({})` (read): nombre comercial, dirección, horario, ciudad desde `FotofficeWorkspaceBranding`.
- `pasar_a_persona({ motivo })` (read, sin efectos): guarda el motivo; el orquestador lo aplica después del turno.

### Task 3: Guía del bot de atención

**Files:** Create `lib/bandeja/bot/guia.ts`, Test (forma) en `lib/bandeja/bot/guia.test.ts`

**Produces:** `guiaDeAtencion(): string` (fija, cacheable) y `situacionDeAtencion({ estudio, cliente, ahora }): string`
(fecha/hora argentina, nombre del cliente si está vinculado). Reglas de la guía: atiende el
WhatsApp del estudio; responde corto; busca precios siempre con `buscar_productos`; nunca inventa
precios, plazos, descuentos ni promete fechas; para VHS/DVD/CD/rollos explica que se traen al
estudio (dirección y horario con `datos_del_estudio`); para XV, bodas, sesiones, reclamos,
descuentos o si el cliente lo pide → `pasar_a_persona`; todavía no arma pedidos ni cobra: si el
cliente quiere encargar, toma los datos (qué, cuántos, medida) y pasa a persona; sin markdown.

### Task 4: Envío como bot y paso a persona

**Files:** Create `lib/bandeja/bot/envio-bot.ts`, Test `lib/bandeja/bot/envio-bot.test.ts` (base en memoria)

**Produces:**
- `enviarComoBot(workspaceId, chatId, texto, condicion: { ultimoMensajeId: string }, deps?): Promise<"enviado" | "simulado" | "fallo" | "omitido">` — en transacción con el chat bloqueado: si el último mensaje del chat no es `ultimoMensajeId`, o `!atiendeElBot`, o fuera de ventana → "omitido". Si no, crea SALIENTE `autor: "BOT"`, `autorLabel: "Bot"`, PENDIENTE, actualiza vista previa; fuera de la transacción `enviarTexto`; actualiza estado (SIMULADO/ENVIADO/FALLO).
- `pasarAPersona(workspaceId, chatId, motivo)` — estado HUMANO, sin asignado, `botPausadoHasta: null`, mensaje SISTEMA "El bot pasó el chat a una persona: <motivo>".

### Task 5: Orquestador `responderConBot`

**Files:** Create `lib/bandeja/bot/responder.ts`, `lib/bandeja/bot/uso.ts`, Test `lib/bandeja/bot/responder.test.ts`

**Produces:** `responderConBot(chatId: string, deps?: { ahora?, esperar?(ms), turno?(input) }): Promise<"respondio" | "derivo" | "nada">`
1. Config (`enabled`, clave) + módulo `whatsapp-bot` del workspace; si no → "nada".
2. Lee chat + últimos 40 mensajes; `atiendeElBot` y ventana; el último debe ser ENTRANTE → si no, "nada". Recuerda su id.
3. Espera 4 s (`esperar`) y relee: si cambió el último mensaje → "nada" (otra ejecución se encarga).
4. Topes: respuestas de hoy del chat (`BotUsageDaily` actorKey `wa:<chatId>`) < 30 y `decidirLimites` mensual; si no → falla controlada.
5. `runBotTurn` (no streaming: junta `onText`), `proposeWrite` lanza (no hay herramientas de escritura).
6. Registra uso (`uso.ts`: upsert `BotUsageDaily` con `userId: null`, `actorKey: wa:<chatId>`, `messages +1`) — también con error parcial (`BotTurnError.usage`).
7. Cifras: si hay montos no respaldados → incidente + falla controlada (no se envía el texto).
8. Envía con `enviarComoBot` (condición: el mismo último mensaje). Si la herramienta pidió persona → `pasarAPersona` después de enviar.
9. Falla controlada = `enviarComoBot(FALLBACK)` + `pasarAPersona("el bot no pudo responder")` + incidente.

### Task 6: Disparo desde el registro, el webhook y el simulador

**Files:** Modify `lib/bandeja/registro.ts` (`ResultadoRegistro.paraElBot: string[]`; `escribir` devuelve `{ chatId, paraElBot }` cuando es ENTRANTE y `atiendeElBot` con el estado resultante), `app/api/webhooks/whatsapp/route.ts` (`after` + `maxDuration = 120`), `lib/bandeja/simulador.ts` (devuelve `paraElBot`) y la acción del simulador (`after`). Tests en `registro.test.ts`.

### Task 7: Interruptor en Configuración → WhatsApp

**Files:** Modify `app/workspace/configuracion/whatsapp/{page.tsx,actions.ts,whatsapp-form.tsx}`; Create `lib/bandeja/bot/interruptor.ts` (+ test): `botEncendido(workspaceId)`, `cambiarBot(ctx, encendido)` (permiso `configurar`, upsert `WorkspaceFeatureModule` `whatsapp-bot`). Tarjeta "Respuestas automáticas" con casilla "El bot responde los chats que atiende" y aviso si falta la configuración global.

### Task 8: Verificar y publicar

- [ ] `pnpm vitest run` completo y `tsc` sin errores.
- [ ] Prueba real con la API (costo de centavos) contra una rama Neon de prueba: 3 conversaciones (VHS, copias 15x21, boda) con el simulador desde un script de un solo uso; leer las respuestas.
- [ ] PR, CI, fusionar; encender `whatsapp-bot` para DNX Estudio; probar con el simulador en producción.
