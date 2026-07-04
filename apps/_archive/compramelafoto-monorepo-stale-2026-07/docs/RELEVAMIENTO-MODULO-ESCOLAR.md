# Relevamiento técnico – Módulo de fotografía escolar (Etapa 1)

**Proyecto:** ComprameLaFoto (CLF)  
**Fecha:** Marzo 2025  
**Objetivo:** Preparar la implementación de Etapa 1 del flujo escolar sin romper funcionalidad existente.

---

## A. Resumen ejecutivo

CLF es una plataforma Next.js 16 con App Router, Prisma y PostgreSQL. **No existe el concepto "evento" como entidad de negocio principal**: el núcleo es el **Album**. Existe un modelo `Event` (eventos georeferenciados de organizadores) y `Album.eventId` opcional, pero el flujo de venta gira alrededor del álbum.

**Lo que ya está listo para Etapa 1:**
- `EventType.SCHOOL` existe en el schema.
- Pre-venta PRO: catálogo (`AlbumProduct`), pedido (`PreCompraOrder`), subjects, selfies (`SubjectSelfie`), flujo `/album/[slug]/preventa` → `/order/[id]/selfies`.
- Ocultas hasta selfie: `hiddenPhotosEnabled`, Rekognition, `HiddenAlbumGrant`, cookie `hidden_album_grant`.
- Productos por álbum (`AlbumProduct`), link público por `publicSlug`, acceso restringido (`AlbumAccess`, `isHidden`).

**Lo que falta:**
- Entidad Escuela / School.
- Cursos/divisiones.
- Link privado específico escolar (hoy se usa `publicSlug` o `AlbumSlugAlias`).
- Datos del adulto y alumno en pedido (nombre, apellido, curso, división).
- Pago integrado para PreCompraOrder (hoy solo CREATED, sin MP).
- Matching facial para pre-venta (SubjectSelfie vs PhotoFace).

**Recomendación:** Opción B – Crear entidad `School` y vincular Albums existentes. Menor impacto, reutiliza álbum y pre-venta.

---

## B. Estado actual del proyecto

### 1. ESTRUCTURA GENERAL

| Aspecto | Valor |
|---------|-------|
| Framework | Next.js 16.1.1 (Turbopack) |
| React | 19.x |
| Router | App Router (`app/`) |
| ORM | Prisma 6.19.1 |
| Base de datos | PostgreSQL (Neon) |
| Auth | Cookie `auth-token` (base64), HttpOnly, 7 días |
| Roles | `ADMIN`, `PHOTOGRAPHER`, `LAB`, `CUSTOMER`, `LAB_PHOTOGRAPHER`, `ORGANIZER` |

**Estructura de carpetas:**
```
app/
├── api/                    # API Routes (~261 route.ts)
├── admin/                  # Panel admin
├── fotografo/              # Panel fotógrafo
├── lab/                    # Panel laboratorio
├── organizador/            # Panel organizador (eventos)
├── dashboard/              # Dashboard compartido (álbumes)
├── a/[id]/                 # Vista cliente álbum (por publicSlug)
├── album/[slug]/           # Pre-venta (preventa, precompra)
├── order/[id]/             # Pedido pre-venta (selfies)
├── pago/                   # Success/failure/pending MP
└── ...
components/
lib/
prisma/
contexts/
config/
```

**Ubicaciones clave:**
- Modelos: `prisma/schema.prisma`
- Rutas API: `app/api/**/route.ts`
- Panel fotógrafo: `app/fotografo/`, `app/dashboard/`
- Panel admin: `app/admin/`
- Páginas públicas álbum: `app/a/[id]/`, `app/album/[slug]/`
- Auth: `lib/auth.ts`
- Login APIs: `app/api/auth/login/route.ts`, `app/api/auth/google/route.ts`

---

## C. Hallazgos por módulo

### 2. MODELO ACTUAL DE ÁLBUMES

**Modelo:** `Album` (`prisma/schema.prisma` líneas 287–384)

**Campos relevantes:**
- `id`, `userId`, `title`, `location`, `eventDate`, `publicSlug` (único)
- `creatorId`, `eventId`, `type` (EventType?)
- `isPublic` (default true), `isHidden` (default false)
- `hiddenPhotosEnabled`, `hiddenSelfieRetentionDays`
- `preCompraCloseAt`, `requireClientApproval`
- `expiresAt`, `deletedAt`

