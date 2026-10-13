# DNX Bot en FOTOFFICE · ¿Cuánto Cobro? — Plan de implementación

> **Para quien ejecute:** SUB-SKILL REQUERIDA: superpowers:executing-plans (o subagent-driven-development).
> Los pasos usan casillas (`- [ ]`). TDD en cada tarea: prueba que falla → código mínimo → prueba que pasa →
> commit en español con el trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

**Objetivo:** que el fotógrafo (dueño o admin de una empresa de fotografía) arme su perfil de precios, cotice
trabajos y responda consultas conversando con DNX Bot dentro de FOTOFFICE, sin que el bot invente un solo número.

**Arquitectura:** FOTOFFICE consume `@repo/dnx-bot` (motor de turnos, límites, costo, SSE, Telegram, burbuja) y
copia el molde del bot de CLF en `apps/fotoffice/lib/dnx-bot` (config, store, turno SSE, tope), separando todo por
`platform = "FOTOFFICE:<workspaceId>"` en las tablas `Bot*` que ya existen. Las cuentas las hacen funciones que ya
existen (`lib/precios`, `lib/presupuestos`); el modelo sólo traduce palabras a entradas y elige herramientas.

**Stack:** Next.js 16 (route handlers, `after`), React 19, Prisma (`@repo/db`), zod 4 **del paquete**
(`import { z } from "@repo/dnx-bot"`), vitest 3.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-12-dnx-bot-cuanto-cobro-design.md` (aprobado por Daniel el
12/10 tal cual, con sus cuatro decisiones: tope USD 15/mes FOTOFFICE + USD 10 por workspace + 60 mensajes/día por
persona; sólo dueño/admin calculan y ven costos; al modelo va sólo el nombre de pila del cliente; seguimientos sólo a
pedido. `/cuantocobro` de CLF queda separado).

## División en PR

| PR | Etapa del spec | Contenido | Tareas |
|---|---|---|---|
| **PR 1 · Base** | §17 «0 · Base» | dependencia y `z`, config, puertas, store, límites, tope y Telegram, turno SSE, rutas/guía/situación, registro de herramientas vacío, rutas API, burbuja en `AdminShell`, evento `dnxbot:abrir`, esqueleto de evals | 15 |
| **PR 2 · Etapa 1 · Perfil** | §17 «1 · Perfil» | `motor.ts` (perfil), 3 herramientas de perfil, `source: "dnx-bot"`, `cifras.ts`, tarjeta `calculo`, botón «Armalo conversando», evals 1–5 | 9 |
| **PR 3 · Etapa 2 · Cotizar → presupuesto** | §17 «2» | `motor.ts` (trabajo y reparto), `cotizar_trabajo`, `buscar_consultas`, `ver_presupuesto`, revalidar contexto, `crear_borrador_de_presupuesto`, `sumar_al_borrador`, botones, evals 6–13 | 9 |
| **PR 4 · Etapa 3 · Consultas y seguimientos (+ cierre)** | §17 «3» y «Cierre» | `redactar.ts`, `ver_consulta`, `preparar_mensaje`, `presupuestos_sin_respuesta`, tarjeta `mensaje` y precarga por `sessionStorage`, botones, evals 14–20, limpieza a 90 días | 8 |

Cada PR se fusiona apagado o encendido según §16 del spec; el PR 1 no tiene ningún efecto visible.

## Restricciones globales

- `FOTOFFICE_BOT_ENABLED=1` **y** fila `WorkspaceFeatureModule { moduleKey: "dnx-bot", enabled: true }`: sin las dos, la burbuja no se pinta y `/api/dnx-bot/*` responde 404 (o `{ enabled: false }` en `estado`).
- `dnx-bot` **no** entra a `lib/modules/registry.ts`.
- Modelo `FOTOFFICE_BOT_MODEL` (por omisión `claude-sonnet-5-5`), `FOTOFFICE_BOT_EFFORT` (`medium`), `FOTOFFICE_BOT_MAX_ITERATIONS` (8).
- Topes: `FOTOFFICE_BOT_MONTHLY_CAP_USD` = 15 (todo FOTOFFICE), `FOTOFFICE_BOT_WORKSPACE_MONTHLY_CAP_USD` = 10, `FOTOFFICE_BOT_MAX_MESSAGES_PER_DAY` = 60 por persona.
- Telegram: `FOTOFFICE_BOT_TELEGRAM_TOKEN` + `FOTOFFICE_BOT_TELEGRAM_CHAT_ID`; todo texto empieza con «FOTOFFICE»; nunca datos de clientes ni del perfil.
- `platform`: `"FOTOFFICE:" + workspaceId` en conversación, acción, uso e incidentes del workspace; `"FOTOFFICE"` para las marcas globales. Toda métrica global usa `startsWith("FOTOFFICE:")`.
- Organización: `organizationType` (o `activityType` normalizado) ∈ `PHOTO_STUDIO`, `PHOTOGRAPHY_COMPANY`, `FREELANCE_PHOTOGRAPHER`, `AGENCY_PRODUCTION`.
- Módulos `service-leads` y `quotes` encendidos; al menos «Ver» en Presupuestos. Etapa 1 y todo lo que muestra costos o calcula: `configurar` (dueño o admin).
- Sin migraciones. Sin dependencias nuevas en el lockfile (sólo el enlace `@repo/dnx-bot: workspace:*`). El SDK de Anthropic se usa sólo a través de `@repo/dnx-bot`.
- Esquemas de herramientas: siempre con `z` importada de `@repo/dnx-bot` (zod 4), nunca la `zod` 3 de FOTOFFICE.
- Nada se escribe sin la tarjeta «Confirmar»; el bot no tiene herramienta de envío.
- Ninguna prueba llama a la API real; `bot:eval` gasta plata y se corre sólo con permiso de Daniel.
- Textos en voseo. Sin «Hablar con una persona» (FOTOFFICE no tiene tickets del bot).
- Verificación de cada PR: `pnpm --filter fotoffice test`, `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck`, `pnpm --filter fotoffice build`; si se tocó `packages/dnx-bot`: `pnpm --filter @repo/dnx-bot test`, `pnpm --filter compramelafoto test:bot` y typecheck del paquete.

## Foco de revisión

1. **Cambio de workspace activo a mitad de conversación** → la conversación siguiente nace en el otro workspace; una acción pendiente del workspace A no se confirma desde B (filtro por `platform`). Prueba en la tarea 1.5 (`claimPendingAction` filtra por plataforma) y 1.12.
2. **Clave de Anthropic ausente con el interruptor prendido** → el bot queda apagado sin error para la persona y llega **un** aviso por día a Telegram. Prueba en la tarea 1.4.
3. **Gasto del mes justo en el tope (≥, no >)**, global y por workspace, con el día argentino (no UTC) para el corte de mes. Prueba en las tareas 1.3 y 1.6.
4. **Telegram caído** → la marca única se libera y el aviso se reintenta en el turno siguiente; la respuesta del bot no se demora ni falla. Prueba en la tarea 1.6.
5. **STAFF con «Ver» en Presupuestos pero sin `configurar`** → ve la burbuja, no recibe herramientas de cálculo y la situación le dice a quién pedir. Prueba en las tareas 1.4 y 1.8.

---

# PR 1 · Base

Rama: `feat/fotoffice-dnx-bot-base` (desde `origin/main`, con el spec y este plan). **Antes de tocar
`packages/dnx-bot`:** `git fetch origin && git merge-base --is-ancestor origin/feat/clf-dnx-bot-mascota-animada origin/main || gh pr view 525 --json state`. Si está fusionado, rebase sobre `origin/main`; si no, hacer primero las tareas sólo-FOTOFFICE.

### Tarea 1.1: Dependencia, `transpilePackages` y `z` del paquete

**Archivos:**
- Modificar: `packages/dnx-bot/src/index.ts` (+ `export { z } from "zod";`)
- Modificar: `apps/fotoffice/package.json` (+ `"@repo/dnx-bot": "workspace:*"`)
- Modificar: `apps/fotoffice/next.config.ts` (+ `"@repo/dnx-bot"` en `transpilePackages`)
- Modificar: `pnpm-lock.yaml` (sólo el enlace del importador `apps/fotoffice`)
- Prueba: `apps/fotoffice/lib/dnx-bot/zod-del-paquete.test.ts`

**Interfaces:** produce `import { z, toInputSchema } from "@repo/dnx-bot"` usable en FOTOFFICE.

- [ ] Paso 1: prueba que falla:

```ts
import { describe, expect, it } from "vitest";
import { toInputSchema, z } from "@repo/dnx-bot";

describe("z del paquete", () => {
  it("es zod 4 y convierte a JSON Schema", () => {
    const s = z.object({ horas: z.string().optional(), canal: z.enum(["WHATSAPP", "EMAIL"]) });
    const j = toInputSchema(s);
    expect(j.type).toBe("object");
    expect(j).not.toHaveProperty("$schema");
    expect(typeof z.toJSONSchema).toBe("function");
  });
});
```

- [ ] Paso 2: `pnpm --filter fotoffice exec vitest run lib/dnx-bot/zod-del-paquete.test.ts` → falla (no resuelve `@repo/dnx-bot`).
- [ ] Paso 3: agregar export, dependencia y `transpilePackages`; `pnpm install --prefer-offline` en la raíz; revisar que el diff del lockfile sea sólo el enlace.
- [ ] Paso 4: la prueba pasa; `pnpm --filter @repo/dnx-bot test` y `pnpm --filter compramelafoto test:bot` siguen en verde.
- [ ] Paso 5: commit «Sumar @repo/dnx-bot a FOTOFFICE y exportar z desde el paquete».

### Tarea 1.2: Configuración y plataforma por workspace

**Archivos:** crear `apps/fotoffice/lib/dnx-bot/config.ts`, `dia-argentino.ts`; prueba `config.test.ts`, `dia-argentino.test.ts`.

**Interfaces (produce):**

```ts
export const PLATAFORMA_GLOBAL = "FOTOFFICE";
export const PREFIJO_PLATAFORMA = "FOTOFFICE:";
export const MODULO_DNX_BOT = "dnx-bot";
export function plataformaDe(workspaceId: string): string;          // "FOTOFFICE:<id>"; lanza con id vacío
export function workspaceDePlataforma(p: string): string | null;    // inversa; null si no es de FOTOFFICE
export type LimitesFotoffice = { maxMessagesPerUserPerDay: number; monthlyCapMicroUsd: number; workspaceMonthlyCapMicroUsd: number };
export type BotConfigFotoffice = { enabled: boolean; model: string; effort: "low"|"medium"|"high"; maxIterations: number; limits: LimitesFotoffice; telegram: {token:string;chatId:string}|null; anthropicApiKey: string|null };
export function leerConfigBot(env?: NodeJS.ProcessEnv): BotConfigFotoffice;
// dia-argentino.ts
export function diaArgentino(d?: Date): string;      // "YYYY-MM-DD" en America/Argentina/Buenos_Aires
export function mesArgentino(d?: Date): string;      // "YYYY-MM"
export function mesSiguiente(mes: string): string;   // "2026-12" → "2027-01"
```

- [ ] Paso 1: pruebas: valores por omisión (apagado, `claude-sonnet-5-5`, `medium`, 8, 60, 15 000 000, 10 000 000, sin Telegram, sin clave); `FOTOFFICE_BOT_ENABLED="1"` prende y `"true"` no; números inválidos o negativos caen al valor por omisión; Telegram sólo con token **y** chat; `plataformaDe("ws1") === "FOTOFFICE:ws1"`, `workspaceDePlataforma("CLF") === null`; `diaArgentino(new Date("2026-11-01T02:00:00Z")) === "2026-10-31"`; `mesSiguiente("2026-12") === "2027-01"`.
- [ ] Paso 2: correr → falla. Paso 3: implementar. Paso 4: pasa. Paso 5: commit «Configuración de DNX Bot en FOTOFFICE».

### Tarea 1.3: Límites (tope global, por workspace y por persona)

**Archivos:** crear `lib/dnx-bot/limites.ts`; prueba `limites.test.ts`.

**Interfaces:**

```ts
export type UsoFotoffice = { mensajesHoyPersona: number; gastoMesGlobal: number; gastoMesWorkspace: number };
export type DecisionLimites = { permitido: true } | { permitido: false; motivo: "tope_global" | "tope_workspace" | "diario"; mensaje: string };
export const MENSAJE_TOPE = "Ahora no puedo responder. Podés seguir con el formulario de siempre.";
export const MENSAJE_DIARIO = "Llegaste al máximo de mensajes de hoy. Mañana seguimos.";
export function decidirLimites(l: LimitesFotoffice, u: UsoFotoffice): DecisionLimites;
```

Usa `checkLimits` del paquete para el global y el diario (mismo criterio `>=`), suma el tope por workspace y reemplaza los textos de CLF (que ofrecen «Hablar con una persona»).

- [ ] Paso 1: pruebas: debajo de todo → permitido; global justo en el tope → `tope_global`; workspace justo en el tope → `tope_workspace`; 60 mensajes → `diario`; tope 0 = sin tope; ningún mensaje contiene «Hablar con una persona»; orden global → workspace → diario.
- [ ] Pasos 2–5. Commit «Límites de DNX Bot en FOTOFFICE: global, por workspace y por persona».

### Tarea 1.4: Puertas (acceso)

**Archivos:** crear `lib/dnx-bot/acceso.ts`; prueba `acceso.test.ts`.

**Interfaces:**

```ts
export const TIPOS_DE_EMPRESA: readonly string[]; // PHOTO_STUDIO, PHOTOGRAPHY_COMPANY, FREELANCE_PHOTOGRAPHER, AGENCY_PRODUCTION
export type Capacidades = { configurar: boolean; gestionarPresupuestos: boolean; verConsultas: boolean };
export type CtxBot = CtxPresupuestos & { email: string; nombre: string | null; capacidades: Capacidades; plataforma: string };
export type MotivoApagado = "interruptor" | "sin_clave" | "sin_sesion" | "sin_workspace" | "sin_piloto" | "tipo_de_organizacion" | "modulos" | "sin_permiso";
export type ResultadoPuertas = { ok: true; ctx: CtxBot } | { ok: false; motivo: MotivoApagado };
export function esEmpresaDeFotografia(organizationType: string | null, activityType: string | null): boolean;
export function capacidadesDe(acceso: AccesoEfectivo): Capacidades;
export async function resolverBot(): Promise<ResultadoPuertas>;
```

Orden (§8): interruptor (sin tocar sesión ni base) → clave (sin clave: `avisarSinClave()` una vez por día, tarea 1.6) → sesión + workspace activo + rol de equipo → fila `dnx-bot` → tipo de organización → `service-leads` y `quotes` → «Ver» en Presupuestos. Las capacidades salen de `puede` (`lib/access/policy.ts`), nunca de `canManageWorkspaceSettings` directo (lo prohíbe `workspace-role-consistency.test.ts`).

- [ ] Paso 1: pruebas con `@repo/db`, `@/lib/auth`, `@/lib/workspace`, `@/lib/access/acceso`, `@/lib/modules/gating` mockeados: interruptor apagado → `interruptor` sin llamar a `getAuthUser`; sin clave → `sin_clave` y avisa; sin usuario → `sin_sesion`; sin rol de equipo (socio) → `sin_workspace`; fila apagada → `sin_piloto`; `organizationType` vacío y `activityType` vacío → `tipo_de_organizacion`; `activityType: "studio"` (viejo) pasa; asociación → no pasa; `quotes` apagado → `modulos`; STAFF sin «Ver» en `quotes` → `sin_permiso`; STAFF con «Gestionar» → ok con `configurar: false`; dueño → todas las capacidades; `plataforma === "FOTOFFICE:<ws>"`; el `workspaceId` sale de `resolveActiveWorkspace`, nunca del pedido.
- [ ] Pasos 2–5. Commit «Puertas de DNX Bot en FOTOFFICE».

### Tarea 1.5: Store (conversación, historial, uso, acciones, marcas)

**Archivos:** crear `lib/dnx-bot/store.ts`; prueba `store.test.ts` (Prisma en memoria mockeado).

**Interfaces:**

```ts
export const MAX_MENSAJES_POR_CONVERSACION = 40;
export async function conversacionAbierta(p: { plataforma: string; userId: number; pagePath: string | null; model: string }): Promise<{ id: string }>;
export async function cargarHistorial(conversationId: string): Promise<unknown[]>;
export async function agregarMensajes(conversationId: string, msgs: { role: string; content: unknown }[]): Promise<void>;
export async function registrarUso(p: { plataforma: string; userId: number; conversationId: string; usage: TokenUsage; costMicroUsd: number; contarMensaje: boolean }): Promise<void>;
export async function usoActual(p: { plataforma: string; userId: number; ahora?: Date }): Promise<UsoFotoffice>;
export async function gastoDelMes(p: { plataforma?: string; ahora?: Date }): Promise<number>; // sin plataforma: todo FOTOFFICE (startsWith)
export async function crearAccionPendiente(p: { plataforma: string; conversationId: string; userId: number; toolName: string; input: unknown; summary: string }): Promise<{ actionId: string }>;
export async function tomarAccionPendiente(p: { id: string; plataforma: string; userId: number }): Promise<FilaAccion | null>;
export async function rechazarAccionPendiente(p: { id: string; plataforma: string; userId: number }): Promise<boolean>;
export async function terminarAccion(id: string, r: { status: "EXECUTED" | "FAILED" | "UNDONE"; before?: unknown; after?: unknown; resultMessage: string }): Promise<void>;
export async function accionParaDeshacer(p: { id: string; plataforma: string; userId: number }): Promise<{ id: string; toolName: string; before: unknown; decidedAt: Date | null; conversationId: string | null } | null>;
export async function marcarDeshecha(id: string): Promise<boolean>;
export async function volverAEjecutada(id: string): Promise<void>;
export async function registrarIncidente(p: { plataforma: string; signature: string; title: string; data: unknown; urgent: boolean }): Promise<{ occurrences: number; isNew: boolean }>;
export async function reservarMarca(p: { plataforma: string; signature: string; title: string; data: unknown }): Promise<boolean>;
export async function liberarMarca(p: { plataforma: string; signature: string }): Promise<void>;
```

- [ ] Paso 1: pruebas: la conversación se busca y se crea con la plataforma del workspace y `audience: "PHOTOGRAPHER"`; una conversación con más de 40 mensajes abre otra; `usoActual` suma mensajes de hoy de la persona en **todas** las plataformas `FOTOFFICE:` y gasto del mes global (`startsWith`) y del workspace; `tomarAccionPendiente` filtra por `id`, `userId`, `platform`, `PENDING` y no vencida (foco 1); `reservarMarca` devuelve false ante P2002 y relanza otros errores.
- [ ] Pasos 2–5. Commit «Store de DNX Bot en FOTOFFICE con plataforma por workspace».

### Tarea 1.6: Incidentes, avisos de tope y aviso sin clave (Telegram)

**Archivos:** crear `lib/dnx-bot/incidentes.ts`, `lib/dnx-bot/tope.ts`; pruebas `incidentes.test.ts`, `tope.test.ts`.

**Interfaces:**

```ts
// incidentes.ts
export async function reportarIncidente(p: { plataforma: string; area: string; codigo: string; ids: Record<string, string | number>; detalle: string; urgente: boolean }): Promise<void>;
export async function avisarSinClave(ahora?: Date): Promise<void>;   // marca "sin-clave-YYYY-MM-DD" en "FOTOFFICE"
// tope.ts
export async function avisarTopes(p: { workspaceId: string; ahora?: Date }): Promise<void>;  // nunca lanza
```

`avisarTopes`: 80 % y 100 % del tope global (marca `cap-<pct>-<mes>` en `"FOTOFFICE"`) y del de ese workspace (marca `cap-ws-<pct>-<mes>` en `"FOTOFFICE:<ws>"`); una vez por umbral y mes; si Telegram falla, libera la marca. Textos con «FOTOFFICE», montos en USD, sin datos de clientes. Sin Telegram configurado no reserva nada.

- [ ] Paso 1: pruebas (como `apps/compramelafoto/lib/bot/tope.test.ts`): debajo del 80 % no avisa; 80 % avisa una vez; 100 % avisa ese umbral sin repetir el 80; workspace al 80 % avisa con su marca; Telegram falla → libera y el turno siguiente reintenta (foco 4); mes nuevo vuelve a avisar; el texto empieza con «FOTOFFICE»; `avisarSinClave` avisa una vez por día; incidente urgente nuevo → Telegram, repetido → no.
- [ ] Pasos 2–5. Commit «Avisos por Telegram del tope y de incidentes de DNX Bot en FOTOFFICE».

### Tarea 1.7: Cliente de Anthropic y turno SSE

**Archivos:** crear `lib/dnx-bot/anthropic.ts`, `lib/dnx-bot/turno-sse.ts`; prueba `turno-sse.test.ts`.

**Interfaces:**

```ts
export function clienteAnthropic(): BotStreamClient; // maxRetries 1, timeout 45 s; lanza sin clave
export const FALLA_TURNO = "Tuve un problema para responder. Probá de nuevo en un rato.";
export type TurnoParams = { model; effort; maxIterations; deadlineMs; text; verificarLimites: () => Promise<string|null>; preparar: () => Promise<PreparacionTurno>; registrarUso; proponer; alResultado?; idsDeIncidente; plataforma: string; despuesDelTurno: () => Promise<void> };
export function respuestaDeTurno(p: TurnoParams): Response;
```

Molde de `apps/compramelafoto/lib/bot/turno-sse.ts` sin tickets: los `error` salen con `offerTicket: false`; los incidentes van a `reportarIncidente` con la plataforma del workspace.

- [ ] Paso 1: pruebas con `runBotTurn`, `next/server` (`after`), `./anthropic`, `./store`, `./incidentes` mockeados: corte por límites → `error` sin llamar a la API; turno ok → guarda, registra uso, `done`, corre `despuesDelTurno` en `after`; `BotTurnError` → cobra el uso parcial, reporta incidente y manda `FALLA_TURNO`; ningún evento lleva `offerTicket: true`; `outcome !== "ok"` → error + incidente.
- [ ] Pasos 2–5. Commit «Turno SSE de DNX Bot en FOTOFFICE».

### Tarea 1.8: Rutas permitidas, guía base, contexto y situación

**Archivos:** crear `lib/dnx-bot/rutas.ts`, `lib/dnx-bot/guia/index.ts`, `lib/dnx-bot/guia/identidad.ts`, `lib/dnx-bot/contexto.ts`, `lib/dnx-bot/situacion.ts`; pruebas `rutas.test.ts`, `guia/index.test.ts`, `contexto.test.ts`, `situacion.test.ts`.

**Interfaces:**

```ts
// rutas.ts
export type RutaBot = { ruta: string; proposito: string; pagina: string; requiere: "ver" | "configurar" | "verConsultas" };
export const RUTAS_BOT: readonly RutaBot[]; // las 9 de §6.6
export function rutasPara(c: Capacidades): RutaBot[];
export function prefijosPermitidos(c: Capacidades): string[];
export function seccionPantallas(): string;              // todas: la guía se cachea; la situación dice cuáles no puede abrir
// guia
export function guiaDelBot(): string; // determinística, sin fechas ni datos
// contexto.ts
export const PANTALLAS = ["precios", "presupuestos", "presupuesto", "consulta", "otra"] as const;
export type ContextoPedido = { pantalla: (typeof PANTALLAS)[number]; presupuestoId: string | null; consultaLeadId: string | null };
export function leerContexto(body: unknown, pagePath: string | null): ContextoPedido;
// situacion.ts
export function armarSituacion(p: { rol: string | null; capacidades: Capacidades; contexto: ContextoPedido; workspaceNombre: string | null }): string;
```

- [ ] Paso 1: pruebas: cada ruta tiene su `page.tsx` real (con los grupos `(shell)`); prefijos sin llaves ni duplicados; STAFF sin `configurar` no recibe `/workspace/configuracion/*`; la guía incluye «nunca inventes precios», «no está hecho hasta que toque Confirmar», «no envío mensajes», «si no está en la lista, describí el menú», es igual en dos llamadas y no contiene dígitos de fecha; `leerContexto` acepta sólo pantallas conocidas, recorta ids a 40 caracteres de `[A-Za-z0-9_-]`, y deduce la pantalla del `pagePath` si falta; la situación de un STAFF dice que el cálculo lo usan el dueño y los administradores (foco 5) y nunca incluye correos ni ids crudos del pedido.
- [ ] Pasos 2–5. Commit «Rutas, guía base y situación de DNX Bot en FOTOFFICE».

### Tarea 1.9: Registro de herramientas (vacío) y esqueleto de evals

**Archivos:** crear `lib/dnx-bot/herramientas/index.ts`, `lib/dnx-bot/evals/escenarios.ts`, `scripts/bot-eval.ts`; modificar `apps/fotoffice/package.json` (`"bot:eval"`); pruebas `herramientas/index.test.ts`, `evals/escenarios.test.ts`.

**Interfaces:**

```ts
export function herramientasPara(ctx: CtxBot): BotTool[];  // PR 1: []
export type Escenario = { id; situacion; mensaje; capacidades?: Partial<Capacidades>; debeUsar?; debeUsarAlguna?; noDebeUsar?; textoNoDebeContener?: RegExp[]; entradaEsperada?; cifrasPermitidas?: string[] };
export const ESCENARIOS: Escenario[];  // PR 1: []
export function fallasDeEntrada(e: Escenario, llamadas: LlamadaRegistrada[]): string[];
```

`bot:eval`: `../../packages/db/node_modules/.bin/tsx scripts/bot-eval.ts`; sin `ANTHROPIC_API_KEY` sale con código 2; sin escenarios sale con 0 sin llamar a la API.

- [ ] Paso 1: pruebas: todo esquema de `herramientasPara` (dueño y STAFF) convierte con `toInputSchema`; nombres únicos; las de escritura tienen `describe`; ningún nombre de envío (`enviar*`); escenarios con ids únicos y alguna expectativa; `fallasDeEntrada` detecta un valor distinto.
- [ ] Pasos 2–5. Commit «Registro de herramientas y esqueleto de evaluación de DNX Bot en FOTOFFICE».

### Tarea 1.10: `GET /api/dnx-bot/estado`

**Archivos:** crear `app/api/dnx-bot/estado/route.ts`, `lib/dnx-bot/saludo.ts`; pruebas `app/api/dnx-bot/estado/route.test.ts`, `lib/dnx-bot/saludo.test.ts`.

Respuesta: `{ enabled: false }` si alguna puerta falla; si pasan, `{ enabled: true, saludo, sugerencias }` según `pantalla` (query `?pantalla=`) y capacidades. Sin globito ni progreso (eso es de CLF).

- [ ] Paso 1: pruebas: puertas cerradas → `{ enabled: false }` y status 200; abierto → saludo y sugerencias; STAFF sin `configurar` no recibe la sugerencia «Armar mi perfil de precios».
- [ ] Pasos 2–5. Commit «Ruta de estado de DNX Bot en FOTOFFICE».

### Tarea 1.11: `POST /api/dnx-bot/chat`

**Archivos:** crear `app/api/dnx-bot/chat/route.ts`; prueba `route.test.ts`.

`runtime = "nodejs"`, `dynamic = "force-dynamic"`, `maxDuration = 120`, presupuesto del turno 95 s. Puertas → 404; texto vacío → 400; texto recortado a 2000; contexto con `leerContexto`; límites con `usoActual` + `decidirLimites`; `despuesDelTurno` = `avisarTopes`.

- [ ] Paso 1: pruebas: 404 con puertas cerradas (sin tocar la base); 400 sin texto; con todo abierto arma el turno con la guía, la situación, las herramientas de `herramientasPara(ctx)` y la plataforma del workspace; el `workspaceId` del cuerpo se ignora; límites cortan sin llamar a la API.
- [ ] Pasos 2–5. Commit «Ruta de chat de DNX Bot en FOTOFFICE».

### Tarea 1.12: `POST /api/dnx-bot/acciones/[id]`

**Archivos:** crear `app/api/dnx-bot/acciones/[id]/route.ts`; prueba `route.test.ts`.

`ctx.params` es una promesa. Revalida las puertas (§8). `confirmar` / `rechazar` / `deshacer` (10 min) con el store de la tarea 1.5, siempre filtrando por la plataforma del workspace activo. La herramienta se busca en `herramientasPara(ctx)` (si le sacaron el permiso, no está → falla).

- [ ] Paso 1: pruebas: puertas cerradas → 404; decisión inválida → 400; rechazar ok/409; confirmar ajena o de otro workspace → 409 (foco 1); herramienta inexistente → `FAILED` y 400; `run` ok → `EXECUTED` y mensaje de sistema al historial; deshacer fuera de ventana → 409.
- [ ] Pasos 2–5. Commit «Confirmar, rechazar y deshacer acciones de DNX Bot en FOTOFFICE».

### Tarea 1.13: Burbuja compartida: sin tickets, abrir desde afuera y contexto

**Requisito:** PR 525 (`feat/clf-dnx-bot-mascota-animada`) fusionado y rama rebasada.

**Archivos:** crear `packages/dnx-bot/src/ui/abrir.ts` (+ `abrir.test.ts`); modificar `packages/dnx-bot/src/ui/DnxBotBubble.tsx`, `packages/dnx-bot/src/ui/index.ts`.

**Interfaces:**

```ts
export const EVENTO_ABRIR = "dnxbot:abrir";
export type PedidoAbrir = { texto: string; contexto?: Record<string, string> };
export function leerPedidoAbrir(detail: unknown): PedidoAbrir | null; // texto 1..2000, contexto sólo strings ≤ 100
export function abrirDnxBot(p: PedidoAbrir): void;                     // dispatchEvent en window
// DnxBotBubbleProps: + conTickets?: boolean (true por omisión); + estadoQuery?: string
```

Con `conTickets={false}` no se pinta «Hablar con una persona» ni el aviso con ticket. El evento abre la ventana y manda el texto con `contexto` en el cuerpo del `chat`. CLF no cambia (props opcionales).

- [ ] Paso 1: pruebas de `leerPedidoAbrir` (vacío → null, texto largo → recortado, contexto no-string descartado).
- [ ] Pasos 2–4; además `pnpm --filter @repo/dnx-bot test`, `pnpm --filter @repo/dnx-bot check-types`, `pnpm --filter compramelafoto test:bot`.
- [ ] Paso 5: commit «Burbuja de DNX Bot: sin tickets y apertura desde otra pantalla».

### Tarea 1.14: Burbuja de FOTOFFICE montada en `AdminShell`

**Archivos:** crear `components/dnx-bot/burbuja.tsx`, `components/dnx-bot/preguntale-al-bot.tsx`, `lib/dnx-bot/panel.ts` (+ `panel.test.ts`), `public/dnx-bot/mascota.webp` (la de CLF); modificar `components/shell/admin-shell.tsx`.

`botEnPanel(): Promise<{ rutas: string[] } | null>` usa `resolverBot()`; `AdminShell` pinta `<BurbujaDnxBot rutas={…} />` sólo si no es null. `PreguntaleAlBot` es un botón cliente que llama `abrirDnxBot` (sin usos todavía; los suman los PR 2–4).

- [ ] Paso 1: prueba de `botEnPanel` (puertas cerradas → null; abiertas → prefijos según capacidades).
- [ ] Pasos 2–4; `lib/workspace-role-consistency.test.ts` sigue en verde.
- [ ] Paso 5: commit «Montar la burbuja de DNX Bot en el panel de FOTOFFICE (apagada)».

### Tarea 1.15: Verificación del PR 1 y PR

- [ ] `pnpm --filter fotoffice test`
- [ ] `NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck` (un OOM cuenta como falla)
- [ ] `pnpm --filter fotoffice build`
- [ ] `pnpm --filter @repo/dnx-bot test` · `pnpm --filter @repo/dnx-bot check-types` · `pnpm --filter compramelafoto test:bot`
- [ ] `pnpm install --frozen-lockfile --prefer-offline` en la raíz pasa (el lockfile quedó consistente para todas las apps).
- [ ] Push y PR a `main` en español (sin fusionar).

---

# PR 2 · Etapa 1 · Perfil de precios conversado

### Tarea 2.1: `motor.ts` · perfil

**Archivos:** crear `lib/dnx-bot/motor.ts`, `motor.test.ts`.
**Interfaces:** `aplicarParche(base: CuantoCobroProfileInput, parche: ParchePerfil): CuantoCobroProfileInput`; `simularPerfil(base, parche): { perfil; errores: string[]; resumen: ResumenFormateado; faltan: string[] }`; `esquemaParchePerfil` (con `z` del paquete). Compone `normalizarPerfil`, `validarPerfil`, `resumirPerfil`; montos formateados con `formatCuantoCobroCurrency`.
- [ ] Pruebas: parche vacío sobre `INITIAL_CUANTO_COBRO_PROFILE` deja `faltan` de `resumirPerfil`; mismo resultado que `resumirPerfil` en el formulario (valor hora igual al centavo); gasto por `grupoId`/`itemId` desconocido → error, no se inventa grupo; distribución que no suma → error de `validarPerfil`.
- [ ] Commit.

### Tarea 2.2: Prueba de arquitectura

**Archivos:** crear `lib/dnx-bot/arquitectura.test.ts`: ningún archivo de `lib/dnx-bot/**` importa de `@repo/cuanto-cobro-core` salvo tipos, `formatCuantoCobroCurrency` y `parseCuantoCobroAmount`; ninguno importa `zod` directo; ninguno importa `enviarPresupuesto`, `enviarCorreo` ni `abrirWhatsapp`.
- [ ] Commit.

### Tarea 2.3: `guardarPerfilPrecios(ctx, perfil, { source })`

**Archivos:** modificar `lib/precios/perfil.ts` (+ prueba existente); la pantalla `app/workspace/configuracion/precios` muestra «Armado con DNX Bot» cuando `source === "dnx-bot"`.
- [ ] Prueba: sin opción guarda `"manual"`; con `"dnx-bot"` guarda ese origen; otro valor → rechazo.
- [ ] Commit.

### Tarea 2.4: `ver_perfil_de_precios` y `simular_perfil`

**Archivos:** crear `lib/dnx-bot/herramientas/perfil.ts` (+ test); modificar `herramientas/index.ts` (sólo con `configurar`).
- [ ] Pruebas: STAFF no las recibe; salida con montos formateados; `simular_perfil` no escribe nada (Prisma sin llamadas de escritura) y devuelve `data` para la tarjeta `calculo`.
- [ ] Commit.

### Tarea 2.5: `guardar_perfil_de_precios`

**Archivos:** `herramientas/perfil.ts` (+ test).
- [ ] Pruebas: `describe` lista cada dato cambiado con su etiqueta y «Valor hora: antes $X → ahora $Y»; `run` relee el perfil, aplica, valida y llama `guardarPerfilPrecios(ctx, perfil, { source: "dnx-bot" })`; `before` = perfil anterior; `undo` vuelve a guardarlo; con errores de validación no guarda.
- [ ] Commit.

### Tarea 2.6: Verificador de cifras

**Archivos:** crear `lib/dnx-bot/cifras.ts` (+ test); modificar `turno-sse.ts` (después del turno: si hay cifras no respaldadas → incidente `cifra_no_respaldada`, evento `aviso_cifra`; Telegram al tercero del día).
**Interfaces:** `cifrasDelTexto(t: string): string[]`; `cifrasPermitidas(resultados: unknown[], mensajesPersona: string[]): Set<string>`; `cifrasNoRespaldadas(texto, permitidas): string[]`.
- [ ] Pruebas: `$1.294.000`, `1.294.000 pesos`, `24 %` y `24%` normalizan igual; «450 lucas» del usuario respalda `$450.000`; una cifra inventada aparece en el resultado.
- [ ] Commit.

### Tarea 2.7: Tarjeta `calculo` en la burbuja

**Archivos:** `packages/dnx-bot/src/ui/calculo.ts` (+ test, pura: arma filas desde el `data`), `DnxBotBubble.tsx`, `items.ts`; `app/api/dnx-bot/chat/route.ts` (`alResultado` manda `calculo` desde `simular_perfil`).
- [ ] Pruebas de la función pura + `test:bot` de CLF en verde.
- [ ] Commit.

### Tarea 2.8: Botón «Armalo conversando», aviso de privacidad y guía de la etapa

**Archivos:** `app/workspace/configuracion/precios/page.tsx` (+ `PreguntaleAlBot` sólo si `botEnPanel()` y `configurar`), `lib/dnx-bot/guia/perfil.ts`, `lib/dnx-bot/situacion.ts` (estado del perfil: completo / faltan / origen).
- [ ] Pruebas: la guía incluye el aviso «Lo que me cuentes queda guardado en esta conversación y lo procesa Anthropic» y la regla de preguntar de a uno; la situación incluye `faltan` sin montos de gastos personales.
- [ ] Commit.

### Tarea 2.9: Evals 1–5 y verificación del PR 2

- [ ] Escenarios 1–5 de §10 en `evals/escenarios.ts` (+ test). **No correr `bot:eval` sin permiso de Daniel.**
- [ ] Verificación completa (como 1.15) y PR.

**Notas de ejecución del PR 2 (12/10):**
- La distribución del tiempo se pregunta en horas y el perfil la guarda en porcentajes: la conversión vive en `lib/precios/perfil-datos.ts` (`distribucionDesdeHoras`, `horasPorTarea`), no en `lib/dnx-bot`.
- `herramientasDePerfil(ctx, deps?)` recibe la lectura y el guardado del perfil para que `bot:eval` corra las herramientas de lectura de verdad sobre un perfil de prueba, sin base. `bot:eval` carga `scripts/sin-server-only.mjs` (fuera de Next, `server-only` no existe).
- El verificador de cifras no agrega un evento nuevo a la burbuja: su aviso sale como texto al final del turno (`revisarRespuesta` en `turno-sse.ts`).
- `Escenario` suma `perfil` y `textoDebeContener`; `bot:eval` además exige que toda cifra del texto salga del mensaje o de una herramienta.

---

# PR 3 · Etapa 2 · Cotizar y pasar a presupuesto

### Tarea 3.1: `motor.ts` · trabajo y reparto del total
**Interfaces:** `esquemaTrabajoBot`; `trabajoBotAPanel(t: TrabajoBot): TrabajoPanel` (completa con `trabajoVacio()`); `cotizar(perfil, tipoDeTrabajo, conceptos, precioTotalElegido?)` → `{ estado: "OK"|"PERFIL_INCOMPLETO"|"FALTAN_DATOS"|"INVALIDO"; faltan; conceptos; total }` usando `armarItemsDelAsistente`/`correrMotor`; `repartirTotal(precios: number[], total: number): number[]` (proporcional, el último absorbe el redondeo).
- [ ] Pruebas: perfil incompleto no da precio; `missingFields` del motor tal cual; reparto suma exacto el total. Commit.

### Tarea 3.2: Prueba «bot = panel»
- [ ] Mismo trabajo por `cotizar` y por `armarItemsDelAsistente` del panel → mismos ítems y totales. Commit.

### Tarea 3.3: `cotizar_trabajo` (lectura, `configurar`)
- [ ] Pruebas: emite `calculo`; todo formateado; STAFF no la recibe. Commit.

### Tarea 3.4: `buscar_consultas` y `ver_presupuesto`
- [ ] Pruebas: sólo `nombreDePila` (nunca apellido, teléfono ni correo); hasta 10; `ver_presupuesto` sin costos para quien no tiene `configurar` (usa `leerPresupuesto`). Commit.

### Tarea 3.5: Revalidar el contexto del pedido
**Archivos:** `lib/dnx-bot/contexto.ts` (`revalidarContexto(ctx, contexto)`), `situacion.ts`.
- [ ] Pruebas: id de otro workspace o inexistente → se ignora igual. Commit.

### Tarea 3.6: `crear_borrador_de_presupuesto`
- [ ] Pruebas: `describe` recalcula y arma el texto de §6.2; `run` recalcula y falla si el total cambió («El cálculo cambió desde que te lo mostré: pedímelo de nuevo.»); `crearPresupuesto` → `guardarBorrador` con los ítems del bot en lugar de los precargados; `consultaSinContacto` devuelve la ruta de la consulta; sin `undo`. Commit.

### Tarea 3.7: `sumar_al_borrador` (+ deshacer)
- [ ] Pruebas: sólo versión sin enviar; `before` = ítems previos; `undo` restaura con `guardarBorrador`. Commit.

### Tarea 3.8: Botones «¿Cuánto cobro esto?» y «Calcular con el bot»
- [ ] `app/(shell)/presupuestos/page.tsx` y el editor del borrador; contexto `presupuestoId`. Commit.

### Tarea 3.9: Guía de la etapa, evals 6–13 y verificación del PR 3

**Notas de ejecución del PR 3 (12/10):**
- Arreglo pedido aparte: Configuración → Precios guarda con concurrencia optimista sobre el `updatedAt` existente (sin migración); si el perfil cambió con el formulario abierto (por ejemplo, lo guardó DNX Bot), no se pisa y avisa. El bot guarda y deshace con la misma marca.
- La capa del trabajo vive en `lib/dnx-bot/motor-trabajo.ts` (no en `motor.ts`) y los accesos a la base de las consultas en `lib/dnx-bot/consultas.ts`; la revalidación del contexto en `lib/dnx-bot/contexto-validado.ts`.
- «Si el total cambió, falla»: el total que vio la persona viaja en la entrada de las escrituras (`totalEsperado`, copiado de `totalParaConfirmar` de `cotizar_trabajo`); `describe` y `run` recalculan y comparan.
- `guardarBorrador` reemplaza condiciones, propuesta de pago y descuento con lo que recibe: el bot siempre manda los del borrador actual.
- `buscar_consultas` sólo para quien además configura y no es COLLABORATOR (es para elegir dónde va el borrador). `ver_presupuesto` no cuenta vistas (eso es de la etapa 3).
- Los botones aparecen sólo para quien usa ¿Cuánto Cobro? (`configurar`).
- `Escenario` suma `consultas` (datos de prueba de `buscar_consultas`) y `entradaEnAlguna`.

---

# PR 4 · Etapa 3 · Consultas, seguimientos y cierre

### Tarea 4.1: `redactar.ts`
- [ ] Pruebas: tapa correos, teléfonos (7+ dígitos), URLs, CUIT/DNI; recorta a 1.500. Commit.

### Tarea 4.2: `ver_consulta`
- [ ] Pruebas: `canales` booleanos; mensaje redactado; nombre de pila solamente. Commit.

### Tarea 4.3: `preparar_mensaje`
- [ ] Pruebas: rechaza cifras que no sean variables o cifras ya calculadas; exige `[presupuesto_enlace]` con destino presupuesto; marcadores sin completar → aviso; emite `mensaje`. Commit.

### Tarea 4.4: `presupuestos_sin_respuesta`
- [ ] Exportar `yaTieneSeguimiento` de `lib/presupuestos/seguimiento.ts`; pruebas de `seguimientoAutomatico: "enviado" | "pendiente" | "apagado"`. Commit.

### Tarea 4.5: Tarjeta `mensaje` y precarga por `sessionStorage`
- [ ] `packages/dnx-bot/src/ui/mensaje.ts` (+ test), `components/presupuestos/enviar-presupuesto.tsx` y `components/mensajes/mensaje.tsx` leen `dnxbot:mensaje:{id}` y lo borran; nunca por la URL. `test:bot` de CLF en verde. Commit.

### Tarea 4.6: Botones en la ficha de la consulta y «Seguimientos»

### Tarea 4.7: Guía de la etapa y evals 14–20

### Tarea 4.8: Limpieza a 90 días, revisión de seguridad y verificación
- [ ] `/api/cron/adjuntos` borra `BotConversation` con `platform startsWith "FOTOFFICE:"` y `updatedAt` > 90 días (las de CLF no se tocan). Prueba. Revisión de seguridad. Verificación completa y PR.

**Notas de ejecución del PR 4 (13/10):**
- Pedidos aparte, incluidos: el editor de presupuestos no pisa un borrador que cambió mientras estaba abierto (concurrencia optimista con el `updatedAt` del presupuesto más una firma del contenido del borrador, sin migración; un cambio que sólo mueve la fecha —estado, vistas— no frena) y la mascota de la foto de CLF (`mascota.webp` + `mascota-foto.webp`, `mascotSpriteSrc`).
- La precarga del mensaje de la ficha de la consulta completa el texto con los datos de la ficha: `prepararMensaje` acepta un texto propio además de una plantilla.
- `preparar_mensaje` rechaza todo monto o porcentaje escrito a mano (no sólo los que no salieron del cálculo): el total va siempre como `[presupuesto_total]`.
- `ver_consulta` no informa propuesta modelo ni borrador automático (los presupuestos de la consulta ya muestran lo que hay).
- La limpieza a 90 días corre en `/api/cron/adjuntos` antes del chequeo de R2, así funciona aunque los adjuntos no estén configurados.
- Revisión de seguridad: ver la sección «Revisión de seguridad» del PR 4.
