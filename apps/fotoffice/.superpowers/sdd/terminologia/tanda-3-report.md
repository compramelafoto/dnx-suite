# Terminología por workspace — tanda 3: el portal

## Qué se tocó

`app/portal/**` y `components/portal/**`, más el componente compartido que el punto 2 de la
consigna pedía cerrar (`components/membership/professional-presence-fields.tsx`). En total 15
archivos, todos cargando o recibiendo `PersonVocabulary` de
`lib/vocabulario/personas.ts` / `lib/vocabulario/load.ts` (sin tocar ninguno de los dos):

**Servidor** (`loadPersonVocabulary(context.workspace.id)` en cada uno):
- `app/portal/layout.tsx` — lo carga una vez y se lo pasa a `PortalShell` (el "Socio N°" del
  encabezado que ve toda pantalla del portal).
- `app/portal/page.tsx`, `app/portal/cuotas/page.tsx`, `app/portal/carnet/page.tsx`,
  `app/portal/recomendados/page.tsx` — cada uno con su propio "Socio N°" o frase con la palabra.
- `app/portal/perfil/page.tsx` — lo carga y se lo pasa a `ProfessionalProfileForm`. Tuve que
  agregar `id: true` al `select` del `workspace` en la consulta de Prisma (antes solo pedía
  `name`) para tener el `workspaceId` con el que pedir el vocabulario.
- `app/portal/reservas/page.tsx` — lo carga y se lo pasa a `ReservarForm` (cliente).
- `app/portal/sorteos/page.tsx`, `app/portal/sorteos/[id]/page.tsx`,
  `app/portal/sorteos/[id]/verificacion/page.tsx` — cada uno con su frase.

**Cliente** (reciben el objeto `PersonVocabulary` completo por props, no palabras sueltas):
- `components/portal/portal-shell.tsx` — nueva prop `vocabulary`, usa `vocabulary.Singular`.
- `app/portal/reservas/reservar-form.tsx` — nueva prop `vocabulary`.
- `components/portal/professional-profile-form.tsx` — nueva prop `vocabulary`, se la reenvía a
  `ProfessionalPresenceFields`.

**No necesitaron vocabulario** (tenían "socio" solo en comentarios o como nombre de variable,
nunca en texto visible): `app/portal/cuotas/pay-button.tsx`, `app/portal/cuotas/advance-form.tsx`,
`components/portal/portal-nav.tsx`, `components/portal/portal-sections.tsx`,
`components/portal/recommendation-link-card.tsx`, `components/portal/dues-help-card.tsx`,
`components/portal/member-photo-upload.tsx`. La variable local `socio` en
`app/portal/perfil/page.tsx` y `app/portal/carnet/page.tsx` (`const socio = await prisma...`) es
un identificador, no texto de pantalla, así que la dejé como está.

**`app/portal/reservas/actions.ts`** es la única excepción a "cargar vocabulario": tenía
`reason: "Cancelada por el socio"`, un texto que no ve la persona del portal sino el staff en
`/reservas/configuracion` (la columna `reason` de la agenda). En vez de traer vocabulario a un
`"use server"` solo para esta línea, la reformulé sin la palabra: **"Cancelada desde el
portal"**, que además queda simétrica con los otros dos motivos por defecto de esa misma pantalla
de staff (`"Cancelada por la institución"`, `"Rechazada por la institución"`, en
`app/(shell)/reservas/actions.ts`, fuera de mi alcance).

## La prop de `ProfessionalPresenceFields` — ahora obligatoria

Sí, quedó obligatoria. Sus dos únicos callers en todo el repo son
`components/membership/application-form.tsx` (ya la pasaba, tanda 2) y
`components/portal/professional-profile-form.tsx` (se la agregué en esta tanda). Con los dos
cubiertos, saqué el `?`, el `personVocabulary(null)` de respaldo y el import de `personVocabulary`
que ya no hacía falta; dejé solo `import type { PersonVocabulary }`. El comentario que explicaba
la opcionalidad ("el portal todavía no carga vocabulario propio...") lo reemplacé por uno que
dice lo que hay ahora, no lo que había.

## Frases reformuladas por género (2)

Casi todo lo demás fue sustitución directa (`de socio` → `de ${v.singular}`, `Socio N°` →
`${v.Singular} N°`), sin adjetivo ni artículo pegado que forzara un género — el mismo patrón que
la tanda 2 dejó sin tocar. Encontré dos casos con un cuantificador de por medio:

1. `app/portal/sorteos/page.tsx` — "Participan **los** socios al día" → "Participan
   {v.plural} al día" (el artículo "los" concordaba en masculino; sin él, la frase sigue
   funcionando igual).
2. `app/portal/page.tsx` — "aparte de tu ficha de socio" quedó como sustitución directa, pero
   ahí mismo simplifiqué "Tu carnet de socio" dejando la palabra (no la saqué) porque es el único
   lugar de esa tarjeta que dice qué representa el carnet; juzgué que sacarla la dejaba
   ambigua con el carnet de otras cosas que ofrece el portal.

No cuento acá una tercera reformulación de fondo en `reservas/actions.ts` (sección de arriba):
ahí saqué la palabra en vez de sustituirla, así que la cuento aparte de estas dos.

## Lo que decidí NO tocar

