# Etapa 3 · Pedidos y Cobranzas

> 08/10/2026 · Reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §4). Se apoya en las Etapas 0, 1 y 2,
> ya en producción (PR 277, 402, 408, 410, 412, 414, 416, 418).
>
> **Decisiones de Daniel (08/10):**
> - Las deudas a cobrar y a pagar nacen **al confirmar el pedido**, no al completarlo.
> - Formas de pago: se ofrecen **las opciones de pago de ¿Cuánto Cobro?**, es decir contado con descuento y
>   planes de N cuotas con o sin interés. Si la organización no configuró ninguna, la opción por omisión es
>   **hasta 6 cuotas sin interés**, o **hasta la fecha del evento** cuando faltan menos de 6 meses.
> - Comprobante: **recibo interno con número**. No es factura.
> - Rubros jerárquicos de **ingresos y costos** (3.x y 4.x) en esta etapa.
>
> Lo demás va marcado **[decisión]**. **Sin staging.** El análisis de brecha está en la conversación del 08/10.

## 1. Qué problema resuelve

En Alboom, DNX crea el pedido desde el presupuesto con "Crear Pedido", le arma un plan de N cuotas, cobra con
link de pago y le avisa al cliente 1 día antes de cada vencimiento. Además carga los costos de cada trabajo
(proveedores como La Isla o freelancers) y los clasifica con un plan de cuentas: ingresos 3.1.x por tipo de
trabajo y costos 4.0/4.1.

Alboom tiene defectos que no hay que copiar:

- las cuotas a cobrar recién aparecen al pasar el pedido a "Venta completada";
- un pago parcial crea una deuda nueva por el saldo;
- un cobro no se anula, se borra;
- el vencimiento de los costos no es claro.

FOTOFFICE tiene la base en producción:

- presupuesto aceptado que queda "Pedido por confirmar";
- Caja: cuentas, movimientos inmutables que se anulan con contramovimiento, rubros planos y depósito
  automático según el medio de pago;
- cobro con Mercado Pago en la cuenta de cada organización, con webhooks (reservas, cursos, tienda, cuotas);
- numeración `PEDIDO`;
- plantillas con variables y envío automático con topes;
- motor de etapas, que declara `SENA_COBRADA` sin usarlo;
- costos-plantilla por producto (proveedor, importe, días desde el evento).

Faltan el pedido, el plan de cuotas, los cobros con recibo, las cuentas a pagar y los rubros de dos niveles.

## 2. Alcance

Se publica en **dos entregas** **[decisión]**.

### Entrega A · Pedido, plan de cuotas y cobros

1. **Opciones de pago** en el presupuesto, con el modelo de ¿Cuánto Cobro?:
   - contado, con descuento opcional en %;
   - planes de N cuotas sin interés, con interés manual o con interés sugerido por índice;
   - una nota comercial para cada opción.

   Se configuran por organización (Configuración → Presupuestos) y se pueden cambiar en cada presupuesto. Al
   enviar, la versión congela las opciones calculadas sobre su total. El cliente las ve en el enlace y, al
   aceptar, **elige una**. Si no elige, queda la primera.

   **Opción por omisión.** Si la organización no configuró ninguna, el presupuesto ofrece "Hasta N cuotas sin
   interés", con N = 6. Si el evento cae antes, N es la cantidad de meses completos que faltan, con un mínimo
   de 1.

   El texto libre "propuesta de pago" de la Etapa 2 sigue existiendo como nota.
2. **Pedido.**
   - Botón **"Confirmar pedido"** en el presupuesto aceptado. En una sola transacción:
     - crea el pedido con la instantánea de ítems y totales de la versión aceptada;
     - copia los datos del evento de la consulta (fecha, salones, invitados);
     - asigna el número `PEDIDO`;
     - genera el plan de cuotas desde la opción elegida;
     - apaga "Pedido por confirmar".

     Un presupuesto genera **un solo pedido**.
   - También hay **alta manual** desde un contacto, sin presupuesto, con ítems del catálogo o de texto libre.
   - Estados:
     - `CONFIRMADO`;
     - `EN_CURSO`: se pasa a mano o con el primer cobro;
     - `COMPLETADO`: a mano;
     - `CANCELADO`: exige motivo y deja de recordar las cuotas pendientes. Los cobros hechos quedan.
