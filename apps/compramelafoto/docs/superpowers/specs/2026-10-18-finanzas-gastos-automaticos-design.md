# Finanzas DNX — Gastos automáticos desde Gmail

**Fecha:** 18/10/2026 · **Estado:** diseño aprobado en charla, para revisión escrita · **Pedido por:** Daniel Cuart

## 1. Objetivo

Que la pantalla **Finanzas DNX → Gastos** se complete sola con lo que realmente se factura y se
paga a cada proveedor, sin carga manual, para tener el resumen exacto de facturado, pagado y deuda
de cada mes.

**Criterio de éxito:**

- Al conectar las tres cuentas de Gmail, queda cargado **todo el historial que haya en el correo** (para analizar cuánto se invirtió en total), sin duplicar los 16 gastos que ya existen.
- Cada factura, pago exitoso o pago fallido nuevo aparece en Finanzas a más tardar al día siguiente.
- Un pago fallido llega por Telegram el mismo día.
- El sistema **nunca inventa un importe**: lo que no puede leer con certeza va a "Para revisar".

## 2. Decisiones tomadas (18/10/2026)

| Tema | Decisión |
|---|---|
| Fuente | **Los mails de los proveedores** en Gmail. Es lo único que mandan todos. |
| MCP de cada proveedor | **Descartado.** Un MCP sólo sirve dentro de una charla con Claude, y la mayoría de los proveedores no ofrece consultar facturas desde afuera (con MCP o sin él). |
| Lectura | **Lectores fijos por proveedor** (reglas exactas), **sin IA**. |
| Permiso de Gmail | **Sólo lectura** (`gmail.readonly`). Sólo se buscan mails de los remitentes conocidos. |
| Frecuencia | Una vez por día a la madrugada, más un botón "Leer ahora". |
| Avisos | Pago fallido → **Telegram** al chat privado que ya usa el DNX Bot. |
| Histórico | Al conectar se lee **todo el historial** de los remitentes conocidos, sin fecha de corte. Objetivo: el análisis de todo lo invertido. |
| Anthropic | Se separa en **"Anthropic — Suscripción"** (claude.ai) y **"Anthropic — API del bot"** (console.anthropic.com, DNX Bot). |
| Cursor | Ya no se usa, pero **se leen sus mails viejos** para el histórico. Queda inactivo: no se espera un cobro nuevo ni se avisa que falta. |
| Inactivo vs. leído | `active` sólo decide si se espera un cobro mensual. **Los mails de todos los proveedores de la tabla se leen siempre**, activos o no. |
| Cuentas de Gmail | **Tres:** compramelafoto@gmail.com, dnxfotografia@gmail.com y cuart.daniel@gmail.com. |
| Control cruzado con AWS y Vercel | **Segunda etapa**, fuera de este diseño. |
| WhatsApp | Se suma cuando esté contratado; agregar un proveedor tiene que ser agregar una fila de configuración y, si hace falta, un lector. |

## 3. Proveedores y remitentes

| Proveedor (`key`) | Cuenta | Remitente | Tipos de mail conocidos |
|---|---|---|---|
| AWS (`aws`, nuevo) | compramelafoto@gmail.com | `payment@aws.com` | Pago exitoso (trae número y fecha de factura) |
| Cloudflare R2 (`cloudflare`) | compramelafoto@gmail.com | cualquier `@*.cloudflare.com` | Alerta de uso (estimado), factura |
| Anthropic — Suscripción (`anthropic`) | dnxfotografia@gmail.com | `invoice+statements@mail.anthropic.com` | Recibo Stripe |
| Anthropic — API del bot (`anthropic-api`, nuevo) | a confirmar | mismo remitente; se distingue por el contenido | Recibo Stripe de compra de crédito |
| Resend (`resend`) | dnxfotografia@gmail.com | `invoice+statements@invoicing.resend.com` | Recibo Stripe |
| ChatGPT Plus (`chatgpt`) | dnxfotografia@gmail.com | cualquier `@*.openai.com` | Recibo |
| Neon (`neon`) | dnxfotografia@gmail.com | `noreply@ar.neon.tech` | Factura, pago fallido, pago exitoso |
| Vercel (`vercel`) | dnxfotografia@gmail.com | `notifications@vercel.com` | Factura, pago fallido, pago exitoso |
| Cursor (`cursor`, inactivo) | dnxfotografia@gmail.com | `invoice+statements+acct_1Lb5LzB4TZWxSIGU@stripe.com` | Recibo y **reembolso** Stripe |
| CapCut (`capcut`, nuevo) | dnxfotografia@gmail.com | a confirmar con el primer mail | Próximo servicio |
| ElevenLabs (`elevenlabs`, nuevo) | cuart.daniel@gmail.com | a confirmar | Recibo |

La tabla vive **en código** (`lib/finance-dnx/mail/vendors.ts`): remitentes, patrón de asunto y
lector de cada proveedor. Las `key` definitivas se toman de la base al implementar.

## 4. Cómo funciona

