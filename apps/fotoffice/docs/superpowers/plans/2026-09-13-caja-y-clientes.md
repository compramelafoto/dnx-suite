# Etapa 1a — Caja y Clientes: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Darle a un workspace de FotoOffice un libro de ingresos y egresos con arqueo por turno, y un padrón de clientes con los datos fiscales que la facturación va a necesitar después.

**Architecture:** Dos módulos nuevos (`cash` y `clients`) que siguen el patrón ya establecido por `bookings` y `raffles`: lógica pura y probada en `lib/<módulo>/`, control de acceso en dos niveles en `access.ts`, consultas en `repository.ts`, pantallas en `app/(shell)/<ruta>/` con acciones de servidor, y la clave del módulo declarada en el registro central. Los dos viajan juntos porque Caja sin Clientes repetiría el error de Reservas —un nombre suelto en un campo de texto— y no habría forma de enganchar el Club ni de facturar después.

**Tech Stack:** Next.js 16.2.1 (App Router, server actions), React 19.2.4, Prisma vía `@repo/db`, PostgreSQL en Neon, vitest (entorno node), TypeScript, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-09-13-negocio-caja-ventas-servicio-tecnico-y-club-design.md` — leer §5 (Clientes), §6 (Caja), §11.1 (por qué los datos fiscales van desde ahora) y §12 (etapas).

## Global Constraints

Estas reglas valen para **todas** las tareas. No se negocian por apuro.

- **Ningún enum de Prisma nuevo.** Todos los estados y tipos van como `String` en el esquema y como unión de literales en TypeScript. El `schema.prisma` está compartido por las cinco aplicaciones de la suite y un enum que no exista en alguna de las cinco bases rompe las escrituras de esa aplicación. Precedentes en el repositorio: `Booking.status`, `Raffle.status`.
- **El despliegue NO corre `prisma migrate deploy`.** La migración se aplica a mano y se registra en `_prisma_migrations`. Ver Tarea 13.
- **Dinero:** en la base `Decimal(12, 2)`; en el código, centavos enteros (`number`). La conversión se hace **siempre** con `lib/membership/money.ts` (`decimalArsToMinor`, `minorToDecimalString`, `formatMinorArs`), nunca con `Number(decimal)`.
- **Todo texto de cara al usuario va en castellano rioplatense**, en segunda persona del singular ("Poné un nombre", no "Ingrese un nombre"). Mirá los mensajes de `lib/bookings/space-form.ts` para el tono.
- **Los comentarios del código se escriben en castellano y explican el porqué, no el qué.** Es el estilo de todo el repositorio.
- **Aislamiento por workspace:** toda consulta lleva `workspaceId`. Como el `where` de un `update` de Prisma tiene que ser único, la pertenencia se verifica con un `count` aparte **antes** de escribir. Patrón en `app/(shell)/reservas/actions.ts:44`.
- **Control de acceso en el servidor, en dos niveles:** módulo habilitado para ese workspace, y rol de la persona. Esconder un link del menú es cosmético, nunca control.
- **Tests:** vitest en entorno node, sobre `lib/**/*.test.ts`. La lógica pura se prueba sin base y sin red. Correr todo con `pnpm test` desde `apps/fotoffice`; un archivo con `pnpm test <ruta>`.
- **Un commit por tarea**, como mínimo. Mensaje en castellano, imperativo, explicando el porqué.

---

## Estructura de archivos

### Módulo Clientes

| Archivo | Responsabilidad |
|---|---|
| `lib/clients/constants.ts` | Clave del módulo, condiciones de IVA, tipos de documento |
| `lib/clients/client-form.ts` | Parseo y validación del formulario. **Puro** |
| `lib/clients/client-number.ts` | Cálculo del próximo número de cliente. **Puro** |
| `lib/clients/access.ts` | Guardias `requireClientsStaff` / `requireClientsAdmin` |
| `lib/clients/repository.ts` | Consultas Prisma: listar, buscar, obtener ficha |
| `lib/clients/find-or-create.ts` | La puerta única que usan los otros módulos |
| `app/(shell)/clientes/layout.tsx` | Guardia de la sección entera |
| `app/(shell)/clientes/page.tsx` | Listado con buscador |
| `app/(shell)/clientes/nuevo/page.tsx` | Alta |
| `app/(shell)/clientes/[clientId]/page.tsx` | Ficha y edición |
| `app/(shell)/clientes/actions.ts` | Acciones de servidor |
| `components/clients/client-form.tsx` | Formulario compartido por alta y edición |

### Módulo Caja

| Archivo | Responsabilidad |
|---|---|
| `lib/cash/constants.ts` | Clave, tipos de cuenta, estados de turno, categorías semilla |
| `lib/cash/account-form.ts` | Parseo del formulario de cuenta. **Puro** |
| `lib/cash/category-form.ts` | Parseo del formulario de categoría. **Puro** |
| `lib/cash/movement-form.ts` | Parseo del formulario de movimiento. **Puro** |
| `lib/cash/shift.ts` | Reglas del turno: esperado, diferencia, si se puede abrir o cerrar. **Puro** |
| `lib/cash/transfer.ts` | Pases entre cuentas y el pase sugerido a la caja fuerte |
| `lib/cash/balance.ts` | Saldos y totales por categoría y período. **Puro** |
| `lib/cash/access.ts` | Guardias del módulo |
| `lib/cash/repository.ts` | Consultas Prisma |
| `lib/cash/record-movement.ts` | La costura que usan los otros módulos para depositar un cobro |
| `lib/cash/reverse.ts` | Anulación por contramovimiento |
| `app/(shell)/caja/layout.tsx` | Guardia de la sección |
| `app/(shell)/caja/page.tsx` | Libro del turno abierto, con saldo |
| `app/(shell)/caja/movimientos/page.tsx` | Libro completo con filtros |
| `app/(shell)/caja/turnos/page.tsx` | Historial de arqueos |
| `app/(shell)/caja/pases/page.tsx` | Historial de pases entre cuentas |
| `app/(shell)/caja/configuracion/page.tsx` | Cuentas y categorías |
| `app/(shell)/caja/actions.ts` | Acciones de servidor |
| `components/cash/*.tsx` | Formularios y tablas |

### Archivos existentes que se modifican

| Archivo | Qué cambia |
|---|---|
| `packages/db/prisma/schema.prisma` | Nueve modelos nuevos + relaciones en `Workspace` y `Member` |
| `packages/db/prisma/migrations/20260913000000_cash_and_clients/migration.sql` | La migración, puramente aditiva |
| `lib/modules/registry.ts` | `cash` y `clients` pasan de `PLANNED` a `AVAILABLE`, con ruta |
| `lib/modules/submodules.ts` | Submenús de los dos módulos |
| `lib/modules/registry.test.ts` | La prueba que enumera los módulos `AVAILABLE` |
| `lib/membership/manual-payment.ts` | Depositar en Caja el pago de cuota cobrado en mano |
| `app/api/payments/mp/webhook/route.ts` | Depositar en Caja el pago de cuota cobrado por Mercado Pago |
| `lib/bookings/lifecycle.ts` | Depositar el cobro de reserva en Caja |

---

## Tarea 1: Esquema y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (seis modelos nuevos + relaciones en `Workspace` y `Member`)
- Create: `packages/db/prisma/migrations/20260913000000_cash_and_clients/migration.sql`

**Interfaces:**
- Consumes: nada. Es la primera tarea.
- Produces: los modelos Prisma `Client`, `CashAccount`, `CashCategory`, `CashShift`, `CashMovement` y `CashTransfer`, accesibles como `prisma.client`, `prisma.cashAccount`, `prisma.cashCategory`, `prisma.cashShift`, `prisma.cashMovement` y `prisma.cashTransfer`. Todas las tareas siguientes dependen de esto.

**Contexto que hace falta leer antes:** `packages/db/prisma/migrations/20260911000000_sorteos/migration.sql` es el modelo a imitar — SQL crudo, aditivo, con los índices y las claves foráneas explícitas.

- [ ] **Paso 1: Agregar los cinco modelos al final de `schema.prisma`**

Pegar al final del archivo, después del último modelo:

```prisma
/// Cliente de un workspace: quien le compra algo al negocio.
///
/// Independiente de `Member` a propósito. Socio y cliente son vínculos distintos con la
/// institución, y una misma persona puede tener los dos: el socio que además alquila el
/// estudio. `memberId` es el puente opcional para ese caso, y por eso es único.
model Client {
  id           String @id @default(cuid())
  workspaceId  String
  /// Correlativo DENTRO del workspace, no global. Mismo criterio que `Member.memberNumber`.
  clientNumber Int

  /// PERSONA | EMPRESA. Texto y no enum: el esquema lo comparten cinco aplicaciones.
  kind         String  @default("PERSONA")
  firstName    String?
  lastName     String?
  businessName String?

  /// DNI | CUIT | CUIL | PASAPORTE | OTRO
  docType   String?
  docNumber String?
  /// RESPONSABLE_INSCRIPTO | MONOTRIBUTO | EXENTO | CONSUMIDOR_FINAL | NO_CATEGORIZADO
  ///
  /// Obligatorio desde el día uno aunque todavía no se facture: una venta que no guardó la
  /// condición fiscal no se puede facturar nunca más. Ver §11.1 del diseño.
  ivaCondition String @default("CONSUMIDOR_FINAL")

  email   String?
  phone   String?
  address String?
  city    String?
  notes   String?

  /// ACTIVO | INACTIVO
  status String @default("ACTIVO")

  /// Cuando este cliente es además socio de este mismo workspace.
  memberId String? @unique
  /// Cuenta de FotoOffice, para el portal del cliente (etapa 5).
  userId   Int?

  /// Consentimiento para comunicaciones. Separado a propósito de la adhesión al Club:
  /// estar en una lista no es lo mismo que aceptar que te escriban.
  consentsMarketing Boolean   @default(false)
  consentedAt       DateTime?

  createdByUserId Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  workspace Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  member    Member?        @relation(fields: [memberId], references: [id], onDelete: SetNull)
  movements CashMovement[]

  @@unique([workspaceId, clientNumber])
  @@index([workspaceId, status])
  @@index([workspaceId, docNumber])
  @@index([workspaceId, email])
}

/// Una cuenta de caja: dónde está la plata.
///
/// El efectivo se cuenta; Mercado Pago y el banco se concilian. Meterlos en la misma bolsa
/// haría que el arqueo diera mal todos los días. Las crea el administrador del workspace sin
/// tope: tres sucursales son tres cuentas de efectivo, cada una con su turno.
model CashAccount {
  id          String  @id @default(cuid())
  workspaceId String
  name        String
  /// EFECTIVO | DIGITAL. Sólo las EFECTIVO se arquean.
  kind        String  @default("EFECTIVO")
  /// La caja fuerte. No lleva turno diario: no se abre todas las mañanas, se cuenta cada tanto.
  isVault     Boolean @default(false)
  /// Fondo fijo: lo que queda para dar vuelto. Al cerrar, la pantalla propone pasar el resto.
  fixedFloatArs Decimal? @db.Decimal(12, 2)
  isDefault   Boolean @default(false)
  isActive    Boolean @default(true)
  order       Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace     Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  shifts        CashShift[]
  movements     CashMovement[]
  transfersOut  CashTransfer[] @relation("CashTransferFrom")
  transfersIn   CashTransfer[] @relation("CashTransferTo")

  @@unique([workspaceId, name])
  @@index([workspaceId, isActive])
}

/// Un pase de plata entre dos cuentas del mismo workspace.
///
/// El caso de todos los días: al cerrar el mostrador se guarda lo recaudado en la caja
/// fuerte y queda el fondo fijo para el vuelto. No es un ingreso ni un egreso del negocio
/// —la plata no entró ni salió, cambió de lugar— y por eso los dos asientos que genera
/// llevan `transferId` y los reportes de ingresos y egresos los excluyen.
model CashTransfer {
  id            String @id @default(cuid())
  workspaceId   String
  fromAccountId String
  toAccountId   String

  amountArs  Decimal  @db.Decimal(12, 2)
  occurredAt DateTime
  note       String?

  createdByUserId Int?
  createdAt       DateTime @default(now())

  workspace   Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  fromAccount CashAccount    @relation("CashTransferFrom", fields: [fromAccountId], references: [id], onDelete: Restrict)
  toAccount   CashAccount    @relation("CashTransferTo", fields: [toAccountId], references: [id], onDelete: Restrict)
  movements   CashMovement[]

  @@index([workspaceId, occurredAt])
}

/// Categoría de un movimiento, definida por cada negocio.
///
/// Sirve para un solo lado: "Sueldos" no puede ser un ingreso. Por eso `kind` entra en la
/// clave única, y "Reparaciones" puede existir de los dos lados sin chocar.
model CashCategory {
  id          String  @id @default(cuid())
  workspaceId String
  name        String
  /// INGRESO | EGRESO
  kind        String
  isActive    Boolean @default(true)
  order       Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  movements CashMovement[]

  @@unique([workspaceId, kind, name])
  @@index([workspaceId, kind, isActive])
}

/// Un turno de caja: se abre declarando un monto y se cierra contando.
///
/// La diferencia se guarda calculada y no se recalcula al leer: el saldo de hace dos años
/// tiene que seguir diciendo lo mismo aunque después se corrija un movimiento.
model CashShift {
  id          String @id @default(cuid())
  workspaceId String
  accountId   String

  openedAt         DateTime @default(now())
  openedByUserId   Int?
  openingAmountArs Decimal  @db.Decimal(12, 2)

  closedAt          DateTime?
  closedByUserId    Int?
  /// Lo que se contó de verdad al cerrar.
  countedAmountArs  Decimal?  @db.Decimal(12, 2)
  /// Apertura + ingresos − egresos, congelado al cerrar.
  expectedAmountArs Decimal?  @db.Decimal(12, 2)
  /// Contado − esperado.
  differenceArs     Decimal?  @db.Decimal(12, 2)
  /// Obligatoria cuando la diferencia no es cero: una diferencia sin explicar no sirve.
  differenceNote    String?

  /// ABIERTO | CERRADO
  status String @default("ABIERTO")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  workspace Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  account   CashAccount    @relation(fields: [accountId], references: [id], onDelete: Restrict)
  movements CashMovement[]

  @@index([workspaceId, openedAt])
  @@index([accountId, status])
}

/// Un asiento del libro.
///
/// Los que vienen de otro módulo NO se editan: se anulan con un contramovimiento que deja
/// los dos asientos a la vista. Un libro que se puede reescribir no prueba nada — mismo
/// criterio que `WorkspaceFeeLedgerEntry`.
model CashMovement {
  id          String  @id @default(cuid())
  workspaceId String
  accountId   String
  shiftId     String?

  /// INGRESO | EGRESO
  kind       String
  amountArs  Decimal  @db.Decimal(12, 2)
  occurredAt DateTime

  categoryId String?
  /// EFECTIVO | TRANSFERENCIA | MERCADO_PAGO | TARJETA | OTRO
  paymentMethod String @default("EFECTIVO")

  /// La llave de los puntos del Club (etapa 3): todo ingreso con cliente genera puntos.
  clientId    String?
  description String
  receiptRef  String?

  /// manual | membership | bookings | sales | work-orders
  sourceModule String  @default("manual")
  /// Id del pago, la reserva o la venta que lo originó.
  sourceRef    String?

  /// El asiento que este anula. Único: un movimiento se anula una sola vez.
  reversesMovementId String? @unique
  reverseReason      String?

  /// El pase que lo generó. Cuando no es nulo, este asiento NO es un ingreso ni un egreso
  /// del negocio: es una pata de una transferencia, y los reportes lo excluyen.
  transferId String?

  createdByUserId Int?
  createdAt       DateTime @default(now())

  workspace Workspace     @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  account   CashAccount   @relation(fields: [accountId], references: [id], onDelete: Restrict)
  shift     CashShift?    @relation(fields: [shiftId], references: [id], onDelete: SetNull)
  category  CashCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  client    Client?       @relation(fields: [clientId], references: [id], onDelete: SetNull)

  transfer   CashTransfer? @relation(fields: [transferId], references: [id], onDelete: SetNull)
  reverses   CashMovement? @relation("CashMovementReversal", fields: [reversesMovementId], references: [id], onDelete: SetNull)
  reversedBy CashMovement? @relation("CashMovementReversal")

  /// Lo que hace idempotente al depósito automático: una reserva no puede entrar dos veces.
  /// Los manuales no chocan entre sí porque `sourceRef` es nulo y Postgres no considera
  /// iguales dos nulos en un índice único.
  @@unique([sourceModule, sourceRef])
  @@index([workspaceId, occurredAt])
  @@index([accountId, occurredAt])
  @@index([shiftId])
  @@index([clientId, occurredAt])
  @@index([transferId])
}
```

- [ ] **Paso 2: Agregar las relaciones inversas**

En `model Workspace`, junto a las otras listas (cerca de `raffles Raffle[]`):

```prisma
  clients        Client[]
  cashAccounts   CashAccount[]
  cashCategories CashCategory[]
  cashShifts     CashShift[]
  cashMovements  CashMovement[]
  cashTransfers  CashTransfer[]
```

En `model Member`, junto a las otras relaciones:

```prisma
  /// Ficha de cliente de este mismo socio, cuando también le compra algo al negocio.
  clientLink Client?
```

- [ ] **Paso 3: Verificar que el esquema es válido y generar el cliente**

```bash
pnpm --filter @repo/db exec prisma validate
```

Esperado: `The schema at prisma/schema.prisma is valid 🚀`

```bash
pnpm --filter @repo/db db:generate
```

Esperado: `Generated Prisma Client`. Si falla por una relación inversa faltante, el error dice exactamente cuál.

- [ ] **Paso 4: Escribir la migración**

Crear `packages/db/prisma/migrations/20260913000000_cash_and_clients/migration.sql`:

```sql
-- Etapa 1a: Caja y Clientes. Puramente aditiva — seis tablas nuevas, ninguna columna
-- existente modificada, ningún enum nuevo (el esquema lo comparten cinco aplicaciones).

CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientNumber" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'PERSONA',
    "firstName" TEXT,
    "lastName" TEXT,
    "businessName" TEXT,
    "docType" TEXT,
    "docNumber" TEXT,
    "ivaCondition" TEXT NOT NULL DEFAULT 'CONSUMIDOR_FINAL',
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVO',
    "memberId" TEXT,
    "userId" INTEGER,
    "consentsMarketing" BOOLEAN NOT NULL DEFAULT false,
    "consentedAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Client_memberId_key" ON "Client"("memberId");
CREATE UNIQUE INDEX "Client_workspaceId_clientNumber_key" ON "Client"("workspaceId", "clientNumber");
CREATE INDEX "Client_workspaceId_status_idx" ON "Client"("workspaceId", "status");
CREATE INDEX "Client_workspaceId_docNumber_idx" ON "Client"("workspaceId", "docNumber");
CREATE INDEX "Client_workspaceId_email_idx" ON "Client"("workspaceId", "email");
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CashAccount" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "isVault" BOOLEAN NOT NULL DEFAULT false,
    "fixedFloatArs" DECIMAL(12,2),
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CashAccount_workspaceId_name_key" ON "CashAccount"("workspaceId", "name");
CREATE INDEX "CashAccount_workspaceId_isActive_idx" ON "CashAccount"("workspaceId", "isActive");
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CashCategory" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashCategory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CashCategory_workspaceId_kind_name_key" ON "CashCategory"("workspaceId", "kind", "name");
CREATE INDEX "CashCategory_workspaceId_kind_isActive_idx" ON "CashCategory"("workspaceId", "kind", "isActive");
ALTER TABLE "CashCategory" ADD CONSTRAINT "CashCategory_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CashTransfer" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "fromAccountId" TEXT NOT NULL,
    "toAccountId" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashTransfer_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashTransfer_workspaceId_occurredAt_idx" ON "CashTransfer"("workspaceId", "occurredAt");
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_fromAccountId_fkey"
    FOREIGN KEY ("fromAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashTransfer" ADD CONSTRAINT "CashTransfer_toAccountId_fkey"
    FOREIGN KEY ("toAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CashShift" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openedByUserId" INTEGER,
    "openingAmountArs" DECIMAL(12,2) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" INTEGER,
    "countedAmountArs" DECIMAL(12,2),
    "expectedAmountArs" DECIMAL(12,2),
    "differenceArs" DECIMAL(12,2),
    "differenceNote" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABIERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CashShift_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CashShift_workspaceId_openedAt_idx" ON "CashShift"("workspaceId", "openedAt");
CREATE INDEX "CashShift_accountId_status_idx" ON "CashShift"("accountId", "status");
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashShift" ADD CONSTRAINT "CashShift_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- La regla "un solo turno abierto por cuenta" vive en la base y no sólo en el código.
-- Prisma no sabe expresar un índice único parcial en el esquema, así que se crea acá: sin
-- esto, dos personas abriendo caja al mismo tiempo dejan dos turnos abiertos y el arqueo
-- pierde sentido. Es el mismo criterio que `Booking_sin_solapamiento`.
CREATE UNIQUE INDEX "CashShift_un_turno_abierto_por_cuenta"
    ON "CashShift"("accountId") WHERE "status" = 'ABIERTO';

CREATE TABLE "CashMovement" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "shiftId" TEXT,
    "kind" TEXT NOT NULL,
    "amountArs" DECIMAL(12,2) NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "categoryId" TEXT,
    "paymentMethod" TEXT NOT NULL DEFAULT 'EFECTIVO',
    "clientId" TEXT,
    "description" TEXT NOT NULL,
    "receiptRef" TEXT,
    "sourceModule" TEXT NOT NULL DEFAULT 'manual',
    "sourceRef" TEXT,
    "reversesMovementId" TEXT,
    "reverseReason" TEXT,
    "transferId" TEXT,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CashMovement_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CashMovement_reversesMovementId_key" ON "CashMovement"("reversesMovementId");
CREATE UNIQUE INDEX "CashMovement_sourceModule_sourceRef_key" ON "CashMovement"("sourceModule", "sourceRef");
CREATE INDEX "CashMovement_workspaceId_occurredAt_idx" ON "CashMovement"("workspaceId", "occurredAt");
CREATE INDEX "CashMovement_accountId_occurredAt_idx" ON "CashMovement"("accountId", "occurredAt");
CREATE INDEX "CashMovement_shiftId_idx" ON "CashMovement"("shiftId");
CREATE INDEX "CashMovement_clientId_occurredAt_idx" ON "CashMovement"("clientId", "occurredAt");
CREATE INDEX "CashMovement_transferId_idx" ON "CashMovement"("transferId");
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_workspaceId_fkey"
    FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_shiftId_fkey"
    FOREIGN KEY ("shiftId") REFERENCES "CashShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "CashCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_reversesMovementId_fkey"
    FOREIGN KEY ("reversesMovementId") REFERENCES "CashMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashMovement" ADD CONSTRAINT "CashMovement_transferId_fkey"
    FOREIGN KEY ("transferId") REFERENCES "CashTransfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
```

- [ ] **Paso 5: Confirmar que el esquema y la migración dicen lo mismo**

```bash
pnpm --filter @repo/db db:drift
```

Esperado: sin diferencias entre `schema.prisma` y el historial de migraciones. Si reporta drift, la migración y el esquema se separaron: corregir la migración, **nunca** el esquema para que calce.

> **No aplicar todavía la migración a ninguna base.** Eso es la Tarea 13, al final, cuando el código esté completo y probado. Hasta entonces el trabajo es sólo de tipos.

- [ ] **Paso 6: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260913000000_cash_and_clients
git commit -m "Crear el esquema de Caja y Clientes

Cinco tablas nuevas y puramente aditivas: Client, CashAccount, CashCategory,
CashShift y CashMovement. Sin enums nuevos, porque el esquema lo comparten las
cinco aplicaciones de la suite.

Dos reglas viven en la base y no sólo en el código: un único turno abierto por
cuenta, con un índice único parcial que Prisma no sabe expresar, y la unicidad
de (sourceModule, sourceRef), que es lo que hace idempotente el depósito
automático de un cobro que viene de otro módulo.

Client guarda la condición frente al IVA desde el día uno aunque todavía no se
facture: una venta que no la guardó no se puede facturar nunca más."
```

---

## Tarea 2: Dar de alta los dos módulos en el registro

**Files:**
- Create: `lib/clients/constants.ts`
- Create: `lib/cash/constants.ts`
- Modify: `lib/modules/registry.ts:90` (entrada `cash`) y `:114` (entrada `clients`)
- Modify: `lib/modules/registry.test.ts` (la prueba que enumera los `AVAILABLE`)
- Modify: `lib/modules/nav.test.ts:33` (usa `"cash"` como ejemplo de `PLANNED`, y deja de serlo)
- Modify: `lib/modules/submodules.ts`

**Interfaces:**
- Consumes: nada de la Tarea 1.
- Produces: `CLIENTS_MODULE_KEY = "clients"`, `CASH_MODULE_KEY = "cash"`, `IVA_CONDITIONS`, `DOC_TYPES`, `CASH_ACCOUNT_KINDS`, `MOVEMENT_KINDS`, `PAYMENT_METHODS`, `SHIFT_STATUSES`, `SEED_CATEGORIES`. Los usan todas las tareas siguientes.

**Por qué va antes que el código de negocio:** registrar la clave con estado `AVAILABLE` hace que el módulo aparezca solo en el panel de administración y en el menú, sin tocar ningún otro archivo. Es la costura del sistema y conviene tenerla en verde antes de construir encima.

- [ ] **Paso 1: Escribir las constantes de Clientes**

Crear `lib/clients/constants.ts`:

```ts
/**
 * Constantes del módulo de clientes.
 *
 * La clave `clients` ya estaba reservada como `PLANNED` en `lib/modules/registry.ts` desde
 * antes de que existiera una línea de código, igual que pasó con reservas y con sorteos.
 */

