# El bot de WhatsApp vende copias e impresiones — diseño (etapa 3b, impresiones)

Fecha: 28/10/2026 · Pedido de Daniel Cuart (DNX Estudio) · Estado: borrador para aprobar
Antecedentes: `2026-10-20-bot-whatsapp-24x7-design.md` (etapas 2 y 3) y el módulo de pedidos de
impresión (`lib/impresiones`, PR 661/665).

## 1. Para qué

Hoy el cliente manda las fotos por WhatsApp, elige medida y paga la seña; las chicas del
mostrador arman el pedido y se lo mandan por correo al laboratorio. Daniel quiere que **el bot
prepare el pedido** y que, **cuando entra el pago (seña o total), el correo al laboratorio salga
solo**. El mostrador sólo retira las copias del laboratorio, cobra el saldo y entrega.

**Éxito:** un cliente manda 5 fotos por WhatsApp, pide "2 de cada una en 13x18 para la semana que
viene", paga la seña con el link de Mercado Pago y, sin que nadie toque nada, el laboratorio recibe
el pedido con las fotos originales. En FOTOFFICE queda el trabajo con el saldo pendiente.

**Fuera de esta etapa:** cuadros, portarretratos, VHS/DVD/rollos y fotolibros (siguen pasando a una
persona); la etapa 6 (botón "Avisar que está listo").

## 2. Reglas del estudio (dichas por Daniel)

| Regla | Valor |
|---|---|
| Seña | **50 %** del total. El cliente puede pagar la seña o el total |
| Cuándo sale al laboratorio | Apenas se acredita el pago (seña o total), sin intervención del mostrador |
| Recorte | **Lo define el laboratorio**: FOTOFFICE manda la foto **original**, sin recortar ni recomprimir |
| Papel | El cliente elige **brillante o mate** por foto (se pueden mezclar en el mismo pedido); si no dice nada, **brillante** |
| Pocas copias | Si no llega al primer escalón del catálogo ("más de 10"), se cobra el **precio de la instantánea** de esa medida y se entrega al **siguiente día hábil** (va al laboratorio como "para mañana") |
| "Para mañana" | Listo el **siguiente día hábil** (si pagan viernes o sábado, el lunes; feriados no cuentan) |
| "Próxima semana" (y La Isla) | **Máximo 7 días corridos.** El pedido **sale al laboratorio apenas se paga**. Al cliente se le promete "como máximo en 7 días" (sin fecha exacta). El cadete (~$12.000 el viaje) se manda cuando conviene: cuando la **ganancia acumulada** (precio − costo) de los trabajos de ese laboratorio que esperan retiro **supera $12.000** (configurable), se programa el retiro para el **siguiente día hábil** *(decisión de quien diseña)* y recién ahí se le avisa a cada cliente la fecha exacta. Si se llega al día 7 sin juntar la ganancia, el retiro se programa igual ese día |
| Plazos mezclados | Si el cliente pide unas "para mañana" y otras "para la próxima semana", **paga todo junto** (un solo link) pero se generan **trabajos separados** (uno por plazo y laboratorio), cada uno con su fecha |
| Retiro | **Siempre en el estudio** |
| Envío a domicilio | Opcional. **$3.000 por km** desde el estudio (**San José 1672, Funes**) hasta la dirección del cliente (la misma regla que el traslado de eventos: incluye la vuelta). Se cobra en el mismo link |
| Instantáneas | Las copias **instantáneas** se imprimen en el estudio (Kodak): no van al laboratorio, quedan para el mostrador |
| Correo del cliente | No se pide (decisión del 20/10): los avisos al cliente van por WhatsApp |

## 3. Cómo funciona

1. El cliente pide copias y manda fotos (o las manda primero). Las fotos ya se guardan solas
   (etapa 2) con su resolución.
2. El bot junta, sin repetir lo que ya dijo el cliente:
   - qué fotos (por defecto, todas las que mandó en esta charla desde el último pedido),
   - medida y cantidad (puede ser distinta por foto; "2 de cada una" vale),
   - plazo: **instantánea**, **para mañana** o **para la próxima semana** (lo que ofrezca el
     catálogo para esa medida),
   - papel (brillante por omisión),
   - retiro en el estudio o envío (si es envío: dirección y localidad).
