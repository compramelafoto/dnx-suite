# ✅ Integración de Mercado Pago en Modo TEST - Implementación Completa

## 📋 Resumen

Se ha implementado una integración completa de Mercado Pago en modo TEST para validar todos los flujos de compra en localhost, sin webhooks, usando redirecciones (`back_urls`) y consultas directas a la API de Mercado Pago.

## 🎯 Objetivos Cumplidos

✅ **Centralización de Mercado Pago** - Librería `/lib/mercadopago.ts`  
✅ **Preferencias de pago unificadas** - Mismo flujo para ambos tipos de pedidos  
✅ **Confirmación de pagos en TEST** - Endpoint `/api/payments/mp/confirm`  
✅ **Frontend actualizado** - Páginas de resultado confirman pagos automáticamente  
✅ **Validaciones para modo TEST** - Ignora validaciones de MP en desarrollo  
✅ **Flujos unificados** - Álbum e Impresiones usan la misma lógica  

---

## 📁 Archivos Creados/Modificados

### Nuevos Archivos

1. **`/lib/mercadopago.ts`**
   - Librería centralizada para integración con Mercado Pago
   - Funciones: `createPreference()`, `getPaymentById()`
   - Mapeo de estados MP → estados internos
   - Detección automática de modo TEST vs PRODUCCIÓN

2. **`/app/api/payments/mp/confirm/route.ts`**
   - Endpoint para confirmar pagos consultando directamente a MP
   - Soporta `PRINT_ORDER` y `ALBUM_ORDER`
   - Actualiza estados en la base de datos

### Archivos Modificados

1. **`/app/api/payments/mp/create-preference/route.ts`**
   - Refactorizado para usar `/lib/mercadopago.ts`
   - Soporta ambos tipos de pedidos (`PRINT_ORDER`, `ALBUM_ORDER`)
   - Retorna `initPoint` y `preferenceId`

2. **`/app/api/a/[id]/orders/route.ts`**
   - Crea preferencia MP automáticamente después de crear el pedido
   - Retorna `initPoint` y `preferenceId` en la respuesta

3. **`/app/api/print-orders/route.ts`**
   - Validaciones de MP ignoradas en modo TEST
   - Permite crear pedidos sin MP conectado en desarrollo

4. **`/app/imprimir/datos/page.tsx`**
   - Crea preferencia MP después de crear el pedido
   - Redirige automáticamente a Mercado Pago checkout

5. **`/app/pago/success/page.tsx`**
   - Convertido a Client Component
   - Confirma el pago automáticamente al cargar
   - Muestra estado real del pago

6. **`/app/pago/failure/page.tsx`**
   - Convertido a Client Component
   - Confirma el pago para actualizar estado en BD

7. **`/app/pago/pending/page.tsx`**
   - Convertido a Client Component
   - Confirma el pago y muestra estado actualizado

---

## 🔧 Funcionalidades Implementadas

### 1. Librería Centralizada (`/lib/mercadopago.ts`)

#### Funciones Principales

- **`createPreference(params)`**
  - Crea preferencia de pago en Mercado Pago
  - Configura `back_urls` automáticamente
  - No usa `notification_url` en modo TEST/localhost
  - Retorna `initPoint` y `preferenceId`

- **`getPaymentById(paymentId)`**
  - Consulta estado de pago directamente a MP
  - Retorna información completa del pago

- **`mapPaymentStatusToOrderStatus()`**
  - Mapea estados MP → estados internos del pedido
  - `approved` → `PAID`
  - `rejected`/`cancelled` → `FAILED`
  - `pending`/`in_process` → `PENDING`

- **`mapPaymentStatusToPaymentStatus()`**
  - Mapea estados MP → estados de pago internos
  - Incluye `REFUNDED` para reembolsos

#### Detección de Modo

- **Modo TEST:** Token empieza con `TEST-`
- **Modo LOCAL:** `APP_URL` contiene `localhost` o `127.0.0.1`
- **Modo PRODUCCIÓN:** Token empieza con `APP_USR-` y URL pública

### 2. Endpoint de Confirmación (`/api/payments/mp/confirm`)

**POST `/api/payments/mp/confirm`**

**Body:**
```json
{
  "paymentId": "string (ID del pago en MP)",
  "orderId": "number (ID del pedido)",
  "orderType": "PRINT_ORDER" | "ALBUM_ORDER"
}
```

**Proceso:**
1. Consulta el pago en Mercado Pago
2. Verifica que `external_reference` coincida con `orderId`
3. Mapea estados MP → estados internos
4. Actualiza el pedido según su tipo:
   - **PRINT_ORDER:** Actualiza `paymentStatus`, `status`, `mpPaymentId`
   - **ALBUM_ORDER:** Actualiza `status`

**Respuesta:**
```json
{
  "success": true,
  "orderId": 123,
  "orderType": "PRINT_ORDER",
  "paymentId": "123456789",
  "paymentStatus": "approved",
  "orderStatus": "PAID",
  "paymentStatusInternal": "PAID",
  "transactionAmount": 5000,
  "currency": "ARS",
  "dateApproved": "2024-01-01T12:00:00.000Z"
}
```

### 3. Creación de Preferencias Unificada

**POST `/api/payments/mp/create-preference`**

**Body:**
```json
{
  "orderId": 123,
  "orderType": "PRINT_ORDER" | "ALBUM_ORDER"
}
```

