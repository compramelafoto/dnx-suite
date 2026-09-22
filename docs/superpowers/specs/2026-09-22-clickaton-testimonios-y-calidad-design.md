# Testimonios y relación de calidad en Clickatón

**Fecha:** 2026-09-22
**Estado:** diseño aprobado, en implementación

## El problema

Clickatón terminó su primera edición y no tiene forma de saber qué le pareció a
la gente que participó. No hay encuesta, no hay número de satisfacción, no hay
un solo testimonio publicado, y la home vende la experiencia sin que nadie que
la haya vivido aparezca diciéndolo.

Son dos huecos distintos que se resuelven con la misma pieza:

1. **Hacia adentro:** medir. Qué salió bien, qué salió mal, con números
   comparables entre ediciones.
2. **Hacia afuera:** mostrar. Que quien entra a la home lea a un participante
   real, con su cara y su nombre, y pueda ir a su Instagram.

Una encuesta que alimenta una sección de testimonios moderada.

## Lo que ya existe y se reutiliza

Auditado el 2026-09-22 sobre `origin/main` (8824f84b).

| Pieza | Dónde | Para qué sirve acá |
|---|---|---|
| Instagram del participante | `ClickatonRegistration.instagramHandle` / `instagramUrl` | El enlace del testimonio sale de acá, ya validado en el alta |
| Foto de perfil | `ClickatonRegistration.profilePhotoAssetId` + recorte | La cara que se publica; no hay que volver a pedirla |
| Consentimiento de imagen | `imageUsageConsent`, `socialPublicationConsent` | Antecedente del consentimiento; el de publicación de testimonio es propio y aparte |
| Cola de correo idempotente | `apps/clickaton/lib/registration/notifications/email-delivery.ts` + `EmailQueue.idempotencyKey` | La invitación post-evento se encola acá; imposible mandarla dos veces |
| Login unificado con retorno | `apps/clickaton/lib/auth/return-path.ts` | El enlace del correo pasa por login y vuelve solo al formulario |
| Menú del panel | `apps/clickaton/config/admin/navigation.ts` | Fuente única de las etiquetas del admin |
| Sedes con contacto | `ClickatonVenue.contactEmail` | Identifica a la sede que responde |
| Jurados | `FotorankJudgeAccount` / `FotorankJudgeAssignment` (base de FotoRank) | Identifica al jurado que responde |

**El hueco:** no existe ningún modelo de encuesta ni de testimonio, ninguna
pantalla, y ningún correo posterior al evento.

## Qué se construye

### 1. Tres tablas, no una

La separación es deliberada y es la decisión de diseño más importante:

```
ClickatonSurveyResponse          ClickatonTestimonial           ClickatonTestimonialInvite
  (privada, nunca sale)     1─0..1  (lo publicable)                 (a quién se invitó)
  - NPS 0..10                       - quote (≤400)                  - editionId + rol
  - 7 notas 1..5 / N-A              - highlightedExcerpt            - email + userId?
  - improvementNotes ←── nunca      - status PENDING/PUBLISHED/…    - sentAt / respondedAt
    se copia a la derecha           - authorName/Role/PhotoAssetId  - idempotencyKey
  - wouldReturn                     - authorLinkUrl
```

- **`ClickatonSurveyResponse`** guarda la encuesta completa, incluida la crítica
  constructiva. Esta tabla **no tiene ninguna ruta pública de lectura**.
- **`ClickatonTestimonial`** guarda sólo el párrafo que el autor autorizó a
  publicar, más una foto congelada de su identidad en el momento de responder
  (nombre, rol, edición, foto, enlace). Que el participante después cambie su
  Instagram no reescribe un testimonio ya publicado.
- **`ClickatonTestimonialInvite`** hace medible la tasa de respuesta y evita
  duplicar correos.

La crítica privada y el texto publicable viven en filas distintas. Un error de
`select` no puede filtrar la crítica a la home, porque la home no consulta esa
tabla nunca.

