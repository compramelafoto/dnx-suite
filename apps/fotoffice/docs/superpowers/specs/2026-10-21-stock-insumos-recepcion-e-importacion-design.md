# Stock de insumos, recepción de pedidos e importación con IA — diseño

Fecha: 21/10/2026 · Workspace de referencia: **DNX Estudio** (FOTOFFICE) · Módulo: Ventas (`sales`)

## 1. Para qué

En DNX Estudio el pedido de mercadería llega en cajas: se cuenta, se acomoda en la vidriera,
se le pone precio y se exhibe. Además del producto que se vende tal cual, el local gasta
**consumibles** que nunca se venden solos: el ribbon y el papel de la Kodak 305, la tinta, los
sobres de carnet. Hoy nadie sabe cuánto queda de cada uno hasta que se termina.

Queremos tres cosas:

1. **Cargar lo que llega** rápido: con el lector de códigos de barras, la cantidad y el costo,
   o importándolo desde la foto/PDF de la factura o el remito.
2. **Saber cuánto se gasta de cada consumible** por cada cosa que se vende (la "receta"), para
   que el sistema lo descuente solo.
3. **Que el sistema avise cuándo comprar**, antes de quedarse sin ribbon un sábado.

Y, como todo módulo de FOTOFFICE, **guías nuevas en Instructivos** con capturas, para que
cualquiera del mostrador lo pueda usar sin que se lo expliquen.

## 2. Lo que ya existe (y se reutiliza, no se reconstruye)

| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| Catálogo | `Product` (schema), `lib/sales/product-form.ts`, `/ventas/catalogo` | `kind` PRODUCTO/SERVICIO, `barcode`, `sku`, `priceArs`, `costArs`, `tracksStock`, `stockQty`, `minStockQty`, `supplierName` |
| Catálogo maestro por código | `GlobalProduct`, `lib/sales/global-catalog.ts` | Al escanear un código conocido, completa nombre/marca/foto |
| Libro de existencias | `StockMovement` (`reason`: VENTA, ENTRADA, AJUSTE, DEVOLUCION, INICIAL, PEDIDO; `unitCostArs`; `sourceModule/sourceRef`) | La existencia es la suma del libro; puede ser negativa (es información) |
| Reglas de stock | `lib/sales/stock.ts` | `needsRestock`, `validateStockEntry`, `validateAdjustment` |
| Pantalla Stock | `/ventas/stock`, `stock-form.tsx` | Por producto: "Cargar entrada" (cantidad + costo) y "Ajustar por conteo" (nota obligatoria). Lo que está bajo el mínimo va primero |
| Descuento por venta | `lib/sales/record-sale.ts` → `descontarStock` / `applyStockMovement` | Toda venta (Mostrador y tienda online vía `lib/store/credit-payment.ts`) pasa por acá. Vender nunca se bloquea por falta de stock |
| Anulación | `lib/sales/void-sale.ts` | Devuelve el stock con `DEVOLUCION` |
| Pedidos con seña | `lib/pedidos/pedidos.ts` (`apartarStock`, `devolverStockApartado`) | **Camino aparte, no pasa por `recordSale`**: al tomar el pedido aparta stock con `reason = "PEDIDO"`; al cancelar devuelve lo de las líneas no entregadas |
| Orden de bloqueo | `lockStockRows` | Bloquea filas de `Product` en orden de id antes de escribir, para evitar interbloqueos |
| Lector de códigos | Mostrador (`pos.tsx`) | El lector funciona como teclado: escribe el código + Enter |
| Impresión | `FotofficeSalidaImpresion` (Kodak, Epson, laboratorio), `FotofficeTamanoImpresion`, `FotofficeProductoProduccion` (producto → salida + tamaño de hoja + unidad HOJA/COPIA/PIEZA), `FotofficeRegistroImpresion` (hojas impresas, incluso PRUEBA/DESCARTADA) | Sabe en qué impresora y en qué tamaño sale cada producto |
| Proveedores | `FotofficeProveedor` | Nombre, email, teléfono, notas |
| IA | `lib/dnx-bot/anthropic.ts` (`ANTHROPIC_API_KEY`, SDK de `@repo/dnx-bot`, tope de gasto) | DNX Bot ya llama a Claude desde FOTOFFICE |
| Instructivos | `lib/instructivos/` (`tipos.ts`, `guias/*.ts`, `capturas/*.json`), imágenes en `public/instructivos/<slug>/` | Guías en código, con pasos, capturas, recuadro "lo que hace el sistema solo" |

