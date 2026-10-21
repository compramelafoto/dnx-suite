# Listas de precios de proveedores, margen por producto y precio redondeado para la caja

- **Fecha:** 2026-10-21
- **Pedido por:** Daniel (DNX Estudio)
- **Para quién:** todos los workspaces de FOTOFFICE. DNX Estudio es el primero en usarlo.
- **Código de partida:** `origin/main` en `f3c586b47`
- **Rama:** `feat/fotoffice-listas-precios-proveedores`

## 1. Por qué

Los laboratorios (La Isla, Fotolag, Román, Copy Express…) mandan una lista nueva en PDF cada mes.
Hoy los precios de venta de cada producto se cargaron a mano y **ningún producto tiene costo**: de
los 288 productos activos de DNX Estudio, 0 tienen `costArs`. Por eso:

- no se sabe cuánto se gana con cada producto;
- cuando llega una lista nueva, hay que recalcular todo a mano;
- hay productos que se venden por debajo del costo sin que nadie lo note (ver §9: los fotolibros).

Lo que se quiere:

1. Pasar el PDF del proveedor a un CSV con ChatGPT, usando un prompt que da el sistema.
2. Subir el CSV y que el sistema actualice el **costo** de cada producto desde su **proveedor
   preferido**.
3. Que el **precio de venta** salga solo: costo + un **margen guardado por producto**, redondeado
   hacia arriba a un número cómodo para dar vuelto en efectivo.
4. El margen de cada producto se puede **deducir una vez** de su precio actual (calibrar). DNX
   Estudio lo hace ahora; cualquier otro estudio puede hacerlo cuando empiece a usar la función.
5. Calcular fotolibros como **tapa (que define el modelo) + hoja × cantidad de hojas (+ caja
   opcional)**, con un factor propio (hoy ×3 al público en DNX Estudio).

## 2. Metas, no-metas y anti-metas

**Metas**

- Panel para cargar rápido costo, proveedor preferido y margen de muchos productos a la vez.
- Lista de proveedor → costo → precio sugerido, siempre **con vista previa antes de aplicar**.
- Funciona igual en todos los workspaces. Nada atado a DNX Estudio en el código.
- El emparejamiento "renglón de la lista ↔ producto" se recuerda: el mes siguiente es automático.

**No-metas (por ahora)**

- Leer el PDF dentro de FOTOFFICE con IA propia. Se usa ChatGPT afuera; el sistema sólo recibe el
  CSV. (Se puede sumar más adelante sin cambiar el formato.)
- Precios por variante (`ProductVariant.priceArs`). Los productos con variantes con precio propio se
  muestran marcados y no se tocan.
- Actualizar los tamaños de pedidos de impresión online (`FotofficePrintSize`). Usan otro costo y
  otro precio; queda anotado como siguiente paso natural (§12).

**Anti-metas (sería un fracaso aunque "funcione")**

- Que un precio cambie sin que el dueño lo vea antes. **Nunca** se aplica una lista sin vista previa
  y confirmación.
- Que el redondeo se acumule mes a mes: el precio nuevo se calcula **siempre** desde el margen
  guardado, nunca desde el precio anterior ya redondeado.
- Que un margen se fije con el costo de un proveedor que no es el preferido (por ejemplo, fijar el
  margen de las copias de Fotolag con precios de La Isla).

## 3. Cómo se usa (recorrido)

### 3.1 Primera vez en un workspace

1. **Ventas → Costos y márgenes.** Tabla con todos los productos activos: categoría, nombre,
   proveedor preferido, costo, margen, precio actual, precio sugerido. Filtros por categoría y por
   proveedor, y "sólo sin costo".
2. Se elige el **proveedor preferido** de cada producto (selector con la lista de Proveedores de
   Configuración). Se puede elegir uno para varios productos a la vez (selección múltiple).
3. Se carga el **costo**: a mano en la tabla (edición en línea, Tab pasa a la celda siguiente) o
   subiendo la lista del proveedor (§3.2).
