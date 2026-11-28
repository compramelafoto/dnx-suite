# CLF — «Todas mis fotos» que se van sumando

Fecha: 27/11/2026 · Estado: diseño para revisar (no hay nada programado)

## El problema

Un fotógrafo cubre un evento de varios días. El participante compra el pack
«Todas mis fotos» el primer día y se lleva solamente las fotos que había en ese
momento. Las que el fotógrafo sube después no le llegan; tendría que volver a
comprar.

Hoy pasa porque al pagar se arma el pedido con una lista fija de fotos
(`lib/album-packs/resolve-album-pack-order-lines.ts`) y el panel de descarga
muestra exactamente esa lista (`lib/digital-download/load-download-center.ts`).

## La idea

Una opción dentro del pack «Todas mis fotos», no un tipo de evento:

> ☐ **Este evento dura varios días**
> El cliente puede comprar el primer día. Las fotos en las que aparezca que
> subas después se le van a sumar solas a su panel de descarga.

No depende de una cantidad de días: funciona mientras la opción esté
habilitada en el pack y el álbum siga activo.

Además, en la pantalla de «Avisame cuando estén las fotos», si el álbum todavía
no tiene fotos, aparece **«Comprar todas mis fotos apenas se suban»**. Es la
misma compra, sólo que arranca con cero fotos.

## Reglas

1. **Sólo packs digitales.** La opción no se puede tildar si el pack incluye
   copias impresas: cada foto nueva sería una impresión que nadie cobró.
2. **Precio fijo.** Se paga una vez, aparezcan 5 o 80 fotos. Se lo decimos al
   fotógrafo al lado del precio: «Este precio cubre todas las fotos en las que
   aparezca, aunque las subas después».
3. **Hasta cuándo se suman.** Mientras el álbum esté activo. Se corta antes si
   el fotógrafo toca **«Terminé de subir este evento»**. Después de eso no se
   suma nada más y el panel queda cerrado (sigue descargable).
4. **Apagar la opción no le saca nada a quien ya compró.** Apagarla frena las
   ventas nuevas con esa promesa; los compradores anteriores siguen recibiendo
   hasta que el álbum cierre o el fotógrafo marque «Terminé de subir».
5. **Selfie guardada con permiso.** Para encontrar a la persona en las fotos de
   mañana hay que conservar su cara hasta que cierre el álbum. Al comprar se
   pide aceptar: «Guardamos tu selfie sólo para sumarte las fotos nuevas de este
   evento. Se borra cuando el álbum cierra». Sin ese permiso, se ofrece el pack
   común (lo que hay hoy).
6. **Si al final no aparece en ninguna foto, se devuelve el dinero solo, por
   Mercado Pago.** Únicamente cuando la compra terminó con **cero fotos**: si
   tiene aunque sea una, no hay reintegro. Las fotos que el comprador sacó con
   «Esta no soy yo» cuentan igual como fotos recibidas (si no, alguien podría
   comprar, descargar, marcar todas y pedir el dinero). El fotógrafo lo acepta
   al habilitar la opción. Detalle en «Reintegro automático».
7. **Las fotos no llegan al instante.** El reconocimiento facial procesa las
   fotos de a poco y el aviso sale cuando el álbum termina de analizarse. Se
   avisa en pantalla: «Las fotos nuevas pueden tardar unas horas en aparecer».
8. **«Esta no soy yo».** El comprador puede sacar una foto de su panel si el
   reconocimiento se equivocó. No cambia el precio; sólo limpia el panel. Si
   falta una foto, puede pedírsela al fotógrafo con el reclamo que ya existe
   («Esta foto es mía»).

## Pantallas

### Fotógrafo — configuración del pack

En el pack «Todas mis fotos» (`components/dashboard/album-packs/AlbumPacksSection.tsx`):

- Tilde «Este evento dura varios días», con el texto de arriba.
- Si el pack tiene impresiones: tilde gris con «Sólo disponible en packs de
  fotos digitales».
- Al tildarlo por primera vez, aviso con las reglas 2, 4 y 6 y un botón
  «Entendido».

### Fotógrafo — álbum

- Etiqueta «Varios días · se siguen sumando fotos a N compradores».
- Botón «Terminé de subir este evento» (con confirmación: «Los compradores ya
  no van a recibir fotos nuevas»).

### Comprador — álbum con fotos

En la oferta del pack (`components/photo/FaceBulkOfferModal.tsx` y
`ClientAlbumView.tsx`):

- «Comprar todas mis fotos · **incluye las que se suban después**».
- Casilla del permiso de la selfie (regla 5).

### Comprador — álbum sin fotos todavía

En la pantalla de «Avisame» (la que usa `app/api/a/[id]/register-interest`):

- Además de «Avisame», botón «Comprar todas mis fotos apenas se suban» con el
  precio y el texto: «Si al final no aparecés en ninguna foto, te devolvemos el
  dinero».
- Sólo se muestra si el álbum tiene un pack «Todas mis fotos» con la opción
  habilitada.

### Comprador — panel de descarga

En el mismo panel de siempre (`app/descargas/[token]`):

- Arriba: «Este evento sigue sumando fotos. Te avisamos por mail cuando
  aparezcan nuevas».
- Las fotos que se sumaron desde la última visita, marcadas como **Nuevas**.
- Compra anticipada sin fotos aún: «Todavía no hay fotos tuyas. Apenas el
  fotógrafo las suba y te encontremos, aparecen acá».
- Cada foto con la opción «Esta no soy yo».
- Al cerrar: «El fotógrafo terminó de subir este evento. Estas son todas tus
  fotos».

### Mail

