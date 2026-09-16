# Terminología por workspace — tanda 1: el menú

## Nota sobre este archivo

El implementador anterior de esta tanda dijo haber dejado su informe acá, pero el archivo
no existía en el worktree al empezar esta continuación (ni el directorio
`.superpowers/sdd/terminologia/` existía). Lo que sigue es la reconstrucción de su trabajo a
partir de la revisión del diff en el árbol (sin commitear), más el agregado de esta tanda.

## Qué hizo la tanda 1 (reconstruido del diff)

Objetivo: que el menú y el inicio del workspace digan las palabras configuradas por cada
institución ("socios", "voluntarios/as", etc.) en vez de tener "Socios" fijo en 48 archivos.

Diseño: dos formas configurables por workspace (singular/plural, mayúsculas derivadas),
vivas en `lib/vocabulario/personas.ts` (`PersonVocabulary`, `personVocabulary()`) y
`lib/vocabulario/load.ts` (`loadPersonVocabulary`, cacheada por pedido con `cache()` de React).

Los textos del catálogo global (`lib/modules/registry.ts`, `lib/modules/submodules.ts`) no
saben en qué workspace están parados, así que llevan marcadores explícitos
(`{Persona}`, `{persona}`, `{Personas}`, `{personas}`) en vez de tener la palabra escrita. Un
módulo nuevo, `lib/vocabulario/plantilla.ts` (`aplicarVocabulario`), sustituye esos marcadores.
Se eligió reemplazo por marcador y no búsqueda de texto plano porque "asociación" y
"asociarse" contienen "socia" y un reemplazo ingenuo las hubiera destrozado.

`resolveEnabledNavModules` (`lib/modules/nav.ts`) y `submodulesFor`
(`lib/modules/submodules.ts`) pasaron a pedir `vocabulary: PersonVocabulary` como parámetro
obligatorio — el compilador impide que un consumidor nuevo se olvide de pasarlo. Se propagó a
los cuatro consumidores: `app/(shell)/layout.tsx`, `app/workspace/layout.tsx`,
`app/workspace/page.tsx`, `components/shell/shell-sidebar.tsx` y `components/shell/shell-nav.tsx`.

El panel de super admin (`app/(shell)/admin/workspaces/page.tsx` y
`app/(shell)/admin/workspaces/[id]/page.tsx`), que no está parado en ningún workspace,
resuelve los marcadores con `personVocabulary(null)` (el vocabulario por omisión), así que
sigue mostrando "Socios" exactamente como antes.

Tests agregados/actualizados: `lib/vocabulario/personas.test.ts`,
`lib/vocabulario/plantilla.test.ts`, `lib/modules/nav.test.ts`, `lib/modules/submodules.test.ts`.

## El bug que encontró (y por el que frenó)

`lib/vocabulario/load.ts` le pasaba a `personVocabulary()` la fila cruda de Prisma
(`{ personSingular, personPlural }`) pero esa función espera `{ singular, plural }`. Eso está
en el commit de los cimientos (`09dee09e`), que el implementador tenía instrucción de no
tocar. Con razón frenó: el bug es real, y aunque compilara, el menú nunca hubiera leído lo que
un workspace configuró — siempre caería en "socio/socios" por el desfasaje de nombres.

---

## Tanda 2 (esta continuación) — arreglo del bug y verificación final

### 1. El arreglo autorizado

- **`lib/vocabulario/personas.ts`**: agregada `personTermsFromRow(row)`, función pura que
  traduce `{ personSingular, personPlural }` (nombres de columna) a `{ singular, plural }`
  (nombres del dominio). Vive acá y no en el cargador para que quede alcanzada por los tests
  de este archivo, que es justo lo que faltó la primera vez.
- **`lib/vocabulario/load.ts`**: ahora llama
  `personVocabulary(personTermsFromRow(fila))` en vez de pasar la fila cruda.
- **`lib/vocabulario/personas.test.ts`**: agregados los casos pedidos para
  `personTermsFromRow` — fila completa, `null`, una sola palabra cargada, y el caso que
  importa: una fila de voluntarios da "Voluntarios/as" y no "Socios" (con
  `personVocabulary(personTermsFromRow(fila))`, el camino completo real).

### 2. Un segundo bug, también en los cimientos (`09dee09e`), que apareció al correr `tsc`

