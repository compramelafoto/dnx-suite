# Terminología por workspace — tanda 2: las pantallas de Socios

## Qué se tocó

Las dos carpetas del módulo de Socios, para que el texto visible diga la palabra que cada
workspace configuró (`v.singular`, `v.plural`, `v.Singular`, `v.Plural` de
`lib/vocabulario/personas.ts`, cargado con `loadPersonVocabulary(workspace.id)`):

- `app/(shell)/members/**` — 12 archivos con la palabra, más `app/(shell)/members/[id]/edit/page.tsx`
  (no tenía el texto, pero pasa `vocabulary` a `MemberForm`, que ahora lo exige).
- `components/members/**` — 6 de los 9 archivos con la palabra necesitaron cambios de texto
  (`invite-batch-form.tsx`, `member-access-panel.tsx`, `member-form.tsx`,
  `member-import-wizard.tsx`, `member-status-changer.tsx`, `category-form.tsx`); los otros 3
  (`recommendation-void-form.tsx`, `manual-payment-form.tsx`, `member-audit-log.tsx`) solo
  tenían la palabra en comentarios, sin texto visible que cambiar.
- `components/membership/**` — 6 de los 8 archivos con la palabra necesitaron cambios
  (`application-card.tsx`, `awaiting-payment-list.tsx`, `payment-import-wizard.tsx`,
  `application-form.tsx`, `professional-presence-fields.tsx`); `payment-history-list.tsx` y
  `professional-presence-summary.tsx` solo tenían la palabra en comentarios.
  `credit-callout.tsx` tiene `tone: "socio" | "panel"` como identificador interno (nunca se
  muestra "socio" en pantalla, solo se usa para elegir entre dos mensajes que no contienen la
  palabra) — se dejó igual, no es texto visible.

## Dos casos fuera de las dos carpetas, y por qué se tocaron

1. **`app/(shell)/members/[id]/edit/page.tsx`**: no tenía "socio" en su propio texto, pero
   renderiza `MemberForm`, al que le agregué la prop obligatoria `vocabulary`. Sin este
   cambio no compila. Está dentro del árbol autorizado (`app/(shell)/members/**`).

2. **`app/w/[workspaceSlug]/asociarse/page.tsx`**: está *fuera* de `app/(shell)/members/**`
   y de la lista de exclusiones de la consigna (que nombra `app/portal`, `components/portal`,
   `app/actions`, `lib/`, pero no `app/w`). Es la única pantalla que monta
   `components/membership/application-form.tsx`, que sí está en el árbol que me pidieron
   arreglar y tenía tres textos visibles con "socio" (encabezado y dos menciones del portal).
   Para no dejar ese componente con la palabra fija tuve que cargar el vocabulario también en
   esta página pública y pasarlo como prop. Lo marco acá porque no estaba explícitamente
   autorizado ni excluido — si preferís que esa pantalla quede para otra tanda, se puede
   revertir fácil (es un archivo, tres líneas).

## Un conflicto de alcance: `ProfessionalPresenceFields`

`components/membership/professional-presence-fields.tsx` lo usan dos pantallas: el alta
pública (`application-form.tsx`, en mi alcance) y `components/portal/professional-profile-form.tsx`
(en `components/portal`, que la consigna dice explícitamente no tocar todavía). Si le hacía
`vocabulary` obligatorio, tenía que tocar el portal para que siga compilando.

Lo resolví con `vocabulary?: PersonVocabulary` **opcional**, con `personVocabulary(null)` como
valor por omisión (documentado en el propio prop). El alta pública ya pasa el vocabulario real;
el portal sigue sin tocarse y sigue mostrando "socio/socios" hasta que le llegue su tanda, sin
que nadie note el cambio ahí. Es el mismo patrón por el que `loadPersonVocabulary` nunca
devuelve vacío: un consumidor que todavía no se actualizó sigue viendo lo de siempre.

## Frases reescritas por concordancia de género (11)

En todos los casos el problema es el mismo: un adjetivo, artículo o cuantificador que
concuerda en masculino con "socio/socios" no necesariamente le queda bien a la palabra que
elija cada institución (si configuran "voluntaria/voluntarias", "socio activo" se leería
"voluntaria activo").