export const CLIENTS_MODULE_KEY = "clients";

/**
 * Condición frente al IVA.
 *
 * Se guarda desde el día uno aunque la facturación sea la etapa 6: una venta que no guardó
 * la condición fiscal del comprador no se puede facturar nunca más.
 *
 * Texto y no enum de Prisma: el esquema lo comparten las cinco aplicaciones de la suite.
 */
export const IVA_CONDITIONS = [
  "CONSUMIDOR_FINAL",
  "RESPONSABLE_INSCRIPTO",
  "MONOTRIBUTO",
  "EXENTO",
  "NO_CATEGORIZADO",
] as const;

export type IvaCondition = (typeof IVA_CONDITIONS)[number];

export const IVA_CONDITION_LABELS: Record<IvaCondition, string> = {
  CONSUMIDOR_FINAL: "Consumidor final",
  RESPONSABLE_INSCRIPTO: "Responsable inscripto",
  MONOTRIBUTO: "Monotributo",
  EXENTO: "Exento",
  NO_CATEGORIZADO: "No categorizado",
};

export const DOC_TYPES = ["DNI", "CUIT", "CUIL", "PASAPORTE", "OTRO"] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const CLIENT_KINDS = ["PERSONA", "EMPRESA"] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];

export const CLIENT_STATUSES = ["ACTIVO", "INACTIVO"] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];
```

- [ ] **Paso 2: Escribir las constantes de Caja**

Crear `lib/cash/constants.ts`:

```ts
/**
 * Constantes del módulo de caja.
 *
 * La clave `cash` ya estaba reservada como `PLANNED` en `lib/modules/registry.ts`.
 */

export const CASH_MODULE_KEY = "cash";

/** Sólo las cuentas EFECTIVO se arquean: lo digital se concilia, no se cuenta. */
export const CASH_ACCOUNT_KINDS = ["EFECTIVO", "DIGITAL"] as const;
export type CashAccountKind = (typeof CASH_ACCOUNT_KINDS)[number];

export const MOVEMENT_KINDS = ["INGRESO", "EGRESO"] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export const PAYMENT_METHODS = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "MERCADO_PAGO",
  "TARJETA",
  "OTRO",
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SHIFT_STATUSES = ["ABIERTO", "CERRADO"] as const;
export type ShiftStatus = (typeof SHIFT_STATUSES)[number];

/**
 * De dónde vino el movimiento. Los que no son "manual" no se editan a mano: se anulan con
 * un contramovimiento, porque el dato de verdad vive en el módulo que lo originó.
 */
export const MOVEMENT_SOURCES = [
  "manual",
  "membership",
  "bookings",
  "sales",
  "work-orders",
] as const;
export type MovementSource = (typeof MOVEMENT_SOURCES)[number];

/**
 * Lo que se crea al encender el módulo.
 *
 * Una pantalla de categorías vacía no la llena nadie, y sin categorías el libro no sirve
 * para ningún reporte. Son un punto de partida editable, no una imposición.
 */
export const SEED_ACCOUNTS = [
  { name: "Caja diaria", kind: "EFECTIVO" as const, isVault: false, isDefault: true, order: 0 },
  { name: "Caja fuerte", kind: "EFECTIVO" as const, isVault: true, isDefault: false, order: 10 },
  { name: "Mercado Pago", kind: "DIGITAL" as const, isVault: false, isDefault: false, order: 20 },
] as const;

export const SEED_CATEGORIES = [
  { name: "Ventas", kind: "INGRESO" as const, order: 0 },
  { name: "Servicios", kind: "INGRESO" as const, order: 10 },
  { name: "Alquiler de espacios", kind: "INGRESO" as const, order: 20 },
  { name: "Cuotas", kind: "INGRESO" as const, order: 30 },
  { name: "Otros ingresos", kind: "INGRESO" as const, order: 90 },
  { name: "Proveedores", kind: "EGRESO" as const, order: 0 },
  { name: "Sueldos", kind: "EGRESO" as const, order: 10 },
  { name: "Alquiler del local", kind: "EGRESO" as const, order: 20 },
  { name: "Impuestos", kind: "EGRESO" as const, order: 30 },
  { name: "Otros egresos", kind: "EGRESO" as const, order: 90 },
] as const;
```

- [ ] **Paso 3: Actualizar la prueba del registro para que falle**

En `lib/modules/registry.test.ts`, agregar los dos imports arriba:

```ts
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
```

Y reemplazar la prueba que enumera los disponibles por:

```ts
  it("los módulos AVAILABLE hoy son exactamente courses-sales, evaluaciones, website, reservas, members, membership-dues, sorteos, caja y clientes", () => {
    expect(listAvailableModuleKeys().sort()).toEqual(
      [
        COURSES_SALES_MODULE_KEY,
        EVALUACIONES_MODULE_KEY,
        WEBSITE_MODULE_KEY,
        BOOKINGS_MODULE_KEY,
        MEMBERS_MODULE_KEY,
        MEMBERSHIP_DUES_MODULE_KEY,
        RAFFLES_MODULE_KEY,
        CASH_MODULE_KEY,
        CLIENTS_MODULE_KEY,
      ].sort(),
    );
  });
```

- [ ] **Paso 4: Correr la prueba y verificar que falla**

```bash
pnpm test lib/modules/registry.test.ts
```

Esperado: FALLA. El array recibido no incluye `"cash"` ni `"clients"`, porque siguen siendo `PLANNED`.

- [ ] **Paso 5: Pasar las dos entradas a AVAILABLE**

En `lib/modules/registry.ts`, agregar los imports:

```ts
import { CLIENTS_MODULE_KEY } from "@/lib/clients/constants";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
```

Reemplazar la entrada `cash` (línea 88-96 aproximadamente) por:

```ts
  {
    key: CASH_MODULE_KEY,
    label: "Caja",
    description:
      "Ingresos y egresos del negocio, con cuentas separadas, arqueo por turno y reportes por período.",
    category: "GENERAL",
    order: 30,
    route: "/caja",
    status: "AVAILABLE",
  },
```

Reemplazar la entrada `clients` por:

```ts
  {
    key: CLIENTS_MODULE_KEY,
    label: "Clientes",
    description:
      "Padrón de clientes del negocio: ficha, contacto, datos fiscales y enlace opcional al socio.",
    category: "GENERAL",
    order: 70,
    route: "/clientes",
    status: "AVAILABLE",
  },
```

- [ ] **Paso 6: Arreglar la prueba de navegación que usaba `cash` como ejemplo**

`lib/modules/nav.test.ts:33` usa `"cash"` para demostrar que una clave `PLANNED` nunca aparece en el menú. Ahora `cash` es `AVAILABLE`, así que la prueba probaría lo contrario de lo que dice. Reemplazar esa línea por otra clave que siga siendo `PLANNED`:

```ts
    const items = resolveEnabledNavModules(new Set(["events", "communications", COURSES_SALES_MODULE_KEY]));
```

- [ ] **Paso 7: Correr las pruebas y verificar que pasan**

```bash
pnpm test lib/modules/
```

Esperado: PASAN todas — `registry.test.ts`, `nav.test.ts`, `gating.test.ts` y `submodules.test.ts`.

- [ ] **Paso 8: Agregar los submenús**

En `lib/modules/submodules.ts`, agregar los imports de las dos claves nuevas y, junto a las otras listas, estas dos:

```ts
const CAJA: SubmoduleItem[] = [
  {
    href: "/caja",
    label: "Turno abierto",
    icon: "Wallet",
    description: "Lo que entró y salió en el turno que está abierto.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/caja/movimientos",
    label: "Movimientos",
    icon: "ArrowLeftRight",
    description: "El libro completo, con filtros por fecha, cuenta y categoría.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/caja/turnos",
    label: "Arqueos",
    icon: "ClipboardCheck",
    description: "Cada apertura y cierre, con su diferencia y su explicación.",
    requiresManage: false,
    activeMatch: "under",
  },
  {
    href: "/caja/configuracion",
    label: "Cuentas y categorías",
    icon: "Settings",
    description: "Dónde está la plata y cómo se clasifica lo que entra y sale.",
    requiresManage: true,
    activeMatch: "under",
  },
];

const CLIENTES: SubmoduleItem[] = [
  {
    href: "/clientes",
    label: "Padrón",
    icon: "Users",
    description: "Todos los clientes, su ficha y su historial de consumo.",
    requiresManage: false,
    activeMatch: "rest",
  },
  {
    href: "/clientes/nuevo",
    label: "Nuevo cliente",
    icon: "UserPlus",
    description: "Dar de alta a alguien que compra por primera vez.",
    requiresManage: false,
    activeMatch: "under",
  },
];
```

Y registrarlas en el mapa `POR_MODULO`, junto a las cuatro que ya están:

```ts
  [CASH_MODULE_KEY]: CAJA,
  [CLIENTS_MODULE_KEY]: CLIENTES,
```

- [ ] **Paso 9: Correr toda la batería**

```bash
pnpm test
```

Esperado: PASAN todas. Si `submodules.test.ts` valida que cada `href` empieza por la ruta del módulo o que los íconos existen, corregir lo que marque.

- [ ] **Paso 10: Commit**

```bash
git add lib/clients/constants.ts lib/cash/constants.ts lib/modules/
git commit -m "Dar de alta Caja y Clientes en el registro de módulos

Las dos claves ya estaban reservadas como PLANNED desde antes de que existiera
código. Pasarlas a AVAILABLE las hace aparecer solas en el panel de
administración y en el menú, sin tocar ningún otro archivo: esa es la costura
del sistema de módulos y conviene tenerla en verde antes de construir encima.

nav.test.ts usaba 'cash' como ejemplo de clave PLANNED que nunca aparece en el
menú. Como deja de serlo, la prueba pasa a usar 'events', que sigue reservada."
```

---

## Tarea 3: Clientes — el dominio puro

**Files:**
- Create: `lib/clients/client-form.ts`
- Create: `lib/clients/client-form.test.ts`
- Create: `lib/clients/client-number.ts`
- Create: `lib/clients/client-number.test.ts`
- Create: `lib/clients/display.ts`
- Create: `lib/clients/display.test.ts`

**Interfaces:**
- Consumes: `CLIENT_KINDS`, `DOC_TYPES`, `IVA_CONDITIONS`, `IvaCondition`, `DocType`, `ClientKind` de `lib/clients/constants.ts` (Tarea 2).
- Produces:
  - `parseClientForm(formData: FormData): ClientFormResult` donde `ClientFormResult = { ok: true; values: ClientFormValues } | { ok: false; error: string }`
  - `type ClientFormValues = { kind: ClientKind; firstName: string | null; lastName: string | null; businessName: string | null; docType: DocType | null; docNumber: string | null; ivaCondition: IvaCondition; email: string | null; phone: string | null; address: string | null; city: string | null; notes: string | null; status: "ACTIVO" | "INACTIVO" }`
  - `nextClientNumber(lastNumber: number | null): number`
  - `clientDisplayName(c: { kind: string; firstName: string | null; lastName: string | null; businessName: string | null }): string`

**Por qué separado de la acción de servidor:** las reglas se prueban sin levantar Next ni tocar la base. Es el patrón de `lib/bookings/space-form.ts`, y es lo que hace que estas pruebas corran en milisegundos.

- [ ] **Paso 1: Escribir las pruebas del nombre visible**

Crear `lib/clients/display.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { clientDisplayName } from "./display";

