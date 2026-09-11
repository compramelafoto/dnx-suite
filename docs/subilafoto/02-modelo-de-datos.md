# Modelo de datos

Responde a los capítulos 25 y 6.4 del documento maestro. Va sobre el schema compartido
(`packages/db/prisma/schema.prisma`), con prefijo `Subilafoto` siguiendo la convención de
`Fotoffice*`, `Clickaton*`, `Fotorank*` e `InfoSpot*`.

Son **19 modelos nuevos y 9 enums nuevos**, más un valor agregado a un enum existente.

## Una corrección al documento maestro

El capítulo 6.4 propone 16 estados en una sola lista: `DRAFT`, `READY_TO_SELL`,
`PAYMENT_PENDING`, `PAID`, `CONFIGURING`, `DEMO_READY`, `SCHEDULED`, `ACTIVE`,
`FINALIZING`, `DOWNLOAD_OFFERED`, `DOWNLOAD_PURCHASED`, `COMPLETED`, `ARCHIVED`,
`CANCELLED`, `REFUNDED`, `PAYMENT_DISPUTED`.

Mezclan tres cosas distintas: el estado del cobro, el estado del evento y el derecho de
descarga. Un evento puede estar `ACTIVE` y `DOWNLOAD_PURCHASED` al mismo tiempo — un enum
único no puede representarlo. La propuesta los separa en tres ejes que sí pueden convivir:

| Eje | Enum | Valores |
|---|---|---|
| Ciclo del evento | `SubilafotoEventStatus` | `CONFIGURING`, `SCHEDULED`, `ACTIVE`, `CLOSED`, `ARCHIVED`, `CANCELLED` |
| Cobro | `SubilafotoOrderStatus` | `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `DISPUTED` |
| Descarga | `SubilafotoDownloadStatus` | `NOT_OFFERED`, `OFFERED`, `PURCHASED`, `DELIVERED`, `EXPIRED` |

`DEMO_READY` no es un estado: es el flag `demoTestedAt`. `READY_TO_SELL` tampoco: es que el
perfil del vendedor tenga precio y Mercado Pago conectado.

## Comercial

```prisma
/// Perfil de venta del profesional. Su enlace permanente: subilafoto.com/v/[slug]
model SubilafotoSellerProfile {
  id                  String   @id @default(cuid())
  userId              Int
  workspaceId         String?
  slug                String   @unique
  displayName         String
  headline            String?
  description         String?  @db.Text
  logoUrl             String?
  coverUrl            String?
  brandColor          String?
  // Oferta comercial
  basePriceCents      Int
  currency            String   @default("ARS")
  downloadMode        SubilafotoDownloadMode @default(PERCENT)
  downloadPercentBps  Int?     @default(1500) // 15,00 %
  downloadPriceCents  Int?
  termsText           String?  @db.Text
  // Estado
  isPublished         Boolean  @default(false)
  mpConnected         Boolean  @default(false)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  user     User                @relation(fields: [userId], references: [id], onDelete: Cascade)
  events   SubilafotoEvent[]
  orders   SubilafotoOrder[]

  @@index([userId])
  @@index([isPublished])
}