### 2. La encuesta

Una sola pantalla, alrededor de dos minutos. Las preguntas son fijas en código
(`apps/clickaton/lib/testimonials/domain/survey-definition.ts`), así los
promedios son comparables entre ediciones.

**El número duro (obligatorio)**
`npsScore` 0 a 10 — "¿Qué tan probable es que le recomiendes Clickatón a otro
fotógrafo?"

**La relación de calidad** — siete notas de 1 a 5, cada una con "No aplica"
(`null`), que no promedia. Ese "No aplica" es lo que permite que la misma
encuesta sirva para participante, jurado y sede sin armar tres formularios.

| Campo | Pregunta |
|---|---|
| `scoreOrganization` | Organización general |
| `scorePrompts` | Consignas y desafío fotográfico |
| `scoreVenue` | Sede y punto de encuentro |
| `scoreKit` | Kit y materiales |
| `scoreAccreditation` | Acreditación: llegada y entrega |
| `scoreCommunication` | Comunicación antes y durante |
| `scoreValueForMoney` | Relación precio / valor |

**En tus palabras** — las dos cajas separadas:

- `publicQuote` (≤400 caracteres) — "¿Qué querés decirnos sobre Clickatón?"
  **Es el único texto que puede publicarse.**
- `improvementNotes` (≤1000, opcional) — "¿Qué mejorarías? Criticá sin filtro."
  Con un cartel visible: *"Esto no se publica nunca. Lo lee sólo el equipo."*
  Sin esa promesa explícita nadie critica en serio.

**Cierre**

- `wouldReturn` — Sí / Tal vez / No.
- `authorLinkUrl` — Instagram prellenado desde la inscripción, o sitio web.
  Se normaliza y se valida el formato (sólo `http(s)`, sin `javascript:`).
- `publicationConsent` — *"Autorizo a publicar mi testimonio con mi nombre y mi
  foto en el sitio de Clickatón."* Sin la tilde, la respuesta suma a las
  métricas y no se crea fila en `ClickatonTestimonial`.

### 3. Quién puede responder

Hace falta sesión activa. Un único resolutor —
`resolveTestimonialEligibility({ userId, email, editionId })` — devuelve el rol
y de dónde sale la identidad:

| Rol | Condición | Identidad |
|---|---|---|
| `PARTICIPANT` | Tiene `ClickatonRegistration` con `status = CONFIRMED` en esa edición (por `userId` o por `email`) | Nombre, foto e Instagram de la inscripción |
| `VENUE` | Su correo coincide con `ClickatonVenue.contactEmail` de una sede activa de la edición | Nombre de la sede |
| `JUROR` | Tiene ficha de jurado con asignación en el concurso FotoRank vinculado (`ClickatonEdition.fotorankContestId`) | Nombre y foto del padrón de jurados |

Si no califica en ninguno, la pantalla lo dice y no guarda nada. El nombre, la
foto y el enlace **no se toman del formulario**: salen de lo que ya está
guardado. Lo único que el autor escribe es su texto y, opcionalmente, un enlace
propio.

<!-- La propiedad de lectura no alcanza para escribir: el match por email sólo
     vale si la sesión tiene el email verificado. -->
El cruce por correo exige `User.emailVerified`. Una sesión con correo sin
verificar sólo califica por `userId`.

### 4. Una respuesta por persona y por edición

`@@unique([editionId, userId])` en `ClickatonSurveyResponse`. Si vuelve a
entrar, el formulario se abre con lo que había contestado y **edita** en lugar
de duplicar. Editar un testimonio ya publicado lo devuelve a `PENDING`: cambia
el texto, vuelve a pasar por moderación.

### 5. El panel: "Testimonios y calidad"

Entrada nueva en `adminNavigation`, sección `main`, ruta
`/admin/testimonios`.

**Tablero** (`/admin/testimonios`)

