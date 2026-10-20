# Bot de WhatsApp 24/7 de DNX Estudio — diseño

Fecha: 2026-10-20 · Aprobado en conversación por Daniel el 2026-10-20 · Estado: a revisar por escrito

Continúa a [2026-10-09-bandeja-whatsapp-design.md](2026-10-09-bandeja-whatsapp-design.md)
(Bandeja etapa A, PR #441, sin fusionar).

## 1. Objetivo

El WhatsApp de atención al público de DNX Estudio (341 341-9869) se atiende solo las 24 horas.
El bot conversa, cotiza lo de catálogo, recibe los archivos del cliente, arma el pedido en
FOTOFFICE y lo cobra. Camila y Sabina atienden desde la Bandeja lo que el bot no resuelve, y
Daniel aprueba los presupuestos grandes desde FOTOFFICE.

**Éxito:** un cliente que escribe a las 2 de la mañana pidiendo 10 copias 15x21 termina con el
pedido pagado y sus fotos en la carpeta del pedido, sin que nadie del estudio intervenga; y
ningún chat queda sin respuesta aunque el bot falle.

### Decisiones tomadas por Daniel

| Tema | Decisión |
|---|---|
| Libertad del bot | **Según el tipo**: precio fijo de catálogo lo cierra y cobra solo; presupuestos grandes esperan aprobación; lo dudoso pasa a una persona. |
| Dónde se aprueba | **En FOTOFFICE**, no por Telegram. Sin aviso extra: sólo el panel con contador. |
| Telegram | **No se usa** (reemplaza lo dicho el 08/10). |
| Aviso de "listo" | **Botón manual** en el pedido que abre el WhatsApp del estudio con el mensaje armado. Costo $0 (no pasa por la API de Meta). Nada automático. |
| Email del cliente | No se pide. |
| App de Meta | Todavía no existe. Las etapas 1 a 4 no dependen de ella. |

## 2. Tipos de pedido que atiende

| Tipo | Qué hace el bot | Cierra solo |
|---|---|---|
| Impresiones / ampliaciones | Pregunta medida y cantidad, recibe las fotos, controla la resolución, arma el pedido, manda el link de pago. | Sí |
| Cuadros y portarretratos | Consulta precio y stock, recibe la foto si corresponde, arma el pedido, cobra. | Sí |
| Material físico: VHS, DVD, rollos | Cotiza por unidad, cobra la seña, explica dónde y en qué horario dejar el material. El pedido queda "esperando material". | Sí |
| XV, bodas, sesiones | Arma un presupuesto borrador con el perfil de precios y lo deja **a aprobar**. Al cliente: "estamos preparando tu presupuesto". | No |
| Reclamo, descuento, enojo, algo que no entiende | Pasa el chat a "necesita persona". | No |

**El bot nunca:** da descuentos, cambia precios, inventa un precio que no esté en el catálogo o en
el perfil, promete fechas que no figuren en el producto, acepta pagos "por fuera", o envía un
presupuesto grande sin aprobación.

**Requisito previo (Daniel):** todo lo de precio fijo cargado en el catálogo de DNX Estudio,
incluida la digitalización de VHS/DVD y el revelado de rollos (precio por unidad, si lleva seña y
de cuánto, y el texto de "dónde y cuándo dejar el material").

## 3. Piezas

```
Cliente ──WhatsApp──▶ Meta ──webhook──▶ Bandeja (FotofficeWaChat / WaMensaje)
                                           │
                       ┌───────────────────┼────────────────────┐
                       ▼                   ▼                    ▼
                 Archivos entrantes   Estado del chat      Camila / Sabina
                 (descarga → R2)      BOT | HUMANO | …     (Tomar / Devolver)
                       │                   │
                       │            si BOT ▼
                       │          DNX Bot (lib/dnx-bot, Claude)
                       │            herramientas:
                       │              catálogo y stock · perfil de precios
                       │              cliente por teléfono · armar pedido
                       │              asignar archivos · link de pago
                       │              presupuesto a aprobar · pasar a persona
                       ▼                   ▼
            Carpeta del trabajo ◀── FotofficePedido ──▶ Mercado Pago (link existente)
            (FotofficeArchivoTrabajo)       │
                                            └─▶ "A aprobar" (presupuestos grandes)
```

Reutiliza lo que ya existe en `main`:

- **DNX Bot** (`lib/dnx-bot/`, `packages/dnx-bot`): motor con Claude, herramientas, tope de gasto
  diario (`limites.ts`), incidentes, evals. Hoy conversa en el panel; se le agrega un canal
  WhatsApp y herramientas nuevas.
- **Pedidos** (`lib/pedidos/`): `crearPedidoManual`, cobros, espera de pago, link de MP, webhook.
- **Carpeta del trabajo** (`lib/carpetas/`, `FotofficeArchivoTrabajo`): pedido → proyecto → archivos.
- **Clientes** (`lib/clients/find-or-create.ts`): única puerta para crear o encontrar al cliente.
- **Presupuestos** con perfil de precios, plantillas de servicio y borrador automático (PR 419/423).
- **Catálogo y stock** (`Product`, `FotofficeProductoCatalogo`, `StockMovement`).
- **`buildWhatsappUrl`** (`lib/contact/whatsapp.ts`) para el botón de aviso.

## 4. Etapas

Cada etapa es un PR que funciona solo y se puede usar en producción.

### Etapa 1 — Bandeja al día

- Traer el PR #441 a `main` actual (799 commits atrás). Conflictos esperables: `schema.prisma`
  (relaciones en `Workspace` y `Client`), `shell-nav`, `shell-sidebar`, registros de módulos e
  integraciones, `base-en-memoria`.
- Renombrar la migración a un timestamp posterior al último de `main`
  (hoy `20261125120000_clf_agencia_flux`).
- Índice para buscar cliente por teléfono: hoy `clienteDelTelefono()` trae todos los clientes y
  compara en memoria. Guardar el teléfono normalizado (sólo dígitos, forma 549…) e indexarlo.
- Queda en producción en **modo simulado** para DNX Estudio.

### Etapa 2 — Archivos entrantes

- Al llegar un mensaje con imagen, documento, video o audio: pedir a la Graph API la URL del
  medio (`GET /{media-id}`) y descargarlo **enseguida** (la URL vence en minutos), en segundo
  plano para responder 200 a Meta rápido. Guardar en R2 privado; registrar clave, tipo, peso,
  nombre y, para imágenes, ancho y alto.
- La Bandeja muestra miniaturas y permite abrir o descargar.
- Mientras no hay pedido, el archivo queda colgado del chat. Al armar el pedido (o con un botón
  "Pasar al pedido…" en la Bandeja) se copia a la carpeta del trabajo como
  `FotofficeArchivoTrabajo`, con la nota del ítem al que corresponde ("15x21 ×2").
- **Control de calidad**: tabla de medidas → píxeles mínimos (a 150 dpi como piso, 300 ideal).
  Si una imagen no alcanza para la medida pedida, el bot pide reenviarla como *Documento* 📎.
- **Muchos archivos o muy pesados**: el link público de la carpeta hoy sólo permite ver y
  descargar. Se agrega un modo "el cliente puede subir" con vencimiento, usando la subida firmada
  que ya existe en `lib/carpetas/almacen.ts`.
- En modo simulado los archivos de prueba se toman de fixtures.
- Fallo de descarga: el archivo queda marcado "no se pudo bajar" y el bot pide reenviarlo.

### Etapa 3 — El bot atiende (en modo simulado)

- Canal WhatsApp para DNX Bot: cuando entra un mensaje a un chat en estado BOT, se arma el
  contexto (historial del chat, ficha del cliente si existe, archivos recibidos, pedido en curso)
  y el motor responde. La respuesta sale por `envio.ts` de la Bandeja.
- Herramientas nuevas, todas limitadas al workspace del chat:
  - `buscar_catalogo` (precio, stock, seña, instrucciones de entrega del material).
  - `identificar_cliente` (por teléfono; si no existe pide nombre y apellido y lo crea con
    `findOrCreateClient`; si hay más de uno, pregunta en lugar de adivinar).
  - `armar_pedido` (ítems de catálogo; valida stock; crea el `FotofficePedido` con su proyecto y
    carpeta; para material físico, marca "esperando material").
  - `asignar_archivos` (mueve archivos del chat a la carpeta y los ata a un ítem).
  - `enviar_link_de_pago` (total o seña según el producto, con el link de MP existente).
  - `preparar_presupuesto` (etapa 4).
  - `pasar_a_persona` (motivo obligatorio; el chat pasa a "necesita persona").
- Los precios salen siempre de las herramientas; el texto del bot no puede contener un monto que
  no haya devuelto una herramienta en esa conversación (control al enviar, como `cifras.ts`).
- Pago confirmado (webhook existente) → el bot avisa en el chat si la ventana de 24 h sigue
  abierta. Si no pagó, **un** recordatorio dentro de la ventana; si la ventana cerró, no se manda.
- Regla bot/persona heredada de la etapa A: si una persona responde (panel o celular) el bot se
  calla en ese chat; `#bot` lo devuelve.
- **Material físico recibido:** botón "Material recibido" en el pedido (pasa de "esperando
  material" a en curso).
- Horario: el bot atiende siempre; si menciona retiro o entrega, usa el horario del estudio
  cargado en FOTOFFICE.

### Etapa 4 — Presupuestos "A aprobar"

- `preparar_presupuesto` arma un **presupuesto en borrador** con el perfil de precios y la
  plantilla de la categoría (flujo de los PR 419/423), con el chat vinculado.
- En **Pedidos** aparece la vista "A aprobar" con un contador en el menú. Cada uno muestra el
  chat, los archivos y el precio calculado, con tres acciones:
  - **Aprobar y enviar** → el bot le manda al cliente el presupuesto (link público existente).
  - **Corregir** → se edita el presupuesto y después se envía.
  - **Lo atiendo yo** → el chat pasa a una persona.
- Mientras espera, si el cliente vuelve a escribir, el bot responde que se está preparando, sin
  cotizar.
- Sin aviso por Telegram ni email (decisión de Daniel).
- Tarjeta en el tablero: consultas del día, pedidos cerrados por el bot, cobrado (en pesos),
  pendientes, chats que necesitan persona. Fechas en hora argentina.

### Etapa 5 — Conexión real con Meta

- Guiar a Daniel para crear la app de Meta, verificar el negocio y conectar el número con
  **coexistencia** (la app WhatsApp Business del celular sigue funcionando). Confirmar que
  coexistencia esté disponible para el número argentino; si no, decidir antes de migrar.
- Variables `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; token por workspace en el
  vault (ya previsto en la etapa A).
- Confirmar con payloads reales: ecos `smb_message_echoes`, stickers, reacciones, formato 549.
- **Piloto**: unos días con el número real y Camila/Sabina mirando en paralelo antes de dejar al
  bot solo.

### Etapa 6 — Botón "Avisar que está listo"

- En cada pedido, botón **Avisar que está listo**. Arma el texto (nombre, qué está listo, saldo a
  pagar si queda, dirección y horario de retiro) y abre `wa.me` con el mensaje (`buildWhatsappUrl`).
  El operario lo revisa y aprieta enviar en el WhatsApp del estudio. **No usa la API de Meta: $0.**
- El pedido guarda "avisado" con fecha y quién avisó.
- Si el cliente contesta, entra a la Bandeja como cualquier chat.
- Nada se manda automáticamente para avisar "listo".

## 5. Lo que ven las personas

- **Bandeja** (Camila, Sabina, Daniel): chats con estado 🤖 bot · 🙋 persona · ⏳ a aprobar ·
  ✅ resuelto; arriba los que necesitan persona; mensajes, archivos con miniatura y el pedido al
  costado; Tomar / Devolver al bot.
- **Pedidos → A aprobar** (Daniel o quien tenga permiso).
- **Pedido**: carpeta con los archivos del cliente, "esperando material" / "Material recibido",
  "Avisar que está listo".
- **Tablero**: tarjeta del bot.

## 6. Si algo falla

| Falla | Qué pasa |
|---|---|
| Se cae la IA o se llega al tope de gasto diario | El cliente recibe "en un rato te responde una persona"; el chat pasa a "necesita persona"; queda un incidente en FOTOFFICE. |
| No se pudo bajar un archivo | El bot pide reenviarlo. |
| Falla el envío a Meta | Reintento; si sigue, el chat pasa a persona con el mensaje sin enviar a la vista. |
| Se cerró la ventana de 24 h | El bot no escribe (no hay plantillas pagas en este diseño). |
| Stock insuficiente al pagar | El pedido se arma igual pero pasa a persona antes de cobrar. |

## 7. Costos

- Respuestas a mensajes del cliente dentro de las 24 h: **gratis** para Meta.
- Aviso de "listo": **$0** (sale del celular, no de la API).
- IA: se paga por conversación con Claude, con el tope diario existente de DNX Bot.
- No se usan plantillas pagas de Meta en este diseño.

## 8. Pruebas

- Unitarias por herramienta (precios sólo del catálogo, stock, cliente duplicado, resolución).
- Evals del bot (`lib/dnx-bot/evals`) con conversaciones simuladas: 10 copias 15x21; foto
  comprimida para 50x70; portarretratos sin stock; 3 VHS; boda; cliente enojado; pedido de
  descuento; cliente que manda 80 fotos. El bot tiene que resolver bien todos antes de encender.
- Simulador de la Bandeja para probar de punta a punta sin Meta.
- Piloto en vivo (etapa 5).

## 9. Fuera de este diseño

- Plantillas pagas de Meta y avisos automáticos.
- Audios: se guardan, pero el bot no los transcribe (responde pidiendo que lo escriba).
- Turnos de foto carnet y agenda.
- Otros workspaces distintos de DNX Estudio (queda preparado por workspace, pero se enciende sólo
  para DNX Estudio).
- Telegram.
