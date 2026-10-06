# 02 · Presupuestos, Pedidos, Productos y Facturas (Alboom CRM)

> Análisis funcional **estático** (sin navegador ni internet) del panel AngularJS de Alboom CRM, para replicarlo mejorado en FOTOFFICE y migrar datos.
> Fuentes: carpeta de análisis `A/` = `scratchpad/alboom/`. Se cita siempre el archivo de origen:
> - `app.js` → código minificado (se indica el controlador o servicio: `QuotesController`, `OrdersController`, `ProductsController`, `CostsController`, `InvoicesController`, `ReportsController`, `SettingsController`, `MainController`, `LeadsController`, `MailsController`, fábricas `$resource` `Quotes`, `Orders`, `Products`, `Costs`, `Invoices`, `Reports`, `Settings`).
> - `v/views/...` → plantillas HTML.
> - `endpoints.txt`, `es.json`, `settings_menu.txt`.
>
> Convención: los nombres de pantalla y campos van **en español tal como los ve el usuario** (tomados de `es.json`), con el inglés entre paréntesis la primera vez. "**No determinable estáticamente**" = depende del servidor o de datos que no están en los archivos.

---

## Índice

0. [Resumen ejecutivo](#0-resumen-ejecutivo)
1. [Mapa de navegación y permisos](#1-mapa-de-navegación-y-permisos)
2. [Catálogos / tablas fijas del sistema](#2-catálogos--tablas-fijas-del-sistema)
3. [Presupuestos (Quotes)](#3-presupuestos-quotes)
4. [Ítems: el modal "Detalles del Producto" y el cálculo de totales](#4-ítems-el-modal-detalles-del-producto-y-el-cálculo-de-totales)
5. [Pedidos (Orders)](#5-pedidos-orders)
6. [Pedido Rápido (Express Order)](#6-pedido-rápido-express-order)
7. [Pagos del pedido → Cuentas por Cobrar](#7-pagos-del-pedido--cuentas-por-cobrar)
8. [Costos (de producto, de pedido, de oportunidad) → Cuentas por Pagar](#8-costos--cuentas-por-pagar)
9. [Productos / Servicios, Paquetes y Lista de precios](#9-productos--servicios-paquetes-y-lista-de-precios)
10. [Facturas (Invoices) e IVA](#10-facturas-invoices-e-iva)
11. [Informes de ventas e IVA](#11-informes-de-ventas-e-iva)
12. [Impresiones y enlaces públicos](#12-impresiones-y-enlaces-públicos)
13. [Configuración relacionada](#13-configuración-relacionada)
14. [Correos, WhatsApp, actividades y notificaciones](#14-correos-whatsapp-actividades-y-notificaciones)
15. [Estados y transiciones](#15-estados-y-transiciones)
16. [Relaciones entre entidades](#16-relaciones-entre-entidades)
17. [Modelo de datos inferido](#17-modelo-de-datos-inferido)
18. [API: operaciones por recurso](#18-api-operaciones-por-recurso)
19. [Defectos y rarezas detectadas en Alboom](#19-defectos-y-rarezas-detectadas-en-alboom)
20. [Mejoras propuestas para FOTOFFICE](#20-mejoras-propuestas-para-fotoffice)
21. [Dudas para verificar en vivo](#21-dudas-para-verificar-en-vivo)

---

## 0. Resumen ejecutivo

- **Presupuesto (Quote)** siempre nace de una **Oportunidad (Opportunity / lead)**. No tiene estado propio: sólo registra *Enviado* (`sent_date`) y *Visto* (`viewed`). Una vez visto por el cliente ya no se puede editar (sólo clonar). La vista pública **no tiene botón de aceptar/rechazar**. (`v/views/quotes/*.html`, `app.js` QuotesController)
- **Pedido (Order)** es la venta confirmada. Estados: *Abierto* (471), *Cancelado* (474), *Venta Completada* (475) y *Pedido Rápido* (476, venta de mostrador ya cobrada). (`app.js` MainController `AppTables.order_status`)
- El pedido reúne **ítems**, **plan de pagos** (que se convierte en **Cuentas por Cobrar** al pasar a *Venta Completada*), **costos** (que generan **Cuentas por Pagar** si tienen vencimiento), **contratos**, **proyectos** y **citas** (estos dos se crean automáticamente según la configuración de cada producto). (`v/views/orders/payments.html`, `costs.html`, `projects.html`, `events.html`)
- **Producto** puede ser simple o **Paquete (Package / pack)**; lleva precio, precio mínimo opcional, cuenta contable de venta, costos-plantilla y reglas para crear proyecto y cita automáticos. (`v/views/products/edit.html`)
- **Lista de precios** pública por enlace único del estudio. **Facturas** sólo existen si se activa IVA; la anulación genera una factura negativa. (`v/views/products/pricelist_print*.html`, `v/views/invoices/*`)

---

## 1. Mapa de navegación y permisos

### 1.1 Menú lateral (`v/views/common/navigation.html`)

| Menú | Opción (es / en) | Destino (estado ui-router) | Condición |
|---|---|---|---|
| Oportunidades | Presupuestos (Quotes) | `quotes.index` | módulo ventas (`AppUser.modules.sales == 1`), rol user o admin |
| Productos (Products) | Crear Nuevo (Create New) | `products.new` | sólo admin |
| Productos | Productos | `products.index` | sólo admin |
| Productos | Lista de precios (Price list) | `print.pricelist({unique_id: AppSettings.unique_id})` (pestaña nueva) | módulo ventas |
| Pedidos (Orders) | Crear Nuevo | `orders.new` | `resources.check('order_creation_allowed')` y (`user_sales_create==1` o admin). Si el plan no lo permite, muestra corona y abre modal de plan (`proResourceModal('order_add','plan_limit')`) |
| Pedidos | Pedido Rápido (Express Order) | `orders.express` | `user_sales_create==1` o admin |
| Pedidos | Mis Pedidos (My Orders) | `orders.index({itemUser: AppUser.id})` | — |
| Pedidos | Todos los pedidos (All Orders) | `orders.index({itemUser:'all'})` | `user_access_itens_only==0` o admin |
| Pedidos | Mis Contratos / Todos los Contratos | `agreements.index` | (módulo contratos, otro documento) |
| Pedidos | Informes (Reports) | `reports.sales` | (`user_reports==1` o admin) **y IVA desactivado** |
| Pedidos | Informes → Informes de pedidos (Orders reports) / Informes de VAT (VAT reports) | `reports.sales` / `reports.vat` | (`user_reports==1` o admin) **y IVA activado** |
| Pedidos | Facturas (Invoices) | `invoices.index({itemPeriod:'all'})` | IVA activado (`AppSettings.vat_active == 1`) |
| Área de Cliente (rol contacto) | Presupuestos / Pedidos | `index.dashboard.quotes` / `index.dashboard.orders` | líneas 905 y 916 de `navigation.html`; visibles según Configuración → Área de Clientes → "Mostrar Presupuestos"/"Mostrar Pedidos" (`v/views/settings/customer_area.html`) |

### 1.2 Estados (rutas) — `app.js` bloque `.state(...)`

| Estado | URL | Plantilla | Restricción |
|---|---|---|---|
| `quotes` | `/quotes` | `views/common/content.html` | usuario con `modules.sales == "1"` |
| `quotes.index` | `/index/{itemUser}` (def. `all`) | `views/quotes/index.html` | |
| `quotes.index.details` | `/details/:id` | `views/quotes/detail.html` (**404: plantilla no disponible**) | |
| `quotes.index.print` | `/print` | `views/quotes/index_print.html` (**404**) | |
| `quotes.new` | `/new?lead_id` | `views/quotes/edit.html` | |
| `quotes.edit` | `/edit/:id` | `views/quotes/edit.html` | |
| `quotes.clone` | `/clone/:from_id` | `views/quotes/edit.html` | |
| `quotes.view` | `/view/:id` | `views/quotes/view.html` | |
| `orders` | `/orders` | content | `modules.orders == "1"` |
| `orders.dashboard` | `/orders/dashboard` | `views/orders/index.html` | |
| `orders.index` | `/index/{itemCategory}/{itemUser}/{itemPeriod}/{itemPeriodJob}/{itemClass}` + params ocultos `itemStartDate`, `itemEndDate` | `views/orders/index.html` | |
| `orders.index.details` | `/details/:id` | `views/orders/detail.html` (panel lateral) | |
| `orders.view` (+ `.agreements`, `.items`, `.payments`, `.costs`, `.projects`, `.events`) | `/view/:id/...` | `views/orders/view.html` y pestañas | |
| `orders.edit` | `/edit/{id}` | `views/orders/edit.html` | |
| `orders.new` | `/new?customer_id&quote_id&lead_id` (+ `from_id` oculto para clonar) | `views/orders/edit.html` | |
| `orders.express` | `/new/express?customer_id&quote_id&lead_id` (+ `from_id`, `express_clone`) | `views/orders/express_edit.html` | |
| `orders.editExpress` | `/edit/express/{id}` (+ `express_edit`) | `views/orders/express_edit.html` | |
| `invoices` / `invoices.index` | `/invoices/index/{itemPeriod}` (+ `itemStartDate`, `itemEndDate`) | `views/invoices/index.html` | `modules.orders == "1"` |
| `products` | `/products` | content | **sólo admin** y `modules.sales=="1"` |
| `products.index` | `/index/{itemCategory}` | `views/products/index.html` | |
| `products.index.details` | `/details/:id` | `views/products/detail.html` (es una copia de la ficha de usuario, ver §19) | |
| `products.index.print` | `/print` | `views/products/index_print.html` (**404**) | |
| `products.new` | `/new?product_id` (clonar si viene `product_id`) | `views/products/edit.html` | |
| `products.edit` / `products.clone` | `/edit/:id` / `/clone/:from_id` | `views/products/edit.html` | |
| `products.view` (+ `.orders`, `.customers`, `.quotes`) | `/view/:id/...` | `views/products/view.html` y sub-vistas | |
| `reports.sales` | `/sales/{link}` | `views/reports/sales.html` | |
| `reports.sales_details` | `/sales_details/{group}/{start_date}/{id}/{name}` | `views/reports/sales_details.html` | |
| `reports.vat` | `/vat/{link}` | `views/reports/vat.html` | |
| `print.quote` | `/quote/:unique_id` | `views/quotes/view_print.html` | **pública** (`restrict: true`) |
| `print.quotes` / `print.quotes_summary` | `/quotes/{itemCategory}/{itemUser}/{sortBy}/{reverseSort}/{searchTerm}` | `index_print(_summary).html` (**404**) | módulo ventas |
| `print.order` | `/order/:unique_id` | `views/orders/view_print.html` | **pública** |
| `print.orders` / `print.orders_summary` | `/orders(_summary)/{itemCategory}/{itemUser}/{itemClass}/{sortBy}/{reverseSort}/{searchTerm}/{itemPeriod}/{itemPeriodJob}/{itemStartDate}/{itemEndDate}` | `views/orders/index_print(_summary).html` | módulo pedidos |
| `print.invoice` | `/invoice/:id` (id numérico) | `views/invoices/view_print.html` | **pública** |
| `print.invoices_summary` | igual patrón que pedidos | `views/invoices/index_print_summary.html` | |
| `print.pricelist` | `/pricelist/:unique_id` | `views/products/pricelist_print.html` | **pública** |
| `print.reports` | `/reports/{link}/.../{searchTerm}/{class_id}` | `views/reports/print_<link>.html` (**no presentes localmente**) | admin, o finanzas + `user_reports` |
| Contextuales | `leads.view.quotes`, `contacts.view.quotes`, `contacts.view.orders`, `users.view.quotes/orders`, `users.profile.quotes/orders`, `projects.view.order`, `index.dashboard.quotes/orders`, `leads.batch?order_id` | ver §3.8 y §5.10 | |

### 1.3 Permisos por usuario que afectan al módulo (`app.js`, vistas)

| Permiso (campo de usuario) | Efecto observado |
|---|---|
| `role == 'admin'` | Ve todo; único que ve columna/solapa **Costo** y **Margen**; único que ve Exportar CSV; único con menú Productos; puede guardar aunque viole precio mínimo (botón rojo). |
| `user_sales_create` | Crear pedidos / pedido rápido / "Crear Pedido" desde presupuesto. |
| `user_sales_delete` | Borrar pedidos (individual y masivo), crear y anular facturas. |
| `user_access_itens_only == 1` | Sólo ve sus propios pedidos/presupuestos (o los delegados a él). Oculta el filtro "Usuario". Oculta importes en listas de contacto. (`OrdersController.getData`, `QuotesController.getData`, `v/views/contacts/*.html`) |
| `user_reports` | Acceso a informes. |
| `user_contacts_create` | Botón "Adición rápida" de contacto en el pedido. |
| `user_agreements_edit` | Si el plan tiene `addon_advanced` y el usuario no tiene este permiso ni es admin, la **descripción del ítem** queda de sólo lectura (`v/views/common/modal_items.html`). |
| `user_projects_create` | Botón "Nuevo Proyecto" en la pestaña Proyectos del pedido. |

Recursos del plan que se consultan: `order_creation_allowed`, `lead_creation_allowed`, `module_calendar`, `module_orders`, `module_projects`, `module_sales`, `module_finance`, `free_plan` (en plan gratuito, las filas de presupuestos con más de 30 días muestran una corona y ocultan importe, vendedor y visto: `isGreaterThan30Days`), `addon_advanced` (habilita precio mínimo, clases, período del trabajo, costos pagados, columna costo), `addon_boleto` (Brasil).

---

## 2. Catálogos / tablas fijas del sistema

Definidos en `app.js` (MainController, `$rootScope.AppTables`):

| Tabla | Valores (id → español) |
|---|---|
| `order_status` | `471` Abierto (Open) · `474` Cancelado (Canceled) · `475` Venta Completada (Order Completed) · `476` Pedido Rápido (Express Order, `show:false` → no aparece en el selector de estado) |
| `lead_status` (oportunidad, referencia) | `421` Abierto · `422` Ganado · `423` Suspendido · `424` Abandonado · `425` Perdido · `426` Fecha no disponible |
| `period_table` (filtros de listados) | `all` Todo · `this_week` Esta Semana · `last_week` Ultima Semana · `this_month` Este mes · `last_month` Mes pasado · `last_3month` Últimos 3 meses · `last_6month` Últimos 6 meses · `this_year` "Ese Año" · `last_year` Último Año · `other` Otro período (abre modal de rango) |
| `period_table_results` (informes) | igual sin `all`, `this_week`, `last_week` |
| `payment_interval` (plan de cuotas) | `m_1` Mensual · `d_7` Semanal · `d_14` Cada 2 semanas · `d_15` Cada 15 días · `d_28` Cada 4 semanas · `d_30` Cada 30 días · `m_2` Bimestral · `m_3` Trimestral · `m_6` Semestral · `m_12` Anual |
| `lead_subtypes` (= "Grupo" de la Categoría de Presupuestos) | `wedding` Boda (sólo si `Subscriber.persona_id == 1`, fotógrafo de bodas) · `event` Evento · `job_with_date` Trabajo con fecha · `job_no_date` Trabajo sin fecha |
| Prioridad de oportunidad (en presupuesto) | `410` Alta · `411` Media · `412` Bajo (`v/views/quotes/edit.html`) |
| Prioridad en cambio masivo de pedidos | `100` Alta · `101` Media · `102` Bajo (`v/views/orders/modal_priority_checked.html`, sin acceso desde la UI) |
| Colores de estado (`colorType`, `app.js`) | 471 amarillo (warning) · 474 rojo · 475 azul (primary) · 476 verde |

Catálogos editables por el usuario que usa este módulo (vía `Categories`):

- **Categorías de Presupuestos** (`type: "lead_type"`): son a la vez la *categoría de la oportunidad* y la *Categoría del pedido*. Cada una tiene un **Grupo** (`subtype`) que decide qué campos de evento se piden. (`SettingsController.loadQuotes`, `v/views/settings/quotes.html`)
- **Categorías de Productos** (`type: "product"`).
- **Métodos de pago** (`type: "payment"`).
- **Clases** (`type: "class"`), centro de costo opcional.
- **Plan de cuentas** (`Accounts`): prefijo `3` = Ingresos (cuenta de venta del producto, por defecto `3.1`; IVA por defecto `3.9`), `4` = Costos, `5` = Gastos (cuenta de descuento). (`ProductsController.loadEdit`, `CostsController.loadCosts`, `SettingsController.loadOrder`)
- **Flujos de tareas de pedido** (`Stages type "order_stage"`). (`v/views/settings/order_tasks.html`)
- **Cuentas bancarias** (`Banks`), para "Depositar en" del Pedido Rápido.
- **Tipos de cita** (`EventTypes`), para citas automáticas del producto.

---

## 3. Presupuestos (Quotes)

### 3.1 Para qué sirve y cómo se llega

Propuesta económica que se envía al cliente dentro de una **Oportunidad**. Tipos:
- **Presupuesto personalizado** (Custom Quote): se arma con ítems (`quotes.new?lead_id=`). Botón "Añadir Presuposto Personalizado" (Add Custom Quote) en la pestaña Presupuestos de la oportunidad (`v/views/leads/quotes.html`).
- **Presupuesto Estándar** (Default/Standard Quote): no es un registro, es un **correo predefinido por Categoría de Presupuestos** (con adjunto PDF, etc.). Botón "Enviar Presupuesto Estándar" (Send Standard Quote) (`QuotesController.sendStandardQuote`). Ver §13.1.

Acceso: menú Oportunidades → Presupuestos (`quotes.index`), pestaña Presupuestos de la oportunidad (`leads.view.quotes`), ficha de contacto, ficha de usuario, ficha de producto, Área de Cliente.

Si se entra a `quotes.new` sin `lead_id`, muestra "Please add a quote from a Lead" y redirige a Oportunidades (`QuotesController.loadEdit`).

### 3.2 Listado general `quotes.index` (`v/views/quotes/index.html`, `QuotesController`)

**Encabezado:** migas Inicio › Oportunidades › Presupuestos. Botones: "Nueva Oportunidad" (`leads.new`), "Exportar en CSV" (sólo admin, nombre de archivo `quotes.csv`, separador de campo y decimal según `AppSettings.csvSeparator` / `csvDecimalSeparator`). Título "Presupuestos • {Usuario}" si hay filtro.

**Filtros y búsqueda**
| Control | Detalle |
|---|---|
| "Filtrado por usuario" (Filter by User) | desplegable con "Todo" + usuarios; cambia la URL `quotes.index/{itemUser}`. Oculto si `user_access_itens_only==1` y no admin (en ese caso se fuerza el propio usuario). |
| Buscar (Search) | texto libre; busca "todos los campos incluyendo campos adicionales"; fechas en formato `aaaa-mm-dd`; se dispara con 2+ caracteres o vacío, con espera de 500 ms (`debounce`). |
| Nube de etiquetas (`<tag-cloud>`) | aparece al pie; en presupuestos no hay etiquetas propias (ver §19). |

No hay filtro por período ni por estado en presupuestos.

**Columnas (en orden)**
| # | Columna (es) | Campo | Orden | Notas |
|---|---|---|---|---|
| 1 | # | `id` | sí | |
| 2 | Creado (Created) | `created` | sí | oculto con panel lateral |
| 3 | Enviado (Sent) | `sent_date` | sí (`sent_date`) | "No ha enviado" si vacío |
| 4 | Cliente (Customer) | `customer_name` | sí | al pasar el mouse muestra email, email2, teléfono, celular, ciudad • estado • país |
| 5 | Fecha del trabajo/evento (Job/Event date) | `leads_event_date` | sí (`leads.event_date`) | dato de la oportunidad |
| 6 | Oportunidad (Opportunity) | `lead_id` | sí | |
| 7 | Total | `total` | sí | moneda |
| 8 | Vendedor (Sales Person) | `user_id` (avatar `user_avatar`, `user_name`) | sí | |
| 9 | Vistos (Viewed) | `viewed` (fecha y hora) | sí | "No visto" |
| 10 | casilla | selección | — | "seleccionar todo" en cabecera |
| 11 | acciones | | | |

Orden por defecto: `id` descendente. Paginación inferior (`v/views/common/pagination_footer.html`): 10/25/50/100 por página (se guarda en `localStorage.pageSize`), paginador de 7 botones, texto "Mostrando {a} a {b} ({n} totales)"; "No se encontraron resultados".

Clic en la fila → abre la oportunidad en la pestaña Presupuestos con el presupuesto resaltado (`index_go` → `leads.view.quotes({id: lead_id, quote_id})`).

**Parámetros enviados al servidor** (`POST /quotes/paginate`): `user`, `pageNumber`, `pageSize`, `sortBy`, `sortDir` (ASC/DESC), `searchTerm`; para CSV además `csv_mode=1`, `pageSize=999999`.

**Acciones por fila:** Borrar presupuesto; "Crear un nuevo presupuesto en base a esto" (Clonar → `quotes.clone`); Enviar presupuesto (correo); Enviar por WhatsApp (sólo si el cliente tiene celular); Ver; Editar (**sólo si todavía no fue visto**). Menú desplegable con las mismas opciones.
**Acción masiva:** Borrar (modal "Borrar Presupuestos… ¿{n} presupuestos marcados?") → `POST /quotes/batch_delete`.

### 3.3 Ver presupuesto `quotes.view` (`v/views/quotes/view.html`)

Migas: Inicio › Oportunidades › Oportunidad #X › Presupuesto #Y. Botones: Borrar, **Crear Pedido** (`orders.new({quote_id})`), Clonar, Enviar, Imprimir (abre la vista pública `print.quote({unique_id})`), Editar (si no visto). El cuerpo es el mismo que la impresión (§3.6).

### 3.4 Formulario de presupuesto `quotes.new/edit/clone` (`v/views/quotes/edit.html`, `QuotesController.loadEdit/save`)

**Cabecera informativa (sólo lectura), tomada de la oportunidad:** "Oportunidad #id • nombre"; Cliente (enlace a contacto, emails, teléfonos, empresa, ciudad); Propietario de la oportunidad; si Grupo = Boda: Fecha, Novia, Novio (etiquetas personalizables por formulario `custom_form_lead`), Ceremonia, Recepción, ciudad/estado/país, Invitados; si Grupo = Evento: Fecha, Lugar, ciudad, Invitados.

**Campos editables**
| Campo (es) | Campo técnico | Tipo | Validación / valor inicial |
|---|---|---|---|
| Válido hasta (días) (Valid Thru (days)) | `valid_thru_days` | texto | **obligatorio**; defecto 15. Ayuda: "se mostrará al cliente, pero no afecta la visualización del presupuesto" (no vence nada automáticamente). |
| Prioridad de Oportunidad | `priority_id` | botones Alta/Media/Bajo (410/411/412) | defecto = prioridad de la oportunidad. Ayuda: "modificar la prioridad de la Oportunidad". Si el servidor actualiza la oportunidad: **no determinable estáticamente**. |
| Productos (Items) | `quote_items[]` | tabla ordenable arrastrando | columnas: Id (código), Nombre, Unidad (precio), Desc (%), Cant., Total (precio/desc/total ocultos si "Mostrar precios" = No). Acciones Editar / Borrar; "Añadir Item" abre el modal §4. |
| Total Productos | `total_products` | sólo lectura | suma de ítems |
| Otros gastos (Other Expenses) | `other_expenses` | número con máscara | se suma al total |
| Descuento (Discount) | `discount` | número | etiqueta muestra (%) o (moneda) según el interruptor |
| Total | `total` | sólo lectura | |
| Mostrar precios de los artículos (Show Item Prices) | `show_item_prices` | Sí/No | defecto Sí. Si se pone No, fuerza "Mostrar Precios Totales" = Sí |
| Mostrar Precios Totales (Show Total Prices) | `show_totals` | Sí/No | defecto Sí. Si se pone No, fuerza "Mostrar precios de los artículos" = Sí (nunca se ocultan ambos) |
| Descuento final en (%) (Final Discount in (%)) | `discount_percent` | Sí/No | defecto Sí (porcentaje) |
| Condiciones de pago (Payment Conditions) | `payment_conditions` | texto largo | precargado desde Configuración → Condiciones (`quote_payment_conditions`) |
| Condiciones generales (General Conditions) | `general_conditions` | texto largo | precargado desde `quote_general_conditions` |
| (oculto) Mensaje | `message` | — | precargado desde `AppSettings.quote_message`; se usa en el correo. No hay campo en la pantalla. Dónde se edita `quote_message`: **no determinable estáticamente**. |

Alerta "Total es menor que el mínimo permitido" si está activo el precio mínimo (§9.6).

**Botón Guardar:** deshabilitado si no hay ítems, o si se viola el mínimo y el usuario no es admin (para admin el botón queda rojo pero permite). Al guardar se envía también `user_id` = **usuario actual**, `lead_id`, `customer_id` (cliente de la oportunidad), `created`/`modified`. Luego vuelve a la oportunidad. Registra actividad "Presupuesto #X fue creado/guardado".

**Clonar:** carga el presupuesto origen, borra `id` y `unique_id` y guarda como nuevo en la **misma oportunidad** (no se puede elegir otra).

### 3.5 Presupuestos dentro de la oportunidad (`v/views/leads/quotes.html`)

Botones: "Añadir Presuposto Personalizado", "Enviar Presupuesto Estándar". Lista (scroll infinito de a 50, `GET /quotes/leads/{lead}/{offset}/{count}`): #, Creado (fecha+hora), Enviado, Vendedor, Total, Vistos, casilla. Acción masiva Borrar. Menú por fila: Editar (si no visto), Ver, Imprimir, Enviar, Enviar por WhatsApp, Clonar, **Crear Pedido**, Borrar.

**Crear Pedido** tiene tres variantes (`v/views/leads/quotes.html`, `QuotesController.modalCreateOrderFromQuoteOpenLead`):
1. Oportunidad ya *Ganada* (`lead_status_id == 422`) → va directo a `orders.new?quote_id`.
2. Oportunidad no ganada → modal "Crear Pedido: Al crear un pedido, esta oportunidad se guardará como 'Ganada'. ¿Deseas continuar?" → marca la oportunidad Ganada (`POST /leads/batch_finish` con `status_id 422` y fecha de hoy), registra actividad y abre `orders.new?quote_id`.
3. Plan sin permiso → modal de plan.

### 3.6 Vista pública / impresión del presupuesto `print.quote/:unique_id` (`v/views/quotes/view_print.html`, `view_print_include.html`)

Contenido: logo de impresión (posición configurable), nombre, teléfono, email y web del estudio; "Presupuesto #id"; Emisión; Cliente (datos); Propietario de la oportunidad; Oportunidad #id • nombre; bloque Boda/Evento; tabla Producto (nombre + (código) + descripción) · Precio Unitario · Desc (%) · Cant. · Precio Total (según `show_item_prices`); totales (Total Productos, Otros gastos si >0, Descuento si >0 en % o importe, Total) si `show_totals`; Condiciones de pago; Condiciones generales; "Válida hasta {n} días"; "Emitido por"; pie de impresión; fecha y hora de impresión.

**Marcado de "Visto":** al abrir la página, si **no hay sesión** (visitante anónimo) o el usuario es **contacto** (Área de Cliente), se llama `PUT /quotes/viewed` con `unique_id` y la hora (`QuotesController.loadUniqueId`). Si la abre el propio estudio logueado, no marca.

**Aprobación del cliente:** **no existe** en la vista pública (no hay botón aceptar/rechazar/firmar). La conversión a venta la hace el estudio manualmente (Crear Pedido). La firma online existe sólo en Contratos.

### 3.7 Envío

- **Enviar presupuesto (correo)** → abre el compositor de correo (`mail:popup`) con plantilla `custom_quote`, adjuntos de esa plantilla, y variables: `customer_*`, `message`, `quote_number`, `lead_number`, `link` = `{rooturl}/#/print/quote/{unique_id}`, `pricelist_link` = `{rooturl}/pricelist/{unique_id del estudio}`. Al enviarse (`mail:sent`) se marca `PUT /quotes/date_sent/{id}` y también `PUT /leads/date_sent/{lead}` (fecha de envío en la oportunidad). (`QuotesController.sendCustomQuote`)
- **Enviar Presupuesto Estándar** → plantilla `default_quote_{categoría}` o, si no existe, `default_quote`; marca sólo la oportunidad (`Leads.date_sent`). (`QuotesController.sendStandardQuote`)
- **WhatsApp** → abre el panel de WhatsApp con el celular del cliente y el enlace público. (`sendWhatsappCustomQuote`)
- **Seguimiento automático** (Follow Up): correo `followup` que el sistema envía X días después del presupuesto; los días se configuran en Configuración → Oportunidades → Seguimiento. Ejecución en servidor: **no determinable estáticamente**. (`app.js` MailVariables `leads.followup`)

### 3.8 Otras vistas con presupuestos

| Vista | Archivo | Columnas | Particularidad |
|---|---|---|---|
| Ficha de contacto → Presupuestos | `v/views/contacts/quotes.html` | #, Enviado, Vendedor, Oportunidad, Total, Vistos | clic → `quotes.view` (con control de acceso); importe oculto si el usuario sólo ve lo suyo |
| Ficha de usuario → Presupuestos | `v/views/users/quotes.html` | #, Enviado, Cliente, Oportunidades, Total, Vistos | clic → oportunidad |
| Ficha de producto → Presupuestos | `v/views/products/quotes.html` | #, Enviado, Cliente, Oportunidad, Total, Vistos | presupuestos que contienen el producto |
| Área de Cliente → Presupuestos | `v/views/dashboard/quotes.html` | #, Enviado, Vendedor, Oportunidad, Total, Vistos + "Imprimir Presupuesto" | tipo `customer` |

Todas usan `GET /quotes/{type}/{id}/{offset}/{count}` con `type` ∈ `leads`, `contact`, `user`, `product`, `customer`.

---

## 4. Ítems: el modal "Detalles del Producto" y el cálculo de totales

Compartido por Presupuesto, Pedido y Pedido Rápido (`v/views/common/modal_items.html`; `ModalItemsInstanceCtrl` dentro de `QuotesController`, `OrdersController`, `LeadsController`).

| Campo (es) | Tipo | Validación / comportamiento |
|---|---|---|
| Producto* | buscador `selectize` sobre `GET /products/list` | obligatorio ("Por favor, seleccione un producto"). Al elegir, copia **precio** y **descripción** del producto. Junto al campo hay un botón "+" para **crear producto al vuelo** (modal "Nuevo Producto": Categoría*, Nombre* (mín. 3), Valor*, Cuenta de ventas*; lo crea con `list=1`) (`v/views/products/modal_new_product.html`, `ProductsController.modalNewProduct`). |
| Precio* | número con máscara | obligatorio. Editable libremente. |
| Cant.* | texto | obligatorio; se reemplaza el separador decimal local por punto (admite decimales). |
| Descuento(%) | número | 0–100 (se recorta); vacío = 0. Muestra "Precio Final" = precio × (100 − desc)/100. |
| Descripción | texto largo | sólo lectura si `addon_advanced` y el usuario no es admin ni tiene `user_agreements_edit`. |

Alerta "El precio es más pequeño que el mínimo permitido" si el precio final < `min_price` del producto (con la opción activa, §9.6): para no admin deshabilita Guardar; para admin lo pinta rojo.

**Cálculo (idéntico en presupuesto y pedido — `updateTotals`)**
```
item.total      = redondeo2( precio × cantidad × (1 − desc%/100) )
item.min_total  = min_price × cantidad
total_products  = Σ item.total
base            = total_products + other_expenses (si > 0)
descuento       = si discount_percent: base × discount/100 (tope 100 %)
                  si no: discount (tope = base)
total           = redondeo2(base − descuento)
alerta mínimo   = total < Σ item.min_total
```
En el pedido se agrega el IVA (§10.1). No hay impuestos por ítem ni descuentos por ítem en importe fijo; **no hay costos por ítem editables** (el campo `costs` viaja pero no se edita en el modal). Los ítems se pueden reordenar arrastrando.

---

## 5. Pedidos (Orders)

### 5.1 Para qué sirve y cómo se llega

Registro de la venta: cliente, trabajo/evento, ítems, pagos, costos, estado, tareas, contratantes. Se crea:
- desde cero (`orders.new`, menú o botón "Nuevo Pedido");
- desde un contacto (`orders.new?customer_id`, botón "Nuevo Pedido" en `v/views/contacts/orders.html`);
- desde un presupuesto (`orders.new?quote_id`, §3.5);
- desde una oportunidad ganada (`orders.new?lead_id`; al marcar la oportunidad Ganada aparece "¡Felicidades! La oportunidad X fue marcada como Ganada. ¿Desea crear un pedido ahora?" → `v/views/leads/modal_create_order.html`, `LeadsController.modalCreateOrder`);
- clonando otro pedido (`orders.new({from_id})` o `orders.express({from_id, express_clone:1})`).

### 5.2 Listado `orders.index` (`v/views/orders/index.html`, `OrdersController.getData`)

**Botones superiores:** "Nuevo Pedido Rápido", "Nuevo Pedido" (con corona si el plan no permite), "Exportar en CSV" (admin; `orders.csv`; usa `GET /orders/all` con los mismos filtros y `csv_mode=1`), "Imprimir" → "Resumen" (`print.orders_summary` con todos los filtros). La impresión "Detallado" (`print.orders`) existe como ruta pero no tiene botón.

**Título dinámico:** nombre del estado o "Etiqueta: x" o "Todo" • usuario • período • "Fecha del trabajo/evento: período" • "Clase: x".

**Filtros**
| Control (es) | Valores | Parámetro URL / servidor | Persistencia |
|---|---|---|---|
| Estado (Status) | Todo + todos los estados de `order_status` (incluye Pedido Rápido) | `itemCategory` → `type` | `localStorage.order_itemCategory` |
| Etiqueta (nube "Búsqueda por etiqueta") | cada etiqueta de pedidos | `itemCategory = "tag:{nombre}"` → `type` | idem |
| Usuario (User) | Todo + usuarios | `itemUser` → `user` | **no** se persiste (va en la URL). Oculto si el usuario sólo ve lo suyo (se fuerza su id). |
| Período (Period) — **fecha de emisión del pedido** (`add_date`) | `period_table`; "Otro período" abre modal de rango | `itemPeriod` → `period`; `itemStartDate/itemEndDate` → `start_date/end_date` | `localStorage.order_itemPeriod` (+ fechas) |
| Período de Trabajos y Eventos (Job/Event Period) — **fecha del trabajo** (`event_date`) | igual | `itemPeriodJob` → `period_job` (rango compartido `start_date/end_date`) | `localStorage.order_itemPeriodJob`. Sólo con `addon_advanced`. |
| Clase (Class) | Todo + clases | `itemClass` → `class` | `localStorage.order_itemClass`. Sólo si clases activas y `addon_advanced`. |
| Buscar | texto libre, incl. campos adicionales; fechas `aaaa-mm-dd` | `searchTerm` | no |

Rango por defecto al elegir "Otro período": del 1 del mes actual a hoy. Ambos períodos comparten las mismas fechas de inicio/fin (si se usan los dos a la vez, **no determinable** cómo los combina el servidor).

Orden: `sortBy`/`sortDir`, persistidos (`localStorage.order_sortBy`, `order_reverseSort`); defecto `id` desc.

**Columnas**
| # | Columna | Campo | Orden por | Notas |
|---|---|---|---|---|
| 1 | # | `id` | id | |
| 2 | Estado | `status_id` (etiqueta de color) | status_id | **sólo si el filtro de estado es "Todo"** |
| 3 | Emisión (Issue Date) | `add_date` | add_date | oculta con panel lateral |
| 4 | Nombre | `name` + cliente debajo (hover con datos de contacto) | `name,customer_name` | |
| 5 | Fecha del trabajo/evento | `event_date` | event_date | |
| 6 | Proy (Proj) | `order_completed_projects / order_projects` | (usa event_date, ver §19) | "Proyectos terminados / Total" |
| 7 | Categoría | `category_name` | category_id | |
| 8 | Total | `total` | total | |
| 9 | Costo (Cost) | `cost` y % sobre total | cost | sólo admin + `addon_advanced` |
| 10 | Vendedor | avatar `user_avatar` | user_id | |
| 11 | casilla / acciones | | | |

Fila de totales al pie: "Total de esta página" (suma en el navegador) y "Total" (de todo el filtro, devuelto por el servidor como `total`).

**Clic en fila:** en pantallas ≥1025 px abre el **panel lateral** (`orders.index.details`); un segundo clic en la misma fila abre la ficha; en pantallas chicas va directo a la ficha.

**Acciones por fila:** Ver; Editar (si es Pedido Rápido → editor rápido; regla de bloqueo en §15.3); Clonar (normal → `orders.new({from_id})`; rápido → `orders.express({from_id, express_clone:1})`); Borrar (permiso).
**Acciones masivas:** Cambiar Vendedor (modal: Vendedor, Delegado a, "Quitar delegados", Notifiqueme de cambios → `POST /orders/batch_users`), Cambiar etiquetas (añadir etiquetas → `Tags.batch`), Borrar (`POST /orders/batch_delete`). Existen en código pero **sin acceso en pantalla**: cambiar prioridad (`batch_priority`), marcar completados (`batch_finish`, plantilla 404), vencimientos (`batch_duedate`, `single_duedate`).

**Borrar pedido:** "¿Desea borrar el pedido X? IMPORTANTE: también se borrarán notas, actividades y tareas relacionadas" (`v/views/orders/modal_delete.html`). Tras borrar, el servidor devuelve proyectos y citas asociados que también se eliminan y se notifica a sus responsables (`auto_remove_notify` tipo "R").

### 5.3 Panel lateral `orders.index.details` (`v/views/orders/detail.html`)

Acciones al pasar el mouse: Borrar, Crear Factura (si IVA activo), Imprimir, Enviar, WhatsApp (si hay celular), Añadir Nota, Añadir Cita, Añadir Contrato, Editar, Ver. Datos: Estado, Tipo (categoría), Cliente con botones "Enviar correo"/"Enviar WhatsApp", bloque evento según grupo, Total, Oportunidad (enlace), Clase, Emisión, Finalizado en, Vendedor, Delegado, Descripción, etiquetas, **línea de tiempo** (`<timeline-widget>`).

### 5.4 Ficha del pedido `orders.view` (`v/views/orders/view.html`, `OrdersController.loadRow`)

**Barra de acciones:** Borrar; Imprimir (`print.order({unique_id})`); Enviar (correo plantilla `order`); Enviar por WhatsApp; Añadir Nota; Añadir Cita (si módulo calendario); Añadir Contrato (`AgreementsController.modalAgreementAdd`); Editar (según reglas §15.3).

**Columna izquierda:**
- Estado (color), Tipo (categoría).
- Cliente (avatar, enlace), emails; botones **Enviar correo**, **Enviar WhatsApp**, **Enviar acceso al Área de Cliente** (plantilla `order_access`, link `{rooturl}/login?uid={unique_id del contacto}`).
- Teléfonos, empresa, ciudad.
- Datos del trabajo según grupo: Boda (Fecha con día de la semana, Novia, Novio, Ceremonia, Recepción, ciudad, Invitados); Evento (Fecha, Lugar, ciudad, Invitados); Trabajo con fecha (Fecha, Lugar, ciudad).
- Campos adicionales (4 textos + 2 fechas con etiquetas configurables `order_extra1..4`, `order_date1..2`).
- Referente (hover con datos).
- Importes: Total Final e IVA (si corresponde), Total; **Costo y Margen** con % (sólo admin).
- Botón **Crear Factura** (si permiso borrar ventas o admin, IVA activo y `vat > 0`).
- Oportunidad (enlace), Clase, Emisión, Finalizado en, Vendedor, Delegado a.
- Botón **"Crear una oportunidad basada en este pedido"** (`leads.batch?order_id`, ver §16).
- Memo, etiquetas.

**Pestañas:**
1. **Información general**: contadores clicables (`row.info.*`) que abren sub-vistas debajo: Productos → `orders.view.items`; Pagos → `.payments`; Costos → `.costs` (sólo admin); Contratos → `.agreements`; Proyectos → `.projects` (si módulo proyectos); Citas → `.events` (si calendario).
2. **Notas** (`<notes-widget>`), 3. **Mensajes** (correos), 4. **Actividad**, 5. **Contactos Relacionados** (participantes), 6. **Archivos adjuntos**.

Si el flujo del pedido no tiene etapas, avisa "There is a problem with the workflow of this order…".

**Sub-vistas:**
| Sub-vista | Archivo | Contenido |
|---|---|---|
| Items del pedido | `v/views/orders/items.html` | tabla Id/Nombre/Unidad/Desc/Cant./Total + Total Productos, Otros gastos, Descuento, Total, IVA (%), Total Final; botón Editar |
| Pagos | `v/views/orders/payments.html` | botón Editar, **"Abrir Cuentas por Cobrar"** (`finance.ar({customer_id})`); tabla Vencimiento, Método de pago, Número de Documento, Banco (si rápido) o Memo, Valor, Estado (tilde + fecha de cobro en rojo si se cobró tarde), "Imprimir Recibo" (`/#/print/receipt/{receipt_id}.{receipt_key}`), boletos (Brasil). Nota: "Cuentas por Cobrar se crearán automáticamente si el estado del pedido es Venta Completada". |
| Costos | `v/views/orders/costs.html` | ver §8 |
| Contratos | `v/views/orders/agreements.html` | #, Creado/Por, Enviado, Nombre, Vistos, Firmado (si firma online); acciones Clonar, Ver, Imprimir, Enviar, WhatsApp, Editar (si no visto), Marcar firmado / no firmado, Borrar. (Detalle en el documento de Contratos.) |
| Proyectos | `v/views/orders/projects.html` | #, Nombre, Propietario, Tipo (flujo), Estado, Etapa, Vence. Botón "Nuevo Proyecto" **sólo si el pedido no está Abierto** y no se superó el límite del plan. Nota: "Proyectos se crearán automáticamente si el estado del pedido es Venta Completada y los productos están configurados con esta opción." |
| Citas | `v/views/orders/events.html` | Fecha, Título, Ubicación, Tipo, Estado, Propietario; "Nuevo evento". Nota análoga para citas. |

### 5.5 Formulario de pedido `orders.new` / `orders.edit` (`v/views/orders/edit.html`, `OrdersController.loadEdit/save`)

Asistente con 5 pestañas. En alta: "Editar Artículos y Pagos >>" → "Editar Progreso >>" → Guardar (visible desde la pestaña 3). En edición: Guardar siempre visible.

**Pestaña 1 — Información Básica (Basic Info)**
| Campo | Técnico | Tipo | Validación / regla |
|---|---|---|---|
| Categoría* | `category_id` (objeto `row.category`) | select de Categorías de Presupuestos | obligatorio; su **grupo** cambia los campos del trabajo |
| Emisión* (Issue Date) | `add_date` | fecha | obligatorio; defecto hoy |
| Referente (Referrer) | `referrer_id` | buscador de contactos (mín. 3 letras, 30 resultados) + "Adición rápida" | opcional |
| Oportunidad | `lead_id` | buscador | "Opcional. Seleccionar una oportunidad si desea hacer una conexión con este pedido." |
| Cliente* | `customer_id` | buscador de contactos + "Adición rápida" | obligatorio. Al elegirlo, si aún no se tocó el Contratante 1, lo copia como Contratante 1. |
| **Grupo Boda**: Nombre del Evento* (mín. 3), Fecha y Hora de la boda, Invitados, Novia, Novio, Lugar de ceremonia, Lugar de recepción, Ciudad, Estado/Provincia, País | `name`, `event_date`, `guests`, `bride_name`, `groom_name`, `place_event`, `place_reception`, `city_event`, `state_event`, `country_event` | | |
| **Grupo Evento**: Nombre del Evento*, Fecha y Hora del Evento, Invitados, Lugar del evento, Ciudad, Estado, País | | | |
| **Grupo Trabajo con fecha**: Nombre del trabajo*, Fecha y Hora del trabajo, Lugar del trabajo, Ciudad, Estado, País | | | |
| **Otros (Trabajo sin fecha)**: Nombre del trabajo* | | | |
| Memo | `memo` | texto largo | |
| Clase | `class_id` | select | visible con clases activas + `addon_advanced`; obligatorio si `classes_in_orders == 1` |
| Vendedor* (Sales Person) | `user_id` | select usuarios | obligatorio; defecto usuario actual |
| Delegado a | `delegated_id` | select usuarios | |
| Notifiqueme de cambios | `follow_delegated` | Sí/No | "Genera una notificación para el responsable del pedido por cada modificación" |
| Etiquetas | `tags` | etiquetas con autocompletar | |
| (sólo edición, si ya se crearon) Recrear Proyectos / "Crear citas" (Recrear Citas) / Borrar todas las citas: Todo · Sólo citas no editadas | `recreate_projects`, `recreate_events`, `recreate_events_force` | Sí/No | "Al elegir Sí, se eliminarán proyectos y eventos previamente creados y se crearán los nuevos en base a los datos de este Pedido." |

**Pestaña 2 — Artículos y pagos (Items & Payments)**
- Ítems (§4) con Total Productos, Otros gastos, Descuento, Total, Mostrar precios de los artículos, Descuento final en (%), alerta de mínimo.
- **IVA** (sólo si IVA activo en configuración): "IVA ({n}%) Sí/No" (`vat_active` por pedido), importe IVA, y "Total Final" si los precios **no** incluyen IVA.
- **Pagos** (plan de cobro): tabla Vencimiento, Método de pago, Número de Documento, Memo, Valor, Pagado; acciones Editar (si no cobrado y sin boleto emitido), Borrar (si no cobrado); fila Total con "Cantidad que falta" (diferencia); "Añadir" visible mientras falte importe. Aviso si los pagos superan el total. Detalle en §7.
- (edición) **Recrear Costos** Sí/No: "Al elegir Sí, se eliminarán los costos previamente editados y se crearán nuevos en base a los productos de este Pedido." Valor por defecto: Sí si el pedido estaba Abierto al abrir la edición, No en otro caso.

**Pestaña 3 — Progreso (Progress)**
| Campo | Regla |
|---|---|
| Estado* | select con los estados visibles (Abierto, Cancelado, Venta Completada). **En alta se quita "Cancelado"**. Al cambiar: si pasa a Abierto borra la fecha de finalización; si pasa a otro estado pone hoy. |
| Fecha de finalización (Completed Date) | `completed_date` |
| Recrear Costos | repetido aquí |
| Flujo* (Workflow) | sólo si Estado = Abierto y aún no se crearon tareas (`tasks_created != 1`): select de flujos de "Tareas de Pedidos" (§13.5). Al cambiar el flujo, precarga la caja de tareas. |
| Tareas | textarea, "una tarea por línea"; se crean al guardar (§15.2). |
| Delegado a / Notifiqueme de cambios | repetidos |

**Pestaña 4 — Contratantes (Contractors)** — datos que usa el Contrato.
- Contratante 1* (buscador; por defecto el cliente) con "Editar todos los datos del contacto": Tratar como empresa; si empresa: Empresa* (mín. 3), Sitio web, Negocio ID (`rg`), NIF (`cpf`); Nombre* (si no es empresa, mín. 3), Apellido, Correo principal y secundario (validación de email), Teléfono, Móvil, Cumpleaños, Género (Hombre/Mujer); si persona: DNI/NIE (`rg`), NIF (`cpf`), Empresa, Sitio web; Código postal (en Brasil autocompleta con viacep.com.br), País, Dirección, Dirección 2, Ciudad, Estado.
- Contratante 2 (opcional) con los mismos campos + "Adición rápida".
- Si estos cambios actualizan la ficha del contacto: **no determinable estáticamente** (se envían como `row.contractor1` / `row.contractor2`).

**Pestaña 5 — Campos Adicionales**: `extra1..extra4` (texto) y `extra_date1`, `extra_date2` (fecha), con etiquetas de Configuración → Campos Adicionales.

**Validaciones de guardado:** formulario válido (si falla: "Errors occurred when sending the form. Please review all tabs…"); **al menos un ítem** ("Su Pedido no tiene artículos…"); **suma de pagos = total** ("Total de pagos no coincide con el total del pedido…"); mínimo de precio (para no admin).

**Qué se envía al guardar** (`save`, `process_save`): todos los campos + `mode` (new/edit/clone), `from_id`, `stage_id/stage_change/stage_tasks/stage_memo/stage_name/stage_user`, `save_tags`, fechas convertidas a SQL, `module_finance`, `tasks_created=1` si corresponde, `vat` y `grand_total` (§10.1), `active_project_count` y `project_plan` (límite de proyectos del plan). Si el servidor responde `error: "project_limit"`, avisa "Error creating projects… Projects limit was reached" y lo registra como notificación y actividad.

**Precarga según origen (`loadEdit`)**
| Origen | Qué copia |
|---|---|
| `quote_id` | **todos los datos de la oportunidad** (nombre, categoría, fecha y lugares del evento, invitados, novios…), `lead_id`, `quote_id`, ítems del presupuesto, cliente = cliente del presupuesto, Contratante 1 = cliente, `show_item_prices`, `discount_percent`, `total_products`, `other_expenses`, `discount`, `total`. Estado Abierto, emisión hoy, vendedor = usuario actual, pagos vacíos, primer flujo. |
| `lead_id` | datos de la oportunidad, sin ítems (totales en 0). |
| `customer_id` | sólo el cliente (y Contratante 1). |
| `from_id` (clonar) | todo el pedido; se borra `id`; en los pagos se pone `cleared=0` y `charge_issued=null` (los pagos se clonan como pendientes). |

### 5.6 Otras vistas con pedidos

| Vista | Archivo | Columnas |
|---|---|---|
| Contacto → Pedidos | `v/views/contacts/orders.html` | botón "Nuevo Pedido"; #, Nombre, Tipo, Total, Vendedor, Fecha del Evento, Estado |
| Usuario → Pedidos | `v/views/users/orders.html` | #, Cliente, Nombre, Total, Tipo, Fecha del Evento, Estado |
| Producto → Pedidos | `v/views/products/orders.html` | #, Cliente, Nombre, Total, Fecha del Evento, Estado |
| Producto → Clientes | `v/views/products/customers.html` | # (cliente), Nombre, Pedido #, Total, Fecha del Evento, Estado (ordenado por cliente) |
| Área de Cliente → Pedidos | `v/views/dashboard/orders.html` | #, Nombre, Tipo, Total, Vendedor, Fecha del Evento, Estado + "Imprimir Pedido" |
| Proyecto → Pedido | `v/views/projects/order.html` | "Pedido #id (nombre)" y lista Producto/Cant. (`GET /orders/items`) |

Todas con `GET /orders/{type}/{id}/{offset}/{count}`, `type` ∈ `contact`, `user`, `product`, `customer`.

---

## 6. Pedido Rápido (Express Order)

**Qué es:** una venta de mostrador **ya cobrada en el acto** (`status_id = 476`). (`v/views/orders/express_edit.html`, `OrdersController.save('express')`)

**Pestañas:** Información Básica · Artículos y pagos · Información adicional · Campos Adicionales. **No tiene** Referente, Oportunidad, Contratantes, Progreso/Flujo/Tareas, Delegado ni plan de cuotas.

- Información Básica: Categoría*, Emisión*, Cliente* (+ Adición rápida), campos de trabajo por grupo, Clase, Vendedor*, recrear proyectos/citas (edición).
- Artículos y pagos: ítems y totales, IVA; **"Datos de Pago"** con una única fila: Método de pago* (select), Número de Documento, **Depositar en*** (cuenta bancaria, `bank` = `account_code`), Valor (= total, o total final si IVA se suma). Recrear Costos (edición).
- Información adicional: Memo, Clase, Etiquetas.

**Al guardar** se fuerza: estado 476, fecha de finalización = hoy, y un único pago `{método, vencimiento = fecha de emisión, documento, valor = total, banco, cleared = 1 (cobrado)}`. En la ficha la pestaña Pagos muestra la columna Banco (`Banks.get_by account_code`).

**Edición:** con `order_edit_blocked == 1`, sólo admin puede editar un pedido rápido.

---

## 7. Pagos del pedido → Cuentas por Cobrar

### 7.1 Modal "Datos de Pago" (`v/views/common/modal_payments.html`, `OrdersController.modalPays`)

| Campo | Regla |
|---|---|
| Método* | select de Métodos de pago; defecto el primero |
| Fecha límite* (vencimiento) | defecto: último vencimiento usado en la sesión o hoy |
| Número de Documento | defecto: último número usado +1 (arranca en 1) |
| Número de pagos | N cuotas; al cambiarlo, Valor = faltante ÷ N |
| Intervalo de pagos | tabla `payment_interval` (defecto Mensual); se recuerda |
| % del Importe Total | al escribirlo, Valor = total × % y N = 1 |
| Valor* | importe de cada cuota |
| Memo | se recuerda para la siguiente |

**Generación de cuotas (alta):** repite N veces: si la cuota supera lo que falta, se ajusta a lo que falta y corta; si después de esta cuota faltaría menos de 1 unidad monetaria, la cuota absorbe el resto y corta; el vencimiento avanza según el intervalo (días o meses); el número de documento se incrementa (si es numérico) o se le agrega sufijo "-n". Cada cuota: `cleared=0`, `deleted=0`.

**Editar cuota:** sólo si no está cobrada ni tiene cobro emitido (boleto). **Borrar:** borrado lógico (`deleted=1`, valor 0); si tenía boleto emitido pide confirmación (texto en portugués, `v/views/orders/modal_delete_pay.html`).

### 7.2 Cómo se generan las Cuentas por Cobrar

- Texto de la UI: "Cuentas por Cobrar se crearán automáticamente si el estado del pedido es Venta Completada" (`v/views/orders/payments.html`). La creación es del servidor al guardar el pedido (`PUT/POST /orders`): **no determinable estáticamente** en detalle (cuándo se regeneran, qué pasa con las cobradas, cuentas contables usadas — se infiere: ingreso por producto `account_sale_id`, "Otros gastos" y "Descuento" a las cuentas de Configuración → Pedidos, IVA a `vat_account`).
- Cada pago guarda `account_trans_id` (movimiento financiero), `cleared`/`cleared_date` (cobrado), `receipt_id/receipt_key` (recibo imprimible) y datos de boleto.
- Pedido Rápido: el cobro nace ya **cobrado** en la cuenta bancaria elegida.
- Desde la pestaña Pagos, "Abrir Cuentas por Cobrar" lleva al módulo Finanzas filtrado por cliente.

---

## 8. Costos → Cuentas por Pagar

Controlador único `CostsController` (`app.js`) que trabaja sobre `GET/POST /costs/{type}/{target_id}` con `type` = `orders`, `leads` o `products` (este último usa además `GET/POST /products/costs/:id`).

### 8.1 Costos del producto (plantilla) — `v/views/products/costs.html`, `modal_costs.html`, `ProductsController.loadCosts/saveAllCosts`

Tabla: Proveedor, Cuenta, Descripción, Días, Valor; total. Modal "Detalles de costes":
| Campo | Regla |
|---|---|
| Proveedor | contacto (buscador) — opcional |
| Cuenta* | plan de cuentas prefijo `4` (Costos) |
| Descripción | texto (al agregar en línea exige nombre) |
| Días (Offset Days) | días desde la fecha del evento/trabajo hasta el vencimiento del gasto. "(Dejar vacío no generan Cuentas por Pagar)" |
| Valor* | ≥ 0 |

Guardar (`POST /products/costs/:id` con `costs` y `total_cost`) actualiza el **Costo** del producto; la ficha muestra Costo y Margen (importe y %).

### 8.2 Costos del pedido — `v/views/orders/costs.html`, `orders/modal_costs.html`

Sólo admin. Tabla: Proveedor, Cuenta (`id – nombre`), Descripción (con "Fuente: Producto #id" si vino de un producto), Vencimiento, Valor, Pagado (si `addon_advanced`); total. Modal: Proveedor, Cuenta* (prefijos `4,5`), Descripción, **Vencimiento** (fecha, en vez de días), Valor*. No se pueden editar ni borrar costos ya pagados. Nota: "Sólo costos con fecha de caducidad crean cuentas por pagar." Cambios quedan pendientes hasta "Guardar" (con "Deshacer").

**Al guardar:** `POST /costs/orders/{id}` con `costs` y `total_cost`; actualiza `row.cost`; **si el pedido está en Venta Completada (475) o Pedido Rápido (476) llama `PUT /orders/set_cost_accounts/{id}`**, que (se infiere) regenera las Cuentas por Pagar desde los costos con vencimiento. Registra actividad "Costs were saved".

**Origen de los costos del pedido:** al crear/editar el pedido con "Recrear Costos = Sí", el servidor copia los costos-plantilla de cada producto (con `product_id`, `product_cost_id`) y calcula el vencimiento como fecha del evento + días (inferido del texto de ayuda; cálculo exacto **no determinable**). Si los multiplica por la cantidad del ítem: **no determinable**.

### 8.3 Costos de la oportunidad — `v/views/leads/costs.html`

Sólo admin; Proveedor, Cuenta, Descripción, Valor (sin vencimiento). Sirven para estimar margen de la oportunidad; si pasan al pedido: **no determinable**.

---

## 9. Productos / Servicios, Paquetes y Lista de precios

### 9.1 Listado `products.index` (`v/views/products/index.html`, `ProductsController.getData`)

Botones: "Nuevo Producto", "Exportar en CSV" (admin). Filtro por **Categoría de producto**: botones "Todo" + una por categoría (`itemCategory` en la URL, persistido en `localStorage.product_itemCategory`); nube de etiquetas (`tag:x`). Búsqueda en todos los campos.

Columnas: # · imagen (avatar) · Código · Nombre (hover muestra descripción) · Tipo (categoría) · **Activo** (clic alterna) · **Lista de precios** (clic alterna) · **Paquete** (ícono; advertencia si es paquete sin ítems) · Precio · casilla · acciones (Ver, Editar, Clonar, Borrar). Orden persistido (`product_sortBy`, `product_reverSort`). Masivas: Cambiar etiquetas, Borrar (`POST /products/batch_delete`).

Alternar Activo/Lista → `PUT /products/set_active/{id}/{active|list}/{0|1}` y registra actividad ("Product X was set to active/inactive", "…was added to/removed from price list").

### 9.2 Formulario de producto (`v/views/products/edit.html`, `ProductsController.loadEdit/save`)

**Pestaña Información Básica**
| Campo | Técnico | Regla |
|---|---|---|
| Categoría* | `category_id` | categorías de producto |
| Nombre* | `name` | mín. 3 |
| Código | `code` | |
| Descripción | `description` | "se imprime en presupuestos, pedidos, etc." |
| Etiquetas | `tags` | |
| Paquete | `pack` | Sí/No (defecto No). "Este producto es un combo. Puede editar artículos del paquete en la pantalla de vista de producto." |
| Precio de venta* | `price` | sólo si no es paquete |
| Cuenta de ventas* | `account_sale_id` | plan de cuentas prefijo 3; defecto `3.1`; sólo si no es paquete |
| Precio Mínimo* | `min_price` | sólo si la opción de precio mínimo está activa y plan avanzado |
| Activo | `active` | defecto Sí. "Cuando se activa, se mostrará al crear presupuestos y pedidos" |
| Lista de precios | `list` | defecto Sí. "Cuando se activa, se mostrará en la Lista de precios" |

**Pestaña Configuración del proyecto** (no paquete)
| Campo | Regla |
|---|---|
| Añadir Proyectos (`project_create`) | "Si Sí, cuando emite un pedido con este producto, automáticamente creará un proyecto con plazo basado en la fecha del evento." |
| Propietario (`project_user_id`) | defecto usuario actual |
| Días (`project_offset_days`) | plazo del proyecto desde la fecha del evento (negativo = antes) |
| Flujo (`project_pipeline_id`) | flujos de proyecto |

**Pestaña Configuración de citas automáticas** (no paquete, módulo calendario)
| Campo | Regla |
|---|---|
| Añadir Cita (`event_create`) | crea cita al emitir el pedido, con fecha según la del evento |
| Persona designada (`event_user_id`) | usuarios, incluye freelancers |
| Días (`event_offset_days`) | desde la fecha del evento |
| Duración (horas) (`event_duration`) | defecto `1:00:00` |
| Categoría del Evento (`event_type_id`) | tipos de cita |

Guardar redirige a la ficha. **Clonar** (`products.new?product_id`): copia todo, nombre + " (Copy)", y al crear llama `GET /products/clone_costs/{origen}/{nuevo}` y, si es paquete, `GET /products/clone_pack/{origen}/{nuevo}`.

### 9.3 Ficha de producto `products.view` (`v/views/products/view.html`)

Acciones: Borrar, Clonar, Nuevo Producto, Editar. **Recorte de imagen** del producto (`<image-crop-widget>`; la imagen se usa en la lista de precios). Datos: Código, Categoría, Descripción, Activo y Lista de precios (clic para alternar), Paquete; para no-paquete: Proyecto (flujo, días, propietario), Citas (categoría, duración, días, persona); Precio de venta, Precio min, Cuenta Ventas, Costo (con %), Margen (con %); para paquete: precio, mínimo, costo, margen. Etiquetas.

Pestañas: **Información general** (contadores Pedidos / Clientes / Presupuestos → sub-vistas §3.8 y §5.6; `GET /products/info/:id`), **Costos** (no paquete), **Artículos de paquete** (paquete; en rojo si está vacío), Notas, Actividad, Archivos adjuntos.

### 9.4 Paquetes (`v/views/products/pack_items.html`, `ProductsController.loadPacks/saveAllPacks`)

Tabla editable en línea: # (id producto), Código, Nombre (selector de productos **que no son paquetes**, `GET /products/list?exclude_pack=1`), Precio (defecto el del producto, editable), Desc (%), Cant. (>0), Total = precio × cant × (100 − desc)/100. Total del paquete. Guardar → `POST /products/pack/:id` con `packs` y `total_pack`: **el precio del paquete pasa a ser la suma de sus ítems** y el servidor devuelve el costo del paquete. En el presupuesto/pedido el paquete entra como **un solo ítem** con su precio; si al emitir el pedido se "explota" en componentes para proyectos/costos: **no determinable estáticamente**.

### 9.5 Lista de precios pública `print.pricelist/:unique_id` (`v/views/products/pricelist_print*.html`, `ProductsController.loadPricelist`)

`GET /products/pricelist/{unique_id del estudio}` devuelve productos con "Lista de precios = Sí" **agrupados por categoría**. Muestra: encabezado del estudio, "Lista de precios", Emisión (hoy); por grupo: nombre, descripción, foto (galería ampliable), precio; al final Condiciones de pago y Condiciones generales de Configuración → Condiciones. Si no existe: 404. Se comparte con la variable `[pricelist_link]` en correos y desde el menú.

### 9.6 Precio mínimo

Configuración → Productos → "Precio Mínimo: Activar" (`products_min_price`), requiere plan avanzado. Hace obligatorio el campo en cada producto y activa las alertas de §4 en ítems y totales.

---

## 10. Facturas (Invoices) e IVA

### 10.1 IVA en el pedido (`OrdersController.updateTotals`, `process_save`)

Configuración (§13.4): IVA activo, porcentaje, "El precio del producto incluye el IVA" (`price_include_vat`), cuenta de IVA, encabezado fiscal.

- **Precio incluye IVA:** `vat = total − total/(1 + %/100)`; `grand_total = total`.
- **Precio sin IVA:** `vat = redondeo(total × %)/100`; `grand_total = total + vat`; los **pagos deben sumar el Total Final**.
- Interruptor por pedido "IVA Sí/No". Si se apaga, se guarda `vat = 0` y `grand_total = 0` (el 0 significa "sin IVA").
- Al reabrir un pedido: si `total == grand_total` → incluye IVA; si `grand_total == 0` → toma la configuración general; si no → no incluye.

### 10.2 Crear factura (`v/views/invoices/modal_invoice_date.html`, `OrdersController.modalInvoiceDate`)

Desde la ficha o el panel del pedido: "Crear Nueva Factura – Elija una fecha de factura": **Hoy**, **Fecha del Pedido** o **Fecha personalizada**. Envía `POST /invoices` con `order_id`, `vat`, `grand_total`, `created`. Mensaje "Factura creada con éxito" y va al listado. Permiso: borrar ventas o admin; IVA activo. Si se puede emitir más de una factura por pedido: **no determinable** (la UI no lo impide).

### 10.3 Listado `invoices.index` (`v/views/invoices/index.html`, `InvoicesController`)

Migas: Inicio › Pedidos › Facturas. Botones: Exportar en CSV (admin), Imprimir → Resumen (`print.invoices_summary`). Filtros: **Estado** (Todo / Abierto / Anulado → `status` = `all|open|canceled`), **Período** (`period_table`, sobre la fecha de la factura; "Otro período" con rango), Buscar. Columnas: # (rojo si anulada, amarillo si negativa) · Creado · Pedido · Nombre (+ cliente hover) · Total · IVA · Total Final · acciones (Imprimir; **Anular Factura** si no anulada y IVA > 0). Pie con totales del filtro (`order_total`, `total_vat`, `grand_total`). Clic en fila → ficha del pedido.

**Anular** (`v/views/invoices/modal_cancel.html`): "¿Desea anular la factura #X? IMPORTANTE: Esta acción generará una nueva factura con valores negativos y no se puede deshacer" → `POST /invoices` con `type: "cancel"`, `vat` y `grand_total` negativos. Permiso: borrar ventas o admin.

### 10.4 Impresión de factura `print.invoice/:id` (`v/views/invoices/view_print_include.html`)

Encabezado fiscal (`vat_header`) o encabezado normal + NIF del estudio (`cnpj`); "Factura #id", Emisión; Cliente con dirección, código postal y NIF; Propietario; Nombre del trabajo; datos del evento; ítems; totales (Total, "Total de la Factura", IVA (%), Total Final según incluya o no IVA); tabla de pagos (se oculta en la factura negativa); campos adicionales; Memo; líneas de firma "Emitido por" y "Cliente". En la factura de anulación todos los importes se muestran negativos.

---

## 11. Informes de ventas e IVA

### 11.1 Ventas `reports.sales` (`v/views/reports/sales.html`, `ReportsController.loadSales`, `POST /reports/sales`)

Matriz **filas = agrupador × columnas = meses** del período. Botones: Exportar en CSV (`sales_reports.csv`), Imprimir (`print.reports({link:'sales'})`, plantilla no disponible localmente).
- **Agrupar por** (persistido en `localStorage.report_sales_group_by`, defecto Producto): Vendedor · Producto · Cliente · Referente · Origen de la oportunidad · Clase (si clases + avanzado) · Categoría de Producto · Categoría de Presupuestos · Etiqueta de Pedidos · Etiqueta de Vendedores.
- **Filtrar por período** (`period_table_results`, persistido `report_period`; "Otro período" con rango).
- Totales por fila, por columna y general. Cada celda es un enlace a **Detalles**.
- Nota en pantalla: "Los valores del informe por producto y categoría de producto no calculan los descuentos concedidos en el pedido."
- Qué pedidos cuentan (¿estados? ¿fecha de emisión o del trabajo?): **no determinable estáticamente**.

### 11.2 Detalles `reports.sales_details` (`v/views/reports/sales_details.html`, `POST /reports/sales_details`)

Título "Informes de Ventas • Pedidos · {agrupador}: {valor} • Período: mes". Buscador; columnas #, Emisión, Nombre (+cliente), Fecha del trabajo/evento, Categoría, Total, Vendedor, Ver; totales de página y generales; paginación. (Defecto: el clic abre la **oportunidad** con el id del pedido, §19.)

### 11.3 IVA `reports.vat` (`v/views/reports/vat.html`, `POST /reports/vat`)

Matriz filas = pedidos (#, nombre) × meses, con importe de IVA; totales; período; CSV; imprimir. Si toma facturas o pedidos: **no determinable**.

---

## 12. Impresiones y enlaces públicos

| Documento | Ruta | Identificador | Pública | Archivo |
|---|---|---|---|---|
| Presupuesto | `/#/print/quote/{unique_id}` | `unique_id` (hash) | sí; marca Visto | `v/views/quotes/view_print_include.html` |
| Pedido | `/#/print/order/{unique_id}`; el correo usa `{rooturl}/order/{unique_id}` | `unique_id` | sí; **no marca visto** | `v/views/orders/view_print_include.html` |
| Factura | `/#/print/invoice/{id}` | **id numérico** | sí (ver §19) | `v/views/invoices/view_print_include.html` |
| Lista de precios | `/#/print/pricelist/{unique_id estudio}` o `{rooturl}/pricelist/{unique_id}` | `unique_id` del estudio | sí | `v/views/products/pricelist_print_include.html` |
| Resumen de pedidos | `print.orders_summary(...)` | filtros | no | `v/views/orders/index_print_summary.html`: #, Estado, Emisión, Nombre, Cliente, Fecha del trabajo (fecha+hora), Categoría, Total, Propietario, Clase (si aplica); total general |
| Pedidos detallado | `print.orders(...)` | filtros | no | `v/views/orders/index_print.html`: #, Estado, Nombre+cliente, Fecha del trabajo, Prior, Flujo, Etapa/%, Fecha límite/Fecha Final (parece copiada de proyectos) |
| Resumen de facturas | `print.invoices_summary(...)` | filtros | no | `v/views/invoices/index_print_summary.html`: #, Creado, Pedido, IVA, Total, "Anulado" |
| Listas de presupuestos | `print.quotes`, `print.quotes_summary` | | no | **plantillas 404** |
| Recibo de pago | `/#/print/receipt/{receipt_id}.{receipt_key}` | | | (módulo Finanzas) |

Todas las impresiones llevan logo (`logo_print`, alineación `logo_print_hpos`), datos del estudio, pie configurable (`print-footer-message`) y fecha/hora de impresión, y se imprimen automáticamente al cargar (`after-render-print`).

---

## 13. Configuración relacionada

Menú de Configuración (`settings_menu.txt`, `SettingsController`); todas las pantallas son sólo para admin (`settings` restrict admin).

### 13.1 Presupuestos → Categorías de Presupuestos (Quote Categories) (`v/views/settings/quotes.html`)

"Son como una familia de productos/servicios que usted ofrece…". Tabla ordenable arrastrando: Nombre, Grupo (Boda/Evento/Trabajo con fecha/Trabajo sin fecha), Activo (clic), Herramientas (Editar, **Editar Presupuesto** estándar, Borrar). Alta en línea. Guardar/Deshacer (`Categories.save`). Tabla explicativa de grupos: Boda pide fecha/hora, invitados, novios, ceremonia y recepción; Evento pide fecha/hora, invitados y lugar; Trabajo con fecha pide fecha/hora y lugar **sólo en pedidos**; Trabajo sin fecha no pide nada.

**Editar Presupuesto (estándar)** por categoría: Asunto, Cuerpo (editor enriquecido), Adjuntos (hasta 10 MB c/u), variables `[customer_name] [customer_firstname] [customer_lastname] [customer_company] [customer_email] [my_name] [my_firstname] [my_lastname] [my_email] [company_name] [company_email] [company_website] [company_phone] [pricelist_link]`. Se guarda como plantilla `default_quote_{id}` (`POST /settings/mail_templates`, `subtype: quotes`). Si no existe, usa la copia del "Presupuesto Estándar Master".

### 13.2 Presupuestos → Condiciones (Terms) (`v/views/settings/terms.html`)

"Términos y Condiciones para los presupuestos": **Condiciones de pago** (`quote_payment_conditions`) y **Mensaje personalizado** (Custom Message → en realidad `quote_general_conditions`). "Este texto se utilizará en la Lista de Precios y Presupuestos."

### 13.3 Productos (`v/views/settings/products.html`)

Pestaña Precio Mínimo: Activar Sí/No (`products_min_price`).

### 13.4 Pedidos (`v/views/settings/orders.html`, `SettingsController.loadOrder`)

- **Cuentas en Pedidos:** cuenta para Otros gastos (ingresos), cuenta para Descuento* (gastos, prefijo 5).
- **Edición de pedidos:** "No permitir la edición de pedidos completados o cancelados" (`order_edit_blocked`).
- **IVA y Facturas** (oculto si el estudio es de Brasil): Activar IVA, IVA (%) (sólo dígitos, obligatorio), "El precio del producto incluye el IVA", Cuenta para IVA (si no incluye; defecto `3.9`), Datos fiscales para el encabezado de la factura (editor enriquecido). Advertencia de validez fiscal (no válido en Brasil y Portugal).

### 13.5 Tareas de Pedidos (Orders Tasks) (`v/views/settings/order_tasks.html`)

Lista de **flujos** tipo `order_stage` (mínimo uno): Modificar Nombre, Editar Etapas, Borrar, Clonar, Añadir. Cada flujo de pedido tiene **una sola etapa** con un bloque de tareas (una por línea; se eliminan líneas vacías). "Contiene las Tareas que desee crearse automáticamente cuando se agrega un Pedido con el estado Abierto." Endpoints de Stages/Categories (documento de configuración general).

### 13.6 Numeración de Tablas (`v/views/settings/tables.html`)

Número inicial de Oportunidades, Presupuestos, Pedidos, Facturas, Contratos (con módulo ventas) y Proyectos (con módulo proyectos). "Utilice sólo números". "No es posible reiniciar utilizando una secuencia de numeración inferior." `GET/POST /settings/numbering`. Registra actividad con los valores.

### 13.7 Plantillas de Correo (`v/views/settings/email_templates.html`, `app.js` `MailVariables`)

**Oportunidades y Presupuestos** (`type=leads`):
| Clave | Pestaña | Uso | Variables extra |
|---|---|---|---|
| `newlead_notif` | Notificación de Nueva Oportunidad | al usuario cuando entra un formulario | `lead_category`, `event_date`, `event_place`, `event_city`, `event_state`, `message`, `lead_link`, `lead_number` |
| `autoreply` | Respuesta automática | al cliente tras el formulario | `email_signature`, `pricelist_link` |
| `default_quote` | Presupuesto Estándar Master | plantilla base de los estándar; **admite adjuntos** | `lead_number`, `attaches_box`, `pricelist_link` |
| `custom_quote` | Presupuesto personalizado | envío de presupuesto armado; **admite adjuntos** | `quote_number`, `lead_number`, `link`, `attaches_box`, `pricelist_link` |
| `followup` | Seguimiento | automático X días después | `lead_number`, `pricelist_link` |

**Pedidos** (`type=orders`):
| Clave | Pestaña | Uso | Variables extra |
|---|---|---|---|
| `order_access` | Acceso a la Área de Cliente | botón "Enviar acceso al Área de Cliente" | `link`, `order_number` |
| `order` | Factura (Invoice) | botón "Enviar" del pedido | `link` (pedido público), `order_number` |

Variables comunes: `customer_name/firstname/lastname/company/email/mobile`, `company_name/email/website/phone`, `email_signature`.

### 13.8 Otras configuraciones que tocan el módulo

Campos Adicionales (etiquetas `order_extra1..4`, `order_date1..2`), Clases (`classes_active`, `classes_in_orders`), Categorías de Productos, Métodos de pago, Plan de cuentas, Área de Cliente (`customer_area_quotes`, `customer_area_orders`), Formulario de oportunidad (`custom_form_lead`: renombra Novia/Novio). Se documentan en el archivo de Configuración.

---

## 14. Correos, WhatsApp, actividades y notificaciones

- **Correo:** todos los envíos abren el compositor lateral (`MailsController`, evento `mail:popup`) con la plantilla ya rellenada; el usuario puede editar antes de enviar. Al enviarse se emite `mail:sent` con `meta` (`type`, `subtype`, `target_id`, `customer_id`), que usan los presupuestos para marcar fecha de envío y los contratos para `PUT /orders/agreement_date_sent/{id}`. El pedido **no** guarda fecha de envío.
- **WhatsApp:** evento `whatsapp:messageFromModel` con celular y enlace público (presupuesto y pedido).
- **Actividades** (`Activities.save`) registradas: presupuesto creado/guardado/borrado; pedido creado/guardado ("Order X was saved"), cambio de estado, de próximo contacto, de fecha de finalización, de cliente, de propietario, de delegado; tareas creadas; costos guardados; productos creados/guardados/borrados/activados/agregados a lista; etiquetas cambiadas; facturas (no se ve actividad).
- **Notificaciones** (`Notifications.save`) al propietario si "Notifiqueme de cambios" está activo; al nuevo propietario/delegado; a los responsables de proyectos y citas creados o eliminados; y `POST /orders/notify_status_change` por cada persona de cita creada ("N"), cancelada ("C") o eliminada ("R") — probablemente envía correo/aviso de agenda (**no determinable**).

---

## 15. Estados y transiciones

### 15.1 Presupuesto

No hay campo de estado. Ciclo implícito:
```
Creado ──(se envía por correo custom_quote)──► Enviado (sent_date)
   └──(cliente abre el enlace público)──► Visto (viewed)  → ya no editable (sólo clonar)
Oportunidad Ganada + "Crear Pedido" ──► Pedido (quote_id)
```
El vencimiento (`valid_thru_days`) es sólo informativo. No hay "aceptado/rechazado".

### 15.2 Pedido

```
            ┌─────────────── alta (Abierto o Venta Completada; "Cancelado" no se ofrece en alta)
            ▼
   [471 Abierto] ──editar estado──► [475 Venta Completada] ──► genera Cuentas por Cobrar,
        │   ▲                             │                    proyectos y citas por producto,
        │   └─────────────────────────────┘ (volver a Abierto borra fecha de finalización)
        └──────────────► [474 Cancelado] ──► elimina proyectos y citas creados (auto_remove_notify "C")
   [476 Pedido Rápido]  (sólo por el editor rápido; cobrado al instante; no aparece en el selector)
```
- Cambio a cualquier estado ≠ Abierto pone Fecha de finalización = hoy (editable).
- **Tareas del pedido:** sólo en estado Abierto y una única vez (`tasks_created`): al guardar, cada línea del textarea se crea como Tarea (`Tasks.save` tipo `orders`, vencimiento hoy, sin completar) y avisa "{n} tareas fueron añadidas". El seguimiento de tareas se hace en el panel general de Tareas; los endpoints `GET /orders/progress/{id}/{offset}/{count}` y `PUT /orders/set_fup/{id}/{enable_followup}` existen pero **no se usan en ninguna vista local**.
- `POST /orders/batch_finish` (marcar completados en lote) existe; su modal no está disponible (404) ni tiene botón.
- Qué exactamente se crea al pasar a Venta Completada (y si al volver a Abierto se revierten cuentas/proyectos): **no determinable estáticamente**.

### 15.3 Regla de edición (`v/views/orders/index.html`, `view.html`, `detail.html`)

| Estado | Admin | No admin con `order_edit_blocked = 1` | No admin sin bloqueo |
|---|---|---|---|
| Abierto | edita | edita | edita |
| Venta Completada / Cancelado | edita | **bloqueado** (modal "Restrict Access: debe ser administrador") | edita |
| Pedido Rápido | edita (editor rápido) | **bloqueado** | edita (editor rápido) |

### 15.4 Oportunidad (sólo lo que toca este módulo)

Marcar Ganada (422) desde la oportunidad ofrece crear pedido; crear pedido desde presupuesto de oportunidad no ganada la marca Ganada.

---

## 16. Relaciones entre entidades

```
Contacto (cliente) ─┬─< Oportunidad (lead, categoría = Categoría de Presupuestos)
                    │        ├─< Presupuesto (quote) ─< Ítem de presupuesto ─> Producto
                    │        ├─< Costo de oportunidad
                    │        └─ (Ganada) ─► Pedido
                    └─< Pedido (order) ── lead_id?, quote_id?, referrer_id?, contractor1/2
                             ├─< Ítem de pedido ─> Producto (simple o paquete ─< ítems de paquete)
                             ├─< Pago (cuota) ──► Movimiento financiero AR (account_trans) ─► Recibo
                             ├─< Costo (proveedor, cuenta) ──► Cuenta por Pagar (si vencimiento)
                             │        └ product_id / product_cost_id ─> Costo-plantilla del producto
                             ├─< Contrato (agreement) ─ firma online
                             ├─< Proyecto (auto por producto.project_create, o manual)
                             ├─< Cita (auto por producto.event_create, o manual)
                             ├─< Tarea (desde flujo "Tareas de Pedidos")
                             ├─< Factura (si IVA) ─< Factura negativa (anulación)
                             └─ "Crear una oportunidad basada en este pedido" ─► nuevas Oportunidades (+ presupuesto)
Producto ─< Costo-plantilla (días desde el evento) ; Producto ─ reglas de Proyecto y Cita
```

Detalle de "Crear una oportunidad basada en este pedido" (`leads.batch?order_id`, `LeadsController.loadByOrder`): precarga una alta **en lote** de oportunidades copiando el pedido (ítems, categoría), pone **Referente = cliente del pedido**, `create_quote = 1` (crea automáticamente un presupuesto por cada oportunidad con los ítems y condiciones por defecto) y permite agregar varios clientes (`customers[]`). Sirve para vender a invitados/referidos de un evento (p. ej. padres de alumnos). Endpoint `Leads.save_batch` (documento de Oportunidades).

Relación con Contratos: el contrato se crea desde el pedido con una plantilla y toma los Contratantes 1 y 2; `PUT /orders/agreement_date_sent/{id}` marca en el pedido la fecha de envío del contrato (`agreement_sent_date`).

---

## 17. Modelo de datos inferido

> Campos observados en vistas y controladores. Tipos inferidos. (*) = campo calculado o de unión devuelto por el servidor.

### 17.1 `quotes` (Presupuesto)
| Campo | Tipo | Notas |
|---|---|---|
| id | entero | numeración configurable |
| unique_id | texto | enlace público |
| lead_id | FK oportunidad | obligatorio |
| customer_id | FK contacto | |
| user_id | FK usuario | vendedor (se pisa con el que edita, §19) |
| name, description | texto | se llenan al crear desde alta en lote |
| created, modified | fecha-hora | |
| sent_date | fecha-hora | |
| viewed | fecha-hora | |
| valid_thru_days | entero | |
| priority_id | 410/411/412 | |
| total_products, other_expenses, discount, total | decimal | |
| discount_percent, show_item_prices, show_totals | 0/1 | |
| payment_conditions, general_conditions, message | texto | |
| attach_count, quote_item_count, short_url | | |
| (*) customer_name/lastname/email/email2/phone/cellular/city/state/country/company, leads_event_date, user_name, user_avatar, lead_status_id, category_id, lead{…}, customer{…} | | |

### 17.2 `quote_items` / `order_items` (mismo formato)
`id`, `quote_id`/`order_id`, `product_id`, `code`, `name`, `description`, `price`, `min_price`, `qty` (decimal), `discount` (%), `total`, `min_total`, `costs` (sin UI), orden (posición en la lista).

### 17.3 `orders` (Pedido)
| Grupo | Campos |
|---|---|
| Identidad | id, unique_id, name, category_id, (*)category_name, (*)category_subtype, status_id, priority_id?, tags, memo, description |
| Fechas | add_date (emisión), event_date (trabajo), completed_date, due_date (próximo contacto), extra_date1, extra_date2, created, modified, agreement_sent_date |
| Personas | customer_id, referrer_id, contractor1_id, contractor2_id (+ objetos), user_id (vendedor), delegated_id, follow_delegated |
| Orígenes | lead_id, quote_id |
| Evento | guests, bride_name, groom_name, place_event, place_reception, city_event, state_event, country_event |
| Clasificación | class_id, (*)class |
| Flujo | pipeline_id, stage_id, tasks_created, project_created, event_created |
| Importes | total_products, other_expenses, discount, discount_percent, total, vat, grand_total, cost, show_item_prices, show_totals |
| Extras | extra1..extra4 |
| Hijos | order_items[], order_payments[], order_costs[] |
| (*) | info{items,payments,costs,agreements,projects,events}, order_projects, order_completed_projects, customer{…}, user_name, user_avatar, status_name, pipeline_name, stage_name, stage_percent, final_due_date |

### 17.4 `order_payments` (Cuota)
id, order_id, due_date, category_id (método), (*)category_name, value, document, memo, cleared, cleared_date, deleted, charge_issued, bank (código de cuenta bancaria), (*)bankName, account_trans_id, receipt_id, receipt_key, boleto_token, boleto_status, boleto_numero.

### 17.5 `costs` (Costo)
id, type (`orders`/`leads`/`products`), target_id, vendor_id, (*)vendor_name, vendor_email, account_cogs_id, (*)account_cogs_name, name (descripción), cost (importe), cost_due_days (plantilla), due_date (pedido), cleared, product_id, product_cost_id.

### 17.6 `products` (Producto)
id, code, name, description, category_id, (*)category_name, tags, avatar/photo, pack, (*)item_count, price, min_price, account_sale_id, (*)account_sale_name, active, list, cost, project_create, project_user_id, project_offset_days, project_pipeline_id, (*)project_pipeline_name, event_create, event_user_id, event_offset_days, event_duration, event_type_id, (*)event_type_name, created, modified.

### 17.7 `product_packs` (Ítem de paquete)
pack_id, product_id, code, name, price, discount, qty, total.

### 17.8 `invoices` (Factura)
id, order_id, created, vat, grand_total, (*)total, cancelled/status, type (`cancel` en la negativa); la vista trae el pedido completo con `invoice{id, created, vat}`.

### 17.9 Configuración (`settings`)
quote_message, quote_payment_conditions, quote_general_conditions, products_min_price, order_account_other_expenses, order_account_discount, order_edit_blocked, vat_active, vat_percentage, price_include_vat, vat_account, vat_header, order_extra1..4, order_date1..2, classes_active, classes_in_orders, customer_area_quotes, customer_area_orders, unique_id (del estudio), MailTemplates{default_quote, default_quote_{cat}, custom_quote, followup, autoreply, newlead_notif, order, order_access}; numeración {leads, quotes, orders, invoices, agreements, projects}.

---

## 18. API: operaciones por recurso

(`endpoints.txt` y fábricas `$resource` en `app.js`; base `SERVER_URL`)

**/quotes** — `GET /quotes?id=` (uno), `POST /quotes` (crear), `PUT /quotes/:id` (actualizar), `DELETE /quotes/:id`, `POST /quotes/paginate`, `GET /quotes/all` (sin uso visto), `GET /quotes/unique/:unique_id` (público), `PUT /quotes/viewed`, `PUT /quotes/date_sent/:id`, `GET /quotes/:type/:id/:offset/:count`, `POST /quotes/batch_delete`.

**/orders** — `GET /orders?id=`, `POST /orders`, `PUT /orders/:id`, `DELETE /orders/:id`, `POST /orders/paginate`, `GET /orders/all` (CSV), `GET /orders/list` (selector de pedidos en proyectos), `GET /orders/items?id=`, `GET /orders/status` (sin uso), `GET /orders/unique/:unique_id` (público), `GET /orders/:type/:id/:offset/:count`, `GET /orders/progress/:id/:offset/:count` (sin uso), `PUT /orders/set_fup/:id/:enable_followup` (sin uso), `PUT /orders/set_cost_accounts/:id`, `PUT /orders/agreement_date_sent/:id`, `POST /orders/notify_status_change`, `POST /orders/batch_delete|batch_priority|batch_users|batch_finish|batch_duedate`, `POST /orders/single_duedate`.

**/products** — `GET /products?id=`, `POST /products`, `PUT /products/:id`, `DELETE /products/:id`, `POST /products/paginate`, `GET /products/list` (opcional `exclude_pack=1`), `GET /products/all`, `GET /products/info/:id`, `GET|POST /products/costs/:id`, `GET /products/clone_costs/:from_id/:to_id`, `GET|POST /products/pack/:id`, `GET /products/clone_pack/:from_id/:to_id`, `GET /products/pricelist/:unique_id` (público), `PUT /products/set_active/:id/:column/:active`, `POST /products/batch_delete` (+ batch_priority/users/finish/duedate y single_duedate copiados de pedidos, sin uso).

**/costs** — `GET /costs/:type/:target_id`, `POST /costs/:type/:target_id` (guarda todos), `PUT /orders/set_cost_accounts/:id`.

**/invoices** — `GET /invoices/:id`, `POST /invoices` (crear o anular con `type:"cancel"`), `POST /invoices/paginate`.

**/settings** — `GET /settings/`, `POST /settings/...` (guardar), `GET|POST /settings/numbering`, `POST /settings/quotes` (`save_quote`, **sin uso visto**), `POST /settings/mail_templates`.

**/reports** — `POST /reports/sales`, `POST /reports/sales_details`, `POST /reports/vat`, `POST /reports/sales_results` (finanzas).

---

## 19. Defectos y rarezas detectadas en Alboom

(Útiles para no replicarlos y para anticipar datos "sucios" al migrar.)

1. **El presupuesto pierde su vendedor y su fecha de creación al editarse:** `QuotesController.save` pone `user_id = usuario actual` y `created = ahora` en cada guardado (`app.js`). En la migración, `created` puede no ser la fecha real de creación.
2. `act_notify` de Presupuestos y de Productos usa `Notifications` sin inyectarlo → falla silenciosa si "Notifiqueme" está activo (`app.js` QuotesController, ProductsController).
3. El botón "+ nuevo producto" del modal de ítems usa sintaxis de Angular 2 (`*ngIf`) que AngularJS ignora: aparece en todos los contextos (`v/views/common/modal_items.html`).
4. En Detalles del informe de ventas, el clic abre `leads.view` con el **id del pedido** (`ReportsController.index_go`).
5. Plantillas faltantes (404): `quotes/detail.html`, `quotes/index_print*.html`, `products/index_print.html`, `orders/modal_finish_checked.html`, `reports/sales_results.html`; `products/detail.html` es una copia de la ficha de usuario.
6. Columna "Proy" del listado de pedidos ordena por `event_date`.
7. La nube de etiquetas aparece en presupuestos aunque no tienen etiquetas.
8. `Orders.get_info` no existe en la fábrica (`loadInfo` rompería; no se usa en vistas).
9. Al crear **cualquier** producto se llama `clone_costs` con origen nulo.
10. `loadOrder` lee `classes_in_fanances` (error de tipeo) y `price_include_vat || 1` (un 0 numérico se convertiría en 1).
11. En la ficha del pedido `price_include_vat = total < grand_total` (lógica invertida respecto al editor).
12. La factura se imprime por **id numérico** con ruta pública → se pueden enumerar facturas ajenas si el servidor no valida (a verificar).
13. En el editor rápido `order_payments` pasa de lista a objeto (`express_edit`), inconsistencia de datos.
14. El resumen de facturas usa `row.status == 1` para "Anulado" y el listado usa `row.cancelled`.
15. Los filtros de período del pedido (emisión y trabajo) comparten las mismas fechas de rango.
16. Etiqueta "Mensaje personalizado" en Condiciones guarda en realidad "Condiciones generales".
17. Textos mezclados en portugués (boleto, borrar pago) y traducciones con errores ("Presuposto", "Ese Año", "Movile").

---

## 20. Mejoras propuestas para FOTOFFICE

### 20.1 Presupuestos
- **Estados explícitos**: Borrador → Enviado → Visto → Aceptado / Rechazado / Vencido (con `valid_until` real calculado y aviso antes de vencer).
- **Aceptación online por el cliente** en la vista pública: botón "Acepto", elección entre **opciones/alternativas** (paquete A/B/C) y extras opcionales; firma simple; al aceptar, crear el pedido automáticamente (o dejarlo "listo para confirmar") y mover la oportunidad a Ganada.
- **Versionado** en lugar de "no editable tras visto": cada edición crea v2, v3…, conservando lo que vio el cliente.
- Registrar **cada** apertura (cantidad, primera y última), no sólo la primera, y notificar al vendedor.
- No pisar vendedor ni fecha de creación; auditoría de cambios.
- Plantillas de presupuesto (ítems + condiciones predefinidas por categoría) para armar en un clic, en vez del "Presupuesto Estándar" que sólo es un correo.
- Presupuesto sin oportunidad previa (crear la oportunidad automáticamente).

### 20.2 Ítems, descuentos e impuestos
- Descuento por ítem en % **o importe**; descuento global aplicado antes o después de impuestos, configurable.
- Impuesto **por ítem** (alícuotas distintas: 21 %, 10,5 %, exento) en lugar de un IVA único por estudio; adaptado a Argentina (Responsable Inscripto / Monotributo, factura A/B/C).
- Ítems de texto libre (sin producto) y **secciones/títulos**; ítems opcionales.
- Cantidades con unidad (horas, fotos, copias).
- Precio mínimo con **pedido de aprobación** al admin en vez de bloqueo duro.

### 20.3 Pedidos
- Fusionar "Pedido" y "Pedido Rápido" en un solo formulario con modo "cobro en el acto".
- Estados configurables + estados intermedios (Confirmado, En producción, Entregado) y separar **estado comercial** de **estado de producción** (hoy "Venta Completada" dispara la contabilidad).
- Hacer explícito y reversible qué se genera al confirmar (cuentas a cobrar, proyectos, citas, costos) con una vista previa antes de guardar ("se crearán 3 cuotas, 1 proyecto, 2 citas").
- Tareas del pedido como **checklist propio del pedido** con avance (%) y responsables, no sólo tareas sueltas.
- Plan de cuotas con **seña/anticipo** explícito, cuotas por % y recargo/interés; vencimientos relativos a la fecha del evento ("50 % a la firma, 50 % 7 días antes del evento").
- Múltiples contratantes (no sólo 2) reutilizando la ficha de contacto, con sincronización opcional.
- Adjuntar el contrato y cobrar la seña desde el enlace público (integración con DNX Payments / Mercado Pago).
- Guardar fecha de envío y de visualización también para el pedido.

### 20.4 Productos
- Paquetes con componentes que se **explotan** para costos/proyectos, y precio de paquete independiente (con descuento visible respecto a la suma).
- Costos-plantilla por **cantidad** (por unidad vs. fijo) y por proveedor, con margen objetivo y alerta.
- Variantes (tamaño, cantidad de fotos) y listas de precios múltiples (por temporada, por tipo de cliente) con vigencia.
- Lista de precios pública con diseño, filtro por categoría y botón "pedir presupuesto".

### 20.5 Facturas
- Integrar facturación electrónica argentina (ARCA/AFIP: CAE, punto de venta, tipo A/B/C) en vez de facturas internas; nota de crédito real en lugar de "factura negativa".
- Enlace público con token, no id numérico.

### 20.6 Listados, filtros e informes
- Filtros combinables y guardables ("vistas guardadas") con chips visibles; rangos de fecha separados para emisión y trabajo.
- Exportación CSV/Excel para todos los roles con permiso, respetando columnas visibles.
- Informes con embudo presupuesto → pedido (tasa de conversión, tiempo medio, ticket medio), ventas por fecha de trabajo vs. de emisión, margen por producto **con** descuentos prorrateados.

### 20.7 Migración
- Mapear `order_status` (471/474/475/476) y reconstruir "Pedido Rápido" como pedido cobrado.
- Recalcular totales al importar y marcar diferencias (por los redondeos y el defecto de `created`).
- Importar pagos con su estado cobrado y vínculo al movimiento financiero; costos con proveedor y vencimiento.
- Presupuestos: `viewed` → estado Visto; los vinculados a pedido (`quote_id`) → Aceptado.

---

## 21. Dudas para verificar en vivo

1. ¿Qué genera exactamente el servidor al pasar un pedido a **Venta Completada**: cuentas a cobrar (una por cuota), asientos de venta por producto, de "otros gastos", descuento e IVA? ¿Qué ocurre si luego se vuelve a Abierto o se cancela (¿se borran las cuentas no cobradas?)?
2. ¿Los costos-plantilla del producto se multiplican por la cantidad del ítem? ¿El vencimiento del costo es fecha del evento + días? ¿Qué pasa si el pedido no tiene fecha de evento?
3. ¿`set_cost_accounts` borra y recrea todas las cuentas por pagar del pedido o sólo las nuevas?
4. ¿Un paquete, al venderse, crea proyectos/citas/costos de sus componentes o sólo del paquete?
5. ¿El cambio de "Prioridad de Oportunidad" en el presupuesto actualiza la oportunidad?
6. ¿Dónde se edita `quote_message` (mensaje del correo del presupuesto)?
7. ¿El seguimiento automático (`followup`) se dispara por presupuesto enviado y cuántos días? ¿Se detiene al ganar la oportunidad?
8. ¿Los cambios a los Contratantes en el pedido modifican la ficha del contacto?
9. ¿Se pueden emitir varias facturas para un mismo pedido? ¿La numeración de facturas es correlativa sin huecos, incluidas las negativas?
10. ¿La ruta pública `print.invoice/{id}` muestra facturas sin sesión (riesgo de enumeración)?
11. Informe de ventas: ¿qué estados de pedido entran y por qué fecha agrupa (emisión, finalización o trabajo)? ¿El informe de IVA usa facturas o pedidos?
12. Filtros del listado de pedidos: ¿cómo combina el servidor período de emisión y período de trabajo cuando se usan juntos (fechas compartidas)? ¿La búsqueda incluye nombre de producto?
13. ¿El enlace público del pedido (`/order/{unique_id}`) es accesible sin sesión y registra algo?
14. ¿Qué pasa con las tareas del pedido si se cambia el flujo después de creadas?
15. ¿Existe en la versión en vivo algún botón de aprobación del presupuesto por el cliente (p. ej. en Área de Cliente) que no esté en estas plantillas?
16. ¿Qué devuelve `GET /quotes/all`, `/orders/status`, `/orders/progress` y `set_fup` (endpoints sin uso en vistas)?
17. ¿Formato y columnas reales de los CSV de presupuestos, pedidos, productos y facturas (sirven de fuente de migración)?
18. ¿Cómo se ve el "Pedido Rápido" en Finanzas (movimiento cobrado en la cuenta bancaria elegida)?
