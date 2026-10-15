# Del presupuesto a la Caja, y los números del estudio — diseño

- **Fecha:** 15/10/2026 (aprobado el alcance por Daniel el mismo día: etapas A a E + Conciliación).
- **Estado:** diseño. No hay código en esta rama.
- **Base revisada:** `origin/main` en `65e6235c1` (PR 596). Las PR 598 (desgaste de cámara por trabajo) y
  599 (extras como conceptos en DNX Bot) están **abiertas, sin fusionar**: la etapa A se construye encima de ellas.
- **Relacionadas:** `2026-10-07-etapa-2-catalogo-y-presupuestos-design.md`, `2026-10-08-perfil-de-precios-design.md`,
  `2026-10-12-dnx-bot-cuanto-cobro-design.md`, spec de la etapa 3 (pedidos, cuotas, cobros) y etapa 6 (informes).

---

## Parte 1 · Resumen para Daniel

### Lo más importante primero

Buena parte del recorrido **ya existe**: el presupuesto aceptado se convierte en **pedido**, el pedido tiene
**plan de cuotas**, **recordatorios** por correo, **cobro con Mercado Pago** en su enlace público, **cobros a mano**
que entran solos a **Caja**, y **cuentas a pagar** a proveedores atadas al pedido. Lo que falta es unir los
extremos: que el precio contemple impuestos, comisión y recargos; que el cliente pague la seña en el
mismo momento en que acepta; que la Caja muestre la comisión real de Mercado Pago; que se vea cuánto
se ganó de verdad en cada trabajo y en el mes; y que las transferencias se reconozcan solas.

Hoy hay dos cosas que frenan todo en DNX Estudio (lo miré en la base, sin tocar nada):

- Hay **dos organizaciones "DNX Estudio"**. Una tiene Pedidos, Proyectos y Agenda pero **no tiene Caja**; la
  otra tiene Caja pero **no tiene Pedidos**. Ninguna tiene presupuestos, pedidos ni movimientos todavía.
- **Ninguna de las dos tiene Mercado Pago conectado.** Sin eso no se puede cobrar la seña ni leer transferencias.

### Qué vas a ver, etapa por etapa

**A · El precio completo.** En Configuración → Precios (y en la entrevista de DNX Bot) cargás una sola vez:
monotributo, Ingresos Brutos, si sos responsable inscripto, la comisión del medio de pago, la seña, los
recargos por fin de semana, feriado y entrega exprés, el valor por kilómetro o por zona, el seguro del equipo,
los minutos que te lleva retocar una foto, el precio mínimo por trabajo y tu política de cancelación. Al cotizar,
el bot pregunta fecha y lugar del evento, se da cuenta solo si es sábado, domingo o feriado, calcula el viaje y
te muestra el precio armado paso a paso: costo → ganancia → recargos → impuestos y comisión → total, la seña y el
precio de la hora extra. Si el total queda por debajo de tu mínimo, te avisa.

**B · El cliente ve y paga la seña.** El enlace del presupuesto muestra el total, la seña y el plan de pagos.
Al tocar "Acepto", se crea el pedido solo y el cliente pasa a pagar la seña **con Mercado Pago** en la misma
pantalla, o elige **transferencia** y ve tu alias y CBU. Si paga por transferencia, el pedido queda "esperando pago"
hasta que FOTOFFICE la encuentre (ver Conciliación).

**C · El trabajo.** El pedido es el trabajo: fecha del evento, lo cobrado, el saldo, las cuotas y sus avisos.
Cada pago, por Mercado Pago o en efectivo, entra a Caja solo. **Novedad:** la comisión que te cobró Mercado Pago
también entra a Caja como gasto, así el saldo de la cuenta Mercado Pago coincide con lo que ves en la app de MP.

**D · Lo que costó y lo que quedó.** Desde el pedido cargás en un paso los gastos del trabajo (proveedor,
asistente, viáticos). Cada trabajo tiene una pantalla "Presupuestado vs real": lo que pensabas cobrar y gastar,
contra lo que cobraste y gastaste, y la ganancia real.

**E · Los números del estudio.** Separás tres cosas: los **gastos fijos del estudio** (alquiler, servicios,
software, contador, publicidad, insumos, mantenimiento, sueldos y cargas), **tu retiro** y los **costos de cada
trabajo**. Cargás a tu equipo (sueldo o jornal, cargas, días y horas, qué parte es facturable) y FOTOFFICE calcula
el costo por hora de cada uno y el **valor hora del estudio**. Un tablero mensual te dice cuánto necesitás facturar
para cubrir el mes (punto de equilibrio), cuánto llevás, cuánto deja cada línea de negocio (eventos, sesiones en
estudio, impresiones, cursos…) y cuántas horas del equipo se usaron. Si los gastos fijos reales de los últimos
3 meses no coinciden con los que declaraste, te avisa. Y podés **importar tus 3 años de caja** de Excel como
"histórico", mes por mes, con un resumen para revisar antes de confirmar, sin que cambie el saldo de hoy; el sistema
te avisa cuando falta un débito automático que se repite todos los meses.

**Conciliación · Las transferencias se reconocen solas.** Toda venta que se paga por transferencia (presupuestos y
pedidos primero; después tienda, cursos, galerías y reservas) queda "esperando pago". FOTOFFICE mira las
transferencias que entran a tu cuenta de Mercado Pago y, si encuentra **una sola** que coincide en monto, fecha y
nombre o CUIT del que paga, la aplica sola: marca la venta como paga y la anota en Caja. Si hay dudas, te muestra
"Posibles pagos" para confirmar con un clic. Opcional: **"monto único"**, que suma unos pocos pesos a cada venta
pendiente para que no haya dos iguales. Para cuentas de banco que no son Mercado Pago, subís el extracto o la
marcás a mano.

> **Atención:** Mercado Pago **no documenta** en forma clara que las transferencias recibidas al CVU o alias se
> puedan leer por su API de pagos. Sí documenta un reporte de movimientos que trae el nombre y el documento de quien
> transfiere. El primer paso de la Conciliación es una prueba real con tu cuenta (te transferís $10 desde el banco y
> desde otra cuenta de Mercado Pago) para saber cuál de los dos caminos funciona. Si ninguno sirve, queda la carga del
> extracto.

### Lo que tenés que hacer vos

1. Decirnos **cuál de las dos "DNX Estudio" es la real** (y si conviene unificar).
2. En esa organización: **encender Caja y Pedidos**, y **conectar tu Mercado Pago**.
3. Hacer la **prueba de transferencias** de $10 cuando te avisemos.
4. Pasar: los **Excel de 3 años**, la **lista de débitos automáticos** (o los resúmenes de banco, tarjeta y MP),
   tu **alias y CBU**, tu situación fiscal (**categoría de monotributo** y **régimen de Ingresos Brutos** de Santa Fe)
   y los datos de tu equipo (sueldos o jornales, cargas, horarios).
