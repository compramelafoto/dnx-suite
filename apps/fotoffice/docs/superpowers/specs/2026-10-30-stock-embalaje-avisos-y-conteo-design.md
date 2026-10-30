# Stock: embalaje por entrega, avisos por última carga y conteo quincenal — diseño

Fecha: 30/10/2026 · Workspace de referencia: **DNX Estudio** (FOTOFFICE) · Módulo: Ventas (`sales`), sección Stock
Sigue a: `2026-10-21-stock-insumos-recepcion-e-importacion-design.md` (etapas 1 a 4, ya en producción).

## 1. Para qué

El stock de insumos ya descuenta lo que gasta **cada producto** (la receta: una 10x15 gasta 1 copia
del kit Kodak 305). Pero en el mostrador hay consumibles que no dependen de un producto sino de
**cómo se entrega el pedido**: el sobre de papel va uno por pedido, sin importar si lleva 3 o 80
fotos; la bolsa negra depende de la pieza más grande; la foto que va adentro de un portarretratos
no lleva sobre. Hoy eso no se puede expresar, así que sobres y bolsas se terminan sin aviso.

Además, Daniel quiere:
- que el aviso de "me estoy quedando sin" sea **gradual y por porcentaje de lo último que cargó**,
  con rojo al 10 %, y que llegue a **todo el equipo** apenas se pone en rojo;
- que el aviso diga **cuánto comprar** (para cubrir 2 meses);
- que el sistema **pida un conteo cada 2 semanas** y registre el motivo de cada diferencia;
- poder cargar **desperdicio** (reimpresiones, roturas);
- saber el **costo real** de cada venta (insumos + embalaje);
- un **aviso de temporada**: "el año pasado en noviembre gastaste mucho más de esto, comprá antes".

## 2. Lo que ya existe (no se reconstruye)

| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| Insumo | `Product.kind = "INSUMO"` + `FotofficeInsumo` (unidad, unidad de compra) | Se cuenta, no se vende |
| Receta por producto | `FotofficeRecetaInsumo` (`quantity`, `porCada`), `lib/stock/receta*.ts`, `lib/stock/consumo*.ts` | Descuenta `CONSUMO` por renglón vendido, redondeando para arriba |
| Caminos que descuentan | `lib/sales/record-sale.ts` (Mostrador y tienda), `lib/pedidos/pedidos.ts` (`apartarStock`, al tomar pedido con seña), `lib/pedidos/confirmar.ts` | Y `void-sale.ts` / `devolverStockApartado` devuelven lo descontado (nota `consumo:item:<id>`) |
| Recepción | `/ventas/stock/recepcion`, `lib/stock/recepcion*.ts` | Carga lo que llega con cantidad y **costo**; deja `StockMovement` `ENTRADA` con `sourceModule = "stock-recepcion"` |
| Importación | `lib/stock/importacion/` | Factura/foto/CSV → borrador de recepción |
| Avisos de compra | `lib/stock/avisos.ts` (puro), `lib/stock/avisos-servidor.ts`, `/ventas/stock`, tarjeta en el inicio | "Para comprar" = bajo mínimo, negativo o ≤ 7 días de cobertura (consumo de 30 días). Sugiere 1 mes. Lista por proveedor |
| Ajuste por conteo | `stock-form.tsx`, `validateAdjustment` | Ajuste de a un producto con nota obligatoria |
| Impresión | `FotofficeProductoProduccion` (producto → tamaño de hoja), `FotofficeTamanoImpresion` (mm) | Sabe de qué tamaño es cada impresión |
| Pedidos de impresión online | `FotofficePrintOrder` / `FotofficePrintOrderItem` | **Hoy no descuentan insumos** (los imprime el laboratorio) |
| Avisos al socio | `components/portal/notification-bell.tsx`, `lib/notifications/` | Es la campanita del **portal del socio**, no del equipo. **No existe una campanita del equipo en el panel.** |
| Planes | diseño `2026-10-28-plan-base-fotografos-design.md`, `lib/modules/negocio-inicial.ts` | Base / Profesional / Estudio diseñados; los topes por plan todavía no están construidos |

