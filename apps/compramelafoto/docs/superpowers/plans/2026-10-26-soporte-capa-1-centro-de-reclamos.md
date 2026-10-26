# Centro de reclamos con diagnóstico automático — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la tabla de `/admin/soporte` de CLF por un tablero de cuatro columnas con
diagnóstico automático por IA, respuesta con acciones desde la ficha y una ida y vuelta con el
cliente a través de la ventana del DNX Bot.

**Architecture:** La lógica nueva vive en `apps/compramelafoto/lib/soporte/`: reglas puras de
estados y reloj, diagnóstico, acciones, token de caso y modo caso del bot. Cada pieza tiene un
envoltorio fino que toca la base de datos. El diagnóstico reutiliza el motor `runBotTurn` de
`@repo/dnx-bot`, solo con herramientas de lectura que no envían nada, y devuelve JSON validado con
zod. La UI de admin se arma con `@dnd-kit/core`. El globito `DnxBotBubble` recibe un `casoToken`
para abrirse con la historia del caso.

**Tech Stack:** Next.js (app router; leer `node_modules/next/dist/docs/` antes de usar `after()` o
params de rutas), Prisma con el schema compartido de `packages/db`, `@repo/dnx-bot` (Anthropic,
zod, Telegram), Resend vía `emails/send.ts`, vitest (`vitest.bot.config.ts`) y `@dnd-kit/core`.

**Spec:** `apps/compramelafoto/docs/superpowers/specs/2026-10-26-soporte-capa-1-centro-de-reclamos-design.md`

## Global Constraints

- Se trabaja en el worktree `.claude/worktrees/soporte-capa-1`, nunca en el árbol principal, que
  comparten otras sesiones. Antes de la primera prueba hay que correr `pnpm install`.
- Los textos visibles van en español rioplatense. Las horas, en `America/Argentina/Buenos_Aires`.
  Los montos, en pesos: `totalCents` de CLF ya son pesos y no se dividen por 100. Se dice "dinero",
  no "plata".
- **Plazos fijos:** 24 horas corridas de vencimiento; amarillo cuando faltan 6 horas o menos; el
  link del caso vence a los 30 días; un caso pasa solo a Resuelto después de 3 días en Esperando al
  cliente; las conversaciones de un solo toque se cuentan pero no se listan.
- **Interruptores**, que nacen apagados:
  - `CLF_SUPPORT_DIAG_ENABLED=1` enciende el diagnóstico.
  - `CLF_SUPPORT_CASE_LINKS_ENABLED=1` hace que el mail lleve el botón "Responder" al bot. Apagado,
    el mail queda como hoy.
- **Migración aditiva** en `packages/db/prisma/migrations/`, con SQL idempotente al estilo de
  `20261105120000_dnx_bot_compradores` (`ADD VALUE IF NOT EXISTS`, `IF NOT EXISTS`). Aplicarla en
  las bases es una tarea aparte (la 12) y **requiere el permiso de Daniel**.
- **El diagnóstico nunca ejecuta herramientas que envían algo o modifican datos.**
- Las acciones solo salen del catálogo `ACCIONES_PERMITIDAS` (Tarea 6). Todo envío va al mail del
  pedido.
- Pruebas: `cd apps/compramelafoto && npm run test:bot`.
  - Cada archivo de prueba nuevo tiene que entrar en la lista `include` de `vitest.bot.config.ts`
    con el glob `lib/soporte/**/*.test.ts`, `app/api/admin/support/**/*.test.ts`,
    `app/api/cron/soporte/*.test.ts` o `app/caso/**/*.test.ts`. Esos globs se agregan en la Tarea 1.
  - Para mockear se usa el patrón de `app/api/bot/comprador/acciones/[id]/route.test.ts`
    (`vi.hoisted` + `vi.mock("@/lib/prisma", …)`).
- **Revisión de tipos:** primero `pnpm --filter @repo/db exec prisma generate`, después
  `npm run typecheck`.
  - Un cliente Prisma viejo hace que el typecheck mienta.
  - Si `tsc` se queda sin memoria puede devolver "éxito" igual: hay que confirmar que terminó.
- Las rutas de admin se protegen igual que las de `app/api/admin/support/tickets/route.ts`
  (`requireAuth`).

## Review Focus

1. **Doble clic o reintento en "Enviar y aplicar acciones"** → una sola respuesta, un solo mail y
   cada acción ejecutada una sola vez. *Prueba en la Tarea 7.*
2. **Link de caso vencido, inventado o de otro ticket**, o fotógrafo con la sesión de otro usuario →
   no se muestra nada del caso y se ofrece verificar con el código por mail. *Pruebas en las
   Tareas 8 y 10.*
3. **Diagnóstico de un comprador con el mail sin verificar** → no ejecuta herramientas que envían y
   no pone montos, links ni nombres de pedidos en la respuesta sugerida. *Pruebas en la Tarea 4.*
4. **Tope mensual alcanzado, o la IA falla o devuelve JSON inválido** → el ticket se crea igual y
   la ficha muestra "SIN_PRESUPUESTO" o "FALLO" con un reintento. *Pruebas en las Tareas 4 y 5.*
5. **El cliente escribe en un caso Resuelto** → se reabre en En curso. En uno Cerrado, no se puede
   escribir. Los mensajes del bot espejados en el ticket no se duplican si el turno se reintenta.
   *Pruebas en las Tareas 2, 9 y 10.*

---

### Task 1: Esquema, migración y estado `WAITING_CUSTOMER` en todo CLF

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (`enum SupportTicketStatus`, `model SupportTicket`,
  `model SupportMessage`)