**Proceso:**
1. Busca el pedido según su tipo
2. Crea preferencia usando `/lib/mercadopago.ts`
3. Guarda `mpInitPoint` y `mpPreferenceId` en el pedido
4. Retorna `initPoint` para redirección

### 4. Validaciones para Modo TEST

En `/app/api/print-orders/route.ts`:

```typescript
const isTestMode = process.env.MP_ACCESS_TOKEN?.startsWith("TEST-") || 
                   process.env.NODE_ENV !== "production";

if (!isTestMode) {
  // Solo validar MP en producción
  if (!lab.mpConnectedAt || !lab.mpAccessToken || !lab.mpUserId) {
    return NextResponse.json(
      { error: "El laboratorio no tiene Mercado Pago conectado..." },
      { status: 403 }
    );
  }
}
```

**Resultado:** En modo TEST, se pueden crear pedidos sin tener MP conectado en el laboratorio.

---

## 🔄 Flujos de Compra Actualizados

### Flujo 1: Compra desde Álbum (`/a/[id]/comprar`)

1. Usuario selecciona fotos y configura pedido
2. Completa datos del comprador
3. **POST `/api/a/[id]/orders`** → Crea `Order`
4. **Automáticamente:** Crea preferencia MP y retorna `initPoint`
5. Frontend redirige a `initPoint` (checkout MP)
6. Usuario paga en Mercado Pago
7. MP redirige a `/pago/success?orderId=X&orderType=ALBUM_ORDER&payment_id=Y`
8. **Automáticamente:** `/pago/success` llama a `/api/payments/mp/confirm`
9. Estado del pedido se actualiza a `PAID` o `FAILED`

### Flujo 2: Compra de Impresiones (`/imprimir`)

1. Usuario sube fotos y configura pedido
2. Completa datos del cliente
3. **POST `/api/print-orders`** → Crea `PrintOrder`
4. **POST `/api/payments/mp/create-preference`** → Crea preferencia MP
5. Frontend redirige a `initPoint` (checkout MP)
6. Usuario paga en Mercado Pago
7. MP redirige a `/pago/success?orderId=X&orderType=PRINT_ORDER&payment_id=Y`
8. **Automáticamente:** `/pago/success` llama a `/api/payments/mp/confirm`
9. Estado del pedido se actualiza a `PAID` o `FAILED`

---

## 🧪 Testing en Modo TEST

### Configuración Requerida

**.env.local:**
```env
MP_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx
APP_URL=http://localhost:3000
NODE_ENV=development
```

### Tarjetas de Prueba

- **Aprobada:** `5031 7557 3453 0604` (nombre: APRO)
- **Rechazada:** `5031 4332 1540 6351` (nombre: OTHE)
- **Pendiente:** `5031 7557 3453 0604` (nombre: CONT)

### Proceso de Prueba

1. Crear un pedido desde cualquiera de los flujos
2. Serás redirigido a Mercado Pago Checkout (modo test)
3. Usar una tarjeta de prueba
4. Completar el pago
5. Serás redirigido a `/pago/success`
6. El sistema confirmará automáticamente el pago consultando MP
7. Verificar en la BD que el pedido tiene `status: "PAID"` o `paymentStatus: "PAID"`

---

## 📊 Estados Mapeados

### Mercado Pago → Sistema Interno

| Estado MP | Order Status | Payment Status |
|-----------|--------------|----------------|
| `approved` | `PAID` | `PAID` |
| `rejected` | `FAILED` | `FAILED` |
| `cancelled` | `FAILED` | `FAILED` |
| `pending` | `PENDING` | `PENDING` |
| `in_process` | `PENDING` | `PENDING` |
| `refunded` | `FAILED` | `REFUNDED` |
| `charged_back` | `FAILED` | `FAILED` |

---

## 🔒 Seguridad y Validaciones

1. **Validación de `external_reference`:**
   - El endpoint de confirmación verifica que el `paymentId` corresponda al `orderId`
   - Previene confirmación de pagos de otros pedidos

2. **Modo TEST:**
   - Validaciones de MP relajadas solo en desarrollo
   - En producción, todas las validaciones están activas

3. **Manejo de Errores:**
   - Si falla la creación de preferencia, el pedido igual se crea
   - Si falla la confirmación, se muestra error pero el pedido existe

---

## 🚀 Próximos Pasos (Opcionales)

1. **Notificaciones por Email:**
   - Enviar email cuando el pago es aprobado
   - Enviar email cuando el pedido está listo

2. **Reembolsos:**
   - Implementar UI para reembolsos
   - Integrar con API de reembolsos de MP

3. **Mercado Pago Marketplace:**
   - Implementar split de pagos (comisiones automáticas)
   - OAuth para conectar cuentas de laboratorios/fotógrafos

4. **Webhooks en Producción:**
   - Activar webhooks cuando se despliegue a producción
   - Mantener confirmación manual como fallback

---

## 📝 Notas Importantes

- **Moneda:** Siempre ARS enteros (sin centavos)
- **Webhooks:** Deshabilitados en modo TEST/localhost
- **Confirmación:** Siempre se hace consultando directamente a MP
- **Estados:** No se cambian nombres de estados existentes
- **Modelos:** No se modifican modelos Prisma existentes

---

**Última actualización:** 2024  
**Versión:** 1.0  
**Estado:** ✅ Implementación Completa
