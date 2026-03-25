# 📋 DOCUMENTACIÓN COMPLETA: PROCESOS DE PAGO Y PUNTOS DE COMPRA

## 🎯 RESUMEN EJECUTIVO

ComprameLaFoto tiene **2 flujos principales de compra**:
1. **Compra de Fotos Digitales/Impresas desde Álbumes** (`/a/[id]/comprar`)
2. **Compra de Impresiones desde Home Público/Fotógrafo/Laboratorio** (`/imprimir`)

Ambos flujos utilizan **Mercado Pago** como procesador de pagos, pero con diferentes modelos de datos y APIs.

---

## 🛒 FLUJO 1: COMPRA DESDE ÁLBUMES (`/a/[id]/comprar`)

### 📍 Punto de Entrada
- **Ruta:** `/app/a/[id]/comprar/page.tsx`
- **Componente:** `AlbumComprarPage` (Client Component)
- **Descripción:** Permite comprar fotos digitales e impresas desde un álbum específico

### 🗂️ Almacenamiento del Carrito
- **Método:** `sessionStorage`
- **Clave:** `orderItems` (almacena array de items)
- **Estructura del Item:**
```typescript
type Item = {
  fileKey: string;        // Clave única del archivo en S3/storage
  previewUrl: string;     // URL de preview de la foto
  originalName: string;   // Nombre original del archivo
  size: string;           // Tamaño de impresión (ej: "10x15", "15x20")
  finish: "BRILLO" | "MATE"; // Acabado
  quantity: number;       // Cantidad
  tipo?: "digital" | "impresa"; // Tipo de foto
};
```

### 💰 Cálculo de Precios
- **Fotos Digitales:**
  - Precio: `albumPricing.digitalPhotoPriceCents` (en ARS)
  - Se obtiene del álbum (`/api/dashboard/albums/[id]`)
  
- **Fotos Impresas:**
  - Precio base: Se obtiene de `LabBasePrice` del laboratorio preferido del fotógrafo
  - Descuentos: Se aplican descuentos por cantidad (50+ y 100+ unidades del mismo tamaño)
  - Margen del fotógrafo: Se suma `profitMarginPercent` del álbum
  - Cálculo:
    ```
    precioBase = LabBasePrice.unitPrice
    descuento = calcularDescuentoPorCantidad(cantidadTotalPorTamaño, descuentos50, descuentos100)
    precioConDescuento = precioBase * (1 - descuento/100)
    precioFinal = precioConDescuento * (1 + profitMarginPercent/100)
    ```

### 📤 Creación del Pedido
- **API:** `POST /api/a/[id]/orders`
- **Endpoint:** `/app/api/a/[id]/orders/route.ts`
- **Body:**
```json
{
  "buyerEmail": "string (requerido)",
  "buyerName": "string (opcional)",
  "buyerPhone": "string (opcional)",
  "items": [
    {
      "fileKey": "string",
      "tipo": "digital" | "impresa",
      "size": "string (si es impresa)",
      "finish": "BRILLO" | "MATE (si es impresa)",
      "quantity": "number",
      "priceCents": "number"
    }
  ]
}
```

### 💾 Modelo de Datos (Prisma)
- **Tabla:** `Order` (pedidos de álbum)
- **Campos principales:**
  - `id`, `albumId`, `buyerEmail`, `buyerName`, `buyerPhone`
- `totalCents` (precio total en pesos)
  - `status`: `PENDING` | `PAID` | `FAILED` | `REFUNDED`
  - `items`: Relación con `OrderItem[]`
- **Tabla:** `OrderItem`
  - `id`, `orderId`, `photoId`, `priceCents`

### 💳 Proceso de Pago
- **NOTA:** Este flujo **NO tiene integración con Mercado Pago aún**
- El pedido se crea con `status: "PENDING"`
- **Pendiente:** Implementar creación de preferencia MP y redirección al checkout

---

## 🖨️ FLUJO 2: COMPRA DE IMPRESIONES (`/imprimir`)

### 📍 Puntos de Entrada
1. **Home Público:** `/imprimir`
2. **Home del Fotógrafo:** `/f/[handler]/imprimir`
3. **Home del Laboratorio:** `/l/[handler]/imprimir`

### 🗂️ Almacenamiento del Carrito
- **Método:** `sessionStorage`
- **Claves:**
  - `orderItems`: Array de items del pedido
  - `uploadedPhotos`: Array de fotos subidas (para el flujo del fotógrafo/lab)