3. **Plan de cuotas.**
   - Generador puro: N cuotas con intervalo mensual a partir del día de confirmación. La última cuota absorbe
     el redondeo.
   - **Tope por el evento:** si las cuotas mensuales no entran antes de la fecha del evento, se reparten parejas
     entre la confirmación y el día del evento **[decisión]**.
   - Contado: 1 cuota con vencimiento el día de la confirmación.
   - Con interés: el total financiado es el de la opción, y el pedido muestra la diferencia como "interés de
     financiación".
   - **Edición:** importe, vencimiento y medio sugerido de cada cuota sin cobros. Se puede agregar o quitar
     cuotas. Al guardar, la suma tiene que dar el total del pedido, como en Alboom. Si después cambia el total,
     el pedido avisa "Plan descuadrado".
4. **Cobros** (manuales en esta entrega).
   - Medios: efectivo, transferencia, Mercado Pago (cobrado afuera), tarjeta y otro. Son los 5 de Caja.
   - Se puede adjuntar un comprobante.
   - **Pago parcial:** un cobro se imputa a una o varias cuotas, de la más vieja a la más nueva, o a mano. Una
     cuota puede quedar con saldo. **Nunca** se crea una deuda nueva.
   - Cada cobro crea su movimiento de Caja (`sourceModule = "pedidos"`) en la cuenta que corresponde al medio,
     con el depósito automático existente y el rubro de ingreso del pedido.
   - **Anular** un cobro exige motivo. Genera el contramovimiento en Caja, libera las imputaciones y anula el
     recibo, que sigue visible marcado "ANULADO". Nunca se borra.
   - El primer cobro del pedido avisa `SENA_COBRADA` al motor de etapas.
5. **Recibo X interno.**
   - Numeración propia `RECIBO`.
   - Incluye: fecha, cliente, concepto (pedido N° y evento), importe en números y en letras, medio y cuotas
     imputadas.
   - Enlace público con clave (token con hash) y **vista para imprimir o guardar como PDF**, igual que el
     presupuesto.
   - Leyenda fija: "Documento no válido como factura".
   - Se manda por correo al cliente con la plantilla automática "Recibo de pago", que se puede apagar.
6. **Enlace del pedido para el cliente.** Muestra ítems, plan de cuotas con estado (pagada, parcial, vencida,
   pendiente), saldo y recibos. Se manda con la plantilla "Tu pedido" y la variable `[pedido_enlace]`.
7. **Rubros de dos niveles para ingresos y costos.**
   - Un rubro puede tener **padre** y **código** (3.1.2, 4.0…).
   - Los informes de Caja agrupan por padre.
   - Semilla del plan de DNX, sólo si falta: ingresos 3.1.x por tipo de trabajo y costos 4.0/4.1.
   - El rubro de ingreso del producto pasa de texto a **rubro de Caja**. El texto viejo se ofrece como
     sugerencia.
   - El pedido toma el rubro de ingreso del primer ítem que tenga uno, y se puede cambiar.
8. **Pantallas.**
   - Lista de pedidos (listado estándar 0.2) con número, contacto, evento, estado, total, cobrado, saldo y
     próximo vencimiento. Filtros: estado, con saldo, con cuotas vencidas.
   - Ficha del pedido (0.3) con: datos del evento, ítems, plan de cuotas, cobros y recibos, historial y botones
     "Registrar cobro", "Editar plan", "Enviar enlace" y "Cambiar estado".
   - Tarjeta "Pedidos" en la ficha del contacto y de la consulta.
   - En el presupuesto aceptado, el botón "Confirmar pedido" o, si ya se confirmó, el enlace al pedido.
   - Módulo `orders` ("Pedidos"): pasa de planificado a disponible y depende de Presupuestos.

### Entrega B · Cobro en línea, recordatorios y cuentas a pagar

