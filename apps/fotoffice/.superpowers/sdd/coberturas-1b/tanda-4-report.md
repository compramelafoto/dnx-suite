# Cuarta tanda — etapa 1b de coberturas (Tarea 6: el portal del voluntario)

Rama `feat/coberturas-armar-el-equipo`, worktree `fotoffice-solicitudes-coberturas`.

## Qué escribí

### `lib/coverages/repository.ts` (ampliado)

Cuatro consultas nuevas, todas con `workspaceId` en su `where` (`aislamiento.test.ts` sigue en
verde):

- `listOpenCallsForPortal({ workspaceId })` — las convocatorias `PUBLICADA`, con sus roles y las
  asignaciones de esos roles (para que la pantalla sume `lugaresLibres` sin una segunda vuelta a
  la base). Ordenadas por `coverage.startsAt`.
- `listMyApplications({ workspaceId, memberId })` — las postulaciones de esa persona.
  `CoverageApplication` no tiene columna `workspaceId` propia, así que el aislamiento por
  institución va por `call: { workspaceId }` (nested, mismo patrón que ya usa
  `findDuplicateRequest` con `client: { email }`); el aislamiento por persona va por `memberId`
  directo — es el cuidado del plan de que "mis postulaciones" no muestre las de otro socio.
- `listMyPendingAssignments({ workspaceId, memberId })` — las asignaciones en `INVITADA`
  únicamente. `ACEPTADA`/`CONFIRMADA` ya no esperan nada de esta persona; `RECHAZADA`,
  `CANCELADA` y `REEMPLAZADA` tampoco. Es justo el conjunto de "tiene un plazo corriendo", que es
  por lo que ese bloque va primero en la pantalla.
- `loadCallForPortal({ workspaceId, callId })` — el detalle de una convocatoria: la cobertura
  completa **con la dirección** (decisión ya tomada en la Tarea 5, §3.4 del diseño) y los roles
  con TODAS sus asignaciones y postulaciones (de cualquier persona, no solo de quien mira), para
  que la pantalla calcule cupos y elegibilidad de una sola consulta. **No** trae
  `privateBriefing`: ni siquiera está en el `select`, así que no hay manera de que se filtre por
  accidente el día que alguien copie este bloque para otra pantalla.

### `app/actions/coverage-portal.ts` (nuevo)

`postularseAction(prevState, formData)`, pensada para `useActionState`:

1. Vuelve a resolver todo con los datos de este instante — nada llega de confianza desde el
   formulario salvo los IDs. El rol se busca con `where: { id: roleId, coverage: { call: { id:
   callId, workspaceId } } }`: un `roleId` o `callId` ajeno simplemente no aparece, sin un
   chequeo aparte después.
2. Arma el `CandidatoAConvocatoria` (perfil activo vía `loadCollaboratorProfile` +
   `perfilHabilitado`; ya postulado, buscando la fila por la clave única `roleId_memberId`; ya
   asignado, contando asignaciones vivas de la cobertura) y llama a `puedePostularse` — la misma
   función pura de la Tarea 2, ya probada. No reimplementé ninguna regla de elegibilidad acá.
3. Si puede, crea la `CoverageApplication` en `RECIBIDA` y su evento `CREADA` en una sola
   `$transaction`.
4. Atrapa el choque contra el índice único (`roleId, memberId`) por si dos pestañas llegan a la
   vez y lo traduce a "Ya te anotaste." en vez de un error de Prisma.

No usé `redirect`: junto con `useActionState`, el mismo patrón que ya tiene
`ConvocatoriaPanel`/`convocatoria-panel.tsx` (Tarea 5) — devolver `{ error, ok }` y dejar que el
formulario cliente muestre el estado y deshabilite el botón mientras envía.

### `app/portal/coberturas/page.tsx` (nuevo)

