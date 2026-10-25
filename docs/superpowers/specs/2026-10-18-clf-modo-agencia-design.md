# ComprameLaFoto — Modo agencia: equipos de fotógrafos con reparto automático

Fecha: 2026-10-18 · Estado: diseño aprobado por partes por Daniel en la sesión del 17-18/10/2026.
Primer cliente: **Diego Fernandez Heugas (Fotoshow Estudio, usuario CLF 943)**, que cubre los
balnearios de Mar del Plata con 15–20 fotógrafos a los que les paga ~30 %. Temporada: enero 2027.
**Meta: listo el 30/11/2026.** Debe servir igual para cualquier empresa de turismo (centros de esquí,
excursiones, puntos turísticos).

> Diego quiere vender todo por CLF y teme que sus fotógrafos lo **puenteen** (le vendan al turista por
> fuera). El modo agencia hace que el fotógrafo **no tenga motivo ni forma cómoda** de hacerlo: el
> turista queda registrado con la agencia en la misma playa (QR + selfie), el fotógrafo no ve
> compradores ni descarga originales, cobra **su porcentaje directo en su Mercado Pago** en cada venta
> y la agencia tiene un panel que detecta cámaras ajenas, fotos que faltan y fotógrafos que no venden.
> El fotógrafo, en el hotel, pone la tarjeta, abre **DNX FLUX** y las fotos suben solas al álbum de la
> agencia; o las manda desde la playa por **FTP** con la cámara.

## Decisiones de Daniel (17-18/10/2026)

| # | Decisión |
|---|---|
| D1 | Enfoque **A**: entidad **Agencia** nueva con **un álbum único** de la agencia. No se construye sobre el modo organizador (un álbum por fotógrafo rompe packs y "toda la sesión"), aunque se reutilizan sus piezas: comisiones, invitación por link, aceptación de condiciones. |
| D2 | **Un solo menú "Agencias"** en el panel del fotógrafo, con cartel **NEW** llamativo, y adentro **Mi agencia**, **Directorio de agencias** y **Mis agencias**, cada una con una explicación breve. |
| D3 | La conexión de Mercado Pago es **la misma herramienta de siempre** (Configuración → Mercado Pago). "Mis agencias" sólo tiene un acceso directo a ella. |
| D4 | **Un álbum por temporada** (siempre el mismo, para que el fotógrafo no elija nada al subir). **Sin carpetas por balneario:** cada foto guarda **un punto en el mapa**. |
| D5 | Ubicación de cada foto: **GPS de la cámara si lo trae** (definitivo); si no, **el punto que cargó el fotógrafo** al empezar la subida (DNX FLUX) o con "Estoy acá" (FTP). El punto es genérico: balneario, mirador, pista de esquí. |
| D6 | El turista busca en el mismo álbum por **selfie, fecha y mapa**. |
| D7 | Reparto: el autor de cada foto cobra **su porcentaje del precio de la agencia (sin el fee)**; la agencia, el resto; la plataforma, su fee encima como hoy. En packs y "toda la sesión", proporcional a las fotos de cada autor. En impresas, **sobre el total** (copia + digital). |
| D8 | **Porcentaje general de la agencia + porcentaje propio por fotógrafo.** |
| D9 | **Cada fotógrafo sube desde su propia notebook** con DNX FLUX (Mac y Windows) y, si tiene, **por FTP desde la cámara** en el momento. |
| D10 | **La agencia imprime y entrega.** |
| D11 | Qué se vende y cómo **lo decide cada agencia** con la configuración de venta normal del álbum. El modo agencia no la toca: sólo agrega autoría y reparto. |
| D12 | **"No me encuentro"** activado como opción por agencia (encendida para Fotoshow). |
| D13 | El **filtrado y la edición automática en la nube** se diseñan en otra sesión; este diseño sólo deja el punto donde se enchufan. |
| D14 | Ideas para después (no en esta etapa): convocatorias de agencias que buscan fotógrafos, perfil y disponibilidad del fotógrafo, reputación mutua, contrato digital ampliado, temporadas en otras ciudades. |

## Estado de partida (verificado el 17-18/10/2026 en `origin/main` y producción)

