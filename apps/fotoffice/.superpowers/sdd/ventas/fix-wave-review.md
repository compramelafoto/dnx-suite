# Revisión de la tanda de arreglos — I-1 a I-6, módulo Ventas

Fecha: 2026-09-14. 6 commits sobre `feat/fotoffice-ventas`, revisados contra
`.superpowers/sdd/ventas/final-review.md`.

## Veredicto

**Fusionar.** Los seis arreglos corrigen de verdad el defecto que dicen corregir, no encontré
ningún camino donde el arreglo abra un agujero nuevo, y `pnpm test` / `pnpm exec tsc --noEmit`
están en la línea base esperada.

Hay **una salvedad, no un bloqueo**: el commit más riesgoso de la tanda (`3efd2fb3`,
`find-or-create.ts`) no trae ninguna prueba automática de su propia lógica nueva, a diferencia
del `record-sale.ts` con el que comparte patrón (que sí tiene una). Lo marco como IMPORTANTE
porque conviene agregarlo antes o inmediatamente después de fusionar, no porque haya encontrado
un defecto en el comportamiento.

## Verificaciones

| Comando | Resultado |
|---|---|
| `pnpm test` | **2502 pasan / 1 falla** — la falla es la previa y ajena de `lib/template-v2/access.test.ts` (`ENOENT` leyendo una pantalla del Diseñador que no existe en esta rama). Coincide exactamente con la línea base esperada. |
| `pnpm exec tsc --noEmit` | Limpio, sin salida. |

---

## Commit por commit

### `3efd2fb3` — catch de P2002 dentro de una transacción (el más riesgoso)

**El arreglo corrige el defecto de verdad.** Repasé el mecanismo con cuidado:

- **Camino feliz igual que `create`.** Los campos que `datos` no manda (`ivaCondition`,
  `status`, `consentsMarketing`, `createdAt`, `updatedAt`) tienen default literal o `now()`/
  `@updatedAt`, que Prisma resuelve igual para `create` y para `createMany` (no son defaults
  `dbgenerated` dependientes de una secuencia). `id` usa `@default(cuid())`, que Prisma genera
  en el cliente antes de armar el `INSERT`, también igual para las dos formas. No hay relaciones
  anidadas en `datos` (todo escalar), así que la limitación real de `createMany` — no soporta
  `connect`/`create` anidado — no aplica acá. No veo diferencia de comportamiento en el camino
  feliz.
- **El único compuesto existe.** Verifiqué `packages/db/prisma/schema.prisma:16874-16927`:
  `@@unique([workspaceId, clientNumber])` en `model Client` está declarado, así que
  `workspaceId_clientNumber` (el nombre por convención de Prisma para un `@@unique` de dos
  campos) es válido. Compila y corre.
- **`count === 1` con una fila releída que no es la nuestra: no puede pasar.** El único
  compuesto garantiza que sólo puede existir una fila con esa `(workspaceId, clientNumber)`.
  `count === 1` significa que ESTA llamada insertó la fila (no fue descartada por
  `ON CONFLICT DO NOTHING`); ninguna otra transacción puede tener una fila con la misma clave al
  mismo tiempo. El `findUniqueOrThrow` que sigue no puede traer otra cosa que no sea la que
  acabamos de insertar.
- **Concurrencia real, no sólo en el papel.** Dos transacciones que leen el mismo "último
  número" y compiten por el mismo `clientNumber`: la que pierde la carrera de bloqueo del índice
  único recibe `count === 0` (no un error de SQL) y su `for` relee con un `SELECT` nuevo — bajo
  Read Committed, ese `SELECT` ve el commit de la ganadora y avanza al número siguiente. Nadie
  queda con la transacción abortada. Mismo patrón, ya probado con Postgres real en el ruling T5
  del documento original (`lib/sales/global-catalog.ts`, `lib/sales/record-sale.ts`).
- **No hay otro `catch` de P2002 vivo en un camino nuevo de esta rama.** Repasé todo `lib/` de
  fotoffice. Hay un `catch` de P2002 con relectura, dentro de una transacción, en
  `lib/cash/record-movement.ts:96-104` (`recordCashMovement`) — y `recordSale` lo llama dentro de
  la misma transacción de la venta (`record-sale.ts:194`, vía `depositarEnCaja`). **Esto ya está
  identificado en `final-review.md`, ítem "puede esperar" #6, como inalcanzable desde Ventas**
  porque el `sourceRef` es el cuid recién generado de la venta (no puede chocar con nada
  existente). Confirmé ese razonamiento y no encontré ningún camino nuevo de esta tanda que lo
  vuelva alcanzable. No lo re-reporto como hallazgo nuevo: está correctamente diferido y fuera
  del alcance de esta revisión.

