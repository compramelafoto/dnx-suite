# DNX Bot — Etapa 3: compradores

**Fecha:** 12/10/2026 · **Estado:** diseño para revisión · **Pedido por:** Daniel Cuart
**Base:** etapas 1 y 2 en producción (`2026-10-11-dnx-bot-design.md`, `2026-10-12-dnx-bot-escolar-y-saludos-design.md`).
**Relevamiento:** flujos del comprador revisados el 12/10. De ahí salió el arreglo de `GET /api/cliente/pedidos`, que no pedía sesión (PR 515).

## 1. Objetivo

Que la persona que compra fotos (familias, deportistas, invitados) resuelva sola lo más común, sin escribirle al fotógrafo ni a nosotros:

- encontrar su álbum y sus fotos;
- saber en qué quedó su pago;
- recibir de nuevo el enlace de descarga;
- usar la preventa escolar (pagar, canjear, recuperar el enlace del pack);
- pedir que se quite una foto.

Además, en la página del álbum, que el bot **ayude a comprar**: explica los packs, los descuentos por cantidad y las impresiones con los precios reales del álbum.

**Criterio de éxito:**
- conversaciones resueltas sin caso abierto ≥ 70 %;
- menos consultas de compradores a fotógrafos y a soporte;
- ventas en álbumes donde se usó el bot (sección 9).

## 2. Decisiones tomadas (Daniel, 12/10)

| Tema | Decisión |
|---|---|
| Dónde aparece | Páginas de ayuda (descarga, pago, preventa, mis pedidos) **y** página del álbum |
| Identidad para lo sensible | **Código de 6 números por mail**. Reenviar enlaces no lo necesita porque siempre llegan al mail registrado |
| Tope de gasto | **El mismo tope de USD 30** compartido con fotógrafos |
| Modelo | El mismo de las etapas anteriores (`CLF_BOT_MODEL`, Sonnet 5.5) |

**Decisión propia (a confirmar en la revisión):**
- **Problema:** el tope es compartido, así que una ola de consultas de familias podría dejar sin bot a los fotógrafos.
- **Solución propuesta:** al llegar al **80 %** del tope mensual se apaga primero el bot de compradores, y el 20 % restante queda para los fotógrafos. Telegram avisa como hoy.

## 3. Reglas que no cambian

- Nunca promete lo que no controla. No dice «el fotógrafo te va a devolver la plata» ni «mañana tenés las fotos».
- No mueve plata. Reembolsos, doble cobro, contracargos y pagos aprobados en Mercado Pago que no impactaron se derivan **siempre** a un caso, en el momento.
- Nunca muestra en el chat un enlace de descarga, un enlace de pack ni un mail completo. Los envía al mail registrado.
- La selfie **nunca** pasa por el bot. Si alguien busca sus fotos por cara, el bot le indica el botón de búsqueda del álbum.
- Antes de crear una solicitud (quitar foto, privacidad) muestra una tarjeta y espera **Confirmar**, igual que con los fotógrafos.
- Tono natural y corto; una pregunta por vez; sin asteriscos.
- Menores de edad, amenazas legales y enojo fuerte: caso a un humano, marcado urgente.

## 4. Quién es el comprador para el bot

Hay tres niveles. El bot sabe en cuál está y no ofrece lo que el nivel no permite.

| Nivel | Cómo se llega | Qué permite |
|---|---|---|
| **Visitante** | Cualquier persona; se identifica con una cookie propia del bot (`dnxbot_guest`, al azar, httpOnly) más la IP con hash | Información pública del álbum, estado de un pago por número de pedido (sólo «pagado / pendiente / rechazado»), reenvíos al mail registrado con respuesta genérica, «avisame cuando haya fotos», pedir un código, abrir un caso |
| **Con enlace** | Está en `/descargas/[token]` o en `/cliente/pack/[token]`. El enlace prueba que tiene ese pedido | Todo lo anterior, más el detalle de **ese** pedido o pack: fotos, vigencia, estado del ZIP, cómo canjear. Puede reenviarlo o renovar la vigencia si el álbum todavía existe |
| **Verificado** | Escribió el código de 6 números que le llegó al mail, o tiene sesión de cliente | Todo lo anterior, más **todos** los pedidos de ese mail: estado, fecha, monto en pesos, si la descarga está vigente; enlace para reintentar un pago pendiente; reenvío de cualquiera de sus descargas |