```
Gmail (2 cuentas, sólo lectura)
   │  búsqueda: from:(remitentes conocidos) after:<fecha>
   ▼
/api/cron/finance-dnx-mail  (diario)  ·  POST .../mail/sync  (botón "Leer ahora")
   │
   ├─ 1. Registrar cada mensaje nuevo en ExpenseMailMessage (id de Gmail único → nunca dos veces)
   ├─ 2. Elegir el lector por remitente → { tipo, importe, moneda, nº factura, mes factura, fecha pago }
   │      sin lector o lectura incompleta → estado PARA_REVISAR
   ├─ 3. Aplicar al gasto (ver §5)
   └─ 4. Pago fallido nuevo → Telegram
```

### 4.1 Conexión

- Botón **"Conectar Gmail"** en Finanzas (sólo super admin). Abre el consentimiento de Google con
  `gmail.readonly`, `access_type=offline` y `prompt=consent` para obtener el *refresh token*.
- Cliente OAuth: el del proyecto compartido **`compramelafoto-auth`** (`GOOGLE_CLIENT_ID` /
  `GOOGLE_CLIENT_SECRET` que ya usa el login de CLF). Hay que **habilitar la Gmail API** y **agregar
  la URL de retorno** `https://compramelafoto.com/api/admin/finance-dnx/mail/callback` en ese cliente.
  El proyecto figura como no verificado: Google muestra el aviso y se entra por "Configuración avanzada".
- El *refresh token* se guarda **cifrado** con el cifrador existente
  (`@repo/payments/credential-vault`, AES-GCM) y una clave nueva `FINANCE_MAIL_VAULT_KEY`.
- El `state` del OAuth lleva un nonce firmado para que nadie pueda colgar su cuenta en la nuestra.
- Las llamadas a Google se hacen con `fetch` a la API REST. **Sin dependencias nuevas** (el lockfile es de todo el monorepo).

### 4.2 Lectura

- Búsqueda por cuenta: `from:(remitente1 OR remitente2 …) after:<última lectura − 3 días>`. La primera vez, sin fecha (todo el historial).
- Lotes acotados por ejecución (para no pasarse del tiempo de la función). Si quedan mensajes, la
  próxima ejecución sigue; "Leer ahora" repite hasta terminar o hasta el tope de tiempo.
- Se descarga sólo el mensaje encontrado (asunto, remitente, fecha y texto). El texto queda guardado
  para poder volver a procesarlo cuando se mejora un lector, sin volver a pedirlo a Google.

### 4.3 Lectores

Funciones puras `(mensaje) → resultado | null`, cada una con pruebas sobre **mails reales** guardados como fixtures.

- **Stripe** (Anthropic, Resend, Cursor y probablemente OpenAI y ElevenLabs): importe, número de recibo, fecha de pago, concepto. Distingue **recibo** de **reembolso** ("Your refund from…").
  El concepto separa la suscripción de Anthropic de la compra de crédito de la API.
- **AWS**: "Hemos cobrado… X USD… por la factura N" + "Billing Date AAAA-MM-DD" → pago exitoso de esa factura, del mes de facturación.
- **Neon y Vercel**: factura emitida, pago fallido ("Payment failed… invoice #X ($Y)") y pago exitoso.
- **Cloudflare**: alerta de uso (total actual y período) y factura.

Si un mail no tiene todos los datos obligatorios (importe, moneda, mes), el lector devuelve `null` y el mail queda en "Para revisar".

## 5. Reglas para aplicar al gasto

Cada factura es **un gasto** (`ExpenseEntry`). El mes del gasto es el **mes de la factura**, no el del pago.

| Tipo de mail | Efecto |
|---|---|
| Factura emitida | Crea el gasto en `FACTURADO` (o lo completa si ya existe con ese número). |
| Pago exitoso | Busca la factura por número → `PAGADO` y fecha de pago. Si no existe, la crea ya `PAGADO`. |
| Pago fallido | Busca o crea la factura → `RECHAZADO`. Avisa por Telegram la primera vez que se ve ese fallo. |
| Alerta de uso / estimado | Crea o actualiza **un** gasto `ESTIMADO` del proveedor para ese período. Cuando llega la factura real del período, la factura **reemplaza** al estimado. |
| Recibo (Stripe) | Gasto `PAGADO` con fecha de pago. |
| Reembolso | Suma a `amountRefunded` del gasto original (buscado por número de recibo o, si no, por proveedor y mes). Si no hay gasto original, va a "Para revisar". |

- **Dólar:** dólar tarjeta del día del documento (API pública `argentinadatos` para fechas pasadas,
  `dolarapi` para hoy), `taxPercent = 0` porque el dólar tarjeta ya incluye impuestos.
- **Reparto por plataforma:** el que tenga configurado el proveedor, igual que la carga manual.
- **Nunca se pisa** un gasto `MANUAL` editado a mano: si un mail lo contradice, el mail va a "Para revisar".
- **Un estado nunca retrocede:** un pago exitoso no vuelve a `RECHAZADO` por un mail viejo que se procese después.

### 5.1 Histórico y gastos ya cargados

