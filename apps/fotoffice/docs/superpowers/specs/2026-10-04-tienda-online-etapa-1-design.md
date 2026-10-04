# Tienda online de FOTOFFICE — Etapa 1: tienda base

**Fecha:** 2026-10-04 · **Estado:** diseño aprobado en conversación, pendiente de revisión escrita
**Depende de:** Ventas (PR 156, `feat/fotoffice-ventas`), puesto al día con `main` el 2026-10-04.

## 1. Qué problema resuelve

Hoy FOTOFFICE vende sólo en el mostrador: el módulo Ventas registra lo que se cobró en persona.
La institución no tiene cómo vender por internet una remera, un libro o una impresión. Las specs
anteriores la dejaron afuera a propósito (`2026-09-13-negocio-caja-...` §14,
`2026-09-20-sitio-publico-website-design.md` "No entra"). Esta spec la incorpora.

**Idea central:** un producto es uno solo y se puede vender en el **mostrador**, en la **tienda
online** o en **ambos**. Hay **un solo stock**. Toda venta online termina siendo una `Sale` más,
que entra sola a Caja y descuenta el mismo inventario que el mostrador.

## 2. Mapa completo (para ubicar esta etapa)

| Etapa | Contenido | Spec |
|---|---|---|
| 0 | Ventas (PR 156) al día con `main` y fusionado | — (hecho el merge 2026-10-04) |
| **1** | **Tienda base** (esta spec) | esta |
| 2 | Envío a domicilio con costo calculado por correo + recargo de logística | propia |
| 3 | Obras de concursos FotoRank: vínculo workspace ↔ organización, permiso del autor obra por obra, formatos (impresión/cuadro/tamaños), control de resolución, regalías, pedido al laboratorio | propia |
| 4 | Extras: edición limitada numerada con certificado, precio socio, preventa (libro del concurso), gift cards, descarga digital con licencia, cupones y combos, subasta solidaria, "avisame cuando vuelva", carrito abandonado, pago por transferencia | propia(s) |
| aparte | **Módulo Eventos** (cenas, charlas, muestras): entradas por tipo con cupo, preguntas al comprador, QR en puerta (reutilizando la acreditación de Clickatón), lista de espera. **No** va dentro de la tienda | propia |

La etapa 1 ya deja preparado lo que 2 y 3 necesitan (peso y medidas del producto; un renglón de
pedido que sabe de qué variante viene) sin construirlo.

## 3. Alcance de la etapa 1

**Entra**

1. **Canal por producto:** mostrador, online o ambos.
2. **Variantes (talles):** cada variante tiene su stock, su SKU/código de barras opcional y un
   precio **opcional** (si no tiene, hereda el del producto; así el XXL puede costar más).
3. **Tabla de talles:** una imagen por producto, visible en la ficha online cuando hay talles.
4. **Galería:** varias fotos por producto (la primera es la principal).
5. **Vitrina pública** en el sitio de la institución: `/w/[slug]/tienda`, con categorías.
6. **Ficha de producto**, **carrito** y **checkout** sin crear cuenta (nombre, email, teléfono).
7. **Cobro con Mercado Pago** con la cuenta de la institución y la comisión de DNX retenida en la
   misma operación (mismo circuito que cuotas, reservas y cursos).
8. **Reserva de stock** mientras la persona paga (15 minutos), sin vender dos veces lo último.
9. **Entrega: retiro en la sede.** Dirección, horarios e instrucciones configurables.
10. **Pedidos en el panel:** lista, detalle y cambio de estado (preparando → listo para retirar →
    entregado), cancelación.
11. **Correos al comprador:** compra confirmada y "tu pedido está listo para retirar".
12. **Página del pedido** con enlace privado, para que el comprador siga su pedido sin cuenta.
13. **Botón de arrepentimiento** y política de cambios y devoluciones, obligatorios para la venta
    online en Argentina (Res. SCI 424/2020). Texto configurable con uno por defecto.
14. **Conciliación:** una tarea programada vuelve a preguntarle a Mercado Pago por los pedidos
    pendientes, para no depender sólo del aviso.

**No entra** (va en etapas siguientes): envío a domicilio, obras de concursos, cupones, precio
socio, transferencia, gift cards, facturación electrónica, combos, varias sucursales de retiro.

## 4. Decisiones (y por qué)

