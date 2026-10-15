# Ventas: productos, servicios, stock y la caja de kiosco

**Fecha:** 2026-09-14
**Aplicación:** FotoOffice (`apps/fotoffice`)
**Estado:** diseño acordado. Sin una línea de código escrita.
**Etapa:** 1b del plan de negocio. Continúa
`2026-09-13-negocio-caja-ventas-servicio-tecnico-y-club-design.md`, §7.

---

## 1. Qué se construye y por qué

La etapa 1a le dio a FotoOffice un libro de dinero y un padrón de clientes. Esto le da lo
que se vende: **un catálogo de productos y servicios, sus existencias, y una pantalla de
mostrador para cobrar**.

El pedido, textual: *"la caja tendría que ser como una caja de un kiosco que consulta
productos y servicios y que se cargan ahí"*.

DNX Estudio vende portarretratos, bolsos y trípodes —mercadería con existencia física— y
también impresiones y cuadros tercerizados, que no se stockean porque se encargan cuando el
cliente los pide. El servicio técnico vende reparaciones y repuestos. La sociedad, cuando
abra atención al público, venderá algo que todavía no está decidido.

**Los tres casos entran en el mismo módulo**, y el módulo se enciende por workspace como
todos los demás.

## 2. Decisiones tomadas

Acordadas en conversación el 2026-09-14.

1. **La pantalla no cobra: registra cómo se cobró.** Nada de integración con Mercado Pago en
   el mostrador. El vendedor cobra por fuera —efectivo, el QR fijo que ya está pegado, una
   transferencia— y elige el medio en la pantalla. Ver §5.4.
2. **El stock está desde el primer día.** Es la razón principal por la que un negocio con
   trípodes quiere esto: saber si le queda. Ver §4.
3. **SFPR queda para más adelante.** Se construye para DNX Estudio y el servicio técnico; la
   sociedad lo enciende cuando decida qué vende. Esto corrige al diseño anterior, que daba
   por sentado que SFPR no lo usaría nunca.
4. **Un servicio es un producto sin existencia física.** Una sola tabla, dos interruptores.
   Ver §3.1.
5. **Los productos llevan foto y código.** La foto porque en un mostrador se elige mirando,
   no leyendo; el código porque tipearlo es más rápido que buscar por nombre. Ver §3.2 y §5.2.
6. **Vender nunca se bloquea por falta de stock.** Avisa y deja seguir. Ver §4.3.
7. **Hay un catálogo maestro compartido por toda la suite**, con el código de barras como
   llave. Guarda identidad —nombre, marca, foto— y **nunca precio, costo ni stock**. Ver §3.3.
8. **El lector de código de barras no se integra: se enchufa.** Es un teclado. Ver §3.5.

## 3. El catálogo

### 3.1 Productos y servicios, una sola tabla

Dos interruptores por producto resuelven los tres casos:

- **`kind`**: `PRODUCTO` o `SERVICIO`. No cambia ninguna regla — sirve para agrupar en la
  pantalla y para que el reporte pueda decir cuánto se facturó de cada cosa. Un negocio que
  vende las dos quiere ver esa línea separada.
- **`tracksStock`**: el trípode sí; la impresión tercerizada, la sesión de fotos y el
  alquiler, no.

Son independientes a propósito. Un servicio nunca controla stock, pero **un producto
tampoco tiene por qué hacerlo**: el cuadro que se encarga al laboratorio es un producto y no
se stockea. Atar una cosa a la otra obligaría a mentir en uno de los dos campos.

```
Product
  workspaceId, categoryId?
  kind: "PRODUCTO" | "SERVICIO"
  sku?               — código corto. Único dentro del workspace cuando está
  name, description?
  priceArs           — lo que se cobra
  costArs?           — lo que cuesta. De ahí sale el margen
  tracksStock: bool
  stockQty           — copia; la verdad es la suma del libro de movimientos
  minStockQty?       — por debajo de esto, el catálogo lo marca
  imageUrl?          — la foto, en R2
  supplierName?      — texto libre. Proveedores no es una entidad, y no lo será en esta etapa
  isActive           — se desactiva, no se borra: las ventas viejas lo siguen nombrando
  createdAt, updatedAt

ProductCategory
  workspaceId, name, order, isActive
```

**Alta, edición y baja son parte del módulo**, igual que las categorías. Un catálogo que no
se puede editar no es un catálogo. Un producto no se borra nunca: se desactiva, porque las
ventas del año pasado lo siguen nombrando y borrarlo dejaría renglones huérfanos.

### 3.2 La foto y el código

