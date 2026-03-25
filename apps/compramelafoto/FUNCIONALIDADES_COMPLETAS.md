# 📋 FUNCIONALIDADES COMPLETAS - ComprameLaFoto

## 🎯 RESUMEN DEL PROYECTO

**ComprameLaFoto** es una plataforma completa para gestión de fotografía que conecta fotógrafos, clientes y laboratorios. Permite venta de fotos digitales e impresas, gestión de álbumes, procesamiento de pedidos y pagos.

---

## 📸 PANEL DEL FOTÓGRAFO

### 1. **Dashboard de Álbumes** (`/dashboard/albums`)
#### ✅ Gestión de Álbumes:
- Creación de álbumes con modal completo (2 solapas: Datos y Precios)
- Edición de álbumes con todas las configuraciones
- Eliminación de álbumes (colaborativos o individuales)
- Vista de lista de álbumes con preview de portada
- **Botón de visualización** (icono de ojito) para ver el álbum como cliente
- Automático: primera foto subida se establece como portada
- **Eliminación automática:** 30 días desde la primera foto subida (no desde creación)
- **Extensión de tiempo:** Reactivación disponible por 15 días adicionales después de los 30 días
- **Visualización de fecha de eliminación:** Solo se muestra si el álbum tiene fotos

#### ✅ Configuración de Álbumes:
- **Datos del álbum:**
  - Título, ubicación, fecha del evento
- **Precios y configuración:**
  - **Tipos de venta habilitados:**
    - Habilitar/deshabilitar venta de fotos impresas
    - Habilitar/deshabilitar venta de fotos digitales
    - Opción: incluir archivo digital con la compra de impresión
  - **Configuración de impresiones:**
    - Selección de laboratorio específico por álbum
    - Margen de ganancia específico por álbum (sin límite)
    - Método de retiro: Cliente (en laboratorio) o Fotógrafo (entrega)
  - **Calculadora de precios:**
    - Calculadora de fotos impresas (con descuentos, comisión, margen)
    - Calculadora de fotos digitales (precio configurable por álbum)

#### ✅ Gestión de Fotos en Álbumes (`/dashboard/albums/[id]`):
- Subida de fotos con drag & drop
- Aplicación automática de marca de agua en previews
- Grid responsive de fotos
- Selección de foto de portada
- Eliminación de fotos individuales
- Link "Vista del cliente" con preview
- Botón "Copiar enlace" para compartir

### 2. **Panel de Configuración** (`/fotografo/configuracion`)
#### ✅ Solapa: Datos Personales
- Email (solo lectura)
- Nombre completo, teléfono
- Ciudad, provincia, país, domicilio
- Fecha de nacimiento
- Datos de empresa: nombre, titular, CUIT

#### ✅ Solapa: Diseño y Página Pública
- Carga de logo PNG (preview incluido)
- Color principal (picker + hex)
- Color secundario (picker + hex)
- **Color terciario/accent** (picker + hex) - Para botones, bordes y recuadros
- Habilitar/deshabilitar página pública
- Handler personalizado (URL amigable)
- **Habilitar sección "Mis Álbumes"** - Muestra galería de álbumes en página pública
- **Habilitar sección "Imprimir"** - Muestra botón para imprimir fotos propias
- Generación de código QR
- Vista previa de URL
- Botón "Ver mi página" (con validación de configuración completa)

#### ✅ Solapa: Laboratorio y Márgenes
- Selección de laboratorio preferido (búsqueda en tiempo real)
- Modal "Ver precios" del laboratorio
- Margen de ganancia configurable (0-100%+)
- **Calculadora de costos y ganancias:**
  - Fotos impresas: desglose completo (costo base, descuentos, comisión, margen)
  - Fotos digitales: precio y ganancia neta

#### ✅ Solapa: Página Pública
- Habilitar/deshabilitar página pública
- Handler personalizado (URL amigable)
- Generación de código QR
- Vista previa de URL
- Botón "Ver mi página"