| # | Decisión | Por qué |
|---|---|---|
| D1 | Módulo nuevo `store` ("Tienda online") que **requiere** `sales` y `website` | Se enciende por institución como cualquier módulo; su comisión se configura aparte en `WorkspaceModuleFee` con la llave `store`. |
| D2 | Los datos de tienda de un producto viven en una tabla nueva `ProductStoreListing` (1 a 1), **no** como columnas nuevas de `Product` | Sin ficha = sólo mostrador, que es exactamente el comportamiento de hoy. No hay que tocar las filas existentes. |
| D3 | El canal se guarda en la ficha: `sellOnline` y `sellAtCounter` (por omisión `true`) | Un producto sin ficha sigue vendiéndose en mostrador como siempre. Un producto "sólo online" no aparece en el buscador del mostrador. |
| D4 | Variantes en tabla nueva `ProductVariant`. Si un producto tiene variantes, **su stock vive en las variantes** y `Product.stockQty` pasa a ser la suma (copia mantenida en la misma transacción) | Igual que hoy `stockQty` es copia de los movimientos. El mostrador pide elegir talle cuando el producto tiene variantes; el lector de código de barras encuentra la variante directo si tiene su propio código. |
| D5 | `SaleItem` y `StockMovement` suman `variantId` opcional | Para saber qué talle se vendió y de qué talle salió el stock. Columnas nulas: las filas viejas no cambian. |
| D6 | En el mostrador vender **nunca** se bloquea por stock (regla 2 de Ventas, se mantiene). **Online sí se bloquea:** se puede comprar sólo lo disponible = stock − reservas activas | En persona la cosa está en la mano; por internet, vender lo que no hay es una promesa rota. |
| D7 | La reserva no usa una columna `reservedQty`: se calcula sumando los renglones de pedidos `PENDING_PAYMENT` no vencidos, **bajo bloqueo de la fila** del producto/variante (`SELECT … FOR UPDATE`) | Evita una copia más que pueda desincronizarse; el bloqueo hace imposible que dos compradores se lleven la última unidad. |
| D8 | Al acreditarse el pago se crea la `Sale` con `recordSale` (método `MERCADO_PAGO`), que deposita en Caja (cuenta DIGITAL) y descuenta stock, todo en una transacción. `StoreOrder.saleId` apunta a esa venta | Una sola forma de vender. Los reportes de Ventas, margen y Caja ya cuentan la venta online sin cambios. |
| D9 | **Pago que llega tarde** (el pedido ya venció): si todavía hay stock, se acepta y el pedido sigue normal; si no, el pedido queda `PAID_NO_STOCK`, se avisa al panel y por correo a la institución para devolver o reponer | Es el bug que tiene Clickatón: la plata cobrada sobre un pedido muerto, sin alerta. Acá nunca se pierde un pago. |
| D10 | Webhook propio `/api/payments/mp/tienda-webhook`, referencia externa con prefijo `store:` | Mismo criterio que reservas: un error en la tienda no puede romper el cobro de cuotas. |
| D11 | Carrito en el navegador (localStorage), revalidado contra el servidor antes de pagar. Se porta el de Clickatón (`lib/public-store/cart/*`) | Es lógica pura, probada (47 pruebas), y no necesita cuenta. |
| D12 | Pedido con `publicId` (`ped_…`) y token de acceso guardado como hash; el enlace va en el correo | El comprador ve su pedido sin cuenta; nadie adivina pedidos ajenos. |
| D13 | El comprador queda como `Client` vía `findOrCreateClient` si el módulo Clientes está encendido | Única puerta al padrón. Si está apagado, el pedido guarda los datos de contacto igual. |
| D14 | Precios en pesos (Decimal) como en Ventas; los montos se congelan en el pedido (precio, nombre, talle, imagen) | Si mañana cambia el precio, el pedido de ayer no cambia. |
| D15 | Peso (g) y medidas (cm) se cargan en la ficha desde ya, opcionales | Los va a necesitar la etapa 2 para cotizar el envío. |

## 5. Modelo de datos

Todo en `packages/db/prisma/schema.prisma`, migración nueva `20261004200000_store_base` (tablas nuevas +
dos columnas nulas). Se aplica a mano en las 4 bases con `Workspace`/`Client`, **antes** de
desplegar el código, y se registra con su checksum.