**Conclusión:** productos con código de barras, costo, entradas, ajustes, mínimos y descuento
por venta ya funcionan. Este diseño agrega **insumos, recetas, recepción por lote, importación
con IA, avisos con días de cobertura y las guías**.

## 3. Objetivos, no-objetivos y anti-objetivos

**Objetivos**
- Dar de alta insumos (cosas que se cuentan pero no se venden) con su unidad de medida.
- Definir para cada producto/servicio vendible cuánto gasta de cada insumo.
- Descontar insumos automáticamente **por cada producto vendido** (decisión de Daniel), y
  devolverlos si la venta se anula.
- Recibir un pedido entero en una sola pantalla: lector de códigos, cantidad, costo.
- Importar un pedido desde **cualquier formato**: factura en PDF, foto de factura o remito,
  captura de una compra de Mercado Libre, lista de precios, o un CSV.
- Avisar qué hay que comprar, con días de cobertura estimados.
- Guías nuevas con capturas.

**No-objetivos (esta vez)**
- Descontar ribbon por hoja realmente impresa (incluye pruebas y descartes). Daniel eligió
  "por producto vendido". El registro de hojas (`FotofficeRegistroImpresion`) queda para un
  informe de desperdicio futuro.
- Órdenes de compra a proveedores, cuentas a pagar por la recepción, facturación electrónica.
- Valuación contable de inventario (PEPS/promedio ponderado formal). Se guarda el costo de cada
  entrada; el "costo actual" del producto es el último pagado.
- Escaneo por cámara del celular (el lector USB/Bluetooth ya funciona como teclado).
- Multi-depósito / sucursales.

**Anti-objetivos (fallaría aunque "funcione")**
- Que la IA cargue stock sola. **Nada de lo importado toca existencias sin que una persona lo
  revise y confirme.**
- Que un insumo aparezca en el Cobrador o en la tienda online como algo para vender.
- Que el mostrador tenga que cargar la receta dos veces (una en Impresión y otra en Stock).
- Que vender se bloquee porque "no hay ribbon" según el sistema. El negativo avisa, no frena
  (misma regla que hoy).
- Que una anulación deje los insumos descontados.

## 4. Conceptos

### 4.1 Insumo

Un insumo es un `Product` con **`kind = "INSUMO"`** (tercer valor además de PRODUCTO y
SERVICIO). Así reusa código de barras, costo, existencia, mínimo, libro de movimientos,
categorías y la pantalla Stock sin duplicar nada.

- `tracksStock` siempre `true`; `priceArs` = 0 y no se pide en el formulario.
- **No aparece** en el Cobrador, la tienda online, la lista de precios ni los presupuestos.
  Hay que filtrarlo explícitamente en cada listado de "cosas para vender" (`listProducts` y
  vecinos: el constructor debe auditar todos los lugares que listan `Product`).
- **Sin columnas nuevas en `Product`**: el esquema es compartido por todas las apps de DNX y una
  columna que falte en alguna base rompe toda lectura de `Product` en esa app (P2022). Los datos
  propios del insumo van en una tabla nueva de FOTOFFICE, **`FotofficeInsumo`** (`productId`
  único, `workspaceId`, `unidad` — ej. "copias 10x15", "sobres", "ml" —, `unidadCompra?` — ej.
  "Kit 305 6R" —, `unidadesPorCompra?` Int — ej. 640). Mismo patrón que
  `FotofficeProductoCatalogo`. Al cargar una entrada se puede indicar "1 Kit 305 6R" y entran
  640; el costo unitario se divide solo. (La unidad de compra para productos comunes queda para
  la etapa 2.)
