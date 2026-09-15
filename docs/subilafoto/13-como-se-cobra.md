# Cómo se cobra

Aclarado por el titular el 2026-09-15. **Reemplaza lo que decía el documento
maestro sobre el adicional de descarga**, que planteaba un único modo de venta.

## Las dos formas de vender

El fotógrafo elige cuál usar compartiendo uno de dos enlaces.

| | Sin descarga | Con descarga |
|---|---|---|
| Enlace | `/v/[slug]` | `/v/[slug]?descarga=si` |
| Paga el cliente | El precio del fotógrafo | Su precio **+ 10%** |
| Cobra el fotógrafo | 85% de su precio | **85% de su precio** |
| Cobra la plataforma | 15% | 15% + el 10% del recargo |
| La descarga | Se la vendemos nosotros después, por correo | Va incluida, y se entrega sola dentro de las 24 horas |

Sobre una venta de $100.000:

- **Sin descarga:** el cliente paga $100.000, el fotógrafo cobra $85.000 y la
  plataforma $15.000.
- **Con descarga:** el cliente paga $110.000, el fotógrafo cobra $85.000 y la
  plataforma $25.000.

## La propiedad que importa

**El fotógrafo cobra lo mismo de las dos maneras.**

No es un detalle: es lo que hace que pueda elegir por lo que le conviene a su
cliente y no por lo que le conviene a él. Incluir la descarga no le quita nada,
sólo le ahorra al cliente una segunda compra.

Hay un test que lo fija. Si algún día deja de valer, alguien va a elegir mal por
la razón equivocada.

## El precio de la descarga lo pone la plataforma

`RECARGO_DE_DESCARGA_BPS = 1000`, en `lib/pagos/venta.ts`. **No es configurable
por vendedor** y es a propósito: el ingreso de la descarga es 100% nuestro, así
que dejar que lo fije el vendedor sería dejar que fije nuestro precio.

Es el mismo número en las dos situaciones —incluida o vendida después— porque es
el mismo producto. Cobrar distinto según cuándo se compra sería difícil de
explicar y fácil de discutir.

Los campos `downloadMode`, `downloadPercentBps` y `downloadPriceCents` del perfil
del vendedor **quedaron sin uso** con este cambio. No se borran todavía por si
alguna vez hace falta un precio por vendedor, pero hoy no los lee nadie.

## Todo se borra a los 30 días

Sin excepción, y también para la descarga: pasada la retención no se vende más.
Cobrar después sería cobrar por algo que ya no existe, y el borrado es una regla
del almacenamiento que no se deshace pagando.

Lo que el cliente **ya descargó** es suyo y no lo alcanza el borrado. Lo que se
borra es lo que queda en la plataforma.

## Lo que falta para que esto entregue algo

La venta con descarga marca el evento como comprado al momento de pagar. Falta
lo que viene después: armar el paquete y mandarlo. Es el ZIP con manifiesto
(3.5), el enlace firmado y revocable (3.6) y los correos (3.7).

Y falta lo otro que dijo el titular: **venderle la descarga por correo a quien
compró sin ella**. Es una secuencia de correos, no una pantalla.

## El paquete y la entrega (2026-09-15)

### Se transmite, no se acumula

Cada foto se lee de R2, entra al ZIP y sale hacia R2 en el mismo movimiento, con
subida multiparte. CompraMeLaFoto escribe el ZIP a disco antes de subirlo, y en
Vercel eso tiene un techo de 512 MB que un casamiento pasa sin esfuerzo.

**Sin compresión, a propósito.** Un JPEG ya está comprimido: apretarlo otra vez
gasta minutos de procesador para ahorrar cerca del uno por ciento. El ZIP acá
sirve para juntar, no para achicar.

### En partes, hasta 2 GB cada una

Un casamiento son varios gigabytes. El modelo ya preveía `partIndex`/`partCount`.
El invariante que se prueba es el que importa: **ninguna foto queda afuera de
todas las partes** — el cliente pagó por todas, y una que falta no se nota hasta
que la busca.

Una foto sola más grande que el tope va igual, en su propia parte. Es preferible
una parte pasada de tamaño a una foto faltante.

### El manifiesto es lo que lo hace verificable

`manifiesto.json` dentro del ZIP: cada archivo con su tamaño, su checksum, quién
la subió y cuándo. Sin él, un ZIP al que le faltan tres fotos se abre igual y
nadie se entera.

Las fotos van **numeradas** y no con su nombre original: hay un `IMG_0001.jpg` en
cada celular de la fiesta, y un ZIP con nombres repetidos pierde archivos al
descomprimirse, sin avisar.

### El enlace vence, se revoca y no dice nada de sí mismo

Siete días, nunca más allá del borrado del material —prometer siete días cuando
se borra en dos es prometer lo que no se puede cumplir—. El identificador es
opaco: no lleva el evento ni el cliente, así que no se puede adivinar el de otro.

**Un enlace vencido no devuelve un error, devuelve un mensaje**, y con código 410
en vez de 404: existió y ya no está, que es distinto de un enlace inventado. Quien
lo abre ya pagó.

### La descarga no pasa por nosotros

La ruta manda al cliente **directo a R2** con una firma corta. Pasar gigabytes por
una función serverless es pagar por mover bytes, arriesgarse al tope de tiempo y
perder la reanudación: bajando de R2, si se corta se retoma.

### El armado va por cron, uno por vuelta

Cada quince minutos, **un evento por invocación**. Un casamiento puede tardar
minutos y la función tiene un tope de cinco; intentar dos seguidos deja el
segundo cortado. Para la promesa de las 24 horas sobra por mucho.
