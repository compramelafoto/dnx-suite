# Etapa 4 · Entrega B (Agenda) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** agenda propia de la organización con citas, capas (citas, entregas de proyectos, tareas, cuotas, consultas, cumpleaños, reservas), citas creadas desde el pedido y un calendario propio en Google Calendar sincronizado de ida y vuelta.

**Architecture:**
- Tablas nuevas `Fotoffice*`.
- La grilla de Reservas (`components/bookings/calendar/*`, `lib/bookings/calendar-view.ts`) se reutiliza, pasando a recibir eventos genéricos sin cambiar su comportamiento en Reservas.
- Google Calendar reutiliza la integración existente (`WorkspaceIntegration` de Google, token cifrado, `lib/integrations/*`) y el cliente de `lib/bookings/calendar/client.ts`, generalizado sin cambiar lo que hace con las reservas.
- El cron de sincronización es uno nuevo, igual al de reservas.

**Tech Stack:** Next.js 16 App Router, Prisma, Vitest 3, Tailwind v4 `--fo-*`, pnpm.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-08-etapa-4-proyectos-y-agenda-design.md` (§2 Entrega B, §3, §4, §5).

## Global Constraints

- **Rama y worktree:** rama `feat/fotoffice-etapa-4-agenda` desde `origin/main`, worktree `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Dependencias:** ninguna nueva.
- **Base de datos:**
  - Una migración a mano: `packages/db/prisma/migrations/20261026120000_fotoffice_etapa_4_agenda/migration.sql`.
  - Tablas nuevas:
    - `FotofficeCitaTipo`: workspaceId, name, color, order, isActive; único `(workspaceId, name)`.
    - `FotofficeCita`:
      - workspaceId, title, typeId?, status;
      - startAt, endAt, allDay;
      - location?, notes?, ownerUserId?, clientId?;
      - origen: proyectoId?, pedidoId?, consultaLeadId?;
      - reglaId? (`FotofficeProductoCita`), pedidoItemIndex?;
      - googleEventId?, googleEtag?, googleUpdatedAt?;
      - createdByUserId?, timestamps.

      Índices `(workspaceId, startAt)` y `(workspaceId, ownerUserId, startAt)`; único `(workspaceId, googleEventId)`.
    - `FotofficeCitaParticipante`: citaId, userId? o clientId? (exactamente uno, con CHECK), roleId? (`FotofficeProyectoRol`), note?.
    - `FotofficeProductoCita`: workspaceId, productId, typeId?, title?, daysFromEvent INT (CHECK −365..365), startTime TEXT `HH:MM`?, durationMinutes INT (CHECK 15..1440), ownerUserId?, order.
    - `FotofficeAgendaAjustes`: workspaceId único, googleCalendarId?, googleSyncToken?, googleLastSyncAt?, defaultLayers JSONB?, reminderEnabled BOOLEAN default false, reminderHours INT default 24.
    - `FotofficeCitaRecordatorio`: citaId, startAt, sentAt; único `(citaId, startAt)`.
  - Los estados de la cita son `AGENDADA | CONFIRMADA | REALIZADA | ANULADA`, como texto con CHECK.
  - Se reemplaza el CHECK de `FotofficeMessageTemplate.entityType`, conservando `GENERAL`, `CLIENTE`, `SOCIO`, `CONSULTA`, `PRESUPUESTO`, `PEDIDO` y `PROYECTO`, y sumando `CITA`.
  - **Ninguna columna** en tablas existentes.
  - La migración no se aplica en esta rama. Documento `packages/db/docs/MIGRACION-ETAPA-4-AGENDA.md`, sin staging.
- **Módulo `agenda` ("Agenda"):**
  - pasa a `AVAILABLE` con `route: "/agenda"`, sin dependencias;
  - las capas de proyectos, pedidos y consultas sólo aparecen si su módulo está encendido y el usuario tiene Ver en ese módulo;
  - Ver para leer, Gestionar para crear, editar y mover citas.
