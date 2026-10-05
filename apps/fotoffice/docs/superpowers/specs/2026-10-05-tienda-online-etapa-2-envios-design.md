# Tienda online de FOTOFFICE — Etapa 2: envío a domicilio con costo calculado

**Fecha:** 2026-10-05 · **Depende de:** etapa 1 (PR 348, en producción).
**Decisión de Daniel (2026-10-05):** tabla de tarifas propia de cada institución **más** cotización automática con Correo Argentino (MiCorreo) para la institución que cargue sus credenciales. Sobre el precio del correo se suma un **recargo de logística** configurable.
**Referencia de la API:** `apps/fotoffice/docs/integraciones/correo-argentino-micorreo-api.md` (extraída del PDF oficial del 08/08/2022).

## 1. Qué resuelve

Hoy la tienda sólo ofrece retiro en la sede. La etapa 2 suma **envío a domicilio** y **envío a sucursal de Correo Argentino**, con el costo calculado en el checkout según el destino y el peso del paquete, más el recargo que fija la institución. La institución sigue despachando como siempre: arma el rótulo en la web de MiCorreo (la API no genera rótulos ni seguimiento) y carga el número de seguimiento en el pedido; el comprador recibe un correo con ese número.

## 2. Decisiones

| # | Decisión | Por qué |
|---|---|---|
| E1 | Una sola puerta, `quoteShipping(...)`, con dos fuentes: **tabla propia** y **Correo Argentino**. Configuración por institución: cuál se usa y si la tabla sirve de respaldo cuando el correo no responde | Tabla funciona el día uno sin cuentas; Correo da el precio real. Mañana se suman Zipnova o Andreani sin tocar el checkout. |
| E2 | Tabla propia = **zonas** (lista de códigos postales exactos, o provincias, o "resto del país") con **escalones de peso** (hasta X gramos → $Y). Gana la zona más específica: código postal, después provincia, después "resto del país" | Es como cobran los correos y cualquiera lo puede cargar. |
| E3 | Recargo de logística: **porcentaje** o **monto fijo**, se suma al precio que da la fuente. El comprador ve un solo número: "Envío $X" | Lo que pidió Daniel. |
| E4 | Peso del paquete = Σ (peso del producto × cantidad) + **peso del embalaje** (configurable). Medidas = la caja por defecto de la institución (largo × ancho × alto, configurable); si la suma de medidas de los productos es mayor, se usa la mayor de cada lado y la suma de altos | MiCorreo exige medidas; la mayoría de las instituciones no las carga por producto. |
| E5 | Un producto online sin peso cargado usa el **peso por defecto por unidad** de la configuración. El panel avisa qué productos no tienen peso | Que falte un dato no puede dejar sin envío a toda la tienda. |
| E6 | Credenciales de MiCorreo (usuario y contraseña de la API + email y contraseña de la cuenta MiCorreo para obtener el `customerId`) se guardan **cifradas** en `WorkspaceIntegration` (provider `CORREO_ARGENTINO`, clave `correo-argentino`), con el mismo baúl que Google (`lib/integrations/vault.ts`). Al guardarlas se validan contra la API (token + `/users/validate`) y se guarda el `customerId` | Mismo baúl, misma clave maestra; nada en texto plano. |
| E7 | El ambiente de MiCorreo (pruebas o producción) lo elige la institución al conectar; la URL base sale de ahí | Correo entrega credenciales distintas por ambiente. |
| E8 | El token JWT se cachea en memoria por instancia hasta su vencimiento menos 60 s | Evita pedir token en cada cotización. |
| E9 | Opciones en el checkout: **Retiro en la sede** (gratis, si la institución lo deja activo), **Envío a domicilio**, **Envío a sucursal** (sólo con Correo; se elige la sucursal de una lista por provincia, `GET /agencies`) | Sucursal suele ser más barata. |
| E10 | La cotización se pide en el checkout cuando el comprador pone código postal y provincia; al **crear el pedido se vuelve a cotizar en el servidor** y se congela. El precio que manda el navegador nunca se usa | Mismo principio que los precios de productos. |
| E11 | Comisión de DNX: se calcula sobre los **productos**, no sobre el envío | El envío es plata que va al correo; cobrar comisión sobre eso encarece sin razón. **Discutible: Daniel puede pedir lo contrario.** |
| E12 | En la `Sale` el envío va como un renglón suelto "Envío a domicilio / a sucursal" (sin producto). Así Caja recibe el total cobrado | `recordSale` ya admite renglones sueltos. |
| E13 | Estados: se agrega `SHIPPED` ("Despachado"). Pedidos con envío: PAID → SHIPPED → DELIVERED. Pedidos con retiro: PAID → READY → DELIVERED (igual que hoy). Despachar exige número de seguimiento (opcional pero recomendado) y manda correo al comprador | El enum nuevo se agrega con `ALTER TYPE ... ADD VALUE`. |
| E14 | Si la fuente falla (correo caído, credenciales vencidas) y la tabla está como respaldo, se usa la tabla; si no hay respaldo, el checkout muestra "No pudimos calcular el envío; podés retirar en la sede" y se registra un aviso para la institución en el panel | Nunca se vende un envío sin precio. |
| E15 | Fuera de alcance: crear el envío en MiCorreo por API (`/shipping/import`), rótulos, seguimiento automático, envío gratis por monto, otros correos | Etapas siguientes. |

## 3. Modelo de datos (migración `20261005120000_store_shipping`)