describe("clientDisplayName", () => {
  it("una persona se muestra Apellido, Nombre", () => {
    expect(
      clientDisplayName({ kind: "PERSONA", firstName: "Juan", lastName: "Pérez", businessName: null }),
    ).toBe("Pérez, Juan");
  });

  it("una empresa se muestra por su razón social", () => {
    expect(
      clientDisplayName({ kind: "EMPRESA", firstName: null, lastName: null, businessName: "Fotoluz SRL" }),
    ).toBe("Fotoluz SRL");
  });

  it("una persona sin apellido se muestra sólo con el nombre", () => {
    expect(
      clientDisplayName({ kind: "PERSONA", firstName: "Juan", lastName: null, businessName: null }),
    ).toBe("Juan");
  });

  it("sin ningún dato devuelve un texto legible y no una cadena vacía", () => {
    expect(
      clientDisplayName({ kind: "PERSONA", firstName: null, lastName: null, businessName: null }),
    ).toBe("Sin nombre");
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla**

```bash
pnpm test lib/clients/display.test.ts
```

Esperado: FALLA con `Failed to resolve import "./display"`.

- [ ] **Paso 3: Escribir `display.ts`**

```ts
/**
 * El nombre con el que se muestra un cliente. Módulo PURO.
 *
 * Nunca devuelve una cadena vacía: una fila en blanco en el listado es un cliente que
 * existe y no se puede seleccionar, que es peor que un cliente mal nombrado.
 */
export function clientDisplayName(c: {
  kind: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
}): string {
  if (c.kind === "EMPRESA") return c.businessName?.trim() || "Sin razón social";
  const apellido = c.lastName?.trim() ?? "";
  const nombre = c.firstName?.trim() ?? "";
  if (apellido && nombre) return `${apellido}, ${nombre}`;
  return apellido || nombre || "Sin nombre";
}
```

- [ ] **Paso 4: Correr y verificar que pasa**

```bash
pnpm test lib/clients/display.test.ts
```

Esperado: PASA, 4 pruebas.

- [ ] **Paso 5: Escribir las pruebas del número de cliente**

Crear `lib/clients/client-number.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { nextClientNumber } from "./client-number";

describe("nextClientNumber", () => {
  it("el primer cliente del workspace es el 1", () => {
    expect(nextClientNumber(null)).toBe(1);
  });

  it("sigue al último", () => {
    expect(nextClientNumber(47)).toBe(48);
  });

  it("un hueco en el medio no se rellena: sigue al mayor", () => {
    expect(nextClientNumber(120)).toBe(121);
  });
});
```

- [ ] **Paso 6: Correr y verificar que falla**

```bash
pnpm test lib/clients/client-number.test.ts
```

Esperado: FALLA con `Failed to resolve import "./client-number"`.

- [ ] **Paso 7: Escribir `client-number.ts`**

```ts
/**
 * El próximo número de cliente. Módulo PURO: recibe el último y decide.
 *
 * No se reutilizan huecos. Si el 33 se borró, el 33 no vuelve: un número de cliente que
 * apunta a dos personas distintas a lo largo del tiempo rompe cualquier comprobante viejo
 * que lo mencione.
 *
 * La condición de carrera —dos altas simultáneas pidiendo el mismo número— NO se resuelve
 * acá: la resuelve el índice único `(workspaceId, clientNumber)` de la base, y quien
 * llama reintenta. Ver `lib/clients/find-or-create.ts`.
 */
export function nextClientNumber(lastNumber: number | null): number {
  if (lastNumber === null || lastNumber < 1) return 1;
  return Math.floor(lastNumber) + 1;
}
```

- [ ] **Paso 8: Correr y verificar que pasa**

```bash
pnpm test lib/clients/client-number.test.ts
```

Esperado: PASA, 3 pruebas.

- [ ] **Paso 9: Escribir las pruebas del formulario**

Crear `lib/clients/client-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseClientForm } from "./client-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const persona = { kind: "PERSONA", firstName: "Juan", lastName: "Pérez" };

describe("parseClientForm", () => {
  it("una persona con nombre y apellido alcanza", () => {
    const r = parseClientForm(form(persona));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.firstName).toBe("Juan");
    expect(r.values.lastName).toBe("Pérez");
    expect(r.values.businessName).toBeNull();
  });

  it("por omisión es consumidor final: es el caso del mostrador", () => {
    const r = parseClientForm(form(persona));
    expect(r.ok && r.values.ivaCondition).toBe("CONSUMIDOR_FINAL");
  });

  it("una empresa sin razón social se rechaza", () => {
    const r = parseClientForm(form({ kind: "EMPRESA", businessName: "  " }));
    expect(r).toEqual({ ok: false, error: "Poné la razón social de la empresa." });
  });

  it("una persona sin nombre ni apellido se rechaza", () => {
    const r = parseClientForm(form({ kind: "PERSONA", firstName: "", lastName: "" }));
    expect(r).toEqual({ ok: false, error: "Poné al menos el nombre o el apellido." });
  });

  it("un correo que no es correo se rechaza", () => {
    const r = parseClientForm(form({ ...persona, email: "juan arroba casa" }));
    expect(r).toEqual({ ok: false, error: "Ese correo no se entiende." });
  });

  it("el correo vacío es válido: no todo cliente deja mail", () => {
    const r = parseClientForm(form({ ...persona, email: "  " }));
    expect(r.ok && r.values.email).toBeNull();
  });

  it("el correo se guarda en minúsculas y sin espacios", () => {
    const r = parseClientForm(form({ ...persona, email: "  Juan@Casa.COM " }));
    expect(r.ok && r.values.email).toBe("juan@casa.com");
  });

  it("un CUIT se limpia de guiones y puntos", () => {
    const r = parseClientForm(form({ ...persona, docType: "CUIT", docNumber: "20-12.345.678-9" }));
    expect(r.ok && r.values.docNumber).toBe("20123456789");
  });

  it("un CUIT que no tiene once dígitos se rechaza", () => {
    const r = parseClientForm(form({ ...persona, docType: "CUIT", docNumber: "2012345" }));
    expect(r).toEqual({ ok: false, error: "El CUIT tiene que tener once dígitos." });
  });

  it("un DNI que no tiene entre siete y ocho dígitos se rechaza", () => {
    const r = parseClientForm(form({ ...persona, docType: "DNI", docNumber: "123" }));
    expect(r).toEqual({ ok: false, error: "El DNI tiene que tener siete u ocho dígitos." });
  });

  it("un número de documento sin tipo se rechaza: no se sabe qué validar", () => {
    const r = parseClientForm(form({ ...persona, docNumber: "12345678" }));
    expect(r).toEqual({ ok: false, error: "Elegí el tipo de documento." });
  });

  it("una condición de IVA que no existe se rechaza en vez de guardarse", () => {
    const r = parseClientForm(form({ ...persona, ivaCondition: "INVENTADA" }));
    expect(r).toEqual({ ok: false, error: "Esa condición frente al IVA no existe." });
  });

  it("un responsable inscripto sin CUIT se rechaza: sin eso no se le puede facturar", () => {
    const r = parseClientForm(form({ ...persona, ivaCondition: "RESPONSABLE_INSCRIPTO" }));
    expect(r).toEqual({
      ok: false,
      error: "Un responsable inscripto necesita CUIT para poder facturarle.",
    });
  });

  it("los espacios sobrantes se recortan en todos los campos de texto", () => {
    const r = parseClientForm(form({ kind: "PERSONA", firstName: "  Juan  ", lastName: " Pérez " }));
    expect(r.ok && r.values.firstName).toBe("Juan");
    expect(r.ok && r.values.lastName).toBe("Pérez");
  });
});
```

- [ ] **Paso 10: Correr y verificar que falla**

```bash
pnpm test lib/clients/client-form.test.ts
```

Esperado: FALLA con `Failed to resolve import "./client-form"`.

- [ ] **Paso 11: Escribir `client-form.ts`**

```ts
import {
  CLIENT_KINDS,
  DOC_TYPES,
  IVA_CONDITIONS,
  type ClientKind,
  type DocType,
  type IvaCondition,
} from "./constants";

/**
 * Validación del formulario de un cliente. Módulo PURO: sin base y sin red.
 *
 * La validación fiscal es deliberadamente estricta en un solo punto —un responsable
 * inscripto necesita CUIT— y laxa en todo el resto. El mostrador tiene que poder dar de
 * alta a alguien con el nombre y nada más, porque si no, nadie lo carga y el padrón queda
 * vacío. Pero si alguien declara que es responsable inscripto, sin CUIT no se le va a poder
 * facturar, y descubrirlo seis meses después es peor que frenarlo ahora.
 */

export type ClientFormValues = {
  kind: ClientKind;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  docType: DocType | null;
  docNumber: string | null;
  ivaCondition: IvaCondition;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  notes: string | null;
  status: "ACTIVO" | "INACTIVO";
};

export type ClientFormResult =
  | { ok: true; values: ClientFormValues }
  | { ok: false; error: string };

function texto(fd: FormData, campo: string): string | null {
  const v = String(fd.get(campo) ?? "").trim();
  return v === "" ? null : v;
}

/** Un correo válido de verdad, sin pretender implementar el RFC. */
function correoValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function parseClientForm(formData: FormData): ClientFormResult {
  const kindRaw = String(formData.get("kind") ?? "PERSONA").trim();
  if (!CLIENT_KINDS.includes(kindRaw as ClientKind)) {
    return { ok: false, error: "Elegí si es una persona o una empresa." };
  }
  const kind = kindRaw as ClientKind;

  const firstName = texto(formData, "firstName");
  const lastName = texto(formData, "lastName");
  const businessName = texto(formData, "businessName");

  if (kind === "EMPRESA" && businessName === null) {
    return { ok: false, error: "Poné la razón social de la empresa." };
  }
  if (kind === "PERSONA" && firstName === null && lastName === null) {
    return { ok: false, error: "Poné al menos el nombre o el apellido." };
  }

  const ivaRaw = String(formData.get("ivaCondition") ?? "CONSUMIDOR_FINAL").trim();
  if (!IVA_CONDITIONS.includes(ivaRaw as IvaCondition)) {
    return { ok: false, error: "Esa condición frente al IVA no existe." };
  }
  const ivaCondition = ivaRaw as IvaCondition;

  const docTypeRaw = texto(formData, "docType");
  if (docTypeRaw !== null && !DOC_TYPES.includes(docTypeRaw as DocType)) {
    return { ok: false, error: "Ese tipo de documento no existe." };
  }
  const docType = docTypeRaw as DocType | null;

  // Los separadores que la gente escribe: 20-12.345.678-9.
  const docCrudo = texto(formData, "docNumber");
  const docNumber = docCrudo === null ? null : docCrudo.replace(/[.\-\s]/g, "");

  if (docNumber !== null && docType === null) {
    return { ok: false, error: "Elegí el tipo de documento." };
  }
  if (docType === "CUIT" || docType === "CUIL") {
    if (docNumber === null || !/^\d{11}$/.test(docNumber)) {
      return { ok: false, error: `El ${docType} tiene que tener once dígitos.` };
    }
  }
  if (docType === "DNI" && docNumber !== null && !/^\d{7,8}$/.test(docNumber)) {
    return { ok: false, error: "El DNI tiene que tener siete u ocho dígitos." };
  }

  // El único requisito fiscal duro: sin CUIT no hay factura A.
  if (ivaCondition === "RESPONSABLE_INSCRIPTO" && !(docType === "CUIT" && docNumber !== null)) {
    return {
      ok: false,
      error: "Un responsable inscripto necesita CUIT para poder facturarle.",
    };
  }

  const emailCrudo = texto(formData, "email");
  const email = emailCrudo === null ? null : emailCrudo.toLowerCase();
  if (email !== null && !correoValido(email)) {
    return { ok: false, error: "Ese correo no se entiende." };
  }

  const statusRaw = String(formData.get("status") ?? "ACTIVO").trim();
  const status = statusRaw === "INACTIVO" ? "INACTIVO" : "ACTIVO";

  return {
    ok: true,
    values: {
      kind,
      firstName,
      lastName,
      businessName,
      docType,
      docNumber,
      ivaCondition,
      email,
      phone: texto(formData, "phone"),
      address: texto(formData, "address"),
      city: texto(formData, "city"),
      notes: texto(formData, "notes"),
      status,
    },
  };
}
```

- [ ] **Paso 12: Correr y verificar que pasan**

```bash
pnpm test lib/clients/
```

Esperado: PASAN las 22 pruebas de los tres archivos.

- [ ] **Paso 13: Commit**

```bash
git add lib/clients/
git commit -m "Escribir el dominio puro de Clientes

Parseo del formulario, número correlativo y nombre visible, todo sin base y sin
red: es el patrón de lib/bookings/space-form.ts y hace que estas pruebas corran
en milisegundos.

La validación fiscal es estricta en un solo punto y laxa en el resto. El
mostrador tiene que poder dar de alta a alguien con el nombre y nada más, o el
padrón queda vacío. Pero si alguien se declara responsable inscripto, sin CUIT
no se le va a poder facturar, y descubrirlo seis meses después es peor que
frenarlo ahora.

El número de cliente no reutiliza huecos: un número que apunta a dos personas
distintas a lo largo del tiempo rompe cualquier comprobante viejo."
```

---

## Tarea 4: Clientes — acceso, repositorio y pantallas

**Files:**
- Create: `lib/clients/access.ts`, `lib/clients/repository.ts`
- Create: `app/(shell)/clientes/layout.tsx`, `page.tsx`, `nuevo/page.tsx`, `[clientId]/page.tsx`, `actions.ts`
- Create: `components/clients/client-form.tsx`

**Interfaces:**
- Consumes: `parseClientForm`, `clientDisplayName`, `nextClientNumber` (Tarea 3); `CLIENTS_MODULE_KEY` (Tarea 2); `prisma.client` (Tarea 1).
- Produces:
  - `requireClientsStaff(): Promise<{ user; workspace; role }>` y `requireClientsAdmin()`
  - `listClients(workspaceId: string, opts: { search?: string; status?: string }): Promise<ClientRow[]>` donde `ClientRow = { id: string; clientNumber: number; displayName: string; docNumber: string | null; email: string | null; phone: string | null; status: string; memberNumber: string | null }`
  - `getClient(workspaceId: string, clientId: string)` — la ficha completa o `null`
  - `saveClientAction(formData: FormData): Promise<void>`

**Referencias del repositorio a imitar:** `lib/bookings/access.ts` para los guardias (copiarlo y cambiar la clave y las rutas), `app/(shell)/reservas/espacios/page.tsx` para el listado, `app/(shell)/reservas/actions.ts:31` para la acción de guardado.

- [ ] **Paso 1: Escribir el control de acceso**

Crear `lib/clients/access.ts`, calcado de `lib/bookings/access.ts`:

```ts
import "server-only";
import { redirect } from "next/navigation";
import { requireActiveWorkspace } from "@/lib/workspace";
import { resolveWorkspaceRole } from "@/lib/workspace-role";
import { canManageWorkspaceSettings } from "@/lib/workspace-settings-access";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";
import { CLIENTS_MODULE_KEY } from "./constants";

/**
 * Control de acceso del módulo, en dos niveles y siempre en el servidor.
 *
 * Nivel 1: el módulo está habilitado para ESE workspace. Nivel 2: la persona tiene rol.
 * Ver y cargar clientes es STAFF+: el mostrador da de alta sin pedirle permiso a nadie.
 * Borrar o desactivar es ADMIN+.
 */
async function contextoBase() {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  if (!(await isModuleEnabledForWorkspace(workspace.id, CLIENTS_MODULE_KEY))) {
    redirect("/dashboard");
  }
  const role = await resolveWorkspaceRole(user.id, workspace.id);
  return { user, workspace, role };
}

export async function requireClientsStaff() {
  const ctx = await contextoBase();
  if (!ctx.role) redirect("/dashboard");
  return ctx;
}

export async function requireClientsAdmin() {
  const ctx = await contextoBase();
  if (!canManageWorkspaceSettings(ctx.role)) redirect("/clientes");
  return ctx;
}
```

- [ ] **Paso 2: Escribir el repositorio**

Crear `lib/clients/repository.ts`:

```ts
import "server-only";
import { prisma } from "@repo/db";
import { clientDisplayName } from "./display";

export type ClientRow = {
  id: string;
  clientNumber: number;
  displayName: string;
  docNumber: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  /// Número de socio, cuando este cliente también lo es. Para mostrarlo en el listado.
  memberNumber: string | null;
};

/**
 * El listado, con buscador.
 *
 * La búsqueda mira nombre, apellido, razón social, documento, correo y teléfono a la vez:
 * quien atiende el mostrador no sabe ni quiere saber por cuál de los seis campos está
 * buscando. `mode: "insensitive"` porque nadie escribe los acentos ni las mayúsculas igual
 * dos veces.
 */
export async function listClients(
  workspaceId: string,
  opts: { search?: string; status?: string } = {},
): Promise<ClientRow[]> {
  const q = opts.search?.trim();
  const rows = await prisma.client.findMany({
    where: {
      workspaceId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" as const } },
              { lastName: { contains: q, mode: "insensitive" as const } },
              { businessName: { contains: q, mode: "insensitive" as const } },
              { docNumber: { contains: q.replace(/[.\-\s]/g, "") } },
              { email: { contains: q, mode: "insensitive" as const } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      clientNumber: true,
      kind: true,
      firstName: true,
      lastName: true,
      businessName: true,
      docNumber: true,
      email: true,
      phone: true,
      status: true,
      member: { select: { memberNumber: true } },
    },
    orderBy: { clientNumber: "desc" },
    take: 200,
  });

  return rows.map((r) => ({
    id: r.id,
    clientNumber: r.clientNumber,
    displayName: clientDisplayName(r),
    docNumber: r.docNumber,
    email: r.email,
    phone: r.phone,
    status: r.status,
    memberNumber: r.member?.memberNumber ?? null,
  }));
}

/** La ficha. Devuelve null si no existe o si es de otro workspace. */
export async function getClient(workspaceId: string, clientId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, workspaceId },
    include: { member: { select: { id: true, memberNumber: true } } },
  });
}

/** El último número usado en este workspace, para calcular el siguiente. */
export async function lastClientNumber(workspaceId: string): Promise<number | null> {
  const row = await prisma.client.findFirst({
    where: { workspaceId },
    orderBy: { clientNumber: "desc" },
    select: { clientNumber: true },
  });
  return row?.clientNumber ?? null;
}
```

- [ ] **Paso 3: Escribir el guardia de la sección**

Crear `app/(shell)/clientes/layout.tsx`:

```tsx
import { requireClientsStaff } from "@/lib/clients/access";

/**
 * El guardia de la sección entera.
 *
 * Vive en el layout para que ninguna pantalla nueva del módulo pueda nacer sin control por
 * olvido. Cada pantalla vuelve a pedir lo suyo: son verificaciones que se suman.
 */
export default async function ClientesLayout({ children }: { children: React.ReactNode }) {
  await requireClientsStaff();
  return <>{children}</>;
}
```

- [ ] **Paso 4: Escribir la acción de guardado**

Crear `app/(shell)/clientes/actions.ts`. La parte que importa es el reintento por número duplicado:

```ts
"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@repo/db";
import { parseClientForm } from "@/lib/clients/client-form";
import { nextClientNumber } from "@/lib/clients/client-number";
import { lastClientNumber } from "@/lib/clients/repository";
import { requireClientsStaff } from "@/lib/clients/access";

const LISTA = "/clientes";

/**
 * Alta y edición de un cliente.
 *
 * El número se calcula leyendo el último y sumando uno, lo que tiene una carrera obvia: dos
 * altas simultáneas leen el mismo último número. No se resuelve con un bloqueo ni con una
 * tabla de secuencias —sería inventar infraestructura para un caso que pasa una vez al año—
 * sino dejando que choque contra el índice único y reintentando. Tres intentos alcanzan de
 * sobra para un mostrador.
 */
export async function saveClientAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireClientsStaff();

  const clientId = String(formData.get("clientId") ?? "").trim() || null;
  const destinoError = clientId ? `${LISTA}/${clientId}` : `${LISTA}/nuevo`;

  const parsed = parseClientForm(formData);
  if (!parsed.ok) redirect(`${destinoError}?error=${encodeURIComponent(parsed.error)}`);
  const v = parsed.values;

  if (clientId) {
    // El `where` de un update tiene que ser único, así que el workspace no puede viajar ahí.
    const propio = await prisma.client.count({ where: { id: clientId, workspaceId: workspace.id } });
    if (propio === 0) redirect(`${LISTA}?error=${encodeURIComponent("Ese cliente no existe.")}`);
    await prisma.client.update({ where: { id: clientId }, data: v });
    revalidatePath(LISTA);
    redirect(`${LISTA}/${clientId}?ok=1`);
  }

  let creadoId: string | null = null;
  for (let intento = 0; intento < 3 && creadoId === null; intento++) {
    const clientNumber = nextClientNumber(await lastClientNumber(workspace.id));
    try {
      const creado = await prisma.client.create({
        data: { ...v, workspaceId: workspace.id, clientNumber, createdByUserId: user.id },
        select: { id: true },
      });
      creadoId = creado.id;
    } catch (e) {
      // P2002 = choque con un índice único. Sólo puede ser el número: lo demás no es único.
      const choque = e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
      if (!choque) throw e;
    }
  }

  if (creadoId === null) {
    redirect(`${destinoError}?error=${encodeURIComponent("No se pudo asignar un número. Probá de nuevo.")}`);
  }

  revalidatePath(LISTA);
  redirect(`${LISTA}/${creadoId}?ok=1`);
}
```

- [ ] **Paso 5: Escribir el formulario y las tres pantallas**

`components/clients/client-form.tsx` es un formulario con `action={saveClientAction}` y estos campos: `clientId` (oculto), `kind` (selector Persona/Empresa), `firstName`, `lastName`, `businessName`, `docType` (selector con `DOC_TYPES`), `docNumber`, `ivaCondition` (selector con `IVA_CONDITION_LABELS`, por omisión `CONSUMIDOR_FINAL`), `email`, `phone`, `address`, `city`, `notes`, `status`.

Copiar la estructura visual de `app/(shell)/reservas/espacios/space-form.tsx`: mismas clases de Tailwind, mismo `PageHeader`, mismo tratamiento del `?error=` de la query.

- `app/(shell)/clientes/page.tsx` — listado con `listClients`, buscador que escribe `?q=` y botón "Nuevo cliente". Mostrar número, nombre, documento, contacto, y una etiqueta "Socio 124" cuando `memberNumber` no es nulo.
- `app/(shell)/clientes/nuevo/page.tsx` — el formulario vacío.
- `app/(shell)/clientes/[clientId]/page.tsx` — el formulario cargado con `getClient`, más un bloque "Consumo" que por ahora dice "Todavía no hay movimientos" y que la Tarea 11 va a llenar.

- [ ] **Paso 6: Verificar en el navegador**

```bash
pnpm dev
```

Navegar a `http://localhost:3010/clientes`. Como la migración todavía no se aplicó (Tarea 13), esperá un error de Prisma sobre la tabla `Client`. **Eso es lo correcto en este punto.** Lo que hay que verificar acá es que compila y que el menú lateral muestra "Clientes" con sus dos entradas.

```bash
pnpm lint && pnpm --filter fotoffice exec tsc --noEmit
```

Esperado: sin errores.

- [ ] **Paso 7: Commit**

```bash
git add lib/clients/ "app/(shell)/clientes/" components/clients/
git commit -m "Construir el padrón de clientes

Guardias en dos niveles calcados de lib/bookings/access.ts, repositorio con un
buscador que mira los seis campos a la vez —quien atiende el mostrador no sabe
por cuál está buscando— y las tres pantallas.

El número correlativo se asigna leyendo el último y sumando uno, con la carrera
resuelta por el índice único y tres reintentos. Un bloqueo o una tabla de
secuencias sería inventar infraestructura para algo que pasa una vez al año."
```

---

## Tarea 5: Clientes — la puerta única

**Files:**
- Create: `lib/clients/find-or-create.ts`, `lib/clients/match.ts`, `lib/clients/match.test.ts`
- Modify: `app/(shell)/clientes/actions.ts` (acción de enlazar con un socio)

**Interfaces:**
- Consumes: `parseClientForm` y `nextClientNumber` (Tarea 3), `lastClientNumber` (Tarea 4).
- Produces:
  - `matchExistingClient(candidates: ClientCandidate[], input: ClientLookup): ClientCandidate | null` donde `ClientLookup = { docNumber?: string | null; email?: string | null; phone?: string | null }` y `ClientCandidate = { id: string; docNumber: string | null; email: string | null; phone: string | null }`
  - `findOrCreateClient(tx, input: { workspaceId: string; docNumber?: string | null; email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null; createdByUserId?: number | null }): Promise<{ id: string; created: boolean }>`

**Por qué existe:** sin una sola puerta, en seis meses hay tres fichas del mismo señor escritas de tres maneras. Reservas, Ventas y Órdenes de trabajo van a entrar por acá.

- [ ] **Paso 1: Escribir las pruebas del emparejamiento**

Crear `lib/clients/match.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { matchExistingClient } from "./match";

const juan = { id: "c1", docNumber: "12345678", email: "juan@casa.com", phone: "3411234567" };
const ana = { id: "c2", docNumber: null, email: "ana@casa.com", phone: null };

describe("matchExistingClient", () => {
  it("el documento manda por encima de todo", () => {
    const r = matchExistingClient([juan, ana], { docNumber: "12345678", email: "otro@casa.com" });
    expect(r?.id).toBe("c1");
  });

  it("sin documento, empareja por correo", () => {
    expect(matchExistingClient([juan, ana], { email: "ana@casa.com" })?.id).toBe("c2");
  });

  it("el correo empareja sin importar mayúsculas ni espacios", () => {
    expect(matchExistingClient([juan, ana], { email: "  ANA@casa.com " })?.id).toBe("c2");
  });

  it("sin documento ni correo, empareja por teléfono", () => {
    expect(matchExistingClient([juan, ana], { phone: "3411234567" })?.id).toBe("c1");
  });

  it("el teléfono empareja ignorando guiones, espacios y paréntesis", () => {
    expect(matchExistingClient([juan, ana], { phone: "(341) 123-4567" })?.id).toBe("c1");
  });

  it("sin ningún dato de contacto no empareja con nadie", () => {
    expect(matchExistingClient([juan, ana], {})).toBeNull();
  });

  it("un dato que no coincide con nadie devuelve null en vez del primero de la lista", () => {
    expect(matchExistingClient([juan, ana], { email: "pedro@casa.com" })).toBeNull();
  });

  it("nunca empareja por un campo nulo del candidato", () => {
    // Ana no tiene documento: pedir por documento nulo no puede devolverla.
    expect(matchExistingClient([ana], { docNumber: null, email: null, phone: null })).toBeNull();
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla**

```bash
pnpm test lib/clients/match.test.ts
```

Esperado: FALLA con `Failed to resolve import "./match"`.

- [ ] **Paso 3: Escribir `match.ts`**

```ts
/**
 * A quién de los que ya están se parece este contacto. Módulo PURO.
 *
 * El orden no es casual: documento, después correo, después teléfono. El documento
 * identifica a una persona; el correo y el teléfono identifican a un contacto, y un
 * matrimonio comparte teléfono más seguido de lo que comparte DNI.
 *
 * Nunca empareja por un campo nulo: dos clientes sin documento no son la misma persona.
 */

export type ClientCandidate = {
  id: string;
  docNumber: string | null;
  email: string | null;
  phone: string | null;
};

export type ClientLookup = {
  docNumber?: string | null;
  email?: string | null;
  phone?: string | null;
};

const soloDigitos = (v: string) => v.replace(/\D/g, "");
const normalizarCorreo = (v: string) => v.trim().toLowerCase();

export function matchExistingClient<T extends ClientCandidate>(
  candidates: readonly T[],
  input: ClientLookup,
): T | null {
  const doc = input.docNumber ? soloDigitos(input.docNumber) : null;
  if (doc) {
    const porDoc = candidates.find((c) => c.docNumber && soloDigitos(c.docNumber) === doc);
    if (porDoc) return porDoc;
  }

  const mail = input.email ? normalizarCorreo(input.email) : null;
  if (mail) {
    const porMail = candidates.find((c) => c.email && normalizarCorreo(c.email) === mail);
    if (porMail) return porMail;
  }

  const tel = input.phone ? soloDigitos(input.phone) : null;
  if (tel) {
    const porTel = candidates.find((c) => c.phone && soloDigitos(c.phone) === tel);
    if (porTel) return porTel;
  }

  return null;
}
```

- [ ] **Paso 4: Correr y verificar que pasa**

```bash
pnpm test lib/clients/match.test.ts
```

Esperado: PASA, 8 pruebas.

- [ ] **Paso 5: Escribir `find-or-create.ts`**

```ts
import "server-only";
import type { Prisma } from "@repo/db";
import { matchExistingClient } from "./match";
import { nextClientNumber } from "./client-number";

/**
 * La única puerta por la que los otros módulos consiguen un cliente.
 *
 * Recibe una transacción y no el cliente global: quien llama está creando una reserva o una
 * venta, y el cliente tiene que nacer o no nacer junto con eso. Un cliente creado y una
 * venta que falló deja basura en el padrón.
 *
 * Busca entre los candidatos que comparten algún dato de contacto y no entre todos los
 * clientes del workspace: con un padrón de miles, traerlos a todos para compararlos en
 * memoria sería absurdo.
 */
export async function findOrCreateClient(
  tx: Prisma.TransactionClient,
  input: {
    workspaceId: string;
    docNumber?: string | null;
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    businessName?: string | null;
    createdByUserId?: number | null;
  },
): Promise<{ id: string; created: boolean }> {
  const doc = input.docNumber?.replace(/[.\-\s]/g, "") || null;
  const mail = input.email?.trim().toLowerCase() || null;
  const tel = input.phone?.trim() || null;

  if (doc || mail || tel) {
    const candidatos = await tx.client.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          ...(doc ? [{ docNumber: doc }] : []),
          ...(mail ? [{ email: mail }] : []),
          ...(tel ? [{ phone: tel }] : []),
        ],
      },
      select: { id: true, docNumber: true, email: true, phone: true },
      take: 50,
    });
    const encontrado = matchExistingClient(candidatos, { docNumber: doc, email: mail, phone: tel });
    if (encontrado) return { id: encontrado.id, created: false };
  }

  const ultimo = await tx.client.findFirst({
    where: { workspaceId: input.workspaceId },
    orderBy: { clientNumber: "desc" },
    select: { clientNumber: true },
  });

  const creado = await tx.client.create({
    data: {
      workspaceId: input.workspaceId,
      clientNumber: nextClientNumber(ultimo?.clientNumber ?? null),
      kind: input.businessName ? "EMPRESA" : "PERSONA",
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      businessName: input.businessName ?? null,
      docNumber: doc,
      docType: doc ? (doc.length === 11 ? "CUIT" : "DNI") : null,
      email: mail,
      phone: tel,
      createdByUserId: input.createdByUserId ?? null,
    },
    select: { id: true },
  });

  return { id: creado.id, created: true };
}
```

- [ ] **Paso 6: Agregar la acción de enlazar con un socio**

En `app/(shell)/clientes/actions.ts`, agregar:

```ts
/**
 * Declarar que este cliente es además un socio de la institución.
 *
 * No lo decide el sistema: la pantalla lo *ofrece* cuando el contacto coincide con un socio,
 * y una persona confirma. Emparejar automáticamente a dos homónimos y fusionarles el
 * historial es un error que después no se puede deshacer.
 */
