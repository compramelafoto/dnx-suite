# Informe — task 1011 (ronda de corrección, coberturas)

Rama: `feat/fotoffice-solicitudes-y-coberturas`
Worktree: `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/.claude/worktrees/fotoffice-solicitudes-coberturas`

## HALLAZGO 1 — apagar el módulo no cerraba el formulario público

`submitCoverageRequestAction` (`app/actions/coverage-request.ts`) revalidaba `settings.publicFormEnabled`
pero nunca comprobaba `isModuleEnabledForWorkspace`. La pantalla sí lo comprueba y devuelve 404, pero
una referencia a la Server Action guardada en una pestaña vieja —tomada mientras el módulo estaba
encendido— seguía siendo invocable directamente y guardaba la solicitud igual.

**Corrección**: justo después de resolver `branding` y antes de cualquier otra cosa (parseo del
formulario, consentimientos, settings, etc.), se agregó:

```ts
const moduloEncendido = await isModuleEnabledForWorkspace(
  branding.workspaceId,
  COVERAGES_MODULE_KEY,
);
if (!moduloEncendido) {
  return { error: "Las solicitudes no están abiertas en este momento.", ok: null };
}
```

Mismo mensaje que ya se usa cuando el formulario está cerrado, a propósito: quien envía no tiene por
qué distinguir "el módulo está apagado" de "el formulario está cerrado". Se agregó un comentario en
el código explicando por qué la comprobación existe ahí aunque la pantalla ya devuelva 404 (una
referencia de Server Action guardada sigue siendo invocable; esconder la pantalla no alcanza).

Import agregado: `COVERAGES_MODULE_KEY` de `@/lib/coverages/constants` e `isModuleEnabledForWorkspace`
de `@/lib/modules/gating` (ambos ya existentes, usados así en el resto del proyecto, p. ej.
`lib/coverages/access.ts`).

## HALLAZGO 2 — `findByTrackingToken` traía la fila entera

`lib/coverages/repository.ts` usaba `include: { client: { select: { businessName: true } } }` sin
`select` sobre `CoverageRequest`, así que traía todos los campos, incluidos internos como
`coordinatorUserId` y `priority`.

**Corrección**: se cambió a un `select` explícito con exactamente los campos pedidos: `id`,
`workspaceId`, `publicCode`, `eventTitle`, `startsAt`, `status`, `rejectionReason`,
`infoRequested`, `tokenExpiresAt`, `tokenRevokedAt`, y `client: { select: { businessName: true } }`.
Se agregó un comentario explicando por qué se enumera en vez de traer todo: lo que no se trae no se
puede filtrar por accidente.

**Verificación de los dos llamadores**:
- `app/sc/[token]/page.tsx`: usa `publicCode`, `eventTitle`, `startsAt`, `status`,
  `rejectionReason`, `infoRequested`, y pasa la fila a `resolveTrackingView` (que sólo necesita
  `status`, `tokenExpiresAt`, `tokenRevokedAt`). Todo cubierto por el `select` nuevo.
- `app/actions/coverage-tracking.ts`: usa `solicitud.id`, `solicitud.workspaceId`,
  `solicitud.client.businessName`, y también pasa la fila a `resolveTrackingView`. Todo cubierto.

**No hizo falta agregar ningún campo más** al `select` propuesto en la consigna; los dos llamadores
compilan sin cambios y `tsc --noEmit` queda limpio.

## Efecto colateral encontrado en la verificación (no corregido, fuera del alcance permitido)

`pnpm test` reporta una falla NUEVA que no existía antes de este cambio:

```
FAIL lib/coverages/aislamiento.test.ts > el repositorio no puede filtrar entre workspaces
  > la única que no lleva workspace es la del token, y está justificada
AssertionError: expected 'findByTrackingToken(rawToken: string)…' not to match /workspaceId/
```

Ese test verifica, por regex sobre el texto fuente, que el *cuerpo* de `findByTrackingToken` no
contenga la cadena `workspaceId` — su intención original es detectar un `WHERE workspaceId: ...`
que filtraría por institución (cosa que esta función no debe hacer, porque el token es la
credencial). Pero ahora el `select` explícito necesita devolver el campo `workspaceId` (lo usa
`coverage-tracking.ts` para `recordEvent`), y el regex no distingue "se selecciona/devuelve el
campo" de "se filtra por él en el `where`". La función sigue sin filtrar por `workspaceId` en el
`where` — el aislamiento real no cambió — pero el test, tal como está escrito, no lo diferencia.

