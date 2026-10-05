# Correo a socios — etapas 1 (base) y 2 (blog)

Fecha: 05/10/2026. Pedido de Daniel: que el área de Comunicación pueda mandar correos a los socios,
que el remitente diga el nombre de la institución (SFPR) y no FOTOFFICE, y que un artículo del blog
se pueda mandar a los socios con un botón, además de un resumen semanal automático.

Las etapas siguientes (efemérides con interruptor, cumpleaños y aniversario de ingreso, campañas
libres, ciclo de vida del socio) se apoyan en esta base y van en documentos propios.

## 1. Remitente por institución (todos los correos)

- Hoy `from` sale entero de `FOTOFFICE_NOTIFICATIONS_FROM` (`"FOTOFFICE <casilla@dominio>"`).
- Nuevo: cuando el correo pertenece a una institución, el **nombre visible** pasa a ser el de la
  institución (`commercialName`, si no `Workspace.name`) y la **casilla** sigue siendo la verificada
  en Resend. Ej.: `"SFPR" <casilla@dominio>`.
- `reply_to` = `contactEmail` del branding (SFPR: sfprosario@gmail.com). Si un socio contesta, le
  escribe a la institución.
- Implementación: `sendTransactionalEmail` y `sendAndLogEmail` aceptan `workspaceId?`. Con él se
  resuelve `{ name, replyTo }` (`lib/communications/sender.ts`). Sin él, todo queda como hoy.
  Se pasa `workspaceId` en los llamadores que ya lo tienen a mano.
- Fuera de alcance: mandar desde una casilla de `sfpr.com.ar` (requiere verificar el dominio en
  Resend con registros DNS que carga el usuario). Queda anotado como paso siguiente.

## 2. Base de envíos masivos

Tablas nuevas (sólo tablas nuevas: no se altera ninguna existente, así un deploy antes del SQL no
rompe nada viejo):

- `FotofficeMailingSettings` (una por institución): `bulkEnabled` (interruptor general, **apagado**
  por defecto), `weeklyBlogDigest` (resumen semanal, apagado por defecto).
- `FotofficeEmailCampaign`: un envío a muchos. `kind` (`BLOG_POST` | `BLOG_DIGEST`), `topic`
  (`blog`), `dedupeKey` único (un artículo se manda una sola vez; un resumen por semana ISO),
  asunto, contadores, estado (`SENDING` | `SENT` | `FAILED`), quién lo lanzó.
- `FotofficeEmailDelivery`: una fila por destinatario (`PENDING` → `SENDING` → `SENT`/`FAILED`),
  única por `(campaignId, email)`. Es el registro por institución que hoy falta.
- `FotofficeEmailOptOut`: bajas por `(workspaceId, email, topic)`; `topic = "all"` es "nada".

Destinatarios: socios `ACTIVE` con email, sin repetir direcciones, menos las bajas del tema o de
"all".

Envío: API batch de Resend (`/emails/batch`, de a 50), una pausa corta entre tandas, `Idempotency-Key`
derivada de los ids de la tanda. Las filas se "toman" con una actualización condicional antes de
mandar, así el botón y la tarea programada nunca mandan la misma fila dos veces. Si una tanda no
termina (corte de la función), la tarea programada retoma lo pendiente.

Cada correo masivo lleva:
- Pie: "Recibís este correo porque sos socio de SFPR" + enlace **Darme de baja**.
- Cabeceras `List-Unsubscribe` (sólo https, apunta a `/api/correo/baja`, que da de baja con POST) y `List-Unsubscribe-Post:
  List-Unsubscribe=One-Click` (lo exigen Gmail y Yahoo).

Baja: enlace firmado (HMAC con una clave derivada de `FOTOFFICE_MAILING_SECRET`, o en su defecto
del secreto de las tareas programadas) a `/correo/baja?t=…&tema=…`. Abrir la página no da de baja
(los antivirus abren los enlaces): la persona elige con un botón. La página muestra la institución y deja elegir: "sólo las
novedades del blog" o "todos los correos de la institución". El POST de un clic da de baja del tema.
Los correos transaccionales (cuotas, alta, reservas) no se cortan con esta baja.

## 3. Blog → socios (etapa 2)

- En el editor de un artículo **publicado**: tarjeta "Enviar a socios por email" con la cantidad de
  destinatarios, botón **Enviarme una prueba** (a quien está mirando) y **Enviar a N socios** con
  confirmación. Si ya se envió: fecha y resultado, sin botón.
- Si el interruptor general está apagado, sólo se ofrece la prueba y un enlace a Comunicación →
  Correo para encenderlo.
- Correo: logo y color de la institución, foto de portada, título, bajada, botón "Leer el
  artículo", firma institucional y pie con la baja. El enlace va al dominio propio si está
  `CONNECTED`; si no, a `fotoffice.com/w/<slug>/blog/<post>`.
- Resumen semanal: los lunes desde las 9:00 (hora argentina) la tarea programada arma, por
  institución con el resumen encendido, un correo con los artículos publicados en los últimos 7
  días que no se hayan mandado solos. Si no hay ninguno, no sale nada.

## 4. Pantalla Comunicación → Correo

Nueva entrada del módulo Comunicación (nivel MANAGE):
- Remitente que ven los socios (`"SFPR" <casilla>`, responde a sfprosario@gmail.com) y de dónde se
  cambia (Configuración de la institución).
- Interruptor de envíos a socios y del resumen semanal.
- Historial de envíos con destinatarios, enviados, fallidos y bajas.

Permisos: enviar un artículo exige poder editar el blog (MANAGE de Sitio web); encender
interruptores exige MANAGE de Comunicación.

## 5. Tarea programada

`/api/cron/correo` cada 10 minutos: (1) retoma campañas `SENDING` con filas pendientes o tomadas
hace más de 15 minutos; (2) los lunes ≥ 9:00 AR crea el resumen semanal (el `dedupeKey` garantiza
uno por semana).

## 6. Pruebas

Unitarias (vitest) para: armado del remitente, token de baja (firma y manipulación), audiencia
(deduplicación y bajas), armado del correo del artículo y del resumen, troceado en tandas y
semana ISO / ventana del lunes. Build local completo antes del PR.

## 7. Puesta en producción

1. SQL de las cuatro tablas en la base de FOTOFFICE (`br-old-rain-adwthzng`) y `migrate resolve`.
2. Fusionar, verificar deploy Ready.
3. Probar en producción con "Enviarme una prueba". El primer envío real lo dispara Daniel.