- NPS de la edición: promotores (9-10), pasivos (7-8), detractores (0-6), y el
  número final = `%promotores − %detractores`.
- Promedio por aspecto, con la cantidad de respuestas que lo puntuaron (las
  "No aplica" no promedian y se informan aparte).
- Porcentaje que volvería a participar.
- Tasa de respuesta: invitados contra respondidos.
- Comparativa entre ediciones en una tabla.

**Bandeja** (`/admin/testimonios/respuestas`)

Todas las respuestas, filtrables por edición, rol y estado: pendiente,
publicado, rechazado, sin consentimiento. Buscador por nombre o texto.

**Ficha** (`/admin/testimonios/respuestas/[id]`)

Todo lo que contestó, la crítica privada, y las acciones: **Publicar**,
**Rechazar**, **Despublicar**. Ahí se elige el `highlightedExcerpt`: el recorte
entre comillas que sale en la home, prellenado con el texto completo si entra en
el límite. Nada llega al público sin ese paso — `PENDING` es el estado inicial
siempre.

**Botón "Invitar a testimoniar"** por edición (masivo) y por inscripción
(individual, desde la ficha de inscripción existente), con reenvío.

### 6. La home y las fichas de edición

Componente `ParticipantVoices` — **"Lo que dicen los participantes"**:

- Cita entre comillas, foto redonda, nombre + rol + edición.
- Al hacer clic abre el Instagram o el sitio del autor, en pestaña nueva, con
  `rel="noopener noreferrer nofollow"`.
- Sólo testimonios `PUBLISHED`.
- **Si hay menos de tres publicados, la sección no se dibuja.** Nada de
  testimonios de relleno ni de carteles de "próximamente".

Va en la home (`app/(public)/page.tsx`, entre `Community` y
`VenueProgramSection`) y en la ficha de cada maratón filtrado por esa edición.

### 7. Las fotos: por qué hace falta una ruta nueva

Hoy la allowlist de `/api/media` (`lib/content/public-media-keys.ts`) deja fuera
el namespace `profile` a propósito: las fotos de perfil de los participantes
**no son públicas**.

No se toca esa allowlist. En su lugar:

```
GET /api/public/testimonios/[testimonialId]/foto
```

Sirve la imagen **sólo** si ese testimonio está `PUBLISHED` y tiene
`publicationConsent`. La llave es la publicación, no la clave del archivo. El
resto de las fotos de perfil siguen sin ser accesibles, y despublicar un
testimonio corta el acceso a su foto en el mismo acto.

Si el autor no tiene foto, se muestran sus iniciales. No se bloquea el
testimonio por falta de foto.

### 8. El correo post-evento

- Plantilla `CLICKATON_TESTIMONIAL_INVITE`, versión `v1`, sobre
  `enqueueAndSendIdempotentEmail`.
- Clave de idempotencia: `${inviteId}:CLICKATON_TESTIMONIAL_INVITE:v1`.
- Proceso programado `/api/cron/testimonial-invites`, diario. Busca ediciones
  con `testimonialsEnabled = true` cuyo `endAt` sea anterior a
  `ahora − testimonialInviteDelayDays` (por defecto 2), y encola una invitación
  por participante confirmado y por sede activa que todavía no tenga una.
- Los jurados se invitan con el botón manual: su padrón vive en la base de
  FotoRank y la cantidad de fichas espejo depende de variables que hoy pueden
  estar sin cargar. Automatizar sobre eso sería prometer un correo que no sale.
- El enlace lleva a `/maratones/<slug>/testimonio`. Sin sesión, al login con
  retorno al formulario.
- Las inscripciones con `isOpsTest = true` y las ediciones `isOpsFixture` no
  reciben nada.

### 9. Los dos interruptores

En `ClickatonEdition`:

- `testimonialsEnabled Boolean @default(false)` — abre el formulario y habilita
  las invitaciones de esa edición.
- `testimonialInviteDelayDays Int @default(2)` — cuántos días después del cierre
  sale el correo.

