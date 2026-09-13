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

Esto lo resuelve, en cinco módulos nuevos y una extensión del que ya existe.

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

### 6.2 Cuentas: por qué no alcanza con una

El efectivo se cuenta; Mercado Pago y el banco se concilian. Meterlos en la misma bolsa
haría que el arqueo diera mal todos los días.

```
CashAccount
  workspaceId, name ("Efectivo", "Mercado Pago", "Banco", "Tarjeta")
  kind: "EFECTIVO" | "DIGITAL"
  isDefault, isActive, order
```

Sólo las cuentas `EFECTIVO` se arquean.

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

Un solo turno abierto por cuenta a la vez. La diferencia no se corrige borrando movimientos:
se explica por escrito. Un arqueo que siempre da cero no sirve para detectar nada.

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
  createdByUserId

SaleItem
  saleId, productId?, description
  qty, unitPriceArs, unitCostArs, lineTotalArs
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
  pointsExpireMonths?     — null = no vencen
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

### 9.5 Vencimiento

Los puntos vencen estén activados o no. Si no, el saldo latente crece para siempre y un día
el negocio se encuentra con una deuda enorme en premios que nunca previó.

Aviso previo por correo: *"te vencen 800 puntos el 31 de octubre"*. Es el mensaje que más
canjes genera en cualquier programa de fidelidad.

Si alguien se da de baja del Club, los puntos se congelan. Si vuelve, recupera los que no
hayan vencido mientras tanto.

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

## 11. Etapas

Cada una queda usable sola.

| # | Etapa | Qué queda funcionando | Para quién |
|---|---|---|---|
| **1a** | **Caja + Clientes** | Libro con cuentas y categorías, arqueo por turno, reportes, padrón de clientes, reflejo de cuotas y reservas | SFPR **completo** y DNX Estudio en parte |
| **1b** | **Ventas** | Catálogo con costo y precio, stock simple, venta de mostrador, compra de mercadería, margen real | DNX Estudio |
| **2** | **Órdenes de trabajo** | Reparaciones y pedidos tercerizados, presupuesto aprobable por enlace, entrega con garantía, equipos sin retirar | El cliente nuevo y DNX Estudio |
| **3** | **Club** | Puntos automáticos desde Caja, niveles, catálogo y canje, beneficio del mes, carnet | Los tres |
| **4** | **Sorteos con destinatario** | Sorteos para clientes y para el Club | Los tres |
| **5** | **Portal del cliente y avisos** | Seguimiento de la orden, puntos, canjes, correos automáticos | Los tres |

Clientes no es una etapa propia: es la tabla más barata de las seis y sin ella Caja repetiría
el error que ya tiene Reservas —un nombre suelto en un campo de texto— y no habría forma de
enganchar el Club después sin rehacer los datos viejos.

## 12. Riesgos y operación

1. **El esquema está compartido por cinco aplicaciones y el despliegue no corre las
   migraciones solo.** Son unas veinticinco tablas nuevas. Cada una hay que aplicarla a mano y
   registrarla en `_prisma_migrations` de las cinco bases, o queda desincronizada. El
   procedimiento verificado está en la nota de memoria de registrar con el checksum de una base
   sana. Va planificado en cada etapa, no improvisado al final.
2. **La etapa 4 toca datos vivos.** Es la única. Va al final y con copia previa.
3. **Ninguna de las cinco etapas depende de que salgan los correos de FotoOffice.** Los avisos
   automáticos son la etapa 5 justamente por eso: los correos siguen sin desplegarse y atar
   Caja o el taller a ellos las dejaría bloqueadas.
4. **Alcance.** Son seis módulos. El riesgo real no es técnico, es empezar los seis y no
   terminar ninguno. Por eso 1a sale a producción sola, en SFPR, antes de escribir la 1b.

## 13. Fuera de alcance

Explícitamente **no** entra en este diseño, y si hace falta es un proyecto aparte:

- **Facturación electrónica / AFIP.** Ni comprobantes fiscales, ni puntos de venta, ni
  CAE. Caja registra movimientos, no emite facturas. Ver §14.
- **Contabilidad**: plan de cuentas, asientos, balances.
- **Sueldos y empleados** más allá de un egreso con categoría.
- **Cuentas corrientes**: fiado a clientes y deuda con proveedores.
- **Proveedores como entidad**, órdenes de compra formales, FIFO o costo promedio ponderado.
- **Depósitos múltiples** y transferencias de stock entre ellos.
- **Un módulo de ventas en línea.** Esto es un mostrador, no una tienda.

## 14. Preguntas abiertas

1. **¿El negocio necesita emitir facturas desde FotoOffice?** Es la más importante. Si la
   respuesta es sí, cambia la etapa 1b y probablemente convenga resolverlo con un servicio de
   terceros antes que construirlo. Si es no, Caja alcanza y sobra.
2. **¿El servicio técnico es un workspace nuevo o es `Emeveph`**, el que se creó el 2026-09-10
   y todavía no tiene ningún módulo encendido?
3. **¿Cuántas cajas físicas hay?** El diseño soporta varias; el valor por omisión es una.
4. **¿Quién puede abrir y cerrar caja?** Hace falta decidir si alcanza con los roles de
   workspace que ya existen o si el módulo necesita los suyos.
5. **¿Cada cuánto vencen los puntos?** Es configuración, pero conviene fijar el valor
   recomendado antes de la etapa 3.
