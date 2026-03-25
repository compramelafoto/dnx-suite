# Funcionalidades de Paneles - ComprameLaFoto

## 📸 PANEL DEL FOTÓGRAFO (`/fotografo/configuracion`)

### Solapas y Funcionalidades:

#### 1. **Datos Personales**
- ✅ Email (solo lectura)
- ✅ Nombre completo
- ✅ Teléfono
- ✅ Ciudad, Provincia, País (en grid)
- ✅ Domicilio
- ✅ Fecha de nacimiento (date picker)
- ✅ **Datos de la empresa** (sección separada):
  - Nombre de la empresa
  - Nombre del titular
  - CUIT
- ✅ Guardar cambios (con validación)

#### 2. **Diseño**
- ✅ Carga de logo PNG
  - Preview del logo actual
  - Validación formato PNG
  - Almacenamiento en `/public/uploads/logos/`
- ✅ Color principal (color picker + input hex)
- ✅ Color secundario (color picker + input hex)
- ✅ Guardar cambios

#### 3. **Laboratorio y Márgenes**
- ✅ Selección de laboratorio preferido/recomendado
  - Búsqueda en tiempo real por nombre, ciudad, provincia, teléfono, domicilio
  - Select con resultados filtrados
- ✅ Botón "Ver precios" junto al selector
  - Modal con datos completos del laboratorio (nombre, ciudad, provincia, país, domicilio, teléfono, email)
  - Tabla de precios base por tamaño
  - Tabla de descuentos por cantidad
- ✅ Margen de ganancia (%)
  - Input numérico 0-100
  - Se aplica sobre precio del laboratorio
- ✅ **Calculadora de Costos y Ganancias**:
  - Tipo de foto: Impresas / Digitales
  - **Para Fotos Impresas:**
    - Selector de tamaño y cantidad
    - Desglose de costos:
      - Costo base del laboratorio
      - Descuento por cantidad (%)
      - Precio del laboratorio (después de descuento)
      - Comisión de la plataforma (10% por defecto)
      - Margen de ganancia del fotógrafo (% configurado)
      - Precio final por unidad
    - **Totales para X unidades:**
      - Total de costo
      - Total bonificado (descuento)
      - Total de comisión de la plataforma
      - Total de ganancia del fotógrafo
      - Total final para la cantidad
    - Leyenda sobre impuestos adicionales (medio de pago, días de depósito, situación fiscal)
  - **Para Fotos Digitales:**
    - Input para precio por foto digital
    - Validación de precio mínimo (configurado en sistema)
    - Desglose:
      - Precio por foto digital
      - Comisión de la plataforma (10%)
      - Ganancia neta del fotógrafo
- ✅ Guardar cambios

#### 4. **Página Pública**
- ✅ Checkbox para habilitar página personalizada
- ✅ Input para Handler (URL personalizada)
  - Validación: solo letras minúsculas, números y guiones
  - Vista previa de la URL completa
  - Botón de copiar URL (con feedback visual)
- ✅ **Código QR** para compartir la página
  - Generación automática con la URL completa
  - Tamaño 200x200px
  - Texto explicativo
- ✅ Guardar cambios

#### 5. **Clientes**
- ✅ Tabla de clientes históricos
  - Columnas: Nombre, Email, Teléfono, Primera compra, Última compra, Total de pedidos, Total gastado, WhatsApp
  - Búsqueda en tiempo real por cualquier campo (nombre, email, teléfono, total, pedidos, fecha, moneda, estado)
  - Botón de exportar a CSV (arriba a la derecha)
  - Botón de WhatsApp en cada fila (icono verde)
    - Abre conversación en nueva ventana
    - Formato: 54 + número
- ✅ Agrupación automática de clientes por email/teléfono
- ✅ Cálculo automático de totales (pedidos, gastado)
- ✅ Carga automática al activar la solapa

#### Botones adicionales:
- ✅ "Ver mi Página" (solo si página pública está habilitada)
  - Abre `/f/[handler]` en nueva ventana
- ✅ "Cerrar sesión"

---

## 👤 PANEL DEL CLIENTE (`/cliente/pedidos`)

### Funcionalidades:
- ✅ Listado de pedidos del cliente autenticado
- ✅ Información de cada pedido:
  - Número de pedido
  - Fecha
  - Estado
  - Total
  - Cantidad de items