- Create: `packages/db/prisma/migrations/20261226120000_soporte_capa_1/migration.sql`
- Modify: `apps/compramelafoto/lib/admin/helpers.ts` (mapas de etiqueta y color)
- Modify: `apps/compramelafoto/lib/support-url.ts` (`SUPPORT_STATUS_LABELS`)
- Modify: `apps/compramelafoto/app/api/admin/support/tickets/[id]/route.ts:10` (`VALID_STATUSES`)
- Modify: `apps/compramelafoto/lib/support/sanitize.ts:5` (`isTicketClosedForUserReply`)
- Modify: `apps/compramelafoto/vitest.bot.config.ts` (globs de la sección de restricciones)
- Test: `apps/compramelafoto/lib/soporte/estados-etiquetas.test.ts`

**Interfaces:**
- Produces:
  - Enum: `WAITING_CUSTOMER`.
  - `SupportTicket` suma `slaDesde DateTime?`, `esperandoDesde DateTime?`,
    `clienteRespondioAt DateTime?`, `clienteEscribioAt DateTime?`, `vencimientoAvisadoAt DateTime?`
    y `cerradoPor String?`, con valores `"ADMIN" | "CLIENTE_BOT" | "AUTOMATICO"`.
  - `SupportMessage` suma `origen String?`, con valores
    `"ADMIN" | "CLIENTE_PANEL" | "CLIENTE_BOT" | "BOT" | "SISTEMA"`, e
    `idempotencyKey String? @unique`.
  - Modelo `SupportDiagnosis`:
    - `id`
    - `ticketId Int @unique` (relación con `SupportTicket`, `onDelete: Cascade`)
    - `estado String`, con valores `"PENDIENTE" | "LISTO" | "FALLO" | "SIN_PRESUPUESTO"`
    - `categoria String?`, `resumen String?`, `hallazgos String?`, `respuestaSugerida String?`
    - `acciones Json @default("[]")`
    - `confianza String?`
    - `mailSinVerificar Boolean @default(false)`
    - `costMicroUsd Int @default(0)`
    - `error String?`
    - `intentos Int @default(0)`
    - `createdAt`, `updatedAt`
  - Modelo `SupportCaseToken`: `id`, `ticketId Int` (indexado), `tokenHash String @unique`,
    `expiresAt DateTime`, `createdAt`.
  - `isTicketClosedForUserReply(status)` → `true` solo para `CLOSED`.

- [ ] **Step 1:** Escribir `estados-etiquetas.test.ts`, que verifica:
  - `getStatusLabel("WAITING_CUSTOMER") === "Esperando al cliente"`;
  - `getSupportStatusLabel("WAITING_CUSTOMER") === "Esperando tu respuesta"`;
  - `isTicketClosedForUserReply("RESOLVED") === false`;
  - `isTicketClosedForUserReply("CLOSED") === true`.
- [ ] **Step 2:** Correr `npm run test:bot -- lib/soporte/estados-etiquetas`. Esperado: FAIL.
- [ ] **Step 3:** Hacer los cambios de schema, la migración y las listas y mapas. Las listas y mapas
  son los archivos de etiquetas y colores, más los selectores `app/admin/soporte/[id]/page.tsx:25`
  (`STATUS_OPTIONS`) y los paneles de usuario: `app/fotografo/soporte/SoporteClient.tsx`,
  `app/cliente/soporte/SoporteClient.tsx`, `app/lab/soporte/page.tsx` y
  `app/organizador/(panel)/soporte/page.tsx`. Los conteos de "tickets abiertos" del tablero de
  admin (`app/api/admin/dashboard/route.ts:369` y `lib/admin/admin-dashboard-alerts.ts:124,177`)
  **siguen** contando solo `OPEN` e `IN_PROGRESS`.
- [ ] **Step 4:** Correr `prisma generate` y `npm run test:bot -- lib/soporte/estados-etiquetas`.
  Esperado: PASS. Después `npm run typecheck` sin errores.
- [ ] **Step 5:** Commit: `Sumar estados y tablas del centro de reclamos de CLF`.

### Task 2: Reglas puras del reloj y de los estados

**Files:**
- Create: `apps/compramelafoto/lib/soporte/estados.ts`
- Create: `apps/compramelafoto/lib/soporte/aplicar-evento.ts`
- Create: `apps/compramelafoto/lib/soporte/avisos.ts`
- Test: `apps/compramelafoto/lib/soporte/estados.test.ts`,
  `apps/compramelafoto/lib/soporte/aplicar-evento.test.ts`

**Interfaces:**
- Produces (`estados.ts`):
  - Constantes: `SLA_MS = 86_400_000`, `AMARILLO_MS = 21_600_000`,
    `AUTO_RESOLVER_MS = 259_200_000`.
  - `type EstadoTicket = "OPEN" | "IN_PROGRESS" | "WAITING_CUSTOMER" | "RESOLVED" | "CLOSED"`
  - `estadoReloj(t: { status: EstadoTicket; slaDesde: Date | null; createdAt: Date }, now: Date): { color: "verde" | "amarillo" | "rojo"; venceEn: Date } | null`.
    Devuelve `null` en WAITING, RESOLVED y CLOSED.
  - `type EventoTicket`, unión de:
    - `{ tipo: "ADMIN_RESPONDIO" }`
    - `{ tipo: "ADMIN_MOVIO"; a: EstadoTicket }`
    - `{ tipo: "CLIENTE_ESCRIBIO_PANEL" }`
    - `{ tipo: "CLIENTE_ESCRIBIO_BOT" }`
    - `{ tipo: "BOT_PASO_AL_EQUIPO"; motivo: string }`
    - `{ tipo: "CLIENTE_CONFIRMO_RESUELTO" }`
    - `{ tipo: "SIN_RESPUESTA_3_DIAS" }`
  - `type CambioTicket = { status?: EstadoTicket; slaDesde?: Date; esperandoDesde?: Date | null; clienteRespondioAt?: Date | null; clienteEscribioAt?: Date; resolvedAt?: Date | null; cerradoPor?: "ADMIN" | "CLIENTE_BOT" | "AUTOMATICO" | null; aviso?: string }`
  - `transicion(t: { id: number; status: EstadoTicket }, e: EventoTicket, now: Date): CambioTicket | { rechazado: string }`
