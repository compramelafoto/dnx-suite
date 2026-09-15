# Etapa 1b — Armar el equipo

**Objetivo:** que de una solicitud aprobada salga un equipo confirmado. Hoy el circuito termina
cuando un coordinador aprueba; a partir de acá se generan las coberturas, se publica la
convocatoria, los voluntarios se postulan, el coordinador elige y cada persona confirma.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-14-solicitudes-y-coberturas-design.md`

**Qué queda para la 1c:** entregables, ficha operativa completa, registro de horas, y el panel
de la organización solicitante (`/cliente`).

---

## La pregunta que esto contesta

> ¿Cómo se inscribe un voluntario a un evento?

Hoy no puede. Las tablas existen y están vacías. Faltan las pantallas.

---

## Restricciones globales

Las mismas de la etapa 1a, que siguen valiendo:

- **Ninguna base se toca.** Las once tablas ya existen en la base de FOTOFFICE; esta etapa
  **no necesita ninguna migración nueva**. Si alguna tarea cree que sí, es señal de que se
  está saliendo del alcance: parar y avisar.
- **Nada de enums de Prisma.** Los estados son `String`, validados en el dominio.
- **Todo en español**: rutas visibles, UI, comentarios, mensajes de error y de test.
- **Fechas en pantalla** `DD.MM.AAAA`, zona `America/Argentina/Buenos_Aires`, vía
  `lib/coverages/format.ts`.
- **Permisos en servidor**, en cada página y cada acción. Esconder un botón no es un control.
- **Aislamiento por workspace** en toda consulta. `lib/coverages/aislamiento.test.ts` lo
  verifica leyendo el código de `repository.ts`: toda consulta nueva tiene que filtrar por
  `workspaceId` en su `where`, o el test falla nombrándola.
- **Tests con Vitest** sobre lógica pura, sin base de datos.
- **Comentarios que explican el porqué**, no el qué.
- **Antes de escribir código de Next**, leer la guía en `node_modules/next/dist/docs/`. Un
  Server Component no puede escribir cookies.
- **Verificación**: `pnpm test`, `npx tsc --noEmit -p tsconfig.json`, `pnpm lint`, `pnpm build`.
  Sabido y ajeno: `lib/template-v2/access.test.ts` falla desde `main`; el lint tiene 3 errores
  en `hero-block-view.tsx` y `mass-grading-screen.tsx`.

---

## Las cuatro máquinas de estado que faltan

Las de la solicitud ya están en `lib/coverages/transitions.ts`. Estas se agregan ahí, con el
mismo patrón: tabla explícita, `assertXTransition` que devuelve `{ ok } | { ok: false, error }`,
y motivo obligatorio donde corresponde.

```
Cobertura     PLANIFICADA → BUSCANDO_EQUIPO → EQUIPO_CONFIRMADO → REALIZADA
              → ENTREGADA → CERRADA      ↘ SIN_EQUIPO   ↘ CANCELADA

Convocatoria  BORRADOR → PUBLICADA → COMPLETA → CERRADA   ↘ VENCIDA  ↘ CANCELADA

Postulación   RECIBIDA → EN_REVISION → PRESELECCIONADA → SELECCIONADA
                                                       ↘ NO_SELECCIONADA
              ↘ RETIRADA   ↘ VENCIDA

Asignación    PROPUESTA → INVITADA → ACEPTADA → CONFIRMADA → CUMPLIDA
                                   ↘ RECHAZADA ↘ CANCELADA ↘ REEMPLAZADA ↘ AUSENTE