| Pieza | Estado real | Consecuencia |
|---|---|---|
| Subida por FTP (`apps/compramelafoto-workers/camera-ftp-gateway`, `CameraConnectionSettings`, `CameraIngestJob`) | Programada. **Nunca recibió una foto de cámara** (605 jobs, todos `WEB_UPLOAD` del 22/06; `CameraUploadLog` vacío). Los Dockerfiles son "legacy", la guía de despliegue no existe y no hay señal de que el servidor esté en marcha. Resuelve **un álbum por usuario** (`activeAlbumId`), no por agencia. | Poner el servidor en marcha es una tarea propia. El usuario de FTP pasa a ser **por miembro de agencia**. |
| Fila de ingesta (`CameraIngestJob`, `enqueue-album-photo-ingest.ts`) | Funciona (605 jobs completos). | Es la fila común de las dos puertas. |
| DNX FLUX (`~/Desktop/PROGRAMACIONES/dnx-flux`, Python, sin remoto) | Herramienta interna de DNX. Publica en **FOTOFFICE** (`/api/flux/v1/*`, llave de dispositivo `fo_dev_…`), **no en CLF**. Probado en Mac, falta Windows. CLF no tiene tokens de API. | Hay que hacerlo instalable para terceros y darle una puerta en CLF (llave de dispositivo por miembro, como FOTOFFICE). |
| Carpetas (`AlbumFolder`, `EventFolder`) | Sin link propio, sólo filtro. | No se usan: la ubicación va por foto (D4). |
| Autoría | `Photo.userId` = quien subió; el motor de precios ya toma el autor de la base (`pricing-engine.ts`). | Base del reparto. |
| Modo organizador | En uso real (92 eventos, 635 pedidos pagados, 545 comisiones). El cobro entra al dueño del álbum; la comisión del organizador va por `marketplace_fee` y la plataforma se la paga después (`HELD_BY_PLATFORM`). | Se copian formas (comisión congelada por pedido, invitación, términos), no el flujo de plata. |
| Split 1:N (`packages/payments`, Orders API + Card Payment Brick) | Probado en sandbox; homologación sin la orden productiva de cierre. **Máximo 10 partners.** El `owner` es la cuenta de DNX y recibe todo lo que no es partner. Consentimiento de reparto **por cuenta**, sin OAuth (`MercadoPagoSplitConsentAdapter.invite`). Devolución total por partner anda; parcial a un participante anda en sandbox desde el PR 575. Primer consumidor real: Muestras (etapa 8). **No está conectado al checkout de CLF** (que usa Checkout Pro). | El álbum de agencia necesita **cobro con Brick dentro de la página** (copiar la forma de Muestras). |
| Privacidad de colaboradores | `api/fotografo/pedidos` muestra **todos** los pedidos (con nombre, email, teléfono) de cualquier álbum donde el usuario tenga una foto; la descarga entrega el pedido entero. Cualquiera puede subir a un álbum público ajeno. | **Requisito previo** (tarea aparte `task_5890b7c0`). |
| Vencimiento | El álbum se oculta a los 30 días de la primera foto (`computeAlbumHideAt`) y lo limpia el pipeline de 45 días. | Un álbum de temporada desaparecería a mitad de enero: hace falta **vencimiento por foto**. |
| Análisis facial | Cola FIFO global; las 789 fotos del álbum 1159 esperaron ~2,5 h. | Prioridad para álbumes de agencia. |
| Página pública | Carga todas las fotos de una vez (789 imágenes en el álbum 1159). | Carga por partes para cientos de miles de fotos. |

## Parte 1 — Piezas, menú y permisos

### Modelo de datos nuevo (prefijo `Agency*`, base compartida de CLF)

- **`Agency`**: `id`, `ownerUserId` (único por ahora: una agencia por cuenta), `name`, `slug`, `logoUrl`,
  `description`, `defaultCommissionBps` (p. ej. 3000 = 30 %), `directoryListed` (bool),
  `directoryLat`/`directoryLng`/`directoryRadiusKm`/`directoryCity`, `notFoundSearchEnabled` (D12),
  `publishMode` (`IMMEDIATE` | `AWAIT_FILTER`, Parte 2; por defecto `IMMEDIATE`), `photoVisibilityDays` (Parte 4; por defecto 30),
  `termsText` + `termsVersion` (condiciones que acepta el fotógrafo), fechas.
