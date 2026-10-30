# Preparar para laboratorio en el Cobrador — diseño

Fecha: 30/10/2026 · Pedido de Daniel (DNX Estudio) · Estado: borrador para aprobar

## Por qué

Hoy, cuando un cliente encarga copias al laboratorio en el mostrador de DNX:

1. La cajera cobra la seña en el Cobrador con el producto (por ejemplo «Copia próxima semana 13x18 · más de 10»).
2. Al cobrar, el sistema crea el trabajo con el proveedor por defecto del producto y **le manda en el acto al laboratorio un correo con el enlace a una carpeta vacía** (`enviarTrabajosDelPedidoAlProveedor` → `enviarAlProveedor(..., { siempreConCarpeta: true })`). El laboratorio abre el enlace y ve «Todavía no hay archivos cargados».
3. Después alguien manda las fotos al laboratorio por fuera (correo o WhatsApp), con los tamaños, el papel y las cantidades escritos a mano.

Las fotos llegan al estudio por WhatsApp o correo (más adelante las va a recibir el bot). Daniel quiere que **la cajera, en el mismo momento de cobrar, cargue las fotos, elija por cada una tamaño, terminación de papel, cantidad y recorte**, y que **cada producto salga por separado a su proveedor por defecto**, con los archivos listos para descargar ordenados por tamaño, sin trabajo por fuera.

## Qué es el éxito

- La cajera arma el pedido completo en el Cobrador sin salir de la pantalla y sin mandar nada por fuera.
- Cada laboratorio recibe **un solo correo por trabajo, recién cuando los archivos están listos**, con un enlace que baja todo ordenado: `Pedido N - Cliente/13x18 Mate/2 copias/foto.jpg`.
- El correo vacío deja de salir en todos los casos (también fuera de esta función).
- El recorte que ve la cajera es el que imprime el laboratorio.

## Objetivos / no objetivos / anti-objetivos

**Objetivos**
- Un botón en el Cobrador, «Pedido para laboratorio», que abre un editor para subir muchas fotos juntas y asignar a cada una: medida, plazo, papel (mate o brillo), cantidad y recorte.
- Cambios en lote (elegir varias fotos y aplicarles medida, plazo, papel o cantidad de una vez).
- Al tocar «Listo», el ticket se arma solo: un renglón por producto del catálogo, con la cantidad total y el precio por escalón («más de 10», «más de 50»).
- Al cobrar (seña o total), un trabajo por producto con su proveedor por defecto; los archivos se preparan en el servidor y el pedido sale solo al laboratorio.
- Volver a editar el pedido antes de cobrar (tocar el renglón reabre el editor).

**No objetivos (esta etapa)**
- Copias instantáneas (Kodak del local): ya tienen su propio «Preparar». Si una foto se marca «instantánea», no entra en este editor.
- Recibir las fotos desde el bot de WhatsApp directo a este editor (etapa siguiente; los pedidos del bot ya tienen su propio circuito).
- Cobrar con Mercado Pago desde el editor: se cobra con lo que ya tiene el Cobrador.
- Ampliaciones con montaje, marcos o retoque.

**Anti-objetivos (sería un fracaso aunque funcione)**
- Que el laboratorio reciba un correo sin archivos o reciba dos correos por el mismo trabajo.
- Que la cajera tenga que entrar a otra pantalla para terminar el pedido.
- Que el archivo que imprime el laboratorio tenga otro recorte o menos calidad que lo que vio la cajera.
- Romper el «Preparar» de las copias Kodak, la foto carnet o los pedidos de impresión online y por WhatsApp.

## Cómo funciona (lo que decidió Daniel)

1. **Primero las fotos, el ticket se arma solo** (opción B del boceto, elegida por Daniel).
2. **La cajera resuelve el recorte** de cada foto (no el laboratorio).
3. **Cada producto sale a su proveedor por defecto**, por separado.
4. Por cada foto se elige **tamaño, papel y cantidad**.

## Flujo para la cajera

1. En el Cobrador, con o sin cliente elegido, toca **«Pedido para laboratorio»** (botón junto a la búsqueda de productos; visible sólo si el estudio tiene productos de copia de laboratorio en el catálogo).
2. Se abre el editor (pantalla completa, igual de estilo que el editor de copias Kodak). Arrastra las fotos o las elige; se suben de a 3 con barra de progreso.
3. Cada foto llega con una propuesta automática: la medida y el plazo que dejó elegidos arriba («Para todas: 10x15 · próxima semana · mate · 1 copia»), recorte automático al centro, y el aviso «Pixelada» si no alcanza la resolución para esa medida.
4. En la grilla puede elegir varias fotos y cambiarles medida, plazo, papel o cantidad. Tocando una foto, la abre en grande para ajustar el encuadre (mover, zoom, girar 90°, recortar o encajar con borde) — el mismo editor de una foto que las copias Kodak.
5. Abajo ve el resumen en vivo: «10x15 mate próxima semana: 24 copias · 30x45 brillo para mañana: 2 copias · Total $ …».
6. Toca **«Listo»**. El ticket queda con un renglón por producto (por ejemplo «Copia próxima semana 10x15 · más de 10 × 24» y «Ampliación 30x45 para mañana × 2»), marcados para ir al pedido con seña.
7. Cobra como siempre: seña o total, con el medio que sea. Puede tocar cualquiera de esos renglones para reabrir el editor; si cambia algo, los renglones se rehacen.
8. Al terminar de cobrar ve: «Listo. Las fotos se preparan y el pedido sale solo a Fotolag y La Isla en unos minutos».