- Produces (`aplicar-evento.ts`):
  `aplicarEvento(ticketId: number, e: EventoTicket, now?: Date): Promise<CambioTicket | { rechazado: string }>`.
  Lee el ticket, llama a `transicion`, guarda el cambio y, si hay `aviso`, llama a `avisarSoporte`.
- Produces (`avisos.ts`): `avisarSoporte(texto: string): Promise<void>`. Llama a
  `sendTelegramMessage(readBotConfig().telegram, texto)` y nunca lanza errores.

- [ ] **Step 1:** Escribir `estados.test.ts`. Casos, todos con `now` fijo:
  - creado hace 17 h 59 min → `verde`; hace 18 h 01 min → `amarillo`; hace 24 h 01 min → `rojo`;
  - en `WAITING_CUSTOMER` → `null`;
  - `ADMIN_RESPONDIO` desde OPEN → `{status:"WAITING_CUSTOMER", esperandoDesde: now}`;
  - `CLIENTE_ESCRIBIO_PANEL` desde WAITING o RESOLVED →
    `{status:"IN_PROGRESS", slaDesde: now, clienteRespondioAt: now, esperandoDesde: null, resolvedAt: null}`,
    con un `aviso` que contiene `"#<id>"`;
  - `CLIENTE_ESCRIBIO_PANEL` desde CLOSED → `rechazado`;
  - `CLIENTE_ESCRIBIO_BOT` desde WAITING → solo `{clienteEscribioAt: now}`, sin cambiar el estado;
  - `CLIENTE_ESCRIBIO_BOT` desde RESOLVED → `IN_PROGRESS` con `slaDesde: now`;
  - `BOT_PASO_AL_EQUIPO` → `IN_PROGRESS`, `slaDesde: now`, `clienteRespondioAt: now`, con aviso;
  - `CLIENTE_CONFIRMO_RESUELTO` → `{status:"RESOLVED", resolvedAt: now, cerradoPor:"CLIENTE_BOT"}`;
  - `SIN_RESPUESTA_3_DIAS` desde WAITING → `RESOLVED` con `cerradoPor:"AUTOMATICO"`. Desde
    cualquier otro estado → `rechazado`;
  - `ADMIN_MOVIO` a WAITING → `esperandoDesde: now`; a RESOLVED → `resolvedAt: now` y
    `cerradoPor:"ADMIN"`; a OPEN o IN_PROGRESS desde RESOLVED → `resolvedAt: null`.
- [ ] **Step 2:** Correr la prueba. Esperado: FAIL.
- [ ] **Step 3:** Implementar `estados.ts`. Después, `aplicarEvento` y `avisarSoporte`.
  `aplicar-evento.test.ts` verifica con Prisma mockeado que se llama a
  `supportTicket.update({ where:{id}, data: cambio })` sin la clave `aviso`, y que el aviso sale una
  sola vez.
- [ ] **Step 4:** Correr las pruebas. Esperado: PASS.
- [ ] **Step 5:** Commit: `Reglas de estados y vencimiento de los reclamos`.

### Task 3: Resumen del bot y conversaciones resueltas (lectura)

**Files:**
- Create: `apps/compramelafoto/lib/soporte/resumen-bot.ts`
- Create: `apps/compramelafoto/app/api/admin/support/resumen-bot/route.ts` (`GET ?desde&hasta`, en
  formato ISO de fecha argentina; por defecto, los últimos 15 días)
- Create: `apps/compramelafoto/app/api/admin/support/conversaciones/route.ts` (`GET ?page`, de a
  30) y `conversaciones/[id]/route.ts` (`GET`)
- Test: `apps/compramelafoto/lib/soporte/resumen-bot.test.ts`

**Interfaces:**
- Produces:
  - `clasificarConversacion(c: { textosDelUsuario: number; status: string }): "UN_TOQUE" | "CHARLA" | "TICKET"`.
    `TICKET` gana si `status === "ESCALATED"`. Con 1 texto o menos es `UN_TOQUE`.
  - `resumenBot(desde: Date, hasta: Date): Promise<{ total: number; unToque: number; charlas: number; tickets: number; resueltasPorBot: number; porAudiencia: Record<"BUYER" | "PHOTOGRAPHER", number> }>`
  - `listarConversacionesResueltas(page: number): Promise<{ items: { id: string; audience: string; createdAt: Date; primerTexto: string; textosDelUsuario: number; acciones: number }[]; hayMas: boolean }>`
  - `leerConversacion(id: string): Promise<{ id: string; audience: string; items: { rol: "usuario" | "bot" | "sistema"; texto: string; fecha: Date }[]; acciones: { toolName: string; summary: string; status: string }[] } | null>`

- [ ] **Step 1:** Escribir pruebas para:
  - `clasificarConversacion`: `{0,"OPEN"}` → UN_TOQUE; `{1,"OPEN"}` → UN_TOQUE; `{2,"OPEN"}` →
    CHARLA; `{5,"ESCALATED"}` → TICKET;
  - `leerConversacion`, con mensajes mockeados: los `role:"user"` con contenido de array
    (`tool_result`) **no** aparecen como `usuario`, y los bloques `text` del asistente sí aparecen
    como `bot`.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
  - "Texto del usuario" = `role='user' AND jsonb_typeof(content)='string'`.
  - Los conteos se hacen con un solo `prisma.$queryRaw` usando `Prisma.sql` con parámetros.
  - La lista excluye UN_TOQUE y TICKET.
  - Las rutas devuelven 401 o 403 igual que las de soporte de admin.
  - El bot borra conversaciones de más de 90 días (`cron/bot-resumen`); la UI lo aclara en la
    pestaña.
