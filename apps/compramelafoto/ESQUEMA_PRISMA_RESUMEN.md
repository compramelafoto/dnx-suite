# Esquema Prisma - Resumen para ChatGPT

## 📋 Esquema Completo (schema.prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                       Int                       @id @default(autoincrement())
  email                    String                    @unique
  password                 String?
  role                     Role                      @default(PHOTOGRAPHER)
  name                     String?
  createdAt                DateTime                  @default(now())
  // Datos personales
  phone                    String?
  city                     String?
  province                 String?
  country                  String?
  address                  String?
  birthDate                DateTime?
  // Datos de empresa
  companyName              String?
  companyOwner             String?
  cuit                     String?
  companyAddress           String?
  // Redes sociales y contacto
  website                  String?
  instagram                String?
  tiktok                   String?
  facebook                 String?
  whatsapp                 String?
  // Personalización del fotógrafo
  logoUrl                  String?
  primaryColor             String?
  secondaryColor           String?
  tertiaryColor            String?
  handler                  String?                   @unique
  preferredLabId           Int?
  profitMarginPercent      Float?
  defaultDigitalPhotoPrice Int?
  digitalDiscountsEnabled  Boolean                   @default(false)
  digitalDiscount5Plus     Float?
  digitalDiscount10Plus    Float?
  digitalDiscount20Plus    Float?
  isPublicPageEnabled      Boolean                   @default(false)
  publicPageHandler        String?                   @unique
  enableAlbumsPage         Boolean                   @default(false)
  enablePrintPage          Boolean                   @default(false)
  // Integración Mercado Pago OAuth
  mpAccessToken            String?
  mpRefreshToken           String?
  mpUserId                 String?
  mpConnectedAt            DateTime?
  // Tags internos para administración
  tags                     String[]                  @default([])
  lastLoginAt              DateTime?
  isBlocked                Boolean                   @default(false)
  blockedAt                DateTime?
  blockedReason            String?
  // Recuperación de contraseña
  passwordResetToken       String?                   @unique
  passwordResetExpires     DateTime?
  albums                   Album[]
  printOrders              PrintOrder[]              @relation("PhotographerOrders")
  clientOrders             PrintOrder[]              @relation("ClientOrders")
  preferredLab             Lab?                      @relation("PhotographerPreferredLab", fields: [preferredLabId], references: [id])
  lab                      Lab?                      @relation("LabUser")
  uploadedPhotos           Photo[]                   @relation("PhotoUploader")
  removalRequests          RemovalRequest[]
  removalRequestsDecided   RemovalRequest[]          @relation("RemovalRequestDecider")
  adminLogs                AdminLog[]                @relation("AdminLogActor")
  supportTickets           SupportTicket[]           @relation("SupportTicketAssignedTo")
  contactMessages          ContactMessage[]          @relation("ContactMessagePhotographer")
  printOrderStatusHistory  PrintOrderStatusHistory[] @relation("PrintOrderStatusHistoryChangedBy")
  supportMessages          SupportMessage[]          @relation("SupportMessageAuthor")
  termsAcceptances         TermsAcceptance[]         @relation("UserTermsAcceptance")
  messageThreads           AdminMessageThread[]      @relation("UserMessageThreads")
  sentMessages             AdminMessage[]            @relation("MessageSender")
}

model Order {
  id         Int         @id @default(autoincrement())
  albumId    Int
  buyerEmail String
  status     OrderStatus @default(PENDING)
  totalCents Int         @default(0)
  createdAt  DateTime    @default(now())
  album      Album       @relation(fields: [albumId], references: [id])
  items      OrderItem[]

  @@index([albumId])
}

model OrderItem {
  id         Int   @id @default(autoincrement())
  orderId    Int
  photoId    Int
  priceCents Int   @default(0)
  order      Order @relation(fields: [orderId], references: [id])
  photo      Photo @relation(fields: [photoId], references: [id])

  @@unique([orderId, photoId])
  @@index([orderId])
  @@index([photoId])
}

