# Tanda 1 — Las cuatro máquinas de estado, cupos y elegibilidad

Rama `feat/coberturas-armar-el-equipo`. Corresponde a las Tareas 1 y 2 del plan
`docs/superpowers/plans/2026-09-15-coberturas-etapa-1b.md`.

## Qué se escribió

**Ampliado, siguiendo el patrón de la solicitud (`RequestStatus`/`assertRequestTransition`):**

- `lib/coverages/states.ts`: `COVERAGE_STATUSES`, `CALL_STATUSES`, `APPLICATION_STATUSES`,
  `ASSIGNMENT_STATUSES`, cada uno con su tipo, su `is*Status`, sus `*_LABELS`, su
  `*StatusLabel()` y su `*_LIVE_STATUSES`.
- `lib/coverages/transitions.ts`: `canTransitionCoverage`, `canTransitionCall`,
  `canTransitionApplication`, `canTransitionAssignment`; `assertCoverageTransition`,
  `assertCallTransition`, `assertApplicationTransition`, `assertAssignmentTransition` (misma
  firma que `assertRequestTransition`); y `coverageTransitionRequiresReason`,
  `callTransitionRequiresReason`, `assignmentTransitionRequiresReason` (análogos a
  `transitionRequiresReason`, exportados para que las pantallas de tandas siguientes sepan
  cuándo pedir el campo de motivo sin adivinar).
- `lib/coverages/transitions.test.ts`: 67 tests nuevos (camino feliz, salto prohibido, terminal
  que no reabre, `from === to`, estado inventado y motivo obligatorio, por cada máquina).

**Nuevo:**

- `lib/coverages/cupos.ts` + `cupos.test.ts` (9 tests): `EstadoDeRol`, `lugaresLibres`,
  `rolCompleto`, `equipoCompleto`.
- `lib/coverages/elegibilidad.ts` + `elegibilidad.test.ts` (14 tests): `CandidatoAConvocatoria`,
  `Elegibilidad`, `puedePostularse`.

Ningún archivo importa Prisma ni lleva `server-only`. No se tocó ninguna base ni migración.

## Decisiones y por qué

**Cobertura.** `EQUIPO_CONFIRMADO → BUSCANDO_EQUIPO` es una transición válida: la Tarea 8 del
plan dice explícitamente que si alguien ya asignado rechaza estando la cobertura con equipo
confirmado, la cobertura tiene que volver a buscar equipo, "sin eso, un rechazo deja la
cobertura sin equipo y nadie se entera". `SIN_EQUIPO` no tiene salida: la convocatoria es 1:1
con la cobertura (vocabulario del plan) y ya está vencida, así que retomar la búsqueda sería
una cobertura nueva, no reabrir esta. `CANCELADA` se alcanza desde cualquier estado vivo
(`PLANIFICADA`, `BUSCANDO_EQUIPO`, `EQUIPO_CONFIRMADO`), con el mismo patrón que `CANCELACIONES`
en la solicitud, y exige motivo.

**Convocatoria.** Simétrico a lo anterior: `COMPLETA → PUBLICADA` es válida por la misma razón
de la Tarea 8 (rechazo tardío). `VENCIDA` y `CERRADA` son terminales. `CANCELADA` desde
cualquier estado vivo (`BORRADOR`, `PUBLICADA`, `COMPLETA`), con motivo.

**Postulación.** Modelé `EN_REVISION` y `PRESELECCIONADA` como pasos **opcionales**: nada en el
plan obliga a pasar por ellos, y la Tarea 7 describe al coordinador seleccionando sin mencionar
un paso de revisión previo obligatorio. Por eso `SELECCIONADA`, `NO_SELECCIONADA`, `RETIRADA` y
`VENCIDA` —las cuatro resoluciones— se alcanzan desde cualquier estado vivo
(`RECIBIDA`, `EN_REVISION`, `PRESELECCIONADA`), en vez de forzar un camino lineal. Ninguna
transición de postulación exige motivo, tal como pide el plan explícitamente para el rechazo, y
extendí esa misma razón a retirarse y vencer (decisiones de la propia persona o del reloj, no
del coordinador).

