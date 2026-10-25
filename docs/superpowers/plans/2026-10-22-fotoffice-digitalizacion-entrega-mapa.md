# Mapa del código existente para las partes 3 y 4 de Digitalización (relevado el 22/10)

Rutas relativas a `apps/fotoffice`.

## Cobro de cuotas de pedidos por Mercado Pago
- **Acción pública:** `app/w/[workspaceSlug]/pedido/[token]/actions.ts`, con `pagarCuotaAction` y `transferirCuotaAction` (llama a `esperarTransferencia`).
- **`iniciarPagoCuota({workspaceId, pedidoId, cuotaId})`** en `lib/pedidos/mp.ts:59`.
  - El importe es el menor entre el saldo de la cuota y el del pedido.
  - Usa Checkout Pro con el token OAuth del negocio (`resolveWorkspaceCollector`, modo TWO_WAY) y `externalReference = referenciaCuota` (`fo-pedcuota:`).
  - **No manda `marketplace_fee`.** El adaptador ya acepta `marketplaceFeeMinor` (`packages/payments/.../preference-adapter.ts:262`). Reservas lo usa en `lib/bookings/checkout.ts:88-117`.
- **Webhook:** `app/api/payments/mp/pedidos-webhook/route.ts`, que llama a `acreditarPagoMp` (`lib/pedidos/mp.ts:159`) y éste a `registrarCobroDelSistema` (`lib/pedidos/cobros.ts:516`).
  - `feeArs`/`netArs` salen de `comisionDeMp` (`lib/pedidos/mp-puro.ts:113`), que hoy sólo suma `mercadopago_fee`. Confirmar cómo informa MP el `application_fee`.

## Cobros
- **Todo `FotofficeCobro` nace en `aplicarCobro(tx, e)`** (`lib/pedidos/cobros.ts:260-370`), dentro de la transacción y con `bloquearPedido`.
- **Entradas:**
  - `registrarCobro(ctx, datos)` (`cobros.ts:373`): manual; se usa en el diálogo del pedido y en el Mostrador.
  - `registrarCobroDelSistema` (`cobros.ts:516`): MP.
- **Después del commit,** las dos llaman a `cerrarEsperasPagas(workspaceId, pedidoId, cobroId, ahora)` (`cobros.ts:438`), que ya calcula las cuotas pagas. **Es el punto de enganche para los efectos de pago.**
  - Corre post-commit y sin reintento: conviene que un cron concilie los cargos PENDIENTE cuya cuota quedó paga.
- **`anularCobro`** (`cobros.ts:595`) no tiene hook.
- **La imputación automática** va de la cuota más vieja a la más nueva.
- **"Verificar pago" del Mostrador:** `verificarPagoAction` (`app/(shell)/ventas/pedido-actions.ts:353`) no guarda `providerPaymentRef` en el cobro.

## Pedido: ítems, total y cuotas
- **`bloquearPedido(tx, pedidoId)`** (`lib/pedidos/plan.ts:27`) es un candado advisory.
- **`items`, `totals` y `totalArs`** se escriben sólo al crear el pedido (`insertarPedido`, `lib/pedidos/pedidos.ts:141`).
- **`editarPlan`** (`plan.ts:179`) exige que la suma de las cuotas sea igual a `totalArs`.
- **No existe una función para agregar un cargo.** Hay que crear una que suba `items`/`totals`/`totalArs` y cree la cuota (con `crearCuotas`, `plan.ts:65`, o directo).

## Comisión de plataforma
- **`getPlatformFeeBps(workspaceId, moduleKey)`** (`lib/platform-fee/store.ts:13`) devuelve 500 bps si no hay fila. La clave `"digitalizacion"` ya está en el registro de módulos.
- **Aritmética:**
  - `accrualForManualPayment` (`lib/platform-fee/debt.ts:25`)
  - `withholdingForPayment({paymentMinor, ownFeeMinor, pendingDebtMinor})` (`debt.ts:51`)
  - `feeForBooking` (`lib/platform-fee/ledger-booking.ts:15`)
- **Libro** (`lib/platform-fee/ledger.ts`):
  - `pendingFeeDebtMinor`
  - `recordAccrual` (DEVENGADO +)
  - `recordDischarge` (RETENIDO −)
  - `recordReversal`
- **Modelo de uso:**
  - Socios, manual: `lib/membership/manual-payment.ts:127`.
  - Socios, MP: `lib/membership/dues-checkout.ts:51-75` y `credit-payment.ts:155-170`; descarga sólo retenido − propio.
- **No hay pantalla de saldo de comisiones.**

## Envío por km
- **`cotizarEnvio`** (`lib/impresiones/envio.ts:23`): línea recta × 1,3 (`CUANTO_COBRO_ROUTE_FACTOR`).
- **Coordenadas del estudio:**
  - `coordenadasDelEstudio(extras)` (`envio.ts:38`) con `extrasDelWorkspace(workspaceId)` (`lib/presupuestos/perfil-cobro.ts:11`).
  - `envioParaNavegador` (`envio.ts:52`) redondea el punto del estudio.
- **Geocodificación:**
  - `GET /api/geocode?q=` y `/api/geocode/reverse`.
  - Componente `components/impresiones/buscar-direccion.tsx` (`onElegir({direccion, lat, lon})`).
  - El servidor recalcula y verifica con `direccionDelPunto` (`lib/impresiones/pago-servidor.ts:70`).
- **Ficha del cliente:**
  - `Client.address`/`city`.
  - `FotofficeContactoPerfil` (`province`, `postalCode`) con `guardarPerfil` (`lib/contactos/perfil.ts:262`).

## Notas del trabajo
- **`FotofficeProyectoNota`:** el sistema la escribe directo con `prisma.fotofficeProyectoNota.create` (ejemplo: `lib/proyectos/aviso-listo-servidor.ts:67`).