Los tres bloques del plan, en ese orden. Antes que nada, la comprobación de la llave de todo el
portal: `perfilHabilitado(await loadCollaboratorProfile(...))`. Sin perfil activo, ninguna de las
tres listas se pide siquiera — se corta ahí con el aviso amable ("Todavía no estás habilitado
para anotarte a una cobertura. Hablá con la coordinación...").

- **Tus invitaciones**: no se muestra el bloque si está vacío. El enlace lleva al detalle de la
  convocatoria (`/portal/coberturas/[callId]`), no a una pantalla de responder — esa es la tanda
  siguiente, y el plan pide explícitamente dejarlo así.
- **Convocatorias abiertas**: fecha, ciudad y lugares libres (suma de `lugaresLibres` de todos
  los roles). Si da cero, el texto dice "el equipo ya está completo, pero podés anotarte como
  suplente" en vez de ocultar la convocatoria — un rol completo no bloquea, por regla del plan.
- **Tus postulaciones**: rol, cobertura, fecha y `applicationStatusLabel` — los mismos textos
  amables que ya define `states.ts` desde la Tarea 1 (`"No seleccionada"`, no "rechazada").

### `app/portal/coberturas/[callId]/page.tsx` + `postularse-form.tsx` (nuevos)

Mismo candado de perfil activo al principio. Si el `callId` no es de este workspace,
`loadCallForPortal` devuelve `null` y la pantalla hace `notFound()`.

Por cada rol se arma un `CandidatoAConvocatoria` fresco y se llama a `puedePostularse`: si
`{ puede: true }`, se muestra el formulario (`PostularseForm`, cliente); si no, se muestra
`elegibilidad.motivo` tal cual — son los mensajes amables ya escritos en `elegibilidad.ts`, así
que la pantalla no inventa ningún texto nuevo para "ya te anotaste" o "convocatoria cerrada".
Esto también resuelve solo, sin lógica aparte, el caso de una convocatoria que ya no está
`PUBLICADA` (por ejemplo `COMPLETA`): sigue siendo visible desde "tus postulaciones", pero sin
botón.

`yaEstaAsignado` se calcula sobre TODOS los roles de la cobertura, no solo el que se está
mirando: `CoverageAssignment` tiene `@@unique([coverageId, memberId])`, o sea que estar asignado
en cualquier rol de esa cobertura ya significa "estás en el equipo" para los demás roles.

`PostularseForm` es un componente cliente con `useActionState`, un formulario por rol (cada uno
con su propio estado de "enviando"), textarea de mensaje opcional, y el botón deshabilitado
mientras se envía — el cuidado del plan sobre el teléfono y el doble toque.

### `lib/portal/menu.ts` + `components/portal/portal-icon.tsx`

Entrada nueva en `PORTAL_MENU`: `order: 65` (entre Reservas y Sorteos — no encontré "Coberturas"
mencionada en `docs/fotoffice/ARQUITECTURA-NAVEGACION.md`, así que elegí el lugar; lo marco como
duda más abajo), `href: "/portal/coberturas"`, `requiresModule: COVERAGES_MODULE_KEY`,
`built: true`, sin `primary` (la barra del teléfono ya tiene sus cuatro: inicio, carnet, cuotas,
perfil). Agregué el ícono `"camera"` a `PortalIconName` y su trazo en `portal-icon.tsx`, porque
ningún ícono existente encajaba y todos los demás ítems del menú tienen uno propio.

## Qué decidí y por qué

- **No toqué `repository.ts` para el chequeo de "ya postulado"/"ya asignado" dentro de la
  acción**: esas dos consultas puntuales viven en `coverage-portal.ts` directo con `prisma`,
  igual que `crearConvocatoriaAction` y `publicarConvocatoriaAction` ya hacen con `prisma.coverage
  .findFirst` en la Tarea 5. `aislamiento.test.ts` solo audita `repository.ts` a propósito (según
  su propio comentario), así que esto es consistente con el patrón ya establecido, no un atajo
  para esquivar el test.
- **No escribí un test nuevo para `postularseAction`**: toda la decisión de elegibilidad vive en
  `puedePostularse`, que ya está probada exhaustivamente en `elegibilidad.test.ts` (Tarea 2). La
  acción solo junta datos frescos de la base y llama a esa función — no hay regla nueva que
  probar de forma aislada, siguiendo el mismo criterio que ya separa `planPublicarConvocatoria`
  (con test) de la acción que la usa (sin test propio).
- **"Convocatorias abiertas" muestra el total de lugares libres de la convocatoria**, no un
  desglose por rol — el desglose vive en el detalle. El plan pide "cuántos lugares quedan" en
  singular para la lista.

## Comandos y salida

```
$ pnpm test
 Test Files  1 failed | 233 passed (234)
      Tests  1 failed | 2729 passed (2730)
```
La única falla es la conocida y ajena: `lib/template-v2/access.test.ts` (falla igual desde
`main`, sin relación con esta tanda).

```
$ npx tsc --noEmit -p tsconfig.json
```
Sin salida — sin errores.

```
$ pnpm lint
✖ 10 problems (3 errors, 7 warnings)
```
Los 3 errores son los conocidos y ajenos: 2 en `components/website/render/blocks/hero-block-view.tsx`
y 1 en `components/evaluaciones/mass-grading-screen.tsx`. Nada nuevo en los archivos que toqué.

```
$ pnpm build
✓ Compiled successfully
```
Build verde. `/portal/coberturas` y `/portal/coberturas/[callId]` aparecen en la tabla de rutas.
Los `prisma:error ... DATABASE_URL` que imprime durante "Collecting page data" son de otras
páginas intentando generar contenido estático sin base disponible en este entorno — no vienen de
código de esta tanda, y el build termina con código de salida 0 igual.

## Dudas

1. **Orden del ítem "Coberturas" en el menú del portal.** No está en
   `docs/fotoffice/ARQUITECTURA-NAVEGACION.md` (el módulo es posterior a ese documento). Lo puse
   en `order: 65`, entre Reservas (60) y Sorteos (70), por ser también una actividad a la que el
   socio se anota. Si la coordinación de FotoOffice prefiere otro lugar (por ejemplo, más arriba,
   por ser la razón de ser de esta etapa), es un número para cambiar, no una decisión estructural.
2. **"Ya te anotaste" cuando alguien se retira y quiere volver a postularse.** El índice único de
   `CoverageApplication` es `(roleId, memberId)` sin importar el estado: si algún día alguien
   retira una postulación (`RETIRADA`, no implementado todavía) y quiere volver a anotarse al
   mismo rol, la fila ya existe y `puedePostularse` la va a leer como "ya te anotaste" para
   siempre. No toqué nada de esto porque retirar una postulación no es parte de esta tanda, pero
   lo dejo anotado porque cuando se implemente, alguien va a tener que decidir si eso se resuelve
   con un `update` en vez de un `create`, o si es la conducta que se quiere.
