# Centro de Transmisión de Clickatón

**Fecha:** 21 de septiembre de 2026
**Edición objetivo:** 2ª edición — sábado 12 de diciembre de 2026
**Estado:** diseño aprobado para escribir el plan de implementación

---

## 1. Qué problema resuelve

La 2ª edición se transmite en vivo. El equipo de streaming se comprometió a contar todo lo que pasa en la maratón en tiempo real: entrevistar participantes, mostrar cómo avanza el día, dar números. Hoy no tiene ninguna herramienta: no sabe quién está cerca, quién subió fotos, a quién conviene entrevistar ni cómo contactarlo. Depende de que alguien de la organización le pase datos a mano.

Este documento diseña el **Centro de Transmisión**: un conjunto de pantallas y gráficas que le dan al operador de streaming la información de la maratón en vivo, y que de paso le devuelven al participante un resumen de su propia jornada.

No es una herramienta sino ocho piezas que se sueltan de a una. Cada etapa es útil aunque la siguiente no llegue.

### Qué queda afuera a propósito

- No se construye una aplicación nativa para el teléfono. Todo vive en el navegador.
- No se escribe un plugin de OBS en C++.
- No se hace seguimiento continuo y obligatorio de todos los participantes. Es técnicamente frágil en un navegador y jurídicamente pesado.
- No se transmite video ni audio desde el sistema. La transmisión la hace el equipo de streaming con sus propias herramientas.

---

## 2. Decisiones ya tomadas

| Decisión | Valor |
|---|---|
| Alcance | Las ocho etapas, con el evento del 12/12 como fecha del grueso |
| Integración con OBS | Fuentes de navegador + dock acoplado, **sin plugin** |
| Origen de la ubicación | Escalera de tres niveles (ver §4), con incentivo, nunca obligatorio |
| Incentivo para el GPS | El resumen personal al cierre ("Tu Clickatón") |
| Respaldo sin GPS | La ciudad declarada en la inscripción, mostrada como zona, nunca como punto |
| Nombre de las capas de OBS | **"gráficas al aire"** — en Clickatón "placa" ya significa el carnet del participante |
| Ventana de subida | **Abierta durante toda la jornada.** Sin esto el mapa y los termómetros no tendrían nada que mostrar en vivo |
| Acceso del equipo de streaming | **Nominal, por email.** La organización invita a cada persona por su dirección; no hay clave compartida |
| Fotos del concurso al aire | **No salen al aire durante el evento**, porque se evalúan en anonimato. Al aire sólo va la **foto de perfil** que el participante subió al inscribirse |
| Kilómetros | Se miden **en todas las ediciones** como información. Si se premian o se mencionan se decide después, edición por edición |

---

## 3. Cómo se integra con OBS

OBS compone el video como una pila de capas. Una de las clases de capa que trae de fábrica es la **fuente de navegador**: se le pega una dirección web y OBS dibuja esa página como una capa más, respetando la transparencia del fondo.

El sistema le entrega al operador tres cosas:

### 3.1 Las gráficas al aire — fuentes de navegador

Una dirección por gráfica, con un token firmado en la propia dirección (OBS no sabe iniciar sesión):

```
https://clickaton.ar/aire/termometro?t=<token>
https://clickaton.ar/aire/mapa?t=<token>
https://clickaton.ar/aire/zocalo?t=<token>
https://clickaton.ar/aire/entrevistado?t=<token>
https://clickaton.ar/aire/regresiva?t=<token>
https://clickaton.ar/aire/ranking?t=<token>
https://clickaton.ar/aire/llegada?t=<token>
https://clickaton.ar/aire/sponsors?t=<token>
```

Requisitos de cada gráfica:

- `body { background: transparent }` — sin esto OBS dibuja un rectángulo negro.
- Diseñadas a 1920×1080 exactos, con la información pegada al borde que corresponde y el resto vacío. Así el operador no tiene que escalar ni recortar nada.
- Sin sonido, sin cursor, sin barras.
- **Tipografía grande**: la mayoría del público mira el stream desde el teléfono.
- Se actualizan solas (ver §7). El operador nunca tiene que refrescar.
- **Se dibujan vacías cuando no hay nada que mostrar.** Esto es clave: la gráfica del entrevistado vive siempre en la escena, invisible, y aparece sola cuando el panel la activa. Así el operador controla el aire desde nuestra pantalla sin tocar OBS.

### 3.2 El panel del operador — dock de navegador acoplado

OBS permite agregar una página web como panel acoplado dentro de su propia ventana (*Ver → Docks → Dock de navegador personalizado*). El operador tiene el mapa, el radar de historias y los contactos al lado de las escenas, sin cambiar de ventana ni de monitor.

El mismo panel funciona en un navegador común, para el productor que no está sentado en OBS.

### 3.3 El kit de escenas — un archivo que se importa

Se entrega un archivo de colección de escenas de OBS ya armado, con todas las gráficas en su posición y su tamaño, y con nombres claros ("Clickatón — Termómetro", "Clickatón — Entrevistado"). El operador lo importa de un clic. No se le dan instrucciones: se le da el kit.

### 3.4 Control remoto de OBS — explícitamente fuera de alcance

OBS trae un canal de control remoto (obs-websocket) que permitiría que el panel cambie escenas y prenda fuentes. Se descarta para esta edición: obliga a configurar la máquina del operador, a compartir contraseñas y a que el panel alcance esa máquina por red. El mecanismo de "gráfica siempre presente que se dibuja vacía" (§3.1) logra el 90% del mismo resultado sin ninguna de esas dependencias.

---

## 4. La ubicación: escalera de tres niveles

Hay dos permisos distintos y conviene no confundirlos:

- **Geoetiquetado de la cámara**: que el teléfono guarde la posición dentro de cada foto. Es el que da el recorrido real aunque nuestra web esté cerrada. Nadie lo tiene activado por defecto.
- **Permiso del navegador**: que nuestra web pueda leer la posición. Sólo funciona mientras la pantalla está abierta y el teléfono desbloqueado.

La escalera, de mejor a peor:

| Nivel | Origen | Qué da | Requiere |
|---|---|---|---|
| 1 | GPS dentro de la foto (EXIF) | Recorrido real con horas exactas | Geoetiquetado activado + que suban durante el día |
| 2 | Fichada voluntaria desde la web | Última posición conocida | Permiso del navegador + que toquen algo en la web |
| 3 | Ciudad de la inscripción | Zona aproximada | Nada |

**Regla dura:** el nivel 3 nunca se dibuja como un punto sobre el mapa. Se muestra como zona sombreada o como un contador ("14 participantes sin ubicación"). Inventar un punto es mentir en pantalla.

### 4.1 Cómo se toman las fichadas

El permiso del navegador se pide **una sola vez**, en la pantalla "Preparate" (etapa 1), con el argumento del resumen personal. Una vez concedido, el navegador lo recuerda para ese sitio en ese teléfono.

Después, durante el evento, la posición se toma **pegada a actos que el participante ya hace**, sin pedirle nada:

- cuando abre la pantalla de consignas,
- cuando sube una foto,
- cuando mira su propio progreso,
- y con un botón explícito "estoy acá" para el que quiera marcar un punto a propósito.

No hay envío continuo en segundo plano. No funciona de forma confiable en un navegador de teléfono y prometerlo sería mentir.

### 4.2 Cómo se calculan los kilómetros

Suma de distancias en línea recta (fórmula de Haversine) entre puntos consecutivos del mismo participante, ordenados por hora, con estos filtros:

- se descartan los puntos con precisión declarada peor que 100 metros;
- se descartan los saltos que implican más de 120 km/h (son errores de GPS, no viajes);
- se cuenta sólo desde la hora de inicio de la ventana de captura (no el viaje desde la casa);
- los tramos de más de 2 km entre dos puntos se marcan como "tramo estimado" y no se dibujan como caminata.