Al aplicar un mail se busca un gasto existente del mismo proveedor, en este orden:

1. **Mismo número de factura** (columna nueva, o el número escrito en `notes`, como `SWURZY-00007`).
2. **Mismo mes e importe** (diferencia de hasta 1 centavo).

Si hay coincidencia, se completa ese gasto (número, estado real, fecha de pago, enlace) en vez de
crear otro. Si hay un gasto del mismo proveedor y mes pero con otro importe, el mail va a "Para revisar".

## 6. Cambios en la base

Migración nueva, aplicada **sólo a la rama `production` de `divine-hall-10689679`** (únicas tablas de
Finanzas; ninguna otra app las usa), a mano y registrada en `_prisma_migrations` con su checksum.

**`ExpenseEntry`:**

- **Se quita** `@@unique([vendorId, periodYear, periodMonth])`: un proveedor puede tener varias facturas en un mes.
- Columnas nuevas: `invoiceNumber String?`, `paidAt DateTime?`, `mailMessageId Int?` (último mail que lo tocó).
- `@@unique([vendorId, invoiceNumber])` (varios `null` permitidos).
- `source` admite el valor nuevo `MAIL`.

**`ExpenseMailAccount`** (nueva): `email` único, `refreshTokenEnc`, `connectedAt`, `lastSyncAt`,
`lastError`, `backfillDone`.

**`ExpenseMailMessage`** (nueva): `accountId`, `gmailMessageId` único, `fromAddress`, `subject`,
`receivedAt`, `bodyText`, `vendorId?`, `kind?` (`FACTURA`, `PAGO_OK`, `PAGO_FALLIDO`, `ESTIMADO`,
`RECIBO`, `REEMBOLSO`), datos leídos (`amount`, `currency`, `invoiceNumber`, `periodYear`, `periodMonth`, `paidAt`),
`status` (`CARGADO`, `PARA_REVISAR`, `DESCARTADO`), `reviewReason?`, `entryId?`, `alertedAt?`.

**Datos:** crear proveedores `aws`, `anthropic-api`, `capcut` y `elevenlabs`; renombrar `anthropic` a "Anthropic — Suscripción"; `cursor` → inactivo.

**Efecto sobre lo existente:** "Copiar del mes anterior" deja de chocar por el índice único. Se
ajusta para copiar sólo los proveedores que todavía no tienen gasto en el mes destino (como hace hoy al filtrar `yaCargados`).

## 7. Pantalla

En **Finanzas DNX → Gastos**:

- **Conexiones:** cada cuenta con su estado (conectada, última lectura, último error), "Conectar Gmail", "Desconectar" y "Leer ahora".
- **Etiqueta "Automático"** en los gastos con `source = MAIL`, con enlace al mail original en Gmail
  (ahí está el PDF adjunto cuando el proveedor lo manda) y número de factura.
- **Para revisar:** lista de mails no resueltos con remitente, asunto, fecha, motivo y enlace. Acciones:
  **Cargar** (abre el formulario de gasto prellenado con lo que se pudo leer) y **Descartar**.
- La carga manual sigue igual.

## 8. Errores y seguridad

- Token vencido o revocado → `lastError` en la cuenta, se ve en Conexiones y avisa por Telegram una vez.
- Caída de Gmail o del dólar → se reintenta en la próxima ejecución; nada queda a medio aplicar (cada mail se aplica en una transacción).
- Rutas de administración: sólo super admin (mismo control que el resto de `/api/admin/finance-dnx`).
- Cron: `assertCronAuth`, igual que los demás.
- El contenido de los mails es **dato**: se lee con reglas fijas y nunca se ejecuta ni se usa como instrucción.

## 9. Pruebas

- Lectores: pruebas unitarias con mails reales anonimizados como fixtures (uno por tipo y proveedor).
- Reglas de §5 y §5.1: pruebas puras sobre la función que decide crear, completar, pasar a revisión o ignorar.
- Búsqueda de Gmail y OAuth: pruebas con `fetch` simulado.
- Verificación en producción: conectar las tres cuentas, leer el histórico y comparar contra los 16 gastos existentes y los mails mostrados el 18/10 (AWS 106,72 USD, Neon SWURZY-00008 127,31 USD, Resend 20 USD del 22/09).

## 10. Orden de construcción

1. **Base y conexión:** migración, OAuth, cifrado, búsqueda y guardado de mensajes, sección Conexiones.
   Todo mensaje cae en "Para revisar". Daniel conecta las tres cuentas.
2. **Lectores y reglas:** con los mails reales ya guardados se escriben y prueban los lectores, se
   reprocesan los mensajes y se carga el histórico.
3. **Avisos y pantalla final:** Telegram, etiqueta "Automático", bandeja con Cargar/Descartar.

## 11. Fuera de alcance

- Control cruzado con la API de costos de AWS y la de Vercel (segunda etapa).
- WhatsApp (cuando se contrate).
- Guardar los PDF en nuestro almacenamiento: quedan en Gmail, accesibles por el enlace.
- Lectura con IA.