**La foto** reusa la maquinaria que ya existe y está probada: `lib/images/` —cliente de R2,
validación, política de claves y presets— más el componente `ImageUploadField` y la ruta
`/api/uploads/image`. No se construye nada nuevo para esto; se le agrega un preset con el
tamaño que la pantalla de mostrador necesita.

**El código (`sku`)** es único dentro del workspace cuando está cargado, y opcional cuando
no. Su valor real está en §5.2: tipear `TRP-12` es más rápido que buscar "trípode" entre
cuarenta productos, y es lo que permite trabajar con un lector de códigos el día que haya uno.

### 3.3 El código de barras y el catálogo universal

Hay **dos códigos distintos** y conviene no confundirlos:

- **`sku`** — el código interno del negocio. Se lo inventa cada uno. Único dentro del
  workspace, opcional.
- **`barcode`** — el código de barras del fabricante, el que viene impreso en la caja. Es
  **universal**: el mismo portarretratos tiene el mismo número en Rosario y en Tokio.

Ese segundo código habilita algo que ningún negocio puede hacer solo: **un catálogo maestro
compartido por toda la suite.**

```
GlobalProduct        — NO lleva workspaceId. Es de todos.
  barcode            — único en todo el sistema. Es la llave
  name, brand?, description?
  imageUrl?
  createdByWorkspaceId    — quién lo cargó primero. Para poder preguntarle
  createdByUserId, createdAt, updatedAt
```

Y en el producto del workspace se agrega:

```
Product
  ...
  barcode?            — el código universal, cuando lo tiene
  globalProductId?    — la ficha maestra de la que salieron nombre, marca y foto
```

**Cómo funciona en la práctica.** Alguien da de alta un portarretratos VGO, escanea el
código y completa nombre, marca y foto. Eso queda en el catálogo maestro. Meses después,
otro negocio de la suite escanea el mismo código en su pantalla de alta: **el formulario se
completa solo** con el nombre, la marca, la descripción y la foto. Sólo le queda poner su
precio.

### 3.4 La regla que hace que esto sea seguro

**El precio, el costo y el stock NUNCA salen del workspace.** Lo que se comparte es la
identidad de la cosa —qué es, cómo se llama, de qué marca, cómo se ve—, nunca lo que cada
negocio hace con ella. Cuánto cobra cada uno es su negocio y de nadie más.

Es la primera tabla de todo FotoOffice que **no lleva `workspaceId` a propósito**, y por eso
la regla se escribe acá y se prueba: el catálogo maestro guarda identidad, no comercio.

**Y el catálogo maestro sugiere, nunca manda.** Al dar de alta un producto, la ficha global
**precarga** el formulario y después el negocio edita lo que quiera. Lo que quede guardado
en `Product` es lo que manda localmente, siempre. Si mañana alguien corrige mal la ficha
global, ningún negocio ve cambiar su propio catálogo.

Esa asimetría es deliberada: sin ella, un error de un desconocido renombraría productos en
mostradores ajenos.

**Quién puede escribir.** En esta etapa, el primero que carga un código de barras que no
existe crea la ficha, y el resto la lee. Sin curaduría, sin moderación y sin ediciones
cruzadas: quien quiera corregir algo lo corrige en su propio catálogo, que es el que usa.

Es deliberadamente pobre. Una ficha maestra editable por cualquiera necesita moderación,
historial y forma de resolver discusiones — todo un proyecto, y no sabemos todavía si el
catálogo se va a llenar. **Si se llena, ahí vale la pena.** Mientras tanto, la asimetría de
arriba hace que el daño de una ficha mala sea "el formulario se precargó con un nombre feo",
no "me cambiaron el catálogo".

### 3.5 El lector de código de barras

**No hace falta integrar nada.** Un lector USB o Bluetooth se comporta como un teclado: tipea
el número y manda Enter. Con la regla de §5.2 —si el texto coincide exactamente con un
código, el producto se agrega sin pasar por la lista— un lector funciona el día que se
enchufe, tanto en la caja de kiosco como en el alta de producto.

Lo único que hay que respetar es que el campo de búsqueda **esté enfocado por omisión** y que
Enter no haga otra cosa. Eso es todo lo que separa "anda con lector" de "no anda".

## 4. El stock

### 4.1 La existencia es un libro, no un número

```
StockMovement
  workspaceId, productId
  qty                  — firmado: la venta resta, la entrada suma
  reason: "VENTA" | "ENTRADA" | "AJUSTE" | "DEVOLUCION" | "INICIAL"
  unitCostArs?         — en las entradas: lo que costó esa vez
  sourceModule?, sourceRef?    — la venta que lo movió
  note?                — obligatoria de hecho en los ajustes
  createdByUserId, createdAt
```