## 3. Objetivos, no-objetivos, anti-objetivos

**Objetivos**
1. **Embalaje por entrega**: que el sistema decida y descuente solo los sobres y bolsas de cada venta o
   pedido, según lo que contiene, y que el mostrador lo pueda cambiar en el momento.
2. **Avisos por porcentaje de la última carga**: semáforo gradual, rojo al 10 %, aviso inmediato al
   equipo, con la cantidad sugerida para 2 meses.
3. **Conteo quincenal guiado** con motivo por diferencia, y **registro de desperdicio**.
4. **Costo real** de cada venta (costo del producto + embalaje, al último costo cargado).
5. **Aviso de temporada** mensual.
6. Que todo sirva **para cualquier negocio** (nada atado a DNX Estudio salvo la carga inicial), en el
   plan pago (lo que Daniel llama "modo pro").

**No-objetivos (esta vez)**
- Consumibles de uso interno (papel de oficina, limpieza): Daniel los quiere, pero **en otra sección y
  en otra etapa**. El diseño no debe impedirlos (ver §9).
- Consumo de tinta, laminado o limpieza de máquina por trabajo (Daniel: "no tenerlos en cuenta").
- Registro completo de proveedores por insumo (Daniel no lo tiene; se usa el `supplierName` que haya).
- Embalaje distinto para envío por correo: Daniel confirmó que es **el mismo** que para retirar.

**Anti-objetivos (fallaría aunque "funcione")**
- Que vender se frene porque "no hay sobres" según el sistema. Igual que hoy: el negativo avisa, no bloquea.
- Que el mostrador tenga que elegir el embalaje a mano en cada venta. Lo propone el sistema; tocarlo es la excepción.
- Que una foto que va adentro de un portarretratos descuente un sobre.
- Que una anulación deje sobres o bolsas descontados.
- Avisos que se repiten todos los días por lo mismo, o que inundan al equipo ("todo eso" le molestaría a Daniel:
  stock falso, exceso de avisos y carga tediosa).
- Que cambiar las reglas de embalaje cambie en silencio lo descontado en ventas pasadas.

## 4. Embalaje por entrega

### 4.1 Reglas de DNX Estudio (dichas por Daniel, 30/10)

| Contenido de la entrega | Embalaje |
|---|---|
| Impresiones hasta **15x21** | **1 sobre de papel 19x24** para todas (un solo tipo de sobre). **Desde 100 fotos, 2 sobres; desde 200, 3** (uno más cada 100) |
| Pendrive | Va en el mismo sobre 19x24 (cuenta como una pieza más del sobre) |
| Impresiones de **más de 15x21** | **Bolsa negra**: 20x30, 30x45 o 35x45 (medidas aproximadas). Una impresión **entra en la bolsa de su misma medida** (20x30 → bolsa 20x30) |
| Portarretratos | Bolsa de **la medida siguiente** a la del portarretratos; si no hay una más grande, la más grande que haya |
| Fotolibro | Bolsa 35x45 |
| Varias piezas grandes | **Todas en una sola bolsa**, la que corresponde a la pieza más grande |
| Piezas chicas + piezas grandes | **Sobre y bolsa** (el sobre va adentro de la bolsa). Se descuentan los dos |
| Foto que va dentro de un portarretratos | **No lleva sobre**: el cliente se lleva el portarretratos armado. La copia sí se descuenta (receta de la impresión). Daniel: "siempre se coloca dentro del portarretratos" |
| Foto carnet | Sobre de carnet 5x5. **Sigue resuelto por la receta del producto** (ya existe: carnet = copia + sobre carnet). *(Decisión del diseño: no se mueve a embalaje.)* |
| Portarretratos sin foto | Solo su bolsa |
| Productos sin regla de embalaje (servicios, archivos digitales, etc.) | Nada |

### 4.2 Modelo, genérico para cualquier negocio