3. **Calidad:** si una foto no alcanza para la medida pedida (llegó comprimida por WhatsApp), el bot
   pide reenviarla como Documento. Si el cliente insiste, se acepta y la foto queda marcada "calidad
   baja" en el pedido y en el correo al laboratorio.
4. El bot usa la herramienta nueva **`armar_pedido_impresion`**. Devuelve el resumen con precios
   (ya respaldados por el control de montos), la seña, el total y **dos links de Mercado Pago**:
   "pagar la seña ($X)" y "pagar el total ($Y)". El bot se los manda al cliente.
5. Mercado Pago confirma el pago (webhook o conciliación del cron que ya existe):
   - el pedido pasa a PAGADO (con seña o total),
   - se crea un trabajo por laboratorio (y uno "para el mostrador" si hay instantáneas),
   - el cron arma la carpeta del laboratorio con los **originales** y le manda el correo:
     "Pedido N – PARA MAÑANA – Cliente" o "Pedido N – PARA LA PRÓXIMA SEMANA – Cliente", con el
     papel, las cantidades y las fotos marcadas de calidad baja,
   - si la ventana de 24 h sigue abierta, el bot le confirma al cliente por WhatsApp: "¡Recibimos tu
     pago! Tus copias van a estar el {fecha}. Te avisamos cuando estén listas." (sin correo).
6. **Saldo:** si pagó la seña, el trabajo queda con el saldo pendiente visible para el mostrador, que
   lo cobra al entregar. Rige el candado que ya existe: no se entrega con saldo.
7. El cliente puede volver a escribir y el bot le dice en qué estado está su pedido.

## 4. Precios

- Salen del **catálogo** (lo mismo que el bot ya cotiza hoy), no de `FotofficePrintSize.priceArs`:
  productos como "Copia instantánea 10x15", "Copia para mañana 10x15 · más de 10", "Copia próxima
  semana 10x15 · más de 50".
- Formatos de nombre del catálogo de DNX (verificado el 28/10): "Copia instantánea {medida}",
  "Copia {para mañana | próxima semana} {medida} · más de N", "Ampliación {medida} {para mañana |
  próxima semana}" (Fotolag, 20x30 y 25x38) y "Ampliación {medida}" (La Isla, 20x40 a 30x90, sin
  plazo en el nombre: se tratan como "próxima semana", máximo 7 días). Se leen con un formato
  estricto; lo que no encaje no se vende por el bot.
- Para cada medida y plazo se toma el producto con el escalón "más de N" más alto que cumpla
  **N < cantidad total de esa medida y plazo**; si ninguno se cumple, el precio de la instantánea
  (regla "Pocas copias"). Costo: `Product.costArs`.
- Las ampliaciones de La Isla ya están en el catálogo con costo y precio (factor ≈ ×2,7). Plazo de
  La Isla: **como máximo 7 días** (puede llegar antes): se trata como "próxima semana".
- Laboratorio de cada renglón: `Product.preferredProveedorId`; si falta, el de la medida en
  Configuración → Impresiones. Sin laboratorio (instantáneas, proveedor "DNX") → mostrador.
- Si una medida o plazo no está en el catálogo, el bot no inventa: lo dice y pasa a una persona.
- Envío: km de distancia (recta × 1,3) × $3.000, redondeado a $100; más de 30 km → pasa a una
  persona. El costo por km y el punto de partida (estudio) son configurables.

## 5. Piezas que se reusan y cambios

- **Módulo de impresiones (`lib/impresiones`)**: el pedido es un `FotofficePrintOrder` con
  `source = "WHATSAPP"`, ítems con `sourceKey` = la clave del archivo en la Bandeja
  (`bandeja/…`, ya permitida), y una marca **"sin recorte"** para que el cron mande el original
  tal cual (sin `extract` ni reencode). El cron, el correo al laboratorio, los trabajos por
  laboratorio y la caja se reusan.
- **Seña:** el módulo hoy sólo acepta el total (`IMPORTE_MENOR`). Se agrega el importe de la seña y
  lo pagado; acredita si lo pagado ≥ seña; el saldo queda en el pedido y se refleja en el trabajo.
  Cómo engancha con el candado de saldo y "cobrar saldo" del mostrador lo decide quien construye
  (posible: un `FotofficePedido` con 2 cuotas asociado, o saldo propio del pedido de impresión).