#### ✅ Solapa: Clientes
- Tabla de clientes históricos
- Búsqueda en tiempo real
- Exportación a CSV
- **Botones de acción:**
  - **WhatsApp** (icono) - Visible solo si el cliente tiene teléfono cargado
  - **Editar** (icono de lápiz) - Edición inline de nombre y teléfono (email no editable)
  - **Eliminar** (icono de basura) - Elimina registros de notificaciones y pedidos "fantasma"
- Agrupación automática por email/teléfono
- Totales: pedidos y gastado

#### ✅ Solapa: Pedidos
- Listado de pedidos del fotógrafo
- Información detallada por pedido
- Filtros y búsqueda

---

## 👤 PANEL DEL CLIENTE (`/cliente/pedidos`)

### ✅ Funcionalidades:
- Listado de pedidos del cliente autenticado
- Información de cada pedido:
  - Número, fecha, estado, total, cantidad de items
- Link para crear nuevo pedido
- Logout

---

## 🏭 PANEL DEL LABORATORIO (`/lab/configuracion`)

### ✅ Solapa: Pedidos
- Listado de todos los pedidos (últimos 200)
- Filtrado por estado (7 estados: Creado, En producción, Listo para retirar, Enviado, Entregado, Cancelado, Todos)
- Búsqueda en tiempo real (cliente, email, WhatsApp, fecha, total, items)
- Selección múltiple de pedidos (checkbox)
- Cambio de estado masivo
- Información completa: ID, cliente, email, WhatsApp, fotógrafo, retira, fechas, items, total
- Botón "Descargar ZIP" por pedido (export de imágenes)
- Contador de pedidos visibles/totales
- Botón "Limpiar" para resetear filtros

### ✅ Solapa: Clientes
- Tabla de clientes históricos con búsqueda
- Exportación a CSV
- **Botones de acción:**
  - **WhatsApp** (icono) - Visible solo si el cliente tiene teléfono cargado
  - **Editar** (icono de lápiz) - Edición inline de nombre y teléfono (email no editable)
  - **Eliminar** (icono de basura) - Elimina pedidos "fantasma" (CANCELED, total 0)
- Agrupación automática

### ✅ Solapa: Precios
- Configuración de precios base por tamaño (10x15, 13x18, 15x20, etc.)
- Configuración de descuentos por cantidad (50+, 100+)
- Tabla editable con guardar/recargar
- Mensajes explicativos

### ✅ Solapa: Productos
- Gestión de productos con dos precios:
  - Precio Mayorista (Fotógrafo)
  - Precio Retail (Cliente Final)
- Campos: nombre, tamaño, precios, estado (Activo/Inactivo)
- Agregar/eliminar productos
- Validación de campos

### ✅ Solapa: Diseño
- Carga de logo PNG
- Color principal y secundario
- Preview de logo actual

### ✅ Solapa: Página Pública
- Habilitar página personalizada
- Handler personalizado
- Código QR para compartir
- Botón "Ver mi página"

---

## 👑 PANEL DE ADMINISTRACIÓN (`/admin`)

### ✅ Solapa: Laboratorios
- Listado de todos los laboratorios
- Filtro por estado: Todos, Pendientes, Aprobados, Rechazados
- Botones "Aprobar" y "Rechazar" para labs pendientes
- Información: ID, nombre, email, ciudad, estado, fecha

### ✅ Solapa: Usuarios
- Listado de todos los usuarios
- Filtros por rol (Admin, Fotógrafo, Laboratorio, Cliente)
- Búsqueda por texto (email, nombre, teléfono)
- Información: ID, nombre, email, rol, teléfono, fecha

### ✅ Solapa: Pedidos
- Listado de todos los pedidos
- Filtros por estado
- Búsqueda por cliente
- Información completa con relaciones

### ✅ Solapa: Configuración
- Precio mínimo de foto digital (en pesos)
- Porcentaje de comisión de la plataforma (0-100%)
- Guardar configuración global

---

## 🛍️ FLUJOS DE VENTA