Sin columnas nuevas en `Product` (el esquema es compartido y una columna faltante rompe todas las apps; ver
la regla de etapa 1). Tablas nuevas de FOTOFFICE:

**`FotofficeEmbalaje`** — los envoltorios que tiene el negocio. Cada uno es un insumo.
| Campo | Notas |
|---|---|
| `workspaceId`, `insumoId` (único) | `insumoId` → `Product` con `kind = INSUMO` |
| `tipo` | `SOBRE` \| `BOLSA` (CHECK en SQL) |
| `admiteAnchoCm`, `admiteAltoCm` | Lo más grande que entra. Sobre 19x24 → admite 15x21. Bolsa 20x30 → admite 20x30 |
| `piezasPorUnidad` | Opcional. Sobre 19x24 → 100 ("uno más cada 100"). Nulo = sin tope |
| `orden`, `activo` | |

**`FotofficeProductoEntrega`** — cómo se entrega cada producto vendible (`productId` único).
| Campo | Notas |
|---|---|
| `forma` | `PIEZA_SUELTA` (impresión, pendrive) \| `ENMARCADO` (portarretratos, cuadro: lleva adentro una foto) \| `VOLUMEN` (fotolibro, caja) \| `SIN_EMBALAJE` (CHECK en SQL) |
| `anchoCm`, `altoCm` | Medida de la pieza. Para impresiones se precarga desde `FotofficeProductoProduccion` → tamaño de hoja (mm → cm) |
| `embalajeSiguiente` | Boolean. `true` en portarretratos: necesita un envoltorio **más grande** que su medida |
| `embalajeFijoId` | Opcional: siempre este envoltorio (fotolibro → bolsa 35x45) |

### 4.3 Cálculo (función pura, `lib/stock/embalaje.ts`)

Entrada: los renglones de la entrega (producto, cantidad, su `FotofficeProductoEntrega`) y los envoltorios activos.
Los **combos se desarman** en sus componentes antes de calcular (igual que la receta, con `planificarConsumo`),
salvo que el combo tenga su propia `FotofficeProductoEntrega`, que entonces manda. Así "Portarretratos 13x18
con foto" vendido como combo empareja la foto con el marco sin configurar nada más.

1. **Fotos que van adentro de un marco**: por cada unidad `ENMARCADO`, se "guarda" adentro una unidad de
   `PIEZA_SUELTA` **de la misma medida** que el marco (o, si no hay de esa medida, la más parecida que entre).
   Esas piezas salen del cálculo de embalaje. *(Decisión del diseño: el emparejamiento por medida es
   nuestro; Daniel dijo que la foto siempre va adentro, no cómo cargarla.)*
2. **Piezas chicas**: las `PIEZA_SUELTA` restantes que entran en algún `SOBRE`. Se elige el sobre más chico
   que admite la más grande de ellas. Cantidad = `floor(piezas / piezasPorUnidad) + 1` si hay tope, si no 1.
   Con 0 piezas, ningún sobre.
3. **Piezas grandes**: las `PIEZA_SUELTA` que no entran en ningún sobre + todas las `ENMARCADO` y `VOLUMEN`.
   Para cada una se calcula el envoltorio que necesita: el fijo si lo tiene; si no, la `BOLSA` más chica que la
   admite (con `embalajeSiguiente`, la más chica **estrictamente mayor en los dos lados** que su medida, porque
   el marco ocupa más que la foto: portarretratos 13x18 → bolsa 20x30; 20x25 → 30x45); si ninguna alcanza,
   la bolsa más grande. **Una sola bolsa** para toda la entrega: la mayor de las necesarias.
4. Las medidas se comparan sin importar la orientación (15x21 = 21x15).
5. Resultado: lista `{ insumoId, cantidad, motivo }` (el motivo se muestra: "80 fotos hasta 15x21",
   "portarretratos 20x25 → bolsa 30x45").

Si un producto no tiene `FotofficeProductoEntrega`, no participa (y no se inventa nada). En la pantalla de
Stock se muestra "N productos sin forma de entrega" para completarlos.