/// Venta del evento. El evento se crea recién cuando esta orden queda PAID.
model SubilafotoOrder {
  id                  String   @id @default(cuid())
  sellerProfileId     String
  eventId             String?  @unique
  kind                SubilafotoOrderKind        // EVENT | DOWNLOAD_ADDON
  status              SubilafotoOrderStatus      @default(PENDING)
  // Quién compra
  buyerEmail          String
  buyerName           String
  buyerPhone          String?
  // Plata, en centavos. Nada de decimales flotantes.
  amountCents         Int
  currency            String   @default("ARS")
  platformFeeBps      Int                        // congelado al momento de la venta
  platformFeeCents    Int
  sellerNetCents      Int
  // Mercado Pago
  mpPreferenceId      String?
  mpPaymentId         String?  @unique
  mpCollectorId       String?
  paidAt              DateTime?
  refundedAt          DateTime?
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  sellerProfile SubilafotoSellerProfile @relation(fields: [sellerProfileId], references: [id])
  event         SubilafotoEvent?        @relation(fields: [eventId], references: [id])

  @@index([status, kind])
  @@index([buyerEmail])
}
```

`platformFeeBps` se guarda **en la orden**, no se lee de la configuración global al
liquidar. Si mañana la comisión cambia del 15% al 12%, las ventas viejas siguen valiendo lo
que valían. Sin esto, cambiar un número en un panel reescribe la historia contable.

Los importes van en centavos enteros (`Int`), nunca en `Float`. Es la regla que ya siguen
los pagos de CompraMeLaFoto.

## El evento

```prisma
model SubilafotoEvent {
  id                String   @id @default(cuid())
  sellerProfileId   String
  code              String   @unique          // el del QR del invitado
  screenCode        String   @unique          // el de la pantalla: distinto a propósito
  slug              String?  @unique
  // Datos
  name              String
  eventType         SubilafotoEventType
  description       String?  @db.Text
  hostsLabel        String?
  venueName         String?
  venueAddress      String?
  venueMapUrl       String?
  timezone          String   @default("America/Argentina/Buenos_Aires")
  // La ventana de 12 horas
  activationAt      DateTime?
  windowHours       Int      @default(12)
  deactivationAt    DateTime?                 // calculado, guardado, nunca inferido al vuelo
  status            SubilafotoEventStatus @default(CONFIGURING)
  closedAt          DateTime?
  // Demo
  demoTestedAt      DateTime?
  demoPurgedAt      DateTime?
  // Visual
  templateId        String?
  themeTokens       Json?                     // snapshot: la plantilla puede cambiar después
  coverUrl          String?
  closingCardText   String?
  // Participación
  allowPhotos       Boolean  @default(true)
  allowVideos       Boolean  @default(false)
  allowMessages     Boolean  @default(true)
  askGuestName      Boolean  @default(true)
  allowAnonymous    Boolean  @default(true)
  maxUploadsPerGuest Int?    @default(30)
  // Privacidad
  visibility        SubilafotoVisibility @default(LINK_ONLY)
  accessCode        String?
  guestsCanSeeAlbum Boolean  @default(true)
  guestsCanDownload Boolean  @default(false)
  // Moderación
  moderationProfile SubilafotoModerationProfile @default(SOCIAL)
  // Descarga y retención
  downloadStatus    SubilafotoDownloadStatus @default(NOT_OFFERED)
  retentionUntil    DateTime?
  purgedAt          DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  sellerProfile SubilafotoSellerProfile      @relation(fields: [sellerProfileId], references: [id])
  template      SubilafotoTemplate?          @relation(fields: [templateId], references: [id])
  order         SubilafotoOrder?
  media         SubilafotoMedia[]
  guests        SubilafotoGuestSession[]
  screens       SubilafotoScreen[]
  collaborators SubilafotoCollaborator[]
  links         SubilafotoAccessLink[]
  vendors       SubilafotoEventVendor[]
  packages      SubilafotoPackage[]
  consents      SubilafotoConsent[]
  audits        SubilafotoAudit[]

  @@index([status, activationAt])
  @@index([sellerProfileId])
  @@index([retentionUntil])
}
```

`deactivationAt` se **calcula y se guarda** al configurar. No se recalcula al vuelo sumando
12 horas, porque el horario de verano y los cambios de zona harían que el mismo evento
cierre a horas distintas según cuándo se lo consulte.

`themeTokens` es una copia congelada de la plantilla. Si se corrige una plantilla del
catálogo en octubre, los eventos de septiembre no cambian de aspecto solos.

## Contenido y moderación

```prisma
model SubilafotoMedia {
  id             String   @id @default(cuid())
  eventId        String
  guestSessionId String?
  kind           SubilafotoMediaKind @default(PHOTO)
  origin         SubilafotoMediaOrigin @default(GUEST)
  status         SubilafotoMediaStatus @default(UPLOADING)
  isDemo         Boolean  @default(false)
  // Archivos: el original nunca es público
  originalKey    String
  originalBytes  Int?
  width          Int?
  height         Int?
  contentType    String?
  checksum       String?
  // Autor
  guestName      String?
  caption        String?  @db.Text
  // Presentación
  isFeatured     Boolean  @default(false)
  hiddenAt       DateTime?
  hiddenByUserId Int?
  publishedAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  event      SubilafotoEvent            @relation(fields: [eventId], references: [id], onDelete: Cascade)
  guest      SubilafotoGuestSession?    @relation(fields: [guestSessionId], references: [id])
  variants   SubilafotoMediaVariant[]
  moderation SubilafotoModerationDecision[]

  @@unique([eventId, checksum])   // duplicados: la misma foto no entra dos veces
  @@index([eventId, status, publishedAt])
  @@index([status, createdAt])    // la cola de moderación
}