4. **Calibrar margen.** Con costo y precio cargados, un botón calcula
   `margen = precio actual ÷ costo − 1` para los productos elegidos y lo guarda. Se ve antes de
   guardar. Es la "única vez": después el margen sólo cambia si alguien lo edita.
5. Desde ahí, el precio de cada producto con margen es **costo × (1 + margen)**, redondeado hacia
   arriba (§5).

### 3.2 Cada vez que llega una lista nueva

1. **Ventas → Costos y márgenes → Listas de proveedores → Cargar lista.**
2. Se elige el proveedor y se copia el **prompt para ChatGPT** (§6) con un botón "Copiar".
3. En ChatGPT se adjunta el PDF y se pega el prompt. ChatGPT devuelve un CSV.
4. Se sube el CSV (o se pega el texto). El sistema lo valida y muestra los renglones.
5. **Emparejamiento:** cada renglón se une a un producto.
   - Si ya se emparejó en una lista anterior del mismo proveedor, sale solo.
   - Si no, el sistema sugiere uno (misma medida y palabras parecidas) y el usuario confirma o elige
     otro. También se puede dejar sin producto (renglones que no se venden).
6. **Vista previa:** por cada producto cuyo proveedor preferido es el de esta lista: costo anterior
   → costo nuevo, precio actual → precio nuevo, y la diferencia en %. Marcas visibles:
   - producto sin margen (se actualiza el costo, el precio queda igual);
   - precio nuevo menor que el actual (el costo bajó);
   - suba de más de 30 % (para mirar dos veces);
   - el renglón está emparejado con un producto cuyo preferido es **otro** proveedor: se guarda el
     costo de referencia pero **no** cambia ni costo ni precio del producto.
7. **Aplicar.** Todo en una transacción. Queda registrado quién y cuándo, y la lista guardada.

## 4. Proveedor preferido

- Columna nueva `Product.preferredProveedorId` → `FotofficeProveedor` (`onDelete: SetNull`).
- El texto libre actual `Product.supplierName` **se mantiene** (lo usa el formulario de producto) y
  se sigue mostrando. Al cargar la pantalla por primera vez, el sistema ofrece **unirlos**:
  por cada texto distinto ("LA ISLA", "FOTOLAG", "ROMAN"…) sugiere el proveedor de igual nombre sin
  importar mayúsculas ni tildes ("ROMAN" = "Román"). Si no existe, ofrece crearlo
  ("TiendaVGO", "Pascal"…). "DNX" (producción propia) se deja sin proveedor.
- El formulario de producto (`(shell)/ventas/product-form.tsx`) suma el selector de proveedor
  preferido y el margen.

## 5. Redondeo para la caja