### 4.4 Cuándo se descuenta y cómo se revierte

Mismos momentos que la receta, una sola vez por entrega:
- **Venta del Mostrador y de la tienda** (`recordSale`): al cobrar, sobre todos los renglones de la venta.
- **Pedido con seña** (`apartarStock`): al tomarlo, sobre todos los renglones del pedido. Al cobrar el saldo
  no se vuelve a descontar (misma protección que ya tiene la receta).
- **Presupuesto confirmado** (`lib/pedidos/confirmar.ts`): igual que el pedido.
- **Pedidos de impresión online** (`FotofficePrintOrder`): **se suman**. Se descuenta el embalaje (no la
  receta: el papel es del laboratorio) cuando el pedido pasa a pagado. **Confirmado por Daniel (30/10): las copias
  del laboratorio pasan por el local y se colocan en sobres y bolsas** antes de entregarse o enviarse.
  Sus ítems (`FotofficePrintOrderItem`) no tienen producto, solo medidas en cm: se tratan como `PIEZA_SUELTA` con
  esa medida. Un pedido es **una sola entrega** aunque lo impriman dos laboratorios. Las medidas más grandes que la
  bolsa mayor (hasta 50x70) usan la bolsa más grande, y el mostrador la corrige con "Cambiar embalaje".

Movimientos: `StockMovement` con `reason = "CONSUMO"`, mismo `sourceModule`/`sourceRef` que la venta o pedido,
y `note = "consumo:embalaje"`. La nota es distinta de `consumo:item:` y de `item:` para no confundir
las devoluciones existentes. Anular la venta o cancelar el pedido devuelve **exactamente** lo descontado
(leyendo esos movimientos), aunque las reglas hayan cambiado. Cancelar un pedido con partes ya entregadas
**no devuelve** el embalaje (ya se usó). Las filas de los envoltorios se suman a `lockStockRows` en el mismo
orden por id.

**Entregas en partes** (Daniel: pasa poco, gasta 1 o 2 sobres): no se calculan solas. Quien entrega la
segunda parte suma un sobre con "Cambiar embalaje" (§4.5). *(Decisión del diseño.)*

### 4.5 Cambiar el embalaje en el momento

Daniel: "dale". En el Cobrador, debajo del total, una línea discreta:
"Embalaje: 1 sobre 19x24 + 1 bolsa 30x45 · Cambiar". "Cambiar" abre la lista con lo propuesto, editable
(sumar, quitar, cambiar cantidades, elegir otro envoltorio). Lo que se confirme es lo que se descuenta.
Lo mismo en el detalle de un pedido con seña y en el de un pedido de impresión ("Cambiar embalaje", que
escribe la diferencia como `CONSUMO` o `DEVOLUCION` con la misma nota). No se guarda "por qué".

### 4.6 Configuración

En **Ventas → Stock → Embalaje**:
- Lista de envoltorios (alta: nombre, sobre/bolsa, medida que admite, piezas por unidad). El alta crea el
  insumo si no existe.
- Lista de productos vendibles con su forma de entrega y medida, editable en tabla, con sugerencias:
  impresiones con tamaño de hoja → `PIEZA_SUELTA` con su medida; productos con "portarretratos" o "marco" en
  el nombre o la categoría → `ENMARCADO` con `embalajeSiguiente`; "fotolibro" → `VOLUMEN`; servicios →
  `SIN_EMBALAJE`. Las sugerencias **se proponen, no se guardan solas**.
- Para DNX Estudio, botón "Configurar embalaje DNX" (como el de Kodak 305) que crea el sobre 19x24
  (admite 15x21, 100 por sobre) y las bolsas 20x30, 30x45, 35x45, **con existencia 0**. La existencia real
  la carga el local. Las medidas de bolsa son aproximadas (Daniel) y se corrigen desde la pantalla.

## 5. Avisos por porcentaje de la última carga

Reemplaza la regla de "≤ 7 días de cobertura" de `lib/stock/avisos.ts` para decidir **cuándo** avisar.
La cobertura en días se sigue mostrando como información.