- ✅ Link para crear nuevo pedido
- ✅ Logout

---

## 🏭 PANEL DEL LABORATORIO (`/lab/configuracion`)

### Solapas y Funcionalidades:

#### 1. **Pedidos**
- ✅ Listado de todos los pedidos (últimos 200)
- ✅ Filtrado por estado (Todos, Creado, En producción, Listo para retirar, Enviado, Entregado, Cancelado)
- ✅ Búsqueda en tiempo real por cliente, email, WhatsApp, fecha, estado, total, items
- ✅ Selección múltiple de pedidos (checkbox)
- ✅ Cambio de estado masivo para pedidos seleccionados
- ✅ Información de cada pedido:
  - ID, Cliente, Email, WhatsApp, Fotógrafo
  - Retira (Cliente/Fotógrafo)
  - Fecha de creación, Último cambio de estado
  - Cantidad de items, Total, Estado actual
- ✅ Botón "Descargar ZIP" por pedido (export de imágenes)
- ✅ Contador de pedidos visibles/totales
- ✅ Botón "Limpiar" para resetear filtros y selección
- ✅ Carga automática al activar la solapa

#### 2. **Clientes**
- ✅ Tabla de clientes históricos
  - Columnas: Nombre, Email, Teléfono, Primera compra, Última compra, Total de pedidos, Total gastado, WhatsApp
  - Búsqueda en tiempo real por cualquier campo (nombre, email, teléfono, total, pedidos, fecha, moneda, estado)
  - Botón de exportar a CSV (arriba a la derecha)
  - Botón de WhatsApp en cada fila (icono verde)
    - Abre conversación en nueva ventana
    - Formato: 54 + número
- ✅ Agrupación automática de clientes por email/teléfono
- ✅ Cálculo automático de totales (pedidos, gastado)
- ✅ Carga automática al activar la solapa

#### 3. **Precios**
- ✅ Configuración de precios base por tamaño (10x15, 13x18, 15x20, etc.)
- ✅ Configuración de descuentos por cantidad:
  - Descuento para 50+ unidades del mismo tamaño
  - Descuento para 100+ unidades del mismo tamaño
- ✅ Tabla editable con inputs numéricos
- ✅ Botones "Guardar" y "Recargar"
- ✅ Mensaje explicativo sobre cómo se aplican los descuentos
- ✅ Mensaje de instrucción si no hay tamaños cargados (con comando para ejecutar script)
- ✅ Carga automática al activar la solapa

#### 4. **Productos**
- ✅ Gestión de productos a la venta con dos precios:
  - **Precio Mayorista (Fotógrafo)**: Precio que se cobra a los fotógrafos
  - **Precio Retail (Cliente Final)**: Precio que se muestra al público
- ✅ Tabla editable con campos:
  - Nombre del producto (ej: "Fotos 10x15", "Albums", "Marcos")
  - Tamaño (opcional, ej: "10x15")
  - Precio Mayorista (ARS)
  - Precio Retail (ARS)
  - Estado (Activo/Inactivo)
- ✅ Botón "Agregar Producto" para crear nuevos productos
- ✅ Botón "Eliminar" por producto
- ✅ Botón "Guardar Productos" para persistir cambios
- ✅ Validación de campos requeridos
- ✅ Carga automática al activar la solapa

#### 5. **Diseño**
- ✅ Carga de logo PNG
  - Preview del logo actual
  - Validación formato PNG
  - Almacenamiento en `/public/uploads/logos/`
  - Dimensiones recomendadas: 180x54px
- ✅ Color principal (color picker + input hex)
- ✅ Color secundario (color picker + input hex)
- ✅ Botón "Subir Logo" para guardar logo
- ✅ Botón "Guardar Cambios" para persistir colores
- ✅ Mensajes de éxito/error

#### 6. **Página Pública**
- ✅ Checkbox para habilitar página personalizada
- ✅ Input para Handler (URL personalizada)
  - Validación: solo letras minúsculas, números y guiones
  - Vista previa de la URL completa
  - Botón de copiar URL (con feedback visual)
- ✅ **Código QR** para compartir la página
  - Generación automática con la URL completa
  - Tamaño 200x200px
  - Texto explicativo
