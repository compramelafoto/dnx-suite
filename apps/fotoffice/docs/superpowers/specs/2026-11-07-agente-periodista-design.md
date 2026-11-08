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
- Foto de cada nota: ~~del portfolio de Daniel~~ → desde el 08/11, **la imagen principal de la
  noticia**, con crédito al medio (ver "Ajustes 08/11").
- Propuestas **lunes, miércoles y viernes 9:00** (hora argentina); si aprueba, se publica **ese día
  11:00** (o enseguida si aprueba después de las 11).

## Cómo funciona (para Daniel)

1. Lun/mié/vie 9:00 el agente busca en la web noticias de fotografía de los últimos días
   (lanzamientos, concursos, premios, técnica, industria; con preferencia por Argentina y
   Latinoamérica), descarta las que ya usó y elige la mejor.
2. Escribe una nota **propia** (no copia ni traduce párrafos): título, bajada, 400–700 palabras,
   tono DNX (rioplatense semiformal), con la fuente enlazada al final.
3. Usa la imagen principal de la noticia (copiada a nuestro almacenamiento) con crédito al medio; si
   no hay una usable, la nota va sin foto.
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

## Ajustes 08/11 (pedido de Daniel después de la primera semana)

1. **Foto de la noticia, no del portfolio.** Se baja la página de la fuente una sola vez (la misma
   descarga del detector de copia, sólo direcciones públicas) y se toma `og:image` /
   `twitter:image`. La imagen se baja (sólo JPEG/PNG/WebP, hasta 8 MB) y se guarda en el R2 de
   FOTOFFICE como portada del blog (`uploadBlogImage`, preset `blogHero`). La nota lleva al final
   "Foto: <crédito de la foto si la página lo declara / medio> — <dominio enlazado a la fuente>". Sin
   imagen usable, va sin foto (no hay vuelta al portfolio). Telegram: `sendPhoto` con foto, si no
   texto. `datos.foto = { url, original, credito }` reemplaza a `trabajo` y `temaFoto`.
2. **No repetir temas.** Claude devuelve `tema` (el hecho, corto). Antes de cada corrida se le pasan
   los temas de los últimos 45 días (pendientes, publicados y descartados) y, con énfasis, los
   descartados de hoy, con la instrucción de elegir otro hecho y no otra fuente del mismo hecho.
   Control en código (`temas.ts`): palabras clave normalizadas (sin vacías, genéricas del rubro ni
   años) y coincidencia ≥ 60 % del tema/título más corto con al menos 2 palabras en común → se le pide
   otra elección una vez; si insiste (o repite una dirección ya usada), `FALLO` con aviso.
3. **Prioridad Argentina y Latinoamérica** en el prompt; lo internacional sólo si es muy relevante.
4. **Aprender gustos.** Por propuesta, en `datos`: `tema`, `categoria` (lista fija en `gustos.ts`),
   `resultado` (`PUBLICADA` / `DESCARTADA` / `OTRA`) y `correccionesPedidas` (los textos de Daniel).
   Con las últimas 40 se arma un resumen corto (qué categorías publica, cuáles suele descartar, qué
   pide al corregir y sus últimos pedidos) que va en el pedido a Claude y se muestra en
   /admin/agentes ("Lo que aprendí de tus gustos"). Sin migración.
5. **Costo.** `datos.uso` guarda tokens (incluido el caché), búsquedas y `costoUsd`: USD 2 por
   millón de entrada, 10 por millón de salida, 0,01 por búsqueda (constantes en `costo.ts`). Suma
   todas las respuestas: continuaciones por `pause_turn`, el pedido de corregir el JSON, la segunda
   elección por tema repetido, la reescritura por copia y las correcciones de Daniel. La página
   muestra el costo por propuesta y el total del mes (hora argentina).

