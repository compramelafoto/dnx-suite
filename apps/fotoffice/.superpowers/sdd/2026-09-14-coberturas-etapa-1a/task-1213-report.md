# Informe — task 1213 (ronda de corrección, panel de coordinación de coberturas)

Rama: `feat/fotoffice-solicitudes-y-coberturas`
Worktree: `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-suite/.claude/worktrees/fotoffice-solicitudes-coberturas`

> Nota: el archivo `task-1213-report.md` referenciado en el encargo no existía en este
> directorio (sólo estaba `task-1011-report.md`, de una ronda de corrección anterior sobre el
> mismo módulo). Se creó este archivo nuevo con el informe de esta ronda.

## HALLAZGO 1 (crítico) — la escalera de permisos estaba al revés

`requestInfoAction` pedía `requireCoveragesReviewer` (correcto, sin cambios) mientras que
`changeRequestStatusAction` exigía siempre `requireCoveragesCoordinator`, incluso para
`RECIBIDA → EN_EVALUACION`, la transición más inofensiva.

**Corrección**:
- Nueva función pura `transitionNeedsCoordinator(to: string): boolean` en
  `lib/coverages/access-policy.ts`. Devuelve `false` sólo para `"EN_EVALUACION"`.
- `changeRequestStatusAction` (`app/(shell)/coberturas/actions.ts`) ya no llama a un guard fijo:
  lee `to` primero y resuelve `requireCoveragesCoordinator()` o `requireCoveragesReviewer()`
  según `transitionNeedsCoordinator(to)`.
- `evaluacion-panel.tsx`: el botón "Empezar a evaluarla" dejó de estar detrás de
  `puedeCoordinar` (sigue detrás de `!cerrada && status === "RECIBIDA"`; el control real sigue
  siendo el guard del servidor).
- Tests agregados en `lib/coverages/access-policy.test.ts`: `EN_EVALUACION` no exige coordinar;
  `APROBADA`, `RECHAZADA`, `CERRADA` y las dos cancelaciones sí.
- Comentario en el código: empezar a evaluar es trabajo de secretaría; decidir compromete el
  tiempo de voluntarios y la palabra de la institución.

## HALLAZGO 2 (crítico) — rotar el token podía dejar a la organización sin ningún enlace

El token se rotaba dentro de la transacción y el correo salía después; si el correo fallaba (o
no había destinatario, o `appUrl()` devolvía vacío), el hash viejo ya estaba pisado y el nuevo
no llegaba a ningún lado.

**Corrección**:
- Nueva función pura `debeRotarEnlace(input: { tieneDestinatario: boolean; tieneAppUrl:
  boolean }): boolean` en `lib/coverages/tracking-view.ts`. Devuelve `true` sólo si las dos
  condiciones se cumplen.
- En `changeRequestStatusAction` y `requestInfoAction`, la decisión de rotar (`rotar`) se toma
  con esta función **antes** de abrir `prisma.$transaction`, usando el destinatario y `appUrl()`
  ya calculados; adentro de la transacción sólo se consulta esa variable, no se repite la
  lógica.
- Cuando el envío del correo falla después de haber rotado, el `warn` ahora dice: *"El cambio
  quedó guardado, pero el correo no salió. El enlace anterior dejó de funcionar: hay que
  reenviarle uno nuevo."* (texto exacto pedido). Si no hubo rotación, se mantiene el mensaje
  anterior ("Está registrado.").
- Tests agregados en `lib/coverages/tracking-view.test.ts` para las cuatro combinaciones de
  `debeRotarEnlace`.

## HALLAZGO 3 (importante) — toda transición marcaba la solicitud como resuelta

`resolvedByUserId`/`resolvedAt` se escribían en cada cambio de estado, incluido
`RECIBIDA → EN_EVALUACION`.

