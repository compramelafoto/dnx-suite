# Diplomas de participación de Clickatón — diseño

Fecha: 2026-09-21
Estado: aprobado por el dueño del producto (Daniel Cuart), pendiente de plan de implementación.

## 1. Problema

Terminada una maratón, no hay forma de entregarle al participante un diploma que
acredite que estuvo. El módulo de diplomas de FotoRank existe y está en `main`, pero
no sirve para esto: guarda los archivos en el disco del servidor (`public/uploads/diplomas`),
que en Vercel es de sólo lectura, y además FotoRank no tiene los datos de los
acreditados de Clickatón — la sincronización entre ambas plataformas nunca corrió.

Clickatón, en cambio, ya genera piezas gráficas por participante en producción (39 placas
de bienvenida y 39 "Soy parte" generadas y guardadas en R2). Ese subsistema tiene todo lo
que un diploma necesita: motor de dibujo, plantillas del diseñador visual asignables por
edición, guardado en R2, cola con reintentos y entrega al participante en Mi cuenta.

## 2. Objetivo

Que desde la edición de cada maratón el admin pueda, con un botón: generar los diplomas de
participación de los acreditados, verlos, descargarlos (uno, varios o todos en ZIP) y
enviárselos por correo a todos.

## 3. Decisiones tomadas

| Decisión | Resuelto |
|---|---|
| Quién recibe diploma | Sólo los acreditados (check-in registrado y no revertido). En la 1ª edición: 29 de 51 inscriptos. |
| Formato | PNG apaisado + PDF A4 horizontal que contiene ese PNG. |
| Cómo llega | Correo con el diploma como imagen y botón a Mi cuenta, donde están el PNG y el PDF. |
| Diseño | **Siempre** una plantilla del diseñador visual (Template V2) asignada a la edición. Sin plantilla no se emite. No hay diseño de fábrica. |
| Contenido | Lo decide la plantilla. El sistema expone las variables: nombre, número de participante, foto, edición, fechas, sede, ciudad, sponsors, marca, código y URL de verificación. |
| Dónde vive | Dentro de Clickatón, como tercer tipo de pieza del subsistema de placas. No en FotoRank. |

## 4. Arquitectura

El diploma es un tercer tipo de pieza (`DIPLOMA`) del subsistema `participant-cards` de
Clickatón, junto a `WELCOME` y `MEMBER`. Se reusa sin cambios de fondo:

- `lib/participant-cards/participant-card-template-source.ts` — resuelve la plantilla
  Template V2 asignada a la edición para ese tipo de pieza.
- `lib/participant-cards/participant-card-renderer.ts` y `participant-card-render-provider.ts` —
  dibujo del PNG (render remoto firmado en producción, Playwright local en desarrollo),
  con su circuit breaker.
- `lib/participant-cards/participant-card-asset-store.ts` — subida a R2 y alta del
  `DnxMediaAsset`.
- `lib/participant-cards/participant-card-service.ts` — bloqueo de concurrencia, caché por
  `renderHash`, estados.
- `app/api/cron/participant-cards/route.ts` — procesamiento por tandas.

### 4.1 La plantilla es obligatoria

Cambio respecto de las otras dos piezas: las placas caen a un preset de código cuando la
plantilla falta o es inválida. **El diploma no.** Reglas:

1. Sin `ClickatonCardTemplateAssignment` habilitada para `(editionId, DIPLOMA)`, el botón de
   generar está deshabilitado y la pantalla explica que hay que crear y asignar la plantilla.
2. Antes de encolar el lote se corre `validateClickatonCardTemplate`. Si la plantilla tiene
   bloques no soportados o variables inexistentes, el lote no arranca y se listan los
   problemas concretos.
3. Si durante el lote la plantilla deja de resolverse, los diplomas afectados quedan
   `FAILED` con motivo `DIPLOMA_TEMPLATE_UNAVAILABLE`. No se emite ningún diseño alternativo.

## 5. Modelo de datos

### 5.1 Cambios en el esquema compartido (`packages/db/prisma/schema.prisma`)

- `enum ClickatonParticipantCardType`: agregar `DIPLOMA`.
- `enum DnxMediaAssetKind`: agregar `PARTICIPANT_CARD_PDF`.
- `model ClickatonParticipantCard`: agregar `pdfAssetId String?` y `pdfStorageKey String?`
  (el PNG sigue en `assetId` / `storageKey`).
- Modelo nuevo `ClickatonDiplomaIssue`, una fila por diploma emitido:
  `id`, `cardId` (→ `ClickatonParticipantCard`), `registrationId`, `editionId`,
  `diplomaCode` (legible, p. ej. `CK1-0042`), `verificationToken` (aleatorio, único),
  `issuedAt`, `revokedAt`, `revokedReason`, `emailStatus`
  (`NOT_SENT` | `QUEUED` | `SENT` | `BOUNCED` | `NO_EMAIL`), `emailSentAt`, `emailLastError`.
  Únicos: `verificationToken`, `diplomaCode`, y `(registrationId)` mientras no esté revocado.

  El diploma es estable por inscripción: el código y el token se generan una sola vez y no
  cambian aunque se rehaga el diseño. `ClickatonParticipantCard` crea una fila nueva cada vez
  que cambia el `renderHash` (plantilla distinta, dato distinto) y deja la anterior `STALE`; el
  diploma apunta siempre a la vigente actualizando `cardId`. Así un QR ya impreso o ya enviado
  por correo sigue funcionando después de una corrección de diseño. Sólo una revocación
  explícita invalida el token, y en ese caso el diploma nuevo nace con código y token propios.