**IMPORTANTE — sin prueba automática de la lógica nueva.** Busqué `find-or-create.test.ts` y no
existe; en los dos lugares que llaman a `findOrCreateClient`
(`lib/sales/record-sale.test.ts:25-26`, `lib/bookings/cash-deposit.test.ts:24-25`) la función
está **mockeada por completo**. Ningún test del repo ejercita el `createMany` +
`skipDuplicates` + `findUniqueOrThrow` de `find-or-create.ts:91-102`, ni el reintento con
`count === 0`, ni el `throw` a los tres intentos.

Esto contrasta con el patrón hermano en el mismo archivo que originó el "mismo arreglo": hay dos
tests dedicados en `lib/sales/record-sale.test.ts:223-267` que prueban exactamente ese
comportamiento (retry en `count === 0`, y el `throw` a los tres intentos) para
`Sale.saleNumber`. La misma cobertura no se replicó para `Client.clientNumber`, que es el commit
que el propio mensaje llama "la cuarta vez" y "el más riesgoso" de la tanda. No es un defecto de
comportamiento — verifiqué el mecanismo a mano arriba y cierra — pero es el único de los seis
commits que toca producción y queda sin una red de pruebas propia.

- Archivo: `apps/fotoffice/lib/clients/find-or-create.ts:78-104`
- Sugerencia: un test con `tx.client` mockeado, calcado de
  `lib/sales/record-sale.test.ts:223-267`, que pruebe (a) el camino feliz con `count: 1` y
  `findUniqueOrThrow` devolviendo la fila, (b) el reintento cuando el primer intento da
  `count: 0`, y (c) el `throw` después de tres intentos.

### `2d5ac133` — `findProductByCode` filtra `isActive`

**Corrige el defecto y no rompe nada.** `findProductByCode` (`lib/sales/repository.ts:134-150`)
tiene un solo consumidor en todo el repo: `findProductByCodeAction`
(`app/(shell)/ventas/actions.ts:203-206`), que a su vez sólo la llama `pos.tsx` para el lector de
código de barras. Revisé el historial de ventas (`app/(shell)/ventas/historial/page.tsx`, usa
`listSales`) y la anulación (`lib/sales/void-sale.ts`): ninguno de los dos toca `Product` a
través de esta función ni de ninguna otra; una venta vieja se lee desde `SaleItem`, que guarda
nombre y precio congelados al momento de vender, no desde el catálogo vivo. Editar o ver una
venta vieja con un producto hoy dado de baja no pasa por este filtro y sigue funcionando igual
que antes. Sin hallazgos.

### `b69e006f` — orden del respaldo oculto en los dos formularios

**Correcto en los dos formularios y en los dos parsers.** Verifiqué el orden real en el JSX:

- `product-form.tsx:242-252`: `<input type="checkbox" name="tracksStock" .../>` seguido de
  `<input type="hidden" name="tracksStock" value="off" />`, los dos dentro del mismo `<label>`.
  Orden correcto.
- `category-form.tsx:45-49`: mismo patrón, mismo orden correcto.
- Los parsers (`lib/sales/product-form.ts:88-90`, `lib/sales/category-form.ts:29`) interpretan
  `fd.get(campo) !== "off" && fd.get(campo) !== "false"` — con `FormData.get` devolviendo la
  primera coincidencia, tildada gana el `"on"` del checkbox (que aparece primero en el DOM);
  destildada, sólo llega el `"off"` del respaldo. Los dos casos cierran.

**No encontré otra casilla con el mismo problema pasada por alto.** Busqué todo
`type="checkbox"` bajo `app/(shell)/ventas`: hay una tercera, `inactivos` en
`catalogo/page.tsx:103`, pero es de un `<form method="GET">` (un filtro de búsqueda por query
string), no de una acción de servidor que lea `FormData` con la convención on/off — ahí la
ausencia del parámetro ya significa "no tildado" de forma natural, sin necesitar respaldo. El
botón de activar/desactivar del catálogo (`toggleProductActiveAction`,
`catalogo/[productId]/page.tsx:35`) tampoco es una casilla: es un `hidden` con el valor opuesto
al estado actual, sin par de checkbox. No hay una cuarta casilla afectada.