«Aparecés en 12 fotos nuevas de *Nombre del evento*. Ya están en tu panel»,
con el link al panel (no al álbum, porque ya pagó).

## Cómo funciona por dentro

Más de la mitad ya existe:

- `AlbumInterest` guarda la cara de una persona (`faceId`) con su permiso.
- `matchFacesWithInterested` (en `lib/analysis/analysis-runner.ts`) compara
  cada foto nueva contra esas caras y anota la coincidencia en `FaceMatchEvent`.
- El cron `/api/internal/face-matching/notify` manda el mail cuando el álbum
  terminó de analizarse.

Lo que falta:

1. **Marcar el pack.** Campo nuevo en `AlbumPack`, por ejemplo
   `keepsAddingPhotos Boolean @default(false)`, y en `Album` la fecha
   `uploadsFinishedAt` para el botón «Terminé de subir».
2. **Recordar la promesa en la compra.** Al pagar un pack con la opción, se crea
   (o se reutiliza) el `AlbumInterest` del comprador con su cara, y se lo vincula
   al pedido. La búsqueda por selfie de hoy no deja ese registro, así que hay que
   crearlo en ese momento.
3. **Fotos sumadas aparte del pedido.** Tabla nueva, por ejemplo
   `OrderAddedPhoto (orderId, photoId, addedAt, removedByClientAt)`. No se
   agregan líneas al pedido: eso desarmaría los montos, la comisión y los
   informes de ventas. El panel muestra las fotos del pedido más estas.
4. **Sumar cuando hay coincidencia.** Cuando se crea un `FaceMatchEvent` de un
   interesado vinculado a una compra con la opción, se agrega la foto a
   `OrderAddedPhoto`. Usar un umbral más exigente que el aviso actual (hoy 70%
   de parecido) para no meterle fotos de otra persona: por ejemplo 90%.
5. **Que la cara no venza antes de tiempo.** `AlbumInterest.expiresAt` tiene
   que llegar hasta que el álbum cierre; al cerrar, se borra la cara como ya se
   hace hoy con los interesados.
6. **Permiso de descarga.** Las rutas que entregan fotos
   (`app/api/downloads/[token]`, `app/api/descargas/[token]/fotos/[photoId]/vista`)
   tienen que aceptar también las fotos de `OrderAddedPhoto`, no sólo las del
   pedido. Lo mismo el armado del ZIP.
7. **Mail del comprador.** Variante del aviso actual que apunta al panel.
8. **Cierre y reintegro.** Al cerrar el álbum (o al «Terminé de subir»), buscar
   compras con la opción que terminaron con cero fotos y devolverlas solas
   (sección siguiente).

## Reintegro automático

Decidido: automático por Mercado Pago, **sólo si la compra terminó con cero
fotos**.

- **Cuándo se dispara.** Una sola vez, al cerrar: cuando el fotógrafo toca
  «Terminé de subir» o cuando vence el álbum. Antes de devolver, se espera a que
  el álbum termine de analizarse (puede haber fotos en cola que todavía no se
  compararon).
- **Qué cuenta como «cero fotos».** Ninguna foto en el pedido y ninguna en
  `OrderAddedPhoto`, contando también las sacadas con «Esta no soy yo».
- **Cómo se devuelve.** Reintegro total del pago con la API de reintegros de
  Mercado Pago. Con el reparto del pago, el cobro está en la cuenta del
  fotógrafo, así que el reintegro se hace con su vínculo de Mercado Pago y la
  comisión de la plataforma vuelve en proporción. Hay que confirmarlo en
  homologación antes de encenderlo.
- **Si no se puede devolver solo.** Hay vínculos de fotógrafos caducados, el
  pago puede ser muy viejo, o el fotógrafo puede no tener saldo. En esos casos
  no se reintenta a ciegas: la compra queda en una lista «Reintegros
  pendientes» del panel de administración, con el motivo, para resolverla a
  mano.
- **Que no se devuelva dos veces.** Se guarda en el pedido el estado del
  reintegro (pendiente, hecho, falló) y el número de reintegro de Mercado Pago.
  Si se vuelve a correr el cierre, una compra ya devuelta se saltea.
- **Avisos.** Al comprador: «No aparecés en ninguna foto de *evento*, te
  devolvimos $X por Mercado Pago». Al fotógrafo: «Devolvimos N compras sin
  fotos de *evento*».

## Decisiones pendientes

- **Umbral de parecido** para sumar fotos solas (propuesta: 90%).
- **Plazo máximo**: si el fotógrafo nunca toca «Terminé de subir», el corte es
  el vencimiento del álbum. Confirmar que alcanza.

## Etapas

1. Opción en el pack + fotos que se suman al panel + mail (compra con fotos ya
   cargadas).
2. Compra anticipada desde «Avisame» + reintegro si queda en cero.
3. «Esta no soy yo» y el botón «Terminé de subir este evento».

## Pruebas

- Compra con 10 fotos; se suben 30 más con la persona en 5 → el panel muestra
  15, las 5 marcadas como nuevas, y sale un solo mail.
- Pack con impresiones → la opción no se puede tildar.
- El fotógrafo apaga la opción después de vender → el comprador anterior sigue
  recibiendo; un comprador nuevo no.
- «Terminé de subir» → una foto subida después no se suma.
- Compra anticipada que termina en cero → se devuelve sola por Mercado Pago y
  salen los dos avisos.
- Compra con una sola foto, sacada con «Esta no soy yo» → no se devuelve.
- Vínculo de Mercado Pago del fotógrafo caducado → queda en «Reintegros
  pendientes», sin devolver dos veces si el cierre se corre de nuevo.
- Las rutas de descarga y el ZIP entregan las fotos sumadas y rechazan una foto
  que no es del comprador.
