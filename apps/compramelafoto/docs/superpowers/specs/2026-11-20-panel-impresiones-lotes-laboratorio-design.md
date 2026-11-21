# Panel de impresiones y lotes al laboratorio — diseño

Fecha: 20/11/2026 · App: CompraMeLaFoto (CLF) · Estado: borrador para aprobar

## 1. Qué se quiere y por qué

Daniel quiere que el fotógrafo, desde la pantalla de pedidos de CLF (comunes y escolares), tenga un
**panel de impresiones** donde:

- vea en qué estado están las copias de cada pedido (por imprimir, en el laboratorio, listas,
  entregadas);
- arme **lotes de impresión** y los **envíe a su laboratorio desde la plataforma**;
- emita **sobres con QR** (uno por cliente) y **etiquetas** (para el lote);
- el **laboratorio esté dado de alta en el sistema**.

Decisión de Daniel (20/11/2026): **«con cuenta y enlace»**. El laboratorio puede tener cuenta en CLF y
trabajar desde su panel; si no la tiene, igual recibe el lote por correo con un enlace y nadie se traba
esperando que se registre.

Por qué ahora: hoy las copias de los pedidos comunes no tienen seguimiento. En los últimos 90 días hubo
**130 pedidos comunes con copias (448 copias, 9 fotógrafos) y los 130 siguen en «Creado»**. El
fotógrafo baja un ZIP y lo manda por fuera (WhatsApp, WeTransfer, pendrive); nadie sabe si el
laboratorio lo recibió ni cuándo están listas.

## 2. Lo que ya existe y se reutiliza

| Pieza | Dónde | Estado real |
|---|---|---|
| Laboratorio con cuenta | modelo `Lab`, `/lab/registro`, `/admin/laboratorios`, `/lab/pedidos` | Construido. En producción: 2 laboratorios aprobados (Procolor San Salvador, «leandro garcia»), 2 pedidos en toda la historia, 0 en 90 días. Ningún fotógrafo tiene `preferredLabId`. |
| Pedido de impresión espejo | `lib/orders/create-album-order-print-order-mirror.ts` | Cada pedido de álbum con copias crea un `PrintOrder` con tag `ALBUM_ORDER:<id>`, **siempre con `labId: null`** y en `CREATED`. El listado del fotógrafo los oculta. |
| Estados de impresión | enum `PrintOrderStatus` + `PrintOrderStatusHistory` | CREATED, IN_PRODUCTION, READY, READY_TO_PICKUP, SHIPPED, DELIVERED, CANCELED, RETIRED. Las etiquetas en castellano ya están en `components/fotografo/orders/photographer-order-types.ts`. |
| ZIP para el laboratorio | `lib/orders/print-export/*`, `GET /api/fotografo/pedidos/export-print-lote` | Ordenado por tamaño y acabado, rutas cortas para Windows, `RESUMEN_PARA_LABORATORIO.txt`. Tope 15 pedidos por ZIP (función de 300 s). |
| Línea escolar | `lib/design-v2/produccion.ts`, `copias-en-produccion.ts`, `/api/fotografo/escolar/{lotes,lotes/zip,lotes/pdf,lotes/marcar,etiquetas,volver-paso}` | Lote por **nombre** (`DesignProject.printBatchName`, `SchoolCopiesPrintJob.printBatchName`), con `sentToPrintAt`, `printedAt`, `deliveredAt`. ZIP hasta 60 libritos, PDF único hasta 40. |
| Etiquetas con QR | `etiquetas()` en `produccion.ts` (A4, 3×8 = 24 por hoja) | El QR abre `/escolar/entrega/[codigo]`: el fotógrafo con sesión marca «Listo para entregar» o «Entregado»; quien recibe toca «Confirmar que lo recibí» (`lib/school-fulfillment/entrega-por-qr.ts`). Código firmado `c<pedido>.<firma>` (`codigo-de-canje.ts`). |
| Seguimiento «abrió / descargó» | FOTOFFICE (`proveedorAbiertoAt`, `proveedorDescargadoAt`) | Es otra app y otra base; se copia **la idea**, no el código. |

### 2.1 El lado del laboratorio, como está hoy

