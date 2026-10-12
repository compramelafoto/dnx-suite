# DNX Bot — Etapa 2 (escolar y saludos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que DNX Bot salude a cada fotógrafo según su situación (nuevo, sin ventas, sin escolar, escolar a medias), acompañe paso a paso el armado de un álbum escolar haciendo los pasos posibles con confirmación, y llegue por mail a quienes no entran.

**Architecture:** Todo vive sobre la etapa 1 (en producción). Cálculos puros y deterministas en `apps/compramelafoto/lib/bot/escolar/` y `lib/bot/segmentos.ts` (sin IA); `/api/bot/estado` devuelve el globito y el progreso; `/api/bot/globito` registra lo que hace el fotógrafo en la tabla nueva `BotOutreach`; herramientas nuevas reutilizan lógica extraída de las rutas escolares existentes; un cron manda mails (apagado por defecto).

**Tech Stack:** Next.js 16.2.1, React 19, Prisma 6 (`@repo/db`), zod 4, `@repo/dnx-bot` (motor, burbuja), vitest, Resend vía `lib/email-queue.ts`.

**Spec:** `apps/compramelafoto/docs/superpowers/specs/2026-10-12-dnx-bot-escolar-y-saludos-design.md` (aprobada por Daniel el 12/10/2026).

## Global Constraints

- Todas las de la etapa 1 siguen vigentes (`docs/superpowers/plans/2026-10-11-dnx-bot-etapa-1.md` → Global Constraints): escritura sólo por propuesta + Confirmar, dueño verificado en run/undo/describe, pesos enteros, hora argentina, historial sólo se agrega, sin `thinking: disabled` ni `tool_choice` forzado.
- Saludo por hora argentina: «Buen día» 05:00–12:59, «Buenas tardes» 13:00–19:59, «Buenas noches» 20:00–04:59.
- Campañas: `nuevo`, `sin_ventas`, `sin_escolar`, `escolar_en_curso`. Prioridad: `escolar_en_curso` → `nuevo` → `sin_ventas` → `sin_escolar`. Una campaña por vez.
- Globito: nunca abre la ventana solo. `DECLINED` («No, gracias») suprime esa campaña 90 días; `DISMISSED` (cerrar) suprime 7 días; `CLICKED` suprime la campaña salvo `escolar_en_curso` (que vuelve a mostrarse cada día mientras haya pasos pendientes y no esté DISMISSED/DECLINED en ese plazo).
- Mail: sólo `marketingOptIn = true`, `lastLoginAt` nulo o de hace 30+ días, máximo 50 por corrida, un mail por campaña y fotógrafo, enlace de baja `/unsubscribe?token=…`, interruptor `CLF_BOT_OUTREACH_EMAIL_ENABLED=1` (apagado por defecto).
- Acciones que mandan mails a terceros (invitar a la escuela, avisar a familias) **no se pueden deshacer** y lo dicen en la tarjeta.
- Refactors de rutas en producción sin cambio observable, con tests de caracterización sobre el handler real (como la etapa 1).
- Regla nueva del proyecto (Task 11): cambiar cómo funciona algo en CLF ⇒ actualizar `lib/bot/guia/*`.

## Review Focus

1. **Escuela o álbum ajeno:** vincular un álbum a una escuela de otro fotógrafo, invitar en una escuela ajena o avisar familias de un álbum ajeno → rechazado sin revelar existencia. Tests en Tasks 6 y 7.
2. **Mails a terceros por error:** la tarjeta de `invitar_admin_escuela` y `avisar_familias_fotos_listas` dice a quién y cuántos; `avisar_familias` se niega si el álbum no tiene fotos. Tests en Task 7.
3. **Globito molesto o repetido:** recargar el panel no repite una campaña rechazada; dos pestañas no generan dos filas; nunca se abre solo. Tests en Tasks 3 y 4.
4. **Mail a quien no quiere:** sin `marketingOptIn`, dado de baja o ya contactado → no sale; interruptor apagado → no sale nada. Tests en Task 9.
5. **Progreso escolar engañoso:** un álbum `mode = SCHOOL` sin `schoolId` se informa como «a medias», no como avanzado; pasos opcionales no bloquean. Tests en Task 2.

---

## File Structure

