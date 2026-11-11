# Transmisión en vivo — diseño

**Fecha:** 10/11/2026 · **Módulo:** `live` («Transmisión en vivo») · **Primer caso:** SOYBELUZ (`ws_soybeluz`)
**Estado:** construido en el PR `feat/fotoffice-transmision-en-vivo`; falta activar Cloudflare Stream y aplicar el SQL.

---

## 1. La recomendación, en corto

**Usar Cloudflare Stream, con OBS como única forma de salir en vivo en esta etapa.**

- Belén transmite desde OBS a **una sola dirección** (la de FOTOFFICE). Cloudflare **graba todo** y, si el vivo es
  público, **lo reenvía a YouTube, Instagram y TikTok a la vez**. Ella no necesita Restream ni otro servicio.
- La clase del **lunes** (pública) sale a las redes y se puede mirar en el sitio de SOYBELUZ.
- La clase del **jueves** (Club) **no sale a ninguna red**: se mira sólo en el portal, con sesión de persona socia activa,
  y con un permiso de reproducción que vence (un enlace copiado no sirve al otro día).
- Las dos quedan **grabadas en la plataforma** y se pueden publicar como **clase de un curso grabado** con un clic.
- Ya usamos Cloudflare (R2 y los videos de cursos grabados): **no hay cuenta nueva ni claves nuevas** para lo básico.
- Costo esperado para SOYBELUZ: **alrededor de 25 a 60 dólares por mes** (ver §7). No hay costo por transmitir ni por grabar:
  se paga por minuto guardado y por minuto mirado (incluido lo que se retransmite a las redes).

Lo que queda **para después**: salir en vivo desde el navegador (sin OBS), YouTube conectado por OAuth, el chat de todas las redes junto,
y la lista de grabaciones públicas en el sitio.

---

## 2. Cómo funciona (arquitectura)

```
            OBS (vertical 9:16)
                  │  RTMPS (o SRT)
                  ▼
   ┌──────────────────────────────────┐        webhooks          ┌──────────────────────┐
   │  Cloudflare Stream — live input   │ ───────────────────────▶ │ FOTOFFICE             │
   │  (uno por workspace)              │                          │ /api/webhooks/        │
   │  • graba siempre (automatic)      │ ◀── API (crear/borrar ── │   cloudflare-stream   │
   │  • exige URL firmada              │      destinos, estado)   │ panel /en-vivo        │
   │  • outputs = destinos             │                          │ portal /portal/en-vivo│
   └───────┬───────────┬──────────┬───┘                          │ sitio /w/<slug>/en-vivo│
           │RTMP       │RTMPS     │RTMP                          └──────────────────────┘
           ▼           ▼          ▼
        YouTube    Instagram    TikTok
```

**Piezas de Cloudflare que usamos** (verificadas en developers.cloudflare.com/stream el 10/11/2026):

| Pieza | Para qué | Endpoint |
|---|---|---|
| Live input | El «canal» del workspace. Recibe OBS por RTMPS (`rtmps://live.cloudflare.com:443/live/` + clave) o SRT. | `POST /accounts/{id}/stream/live_inputs` |
| `recording.mode = "automatic"` | Graba cada vivo y lo deja como video a demanda cuando OBS para. | (en el cuerpo del live input) |
| `recording.requireSignedURLs = true` | Nadie mira sin un permiso firmado por nosotros (el vivo y sus grabaciones). | (ídem) |
| Rotate keys | «Regenerar clave» de OBS. | `POST …/live_inputs/{uid}/rotate_keys` |
| Outputs | Retransmisión a cada red. Hasta 50 por live input; se pueden sumar y sacar durante el vivo. | `POST/DELETE …/live_inputs/{uid}/outputs[/{out}]` |
| Videos del live input | Las grabaciones de un canal (las usamos para no depender de los webhooks). | `GET …/live_inputs/{uid}/videos` |
| Webhook de Stream | «La grabación está lista», firmado con HMAC (`Webhook-Signature`). Trae `liveInput`. | `PUT /accounts/{id}/stream/webhook` |
| Notificaciones de live input | «OBS se conectó / se desconectó / tiene un error», con secreto en `cf-webhook-auth`. | Panel de Cloudflare → Notifications |
| Firma de reproducción | JWT RS256 con la clave de firma de Stream (la misma de cursos grabados). | local, sin llamar a la API |

**Robustez sin webhooks.** El panel se refresca solo cada 10 segundos mientras hay un vivo abierto y en cada refresco le pregunta
a Cloudflare si hay señal; Grabaciones trae de Cloudflare las grabaciones que falten. Los webhooks hacen que todo sea inmediato
y que el portal se entere aunque el panel esté cerrado, pero si fallan nada se pierde. El reproductor de Stream sabe esperar:
si OBS todavía no arrancó, muestra que la transmisión empieza pronto.