- **Alta**: `/lab/registro` → `/api/auth/register-lab` crea `User` con rol `LAB` + `Lab` ya
  `APPROVED` (sin aprobación manual; el botón «Aprobar» del admin no aplica a los nuevos). El admin
  puede crear un `Lab` sin usuario (`POST /api/admin/labs`), pero no hay forma de vincularle uno.
- **Invitación**: no existe. `LabRecommendation` (`/api/recommend-lab`) guarda la recomendación y manda
  un correo genérico, sin enlace de registro.
- **Panel**: `/lab/pedidos` lista `PrintOrder` con `labId` propio **y `paymentStatus = PAID`**. Los
  espejos se crean PENDING pero pasan a PAID cuando Mercado Pago aprueba
  (`lib/mercadopago/finalize-album-order-mp-approved.ts`); los canjes con voucher quedan PENDING. Si a un
  espejo cobrado se le pusiera `labId`, aparecería en el panel viejo con sus rutas de estado.
- **Estados**: `PATCH /api/print-orders/[id]/status` y `/bulk-status` validan transiciones
  (`lib/print-orders/print-order-status.ts`), escriben historial y, **al pasar a READY o
  READY_TO_PICKUP, le mandan al cliente el correo `order_ready`** (con un enlace que exige cuenta de
  cliente). No avisan al fotógrafo.
- **Descarga**: `/api/print-orders/[id]/export` usa `loadPrintOrderPrintPlan` + `streamPrintExportZip`
  (lab, fotógrafo o admin; sólo PAID).
- **Seguimiento público por token o QR**: no existe para `PrintOrder`.
- **Defectos vistos al pasar** (fuera de este diseño, ver §13): rutas `/api/lab/clientes*` y
  `/api/lab/create` sin autenticación; `labId: 1` y `photographerId` 32 fijos en flujos viejos de
  `/imprimir`; la comprobación del fotógrafo en el PATCH de estado usa el `photographerId` del cuerpo.

**Consecuencias para este diseño**
1. Los cambios de estado del lote **no** pasan por las rutas existentes de estado: escriben
   `PrintOrder.status` + historial con su propia función, para que «Listo en el laboratorio» no le
   mande al cliente un «tu pedido está listo» cuando las copias todavía están en el laboratorio. El
   aviso al cliente sale sólo al pasar a «Listo para retirar» (§8).
2. La pestaña «Lotes» del laboratorio es nueva y lee `PrintBatch`. **Al espejo nunca se le pone
   `labId`**: el laboratorio del lote vive sólo en `PrintBatch`, así el panel viejo no los muestra.
3. La invitación al laboratorio es nueva (§5).

## 3. Objetivos, no objetivos y lo que lo haría un fracaso

**Objetivos**
1. Un panel «Impresiones» del fotógrafo con el estado de las copias de cada pedido.
2. Armar lotes, enviarlos al laboratorio y seguir el lote hasta que vuelve.
3. Sobres con QR por pedido y etiqueta/remito por lote.
4. El laboratorio puede trabajar con cuenta (panel) o sin cuenta (enlace), con las mismas acciones.

**No objetivos (esta vez)**
- Cobrarle al fotógrafo o pagarle al laboratorio dentro de la plataforma. El dinero sigue por fuera.
- Juntar los laboratorios de CLF con los proveedores de FOTOFFICE (otra base, otro proyecto).
- Mezclar en un mismo lote pedidos comunes y escolares (ver §6.1).

**Sería un fracaso aunque funcione si…**
- el laboratorio tiene que registrarse para poder recibir el primer lote;
- se manda un lote con fotos que ya no existen (álbum vencido o borrado) y el laboratorio lo descubre
  al abrir el ZIP;
- un pedido sin pagar entra a un lote;
- la línea escolar que ya funciona (7 pasos) se rompe o cambia de comportamiento.

## 4. El circuito

```
PEDIDO PAGADO CON COPIAS
   │
   ▼
[Para imprimir] ──armar lote──► [En lote, sin enviar] ──Enviar──► [Enviado al laboratorio]
                                     ▲  sacar del lote                     │ lab abre / descarga
                                     │                                      ▼
                                     │                             [En producción]  (lab)
                                     │                                      ▼
                                     │                             [Listo en el laboratorio] (lab)
                                     │                                      ▼
                                     └──── reimprimir ◄──── [Recibido por el fotógrafo] ──QR──► [Entregado al cliente]
```

