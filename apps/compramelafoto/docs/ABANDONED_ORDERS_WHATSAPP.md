# Recordatorios de pedidos abandonados (Email + WhatsApp)

## Descripción

Módulo que detecta pedidos de álbum en estado `PENDING` con más de 1 hora de antigüedad, envía recordatorio por **Email** (y opcionalmente WhatsApp) con link para reanudar la compra y guarda logs para evitar duplicados.

**Canal actual:** Email (Resend). El cron encola el email y `process-email-queue` lo envía.

## Configuración

### Variables de entorno

```env
WHATSAPP_PHONE_NUMBER_ID=    # ID del número de WhatsApp Business
WHATSAPP_ACCESS_TOKEN=       # Token de acceso de Meta
WHATSAPP_API_VERSION=v19.0   # Versión de la API (opcional)
APP_BASE_URL=https://www.compramelafoto.com
```

Obtener credenciales en: [Meta for Developers](https://developers.facebook.com/apps) → Tu app → WhatsApp → API Setup.

### Template de WhatsApp

Crear en Meta Business Manager un template con nombre **`_order_pending_reminder`** aprobado para español (Argentina).

**Body:** 1 variable
- `{{1}}` - Nombre del cliente

**Botón (CTA URL dinámica):** 1 variable
- `{{1}}` - URL completa para reanudar la compra (o segmento dinámico si la plantilla usa base fija)

Ejemplo de contenido body:
```
Hola 👋 {{1}}, tu pedido en ComprameLaFoto quedó pendiente. Podés completarlo desde el botón de abajo.
```

Botón: "Finalizar compra" con URL dinámica. El sistema envía la URL completa (ej. `https://www.compramelafoto.com/a/{slug}/comprar/resumen?orderId=123`). Si la plantilla en Meta usa base + `{{1}}`, configurar para aceptar URL completa o ajustar el código para enviar solo el path.

## Flujo

1. **Cron** (`/api/cron/abandoned-orders`) se ejecuta cada 15 minutos
2. Busca `Order` con `status: PENDING` y `createdAt` > 1 hora
3. Para cada uno:
   - Si ya hay recordatorio WhatsApp previo → skip
   - Si existe un pedido posterior del mismo cliente para el mismo álbum (PAID o PENDING) → skip (superseded)
   - Si no tiene teléfono válido → skip
4. Envía template vía Meta Cloud API
5. Crea `AbandonedOrderReminder` con status SENT o FAILED

### Exclusión por pedido obsoleto (superseded)

No se envía recordatorio si el cliente generó otro pedido posterior del mismo álbum (pagado o pendiente). Esto evita recordatorios incorrectos cuando el cliente rehizo el checkout. Ver `lib/order-superseded.ts`.

## Modelo

```prisma
model AbandonedOrderReminder {
  id           String   @id @default(cuid())
  orderId      Int
  sentAt       DateTime
  channel      String   // "WHATSAPP" | "EMAIL"
  templateUsed String
  status       String   // "SENT" | "FAILED"
  errorMessage String?
  createdAt    DateTime
  order        Order    @relation(...)
  @@unique([orderId, channel])  // Evita duplicados
}
```

## Mejoras futuras

- Múltiples recordatorios (1h, 24h, 48h)
- Fallback por email si no hay teléfono
- Tracking de conversión (pedido recuperado)
- A/B testing de templates