- Regla por workspace: **redondear hacia arriba al múltiplo de $N**, por tramos de precio.
- **Por omisión (pedido por Daniel: "múltiplos de 1000 o de 500, y en productos muy económicos
  de 100"):**

  | Precio calculado | Redondea hacia arriba al múltiplo de |
  |---|---|
  | menos de $5.000 | $100 |
  | de $5.000 a menos de $20.000 | $500 |
  | $20.000 o más | $1.000 |

  Los límites de los tramos son decisión mía; se cambian en la misma pantalla, en "Redondeo".
- Siempre hacia arriba: nunca baja el margen.
- Se aplica al calcular precio desde costo y margen. El precio cargado a mano no se toca.

## 6. El prompt para ChatGPT y el formato del CSV

### 6.1 Columnas (en este orden, con este encabezado)

```
proveedor,vigencia,tipo,categoria,producto,modelo,medida,variante,cantidad_minima,unidad,precio,codigo_proveedor,notas
```

| Columna | Qué va |
|---|---|
| `proveedor` | Nombre del proveedor como figura en la lista |
| `vigencia` | Mes y año de la lista, `AAAA-MM` |
| `tipo` | `PRODUCTO`, `TAPA`, `HOJA`, `CAJA` o `ADICIONAL` |
| `categoria` | Título de la sección del PDF (por ejemplo "Laboratorio proceso químico", "Cuadros canvas") |
| `producto` | Nombre del producto tal como figura |
| `modelo` | Sólo fotolibros y cajas: el modelo (Maldivas, Clásico, Gold Collection…). Vacío en el resto |
| `medida` | En cm, `ANCHOxALTO` sin espacios (`20x30`). Si hay varias medidas en una celda (`30x40/45`, `15x20/21/22`), un renglón por medida |
| `variante` | Terminación o material que cambia el precio (Brillo, Mate, Lona front, Canvas, Lija/Tela/3D…). Vacío si no hay |
| `cantidad_minima` | Si el precio depende de la cantidad (x10, +25, 100, "hasta 50"), la cantidad desde la que vale. Vacío si no |
| `unidad` | `unidad`, `hoja`, `m2`, `metro`, `pack`, `rollo` |
| `precio` | Número entero en pesos, sin `$` ni puntos de miles (`10200`) |
| `codigo_proveedor` | El código si la lista lo trae (Copy Express: 388, 307…). Vacío si no |
| `notas` | Aclaraciones breves que cambian el precio ("opcional lomo brillante") |

### 6.2 Texto del prompt (se muestra con un botón "Copiar")

> Vas a convertir la lista de precios adjunta (PDF o imagen) de un proveedor de impresión
> fotográfica en un CSV. Devolvé **sólo** el CSV dentro de un bloque de código, sin comentarios
> antes ni después.
>
> Encabezado exacto, en este orden:
> `proveedor,vigencia,tipo,categoria,producto,modelo,medida,variante,cantidad_minima,unidad,precio,codigo_proveedor,notas`
>
> Reglas:
> 1. Un renglón por **cada precio** que aparezca. Si una tabla tiene medidas en columnas y
>    terminaciones en filas, cada cruce es un renglón.
> 2. `precio`: número entero en pesos, sin `$`, sin puntos ni espacios (`$10 .200` → `10200`).
>    Si dice "consultar", "a cotizar" o está vacío, **no** lo incluyas.
> 3. `medida`: en centímetros, `ANCHOxALTO`, sin espacios, el número chico primero (`20x30`).
>    Si una celda tiene varias medidas (`30x40/45`, `15x20/21/22`), repetí el renglón por cada
>    una. Si el precio es por metro cuadrado, `medida` vacía y `unidad` = `m2`.
> 4. Fotolibros: la **tapa** define el modelo. Cada precio de tapa es `tipo` = `TAPA`, con el
>    nombre del modelo en `modelo` y la medida a libro abierto. El precio por hoja es
>    `tipo` = `HOJA` (sin modelo, salvo que la hoja dependa del modelo). Las cajas son
>    `tipo` = `CAJA`. Recargos opcionales ("+ $500 lomo brillante", "adicional laminado de tapa")
>    son `tipo` = `ADICIONAL`. Un combo que ya incluye hojas y tapa es `PRODUCTO`, y en `notas`
>    va qué incluye (por ejemplo "4 hojas + tapa").
> 5. Precios por cantidad ("x10", "+25", "100", "hasta 20 / hasta 50"): un renglón por tramo, con
>    la cantidad desde la que vale en `cantidad_minima` (para "hasta 50" después de "hasta 20",
>    poné 21).
> 6. `variante`: la terminación o material que cambia el precio (Brillo, Mate, Canvas, Lona front,
>    Lija/Tela/3D, Simple faz, Doble faz…). Si dos terminaciones tienen el mismo precio en una sola
>    celda ("Brillo o Mate"), un solo renglón con variante vacía.
> 7. `categoria`: el título de la sección del PDF donde está el precio.
> 8. `vigencia`: `AAAA-MM` según el mes que figura en la lista.
> 9. Si un campo tiene coma, ponelo entre comillas dobles.
> 10. No inventes datos. Si algo es ambiguo, incluilo igual y explicalo en `notas`.
>
> Proveedor: **{nombre del proveedor elegido}**

El sistema completa `{nombre del proveedor elegido}` al copiar.

### 6.3 Validación al subir

- Encabezado exacto (se toleran mayúsculas, tildes y espacios de más).
- `precio` entero > 0 y < $10.000.000. `tipo` dentro de los cinco valores.
- Renglones repetidos (misma clave, §7) se marcan; gana el último.
- Tope: 3.000 renglones por lista.
- Se reutiliza el patrón de `lib/clients/importar.ts` (Papa.parse, normalizar encabezados, estados
  VÁLIDA / ERROR / DUPLICADA).

## 7. Datos

Todo con `workspaceId`. Las migraciones se escriben a mano, idempotentes, y se aplican en la base de
producción de FOTOFFICE (proyecto Neon `compramelafoto`, rama `development`) **antes** de fusionar,
y después se registran con `prisma migrate resolve --applied`.

**Product (columnas nuevas)**

- `preferredProveedorId String?` → `FotofficeProveedor`, `onDelete: SetNull`, con índice.
- `marginPct Decimal(7,2)?`: margen sobre el costo, en %. `170` = costo × 2,7. Nulo = sin margen
  (el precio se maneja a mano).
- `costUpdatedAt DateTime?`: cuándo cambió el costo por última vez.

**`FotofficeReglaPrecios`** (una fila por workspace; se crea la primera vez que se guarda)

- `workspaceId @unique`
- `redondeo Json`: lista de tramos `[{ desdeArs: 0, multiploArs: 100 }, …]`
- `fotolibroMarginPct Decimal(7,2)?`: margen de fotolibros (DNX Estudio: 200 = ×3)

**`FotofficeListaProveedor`** (cada lista subida)

- `id`, `workspaceId`, `proveedorId`, `vigencia String` (`AAAA-MM`), `nombreArchivo String?`
- `estado`: `BORRADOR` | `APLICADA` | `DESCARTADA`
- `creadaPorUserId`, `aplicadaPorUserId?`, `aplicadaAt?`, timestamps

**`FotofficeListaProveedorItem`** (cada renglón)

- `listaId`, las columnas del CSV (`tipo`, `categoria`, `producto`, `modelo?`, `medida?`,
  `variante?`, `cantidadMinima Int?`, `unidad`, `costoArs Decimal(12,2)`, `codigoProveedor?`,
  `notas?`)
- `clave String`: `tipo|categoria|producto|modelo|medida|variante|cantidad_minima`, normalizada
  (minúsculas, sin tildes, espacios simples)
- `productId String?`: producto emparejado en esta lista

**`FotofficeEquivalenciaProveedor`** (lo que se recuerda para la próxima)

- `workspaceId`, `proveedorId`, `clave`, `productId`
- `@@unique([workspaceId, proveedorId, clave])`
- Si el proveedor tiene `codigo_proveedor`, se usa también como clave alternativa (las listas de
  Copy Express cambian de nombre pero mantienen el código).

Las listas aplicadas quedan como **historial de costos** por proveedor. Las tapas, hojas y cajas de
fotolibros viven sólo acá (no se crean productos por cada tapa; ver §9).

## 8. Cálculo

```
precioSugerido = redondearArriba(costo × (1 + marginPct / 100), reglaDelWorkspace)
calibrar:       marginPct = (precioActual / costo − 1) × 100, a 2 decimales
```

- Funciones puras en `lib/precios-proveedor/` (o el nombre que encaje), con pruebas: redondeo por
  tramos, cálculo, calibración, clave normalizada, sugerencia de emparejamiento, validación del CSV.
- Dinero con `Decimal`; los resultados en pesos enteros.
- Al aplicar una lista, para cada producto con preferido = proveedor de la lista y emparejado:
  `costArs` = costo nuevo; si tiene `marginPct`, `priceArs` = precio sugerido.
- Ventas ya hechas no cambian: `SaleItem` guarda su propio precio y costo.

## 9. Fotolibros

**Cómo se calcula (igual en La Isla, Román y Copy Express):**

```
costo = tapa(modelo, medida) + hoja(medida) × cantidad de hojas + caja(modelo, medida) [opcional] + adicionales
precio = redondearArriba(costo × (1 + fotolibroMarginPct / 100))
```

- La medida va a libro abierto; 1 hoja = 2 páginas.
- En DNX Estudio el factor de hoy es ×3 (`fotolibroMarginPct` = 200).

**Hallazgo:** los 8 productos de fotolibro de DNX Estudio (proveedor ROMAN) hoy se venden **por
debajo del costo** de Román octubre 2026. Por ejemplo, la hoja 15x30 se vende a $3.000 y Román la
cobra $4.300; la hoja 30x45, a $5.900 contra $8.400. Con ×3, la hoja 30x45 sería $25.200.

**Cuántas hojas: una sugerencia según la cantidad de fotos.** Tomado de la planilla de cálculo
que usa hoy DNX Estudio (los precios de esa planilla no se usan; la lógica sí):

- El usuario indica **cuántas fotos** quiere imprimir.
- Cada medida tiene un dato **"fotos por hoja (aprox.)"**, configurable por workspace. Valores
  iniciales de la planilla: 15x30 → 8, 20x40 → 4, 30x45 → 10, 30x60 → 5.
- **Hojas sugeridas = fotos ÷ fotos por hoja, redondeado hacia arriba**, con un mínimo de 2 hojas
  (el mínimo que usa la planilla). Ejemplo con 100 fotos: 15x30 → 13 hojas, 30x45 → 10,
  30x60 → 20.
- Se muestra para **todas las medidas a la vez** (medida, hojas sugeridas, precio), así el cliente
  compara. Es **sólo una sugerencia**: la cantidad de hojas se puede cambiar libremente.
- **Tapa flexible:** en la planilla, la tapa flexible cuesta lo mismo que **una hoja más** de esa
  medida. Si el proveedor no la lista como tapa, se usa esa regla.

**Cómo se vende (etapa 3):** una **calculadora de fotolibro** en el mostrador y en el presupuesto
con ¿Cuánto Cobro?:

1. cantidad de fotos → tabla de sugerencias por medida → se elige medida;
2. proveedor → modelo (tapa) → cantidad de hojas (viene la sugerida) → caja sí/no → adicionales;
3. muestra costo y precio;
4. agrega a la venta (o al presupuesto) **una sola línea** con un producto "Fotolibro" del workspace (sin stock), con
   el precio calculado y la descripción "Fotolibro {modelo} {medida} · {n} hojas".

Las tapas, hojas y cajas salen de la **última lista aplicada** de cada proveedor (§7). Cuando la
calculadora esté andando, los 8 productos de fotolibro sueltos de DNX Estudio se pueden desactivar.

## 10. Etapas

| Etapa | Qué entrega | Depende de |
|---|---|---|
| 1 | Proveedor preferido, costo y margen en el producto. Pantalla **Costos y márgenes** con edición en línea, unir proveedores desde el texto libre, calibrar margen, redondeo por workspace, precio sugerido | — |
| 2 | **Listas de proveedores**: prompt, subida de CSV, emparejamiento recordado, vista previa y aplicar | 1 |
| 3 | **Calculadora de fotolibros** en mostrador y presupuestos, con margen propio de fotolibros | 2 |

Cada etapa es un PR. Las etapas 1 y 2 son las urgentes.

## 11. Puesta en marcha en DNX Estudio (una sola vez, después de la etapa 2)

1. Unir `supplierName` → proveedor preferido (LA ISLA → La Isla, FOTOLAG → Fotolag,
   ROMAN → Román; crear TiendaVGO y Pascal; "DNX" sin proveedor).
2. Subir la lista de **La Isla octubre 2026**, emparejar y aplicar costos.
3. **Calibrar** el margen de los productos con preferido La Isla (ampliaciones, plotter, cuadros
   MDF, canvas, dípticos). Margen medido hoy contra La Isla:

   | Grupo | Margen actual |
   |---|---|
   | Ampliaciones 20x40 a 30x90 | 169–173 % |
   | Plotter papel estándar 40x50 a 60x100 | 152–184 % |
   | Cuadros MDF (vinilo mate) | 155–163 % |
   | Cuadros canvas | 147–184 % |
   | Dípticos | 170–173 % |

4. **Esperar la lista de Fotolag** para copias, fotoimanes, ampliaciones 20x30/25x38 y Polaroid
   "para mañana". No calibrarlas con precios de La Isla (anti-meta §2).
5. Román: cargar tapas y hojas para la etapa 3; no calibrar los fotolibros (se venden bajo costo).

## 12. Fuera de este diseño (anotado para después)

- Que la lista aplicada también actualice `FotofficePrintSize` (pedidos de impresión online).
- Leer el PDF directamente dentro de FOTOFFICE con IA.
- Comparar proveedores: "este producto sale más barato en Copy Express que en La Isla".
- Precios por variante.

## 13. Permisos

Ver y editar costos, márgenes y listas exige ser administrador de ventas (`requireSalesAdmin`).
El personal de mostrador sigue viendo sólo precios.

## 14. Decisiones que tomé yo (revisables)

- El margen es **sobre el costo** (170 % = ×2,7), no sobre el precio.
- La pantalla vive en **Ventas → Costos y márgenes** (`/ventas/costos`).
- Nunca se aplica una lista sin vista previa.
- Las tapas y hojas de fotolibro no se cargan como productos sueltos; viven en la lista del proveedor
  y las usa la calculadora.
- `supplierName` queda como está; el preferido es una columna nueva.
- **Un producto toma su costo de un solo renglón** por proveedor (`@@unique([workspaceId,
  proveedorId, productId])` en la equivalencia). Un renglón sí puede alimentar varios productos
  (por ejemplo, la copia 10x15 del proveedor alimenta "10x15 · más de 10", "· más de 50" y
  "· más de 100"). Si el usuario empareja un segundo renglón al mismo producto, reemplaza al
  anterior.
- **Conversión de unidades:** la equivalencia tiene `factor Decimal(10,4) @default(1)`:
  costo del producto = precio del renglón × factor. Sirve para m² (un 60x100 = 0,6), packs
  (pack de 100 bolsas → 0,01) y metros. En la pantalla se ve como "× 0,6".
- **Etapa 1 y escrituras de precio:** editar costo o margen de **un** producto en la tabla
  recalcula su precio en ese momento (es una acción del usuario sobre una fila que está viendo).
  Calibrar **no** cambia precios. Las acciones masivas ("aplicar precio sugerido a los elegidos")
  pasan por vista previa y confirmación, igual que una lista.
- **Precio editado a mano** (en la tabla o en `product-form.tsx`) en un producto con costo y
  margen: se recalcula el margen desde ese precio (es una recalibración de ese producto). Si no
  tiene costo, el precio queda manual como hoy.
- **Otros que escriben costo/precio:** la carga de Alboom no pisa `costArs` ni `priceArs` de
  productos que ya tienen `marginPct`. `FotofficeCostoPlantilla` (costos de presupuestos, con
  proveedor `Client`) convive sin cambios; unificar proveedores queda fuera.
- **Combos** se tratan como cualquier producto (su costo se carga a mano o por lista; no se
  deriva de sus componentes). Las variantes que heredan el precio siguen al producto; las que
  tienen precio propio no se tocan y el producto se marca.