El valor nuevo del enum y las columnas hay que aplicarlos a mano en cada base Neon que
tenga estas tablas. **Preguntarle a cada base si las tiene**, no asumir un número:
el mapa cambió y no todas las bases del mapa las tienen.

### 5.2 Corrección obligatoria del nombre de archivo

`lib/participant-cards/participant-card-r2-keys.ts` hoy manda a la carpeta `welcome`
cualquier `cardType` que no sea `member`:

```
const cardSegment = ...MEMBER... ? "member" : "welcome";
```

Con un tercer tipo, el diploma escribiría en la ruta de la bienvenida y la pisaría. Se
reemplaza por un mapeo explícito por tipo (`welcome` | `member` | `diploma`), con error si
llega un tipo desconocido. Es un cambio de una línea con un test que lo fija.

## 6. Variables de plantilla

`packages/template-engine/src/plugins/clickaton/clickaton-variable-definitions.ts` ya expone
52 variables, entre ellas nombre completo, número de participante (crudo y formateado), foto,
nombre y fecha de la edición, ciudad, sede, logos y nombres de sponsor primario y secundario,
y colores de marca. Se agregan cuatro:

| Variable | Contenido |
|---|---|
| `diploma.issuedAtFormatted` | Fecha de emisión, formateada es-AR. |
| `diploma.accreditedAtFormatted` | Fecha y hora del check-in, en la zona de la edición. |
| `diploma.code` | Código legible del diploma. |
| `diploma.verificationUrl` | URL pública de verificación (`valueType: "qrUrl"`). |

Se suman al ejemplo de datos del plugin (`clickaton-example-data.ts`) para que el diseñador
muestre valores de muestra, y a los alias donde corresponda.

## 7. Render, PDF y QR

- **PNG**: el motor actual, con el tamaño que traiga la plantilla (se recomienda apaisado).
- **PDF A4**: se genera envolviendo el PNG en una hoja A4 horizontal, ajustado al área útil y
  centrado. No se toca `@repo/template-engine-renderer` para esto. La librería de PDF se
  agrega sólo a la app de Clickatón; el lockfile es compartido, así que se verifica que no
  rompa las otras apps.
- **QR**: `packages/template-engine/src/schema/blocks.ts` ya declara el tipo de bloque `QR` y
  el plugin de FotoRank ya lo usa para diplomas, pero `packages/template-engine-renderer/src/html-builder.ts`
  **no lo dibuja**. Se implementa ahí: se genera el QR de la variable `qrUrl` como imagen
  embebida y se pinta en el recuadro del bloque. Queda disponible para todas las plataformas.
  `SUPPORTED_BLOCK_TYPES` de `participant-card-template-source.ts` pasa a incluir `QR`.
- **Foto del participante**: se exige sólo si la plantilla usa la variable de foto. El camino
  de placas hoy la exige siempre (`profilePhotoAssetId` + `imageUsageConsent`); para el
  diploma la exigencia se deriva de la plantilla.

## 8. Elegibilidad y lote

Elegible = inscripción de la edición con al menos un `ClickatonCheckIn` con `reversedAt IS NULL`.
No se mira el estado de pago: la acreditación ya implica que entró.

El botón no genera nada en la petición web: marca las inscripciones elegibles como pendientes
y el cron las procesa por tandas (25 por corrida, igual que hoy), con reintentos y bloqueo de
concurrencia. Generar 29 PDF en un request agotaría el tiempo de la función.

Idempotencia: el lote es una operación repetible. Volver a apretar el botón no duplica
diplomas ni reenvía correos; sólo toma a los que están sin generar o fallidos.

## 9. Pantalla de admin

### 9.1 Placas (existente)

`app/admin/(panel)/ediciones/[editionId]/placas/page.tsx`: la constante `CARDS` pasa de dos a
tres entradas, con "Diploma de participación — se genera a pedido, para los acreditados".
El selector de plantilla y el interruptor de habilitación ya funcionan por tipo.

### 9.2 Diplomas (nueva)

`app/admin/(panel)/ediciones/[editionId]/diplomas/page.tsx`:

- Encabezado con el estado: acreditados, diplomas listos, fallidos, sin generar, correos enviados.
- Aviso bloqueante si la edición no tiene plantilla de diploma asignada, con enlace a Placas.
- **Ver un ejemplo**: genera un diploma de muestra con un acreditado real, sin guardarlo como
  definitivo, para revisar el diseño antes del lote.