Quién mueve cada paso:

| Paso | Lo mueve | Cómo |
|---|---|---|
| Para imprimir → En lote | Fotógrafo | Marca pedidos y toca «Armar lote» |
| En lote → Enviado | Fotógrafo | «Enviar al laboratorio» (elige laboratorio y mensaje) |
| Enviado → En producción | Laboratorio | Botón en su panel o en la página del enlace. Si no lo toca, el fotógrafo puede marcarlo. |
| En producción → Listo | Laboratorio | Igual |
| Listo → Recibido | Fotógrafo | «Recibí el lote» (o escaneando la etiqueta del lote) |
| Recibido → Entregado | Fotógrafo o cliente | QR del sobre |

El fotógrafo **siempre** puede mover cualquier paso a mano, por si el laboratorio no usa la plataforma.

### 4.1 Estado del pedido vs. estado del lote

- El **lote** tiene su propio estado (`ARMADO`, `ENVIADO`, `EN_PRODUCCION`, `LISTO`, `RECIBIDO`, `CERRADO`,
  `ANULADO`). El laboratorio sólo mueve el lote entero.
- Cada **pedido común** guarda su estado en el `PrintOrder` espejo que ya existe, con historial en
  `PrintOrderStatusHistory`:

| Estado del lote | `PrintOrder.status` de cada pedido |
|---|---|
| ARMADO / ENVIADO | `CREATED` (el panel lo muestra como «En lote» / «Enviado» mirando el lote) |
| EN_PRODUCCION | `IN_PRODUCTION` |
| LISTO | `READY` |
| RECIBIDO | `READY_TO_PICKUP` («Listo para retirar») |
| — (por QR) | `DELIVERED` |

- Los **pedidos escolares** siguen con sus columnas (`sentToPrintAt`, `printedAt`, `deliveredAt`).
  `printedAt` se marca recién cuando el fotógrafo pasa el lote a `RECIBIDO` (no en `LISTO`), para que la
  línea de 7 pasos se comporte igual que hoy; `deliveredAt` lo marca el QR como hoy.

### 4.2 Cuando retira el cliente en el laboratorio

Decisión de Daniel (20/11/2026): si el álbum tiene `pickupBy = CLIENT`, **el cliente retira en el
laboratorio que él elige**, el pedido va **a nombre de «Fotógrafo + Cliente»** y **el que le paga al
laboratorio es el fotógrafo** (el cliente ya pagó todo en CLF; el laboratorio nunca le cobra).
En los últimos 90 días fueron 18 pedidos pagados de este tipo, contra 77 donde retira el fotógrafo.

- **Elegir laboratorio en la compra**: en el checkout de un álbum con `pickupBy = CLIENT`, el cliente
  elige entre los laboratorios del fotógrafo marcados como «punto de retiro» (§5), con dirección y
  horario. Si hay uno solo, viene elegido y sólo se muestra. Se guarda en el pedido
  (`Order.pickupLabContactId`, columna nueva). Pedidos viejos o sin elección: el laboratorio
  predeterminado del fotógrafo. (Interpretación mía de «el que elige el cliente»: elige entre los que el
  fotógrafo habilitó, no cualquier laboratorio del país.)
- **Lotes por laboratorio**: un pedido con retiro elegido sólo puede entrar a un lote de **ese**
  laboratorio. Al armar, el panel separa «Para imprimir» por laboratorio.
- **Circuito corto**, sin pasar por el fotógrafo:

```
Enviado → En producción (lab) → Listo para retirar (lab, avisa al cliente) → Entregado (lab, QR del sobre)
```

| Paso del lab | `PrintOrder.status` |
|---|---|
| Lo empezamos | `IN_PRODUCTION` |
| Está listo | `READY_TO_PICKUP` → correo al cliente: «Tus copias de <Fotógrafo> están listas. Retiralas en <Laboratorio>, <dirección>, <horario>. Ya están pagas.» |
| Escanea el QR del sobre al entregar | `DELIVERED` |

- En un mismo lote pueden convivir pedidos que retira el fotógrafo y pedidos que retira el cliente: el
  lote pasa a `LISTO` igual, y a los de retiro del cliente el laboratorio los entrega uno por uno con el
  QR. El lote se cierra solo cuando todos sus pedidos están entregados o recibidos por el fotógrafo.
