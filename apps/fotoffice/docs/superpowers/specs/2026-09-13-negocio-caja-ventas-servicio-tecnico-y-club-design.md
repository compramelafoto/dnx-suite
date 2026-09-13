# El negocio en FotoOffice: Caja, Clientes, Ventas, Órdenes de trabajo y Club

**Fecha:** 2026-09-13
**Aplicación:** FotoOffice (`apps/fotoffice`)
**Estado:** diseño acordado. Sin una línea de código escrita.

---

## 1. Qué se construye y por qué

FotoOffice hoy sabe administrar una **institución**: socios, cuotas, carnets, reservas,
sorteos, cursos. No sabe administrar un **negocio**: no tiene dónde anotar la plata que
entra y sale, ni a quién le vendió, ni qué mercadería le queda, ni qué equipo ajeno tiene
en el taller.

Esto lo resuelve, en seis módulos nuevos y una extensión del que ya existe.

El disparador fue un servicio técnico de fotografía que necesita registrar el ingreso y el
egreso de equipos en reparación, una caja, y un club de fidelidad con puntos, premios y
sorteos. Pero el alcance es más amplio que ese cliente: **dos de los tres workspaces que
hoy están en producción necesitan la mitad de esto desde el primer día.**

Verificado en la base de producción el 2026-09-13 (proyecto Neon `divine-hall-10689679`,
rama `br-old-rain-adwthzng`):

| Workspace | Socios | Módulos encendidos |
|---|---|---|
| SFPR | 159 | reservas, socios, cuotas, sorteos, sitio web |
| DNX Estudio | 0 | cursos, evaluaciones |
| Emeveph | 0 | ninguno (creado el 2026-09-10) |

SFPR cobra cuotas y alquila el estudio, y **esa plata no aparece en ningún libro**. DNX
Estudio vende portarretratos, bolsos, trípodes, impresiones y cuadros tercerizados, y no
tiene ni catálogo ni stock. Los dos ganan algo el día que sale la primera etapa.

## 2. Lo que ya existe y lo que no

| Pieza | Estado |
|---|---|
| Motor de módulos con interruptor por workspace (`lib/modules/`) | Existe y es genérico. Registrar una key `AVAILABLE` la hace aparecer sola en administración |
| Key `cash` ("Caja") | **Ya reservada** como `PLANNED` (`lib/modules/registry.ts:90`). Sin una línea de código |
| Key `clients` ("Clientes") | **Ya reservada** como `PLANNED` (`registry.ts:114`). Sin una línea de código |
| Entrada de portal `/portal/beneficios` | Declarada con `built: false` (`lib/portal/menu.ts:111`). Es el lugar natural del Club |
| Módulo de Sorteos (`lib/raffles/`) | **Construido y en `main`.** Azar verificable con drand, padrón sellado, premios con sponsor, entrega |
| Regla de participación en sorteos | Atada a "socio al día con las cuotas" (`lib/raffles/eligibility.ts:46`). Es lo único que hay que abrir |
| Motor de carnets y Diseñador (TemplateV2) | Existe, construido para socios. Reusable para el carnet del Club |
| Libro de comisiones (`WorkspaceFeeLedgerEntry`) | Existe. Su patrón —columna firmada, saldo = suma— es el precedente para puntos y stock |
| Catálogo de sponsors (`DnxPartner`, `DnxPartnerBenefit`) | Existe en el esquema compartido, vive en otra app de la suite. Se referencia por id sin clave foránea, igual que ya hace `RafflePrize` |
| Catálogo de productos (`CatalogProduct`, `Lab`, `LabProduct`) | Existe, pero es el de CompraMeLaFoto: impresiones cotizadas por tamaño, atadas a álbumes y laboratorios. **No sirve** para un mostrador con stock |
| Caja, clientes, productos, stock, órdenes de trabajo, puntos | **Cero.** Ninguna tabla, ninguna pantalla |

Dos huecos que este diseño tapa de paso, y que hoy son deuda real:

- **Reservas** guarda el nombre de quien alquila en un campo de texto suelto
  (`Booking.contactName`, `schema.prisma:8124`). El no socio que alquila el estudio de SFPR
  no queda registrado en ninguna parte.
- Las **cuotas cobradas por Mercado Pago** están en `MembershipPayment`, pero el tesorero no
  tiene ninguna pantalla que le diga cuánto hay en total.

## 3. Decisiones tomadas

Acordadas en conversación entre el 2026-09-11 y el 2026-09-13.

1. **Cliente es una entidad nueva, no una variante de socio.** Con enlace opcional al socio
   del mismo workspace, para cuando son la misma persona. Ver §5.
2. **Caja es el único libro de dinero del workspace.** Cualquier módulo que cobre deposita
   ahí. Ver §6.
3. **El Club escucha a Caja, no a cada módulo.** Todo ingreso de caja atribuido a un cliente
   genera puntos. Un solo enganche en vez de uno por módulo. Ver §9.
4. **Los puntos se acumulan para todos; usarlos exige adhesión.** Acumular es contabilidad
   del negocio y no necesita permiso de nadie. Canjear, tener descuento, recibir el beneficio
   del mes y entrar a los sorteos, sí. Ver §9.3.
5. **Los sorteos ganan un destinatario:** socios, clientes o Club. La regla de "socio al día"
   pasa a ser la regla *de la audiencia socios*, no la del módulo. Ver §10.
6. **Los productos llevan un interruptor de stock por producto.** El trípode lo controla; la
   impresión tercerizada y la sesión de fotos no. Un módulo, no dos. Ver §7.
7. **Reparaciones y tercerizados comparten maquinaria.** Los dos son "algo que sale a un
   tercero, vuelve, se avisa y se entrega, y se cobra en dos tramos". Se diseñan como
   **órdenes de trabajo** con dos tipos. Ver §8.
8. **Ningún enum de Prisma nuevo.** Los estados van como texto. El `schema.prisma` está
   compartido por las cinco aplicaciones de la suite y un enum que no exista en alguna de las
   cinco bases rompe las escrituras de esa aplicación. Mismo criterio ya aplicado en
   `Booking.status` y `Raffle.status`.