La existencia es la **suma de la columna**; el campo en `Product` es una copia que se
recalcula. Es el mismo patrón que ya usan el libro de comisiones, el de caja y el de puntos
del Club: **el número que se muestra siempre se puede reconstruir desde los asientos**.

### 4.2 Entrada de mercadería, sin documento de compra

Se carga **por producto**: cantidad, costo unitario y una nota. El pago al proveedor se
anota en Caja como cualquier otro egreso.

**No hay tabla de compras ni remito.** Un negocio chico ya anota lo que le pagó al
proveedor; obligarlo además a armar un documento de compra es ceremonia que termina en que
nadie carga nada. Si algún día la compra necesita ser un documento —porque hay que
conciliar con una factura— se agrega sabiendo para qué.

### 4.3 Vender nunca se bloquea

**Si el sistema dice cero y el producto está sobre el mostrador, la venta se hace igual.** La
pantalla avisa, y sigue.

Un kiosco que no deja vender porque un número está mal es un kiosco roto, y ese número está
mal más seguido de lo que uno quisiera: llegó mercadería sin cargar, alguien se llevó algo
sin anotarlo, el conteo inicial salió torcido. El faltante se corrige contando, no
impidiendo vender.

La existencia puede quedar negativa, y eso **es información**: significa que falta cargar
una entrada. El catálogo lo muestra en rojo.

### 4.4 El ajuste por conteo

Contar la mercadería y cargar el número real. La diferencia se escribe como un asiento
`AJUSTE` **con nota obligatoria**, igual que una diferencia de caja: un ajuste sin
explicación no se entiende tres meses después.

## 5. La caja de kiosco

### 5.1 La forma de la pantalla

Dos mitades.

**A la izquierda se busca y se agrega**: un campo de búsqueda que mira nombre y código a la
vez, y debajo una grilla de productos con su foto, su nombre y su precio. Un clic los suma
al ticket.

**A la derecha está el ticket**: los renglones con cantidad y precio, el subtotal, el
descuento y el total, siempre a la vista. Abajo, el botón de cobrar.

### 5.2 Lo que la hace usable de verdad

- **El buscador mira nombre y código.** Tipear `TRP-12` y que entre solo es la diferencia
  entre usarlo y no usarlo. Si el texto coincide **exactamente** con un código, el producto
  se agrega directamente sin pasar por la lista — que es lo que permite trabajar con un
  lector de códigos el día que haya uno.
- **El precio del renglón se puede pisar.** Una ampliación cuesta distinto según el tamaño;
  obligar a crear un producto por cada medida haría que nadie lo use. El precio del catálogo
  es la sugerencia, no la ley. Lo que se pisó queda registrado en el renglón.
- **El cliente es opcional.** Hay quien compra y no quiere dar datos. Cuando sí se
  identifica, esa venta después alimenta los puntos del Club (etapa 3), y por eso se busca
  con la misma puerta única que ya usa el resto del sistema.
- **Un renglón suelto, sin producto.** Para lo que se vende una vez y no merece estar en el
  catálogo. Lleva descripción y precio escritos a mano, y no mueve stock.

### 5.3 La venta, en un solo acto

```
Sale
  workspaceId, saleNumber     — correlativo por workspace
  clientId?
  occurredAt
  status: "COMPLETADA" | "ANULADA"
  subtotalArs, discountArs, totalArs
  paymentMethod               — EFECTIVO | MERCADO_PAGO | TRANSFERENCIA | TARJETA | OTRO
  cashMovementId              — el ingreso que generó
  note?
  externalInvoiceRef?         — "Factura C 0001-00000123", cuando se facturó por fuera
  invoiceId?                  — la factura de FotoOffice, desde la etapa 6
  createdByUserId

SaleItem
  saleId, productId?          — nulo en un renglón suelto
  description                 — instantánea: la venta se lee igual si el producto se renombra
  qty, unitPriceArs, unitCostArs?, lineTotalArs
  priceWasOverridden: bool
```

Cobrar hace **tres cosas en la misma transacción, o no hace ninguna**:

1. escribe la venta y sus renglones,
2. **crea el ingreso en Caja** con el medio de pago elegido,
3. **descuenta el stock** de los renglones que lo controlan.

Una venta registrada sin su ingreso dejaría el libro mintiendo; un ingreso sin su venta
dejaría plata sin explicación.

### 5.4 A qué cuenta va la plata

El medio de pago elegido decide la cuenta, con el mismo criterio que ya usa el depósito
automático de cuotas y reservas (`lib/cash/auto-deposit.ts`): lo cobrado en mano va a una
cuenta de efectivo, lo digital a una digital, y **nunca a la caja fuerte**.