## Cómo se construye (decisiones y piezas a reutilizar)

### Datos de cada foto
Se reutiliza la **preparación** del módulo de impresión (`FotofficePreparacionImpresion`, `FotofficeOriginalImpresion`, `FotofficePiezaImpresion`, bucket R2 privado, subida directa y vista previa en `lib/impresion/preparaciones.ts`). Hace falta que una preparación pueda ser **de laboratorio**:
- Preparación con un tipo nuevo (por ejemplo `tipo = LABORATORIO`) sin producto fijo: el producto lo define cada foto.
- Cada pieza guarda, además de la receta (recorte) y la cantidad: **medida** (`"10x15"`), **plazo** (`MANANA` | `SEMANA`) y **papel** (`MATE` | `BRILLO`). Columnas nuevas en `FotofficePiezaImpresion` (nullable, sólo para piezas de laboratorio).
- Límites propios para laboratorio, más altos que los de la Kodak (`FOTOS_MAX = 60`): **200 fotos por pedido y 99 copias por foto** (llamada del constructor; ver abajo).

### Medidas, plazos y precios
- El menú de medidas y plazos sale del **catálogo de productos de copia** leído con `leerProductosDeCopia` (`lib/impresiones/catalogo-copias.ts`), el mismo que usa el bot. Sólo se ofrecen plazos `MANANA` y `SEMANA` (no instantánea).
- El precio y el producto de cada renglón salen de `cotizarCopias` (escalones «más de N» por medida y plazo, con la regla de pocas copias que ya usa el bot).
- Papeles: mate y brillo; se ofrecen los que estén activos en `FotofficePrintSettings` (`paperMatte`, `paperGlossy`). Si no hay configuración, los dos.

### El ticket
- «Listo» guarda las piezas en el servidor, cotiza ahí (el navegador no se cree) y devuelve los renglones: `{ productId, cantidad, precioUnitario }[]`. El POS los agrega como renglones normales con seña, todos atados al mismo `preparacionId` del pedido de laboratorio.
- Reabrir el editor desde cualquiera de esos renglones reemplaza el grupo completo de renglones.
- Se levanta el bloqueo actual de `pos.tsx` («Las fotos preparadas se cobran solas») **sólo para preparaciones de laboratorio**.

### Al cobrar
- El cobro sigue por `cobrarConPedidoAction`: crea el pedido y un trabajo por renglón con su proveedor por defecto (`FotofficeProductoProyecto.proveedorId`).
- En la misma transacción, la preparación queda atada al pedido y cada pieza al trabajo de su producto.
- Se crea un **pedido de impresión** `FotofficePrintOrder` con `source = "MOSTRADOR"`, estado `PAGADO`, con un ítem por pieza: `sourceKey` = clave del original en R2, medida, cantidad, papel, plazo, `proyectoId` = el trabajo ya creado. Así lo toma el **cron existente de pedidos de impresión** (`/api/cron/impresiones`, `prepararPedido`), que ya arma el ZIP ordenado, lo deja en la carpeta del trabajo, emite el enlace del laboratorio, manda el correo, mueve el trabajo a «En el proveedor» y reintenta / avisa al estudio si falla. Los ítems que ya tienen trabajo no crean otro (ya funciona así).
- El dinero lo registra el Cobrador (Caja, seña, saldo) como hoy; el pedido de impresión de mostrador **no** genera movimientos de Caja ni cobros propios (`paidArs`, MP) — sólo sirve para preparar y mandar.

### Recorte fiel
`prepararPedido` hoy recorta con un rectángulo simple (`recortarParaImprimir`). Para los ítems de mostrador se usa la **receta completa** de la pieza (`renderizarPieza` de `lib/impresion/render.ts`: girar, enderezar, recortar o encajar con borde, ajustes y nitidez) a la medida real en mm a 300 ppp (o lo que use hoy el laboratorio). El ítem guarda una referencia a la pieza para leer su receta.

### El correo vacío
`enviarTrabajosDelPedidoAlProveedor` deja de mandar correos con la carpeta vacía para las copias y ampliaciones (alcance exacto en «Precisiones», punto 3).

### Vencimientos
- Los originales de la preparación se borran a los 30 días (`purgarPreparaciones`). El ZIP de la carpeta sigue la regla de la carpeta (30 días, se extiende al compartir). Sin cambios.