9. **La facturación electrónica se construye, no se terceriza.** Conexión directa con ARCA
   (WSFEv1), para DNX Estudio y para SFPR. Va al final, con emisión manual o por una app de
   terceros mientras tanto — pero **los datos fiscales se capturan desde la etapa 1a**, porque
   sin condición frente al IVA ni tipo de documento no hay nada que facturar después. Ver §11.

## 4. El mapa

```
                    ┌─────────────┐
                    │  CLIENTES   │◄──── enlace opcional ────► SOCIOS
                    └──────┬──────┘                            (ya existe)
         ┌─────────────────┼─────────────────┬──────────────┐
         ▼                 ▼                 ▼              ▼
  ┌─────────────┐   ┌─────────────┐   ┌───────────┐  ┌───────────┐
  │  ÓRDENES    │   │   VENTAS    │   │ RESERVAS  │  │  SORTEOS  │
  │ DE TRABAJO  │   │  + stock    │   │(ya existe)│  │(extensión)│
  └──────┬──────┘   └──────┬──────┘   └─────┬─────┘  └─────▲─────┘
         │     cobros      │                │              │
         └─────────────────┴────────────────┘              │
                           ▼                               │
                    ┌─────────────┐                        │
                    │    CAJA     │   un solo libro        │
                    └──────┬──────┘                        │
                           │  todo ingreso con cliente     │
                           ▼                               │
                    ┌─────────────┐                        │
                    │    CLUB     │────── audiencia ───────┘
                    │  (puntos)   │
                    └──────┬──────┘
                           ▼
              Carnet · Portal · Avisos por correo
                   (motores que ya existen)
```

Lo que se reusa sin escribir de nuevo: el sistema de módulos con interruptor por workspace,
el motor de carnets y el Diseñador, el portal del socio, las invitaciones por correo, la
integración con Mercado Pago, la comisión de plataforma por módulo (`WorkspaceModuleFee`) y
el motor de sorteos completo.

---

## 5. Módulo Clientes (`clients`)

### 5.1 Qué resuelve

Es el padrón de quien le compra algo al negocio. Es el cimiento: los otros cuatro módulos
apuntan acá.

**No reemplaza a `Member`, y no se fusiona con él.** Socio y cliente son vínculos distintos
con el negocio, y una misma persona puede tener los dos: el socio 124 de SFPR que además
alquila el estudio es un socio *y* un cliente. Fusionarlos obligaría a que toda institución
tratara a sus compradores como socios, y a que todo negocio sin socios igual arrastrara
cuotas, categorías y carnets.

### 5.2 Datos

```
Client
  workspaceId, clientNumber (correlativo por workspace, único ahí dentro)
  kind: "PERSONA" | "EMPRESA"
  firstName, lastName          — persona
  businessName, taxId          — empresa
  docType, docNumber
  ivaCondition   — Responsable Inscripto | Monotributo | Exento | Consumidor Final |
                   No Categorizado. Obligatorio, por omisión "Consumidor Final".
                   Sin esto no se puede facturar después: ver §11.1
  email, phone, address, city
  notes, tags
  status: "ACTIVO" | "INACTIVO"
  memberId?   → Member del mismo workspace, único. "Este cliente es además el socio 124"
  userId?     → cuenta de FotoOffice, para el portal
  consentsMarketing: bool, consentedAt   — consentimiento para comunicaciones, aparte
  createdAt, updatedAt, createdByUserId
```

`ClientDevice` —el equipo del cliente, con marca, modelo, número de serie y notas— se
define acá pero **se construye en la etapa 2**, cuando Órdenes de trabajo lo necesita. Una
cámara con número de serie tiene historia: la segunda reparación no se carga de cero.

### 5.3 Una sola puerta de entrada

Todo módulo que necesite un cliente pasa por la misma función: buscar por documento, correo
o teléfono, y crear si no aparece. Sin eso, en seis meses hay tres fichas del mismo señor
escritas de tres maneras distintas.

Cuando el cliente se crea desde una reserva y ese contacto coincide con un socio, la
pantalla lo ofrece: *"¿Es el socio 124?"*. No lo decide sola.

---

## 6. Módulo Caja (`cash`)

### 6.1 Qué resuelve

El libro de ingresos y egresos del negocio, y el arqueo del efectivo.

Va **primero** no sólo porque sea lo más útil, sino porque si no, hay que rehacerlo: Órdenes
de trabajo cobra señas y saldos, Ventas cobra el mostrador, y si Caja no existe todavía cada
uno inventa su propio registro. Cuando Caja llegue después, el negocio queda con dos libros
que no cierran y alguien tiene que migrar uno al otro.

### 6.2 Cuentas: por qué no alcanza con una, y las define el negocio

El efectivo se cuenta; Mercado Pago y el banco se concilian. Meterlos en la misma bolsa
haría que el arqueo diera mal todos los días.

```
CashAccount
  workspaceId, name ("Efectivo", "Mercado Pago", "Banco", "Tarjeta",
                     "Efectivo Sucursal Centro", "Efectivo Sucursal Norte"...)
  kind: "EFECTIVO" | "DIGITAL"
  isDefault, isActive, order
```

Sólo las cuentas `EFECTIVO` se arquean.

**Las crea el administrador de cada workspace, sin tope.** Un negocio con una sola caja usa
dos cuentas y no piensa más en el tema; uno con tres sucursales crea un efectivo por sucursal
y arquea cada uno por separado. No hace falta una entidad "sucursal": la cuenta ya es la
unidad que se abre, se cierra y se cuenta, y agregar una capa arriba sería inventar jerarquía
sin que nadie la haya pedido. Si algún día hace falta agrupar sucursales para un reporte, se
agrega un campo, no un modelo.

Al encender el módulo se crean "Efectivo" y "Mercado Pago" por omisión, porque una pantalla
vacía no la llena nadie.

### 6.3 Turnos y arqueo