Nace apagado. Encender el módulo son dos cosas: el código desplegado y la
columna aplicada en la base.

## Modelo de datos

```prisma
enum ClickatonTestimonialAuthorRole { PARTICIPANT JUROR VENUE }

enum ClickatonTestimonialStatus { PENDING PUBLISHED REJECTED }

enum ClickatonSurveyWouldReturn { YES MAYBE NO }

enum ClickatonTestimonialInviteStatus { PENDING SENT FAILED RESPONDED }
```

`ClickatonSurveyResponse`
: `id`, `editionId`, `userId`, `authorRole`, `registrationId?`, `venueId?`,
  `npsScore` (0-10), las siete notas `Int?` (1-5), `wouldReturn`,
  `improvementNotes String?`, `submittedAt`, `updatedAt`, `auditIp?`,
  `auditUserAgent?`.
  `@@unique([editionId, userId])`, índices por `editionId`, `authorRole`,
  `npsScore`.

`ClickatonTestimonial`
: `id`, `surveyResponseId` (único), `editionId`, `authorRole`, `userId`,
  `quote`, `highlightedExcerpt String?`, `status`, `publicationConsent`,
  `consentAcceptedAt`, `authorName`, `authorPhotoAssetId String?`,
  `authorLinkUrl String?`, `displayOrder Int @default(0)`,
  `isFeatured Boolean @default(false)`, `publishedAt?`, `moderatedByUserId?`,
  `moderationNotes String?`.
  Índices por `[editionId, status]`, `[status, displayOrder]`.

`ClickatonTestimonialInvite`
: `id`, `editionId`, `authorRole`, `email`, `userId?`, `registrationId?`,
  `venueId?`, `status`, `sentAt?`, `respondedAt?`, `emailQueueId Int?`,
  `idempotencyKey String @unique`, `createdAt`.
  `@@unique([editionId, email])`, índice por `[editionId, status]`.

Todas las relaciones a `ClickatonEdition` con `onDelete: Restrict`, igual que el
resto del esquema de Clickatón.

## Cómo se aplica en la base

El deploy de Clickatón **no corre `prisma migrate deploy`**. La migración se
escribe como archivo SQL en `packages/db/prisma/migrations/` y se aplica a mano
sobre la base de Clickatón, registrándola después en `_prisma_migrations` con el
checksum correcto.

Esto no es opcional ni postergable: si las columnas nuevas de `ClickatonEdition`
no están aplicadas, **no falla sólo la pantalla nueva — falla toda lectura de
`ClickatonEdition`**, porque el cliente de Prisma pide todas las columnas que
declara el esquema. Sin el SQL aplicado, Clickatón se cae entero.

El SQL queda en el repositorio y el paso de aplicación se informa como pendiente
al entregar.

## Qué queda afuera (a propósito)

- **Página propia `/testimonios`** con listado paginado y SEO. Se puede sumar
  después sin tocar el modelo.
- **Respuestas anónimas.** Todo testimonio tiene autor identificado con sesión;
  es lo que le da valor.
- **Publicar la crítica constructiva.** Nunca, en ninguna condición.
- **Recordatorio de segunda vuelta** a quien no respondió. El primer correo se
  manda; insistir es una decisión comercial, no técnica.
- **Traducción o edición del texto del autor.** El admin elige el recorte que
  publica, no reescribe lo que el autor dijo.

## Verificación

- Pruebas unitarias del cálculo de NPS, del promedio por aspecto con "No
  aplica", del recorte del fragmento y de la normalización/validación del
  enlace.
- Pruebas del resolutor de elegibilidad para los tres roles, incluido el caso
  de correo sin verificar.
- Prueba de que la home no dibuja la sección con menos de tres publicados.
- Prueba de que la ruta de foto responde 404 para un testimonio que no está
  publicado.
- `pnpm --filter clickaton typecheck`, `test` y `build` en verde antes de
  entregar.