- [ ] **Step 4:** Correr las pruebas. Esperado: PASS. Además, la consulta cruda se ejecuta una vez
  en modo lectura contra la rama `production` (`br-autumn-rain-ad18wq7y`) con los mismos
  parámetros. Esperado: alrededor de 496, 335 y 14 para el período del 12/10/2026 al 26/10/2026.
- [ ] **Step 5:** Commit: `Resumen y lectura de conversaciones del DNX Bot para soporte`.

### Task 4: Motor del diagnóstico

**Files:**
- Create: `apps/compramelafoto/lib/soporte/diagnostico/esquema.ts`
- Create: `apps/compramelafoto/lib/soporte/diagnostico/herramientas.ts`
- Create: `apps/compramelafoto/lib/soporte/diagnostico/guia.ts`
- Create: `apps/compramelafoto/lib/soporte/diagnostico/diagnosticar.ts`
- Test: `apps/compramelafoto/lib/soporte/diagnostico/*.test.ts`

**Interfaces:**
- Consumes: `runBotTurn` y `costMicroUsd` (`@repo/dnx-bot`); `getAnthropicClient`;
  `readBotConfig`; `monthCostMicroUsd`; `toolsForActor`; `herramientasComprador`;
  `ACTOR_MOTOR_COMPRADOR`; `ACCIONES_PERMITIDAS` (Tarea 6; en esta tarea solo se importa la lista
  de nombres desde `lib/soporte/acciones-catalogo.ts`, que se crea acá con el array literal).
- Produces:
  - `ACCIONES_PERMITIDAS = ["reenviar_descarga", "reenviar_link_pack", "reenviar_link_de_descarga", "extender_vencimiento", "cambiar_venta_de_foto", "editar_pack"] as const`,
    en `lib/soporte/acciones-catalogo.ts`.
  - `DiagnosticoIA`, el esquema zod:
    - `categoria`: enum `["FALTA_INFO_BOT", "SE_ACLARA_CON_DATOS", "PROBABLE_ERROR_CODIGO", "OPERATIVO", "OTRO"]`
    - `resumen`: string de 1 a 140 caracteres
    - `hallazgos`: string
    - `respuestaSugerida`: string
    - `acciones`: array de `{ herramienta: enum ACCIONES_PERMITIDAS; input: record; motivo: string; tildada: boolean }`, como máximo 3
    - `confianza`: enum `["ALTA", "MEDIA", "BAJA"]`
  - `LECTURAS_FOTOGRAFO = ["ver_album", "buscar_pedidos", "ver_pedido", "estado_mercadopago", "ver_progreso_escolar"]`
  - `LECTURAS_COMPRADOR = ["buscar_album", "ver_album", "cotizar_fotos", "estado_de_pago", "mis_pedidos", "ver_mi_descarga", "ver_mi_pack"]`
  - `herramientasDeDiagnostico(ticket: TicketParaDiagnostico): Promise<BotTool[]>`. Filtra con esas
    listas y descarta cualquier herramienta con `kind !== "read"`.
  - `type TicketParaDiagnostico = { id: number; reason: string; description: string; requesterRole: string | null; requesterEmail: string | null; internalNote: string | null; conversacion: { id: string; audience: string; buyerEmail: string | null; albumId: number | null; orderId: number | null } | null }`
  - `mailVerificado(t: TicketParaDiagnostico): boolean`. Si hay conversación de comprador, devuelve
    `buyerEmail === requesterEmail`, ignorando mayúsculas. Sin conversación, devuelve `true`,
    porque los formularios exigen sesión.
  - `diagnosticar(t: TicketParaDiagnostico): Promise<{ estado: "LISTO"; resultado: z.infer<typeof DiagnosticoIA>; costMicroUsd: number; mailSinVerificar: boolean } | { estado: "FALLO" | "SIN_PRESUPUESTO"; error: string; costMicroUsd: number }>`

- [ ] **Step 1:** Escribir pruebas:
  - `herramientasDeDiagnostico` nunca incluye `reenviar_descarga`, `reenviar_link_pack`,
    `avisame_cuando_haya_fotos`, `solicitar_quitar_foto` ni `solicitud_de_privacidad`. Tampoco
    ninguna herramienta `write`, aunque el catálogo del bot cambie.
  - Antes de esto se revisan `ver_mi_descarga` y `ver_mi_pack`. Si alguna envía algo, sale de
    `LECTURAS_COMPRADOR` y la prueba la suma a la lista prohibida.
  - Con `monthCostMicroUsd` ≥ `monthlyCapMicroUsd` → `SIN_PRESUPUESTO`, sin llamar a `runBotTurn`.
  - Si `runBotTurn` devuelve un texto que no es JSON válido → `FALLO` con `costMicroUsd` > 0.
  - Si lanza `BotTurnError` → `FALLO` con el costo parcial.
  - Con JSON válido → `LISTO`.
  - Si el mail no está verificado, la guía incluye la regla "no incluyas montos, links ni datos de
    pedidos; pedile que se verifique". Se comprueba buscando ese texto en el `systemGuide` que
    recibe el mock.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
  - Fotógrafo: un `BotActor` armado con el `User` del `requesterEmail`.
  - Comprador: un `CompradorActor`, con `emailVerificado: requesterEmail`, `guestKey: "soporte"`,
    `conversationId` de la conversación (o `"soporte-<id>"`) y `albumId` de la conversación.
  - `runBotTurn` recibe `effort: "low"`, `maxIterations: 6`, `deadlineMs = now + 60_000`,
    `onText` y `onProposal` vacíos, y `proposeWrite`, que lanza un error.
  - La guía (`guia.ts`) explica las categorías y las reglas del bot: no prometer lo que no controla,
    no inventar rutas, español rioplatense y montos en pesos. Pide como respuesta **solo un objeto
    JSON**. El JSON se extrae del último bloque de texto.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Commit: `Motor de diagnóstico automático de reclamos`.