- ✅ Botón "Ver mi Página" (solo si página pública está habilitada)
  - Abre `/l/[handler]` en nueva ventana
- ✅ Botón "Guardar Cambios" para persistir configuración

### Notas:
- ✅ Panel organizado por solapas (tabs) similar al panel del fotógrafo
- ✅ Estilo consistente con el resto de la plataforma
- ✅ Autenticación requerida para acceder al panel
- ✅ Espacio reservado para futuras solapas (ej: Reportes, Configuración, Estadísticas)

### Páginas históricas (mantenidas por compatibilidad):
- `/lab/pedidos` - Página independiente (funcionalidad migrada a solapa Pedidos en `/lab/configuracion`)
- `/lab/clientes` - Página independiente (funcionalidad migrada a solapa Clientes en `/lab/configuracion`)
- `/lab/precios` - Página independiente (funcionalidad migrada a solapa Precios en `/lab/configuracion`)

> **Nota:** La funcionalidad principal del laboratorio está concentrada en `/lab/configuracion` con solapas. Las páginas históricas aún existen pero se recomienda usar el panel unificado.

---

## 🔐 SISTEMA DE AUTENTICACIÓN

### Fotógrafos:
- ✅ Login (`/fotografo/login`)
  - Email/password
  - Google OAuth (con role=PHOTOGRAPHER)
  - Redirect a `/fotografo/configuracion`
- ✅ Registro (`/fotografo/registro`)
  - Formulario completo
  - Google OAuth (con role=PHOTOGRAPHER)

### Clientes (CUSTOMER):
- ✅ Login (`/cliente/login`)
  - Email/password
  - Google OAuth (con role=CUSTOMER)
  - Verificación de rol CUSTOMER
  - Redirect a `/cliente/pedidos`
- ✅ Registro (`/cliente/registro`)
  - Formulario completo
  - Google OAuth (con role=CUSTOMER)
  - Usa endpoint `/api/auth/register` con `role: "CUSTOMER"`

### Laboratorio:
- ✅ Login (`/lab/login`)
  - Email/password
  - Verificación de rol LAB
  - Verifica que el lab esté aprobado (approvalStatus=APPROVED)
  - Obtiene `labId` asociado al usuario
  - Usa cookies httpOnly para autenticación
  - Redirect a `/lab/configuracion`
- ✅ Registro (`/lab/registro`)
  - Usa endpoint `/api/auth/register-lab`
  - Formulario completo (nombre del laboratorio, email, contraseña)
  - Crea usuario con `role: "LAB"` y `Lab` con `approvalStatus: "PENDING"` en transacción
  - Estado inicial: `isActive: false` hasta aprobación
  - Redirect a `/lab/login?registered=pending` con mensaje de aprobación pendiente

### Administrador:
- ✅ Login (`/admin/login`)
  - Email/password
  - Verificación de rol ADMIN
  - Usa cookies httpOnly para autenticación
  - Redirect a `/admin`
- ✅ Panel de Administración (`/admin`)
  - 4 solapas: Laboratorios, Usuarios, Pedidos, Configuración
  - Autenticación requerida (verifica cookie y rol ADMIN)
  - Redirige a `/admin/login` si no está autenticado

---

## 🛍️ FLUJO DE PEDIDOS

### Página Principal (`/`)
- ✅ Hero section con fondo oscuro
- ✅ Botones: "Imprimir mis fotos" y "Soy fotógrafo"
- ✅ Sección de beneficios (3 cards)
- ✅ Header con menú de login (Fotógrafo, Cliente, Laboratorio)
- ✅ Footer con link "Trabajar con ComprameLaFoto"

### Flujo Estándar (`/imprimir` → `/imprimir/resumen` → `/imprimir/datos` → `/imprimir/confirmacion`):
- ✅ **Subida de fotos** (`/imprimir`)
  - Drag & drop
  - Preview de fotos
  - Grid responsive
  - Cálculo de precios con descuentos por cantidad
  - Manejo de NaN en cálculos de precios
- ✅ **Resumen del pedido** (`/imprimir/resumen`)
  - Lista de items con miniatura, tamaño, acabado, cantidad, precio unitario, subtotal
  - Resumen de precios: Total de costo, Total bonificado, Total de comisión, Total de ganancia, Total final
  - Botón "Modificar pedido" (preserva el pedido en sessionStorage)
  - Botón "Confirmar pedido"