- **Estructura del Item:**
```typescript
type Item = {
  fileKey: string;        // Clave única del archivo
  originalName: string;   // Nombre original
  size: string;           // Tamaño (ej: "10x15")
  finish: string;         // "BRILLO" | "MATE"
  quantity: number;       // Cantidad
};
```

### 📋 Flujo Completo de Pasos

#### 1. **Subida de Fotos** (`/imprimir`)
- **Componente:** `app/imprimir/page.tsx`
- Drag & drop de fotos
- Preview en grid
- Cálculo de precios con descuentos en tiempo real

#### 2. **Configuración** (`/imprimir/configurar`)
- Selectores: tamaño, acabado, cantidad
- Precios dinámicos según selección
- Guarda en `sessionStorage` como `orderItems`

#### 3. **Resumen** (`/imprimir/resumen`)
- Lista de items con totales
- Botón "Modificar pedido" (vuelve a configurar)

#### 4. **Datos del Cliente** (`/imprimir/datos`)
- **Componente:** `app/imprimir/datos/page.tsx`
- Formulario completo:
  - `customerName`, `customerEmail`, `customerPhone`
  - `pickupBy`: `"CLIENT"` | `"PHOTOGRAPHER"`
- Pre-llenado si el cliente está autenticado (desde `sessionStorage.client`)
- Carga precios del laboratorio desde `/api/lab/pricing`

#### 5. **Confirmación** (`/imprimir/confirmacion`)
- Mensaje de éxito
- Número de pedido
- Redirección a Mercado Pago

### 💰 Cálculo de Precios (Backend)
- **API:** `POST /api/print-orders`
- **Endpoint:** `/app/api/print-orders/route.ts`
- **Lógica:**
  1. Normaliza items (valida `fileKey`, `size`, `quantity`)
  2. Calcula cantidad total **por tamaño** (para descuentos)
  3. Trae precios base de `LabBasePrice` para esos tamaños
  4. Trae descuentos de `LabSizeDiscount` (50+ y 100+ unidades)
  5. Calcula precio unitario con descuento:
     ```
     precioBase = LabBasePrice.unitPrice
     cantidadTotalPorTamaño = sum(quantity de todos los items del mismo tamaño)
     descuento = calcularDescuento(cantidadTotalPorTamaño, descuento50, descuento100)
     precioUnitarioFinal = precioBase * (1 - descuento/100)
     subtotal = precioUnitarioFinal * quantity
     ```
  6. Suma todos los subtotales para obtener `total`

### 📤 Creación del Pedido
- **API:** `POST /api/print-orders`
- **Body:**
```json
{
  "labId": "number (default: 1)",
  "photographerId": "number (opcional)",
  "clientId": "number (opcional, si cliente autenticado)",
  "customerName": "string",
  "customerEmail": "string",
  "customerPhone": "string",
  "pickupBy": "CLIENT" | "PHOTOGRAPHER",
  "items": [
    {
      "fileKey": "string",
      "size": "string",
      "quantity": "number",
      "finish": "BRILLO" | "MATE",
      "originalName": "string (opcional)"
    }
  ]
}
```

### 🔒 Validaciones Antes de Crear Pedido
1. **Laboratorio debe tener Mercado Pago conectado:**
   - `lab.mpConnectedAt != null`
   - `lab.mpAccessToken != null`
   - `lab.mpUserId != null`
2. **Laboratorio debe estar aprobado:**
   - `lab.approvalStatus === "APPROVED"`
   - `lab.isActive === true`
3. **Si hay `clientId`, verificar que el usuario existe y es `CUSTOMER`**

### 💾 Modelo de Datos (Prisma)
- **Tabla:** `PrintOrder`
- **Campos principales:**
  - `id`, `labId`, `photographerId` (opcional), `clientId` (opcional)
  - `customerName`, `customerEmail`, `customerPhone`
  - `pickupBy`: `"CLIENT"` | `"PHOTOGRAPHER"`
  - `currency`: `"ARS"` (siempre)
  - `total`: `Int` (ARS enteros, sin centavos)
  - `status`: `CREATED` | `IN_PRODUCTION` | `READY` | `READY_TO_PICKUP` | `SHIPPED` | `DELIVERED` | `PAID` | `FAILED`
  - `paymentStatus`: `PENDING` | `PAID` | `FAILED` | `REFUNDED`
  - `paymentProvider`: `"MP"` (Mercado Pago)
  - `mpInitPoint`: URL de checkout de Mercado Pago
  - `mpPreferenceId`: ID de la preferencia en MP
  - `mpPaymentId`: ID del pago en MP (después del webhook)
  - `items`: Relación con `PrintOrderItem[]`
