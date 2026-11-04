# Tienda: remeras de DNX Estudio producidas por Dreamful

Fecha: 04/11/2026. Pedido de Daniel: vender en la tienda online de DNX Estudio las remeras con sus
estampas, a $35.000 cada una y 2 por $60.000, con cada pedido derivado a Dreamful
(dreamful.com.ar), que las produce y las envía. Dreamful no tiene API: pide una planilla de Google
con una fila por prenda.

## Qué hay y qué falta

La tienda (etapas 1–3) ya existe. Faltan tres cosas:

1. **Elegir modelo y talle por separado.** Las variantes tienen un solo eje (`name`). Una remera
   tiene 7 modelos (oversize negra/blanca/stone wash, clásica hombre negra/blanca, clásica mujer
   negra/blanca) por 5 u 8 talles = 44 combinaciones.
2. **Promo por cantidad** ("2 por $60.000"). La tienda no tiene ninguna.
3. **Derivar el pedido al productor.** No hay nada de terceros que produzcan ni de planillas.

## Decisiones

### 1. Modelo y talle: dos ejes sin migración

- Una variante cuyo nombre es `Modelo / Talle` (por ejemplo `Oversize negra / M`) se muestra en la
  ficha como **dos grupos de botones**: Modelo y Talle. Si ninguna variante tiene ` / `, se ve
  igual que hoy.
- Al elegir un modelo, la galería salta a la foto cuyo `alt` es ese modelo (el mockup).
- `MAX_VARIANTS_PER_PRODUCT` pasa de 30 a 60.
- El carrito y el pedido siguen guardando el nombre completo de la variante.

### 2. Promo "N por $X" de la tienda

- Una promo por tienda, guardada en `StoreSettings`: `bundleCategoryId`, `bundleQty`,
  `bundlePriceArs` y `bundleLabel`. Aplica a los productos de esa categoría, mezclados entre
  diseños, modelos y talles.
- Cálculo (módulo puro `lib/store/bundle.ts`): las unidades elegibles se ordenan de mayor a menor
  precio y se agrupan de a `bundleQty`. Cada grupo completo paga `bundlePriceArs` si eso es menor
  que su suma. Las que sobran pagan precio de lista. Con 3 remeras: 60.000 + 35.000.
- `StoreOrder.discountArs` nuevo. `subtotalArs` sigue siendo la suma de las líneas, y
  `totalArs = subtotal − descuento + envío`. La comisión de DNX se calcula sobre
  `subtotal − descuento`. La `Sale` registra el descuento en `discountArs`, que ya existe.
- El carrito muestra el descuento. El servidor lo recalcula al crear el pedido, porque el cliente
  sólo muestra.

### 3. Productor (dropshipping)

- `ProductStoreListing.fulfillmentProveedorId` indica quién produce el producto (un
  `FotofficeProveedor`, por ejemplo «Dreamful»). `ProductStoreListing.printFileUrl` es el enlace
  al archivo para estampar. `ProductVariant.printFileUrl` lo pisa por variante, para las estampas
  que cambian según el color de la remera.
- Al crear el pedido, cada línea copia `sku`, `fulfillmentProveedorId`, `printFileUrl` y la foto
  del modelo (el boceto). Así el pedido no cambia aunque después se edite el catálogo.
- `StoreOrderItem.fulfillmentSentAt` registra cuándo se pasó al productor.
- **Planilla en vivo sin API de Google:** cada productor tiene un enlace CSV secreto
  (`FotofficeProveedor.ordersFeedToken`). En Google Sheets se pega
  `=IMPORTDATA("https://…/api/tienda/productor/<token>.csv")` y la planilla se actualiza sola,
  aproximadamente una vez por hora. Se comparte con Dreamful.
  - Las columnas son las que pidió Dreamful: Id del pedido, Número de pedido, Sku, Nombre de la
    prenda, Cantidad, Talle, Link del drive, Etiqueta de envío.
  - Se agregan otras para que puedan despachar: Boceto, Fecha de pago, Cliente, Teléfono, Entrega,
    Dirección, Estado.
  - Se incluyen los pedidos pagados (PAID, READY, SHIPPED, DELIVERED) de los últimos 60 días.
- Página **Ventas → Tienda → Productores**:
  - enlace para la planilla;
  - descarga del CSV;
  - lista de pendientes con el botón «Ya se lo pasé al productor»;
  - botón para regenerar el enlace secreto.
- **Etiqueta de envío Andreani:** hoy la integración sólo cotiza y no genera etiquetas. La columna
  lleva el número de seguimiento si se cargó, y si no, queda vacía. Hay que acordar con Dreamful
  quién genera la etiqueta.

## Carga del catálogo (script)

- Script `scripts/tienda-cargar-remeras.ts`. Por defecto sólo muestra lo que haría; con
  `--aplicar` escribe. Es idempotente por SKU.
- Crea:
  - la categoría «Remeras»;
  - el proveedor «Dreamful»;
  - 9 productos (uno por diseño) con 44 variantes, sin control de stock;
  - las fotos de los 7 mockups subidas a R2;
  - la promo 2 × $60.000.
- SKU: `DNX-<DISEÑO>-<MODELO>-<TALLE>`, por ejemplo `DNX-CFLAG-OVN-M`.
- Precio $35.000 en todos los modelos. El costo de Dreamful (1 estampa) va en `costArs` del
  producto según el modelo más caro (stone wash $18.470). Margen aproximado: $16.500 por remera
  suelta y $23.000 por cada par en promo.

## Fuera de esta etapa

- Intermediación para otros workspaces (comisión de DNX por remera).
- Bolsa de FOTOFFICE en el paquete.
- Escritura directa en Google Sheets por API.