5. Confirmar las decisiones de la sección 14.

---

## Parte 2 · Detalle técnico

### 1. Lo que ya existe (verificado en el código)

| Pieza | Dónde | Qué hace hoy |
|---|---|---|
| Motor ¿Cuánto Cobro? | `packages/cuanto-cobro-core` | Valor hora = necesidad mensual ÷ horas mensuales (`hourly-rates.ts`). Conceptos `own-service` / `physical-product` / `outsourced` / `expense` con margen por concepto (`quote-item-calculations.ts`). Precio mínimo sostenible → × factor de posicionamiento → precio recomendado (`commercial-positioning.ts`). Precio manual `chosenPrice`. Opciones de pago (contado con descuento, cuotas con interés manual o sugerido por índice) en `payment/`. **No** tiene impuestos, comisión, seña, recargos, viáticos por km ni feriados. `hourly-rates.ts` dice textualmente: "Impuestos fijos: campo futuro". El cliente del presupuesto ya trae `jobDate`, `jobLocation`, `jobLatitude`, `jobLongitude`. |
| Consumidores del motor | `apps/fotoffice/lib/presupuestos/calculo-cuanto-cobro.ts`, `apps/fotoffice/lib/dnx-bot/motor-trabajo.ts`, `apps/compramelafoto/lib/cuantocobro/*` (con pruebas de caracterización), `apps/dnx-sales-assistant/src/pricing/*` (prueba de compatibilidad de contrato) | Cualquier cambio del motor tiene que dar **exactamente el mismo resultado** cuando los campos nuevos están vacíos. |
| Índice para cuotas | `apps/compramelafoto/lib/cuantocobro/economic-data/providers/argentina-provider.ts` (IPC de datos.gob.ar e INDEC; BCRA v4 tasa de política y BADLAR) | FOTOFFICE **no** consulta la red: `lib/pedidos/opciones-pago.ts` usa la tasa congelada en `appliedIndexMetadata`. |
| Perfil de precios | `FotofficePerfilPrecios.profileData` (JSON `CuantoCobroProfileInput`), `lib/precios/*` | Se lee y guarda con `configurar`. **Campos nuevos del perfil no necesitan SQL.** |
| Presupuesto | `FotofficePresupuesto`, `FotofficePresupuestoVersion` (`items`, `totals`, `paymentOptions` JSON congelado, `chosenPaymentOptionId`, `costSnapshot` interno), `FotofficePresupuestoAjustes` | Aceptar (`lib/presupuestos/aceptacion.ts`) guarda la opción elegida y deja `pedidoPorConfirmar = true`. **No cobra.** IVA fijo en 0 (`totales.ts`). |
| Pedido | `FotofficePedido` (+ `FotofficePedidoCuota`, `FotofficeCobro`, `FotofficeCobroImputacion`, `FotofficeCuentaPagar`, `FotofficePedidoTarea`, proyectos, citas, contratos) | `lib/pedidos/confirmar.ts` lo crea a mano desde el presupuesto aceptado con plan de cuotas, cuentas a pagar desde costos-plantilla, checklist, proyectos y citas. `eventDate`, `incomeCategoryId` (rubro), `totalArs`. Enlace público `/w/[slug]/pedido/[token]` con pago de cuotas por Mercado Pago (`lib/pedidos/mp.ts`, `app/api/payments/mp/pedidos-webhook`). |
| Cobros → Caja | `lib/pedidos/cobros.ts` (`aplicarCobro`, `registrarCobroDelSistema`) → `lib/cash/record-movement.ts` | INGRESO idempotente por `(sourceModule, sourceRef)`, recibo X, imputación por cuota. Exige Caja encendida (`MENSAJES_COBRO.sinCaja`). **La comisión de MP se guarda en `FotofficeCobro.feeArs`/`netArs` pero NO genera un EGRESO en Caja**: el INGRESO es por el bruto. |
| Recordatorios | `lib/pedidos/recordatorios.ts`, `FotofficeCuotaRecordatorio`, cron `pedidos-recordatorios` | Aviso por correo N días antes del vencimiento de cada cuota con saldo. |
| Caja | `CashAccount` (EFECTIVO/DIGITAL), `CashCategory` (INGRESO/EGRESO), `CashMovement` (sin columna de clase fijo/variable ni de línea de negocio), `CashShift`, `CashTransfer` | Semilla: cuentas "Caja diaria", "Caja fuerte", "Mercado Pago". `sourceModule` es texto libre (no hay CHECK). |
| Rubros | `FotofficeRubro` (código y padre de una `CashCategory`), `lib/informes/bloques.ts` | Código `3…` = Ingresos, `4…` = Costos, `5…` = Gastos. Resultados por rubro y mes, control de monotributo (`lib/informes/monotributo.ts`), tablero. **Esto ya sirve como clasificación fijo/trabajo y como línea de negocio.** |
| Mercado Pago por organización | `lib/payments/connect/collector.ts` → `@repo/payments/mercado-pago-connect` (`DnxFinancialIdentity` con `organizationRef = "fotoffice-workspace:<id>"`, `DnxPaymentAccount`, credencial cifrada en la bóveda, refresco de token) | Cobro "dos vías": el dinero va directo a la cuenta de la organización. El adaptador ya sabe `GET /v1/payments/{id}` y `GET /v1/payments/search` por `external_reference` (`packages/payments/src/providers/mercado-pago/checkout-pro/preference-adapter.ts`). |
| Webhooks MP | `app/api/payments/mp/{pedidos,tienda,galerias,cursos,reservas}-webhook` | Responden siempre 200, no confían en el cuerpo, releen el pago con el token de la organización (`?ws=`), filtran por prefijo de `external_reference`. |
| Lectura de planillas | `papaparse` en `apps/fotoffice/package.json` | No hay librería de Excel (.xlsx). |
| Geocodificación | `lib/geocode/*` (Nominatim, con límite de uso) | Sirve para las coordenadas del estudio y del evento. |

**Conclusión:** la entidad "trabajo/evento" es el **Pedido** (sección 5). No hace falta una entidad nueva.

### 2. Principios

1. **Aditivo.** Ninguna columna obligatoria nueva en tablas que existen. Lo nuevo va en JSON validado por código,
   en tablas nuevas o en relaciones inversas (como ya hace el esquema: "esta tabla no cambia").