### Task 5: Disparo, guardado, costo y cron del diagnóstico

**Files:**
- Create: `apps/compramelafoto/lib/soporte/diagnostico/lanzar.ts`
- Modify: `apps/compramelafoto/lib/support/create-ticket.ts` (después de crear el ticket)
- Create: `apps/compramelafoto/app/api/admin/support/tickets/[id]/diagnosticar/route.ts` (`POST`)
- Create: `apps/compramelafoto/app/api/cron/soporte/route.ts` y la entrada `vercel.json`
  `{"path":"/api/cron/soporte","schedule":"*/15 * * * *"}`
- Test: `apps/compramelafoto/lib/soporte/diagnostico/lanzar.test.ts`,
  `apps/compramelafoto/app/api/cron/soporte/route.test.ts`

**Interfaces:**
- Consumes: `diagnosticar` (Tarea 4), `aplicarEvento` y `avisarSoporte` (Tarea 2),
  `assertCronAuth`.
- Produces:
  - `diagnosticoEncendido(): boolean`, que lee `CLF_SUPPORT_DIAG_ENABLED === "1"`.
  - `reclamarDiagnostico(ticketId: number, now?: Date): Promise<boolean>`. Hace upsert y
    `updateMany`. Devuelve `false` si ya hay uno `PENDIENTE` de menos de 10 minutos o uno `LISTO`.
  - `lanzarDiagnostico(ticketId: number, opts?: { forzar?: boolean }): Promise<void>`. Reclama,
    carga `TicketParaDiagnostico` (el ticket, más la `BotConversation` con `supportTicketId`), llama
    a `diagnosticar`, guarda `SupportDiagnosis` (estado, campos, `intentos + 1`, costo) y registra
    el costo en `BotUsageDaily` con `actorKey: "soporte:diagnostico"`, `platform: "CLF"` y el día
    argentino, igual que `recordUsage`, así suma al tope mensual. Nunca lanza errores.
  - `correrCronSoporte(now: Date): Promise<{ diagnosticados: number; autoResueltos: number; avisosVencidos: number }>`

- [ ] **Step 1:** Escribir pruebas:
  - `createSupportTicket` con el interruptor encendido programa `lanzarDiagnostico(id)` con `after`.
    Con el interruptor apagado no lo programa. Si `lanzarDiagnostico` falla, el ticket igual se
    devuelve.
  - Dos `reclamarDiagnostico` seguidos → solo el primero devuelve `true`.
  - Con `forzar` se vuelve a diagnosticar aunque esté `LISTO`.
  - El cron:
    - diagnostica como máximo 5 tickets OPEN, IN_PROGRESS o WAITING sin diagnóstico, o con `FALLO`
      e `intentos < 3`; así cubre los 14 tickets abiertos al encenderlo;
    - pasa a RESOLVED los WAITING con `esperandoDesde` de hace más de 3 días, con
      `SIN_RESPUESTA_3_DIAS`;
    - avisa por Telegram los OPEN o IN_PROGRESS vencidos cuyo `vencimientoAvisadoAt` es nulo o
      anterior a `slaDesde ?? createdAt`, y guarda `vencimientoAvisadoAt`. Una segunda corrida no
      vuelve a avisar;
    - responde 401 sin `CRON_SECRET`.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Antes de usar `after` hay que leer la guía de
  `node_modules/next/dist/docs/` y copiar el `try/catch` de `lib/bot/turno-sse.ts:65`. La ruta
  `diagnosticar` es solo para admin y llama a `lanzarDiagnostico(id, { forzar: true })`.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Commit: `Lanzar el diagnóstico al crear reclamos y cron de soporte`.

### Task 6: Ejecutar acciones del catálogo desde la ficha

**Files:**
- Modify: `apps/compramelafoto/lib/soporte/acciones-catalogo.ts` (de la Tarea 4)
- Create: `apps/compramelafoto/lib/soporte/acciones.ts`
- Test: `apps/compramelafoto/lib/soporte/acciones.test.ts`

**Interfaces:**
- Consumes: `toolsForActor`, `herramientasComprador`, `ACTOR_MOTOR_COMPRADOR`,
  `createPendingAction`, `finishAction`.
- Produces:
  - `type AccionPedida = { herramienta: (typeof ACCIONES_PERMITIDAS)[number]; input: Record<string, unknown> }`
  - `ejecutarAccionDeTicket(ticket: { id: number; requesterEmail: string | null; requesterRole: string | null }, accion: AccionPedida, admin: { id: number; name: string | null }): Promise<ToolOutcome>`

- [ ] **Step 1:** Escribir pruebas:
  - Una herramienta fuera de `ACCIONES_PERMITIDAS` → `{ ok:false }` sin ejecutar nada.
  - Un input inválido (`safeParse` falla) → `{ ok:false }`.
  - Un fotógrafo cuyo mail no corresponde a ningún `User` → `{ ok:false }`.
  - Un comprador con `reenviar_descarga` → ejecuta con un `CompradorActor` que tiene
    `emailVerificado` igual al `requesterEmail`. Un pedido de **otro** mail no se reenvía (el mock
    de `reenviarDescargaDePedido` no se llama).
  - Cada ejecución registra un `BotAction` con `summary` que contiene
    `"Aplicada por <admin> desde el ticket #<id>"` y termina con `finishAction` en `EXECUTED` o
    `FAILED`, guardando `before` y `after`.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Para las herramientas `write` se llama directo a `tool.run` (la
  aprobación del admin reemplaza la confirmación). Los límites `LIMITES_ACCIONES` del bot no se
  aplican.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Commit: `Aplicar acciones del bot desde la ficha del reclamo`.