```prisma
model ProductStoreListing {
  id               String   @id @default(cuid())
  workspaceId      String
  productId        String   @unique
  sellOnline       Boolean  @default(false)
  sellAtCounter    Boolean  @default(true)
  slug             String              // único por workspace
  onlineTitle      String?             // si falta, el nombre del producto
  onlineDescription String?            // texto largo de la ficha
  sizeChartImageUrl String?
  weightGrams      Int?
  lengthCm         Int?
  widthCm          Int?
  heightCm         Int?
  maxPerOrder      Int?                // tope por compra, opcional
  sortOrder        Int      @default(0)
  createdAt/updatedAt
  @@unique([workspaceId, slug])
  @@index([workspaceId, sellOnline])
}

model ProductImage {
  id, workspaceId, productId, url, alt?, sortOrder, createdAt
  @@index([productId, sortOrder])
}

model ProductVariant {
  id, workspaceId, productId
  name        String     // "S", "M", "XL", "Único"
  sku         String?    // @@unique([workspaceId, sku])
  barcode     String?    // @@unique([workspaceId, barcode])
  priceArs    Decimal?   // null = hereda el del producto
  stockQty    Int @default(0)  // copia de la suma de StockMovement de la variante
  isActive    Boolean @default(true)
  sortOrder   Int @default(0)
}

// columnas nuevas, nulas:
SaleItem.variantId       String?
StockMovement.variantId  String?

model StoreSettings {            // 1 por workspace
  workspaceId @unique
  pickupAddress, pickupHours, pickupInstructions   String?
  returnsPolicy String?          // texto de cambios y devoluciones
  notifyEmail   String?          // a quién avisar de pedidos nuevos
  isOpen        Boolean @default(false)  // la tienda está publicada
}

model StoreOrder {
  id, workspaceId
  publicId        String @unique        // ped_xxxx
  orderNumber     Int                   // correlativo por workspace, @@unique([workspaceId, orderNumber])
  accessTokenHash String
  status          StoreOrderStatus
  buyerName, buyerEmail, buyerPhone
  clientId        String?
  memberId        String?               // si compró con sesión de socio
  deliveryMethod  String  // "PICKUP" (etapa 2 suma "SHIPPING")
  subtotalArs, shippingArs (0), totalArs   Decimal
  feeBps Int, feeArs Decimal            // congelados al crear la preferencia
  holdExpiresAt   DateTime?
  mpPreferenceId, mpPaymentId  String?
  paidAt, readyAt, deliveredAt, cancelledAt  DateTime?
  saleId          String? @unique       // la Sale creada al acreditar
  legalAcceptedAt DateTime, legalVersion String
  clientIdempotencyKey String           // @@unique([workspaceId, clientIdempotencyKey])
  internalNote    String?
}

enum StoreOrderStatus {
  PENDING_PAYMENT  // con reserva de stock vigente
  PAID             // cobrado, a preparar
  READY            // listo para retirar
  DELIVERED
  CANCELLED        // antes de pagar, o anulado por la institución
  EXPIRED          // venció la reserva sin pago
  PAID_NO_STOCK    // pagó tarde y ya no había stock: requiere acción
}

model StoreOrderItem {
  id, orderId, productId?, variantId?
  productName, variantName?, imageUrl?, productSlug   // copias
  qty Int, unitPriceArs Decimal, lineTotalArs Decimal
}

model StoreOrderEvent {     // historial: quién cambió qué y cuándo
  id, orderId, fromStatus?, toStatus, actorUserId?, note?, createdAt
}
```

## 6. Flujos

### 6.1 Compra

1. Vitrina → ficha → elige talle y cantidad → "Agregar al carrito".
2. Carrito → "Finalizar compra": el servidor revalida precios y disponibilidad (`validateCart`).
3. Checkout: datos del comprador, retiro en sede (se muestran dirección y horarios), acepta
   términos y política de devoluciones → `createStoreOrder`:
   - idempotente por `clientIdempotencyKey` (doble clic = mismo pedido);
   - límite: 3 pedidos pendientes por email;
   - en una transacción: bloquea las filas de stock, verifica disponibilidad, crea el pedido
     `PENDING_PAYMENT` con `holdExpiresAt = ahora + 15 min`.
4. `startStoreCheckout` arma la preferencia de Mercado Pago (token de la institución,
   `marketplace_fee`, referencia `store:<id>`), congela `feeBps/feeArs`, y redirige.
5. Vuelta a `/w/[slug]/tienda/pedido/[publicId]?t=…`: la página **sólo consulta**; si el pedido
   sigue pendiente, consulta a Mercado Pago (como hace la conciliación) antes de mostrar.

### 6.2 Acreditación (`creditStorePayment`, idempotente)

