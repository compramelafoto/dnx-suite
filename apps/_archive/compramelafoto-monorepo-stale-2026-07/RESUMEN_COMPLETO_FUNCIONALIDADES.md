# 📋 RESUMEN COMPLETO DE FUNCIONALIDADES - ComprameLaFoto

> **⚠️ ACLARACIÓN IMPORTANTE:** 
> 
> Este documento describe las funcionalidades **YA IMPLEMENTADAS Y FUNCIONANDO** en el código actual de la plataforma. 
> 
> **Símbolos utilizados:**
> - ✅ = Funcionalidad **COMPLETAMENTE IMPLEMENTADA** y funcionando
> - ⚠️ = Funcionalidad **PARCIALMENTE IMPLEMENTADA** (falta algo)
> - ⏳ = Funcionalidad **PENDIENTE** (no implementada aún)
> - ❌ = Funcionalidad **NO IMPLEMENTADA**
> 
> Todas las funcionalidades marcadas con ✅ están en el código y funcionando. Las marcadas con ⏳ o ❌ están pendientes de implementar.

## 🎯 DESCRIPCIÓN GENERAL DEL PROYECTO

**ComprameLaFoto** es una plataforma completa de gestión fotográfica que conecta tres tipos de usuarios principales:
- **Fotógrafos**: Crean álbumes, venden fotos digitales e impresas, gestionan clientes
- **Clientes**: Compran fotos digitales, imprimen sus propias fotos, visualizan álbumes
- **Laboratorios**: Procesan pedidos de impresión, gestionan precios y productos, atienden clientes

**Tecnologías principales:**
- Next.js 16.1.1 (App Router)
- React 19.2.3
- Prisma ORM con PostgreSQL
- TypeScript
- Tailwind CSS
- Mercado Pago (integración OAuth y pagos)

---

## 🔐 SISTEMA DE AUTENTICACIÓN Y ROLES

### Roles Disponibles:
1. **ADMIN** - Administradores del sistema
2. **PHOTOGRAPHER** - Fotógrafos profesionales
3. **LAB** - Laboratorios de impresión (requiere aprobación admin)
4. **LAB_PHOTOGRAPHER** - Usuarios que son laboratorio Y fotógrafo
5. **CUSTOMER** - Clientes finales

### Funcionalidades de Autenticación:
- ✅ Login con email/password para todos los roles
- ✅ Google OAuth para fotógrafos y clientes
- ✅ Registro específico por rol con validaciones
- ✅ Recuperación de contraseña (forgot-password, reset-password)
- ✅ Cookies httpOnly para seguridad
- ✅ Verificación de roles en todas las rutas protegidas
- ✅ Redirección automática al dashboard según rol al iniciar sesión:
  - ADMIN → `/admin`
  - PHOTOGRAPHER → `/fotografo/dashboard`
  - LAB → `/lab/dashboard`
  - CUSTOMER → `/cliente/dashboard`