**El código por mail:**
- 6 números, vence a los 10 minutos, 5 intentos.
- Como máximo 3 códigos por hora por mail y por IP.
- Se guarda con hash.
- La respuesta siempre es genérica: «si hay compras con ese mail, te llegó un código». Así no se revela si un mail compró o no.
- Al verificarse, la conversación queda verificada para ese mail durante 24 horas.
- Mail por Resend, con remitente de CompraMeLaFoto.

## 5. Qué resuelve solo y qué deriva

| Situación | El bot |
|---|---|
| «No encuentro mi álbum» | Busca álbumes públicos por nombre, fotógrafo o evento y da el enlace. Si está oculto o vencido, lo explica. Si no aparece, ofrece «avisame cuando haya fotos» o abre un caso |
| «Pagué y no me llegó nada» | Pide el número de pedido o el mail. Visitante: estado del pago. Si está pagado, reenvía la descarga al mail registrado. Si Mercado Pago lo cobró y el pedido figura pendiente: caso inmediato |
| «Se me venció el enlace» | Si el álbum todavía existe, renueva y reenvía al mail registrado. Si ya se borró, lo dice tal cual y abre un caso |
| «El pago quedó pendiente / rechazado» | Explica los tiempos de Mercado Pago. Si está verificado o con el número de pedido más el mail, le da el enlace para reintentar |
| «Me cobraron dos veces» | Caso inmediato con el número de pedido. No promete devolución |
| Preventa escolar | Explica pagar → canjear → entrega. Reenvía el enlace del pack con la recuperación existente (`/api/public/pack/recover`). Alumno mal cargado o fuera de la lista: caso |
| «Quiero que saquen esta foto» | Arma la solicitud con el álbum y la foto y la crea tras **Confirmar** (`/api/removal-requests`). Aclara que la decide el fotógrafo y que no es inmediata. Si hay menores o urgencia: caso urgente |
| Datos personales o biometría | Guía a `/privacidad/solicitud` o a borrar la biometría; puede crear la solicitud tras **Confirmar** |
| Cambiar el mail de un pedido | Aunque esté verificado: caso (lo hace un humano) |
| Impresiones o envíos (`PrintOrder`) | Caso (es otro circuito; fuera de esta etapa) |
| «¿Cuánto sale? ¿Hay packs?» | Precios, packs y descuentos **leídos del álbum** (misma lógica que `/api/a/[id]/quote`); nunca inventa descuentos |

## 6. Herramientas nuevas

**Lectura** (sin confirmación):
- `buscar_album(texto)`: sólo álbumes públicos y no de prueba.
- `ver_album(albumId)`: estado, vigencia, packs, precios, descuentos por cantidad, si tiene búsqueda por selfie, si es preventa.
- `estado_de_pago(pedido, albumId?)`: visitante → sólo el estado; verificado → detalle.
- `mis_pedidos()`: sólo verificado.
- `ver_mi_descarga()`: sólo con enlace.
- `ver_mi_pack()`: sólo con enlace.

**Acciones sin tarjeta** (sólo mandan algo al mail registrado; respuesta genérica; límite por mail y por IP):
- `pedir_codigo(email)`
- `verificar_codigo(codigo)`
- `reenviar_descarga(email | pedido)`
- `reenviar_link_pack(email)`
- `avisame_cuando_haya_fotos(albumId, nombre, email)`

**Acciones con tarjeta Confirmar:**
- `solicitar_quitar_foto`
- `solicitud_de_privacidad`

**Escalamiento:** `abrir_caso` crea un `SupportTicket` sin usuario, con:
- el mail declarado y marcado como **verificado** o **sin verificar**;
- el número de pedido;
- el resumen de la conversación.

Telegram avisa en los casos de plata y en los urgentes. Hay un caso por conversación y como máximo 3 por día por IP.

Todas reutilizan la lógica de las rutas existentes, extraída a funciones compartidas como en las etapas 1 y 2 y sin cambiar su comportamiento.

## 7. Dónde aparece