No toqué `lib/coverages/aislamiento.test.ts` porque la consigna restringe los archivos a
`app/actions/coverage-request.ts` y `lib/coverages/repository.ts`. Queda pendiente de decisión:
ajustar ese test para que sólo mire el `where` (no el `select`), o aceptar la falla como conocida
si se decide encarar el test en otra tarea.

## Verificación (desde `apps/fotoffice`)

### `pnpm test`
2 archivos fallidos de 227, 2 tests fallidos de 2557. Uno es el conocido y ajeno
(`lib/template-v2/access.test.ts`, falla desde `main` por un archivo que no existe en este
worktree). El otro es el efecto colateral de HALLAZGO 2 descripto arriba
(`lib/coverages/aislamiento.test.ts`), nuevo y explicado.

### `npx tsc --noEmit -p tsconfig.json`
Limpio, sin salida.

### `pnpm lint`
3 errores preexistentes (no relacionados con este cambio): 2 en
`components/website/render/blocks/hero-block-view.tsx` y 1 en
`components/evaluaciones/mass-grading-screen.tsx` (los tres son `react-hooks/set-state-in-effect`).
Sin errores nuevos.

### `pnpm build`
Compila. `/w/[workspaceSlug]/coberturas/solicitar` y `/sc/[token]` aparecen en el árbol de rutas
como `ƒ` (dinámicas), sin errores de build.

## Corrección del falso positivo en `aislamiento.test.ts` (esta ronda)

El pendiente que quedó anotado arriba ("ajustar ese test para que sólo mire el `where`") es
exactamente lo que se corrigió acá. El test confundía dos cosas distintas: **filtrar** por
`workspaceId` (en el `where`) y **devolver** `workspaceId` (en un `select`). `findByTrackingToken`
hace lo segundo (lo necesita `coverage-tracking.ts`) pero nunca lo primero, y el test —al buscar
la cadena `workspaceId` en el cuerpo completo de la función— no distinguía ambos casos.

**Cambio, sólo en `lib/coverages/aislamiento.test.ts`**:

- Se agregó una función `extraerWhere(cuerpo)` que ubica `where:` y extrae el objeto que le sigue
  contando llaves balanceadas desde su apertura hasta que la profundidad vuelve a cero (no corta
  en la primera `}`, que en consultas con objetos anidados —`client: { email: ... }`,
  `consents: { some: { ... } }`— pertenece a un objeto interno y deja el bloque a medias).
- La prueba "ninguna consulta a prisma se olvida del workspaceId" pasa a llamarse "ninguna
  consulta a prisma filtra sin workspaceId en su where" y ahora aplica el regex sobre
  `extraerWhere(f.cuerpo)`, no sobre `f.cuerpo` entero.
- La prueba de `findByTrackingToken` pasa a afirmar que `extraerWhere(fn.cuerpo)` NO contiene
  `workspaceId` (antes afirmaba eso sobre el cuerpo entero, que ahora sí lo contiene por el
  `select`). Se mantiene la comprobación de que el comentario de justificación sigue en el
  archivo.
- Se reescribió el comentario del `describe` y el de cada `it` para explicar la distinción entre
  filtrar y devolver, y por qué el barrido mira sólo el `where`.

**Comprobación de que la barrera sigue teniendo dientes** (dos funciones temporales agregadas y
borradas de `repository.ts`, una por vez, sólo para esta comprobación — el archivo quedó
exactamente igual al original, confirmado con `git status`/diff sin cambios):

1. Función con `where: { id }` (sin `workspaceId`) y sin devolverlo tampoco:
   ```
   AssertionError: expected [ 'funcionInfractoraSinFiltro' ] to deeply equal []
   ```
2. Función con el mismo `where: { id }` (sin `workspaceId`) pero que sí lo trae en el `select`
   (`select: { id: true, workspaceId: true }`) — para probar que devolver no alcanza para pasar
   la barrera:
   ```
   AssertionError: expected [ 'funcionInfractoraSoloDevuelve' ] to deeply equal []
   ```

Ambas nombran correctamente a la función infractora y ambas fallan por no filtrar en el `where`,
que es la distinción que se quería asegurar.

**Verificación final (desde `apps/fotoffice`)**:
- `pnpm test lib/coverages/`: 16 archivos, 128 tests, todo verde.
- `npx tsc --noEmit -p tsconfig.json`: limpio, sin salida.

Único archivo que quedó modificado: `lib/coverages/aislamiento.test.ts`. No se tocó
`repository.ts` de forma permanente ni ninguna base de datos.
