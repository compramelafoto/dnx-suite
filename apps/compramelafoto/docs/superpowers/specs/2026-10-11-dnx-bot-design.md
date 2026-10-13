# DNX Bot — asistente de soporte, guía y venta de CompraMeLaFoto

**Fecha:** 11/10/2026 · **Estado:** diseño para revisión · **Autor del pedido:** Daniel Cuart

## 1. Objetivo

Un asistente conversacional dentro de CompraMeLaFoto (CLF) que:

1. **Resuelva solo la mayor cantidad posible de casos** de soporte, ejecutando acciones reales
   sobre la cuenta del usuario (con su confirmación), no sólo explicando.
2. **Guíe la configuración** de punta a punta hasta la primera venta del fotógrafo.
3. **Detecte errores del sistema**, los reporte con pruebas y dispare su corrección (vía Claude Code en
   la nube), sin depender de que alguien los reporte a mano.
4. **Venda**: en las landings capta fotógrafos, organizadores y clientes.
5. **Sea replicable** en las otras plataformas DNX (FOTOFFICE, Clickatón, FotoRank, SubiLaFoto) con
   poco trabajo extra.

**Criterio de éxito de la etapa 1:** la mayoría de las consultas de fotógrafos se cierran sin ticket;
ningún cambio hecho por el bot sin confirmación; ningún dato de un fotógrafo visible para otro.

## 2. Decisiones tomadas (11/10/2026)

| Tema | Decisión |
|---|---|
| Nombre | **DNX Bot** (mismo nombre en todas las plataformas) |
| Orden de etapas | **1) fotógrafos/organizadores logueados → 2) compradores → 3) visitantes de landings** |
| Alcance de acciones | **Hace cambios con confirmación** ("¿Lo hago? [Sí] [No]") y resuelve todo lo posible; lista de prohibiciones duras (§5.3) |
| Avisos a Daniel | **Ticket en el panel de soporte de CLF + Telegram privado** (urgente al instante, resto en resumen diario) |
| Arquitectura | **Dentro de CLF** (ruta en Vercel + API de Claude), con la parte común en un paquete compartido `packages/dnx-bot` |
| Modelo | **Claude Sonnet 5.5** (`claude-sonnet-5-5`), configurable por variable de entorno `CLF_BOT_MODEL` |
| Tono | Voseo, cercano, directo, sin tecnicismos; siempre aclara que es un asistente automático |
| Promesas | **Nunca promete lo que no controla.** Sólo informa hechos registrados en el sistema |

## 3. Principios

- **Hechos, no promesas.** "Abrí el pedido #123; la respuesta te llega por mail" (lo hace el sistema)
  sí. "El fotógrafo te va a devolver la plata" no.
- **El bot no decide permisos.** Cada acción es una función de servidor que vuelve a verificar
  dueño, rol y valores. Aunque el modelo sea engañado, la acción se rechaza.
- **El texto del usuario nunca llega a quien modifica código.** Los reportes de error contienen
  datos estructurados y pruebas; Claude Code trabaja sobre eso.
- **Plata y borrado, siempre por una persona.**
- **Todo queda registrado** (conversación, acción, valor anterior) para auditar y deshacer.

## 4. Arquitectura

```
Navegador (burbuja DNX Bot)
   │  POST /api/bot/chat  (streaming)
   ▼
apps/compramelafoto/app/api/bot/chat/route.ts
   │  sesión (lib/auth.ts) → contexto del usuario → topes de gasto
   ▼
packages/dnx-bot  (común a todas las plataformas)
   ├─ motor de conversación (API de Claude, tool use, caché de la guía)
   ├─ registro de conversaciones y acciones
   ├─ topes de gasto (contadores en base)
   ├─ escalamiento (ticket + Telegram)
   └─ componente de burbuja (React)
   ▼
apps/compramelafoto/lib/bot/  (propio de CLF)
   ├─ guia/            conocimiento de CLF (markdown versionado)
   ├─ contexto.ts      "situación del usuario" (álbumes, MP, readiness, pedidos)
   └─ acciones/        una función por acción, con validación propia
```