model PrintOrder {
  id                     Int                       @id @default(autoincrement())
  createdAt              DateTime                  @default(now())
  updatedAt              DateTime                  @updatedAt
  labId                  Int                       @default(1)
  photographerId         Int?
  clientId               Int?
  customerName           String?
  customerEmail          String?
  customerPhone          String?
  pickupBy               PickupBy                  @default(CLIENT)
  status                 PrintOrderStatus          @default(CREATED)
  statusUpdatedAt        DateTime                  @default(now())
  currency               String                    @default("ARS")
  total                  Int                       @default(0)
  paymentProvider        String?
  paymentStatus          PrintOrderPaymentStatus   @default(PENDING)
  mpPreferenceId         String?
  mpInitPoint            String?
  mpPaymentId            String?
  tags                   String[]                  @default([])
  orderType              PrintOrderType            @default(PRINT)
  internalNotes          String?                   @db.Text
  platformCommission     Int?
  labCommission          Int?
  photographerCommission Int?
  lab                    Lab                       @relation(fields: [labId], references: [id])
  photographer           User?                     @relation("PhotographerOrders", fields: [photographerId], references: [id])
  client                 User?                     @relation("ClientOrders", fields: [clientId], references: [id])
  items                  PrintOrderItem[]
  supportTickets         SupportTicket[]
  adminLogs              AdminLog[]                @relation("AdminLogPrintOrder")
  statusHistory          PrintOrderStatusHistory[] @relation("PrintOrderStatusHistory")
  paymentSplit           PaymentSplit?             @relation("PaymentSplit")

  @@index([labId])
  @@index([photographerId])
  @@index([clientId])
  @@index([status])
  @@index([paymentStatus])
  @@index([orderType])
  @@index([createdAt])
}

enum Role {
  ADMIN
  PHOTOGRAPHER
  LAB
  LAB_PHOTOGRAPHER
  CUSTOMER
}

enum OrderStatus {
  PENDING
  PAID
  CANCELED
  REFUNDED
}

enum PrintOrderStatus {
  CREATED
  IN_PRODUCTION
  READY
  READY_TO_PICKUP
  SHIPPED
  DELIVERED
  CANCELED
}

enum PrintOrderPaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum PrintOrderType {
  DIGITAL
  PRINT
  COMBO
}