| Página | Qué sabe al abrir |
|---|---|
| `/album/[slug]`, `/a/[id]` | El álbum (y si es preventa) |
| `/descargas/[token]` | El pedido (nivel con enlace) |
| `/cliente/pack/[token]`, `/cliente/recuperar-pack` | El pack (con enlace, en la primera) |
| `/pago/failure`, `/pago/pending`, `/pago/success` | El número de pedido de la URL (sólo estado) |
| `/cliente/pedidos`, `/cliente/soporte` | Sesión de cliente (verificado) |

**Burbuja:**
- Es la misma de los fotógrafos, con otro saludo y otras sugerencias según la página.
- En el álbum, el globito aparece **a los 20 segundos**, una vez por visita, y nunca se abre solo: «¿Te ayudo a encontrar tus fotos o a elegir un pack?».
- En la descarga: «¿Problemas para bajar tus fotos?».

**Interruptores:**
- `CLF_BOT_BUYERS_ENABLED`: apagado hasta probarlo.
- Lista de álbumes piloto en `SystemSettings` (`dnx_bot_buyers_pilot`), para arrancar con álbumes elegidos (por ejemplo, una preventa activa) antes de abrirlo a todos.

## 8. Cambios en los datos

- `BotConversation`: `guestKey` (cookie del bot), `ipHash`, `buyerEmail` (verificado), `verifiedUntil`, `albumId`, `orderId`, `audience` (`PHOTOGRAPHER | BUYER`).
- `BotUsageDaily`: hoy es único por (plataforma, día, `userId`). Pasa a usar un `actorKey` de texto (`u:79` o `g:<guestKey>`) para contar a los visitantes; los registros existentes se completan con `u:<userId>`.
- `BotEmailCode` (nueva): `id`, `email`, `codeHash`, `conversationId`, `ipHash`, `attempts`, `expiresAt`, `usedAt`, `createdAt`.
- `SupportTicket`: agregar `orderId` (pedido de álbum) opcional. Hoy sólo puede vincularse a `PrintOrder`.
- Límites persistentes en la base (no en memoria, que en Vercel no sirve):
  - visitante: 20 mensajes por día;
  - IP: 60 mensajes por día;
  - verificado: 40 mensajes por día.
- Migración a mano, idempotente, aplicada y registrada en las 4 bases como en las etapas anteriores.

## 9. Medición (resumen diario y Telegram)

- Conversaciones de compradores por página.
- Resueltas sin caso.
- Casos por motivo.
- Códigos pedidos y verificados.
- Reenvíos hechos.
- Solicitudes de quitar foto creadas.
- Gasto del bot de compradores aparte del de fotógrafos (aunque comparten el tope).
- **Ventas posteriores**: pedidos pagados del mismo álbum dentro de las 48 h, con el mismo mail verificado o desde el mismo navegador (se guarda el `guestKey` en el pedido si existe la cookie). No pretende ser exacto; sirve para comparar con el costo, como pediste.

## 10. Anti-abuso

- Límites persistentes (sección 8) y el corte al 80 % del tope (sección 2).
- Turno más corto (`effort` bajo, menos iteraciones) que el de fotógrafos.
- Historial máximo de 30 mensajes por conversación.
- Si aparece abuso, se puede sumar Cloudflare Turnstile en el primer mensaje. No va en esta etapa porque requiere crear una clave en Cloudflare.

## 11. Fuera de esta etapa

- Impresiones y envíos (`PrintOrder`).
- Cambios de mail hechos por el bot.
- Reembolsos.
- WhatsApp.
- Bot de las landings para fotógrafos que todavía no se registraron (etapa 4).

## 12. Riesgos

- **Prueba de posesión débil.** Hoy, el número de pedido más el mail alcanza para reintentar un pago. El bot sólo usa esa combinación para el enlace de reintento (igual que la página de pago fallido), nunca para mostrar datos.
- **Mails a terceros.** Los reenvíos van sólo al mail del pedido y tienen límite; el texto es genérico para no confirmar si un mail compró.
- **Costo.** Muchas más personas que fotógrafos. Por eso hay piloto por álbum, límites y corte al 80 %.
- **Selfies y menores.** Fuera del bot; se derivan.