Si hay un turno abierto en esa cuenta, el movimiento se imputa solo — eso ya lo resuelve
`recordCashMovement` y no hay que hacer nada.

### 5.5 Anular no borra

Anular una venta **devuelve el stock** y **escribe un contramovimiento en Caja**. Los dos
asientos quedan a la vista, igual que en el resto del módulo, y la venta queda marcada como
anulada en lugar de desaparecer.

Exige motivo. Y una venta anulada no se vuelve a anular.

## 6. El margen

Como cada renglón guarda **lo que se cobró y lo que costó**, el reporte de margen sale casi
sin trabajo extra: cuánto se vendió, cuánto costó y cuánto quedó, por producto y por período.

El costo se copia al renglón en el momento de vender, no se lee del producto al hacer el
reporte. Si el costo del trípode sube el mes que viene, la venta del mes pasado tiene que
seguir mostrando el margen que de verdad tuvo.

El reporte vive en la pantalla de reportes de Caja, que ya existe, como una sección más.

## 7. Cómo se conecta

```
   CATÁLOGO ──────────┐
   productos, servicios│
   stock, fotos        │
                       ▼
   CLIENTES ───► CAJA DE KIOSCO ───► CAJA ───► (CLUB, etapa 3)
   (opcional)     la venta          el ingreso   los puntos
                       │
                       └──► STOCK (descuenta)
```

Nada de esto es nuevo: **la venta entra por las mismas puertas que ya usan los otros
módulos.** El cliente se busca con `findOrCreateClient`, la plata se deposita con
`recordCashMovement`, y el ingreso queda atribuido al cliente para que el Club lo lea el día
que exista.

## 8. Fuera de alcance

- **Cobro por Mercado Pago desde la pantalla.** Decidido en §2.1.
- **Facturación.** Sigue siendo la etapa 6. Lo único que entra acá es el campo para anotar
  a mano el comprobante emitido por fuera.
- **Documento de compra y proveedores como entidad.** Ver §4.2.
- **Fiado y cuentas corrientes**, FIFO o costo promedio ponderado, depósitos múltiples,
  variantes de producto (talle, color), promociones y combos, y tienda en línea.
- **Curaduría del catálogo maestro:** moderación, edición cruzada, historial de cambios,
  reportar una ficha mala o fusionar duplicados. Ver §3.4: el primero que carga un código
  crea la ficha y el resto la lee. Si el catálogo se llena, ahí vale la pena.
- **Devolución parcial de una venta.** Se anula entera y se vuelve a cargar. Partir una
  devolución trae proporciones de descuento que no valen la pena en esta etapa.

## 9. Las dos mitades

Las dos salen juntas, pero construidas en este orden: si la venta no anda, el stock no
importa.

| | Qué queda funcionando |
|---|---|
| **1b-1** | Catálogo con precio, costo, foto, código interno y código de barras; alta, edición y baja; el catálogo maestro precargando el alta; la caja de kiosco vendiendo con lector; la plata cayendo en Caja; el reporte de margen |
| **1b-2** | Existencias, entrada de mercadería, ajuste por conteo, alerta de faltante y la devolución del stock al anular |

## 10. Riesgos

1. **Cinco tablas nuevas en un esquema compartido por cinco aplicaciones.** Hay que
   aplicarlas a mano y registrarlas en cada base, con el procedimiento del checksum. Y hay
   que recordar que **InfoSpot y los dos staging de CLF y Clickatón no tienen el dominio de
   FOTOFFICE**, así que quedan afuera, como en la etapa 1a.
2. **La migración va antes que el código**, no después. Es la lección más cara de la etapa
   1a: un despliegue con las tablas ausentes volteaba el cobro de cualquier workspace.
3. **El catálogo maestro es la primera tabla sin `workspaceId` de todo FotoOffice.** Todo el
   resto del sistema asume aislamiento por institución, y acá se rompe a propósito. La
   revisión tiene que verificar una por una que ninguna consulta filtre datos de un negocio
   por ese camino, y que precio, costo y stock no aparezcan nunca en la ficha compartida.
4. **La pantalla de mostrador se usa con gente esperando.** Si es lenta o confusa, no se usa
   y el negocio vuelve al cuaderno. Es la única parte de este módulo donde la velocidad
   percibida importa más que la completitud.

## 11. Preguntas abiertas

1. **¿La venta necesita imprimir o compartir un comprobante para el cliente?** No un
   comprobante fiscal —eso es la etapa 6— sino un ticket simple. Si hace falta, conviene
   saberlo antes de la 1b-1 porque cambia dónde termina el flujo de cobro.
2. **¿Qué va a vender SFPR?** Sin respuesta todavía, y no bloquea: el módulo queda listo
   para el día que lo enciendan.
