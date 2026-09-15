# Tanda 7 — La prueba de punta a punta, y lo que encontró

La etapa 1b ya estaba implementada entera. Esta tanda no agrega funcionalidad: escribe la prueba
que recorre el camino completo con las reglas puras —de la solicitud aprobada al equipo
confirmado— y usa ese recorrido para buscar lo que siete implementadores distintos, cada uno
viendo su pedazo, pudieran haber dejado sin encajar.

**Encontró un problema real**: armar el equipo publicaba sola una convocatoria que todavía estaba
en borrador.

| Hash | Qué |
|---|---|
| `e22d61ad` | La prueba de punta a punta de la etapa 1b |
| (este commit) | Arreglar lo que la prueba de punta a punta encontró |

---

## Qué encontré roto

### 1. Invitar a alguien publicaba la convocatoria que estaba en borrador — **arreglado**

**Dónde:** `efectosSobreLaBusqueda`, en `lib/coverages/equipo.ts`.

El recálculo que corre cada vez que se toca el equipo elegía el destino de la convocatoria así:

```ts
const destinoConvocatoria = sinLugares ? "COMPLETA" : "PUBLICADA";
if (canTransitionCall(input.callStatus, destinoConvocatoria)) { ... }
```

`PUBLICADA` está pensado como el destino de la **vuelta**: una convocatoria `COMPLETA` en la que
alguien rechazó y su lugar quedó libre tiene que volver a mostrarse abierta. Pero se proponía
para cualquier convocatoria con lugares libres, y `canTransitionCall("BORRADOR", "PUBLICADA")`
es —con razón— verdadero: esa es la publicación de verdad.

**Cómo se llegaba.** La coordinación crea la convocatoria (queda en `BORRADOR`) y, antes de
publicarla, invita a alguien directamente desde el panel del equipo. Esa invitación dispara el
recálculo, los roles todavía no están llenos, y la convocatoria pasaba a `PUBLICADA`.

**Qué rompía.** La publicación de verdad hace tres cosas más: pone `publishedAt`, valida título y
vacantes con `puedePublicarse`, y le manda un correo a cada colaborador activo. Publicada de
costado, la convocatoria aparecía en `/portal/coberturas` —`listOpenCallsForPortal` filtra por
`status: "PUBLICADA"`— sin que ningún colaborador se enterara, sin `publishedAt`, y el botón
«Publicar» del panel pasaba a fallar con «No se puede pasar de "Publicada" a "Publicada"».

**El arreglo.** El destino `PUBLICADA` se propone sólo cuando la convocatoria viene de `COMPLETA`.
Dos tests nuevos en `lib/coverages/equipo.test.ts` lo fijan (uno de ellos falla contra el código
anterior; lo verifiqué antes de tocar nada), y la prueba de punta a punta lo repite en su
contexto.

### 2. Un rol con vacantes que no son un número llegaba hasta Prisma — **arreglado**

**Dónde:** `planGenerarCobertura`, en `lib/coverages/generar-cobertura.ts`.

El control era `r.vacancies <= 0`. La acción arma ese campo con `Math.trunc(Number(...))` sobre un
campo del formulario, y un texto que no es un número da `NaN`. `NaN <= 0` es `false`, así que el
`NaN` pasaba el control y llegaba al `create` de Prisma, que corta con un error de sistema en vez
de con el aviso legible que esa función existe para dar. El formulario manda `type="number"`, así
que hace falta un POST armado a mano para provocarlo: es robustez, no una fuga.

Ahora exige `Number.isInteger(...) && > 0`, con dos tests nuevos.

### 3. La regla de «cuándo se edita» estaba escrita dos veces — **arreglado**

`convocatoria-panel.tsx` decidía `editable` comparando contra `"BORRADOR"` a mano, mientras el
resto del mismo archivo ya lee las reglas desde `lib/coverages/convocatoria.ts`. Ahora usa
`puedeEditarseConvocatoria(call.status)`, que es la misma función que aplica la acción del
servidor. Sin cambio de comportamiento.