No estaba descripto en la consigna, pero bloqueaba `npx tsc --noEmit` incluso antes de tocar
nada de esta tanda (verificado con `git stash`: el error ya está en `09dee09e`, independiente
del bug de `load.ts`). `DEFAULT_PERSON_TERMS` estaba tipado como `Required<PersonTerms>`.
Como `PersonTerms` es `{ singular?: string | null; plural?: string | null }`,
`Required<...>` solo saca el `?` pero conserva el `| null` — el tipo resultante seguía siendo
`{ singular: string | null; plural: string | null }`, no `{ singular: string; plural: string }`
como el valor en tiempo de ejecución realmente es (`"socio"`, `"socios"`, nunca null). Eso
rompía la llamada a `usar(configurada, porOmision: string)` dentro de `personVocabulary`.
Arreglado retipando la constante como `{ singular: string; plural: string }`. Sin cambio de
comportamiento en tiempo de ejecución, solo el tipo.

### 3. Verificación (desde `apps/fotoffice`)

```
$ pnpm test          # 230 passed, 1 failed (conocido y ajeno: lib/template-v2/access.test.ts,
                      #   ENOENT sobre una ruta que no existe en este árbol — no relacionado)
$ npx tsc --noEmit -p tsconfig.json   # limpio, sin salida
$ pnpm lint           # 3 errores preexistentes (hero-block-view.tsx x2,
                      #   mass-grading-screen.tsx x1, todos react-hooks/set-state-in-effect,
                      #   ninguno tocado por esta tanda) + 7 warnings preexistentes
$ pnpm build          # compila, exit code 0, todas las rutas listadas
```

### 4. Revisión del trabajo heredado antes de commitear (punto 3 de la consigna)

**¿Algún texto puede llegar a la pantalla con un marcador `{` sin resolver?** No se encontró
ninguno. Todo consumidor de `MODULE_REGISTRY`/`submodulesFor`/`resolveEnabledNavModules` pasa
por `aplicarVocabulario`, y el compilador obliga a pasar `vocabulary` en las dos funciones que
lo exponen — un consumidor nuevo que se olvide no compila. Hay tests explícitos que buscan `"{"`
en las etiquetas y descripciones resueltas (`lib/modules/nav.test.ts`,
`lib/modules/submodules.test.ts`) y `plantilla.test.ts` prueba que un marcador *desconocido*
se deja visible a propósito (para notarlo, no para ocultarlo).

Sí encontré un problema relacionado, aunque no es un marcador sin resolver sino un texto que
**nunca pasó por el sistema de vocabulario**: en `components/shell/shell-nav.tsx`, el título
de la sección del menú lateral estaba escrito a mano — `<Section title="Socios" ... />` — en
vez de usar `vocabulary.Plural`. Un workspace con "voluntarios" configurados hubiera visto sus
ítems de padrón (ya traducidos) agrupados bajo un encabezado que seguía diciendo "Socios". Lo
arreglé cambiando esa línea a `<Section title={vocabulary.Plural} ... />`. No hay tests de
componente para `shell-nav.tsx` (no hay ningún `.test.tsx` en esta app; la convención acá es
solo tests de módulos puros en `.ts`), así que no hay caso automatizado que hubiera atrapado
esto — queda como algo a tener en cuenta si se agrega testing de componentes más adelante.

**¿El panel de super admin sigue diciendo "Socios"?** Sí. `personVocabulary(null)` en las dos
pantallas de `app/(shell)/admin/workspaces/` resuelve siempre al vocabulario por omisión, sin
tocar ningún workspace real. Confirmado leyendo el diff, no hay ninguna llamada a
`loadPersonVocabulary` en ese directorio.

**¿`resolveEnabledNavModules` y `submodulesFor` resuelven el vocabulario de una sola
manera?** Sí, una sola: ambas reciben el `PersonVocabulary` ya armado y lo aplican con
`aplicarVocabulario`, sin lógica de resolución propia. Lo que cambia entre pantallas es
*qué vocabulario* se les pasa (`loadPersonVocabulary(workspaceId)` en las pantallas de un
workspace real, `personVocabulary(null)` en el panel de super admin) — no *cómo* se aplica.
Es la separación correcta: quien resuelve el vocabulario (leer la base o usar el default) es
distinto de quien lo aplica al texto (siempre `aplicarVocabulario`).

## Dudas para quien sigue

- El archivo/directorio de este informe no existía; lo creé de cero para esta entrega. Si en
  algún otro lugar quedó un informe real de la tanda 1 con más detalle de decisiones de
  diseño, valdría la pena fusionarlo acá.
- El segundo bug de tipos (`DEFAULT_PERSON_TERMS`) no estaba en el alcance descripto, pero sin
  arreglarlo `tsc --noEmit` no queda limpio — lo até al mismo commit por ser parte del mismo
  arreglo de fondo en el mismo archivo. Avisar si se prefería un commit separado.
- No agregué tests de componente para el título de sección de `shell-nav.tsx` porque no existe
  ninguna infraestructura de testing de componentes en esta app todavía; el arreglo quedó
  cubierto solo por lectura de código, no por un test automatizado.
