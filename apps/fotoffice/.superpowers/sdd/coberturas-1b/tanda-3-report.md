# Tercera tanda — etapa 1b de coberturas (Tareas 4 y 5)

Rama `feat/coberturas-armar-el-equipo`, worktree `fotoffice-solicitudes-coberturas`.

## Qué escribí

### A) Generar la cobertura y sus roles (Tarea 4)

- `lib/coverages/generar-cobertura.ts` (nuevo):
  - `sugerirCobertura(solicitud)` — título, fechas, dirección y ciudad copiados de la solicitud.
  - `sugerirRoles(solicitud, settings)` — si `requestedPhotographers >= 2`, propone "Fotógrafo
    principal" (1 vacante) y "Segundo fotógrafo" (el resto, mínimo 1). Si es 1 (o no informado),
    reutiliza `recomendarRefuerzo` (ya existente) para decidir si igual conviene el refuerzo
    según la duración y el umbral del workspace.
  - `planGenerarCobertura(...)` — los controles antes de escribir: solicitud del workspace
    correcto, estado `APROBADA`, y al menos un rol con nombre y vacante. Mismo patrón que
    `planStatusChange`.
  - `datetimeLocalValue(date)` — formatea una fecha para el valor por omisión de un
    `<input type="datetime-local">` sin convertir de zona, a propósito: el mismo criterio que ya
    usa `parseCoverageRequest` (`fecha()`) del lado de la lectura. Si convirtiera a hora
    argentina acá, aceptar la sugerencia sin tocarla correría la fecha guardada.
  - Test: `generar-cobertura.test.ts` (14 casos): copia de valores, los dos casos de roles que
    pide el plan (2 fotógrafos; 1 fotógrafo + jornada larga) más el caso sin refuerzo y el de más
    de 2 fotógrafos, y los seis casos de `planGenerarCobertura`.

- `app/(shell)/coberturas/actions.ts`: agregué `crearCoberturaAction`. Pide
  `requireCoveragesCoordinator()`, arma los roles desde dos `FormData.getAll` (`roleName[]`,
  `roleVacancies[]`, emparejados por índice), valida con `planGenerarCobertura`, y en una sola
  `$transaction` crea la `Coverage` en `PLANIFICADA` con sus `CoverageRole` y el evento
  `CREADA` en el historial. La solicitud no cambia de estado. Al terminar, redirige a
  `/coberturas/c/{coverageId}`.

- `app/(shell)/coberturas/[id]/generar-cobertura-panel.tsx` (nuevo, cliente): el formulario, con
  filas de rol que se pueden agregar y quitar del lado del cliente, precargadas con
  `sugerirRoles`.

- `app/(shell)/coberturas/[id]/page.tsx`: agregué la lista de coberturas de la solicitud
  (`solicitud.coverages`, que `loadRequest` ya traía) con enlace a la ficha de cada una, y el
  panel de generar cobertura cuando `status === "APROBADA"` y quien mira puede coordinar.

### B) La ficha de la cobertura y su convocatoria (Tarea 5)

- `lib/coverages/convocatoria.ts` (nuevo):
  - `puedePublicarse(call, roles)` — exige título y al menos un rol con `lugaresLibres > 0`
    (reutiliza `cupos.ts`, no vacantes "definidas": así la misma regla sirve para publicar por
    primera vez y para cuando la convocatoria vuelve de `COMPLETA` a `PUBLICADA` en la tanda
    siguiente).
  - `puedeCrearseConvocatoria`, `puedeEditarseConvocatoria` — guardas chicas que agregué para no
    dejar esas reglas sueltas en la acción: solo se crea una vez (1:1 con la cobertura) y
    mientras la cobertura está `PLANIFICADA`; solo se edita en `BORRADOR`.
  - `planPublicarConvocatoria(...)` — encadena `assertCallTransition`, `puedePublicarse` y
    `assertCoverageTransition` (la de la cobertura a `BUSCANDO_EQUIPO`), en ese orden, para que
    publicar y mover la cobertura sean una sola decisión verificable.
  - Test: `convocatoria.test.ts` (18 casos).

- `app/(shell)/coberturas/c/[coverageId]/`:
  - `page.tsx` — la ficha: datos de la cobertura, roles con sus cupos (usando `cupos.ts` sobre
    las asignaciones que ya trae `loadCoverage`, aunque esta tanda no genera ninguna), el panel
    de convocatoria, un bloque "Postulaciones y equipo" que dice explícitamente que llega en la
    próxima etapa, e historial separado de la cobertura y de la convocatoria.
  - `convocatoria-panel.tsx` (cliente) — crea la convocatoria en `BORRADOR`, la edita mientras
    sigue en borrador, y la publica. Muestra el motivo de `puedePublicarse` si todavía no se
    puede publicar (cortesía; el control real es el de la acción).
  - `actions.ts` — `crearConvocatoriaAction`, `editarConvocatoriaAction`,
    `publicarConvocatoriaAction`, las tres con `requireCoveragesCoordinator()`. Publicar hace, en
    una `$transaction`: `CoverageCall` → `PUBLICADA` con `publishedAt`, `Coverage` →
    `BUSCANDO_EQUIPO`, y un evento de historial para cada una.