- ✅ **Datos del cliente** (`/imprimir/datos`)
  - Formulario con validación
  - Pre-llenado si el cliente está autenticado
  - Opción retiro: "En el laboratorio" / "En el estudio del fotógrafo"
  - Link para crear cuenta gratuita (si no está autenticado)
  - Link "Ver mis pedidos" (si está autenticado)
- ✅ **Confirmación** (`/imprimir/confirmacion`)
  - Mensaje de éxito
  - Número de pedido
  - Información de próximos pasos

### Flujo del Fotógrafo (`/f/[handler]` → `/f/[handler]/imprimir` → ...):
- ✅ Página home personalizada (`/f/[handler]`)
  - Logo del fotógrafo en header (reemplaza logo de ComprameLaFoto)
  - Colores personalizados (primario y secundario)
  - Footer personalizado
- ✅ **Página de impresión** (`/f/[handler]/imprimir`)
  - Mismo flujo que `/imprimir` pero con branding del fotógrafo
  - Usa `photographer.preferredLabId` para cargar precios
  - Aplica `photographer.profitMarginPercent` en cálculos
- ✅ **Resumen** (`/f/[handler]/imprimir/resumen`)
  - Mismo formato que `/imprimir/resumen`
  - Botón "Modificar pedido" redirige a `/f/[handler]/imprimir`
- ✅ **Datos del cliente** (`/f/[handler]/imprimir/datos`)
  - Incluye `photographerId` y `labId` en la creación del pedido
  - Redirect a `/f/[handler]/imprimir/confirmacion` al confirmar
- ✅ **Confirmación** (`/f/[handler]/imprimir/confirmacion`)
  - Botón "Volver al inicio" redirige a `/f/[handler]`

### Flujo de Pago (`/pago/*`):
- ✅ **Pago exitoso** (`/pago/success`)
- ✅ **Pago pendiente** (`/pago/pending`)
- ✅ **Pago fallido** (`/pago/failure`)

---

## 📱 PÁGINAS PÚBLICAS DE FOTÓGRAFOS

### Rutas dinámicas (`/f/[handler]`):
- ✅ Home personalizado (`/f/[handler]`)
- ✅ Página de impresión (`/f/[handler]/imprimir`)
- ✅ Resumen (`/f/[handler]/imprimir/resumen`)
- ✅ Datos del cliente (`/f/[handler]/imprimir/datos`)
- ✅ Confirmación (`/f/[handler]/imprimir/confirmacion`)

### Características:
- ✅ Header personalizado con logo del fotógrafo (o nombre si no hay logo)
- ✅ Colores personalizados (primario y secundario)
- ✅ Footer personalizado con colores
- ✅ Link "Trabajar con ComprameLaFoto" en footer (abre formulario de contacto)

---

## 📝 FORMULARIO DE CONTACTO

- ✅ Modal "Trabajar con ComprameLaFoto"
- ✅ Campos: Nombre, Email, Mensaje
- ✅ Envío al email del admin (API `/api/contact`)
- ✅ Disponible en:
  - Footer principal
  - Footer de fotógrafos

---

## 💾 BASE DE DATOS

### Modelos principales:
- ✅ `User` (roles: ADMIN, PHOTOGRAPHER, LAB, CUSTOMER)
  - Datos personales: nombre, email, teléfono, ciudad, provincia, país, domicilio, fecha de nacimiento
  - Datos de empresa: nombre de empresa, titular, CUIT
  - Personalización: logoUrl, primaryColor, secondaryColor, handler, publicPageHandler
  - Configuración: preferredLabId, profitMarginPercent, isPublicPageEnabled
  - Relaciones: albums, printOrders (como fotógrafo), clientOrders (como cliente)
- ✅ `PrintOrder` (pedidos de impresión)
  - Cliente: customerName, customerEmail, customerPhone
  - Relaciones: clientId (User), photographerId (User), labId (Lab)
  - Estado: CREATED, IN_PRODUCTION, READY_TO_PICKUP, SHIPPED, DELIVERED, CANCELED
  - Pickup: pickupBy (CLIENT o PHOTOGRAPHER)
  - Totales: total, currency, itemsCount
- ✅ `PrintOrderItem` (items de cada pedido)
  - Relación con PrintOrder
  - Detalles: photoUrl, size, finish, quantity, unitPrice, subtotal