- Las cantidades son **enteras**. Si algo se gasta en fracciones, se elige una unidad más
  chica (ml en vez de litros). *(Decisión del diseño: mantiene `StockMovement.qty` Int.)*

### 4.2 Receta de consumo

Modelo nuevo **`FotofficeRecetaInsumo`**:

| Campo | Notas |
|---|---|
| `workspaceId` | |
| `productId` | Lo que se vende (PRODUCTO o SERVICIO) |
| `insumoId` | Un `Product` con `kind = INSUMO` del mismo workspace |
| `quantity` | Int > 0: cuánto insumo gasta cada grupo de `porCada` unidades vendidas |
| `porCada` | Int ≥ 1, por omisión 1: **cada cuántas unidades** se gasta `quantity` (ej. 2 Polaroid 7,5×10 por hoja 10x15) |
| `order` | |

Único por (`productId`, `insumoId`). Un producto puede gastar varios insumos (foto carnet →
1 copia de ribbon + 1 sobre). Un servicio también puede tener receta.

**La receta se aplica siempre**, aunque el producto vendido no controle su propia existencia
(`tracksStock = false`, como los servicios). Hoy `descontarStock` saltea esos productos; el
consumo de insumos va por un filtro aparte.

**Combos** (`FotofficeComboItem`): hoy `descontarStock` **no desarma** los combos (solo resta el
combo si controla stock; los componentes no se tocan). Para los **insumos** sí se desarma: al
vender un combo se aplican las recetas de sus componentes (recursivo, porque un combo puede
contener otro; `lib/catalogo/combos.ts` impide ciclos) multiplicadas por la cantidad, más la
receta propia del combo. El descuento de la **existencia** de los componentes queda como está
(cambiarlo es otra decisión, fuera de este trabajo). *(Decisión del diseño.)*

### 4.3 Consumo por tamaño de impresión (Kodak 305)

Investigado y confirmado con Daniel:

- El kit de la Kodak 305 (código 1195916) trae 2 rollos de papel + 2 ribbons y rinde
  **640 copias 10x15** o **320 de 15x20** por caja (320 / 160 por rollo).
- El rollo es de 15 cm de ancho y cada copia usa un tramo del largo: 10x15 = 1 tramo;
  **13x18 = 2 tramos; 15x20 = 2 tramos** (Daniel confirmó que 13x18 rinde igual que 15x20).
- Tiras 5x15 y fotos carnet salen de una hoja 10x15 cortada: 1 tramo por hoja.

Modelo nuevo **`FotofficeConsumoTamano`** (`workspaceId`, `salidaId`, `tamanoId`, `insumoId`,
`quantity` Int): "en esta impresora, una hoja de este tamaño gasta N de este insumo".
Para la Kodak 305: 10x15 → 1, 13x18 → 2, 15x20 → 2 del insumo "Kit Kodak 305 (copias 10x15)".
Ribbon y papel vienen juntos en el kit, así que es **un solo insumo**.

**Polaroid y piezas más chicas que la hoja** (diseñador de Polaroid de CompraMeLaFoto,
`apps/compramelafoto/components/polaroid/presets.ts`, que se copia a FOTOFFICE):

| Polaroid | Hoja | Por hoja | Copias del kit por hoja |
|---|---|---|---|
| 7,5×10 | 10x15 | 2 | 1 |
| 9×13 | 13x18 | 2 | 2 |
| 10×15 | 10x15 | 1 | 1 |
| (si se agrega) 2 en 15x20 | 15x20 | 2 | 2 |