- **Generar los diplomas**: encola a los elegibles sin diploma.
- Tabla por participante: número, nombre, estado, miniatura, y acciones ver / PNG / PDF / rehacer.
  "Rehacer" regenera los archivos conservando código y token; no emite un diploma distinto.
- Selección múltiple → **Descargar en ZIP** (los tildados o todos). El ZIP se arma en streaming
  desde R2 para no cargar 29 archivos en memoria.
- **Enviar por correo**: confirmación previa que dice cuántos correos salen y cuántos
  participantes no tienen dirección.

Permisos: `requireClickatonAdmin`, con la capacidad de la edición, igual que acreditación.

## 10. Entrega al participante

- Mi cuenta: `app/api/account/registrations/[registrationId]/cards/[cardType]/route.ts` ya
  entrega la pieza del participante autenticado; acepta `DIPLOMA` y, con `?format=pdf`, el PDF.
- La pantalla de la inscripción muestra el diploma cuando existe, con los dos botones de descarga.
- Correo: uno por participante, con el diploma como imagen y botón a Mi cuenta. Se encola en
  `ClickatonIntegrationOutboxEvent` con clave de idempotencia `diploma_email:<registrationId>`,
  de modo que el envío es durable y no se repite. El resultado se anota en `emailStatus`.

## 11. Verificación pública

`app/(public)/diplomas/verificar/[token]/page.tsx`: muestra nombre del participante, edición,
fecha del evento, fecha de emisión, código y estado (válido / revocado). Sin sesión, sin datos
de contacto, sin índice en buscadores. El token es aleatorio y no derivable del número de
inscripción. Se sigue el patrón ya implementado en FotoRank
(`apps/fotorank/app/diplomas/verificar/[token]/page.tsx`).

## 12. Errores y estados

Se reusan los estados de pieza (`GENERATING`, `READY`, `FAILED`, `STALE`, `DELETED`). Motivos
propios del diploma, visibles en el panel en castellano:

- `DIPLOMA_TEMPLATE_MISSING` — la edición no tiene plantilla asignada.
- `DIPLOMA_TEMPLATE_INVALID` — la plantilla tiene bloques o variables que el motor no soporta.
- `DIPLOMA_TEMPLATE_UNAVAILABLE` — la plantilla dejó de resolverse durante el lote.
- `DIPLOMA_NOT_ACCREDITED` — la inscripción no tiene acreditación vigente.
- `DIPLOMA_PHOTO_REQUIRED` — la plantilla usa la foto y el participante no tiene.

## 13. Pruebas

Tests unitarios y de integración, escritos antes del código:

1. Elegibilidad: acreditado sí; no acreditado no; acreditación revertida no; dos check-ins no
   generan dos diplomas.
2. Nombre de archivo: los tres tipos de pieza producen rutas distintas para la misma inscripción.
3. Plantilla obligatoria: sin plantilla no se emite y el motivo es `DIPLOMA_TEMPLATE_MISSING`;
   plantilla inválida no arranca el lote; en ningún caso se emite un diseño alternativo.
4. Variables: las cuatro nuevas se resuelven y el bloque QR se dibuja con la URL correcta.
5. PDF: el A4 contiene el PNG, en horizontal, sin recorte.
6. Idempotencia: dos lotes seguidos no duplican diplomas ni reencolan correos ya enviados.
7. Correo: participante sin email queda `NO_EMAIL` y no bloquea al resto.
8. Verificación: token válido muestra datos; token inexistente y diploma revocado muestran su
   estado; el token no se puede adivinar desde el número de inscripción.

## 14. Etapas

1. **Pieza, plantilla y panel.** Enum, corrección del nombre de archivo, tercera fila en Placas,
   pantalla de Diplomas con ejemplo, lote, tabla, descarga individual y ZIP. Con esto los 29
   diplomas de la 1ª edición ya se pueden bajar.
2. **PDF, QR y verificación.** Bloque QR en el motor, variables nuevas, PDF A4, página pública
   de verificación.
3. **Correo.** Envío por outbox, registro por participante, prueba previa con tres direcciones.

## 15. Riesgos y notas de operación

- **Entrega a Gmail.** Los correos de Clickatón hoy no llegan a Gmail y la causa sigue sin
  identificarse. Antes del envío masivo, prueba con tres direcciones propias (una de Gmail). Si
  falla, la etapa 3 se detiene y los diplomas se reparten con el ZIP de la etapa 1.
- **Enum en varias bases.** Un valor de enum o una columna sin aplicar no rompen sólo la pantalla
  nueva: rompen toda lectura del modelo. Aplicar y verificar base por base antes de desplegar.
- **Dependencia nueva.** La librería de PDF entra en un lockfile compartido por siete apps;
  verificar que las demás siguen compilando.
- **Placas fallidas.** Las 16 piezas `FAILED` de producción son residuo: cada una tiene su
  gemela `READY`. No son un prerrequisito de este trabajo.
- **Fuera de alcance.** Diplomas para jurados, sponsors o colaboradores; diplomas por puesto o
  premio; envío por WhatsApp; llevar los acreditados a FotoRank.