```
packages/db/prisma/schema.prisma                                 + BotOutreach, enums
packages/db/prisma/migrations/20261104120000_dnx_bot_outreach/migration.sql
packages/dnx-bot/src/engine.ts                                   + onToolResult opcional
packages/dnx-bot/src/ui/{DnxBotBubble.tsx,items.ts,globito.ts}   globito + tarjeta de progreso
apps/compramelafoto/
  lib/bot/saludo.ts                       saludoPorHora (puro)
  lib/bot/segmentos.ts                    elegirCampania (puro) + cargarDatosSegmento (Prisma)
  lib/bot/outreach.ts                     registrar/leer BotOutreach
  lib/bot/escolar/progreso.ts             computeSchoolSetupProgress
  lib/bot/escolar/herramientas.ts         herramientas escolares
  lib/schools/school-setup.ts             createSchoolForOwner, createSchoolCoursesForOwner (extraído)
  lib/albums/album-school-settings.ts     buildAlbumSchoolSettingsUpdateData + updateAlbumSchoolSettingsForOwner (extraído)
  lib/email-marketing/unsubscribe-token.ts ensureUnsubscribeToken (extraído)
  lib/bot/outreach-email.ts               texto del mail + selección de destinatarios
  app/api/bot/estado/route.ts             + globito y progreso
  app/api/bot/globito/route.ts            POST acción del globito
  app/api/cron/bot-outreach/route.ts      envío diario de mails
  lib/bot/guia/conocimiento.ts            + Venta escolar
  lib/bot/contexto.ts                     + alerta mode SCHOOL sin escuela
  lib/bot/resumen.ts                      + métricas de saludos/mails/escolar
  lib/bot/evals/escenarios.ts             + 3 escenarios escolares
  CLAUDE.md                               regla de la guía del bot
  vercel.json                             + cron bot-outreach
```

---

### Task 1: Tabla `BotOutreach`

**Files:** Modify `packages/db/prisma/schema.prisma`; Create `packages/db/prisma/migrations/20261104120000_dnx_bot_outreach/migration.sql`.

**Interfaces — Produces:** model `BotOutreach`; enums `BotOutreachChannel { PANEL EMAIL }`, `BotOutreachStatus { SHOWN CLICKED DISMISSED DECLINED SENT FAILED }`.

- [ ] **Step 1:** Agregar al final del esquema (junto a los modelos Bot*):

```prisma
enum BotOutreachChannel {
  PANEL
  EMAIL
}

enum BotOutreachStatus {
  SHOWN
  CLICKED
  DISMISSED
  DECLINED
  SENT
  FAILED
}

model BotOutreach {
  id        String             @id @default(cuid())
  platform  String
  userId    Int
  campaign  String
  channel   BotOutreachChannel
  status    BotOutreachStatus
  answer    String?
  createdAt DateTime           @default(now())
  updatedAt DateTime           @updatedAt

  @@unique([platform, userId, campaign, channel])
  @@index([platform, campaign, status])
}
```

- [ ] **Step 2:** Generar el SQL con `git show HEAD:packages/db/prisma/schema.prisma > /tmp/antes.prisma` + `prisma migrate diff --from-schema-datamodel /tmp/antes.prisma --to-schema-datamodel prisma/schema.prisma --script`, y hacerlo idempotente (`CREATE TABLE IF NOT EXISTS`, `CREATE [UNIQUE] INDEX IF NOT EXISTS`, `CREATE TYPE` dentro de `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$;`). Sólo objetos `BotOutreach*`.
- [ ] **Step 3:** `prisma validate` y `db:generate` (con `DATABASE_URL`/`DIRECT_URL` falsos); `tsc --noEmit` de CLF con 8 GB.
- [ ] **Step 4:** Commit «Agregar la tabla de saludos y mails de DNX Bot».

---

### Task 2: Progreso escolar (11 pasos)

**Files:** Create `apps/compramelafoto/lib/bot/escolar/progreso.ts`, `progreso.test.ts`. Add path to `vitest.bot.config.ts` include if not covered by `lib/bot/**`.