**Se muestra siempre como "recorrido entre capturas", nunca como "kilómetros caminados".** Con seis fotos se miden seis líneas rectas, no las vueltas que dio la persona. Es un piso, no la verdad, y el nombre tiene que decirlo o al aire se genera una discusión.

---

## 5. Consentimientos — la pieza urgente

La edición **ya está vendiendo**. Cada inscripción que entra desde hoy firma un consentimiento que no menciona la ubicación. Si esto se agrega en noviembre quedan dos poblaciones: los que aceptaron y los que hay que perseguir por mail uno por uno. Los que no contesten quedan afuera del mapa y del resumen para siempre.

Por eso la etapa 0 va primero y va sola.

### 5.1 Tres casillas separadas

Aceptar compartir la ubicación para el resumen propio **no es** aceptar salir en un mapa por televisión. Van separadas, ninguna marcada por defecto, ninguna obligatoria para inscribirse:

1. **Ubicación para mi resumen** — "Quiero que la Clickatón use la ubicación de mis fotos para armarme mi recorrido y mis estadísticas personales."
2. **Aparecer en el mapa público** — "Acepto que mi nombre y mi posición aparezcan en el mapa del evento y en la transmisión en vivo."
3. **Que me contacten para una entrevista** — "Acepto que el equipo de transmisión me contacte por teléfono o WhatsApp durante el evento."

### 5.2 Reglas

- **Menores: la casilla 2 no se ofrece.** Un menor de edad no aparece nunca en el mapa público ni al aire con su ubicación, aunque el adulto responsable lo autorice. Las casillas 1 y 3 requieren el consentimiento del adulto responsable.
- **Revocable en cualquier momento**, desde la pantalla del participante, con un botón que además borra sus puntos si lo pide.
- Se guarda **versión y fecha** de cada consentimiento, igual que los consentimientos que ya existen.
- Las **bases del concurso** se actualizan con una cláusula de geolocalización y suben de versión.

---

## 6. Modelo de datos

Todo lo nuevo es aditivo. Nada existente cambia de significado.

### 6.1 Campos nuevos en `ClickatonRegistration`

```
locationConsentAt          DateTime?
locationPublicConsentAt    DateTime?
interviewConsentAt         DateTime?
locationConsentVersion     String?
```

### 6.2 Modelos nuevos

**`ClickatonParticipantLocationPing`** — un punto de ubicación.

```
id, editionId, registrationId, capturedAt, latitude, longitude,
accuracyMeters?, source (PHOTO_EXIF | WEB_ACTION | WEB_MANUAL | ACCREDITATION),
photoSubmissionId?, discarded (Boolean), discardReason?, createdAt
índices: (editionId, capturedAt), (registrationId, capturedAt)
```

Los puntos descartados por los filtros de §4.2 se guardan marcados, no se borran: si un cálculo sale raro hay que poder auditarlo.

**`ClickatonParticipantJourney`** — el resumen calculado por participante, para que el panel no recalcule en cada consulta.

```
registrationId @unique, editionId, pointCount, distanceMeters,
firstPointAt?, lastPointAt?, distinctZones, lastLatitude?, lastLongitude?,
computedAt
```

**`ClickatonEditionBroadcastConfig`** — el interruptor del módulo, **apagado por defecto**. `contestPhotosOnAir` sólo puede encenderse con una fecha posterior al cierre de la evaluación (§9.1).

```
editionId @unique, enabled (default false), goalPhotos?, showNamesOnAir (default false),
contestPhotosOnAir (default false), contestPhotosOnAirFrom?,
mapRefreshSeconds (default 10), createdAt, updatedAt
```

**`ClickatonBroadcastMember`** — cada persona del equipo de transmisión, invitada por su email.

```
id, editionId, email, emailNormalized, displayName?, role (PRODUCER | OPERATOR | HOST),
invitedByUserId, invitedAt, acceptedAt?, confidentialityAcceptedAt?,
expiresAt, revokedAt?, lastSeenAt?, createdAt, updatedAt
@@unique([editionId, emailNormalized])
```