export async function linkClientToMemberAction(formData: FormData): Promise<void> {
  const { workspace } = await requireClientsStaff();
  const clientId = String(formData.get("clientId") ?? "").trim();
  const memberId = String(formData.get("memberId") ?? "").trim() || null;

  const propio = await prisma.client.count({ where: { id: clientId, workspaceId: workspace.id } });
  if (propio === 0) redirect(`${LISTA}?error=${encodeURIComponent("Ese cliente no existe.")}`);

  if (memberId) {
    const socioPropio = await prisma.member.count({
      where: { id: memberId, workspaceId: workspace.id },
    });
    if (socioPropio === 0) {
      redirect(`${LISTA}/${clientId}?error=${encodeURIComponent("Ese socio no existe.")}`);
    }
  }

  try {
    await prisma.client.update({ where: { id: clientId }, data: { memberId } });
  } catch (e) {
    // memberId es único: ese socio ya está enlazado a otra ficha de cliente.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(`${LISTA}/${clientId}?error=${encodeURIComponent("Ese socio ya está enlazado a otro cliente.")}`);
    }
    throw e;
  }

  revalidatePath(`${LISTA}/${clientId}`);
  redirect(`${LISTA}/${clientId}?ok=1`);
}
```

En `app/(shell)/clientes/[clientId]/page.tsx`, agregar un bloque "¿Es socio?" con un selector de socios del workspace y un botón que llame a esta acción.

- [ ] **Paso 7: Correr todo y commitear**

```bash
pnpm test && pnpm lint
```

```bash
git add lib/clients/ "app/(shell)/clientes/"
git commit -m "Abrir la puerta única para conseguir un cliente

Reservas, Ventas y Órdenes de trabajo van a entrar por findOrCreateClient. Sin
una sola puerta, en seis meses hay tres fichas del mismo señor escritas de tres
maneras distintas.

El emparejamiento va documento, correo y teléfono en ese orden: el documento
identifica a una persona, el correo y el teléfono identifican a un contacto, y
un matrimonio comparte teléfono más seguido de lo que comparte DNI. Nunca
empareja por un campo nulo.

El enlace con un socio lo confirma una persona, nunca el sistema: fusionar el
historial de dos homónimos no se puede deshacer."
```

---

## Tarea 6: Caja — cuentas, categorías y semillas

**Files:**
- Create: `lib/cash/account-form.ts`, `lib/cash/account-form.test.ts`
- Create: `lib/cash/category-form.ts`, `lib/cash/category-form.test.ts`
- Create: `lib/cash/seed.ts`, `lib/cash/seed.test.ts`
- Create: `lib/cash/access.ts`

**Interfaces:**
- Consumes: `CASH_ACCOUNT_KINDS`, `MOVEMENT_KINDS`, `SEED_ACCOUNTS`, `SEED_CATEGORIES`, `CASH_MODULE_KEY` (Tarea 2).
- Produces:
  - `parseAccountForm(fd: FormData): { ok: true; values: AccountFormValues } | { ok: false; error: string }` con `AccountFormValues = { name: string; kind: CashAccountKind; isDefault: boolean; isActive: boolean; order: number }`
  - `parseCategoryForm(fd: FormData): { ok: true; values: CategoryFormValues } | { ok: false; error: string }` con `CategoryFormValues = { name: string; kind: MovementKind; isActive: boolean; order: number }`
  - `seedRowsFor(workspaceId: string): { accounts: SeedAccountRow[]; categories: SeedCategoryRow[] }`
  - `requireCashStaff()` y `requireCashAdmin()`

- [ ] **Paso 1: Escribir las pruebas de los dos formularios**

Crear `lib/cash/account-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseAccountForm } from "./account-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("parseAccountForm", () => {
  it("una cuenta con nombre y tipo alcanza", () => {
    const r = parseAccountForm(form({ name: "Efectivo Sucursal Centro", kind: "EFECTIVO" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.name).toBe("Efectivo Sucursal Centro");
    expect(r.values.kind).toBe("EFECTIVO");
  });

  it("por omisión es efectivo: es la caja que la gente tiene en la cabeza", () => {
    const r = parseAccountForm(form({ name: "Caja chica" }));
    expect(r.ok).toBe(true);
    expect(r.ok && r.values.kind).toBe("EFECTIVO");
  });

  it("un nombre de menos de dos letras se rechaza", () => {
    expect(parseAccountForm(form({ name: " x " }))).toEqual({
      ok: false,
      error: "Poné un nombre para la cuenta.",
    });
  });

  it("un tipo inventado se rechaza en vez de guardarse", () => {
    expect(parseAccountForm(form({ name: "Cripto", kind: "BITCOIN" }))).toEqual({
      ok: false,
      error: "Esa cuenta tiene que ser de efectivo o digital.",
    });
  });

  it("las casillas ausentes son false, no undefined", () => {
    const r = parseAccountForm(form({ name: "Banco", kind: "DIGITAL" }));
    expect(r.ok && r.values.isDefault).toBe(false);
    expect(r.ok && r.values.isActive).toBe(true);
  });
});
```

Crear `lib/cash/category-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCategoryForm } from "./category-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

describe("parseCategoryForm", () => {
  it("una categoría de ingreso se acepta", () => {
    const r = parseCategoryForm(form({ name: "Reparaciones", kind: "INGRESO" }));
    expect(r.ok && r.values.kind).toBe("INGRESO");
  });

  it("una categoría de egreso se acepta", () => {
    const r = parseCategoryForm(form({ name: "Proveedores", kind: "EGRESO" }));
    expect(r.ok && r.values.kind).toBe("EGRESO");
  });

  it("sin lado se rechaza: una categoría sirve para un lado solo", () => {
    expect(parseCategoryForm(form({ name: "Varios" }))).toEqual({
      ok: false,
      error: "Elegí si la categoría es de ingreso o de egreso.",
    });
  });

  it("un nombre vacío se rechaza", () => {
    expect(parseCategoryForm(form({ name: "  ", kind: "INGRESO" }))).toEqual({
      ok: false,
      error: "Poné un nombre para la categoría.",
    });
  });
});
```

- [ ] **Paso 2: Correr y verificar que fallan**

```bash
pnpm test lib/cash/
```

Esperado: FALLAN los dos con `Failed to resolve import`.

- [ ] **Paso 3: Escribir los dos módulos**

`lib/cash/account-form.ts`:

```ts
import { CASH_ACCOUNT_KINDS, type CashAccountKind } from "./constants";

/**
 * Validación del formulario de una cuenta de caja. Módulo PURO.
 *
 * Las cuentas las crea el administrador sin tope: un negocio con tres sucursales crea un
 * efectivo por sucursal y arquea cada uno por separado. No hace falta una entidad
 * "sucursal" — la cuenta ya es la unidad que se abre, se cierra y se cuenta.
 */

export type AccountFormValues = {
  name: string;
  kind: CashAccountKind;
  isDefault: boolean;
  isActive: boolean;
  order: number;
};

export type AccountFormResult =
  | { ok: true; values: AccountFormValues }
  | { ok: false; error: string };

export function parseAccountForm(fd: FormData): AccountFormResult {
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2) return { ok: false, error: "Poné un nombre para la cuenta." };

  const kindRaw = String(fd.get("kind") ?? "EFECTIVO").trim();
  if (!CASH_ACCOUNT_KINDS.includes(kindRaw as CashAccountKind)) {
    return { ok: false, error: "Esa cuenta tiene que ser de efectivo o digital." };
  }

  const orderRaw = Number(String(fd.get("order") ?? "0").trim());
  const order = Number.isFinite(orderRaw) ? Math.floor(orderRaw) : 0;

  return {
    ok: true,
    values: {
      name,
      kind: kindRaw as CashAccountKind,
      isDefault: fd.get("isDefault") === "on" || fd.get("isDefault") === "true",
      isActive: fd.get("isActive") !== "off" && fd.get("isActive") !== "false",
      order,
    },
  };
}
```

`lib/cash/category-form.ts`:

```ts
import { MOVEMENT_KINDS, type MovementKind } from "./constants";

/**
 * Validación del formulario de una categoría. Módulo PURO.
 *
 * `kind` es obligatorio y no tiene valor por omisión a propósito: una categoría sirve para
 * un lado solo —"Sueldos" no es un ingreso— y elegir por la gente acá produce categorías
 * mal clasificadas que después ensucian todos los reportes.
 */

export type CategoryFormValues = {
  name: string;
  kind: MovementKind;
  isActive: boolean;
  order: number;
};

export type CategoryFormResult =
  | { ok: true; values: CategoryFormValues }
  | { ok: false; error: string };

export function parseCategoryForm(fd: FormData): CategoryFormResult {
  const name = String(fd.get("name") ?? "").trim();
  if (name === "") return { ok: false, error: "Poné un nombre para la categoría." };

  const kindRaw = String(fd.get("kind") ?? "").trim();
  if (!MOVEMENT_KINDS.includes(kindRaw as MovementKind)) {
    return { ok: false, error: "Elegí si la categoría es de ingreso o de egreso." };
  }

  const orderRaw = Number(String(fd.get("order") ?? "0").trim());

  return {
    ok: true,
    values: {
      name,
      kind: kindRaw as MovementKind,
      isActive: fd.get("isActive") !== "off" && fd.get("isActive") !== "false",
      order: Number.isFinite(orderRaw) ? Math.floor(orderRaw) : 0,
    },
  };
}
```

- [ ] **Paso 4: Correr y verificar que pasan**

```bash
pnpm test lib/cash/
```

Esperado: PASAN, 9 pruebas.

- [ ] **Paso 5: Escribir la prueba de las semillas**

Crear `lib/cash/seed.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { seedRowsFor } from "./seed";

describe("seedRowsFor", () => {
  it("crea caja diaria, caja fuerte y Mercado Pago, y la diaria es la de omisión", () => {
    const { accounts } = seedRowsFor("ws-1");
    expect(accounts.map((a) => a.name)).toEqual(["Caja diaria", "Caja fuerte", "Mercado Pago"]);
    expect(accounts[0].isDefault).toBe(true);
    expect(accounts[0].kind).toBe("EFECTIVO");
    expect(accounts[2].kind).toBe("DIGITAL");
  });

  it("la caja fuerte queda marcada como bóveda y la diaria no", () => {
    const { accounts } = seedRowsFor("ws-1");
    expect(accounts[0].isVault).toBe(false);
    expect(accounts[1].isVault).toBe(true);
  });

  it("todas las filas llevan el workspace recibido", () => {
    const { accounts, categories } = seedRowsFor("ws-9");
    expect(accounts.every((a) => a.workspaceId === "ws-9")).toBe(true);
    expect(categories.every((c) => c.workspaceId === "ws-9")).toBe(true);
  });

  it("hay categorías de los dos lados", () => {
    const { categories } = seedRowsFor("ws-1");
    expect(categories.some((c) => c.kind === "INGRESO")).toBe(true);
    expect(categories.some((c) => c.kind === "EGRESO")).toBe(true);
  });

  it("ninguna categoría se repite dentro del mismo lado", () => {
    const { categories } = seedRowsFor("ws-1");
    const claves = categories.map((c) => `${c.kind}|${c.name}`);
    expect(new Set(claves).size).toBe(claves.length);
  });

  it("dos workspaces distintos no comparten ninguna fila", () => {
    const a = seedRowsFor("ws-a");
    const b = seedRowsFor("ws-b");
    expect(a.accounts[0]).not.toBe(b.accounts[0]);
    expect(a.accounts[0].workspaceId).toBe("ws-a");
    expect(b.accounts[0].workspaceId).toBe("ws-b");
  });
});
```

- [ ] **Paso 6: Correr, verificar que falla, escribir `seed.ts`**

```bash
pnpm test lib/cash/seed.test.ts
```

Esperado: FALLA. Después crear `lib/cash/seed.ts`:

```ts
import { SEED_ACCOUNTS, SEED_CATEGORIES } from "./constants";

