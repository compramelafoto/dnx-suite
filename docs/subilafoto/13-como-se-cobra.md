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

## Los correos posteriores al evento (2026-09-15)

Cinco: al día siguiente del cierre y a los 3, 7, 15 y 30 días. Hacen dos cosas a
la vez — contarle al cliente que su álbum está listo y **venderle la descarga si
compró sin ella**, que es lo que el titular pidió el 15/9.

### El duplicado se evita en la base, no mirando antes

`SubilafotoEmailSent` tiene `@@unique([eventId, aviso])` y **la fila se crea antes
de enviar**. Si dos ejecuciones del worker llegan juntas, la segunda choca contra
la restricción y se va.

Consultar un registro antes de enviar no alcanza: entre la consulta y el envío
entra la otra ejecución. Es el mismo patrón que la moderación y las órdenes.

Si el envío falla, la fila queda con el error anotado. **Es preferible perder un
aviso a mandarlo dos veces**: quien recibe cinco correos iguales deja de abrir
los que importan.

### Uno por vuelta, y los viejos se saltean

Si el cron estuvo caído un día, el aviso sale igual — sigue sirviendo. Si estuvo
caído una semana, el del día 1 **no se manda**: ya no dice nada útil el día 7, y
mandar los atrasados de golpe serían tres correos en un minuto.

### A quien ya tiene la descarga se le escribe otra cosa

No se le ofrece comprar lo que ya compró. Hay un test que lo verifica en los cinco
avisos: insistir es la forma más rápida de que marque el correo como spam.

### Sin nuestra marca

El texto firma con el vendedor. Para el cliente el servicio es de quien se lo
vendió, y que apareciera Subí la Foto rompería la marca blanca. Hay un test que
verifica que nuestro nombre no aparezca en ninguno de los cinco.

### Sale en seco hasta que se habilite

Usa el runtime controlado de `@repo/communications`, que no manda nada de verdad
mientras no esté configurado y habilitado. Los avisos quedan registrados como
`DRY_RUN` con el motivo. Eso es lo que evita escribirle a gente real antes de
tiempo.

Para encenderlo hacen falta `RESEND_API_KEY` y la configuración de remitente del
runtime. Mientras no estén, todo queda anotado y nada sale.

## El borrado a los 30 días y su candado (2026-09-15)

La regla comercial es una línea: **todo se borra a los 30 días del cierre**. La
implementación no es una línea, porque un borrado no se deshace.

### El plazo se fija al cerrar, no al borrar

`retentionUntil` se escribe en el mismo `updateMany` que cierra el evento. Si se
calculara al momento de borrar, cambiar la constante movería la fecha de borrado
de eventos ya cerrados — y de los correos que ya le prometieron esa fecha al
cliente.

Los eventos que cerraron antes de que existiera el campo se completan desde su
propio `closedAt`, no desde hoy: no se les acorta ni se les alarga la vida.

### El candado

Antes de tocar nada se descarta que quede plata o una entrega en el aire. Los
motivos, del más grave al menos:

| Motivo | Qué es | Cuánto frena |
|---|---|---|
| `ya-borrado` | Ya pasó | Para siempre |
| `sin-plazo` | Nunca cerró | Hasta que cierre |
| `no-vencio` | Todavía no | Hasta la fecha |
| `disputa-abierta` | Una orden en `DISPUTED` | Hasta que se resuelva |
| `entrega-pendiente` | Pagó la descarga y nunca hubo paquete listo | **Para siempre** |
| `pago-en-curso` | Una orden `PENDING` de menos de 72 horas | 72 horas |
| `paquete-en-curso` | Un ZIP armándose | Hasta que termine |

Se devuelve **uno solo**, el más grave, porque es el que queda en la auditoría y
el que alguien va a leer cuando pregunte por qué un evento sigue ocupando lugar.

**Las 72 horas del pago en curso** no son arbitrarias: Mercado Pago aprueba una
tarjeta en segundos, pero un pago en efectivo por Rapipago o Pago Fácil tarda
hasta tres días hábiles en acreditarse. Pasado eso, una orden pendiente es un
carrito abandonado y no un pago.

**`entrega-pendiente` frena para siempre, a propósito.** Alguien pagó la descarga
y nunca la recibió; borrar ahí es quedarse con el dinero y destruir lo comprado en
el mismo movimiento. Que un evento quede ocupando lugar se arregla; esto no.

### Reclamar antes de borrar

El evento se marca `purgedAt` **antes** de borrar los archivos, con la condición
en el `where`. Si dos vueltas del cron se pisan, la segunda cambia cero filas.