2. **El motor sigue puro** (`architecture.purity.test.ts`): no lee la red, ni la base, ni el reloj. Feriados,
   distancia e índice de inflación entran como datos desde el adaptador de FOTOFFICE.
3. **Sin regresiones en otras apps:** con los campos nuevos vacíos, el resultado del motor es idéntico
   (pruebas de caracterización de core y de CLF, y contrato del asistente de ventas). CLF no cambia su pantalla.
4. **Plata en centavos enteros**, fechas por día de Argentina (`America/Argentina/Buenos_Aires`), nunca UTC al mostrar.
5. **Un libro que no se reescribe:** lo automático se anula con contramovimiento, como hoy.
6. **Sin datos personales en los registros** (nombres y documentos de quien paga sólo en la base, el documento con hash).

### 3. Etapa A · El precio completo en el motor y en DNX Bot

#### 3.1 Dónde vive cada dato

| Dato | Perfil (una vez) | Por trabajo | Condiciones del presupuesto | Afecta |
|---|---|---|---|---|
| Monotributo (cuota mensual) | `taxes.monotributoMonthly` | — | — | **Costo fijo**: suma a la necesidad mensual → valor hora |
| Condición frente al IVA | `taxes.ivaCondition`: `monotributo` \| `responsable_inscripto` \| `exento` | — | Se congela en la versión | Precio (sólo RI) |
| IVA % | `taxes.ivaPercent` (21 por omisión, sólo RI) | — | Congelado | Precio (se muestra aparte) |
| Ingresos Brutos % | `taxes.grossIncomePercent` | — | Congelado | Precio (*gross-up*) |
| Comisión del medio de pago % | `payments.commissionPercent` y `payments.commissionIncluded` (bool) | Puede apagarse para un trabajo | Congelada por opción de pago | Precio (*gross-up*) |
| Seña % | `payments.depositPercent` (p. ej. 30) | Se puede cambiar | `deposit` en `paymentOptions` | Plan de pagos (no cambia el total) |
| Recargo hora extra % | `surcharges.overtimePercent` | — | Precio de la hora extra congelado | Informativo (no suma al total) |
| Viáticos | `travel.mode`: `none` \| `per_km` \| `zones`; `travel.perKm`; `travel.zones[] {name, upToKm, amount}`; `travel.originLat/Lng`; `travel.freeKm` | Distancia en km (calculada o a mano) o zona elegida | — | **Costo directo** (concepto `expense`, sin margen) |
| Entrega exprés % | `surcharges.expressPercent`, `delivery.standardDays` | `job.express` (bool) | Plazo de entrega en condiciones | Precio (recargo) |
| Fin de semana / feriado % | `surcharges.saturdayPercent`, `sundayPercent`, `holidayPercent` | Sale de la fecha del evento | — | Precio (recargo, se toma el **mayor**, no se suman) |
| Seguro de equipo | `insurance.equipmentAnnual` (prorrateado ÷ 12) | `job.eventInsurance` (seguro por evento que pide un salón) | — | Anual: **costo fijo**; por evento: **costo directo** |
| Retoque por foto | `retouch.minutesPerPhoto` | Concepto "Retoque" con cantidad de fotos | — | **Costo** (horas × valor hora) + margen del servicio |
| Ajuste por inflación | `inflation.enabled`, `inflation.source` (`ipc` \| `manual`), `inflation.manualMonthlyPercent` | Se aplica si el evento está a ≥ 1 mes | Tasa y método congelados (`rateMetadata`) | Precio (sobre lo que se cobra después) |
| Precio mínimo por trabajo | `floor.minimumJobPrice` | — | — | **Aviso**, no sube el precio solo |
| Política de cancelación | Plantilla en `FotofficePresupuestoAjustes` (texto con variables `{seña}`, `{diasAviso}`) | — | Se compone dentro de `terms` al enviar | Texto |

Todos los campos del perfil son **opcionales** y viven en `CuantoCobroProfileInput` como bloques nuevos
(`taxes`, `payments`, `surcharges`, `travel`, `delivery`, `insurance`, `retouch`, `inflation`, `floor`). Los del trabajo
van en un bloque nuevo opcional `jobAdjustments` de `CuantoCobroQuoteInput`. En FOTOFFICE se guardan en el JSON
`FotofficePerfilPrecios.profileData` (sin SQL). CLF guarda el mismo JSON en `CuantoCobroFinancialProfile` y lo
ignora: su asistente no los muestra en esta etapa.

#### 3.2 Orden de las operaciones (explícito)

Notación: `t` = Ingresos Brutos, `c` = comisión, `v` = IVA, todos en proporción (0,035 = 3,5 %).

1. **Costo de cada concepto** (como hoy) + lo nuevo que es costo: viáticos (concepto `expense`), seguro por evento
   (`expense`), retoque (horas = fotos × minutos ÷ 60, a valor hora). El desgaste de cámara por trabajo de la PR 598
   ya entra aquí como costo directo. El monotributo y el seguro anual **no** están acá: están dentro del valor hora.
2. **Margen por concepto** (como hoy) → **precio mínimo sostenible**.
3. **× factor de posicionamiento** → precio recomendado (como hoy). Si hay `chosenPrice`, lo reemplaza (como hoy).
4. **Recargos comerciales:** `P1 = P × (1 + max(sábado, domingo, feriado) + exprés)`. La base de los recargos es
   **sólo la parte de servicios propios** del precio (se reparte el precio entre conceptos en proporción a su precio
   mínimo); un fotolibro o un gasto no lleva recargo de domingo.
5. **Ajuste por inflación** (si está encendido y el evento está a ≥ 1 mes): cada parte del plan que se cobra en el mes
   `m` (contado desde hoy) se multiplica por `(1 + i)^m`. La seña (mes 0) no se ajusta. `i` = tasa mensual sugerida
   (IPC promedio de 3 meses) o la manual. El resultado es el **neto deseado** `N`.
6. **Gross-up de impuestos y comisión** (porque se cobran sobre el bruto, se divide, no se multiplica):
   - Monotributo o exento: `S = N ÷ (1 − t − c)`; el cliente paga `S`.
   - Responsable inscripto: `S = N ÷ (1 − t − c·(1 + v))`; el cliente paga `S × (1 + v)` y el IVA se muestra aparte.
   - Con `commissionIncluded = false`, `c = 0` y la comisión queda como costo informado.
7. **Redondeo** (a $100 por omisión, configurable) del total.
8. **Seña** = redondeo(total × `depositPercent`). Saldo = total − seña.
9. **Opciones de pago** (código actual de `opciones-pago.ts`) sobre el total: el descuento de contado lo baja y las
   cuotas con interés lo suben. Sugerencia que muestra la pantalla: un descuento por transferencia igual a `c`, para
   devolver la comisión a quien no usa Mercado Pago.