/**
 * Las filas que se crean al encender el módulo en un workspace. Módulo PURO.
 *
 * Existe porque una pantalla de categorías vacía no la llena nadie, y sin categorías el
 * libro no sirve para ningún reporte. Son un punto de partida editable: se pueden renombrar,
 * desactivar y agregar las que cada negocio necesite.
 */

export type SeedAccountRow = {
  workspaceId: string;
  name: string;
  kind: "EFECTIVO" | "DIGITAL";
  isVault: boolean;
  isDefault: boolean;
  order: number;
};

export type SeedCategoryRow = {
  workspaceId: string;
  name: string;
  kind: "INGRESO" | "EGRESO";
  order: number;
};

export function seedRowsFor(workspaceId: string): {
  accounts: SeedAccountRow[];
  categories: SeedCategoryRow[];
} {
  return {
    accounts: SEED_ACCOUNTS.map((a) => ({ ...a, workspaceId })),
    categories: SEED_CATEGORIES.map((c) => ({ ...c, workspaceId })),
  };
}
```

- [ ] **Paso 7: Escribir el control de acceso**

Crear `lib/cash/access.ts`, calcado de `lib/clients/access.ts` (Tarea 4) cambiando la clave por `CASH_MODULE_KEY` y las rutas por `/caja`. Los dos niveles:

- `requireCashStaff()` — ver el libro, cargar movimientos, abrir y cerrar turno. Cualquiera del equipo con rol.
- `requireCashAdmin()` — cuentas y categorías. `canManageWorkspaceSettings(role)`, redirige a `/caja` si no.

> Quién puede abrir y cerrar caja era la única pregunta abierta del diseño (§15.2). **Se resuelve acá:** cualquiera con rol en el workspace. Un negocio con empleados de mostrador no puede exigir que el dueño abra la caja todas las mañanas, y el arqueo ya deja registrado *quién* abrió y *quién* cerró, que es lo que de verdad importa para responder por una diferencia.

- [ ] **Paso 8: Correr todo y commitear**

```bash
pnpm test lib/cash/ && pnpm lint
```

```bash
git add lib/cash/
git commit -m "Escribir cuentas, categorías y semillas de Caja

Las cuentas las crea el administrador sin tope: tres sucursales son tres cuentas
de efectivo, cada una con su turno. No hace falta una entidad sucursal, porque
la cuenta ya es la unidad que se abre, se cierra y se cuenta.

La categoría exige lado y no tiene valor por omisión a propósito: 'Sueldos' no
es un ingreso, y elegir por la gente produce categorías mal clasificadas que
después ensucian todos los reportes.

Abrir y cerrar caja queda en STAFF+, que era la única pregunta abierta del
diseño. Un negocio con mostrador no puede exigir que el dueño abra la caja todas
las mañanas, y el arqueo ya registra quién abrió y quién cerró."
```

---

## Tarea 7: Caja — turnos y arqueo

**Files:**
- Create: `lib/cash/shift.ts`, `lib/cash/shift.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `expectedAmountMinor(input: { openingMinor: number; movements: ShiftMovement[] }): number` con `ShiftMovement = { kind: "INGRESO" | "EGRESO"; amountMinor: number }`
  - `shiftDifferenceMinor(expectedMinor: number, countedMinor: number): number`
  - `canCloseShift(input: { status: string; differenceMinor: number; note: string | null }): { ok: true } | { ok: false; error: string }`
  - `canOpenShift(input: { accountKind: string; isVault: boolean; openShiftExists: boolean }): { ok: true } | { ok: false; error: string }`

**Por qué puro:** el arqueo es la parte del módulo donde un error se ve en plata, y probarlo exige poder inventar veinte combinaciones de movimientos en un milisegundo.

- [ ] **Paso 1: Escribir las pruebas**

Crear `lib/cash/shift.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  canCloseShift,
  canOpenShift,
  expectedAmountMinor,
  shiftDifferenceMinor,
} from "./shift";

describe("expectedAmountMinor", () => {
  it("sin movimientos, lo esperado es lo que se declaró al abrir", () => {
    expect(expectedAmountMinor({ openingMinor: 500_00, movements: [] })).toBe(500_00);
  });

  it("los ingresos suman y los egresos restan", () => {
    const r = expectedAmountMinor({
      openingMinor: 1_000_00,
      movements: [
        { kind: "INGRESO", amountMinor: 250_00 },
        { kind: "EGRESO", amountMinor: 100_00 },
        { kind: "INGRESO", amountMinor: 50_50 },
      ],
    });
    expect(r).toBe(1_200_50);
  });

  it("puede dar negativo y no se recorta a cero: un faltante hay que verlo", () => {
    const r = expectedAmountMinor({
      openingMinor: 0,
      movements: [{ kind: "EGRESO", amountMinor: 300_00 }],
    });
    expect(r).toBe(-300_00);
  });

  it("los centavos no se pierden sumando muchos movimientos chicos", () => {
    const movimientos = Array.from({ length: 300 }, () => ({
      kind: "INGRESO" as const,
      amountMinor: 10_33,
    }));
    expect(expectedAmountMinor({ openingMinor: 0, movements: movimientos })).toBe(309_900);
  });
});

describe("shiftDifferenceMinor", () => {
  it("contar de más da diferencia positiva", () => {
    expect(shiftDifferenceMinor(1_000_00, 1_050_00)).toBe(50_00);
  });

  it("contar de menos da diferencia negativa", () => {
    expect(shiftDifferenceMinor(1_000_00, 990_00)).toBe(-10_00);
  });

  it("contar exacto da cero", () => {
    expect(shiftDifferenceMinor(1_000_00, 1_000_00)).toBe(0);
  });
});

describe("canCloseShift", () => {
  it("un turno cuadrado se cierra sin explicación", () => {
    expect(canCloseShift({ status: "ABIERTO", differenceMinor: 0, note: null })).toEqual({ ok: true });
  });

  it("una diferencia sin explicar no se puede cerrar", () => {
    expect(canCloseShift({ status: "ABIERTO", differenceMinor: -50_00, note: null })).toEqual({
      ok: false,
      error: "La caja no cuadra. Explicá la diferencia antes de cerrar.",
    });
  });

  it("una diferencia con explicación se cierra", () => {
    expect(
      canCloseShift({ status: "ABIERTO", differenceMinor: -50_00, note: "Vuelto mal dado" }),
    ).toEqual({ ok: true });
  });

  it("una explicación en blanco no cuenta como explicación", () => {
    expect(canCloseShift({ status: "ABIERTO", differenceMinor: 20_00, note: "   " })).toEqual({
      ok: false,
      error: "La caja no cuadra. Explicá la diferencia antes de cerrar.",
    });
  });

  it("un turno ya cerrado no se vuelve a cerrar", () => {
    expect(canCloseShift({ status: "CERRADO", differenceMinor: 0, note: null })).toEqual({
      ok: false,
      error: "Ese turno ya está cerrado.",
    });
  });
});

describe("canOpenShift", () => {
  it("una cuenta de efectivo sin turno abierto se puede abrir", () => {
    expect(canOpenShift({ accountKind: "EFECTIVO", isVault: false, openShiftExists: false })).toEqual({
      ok: true,
    });
  });

  it("no se abre un segundo turno en la misma cuenta", () => {
    expect(canOpenShift({ accountKind: "EFECTIVO", isVault: false, openShiftExists: true })).toEqual({
      ok: false,
      error: "Esa caja ya tiene un turno abierto.",
    });
  });

  it("una cuenta digital no se arquea", () => {
    expect(canOpenShift({ accountKind: "DIGITAL", isVault: false, openShiftExists: false })).toEqual({
      ok: false,
      error: "Mercado Pago y el banco se concilian, no se cuentan: no llevan turno.",
    });
  });

  it("la caja fuerte no lleva turno diario", () => {
    expect(canOpenShift({ accountKind: "EFECTIVO", isVault: true, openShiftExists: false })).toEqual({
      ok: false,
      error: "La caja fuerte no se abre por jornada. Se cuenta con un arqueo cuando quieras.",
    });
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla**

```bash
pnpm test lib/cash/shift.test.ts
```

Esperado: FALLA con `Failed to resolve import "./shift"`.

- [ ] **Paso 3: Escribir `shift.ts`**

```ts
/**
 * Las reglas del turno de caja. Módulo PURO: todo en centavos enteros.
 *
 * Nada acá redondea ni recorta. Un esperado negativo se devuelve negativo, porque un
 * faltante que la pantalla muestra como cero es un faltante que nadie va a investigar.
 */

export type ShiftMovement = { kind: "INGRESO" | "EGRESO"; amountMinor: number };

/** Apertura + ingresos − egresos. */
export function expectedAmountMinor(input: {
  openingMinor: number;
  movements: readonly ShiftMovement[];
}): number {
  return input.movements.reduce(
    (acc, m) => acc + (m.kind === "INGRESO" ? m.amountMinor : -m.amountMinor),
    input.openingMinor,
  );
}

/** Contado − esperado. Positivo sobra, negativo falta. */
export function shiftDifferenceMinor(expectedMinor: number, countedMinor: number): number {
  return countedMinor - expectedMinor;
}

export type ShiftCheck = { ok: true } | { ok: false; error: string };

/**
 * Una diferencia sin explicar no se puede cerrar.
 *
 * Es la regla que le da sentido al arqueo: si cerrar con faltante fuera gratis, el conteo
 * sería un trámite. La explicación no impide el faltante — lo deja escrito.
 */
export function canCloseShift(input: {
  status: string;
  differenceMinor: number;
  note: string | null;
}): ShiftCheck {
  if (input.status !== "ABIERTO") return { ok: false, error: "Ese turno ya está cerrado." };
  if (input.differenceMinor !== 0 && (input.note ?? "").trim() === "") {
    return { ok: false, error: "La caja no cuadra. Explicá la diferencia antes de cerrar." };
  }
  return { ok: true };
}

/**
 * Sólo el efectivo del mostrador lleva turno.
 *
 * La caja fuerte queda afuera aunque sea efectivo: no se abre y se cierra por jornada, se
 * cuenta cada tanto. Un turno diario de caja fuerte sería un trámite que nadie hace y que
 * después ensucia el historial de arqueos con treinta filas vacías por mes.
 *
 * El índice único parcial de la base garantiza que no haya dos turnos abiertos por cuenta;
 * esta función existe para dar un mensaje entendible antes de que la base tire un error que
 * nadie puede leer.
 */
export function canOpenShift(input: {
  accountKind: string;
  isVault: boolean;
  openShiftExists: boolean;
}): ShiftCheck {
  if (input.accountKind !== "EFECTIVO") {
    return {
      ok: false,
      error: "Mercado Pago y el banco se concilian, no se cuentan: no llevan turno.",
    };
  }
  if (input.isVault) {
    return {
      ok: false,
      error: "La caja fuerte no se abre por jornada. Se cuenta con un arqueo cuando quieras.",
    };
  }
  if (input.openShiftExists) return { ok: false, error: "Esa caja ya tiene un turno abierto." };
  return { ok: true };
}
```

- [ ] **Paso 4: Correr y verificar que pasan**

```bash
pnpm test lib/cash/shift.test.ts
```

Esperado: PASAN, 15 pruebas.

- [ ] **Paso 5: Commit**

```bash
git add lib/cash/shift.ts lib/cash/shift.test.ts
git commit -m "Escribir las reglas del arqueo por turno

Todo en centavos enteros y sin redondear nada. Un esperado negativo se devuelve
negativo: un faltante que la pantalla muestra como cero es un faltante que nadie
va a investigar.

La regla que le da sentido al arqueo es que una diferencia sin explicar no se
puede cerrar. Si cerrar con faltante fuera gratis, el conteo sería un trámite."
```

---

## Tarea 8: Caja — movimientos, depósito idempotente y anulación

**Files:**
- Modify: `lib/membership/money.ts`, `lib/bookings/space-form.ts`, `app/actions/manual-payment.ts` (unificar `parseArsToMinor`, Paso 0)
- Create: `lib/cash/movement-form.ts`, `lib/cash/movement-form.test.ts`
- Create: `lib/cash/reverse.ts`, `lib/cash/reverse.test.ts`
- Create: `lib/cash/record-movement.ts`
- Create: `lib/cash/repository.ts`

**Interfaces:**
- Consumes: `MOVEMENT_KINDS`, `PAYMENT_METHODS`, `MOVEMENT_SOURCES` (Tarea 2); `parseArsToMinor` de `lib/membership/money.ts` (se mueve ahí en el Paso 0); `minorToDecimalString` de `lib/membership/money.ts`; `prisma.cashMovement` (Tarea 1).
- Produces:
  - `parseMovementForm(fd: FormData): { ok: true; values: MovementFormValues } | { ok: false; error: string }` con `MovementFormValues = { kind: MovementKind; amountMinor: number; occurredAt: Date; accountId: string; categoryId: string | null; paymentMethod: PaymentMethod; clientId: string | null; description: string; receiptRef: string | null }`
  - `buildReversal(original: ReversibleMovement, reason: string): { ok: true; values: ReversalValues } | { ok: false; error: string }`
  - `recordCashMovement(tx, input: RecordMovementInput): Promise<{ id: string; created: boolean }>` — **la costura** que usan Cuotas, Reservas, Ventas y Órdenes de trabajo
  - `openShiftFor(workspaceId: string, accountId: string)` y `listMovements(...)` en `repository.ts`

**La regla de oro de esta tarea:** un movimiento con `sourceModule !== "manual"` **no se edita jamás**. Se anula con un contramovimiento.

- [ ] **Paso 0: Unificar `parseArsToMinor` antes de usarlo desde acá**

Hoy esa función está **duplicada**: una copia exportada en `lib/bookings/space-form.ts:36` y otra privada en `app/actions/manual-payment.ts:17`. Caja sería el tercer lugar, y un módulo de caja que importa su parseo de importes desde el módulo de reservas es una dependencia que no tiene sentido.

`lib/membership/money.ts` ya es de hecho el módulo de dinero compartido —`app/(shell)/reservas/actions.ts:6` ya importa `minorToDecimalString` de ahí—, así que ésa es su casa.

1. Mover el cuerpo de `parseArsToMinor` a `lib/membership/money.ts`, con su comentario.
2. En `lib/bookings/space-form.ts`, reemplazar la definición por `export { parseArsToMinor } from "@/lib/membership/money";`, para no romper `lib/bookings/extra-form.ts:1`.
3. En `app/actions/manual-payment.ts`, borrar la copia privada e importar la compartida.
4. Correr `pnpm test lib/bookings/`: las pruebas que ya existen de `parseArsToMinor` en `space-form.test.ts` tienen que seguir pasando **sin tocarlas**. Ésa es la prueba de que el movimiento fue neutral.

- [ ] **Paso 1: Escribir las pruebas del formulario**

Crear `lib/cash/movement-form.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseMovementForm } from "./movement-form";

function form(campos: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) fd.set(k, v);
  return fd;
}

const base = {
  kind: "INGRESO",
  amountArs: "1.500,50",
  occurredAt: "2026-09-13T10:30",
  accountId: "acc-1",
  description: "Venta de trípode",
};

describe("parseMovementForm", () => {
  it("un ingreso completo se acepta y el importe queda en centavos", () => {
    const r = parseMovementForm(form(base));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.amountMinor).toBe(150_050);
    expect(r.values.kind).toBe("INGRESO");
    expect(r.values.description).toBe("Venta de trípode");
  });

  it("acepta el importe escrito como lo escribe la gente", () => {
    expect(parseMovementForm(form({ ...base, amountArs: "$ 2.000" })).ok).toBe(true);
    expect(parseMovementForm(form({ ...base, amountArs: "2000" })).ok).toBe(true);
  });

  it("un importe de cero se rechaza: un asiento de cero no informa nada", () => {
    expect(parseMovementForm(form({ ...base, amountArs: "0" }))).toEqual({
      ok: false,
      error: "El importe tiene que ser mayor que cero.",
    });
  });

  it("un importe negativo se rechaza: el signo lo da el tipo, no el número", () => {
    expect(parseMovementForm(form({ ...base, amountArs: "-500" }))).toEqual({
      ok: false,
      error: "El importe no se entiende.",
    });
  });

  it("sin descripción se rechaza: un movimiento sin concepto no sirve a los tres meses", () => {
    expect(parseMovementForm(form({ ...base, description: "  " }))).toEqual({
      ok: false,
      error: "Escribí de qué se trata el movimiento.",
    });
  });

  it("sin cuenta se rechaza", () => {
    expect(parseMovementForm(form({ ...base, accountId: "" }))).toEqual({
      ok: false,
      error: "Elegí en qué cuenta entra o sale la plata.",
    });
  });

  it("un tipo que no es ingreso ni egreso se rechaza", () => {
    expect(parseMovementForm(form({ ...base, kind: "AJUSTE" }))).toEqual({
      ok: false,
      error: "El movimiento tiene que ser un ingreso o un egreso.",
    });
  });

  it("una fecha que no se entiende se rechaza", () => {
    expect(parseMovementForm(form({ ...base, occurredAt: "ayer" }))).toEqual({
      ok: false,
      error: "Esa fecha no se entiende.",
    });
  });

  it("sin fecha usa el momento actual en vez de rechazar", () => {
    const antes = Date.now();
    const r = parseMovementForm(form({ ...base, occurredAt: "" }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.occurredAt.getTime()).toBeGreaterThanOrEqual(antes);
  });

  it("el cliente y la categoría son opcionales", () => {
    const r = parseMovementForm(form(base));
    expect(r.ok && r.values.clientId).toBeNull();
    expect(r.ok && r.values.categoryId).toBeNull();
  });

  it("un medio de pago inventado se rechaza", () => {
    expect(parseMovementForm(form({ ...base, paymentMethod: "TRUEQUE" }))).toEqual({
      ok: false,
      error: "Ese medio de pago no existe.",
    });
  });
});
```

- [ ] **Paso 2: Correr, verificar que falla, escribir `movement-form.ts`**

```bash
pnpm test lib/cash/movement-form.test.ts
```

Esperado: FALLA. Después crear el módulo:

```ts
import { parseArsToMinor } from "@/lib/membership/money";
import {
  MOVEMENT_KINDS,
  PAYMENT_METHODS,
  type MovementKind,
  type PaymentMethod,
} from "./constants";

/**
 * Validación del formulario de un movimiento. Módulo PURO.
 *
 * El importe siempre es positivo: el signo lo da `kind`. Guardar un egreso como un número
 * negativo *y además* marcarlo como egreso abre la puerta a que los dos se contradigan, y
 * entonces nadie sabe cuál de los dos manda.
 *
 * `parseArsToMinor` se reusa de Reservas en vez de reescribirlo: acepta "3.000,50", "$ 2.000"
 * y "2000", que es como la gente escribe de verdad.
 */

export type MovementFormValues = {
  kind: MovementKind;
  amountMinor: number;
  occurredAt: Date;
  accountId: string;
  categoryId: string | null;
  paymentMethod: PaymentMethod;
  clientId: string | null;
  description: string;
  receiptRef: string | null;
};

export type MovementFormResult =
  | { ok: true; values: MovementFormValues }
  | { ok: false; error: string };

function texto(fd: FormData, campo: string): string | null {
  const v = String(fd.get(campo) ?? "").trim();
  return v === "" ? null : v;
}