Entra con un **enlace mágico al email**, sin contraseña. Todo lo que hace queda atado a su nombre, no a un acceso anónimo compartido.

**`ClickatonBroadcastOverlayToken`** — el token que se pega en la dirección de cada gráfica de OBS.

```
id, editionId, label, tokenHash, expiresAt, revokedAt?, createdByUserId,
lastUsedAt?, createdAt
```

Es **de sólo lectura y sin datos personales**: sirve para que la gráfica lea el estado público del evento. Aunque se filtre, no expone ningún contacto. Va separado del acceso nominal porque OBS no sabe iniciar sesión.

**`ClickatonBroadcastAudit`** — quién vio qué.

```
id, editionId, memberId?, overlayTokenId?,
action (VIEW_CONTACT | REVEAL_PHONE | SEND_WHATSAPP | SEND_EMAIL | AIR_CUE | ...),
registrationId?, requestIp?, createdAt
```

**`ClickatonAirCue`** — qué hay que mostrar al aire ahora mismo.

```
id, editionId, kind (PARTICIPANT_CARD | PHOTO_FINISH | RANKING | CUSTOM_TEXT),
payload (Json), activeFrom, activeUntil?, createdByMemberId, createdAt
```

**`ClickatonBroadcastMoment`** — las noticias detectadas solas.

```
id, editionId, kind (FIRST_SUBMISSION_PROMPT | FIRST_TO_FINISH | LONGEST_DISTANCE |
FARTHEST_ORIGIN | SILENT_PARTICIPANT | ZONE_EMPTY), registrationId?, payload (Json),
detectedAt, acknowledgedAt?, dismissedAt?
```

**`ClickatonInterviewSlot`** — la cola de entrevistas.

```
id, editionId, registrationId, status (SUGGESTED | SCHEDULED | ON_AIR | DONE | DISCARDED),
scheduledAt?, notes?, updatedByMemberId?, createdAt, updatedAt
```

**`ClickatonReadinessCheck`** — la prueba técnica previa.

```
id, editionId, registrationId, checkedAt, hasGps (Boolean), clockDeltaMinutes?,
imageWidth?, imageHeight?, result (READY | NO_GPS | CLOCK_OFF | TOO_SMALL | FAILED),
detail (Json)
```

**`ClickatonHelpRequest`** — el botón de ayuda.

```
id, editionId, registrationId, createdAt, latitude?, longitude?,
status (OPEN | ACKNOWLEDGED | RESOLVED), acknowledgedByUserId?, resolvedAt?, notes?
```

**`ClickatonParticipantRecap`** — el resumen final.

```
registrationId @unique, editionId, stats (Json), imageAssetId?, publicSlug?,
generatedAt, viewedAt?, sharedAt?
```

**`ClickatonAchievement` + `ClickatonParticipantAchievement`** — las insignias.

```
Achievement: id, editionId?, code, name, description, iconKey, rule (Json)
ParticipantAchievement: id, registrationId, achievementId, awardedAt, value?
```

**`ClickatonSpectatorFollow`** — "adoptá un participante" (etapa 5).

```
id, editionId, registrationId, spectatorKey (cookie anónima), createdAt, removedAt?
```

### 6.3 Advertencia de migraciones

El esquema está compartido entre **cinco bases Neon**. Cada campo nuevo hay que aplicarlo a mano en las cinco y registrarlo en `_prisma_migrations` con el checksum de una base sana, o el historial queda desincronizado. Esto se suma al tiempo de cada etapa que toca la base.

---

## 7. Cómo llegan los datos en vivo

**Decisión: consulta corta y repetida, no conexión permanente.**

Todas las gráficas al aire y el panel consultan un mismo endpoint de estado, que devuelve un único documento con todo lo que hace falta:

```
GET /api/aire/estado?t=<token>
Cache-Control: s-maxage=3, stale-while-revalidate=10
```