1. **Link de Mercado Pago por cuota.**
   - Preferencia con la cuenta conectada de la organización, por el saldo de la cuota.
   - Webhook `pedidos-webhook` con el patrón de los existentes: responde siempre 200 y consulta el pago a
     Mercado Pago.
   - Crea el cobro, el recibo y el movimiento de Caja con neto y comisión de MP. Es idempotente por el id del
     pago.
   - En el enlace del pedido, botón "Pagar cuota".
   - Comisión de plataforma FOTOFFICE: se aplica según la configuración existente de la organización, igual que
     en la tienda **[decisión]**.
2. **Recordatorios de cobro.**
   - Tarea programada diaria a las 10:00, hora de Argentina.
   - Cuotas con saldo que vencen dentro de N días (DNX usa 1), en pedidos sin cancelar.
   - Correo con la plantilla "Recordatorio de cuota" y el link de pago.
   - Una vez por cuota y vencimiento, con los topes de los automáticos.
   - Se configura N y se enciende o apaga en Configuración → Pedidos.
3. **Cuentas a pagar.**
   - Al confirmar el pedido, por cada costo-plantilla de sus ítems y de los componentes de sus combos, se crea
     una deuda con:
     - proveedor;
     - concepto;
     - importe: fijo o por unidad × cantidad;
     - vencimiento: fecha del evento + días. Si no hay fecha de evento, queda "sin vencimiento".
   - Pedidos confirmados antes de la Entrega B: botón "Generar costos" en la ficha.
   - Se editan y se agregan por pedido.
   - **Pagar** crea un egreso en Caja con el rubro de costo. **Anular el pago** usa el contramovimiento.
   - Pantalla "A pagar": vencidas, próximos 30 días y por proveedor.
   - La ficha del pedido muestra el **margen real**: cobrado − costos. Sólo lo ven quienes ven costos (`configurar`
     o `verDinero`).
4. **Informes mínimos** (hora y pesos de Argentina):
   - "A cobrar": vencido, esta semana y total, por cliente;
   - "Cobrado este mes": por medio de pago;
   - "A pagar": próximos 30 días.
5. **Checklist del pedido.** Lista simple de tareas por plantilla, con "Con contrato" y "Simple" sembradas para
   DNX. Corrige el duplicado de Alboom.

**Fuera de alcance:** factura electrónica ARCA, conciliación bancaria, unidades de negocio, USD, contratos
(Etapa 5) y gastos 5.x.

## 3. Cómo lo vive quien usa el sistema

### 3.1 Del presupuesto al pedido

1. Al armar el presupuesto, la sección **"Opciones de pago"** viene cargada con las de la organización. Por
   ejemplo:
   - "Contado 10% off";
   - "3 cuotas sin interés";
   - "6 cuotas con 15%".

   Se pueden quitar o agregar, y los importes se ven en vivo.
2. El cliente abre el enlace, ve cada opción con su importe por cuota y elige una al aceptar.
3. En la ficha del presupuesto aparece **"Confirmar pedido"**. Muestra el plan que se va a crear, con las
   cuotas, sus importes y vencimientos, y se puede ajustar antes de confirmar.
4. Al confirmar, abre la ficha del pedido.

### 3.2 Cobrar

1. "Registrar cobro": importe (por omisión, el saldo de la cuota más vieja), fecha, medio, comprobante y
   reparto entre cuotas.
2. Al guardar se ve el recibo, con los botones "Enviar por correo", "WhatsApp" (abre `wa.me` con el enlace) e
   "Imprimir".

### 3.3 El cliente

- Enlace del pedido: plan, saldo, recibos y, en la Entrega B, "Pagar cuota".
- Enlace del recibo: el recibo para imprimir o guardar como PDF.

### 3.4 Configuración

- **Presupuestos → Opciones de pago:** el contado y los planes de cuotas, con el editor de ¿Cuánto Cobro?.
- **Pedidos:** rubro de ingreso por omisión y plantillas, y en la Entrega B los recordatorios.
- **Caja → Rubros:** padre y código.

## 4. Cómo está hecho

### 4.1 Datos

Tablas nuevas `Fotoffice*` y columnas que admiten nulo en tablas `Fotoffice*` propias. **Ninguna columna en
tablas compartidas** (`CashCategory`, `Product`, `Client`).

**Entrega A**