### `56546f08` — aviso de falta de existencia sin bloquear

**Avisa y deja seguir, confirmado.** El único condicional que decide si el botón "Cobrar" se
deshabilita sigue siendo `disabled={procesando || rows.length === 0}` (`pos.tsx:580`), sin
ninguna referencia a `tracksStock`/`stockQty`. `agregarProducto` (`pos.tsx:135-156`) tampoco
tiene ninguna guarda que rechace agregar un producto sin existencia. El resto del diff es
puramente aditivo: un texto en la tarjeta de la grilla y un texto en el renglón del ticket,
ninguno con `return`/`disabled` de por medio. No encontré ningún camino donde ahora no se pueda
cobrar por falta de stock.

### `3586fb8c` — esconder el link "Ver" a quien no puede entrar

Cambio cosmético, tal como dice el mensaje del commit. `puedeEditar` es la misma variable
(`canManageWorkspaceSettings(role)`) que ya gobierna el resto de la pantalla, coherente con el
guardia real de la ficha (`requireSalesAdmin`). Sin hallazgos.

### `c4a3f8f7` — prueba que lee el fuente del formulario

**Evaluación de fragilidad: aceptable, vale la pena.**

Lo que NO la rompe:
- **Un `<input>` partido en varias líneas por el formateador.** El regex `/<input[^>]*>/g` usa
  `[^>]*`, que incluye saltos de línea (sólo excluye el carácter `>`), así que capturas la
  etiqueta entera sin importar cuántas líneas ocupe.
- **Reordenar los atributos dentro de la etiqueta.** Todas las comprobaciones son
  `tag.includes('name="x"')`, `tag.includes('type="checkbox"')`, etc. — substrings, no depende
  de posición dentro de la etiqueta.

Lo que SÍ la rompe, y es un riesgo real aunque no fue el que preguntaron: un cambio de estilo
de comillas en JSX (`jsxSingleQuote: true` en Prettier, o un `--fix` de ESLint que reescriba
`name="tracksStock"` como `name='tracksStock'`) tumbaría las cuatro comprobaciones de esta
prueba de una sola vez, sin que haya ningún defecto real. Hoy el proyecto usa comillas dobles de
forma consistente en todo el JSX que revisé, así que el riesgo es hipotético, no inminente — pero
es la clase exacta de "formateador inocente" que la pregunta busca, sólo que en el atributo de
comillas y no en el salto de línea.

El diseño en general es razonable dado lo que hay disponible: no existe infraestructura de
render de componentes en este repo (`vitest.config` corre con `environment: "node"`, no hay
`@testing-library/react` ni `jsdom` en ninguna parte de `apps/fotoffice`), así que una prueba
que monte `<ProductForm>` de verdad y lea el `FormData` real de un submit —la alternativa menos
frágil— habría exigido meter esa infraestructura sólo para esto. Leer el fuente con regex,
acotado a exigir que el respaldo esté DENTRO del mismo `<label>` (no sólo "más abajo en el
archivo", que es justo lo que dejaba pasar una versión anterior con el respaldo real borrado,
según el propio mensaje del commit) es un compromiso razonable, ya precedentado por
`lib/template-v2/access.test.ts`. Vale la pena mantenerla.

---

## Hallazgos

### Crítico

Ninguno.

### Importante

**IMPORTANTE-1 — `find-or-create.ts` no tiene ninguna prueba propia de la lógica que reemplaza
al `catch` de P2002.** `apps/fotoffice/lib/clients/find-or-create.ts:78-104`. El comportamiento
lo verifiqué a mano y cierra (ver arriba), pero es el commit que toca producción, el que el
propio mensaje llama "la cuarta vez", y el único de los seis sin una red de pruebas propia —
mientras que el patrón hermano en `record-sale.ts` sí la tiene
(`lib/sales/record-sale.test.ts:223-267`). Sugiero agregarla antes de fusionar, o inmediatamente
después, calcada de esa.

### Menor

**MENOR-1 — `checkbox-respaldo.test.ts` es sensible al estilo de comillas de JSX.** Un cambio de
configuración de Prettier/ESLint a comillas simples en atributos JSX rompería las cuatro
comprobaciones sin que exista un defecto real. Riesgo hoy hipotético (el proyecto usa comillas
dobles de forma consistente), no bloquea nada.

Nada más para reportar: los seis arreglos hacen lo que dicen, no encontré caminos nuevos rotos,
y la salvedad de cobertura de pruebas no cambia el veredicto.