- **Lo que ve el laboratorio de cada pedido con retiro**: nombre del cliente, número de pedido, fotógrafo
  y la marca «PAGADO — no cobrar al cliente; lo factura el fotógrafo». No ve el correo ni el teléfono del
  cliente (call mío: no los necesita para entregar; el QR alcanza).
- **El QR del sobre escaneado por el laboratorio** (con su cuenta o con el enlace del lote abierto en el
  mismo teléfono) muestra «Entregar a <Cliente>» y lo marca entregado; el fotógrafo lo ve en su panel.
- **El dinero**: el fotógrafo le paga al laboratorio por fuera; el panel muestra por lote «a pagarle al
  laboratorio: aprox. $X» con la lista de precios (§9).

## 5. Laboratorios del fotógrafo («Mis laboratorios»)

Tabla nueva `PhotographerLabContact` (base de CLF):

```
id, photographerId, labId (nullable → Lab), nombre, email, whatsapp?, notas?,
esPredeterminado, puntoDeRetiro (bool), direccion?, horario?, createdAt, updatedAt
@@unique([photographerId, email])
```

- El fotógrafo carga su laboratorio con **nombre y correo**. Con eso ya puede mandarle lotes por enlace.
- Si lo marca **«punto de retiro»** tiene que cargar dirección y horario (si está vinculado a un `Lab`,
  se toman de ahí); es lo que ve el cliente al elegir dónde retirar (§4.2).
- Si el correo coincide con un `Lab` aprobado, se vincula solo (`labId`) y el lote también aparece en el
  panel del laboratorio.
- También puede elegir uno de los laboratorios aprobados del directorio (los que hoy existen en `Lab`).
- El correo del primer lote invita al laboratorio a crear su cuenta («Ver todos tus lotes en un solo
  lugar»), con el correo ya cargado en `/lab/registro`. Al aprobarse, todos los contactos con ese correo
  se vinculan.

## 6. Lotes

### 6.1 Modelo

Tablas nuevas (base de CLF):

```
PrintBatch
  id, photographerId, labContactId (→ PhotographerLabContact, nullable mientras está ARMADO)
  labId (nullable, copia del vínculo al enviar)
  nombre            "Lote 12 · 20/11"  (mismo armado de nombre que la línea escolar)
  tipo              COMUNES | ESCOLAR
  estado            ARMADO | ENVIADO | EN_PRODUCCION | LISTO | RECIBIDO | CERRADO | ANULADO
  mensajeAlLab, entregaPreferida (RETIRA_FOTOGRAFO | ENVIA_LAB), fechaPrometida?
  tokenHash         (el enlace del laboratorio; el token en claro sólo viaja en el correo)
  enviadoAt, labAbrioAt, labDescargoAt, enProduccionAt, listoAt, recibidoAt, cerradoAt
  createdAt, updatedAt

PrintBatchEntry
  id, batchId, printOrderId? (pedido común: el PrintOrder espejo), designProjectId?, schoolCopiesJobId?
  albumOrderId?    (pedido común: el `Order` del álbum, de donde sale el ZIP)
  resumen Json     (cliente, pedido, álbum, copias por tamaño — foto del momento de armar)
  quitadoAt?       (reimprimir o sacar del lote: la fila queda, tachada)
  Índice único parcial en SQL a mano: un pedido común en un solo lote vivo
  (`UNIQUE (albumOrderId) WHERE quitadoAt IS NULL`); Prisma no lo expresa.
```

Calls míos (corregibles):
- **Un lote es de un solo tipo** (comunes o escolar). El ZIP, el resumen y las etiquetas de cada uno ya
  están armados distinto; mezclar obliga a rehacerlos sin que Daniel lo haya pedido.
- Para escolares, el `PrintBatch` **no reemplaza** a `printBatchName`: al armar el lote escolar se
  crea el `PrintBatch` con el mismo nombre y las filas apuntan a los libritos y copias. La línea de 7
  pasos sigue leyendo sus columnas como hoy.

### 6.2 Qué puede entrar a un lote común