El costo de este orden es que un corte a mitad de camino deja archivos sueltos en
R2. Los barre la regla de ciclo de vida del bucket, que también borra a los 30
días. El orden inverso — borrar y después marcar — permitiría que dos ejecuciones
borren a la vez, que es peor.

### Por clave, nunca por prefijo

Se junta la lista exacta: originales, variantes y paquetes, sin repetir. Un
prefijo mal armado se lleva puesto otro evento.

### Qué queda

No se borran el evento, las órdenes, los consentimientos ni la auditoría. Son el
registro de qué se vendió y de que alguien aceptó los términos. Los paquetes
quedan marcados `PURGED` con la clave en nulo, para que un enlace viejo diga
"esto se borró" en vez de dar 404 a alguien que pagó. Los enlaces de acceso se
revocan.

Sí se borran las fotos, sus variantes y las sesiones de invitado.

### El intervalo se multiplica, no se arma con una función

El relleno de plazos viejos suma 30 días a `closedAt` en SQL, porque Prisma no sabe sumar
un intervalo a una columna en un `updateMany`.

La primera versión usaba `make_interval(days => $1)` y **daba 500 en producción**. Prisma
manda los números de JavaScript como `bigint`, y `make_interval(days => bigint)` no existe:
Postgres no baja de `bigint` a `int` para resolver qué función llamar. Error 42883.

Probar la consulta con el número escrito a mano no lo detecta: con `30` literal funciona.
El problema aparece **sólo cuando el número viaja como parámetro**, que es como lo manda
Prisma.

Ahora es `${DIAS} * interval '1 day'`. Multiplicar no resuelve ninguna función, así que el
tipo del parámetro deja de importar.

### Tres por vuelta, una vez por día

El cron corre a las 4:30. No hay apuro, y de a poco se acota el daño de una
equivocación: si algo estuviera mal, se descubre con tres eventos borrados y no
con trescientos.

## El panel del cliente (2026-09-15)

Se entra con un enlace y sin cuenta. Ve su álbum, compra la descarga si la
compró sin ella, y baja el paquete cuando está.

### El cliente ve su álbum aunque esté apagado para los invitados

`guestsCanSeeAlbum` es un interruptor sobre los **invitados**: hay organizadores
que no quieren que la fiesta entera vea las fotos antes que ellos. Al cliente no
lo alcanza — es su material, y su enlace ya es la prueba de quién es.

Por eso el álbum tiene dos puertas, `/e/[codigo]/album` y `/cliente/[token]/album`,
que muestran exactamente lo mismo desde el mismo componente. Si fueran dos
pantallas distintas, una se corregiría y la otra no.

### Los enlaces vencidos se pueden renovar

El panel prometía "después pedís unos nuevos desde acá" y no había desde dónde.
Ahora sí, con tres reglas:

- Se renuevan **todas las partes juntas**: un paquete partido en tres con una
  parte que no se puede bajar no sirve de nada.
- **Cada parte estrena token.** Renovar el vencimiento sin cambiar el token
  dejaría vivo el enlace viejo, que es justamente el que puede haber circulado
  de más.
- Hay un tope de diez. De sobra para quien se olvidó de bajarlo; suficiente para
  que un enlace compartido de más no sea un servidor de archivos permanente.

Y nunca se pasa de la fecha de borrado: no tiene sentido prometer siete días si
el material se borra en dos.

### Quiénes trabajaron esa noche

El panel lista los proveedores que completaron su ficha, con su sitio y su
Instagram. Es lo que se les prometió cuando la completaron: que el evento les
sirviera para que los vieran.

Falta que también los vean los invitados, en el álbum.

### Verificado en producción (2026-09-15)

Se corrió el borrado de verdad, sobre el evento de la prueba de carga: 100 fotos, sus 200
variantes y sus 10 sesiones de invitado.

```json
{"revisados":1,"borrados":1,"resultados":[
  {"evento":"PRBE4A","borrado":true,"archivos":300,"fotos":100,"paquetes":0}]}
```

**300 archivos borrados de R2** —los 100 originales y las 200 variantes—, las filas de las
fotos y las sesiones de invitado eliminadas, el evento en `ARCHIVED` con su `purgedAt`, los
enlaces revocados, y la auditoría escrita:

```json
{"fotos": 100, "claves": 300, "archivos": 300, "paquetes": 0}
```

El álbum, que un minuto antes mostraba 100 fotos, pasó a decir *"Todavía no hay fotos
publicadas"* y a no tener **ninguna** dirección de R2 en el HTML.

La primera corrida devolvió **500**: el relleno de plazos usaba `make_interval` con un
parámetro. Está contado más arriba. Que el primer intento de un borrado destructivo falle
ruidosamente, en vez de borrar de más, es exactamente lo que tiene que pasar.