- `lib/coverages/repository.ts`: agregué `loadCoverage({ workspaceId, coverageId })` — una sola
  consulta, con `workspaceId` en el `where` (verificado por `aislamiento.test.ts`), que trae la
  cobertura con sus roles (y las asignaciones de cada rol, para cupos), su convocatoria y los
  datos mínimos de la solicitud.

## Decisiones y por qué

1. **No agregué entrada de menú.** Según la Tarea 4/5 del plan, la ficha de una cobertura cuelga
   de una solicitud (se llega desde `/coberturas/{id}` → lista de coberturas → `/coberturas/c/
   {coverageId}`), no es una sección propia. En `lib/modules/submodules.ts`, el ítem "Solicitudes"
   ya tiene `activeMatch: "rest"`, así que ambas rutas nuevas caen ahí sin tocar el archivo.
2. **La dirección se muestra completa** en la ficha de la cobertura y en la convocatoria: no
   hay ningún campo oculto salvo `privateBriefing`, que en esta pantalla (uso interno,
   `requireCoveragesReviewer`) se muestra igual que el resto — la restricción del §3.4 es para
   el portal de colaboradores, que es la tanda siguiente.
3. **Los roles no se editan después de creados**, solo se muestran. El plan no pide edición de
   roles en esta tanda, y tocar vacantes ya usadas por cupos es un tema de la tanda que asigna
   equipo.
4. **`datetimeLocalValue` sin conversión de zona.** Documentado en el propio archivo: es el
   mismo criterio (deliberado) que ya usa `request-form.ts` para leer estos campos. Si se
   corrigiera de un lado sin corregir el otro, la sugerencia correría la fecha real.
5. **Publicar valida con `lugaresLibres`, no con "tiene vacantes > 0".** Así la misma función
   sirve el día que la tanda siguiente reutilice `planPublicarConvocatoria` para el caso
   "`COMPLETA` vuelve a `PUBLICADA` porque alguien rechazó".
6. **Sin correos en esta tanda.** La Tarea 9 (correos) no forma parte de este encargo; ni crear
   la cobertura ni publicar la convocatoria mandan nada.

## Verificación

Todo corrido desde `apps/fotoffice`.

```
$ pnpm test
 Test Files  1 failed | 233 passed (234)
      Tests  1 failed | 2727 passed (2728)
```
El único fallo es el conocido y ajeno: `lib/template-v2/access.test.ts` (falla igual desde
`main`, no toqué nada de ese módulo).

```
$ npx tsc --noEmit -p tsconfig.json
```
Sin salida — sin errores. Exit code 0.

```
$ pnpm lint
✖ 10 problems (3 errors, 7 warnings)
```
Los 3 errores son los conocidos y ajenos: dos en `hero-block-view.tsx` y uno en
`mass-grading-screen.tsx` (avisados de antemano en el encargo). Ninguno de los 7 warnings ni de
los 3 errores está en un archivo que toqué.

```
$ pnpm build
✓ Compiled successfully in 16.7s
✓ Finished TypeScript
✓ Generating static pages (45/45)
```
Build termina bien. Aparecen unos `prisma:error ... Environment variable not found: DATABASE_URL`
durante "Collecting page data" — son de páginas ajenas (`admin`, no de coberturas) y ocurren
porque este entorno no tiene `DATABASE_URL`; no son un error del build (el build termina y lista
las rutas, incluida `ƒ /coberturas/c/[coverageId]`).

## Dudas

Ninguna que me haya frenado. Dos decisiones de diseño que tomé por mi cuenta y que valen la pena
mencionar por si no eran las esperadas:

- Agregué `puedeCrearseConvocatoria` y `puedeEditarseConvocatoria` en `convocatoria.ts` además
  de la única función que pedía el plan (`puedePublicarse`), para no dejar esas reglas sueltas
  en la acción del servidor sin test. Si preferís que esa lógica viva solo en la acción, se puede
  volver a bajar.
- Después de crear la cobertura, redirijo a su ficha nueva (`/coberturas/c/{id}`) en vez de
  quedarme en la solicitud. Me pareció el flujo más natural ("de la solicitud aprobada a la
  convocatoria publicada"), pero si preferís quedarte en la solicitud avisame y lo cambio.