- Pedido de álbum con `Order.status = PAID`, con ítems impresos fuera de un diseño, que no esté en otro
  lote vivo. Manda el `Order`, no el `paymentStatus` del espejo. Si el pedido no tiene espejo (su
  creación puede fallar en silencio), se crea al armar con `createAlbumOrderPrintOrderMirror`, que es
  idempotente.
- **Quedan afuera**, porque ya viajan por la línea escolar: los canjes de packs cobrados por fuera
  (voucher, `SchoolCopiesPrintJob`) y la parte con librito o carpeta de un pedido de galería
  (`DesignProject.albumOrderId`). De un pedido mixto, al lote común van sólo sus copias sueltas
  (`copiasFueraDelDiseno`); el librito sigue en la línea escolar.
- También quedan afuera, en la primera versión, los pedidos de impresión directos (`/imprimir`, que no
  son espejo): tienen su propio circuito con laboratorio.
- Se excluyen pedidos de prueba/demo (`esPedidoDemo`) y álbumes ocultos de prueba.
- **Control de archivos al armar**: se verifica que cada original exista en R2. Si falta alguno, el
  pedido no entra y se avisa cuál («El álbum venció: las fotos ya no están»).

### 6.3 Enviar

«Enviar al laboratorio» hace, en este orden:
1. Valida de nuevo los archivos.
2. Pasa el lote a `ENVIADO`, guarda `labId` y genera el token del enlace.
3. Manda un correo al laboratorio: nombre del lote, fotógrafo, cantidad de pedidos y de copias por
   tamaño, mensaje del fotógrafo y el botón «Abrir el lote». Si el laboratorio no tiene cuenta, suma la
   invitación a crearla.
4. Si el correo falla, el lote **no** queda como enviado (misma regla que FOTOFFICE desde el PR 978).

### 6.4 Lo que ve el laboratorio

La misma pantalla con dos puertas:
- **Sin cuenta**: `/lab/lote/[token]`.
- **Con cuenta**: pestaña «Lotes» en `/lab/pedidos`.

Contenido: datos del fotógrafo y del lote, resumen de copias por tamaño y acabado, lista de pedidos,
**descarga** y botones de estado («Lo empezamos», «Está listo», y «Lo despachamos» si
`entregaPreferida = ENVIA_LAB`). Registra `labAbrioAt` y `labDescargoAt` la primera vez.

**Descarga**: el ZIP sale del pedido de álbum (`loadAlbumOrderPrintPlan`, sólo las copias fuera del
diseño) + `organizarPorTamano` + `streamPrintExportZip`, como el lote de hoy. Para el enlace sin cuenta
hace falta una ruta nueva que autoriza por el token del lote y arma el plan de los pedidos de ese lote
(las funciones de plan de hoy piden sesión; se separa la carga del permiso). Como hay un tope de 15
pedidos por ZIP, un lote más grande se baja **en partes** («Parte 1 de 3»). Escolares: el ZIP y el PDF
de lote que ya existen (topes 60 y 40).

### 6.5 Anular y reimprimir

- Un lote `ARMADO` se puede deshacer; sus pedidos vuelven a «Para imprimir».
- Un pedido de un lote ya enviado se puede marcar «Reimprimir»: vuelve a «Para imprimir» y entra a
  otro lote; en el lote viejo queda tachado.

## 7. Sobres y etiquetas

Tres impresos, todos PDF A4 armados con `pdf-lib` como las etiquetas escolares:

1. **Etiqueta de sobre por pedido** (A4, 24 por hoja, mismo formato que las escolares): a nombre de
   **«<Fotógrafo> + <Cliente>»**, álbum o evento, número de pedido, contenido («3× 13x18 brillo · 2×
   10x15»), nombre del lote y **QR de entrega**. Si retira el cliente en el laboratorio, suma
   «RETIRA EL CLIENTE · PAGADO, no cobrar». Para escolares se usa tal cual la que existe.
2. **Etiqueta del lote** (una por lote, para la caja): nombre del lote, fotógrafo, laboratorio, cantidad
   de pedidos y copias, y QR al lote (el fotógrafo lo escanea para «Recibí el lote»).
3. **Remito del lote** (hoja para el laboratorio, va también dentro del ZIP): tabla de pedidos con
   cantidades por tamaño y una casilla para tildar.