- `FotofficePresupuestoVersion` (propia, de la Etapa 2) suma `paymentOptions Json?` (las opciones congeladas) y
  `chosenPaymentOptionId String?`.
- `FotofficePresupuestoAjustes` suma `paymentOptions Json?` (lo que se carga por omisión).
- `FotofficePedido`:
  - `workspaceId`, `number`;
  - `presupuestoId?` (**único**), `acceptedVersionId?`, `consultaLeadId?`, `clientId`;
  - `status` (texto + CHECK), `cancelReason?`;
  - `items` y `totals` (instantáneas JSON), `totalArs Decimal(12,2)`;
  - `paymentOption` (JSON con la opción elegida);
  - evento: `eventDate Date?`, `eventLabel?`;
  - `incomeCategoryId?`, `ownerUserId?`;
  - `accessTokenHash?` (único), `createdByUserId`, fechas.

  Único `(workspaceId, number)`.
- `FotofficePedidoCuota`: `pedidoId`, `position`, `dueDate Date`, `amountArs`, `suggestedMethod?`. El saldo se
  calcula con las imputaciones vigentes.
- `FotofficeCobro`:
  - `workspaceId`, `pedidoId`, `clientId`;
  - `paidAt`, `method`, `amountArs`, `feeArs?`, `netArs?`;
  - `providerPaymentRef?` (único; se usa en la Entrega B), `cashMovementId?` (único), `attachmentId?`;
  - `receiptNumber`, `receiptTokenHash` (único);
  - `voidedAt?`, `voidReason?`, `voidCashMovementId?`;
  - `createdByUserId?`.
- `FotofficeCobroImputacion`: `cobroId`, `cuotaId`, `amountArs`. Único `(cobroId, cuotaId)`.
- `FotofficeRubro` (perfil 1:1 de `CashCategory`): `categoryId` (único), `workspaceId`, `parentCategoryId?`,
  `code?`. Sin ciclos y con **un solo nivel de padre** **[decisión: el mismo patrón de perfil que el catálogo,
  para no tocar `CashCategory`]**.
- `FotofficeProductoCatalogo` (propia) suma `incomeCategoryId String?`.
- Secuencia `RECIBO` en `CLAVES_SECUENCIA` (fila nueva en `FotofficeSequence`, sin cambio de esquema).

**Entrega B**

- `FotofficeCuentaPagar`:
  - `workspaceId`, `pedidoId?`, `supplierClientId?`, `costoPlantillaId?`;
  - `concept`, `amountArs`, `dueDate?`, `costCategoryId?`;
  - `paidAt?`, `paidCashMovementId?`, `voidedAt?`.
- `FotofficeCuotaRecordatorio`: `cuotaId`, `dueDate` y `sentAt`, con único `(cuotaId, dueDate)`.
- `FotofficePedidoAjustes`: `reminderDays`, `reminderEnabled` e `incomeCategoryId?`.
- `FotofficeCuota.mpPreferenceId?`.
- Checklist: `FotofficePedidoTarea`, con plantillas en JSON en los ajustes.

Dinero en `Decimal(12,2)`, igual que Caja. La migración se escribe a mano, se aplica en producción **antes**
del código y se registra con resolve.

### 4.2 Código

- **Puro y con pruebas:**
  - `lib/pedidos/opciones-pago.ts`: el cálculo de las opciones portado de ¿Cuánto Cobro?, con los tipos de
    `@repo/cuanto-cobro-core` **[decisión: copiar las funciones puras, sin tocar CompraMeLaFoto]**, más la
    opción por omisión de 6 cuotas o los meses hasta el evento;
  - `lib/pedidos/plan-cuotas.ts`: generar, validar suma y tope por evento;
  - `lib/pedidos/imputacion.ts`;
  - `lib/pedidos/numero-a-letras.ts`.
- **Servidor:**
  - `lib/pedidos/confirmar.ts`: transacción y carrera, un pedido por presupuesto;
  - `lib/pedidos/cobros.ts`: registrar, imputar, movimiento de Caja y anular;
  - `lib/pedidos/recibos.ts`;
  - `lib/pedidos/enlace.ts`: token HMAC con hash, igual que el presupuesto;
  - `lib/pedidos/acceso.ts`: módulo `orders`; Ver para leer, Gestionar para cobrar y editar;
  - `lib/rubros/*`.