10. **Precio de la hora extra** = valor hora × (1 + margen del servicio de cobertura) × factor de posicionamiento ×
    (1 + `overtimePercent`), con el mismo *gross-up* del paso 6. Se informa en las condiciones, no suma.
11. **Piso:** si `S` (sin IVA) < `minimumJobPrice`, aviso "Este trabajo queda por debajo de tu mínimo" con un botón
    "Llevar al mínimo" que fija `chosenPrice`.

El motor devuelve un desglose nuevo `priceBuildUp` (opcional en el resultado): `baseCost`, `margin`, `positioning`,
`surcharges[]`, `inflation`, `netDesired`, `grossIncomeTax`, `commission`, `iva`, `total`, `deposit`, `balance`,
`overtimeHourPrice`, `floorWarning`, y "lo que te queda" (`total − IIBB − comisión − IVA`). Con los bloques nuevos
vacíos, `priceBuildUp.total` es igual al precio actual y ningún campo existente cambia.

**Ingresos Brutos en Santa Fe:** si Daniel está en el régimen simplificado (que en Santa Fe se paga junto con el
monotributo), IIBB es un monto fijo que ya está dentro de la cuota: `t = 0`. Hay que confirmarlo (sección 14).

#### 3.3 Feriados de Argentina

- **Decisión:** tabla curada en código, `packages/cuanto-cobro-core/src/calendar/ar-holidays.ts`, un arreglo por año
  (inamovibles, trasladables ya trasladados según el decreto anual, y días no laborables con fines turísticos marcados
  aparte). Función pura `dayTypeFor(dateYmd, holidays)` → `weekday` \| `saturday` \| `sunday` \| `holiday`.
- Más una lista propia por organización (fechas extra, p. ej. feriado local de Rosario) en el perfil.
- Una prueba falla a partir del 1/12 si falta la tabla del año siguiente: obliga a cargarla.
- Descartados: API pública no oficial (disponibilidad sin garantía, rompe la pureza) y el calendario de feriados de
  Google (exige tener Google conectado).

#### 3.4 Inflación

El índice hoy vive en CLF. **Decisión:** pasar al core sólo la matemática pura (ya es pura: `inflation-math`), y que
FOTOFFICE tenga su propio lector del IPC de datos.gob.ar (mismo id de serie `101.1_I2NG_2016_M_22`) con caché diaria,
que congela la tasa en `rateMetadata` del presupuesto como ya hacen las cuotas. CLF no se toca en esta etapa. Antes
de escribir el caché, leer la guía de caché de `node_modules/next/dist/docs/` (Next 16 cambió APIs).

#### 3.5 Viáticos

- Origen: dirección del estudio (geocodificada con `lib/geocode`, guardada en el perfil).
- Distancia: línea recta × 1,3 (factor de ruta) por omisión, **editable**; no se agrega un servicio de rutas pago.
- Ida y vuelta: `km × 2 − freeKm`, × `perKm`. Con zonas: la primera zona cuyo `upToKm` cubra la distancia.
- Entra como concepto `expense` "Viáticos" (sin margen, sin recargos).

#### 3.6 DNX Bot

- `lib/dnx-bot/guia/perfil.ts`: un bloque "Impuestos, cobros y recargos" (una pregunta por tema, con valores sugeridos
  y "no sé" → queda vacío). Tool `herramientas/perfil.ts`: guarda los bloques nuevos con la validación de `lib/precios`.
- `lib/dnx-bot/guia/cotizar.ts` (ya tocado por la PR 599): pide fecha y lugar del evento al principio. Con la fecha
  dice "Es domingo / feriado: sumo X %". Con el lugar calcula km o zona y lo confirma. Pregunta "¿entrega exprés?" y
  "¿lleva retoque? ¿cuántas fotos?" sólo si el perfil tiene esos recargos o minutos cargados. Al final muestra el
  desglose, la seña y la hora extra. `cotizar_trabajo` recibe `jobAdjustments`.
- Evals nuevas: domingo con viaje a 40 km; RI con IVA; precio bajo el mínimo; evento a 6 meses con inflación.

### 4. Etapa B · El presupuesto muestra el total, la seña y el plan; la seña se paga al aceptar

#### 4.1 Seña dentro de las opciones de pago

- `CuantoCobroPaymentOptionsInput` suma `deposit?: { percent: string }` y el *snapshot* suma
  `deposit: { percent, amount } | null` (versión de *snapshot* 2; la 1 se sigue leyendo).
- `planDesdeOpcion` (`lib/pedidos/plan-cuotas.ts`): con seña, la **cuota 1 es la seña**, vence el día de la
  aceptación; el saldo se reparte en las cuotas de la opción, con la última **N días antes del evento**
  (`FotofficePresupuestoAjustes`, ver 4.4). Sin seña, igual que hoy.
- Todo vive en el JSON `paymentOptions` de la versión: **sin SQL**.

#### 4.2 Página pública del presupuesto (`/w/[slug]/presupuesto/[token]`)

Muestra: total (con IVA aparte si es RI), seña y saldo, el plan de cada opción con fechas, la hora extra y la
política de cancelación. Medios aceptados: Mercado Pago (si la organización lo tiene conectado) y transferencia (si
cargó sus datos).

#### 4.3 Aceptar → pedido → pagar la seña

1. `aceptarPresupuesto` (sin cambios en su transacción).
2. Nuevo, **fuera** de la transacción (como los avisos de hoy): si `autoConfirmarPedido` está encendido, se llama a
   la confirmación del pedido **como sistema** (refactor de `lib/pedidos/confirmar.ts`: separar la parte que exige
   `CtxPedidos` de la que escribe; el sistema usa la checklist por omisión y crea proyectos y citas según sus reglas).
   Si falla, queda como hoy (`pedidoPorConfirmar`) y se crea la tarea para el responsable.
3. La página responde con el enlace del pedido (`enlaceDelPedidoDelSistema`) y el cliente llega a
   `/w/[slug]/pedido/[token]?pagar=<cuota de seña>`, que ya resalta la cuota y tiene "Pagar con Mercado Pago"
   (`iniciarPagoCuota`, sin cambios).
4. Botón nuevo "Pagar por transferencia": muestra alias, CBU/CVU, titular y el **monto exacto** (el único, si está
   encendido), y registra una **espera de pago** (sección 9). No marca nada como pago.

Con `autoConfirmarPedido` apagado, el comportamiento actual no cambia.

#### 4.4 Datos nuevos (SQL)