**QR del pedido común**: código firmado como el de canje, con otra letra (`p<printOrderId>.<firma>`),
abre `/pedido/entrega/[codigo]`. Con la sesión del fotógrafo dueño, o del laboratorio del lote (cuenta
o enlace del lote abierto en ese teléfono): «Listo para retirar» y «Entregado». Sin sesión (el
cliente): ve el estado, dónde retirar y «Confirmar que lo recibí». La lógica copia la de
`entrega-por-qr.ts`.

## 8. El panel del fotógrafo

En **Pedidos** se suma la pestaña **«Impresiones»** (y un acceso desde «Escolar → Pedidos escolares»):

```
Impresiones                                    [Mis laboratorios]  [Armar lote]
┌ Para imprimir 12 ┬ En el laboratorio 3 lotes ┬ Listos para entregar 18 ┬ Entregados ┐
│ ☐ #3888 Ana P.   │ Lote 12 · Procolor        │ #3871 Juan G.  [QR]     │            │
│   3× 13x18       │ Enviado 18/11 · abrió ✓   │ ...                     │            │
│ ☐ #3891 ...      │ descargó ✓ · En producción│                         │            │
└──────────────────┴───────────────────────────┴─────────────────────────┴────────────┘
Lotes:  Lote 12 · Procolor · 9 pedidos · 31 copias · En producción   [Etiquetas] [Sobres] [Remito]
```

- Filtro Comunes / Escolares.
- En la ficha de cada pedido común se ve su estado de impresión y en qué lote está.
- El cliente recibe un correo cuando el pedido pasa a «Listo para retirar» (call mío; los demás
  estados no le mandan nada). Si retira el fotógrafo, lo dispara el fotógrafo; si retira el cliente en
  el laboratorio, lo dispara el laboratorio con «Está listo» y dice dónde y en qué horario (§4.2).
- Por lote: «A pagarle al laboratorio: aprox. $X» cuando hay lista de precios (§9). El fotógrafo
  puede marcarlo «Pagado al laboratorio» (sólo un registro; el dinero va por fuera).

## 9. Listas de precios de los laboratorios

Decisión de Daniel (20/11/2026): **las tres vías**. Una lista puede venir del laboratorio, de DNX o del
fotógrafo, y cuando hay más de una para el mismo producto manda, en este orden:

1. **Precio del fotógrafo** (privado, lo que arregló con su laboratorio).
2. **Lista del propio laboratorio** (la carga desde su cuenta).
3. **Lista cargada por DNX** (a partir del PDF, foto o Excel que el laboratorio reparte).

### 9.1 Para qué se usa

Sólo para **estimar costos del lado del fotógrafo**:
- costo estimado del lote antes de enviarlo y en la etiqueta/remito («aprox. $48.000»);
- comparar laboratorios para un mismo lote;
- ganancia aproximada por pedido (lo que pagó el cliente menos el costo estimado de las copias).

**No** cambia ningún precio que vea o pague un cliente final.

### 9.2 Dónde se guarda

Hoy existen `LabProduct` (precio fotógrafo y precio público), `LabSizeDiscount` y un importador Excel
(`/api/lab/catalog/*`) que usa el laboratorio. El checkout de álbumes lee `LabProduct` cuando un álbum
tiene `selectedLabId` (hoy 0 álbumes). Para que cargar una lista nunca toque el checkout, las listas de
DNX y del fotógrafo van en tablas propias (call mío):

```
LabPriceList
  id, fuente (DNX | FOTOGRAFO), labId? (DNX), labContactId? (FOTOGRAFO), photographerId?
  vigenteDesde, cargadaPorUserId, archivoOriginalKey?, notas, activa, createdAt
LabPriceListItem
  id, listId, medida (normalizada: "13x18"), acabado? (BRILLO | MATE | null = cualquiera),
  producto (texto como viene en la lista), precioUnitario (ARS enteros),
  cantidadMinima (default 1, para escalones por cantidad)
LabSizeAlias
  labId?, photographerId?, textoOriginal, medida, acabado?   → recuerda emparejamientos
```

La «lista del propio laboratorio» se lee de `LabProduct` + `LabSizeDiscount` (precio fotógrafo), tal
como el laboratorio ya la carga.

### 9.3 Cargar una lista