/// Una fila por intento de análisis. Nunca se pisa: es la auditoría de la IA.
model SubilafotoModerationDecision {
  id            String   @id @default(cuid())
  mediaId       String
  provider      String                    // "aws-rekognition"
  providerModel String?
  policyVersion String                    // qué reglas se aplicaron
  profile       SubilafotoModerationProfile
  decision      SubilafotoMediaStatus     // APPROVED | REVIEW_REQUIRED | BLOCKED
  labels        Json?                     // etiquetas y puntajes crudos
  topLabel      String?
  topConfidence Float?
  latencyMs     Int?
  errorCode     String?
  attempt       Int      @default(1)
  decidedAt     DateTime @default(now())
  // Intervención humana
  overriddenBy  Int?
  overrideReason String? @db.Text
  overriddenAt  DateTime?

  media SubilafotoMedia @relation(fields: [mediaId], references: [id], onDelete: Cascade)

  @@index([mediaId, decidedAt])
  @@index([decision, decidedAt])
}
```

La regla de oro del capítulo 10.2, expresada en el modelo: `SubilafotoMediaStatus` arranca
en `UPLOADING`, pasa a `PROCESSING`, y **sólo** `APPROVED` con `publishedAt` no nulo puede
llegar a la pantalla. Si Rekognition falla, la foto queda en `REVIEW_REQUIRED`. No hay
ningún camino en el que un error técnico publique algo.

```prisma
enum SubilafotoMediaStatus {
  UPLOADING
  PROCESSING
  APPROVED
  REVIEW_REQUIRED
  BLOCKED
  HIDDEN          // aprobada y luego ocultada a mano
  DELETED
}
```

## Invitados, pantallas y accesos

```prisma
/// El invitado no tiene cuenta. Esto es una cookie firmada, no un usuario.
model SubilafotoGuestSession {
  id           String   @id @default(cuid())
  eventId      String
  token        String   @unique
  displayName  String?
  contactEmail String?
  contactPhone String?
  isDemo       Boolean  @default(false)
  uploadCount  Int      @default(0)
  ipHash       String?          // hash, no la IP: para límites, no para identificar
  userAgent    String?
  firstSeenAt  DateTime @default(now())
  lastSeenAt   DateTime @updatedAt

  event SubilafotoEvent   @relation(fields: [eventId], references: [id], onDelete: Cascade)
  media SubilafotoMedia[]

  @@index([eventId, lastSeenAt])
}

model SubilafotoScreen {
  id           String   @id @default(cuid())
  eventId      String
  label        String?
  pairingCode  String   @unique
  mode         SubilafotoScreenMode @default(FULL_PHOTO)
  isPaused     Boolean  @default(false)
  showQr       Boolean  @default(true)
  speedMs      Int      @default(6000)
  lastSeenAt   DateTime?
  connectedAt  DateTime?
  createdAt    DateTime @default(now())

  event SubilafotoEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId])
}