**Interfaces — Produces:**
```ts
export type PasoEscolarId = "escuela" | "cursos" | "admin_escuela" | "album_vinculado" | "identificacion" | "preventa" | "plantillas" | "comision" | "preventa_publicada" | "fotos_y_aviso" | "entrega";
export type EstadoPaso = "hecho" | "pendiente" | "no_aplica";
export type PasoEscolar = { n: number; id: PasoEscolarId; titulo: string; estado: EstadoPaso; opcional: boolean; enlace: string | null; detalle?: string };
export type ProgresoEscolar = { albumId: number | null; albumTitulo: string | null; schoolId: number | null; pasos: PasoEscolar[]; hechos: number; total: 11; siguiente: PasoEscolar | null; aMedias: boolean };
export async function computeSchoolSetupProgress(userId: number, albumId?: number): Promise<ProgresoEscolar>;
```

Reglas (de la spec §5 y del relevamiento):
- Álbum objetivo: `albumId` si es del usuario (y `deletedAt` nulo); si no, el más reciente del usuario con `schoolId` no nulo **o** `mode = "SCHOOL"`; si no hay, `albumId: null` y los pasos 4–11 `pendiente`.
- `aMedias = album.mode === "SCHOOL" && album.schoolId == null`.
- Escuela objetivo: `album.schoolId` si existe; si no, la escuela más reciente con `ownerId = userId`.
- 1 `escuela`: existe escuela objetivo. Enlace `/fotografo/escuelas/nueva` si no, `/fotografo/escuelas/{id}` si sí.
- 2 `cursos`: `schoolCourse.count({schoolId}) > 0` **o** existe `studentEnrollment` de esa escuela. Enlace `/fotografo/escuelas/{id}`.
- 3 `admin_escuela` (opcional): invitación `PENDING` con `expiresAt > now` o `schoolOrganizer` `ACTIVE`. Detalle «invitación enviada» / «activo».
- 4 `album_vinculado`: álbum con `mode === "SCHOOL"` y `schoolId` no nulo. Enlace `/dashboard/albums/new` sin álbum, o `/dashboard/albums/{id}?tab=configuracion`.
- 5 `identificacion`: `studentIdentificationMode` no nulo; si es `ROSTER_OPTIONAL`/`ROSTER_REQUIRED` además `albumStudentRosterEntry.count({albumId, isActive:true}) > 0`. Enlace `?tab=escuela`.
- 6 `preventa`: `packDefinition` del álbum con `isActive` y al menos un `benefits`. Enlace `?tab=preventa`.
- 7 `plantillas`: `no_aplica` si no hay beneficios `kind PHYSICAL` con `templatePolicy REQUIRED`; si hay, `hecho` cuando todos tienen `templateV2Id ?? templateId`. Enlace `?tab=preventa`.
- 8 `comision` (opcional): `organizerCommissionEnabled && (organizerCommissionPercentage ?? 0) > 0`. Enlace `?tab=comision-escolar`.
- 9 `preventa_publicada`: `listActivePacksForPublicCatalog(albumId, now, { hasPhotos })` (de `lib/preventa-canjeable/pack-service.ts`) devuelve ≥1. Enlace `?tab=publicacion&pub=compartir`.
- 10 `fotos_y_aviso`: `photo.count({albumId, isRemoved:false}) > 0` **y** algún `order` del álbum con `origin: "PREVENTA_PACK"`, `status: "PAID"`, `isTest: false` y `redemptionPaymentRefsJson.fotosListasAvisoAt` no nulo (leer con Prisma JSON path o traer los pedidos y mirar en JS, acotado con `take: 200`). Detalle: «X fotos · aviso enviado/no enviado». Enlace `?tab=fotos`.
- 11 `entrega`: ítems `preCompraOrderItem` de pedidos del álbum (no `isTest`, pedido no `CANCELED`): `hecho` si hay ≥1 y todos `DELIVERED`; `pendiente` con detalle «N por entregar» si hay alguno no entregado; `no_aplica` si no hay ítems. Enlace `/fotografo/escuelas/pedidos`.
- `hechos` cuenta `hecho` + `no_aplica`; `siguiente` = primer paso `pendiente` **no opcional**, o el primero opcional pendiente si no queda ninguno obligatorio.
- Verificar cada nombre de campo/relación contra el esquema antes de escribir; si difiere, adaptar y anotar.

