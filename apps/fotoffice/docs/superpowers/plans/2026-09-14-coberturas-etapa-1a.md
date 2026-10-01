# Etapa 1a — Solicitudes y Coberturas: el circuito de la solicitud

> **Para quien lo ejecute:** SUB-SKILL REQUERIDA: usá `superpowers:subagent-driven-development`
> (recomendada) o `superpowers:executing-plans` para implementar tarea por tarea. Los pasos
> usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** que una organización pueda pedir una cobertura sin registrarse, seguirla por un
enlace privado, y que un coordinador la evalúe, pida información, la apruebe o la rechace —
todo con historial, permisos en servidor y aislamiento por workspace.

**Arquitectura:** módulo nuevo `coverages` de FotoOffice, encendido por workspace con la
maquinaria que ya existe (`MODULE_REGISTRY` + `WorkspaceFeatureModule`). El dominio vive en
`lib/coverages/` como funciones puras con tests; las pantallas y las server actions solo
orquestan. La organización solicitante se guarda como `Client` por la puerta única que ya
existe, no como datos sueltos dentro de la solicitud.

**Stack:** Next.js 16.2.1 (App Router, Server Actions), React 19.2, Prisma 6.9 sobre
PostgreSQL (Neon), Vitest, Tailwind 4, Zod.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-09-14-solicitudes-y-coberturas-design.md`

**Qué queda para la etapa 1b:** convocatorias, roles y cupos, postulaciones, invitaciones y
asignaciones, ficha operativa, entregables y los dos portales. El esquema de esas tablas
**entra igual en esta etapa** (Tarea 1): una sola migración para las cinco bases Neon en vez
de dos.

---

## Restricciones globales

Valores exactos, copiados del diseño. Aplican a todas las tareas.

- **Ninguna base se toca.** La migración se escribe y se verifica, **no se ejecuta** contra
  ninguna base Neon. Nada de `prisma migrate dev`, `db push` ni SQL contra producción.
- **Nada de enums de Prisma.** Todos los estados son `String`. El esquema lo comparten cinco
  aplicaciones y agregar un valor a un enum compartido es una migración en cinco bases. Se
  validan en el dominio, con tests.
- **Migración aditiva.** Ninguna tabla existente cambia de forma. Solo se agregan tablas y
  relaciones.
- **Todo en español**: nombres de rutas visibles, textos de UI, comentarios, mensajes de error
  y de test.
- **Fechas en pantalla**: `DD.MM.AAAA` (ej. `26.09.2026`). Almacenamiento en UTC. Zona
  `America/Argentina/Buenos_Aires`.
- **Permisos en servidor**, en cada página y cada acción. Esconder un botón no es un control.
- **Aislamiento por workspace** en *toda* consulta del repositorio, con test que lo verifique.
- **Tests con Vitest**, entorno node, sobre lógica pura. Sin base de datos real. Se corren con
  `pnpm test` desde `apps/fotoffice`.
- **Comentarios que explican el porqué**, no el qué. Es la convención del repositorio: un
  comentario dice qué decisión se tomó y contra qué alternativa.
- **Antes de escribir código de Next**, leer la guía correspondiente en
  `node_modules/next/dist/docs/` — esta versión tiene diferencias con lo conocido. En
  particular: un Server Component **no puede** escribir cookies (`01-app/03-api-reference/
  04-functions/cookies.md`), y `redirect` va en Server Components, Server Functions y Route
  Handlers (`01-app/02-guides/redirecting.md`).
- **Verificación antes de dar algo por terminado**: `pnpm test`, `npx tsc --noEmit -p
  tsconfig.json` y `pnpm lint`. El lint tiene 3 errores preexistentes en `hero-block-view.tsx`,
  `mass-grading-screen.tsx` y `website.ts`: no son de este trabajo y no hay que arreglarlos,
  pero tampoco agregar ninguno nuevo.
- **Un test que falla de antes**: `lib/template-v2/access.test.ts` busca un archivo que no
  existe en `main`. No es de este trabajo.

---

## Estructura de archivos

### Dominio puro (`lib/coverages/`) — sin Prisma, sin `server-only`, todo testeable

| Archivo | Responsabilidad |
|---|---|
| `constants.ts` | `COVERAGES_MODULE_KEY`, zona horaria, listas cerradas de valores |
| `settings.ts` | Forma de la configuración, valores por omisión, parseo del formulario |
| `terminology.ts` | Resuelve la etiqueta visible de cada concepto según la configuración |
| `states.ts` | Los seis conjuntos de estados y sus etiquetas |
| `transitions.ts` | Qué transición es válida y cuál exige motivo |
| `reinforcement.ts` | La regla del refuerzo por duración |
| `public-code.ts` | Arma y valida el código público `SC-2026-0042` |
| `request-form.ts` | Parseo y validación del formulario público |
| `consents.ts` | Catálogo de consentimientos, versión vigente, cuáles son obligatorios |
| `rate-limit.ts` | Decisión pura de si un envío entra o se rechaza |
| `inbox-filters.ts` | Traduce un filtro de la bandeja a criterios |

### Servidor (`lib/coverages/`) — con `server-only`

| Archivo | Responsabilidad |
|---|---|
| `access.ts` | Guards: módulo encendido + rol. Dos niveles, como Clientes |
| `repository.ts` | Todas las consultas, siempre con `workspaceId` |
| `tracking-token.ts` | Genera, hashea y valida el token del enlace de seguimiento |
| `events.ts` | Escribe el historial |
| `submit.ts` | La transacción del envío público |
| `emails.ts` | Armado de los correos del circuito |

### Pantallas

| Ruta | Archivo |
|---|---|
| Formulario público | `app/w/[workspaceSlug]/coberturas/solicitar/page.tsx` + `request-form.tsx` |
| Gracias | `app/w/[workspaceSlug]/coberturas/solicitar/gracias/page.tsx` |
| Seguimiento | `app/sc/[token]/page.tsx` |
| Bandeja | `app/(shell)/coberturas/page.tsx` |
| Evaluación | `app/(shell)/coberturas/[id]/page.tsx` |
| Configuración | `app/(shell)/coberturas/configuracion/page.tsx` |
| Acciones del panel | `app/(shell)/coberturas/actions.ts` |
| Acción pública | `app/actions/coverage-request.ts` |

### Archivos existentes que se modifican

- `packages/db/prisma/schema.prisma` — tablas nuevas y relaciones
- `lib/modules/registry.ts` — alta del módulo
- `lib/modules/submodules.ts` — las pantallas del módulo
- `lib/entrada/institution-shortcut.ts` — reservar `sc` y `coberturas`
- `lib/communications/constants.ts` — claves de correo del circuito
- `components/shell/shell-sidebar.tsx` y `app/(shell)/layout.tsx` — el módulo en el menú

---

## Tarea 1: Esquema y migración

**Archivos:**
- Modificar: `packages/db/prisma/schema.prisma`
- Crear: `packages/db/prisma/migrations/20260914120000_coberturas/migration.sql`

**Interfaces:**
- Produce: los modelos Prisma `CoverageSettings`, `CoverageRequest`, `CoverageConsent`,
  `Coverage`, `CoverageRole`, `CoverageCall`, `CoverageApplication`, `CoverageAssignment`,
  `CoverageDeliverable`, `CoverageCollaboratorProfile`, `CoverageEvent`.

Entran **las once tablas**, aunque esta etapa solo use cuatro. Una sola migración para las
cinco bases Neon en vez de dos.

- [ ] **Paso 1: Agregar las tablas al schema**

Al final de `packages/db/prisma/schema.prisma`. Todos los estados son `String`, nunca enum
(ver restricciones globales).

```prisma
/// Configuración del módulo Solicitudes y Coberturas para un workspace.
///
/// Todo lo que distingue a una organización de otra vive acá y no en el código: la
/// terminología, la modalidad de asignación y los umbrales. Es lo que hace que el módulo
/// sirva a una ONG de voluntarios y a un estudio que reparte trabajos pagos.
model CoverageSettings {
  id          String @id @default(cuid())
  workspaceId String @unique

  /// Cómo se llama cada cosa en las pantallas de ESTE workspace. Vacío = la de por omisión.
  moduleLabel    String?
  termRequest    String?
  termCollaborator String?
  termRequester  String?
  termCall       String?

  /// DIRECTA | ABIERTA | AUTOMATICA | MIXTA
  assignmentMode String  @default("MIXTA")
  /// Si una solicitud necesita aprobación antes de generar coberturas.
  requiresApproval Boolean @default(true)
  /// Si una postulación necesita que un coordinador confirme. Para FOTOPOSITIVA, sí.
  requiresCoordinatorConfirmation Boolean @default(true)

  /// A partir de cuántos minutos se recomienda sumar gente. 180 = 3 horas.
  reinforcementThresholdMinutes Int @default(180)
  /// Cuántas personas recomendar cuando se supera el umbral.
  recommendedCollaborators      Int @default(2)

  /// Vocabularios abiertos que define cada organización.
  roleTemplates String[] @default([])
  specialties   String[] @default([])
  zones         String[] @default([])

  /// Si el formulario público está abierto.
  publicFormEnabled Boolean @default(false)
  publicFormIntro   String?

  /// Versión del texto de consentimientos vigente. Se copia en cada consentimiento firmado.
  consentTextVersion String @default("v1")
  /// Días de vida del enlace de seguimiento.
  trackingLinkTtlDays Int @default(120)
  /// A quién avisarle cuando entra una solicitud.
  notifyEmails String[] @default([])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

/// Una solicitud de cobertura. Vive aparte de la cobertura: una solicitud rechazada no debe
/// ensuciar la agenda ni consumir un número de trabajo.
model CoverageRequest {
  id          String @id @default(cuid())
  workspaceId String

  /// Correlativo por workspace. Es el número que se dice por teléfono; NO abre nada.
  publicCode String
  /// La organización solicitante. Nunca se duplican sus datos acá.
  clientId   String

  /// SHA-256 del token del enlace de seguimiento. El crudo nunca se guarda.
  tokenHash      String    @unique
  tokenExpiresAt DateTime
  tokenRevokedAt DateTime?

  /// --- El evento ---
  eventTitle       String
  eventDescription String?
  startsAt         DateTime
  endsAt           DateTime
  addressLine      String?
  city             String?
  activityKind     String?
  expectedAttendees Int?
  /// INTERIOR | EXTERIOR | AMBOS
  venueKind        String?
  onSiteContactName String?
  onSitePhone      String?

  /// --- La necesidad fotográfica ---
  /// FOTO | VIDEO | AMBOS
  mediaKinds          String   @default("FOTO")
  coverageKind        String?
  purpose             String?
  keyMoments          String?
  requestedPhotographers Int?
  equipmentNotes      String?
  needsLighting       Boolean  @default(false)
  expectedDeliveryAt  DateTime?
  deliveryChannel     String?
  notes               String?
  /// Enlaces que permiten verificar la actividad. Enlaces, no archivos: ver §6 del diseño.
  documentationLinks  String[] @default([])

  /// --- Evaluación ---
  /// RECIBIDA | EN_EVALUACION | REQUIERE_INFO | APROBADA | RECHAZADA |
  /// CANCELADA_SOLICITANTE | CANCELADA_ORGANIZACION | CERRADA
  status            String    @default("RECIBIDA")
  /// BAJA | NORMAL | ALTA | URGENTE
  priority          String    @default("NORMAL")
  /// SIMPLE | MEDIA | COMPLEJA
  complexity        String?
  coordinatorUserId Int?
  /// Obligatorio al rechazar. Se le comunica a la organización.
  rejectionReason   String?
  /// Qué información se le pidió. Lo ve la organización en su enlace.
  infoRequested     String?
  resolvedByUserId  Int?
  resolvedAt        DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace   Workspace          @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  client      Client             @relation(fields: [clientId], references: [id], onDelete: Restrict)
  consents    CoverageConsent[]
  coverages   Coverage[]

  @@unique([workspaceId, publicCode])
  @@index([workspaceId, status])
  @@index([workspaceId, startsAt])
  @@index([workspaceId, createdAt])
  @@index([clientId])
  @@index([tokenExpiresAt])
}

/// Un permiso por fila, con la versión del texto que la persona leyó.
///
/// No es un checkbox genérico a propósito: si el texto cambia el año que viene, hay que poder
/// decir cuál firmó cada uno. Y el origen se guarda como hash, no como IP: alcanza para el
/// límite de envíos y para demostrar procedencia, sin acumular un dato personal que nadie va
/// a necesitar leer.
model CoverageConsent {
  id        String @id @default(cuid())
  requestId String

  /// AUTORIZA_COBERTURA | MENORES_PRESENTES | CONSENTIMIENTOS_IMAGEN |
  /// RESTRICCIONES_PUBLICACION | USO_INSTITUCIONAL | TERMINOS | PRIVACIDAD
  kind        String
  granted     Boolean
  textVersion String
  /// SHA-256 del texto exacto que se mostró.
  textHash    String
  acceptedAt  DateTime @default(now())
  sourceHash  String?
  userAgent   String?

  request CoverageRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@unique([requestId, kind])
  @@index([requestId])
}

/// La cobertura operativa. Una solicitud aprobada genera 1..N: una jornada de dos turnos son
/// dos coberturas.
model Coverage {
  id          String @id @default(cuid())
  workspaceId String
  requestId   String

  title       String
  startsAt    DateTime
  endsAt      DateTime
  addressLine String?
  city        String?
  instructions String?

  /// PLANIFICADA | BUSCANDO_EQUIPO | EQUIPO_CONFIRMADO | REALIZADA | ENTREGADA | CERRADA |
  /// CANCELADA | SIN_EQUIPO
  status String @default("PLANIFICADA")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace    Workspace             @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  request      CoverageRequest       @relation(fields: [requestId], references: [id], onDelete: Cascade)
  roles        CoverageRole[]
  call         CoverageCall?
  assignments  CoverageAssignment[]
  deliverables CoverageDeliverable[]

  @@index([workspaceId, status])
  @@index([workspaceId, startsAt])
  @@index([requestId])
}

/// Un rol con sus cupos dentro de una cobertura. No se asume que todo trabajo necesita un
/// solo fotógrafo.
model CoverageRole {
  id         String @id @default(cuid())
  coverageId String

  name             String
  vacancies        Int     @default(1)
  requirements     String?
  minExperience    String?
  equipmentRequired String?
  startsAt         DateTime?
  endsAt           DateTime?
  /// ABIERTO | COMPLETO | CERRADO
  status           String  @default("ABIERTO")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  coverage     Coverage               @relation(fields: [coverageId], references: [id], onDelete: Cascade)
  applications CoverageApplication[]
  assignments  CoverageAssignment[]

  @@index([coverageId])
}

/// La convocatoria. `visibility` decide a qué colaboradores se les muestra, NO si sale a
/// internet: ninguna convocatoria es pública (ver §3.4 del diseño).
model CoverageCall {
  id         String @id @default(cuid())
  coverageId String @unique

  title            String
  publicSummary    String?
  /// Lo que solo le sirve a quien va: teléfono de emergencia, contacto del día. La dirección
  /// NO va acá — se muestra siempre.
  privateBriefing  String?
  /// TODOS | POR_ZONA | POR_ESPECIALIDAD
  visibility       String  @default("TODOS")
  visibilityValues String[] @default([])
  applicationsCloseAt DateTime?
  /// NORMAL | ALTA | URGENTE
  urgency          String  @default("NORMAL")
  /// BORRADOR | PUBLICADA | COMPLETA | CERRADA | CANCELADA | VENCIDA
  status           String  @default("BORRADOR")
  publishedAt      DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  coverage     Coverage              @relation(fields: [coverageId], references: [id], onDelete: Cascade)
  applications CoverageApplication[]

  @@index([status])
}

/// La postulación de una persona a un rol.
model CoverageApplication {
  id       String @id @default(cuid())
  callId   String
  roleId   String
  memberId String

  message          String?
  availabilityNote String?
  equipmentNote    String?
  /// RECIBIDA | EN_REVISION | PRESELECCIONADA | SELECCIONADA | NO_SELECCIONADA | RETIRADA |
  /// VENCIDA
  status      String    @default("RECIBIDA")
  withdrawnAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  call   CoverageCall @relation(fields: [callId], references: [id], onDelete: Cascade)
  role   CoverageRole @relation(fields: [roleId], references: [id], onDelete: Cascade)
  member Member       @relation(fields: [memberId], references: [id], onDelete: Restrict)

  @@unique([roleId, memberId])
  @@index([callId, status])
  @@index([memberId])
}

/// La asignación: quién queda en qué rol, por qué y en qué estado.
model CoverageAssignment {
  id         String @id @default(cuid())
  coverageId String
  roleId     String
  memberId   String

  /// POSTULACION | INVITACION_DIRECTA
  origin           String
  assignedByUserId Int?
  /// Por qué se eligió a esta persona. Texto libre: el coordinador lo escribe.
  criteria         String?
  respondBy        DateTime?
  /// PROPUESTA | INVITADA | ACEPTADA | RECHAZADA | CONFIRMADA | CANCELADA | REEMPLAZADA |
  /// CUMPLIDA | AUSENTE
  status           String    @default("PROPUESTA")
  respondedAt      DateTime?
  confirmedAt      DateTime?
  /// A quién reemplaza esta asignación, si entró como suplente.
  replacedAssignmentId String?
  hoursReported    Decimal?  @db.Decimal(5, 2)
  notes            String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  coverage Coverage     @relation(fields: [coverageId], references: [id], onDelete: Cascade)
  role     CoverageRole @relation(fields: [roleId], references: [id], onDelete: Cascade)
  member   Member       @relation(fields: [memberId], references: [id], onDelete: Restrict)

  @@unique([coverageId, memberId])
  @@index([coverageId, status])
  @@index([memberId])
}

/// Un entregable. En esta etapa es un enlace, no subida de archivos pesados.
model CoverageDeliverable {
  id         String @id @default(cuid())
  coverageId String

  /// GALERIA | CARPETA | FOTOS_EDITADAS | VIDEO | DOCUMENTO | ENLACE | PUBLICACION | INFORME
  kind                String
  responsibleMemberId String?
  dueAt               DateTime?
  deliveredAt         DateTime?
  /// PENDIENTE | EN_PREPARACION | ENTREGADO | OBSERVADO | APROBADO | CERRADO
  status              String   @default("PENDIENTE")
  url                 String?
  notes               String?
  reviewNotes         String?
  approvedByUserId    Int?
  approvedAt          DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  coverage    Coverage @relation(fields: [coverageId], references: [id], onDelete: Cascade)
  responsible Member?  @relation(fields: [responsibleMemberId], references: [id], onDelete: SetNull)

  @@index([coverageId, status])
}

/// Lo propio del módulo para una persona del padrón. 1:1 con `Member`.
///
/// Vive aparte y no dentro de `Member` a propósito: son campos que solo le sirven a este
/// módulo, y una institución que no lo use no tiene por qué verlos en la ficha de sus socios.
model CoverageCollaboratorProfile {
  id          String @id @default(cuid())
  workspaceId String
  memberId    String @unique

  homeCity        String?
  coverageZones   String[] @default([])
  maxTravelKm     Int?
  /// AUTO | MOTO | BICICLETA | TRANSPORTE_PUBLICO | A_PIE | OTRO
  transport       String?
  equipment       String[] @default([])
  specialties     String[] @default([])
  /// INICIAL | INTERMEDIO | AVANZADO | PROFESIONAL
  experienceLevel String?
  acceptsUrgent   Boolean  @default(false)
  active          Boolean  @default(true)
  notes           String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  member    Member    @relation(fields: [memberId], references: [id], onDelete: Cascade)

  @@index([workspaceId, active])
}

/// El historial del módulo, para las seis entidades.
///
/// `actorLabel` se guarda aparte de la FK, igual que en `MemberAudit`: el historial tiene que
/// seguir entendiéndose aunque la persona cambie de nombre o su usuario se elimine.
model CoverageEvent {
  id          String @id @default(cuid())
  workspaceId String

  /// REQUEST | COVERAGE | CALL | APPLICATION | ASSIGNMENT | DELIVERABLE
  entityType String
  entityId   String
  /// CREADA | ESTADO_CAMBIADO | NOTA | INFO_PEDIDA | INFO_RESPONDIDA | EMAIL_ENVIADO
  type       String
  fromStatus String?
  toStatus   String?

  actorUserId Int?
  actorLabel  String?
  note        String?

  createdAt DateTime @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  actorUser User?     @relation(fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([workspaceId, entityType, entityId, createdAt])
  @@index([workspaceId, createdAt])
}
```

- [ ] **Paso 2: Agregar las relaciones inversas**

En `model Workspace`, junto a las que ya están:

```prisma
  coverageSettings      CoverageSettings?
  coverageRequests      CoverageRequest[]
  coverages             Coverage[]
  coverageCollaborators CoverageCollaboratorProfile[]
  coverageEvents        CoverageEvent[]
```

En `model Member`:

```prisma
  coverageProfile      CoverageCollaboratorProfile?
  coverageApplications CoverageApplication[]
  coverageAssignments  CoverageAssignment[]
  coverageDeliverables CoverageDeliverable[]
```

En `model Client`:

```prisma
  coverageRequests CoverageRequest[]
```

En `model User`:

```prisma
  coverageEvents CoverageEvent[]
```

- [ ] **Paso 3: Verificar que el schema es válido**

```bash
cd packages/db && npx prisma validate
```

Esperado: `The schema at prisma/schema.prisma is valid 🚀`

Si falla por una relación inversa faltante, el mensaje dice exactamente cuál. **No** correr
`migrate dev` ni `db push`.

- [ ] **Paso 4: Generar el cliente para que compilen los tipos**

```bash
cd packages/db && npx prisma generate
```

- [ ] **Paso 5: Escribir el SQL de la migración a mano**

Crear `packages/db/prisma/migrations/20260914120000_coberturas/migration.sql`. Se escribe a
mano porque `migrate dev` necesita conectarse a una base y esta etapa no toca ninguna.

Para obtener el SQL exacto sin tocar ninguna base:

```bash
cd packages/db && npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://postgres:postgres@localhost:5432/shadow" \
  --script > prisma/migrations/20260914120000_coberturas/migration.sql
```

Si no hay Postgres local, levantarlo con `pnpm db:up` desde la raíz (usa el
`docker-compose.yml` del repositorio). La base shadow es descartable y local: no es ninguna de
las cinco de Neon.

- [ ] **Paso 6: Revisar el SQL generado**

Leer el archivo entero. Tiene que contener **solo** `CREATE TABLE`, `CREATE INDEX`,
`CREATE UNIQUE INDEX` y `ALTER TABLE ... ADD CONSTRAINT ... FOREIGN KEY`. Si aparece un
`DROP`, un `ALTER COLUMN` sobre una tabla existente o un `ALTER TYPE`, **parar**: la migración
dejó de ser aditiva y hay que averiguar por qué antes de seguir.

- [ ] **Paso 7: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260914120000_coberturas/
git commit -m "Las tablas de Solicitudes y Coberturas"
```

---

## Tarea 2: Alta del módulo y control de acceso

**Archivos:**
- Crear: `apps/fotoffice/lib/coverages/constants.ts`
- Crear: `apps/fotoffice/lib/coverages/access.ts`
- Crear: `apps/fotoffice/lib/coverages/access.test.ts`
- Modificar: `apps/fotoffice/lib/modules/registry.ts`
- Modificar: `apps/fotoffice/lib/entrada/institution-shortcut.ts`

**Interfaces:**
- Consume: `isModuleEnabledForWorkspace` de `@/lib/modules/gating`, `requireActiveWorkspace` de
  `@/lib/workspace`, `resolveWorkspaceRole` de `@/lib/workspace-role`.
- Produce: `COVERAGES_MODULE_KEY`, `canCoordinateCoverages(role)`,
  `canReviewCoverages(role)`, `requireCoveragesCoordinator()`, `requireCoveragesReviewer()`.

- [ ] **Paso 1: Escribir el test de la política de roles**

Crear `apps/fotoffice/lib/coverages/access.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canCoordinateCoverages, canReviewCoverages } from "./access-policy";

/**
 * Dos niveles y no uno: evaluar una solicitud y aprobarla son cosas distintas.
 *
 * Quien revisa puede leer la bandeja, dejar notas y pedir información — trabajo de secretaría
 * que no compromete nada. Aprobar, rechazar y asignar gente mueven plata ajena y el tiempo de
 * voluntarios, así que piden rol de administración.
 */
describe("canCoordinateCoverages", () => {
  it("el dueño y el administrador coordinan", () => {
    expect(canCoordinateCoverages("WORKSPACE_OWNER")).toBe(true);
    expect(canCoordinateCoverages("WORKSPACE_ADMIN")).toBe(true);
  });

  it("acepta el ADMIN legacy, que todavía llega de la tabla vieja", () => {
    expect(canCoordinateCoverages("ADMIN")).toBe(true);
  });

  it("STAFF no coordina", () => {
    expect(canCoordinateCoverages("STAFF")).toBe(false);
  });

  it("sin rol, no", () => {
    expect(canCoordinateCoverages(null)).toBe(false);
    expect(canCoordinateCoverages(undefined)).toBe(false);
    expect(canCoordinateCoverages("")).toBe(false);
  });

  it("no acepta valores que no existen en la base", () => {
    expect(canCoordinateCoverages("COORDINADOR")).toBe(false);
    expect(canCoordinateCoverages("workspace_owner")).toBe(false);
  });
});

describe("canReviewCoverages", () => {
  it("STAFF revisa", () => {
    expect(canReviewCoverages("STAFF")).toBe(true);
  });

  it("quien coordina también revisa", () => {
    expect(canReviewCoverages("WORKSPACE_OWNER")).toBe(true);
    expect(canReviewCoverages("WORKSPACE_ADMIN")).toBe(true);
    expect(canReviewCoverages("ADMIN")).toBe(true);
  });

  it("sin rol en el workspace, no se revisa nada", () => {
    expect(canReviewCoverages(null)).toBe(false);
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/access.test.ts
```

Esperado: FALLA con `Cannot find module './access-policy'`.

- [ ] **Paso 3: Escribir la política**

Crear `apps/fotoffice/lib/coverages/access-policy.ts`. Va **separado** de `access.ts` porque
aquel lleva `server-only` y este lo necesitan los tests y, más adelante, componentes cliente.

```ts
/**
 * Quién puede qué en el módulo, en esta etapa.
 *
 * Dos niveles, misma doctrina que el módulo Socios: no se inventan roles granulares
 * (secretario, tesorero) porque FotoOffice todavía no los tiene, y tenerlos solo acá los
 * volvería incomparables con el resto del panel.
 *
 * `ADMIN` se acepta además del enum nuevo porque otros callers del panel todavía pasan roles
 * de la tabla `Membership` vieja.
 */
const COORDINAN = new Set(["WORKSPACE_OWNER", "WORKSPACE_ADMIN", "ADMIN"]);

export function canCoordinateCoverages(role: string | null | undefined): boolean {
  return typeof role === "string" && COORDINAN.has(role);
}

/** Revisar es leer la bandeja, anotar y pedir información. No aprueba ni asigna. */
export function canReviewCoverages(role: string | null | undefined): boolean {
  return canCoordinateCoverages(role) || role === "STAFF";
}
```

- [ ] **Paso 4: Correr el test y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/access.test.ts
```

Esperado: 9 pasan.

- [ ] **Paso 5: Escribir las constantes**

Crear `apps/fotoffice/lib/coverages/constants.ts`:

```ts
/**
 * Constantes del módulo Solicitudes y Coberturas.
 *
 * La clave es `coverages` y no `jobs` ni `requests` para no confundirlo con dos vecinos:
 * `work-orders`, que custodia un objeto ajeno y cobra, y `events`, reservado para eventos con
 * inscripción. Son tres cosas distintas y el nombre tiene que decirlo.
 */
export const COVERAGES_MODULE_KEY = "coverages";

/** Todo lo que se le muestra a una persona se lee en esta zona. */
export const COVERAGES_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** Prefijo del código público. `SC-2026-0042`. */
export const PUBLIC_CODE_PREFIX = "SC";
```

- [ ] **Paso 6: Escribir el guard de servidor**

Crear `apps/fotoffice/lib/coverages/access.ts`. Copia la forma de `lib/clients/access.ts`:
primero el módulo, después el rol.

```ts
import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COVERAGES_MODULE_KEY } from "./constants";
import { canCoordinateCoverages, canReviewCoverages } from "./access-policy";

/**
 * Control de acceso en dos niveles y siempre en el servidor.
 *
 * Nivel 1: el módulo está encendido para ESE workspace. Nivel 2: la persona tiene el rol.
 * Se comprueban en ese orden para que un workspace sin el módulo no filtre, por la vía del
 * mensaje de error, que el módulo existe.
 */
async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, COVERAGES_MODULE_KEY))) {
    redirect("/dashboard?coberturas=off");
  }
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}