### 1. **Flujo de Álbum del Fotógrafo** (`/a/[id]`)
#### ✅ Vista del Cliente:
- **Página de visualización** (`/a/[id]`):
  - **Header y Footer personalizados** del fotógrafo (logo y colores)
  - **Álbumes sin fotos:**
    - Mensaje "Las fotos serán subidas próximamente"
    - Formulario para dejar nombre y email (nombre obligatorio)
    - Notificación automática cuando se suban las primeras fotos
    - Protección anti-captura deshabilitada cuando no hay fotos
    - Miniatura del álbum con logo y mensaje
  - **Álbumes con fotos:**
    - Grid de fotos con marca de agua
    - Protección anti-captura de pantalla:
      - Blur al detectar teclas (Print Screen, Cmd+Shift, Shift+S)
      - Logo de watermark en centro con mensaje
      - Context menu personalizado ("@compramelafoto")
      - Prevención de clic derecho para descargar
    - Selección visual de fotos (checkboxes)
    - Botón "Comprar seleccionadas"
  - **Búsqueda por publicSlug o ID** (compatibilidad hacia atrás)

- **Página de compra** (`/a/[id]/comprar`):
  - **Header y Footer personalizados** del fotógrafo
  - Lista de fotos seleccionadas
  - **Selector de tipo de compra:**
    - Digital (si está habilitado)
    - Impresa (si está habilitado, con tamaños del laboratorio)
  - Precios calculados según:
    - Laboratorio seleccionado del álbum
    - Margen de ganancia del álbum (o del fotógrafo)
    - Precio digital configurado en el álbum
  - Mensaje si archivo digital incluido con impresión
  - Mensaje de retiro (laboratorio o fotógrafo)
  - Botón "Volver al álbum"
  - Resumen de totales
  - **Aplicación de color terciario** en bordes, botones y elementos seleccionados

- **Página de resumen** (`/a/[id]/comprar/resumen`):
  - **Header y Footer personalizados** del fotógrafo
  - Confirmación de items
  - Información de retiro
  - Total final
  - Continuar con datos del cliente

### 2. **Flujo Estándar de Impresión** (`/imprimir`)
#### ✅ Flujo completo:
- **Subida** (`/imprimir`):
  - Drag & drop de fotos
  - Preview en grid
  - Cálculo de precios con descuentos
- **Configuración** (`/imprimir/configurar`):
  - Selectores: tamaño, acabado, cantidad
  - Precios dinámicos
- **Resumen** (`/imprimir/resumen`):
  - Lista de items con totales
  - Botón "Modificar pedido"
- **Datos del cliente** (`/imprimir/datos`):
  - Formulario completo
  - Pre-llenado si está autenticado
  - Opción de retiro
- **Confirmación** (`/imprimir/confirmacion`):
  - Mensaje de éxito
  - Número de pedido

### 3. **Flujo del Fotógrafo Personalizado** (`/f/[handler]`)
#### ✅ Características:
- **Página home personalizada** (`/f/[handler]`):
  - Logo y colores personalizados (primario, secundario, terciario)
  - Footer personalizado
  - **Sección "Mis Álbumes"** (si está habilitada):
    - Vista previa de todos los álbumes del fotógrafo (propios e invitados)
    - Cards con miniatura, título y link al álbum
    - Diseño responsive con colores personalizados
  - **Sección "Imprimir tus propias fotos"** (si está habilitada):
    - Card con diseño personalizado
    - Botón que lleva a `/f/[handler]/imprimir`
  - Botón "Ver mi página" en panel de configuración (validación de configuración completa)
- **Página de álbumes** (`/f/[handler]/albums`):
  - Lista completa de álbumes del fotógrafo
  - Diseño consistente con branding personalizado
- **Flujo de impresión** (`/f/[handler]/imprimir`):
  - Igual al flujo estándar pero con branding del fotógrafo
  - Usa precios del laboratorio preferido
  - Aplica margen de ganancia del fotógrafo
  - **Aplicación de color terciario** en elementos interactivos

---

## 💳 SISTEMA DE PAGOS