- `FotofficePresupuestoAjustes`: `autoConfirmarPedido Boolean @default(false)`, `cancellationPolicy String?`,
  `lastInstallmentDaysBeforeEvent Int @default(7)`.
- Tabla nueva `FotofficeDatosTransferencia` (una por organización): `alias`, `cbuCvu`, `titular`, `cuit`, `banco`,
  `updatedAt`, `updatedByUserId`. Sólo `configurar` la edita; se muestra en páginas públicas de cobro.

### 5. Etapa C · El trabajo es el Pedido

**Por qué el Pedido y no una entidad nueva:** ya tiene fecha del evento, total de la opción elegida, plan de cuotas,
saldo calculado (`estado.ts`), cobros por Mercado Pago y a mano con recibo, imputación por cuota, recordatorios,
cuentas a pagar a proveedores, checklist, proyectos, citas y contratos, todo atado al presupuesto aceptado. Una
entidad paralela duplicaría el dinero y partiría la Caja en dos. Lo que se nombra en pantalla como "Trabajo" o
"Evento" se resuelve con el vocabulario configurable (Configuración → Palabras), sin renombrar el modelo.

Lo que se agrega:

1. **Comisión real de Mercado Pago en Caja.** En `aplicarCobro`, cuando `proveedor.feeArs > 0`, en la **misma
   transacción** se registra un EGRESO en la misma cuenta (`sourceModule = "pedidos-comision"`, `sourceRef = cobroId`,
   rubro configurable, por omisión "4.9 Comisiones y gastos de cobro", medio `MERCADO_PAGO`). Al anular el cobro, se
   anula también ese EGRESO. Se suma `"pedidos-comision"` a `MOVEMENT_SOURCES` (texto, sin CHECK en la base). Mismo
   patrón después para galerías, tienda y cursos. Sólo para cobros nuevos; los viejos se pueden regularizar con un
   script de solo lectura que liste las diferencias (no se escriben asientos retroactivos sin que Daniel lo apruebe).
2. **Seña pendiente:** si la cuota 1 sigue impaga a las 48 h, tarea al responsable y un recordatorio al cliente con la
   plantilla existente. La fecha queda "tentativa" en Agenda hasta que se pague la seña (marca visual, no bloqueo).
3. **Caja obligatoria para cobrar:** hoy un cobro sin Caja falla con `sinCaja`. El asistente de encendido de Pedidos
   avisa si Caja está apagada (es el caso de una de las dos DNX Estudio).

### 6. Etapa D · Costos del trabajo y resultado real

1. **"Gasto del trabajo"** en la ficha del pedido: un formulario que crea una `FotofficeCuentaPagar` con `pedidoId` y
   la paga en el mismo paso (reusa `lib/pedidos/cuentas-pagar.ts`; EGRESO `pedidos-pagos`). Tipos rápidos con su rubro
   4.x: Proveedor, Asistente, Viáticos, Otro. Si el asistente es del equipo (etapa E), se cargan **horas** en vez de
   plata.
2. **"Presupuestado vs real"** (módulo puro + página, visible con `veCostosDePedido`):

| Fila | Presupuestado | Real |
|---|---|---|
| Ingresos | `totalArs` del pedido | Cobros sin anular |
| Comisiones de cobro | Comisión del `priceBuildUp` congelado | EGRESOS `pedidos-comision` |
| Impuestos (IIBB) | Del `priceBuildUp` | Estimado con la misma tasa sobre lo cobrado |
| Costos directos | `costSnapshot` de la versión aceptada (por origen) | Cuentas a pagar del pedido (pagadas y pendientes) |
| Horas propias y del equipo | Horas de la instantánea del cálculo × valor hora | Horas cargadas (etapa E) × costo hora de cada persona |
| **Resultado** | Margen presupuestado | Real, con semáforo y diferencia |

La versión aceptada ya guarda `costSnapshot` e `items[].calculo` (horas, costo base, margen): **no hace falta SQL**.

### 7. Etapa E · Economía del estudio

#### 7.1 Tres cajones

- **Gastos fijos del estudio** = rubros de egreso con código `5…` (Gastos). Plan de rubros sugerido al encender:
  5.1 Alquiler, 5.2 Servicios, 5.3 Software, 5.4 Contador, 5.5 Publicidad, 5.6 Insumos, 5.7 Mantenimiento,
  5.8 Sueldos, 5.9 Cargas sociales, 5.10 Impuestos fijos (monotributo).
- **Costos de trabajos** = código `4…` (Costos), idealmente atados a un pedido.
- **Retiro del dueño** = código nuevo `6…` (Retiros). Cambio en `lib/informes/bloques.ts`: bloque `RETIROS`, que en
  Resultados va **debajo** del resultado ("Resultado del estudio" − "Retiros" = "Lo que queda en el negocio"). No es
  un gasto del negocio.
- **Líneas de negocio** = rubros de ingreso hijos de `3`: 3.1 Eventos, 3.2 Sesiones en estudio, 3.3 Productos e
  impresiones, 3.4 Cursos… (configurables). El pedido ya tiene `incomeCategoryId`; los costos de un pedido heredan su
  línea para calcular la contribución.

**Decisión:** no se agregan columnas a `CashMovement` ni a `CashCategory`: la clasificación sale del código del rubro,
que ya existe y ya usan los informes. Un movimiento sin rubro o con rubro sin código cae en "Sin clasificar" y el
tablero lo marca.

#### 7.2 Equipo y valor hora del estudio

Tabla nueva `FotofficeEstudioPersona`: `nombre`, `userId?` (si usa FOTOFFICE), `clientId?` (si es un contacto),
`tipo` (`SUELDO` \| `JORNAL` \| `DUENO`), `sueldoMensualArs?`, `jornalArs?`, `cargasPct`, `diasPorSemana`,
`horasPorDia`, `facturablePct`, `activo`, `desde`, `hasta?`.

- Horas facturables al mes = días × horas × 4,33 × facturable %.
- Costo hora de una persona = (sueldo × (1 + cargas)) ÷ horas pagadas al mes; jornal ÷ horas por día.
- **Valor hora del estudio** = (gastos fijos del mes + retiro del dueño + ganancia deseada + reservas de equipo)
  ÷ horas facturables de **todas** las personas (dueño incluido). Los sueldos ya están en los fijos; los jornaleros
  **no** (son costo de cada trabajo, concepto `outsourced`).
- En el motor: bloque opcional `studio` del perfil (`fixedMonthly`, `ownerDraw`, `desiredProfit`, `people[]` ya
  reducidas a horas facturables). Si `studio.enabled`, `getProfileCostHour` usa esta fórmula; si no, la de hoy.
  FOTOFFICE arma el bloque desde la tabla; el motor no lee la base.