- [ ] **Step 1: Tests que fallan** (mock de `@/lib/prisma` y de `@/lib/preventa-canjeable/pack-service`), uno por caso:
  - sin escuela ni álbum → paso 1 pendiente, `siguiente.id === "escuela"`, `albumId === null`;
  - álbum `mode SCHOOL` sin `schoolId` → `aMedias === true` y paso 4 pendiente;
  - álbum ajeno pasado por `albumId` → se ignora (consulta filtra `userId`);
  - roster requerido sin entradas → paso 5 pendiente; `MANUAL` → hecho;
  - sin beneficios físicos REQUIRED → paso 7 `no_aplica`;
  - comisión y admin pendientes no son `siguiente` si hay obligatorios pendientes;
  - todo completo → `siguiente === null`, `hechos === 11`.
- [ ] **Step 2:** correr y ver fallar. **Step 3:** implementar. **Step 4:** pasar `test:bot` + `tsc`. **Step 5:** commit «Calcular el progreso del armado escolar para DNX Bot».

---

### Task 3: Saludo y elección de campaña

**Files:** Create `apps/compramelafoto/lib/bot/saludo.ts`, `lib/bot/segmentos.ts`, `lib/bot/outreach.ts` y sus tests.

**Interfaces — Produces:**
```ts
// saludo.ts
export function saludoPorHora(now: Date): "Buen día" | "Buenas tardes" | "Buenas noches"; // hora argentina
// outreach.ts
export type Campania = "nuevo" | "sin_ventas" | "sin_escolar" | "escolar_en_curso";
export async function registrarOutreach(p: { userId: number; campaign: Campania; channel: "PANEL" | "EMAIL"; status: "SHOWN" | "CLICKED" | "DISMISSED" | "DECLINED" | "SENT" | "FAILED"; answer?: string }): Promise<void>; // upsert por (platform,userId,campaign,channel)
export async function leerOutreachPanel(userId: number): Promise<Array<{ campaign: string; status: string; updatedAt: Date }>>;
// segmentos.ts
export type DatosSegmento = { nombre: string | null; registradoHace: number /*días*/; tieneAlbum: boolean; vendio: boolean; tuvoEscolar: boolean; progreso: ProgresoEscolar | null; outreach: Array<{ campaign: string; status: string; updatedAt: Date }> };
export type Globito = { campaign: Campania; texto: string; botones: Array<{ label: string; mensaje: string | null; accion: "CLICKED" | "DECLINED" }> };
export function elegirCampania(d: DatosSegmento, now: Date): Globito | null; // puro
export async function cargarDatosSegmento(userId: number): Promise<DatosSegmento>;
```

Textos exactos (voseo; `{s}` = saludo, `{n}` = primer nombre o vacío):
- `escolar_en_curso`: «{s}{, n}. Tu álbum escolar **{titulo}** va por el paso {k} de 11: {siguiente.titulo en minúscula}. ¿Seguimos?» — botones: «Seguimos» → mensaje «Quiero seguir con mi álbum escolar», «Ahora no» → DISMISSED (mensaje null). Si `aMedias`: «{s}{, n}. Tu álbum **{titulo}** está marcado como escolar pero no tiene escuela, así que queda a medias. ¿Lo arreglamos?»
- `nuevo`: «¡{s}{, n}! Soy DNX Bot. ¿Te ayudo a armar tu primer álbum? Son unos minutos.» — «Sí, ayudame» → «Quiero armar mi primer álbum», «Ahora no».
- `sin_ventas`: «{s}{, n}. Vi que todavía no vendiste. ¿Revisamos juntos qué le falta a tu álbum para vender?» — «Revisemos» → «¿Qué le falta a mi álbum para vender?», «Ahora no».
- `sin_escolar`: «¡{s}{, n}! ¿Te dedicás a la fotografía escolar? Si querés, te enseño a configurar todo para automatizarlo: preventa, cursos, plantillas y entrega.» — «Sí, quiero aprender» → «Quiero aprender a vender fotografía escolar», «Ya lo hago» → «Ya hago fotografía escolar, ¿cómo me ayudás?», «No, gracias» → DECLINED.

Condiciones y supresión según Global Constraints (`nuevo`: `registradoHace <= 14 && !tieneAlbum`; `sin_ventas`: `tieneAlbum && !vendio`; `sin_escolar`: `vendio && !tuvoEscolar`; `escolar_en_curso`: `progreso` con álbum y `siguiente != null`). `vendio` = existe pedido `PAID`, `isTest:false`, `totalCents > 0` en sus álbumes.

