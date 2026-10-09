# Etapa 6 · Informes

> 09/10/2026 · Reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §4; informes de Alboom en
> `docs/alboom/04-finanzas-e-informes.md` §17). Se apoya en las Etapas 0 a 5, ya en producción.
>
> **Decisiones de Daniel (09/10):**
> - **Resultados con dos vistas:** "Lo cobrado y pagado" (por omisión, sale de Caja) y "Lo vendido y
>   comprometido" (pedidos y cuentas a pagar en su fecha).
> - **Costos y gastos se separan por el código del rubro:** 3 = ingresos, 4 = costos, 5 = gastos.
> - **IVA:** en esta etapa sólo un **control de monotributo** (cobrado en 12 meses contra el tope cargado a
>   mano). El libro IVA queda para la etapa de facturación electrónica.
> - **Acceso:** quien puede ver dinero (`puede(acceso, "verDinero")`: dueño, administradores y quien ve Caja).
> - Diseño aprobado el 09/10 ("dale, seguí con la entrega A").
>
> Lo demás va marcado **[decisión]**. **Sin staging.**

## 1. Qué problema resuelve

Alboom tiene Resultados (rubros × meses, base devengada o de efectivo), Flujo de caja proyectado, IVA por
pedido, informes de pedidos y de oportunidades ganadas. FOTOFFICE hoy tiene piezas sueltas: Caja → Reportes
(totales por rubro del período, base efectivo), Pedidos → Informes (a cobrar, cobrado del mes, a pagar) y
Consultas → Informe (embudo por etapa). No hay una mirada mensual comparativa, ni proyección, ni control de
monotributo.

**Datos que ya existen y se reutilizan** (sin tocar sus tablas):
- `CashMovement` (INGRESO/EGRESO, `amountArs` positivo, `occurredAt`, `categoryId` = rubro, `transferId`
  marca transferencias, `reversesMovementId` marca contramovimientos de anulación, `sourceModule`).
- `CashAccount` (saldo = suma de movimientos: `balancesByAccountMinor` en `lib/cash/balance.ts`).
- `CashCategory` + `FotofficeRubro` (código `3.1.2`, padre; `compararCodigos`, `groupCategoryReportRows`).
- `FotofficePedido` (`totalArs`, `status`, `eventDate`, `createdAt`, `incomeCategoryId`), sus cuotas
  `FotofficePedidoCuota` y el saldo de cada una (`planesDe` + `resumenDePlan`).
- `FotofficeCuentaPagar` (`amountArs`, `dueDate?`, `costCategoryId?`, `paidAt`; `voidedAt` = pago anulado).
- Períodos en hora de Buenos Aires (`lib/listado/periodos.ts`), CSV (`armarCsvExcel` en `lib/listado/csv.ts`).

## 2. Alcance

Módulo nuevo `reports` ("Informes"), ruta `/informes`, con pestañas. **Sin dependencia dura de otro módulo
[decisión]:** si Caja u Pedidos no están encendidos o no tienen datos, cada informe lo dice con un aviso
("Todavía no hay movimientos de Caja en este período") en vez de mostrar ceros mudos.

Todas las pantallas: guardia `verDinero`, filtro de período, totales, **descarga CSV** con el mismo recorte,
importes en pesos con formato es-AR, fechas en hora argentina.

### Entrega A · Dinero

1. **Tablero** (`/informes`):
   - por cobrar **vencido** (cuotas con saldo y vencimiento anterior a hoy) y **a vencer en 7 y 30 días**;
   - por pagar vencido y a vencer en 7 y 30 días;
   - **saldo de cada cuenta de Caja** hoy y el total;
   - **resultado del mes** (vista "cobrado y pagado") contra el mes anterior, con la diferencia;
   - **semáforo del monotributo** (si está configurado);
   - cada número enlaza al informe que lo explica.
2. **Resultados** (`/informes/resultados`):
   - matriz **rubros × meses** con total por fila y por columna;
   - bloques: **Ingresos** (código empieza con `3`), **Costos** (`4`), **Gastos** (`5`) y **Sin clasificar**
     (rubros sin código o con otro primer dígito, y movimientos sin rubro); fila final **Resultado** =
     Ingresos − Costos − Gastos − Sin clasificar de egreso; rojo si es negativo;
   - los rubros hijos se agrupan bajo su padre con subtotal (como `groupCategoryReportRows`);
   - aviso si hay importes en "Sin clasificar", con enlace a Configuración → Rubros, y sugerencia de crear un
     grupo `5` de gastos fijos (no se crea solo);
   - períodos: este mes, mes pasado, últimos 3, últimos 6, este año, año pasado, otro rango (máximo 24 meses);
   - **vista "Lo cobrado y pagado"** (por omisión): `CashMovement` por `occurredAt`, excluyendo
     transferencias; un contramovimiento de anulación (`reversesMovementId`, de tipo contrario al original)
     **resta en el bloque y el rubro del original** (no suma como egreso o ingreso nuevo), así la anulación
     lo neutraliza en el mismo mes o figura como corrección en el mes en que se anuló **[decisión]**;
   - **vista "Lo vendido y comprometido"**:
     - pedidos no cancelados por `eventDate` (o la fecha de creación en hora argentina si no tiene), en su
       `incomeCategoryId`, por `totalArs`;
     - todas las cuentas a pagar por `dueDate` (o creación), en su `costCategoryId`, por `amountArs`
       (en `FotofficeCuentaPagar`, `voidedAt` marca un **pago** anulado: la cuenta vuelve a estar pendiente
       y sigue contando; las cuentas sin pagar se borran de verdad);
     - **más** los movimientos de Caja que no vienen de pedidos (`sourceModule` distinto de `pedidos` y
       `pedidos-pagos`) por su fecha, para no perder mostrador, cuotas de socios y movimientos manuales;
   - **desglose:** cada celda abre `/informes/resultados/detalle` con la lista de movimientos (o pedidos y
     cuentas a pagar) que la forman: fecha, origen, contacto, descripción, importe, enlace al pedido;
   - CSV de la matriz y del detalle.