- Las gráficas consultan cada 5 segundos. Un termómetro que sube con 5 segundos de retraso es invisible en pantalla.
- El disparador de aire (la ficha del entrevistado) consulta cada 2 segundos.
- El panel del operador consulta cada 10 segundos, y de inmediato después de cada acción.

Como todos consumen el **mismo** documento y la CDN lo cachea 3 segundos, doce pantallas abiertas generan prácticamente el tráfico de una.

Se descarta la conexión permanente (SSE/WebSocket): en Vercel las funciones tienen tope de duración, la conexión se corta sola cada pocos minutos, cuesta más y no aporta nada que 5 segundos de retraso no resuelvan.

### 7.1 El mapa

- Biblioteca: **MapLibre**.
- Fondo del mapa: archivo **Protomaps (.pmtiles)** de la región, alojado en **R2**. Costo por uso: cero. Estilo propio, oscuro, a tono con la transmisión.
- Se descarta usar los mosaicos públicos de OpenStreetMap: la segunda pantalla pública podría superar su política de uso.

---

## 8. Las etapas

### Etapa 0 — Consentimientos y bases · **esta semana**

Las tres casillas de §5.1 en el formulario público de inscripción, con sus reglas de menores, los campos nuevos en la base y la cláusula de geolocalización en las bases versionadas.

Además: una pantalla donde el ya inscripto puede dar o revocar esos permisos después, para poder recuperar a quien se inscriba antes de que esto esté arriba.

**Listo cuando:** una inscripción nueva guarda las tres fechas de consentimiento; un menor no ve la casilla 2; un inscripto viejo puede aceptar desde su panel.

### Etapa 1 — "Preparate para la Clickatón" · **hasta mediados de octubre**

Pantalla previa al evento, enlazada desde el mail de confirmación:

1. Explica en dos pasos cómo encender el geoetiquetado de la cámara, con instrucciones distintas para iPhone y Android.
2. Pide subir **una foto de prueba**.
3. Responde en el acto: si trae ubicación, si la hora del teléfono está bien, si el tamaño alcanza.
4. Pide el permiso de ubicación del navegador, con el argumento del resumen personal.

Reutiliza la cañería de subida y lectura de EXIF que ya existe, con una marca de "prueba" para que no cuente como envío.

**Listo cuando:** un participante sube una foto de prueba y recibe un diagnóstico correcto; la organización ve cuántos inscriptos ya están listos.

### Etapa 2 — Ubicación, recorrido y kilómetros · **octubre**

El cimiento invisible. Guardar puntos de las tres fuentes, aplicar los filtros, calcular el recorrido y los kilómetros, mantener el resumen por participante.

Incluye el respaldo por ciudad y el botón "estoy acá".

**Listo cuando:** con datos simulados de una jornada completa, el recorrido y los kilómetros de cada participante se calculan bien y los puntos malos quedan marcados, no borrados.

### Etapa 3 — Panel del operador · **noviembre**

- Mapa en vivo con puntos, estelas y filtro por consigna y por estado.
- **Radar de historias**: lista auto-ordenada por quién conviene entrevistar ahora.
- **Ficha en un clic**: foto de perfil, nombre, ciudad, Instagram, sus fotos, y un dato de color listo para leer al aire.
- **Contacto sin exponer el dato**: botón de WhatsApp con mensaje prellenado; el teléfono no se muestra ni se puede copiar, y cada revelación queda registrada.
- **Cola de entrevistas** con estados.
- **Reloj de producción**: sincronizado con la línea de tiempo de la edición que ya existe en la base ("en 12 minutos cierra la consigna 4").
- **Comparativa con la 1ª edición**: "a esta hora el año pasado había 40 fotos, hoy 95".
- **Alertas y momentos** detectados solos, con aviso sonoro.
- **Clima** de la ciudad.
- **Alta de los miembros del equipo por email** desde el panel de la organización, con vencimiento el 13/12, revocables de a uno y con registro de auditoría por persona.