**Relaciones:**
- `user`, `creator`, `event`, `photos`, `orders`, `preCompraProducts`, `preCompraOrders`, `subjects`
- `hiddenAlbumAttempts`, `hiddenAlbumGrants`, `slugAliases`, `accesses`, `salesSettings`

**Privacidad:**
- `isPublic && !isHidden` → público
- `AlbumAccess` para acceso explícito por usuario
- `lib/album-helpers.ts` → `isAlbumPubliclyAccessible()`

**Link privado:**
- Público: `/a/[publicSlug]` (ej. `/a/mi-evento-2024`)
- Alias: `AlbumSlugAlias` (`aliasSlug` → `targetAlbumId`), redirección 301
- Pre-venta: `/album/[slug]/preventa` (usa `publicSlug` del álbum)
- Invitación: `AlbumInvitation` con `tokenHash`

**¿Álbum reutilizable para escolar?** Sí. El álbum ya soporta `type = SCHOOL`, `preCompraCloseAt`, `AlbumProduct`, `Subject`, `PreCompraOrder`. Conviene agregar una capa `School` que agrupe álbumes y cursos, sin modificar el núcleo de Album.

---

### 3. FUNCIONALIDAD "OCULTAS HASTA SELFIE"

**Ubicación:**
- Modelo: `Album.hiddenPhotosEnabled`, `Album.hiddenSelfieRetentionDays`
- API selfie: `app/api/albums/[id]/hidden/selfie/route.ts`
- Check grant: `app/api/albums/[id]/hidden/check-grant/route.ts`
- Validación foto: `app/api/photos/[id]/view/route.ts` (líneas 224–235)
- Helpers: `lib/hidden-album-audit.ts`, `lib/faces/rekognition.ts`

**Activación:**
- Dashboard álbum → PATCH `app/api/dashboard/albums/[id]/route.ts`
- Body: `hiddenPhotosEnabled`, `hiddenSelfieRetentionDays`

**Flujo:**
1. Cliente entra a álbum con `hiddenPhotosEnabled = true`
2. Sin grant → mensaje para subir selfie
3. POST `/api/albums/[id]/hidden/selfie` con FormData (`selfie` o `file`) o JSON `imageUrl`
4. Rate limit: `lib/rate-limit.ts` (ej. 15/min por IP)
5. Detección: `lib/faces/rekognition.ts` → `detectFaceCount()`, `searchFacesByImage()`
6. Resultados: `NO_FACE`, `MULTIPLE_FACES`, `MATCH_FOUND`, `NO_MATCH`, `RATE_LIMITED`, `ERROR`
7. Si `MATCH_FOUND` → `HiddenAlbumAttempt` + `HiddenAlbumGrant`
8. Cookie `hidden_album_grant` (30 min) con `allowedPhotoIds`
9. Opcional: selfie en R2 si `hiddenSelfieRetentionDays > 0`

**Dependencias:**
- `@aws-sdk/client-rekognition`
- `lib/r2-client.ts`
- `HIDDEN_ALBUM_GRANT_SECRET` o `CRON_SECRET`

**Reutilización en escolar:**
- Sí. Un álbum escolar puede tener `hiddenPhotosEnabled = true`.
- No exige datos previos del cliente (solo selfie).
- Convive con pre-venta: el flujo pre-venta (`SubjectSelfie`) es distinto al de ocultas (`HiddenAlbumGrant`). Son dos pipelines: uno para matching con subjects, otro para ver fotos ocultas. En escolar se puede usar ambos.

**Archivos clave:**
- `app/api/albums/[id]/hidden/selfie/route.ts`
- `app/api/albums/[id]/hidden/check-grant/route.ts`
- `app/api/photos/[id]/view/route.ts`
- `lib/faces/rekognition.ts`
- `lib/hidden-album-audit.ts`
- `components/photo/ClientAlbumView.tsx` (UI selfie)

---

### 4. SISTEMA DE PRODUCTOS / CATÁLOGO / PRECIOS

**Productos por álbum (pre-venta):**
- Modelo: `AlbumProduct` (`prisma/schema.prisma` 826–848)
- Campos: `albumId`, `name`, `description`, `price`, `mockupUrl`, `minFotos`, `maxFotos`, `requiresDesign`, `suggestionText`, `defaultTemplateId`
- API: `app/api/dashboard/albums/[id]/precompra-products/route.ts` (GET, POST)
- Catálogo público: `app/api/public/album/[slug]/precompra/route.ts`