### Task 7: Responder desde la ficha (mail con link y paso a Esperando al cliente)

**Files:**
- Create: `apps/compramelafoto/lib/soporte/token-caso.ts`
- Modify: `apps/compramelafoto/emails/templates/support-reply.ts`
- Create: `apps/compramelafoto/app/api/admin/support/tickets/[id]/responder/route.ts` (`POST`)
- Modify: `apps/compramelafoto/app/api/admin/support/tickets/[id]/messages/route.ts`. Una respuesta
  no interna, sin `markAsResolved`, también aplica `ADMIN_RESPONDIO` y guarda `origen: "ADMIN"`.
- Test: `apps/compramelafoto/lib/soporte/token-caso.test.ts`,
  `apps/compramelafoto/app/api/admin/support/tickets/[id]/responder/route.test.ts`

**Interfaces:**
- Produces (`token-caso.ts`):
  - `crearTokenCaso(ticketId: number, now?: Date): Promise<{ token: string; expiresAt: Date }>`.
    Usa 32 bytes al azar en base64url y guarda `sha256(token)`. Vence a los 30 días.
  - `leerTokenCaso(token: string, now?: Date): Promise<{ ticketId: number } | null>`
  - `urlDeCaso(token: string, requesterRole: string | null): string`. Para un fotógrafo
    (`PHOTOGRAPHER` o `LAB_PHOTOGRAPHER`) devuelve `${APP}/fotografo/soporte?dnxbot_caso=${token}`.
    Para el resto, `${APP}/caso/${token}`. `APP` se resuelve igual que en `getSupportUrlForRole`.
- Produces: `buildSupportReplyEmail({ ..., responderUrl?: string })`. Con `responderUrl`, el mail
  muestra un botón **"Responder"** y no muestra "Ver incidencia y hacer seguimiento". Sin él, queda
  como hoy.
- Produces: `POST /responder`.
  - Body: `{ mensaje: string (1..5000), acciones: AccionPedida[], idempotencyKey: string (uuid), enviarIgual?: boolean }`.
  - Respuesta: `200 { ok: true, mensajeId, acciones: ToolOutcome[] }` o
    `409 { ok: false, fallas: { herramienta, mensaje }[] }`.

- [ ] **Step 1:** Escribir pruebas:
  - Token: uno creado se lee; uno vencido (now + 30 d + 1 ms) → `null`; uno inventado → `null`;
    en la base no queda el token en claro.
  - `/responder`:
    - dos POST con la misma `idempotencyKey` → un solo `SupportMessage`, un solo `sendEmail` y cada
      acción ejecutada una vez; el segundo devuelve el mismo `mensajeId`;
    - si una acción falla → 409, sin mail ni mensaje; con `enviarIgual: true` → envía;
    - con `CLF_SUPPORT_CASE_LINKS_ENABLED=1`, el mail lleva `urlDeCaso(...)`; con el interruptor
      apagado, `getSupportUrlForRole`;
    - tras enviar se aplica `ADMIN_RESPONDIO`;
    - sin admin → 401 o 403.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar. La unicidad de `idempotencyKey` la garantiza la base: si `create`
  falla por clave duplicada, se devuelve el mensaje existente. Las acciones se ejecutan **antes** de
  crear el mensaje, de a una, en orden.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Commit: `Responder reclamos con acciones y link al bot`.

### Task 8: Respuesta del cliente desde su panel

**Files:**
- Modify: `apps/compramelafoto/app/api/support/tickets/[id]/messages/route.ts` (`POST`)
- Test: `apps/compramelafoto/app/api/admin/support/cliente-responde.test.ts` (prueba de esa ruta;
  queda en ese directorio para entrar en el glob)

- [ ] **Step 1:** Escribir pruebas:
  - Un POST del dueño en un ticket WAITING → guarda `origen:"CLIENTE_PANEL"`, aplica
    `CLIENTE_ESCRIBIO_PANEL` (pasa a IN_PROGRESS) y llama a `avisarSoporte` con `"#<id>"`.
  - En RESOLVED → se acepta y se reabre.
  - En CLOSED → se rechaza como hoy.
  - Alguien que no es el dueño → 403, como hoy.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar llamando a `aplicarEvento` después de crear el mensaje.
- [ ] **Step 4:** Correr. Esperado: PASS.
- [ ] **Step 5:** Commit: `La respuesta del cliente desde el panel reabre el reclamo`.

### Task 9: Modo caso del bot (servidor)

**Files:**
- Create: `apps/compramelafoto/lib/soporte/caso-bot.ts`
- Modify: `apps/compramelafoto/app/api/bot/comprador/chat/route.ts`,
  `apps/compramelafoto/app/api/bot/chat/route.ts` (aceptan `casoToken` opcional en el body)
- Create: `apps/compramelafoto/app/api/bot/comprador/caso/route.ts`,
  `apps/compramelafoto/app/api/bot/caso/route.ts` (`GET ?token=`, historia del caso)
- Modify: `apps/compramelafoto/lib/bot/comprador/pagina.ts` (`contextoDePagina` reconoce `/caso/`)
- Test: `apps/compramelafoto/lib/soporte/caso-bot.test.ts`,
  `apps/compramelafoto/app/api/bot/comprador/caso/route.test.ts`

**Interfaces:**
- Consumes: `leerTokenCaso` (Tarea 7), `aplicarEvento` (Tarea 2), `marcarVerificada`,
  `actorDesdeConversacion`, `getOrCreateConversation`.