```
CashShift
  workspaceId, accountId
  openedAt, openedByUserId, openingAmountArs
  closedAt?, closedByUserId?, countedAmountArs?
  expectedAmountArs?   — calculado al cerrar: apertura + ingresos − egresos
  differenceArs?       — contado − esperado
  differenceNote?      — obligatoria cuando la diferencia no es cero
  status: "ABIERTO" | "CERRADO"
```

Un solo turno abierto por cuenta a la vez — y como cada sucursal es su propia cuenta, tres
sucursales pueden tener tres turnos abiertos en simultáneo sin pisarse. La diferencia no se
corrige borrando movimientos: se explica por escrito. Un arqueo que siempre da cero no sirve
para detectar nada.

### 6.4 Movimientos

```
CashMovement
  workspaceId, accountId, shiftId?
  kind: "INGRESO" | "EGRESO"
  amountArs, occurredAt
  categoryId, paymentMethod
  clientId?            — la llave de los puntos del Club
  description, receiptRef?
  sourceModule?        — "manual" | "sales" | "work-orders" | "bookings" | "membership"
  sourceRef?           — id de la venta, la orden, la reserva o el pago
  reversesMovementId?  — anulación: contramovimiento, nunca borrado
  createdByUserId
```

**Los movimientos con origen no se editan a mano.** Se anulan con un contramovimiento que
deja los dos asientos a la vista. Un libro que se puede reescribir no prueba nada, que es el
mismo criterio que ya rige en `WorkspaceFeeLedgerEntry` y en los sorteos.

`CashCategory` la define cada negocio: Reparaciones, Venta de mostrador, Alquiler de estudio,
Cuotas / Sueldos, Proveedores, Alquiler del local, Impuestos. Con un puñado de categorías
sugeridas al encender el módulo, porque una lista vacía no la llena nadie.

### 6.5 Lo que ya cobran otros módulos

Reservas y Cuotas ya cobran por Mercado Pago. Esos cobros entran a Caja como movimientos
automáticos en la cuenta digital, de sólo lectura. El tesorero de SFPR ve el total real sin
poder tocar lo que ya está cerrado en otro módulo.

Para los cobros anteriores a que exista Caja: **no se migran**. El libro arranca el día que
se enciende, con un saldo inicial declarado. Migrar hacia atrás daría un libro con un tramo
que nadie arqueó nunca.

### 6.6 Reportes

Saldo por cuenta, ingresos y egresos por categoría y período, cierre del día, ranking de
clientes por consumo, historial de arqueos con sus diferencias.

---

## 7. Módulo Ventas (`sales`)

### 7.1 Qué resuelve

Catálogo de productos con costo y precio, existencias, y la venta de mostrador.

DNX Estudio vende portarretratos, bolsos y trípodes —mercadería con existencia física— y
también impresiones y cuadros tercerizados, que no se stockean porque se encargan cuando el
cliente los pide. Los dos casos entran en el mismo módulo con un interruptor por producto.

SFPR deja este módulo apagado.

### 7.2 Productos

```
Product
  workspaceId, sku?, name, description
  categoryId?
  priceArs, costArs        — costo de referencia; el renglón de la venta lo puede pisar
  tracksStock: bool        — el trípode sí; la impresión tercerizada y la sesión, no
  stockQty                 — derivado del libro de movimientos, cacheado
  minStockQty?             — alerta de faltante
  supplierName?            — texto, no entidad. Proveedores es otro módulo, si alguna vez hace falta
  isActive, imageUrl?
```

El costo por renglón importa: una impresión tercerizada cuesta distinto según el tamaño, y
el margen real depende de lo que efectivamente se pagó esa vez.

### 7.3 Stock: alcance deliberadamente corto

```
StockMovement
  workspaceId, productId
  qty                  — firmado: la venta resta, la compra suma
  reason: "VENTA" | "COMPRA" | "AJUSTE" | "DEVOLUCION" | "INICIAL"
  sourceModule?, sourceRef?
  note?, createdByUserId, createdAt
```

La existencia es la suma de la columna; el campo en `Product` es una copia que se recalcula.
Mismo patrón que `WorkspaceFeeLedgerEntry`.

**No** hay FIFO ni costo promedio ponderado, **no** hay órdenes de compra formales, **no**
hay proveedores como entidad, **no** hay depósitos múltiples. El conteo físico se carga como
un ajuste con motivo. Si algún día hace falta más, se agrega sabiendo para qué.

### 7.4 La venta

```
Sale
  workspaceId, saleNumber (correlativo)
  clientId?            — opcional: hay quien compra y no quiere dar datos
  occurredAt, status: "COMPLETADA" | "ANULADA"
  subtotalArs, discountArs, totalArs
  clubDiscountBps?, clubBenefitId?   — qué descuento del Club se aplicó, si alguno
  cashMovementId       — el ingreso que generó
  externalInvoiceRef?  — "Factura B 0003-00001234", cuando se emitió a mano o en otra app
  invoiceId?           — la factura de FotoOffice, desde la etapa 6
  createdByUserId

SaleItem
  saleId, productId?, description
  qty, unitPriceArs, unitCostArs, lineTotalArs
  ivaRate              — la alícuota del renglón. Se guarda desde la 1b aunque no se
                         discrimine en ningún lado hasta la etapa 6
```

Una venta hace tres cosas en la misma transacción: crea el ingreso de caja, descuenta el
stock de los productos que lo controlan, y —si el cliente está identificado— dispara los
puntos del Club. Si algo de eso falla, no se guarda nada.

La compra de mercadería es la operación espejo: un egreso de caja con renglones que **suman**
stock. Mismo mecanismo, un solo libro.

### 7.5 El margen

Con costo por renglón, el reporte de margen real sale casi gratis: cuánto se vendió y cuánto
se ganó de verdad, por producto y por período. Es el número que casi ningún negocio chico
tiene y el que más decisiones cambia.

---

## 8. Módulo Órdenes de trabajo (`work-orders`)