- **`AgencyMember`**: `agencyId`, `userId` (único por par), `status` (`INVITED` | `REQUESTED` |
  `ACTIVE` | `REMOVED`), `commissionBps` nullable (null = usa el de la agencia), `termsVersionAccepted`,
  `termsAcceptedAt`, `joinedAt`, `removedAt`, `requestMessage`.
- **`AgencyInvite`**: link de invitación de la agencia (`tokenHash`, vencimiento opcional, usos).
- **`AgencyAlbum`**: vincula `albumId` (único) con `agencyId`. El álbum sigue siendo un `Album` normal de
  `ownerUserId`; esta fila lo marca "de la agencia" y es lo único que habilita a los miembros a subir.
- **`AgencyPlace`**: lugares frecuentes de la agencia (`name`, `lat`, `lng`) para elegir rápido.
- **`AgencyUploadCredential`**: puertas de entrada por miembro: `kind` (`FTP` | `FLUX_DEVICE`),
  `ftpUsername` + `ftpPasswordHash` o `deviceKeyHash` (SHA-256, como `FotofficeDispositivo`),
  `label`, `lastUsedAt`, `revokedAt`.
- **`AgencyMemberPresence`**: "Estoy acá" (`memberId`, `lat`, `lng`, `placeId?`, `validUntil` = fin del
  día en hora argentina).
- **`AgencyCamera`**: cámaras registradas por miembro (`serialNumber`, `make`, `model`, `firstSeenAt`,
  `approvedAt`), alimentada desde `PhotoExifMetadata`.

Columnas nuevas en `Photo` (o tabla `PhotoGeo` 1:1, a decidir en el plan según el peso de la
migración): `geoLat`, `geoLng`, `geoSource` (`EXIF_GPS` | `DECLARED`), `ingestCredentialId`,
`visibleUntil` (Parte 4). La hora de toma ya vive en `PhotoExifMetadata.takenAt`/`Photo.capturedAt`
(ojo con `exifr`: devuelve la hora en la zona del runtime; normalizar a hora argentina).

### Menú (D2)

`config/navigation.ts` → ítem **"Agencias"** con `badge: "NEW"` (estilo llamativo de
`components/panels/nav-badge.ts`, PR 626) e hijos:

| Sección | Ruta | Texto de ayuda |
|---|---|---|
| Mi agencia | `/fotografo/agencias/mi-agencia` | "Armá tu equipo de fotógrafos, decidí cuánto cobra cada uno y vendé todo desde un solo álbum." |
| Directorio de agencias | `/fotografo/agencias/directorio` | "Encontrá agencias cerca tuyo y mandales una solicitud para sumarte a su equipo." |
| Mis agencias | `/fotografo/agencias/mis-agencias` | "Las agencias para las que trabajás, lo que subiste y lo que te pagaron." |

- **Mi agencia** (dueño): crear la agencia; equipo (invitar por link, aceptar solicitudes, porcentajes,
  dar de baja); álbum(es) de la agencia; lugares frecuentes; ventas y reparto; panel de control (Parte 5);
  configuración (directorio, "no me encuentro", modo de publicación, días de visibilidad, condiciones).
- **Directorio**: mapa/lista de agencias con `directoryListed`, ordenadas por distancia; botón
  "Pedir sumarme" con mensaje → `AgencyMember(status=REQUESTED)`.
- **Mis agencias** (miembro): agencias activas; aceptar condiciones; acceso directo a la conexión de
  Mercado Pago (D3) y estado del consentimiento de reparto; usuario de FTP; vincular DNX FLUX (código);
  "Estoy acá"; mis fotos subidas; mis ventas y lo cobrado.

### Permisos del miembro sobre el álbum de agencia