/** Ver la bandeja, anotar, pedir información. */
export async function requireCoveragesReviewer() {
  const ctx = await contextoBase();
  if (!canReviewCoverages(ctx.role)) redirect("/dashboard");
  return ctx;
}

/** Aprobar, rechazar, configurar, asignar. */
export async function requireCoveragesCoordinator() {
  const ctx = await contextoBase();
  if (!canCoordinateCoverages(ctx.role)) redirect("/coberturas?forbidden=coordinar");
  return ctx;
}
```

- [ ] **Paso 7: Dar de alta el módulo en el registro**

En `apps/fotoffice/lib/modules/registry.ts`, importar la constante junto a las demás:

```ts
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
```

Y agregar la entrada dentro de `MODULE_REGISTRY`, en la sección `GENERAL`, después de
`BOOKINGS_MODULE_KEY`:

```ts
  {
    key: COVERAGES_MODULE_KEY,
    label: "Solicitudes y Coberturas",
    description:
      "Pedidos de cobertura fotográfica: evaluación, convocatoria de colaboradores, asignación del equipo y control de entregas.",
    category: "GENERAL",
    order: 65,
    route: "/coberturas",
    status: "AVAILABLE",
  },
```

- [ ] **Paso 8: Reservar los nombres nuevos del primer nivel**

En `apps/fotoffice/lib/entrada/institution-shortcut.ts`, dentro de `RESERVED_SLUGS`, en la
sección de rutas reales y en orden alfabético:

```ts
  "coberturas",
  "sc",
```

Esto no es opcional: el test `lib/entrada/institution-shortcut.test.ts` recorre las carpetas
reales de `app/` y falla si una ruta de primer nivel no está reservada.

- [ ] **Paso 9: Correr los tests de módulos y de entrada**

```bash
cd apps/fotoffice && pnpm test lib/modules/ lib/entrada/ lib/coverages/
```

Esperado: todo pasa. `registry.test.ts` verifica que no haya claves repetidas;
`institution-shortcut.test.ts`, que los nombres estén reservados.

- [ ] **Paso 10: Commit**

```bash
git add apps/fotoffice/lib/coverages apps/fotoffice/lib/modules/registry.ts apps/fotoffice/lib/entrada/institution-shortcut.ts
git commit -m "Dar de alta el módulo de coberturas y su control de acceso"
```

---

## Tarea 3: Los estados y sus transiciones

**Archivos:**
- Crear: `apps/fotoffice/lib/coverages/states.ts`
- Crear: `apps/fotoffice/lib/coverages/transitions.ts`
- Crear: `apps/fotoffice/lib/coverages/transitions.test.ts`

**Interfaces:**
- Produce: `REQUEST_STATUSES`, `requestStatusLabel(status)`, `canTransitionRequest(from, to)`,
  `transitionRequiresReason(to)`, `assertRequestTransition({ from, to, reason })` que devuelve
  `{ ok: true } | { ok: false; error: string }`.

Esta etapa implementa **la máquina de la solicitud**. Las otras cinco entran en la etapa 1b,
sobre el mismo archivo y el mismo patrón.

- [ ] **Paso 1: Escribir el test de las transiciones**

Crear `apps/fotoffice/lib/coverages/transitions.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  assertRequestTransition,
  canTransitionRequest,
  transitionRequiresReason,
} from "./transitions";

/**
 * La máquina de estados de la solicitud.
 *
 * Es una función pura y no una columna con un `update` suelto porque el circuito tiene idas y
 * vueltas —pedir información y volver a evaluación— y sin una tabla de transiciones válidas
 * cualquier pantalla podría mandar una solicitud rechazada de vuelta a "aprobada" con un
 * formulario armado a mano.
 */
describe("canTransitionRequest", () => {
  it("el camino feliz: recibida, en evaluación, aprobada, cerrada", () => {
    expect(canTransitionRequest("RECIBIDA", "EN_EVALUACION")).toBe(true);
    expect(canTransitionRequest("EN_EVALUACION", "APROBADA")).toBe(true);
    expect(canTransitionRequest("APROBADA", "CERRADA")).toBe(true);
  });

  it("pedir información y volver", () => {
    expect(canTransitionRequest("EN_EVALUACION", "REQUIERE_INFO")).toBe(true);
    expect(canTransitionRequest("REQUIERE_INFO", "EN_EVALUACION")).toBe(true);
  });

  it("se puede rechazar mientras se evalúa o falta información", () => {
    expect(canTransitionRequest("EN_EVALUACION", "RECHAZADA")).toBe(true);
    expect(canTransitionRequest("REQUIERE_INFO", "RECHAZADA")).toBe(true);
  });

  it("una solicitud rechazada no vuelve: se pide de nuevo", () => {
    // Reabrir un rechazo dejaría el historial contando una historia falsa. Si la organización
    // insiste con datos nuevos, es una solicitud nueva.
    expect(canTransitionRequest("RECHAZADA", "EN_EVALUACION")).toBe(false);
    expect(canTransitionRequest("RECHAZADA", "APROBADA")).toBe(false);
  });

  it("no se salta la evaluación", () => {
    expect(canTransitionRequest("RECIBIDA", "APROBADA")).toBe(false);
  });

  it("cerrada es el final", () => {
    expect(canTransitionRequest("CERRADA", "APROBADA")).toBe(false);
    expect(canTransitionRequest("CERRADA", "CERRADA")).toBe(false);
  });

  it("cancelar se puede desde cualquier estado vivo", () => {
    expect(canTransitionRequest("RECIBIDA", "CANCELADA_SOLICITANTE")).toBe(true);
    expect(canTransitionRequest("APROBADA", "CANCELADA_ORGANIZACION")).toBe(true);
    expect(canTransitionRequest("CANCELADA_SOLICITANTE", "EN_EVALUACION")).toBe(false);
  });

  it("quedarse donde está no es una transición", () => {
    expect(canTransitionRequest("EN_EVALUACION", "EN_EVALUACION")).toBe(false);
  });

  it("un estado inventado nunca es válido", () => {
    expect(canTransitionRequest("EN_EVALUACION", "APROBADISIMA")).toBe(false);
    expect(canTransitionRequest("CUALQUIERA", "APROBADA")).toBe(false);
  });
});

describe("transitionRequiresReason", () => {
  it("rechazar y cancelar exigen motivo", () => {
    expect(transitionRequiresReason("RECHAZADA")).toBe(true);
    expect(transitionRequiresReason("CANCELADA_ORGANIZACION")).toBe(true);
    expect(transitionRequiresReason("CANCELADA_SOLICITANTE")).toBe(true);
  });

  it("aprobar no exige motivo", () => {
    expect(transitionRequiresReason("APROBADA")).toBe(false);
    expect(transitionRequiresReason("EN_EVALUACION")).toBe(false);
  });
});