- [ ] **Step 1: Tests que fallan:** `saludoPorHora` en 04:59/05:00/12:59/13:00/19:59/20:00 hora AR (usar instantes UTC); prioridad entre campañas; supresión DECLINED 90 días (día 89 suprime, día 91 vuelve), DISMISSED 7 días, CLICKED suprime salvo escolar (escolar vuelve al día siguiente); sin nombre no deja coma suelta; `aMedias` usa el texto especial.
- [ ] **Steps 2–5:** fallar, implementar, pasar (`test:bot`, `tsc`), commit «Elegir el saludo de DNX Bot según la situación del fotógrafo».

---

### Task 4: Estado con globito y ruta del globito

**Files:** Modify `apps/compramelafoto/app/api/bot/estado/route.ts`; Create `app/api/bot/globito/route.ts` + tests.

**Interfaces — Produces (HTTP):**
- `GET /api/bot/estado?campaign=<opcional>` → como hoy + `globito: Globito | null` + `progresoEscolar: ProgresoEscolar | null` (sólo fotógrafos). Si viene `campaign` válida y su condición se cumple, se fuerza ese globito aunque esté suprimido por CLICKED/DISMISSED (no por DECLINED). Al devolver un globito registra `SHOWN` con `registrarOutreach` sin pisar un estado posterior (sólo crea si no existe).
- `POST /api/bot/globito` body `{ campaign, accion: "CLICKED" | "DISMISSED" | "DECLINED", answer? }` → `{ ok: true }`; 401 sin sesión, 404 bot apagado, 400 campaña/acción inválida.

- [ ] Tests (handlers reales, mocks de prisma/auth/config): estado devuelve globito para fotógrafo, nada para organizador; `?campaign=sin_escolar` fuerza; DECLINED no se fuerza; POST registra con upsert (dos llamadas → una fila); validaciones 400/401/404. Errores al calcular el globito → `globito: null` (nunca rompe el estado).
- [ ] Commit «Mostrar el saludo de DNX Bot y registrar la respuesta».

---

### Task 5: Burbuja: globito, «?dnxbot=» y tarjeta de progreso

**Files:** Modify `packages/dnx-bot/src/ui/DnxBotBubble.tsx`, `items.ts`; Create `packages/dnx-bot/src/ui/globito.ts` (+ test); Modify `packages/dnx-bot/src/engine.ts` (+ test): `BotTurnInput.onToolResult?: (name: string, outcome: ToolOutcome) => void` llamado tras cada herramienta de lectura; Modify `apps/compramelafoto/app/api/bot/chat/route.ts`: si `name === "ver_progreso_escolar"` y `outcome.ok`, `send("progreso", outcome.data)`.

Comportamiento:
- Con `estado.globito`: burbuja de diálogo pequeña a la izquierda del robot (máx. 260 px, texto con `formatBotText`, botones, «×»). Nunca abre la ventana sola.
- Botón con `mensaje`: POST `/api/bot/globito` `{accion:"CLICKED"}` (o la del botón), abre la ventana y envía `mensaje` como primer mensaje del usuario. Botón sin mensaje / «×»: POST con `DISMISSED` o `DECLINED` y oculta el globito.
- Si la URL tiene `?dnxbot=<campaña>`, pedir `estado?campaign=<campaña>` y **abrir la ventana** con ese globito como saludo (es el único caso en que se abre sola: viene de un mail que el fotógrafo tocó).
- Tarjeta de progreso: componente que recibe `ProgresoEscolar` (de `estado.progresoEscolar` cuando la campaña es `escolar_en_curso`, o del evento SSE `progreso`), muestra «Paso k de 11», lista de pasos con ✓ / ○ / «—» (no aplica) y el siguiente resaltado con botón «Abrir» (enlace interno, mismo criterio que `formatBotText`) y «Hacelo por mí» (envía «Hacé por mí el paso: {titulo}»).
- `src/ui/**` sólo importa archivos de `src/ui` y `../sse` (regla de la etapa 1). Lógica pura en `globito.ts`/`items.ts` con tests (node).

- [ ] Tests de lógica pura (parseo de `?dnxbot=`, reducción de eventos `progreso`, selección del paso siguiente para la tarjeta) + engine test de `onToolResult` + route test del evento `progreso`.
- [ ] Commit «Mostrar el saludo y el progreso escolar en la burbuja de DNX Bot».