- **Tabla:** `PrintOrderItem`
  - `id`, `orderId`, `fileKey`, `originalName`
  - `size`, `quantity`, `acabado` (finish)
  - `unitPrice`, `subtotal` (ARS enteros)

### 💳 Proceso de Pago con Mercado Pago

#### Paso 1: Crear Preferencia de Pago
- **API:** `POST /api/payments/mp/create-preference`
- **Endpoint:** `/app/api/payments/mp/create-preference/route.ts`
- **Body:**
```json
{
  "orderId": "number (ID del PrintOrder)"
}
```

- **Proceso:**
  1. Busca el `PrintOrder` con sus items
  2. Obtiene `MP_ACCESS_TOKEN` de `.env`
  3. Crea preferencia en Mercado Pago:
     ```json
     {
       "items": [{
         "title": "Impresión de fotos - Pedido #X",
         "quantity": 1,
         "unit_price": order.total,
         "currency_id": "ARS"
       }],
       "metadata": { "print_order_id": order.id },
       "external_reference": String(order.id),
       "back_urls": {
         "success": "${APP_URL}/pago/success?orderId=${order.id}",
         "failure": "${APP_URL}/pago/failure?orderId=${order.id}",
         "pending": "${APP_URL}/pago/pending?orderId=${order.id}"
       },
       "auto_return": "approved",
       "notification_url": "${APP_URL}/api/payments/mp/webhook" // Solo en producción
     }
     ```
  4. Guarda `mpInitPoint` y `mpPreferenceId` en el `PrintOrder`
  5. Actualiza `paymentStatus: "PENDING"`
  6. Retorna `{ orderId, initPoint, preferenceId }`

#### Paso 2: Redirección a Mercado Pago
- El frontend recibe `initPoint` y redirige al usuario:
  ```javascript
  window.location.href = initPoint;
  ```

#### Paso 3: Webhook de Confirmación
- **API:** `POST /api/payments/mp/webhook`
- **Endpoint:** `/app/api/payments/mp/webhook/route.ts`
- **Proceso:**
  1. Recibe notificación de Mercado Pago (query params o body JSON)
  2. Extrae `paymentId` de la notificación
  3. Consulta el pago en MP: `GET https://api.mercadopago.com/v1/payments/${paymentId}`
  4. Obtiene `external_reference` (orderId) y `status`
  5. Actualiza el `PrintOrder`:
     - Si `status === "approved"`:
       - `paymentStatus: "PAID"`
       - `status: "PAID"`
       - `mpPaymentId: String(paymentId)`
     - Si `status === "rejected"`:
       - `paymentStatus: "FAILED"`
       - `mpPaymentId: String(paymentId)`

#### Paso 4: Páginas de Resultado
- **Éxito:** `/app/pago/success/page.tsx`
  - Muestra mensaje de éxito
  - Indica que el estado final se confirma con el webhook
- **Fallido:** `/app/pago/failure/page.tsx`
  - Muestra mensaje de error
  - Permite volver e intentar nuevamente
- **Pendiente:** `/app/pago/pending/page.tsx`
  - Muestra mensaje de pago pendiente

---

## 🔧 CONFIGURACIÓN DE MERCADO PAGO

### Variables de Entorno
```env
MP_ACCESS_TOKEN=TEST-xxxxxxxxxxxxx (modo test) o APP_USR-xxxxxxxxxxxxx (producción)
APP_URL=http://localhost:3000 (local) o https://tu-dominio.com (producción)
```

### Modo Test vs Producción
- **Test:**
  - Token empieza con `TEST-`
  - No se envía `notification_url` (bloqueado en localhost)
  - Usar tarjetas de prueba de MP
- **Producción:**
  - Token empieza con `APP_USR-`
  - Se envía `notification_url` para webhooks
  - Transacciones reales

### Tarjetas de Prueba (Modo Test)
- **Aprobada:** `5031 7557 3453 0604` (nombre: APRO)
- **Rechazada:** `5031 4332 1540 6351` (nombre: OTHE)
- **Pendiente:** `5031 7557 3453 0604` (nombre: CONT)

---

## 📊 MODELOS DE PRECIOS

### LabBasePrice (Precios Base del Laboratorio)
- **Tabla:** `LabBasePrice`
- **Campos:**
  - `labId`, `size` (ej: "10x15"), `unitPrice` (ARS enteros)
  - `currency`: `"ARS"` (default)
  - `isActive`: `Boolean`
- **Uso:** Precio base por tamaño de impresión

### LabSizeDiscount (Descuentos por Cantidad)
- **Tabla:** `LabSizeDiscount`
- **Campos:**
  - `labId`, `size`, `minQty` (50 o 100)
  - `discountPercent`: `Float` (porcentaje de descuento)
  - `isActive`: `Boolean`