**Corrección**: en `changeRequestStatusAction` se agregó el conjunto `ESTADOS_RESUELTOS`
(`APROBADA`, `RECHAZADA`, `CERRADA`, `CANCELADA_SOLICITANTE`, `CANCELADA_ORGANIZACION`).
`resolvedByUserId`/`resolvedAt` sólo se incluyen en el `update` cuando `plan.to` está en ese
conjunto; en cualquier otro destino no se tocan. Comentario explicando que "resuelta" es una
fecha real que van a leer informes, no un sello de cada movimiento.

## HALLAZGO 4 (importante) — `assignmentMode` entraba sin validar

En `saveCoverageSettingsAction`, `assignmentMode` iba directo al `upsert` sin contrastarse
contra `ASSIGNMENT_MODES`.

**Corrección**: se valida contra `ASSIGNMENT_MODES` (importado de `lib/coverages/settings`); si
el valor recibido no está en la lista, se usa `"MIXTA"`. Comentario explicando que el `<select>`
del formulario es una comodidad, no el control.

## HALLAZGO 5 (menor) — `entero()` con el campo vacío devolvía el mínimo, no el valor por omisión

`Number("")` es `0`, que es finito, así que un campo vaciado se acotaba al mínimo del rango en
vez de restaurar el valor por omisión.

**Corrección**: `entero()` ahora corta antes de convertir: si el campo viene vacío o sólo con
espacios, devuelve `porOmision` directamente, sin llegar a `Number(...)`.

## HALLAZGO 6 (menor) — el historial y los consentimientos se mostraban en jerga

La ficha de la solicitud imprimía `e.type` (`ESTADO_CAMBIADO`, `INFO_PEDIDA`, `NOTA`, etc.) y
`c.kind` tal cual, sin traducir.

**Corrección**:
- Se agregó `COVERAGE_EVENT_LABELS` y `coverageEventLabel(type: string): string` en
  `lib/coverages/states.ts`, con el mismo patrón que `requestStatusLabel` (si el tipo no se
  reconoce, devuelve el valor crudo). Los tipos se repiten a mano ahí en vez de importar
  `CoverageEventType` desde `lib/coverages/events.ts`, porque ese archivo es `server-only` y
  `states.ts` también lo leen componentes de cliente.
- En `app/(shell)/coberturas/[id]/page.tsx`, el historial ahora usa `coverageEventLabel(e.type)`
  y los consentimientos usan `CONSENT_LABELS[c.kind as ConsentKind] ?? c.kind` (ya existente en
  `lib/coverages/consents.ts`).

## Dato ya verificado (no investigado de nuevo)

Se tomó como dado, según el encargo, que `/sc/[token]` renderiza sólo seis campos de la
solicitud y nunca lee el historial ni filtra las notas internas.

## Verificación (desde `apps/fotoffice`)

- `pnpm test` → 227 archivos pasaron, 1 falló: `lib/template-v2/access.test.ts` (preexistente y
  ajeno a este cambio — un `readFileSync` sobre una ruta de disenador que no existe en este
  worktree). 2570 tests en verde, 1 en rojo (el mismo preexistente). Ningún test de `coverages`
  falló.
- `npx tsc --noEmit -p tsconfig.json` → limpio, sin salida.
- `pnpm lint` → 3 errores y 7 warnings, todos preexistentes y en archivos ajenos
  (`components/evaluaciones/mass-grading-screen.tsx`,
  `components/website/render/blocks/hero-block-view.tsx`,
  `app/actions/membership-applications.ts`, `app/actions/split-consent.ts`,
  `app/actions/website.ts`, `lib/membership/approve.ts`). Ningún error nuevo en los archivos
  tocados.
- `pnpm build` → compila, exit code 0.

## Archivos modificados

- `app/(shell)/coberturas/actions.ts`
- `app/(shell)/coberturas/[id]/evaluacion-panel.tsx`
- `app/(shell)/coberturas/[id]/page.tsx`
- `lib/coverages/access-policy.ts` + `access-policy.test.ts`
- `lib/coverages/tracking-view.ts` + `tracking-view.test.ts`
- `lib/coverages/states.ts`

No se tocó ninguna base de datos ni se crearon subagentes.