---

### Task 6: Extraer la lógica escolar compartida

**Files:** Create `apps/compramelafoto/lib/schools/school-setup.ts`, `lib/albums/album-school-settings.ts` (+ tests); Modify `app/api/fotografo/schools/route.ts` (POST L53-95), `app/api/fotografo/schools/[id]/courses/route.ts` (POST L18-62), `app/api/dashboard/albums/[id]/route.ts` (PATCH bloques L662-743); route-level tests de caracterización para las tres rutas.

**Interfaces — Produces:**
```ts
// school-setup.ts
export async function createSchoolForOwner(ownerId: number, input: { name: unknown; city?: unknown; province?: unknown; contactEmail?: unknown; contactPhone?: unknown; address?: unknown; country?: unknown; notes?: unknown; latitude?: unknown; longitude?: unknown; logoUrl?: unknown }): Promise<{ ok: true; school: { id: number; name: string } } | { ok: false; status: 400; error: string }>;
export async function findOwnedSchool(ownerId: number, schoolId: number): Promise<{ id: number; name: string } | null>;
export async function createSchoolCoursesForOwner(ownerId: number, schoolId: number, courses: Array<{ name: string; division?: string | null }>, opts: { skipExisting: boolean }): Promise<{ ok: true; created: number; skipped: number } | { ok: false; status: 400 | 404; error: string }>;
// album-school-settings.ts
export type AlbumSchoolPatch = { mode?: "SIMPLE" | "EVENT" | "SCHOOL" | "COLLABORATIVE"; schoolId?: number | null; studentIdentificationMode?: "NONE" | "MANUAL" | "ROSTER_OPTIONAL" | "ROSTER_REQUIRED" | null; allowManualStudentFallback?: boolean; organizerCommissionEnabled?: boolean; organizerCommissionPercentage?: number | null; organizerCommissionAppliesTo?: Array<"PREVENTA" | "POST_EVENT" | "EXTRAS"> };
export async function buildAlbumSchoolSettingsUpdateData(patch: Record<string, unknown>, actorUserId: number): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; status: 400; error: string }>;
export async function updateAlbumSchoolSettingsForOwner(p: { actorUserId: number; albumId: number; patch: AlbumSchoolPatch }): Promise<{ ok: true; before: Record<string, unknown>; after: Record<string, unknown> } | { ok: false; status: 400 | 404; error: string }>;
```

Reglas: **mover** el código de las rutas (mismos textos y códigos); la ruta de cursos llama con `skipExisting: false` (comportamiento actual: duplica) y el bot con `true` (compara `name`+`division` sin mayúsculas/espacios); la ruta PATCH reemplaza los bloques L662-743 por `buildAlbumSchoolSettingsUpdateData` en la misma posición; `updateAlbumSchoolSettingsForOwner` da 404 para álbum ausente/ajeno/borrado, devuelve `before/after` sólo de claves cambiadas (formato apto para deshacer, lección de la etapa 1). `findAlbumOwnedByUser` de preventa no mira `deletedAt`: en los usos del bot agregar ese filtro.

- [ ] Tests de caracterización de las 3 rutas (pasan contra el código actual antes de tocarlo) + tests de las funciones nuevas (ajeno → 404; escuela ajena → 400 «Escuela no encontrada o no te pertenece»; cursos repetidos con `skipExisting` se saltean).
- [ ] Commit «Extraer la configuración escolar a funciones compartidas».

---

### Task 7: Herramientas escolares del bot

**Files:** Create `apps/compramelafoto/lib/bot/escolar/herramientas.ts` (+ test); Modify `lib/bot/herramientas/index.ts` (sumar para fotógrafos).

