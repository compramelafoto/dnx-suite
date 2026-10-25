# Mostrador: cobro con QR de Mercado Pago y "Verificar pago"

Plan del 18/10/2026. Pedido de Daniel para DNX Estudio: que el Mostrador cobre con **un QR fijo
de Mercado Pago que muestre el monto ya cargado** (como en las estaciones de servicio) y que, al
cobrar por **transferencia al alias/CVU**, haya un botón **"Verificar pago"** que lo confirme
contra la cuenta de Mercado Pago del negocio.

## Lo que ya existe (no se rehace)

- **Conexión de la cuenta MP del negocio** (OAuth con PKCE): Configuración → Cobros. Guarda el
  token cifrado (`DnxEncryptedCredential`) y el `user_id` de MP (`DnxPaymentAccount.providerUserId`).
  `resolveWorkspaceCollector(workspaceId)` devuelve un token válido y lo renueva solo.
- **Cliente HTTP de MP** con idempotencia (`MercadoPagoHttpClient`) y verificación de firma de
  webhooks (`verifyMercadoPagoWebhookSignature`).
- **Webhooks de FOTOFFICE** en `app/api/payments/mp/*`. El patrón a copiar es `pedidos-webhook`:
  la URL lleva `?ws=<workspaceId>`, el pago se lee con el token de ese negocio y es idempotente.
- **Alias, CVU y monto único** (sumar de 1 a 99 pesos para que no haya dos montos iguales):
  `FotofficeCobroAjustes` y `montoUnicoLibre` (`lib/pedidos/espera-pago.ts`).
- **Venta**: `checkoutAction` → `recordSale` crea la venta COMPLETADA y la deposita en Caja en
  una sola transacción. Hoy no existe una venta "esperando el pago".

## Lo que falta

1. Un adaptador de **QR presencial** (API Orders `type: "qr"`, `mode: "static"`, y alta de
   sucursal y caja en MP). El de `providers/mercado-pago/orders` es sólo para pagos online.
2. Un **cobro pendiente**: el ticket espera el pago y recién entonces se llama a `recordSale`.
3. Un **webhook del mostrador**.
4. Una **búsqueda de cobros por monto y fecha** (`/v1/payments/search`); hoy sólo se busca por
   `external_reference`.

## Etapas

### Etapa 0 — Preparación (Daniel, 15 minutos) y una prueba que define la etapa 3

1. **Conectar la cuenta de Mercado Pago de DNX Estudio** en Configuración → Cobros. Hoy no está
   conectada (verificado en la base el 18/10).
2. **Cargar alias y CVU** en Configuración → Presupuestos → Datos para transferir.
3. **Prueba de transferencias**: hacer dos transferencias chicas al CVU de Mercado Pago de DNX,
   una desde otra cuenta de Mercado Pago y otra desde un banco. Después se consulta
   `/v1/payments/search` con el token del negocio para ver si aparecen y con qué datos (monto,
   hora, nombre de quien pagó).
   - Si aparecen las dos: la etapa 3 verifica cualquier transferencia al CVU de MP.
   - Si sólo aparece la de Mercado Pago: "Verificar" sirve para esas, y para las de banco se
     sigue confirmando a ojo (se avisa en pantalla).
   - Una transferencia a un CBU de banco nunca se puede verificar desde Mercado Pago.

### Etapa 1 — El QR del mostrador (1 día)

- En Configuración → Cobros, botón **"Activar QR de mostrador"** (sólo dueño o admin, y con MP
  conectado). Crea en MP una sucursal y una caja (`/users/{user_id}/stores` y `/pos`) y guarda
  sus identificadores.
- Tabla nueva `FotofficeQrMostrador` (workspaceId, storeId, posId, externalPosId, imagen del QR,
  creado por, fecha). Una por negocio al principio; más adelante, una por mostrador.
- La pantalla muestra el QR para **descargar e imprimir** (con el logo del estudio). Es el mismo
  QR para siempre.

### Etapa 2 — Cobrar con el QR (2 días)