---

## Lo que revisé y está bien

- **La barrera de aislamiento sigue siendo una barrera.** Le agregué a mano una consulta
  infractora de mentira en `repository.ts` (`prisma.coverage.findFirst` con `where: { id }` y sin
  `workspaceId`) y `lib/coverages/aislamiento.test.ts` falló nombrándola:
  `expected [ 'consultaInfractoraDeMentira' ] to deeply equal []`. La saqué y volvió a verde. No
  es una lista blanca: barre por código todas las funciones exportadas que consultan Prisma, así
  que una consulta nueva entra sola al barrido.
- **`privateBriefing` sólo en la pantalla de la asignación propia.** Aparece en
  `app/portal/coberturas/asignacion/[id]/page.tsx` y en el panel de coordinación (donde se
  escribe). `loadCallForPortal` —la consulta del detalle público de la convocatoria— ni siquiera
  lo trae, y `emails.test.ts` verifica que ningún armado de correo lo menciona.
- **Ninguna acción decide un estado en el cliente.** Los componentes `"use client"` del módulo no
  escriben un solo nombre de estado a mano; los dos que muestran u ocultan algo
  (`convocatoria-panel.tsx`) importan las mismas funciones puras que aplica el servidor, y toda
  acción vuelve a decidir con los datos de su propia transacción.
- **Las cuatro máquinas de estado cierran.** Recorrí las cuatro tablas de `transitions.ts`: no hay
  ningún estado vivo sin salida. Las que el código agrega por encima de la tabla del plan
  (`EQUIPO_CONFIRMADO → BUSCANDO_EQUIPO` y `SIN_EQUIPO → BUSCANDO_EQUIPO`) están documentadas y
  tienen motivo.
- **Los nombres entre tandas concuerdan.** `tsc --noEmit` limpio, y las firmas que una tanda
  produjo y la siguiente consumió (`EstadoDeRol` con sus tres campos, `EfectosSobreLaBusqueda`,
  `AvisoDeEquipoCompleto`, las cuatro claves de `COVERAGE_EMAIL_KEYS`) coinciden en los dos lados.

---

## Lo raro pero defendible, que NO toqué

1. **Hay transiciones sin nadie que las dispare.** Nada en el código lleva una convocatoria a
   `VENCIDA`, ni una cobertura a `SIN_EQUIPO`, `REALIZADA`, `ENTREGADA`, `CERRADA` o `CANCELADA`,
   ni cancela una asignación. Falta el cron de vencimiento y faltan las pantallas de cierre y
   cancelación. El plan implementa las transiciones a propósito «para no tener que volver a tocar
   el archivo», y las pantallas son de la 1c. **Que el plazo de postulaciones venza igual
   funciona**: `puedePostularse` compara la fecha directamente y no depende del estado `VENCIDA`.
2. **`ACEPTADA` no la produce nadie.** El portal va de `INVITADA` a `CONFIRMADA` de un paso.
   `equipoConfirmado` la cuenta igual, y `states.ts` explica que son dos momentos distintos que la
   1c va a separar. Correcto como está.
3. **Quien rechazó una invitación sigue viendo el `privateBriefing`.** `loadMyAssignment` no
   filtra por estado. Es información que esa persona ya vio cuando estaba invitada; borrarla de su
   pantalla no la borra de su memoria.
4. **El `catch` de las dos acciones de armar equipo traduce cualquier error a «Esa persona ya está
   en el equipo».** Está pensado para el índice único `(coverageId, memberId)`, pero atrapa
   también una caída de la base y le muestra a la coordinación un mensaje que no corresponde. No
   lo toqué porque cambiar el manejo de errores de dos acciones no es lo que esta tanda vino a
   hacer, pero conviene mirarlo: alcanzaría con distinguir el código `P2002` de Prisma.
5. **`listActiveCollaboratorEmails` no mira el estado del socio en el padrón.** Alguien dado de
   baja como socio pero con perfil de colaborador activo sigue recibiendo los avisos de
   convocatoria. El perfil activo es la llave que el plan define, así que es coherente; queda
   anotado por si la coordinación esperaba lo otro.

