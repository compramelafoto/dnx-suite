# Arquitectura Antifraude - ComprameLaFoto

## 1. Resumen ejecutivo

El sistema antifraude garantiza que **ningún fotógrafo ni laboratorio** pueda usar la plataforma para:
- Ver datos sensibles del cliente antes del pago aprobado
- Ver la selección exacta de fotos/productos antes del pago
- Recibir pedidos operativos antes de que Mercado Pago confirme el pago

**Fuente de verdad del pago:** exclusivamente el webhook de Mercado Pago con `status === "approved"`.

### Principios de diseño
- **Defensa en profundidad:** visibilidad aplicada en backend (APIs, server actions), no solo UI
- **Auditoría completa:** cada evento relevante se registra en OrderAuditLog
- **Idempotencia webhook:** WebhookEvent evita procesar el mismo paymentId dos veces
- **Sin confirmación manual:** el fotógrafo nunca puede marcar un pedido como pagado

---

## 2. Modelo de estados

### 2.1 Estado comercial del pedido (Order / PrintOrder)

| Estado actual | Descripción | Cuándo |
|---------------|-------------|--------|
| **PENDING** / **CREATED** | Pedido creado, esperando pago | Al crear el pedido |
| **PAYMENT_PENDING** | Preferencia MP creada, cliente en checkout | Tras create-preference |
| **PAID** | Pago aprobado por MP (webhook) | Solo tras webhook `approved` |
| **FAILED** | Pago rechazado/cancelado | Webhook `rejected`/`cancelled` |
| **REFUNDED** | Reembolso/contracargo | Webhook `refunded`/`charged_back` |
| **CANCELED** | Cancelado manualmente | Admin o timeout |
| **EXPIRED** | Pago expirado (opcional) | Lógica de timeout |

**Decisión:** Mantener los enums actuales (`OrderStatus`, `PrintOrderPaymentStatus`) y extender solo si hace falta. El estado `PAID` en Order y `paymentStatus: PAID` en PrintOrder ya son la señal de liberación.

### 2.2 Estado de pago (implícito en Order/PrintOrder)

| Estado MP | Mapeo interno |
|-----------|---------------|
| `approved` | PAID |
| `rejected`, `cancelled` | FAILED |
| `pending`, `in_process` | PENDING |
| `refunded`, `charged_back` | REFUNDED |

### 2.3 Estado operativo (PrintOrder.status)

| Estado | Descripción |
|--------|-------------|
| CREATED | Pedido creado |
| IN_PRODUCTION | En laboratorio |
| READY | Listo para retiro |
| READY_TO_PICKUP | Confirmado retiro |
| SHIPPED | Enviado |
| DELIVERED | Entregado |
| CANCELED | Cancelado |
| RETIRED | Retirado |

**Regla:** El laboratorio solo ve pedidos con `paymentStatus === "PAID"`. El estado operativo solo avanza después del pago.

---

## 3. Matriz de visibilidad por rol y estado

### 3.1 Antes del pago aprobado (paymentStatus !== PAID)

| Dato | PHOTOGRAPHER | LAB | ADMIN |
|------|--------------|-----|-------|
| ID del pedido | ✅ (solo propios) | ❌ | ✅ |
| Álbum involucrado | ✅ (solo propios) | ❌ | ✅ |
| Monto total | ✅ | ❌ | ✅ |
| Estado general | ✅ | ❌ | ✅ |
| Fecha creación | ✅ | ❌ | ✅ |
| Nombre cliente | ❌ | ❌ | ✅ |
| Email cliente | ❌ | ❌ | ✅ |
| Teléfono/WhatsApp | ❌ | ❌ | ✅ |
| Dirección | ❌ | ❌ | ✅ |
| Selección de fotos | ❌ | ❌ | ✅ |
| Detalle de items | ❌ | ❌ | ✅ |
| fileKey / archivos | ❌ | ❌ | ✅ |

### 3.2 Después del pago aprobado (paymentStatus === PAID)

| Dato | PHOTOGRAPHER | LAB | ADMIN |
|------|--------------|-----|-------|
| Todo lo anterior | ✅ | ✅ (solo sus pedidos) | ✅ |
| Datos del cliente | ✅ | ✅ | ✅ |
| Items y archivos | ✅ | ✅ | ✅ |

---

## 4. Flujo de liberación de datos