**Asignación — la decisión menos obvia.** El diagrama del plan muestra
`INVITADA → ACEPTADA → CONFIRMADA` como una cadena de dos pasos, pero la Tarea 8 (la pantalla
del portal, de otra tanda) describe una sola respuesta de la persona invitada — "confirmo" o
"no puedo" — que va directo a `CONFIRMADA` o `RECHAZADA`. En vez de elegir una lectura y
descartar la otra, dejé **ambos caminos válidos**: `INVITADA → ACEPTADA` (por si `Tarea 8`
finalmente sí distingue aceptar de confirmar, o si la modalidad `AUTOMATICA`/`MIXTA` del
workspace lo necesita más adelante) y `INVITADA → CONFIRMADA` directo (para no bloquear la
implementación literal que describe la Tarea 8). Ninguno de los dos inventa un estado nuevo ni
contradice el diagrama; sólo no fuerzo un único camino donde el plan da dos descripciones. Lo
marco como duda abajo porque interpretarlo distinto no rompe esta tanda, pero sí puede importar
para la Tarea 8.

`CANCELADA` y `REEMPLAZADA` se alcanzan desde cualquier estado vivo (`PROPUESTA`, `INVITADA`,
`ACEPTADA`, `CONFIRMADA`): un coordinador puede necesitar dar de baja o reemplazar a alguien en
cualquier momento antes de que ocurra la cobertura. `AUSENTE` sólo es válida desde `CONFIRMADA`
—si nunca confirmó, no "faltó", directamente no estaba—. `CANCELADA` y `AUSENTE` exigen motivo,
tal como pide el plan; `REEMPLAZADA` no, porque el plan no la lista entre las que lo exigen.

**Cupos.** `equipoCompleto([])` devuelve `false`, no `true`: un arreglo vacío (nadie generó los
roles todavía) no es una cobertura completa, y un `.every()` sobre vacío daría `true` por
vacuidad lógica — un falso positivo real si alguien lo llama antes de crear los roles.
`lugaresLibres` usa `Math.max(0, …)` explícitamente, con test del caso "vacantes bajadas después
de asignar".

**Elegibilidad.** `puedePostularse` sigue el orden exacto del plan (perfil → convocatoria
publicada → plazo → ya asignada → ya postulada), con un test dedicado (`el orden de las
reglas`) que rompe las cinco reglas a la vez y las va resolviendo de a una, confirmando que el
mensaje avanza en ese orden exacto. `CandidatoAConvocatoria` no lleva ningún dato de vacantes —
es la firma que pide el plan— así que "un rol completo no bloquea la postulación" queda
demostrado por construcción: la función no tiene manera de negarse por eso. El test de esa
regla igual quedó explícito, con el comentario de por qué el tipo no lleva esa información. El
cierre de postulaciones es exclusivo ("cierra después de esa hora, no en ella"): con
`cierreDePostulaciones === ahora`, todavía puede postularse.

## Comandos y salida

```
$ pnpm test
 Test Files  1 failed | 230 passed (231)
      Tests  1 failed | 2671 passed (2672)
```
La única falla es `lib/template-v2/access.test.ts` (ajena, ya rota desde `main`, sin relación
con este trabajo).

```
$ npx tsc --noEmit -p tsconfig.json
(sin salida — sin errores)
```

```
$ pnpm lint
✖ 10 problems (3 errors, 7 warnings)
```
Los 3 errores son los ya conocidos y ajenos: 2 en `hero-block-view.tsx`, 1 en
`mass-grading-screen.tsx`. Ningún archivo de esta tanda aparece en la salida de lint.

## Dudas

1. **`INVITADA → ACEPTADA → CONFIRMADA` vs. confirmar en un solo paso.** Documentado arriba.
   Dejé el dominio permitiendo ambos caminos (`INVITADA` puede ir a `ACEPTADA` o directo a
   `CONFIRMADA`) para no cerrarle una puerta a quien implemente la Tarea 8. Si preferís que el
   dominio fuerce un único camino, decime cuál y lo ajusto — es un cambio de una línea en la
   tabla de `transitions.ts` más un test que dé vuelta.
2. **`SIN_EQUIPO` sin salida.** Asumí que es terminal porque la convocatoria es 1:1 con la
   cobertura y ya está vencida cuando se llega ahí. Si en alguna tanda siguiente hiciera falta
   "reabrir la búsqueda" sobre la misma cobertura (por ejemplo, permitiendo una segunda
   convocatoria), este archivo necesitaría un estado más en la tabla — aviso ahora para que no
   sea sorpresa, no porque haga falta resolverlo hoy.

No until acá hubo nada que tocara base de datos, Prisma, pantallas o `repository.ts`.

## Corrección: separar rol completo de equipo confirmado

Respuesta a las dos dudas de arriba, más un tercer problema que la primera destapó.

