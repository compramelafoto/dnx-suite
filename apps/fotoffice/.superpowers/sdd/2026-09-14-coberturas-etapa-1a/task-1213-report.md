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

---

# Segunda ronda de corrección (re-revisión sobre task-1213)

La re-revisión encontró tres cosas más sobre lo ya corregido arriba, más un agregado de tests
que había quedado pendiente.

## HALLAZGO 1 — `ESTADOS_RESUELTOS` incluye `APROBADA`, que el módulo trata como estado vivo

No era una contradicción: son dos preguntas distintas que se estaban leyendo como si fueran
una sola bajo la palabra "terminal".

- **Resuelta** (`ESTADOS_RESUELTOS`, en `app/(shell)/coberturas/actions.ts`) = ¿alguien ya
  decidió? Aprobar ES decidir, así que `APROBADA` corresponde ahí.
- **Viva** (`REQUEST_LIVE_STATUSES`, en `lib/coverages/states.ts`) = ¿todavía se puede cancelar?
  Una solicitud aprobada sigue viva, porque la cobertura todavía no ocurrió.

**Corrección**: no se tocó la lista (queda `APROBADA`, `RECHAZADA`, `CERRADA`,
`CANCELADA_SOLICITANTE`, `CANCELADA_ORGANIZACION`). Se reescribió el comentario para explicar
las dos preguntas, aclarar que `APROBADA` es resuelta y viva a la vez a propósito, decir
explícitamente que `ESTADOS_RESUELTOS` no se deriva de `REQUEST_LIVE_STATUSES` ni al revés, y
dejar una advertencia: unificar las dos listas rompe el filtro "urgentes" de la bandeja (que
necesita ver las aprobadas todavía sin cubrir) o la fecha de resolución (`resolvedAt` dejaría
de marcarse al aprobar).

## HALLAZGO 2 — correo con botón vacío cuando no se rotó el enlace por falta de `appUrl`

`compose()` en `lib/coverages/emails.ts` armaba siempre el bloque de CTA (botón + línea de
"copiá y pegá esta dirección"), así que un `trackingUrl: ""` producía un correo con un botón
sin destino y una línea de copiar sin nada que copiar.

**Corrección**: en `compose()`, `cta` ahora se resuelve como `input.cta?.url.trim() ?
input.cta : null` antes de armar HTML y texto, así que una URL vacía o de sólo espacios omite
el bloque entero (botón, línea de copiar y también la línea de texto plano) sin tocar el resto
del correo. Tests agregados en `emails.test.ts` (sobre `buildRequestReceivedEmail`, que sí usa
CTA): `trackingUrl: ""` no deja ni el botón ni "copiá y pegá" en HTML ni el label en texto;
`trackingUrl: "   "` se comporta igual; con la URL real de `base`, las dos versiones sí los
contienen.

## HALLAZGO 3 — tres correcciones de la ronda anterior sin test por vivir dentro de la server action

Se extrajeron las dos piezas a `lib/coverages/settings.ts` como funciones puras exportadas:

- `acotarEntero(raw, min, max, porOmision)`: vacío/espacios o no-finito devuelven
  `porOmision`; si no, acota entre `min` y `max` y redondea. Reemplaza a la función interna
  `entero()` de `saveCoverageSettingsAction`, que ahora sólo hace `formData.get(...).toString()`
  y delega.
- `normalizarAssignmentMode(raw)`: devuelve `raw` si está en `ASSIGNMENT_MODES`, si no
  `"MIXTA"`. Reemplaza la validación inline de `assignmentMode` en la misma acción.

`saveCoverageSettingsAction` (`app/(shell)/coberturas/actions.ts`) quedó llamando a las dos;
comportamiento sin cambios. Tests agregados en `settings.test.ts`: `acotarEntero` con vacío,
espacios, texto no numérico, por debajo del mínimo, por encima del máximo y un valor válido en
el medio (con redondeo); `normalizarAssignmentMode` con cada uno de los cuatro modos válidos,
uno inventado, vacío y `null`.

## Además — dos casos faltantes en `access-policy.test.ts`

Se agregaron a `transitionNeedsCoordinator`: un estado vacío (`""`) y uno inventado
(`"ESTADO_INVENTADO"`) exigen coordinador. Es el caso que importaba: lo que la función no
reconoce cae del lado seguro (exige coordinar) y no del permisivo.

## Verificación (desde `apps/fotoffice`)

- `pnpm test` → 227 archivos pasaron, 1 falló: `lib/template-v2/access.test.ts` (mismo
  preexistente y ajeno de siempre: `ENOENT` sobre una ruta de disenador que no existe en este
  worktree). 2587 tests en verde, 1 en rojo. Ningún test de `coverages` falló.
- `npx tsc --noEmit -p tsconfig.json` → limpio, sin salida.
- `pnpm lint` → 3 errores y 7 warnings, todos preexistentes y en archivos no tocados en esta
  ronda (`components/evaluaciones/mass-grading-screen.tsx`,
  `components/website/render/blocks/hero-block-view.tsx`, y los warnings de siempre). Ningún
  error nuevo.
- `pnpm build` → compila, exit code 0.

## Archivos modificados en esta ronda

- `app/(shell)/coberturas/actions.ts` (comentario de `ESTADOS_RESUELTOS`; `entero()` y
  `assignmentMode` delegan a `lib/coverages/settings`)
- `lib/coverages/emails.ts` (CTA se omite con URL vacía/espacios)
- `lib/coverages/emails.test.ts`
- `lib/coverages/settings.ts` (`acotarEntero`, `normalizarAssignmentMode`)
- `lib/coverages/settings.test.ts`
- `lib/coverages/access-policy.test.ts`

No se tocó ninguna base de datos ni se crearon subagentes.
