# Presupuesto automático con aprobación por Telegram — diseño

Fecha: 2026-10-25 · Pedido de Daniel (DNX Estudio) · Concreta la etapa 4 ("Presupuestos A aprobar")
de [2026-10-20-bot-whatsapp-24x7-design.md](2026-10-20-bot-whatsapp-24x7-design.md).

> **Cambio de decisión.** El diseño del 20/10 decía "Telegram no se usa" y "sin aviso extra".
> El 25/10 Daniel decidió lo contrario: el aviso para aprobar le llega **por Telegram**. Esta
> decisión reemplaza a la anterior. La vista "A aprobar" dentro de FOTOFFICE queda también.

## 1. Objetivo

"Cuando el cliente consulte, el bot le escribe y le arma el presupuesto dentro de los 10 a 30
minutos." Éxito: una consulta de 15 años entra a las 23:10 por el formulario; a las 23:10 el
cliente tiene un correo "recibimos tu consulta"; a las 23:11 Daniel tiene en el celular el resumen
con el precio; aprieta **Aprobar y enviar** y el cliente recibe por correo (y WhatsApp, si
corresponde) el enlace a su página, con el portfolio de 15 años, el presupuesto y el botón para
aceptar y pagar la seña.

## 2. Recorrido

```
Consulta nueva (formulario web | bot de WhatsApp)
   │  categoría con "Aprobar por Telegram" encendido
   ├─▶ acuse inmediato al cliente
   │     web: la respuesta automática de consultas (Plantillas) · WhatsApp: el texto de acuse
   ├─▶ borrador del presupuesto con la propuesta modelo de la categoría (precio de hoy,
   │   conceptos calculados con ¿Cuánto Cobro?)            ← reutiliza armarBorradorDePropuesta
   ├─▶ fila FotofficePresupuestoAprobacion (una por consulta: nunca dos avisos)
   └─▶ Telegram a Daniel: cliente, tipo y fecha, lo que incluye, precio, costo/horas/margen
         [Aprobar y enviar]  [Corregir] (abre el presupuesto)   ·  sin propuesta: [Abrir consulta]
                 │
                 ▼ (botón o FOTOFFICE → "Esperando aprobación")
         reclamo atómico AVISADO → ENVIANDO (el segundo clic no hace nada)
         correo con el enlace (siempre que haya correo) + WhatsApp (si hay celular, Meta en modo
         real y la ventana de 24 h abierta) · fila ENVIADO con los canales · el mensaje de
         Telegram cambia a "Enviado" · el historial de la consulta lo muestra
```

## 3. Decisiones

| Tema | Decisión |
|---|---|
| Interruptor | Por categoría, **apagado por omisión** (Configuración → Telegram). Encendido, la propuesta modelo de esa categoría **no sale sola**: espera la aprobación. |
| Sin propuesta modelo | Igual llega el aviso: "esta categoría no tiene propuesta modelo" con [Abrir consulta]. |
| Acuse web | Es la respuesta automática de consultas que ya existe (correo, editable en Plantillas). No se inventa otro correo: así nunca salen dos. |
| Acuse WhatsApp | Texto configurable (por omisión "¡Gracias! Recibimos tu consulta. En un rato te mandamos la propuesta."). Lo dice el bot al usar `preparar_presupuesto`. |
| Envío al aprobar | Correo siempre que haya correo válido (plantilla de la propuesta modelo o la primera de Presupuesto). WhatsApp sólo con celular + conexión real + ventana de 24 h abierta: fuera de la ventana Meta exige plantillas pagas (fuera de este diseño) y queda anotado "ventana cerrada". |
| Sin correo (cliente de WhatsApp) | El presupuesto se congela igual (enlace) y sale sólo por WhatsApp. |
| Idempotencia | Aviso: único `workspaceId + leadId`. Aprobar: `updateMany` de AVISADO/AVISO_FALLIDO a ENVIANDO; el que no gana responde "ya estaba enviado". El webhook de Telegram puede repetir el mismo botón sin efecto. |
| Seguridad del webhook | URL `/api/webhooks/telegram/<id de la conexión>` + encabezado `X-Telegram-Bot-Api-Secret-Token` (secreto aleatorio por conexión, guardado sólo como SHA-256, comparación de tiempo constante). Los botones sólo valen desde el chat vinculado y para aprobaciones del mismo workspace. |
| Vínculo del chat | Daniel pega el token de @BotFather; FOTOFFICE valida con `getMe`, registra el webhook y muestra un enlace `t.me/<bot>?start=<código>` (vence en 30 min). Al tocar "Iniciar" queda vinculado ese chat. |
| Token | Cifrado en el cofre de integraciones (`WorkspaceIntegration`, clave `telegram`). Nunca vuelve a la pantalla. |
| Portfolio | Por categoría: galerías y fotos sueltas de FOTOFFICE (Galería) o fotos subidas al R2 de FOTOFFICE. Se muestra en la página pública del presupuesto, antes del detalle, con miniaturas livianas y carga diferida. |
| Dependencias | Ninguna nueva: `fetch` a la Bot API. |

## 4. Datos (sólo tablas nuevas, sin claves foráneas a tablas existentes)

Migración `20261219120000_fotoffice_presupuesto_automatico_telegram` (idempotente, NO aplicada):

- `FotofficeTelegramConexion`: bot (id, usuario), chat vinculado, código de vínculo y su
  vencimiento, hash del secreto del webhook.
- `FotofficePresupuestoAutoCategoria`: interruptor "Aprobar por Telegram" y portfolio (JSON) por categoría.
- `FotofficePresupuestoAutoAjustes`: acuse por WhatsApp (encendido y texto).
- `FotofficePresupuestoAprobacion`: una por consulta: presupuesto, origen, estado, mensaje de
  Telegram, canales usados, error.

El código tolera que falten las tablas (todo queda apagado), así que puede publicarse antes del SQL.

## 5. Variables de entorno

Ninguna nueva. Usa las que ya están: `DNX_INTEGRATIONS_VAULT_MASTER_KEY` (cofre),
`NEXT_PUBLIC_APP_URL` (dirección del webhook y de los botones), las de R2 y Resend.

## 6. Fuera de este diseño

Plantillas pagas de Meta (WhatsApp fuera de la ventana), aprobar desde Telegram sin vínculo,
varios chats de Telegram por workspace, editar el presupuesto desde Telegram.