**Listo cuando:** una persona invitada por su email entra con el enlace mágico, ve el mapa, encuentra un participante, lo contacta por WhatsApp sin ver el teléfono y lo agenda; todo eso queda registrado a su nombre; y al revocarla pierde el acceso en el acto.

### Etapa 4 — Gráficas al aire y kit de OBS · **noviembre**

Las ocho gráficas de §3.1, el disparador desde el panel, y el archivo de colección de escenas.

La única imagen de personas que sale al aire es la **foto de perfil** del participante, la que él mismo subió al inscribirse. Ninguna gráfica muestra fotos del concurso mientras la evaluación esté abierta (§9.1).

**Listo cuando:** se importa la colección de escenas en un OBS limpio, se ve el termómetro subir en vivo, y el operador saca al aire la ficha de un participante desde el panel sin tocar OBS.

### Etapa 4b — Galería anónima de cierre · **después del cierre de la evaluación**

Una gráfica y una pantalla más, que se habilitan recién cuando la evaluación terminó: las fotos del concurso **sin nombre de autor**, para que la transmisión de la premiación pueda mostrarlas.

Vive detrás de `contestPhotosOnAir`, que no se puede encender antes de la fecha de cierre de la evaluación. Es una llave con fecha, no un botón de criterio.

**Listo cuando:** antes del cierre la galería devuelve vacío aunque se fuerce el interruptor; después del cierre muestra las fotos sin ningún dato del autor.

### Etapa 5 — Segunda pantalla pública · **fines de noviembre, recortable**

Página abierta con el mapa y el termómetro, pensada para el que mira el stream desde el teléfono, más "adoptá un participante": elegís a quién seguir y te avisa cuando ese sube una foto.

Sólo incluye a quienes aceptaron la casilla 2, y nunca a menores.

**Es la única etapa que se puede recortar entera si el tiempo aprieta.**

### Ensayo general — **6 de diciembre**

Ensayo completo con el reloj movible que ya existe para la edición, datos simulados y el equipo de streaming presente, con su propio OBS. El equipo de transmisión no puede ver estas pantallas por primera vez el 12 a las ocho de la mañana.

### Etapa 6 — "Tu Clickatón" · **entrega entre el 13 y el 20 de diciembre**

El resumen personal: mapa del recorrido, kilómetros, horas, primera y última foto, las seis fotos, puesto de velocidad, insignias. Y una **imagen vertical lista para Instagram**, generada del lado del servidor con la máquina de plantillas que ya existe, sin abrir un navegador.

Esta es la contraprestación del permiso de ubicación. Es la única etapa que puede terminarse después del evento: la promesa se hace en octubre, la entrega es la semana siguiente.

Insignias iniciales: madrugador, maratonista (más recorrido), explorador (más zonas distintas), relámpago (las seis en menos tiempo), andariego (el que más se movió).

Las insignias son **información, no premio**. El recorrido se va a medir en todas las ediciones; si en alguna se menciona al aire o se premia, es una decisión de esa edición y no cambia nada del sistema.

### Etapa 7 — Mapa de calor y cierre · **enero**

Mapa de calor de toda la edición y comparativa entre ediciones, para escribir las consignas de la 3ª.

### Transversal — Botón de ayuda

Un botón "necesito ayuda" en la pantalla del participante, que llega a **la organización, no al streaming**, con su última posición conocida. Son personas solas caminando la ciudad diez horas. Entra junto con la etapa 2.

---

## 9. Privacidad y seguridad

- El módulo **nace apagado** (`enabled = false`). Encenderlo son dos cosas: el interruptor en la base y la configuración de la edición. Esto ya nos mordió antes en Clickatón.
- El acceso al panel es **nominal**: la organización invita a cada persona del equipo de transmisión por su email y esa persona entra con un enlace mágico. No hay clave compartida, cada acción queda a nombre de alguien, y se revoca de a una persona. **No** es una cuenta de administrador.
- El token que va en la dirección de las gráficas de OBS es **de sólo lectura y sin datos personales**, precisamente porque una dirección pegada en OBS se copia, se comparte y se filtra.
- El teléfono y el email **no se muestran en pantalla**. El operador dispara un WhatsApp o un mail con el mensaje ya escrito; el dato no se ve ni se copia. Cada vez que se contacta a alguien queda registrado quién fue y cuándo.
- Se firma un **acuerdo de confidencialidad** con el equipo de streaming antes de entregarle el acceso.
- Al aire, los nombres de los participantes sólo aparecen si aceptaron la casilla 2.
- **Ningún menor aparece en el mapa público ni al aire con su ubicación.**