### ✅ Integración Mercado Pago:
- Creación de preferencia de pago (`/api/payments/mp/create-preference`)
- Webhook para confirmación de pagos (`/api/payments/mp/webhook`)
- Páginas de resultado:
  - `/pago/success` - Pago exitoso
  - `/pago/pending` - Pago pendiente
  - `/pago/failure` - Pago fallido
- **Pendiente:** Envío de emails con links de descarga para fotos digitales

---

## 🔐 SISTEMA DE AUTENTICACIÓN

### ✅ Todos los roles:
- Login con email/password
- Google OAuth (fotógrafos y clientes)
- Registro completo por rol
- Cookies httpOnly para seguridad
- Verificación de roles en todas las rutas

### ✅ Roles disponibles:
1. **PHOTOGRAPHER** - Fotógrafos
2. **CUSTOMER** - Clientes
3. **LAB** - Laboratorios (requiere aprobación admin)
4. **ADMIN** - Administradores

---

## 📱 PÁGINAS PÚBLICAS

### ✅ Fotógrafos (`/f/[handler]`):
- Home personalizado con secciones configurables:
  - Sección "Mis Álbumes" (habilitable/deshabilitable)
  - Sección "Imprimir tus propias fotos" (habilitable/deshabilitable)
- Logo y colores personalizados (primario, secundario, terciario)
- Header y Footer personalizados en todas las páginas
- Página de álbumes (`/f/[handler]/albums`)
- Flujo completo de impresión personalizado (`/f/[handler]/imprimir`)

### ✅ Laboratorios (`/l/[handler]`):
- Página pública del laboratorio
- Logo y colores personalizados

---

## 🗄️ BASE DE DATOS (Prisma)

### ✅ Modelos principales:
- **User**: Roles, datos personales, configuración, personalización
  - `tertiaryColor`: Color terciario/accent para botones y bordes
  - `enableAlbumsPage`: Habilitar sección "Mis Álbumes" en página pública
  - `enablePrintPage`: Habilitar sección "Imprimir" en página pública
- **Album**: Título, ubicación, fecha, precios, laboratorio, pickup, habilitaciones
  - `publicSlug`: Slug único para acceso público
  - `showComingSoonMessage`: Mostrar mensaje cuando no hay fotos
  - `firstPhotoDate`: Fecha de primera foto (para calcular expiración)
  - `isHidden`: Estado de ocultación (para reactivación)
- **Photo**: Previews con watermark, originales sin watermark
- **PrintOrder**: Pedidos con estado, cliente, fotógrafo, laboratorio
- **OrderItem**: Items de pedidos (tipo: digital/impresa)
- **AlbumNotification**: Notificaciones de clientes interesados en álbumes
  - Registro de nombre y email cuando álbum no tiene fotos
  - Tracking de notificaciones enviadas (cuando listo, 3 semanas, 2 semanas, 1 semana)
- **Lab**: Datos del laboratorio, aprobación, personalización
- **LabBasePrice**: Precios base por tamaño
- **LabSizeDiscount**: Descuentos por cantidad
- **AppConfig**: Configuración del sistema (precio mínimo digital, comisión)

---

## 🎨 INTERFAZ Y UX

### ✅ Características:
- Diseño inspirado en Squarespace
- Responsive (mobile, tablet, desktop)
- Componentes reutilizables (Button, Card, Input, Select, Tabs)
- Paleta de colores consistente
- Iconos SVG inline
- Transiciones y estados hover
- Feedback visual (loading, éxito, error)
- Modales y solapas
- Formularios con validación

---

## 🔌 APIs DISPONIBLES

### ✅ Autenticación:
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro (CUSTOMER)
- `POST /api/auth/register-photographer` - Registro fotógrafos
- `POST /api/auth/register-lab` - Registro laboratorios
- `POST /api/auth/logout` - Logout
- `GET /api/auth/google` - OAuth Google
- `GET /api/auth/google/callback` - Callback OAuth

