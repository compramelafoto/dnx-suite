# Venta de videos

Estado al 2026-09-15. En producción y funcionando.

## Cómo funciona

1. El fotógrafo sube el video desde el panel del álbum. Va directo a R2.
2. Un **Cloud Run Job** (`video-worker`, proyecto `dnx-video-worker`, región
   `us-east1`) lo procesa: adelanto con marca de agua, miniatura y 20
   fotogramas para reconocimiento facial. Lo despierta **Cloud Scheduler cada
   15 minutos**; no hay ninguna máquina encendida esperando.
3. El cliente ve el adelanto y el precio con el 15% ya incluido, lo agrega al
   mismo carrito que las fotos y **paga una sola vez**.
4. Descarga todo desde la misma pantalla, con un link firmado que vence a los
   10 minutos.
5. Si manda una selfie, la búsqueda le devuelve fotos **y** videos, con el
   minuto exacto donde aparece.
6. El fotógrafo puede dejar la galería **oculta hasta la selfie**: nadie ve los
   videos salvo quien fue reconocido en ellos. Los que no tienen ninguna cara
   (un paisaje, la cancha, un detalle) se muestran igual; los que todavía no se
   analizaron **no**, porque podrían tener a cualquiera. La regla vive en
   `lib/videos/hidden-album-videos.ts`, con pruebas.

## Lo que está pendiente

### Álbumes de eventos con organizador: la compra está bloqueada

**Es la única limitación conocida, y es deliberada.**

Cuando el cobro de un álbum lo recibe el organizador de un evento
(`collectorType === "ORGANIZER"`), el reparto se divide entre más partes que en
una venta común: fotógrafo, plataforma y organizador. Ese reparto está resuelto
para fotos —vive en `buildAlbumOrderMercadoPagoCheckoutSplit`— pero **no para
video**, porque las líneas de video no pasan por ese builder: se suman al
`marketplaceFee` por fuera.

Antes que repartir mal la plata, no se vende: el endpoint devuelve 409 con el
código `VIDEO_ORGANIZER_SPLIT_PENDING` y un mensaje que invita a escribir.

Está en `app/api/a/[id]/video-orders/route.ts`. El checkout mixto (fotos +
videos por `app/api/a/[id]/orders/route.ts`) **no tiene ese corte**: ahí el fee
de video se suma al split de fotos, lo cual es correcto sólo si el álbum no
tiene organizador. **Si aparece un caso real de evento con organizador que
quiera vender video, hay que revisar los dos caminos, no sólo el bloqueado.**

Cómo resolverlo cuando haga falta: pasar las líneas de video por el mismo
builder del split, o extenderlo para que acepte un monto de video con su propio
reparto.

### Detalles menores

- El archivo comprado baja con el nombre que tiene en R2 (un identificador), no
  con el nombre original del fotógrafo. Poner un nombre amable pide tocar
  `lib/r2-client.ts`, que es compartido con las fotos.
- Los videos procesados **antes** del 14/09/2026 conservan lo suyo: adelanto
  largo, sin marca y posiblemente acostado. Para arreglarlos hay que
  reprocesarlos (poner `VideoAsset.processingStatus = 'UPLOADED'` y su
  `VideoProcessingJob` en `PENDING`, y ejecutar el job).

## Decisiones tomadas, con su motivo

**Los videos viven en `VideoOrderItem`, no en `OrderItem`.** Esa tabla exige
`photoId` y la dan por sentada 134 archivos (precios, fee, reparto, mails,
zips, reportes). El pedido sigue siendo uno solo —un pago, un fee, un reparto—
y los videos van en su propio renglón, así la venta de fotos no se toca.

**Cuidado con las unidades.** `VideoAsset.priceCents` guarda centavos reales
($10.000 = 1.000.000) y `Order.totalCents` guarda pesos enteros ($10.000 =
10.000), con el sufijo `Cents` por historia. Toda la conversión pasa por
`lib/videos/video-order-pricing.ts`, con tests.

**El adelanto dura lo menor entre 15 segundos y un cuarto del video.** Antes
era una cantidad fija y en un video de 10 segundos mostraba 6: el 60% del
producto. La protección real es el recorte, no la marca.

**La marca usa el mismo `watermark.png` que las fotos**, en rejilla 3x3 al 45%
de opacidad, y también va en la miniatura. Antes la miniatura salía limpia en
una URL pública: ese era el agujero, no el adelanto.

**El adelanto se sirve por el dominio del sitio**, no por `pub-….r2.dev`. Ahí
el reproductor fallaba con "URL no accesible" aunque el archivo estuviera sano.
De paso, la ubicación real del archivo no viaja al navegador.

**El adelanto no se cachea en el CDN compartido.** Con `Cache-Control: public`
el CDN guardaba el primer fragmento del video y lo repartía con estado 200 en
lugar de 206: una respuesta contradictoria que Safari y el iPhone rechazan, y
el video no arrancaba. El código siempre estuvo bien; la petición ni siquiera
llegaba al servidor. Ahora va `private` con `Vary: Range`, en
`lib/videos/preview-response-cache.ts` con pruebas. Si algo en producción
contradice al código, mirá el encabezado `age:` antes de dudar del código.

**Un solo botón de compra.** Cuando el álbum vende videos, el botón fijo de la
grilla desaparece y queda el flotante, que vale para las dos pestañas y dice
qué se está comprando. Antes se veían los dos a la vez y el fijo, que sólo
contaba fotos, llevaba a "no hay ítems seleccionados" con un video como única
selección.

**Quién recibe su descarga es una regla aparte y probada.** Un pedido de sólo
video no tiene fotos digitales; la entrega miraba nada más que las fotos y
cortaba antes de crear el link. Una compra real quedó sin entregar por eso. La
condición vive en `lib/digital-download/order-needs-delivery.ts`.

**Reembolsar un pedido revoca su link de descarga.** Es
`revokeOrderDownloadTokens` dentro de `reverseAlbumOrder`. Si un link de
descarga que funcionaba empieza a dar 404, verificá primero si el pedido pasó a
`REFUNDED`: es el sistema haciendo lo correcto, no una rotura.

**ffmpeg ya rota al decodificar.** Agregarle un `transpose` propio acostaba los
videos verticales. Ver `src/rotation.test.ts` en el worker.

## Verificación

- El circuito completo probado en producción con un video real: 20 fotogramas,
  16 caras detectadas, adelanto vertical de 4,6 s con marca.
- 141 tests en la app y 22 en el worker.
- El typecheck de `apps/compramelafoto` **necesita**
  `NODE_OPTIONS=--max-old-space-size=8192`: sin eso crashea y termina con
  código 0, lo que parece un chequeo limpio y no lo es.