## Qué hay que tocar (orientativo)
- `prisma/schema.prisma`: tipo de preparación; medida, plazo, papel y referencia en pieza; referencia a pieza en `FotofficePrintOrderItem`; valor `MOSTRADOR` en `source`. Migración a mano (rama `development` de Neon = producción).
- `lib/impresion/`: preparación de laboratorio, guardar piezas con medida/plazo/papel, cotizar y validar para cobrar.
- `components/copias/`: editor de laboratorio basado en `EditorCopias` / `EditorUnaFoto` / `TarjetaFoto` con los selectores nuevos.
- `app/(shell)/ventas/pos.tsx` y `pedido-actions.ts`: botón, renglones agrupados, reabrir, cobro y creación del pedido de impresión.
- `lib/impresiones/preparar-servidor.ts`: recorte con receta para ítems de mostrador.
- `lib/proyectos/proveedor.ts`: no mandar carpetas vacías.
- Instructivo nuevo en `lib/instructivos/guias/` y actualizar «Mandar a mano un pedido al laboratorio».

## Precisiones (después de la revisión del constructor)

1. **Pocas copias (menos que el primer escalón).** Se respeta la regla que ya usa el bot (`cotizarCopias`): se cobra el precio de la «Copia instantánea» de esa medida y sale al laboratorio «para mañana». En el ticket el renglón es el producto instantáneo (su precio), pero **ese renglón pertenece al grupo de laboratorio**: no muestra el «Preparar» de la Kodak ni lo frena el bloqueo de preparaciones, y su trabajo toma el laboratorio del producto «para mañana» de esa medida. Si de una misma medida hay pocas copias en mañana y en semana, las dos se juntan en un solo renglón «para mañana».
2. **Qué laboratorio.** Para cada renglón: el proveedor por defecto del producto (`FotofficeProductoProyecto.proveedorId`); si no tiene, `Product.preferredProveedorId`; para el renglón de pocas copias, el del producto «para mañana». El mismo valor se escribe en el trabajo **y** en cada ítem del pedido de impresión, así `prepararPedido` nunca ve laboratorios distintos. Si un producto no tiene regla de proceso, su trabajo se crea igual (tipo «Para retirar», como hoy con seña) y al mandarse pasa a «En el proveedor».
3. **El arreglo del correo vacío se acota a copias.** Para no frenar pedidos que hoy funcionan (marcos, montajes, pedidos por descripción), `enviarTrabajosDelPedidoAlProveedor` sólo deja de mandar en el acto: (a) los trabajos de un pedido de laboratorio de mostrador (los manda el cron) y (b) los trabajos cuyo producto es una copia o ampliación del catálogo (`leerProductosDeCopia` lo reconoce) y cuya carpeta no tiene archivos `LISTO`. Esos quedan sin enviar, con la nota «Falta subir los archivos para mandarlo a [laboratorio]», y el botón «Enviar» del tablero sigue disponible. El resto de los productos sigue como hoy.
4. **El pedido de impresión de mostrador es interno.** No le manda correo al cliente (no se copia el email del cliente al pedido, o se saltea `avisarPedidoConfirmado` para `MOSTRADOR`), no tiene página de seguimiento para el cliente y no suma dinero (Caja la lleva el Cobrador). En la lista de pedidos de impresión aparece con la etiqueta «Mostrador» y sin montos, para poder ver si salió o reintentar el envío.
5. **Renglones bloqueados.** Los renglones del grupo de laboratorio no se editan a mano en el ticket (cantidad, precio, quitar uno): se cambian sólo reabriendo el editor. Se puede quitar el grupo entero.
6. **Resolución del archivo final.** Se renderiza a la medida real a 300 ppp, **sin agrandar nunca más allá de la resolución del original** (si el original da menos, se exporta a la resolución que da y la foto ya vino marcada «Pixelada» en el editor). JPEG calidad 95.
7. **Cliente obligatorio para cobrar**, como hoy en el cobro con pedido. El editor se puede abrir antes de elegirlo.

## Lo que queda al constructor
- Nombres de componentes, acciones y columnas.
- Diseño visual fino del editor, siguiendo `EditorCopias`.
- Cómo se marca en el ticket que un grupo de renglones pertenece al mismo pedido de laboratorio.

## Llamadas mías (para que Daniel las revise)
- Límites: 200 fotos por pedido y 99 copias por foto.
- Si el estudio no configuró papeles, se ofrecen mate y brillo.
- El laboratorio de cada trabajo es el proveedor por defecto del producto (`FotofficeProductoProyecto.proveedorId`); si no tiene, el `preferredProveedorId` del producto; si no tiene ninguno, el trabajo se crea sin proveedor y se avisa en el cobro.
- Los renglones del ticket van marcados con seña (van a pedido aunque se cobre el total).
- El arreglo del correo vacío vale para todas las copias y ampliaciones, no sólo las de este editor; el resto de los productos no cambia.
- Pocas copias: precio de la instantánea, como el bot.
- Renglones bloqueados en el ticket; el pedido de mostrador no le escribe al cliente.
- 300 ppp sin agrandar el original.