### ✅ Fotógrafo:
- `GET /api/dashboard/photographer` - Datos del fotógrafo
- `GET /api/dashboard/albums` - Lista de álbumes
- `POST /api/dashboard/albums` - Crear álbum
- `PUT /api/dashboard/albums/[id]` - Actualizar álbum
- `DELETE /api/dashboard/albums/[id]` - Eliminar álbum
- `GET /api/dashboard/albums/[id]` - Detalle del álbum
- `POST /api/dashboard/albums/[id]/photos` - Subir fotos
- `PATCH /api/dashboard/albums/[id]/cover` - Establecer portada
- `GET /api/a/[id]/order-photos` - Fotos y precios para cliente
- `POST /api/a/[id]/orders` - Crear orden de álbum
- `POST /api/a/[id]/notifications` - Registrar notificación de cliente interesado
- `GET /api/fotografo/[id]` - Datos del fotógrafo (público)
- `PATCH /api/fotografo/update` - Actualizar configuración del fotógrafo
- `PATCH /api/fotografo/clientes/[email]` - Actualizar datos de cliente
- `DELETE /api/fotografo/clientes/[email]` - Eliminar cliente y registros relacionados

### ✅ Laboratorio:
- `GET /api/labs` - Listar laboratorios
- `GET /api/lab/pricing` - Precios del laboratorio
- `PUT /api/lab/pricing` - Actualizar precios
- `GET /api/lab/products` - Productos
- `PUT /api/lab/products` - Actualizar productos
- `PATCH /api/lab/clientes/[email]` - Actualizar datos de cliente
- `DELETE /api/lab/clientes/[email]` - Eliminar cliente y registros relacionados

### ✅ Pedidos:
- `POST /api/print-orders` - Crear pedido
- `GET /api/print-orders` - Listar pedidos
- `GET /api/print-orders/[id]/export` - Exportar ZIP
- `PATCH /api/print-orders/[id]/status` - Cambiar estado
- `PATCH /api/print-orders/bulk-status` - Cambio masivo

### ✅ Sistema:
- `GET /api/config` - Configuración pública
- `POST /api/contact` - Formulario de contacto
- `POST /api/cron/cleanup-expired-albums` - Limpieza de álbumes expirados
- `GET /api/cron/send-album-notifications` - Envío de notificaciones automáticas (protegido con CRON_SECRET)

---

## 🚀 FUNCIONALIDADES ESPECIALES

### ✅ Seguridad y Protección:
- Marca de agua automática en previews
- Protección anti-captura de pantalla en álbumes
- Context menu personalizado
- Cookies httpOnly para autenticación
- Validación de roles en todas las rutas

### ✅ Automatización:
- **Gestión de expiración de álbumes:**
  - Eliminación automática: 30 días desde la primera foto subida (no desde creación)
  - Archivos originales permanecen 15 días adicionales para que el laboratorio pueda imprimir pedidos
  - Reactivación disponible por 15 días adicionales después de los 30 días
- Primera foto como portada automática
- Agrupación automática de clientes
- Cálculo automático de precios con descuentos
- **Sistema de notificaciones automáticas:**
  - Notificación cuando se suben las primeras fotos a un álbum
  - Recordatorios automáticos: 3 semanas, 2 semanas y 1 semana antes de eliminación
  - Endpoint CRON: `/api/cron/send-album-notifications`

### ✅ Personalización:
- Logos personalizados para fotógrafos y laboratorios
- **Tres colores configurables:**
  - Color primario (fondos principales, textos destacados)
  - Color secundario (fondos alternativos, acentos)
  - Color terciario/accent (botones, bordes, recuadros, elementos seleccionados)
- Handlers personalizados para URLs amigables
- Branding completo en páginas públicas (header y footer personalizados)
- Secciones configurables en página pública del fotógrafo

---

## ⏳ FUNCIONALIDADES PENDIENTES / POR MEJORAR

### 🔴 Críticas:
1. **Completar flujo de pago para álbumes:**
   - Crear página `/a/[id]/comprar/datos` (formulario del cliente)
   - Integrar Mercado Pago para pedidos de álbumes
   - Webhook debe enviar emails con links de descarga para fotos digitales pagadas

