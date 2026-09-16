# Tanda 5 — Tareas 7 y 8: el apretón de manos

Las dos mitades del mismo gesto: la coordinación invita, la persona responde. Van juntas porque
separarlas dejaría asignaciones en `INVITADA` sin ninguna pantalla donde contestarlas.

## Qué quedó hecho

### Reglas puras nuevas — `lib/coverages/equipo.ts` (+ `equipo.test.ts`, 26 casos)

| Función | Qué decide |
|---|---|
| `puedeArmarseElEquipo(status)` | Si la cobertura todavía admite sumar gente. Se apoya en `COVERAGE_LIVE_STATUSES`, no en una lista propia |
| `planSeleccionarPostulacion(...)` | Si una postulación se puede convertir en invitación |
| `planInvitacionDirecta(...)` | Si se puede invitar directo a un colaborador activo |
| `planResponderInvitacion(...)` | Qué hacer con "confirmo" / "no puedo", y la rama aparte de "ya respondiste" |
| `efectosSobreLaBusqueda(...)` | **El RULING**: qué le pasa a la convocatoria y a la cobertura |
| `assignmentOriginLabel(origin)` | "Se anotó" / "La invitamos" |
| `ConflictoDeEquipo` | El error que aborta la transacción con un mensaje legible |

### El RULING, implementado

`efectosSobreLaBusqueda` decide las dos cosas por separado, y cada una con su propia función de
`cupos.ts`:

- **Convocatoria → `COMPLETA`** cuando `todosLosRolesCompletos` (asignaciones **vivas**).
  Significa "dejá de buscar gente", y es verdad apenas se manda la última invitación.
- **Cobertura → `EQUIPO_CONFIRMADO`** sólo cuando `equipoConfirmado` (asignaciones **aceptadas**).
  Significa "el equipo existe de verdad".
- **Al revés**: si deja de estar lleno, `COMPLETA → PUBLICADA`; si deja de estar confirmado,
  `EQUIPO_CONFIRMADO → BUSCANDO_EQUIPO`.

Cada cambio pasa antes por `canTransitionCall` / `canTransitionCoverage`, así que la función
nunca propone un estado imposible: un borrador con todos los roles llenos no salta a `COMPLETA`,
simplemente no se lo toca.

**Una decisión que el ruling no cubría y tomé yo:** `BUSCANDO_EQUIPO` acá es sólo el camino de
**vuelta** desde `EQUIPO_CONFIRMADO`, nunca el de ida. Si no, una invitación directa sacaría a una
cobertura `PLANIFICADA` de ese estado, y la convocatoria sólo se puede crear mientras la cobertura
está planificada: la coordinación se quedaría sin poder crearla. Entrar en búsqueda sigue siendo
lo que hace publicar la convocatoria. Tiene su test.

### Tarea 7 — El panel

- `app/(shell)/coberturas/c/[coverageId]/equipo-panel.tsx` (nuevo): un bloque por rol con quién
  quedó, quién se anotó (con su mensaje), el botón de sumar al equipo, y el formulario de
  invitación directa.
- `actions.ts`: `seleccionarPostulacionAction` e `invitarDirectoAction`.
- `page.tsx`: reemplaza el bloque de "todavía no hay pantalla para esto".

**Una vacante no se asigna dos veces.** El cupo se vuelve a contar **adentro** de la transacción,
contra la base, y no se confía en lo que trajo la pantalla; si ya no hay lugar, la transacción
aborta con `ConflictoDeEquipo("Ese rol ya se llenó mientras mirabas la pantalla.")` y no queda
nada escrito a medias. El recuento no es una garantía absoluta —Postgres en `READ COMMITTED` deja
que dos transacciones cuenten lo mismo antes de que ninguna escriba— y por eso no es la única
barrera: `@@unique([coverageId, memberId])` frena de verdad el caso que más duele, y ese choque se
traduce al mismo aviso legible en vez de a un error de sistema.

Al seleccionar, en una sola transacción: postulación → `SELECCIONADA`, asignación nueva en
`INVITADA` con `origin: "POSTULACION"`, los dos eventos de historial, y el recálculo de estados.

### Tarea 8 — El portal

- `app/portal/coberturas/asignacion/[id]/page.tsx` + `responder-form.tsx` (nuevos).
- `responderInvitacionAction` en `app/actions/coverage-portal.ts`.
- `/portal/coberturas`: "Tus invitaciones" ahora enlaza a esta pantalla, no al detalle de la
  convocatoria.

**Acá y en ningún otro lado se muestra el `privateBriefing`.** `loadCallForPortal` sigue sin
traerlo; `loadMyAssignment` es la única consulta del módulo que lo trae.

**Nadie responde la invitación de otro.** `loadMyAssignment` y la acción filtran por `memberId`
—el de la sesión, nunca uno del formulario— y por `workspaceId`, los dos en el mismo `where`. Una
invitación ajena no aparece, y el mensaje es el mismo que cuando el id no existe: la respuesta no
cuenta si esa invitación existe.