- Tabla nueva `FotofficeCobroMostrador`: el ticket tal cual (renglones, descuento, cliente,
  nota), total, `estado` (ESPERANDO, PAGADO, VENCIDO o CANCELADO), id de la orden en MP, id del
  pago, quién cobró y vencimiento.
- **Mostrador → Mercado Pago → Cobrar**:
  1. Crea la orden en MP (`POST /v1/orders`, `type: "qr"`, `config.qr.mode: "static"`,
     `external_pos_id` de la caja y `external_reference = mostrador:<id>`), con aviso a
     `/api/payments/mp/mostrador-webhook?ws=<workspaceId>`.
  2. La pantalla pasa a **"Esperando el pago — que escaneen el QR"**, con el monto grande, un
     botón Cancelar y vencimiento a los 10 minutos.
  3. Cuando el cliente paga, el webhook lee la orden con el token del negocio y, si está pagada,
     llama a `recordSale` **una sola vez** (único por id de orden). La venta queda COMPLETADA y
     depositada en la cuenta Mercado Pago de Caja.
  4. El mostrador consulta cada 3 segundos. Al confirmarse muestra "Pagado ✓ Venta #N" y deja el
     ticket listo para el siguiente. Si el webhook se demora, la consulta pregunta directo a MP
     (`GET /v1/orders/{id}`).
- **Cancelar** o **vencer** cancela la orden en MP, para que el QR no siga cobrando ese monto.
- Si el negocio no activó el QR, el botón Mercado Pago sigue como hoy: anota el cobro a mano.

### Etapa 3 — "Verificar pago" para transferencias (1 a 2 días, según la etapa 0)

- Con **Transferencia** elegida aparece **"Verificar pago"** (el alias y el CVU ya se muestran).
- Si el negocio usa **monto único**, el ticket muestra el monto a transferir con los centavos o
  pesos agregados (por ejemplo $ 70.037) para identificarlo sin dudas.
- El botón busca en la cuenta MP (`/v1/payments/search`, aprobados, desde que se armó el ticket
  menos 15 minutos) los cobros por **ese monto exacto**:
  - **Uno solo** → "Recibido de Juan Pérez a las 10:42" → **Confirmar** y se registra la venta.
  - **Varios** → se elige cuál.
  - **Ninguno** → "Todavía no llegó", con botón para volver a buscar.
- Cada pago de MP sirve para **una sola venta**: se guarda su id con índice único, así no se
  usa dos veces la misma transferencia.
- El mismo botón sirve para **Mercado Pago sin QR** (cuando alguien paga por link o a la cuenta).

## Permisos

- Activar el QR y conectar MP: dueño o admin (como hoy Cobros).
- Cobrar y verificar: quien puede vender (rol Equipo incluido).

## Costos y riesgos

- **Comisión**: el QR cobra comisión de MP (alrededor de 0,8–1,2% con dinero en cuenta y más con
  tarjeta de crédito). La transferencia al alias o CVU no tiene comisión.
- **Dependencia de MP**: si la API no responde, el mostrador ofrece "Anotar a mano" como hoy.
- **Prueba sin riesgo**: las etapas 1 y 2 se prueban con usuarios de prueba de MP antes de tocar
  la cuenta real de DNX.
- **Migraciones**: dos tablas nuevas, aplicadas a mano en la base de FOTOFFICE (rama
  `development`) según la práctica del proyecto.

## Orden y tiempos

| Etapa | Qué | Quién | Tiempo |
|---|---|---|---|
| 0 | Conectar MP, cargar alias/CVU, prueba de transferencias | Daniel + Claude | 15 min + 30 min |
| 1 | QR del mostrador | Claude | 1 día |
| 2 | Cobrar con QR y confirmación automática | Claude | 2 días |
| 3 | Verificar transferencias | Claude | 1–2 días |

## Fuentes

- [Mercado Pago — Código QR con API Orders](https://www.mercadopago.com.ar/developers/en/docs/qr-code/payment-processing)
- [Mercado Pago — Crear order (QR)](https://www.mercadopago.cl/developers/es/reference/in-person-payments/qr-code/orders/create-order/post)
- [Mercado Pago — Buscar pagos](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro/search-payments/get)
