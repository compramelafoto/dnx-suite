# Pedidos de impresión desde las entregas — diseño

Fecha: 20/10/2026 · Pedido por Daniel Cuart (DNX Estudio) · Estado: aprobado por partes en la conversación, falta revisión del documento.

## 1. Qué se quiere lograr

Cuando un cliente recibe sus fotos digitalizadas (revelado de rollo, digitalización) o su galería de una
sesión, desde ese mismo enlace puede **pedir copias impresas**: elige foto por foto tamaño y cantidad,
papel y recorte, paga online y el pedido **sale solo al laboratorio** que corresponde, pedido «para
mañana». Además el pedido **se carga como trabajo** en FOTOFFICE y sigue su circuito de proyecto.

**Éxito:** un cliente hace un pedido de punta a punta sin hablar con nadie; el laboratorio recibe un
único enlace que descarga una carpeta ordenada; el estudio ve el trabajo, el cobro en Caja y la
ganancia; nadie tiene que reenviar archivos a mano.

### Lo que dijo Daniel (decisiones)

| Tema | Decisión |
|---|---|
| Precio | Por tamaño se carga **costo del laboratorio y precio de venta**; el sistema muestra la ganancia. |
| Pago | El cliente paga **online con Mercado Pago** al confirmar. |
| Laboratorios | Hasta 20x30 → **Fotolag**; más grande → **La Isla**. Se pide «para mañana». |
| Envío al lab | **Un solo enlace** por laboratorio que descarga una carpeta ordenada por tamaño, papel y cantidad. |
| Trabajo | El pedido se carga en **Trabajos** con su circuito. |
| Entrega | **Retiro en el local o envío a domicilio**, con costo por distancia (como «¿Cuánto cobro?»). |
| Origen | Entregas de **rollos/digitalizaciones** (carpeta del trabajo) **y galerías**. |
| Opciones por copia | Tamaño, cantidad, **papel** (brillo/mate, uno por pedido) y **ajuste manual del recorte**. |
| Plazo prometido | **«Dentro de 48 horas hábiles»** desde el pago. |

### Supuestos (confirmar si cambian)

- Es para el estudio (DNX Estudio y cualquier workspace que lo encienda), no para instituciones.
- La regla «hasta 20x30 Fotolag / más grande La Isla» **no se programa fija**: cada tamaño tiene su
  laboratorio asignado y la lista inicial viene así.
- Pedido con copias para dos laboratorios → **un trabajo por laboratorio** bajo el mismo pedido, porque
  `FotofficeProyecto` admite un solo proveedor (`proveedorId`, `proveedorCostoArs`, `proveedorEnviadoAt`).

## 2. Enfoque elegido

Módulo nuevo **«Pedidos de impresión»** (clave `print-orders`) dentro de FOTOFFICE, reusando:

- **Cobro Mercado Pago** con la cuenta del workspace, como las compras de galería (`lib/galerias/pago.ts`:
  `iniciarPagoGaleria`, `verificarVueltaGaleria`, acreditación a Caja con comisión real en `acreditar.ts`).
- **Carpetas de trabajo** en R2 con enlace privado y vencimiento (`lib/carpetas/*`,
  `FotofficeArchivoTrabajo`, ruta pública `w/[slug]/archivos/[token]`).
- **Proveedores** (`FotofficeProveedor`) y su correo (`lib/proyectos/correo-proveedor.ts`, `proveedor.ts`).
- **Trabajos y circuitos** (`FotofficeProyecto`, `FotofficeCircuit`, circuito «Impresión en laboratorio»).
- **Buscador de direcciones** (`/api/geocode`, `lib/geocode/nominatim.ts`) para ubicar el domicilio del envío.
- **Precio por km / zonas de viáticos** del perfil de precios (`pricingExtras.travelPerKm`,
  `travelZones`, ubicación del estudio `studioLatitude/Longitude`).

Descartados: puente al sistema de impresiones de CompraMeLaFoto (otra base, otros usuarios, mercado de
labs) y estirar la Tienda (orientada a obras de catálogo y envío por código postal).

## 3. Configuración (Configuración → Impresiones)

- Interruptor del módulo (apagado por defecto) y **modo prueba** (los correos «al laboratorio» van al
  correo del estudio).
- **Tamaños**: ancho × alto en cm, laboratorio (proveedor), costo, precio de venta, ganancia calculada,
  activo. Lista inicial: 10x15, 13x18, 15x21, 20x25, 20x30 → Fotolag; 30x40, 30x45, 40x50, 50x70 → La Isla;
  precios vacíos. **Un tamaño sin precio de venta no se ofrece.**
- **Papeles**: brillo y mate, cada uno activable. No cambian el precio.
- **Envío a domicilio**: encendido/apagado, monto fijo + monto por km (propone `travelPerKm` si existe),
  radio máximo en km. Sin ubicación del estudio cargada, el envío no se puede encender.
- **Circuito** asignado a los trabajos (por defecto «Impresión en laboratorio»).
- Un pedido guarda **foto de los precios y costos** del momento: cambiar la lista no toca lo vendido.

## 4. Experiencia del cliente

Entrada: botón **«Pedir copias impresas»** en la carpeta del cliente (`archivos/[token]`, etapa 1) y en la
galería (`galeria/[token]`, etapa 3). Visible sólo con el módulo encendido y al menos un tamaño con
precio. Sin cuenta: el enlace privado identifica al cliente. El correo de entrega de la carpeta suma
«Desde este enlace también podés pedir copias impresas».