Tabla nueva `FotofficePedidoHora`: `pedidoId`, `personaId`, `fecha`, `horas` (decimal), `tipo` (cobertura, edición,
viaje, otro), `nota`. Alimenta "Presupuestado vs real" y el uso del equipo.

#### 7.3 Fijos declarados vs reales

Promedio de los EGRESOS `5…` de los **últimos 3 meses cerrados** (Caja + histórico) contra los fijos declarados en el
perfil. Si difieren más de 15 %: aviso en Precios y en el tablero, con botón "Usar el real".

#### 7.4 Tablero mensual del estudio

- **Punto de equilibrio** = fijos (real o declarado, el mayor) + retiro.
- **Facturado en el mes** = INGRESOS de Caja del mes (criterio de caja) y, aparte, **vendido** = pedidos confirmados
  en el mes.
- **Contribución por línea** = ingresos de la línea − costos `4…` de sus pedidos − comisiones.
- **Horas del equipo** usadas (`FotofficePedidoHora`) vs disponibles.
- Permiso: `configurar` (dueño y administradores). El retiro sólo lo ve quien tiene `configurar`.

#### 7.5 Saldo de apertura y gastos recurrentes

- **Saldo de apertura** por cuenta al día de arranque: movimiento con `sourceModule = "apertura"` que los informes
  excluyen (como hoy excluyen los pases con `transferId`). Uno por cuenta (índice único parcial en SQL).
- Tabla nueva `FotofficeGastoRecurrente`: concepto, rubro, importe estimado, día del mes, medio (débito en tarjeta, en
  banco, en Mercado Pago), desde/hasta. Sirve para declarar fijos, para "esperar" el gasto cada mes y para detectar
  faltantes.

#### 7.6 Importación histórica (3 años de Excel)

- Tablas nuevas: `FotofficeHistoricoLote` (mes, archivo, estado `BORRADOR` \| `CONFIRMADO` \| `DESCARTADO`, totales,
  quién confirmó) y `FotofficeHistoricoMovimiento` (fecha, tipo, importe, descripción, rubro, cuenta de origen como
  texto, origen `EXCEL` \| `EXTRACTO` \| `ESTIMADO`). **No son `CashMovement`:** no tocan el saldo, los turnos ni los
  arqueos. Resultados, promedio de fijos y tablero los suman cuando corresponde, marcados como "histórico".
- `FotofficeHistoricoMapeo`: texto de origen normalizado → rubro, aprendido de cada confirmación.
- Formato v1: **CSV** (en Excel: "Guardar como CSV"), leído con `papaparse`, que ya está. **No** se suma una librería
  de .xlsx en esta etapa (el lockfile es de todas las apps). Si los archivos tienen varias hojas o formatos raros,
  se evalúa aparte.
- Flujo: subir → elegir columnas (fecha, concepto, importe o ingreso/egreso) → vista previa del mes con totales por
  rubro, filas sin rubro y posibles duplicados → confirmar mes por mes.
- **Faltantes:** se marca como "recurrente" todo egreso con el mismo rubro y concepto parecido en ≥ 3 de los últimos 6
  meses, más los `FotofficeGastoRecurrente`. El resumen de cada mes lista "No encontramos: Adobe, seguro, …" con
  "Agregar estimado" o "No corresponde".
- Débitos que no están en el Excel: se cargan desde extractos (mismo lector de la Conciliación, sección 9.5) o como
  lista estimada.

### 8. Permisos

| Acción | Permiso |
|---|---|
| Perfil de precios, impuestos, recargos, equipo, valor hora | `configurar` (como hoy en Precios) |
| Ver costos, "Presupuestado vs real" | `veCostosDePedido` (`configurar` o `verDinero`) |
| Cargar gastos y horas de un trabajo | `operar` en Pedidos |
| Confirmar "Posibles pagos" | operador de Caja (`requireCashOperator`) |
| Configurar conciliación, datos de transferencia | `configurar` |
| Tablero del estudio, retiros, importación histórica | `configurar` |

### 9. Conciliación de transferencias

#### 9.1 Qué confirmó Mercado Pago (documentación consultada el 15/10/2026 con su buscador oficial)

| Tema | Estado | Detalle |
|---|---|---|
| Buscar pagos de una cuenta | **Confirmado** | `GET /v1/payments/search` con el token del vendedor; filtros `status`, `payment_type_id`, `operation_type`, `external_reference`; rango de fechas con `range` (`date_created` o `date_last_updated`) y `begin_date`/`end_date` (acepta `NOW-2HOURS`); paginado `limit` ≤ 50, `offset` ≤ 10.000. |
| Webhook de pagos | **Confirmado** | Tópico `payment`: "creación y actualización de pagos". El cuerpo trae sólo un id. |
| Reporte de movimientos con datos de quien paga | **Confirmado** | Los reportes de la cuenta (Liquidaciones / dinero en cuenta) tienen `PAYER_NAME`, `PAYER_ID_TYPE`, `PAYER_ID_NUMBER`, que "estará disponible cuando se reciban pagos con código QR, **transferencias**…", sólo para conciliar; `PAYMENT_METHOD_TYPE` incluye `bank_transfer`; `TRANSACTION_TYPE` (`SETTLEMENT`, `REFUND`…). |
| Generación de reportes por API | **Confirmado** | Asíncrona; CSV o XLSX; hasta 1 año por pedido; programable diaria, semanal o mensual; aviso por webhook cuando está listo. Las cuentas de prueba generan reportes **vacíos**. |
| Que una transferencia entrante al CVU/alias aparezca como `payment` en `/v1/payments/search` | **Supuesto (no documentado)** | Se cree que aparece con un `operation_type` de transferencia y `payment_type_id = bank_transfer`, pero no lo encontré escrito. |
| Que el webhook `payment` avise transferencias entrantes a una cuenta conectada por OAuth | **Supuesto** | Hoy FOTOFFICE recibe avisos por el `notification_url` de cada preferencia; una transferencia no tiene preferencia. |
| Que el token OAuth de la organización pueda pedir reportes de su cuenta | **Supuesto** | Los ejemplos usan el token del propio vendedor. |
| Permisos OAuth | **Parcial** | Los permisos (`read`, `write`, `offline_access`) se configuran en la aplicación de Mercado Pago; leer pagos necesita `read`. Hay que revisar qué tiene la aplicación de FOTOFFICE (`FOTOFFICE_MP_CLIENT_ID`). |

#### 9.2 Paso 0 obligatorio: prueba real (antes de programar el lector)