### 8.1 Por qué no se llama "Servicio Técnico"

El cuadro que se manda a imprimir y la cámara que se manda a un laboratorio externo son el
mismo viaje: sale a un tercero, vuelve, se avisa al cliente, se entrega, y se cobra en dos
tramos. Comparten estados, tercero asignado, fecha prometida, seña y saldo, aviso de "ya
está", y comprobante de entrega.

No son idénticos: la reparación además **custodia algo ajeno** —con todo lo que eso implica en
accesorios, estado de recepción y responsabilidad—, tiene diagnóstico y tiene garantía. El
pedido tercerizado no.

Se resuelve con un tipo por orden y campos que sólo aplican a uno de los dos, no con dos
módulos que después hay que mantener en paralelo.

```
type: "REPARACION" | "PEDIDO_TERCERIZADO"
```

### 8.2 Estados

```
RECIBIDA → EN_DIAGNOSTICO → PRESUPUESTADA → APROBADA → EN_PROCESO → LISTA → ENTREGADA
```

Con desvíos reales: `RECHAZADA` (el cliente no aceptó el presupuesto), `TERCERIZADA` (el
equipo salió a un laboratorio externo), `SIN_REPARACION`, `ABANDONADA`, `CANCELADA`.

Un pedido tercerizado saltea `EN_DIAGNOSTICO` y `PRESUPUESTADA`: se encarga con precio
conocido.

### 8.3 Datos

```
WorkOrder
  workspaceId, orderNumber (correlativo), type
  clientId, deviceId?
  — instantáneas del equipo, para que la orden se lea igual dentro de dos años
  deviceBrand, deviceModel, deviceSerial
  accessoriesReceived     — batería, tapa, correa: el origen de la mitad de los conflictos
  cosmeticCondition, intakePhotos[]
  reportedIssue, diagnosis?
  priority, assignedToUserId?
  promisedAt?, externalVendorName?, sentToVendorAt?, returnedFromVendorAt?
  — dinero
  quotedTotalArs?, approvedAt?, approvedVia?, rejectedAt?, rejectReason?
  depositArs, balanceArs
  — entrega
  deliveredAt?, deliveredToName?, warrantyDays?, warrantyUntil?
  reworkOfOrderId?        — volvió dentro de la garantía: no se cobra
  externalInvoiceRef?, invoiceId?    — mismo criterio que Sale: ver §11.1
  status, createdByUserId

WorkOrderItem
  orderId, kind: "MANO_DE_OBRA" | "REPUESTO" | "TERCERIZADO" | "OTRO"
  description, qty, unitPriceArs, unitCostArs, lineTotalArs
  productId?              — cuando el repuesto sale del stock de Ventas

WorkOrderEvent
  orderId, type, actorUserId?, actorLabel?, note?, createdAt
```

`WorkOrderEvent` sigue el mismo patrón que `MemberCardEvent` y `RaffleEvent`, que ya están en
producción: las decisiones se guardan, las derivaciones se calculan, y la instantánea del
actor hace que la historia se siga entendiendo aunque esa persona cambie de nombre.

### 8.4 El presupuesto se aprueba desde el teléfono

El cliente recibe un enlace con un identificador opaco, ve el detalle y aprueba o rechaza.
Queda registrado qué aprobó, cuándo y desde dónde. Sin llamadas telefónicas que después
nadie puede probar.

El mismo enlace sirve de seguimiento: en qué estado está el equipo.

### 8.5 La garantía como dato, no como promesa

La entrega fija una cantidad de días de garantía. Si el equipo vuelve dentro de ese plazo,
la orden nueva se abre enlazada a la original como retrabajo y no se cobra. De paso, sale
gratis la métrica que más dice sobre la calidad del taller: cuántas reparaciones vuelven,
por técnico y por tipo de falla.

### 8.6 Equipos sin retirar

Aviso automático a los 30, 60 y 90 días, con la política de abandono escrita y el registro
de que el aviso salió. Es un problema real y legal de todo taller, y la parte cara es
poder demostrar que se avisó.

---

## 9. Módulo Club (`club`)

### 9.1 Qué es

Un programa de fidelidad sobre los clientes, **sin cuota**. Se llama como el negocio quiera:
"DNX Club", "Fotofix Club". El nombre es configuración, no código.

### 9.2 Los puntos salen de Caja

La decisión que ordena el módulo: **el Club no escucha a cada módulo por separado, escucha a
Caja.** Todo ingreso de caja atribuido a un cliente genera puntos según la regla del programa.

Una reparación pagada, una venta de mostrador, un alquiler de estudio, un curso: todos entran
solos. Y cualquier módulo que se agregue en el futuro también, sin tocar el Club.

### 9.3 Acumular es automático; usar exige adhesión

Son dos cosas distintas y separarlas resuelve el problema:

- **Acumular puntos** es contabilidad del negocio: es el registro de cuánto gastó esa persona.
  No necesita el permiso de nadie. Corre **para todos los clientes, desde la primera compra**.
- **Usar el Club** —canjear, tener el descuento del nivel, recibir el beneficio del mes,
  entrar a los sorteos— exige adherirse, porque implica aceptar las bases y recibir
  comunicaciones.

El resultado es el gancho más fuerte que tiene un programa de fidelidad: el cliente no
arranca en cero. La ficha del mostrador muestra *"3.400 puntos sin activar"*, y esa frase
convierte mucho mejor que cualquier folleto.

La adhesión son diez segundos, y se puede hacer de dos maneras: el cliente solo desde el
portal o un QR, o el mostrador en su nombre con la persona enfrente. En los dos casos queda
registrado quién adhirió, cuándo y por qué vía.

El programa tiene un modo configurable: **por adhesión** (por omisión) o **automática** —todo
cliente nuevo queda adherido al cargarse la ficha—. Con una salvedad que el código tiene que
respetar: el modo automático mete a la persona en el Club, pero **no habilita a mandarle
correos ni a meterla en un sorteo** sin el consentimiento explícito, que es un campo aparte
en `Client`.