- **Lógica de Aplicación:**
  - Se calcula la cantidad total **por tamaño** (suma de todas las unidades del mismo tamaño)
  - Si `cantidadTotal >= 100`: aplica `discountPercent` de `minQty=100`
  - Si `cantidadTotal >= 50`: aplica `discountPercent` de `minQty=50`
  - El descuento se aplica al precio base antes de calcular el subtotal

### LabProductVariant (Productos con Precios Mayorista/Retail)
- **Tabla:** `LabProductVariant`
- **Campos:**
  - `labId`, `productId`, `size`, `finish`, `material`
  - `priceRetailArs`: Precio minorista (ARS enteros)
  - `priceWholesaleArs`: Precio mayorista (ARS enteros)
- **Uso:** Para productos complejos con variantes (canvas, madera, etc.)
- **Regla de Precio según Canal:**
  - **Canal HOME_PUBLICO:** Usa el precio más económico disponible (retail si ambos existen, sino wholesale)
  - **Canal HOME_FOTOGRAFO:** Según `lab.usePriceForPhotographerOrders`:
    - `AUTO`: Si existe wholesale usa wholesale, sino retail
    - `WHOLESALE`: Fuerza mayorista
    - `RETAIL`: Fuerza minorista

---

## 🔄 FLUJOS DE DATOS

### Flujo de Compra desde Álbum
```
1. Usuario entra a /a/[id]/comprar
2. Selecciona fotos (digitales/impresas)
3. Configura tamaño, acabado, cantidad
4. Carrito se guarda en sessionStorage.orderItems
5. Usuario completa datos (email, nombre, teléfono)
6. POST /api/a/[id]/orders → Crea Order con OrderItems
7. [PENDIENTE] Crear preferencia MP y redirigir
```

#### Descarga digital asincrónica (pedidos con varias fotos)
Cuando un cliente invoca `/api/downloads/[token]` para un pedido con más de una foto, el endpoint deja de generar el ZIP al vuelo y, en su lugar, dispara `POST /api/zip-jobs/create`. Ese endpoint responde 202 con `jobId`, `statusUrl` (para seguir el progreso) y el mensaje “Estamos procesando tu pedido…”, y proporciona la URL que permite disparar manualmente `POST /api/zip-jobs/[id]/process` si hace falta. El job se procesa automáticamente con invocaciones que pueden durar hasta 300 segundos y se puede consultar con `GET /api/zip-jobs/[id]/status` para ver el progreso (`progress`), la URL final (`zipUrl`) y cualquier error.
El cron `/api/cron/process-zip-jobs` corre cada cinco minutos (o el horario que configure tu scheduler) y trae hasta cinco jobs pendientes por ejecución; cuando el ZIP queda listo se encola un email utilizando el template `digital_download` para avisar al comprador y entregarle el link definitivo. Mientras tanto, el resumen de compra en `app/a/[id]/comprar/resumen` muestra el aviso “Estamos procesando tu pedido…” para que el cliente sepa que el link llegará por correo y que puede seguir el estado con el enlace recibido por la API.

- Para proteger el endpoint `POST /api/zip-jobs/[id]/process` se usa la variable `ZIP_JOB_PROCESS_SECRET` (se envía por la cabecera `x-zip-secret` o la query `zipSecret`). También podés desactivar el envío automático de emails con `ENABLE_ZIP_READY_EMAIL=false`; por defecto está habilitado.

### Flujo de Compra de Impresiones
```
1. Usuario entra a /imprimir (o /f/[handler]/imprimir o /l/[handler]/imprimir)
2. Sube fotos (drag & drop)
3. Configura tamaño, acabado, cantidad (/imprimir/configurar)
4. Ve resumen (/imprimir/resumen)
5. Completa datos del cliente (/imprimir/datos)
6. POST /api/print-orders → Crea PrintOrder con PrintOrderItems
7. POST /api/payments/mp/create-preference → Crea preferencia MP
8. Redirección a initPoint (checkout de Mercado Pago)
9. Usuario paga en MP
10. MP redirige a /pago/success|failure|pending
11. MP envía webhook a /api/payments/mp/webhook
12. Webhook actualiza PrintOrder.paymentStatus y PrintOrder.status
```

---

## 🎯 PUNTOS DE COMPRA (RESUMEN)