Puede: **subir** (sólo por sus credenciales o por la web autenticado), ver sus propias fotos y sus
ventas (montos, sin datos del comprador). No puede: ver compradores ni interesados, descargar
originales (tampoco los suyos una vez subidos), tocar precios, packs ni configuración, ver ventas
ajenas. Todo se resuelve en el servidor por `AgencyAlbum` + `AgencyMember.status = ACTIVE`; ninguna
ruta de dueño (`/api/dashboard/albums/[id]`) se abre a miembros. `ensureAlbumUploadAccess` deja de
permitir subir a álbumes de agencia a quien no es miembro activo.

**Baja de un miembro**: deja de poder subir (se revocan sus credenciales); sus fotos quedan y su
porcentaje se sigue pagando por las ventas de sus fotos, salvo que la agencia lo cambie
explícitamente (queda registrado).

## Parte 2 — Entrada de fotos

**Fila común.** Las dos puertas encolan en la fila de ingesta existente (`CameraIngestJob`) con:
autor (`userId` del miembro), `albumId` del álbum de agencia, credencial usada, ubicación declarada y
origen. Nuevos valores de `AlbumPhotoIngestSource`: `CAMERA` (FTP) y `FLUX`.

**Ubicación (D5).** Al procesar la foto: si el EXIF trae GPS → `geoSource = EXIF_GPS`; si no → el punto
declarado (de DNX FLUX al empezar la tanda, o la `AgencyMemberPresence` vigente para FTP) →
`DECLARED`; si no hay ninguno, la foto queda sin punto (se encuentra igual por selfie y fecha).

**Puerta FTP (playa).** Usuario y clave de FTP **por miembro y agencia** (`AgencyUploadCredential`),
visibles en "Mis agencias", que se cargan una vez en la cámara. El gateway resuelve el destino por la
credencial (no por `activeAlbumId`): siempre el álbum de agencia vigente. "Estoy acá" desde el
celular fija el punto hasta fin del día. **Requisito:** desplegar el gateway y el worker en un VPS
(reescribir los Dockerfiles para el monorepo, escribir la guía que falta, `CAMERA_CONNECTION_FTP_SERVER_LIVE`).

**Puerta DNX FLUX (hotel).** Vincular una vez: "Mis agencias" muestra un código corto; DNX FLUX lo
canjea por una llave de dispositivo (`AgencyUploadCredential.kind = FLUX_DEVICE`, guardada en el
llavero del sistema). Al poner la tarjeta: elige agencia (sólo si tiene más de una) y punto (lugares
de la agencia o "mi ubicación"). Sube **directo a R2** con URLs firmadas en lotes (forma de
`/api/flux/v1/galerias/[id]/archivos` de FOTOFFICE) y confirma cada foto; nunca pasa por Vercel
(límite 4,5 MB). Opción **"Subir sin dejar copia"** marcada por defecto. Retoma solo si se corta.
Si un JPG supera el tope de CLF (10 MB), DNX FLUX lo achica antes.

Endpoints nuevos en CLF (autenticados con la llave de dispositivo): `POST /api/agency-ingest/v1/link`
(canje del código), `GET /api/agency-ingest/v1/me` (agencias y lugares), `POST …/batches` (URLs
firmadas + punto declarado), `POST …/photos/[id]/confirm`.

**Repetidas.** Clave: `serialNumber` de la cámara + número de imagen del EXIF + `takenAt` (y hash del
archivo como respaldo). Si ya existe, se descarta la segunda copia.

**Encaje con el filtrado (D13).** `Agency.publishMode`: `IMMEDIATE` (se publica al procesar) o
`AWAIT_FILTER` (la foto queda en un estado de espera y se publica cuando llega la señal "aprobada"
del filtro de la nube, o se descarta con "rechazada"). Este diseño define sólo ese estado y esa
señal (endpoint interno firmado); el filtro se diseña aparte.

**Prioridad en el análisis facial.** El runner de análisis toma primero las fotos de álbumes de
agencia (orden por prioridad y después por `createdAt`), sin dejar sin turno al resto (cupo por corrida).

## Parte 3 — Reparto de la plata