**Productos fotógrafo:**
- Modelo: `PhotographerProduct`
- API: `app/api/fotografo/products/route.ts`

**Productos laboratorio:**
- Modelos: `LabProduct`, `LabBasePrice`, `LabSizeDiscount`
- API: `app/api/lab/products/route.ts`, `app/api/lab/pricing/route.ts`

**Asociación álbum–productos:**
- `Album.preCompraProducts` → `AlbumProduct[]`
- Solo visible si `preCompraCloseAt` está definido y no expiró

**Compra desde álbum:**
- Clásico: `/a/[id]/comprar` → `POST /api/a/[id]/orders` (Order + OrderItem)
- Pre-venta: `/album/[slug]/preventa` → `POST /api/precompra/order` (PreCompraOrder)

**Catálogo visual:**
- `app/album/[slug]/preventa/page.tsx` muestra productos con mockup, descripción, precio, selector de cantidad

---

### 5. CHECKOUT Y PEDIDOS ACTUALES

**Flujo compra álbum (Order):**
1. `/a/[id]/comprar` → selección fotos
2. `/a/[id]/comprar/resumen` → resumen + datos (buyerName, buyerEmail, buyerPhone)
3. `POST /api/a/[id]/orders` → crea `Order`
4. Si hay ítems impresos → crea `PrintOrder` con `customerName`, `customerEmail`, `customerPhone`
5. `POST /api/payments/mp/create-preference` (orderType: ALBUM_ORDER)
6. Redirección a MP
7. Webhook/confirm → Order.status = PAID

**Flujo pre-venta (PreCompraOrder):**
1. `/album/[slug]/preventa` → catálogo
2. `POST /api/precompra/order` → crea `PreCompraOrder` (status CREATED)
3. Redirige a `/order/[id]/selfies`
4. Sin pago implementado

**Modelos:**
- `Order`: `albumId`, `buyerEmail`, `buyerUserId`, `status`, `totalCents`, `pricingSnapshot` (JSON)
- `Order` NO tiene buyerName ni buyerPhone en schema; se pasan a `PrintOrder` al crear
- `PreCompraOrder`: `albumId`, `buyerEmail`, `buyerUserId`, `status`, `totalCents`
- `PreCompraOrder` NO tiene buyerName, buyerPhone, ni datos del alumno

**OrderItem:** `orderId`, `photoId`, `priceCents`, `productType`, `quantity`, `size`, `finish`, `material`  
**PreCompraOrderItem:** `orderId`, `albumProductId`, `subjectId`, `status`, `approvalProof`, `priceCents`

**Subject:** `albumId`, `label` (ej. "Gime"), `createdByOrderId` – solo nombre del niño, sin apellido, curso ni división

**Extensibilidad:**
- `Order.pricingSnapshot` (JSON) – metadata de pricing
- No hay `metadata` ni `customFields` en Order/PreCompraOrder
- Para datos escolares: habría que agregar campos o tabla nueva (ej. `PreCompraOrderSchoolData`)

---

### 6. PAGOS Y MERCADO PAGO

**Crear preferencia:**
- API: `app/api/payments/mp/create-preference/route.ts`
- Lib: `lib/mercadopago.ts` → `createPreference()`
- Parámetros: `title`, `total`, `marketplaceFee`, `externalReference`, `metadata`
- Tipos: `PRINT_ORDER`, `ALBUM_ORDER` (PreCompraOrder no tiene tipo aún)

**Webhook:**
- Ruta: `app/api/payments/mp/webhook/route.ts`
- Query: `orderId`, `orderType`
- Proceso: obtiene pago en MP, actualiza Order/PrintOrder, comisiones, referidos, emails

**Confirmación:**
- API: `app/api/payments/mp/confirm/route.ts`
- Páginas: `app/pago/success/`, `app/pago/failure/`, `app/pago/pending/`

**Split:**
- `marketplace_fee` en preferencia (2 partes: vendedor + marketplace)
- `PaymentSplit` para PrintOrder (platformAmount, labAmount, photographerAmount)
- No hay split a terceros (ej. escuela) en MP