- **Capas:**
  - **Citas.**
  - **Entregas de proyectos:** `finalDueDate` de los proyectos abiertos y no suspendidos.
  - **Tareas con vencimiento** del motor que el usuario puede ver.
  - **Vencimientos de cuotas** con saldo: sólo con permiso de dinero (`veCostosDePedido` o la regla de montos del listado de pedidos).
  - **Próxima acción de consultas.**
  - **Cumpleaños de contactos** (`FotofficePersonEvent`).
  - **Reservas confirmadas,** de sólo lectura.
  - Cada capa lleva su color y se puede encender o apagar (preferencia en el navegador). Se filtra por responsable.
- **Fechas:** se guardan como instantes UTC y se muestran en `America/Argentina/Buenos_Aires`. Una cita de todo el día ocupa el día de Argentina.
- **Citas desde el pedido:**
  - al confirmar (dentro del `tx` de `confirmarPedido` y del alta manual), una cita por regla de cada ítem de catálogo;
  - los combos suman las reglas de sus componentes;
  - la fecha es la del evento + `daysFromEvent`; la hora, `startTime` o "todo el día" si no tiene;
  - la duración, `durationMinutes`;
  - sólo con el módulo `agenda` encendido;
  - si no hay fecha de evento, no se crea la cita y la vista previa lo avisa;
  - es idempotente por `(pedidoId, pedidoItemIndex, reglaId)`, comprobando antes de insertar.
- **Google Calendar:**
  - se usa la integración Google existente de la organización (la de Reservas);
  - si está conectada, en Configuración → Agenda aparece "Crear calendario «<organización> Agenda»" (`calendars.insert`); se guarda `googleCalendarId`;
  - **empuje:** al crear, editar, mover o anular una cita, se hace insert, patch o delete del evento, después de confirmar (con `after()`), sin frenar la acción;
  - las entregas de proyectos se empujan como eventos de todo el día con prefijo «Entrega: »;
  - **traída** (cron cada 10 minutos, con `CRON_SECRET`): `events.list` con `syncToken`. Lo nuevo creado en Google se vuelve una cita (tipo vacío, responsable vacío). Lo modificado actualiza la cita si `updated` de Google es posterior a `googleUpdatedAt` (gana el último). Lo borrado en Google anula la cita. Con `410 Gone` se hace una sincronización completa de ±90 días;
  - las entregas de proyectos son de **sólo ida**: un cambio en Google no mueve la fecha del proyecto;
  - nunca se tocan los calendarios de los espacios de Reservas ni sus eventos.
- **Recordatorio al cliente:**
  - plantilla automática `RECORDATORIO_CITA` (entityType `CITA`), **apagada por omisión**;
  - si está encendida en `FotofficeAgendaAjustes`, un cron horario manda un correo `reminderHours` antes a los participantes contacto con correo;
  - una vez por `(cita, startAt)`;
  - con los topes de los automáticos;
  - variables `[cita_titulo]`, `[cita_fecha]`, `[cita_hora]` y `[cita_lugar]`.
- **Semilla de DNX** (idempotente): tipos de cita:
  - Reunión con cliente (azul);
  - Evento (rojo);
  - Sesión de fotos (verde);
  - Entrega (violeta);
  - Prueba / ensayo (naranja);
  - Otro (gris).
- **Textos:** español rioplatense, "dinero".
- **Verificación:**
  - vitest completo;
  - tsc de fotoffice con `NODE_OPTIONS=--max-old-space-size=8192`, mirando el código de salida y la salida;
  - si cambia el schema, tsc de las 4 apps y `prisma validate`/`generate`;
  - `next build --webpack` y después `rm -rf apps/fotoffice/.next`, porque el disco está justo;
  - sin tsbuildinfo.
- **Migración:** al armar `migration.sql` con `prisma migrate diff`, sacar del archivo cualquier línea que no sea SQL (avisos de Prisma). La prueba de fuente lo verifica.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Tablas y cálculos puros

**Files:** schema, migración y su prueba de fuente; `lib/agenda/{constantes,capas,reglas,fechas,sync-decisiones}.ts` y sus pruebas.