### 9.1 Anonimato de la evaluación

Las fotos del concurso se evalúan sin saber quién las tomó. La transmisión no puede romper eso.

- **Durante el evento no sale al aire ninguna foto del concurso.** Ni en el mapa, ni en el zócalo, ni en la ficha del entrevistado.
- La única imagen de una persona que sale al aire es su **foto de perfil**, la que subió al inscribirse.
- El mapa muestra **dónde está cada participante**, nunca "acá tomó tal foto". Un punto no se vincula públicamente con un envío concreto.
- Tampoco se muestra al aire el detalle de qué consigna resolvió cada uno; sí los números agregados ("38 fotos en la consigna 3").
- Recién **cerrada la evaluación** se habilita la galería anónima (etapa 4b), con las fotos sin autor.
- El interruptor `contestPhotosOnAir` exige una fecha posterior al cierre de la evaluación. No alcanza con que alguien lo prenda.
- Cualquier participante puede revocar y pedir el borrado de sus puntos desde su propia pantalla.

---

## 10. Riesgos

| Riesgo | Impacto | Qué hacemos |
|---|---|---|
| Que alguien cierre la ventana de subida por error | El mapa y el termómetro quedan vacíos toda la jornada | **Decidido: abierta toda la jornada.** El panel avisa en rojo si la ventana de subida está cerrada mientras el evento corre |
| Una foto del concurso se filtra al aire antes de la evaluación | Se rompe el anonimato del jurado | Las gráficas ni siquiera reciben esas fotos del servidor hasta que cierra la evaluación (§9.1) |
| Pocos activan el geoetiquetado | Mapa pobre | Etapa 1 con foto de prueba, recordatorio por mail, y medición previa de cuántos están listos |
| El GPS de las fotos es opcional en la configuración actual | Fotos sin coordenadas | Mantenerlo opcional para no rechazar envíos, pero pedirlo con insistencia en "Preparate" |
| Internet del lugar inestable | El panel se cae en vivo | Consulta corta y repetida, con último estado conocido en pantalla y aviso de "datos de hace X minutos" |
| Cinco bases Neon | Cada migración se multiplica por cinco | Contemplado en el tiempo de cada etapa |
| El equipo de streaming ve la herramienta por primera vez el día del evento | Se desperdicia todo | Ensayo general el 6/12, innegociable |
| Alcance demasiado grande para el 12/12 | Llegar a diciembre con todo a medias | Orden de etapas pensado para que cortar por abajo no rompa nada. La etapa 5 se recorta entera; la 6 se entrega después |

---

## 11. Respondido por la organización

1. **La ventana de subida está abierta durante toda la jornada.** Es la decisión que sostiene el mapa, el termómetro y el radar de historias en vivo.
2. **Los accesos los asigna la organización, persona por persona, con su email.** De ahí el acceso nominal de §6.2 y §9.
3. **El recorrido se mide siempre, en todas las ediciones, como información.** Premiarlo o mencionarlo al aire se decide edición por edición; el sistema no cambia.
4. **Durante el evento no salen al aire fotos del concurso**, por el anonimato de la evaluación. Al aire va la foto de perfil de la inscripción. Cerrada la evaluación, la transmisión puede mostrar las fotos **sin autor** (etapa 4b).

### Todavía abierto

- Quién firma el acuerdo de confidencialidad por el equipo de transmisión, y en qué momento se le entregan los accesos.
- La fecha exacta del cierre de la evaluación, que es la llave de la etapa 4b.