Con la cuenta de Daniel conectada: transferir $10 desde un banco (CBU) y $10 desde otra cuenta de Mercado Pago al
alias del estudio. Un script de **solo lectura** (con el token de la organización, sin imprimir datos personales,
sólo nombres de campos y tipos) consulta `/v1/payments/search` por la última hora y pide un reporte de dinero en
cuenta del día. Resultado → elegir:

- **Plan A:** las transferencias aparecen en `payments/search` → lector cada 15 min.
- **Plan B:** sólo en el reporte → reporte diario programado por API (demora de hasta un día).
- **Plan C:** ninguno → subir el extracto de "Actividad" de Mercado Pago (CSV) a mano.

#### 9.3 Lectura (Plan A)

- Cron nuevo `app/api/cron/conciliar-transferencias` cada 15 min, sólo para organizaciones con la conciliación
  encendida y Mercado Pago conectado. Ventana: últimas 48 h por `date_last_updated`; idempotente por id de pago.
- **El cron es la fuente de verdad; el webhook sólo acelera** (si el tópico `payment` llega para transferencias, dispara
  la lectura de esa organización; nunca se confía en el cuerpo, como hoy).
- Se ignoran los pagos que ya son de FOTOFFICE (con `external_reference` de un prefijo propio: `fo-pedcuota:`, tienda,
  etc.), que ya acredita su webhook.
- Cuidar el límite de pedidos a Mercado Pago y el refresco de token (`resolveWorkspaceCollector` ya lo hace).

#### 9.4 Modelo

- `FotofficeEsperaPago`: `origen` (`PEDIDO_CUOTA` primero; después `TIENDA`, `GALERIA`, `CURSO`, `RESERVA`),
  `origenRef`, `clientId?`, `importeEsperadoArs`, `importeUnicoArs?`, `creadaEn`, `venceEn`, `estado`
  (`ESPERANDO` \| `CONCILIADA` \| `ANULADA` \| `VENCIDA`).
- `FotofficeIngresoDetectado`: `fuente` (`MP_API` \| `MP_REPORTE` \| `EXTRACTO_MP` \| `EXTRACTO_BANCO`), `externalId`
  (único por organización y fuente), `fecha`, `importeArs`, `nombrePagador?`, `docPagadorHash?` y sus 3 últimos
  dígitos, `estado` (`NUEVO` \| `APLICADO` \| `POSIBLE` \| `IGNORADO` \| `AJENO`).
- `FotofficeConciliacion`: `ingresoId` (único), `esperaId`, `modo` (`AUTO` \| `MANUAL`), quién y cuándo, y el
  cobro o asiento que generó.
- `FotofficeConciliacionAjustes`: encendida, `autoAplicar`, `montoUnico`, `ventanaDias` (7), `ultimaLectura`.
- `FotofficeExtractoFormato`: mapeo de columnas guardado por banco.

#### 9.5 Emparejamiento (módulo puro)

- Candidatos: importe **exacto** (el único si existe), fecha del ingreso entre `creadaEn − 1 h` y `venceEn`.
- Puntaje extra: documento igual (hash del `docNumber` del contacto normalizado) o al menos un apellido en común
  (normalizado sin tildes).
- **Se aplica solo** si: el ingreso tiene un único candidato, la espera tiene un único ingreso candidato, y (monto único
  **o** coincide nombre/documento). Si no, queda en "Posibles pagos" con los candidatos ordenados.
- Aplicar = el registro del módulo de origen (para pedidos, `registrarCobroDelSistema` con medio `TRANSFERENCIA` y
  `providerPaymentRef` = id de Mercado Pago, que es único y evita el doble registro si alguien lo carga a mano) →
  INGRESO en Caja → espera `CONCILIADA`. Todo en una transacción.
- Extractos de banco: mismo emparejador con `fuente = EXTRACTO_BANCO`. "Marcar a mano" = cobro manual de hoy + cierre
  de la espera.

#### 9.6 Monto único

Al crear la espera se busca el menor `k` entre 1 y 99 pesos tal que ningún otro pendiente de la organización tenga
`esperado + k`. El cliente ve ese monto exacto. Los `k` pesos de más se registran como INGRESO aparte en el rubro
"Diferencias de conciliación" (la cuota recibe su importe exacto, porque el cobro rechaza pagos de más).

### 10. Cambios de datos (todos aditivos)

| Etapa | Cambio | SQL |
|---|---|---|
| A | Bloques nuevos en el JSON del perfil y del presupuesto; tabla de feriados en código | No |
| B | `FotofficePresupuestoAjustes` + 3 columnas con valor por omisión; tabla `FotofficeDatosTransferencia` | Sí |
| C | `sourceModule = "pedidos-comision"` | No |
| D | Nada (usa `FotofficeCuentaPagar`, `costSnapshot`, `items[].calculo`) | No |
| E | `FotofficeEstudioPersona`, `FotofficePedidoHora`, `FotofficeGastoRecurrente`, `FotofficeHistoricoLote`, `FotofficeHistoricoMovimiento`, `FotofficeHistoricoMapeo`; índice único parcial para "apertura" en `CashMovement` | Sí |
| Conciliación | `FotofficeEsperaPago`, `FotofficeIngresoDetectado`, `FotofficeConciliacion`, `FotofficeConciliacionAjustes`, `FotofficeExtractoFormato` | Sí |

En las tablas existentes (`Workspace`, `Client`, `CashCategory`, `CashMovement`, `FotofficePedido`) sólo se agregan
**relaciones inversas** de Prisma (no son columnas).

### 11. Plan de migración

- Una migración por etapa, con nombre posterior a la última (`20261116120000_…`), p. ej.
  `20261117120000_fotoffice_presupuesto_cobro_sena`, `…_fotoffice_estudio_economia`, `…_fotoffice_conciliacion`.
  Con los `CHECK` que Prisma no expresa (importes > 0, estados, porcentajes 0–100, horas > 0).
- **FOTOFFICE no tiene staging.** Se aplica a mano en la base de producción (proyecto Neon `compramelafoto`, rama
  `development`, `br-old-rain-adwthzng`, confirmando el endpoint de Vercel antes) y se registra con
  `prisma migrate resolve --applied`. En las otras bases del esquema compartido, según la práctica vigente.
- Orden: **primero el SQL, después el código**. Las tablas nuevas no rompen el código viejo; el código nuevo con la
  tabla faltante sí rompe todo el modelo (pasó antes).
- Antes de cada SQL: probar en una rama temporal de Neon creada desde `development` y borrarla después.

### 12. Riesgos

1. **Mercado Pago puede no exponer las transferencias entrantes por API** (sección 9.1). Mitigación: prueba del paso 0
   antes de programar; Plan C (extracto) siempre disponible.