| Flujo | Ruta de Entrada | Carrito (sessionStorage) | API de Creación | Modelo Prisma | Integración MP |
|-------|----------------|--------------------------|-----------------|---------------|----------------|
| **Álbumes** | `/a/[id]/comprar` | `orderItems` | `POST /api/a/[id]/orders` | `Order` + `OrderItem` | ❌ No implementado |
| **Impresiones** | `/imprimir` | `orderItems` | `POST /api/print-orders` | `PrintOrder` + `PrintOrderItem` | ✅ Completo |
| **Descarga digital batch** | `/api/downloads/[token]` | — | `POST /api/zip-jobs/create` | `ZipGenerationJob` | — |

---

## 📝 NOTAS IMPORTANTES

1. **Moneda:** Siempre ARS enteros (sin centavos)
2. **Descuentos:** Se aplican por cantidad total del mismo tamaño, no por producto individual
3. **Validaciones:** El laboratorio debe tener MP conectado y estar aprobado para recibir pedidos
4. **Webhooks:** Solo funcionan en producción (no en localhost)
5. **Estados de Pago:**
   - `PENDING`: Pago pendiente
   - `PAID`: Pago aprobado
   - `FAILED`: Pago rechazado
   - `REFUNDED`: Pago reembolsado (no implementado en UI)

---

## 🚀 PENDIENTES / MEJORAS FUTURAS

1. **Flujo de Álbumes:**
   - Implementar creación de preferencia MP
   - Redirección al checkout después de crear Order
   - Manejo de estados de pago

2. **Notificaciones:**
   - Envío de emails con links de descarga para fotos digitales
   - Notificaciones al laboratorio cuando se crea un pedido
   - Notificaciones al cliente cuando el pedido está listo

3. **Reembolsos:**
   - Implementar UI para reembolsos (actualmente solo existe el estado en el modelo)

4. **Mercado Pago Marketplace:**
   - Implementar split de pagos (comisiones automáticas)
   - OAuth para conectar cuentas de laboratorios/fotógrafos

---

## 📚 ARCHIVOS CLAVE

### APIs de Pedidos
- `/app/api/print-orders/route.ts` - Creación de pedidos de impresión
- `/app/api/a/[id]/orders/route.ts` - Creación de pedidos de álbum
- `/api/downloads/[token]` - Valida el token de descarga, detecta pedidos con múltiples fotos y dispara `POST /api/zip-jobs/create`, devolviendo `jobId`, `statusUrl` y el mensaje “Estamos procesando tu pedido…” que ve el cliente.
- `/app/api/zip-jobs/create`, `/app/api/zip-jobs/[id]/status`, `/app/api/zip-jobs/[id]/process` - Crean, consultan y procesan los jobs de ZIP; `generateZipForJob` genera el archivo, lo sube a R2 y, una vez listo, dispara el template `digital_download` para avisar por email.

### APIs de Pagos
- `/app/api/payments/mp/create-preference/route.ts` - Crear preferencia MP
- `/app/api/payments/mp/webhook/route.ts` - Webhook de confirmación

### Procesos en segundo plano
- `/api/cron/process-zip-jobs` - Endpoint protegido por `CRON_SECRET` que se puede programar cada cinco minutos; cada ejecución procesa hasta cinco jobs pendientes y vuelve a invocar `/api/zip-jobs/[id]/process` para generar y publicar los ZIPs.
- `/app/api/zip-jobs/[id]/process` - Requiere `ZIP_JOB_PROCESS_SECRET`; puede ejecutarse manualmente o por el cron para forzar la generación del ZIP y subirlo a R2.

### Componentes de Compra
- `/app/a/[id]/comprar/page.tsx` - Compra desde álbum
- `/app/imprimir/page.tsx` - Subida de fotos para impresión
- `/app/imprimir/configurar/page.tsx` - Configuración de impresión
- `/app/imprimir/resumen/page.tsx` - Resumen del pedido
- `/app/imprimir/datos/page.tsx` - Datos del cliente
- `/app/imprimir/confirmacion/page.tsx` - Confirmación

### Páginas de Resultado
- `/app/pago/success/page.tsx` - Pago exitoso
- `/app/pago/failure/page.tsx` - Pago fallido
- `/app/pago/pending/page.tsx` - Pago pendiente

### Modelos Prisma
- `Order` - Pedidos de álbum
- `OrderItem` - Items de pedido de álbum
- `PrintOrder` - Pedidos de impresión
- `PrintOrderItem` - Items de pedido de impresión
- `LabBasePrice` - Precios base del laboratorio
- `LabSizeDiscount` - Descuentos por cantidad
- `LabProductVariant` - Variantes de productos con precios mayorista/retail

---

**Última actualización:** 2024
**Versión:** 1.0