3. **Flujo de caja proyectado** (`/informes/flujo`):
   - agrupar por **día, semana o mes** (por omisión mes); horizonte 7 días, 1, 3, 6 o 12 meses (por omisión
     3 meses); no admite fechas pasadas;
   - primera fila **"Hoy"**: saldo actual de todas las cuentas de Caja activas + por cobrar vencido − por
     pagar vencido (cada uno visible por separado);
   - filas siguientes: **por cobrar** (saldo de cuotas que vencen en el período, de pedidos no cancelados),
     **por pagar** (cuentas a pagar con `paidAt` nulo que vencen en el período), **neto** y **saldo
     acumulado**;
   - las cuentas a pagar sin vencimiento van en una fila aparte "Sin fecha" al pie, sin sumar al acumulado
     **[decisión]**;
   - **saldo mínimo** (ajuste): la fila cuyo acumulado queda por debajo se pinta en rojo y el tablero avisa
     la primera fecha en que pasa;
   - desglose: cada importe abre la lista de cuotas o cuentas a pagar del período; CSV.
4. **Monotributo** (`/informes/monotributo`):
   - **cobrado en los últimos 12 meses móviles** = INGRESOS de Caja sin transferencias, neto de
     anulaciones; barra mes a mes;
   - comparado contra el **tope anual** cargado a mano en ajustes (con la letra de categoría como
     etiqueta); porcentaje usado y lo que falta;
   - semáforo: verde < aviso, amarillo ≥ porcentaje de aviso (por omisión 80 %), rojo ≥ 100 %;
   - leyenda fija: "Control interno con lo registrado en Caja. No reemplaza la facturación informada a
     ARCA.";
   - si no está configurado, invita a cargar el tope.
5. **Ajustes** (`/informes/ajustes`, requiere `configurar`):
   - saldo mínimo de alerta (pesos, opcional);
   - categoría de monotributo (texto corto, opcional), tope anual (pesos, opcional), porcentaje de aviso
     (50–99, por omisión 80).
6. **Pantallas y módulo:**
   - entrada "Informes" en el menú, con las pestañas como subítems;
   - módulo `reports` en `MODULE_REGISTRY`, familia de gestión, sin `dependsOn`;
   - palabras para el buscador ⌘K;
   - enlaces desde Caja → Reportes y Pedidos → Informes hacia el informe nuevo equivalente (las pantallas
     viejas quedan **[decisión: no se borran en esta etapa]**).

### Entrega B · Ventas y consultas

1. **Ventas** (`/informes/ventas`): pedidos no cancelados agrupados por producto (ítems del JSON, sin
   prorratear descuento global — se avisa), cliente, vendedor (`ownerUserId`), categoría de la consulta u
   origen de la consulta; meses en columnas; cantidad e importe; detalle por celda; CSV.
2. **Embudo** (`/informes/embudo`): consultas creadas en el período por categoría y por origen: entraron,
   ganadas, perdidas, abiertas, % de conversión, valor estimado, total vendido de sus pedidos, días promedio
   hasta cerrar; CSV.

**Fuera de alcance:** libro IVA y factura electrónica; escenarios ("qué pasa si X no paga"); comparativo
interanual; centros de costo; borrar los informes viejos de Caja y Pedidos.

## 3. Datos

Una sola tabla nueva (Entrega A):

- `FotofficeInformesAjustes`: `id`, `workspaceId` único (FK Workspace CASCADE), `minBalanceArs`
  Decimal(14,2)?, `monotributoCategory` text? (≤ 20), `monotributoCapArs` Decimal(14,2)?,
  `monotributoWarnPct` int default 80 (CHECK 50–99), `updatedAt`.
  CHECK: importes ≥ 0.

La Entrega B no necesita tablas.

## 4. Errores y casos borde

- **Topes de lectura:** como Pedidos → Informes, si un informe excede el tope de filas se muestra el aviso
  "Hay demasiados datos para este período, achicá el rango" en vez de datos parciales.
- **Rango inválido o mayor a 24 meses:** se corrige al período por omisión con aviso.
- **Monto Decimal:** todo se suma en centavos enteros (`decimalArsToMinor`), nunca en coma flotante.
- **Zona horaria:** los límites de mes y día se calculan en hora de Buenos Aires.
- **Rubro inactivo con movimientos:** sigue apareciendo (marcado "inactivo").
- **Datos personales:** no van a los registros; el CSV respeta el mismo permiso que la pantalla.

## 5. Publicación

1. SQL a mano en producción (rama `development`), antes del código; registrar en `_prisma_migrations`.
2. PR, chequeos (tipos, pruebas, build de Vercel) y fusión.
3. Verificación en producción (rutas, sin errores 5xx).
4. Encender el módulo `reports` en DNX.