**Redondeo, decidido por Daniel (21/10):** las piezas de distintos clientes **no se juntan** en
una hoja, ni las instantáneas ni las "para retirar". Por eso el consumo se redondea **para arriba
por renglón vendido**: 3 Polaroid 7,5×10 = 2 hojas = 2 copias del kit. Con combos, se redondea
por componente (unidades del componente = cantidad del combo × cantidad en el combo).

**Precio y consumo son independientes (Daniel, 21/10):** el precio es del producto, por unidad.
Una pieza más chica que una 10x15 se cobra como una 10x15 aunque entren 2 por hoja. La
Polaroid **instantánea** y la **no instantánea** (para mañana o la semana que viene) son
**productos distintos** con precio distinto y pueden tener la misma receta.

Esto **no** se aplica en el momento de la venta. Sirve para **proponer la receta**: en la
ficha de un producto que tiene `FotofficeProductoProduccion` (salida + tamaño de hoja), el
botón "Sugerir desde Impresión" precarga la línea de receta (hojas por unidad vendida ×
consumo del tamaño). La persona la acepta o la corrige. **La receta guardada es la única
verdad al vender.** Así cumple "no cargar dos veces" sin que un cambio en Impresión cambie en
silencio lo que se descuenta.

Cuántas piezas por hoja: si la unidad del producto es HOJA o COPIA, `porCada = 1`. Si es PIEZA,
la sugerencia pregunta "¿Cuántas entran por hoja?" con 2 por defecto para POLAROID en hoja
10x15, 13x18 o 15x20 y 1 para el resto, y lo guarda en `porCada`.

### 4.4 Descuento al vender y al anular

En `descontarStock` (`lib/sales/record-sale.ts`), dentro de la misma transacción, por cada
renglón con producto: buscar sus recetas y escribir un `StockMovement` por insumo con
`qty = -(ceil(renglón.qty / receta.porCada) × receta.quantity)`, **`reason = "CONSUMO"`** (valor nuevo),
`sourceModule = "sales"`, `sourceRef = saleId`, y `note = "consumo:item:<saleItemId>"`. El
prefijo `consumo:` es obligatorio: `devolverStockApartado` de Pedidos empareja devoluciones por
`note = "item:<id>"`, y una nota igual haría creer que la línea ya se devolvió.

**Instantánea:** se descuenta según la receta **del momento de la venta**. Al anular
(`void-sale.ts`) se devuelve exactamente lo que se descontó (leyendo los movimientos CONSUMO
de esa venta), con `reason = "DEVOLUCION"`, aunque la receta haya cambiado después.

El renglón suelto escrito a mano (sin producto) no consume nada.

**Pedidos con seña** (`lib/pedidos/pedidos.ts`), decidido por Daniel: **se descuentan los
insumos al tomar el pedido**, igual que hoy se aparta el stock. En `apartarStock` se escriben
movimientos CONSUMO con `sourceModule = "pedidos"`, `sourceRef = pedidoId` y la línea en
`note` (mismo criterio que PEDIDO). En `devolverStockApartado`, al cancelar, se devuelven los
insumos **solo de las líneas no entregadas** (misma regla `posicionesEntregadas`). Cuando el
pedido luego se cobra como venta, no se vuelve a descontar: el constructor debe verificar si el
saldo del pedido pasa por `recordSale` y, si pasa, evitar el doble descuento (por ejemplo,
salteando las recetas de renglones que vienen de un pedido que ya consumió).

**Bloqueos:** las filas de los insumos se suman al bloqueo previo de `lockStockRows` (mismo
orden por id) en todos los caminos que escriben CONSUMO o lo revierten; si no, vuelve el
interbloqueo que el código ya documenta.

## 5. Recepción de un pedido

Pantalla nueva: **Ventas → Stock → "Recibir pedido"** (`/ventas/stock/recepcion`).

