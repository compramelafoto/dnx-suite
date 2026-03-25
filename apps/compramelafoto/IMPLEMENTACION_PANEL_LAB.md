# Implementación Panel de Laboratorio - Resumen

## ✅ COMPLETADO

### 1. Bloqueo por Mercado Pago (REGLA 1)
- ✅ `/api/labs` filtra labs sin MP conectado (solo muestra labs con `mpConnectedAt`, `mpAccessToken`, `mpUserId` no nulos)
- ✅ `/api/print-orders` valida MP antes de crear pedido
- ✅ Banners de bloqueo en panel LAB cuando falta MP

### 2. Aceptación de T&C (REGLA 2)
- ✅ Verificación de T&C en `/api/auth/login` para LAB y PHOTOGRAPHER
- ✅ Endpoint `/api/lab/status` para obtener estado completo (MP, T&C, aprobación)
- ✅ Banners de bloqueo en panel LAB cuando falta T&C

### 3. Roles y Menús (REGLA 3)
- ✅ Panel LAB usa `userRole` (LAB vs LAB_PHOTOGRAPHER) en lugar de `soyFotografo`
- ✅ Tab "Álbumes" solo visible si `userRole === "LAB_PHOTOGRAPHER"`
- ✅ Endpoint `/api/lab/status` devuelve el role correcto

### 4. Login Ajustado (REGLA 8)
- ✅ Login permite entrar aunque no esté APPROVED
- ✅ Devuelve información de bloqueos (`labStatus`, `photographerStatus`)
- ✅ Panel muestra banners informativos pero permite acceso

## 🔄 EN PROGRESO / PENDIENTE

### 5. Reembolsos/Cancelaciones (REGLA 4)
- ⏳ Remover botones de reembolso/cancelación en UI de pedidos
- ⏳ Mantener estados REFUNDED/CANCELED solo por compatibilidad

### 6. Envíos y Retiro (REGLA 5)
- ⏳ Validar `fulfillmentMode` y `shippingEnabled` en selección de lab
- ⏳ Bloquear compras desde otras provincias si `PICKUP_ONLY`
- ⏳ Mostrar mensaje sobre coordinación de envío antes de pagar

### 7. Regla de Precios (REGLA 6)
- ⏳ CANAL 1 (HOME público): usar precio más económico
- ⏳ CANAL 2 (HOME fotógrafo): usar `usePriceForPhotographerOrders` (AUTO/WHOLESALE/RETAIL)
- ⏳ Implementar lógica en cálculo de precios según origen del pedido

### 8. Flujo de Onboarding (REGLA 9)
- ⏳ DRAFT → PENDING_APPROVAL cuando completa datos + MP + T&C
- ⏳ Endpoint para cambiar estado automáticamente

### 9. Botón WhatsApp Web (REGLA 10)
- ⏳ Mostrar botón cuando pedido pasa a READY/READY_TO_PICKUP
- ⏳ Generar link WhatsApp Web con mensaje prearmado
- ⏳ Usar dirección correcta según `pickupBy`

### 10. Panel Admin
- ⏳ Mostrar estado MP y T&C de labs/fotógrafos
- ⏳ Gestión de aprobación/rechazo/suspensión con motivos
- ⏳ Cambio de role LAB ↔ LAB_PHOTOGRAPHER

### 11. Catálogo de Productos
- ✅ Ya existe `LabProductVariant` en schema
- ⏳ Import/Export XLSX con wizard y validación TODO/NADA

### 12. Mensajes Internos
- ✅ Ya existe `AdminMessageThread` y `AdminMessage` en schema
- ⏳ UI para LAB para ver/responder mensajes

### 13. Tickets de Soporte
- ✅ Ya existe `SupportTicket` y `SupportMessage` en schema
- ⏳ UI para LAB para crear tickets

## 📝 NOTAS TÉCNICAS

- El campo `soyFotografo` en Lab se mantiene por compatibilidad, pero el permiso real viene del `Role` del User
- Los banners de bloqueo se muestran pero no bloquean el acceso al panel (solo bloquean operaciones)
- El endpoint `/api/lab/status` centraliza la lógica de verificación de bloqueos

## 🔗 ARCHIVOS MODIFICADOS

- `app/api/labs/route.ts` - Filtro por MP conectado
- `app/api/print-orders/route.ts` - Validación MP antes de crear pedido
- `app/api/auth/login/route.ts` - Verificación T&C y devolución de bloqueos
- `app/api/lab/status/route.ts` - NUEVO: Endpoint para estado completo
- `app/lab/configuracion/page.tsx` - Banners de bloqueo y menús según role
