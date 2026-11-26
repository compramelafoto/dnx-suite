# Bandeja: filtros, derivar, mejoras operativas y Telegram — plan de trabajo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el equipo filtre la Bandeja por quién atiende, estado, canal y campaña; busque por palabra; derive chats; use respuestas rápidas y notas; vea el tiempo de espera y un resumen; y que Daniel atienda por Telegram los chats que tiene asignados.

**Architecture:** Lógica pura en `lib/bandeja/reglas.ts` y en módulos puros nuevos (`filtros.ts`, `espera.ts`, `telegram-bandeja-puro.ts`). Lecturas y acciones de servidor en `lib/bandeja/{lecturas,acciones}.ts`. Pantalla en dos columnas con un componente de lista compartido que reciben las dos páginas. Cuatro etapas: cada una tiene su migración, su PR y su paso a producción.

**Tech Stack:** Next.js (versión con cambios; ver `node_modules/next/dist/docs/`), Prisma (`@repo/db`), Vitest con `crearBaseEnMemoria`, API de Bot de Telegram, Graph API de Meta, Anthropic SDK (el mismo cliente que el bot).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-11-24-bandeja-filtros-derivar-telegram-design.md`

## Global Constraints

- Todo texto de pantalla, commit y PR va en castellano rioplatense y corto. Se dice «dinero», nunca «plata». Las horas se muestran en hora de Argentina.
- El `workspaceId` y el usuario salen siempre del contexto de la sesión (`contextoDeBandeja`) o, en Telegram, de `conexion.connectedByUserId`. Nunca vienen del navegador ni de `callback_data`.
- Nunca se registran en consola textos ni teléfonos.
- Las migraciones van en `packages/db/prisma/migrations/2027030X090000_fotoffice_bandeja_etapaN/` y deben quedar después de `20270302090000`. Se aplican en producción (Neon `br-old-rain-adwthzng`) y se registran con `prisma migrate resolve --applied`.
- Una NOTA (`direccion="NOTA"`) nunca llega al cliente ni al bot. No mueve `ultimoMensajeEn`, `noLeidos` ni la vista previa.
- El `callback_data` de Telegram mide ≤ 64 bytes y lleva el prefijo `bj:`.
- El tope de la lista sigue en `MAXIMO_CHATS = 200`.

## Review Focus

1. Un filtro «Sin asignar» con `NOT`/`not` sobre columnas nulas: en SQL real excluye los NULL. Se usa `asignadoUserId: null` explícito y se prueba la regla pura `quienAtiende`.
2. Una respuesta de Telegram que cita un aviso de **otro** workspace o llega de otro chat de Telegram: se ignora. Lo prueba `telegram-bandeja.test.ts`.
3. Un reintento de Telegram con el mismo `message_id`: no envía dos veces (`clientToken` fijo). Prueba en la etapa 3.
4. Derivar a alguien sin Gestionar, o a un userId de otro workspace: se rechaza. Prueba en `acciones.test.ts`.
5. Una NOTA en el historial del bot, en la vista previa o en los recordatorios: no aparece. Prueba en la etapa 2 (`historial.test.ts` y `acciones.test.ts`).

---

## Etapa 1 (PR 1)

### Task 1: Migración y reglas puras

**Files:** schema `FotofficeWaChat` (+ `resueltoPorUserId Int?`), migración `20270303090000_fotoffice_bandeja_etapa1`, `lib/bandeja/reglas.ts`, `lib/bandeja/reglas.test.ts`, `lib/bandeja/filtros.ts` (nuevo, puro), `lib/bandeja/filtros.test.ts`.

**Produces:**
- `alDerivar(chat: EstadoChat, destino: { tipo: "persona"; userId: number; nombre: string } | { tipo: "bot" }, quien: string): ResultadoRegla | null`. Devuelve `null` si ya está así. A una persona: `{estado:"HUMANO", asignadoUserId, botPausadoHasta:null, resueltoPorUserId:null}`, con el SISTEMA «{quien} se lo derivó a {nombre}». Al bot: el parche de `alDevolver`, con el SISTEMA «{quien} se lo derivó al bot».
- `alResolver(userId, nombre)` suma `resueltoPorUserId: userId`. `alEntrante` sobre RESUELTO suma `resueltoPorUserId: null`. `EstadoChat` gana `resueltoPorUserId?: number | null`.
- En `filtros.ts`:
  - `type FiltrosBandeja = { quien: "todos" | "sin-asignar" | "bot" | number; canal: "todos" | Canal; estado: "abiertos" | "esperando" | "resueltos"; campana: string; q: string }`
  - `leerFiltros(params: Record<string, string | string[] | undefined>): FiltrosBandeja`: traduce el `?filtro=` viejo (`mios` → `quien=<yo>`; `bot`; `sin-asignar`; `resueltos` → `estado=resueltos`). Recibe además `yo: number`.
  - `hrefBandeja(f: FiltrosBandeja, base?: string): string`
  - `quienAtiende(chat, ahora): "bot" | "sin-asignar" | number`

- [ ] Tests: `alDerivar` (a persona, al bot, a quien ya lo tiene → null, desde RESUELTO → HUMANO, `botExcluido` + bot → null). `leerFiltros` traduce `filtro=mios` y descarta valores inventados. `quienAtiende` cubre el HUMANO sin asignado con la pausa vencida (bot), el HUMANO sin asignado sin pausa (sin asignar) y el excluido (sin asignar).
- [ ] Implementar. Correr `npx vitest run lib/bandeja/reglas.test.ts lib/bandeja/filtros.test.ts`: PASS.
- [ ] Commit.

### Task 2: Lecturas — filtros combinados, búsqueda por palabra y personas

**Files:** `lib/bandeja/lecturas.ts`, `lib/bandeja/lecturas.test.ts`, `lib/bandeja/equipo.ts` (nuevo, servidor).

**Produces:**
- `listarChats(ctx, { filtros: FiltrosBandeja, ahora })`. Cada eje es un `where` y van combinados con `AND`:
  - `quien`:
    - `bot` usa el `where` de hoy.
    - `sin-asignar` = `asignadoUserId: null` AND NOT(where bot). Se resuelve trayendo los candidatos y filtrando con `quienAtiende` en memoria, para no usar `NOT` con NULL.
    - Un número = `asignadoUserId`.
  - `estado`:
    - `abiertos` = `estado in [BOT, HUMANO]`.
    - `resueltos` = `RESUELTO`. Con una persona en `quien`, en vez de `asignadoUserId` filtra por `resueltoPorUserId`.
    - `esperando` = abiertos y el último mensaje real es ENTRANTE. Se calcula en memoria con `ultimoEntranteEn >= ultimoMensajeEn - 1s`, porque el último real lo marca `ultimoMensajeEn`. Se ordena por `ultimoEntranteEn asc`.
  - `q`: además de lo de hoy, hace `OR id in (chatIds de FotofficeWaMensaje con direccion in [ENTRANTE,SALIENTE,NOTA] y texto contains q insensitive, take 200)`.
- `ChatDeLista` gana:
  - `fragmento: { antes: string; coincide: string; despues: string } | null`, con ±40 caracteres y armado por la función pura `fragmentoDe(texto, q)` en `vista-previa.ts`;
  - `asignadoUserId`.
- `personasDeLaBandeja(workspaceId): Promise<{ userId: number; nombre: string; puedeOperar: boolean }[]>` en `equipo.ts`: miembros de `WorkspaceMembership` → `resolverAcceso` → nivel de `whatsapp-inbox` ≥ VIEW, ordenados por nombre.
- `contarAbiertosPorPersona(workspaceId): Promise<Map<number, number>>`, con un `groupBy` por `asignadoUserId` sobre los chats abiertos.

- [ ] Tests en `lecturas.test.ts`:
  - `quien=bot`, `quien=sin-asignar` (incluye el excluido y el HUMANO sin pausa) y `quien=2`;
  - `estado=resueltos` con `quien=2` usa `resueltoPorUserId`;
  - `estado=esperando` ordena del que más espera al que menos;
  - `q` encuentra por palabra en un SALIENTE, no encuentra en un SISTEMA y devuelve `fragmento`;
  - se ajustan las pruebas viejas que usaban `filtro`.
- [ ] Implementar y correr `npx vitest run lib/bandeja`: PASS.
- [ ] Commit.

### Task 3: Acción derivar

**Files:** `lib/bandeja/acciones.ts`, `lib/bandeja/acciones.test.ts`, `app/actions/bandeja.ts`.

**Produces:** `derivar(ctx, chatId, destino: unknown, deps?)`. El destino es `"bot"` o un userId numérico.
- Valida que el destino sea miembro del workspace con `operar` en `whatsapp-inbox`. Si no, devuelve `MENSAJES_BANDEJA.destinoInvalido` = «Esa persona no puede atender la Bandeja.».
- Si el chat tiene `botExcluido` y el destino es `"bot"`, devuelve `MENSAJES_BANDEJA.botExcluido` = «El bot no atiende este número.».
- Usa `transicion()` con `alDerivar`. `resolver()` pasa a guardar `resueltoPorUserId`.
- `derivarAction(chatId, destino)`. La dependencia `deps.puedeAtender?(userId) => Promise<{ nombre: string } | null>` se inyecta en las pruebas.

- [ ] Tests:
  - derivar a una persona deja HUMANO, su asignado y el SISTEMA;
  - a alguien sin permiso o de otro workspace → error;
  - al bot con `botExcluido` → error;
  - desde RESUELTO lo reabre;
  - `resolver` guarda `resueltoPorUserId`.
- [ ] Implementar, correr las pruebas: PASS. Commit.

### Task 4: Pantalla en dos columnas

**Files:**
- Nuevos: `components/bandeja/panel-de-lista.tsx` (servidor: filtros + lista) y `components/bandeja/filtros-bandeja.tsx` (cliente: chips en escritorio y `<select>` en el celular; cambia la URL con `router.replace`).
- Nuevo: `components/bandeja/derivar-a.tsx` (cliente: menú).
- Se modifican `botones-del-chat.tsx`, `lista-de-chats.tsx` (chip de quién atiende, fragmento resaltado con `<mark>` y enlace que conserva los filtros), `app/(shell)/bandeja/page.tsx` y `app/(shell)/bandeja/[chatId]/page.tsx`.
- Se borra `filtros-y-busqueda.tsx`.

**Decisión:** las dos páginas reciben `searchParams` y dibujan `<PanelDeLista>`. En `/bandeja/[chatId]` la lista va oculta debajo de `lg`. Los layouts no reciben `searchParams`, por eso no se usa un layout. El chat ocupa `h-[calc(100dvh-…)]`, con la conversación en `flex-1 overflow-y-auto` y la caja abajo.

- [ ] Leer en `node_modules/next/dist/docs/` lo que dice sobre `searchParams` y `useSearchParams`.
- [ ] Implementar. Correr `npx tsc --noEmit -p tsconfig.json` (filtrando `bandeja`) y `npx eslint components/bandeja app/(shell)/bandeja`.
- [ ] Verificar en el navegador local (`preview_start`) contra la base de desarrollo, o con el simulador si no hay datos. Tomar una captura de escritorio y otra del celular.
- [ ] Commit, PR 1, migración en producción, merge cuando CI esté en verde.

## Etapa 2 (PR 2)

### Task 5: Notas internas

**Files:** `constantes.ts` (`DIRECCIONES` + `"NOTA"`), `acciones.ts` (`agregarNota(ctx, chatId, texto)`: Gestionar, ≤ 4096, sin tocar `ultimoMensajeEn`), `app/actions/bandeja.ts`, `burbuja-de-mensaje.tsx` (burbuja amarilla centrada), `caja-de-respuesta.tsx` (pestañas «Responder» / «Nota interna»).

Hay que revisar todo `direccion` con `grep -rn "direccion" lib/bandeja`. `historial.ts` salta las NOTA. Los recordatorios y `auto-decision` ya filtran por ENTRANTE/SALIENTE: se confirma con una prueba.

- [ ] Tests:
  - `agregarNota` guarda una NOTA y no cambia `ultimoMensajeEn`, `noLeidos` ni la vista previa;
  - sin Gestionar → error;
  - `historial` no incluye NOTA;
  - una NOTA después de un ENTRANTE no frena «esperando».
- [ ] Implementar, probar y hacer commit.

### Task 6: Tiempo de espera

**Files:** `lib/bandeja/espera.ts` (puro) y su test. Se agrega a la fila de la lista y al encabezado del chat.

**Produces:** `esperaDe(chat: { ultimoEntranteEn; ultimoMensajeEn; estado; atiendeElBot }, ahora): { minutos: number; nivel: "normal" | "atencion" | "urgente" } | null`. Los cortes son 15 y 60 minutos. Devuelve `null` si lo atiende el bot, si está resuelto o si el último real no es entrante.

- [ ] Tests de bordes: 14, 15, 60 y 61 minutos; bot; resuelto. Implementar y hacer commit.

### Task 7: Respuestas rápidas

**Files:**
- Modelo `FotofficeWaRespuestaRapida`, con `@@unique([workspaceId, atajo])`.
- `lib/bandeja/respuestas-rapidas.ts`: `listarRespuestas(ctx)`, `guardarRespuesta(ctx, datos)`, `borrarRespuesta(ctx, id)` (`configurar` para escribir, Ver para leer) y la función pura `aplicarVariables(texto, { nombre })`.
- Pantalla en Configuración → WhatsApp, siguiendo el patrón de la página de configuración existente.
- Selector en `caja-de-respuesta.tsx`: `/` al principio o el botón ⚡ abren la lista e insertan el texto.

- [ ] Tests:
  - el atajo inválido (espacios, mayúsculas, más de 30) se rechaza;
  - `{nombre}` se reemplaza y, si falta, queda vacío;
  - otro workspace no ve las respuestas.
- [ ] Implementar y hacer commit.

### Task 8: Resumen y «Nuevo para vos»

**Files:**
- Columnas `resumen String?`, `resumenEn DateTime?` y `derivadoSinVerUserId Int?`, en la migración `20270304090000_fotoffice_bandeja_etapa2`, junto con la tabla de la Task 7.
- `lib/bandeja/resumen.ts`: `generarResumen(workspaceId, chatId, deps)`. Usa el cliente y el modelo de `lib/bandeja/bot/` y respeta el tope de `uso.ts`. Lee los últimos 40 mensajes ENTRANTE/SALIENTE/NOTA, usa `max_tokens` 300 y guarda ≤ 800 caracteres. Nunca lanza.
- `derivar` a persona pone `derivadoSinVerUserId` y llama a `after(() => generarResumen(...))`.
- `marcarLeido` borra `derivadoSinVerUserId` si coincide con `ctx.userId`.
- `actualizarResumenAction`.
- Tarjeta plegable arriba de la conversación.
- El menú suma los «derivados a mí sin ver» (se busca dónde se calcula hoy el número de la Bandeja en el menú).

- [ ] Tests:
  - `generarResumen` con el cliente simulado guarda el texto recortado;
  - con el tope agotado no llama;
  - si falla, no lanza;
  - `marcarLeido` borra la marca sólo para su persona.
- [ ] Implementar, verificar en el navegador, hacer commit. PR 2, migración en producción y merge.

## Etapa 3 (PR 3)

### Task 9: Lógica pura de Telegram para la Bandeja

**Files:** `lib/bandeja/telegram-puro.ts` y su test.

**Produces:**
- `tarjetaDeDerivacion({ quien, titulo, canal, campana, resumen, ultimos, espera, ventanaHasta }): string` (HTML de Telegram escapado);
- `avisoDeMensaje(titulo, tipo, texto): string`;
- `botonesDelChat(chatId, urlBase): BotonInline[][]`;
- `botonesDerivar(chatId, personas): BotonInline[][]`;
- `leerBotonBandeja(data: string): { accion: "dv" | "r"; chatId } | { accion: "d"; chatId; destino: number | "bot" } | { accion: "t"; avisoId } | null`. Valida los ids con `^[A-Za-z0-9_-]{1,40}$` y el tamaño ≤ 64.

`lib/telegram/webhook.ts`: `RESPUESTA` acepta hasta 4096 caracteres y acepta textos con «/». Se agrega el tipo `RESPUESTA_NO_TEXTO`. Se revisa que el canal de agentes siga recortando por su cuenta.

- [ ] Tests:
  - escapar `<&>`;
  - `callback_data` ≤ 64 bytes con ids de 25 caracteres;
  - `leerBotonBandeja` rechaza datos inventados;
  - `leerUpdate` con 3000 caracteres, con «/hola» y con una foto citada.
- [ ] Implementar y hacer commit.

### Task 10: Envío a Telegram y respuesta citando

**Files:**
- Modelo `FotofficeWaTelegramAviso` (con `textoPendiente String?`).
- `FotofficeTelegramConexion.bandejaActiva Boolean @default(true)`.
- Migración `20270305090000_fotoffice_bandeja_etapa3`.
- `lib/bandeja/telegram.ts` (servidor):
  - `avisarDerivacion(workspaceId, chatId, quien)` espera el resumen hasta 8 s;
  - `avisarEntrante(workspaceId, chatId, mensaje)`;
  - `atenderRespuesta(conexion, update)`;
  - `atenderBoton(conexion, update)`;
  - `ctxDeConexion(conexion)` arma `CtxBandeja` con `resolverAcceso(connectedByUserId)`.
- Enganches:
  - `derivar` (destino = dueño de la conexión y quien deriva es otra persona) → `after(avisarDerivacion)`;
  - el registro del ENTRANTE en `lib/bandeja/registro.ts` y en el webhook de Instagram → `after(avisarEntrante)` si `asignadoUserId === connectedByUserId`;
  - `app/api/webhooks/telegram/[conexionId]/route.ts`: RESPUESTA → `atenderRespuesta`; BOTON con `bj:` → `atenderBoton`; RESPUESTA_NO_TEXTO → aviso «sólo texto».
- Interruptor en la pantalla de configuración de Telegram.

- [ ] Tests (con `mandarMensaje` y `responder` inyectados):
  - cita conocida → responde con el token `tg-<conexion>-<msgId>` y contesta «✅ Enviado a…»;
  - cita desconocida → nada;
  - otro chat de Telegram → nada;
  - mismo `message_id` dos veces → un solo envío;
  - chat de otra persona → guarda `textoPendiente` y manda el botón «Tomarlo y enviar»;
  - fuera de ventana → mensaje y botón «Abrir»;
  - botón `bj:d` con un chat de otro workspace → «No encontramos ese chat»;
  - `bandejaActiva=false` → no se envía nada.
- [ ] Implementar y hacer commit. PR 3, migración en producción y merge.
- [ ] Verificar en producción que `connectedByUserId` sea 4 (SQL de lectura).

## Etapa 4 (PR 4)

### Task 11: Campañas

**Files:**
- Modelo `FotofficeMetaAnuncio` y `FotofficeWaChat.anuncioId String?` con índice `[workspaceId, anuncioId]`.
- Migración `20270306090000_fotoffice_bandeja_etapa4`, con el relleno en SQL desde `media->'anuncio'->>'id'` del último mensaje con anuncio de cada chat.
- `lib/bandeja/campanas.ts`:
  - `consultarAnuncio(workspaceId, adId, deps)` llama a `GET /{adId}?fields=name,adset{name},campaign{id,name}` con el token de `leerConexion`. Nunca lanza y guarda `error`.
  - `campanasRecientes(ctx)` trae los últimos 90 días, ordenados por cantidad.
  - `reintentarAnuncios()` cubre hasta 7 días.
- El webhook de WhatsApp pone `anuncioId` (el más reciente) y `after(consultarAnuncio)` si es nuevo.
- Filtro `campana` en `listarChats` (`<campaignId>`, `ad:<adId>` para los que no tienen campaña, `sin-anuncio`) y chip en la fila.
- Reintento diario en el cron existente de la Bandeja (se busca en `vercel.json`).

- [ ] Tests:
  - `consultarAnuncio` con un fetch simulado OK, con error 403 y con red caída;
  - el filtro por campaña y «sin anuncio»;
  - el relleno no pisa un `anuncioId` existente.
- [ ] Implementar y hacer commit. PR 4, migración en producción, relleno y una consulta real a Meta para los anuncios existentes. Si falta `ads_read`, se le deja la tarea a Daniel.