- **Base del porcentaje**: la **existencia que quedó justo después de la última entrada** del producto
  (`StockMovement` `ENTRADA`, sea por recepción o por "Cargar entrada"). Si quedaban 20 sobres y cargaste 500,
  el 100 % son 520. Así una compra chica cuando todavía hay stock no baja el umbral a casi nada.
  - Sin ninguna entrada todavía: se usa el mínimo (`minStockQty`) si lo hay, como hoy; si no, no se avisa.
  - Un ajuste por conteo **no** cambia la base (es una corrección, no una carga).
- **Semáforo gradual** (barra de nivel en `/ventas/stock` y en la ficha): verde > 25 %, amarillo ≤ 25 %,
  **rojo ≤ 10 %**, y "Ya no queda" en 0 o menos. *(El 25 % del amarillo es decisión del diseño; el 10 % del rojo
  es de Daniel, igual para todo.)* El porcentaje es una configuración del negocio (por omisión 10 %), no por producto.
- **Seguir siendo "Para comprar"** lo que esté en rojo, bajo mínimo o negativo.
- **Cantidad sugerida = 2 meses de consumo** (Daniel): consumo diario (últimos 60 días, neto de devoluciones) ×
  (60 + 3 días de demora del proveedor) − existencia, redondeado para arriba, nunca menos de 1. Sin consumo
  registrado: la cantidad de la última carga. Siempre en **unidades netas** (Daniel: "nombralo con la cantidad
  neta, luego al comprar dividimos"); si el insumo tiene unidad de compra, se agrega entre paréntesis
  "(≈ 3 paquetes de 100)". Los 3 días son una configuración del negocio (por omisión 3).
- **Lista para el proveedor**: la que ya existe, con estas cantidades.

### 5.1 Aviso al equipo

- **Todo el equipo** con acceso a Ventas recibe el aviso **apenas un producto pasa a rojo** (Daniel).
- Se manda **una vez por cruce**: si vuelve a verde o amarillo (llegó una compra) y después cae de nuevo, se avisa
  otra vez. Se guarda el estado en una tabla pequeña (`FotofficeStockAlerta`: `productId`, `nivel`, `avisadoEn`).
- **Dónde**: "en los avisos de FOTOFFICE". Hoy el equipo **no tiene una campanita** (la que existe es la del
  portal del socio). Se crea una **campanita del equipo** en el encabezado del panel, con el mismo patrón que la
  del socio (fuentes que se arman al leer + tabla de "visto hasta"), y stock es su primera fuente. Queda lista
  para que otros módulos sumen las suyas. Texto: "Sobre 19x24: quedan 40 (8 % de lo cargado). Comprar ~600."
  con enlace a Stock.
- La tarjeta del inicio y "Para comprar" siguen como están, con la regla nueva.

### 5.2 Aviso de temporada

- El **día 15 de cada mes** se compara, para cada insumo y producto con stock, el consumo del **mes siguiente del
  año pasado** con el consumo mensual promedio de los últimos 3 meses. Si el del año pasado es **50 % mayor o
  más**, aviso en la campanita: "El año pasado en noviembre se gastaron 900 sobres 19x24 (el doble de lo normal).
  Te conviene comprar ~1.200 antes de fin de mes." *(El día 15 y el 50 % son decisión del diseño.)*
- **Historia**: el consumo real de insumos existe recién desde el 21/10/2026. Para el año pasado se **estima**
  aplicando las recetas y las reglas de embalaje **actuales** a las ventas de ese mes (`Sale`/`SaleItem` que haya),
  y el aviso dice "estimado". Si no hay ventas de ese mes, no se avisa. *(Decisión del diseño.)*
- Corre como tarea programada diaria que solo actúa el día 15 (mismo mecanismo de cron que el resto de FOTOFFICE).
- **Ojo con la historia**: las ventas por producto (`Sale`/`SaleItem`) existen recién desde el 14/09/2026 y el histórico
  de Caja guarda montos por rubro, no productos. Por eso este aviso **queda construido pero no va a disparar hasta
  septiembre/octubre de 2027**. Mientras tanto, y para no comparar contra menos de un mes, el promedio de referencia
  exige al menos 60 días de consumo registrado. Por eso va en la última etapa.

## 6. Conteo cada 2 semanas

- Cada 14 días el sistema abre un **conteo pendiente** del negocio con todos los insumos y productos con stock,
  y avisa en la campanita del equipo: "Toca contar el stock".
- Pantalla **Ventas → Stock → Conteo**: una fila por artículo con lo que el sistema espera y un campo para lo
  contado. Se puede guardar a medias y seguir después. Lo que no se cuenta queda como está (no se asume cero).
- Al cerrar el conteo: para cada diferencia se pide **motivo** de una lista — rotura, desperdicio / reimpresión,
  uso interno, regalo, faltante sin explicación, error de carga, otro (con texto) — y se escribe un `AJUSTE` con el
  motivo. Resumen al final: "Faltan 12 sobres (faltante), sobran 3 bolsas (error de carga)".
- Tablas nuevas: `FotofficeConteo` (estado ABIERTO/CERRADO, fechas, quién) y `FotofficeConteoLinea`.
- El "Ajustar por conteo" suelto se mantiene, ahora también con la lista de motivos.
- El intervalo (14 días) es configuración del negocio.

## 7. Desperdicio

- Botón **"Registrar desperdicio"** en Stock y en la ficha del insumo: artículo, cantidad, motivo
  (reimpresión, rotura, prueba, otro), nota opcional. Escribe `StockMovement` con `reason = "DESPERDICIO"` (valor
  nuevo; revisar CHECK en SQL).
- Cuenta como consumo para la cobertura, la cantidad sugerida y el aviso de temporada.
- Informe simple en Stock: desperdicio del mes por artículo y motivo.

## 8. Costo real de cada venta

- El costo se carga al recibir la compra (ya existe: recepción con costo).
- **El costo de cada producto ya incluye sus insumos** (Daniel, 30/10: el costo de una 10x15 ya contiene el papel y
  el ribbon del kit). Por eso lo que consume la receta **no se vuelve a sumar** al costo: solo se usa para el stock.
- En el detalle de una venta o pedido: "Costo de embalaje: $X" = suma de sus movimientos `CONSUMO` con nota
  `embalaje:` × costo unitario **guardado en el movimiento al descontar** (último costo del insumo en ese momento).
  Y "Ganancia real" = total − costo de los productos (lo que ya calcula `lib/sales/margin.ts`) − costo de embalaje.
- Para eso, al escribir `CONSUMO` se guarda `unitCostArs` (la columna ya existe en `StockMovement`).
- En Informes, una línea "Embalaje" dentro de los costos del período.

## 9. Lo que queda preparado para después

- **Consumibles internos** (oficina, limpieza): serán insumos con un marcador de "uso interno" en
  `FotofficeInsumo` (sin receta ni embalaje), en su propia sección. Nada de este diseño lo impide.
- Embalaje por entrega parcial automático, si algún día hace falta.

## 10. Plan pago

El módulo Stock completo (insumos, recetas, embalaje, avisos, conteo) queda **solo para los planes pagos**
(Profesional y Estudio del diseño del 28/10; "modo pro" para Daniel). Como los topes por plan todavía no
existen, por ahora se controla con el módulo encendido por negocio (como hoy) y se deja anotado en la lista
del plan Base como "con candado". *(Decisión del diseño: no se construyen los planes en este trabajo.)*

## 11. Etapas

Cada etapa con su guía en Instructivos (sección Stock) y sus capturas, en el mismo PR.

1. **Embalaje por entrega** (§4): tablas, cálculo puro con pruebas de todos los casos de la tabla §4.1, descuento y
   reversión en los cuatro caminos, "Cambiar embalaje", configuración y botón "Configurar embalaje DNX".
   Guía nueva `stock-embalaje`.
2. **Avisos por última carga** (§5 sin 5.2): semáforo, rojo al 10 %, cantidad para 2 meses, campanita del equipo
   con la fuente de stock. Actualizar guía `stock-avisos-y-compras`.
3. **Conteo quincenal y desperdicio** (§6, §7). Actualizar guía `stock-contar-y-ajustar`.
4. **Costo real y aviso de temporada** (§8, §5.2).

Migraciones como el resto de FOTOFFICE (a mano y `resolve`; sin staging: se aplican sobre la base real con cuidado).

## 12. Casos de prueba que tiene que cubrir el cálculo de embalaje

| Entrega | Resultado esperado |
|---|---|
| 30 fotos 10x15 | 1 sobre 19x24 |
| 99 fotos 10x15 | 1 sobre |
| 100 fotos 10x15 | 2 sobres |
| 200 fotos 10x15 | 3 sobres |
| 10 fotos 10x15 + 5 fotos 15x21 | 1 sobre |
| 1 foto 20x30 | 1 bolsa 20x30 |
| 1 foto 20x30 + 1 foto 30x45 | 1 bolsa 30x45 |
| 20 fotos 10x15 + 1 foto 30x45 | 1 sobre + 1 bolsa 30x45 |
| 1 portarretratos 20x25 + 1 foto 20x25 | 1 bolsa 30x45 (la foto va adentro, sin sobre) |
| 1 portarretratos 13x18 + 1 foto 13x18 + 10 fotos 10x15 | 1 sobre + 1 bolsa 20x30 |
| 3 portarretratos 13x18 + 3 fotos 13x18 | 1 bolsa 20x30 |
| 1 portarretratos 35x45 | 1 bolsa 35x45 (no hay más grande) |
| 1 portarretratos sin foto | su bolsa |
| 1 pendrive | 1 sobre |
| 1 fotolibro + 10 fotos 10x15 | 1 sobre + 1 bolsa 35x45 |
| 1 foto carnet | nada de embalaje (el sobre carnet lo pone su receta) |
| Solo un servicio | nada |

## 13. Lo que queda a criterio del constructor

- Diseño visual de semáforo, campanita del equipo, pantallas de embalaje y conteo, con los componentes
  existentes (`fo-card`, `fo-btn`, `PageHeader`, `InputMoneda`).
- Cómo se emparejan las fotos con el marco cuando no hay una de la misma medida (regla razonable y probada).
- Dónde exactamente se engancha el descuento del embalaje en `FotofficePrintOrder`.
- Nombres de archivos y funciones.

## 14. Decisiones tomadas en este diseño (no las dijo Daniel; revisarlas)

- La foto carnet sigue con su sobre en la receta del producto, no en el embalaje.
- Las fotos dentro de un marco se emparejan por medida.
- "La medida siguiente" del portarretratos = la bolsa más chica que sea más grande en los dos lados
  (13x18 → 20x30; 20x25 → 30x45; 20x30 → 30x45).
- Un pedido de impresión online repartido entre dos laboratorios es una sola entrega.
- Las entregas en partes no suman sobres solas: se agregan con "Cambiar embalaje".
- Cancelar un pedido con partes entregadas no devuelve el embalaje.
- Amarillo al 25 %; un ajuste por conteo no cambia la base del porcentaje; sin entradas, se usa el mínimo.
- Cantidad sugerida con consumo de 60 días + 3 días de demora, en unidades netas.
- Campanita del equipo nueva (no existía) con stock como primera fuente.
- Aviso de temporada el día 15, si el año pasado fue 50 % mayor; historia estimada con las recetas actuales.
- Conteo de todos los artículos con stock; lo no contado queda igual.
- Desperdicio como `reason` nuevo, que cuenta como consumo.
- Costo del consumo guardado en el movimiento al descontar.
- Plan pago controlado por el módulo encendido mientras los planes no existan.
- Base del porcentaje = existencia después de la última entrada (no la cantidad de esa entrada).
- Los combos se desarman para el embalaje, salvo que tengan forma de entrega propia.
- El aviso de temporada se construye sabiendo que recién avisa desde fines de 2027.