enum PickupBy {
  CLIENT
  PHOTOGRAPHER
}
```

---

## 🔍 Resumen de Estructura: Orders, Users y Roles

### 1. **TABLA `User` (Usuarios)**

**Propósito:** Tabla central que almacena todos los usuarios del sistema (fotógrafos, laboratorios, clientes, admins).

**Campos Clave:**
- `id`: ID único autoincremental
- `email`: Email único (usado para login)
- `password`: Hash de contraseña (nullable para OAuth)
- `role`: Enum `Role` (ADMIN, PHOTOGRAPHER, LAB, LAB_PHOTOGRAPHER, CUSTOMER)
- `name`: Nombre del usuario
- `handler`: Handler único para URLs personalizadas (ej: "juanfoto")
- `preferredLabId`: ID del laboratorio preferido del fotógrafo

**Datos Personales/Empresa:**
- `phone`, `city`, `province`, `country`, `address`, `birthDate`
- `companyName`, `companyOwner`, `cuit`, `companyAddress`

**Redes Sociales:**
- `website`, `instagram`, `tiktok`, `facebook`, `whatsapp`

**Personalización:**
- `logoUrl`, `primaryColor`, `secondaryColor`, `tertiaryColor`
- `isPublicPageEnabled`, `publicPageHandler`

**Mercado Pago OAuth:**
- `mpAccessToken`, `mpRefreshToken`, `mpUserId`, `mpConnectedAt`

**Configuración de Negocio:**
- `profitMarginPercent`: Margen de ganancia del fotógrafo
- `defaultDigitalPhotoPrice`: Precio por defecto de foto digital (pesos)
- `digitalDiscountsEnabled`, `digitalDiscount5Plus`, `digitalDiscount10Plus`, `digitalDiscount20Plus`

**Seguridad/Admin:**
- `tags`: Array de strings para tags internos
- `isBlocked`, `blockedAt`, `blockedReason`
- `passwordResetToken`, `passwordResetExpires`
- `lastLoginAt`

**Relaciones Importantes:**
- `albums`: Álbumes creados por el usuario
- `printOrders`: Pedidos de impresión como fotógrafo (`PhotographerOrders`)
- `clientOrders`: Pedidos de impresión como cliente (`ClientOrders`)
- `preferredLab`: Laboratorio preferido (relación con `Lab`)
- `lab`: Si el usuario es LAB, relación con `Lab`
- `termsAcceptances`: Aceptaciones de Términos y Condiciones
- `messageThreads`: Hilos de mensajería con admin

---

### 2. **TABLA `Order` (Pedidos de Fotos Digitales)**

**Propósito:** Pedidos de fotos digitales desde álbumes de fotógrafos.

**Estructura:**
- `id`: ID único
- `albumId`: ID del álbum (relación con `Album`)
- `buyerEmail`: Email del comprador
- `status`: Enum `OrderStatus` (PENDING, PAID, CANCELED, REFUNDED)
- `totalCents`: Total del pedido en pesos
- `createdAt`: Fecha de creación

**Relaciones:**
- `album`: Relación con `Album`
- `items`: Array de `OrderItem` (fotos individuales compradas)

**Nota:** Esta tabla es para el flujo de venta de fotos digitales desde álbumes. Para pedidos de impresión física, ver `PrintOrder`.

---

### 3. **TABLA `PrintOrder` (Pedidos de Impresión)**

**Propósito:** Pedidos de impresión física de fotos (flujo principal del sistema).

**Campos Clave:**
- `id`: ID único
- `labId`: ID del laboratorio que procesará el pedido (obligatorio, default=1)
- `photographerId`: ID del fotógrafo (opcional, si viene desde galería del fotógrafo)
- `clientId`: ID del cliente autenticado (opcional)
- `customerName`, `customerEmail`, `customerPhone`: Datos del cliente (pueden diferir de `User` si no está autenticado)

**Estado y Entrega:**
- `status`: Enum `PrintOrderStatus` (CREATED, IN_PRODUCTION, READY, READY_TO_PICKUP, SHIPPED, DELIVERED, CANCELED)
- `statusUpdatedAt`: Última actualización de estado
- `pickupBy`: Enum `PickupBy` (CLIENT, PHOTOGRAPHER)

**Pago:**
- `currency`: Moneda (default "ARS")
- `total`: Total en ARS enteros (no centavos)
- `paymentProvider`: Proveedor de pago (ej: "mercadopago")
- `paymentStatus`: Enum `PrintOrderPaymentStatus` (PENDING, PAID, FAILED, REFUNDED)
- `mpPreferenceId`, `mpInitPoint`, `mpPaymentId`: IDs de Mercado Pago

**Tipo de Pedido:**
- `orderType`: Enum `PrintOrderType` (DIGITAL, PRINT, COMBO)

**Comisiones:**
- `platformCommission`: Comisión de la plataforma (ARS enteros)
- `labCommission`: Comisión del laboratorio (ARS enteros)
- `photographerCommission`: Comisión del fotógrafo (ARS enteros)

**Admin:**
- `tags`: Array de strings para tags internos
- `internalNotes`: Notas internas (texto largo)

**Relaciones:**
- `lab`: Relación con `Lab` (obligatoria)
- `photographer`: Relación con `User` como fotógrafo (opcional)
- `client`: Relación con `User` como cliente (opcional)
- `items`: Array de `PrintOrderItem` (fotos individuales con tamaño, acabado, cantidad)
- `statusHistory`: Historial de cambios de estado (`PrintOrderStatusHistory`)
- `paymentSplit`: Split de pago (`PaymentSplit`)
- `supportTickets`: Tickets de soporte relacionados
- `adminLogs`: Logs de auditoría

**Índices:**
- `labId`, `photographerId`, `clientId`
- `status`, `paymentStatus`, `orderType`
- `createdAt`

---

### 4. **ENUM `Role` (Roles del Sistema)**

```prisma
enum Role {
  ADMIN              // Administrador del sistema
  PHOTOGRAPHER       // Fotógrafo (usuario principal)
  LAB                // Laboratorio de impresión
  LAB_PHOTOGRAPHER   // Laboratorio que también es fotógrafo
  CUSTOMER           // Cliente final
}
```

**Uso:**
- El campo `User.role` usa este enum
- Determina permisos y funcionalidades disponibles
- `LAB_PHOTOGRAPHER` es un rol especial que combina LAB + PHOTOGRAPHER

---

### 5. **ENUMs Relacionados con Orders**

**`OrderStatus`** (para pedidos de fotos digitales):
- `PENDING`: Pendiente de pago
- `PAID`: Pagado
- `CANCELED`: Cancelado
- `REFUNDED`: Reembolsado

**`PrintOrderStatus`** (para pedidos de impresión):
- `CREATED`: Creado
- `IN_PRODUCTION`: En producción
- `READY`: Listo
- `READY_TO_PICKUP`: Listo para retirar
- `SHIPPED`: Enviado
- `DELIVERED`: Entregado
- `CANCELED`: Cancelado

**`PrintOrderPaymentStatus`**:
- `PENDING`: Pendiente
- `PAID`: Pagado
- `FAILED`: Fallido
- `REFUNDED`: Reembolsado

**`PrintOrderType`**:
- `DIGITAL`: Solo fotos digitales
- `PRINT`: Solo impresiones
- `COMBO`: Combinación de digital + impresión

**`PickupBy`**:
- `CLIENT`: Cliente retira en laboratorio
- `PHOTOGRAPHER`: Fotógrafo retira y entrega al cliente

---

## 🔗 Relaciones Clave entre Tablas

### User ↔ PrintOrder
- Un `User` puede ser **fotógrafo** de múltiples `PrintOrder` (`photographerId`)
- Un `User` puede ser **cliente** de múltiples `PrintOrder` (`clientId`)
- Un `User` puede tener un `preferredLabId` que apunta a `Lab`

### User ↔ Lab
- Un `User` con `role=LAB` tiene una relación `lab` con `Lab` (uno a uno)
- Un `Lab` tiene un `userId` que apunta a `User` (para autenticación)

### PrintOrder ↔ Lab
- Cada `PrintOrder` tiene un `labId` obligatorio (laboratorio que procesa)

### Order ↔ Album
- Cada `Order` pertenece a un `Album` (`albumId`)
- Los `OrderItem` conectan `Order` con `Photo` (fotos compradas)

---

## 📊 Flujos de Datos

### Flujo 1: Venta de Fotos Digitales
1. `User` (PHOTOGRAPHER) crea `Album`
2. Cliente navega álbum y compra fotos → se crea `Order`
3. `OrderItem` conecta `Order` con `Photo`
4. `Order.status` cambia de PENDING → PAID

### Flujo 2: Pedido de Impresión
1. Cliente sube fotos y configura pedido → se crea `PrintOrder`
2. `PrintOrder.labId` apunta al laboratorio seleccionado
3. Si viene desde galería del fotógrafo, `PrintOrder.photographerId` se establece
4. Se crean `PrintOrderItem` (una por foto con tamaño, acabado, cantidad)
5. `PrintOrder.status` fluye: CREATED → IN_PRODUCTION → READY → DELIVERED
6. Se registra en `PrintOrderStatusHistory` cada cambio
7. Se calcula `PaymentSplit` para distribuir comisiones

---

## 🎯 Puntos Importantes para ChatGPT

1. **`User` es la tabla central**: Todos los usuarios (fotógrafos, labs, clientes, admins) están en `User`, diferenciados por `role`.

2. **Dos tipos de Orders**:
   - `Order`: Para fotos digitales desde álbumes (flujo antiguo/simple)
   - `PrintOrder`: Para impresiones físicas (flujo principal actual)

3. **Roles especiales**:
   - `LAB_PHOTOGRAPHER`: Un laboratorio que también es fotógrafo
   - `LAB`: Solo laboratorio
   - `PHOTOGRAPHER`: Solo fotógrafo

4. **Relación User ↔ Lab**:
   - Un `User` con `role=LAB` tiene `lab` (relación uno a uno con `Lab`)
   - `Lab.userId` apunta al `User` para autenticación
   - Los datos del lab están en `Lab`, pero la autenticación está en `User`

5. **Comisiones**: Se calculan y almacenan en `PrintOrder` (`platformCommission`, `labCommission`, `photographerCommission`) y también en `PaymentSplit`.

6. **Mercado Pago**: Tanto `User` como `Lab` tienen campos para OAuth de Mercado Pago (`mpAccessToken`, `mpUserId`, etc.).

7. **Estados**: Los estados de `PrintOrder` son operativos del laboratorio (CREATED → IN_PRODUCTION → READY → DELIVERED).