- **Comentarios**: ninguno, en ningún archivo, aunque casi todos mencionan "socio" — son los
  mismos que documentan por qué la SFPR fue el caso original.
- **`tone="socio"` en `app/portal/cuotas/page.tsx`**: pasa un valor del tipo
  `"socio" | "panel"` a `CreditCallout` (`components/membership/credit-callout.tsx`). Es el
  mismo identificador interno que la tanda 2 ya revisó y dejó fijo: ninguno de los dos mensajes
  que ese componente puede mostrar contiene la palabra "socio".
- **`numeroDeSocio` en el pseudocódigo de `app/portal/sorteos/[id]/verificacion/page.tsx`**
  (dentro del `<pre>` que explica el algoritmo del sorteo para quien quiera "rehacerlo en otro
  lenguaje"). Es un nombre de campo dentro de una fórmula tipo código
  (`p.posicion + ":" + p.numeroDeSocio`), no una oración. Cambiarlo por el vocabulario del
  workspace habría significado inventar un identificador con espacios o tildes (`v.singular`
  puede ser "voluntaria", "alumno", lo que sea), lo que rompe la ilusión de pseudocódigo
  ejecutable que ese bloque cultiva a propósito. Lo dejé fijo. Lo marco como duda abajo porque
  es el caso más discutible de toda la tanda.
- **"participantes" en las pantallas de sorteos**: es el rol dentro del sorteo (quien entra a la
  bolsa), no el vocabulario configurado de la institución — se usa junto a "socios al día" en la
  misma oración con sentidos distintos. Lo dejé fijo.
- **"Padrón", "carnet", "cuota", "reserva", "portal", "participante"**: fijos en todos los casos,
  como pide la consigna.

## Verificación

```
$ pnpm test
Test Files  1 failed | 230 passed (231)
     Tests  1 failed | 2624 passed (2625)
```
El único fallo es el avisado como preexistente y ajeno:
`lib/template-v2/access.test.ts` (`ENOENT` sobre una ruta que no existe en este árbol).

```
$ npx tsc --noEmit -p tsconfig.json
```
Sin salida — limpio.

```
$ pnpm lint
✖ 10 problems (3 errors, 7 warnings)
```
Los 3 errores son los avisados como preexistentes (`hero-block-view.tsx` ×2,
`mass-grading-screen.tsx` ×1, `react-hooks/set-state-in-effect`), más 7 warnings preexistentes
no relacionados. Ninguno en archivos de esta tanda.

```
$ pnpm build
```
Exit code 0. Todas las rutas de `/portal/**` aparecen listadas en la salida
(`/portal`, `/portal/carnet`, `/portal/cuotas`, `/portal/perfil`, `/portal/recomendados`,
`/portal/reservas`, `/portal/sorteos`, `/portal/sorteos/[id]`,
`/portal/sorteos/[id]/verificacion`). Durante la generación estática aparecen los mismos
errores de Prisma por falta de `DATABASE_URL` que describe el reporte de la tanda 2 — no
relacionados con esta tanda, este entorno no tiene esa variable configurada.

## Verificación pedida (grep de lo que quedó sin configurar)

```
$ grep -rnoE '"[^"]*[Ss]ocios?[^"]*"|>[^<>{}]*[Ss]ocios?[^<>{}]*<' app/portal components/portal
app/portal/cuotas/page.tsx:247:"socio"
app/portal/sorteos/[id]/verificacion/page.tsx:187:" + p.numeroDeSocio).join("
```

Las dos, revisadas una por una:

- `app/portal/cuotas/page.tsx:247` — `<CreditCallout creditMinor={cuenta.creditMinor}
  tone="socio" />`. Correcto que quede así: `tone` es el discriminante del tipo
  `"socio" | "panel"` de `credit-callout.tsx`, nunca se imprime en pantalla (ya lo confirmó la
  tanda 2 revisando los dos mensajes que ese componente puede mostrar).
- `app/portal/sorteos/[id]/verificacion/page.tsx:187` — `numeroDeSocio` dentro del bloque de
  pseudocódigo del algoritmo de sorteo. Es un nombre de campo en una fórmula que se muestra como
  código, no una frase; ver la sección "Lo que decidí NO tocar" arriba. Es la coincidencia que
  más dudé de las dos — lo marco también como duda.

No quedó ninguna coincidencia de texto visible en prosa sin configurar.

## Dudas

1. **`numeroDeSocio` en el pseudocódigo de verificación de sorteos**: lo dejé fijo por ser un
   identificador dentro de una fórmula tipo código, no una oración (detalle arriba). Si preferís
   que igual reflejara el vocabulario del workspace, la única forma prolija que se me ocurre es
   cambiar la fórmula para no nombrar el campo en español ahí dentro (por ejemplo,
   `p.posicion + ":" + p.numero` a secas, sin la palabra de dominio) — pero eso cambia el
   pseudocódigo mostrado, no solo la palabra.
2. **Género no configurable** (deuda ya anotada en tandas anteriores): igual que en la tanda 2,
   las sustituciones directas del tipo "de socio" → "de {v.singular}" funcionan para cualquier
   palabra sin importar su género, porque no hay un artículo ni un adjetivo pegado que deba
   concordar. No agregué género configurable ni lo necesité: ningún caso de esta tanda tenía un
   adjetivo forzando masculino salvo el "los socios" de sorteos, que reformulé.