**OAuth:**
- `app/api/mercadopago/oauth/connect/route.ts`
- `app/api/mercadopago/oauth/callback/route.ts`
- User/Lab: `mpAccessToken`, `mpRefreshToken`, `mpUserId`, `mpConnectedAt`

**Etapa 1:** El sistema actual sirve para Order y PrintOrder. PreCompraOrder no tiene integración MP; habría que agregar un flujo similar (crear preferencia tras confirmar pre-venta, webhook que actualice PreCompraOrder a PAID_HELD).

---

### 7. PANEL FOTÓGRAFO / ADMIN

**Fotógrafo:**
- Rutas: `/fotografo/dashboard`, `/fotografo/pedidos`, `/dashboard/albums`, `/fotografo/clientes`, `/fotografo/configuracion`, etc.
- Nav: `config/navigation.ts` → `getPhotographerSidebarItems()`

**Admin:**
- Layout: `components/admin/AdminLayout.tsx`
- Rutas: `/admin`, `/admin/pedidos`, `/admin/albums`, `/admin/plantillas`, `/admin/usuarios`, `/admin/laboratorios`, etc.

**Álbumes:**
- Listado: `app/dashboard/albums/page.tsx`
- Detalle: `app/dashboard/albums/[id]/page.tsx`
- API: `app/api/dashboard/albums/[id]/route.ts` (GET, PATCH)
- Productos pre-venta: `app/api/dashboard/albums/[id]/precompra-products/route.ts`

**Capacidades actuales:**
- Crear álbumes: sí
- Configurar privacidad (isPublic, isHidden, hiddenPhotosEnabled): sí
- Asociar productos pre-venta: sí (CRUD)
- Ver pedidos por álbum: sí (Order, PreCompraOrder)
- Ver clientes: sí
- Exportar pedidos: sí (fotógrafo)
- Cargar fotos: sí (upload por álbum)

---

## D. Qué ya está listo para usar

| Funcionalidad | Estado | Ubicación |
|---------------|--------|-----------|
| `EventType.SCHOOL` | Existe | `prisma/schema.prisma` |
| Catálogo pre-venta | Funcional | `AlbumProduct`, `/album/[slug]/preventa` |
| Pedido pre-venta | Funcional (sin pago) | `PreCompraOrder`, `POST /api/precompra/order` |
| Subjects + selfies | Funcional | `Subject`, `SubjectSelfie`, `/order/[id]/selfies` |
| Ocultas hasta selfie | Funcional | `hiddenPhotosEnabled`, Rekognition, `HiddenAlbumGrant` |
| Link público álbum | Funcional | `publicSlug`, `/a/[id]`, `AlbumSlugAlias` |
| Productos por álbum | Funcional | `AlbumProduct`, CRUD en dashboard |
| Pago MP (Order) | Funcional | `createPreference`, webhook, confirm |
| Panel fotógrafo | Funcional | `/dashboard/albums`, `/fotografo/*` |

---

## E. Qué falta crear

| Funcionalidad | Descripción |
|---------------|-------------|
| Entidad School | Escuela con nombre, datos de contacto |
| Cursos/divisiones | SchoolCourse o equivalente (curso, división) |
| Asociación School–Album | Vincular uno o más álbumes a una escuela |
| Link privado escolar | Slug/token específico o reutilizar `AlbumSlugAlias` |
| Datos adulto en PreCompraOrder | buyerName, buyerPhone (hoy solo buyerEmail) |
| Datos alumno | nombre, apellido, curso, división (Subject solo tiene `label`) |
| Dropdown curso/división | UI + datos maestros |
| Pago PreCompraOrder | Integración MP para pre-venta |
| Matching facial pre-venta | SubjectSelfie → PhotoFace → FaceMatch (pendiente según PRE-COMPRA-PRO.md) |
| Listado pedidos escolares | Vista filtrada por escuela/álbum escolar |

---

## F. Qué conviene reutilizar