- Ya `PAID`/`READY`/`DELIVERED` → aviso repetido, no hace nada.
- `PENDING_PAYMENT` (vigente o vencido sin procesar) o `EXPIRED`:
  bloquea stock; si alcanza → `PAID`, crea la `Sale` con `recordSale`, guarda `saleId`, asienta
  la comisión como en reservas, alta de `Client`, correo al comprador y aviso a la institución.
  Si no alcanza → `PAID_NO_STOCK` + aviso urgente a la institución (D9).
- `CANCELLED` → `PAID_NO_STOCK` igual: hay plata que devolver.

### 6.3 Vencimiento y conciliación

Tarea `/api/cron/tienda` cada 15 minutos:
1. Pedidos `PENDING_PAYMENT` con reserva vencida: primero pregunta a Mercado Pago por la
   referencia; si está aprobado, acredita; si no, pasa a `EXPIRED` (libera la reserva).
2. Se agrega a `vercel.json` en el mismo PR (el olvido de Clickatón).

### 6.4 Panel

- `/ventas/tienda` — pedidos con filtro por estado, alerta destacada para `PAID_NO_STOCK`.
- `/ventas/tienda/[orderId]` — detalle, renglones, comprador, historial, botones de estado.
  Marcar `READY` dispara el correo "listo para retirar".
- `/ventas/tienda/configuracion` — retiro, política de devoluciones, email de avisos, abrir/cerrar
  la tienda, y un enlace al sitio.
- En la ficha del producto (`/ventas/catalogo/[id]`): sección **Dónde se vende**
  (mostrador/online), **Tienda online** (slug, título, descripción, peso y medidas, tope por
  compra), **Fotos** (galería) y **Talles** (variantes + imagen de tabla de talles).
- Mostrador: si el producto tiene variantes, al agregarlo pide elegir talle; muestra las
  unidades reservadas online como dato.

Permisos: ver pedidos y cambiar su estado = nivel `MANAGE` en `store`. Configurar la tienda =
acción nueva `store.configure`. Editar la ficha online de un producto = `sales.catalog`.

### 6.5 Sitio público

Rutas bajo `app/w/[workspaceSlug]/tienda/`: `page.tsx` (vitrina, filtro por categoría),
`[productSlug]/page.tsx`, `carrito/page.tsx`, `checkout/page.tsx`,
`pedido/[publicId]/page.tsx`, `arrepentimiento/page.tsx`. Se agrega la entrada en
`PUBLIC_MODULE_PAGES` (`segment: "tienda"`, `label: "Tienda"`, `order: 35`). Con
`StoreSettings.isOpen = false` la vitrina responde 404 y no aparece en el menú.

## 7. Errores y casos borde

- Producto desactivado o sin stock mientras está en un carrito → la revalidación lo marca y
  no deja pagar ese renglón.
- Precio cambió entre carrito y pago → se muestra el nuevo antes de confirmar.
- La institución no conectó Mercado Pago → la tienda no se puede abrir (se valida al abrirla y
  al cobrar, con mensaje para el comprador que no lo culpa).
- Anular desde el panel un pedido `PAID` → anula la `Sale` con `voidSale` (revierte Caja y
  stock) y marca `CANCELLED`; la devolución de la plata se hace en Mercado Pago (se indica).
- Ningún dato personal completo en logs.

## 8. Pruebas

- Unitarias: transiciones de estado, cálculo de disponibilidad, precios con variante,
  idempotencia, parseo de referencia externa, carrito (portado con sus pruebas).
- De integración con la base de prueba: dos compras concurrentes por la última unidad (una sola
  gana), pago tardío con y sin stock, acreditación repetida, cron de vencimiento.
- Invariantes de código, como ya hace FOTOFFICE: la tienda nunca escribe `Sale` sin
  `recordSale`; el webhook de la tienda no toca `MembershipPayment`.
- Manual antes de abrir a una institución: una compra real de punta a punta en una institución
  de prueba con Mercado Pago conectado (lo que Clickatón nunca hizo).

## 9. Orden de construcción (para el plan)

1. Migración + modelos. 2. Variantes y galería en el catálogo y el mostrador. 3. Ficha online y
canal. 4. Módulo `store`, permisos y configuración. 5. Vitrina, ficha y carrito públicos.
6. Pedido, reserva y checkout. 7. Webhook, acreditación y cron. 8. Panel de pedidos.
9. Correos. 10. Arrepentimiento y textos legales.