### 9.4 Datos

```
ClubProgram
  workspaceId (uno por workspace), name, isActive
  pointsPerAmountArs      — p. ej. 1 punto cada $1.000
  roundingMode
  pointsExpireMonths?     — null = no vencen. **Nulo por omisión y por decisión** (§9.5)
  enrollmentMode: "ADHESION" | "AUTOMATICA"
  termsText, termsVersion

ClubTier
  programId, name ("Bronce"/"Plata"/"Oro"), order
  thresholdAmountArs      — gastado en la ventana móvil
  windowMonths
  discountBps             — 500 = 5%. Entero, nunca decimal
  perksText?

ClubMembership
  programId, clientId (único)
  joinedAt, enrolledVia, enrolledByUserId?
  status: "ACTIVA" | "BAJA"
  memberCode              — para el carnet y el QR
  pointsBalance           — copia; la verdad es la suma del libro
  tierId?, tierRecalculatedAt?

ClubPointsEntry            — libro inmutable
  membershipId?, clientId  — clientId siempre: los puntos existen antes de la adhesión
  points                   — firmado: + gana, − canjea o vence
  kind: "GANADOS" | "CANJE" | "AJUSTE" | "VENCIMIENTO" | "ANULACION"
  sourceModule?, sourceRef?
  expiresAt?, note?, createdByUserId, createdAt

ClubReward
  programId, title, description, imageUrl?
  pointsCost, stockQty?, availableFrom?, availableUntil?
  status

ClubRedemption
  membershipId, rewardId, pointsSpent
  code, status: "PENDIENTE" | "ENTREGADO" | "VENCIDO" | "ANULADO"
  deliveredAt?, deliveredByUserId?, voidReason?

ClubMonthlyBenefit
  programId, title, description
  kind: "DESCUENTO_PCT" | "DESCUENTO_MONTO" | "REGALO"
  valueBps? / valueArs?
  validFrom, validUntil
  tierIds[]?              — vacío = para todos los adheridos
  perMemberLimit, code?
  partnerId?, partnerNameSnapshot?   — soft-link a DnxPartner, igual que RafflePrize

ClubBenefitUse
  benefitId, membershipId, usedAt, saleId? / workOrderId?
```

El saldo de puntos es **la suma del libro**, no un número que alguien pueda pisar. El campo
en `ClubMembership` es una copia que se recalcula. Mismo criterio que el stock y que el libro
de comisiones que ya está en producción.

### 9.5 Vencimiento: no vencen

Decidido el 2026-09-13: **los puntos no vencen.** `pointsExpireMonths` queda en nulo por
omisión y el proceso de vencimiento no se construye en la etapa 3.

La contra, dicha una sola vez y por escrito: el saldo acumulado es una deuda en premios que
sólo crece, y un cliente que vuelve a los cuatro años con veinte mil puntos los tiene todos.
Es una decisión comercial legítima —premiar al que vuelve es justamente el punto— y el campo
queda en el modelo, así que activar un plazo es cambiar un número, no rehacer el módulo.

Lo que sí se construye desde el principio: el asiento `VENCIMIENTO` existe en el libro de
puntos. Sin él, encender el vencimiento más adelante obligaría a migrar el histórico.

Si alguien se da de baja del Club, los puntos se congelan. Si vuelve, los recupera enteros.

### 9.6 Sponsors

Los beneficios de marcas aliadas se referencian contra `DnxPartner` por id, **sin clave
foránea**, exactamente como ya lo hace `RafflePrize`. No se porta a FotoOffice el motor de
sponsors, que vive en otra aplicación de la suite.

### 9.7 El carnet sale casi gratis

El motor de credenciales con QR y el Diseñador ya están construidos para los socios. El
carnet del Club reusa los dos, con las variables del programa en vez de las del padrón.

---

## 10. Sorteos: el destinatario

### 10.1 El cambio

Hoy la regla de participación está fija: socio activo sin cuotas vencidas. Esa no es una
regla del módulo, es **la regla de la audiencia "socios"**. Separarlas deja el sorteo servible
para un negocio sin padrón sin tocar nada de lo que funciona en SFPR.

```
Raffle.audience: "SOCIOS" | "CLIENTES" | "CLUB"
```

| Destinatario | Quién participa |
|---|---|
| Socios | Socio activo sin cuotas vencidas. **La regla de hoy, intacta** |
| Clientes | Cliente activo, con mínimo de consumo o compra reciente opcionales |
| Club | Miembro adherido y activo, con nivel o puntos mínimos opcionales |

### 10.2 Lo que no cambia

**El padrón sellado, la huella pública y la verificación con drand quedan idénticos.** Lo que
hace valioso al módulo —que cualquiera pueda comprobar el resultado meses después— no depende
de si en la bolsa hay socios o clientes.

### 10.3 El cuidado con los datos en producción

`RaffleEntry.memberId` y `RafflePrizeAward.memberId` hoy son obligatorios, con clave foránea a
`Member`, y **ya tienen datos del primer sorteo de SFPR**. El cambio:

- `memberId` pasa a opcional, se agrega `clientId` opcional, y se agrega
  `entrantKind: "SOCIO" | "CLIENTE"`. Exactamente uno de los dos ids, verificado en código.
- Las instantáneas (`memberNumberSnapshot`, `fullNameSnapshot`) **no se tocan**: el nombre de
  la columna queda como herencia, y el comentario aclara que guarda el identificador visible
  —número de socio o número de cliente—. Renombrar una columna con datos vivos por prolijidad
  no vale el riesgo.

Por eso esta etapa va **al final**: es la única que toca una tabla con datos en producción.

### 10.4 Una advertencia que el código tiene que dar

Un sorteo entre **todos los clientes** mete en la bolsa a gente que compró una vez hace tres
años y nunca aceptó nada. La audiencia natural de un sorteo comercial es el Club, donde todos
se adhirieron y aceptaron las bases. La opción "clientes" existe, pero la pantalla avisa lo
que implica antes de dejarla usar.

---