Modelos nuevos:
- **`FotofficeRecepcion`**: `workspaceId`, `proveedorId?` (`FotofficeProveedor`),
  `fecha`, `comprobante?` (nro de factura/remito), `estado` BORRADOR | CONFIRMADA | DESCARTADA,
  `archivoKey?` (la imagen/PDF importado, en el bucket R2 de FOTOFFICE), `preciosConIva`
  Boolean, `createdByUserId`, `confirmedAt`, `confirmedByUserId`.
- **`FotofficeRecepcionLinea`**: `recepcionId`, `productId?` (nulo = todavía sin asociar),
  `descripcionOriginal` (como venía en la factura), `codigoBarras?`, `cantidad` (en unidad de
  compra o unidad de stock, según `enUnidadDeCompra`), `enUnidadDeCompra` Boolean,
  `costoUnitarioArs?`, `origen` LECTOR | MANUAL | IMPORTACION, `order`.

Flujo:
1. "Recibir pedido" crea un **borrador**. Se puede cerrar y seguir después (llegan muchas cajas).
2. Campo con foco permanente "Escaneá o escribí": el lector escribe el código + Enter.
   - Código conocido en el workspace → suma 1 a la línea de ese producto (o crea la línea).
   - Código desconocido pero en `GlobalProduct` → propone el alta con nombre/marca precargados.
   - Código desconocido del todo → alta rápida mínima (nombre, tipo PRODUCTO/INSUMO, precio si
     es producto) sin salir de la pantalla.
3. En cada línea se ajusta cantidad y costo. Se muestra el costo anterior y, si es producto, el
   precio de venta y el margen; si el costo subió, se resalta (no cambia el precio solo).
4. **Confirmar**: valida que todas las líneas tengan producto y cantidad > 0; escribe un
   `StockMovement` `ENTRADA` por línea (convirtiendo unidad de compra a unidad de stock, con
   `unitCostArs` por unidad de stock), `sourceModule = "stock-recepcion"`,
   `sourceRef = recepcionId`; actualiza `Product.costArs` al último costo. Todo en una
   transacción. Una recepción confirmada no se edita: se corrige con un ajuste.
5. El listado de recepciones (fecha, proveedor, comprobante, total, quién) queda en la misma
   sección como historial.

El "Cargar entrada" de a un producto que ya existe en `/ventas/stock` se mantiene.

## 6. Importación con IA

Desde el borrador de recepción: **"Importar desde factura o remito"**.

Entradas aceptadas: imagen (JPG/PNG/HEIC de la foto del celular o una captura), PDF, texto
pegado, o **CSV** con la plantilla de FOTOFFICE.

### 6.1 Dentro de FOTOFFICE
1. Se sube el archivo (se guarda en R2 y queda vinculado a la recepción).
2. El servidor llama a Claude con el archivo y un prompt fijo que pide **salida estructurada**
   (JSON validado con zod) con una fila por artículo:
   `codigo_barras`, `codigo_proveedor`, `descripcion`, `cantidad`, `unidad`
   (unidad/caja/kit/rollo…), `unidades_por_paquete?`, `costo_unitario`, `alicuota_iva?`,
   `subtotal`, y a nivel documento `proveedor`, `cuit?`, `fecha`, `comprobante`,
   `precios_con_iva`, `total`.
3. Se valida: suma de subtotales contra el total del documento; si no cierra, se muestra el
   aviso arriba de la tabla (no se bloquea).
4. Las filas entran al borrador como líneas `origen = IMPORTACION`, con
   `descripcionOriginal`. La asociación con productos existentes se intenta en este orden:
   código de barras → alias de proveedor (ver abajo) → nombre parecido (sugerencia, nunca
   automática). Las no asociadas quedan marcadas para que la persona elija o dé de alta.
5. Botón **"Descargar CSV"** con la tabla tal como quedó (para archivar o corregir en una
   planilla y volver a subir).
6. Se confirma como cualquier recepción (paso 4 de §5). **La IA nunca confirma.**