**Cálculo por línea** (función pura, con tests): para cada línea del pedido se toma el **precio de la
agencia sin fee** y se reparte entre las fotos que la componen; por cada foto, el autor recibe su
porcentaje vigente (`AgencyMember.commissionBps ?? Agency.defaultCommissionBps`) y la agencia el resto.
Fotos del dueño → 100 % agencia. Packs y "toda la sesión": precio ÷ cantidad de fotos de la selección
real del momento de la compra. Impresa con digital incluido: sobre el total (copia + digital).
Redondeo a pesos enteros; el residuo va a la agencia.

*Ejemplo de referencia (test):* pack de 5 fotos a $30.000, 3 de Juan (30 %) y 2 de Pedro (25 %) →
Juan $5.400, Pedro $3.000, agencia $21.600, plataforma $4.500 de fee; el turista paga $34.500.

**Libro de reparto** (`AgencySaleShare`): una fila por pedido y beneficiario con monto, porcentaje
aplicado, `settlement` (`SPLIT` | `OWED_BY_AGENCY`) y estado (`PENDING` | `PAID` | `REFUNDED`).
Se congela al pagar (como `EventOrganizerCommission`). Diego lo ve completo; cada fotógrafo, sus filas.

**Cobro con split 1:N** (cuando esté habilitado en producción para CLF): los pedidos de un álbum de
agencia se cobran con **Card Payment Brick + Orders API** (`MercadoPagoOrdersAdapter.createSplitOrder`),
copiando la forma de Muestras: `owner` = cuenta DNX (recibe el fee), `partners` = agencia y autores con
consentimiento `ACTIVE`, montos fijos. **Máximo 10 partners**: agencia + hasta 9 fotógrafos; los que
no entran, o no tienen consentimiento activo, cobran como `OWED_BY_AGENCY` (su parte va a la agencia
y queda la deuda a la vista de los dos; la agencia la marca pagada). `external_reference` con prefijo
`clf-agencia-`. Conciliación por varios caminos (creación, página del pedido, barrido), nunca
confiando sólo en el webhook.

**Sin split habilitado** (o si falla al crear la orden): el álbum de agencia cobra como hoy (Checkout
Pro al dueño) y todo el reparto queda `OWED_BY_AGENCY` con **liquidación** por fotógrafo y período.
El cambio de un modo a otro no cambia nada para los usuarios.

**Consentimiento de reparto (D3).** En la pantalla actual de Mercado Pago del fotógrafo se suma el
paso "Aceptar recibir pagos repartidos" (`invite` con el email de su cuenta + verificación); "Mis
agencias" lleva a esa pantalla.

**Devoluciones.** Total: una pata por receptor. Parcial: dirigida al/los participantes que
corresponda (`splits` en el nivel superior, PR 575). El libro de reparto se actualiza.

## Parte 4 — Lo que ve el turista

1. **En la playa:** tarjeta con **QR por fotógrafo** (link al álbum con `?ref=<miembro>` para medir
   quién trae clientes). El turista deja nombre, WhatsApp, mail y **selfie** (`AlbumInterest`
   existente). Al subirse y analizarse sus fotos, el aviso "Encontramos tus fotos" (cron de
   face-matching existente) le llega solo.
2. **Galería:** oculta hasta selfie por defecto (configurable a abierta). Después de la selfie, filtros
   por **fecha** (día y franja horaria) y **mapa** (puntos donde aparece / "cerca de mi ubicación").
   **"No me encuentro"** (si la agencia lo activa): eligiendo día, franja de hasta 1 h y un punto en el
   mapa (radio chico), ve sólo esas fotos; con límite de uso por dispositivo para que no sirva para
   recorrer la galería entera.
3. **Compra:** la configuración de venta normal del álbum (D11). Si la agencia vende impresas, puede
   cargar **puntos de retiro** con horario (opcional).
4. **Vencimiento por foto:** el álbum de agencia no vence; cada foto es visible
   `Agency.photoVisibilityDays` desde que se sacó (`Photo.visibleUntil`) y la limpieza actual se aplica
   por foto. Mensaje claro para el que llega tarde.
5. **Volumen:** la galería pública del álbum de agencia carga **por páginas**; las búsquedas por fecha
   y mapa consultan sólo lo pedido (índices por `albumId` + fecha y por punto).

