# Entrega automática post-compra por WhatsApp

## Resumen

Cuando un pedido de álbum pasa a estado **PAID**, el sistema:

1. **Email** (siempre): envía el email habitual con link de descarga o ZIP
2. **WhatsApp** (opcional): complementa con entrega por WhatsApp según configuración

## Reglas de negocio

- **≤ N fotos** (default 10): mensaje inicial + fotos una por una + mensaje final con link
- **> N fotos**: solo mensaje con link de descarga (no satura el chat)
- El email **siempre** se envía; WhatsApp es complemento
- Evita duplicados: no reenvía si ya hubo entrega exitosa

## Configuración (Admin → Configuración)

| Campo | Descripción | Default |
|-------|-------------|---------|
| Activar entrega por WhatsApp | Master switch | false |
| Habilitar para pedidos pagados | Si está activo, ejecuta al confirmar pago | true |
| Máximo de fotos a enviar una por una | N: hasta N fotos se envían; más de N solo link | 10 |
| Enviar mensaje inicial | Para pedidos ≤ N fotos | true |
| Enviar mensaje final con link | Para pedidos ≤ N fotos | true |
| Enviar link para pedidos grandes | Para pedidos > N fotos | true |

## Variables de entorno

```
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_API_VERSION=v19.0
APP_BASE_URL=https://www.compramelafoto.com
```

## Archivos

- `lib/whatsapp/formatPhone.ts` - Formatea teléfono para Argentina
- `lib/whatsapp/sendTextMessage.ts` - Mensaje de texto
- `lib/whatsapp/sendImageMessage.ts` - Imagen por URL
- `lib/whatsapp/sendDocumentMessage.ts` - Documento (ZIP)
- `lib/whatsapp/sendOrderDelivery.ts` - Lógica principal `deliverOrderByWhatsApp`
- `lib/whatsapp/config.ts` - Lee configuración desde AppConfig
- `app/api/payments/mp/webhook/route.ts` - Hook al confirmar pago

## Base de datos

- **WhatsAppDeliveryLog**: registra cada mensaje enviado (tipo, status, waMessageId)
- **AppConfig**: columnas `whatsappEnabled`, `whatsappMaxPhotosToSend`, etc.

## Cómo probar localmente

1. Configurar `WHATSAPP_*` en `.env`
2. En Admin → Configuración, activar "Entrega por WhatsApp"
3. Crear un pedido de prueba con fotos digitales y teléfono válido
4. Simular webhook de pago aprobado o pagar con MP test
5. Revisar `WhatsAppDeliveryLog` en la BD

## Nota sobre Meta Cloud API

Para mensajes iniciados por el negocio (post-compra), Meta exige **templates aprobados** o que el usuario haya escrito en las últimas 24h. Si los mensajes libres fallan, habrá que crear y aprobar templates en Meta Business.