1. `components/members/invite-batch-form.tsx` — "1 socio quedó sin invitar" →
   "Quedó 1 {persona} sin invitar" (es el ejemplo textual de la consigna).
2. `app/(shell)/members/page.tsx` — "Todavía no hay socios cargados" → "El padrón de
   {personas} todavía está vacío" ("cargados" concordaba en masculino).
3. `app/(shell)/members/page.tsx` — "Cargá el primer socio del padrón..." → "Empezá cargando
   {personas} al padrón..." ("primer" es ordinal con género).
4. `app/(shell)/members/page.tsx` — "Nuevo socio" (botón) → "Agregar {persona}" ("Nuevo"
   concordaba en masculino).
5. `app/(shell)/members/page.tsx` — "Agregar primer socio" → "Agregar {persona}" (mismo
   problema de "primer").
6. `app/(shell)/members/page.tsx` — "Ningún socio coincide..." / "Ver todos los socios" → "No
   hay {personas} que coincidan..." / "Ver todo el padrón" ("Ningún" y "todos los" concuerdan
   en género).
7. `app/(shell)/members/cuotas/page.tsx` — "cada socio activo" → "cada {persona} con estado
   activo" (mueve el adjetivo a "estado", que sí es invariable).
8. `app/(shell)/members/carnets/issue-button.tsx` — "Todos los socios activos ya tenían
   carnet" → "Todo el padrón activo ya tenía carnet" ("padrón" es un concepto fijo, no la
   palabra configurada, así que "activo" no tiene con qué desacordar).
9. `app/(shell)/members/new/page.tsx` — "Nuevo socio" (título) → "Agregar {persona}"; "cargar
   el primer socio" → "agregar {personas} al padrón" (mismos motivos que 3 y 4).
10. `app/(shell)/members/categories/page.tsx` y `components/members/category-form.tsx` — el
    ejemplo `"Socio activo"` → `"Activo"` (dos veces, en el placeholder y en el texto de
    ayuda); y "para socios nuevos... los socios que ya la tienen" → "en altas nuevas...
    quienes ya la tienen" ("nuevos" y "los" concordaban en masculino; "altas" es siempre
    femenino y "quienes" no tiene género).
11. `components/members/member-import-wizard.tsx` — "{n} socio(s) importado(s)" → "Se
    {importó/importaron} correctamente {n} {persona/personas}" ("importado/s" es un
    participio que concuerda en género con el sustantivo).

(Cuenta: 11 reescrituras, agrupé la 9 y la 10 porque cada una toca dos frases hermanas del
mismo archivo por el mismo motivo.)

## Lo que decidí NO tocar

- **Artículos simples** (`el/la`, `los/las`, `un/una`) pegados directo a la palabra
  configurada, cuando no hay además un adjetivo o cuantificador de por medio — por ejemplo
  "el socio", "un socio", "los socios no pueden pagar". La palabra que elija cada institución
  ya trae su propio género (si alguien pone "voluntaria", "el voluntaria" queda mal, pero eso
  es un límite del diseño: `personVocabulary` solo configura singular/plural, no género, igual
  que en la tanda 1). Reescribir cada frase para esquivar el artículo hubiera sido mucho más
  invasivo que lo que pide la consigna (que habla de "adjetivos"), y el propio ejemplo de la
  consigna tampoco toca artículos. Lo marco como duda abajo.
- Comentarios de código: ninguno se tocó, aunque casi todos mencionan "socio" porque describen
  la SFPR, que era el caso real cuando se escribieron.
- "Padrón", "carnet", "categoría", "cuota", "solicitud": se dejaron fijos en todos los casos.
- `credit-callout.tsx`: `tone: "socio" | "panel"` es un identificador interno, nunca aparece
  en pantalla.

## Verificación

```
$ pnpm test
Test Files  1 failed | 230 passed (231)
     Tests  1 failed | 2624 passed (2625)
```
El único fallo es el conocido y ajeno: `lib/template-v2/access.test.ts` (ENOENT sobre una ruta
que no existe en este árbol, no relacionado con esta tanda).