| Componente | Uso en Etapa 1 |
|------------|----------------|
| `Album` | Base del álbum escolar (type=SCHOOL) |
| `AlbumProduct` | Packs escolares |
| `PreCompraOrder` / `PreCompraOrderItem` | Pedidos (extender con datos escolares) |
| `Subject` | Alumno (extender con apellido, curso, división) |
| `/album/[slug]/preventa` | Catálogo (adaptar slug si hay link privado) |
| `/order/[id]/selfies` | Subida selfies |
| `hiddenPhotosEnabled` + Rekognition | Ver fotos tras selfie |
| `createPreference` + webhook | Pago (cuando se implemente para pre-venta) |
| `app/dashboard/albums/[id]/page.tsx` | Config álbum (agregar sección escolar) |
| `ClientAlbumView` | Vista álbum con selfie |

---

## G. Qué conviene evitar tocar

| Área | Motivo |
|------|--------|
| `Order` / `OrderItem` | Flujo clásico de compra con fotos; no mezclar con pre-venta |
| `PrintOrder` | Usado para impresiones; no extender para pre-venta |
| `lib/auth.ts` | Auth central; no modificar |
| `lib/mercadopago.ts` | Solo agregar llamadas para PreCompraOrder, no cambiar firma |
| `Event` / `EventMember` | Flujo organizador; distinto al escolar |
| `Album` núcleo | No cambiar campos críticos; usar relaciones nuevas |

---

## H. Recomendación de arquitectura para Etapa 1

### Evaluación de opciones

**OPCIÓN A – Extender Album con tipo = escolar**
- Ventajas: Sin nuevas tablas, `type=SCHOOL` ya existe.
- Desventajas: Mezcla lógica escolar en Album; cursos/divisiones no tienen dónde vivir; difícil escalar.
- Impacto: Bajo en código, alto en acoplamiento.
- Riesgo: Medio (confusión entre álbum común y escolar).
- Escalabilidad: Baja.

**OPCIÓN B – Crear entidad School y vincular Albums**
- Ventajas: School como contenedor; álbumes existentes se vinculan; cursos en School; link privado puede ser slug de School o alias.
- Desventajas: Nueva tabla y relaciones.
- Impacto: Medio (migración, APIs nuevas).
- Riesgo: Bajo (no toca Album).
- Escalabilidad: Alta.

**OPCIÓN C – Capa SchoolProject / SchoolAlbum**
- Ventajas: Separación total.
- Desventajas: Duplicación de concepto; SchoolAlbum vs Album genera confusión.
- Impacto: Alto.
- Riesgo: Medio.
- Escalabilidad: Alta pero con complejidad innecesaria.

### Recomendación: OPCIÓN B

Crear `School` y vincular álbumes. Estructura propuesta:

```
School (id, name, ...)
  └── SchoolAlbum (schoolId, albumId)  // N:M
  └── SchoolCourse (schoolId, name, division?)  // ej. "1ro", "A"

PreCompraOrder
  └── PreCompraOrderSchoolData (orderId, parentName, parentPhone, ...)  // opcional: JSON en Order

Subject
  └── Extender: lastName?, schoolCourseId?  // o JSON metadata
```

Link privado: usar `AlbumSlugAlias` con un slug único por escuela (ej. `escuela-x-2025`) que apunte al álbum, o agregar `School.privateSlug` que resuelva al álbum activo.

---

## I. Datos que deberían existir para Etapa 1

| Entidad/Campo | Descripción |
|---------------|-------------|
| `School` | id, name, slug?, privateSlug?, contactEmail?, contactPhone?, createdAt |
| `SchoolCourse` | id, schoolId, name (ej. "1ro"), division (ej. "A"), createdAt |
| `SchoolAlbum` | id, schoolId, albumId, isActive, createdAt (opcional si se usa album.schoolId directo) |
| `PreCompraOrder`: buyerName, buyerPhone | Extender modelo actual |
| `Subject`: lastName, schoolCourseId | Extender para alumno |
| O `PreCompraOrderSchoolData` | orderId, parentName, parentEmail, parentPhone, studentFirstName, studentLastName, schoolCourseId (alternativa a extender Subject) |

---

## J. UI/UX reutilizable vs nuevo

| Pantalla/Funcionalidad | Reutilizar | Nuevo |
|------------------------|------------|-------|
| Crear álbum escolar | Sí (dashboard álbum + type=SCHOOL) | Sección "Vincular a escuela" |
| Subir fotos | Sí | No |
| Link privado | Sí (AlbumSlugAlias o School.privateSlug) | UI para generar/copiar link |
| Catálogo pre-venta | Sí (`/album/[slug]/preventa`) | Adaptar slug si es por escuela |
| Checkout pre-venta | Parcial (falta datos adulto/alumno) | Formulario extendido |
| Selfies | Sí (`/order/[id]/selfies`) | Dropdown curso/división en Subject |
| Listado pedidos | Sí (filtro por álbum) | Filtro por escuela, export escolar |