- [ ] Modelos y SQL. Correr `validate`, `generate` y tsc de las 4 apps.
- [ ] `fechas.ts`: inicio y fin de la cita desde la fecha del evento, los días, la hora y la duración en Argentina; todo el día; rango de la vista.
- [ ] `reglas.ts`: `citasDelPedido(items, reglas, combos)`, igual que `proyectosDelPedido`.
- [ ] `capas.ts`: arma los eventos de la vista desde datos ya leídos: `{ id, capa, titulo, inicio, fin, todoElDia, color, href, editable }`.
- [ ] `sync-decisiones.ts`: qué hacer con cada evento de Google (crear, actualizar, anular o ignorar) y con cada cita local (insert, patch, delete), según `updated` y el estado.
- [ ] Commit `Agenda: tablas y cálculos de citas, capas y sincronización (SQL sin aplicar)`.

### Task 2: Citas, tipos, reglas por producto y creación desde el pedido

**Files:** `lib/agenda/{acceso,citas,tipos,participantes,reglas-catalogo,crear,semillas}.ts` y sus pruebas; `app/actions/agenda.ts`; módulo `agenda` en el registro; sección "Cita que genera" en la ficha del producto (igual que "Proyecto que genera"); enganche en `confirmarPedido`, la vista previa y el alta manual.

- [ ] **Crear, editar, mover y anular citas:**
  - validar que los ids sean del workspace;
  - el fin tiene que ser posterior al inicio;
  - estados;
  - participantes: usuario o contacto, con rol.
- [ ] **Tipos de cita:** configuración con `configurar` y semilla de DNX.
- [ ] **Reglas por producto** con `sales.catalog`; creación al confirmar según las Global Constraints. La vista previa lista las citas que se van a crear.
- [ ] Pruebas y commit `Agenda: citas, tipos y citas creadas desde el pedido`.

### Task 3: Pantalla de agenda

**Files:**
- `app/(shell)/agenda/page.tsx`;
- `components/agenda/*`;
- grilla compartida extraída de Reservas, sin cambiar su comportamiento: las pruebas de Reservas tienen que seguir pasando;
- `lib/agenda/vista.ts`, que lee las capas con sus permisos;
- diálogo de cita (crear y editar);
- tarjetas "Citas" en la ficha del proyecto, del pedido y de la consulta;
- menú.

- [ ] Vistas día, semana, mes y lista; capas encendibles; filtro por responsable; arrastrar una cita para moverla, sólo con Gestionar y sólo las citas.
- [ ] Clic en un evento de otra capa: va a su ficha.
- [ ] Pruebas de fuente y de permisos por capa. Commit `Agenda: vista con capas y diálogo de cita`.

### Task 4: Google Calendar de ida y vuelta

**Files:**
- `lib/agenda/google/{cliente,empuje,traida}.ts` y sus pruebas, generalizando el cliente de reservas sin cambiar su comportamiento;
- `app/api/cron/agenda-google-sync/route.ts` y `vercel.json` (cada 10 minutos);
- Configuración → Agenda (`app/workspace/configuracion/agenda`): crear el calendario, estado de la sincronización, recordatorio al cliente.

- [ ] Según las Global Constraints:
  - creación del calendario;
  - empuje con `after()`;
  - traída con `syncToken`, `410` y lo que hay que ignorar (eventos de entregas de proyectos);
  - errores sin datos personales en el registro;
  - tokens vencidos o revocados: avisar igual que en Reservas.
- [ ] Sumar `agenda` a los módulos que requieren la integración Google.
- [ ] Pruebas:
  - cliente simulado;
  - decisiones;
  - el cron no toca reservas;
  - permisos de configuración.
- [ ] Commit `Agenda: calendario propio en Google Calendar de ida y vuelta`.

### Task 5: Recordatorio al cliente y documento

**Files:** `lib/agenda/recordatorios.ts` y sus pruebas; `app/api/cron/agenda-recordatorios/route.ts` (por hora); plantilla automática `RECORDATORIO_CITA` y sus variables; `packages/db/docs/MIGRACION-ETAPA-4-AGENDA.md`.

- [ ] Recordatorio según las Global Constraints, apagado por omisión.
- [ ] Documento:
  - tablas;
  - checksum;
  - verificación;
  - vuelta atrás;
  - encender el módulo `agenda`;
  - crear el calendario en Configuración → Agenda;
  - prueba en producción: cita a mano, verla en Google, moverla en Google y que vuelva, borrarla en Google y que quede anulada, regla de cita en un producto y pedido de prueba.
- [ ] Verificación completa y commit `Agenda: recordatorio al cliente y documento de migración`.