```

**Motivo obligatorio** al cancelar una cobertura, al cancelar una convocatoria, al cancelar
una asignación y al marcar ausente. No al rechazar una postulación: "en esta oportunidad el
equipo ya está completo" no es un reproche y pedir que alguien lo justifique por escrito, en
un contexto de voluntariado, sobra.

**`CUMPLIDA` y `AUSENTE` quedan definidas pero sin pantalla en esta etapa**: pertenecen al
registro de participación, que es 1c. Se implementan las transiciones para no tener que volver
a tocar el archivo.

---

## El vocabulario de la etapa

Para que las tareas no se contradigan entre sí:

| Palabra | Qué es |
|---|---|
| **Cobertura** | El trabajo concreto: una fecha, un lugar, un equipo. Una solicitud aprobada genera 1..N |
| **Rol** | Un puesto dentro de una cobertura, con N vacantes. "Fotógrafo principal, 1 vacante" |
| **Convocatoria** | La publicación de una cobertura para que la gente se postule. 1:1 con la cobertura |
| **Postulación** | Alguien se ofrece para un rol |
| **Asignación** | Alguien quedó en un rol. Nace de una postulación seleccionada o de una invitación directa |
| **Colaborador** | Un `Member` con perfil de cobertura activo |

**Una persona no se postula "a la cobertura": se postula a un ROL.** Los cupos son por rol, no
por cobertura, y es lo que hace que "necesito un fotógrafo y un videógrafo" funcione.

---

## Las tareas

### Tarea 1 — Las cuatro máquinas de estado

**Archivos:** `lib/coverages/states.ts` (ampliar), `lib/coverages/transitions.ts` (ampliar),
`lib/coverages/transitions.test.ts` (ampliar).

**Produce:** `COVERAGE_STATUSES`, `CALL_STATUSES`, `APPLICATION_STATUSES`,
`ASSIGNMENT_STATUSES` con sus `*_LABELS` y `*StatusLabel()`; `canTransitionCoverage`,
`canTransitionCall`, `canTransitionApplication`, `canTransitionAssignment`;
`assertCoverageTransition`, `assertCallTransition`, `assertApplicationTransition`,
`assertAssignmentTransition`, todos con la firma de `assertRequestTransition`.

Seguir **exactamente** el patrón que ya existe para la solicitud: tabla `Record<Estado,
readonly Estado[]>`, rechazo de `from === to`, rechazo de estados inventados, y motivo
obligatorio donde este plan lo pide.

Tests: por cada máquina, el camino feliz, un salto prohibido, un estado terminal que no
reabre, `from === to`, un estado inventado, y el motivo obligatorio donde aplique.

---

### Tarea 2 — Cupos, vacantes y quién puede postularse

**Archivos:** crear `lib/coverages/cupos.ts` y `cupos.test.ts`; crear
`lib/coverages/elegibilidad.ts` y `elegibilidad.test.ts`.

**Produce:**

```ts
// cupos.ts
export type EstadoDeRol = {
  vacancies: number;
  asignadasVivas: number;   // asignaciones en PROPUESTA|INVITADA|ACEPTADA|CONFIRMADA
};
/** Cuántos lugares quedan. Nunca negativo. */
export function lugaresLibres(r: EstadoDeRol): number;
/** Si el rol ya no admite más gente. */
export function rolCompleto(r: EstadoDeRol): boolean;
/** Si TODOS los roles de la cobertura están completos. */
export function equipoCompleto(roles: EstadoDeRol[]): boolean;