- Produces:
  - `type ItemCaso = { rol: "usuario" | "bot" | "equipo"; texto: string; autor: string | null; fecha: string }`
  - `historiaDeCaso(ticketId: number): Promise<{ ticket: { id: number; estado: string }; items: ItemCaso[] }>`.
    Junta los textos de la `BotConversation` del ticket con `createdAt <= ticket.createdAt` y los
    `SupportMessage` no internos posteriores, ordenados por fecha. `autor` vale
    `"<nombre> · equipo CompraMeLaFoto"` cuando el origen es ADMIN.
  - `situacionDeCaso(ticketId: number): Promise<string>`. Es el texto que se suma a la situación
    del turno: diagnóstico, respuestas del equipo, acciones aplicadas y estas reglas: presentarse
    como DNX Bot; usar lo que ya se sabe del caso; no prometer lo que no controla; terminar
    preguntando "¿Se solucionó tu problema?"; con "sí", usar `cerrar_caso_resuelto`; si no puede
    resolverlo, usar `pasar_caso_al_equipo` y decir que el equipo le responde por mail.
  - `herramientasDeCaso(ticketId: number): BotTool[]`, con `cerrar_caso_resuelto` (`kind:"read"`,
    input `{}`, aplica `CLIENTE_CONFIRMO_RESUELTO`) y `pasar_caso_al_equipo` (`kind:"read"`, input
    `{ motivo: string }`, aplica `BOT_PASO_AL_EQUIPO`).
  - `espejarTurnoEnTicket(ticketId: number, turno: { turnoId: string; textoUsuario: string; textoBot: string }): Promise<void>`.
    Crea dos `SupportMessage` (`CLIENTE_BOT` y `BOT`) con `idempotencyKey`
    `"<turnoId>:u"` y `"<turnoId>:b"`.
  - `conversacionDeCaso(ticketId: number, audiencia: "BUYER" | "PHOTOGRAPHER", userId: number | null): Promise<{ id: string }>`.
    Busca la `BotConversation` con ese `supportTicketId` y esa audiencia. Si no hay, crea una
    vinculada.

- [ ] **Step 1:** Escribir pruebas:
  - `historiaDeCaso` ordena bien, excluye los mensajes internos y los `tool_result`, y marca el
    autor del equipo.
  - Repetir `espejarTurnoEnTicket` con el mismo `turnoId` no duplica.
  - Chat de comprador con `casoToken` válido → usa `conversacionDeCaso`, le asigna el `guestKey`
    actual, llama a `marcarVerificada(conv, requesterEmail, now + 24 h)`, suma
    `herramientasDeCaso` y `situacionDeCaso`, y aplica `CLIENTE_ESCRIBIO_BOT`.
  - Con token inválido o vencido → responde `{ error: "caso_vencido" }` sin datos del ticket.
  - Chat de fotógrafo con `casoToken` de un ticket cuyo `requesterEmail` no es el de la sesión →
    403.
  - `GET /api/bot/comprador/caso` con token válido → `historiaDeCaso`; con uno inválido → 404 sin
    cuerpo de datos.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Sin `casoToken`, las rutas de chat quedan idénticas a hoy. Al final
  del turno se espeja con el `turnoId` del turno: el id del último `BotMessage` agregado.
- [ ] **Step 4:** Correr `npm run test:bot`, la batería completa. Las pruebas de chat de hoy siguen
  en PASS.
- [ ] **Step 5:** Commit: `Modo caso del DNX Bot para seguir los reclamos`.

### Task 10: Globito con caso abierto, página `/caso/[token]` y panel del fotógrafo

**Files:**
- Modify: `packages/dnx-bot/src/ui/DnxBotBubble.tsx`. Props nuevas: `casoToken?: string` y
  `abrirAlCargar?: boolean`.
- Modify: `apps/compramelafoto/components/bot/CompradorBotBubble.tsx` (pasa las props)
- Create: `apps/compramelafoto/app/caso/[token]/page.tsx`
- Modify: `apps/compramelafoto/components/panels/FotografoLayoutClient.tsx` (lee `dnxbot_caso`)
- Test: `apps/compramelafoto/components/bot/caso-inicial.test.ts`,
  `apps/compramelafoto/app/caso/[token]/page.test.ts`

**Interfaces:**
- Produces: `casoInicial(search: string, almacen: Pick<Storage, "getItem" | "setItem" | "removeItem">): string | null`
  en `packages/dnx-bot/src/ui/`, junto a `campaniaInicial`. Lee `dnxbot_caso`, lo guarda en
  `sessionStorage` para que sobreviva al inicio de sesión y lo borra al usarlo.
- Behavior:
  - Con `casoToken`, el globito hace `GET ${basePath}/caso?token=…`, carga los `ItemCaso` (los de
    `equipo` se muestran con su `autor`), se abre solo y manda `casoToken` en cada POST a `/chat`.
  - Con `caso_vencido`, muestra "El link venció. Te mandamos un código a tu mail para seguir" y
    sigue el flujo de código de hoy.

- [ ] **Step 1:** Escribir pruebas:
  - `casoInicial` con `?dnxbot_caso=abc` guarda y devuelve `"abc"`. Sin parámetro, devuelve lo
    guardado. Al usarlo, lo borra.
  - `page.tsx` con token inválido muestra el texto de link vencido y no consulta el ticket. Con uno
    válido, muestra el globito con `casoToken` y `abrirAlCargar`.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar. La página `/caso/[token]` es mínima: logo, "Consulta #N" y el globito
  abierto. No muestra datos del pedido fuera del chat.
- [ ] **Step 4:** Correr las pruebas y `npm run typecheck`. Esperado: PASS.
- [ ] **Step 5:** Commit: `Abrir el DNX Bot con el caso desde el link del mail`.

### Task 11: Tablero `/admin/soporte` y ficha