- ✅ `Lab` (laboratorios)
  - Datos: name, email (unique), phone, address, city, province, country
  - Autenticación: userId (relación con User para login)
  - Personalización: logoUrl, primaryColor, secondaryColor, isPublicPageEnabled, publicPageHandler
  - Relación con User (preferredByUsers para fotógrafos, user para autenticación)
- ✅ `LabBasePrice` (precios base por tamaño)
  - Relación con Lab
  - Campos: size, unitPrice, currency
- ✅ `LabSizeDiscount` (descuentos por cantidad)
  - Relación con Lab
  - Campos: size, minQty, discountPercent
- ✅ `SystemSettings` (configuración del sistema)
  - Ejemplo: minDigitalPhotoPrice, appTaxPercent
- ✅ `Album` (con `albumProfitMarginPercent` para márgenes por álbum)
  - Relación con User (fotógrafo)

---

## 🔌 APIs DISPONIBLES

### Autenticación:
- ✅ `POST /api/auth/login` - Login (email/password)
  - Usa cookies httpOnly para autenticación
  - Verifica aprobación de labs (si role=LAB, debe estar APPROVED)
- ✅ `POST /api/auth/register` - Registro genérico (solo para CUSTOMER)
- ✅ `POST /api/auth/register-photographer` - Registro específico de fotógrafos
- ✅ `POST /api/auth/register-lab` - Registro específico de laboratorios
  - Crea User y Lab en transacción
  - Estado inicial: PENDING (requiere aprobación admin)
- ✅ `POST /api/auth/logout` - Cerrar sesión (limpia cookie)
- ✅ `GET /api/auth/google` - Iniciar OAuth de Google
- ✅ `GET /api/auth/google/callback` - Callback de OAuth

### Fotógrafo:
- ✅ `GET /api/fotografo/[id]` - Obtener datos del fotógrafo
- ✅ `PATCH /api/fotografo/update` - Actualizar datos del fotógrafo
- ✅ `POST /api/fotografo/upload-logo` - Subir logo (PNG)
- ✅ `GET /api/fotografo/clientes?photographerId=X` - Listar clientes del fotógrafo
- ✅ `GET /api/fotografo/pedidos?photographerId=X` - Listar pedidos del fotógrafo

### Cliente (CUSTOMER):
- ✅ `GET /api/cliente/pedidos?clientId=X&customerEmail=X` - Listar pedidos del cliente

### Laboratorio:
- ✅ `GET /api/labs?search=X` - Listar laboratorios (con búsqueda)
- ✅ `GET /api/lab/[id]` - Obtener datos del laboratorio
- ✅ `PATCH /api/lab/[id]` - Actualizar datos del laboratorio (personalización)
- ✅ `POST /api/lab/create` - Crear laboratorio asociado a usuario (registro)
- ✅ `GET /api/lab/by-user/[userId]` - Obtener laboratorio por userId
- ✅ `POST /api/lab/upload-logo` - Subir logo PNG del laboratorio
- ✅ `GET /api/lab/pricing?labId=X` - Obtener precios del laboratorio
- ✅ `PUT /api/lab/pricing` - Actualizar precios del laboratorio
- ✅ `GET /api/lab/products?labId=X` - Listar productos del laboratorio
- ✅ `PUT /api/lab/products` - Actualizar productos (crear/editar/eliminar)
- ✅ `GET /api/lab/clientes?labId=X&search=X` - Listar clientes del laboratorio

### Pedidos:
- ✅ `POST /api/print-orders` - Crear pedido
- ✅ `GET /api/print-orders?limit=X` - Listar pedidos
- ✅ `GET /api/print-orders/[id]/export` - Exportar ZIP de imágenes del pedido
- ✅ `PATCH /api/print-orders/[id]/status` - Actualizar estado de un pedido
- ✅ `PATCH /api/print-orders/bulk-status` - Actualizar estado masivo de pedidos

### Sistema:
- ✅ `GET /api/system-settings?key=X` - Obtener configuración del sistema
- ✅ `POST /api/contact` - Enviar formulario de contacto

### Uploads:
- ✅ `POST /api/uploads` - Subir archivos
- ✅ `POST /api/print-orders/uploads` - Subir imágenes para pedidos