## 11. Facturación electrónica con ARCA (`invoicing`)

### 11.1 Lo que hay que decidir hoy, aunque se construya al final

Éste es el punto que importa de toda la sección. La facturación va en la última etapa, pero
**una venta que no guardó los datos fiscales no se puede facturar nunca más.** Si en marzo
vendiste un trípode y sólo anotaste "Juan", en septiembre no hay forma de emitir esa factura
ni de reconstruir el libro.

Por eso la etapa 1a, que no factura nada, tiene que guardar desde el primer día:

- En `Client`: tipo y número de documento, y **condición frente al IVA** —Responsable
  Inscripto, Monotributo, Exento, Consumidor Final, No Categorizado—. Es un campo obligatorio
  con valor por omisión "Consumidor Final", que es el caso del noventa por ciento del
  mostrador.
- En el workspace: su propia identidad fiscal (§11.5).
- En `Sale` y `WorkOrder`: el tratamiento de IVA de cada renglón, aunque todavía no se
  discrimine en ningún lado.
- En `Sale` y `WorkOrder`: `externalInvoiceRef`, un campo de texto donde anotar *"Factura B
  0003-00001234"* de la factura emitida a mano o en la app de terceros. Cuesta nada y es lo
  que después permite saber qué está facturado y qué no, sin tener que adivinar.

Ese es todo el costo de la etapa 1a. El resto se construye cuando toque.

### 11.2 Qué normativa alcanza a cada workspace

Relevado el 2026-09-13. **No reemplaza la opinión del contador de cada workspace**, que es
quien tiene que confirmar la situación fiscal concreta.

| Norma | A quién alcanza | Desde cuándo |
|---|---|---|
| **RG 5782** + prórroga **RG 5852/2026** | Responsables inscriptos en IVA: el CAE en tiempo real pasa a ser la modalidad obligatoria y el CAEA queda sólo para contingencia | 1 de agosto de 2026 (ya rige) |
| **RG 5893/2026** | Amplía el universo obligado a emitir comprobantes electrónicos. Régimen de Inclusión Social y Efectores: 1 de noviembre de 2026. **Quienes no estén alcanzados por el IVA: 1 de marzo de 2027** | según el grupo |

Traducido a los dos casos concretos:

- **DNX Estudio es monotributista y emite Factura C.** La RG 5782 apunta a responsables
  inscriptos, así que **no lo alcanza**. Y como monotributista ya emite electrónicamente con
  CAE desde hace años. Conclusión: no hay ningún plazo colgando sobre él. Conectar FotoOffice
  con ARCA es comodidad y control, no cumplimiento.
- **SFPR es una asociación civil**, presumiblemente exenta o no alcanzada por IVA. Si está en
  ese grupo, la RG 5893/2026 le pone fecha: **1 de marzo de 2027**. Eso es menos de seis meses
  y coincide exactamente con lo que este módulo resuelve. Conviene confirmarlo con su contador
  antes de planificar la etapa 6.

### 11.2.1 La simplificación que esto habilita

Un monotributista emite **Factura C**. Un exento o no alcanzado por IVA también emite
**Factura C**. Los dos workspaces que van a usar este módulo emiten lo mismo.

Entonces **la primera versión de la etapa 6 sólo necesita comprobantes clase C**, que no
discriminan IVA. Eso saca de encima: la Factura A y la B, la tabla de alícuotas por renglón en
el pedido a ARCA, el desglose de IVA, y las notas de débito y crédito de las otras clases.

Es una reducción real del módulo, no un atajo: si algún día un workspace pasa a responsable
inscripto, se agregan las clases A y B sobre la misma maquinaria —el certificado, el ticket,
la numeración y la conciliación son idénticos—.

La alícuota por renglón se sigue guardando desde la etapa 1b (§7.4). No se manda a ARCA en un
comprobante C, pero sin ella el día que haga falta una Factura B no hay de dónde sacarla.

### 11.2.2 Un solo camino: CAE en tiempo real

No se implementa CAEA, que es la parte más incómoda del servicio: ARCA ya no admite adhesiones
como modalidad principal y lo dejó reservado a contingencia. Si el servicio se cae, se espera.
Este módulo cuesta menos hoy que hace un año.

### 11.3 Cómo funciona

Son dos servicios SOAP encadenados, y cada uno tiene su ambiente de homologación —pruebas— y
el de producción, con **certificados distintos**.

**WSAA** (autenticación). Se firma un pedido con el certificado X.509 y su clave privada, y
devuelve un **Token y un Sign válidos por doce horas**. No se pide uno por operación: ARCA
rechaza un pedido nuevo mientras el anterior siga vigente.

**WSFEv1** (facturación, RG 4291, manual del desarrollador V. 4.7). Las operaciones que este
módulo usa:

| Operación | Para qué |
|---|---|
| `FECAESolicitar` | Pedir el CAE de un comprobante |
| `FECompUltimoAutorizado` | El último número autorizado. **Es lo que salva la numeración** |
| `FECompConsultar` | Qué pasó realmente con un comprobante, cuando la respuesta se perdió |
| `FEParamGetTiposCbte` / `TiposDoc` / `TiposIva` | Las tablas de referencia, que cambian |
| `FEDummy` | Si el servicio está vivo |

### 11.4 Los tres problemas reales

**a) Las claves privadas.** Cada CUIT tiene su certificado y su clave privada, y una clave
privada filtrada permite facturar en nombre de otro. Se guardan cifradas con el mismo cofre
AES-256-GCM que ya cifra los *refresh token* de Google (`lib/integrations/vault.ts`), que está
construido, probado y en producción. Google Secret Manager no es una opción: la facturación de
Google Cloud está cerrada.

**b) El token de doce horas en un entorno sin memoria.** Vercel no comparte memoria entre
invocaciones, así que un token guardado en una variable se pierde. Y como ARCA rechaza un
*login* nuevo mientras el anterior siga vigente, la implementación ingenua —pedir token en cada
pedido— falla apenas hay dos operaciones juntas. El ticket se guarda en la base, con su fecha
de vencimiento, y se renueva sólo cuando falta.