- **Pago de más / pedido viejo:** pagar el total después de la seña cuenta como pago del saldo;
  un excedente queda avisado al estudio para devolverlo; pagar el link de un pedido reemplazado no
  lo manda al laboratorio y avisa al estudio; cuando se paga un link, el otro se desactiva.
  *(Decisión de quien diseña.)*
- **Correo del cliente:** `FotofficePrintOrder.email` pasa a opcional (migración); los avisos al
  cliente del módulo se omiten si no hay correo y el bot avisa por WhatsApp.
- **Plazo y papel por ítem:** cada renglón guarda su plazo y su papel; el ZIP y el correo agrupan
  por plazo, medida y papel. Asunto: "PARA MAÑANA" o "PARA LA PRÓXIMA SEMANA".
- **Retiro programado de "próxima semana":** los trabajos de próxima semana (y La Isla) salen al
  laboratorio al pagarse y quedan en una fase "Esperando retiro". El cron suma, por laboratorio, la
  ganancia de los que esperan; si supera el umbral ($12.000), fija el retiro para el siguiente día
  hábil, pone esa fecha como entrega prometida en cada trabajo y avisa a cada cliente por WhatsApp
  si su ventana sigue abierta (si no, el aviso queda para el mostrador). Al día 7 se fija igual.
- **Herramienta del bot** `armar_pedido_impresion` (kind "write" o "read" con efecto controlado,
  como `preparar_presupuesto`): crea el pedido PENDIENTE_PAGO y las dos preferencias de MP. Un
  pedido pendiente por chat a la vez; si el cliente cambia algo, se reemplaza el pendiente.
- **Herramienta** `estado_de_mi_pedido` (lectura): el último pedido del chat y su estado.
- **Guía del bot:** cómo pedir los datos, no repetir, ofrecer brillante/mate, envío opcional, calidad.

## 6. Lo que ven las personas

- **Cliente:** todo por WhatsApp; los links de pago son de Mercado Pago del estudio.
- **Mostrador:** en Trabajos, "Copias impresas · pedido N" en la fase del laboratorio, con el saldo;
  las instantáneas en un trabajo para imprimir en el estudio. En la Bandeja, el chat muestra el
  pedido (número, total, pagado).
- **Daniel:** Configuración → Impresiones: seña (%), plazo/precios vienen del catálogo, envío ($/km,
  máximo de km), y "Pedidos pagados sin enviar" como hoy.

## 7. Si algo falla

- Sin precio en el catálogo para esa medida o plazo → pasa a persona.
- El cliente no paga → el pedido queda PENDIENTE_PAGO; un recordatorio por WhatsApp dentro de la
  ventana de 24 h; a los 3 días se cancela solo (como hoy la conciliación).
- Falla el correo al laboratorio → PAGADO_SIN_ENVIAR y aviso al estudio (ya existe).
- Modo prueba del módulo encendido → el correo del laboratorio va al estudio con "[PRUEBA]" (ya
  existe). Se apaga después de la primera prueba real de Daniel.

## 8. Requisitos previos (Daniel)

- Catálogo: copias por medida y plazo con precio (ya están) y **costo y laboratorio** (Fotolag / La
  Isla) en cada producto de copia.
- Correo de cada laboratorio cargado en Proveedores.
- Mercado Pago del estudio conectado (ya está).

## 9. Pruebas

- Precio por escalón: 10 copias 10x15 para mañana → "más de 10" no aplica (10 no es más de 10);
  11 → sí.
- Seña 50 % y total; acreditar con la seña dispara el laboratorio y deja saldo.
- Original sin recorte: el archivo del ZIP es byte a byte el de la Bandeja.
- Asunto con el plazo correcto; instantáneas no van al laboratorio.
- Envío a 10 km = $30.000; más de 30 km → persona.
- Prueba real: Daniel pide 2 copias 13x18 para mañana por WhatsApp, paga la seña con su tarjeta y
  verifica el correo [PRUEBA] y el trabajo con saldo.
