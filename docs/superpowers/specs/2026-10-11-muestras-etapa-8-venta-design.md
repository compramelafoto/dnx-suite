# Muestras Fotográficas — Etapa 8: venta de obras con reparto en tres y ediciones certificadas

Fecha: 2026-10-11 · Estado: diseño con las respuestas de Daniel del mismo día (fee de la plataforma
15 %, reparto organización/fotógrafo sin valor por defecto, precios que propone el autor y aprueba la
organización, retiro en sede y envío optativo, imprime la organización, **ediciones limitadas,
certificado, QR al dorso y copia digital firmada en esta misma etapa**). Diseño general:
`docs/superpowers/specs/2026-10-08-muestras-fotograficas-design.md` (secciones "Venta con reparto en
tres" y "Ediciones limitadas con QR"; decisiones 7, 8 y 12). Etapas anteriores:
`docs/superpowers/specs/2026-10-10-muestras-etapa-6-design.md` (D33: botón "Adquirir obra" y página
que dice "todavía no está disponible") y `docs/superpowers/specs/2026-10-10-muestras-etapa-7-fotorank-design.md`
(D15: la venta pide un clic aparte del autor). Las etapas 1 a 7 están en producción.
Plan: `docs/superpowers/plans/2026-10-11-muestras-etapa-8-venta.md`.

> La muestra es **presencial**. El visitante escanea el QR de la ficha, ve la obra en su teléfono y
> aprieta **"Adquirir obra"**. Esta etapa hace que esa página venda de verdad: muestra el precio,
> deja elegir **copia digital firmada** o **copia impresa** (única o de edición limitada), cobra con
> **Mercado Pago repartiendo en el momento** entre la plataforma, la organización y el fotógrafo, y
> entrega un **certificado numerado con QR** que cualquiera puede verificar. Mientras Mercado Pago no
> esté habilitado para producción, la misma página sigue diciendo "La venta de esta obra todavía no
> está disponible", pero todo se puede probar con usuarios de prueba.

## Qué se construye

1. **Venta habilitada por muestra.** Quien organiza (dueño) enciende la venta en
   `/panel/muestras/<id>/ventas`, fija **el reparto** (porcentaje de la organización y del fotógrafo
   sobre lo que queda después del 15 % de la plataforma; sin valor por defecto), **cómo se entregan
   las impresas** (retiro en la sede, con un texto; envío optativo con un costo fijo que pone la
   organización) y condiciones propias optativas.
2. **El autor propone, la organización aprueba.** Por cada obra suya en la muestra, el autor propone
   en **"Dónde expongo → Vender"** uno o más **formatos**: copia digital **única** o **de edición
   limitada (N)**, copia impresa **única** o **de edición limitada (N)** en impresión Fine Art /
   premium con **papel y medida**; cada uno con su **precio** y, si quiere, **pruebas de autor**
   (P/A). Sube **una vez** el **archivo original** de la obra (para imprimir y para la copia digital)
   y **una vez** su **firma manuscrita escaneada**. Ve el reparto y lo **acepta** antes de que se
   venda nada. La organización **aprueba** cada formato o **pide cambios**.
3. **Cuentas de cobro.** Organización y autores conectan su Mercado Pago dando el email de su cuenta:
   la plataforma pide el **consentimiento de reparto** (`/v1/split-consent`), la persona lo acepta en
   Mercado Pago y la pantalla lo verifica. **Sin consentimiento activo de los dos, esa obra no se
   vende.**
4. **Compra.** La página de la obra (`/m/<slug>/sala/o/<id>/adquirir`, y la pública
   `/m/<slug>/o/<id>/adquirir` para obras visibles online) muestra los formatos aprobados con su
   precio, cuántas copias quedan ("Quedan 7 de 10"), entrega (digital / retiro en sede / envío),
   datos del comprador, "Quiero que mi nombre figure en el certificado" y los términos. Al continuar
   se **reserva el número de copia por 20 minutos** y se abre el formulario de tarjeta de Mercado
   Pago (Card Payment Brick). Pagado, el comprador llega a **su pedido** (`/compras/<id>`), con el
   certificado y, si es digital, la descarga del archivo firmado.
5. **Ediciones y certificados.** Cada copia vendida recibe **número** ("3/10", "Copia única",
   "P/A 1/2") que nunca se pasa de N, aunque compren dos personas a la vez. La plataforma genera el
   **certificado** (PDF con la firma escaneada del autor, la obra, el número, papel y medida si es
   impresa, fecha, comprador sólo si aceptó y QR), la **etiqueta del dorso** con QR para pegar detrás
   de la impresión, y para lo digital **el archivo firmado** (metadatos XMP con el código, el número y
   la firma). El QR lleva a **`/verificar/<código>`**: "Copia auténtica 3/10 de <obra> de <autor>,
   emitida el …" o **"Anulada"** si hubo devolución; el número anulado no se vuelve a usar.
6. **Pedidos y producción.** En `/panel/muestras/<id>/ventas/pedidos` la organización ve cada venta y
   lleva las impresas por **en producción → lista para retirar → enviada → entregada** (circuito de
   CLF), baja el original para imprimir, el certificado y la etiqueta. El autor ve sus ventas.
7. **Cobro confirmado entre bases.** La Order se crea desde Muestras y casi siempre vuelve pagada en
   el momento. Además, el receptor único de notificaciones de la suite (en CLF) **avisa a Muestras**
   con un POST firmado que sólo dice "la orden X cambió"; Muestras **le pregunta a Mercado Pago** y
   concilia. Un **barrido cada 10 minutos** y la página del pedido concilian también, así la venta no
   depende del aviso.

## Lo que encontramos (y condiciona el diseño)

| Tema | Dónde está | Qué significa para esta etapa |
|---|---|---|
| Orders API + Split 1:N | `packages/payments/src/providers/mercado-pago/orders/adapter.ts` → `MercadoPagoOrdersAdapter.createSplitOrder(input)`; `getOrder(id, env)`; `refund({ providerOrderId, idempotencyKey })` | Es **Checkout API con Card Payment Brick**: la Order se crea en el servidor **con el token de la tarjeta** (`processing_mode: automatic`) y vuelve casi siempre `processed/accredited` en la misma respuesta. No hay `init_point` ni redirección ni `notification_url` por pedido. |
| Reparto | `buildSplitEntriesFromDistribution` (`orders/mapper.ts`): cada destinatario con `receiver_id` es `partner`; **todo lo demás se suma al `owner`**. Sin "application fee" aparte. Montos `fixed` (`fixed_preferred`). Máximo 10 partners. El `owner` es la cuenta de DNX (`ownerUserId`, servidor). | Plataforma = `owner` (15 % del precio); organización y fotógrafo = `partners`. Si son la misma persona, un solo partner. |
| Validación | `validateMercadoPagoSplitOrder` (`orders/validator.ts`): partner con consentimiento `ACTIVE` y `receiver_id` UUID; suma = total; `deviceSessionId` real; `payerEmail` obligatorio (en sandbox, terminado en `@testuser.com`). | La compra pide email y documento (señal antifraude: un pagador con sólo email fue rechazado `high_risk`; `payer-profile.ts`). |
| `external_reference` | `buildOpaqueExternalReference(product, entity, id)` → `<producto>-<entidad>-<id>` con guarda anti-datos personales (`orders/external-reference.ts`). | **`muestras-venta-<publicId>`** (no `MUE:`: la forma validada con Mercado Pago es la de guiones). |
| Descriptor en el resumen | `sanitizeStatementDescriptor` (mayúsculas, ≤ 22). | **`MUESTRAS FOTO`**. |
| Consentimiento de reparto | `MercadoPagoSplitConsentAdapter` (`split-consent/adapter.ts`): `invite` (`POST /v1/split-consent` con el email), `getConsent(receiverId)`. Escribir en producción exige `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED`; sandbox siempre. Es **por cuenta**, sirve para todos los productos. FOTOFFICE lo usa en `apps/fotoffice/lib/payments/connect/consent-invite.ts`. | Para recibir reparto **no hace falta OAuth**: alcanza con el email de la cuenta y la aceptación en Mercado Pago. Muestras guarda su propia fila por persona y ambiente (D13). |
| Puerta de producción | `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED` no la mira el adaptador: el cliente HTTP bloquea escrituras en producción salvo `allowProductionWrites`. La miran CLF (receptor), FOTOFFICE (`cobroConRepartoHabilitado`) y las CLI. La homologación no cerró: falta la orden productiva de cierre. | Muestras la exige para el modo en vivo (D2), y además su propia llave. |
| Receptor de notificaciones | `apps/compramelafoto/app/api/webhooks/dnx-payments/route.ts` → `handleClfOrdersWebhook` (`lib/homologation/mp-split-1n/orders-webhook.ts`): valida la firma, deduplica (`DnxPaymentWebhookInbox`), hace `GET /v1/orders/{id}` con `MERCADOPAGO_TEST_ACCESS_TOKEN` y **sólo observa**: no hay ruteo por producto. Con `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED=true` **no procesa nada** y fija `environment: "sandbox"`. | El ruteo hacia Muestras es **nuevo** (pocas líneas, D35). En vivo, el receptor de CLF tiene que cambiar igual (cierre de homologación, fuera de esta etapa): por eso Muestras **no depende** del aviso (D29, D32). |
| Devoluciones | Total sobre una orden con reparto **anda** (una pata por receptor); **parcial con reparto falla** (`split_validation_error`). | Sólo devolución **total** (D27). |
| Otras apps | SubiLaFoto, tienda de FOTOFFICE y reservas cobran con **Checkout Pro de dos partes** (`marketplace_fee`) y webhook propio por pedido; ninguna cobra con 1:N en producción. FOTOFFICE cursos tiene el armado 1:N apagado (`apps/fotoffice/lib/payments/split-1n-cursos.ts`). | Muestras es el **primer** consumidor 1:N real. Se copian las *formas*: pedido con `publicId` + token (tienda), transiciones puras (`lib/store/transitions.ts`), reserva con vencimiento y barrido (`expire.ts`, estado `PAID_NO_STOCK`), circuito de impresión de CLF (`PrintOrderStatus`), arrepentimiento (`lib/store/regret.ts`). |
| Muestras hoy | `packages/muestras/src/room.ts`: `SALES_ENABLED = false`, `saleState`, `showBuyButton`, `SALE_UNAVAILABLE_TEXT`. Página `apps/muestras/app/m/[slug]/sala/o/[workId]/adquirir/page.tsx`; botón `components/sala/boton-adquirir.tsx`; datos en `lib/sala/consultas.ts` (`vistaDeSala`, `obraParaAdquirir`). `CulturalExhibitorWork` tiene `forSale`/`priceArs`; `CulturalContestWork` tiene `forSale`/`saleConsent`. **`CulturalActivityWork` no tiene datos de venta.** | **Hueco:** la sala sólo mira `CulturalExhibitorWork.forSale`: las obras de concurso nunca muestran el botón. Se corrige leyendo las ofertas (D11). |
| Bucket | El bucket de Muestras es **público** (`lib/imagenes/r2.ts`, sin URL firmadas). | Originales, firmas y archivos vendidos van a un **bucket privado nuevo** (D17). |
| Correo | Apagado en producción (`MUESTRAS_CORREOS_EN_VIVO`). | Todo con enlaces en pantalla; el comprador guarda el enlace de su pedido (D25). |

## Decisiones

### Interruptores y modos

| # | Decisión | Por qué |
|---|---|---|
| D1 | **Tres modos**, calculados por una regla pura `salesMode(env)` y nunca guardados: **`OFF`** (nadie compra; la página dice "todavía no está disponible"), **`TEST`** (sandbox: sólo el super admin y las cuentas de `MUESTRAS_VENTAS_PROBADORES` ven precios y compran, con tarjetas de prueba; el público sigue viendo "todavía no está disponible") y **`LIVE`** (todos compran con dinero real). | El código sale a producción ya, se prueba completo con usuarios de prueba de Mercado Pago y el público no ve nada hasta el final. |
| D2 | **`LIVE` exige las dos llaves y la configuración**: `MUESTRAS_VENTAS_EN_VIVO=true` **y** `DNX_MP_ORDERS_1N_PRODUCTION_ENABLED=true` **y** `MUESTRAS_MP_ENV=production` con un token que no sea de prueba, más la configuración completa (D3). **`TEST`**: `MUESTRAS_MP_ENV=sandbox` con token de prueba y configuración completa (`MUESTRAS_VENTAS_EN_VIVO` no lo vuelve público: con sandbox nunca se cobra dinero real). Cualquier otra combinación → `OFF`, y el panel dice por qué ("Falta la clave de firma de certificados", "Mercado Pago todavía no habilitó la producción"). | Encender la venta real es deliberado y requiere dos decisiones separadas (la de la suite y la de Muestras). |
| D3 | **Configuración completa** = `MUESTRAS_MP_ACCESS_TOKEN`, `MUESTRAS_MP_PUBLIC_KEY`, `MUESTRAS_MP_OWNER_USER_ID`, `MUESTRAS_PEDIDOS_SECRET`, `MUESTRAS_CERT_PRIVATE_KEY` + `MUESTRAS_CERT_KEY_ID`, `MUESTRAS_R2_PRIVATE_BUCKET`. `MUESTRAS_AVISO_PAGOS_SECRET` y `CRON_SECRET` no son obligatorias para vender (el barrido y la página concilian), pero el panel avisa si faltan. **El token y el owner son los de la aplicación "DNX Suite"** (la única habilitada para 1:N); en sandbox, los del usuario de prueba que usa CLF (`MERCADOPAGO_TEST_ACCESS_TOKEN`): una Order sólo se puede leer con el token de quien la creó, y el receptor de CLF la lee con ese. | Una sola aplicación y una sola homologación para toda la suite. |
| D4 | **Lo de prueba no ensucia lo real.** En `TEST`, pedidos y copias se guardan con `isTest = true`: numeración **aparte** (la copia 1/10 de prueba no gasta la 1/10 real), certificados con la marca **"CERTIFICADO DE PRUEBA — SIN VALIDEZ"** y la verificación dice "Certificado de prueba". El super admin puede **"Borrar las ventas de prueba"** de una muestra. Las cuentas de cobro también se guardan por ambiente (D13). | Se puede probar en la muestra real sin gastar números ni mezclar datos. |
| D5 | **El precio sigue sin ser público** (etapa 6, D33) salvo en la página de compra cuando el modo deja comprar a quien mira. El panel (organización y autor) siempre muestra precios. | Lo que se prometió en la etapa 6. |

### Reparto y fee

| # | Decisión | Por qué |
|---|---|---|
| D6 | **Fee de la plataforma: 15 % del precio de la obra** (`PLATFORM_FEE_BPS = 1500`, constante en `packages/muestras`; se copia a la muestra al encender la venta y a cada pedido). No se cobra sobre el envío. **Organización y fotógrafo** se reparten el 85 % restante con los porcentajes que fija la organización al encender la venta (**sin valor por defecto**; cada uno de 0 a 85 en puntos enteros, la suma da 85). El panel lo muestra en lenguaje simple con un ejemplo: "De una venta de $100.000: plataforma $15.000, organización $25.000, fotógrafo/a $60.000". | Respuesta de Daniel: 15 %; el reparto lo decide cada organización y lo acepta cada autor. |
| D7 | **Montos exactos y redondeo.** Todo en centavos: `fee = round(precio × 15 %)`, `organización = round(precio × org %)`, `fotógrafo = precio − fee − organización` (el redondeo cae en el fotógrafo, nunca a su contra más de un centavo). El **envío va entero a la organización** (es quien envía). La Order va con montos `fixed`: owner = fee, partner organización = su parte + envío, partner fotógrafo = su parte. Si organización y fotógrafo son la misma cuenta, un solo partner con la suma. Si una parte da 0, ese partner no va. Regla pura `saleAmounts`. **Resuelto (2026-10-11):** la comisión de procesamiento de Mercado Pago sale del 15 % de la plataforma; organización y fotógrafo reciben exactamente su parte acordada (`MP_FEE_PAID_BY = "PLATFORM"`). | Reparto exacto, verificable y sin decimales sueltos. |
| D8 | **Aceptación del autor** por muestra (`CulturalSaleAuthorTerms`): ve "De cada venta de tus obras en <muestra>: plataforma 15 %, organización X %, vos Y %" y acepta (texto versionado `SALE_SPLIT_TEXT` + `SALE_SPLIT_TEXT_VERSION`). Queda la versión del reparto aceptada (`splitVersion`). **Cambiar el reparto** sube `splitVersion` y **frena la venta de ese autor** hasta que acepte de nuevo (las ventas ya hechas no cambian). No se puede cambiar con pedidos pendientes de pago. Para obras de concurso además hace falta `saleConsent = ACCEPTED` (etapa 7, D15); para obras de expositores, que el expositor haya marcado "La quiero vender". | Decisión 12 del diseño general. |

### Ofertas (formatos) y precios

| # | Decisión | Por qué |
|---|---|---|
| D9 | **Una oferta por formato** (`CulturalWorkOffer`), colgada de la obra de la muestra (`activityWorkId`, sin FK, como etapas 6 y 7) y de su autor (`authorUserId`). Formatos: **`DIGITAL`** o **`PRINT`**; edición **`UNIQUE`** ("Copia única", N = 1) o **`LIMITED`** (N de 2 a 999). Impresa: **papel** (texto, ≤ 120, p. ej. "Hahnemühle Photo Rag 308 g"), **medida de la imagen** en cm (5–300) y "Impresión Fine Art / premium" fijo en el texto. **Pruebas de autor** optativas: de 0 a 5 (`MAX_PROOFS`), nunca más que N. Hasta **6 ofertas por obra**. No hay "edición abierta" (todo lo vendido se numera). | Respuesta de Daniel: copia única o edición limitada, digital o impresa Fine Art. Un formato por fila permite, por ejemplo, 10 impresas de 40×60 y 5 digitales. |
| D10 | **Estados de la oferta** (texto): `DRAFT` (la arma el autor) → `PROPOSED` (enviada) → `APPROVED` (la organización aprobó: se puede vender si todo lo demás está, D11) o `CHANGES_REQUESTED` (con nota; el autor corrige y reenvía) · `PAUSED` (cualquiera de los dos la pausa) · `WITHDRAWN` (retirada; si ya vendió, cierra la edición). **Cambiar el precio** de una aprobada la vuelve a `PROPOSED` (la anterior sigue vendiendo al precio viejo hasta que se aprueba la nueva: se guarda `approvedPriceArs` aparte de `priceArs`). **N no puede subir después de la primera venta** (`firstSoldAt`), ni bajar por debajo de lo emitido + reservado; formato, edición, papel y medida quedan fijos después de la primera venta. Regla pura `offerTransition`. | La organización decide lo que se vende en su sala; el autor, el precio de su obra. |
| D11 | **Una oferta se puede comprar** (`offerPurchasable`) sólo si: la venta de la muestra está `OPEN`; la muestra está publicada (`APPROVED`), no cancelada; la oferta `APPROVED`; el autor aceptó el `splitVersion` vigente; la obra se puede vender (D8); **la organización y el autor tienen consentimiento de reparto `ACTIVE`** en el ambiente del modo; está el **archivo original** (`READY`) y la **firma del autor**; quedan números libres. Cada falta tiene un texto para el panel ("Falta que Ana conecte su Mercado Pago"). En la página pública, cualquier falta = la obra no se ofrece. | "Sin Mercado Pago conectado, esa obra no se vende" (diseño general). |
| D12 | **Precio entero en pesos**, de `PRICE_MIN_ARS = 1.000` (confirmado el 2026-10-11) a `SALE_PRICE_MAX_ARS = 20.000.000` (los montos repartidos se guardan en centavos en columnas `INT`, que llegan hasta ~21 millones de pesos). El `priceArs` que el expositor cargó en la etapa 6 se ofrece como valor inicial de su primera oferta; después manda la oferta. Las obras de concurso no tenían precio: lo pone el autor. | Respuesta de Daniel: el autor propone, la organización aprueba. |

### Cuentas de cobro

| # | Decisión | Por qué |
|---|---|---|
| D13 | **"Cobros"** (`/panel/cobros`, grupo "Tu cuenta"): la persona escribe el **email de su cuenta de Mercado Pago**; la plataforma llama a `invite` con el token de DNX y guarda `receiverId`, estado e `inviteUrl` en **`CulturalPayoutAccount`** (una fila por persona y ambiente: `SANDBOX`/`PRODUCTION`). Botón **"Aceptar en Mercado Pago"** (abre `inviteUrl`) y **"Ya lo acepté, verificar"** (`getConsent`). Además, al pagar, se vuelve a verificar contra Mercado Pago si el último chequeo tiene más de 10 minutos. Escribir en producción exige `DNX_MP_SPLIT_CONSENT_PRODUCTION_ENABLED` (si no, "Mercado Pago todavía no habilitó esta función"). Sirve para **todas** sus muestras. No se guarda ningún token de la persona. | El consentimiento es por cuenta; con el email alcanza. Es lo mismo que hace FOTOFFICE, sin OAuth. Una tabla propia evita enums de las tablas `Dnx*` y separa prueba de producción. |
| D14 | **Quién cobra por la organización**: el **dueño** de la muestra (`proposedByUserId`) en el momento de encender la venta, guardado en `CulturalSaleSetup.organizerUserId`. Cambiarlo es "Cambiar quién cobra" (sólo dueño o super admin; frena con pedidos pendientes). Un laboratorio externo con cuenta propia queda para después. | Respuesta de Daniel: imprime la organización por ahora. |

### Archivos, firma y certificados

| # | Decisión | Por qué |
|---|---|---|
| D15 | **Archivo original** por obra (`CulturalSaleFile`, único por `activityWorkId`): JPEG, PNG o TIFF de hasta **80 MB**, subido **directo al bucket privado** con una URL firmada de 10 minutos (`@aws-sdk/s3-request-presigner`, que ya usan FOTOFFICE, FotoRank, CLF y SubiLaFoto). Al confirmar, el servidor lo lee, calcula **SHA-256**, mide (sharp) y lo marca `READY`; si no es imagen válida, `REJECTED` con el motivo. Reemplazarlo **después de la primera venta** no se permite (el certificado cita su hash). | Lo que se vende es el original, no la WebP de 2000 px de la sala. Vercel no acepta cuerpos de más de 4,5 MB: la subida va directa. |
| D16 | **Firma manuscrita escaneada** del autor, una vez (`CulturalAuthorSignature`, por `userId`): PNG o JPEG ≤ 5 MB, se recorta y se guarda como PNG en el bucket privado. Sólo se usa dentro del certificado PDF. **Nunca** tiene URL pública. | Una firma suelta en un bucket público se puede copiar. |
| D17 | **Bucket privado nuevo** (`MUESTRAS_R2_PRIVATE_BUCKET`, mismas llaves R2 de Muestras): `originales/<userId>/<id>`, `firmas/<userId>.png`, `ventas/<orderId>/…` (archivo firmado y certificado generados, en caché). Se lee y se escribe sólo del servidor; se entrega por rutas que validan el permiso. Lo crea Daniel en Cloudflare (o el controlador con permiso). | El bucket de Muestras es público y sus direcciones no vencen. |
| D18 | **Firma digital del certificado** (diseño general, sección 8): clave **Ed25519** de DNX (`MUESTRAS_CERT_PRIVATE_KEY`, PKCS8 PEM en base64; `MUESTRAS_CERT_KEY_ID`, p. ej. `mf-2026-10`), con `node:crypto`. Se firma el **texto canónico** (JSON con claves ordenadas, regla pura `certificatePayload`) de: versión, código, `kid`, muestra, obra (título), autor (nombre como firma), formato, edición (`UNIQUE`/`LIMITED`), número y N (o P/A k de m), papel y medida si es impresa, **SHA-256 del original**, fecha de emisión (día argentino) y el comprador **sólo si aceptó**. Se guardan el texto, la firma y el `kid` en la copia. `/verificar/clave` publica la clave pública (y las anteriores de `MUESTRAS_CERT_OLD_PUBLIC_KEYS`, si se rota). Sin blockchain ni NFT; C2PA queda para después. | Lo pidió Daniel; `node:crypto` lo trae, sin dependencias. |
| D19 | **Código de certificado**: 12 caracteres del alfabeto sin ambiguos de los códigos de sala (≈ 60 bits), único. QR a **`<APP_URL>/verificar/<código>`**. Página **pública, dinámica, `noindex`**: "Copia auténtica **3/10** de *<obra>* de **<autor>**, emitida el 14 de noviembre de 2026", formato, papel y medida, la muestra, "Firma digital verificada" (se verifica en cada pedido con la clave pública) y, si hubo devolución, **"Esta copia fue anulada el … El número no se vuelve a usar."** La miniatura de la obra sólo si la obra se ve online según la sorpresa (etapa 6); si no, sin imagen. El comprador figura sólo si aceptó. `/verificar` sin código tiene un campo para escribirlo. Freno por IP `verificar` 60/10 min. | Lo que da valor a una copia es el registro, no el archivo (diseño general). |
| D20 | **Piezas que genera la plataforma** (pdf-lib + qrcode, sin navegador, como fichas y diplomas): **certificado** A4 vertical (obra, autor, número grande, formato, papel y medida, fecha, comprador si aceptó, firma escaneada, QR, código, huella abreviada del original y "Verificá en …"); **etiqueta del dorso** de 10 × 6 cm (QR, "3/10", título, autor, código) en una hoja A4 con marcas de corte, para pegar detrás de la impresión; **archivo digital firmado**: el original pasado a JPEG calidad 95 en el tamaño original con **XMP** (`sharp().withXmp()`, que trae `sharp 0.34.5`) con `dc:title`, `dc:creator`, `dc:rights`, `xmpRights:WebStatement` = URL de verificación y un bloque propio `mf:` con código, número/N, SHA-256 del original, `kid` y firma. Se generan **al primer pedido** y se guardan en `ventas/<orderId>/`. | Respuesta de Daniel: certificado, QR al dorso y copia digital firmada, todo desde la plataforma. |

### Numeración (nunca la copia 11 de 10)

| # | Decisión | Por qué |
|---|---|---|
| D21 | **Una fila por número** (`CulturalEditionCopy`): `offerId`, `isTest`, `kind` (`COPY`/`PROOF`), `number`, `status` `RESERVED` \| `ISSUED` \| `VOIDED` \| `RELEASED`, `reservedUntil`, `orderId`. **Único `(offerId, isTest, kind, number)`**: la base impide dos filas con el mismo número. Reservar = transacción con **`SELECT … FROM "CulturalWorkOffer" WHERE id = $1 FOR UPDATE`**, contar emitidas + anuladas + reservadas vigentes, y si queda lugar tomar **el número libre más bajo** (`nextEditionNumber`): primero una fila `RELEASED` o `RESERVED` vencida (nunca emitida) que se reutiliza, si no una nueva. Una copia `ISSUED` o `VOIDED` **nunca** se reutiliza. | Dos compras simultáneas se ordenan por el bloqueo; el índice único es la última red. Test de concurrencia contra una base real (D33). |
| D22 | **Reserva de 20 minutos** al apretar "Continuar al pago" (`RESERVATION_MINUTES = 20`). Si en 20 minutos no se creó la Order, el pedido pasa a `EXPIRED` y la copia a `RELEASED` (perezoso al reservar otra + barrido). Si la Order quedó **pendiente** en Mercado Pago (`in_process`, revisión), la reserva se **extiende** mientras siga pendiente, hasta 72 horas (`PENDING_HOLD_HOURS`), y después el barrido avisa al super admin. Pago rechazado → `RELEASED` en el acto. | Diseño general: reservar 20 minutos y liberar si no se paga. |
| D23 | **Pago tardío sin lugar** (la reserva venció, se liberó y otro tomó el número): al conciliar `PAID` se intenta **otro número libre**; si no queda ninguno, el pedido pasa a **`PAID_NO_COPY`**, el panel lo muestra arriba en rojo al super admin y a la organización ("Cobrado sin copia disponible: hay que devolver") y la devolución es total (D27). Mismo criterio que `PAID_NO_STOCK` de la tienda de FOTOFFICE. | Nunca se emite una copia de más, ni se pierde un pago sin aviso. |
| D24 | **Pruebas de autor** (`PROOF`, "P/A 1/2"): no se venden; el autor las **pide** desde su panel y la organización (`sales`) las **emite** ("Emitir certificado de P/A"), con certificado y etiqueta como cualquier copia, sin comprador. | Optativas, como pidió Daniel. |

### Compra, pedido y entrega

| # | Decisión | Por qué |
|---|---|---|
| D25 | **Pedido** (`CulturalSaleOrder`): `publicId` (opaco, 16 caracteres), token del enlace (HMAC con `MUESTRAS_PEDIDOS_SECRET`; se guarda el hash, como `STORE_ORDER_TOKEN_SECRET` de la tienda), comprador (nombre, email, teléfono optativo; **el documento se manda a Mercado Pago y no se guarda**), "nombre en el certificado" sí/no, entrega, dirección si es envío, montos congelados (precio, envío, total, fee, organización, fotógrafo) y la **foto del reparto** (`splitSnapshot`: porcentajes, `splitVersion`, `receiverId` de cada uno y ambiente), `externalReference = muestras-venta-<publicId>`, `providerOrderId`, `idempotencyKey`. El comprador **no necesita cuenta**. Al terminar ve su pedido en **`/compras/<publicId>?t=<token>`** (y queda una cookie `mf_pedido_<publicId>` de 30 días): "Guardá este enlace: es la forma de volver a tu pedido y a tu certificado" + "Copiar enlace". Cuando se encienda el correo de Muestras, se le manda (fuera de alcance). | El visitante compra parado frente a la obra, sin crear cuenta. Sin correo, el enlace es la única llave. |
| D26 | **Entrega.** Digital: el archivo firmado y el certificado se descargan desde el pedido apenas está `PAID` (freno `descargaVenta` 30/h por pedido). Impresa: **retiro en la sede** por defecto (texto de la organización: "Retirala en la sede a partir del cierre, de martes a domingo de 15 a 20") y, si la organización lo habilitó, **envío** con su costo fijo y un texto (zona, plazo); la dirección se pide sólo para envío. Circuito de la impresa (`fulfillment`, regla pura `fulfillmentTransition`, copiado de CLF): `PENDING` → `IN_PRODUCTION` → `READY` (lista para retirar) → `DELIVERED`, o `IN_PRODUCTION` → `SHIPPED` (con texto de seguimiento) → `DELIVERED`. El comprador ve el estado en su pedido. Los cambios los hace `salesFulfill` (D30). | Respuesta de Daniel: retiro en sede más envío optativo con costo de la organización. |
| D27 | **Devoluciones: sólo totales** (la parcial con reparto falla en Mercado Pago). Las hace el **super admin** desde el pedido ("Devolver el pago", con motivo) con `adapter.refund({ providerOrderId, idempotencyKey })`; la organización puede **pedirla** ("Pedir devolución", queda en el historial y en la lista del super admin). Al conciliar `REFUNDED` o `CHARGED_BACK`: pedido en ese estado, copia **`VOIDED`** con motivo y fecha, certificado anulado. El número no vuelve. **Arrepentimiento** (Ley 24.240 y Res. 424/2020): el pedido tiene "Botón de arrepentimiento" (10 días corridos) que registra el pedido de devolución, como `lib/store/regret.ts`; para lo digital ya descargado el texto lo aclara (**a revisar por un abogado**). | Lo que Mercado Pago permite hoy; la plata vuelve de las tres partes a la vez. |
| D28 | **Términos de la venta** versionados (`SALE_TERMS_TEXT`, `SALE_TERMS_TEXT_VERSION`), con las condiciones de la organización debajo; el comprador los acepta con una casilla. Dicen quién vende (la organización y el autor, con la plataforma como intermediaria), qué es cada formato, que el valor de la copia digital está en el certificado registrado y no en el archivo, plazos de entrega y devolución. **A revisar por un abogado antes de `LIVE`.** | Venta a consumidores. |

### Confirmación de pago entre bases

| # | Decisión | Por qué |
|---|---|---|
| D29 | **Cuatro caminos que llegan a la misma conciliación** (`conciliarPedido(publicId | providerOrderId, origen)` en Muestras, idempotente): (1) **al crear** la Order (casi siempre vuelve `processed/accredited`); (2) **la página del pedido**, si está pendiente (con freno); (3) **el aviso de CLF** (D31); (4) el **barrido** `/api/cron/ventas` cada 10 minutos (`*/10 * * * *`, con `CRON_SECRET` y `revisarLlave`): vence reservas sin Order, pregunta por las pendientes (hasta 72 h), y una vez por día repasa las pagadas de los últimos 60 días buscando devoluciones y contracargos (hasta 100 por corrida). Ninguno confía en lo que llega: **siempre `GET /v1/orders/{id}`** con el token de Muestras, y se comparan `external_reference`, total y reparto con lo congelado; si no coinciden, no se aplica nada y se registra la alerta. | El webhook no es la fuente de verdad (lo confirmó Mercado Pago) y en vivo el receptor de CLF todavía no procesa: Muestras tiene que andar sin él. |
| D30 | **Transiciones puras** `saleOrderTransition(actual, estadoDeMP)`: `PENDING_PAYMENT` → `PAID` (`processed` con pago acreditado) \| `REJECTED` (`failed`, `canceled`, pago rechazado) \| `EXPIRED` (barrido) · `PAID` → `REFUNDED` \| `CHARGED_BACK` · `PAID_NO_COPY` → `REFUNDED`. Nunca hacia atrás; repetir el mismo estado no hace nada. Cada cambio: `UPDATE … WHERE status = <anterior>` (si cambió 0 filas, otro camino ya lo hizo) y una fila en `CulturalSaleEvent` (origen `CREATE`/`RETURN`/`NOTICE`/`SWEEP`/`ADMIN`, estado de MP, detalle). Al pasar a `PAID`: copia `ISSUED`, código, firma, `issuedAt`; `firstSoldAt` de la oferta si es la primera. | Idempotencia por estado, como SubiLaFoto y la tienda; el historial sirve para conciliar a mano. |
| D31 | **Aviso de CLF → Muestras** (cambio mínimo en CLF, D35): después de que el receptor valida la firma y lee la Order, si su `external_reference` empieza con `muestras-venta-` y no es duplicado, CLF manda **en segundo plano** (`after()` de Next) `POST <MUESTRAS_AVISO_PAGOS_URL>` (por omisión `https://muestrasfotograficas.com/api/pagos/aviso`) con cuerpo `{"providerOrderId":"…"}` y encabezado `x-dnx-aviso: t=<segundos>,v1=<HMAC-SHA256(MUESTRAS_AVISO_PAGOS_SECRET, "<t>.<cuerpo>")>`, 3 s de espera, sin reintentos, **nunca rompe** la respuesta a Mercado Pago. Muestras verifica la firma (5 minutos de tolerancia, `timingSafeEqual`), responde `202` y concilia con `after()`. El aviso **no dice nada del pago**: sólo "mirá esta orden". El módulo de firma se copia idéntico en las dos apps con el mismo vector fijo de test (como la firma de FotoRank en la etapa 7). | Las bases de CLF y Muestras son distintas; el aviso firmado y la lectura propia en Mercado Pago evitan confiar en otra app. |
| D32 | **Lo que no hace esta etapa en CLF**: no cambia la guarda del receptor (en vivo sigue sin procesar), ni el token de lectura (sandbox), ni la persistencia. Abrir el receptor a producción es parte del **cierre de la homologación** de `@repo/payments`; mientras tanto, en `LIVE`, Muestras confirma por los caminos 1, 2 y 4 (la compra con tarjeta vuelve resuelta en el momento en la enorme mayoría de los casos). | CLF está en producción con ventas reales: el cambio es aditivo y chico. |

### Permisos, panel y pruebas

| # | Decisión | Por qué |
|---|---|---|
| D33 | **Pruebas.** Reglas puras con vitest en `packages/muestras` (reparto y redondeo, modos, transiciones de oferta, pedido y producción, numeración con reservas vencidas, P/A y anuladas, texto canónico del certificado). En la app, tests con mocks como las etapas anteriores. **Concurrencia real**: `lib/ventas/reservar.db.test.ts` contra una base de prueba (`MUESTRAS_DB_TEST_URL`, rama Neon descartable; se saltea si no está): 25 reservas simultáneas sobre una edición de 10 → exactamente 10 reservadas, ningún número repetido; con 3 vencidas, se reutilizan sólo esas. Firma: vector fijo Ed25519 de test (clave de prueba en el test, nunca la real). | Diseño general: "que la numeración no se pase del total con compras simultáneas". |
| D34 | **Capacidades nuevas**: **`sales`** (sólo dueño): encender/pausar la venta, reparto, entrega, condiciones, aprobar ofertas, emitir P/A, pedir devolución, cambiar quién cobra. **`salesFulfill`** (dueño y coorganización): ver pedidos, cambiar el estado de producción, bajar original, certificado y etiqueta. Textos: nada. Super admin: todo + devolver + borrar pruebas. **El autor** no es rol: ve y edita sólo lo suyo (`authorUserId = usuario.id`). Cada acción vuelve a leer sesión, rol (`rolEnMuestra` + `puede`) o la fila propia **en la base**; toda negativa en el panel es `notFound()`. | Tabla de capacidades de las etapas 5 a 7. |
| D35 | **Cambios en CLF, todos chicos y aditivos**: (1) `apps/compramelafoto/lib/dnx-payments/aviso-muestras.ts` (+ test): `esOrdenDeMuestras`, `firmarAviso`, `avisarAMuestras`; (2) `lib/homologation/mp-split-1n/orders-webhook.ts`: el resultado `ok` suma `routeTo: "muestras" \| null` (sólo si `outcome = processed`, hay `canonical` y su `externalReference` empieza con `muestras-venta-`); (3) `app/api/webhooks/dnx-payments/route.ts`: si `routeTo === "muestras"`, `after(() => avisarAMuestras(...))`; (4) `.env.example`. Sin secreto, no se avisa (un log). **El Checkout Pro de CLF, sus pedidos y su webhook `/api/payments/mp/webhook` no se tocan.** | CLF vende en producción. |
| D36 | **Sin dependencias externas nuevas.** El **Card Payment Brick** se carga con el script oficial `https://sdk.mercadopago.com/js/v2` (`next/script`) y `mp.bricks().create("cardPayment", …)`, sin `@mercadopago/sdk-react`. A `apps/muestras/package.json` se suman sólo **`@repo/payments: workspace:*`** y **`@aws-sdk/s3-request-presigner`** con **la misma versión que ya usa `apps/fotoffice`**: el lockfile cambia sólo en las líneas del importer de Muestras (ningún paquete nuevo se descarga). Si `git diff pnpm-lock.yaml` muestra otra cosa, se frena. | El lockfile es de todas las apps. |

**Capacidades por rol** (se suma a la tabla de las etapas 5 a 7):

| Capacidad | Para qué | Dueño | Coorganización | Textos |
|---|---|---|---|---|
| `sales` | Encender la venta, reparto, entrega, aprobar ofertas, P/A, pedir devolución | ✓ | | |
| `salesFulfill` | Pedidos, producción, original para imprimir, certificado y etiqueta | ✓ | ✓ | |

## Estados (texto)

- `CulturalSaleSetup.status`: `DRAFT` | `OPEN` | `PAUSED` | `CLOSED` (la muestra cerró hace más de 30 días: no se vende más; los pedidos siguen).
- `CulturalPayoutAccount.environment`: `SANDBOX` | `PRODUCTION`; `consentStatus`: `NONE` | `PENDING` | `ACTIVE` | `REJECTED` | `CANCELED` | `EXPIRED`.
- `CulturalSaleFile.status`: `PENDING_UPLOAD` | `READY` | `REJECTED`.
- `CulturalWorkOffer.format`: `DIGITAL` | `PRINT`; `editionKind`: `UNIQUE` | `LIMITED`; `status`: `DRAFT` | `PROPOSED` | `CHANGES_REQUESTED` | `APPROVED` | `PAUSED` | `WITHDRAWN`.
- `CulturalEditionCopy.kind`: `COPY` | `PROOF`; `status`: `RESERVED` | `ISSUED` | `VOIDED` | `RELEASED`.
- `CulturalSaleOrder.status`: `PENDING_PAYMENT` | `PAID` | `REJECTED` | `EXPIRED` | `REFUNDED` | `CHARGED_BACK` | `PAID_NO_COPY`; `delivery`: `DIGITAL` | `PICKUP` | `SHIPPING`; `fulfillment`: `NONE` (digital) | `PENDING` | `IN_PRODUCTION` | `READY` | `SHIPPED` | `DELIVERED`.
- `CulturalSaleEvent.source`: `CREATE` | `RETURN` | `NOTICE` | `SWEEP` | `ADMIN` | `STAFF` | `BUYER`.

## Datos (migración aditiva, a mano)

`20261102120000_muestras_etapa_8_venta` (ordena después de las tres `20261101120000_*`).

Nueve tablas nuevas, **ninguna columna nueva en tablas existentes**, sin enums, ids de usuario `Int`
sin relación a `User`, `activityWorkId` sin FK (como etapas 6 y 7):

- **`CulturalSaleSetup`** — una por muestra (`activityId` único, FK cascade): `status`, `organizerUserId`, `platformFeeBps`, `organizerBps`, `photographerBps`, `splitVersion`, `pickupText`, `shippingEnabled`, `shippingCostArs`, `shippingText`, `extraTerms`, `openedAt`, `createdByUserId`, fechas.
- **`CulturalSaleAuthorTerms`** — aceptación del reparto por autor y muestra (único `(activityId, userId)`): `splitVersion`, los tres porcentajes aceptados, `textVersion`, `acceptedAt`.
- **`CulturalPayoutAccount`** — cuenta de cobro por persona y ambiente (único `(userId, environment)`): `mpEmail`, `receiverId`, `consentStatus`, `inviteUrl`, `lastCheckedAt`.
- **`CulturalSaleFile`** — original por obra (único `activityWorkId`): `activityId` (FK cascade), `authorUserId`, `storageKey`, `sha256`, `bytes`, `mime`, `widthPx`, `heightPx`, `status`, `problem`, `uploadedAt`.
- **`CulturalAuthorSignature`** — firma escaneada (`userId` PK): `storageKey`, fechas.
- **`CulturalWorkOffer`** — formato a la venta: `activityId` (FK cascade), `activityWorkId`, `authorUserId`, `format`, `editionKind`, `editionSize`, `proofCount`, `priceArs`, `approvedPriceArs`, `paper`, `widthCm`, `heightCm`, `status`, `reviewNote`, `proposedAt`, `approvedAt`, `approvedByUserId`, `firstSoldAt`, **`editionGroupId` (optativo, para unir en el futuro una misma edición vendida en varias muestras sin migrar)**, `sortOrder`, fechas.
- **`CulturalEditionCopy`** — un número de una edición: `offerId` (FK **restrict**: una oferta con copias no se borra), `activityId`, `isTest`, `kind`, `number`, `status`, `reservedUntil`, `orderId`, `certificateCode` (único), `certificateKid`, `certificatePayload` (texto canónico), `certificateSignature`, `issuedAt`, `voidedAt`, `voidReason`, fechas. Único `(offerId, isTest, kind, number)`.
- **`CulturalSaleOrder`** — pedido: `publicId` (único), `accessTokenHash`, `activityId` y `offerId` (FK restrict), `copyId` (único), `isTest`, comprador, entrega, montos, `splitSnapshot JSONB`, `status`, `fulfillment`, `trackingText`, `externalReference` (único), `providerOrderId` (único), `providerStatus`, `providerStatusDetail`, `idempotencyKey` (único), `termsVersion`, `holdExpiresAt`, fechas de cada paso, `refundRequestedAt`, `lastSyncedAt`.
- **`CulturalSaleEvent`** — historial del pedido (FK cascade).

La SQL completa está en la Task 4 del plan. **La aplica a mano en producción el controlador, antes
de publicar el código** (Neon `divine-hall-10689679`, rama `development`), y la registra en
`_prisma_migrations` con el SHA-256 del archivo. Como sólo crea tablas, si no se aplicara, el sitio
sigue andando salvo las pantallas de venta; igual va antes.

## Rutas

| Ruta | Quién | Qué |
|---|---|---|
| `/panel/cobros` | con sesión | Email de Mercado Pago, invitación, verificar (D13). |
| `/panel/muestras/[id]/ventas` | `sales` (dueño); coorganización lee | Encender, reparto, entrega, condiciones, estado de cada autor y oferta, aprobar. |
| `/panel/muestras/[id]/ventas/pedidos` | `salesFulfill` | Pedidos, producción, descargas, pedir devolución, P/A. |
| `/panel/expositor/ventas/[activityId]` | el autor | Original, firma, ofertas, aceptar reparto, sus ventas, pedir P/A. |
| `/panel/ventas` | super admin | Pedidos de toda la plataforma, `PAID_NO_COPY`, devoluciones pedidas, borrar pruebas. |
| `/m/[slug]/sala/o/[workId]/adquirir` | con pase (o equipo) | Página de compra (hoy "todavía no está disponible"). |
| `/m/[slug]/o/[workId]/adquirir` | público (obra visible online) | Misma página de compra. Dinámica. |
| `/compras/[publicId]` (+ `/certificado`, `/archivo`, `/arrepentimiento`) | quien tiene el token o la cookie | Pedido, estado, descargas, arrepentimiento. |
| `/verificar`, `/verificar/[codigo]`, `/verificar/clave` | público | Verificación del certificado y clave pública. |
| `/api/ventas/subida`, `/api/ventas/archivo/[id]`, `/api/ventas/etiqueta/[orderId]`, `/api/ventas/certificado/[orderId]` | autor / `salesFulfill` | Subida firmada del original, original para imprimir, etiqueta y certificado. |
| `/api/pagos/aviso` | CLF (firmado) | Aviso "la orden cambió" (D31). |
| `/api/cron/ventas` | cron | Barrido (D29). |

## Privacidad y filtraciones (lista de control)

| Lugar | Riesgo | Cómo queda |
|---|---|---|
| Página de compra | Precio visible antes de tiempo | Sólo con modo que deje comprar a quien mira (D1, D5). Test que serializa la página en `OFF` y busca el precio. |
| Original y firma | Copiarlos desde el bucket | Bucket privado, rutas con permiso; la firma sólo dentro del PDF (D16, D17). |
| `/compras/<id>` | Ver pedidos ajenos | Token HMAC o cookie; comparación en tiempo constante; `noindex`, `no-referrer`, `no-store`. |
| `/verificar/<código>` | Datos del comprador | Sólo el nombre y sólo si aceptó; nunca email, teléfono ni dirección. |
| `/verificar/<código>` | Imagen de una obra sorpresa | Miniatura sólo si la obra se ve online (etapa 6). |
| Documento del comprador | Guardarlo | Va a Mercado Pago y no se guarda (D25). |
| `external_reference` | Datos personales | `muestras-venta-<publicId>` con la guarda anti-PII del paquete. |
| `/api/pagos/aviso` | Que cualquiera dispare cambios | Firma HMAC + ventana de 5 min; el aviso sólo hace que Muestras pregunte a Mercado Pago (D31). |
| Logs | Tokens, tarjetas | Nunca token de tarjeta, documento ni access token; `sanitizeError` del paquete. |
| Panel del autor | Ver ventas de otros | Consultas siempre con `authorUserId` propio. |
| Ventas de prueba | Confundirlas con reales | `isTest`, marca en el certificado, numeración aparte (D4). |

`/privacidad` suma: datos del comprador (para qué, cuánto tiempo), la firma escaneada del autor, el
email de Mercado Pago de quien cobra y la verificación pública de certificados.

## Reglas puras nuevas en `packages/muestras` (con tests)

- `sales.ts`: `PLATFORM_FEE_BPS = 1500`, `SPLIT_TOTAL_BPS = 10_000`, `PRICE_MIN_ARS`, textos versionados (`SALE_SPLIT_TEXT`, `SALE_TERMS_TEXT`, `SALE_*_VERSION`), `salesMode(input)` (D1–D3, con la lista de faltas), `splitProblems`, `splitExample`, `saleAmounts` (D7), `receiverPlan` (une misma persona, saca ceros), `saleExternalReference` / `parseSaleExternalReference`, `offerProblems`, `offerTransition`, `offerPurchasable` (D11, con textos), `saleOrderTransition` (D30), `fulfillmentTransition` (D26), `deliveryOptions`, `salePageState` (reemplaza a `saleState`: `NOT_FOR_SALE` \| `UNAVAILABLE` \| `AVAILABLE` \| `SOLD_OUT`).
- `editions.ts`: `RESERVATION_MINUTES = 20`, `PENDING_HOLD_HOURS = 72`, `MAX_PROOFS = 5`, `MAX_OFFERS_PER_WORK = 6`, `editionLabel`, `editionRemaining`, `nextEditionNumber(rows, size, now)`, `canChangeEdition`.
- `certificates.ts`: `CERTIFICATE_CODE_LENGTH = 12`, `newCertificateCode(randomInt)`, `certificatePayload(data)` (texto canónico), `certificateView(copy)` (válida / anulada / prueba), `xmpPacket(data)`.
- `team.ts`: `sales`, `salesFulfill`; `panel.ts`: "Cobros", "Ventas" en la muestra, "Vender" del autor, "Ventas" del super admin; `room.ts`: `SALES_ENABLED` y `saleState` pasan a `salePageState` (se conservan exportados como envoltura mientras haya usos).

## Riesgos

- **Homologación sin cerrar**: hasta la orden productiva de cierre, sólo `TEST`. El modo `LIVE` necesita además abrir el receptor de CLF a producción para tener avisos (no es imprescindible, D32).
- **3-D Secure / `action_required`**: el Brick de homologación nunca lo enfrentó. Si una Order vuelve pidiendo un paso más, el pedido queda pendiente con "Mercado Pago pidió confirmar el pago; si no lo completaste, probá de nuevo" y la reserva se libera a los 20 minutos. Probar en sandbox antes de `LIVE`.
- **`high_risk` transitorio** de Mercado Pago: se muestra el mensaje del paquete (`status-detail-messages.ts`); no se rediseña.
- **Consentimiento revocado** entre la página y el pago: se re-verifica al pagar (D13); si cae, "Esta obra no se puede comprar ahora".
- **Pago tardío sin copia** (D23) y **contracargos**: anulan la copia; la organización tiene que recuperar la impresión si ya la entregó (fuera de la plataforma).
- **Archivos grandes**: 80 MB por original; leerlo para el hash y generar el JPEG firmado puede tardar ~10–20 s (rutas con `maxDuration = 60`).
- **Clave Ed25519 perdida o filtrada**: se rota (`kid` nuevo; la vieja pasa a `MUESTRAS_CERT_OLD_PUBLIC_KEYS`); los certificados viejos siguen verificando con la pública vieja. Guardarla también fuera de Vercel.
- **La misma obra vendida en otra muestra o por fuera**: la edición es por oferta y por muestra. El autor declara al proponer que esa edición no se vende por otros medios; `editionGroupId` deja unir ediciones más adelante sin migrar.
- **Legal**: términos, arrepentimiento en bienes digitales y facturación de cada parte: revisión antes de `LIVE`.

## Fuera de alcance

Laboratorio externo con cuenta propia (cuarto receptor); correos al comprador, al autor y a la
organización; envío con cotización de correo (Correo Argentino, Andreani); devoluciones parciales;
C2PA; venta de la copia colgada en la sala distinta de "copia única impresa" (se modela como tal);
carrito con varias obras (una obra y un formato por pedido); cuotas sin interés; facturación.

## Decisiones de Daniel (2026-10-11) y preguntas que quedan

Resueltas: fee 15 % del precio (D6); reparto organización/fotógrafo sin valor por defecto, lo fija la
organización y lo acepta cada autor (D6, D8); precios por formato que propone el autor y aprueba la
organización (D9, D10); retiro en sede por defecto y envío optativo con costo de la organización
(D26); imprime la organización (D14); ediciones limitadas, certificado, QR al dorso y copia digital
firmada en esta etapa (D18–D24).

Resueltas el mismo día (respuestas al controlador):
1. ~~Comisión de Mercado Pago~~ → **sale del 15 % de la plataforma**; organización y fotógrafo cobran su parte exacta (D7).
2. ~~Precio mínimo~~ → **$1.000**; máximo **$20.000.000** (D12).
3. ~~Devoluciones~~ → **sólo el super admin**; la organización puede pedirla (D27).
4. ~~Pruebas de autor~~ → **hasta 5 por edición** (D9, `MAX_PROOFS`).
5. ~~Comprar desde la página pública~~ → **sí**, cuando la obra se ve online, además de la sala con el QR.
6. ~~Cierre de la venta~~ → **a los 30 días del cierre de la muestra** (`SALE_CLOSE_DAYS_AFTER_END`, `saleWindowOpen`).

Quedan para Daniel:
7. Crear el **bucket privado** de R2 y generar la **clave Ed25519** (el plan trae el comando); cargar las variables nuevas en Vercel (lista en la guía).
8. **Revisión legal** de los términos de venta y del arrepentimiento para lo digital.