**1. `ACEPTADA` y `CONFIRMADA` no son un paso duplicado.** `ACEPTADA` es que la persona dijo
que sí cuando se la invitó; `CONFIRMADA` es la confirmación de asistencia cerca de la fecha
(la etapa 1c, junto con la ficha operativa del día). Las dos transiciones quedan como estaban
—el dominio no cambió— y agregué el comentario que lo explica en `ASSIGNMENT_STATUSES`
(`lib/coverages/states.ts`), para que no se lean como un paso sobrante y alguien las unifique.

**2. `SIN_EQUIPO` deja de ser terminal.** `SIN_EQUIPO → BUSCANDO_EQUIPO` ahora es una
transición válida en `lib/coverages/transitions.ts`: una cobertura que se quedó sin gente y
todavía tiene fecha por delante se puede reintentar sin perder su historial creando una
cobertura nueva. Actualicé el comentario de la tabla, el de `COVERAGE_STATUSES` en `states.ts`
y los tests de `transitions.test.ts` (el que decía "es terminal: no se reabre sola" ahora
prueba lo contrario, más un test nuevo de que `SIN_EQUIPO` no salta directo a
`EQUIPO_CONFIRMADO`).

**3. El problema que apareció: "rol completo" y "equipo confirmado" no son lo mismo.** Si se
invita a alguien para una vacante y todavía no contestó, el rol ya no admite otra invitación
para ese lugar (cuenta la asignación viva), pero el equipo no está confirmado (nadie dijo que
sí). La función única `equipoCompleto` habría hecho pasar la cobertura a `EQUIPO_CONFIRMADO` en
cuanto se mandaran las invitaciones, sin que nadie hubiera aceptado — un falso "ya tenés
equipo" para la organización solicitante.

Reemplacé `equipoCompleto` en `lib/coverages/cupos.ts` por:
- `EstadoDeRol` ahora lleva también `asignadasAceptadas` (ACEPTADA | CONFIRMADA), además de
  `asignadasVivas` (PROPUESTA | INVITADA | ACEPTADA | CONFIRMADA).
- `rolCompleto` sigue igual en comportamiento (mira `asignadasVivas`), con el comentario que
  explica por qué cuenta invitaciones sin responder.
- `equipoConfirmado(roles)`: todos los roles con `asignadasAceptadas >= vacancies`. `false` con
  lista vacía.
- `todosLosRolesCompletos(roles)`: todos los roles con `rolCompleto`. `false` con lista vacía.

Until acá nadie más en el repo llamaba a `equipoCompleto` fuera de `cupos.ts` y su test, así que
no quedó ningún call site roto.

Tests nuevos en `lib/coverages/cupos.test.ts` que fijan la diferencia (los cuatro casos
pedidos): un rol de 1 vacante con 1 invitada sin responder da `rolCompleto` `true` y
`equipoConfirmado` `false`; la misma persona aceptando da las dos `true`; dos roles (uno
aceptado, otro solo invitado) dan `todosLosRolesCompletos` `true` y `equipoConfirmado` `false`;
y sin roles, `equipoConfirmado` es `false`.

### Comandos y salida

```
$ pnpm test
 Test Files  1 failed | 230 passed (231)
      Tests  1 failed | 2677 passed (2678)
```
Única falla: `lib/template-v2/access.test.ts` (ajena, ya rota desde `main`).

```
$ npx tsc --noEmit -p tsconfig.json
(sin salida — sin errores)
```

```
$ pnpm lint
✖ 10 problems (3 errors, 7 warnings)
```
Los 3 errores son los mismos ya conocidos y ajenos (2 en `hero-block-view.tsx`, 1 en
`mass-grading-screen.tsx`); ningún archivo de esta corrección aparece en la salida.

### Dudas

1. `SIN_EQUIPO` ahora puede cancelarse, no solo volver a `BUSCANDO_EQUIPO`? Hoy
   `COVERAGE_LIVE_STATUSES` no incluye `SIN_EQUIPO`, así que `canTransitionCoverage("SIN_EQUIPO",
   "CANCELADA")` sigue dando `false`. No lo toqué porque no estaba pedido y es una decisión de
   producto (¿tiene sentido cancelar una cobertura que ya está sin equipo, en vez de solo
   reintentarla?) — avisen si hace falta.
2. `rolCompleto` no cambió de comportamiento, solo de comentario. Si en algún lugar de una tanda
   siguiente hiciera falta un "rol completo y todos aceptaron" combinado (no solo por cobertura
   sino por rol individual), hoy no hay una función así — se puede armar comparando
   `asignadasAceptadas >= vacancies` de un solo `EstadoDeRol`, no hizo falta agregarla porque
   nada la pedía.