export function parseMovementForm(fd: FormData): MovementFormResult {
  const kindRaw = String(fd.get("kind") ?? "").trim();
  if (!MOVEMENT_KINDS.includes(kindRaw as MovementKind)) {
    return { ok: false, error: "El movimiento tiene que ser un ingreso o un egreso." };
  }

  const amountMinor = parseArsToMinor(String(fd.get("amountArs") ?? ""));
  if (amountMinor === null) return { ok: false, error: "El importe no se entiende." };
  if (amountMinor === 0) return { ok: false, error: "El importe tiene que ser mayor que cero." };

  const accountId = texto(fd, "accountId");
  if (accountId === null) {
    return { ok: false, error: "Elegí en qué cuenta entra o sale la plata." };
  }

  const description = texto(fd, "description");
  if (description === null) {
    return { ok: false, error: "Escribí de qué se trata el movimiento." };
  }

  // Sin fecha es "ahora": cargar un movimiento del momento es el caso del noventa por ciento,
  // y obligar a escribir la fecha para eso sería fricción pura.
  const fechaRaw = texto(fd, "occurredAt");
  let occurredAt = new Date();
  if (fechaRaw !== null) {
    const d = new Date(fechaRaw);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Esa fecha no se entiende." };
    occurredAt = d;
  }

  const metodoRaw = String(fd.get("paymentMethod") ?? "EFECTIVO").trim();
  if (!PAYMENT_METHODS.includes(metodoRaw as PaymentMethod)) {
    return { ok: false, error: "Ese medio de pago no existe." };
  }

  return {
    ok: true,
    values: {
      kind: kindRaw as MovementKind,
      amountMinor,
      occurredAt,
      accountId,
      categoryId: texto(fd, "categoryId"),
      paymentMethod: metodoRaw as PaymentMethod,
      clientId: texto(fd, "clientId"),
      description,
      receiptRef: texto(fd, "receiptRef"),
    },
  };
}
```

- [ ] **Paso 3: Escribir las pruebas de la anulación**

Crear `lib/cash/reverse.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildReversal } from "./reverse";

const ingreso = {
  id: "mov-1",
  kind: "INGRESO" as const,
  amountMinor: 1_000_00,
  accountId: "acc-1",
  categoryId: "cat-1",
  paymentMethod: "EFECTIVO",
  clientId: "cli-1",
  description: "Venta de trípode",
  alreadyReversed: false,
};

describe("buildReversal", () => {
  it("el contramovimiento de un ingreso es un egreso por el mismo importe", () => {
    const r = buildReversal(ingreso, "Se devolvió el producto");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.kind).toBe("EGRESO");
    expect(r.values.amountMinor).toBe(1_000_00);
  });

  it("el contramovimiento de un egreso es un ingreso", () => {
    const r = buildReversal({ ...ingreso, kind: "EGRESO" }, "Cargado dos veces");
    expect(r.ok && r.values.kind).toBe("INGRESO");
  });

  it("conserva cuenta, categoría, cliente y medio de pago del original", () => {
    const r = buildReversal(ingreso, "Error de carga");
    if (!r.ok) throw new Error("debería anular");
    expect(r.values.accountId).toBe("acc-1");
    expect(r.values.categoryId).toBe("cat-1");
    expect(r.values.clientId).toBe("cli-1");
    expect(r.values.paymentMethod).toBe("EFECTIVO");
  });

  it("la descripción dice que es una anulación y arrastra la original", () => {
    const r = buildReversal(ingreso, "Error de carga");
    expect(r.ok && r.values.description).toBe("Anulación de: Venta de trípode");
  });

  it("apunta al movimiento original", () => {
    const r = buildReversal(ingreso, "Error de carga");
    expect(r.ok && r.values.reversesMovementId).toBe("mov-1");
  });

  it("el contramovimiento se carga a mano aunque el original viniera de otro módulo", () => {
    const r = buildReversal(ingreso, "Error de carga");
    expect(r.ok && r.values.sourceModule).toBe("manual");
    expect(r.ok && r.values.sourceRef).toBeNull();
  });

  it("sin motivo no se anula: una anulación sin explicación no se entiende meses después", () => {
    expect(buildReversal(ingreso, "   ")).toEqual({
      ok: false,
      error: "Escribí por qué se anula el movimiento.",
    });
  });

  it("un movimiento ya anulado no se anula dos veces", () => {
    expect(buildReversal({ ...ingreso, alreadyReversed: true }, "Otra vez")).toEqual({
      ok: false,
      error: "Ese movimiento ya está anulado.",
    });
  });
});
```

- [ ] **Paso 4: Correr, verificar que falla, escribir `reverse.ts`**

```bash
pnpm test lib/cash/reverse.test.ts
```

Esperado: FALLA. Después:

```ts
/**
 * La anulación de un movimiento. Módulo PURO.
 *
 * No se borra ni se edita: se escribe un asiento igual y de signo contrario que apunta al
 * original. Los dos quedan a la vista. Un libro que se puede reescribir no prueba nada, y
 * eso vale el doble para los movimientos que vinieron de otro módulo: el dato de verdad vive
 * allá, y editarlo acá haría que los dos se contradijeran sin que nadie se entere.
 *
 * El contramovimiento siempre nace como `manual`: lo decidió una persona, ahora, y no el
 * módulo que originó el asiento. Además, copiar `sourceRef` rompería el índice único que
 * hace idempotente al depósito automático.
 */

export type ReversibleMovement = {
  id: string;
  kind: "INGRESO" | "EGRESO";
  amountMinor: number;
  accountId: string;
  categoryId: string | null;
  paymentMethod: string;
  clientId: string | null;
  description: string;
  alreadyReversed: boolean;
};

export type ReversalValues = {
  kind: "INGRESO" | "EGRESO";
  amountMinor: number;
  accountId: string;
  categoryId: string | null;
  paymentMethod: string;
  clientId: string | null;
  description: string;
  reversesMovementId: string;
  reverseReason: string;
  sourceModule: "manual";
  sourceRef: null;
};

export type ReversalResult =
  | { ok: true; values: ReversalValues }
  | { ok: false; error: string };

export function buildReversal(original: ReversibleMovement, reason: string): ReversalResult {
  if (original.alreadyReversed) return { ok: false, error: "Ese movimiento ya está anulado." };

  const motivo = reason.trim();
  if (motivo === "") return { ok: false, error: "Escribí por qué se anula el movimiento." };

  return {
    ok: true,
    values: {
      kind: original.kind === "INGRESO" ? "EGRESO" : "INGRESO",
      amountMinor: original.amountMinor,
      accountId: original.accountId,
      categoryId: original.categoryId,
      paymentMethod: original.paymentMethod,
      clientId: original.clientId,
      description: `Anulación de: ${original.description}`,
      reversesMovementId: original.id,
      reverseReason: motivo,
      sourceModule: "manual",
      sourceRef: null,
    },
  };
}
```

- [ ] **Paso 5: Escribir la costura `record-movement.ts`**

Esta es la función que van a llamar Cuotas, Reservas, Ventas y Órdenes de trabajo. Crear `lib/cash/record-movement.ts`:

```ts
import "server-only";
import { Prisma, type PrismaClient } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";
import type { MovementSource } from "./constants";

/**
 * Depositar en Caja un cobro que originó otro módulo.
 *
 * Es idempotente por construcción: `(sourceModule, sourceRef)` es único en la base, así que
 * un webhook de Mercado Pago que llega dos veces —que es lo normal— deposita una sola vez.
 * El segundo intento choca con P2002 y devuelve el movimiento que ya estaba.
 *
 * Recibe la transacción de quien llama: el cobro y su asiento tienen que nacer juntos o no
 * nacer. Un pago registrado sin su movimiento de caja deja el libro mintiendo.
 *
 * Si el módulo de Caja no está habilitado para ese workspace, esto no debe llamarse. Lo
 * verifica quien llama, no esta función: acá no hay a quién redirigir.
 */
export type RecordMovementInput = {
  workspaceId: string;
  accountId: string;
  kind: "INGRESO" | "EGRESO";
  amountMinor: number;
  occurredAt: Date;
  description: string;
  sourceModule: Exclude<MovementSource, "manual">;
  sourceRef: string;
  categoryId?: string | null;
  clientId?: string | null;
  paymentMethod?: string;
  shiftId?: string | null;
  createdByUserId?: number | null;
};

export async function recordCashMovement(
  tx: Prisma.TransactionClient | PrismaClient,
  input: RecordMovementInput,
): Promise<{ id: string; created: boolean }> {
  try {
    const creado = await tx.cashMovement.create({
      data: {
        workspaceId: input.workspaceId,
        accountId: input.accountId,
        shiftId: input.shiftId ?? null,
        kind: input.kind,
        amountArs: minorToDecimalString(input.amountMinor),
        occurredAt: input.occurredAt,
        categoryId: input.categoryId ?? null,
        paymentMethod: input.paymentMethod ?? "EFECTIVO",
        clientId: input.clientId ?? null,
        description: input.description,
        sourceModule: input.sourceModule,
        sourceRef: input.sourceRef,
        createdByUserId: input.createdByUserId ?? null,
      },
      select: { id: true },
    });
    return { id: creado.id, created: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const yaEstaba = await tx.cashMovement.findFirst({
        where: { sourceModule: input.sourceModule, sourceRef: input.sourceRef },
        select: { id: true },
      });
      if (yaEstaba) return { id: yaEstaba.id, created: false };
    }
    throw e;
  }
}
```

- [ ] **Paso 6: Escribir `repository.ts`**

Crear `lib/cash/repository.ts` con: `openShiftFor(workspaceId, accountId)`, `listAccounts(workspaceId)`, `listCategories(workspaceId, kind?)`, `listMovements(workspaceId, filtros)` y `movementsOfShift(shiftId)`. Todas con `workspaceId` en el `where`, todas con `select` explícito, y los importes devueltos ya convertidos a centavos con `decimalArsToMinor`.

- [ ] **Paso 7: Correr todo y commitear**

```bash
pnpm test lib/cash/ && pnpm lint
```

Esperado: PASAN las 34 pruebas de `lib/cash/`.

```bash
git add lib/cash/
git commit -m "Escribir los movimientos de Caja, el depósito idempotente y la anulación

El importe siempre es positivo y el signo lo da el tipo. Guardar un egreso como
número negativo Y además marcarlo como egreso abre la puerta a que los dos se
contradigan, y entonces nadie sabe cuál manda.

recordCashMovement es la costura que van a usar Cuotas, Reservas, Ventas y
Órdenes de trabajo. Es idempotente por construcción: (sourceModule, sourceRef)
es único en la base, así que un webhook de Mercado Pago que llega dos veces
deposita una sola vez.

Un movimiento no se borra ni se edita: se anula con un contramovimiento que
apunta al original y exige motivo. El contramovimiento nace como manual aunque
el original viniera de otro módulo, porque lo decidió una persona y porque
copiar sourceRef rompería la idempotencia."
```

---

## Tarea 9: Caja — saldos y reportes

**Files:**
- Create: `lib/cash/balance.ts`, `lib/cash/balance.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces:
  - `accountBalanceMinor(movements: BalanceMovement[]): number` con `BalanceMovement = { kind: "INGRESO" | "EGRESO"; amountMinor: number; isTransfer?: boolean }`
  - `totalsByCategory(movements: CategorizedMovement[]): CategoryTotal[]` con `CategorizedMovement = BalanceMovement & { categoryId: string | null; categoryName: string | null }` y `CategoryTotal = { categoryId: string | null; categoryName: string; kind: "INGRESO" | "EGRESO"; totalMinor: number; count: number }`
  - `periodSummary(movements: BalanceMovement[]): { incomeMinor: number; expenseMinor: number; netMinor: number }`
  - `topClients(movements: ClientMovement[], limit: number): ClientTotal[]`

**Qué entra y qué no en cada función, que es la parte que más fácil se hace mal:**

| | Anulaciones | Transferencias entre cuentas |
|---|---|---|
| `accountBalanceMinor` (saldo de una cuenta) | **Entran.** Un contramovimiento es un asiento como cualquier otro, y ése es el punto de anular en vez de borrar | **Entran.** Si no, la caja fuerte daría siempre cero |
| `periodSummary` y `totalsByCategory` (cuánto entró y salió del negocio) | **Entran** | **NO entran.** La plata no entró ni salió del negocio: cambió de lugar |
| `topClients` | Entran | No aplica: una transferencia no tiene cliente |

Si los pases a la caja fuerte se contaran como egresos, los "gastos" del mes incluirían los treinta pases diarios y el reporte mentiría por un orden de magnitud. Es el error más caro que puede tener este módulo, y por eso hay una prueba dedicada.

- [ ] **Paso 1: Escribir las pruebas**

Crear `lib/cash/balance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { accountBalanceMinor, periodSummary, topClients, totalsByCategory } from "./balance";

const movs = [
  { kind: "INGRESO" as const, amountMinor: 1_000_00, categoryId: "c1", categoryName: "Ventas" },
  { kind: "INGRESO" as const, amountMinor: 500_00, categoryId: "c1", categoryName: "Ventas" },
  { kind: "EGRESO" as const, amountMinor: 300_00, categoryId: "c2", categoryName: "Proveedores" },
  { kind: "INGRESO" as const, amountMinor: 200_00, categoryId: null, categoryName: null },
];

describe("accountBalanceMinor", () => {
  it("sin movimientos el saldo es cero", () => {
    expect(accountBalanceMinor([])).toBe(0);
  });

  it("los ingresos suman y los egresos restan", () => {
    expect(accountBalanceMinor(movs)).toBe(1_400_00);
  });

  it("una anulación deja el neto en cero sin excluir nada", () => {
    const conAnulacion = [
      { kind: "INGRESO" as const, amountMinor: 1_000_00 },
      { kind: "EGRESO" as const, amountMinor: 1_000_00 },
    ];
    expect(accountBalanceMinor(conAnulacion)).toBe(0);
  });
});

describe("las transferencias no son ingresos ni egresos", () => {
  const conPase = [
    { kind: "INGRESO" as const, amountMinor: 50_000_00, categoryId: "c1", categoryName: "Ventas" },
    // El pase diario a la caja fuerte: sale de esta cuenta, pero no es un gasto.
    { kind: "EGRESO" as const, amountMinor: 30_000_00, categoryId: null, categoryName: null, isTransfer: true },
  ];

  it("el saldo de la cuenta SÍ descuenta el pase: la plata ya no está ahí", () => {
    expect(accountBalanceMinor(conPase)).toBe(20_000_00);
  });

  it("el resumen del período NO cuenta el pase como egreso", () => {
    expect(periodSummary(conPase)).toEqual({
      incomeMinor: 50_000_00,
      expenseMinor: 0,
      netMinor: 50_000_00,
    });
  });

  it("los totales por categoría tampoco lo cuentan", () => {
    const r = totalsByCategory(conPase);
    expect(r).toHaveLength(1);
    expect(r[0].categoryName).toBe("Ventas");
  });

  it("treinta pases en el mes no inflan los egresos ni un peso", () => {
    const mes = [
      { kind: "INGRESO" as const, amountMinor: 100_000_00, categoryId: "c1", categoryName: "Ventas" },
      ...Array.from({ length: 30 }, () => ({
        kind: "EGRESO" as const,
        amountMinor: 3_000_00,
        categoryId: null,
        categoryName: null,
        isTransfer: true,
      })),
    ];
    expect(periodSummary(mes).expenseMinor).toBe(0);
  });
});

describe("periodSummary", () => {
  it("separa entradas, salidas y neto", () => {
    expect(periodSummary(movs)).toEqual({
      incomeMinor: 1_700_00,
      expenseMinor: 300_00,
      netMinor: 1_400_00,
    });
  });

  it("un período sin movimientos da todo en cero y no null", () => {
    expect(periodSummary([])).toEqual({ incomeMinor: 0, expenseMinor: 0, netMinor: 0 });
  });
});

describe("totalsByCategory", () => {
  it("agrupa por categoría y cuenta los movimientos", () => {
    const r = totalsByCategory(movs);
    const ventas = r.find((t) => t.categoryId === "c1");
    expect(ventas).toEqual({
      categoryId: "c1",
      categoryName: "Ventas",
      kind: "INGRESO",
      totalMinor: 1_500_00,
      count: 2,
    });
  });

  it("los movimientos sin categoría se agrupan bajo un nombre legible", () => {
    const r = totalsByCategory(movs);
    const sin = r.find((t) => t.categoryId === null);
    expect(sin?.categoryName).toBe("Sin categoría");
    expect(sin?.totalMinor).toBe(200_00);
  });

  it("ordena de mayor a menor: lo que más pesa va primero", () => {
    const r = totalsByCategory(movs);
    expect(r[0].totalMinor).toBeGreaterThanOrEqual(r[1].totalMinor);
  });

  it("una misma categoría usada de los dos lados no se mezcla", () => {
    const r = totalsByCategory([
      { kind: "INGRESO", amountMinor: 100_00, categoryId: "c9", categoryName: "Reparaciones" },
      { kind: "EGRESO", amountMinor: 40_00, categoryId: "c9", categoryName: "Reparaciones" },
    ]);
    expect(r).toHaveLength(2);
    expect(r.map((t) => t.kind).sort()).toEqual(["EGRESO", "INGRESO"]);
  });
});

describe("topClients", () => {
  it("suma sólo los ingresos por cliente y ordena de mayor a menor", () => {
    const r = topClients(
      [
        { kind: "INGRESO", amountMinor: 500_00, clientId: "a", clientName: "Ana" },
        { kind: "INGRESO", amountMinor: 900_00, clientId: "b", clientName: "Beto" },
        { kind: "INGRESO", amountMinor: 200_00, clientId: "a", clientName: "Ana" },
        { kind: "EGRESO", amountMinor: 100_00, clientId: "a", clientName: "Ana" },
      ],
      10,
    );
    expect(r.map((c) => c.clientId)).toEqual(["b", "a"]);
    expect(r[1].totalMinor).toBe(700_00);
  });

  it("los movimientos sin cliente no entran", () => {
    const r = topClients(
      [{ kind: "INGRESO", amountMinor: 500_00, clientId: null, clientName: null }],
      10,
    );
    expect(r).toEqual([]);
  });

  it("respeta el tope pedido", () => {
    const muchos = Array.from({ length: 30 }, (_, i) => ({
      kind: "INGRESO" as const,
      amountMinor: (i + 1) * 100,
      clientId: `c${i}`,
      clientName: `Cliente ${i}`,
    }));
    expect(topClients(muchos, 5)).toHaveLength(5);
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla**

```bash
pnpm test lib/cash/balance.test.ts
```

Esperado: FALLA con `Failed to resolve import "./balance"`.

- [ ] **Paso 3: Escribir `balance.ts`**

```ts
/**
 * Saldos y totales. Módulo PURO, todo en centavos enteros.
 *
 * Hay una sola distinción que hacer, y es la que más fácil se hace mal: **el saldo de una
 * cuenta no es lo mismo que lo que entró y salió del negocio.**
 *
 * Las anulaciones entran en las dos cosas —ése es el punto de anular en vez de borrar—. Las
 * transferencias entre cuentas entran en el saldo y NO en los ingresos y egresos: la plata
 * no entró ni salió, cambió de lugar.
 */

export type BalanceMovement = {
  kind: "INGRESO" | "EGRESO";
  amountMinor: number;
  /** Es una pata de un pase entre cuentas. Quien lee de la base lo pasa como `transferId !== null`. */
  isTransfer?: boolean;
};

/**
 * El saldo de una cuenta. **Incluye las transferencias**: si el pase a la caja fuerte no
 * descontara de la caja diaria, el mostrador figuraría con plata que ya no tiene.
 */
export function accountBalanceMinor(movements: readonly BalanceMovement[]): number {
  return movements.reduce(
    (acc, m) => acc + (m.kind === "INGRESO" ? m.amountMinor : -m.amountMinor),
    0,
  );
}

/**
 * Cuánto entró y cuánto salió **del negocio**, que no es lo mismo que de una cuenta.
 *
 * Las transferencias quedan afuera. Un pase a la caja fuerte no es un gasto: la plata no
 * salió del negocio, cambió de lugar. Contarlo haría que los egresos del mes incluyeran los
 * treinta pases diarios, y el reporte mentiría por un orden de magnitud.
 */