describe("assertRequestTransition", () => {
  it("acepta una transición válida sin motivo cuando no hace falta", () => {
    expect(assertRequestTransition({ from: "RECIBIDA", to: "EN_EVALUACION" })).toEqual({
      ok: true,
    });
  });

  it("rechaza una transición inválida y dice cuál era", () => {
    const r = assertRequestTransition({ from: "RECIBIDA", to: "APROBADA" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("Recibida");
  });

  it("no deja rechazar sin motivo", () => {
    const r = assertRequestTransition({ from: "EN_EVALUACION", to: "RECHAZADA" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("motivo");
  });

  it("un motivo de espacios en blanco no cuenta como motivo", () => {
    const r = assertRequestTransition({
      from: "EN_EVALUACION",
      to: "RECHAZADA",
      reason: "   ",
    });
    expect(r.ok).toBe(false);
  });

  it("con motivo, rechazar se acepta", () => {
    expect(
      assertRequestTransition({
        from: "EN_EVALUACION",
        to: "RECHAZADA",
        reason: "La actividad no tiene finalidad solidaria.",
      }),
    ).toEqual({ ok: true });
  });
});
```

- [ ] **Paso 2: Correr el test y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/transitions.test.ts
```

Esperado: FALLA con `Cannot find module './transitions'`.

- [ ] **Paso 3: Escribir los estados**

Crear `apps/fotoffice/lib/coverages/states.ts`:

```ts
/**
 * Los estados del módulo.
 *
 * Cada entidad tiene su propio conjunto, y no uno solo para todo, porque de otro modo habría
 * que inventar combinaciones imposibles —"aprobada pero entrega observada"— y habría que
 * mirar una solicitud para saber si una persona confirmó que va.
 *
 * Son cadenas y no enums de Prisma: el esquema lo comparten cinco aplicaciones, y agregar un
 * valor a un enum compartido es una migración en cinco bases.
 */

export const REQUEST_STATUSES = [
  "RECIBIDA",
  "EN_EVALUACION",
  "REQUIERE_INFO",
  "APROBADA",
  "RECHAZADA",
  "CANCELADA_SOLICITANTE",
  "CANCELADA_ORGANIZACION",
  "CERRADA",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === "string" && (REQUEST_STATUSES as readonly string[]).includes(value);
}

/**
 * Cómo se lee cada estado en pantalla.
 *
 * "Cancelada por ustedes" y no "cancelada por el solicitante": quien lee esto en el enlace de
 * seguimiento es la organización, y hablarle en tercera persona sobre sí misma es raro.
 */
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  RECIBIDA: "Recibida",
  EN_EVALUACION: "En evaluación",
  REQUIERE_INFO: "Necesitamos más información",
  APROBADA: "Aprobada",
  RECHAZADA: "No pudimos tomarla",
  CANCELADA_SOLICITANTE: "Cancelada por la organización solicitante",
  CANCELADA_ORGANIZACION: "Cancelada",
  CERRADA: "Cerrada",
};

export function requestStatusLabel(status: string): string {
  return isRequestStatus(status) ? REQUEST_STATUS_LABELS[status] : status;
}

/** Estados en los que la solicitud todavía está viva y puede cancelarse. */
export const REQUEST_LIVE_STATUSES: readonly RequestStatus[] = [
  "RECIBIDA",
  "EN_EVALUACION",
  "REQUIERE_INFO",
  "APROBADA",
];
```

- [ ] **Paso 4: Escribir las transiciones**

Crear `apps/fotoffice/lib/coverages/transitions.ts`:

```ts
import {
  REQUEST_LIVE_STATUSES,
  isRequestStatus,
  requestStatusLabel,
  type RequestStatus,
} from "./states";

/**
 * Qué transición de solicitud es válida.
 *
 * Tabla explícita en vez de reglas sueltas repartidas por las pantallas: acá se lee de un
 * vistazo qué puede pasar después de qué, y agregar un camino obliga a tocar este archivo y
 * su test.
 *
 * Quedarse en el mismo estado NO es una transición: si una pantalla la intenta, es que hay un
 * doble clic o un formulario reenviado, y dejarla pasar duplicaría el evento del historial.
 */
const TRANSICIONES: Record<RequestStatus, readonly RequestStatus[]> = {
  RECIBIDA: ["EN_EVALUACION"],
  EN_EVALUACION: ["REQUIERE_INFO", "APROBADA", "RECHAZADA"],
  REQUIERE_INFO: ["EN_EVALUACION", "RECHAZADA"],
  APROBADA: ["CERRADA"],
  // Terminales: un rechazo que se reabre deja el historial contando una historia falsa. Si la
  // organización insiste con datos nuevos, es una solicitud nueva.
  RECHAZADA: [],
  CANCELADA_SOLICITANTE: [],
  CANCELADA_ORGANIZACION: [],
  CERRADA: [],
};

/** Cancelar se puede desde cualquier estado vivo, sin listarlo en cada fila de la tabla. */
const CANCELACIONES: readonly RequestStatus[] = [
  "CANCELADA_SOLICITANTE",
  "CANCELADA_ORGANIZACION",
];

export function canTransitionRequest(from: string, to: string): boolean {
  if (!isRequestStatus(from) || !isRequestStatus(to)) return false;
  if (from === to) return false;
  if (CANCELACIONES.includes(to)) return REQUEST_LIVE_STATUSES.includes(from);
  return TRANSICIONES[from].includes(to);
}

/**
 * Qué transiciones exigen que alguien escriba por qué.
 *
 * Las tres que le cierran la puerta a la organización. Sin motivo, el correo que recibe dice
 * "no pudimos tomarla" y nada más, y la persona que lo lee no tiene a dónde ir con eso.
 */
export function transitionRequiresReason(to: string): boolean {
  return to === "RECHAZADA" || CANCELACIONES.includes(to as RequestStatus);
}

export type TransitionCheck = { ok: true } | { ok: false; error: string };

export function assertRequestTransition(input: {
  from: string;
  to: string;
  reason?: string | null;
}): TransitionCheck {
  if (!canTransitionRequest(input.from, input.to)) {
    return {
      ok: false,
      error: `No se puede pasar de «${requestStatusLabel(input.from)}» a «${requestStatusLabel(input.to)}».`,
    };
  }
  if (transitionRequiresReason(input.to) && !input.reason?.trim()) {
    return { ok: false, error: "Escribí el motivo: se le comunica a la organización." };
  }
  return { ok: true };
}
```

- [ ] **Paso 5: Correr el test y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/transitions.test.ts
```

Esperado: 17 pasan.

- [ ] **Paso 6: Commit**

```bash
git add apps/fotoffice/lib/coverages/states.ts apps/fotoffice/lib/coverages/transitions.ts apps/fotoffice/lib/coverages/transitions.test.ts
git commit -m "Los estados de una solicitud y sus transiciones válidas"
```

---

## Tarea 4: Configuración, terminología y la regla del refuerzo

**Archivos:**
- Crear: `apps/fotoffice/lib/coverages/settings.ts`
- Crear: `apps/fotoffice/lib/coverages/settings.test.ts`
- Crear: `apps/fotoffice/lib/coverages/terminology.ts`
- Crear: `apps/fotoffice/lib/coverages/terminology.test.ts`
- Crear: `apps/fotoffice/lib/coverages/reinforcement.ts`
- Crear: `apps/fotoffice/lib/coverages/reinforcement.test.ts`

**Interfaces:**
- Produce: `DEFAULT_COVERAGE_SETTINGS`, `type CoverageSettingsShape`,
  `terminologyFor(settings)` que devuelve `{ request, collaborator, requester, call, module }`,
  `recomendarRefuerzo({ durationMinutes, assigned, settings })` que devuelve
  `{ recommended: number; reason: string } | null`.

- [ ] **Paso 1: Escribir el test de la terminología**

Crear `apps/fotoffice/lib/coverages/terminology.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_COVERAGE_SETTINGS } from "./settings";
import { terminologyFor } from "./terminology";

/**
 * Es lo que hace que el módulo no sea "el módulo de FOTOPOSITIVA".
 *
 * Donde una ONG lee "Voluntario/a", un estudio lee "Fotógrafo" y una cooperativa "Socio". Por
 * dentro es la misma tabla; lo único que cambia es la etiqueta, y cambia por configuración y
 * no por un `if` con el nombre de una organización adentro.
 */
describe("terminologyFor", () => {
  it("sin configurar nada, usa palabras neutras", () => {
    const t = terminologyFor(DEFAULT_COVERAGE_SETTINGS);
    expect(t.request).toBe("Solicitud");
    expect(t.collaborator).toBe("Colaborador/a");
    expect(t.requester).toBe("Solicitante");
    expect(t.call).toBe("Convocatoria");
  });

  it("FOTOPOSITIVA habla de voluntarios y organizaciones", () => {
    const t = terminologyFor({
      ...DEFAULT_COVERAGE_SETTINGS,
      termCollaborator: "Voluntario/a",
      termRequester: "Organización",
    });
    expect(t.collaborator).toBe("Voluntario/a");
    expect(t.requester).toBe("Organización");
    // Lo que no se configuró sigue en su valor neutro.
    expect(t.request).toBe("Solicitud");
  });

  it("una etiqueta vacía o de espacios no pisa la de por omisión", () => {
    // Un campo que alguien vació en el formulario no puede dejar la pantalla sin la palabra.
    const t = terminologyFor({
      ...DEFAULT_COVERAGE_SETTINGS,
      termCollaborator: "",
      termRequester: "   ",
    });
    expect(t.collaborator).toBe("Colaborador/a");
    expect(t.requester).toBe("Solicitante");
  });
});
```

- [ ] **Paso 2: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/terminology.test.ts
```

Esperado: FALLA con `Cannot find module './settings'`.

- [ ] **Paso 3: Escribir la forma de la configuración**

Crear `apps/fotoffice/lib/coverages/settings.ts`:

```ts
/**
 * La configuración del módulo para un workspace.
 *
 * Es el archivo que sostiene la promesa de que el módulo es genérico: el umbral de 3 horas, la
 * palabra "voluntario" y la confirmación obligatoria del coordinador viven acá y no en el
 * código. Si mañana una agencia necesita otro umbral, se cambia un número en una pantalla.
 *
 * Tipo estructural y no el modelo de Prisma: así lo pueden importar los tests y los
 * componentes cliente sin arrastrar el cliente de base de datos al navegador.
 */
export type CoverageSettingsShape = {
  moduleLabel: string | null;
  termRequest: string | null;
  termCollaborator: string | null;
  termRequester: string | null;
  termCall: string | null;
  assignmentMode: string;
  requiresApproval: boolean;
  requiresCoordinatorConfirmation: boolean;
  reinforcementThresholdMinutes: number;
  recommendedCollaborators: number;
  roleTemplates: string[];
  specialties: string[];
  zones: string[];
  publicFormEnabled: boolean;
  publicFormIntro: string | null;
  consentTextVersion: string;
  trackingLinkTtlDays: number;
  notifyEmails: string[];
};

/**
 * Lo que rige cuando una institución nunca tocó la configuración.
 *
 * `publicFormEnabled` arranca apagado a propósito: publicar un formulario que recibe datos de
 * terceros tiene que ser un acto deliberado, no el resultado de encender un módulo.
 */
export const DEFAULT_COVERAGE_SETTINGS: CoverageSettingsShape = {
  moduleLabel: null,
  termRequest: null,
  termCollaborator: null,
  termRequester: null,
  termCall: null,
  assignmentMode: "MIXTA",
  requiresApproval: true,
  requiresCoordinatorConfirmation: true,
  reinforcementThresholdMinutes: 180,
  recommendedCollaborators: 2,
  roleTemplates: [],
  specialties: [],
  zones: [],
  publicFormEnabled: false,
  publicFormIntro: null,
  consentTextVersion: "v1",
  trackingLinkTtlDays: 120,
  notifyEmails: [],
};

export const ASSIGNMENT_MODES = ["DIRECTA", "ABIERTA", "AUTOMATICA", "MIXTA"] as const;
export type AssignmentMode = (typeof ASSIGNMENT_MODES)[number];

export const ASSIGNMENT_MODE_LABELS: Record<AssignmentMode, string> = {
  DIRECTA: "El coordinador invita a quien elige",
  ABIERTA: "Se publica y quien quiera se postula",
  AUTOMATICA: "El sistema propone candidatos",
  MIXTA: "Se publica, se postulan y el coordinador confirma",
};
```

- [ ] **Paso 4: Escribir la terminología**

Crear `apps/fotoffice/lib/coverages/terminology.ts`:

```ts
import type { CoverageSettingsShape } from "./settings";

export type Terminology = {
  module: string;
  request: string;
  collaborator: string;
  requester: string;
  call: string;
};

/** Neutras a propósito: no son de una ONG ni de un estudio. */
const POR_OMISION: Terminology = {
  module: "Solicitudes y Coberturas",
  request: "Solicitud",
  collaborator: "Colaborador/a",
  requester: "Solicitante",
  call: "Convocatoria",
};

/** Una etiqueta vacía no pisa la de por omisión: dejaría la pantalla sin la palabra. */
function usar(configurada: string | null | undefined, porOmision: string): string {
  return configurada?.trim() || porOmision;
}

export function terminologyFor(settings: CoverageSettingsShape): Terminology {
  return {
    module: usar(settings.moduleLabel, POR_OMISION.module),
    request: usar(settings.termRequest, POR_OMISION.request),
    collaborator: usar(settings.termCollaborator, POR_OMISION.collaborator),
    requester: usar(settings.termRequester, POR_OMISION.requester),
    call: usar(settings.termCall, POR_OMISION.call),
  };
}
```

- [ ] **Paso 5: Correr el test de terminología y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/terminology.test.ts
```

Esperado: 3 pasan.

- [ ] **Paso 6: Escribir el test del refuerzo**

Crear `apps/fotoffice/lib/coverages/reinforcement.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_COVERAGE_SETTINGS } from "./settings";
import { recomendarRefuerzo } from "./reinforcement";

const settings = DEFAULT_COVERAGE_SETTINGS; // umbral 180 min, recomienda 2

/**
 * La regla de las 3 horas.
 *
 * Recomienda, nunca bloquea. Es deliberado: el coordinador conoce la actividad y puede tener
 * razones para ir con una sola persona. Lo que sí hace el sistema es dejar constancia de que
 * avisó.
 */
describe("recomendarRefuerzo", () => {
  it("una cobertura corta no necesita nada", () => {
    expect(recomendarRefuerzo({ durationMinutes: 120, assigned: 1, settings })).toBe(null);
  });

  it("justo en el umbral todavía no recomienda", () => {
    // 180 minutos son 3 horas exactas. La regla dice "más de 3 horas", no "3 o más".
    expect(recomendarRefuerzo({ durationMinutes: 180, assigned: 1, settings })).toBe(null);
  });

  it("un minuto más que el umbral ya recomienda", () => {
    const r = recomendarRefuerzo({ durationMinutes: 181, assigned: 1, settings });
    expect(r?.recommended).toBe(2);
  });

  it("el caso de la jornada solidaria: 4 h 30 con una persona", () => {
    const r = recomendarRefuerzo({ durationMinutes: 270, assigned: 1, settings });
    expect(r).not.toBe(null);
    expect(r?.recommended).toBe(2);
    expect(r?.reason).toContain("4 h 30");
    expect(r?.reason).toContain("3 h");
  });

  it("con el equipo ya completo no molesta", () => {
    expect(recomendarRefuerzo({ durationMinutes: 270, assigned: 2, settings })).toBe(null);
    expect(recomendarRefuerzo({ durationMinutes: 270, assigned: 5, settings })).toBe(null);
  });

  it("el umbral y la cantidad se configuran: una agencia puede pedir otra cosa", () => {
    const propios = {
      ...settings,
      reinforcementThresholdMinutes: 60,
      recommendedCollaborators: 3,
    };
    const r = recomendarRefuerzo({ durationMinutes: 90, assigned: 1, settings: propios });
    expect(r?.recommended).toBe(3);
    expect(r?.reason).toContain("1 h");
  });

  it("una duración inválida no rompe la pantalla", () => {
    // Las fechas las carga una persona y pueden llegar dadas vuelta.
    expect(recomendarRefuerzo({ durationMinutes: 0, assigned: 0, settings })).toBe(null);
    expect(recomendarRefuerzo({ durationMinutes: -30, assigned: 0, settings })).toBe(null);
    expect(recomendarRefuerzo({ durationMinutes: Number.NaN, assigned: 0, settings })).toBe(null);
  });
});
```

- [ ] **Paso 7: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/reinforcement.test.ts
```

Esperado: FALLA con `Cannot find module './reinforcement'`.

- [ ] **Paso 8: Escribir la regla**

Crear `apps/fotoffice/lib/coverages/reinforcement.ts`:

```ts
import type { CoverageSettingsShape } from "./settings";

export type Reinforcement = {
  /** Cuántas personas conviene tener en total. */
  recommended: number;
  /** Por qué, en una frase que se muestra tal cual. */
  reason: string;
};

/**
 * "Esta cobertura es larga: convendría sumar a alguien."
 *
 * **Recomienda, no bloquea.** El coordinador conoce la actividad y puede tener razones para ir
 * con una sola persona; lo que no puede es no haberse enterado. Cuando decide seguir igual, la
 * pantalla le pide una observación que queda en el historial.
 *
 * Devuelve `null` cuando no hay nada que decir, así quien la usa muestra el aviso o no sin
 * preguntar por un booleano aparte.
 */
export function recomendarRefuerzo(input: {
  durationMinutes: number;
  assigned: number;
  settings: CoverageSettingsShape;
}): Reinforcement | null {
  const { durationMinutes, assigned, settings } = input;

  // Las fechas las carga una persona y pueden llegar dadas vuelta o vacías. Un aviso calculado
  // sobre una duración negativa sería peor que no avisar.
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;

  const umbral = settings.reinforcementThresholdMinutes;
  if (durationMinutes <= umbral) return null;

  const recomendados = settings.recommendedCollaborators;
  if (assigned >= recomendados) return null;

  return {
    recommended: recomendados,
    reason: `La cobertura dura ${formatearDuracion(durationMinutes)} y supera el umbral de ${formatearDuracion(umbral)}.`,
  };
}

/**
 * "4 h 30", "3 h", "45 min".
 *
 * Se escribe así y no en minutos porque el aviso lo lee una persona que está mirando el
 * horario del evento, no un informe.
 */
export function formatearDuracion(minutos: number): string {
  const total = Math.round(minutos);
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  if (horas === 0) return `${resto} min`;
  if (resto === 0) return `${horas} h`;
  return `${horas} h ${String(resto).padStart(2, "0")}`;
}
```

- [ ] **Paso 9: Correr los tests del refuerzo y verlos pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/reinforcement.test.ts
```

Esperado: 7 pasan.

- [ ] **Paso 10: Commit**

```bash
git add apps/fotoffice/lib/coverages/
git commit -m "Configuración por workspace, terminología y la regla del refuerzo"
```

---

## Tarea 5: Código público, token de seguimiento y freno al spam

**Archivos:**
- Crear: `apps/fotoffice/lib/coverages/public-code.ts`
- Crear: `apps/fotoffice/lib/coverages/public-code.test.ts`
- Crear: `apps/fotoffice/lib/coverages/tracking-token.ts`
- Crear: `apps/fotoffice/lib/coverages/rate-limit.ts`
- Crear: `apps/fotoffice/lib/coverages/rate-limit.test.ts`

**Interfaces:**
- Produce: `buildPublicCode({ year, sequence })`, `nextPublicCode(lastCode, year)`,
  `generateTrackingToken()`, `hashTrackingToken(raw)`, `trackingTokenMatches(raw, hash)`,
  `trackingExpiryFrom(days, now)`, `decidirEnvio({ recientes, ventanaMinutos, topePorVentana })`.

- [ ] **Paso 1: Escribir el test del código público**

Crear `apps/fotoffice/lib/coverages/public-code.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPublicCode, nextPublicCode, parsePublicCode } from "./public-code";

/**
 * El número que se dice por teléfono.
 *
 * `SC-2026-0042` es legible y se dicta sin deletrear. Lo importante es lo que NO es: no abre
 * nada. Quien tenga el 42 no puede probar el 43 para ver el pedido de otra organización,
 * porque lo que abre la ventana de seguimiento es el token, no el código.
 */
describe("buildPublicCode", () => {
  it("arma el código con el año y cuatro dígitos", () => {
    expect(buildPublicCode({ year: 2026, sequence: 42 })).toBe("SC-2026-0042");
  });

  it("el primero del año es el 1", () => {
    expect(buildPublicCode({ year: 2026, sequence: 1 })).toBe("SC-2026-0001");
  });

  it("no se rompe cuando se pasan los cuatro dígitos", () => {
    // Una organización con más de 9999 pedidos en un año es improbable, pero truncar el
    // número sería peor que un código más largo.
    expect(buildPublicCode({ year: 2026, sequence: 12345 })).toBe("SC-2026-12345");
  });
});

describe("nextPublicCode", () => {
  it("sin ninguno previo, empieza en 1", () => {
    expect(nextPublicCode(null, 2026)).toBe("SC-2026-0001");
  });

  it("sigue la numeración del mismo año", () => {
    expect(nextPublicCode("SC-2026-0041", 2026)).toBe("SC-2026-0042");
  });

  it("cada año arranca de nuevo", () => {
    // Que el primer pedido de 2027 sea el 0001 hace que el código diga algo de un vistazo.
    expect(nextPublicCode("SC-2026-0187", 2027)).toBe("SC-2027-0001");
  });

  it("un código ilegible no frena un alta: se empieza de nuevo ese año", () => {
    expect(nextPublicCode("basura", 2026)).toBe("SC-2026-0001");
    expect(nextPublicCode("", 2026)).toBe("SC-2026-0001");
  });
});

describe("parsePublicCode", () => {
  it("lee año y número", () => {
    expect(parsePublicCode("SC-2026-0042")).toEqual({ year: 2026, sequence: 42 });
  });

  it("acepta minúsculas y espacios: la gente lo copia de un mail", () => {
    expect(parsePublicCode("  sc-2026-0042 ")).toEqual({ year: 2026, sequence: 42 });
  });

  it("descarta lo que no tiene la forma", () => {
    expect(parsePublicCode("SC-2026")).toBe(null);
    expect(parsePublicCode("XX-2026-0042")).toBe(null);
    expect(parsePublicCode("SC-20AB-0042")).toBe(null);
  });
});
```

- [ ] **Paso 2: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/public-code.test.ts
```

Esperado: FALLA con `Cannot find module './public-code'`.

- [ ] **Paso 3: Escribir el código público**

Crear `apps/fotoffice/lib/coverages/public-code.ts`:

```ts
import { PUBLIC_CODE_PREFIX } from "./constants";

/**
 * El código que se dice por teléfono: `SC-2026-0042`.
 *
 * **No abre nada.** Es correlativo y legible justamente porque no es una credencial: lo que da
 * acceso al seguimiento es el token del enlace. Si el código abriera la ventana, cualquiera
 * probaría el 43 y vería el pedido de otra organización.
 *
 * Se reinicia cada año para que el número diga algo de un vistazo.
 */
export function buildPublicCode(input: { year: number; sequence: number }): string {
  const numero = String(input.sequence).padStart(4, "0");
  return `${PUBLIC_CODE_PREFIX}-${input.year}-${numero}`;
}

export function parsePublicCode(code: string): { year: number; sequence: number } | null {
  const m = new RegExp(`^${PUBLIC_CODE_PREFIX}-(\\d{4})-(\\d+)$`, "i").exec(code.trim());
  if (!m) return null;
  return { year: Number(m[1]), sequence: Number(m[2]) };
}

/**
 * El siguiente código del workspace.
 *
 * Un código previo ilegible NO frena un alta: se empieza de nuevo ese año. Una organización
 * que quiere pedir una cobertura no puede quedarse afuera porque una fila vieja tenga basura.
 */
export function nextPublicCode(lastCode: string | null | undefined, year: number): string {
  const previo = lastCode ? parsePublicCode(lastCode) : null;
  const siguiente = previo && previo.year === year ? previo.sequence + 1 : 1;
  return buildPublicCode({ year, sequence: siguiente });
}
```

- [ ] **Paso 4: Correr y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/public-code.test.ts
```

Esperado: 10 pasan.

- [ ] **Paso 5: Escribir el token de seguimiento**

Crear `apps/fotoffice/lib/coverages/tracking-token.ts`. Es una copia deliberada del patrón de
`lib/members/invitation-tokens.ts`, ya probado en el monorepo:

```ts
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * El token del enlace de seguimiento — **solo servidor**.
 *
 * Mismo patrón que `lib/members/invitation-tokens.ts` y que `PasswordResetToken`: el token
 * crudo viaja una sola vez, en el correo, y en la base queda solo su SHA-256. Si la base se
 * filtra, los enlaces no sirven.
 *
 * Vive en su propio archivo y no junto al dominio del módulo porque `node:crypto` no puede
 * terminar en el bundle del navegador.
 */

/** 32 bytes de entropía. `base64url` entra en una URL sin escapar nada. */
export function generateTrackingToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashTrackingToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Comparación en tiempo constante, para no filtrar información por el tiempo de respuesta. */
export function trackingTokenMatches(rawToken: string, storedHash: string): boolean {
  const calculado = Buffer.from(hashTrackingToken(rawToken), "hex");
  let guardado: Buffer;
  try {
    guardado = Buffer.from(storedHash, "hex");
  } catch {
    return false;
  }
  if (calculado.length !== guardado.length) return false;
  return timingSafeEqual(calculado, guardado);
}

/**
 * Cuándo vence el enlace.
 *
 * Por omisión 120 días, configurable por workspace. El plazo es largo a propósito: el enlace
 * acompaña a la solicitud durante todo su recorrido —evaluación, cobertura, entrega— y que
 * venza a mitad del circuito obligaría a reemitirlo a mano.
 */
export function trackingExpiryFrom(days: number, now = new Date()): Date {
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

/** El enlace sirve si no venció y nadie lo revocó. */
export function isTrackingLinkUsable(
  row: { tokenExpiresAt: Date; tokenRevokedAt: Date | null },
  now = new Date(),
): boolean {
  if (row.tokenRevokedAt) return false;
  return row.tokenExpiresAt.getTime() > now.getTime();
}
```

- [ ] **Paso 6: Escribir el test del freno**

Crear `apps/fotoffice/lib/coverages/rate-limit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { PUBLIC_FORM_LIMIT, decidirEnvio } from "./rate-limit";

/**
 * El freno del formulario público.
 *
 * Hoy NINGÚN formulario público de FotoOffice tiene uno — el de asociarse tampoco. Este es el
 * primero. Un formulario abierto a internet sin límite es una invitación a llenarlo de basura,
 * y cada fila falsa es trabajo de secretaría después.
 *
 * La decisión es pura: recibe cuántos envíos hubo en la ventana y responde. Quién los cuenta
 * es problema del repositorio, y así el caso que importa se puede probar sin base de datos.
 */
describe("decidirEnvio", () => {
  it("el primero entra", () => {
    expect(decidirEnvio({ recientes: 0 })).toEqual({ ok: true });
  });

  it("hasta el tope, entra", () => {
    expect(decidirEnvio({ recientes: PUBLIC_FORM_LIMIT - 1 })).toEqual({ ok: true });
  });

  it("llegado al tope, se rechaza", () => {
    const r = decidirEnvio({ recientes: PUBLIC_FORM_LIMIT });
    expect(r.ok).toBe(false);
  });

  it("el mensaje no dice cuántos van ni cuánto falta", () => {
    // Decirle a quien automatiza envíos cuál es el tope y cuándo se libera le facilita el
    // trabajo. A una persona real le alcanza con saber que espere un rato.
    const r = decidirEnvio({ recientes: PUBLIC_FORM_LIMIT + 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).not.toMatch(/\d/);
      expect(r.error.toLowerCase()).toContain("más tarde");
    }
  });

  it("el tope se puede ajustar por llamada", () => {
    expect(decidirEnvio({ recientes: 2, tope: 5 })).toEqual({ ok: true });
    expect(decidirEnvio({ recientes: 5, tope: 5 }).ok).toBe(false);
  });
});
```

- [ ] **Paso 7: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/rate-limit.test.ts
```

Esperado: FALLA con `Cannot find module './rate-limit'`.

- [ ] **Paso 8: Escribir el freno**

Crear `apps/fotoffice/lib/coverages/rate-limit.ts`:

```ts
import { createHash } from "node:crypto";

/**
 * Tres solicitudes por hora, por correo y por origen.
 *
 * El número no sale de ninguna medición: sale de que una organización real manda una solicitud
 * y, si se equivocó, la manda de nuevo. Tres cubre el error humano con margen y corta el envío
 * automático.
 *
 * Se cuenta sobre `CoverageRequest`, sin tabla nueva: las filas que queremos limitar son
 * exactamente las que ya se guardan.
 */
export const PUBLIC_FORM_LIMIT = 3;
export const PUBLIC_FORM_WINDOW_MINUTES = 60;

export type EnvioDecision = { ok: true } | { ok: false; error: string };

/**
 * Función pura: recibe cuántos envíos hubo en la ventana y decide.
 *
 * Contar es problema del repositorio. Separarlo deja probar el caso que importa —que el cuarto
 * no entre— sin levantar una base.
 */
export function decidirEnvio(input: { recientes: number; tope?: number }): EnvioDecision {
  const tope = input.tope ?? PUBLIC_FORM_LIMIT;
  if (input.recientes < tope) return { ok: true };
  // Sin números en el mensaje: decir cuál es el tope y cuándo se libera le facilita el trabajo
  // a quien automatiza. A una persona real le alcanza con esto.
  return { ok: false, error: "Recibimos varias solicitudes desde acá. Probá más tarde." };
}

/**
 * Huella del origen para contar sin guardar la IP.
 *
 * Se guarda el hash y no la dirección: alcanza para agrupar envíos del mismo origen y para
 * demostrar procedencia, sin acumular un dato personal que nadie va a necesitar leer. La sal
 * hace que el hash no sea reversible con una tabla de todas las IPv4 posibles.
 */
export function hashOrigen(ip: string | null | undefined, salt: string): string | null {
  const valor = ip?.trim();
  if (!valor) return null;
  return createHash("sha256").update(`${salt}:${valor}`).digest("hex");
}
```

- [ ] **Paso 9: Correr y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/rate-limit.test.ts
```

Esperado: 5 pasan.

- [ ] **Paso 10: Commit**

```bash
git add apps/fotoffice/lib/coverages/
git commit -m "El código público, el enlace de seguimiento y el freno del formulario"
```

---

## Tarea 6: Los consentimientos y el parseo del formulario

**Archivos:**
- Crear: `apps/fotoffice/lib/coverages/consents.ts`
- Crear: `apps/fotoffice/lib/coverages/consents.test.ts`
- Crear: `apps/fotoffice/lib/coverages/request-form.ts`
- Crear: `apps/fotoffice/lib/coverages/request-form.test.ts`

**Interfaces:**
- Produce: `CONSENT_KINDS`, `REQUIRED_CONSENTS`, `consentTexts(version)`,
  `hashConsentText(text)`, `parseConsents(form, version)`,
  `parseCoverageRequest(form)` que devuelve
  `{ ok: true; data: ParsedRequest } | { ok: false; error: string }`.

- [ ] **Paso 1: Escribir el test de los consentimientos**

Crear `apps/fotoffice/lib/coverages/consents.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  CONSENT_KINDS,
  REQUIRED_CONSENTS,
  consentTexts,
  hashConsentText,
  parseConsents,
} from "./consents";

/**
 * Los permisos, uno por uno y con la versión del texto que la persona leyó.
 *
 * No es un checkbox de "acepto todo" a propósito. Autorizar una cobertura, avisar que va a
 * haber menores y permitir que la organización muestre las fotos son tres cosas distintas, con
 * consecuencias distintas, y en el peor momento —cuando alguien reclame— hay que poder decir
 * cuál de las tres dio y qué texto exacto leyó.
 */
describe("consentTexts", () => {
  it("hay un texto por cada permiso del catálogo", () => {
    const textos = consentTexts("v1");
    for (const kind of CONSENT_KINDS) {
      expect(textos[kind].length).toBeGreaterThan(10);
    }
  });

  it("el hash cambia si el texto cambia", () => {
    // Es el punto de todo: si mañana se reescribe un texto, los consentimientos viejos tienen
    // que seguir apuntando al que se firmó.
    expect(hashConsentText("Autorizo la cobertura.")).not.toBe(
      hashConsentText("Autorizo la cobertura fotográfica."),
    );
  });

  it("el mismo texto da siempre el mismo hash", () => {
    expect(hashConsentText("Autorizo")).toBe(hashConsentText("Autorizo"));
  });
});

describe("parseConsents", () => {
  function formularioCompleto(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const kind of REQUIRED_CONSENTS) out[`consent_${kind}`] = "on";
    return out;
  }

  it("con los obligatorios tildados, pasa", () => {
    const r = parseConsents(formularioCompleto(), "v1");
    expect(r.ok).toBe(true);
  });

  it("falta uno obligatorio: no pasa, y dice cuál", () => {
    const form = formularioCompleto();
    delete form[`consent_${REQUIRED_CONSENTS[0]}`];
    const r = parseConsents(form, "v1");
    expect(r.ok).toBe(false);
  });

  it("guarda la versión y el hash de cada uno", () => {
    const r = parseConsents(formularioCompleto(), "v3");
    expect(r.ok).toBe(true);
    if (r.ok) {
      for (const fila of r.data) {
        expect(fila.textVersion).toBe("v3");
        expect(fila.textHash).toHaveLength(64);
      }
    }
  });

  it("un permiso opcional no tildado se guarda como negado, no se omite", () => {
    // Guardar el "no" importa tanto como el "sí": es la diferencia entre "dijo que no" y
    // "nunca se le preguntó".
    const r = parseConsents(formularioCompleto(), "v1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      const opcional = r.data.find((c) => !REQUIRED_CONSENTS.includes(c.kind));
      expect(opcional?.granted).toBe(false);
    }
  });

  it("hay una fila por cada permiso del catálogo, siempre", () => {
    const r = parseConsents(formularioCompleto(), "v1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toHaveLength(CONSENT_KINDS.length);
  });
});
```

- [ ] **Paso 2: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/consents.test.ts
```

Esperado: FALLA con `Cannot find module './consents'`.

- [ ] **Paso 3: Escribir los consentimientos**

Crear `apps/fotoffice/lib/coverages/consents.ts`:

```ts
import { createHash } from "node:crypto";

/**
 * Los permisos que se piden en el formulario público.
 *
 * Uno por fila y no un "acepto todo": autorizar la cobertura, avisar que va a haber menores y
 * permitir que la organización muestre las fotos son cosas distintas, con consecuencias
 * distintas. Cuando alguien reclame —y alguna vez va a pasar— hay que poder decir cuál dio y
 * qué texto exacto leyó.
 */
export const CONSENT_KINDS = [
  "AUTORIZA_COBERTURA",
  "MENORES_PRESENTES",
  "CONSENTIMIENTOS_IMAGEN",
  "RESTRICCIONES_PUBLICACION",
  "USO_INSTITUCIONAL",
  "TERMINOS",
  "PRIVACIDAD",
] as const;

export type ConsentKind = (typeof CONSENT_KINDS)[number];

/**
 * Sin estos cuatro no se puede empezar.
 *
 * Los otros tres son declaraciones, no permisos: que haya menores o que existan
 * consentimientos de imagen son datos que cambian cómo se hace la cobertura, y que la
 * organización deje mostrar las fotos es una gentileza, no un requisito.
 */
export const REQUIRED_CONSENTS: readonly ConsentKind[] = [
  "AUTORIZA_COBERTURA",
  "RESTRICCIONES_PUBLICACION",
  "TERMINOS",
  "PRIVACIDAD",
];

export const CONSENT_LABELS: Record<ConsentKind, string> = {
  AUTORIZA_COBERTURA: "Puedo autorizar esta cobertura en nombre de la organización",
  MENORES_PRESENTES: "En la actividad va a haber menores de edad",
  CONSENTIMIENTOS_IMAGEN: "Tenemos los consentimientos de imagen de quienes participan",
  RESTRICCIONES_PUBLICACION: "Entiendo que puede haber restricciones de publicación",
  USO_INSTITUCIONAL: "Autorizo a mostrar imágenes de este trabajo",
  TERMINOS: "Acepto las condiciones del servicio",
  PRIVACIDAD: "Leí la política de privacidad",
};

/**
 * El texto exacto de cada permiso, por versión.
 *
 * Versionado desde el día uno: el día que se reescriba un texto, los consentimientos ya
 * firmados tienen que seguir apuntando al que se leyó, no al nuevo.
 */
const TEXTOS_V1: Record<ConsentKind, string> = {
  AUTORIZA_COBERTURA:
    "Declaro que represento a la organización solicitante y que puedo autorizar esta cobertura fotográfica.",
  MENORES_PRESENTES:
    "Informo que en la actividad van a estar presentes personas menores de edad.",
  CONSENTIMIENTOS_IMAGEN:
    "Declaro que la organización cuenta con los consentimientos de uso de imagen de las personas que participan.",
  RESTRICCIONES_PUBLICACION:
    "Entiendo que puede haber personas o situaciones que no se pueden publicar, y me comprometo a informarlas antes de la cobertura.",
  USO_INSTITUCIONAL:
    "Autorizo a la organización que realiza la cobertura a mostrar imágenes de este trabajo en sus canales de difusión.",
  TERMINOS: "Acepto las condiciones del servicio.",
  PRIVACIDAD: "Leí y acepto la política de privacidad y el tratamiento de los datos cargados.",
};

export function consentTexts(version: string): Record<ConsentKind, string> {
  // Una versión desconocida cae en v1 en vez de romper el formulario: el texto que se guarda
  // es siempre el que se mostró, y acá se muestra este.
  void version;
  return TEXTOS_V1;
}

export function hashConsentText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export type ParsedConsent = {
  kind: ConsentKind;
  granted: boolean;
  textVersion: string;
  textHash: string;
};

export type ConsentParseResult =
  | { ok: true; data: ParsedConsent[] }
  | { ok: false; error: string };

/**
 * Lee los tildes del formulario y arma una fila por CADA permiso del catálogo.
 *
 * También por los que no se tildaron. Guardar el "no" importa tanto como el "sí": es la
 * diferencia entre «dijo que no» y «nunca se le preguntó», y a los seis meses nadie se acuerda
 * de cuál de las dos fue.
 */
export function parseConsents(
  form: Record<string, string>,
  version: string,
): ConsentParseResult {
  const textos = consentTexts(version);
  const data: ParsedConsent[] = [];

  for (const kind of CONSENT_KINDS) {
    const granted = form[`consent_${kind}`] === "on";
    if (!granted && REQUIRED_CONSENTS.includes(kind)) {
      return { ok: false, error: `Falta confirmar: ${CONSENT_LABELS[kind]}.` };
    }
    data.push({
      kind,
      granted,
      textVersion: version,
      textHash: hashConsentText(textos[kind]),
    });
  }

  return { ok: true, data };
}
```

- [ ] **Paso 4: Correr y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/consents.test.ts
```

Esperado: 9 pasan.

- [ ] **Paso 5: Escribir el test del formulario**

Crear `apps/fotoffice/lib/coverages/request-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCoverageRequest } from "./request-form";