**Un vivo sin «Nuevo vivo».** Si Belén abre OBS y transmite sin crear el vivo en el panel, Cloudflare graba igual. Cuando llega
la grabación, FOTOFFICE crea un vivo terminado, **privado** (sólo socias), titulado «Vivo del dd/mm, hh:mm», para que no se pierda.

### Por qué WebRTC/WHIP («salir en vivo desde el navegador») queda afuera

La documentación de Cloudflare (Stream → WebRTC, beta) dice que la entrada WebRTC/WHIP **no graba** y **no retransmite**
(«Recording and live HLS playback are not yet supported», «Simulcasting … is not supported»). Las dos cosas son el corazón de este
módulo, así que en esta etapa se transmite sólo con OBS. Ver §8.

---

## 3. Modelo de datos

Migración `packages/db/prisma/migrations/20270203110000_fotoffice_transmision_en_vivo` (aditiva e idempotente).
**No toca ninguna tabla existente**: ni `Member`, ni `Course`, ni `CourseLesson`.

| Tabla | Qué guarda |
|---|---|
| `FotofficeLiveChannel` | Uno por workspace: `liveInputUid`, dirección RTMPS/SRT, y las claves de YouTube y TikTok **cifradas** (AES-256-GCM con el baúl de integraciones, `DNX_INTEGRATIONS_VAULT_MASTER_KEY`) más su terminación (últimos 4). **La clave de OBS no se guarda**: se le pide a Cloudflare cuando el dueño aprieta «Copiar». |
| `FotofficeLiveSession` | Cada vivo: título, visibilidad `PUBLICA \| SOCIOS`, estado, fechas, destinos usados (`[{ destino, outputUid, terminacion, estado }]`, **nunca la clave**) y el último error de señal. |
| `FotofficeLiveRecording` | Cada grabación (un video de Stream): `videoUid`, estado, duración, miniatura, y — si se publicó — `publishedCourseId` / `publishedLessonId`. |

**Estados de un vivo** (`lib/en-vivo/estados.ts`, función pura e idempotente):

```
ESPERANDO_SENAL ──señal──▶ EN_VIVO ──corte──▶ SENAL_CORTADA ──señal──▶ EN_VIVO
       │                      │                    │
   «Terminar»             «Terminar»       «Terminar» o grabación lista
       ▼                      ▼                    ▼
   CANCELADA              TERMINADA            TERMINADA
```

Lo terminado no revive aunque llegue un aviso viejo. Al pasar a TERMINADA o CANCELADA se borran los outputs de Cloudflare (la clave de
Instagram se va con ellos: nunca se guardó en FOTOFFICE).

**Vínculo con los cursos.** «Publicar como clase» crea una `CourseLesson` al final de un curso **grabado** (`deliveryMode = RECORDED`)
con `videoProvider = "cloudflare_stream"`, `videoUid` = el de la grabación, `videoStatus = READY`. Es exactamente lo que ya usa el aula:
el mismo reproductor, la misma marca de agua, el mismo permiso firmado, el mismo avance y certificado. El video no se copia. El vínculo
queda guardado en la grabación (`publishedLessonId`), sin relación de Prisma, para no tocar el modelo compartido de cursos.

---

## 4. Pantallas

| Pantalla | Ruta | Quién |
|---|---|---|
| **Vivo** — estado del vivo abierto (esperando señal / en vivo / se cortó), destinos conectados, reproductor, «Terminar vivo». Si no hay vivo: formulario **Nuevo vivo** (título, visibilidad, redes, claves de Instagram y TikTok, nota de TikTok LIVE Studio). | `/en-vivo` | Dueño o admin, módulo encendido |
| **Grabaciones** — lista con duración, «Ver grabación» y **Publicar como clase** en un curso grabado. | `/en-vivo/grabaciones` | Ídem |
| **Configurar** — crear el canal; servidor con «Copiar»; clave de OBS enmascarada con «Copiar clave» y «Regenerar clave»; ayuda de OBS en vertical; clave persistente de YouTube; clave de TikTok recordada. | `/en-vivo/configurar` | Ídem |
| **Portal → En vivo** — la clase que se transmite ahora y las grabaciones. | `/portal/en-vivo` | Persona socia ACTIVA (mismo criterio de todo el portal) |
| **Sitio público → En vivo** — el vivo **público** de ahora, sin sesión. Página opcional: el dueño la suma al menú del sitio. | `/w/<slug>/en-vivo` | Cualquiera |