---

## La prueba

`lib/coverages/criterios-1b.test.ts`, 28 casos, misma forma que
`criterios-de-aceptacion.test.ts` de la 1a: los mismos datos del §32 —Asociación Manos Abiertas,
jornada del 26.09.2026 de 14:00 a 18:30 en Rosario, 4 h 30— recorridos de punta a punta con
funciones puras, sin base y sin mandar un correo.

Cubre, en este orden: la cobertura sugerida desde la solicitud aprobada y sus dos roles (el
refuerzo de la 1a convertido en puesto); la convocatoria creada desde `PLANIFICADA` **y** desde
`BUSCANDO_EQUIPO`, publicada, moviendo la cobertura sólo si hacía falta; las cinco reglas de
`puedePostularse` en su orden exacto; que un rol lleno **no** bloquea anotarse como suplente; la
selección de postulaciones y el choque de dos personas por una sola vacante; **la distinción que
sostiene la etapa** —roles completos ≠ equipo confirmado—; el rechazo que devuelve el lugar,
reabre la convocatoria y saca a la cobertura de `EQUIPO_CONFIRMADO`; el cierre de las
postulaciones sin respuesta; y los cuatro correos, con el de colaboradores saliendo uno por
persona.

Verifiqué que el caso central muerde de verdad: mutando `equipoConfirmado` para que cuente
asignaciones vivas en lugar de aceptadas, el test «ROL COMPLETO NO ES EQUIPO CONFIRMADO» falla.

---

## Los cuatro comandos

Desde `apps/fotoffice`:

### `pnpm test`

```
 ⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  lib/template-v2/access.test.ts > los puntos de control del diseñador > app/(shell)/members/disenador/[templateId]/[versionId]/page.tsx decide el permiso con canDesignTemplates
Error: ENOENT: no such file or directory, open '.../apps/fotoffice/app/(shell)/members/disenador/[templateId]/[versionId]/page.tsx'

 Test Files  1 failed | 236 passed (237)
      Tests  1 failed | 2834 passed (2835)
   Duration  8.97s
```

La única falla es la sabida y ajena de `lib/template-v2/access.test.ts`, que ya venía de `main`.
Los 24 archivos de `lib/coverages` pasan: 361 tests antes de esta tanda, 393 después.

### `npx tsc --noEmit -p tsconfig.json`

```
EXIT=0
```

Sin una sola línea de salida.

### `pnpm lint`

```
✖ 10 problems (3 errors, 7 warnings)
```

Los 3 errores son los sabidos y ajenos: dos en
`components/website/render/blocks/hero-block-view.tsx` (líneas 32 y 71) y uno en
`components/evaluaciones/mass-grading-screen.tsx`, los tres de `react-hooks/set-state-in-effect`.
Las 7 advertencias son variables sin usar en `app/actions/membership-applications.ts`,
`app/actions/split-consent.ts`, `app/actions/website.ts` y `lib/membership/approve.ts`. **Ningún
problema, ni error ni advertencia, en el módulo de coberturas.**

### `pnpm build`

```
✓ Compiled successfully in 11.9s
✓ Generating static pages using 7 workers (45/45) in 401ms
EXIT=0
```

Las seis rutas del módulo compilan como dinámicas, como corresponde:

```
├ ƒ /coberturas/c/[coverageId]
├ ƒ /coberturas/colaboradores
├ ƒ /coberturas/configuracion
├ ƒ /portal/coberturas
├ ƒ /portal/coberturas/[callId]
├ ƒ /portal/coberturas/asignacion/[id]
```

Los `prisma:error Environment variable not found: DATABASE_URL` del build son de siempre en local
y no lo voltean: el proceso termina en 0.

---

## Ninguna base, ningún correo

No se tocó ninguna base ni ninguna migración, y no salió ningún correo real: todo lo que esta
tanda ejecutó son funciones puras en Vitest. La etapa 1b sigue sin necesitar migraciones nuevas.
