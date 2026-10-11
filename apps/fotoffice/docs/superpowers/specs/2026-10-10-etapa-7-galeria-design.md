# Etapa 7 · Galería FOTOFFICE

> 10/10/2026 · Reemplazo de Alboom Proof (`docs/alboom/07-alboom-proof.md`, `10-alboom-proof-cuenta-dnx.md`,
> mapa general §7). Se apoya en Proyectos (Etapa 4), Pedidos y cobros con Mercado Pago (Etapa 3) y la
> tienda (Checkout Pro con el token de la organización).
>
> **Decisiones de Daniel (09–10/10):**
> - **Orden:** A1 Selección → A2 Venta de fotos extra → B Entrega en alta y DNX FLUX → C Aprobación de álbum.
> - **Acceso del cliente:** enlace personal secreto, sin contraseña; se puede anular y generar otro.
> - **Vista:** versión liviana de **2048 px** (más una miniatura); el original queda guardado aparte.
> - **Clientes:** uno o más por galería, **cada uno con su enlace y su propia selección**; el estudio
>   revisa y finaliza cada uno por separado (como Proof).
> - **Venta de extras (cambio respecto del 29/09):** los clientes **pueden comprar fotos extra dentro de
>   la galería**, con el mismo cobro que CompraMeLaFoto y la tienda: Mercado Pago (Checkout Pro) con la
>   cuenta de la organización, el dinero no pasa por DNX, queda en Caja, y la descarga en alta se habilita
>   sola al acreditarse.
> - **Precios igual que Proof:** fotos incluidas + extra **por foto** o **por paquete** de N fotos;
>   descuento **único** o **progresivo** (hasta 4 reglas "X % desde N fotos"). En pesos.
>
> Opciones de Proof relevadas el 10/10 (sólo lectura, sin guardar): tres modos (sólo selección /
> selección con venta de extras / sólo venta), "empezar a vender después de N fotos", por foto o
> paquete, descuentos sin/único/progresivo, descarga "en vista de galería" o "sólo seleccionadas o
> compradas", acceso privado/con contraseña/público, plazo con recordatorios.
>
> - **Proof no se migra (10/10):** la galería arranca de cero; las galerías viejas de Proof quedan donde
>   están. No hay redirección de enlaces viejos.
>
> Lo demás va marcado **[decisión]**. **Sin staging.**

## 1. Qué problema resuelve

DNX tiene ~700 galerías en Proof (334 GB). Proof cobra en Brasil (Alboom Pay), no en Argentina, por eso
las 14 ventas que hubo quedaron casi todas pendientes. Los clientes eligen las fotos del fotolibro y
DNX las busca a mano en Lightroom con la lista de nombres. FOTOFFICE ya tiene el Proyecto, el
cliente, el pedido y el cobro por Mercado Pago: la galería se ata al Proyecto y cobra en pesos.

## 2. Modelo

- **Galería** (`FotofficeGaleria`), atada a un **Proyecto** (uno o varios por proyecto):
  - número (`GALERIA`, año + correlativo), nombre (por omisión el del proyecto), mensaje de bienvenida;
  - **modo de venta:** `SELECCION` (sólo elegir), `SELECCION_Y_VENTA` (elegir + comprar extra) **[A2]**,
    `VENTA` (sólo comprar) **[A2]**; tipo `ENTREGA` **[B]**;
  - **selección:** libre o por cantidad (mínimo/máximo), comentarios sí/no;
  - **descarga:** apagada, "en vista de galería" (versión de 2048 px) o "sólo seleccionadas o compradas"
    (original, **[A2/B]**);
  - estado: `BORRADOR` → `PUBLICADA` → `ARCHIVADA`;
  - portada (una foto), orden (por nombre de archivo por omisión, o manual).
- **Foto** (`FotofficeGaleriaFoto`): nombre de archivo, original (R2 privado), miniatura (~480 px) y vista
  (2048 px) generadas en el servidor con `sharp` (girada según EXIF, JPEG calidad 82); estado
  `PENDIENTE` → `LISTA` | `ERROR`; tamaño, ancho, alto, orden.