**Reglas de visibilidad** (`lib/en-vivo/visibilidad.ts`): PUBLICA lo mira cualquiera; SOCIOS sólo una persona socia activa del mismo
workspace (o el equipo del panel). Un vivo SOCIOS **no se puede retransmitir a redes**: el formulario lo impide y la acción lo rechaza.

**Ayuda de OBS (vertical 9:16).** Servicio «Personalizado»; resolución base y de salida **720x1280** a 30 FPS (1080x1920 con buena
subida); H.264 CBR **3500 kbps** (hasta 6000 kbps en 1080x1920); **fotograma clave cada 2 s** (Cloudflare rechaza GOP largos con
`ERR_GOP_OUT_OF_RANGE`); audio AAC 128 kbps 48 kHz.

---

## 5. Claves y seguridad

- **Credenciales de la plataforma**, sólo por variables de entorno. Se **reusan** las de cursos grabados (`lib/courses-video/config.ts`):
  `STREAM_ACCOUNT_ID`, `STREAM_API_TOKEN`, `STREAM_SIGNING_KEY_ID`, `STREAM_SIGNING_KEY_PEM`. Se suma **una**: `STREAM_WEBHOOK_SECRET`.
  Si falta alguna de las cuatro primeras, el módulo no se rompe: dice «La transmisión en vivo todavía no está habilitada en la
  plataforma», como Cobros con Mercado Pago.
- **Clave de OBS**: no se guarda; se copia a pedido directo al portapapeles. «Regenerar clave» la invalida en el momento.
- **YouTube**: clave persistente, guardada una vez, cifrada; en pantalla sólo `••••••••qrst`. Se descifra sólo en el servidor al crear el output.
- **Instagram**: se pega antes de cada vivo, se manda a Cloudflare y se descarta; al terminar se borra el output.
- **TikTok**: como Instagram, con opción «Recordar esta clave» (cifrada).
- **Webhook**: sin `STREAM_WEBHOOK_SECRET` la ruta responde 404. Firma HMAC con tolerancia de 5 minutos y comparación en tiempo
  constante; secreto de Notificaciones comparado en tiempo constante. Idempotente.
- **Reproducción**: siempre con permiso firmado (6 h para un vivo, 2 h para una grabación). Sin `allowedOrigins` en el live input, porque
  el sitio público puede estar en un dominio propio; lo que protege es la firma que vence.

---

## 6. Límites de cada red (verificados el 10/11/2026)

| Red | Clave | Requisitos | Formato | Fuente |
|---|---|---|---|---|
| **YouTube** | Persistente (YouTube Studio → Emitir en directo). Se guarda una vez. | Canal verificado; la primera habilitación de vivos puede tardar **hasta 24 h**. | Admite vertical; RTMP(S). | support.google.com/youtube/answer/2474026 |
| **Instagram** | **Cambia en cada vivo** (Live Producer, desde la compu: instagram.com → Crear → En vivo). Vence al cerrar la ventana o terminar. | Cuenta **profesional** (creador o empresa). Servidor **RTMPS**. | Vertical 9:16 recomendado; guías de terceros hablan de ~1 h por vivo. | about.instagram.com/blog/tips-and-tricks/instagram-live-producer (y guías de terceros) |
| **TikTok** | Sólo para algunas cuentas (LIVE Center). Puede ser por vivo. | **18+** y, en la práctica, **~1000 seguidores**; no disponible en todas las regiones. Alternativa: **TikTok LIVE Studio** en Windows. | Vertical. | Guías de terceros (TikTok no publica el requisito); ver §9 |

> Ojo: Cloudflare documenta outputs a destinos «RTMP o SRT» y nombra a Facebook entre los destinos, pero **no dice explícitamente**
> que acepte destinos **RTMPS** como el de Instagram. Es el primer punto a probar en el ensayo (§9).

---

## 7. Costos de Cloudflare Stream (verificados en developers.cloudflare.com/stream/pricing el 10/11/2026)

- **Transmitir (entrada) y codificar: gratis.**
- **Guardado:** 5 USD por cada 1.000 minutos de capacidad, por mes (prepago).
- **Entregado:** 1 USD por cada 1.000 minutos mirados. **La retransmisión a redes cuenta como minutos entregados** (cada red, cada minuto).
- No se publica un mínimo ni un nivel gratis para Stream.

**Cuenta para SOYBELUZ** (8 clases de 1 h por mes = 480 min):