**Files:**
- Create: `apps/compramelafoto/app/api/admin/support/tablero/route.ts` (`GET`)
- Modify: `apps/compramelafoto/app/api/admin/support/tickets/[id]/route.ts`:
  - `GET` suma `diagnostico`, `historia` (`historiaDeCaso`), `mailSinVerificar` y `reloj`;
  - `PATCH` usa `aplicarEvento({tipo:"ADMIN_MOVIO", a})`.
- Rewrite: `apps/compramelafoto/app/admin/soporte/page.tsx`
- Modify: `apps/compramelafoto/app/admin/soporte/[id]/page.tsx` (renderiza `FichaTicket`)
- Create: `apps/compramelafoto/components/admin/soporte/ResumenBot.tsx`, `TableroReclamos.tsx`,
  `FichaResumida.tsx`, `FichaTicket.tsx`, `ConversacionesResueltas.tsx`, `columnas.ts`
- Test: `apps/compramelafoto/app/api/admin/support/tablero/route.test.ts`,
  `apps/compramelafoto/components/admin/soporte/columnas.test.ts` (sumar
  `components/admin/soporte/*.test.ts` al config)

**Interfaces:**
- Produces:
  - `COLUMNAS = [{ id: "OPEN", titulo: "Nuevo" }, { id: "IN_PROGRESS", titulo: "En curso" }, { id: "WAITING_CUSTOMER", titulo: "Esperando al cliente" }, { id: "RESOLVED", titulo: "Resuelto" }]`
  - `columnaDe(status) → id`. `CLOSED` cae en `RESOLVED`.
  - `GET /tablero` → `{ ahora: string; fichas: { id; status; reason; titulo; resumen: string | null; rol: "Comprador" | "Fotógrafo" | "Otro"; vieneDelBot: boolean; reloj: ReturnType<typeof estadoReloj>; clienteRespondio: boolean; clienteEscribio: boolean; mailSinVerificar: boolean; fecha: string }[] }`.
    `RESOLVED` y `CLOSED` solo traen los últimos 30 días.
- UI, siguiendo el boceto aprobado:
  - Resumen arriba, con el período seleccionable.
  - Pestañas "Tablero de reclamos (N)" y "Conversaciones resueltas por el bot (N)". La segunda
    aclara: "Se guardan los últimos 90 días".
  - Columnas con arrastre de `@dnd-kit/core`. El cambio se ve al instante y vuelve atrás si el
    `PATCH` falla, como el tablero En curso de FOTOFFICE.
  - Borde de la ficha verde, amarillo o rojo, con el tiempo restante o vencido.
  - Al hacer clic se abre `FichaTicket` en un panel lateral. Contiene:
    - diagnóstico, con la advertencia "Mail sin verificar…" cuando corresponde, el estado
      `FALLO`/`SIN_PRESUPUESTO` y el botón "Volver a diagnosticar";
    - historia de la conversación;
    - acciones, con una casilla cada una;
    - respuesta editable;
    - botones "Enviar y aplicar acciones" y "Solo enviar respuesta". Generan una `idempotencyKey`
      con `crypto.randomUUID()` al abrir el formulario y la conservan en los reintentos.
    - Con un 409, muestra las fallas y el botón "Enviar igual".

- [ ] **Step 1:** Escribir pruebas:
  - `columnaDe("CLOSED") === "RESOLVED"`.
  - `/tablero` excluye los RESOLVED de hace más de 30 días, calcula `reloj` con `now` mockeado y
    pone `mailSinVerificar` desde el diagnóstico.
  - `PATCH` con `WAITING_CUSTOMER` aplica `ADMIN_MOVIO`.
- [ ] **Step 2:** Correr. Esperado: FAIL.
- [ ] **Step 3:** Implementar la API y la UI.
- [ ] **Step 4:** Correr las pruebas y `npm run typecheck`. Después, verificar la UI en el navegador
  con `next dev` y sesión de admin contra la base `.env.local`.
  - Primero comprobar a qué base apunta: en CLF suele ser una rama de auditoría.
  - Datos de prueba solo en esa rama, nunca en producción.
  - Revisar: arrastrar, abrir la ficha, colores del reloj, ancho de celular (375 px) y modo oscuro.
- [ ] **Step 5:** Commit: `Tablero de reclamos por columnas con ficha y diagnóstico`.

### Task 12: Verificación completa y puesta en producción (con permiso de Daniel)

- [ ] **Step 1:** Correr la batería completa: `npm run test:bot`, `npm run typecheck` y `npm run lint`
  en `apps/compramelafoto`. Esperado: todo en verde. Guardar la salida para el informe.
- [ ] **Step 2:** Ejecutar `/code-review` sobre la rama y corregir lo que confirme.
- [ ] **Step 3:** **Pedir permiso a Daniel** y aplicar y registrar la migración
  `20261226120000_soporte_capa_1` con checksum en las bases del schema compartido, como se hizo con
  `20261103120000_dnx_bot`:
  - CLF producción `divine-hall-10689679/br-autumn-rain-ad18wq7y`;
  - `divine-hall` development `br-old-rain`;
  - Clickatón `bitter-math-56019731`;
  - staging `fragrant-union/br-noisy-flower`.
  Va **antes** de fusionar.
- [ ] **Step 4:** Abrir el PR y fusionar cuando esté verde. Pedirle a Daniel que cargue
  `CLF_SUPPORT_DIAG_ENABLED=1` en Vercel. Comprobar en producción que el cron diagnostica los
  tickets abiertos y que el tablero los muestra.
- [ ] **Step 5:** Con el diagnóstico revisado en algunos tickets reales, pedirle a Daniel que cargue
  `CLF_SUPPORT_CASE_LINKS_ENABLED=1`. Probar la ida y vuelta completa con un ticket de prueba suyo:
  responder → mail → "Responder" → bot → "sí" → Resuelto.