- **Cliente de la galería** (`FotofficeGaleriaCliente`): contacto (opcional) o nombre/correo/teléfono,
  hash del token, estado **por cliente** `EN_PROGRESO` → `EN_REVISION` (envió) → `FINALIZADO` (el estudio
  cerró); "reactivar" vuelve a `EN_PROGRESO`; mensaje al enviar; fechas de visto, enviado y finalizado;
  anulado.
- **Selección** (`FotofficeGaleriaSeleccion`): cliente × foto, única.
- **Comentario** (`FotofficeGaleriaComentario`): cliente × foto, autor `CLIENTE` o `ESTUDIO`, texto.
- **Evento** (`FotofficeGaleriaEvento`): historial (entró, seleccionó/quitó en lote, envió, comentó,
  finalizó, reactivó, compró).
- **[A2] Precios** en la galería: incluidas, por foto o paquete, descuento único o hasta 4 reglas.
  **Compra** (`FotofficeGaleriaCompra`) con sus fotos, total, estado, pago de Mercado Pago, movimiento de
  Caja.
- **Ajustes** (`FotofficeGaleriaAjustes`): valores por omisión al crear (los de DNX en Proof: selección
  libre, sin plazo, descarga en vista de galería, comentarios sí, mensaje "Seleccioná las fotos para tu
  fotolibro…").

## 3. Entrega A1 · Selección (primera en producción)

1. **Módulo `gallery`** ("Galería", ya está en el registro como PLANNED, depende de `projects`) →
   AVAILABLE.
2. **Crear** desde la ficha del Proyecto (tarjeta "Galerías") o desde `/galerias`; listado estándar con
   estado, cliente, proyecto, fotos, clientes en revisión; filtros por estado.
3. **Subir fotos** desde la web: varias a la vez (arrastrar o elegir), **directo a R2 privado** con URL
   firmada por foto (el servidor no recibe el archivo), hasta **50 MB por foto**, JPEG o PNG
   **[decisión]**, 4 en paralelo, reintento por foto; al terminar cada una se confirma y el servidor
   genera miniatura y vista. Lo que falle queda en `ERROR` con "reintentar"; un cron reintenta las
   `PENDIENTE` viejas y limpia las abandonadas (24 h). Tope **3.000 fotos por galería** **[decisión]**.
4. **Ordenar** por nombre (por omisión) o arrastrando; elegir portada; borrar fotos (borra los tres
   archivos de R2).
5. **Clientes de la galería:** agregar al contacto del proyecto (sugerido) u otro contacto, o alta rápida
   con nombre y correo/teléfono; cada uno con **su enlace** (copiar, mandar por correo con la plantilla
   "Galería para elegir", WhatsApp con el texto armado); anular y regenerar enlace.
6. **Página del cliente** (`/w/<slug>/galeria/<token>`, también en el dominio propio):
   - portada, nombre y mensaje; grilla de miniaturas (carga perezosa), vista grande con flechas y
     deslizar en el celular;
   - **seleccionar** con marca clara; contador fijo "X seleccionadas" (y "de N" si es por cantidad);
     filtro todas / seleccionadas / con comentarios;
   - comentarios por foto (conversación con el estudio);
   - **"Enviar selección"** siempre visible abajo en el celular; pantalla de repaso con cantidad y mensaje
     para el estudio; valida mínimo y máximo; después queda **sólo lectura** hasta que el estudio reactive;
   - correo de confirmación al cliente con la cantidad, y aviso al estudio;
   - descarga de la vista (2048 px) sólo si la galería lo permite;
   - `noindex`, sin marco, sin referer, freno por IP; enlace vencido o anulado → "Este enlace ya no es
     válido";
   - bloqueo de clic derecho y arrastre en las imágenes (sabiendo que una captura no se puede impedir).
7. **Revisión en el estudio** (ficha de la galería, pestaña por cliente):
   - estado, cuándo entró y envió, mensaje, fotos elegidas (grilla) y comentarios (responder);
   - **Exportar la selección**: lista de nombres de archivo para Lightroom ("Contiene", separada por
     comas) y para el buscador de Windows/Finder (separada por espacios/OR), **partida en bloques** por el
     límite de caracteres, con "copiar"; y CSV;
   - **Finalizar** y **Reactivar**;
   - historial de actividad de la galería.
8. **Aviso al estudio** cuando un cliente envía la selección (correo al responsable del proyecto) y
   tarjeta "Galerías esperando revisión" en el listado.
9. **Configuración → Galería:** valores por omisión.

**Fuera de A1:** venta (A2), entrega en alta/ZIP y DNX FLUX (B), plazo y recordatorios (B), marca de
agua (DNX no la usa; queda para cuando otro estudio la pida), reconocimiento facial. **Proof no se migra** (decisión del 10/10).

## 4. Entrega A2 · Venta de fotos extra

- En la galería: modo `SELECCION_Y_VENTA` o `VENTA`; **incluidas** (en `SELECCION_Y_VENTA`, las primeras N
  seleccionadas no se cobran); **por foto** (precio) o **por paquete** (N fotos a $X; se cobran paquetes
  enteros redondeando hacia arriba **[decisión]**); descuento **único** (%) o **progresivo** (hasta 4
  reglas "X % desde N fotos", se aplica la mayor alcanzada).
- El cliente ve el **carrito** (extras = seleccionadas − incluidas), el total con descuento y **"Pagar"** →
  Checkout Pro de Mercado Pago con el token de la organización (mismo circuito que la tienda y las cuotas);
  sin cobros configurados, el botón explica que hay que escribirle al estudio.
- Webhook y vuelta del comprador: acreditar sólo `approved` verificado contra Mercado Pago, idempotente;
  registra la **Compra** pagada, el **movimiento de Caja** (rubro de ingreso de la galería o de los ajustes)
  y avisa al estudio y al cliente.
- Al acreditarse: las fotos compradas (y las incluidas) se pueden **descargar en original** desde la
  galería (URL firmada de 5 min por foto) si la descarga está en "sólo seleccionadas o compradas".
- Panel de **Ventas de galerías** (total, cantidad, ticket promedio) dentro de la galería y en Informes →
  Ventas no **[decisión: queda para después]**.

## 5. Entrega B · Entrega en alta y DNX FLUX (resumen; se diseña en detalle al llegar)

- Galería tipo `ENTREGA` (fotos y video), descarga por foto y **todo en ZIP** armado en segundo plano.
- **DNX FLUX publica por API** con clave de dispositivo (tabla nueva, revocable): crea la galería del
  proyecto, sube directo a R2 y confirma; respeta orden por nombre.
- Plazo y recordatorios automáticos; vencimiento con aviso.

## 6. Entrega C · Aprobación de álbum (resumen)

Láminas del álbum (desde el Diseñador), comentario marcado en un punto, aprobar o pedir cambios, rondas.

## 7. Datos (A1)

Tablas nuevas `FotofficeGaleria`, `FotofficeGaleriaFoto`, `FotofficeGaleriaCliente`,
`FotofficeGaleriaSeleccion`, `FotofficeGaleriaComentario`, `FotofficeGaleriaEvento`,
`FotofficeGaleriaAjustes`; secuencia de numeración `GALERIA`; tipo de plantilla `GALERIA` (CHECK de
`FotofficeMessageTemplate.entityType` + `'GALERIA'`). Claves de R2 privado:
`galerias/<workspaceId>/<galeriaId>/<fotoId>/{original,vista,mini}.jpg`. CORS del bucket privado: PUT
desde los orígenes de la app y los dominios propios (verificar el que ya usan los adjuntos).

## 8. Errores y casos borde

- **Foto de más de 50 MB o tipo no admitido:** se rechaza antes de subir.
- **Subida cortada:** la foto queda `PENDIENTE`; el uploader permite reintentar; el cron limpia a las 24 h.
- **Original corrupto o que `sharp` no lee:** `ERROR` con el motivo; no rompe la galería.
- **Dos pestañas del mismo cliente:** la selección es por foto e idempotente; enviar es una escritura
  condicional (sólo desde `EN_PROGRESO`).
- **Estudio borra una foto ya seleccionada:** la selección desaparece y queda en el historial.
- **Enlace filtrado:** el estudio lo anula y genera otro; el viejo deja de andar al instante.
- **Datos personales:** nunca en los registros; la IP sólo con hash.

## 9. Publicación

Por entrega: SQL a mano en producción antes del código, PR, chequeos (tipos, pruebas, build), fusión,
verificación (rutas, sin 5xx, deploy Ready — ojo con el caché de Vercel), encender el módulo en DNX y
prueba real con una galería de pocas fotos abierta desde el celular.