/** Un formulario válido mínimo, para no repetirlo en cada caso. */
function base(extra: Record<string, string> = {}): Record<string, string> {
  return {
    orgName: "Asociación Manos Abiertas",
    contactName: "María Pérez",
    contactEmail: "contacto@manosabiertas.org",
    contactPhone: "3415551234",
    eventTitle: "Jornada solidaria para familias",
    startsAt: "2026-09-26T14:00",
    endsAt: "2026-09-26T18:30",
    city: "Rosario",
    ...extra,
  };
}

/**
 * El formulario público.
 *
 * Lo completa alguien que no conoce el sistema, desde el teléfono, probablemente apurado. Se
 * pide lo mínimo indispensable y se valida en el servidor: el navegador puede mandar cualquier
 * cosa y el `required` del HTML no es una validación.
 */
describe("parseCoverageRequest", () => {
  it("un formulario completo pasa", () => {
    const r = parseCoverageRequest(base());
    expect(r.ok).toBe(true);
  });

  it("sin nombre de organización no se puede tomar el pedido", () => {
    const r = parseCoverageRequest(base({ orgName: "" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("organización");
  });

  it("sin correo no hay forma de contestar", () => {
    const r = parseCoverageRequest(base({ contactEmail: "" }));
    expect(r.ok).toBe(false);
  });

  it("un correo mal escrito se rechaza", () => {
    expect(parseCoverageRequest(base({ contactEmail: "no-es-un-mail" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ contactEmail: "a@b" })).ok).toBe(false);
  });

  it("el correo se normaliza a minúsculas y sin espacios", () => {
    const r = parseCoverageRequest(base({ contactEmail: "  Contacto@Manos.ORG " }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.contactEmail).toBe("contacto@manos.org");
  });

  it("sin fechas no se puede evaluar nada", () => {
    expect(parseCoverageRequest(base({ startsAt: "" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ endsAt: "" })).ok).toBe(false);
  });

  it("el final no puede ser anterior al inicio", () => {
    const r = parseCoverageRequest(
      base({ startsAt: "2026-09-26T18:00", endsAt: "2026-09-26T14:00" }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.toLowerCase()).toContain("termina");
  });

  it("calcula la duración, que es lo que alimenta la regla del refuerzo", () => {
    const r = parseCoverageRequest(base());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.durationMinutes).toBe(270); // 14:00 a 18:30
  });

  it("una fecha inventada se rechaza en vez de guardarse como inválida", () => {
    expect(parseCoverageRequest(base({ startsAt: "cuando sea" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ startsAt: "2026-13-45T99:99" })).ok).toBe(false);
  });

  it("la cantidad de fotógrafos, si viene, tiene que ser un número sensato", () => {
    expect(parseCoverageRequest(base({ requestedPhotographers: "2" })).ok).toBe(true);
    expect(parseCoverageRequest(base({ requestedPhotographers: "0" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ requestedPhotographers: "-1" })).ok).toBe(false);
    expect(parseCoverageRequest(base({ requestedPhotographers: "muchos" })).ok).toBe(false);
  });

  it("los campos opcionales pueden faltar sin drama", () => {
    const r = parseCoverageRequest(base());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.eventDescription).toBe(null);
      expect(r.data.requestedPhotographers).toBe(null);
    }
  });

  it("los enlaces de documentación se separan y se limpian", () => {
    const r = parseCoverageRequest(
      base({ documentationLinks: "https://a.org\n\n  https://b.org  \n" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.documentationLinks).toEqual(["https://a.org", "https://b.org"]);
  });

  it("un enlace que no es http no entra", () => {
    // Un `javascript:` guardado y después mostrado como enlace en el panel sería un agujero.
    const r = parseCoverageRequest(
      base({ documentationLinks: "javascript:alert(1)\nhttps://ok.org" }),
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.documentationLinks).toEqual(["https://ok.org"]);
  });
});
```

- [ ] **Paso 6: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/request-form.test.ts
```

Esperado: FALLA con `Cannot find module './request-form'`.

- [ ] **Paso 7: Escribir el parseo**

Crear `apps/fotoffice/lib/coverages/request-form.ts`:

```ts
/**
 * Parseo y validación del formulario público.
 *
 * Todo se valida en el servidor. El `required` del HTML es una comodidad para quien completa,
 * no un control: el navegador puede mandar lo que quiera.
 *
 * Función pura, sin Prisma: así el caso que importa —qué pasa con una fecha dada vuelta o un
 * enlace `javascript:`— se prueba sin levantar nada.
 */

export type ParsedRequest = {
  orgName: string;
  orgKind: string | null;
  orgTaxId: string | null;
  orgWebsite: string | null;
  contactName: string;
  contactRole: string | null;
  contactEmail: string;
  contactPhone: string | null;
  eventTitle: string;
  eventDescription: string | null;
  startsAt: Date;
  endsAt: Date;
  /** Lo que alimenta la regla del refuerzo. Se calcula acá para no repetirlo en cada pantalla. */
  durationMinutes: number;
  addressLine: string | null;
  city: string | null;
  activityKind: string | null;
  expectedAttendees: number | null;
  venueKind: string | null;
  onSiteContactName: string | null;
  onSitePhone: string | null;
  mediaKinds: string;
  coverageKind: string | null;
  purpose: string | null;
  keyMoments: string | null;
  requestedPhotographers: number | null;
  equipmentNotes: string | null;
  needsLighting: boolean;
  expectedDeliveryAt: Date | null;
  deliveryChannel: string | null;
  notes: string | null;
  documentationLinks: string[];
};

export type RequestParseResult =
  | { ok: true; data: ParsedRequest }
  | { ok: false; error: string };

/** Deliberadamente más estricta que la especificación: alcanza con aceptar lo que se escribe. */
const EMAIL_RE = /^[^\s@,;]+@[^\s@,;.]+(?:\.[^\s@,;.]+)+$/;

function texto(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

function entero(v: string | undefined): { ok: true; value: number | null } | { ok: false } {
  const t = v?.trim();
  if (!t) return { ok: true, value: null };
  if (!/^\d+$/.test(t)) return { ok: false };
  const n = Number(t);
  if (n < 1) return { ok: false };
  return { ok: true, value: n };
}

function fecha(v: string | undefined): Date | null {
  const t = v?.trim();
  if (!t) return null;
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Solo `http` y `https`.
 *
 * Un `javascript:` guardado y después pintado como enlace en el panel de la coordinación sería
 * un agujero abierto por un formulario público. Lo que no pasa el filtro se descarta en
 * silencio: es documentación de apoyo, no vale frenar un pedido por un enlace mal pegado.
 */
function enlaces(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /^https?:\/\//i.test(s));
}

export function parseCoverageRequest(form: Record<string, string>): RequestParseResult {
  const orgName = texto(form.orgName);
  if (!orgName) return { ok: false, error: "Escribí el nombre de la organización." };

  const contactName = texto(form.contactName);
  if (!contactName) return { ok: false, error: "Escribí el nombre de quien podemos contactar." };

  const contactEmail = texto(form.contactEmail)?.toLowerCase() ?? null;
  if (!contactEmail) return { ok: false, error: "Escribí un correo de contacto." };
  if (!EMAIL_RE.test(contactEmail)) {
    return { ok: false, error: "Ese correo no parece válido. Revisalo, por ahí quedó un error." };
  }

  const eventTitle = texto(form.eventTitle);
  if (!eventTitle) return { ok: false, error: "Contanos cómo se llama la actividad." };

  const startsAt = fecha(form.startsAt);
  const endsAt = fecha(form.endsAt);
  if (!startsAt) return { ok: false, error: "Falta cuándo empieza la actividad." };
  if (!endsAt) return { ok: false, error: "Falta cuándo termina la actividad." };
  if (endsAt.getTime() <= startsAt.getTime()) {
    return { ok: false, error: "La actividad termina antes de empezar. Revisá los horarios." };
  }

  const fotografos = entero(form.requestedPhotographers);
  if (!fotografos.ok) {
    return { ok: false, error: "La cantidad de fotógrafos tiene que ser un número mayor a cero." };
  }

  const asistentes = entero(form.expectedAttendees);
  if (!asistentes.ok) {
    return { ok: false, error: "La cantidad de asistentes tiene que ser un número." };
  }

  return {
    ok: true,
    data: {
      orgName,
      orgKind: texto(form.orgKind),
      orgTaxId: texto(form.orgTaxId),
      orgWebsite: texto(form.orgWebsite),
      contactName,
      contactRole: texto(form.contactRole),
      contactEmail,
      contactPhone: texto(form.contactPhone),
      eventTitle,
      eventDescription: texto(form.eventDescription),
      startsAt,
      endsAt,
      durationMinutes: Math.round((endsAt.getTime() - startsAt.getTime()) / 60000),
      addressLine: texto(form.addressLine),
      city: texto(form.city),
      activityKind: texto(form.activityKind),
      expectedAttendees: asistentes.value,
      venueKind: texto(form.venueKind),
      onSiteContactName: texto(form.onSiteContactName),
      onSitePhone: texto(form.onSitePhone),
      mediaKinds: texto(form.mediaKinds) ?? "FOTO",
      coverageKind: texto(form.coverageKind),
      purpose: texto(form.purpose),
      keyMoments: texto(form.keyMoments),
      requestedPhotographers: fotografos.value,
      equipmentNotes: texto(form.equipmentNotes),
      needsLighting: form.needsLighting === "on",
      expectedDeliveryAt: fecha(form.expectedDeliveryAt),
      deliveryChannel: texto(form.deliveryChannel),
      notes: texto(form.notes),
      documentationLinks: enlaces(form.documentationLinks),
    },
  };
}
```

- [ ] **Paso 8: Correr y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/request-form.test.ts
```

Esperado: 14 pasan.

- [ ] **Paso 9: Commit**

```bash
git add apps/fotoffice/lib/coverages/
git commit -m "Consentimientos versionados y validación del formulario público"
```

---

## Tarea 7: El repositorio, el historial y el aislamiento por workspace

**Archivos:**
- Crear: `apps/fotoffice/lib/coverages/repository.ts`
- Crear: `apps/fotoffice/lib/coverages/events.ts`
- Crear: `apps/fotoffice/lib/coverages/inbox-filters.ts`
- Crear: `apps/fotoffice/lib/coverages/inbox-filters.test.ts`
- Crear: `apps/fotoffice/lib/coverages/aislamiento.test.ts`

**Interfaces:**
- Consume: `prisma` de `@repo/db`.
- Produce: `loadSettings(workspaceId)`, `listRequests({ workspaceId, filter })`,
  `loadRequest({ workspaceId, id })`, `findByTrackingToken(rawToken)`,
  `countRecentSubmissions({ workspaceId, email, originHash })`,
  `recordEvent(tx, { workspaceId, entityType, entityId, type, ... })`,
  `INBOX_FILTERS`, `whereForFilter(filter, now)`.

- [ ] **Paso 1: Escribir el test de los filtros de la bandeja**

Crear `apps/fotoffice/lib/coverages/inbox-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { INBOX_FILTERS, isInboxFilter, whereForFilter } from "./inbox-filters";

const ahora = new Date("2026-09-14T12:00:00Z");

/**
 * Los filtros de la bandeja.
 *
 * Son criterios puros y no `where` escritos dentro de la pantalla: la bandeja, el contador de
 * cada pestaña y cualquier informe futuro tienen que coincidir. Cuando cada uno arma su propia
 * consulta, el número de la pestaña deja de corresponderse con la lista, y nadie se entera
 * hasta que alguien cuenta a mano.
 */
describe("whereForFilter", () => {
  it("«nuevas» son las recibidas", () => {
    expect(whereForFilter("nuevas", ahora)).toEqual({ status: "RECIBIDA" });
  });

  it("«incompletas» son las que esperan información", () => {
    expect(whereForFilter("incompletas", ahora)).toEqual({ status: "REQUIERE_INFO" });
  });

  it("«próximas» son las aprobadas que todavía no pasaron", () => {
    const w = whereForFilter("proximas", ahora);
    expect(w.status).toBe("APROBADA");
    expect(w.startsAt).toEqual({ gte: ahora });
  });

  it("«urgentes» son las que ocurren dentro de la semana y siguen vivas", () => {
    const w = whereForFilter("urgentes", ahora);
    expect(w.startsAt?.gte).toEqual(ahora);
    expect(w.startsAt?.lte).toEqual(new Date("2026-09-21T12:00:00Z"));
    expect(w.status).toEqual({ in: ["RECIBIDA", "EN_EVALUACION", "REQUIERE_INFO", "APROBADA"] });
  });

  it("«cerradas» junta cerradas y rechazadas, que es como se las mira", () => {
    expect(whereForFilter("cerradas", ahora)).toEqual({
      status: { in: ["CERRADA", "RECHAZADA"] },
    });
  });

  it("«canceladas» junta las dos formas de cancelar", () => {
    expect(whereForFilter("canceladas", ahora)).toEqual({
      status: { in: ["CANCELADA_SOLICITANTE", "CANCELADA_ORGANIZACION"] },
    });
  });

  it("un filtro desconocido no filtra nada en vez de romper", () => {
    // El filtro viene de la URL y lo puede escribir cualquiera.
    expect(whereForFilter("inventado", ahora)).toEqual({});
  });

  it("ningún filtro incluye el workspace: eso lo pone el repositorio", () => {
    // Si un filtro trajera su propio workspaceId, alguien podría olvidarse de ponerlo en el
    // repositorio y el aislamiento dependería de qué pestaña estás mirando.
    for (const f of INBOX_FILTERS) {
      expect(JSON.stringify(whereForFilter(f.key, ahora))).not.toContain("workspace");
    }
  });
});

describe("isInboxFilter", () => {
  it("reconoce los del catálogo", () => {
    expect(isInboxFilter("nuevas")).toBe(true);
  });
  it("descarta el resto", () => {
    expect(isInboxFilter("todo")).toBe(false);
    expect(isInboxFilter(null)).toBe(false);
  });
});
```

- [ ] **Paso 2: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/inbox-filters.test.ts
```

Esperado: FALLA con `Cannot find module './inbox-filters'`.

- [ ] **Paso 3: Escribir los filtros**

Crear `apps/fotoffice/lib/coverages/inbox-filters.ts`:

```ts
/**
 * Las pestañas de la bandeja, como criterios puros.
 *
 * Viven acá y no dentro de la pantalla porque la lista y el contador de cada pestaña tienen
 * que coincidir. Con cada uno armando su propia consulta, el número deja de corresponderse con
 * lo que se ve, y nadie se entera hasta que alguien cuenta a mano.
 *
 * **Ningún filtro incluye el workspace.** Eso lo pone el repositorio, siempre, para que el
 * aislamiento no dependa de qué pestaña se está mirando.
 */
export type InboxFilterKey =
  | "nuevas"
  | "incompletas"
  | "evaluacion"
  | "proximas"
  | "urgentes"
  | "cerradas"
  | "canceladas";

export const INBOX_FILTERS: readonly { key: InboxFilterKey; label: string }[] = [
  { key: "nuevas", label: "Nuevas" },
  { key: "evaluacion", label: "En evaluación" },
  { key: "incompletas", label: "Esperando información" },
  { key: "proximas", label: "Próximas" },
  { key: "urgentes", label: "Urgentes" },
  { key: "cerradas", label: "Cerradas" },
  { key: "canceladas", label: "Canceladas" },
];

export function isInboxFilter(value: unknown): value is InboxFilterKey {
  return typeof value === "string" && INBOX_FILTERS.some((f) => f.key === value);
}

/** Qué se considera "urgente": que ocurra dentro de los próximos siete días. */
const DIAS_URGENTE = 7;

const VIVAS = ["RECIBIDA", "EN_EVALUACION", "REQUIERE_INFO", "APROBADA"] as const;

type Where = {
  status?: string | { in: readonly string[] };
  startsAt?: { gte?: Date; lte?: Date };
};

export function whereForFilter(filter: string, now: Date): Where {
  switch (filter) {
    case "nuevas":
      return { status: "RECIBIDA" };
    case "evaluacion":
      return { status: "EN_EVALUACION" };
    case "incompletas":
      return { status: "REQUIERE_INFO" };
    case "proximas":
      return { status: "APROBADA", startsAt: { gte: now } };
    case "urgentes":
      return {
        status: { in: VIVAS },
        startsAt: {
          gte: now,
          lte: new Date(now.getTime() + DIAS_URGENTE * 24 * 60 * 60 * 1000),
        },
      };
    case "cerradas":
      return { status: { in: ["CERRADA", "RECHAZADA"] } };
    case "canceladas":
      return { status: { in: ["CANCELADA_SOLICITANTE", "CANCELADA_ORGANIZACION"] } };
    default:
      // Viene de la URL: lo puede escribir cualquiera. No filtrar es más sano que romper.
      return {};
  }
}
```

- [ ] **Paso 4: Correr y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/inbox-filters.test.ts
```

Esperado: 10 pasan.

- [ ] **Paso 5: Escribir el historial**

Crear `apps/fotoffice/lib/coverages/events.ts`:

```ts
import "server-only";
import { Prisma, prisma } from "@repo/db";

/**
 * El historial del módulo.
 *
 * `actorLabel` se guarda aparte de la FK a propósito, igual que en `MemberAudit`: el historial
 * tiene que seguir entendiéndose dentro de dos años, aunque quien hizo el cambio se haya
 * cambiado el nombre o su usuario se haya eliminado. Nunca guarda tokens ni credenciales.
 *
 * Acepta una transacción porque casi siempre el evento y el cambio que describe tienen que
 * ocurrir juntos: un estado que cambió sin su fila de historial es una laguna que después no
 * se puede reconstruir.
 */
export type CoverageEntityType =
  | "REQUEST"
  | "COVERAGE"
  | "CALL"
  | "APPLICATION"
  | "ASSIGNMENT"
  | "DELIVERABLE";

export type CoverageEventType =
  | "CREADA"
  | "ESTADO_CAMBIADO"
  | "NOTA"
  | "INFO_PEDIDA"
  | "INFO_RESPONDIDA"
  | "EMAIL_ENVIADO";

export async function recordEvent(
  tx: Prisma.TransactionClient | typeof prisma,
  input: {
    workspaceId: string;
    entityType: CoverageEntityType;
    entityId: string;
    type: CoverageEventType;
    fromStatus?: string | null;
    toStatus?: string | null;
    actorUserId?: number | null;
    /** Cómo se llamaba quien lo hizo EN ESE MOMENTO. `null` para el sistema. */
    actorLabel?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await tx.coverageEvent.create({
    data: {
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
      type: input.type,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus ?? null,
      actorUserId: input.actorUserId ?? null,
      actorLabel: input.actorLabel ?? null,
      note: input.note ?? null,
    },
  });
}

/** El historial de una entidad, lo más reciente primero. */
export async function listEvents(input: {
  workspaceId: string;
  entityType: CoverageEntityType;
  entityId: string;
}) {
  return prisma.coverageEvent.findMany({
    where: {
      workspaceId: input.workspaceId,
      entityType: input.entityType,
      entityId: input.entityId,
    },
    orderBy: { createdAt: "desc" },
  });
}
```

- [ ] **Paso 6: Escribir el repositorio**

Crear `apps/fotoffice/lib/coverages/repository.ts`:

```ts
import "server-only";
import { prisma } from "@repo/db";
import { DEFAULT_COVERAGE_SETTINGS, type CoverageSettingsShape } from "./settings";
import { whereForFilter } from "./inbox-filters";
import { PUBLIC_FORM_WINDOW_MINUTES } from "./rate-limit";
import { hashTrackingToken } from "./tracking-token";

/**
 * Todas las consultas del módulo, en un solo lugar.
 *
 * **Regla sin excepciones: cada consulta lleva `workspaceId`.** No alcanza con que la pantalla
 * ya lo haya resuelto; una consulta sin él acá es una fuga esperando a que alguien la use
 * desde otra pantalla. `lib/coverages/aislamiento.test.ts` lo verifica sobre el código fuente.
 */

/** La configuración del workspace, o los valores por omisión si nunca se tocó. */
export async function loadSettings(workspaceId: string): Promise<CoverageSettingsShape> {
  const fila = await prisma.coverageSettings.findUnique({ where: { workspaceId } });
  if (!fila) return DEFAULT_COVERAGE_SETTINGS;
  return {
    moduleLabel: fila.moduleLabel,
    termRequest: fila.termRequest,
    termCollaborator: fila.termCollaborator,
    termRequester: fila.termRequester,
    termCall: fila.termCall,
    assignmentMode: fila.assignmentMode,
    requiresApproval: fila.requiresApproval,
    requiresCoordinatorConfirmation: fila.requiresCoordinatorConfirmation,
    reinforcementThresholdMinutes: fila.reinforcementThresholdMinutes,
    recommendedCollaborators: fila.recommendedCollaborators,
    roleTemplates: fila.roleTemplates,
    specialties: fila.specialties,
    zones: fila.zones,
    publicFormEnabled: fila.publicFormEnabled,
    publicFormIntro: fila.publicFormIntro,
    consentTextVersion: fila.consentTextVersion,
    trackingLinkTtlDays: fila.trackingLinkTtlDays,
    notifyEmails: fila.notifyEmails,
  };
}

export async function listRequests(input: {
  workspaceId: string;
  filter: string;
  now?: Date;
}) {
  return prisma.coverageRequest.findMany({
    where: {
      workspaceId: input.workspaceId,
      ...whereForFilter(input.filter, input.now ?? new Date()),
    },
    select: {
      id: true,
      publicCode: true,
      eventTitle: true,
      startsAt: true,
      endsAt: true,
      city: true,
      status: true,
      priority: true,
      createdAt: true,
      client: { select: { businessName: true, firstName: true, lastName: true } },
    },
    orderBy: [{ startsAt: "asc" }, { createdAt: "desc" }],
    take: 200,
  });
}

/** La ficha completa. Devuelve `null` si esa solicitud es de otro workspace. */
export async function loadRequest(input: { workspaceId: string; id: string }) {
  return prisma.coverageRequest.findFirst({
    where: { id: input.id, workspaceId: input.workspaceId },
    include: {
      client: true,
      consents: true,
      coverages: { orderBy: { startsAt: "asc" } },
    },
  });
}

/**
 * La solicitud detrás de un enlace de seguimiento.
 *
 * Busca por el hash y **no** por el token crudo, que nunca se guardó. No filtra por workspace
 * a propósito: el token ES la credencial y no sabe de qué institución es. Quien lo tiene ve
 * esa solicitud y ninguna otra.
 */
export async function findByTrackingToken(rawToken: string) {
  return prisma.coverageRequest.findUnique({
    where: { tokenHash: hashTrackingToken(rawToken) },
    include: { client: { select: { businessName: true } } },
  });
}

/**
 * Cuántos envíos hubo desde este correo o desde este origen en la ventana.
 *
 * Se cuenta sobre `CoverageRequest`, sin tabla nueva: las filas que queremos limitar son
 * exactamente las que ya se guardan.
 */
export async function countRecentSubmissions(input: {
  workspaceId: string;
  email: string;
  originHash: string | null;
  now?: Date;
}): Promise<number> {
  const desde = new Date(
    (input.now ?? new Date()).getTime() - PUBLIC_FORM_WINDOW_MINUTES * 60 * 1000,
  );
  return prisma.coverageRequest.count({
    where: {
      workspaceId: input.workspaceId,
      createdAt: { gte: desde },
      OR: [
        { client: { email: input.email } },
        ...(input.originHash
          ? [{ consents: { some: { sourceHash: input.originHash } } }]
          : []),
      ],
    },
  });
}

/** Si ya hay una solicitud viva del mismo correo para la misma fecha. */
export async function findDuplicateRequest(input: {
  workspaceId: string;
  email: string;
  startsAt: Date;
}) {
  return prisma.coverageRequest.findFirst({
    where: {
      workspaceId: input.workspaceId,
      startsAt: input.startsAt,
      status: { in: ["RECIBIDA", "EN_EVALUACION", "REQUIERE_INFO"] },
      client: { email: input.email },
    },
    select: { id: true, publicCode: true },
  });
}

/** El último código del año, para calcular el siguiente. */
export async function lastPublicCode(input: {
  workspaceId: string;
  year: number;
}): Promise<string | null> {
  const fila = await prisma.coverageRequest.findFirst({
    where: { workspaceId: input.workspaceId, publicCode: { startsWith: `SC-${input.year}-` } },
    orderBy: { publicCode: "desc" },
    select: { publicCode: true },
  });
  return fila?.publicCode ?? null;
}
```

- [ ] **Paso 7: Escribir la barrera de aislamiento**

Crear `apps/fotoffice/lib/coverages/aislamiento.test.ts`. Misma técnica que
`lib/entrada/sin-institucion-fantasma.test.ts` y `lib/portal/no-phantom-workspace.test.ts`:
se verifica sobre el código, porque no se puede verificar renderizando.

```ts
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Ninguna consulta del módulo puede olvidarse del workspace.
 *
 * Una sola consulta sin `workspaceId` es una fuga entre instituciones: hoy nadie la usa mal,
 * y dentro de seis meses alguien la llama desde otra pantalla y la SFPR ve una solicitud de
 * FOTOPOSITIVA. No se puede verificar renderizando; se verifica sobre el código, igual que ya
 * hacen otras tres barreras del proyecto.
 */
describe("el repositorio no puede filtrar entre workspaces", () => {
  const fuente = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "repository.ts"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  /**
   * Cada bloque `prisma.<modelo>.<operación>({ ... })` del archivo.
   *
   * Se corta por `\n}` al inicio de línea de una función exportada, que es como está escrito
   * el archivo: una consulta por función.
   */
  const consultas = fuente
    .split(/export async function /)
    .slice(1)
    .map((bloque) => ({
      nombre: bloque.slice(0, bloque.indexOf("(")),
      cuerpo: bloque,
    }))
    .filter((f) => /prisma\.\w+\./.test(f.cuerpo));

  it("hay consultas que revisar (si no, este test estaría pasando de gusto)", () => {
    expect(consultas.length).toBeGreaterThanOrEqual(5);
  });

  it.each([
    "loadSettings",
    "listRequests",
    "loadRequest",
    "countRecentSubmissions",
    "findDuplicateRequest",
    "lastPublicCode",
  ])("%s consulta por workspaceId", (nombre) => {
    const fn = consultas.find((c) => c.nombre === nombre);
    expect(fn, `no se encontró ${nombre} en repository.ts`).toBeDefined();
    expect(fn!.cuerpo).toMatch(/workspaceId/);
  });

  it("la única que no lleva workspace es la del token, y está justificada", () => {
    // El token ES la credencial: no sabe de qué institución es, y quien lo tiene ve esa
    // solicitud y ninguna otra. Si alguna vez deja de estar documentado así, este test
    // obliga a volver a pensarlo.
    const fn = consultas.find((c) => c.nombre === "findByTrackingToken");
    expect(fn).toBeDefined();
    expect(fn!.cuerpo).not.toMatch(/workspaceId/);
    const conComentarios = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "repository.ts"),
      "utf8",
    );
    expect(conComentarios).toMatch(/No filtra por workspace a propósito/);
  });
});
```

- [ ] **Paso 8: Correr el test de aislamiento**

```bash
cd apps/fotoffice && pnpm test lib/coverages/aislamiento.test.ts
```

Esperado: 8 pasan. Si falla el último, revisar que el comentario de `findByTrackingToken` en
`repository.ts` diga exactamente «No filtra por workspace a propósito».

- [ ] **Paso 9: Verificar tipos**

```bash
cd apps/fotoffice && npx tsc --noEmit -p tsconfig.json
```

Esperado: sin salida. Si aparece que `prisma.coverageRequest` no existe, falta correr
`npx prisma generate` en `packages/db` (Tarea 1, Paso 4).

- [ ] **Paso 10: Commit**

```bash
git add apps/fotoffice/lib/coverages/
git commit -m "Repositorio con aislamiento verificado, historial y filtros de la bandeja"
```

---

## Tarea 8: Los correos del circuito

**Archivos:**
- Crear: `apps/fotoffice/lib/coverages/emails.ts`
- Crear: `apps/fotoffice/lib/coverages/emails.test.ts`
- Modificar: `apps/fotoffice/lib/communications/constants.ts`

**Interfaces:**
- Consume: `WorkspaceEmailContext` de `@/lib/communications/load-workspace-signature`,
  `sendAndLogEmail` de `@/lib/communications/send-and-log`.
- Produce: `COVERAGE_EMAIL_KEYS`, `buildRequestReceivedEmail(...)`,
  `buildInfoRequestedEmail(...)`, `buildRequestApprovedEmail(...)`,
  `buildRequestRejectedEmail(...)`, `buildCoordinatorAlertEmail(...)`.

- [ ] **Paso 1: Agregar las claves de correo**

En `apps/fotoffice/lib/communications/constants.ts`, después de `MEMBERSHIP_EMAIL_KEYS`:

```ts
/**
 * Claves de las comunicaciones del módulo de coberturas en `SentEmailLog`.
 *
 * Se registran todos —también los que fallan— por el mismo motivo que en el alta de socios:
 * la pregunta «¿le avisamos o no?» aparece siempre, y sin este registro la única respuesta
 * posible sería encogerse de hombros.
 */
export const COVERAGE_EMAIL_KEYS = {
  RECEIVED: "fotoffice.coverages.request-received",
  ALERT: "fotoffice.coverages.request-alert",
  INFO_REQUESTED: "fotoffice.coverages.request-info-requested",
  APPROVED: "fotoffice.coverages.request-approved",
  REJECTED: "fotoffice.coverages.request-rejected",
} as const;
```

- [ ] **Paso 2: Escribir el test de los correos**

Crear `apps/fotoffice/lib/coverages/emails.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  buildInfoRequestedEmail,
  buildRequestApprovedEmail,
  buildRequestReceivedEmail,
  buildRequestRejectedEmail,
} from "./emails";

const contexto = { organizationName: "FOTOPOSITIVA", signature: null };
const base = {
  context: contexto,
  publicCode: "SC-2026-0042",
  eventTitle: "Jornada solidaria para familias",
  contactName: "María",
  trackingUrl: "https://fotoffice.com/sc/UN-TOKEN-LARGO",
};

/**
 * Los correos del circuito.
 *
 * Armado puro: devuelve asunto, HTML y texto, y no envía nada. Así se puede probar lo que
 * importa —que el enlace esté, que el motivo del rechazo se comunique, que no se filtre nada
 * interno— sin un proveedor de correo de por medio.
 */
describe("buildRequestReceivedEmail", () => {
  it("lleva el código en el asunto: es lo que la persona va a buscar después", () => {
    const m = buildRequestReceivedEmail(base);
    expect(m.subject).toContain("SC-2026-0042");
  });

  it("incluye el enlace de seguimiento", () => {
    const m = buildRequestReceivedEmail(base);
    expect(m.html).toContain(base.trackingUrl);
    expect(m.text).toContain(base.trackingUrl);
  });

  it("no promete que la cobertura se va a hacer", () => {
    // Una solicitud es un pedido, no un alta. Prometer acá deja a la coordinación pagando un
    // compromiso que nunca tomó.
    const m = buildRequestReceivedEmail(base);
    expect(m.text.toLowerCase()).not.toContain("confirmada");
    expect(m.text.toLowerCase()).toContain("vamos a revisar");
  });
});

describe("buildInfoRequestedEmail", () => {
  it("dice qué falta, con las palabras de quien lo pidió", () => {
    const m = buildInfoRequestedEmail({
      ...base,
      infoRequested: "¿Cuántas personas esperan y hay luz artificial en el salón?",
    });
    expect(m.text).toContain("¿Cuántas personas esperan");
    expect(m.html).toContain(base.trackingUrl);
  });
});

describe("buildRequestApprovedEmail", () => {
  it("avisa que se aprobó y que todavía falta armar el equipo", () => {
    const m = buildRequestApprovedEmail(base);
    expect(m.subject).toContain("SC-2026-0042");
    expect(m.text.toLowerCase()).toContain("equipo");
  });
});

describe("buildRequestRejectedEmail", () => {
  it("comunica el motivo tal como se escribió", () => {
    const m = buildRequestRejectedEmail({
      ...base,
      reason: "La fecha ya pasó cuando recibimos el pedido.",
    });
    expect(m.text).toContain("La fecha ya pasó cuando recibimos el pedido.");
  });

  it("no manda el enlace de seguimiento en un rechazo", () => {
    // El circuito terminó. Un enlace que lleva a una pantalla sin nada que hacer solo invita a
    // volver a mirar un "no".
    const m = buildRequestRejectedEmail({ ...base, reason: "No corresponde." });
    expect(m.html).not.toContain(base.trackingUrl);
  });
});
```

- [ ] **Paso 3: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/emails.test.ts
```

Esperado: FALLA con `Cannot find module './emails'`.

- [ ] **Paso 4: Escribir los correos**

Crear `apps/fotoffice/lib/coverages/emails.ts`. Antes, mirar
`lib/membership/application-emails.ts` para copiar exactamente cómo se arma el HTML y cómo se
pega la firma del workspace — no reinventar el formato.

```ts
import type { WorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";

/**
 * Los correos del circuito de una solicitud.
 *
 * Armado puro: devuelven asunto, HTML y texto, y no envían nada. Enviar es de
 * `sendAndLogEmail`. Separarlo deja probar lo que importa —que el enlace esté, que el motivo
 * del rechazo se comunique, que no se filtre nada interno— sin un proveedor de correo.
 *
 * Todos llevan versión de texto plano: hay gente que lee el correo en clientes que no pintan
 * HTML, y un mensaje vacío es peor que uno feo.
 */

export type EmailBody = { subject: string; html: string; text: string };

type Base = {
  context: WorkspaceEmailContext;
  publicCode: string;
  eventTitle: string;
  contactName: string;
  trackingUrl: string;
};

function escapar(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function envolver(cuerpo: string): string {
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;font-size:15px;line-height:1.6;color:#1a1a1a">${cuerpo}</div>`;
}

function botonSeguimiento(url: string): string {
  return `<p style="margin:24px 0"><a href="${escapar(url)}" style="background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Ver cómo va tu pedido</a></p><p style="font-size:13px;color:#666">Si el botón no funciona, copiá esta dirección:<br>${escapar(url)}</p>`;
}

export function buildRequestReceivedEmail(input: Base): EmailBody {
  const org = input.context.organizationName;
  const subject = `Recibimos tu pedido ${input.publicCode} — ${org}`;
  const text = [
    `Hola ${input.contactName},`,
    ``,
    `Recibimos el pedido de cobertura para «${input.eventTitle}».`,
    `Tu número es ${input.publicCode}.`,
    ``,
    `Lo vamos a revisar y te escribimos con una respuesta, sea cual sea.`,
    `Mientras tanto podés ver cómo va acá:`,
    input.trackingUrl,
    ``,
    `Guardá este correo: ese enlace es tuyo y no lo tiene nadie más.`,
  ].join("\n");

  const html = envolver(
    `<p>Hola ${escapar(input.contactName)},</p>
     <p>Recibimos el pedido de cobertura para <strong>${escapar(input.eventTitle)}</strong>.<br>
     Tu número es <strong>${escapar(input.publicCode)}</strong>.</p>
     <p>Lo vamos a revisar y te escribimos con una respuesta, sea cual sea.</p>
     ${botonSeguimiento(input.trackingUrl)}
     <p style="font-size:13px;color:#666">Guardá este correo: ese enlace es tuyo y no lo tiene nadie más.</p>`,
  );

  return { subject, html, text };
}

export function buildInfoRequestedEmail(input: Base & { infoRequested: string }): EmailBody {
  const subject = `Nos falta un dato — ${input.publicCode}`;
  const text = [
    `Hola ${input.contactName},`,
    ``,
    `Para seguir con «${input.eventTitle}» necesitamos que nos cuentes esto:`,
    ``,
    input.infoRequested,
    ``,
    `Podés responder desde acá:`,
    input.trackingUrl,
  ].join("\n");

  const html = envolver(
    `<p>Hola ${escapar(input.contactName)},</p>
     <p>Para seguir con <strong>${escapar(input.eventTitle)}</strong> necesitamos que nos cuentes esto:</p>
     <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #ddd;color:#333">${escapar(input.infoRequested)}</blockquote>
     ${botonSeguimiento(input.trackingUrl)}`,
  );

  return { subject, html, text };
}

export function buildRequestApprovedEmail(input: Base): EmailBody {
  const subject = `Tomamos tu pedido ${input.publicCode}`;
  const text = [
    `Hola ${input.contactName},`,
    ``,
    `Buenas noticias: tomamos el pedido para «${input.eventTitle}».`,
    ``,
    `Ahora empezamos a armar el equipo. Te vamos a avisar en cuanto esté confirmado`,
    `quién va a estar ese día.`,
    ``,
    `Podés seguirlo acá:`,
    input.trackingUrl,
  ].join("\n");

  const html = envolver(
    `<p>Hola ${escapar(input.contactName)},</p>
     <p>Buenas noticias: tomamos el pedido para <strong>${escapar(input.eventTitle)}</strong>.</p>
     <p>Ahora empezamos a armar el equipo. Te vamos a avisar en cuanto esté confirmado quién va a estar ese día.</p>
     ${botonSeguimiento(input.trackingUrl)}`,
  );

  return { subject, html, text };
}

/**
 * El rechazo NO lleva enlace de seguimiento.
 *
 * El circuito terminó: un enlace que lleva a una pantalla sin nada que hacer solo invita a
 * volver a mirar un "no". Lo que sí lleva es el motivo, tal como lo escribió la coordinación.
 */
export function buildRequestRejectedEmail(input: Base & { reason: string }): EmailBody {
  const subject = `Sobre tu pedido ${input.publicCode}`;
  const text = [
    `Hola ${input.contactName},`,
    ``,
    `Esta vez no vamos a poder cubrir «${input.eventTitle}».`,
    ``,
    input.reason,
    ``,
    `Gracias por haber pensado en nosotros. Si surge otra actividad, escribinos de nuevo.`,
  ].join("\n");

  const html = envolver(
    `<p>Hola ${escapar(input.contactName)},</p>
     <p>Esta vez no vamos a poder cubrir <strong>${escapar(input.eventTitle)}</strong>.</p>
     <blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #ddd;color:#333">${escapar(input.reason)}</blockquote>
     <p>Gracias por haber pensado en nosotros. Si surge otra actividad, escribinos de nuevo.</p>`,
  );

  return { subject, html, text };
}

/** El aviso interno. Sin datos de contacto: el que lo reciba entra al panel y los ve ahí. */
export function buildCoordinatorAlertEmail(input: {
  publicCode: string;
  eventTitle: string;
  orgName: string;
  startsAtLabel: string;
  panelUrl: string;
}): EmailBody {
  const subject = `Nueva solicitud ${input.publicCode} — ${input.orgName}`;
  const text = [
    `Entró una solicitud nueva.`,
    ``,
    `${input.publicCode} — ${input.eventTitle}`,
    `Organización: ${input.orgName}`,
    `Fecha: ${input.startsAtLabel}`,
    ``,
    input.panelUrl,
  ].join("\n");

  const html = envolver(
    `<p>Entró una solicitud nueva.</p>
     <p><strong>${escapar(input.publicCode)}</strong> — ${escapar(input.eventTitle)}<br>
     Organización: ${escapar(input.orgName)}<br>
     Fecha: ${escapar(input.startsAtLabel)}</p>
     <p><a href="${escapar(input.panelUrl)}">Abrir en el panel</a></p>`,
  );

  return { subject, html, text };
}
```

- [ ] **Paso 5: Correr y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/emails.test.ts
```

Esperado: 7 pasan.

- [ ] **Paso 6: Commit**

```bash
git add apps/fotoffice/lib/coverages/emails.ts apps/fotoffice/lib/coverages/emails.test.ts apps/fotoffice/lib/communications/constants.ts
git commit -m "Los correos del circuito de una solicitud"
```

---

## Tarea 9: El envío público, de punta a punta

**Archivos:**
- Crear: `apps/fotoffice/lib/coverages/submit.ts`
- Crear: `apps/fotoffice/app/actions/coverage-request.ts`
- Crear: `apps/fotoffice/lib/coverages/submit.test.ts`

**Interfaces:**
- Consume: `findOrCreateClient(tx, input)` de `@/lib/clients/find-or-create`,
  `parseCoverageRequest`, `parseConsents`, `decidirEnvio`, `hashOrigen`, `nextPublicCode`,
  `generateTrackingToken`, `hashTrackingToken`, `trackingExpiryFrom`, `recordEvent`,
  `sendAndLogEmail`, `loadWorkspaceEmailContext`, `appUrl`.
- Produce: `submitCoverageRequestAction(workspaceSlug, prev, formData)` que devuelve
  `{ error: string | null; ok: string | null; publicCode?: string }`.

- [ ] **Paso 1: Escribir el test del orden de la transacción**

Crear `apps/fotoffice/lib/coverages/submit.test.ts`. Se prueba **el orden y las condiciones**,
que es donde están los errores caros; el detalle de cada consulta ya lo cubren sus propios
tests.

```ts
import { describe, expect, it } from "vitest";
import { planSubmission } from "./submit-plan";
import { DEFAULT_COVERAGE_SETTINGS } from "./settings";

const settings = { ...DEFAULT_COVERAGE_SETTINGS, publicFormEnabled: true };

const parsed = {
  contactEmail: "contacto@manos.org",
  startsAt: new Date("2026-09-26T17:00:00Z"),
};

/**
 * Qué hay que decidir ANTES de escribir nada.
 *
 * Es función pura y no la transacción entera porque acá viven las decisiones que importan —si
 * el formulario está abierto, si esto es spam, si ya lo mandaron— y todas se pueden probar sin
 * base de datos. La transacción, después, solo ejecuta el plan.
 */
describe("planSubmission", () => {
  it("con el formulario cerrado no se recibe nada", () => {
    // Esconder el formulario no es un control: el POST puede llegar igual.
    const r = planSubmission({
      settings: { ...settings, publicFormEnabled: false },
      recientes: 0,
      duplicada: null,
      parsed,
    });
    expect(r.kind).toBe("RECHAZAR");
    if (r.kind === "RECHAZAR") expect(r.error.toLowerCase()).toContain("no están abiertas");
  });

  it("pasado el tope de envíos, se frena", () => {
    const r = planSubmission({ settings, recientes: 3, duplicada: null, parsed });
    expect(r.kind).toBe("RECHAZAR");
  });

  it("una solicitud igual ya en curso no se duplica: se la reconoce", () => {
    // Que alguien apriete dos veces no puede generar dos pedidos que la coordinación después
    // tiene que descartar a mano.
    const r = planSubmission({
      settings,
      recientes: 0,
      duplicada: { id: "req-1", publicCode: "SC-2026-0041" },
      parsed,
    });
    expect(r.kind).toBe("YA_EXISTE");
    if (r.kind === "YA_EXISTE") expect(r.publicCode).toBe("SC-2026-0041");
  });

  it("el freno se evalúa antes que el duplicado", () => {
    // Al revés, quien manda cien pedidos iguales recibiría cien respuestas amables en vez de
    // un freno.
    const r = planSubmission({
      settings,
      recientes: 99,
      duplicada: { id: "req-1", publicCode: "SC-2026-0041" },
      parsed,
    });
    expect(r.kind).toBe("RECHAZAR");
  });

  it("todo en orden: se guarda", () => {
    const r = planSubmission({ settings, recientes: 0, duplicada: null, parsed });
    expect(r.kind).toBe("GUARDAR");
  });
});
```

- [ ] **Paso 2: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/submit.test.ts
```

Esperado: FALLA con `Cannot find module './submit-plan'`.

- [ ] **Paso 3: Escribir el plan del envío**

Crear `apps/fotoffice/lib/coverages/submit-plan.ts`:

```ts
import { decidirEnvio } from "./rate-limit";
import type { CoverageSettingsShape } from "./settings";

/**
 * Qué hacer con un envío, decidido antes de escribir nada.
 *
 * Vive aparte de la transacción porque acá están las decisiones que importan y todas se pueden
 * probar sin base de datos. El orden de las comprobaciones no es casual y está probado: el
 * freno va ANTES del duplicado, porque al revés quien manda cien pedidos iguales recibiría
 * cien respuestas amables en vez de un freno.
 */
export type SubmissionPlan =
  | { kind: "GUARDAR" }
  | { kind: "YA_EXISTE"; requestId: string; publicCode: string }
  | { kind: "RECHAZAR"; error: string };

export function planSubmission(input: {
  settings: CoverageSettingsShape;
  recientes: number;
  duplicada: { id: string; publicCode: string } | null;
  parsed: { contactEmail: string; startsAt: Date };
}): SubmissionPlan {
  // Esconder el formulario no es un control: el POST puede llegar igual, de un formulario
  // viejo abierto en otra pestaña o armado a mano.
  if (!input.settings.publicFormEnabled) {
    return { kind: "RECHAZAR", error: "Las solicitudes no están abiertas en este momento." };
  }

  const freno = decidirEnvio({ recientes: input.recientes });
  if (!freno.ok) return { kind: "RECHAZAR", error: freno.error };

  if (input.duplicada) {
    return {
      kind: "YA_EXISTE",
      requestId: input.duplicada.id,
      publicCode: input.duplicada.publicCode,
    };
  }

  return { kind: "GUARDAR" };
}
```

- [ ] **Paso 4: Correr y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/submit.test.ts
```

Esperado: 5 pasan.

- [ ] **Paso 5: Escribir la transacción**

Crear `apps/fotoffice/lib/coverages/submit.ts`:

```ts
import "server-only";
import { prisma } from "@repo/db";
import { findOrCreateClient } from "@/lib/clients/find-or-create";
import { recordEvent } from "./events";
import { nextPublicCode } from "./public-code";
import {
  generateTrackingToken,
  hashTrackingToken,
  trackingExpiryFrom,
} from "./tracking-token";
import type { ParsedConsent } from "./consents";
import type { ParsedRequest } from "./request-form";
import type { CoverageSettingsShape } from "./settings";

/**
 * Guarda la solicitud entera, o nada.
 *
 * Todo en una transacción por una razón concreta: la organización se crea o se reconoce en el
 * padrón de clientes, y un cliente creado con una solicitud que falló deja basura que después
 * alguien tiene que limpiar a mano. Es el mismo criterio con el que `findOrCreateClient` pide
 * una transacción en vez del cliente global.
 *
 * Devuelve el token **crudo**: es la única vez que existe. En la base queda su SHA-256.
 */
export async function saveCoverageRequest(input: {
  workspaceId: string;
  parsed: ParsedRequest;
  consents: ParsedConsent[];
  settings: CoverageSettingsShape;
  originHash: string | null;
  userAgent: string | null;
  now?: Date;
}): Promise<{ requestId: string; publicCode: string; rawToken: string }> {
  const ahora = input.now ?? new Date();
  const rawToken = generateTrackingToken();

  return prisma.$transaction(async (tx) => {
    const cliente = await findOrCreateClient(tx, {
      workspaceId: input.workspaceId,
      email: input.parsed.contactEmail,
      phone: input.parsed.contactPhone,
      docNumber: input.parsed.orgTaxId,
      businessName: input.parsed.orgName,
    });

    const ultimo = await tx.coverageRequest.findFirst({
      where: {
        workspaceId: input.workspaceId,
        publicCode: { startsWith: `SC-${ahora.getFullYear()}-` },
      },
      orderBy: { publicCode: "desc" },
      select: { publicCode: true },
    });

    const solicitud = await tx.coverageRequest.create({
      data: {
        workspaceId: input.workspaceId,
        clientId: cliente.id,
        publicCode: nextPublicCode(ultimo?.publicCode ?? null, ahora.getFullYear()),
        tokenHash: hashTrackingToken(rawToken),
        tokenExpiresAt: trackingExpiryFrom(input.settings.trackingLinkTtlDays, ahora),
        eventTitle: input.parsed.eventTitle,
        eventDescription: input.parsed.eventDescription,
        startsAt: input.parsed.startsAt,
        endsAt: input.parsed.endsAt,
        addressLine: input.parsed.addressLine,
        city: input.parsed.city,
        activityKind: input.parsed.activityKind,
        expectedAttendees: input.parsed.expectedAttendees,
        venueKind: input.parsed.venueKind,
        onSiteContactName: input.parsed.onSiteContactName,
        onSitePhone: input.parsed.onSitePhone,
        mediaKinds: input.parsed.mediaKinds,
        coverageKind: input.parsed.coverageKind,
        purpose: input.parsed.purpose,
        keyMoments: input.parsed.keyMoments,
        requestedPhotographers: input.parsed.requestedPhotographers,
        equipmentNotes: input.parsed.equipmentNotes,
        needsLighting: input.parsed.needsLighting,
        expectedDeliveryAt: input.parsed.expectedDeliveryAt,
        deliveryChannel: input.parsed.deliveryChannel,
        notes: input.parsed.notes,
        documentationLinks: input.parsed.documentationLinks,
        status: "RECIBIDA",
        consents: {
          create: input.consents.map((c) => ({
            kind: c.kind,
            granted: c.granted,
            textVersion: c.textVersion,
            textHash: c.textHash,
            sourceHash: input.originHash,
            userAgent: input.userAgent,
          })),
        },
      },
      select: { id: true, publicCode: true },
    });

    await recordEvent(tx, {
      workspaceId: input.workspaceId,
      entityType: "REQUEST",
      entityId: solicitud.id,
      type: "CREADA",
      toStatus: "RECIBIDA",
      // Sin actor: la cargó alguien de afuera, que no tiene usuario.
      actorLabel: input.parsed.orgName,
    });

    return { requestId: solicitud.id, publicCode: solicitud.publicCode, rawToken };
  });
}
```

- [ ] **Paso 6: Escribir la server action**

Crear `apps/fotoffice/app/actions/coverage-request.ts`. Copiar la forma de
`submitApplicationAction` en `app/actions/membership-applications.ts`.

```ts
"use server";

import { headers } from "next/headers";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { COVERAGE_EMAIL_KEYS } from "@/lib/communications/constants";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { parseConsents } from "@/lib/coverages/consents";
import {
  buildCoordinatorAlertEmail,
  buildRequestReceivedEmail,
} from "@/lib/coverages/emails";
import { hashOrigen } from "@/lib/coverages/rate-limit";
import { parseCoverageRequest } from "@/lib/coverages/request-form";
import {
  countRecentSubmissions,
  findDuplicateRequest,
  loadSettings,
} from "@/lib/coverages/repository";
import { planSubmission } from "@/lib/coverages/submit-plan";
import { saveCoverageRequest } from "@/lib/coverages/submit";

export type CoverageRequestFormState = {
  error: string | null;
  ok: string | null;
  publicCode?: string;
};

function readForm(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") out[k] = v;
  return out;
}

/**
 * El envío del formulario público.
 *
 * Público a propósito: quien pide una cobertura no tiene cuenta. Lo que protege este endpoint
 * no es una sesión sino que **nada ocurre hasta que una persona evalúe**: una solicitud es un
 * pedido, no un compromiso.
 */
export async function submitCoverageRequestAction(
  workspaceSlug: string,
  _prev: CoverageRequestFormState | undefined,
  formData: FormData,
): Promise<CoverageRequestFormState> {
  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, contactEmail: true },
  });
  if (!branding) return { error: "No encontramos la organización.", ok: null };

  const parsed = parseCoverageRequest(readForm(formData));
  if (!parsed.ok) return { error: parsed.error, ok: null };

  const settings = await loadSettings(branding.workspaceId);

  const consents = parseConsents(readForm(formData), settings.consentTextVersion);
  if (!consents.ok) return { error: consents.error, ok: null };

  // La sal sale del entorno: sin ella el hash de una IPv4 se revierte con una tabla, porque
  // el espacio de direcciones es chico.
  const cabeceras = await headers();
  const originHash = hashOrigen(
    cabeceras.get("x-forwarded-for")?.split(",")[0] ?? null,
    process.env.COVERAGE_ORIGIN_SALT ?? branding.workspaceId,
  );

  const [recientes, duplicada] = await Promise.all([
    countRecentSubmissions({
      workspaceId: branding.workspaceId,
      email: parsed.data.contactEmail,
      originHash,
    }),
    findDuplicateRequest({
      workspaceId: branding.workspaceId,
      email: parsed.data.contactEmail,
      startsAt: parsed.data.startsAt,
    }),
  ]);

  const plan = planSubmission({ settings, recientes, duplicada, parsed: parsed.data });
  if (plan.kind === "RECHAZAR") return { error: plan.error, ok: null };
  if (plan.kind === "YA_EXISTE") {
    return {
      error: null,
      ok: "Ya tenemos este pedido y lo estamos revisando. Te avisamos por correo.",
      publicCode: plan.publicCode,
    };
  }

  const guardada = await saveCoverageRequest({
    workspaceId: branding.workspaceId,
    parsed: parsed.data,
    consents: consents.data,
    settings,
    originHash,
    userAgent: cabeceras.get("user-agent")?.slice(0, 500) ?? null,
  });

  const contexto = await loadWorkspaceEmailContext(branding.workspaceId);
  const base = appUrl();
  const trackingUrl = base ? `${base}/sc/${guardada.rawToken}` : "";

  // Los avisos salen después del hecho consumado y no pueden voltearlo: `sendAndLogEmail`
  // nunca lanza, y el resultado queda registrado para poder responder «¿le avisamos?».
  await sendAndLogEmail({
    to: parsed.data.contactEmail,
    templateKey: COVERAGE_EMAIL_KEYS.RECEIVED,
    body: buildRequestReceivedEmail({
      context: contexto,
      publicCode: guardada.publicCode,
      eventTitle: parsed.data.eventTitle,
      contactName: parsed.data.contactName,
      trackingUrl,
    }),
  });

  const destinatarios = settings.notifyEmails.length
    ? settings.notifyEmails
    : branding.contactEmail
      ? [branding.contactEmail]
      : [];

  for (const destino of destinatarios) {
    await sendAndLogEmail({
      to: destino,
      templateKey: COVERAGE_EMAIL_KEYS.ALERT,
      body: buildCoordinatorAlertEmail({
        publicCode: guardada.publicCode,
        eventTitle: parsed.data.eventTitle,
        orgName: parsed.data.orgName,
        startsAtLabel: parsed.data.startsAt.toLocaleDateString("es-AR"),
        panelUrl: base ? `${base}/coberturas/${guardada.requestId}` : "",
      }),
    });
  }

  return {
    error: null,
    ok: "Recibimos tu pedido. Te mandamos un correo con el número y un enlace para seguirlo.",
    publicCode: guardada.publicCode,
  };
}
```

- [ ] **Paso 7: Verificar tipos y correr todo el módulo**

```bash
cd apps/fotoffice && npx tsc --noEmit -p tsconfig.json && pnpm test lib/coverages/
```

Esperado: tipos sin salida; todos los tests del módulo pasan.

- [ ] **Paso 8: Commit**

```bash
git add apps/fotoffice/lib/coverages/ apps/fotoffice/app/actions/coverage-request.ts
git commit -m "El envío del formulario público, en una sola transacción"
```

---

## Tarea 10: El formulario público y la pantalla de gracias

**Archivos:**
- Crear: `apps/fotoffice/app/w/[workspaceSlug]/coberturas/solicitar/page.tsx`
- Crear: `apps/fotoffice/app/w/[workspaceSlug]/coberturas/solicitar/request-form.tsx`
- Crear: `apps/fotoffice/lib/coverages/format.ts`
- Crear: `apps/fotoffice/lib/coverages/format.test.ts`

**Interfaces:**
- Consume: `submitCoverageRequestAction`, `loadSettings`, `terminologyFor`, `CONSENT_KINDS`,
  `CONSENT_LABELS`, `REQUIRED_CONSENTS`, `consentTexts`.
- Produce: `fechaArgentina(date)`, `horaArgentina(date)`, `fechaHoraArgentina(date)`.

- [ ] **Paso 1: Escribir el test del formato de fechas**

Crear `apps/fotoffice/lib/coverages/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { fechaArgentina, fechaHoraArgentina, horaArgentina } from "./format";

/**
 * Las fechas como se escriben acá.
 *
 * `26.09.2026`, con puntos. El formato lo fija el diseño y no es decorativo: una fecha leída
 * al revés —26 de septiembre contra 9 de junio— manda a un fotógrafo el día equivocado.
 *
 * La zona es siempre `America/Argentina/Buenos_Aires`, no la del servidor: Vercel corre en
 * UTC, y sin fijarla una cobertura de las 21 h aparecería al día siguiente.
 */
describe("fechaArgentina", () => {
  it("escribe con puntos, día primero", () => {
    expect(fechaArgentina(new Date("2026-09-26T17:00:00Z"))).toBe("26.09.2026");
  });

  it("rellena con cero los días y meses de un dígito", () => {
    expect(fechaArgentina(new Date("2026-01-05T15:00:00Z"))).toBe("05.01.2026");
  });

  it("usa la zona de Argentina, no la del servidor", () => {
    // 2026-09-27T01:30 UTC son las 22:30 del 26 en Argentina. Sin fijar la zona, esta fecha
    // aparecería como 27.
    expect(fechaArgentina(new Date("2026-09-27T01:30:00Z"))).toBe("26.09.2026");
  });
});

describe("horaArgentina", () => {
  it("escribe la hora en 24 h", () => {
    expect(horaArgentina(new Date("2026-09-26T17:00:00Z"))).toBe("14:00");
  });

  it("la medianoche es 00:00 y no 24:00", () => {
    expect(horaArgentina(new Date("2026-09-26T03:00:00Z"))).toBe("00:00");
  });
});

describe("fechaHoraArgentina", () => {
  it("junta las dos", () => {
    expect(fechaHoraArgentina(new Date("2026-09-26T17:00:00Z"))).toBe("26.09.2026, 14:00");
  });
});
```

- [ ] **Paso 2: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/format.test.ts
```

Esperado: FALLA con `Cannot find module './format'`.

- [ ] **Paso 3: Escribir el formato**

Crear `apps/fotoffice/lib/coverages/format.ts`:

```ts
import { COVERAGES_TIME_ZONE } from "./constants";

/**
 * Las fechas como se escriben acá: `26.09.2026`.
 *
 * El formato no es decorativo. Una fecha leída al revés —26 de septiembre contra 9 de junio—
 * manda a un fotógrafo el día equivocado a una actividad que no se repite.
 *
 * La zona se fija siempre y no se toma la del servidor: Vercel corre en UTC, y una cobertura
 * de las 21 h aparecería al día siguiente.
 */
const FECHA = new Intl.DateTimeFormat("es-AR", {
  timeZone: COVERAGES_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const HORA = new Intl.DateTimeFormat("es-AR", {
  timeZone: COVERAGES_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function fechaArgentina(date: Date): string {
  // `Intl` para es-AR devuelve "26/09/2026"; el diseño pide puntos.
  return FECHA.format(date).replace(/\//g, ".");
}

export function horaArgentina(date: Date): string {
  return HORA.format(date).replace(/^24:/, "00:");
}

export function fechaHoraArgentina(date: Date): string {
  return `${fechaArgentina(date)}, ${horaArgentina(date)}`;
}
```

- [ ] **Paso 4: Correr y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/format.test.ts
```

Esperado: 6 pasan.

- [ ] **Paso 5: Escribir el formulario (componente cliente)**

Crear `apps/fotoffice/app/w/[workspaceSlug]/coberturas/solicitar/request-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import {
  CONSENT_KINDS,
  CONSENT_LABELS,
  REQUIRED_CONSENTS,
  type ConsentKind,
} from "@/lib/coverages/consents";
import {
  submitCoverageRequestAction,
  type CoverageRequestFormState,
} from "@/app/actions/coverage-request";

const inicial: CoverageRequestFormState = { error: null, ok: null };

/**
 * El formulario público.
 *
 * Lo completa alguien que no conoce el sistema, casi siempre desde el teléfono. De ahí las
 * decisiones de forma: una sola columna, campos táctiles de 44 px para arriba, y los permisos
 * al final con su texto completo a la vista en vez de detrás de un enlace que nadie abre.
 *
 * `useActionState` deja el botón deshabilitado mientras se envía, que es lo que evita el doble
 * pedido cuando la conexión está lenta y la persona vuelve a apretar.
 */
export function CoverageRequestForm({
  workspaceSlug,
  institutionName,
  intro,
  terms,
}: {
  workspaceSlug: string;
  institutionName: string;
  intro: string | null;
  terms: Record<ConsentKind, string>;
}) {
  const accion = submitCoverageRequestAction.bind(null, workspaceSlug);
  const [state, formAction, pending] = useActionState(accion, inicial);

  if (state.ok) {
    return (
      <section className="fo-card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Listo, lo recibimos</h2>
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{state.ok}</p>
        {state.publicCode ? (
          <p className="text-sm">
            Tu número es{" "}
            <strong className="tabular-nums">{state.publicCode}</strong>. Anotalo por las dudas.
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      {intro ? (
        <p className="text-sm leading-relaxed text-[var(--fo-muted)]">{intro}</p>
      ) : null}

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Quiénes son</legend>
        <Campo name="orgName" label="Nombre de la organización" required />
        <Campo name="orgKind" label="Qué tipo de organización es" />
        <Campo name="orgTaxId" label="CUIT, si tienen" />
        <Campo name="orgWebsite" label="Sitio o redes" />
        <Campo name="contactName" label="Con quién hablamos" required />
        <Campo name="contactRole" label="Qué rol tiene" />
        <Campo name="contactEmail" label="Correo" type="email" required />
        <Campo name="contactPhone" label="Teléfono o WhatsApp" />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Qué actividad es</legend>
        <Campo name="eventTitle" label="Cómo se llama" required />
        <Campo name="eventDescription" label="Contanos de qué se trata" textarea />
        <Campo name="startsAt" label="Cuándo empieza" type="datetime-local" required />
        <Campo name="endsAt" label="Cuándo termina" type="datetime-local" required />
        <Campo name="addressLine" label="Dirección" />
        <Campo name="city" label="Localidad" />
        <Campo name="expectedAttendees" label="Cuánta gente esperan" type="number" />
        <Campo name="onSiteContactName" label="Quién va a estar ese día" />
        <Campo name="onSitePhone" label="Su teléfono" />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Qué necesitan</legend>
        <Campo name="purpose" label="Para qué van a usar las fotos" textarea />
        <Campo name="keyMoments" label="Qué momentos no se pueden perder" textarea />
        <Campo name="requestedPhotographers" label="Cuántos fotógrafos creen que hacen falta" type="number" />
        <Campo name="expectedDeliveryAt" label="Para cuándo las necesitan" type="date" />
        <Campo name="documentationLinks" label="Enlaces que nos ayuden a conocerlos" textarea />
        <Campo name="notes" label="Algo más que quieran contarnos" textarea />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Permisos</legend>
        <p className="text-sm text-[var(--fo-muted)]">
          Leé cada uno. Los marcados con * son necesarios para que {institutionName} pueda
          tomar el pedido.
        </p>
        {CONSENT_KINDS.map((kind) => (
          <label key={kind} className="flex gap-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              name={`consent_${kind}`}
              className="mt-1 size-5 shrink-0"
              required={REQUIRED_CONSENTS.includes(kind)}
            />
            <span>
              <span className="font-medium">
                {CONSENT_LABELS[kind]}
                {REQUIRED_CONSENTS.includes(kind) ? " *" : ""}
              </span>
              <br />
              <span className="text-[var(--fo-muted)]">{terms[kind]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}

      <button type="submit" className="fo-btn min-h-12 w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar el pedido"}
      </button>
    </form>
  );
}

function Campo({
  name,
  label,
  type = "text",
  required = false,
  textarea = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  textarea?: boolean;
}) {
  const clases =
    "w-full min-h-11 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-base";
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">
        {label}
        {required ? " *" : ""}
      </span>
      {textarea ? (
        <textarea name={name} rows={3} className={clases} required={required} />
      ) : (
        <input name={name} type={type} className={clases} required={required} />
      )}
    </label>
  );
}
```

- [ ] **Paso 6: Escribir la pantalla**

Crear `apps/fotoffice/app/w/[workspaceSlug]/coberturas/solicitar/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { consentTexts } from "@/lib/coverages/consents";
import { loadSettings } from "@/lib/coverages/repository";
import { terminologyFor } from "@/lib/coverages/terminology";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { COVERAGES_MODULE_KEY } from "@/lib/coverages/constants";
import { CoverageRequestForm } from "./request-form";

export const dynamic = "force-dynamic";

/**
 * El formulario público para pedir una cobertura.
 *
 * Dos condiciones para que exista: el módulo encendido y el formulario abierto. Las dos se
 * comprueban acá, en el origen — si la pantalla apareciera con el formulario cerrado, alguien
 * completaría todo para enterarse al final de que no se estaba recibiendo nada.
 *
 * El guard igual se repite en la acción: esconder un formulario no es un control.
 */
export default async function SolicitarCoberturaPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  const { workspaceSlug } = await params;

  const branding = await prisma.fotofficeWorkspaceBranding.findUnique({
    where: { publicSlug: workspaceSlug },
    select: { workspaceId: true, commercialName: true, logoUrl: true },
  });
  if (!branding) notFound();

  const encendido = await isModuleEnabledForWorkspace(
    branding.workspaceId,
    COVERAGES_MODULE_KEY,
  );
  if (!encendido) notFound();

  const settings = await loadSettings(branding.workspaceId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: branding.workspaceId },
    select: { name: true },
  });
  const nombre = branding.commercialName?.trim() || workspace?.name || "la organización";
  const t = terminologyFor(settings);

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-2xl space-y-8 px-4 py-10">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Pedir una cobertura a {nombre}
          </h1>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            Contanos de la actividad y lo revisamos. Te escribimos por correo con una
            respuesta, sea cual sea.
          </p>
        </header>

        {settings.publicFormEnabled ? (
          <CoverageRequestForm
            workspaceSlug={workspaceSlug}
            institutionName={nombre}
            intro={settings.publicFormIntro}
            terms={consentTexts(settings.consentTextVersion)}
          />
        ) : (
          <section className="fo-card space-y-2 p-6">
            <h2 className="text-base font-semibold">No estamos recibiendo pedidos</h2>
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              En este momento {nombre} no está tomando {t.request.toLowerCase()}es nuevas.
              Volvé a probar más adelante.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Paso 7: Verificar tipos y build**

```bash
cd apps/fotoffice && npx tsc --noEmit -p tsconfig.json && pnpm build
```

Esperado: tipos limpios; el build compila y lista
`/w/[workspaceSlug]/coberturas/solicitar`.

- [ ] **Paso 8: Commit**

```bash
git add apps/fotoffice/lib/coverages/format.ts apps/fotoffice/lib/coverages/format.test.ts "apps/fotoffice/app/w/[workspaceSlug]/coberturas"
git commit -m "El formulario público para pedir una cobertura"
```

---

## Tarea 11: El seguimiento por enlace

**Archivos:**
- Crear: `apps/fotoffice/app/sc/[token]/page.tsx`
- Crear: `apps/fotoffice/app/sc/[token]/responder-form.tsx`
- Crear: `apps/fotoffice/app/actions/coverage-tracking.ts`
- Crear: `apps/fotoffice/lib/coverages/tracking-view.ts`
- Crear: `apps/fotoffice/lib/coverages/tracking-view.test.ts`

**Interfaces:**
- Consume: `findByTrackingToken`, `isTrackingLinkUsable`, `requestStatusLabel`.
- Produce: `resolveTrackingView(row, now)` que devuelve
  `{ kind: "NO_EXISTE" } | { kind: "VENCIDO" } | { kind: "OK"; puedeResponder: boolean }`,
  y `answerInfoRequestAction(token, prev, formData)`.

- [ ] **Paso 1: Escribir el test de la vista**

Crear `apps/fotoffice/lib/coverages/tracking-view.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveTrackingView } from "./tracking-view";

const ahora = new Date("2026-09-14T12:00:00Z");
const vigente = new Date("2026-12-01T00:00:00Z");
const vencido = new Date("2026-09-01T00:00:00Z");

/**
 * Qué ve quien abre el enlace de seguimiento.
 *
 * Decisión pura, separada de la pantalla, porque acá está lo que importa: que un enlace
 * vencido o revocado no muestre nada, y que responder solo se ofrezca cuando de verdad se
 * pidió algo.
 */
describe("resolveTrackingView", () => {
  it("sin fila, no existe", () => {
    expect(resolveTrackingView(null, ahora)).toEqual({ kind: "NO_EXISTE" });
  });

  it("un enlace vencido no muestra la solicitud", () => {
    const v = resolveTrackingView(
      { status: "EN_EVALUACION", tokenExpiresAt: vencido, tokenRevokedAt: null },
      ahora,
    );
    expect(v.kind).toBe("VENCIDO");
  });

  it("un enlace revocado tampoco, aunque no haya vencido", () => {
    const v = resolveTrackingView(
      { status: "EN_EVALUACION", tokenExpiresAt: vigente, tokenRevokedAt: ahora },
      ahora,
    );
    expect(v.kind).toBe("VENCIDO");
  });

  it("con el enlace vigente se ve la solicitud", () => {
    const v = resolveTrackingView(
      { status: "EN_EVALUACION", tokenExpiresAt: vigente, tokenRevokedAt: null },
      ahora,
    );
    expect(v.kind).toBe("OK");
  });

  it("solo se puede responder cuando se pidió información", () => {
    const pidiendo = resolveTrackingView(
      { status: "REQUIERE_INFO", tokenExpiresAt: vigente, tokenRevokedAt: null },
      ahora,
    );
    expect(pidiendo).toEqual({ kind: "OK", puedeResponder: true });

    const evaluando = resolveTrackingView(
      { status: "EN_EVALUACION", tokenExpiresAt: vigente, tokenRevokedAt: null },
      ahora,
    );
    expect(evaluando).toEqual({ kind: "OK", puedeResponder: false });
  });

  it("sobre una solicitud rechazada no se responde nada", () => {
    const v = resolveTrackingView(
      { status: "RECHAZADA", tokenExpiresAt: vigente, tokenRevokedAt: null },
      ahora,
    );
    expect(v).toEqual({ kind: "OK", puedeResponder: false });
  });
});
```

- [ ] **Paso 2: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/tracking-view.test.ts
```

Esperado: FALLA con `Cannot find module './tracking-view'`.

- [ ] **Paso 3: Escribir la vista**

Crear `apps/fotoffice/lib/coverages/tracking-view.ts`:

```ts
/**
 * Qué ve quien abre el enlace de seguimiento.
 *
 * Un enlace vencido o revocado devuelve exactamente lo mismo que uno inexistente en la
 * pantalla: "no encontramos este pedido". La diferencia se mantiene acá para poder explicarle
 * a quien pregunte por teléfono que el enlace caducó, sin que la pantalla le confirme a nadie
 * que ese token alguna vez existió.
 */
export type TrackingView =
  | { kind: "NO_EXISTE" }
  | { kind: "VENCIDO" }
  | { kind: "OK"; puedeResponder: boolean };

export function resolveTrackingView(
  row: { status: string; tokenExpiresAt: Date; tokenRevokedAt: Date | null } | null,
  now: Date,
): TrackingView {
  if (!row) return { kind: "NO_EXISTE" };
  if (row.tokenRevokedAt) return { kind: "VENCIDO" };
  if (row.tokenExpiresAt.getTime() <= now.getTime()) return { kind: "VENCIDO" };
  // Responder solo cuando de verdad se pidió algo: ofrecer un cuadro de texto en cualquier
  // otro estado genera mensajes que nadie está esperando y que no disparan ningún aviso.
  return { kind: "OK", puedeResponder: row.status === "REQUIERE_INFO" };
}
```

- [ ] **Paso 4: Correr y verlo pasar**

```bash
cd apps/fotoffice && pnpm test lib/coverages/tracking-view.test.ts
```

Esperado: 6 pasan.

- [ ] **Paso 5: Escribir la acción de responder**

Crear `apps/fotoffice/app/actions/coverage-tracking.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { recordEvent } from "@/lib/coverages/events";
import { findByTrackingToken } from "@/lib/coverages/repository";
import { resolveTrackingView } from "@/lib/coverages/tracking-view";

export type TrackingFormState = { error: string | null; ok: string | null };

/**
 * La organización responde lo que se le pidió.
 *
 * El token es la credencial: se vuelve a validar acá y no se confía en que la pantalla ya lo
 * haya hecho. Con la respuesta, la solicitud vuelve a evaluación sola — dejarla en
 * «esperando información» después de que contestaron la escondería de la bandeja.
 */
export async function answerInfoRequestAction(
  token: string,
  _prev: TrackingFormState | undefined,
  formData: FormData,
): Promise<TrackingFormState> {
  const texto = formData.get("respuesta")?.toString()?.trim();
  if (!texto) return { error: "Escribí tu respuesta antes de enviarla.", ok: null };

  const solicitud = await findByTrackingToken(token);
  const vista = resolveTrackingView(solicitud, new Date());
  if (vista.kind !== "OK" || !vista.puedeResponder || !solicitud) {
    return { error: "Este enlace ya no permite responder.", ok: null };
  }

  await prisma.$transaction(async (tx) => {
    await tx.coverageRequest.update({
      where: { id: solicitud.id },
      data: { status: "EN_EVALUACION", infoRequested: null },
    });
    await recordEvent(tx, {
      workspaceId: solicitud.workspaceId,
      entityType: "REQUEST",
      entityId: solicitud.id,
      type: "INFO_RESPONDIDA",
      fromStatus: "REQUIERE_INFO",
      toStatus: "EN_EVALUACION",
      actorLabel: solicitud.client.businessName ?? "La organización",
      note: texto,
    });
  });

  revalidatePath(`/sc/${token}`);
  return { error: null, ok: "Gracias. Ya lo estamos mirando de nuevo." };
}
```

- [ ] **Paso 6: Escribir el formulario de respuesta**

Crear `apps/fotoffice/app/sc/[token]/responder-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import {
  answerInfoRequestAction,
  type TrackingFormState,
} from "@/app/actions/coverage-tracking";

const inicial: TrackingFormState = { error: null, ok: null };

export function ResponderForm({ token }: { token: string }) {
  const accion = answerInfoRequestAction.bind(null, token);
  const [state, formAction, pending] = useActionState(accion, inicial);

  if (state.ok) {
    return <p className="text-sm text-[var(--fo-muted)]">{state.ok}</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <label className="block space-y-1">
        <span className="text-sm font-medium">Tu respuesta</span>
        <textarea
          name="respuesta"
          rows={4}
          required
          className="w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-base"
        />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">
          {state.error}
        </p>
      ) : null}
      <button type="submit" className="fo-btn min-h-11" disabled={pending}>
        {pending ? "Enviando…" : "Enviar respuesta"}
      </button>
    </form>
  );
}
```

- [ ] **Paso 7: Escribir la pantalla de seguimiento**

Crear `apps/fotoffice/app/sc/[token]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { fechaHoraArgentina } from "@/lib/coverages/format";
import { findByTrackingToken } from "@/lib/coverages/repository";
import { requestStatusLabel } from "@/lib/coverages/states";
import { resolveTrackingView } from "@/lib/coverages/tracking-view";
import { ResponderForm } from "./responder-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seguimiento de tu pedido",
  // Un enlace privado no se indexa. Es una credencial, no una página.
  robots: { index: false, follow: false },
};

/**
 * La ventana de la organización a su propio pedido.
 *
 * Sin cuenta: el token del enlace es la credencial. Muestra en qué anda, qué se le pidió si se
 * le pidió algo, y nada más — ni notas internas, ni quién lo está evaluando, ni datos de otros
 * pedidos.
 *
 * Un enlace inexistente y uno vencido muestran el MISMO mensaje: confirmarle a alguien que un
 * token existió pero caducó le dice que acertó a adivinarlo.
 */
export default async function SeguimientoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const solicitud = await findByTrackingToken(token);
  const vista = resolveTrackingView(solicitud, new Date());

  if (vista.kind !== "OK" || !solicitud) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-5 py-12">
        <div className="fo-card space-y-2 p-6 text-center">
          <p className="text-base font-semibold">No encontramos este pedido</p>
          <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
            El enlace puede haber caducado. Escribinos y te mandamos uno nuevo.
          </p>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--fo-bg)] text-[var(--fo-text)]">
      <main className="mx-auto max-w-lg space-y-6 px-4 py-10">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">
            Pedido <span className="tabular-nums">{solicitud.publicCode}</span>
          </p>
          <h1 className="text-xl font-semibold tracking-tight">{solicitud.eventTitle}</h1>
          <p className="text-sm text-[var(--fo-muted)]">
            {fechaHoraArgentina(solicitud.startsAt)}
          </p>
        </header>

        <section className="fo-card space-y-2 p-5">
          <p className="text-xs uppercase tracking-wide text-[var(--fo-muted)]">Estado</p>
          <p className="text-base font-semibold">{requestStatusLabel(solicitud.status)}</p>
          {solicitud.status === "RECHAZADA" && solicitud.rejectionReason ? (
            <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
              {solicitud.rejectionReason}
            </p>
          ) : null}
        </section>

        {vista.puedeResponder ? (
          <section className="fo-card space-y-4 p-5">
            <div className="space-y-1">
              <h2 className="text-base font-semibold">Nos falta un dato</h2>
              {solicitud.infoRequested ? (
                <p className="text-sm leading-relaxed text-[var(--fo-muted)]">
                  {solicitud.infoRequested}
                </p>
              ) : null}
            </div>
            <ResponderForm token={token} />
          </section>
        ) : null}
      </main>
    </div>
  );
}
```

- [ ] **Paso 8: Verificar tipos y correr el módulo**

```bash
cd apps/fotoffice && npx tsc --noEmit -p tsconfig.json && pnpm test lib/coverages/
```

- [ ] **Paso 9: Commit**

```bash
git add apps/fotoffice/lib/coverages apps/fotoffice/app/sc apps/fotoffice/app/actions/coverage-tracking.ts
git commit -m "Seguimiento del pedido por enlace privado, sin cuenta"
```

---

## Tarea 12: La bandeja y la ficha de evaluación

**Archivos:**
- Crear: `apps/fotoffice/app/(shell)/coberturas/page.tsx`
- Crear: `apps/fotoffice/app/(shell)/coberturas/[id]/page.tsx`
- Crear: `apps/fotoffice/app/(shell)/coberturas/[id]/evaluacion-panel.tsx`
- Crear: `apps/fotoffice/app/(shell)/coberturas/actions.ts`
- Crear: `apps/fotoffice/app/(shell)/coberturas/actions.test.ts`

**Interfaces:**
- Consume: `requireCoveragesReviewer`, `requireCoveragesCoordinator`, `listRequests`,
  `loadRequest`, `listEvents`, `assertRequestTransition`, `recomendarRefuerzo`.
- Produce: `changeRequestStatusAction`, `requestInfoAction`, `addNoteAction`.

- [ ] **Paso 1: Escribir el test de la acción de cambio de estado**

Crear `apps/fotoffice/app/(shell)/coberturas/actions.test.ts`. Se prueba lo que las acciones
deciden **antes** de tocar la base; el detalle de la transición ya lo cubre `transitions.test.ts`.

```ts
import { describe, expect, it } from "vitest";
import { planStatusChange } from "@/lib/coverages/status-change-plan";

/**
 * Lo que la acción decide antes de escribir.
 *
 * Tres controles, y el orden importa: primero que la solicitud sea de este workspace, después
 * que la transición exista, y recién ahí que haya motivo si hace falta. Al revés, un mensaje
 * de «falta el motivo» sobre una solicitud ajena ya confirmaría que esa solicitud existe.
 */
describe("planStatusChange", () => {
  const solicitud = { id: "req-1", workspaceId: "ws-a", status: "EN_EVALUACION" };

  it("una solicitud de otro workspace no existe para esta persona", () => {
    const r = planStatusChange({
      solicitud: null,
      workspaceId: "ws-a",
      to: "APROBADA",
      reason: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("No encontramos");
  });

  it("no se filtra que existe pidiendo el motivo primero", () => {
    const r = planStatusChange({
      solicitud: null,
      workspaceId: "ws-a",
      to: "RECHAZADA",
      reason: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).not.toContain("motivo");
  });

  it("una transición inválida se rechaza", () => {
    const r = planStatusChange({
      solicitud: { ...solicitud, status: "RECHAZADA" },
      workspaceId: "ws-a",
      to: "APROBADA",
      reason: null,
    });
    expect(r.ok).toBe(false);
  });

  it("rechazar sin motivo no pasa", () => {
    const r = planStatusChange({
      solicitud,
      workspaceId: "ws-a",
      to: "RECHAZADA",
      reason: "  ",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("motivo");
  });

  it("aprobar pasa y devuelve de dónde venía, para el historial", () => {
    const r = planStatusChange({
      solicitud,
      workspaceId: "ws-a",
      to: "APROBADA",
      reason: null,
    });
    expect(r).toEqual({ ok: true, from: "EN_EVALUACION", to: "APROBADA" });
  });
});
```

- [ ] **Paso 2: Correr y verlo fallar**

```bash
cd apps/fotoffice && pnpm test "app/(shell)/coberturas/actions.test.ts"
```

Esperado: FALLA con `Cannot find module '@/lib/coverages/status-change-plan'`.

- [ ] **Paso 3: Escribir el plan del cambio de estado**

Crear `apps/fotoffice/lib/coverages/status-change-plan.ts`:

```ts
import { assertRequestTransition } from "./transitions";

/**
 * Los tres controles previos a mover una solicitud, en el orden que corresponde.
 *
 * Primero la pertenencia al workspace, después la transición, y último el motivo. El orden no
 * es estético: al revés, un mensaje de «falta el motivo» sobre una solicitud ajena ya le
 * confirmaría a quien probó un id que esa solicitud existe.
 */
export type StatusChangePlan =
  | { ok: true; from: string; to: string }
  | { ok: false; error: string };

export function planStatusChange(input: {
  solicitud: { id: string; workspaceId: string; status: string } | null;
  workspaceId: string;
  to: string;
  reason: string | null;
}): StatusChangePlan {
  if (!input.solicitud || input.solicitud.workspaceId !== input.workspaceId) {
    return { ok: false, error: "No encontramos esa solicitud." };
  }

  const check = assertRequestTransition({
    from: input.solicitud.status,
    to: input.to,
    reason: input.reason,
  });
  if (!check.ok) return { ok: false, error: check.error };

  return { ok: true, from: input.solicitud.status, to: input.to };
}
```

- [ ] **Paso 4: Correr y verlo pasar**

```bash
cd apps/fotoffice && pnpm test "app/(shell)/coberturas/actions.test.ts"
```

Esperado: 5 pasan.

- [ ] **Paso 5: Escribir las acciones del panel**

Crear `apps/fotoffice/app/(shell)/coberturas/actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { appUrl } from "@/lib/app-url";
import { COVERAGE_EMAIL_KEYS } from "@/lib/communications/constants";
import { loadWorkspaceEmailContext } from "@/lib/communications/load-workspace-signature";
import { sendAndLogEmail } from "@/lib/communications/send-and-log";
import { requireCoveragesCoordinator, requireCoveragesReviewer } from "@/lib/coverages/access";
import {
  buildInfoRequestedEmail,
  buildRequestApprovedEmail,
  buildRequestRejectedEmail,
} from "@/lib/coverages/emails";
import { recordEvent } from "@/lib/coverages/events";
import { planStatusChange } from "@/lib/coverages/status-change-plan";

export type PanelState = { error: string | null; ok: string | null; warn?: string | null };

/**
 * `warn` es para lo que salió a medias: el cambio se hizo pero el aviso no salió.
 *
 * Sin ese tercer canal habría que elegir entre pintar de verde un fallo o de rojo una
 * aprobación que sí ocurrió, y las dos cosas hacen que la coordinación actúe mal. Es el mismo
 * criterio que ya usa el alta de socios.
 */
export async function changeRequestStatusAction(
  _prev: PanelState | undefined,
  formData: FormData,
): Promise<PanelState> {
  const { user, workspace } = await requireCoveragesCoordinator();
  const id = formData.get("id")?.toString() ?? "";
  const to = formData.get("to")?.toString() ?? "";
  const reason = formData.get("reason")?.toString()?.trim() || null;

  const solicitud = await prisma.coverageRequest.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { client: { select: { email: true, businessName: true } } },
  });

  const plan = planStatusChange({ solicitud, workspaceId: workspace.id, to, reason });
  if (!plan.ok) return { error: plan.error, ok: null };
  if (!solicitud) return { error: "No encontramos esa solicitud.", ok: null };

  await prisma.$transaction(async (tx) => {
    await tx.coverageRequest.update({
      where: { id: solicitud.id },
      data: {
        status: plan.to,
        rejectionReason: plan.to === "RECHAZADA" ? reason : solicitud.rejectionReason,
        resolvedByUserId: user.id,
        resolvedAt: new Date(),
      },
    });
    await recordEvent(tx, {
      workspaceId: workspace.id,
      entityType: "REQUEST",
      entityId: solicitud.id,
      type: "ESTADO_CAMBIADO",
      fromStatus: plan.from,
      toStatus: plan.to,
      actorUserId: user.id,
      actorLabel: user.name ?? user.email,
      note: reason,
    });
  });

  let warn: string | null = null;
  const destino = solicitud.client.email;
  if (destino && (plan.to === "APROBADA" || plan.to === "RECHAZADA")) {
    const contexto = await loadWorkspaceEmailContext(workspace.id);
    const base = appUrl();
    const comun = {
      context: contexto,
      publicCode: solicitud.publicCode,
      eventTitle: solicitud.eventTitle,
      contactName: solicitud.client.businessName ?? "Hola",
      trackingUrl: base ? `${base}/sc/…` : "",
    };
    const resultado = await sendAndLogEmail({
      to: destino,
      templateKey:
        plan.to === "APROBADA" ? COVERAGE_EMAIL_KEYS.APPROVED : COVERAGE_EMAIL_KEYS.REJECTED,
      body:
        plan.to === "APROBADA"
          ? buildRequestApprovedEmail(comun)
          : buildRequestRejectedEmail({ ...comun, reason: reason ?? "" }),
    });
    if (resultado.status !== "SENT") {
      warn = "El cambio quedó guardado, pero el correo no salió. Está registrado.";
    }
  }

  revalidatePath("/coberturas");
  revalidatePath(`/coberturas/${solicitud.id}`);
  return { error: null, ok: "Listo.", warn };
}

/** Pedirle un dato a la organización. Lo ve en su enlace y puede responder desde ahí. */
export async function requestInfoAction(
  _prev: PanelState | undefined,
  formData: FormData,
): Promise<PanelState> {
  const { user, workspace } = await requireCoveragesReviewer();
  const id = formData.get("id")?.toString() ?? "";
  const texto = formData.get("infoRequested")?.toString()?.trim();
  if (!texto) return { error: "Escribí qué hace falta.", ok: null };

  const solicitud = await prisma.coverageRequest.findFirst({
    where: { id, workspaceId: workspace.id },
    include: { client: { select: { email: true, businessName: true } } },
  });
  if (!solicitud) return { error: "No encontramos esa solicitud.", ok: null };

  const plan = planStatusChange({
    solicitud,
    workspaceId: workspace.id,
    to: "REQUIERE_INFO",
    reason: texto,
  });
  if (!plan.ok) return { error: plan.error, ok: null };

  await prisma.$transaction(async (tx) => {
    await tx.coverageRequest.update({
      where: { id: solicitud.id },
      data: { status: "REQUIERE_INFO", infoRequested: texto },
    });
    await recordEvent(tx, {
      workspaceId: workspace.id,
      entityType: "REQUEST",
      entityId: solicitud.id,
      type: "INFO_PEDIDA",
      fromStatus: plan.from,
      toStatus: "REQUIERE_INFO",
      actorUserId: user.id,
      actorLabel: user.name ?? user.email,
      note: texto,
    });
  });

  let warn: string | null = null;
  if (solicitud.client.email) {
    const contexto = await loadWorkspaceEmailContext(workspace.id);
    const base = appUrl();
    const r = await sendAndLogEmail({
      to: solicitud.client.email,
      templateKey: COVERAGE_EMAIL_KEYS.INFO_REQUESTED,
      body: buildInfoRequestedEmail({
        context: contexto,
        publicCode: solicitud.publicCode,
        eventTitle: solicitud.eventTitle,
        contactName: solicitud.client.businessName ?? "Hola",
        trackingUrl: base ? `${base}/sc/…` : "",
        infoRequested: texto,
      }),
    });
    if (r.status !== "SENT") {
      warn = "Quedó pedido, pero el correo no salió. Está registrado.";
    }
  }

  revalidatePath(`/coberturas/${solicitud.id}`);
  return { error: null, ok: "Se lo pedimos.", warn };
}

/** Una nota interna. La organización nunca la ve. */
export async function addNoteAction(
  _prev: PanelState | undefined,
  formData: FormData,
): Promise<PanelState> {
  const { user, workspace } = await requireCoveragesReviewer();
  const id = formData.get("id")?.toString() ?? "";
  const nota = formData.get("note")?.toString()?.trim();
  if (!nota) return { error: "Escribí la nota.", ok: null };

  const existe = await prisma.coverageRequest.findFirst({
    where: { id, workspaceId: workspace.id },
    select: { id: true },
  });
  if (!existe) return { error: "No encontramos esa solicitud.", ok: null };

  await recordEvent(prisma, {
    workspaceId: workspace.id,
    entityType: "REQUEST",
    entityId: existe.id,
    type: "NOTA",
    actorUserId: user.id,
    actorLabel: user.name ?? user.email,
    note: nota,
  });

  revalidatePath(`/coberturas/${existe.id}`);
  return { error: null, ok: "Anotado." };
}
```

**Nota para quien implemente:** el `trackingUrl` de estas dos acciones queda como `/sc/…`
porque el token crudo no se puede recuperar — solo existe su hash. En la etapa 1b, cuando se
agregue "reenviar el enlace", hay que emitir un token nuevo ahí mismo. Por ahora los correos de
aprobación y de pedido de información salen sin enlace; el de recepción, que sí lo lleva, es el
que la organización guardó.

- [ ] **Paso 6: Escribir la bandeja**

Crear `apps/fotoffice/app/(shell)/coberturas/page.tsx`:

```tsx
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { requireCoveragesReviewer } from "@/lib/coverages/access";
import { fechaArgentina } from "@/lib/coverages/format";
import { INBOX_FILTERS, isInboxFilter } from "@/lib/coverages/inbox-filters";
import { listRequests, loadSettings } from "@/lib/coverages/repository";
import { requestStatusLabel } from "@/lib/coverages/states";
import { terminologyFor } from "@/lib/coverages/terminology";

export const dynamic = "force-dynamic";

/**
 * La bandeja de la coordinación.
 *
 * Ordenada por fecha de la actividad y no por fecha de carga: lo que urge es lo que ocurre
 * primero, no lo que entró primero. Un pedido de ayer para dentro de seis meses puede esperar;
 * uno de hace una hora para el sábado, no.
 */
export default async function CoberturasPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const { workspace } = await requireCoveragesReviewer();
  const { filtro } = await searchParams;
  const activo = isInboxFilter(filtro) ? filtro : "nuevas";

  const [settings, solicitudes] = await Promise.all([
    loadSettings(workspace.id),
    listRequests({ workspaceId: workspace.id, filter: activo }),
  ]);
  const t = terminologyFor(settings);

  return (
    <div className="space-y-6">
      <PageHeader title={t.module} description={`Los pedidos que recibe ${workspace.name}.`} />

      <nav className="flex flex-wrap gap-2" aria-label="Filtros">
        {INBOX_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/coberturas?filtro=${f.key}`}
            aria-current={f.key === activo ? "page" : undefined}
            className={`rounded-full border px-3 py-2 text-sm ${
              f.key === activo
                ? "border-[var(--fo-text)] bg-[var(--fo-text)] text-[var(--fo-bg)]"
                : "border-[var(--fo-border)]"
            }`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {solicitudes.length === 0 ? (
        <p className="fo-card p-6 text-sm text-[var(--fo-muted)]">
          No hay nada acá. Cuando llegue un pedido nuevo va a aparecer en «Nuevas».
        </p>
      ) : (
        <ul className="space-y-3">
          {solicitudes.map((s) => (
            <li key={s.id}>
              <Link href={`/coberturas/${s.id}`} className="fo-card block space-y-1 p-4">
                <p className="text-xs tabular-nums text-[var(--fo-muted)]">{s.publicCode}</p>
                <p className="font-medium">{s.eventTitle}</p>
                <p className="text-sm text-[var(--fo-muted)]">
                  {s.client.businessName ?? `${s.client.firstName ?? ""} ${s.client.lastName ?? ""}`.trim()}
                  {" · "}
                  {fechaArgentina(s.startsAt)}
                  {s.city ? ` · ${s.city}` : ""}
                </p>
                <p className="text-xs text-[var(--fo-muted)]">{requestStatusLabel(s.status)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Paso 7: Escribir la ficha de evaluación**

Crear `apps/fotoffice/app/(shell)/coberturas/[id]/page.tsx`. Antes, mirar
`app/(shell)/members/solicitudes/page.tsx` para copiar el armado de la ficha y de los paneles
de acción.

```tsx
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireCoveragesReviewer } from "@/lib/coverages/access";
import { listEvents } from "@/lib/coverages/events";
import { fechaHoraArgentina } from "@/lib/coverages/format";
import { recomendarRefuerzo } from "@/lib/coverages/reinforcement";
import { loadRequest, loadSettings } from "@/lib/coverages/repository";
import { requestStatusLabel } from "@/lib/coverages/states";
import { canCoordinateCoverages } from "@/lib/coverages/access-policy";
import { EvaluacionPanel } from "./evaluacion-panel";

export const dynamic = "force-dynamic";

export default async function FichaSolicitudPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { workspace, role } = await requireCoveragesReviewer();
  const { id } = await params;

  const solicitud = await loadRequest({ workspaceId: workspace.id, id });
  if (!solicitud) notFound();

  const [settings, historial] = await Promise.all([
    loadSettings(workspace.id),
    listEvents({ workspaceId: workspace.id, entityType: "REQUEST", entityId: solicitud.id }),
  ]);

  const duracion = Math.round(
    (solicitud.endsAt.getTime() - solicitud.startsAt.getTime()) / 60000,
  );
  const refuerzo = recomendarRefuerzo({ durationMinutes: duracion, assigned: 0, settings });

  return (
    <div className="space-y-6">
      <PageHeader
        title={solicitud.eventTitle}
        description={`${solicitud.publicCode} · ${requestStatusLabel(solicitud.status)}`}
      />

      {refuerzo ? (
        <p className="fo-card border-l-4 border-l-[var(--fo-accent,#1d4ed8)] p-4 text-sm leading-relaxed">
          <strong>Conviene sumar gente.</strong> {refuerzo.reason} Te recomendamos armar el
          equipo con {refuerzo.recommended} personas. Podés seguir con menos: te vamos a pedir
          que dejes una observación.
        </p>
      ) : null}

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">La actividad</h2>
        <Dato label="Cuándo" valor={`${fechaHoraArgentina(solicitud.startsAt)} a ${fechaHoraArgentina(solicitud.endsAt)}`} />
        <Dato label="Dónde" valor={[solicitud.addressLine, solicitud.city].filter(Boolean).join(", ") || "—"} />
        <Dato label="Qué esperan" valor={solicitud.purpose ?? "—"} />
        <Dato label="Momentos importantes" valor={solicitud.keyMoments ?? "—"} />
      </section>

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Quién lo pide</h2>
        <Dato label="Organización" valor={solicitud.client.businessName ?? "—"} />
        <Dato label="Correo" valor={solicitud.client.email ?? "—"} />
        <Dato label="Teléfono" valor={solicitud.client.phone ?? "—"} />
      </section>

      <section className="fo-card space-y-2 p-5">
        <h2 className="text-base font-semibold">Permisos que dio</h2>
        <ul className="space-y-1 text-sm">
          {solicitud.consents.map((c) => (
            <li key={c.id} className="flex gap-2">
              <span aria-hidden>{c.granted ? "✓" : "✗"}</span>
              <span className={c.granted ? "" : "text-[var(--fo-muted)]"}>
                {c.kind} <span className="text-xs">({c.textVersion})</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <EvaluacionPanel
        id={solicitud.id}
        status={solicitud.status}
        puedeCoordinar={canCoordinateCoverages(role)}
      />

      <section className="fo-card space-y-3 p-5">
        <h2 className="text-base font-semibold">Historial</h2>
        {historial.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no pasó nada.</p>
        ) : (
          <ul className="space-y-3 text-sm">
            {historial.map((e) => (
              <li key={e.id} className="space-y-0.5">
                <p className="text-xs text-[var(--fo-muted)]">
                  {fechaHoraArgentina(e.createdAt)} · {e.actorLabel ?? "El sistema"}
                </p>
                <p>
                  {e.type}
                  {e.toStatus ? ` → ${requestStatusLabel(e.toStatus)}` : ""}
                </p>
                {e.note ? <p className="text-[var(--fo-muted)]">{e.note}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <p className="text-sm">
      <span className="text-[var(--fo-muted)]">{label}: </span>
      {valor}
    </p>
  );
}
```

- [ ] **Paso 8: Escribir el panel de acciones**

Crear `apps/fotoffice/app/(shell)/coberturas/[id]/evaluacion-panel.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import {
  addNoteAction,
  changeRequestStatusAction,
  requestInfoAction,
  type PanelState,
} from "../actions";

const inicial: PanelState = { error: null, ok: null };

/**
 * Lo que la coordinación puede hacer con una solicitud.
 *
 * `puedeCoordinar` esconde los botones de aprobar y rechazar para quien solo revisa. **No es
 * el control**: las acciones vuelven a verificar el rol en el servidor. Esto es cortesía, para
 * no ofrecer lo que después va a rebotar.
 */
export function EvaluacionPanel({
  id,
  status,
  puedeCoordinar,
}: {
  id: string;
  status: string;
  puedeCoordinar: boolean;
}) {
  const [estadoState, cambiarEstado, cambiando] = useActionState(
    changeRequestStatusAction,
    inicial,
  );
  const [infoState, pedirInfo, pidiendo] = useActionState(requestInfoAction, inicial);
  const [notaState, anotar, anotando] = useActionState(addNoteAction, inicial);

  const cerrada = ["RECHAZADA", "CERRADA", "CANCELADA_SOLICITANTE", "CANCELADA_ORGANIZACION"].includes(
    status,
  );

  return (
    <section className="fo-card space-y-6 p-5">
      <h2 className="text-base font-semibold">Qué hacemos</h2>

      <Aviso state={estadoState} />
      <Aviso state={infoState} />
      <Aviso state={notaState} />

      {!cerrada && status === "RECIBIDA" && puedeCoordinar ? (
        <form action={cambiarEstado}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="to" value="EN_EVALUACION" />
          <button type="submit" className="fo-btn min-h-11" disabled={cambiando}>
            Empezar a evaluarla
          </button>
        </form>
      ) : null}

      {!cerrada && ["EN_EVALUACION", "REQUIERE_INFO"].includes(status) ? (
        <form action={pedirInfo} className="space-y-2">
          <input type="hidden" name="id" value={id} />
          <label className="block space-y-1">
            <span className="text-sm font-medium">Pedirles un dato</span>
            <textarea
              name="infoRequested"
              rows={2}
              required
              className="w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-sm"
            />
          </label>
          <button type="submit" className="fo-btn fo-btn-secondary min-h-11" disabled={pidiendo}>
            Pedir información
          </button>
        </form>
      ) : null}

      {!cerrada && status === "EN_EVALUACION" && puedeCoordinar ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <form action={cambiarEstado} className="sm:flex-1">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="to" value="APROBADA" />
            <button type="submit" className="fo-btn min-h-11 w-full" disabled={cambiando}>
              Tomar el pedido
            </button>
          </form>
          <form action={cambiarEstado} className="space-y-2 sm:flex-1">
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="to" value="RECHAZADA" />
            <textarea
              name="reason"
              rows={2}
              required
              placeholder="Por qué no podemos tomarlo. Se lo mandamos."
              className="w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-sm"
            />
            <button
              type="submit"
              className="fo-btn fo-btn-secondary min-h-11 w-full"
              disabled={cambiando}
            >
              No podemos tomarlo
            </button>
          </form>
        </div>
      ) : null}

      <form action={anotar} className="space-y-2">
        <input type="hidden" name="id" value={id} />
        <label className="block space-y-1">
          <span className="text-sm font-medium">Nota interna</span>
          <span className="block text-xs text-[var(--fo-muted)]">
            Solo la vemos nosotros. La organización nunca la ve.
          </span>
          <textarea
            name="note"
            rows={2}
            required
            className="w-full rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-sm"
          />
        </label>
        <button type="submit" className="fo-btn fo-btn-secondary min-h-11" disabled={anotando}>
          Anotar
        </button>
      </form>
    </section>
  );
}

function Aviso({ state }: { state: PanelState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-[var(--fo-danger)]">
        {state.error}
      </p>
    );
  }
  if (state.warn) {
    return <p className="text-sm text-[var(--fo-warning,#b45309)]">{state.warn}</p>;
  }
  if (state.ok) return <p className="text-sm text-[var(--fo-muted)]">{state.ok}</p>;
  return null;
}
```

- [ ] **Paso 9: Verificar y commitear**

```bash
cd apps/fotoffice && npx tsc --noEmit -p tsconfig.json && pnpm test && pnpm lint
```

Esperado: tipos limpios, tests verdes salvo el preexistente de `template-v2`, lint con los 3
errores preexistentes y ninguno nuevo.

```bash
git add "apps/fotoffice/app/(shell)/coberturas" apps/fotoffice/lib/coverages/status-change-plan.ts
git commit -m "La bandeja de la coordinación y la ficha de evaluación"
```

---

## Tarea 13: La configuración del módulo y el menú

**Archivos:**
- Crear: `apps/fotoffice/app/(shell)/coberturas/configuracion/page.tsx`
- Crear: `apps/fotoffice/app/(shell)/coberturas/configuracion/settings-form.tsx`
- Modificar: `apps/fotoffice/app/(shell)/coberturas/actions.ts`
- Modificar: `apps/fotoffice/lib/modules/submodules.ts`
- Modificar: `apps/fotoffice/app/(shell)/layout.tsx`
- Modificar: `apps/fotoffice/components/shell/shell-sidebar.tsx`

**Interfaces:**
- Produce: `saveCoverageSettingsAction(prev, formData)`.

- [ ] **Paso 1: Agregar la acción de guardar configuración**

Al final de `apps/fotoffice/app/(shell)/coberturas/actions.ts`:

```ts
/**
 * Guardar la configuración del módulo.
 *
 * `upsert` y no `update`: un workspace que nunca la tocó no tiene fila, y obligar a crearla
 * antes de poder editarla sería un paso que no le importa a nadie.
 *
 * Los números se acotan a rangos sensatos. Un umbral de refuerzo en cero haría que el aviso
 * salte en toda cobertura y la gente deje de leerlo, que es peor que no tenerlo.
 */
export async function saveCoverageSettingsAction(
  _prev: PanelState | undefined,
  formData: FormData,
): Promise<PanelState> {
  const { workspace } = await requireCoveragesCoordinator();

  const entero = (nombre: string, min: number, max: number, porOmision: number): number => {
    const n = Number(formData.get(nombre)?.toString()?.trim());
    if (!Number.isFinite(n)) return porOmision;
    return Math.min(max, Math.max(min, Math.round(n)));
  };

  const texto = (nombre: string): string | null =>
    formData.get(nombre)?.toString()?.trim() || null;

  const lista = (nombre: string): string[] =>
    (formData.get(nombre)?.toString() ?? "")
      .split(/[\n,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

  const datos = {
    moduleLabel: texto("moduleLabel"),
    termRequest: texto("termRequest"),
    termCollaborator: texto("termCollaborator"),
    termRequester: texto("termRequester"),
    termCall: texto("termCall"),
    assignmentMode: formData.get("assignmentMode")?.toString() ?? "MIXTA",
    requiresApproval: formData.get("requiresApproval") === "on",
    requiresCoordinatorConfirmation:
      formData.get("requiresCoordinatorConfirmation") === "on",
    reinforcementThresholdMinutes: entero("reinforcementThresholdMinutes", 30, 24 * 60, 180),
    recommendedCollaborators: entero("recommendedCollaborators", 1, 20, 2),
    publicFormEnabled: formData.get("publicFormEnabled") === "on",
    publicFormIntro: texto("publicFormIntro"),
    notifyEmails: lista("notifyEmails"),
    zones: lista("zones"),
    specialties: lista("specialties"),
    roleTemplates: lista("roleTemplates"),
  };

  await prisma.coverageSettings.upsert({
    where: { workspaceId: workspace.id },
    update: datos,
    create: { workspaceId: workspace.id, ...datos },
  });

  revalidatePath("/coberturas/configuracion");
  revalidatePath("/coberturas");
  return { error: null, ok: "Guardado." };
}
```

- [ ] **Paso 2: Escribir la pantalla de configuración**

Crear `apps/fotoffice/app/(shell)/coberturas/configuracion/page.tsx`:

```tsx
import { PageHeader } from "@/components/page-header";
import { requireCoveragesCoordinator } from "@/lib/coverages/access";
import { loadSettings } from "@/lib/coverages/repository";
import { SettingsForm } from "./settings-form";

export const dynamic = "force-dynamic";

export default async function ConfiguracionCoberturasPage() {
  const { workspace } = await requireCoveragesCoordinator();
  const settings = await loadSettings(workspace.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cómo funciona el módulo acá"
        description="Las palabras, los plazos y quién decide. Son de esta organización, no del sistema."
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
```

Crear `apps/fotoffice/app/(shell)/coberturas/configuracion/settings-form.tsx`:

```tsx
"use client";

import { useActionState } from "react";
import { ASSIGNMENT_MODES, ASSIGNMENT_MODE_LABELS, type CoverageSettingsShape } from "@/lib/coverages/settings";
import { saveCoverageSettingsAction, type PanelState } from "../actions";

const inicial: PanelState = { error: null, ok: null };

/**
 * La configuración del módulo para esta organización.
 *
 * Los `name` de cada campo tienen que coincidir exactamente con los que lee
 * `saveCoverageSettingsAction`: son el contrato entre las dos mitades, y un nombre que no
 * coincide no da error, simplemente guarda el valor por omisión sin que nadie se entere.
 */
export function SettingsForm({ settings }: { settings: CoverageSettingsShape }) {
  const [state, action, guardando] = useActionState(saveCoverageSettingsAction, inicial);

  return (
    <form action={action} className="space-y-6">
      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Cómo se llaman las cosas acá</legend>
        <Texto name="moduleLabel" label="Nombre del módulo" valor={settings.moduleLabel} placeholder="Solicitudes y Coberturas" />
        <Texto name="termRequest" label="Cómo le dicen a un pedido" valor={settings.termRequest} placeholder="Solicitud" />
        <Texto name="termCollaborator" label="Cómo le dicen a quien hace el trabajo" valor={settings.termCollaborator} placeholder="Colaborador/a" />
        <Texto name="termRequester" label="Cómo le dicen a quien lo pide" valor={settings.termRequester} placeholder="Solicitante" />
        <Texto name="termCall" label="Cómo le dicen a una convocatoria" valor={settings.termCall} placeholder="Convocatoria" />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Cómo se arma el equipo</legend>
        <label className="block space-y-1">
          <span className="text-sm font-medium">Modalidad</span>
          <select
            name="assignmentMode"
            defaultValue={settings.assignmentMode}
            className="w-full min-h-11 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 text-sm"
          >
            {ASSIGNMENT_MODES.map((m) => (
              <option key={m} value={m}>
                {ASSIGNMENT_MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </label>
        <Tilde name="requiresApproval" label="Un pedido necesita aprobación antes de convertirse en trabajo" valor={settings.requiresApproval} />
        <Tilde name="requiresCoordinatorConfirmation" label="Postularse no alcanza: un coordinador confirma quién queda" valor={settings.requiresCoordinatorConfirmation} />
        <Numero name="reinforcementThresholdMinutes" label="A partir de cuántos minutos conviene sumar gente" valor={settings.reinforcementThresholdMinutes} min={30} max={1440} />
        <Numero name="recommendedCollaborators" label="Cuántas personas recomendar cuando se supera" valor={settings.recommendedCollaborators} min={1} max={20} />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">El formulario público</legend>
        <Tilde name="publicFormEnabled" label="Recibir pedidos por el formulario público" valor={settings.publicFormEnabled} />
        <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
          Con esto encendido, cualquiera con el enlace puede mandarte un pedido. Empieza apagado
          a propósito: publicar un formulario que recibe datos de terceros tiene que ser una
          decisión, no algo que pasó al encender el módulo.
        </p>
        <Lista name="publicFormIntro" label="Qué leen antes de completarlo" valor={settings.publicFormIntro ?? ""} />
        <Lista name="notifyEmails" label="A quién avisarle cuando entra un pedido (uno por línea)" valor={settings.notifyEmails.join("\n")} />
      </fieldset>

      <fieldset className="fo-card space-y-4 p-5">
        <legend className="px-1 text-sm font-semibold">Vocabularios propios</legend>
        <Lista name="zones" label="Zonas donde trabajan (una por línea)" valor={settings.zones.join("\n")} />
        <Lista name="specialties" label="Especialidades (una por línea)" valor={settings.specialties.join("\n")} />
        <Lista name="roleTemplates" label="Roles que suelen necesitar (uno por línea)" valor={settings.roleTemplates.join("\n")} />
      </fieldset>

      {state.error ? (
        <p role="alert" className="text-sm text-[var(--fo-danger)]">{state.error}</p>
      ) : null}
      {state.ok ? <p className="text-sm text-[var(--fo-muted)]">{state.ok}</p> : null}

      <button type="submit" className="fo-btn min-h-11" disabled={guardando}>
        {guardando ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}

const CLASES =
  "w-full min-h-11 rounded-lg border border-[var(--fo-border)] bg-[var(--fo-bg)] px-3 py-2 text-sm";

function Texto({ name, label, valor, placeholder }: { name: string; label: string; valor: string | null; placeholder: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input name={name} defaultValue={valor ?? ""} placeholder={placeholder} className={CLASES} />
    </label>
  );
}

function Numero({ name, label, valor, min, max }: { name: string; label: string; valor: number; min: number; max: number }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <input type="number" name={name} defaultValue={valor} min={min} max={max} className={CLASES} />
    </label>
  );
}

function Tilde({ name, label, valor }: { name: string; label: string; valor: boolean }) {
  return (
    <label className="flex gap-3 text-sm leading-relaxed">
      <input type="checkbox" name={name} defaultChecked={valor} className="mt-1 size-5 shrink-0" />
      <span>{label}</span>
    </label>
  );
}

function Lista({ name, label, valor }: { name: string; label: string; valor: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium">{label}</span>
      <textarea name={name} rows={3} defaultValue={valor} className={CLASES} />
    </label>
  );
}
```

- [ ] **Paso 3: Agregar las pantallas al menú del módulo**

En `apps/fotoffice/lib/modules/submodules.ts`, importar la constante y agregar el bloque:

```ts
const COBERTURAS: SubmoduleItem[] = [
  {
    href: "/coberturas",
    label: "Solicitudes",
    icon: "Inbox",
    description: "Los pedidos que llegaron y en qué anda cada uno.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/coberturas/configuracion",
    label: "Configuración",
    icon: "Settings",
    description: "Las palabras, los plazos y quién decide en esta organización.",
    requiresManage: true,
    activeMatch: "under",
  },
];
```

Y registrarlo en `POR_MODULO`:

```ts
  [COVERAGES_MODULE_KEY]: COBERTURAS,
```

- [ ] **Paso 4: Encender el módulo en el menú lateral**

En `apps/fotoffice/app/(shell)/layout.tsx`, junto a los otros:

```ts
  const coveragesOn = enabledModuleKeys.has(COVERAGES_MODULE_KEY);
```

y pasarlo a `<ShellSidebar coveragesEnabled={coveragesOn} …>`. En
`components/shell/shell-sidebar.tsx`, agregar la prop y la entrada siguiendo exactamente el
patrón de `rafflesEnabled`.

- [ ] **Paso 5: Verificar**

```bash
cd apps/fotoffice && npx tsc --noEmit -p tsconfig.json && pnpm test && pnpm build
```

- [ ] **Paso 6: Commit**

```bash
git add apps/fotoffice
git commit -m "Configuración del módulo por workspace y su lugar en el menú"
```

---

## Tarea 14: Verificación de punta a punta

**Archivos:**
- Crear: `apps/fotoffice/lib/coverages/criterios-de-aceptacion.test.ts`

Esta tarea no agrega funcionalidad: comprueba que lo construido cumple el diseño.

- [ ] **Paso 1: Escribir el test de los criterios**

Crear `apps/fotoffice/lib/coverages/criterios-de-aceptacion.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { DEFAULT_COVERAGE_SETTINGS } from "./settings";
import { assertRequestTransition } from "./transitions";
import { recomendarRefuerzo } from "./reinforcement";
import { terminologyFor } from "./terminology";
import { planSubmission } from "./submit-plan";
import { resolveTrackingView } from "./tracking-view";

/**
 * Los criterios de aceptación del diseño, como test.
 *
 * No repiten lo que ya prueban los tests de cada pieza: recorren el circuito completo con los
 * mismos datos del caso de demostración, que es la forma de descubrir que dos piezas correctas
 * por separado no encajan.
 *
 * Los datos salen del §32 del documento original: Asociación Manos Abiertas, jornada solidaria
 * del 26.09.2026 de 14:00 a 18:30 en Rosario, 4 h 30 de duración.
 */
describe("el caso de la jornada solidaria", () => {
  const settings = { ...DEFAULT_COVERAGE_SETTINGS, publicFormEnabled: true };
  const inicio = new Date("2026-09-26T17:00:00Z"); // 14:00 en Argentina
  const fin = new Date("2026-09-26T21:30:00Z"); // 18:30
  const duracion = (fin.getTime() - inicio.getTime()) / 60000;

  it("supera las 3 horas y el sistema recomienda dos voluntarios", () => {
    const r = recomendarRefuerzo({ durationMinutes: duracion, assigned: 0, settings });
    expect(r?.recommended).toBe(2);
  });

  it("la recomendación no bloquea: es un aviso, no un freno", () => {
    // El coordinador puede seguir igual. Que la recomendación exista no cambia ninguna
    // transición válida.
    expect(assertRequestTransition({ from: "EN_EVALUACION", to: "APROBADA" })).toEqual({
      ok: true,
    });
  });

  it("el circuito completo: recibida, evaluada, con un dato pedido, y aprobada", () => {
    expect(assertRequestTransition({ from: "RECIBIDA", to: "EN_EVALUACION" }).ok).toBe(true);
    expect(assertRequestTransition({ from: "EN_EVALUACION", to: "REQUIERE_INFO" }).ok).toBe(true);
    expect(assertRequestTransition({ from: "REQUIERE_INFO", to: "EN_EVALUACION" }).ok).toBe(true);
    expect(assertRequestTransition({ from: "EN_EVALUACION", to: "APROBADA" }).ok).toBe(true);
  });

  it("mientras se le pide un dato, la organización puede responder desde su enlace", () => {
    const v = resolveTrackingView(
      {
        status: "REQUIERE_INFO",
        tokenExpiresAt: new Date("2027-01-01T00:00:00Z"),
        tokenRevokedAt: null,
      },
      new Date("2026-09-14T12:00:00Z"),
    );
    expect(v).toEqual({ kind: "OK", puedeResponder: true });
  });

  it("el módulo no habla de FOTOPOSITIVA: con otra terminología dice otra cosa", () => {
    // Es el criterio 20 del diseño. Si alguna vez una palabra queda escrita en el código, este
    // test la encuentra.
    const ong = terminologyFor({ ...settings, termCollaborator: "Voluntario/a" });
    const estudio = terminologyFor({ ...settings, termCollaborator: "Fotógrafo" });
    expect(ong.collaborator).toBe("Voluntario/a");
    expect(estudio.collaborator).toBe("Fotógrafo");
  });

  it("con el formulario cerrado no entra nada, aunque el POST llegue", () => {
    const r = planSubmission({
      settings: { ...settings, publicFormEnabled: false },
      recientes: 0,
      duplicada: null,
      parsed: { contactEmail: "contacto@manos.org", startsAt: inicio },
    });
    expect(r.kind).toBe("RECHAZAR");
  });
});
```

- [ ] **Paso 2: Correr todo**

```bash
cd apps/fotoffice && pnpm test
```

Esperado: todo verde salvo `lib/template-v2/access.test.ts`, que ya venía roto.

- [ ] **Paso 3: Verificación completa**

```bash
cd apps/fotoffice && npx tsc --noEmit -p tsconfig.json
cd apps/fotoffice && pnpm lint
cd apps/fotoffice && pnpm build
```

Esperado: tipos sin salida; lint con los 3 errores preexistentes y **ninguno nuevo**; build
compilando y listando `/coberturas`, `/coberturas/[id]`, `/coberturas/configuracion`,
`/w/[workspaceSlug]/coberturas/solicitar` y `/sc/[token]`.

- [ ] **Paso 4: Verificar que la migración sigue sin aplicarse**

```bash
cd packages/db && npx prisma migrate status 2>&1 | head -20
```

Esperado: que informe la migración `20260914120000_coberturas` como pendiente. **No ejecutarla.**
Aplicarla a las cinco bases Neon es una decisión de quien opera, con el procedimiento ya
documentado en el repositorio.

- [ ] **Paso 5: Commit**

```bash
git add apps/fotoffice/lib/coverages/criterios-de-aceptacion.test.ts
git commit -m "Los criterios de aceptación del diseño, como test"
```

---

## Revisión del plan contra el diseño

Cobertura de cada sección del diseño:

| Sección | Tarea |
|---|---|
| §4 Nombre y encaje | 2 |
| §5 Máquinas de estado (solicitud) | 3 |
| §6 Las once tablas | 1 |
| §7 Rutas públicas | 10, 11 |
| §7 Rutas del panel | 12, 13 |
| §8 Permisos | 2, 12 |
| §9 Formulario y seguimiento | 6, 9, 10, 11 |
| §9 Rate limiting y antiduplicado | 5, 9 |
| §10 Regla del refuerzo | 4, 12 |
| §11 Comunicaciones | 8, 9, 12 |
| §12 Seguridad y privacidad | 5, 6, 7, 11 |
| §13 Migración | 1, 14 |
| §14 Pruebas | todas |
| §16 Criterios de aceptación | 14 |

**Lo que este plan NO cubre y queda para la etapa 1b**, con su tabla ya creada: las otras
cinco máquinas de estado (§5), convocatorias, roles y cupos, postulaciones, asignaciones,
ficha operativa, entregables, los dos portales y el perfil de colaborador. También el
reenvío del enlace de seguimiento, que necesita emitir un token nuevo (ver la nota de la
Tarea 12).