**Alias de proveedor** (modelo nuevo `FotofficeAliasProveedor`: `workspaceId`, `proveedorId`,
`textoProveedor` normalizado, `productId`): cuando la persona asocia "RIBBON KODAK 305 6R
X2" a su insumo, se recuerda. La próxima factura de ese proveedor ya viene asociada.

Cliente y costos: reusar el cliente de `lib/dnx-bot/anthropic.ts`. El gasto **se cuenta dentro
del mismo tope mensual del workspace**, pero hoy `registrarUso` exige un `conversationId` de DNX
Bot: hay que permitir registrar uso sin conversación (con un `origen`, ej. "stock-importacion")
en vez de inventar conversaciones. La importación **no depende** de tener acceso a DNX Bot
(`lib/dnx-bot/acceso.ts`): alcanza con tener acceso a Ventas y la clave configurada. Modelo:
variable de entorno nueva `FOTOFFICE_STOCK_IMPORT_MODEL`, que si falta usa `FOTOFFICE_BOT_MODEL`;
no hace falta opción en pantalla. *(Decisiones del diseño.)* Límite de
tamaño de archivo y de páginas de PDF a definir por el constructor. Si falta
`ANTHROPIC_API_KEY` o se pasó el tope, la opción IA se muestra deshabilitada con el motivo y
queda disponible la importación por CSV.

### 6.2 Fuera de FOTOFFICE (el "prompt")
Para quien prefiera usar su propio ChatGPT/Claude o el sistema esté sin IA: en la misma
pantalla, **"Copiar instrucciones para la IA"** copia un prompt listo que pide devolver el CSV
exacto de la plantilla, y **"Descargar plantilla CSV"**. Lo que devuelva se sube como CSV.

### 6.3 Plantilla CSV
Separador `;` (Excel en español), UTF-8 con BOM, decimales con coma, encabezados:
`codigo_barras;codigo_proveedor;descripcion;cantidad;unidad;unidades_por_paquete;costo_unitario;alicuota_iva;tipo`
(`tipo` = PRODUCTO | INSUMO, opcional; ayuda al alta). Se acepta también `,` y punto decimal
si el archivo viene así (detectar).

## 7. Avisos de reposición

- `needsRestock` ya cubre insumos (son `Product` con `tracksStock`).
- **Días de cobertura**: consumo promedio diario de los últimos 30 días (movimientos VENTA +
  CONSUMO + PEDIDO, netos de sus DEVOLUCION) → "te alcanza para ~N días". Sin consumo en 30 días: no se estima.
- **Punto de pedido sugerido** (solo sugerencia en la ficha): consumo diario × días que tarda
  en llegar + margen. Campo opcional `leadTimeDays` en `Product`.
- En `/ventas/stock`: secciones "Para comprar" (bajo mínimo, negativos o con ≤ 7 días de
  cobertura), luego "Insumos" y "Productos". Botón "Lista para el proveedor" que agrupa lo que
  hay que comprar por proveedor y la deja lista para copiar/compartir.
- Aviso en el inicio del panel (tarjeta) para quien tiene acceso a Ventas, y una notificación
  en Bandeja **una vez** cuando un ítem cruza el mínimo (no todos los días). Correo diario: no.

## 8. Guías nuevas (Instructivos)

Sección nueva en `tipos.ts`: **"Stock"**. Todas con `moduleKey: SALES_MODULE_KEY`. Cada guía
con su `capturas/<slug>.json` (qué mostrar en cada captura) y las imágenes en
`public/instructivos/<slug>/`, tomadas de un workspace de demostración con datos de ejemplo
(kit Kodak 305, sobres de carnet, un portarretratos), nunca con datos reales de clientes.

1. **`stock-insumos-alta`** — Dar de alta un insumo y su unidad de compra (ej. Kit Kodak 305
   = 640 copias).
