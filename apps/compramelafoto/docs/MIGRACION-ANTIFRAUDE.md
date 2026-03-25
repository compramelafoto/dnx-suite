# Migración y tests - Sistema Antifraude

> **Política DB compartida (DNX Suite):** en **staging/prod** usar solo  
> `pnpm --filter @repo/db run db:migrate:deploy`  
> `db push` queda restringido a local/dev controlado.

## 1. Migración de base de datos

### 1.1 Opción A: Migración (staging/prod)

```bash
pnpm --filter @repo/db run db:migrate:deploy
```

La migración `20260310120000_add_antifraud_tables` crea las tablas:
- `OrderAuditLog`
- `WebhookEvent`
- `FraudAlert`
- `AccountRestriction`

### 1.2 Opción B: db push (solo local/dev controlado)

Si `migrate deploy` falla o hay drift, **no usar en DB compartida**. Solo para entorno local/dev aislado:

```bash
npx prisma db push
```

Esto sincroniza el schema con la DB sin usar el historial de migraciones. Crea las tablas que faltan.

### 1.5 Compatibilidad hacia atrás

- **APIs existentes:** La API `GET /api/print-orders/[id]` ahora requiere lógica de visibilidad. Los clientes sin auth reciben respuesta pública (datos mínimos). Los clientes autenticados reciben datos sanitizados según rol.
- **Confirmación pública:** La página `/imprimir-publico/confirmacion` sigue funcionando; la API devuelve los mismos campos que usa (id, total, status, paymentStatus, lab, items sin fileKey).
- **Panel fotógrafo:** Ahora muestra pedidos pendientes con badge "Protegido" y datos enmascarados.
- **Panel lab:** Sin cambios; ya filtraba por `paymentStatus: PAID`.

---

## 2. Tests recomendados

### 2.1 Unitarios

| Archivo | Función | Casos |
|---------|---------|-------|
| `lib/antifraud/visibility.test.ts` | `getOrderVisibilityContext` | Admin ve todo; Lab no ve si no PAID; Fotógrafo ve datos solo si PAID |
| `lib/antifraud/visibility.test.ts` | `canViewCustomerData` | true/false según rol y paymentStatus |
| `lib/antifraud/visibility.test.ts` | `shouldReleaseToLab` | true solo si PAID y labId |
| `lib/antifraud/visibility.test.ts` | `sanitizeOrderForRole` | Oculta customerName, fileKey cuando no puede ver |
| `lib/antifraud/risk.test.ts` | `evaluateFraudRisk` | Reglas disparan score; umbrales correctos |
| `lib/antifraud/webhook.test.ts` | `ensureWebhookIdempotency` | Segundo intento retorna alreadyProcessed |

### 2.2 Integración

| Endpoint | Casos |
|----------|-------|
| `GET /api/print-orders/[id]` sin auth | Devuelve datos mínimos (sin customerName, fileKey) |
| `GET /api/print-orders/[id]` como fotógrafo, pedido PENDING | Datos sanitizados |
| `GET /api/print-orders/[id]` como fotógrafo, pedido PAID | Datos completos |
| `GET /api/print-orders/[id]` como lab, pedido PENDING | 404 |
| `GET /api/print-orders/[id]` como lab, pedido PAID | Datos completos |
| `GET /api/fotografo/pedidos` | Incluye pendientes con _dataProtected |
| `POST /api/payments/mp/webhook` mismo paymentId dos veces | Segundo retorna ok, no reprocesa |

### 2.3 Seguridad

| Caso | Esperado |
|------|----------|
| Lab intenta GET print-orders/[id] de pedido PENDING | 404 |
| Fotógrafo A intenta ver pedido de Fotógrafo B | 404 o sin datos |
| Request sin auth a print-orders/[id] | Respuesta pública (mínima) |
| Admin ve todo | Sí |

### 2.4 Casos edge

- Webhook con `orderId` inválido o no numérico
- Webhook con `status` no esperado (ej. `in_process`)
- Pedido con `paymentStatus: null`
- `evaluateFraudRisk` con userId y labId null

### 2.5 Idempotencia webhook

1. Enviar mismo `paymentId` dos veces al webhook
2. Verificar que `WebhookEvent` tiene un solo registro
3. Verificar que el pedido no se actualizó dos veces

---

## 3. Checklist pre-producción

- [ ] Migración aplicada
- [ ] Webhook de MP configurado con URL correcta
- [ ] `notification_url` incluye `orderId` y `orderType` en query params
- [ ] Tests de visibilidad pasando
- [ ] Panel admin antifraude accesible
- [ ] No hay confirmación manual del fotógrafo como fuente de pago
- [ ] Export de carpeta impresión solo si PAID (ya implementado)

---

## 4. Rollback

Si es necesario revertir:

1. No eliminar columnas de `WebhookEvent` (externalRef, rawPayload) para no romper datos.
2. Para desactivar sanitización temporalmente: en `print-orders/[id]` devolver `order` sin sanitizar (solo para debug).
3. El webhook con idempotencia es seguro; no requiere rollback.
