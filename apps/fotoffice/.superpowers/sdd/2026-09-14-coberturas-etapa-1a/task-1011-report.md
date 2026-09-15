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
