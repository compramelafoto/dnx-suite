# Etapa 1b — Tanda 2: el perfil de colaborador

Rama `feat/coberturas-armar-el-equipo`, comandos desde `apps/fotoffice`.

## Qué se escribió

### 1. Dominio: `lib/coverages/colaboradores.ts` + `colaboradores.test.ts`

- `parseCollaboratorProfileForm(form)`: parseo puro del formulario de perfil. Sin campos
  obligatorios — dejar todo vacío es válido, significa "todavía no sabemos nada de esta
  persona además de que existe en el padrón". Reglas:
  - `active` / `acceptsUrgent`: checkbox HTML (`"on"` u otro cualquier valor → `false`).
  - `homeCity` / `notes`: texto recortado, vacío → `null`.
  - `coverageZones` / `equipment` / `specialties`: listas "una por línea o separadas por
    coma", mismo criterio que ya usa `settings-form.tsx` para no inventar una segunda
    convención en el mismo módulo.
  - `maxTravelKm`: número acotado entre 0 y 300 km. Decisión propia: 300 km alcanza y sobra
    para cualquier cobertura real dentro de una provincia, y sin techo un campo que hoy no
    alimenta ninguna lógica es una forma fácil de terminar con un número absurdo cargado por
    error. Vacío o no numérico → `null` (no `0`): son preguntas distintas — "no viaja nada"
    contra "no sabemos" — y confundirlas mostraría "0 km" en la ficha de alguien que nunca
    contestó.
  - `transport` / `experienceLevel`: vocabulario cerrado (`TRANSPORT_OPTIONS`,
    `EXPERIENCE_LEVELS`, tomados de los comentarios del modelo Prisma). Un valor fuera de la
    lista cae en `null`, no en un valor por omisión inventado: a diferencia del modo de
    asignación de `settings.ts`, acá no hay un valor "más conservador" que tenga sentido
    forzar.
- `perfilHabilitado(perfil)`: `true` solo si hay perfil y `active === true`. Es la función que
  el plan pedía ("una función que diga si un perfil está habilitado para participar") y es
  exactamente el booleano que alimenta `tienePerfilActivo` en `CandidatoAConvocatoria`
  (`elegibilidad.ts`), para que ninguna pantalla futura repita el chequeo de `active` por su
  cuenta.
- 13 tests: formulario vacío, checkbox, listas, radio (negativo, gigante, decimal, vacío,
  no numérico), vocabularios cerrados, y las tres combinaciones de `perfilHabilitado`.

### 2. Repositorio: `lib/coverages/repository.ts`

- `listCollaborators({ workspaceId })`: todos los `Member` del workspace con su
  `coverageProfile` (puede ser `null`). Trae TODOS los socios, no solo los que ya tienen
  perfil: la pantalla de administración necesita poder ofrecerle el alta a alguien que nunca
  se tocó.
- `loadCollaboratorProfile({ workspaceId, memberId })`: el perfil de un socio puntual, o
  `null` si no existe o es de otro workspace.
- `upsertCollaboratorProfile({ workspaceId, memberId, datos })`: decisión que quiero dejar
  explícita porque no es obvia. `CoverageCollaboratorProfile.memberId` es `@unique` a nivel
  de modelo (no hay una clave compuesta `workspaceId + memberId`), así que un
  `prisma....upsert({ where: { memberId } })` a secas no tendría `workspaceId` en su `where`
  — y peor, si alguien arma un `memberId` de otra institución a mano en el `FormData` (el
  formulario solo ofrece socios del propio padrón, pero eso es cortesía de la pantalla, no
  un control), la rama `create` del upsert lo aceptaría igual, cruzando datos entre
  instituciones. Por eso la función hace primero un `findFirst` sobre `Member` con
  `{ id, workspaceId }` en el `where` y devuelve `null` sin escribir nada si ese socio no es
  de este workspace; recién después llama al `upsert`, cuyo propio `where` combina
  `{ memberId, workspaceId }` (Prisma permite esta combinación desde la función
  `extendedWhereUnique`, estable en la versión de Prisma del repo). Las dos consultas de la
  función tienen `workspaceId` en su `where`.
- `lib/coverages/aislamiento.test.ts` sigue en verde: las tres consultas nuevas entran solas
  en el barrido automático y ninguna quedó marcada.

### 3. Pantalla: `app/(shell)/coberturas/colaboradores/`

- `page.tsx` (Server Component): `requireCoveragesCoordinator()` — administrar colaboradores
  es tarea de coordinación, no de revisión, así que use el guard más estricto también para
  poder VER la pantalla, no solo para editar. Antes de listar nada comprueba, en este orden:
  1. si el módulo Socios está encendido en el workspace (`isModuleEnabledForWorkspace`) — si
     no, un aviso explícito con el motivo, sin tocar `listCollaborators`;
  2. si el padrón tiene al menos un socio — si no, otro aviso explícito con un enlace a
     `/members`, en vez de una tabla vacía sin contexto.
  Si ambas condiciones se cumplen, arma una tabla con todos los socios y delega cada fila a
  `ColaboradorRow`.
- `colaborador-row.tsx` (Client Component): una fila por socio, con un `<details>` casero
  (estado local `abierto`) que expande un formulario completo — activo, ciudad, zonas,
  transporte, equipo, especialidades, nivel de experiencia, urgencias, notas — y su propio
  `useActionState` para mostrar el resultado del guardado sin recargar la tabla entera.
  Comentario explícito en el archivo: los campos que "todavía no se usan para nada" no llevan
  ninguna advertencia visible para quien coordina, porque es un detalle de esta etapa, no algo
  que le sirva saber mientras completa el perfil de alguien.
