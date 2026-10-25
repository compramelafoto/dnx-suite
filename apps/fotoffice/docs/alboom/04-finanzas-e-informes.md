# 04 · Finanzas e Informes de Alboom CRM

> Análisis funcional **estático** (sin navegador) del módulo "Financiero" (*Finance*) de Alboom CRM, para replicarlo mejorado en FOTOFFICE y migrar sus datos.
>
> **Fuentes** (carpeta `alboom/`): `app.js` (controladores `FinanceController`, `BanksController`, `ReportsController`, `CostsController`, `SettingsController`, `OrdersController`; servicios `AccountTrans`, `Accounts`, `Banks`, `Reports`, `Costs`, `Settings`, `Categories`; estados de `ui-router`), `v/views/finance/**`, `v/views/banks/**`, `v/views/reports/**`, `v/views/settings/{finance,chartaccounts,classes,categories,customer_area}.html`, `v/views/orders/{edit,payments,costs,modal_costs,express_edit}.html`, `v/views/common/{navigation,modal_payments,pagination_footer}.html`, `v/views/contacts/{ar,ar_paid,ap,ap_paid}.html`, `v/views/dashboard/{ar,ar_paid}.html`, `v/views/widgets/{transactions,projection_print}.html`, `endpoints.txt`, `es.json`, `settings_menu.txt`.
>
> **Convenciones del documento**
> - Se usan los nombres en español que ve el usuario (tomados de `es.json`), con el inglés entre paréntesis la primera vez. Ej.: "Cuentas por Cobrar" (*Accounts Receivable*).
> - "Inferido" = deducido del código pero no confirmado. "**No determinable estáticamente**" = depende del servidor (PHP/API) cuyo código no tenemos.
> - Los montos se muestran siempre con 2 decimales (`number:2`).

---

## Índice