1. **Elegir**: grilla de miniaturas grandes (2 por fila en celular, 4–5 en escritorio); al abrir una foto
   se agregan copias (tamaño + cantidad, varias por foto). Atajo «aplicar a todas». Papel único por pedido.
   Barra fija con cantidad de copias y total.
2. **Recorte**: sólo para copias cuya proporción no coincide con el tamaño. Recorte propuesto centrado,
   ajustable con arrastre y zoom. **Aviso de baja resolución** si la foto da menos de 150 ppp al tamaño
   elegido (puede seguir).
3. **Entrega y datos**: nombre, correo, teléfono (precargados si se conocen). Retiro (gratis) o envío:
   dirección elegida con el buscador de direcciones que ya usa el formulario de coberturas (`/api/geocode`, Nominatim) → distancia en línea recta desde el estudio → costo; fuera del radio sólo retiro. Plazo
   mostrado: «dentro de 48 horas hábiles desde el pago».
4. **Pago** con Mercado Pago. Vuelta: «¡Pedido confirmado!», número y enlace de seguimiento (Recibido →
   En el laboratorio → Listo para retirar / Enviado → Entregado). Correo de confirmación.

Archivos aptos: imágenes JPG, PNG y TIFF de la carpeta o de la galería; videos y otros archivos no se
muestran. Las fotos de la carpeta no tienen miniatura guardada: se generan y se guardan la primera vez.

## 5. Después del pago (automático)

1. **Pago aprobado** (aviso de MP o vuelta del cliente; idempotente por `providerPaymentRef`): el pedido
   pasa a `PAGADO`. Pendiente o rechazado nunca dispara envíos.
2. **Trabajo(s)**: uno por laboratorio, a nombre del cliente (cliente existente o creado), con el circuito
   configurado, `entregaPrometida` = 2 días hábiles, `proveedorId` y `proveedorCostoArs` del laboratorio.
   El cobro entra a **Caja** con la comisión real de MP.
3. **Archivos** (en segundo plano, fuera del aviso de MP): por cada copia se aplica el recorte a la
   proporción exacta y se exporta JPG calidad 95 en sRGB. Carpeta por laboratorio:
   `Pedido <n> - <Cliente>/<Tamaño> <Papel>/<N> copia(s)/<archivo>.jpg`, comprimida en un único ZIP
   dentro de una carpeta de trabajo con enlace que vence a los 30 días.
4. **Correo a cada laboratorio** desde la casilla del workspace: asunto
   «Pedido <n> – PARA MAÑANA – <Cliente>», tabla tamaño/papel/cantidad, total de copias, nombre para el
   sobre y el enlace. Se registra `proveedorEnviadoAt` en el trabajo.
5. El estudio avanza el trabajo; al marcar «Listo para retirar» o «Enviado» el cliente recibe aviso y su
   seguimiento se actualiza.

**Fallas:** si no se pudieron armar los archivos o no salió el correo, el pedido queda
`PAGADO_SIN_ENVIAR`, con aviso en el panel y correo al estudio, y botón **«Reintentar envío»** en el
trabajo. Cancelaciones y devoluciones: manuales en Mercado Pago; el sistema sólo marca `CANCELADO`.

## 6. Datos nuevos (tablas)

- `FotofficePrintSettings` (por workspace): enabled, testMode, paperGlossy, paperMatte, shippingEnabled,
  shippingBaseArs, shippingPerKmArs, shippingMaxKm, circuitId.
- `FotofficePrintSize`: workspaceId, widthCm, heightCm, proveedorId, costArs, priceArs, active, order.
- `FotofficePrintOrder`: workspaceId, number, source (`CARPETA` | `GALERIA`), proyectoOrigenId?,
  galeriaId?, clientId?, nombre/correo/teléfono, paper, delivery (`RETIRO` | `ENVIO`), dirección y km,
  shippingArs, subtotalArs, totalArs, costTotalArs, status, promisedAt, pricingSnapshot (Json),
  mpPreferenceId, providerPaymentRef (único), paidAt, feeArs, netArs, cashMovementId, trackingToken.
- `FotofficePrintOrderItem`: orderId, archivo de origen (clave R2 y nombre), sizeId, widthCm, heightCm,
  quantity, unitPriceArs, unitCostArs, crop (x, y, ancho, alto en proporción 0–1), proveedorId,
  proyectoId (trabajo al que pertenece).

Estados del pedido como texto (no enum de Prisma), como el resto de FOTOFFICE. Tablas nuevas: no tocan
nada existente; se crean a mano en la base antes de publicar el código y se registran en
`_prisma_migrations`.

## 7. Etapas

1. **Circuito completo con retiro**, desde las carpetas de rollos/digitalizaciones: configuración y
   precios, pantalla del cliente con recorte, pago, trabajo(s), carpeta ordenada, correo al laboratorio,
   modo prueba, seguimiento.
2. **Envío a domicilio** por distancia.
3. **Desde galerías**.

## 8. Pruebas

Unitarias (funciones puras): precio, ganancia y total; división por laboratorio; armado de rutas de la
carpeta; cálculo del recorte y de la resolución; 48 horas hábiles salteando fines de semana y feriados;
pago rechazado no envía; aviso repetido de MP no duplica. Prueba real en producción con el módulo
encendido sólo en DNX Estudio y **modo prueba**: pedido chico pagado con tarjeta propia, revisar ZIP y
correo.

## 9. Fuera de alcance

Pagar en el local o por transferencia; precio distinto por papel; marcos, fotolibros u otros productos;
fotos subidas por el cliente; integración con sistemas propios de los laboratorios (sigue por correo).