- **Rutas públicas:** `/w/[slug]/pedido/[token]` y `/w/[slug]/recibo/[token]`. Con freno por IP, sin datos
  internos y con `noindex`.
- **Plantillas:**
  - tipo `PEDIDO`;
  - variables `[pedido_numero]`, `[pedido_enlace]`, `[pedido_saldo]`, `[recibo_numero]`, `[recibo_enlace]`,
    `[recibo_importe]`, `[cuota_vence]`, `[cuota_importe]`, `[cuota_link_pago]`;
  - automáticos "Recibo de pago" y "Recordatorio de cuota".
- **Motor de etapas:** `SENA_COBRADA` se emite con la consulta del pedido como sujeto. El adaptador de sujeto
  `PEDIDO` queda para el checklist de la Entrega B.

## 5. Errores y casos borde

- **Dos personas confirman el mismo presupuesto:** el único `presupuestoId` hace que gane una. La otra ve "Ya
  tiene pedido" y el enlace.
- **Cobro mayor que el saldo del pedido:** se rechaza. Para devolver plata se anula el cobro.
- **Doble clic en "Registrar cobro":** una clave de idempotencia en el formulario impide el duplicado.
- **Anular un cobro dos veces:** la segunda no hace nada. El contramovimiento es único por movimiento.
- **Editar el plan:** las cuotas con cobros sólo admiten un importe igual o mayor que lo imputado.
- **Pedido sin fecha de evento:** el plan es mensual sin tope.
- **Evento ya pasado al confirmar:** una sola cuota con vencimiento hoy, con aviso.
- **Total cero:** no se crea plan.
- **Con interés:** el total del pedido es el financiado. La diferencia se ve aparte y se registra en el mismo
  rubro de ingreso **[decisión]**.
- **Cancelar con saldo:** las cuotas quedan "canceladas" y no suman a "A cobrar".
- **Permisos:** registrar y anular cobros requieren Gestionar en `orders`. El margen sólo se ve con `configurar`
  o `verDinero`.
- **Datos personales:** los registros guardan sólo ids y códigos.

## 6. Pruebas

- **Puras:**
  - opciones de pago, igual a ¿Cuánto Cobro? en los mismos casos;
  - opción por omisión con 6 cuotas, 2 meses y evento pasado;
  - plan: redondeo, tope por evento y suma;
  - imputación: parcial, varias cuotas y de la más vieja a la más nueva;
  - números en letras.
- **Servidor con la base en memoria:**
  - confirmar: copia, numeración, carrera y aislamiento;
  - cobrar: movimiento de Caja idempotente, recibo, `SENA_COBRADA` sólo con el primero;
  - anular: contramovimiento y saldo restituido;
  - permisos.
- **De fuente:**
  - las páginas públicas no leen costos ni notas internas;
  - sin `@repo/db` en componentes de cliente.
- **Entrega B:**
  - webhook idempotente con el mismo pago dos veces;
  - recordatorios: una vez por cuota y topes;
  - cuentas a pagar desde combos.

## 7. Criterios para el tablero de avance

- **A:** un presupuesto aceptado se confirma, el pedido tiene plan, se cobra una cuota en efectivo y Caja
  muestra el ingreso. El recibo se abre desde otro navegador y la consulta pasa a seña cobrada.
- **B:** el cliente paga una cuota por Mercado Pago y se ve sola en el pedido y en Caja. El recordatorio sale el
  día anterior y los costos del pedido aparecen en "A pagar".

## 8. Publicación (sin staging)

Para cada entrega:

1. Migración en la base de FOTOFFICE (rama `development` de Neon) **antes** del código, registrada con
   checksum.
2. PR, chequeos y fusión.
3. Verificar el despliegue y que no haya errores 5xx.
4. Configurar DNX:
   - numeración `PEDIDO` con año y 4 dígitos (2026-0001; pedido de Daniel del 08/10);
   - `RECIBO` con año y 4 dígitos;
   - encender el módulo `orders`;
   - sembrar los rubros.
5. Prueba en producción con un pedido de prueba, que después se cancela, y sus cobros, que se anulan.