## Parte 5 — Control antipuenteo y seguridad

- **Panel de control** (Mi agencia): cámaras del equipo (alerta ante cámara nueva no aprobada);
  **huecos de numeración** por cámara y día ("faltan 140 fotos entre 15:10 y 16:30"; señal, no prueba);
  comparación por fotógrafo y día (fotos, clientes registrados con su QR, ventas, ventas cada 100
  fotos); demora entre toma y subida.
- **Requisito previo:** cerrar la fuga de datos de compradores a colaboradores (`task_5890b7c0`).
- **Credenciales:** por miembro y agencia; revocables con un clic por la agencia o el miembro; sólo
  permiten subir; cada subida queda registrada.
- **Condiciones de la agencia** aceptadas por el miembro al sumarse, versionadas (cambiarlas pide
  aceptar de nuevo); reutiliza la forma de `EventMember.termsAcceptedText`.
- **Fallas:** reintentos de ingesta y lista "con error" visible; si cae el split, el cobro entra a la
  agencia como `OWED_BY_AGENCY`; DNX FLUX retoma sin repetir.

## Parte 6 — Etapas y fechas

| Etapa | Fechas | Entregable |
|---|---|---|
| 0. Requisitos | 19–21/10 | Fuga de datos cerrada. Consulta a MP: tope de receptores en producción. Diego: modelos de cámaras y sistemas operativos del equipo, fotos por día. |
| 1. Agencia y equipo | 19/10–1/11 | Modelo `Agency*`, menú Agencias (NEW) con las tres secciones, invitación, directorio y solicitudes, porcentajes, permisos, álbum de agencia, condiciones. |
| 2. Entrada de fotos | 26/10–8/11 | Fila común con autor, punto y hora; FTP por miembro + "Estoy acá"; **servidor FTP desplegado**; prioridad facial; sin repetidas. |
| 3. DNX FLUX para fotógrafos | 2/11–15/11 | Instalable Mac y Windows, vínculo por código, subida directa sin copia, punto al empezar, estado de espera para el filtro. |
| 4. Reparto | 9/11–22/11 | Libro de reparto y liquidación; split 1:N con Brick en álbumes de agencia (si MP lo habilitó); devoluciones. |
| 5. Turista y control | 16/11–25/11 | QR por fotógrafo, filtros por fecha y mapa, "no me encuentro", carga por páginas, vencimiento por foto, puntos de retiro, panel antipuenteo. |
| 6. Piloto | 23/11–30/11 | Diego + 2–3 fotógrafos en un evento real (28–29/11) y ajustes. |

Cada etapa tiene su propio plan de implementación y sale a producción por separado (CLF vende en
producción: cambios aditivos, el álbum común no cambia de comportamiento).

## Pruebas

- Funciones puras con tests: reparto por línea (incluido el ejemplo de referencia, redondeo, dueño,
  tope de 10 partners, miembro sin consentimiento), resolución de ubicación, detección de repetidas,
  huecos de numeración, vencimiento por foto, permisos del miembro.
- Integración: ingesta FTP y FLUX contra una base de prueba; split en sandbox con usuarios de prueba
  (la CLI `imp05-sandbox-evidence` como referencia).
- Manual: piloto con Diego (Etapa 6).

## Riesgos

- **Split en producción**: si no se habilita a tiempo, se lanza con liquidación (`OWED_BY_AGENCY`).
- **DNX FLUX en Windows**: sin probar; es la mayor incertidumbre técnica.
- **Servidor FTP**: infraestructura nueva (VPS), costo mensual chico.
- **Costo de reconocimiento facial**: decenas de miles de fotos por día; calcular el costo en AWS antes
  de enero y decidir si va en el fee de la agencia.
- **Medios de pago con Brick**: el cobro repartido es con tarjeta dentro de la página; verificar qué
  medios ofrece frente al Checkout Pro actual.

## Fuera de alcance

Filtrado y edición automática (otra sesión); convocatorias, perfil y disponibilidad del fotógrafo,
reputación, contrato digital ampliado, temporadas en otras ciudades (D14); más de una agencia por
cuenta dueña.