---

---

## 👑 PANEL DE ADMINISTRACIÓN (`/admin`)

### Funcionalidades:

#### Autenticación:
- ✅ Login (`/admin/login`)
  - Email/password
  - Verificación de rol ADMIN
  - Usa cookies httpOnly para seguridad
  - Redirige a `/admin` tras login exitoso

#### Solapas y Funcionalidades:

#### 1. **Laboratorios**
- ✅ Listado de todos los laboratorios
- ✅ Filtro por estado: Todos, Pendientes, Aprobados, Rechazados
- ✅ Información mostrada:
  - ID, Nombre, Email, Ciudad
  - Estado de aprobación (badge con color)
  - Fecha de creación
- ✅ Acciones:
  - Botón "Aprobar" (cambia a APPROVED y activa el lab)
  - Botón "Rechazar" (cambia a REJECTED)
  - Solo visible para labs con estado PENDING
- ✅ Tabla responsive con scroll horizontal
- ✅ Carga automática al activar la solapa

#### 2. **Usuarios**
- ✅ Listado de todos los usuarios del sistema
- ✅ Filtros:
  - Por rol: Todos, Admin, Fotógrafo, Laboratorio, Cliente
  - Búsqueda por texto: email, nombre, teléfono
- ✅ Información mostrada:
  - ID, Nombre, Email, Rol (badge), Teléfono, Fecha de creación
- ✅ Tabla responsive con scroll horizontal
- ✅ Carga automática al activar la solapa

#### 3. **Pedidos**
- ✅ Listado de todos los pedidos (PrintOrder)
- ✅ Filtros:
  - Por estado: Todos, Creado, En producción, Listo para retirar, Enviado, Entregado, Cancelado
  - Búsqueda por texto: cliente (nombre/email/teléfono)
- ✅ Información mostrada:
  - ID, Cliente, Email, Laboratorio, Total, Estado, Fecha
- ✅ Incluye relaciones: lab, photographer, client
- ✅ Tabla responsive con scroll horizontal
- ✅ Carga automática al activar la solapa

#### 4. **Configuración**
- ✅ Configuración global del sistema
- ✅ Campos editables:
  - **Precio Mínimo de Foto Digital** (en pesos)
    - Ejemplo: 1000 = $10.00 ARS
    - Input numérico
  - **Porcentaje de Comisión de la Plataforma** (%)
    - Rango: 0-100
    - Input numérico
- ✅ Botón "Guardar Configuración"
- ✅ Mensajes de éxito/error
- ✅ Carga automática al activar la solapa

#### Características adicionales:
- ✅ Header con título "Panel de Administración"
- ✅ Botón "Cerrar sesión" en el header
- ✅ Redirección automática a `/admin/login` si no está autenticado
- ✅ Verificación de rol ADMIN en todas las APIs
- ✅ Estilo consistente con otros paneles (tabs, cards, tablas)

### Protección de rutas:
- ✅ Todas las APIs del admin verifican autenticación y rol ADMIN
- ✅ Panel `/admin` verifica autenticación al cargar
- ✅ Redirección automática a login si no está autenticado

---

## 📋 NUEVAS FUNCIONALIDADES PENDIENTES

*(Espacio para guardar funcionalidades que el usuario vaya mencionando)*

### Solapas adicionales para Panel del Laboratorio:
- ⏳ **Reportes** - Estadísticas de pedidos, ventas, clientes
- ⏳ **Configuración** - Datos del laboratorio, contacto, horarios
- ⏳ **Fotógrafos Asociados** - Lista de fotógrafos que usan el laboratorio
- ⏳ **Estadísticas** - Métricas de rendimiento, productos más vendidos, etc.

### Solapas adicionales para Panel de Administración:
- ⏳ **Estadísticas** - Dashboard con métricas generales del sistema
- ⏳ **Reportes** - Reportes avanzados y exportación de datos
- ⏳ **Notificaciones** - Sistema de notificaciones por email

### Funcionalidades generales:
- ⏳ Sistema de notificaciones por email (pedidos, aprobaciones, etc.)
- ⏳ Historial de cambios de estado de pedidos (auditoría)
- ⏳ Reportes avanzados para fotógrafos
- ⏳ Sistema de facturación
- ⏳ Integración completa con Mercado Pago Marketplace