```
1. Cliente selecciona fotos en landing
2. Frontend crea Order/PrintOrder (datos sensibles se guardan cifrados o en tabla separada)
3. create-preference → redirect a MP
4. Cliente paga (tarjeta, saldo MP, transferencia, Rapipago, etc.)
5. MP envía webhook con status=approved
6. Webhook actualiza paymentStatus=PAID
7. Sistema libera datos: desenmascara/decodifica datos sensibles O los marca como "released"
8. Fotógrafo y Lab pueden ver el pedido completo
```

**Alternativa más simple (sin cifrado):** Los datos se guardan en el pedido desde el inicio, pero las **APIs y queries nunca los devuelven** hasta que `paymentStatus === PAID`. El backend aplica `sanitizeOrderForRole()` en cada respuesta.

---

## 5. Punto de liberación al laboratorio

- **Regla estricta:** `GET /api/print-orders` ya filtra por `paymentStatus: "PAID"`. El lab no ve pedidos pendientes.
- **Problema actual:** `GET /api/print-orders/[id]` **no tiene autenticación** y devuelve el pedido completo a cualquiera que conozca el ID.
- **Solución:** Autenticar, verificar que el usuario sea LAB del labId del pedido, y **no devolver el pedido si paymentStatus !== PAID**.

---

## 6. Eventos de auditoría

| eventType | Descripción |
|-----------|-------------|
| ORDER_CREATED | Pedido creado |
| ORDER_UPDATED | Edición de pedido |
| PAYMENT_INITIATED | Preferencia MP creada |
| PAYMENT_PENDING | Cliente en checkout |
| PAYMENT_APPROVED | Webhook approved |
| PAYMENT_REJECTED | Webhook rejected |
| PAYMENT_EXPIRED | Timeout |
| CUSTOMER_DATA_RELEASED | Liberación de datos tras pago |
| ORDER_ITEMS_RELEASED | Liberación de items |
| ORDER_SENT_TO_LAB | Pedido visible para lab |
| ORDER_VIEWED_PHOTOGRAPHER | Fotógrafo abrió pedido |
| ORDER_VIEWED_LAB | Lab abrió pedido |
| ADMIN_OVERRIDE | Cambio manual por admin |
| ACCOUNT_RESTRICTED | Restricción aplicada |
| FRAUD_ALERT_CREATED | Alerta de riesgo generada |

---

## 7. Reglas de alertas antifraude (determinísticas)

| Regla | Umbral | Acción sugerida |
|-------|--------|-----------------|
| Pedidos pendientes sin pago | >10 en 30 días | WARNING |
| Visualizaciones de pedidos no aprobados | >20 en 7 días | WARNING |
| Conversiones truncas (álbum) | >50% sin pago | MANUAL_REVIEW |
| Pedidos cancelados manualmente | >5 en 7 días | WARNING |
| Comportamiento vs promedio | Desviación >2σ | MANUAL_REVIEW |
| Accesos fuera de horario | >5 entre 00-06 | INFO |
| Modificación de precios cerca de compra | <1h antes | MANUAL_REVIEW |

---

## 8. Acciones automáticas por riesgo

| Nivel | Medida | Efecto |
|------|--------|--------|
| NONE | Ninguna | Normal |
| WARNING | Notificación | Solo alerta al admin |
| LIMITED_VISIBILITY | Restricción | No ver pedidos pendientes |
| MANUAL_REVIEW | Revisión | Pedidos en cola admin |
| TEMP_SUSPENSION | Suspensión temporal | Bloqueo 24-72h |
| FULL_SUSPENSION | Suspensión total | Bloqueo hasta revisión |

---

## 9. Funciones clave del diseño

```typescript
getOrderVisibilityContext(user, order)  // Qué puede ver el usuario
sanitizeOrderForRole(order, user)       // Sanitiza el objeto para el rol
canViewCustomerData(user, order)         // boolean
canViewOrderItems(user, order)          // boolean
shouldReleaseToLab(order)               // boolean (paymentStatus === PAID)
registerAuditEvent(...)                 // Registra en OrderAuditLog
evaluateFraudRisk(userId, context)      // Calcula riskScore y reglas
```

---

## 10. Integración Mercado Pago

- **Webhook:** Única fuente de verdad para paymentStatus
- **Idempotencia:** Verificar por `mpPaymentId` antes de procesar
- **Validación:** Verificar firma/headers si MP lo soporta
- **Reintentos:** MP reintenta; handler debe ser idempotente
- **Orden:** Manejar eventos fuera de orden (ej. approved antes que in_process)
