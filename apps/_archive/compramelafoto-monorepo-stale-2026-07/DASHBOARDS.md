# 📊 DASHBOARDS POR ROL

## 🎯 Ubicación de Dashboards

### 👤 **Cliente (CUSTOMER)**
- **URL:** `/cliente/pedidos`
- **Funcionalidades:**
  - Ver mis pedidos
  - Estado de pedidos
  - Descargas digitales (pendiente de implementar según MEGA PROMPT)
  - Álbumes visitados (pendiente de implementar según MEGA PROMPT)

### 📸 **Fotógrafo (PHOTOGRAPHER)**
- **Dashboard Principal:** `/fotografo/configuracion`
  - Solapas: Datos Personales, Diseño, Laboratorio y Márgenes, Clientes, Pedidos
- **Dashboard de Álbumes:** `/dashboard/albums`
  - Gestión completa de álbumes
  - Subida de fotos
  - Configuración de precios

### 🖨️ **Laboratorio (LAB / LAB_PHOTOGRAPHER)**
- **URL:** `/lab/configuracion`
- **Solapas:**
  - Pedidos
  - Clientes
  - Productos
  - Precios
  - Configuración

### 🔐 **Admin (ADMIN)**
- **URL:** `/admin`
- **Funcionalidades:**
  - Gestión de laboratorios
  - Gestión de fotógrafos
  - Logs de auditoría
  - Configuración del sistema

---

## 🔄 Cambios Implementados

### ✅ Header Mejorado
- Verifica autenticación por cookies (método principal)
- También verifica sessionStorage (método legacy)
- Muestra "Cerrar sesión" cuando hay usuario autenticado
- Oculta "Iniciar sesión" cuando ya hay sesión activa
- Botones de acceso rápido según rol:
  - Fotógrafo → "Mi Panel" → `/fotografo/configuracion`
  - Cliente → "Mis Pedidos" → `/cliente/pedidos`
  - Laboratorio → "Mi Panel" → `/lab/configuracion`
  - Admin → "Admin" → `/admin`

### ✅ Logout Mejorado
- Limpia sessionStorage completamente
- Limpia cookies de autenticación
- Redirige a `/login?logout=success`
- Muestra mensaje de confirmación en la página de login

### ✅ Endpoint `/api/auth/me`
- Devuelve el usuario autenticado actual
- Devuelve `null` si no hay usuario (no es un error)
- Compatible con todos los roles

---

## 🚀 Cómo Acceder

1. **Iniciar Sesión:**
   - Click en "Iniciar sesión" en el header
   - O ir directamente a `/login`, `/fotografo/login`, `/cliente/login`, o `/lab/login`

2. **Acceder al Dashboard:**
   - Después de iniciar sesión, el header mostrará un botón "Mi Panel" o "Mis Pedidos"
   - También puedes ir directamente a las URLs mencionadas arriba

3. **Cerrar Sesión:**
   - Click en "Cerrar sesión" en el header
   - Serás redirigido a `/login` con mensaje de confirmación

---

## 📝 Notas

- El sistema ahora previene múltiples inicios de sesión mostrando "Cerrar sesión" cuando ya hay una sesión activa
- La autenticación funciona tanto con cookies (método principal) como con sessionStorage (método legacy)
- Todos los roles tienen acceso a sus respectivos dashboards