export function periodSummary(movements: readonly BalanceMovement[]): {
  incomeMinor: number;
  expenseMinor: number;
  netMinor: number;
} {
  let incomeMinor = 0;
  let expenseMinor = 0;
  for (const m of movements) {
    if (m.isTransfer) continue;
    if (m.kind === "INGRESO") incomeMinor += m.amountMinor;
    else expenseMinor += m.amountMinor;
  }
  return { incomeMinor, expenseMinor, netMinor: incomeMinor - expenseMinor };
}

export type CategorizedMovement = BalanceMovement & {
  categoryId: string | null;
  categoryName: string | null;
};

export type CategoryTotal = {
  categoryId: string | null;
  categoryName: string;
  kind: "INGRESO" | "EGRESO";
  totalMinor: number;
  count: number;
};

/**
 * Agrupa por categoría Y por lado.
 *
 * Los dos, no sólo la categoría: "Reparaciones" puede tener ingresos —lo que se cobró— y
 * egresos —el repuesto que se compró—, y sumarlos juntos daría un número que no significa
 * nada.
 */
export function totalsByCategory(movements: readonly CategorizedMovement[]): CategoryTotal[] {
  const mapa = new Map<string, CategoryTotal>();
  for (const m of movements) {
    // Mismo criterio que `periodSummary`: un pase entre cuentas no es ingreso ni egreso.
    if (m.isTransfer) continue;
    const clave = `${m.kind}|${m.categoryId ?? ""}`;
    const actual = mapa.get(clave);
    if (actual) {
      actual.totalMinor += m.amountMinor;
      actual.count += 1;
    } else {
      mapa.set(clave, {
        categoryId: m.categoryId,
        categoryName: m.categoryName ?? "Sin categoría",
        kind: m.kind,
        totalMinor: m.amountMinor,
        count: 1,
      });
    }
  }
  return [...mapa.values()].sort((a, b) => b.totalMinor - a.totalMinor);
}

export type ClientMovement = BalanceMovement & {
  clientId: string | null;
  clientName: string | null;
};

export type ClientTotal = { clientId: string; clientName: string; totalMinor: number };

/**
 * Cuánto compró cada cliente. Sólo ingresos: un egreso a nombre de un cliente es una
 * devolución, y restarla acá haría que "cuánto me compró" dependiera de cómo se anuló algo.
 */
export function topClients(movements: readonly ClientMovement[], limit: number): ClientTotal[] {
  const mapa = new Map<string, ClientTotal>();
  for (const m of movements) {
    if (m.kind !== "INGRESO" || m.clientId === null) continue;
    const actual = mapa.get(m.clientId);
    if (actual) actual.totalMinor += m.amountMinor;
    else
      mapa.set(m.clientId, {
        clientId: m.clientId,
        clientName: m.clientName ?? "Sin nombre",
        totalMinor: m.amountMinor,
      });
  }
  return [...mapa.values()].sort((a, b) => b.totalMinor - a.totalMinor).slice(0, limit);
}
```

- [ ] **Paso 4: Correr, verificar que pasan, commitear**

```bash
pnpm test lib/cash/balance.test.ts
```

Esperado: PASAN, 11 pruebas.

```bash
git add lib/cash/balance.ts lib/cash/balance.test.ts
git commit -m "Escribir saldos y reportes de Caja

Ninguna función excluye movimientos: un contramovimiento entra en las sumas como
cualquier otro asiento. Ése es el punto de anular en vez de borrar — el neto
queda bien sin que nadie tenga que acordarse de excluir nada.

Los totales agrupan por categoría Y por lado. 'Reparaciones' puede tener
ingresos, lo que se cobró, y egresos, el repuesto que se compró: sumarlos juntos
daría un número que no significa nada."
```

---

## Tarea 10: Caja fuerte y pases entre cuentas

**Files:**
- Create: `lib/cash/transfer.ts`, `lib/cash/transfer.test.ts`

**Interfaces:**
- Consumes: `minorToDecimalString` de `lib/membership/money.ts`; `prisma.cashTransfer` (Tarea 1).
- Produces:
  - `suggestedDropMinor(input: { countedMinor: number; fixedFloatMinor: number }): number`
  - `validateTransfer(input: { fromAccountId: string; toAccountId: string; amountMinor: number; fromBalanceMinor: number }): { ok: true } | { ok: false; error: string }`
  - `createCashTransfer(tx, input: CreateTransferInput): Promise<{ transferId: string }>`

**El caso de todos los días.** Al cerrar el mostrador, el negocio guarda lo recaudado en la caja fuerte y deja un **fondo fijo** para el vuelto del día siguiente. En la jerga eso es un *retiro de caja*; en la pantalla se llama "Pasar a la caja fuerte".

**La regla que ordena todo:** la caja fuerte es otra cuenta de efectivo, y el pase es una **transferencia**. No es un ingreso ni un egreso del negocio. Los saldos la incluyen; los reportes de ingresos y egresos la excluyen (Tarea 9).

- [ ] **Paso 1: Escribir las pruebas**

Crear `lib/cash/transfer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { suggestedDropMinor, validateTransfer } from "./transfer";

describe("suggestedDropMinor", () => {
  it("propone pasar todo lo que sobra del fondo fijo", () => {
    expect(suggestedDropMinor({ countedMinor: 47_300_00, fixedFloatMinor: 20_000_00 })).toBe(27_300_00);
  });

  it("si contaste justo el fondo fijo, no hay nada que pasar", () => {
    expect(suggestedDropMinor({ countedMinor: 20_000_00, fixedFloatMinor: 20_000_00 })).toBe(0);
  });

  it("si contaste menos que el fondo fijo, no propone un pase negativo", () => {
    expect(suggestedDropMinor({ countedMinor: 15_000_00, fixedFloatMinor: 20_000_00 })).toBe(0);
  });

  it("sin fondo fijo configurado propone pasar todo", () => {
    expect(suggestedDropMinor({ countedMinor: 47_300_00, fixedFloatMinor: 0 })).toBe(47_300_00);
  });
});

describe("validateTransfer", () => {
  const base = { fromAccountId: "diaria", toAccountId: "fuerte", fromBalanceMinor: 50_000_00 };

  it("un pase normal se acepta", () => {
    expect(validateTransfer({ ...base, amountMinor: 30_000_00 })).toEqual({ ok: true });
  });

  it("pasar todo el saldo se acepta", () => {
    expect(validateTransfer({ ...base, amountMinor: 50_000_00 })).toEqual({ ok: true });
  });

  it("no se pasa más de lo que hay en la cuenta de origen", () => {
    expect(validateTransfer({ ...base, amountMinor: 60_000_00 })).toEqual({
      ok: false,
      error: "No podés pasar más plata de la que hay en esa cuenta.",
    });
  });

  it("un importe de cero se rechaza", () => {
    expect(validateTransfer({ ...base, amountMinor: 0 })).toEqual({
      ok: false,
      error: "El importe tiene que ser mayor que cero.",
    });
  });

  it("un importe negativo se rechaza: el sentido lo dan las cuentas, no el signo", () => {
    expect(validateTransfer({ ...base, amountMinor: -100_00 })).toEqual({
      ok: false,
      error: "El importe tiene que ser mayor que cero.",
    });
  });

  it("no se pasa plata de una cuenta a sí misma", () => {
    expect(
      validateTransfer({ ...base, toAccountId: "diaria", amountMinor: 10_000_00 }),
    ).toEqual({ ok: false, error: "Elegí dos cuentas distintas." });
  });
});
```

- [ ] **Paso 2: Correr y verificar que falla**

```bash
pnpm test lib/cash/transfer.test.ts
```

Esperado: FALLA con `Failed to resolve import "./transfer"`.

- [ ] **Paso 3: Escribir `transfer.ts`**

```ts
import "server-only";
import type { Prisma } from "@repo/db";
import { minorToDecimalString } from "@/lib/membership/money";

/**
 * Los pases de plata entre dos cuentas del mismo workspace.
 *
 * El caso que motiva todo esto es el de todos los días: al cerrar el mostrador se guarda lo
 * recaudado en la caja fuerte y queda el fondo fijo para el vuelto. Es un *retiro de caja*.
 *
 * Un pase NO es un ingreso ni un egreso del negocio. Los saldos por cuenta lo incluyen —la
 * plata efectivamente ya no está en el mostrador— y los reportes de ingresos y egresos lo
 * excluyen. Ver `lib/cash/balance.ts`.
 */

/**
 * Cuánto conviene pasar a la caja fuerte al cerrar.
 *
 * Nunca propone un pase negativo. Si la caja quedó por debajo del fondo fijo —porque hubo un
 * faltante o porque el día fue flojo—, lo que hace falta no es un pase al revés: es que el
 * arqueo deje asentada la diferencia, que es otra cosa y ya la resuelve `canCloseShift`.
 */
export function suggestedDropMinor(input: {
  countedMinor: number;
  fixedFloatMinor: number;
}): number {
  return Math.max(0, input.countedMinor - input.fixedFloatMinor);
}

export type TransferCheck = { ok: true } | { ok: false; error: string };

/**
 * El importe es siempre positivo: el sentido del pase lo dan las dos cuentas, no el signo.
 * Permitir un negativo sería tener dos maneras de expresar lo mismo, y tarde o temprano las
 * dos se usan y se contradicen.
 */
export function validateTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  fromBalanceMinor: number;
}): TransferCheck {
  if (input.fromAccountId === input.toAccountId) {
    return { ok: false, error: "Elegí dos cuentas distintas." };
  }
  if (input.amountMinor <= 0) {
    return { ok: false, error: "El importe tiene que ser mayor que cero." };
  }
  if (input.amountMinor > input.fromBalanceMinor) {
    return { ok: false, error: "No podés pasar más plata de la que hay en esa cuenta." };
  }
  return { ok: true };
}

export type CreateTransferInput = {
  workspaceId: string;
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  occurredAt: Date;
  note: string | null;
  /** Turno al que se imputa la pata de salida, cuando el pase se hace al cerrar. */
  fromShiftId?: string | null;
  createdByUserId?: number | null;
};

/**
 * Escribe el pase y sus dos asientos hermanos, en una sola transacción.
 *
 * Los tres nacen juntos o no nace ninguno. Un egreso sin su ingreso hermano sería plata
 * evaporada entre dos cuentas, y encontrar eso meses después es prácticamente imposible.
 *
 * Los dos asientos van sin categoría a propósito: una transferencia no pertenece a ninguna
 * categoría de ingreso ni de egreso, y forzarle una la metería en los reportes por la puerta
 * de atrás.
 */
export async function createCashTransfer(
  tx: Prisma.TransactionClient,
  input: CreateTransferInput,
): Promise<{ transferId: string }> {
  const importe = minorToDecimalString(input.amountMinor);

  const pase = await tx.cashTransfer.create({
    data: {
      workspaceId: input.workspaceId,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amountArs: importe,
      occurredAt: input.occurredAt,
      note: input.note,
      createdByUserId: input.createdByUserId ?? null,
    },
    select: { id: true },
  });

  const comun = {
    workspaceId: input.workspaceId,
    amountArs: importe,
    occurredAt: input.occurredAt,
    categoryId: null,
    paymentMethod: "EFECTIVO",
    transferId: pase.id,
    sourceModule: "manual",
    createdByUserId: input.createdByUserId ?? null,
  };

  await tx.cashMovement.createMany({
    data: [
      {
        ...comun,
        accountId: input.fromAccountId,
        shiftId: input.fromShiftId ?? null,
        kind: "EGRESO",
        description: input.note ?? "Pase a otra cuenta",
      },
      {
        ...comun,
        accountId: input.toAccountId,
        shiftId: null,
        kind: "INGRESO",
        description: input.note ?? "Pase desde otra cuenta",
      },
    ],
  });

  return { transferId: pase.id };
}
```

- [ ] **Paso 4: Correr y verificar que pasa**

```bash
pnpm test lib/cash/transfer.test.ts
```

Esperado: PASAN, 10 pruebas.

- [ ] **Paso 5: Verificar que el resto sigue en verde**

```bash
pnpm test lib/cash/
```

Esperado: PASAN todas, incluidas las cuatro pruebas nuevas de la Tarea 9 que comprueban que un pase no infla los egresos.

- [ ] **Paso 6: Commit**

```bash
git add lib/cash/transfer.ts lib/cash/transfer.test.ts
git commit -m "Escribir los pases a la caja fuerte

El gesto de todos los días: al cerrar el mostrador se guarda lo recaudado en la
caja fuerte y queda el fondo fijo para el vuelto. La caja fuerte no es un
concepto nuevo, es otra cuenta de efectivo, y el pase es una transferencia.

Un pase no es un ingreso ni un egreso del negocio. Los saldos por cuenta lo
incluyen, porque la plata efectivamente ya no está en el mostrador. Los reportes
de ingresos y egresos lo excluyen: si no, los treinta pases del mes aparecerían
como treinta gastos que nunca se hicieron.

El pase y sus dos asientos nacen juntos o no nace ninguno. Un egreso sin su
ingreso hermano es plata evaporada entre dos cuentas, y encontrar eso meses
después es prácticamente imposible.

Los dos asientos van sin categoría a propósito: forzarles una los metería en los
reportes por la puerta de atrás."
```

---

## Tarea 11: Caja — las pantallas

**Files:**
- Create: `app/(shell)/caja/layout.tsx`, `page.tsx`, `movimientos/page.tsx`, `turnos/page.tsx`, `configuracion/page.tsx`, `actions.ts`
- Create: `components/cash/movement-form.tsx`, `components/cash/shift-panel.tsx`, `components/cash/movements-table.tsx`, `components/cash/account-form.tsx`, `components/cash/category-form.tsx`

**Interfaces:**
- Consumes: todo lo de las Tareas 6 a 10, más `listClients` (Tarea 4) para el selector de cliente.
- Produces: `openShiftAction`, `closeShiftAction`, `createMovementAction`, `reverseMovementAction`, `transferAction`, `saveAccountAction`, `saveCategoryAction`, `enableCashForWorkspaceAction` (siembra).

**Referencias visuales a copiar:** `app/(shell)/reservas/page.tsx` para la pantalla principal, `app/(shell)/reservas/configuracion/page.tsx` para la de ajustes, `components/page-header.tsx` para el encabezado.

- [ ] **Paso 1: Escribir el guardia de la sección**

`app/(shell)/caja/layout.tsx`, idéntico en forma al de Clientes pero llamando a `requireCashStaff()`.

- [ ] **Paso 2: Escribir las acciones de turno**

En `app/(shell)/caja/actions.ts`:

```ts
/**
 * Abrir el turno.
 *
 * La verificación de "ya hay uno abierto" se hace dos veces a propósito: acá, para dar un
 * mensaje que se entienda, y en la base con el índice único parcial, que es el que de verdad
 * impide que dos personas abriendo a la vez dejen dos turnos abiertos.
 */
export async function openShiftAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireCashStaff();
  const accountId = String(formData.get("accountId") ?? "").trim();
  const openingMinor = parseArsToMinor(String(formData.get("openingAmountArs") ?? "")) ?? 0;

  const cuenta = await prisma.cashAccount.findFirst({
    where: { id: accountId, workspaceId: workspace.id },
    select: { kind: true, isVault: true },
  });
  if (!cuenta) redirect(`/caja?error=${encodeURIComponent("Esa cuenta no existe.")}`);

  const abierto = await prisma.cashShift.count({ where: { accountId, status: "ABIERTO" } });
  const permiso = canOpenShift({
    accountKind: cuenta.kind,
    isVault: cuenta.isVault,
    openShiftExists: abierto > 0,
  });
  if (!permiso.ok) redirect(`/caja?error=${encodeURIComponent(permiso.error)}`);

  try {
    await prisma.cashShift.create({
      data: {
        workspaceId: workspace.id,
        accountId,
        openingAmountArs: minorToDecimalString(openingMinor),
        openedByUserId: user.id,
        status: "ABIERTO",
      },
    });
  } catch (e) {
    // El índice único parcial: otra persona abrió en el mismo instante.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(`/caja?error=${encodeURIComponent("Esa caja ya tiene un turno abierto.")}`);
    }
    throw e;
  }

  revalidatePath("/caja");
  redirect("/caja?ok=1");
}

/**
 * Cerrar el turno contando.
 *
 * Lo esperado y la diferencia se calculan una sola vez, acá, y se guardan. No se recalculan
 * al leer: el arqueo de hace dos años tiene que seguir diciendo lo mismo aunque después se
 * anule un movimiento de ese día.
 */
export async function closeShiftAction(formData: FormData): Promise<void> {
  const { workspace, user } = await requireCashStaff();
  const shiftId = String(formData.get("shiftId") ?? "").trim();
  const countedMinor = parseArsToMinor(String(formData.get("countedAmountArs") ?? ""));
  const note = String(formData.get("differenceNote") ?? "").trim() || null;

  if (countedMinor === null) {
    redirect(`/caja?error=${encodeURIComponent("Escribí cuánto contaste.")}`);
  }

  const turno = await prisma.cashShift.findFirst({
    where: { id: shiftId, workspaceId: workspace.id },
    select: { status: true, openingAmountArs: true },
  });
  if (!turno) redirect(`/caja?error=${encodeURIComponent("Ese turno no existe.")}`);

  const movimientos = await prisma.cashMovement.findMany({
    where: { shiftId },
    select: { kind: true, amountArs: true },
  });

  const expectedMinor = expectedAmountMinor({
    openingMinor: decimalArsToMinor(turno.openingAmountArs),
    movements: movimientos.map((m) => ({
      kind: m.kind as "INGRESO" | "EGRESO",
      amountMinor: decimalArsToMinor(m.amountArs),
    })),
  });
  const differenceMinor = shiftDifferenceMinor(expectedMinor, countedMinor);

  const permiso = canCloseShift({ status: turno.status, differenceMinor, note });
  if (!permiso.ok) redirect(`/caja?error=${encodeURIComponent(permiso.error)}`);

  await prisma.cashShift.update({
    where: { id: shiftId },
    data: {
      status: "CERRADO",
      closedAt: new Date(),
      closedByUserId: user.id,
      countedAmountArs: minorToDecimalString(countedMinor),
      expectedAmountArs: minorToDecimalString(expectedMinor),
      differenceArs: minorToDecimalString(differenceMinor),
      differenceNote: note,
    },
  });

  revalidatePath("/caja");
  redirect("/caja/turnos?ok=1");
}
```

- [ ] **Paso 3: Escribir las acciones de movimiento**

`createMovementAction` usa `parseMovementForm`, verifica que la cuenta y —si vienen— la categoría y el cliente sean del workspace, busca el turno abierto de esa cuenta para asociarlo, y crea el movimiento con `sourceModule: "manual"`.

`reverseMovementAction` lee el original con `select` explícito, arma el contramovimiento con `buildReversal`, y lo crea en una transacción. **Verifica antes que el original sea del workspace.**

- [ ] **Paso 4: Escribir la acción de siembra**

```ts
/**
 * Sembrar cuentas y categorías la primera vez.
 *
 * `skipDuplicates` hace que apretar el botón dos veces no rompa nada ni duplique filas: es
 * más barato que un estado "ya sembrado" que después hay que mantener.
 */