/// QR y enlaces. Un mismo evento tiene varios, con permisos distintos.
model SubilafotoAccessLink {
  id         String   @id @default(cuid())
  eventId    String
  kind       SubilafotoLinkKind      // GUEST | SCREEN | DEMO_GUEST | DEMO_SCREEN | VENDOR | CLIENT
  token      String   @unique
  label      String?
  expiresAt  DateTime?
  revokedAt  DateTime?
  usageCount Int      @default(0)
  createdAt  DateTime @default(now())

  event SubilafotoEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId, kind])
}
```

## Descarga, retención y consentimiento

```prisma
model SubilafotoPackage {
  id             String   @id @default(cuid())
  eventId        String
  status         SubilafotoPackageStatus @default(QUEUED)
  partIndex      Int      @default(1)
  partCount      Int      @default(1)
  storageKey     String?
  bytes          BigInt?
  itemCount      Int?
  manifest       Json?
  checksum       String?
  downloadToken  String?  @unique
  tokenExpiresAt DateTime?
  regenerations  Int      @default(0)
  error          String?  @db.Text
  startedAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime @default(now())

  event SubilafotoEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId, status])
}

/// Qué aceptó cada quién y cuándo. Es prueba, no configuración.
model SubilafotoConsent {
  id             String   @id @default(cuid())
  eventId        String
  guestSessionId String?
  subjectEmail   String?
  kind           SubilafotoConsentKind   // TERMS | PROMOTIONAL_USE | MINOR_AUTHORIZATION
  documentVersion String
  accepted       Boolean
  ipHash         String?
  acceptedAt     DateTime @default(now())

  event SubilafotoEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@index([eventId, kind])
}
```

El consentimiento promocional va **separado** del de términos, como pide el capítulo 7.3.
Aceptar para participar no es autorizar que la foto salga en la publicidad del fotógrafo.

## Proveedores

```prisma
/// El vínculo con el evento. Los datos de la empresa viven en DnxPartner, no acá.
model SubilafotoEventVendor {
  id            String   @id @default(cuid())
  eventId       String
  partnerId     String                    // -> DnxPartner
  category      String
  roleNote      String?
  invitedAt     DateTime?
  completedAt   DateTime?
  invitationToken String? @unique
  createdAt     DateTime @default(now())

  event SubilafotoEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([eventId, partnerId])
  @@index([partnerId])
}
```

Esto cumple literalmente el cierre del capítulo 25: *"evitar almacenar datos globales del
proveedor dentro del vínculo con cada evento"*. El salón que trabaja en 40 eventos es **un**
`DnxPartner` con 40 vínculos, no 40 copias con el CUIT mal tipeado de formas distintas.

## Colaboradores y auditoría

```prisma
model SubilafotoCollaborator {
  id        String   @id @default(cuid())
  eventId   String
  userId    Int?
  email     String?
  role      SubilafotoCollaboratorRole
  invitedAt DateTime @default(now())
  acceptedAt DateTime?
  revokedAt DateTime?

  event SubilafotoEvent @relation(fields: [eventId], references: [id], onDelete: Cascade)

  @@unique([eventId, userId])
  @@index([eventId, role])
}

model SubilafotoAudit {
  id         String   @id @default(cuid())
  eventId    String?
  actorUserId Int?
  actorKind  String                     // "user" | "guest" | "system" | "webhook"
  action     String                     // "media.override", "event.window.changed", ...
  targetType String?
  targetId   String?
  metadata   Json?
  ipHash     String?
  createdAt  DateTime @default(now())

  event SubilafotoEvent? @relation(fields: [eventId], references: [id])

  @@index([eventId, createdAt])
  @@index([action, createdAt])
}
```

## Cambio en un enum existente

```prisma
enum SuiteApp {
  FOTOFFICE
  COMPRAMELAFOTO
  FOTORANK
  SUBILAFOTO   // nuevo
}
```

Agregar un valor a un enum de Postgres es una operación segura y no bloqueante. Es el único
cambio a algo que ya está en producción. Todo lo demás son tablas nuevas, que no pueden
romper a las otras aplicaciones.