- **Paquete compartido `packages/dnx-bot`:** conversación, registro, topes, escalamiento, Telegram,
  burbuja. No conoce nada de CLF. Cada plataforma le pasa su guía, su función de contexto y su lista
  de acciones.
- **Dependencia nueva:** `@anthropic-ai/sdk` (hoy no está en el monorepo). Se agrega sólo en
  `packages/dnx-bot`. Por el antecedente del lockfile compartido, el PR que la sume debe correr el
  chequeo de tipos de **todas** las apps antes de fusionar.
- **Interruptor:** variable `CLF_BOT_ENABLED` + lista de usuarios habilitados en `AppConfig` para la
  prueba piloto. Apagado = la burbuja no aparece y la ruta responde 404.

## 5. Etapa 1 — fotógrafos y organizadores logueados

### 5.1 Qué sabe

- **Guía de CLF** (`lib/bot/guia/*.md`): armada a partir de `components/FaqSection.tsx`
  (≈36 preguntas), tutoriales en video (`systemSettings` clave `tutorials_videos`), términos
  (`lib/terms/*`, `lib/legal/*`), `app/ayuda/mercadopago/seguridad` y los mensajes de error del
  sistema. Se envía con caché de prompt (la parte fija primero, lo variable al final).
- **Situación del usuario** (se calcula al abrir la conversación y se refresca tras cada acción):
  - álbumes con su estado de venta (`lib/albums/album-sales-readiness.ts`),
  - estado de Mercado Pago (`lib/mercadopago/mp-connection-health.ts`: conectado, vencido, sin conectar),
  - álbumes por vencer, subidas fallidas, pedidos recientes y sin entregar.

### 5.2 Acciones (todas con confirmación previa, registro y posibilidad de deshacer)

| Área | Acción | Fuente actual de la lógica |
|---|---|---|
| Álbumes | Cambiar nombre, fecha, lugar | PATCH `/api/dashboard/albums/[id]` (inline → extraer) |
| Álbumes | Publicar / despublicar | ídem |
| Álbumes | Extender vencimiento | `lib/album-extensions/request-album-extension.ts` |
| Álbumes | Elegir portada | PATCH `…/cover` |
| Álbumes | Crear carpeta, mover fotos a carpeta | `…/folders`, `…/photos/bulk-set-folder` |
| Precios | Precio digital, descuentos por cantidad | PATCH álbum (extraer) |
| Precios | Precios por defecto del fotógrafo | PATCH `/api/fotografo/update` (**sólo campos de precio**, nunca la ruta entera) |
| Precios | Packs: crear, editar | `…/packs` (extraer) |
| Precios | Venta por reconocimiento facial y su precio | PUT `…/sales-settings` |
| Fotos | Activar/desactivar venta digital o impresa de una foto | PATCH `…/photos/[photoId]` |
| Fotos | Reintentar subidas fallidas | POST `…/ingest-jobs/[jobId]/retry` |
| Reconocimiento facial | Activar/desactivar, días de retención de selfies | PATCH álbum |
| Pedidos | Ver estado de un pedido | lectura |
| Pedidos | **Reenviar link de descarga al cliente** (nueva) | `lib/download-tokens.ts`, `lib/resend-digital-emails.ts` |
| Pedidos | **Asignar un segundo pago a fotos** (nueva) | ver §5.5 |
| Perfil | Contacto, redes, colores, página pública | PATCH `/api/fotografo/update` (lista blanca de campos) |
| Mercado Pago | Diagnosticar y dar el botón para reconectar | `mp-connection-health.ts` (la reconexión la hace el fotógrafo) |
| Soporte | Abrir ticket | `SupportTicket` existente |

Cada acción:
1. recibe `userId` explícito (no depende de cookies),
2. verifica que el recurso sea del usuario (dueño del álbum, foto propia, organizador del evento),
3. valida valores (sin negativos, límites razonables),
4. guarda en `BotAction` el valor anterior y el nuevo,
5. devuelve un resultado que el bot cuenta tal cual.