2. **Notificaciones por email (parcialmente implementado):**
   - ✅ Sistema de notificaciones de álbumes (cuando se suben fotos, recordatorios de expiración)
   - ⏳ Confirmación de pedidos
   - ⏳ Links de descarga para fotos digitales pagadas
   - ⏳ Notificaciones de cambios de estado de pedidos

### 🟡 Importantes:
3. **Estadísticas y reportes:**
   - Dashboard con métricas para fotógrafos
   - Reportes de ventas para laboratorios
   - Analytics de álbumes (vistas, conversiones)

4. **Mejoras en UX:**
   - Búsqueda avanzada en álbumes
   - Filtros y ordenamiento en listas
   - Paginación en listados grandes
   - Optimización de carga de imágenes

5. **Gestión de clientes mejorada:**
   - ✅ Edición inline de datos de clientes
   - ✅ Eliminación de clientes y registros relacionados
   - ✅ Botones de acción (WhatsApp, editar, eliminar)
   - ⏳ Historial completo de interacciones
   - ⏳ Comentarios y notas
   - ⏳ Seguimiento de preferencias

### 🟢 Opcionales:
6. **Funcionalidades adicionales:**
   - Sistema de facturación
   - Integración con redes sociales
   - App móvil
   - Chat en tiempo real
   - Programación de publicaciones
   - Galería de portafolio público

---

## 📊 ESTADO ACTUAL DEL PROYECTO

### ✅ Completado: ~92%
- Autenticación completa: 100%
- Paneles de gestión: 98%
- Flujo de álbumes: 95% (falta integración de pago completa)
- Flujo de impresión estándar: 100%
- Flujo de impresión personalizado del fotógrafo: 100%
- Sistema de precios: 100%
- Gestión de pedidos: 98%
- Integración Mercado Pago: 50% (básico, falta para álbumes)
- **Página pública del fotógrafo:** 100%
- **Sistema de notificaciones de álbumes:** 100%
- **Gestión de clientes mejorada:** 100%
- **Personalización avanzada (3 colores):** 100%
- **Extensión y reactivación de álbumes:** 100%

### ⏳ En progreso: ~5%
- Optimizaciones de UX
- Mejoras de rendimiento
- Integración de servicio de email real (Resend/SendGrid)

### ❌ Pendiente: ~3%
- Completar flujo de pago de álbumes (página de datos del cliente)
- Notificaciones por email para pedidos (confirmación, descarga, cambios de estado)
- Estadísticas y reportes avanzados

---

## 🎯 PRIORIDADES SUGERIDAS

1. **Completar flujo de pago de álbumes** (crítico para funcionamiento completo)
2. **Sistema de emails** (mejora la experiencia del cliente)
3. **Dashboard de estadísticas** (valor agregado para usuarios)
4. **Optimizaciones de rendimiento** (escalabilidad)
5. **Funcionalidades avanzadas** (diferenciación)

---

---

## 🆕 FUNCIONALIDADES RECIENTES (Última actualización)

### ✅ Implementado en esta versión:
1. **Tercer color configurable (tertiaryColor)** - Para botones, bordes y elementos seleccionados
2. **Página pública del fotógrafo mejorada** - Con secciones configurables (Mis Álbumes, Imprimir)
3. **Sistema de notificaciones de álbumes** - Registro de clientes interesados cuando no hay fotos
4. **Extensión de tiempo de álbumes** - 15 días adicionales después de 30 días para impresión
5. **Botones de acción en tablas de clientes** - WhatsApp, editar inline, eliminar
6. **Header y Footer personalizados** - Del fotógrafo en todas las páginas del flujo de álbumes
7. **Visualización de álbumes sin fotos** - Con mensaje y formulario de notificación
8. **Fecha de expiración basada en primera foto** - No desde creación del álbum
9. **Botón de visualización de álbum** - Icono de ojito en panel de álbumes
10. **Reactivación de álbumes** - Disponible por 15 días adicionales después de expiración

---

**Última actualización:** Enero 2026
**Versión del proyecto:** 1.1 (Beta)