- `actions.ts`: `saveCollaboratorProfileAction` vuelve a pedir
  `requireCoveragesCoordinator()` en el servidor — el botón de la pantalla es cortesía, no el
  control — arma el `Record<string,string>` desde el `FormData`, llama a
  `parseCollaboratorProfileForm` y a `upsertCollaboratorProfile`, y devuelve un error legible
  si el socio no es de este workspace (no debería poder pasar desde la UI, pero la acción no
  confía en que la UI sea la única forma de llamarla).

### 4. El menú: `lib/modules/submodules.ts`

- Nueva entrada `/coberturas/colaboradores` ("Colaboradores") en el bloque `COBERTURAS`,
  `requiresManage: true`, entre "Solicitudes" y "Configuración" — mismo patrón que las demás
  entradas del módulo.
- Ícono nuevo: `UserCheck`, agregado al vocabulario cerrado de `components/shell/nav-icons.ts`
  (antes no estaba; sin agregarlo, `lib/modules/submodules.test.ts` lo hubiera detectado
  cayendo en el ícono genérico de reserva).

### 5. Arreglo de la tanda anterior: `lib/coverages/states.ts` + `transitions.test.ts`

- `SIN_EQUIPO` entra a `COVERAGE_LIVE_STATUSES`. Comentario agregado en dos lugares (sobre
  `COVERAGE_STATUSES` y sobre la constante misma): quedarse sin equipo es exactamente cuando
  hace falta poder cancelar la cobertura y avisarle a la organización que no va a haber
  cobertura — antes del cambio, una cobertura `SIN_EQUIPO` no tenía ningún camino hacia
  adelante (no podía cancelarse, y solo podía volver a `BUSCANDO_EQUIPO` de forma manual).
- Como `assertCoverageTransition`/`canTransitionCoverage` ya derivan el "se puede cancelar
  desde cualquier estado vivo" de esta misma lista, no hizo falta tocar `transitions.ts`.
- Test nuevo en `transitions.test.ts`:
  `canTransitionCoverage("SIN_EQUIPO", "CANCELADA")` → `true`.

## Dudas

Ninguna que me haya frenado. Dos decisiones que tomé por mi cuenta y quiero que quede
registrado por qué, además de lo ya explicado arriba:

- El tope de 300 km para `maxTravelKm` es un número que inventé (el modelo no trae un rango
  documentado). Es fácil de cambiar si la organización real necesita otro techo — vive en dos
  constantes exportadas (`MAX_TRAVEL_KM_MIN`/`MAX_TRAVEL_KM_MAX`) en `colaboradores.ts`.
- La pantalla exige `requireCoveragesCoordinator()` para verse, no solo para editar (a
  diferencia de la ficha de solicitud, que separa "ver" de "coordinar"). Lo interpreté así
  porque el plan dice "Administrar colaboradores es tarea de coordinación" sin mencionar un
  nivel de solo lectura para esta pantalla en particular, y no hay ningún caso de uso descrito
  en el plan para que alguien que solo revisa necesite ver el padrón de colaboradores.

## Comandos de verificación

Los cuatro, desde `apps/fotoffice`. Sin problemas nuevos: el único test que falla
(`lib/template-v2/access.test.ts`) ya fallaba en `main`, y los 3 errores de lint son los
mismos y ya conocidos de `hero-block-view.tsx` (2) y `mass-grading-screen.tsx` (1).

### `pnpm test`

```
Test Files  1 failed | 231 passed (232)
     Tests  1 failed | 2693 passed (2694)
```

El único fallo:

```
FAIL  lib/template-v2/access.test.ts > los puntos de control del diseñador >
  app/(shell)/members/disenador/[templateId]/[versionId]/page.tsx decide el permiso con
  canDesignTemplates
Error: ENOENT: no such file or directory, open
  '.../app/(shell)/members/disenador/[templateId]/[versionId]/page.tsx'
```

(Ya fallaba antes de esta tanda — el archivo que busca no existe en esta rama, ajeno al
trabajo de hoy.)

Todo lo nuevo de esta tanda quedó en verde:

```
✓ lib/coverages/colaboradores.test.ts (13 tests)
✓ lib/coverages/aislamiento.test.ts (3 tests)
✓ lib/coverages/transitions.test.ts (69 tests)
✓ lib/modules/submodules.test.ts (9 tests)
```

### `npx tsc --noEmit -p tsconfig.json`

Sin salida (sin errores).

### `pnpm lint`

```
✖ 10 problems (3 errors, 7 warnings)
```

Los 3 errores son los ya sabidos:

```
components/evaluaciones/mass-grading-screen.tsx:109:5  Avoid calling setState() directly within an effect
components/website/render/blocks/hero-block-view.tsx:32:5  Avoid calling setState() directly within an effect
components/website/render/blocks/hero-block-view.tsx:71:5  Avoid calling setState() directly within an effect
```

Ninguno en archivos tocados por esta tanda.

### `pnpm build`

Exit code 0. Compila y genera `/coberturas/colaboradores` como ruta dinámica (`ƒ`), junto con
el resto del panel. Los `prisma:error ... Environment variable not found: DATABASE_URL`
que imprime la consola durante el build son de la recolección de datos de otras páginas
(no hay base configurada en este entorno de build) y no afectan el resultado.