**Trabajo previo necesario:** la lógica de edición de álbum, packs y fotos vive dentro de las rutas
(`app/api/dashboard/albums/[id]/route.ts` tiene ≈1.500 líneas). Se extrae a `lib/` en funciones chicas
que usen **tanto la ruta como el bot**, para que el bot no pueda hacer nada que la pantalla no permita.

### 5.3 Prohibido (no existe la acción; el bot explica cómo hacerlo y da el enlace)

Borrar fotos, álbumes o carpetas · desconectar Mercado Pago · tocar tokens de MP, CBU, alias o datos
de cobro · pedir retiros o pagos de referidos/comisiones · devolver pagos · cambiar email o
contraseña · aprobar pedidos de remoción · actuar sobre recursos de otro usuario.

### 5.4 Cómo se presenta

- Burbuja abajo a la derecha en el panel del fotógrafo/organizador, con la **mascota animada de DNX
  Bot** (GIF del robot que aporta Daniel; pendiente de recibir).
- Saludo según la situación: MP vencido → ofrece reconectar; álbum que no puede vender → dice qué
  falta y ofrece resolverlo; todo en orden → "¿En qué te ayudo?" + tres sugerencias.
- Puntito de aviso en la burbuja cuando hay algo que bloquea ventas. **No se abre sola.**
- Siempre visibles: "Soy un asistente automático" y "Hablar con una persona".

### 5.5 Caso testigo: segundo pago sobre un pedido ya pagado

Origen: pedido 4645 (11/10/2026), pagado dos veces; el comprador quería otras fotos. Arreglo del
link reutilizado: PR 498.

DNX Bot (etapa 1 desde el lado del fotógrafo; etapa 2 desde el lado del comprador):
1. Confirma contra Mercado Pago que el segundo pago está aprobado, es del mismo comprador, el monto
   coincide con el pack y no está asignado a ningún pedido.
2. Ofrece elegir las fotos del álbum que corresponden a ese pago.
3. Crea el pedido nuevo asociado a ese pago y entrega el link de descarga.
4. Deja aviso al fotógrafo con lo hecho.

Sin movimiento de plata. Si el comprador dice que fue un error → ticket de devolución (la hace una
persona, sólo desde Mercado Pago).

**Importes:** en CLF los campos `*Cents` de pedidos de álbum guardan **pesos enteros** (pedido 4645:
`totalCents = 5980` → $5.980). El bot muestra pesos con formato argentino.

## 6. Escalamiento, errores y avisos

### 6.1 Derivación a una persona

Se abre ticket (`SupportTicket` existente) cuando: el usuario lo pide · dos intentos sin resolver ·
el tema toca plata · error del sistema que bloquea ventas · enojo evidente.

El ticket lleva la conversación completa (en `SupportMessage` interno) y un resumen del bot: qué
pidió, qué revisó, qué encontró. Al usuario: "Abrí el pedido de soporte #N. La respuesta te aparece
en Soporte y te llega por mail" (comportamiento actual del panel de admin).

### 6.2 Telegram

- Bot de Telegram privado (Daniel lo crea con @BotFather; token en `CLF_BOT_TELEGRAM_TOKEN`, chat en
  `CLF_BOT_TELEGRAM_CHAT_ID`).
- **Urgente, al instante:** cobros, ventas bloqueadas, cliente enojado, error repetido.
- **Resumen diario 9:00 hora argentina:** conversaciones, resueltas solas vs. derivadas, acciones
  hechas, dudas más repetidas, preguntas sin respuesta en la guía, errores reportados y PRs propuestos.

### 6.3 Errores de código

1. El bot guarda un `BotIncident` con datos estructurados (ruta/acción, error, ids involucrados,
   momento) — **sin el texto libre del usuario**. Se agrupan por firma (mismo error = un incidente con
   contador).
2. Si existe una solución para el usuario sin tocar código, la aplica igual (el incidente se reporta
   aunque el caso quede resuelto).
3. **Tarea nocturna de Claude Code en la nube** (rutina programada): lee los incidentes abiertos por un
   endpoint de admin protegido con secreto, investiga en el repo y propone PRs.
4. Fusión: lo que toca cobros, permisos o borrado → espera aprobación de Daniel. El resto → se fusiona
   si el CI da verde.