1. [Mapa del módulo y permisos](#1-mapa-del-módulo-y-permisos)
2. [Modelo contable interno (cómo guarda el dinero)](#2-modelo-contable-interno)
3. [Ciclo de vida de una cuenta por cobrar / por pagar](#3-ciclo-de-vida)
4. [Pantalla: Cuentas por Cobrar / por Pagar (pendientes)](#4-cuentas-por-cobrar--por-pagar-pendientes)
5. [Modal: Nueva / Editar / Ver / Borrar cuenta](#5-modales-de-alta-edición-vista-y-borrado)
6. [Modal: Recibir / Pagar (cobro total, parcial, descuento, excedente)](#6-modal-recibir--pagar)
7. [Pantalla: Cuentas Recibidas / Pagadas](#7-cuentas-recibidas--pagadas)
8. [Pantalla: Por Cliente / Por Proveedor](#8-por-cliente--por-proveedor)
9. [Recibo imprimible y "monto en letras"](#9-recibo-imprimible)
10. [Recordatorios de vencimiento y enlaces de pago](#10-recordatorios-de-vencimiento-y-enlaces-de-pago)
11. [Cuentas Bancarias (bancos y cajas)](#11-cuentas-bancarias)
12. [Transacciones (movimientos de una cuenta)](#12-transacciones)
13. [Conciliación bancaria](#13-conciliación-bancaria)
14. [Costos de pedidos / oportunidades / productos → Cuentas por Pagar](#14-costos--cuentas-por-pagar)
15. [Pagos del pedido → Cuentas por Cobrar](#15-pagos-del-pedido--cuentas-por-cobrar)
16. [Configuración: Financiero, Plan de cuentas, Clases, Métodos de pago](#16-configuración)
17. [Informes](#17-informes)
18. [Vistas del contacto, del pedido y del Área del Cliente](#18-vistas-embebidas)
19. [Boletos bancarios (Brasil)](#19-boletos-bancarios-brasil)
20. [Endpoints de API](#20-endpoints)
21. [Modelo de datos inferido](#21-modelo-de-datos-inferido)
22. [Errores y rarezas detectadas en Alboom](#22-errores-y-rarezas)
23. [Propuesta global para FOTOFFICE (Argentina)](#23-propuesta-global-para-fotoffice)
24. [Dudas a verificar en vivo](#24-dudas-a-verificar-en-vivo)

---

## 1. Mapa del módulo y permisos

### 1.1 Menú lateral (`v/views/common/navigation.html`, líneas 58–88)

Grupo **Financiero** (*Finance*), visible si `AppUser.modules.finance == 1` y rol `user` o `admin`. Si el plan es gratuito y no tiene el módulo, se muestra el mismo menú con una corona y cada ítem lleva a `support.resources({resource:'finance'})` (pantalla de venta del módulo).

| Ítem (ES) | Inglés | Estado ui-router | URL | Plantilla |
|---|---|---|---|---|
| Cuentas Bancarias | Bank Accounts | `banks.index` | `#/banks/index/{itemCategory}` | `views/banks/index.html` |
| Transacciones | Transactions | `banks.transactions` → `.list` / `.reconc` | `#/banks/transactions/list/{id}` · `#/banks/transactions/reconc/{id}` | `views/banks/list.html` + `transactions.html` / `reconciliation.html` |
| Cuentas por Cobrar › Por cobrar | AR Accounts › Receivable | `finance.ar` | `#/finance/ar` | `views/finance/index_apr.html` |
| Cuentas por Cobrar › Recibidas | Received | `finance.ar_paid` | `#/finance/ar_paid` | `views/finance/index_apr_paid.html` |
| Cuentas por Cobrar › Por Cliente | By Customer | `finance.ar_customers` | `#/finance/ar_customers` | `views/finance/index_apr_customers.html` |
| Cuentas por Pagar › Por pagar | AP Accounts › Payable | `finance.ap` | `#/finance/ap` | `index_apr.html` (misma plantilla) |
| Cuentas por Pagar › Pagado | Paid | `finance.ap_paid` | `#/finance/ap_paid` | `index_apr_paid.html` |
| Cuentas por Pagar › Por Proveedor | By Supplier | `finance.ap_suppliers` | `#/finance/ap_ap_suppliers` (sic) | `index_apr_customers.html` |
| Informes › Resultados | Reports › Results | `reports.finance({link:'results'})` | `#/reports/finance/results` | `views/reports/finance_results.html` |
| Informes › Resultados de Ventas | Sales Results | `reports.finance({link:'sales_results'})` | `#/reports/finance/sales_results` | `finance_sales_results.html` (sólo con add-on avanzado) |
| Informes › Flujo de caja | Cash Flow | `reports.finance({link:'cashflow'})` | `#/reports/finance/cashflow` | `finance_cashflow.html` |

El submenú **Informes** dentro de Financiero sólo aparece si `(rol user y user_reports == 1) o rol admin`.

Otros informes (fuera del menú Financiero, en el grupo Ventas): **Informes de pedidos** (`reports.sales`), **Informes de VAT/IVA** (`reports.vat`, sólo si `AppSettings.vat_active == 1`) y **Oportunidades Ganadas** (`reports.opportunities`). Los informes `new_accounts`, `activations`, `renew` son del **superadministrador de Alboom** (suscriptores de la plataforma) y quedan fuera de alcance.

### 1.2 Restricciones de acceso (en `app.js`, propiedad `restrict` de cada estado)

| Recurso | Regla |
|---|---|
| `finance.*`, `banks.*` | `user.modules.finance == "1"` |
| `reports.*` | `role == admin` **o** `user_reports == "1"` |
| Impresiones `print.finance_*`, `print.banks`, `print.bank_transactions`, `print.reports` | `role == admin` **o** (`modules.finance == 1` **y** `user_reports == 1`) |
| Borrar cuentas/transacciones (individual o masivo) | `AppUser.user_finance_delete == 1` o admin |
| Borrar transacción **conciliada** | sólo admin (botón deshabilitado para el resto, `modal_view_transaction.html`) |
| Tildar filas en conciliación | sólo `user_finance_delete == 1` o admin (`reconciliation.html`) |
| Alta rápida de contacto desde el modal | `user_contacts_create == 1` o admin |

Permisos por usuario (`v/views/users/edit.html`, líneas 44–90): "Permitir acceso a informes" (`user_reports`), "Acesso al Financiero" (*Access to Finance*, `user_finance`), "Crear Retroactivo" (*Create Retroative*, `user_finance_create`) y "Borrar" (`user_finance_delete`). Valores por defecto al crear usuario: `user_finance=0`, `user_finance_create=1`, `user_finance_delete=1`, `user_reports=0`. **El uso de `user_finance_create` no aparece en el frontend: No determinable estáticamente** (probablemente el servidor impide crear asientos con fecha pasada).

### 1.3 Funciones que dependen de add-ons del suscriptor

- `addon_advanced == 1` ("Avanzado"): filtro por **Usuario**, filtro por **Clase**, acciones masivas "Editar contacto" y "Editar Forma de Pago", impresión "Grupo por Tipo de Documento", informe **Resultados de Ventas**, enlaces de desglose en Flujo de caja, columna "Pagado" en costos.
- `classes_active == 1` (configuración): muestra Clases en todo el módulo.
- `addon_boleto == 1`: boletos bancarios brasileños (ver §19).

**Mejora propuesta (permisos)**: en FOTOFFICE usar permisos finos por acción (ver, crear, editar, anular, conciliar, ver informes, ver montos de otros usuarios) y **nunca** gating por "add-on"; el filtro por usuario y por centro de costo deben ser estándar.

---

## 2. Modelo contable interno

Alboom usa una **contabilidad de partida doble simplificada**. Todo el dinero (cuentas por cobrar, por pagar, movimientos de banco) vive en **una sola tabla de asientos**: `account_trans` (cabecera) + `x_account_trans` (líneas de contrapartida). Fuente: `FinanceController.modalAPR`, `modalAPRClear`, `BanksController.modalTransactions`.

### 2.1 Cabecera `account_trans`

Una fila = un documento: una cuenta por cobrar, una por pagar, un depósito, un débito o una transferencia. Su campo `account_id` indica **en qué cuenta contable "vive"**:

| `account_id` de la cabecera | Qué es |
|---|---|
| `1.2`, `1.2.1`, `1.2.2`, `1.2.4`, `1.2.9` | Cuenta por Cobrar (según método de pago; ver §5.4) |
| `2.1` | Cuenta por Pagar |
| `1.1.{id_banco}` | Movimiento en una cuenta bancaria / caja |

### 2.2 Líneas `x_account_trans`

Cada cabecera tiene 1..N líneas con `account_id` (cuenta del plan: ingreso, costo, gasto u otra cuenta bancaria) y `amount`. Permite **repartir** una misma cuenta entre varias categorías (botón "+" en el modal). La suma de líneas es el total del documento.

### 2.3 Convención de signos (inferida del código)

- Cuenta por Cobrar: líneas positivas, cabecera `amount = -total` (negativa).
- Cuenta por Pagar: líneas negativas, cabecera positiva.
- Banco: depósito → cabecera negativa (entrada); débito/pago → positiva (salida). En pantalla se muestra `-1 * amount` y se pinta **en rojo cuando `amount > 0`** (salida de dinero).
- Al cobrar (clear) una por cobrar, el monto del depósito se envía negado (`account.amount = -1 * monto`).

### 2.4 Categorías del asiento (`category_id`) — tabla de códigos

| Código | Significado | Evidencia |
|---|---|---|
| 71 | Pago al Contacto (*Payment to Contact*) — débito de banco | `modalTransactions` modo `payment`; `act_save` |
| 72 | Depósito del Contacto (*Deposit from Contact*) — depósito de banco | modo `deposit` |
| 73 | Cuenta por cobrar **generada por un pedido** (inferido) | No se puede borrar si el pedido está "Venta Completada" (475); bloquea borrado masivo |
| 74 | Transferencia a Cuenta (*Transfer to Account*) | modo `transfer` |
| 80 | Cuenta editable "de origen" (tratada igual que 81/82) — **significado exacto no determinable** (¿generada desde costos?) | condiciones `category_id == 80 || 81 || 82` |
| 81 | Cuenta por Cobrar **manual** | alta en modo `ar` |
| 82 | Cuenta por Pagar **manual** | alta en modo `ap` |
| 83 | **Cobro** de una cuenta por cobrar (movimiento de banco) | `modalAPRClear` modo `ar`; recibo |
| 84 | **Pago** de una cuenta por pagar (movimiento de banco) | `modalAPRClear` modo `ap`; recibo |

### 2.5 Plan de cuentas (estructura inferida)

| Prefijo | Grupo | Uso en el código |
|---|---|---|
| `1.1.{id}` | Activo › Bancos / cajas (una subcuenta por cada "Cuenta Bancaria") | `"1.1."+bank.id` en todo `BanksController` |
| `1.2.x` | Activo › Cuentas por cobrar | alta de AR |
| `2.1` | Pasivo › Cuentas por pagar | alta de AP |
| `2.5.2` | "Ajuste del Saldo Inicial" (*Opening Balance Adjust*) — patrimonio | se agrega a la lista de ingresos de un depósito para cargar saldos iniciales |
| `3.x` | **Ingresos** (tipo R) — editable por el usuario | `Accounts.get_list({id:3,type:'all-down'})` |
| `3.2` | Cuenta de ingreso usada por defecto para **diferencias a favor** (intereses cobrados / descuentos obtenidos) | `modal_clear` |
| `4.x` | **Costos** (tipo C) — editable | `Accounts.get_list({id:4})`, costos de pedidos (`prefix:"4,5"`) |
| `5.x` | **Gastos** (tipo D) — editable | |
| `5.6` | Gasto por defecto cuando se **paga de más** una cuenta por pagar (intereses/multas pagados) | |
| `5.7` | Gasto por defecto cuando se **cobra de menos** con "Descuento" (descuentos otorgados) | |

Los nombres de las cuentas del plan inicial vienen del servidor: **No determinable estáticamente**. Sólo 3, 4 y 5 son editables desde Configuración (§16.2).

### 2.6 Estados de un asiento

- `cleared` = 0/1. En cuentas por cobrar/pagar significa **saldada** (pasa a "Recibidas/Pagadas"); en movimientos de banco significa **Conciliado** (*Reconciled*). (Inferido: el mismo campo sirve para ambas cosas.)
- `future_trans = 1`: la fila se pinta con estilo `future_trans` (movimiento con fecha futura). Lo calcula el servidor.
- Color del vencimiento (directiva `dateColor`, `app.js`): **rojo** si ya venció, **verde** si vence hoy, **azul** si es futuro.

**Mejora propuesta**: mantener partida doble (es lo que habilita los informes de resultados y flujo), pero con **estados explícitos** (`pendiente`, `parcial`, `saldada`, `anulada`) separados de la conciliación bancaria (`conciliado_en`), montos siempre positivos con un campo `sentido` (entrada/salida) y un enum legible en vez de códigos 71–84.

---

## 3. Ciclo de vida

### 3.1 ¿Cómo nace una cuenta por cobrar?

1. **Desde un pedido** (camino principal). En el pedido, pestaña "Artículos y pagos" (*Items & Payments*), el usuario arma el **plan de pagos** (cuotas con vencimiento, método, número de documento, memo y monto; §15). La vista `orders/payments.html` aclara: *"AR Accounts will be created automatically if the order status is Completed"* → las cuotas se convierten en cuentas por cobrar **cuando el pedido pasa a "Venta Completada" (475)**. La conversión la hace el servidor (**No determinable estáticamente** en detalle); cada cuota queda enlazada por `order_id` y `order_payment_id` y con `category_id` 73 (inferido).
2. **Pedido Rápido** (*Express Order*, estado 476): se carga el cobro en el momento con "Método de pago" y "Depositar en" (banco); el servidor crea directamente el cobro (inferido: se muestra `bankName` del pago).
3. **Manual**: botón "Nueva Cuenta por Cobrar" (`category_id = 81`), opcionalmente **recurrente** (N repeticiones cada X intervalo).
4. **Por pago parcial**: al cobrar de menos y elegir "Pago Parcial", se crea una nueva cuenta por el saldo, con memo "Cuenta generada por el depósito parcial" (*A/R from partial deposit*).

### 3.2 ¿Cómo nace una cuenta por pagar?

1. **Desde los costos del pedido** (§14): cada costo con vencimiento genera una cuenta por pagar al proveedor cuando el pedido está completado (475/476) — llamada `PUT /orders/set_cost_accounts/:id`. Texto de la vista: *"Only costs with due date will create Accounts to Pay."*
2. **Manual**: "Nueva Cuenta por Pagar" (`category_id = 82`), también recurrente.
3. **Por pago parcial** (memo "Cuenta generada por el pago parcial").

### 3.3 Diagrama de estados

```
             (pedido completado / alta manual / recurrente / saldo parcial)
                                   │
                                   ▼
                     ┌──────────────────────────┐
                     │ PENDIENTE (cleared = 0)  │◄───────────── si se borra el cobro (83/84),
                     │ aparece en Por cobrar /  │               la cuenta vuelve a pendiente
                     │ Por pagar                │
                     └───────────┬──────────────┘
                                 │ Recibir / Pagar  (POST /account_trans/clear_apr)
             ┌───────────────────┼──────────────────────┬──────────────────────┐
             ▼                   ▼                      ▼                      ▼
     monto = saldo       monto < saldo            monto < saldo           monto > saldo
     (total)             "Pago Parcial"           "Descuento"             (excedente)
             │                   │                      │                      │
             │        se crea NUEVA cuenta       diferencia a cuenta     diferencia a cuenta
             │        pendiente por el resto     5.7 (AR) / 3.2 (AP)     3.2 (AR) / 5.6 (AP)
             ▼                   ▼                      ▼                      ▼
                     ┌──────────────────────────┐
                     │ SALDADA (cleared = 1)    │  + movimiento de banco 83/84 enlazado
                     │ aparece en Recibidas /   │    (ref_account_trans) con recibo
                     │ Pagadas                  │
                     └──────────────────────────┘
```

---

## 4. Cuentas por Cobrar / por Pagar (pendientes)

**Fuente**: `v/views/finance/index_apr.html`; `FinanceController.loadAPR`, `getAPRData`, `loadAPRCSV`; estado `finance.ar` / `finance.ap`.

### 4.1 Propósito y acceso
Listar las cuentas **pendientes** (no saldadas) por cobrar o por pagar. Una sola plantilla sirve para ambas; la diferencia es `account_mode = 'ar' | 'ap'`, que se decide por el nombre del estado. Migas: Inicio › Financiero › Cuentas por Cobrar / Cuentas por Pagar.

**Parámetros de estado (no van en la URL, sólo navegación interna)**: `customer_id`, `itemPeriod`, `itemGroup` (Day/Week/Month), `itemDate`, `itemClass`. Los usa el Flujo de caja y la ficha del contacto para abrir la lista ya filtrada.

### 4.2 Encabezado
Título dinámico: "Cuentas por Cobrar • {método de pago si filtrado} • {período}" + "• {usuario}" + "• Clase: {clase}".

### 4.3 Buscadores y filtros

| Filtro | Control | Valores | Persistencia |
|---|---|---|---|
| **Tipo** (*Type*) = método de pago | desplegable | "Todos" + lista de métodos de pago (`Categories.get_list({type:'payment'})`) | `$localStorage.doc_type` (pero al recargar arranca en `all`: ver §22) |
| **Filtrar por período** (*Filter by Period*) — sobre **vencimiento** (inferido) | desplegable | Todos, **Pendientes/Vencidas** (*Overdue*, `due`), Último Año, Últimos 6 meses, Últimos 3 meses, Último mes, Última semana, Hoy, Esta semana, Próxima Semana, Este mes, Próximo Mes, Próximos 3 Meses, Próximos 6 Meses, Este año, Próximo Año, **Otro período** (abre selector de rango `views/common/modal_date_range.html`) | `$localStorage.period`, `start_date`, `end_date`. **Por defecto: "Esta semana"** (`this_week`). Se oculta cuando se filtra por cliente (y el período se fuerza a "Todos"). |
| **Usuario** | desplegable | "Todos" + usuarios | sólo en memoria. Requiere add-on avanzado |
| **Clase** | desplegable | "Todos" + clases | `$localStorage.class_id` (compartido con Bancos). Requiere clases activas + avanzado |
| **Cliente** | chip con "×" | viene por `customer_id` | sólo parámetro de estado |
| **Buscar** (*Search*) | texto libre | busca en el servidor; espera 500 ms y mínimo 2 caracteres (o vacío). Ayuda: "Para buscar fechas use el formato aaaa-mm-dd" | no persiste |

Parámetros enviados a `POST /account_trans/paginate_apr`: `type` (`ar`/`ap`), `class_id`, `doc_type`, `customer_id`, `pageNumber`, `pageSize`, `groupBy`, `sortBy`, `sortDir`, `searchTerm`, `period`, `start_date`, `end_date`, `user_id`, `csv_mode` (0/1).

### 4.4 Listado

| Columna (ES) | Campo | Ordenable | Notas |
|---|---|---|---|
| # | `id` | no | |
| Emisión (*Issue Date*) | `add_date` | sí | oculta en móvil |
| Vencimiento (*Due Date*) | `due_date` | sí | coloreada rojo/verde/azul |
| Doc | `document_number` | sí | + número de boleto (Brasil) |
| Tipo | `document_type_name` (método de pago) | sí | |
| Pedido | `order_id` | sí | insignia que abre `#/orders/view/{id}` en pestaña nueva |
| Nombre | nombre del contacto | sí (`customer.name`) | al pasar el mouse muestra emails, teléfonos, ciudad/provincia/país; enlace a la ficha del contacto; clic en email abre redactar correo |
| Memo | `memo` | sí | |
| Usuario | avatar de `user_name` | sí | sólo avanzado |
| Valor (*Amount*) | `amount` (valor absoluto) | sí | |
| Estado | ícono de boleto | sí | sólo Brasil |
| ☐ | selección | — | |
| Acciones | ver / editar / Recibir o Pagar / Correo / Borrar | — | |

**Orden por defecto**: `account_trans.due_date` ascendente (vencimiento más próximo primero). Se guarda en `$localStorage.sortBy/reverseSort` **compartido** con otras pantallas del módulo.

**Totales**: fila final con "Total de esta página" (suma de valores absolutos de la página, calculada en el navegador) y "Total" (del servidor, `data.total`, en valor absoluto) — ambos respetan los filtros.

**Paginación** (`views/common/pagination_footer.html`): 10 / 25 / 50 / 100 por página (default 10, guardado en `$localStorage.pageSize`), paginador con primera/última, texto "Mostrando ítem X a Y (N ítems en total)".

### 4.5 Acciones

| Acción | Dónde | Qué hace |
|---|---|---|
| **Nueva Cuenta por Cobrar / por Pagar** | botón verde | abre modal de alta (§5) |
| **Exportar en CSV** | botón | pide todo (`pageSize 999999`, `csv_mode 1`) con los mismos filtros; archivo `accounts_ar.csv` / `accounts_ap.csv`; separador de campos y decimal según configuración (`AppSettings.csvSeparator`, `csvDecimalSeparator`). Columnas: las que devuelva el servidor (**No determinable estáticamente**) |
| **Imprimir** | botón o menú (avanzado): "Regular" / "Grupo por Tipo de Documento" | abre en pestaña nueva `#/print/finance_ar/{doc_type}/{period}/{start_date}/{end_date}/{searchTerm}/{customer_id}/{groupBy}/{class_id}` |
| **Ver** | ícono carpeta | modal de sólo lectura |
| **Editar** | lápiz | modal de edición |
| **Recibir** (AR) / **Pagar** (AP) | ícono flecha | modal de cobro/pago (§6) |
| **Correo electrónico** (sólo AR) | ícono sobre | abre redactor con plantilla de recordatorio de pago (§10) |
| **Borrar** | papelera | sólo si tiene permiso y **no** es (cuenta de pedido 73 **con** pedido completado 475) |

**Acciones masivas** (desplegable que aparece al tildar filas; nota: "No todas las operaciones están disponibles para todas las cuentas"):

| Acción | Modo | Condición | Endpoint |
|---|---|---|---|
| Editar contacto | `customer_id` | avanzado y ninguna fila seleccionada es de pedido (73) | `POST /account_trans/batch_edit` |
| Editar Fecha de Emisión | `add_date` | ninguna de pedido | idem |
| Editar Fecha de Vencimiento | `due_date` | siempre | idem |
| Editar Forma de Pago | `document_type_id` | avanzado | idem |
| Borrar | — | permiso de borrar y ninguna de pedido | `POST /account_trans/batch_delete` — confirmación "¿Desea borrar N transacciones marcadas? IMPORTANTE: esta operación no se puede deshacer." |

Los modales de edición masiva (`views/finance/modal_{mode}_checked.html`) **no están en la copia local: No determinable estáticamente** su diseño (probablemente un único campo). Cada acción masiva deja una actividad en el historial: "Se cambió la fecha de vencimiento de N cuentas en lote", etc.

### 4.6 Impresión (`v/views/finance/index_apr_print.html`)
Encabezado con logo y datos de la empresa (posición del logo configurable), título, período, término de búsqueda, método de pago, clase y fecha de emisión del listado. Columnas: #, Vencimiento, Doc / Tipo / Pedido, Nombre (con contactos), Memo, Usuario, Valor, Estado (boleto), **Clase** (si no se filtró por clase). En modo "Grupo por Tipo de Documento" el servidor intercala filas `subtotal` en negrita. Total final. Pie: mensaje de impresión y fecha/hora.

### 4.7 Mejora propuesta para FOTOFFICE
- Filtros en la **URL** (compartibles) y memoria **separada por pantalla**.
- Agregar columnas: **saldo pendiente** (si hubo cobros parciales), **días de atraso**, **evento/cobertura** vinculada, **centro de costo**.
- Chips rápidos: "Vencidas", "Vencen esta semana", "Sin método de pago".
- Acción "**Enviar link de pago de Mercado Pago**" por fila y masiva; "**Registrar transferencia**" con adjunto del comprobante.
- Exportar CSV **y Excel** con columnas documentadas.
- Agrupar en pantalla (no sólo al imprimir) por método de pago, cliente o mes.

---

## 5. Modales de alta, edición, vista y borrado

**Fuente**: `v/views/finance/modal_edit_apr.html`, `modal_view_apr.html`; `FinanceController.modalAPR`, `ModalAPRInstanceCtrl`.

### 5.1 Alta (Nueva Cuenta por Cobrar / por Pagar)

Título: "Añadir • Por cobrar" / "Añadir • Por pagar".

| Campo (ES) | Tipo | Obligatorio | Default / validación |
|---|---|---|---|
| **De** (AR) / **Para** (AP) — contacto | buscador con autocompletado (mín. 3 letras, 30 resultados, `Contacts.get_list({type:'all_users'})`) + botón "+" alta rápida de contacto | **sí** ("Por favor seleccione un contacto") | — |
| **Emisión** | fecha | no (valida formato) | hoy |
| **Vencimiento** | fecha | no | hoy + 1 mes |
| **Categoría** (cuenta del plan) | selector con búsqueda, **repetible** (botón "+" agrega otra línea, "−" la quita) | sí, cada línea | AR: cuentas de **Ingresos** (3.x). AP: **Costos + Gastos** (4.x y 5.x). Primera cuenta de la lista |
| **Valor** por línea | número con máscara | sí | 0. El total se recalcula solo |
| **Método de pago** | selector | sí | el primero de la lista |
| **Número de Documento** | texto | no | — |
| **Clase** | selector | obligatorio sólo si `classes_in_finances == 1` | visible con clases activas + avanzado |
| **Recurrente** | Sí/No | — | No |
| **Repeticiones** | texto (número) | — | 1 (visible si Recurrente = Sí) |
| **Intérvalo** | selector | obligatorio si recurrente | Mensual (`m_1`), Semanal (`d_7`), Cada 2 semanas (`d_14`), Cada 15 días (`d_15`), Cada 4 semanas (`d_28`), Cada 30 días (`d_30`), Bimestral (`m_2`), Trimestral (`m_3`), Semestral (`m_6`), Anual (`m_12`) |
| **Descripción** | texto largo → `memo` | no | — |

Al guardar: `POST /account_trans` con `{trans, x_trans}`. `trans.account_id` = `1.2`/`1.2.x` (AR) o `2.1` (AP); `category_id` 81/82; `payment_number` = repeticiones (1 si no recurrente); `payment_interval`. **La generación de las N cuotas recurrentes la hace el servidor** (inferido; campo `trans_seq_id` probablemente las agrupa). Mensaje: "Cuenta por Cobrar añadida" + registro en el historial de actividades del contacto, con texto tipo "(#id) Emisión: … – Vencimiento: … – Contacto: #… – Valor: …. Memo: …".

Si hay errores de validación aparece el aviso "Ocurrieron errores. Por favor revise y envíe de nuevo".

### 5.2 Edición
Mismo modal ("Editar • Por cobrar"). Diferencias:
- Si la cuenta es **manual** (80/81/82): se puede cambiar contacto, emisión, categorías y montos.
- Si **no** es manual (p. ej. generada por pedido): contacto y emisión se muestran fijos; la "Categoría" muestra "Cuentas por Cobrar" y el valor fijo; sólo se editan vencimiento, método de pago, número de documento, clase y descripción.
- Si es un cobro/pago (83/84): aviso "Para editar más detalles de esta Cuenta por Cobrar, debe borrar esta transacción y editar la cuenta en la pantalla de Cuentas por Cobrar".
- Guardar: `PUT /account_trans/:id` con `{trans, x_trans}`.

### 5.3 Ver / Borrar
`modal_view_apr.html`: De/Para, Emisión, Vencimiento (coloreado), Categoría(s) con montos y total, Método de pago, Número de Documento, "Transacción hecha por", Clase, Descripción. Botones de boleto (Brasil). En modo borrar, botón "Borrar" (oculto si es cuenta de pedido 73). Borrar: `DELETE /account_trans/:id`.

### 5.4 Cuenta contable según método de pago (AR)
Código en `modalAPR`: método 52 (boleto) → `1.2.1`; 51 → `1.2.2`; 63 → `1.2.4`; otros → **debería** ser `1.2.9` pero por un error de tipeo queda `1.2` (ver §22). Los nombres de los métodos 51 y 63 no están en el frontend (**No determinable estáticamente**; los IDs 52 = Boleto, 56 = PagSeguro, 57 = PayPal sí se deducen).

### 5.5 Mejora propuesta
- Recurrencia **visible** (vista previa de las N cuotas antes de guardar, editar/cancelar la serie).
- Vincular la cuenta manual a **pedido / cobertura / evento** opcionalmente.
- Adjuntos (factura, comprobante).
- Campo "**Comprobante fiscal**" (factura A/B/C/E con CAE de ARCA) enlazado.
- Auditoría de cambios (quién cambió qué y cuándo), no sólo un texto en actividades.

---

## 6. Modal Recibir / Pagar

**Fuente**: `v/views/finance/modal_clear_apr.html`; `FinanceController.modalAPRClear`, `ModalAPRClearInstanceCtrl`; endpoint `POST /account_trans/clear_apr`.

### 6.1 Precondición
Debe existir al menos una Cuenta Bancaria; si no, aviso "¡No tiene cuentas bancarias! Por favor configure una primero" con enlace a Cuentas Bancarias.

### 6.2 Campos

| Campo | Tipo | Default | Regla |
|---|---|---|---|
| De / Para, Vencimiento, Valor original, Número de Documento | sólo lectura | de la cuenta | |
| **Importe Recibido** / **Valor Pagado** | número | el saldo de la cuenta (o el valor que informó el banco si es boleto pagado) | obligatorio |
| **Fecha de depósito** / **Fecha de Pago** | fecha | hoy | |
| **Diferencia** | calculado = recibido − original | — | se muestra si ≠ 0 (rojo si negativa) |
| **Tipo de diferencia** (si recibido < original) | "Pago Parcial" / "Descuento" | Pago Parcial | |
| **Próxima Fecha de Vencimiento** (si Pago Parcial) | fecha | hoy + 1 mes | vencimiento de la cuenta nueva por el saldo |
| **Depositar en** / **Pagar usando** | selector de Cuentas Bancarias | la primera | obligatorio |
| **Cuenta para registrar la diferencia** (si Descuento o excedente) | selector de cuentas 3.x y 5.x | AR con descuento → `5.7`; AR con excedente → `3.2`; AP con descuento → `3.2`; AP con excedente → `5.6` | obligatorio en esos casos |
| **Descripción** | texto | "Recibir: {memo original}" / "Pago: {memo}" | |

### 6.3 Qué se envía y qué pasa
`{trans: cuenta original, account: {account_id: "1.1."+banco, amount (negado si AR), cleared_date, next_due_date, partial_payment, difference_amount, difference_account, difference_memo, memo, category_id 83|84}, mode}`.

El servidor (inferido por los textos y la vista de "Recibidas"):
1. Crea un movimiento de banco `83` (cobro) u `84` (pago) enlazado a la cuenta original (`ref_account_trans`).
2. Marca la original como saldada.
3. Si es **Pago Parcial**: crea una cuenta nueva por el saldo, vencimiento = "Próxima Fecha", memo "Cuenta generada por el depósito parcial – {memo}".
4. Si es **Descuento** o **excedente**: registra la diferencia en la cuenta elegida.

Resultado: mensaje "La cuenta fue recibida" / "La cuenta fue pagada", actividad en el historial, y aparecen tres botones: **Imprimir Recibo**, **Enviar Recibo** (correo con plantilla `receipt`) y **Enviar por WhatsApp** (si el contacto tiene celular; plantilla `receipt_whats`). El botón Cancelar pasa a "Cerrar".

### 6.4 Deshacer un cobro
No hay botón "anular cobro". Se borra el movimiento 83/84 desde **Transacciones**; el aviso dice "Si borra esta transacción, esta cuenta aparecerá como pendiente en Cuentas por Cobrar" (`modal_view_transaction.html`).

### 6.5 Mejora propuesta
- **Varios cobros contra una misma cuenta** sin crear cuentas nuevas (modelo "cuota con saldo" + "pagos aplicados"), y un pago que salde **varias** cuentas a la vez (ej. el cliente transfiere dos cuotas juntas).
- Medios argentinos al cobrar: **Mercado Pago** (se completa solo vía webhook con fecha, monto neto, comisión e ID de operación → la comisión va automáticamente a gastos), **transferencia** (CBU/alias origen, número de operación, adjunto), **efectivo** (caja), **cheque/e-cheq** (fecha de cobro diferida).
- Registrar **comisión y retenciones** como diferencias típicas preconfiguradas (en lugar de "cuenta de diferencia" libre).
- "Anular cobro" explícito con motivo.

---

## 7. Cuentas Recibidas / Pagadas

**Fuente**: `v/views/finance/index_apr_paid.html`, `modal_view_apr_paid.html`, `index_apr_paid_print.html`; `loadAPRPaid`, `loadAPRPaidCSV`, `modalAPRPaid`.

- **Propósito**: historial de cobros (AR) o pagos (AP) ya registrados (movimientos 83/84). Migas: Financiero › Cuentas Recibidas / Cuentas Pagadas.
- **Filtros**: Tipo (método de pago), Filtrar por período (tabla general: Todos, Esta semana, Última semana, Este mes, Último mes, Últimos 3/6 meses, Este año, Último año, Otro período), Usuario (avanzado), Clase, Buscar. Mismo endpoint `paginate_apr` con `type = ar_paid | ap_paid`.
- **Orden por defecto**: `account_trans.add_date` (fecha de cobro) **descendente**.
- **Columnas**: Recibo # (id), Fecha, Doc (+ tipo), Tipo, Pedido, Nombre (con tarjeta de contacto), Memo, Usuario (avanzado), Valor. Acción única: **Ver**.
- **Totales**: página y total. **Paginación** estándar.
- **CSV**: `accounts_ar_paid.csv`. **Imprimir**: `#/print/finance_ar_paid/{doc_type}/{period}/{start_date}/{end_date}/{searchTerm}/{customer_id}/{class_id}`.
- **Modal "Cuenta Recibida"**: importe recibido; bloque "Detalles de la cuenta" (de la cuenta original: emisión, vencimiento, valor, método, documento, pedido, usuario, clase, descripción); bloque "Detalles del depósito" (fecha, montos por línea y categoría, "Depositar en" banco, usuario, clase); **descripción editable en línea** (lápiz → confirmar; `PUT /account_trans/:id`). Botones Imprimir Recibo, Enviar Recibo, Enviar por WhatsApp.

**Mejora propuesta**: mostrar el comprobante adjunto y el ID de Mercado Pago; filtro por cuenta de destino (qué banco/caja); columna "días de atraso al cobrar" (útil para medir morosidad).

---

## 8. Por Cliente / Por Proveedor

**Fuente**: `v/views/finance/index_apr_customers.html`, `index_apr_customers_print.html`; `loadAPRCustomer`, `getAPRCustomerData`, `APRDetail`; endpoint `POST /account_trans/paginate_apr_customer`.

- **Propósito**: saldo agregado por contacto.
- **Modo** (botones): **Pendiente** (default) / **Pagado** / **Todos** — guardado en `$localStorage.apr_customer_mode`.
- **Filtros**: Usuario (avanzado), Buscar. (No hay filtro de período en pantalla, aunque se envía el del almacenamiento local.)
- **Columnas**: avatar, Nombre (con ciudad al pasar el mouse), Correo, Teléfono, Usuario (avanzado), **Pendiente** (`apr`), **Pagado** (`apr_paid`). Ordenables por nombre, correo, teléfono, usuario, pendiente, pagado. Orden por defecto: nombre.
- **Clic en un importe** → abre Por cobrar / Recibidas (o Por pagar / Pagadas) filtradas por ese contacto.
- **Totales**: página y total para cada columna.
- **CSV** y **Imprimir** (`#/print/finance_ar_customers/{type}/{apr_customer_mode}/{searchTerm}`).

**Mejora propuesta**: "**estado de cuenta**" del cliente (cronológico con saldo corrido: facturado, cobrado, saldo), exportable en PDF y enviable por correo/WhatsApp; antigüedad de deuda (0–30, 31–60, 61–90, +90 días).

---

## 9. Recibo imprimible

**Fuente**: `v/views/finance/receipt.html`; `FinanceController.loadReceipt`; `GET /account_trans/get_receipt/:id` y `GET /account_trans/amount_in_words/:value/:lang`; estado `print.receipt` (`#/print/receipt/{id}.{receipt_key}`).

- **Acceso público** por enlace con clave (`id.receipt_key`), para mandarlo al cliente. Si no existe: "Esta página no existe o su dirección ha cambiado. Por favor contacte a {empresa}".
- **Contenido — Cobro (83)**: logo, datos de la empresa, "Recibo #{id}", fecha; texto: *"Recibimos de {cliente}, NIF {CPF/CNPJ}: {nº}, la cantidad de {$ monto} ({monto en letras}), referente a {memo}. {Ciudad}, {fecha larga}."*; firma (imagen de firma configurada o línea), razón social, NIF, domicilio.
- **Contenido — Pago (84)**: invertido: *"Recibimos de {empresa}… la cantidad de…"* con línea de firma para el **proveedor**.
- El **monto en letras** lo calcula el servidor según idioma (`amount_in_words`).
- La etiqueta del documento cambia entre "NIF" personal o de empresa según tenga 14 dígitos (lógica brasileña CPF/CNPJ).

**Mejora propuesta (Argentina)**: el recibo interno no reemplaza la factura. En FOTOFFICE: (a) **recibo X / comprobante de pago** con CUIT/DNI y condición frente al IVA; (b) enlace a la **factura electrónica ARCA** (tipo, punto de venta, número, CAE y vencimiento de CAE, QR obligatorio); (c) monto en letras en pesos ("PESOS UN MIL… CON 50/100"); (d) numeración propia de recibos correlativa (Alboom usa el id interno).

---

## 10. Recordatorios de vencimiento y enlaces de pago

**Fuentes**: `v/views/settings/finance.html` (pestaña "Recordatorios de vencimiento"), `v/views/settings/categories.html` (tipo `payment`), `FinanceController.send_reminder`.

- **Manual**: botón "Correo electrónico" en cada cuenta por cobrar → abre redactor con plantilla `boleto_reminder` (categoría de plantillas "Financiero"). Campos combinables: empresa, correo, celular, nombre y apellido del cliente, número de pedido, tipo y número de documento, fecha de vencimiento, monto con moneda, **instrucciones de pago** (texto configurado en el método de pago) y **enlace de pago** (`{sitio}/pay/{id}` para PagSeguro 56 y PayPal 57, o boleto 52).
- **Automático** (configuración): "Activar recordatorio" Sí/No (`boleto_reminder`), "Días de antelación" (`boleto_reminder_days`), "Usuario predeterminado" (remitente, `default_reminder_user`). Sólo se envían para los métodos de pago con la columna **Recordatorio** activada. El envío lo hace un proceso del servidor: **No determinable estáticamente** (hora, reintentos, si también avisa vencidas).
- **Pasarelas**: PayPal (correo y código de moneda) y PagSeguro (sólo portugués). No hay integración de cobro real verificable en el frontend más allá del enlace `/pay/{id}`.

**Mejora propuesta**: recordatorios configurables **antes, el día y después** del vencimiento (escalonados), por correo **y WhatsApp**, con **link de pago de Mercado Pago** generado por cuota (Checkout Pro / link de pago) y **conciliación automática** por webhook. Registrar cada envío en el historial de la cuenta.

---

## 11. Cuentas Bancarias

**Fuente**: `v/views/banks/index.html`, `edit.html`, `detail.html`, `index_print.html`, `modal_delete.html`; `BanksController.getBankData`, `save`, `modalDelete`; endpoints `/banks/*`.

"Cuenta Bancaria" en Alboom abarca **bancos y cajas**: el tipo (*Type*) distingue Cuenta Bancaria (*Checking*, 1000), **Efectivo** (*Cash*, 1001), Cuenta Ahorro (*Savings*, 1002) y Otros (1003).

### 11.1 Listado
- Botones de filtro por tipo: Todos + los 4 tipos (el tipo va en la URL: `#/banks/index/{itemCategory}`). Búsqueda de texto ("Buscar en todos los campos incluyendo Campos Extras").
- **Columnas**: Nombre, Tipo, Activo, Número de cuenta (sucursal / número + nombre del banco), **Saldo hoy** (*Today Balance*), **Saldo** (incluye movimientos futuros, inferido), **Saldo Conc** (sólo conciliados).
- **Totales**: página (si hay más de una página) y total general de las tres columnas.
- **Acciones por fila**: Transacciones, Conciliación, Editar, Borrar (sólo si `transactions == 0`; si el servidor detecta movimientos responde `not_empty` y avisa "La cuenta bancaria {nombre} no fue borrada. La cuenta tiene transacciones").
- Clic en la fila abre el **panel lateral de detalle** (`banks.index.details`): datos del banco + widget "Últimas transacciones" (fecha, nombre, valor; scroll infinito; `POST /account_trans/list_transactions`).
- **Imprimir** (`#/print/banks/{itemCategory}/{searchTerm}`). No hay CSV.
- Existe `PUT /banks/set_active/:id/:active` (activar/desactivar) pero en la vista local no hay botón para ello (sólo columna ordenable): **verificar**.

### 11.2 Formulario (Nueva / Editar Cuenta Bancaria)
| Campo | Obligatorio |
|---|---|
| Nombre | sí |
| Tipo (Cuenta Bancaria / Efectivo / Cuenta Ahorro / Otros) | sí |
| Nombre Entidad Financiera | no |
| Número de ruta de banco (*Routing Number*; en Brasil "agencia") | no |
| Número de cuenta | no |
| Dirección, Teléfono, Gestor (*Account Manager*) | no |

**No hay campo de saldo inicial**: el saldo inicial se carga con un **Depósito** contra la cuenta "2.5.2 Ajuste del Saldo Inicial". Tampoco hay moneda por cuenta.

`views/banks/view.html` es una copia de la ficha de usuario (restos de código): no se usa realmente.

### 11.3 Mejora propuesta
- Tipos argentinos: **Caja (efectivo)**, **Cuenta bancaria** (CBU, alias, CUIT titular), **Mercado Pago** (billetera; saldo sincronizado por API), **Otra billetera** (Ualá, Naranja X…).
- **Saldo inicial** y **moneda** (ARS/USD) en el alta.
- Arqueo de caja (conteo físico vs. sistema).
- Estado Activo/Inactivo editable.

---

## 12. Transacciones

**Fuente**: `v/views/banks/list.html`, `transactions.html`, `transactions_print.html`, `modal_edit_transaction.html`, `modal_view_transaction.html`; `BanksController.loadTransactions`, `getTransactionsData`, `modalTransactions`; `POST /account_trans/paginate`.

### 12.1 Pantalla
- Columna izquierda (`list.html`): lista de cuentas con su **saldo** y **total** general; "Todos" muestra movimientos de todas las cuentas.
- **Filtros**: Filtrar por período (tabla general, default "Esta semana"), Usuario, Clase, Buscar (formato de fecha aaaa-mm-dd). Persisten en `$localStorage`.
- **Columnas**: Fecha, Cuenta (sólo en "Todos"), Doc/Tipo ("Transferencia" si es 74), Nombre/Memo (en transferencias, el nombre de la otra cuenta), **Valor**, **Saldo** (saldo corrido, calculado por el servidor), Usuario (avanzado), **Conc** (✓ si conciliado), acciones Ver/Editar/Borrar.
- **Primera fila**: "Saldo anterior" (saldo antes del período filtrado).
- Orden fijo por fecha (`account_trans.add_date`).
- **Botones** (sólo con una cuenta elegida): **Transferencia**, **Debito** (*Withdrawal*), **Deposito**, **Conciliar**, **Exportar en CSV** (`transactions.csv`), **Imprimir** (`#/print/bank_transactions/{data_type}/{id}/{period}/{start_date}/{end_date}/{searchTerm}`; columnas: Cuenta, Doc, Tipo, Nombre, Memo, Usuario, Valor, Saldo, Conc, Clase).

### 12.2 Modal de movimiento (Añadir / Editar / Borrar Transacción • Pago / Depósito / Transferencia)

| Campo | Depósito (72) | Débito (71) | Transferencia (74) |
|---|---|---|---|
| De / Para (contacto) | "De", obligatorio | "Para", obligatorio | — |
| Fecha | sí | sí | sí |
| Número de Documento | opcional | opcional | opcional |
| Cuenta destino / origen | — | — | selector de otras cuentas bancarias, obligatorio |
| Categoría (repetible con montos) | cuentas de **Ingresos** + "2.5.2 Ajuste del Saldo Inicial" | cuentas de **Costos + Gastos** | — (sólo "Valor") |
| Método de pago | obligatorio | obligatorio | obligatorio |
| Conciliado Sí/No | (no aparece dentro de la conciliación) | idem | idem |
| Clase | obligatoria si `classes_in_finances` | idem | idem |
| Descripción | opcional | opcional | opcional |

- Si el movimiento está **conciliado**, los campos se bloquean y aparece: "Esta es una transacción conciliada. Al editarla, su cuenta en Alboom CRM puede no reflejar su extracto bancario". Borrar una conciliada: sólo admin.
- Si el movimiento es un **cobro/pago de cuenta** (83/84) no se puede cambiar la categoría ni el contacto (hay que borrarlo y rehacer desde Cuentas por Cobrar/Pagar).
- Detalle de implementación: en una transferencia, el `customer_id` guarda **el id del banco destino** (reutiliza el campo del contacto).
- Existe `import_id` (muestra "Original" en vez de "Total"): indica movimientos **importados** (¿extracto OFX/CSV?). No hay pantalla de importación en la copia local: **No determinable estáticamente**.

### 12.3 Mejora propuesta
- **Importar extracto** (CSV de bancos argentinos, movimientos de Mercado Pago vía API) con sugerencia automática de coincidencias.
- Transferencias como entidad propia (origen, destino, comisión).
- Adjuntar comprobante a cada movimiento.
- Saldo por moneda y conversión USD/ARS con tipo de cambio del día.

---

## 13. Conciliación bancaria

**Fuente**: `v/views/banks/reconciliation.html`, `modal_reconc.html`, `modal_reconc_checked.html`; `BanksController.loadReconciliation`, `getReconciliationData`, `selectRow`, `modalReconc`; `POST /account_trans/batch_reconcile`.

1. Desde Transacciones → **Conciliar** (`#/banks/transactions/reconc/{id}`).
2. Texto de ayuda: comparar con el extracto del banco; cargar el saldo del extracto; marcar cada movimiento que aparece en el extracto; se pueden agregar, editar o borrar movimientos; para terminar la **Diferencia** debe ser 0.
3. Campos:
   - **Conciliado Anterior** (*Opening Balance*): sólo lectura, lo da el servidor (`reconc_balance`).
   - **Saldo en el Extracto** (*Ending Balance*): lo escribe el usuario (admite negativos).
   - **Conciliado Actual** (*Cleared Balance*): = conciliado anterior − suma de los importes tildados (convención de signos invertida).
   - **Diferencia** = extracto − conciliado actual (redondeo a centavos).
4. Tabla: todos los movimientos de la cuenta sin límite de página (inferido: sólo los **no conciliados**), ordenados por fecha; columnas Fecha, Doc/Tipo, Nombre/Memo, Valor, ☐, acciones. Se puede agregar Depósito/Débito/Transferencia sin salir.
5. **Finalizar Conciliación** se habilita sólo con Diferencia = 0 → confirmación "¡Felicitaciones! Su cuenta está conciliada. ¿Desea finalizar la conciliación y marcar N transacción(es) como conciliadas?" → `batch_reconcile` con `target = 1` → vuelve a Transacciones.
6. Existe además un modal "Estado de las transacciones" para cambiar en lote Conciliado Sí/No (`modalReconcChecked`), pero **no se ve el botón que lo abre** en las vistas locales.

No se guarda un "registro de conciliación" (fecha de corte, saldo del extracto): sólo se marcan movimientos. **No determinable estáticamente** si el servidor guarda algo más.

**Mejora propuesta**: guardar **sesiones de conciliación** (fecha de corte, saldo del extracto, usuario, movimientos incluidos) para poder auditarlas y deshacerlas; conciliación automática de Mercado Pago (cada operación trae su ID); matching sugerido por monto/fecha contra un extracto importado.

---

## 14. Costos → Cuentas por Pagar

**Fuente**: `v/views/orders/costs.html`, `orders/modal_costs.html` (también `leads/costs.html`, `products/costs.html`); `CostsController` (`loadCosts`, `addCost`, `saveAllCosts`, `modalItems`); servicio `Costs` (`GET/POST /costs/:type/:target_id`, `PUT /orders/set_cost_accounts/:id`); `GET/POST /products/costs/:id`, `/products/clone_costs/:from_id/:to_id`.

- Los **costos** existen en **productos** (plantilla), **oportunidades** y **pedidos**. Al agregar un producto al pedido se copian sus costos ("Origen: Producto #id"). Al editar el pedido se ofrece "**Recrear Costos**" (borra los editados y los regenera desde los productos).
- **Tabla de costos del pedido**: Proveedor, Cuenta (código – nombre, de **Costos o Gastos**: `Accounts.query({prefix:"4,5"})`), Descripción, Vencimiento, Valor, **Pagado** (avanzado), acciones (editar/borrar ocultas si ya está pagado). Total.
- **Modal de costo**: Proveedor (contacto, buscador), Cuenta (obligatoria), Descripción (obligatoria), Vencimiento, Valor (obligatorio, ≥ 0). En productos existe `cost_due_days` (días hasta el vencimiento, relativo a la fecha del pedido o del evento: **No determinable estáticamente**).
- **Generación de Cuentas por Pagar**: al guardar costos de un pedido en estado **Venta Completada (475)** o **Pedido Rápido (476)** se llama `set_cost_accounts`; el servidor crea una cuenta por pagar por cada costo **con vencimiento** (aviso en pantalla). El enlace costo↔cuenta por pagar permite mostrar "Pagado" (`cleared`).
- **Proyectos**: no se encontró pantalla de costos de proyecto en la copia local; los costos son de pedidos/oportunidades/productos.

**Mejora propuesta**: en FOTOFFICE los costos de una **cobertura/evento** (segundo fotógrafo, asistente, impresión, viáticos) deben generar la cuenta por pagar al proveedor al **confirmar** el trabajo (no al "completar"), con opción de pagar desde el mismo lugar y ver **margen por trabajo** (ingresos − costos) en tiempo real.

---

## 15. Pagos del pedido → Cuentas por Cobrar

**Fuente**: `v/views/orders/edit.html` (pestaña "Artículos y pagos"), `v/views/common/modal_payments.html`, `v/views/orders/payments.html`, `OrdersController.modalPays`, `updateTotalPay`.

- **Plan de pagos** en el pedido: tabla Vencimiento, Método de pago, Número de Documento, Memo, Valor, Pagado; total, "Cantidad que falta" (diferencia contra el total del pedido; considera IVA si no está incluido en el precio). Avisos: "El total de pagos es mayor que el total del pedido" / "no coincide con el total del pedido".
- **Modal "Datos de Pago"**: Método (obligatorio), Vencimiento (obligatorio), Número de Documento, **Número de pagos** (cuotas), **Intervalo de pagos** (misma tabla que la recurrencia), **% del Importe Total** o **Valor**, Memo. Genera N cuotas sumando el intervalo a la fecha; el número de documento se autoincrementa (si es numérico, +1; si no, "doc-2", "doc-3"…); la última cuota absorbe el redondeo (si queda < 1 de diferencia).
- Una cuota ya cobrada (`cleared = 1`) no se puede editar ni borrar.
- **Pestaña Pagos del pedido** (`payments.html`): Vencimiento, Método, Documento, Memo (o Banco en pedido rápido), Valor, **Estado** (✓ + fecha de cobro, en rojo si se cobró tarde), Imprimir Recibo; botón "Abrir Cuentas por Cobrar" del cliente.
- **Regla clave**: "Las cuentas por cobrar se crean automáticamente si el estado del pedido es Completado".

**Mejora propuesta**: en FOTOFFICE crear la cuenta por cobrar **al confirmar/señar** el trabajo (la seña es lo primero que se cobra en fotografía social), permitir **seña + saldo** como plantilla, y generar desde cada cuota la **factura ARCA** cuando se cobra (o cuando se emite, según configuración).

---

## 16. Configuración

### 16.1 Financiero (`v/views/settings/finance.html`, menú "Financiero › Recordatorios de vencimiento")
Pestañas:
1. **Recordatorios de vencimiento**: nota "Los recordatorios se enviarán sólo a los métodos de pago habilitados…"; Activar recordatorio (Sí/No), Días de antelación, Usuario predeterminado (obligatorio).
2. **Boleto Bancário** (sólo add-on): tokens de BoletoCloud.
3. **PayPal**: correo PayPal, código de moneda.
4. **PagSeguro** (sólo idioma pt_BR): correo, código de moneda.
5. **Restablecer datos del Financiero** (*Reset Finance Data*): "Esto BORRARÁ todos los datos financieros: transacciones de cuentas bancarias, cuentas por pagar, cuentas por cobrar. Esta operación no se puede deshacer." Botón "Sí, quiero BORRAR todos los datos del Financiero" + `confirm()` del navegador → `GET /settings/erase_finance` (sí, un GET destructivo).
Botones Deshacer / Guardar.

### 16.2 Plan de cuentas (`v/views/settings/chartaccounts.html`; menú "Plan de cuentas" con submenús **Ingresos** R, **Costos** C, **Gastos** D)
- Tabla Código / Nombre / Herramientas (editar, borrar, confirmar, cancelar). Botón Añadir.
- Validaciones (`addRowAccounts`, `saveRowAccounts`): el código sólo admite números y puntos; debe empezar con `3.` (Ingresos), `4.` (Costos) o `5.` (Gastos); mínimo 3 caracteres; no repetido; nombre obligatorio. Debe quedar al menos una cuenta.
- Los cambios se acumulan y se guardan con "Guardar" (`POST /accounts`, lote). Aviso "Se hicieron cambios en los datos. Por favor haga clic en Guardar" y "Deshacer".
- No se puede editar el grupo 1 (activos) ni 2 (pasivos) desde la interfaz. **No determinable** qué pasa al borrar una cuenta con movimientos.

### 16.3 Clases (`v/views/settings/classes.html`; menú Categorías › Clases)
Funcionan como **centros de costo / unidades de negocio**.
- "Activar" (Sí/No) `classes_active`.
- Campo obligatorio en: Calendario, Contactos, Oportunidades, Pedidos, Proyectos, **Financiero** (`classes_in_finances`).
- Lista de clases: nombre, activo/inactivo, ordenables arrastrando, bloqueadas (`locked`) no se pueden borrar.
- En Financiero, la clase se asigna por cuenta/movimiento y filtra listados, informe de Resultados y Diario.

### 16.4 Métodos de pago (`v/views/settings/categories.html` con `type=payment`)
- Nombre (los bloqueados no se renombran ni borran), **Instrucciones de pago** (texto que ve el cliente al pagar desde el Área del Cliente y que va en el recordatorio), **Recordatorio** (activa recordatorios automáticos), **¿Ocultar?** (oculta el método), orden arrastrable.
- Nota de la vista: "Algunos métodos de pago no se pueden borrar" (los que el sistema usa: boleto, PayPal, PagSeguro…).

### 16.5 Mejora propuesta
- Plan de cuentas **precargado para fotógrafos argentinos** (Ingresos: coberturas, sesiones, álbumes, impresiones, cursos; Costos: asistentes, laboratorio, álbumes; Gastos: equipos, software, publicidad, monotributo/IIBB, comisiones MP).
- Borrado "Restablecer" con **exportación previa obligatoria** y confirmación escrita; nunca por GET.
- Métodos de pago argentinos: Efectivo, Transferencia, Mercado Pago, Tarjeta (vía MP/posnet), Cheque/e-cheq, Dólares.

---

## 17. Informes

Todos usan `ReportsController` y endpoints `POST /reports/*`. Las impresiones van a `#/print/reports/{link}/…` con plantillas `views/reports/print_{link}.html` que **no están en la copia local** (No determinable su diseño). Los filtros de informes se guardan en `$localStorage` (`report_period`, `report_start_date`, `report_end_date`, `report_class`, `type`, `report_cashflow_group_by`, `report_cashflow_period`, `report_sales_group_by`).

### 17.1 Resultados (Estado de resultados) — `finance_results.html`, `POST /reports/results`

- **Propósito**: ingresos − costos − gastos por mes.
- **Controles**: **Base Devengada** (*Accrual Basis*, default) vs **Base de Efectivo** (*Cash Basis*); Filtrar por período (Este mes [default], Último mes, Últimos 3 meses, Últimos 6 meses, Este año, Último año, Otro período); Clase (Todos o una).
- **Parámetros**: `type` (accrual/cash), `group: "month"`, `period`, `start_date`, `end_date`, `class_id`.
- **Estructura** (matriz cuentas × meses, `report_data`): bloque **Entrandas/Ingresos** (filas = cuentas 3.x con código y nombre), fila Total; bloque **Costos** (4.x), Total; bloque **Gastos** (5.x), Total; fila final **Saldo** = Ingresos − Costos − Gastos por mes y total (rojo si negativo). Costos y gastos se muestran en positivo (`-1*`).
- **Cómo se calcula (inferido)**:
  - *Devengada*: suma las líneas `x_account_trans` de cada cuenta del plan según la **fecha de emisión** (`add_date`) de la cuenta por cobrar/pagar, se haya cobrado o no.
  - *Efectivo*: suma sólo lo **cobrado/pagado** (movimientos de banco 83/84/71/72) según la **fecha del movimiento**, imputado a la cuenta del plan de la cuenta original.
  - Diferencias de cobro (descuentos, intereses) aparecen en 3.2 / 5.6 / 5.7.
- **Desglose**: cada celda es un enlace al **Diario** filtrado por cuenta + mes + base + clase.
- **CSV** (`results.csv`) e **Imprimir**.

### 17.2 Resultados de Ventas — `finance_sales_results.html`, `POST /reports/sales_results` (sólo add-on avanzado)
Igual que Resultados pero **sólo lo vinculado a pedidos** (desglose al diario con `category: 'sales'`), filas sin código de cuenta, **default Base de Efectivo**. Aviso: los datos en base de efectivo anteriores al 09/12/2016 pueden tener divergencias.

### 17.3 Diario / Libro diario — `finance_journal.html`, `POST /reports/journal`
- Se llega **sólo desde los informes** (no está en el menú). URL `#/reports/journal/{type}/{subtype}/{category}/{period}/{account}/{start_date}/{account_name}/{class_id}`.
- Encabezado: Diario • Base • Cuenta (o Categoría si es de ventas): código y nombre • Período (mes).
- **Buscar** (texto, aaaa-mm-dd para fechas).
- **Columnas**: Emisión, Vencimiento, Doc y Tipo (no en ventas), **Cuenta** bancaria (sólo base efectivo), Pedido (enlace), Nombre (tarjeta de contacto), Memo, Valor. Ordenables.
- Totales de página y general; paginación; **CSV** (`journal.csv`); Imprimir.
- No es un libro diario contable completo (no muestra debe/haber de cada asiento), es el **detalle de movimientos** que forman una celda.

### 17.4 Flujo de caja — `finance_cashflow.html`, `POST /reports/cashflow`
- **Propósito**: proyección de caja **hacia adelante**.
- **Agrupar por**: Día / Semana / Mes (default Mes). **Período**: Todos (default), 7 días, 1 Mes, 3 Meses, 6 Meses, Un año, Otro período (el selector **no permite fechas pasadas**: si se elige una, se reemplaza por hoy).
- **Columnas**: En (fecha/semana "Semana N/AAAA"/mes), **Bancos** (saldo de las cuentas bancarias), **Por cobrar**, **Por pagar**, **Total**, **Saldo acumulado**.
- **Primera fila "Saldo anterior"**: saldo actual de bancos + cuentas **vencidas** por cobrar y por pagar (enlaces a la lista filtrada "Pendientes/Vencidas").
- **Cálculo (inferido)**: para cada período, suma de vencimientos pendientes por cobrar (+) y por pagar (−) y movimientos bancarios futuros; `Total = Bancos + Por cobrar − Por pagar`; `Saldo acumulado` = acumulado anterior + total.
- **Desglose** (avanzado): cada importe abre la lista de Por cobrar / Por pagar de ese día/semana/mes.
- CSV (`cashflow.csv`) e Imprimir.

### 17.5 IVA — `vat.html`, `POST /reports/vat`
- Visible si `vat_active == 1` (menú "Informes de VAT").
- Período (tabla de resultados). Filas = **pedidos** (#id, nombre), columnas = meses, total por fila/columna. El agrupador está comentado en el HTML (no funciona).
- Cálculo (inferido): suma del IVA (`vat_total`) de los pedidos por mes. No hay IVA de compras (crédito fiscal).
- CSV (`sales_reports.csv`) e Imprimir.

### 17.6 Informes de pedidos (Ventas) — `sales.html`, `sales_details.html`, `POST /reports/sales`, `/reports/sales_details`
- **Agrupar por**: Vendedor, **Producto** (default), Cliente, Referente, Origen de la oportunidad, Clase (avanzado), Categoría de Producto, Categoría de Presupuestos, Etiqueta de Pedidos, Etiqueta de Vendedores. Período (tabla de resultados).
- Matriz grupo × meses con totales; cada celda abre **Detalle**: lista de pedidos (#, Emisión, Nombre + cliente, Fecha del trabajo/evento, Categoría, Total, Vendedor), buscador, orden, paginación, totales, imprimir.
- Nota: por Producto y Categoría de Producto **no se descuentan** los descuentos del pedido.

### 17.7 Oportunidades Ganadas — `opportunities.html`, `opportunities_details.html` (contexto)
- Agrupar por Vendedor (default), Cliente, Origen de la oportunidad (cuenta cantidades, sin decimales), Ventas por origen, Categoría de Presupuestos; avanzados: Referente, Clase, Etiqueta de Oportunidades, Etiqueta de Vendedores. En plan gratuito sólo se puede abrir el detalle del mes actual.
- Usa el campo "Importe" de oportunidades en estado "Ganado". Detalle: #, Emisión, Fecha de cierre, Nombre, Fecha del evento, Categoría, Importe, Vendedor.

### 17.8 Mejora propuesta (informes)
- **Tablero financiero** único: por cobrar vencido, a vencer 7/30 días, caja disponible por cuenta, resultado del mes vs. mes anterior, margen por trabajo.
- Resultados con **comparativo interanual** y por **centro de costo** en columnas.
- **Flujo de caja** con escenario (qué pasa si X no paga) y saldo mínimo de alerta.
- **Libro IVA Ventas / Compras** compatible con ARCA (Libro IVA Digital) a partir de facturas electrónicas, no de pedidos; resumen para **monotributistas** (facturación acumulada 12 meses vs. tope de categoría).
- Informe de **morosidad** y de **medios de pago** (cuánto entra por MP, transferencia, efectivo; comisiones pagadas).

---

## 18. Vistas embebidas

| Dónde | Vista | Qué muestra |
|---|---|---|
| Ficha de contacto › pestaña Por cobrar | `contacts/ar.html` (`loadAPRByContact('ar')`, `GET /account_trans/apr_contact/ar/{id}/{offset}/{count}`, scroll infinito de a 50) | Vencimiento (color), Pedido, Tipo, Doc, Memo, Valor, ícono Recordatorio; botón "Abrir Cuentas por Cobrar" |
| Ficha de contacto › Recibidas | `contacts/ar_paid.html` | Fecha, Pedido, Tipo, Doc, Memo, Valor, Imprimir Recibo (enlace **sin** clave: `#/print/receipt/{id}`) |
| Ficha de contacto › Por pagar / Pagadas | `contacts/ap.html`, `ap_paid.html` | ídem para proveedores |
| Ficha de usuario › AR/AP | `users/ar.html` (en la copia local es un **404**), `users/ap.html` | No determinable |
| Pedido › Pagos | `orders/payments.html` | §15 |
| **Área del Cliente** (rol `contact`) › "Por pagar" / "Pagado" | `dashboard/ar.html`, `ar_paid.html` (visibles si `customer_area_ar == 1`, configurable en Configuración › Área del cliente › "Mostrar Cuentas por Cobrar") | El cliente ve sus cuotas: Fecha, Pedido, Tipo, Doc, Memo, Valor; botones "Ver instrucciones" (texto del método de pago), "Pagar con PagSeguro"/"Pagar con PayPal" (`/pay/{id}`), descarga de boleto; en pagadas, "Imprimir Recibo" |
| Widget de banco | `widgets/transactions.html` | Últimas transacciones de la cuenta |
| `widgets/projection_print.html` | — | **No es financiero**: proyección de plazos de etapas de proyectos (Etapa, Días, Fecha estimada). Se menciona sólo porque fue asignado |

**Mejora propuesta**: portal del cliente de FOTOFFICE con **"Pagar ahora" con Mercado Pago** por cuota, datos de transferencia (CBU/alias) con botón "Informar pago" (sube comprobante → queda "a verificar"), y descarga de facturas ARCA y recibos.

---

## 19. Boletos bancarios (Brasil)

Mencionado por completitud; **irrelevante para Argentina**. Con `addon_boleto == 1` y método de pago 52: botones "Gerar Boleto" (`GET /boleto_set/:id` vía BoletoCloud), "Download do Boleto" (`/api/boleto_get/{token}`), "Gerar Arquivo de remessa" (`GET /api/boleto_remessa`) y "Processar Arquivo de Retorno" (`POST /api/boleto_retorno`, archivo ≤ 7,5 MB). Estados `boleto_status`: 0 no generado, 1 generado, 2 registrado en el banco, 3 pagado (por archivo de retorno), 4 pagado con monto distinto. Al cobrar un boleto pagado se precarga el monto y fecha informados por el banco. Existen también `/banks/boleto_sets` y `/accounts/boleto_set/:id`.

**Equivalente argentino**: link/QR de Mercado Pago por cuota con webhook (cumple el mismo rol: generar el cobro y conciliarlo automáticamente).

---

## 20. Endpoints

Todos relativos a `SERVER_URL` (servicios `$resource` en `app.js`; lista en `endpoints.txt`).

| Método | Ruta | Uso |
|---|---|---|
| POST | `/account_trans` | alta de asiento `{trans, x_trans}` (devuelve array con id) |
| GET | `/account_trans/:id` | un asiento: `{account_trans, x_account_trans, ref_account_trans}` |
| PUT | `/account_trans/:id` | edición `{trans, x_trans}` |
| DELETE | `/account_trans/:id` | borrar |
| POST | `/account_trans/paginate_apr` | listas Por cobrar/pagar/Recibidas/Pagadas (`type` ar, ap, ar_paid, ap_paid) → `{rows, count, total}` |
| POST | `/account_trans/paginate_apr_customer` | Por cliente/proveedor → `{rows, count, total_apr, total_apr_paid}` |
| POST | `/account_trans/paginate` | Transacciones y Conciliación → `{rows, count, previous_balance, reconc_balance}` |
| POST | `/account_trans/list_transactions` | widget últimas transacciones |
| GET | `/account_trans/apr_contact/:type/:id/:offset/:count` | pestañas del contacto y área del cliente |
| POST | `/account_trans/clear_apr` | cobrar / pagar `{trans, account, mode}` → `{trans_id, account_trans}` |
| POST | `/account_trans/batch_edit` | edición masiva `{rows, mode, <campo>}` |
| POST | `/account_trans/batch_delete` | borrado masivo `{rows:[{id}]}` |
| POST | `/account_trans/batch_reconcile` | conciliación `{rows:[{id}], target: 0/1}` |
| GET | `/account_trans/get_receipt/:id` | datos del recibo (id.clave) |
| GET | `/account_trans/amount_in_words/:value/:lang` | monto en letras |
| PUT | `/account_trans/set_date/:id` | cambiar fecha (sin uso visible) |
| GET | `/accounts?subtype=R|C|D` | cuentas del plan por tipo (Configuración) |
| POST | `/accounts` | guardar lote del plan de cuentas |
| GET | `/accounts/list/:id/:type` | subárbol (`type=all-down`) para selectores |
| GET | `/accounts?prefix=4,5` | cuentas para costos |
| GET/POST/PUT/DELETE | `/banks`, `/banks/:id` | CRUD de cuentas bancarias (DELETE responde `ok` o `not_empty`) |
| POST | `/banks/paginate` | listado → `{rows, count, total, total_today, reconciled_total}` |
| GET | `/banks/list/:type` | lista simple (con `balance`, `account_code`) |
| GET | `/banks/info/:id`, `/banks/get_by/:field/:value` | info / buscar por campo (p. ej. `account_code`) |
| PUT | `/banks/set_active/:id/:active` | activar/desactivar |
| GET/POST | `/banks/boleto_sets[/:id]` | Brasil |
| GET/POST | `/costs/:type/:target_id` | costos de pedido/oportunidad |
| PUT | `/orders/set_cost_accounts/:id` | generar cuentas por pagar de los costos |
| GET/POST | `/products/costs/:id`, `/products/clone_costs/:from/:to` | costos de producto |
| GET | `/categories/list?type=payment|class` | métodos de pago y clases |
| POST | `/reports/results`, `/sales_results`, `/journal`, `/cashflow`, `/vat`, `/sales`, `/sales_details`, `/opportunities`, `/opportunities_details` | informes (todos aceptan `csv_mode` y `language`) |
| GET | `/settings/erase_finance` | borrar todo el financiero |
| GET/POST | `/settings/` | configuración (recordatorios, PayPal, clases, etc.) |
| GET | `/settings/due/:id/:type` | **no es financiero**: contadores de vencimientos del tablero (proyectos, oportunidades, pruebas) |
| GET/POST | `/boleto_set/:id`, `/boleto_remessa`, `/boleto_retorno` | Brasil |

---

## 21. Modelo de datos inferido

> Nombres de campo tomados del código; tipos y claves **inferidos**.

**account_trans** (cabecera de asiento)
`id`, `account_id` (código de cuenta: 1.1.x / 1.2.x / 2.1), `category_id` (71–84, §2.4), `customer_id` (contacto; en transferencias = id del banco destino), `order_id`, `order_payment_id`, `add_date` (emisión / fecha del movimiento), `due_date` (vencimiento), `amount` (con signo), `document_type_id` (método de pago), `document_number`, `memo`, `class_id`, `cleared` (0/1), `user_id`, `modified`, `created`, `trans_seq_id` (serie recurrente, inferido), `referer_id` (asiento relacionado, inferido), `import_id` (importación), `payment_interval`, `payment_number`, `recurrent`, `receipt_key`, `boleto_*` (Brasil). Campos calculados en respuestas: `document_type_name`, `customer_name/lastname/email/email2/phone/cellular/city/state/country/company/cpf`, `user_name/lastname/avatar`, `balance` (saldo corrido), `total`, `future_trans`, `order_status_id`, `payment_instructions`, `remind`, `class`.

**x_account_trans** (líneas)
`id` (inferido), `trans_id` (inferido), `account_id` (cuenta del plan u otra cuenta bancaria), `amount`, `cleared`, `customer_id` (en transferencias). Respuesta incluye `account_name`.

**accounts** (plan de cuentas)
`id` (= código, p. ej. "3.1.2"), `name`, `type` ("R" en el alta: probablemente "resultado"), `subtype` (R ingresos / C costos / D gastos), `id_name` (código – nombre, calculado).

**banks** (cuentas bancarias y cajas)
`id`, `name`, `category_id` (1000 cuenta corriente, 1001 efectivo, 1002 ahorro, 1003 otros), `bank_name`, `bank_agency`, `bank_account_number`, `bank_address`, `bank_phone`, `bank_account_manager`, `active`, `created`, `created_by`, `modified`, tags. Calculados: `account_code` ("1.1."+id), `balance`, `total_today`, `reconciled_balance`, `transactions` (cantidad).

**categories** (tipo `payment` = métodos de pago; tipo `class` = clases)
`id`, `name`, `type`, `message` (instrucciones de pago), `active` (en pagos = recordatorio activo), `hide`, `locked`, orden.

**order_payments** (cuotas del pedido)
`id`, `order_id`, `due_date`, `category_id` (método), `document`, `memo`, `value`, `cleared`, `cleared_date`, `deleted`, `charge_issued`, `bank` (pedido rápido), `receipt_id`, `receipt_key`, `boleto_*`.

**costs** (costos de pedido/oportunidad/producto)
`id`, `type` (orders/leads/products), `target_id`, `name`, `vendor_id` (+ nombre/email), `account_cogs_id` (+ nombre), `cost`, `discount`, `total`, `due_date`, `cost_due_days`, `cleared`, `product_id`, `product_cost_id`.

**settings (finanzas)**
`boleto_reminder`, `boleto_reminder_days`, `default_reminder_user`, `paypal_email`, `paypal_currency_code`, `pagseguro_email`, `pagseguro_currency_code`, `boleto_token_api_user`, `boleto_token_api_banco`, `classes_active`, `classes_in_{calendar,contacts,leads,orders,projects,finances}`, `customer_area_ar`, `vat_active`, `csvSeparator`, `csvDecimalSeparator`, `default_pay_message_{metodo}`, datos de empresa para recibos (`company`, `cnpf`, `address1/2`, `zipcode`, `city`, `state`, `signature`, `logo_print`, `logo_print_hpos`).

**Permisos de usuario**: `modules.finance`, `user_finance`, `user_finance_create`, `user_finance_delete`, `user_reports`.

**Migración a FOTOFFICE — correspondencias sugeridas**
- `account_trans` con `category_id` 73/80/81 → **Cuenta por cobrar (cuota)**; 82 (y costos) → **Cuenta por pagar**; 83 → **Cobro** aplicado a la cuenta referida (`ref_account_trans`); 84 → **Pago**; 71/72 → **Movimiento de caja/banco** con categoría; 74 → **Transferencia**.
- `x_account_trans` → **imputación** a categoría del plan (y a centro de costo por `class_id`).
- `banks` → **Cajas y cuentas** (mapear 1001 a "Caja").
- Cobros parciales: reconstruir la cadena de cuentas generadas por "depósito parcial" (memo) para volver a unirlas en **una** cuota con varios pagos.
- Validar: suma de líneas = cabecera; signos; cuentas con `cleared=1` sin cobro asociado (posibles datos inconsistentes).

---

## 22. Errores y rarezas

1. **Cuenta contable mal asignada** en alta de AR con métodos distintos de 52/51/63: el código escribe `$account_id="1.2.9"` (variable equivocada), así que queda en `1.2` (`app.js`, `FinanceController.modalAPR`).
2. `finance.ap_suppliers` tiene URL `/ap_ap_suppliers` (duplicado); el menú marca activo `finance.ap_customers`, que no existe.
3. Persistencia **compartida** en `$localStorage` (`sortBy`, `period`, `class_id`, `start_date`) entre Por cobrar, Recibidas, Bancos: un filtro de una pantalla "se filtra" a otra.
4. `loadAPRPaid` invierte el orden con `!$localStorage.reverseSort || …`, que siempre da `true` (descendente) al entrar a la pantalla.
5. En Flujo de caja, el desglose por **Semana** calcula el inicio con `startOf("month")` en vez de `startOf("week")`.
6. `sales_details` y `opportunities_details` abren `leads.view` (oportunidad) incluso para pedidos.
7. Enlace de recibo en la ficha del contacto (`contacts/ar_paid.html`) sin `receipt_key` → probablemente "no encontrado".
8. "Restablecer datos del Financiero" usa **GET** para un borrado masivo.
9. `views/banks/view.html` es una copia de la ficha de usuario; `users/ar.html` y `reports/sales_results.html` devuelven 404 en la copia local.
10. El total del listado usa `Math.abs`, ocultando cuentas con signo invertido.
11. Filtro "Tipo" guarda `$localStorage.doc_type` pero al entrar siempre arranca en "Todos".

---

## 23. Propuesta global para FOTOFFICE

1. **Un modelo simple por encima, partida doble por debajo**: el usuario ve "Cuotas por cobrar", "Cuentas por pagar", "Cobros", "Pagos", "Cajas y cuentas"; internamente cada operación genera imputaciones para que los informes (resultados, flujo) salgan solos.
2. **Cuota con saldo**: una cuenta por cobrar admite N cobros parciales (y un cobro puede cubrir N cuotas). Estados: pendiente, parcial, saldada, vencida (calculado), anulada.
3. **Medios de pago argentinos** con comportamiento propio:
   - *Mercado Pago*: link/QR por cuota; webhook que registra el cobro, la **comisión** (gasto automático) y el neto acreditado en la cuenta "Mercado Pago"; conciliación automática.
   - *Transferencia*: datos CBU/alias en el portal; "informar pago" con comprobante; verificación por el estudio.
   - *Efectivo*: caja con arqueo.
   - *Tarjeta/cuotas*: vía MP; diferenciar fecha de cobro y fecha de acreditación.
   - *Dólares*: moneda por cuenta y tipo de cambio.
4. **Facturación ARCA** integrada: emitir factura C (monotributo) o A/B (responsable inscripto) desde la cuota o el cobro; guardar CAE; nota de crédito al anular; Libro IVA a partir de comprobantes.
5. **Costos por trabajo** (cobertura/evento) que generan cuentas por pagar al confirmarse, con margen visible.
6. **Recordatorios** escalonados por correo y WhatsApp con link de pago.
7. **Portal del cliente** con cuotas, pagos, facturas y recibos.
8. **Informes**: resultados (devengado/percibido) por mes y centro de costo, flujo de caja proyectado, morosidad, medios de pago, tope de monotributo.
9. **Auditoría y permisos finos**; anular en vez de borrar; nada destructivo sin exportación previa.
10. **Importación** desde Alboom respetando §21 (con reporte de inconsistencias).

---

## 24. Dudas a verificar en vivo

1. ¿Qué cuentas trae el **plan de cuentas inicial** (nombres de 1.x, 2.x, 3.2, 5.6, 5.7, 2.5.2)?
2. ¿Cuándo exactamente se crean las cuentas por cobrar del pedido (al pasar a "Venta Completada" y/o al guardar)? ¿Qué pasa si luego se edita el plan de pagos o se cancela el pedido? ¿Qué `category_id` reciben (73 confirmado)?
3. ¿Qué significa `category_id = 80`?
4. ¿Qué nombres tienen los métodos de pago 51 y 63 y cuál es la lista inicial de métodos?
5. ¿El período de "Por cobrar" filtra por **vencimiento** o por emisión?
6. ¿Cómo se ven y qué campos tienen los modales de edición masiva (`modal_add_date_checked`, etc.)?
7. ¿Qué columnas trae cada **CSV** (cuentas, transacciones, informes)?
8. ¿Base devengada vs. efectivo: con qué fecha imputa cada una? ¿Incluye transferencias y ajustes de saldo inicial?
9. ¿La conciliación trae sólo movimientos no conciliados? ¿Se guarda algún registro de la conciliación?
10. ¿Cómo funcionan los **recordatorios automáticos** (hora, vencidas, frecuencia)? ¿Se registran en actividades?
11. ¿Qué hace "Crear Retroactivo" (`user_finance_create`)?
12. ¿Cómo se generan las cuotas **recurrentes** (todas juntas o una por vez)? ¿Se pueden editar en serie?
13. ¿Existe importación de extractos (`import_id`)? ¿Dónde?
14. `cost_due_days` de los costos de producto: ¿días desde la fecha del pedido o del evento?
15. ¿Cómo se ven las impresiones de informes (`print_*.html`)?
16. ¿Qué pasa al borrar una cuenta del plan que tiene movimientos?
17. ¿Existe botón para activar/desactivar cuentas bancarias y para cambiar el estado de conciliación en lote?
18. ¿Cómo muestra el Área del Cliente el pago y qué hace `/pay/{id}` para métodos sin pasarela?