**Responder dos veces no rompe nada.** El cambio se escribe con un `updateMany` que exige
`status: "INVITADA"` en su propio `where`, no con un `update` después de haber leído: entre la
lectura y la escritura hay una ventana y en esa ventana entra justo el segundo toque del botón.
Si no tocó ninguna fila, se avisa con calma. El aviso viaja por un campo propio (`aviso`, no
`error`) para que la pantalla lo muestre en gris y no en rojo.

### Consultas nuevas en `repository.ts` — las tres con `workspaceId` en su `where`

- `loadCoverage` ampliada: por rol, sus asignaciones y sus postulaciones con nombre y mensaje.
- `listActiveCollaborators({ workspaceId })`: sólo los de perfil activo, para la invitación
  directa. Distinta de `listCollaborators`, que trae todo el padrón porque su pantalla da de alta.
- `loadMyAssignment({ workspaceId, memberId, assignmentId })`.

`lib/coverages/aislamiento.test.ts` pasa: las tres entran solas al barrido.

### `lib/coverages/equipo-server.ts` (nuevo)

`aplicarEfectosSobreLaBusqueda(tx, ...)`: el recálculo compartido por las cuatro acciones que
tocan el equipo. Se llama **siempre dentro de la transacción** que escribió el cambio, con el
mismo `tx`, y vuelve a leer los roles desde la base —adentro de la transacción esa lectura ya ve
la asignación recién escrita—. Que una de las cuatro se olvidara de recalcular es exactamente cómo
una cobertura queda diciendo que tiene equipo cuando ya no lo tiene.

### Sin correos

Ninguno. Son la Tarea 9. Las transiciones quedaron en un solo lugar (`aplicarEfectosSobreLaBusqueda`
y las dos acciones) justamente para que engancharlos sea agregar una llamada.

### Los textos

"Te invitamos a participar", "Sí, cuenten conmigo", "Esta vez no puedo", "Si no podés, avisanos:
dejamos el lugar libre para otra persona y no pasa nada". Del lado del panel, quien no fue
seleccionada no queda marcada de ninguna manera: se anotó, y hoy no hizo falta.

### El teléfono

La pantalla de responder se abre desde un enlace de WhatsApp: una columna, los dos botones anchos
de `min-h-11` (44 px), deshabilitados los dos mientras se envía —un solo formulario con
`name="respuesta"` en cada botón, así no se puede apretar "confirmo" mientras "no puedo" viaja—.

## Verificación

```
$ pnpm test
Test Files  1 failed | 234 passed (235)
      Tests  1 failed | 2755 passed (2756)
```
La única falla es la conocida y ajena: `lib/template-v2/access.test.ts`, que falla igual desde
`main`. Los tests del módulo: `lib/coverages` 314/314 en verde (eran 288).

```
$ npx tsc --noEmit -p tsconfig.json
```
Sin salida — sin errores.

```
$ pnpm lint
✖ 10 problems (3 errors, 7 warnings)
```
Exactamente los mismos 10 de la tanda anterior. Los 3 errores son los conocidos y ajenos
(`hero-block-view.tsx` ×2, `mass-grading-screen.tsx` ×1). Nada en los archivos que toqué.

```
$ pnpm build
✓ Compiled successfully in 12.9s
```
Verde. `/portal/coberturas/asignacion/[id]` aparece en la tabla de rutas, junto a
`/portal/coberturas/[callId]`: el segmento estático `asignacion` gana sobre el dinámico, así que
no hay conflicto. Los `prisma:error ... DATABASE_URL` durante "Collecting page data" son de otras
páginas y de siempre; el build termina en 0.

## Dudas

1. **Al seleccionar a alguien, las demás postulaciones del rol no se marcan.** Quedan en
   `RECIBIDA`, no pasan a `NO_SELECCIONADA`. No lo hice porque ni la Tarea 7 ni el plan lo piden, y
   porque marcarlas sin el correo de la Tarea 9 dejaría a esas personas viendo "No seleccionada" en
   su portal sin que nadie les haya dicho nada. Cuando llegue la Tarea 9 hay que decidir si el
   cierre de la convocatoria las resuelve en masa o si es una acción de la coordinación.
2. **Nadie vuelve a entrar a una cobertura de la que salió.** `@@unique([coverageId, memberId])`
   no mira el estado: si alguien rechaza y después se arrepiente, esa fila ya existe y no se puede
   crear una asignación nueva. Es la misma forma del punto 2 de la tanda 4 y tiene la misma salida
   (un `update` en vez de un `create`), pero no la toqué porque reinvitar a quien rechazó no es
   parte de esta tanda. Hoy el mensaje que ve la coordinación es "Esa persona ya está en el equipo
   de esta cobertura", que en ese caso puntual es engañoso.
3. **Invitar directo con la cobertura `PLANIFICADA` está permitido** (modo de asignación
   `DIRECTA`), y por lo que expliqué arriba eso no la mueve de estado. Si la coordinación arma todo
   el equipo así y nunca publica una convocatoria, la cobertura se queda en `PLANIFICADA` aunque
   toda su gente confirme: `PLANIFICADA → EQUIPO_CONFIRMADO` no es una transición que exista. Es lo
   correcto según la máquina de estados, pero si el modo `DIRECTA` se va a usar de verdad, en algún
   momento va a hacer falta un paso explícito de "empezar a buscar" que no dependa de publicar.