5. El resumen de Telegram de la mañana incluye lo encontrado y los PRs.

## 7. Datos nuevos (esquema compartido, migración a mano + resolve)

- `BotConversation` — usuario o visitante, plataforma, página de origen, estado, modelo, tokens y costo.
- `BotMessage` — rol, contenido, tokens.
- `BotAction` — acción, parámetros, valor anterior, valor nuevo, resultado, confirmada (sí/no), deshecha.
- `BotIncident` — firma, contador, primera/última vez, datos, estado, PR asociado.
- `BotUsage` — contadores diarios por usuario y mensual global (para topes).
- Retención: conversaciones y mensajes se borran a los **90 días**; acciones e incidentes se conservan.

## 8. Gasto y topes

- Se paga a Anthropic **en dólares**. Sonnet 5.5: USD 2 por millón de tokens de entrada, USD 10 de
  salida; lecturas de caché USD 0,20. Estimación a confirmar: ≈ USD 0,08–0,15 por conversación típica.
- Topes: ~50 mensajes por usuario por día · máximo de pasos por conversación · **tope mensual global**
  (valor a definir por Daniel); al llegar, el bot ofrece abrir ticket en vez de responder con IA.
- Los contadores viven en la base (el `lib/rate-limit.ts` actual es por instancia y no sirve).
- Clave `ANTHROPIC_API_KEY` propia de CLF en Vercel (marcada como sensible).

## 9. Etapa 2 — compradores

- Burbuja en álbumes y en la pantalla de descargas.
- **Verificación por código al mail de compra** (6 dígitos, vence en 10 min, pocos intentos) antes de
  mostrar cualquier dato.
- Resuelve solo: reenviar link de descarga · estado del pedido · asignar segundo pago a fotos (§5.5)
  · cómo buscar con selfie · pedido de remoción (sistema existente).
- Deriva: devoluciones y quejas sobre el fotógrafo (el ticket también le llega al fotógrafo).

## 10. Etapa 3 — visitantes de landings (venta)

- Pregunta a qué se dedica (escolar, eventos, deportes, organizador), explica con números usando
  `packages/cuanto-cobro-core` y responde objeciones (comisiones, cobro, privacidad de fotos).
- Ofrece crear la cuenta en el momento y sigue como guía de etapa 1 hasta la primera venta.
- Si no se registra: pide mail o WhatsApp **con consentimiento** y lo guarda como interesado (sistema
  de interesados existente).
- WhatsApp como canal de entrada: más adelante (API oficial de Meta, con costo por conversación).

## 11. Pruebas

- **Banco de conversaciones** con resultado esperado (estilo `dnx-sales-assistant`), incluidos intentos
  de engaño ("borrá el álbum", "pasame los datos de otro fotógrafo", "cambiá el CBU"). Cada cambio de
  guía o de modelo se mide contra el banco.
- **Tests automáticos por acción:** dueño incorrecto rechazado, valores inválidos rechazados, sin
  confirmación no ejecuta, registro de valor anterior, deshacer.
- **Piloto:** Daniel + 2-3 fotógrafos de confianza (lista en `AppConfig`), después todos.

## 12. Replicar en otras plataformas

Cada plataforma aporta: su guía (`lib/bot/guia`), su función de contexto y su lista de acciones; el
resto (`packages/dnx-bot`) se reutiliza. Las bases no comparten usuarios, así que cada plataforma
corre su propio DNX Bot con su propia sesión y sus propios datos.

## 13. Pendientes de Daniel

- [ ] GIF de la mascota de DNX Bot.
- [ ] Crear el bot de Telegram con @BotFather y pasar el token por Vercel (no por chat).
- [ ] `ANTHROPIC_API_KEY` para CLF en Vercel.
- [ ] Definir el tope mensual de gasto en dólares.
- [ ] Elegir los 2-3 fotógrafos del piloto.
- [ ] Autorizar la rutina nocturna de Claude Code en la nube (permiso de tareas programadas).

## 14. Fuera de alcance de este diseño

WhatsApp como canal · voz · el bot en otras plataformas (se diseña cada una aparte) · devoluciones
automáticas · cualquier cambio en la lógica de cobro.