export async function enableCashForWorkspaceAction(): Promise<void> {
  const { workspace } = await requireCashAdmin();
  const { accounts, categories } = seedRowsFor(workspace.id);
  await prisma.$transaction([
    prisma.cashAccount.createMany({ data: accounts, skipDuplicates: true }),
    prisma.cashCategory.createMany({ data: categories, skipDuplicates: true }),
  ]);
  revalidatePath("/caja/configuracion");
  redirect("/caja/configuracion?ok=1");
}
```

- [ ] **Paso 5: Escribir las cuatro pantallas**

- **`/caja`** — el turno abierto. Si no hay ninguno: selector de cuenta y campo de monto inicial para abrirlo. Si hay uno: saldo esperado en vivo, botón de nuevo movimiento, lista del turno y panel de cierre con el campo de conteo y el de explicación.
- **`/caja/movimientos`** — el libro completo, con filtros por fecha, cuenta, categoría, tipo y cliente. Cada fila muestra origen (una etiqueta "Automático" cuando `sourceModule !== "manual"`) y un botón de anular. **Los automáticos no muestran botón de editar, sólo de anular.**
- **`/caja/turnos`** — historial de arqueos: cuenta, quién abrió, quién cerró, esperado, contado, diferencia y explicación. Las diferencias distintas de cero se destacan.
- **`/caja/pases`** — historial de pases entre cuentas: fecha, de dónde a dónde, importe, quién lo hizo y la nota.
- **`/caja/configuracion`** — cuentas y categorías, con el botón de siembra cuando no hay ninguna. Cada cuenta de efectivo tiene además el campo de **fondo fijo**, y una marca para señalar cuál es la **caja fuerte**.

**El pase al cerrar, que es el gesto de todos los días.** Después de contar y cerrar el turno, la pantalla propone el pase con la cuenta ya hecha:

> Contaste **$47.300**. El fondo fijo de esta caja es **$20.000**.
> ¿Pasás **$27.300** a la caja fuerte? — [Sí, pasar] [Ahora no]

El importe sale de `suggestedDropMinor` y es editable: hay días en que se deja más cambio. Si el negocio no tiene ninguna cuenta marcada como caja fuerte, este paso no aparece — no hay a dónde pasar.

`transferAction` valida con `validateTransfer`, verifica que **las dos cuentas sean del workspace**, y escribe con `createCashTransfer` dentro de una transacción.

- [ ] **Paso 6: Verificar que compila**

```bash
pnpm lint && pnpm --filter fotoffice exec tsc --noEmit && pnpm test
```

Esperado: sin errores y todas las pruebas en verde.

- [ ] **Paso 7: Commit**

```bash
git add "app/(shell)/caja/" components/cash/
git commit -m "Construir las cuatro pantallas de Caja

Turno abierto, libro completo, historial de arqueos y configuración.

Lo esperado y la diferencia se calculan una sola vez al cerrar y se guardan: el
arqueo de hace dos años tiene que seguir diciendo lo mismo aunque después se
anule un movimiento de ese día.

Los movimientos automáticos no muestran botón de editar, sólo de anular: el dato
de verdad vive en el módulo que los originó."
```

---

## Tarea 12: Que lo que ya se cobra aparezca en Caja

**Files:**
- Create: `lib/cash/auto-deposit.ts`, `lib/cash/auto-deposit.test.ts`
- Modify: `lib/membership/manual-payment.ts` (dentro de la transacción que ya existe)
- Modify: `app/api/payments/mp/webhook/route.ts`
- Modify: `lib/bookings/lifecycle.ts`

**Interfaces:**
- Consumes: `recordCashMovement` (Tarea 8), `isModuleEnabledForWorkspace` (ya existe).
- Produces:
  - `resolveDepositTarget(input: { cashEnabled: boolean; paymentMethod: string; accounts: AccountOption[]; categories: CategoryOption[]; categoryName: string }): { ok: true; accountId: string; categoryId: string | null } | { ok: false; reason: string }`
  - `AccountOption = { id: string; name: string; kind: string; isDefault: boolean }` y `CategoryOption = { id: string; name: string; kind: string }`

**Por qué importa:** SFPR cobra cuotas y alquila el estudio, y hoy esa plata no aparece en ningún libro. Éste es el paso que convierte a Caja en la foto completa en vez de un cuaderno paralelo.

**La regla que no se puede romper:** si Caja no está habilitada para ese workspace, **el cobro tiene que seguir funcionando igual**. Un módulo apagado no puede romper un pago. Todo lo de esta tarea es estrictamente opcional en tiempo de ejecución.

- [ ] **Paso 1: Escribir las pruebas de la decisión**

Crear `lib/cash/auto-deposit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { resolveDepositTarget } from "./auto-deposit";

const cuentas = [
  { id: "efectivo", name: "Efectivo", kind: "EFECTIVO", isDefault: true },
  { id: "mp", name: "Mercado Pago", kind: "DIGITAL", isDefault: false },
];
const categorias = [{ id: "cuotas", name: "Cuotas", kind: "INGRESO" }];

describe("resolveDepositTarget", () => {
  it("con Caja apagada no deposita, y no es un error", () => {
    const r = resolveDepositTarget({
      cashEnabled: false,
      paymentMethod: "EFECTIVO",
      accounts: cuentas,
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r).toEqual({ ok: false, reason: "El módulo de Caja no está habilitado." });
  });

  it("un cobro por Mercado Pago va a la cuenta digital", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "MERCADO_PAGO",
      accounts: cuentas,
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r).toEqual({ ok: true, accountId: "mp", categoryId: "cuotas" });
  });

  it("un cobro en efectivo va a la cuenta de efectivo", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "EFECTIVO",
      accounts: cuentas,
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r).toEqual({ ok: true, accountId: "efectivo", categoryId: "cuotas" });
  });

  it("una transferencia va a la cuenta digital, no al efectivo", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "TRANSFERENCIA",
      accounts: cuentas,
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r.ok && r.accountId).toBe("mp");
  });

  it("sin la categoría esperada deposita igual, sin categoría", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "EFECTIVO",
      accounts: cuentas,
      categories: [],
      categoryName: "Cuotas",
    });
    expect(r).toEqual({ ok: true, accountId: "efectivo", categoryId: null });
  });

  it("sin ninguna cuenta no deposita en vez de inventar una", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "EFECTIVO",
      accounts: [],
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r).toEqual({ ok: false, reason: "El workspace no tiene ninguna cuenta de caja." });
  });

  it("sin cuenta digital, un cobro por Mercado Pago cae en la cuenta por omisión", () => {
    const r = resolveDepositTarget({
      cashEnabled: true,
      paymentMethod: "MERCADO_PAGO",
      accounts: [{ id: "efectivo", name: "Efectivo", kind: "EFECTIVO", isDefault: true }],
      categories: categorias,
      categoryName: "Cuotas",
    });
    expect(r.ok && r.accountId).toBe("efectivo");
  });
});
```

- [ ] **Paso 2: Correr, verificar que falla, escribir `auto-deposit.ts`**

```bash
pnpm test lib/cash/auto-deposit.test.ts
```

Esperado: FALLA. Después:

```ts
/**
 * A qué cuenta y con qué categoría entra un cobro que vino de otro módulo. Módulo PURO.
 *
 * Existe para que la decisión sea probable sin base: es el punto donde un error se ve como
 * plata en la cuenta equivocada, y el arqueo del efectivo da mal todos los días hasta que
 * alguien se da cuenta.
 *
 * Nunca inventa una cuenta. Si no hay ninguna, no deposita — y eso NO es un error: el cobro
 * tiene que seguir funcionando con el módulo de Caja apagado o a medio configurar.
 */

export type AccountOption = { id: string; name: string; kind: string; isDefault: boolean };
export type CategoryOption = { id: string; name: string; kind: string };

export type DepositTarget =
  | { ok: true; accountId: string; categoryId: string | null }
  | { ok: false; reason: string };

/** Lo que no se cuenta a mano va a la cuenta digital. */
const MEDIOS_DIGITALES = new Set(["MERCADO_PAGO", "TRANSFERENCIA", "TARJETA"]);

export function resolveDepositTarget(input: {
  cashEnabled: boolean;
  paymentMethod: string;
  accounts: readonly AccountOption[];
  categories: readonly CategoryOption[];
  categoryName: string;
}): DepositTarget {
  if (!input.cashEnabled) {
    return { ok: false, reason: "El módulo de Caja no está habilitado." };
  }
  if (input.accounts.length === 0) {
    return { ok: false, reason: "El workspace no tiene ninguna cuenta de caja." };
  }

  const quiereDigital = MEDIOS_DIGITALES.has(input.paymentMethod);
  const porTipo = input.accounts.find((a) =>
    quiereDigital ? a.kind === "DIGITAL" : a.kind === "EFECTIVO",
  );
  const cuenta = porTipo ?? input.accounts.find((a) => a.isDefault) ?? input.accounts[0];

  const categoria =
    input.categories.find((c) => c.kind === "INGRESO" && c.name === input.categoryName) ?? null;

  return { ok: true, accountId: cuenta.id, categoryId: categoria?.id ?? null };
}
```

- [ ] **Paso 3: Enganchar el pago de cuota cobrado en mano**

En `lib/membership/manual-payment.ts`, **dentro de la transacción que ya existe** y después de crear el `MembershipPayment`:

```ts
  // Depositar en Caja, si el workspace la tiene encendida.
  //
  // Va dentro de la misma transacción a propósito: un pago registrado sin su asiento deja el
  // libro mintiendo. Pero un fallo del depósito NO puede voltear el pago, así que lo que se
  // decide antes —con `resolveDepositTarget`— es si corresponde depositar o no, y sólo si
  // corresponde se escribe.
  const destino = resolveDepositTarget({
    cashEnabled: await isModuleEnabledForWorkspace(workspaceId, CASH_MODULE_KEY),
    paymentMethod: method,
    accounts: await tx.cashAccount.findMany({
      where: { workspaceId, isActive: true },
      select: { id: true, name: true, kind: true, isDefault: true },
      orderBy: { order: "asc" },
    }),
    categories: await tx.cashCategory.findMany({
      where: { workspaceId, kind: "INGRESO", isActive: true },
      select: { id: true, name: true, kind: true },
    }),
    categoryName: "Cuotas",
  });

  if (destino.ok) {
    await recordCashMovement(tx, {
      workspaceId,
      accountId: destino.accountId,
      categoryId: destino.categoryId,
      kind: "INGRESO",
      amountMinor,
      occurredAt: paidAt,
      description: `Cuota — socio ${memberNumber}`,
      paymentMethod: method,
      sourceModule: "membership",
      sourceRef: payment.id,
    });
  }
```

> `memberNumber` hay que traerlo del `Member` dentro de la misma consulta que ya se hace. Si la función no lo tiene a mano, agregalo al `select` existente en vez de hacer una consulta nueva.

- [ ] **Paso 4: Enganchar el webhook de Mercado Pago**

En `app/api/payments/mp/webhook/route.ts`, donde el pago pasa a `APROBADO`, hacer lo mismo con `paymentMethod: "MERCADO_PAGO"` y `sourceRef` = el id del `MembershipPayment`.

**La idempotencia ya está resuelta:** `(sourceModule, sourceRef)` es único, así que un webhook que llega tres veces —que es lo normal— deposita una sola vez. No hace falta agregar ninguna verificación.

- [ ] **Paso 5: Enganchar las reservas**

En `lib/bookings/lifecycle.ts`, donde una reserva pasa a pagada (tanto por Mercado Pago como por transferencia confirmada a mano), depositar con `sourceModule: "bookings"`, `sourceRef` = el id de la `Booking`, `categoryName: "Alquiler de espacios"` y `clientId`: el de la ficha del cliente si la reserva la tiene, o `null`.

- [ ] **Paso 6: Correr todo**

```bash
pnpm test && pnpm lint && pnpm --filter fotoffice exec tsc --noEmit
```

Esperado: todo en verde, **incluidas las pruebas que ya existían de cuotas y reservas**. Si alguna de ésas se rompe, el enganche está de más o está mal ubicado: arreglalo ahí, no toques la prueba vieja.

- [ ] **Paso 7: Commit**

```bash
git add lib/cash/auto-deposit.ts lib/cash/auto-deposit.test.ts lib/membership/manual-payment.ts lib/bookings/lifecycle.ts app/api/payments/mp/webhook/route.ts
git commit -m "Que las cuotas y las reservas cobradas aparezcan en Caja

SFPR cobra cuotas y alquila el estudio, y hoy esa plata no aparece en ningún
libro. Esto convierte a Caja en la foto completa en vez de un cuaderno paralelo.

El destino se decide en un módulo puro y probado, porque es el punto donde un
error se ve como plata en la cuenta equivocada y el arqueo del efectivo da mal
todos los días hasta que alguien se da cuenta. Lo cobrado en mano va al efectivo
y lo digital a la cuenta digital.

Con Caja apagada o sin cuentas configuradas no deposita, y eso no es un error:
un módulo apagado no puede romper un pago. La idempotencia sale gratis del
índice único (sourceModule, sourceRef): un webhook que llega tres veces deposita
una sola."
```

---

## Tarea 13: Aplicar la migración y encender el módulo

**Files:** ninguno. Esta tarea es operación sobre las bases y la configuración.

**Interfaces:**
- Consumes: la migración de la Tarea 1 y todo el código de las Tareas 2 a 11.
- Produces: las seis tablas existiendo en las bases, y los dos módulos encendidos en SFPR.

> **Esta tarea se hace cuando TODO lo anterior está en verde.** Aplicar la migración antes deja tablas sin código que las use, que es la peor combinación: ocupan lugar, confunden a quien mire el esquema, y si hay que cambiar el diseño ya no se puede editar la migración.

**Contexto obligatorio antes de empezar:**
- La base de producción de FOTOFFICE es el proyecto Neon `compramelafoto` (`divine-hall-10689679`), rama **`development`** (`br-old-rain-adwthzng`) — **no** la rama llamada `production`, que es la de CompraMeLaFoto y tiene las tablas de FOTOFFICE vacías.
- El despliegue nunca corre `prisma migrate deploy`: aplicar el SQL sin registrarlo en `_prisma_migrations` deja el historial desincronizado.
- El esquema está compartido por cinco bases: una tabla que falta en una de ellas rompe las escrituras de esa aplicación.

- [ ] **Paso 1: Probar la migración en una rama descartable, no en producción**

Crear una rama Neon a partir de la de producción de FOTOFFICE y aplicar ahí el `migration.sql` completo. Si algo falla —un nombre de índice repetido, una clave foránea hacia una tabla que no existe en esa base— se descubre acá y no en la base con 159 socios.

Verificar que las seis tablas quedaron:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('Client','CashAccount','CashCategory','CashShift','CashMovement','CashTransfer')
order by table_name;
```

Esperado: seis filas.

Verificar que el índice parcial existe, que es lo que más fácil se pierde al copiar SQL:

```sql
select indexname from pg_indexes
where tablename = 'CashShift' and indexname = 'CashShift_un_turno_abierto_por_cuenta';
```

Esperado: una fila.

- [ ] **Paso 2: Aplicar en la base de producción de FOTOFFICE**

Aplicar el mismo SQL en `divine-hall-10689679`, rama `br-old-rain-adwthzng`. Volver a correr las dos verificaciones del paso anterior.

- [ ] **Paso 3: Registrar la migración en `_prisma_migrations`**

Primero leer el checksum de una base donde ya figure aplicada; si ninguna la tiene, calcularlo del archivo:

```bash
shasum -a 256 packages/db/prisma/migrations/20260913000000_cash_and_clients/migration.sql
```

Después insertar la fila, en la base donde se aplicó:

```sql
insert into "_prisma_migrations"
  (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
select gen_random_uuid()::text, '<checksum>', now(), '20260913000000_cash_and_clients', null, null, now(), 1
where not exists (
  select 1 from "_prisma_migrations" where migration_name = '20260913000000_cash_and_clients'
);
```

- [ ] **Paso 4: Aplicar en las otras cuatro bases**

Las tablas son nuevas y ninguna otra aplicación las usa, pero el esquema Prisma es compartido: si `Client` no existe en la base de Clickatón y alguien genera ahí el cliente, el historial de migraciones queda desincronizado y el próximo `migrate status` denuncia drift.

Aplicar el mismo SQL y registrar la misma fila en: `compramelafoto` rama `production`, `bitter-math-56019731` (Clickatón), `wandering-pine-79918137` (InfoSpot), y la de FotoRank.

Verificar en cada una con la consulta del Paso 1.

- [ ] **Paso 5: Encender los dos módulos en SFPR**

Desde el panel de administración de módulos del workspace, encender **Clientes** y **Caja** en SFPR (`ws_sfpr_seed`). Confirmar:

```sql
select "moduleKey", enabled from "WorkspaceFeatureModule"
where "workspaceId" = 'ws_sfpr_seed' and "moduleKey" in ('cash','clients');
```

Esperado: dos filas con `enabled = true`.

- [ ] **Paso 6: Sembrar cuentas y categorías, y probar el circuito completo**

En `/caja/configuracion`, apretar el botón de siembra. Después, de punta a punta:

1. Abrir un turno en Efectivo con $10.000.
2. Cargar un ingreso de $1.500 con categoría y cliente.
3. Cargar un egreso de $300.
4. Verificar que el saldo esperado dice $11.200.
5. Anular el egreso con un motivo, y verificar que el esperado vuelve a $11.500 y que los dos asientos quedan a la vista.
6. Cerrar el turno contando $11.500 y verificar que la diferencia da cero.
6b. Poner $10.000 de fondo fijo en la caja diaria, cerrar un turno con $25.000 contados, y verificar que **propone pasar $15.000** a la caja fuerte. Aceptar.
6c. Verificar que la caja diaria queda en $10.000 y la caja fuerte en $15.000.
6d. **Verificar en el reporte del período que los egresos NO incluyen ese pase.** Es la comprobación más importante de toda la prueba: si el pase figura como gasto, el reporte miente.
7. Cerrar otro turno contando de menos y verificar que **no deja cerrar sin explicación**.
8. Registrar un pago de cuota a mano y verificar que **aparece solo** en el libro, marcado como automático y sin botón de editar.
9. Dar de alta un cliente que sea también socio, enlazarlo, y verificar que el listado muestra la etiqueta de socio.

- [ ] **Paso 7: Commit y cierre de la etapa**

```bash
git commit --allow-empty -m "Cerrar la etapa 1a: Caja y Clientes en producción

Migración aplicada y registrada en las cinco bases, módulos encendidos en SFPR,
cuentas y categorías sembradas, y el circuito probado de punta a punta: apertura,
movimientos, anulación por contramovimiento, cierre con y sin diferencia, y el
depósito automático de una cuota cobrada a mano.

SFPR pasa a tener por primera vez un libro donde figura lo que cobra. La etapa 1b
—productos, stock y venta de mostrador, para DNX Estudio— se enchufa acá encima."
```

---

## Revisión del plan contra el diseño

Hecha después de escribirlo, contra el spec.

**Cobertura.** §5 Clientes → Tareas 3, 4 y 5. §6 Caja → Tareas 6 a 11. §6.2.1 (caja fuerte y pases) → Tareas 1, 7, 9 y 10. §6.5 (reflejo de otros módulos) → Tarea 12. §11.1 (datos fiscales desde ahora) → Tarea 1 (`ivaCondition` en el esquema) y Tarea 3 (validación). §12 etapa 1a → el plan entero.

**Tres cosas del diseño que este plan NO construye, a propósito:**

1. **`ClientDevice`** (el equipo del cliente, §5.2). El diseño ya dice que se construye en la etapa 2, con Órdenes de trabajo. Crear la tabla ahora sería adivinar los campos sin un consumidor.
2. **`externalInvoiceRef` en `Sale` y `WorkOrder`** (§11.1). Esas dos tablas son de las etapas 1b y 2. Lo que sí entra acá es `Client.ivaCondition`, que es la parte de la preparación fiscal que corresponde a la etapa 1a.
3. **El portal del cliente.** Es la etapa 5. `Client.userId` queda en el esquema para que la etapa 5 no tenga que migrar, pero nada lo lee todavía.

**Una decisión que el plan cierra y el diseño dejaba abierta:** quién puede abrir y cerrar caja (§15.2 del spec) → STAFF+, resuelto en la Tarea 6, Paso 7, con su fundamento escrito.

**Una duplicación que el plan corrige de paso.** `parseArsToMinor` ya existe dos veces en el repositorio —exportada en `lib/bookings/space-form.ts:36` y copiada en privado en `app/actions/manual-payment.ts:17`—. Caja habría sido la tercera. La Tarea 8 la unifica en `lib/membership/money.ts`, que ya es de hecho el módulo de dinero compartido. Es una limpieza acotada de código que el plan toca igual, no una refactorización aparte.

**Lo que queda listo al terminar.** SFPR pasa a tener, por primera vez, un libro donde figura lo que cobra: cuotas, alquileres de estudio y lo que se cargue a mano, con arqueo del efectivo y un padrón de clientes que hoy no existe. DNX Estudio queda con la mitad que le sirve y esperando la etapa 1b.