```
$ npx tsc --noEmit -p tsconfig.json
```
Sin salida — limpio.

```
$ pnpm lint
✖ 10 problems (3 errors, 7 warnings)
```
Los 3 errores son los avisados como preexistentes (`hero-block-view.tsx` x2,
`mass-grading-screen.tsx` x1, todos `react-hooks/set-state-in-effect`), más 7 warnings
preexistentes no relacionados. Ninguno en archivos de esta tanda.

```
$ pnpm build
```
Compila, exit code 0, todas las rutas de `/members/**` y `/w/[workspaceSlug]/asociarse`
listadas. Durante la generación estática aparecen errores de Prisma
("Environment variable not found: DATABASE_URL") en consultas de `user`/`workspace`/`membership`
—no relacionadas con Socios ni con esta tanda— porque este entorno no tiene `DATABASE_URL`
configurada; no afectan el resultado (`exit code 0`).

### Verificación pedida (grep de lo que quedó sin configurar)

```
$ grep -rnoE '>[^<>{}]*[Ss]ocios?[^<>{}]*<|"[^"]*[Ss]ocios?[^"]*"' "app/(shell)/members" components/members components/membership | grep -v "^.*://" | head -40
app/(shell)/members/page.tsx:106:"socios"
app/(shell)/members/page.tsx:213:"Ningún socio"
app/(shell)/members/page.tsx:213:"todos los socios"
app/(shell)/members/cuotas/page.tsx:68:"socio activo"
app/(shell)/members/carnets/issue-button.tsx:26:"socios activos"
app/(shell)/members/new/page.tsx:31:"el primer socio"
app/(shell)/members/categories/page.tsx:39:"Socio activo"
components/members/category-form.tsx:83:"socios nuevos"
components/members/category-form.tsx:84:"los socios"
components/membership/credit-callout.tsx:15:"socio"
components/membership/credit-callout.tsx:22:"socio"
components/membership/credit-callout.tsx:26:"socio"
```

Revisadas una por una:

- Todas las de `page.tsx`, `issue-button.tsx`, `new/page.tsx`, `categories/page.tsx` y
  `category-form.tsx` están dentro de comentarios `/* */` que documentan por qué reescribí la
  frase de al lado (son las mismas reescrituras de la sección anterior, citadas entre comillas
  dentro del comentario). Correcto que queden así: explican una decisión, no son texto que se
  muestra.
- Las tres de `credit-callout.tsx` son el tipo `tone: "socio" | "panel"` y sus dos usos en
  comparaciones (`tone === "socio"`). Es un identificador interno que decide cuál de dos
  mensajes mostrar; ninguno de esos dos mensajes contiene la palabra "socio". Correcto que
  quede así: no es texto visible.

No quedó ninguna coincidencia que fuera texto visible sin configurar.

## Dudas

1. **Artículos y cuantificadores pegados a la palabra sin adjetivo intermedio** (`el socio`,
   `un socio`, `los socios pueden...`): los dejé con sustitución directa (`el ${v.singular}`),
   sin reescribir la frase entera. Si una institución configura una palabra de género distinto
   al de "socio" va a leer "el voluntaria" en vez de "la voluntaria". Esto ya es un límite del
   diseño de dos tandas atrás (`personVocabulary` no configura género), así que no lo considero
   un bug de esta tanda, pero lo marco por si preferís que lo tratemos como deuda técnica
   explícita para una tanda futura (agregar género configurable, o una regla de reescritura
   más agresiva).
2. **`app/w/[workspaceSlug]/asociarse/page.tsx`** (detallado arriba): toqué una página fuera
   de `app/(shell)/members` porque era la única forma de arreglar
   `components/membership/application-form.tsx`, que sí está en mi alcance. Decime si preferís
   que lo revierta y deje ese componente con "socio" fijo hasta que le toque su propia tanda.
3. **`ProfessionalPresenceFields`** (detallado arriba): usé un prop opcional con valor por
   omisión para no tener que tocar `components/portal/professional-profile-form.tsx`. Es
   consistente con cómo `loadPersonVocabulary` ya maneja "nadie configuró nada", pero es una
   decisión de diseño que no estaba en la consigna original.