**c) La numeración. Éste es el peligroso.** Los comprobantes son estrictamente correlativos por
punto de venta y por tipo. Si `FECAESolicitar` se corta por tiempo de espera, **no se sabe si
el comprobante quedó autorizado o no**: pedir otro número duplica, y reintentar con el mismo
puede rechazar.

Se resuelve así, y no de otra manera:

1. El comprobante se guarda **antes** de llamar a ARCA, con su número asignado y estado
   `PENDIENTE`.
2. Se llama. La respuesta —CAE o rechazo— se guarda con el pedido y la respuesta crudos.
3. Si no hubo respuesta, el comprobante queda `PENDIENTE` y **nadie asigna el número siguiente
   hasta conciliar**: se consulta `FECompUltimoAutorizado` y `FECompConsultar` para saber qué
   pasó de verdad.

Es el mismo criterio de idempotencia que ya rige en los pagos de Mercado Pago y en la
resolución de los sorteos: el estado se persiste antes del efecto, nunca después.

### 11.5 Datos

```
WorkspaceFiscalProfile
  workspaceId (uno por workspace)
  cuit, razonSocial
  ivaCondition: "RESPONSABLE_INSCRIPTO" | "MONOTRIBUTO" | "EXENTO" | ...
  ingresosBrutos?, inicioActividades?, domicilioFiscal
  defaultPointOfSale

WorkspaceArcaCredential
  workspaceId, environment: "HOMOLOGACION" | "PRODUCCION"
  certPem + keyPem            — cifrados con el cofre; cuatro columnas inseparables
  alias, certExpiresAt        — el certificado vence: hay que avisar antes
  status, createdByUserId

ArcaAuthTicket                — el ticket de doce horas, cacheado
  workspaceId, environment, service ("wsfe")
  token, sign, generationTime, expirationTime

InvoicePointOfSale
  workspaceId, number, description, isActive

Invoice
  workspaceId, pointOfSale, cbteTipo, cbteNumero
  clientId?
  — instantáneas del receptor: la factura se lee igual dentro de diez años
  receptorDocTipo, receptorDocNro, receptorName, receptorIvaCondition
  cbteFecha, concepto
  impNeto, impIVA, impTotConc, impOpEx, impTrib, impTotal
  cae?, caeVto?
  status: "BORRADOR" | "PENDIENTE" | "AUTORIZADA" | "RECHAZADA" | "ANULADA"
  arcaRequestJson, arcaResponseJson     — el pedido y la respuesta crudos, siempre
  relatedInvoiceId?                     — la factura que esta nota de crédito corrige
  saleId? / workOrderId? / membershipChargeId?
  pdfUrl?, createdByUserId

InvoiceItem
  invoiceId, description, qty, unitPriceArs, ivaRate, lineTotalArs

InvoiceEvent
  invoiceId, type, actorUserId?, actorLabel?, note?, createdAt
```

**Una factura autorizada no se borra ni se edita jamás.** Se corrige emitiendo una nota de
crédito que la referencia. Es la misma regla que ya rige en Caja y en el libro de puntos, pero
acá además es la ley.

### 11.6 El QR y el PDF

La RG 4892 exige el código QR en el comprobante impreso o en PDF, con una carga útil en JSON
codificada en base64. El PDF se genera con la misma maquinaria que ya arma los carnets de
socio, de modo que el comprobante sale con la marca de cada negocio.

### 11.7 Puesta en marcha, por workspace

Parte de esto **sólo lo puede hacer el titular del CUIT**, igual que pasó con el calendario de
Google en SFPR:

1. Generar la clave privada y el pedido de certificado.
2. Subirlo en ARCA y descargar el certificado.
3. Asociar el certificado al servicio `wsfe` y al CUIT, en Administración de Certificados
   Digitales.
4. Dar de alta el punto de venta como *Factura Electrónica – Web Services*. **Uno distinto del
   que se use para facturar a mano**, o los números chocan.
5. Probar en homologación de punta a punta.
6. Recién ahí, producción.

### 11.8 SFPR factura las cuotas: la etapa 6 toca también el módulo de Cuotas

Confirmado el 2026-09-13: SFPR quiere facturar las cuotas societarias para poder armar el
balance anual. Eso tiene tres consecuencias que no tiene el caso de DNX Estudio.

**El volumen.** 159 socios por doce meses son unas **1.900 facturas al año**. Es exactamente el
volumen que justifica automatizar: a mano no lo hace nadie, y es la razón más fuerte para
construir este módulo.

**La emisión masiva.** Una corrida mensual emite ~159 comprobantes de una vez, y ahí el
problema de la numeración (§11.4c) deja de ser teórico. Las reglas: la corrida va **en serie o
en lote, nunca en paralelo**; si se corta a mitad de camino, los que ya tienen CAE quedan
firmes y la corrida se reanuda desde el último conciliado, nunca desde cero. El servicio admite
enviar varios comprobantes en un mismo pedido; el tope exacto y su forma se confirman contra el
manual del desarrollador V. 4.7 al implementar, no ahora.

**El consumidor nuevo.** La factura se engancha a `MembershipCharge`, no a `Sale`. El modelo de
`Invoice` ya lo contempla con `membershipChargeId` (§11.5), pero significa que la etapa 6 toca
Cuotas además de Ventas y Órdenes de trabajo. Está contado en el alcance de esa etapa.

### 11.9 Lo que no se construye

CAEA (queda para contingencia y ARCA ya no admite adhesiones como modalidad principal);
facturas de exportación (WSFExv1); bonos fiscales; comprobantes de turismo; libro IVA digital;
percepciones y retenciones; multi-moneda.

### 11.10 El riesgo, dicho con todas las letras

Esto es software fiscal. Un error de numeración o de importe no es un bug de pantalla: tiene
consecuencias con el organismo y con el cliente. Por eso, tres reglas que el plan tiene que
respetar y que no se negocian por apuro:

1. **Homologación completa antes de producción**, por workspace.
2. **Conciliación obligatoria** ante cualquier respuesta perdida, antes de emitir el siguiente.
3. **Al principio, emitir es una acción explícita de una persona.** La emisión automática al
   cobrar llega después, cuando el módulo tenga meses de uso encima.

---

## 12. Etapas

Cada una queda usable sola.

| # | Etapa | Qué queda funcionando | Para quién |
|---|---|---|---|
| **1a** | **Caja + Clientes** | Libro con cuentas y categorías, arqueo por turno, reportes, padrón de clientes con datos fiscales, reflejo de cuotas y reservas | SFPR **completo** y DNX Estudio en parte |
| **1b** | **Ventas** | Catálogo con costo y precio, stock simple, venta de mostrador, compra de mercadería, margen real | DNX Estudio |
| **2** | **Órdenes de trabajo** | Reparaciones y pedidos tercerizados, presupuesto aprobable por enlace, entrega con garantía, equipos sin retirar | El cliente nuevo y DNX Estudio |
| **3** | **Club** | Puntos automáticos desde Caja, niveles, catálogo y canje, beneficio del mes, carnet | Los tres |
| **4** | **Sorteos con destinatario** | Sorteos para clientes y para el Club | Los tres |
| **5** | **Portal del cliente y avisos** | Seguimiento de la orden, puntos, canjes, correos automáticos | Los tres |
| **6** | **Facturación con ARCA** | Factura C con CAE en tiempo real, notas de crédito, PDF con QR, emisión masiva de cuotas, homologación y producción | DNX Estudio, y **SFPR para las cuotas** |

Clientes no es una etapa propia: es la tabla más barata de las seis y sin ella Caja repetiría
el error que ya tiene Reservas —un nombre suelto en un campo de texto— y no habría forma de
enganchar el Club ni de facturar después sin rehacer los datos viejos.

**La etapa 6 se puede adelantar** a continuación de la 2 si hace falta dejar de depender de la
app de terceros antes. Sus únicos requisitos duros son Ventas —que define qué se factura— y los
datos fiscales que la 1a ya captura. Va al final por prudencia, no por dependencia técnica.

## 13. Riesgos y operación

1. **El esquema está compartido por cinco aplicaciones y el despliegue no corre las
   migraciones solo.** Son veintinueve tablas nuevas contando facturación. Cada una hay
   que aplicarla a mano y registrarla en `_prisma_migrations` de las cinco bases, o queda
   desincronizada. El procedimiento verificado está en la nota de memoria de registrar con el
   checksum de una base sana. Va planificado en cada etapa, no improvisado al final.
2. **La etapa 4 toca datos vivos.** Es la única. Va al final y con copia previa.
3. **Ninguna etapa depende de que salgan los correos de FotoOffice.** Los avisos automáticos son
   la etapa 5 justamente por eso: los correos siguen sin desplegarse y atar Caja o el taller a
   ellos las dejaría bloqueadas.
4. **La etapa 6 guarda claves privadas.** Se reusa el cofre cifrado que ya existe, y el acceso a
   emitir tiene que quedar restringido a roles de administración del workspace.
5. **Alcance.** Son seis módulos nuevos más una extensión. El riesgo real no es técnico: es
   empezarlos todos y no terminar ninguno. Por eso 1a sale a producción sola, en SFPR, antes
   de escribir una línea de la 1b.

## 14. Fuera de alcance

Explícitamente **no** entra en este diseño, y si hace falta es un proyecto aparte:

- **Contabilidad**: plan de cuentas, asientos, balances.
- **Libro IVA digital**, percepciones y retenciones.
- **Sueldos y empleados** más allá de un egreso con categoría.
- **Cuentas corrientes**: fiado a clientes y deuda con proveedores.
- **Proveedores como entidad**, órdenes de compra formales, FIFO o costo promedio ponderado.
- **Depósitos múltiples** y transferencias de stock entre ellos.
- **Un módulo de ventas en línea.** Esto es un mostrador, no una tienda.
- **Facturación fuera de la Argentina.** El módulo de la etapa 6 es específico de ARCA.

## 15. Preguntas abiertas

Contestadas el 2026-09-13: SFPR **sí** factura las cuotas, para el balance anual (§11.8). DNX
Estudio es **monotributista y emite Factura C**, por lo que no lo alcanza la RG 5782 (§11.2).

Quedan abiertas:

1. **¿Cuál es la condición fiscal exacta de SFPR?** Si es exenta o no alcanzada por IVA, la RG
   5893/2026 le pone fecha: 1 de marzo de 2027. Lo tiene que confirmar su contador, y de eso
   depende si la etapa 6 tiene un plazo real o no. Es la única pregunta con fecha encima.
2. **¿Quién puede abrir y cerrar caja?** Hace falta decidir si alcanza con los roles de
   workspace que ya existen o si el módulo necesita los suyos. Se resuelve dentro de la etapa 1a.

Contestadas también el 2026-09-13: **`Emeveph` no es el servicio técnico** —ése va a ser un
workspace nuevo—; **las cajas las define el administrador de cada workspace**, tantas como
sucursales tenga (§6.2); y **los puntos no vencen** (§9.5).

## 16. Fuentes consultadas

- [Webservices de factura electrónica — documentación oficial ARCA](https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp)
- [Ayuda — Factura electrónica, ARCA](https://www.afip.gob.ar/fe/ayuda/webservice.asp)
- [Resolución General (ARCA) 5852/2026 — prórroga](https://tristanyasociados.com/2026/05/resolucin-general-arca-58522026/)
- [CAE obligatorio desde agosto 2026: qué cambia con el CAEA](https://wynges.com/blog/caea-cae-cambio-2026/)
- [RG 5893/2026 — amplía el universo obligado a emitir comprobantes electrónicos (ARCA)](https://servicioscf.afip.gob.ar/publico/sitio/contenido/novedad/ver.aspx?id=5881)
- [Factura C: quién la emite y cómo se hace en ARCA](https://garca.app/monotributo/factura-c)