---

## K. Limitaciones y riesgos

**Lo que está bien:**
- Pre-venta y ocultas hasta selfie están implementados y funcionando.
- AlbumProduct, Subject, PreCompraOrder tienen buena base.
- MP integrado para Order/PrintOrder.
- Panel fotógrafo completo.

**Acoplamiento/fragilidad:**
- `Order` y `PrintOrder` están acoplados en el flujo de álbum clásico.
- PreCompraOrder no tiene pago; status PAID_HELD existe pero sin flujo.
- Subject solo tiene `label`; curso/división no existen.
- Matching facial pre-venta no implementado (solo ocultas).

**Complicaciones para Etapa 1:**
- Si se fuerza lógica escolar en álbumes comunes, puede confundirse type y flujos.
- PreCompraOrder solo pide buyerEmail en preventa; habría que pedir más datos antes de crear el pedido o en un paso posterior.

**Deuda técnica:**
- PRE-COMPRA-PRO.md indica varios pendientes (matching, selector, editor, etc.).
- `docs/PRE-COMPRA-PRO.md` es la referencia del estado de pre-venta.

**Bugs potenciales:**
- Mezclar flujo clásico (Order) con pre-venta (PreCompraOrder) en las mismas pantallas.
- Si Subject se extiende sin migración cuidadosa, datos existentes podrían quedar inconsistentes.

---

## L. Lista de archivos clave a revisar

| Módulo | Archivos |
|--------|----------|
| Schema | `prisma/schema.prisma` |
| Álbum | `lib/album-helpers.ts`, `app/api/dashboard/albums/[id]/route.ts` |
| Ocultas selfie | `app/api/albums/[id]/hidden/selfie/route.ts`, `lib/faces/rekognition.ts`, `components/photo/ClientAlbumView.tsx` |
| Pre-venta | `app/album/[slug]/preventa/page.tsx`, `app/order/[id]/selfies/page.tsx`, `app/api/precompra/order/route.ts` |
| Productos | `app/api/dashboard/albums/[id]/precompra-products/route.ts`, `app/api/public/album/[slug]/precompra/route.ts` |
| Pedidos álbum | `app/api/a/[id]/orders/route.ts` |
| MP | `lib/mercadopago.ts`, `app/api/payments/mp/create-preference/route.ts`, `app/api/payments/mp/webhook/route.ts` |
| Dashboard | `app/dashboard/albums/page.tsx`, `app/dashboard/albums/[id]/page.tsx` |
| Docs | `docs/PRE-COMPRA-PRO.md` |

---

## M. Plan técnico sugerido para implementar luego

1. **Migración School + SchoolCourse**
   - Crear modelos y migración.
   - CRUD básico de escuelas y cursos (admin o fotógrafo).

2. **Vinculación School–Album**
   - Tabla `SchoolAlbum` o `album.schoolId` opcional.
   - En dashboard álbum: selector "Vincular a escuela" si type=SCHOOL.

3. **Link privado**
   - Generar `AlbumSlugAlias` o slug en School.
   - UI para copiar link.

4. **Extender PreCompraOrder y Subject**
   - `buyerName`, `buyerPhone` en PreCompraOrder.
   - `lastName`, `schoolCourseId` en Subject (o tabla auxiliar).

5. **Formulario preventa**
   - En `/album/[slug]/preventa` o paso previo: datos adulto + alumno + curso/división.
   - Dropdown de cursos cargados desde SchoolCourse.

6. **Pago PreCompraOrder**
   - Tras confirmar pre-venta, crear preferencia MP.
   - Webhook/confirm para PreCompraOrder (nuevo orderType).
   - Actualizar status a PAID_HELD.

7. **Vista pedidos escolares**
   - Filtro por escuela/álbum escolar en panel fotógrafo.
   - Export con datos de adulto y alumno.

8. **Opcional: matching facial**
   - Seguir PRE-COMPRA-PRO.md para SubjectSelfie → PhotoFace → FaceMatch.
   - Reutilizar `lib/faces/rekognition.ts`.
