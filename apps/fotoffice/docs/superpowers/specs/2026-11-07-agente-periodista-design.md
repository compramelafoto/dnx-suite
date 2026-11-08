# Equipo de agentes — pieza 1: canal de Telegram + Periodista

Fecha: 07/11/2026 · Pedido de Daniel · Estado: diseño para aprobar

## Objetivo

Que un agente proponga **3 notas por semana** para el blog del sitio de DNX Estudio, se las mande a
Daniel por **Telegram** y, con su respuesta, publique, corrija o descarte. Es la primera pieza del
"equipo de agentes": el canal de Telegram y la cola de propuestas se reutilizan después para
Muestras, Radar de eventos, Buscador, etc.

## Decisiones de Daniel (07/11)

- Bot de Telegram **nuevo y aparte** del de presupuestos (`@Dnxestuio_ventas_bot` sigue igual).
- Blog: sitio de **DNX Estudio** (workspace `cmv5z6qxwwmmhf0q5gp8qja1j`).
- Foto de cada nota: **del portfolio de Daniel** (Trabajos publicados de DNX Estudio), nunca la de la
  noticia.
- Propuestas **lunes, miércoles y viernes 9:00** (hora argentina); si aprueba, se publica **ese día
  11:00** (o enseguida si aprueba después de las 11).

## Cómo funciona (para Daniel)

1. Lun/mié/vie 9:00 el agente busca en la web noticias de fotografía de los últimos días
   (lanzamientos, concursos, premios, técnica, industria; con preferencia por Argentina y
   Latinoamérica), descarta las que ya usó y elige la mejor.
2. Escribe una nota **propia** (no copia ni traduce párrafos): título, bajada, 400–700 palabras,
   tono DNX (rioplatense semiformal), con la fuente enlazada al final.
3. Elige una foto de tu portfolio que vaya con el tema.
4. Te llega por Telegram: título, bajada, foto, enlace a la vista previa y la fuente, con botones
   **✅ Publicar · 🔁 Otra noticia · ❌ Descartar**.
5. Para corregir, **respondés al mensaje** con lo que querés cambiar ("más corto", "nombrá a la
   SFPR"): reescribe y te manda la versión nueva.
6. Si no contestás, la nota queda en borrador; nada se publica sin tu OK.

## Diseño técnico

### Canal de Telegram de agentes (genérico, sirve para todos los agentes)

- Token del bot nuevo en Vercel: `TELEGRAM_AGENTES_BOT_TOKEN` (lo carga Daniel; nunca pasa por el
  chat ni por la base).
- Webhook propio: `POST /api/webhooks/telegram-agentes`, con `secret_token` verificado como el
  webhook de presupuestos (`lib/telegram/webhook.ts`, se reutiliza `secretoValido`, `leerUpdate`).
- Vínculo del chat: página de super admin **Agentes** en FOTOFFICE con "Conectar" (registra el webhook
  con secreto nuevo) y enlace `t.me/<bot>?start=<código>` de 30 min, igual que Configuración →
  Telegram. Chat vinculado y hash del secreto en `SystemSettings` (clave `fotoffice_agentes_telegram`),
  sin tabla nueva.
- Sólo se obedece al chat vinculado; cualquier otro recibe silencio.
- `leerUpdate` se amplía para leer **texto que responde a un mensaje** (`reply_to_message`), además
  de `/start` y botones.

### Cola de propuestas (genérica)

Tabla nueva `FotofficeAgentePropuesta` (migración a mano, como siempre en FOTOFFICE):

| campo | uso |
|---|---|
| `id` | cuid |
| `agente` | `PERIODISTA` (después `MUESTRAS`, `EVENTOS`…) |
| `estado` | `PENDIENTE` · `PUBLICADA` · `DESCARTADA` · `FALLO` |
| `workspaceId` | DNX Estudio |
| `fuenteUrl` | para no repetir noticias (índice) |
| `blogPostId` | borrador creado en el blog |
| `telegramMessageId` | para saber a qué propuesta responde Daniel |
| `correcciones` | cuántas veces se reescribió (tope 5) |
| `datos` | JSON: título de la fuente, resumen, trabajo/foto elegida |
| `creadaEn`, `resueltaEn` | |

### El Periodista

- Cron `/api/cron/agente-periodista`, `0 12 * * 1,3,5` (12:00 UTC = 9:00 AR). Mismo secreto que los
  demás crons. Si ya hay una propuesta del día, no hace nada (idempotente).
- Claude **Sonnet 5.5** con la herramienta de **búsqueda web** de la API (máx. 5 búsquedas). Salida
  estructurada: `{ fuenteUrl, fuenteTitulo, titulo, bajada, cuerpo (párrafos y subtítulos H2),
  temaFoto }`. Se rechaza si la URL ya está en la cola o si el cuerpo trae frases largas idénticas a
  la fuente.
- Foto: Claude elige entre la lista de Trabajos publicados de DNX Estudio (título + categoría) el que
  mejor acompaña `temaFoto`; se usa su foto de portada como `heroImageUrl`/`ogImageUrl`.
- Se crea el `BlogPost` en **DRAFT** con `createBlogPost` (categoría "Noticias", que se crea si no
  existe) y se manda el mensaje de Telegram.
- **Publicar** = `status PUBLISHED` + `publishedAt` hoy 11:00 AR (o ahora si ya pasó): usa la
  programación que el blog ya tiene. **Otra noticia** = descarta y corre de nuevo (excluyendo esa
  fuente). **Corrección** = reescribe con la nota actual + el pedido, actualiza el borrador y edita
  el mensaje.
- Costo estimado: < USD 0,20 por nota con búsquedas → ~USD 3 por mes.

### Seguridad y límites

- Nada se publica sin el botón de Daniel. Tope diario de corridas (3) y de correcciones (5 por nota).
- La página de super admin sólo para `globalRole` super admin.
- Errores: la propuesta queda `FALLO` y llega un aviso corto por Telegram.

## Fuera de esta pieza

Blog de CLF (noticias de eventos con fotos más vendidas y autor), Muestras, Radar InfoSpot, Buscador
de fotógrafos, recomendación en WhatsApp. Usan el mismo canal y la misma cola.

## Pruebas

Tests de las partes puras (lectura de updates con respuesta, armado del mensaje, horario de
publicación, detección de copia, deduplicación). Prueba real: Daniel vincula el chat, se dispara el
cron a mano una vez y se recorre Publicar / Corregir / Otra / Descartar.