Todo aditivo, aplicado a mano antes del deploy y registrado con checksum.

```prisma
model StoreShippingSettings {      // 1 por workspace
  id, workspaceId @unique
  homeDeliveryEnabled   Boolean @default(false)
  branchDeliveryEnabled Boolean @default(false)   // sólo con Correo
  pickupEnabled         Boolean @default(true)
  source                String  @default("TABLE") // TABLE | CORREO_ARGENTINO
  tableAsFallback       Boolean @default(true)
  originPostalCode      String?
  surchargeKind         String  @default("NONE")  // NONE | PERCENT | FIXED
  surchargeValue        Int     @default(0)       // bps si PERCENT, centavos si FIXED
  packagingGrams        Int     @default(0)
  defaultUnitGrams      Int     @default(500)
  boxLengthCm Int @default(30)  boxWidthCm Int @default(20)  boxHeightCm Int @default(10)
  handlingNote          String?  // "Despachamos en 48 h hábiles"
  createdAt, updatedAt
}

model StoreShippingZone {
  id, workspaceId, name
  postalCodes   String[]   // exactos, ej. ["2000","2001"]
  provinceCodes String[]   // códigos de provincia de Correo (A..Z)
  isRestOfCountry Boolean @default(false)
  sortOrder Int @default(0)
  rates StoreShippingRate[]
}

model StoreShippingRate {
  id, zoneId, maxGrams Int, priceArs Decimal(12,2)
  @@unique([zoneId, maxGrams])
}

// StoreOrder: columnas nuevas, nulas
shippingMethod      String?   // HOME | BRANCH (null = retiro)
shippingSource      String?   // TABLE | CORREO_ARGENTINO
shippingAddressJson Json?     // nombre, calle, número, piso/depto, localidad, provincia, CP, teléfono
shippingAgencyJson  Json?     // id, nombre y dirección de la sucursal
shippingQuoteJson   Json?     // lo que devolvió la fuente + recargo + peso y medidas usados
trackingNumber      String?
shippedAt           DateTime?

enum StoreOrderStatus: + SHIPPED
```

`deliveryMethod` ya existe (`PICKUP`); pasa a admitir `SHIPPING`. `shippingArs` ya existe (hoy siempre 0).

## 4. Flujos

**Configuración (panel, Ventas → Tienda → Envíos):** activar retiro / domicilio / sucursal; fuente; respaldo; CP de origen; recargo; embalaje, peso por unidad por defecto, caja por defecto; zonas y escalones (alta, edición, baja); conectar Correo Argentino (ambiente, usuario y contraseña de API, email y contraseña de MiCorreo) con botón "Probar conexión" que cotiza un envío de prueba al CP de origen. Lista de productos online sin peso.

**Checkout:** el comprador elige método. Domicilio: completa dirección; al tener CP + provincia se cotiza (acción de servidor `quoteShippingAction`, con límite de pedidos por IP). Sucursal: elige provincia → lista de sucursales → cotiza. El total muestra productos + envío. `createStoreOrder` re-cotiza dentro del flujo, antes de la transacción de reserva, y guarda `shippingArs`, `shippingQuoteJson`, dirección/sucursal.

**Cobro:** la preferencia de Mercado Pago cobra el total (productos + envío); `marketplace_fee` sobre los productos (E11).

**Acreditación:** `finalizePaidOrder` agrega el renglón de envío a la `Sale` (E12).

**Panel de pedidos:** muestra dirección o sucursal, peso y fuente de la cotización; botón "Marcar despachado" con número de seguimiento; correo "Tu pedido está en camino" con el número y el enlace de seguimiento de Correo Argentino (`https://www.correoargentino.com.ar/formularios/e-commerce?id=<numero>`, verificar formato en QA; si no se confirma, sólo el número).

## 5. Errores y bordes

- Peso total > 25 kg o un lado > 150 cm: MiCorreo no cotiza → sólo tabla (si cubre ese peso) o "no hacemos envíos de este tamaño".
- CP no cubierto por ninguna zona de la tabla y sin "resto del país": no se ofrece envío a ese destino.
- Escalón: se elige el primer `maxGrams >= peso`; si el peso supera el último escalón, no hay envío por tabla.
- Respuesta de MiCorreo sin moneda/IVA explícitos: se asume pesos finales (validar en QA) y se guarda la respuesta cruda.
- Credenciales inválidas al cotizar: la integración pasa a `NEEDS_RECONSENT`, aviso en el panel, respaldo según E14.
- Nunca se loguean credenciales ni datos personales del comprador.

## 6. Pruebas

Puras: elección de zona y escalón, cálculo de peso y caja, recargo (porcentaje redondeado a centavo, fijo), transiciones con SHIPPED, renglón de envío en la venta, comisión sólo sobre productos. Cliente de MiCorreo con `fetch` inyectado: token + cache, `/users/validate`, `/rates` (D y S), `/agencies`, errores 401/402/429. Integración del checkout: el precio del navegador se ignora; re-cotización al crear el pedido; respaldo a la tabla.

## 7. Orden de construcción

1. Esquema y migración. 2. Cálculo puro (paquete, zona/escalón, recargo). 3. Cliente MiCorreo + guardado cifrado de credenciales. 4. `quoteShipping` (fuentes + respaldo). 5. Configuración de envíos en el panel. 6. Checkout con métodos, dirección, sucursales y cotización. 7. Pedido, cobro y acreditación con envío. 8. Despacho, seguimiento y correo. 9. Verificación final y build.