**Herramientas** (todas con dueño verificado en `describe` —que lanza si no corresponde—, `run` y `undo`):
| Nombre | Tipo | Entrada | Notas |
|---|---|---|---|
| `ver_progreso_escolar` | read | `{ albumId?: number }` | devuelve `ProgresoEscolar` |
| `crear_escuela` | write | `{ nombre, localidad?, provincia? }` | sin undo (se puede borrar desde el panel; el bot no borra) |
| `cargar_cursos` | write | `{ schoolId, cursos: [{ nombre, division? }] }` (1–40) | `skipExisting: true`; describe lista «5° A, 5° B…»; sin undo |
| `invitar_admin_escuela` | write | `{ schoolId, nombre, email }` | reutiliza la lógica de la ruta de invitación (incluido el 409 si el mail es de otro tipo de usuario); describe: «Se le manda un mail a … No se puede deshacer.» |
| `vincular_album_a_escuela` | write | `{ albumId, schoolId }` | patch `{ mode: "SCHOOL", schoolId }`; undo con `before` |
| `elegir_identificacion_alumnos` | write | `{ albumId, modo: "NONE"\|"MANUAL"\|"ROSTER_OPTIONAL"\|"ROSTER_REQUIRED", permitirManual?: boolean }` | describe explica cada modo en una línea; undo |
| `configurar_comision_escuela` | write | `{ albumId, habilitar, porcentaje?: 0–100, aplicaA?: [...] }` | undo |
| `avisar_familias_fotos_listas` | write | `{ albumId }` | se niega si el álbum no tiene fotos o no hay familias pendientes (usa `getPreventaPhotosReadyStatus`); describe: «Se manda un mail a N familias. No se puede deshacer.»; run: `notifyPreventaPhotosReady({ albumId, baseUrl })` con `baseUrl = process.env.APP_URL` o `https://www.compramelafoto.com` |

- [ ] Tests: cada herramienta con recurso ajeno → error sin propuesta; `avisar_familias` sin fotos → error; `cargar_cursos` saltea repetidos; undo de vincular/identificación/comisión con `before` pasado por JSON.
- [ ] Commit «Agregar las herramientas escolares de DNX Bot».

---

### Task 8: Guía escolar y alerta «a medias»

**Files:** Modify `lib/bot/guia/conocimiento.ts`, `lib/bot/guia/identidad.ts` (una línea), `lib/bot/contexto.ts` (+ tests).

- Sección «## Venta escolar» (texto fijo, verificado contra el código y `docs/compramelafoto/AUDITORIA-VENTA-ESCOLAR.md`): qué es la preventa canjeable; cómo compran las familias y canjean después (`/canje/preventa/…`); identificación de alumnos (los 4 modos en lenguaje simple); cursos; plantillas para impresos; comisión de la escuela; entrega con QR; los 11 pasos en orden. No mencionar la selfie escolar (nunca se usó).
- `identidad.ts`: «Cuando hablen de fotografía escolar, usá ver_progreso_escolar y guiá un paso por vez; ofrecé hacerlo vos cuando haya herramienta.»
- `contexto.ts`: alerta `bloquea_ventas` ««{titulo}» está marcado como escolar pero no tiene escuela: queda a medias.» y una línea «Escolar: paso k de 11 en «{titulo}»» cuando hay álbum escolar.
- [ ] Tests (guía determinista y > 4096 caracteres; alerta a medias aparece). Commit «Enseñarle a DNX Bot la venta escolar».

---

### Task 9: Mail a los que no entran (apagado por defecto)

**Files:** Create `lib/email-marketing/unsubscribe-token.ts` (extraer `ensureUnsubscribeToken` de `app/api/admin/email-campaigns/[id]/send/route.ts` L12-27 y usarlo allí), `lib/bot/outreach-email.ts`, `app/api/cron/bot-outreach/route.ts` (+ tests); Modify `vercel.json` (`{"path":"/api/cron/bot-outreach","schedule":"0 13 * * *"}` = 10:00 AR).

- Selección (una consulta acotada, `take: 50`): fotógrafos (`PHOTOGRAPHER`/`LAB_PHOTOGRAPHER`) con `marketingOptIn = true`, `unsubscribedAt` nulo, `lastLoginAt` nulo o < now−30 días, cuya campaña (`sin_ventas` o `sin_escolar`, calculada con las mismas reglas de Task 3) no tenga fila `EMAIL` en `BotOutreach`.
- Mail por `queueEmail` con `idempotencyKey: dnx-bot-outreach-${campaign}-${userId}`; asunto y cuerpo:
  - `sin_ventas` — Asunto «Te ayudo a vender tus fotos en CompraMeLaFoto». Cuerpo: «Hola {nombre}: vimos que todavía no vendiste fotos en CompraMeLaFoto. Ahora tenés a DNX Bot, un asistente dentro de tu panel que revisa tu álbum, te dice qué le falta para vender y lo arregla por vos (siempre con tu confirmación). [Entrar y que DNX Bot me ayude] … Si no querés recibir más novedades, [darte de baja].»
  - `sin_escolar` — Asunto «¿Hacés fotografía escolar? Te ayudamos a automatizarla». Cuerpo: «Hola {nombre}: en CompraMeLaFoto podés vender fotografía escolar con preventa: las familias pagan antes, eligen sus fotos y vos entregás ordenado por curso. DNX Bot te acompaña paso a paso a configurarlo. [Entrar y que DNX Bot me ayude] … [darte de baja].»
  - Botón → `${APP_URL}/fotografo?dnxbot={campaign}`; baja → `${APP_URL}/unsubscribe?token={token}`.
