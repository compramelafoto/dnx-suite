# Configuración de Mercado Pago (Modo Test)

## 🔑 Credenciales de Test

Para obtener tus credenciales de test de Mercado Pago:

1. **Crear cuenta en Mercado Pago** (si no tenés una):
   - Ir a: https://www.mercadopago.com.ar/
   - Crear cuenta o iniciar sesión

2. **Obtener credenciales de Test**:
   - Ir a: https://www.mercadopago.com.ar/developers/panel/app
   - Seleccioná tu aplicación o creá una nueva
   - En "Credenciales de prueba", copiá tu **Access Token**

3. **Agregar al `.env.local`**:
   ```env
   # Mercado Pago (Modo Test)
   MP_ACCESS_TOKEN=TEST-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxx
   
   # URL de la aplicación (para redirects y webhooks)
   APP_URL=http://localhost:3000
   ```

## 🧪 Tarjetas de Prueba

En modo test, podés usar estas tarjetas de prueba:

### Tarjeta Aprobada
```
Número: 5031 7557 3453 0604
Nombre: APRO
Fecha de vencimiento: 11/25 (cualquier fecha futura)
CVV: 123
```

### Tarjeta Rechazada
```
Número: 5031 4332 1540 6351
Nombre: OTHE
Fecha de vencimiento: 11/25
CVV: 123
```

### Tarjeta Pendiente
```
Número: 5031 7557 3453 0604
Nombre: CONT
Fecha de vencimiento: 11/25
CVV: 123
```

## 📋 Variables de Entorno Requeridas

Agregar a `.env.local`:

```env
# Mercado Pago
MP_ACCESS_TOKEN=TEST-tu-access-token-aqui

# URL de la aplicación
APP_URL=http://localhost:3000

# Base de datos
DATABASE_URL=tu-connection-string-aqui

# Admin (para seed)
ADMIN_EMAIL=cuart.daniel@gmail.com
ADMIN_PASSWORD=Daniel1608$
```

## 🧪 Probar el Flujo

1. **Crear un pedido**:
   - Ir a la página de impresión
   - Subir fotos y completar datos
   - Crear el pedido

2. **Generar preferencia de pago**:
   - El sistema llama automáticamente a `/api/payments/mp/create-preference`
   - Se crea una preferencia en Mercado Pago (modo test)

3. **Probar el pago**:
   - Te redirige a Mercado Pago Checkout Pro (modo test)
   - Usá una de las tarjetas de prueba de arriba
   - Probar diferentes escenarios (aprobado, rechazado, pendiente)

4. **Verificar webhook** (opcional):
   - En local, el webhook NO se activa (por seguridad)
   - En producción, Mercado Pago enviará notificaciones a `/api/payments/mp/webhook`

## 🔄 Estados de Pago

El sistema maneja estos estados:
- `PENDING`: Pago pendiente
- `PAID`: Pago aprobado
- `FAILED`: Pago rechazado
- `REFUNDED`: Pago reembolsado

## ⚠️ Notas Importantes

- **Modo Test vs Producción**: 
  - En modo test, todos los pagos son simulados
  - No se realizan transacciones reales
  - Las credenciales de test empiezan con `TEST-`

- **Webhook en Local**:
  - El webhook NO se envía en localhost (bloqueado por Mercado Pago)
  - En producción, usar una URL pública (ej: `https://tu-dominio.com`)

- **Access Token**:
  - En test: `TEST-xxxxxxxxxx`
  - En producción: `APP_USR-xxxxxxxxxx`

## 🚀 Para Producción

Cuando estés listo para producción:

1. Cambiar a credenciales de producción en el panel de Mercado Pago
2. Actualizar `MP_ACCESS_TOKEN` con el token de producción
3. Cambiar `APP_URL` a tu dominio público
4. Configurar el webhook en el panel de Mercado Pago (opcional pero recomendado)

## 📚 Documentación Oficial

- API Mercado Pago: https://www.mercadopago.com.ar/developers/es/docs
- Credenciales de prueba: https://www.mercadopago.com.ar/developers/panel/app
- Checkout Pro: https://www.mercadopago.com.ar/developers/es/docs/checkout-pro