### Endpoints de Autenticación:
- `POST /api/auth/login` - Login universal
- `POST /api/auth/register` - Registro cliente (CUSTOMER)
- `POST /api/auth/register-photographer` - Registro fotógrafo
- `POST /api/auth/register-lab` - Registro laboratorio (crea User + Lab)
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/google` - Iniciar OAuth Google
- `GET /api/auth/google/callback` - Callback OAuth
- `POST /api/auth/forgot-password` - Solicitar reset de contraseña
- `POST /api/auth/reset-password` - Resetear contraseña con token
- `GET /api/auth/me` - Obtener usuario autenticado actual

---

## 📸 PANEL DEL FOTÓGRAFO

### 1. Dashboard Principal (`/fotografo/dashboard`)

#### Solapas Disponibles:
- **💰 Ventas**: Estadísticas y historial de ventas
- **📸 Álbumes**: Lista de álbumes con contadores
- **👥 Interesados**: Lista de personas interesadas en álbumes
- **📦 Pedidos**: Pedidos de impresión asociados

#### Funcionalidades del Dashboard:
- ✅ Estadísticas en tiempo real:
  - Total de ventas (ARS)
  - Ventas digitales (ARS)
  - Ventas de impresión (ARS)
  - Álbumes activos / Total de álbumes
- ✅ Historial de ventas agrupado por fecha
- ✅ Lista de álbumes con estado (ACTIVE, EXPIRED_CLIENT, EXPIRED_LAB)
- ✅ Lista de pedidos de impresión con información del laboratorio
- ✅ **Lista de Interesados** con información completa:
  - Nombre completo (nombre + apellido)
  - WhatsApp (si está disponible)
  - Email
  - Nombre del álbum en el que está interesado
  - Fecha de interés
  - **Botón de WhatsApp** para enviar mensaje automático: "Hola [nombre], ¿tu álbum '[nombre del álbum]' está listo?"
- ✅ Botones de navegación:
  - "Ir a Negocio" → `/fotografo/negocio`
  - "Álbums" → `/dashboard/albums`

### 2. Gestión de Álbumes (`/dashboard/albums`)

#### Creación y Edición de Álbumes:
- ✅ Modal de creación con 2 solapas:
  - **Solapa Datos**: Título, ubicación, fecha del evento
  - **Solapa Precios**: Configuración completa de venta
- ✅ Configuración de tipos de venta:
  - Habilitar/deshabilitar venta de fotos impresas
  - Habilitar/deshabilitar venta de fotos digitales
  - Opción: incluir archivo digital con compra de impresión
- ✅ Configuración de impresiones:
  - Selección de laboratorio específico por álbum
  - Margen de ganancia específico por álbum (sin límite)
  - Método de retiro: CLIENT (en laboratorio) o PHOTOGRAPHER (entrega)
- ✅ Precios digitales:
  - Precio por foto digital configurable por álbum
  - Descuentos por cantidad (5+, 10+, 20+ fotos)
- ✅ Vista de lista con:
  - Preview de portada (primera foto automática)
  - Título, ubicación, fecha
  - Contador de fotos
  - Botón de visualización (icono de ojito) para ver como cliente
  - Botón "Ver Álbum" para editar

#### Gestión de Fotos (`/dashboard/albums/[id]`):
- ✅ Subida de fotos con drag & drop
- ✅ Aplicación automática de marca de agua en previews
- ✅ Grid responsive de fotos
- ✅ Selección de foto de portada
- ✅ Eliminación de fotos individuales
- ✅ Link "Vista del cliente" con preview
- ✅ Botón "Copiar enlace" para compartir
- ✅ Primera foto subida se establece automáticamente como portada

#### Expiración y Reactivación de Álbumes:
- ✅ Eliminación automática: 30 días desde la primera foto subida (no desde creación)
- ✅ Archivos originales permanecen 15 días adicionales para impresión
- ✅ Reactivación disponible por 15 días adicionales después de los 30 días
- ✅ Visualización de fecha de eliminación solo si el álbum tiene fotos
- ✅ Estado `isHidden` para ocultar sin eliminar

### 3. Panel de Configuración (`/fotografo/configuracion`)

#### Solapa: Datos Personales
- ✅ Email (solo lectura)
- ✅ Nombre completo, teléfono
- ✅ Ciudad, provincia, país, domicilio
- ✅ Fecha de nacimiento
- ✅ Datos de empresa: nombre, titular, CUIT, domicilio

#### Solapa: Diseño y Página Pública
- ✅ Carga de logo PNG (preview incluido)
- ✅ Color principal (picker + input hex)
- ✅ Color secundario (picker + input hex)
- ✅ **Color terciario/accent** (picker + input hex) - Para botones, bordes y recuadros
- ✅ Habilitar/deshabilitar página pública
- ✅ Handler personalizado (URL amigable, validación: solo letras minúsculas, números y guiones)
- ✅ **Habilitar sección "Mis Álbumes"** - Muestra galería de álbumes en página pública
- ✅ **Habilitar sección "Imprimir"** - Muestra botón para imprimir fotos propias
- ✅ Generación de código QR para compartir
- ✅ Vista previa de URL completa
- ✅ Botón "Ver mi página" (con validación de configuración completa)

#### Solapa: Laboratorio y Márgenes
- ✅ Selección de laboratorio preferido (búsqueda en tiempo real)
- ✅ Modal "Ver precios" del laboratorio con:
  - Datos completos del laboratorio
  - Tabla de precios base por tamaño
  - Tabla de descuentos por cantidad
- ✅ Margen de ganancia configurable (0-100%+)
- ✅ **Calculadora de costos y ganancias**:
  - **Para Fotos Impresas**: Selector de tamaño y cantidad, desglose completo (costo base, descuentos, comisión, margen, totales)
  - **Para Fotos Digitales**: Input de precio, validación de mínimo, desglose (precio, comisión, ganancia neta)

#### Solapa: Clientes
- ✅ Tabla de clientes históricos con:
  - Nombre, Email, Teléfono
  - Primera compra, Última compra
  - Total de pedidos, Total gastado
- ✅ Búsqueda en tiempo real por cualquier campo
- ✅ Exportación a CSV
- ✅ **Botones de acción**:
  - **WhatsApp** (icono verde) - Visible solo si el cliente tiene teléfono
  - **Editar** (icono de lápiz) - Edición inline de nombre y teléfono (email no editable)
  - **Eliminar** (icono de basura) - Elimina registros de notificaciones y pedidos "fantasma"
- ✅ Agrupación automática por email/teléfono
- ✅ Cálculo automático de totales

#### Solapa: Pedidos
- ✅ Listado de pedidos del fotógrafo
- ✅ Información detallada por pedido
- ✅ Filtros y búsqueda

### 4. Panel de Negocio (`/fotografo/negocio`)
- ✅ Vista consolidada de negocio
- ✅ Estadísticas y métricas

### 5. Otras Páginas del Fotógrafo:
- ✅ `/fotografo/pedidos` - Gestión de pedidos
- ✅ `/fotografo/clientes` - Gestión de clientes
- ✅ `/fotografo/remociones` - Solicitudes de remoción de fotos
- ✅ `/fotografo/soporte` - Sistema de soporte

---

## 👤 PANEL DEL CLIENTE

### Dashboard (`/cliente/dashboard`)
- ✅ Vista principal del cliente
- ✅ Acceso rápido a pedidos

### Pedidos (`/cliente/pedidos`)
- ✅ Listado de pedidos del cliente autenticado
- ✅ Información de cada pedido:
  - Número de pedido
  - Fecha
  - Estado
  - Total
  - Cantidad de items
- ✅ Link para crear nuevo pedido
- ✅ Logout

### Soporte (`/cliente/soporte`)
- ✅ Sistema de tickets de soporte

---

## 🏭 PANEL DEL LABORATORIO

### Dashboard Principal (`/lab/dashboard`)
- ✅ Vista principal con estadísticas
- ✅ Acceso rápido a funcionalidades principales

### Panel de Configuración (`/lab/configuracion`)

#### Solapa: Pedidos
- ✅ Listado de todos los pedidos (últimos 200)
- ✅ Filtrado por estado (7 estados: Creado, En producción, Listo para retirar, Enviado, Entregado, Cancelado, Todos)
- ✅ Búsqueda en tiempo real (cliente, email, WhatsApp, fecha, total, items)
- ✅ Selección múltiple de pedidos (checkbox)
- ✅ Cambio de estado masivo para pedidos seleccionados
- ✅ Información completa: ID, cliente, email, WhatsApp, fotógrafo, retira, fechas, items, total
- ✅ Botón "Descargar ZIP" por pedido (export de imágenes)
- ✅ Contador de pedidos visibles/totales
- ✅ Botón "Limpiar" para resetear filtros

#### Solapa: Clientes
- ✅ Tabla de clientes históricos con búsqueda
- ✅ Exportación a CSV
- ✅ **Botones de acción**:
  - **WhatsApp** (icono verde) - Visible solo si el cliente tiene teléfono
  - **Editar** (icono de lápiz) - Edición inline de nombre y teléfono
  - **Eliminar** (icono de basura) - Elimina pedidos "fantasma"
- ✅ Agrupación automática
- ✅ Cálculo automático de totales

#### Solapa: Precios
- ✅ Configuración de precios base por tamaño (10x15, 13x18, 15x20, etc.)
- ✅ Configuración de descuentos por cantidad (50+, 100+)
- ✅ Tabla editable con guardar/recargar
- ✅ Mensajes explicativos

#### Solapa: Productos
- ✅ Gestión de productos con dos precios:
  - Precio Mayorista (Fotógrafo)
  - Precio Retail (Cliente Final)
- ✅ Campos: nombre, tamaño, precios, estado (Activo/Inactivo)
- ✅ Agregar/eliminar productos
- ✅ Validación de campos

#### Solapa: Diseño
- ✅ Carga de logo PNG
- ✅ Color principal y secundario
- ✅ Preview de logo actual

#### Solapa: Página Pública
- ✅ Habilitar página personalizada
- ✅ Handler personalizado
- ✅ Código QR para compartir
- ✅ Botón "Ver mi página"

#### Solapa: Interesados (`/lab/negocio` - solapa Interesados)
- ✅ Lista de interesados en álbumes que tienen este laboratorio seleccionado
- ✅ Información completa por interesado:
  - Nombre completo (nombre + apellido)
  - WhatsApp (si está disponible)
  - Email
  - Nombre del álbum
  - Nombre del fotógrafo
  - Fecha de interés
- ✅ **Botón de WhatsApp** para enviar mensaje automático
- ✅ Link para ver el álbum público

### Panel de Negocio (`/lab/negocio`)
- ✅ Vista consolidada con múltiples solapas
- ✅ Gestión de pedidos, clientes, precios, productos, diseño, página pública, **interesados**

### Otras Páginas del Laboratorio:
- ✅ `/lab/pedidos` - Gestión de pedidos (página histórica)
- ✅ `/lab/clientes` - Gestión de clientes (página histórica)
- ✅ `/lab/precios` - Configuración de precios (página histórica)
- ✅ `/lab/catalogo` - Gestión de catálogo
- ✅ `/lab/soporte` - Sistema de soporte

---

## 👑 PANEL DE ADMINISTRACIÓN (`/admin`)

### Solapa: Laboratorios
- ✅ Listado de todos los laboratorios
- ✅ Filtro por estado: Todos, Pendientes, Aprobados, Rechazados
- ✅ Botones "Aprobar" y "Rechazar" para labs pendientes
- ✅ Información: ID, nombre, email, ciudad, estado, fecha

### Solapa: Usuarios
- ✅ Listado de todos los usuarios
- ✅ Filtros por rol (Admin, Fotógrafo, Laboratorio, Cliente)
- ✅ Búsqueda por texto (email, nombre, teléfono)
- ✅ Información: ID, nombre, email, rol, teléfono, fecha

### Solapa: Pedidos
- ✅ Listado de todos los pedidos
- ✅ Filtros por estado
- ✅ Búsqueda por cliente
- ✅ Información completa con relaciones

### Solapa: Configuración
- ✅ Precio mínimo de foto digital (en pesos)
- ✅ Porcentaje de comisión de la plataforma (0-100%)
- ✅ Guardar configuración global

### Otras Funcionalidades del Admin:
- ✅ `/admin/auditoria` - Logs de auditoría
- ✅ `/admin/finanzas` - Gestión financiera
- ✅ `/admin/mensajes` - Mensajes de contacto
- ✅ `/admin/soporte` - Sistema de soporte
- ✅ `/admin/clientes` - Gestión de clientes

---

## 🛍️ FLUJOS DE VENTA Y COMPRA

### 1. Flujo de Álbum del Fotógrafo (`/a/[id]`)

#### Vista del Cliente (`/a/[id]`):
- ✅ **Header y Footer personalizados** del fotógrafo (logo y colores)
- ✅ **Álbumes sin fotos**:
  - Mensaje "Las fotos serán subidas próximamente"
  - **Formulario de interés** con 3 campos:
    - Nombre completo (requerido)
    - WhatsApp (requerido)
    - Email (requerido)
  - Notificación automática cuando se suban las primeras fotos
  - Protección anti-captura deshabilitada cuando no hay fotos
- ✅ **Álbumes con fotos**:
  - Grid de fotos con marca de agua
  - **Protección anti-captura de pantalla**:
    - Blur al detectar teclas (Print Screen, Cmd+Shift, Shift+S)
    - Logo de watermark en centro con mensaje
    - Context menu personalizado ("@compramelafoto")
    - Prevención de clic derecho para descargar
  - Selección visual de fotos (checkboxes)
  - Botón "Comprar seleccionadas"
- ✅ Búsqueda por publicSlug o ID (compatibilidad hacia atrás)

#### Página de Compra (`/a/[id]/comprar`):
- ✅ **Header y Footer personalizados** del fotógrafo
- ✅ Lista de fotos seleccionadas
- ✅ **Selector de tipo de compra**:
  - Digital (si está habilitado)
  - Impresa (si está habilitado, con tamaños del laboratorio)
- ✅ Precios calculados según:
  - Laboratorio seleccionado del álbum
  - Margen de ganancia del álbum (o del fotógrafo)
  - Precio digital configurado en el álbum
- ✅ Mensaje si archivo digital incluido con impresión
- ✅ Mensaje de retiro (laboratorio o fotógrafo)
- ✅ Botón "Volver al álbum"
- ✅ Resumen de totales
- ✅ **Aplicación de color terciario** en bordes, botones y elementos seleccionados

#### Página de Resumen (`/a/[id]/comprar/resumen`):
- ✅ **Header y Footer personalizados** del fotógrafo
- ✅ Confirmación de items
- ✅ Información de retiro
- ✅ Total final
- ✅ Continuar con datos del cliente

### 2. Flujo Estándar de Impresión (`/imprimir`)

#### Subida (`/imprimir`):
- ✅ Drag & drop de fotos
- ✅ Preview en grid
- ✅ Cálculo de precios con descuentos

#### Configuración (`/imprimir/configurar`):
- ✅ Selectores: tamaño, acabado, cantidad
- ✅ Precios dinámicos

#### Resumen (`/imprimir/resumen`):
- ✅ Lista de items con totales
- ✅ Botón "Modificar pedido"

#### Datos del Cliente (`/imprimir/datos`):
- ✅ Formulario completo
- ✅ Pre-llenado si está autenticado
- ✅ Opción de retiro

#### Confirmación (`/imprimir/confirmacion`):
- ✅ Mensaje de éxito
- ✅ Número de pedido

### 3. Flujo del Fotógrafo Personalizado (`/f/[handler]`)

#### Página Home Personalizada (`/f/[handler]`):
- ✅ Logo y colores personalizados (primario, secundario, terciario)
- ✅ Footer personalizado
- ✅ **Sección "Mis Álbumes"** (si está habilitada):
  - Vista previa de todos los álbumes del fotógrafo
  - Cards con miniatura, título y link al álbum
  - Diseño responsive con colores personalizados
- ✅ **Sección "Imprimir tus propias fotos"** (si está habilitada):
  - Card con diseño personalizado
  - Botón que lleva a `/f/[handler]/imprimir`

#### Página de Álbumes (`/f/[handler]/albums`):
- ✅ Lista completa de álbumes del fotógrafo
- ✅ Diseño consistente con branding personalizado

#### Flujo de Impresión (`/f/[handler]/imprimir`):
- ✅ Igual al flujo estándar pero con branding del fotógrafo
- ✅ Usa precios del laboratorio preferido
- ✅ Aplica margen de ganancia del fotógrafo
- ✅ **Aplicación de color terciario** en elementos interactivos

---

## 💳 SISTEMA DE PAGOS

### Integración Mercado Pago:
- ✅ OAuth de Mercado Pago para fotógrafos y laboratorios
- ✅ Creación de preferencia de pago (`/api/payments/mp/create-preference`)
- ✅ Webhook para confirmación de pagos (`/api/payments/mp/webhook`)
- ✅ Páginas de resultado:
  - `/pago/success` - Pago exitoso
  - `/pago/pending` - Pago pendiente
  - `/pago/failure` - Pago fallido
- ⏳ **Pendiente:** Envío de emails con links de descarga para fotos digitales

### Endpoints de Pago:
- `POST /api/payments/mp/create-preference` - Crear preferencia de pago
- `POST /api/payments/mp/webhook` - Webhook de confirmación
- `POST /api/payments/mp/confirm` - Confirmar pago manualmente
- `GET /api/mercadopago/oauth/connect` - Conectar cuenta Mercado Pago
- `GET /api/mercadopago/oauth/callback` - Callback OAuth Mercado Pago

---

## 📱 PÁGINAS PÚBLICAS

### Fotógrafos (`/f/[handler]`):
- ✅ Home personalizado con secciones configurables:
  - Sección "Mis Álbumes" (habilitable/deshabilitable)
  - Sección "Imprimir tus propias fotos" (habilitable/deshabilitable)
- ✅ Logo y colores personalizados (primario, secundario, terciario)
- ✅ Header y Footer personalizados en todas las páginas
- ✅ Página de álbumes (`/f/[handler]/albums`)
- ✅ Flujo completo de impresión personalizado (`/f/[handler]/imprimir`)

### Laboratorios (`/l/[handler]`):
- ✅ Página pública del laboratorio
- ✅ Logo y colores personalizados
- ✅ Flujo de impresión personalizado (`/l/[handler]/imprimir`)

---

## 🗄️ BASE DE DATOS (Prisma Schema)

### Modelos Principales:

#### User (Usuarios):
- ✅ Roles: ADMIN, PHOTOGRAPHER, LAB, LAB_PHOTOGRAPHER, CUSTOMER
- ✅ Datos personales: nombre, email, teléfono, ciudad, provincia, país, domicilio, fecha de nacimiento
- ✅ Datos de empresa: nombre, titular, CUIT, domicilio
- ✅ Redes sociales: website, instagram, tiktok, facebook, whatsapp
- ✅ Personalización: logoUrl, primaryColor, secondaryColor, tertiaryColor
- ✅ Configuración: preferredLabId, profitMarginPercent, defaultDigitalPhotoPrice
- ✅ Descuentos digitales: digitalDiscountsEnabled, digitalDiscount5Plus, digitalDiscount10Plus, digitalDiscount20Plus
- ✅ Página pública: isPublicPageEnabled, publicPageHandler, enableAlbumsPage, enablePrintPage
- ✅ Integración Mercado Pago: mpAccessToken, mpRefreshToken, mpUserId, mpConnectedAt
- ✅ Administración: tags, lastLoginAt, isBlocked, blockedAt, blockedReason
- ✅ Recuperación de contraseña: passwordResetToken, passwordResetExpires

#### Album (Álbumes):
- ✅ Datos básicos: título, ubicación, fecha del evento, publicSlug
- ✅ Configuración de venta:
  - enablePrintedPhotos, enableDigitalPhotos
  - includeDigitalWithPrint, allowClientLabSelection
- ✅ Precios: digitalPhotoPriceCents, albumProfitMarginPercent
- ✅ Descuentos digitales: digitalDiscount5Plus, digitalDiscount10Plus, digitalDiscount20Plus
- ✅ Laboratorio: selectedLabId, pickupBy (CLIENT/PHOTOGRAPHER)
- ✅ Portada: coverPhotoId
- ✅ Estado: isHidden, isPublic, showComingSoonMessage
- ✅ Expiración: firstPhotoDate (para calcular eliminación automática)
- ✅ Términos: termsAcceptedAt, termsVersion
- ✅ Relaciones: user, selectedLab, orders, photos, coverPhoto, notifications, interests

#### Photo (Fotos):
- ✅ Datos: previewUrl (con marca de agua), originalKey (sin marca de agua)
- ✅ Usuario que subió: userId (para álbumes colaborativos)
- ✅ Remoción: isRemoved, removedAt, removedReason
- ✅ Relaciones: album, uploadedBy, albumsAsCover, items, removalRequests

#### Order (Órdenes de álbumes):
- ✅ Datos: albumId, buyerEmail, status, totalCents
- ✅ Relaciones: album, items

#### OrderItem (Items de órdenes):
- ✅ Tipo: DIGITAL, PRINT, FRAME
- ✅ Configuración de impresión: size, finish (BRILLO/MATE), quantity
- ✅ Configuración de cuadro: material (CANVAS/WOOD)
- ✅ Precios: priceCents, subtotalCents
- ✅ Relaciones: order, photo

#### PrintOrder (Pedidos de impresión):
- ✅ Cliente: customerName, customerEmail, customerPhone, clientId
- ✅ Relaciones: labId, photographerId
- ✅ Estado: CREATED, IN_PRODUCTION, READY_TO_PICKUP, SHIPPED, DELIVERED, CANCELED, RETIRED
- ✅ Retiro: pickupBy (CLIENT/PHOTOGRAPHER)
- ✅ Pago: paymentProvider, paymentStatus, mpPreferenceId, mpInitPoint, mpPaymentId
- ✅ Tipo: orderType (DIGITAL, PRINT, COMBO)
- ✅ Comisiones: platformCommission, labCommission, photographerCommission
- ✅ Administración: tags, internalNotes
- ✅ Relaciones: lab, photographer, client, items, supportTickets, adminLogs, statusHistory, paymentSplit

#### PrintOrderItem (Items de pedidos de impresión):
- ✅ Datos: fileKey, originalName, size, acabado, quantity
- ✅ Precios: unitPrice, subtotal
- ✅ Relación: order

#### Lab (Laboratorios):
- ✅ Datos básicos: name, email (unique), phone, address, city, province, country
- ✅ Autenticación: userId (relación con User)
- ✅ Estado: approvalStatus (PENDING, APPROVED, REJECTED), isActive
- ✅ Personalización: logoUrl, primaryColor, secondaryColor, isPublicPageEnabled, publicPageHandler
- ✅ Integración Mercado Pago: mpAccessToken, mpRefreshToken, mpUserId, mpConnectedAt
- ✅ Tipo: labType (TYPE_A/TYPE_B), commissionOverrideBps
- ✅ Administración: tags, internalNotes
- ✅ Relaciones: user, basePrices, discounts, orders, preferredByUsers, products

#### LabBasePrice (Precios base del laboratorio):
- ✅ Campos: labId, size, unitPrice, currency
- ✅ Relación: lab

#### LabSizeDiscount (Descuentos por cantidad):
- ✅ Campos: labId, size, minQty, discountPercent
- ✅ Relación: lab

#### LabProduct (Productos del laboratorio):
- ✅ Campos: labId, name, size, wholesalePrice, retailPrice, isActive
- ✅ Relación: lab

#### AlbumNotification (Notificaciones de álbumes):
- ✅ Campos: albumId, name, lastName, whatsapp, email
- ✅ Tracking: notifiedWhenReady, notifiedAt3Weeks, notifiedAt2Weeks, notifiedAt1Week
- ✅ Relación: album
- ✅ Único por: albumId + email

#### AlbumInterest (Intereses en álbumes):
- ✅ Campos: albumId, name, lastName, whatsapp, email
- ✅ Relación: album
- ✅ Único por: albumId + email

#### AppConfig (Configuración del sistema):
- ✅ Campos: key, value
- ✅ Ejemplos: minDigitalPhotoPrice, appTaxPercent

#### Otros Modelos:
- ✅ RemovalRequest (Solicitudes de remoción de fotos)
- ✅ SupportTicket (Tickets de soporte)
- ✅ SupportMessage (Mensajes de soporte)
- ✅ ContactMessage (Mensajes de contacto)
- ✅ AdminLog (Logs de auditoría)
- ✅ PrintOrderStatusHistory (Historial de cambios de estado)
- ✅ PaymentSplit (División de pagos)
- ✅ TermsAcceptance (Aceptación de términos)
- ✅ AdminMessageThread (Hilos de mensajes con admin)
- ✅ AdminMessage (Mensajes de admin)

---

## 🔌 APIs DISPONIBLES

### Autenticación:
- ✅ `POST /api/auth/login` - Login universal
- ✅ `POST /api/auth/register` - Registro cliente
- ✅ `POST /api/auth/register-photographer` - Registro fotógrafo
- ✅ `POST /api/auth/register-lab` - Registro laboratorio
- ✅ `POST /api/auth/logout` - Logout
- ✅ `GET /api/auth/google` - OAuth Google
- ✅ `GET /api/auth/google/callback` - Callback OAuth
- ✅ `POST /api/auth/forgot-password` - Solicitar reset
- ✅ `POST /api/auth/reset-password` - Resetear contraseña
- ✅ `GET /api/auth/me` - Usuario actual

### Fotógrafo:
- ✅ `GET /api/dashboard/photographer` - Datos del fotógrafo
- ✅ `GET /api/fotografo/dashboard` - Dashboard con estadísticas
- ✅ `GET /api/fotografo/interesados` - Lista de interesados en álbumes
- ✅ `GET /api/fotografo/[id]` - Datos públicos del fotógrafo
- ✅ `PATCH /api/fotografo/update` - Actualizar configuración
- ✅ `POST /api/fotografo/upload-logo` - Subir logo
- ✅ `GET /api/fotografo/clientes` - Listar clientes
- ✅ `PATCH /api/fotografo/clientes/[email]` - Actualizar cliente
- ✅ `DELETE /api/fotografo/clientes/[email]` - Eliminar cliente
- ✅ `GET /api/fotografo/pedidos` - Listar pedidos

### Álbumes:
- ✅ `GET /api/dashboard/albums` - Listar álbumes
- ✅ `POST /api/dashboard/albums` - Crear álbum
- ✅ `GET /api/dashboard/albums/[id]` - Detalle del álbum
- ✅ `PUT /api/dashboard/albums/[id]` - Actualizar álbum
- ✅ `PATCH /api/dashboard/albums/[id]` - Actualizar parcialmente
- ✅ `DELETE /api/dashboard/albums/[id]` - Eliminar álbum
- ✅ `POST /api/dashboard/albums/[id]/photos` - Subir fotos
- ✅ `DELETE /api/dashboard/albums/[id]/photos/[photoId]` - Eliminar foto
- ✅ `PATCH /api/dashboard/albums/[id]/cover` - Establecer portada
- ✅ `GET /api/dashboard/albums/search` - Búsqueda de álbumes
- ✅ `GET /api/a/[id]/order-photos` - Fotos y precios para cliente
- ✅ `POST /api/a/[id]/orders` - Crear orden de álbum
- ✅ `POST /api/a/[id]/notifications` - Registrar notificación/interés
- ✅ `GET /api/public/albums` - Álbumes públicos

### Cliente:
- ✅ `GET /api/cliente/dashboard` - Dashboard del cliente
- ✅ `GET /api/cliente/pedidos` - Listar pedidos del cliente

### Laboratorio:
- ✅ `GET /api/labs` - Listar laboratorios (con búsqueda)
- ✅ `GET /api/lab/[id]` - Datos del laboratorio
- ✅ `PATCH /api/lab/[id]` - Actualizar datos
- ✅ `GET /api/lab/by-user/[userId]` - Obtener lab por userId
- ✅ `POST /api/lab/create` - Crear laboratorio
- ✅ `POST /api/lab/upload-logo` - Subir logo
- ✅ `GET /api/lab/pricing` - Obtener precios
- ✅ `PUT /api/lab/pricing` - Actualizar precios
- ✅ `GET /api/lab/products` - Listar productos
- ✅ `PUT /api/lab/products` - Actualizar productos
- ✅ `GET /api/lab/clientes` - Listar clientes
- ✅ `PATCH /api/lab/clientes/[email]` - Actualizar cliente
- ✅ `DELETE /api/lab/clientes/[email]` - Eliminar cliente
- ✅ `GET /api/lab/interesados` - Listar interesados en álbumes
- ✅ `GET /api/lab/dashboard` - Dashboard del laboratorio
- ✅ `GET /api/lab/status` - Estado del laboratorio
- ✅ `GET /api/lab/catalog/export` - Exportar catálogo
- ✅ `POST /api/lab/catalog/import` - Importar catálogo
- ✅ `GET /api/lab/catalog/template` - Template de catálogo
- ✅ `GET /api/lab/catalog/variants` - Variantes de productos

### Pedidos:
- ✅ `POST /api/print-orders` - Crear pedido
- ✅ `GET /api/print-orders` - Listar pedidos
- ✅ `GET /api/print-orders/[id]` - Detalle del pedido
- ✅ `GET /api/print-orders/[id]/export` - Exportar ZIP de imágenes
- ✅ `PATCH /api/print-orders/[id]/status` - Cambiar estado
- ✅ `PATCH /api/print-orders/bulk-status` - Cambio masivo de estado
- ✅ `POST /api/print-orders/uploads` - Subir imágenes para pedidos

### Admin:
- ✅ `GET /api/admin/dashboard` - Dashboard del admin
- ✅ `GET /api/admin/labs` - Listar laboratorios
- ✅ `PATCH /api/admin/labs/[id]` - Actualizar laboratorio
- ✅ `GET /api/admin/users` - Listar usuarios
- ✅ `GET /api/admin/users/[id]` - Detalle de usuario
- ✅ `GET /api/admin/print-orders` - Listar pedidos
- ✅ `GET /api/admin/print-orders/[id]` - Detalle de pedido
- ✅ `POST /api/admin/config` - Actualizar configuración
- ✅ `GET /api/admin/audit` - Logs de auditoría
- ✅ `GET /api/admin/finance/summary` - Resumen financiero
- ✅ `GET /api/admin/finance/payments` - Pagos
- ✅ `GET /api/admin/search` - Búsqueda global
- ✅ `POST /api/admin/set-admin-role` - Asignar rol admin
- ✅ `GET /api/admin/support/tickets` - Tickets de soporte
- ✅ `GET /api/admin/contact-messages` - Mensajes de contacto

### Sistema:
- ✅ `GET /api/config` - Configuración pública
- ✅ `GET /api/system-settings` - Configuración del sistema
- ✅ `POST /api/system-settings` - Actualizar configuración
- ✅ `POST /api/contact` - Formulario de contacto
- ✅ `POST /api/uploads` - Subir archivos
- ✅ `GET /api/public/labs` - Laboratorios públicos
- ✅ `GET /api/public/lab-pricing` - Precios públicos de laboratorio
- ✅ `POST /api/print-quote` - Cotización de impresión

### CRON Jobs:
- ✅ `GET /api/cron/cleanup-expired-albums` - Limpieza de álbumes expirados
- ✅ `GET /api/cron/send-album-notifications` - Envío de notificaciones automáticas
- ✅ `GET /api/cron/process-email-queue` - Procesar cola de emails

### Descargas:
- ✅ `GET /api/downloads/[token]` - Descargar archivo con token

### Soporte:
- ✅ `GET /api/support/tickets` - Listar tickets
- ✅ `POST /api/support/tickets` - Crear ticket

### Términos:
- ✅ `POST /api/terms/accept` - Aceptar términos

### Remociones:
- ✅ `GET /api/dashboard/removal-requests` - Listar solicitudes
- ✅ `PATCH /api/dashboard/removal-requests/[id]` - Actualizar solicitud
- ✅ `POST /api/removal-requests` - Crear solicitud

---

## 🎨 CARACTERÍSTICAS ESPECIALES

### Seguridad y Protección:
- ✅ Marca de agua automática en previews de fotos
- ✅ Protección anti-captura de pantalla en álbumes:
  - Blur al detectar teclas (Print Screen, Cmd+Shift, Shift+S)
  - Logo de watermark en centro con mensaje
  - Context menu personalizado
  - Prevención de clic derecho para descargar
- ✅ Cookies httpOnly para autenticación
- ✅ Validación de roles en todas las rutas
- ✅ Tokens de descarga con expiración

### Automatización:
- ✅ **Gestión de expiración de álbumes**:
  - Eliminación automática: 30 días desde la primera foto subida
  - Archivos originales permanecen 15 días adicionales
  - Reactivación disponible por 15 días adicionales
- ✅ Primera foto como portada automática
- ✅ Agrupación automática de clientes por email/teléfono
- ✅ Cálculo automático de precios con descuentos
- ✅ **Sistema de notificaciones automáticas**:
  - Notificación cuando se suben las primeras fotos a un álbum
  - Recordatorios automáticos: 3 semanas, 2 semanas y 1 semana antes de eliminación
  - Endpoint CRON: `/api/cron/send-album-notifications`

### Personalización:
- ✅ Logos personalizados para fotógrafos y laboratorios
- ✅ **Tres colores configurables**:
  - Color primario (fondos principales, textos destacados)
  - Color secundario (fondos alternativos, acentos)
  - Color terciario/accent (botones, bordes, recuadros, elementos seleccionados)
- ✅ Handlers personalizados para URLs amigables
- ✅ Branding completo en páginas públicas (header y footer personalizados)
- ✅ Secciones configurables en página pública del fotógrafo

### Gestión de Clientes:
- ✅ Edición inline de datos de clientes (nombre, teléfono)
- ✅ Eliminación de clientes y registros relacionados
- ✅ Botones de acción (WhatsApp, editar, eliminar)
- ✅ Agrupación automática por email/teléfono
- ✅ Cálculo automático de totales (pedidos, gastado)

### Gestión de Interesados:
- ✅ Registro de interesados cuando álbum no tiene fotos (nombre, WhatsApp, email)
- ✅ Lista de interesados en dashboard del fotógrafo con:
  - Nombre completo, WhatsApp, Email
  - Nombre del álbum
  - Fecha de interés
  - Botón de WhatsApp con mensaje automático
- ✅ Lista de interesados en panel del laboratorio con misma información
- ✅ Combinación de AlbumNotification y AlbumInterest en una sola lista

---

## 📊 FUNCIONALIDADES PENDIENTES / POR MEJORAR

> **Nota:** Las funcionalidades marcadas con ✅ están **COMPLETAMENTE IMPLEMENTADAS**. Las marcadas con ⏳ están **PENDIENTES** o **PARCIALMENTE IMPLEMENTADAS**.

### 🔴 Críticas (Alta Prioridad):
1. **Completar flujo de pago para álbumes**:
   - ⏳ Crear página `/a/[id]/comprar/datos` (formulario del cliente) - **NO IMPLEMENTADO**
   - ⏳ Integrar Mercado Pago para pedidos de álbumes - **NO IMPLEMENTADO**
   - ⏳ Webhook debe enviar emails con links de descarga para fotos digitales pagadas - **NO IMPLEMENTADO**

2. **Sistema de emails completo**:
   - ✅ Sistema de notificaciones de álbumes (cuando se suben fotos, recordatorios de expiración) - **IMPLEMENTADO**
   - ⏳ Confirmación de pedidos por email - **NO IMPLEMENTADO**
   - ⏳ Links de descarga para fotos digitales pagadas - **NO IMPLEMENTADO**
   - ⏳ Notificaciones de cambios de estado de pedidos - **NO IMPLEMENTADO**
   - ⏳ Integración con servicio de email real (Resend/SendGrid) - **PARCIALMENTE IMPLEMENTADO** (existe estructura pero falta configuración)

### 🟡 Importantes (Media Prioridad):
3. **Estadísticas y reportes**:
   - ⏳ Dashboard con métricas detalladas para fotógrafos
   - ⏳ Reportes de ventas para laboratorios
   - ⏳ Analytics de álbumes (vistas, conversiones)
   - ⏳ Reportes financieros para admin

4. **Mejoras en UX**:
   - ⏳ Búsqueda avanzada en álbumes
   - ⏳ Filtros y ordenamiento avanzados en listas
   - ⏳ Paginación en listados grandes
   - ⏳ Optimización de carga de imágenes (lazy loading, thumbnails)
   - ⏳ Caché de imágenes

5. **Gestión de clientes mejorada**:
   - ✅ Edición inline de datos de clientes
   - ✅ Eliminación de clientes y registros relacionados
   - ✅ Botones de acción (WhatsApp, editar, eliminar)
   - ⏳ Historial completo de interacciones
   - ⏳ Comentarios y notas por cliente
   - ⏳ Seguimiento de preferencias

### 🟢 Opcionales (Baja Prioridad):
6. **Funcionalidades adicionales**:
   - ⏳ Sistema de facturación electrónica
   - ⏳ Integración con redes sociales (compartir álbumes)
   - ⏳ App móvil (React Native)
   - ⏳ Chat en tiempo real entre usuarios
   - ⏳ Programación de publicaciones de álbumes
   - ⏳ Galería de portafolio público mejorada
   - ⏳ Sistema de reseñas y calificaciones
   - ⏳ Programa de referidos
   - ⏳ Cupones y descuentos promocionales

---

## 📈 ESTADO ACTUAL DEL PROYECTO

### ✅ Completado e Implementado: ~92%

**Funcionalidades 100% Implementadas:**
- ✅ Autenticación completa (login, registro, OAuth, recuperación de contraseña)
- ✅ Paneles de gestión (fotógrafo, cliente, laboratorio, admin)
- ✅ Flujo de impresión estándar (`/imprimir`)
- ✅ Flujo de impresión personalizado del fotógrafo (`/f/[handler]/imprimir`)
- ✅ Sistema de precios y calculadoras
- ✅ Gestión de pedidos (crear, listar, cambiar estado, exportar ZIP)
- ✅ Página pública del fotógrafo (`/f/[handler]`)
- ✅ Sistema de notificaciones de álbumes (registro, CRON para envío)
- ✅ Gestión de clientes (listar, editar inline, eliminar, WhatsApp)
- ✅ Personalización avanzada (3 colores, logos, handlers)
- ✅ Extensión y reactivación de álbumes
- ✅ Sistema de interesados (registro, listado en dashboard, botón WhatsApp)
- ✅ Gestión de álbumes (crear, editar, eliminar, subir fotos)
- ✅ Protección anti-captura de pantalla
- ✅ Marca de agua automática
- ✅ Dashboard del fotógrafo con estadísticas
- ✅ Dashboard del laboratorio con interesados

**Funcionalidades Parcialmente Implementadas:**
- ⚠️ Flujo de álbumes: 95% (falta integración de pago completa)
- ⚠️ Integración Mercado Pago: 50% (OAuth implementado, pagos básicos implementados, falta para álbumes)
- ⚠️ Gestión de pedidos: 98% (falta notificaciones por email)

### ⏳ En progreso o Pendiente: ~8%

**Pendientes Críticas:**
- ❌ Completar flujo de pago de álbumes (página `/a/[id]/comprar/datos`)
- ❌ Notificaciones por email para pedidos (confirmación, descarga, cambios de estado)
- ❌ Integración completa de servicio de email real

**Pendientes Importantes:**
- ❌ Estadísticas y reportes avanzados (dashboards con métricas detalladas)
- ❌ Optimizaciones de UX (búsqueda avanzada, paginación, lazy loading)
- ❌ Historial completo de interacciones con clientes

---

## 🎯 PRIORIDADES SUGERIDAS

1. **Completar flujo de pago de álbumes** (crítico para funcionamiento completo)
2. **Sistema de emails completo** (mejora la experiencia del cliente)
3. **Dashboard de estadísticas** (valor agregado para usuarios)
4. **Optimizaciones de rendimiento** (escalabilidad)
5. **Funcionalidades avanzadas** (diferenciación)

---

## 📝 NOTAS TÉCNICAS

### Migraciones Pendientes:
- ⚠️ **IMPORTANTE**: Ejecutar migración para agregar campos `lastName` y `whatsapp` a `AlbumNotification` y `AlbumInterest`:
  ```bash
  npx prisma migrate dev --name add_lastname_whatsapp_to_interests
  ```
  O usar `npx prisma db push` para sincronizar el schema directamente.

### Variables de Entorno Requeridas:
- `DATABASE_URL` - URL de conexión a PostgreSQL
- `GOOGLE_CLIENT_ID` - Para OAuth de Google
- `GOOGLE_CLIENT_SECRET` - Para OAuth de Google
- `NEXTAUTH_URL` o `NEXT_PUBLIC_APP_URL` - URL base de la aplicación
- `CRON_SECRET` - (Opcional) Secret para proteger endpoints CRON
- Variables de Mercado Pago (si se usa)

---

**Última actualización:** Enero 2026
**Versión del proyecto:** 1.2 (Beta)