2. **`stock-receta-consumo`** — Armar la receta de un producto; usar "Sugerir desde
   Impresión"; ejemplo carnet = 1 copia + 1 sobre; 15x20 = 2 copias; Polaroid 7,5×10 = 1 copia
   cada 2 (y por qué 3 Polaroid gastan 2 copias).
3. **`stock-recibir-pedido`** — Recibir un pedido con el lector: borrador, escanear, cantidad,
   costo, alta rápida, confirmar.
4. **`stock-importar-factura`** — Importar una factura/remito/captura con IA, revisar,
   asociar, descargar CSV; y la variante con el prompt externo + plantilla CSV.
5. **`stock-contar-y-ajustar`** — Conteo físico y ajuste con nota (ya existe la función,
   falta la guía).
6. **`stock-avisos-y-compras`** — Leer "Para comprar", los días de cobertura y armar la lista
   para el proveedor.

El recuadro `sistema` de cada paso explica lo que FOTOFFICE hace solo (ej.: "Al cobrar una
15x20, se descuentan 2 copias del kit Kodak").

La guía existente `ventas-mostrador` se revisa: si menciona stock, agregar que también se
descuentan insumos.

## 9. Etapas sugeridas

Cada etapa sale con su guía y sus capturas en el mismo PR.

1. **Insumos y recetas**: `kind INSUMO`, `stockUnit`, unidad de compra, filtros para que no se
   vendan, `FotofficeRecetaInsumo`, descuento CONSUMO y reversión al anular, `FotofficeConsumoTamano`
   + "Sugerir desde Impresión", carga inicial de la Kodak 305 para DNX Estudio (el insumo
   "Kit Kodak 305 (copias 10x15)" con existencia **0** y los consumos 1/2/2; si la salida
   Kodak 305 o los tamaños 10x15/13x18/15x20 no existen en producción, se crean. La existencia
   real la carga el local con "Ajustar por conteo": FOTOFFICE no tiene staging y no se
   inventan cantidades). Guías 1, 2 y 5.
2. **Recepción de pedidos**: borrador, lector, alta rápida, confirmar, historial. Guía 3.
3. **Importación**: CSV + plantilla + prompt externo primero; luego IA con archivo, alias de
   proveedor. Guía 4.
4. **Avisos**: días de cobertura, "Para comprar", lista por proveedor, tarjeta de inicio y
   Bandeja. Guía 6.

Migraciones: como el resto de FOTOFFICE (a mano + `resolve`; ver
`docs/` y la práctica del repo). Los valores nuevos de `kind` y `reason` son texto, revisar si
hay CHECK en SQL que los limite.

## 10. Lo que queda a criterio del constructor

- Límites de tamaño de archivo y páginas para la IA; formato de almacenamiento del archivo.
- Algoritmo de "nombre parecido" para sugerir asociaciones.
- Diseño visual de las pantallas, respetando los componentes existentes (`fo-card`, `fo-btn`,
  `PageHeader`, `InputMoneda`).
- Auditar todos los listados de productos vendibles para excluir INSUMO.

## 11. Decisiones tomadas en este diseño (no las dijo Daniel; revisarlas)

- Insumo como `Product` con `kind = INSUMO`, no una tabla aparte.
- Cantidades enteras; fracciones → unidad más chica.
- La receta guardada es la verdad; Impresión solo la sugiere.
- Kit Kodak 305 como un solo insumo (ribbon + papel juntos), contado en copias 10x15.
- Costo del producto = último costo pagado.
- La IA nunca confirma; siempre revisión humana.
- Avisos: panel + Bandeja una vez; sin correo diario.
- Recepción no genera egreso en Caja (queda para otra etapa).
- La receta se aplica aunque el producto vendido no controle su propia existencia.
- Combos: se desarman para insumos (recursivo); la existencia de componentes no cambia.
- Gasto de IA dentro del tope mensual del workspace; importación sin depender de DNX Bot;
  modelo por variable de entorno.
- Carga inicial de la Kodak 305 con existencia 0; el conteo real lo hace el local.
