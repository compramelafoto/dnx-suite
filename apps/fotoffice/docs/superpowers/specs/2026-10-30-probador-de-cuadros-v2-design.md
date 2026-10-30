# Probador de cuadros v2: edición por cuadro, canvas y pedido pago

Fecha: 30/10/2026 · Pedido por Daniel · Estado: **borrador para aprobar**

## 1. Para qué

Hoy el probador ([PR 880](https://github.com/compramelafoto/dnx-suite/pull/880) y [PR 882](https://github.com/compramelafoto/dnx-suite/pull/882)) sirve para mirar: el cliente ve cómo quedan los cuadros en su pared, pero no puede comprarlos.

La v2 lo convierte en un **armador de cuadros que termina en un pedido pago**. El cliente:

1. arma el conjunto con libertad (cada cuadro con su medida, su lugar y su encuadre);
2. ve el precio real, que sale del catálogo de Ventas;
3. paga con Mercado Pago.

El estudio recibe los archivos **ya recortados y listos para el laboratorio**: el canvas con 5 cm de envoltura por lado, y un mapa de armado del conjunto.

Lo usan dos personas:

- **El cliente**, desde el sitio del estudio (`/w/<estudio>/probador-de-cuadros`).
- **El fotógrafo**, desde el panel (Ventas → Probador de cuadros), con el cliente adelante.

Las referencias que mostró Daniel son conjuntos de **una sola foto repartida en varios cuadros**, con medidas y alturas distintas:

- un tríptico parejo de un mapa antiguo;
- cuatro piezas escalonadas, las del centro más altas y angostas;
- cinco piezas de canvas escalonadas, con la del centro más alta.

## 2. Objetivos

1. **Deshacer y rehacer** con el teclado: ⌘Z / Ctrl+Z deshace siempre; ⇧⌘Z / Ctrl+Y rehace. También hay botones, para el celular.
2. **Tocar un cuadro y editarlo solo a él:**
   - su medida;
   - su posición dentro del conjunto (arrastrarlo);
   - el encuadre de la foto (moverla y agrandarla dentro del cuadro);
   - rotarla de a 90°;
   - inclinarla para enderezar el horizonte (±15°);
   - el paspartú, si lo lleva.
3. **Paspartú opcional:** encendido o apagado para todo el conjunto, y también por cuadro.
4. **Una sola foto repartida en todos los cuadros** (dos o más), también con medidas y alturas distintas, como en las referencias. El encuadre de esa foto se mueve una vez para todo el conjunto.
5. **Recorte real:** lo que se ve es lo que se imprime. El pedido entrega un archivo por cuadro, ya recortado a su medida.
6. **Precios del catálogo de Ventas:** cada combinación de tipo y medida sale de un producto con precio. Si no hay precio, esa medida no se ofrece.
7. **Pedido y pago:** impresiones y canvas, con Mercado Pago del estudio, el mismo circuito que Pedidos de impresión y los archivos al laboratorio.
8. **Canvas con envoltura:** cada cuadro canvas se entrega con **5 cm extra por lado** para doblar sobre el bastidor. Ese borde es la misma imagen extendida y desenfocada.
9. **Marcos reales (VGO), más adelante.** En la v2 la elección de marco queda **deshabilitada**, con el cartel "Próximamente". Este documento deja escrito cómo se cargan después.

## 3. Lo que no hace la v2

- No elige marcos de VGO todavía (ver objetivo 9 y la sección 9).
- No crea una `Sale` con renglones de producto. El cobro entra a Caja como en Pedidos de impresión (ver 7.4).
- No guarda composiciones para retomarlas otro día. Por ahora vive en la pantalla y se pierde al cerrarla, salvo que se pague.
- No hace realidad aumentada.

**Se considera fracaso**, aunque funcione:

- que el archivo del laboratorio no coincida con lo que el cliente vio;
- que se cobre una medida sin precio cargado;
- que se pierda la foto original del cliente antes de imprimir.

## 4. Lo que ya existe y se reutiliza

Hay un relevamiento del código del 30/10/2026.

| Pieza | Dónde | Uso en la v2 |
|---|---|---|
| Pedido de impresión con pago MP, webhook, Caja, trabajo por laboratorio, cron, ZIP y correo | `lib/impresiones/*`, `app/api/cron/impresiones`, `FotofficePrintOrder*` | El pedido del probador es un `FotofficePrintOrder` con `source = "PROBADOR"`. El campo es texto, así que no hace falta migrar el valor. |
| Recorte en proporciones 0–1 | `lib/impresiones/recorte.ts` | Base del encuadre de cada cuadro. |
| Editor de recorte (arrastrar, zoom, teclado) | `components/impresiones/editor-recorte.tsx` | Referencia para el encuadre dentro del probador. Se integra al lienzo; no es un modal aparte. |
| Aviso de foto pixelada | `PPP_MINIMO = 150` (`lib/impresiones/constantes.ts`) | Aviso por cuadro. |
| R2 privado con PUT firmado | `lib/ficha/adjuntos-r2.ts` | Subida de los originales del cliente. |
| Salida a ppp fijo con sharp | `lib/impresion/render.ts` (`componerCopia`, `density`) | Archivo final de cada cuadro a su medida exacta. |
| Productos con precio | `Product.priceArs`, `ProductVariant.priceArs` | Precio de cada tipo y medida. |
| Lectura de medidas en nombres | `normalizarMedida` (`lib/precios-proveedor/clave.ts`) | Saca "50x70" del nombre de la variante. |
| Geometría del probador | `lib/probador/geometria.ts` | Se extiende con cuadros libres y encuadre por cuadro. |

## 5. Cómo se usa (experiencia)

### 5.1 Conjunto y cuadro seleccionado

- Tocar un cuadro lo **selecciona**: queda con borde punteado y el panel pasa a "Este cuadro".
- Tocar fuera de los cuadros deselecciona, y el panel vuelve a "Conjunto".
- **Arrastrar sin selección** mueve todo el conjunto sobre la pared, como hoy.
- **Arrastrar el cuadro seleccionado** lo mueve dentro del conjunto. Se pega a los bordes y centros de sus vecinos con guías, a menos de 1 cm, igual que en un programa de diseño.
- **Doble toque** (o el botón "Encuadrar foto") entra en **modo encuadre**:
  - arrastrar mueve la foto dentro del cuadro;
  - la rueda del mouse o el pellizco agranda o achica;
  - dos dedos girando inclinan la foto.
  - Se sale con Esc, con "Listo" o tocando afuera.

### 5.2 Panel "Este cuadro"

- **Tipo:** Impresión · Canvas · Con marco. "Con marco" se ve deshabilitado, con el cartel "Próximamente".
- **Medida:** las medidas con precio para ese tipo (ver 7.1), vertical u horizontal, con el precio al lado.
- **Foto:**
  - elegir otra foto;
  - rotar 90°;
  - inclinar, con un deslizador de −15° a +15° y un botón para volver a 0;
  - zoom (también con gestos);
  - "Centrar foto".
- **Paspartú:** sin paspartú, 3, 5 u 8 cm. Solo para "Con marco"; queda deshabilitado con el marco.
- Botones **Duplicar cuadro** y **Quitar cuadro**.
- Aviso de calidad: "Esta foto alcanza para hasta 40x60" si la resolución queda por debajo de 150 ppp en la medida elegida.

### 5.3 Panel "Conjunto"

- Composiciones de partida, que después se pueden editar libremente:
  - las de hoy;
  - **Escalonado 4**, como la referencia 2;
  - **Escalonado 5**, como la referencia 3;
  - **Tríptico parejo**, como la referencia 1.
- Tipo y medida para **todos** los cuadros, en un paso: "Aplicar a todos".
- Separación entre cuadros: es la base de las composiciones de partida. Después cada cuadro se mueve libre.
- **Una foto para todos** (dos o más cuadros), con encendido y apagado:
  - la foto cubre el rectángulo que envuelve al conjunto;
  - cada cuadro muestra su parte, y los huecos entre cuadros se pierden, como en las referencias;
  - el encuadre se mueve para todo el conjunto a la vez.
- **Total del pedido**, siempre a la vista: la suma de los cuadros, con el detalle por renglón.

### 5.4 Deshacer

- Cada cambio terminado guarda una foto del estado: soltar un arrastre, cambiar una medida, rotar, etc.
- Tecla ⌘Z / Ctrl+Z deshace; ⇧⌘Z / Ctrl+Y rehace. Hay hasta 50 pasos.
- Si el foco está en un campo de texto o número, el atajo queda para el campo.
- Hay botones ↶ ↷ en la barra superior para el celular.
- Las fotos no se copian en cada paso: el historial guarda solo datos (medidas, posiciones, encuadres e índices de foto).

### 5.5 Pedido

1. Botón **"Pedir estos cuadros"**, con el total.
2. El cliente carga sus datos (nombre, email y teléfono) y elige retiro o envío, como en Pedidos de impresión.
3. Las fotos originales se suben, con barra de progreso.
4. Va a Mercado Pago.
5. Al volver, ve la página de seguimiento de siempre (`/w/<slug>/impresion/<token>`) con la imagen de su pared armada.

**Desde el panel**, el fotógrafo puede:

- hacer lo mismo con el cliente adelante, con el mismo pago;
- o tocar "Copiar enlace" para que el cliente lo haga en su casa.

## 6. Modelo de datos del probador (en el navegador)

```text
Composicion {
  fotos: Foto[]                    // originales (File) + copia liviana para pantalla
  unaFotoParaTodos: boolean
  encuadreConjunto?: Encuadre      // si unaFotoParaTodos
  cuadros: Cuadro[]
  posicionEnPared: { x, y }        // cm, centro del conjunto
}
Cuadro {
  id
  tipo: "IMPRESION" | "CANVAS" | "MARCO"
  medida: { anchoCm, altoCm }       // ya orientada
  varianteId                        // de dónde sale el precio
  x, y                              // cm dentro del conjunto (esquina superior izquierda)
  paspartuCm
  fotoIndice?                       // si no es unaFotoParaTodos
  encuadre?: Encuadre
}
Encuadre { centroX, centroY, escala, rotacion90, inclinacionGrados }  // relativo a la foto
```

- El recorte que se manda al servidor sale del encuadre, calculado con funciones puras en `lib/probador/` y con pruebas.
- **El cuadro nunca muestra vacío.** Al inclinar o al achicar, la escala mínima se ajusta sola para que la foto girada siga cubriendo todo el cuadro. Lo mismo vale para el conjunto con una sola foto.
- Para "una foto para todos", el recorte de cada cuadro es la parte de la foto que cae sobre su rectángulo dentro del conjunto.
- **Originales:**
  - el probador deja de quedarse solo con la versión achicada a 1600 px;
  - guarda el `File` original para subirlo y una copia liviana para dibujar.
  - El aviso de ppp se calcula con los píxeles del original.

## 7. Servidor

### 7.1 De dónde salen los precios

> **Actualización 30/10/2026 (al construir la etapa 2).** El catálogo real de DNX no tiene un producto con variantes por medida: tiene **un producto por medida** ("Cuadro canvas 30x40", "Cuadro MDF 50x75", "Ampliación 20x30 para mañana"). Por eso la etapa 2 **no usa tabla ni pantalla de configuración**:
>
> - El tipo sale del nombre del producto: "canvas" o "lienzo" es Canvas, "MDF" es **Foto en MDF** (un tipo nuevo que el diseño no tenía) y los que empiezan con "Ampliación" son Impresión.
> - La medida también sale del nombre.
> - Solo cuentan los productos activos, con precio mayor que 0 y que no son de VGO.
> - Si dos productos dan el mismo tipo y medida, gana el más caro, para no prometer menos de lo que se cobra en el mostrador.
> - Las medidas libres de las plantillas se llevan a la medida con precio más parecida.
> - "Con marco" queda sin precio hasta la etapa de marcos.
>
> Está en `lib/probador/catalogo.ts`. Lo que sigue de esta sección queda como referencia para cuando haga falta configurar a mano.


Va una pantalla nueva en **Configuración → Probador de cuadros**, para dueño y administrador. El estudio elige:

- **Producto de impresión:** por ejemplo, "Ampliación". Cada variante con medida legible ("20x30", "30x45"…) y precio mayor que 0 es una medida ofrecida.
- **Producto de canvas:** por ejemplo, "Cuadro canvas", con la misma regla.
- **Con marco:** deshabilitado en la v2.

La medida se lee del nombre de la variante con `normalizarMedida`.

- Las variantes sin medida legible se listan como "No se pueden usar". No se adivinan.
- El precio es el de la variante o, si no tiene, el del producto.
- El costo sale del producto. `ProductVariant` no tiene costo.

**Tamaño libre por cuadro:** el cliente elige entre las medidas con precio, no escribe centímetros.

- Así nunca se cobra una medida sin precio.
- Las referencias se arman con medidas comerciales: por ejemplo, 30x90 para los centrales altos y 40x60 para los laterales.

Se guarda en una tabla nueva y chica `FotofficeProbadorAjustes`: `workspaceId`, `productoImpresionId?`, `productoCanvasId?`, `envolturaCanvasCm` (por defecto 5), `bordeCanvas` (`DESENFOCADO` | `ESPEJO` | `CONTINUAR`, por defecto `DESENFOCADO`), `pppSalida` (por defecto automático, ver 7.5) y `activo`.

Sin ajustes cargados, el probador sigue andando para mirar, pero sin botón de pedido. Este es el comportamiento de hoy.

### 7.2 Subida de originales sin sesión

Hoy todas las subidas piden sesión del panel. Se agrega una acción pública:

1. **Pedido de subida:** recibe la cantidad, los tamaños y los tipos. Devuelve PUTs firmados al **R2 privado** bajo `probador/<workspaceId>/<borrador>/<n>.<ext>`.
   - Límites: 10 fotos, 40 MB cada una, JPEG/PNG/WebP/HEIC, firma de 600 s.
   - Limitación por IP y por estudio.
2. **Confirmación:** hace un `HEAD` de cada clave y verifica tamaño y tipo antes de aceptar el pedido.
3. **Purga:** un cron borra los borradores que no llegaron a pagarse en 72 h.

Las fotos son del cliente y no se publican: van al bucket privado.

### 7.3 Pedido

El pedido es un `FotofficePrintOrder` con `source = "PROBADOR"`, con un `FotofficePrintOrderItem` por cuadro:

- `sourceKey` es el original subido.
- `cropX/Y/W/H` es el recorte en 0–1, sobre la foto ya rotada de a 90°.
- `widthCm`, `heightCm`, `quantity = 1`, `unitPriceArs` y `unitCostArs` salen de la variante.

**Campos nuevos** (migración chica, a mano en producción como siempre):

- en el ítem:
  - `tipoProbador` (`IMPRESION` | `CANVAS` | `MARCO`, null fuera del probador);
  - `productId?`, `variantId?`;
  - `rotacion90` (0/90/180/270), `inclinacionGrados` (Float);
  - `paspartuCm`, `envolturaCm`;
  - `ordenEnConjunto`.
- en el pedido: `composicion` (Json). Es una foto de la composición completa, para el mapa de armado y para la página de seguimiento.

**El servidor vuelve a calcular todo:**

- precios desde la variante, nunca desde el navegador;
- que cada recorte sea válido;
- que cada medida siga teniendo precio.

Si algo cambió desde que el cliente armó el pedido, responde con un error claro: "El precio de 50x70 cambió; revisá el total".

Pago, webhook, numeración, trabajo por laboratorio y Caja quedan **sin cambios**: es el circuito de Pedidos de impresión. El laboratorio de cada renglón es el proveedor preferido del producto (`preferredProveedorId`).

### 7.4 Contabilidad

Igual que Pedidos de impresión hoy: un movimiento de Caja por el total, sin `Sale` con renglones.

- **Por qué:** reutiliza el circuito probado y no toca stock. Los canvas y las impresiones se hacen a pedido, no salen de un estante.
- **Costo de esta decisión:** los productos vendidos no aparecen en "Más vendidos" de Ventas.
- Si Daniel lo quiere, una etapa posterior puede registrar la `Sale` con `recordSale`, como la tienda.

### 7.5 Archivos para el laboratorio

El cron de impresiones gana un paso por ítem del probador, encima de `componerCopia`.

**Impresión:**

1. orientar con `rotate()` según EXIF y luego `rotacion90`;
2. inclinar con `rotate(inclinación)`, recortando el borde vacío: el encuadre ya garantiza que el recorte cae dentro de la foto;
3. extraer el recorte;
4. llevar a la medida exacta en píxeles al ppp de salida;
5. sRGB, JPEG 95, `density = ppp`.

**Canvas:** lo mismo, y después:

- se agrega la **envoltura** de `envolturaCm` (5 cm) por lado. El archivo final mide `(ancho + 10) × (alto + 10)` cm.
- Relleno de la envoltura según `bordeCanvas`:
  - `DESENFOCADO` (por defecto, como pidió Daniel): la imagen del frente estirada hacia afuera y desenfocada (blur fuerte), para que el costado del bastidor tenga el color de la foto sin cortar nada del frente;
  - `ESPEJO`: el borde de la foto reflejado;
  - `CONTINUAR`: la foto real que sigue más allá del recorte, si alcanza. Si no alcanza, cae a `DESENFOCADO`.
- Una línea guía fina en la esquina, opcional en Ajustes, marca dónde dobla.

**PPP de salida automático**, para no pasar el tope de 200 Mpx del cron:

| Medida | PPP |
|---|---|
| Hasta 30x45 | 300 |
| Hasta 60x90 | 200 |
| Más grande | 150 |

Ejemplo: un canvas 100x150 sale de 110×160 cm a 150 ppp, unos 6.500×9.450 px, alrededor de 61 Mpx.

**El ZIP de cada trabajo** queda así:

```text
Pedido 123 - Ana Pérez/
  00 Mapa de armado.jpg           ← el conjunto de frente, numerado, con medidas y separaciones
  Canvas 30x90/Cuadro 2 de 4.jpg
  Canvas 40x60/Cuadro 1 de 4.jpg
  ...
```

El mapa de armado se dibuja en el servidor desde `composicion`. Sirve para el laboratorio y para quien cuelga los cuadros.

## 8. Etapas

| Etapa | Qué entra | Se puede usar sola |
|---|---|---|
| **1. Editor** | Deshacer y rehacer; selección por cuadro; medida, posición, encuadre, rotación e inclinación por cuadro; paspartú opcional; una foto para todos con cuadros libres; composiciones escalonadas; tipo Impresión, Canvas o Marco (deshabilitado); vista del canvas con su borde. Sin precios ni pedido. | Sí. Mejora lo que ya está en producción. |
| **2. Precios** | Configuración → Probador de cuadros; medidas con precio por tipo; total en pantalla. | Sí. Muestra el total aunque todavía no haya pedido. |
| **3. Pedido** | Subida pública al R2 privado, migración, pedido con `source = "PROBADOR"`, pago, archivos recortados con envoltura y mapa de armado, purga. | Necesita la 2. |
| **4. Marcos reales** | Ver sección 9. | Necesita la 3. |

## 9. Marcos reales (después de la v2)

**Lo que hay hoy** (base de producción, 30/10/2026): 171 productos VGO en el catálogo de DNX (`supplierName = 'TiendaVGO'`), con precio $0.

- La medida casi siempre está **en el nombre del producto**, a veces doble: "13x18 / 30x30 cm" (foto / marco), "20x30 o 30x40cm" (con o sin paspartú).
- En las variantes se mezcla el color con la medida ("Blanco · 20x30cm").
- Las fotos del proveedor son de producto: cuadradas, sobre fondo blanco, muchas en ángulo. **No sirven tal cual** para dibujar el marco de frente sobre la pared.

**Lo que hace falta:** una tabla `FotofficeModeloMarco` unida a cada variante vendible, con:

- la medida de la ventana (la foto) y la medida exterior, en cm;
- el ancho del perfil y si trae paspartú (y cuánto);
- el color;
- una **imagen de frente** del marco, con la ventana transparente.

Esa imagen se dibuja estirada por partes (las esquinas fijas y los lados estirados), así un mismo modelo sirve para varias medidas.

**Carga de modelos:** una pantalla "Modelos de marco" donde el estudio sube una foto de frente del marco, tomada en el local, y marca las 4 esquinas de la ventana.

- El sistema la endereza con la misma homografía del probador y recorta la ventana.
- No hace falta Photoshop.

Hasta que un modelo tenga su imagen, se puede mostrar con un marco liso del color cargado, como el probador de hoy.

## 10. Pruebas

- **Funciones puras con pruebas:** encuadre a recorte; una foto para todos; ppp por cuadro; tabla de ppp de salida; medidas legibles de variantes; validación del pedido.
- **Cron:** el archivo de un canvas de prueba mide `(ancho + 10) × (alto + 10)` cm al ppp esperado, y el borde no es transparente ni negro.
- **Manual en producción, después de fusionar** (no hay staging): un pedido real chico de DNX en modo prueba de impresiones, mirando el ZIP y el correo [PRUEBA].

## 11. Decisiones tomadas por Claude (para revisar)

1. Las medidas por cuadro se eligen de una lista con precio, no en centímetros libres.
2. El pedido reutiliza Pedidos de impresión y entra a Caja sin `Sale`.
3. El borde del canvas va desenfocado por defecto, con espejo y continuar como opciones del estudio.
4. Los originales quedan en el bucket privado y se purgan a las 72 h si no se pagan.
5. El ppp de salida es automático según la medida.
6. "Con marco" se ve en la v2, deshabilitado con el cartel "Próximamente", para que el cliente sepa que viene.
7. El orden de etapas es Editor → Precios → Pedido → Marcos.

## 12. Para que decida Daniel

1. **¿Qué productos del catálogo de DNX son "Impresión" y "Canvas"?** Hace falta que existan con sus medidas en las variantes ("Cuadro canvas" · 30x40, 40x60…) y con precio.
2. **¿El canvas lleva bastidor de 3 cm o de 4,5 cm?** Con 5 cm de envoltura, un bastidor de 4,5 cm deja apenas 0,5 cm para grapar por detrás. ¿Confirmás los 5 cm?
3. **¿Querés que la venta cuente en Ventas** (más vendidos, márgenes), o alcanza con Caja (decisión 2)?