2. **Datos personales de quien transfiere:** se guardan mínimos, el documento con hash, nada en los registros; uso sólo
   para conciliar (lo exige Mercado Pago).
3. **Cambios en el motor compartido** afectan CLF y el asistente de ventas. Mitigación: campos opcionales, pruebas de
   caracterización sin cambios, CLF no muestra los campos nuevos.
4. **Conflictos con las PR 598 y 599** (tocan `types.ts`, `calculate-cuanto-cobro.ts`, `motor-trabajo.ts`,
   `guia/cotizar.ts`). Mitigación: empezar A después de fusionarlas.
5. **Doble registro** (cobro a mano + conciliación automática). Mitigación: `providerPaymentRef` único y la espera se
   cierra al cobrar a mano.
6. **Dos ventas con el mismo monto en la misma ventana:** nunca se aplica sola; monto único opcional.
7. **Gross-up mal entendido:** el desglose muestra cada paso; los porcentajes se congelan en la versión enviada.
8. **Inflación:** si el IPC no responde, se usa la última tasa guardada o la manual, y se avisa; nunca se inventa.
9. **Recargo por pagar con tarjeta o Mercado Pago:** históricamente la ley de tarjetas prohibía cobrar distinto según
   el medio; hubo cambios normativos recientes que no verifiqué. Mitigación: por omisión la comisión se suma para
   todos y la diferencia se devuelve como "descuento por transferencia"; confirmarlo con el contador.
10. **Tabla de feriados desactualizada** → la prueba anual la obliga.
11. **Histórico mal importado:** queda en tablas aparte, por lote, con "Descartar lote".
12. **Caja apagada o Mercado Pago sin conectar** en la organización real: sin eso, B, C y la Conciliación no
    funcionan.
13. **Límite de tareas programadas de Vercel** (ya hay muchas): revisar el plan antes de sumar el cron.
14. **Migraciones a mano en producción** sin staging.

### 13. Implementación por etapa (tareas aproximadas)

| Etapa | Tareas | Contenido | Depende de |
|---|---|---|---|
| **A** | ~18 | Tipos y normalización (2); cálculos puros: recargos, feriados, viáticos, gross-up, seña, hora extra, inflación, piso (6); pruebas de caracterización y contrato (1); tabla de feriados + prueba anual (1); lector de IPC en FOTOFFICE (1); secciones de Configuración → Precios (2); desglose en el panel del presupuesto (2); DNX Bot: guía, herramientas y evals (3) | PR 598 y 599 fusionadas |
| **Conciliación 0** | 1 | Prueba real con la cuenta de Daniel | MP conectado. **En paralelo con A** |
| **B** | ~10 | Seña en opciones y plan (2); página pública con total, seña y plan (2); confirmación del pedido como sistema (2); datos de transferencia: SQL, configuración y vista pública (2); "Pagar por transferencia" crea la espera (1); correos (1) | A (seña) para el cálculo; el resto puede empezar antes |
| **C** | ~5 | Comisión de MP en Caja + anulación (2); seña pendiente: tarea y recordatorio (1); fecha tentativa en Agenda (1); aviso de Caja apagada (1) | B |
| **D** | ~5 | "Gasto del trabajo" (2); "Presupuestado vs real" puro + página (3) | C |
| **E** | ~22 | Equipo: SQL, pantalla y costo hora (3); bloque `studio` del motor + adaptador (2); horas a trabajos (2); plan de rubros + bloque Retiros (2); fijos reales vs declarados (1); tablero mensual (3); saldo de apertura (1); gastos recurrentes (2); importación histórica: lote, CSV, mapeo, resumen, confirmación (5); faltantes (1) | Caja encendida. El tablero necesita D. La importación histórica puede ir en cualquier momento |
| **Conciliación** | ~16 | SQL (1); lector MP (cron + webhook acelerador) o reporte, según el paso 0 (2); emparejador puro (2); aplicador para pedidos (2); "Posibles pagos" (2); monto único (1); extractos CSV y formatos (2); tienda, cursos, galerías, reservas (4) | Paso 0 y B |

Total aproximado: **~77 tareas**. Orden sugerido: A y Conciliación 0 en paralelo → B → C → D; E y la importación
histórica en una línea aparte en cuanto Caja esté encendida.

### 14. Decisiones tomadas que Daniel tiene que confirmar

1. El "trabajo/evento" es el **Pedido** (no una entidad nueva).
2. Al aceptar, **el pedido se crea solo** (interruptor, apagado por omisión; para DNX Estudio, encendido).
3. La comisión de Mercado Pago se **suma al precio para todos** y se ofrece un descuento por transferencia del mismo
   porcentaje (en vez de dos precios distintos según el medio).
4. Los recargos de fin de semana y feriado **no se suman**: se toma el mayor. El exprés sí se suma. Ninguno se aplica a
   productos ni gastos.
5. La inflación ajusta **sólo lo que se cobra después** del mes en curso; la seña no.
6. Feriados: **tabla en el código** actualizada cada año, más fechas propias.
7. Viáticos: distancia en línea recta × 1,3, **editable**, sin servicio de rutas pago.
8. Clasificación fijo/trabajo/retiro y líneas de negocio **por código de rubro** (5 / 4 / 6 nuevo / hijos de 3), sin
   columnas nuevas en Caja.
9. El histórico va en **tablas aparte**, no en la Caja; la importación v1 es por **CSV**.
10. "Monto único": se **suman** de 1 a 99 pesos y la diferencia va a un rubro de "Diferencias de conciliación".
11. La conciliación automática sólo aplica sola cuando es **única por los dos lados** y además coincide monto único o
    nombre/documento.
12. Redondeo del total a **$100**.

### 15. Preguntas abiertas

1. ¿Cuál de las dos organizaciones "DNX Estudio" (`cmocabxjg0063xpedb91k42xt` con Pedidos sin Caja, o
   `cmv5z6qxwwmmhf0q5gp8qja1j` con Caja sin Pedidos) es la real? ¿Unificamos?
2. Situación fiscal: categoría de monotributo, ¿IIBB de Santa Fe en régimen simplificado (incluido) o porcentual?
3. ¿Qué permisos tiene hoy la aplicación de Mercado Pago de FOTOFFICE y qué webhook global tiene configurado?
4. ¿Qué cuenta de banco (no Mercado Pago) usa el estudio y en qué formato descarga el extracto?
5. ¿Cómo están los Excel (una hoja por mes, por año, columnas)?
6. ¿Cuánto es el retiro mensual y la ganancia deseada del estudio?
7. ¿Las horas del equipo las carga cada persona o el responsable?
8. ¿La tabla nueva se aplica también en las otras bases del esquema compartido o sólo en la de FOTOFFICE?