- **DNX** (pantalla de admin, ficha del laboratorio → «Lista de precios»): sube el archivo original
  (queda guardado como respaldo), pega el CSV y empareja medidas. Como en FOTOFFICE, el CSV se arma con un
  texto guía que se copia en un asistente de IA a partir del PDF o la foto (call mío para la primera
  versión: ya está probado en FOTOFFICE con La Isla, Fotolag y Román; leerlo automáticamente queda para
  después). Se puede cargar para un laboratorio **sin cuenta**: el admin ya puede crear un `Lab` sin
  usuario.
- **Fotógrafo** («Mis laboratorios» → su laboratorio → «Mis precios»): planilla corta por medida y
  acabado, o el mismo CSV.
- **Laboratorio**: lo que ya existe en su panel.
- Cada lista guarda **vigente desde**. Si la que se usa tiene más de 60 días, el panel avisa
  «Precios de hace más de 2 meses» al lado del costo estimado.

### 9.4 Cuando el laboratorio se registra

Hoy `/api/auth/register-lab` **rechaza** el correo si ya existe un `Lab` con ese correo
(`Lab.email` es único) o un `User` con ese correo. Así, un `Lab` cargado por DNX le impediría
registrarse al laboratorio. Cambio: si el `Lab` existe **sin usuario**, el registro lo reclama (le
asigna el usuario nuevo); si el correo ya es de un `User` (por ejemplo, el dueño también es fotógrafo),
se le pide iniciar sesión y desde ahí vincula el laboratorio. La invitación del §5 usa este mismo
camino. La lista de DNX queda como respaldo hasta que el laboratorio cargue la suya.

### 9.5 Quién ve qué

- Lista de DNX: todos los fotógrafos con sesión iniciada, con la leyenda «Cargada por DNX el
  dd/mm/aaaa a partir de la lista del laboratorio».
- Precios del fotógrafo: sólo él.
- Nunca a un cliente final ni en una página pública. Si un laboratorio pide que se baje su lista, se
  desactiva (`activa = false`).

## 10. Etapas

1. **Lotes de pedidos comunes con laboratorio por enlace**: «Mis laboratorios», armar y enviar lote,
   página del enlace con descarga y estados, panel «Impresiones», sobres, etiqueta y remito, QR del
   pedido común, correo de «Listo para retirar», y el retiro del cliente en el laboratorio (§4.2:
   elección en el checkout, circuito corto, entrega por QR del laboratorio).
2. **Laboratorio con cuenta**: pestaña «Lotes» en `/lab/pedidos`, invitación a registrarse, vínculo
   automático por correo.
3. **Escolares en el mismo panel**: «Enviar al laboratorio» desde el lote escolar, crea el `PrintBatch`.
4. **Listas de precios** (§9): listas de DNX y del fotógrafo, costo estimado del lote, reclamo del
   `Lab` al registrarse. No depende de los lotes para cargarse; se puede adelantar si conviene.
5. (Más adelante) Lectura automática de listas con IA y cobro dentro de la plataforma.

## 11. Datos y despliegue

- Migración nueva sólo en la base de CLF (`production`, `br-autumn-rain-ad18wq7y`): tablas
  `PhotographerLabContact`, `PrintBatch`, `PrintBatchEntry`, sus enums y la columna
  `Order.pickupLabContactId` (etapa 1); `LabPriceList`,
  `LabPriceListItem`, `LabSizeAlias` (etapa de precios), cada una en la migración de su etapa. Se
  aplica a mano y se registra antes de fusionar (ver memoria: una columna sin aplicar rompe todo el
  modelo).
- Variable para firmar el QR del pedido común: reutilizar el secreto de entrega escolar.
- Sin staging: se prueba en local contra datos reales de lectura y luego en producción con un lote de
  prueba de DNX.

## 12. Lo que queda para quien lo construya

- Armar el nombre del lote reutilizando `nombreDelProximoLote`.
- Elegir si la descarga en partes es un botón por parte o una lista.
- Textos finales de los correos.

## 13. Fuera de este diseño, pero urgente

`/api/lab/clientes` devuelve nombre, correo y teléfono de los clientes de cualquier laboratorio sin
iniciar sesión, y `/api/lab/clientes/[email]` permite modificarlos. Se arregla aparte, antes de sumar
laboratorios.