- Registrar `SENT`/`FAILED` en `BotOutreach` canal `EMAIL`.
- Cron: `assertCronAuth`; si `CLF_BOT_OUTREACH_EMAIL_ENABLED !== "1"` → `{ ok: true, skipped: true }`; si `CLF_BOT_ENABLED !== "1"` → skipped.
- [ ] Tests: interruptor apagado no consulta ni envía; sin opt-in/dado de baja/ya contactado no entra; máximo 50; idempotencia; enlace de baja presente; ruta de campañas admin sigue igual (test de caracterización mínimo del helper extraído). Commit «Avisar por mail a los fotógrafos que no entran (apagado por defecto)».

---

### Task 10: Métricas en el resumen diario

**Files:** Modify `lib/bot/resumen.ts` (+ test).

Agregar al resumen: «Saludos: X mostrados, Y tocados, Z rechazados (por campaña)», «Mails: N enviados; M de esos fotógrafos entraron después» (`lastLoginAt` posterior al `createdAt` de la fila `SENT`), «Primeras ventas este mes: K fotógrafos» (primer pedido `PAID` >0 de su historia dentro del mes), «Álbumes escolares con preventa publicada: P» (álbumes escolares cuyo paso 9 está hecho — acotar a los creados en los últimos 120 días).
- [ ] Tests con prisma mockeado. Commit «Medir saludos, mails y avances escolares en el resumen de DNX Bot».

---

### Task 11: Regla del proyecto y escenarios escolares

**Files:** Create `apps/compramelafoto/CLAUDE.md`; Modify `lib/bot/evals/escenarios.ts`.

- `CLAUDE.md`:
```markdown
# CompraMeLaFoto

## DNX Bot: mantener la guía al día
DNX Bot (`lib/bot/`) explica CLF a los fotógrafos con un texto fijo en `lib/bot/guia/`.
Cada vez que cambies cómo funciona algo (reglas, plazos, precios, pantallas, rutas del panel, funciones nuevas):
1. actualizá `lib/bot/guia/conocimiento.ts` (y `identidad.ts` si cambia una regla del bot);
2. si cambiaste una ruta del panel, actualizá los enlaces en `lib/bot/escolar/progreso.ts` y `lib/bot/herramientas/*`;
3. corré `pnpm --filter compramelafoto test:bot`.
```
- Escenarios nuevos: «quiero empezar con fotografía escolar» (debeUsarAlguna `ver_progreso_escolar`), «creá la escuela San Martín de Rosario» (debeUsar `crear_escuela`), «avisale a las familias que ya están las fotos» con situación sin fotos (noDebeUsar `avisar_familias_fotos_listas`).
- [ ] Commit «Dejar la regla de la guía de DNX Bot y escenarios escolares».

---

### Task 12: Puesta en producción (operación)

- [ ] Aplicar `20261104120000_dnx_bot_outreach` en las 4 bases (CLF producción, divine-hall development, Clickatón, staging) y registrar con su sha256 — aprobado por Daniel junto con la etapa.
- [ ] Verificación completa (tests dnx-bot + test:bot + test:payments, `tsc` de 5 apps), revisión final de rama, PR, fusionar con CI verde.
- [ ] Correr `bot:eval` real (incluye escenarios escolares).
- [ ] **Dejar `CLF_BOT_OUTREACH_EMAIL_ENABLED` sin cargar** y mandarle a Daniel los dos textos de mail para que los apruebe; recién con su OK, cargar la variable.
- [ ] Avisar a Daniel para que Belén recorra el armado escolar completo con el bot.