// elegibilidad.ts
export type CandidatoAConvocatoria = {
  tienePerfilActivo: boolean;
  yaSePostulo: boolean;
  yaEstaAsignado: boolean;
  convocatoriaStatus: string;
  cierreDePostulaciones: Date | null;
};
export type Elegibilidad = { puede: true } | { puede: false; motivo: string };
/** Si esta persona puede postularse a este rol, y si no, por qué. */
export function puedePostularse(c: CandidatoAConvocatoria, ahora: Date): Elegibilidad;
```

**Reglas de `puedePostularse`**, en este orden —el orden importa y va probado—:
1. Sin perfil de colaborador activo → `"Todavía no estás habilitado para anotarte."`
2. La convocatoria no está `PUBLICADA` → `"Esta convocatoria no está abierta."`
3. Cerró el plazo → `"El plazo para anotarse ya cerró."`
4. Ya está asignada → `"Ya estás en el equipo de esta cobertura."`
5. Ya se postuló → `"Ya te anotaste."`
6. Si no, `{ puede: true }`.

**Los mensajes son amables a propósito.** Es voluntariado: "no cumplís los requisitos" sobra.
Un rol completo **no** bloquea la postulación: el coordinador puede querer suplentes. Eso va
con un test que lo fije.

---

### Tarea 3 — El perfil de colaborador

**Archivos:** `lib/coverages/colaboradores.ts` + test; ampliar `repository.ts`; crear
`app/(shell)/coberturas/colaboradores/page.tsx` y su `actions.ts`.

Una pantalla que lista los `Member` del workspace y permite marcarlos como colaboradores
activos, creando o actualizando su `CoverageCollaboratorProfile`. En esta etapa alcanza con
**activo/inactivo** más ciudad y zonas; el resto de los campos del modelo (equipo, radio,
especialidades) se editan pero no se usan para nada todavía — dejarlos visibles y editables,
sin lógica que dependa de ellos.

**Sin perfil activo, una persona no ve ninguna convocatoria.** Es la llave de todo el portal
de esta etapa.

Consultas nuevas en `repository.ts`: `listCollaborators({ workspaceId })`,
`loadCollaboratorProfile({ workspaceId, memberId })`, `upsertCollaboratorProfile(...)`. Todas
con `workspaceId` en el `where`.

---

### Tarea 4 — De solicitud aprobada a cobertura con roles

**Archivos:** `lib/coverages/generar-cobertura.ts` + test; `app/(shell)/coberturas/[id]/`
(ampliar la ficha); acciones nuevas en `app/(shell)/coberturas/actions.ts`.

En la ficha de una solicitud **aprobada**, un bloque para crear una cobertura: título (sugerido
del evento), fechas (sugeridas de la solicitud), dirección, instrucciones, y **los roles con
sus vacantes**.

**Función pura `sugerirCobertura(solicitud)`** que arma los valores por omisión desde la
solicitud, y **`sugerirRoles(solicitud, settings)`** que propone los roles a partir de
`requestedPhotographers` y de la recomendación de refuerzo. Las dos con test.

Al crear la cobertura: estado `PLANIFICADA`, evento en el historial, y la solicitud **no**
cambia de estado (sigue `APROBADA` hasta que se cierre).

---

### Tarea 5 — La convocatoria

**Archivos:** `lib/coverages/convocatoria.ts` + test; `app/(shell)/coberturas/c/[coverageId]/`
(pantalla nueva) y sus acciones.

La ficha de una cobertura: sus roles, su convocatoria, sus postulaciones y su equipo. Desde
ahí se crea la convocatoria (en `BORRADOR`), se edita y se publica.

Al publicar: `status = PUBLICADA`, `publishedAt`, y la cobertura pasa a `BUSCANDO_EQUIPO`.

**La dirección se muestra completa** en la convocatoria (§3.4 del diseño): quienes la ven son
colaboradores del workspace con sesión iniciada, y sin la dirección no pueden decidir si les
queda cerca. Lo único reservado es `privateBriefing` —teléfono de emergencia, contacto del
día—, que se muestra solo a quien ya está asignado.

Función pura `puedePublicarse(call, roles)`: exige al menos un rol con vacantes y un título.

---

### Tarea 6 — El portal: ver convocatorias y postularse

**Archivos:** `app/portal/coberturas/page.tsx`, `app/portal/coberturas/[callId]/page.tsx` y su
formulario; `app/actions/coverage-portal.ts`; ampliar `repository.ts`.

- `/portal/coberturas` — tres bloques: **convocatorias abiertas**, **mis postulaciones** y
  **mis asignaciones** (las que esperan confirmación primero).
- `/portal/coberturas/[callId]` — el detalle: qué actividad es, cuándo, dónde, qué roles hacen
  falta y cuántos lugares quedan en cada uno. Un botón por rol para anotarse, con un campo de
  mensaje opcional.

La acción de postularse revalida **en el servidor** con `puedePostularse` — la pantalla oculta
el botón por cortesía, no por control— y crea la `CoverageApplication` en `RECIBIDA` más su
evento de historial.

Entrada en `lib/portal/menu.ts` para que el portal muestre la sección cuando el módulo está
encendido, siguiendo el patrón de las que ya están.

---

### Tarea 7 — El panel: elegir el equipo

**Archivos:** ampliar `app/(shell)/coberturas/c/[coverageId]/`; acciones nuevas.

Por cada rol: quiénes se postularon, con su mensaje, y los botones para **seleccionar**. Al
seleccionar, en una transacción: la postulación pasa a `SELECCIONADA` y nace una
`CoverageAssignment` en `INVITADA` con `origin: "POSTULACION"`, más el correo a la persona.

También **invitación directa**: elegir a un colaborador activo que no se postuló y crear la
asignación en `INVITADA` con `origin: "INVITACION_DIRECTA"`.

**Al llenarse todos los roles**, la cobertura pasa a `EQUIPO_CONFIRMADO` y la convocatoria a
`COMPLETA`. Eso lo decide `equipoCompleto` de la Tarea 2, en el servidor, no la pantalla.

**Una vacante no se puede asignar dos veces.** La transacción vuelve a contar las asignaciones
vivas del rol antes de escribir; si ya no hay lugar, devuelve un error legible. Dos
coordinadores mirando la misma pantalla es un caso real.

---

### Tarea 8 — El portal: confirmar o rechazar

**Archivos:** `app/portal/coberturas/asignacion/[id]/page.tsx` y su acción.

La persona ve a qué la invitaron —actividad, fecha, lugar, rol, y ahora sí el
`privateBriefing`— y responde: **confirmo** o **no puedo**. Al confirmar, `CONFIRMADA`; al
rechazar, `RECHAZADA` y el rol vuelve a tener una vacante libre.

Si estaba `COMPLETA` y alguien rechaza, la convocatoria vuelve a `PUBLICADA` y la cobertura a
`BUSCANDO_EQUIPO`. **Sin eso, un rechazo deja la cobertura sin equipo y nadie se entera.**

---

### Tarea 9 — Los correos de la etapa

**Archivos:** ampliar `lib/coverages/emails.ts` y su test; ampliar
`lib/communications/constants.ts`.

Cuatro, con el patrón y el armado que ya existen:

| Clave | Cuándo | A quién |
|---|---|---|
| `fotoffice.coverages.call-published` | Se publica una convocatoria | A los colaboradores activos |
| `fotoffice.coverages.assignment-invited` | Alguien queda seleccionado o se lo invita | A esa persona |
| `fotoffice.coverages.assignment-confirmed` | Alguien confirma | A la coordinación |
| `fotoffice.coverages.team-complete` | Se completan todos los roles | A la organización solicitante |

El de equipo completo **rota el token de seguimiento** antes de mandarse, como hacen los de la
etapa 1a, y solo se manda si hay a quién y hay `appUrl()` —ver `debeRotarEnlace`—.

El aviso a los colaboradores sale **a cada uno por separado**, no en copia: un voluntario no
tiene por qué ver la dirección de correo de los demás.

---

### Tarea 10 — Verificación de punta a punta

**Archivos:** `lib/coverages/criterios-1b.test.ts`.

Recorrer el caso de demostración completo con funciones puras: jornada de 4 h 30 con dos roles
(fotógrafo principal y segundo fotógrafo), una persona se postula a cada uno, el coordinador
selecciona, las dos confirman, y el equipo queda completo. Más los casos que duelen: alguien
rechaza y la cobertura vuelve a buscar equipo; dos postulaciones a un rol de una vacante y solo
una puede quedar.

Después, los cuatro comandos de verificación con su salida.

---

## Lo que este plan NO hace

- Entregables y registro de horas.
- Ficha operativa del día (marcar llegada, informar inconveniente).
- El panel de la organización solicitante (`/cliente`).
- Recomendaciones automáticas de candidatos.
- Notificaciones que no sean correo.