| Concepto | Cálculo | USD/mes |
|---|---|---|
| Guardado (se acumula: 480 min nuevos por mes) | 1.000 min el primer mes → 5 USD; al año ~6.000 min → 30 USD | 5 → 30 |
| Retransmisión lunes (4 × 60 min × 3 redes) | 720 min | ~0,7 |
| Miradas en la plataforma (ej.: 40 personas × 8 clases × 60 min) | 19.200 min | ~19 |
| **Total aproximado** | | **~25 al principio, ~50–60 al año** |

Se controla con `deleteRecordingAfterDays` (no lo activamos: las clases son el contenido del Club) o borrando grabaciones viejas.
El costo ya lo paga la cuenta de Cloudflare de DNX: por eso el módulo es `platformFee` (lo enciende FOTOFFICE a pedido) y en el
futuro se puede cobrar con `WorkspaceModuleFee` o un plan.

---

## 8. Etapas futuras

1. **Salir en vivo desde el navegador** (sin OBS, desde la compu o el celular). Cloudflare WebRTC no graba ni retransmite, así que hace
   falta otro servicio: **LiveKit** (sala WebRTC + «egress» RTMP a Cloudflare, que graba y retransmite) o **Mux** (entrada WebRTC con
   grabación y simulcast). Se elige cuando haya demanda real.
2. **YouTube por OAuth**: crear el evento, el título y la miniatura desde FOTOFFICE, y leer el chat. Requiere verificar la app de Google
   con el alcance de YouTube (`youtube.force-ssl`).
3. **Chat unificado**: los comentarios de YouTube, Instagram y TikTok en una sola pantalla (APIs distintas, con permisos de cada red).
4. **Grabaciones públicas en el sitio**: hoy el sitio muestra sólo el vivo público en curso.
5. **Avisos**: correo / campanita a las personas socias cuando empieza la clase del Club.
6. **Cobro**: tarifa del módulo (`WorkspaceModuleFee`) o plan con minutos incluidos.

---

## 9. Riesgos

| Riesgo | Qué hacemos |
|---|---|
| Cloudflare no acepta el **RTMPS de Instagram** como output. | Probarlo en el ensayo. Si falla: Instagram con su propio OBS/Live Producer en paralelo, o un relay. |
| **TikTok** no le da clave a la cuenta. | Nota en pantalla: TikTok LIVE Studio en Windows, en paralelo con OBS. |
| La clave de Instagram **vence** si Belén cierra Live Producer antes de empezar. | Pegarla justo antes; si falla, «Terminar» y crear el vivo de nuevo (sólo cambia la clave). |
| Internet de subida flojo → cortes. | 720x1280 a 3500 kbps; un corte breve sigue el mismo vivo. |
| **Costo** crece con las miradas y las grabaciones acumuladas. | Módulo encendido sólo a pedido; revisar el consumo en Cloudflare cada mes. |
| La firma de reproducción de un **live input** (sub = uid del input) | Así lo documenta Cloudflare para inputs con `requireSignedURLs`; verificarlo en el ensayo. |
| Webhooks mal configurados. | El panel y Grabaciones consultan a Cloudflare igual; el portal muestra el reproductor, que espera solo. |

**Ensayo recomendado antes del primer lunes:** vivo «Sólo socias» de 2 minutos; después uno público con YouTube; después Instagram;
revisar que la grabación aparezca y publicarla en un curso de prueba.

---

## 10. Fuentes

- Cloudflare Stream — live inputs: https://developers.cloudflare.com/stream/stream-live/start-stream-live/
- Cloudflare Stream — API de live inputs: https://developers.cloudflare.com/api/resources/stream/subresources/live_inputs/methods/create/
- Cloudflare Stream — simulcasting (outputs): https://developers.cloudflare.com/stream/stream-live/simulcasting/
- Cloudflare Stream — mirar un vivo y grabaciones: https://developers.cloudflare.com/stream/stream-live/watch-live-stream/
- Cloudflare Stream — webhooks de video: https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/
- Cloudflare Stream — webhooks de vivo: https://developers.cloudflare.com/stream/stream-live/webhooks/
- Cloudflare Notifications — `cf-webhook-auth`: https://developers.cloudflare.com/notifications/get-started/configure-webhooks/
- Cloudflare Stream — WebRTC (beta, límites): https://developers.cloudflare.com/stream/webrtc-beta/
- Cloudflare Stream — precios: https://developers.cloudflare.com/stream/pricing/
- YouTube — empezar a transmitir: https://support.google.com/youtube/answer/2474026
- Instagram Live Producer: https://about.instagram.com/blog/tips-and-tricks/instagram-live-producer/
- TikTok — requisitos de clave (terceros, sin fuente oficial): https://blog.tikfinity.com/?p=3719
