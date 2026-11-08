# Cierre del circuito de pedidos a proveedores

Fecha: 07/11/2026. Pedido de Daniel: «cerrar el circuito en cada producto». En DNX Estudio, Sabina y
Camila venden desde el mostrador y a los proveedores les llega un correo sin fotos ni archivos.
Además tienen que poder ver, en cada venta, si el pedido se mandó y si el proveedor lo descargó.

No es una función nueva: es terminar el circuito que FOTOFFICE ya trae y que explican los
instructivos «Mandar a mano un pedido al laboratorio», «Organizar los trabajos en el tablero En
curso» y «Armar un pedido para el laboratorio desde el Cobrador».

## Lo que pasaba (datos reales de DNX, 28/10 al 07/11)

| Productos | Proveedor | Qué pasaba |
|---|---|---|
| Copias y ampliaciones (MAN-, SEM-, AMP-) | Fotolag | Se venden como un producto común, sin pasar por «Pedido para laboratorio». Desde el PR 884 no salen vacías, pero quedan con la nota «Falta subir los archivos…» y nadie las ve: 7 trabajos sin salir (0023, 0026, 0027, 0028, 0033, 0035, 0036). |
| Canvas, imanes, MDF, plotter (La Isla); dípticos (Román) | La Isla, Román | Al cobrar sale en el acto un correo con el enlace a una carpeta **vacía**. Es el correo vacío del que se quejan. |
| Revelado de rollo | Estudio del Bajo | Sale al cobrar. Está bien (el rollo es físico), pero el correo no dice la cantidad. |
| Fotolibros | Román | No sale al cobrar (bien). Se manda a mano con «Enviar» cuando el diseño está listo. |
| Digitalización, instantáneas, polaroid, carnet | — | Se hacen en el estudio. Sin cambios. |

Y nadie sabía si el proveedor abrió el enlace o bajó los archivos: la descarga va directo al
almacenamiento y el sistema no se entera.

## Decisión de Daniel

Si se vende un producto que necesita archivos y todavía no se subieron, **la venta no se frena**:
el trabajo queda pendiente, a la vista, y sale solo cuando se suben los archivos.

## Regla nueva: un pedido sale al proveedor sólo cuando está completo

Para cada trabajo con proveedor:

1. **Necesita archivos** (regla por defecto: copias, ampliaciones, canvas, imanes, MDF, plotter,
   dípticos, fotolibros, cualquier otro): el correo sale recién cuando la carpeta tiene archivos
   listos. Nunca sale un correo con la carpeta vacía, ni al cobrar ni con el botón «Enviar».
2. **Se manda sin archivos** (material físico, como el revelado de rollo): sale al cobrar, como
   hoy. Se marca en el producto con una casilla nueva en «Proveedor por defecto»: «El material es
   físico (se manda sin archivos)». Se guarda en `FotofficeProductoProyecto.envioSinArchivos`.
3. Fotolibros y trabajos de «Pedido para laboratorio» (mostrador) siguen como hoy: el fotolibro no
   sale al cobrar y el mostrador lo manda el cron de impresiones con su ZIP.

### Cuándo sale solo después de subir los archivos

El cron de impresiones (cada 5 minutos) busca trabajos con proveedor, sin enviar, que necesitan
archivos y ya los tienen: todos los archivos en LISTO (ninguno subiéndose) y el último subido
hace más de 5 minutos (para no mandar mientras la cajera todavía está subiendo). Los manda con el
mismo `enviarAlProveedor` de siempre. Sólo toma trabajos creados desde el 07/11/2026, para no
mandar de golpe trabajos viejos que ya salieron por WhatsApp. Fotolibros y trabajos de mostrador
quedan afuera. El botón «Enviar a [proveedor]» de la ficha sigue disponible para mandarlo antes.

### El botón «Enviar» manual

Si el trabajo necesita archivos y la carpeta está vacía, «Enviar a [proveedor] por correo» no
manda nada y avisa: «Falta subir los archivos. Subilos en la carpeta del trabajo o, si ya le
llegaron por otro lado, usá “Marcar enviado”.» «Marcar enviado» (sin correo) sigue igual.

### El correo

Suma la cantidad (de los renglones del pedido con ese producto). Para material físico dice
«El material lo llevamos al local» en vez del enlace a archivos.

## Seguimiento: enviado, abierto, descargado

Dos fechas nuevas en `FotofficeProyecto`:

- `proveedorAbiertoAt`: la primera vez que se abre la carpeta con el enlace del laboratorio.
- `proveedorDescargadoAt`: la primera vez que el laboratorio baja un archivo. Las descargas del
  enlace del laboratorio pasan por una ruta propia
  (`/api/w/[slug]/archivos/[token]/descargar/[archivoId]`) que anota y redirige a la URL firmada.

Cada una deja una nota en el trabajo la primera vez («Fotolag abrió el pedido», «Fotolag descargó
los archivos»). Los enlaces del cliente no anotan nada.

## Cómo se ve en cada venta

Un estado de envío por trabajo, calculado en un módulo puro (`lib/proyectos/estado-envio.ts`):

| Estado | Texto | Color |
|---|---|---|
| Sin proveedor | (no se muestra) | — |
| Faltan archivos | «Faltan archivos para [proveedor]» | rojo |
| Esperando para salir | «Sale solo a [proveedor] en unos minutos» | ámbar |
| Por enviar (físico) | «Por enviar a [proveedor]» | ámbar |
| Enviado | «Enviado a [proveedor] dd/mm hh:mm» | azul |
| Abierto | «[proveedor] lo abrió dd/mm hh:mm» | azul |
| Descargado | «[proveedor] descargó dd/mm hh:mm» | verde |

Se ve en:
- la ficha del pedido (tarjeta «Proyectos», un renglón por trabajo);
- las tarjetas del tablero «En curso» (una etiqueta debajo del proveedor);
- la ficha flotante del trabajo (el dato «Envío»).

## Instructivos

Se actualizan las guías «Mandar a mano un pedido al laboratorio», «Organizar los trabajos en el
tablero En curso» y «Tomar un trabajo para retirar» con la regla nueva y los estados.

## Fuera de alcance

- Que el editor de fotolibros deje el archivo final en la carpeta del trabajo solo (hoy se sube a
  mano). Queda anotado.
- Obligar a usar «Pedido para laboratorio» en el Cobrador.

## Datos

Migración `20270129090000_fotoffice_cierre_pedidos_proveedor`: `envioSinArchivos` en
`FotofficeProductoProyecto` (por defecto false) y las dos fechas en `FotofficeProyecto`. Se aplica a
mano en la base de producción (rama development) y se marca el producto «Revelado de rollo»
(DIG-REV) de DNX como material físico.
