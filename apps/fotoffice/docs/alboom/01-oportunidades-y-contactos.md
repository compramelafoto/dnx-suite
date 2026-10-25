# Alboom CRM — Módulo 01: Oportunidades (leads) y Contactos

> Análisis funcional **estático** (solo archivos locales: `app.js`, `v/views/**`, `endpoints.txt`, `es.json`, `settings_menu.txt`). No se abrió el sistema en vivo.
> Objetivo: documentar el módulo para replicarlo mejorado en FOTOFFICE y migrar los datos.

## 0. Cómo leer este documento

- **Nombres de pantalla y botones**: se usan en español tal como los muestra la interfaz (según `es.json`), con el original en inglés entre paréntesis la primera vez. Ejemplo: *Oportunidades (Opportunities)*.
- **Citas de origen**: cada afirmación indica de dónde sale.
  - Plantillas: ruta relativa a la carpeta A, p. ej. `v/views/leads/index.html`.
  - Código: `app.js` + nombre del controlador/función. Como `app.js` está minificado en una sola línea, se generó una copia formateada con Prettier en `scratchpad/pretty/app.pretty.js`; cuando ayuda se da la línea de esa copia como `(pretty L13834)`.
- **"No determinable estáticamente"**: la regla vive en el servidor (PHP/SQL) y el panel solo envía o recibe datos; no se puede confirmar sin ver el sistema funcionando.
- **Mejora propuesta**: ideas para FOTOFFICE. Están separadas del análisis.

### 0.1 Glosario mínimo

| Término en la interfaz (es) | Original (en) | Qué es |
|---|---|---|
| Oportunidad | Opportunity / Lead | Una posible venta (una consulta de un cliente). Tabla `leads`. |
| Contacto | Contact | Una persona o empresa (cliente, proveedor, etc.). Se guarda en la **misma tabla que los usuarios** del sistema, con `role = "contact"` (ver §9.2). |
| Embudo de ventas / Embudo | Sales Funnel / Pipeline / Workflow | Secuencia de etapas por la que pasa una oportunidad. |
| Etapa | Stage | Un paso del embudo, con duración en días y tareas automáticas. |
| Estado | Status | Abierto, Ganado, Suspendido, Abandonado, Perdido, Fecha no disponible. |
| Siguiente Acción | Next Action (`due_date`) | Fecha en que hay que volver a contactar. Es el "vencimiento" de la oportunidad. |
| Fecha de cierre | Close Date (`completed_date`) | Fecha prevista o real de cierre. |
| Vendedor / Dueño / Propietario | Sales Person / Owner (`user_id`) | Usuario responsable. |
| Delegado a | Delegated to (`delegated_id`) | Segundo usuario que colabora. |
| Categoría (de oportunidad) | Category / Lead Type (`category_id`) | Tipo de trabajo (Boda, Evento, etc.). Se configura como "Categorías de Presupuestos". |
| Grupo (de categoría) | Group / subtype | `wedding`, `event`, `job_with_date`, `job_no_date`. Define qué campos extra se piden. |
| Clase | Class (`class_id`) | Clasificación transversal opcional (complemento "Avanzado"). |
| Origen de la oportunidad | Opportunity Origin (`lead_origin`) | "Cómo nos conoció". Lista de texto libre configurable. |
| Seg aut | Auto Fup (`enable_followup`) | Envío automático de correo de seguimiento. |
| Pres enviado | Quote Sent (`quote_sent_date`) | Fecha del último presupuesto enviado por correo. |

---

## 1. Mapa del módulo

### 1.1 Rutas (estados de ui-router)

Las URLs del panel son "hash" (`/#/…`). Fuente: `app.js`, bloque `.state(...)` (pretty L2733 en adelante para leads).

| Estado | URL | Plantilla | Quién puede entrar |
|---|---|---|---|
| `leads` | `/leads` | `views/common/content.html` | `user.modules.sales == "1"` |
| `leads.index` | `/leads/index/{itemCategory}/{itemPipeline}/{itemUser}/{itemExpired}/{itemClass}/{itemOrigin}/{itemPeriod}/{itemStage}` (+ parámetros ocultos `itemStartDate`, `itemEndDate`) | `views/leads/index.html` | (hereda) |
| `leads.index.details` | `…/details/:id` | `views/leads/detail.html` (panel lateral derecho) | |
| `leads.dashboard` | `/leads/leads/dashboard` | `views/leads/index.html` (duplicado del listado) | |
| `leads.pipelines` | `/leads/pipelines/{itemPipeline}/{itemUser}` (ocultos: `itemCategory="all"`, `itemExpired`) | `views/leads/pipelines.html` (kanban) | |
| `leads.view` | `/leads/view/:id` (oculto `quote_id`) | `views/leads/view.html` | |
| `leads.view.quotes` / `.costs` / `.events` | `/quotes`, `/costs`, `/events` | `views/leads/quotes.html`, `costs.html`, `events.html` | |
| `leads.edit` | `/leads/edit/{id}` (oculto `from_id` = clonar) | `views/leads/edit.html` | |
| `leads.new` | `/leads/new?customer_id` | `views/leads/edit.html` | |
| `leads.batch` | `/leads/new_batch?order_id` | `views/leads/new_batch.html` | |
| `leads.importCSV` | `/leads/importCsv` | `views/leads/import_csv.html` | |
| `forms.leads` | `/forms/leads` | `views/leads/form.html` (solo redirige a `/form_lead/#/index`) | público |
| `print.leads` | `/print/leads/{itemCategory}/{itemPipeline}/{itemUser}/{sortBy}/{reverseSort}/{searchTerm}/{itemClass}/{itemOrigin}` | `views/leads/index_print.html` | sales |
| `print.leads_summary` | `/print/leads_summary/…` (mismos parámetros) | `views/leads/index_print_summary.html` | sales |
| `print.lead` | `/print/leads/:id` | `views/leads/view_print.html` | sales |
| `contacts` | `/contacts` | `views/common/content.html` | `user_contacts == "1"` o rol `admin` o rol `contact` |
| `contacts.index` | `/contacts/index/{itemCategory}` (oculto `itemClass`) | `views/contacts/index.html` | rol admin/user |
| `contacts.index.details` | `…/details/:id` | `views/contacts/detail.html` | |
| `contacts.view` | `/contacts/view/:id` | `views/contacts/view.html` | admin/user |
| `contacts.view.leads/quotes/orders/agreements/projects/proofs/ar/ar_paid/ap/ap_paid` | subrutas | `views/contacts/<nombre>.html` | |
| `contacts.edit` | `/contacts/edit/{id}` | `views/contacts/edit.html` | admin/user |
| `contacts.new` | `/contacts/new` | `views/contacts/edit.html` | admin/user |
| `contacts.birthdays` | `/contacts/birthdays` | `views/contacts/birthdays.html` (**el archivo es un 404**, ver §12) | admin/user |
| `contacts.anniversary` | `/contacts/anniversary` | `views/contacts/anniversary.html` (**404**) | admin/user |
| `contacts.profile` / `profile_edit` | `/contacts/profile`, `/profile_edit` | `views/contacts/profile*.html` | **solo rol `contact`** (área de cliente) |
| `contacts.importCSV` | `/contacts/contacts/importCsv` | `views/contacts/import_csv.html` | |
| `reports.opportunities` | `/reports/opportunities` | `views/reports/opportunities.html` | |
| `reports.opportunities_details` | `/reports/opportunities_details/{group}/{start_date}/{id}/{name}` | `views/reports/opportunities_details.html` | |

### 1.2 Menú lateral

Fuente: `v/views/common/navigation.html` (líneas ~108-215).

**Contactos (Contacts)** — visible si rol `admin`, o rol `user` con `user_contacts == 1`:
- *Crear Nuevo (Create New)* → `contacts.new` (solo si `user_contacts_create == 1` o admin).
- *Contactos* → `contacts.index`.
- *Cumpleaños (Birthdays)* y *Aniversarios (Anniversary)*: existen en el menú pero con `ng-show="… && false"`, es decir **ocultos siempre** (función abandonada).

**Oportunidades (Opportunities)** — visible si `AppUser.modules.sales == 1`:
- *Crear Nuevo* → `leads.new`. Si se superó el límite del plan (`lead_count >= n_leads`), muestra corona y abre el modal de "recurso Pro" (`proResourceModal('lead_add','plan_limit')`).
- *Mis Oportunidades (My Opportunities)* → `leads.index({itemUser: AppUser.id, itemExpired: false})`, con **globo rojo** = cantidad de oportunidades vencidas del usuario (`dbStatus.leads.due_user`).
- *Todas las oportunidades (All Opportunities)* → `leads.index({itemUser:'all', itemExpired:false})`, globo amarillo `dbStatus.leads.due_all`. Oculto si el usuario solo ve sus ítems (`user_access_itens_only == 1`).
- *Mi embudo de ventas (My Sales Funnel)* → `leads.pipelines({itemUser: AppUser.id})`.
- *Presupuestos (Quotes)* → `quotes.index` (otro módulo).
- *Informes (Reports)* → `reports.opportunities` (si `user_reports == 1` o admin).

**Barra superior** (`v/views/common/topnavbar.html` ~L218-232): ícono de oportunidades con contador rojo *Oportunidades expiradas (Expired leads)* → `leads.index({itemCategory:'all', itemUser: AppUser.id, itemExpired:true})`. Es la **única forma de activar el filtro "vencidas"** desde la interfaz.

Los contadores `dbStatus` vienen de `Settings.get_due({id, type:'user'})` (`$rootScope.getDue`, MainController), que se refresca después de casi cada guardado.

### 1.3 Permisos que afectan el módulo

Campos del usuario logueado (`AppUser`) usados en las vistas y el controlador:

| Campo | Efecto |
|---|---|
| `role` (`admin` / `user` / `contact`) | admin ve y puede todo; `contact` es un cliente que entra al área de cliente. |
| `modules.sales` | Habilita todo el módulo de oportunidades. |
| `user_sales_create` | Crear oportunidades, crear pedido desde oportunidad, quick add en kanban. |
| `user_sales_delete` | Borrar oportunidades (individual y masivo). |
| `user_access_itens_only` | "Solo ve sus ítems": fuerza el filtro de usuario a sí mismo (`LeadsController.getData`: `user = AppUser.id`), oculta el filtro Usuario y *Todas las oportunidades*, y si abre una oportunidad ajena (ni dueño ni delegado) lo manda a `access_denied` (`loadRow`, `item_go`). |
| `user_contacts`, `user_contacts_create`, `user_contacts_delete` | Ver, crear y borrar contactos. |
| `user_reports` | Ver Informes. |

Suscripción (`AppSettings.Subscriber`, factory `Resources.check` pretty L5992): `module_sales`, `module_orders`, `module_calendar`, `module_projects`, `module_proofs`, `addon_advanced` (clases, envío de correo al cambiar etapa, precio mínimo), `addon_signature`, límites `n_leads`/`lead_count`, `n_orders`/`order_count`. Plan gratuito `plan_id == 11`: listados de actividad/notas/mensajes limitados a 30 días, columnas de presupuestos ocultas después de 30 días, informes avanzados bloqueados.

> **Mejora propuesta**: modelar permisos como roles con capacidades explícitas (ver/crear/editar/borrar/exportar por módulo) en vez de banderas sueltas en el usuario; y un alcance "propias / del equipo / todas" en lugar de un único `user_access_itens_only`.

---

## 2. Oportunidades — Listado (`leads.index`)

**Plantilla**: `v/views/leads/index.html` · **Controlador**: `LeadsController` (`loadAll`, `getData`) (pretty L13774-14300).

### 2.1 Para qué sirve y cómo se llega
Lista paginada y filtrable de oportunidades. Se llega desde el menú (*Mis Oportunidades*, *Todas las oportunidades*), el contador de vencidas de la barra superior, el botón *Modo lista* del kanban, las migas de pan de cualquier pantalla de oportunidad, y la nube de etiquetas.

### 2.2 Encabezado y botones superiores
- **Título**: nombre del filtro de estado (`itemCategoryName`: "Todo", el nombre del estado, o "Etiqueta: X"). Debajo, "chips" de texto con los filtros activos: embudo, etapa, origen, período, usuario y clase (`index.html` L102-126).
- **Nueva Oportunidad (New Opportunity)** → `leads.new`; si se superó el límite del plan, botón con corona que abre `proResourceModal`.
- **CSV ▾** (solo **admin**): *Exportar en CSV (Export to CSV)* y *Importar CSV (Import CSV)* → `leads.importCSV`.
- **Imprimir ▾ (Print)**: una sola opción *Resumen (Summary)* → `print.leads_summary` en pestaña nueva con los filtros actuales. (La impresión "detallada" `print.leads` existe como ruta pero no tiene botón, ver §12.)
- Botones de vista: **Modo Embudo** (ícono vertical → `leads.pipelines`, con `itemUser = AppUser.id` si solo ve lo propio) y **Modo lista** (activo).

### 2.3 Filtros (todos son desplegables que cambian la URL)

| Filtro (es / en) | Parámetro URL | Valores | Nota |
|---|---|---|---|
| Estado (Status) | `itemCategory` | `all` + `AppTables.lead_status`: 421 Abierto, 422 Ganado, 423 Suspendido, 424 Abandonado, 425 Perdido, 426 Fecha no disponible (pretty L17462). También `tag:<nombre>` desde la nube de etiquetas. | **Por defecto `421` (Abierto)** si no hay nada guardado. |
| Embudo de ventas (Sales Funnel) | `itemPipeline` | `all` + lista de embudos (`Stages.get_list({type:'lead_stage'}).stage_list`) | |
| Etapa del embudo (Funnel Stage) | `itemStage` | `all` + etapas del embudo elegido | Deshabilitado con tooltip "Elija un embudo para filtrar por etapa" si el embudo es `all` (`disabledFunnelStage`). Al volver a embudo `all`, la etapa se fuerza a `all`. |
| Período (Period) | `itemPeriod` (+`itemStartDate`, `itemEndDate`) | `AppTables.period_table`: Todo, Esta semana, Semana pasada, Este mes, Mes pasado, Últimos 3 meses, Últimos 6 meses, Este año, Último año, Otro período | Se aplica a la **fecha de alta** (`selectPeriod('add_date', …)`). "Otro período" abre `views/common/modal_date_range.html` (Fecha inicio / Fecha fin). |
| Usuario (User) | `itemUser` | `all` + usuarios (`Users.get_list`) mostrados "Nombre Apellido" | Oculto si `user_access_itens_only == 1`. |
| Origen (Origin) | `itemOrigin` | `all` + líneas de `AppSettings.lead_origin` | Es texto libre, se filtra por coincidencia de texto. |
| Clase (Class) | `itemClass` | `all` + `Categories.get_list({type:'class'})` | Solo si `classes_active == 1` y complemento Avanzado. |
| Vencidas | `itemExpired` (`"true"`) | booleano | Sin control en la pantalla; solo desde la barra superior o *Mis Oportunidades* (que lo pone en `false`). |
| Buscar (Search) | (no va en la URL) `searchTerm` | texto | Debounce 500 ms; busca si tiene ≥2 caracteres o está vacío. Ayuda: "Buscar todos los campos incluyendo campos adicionales" y "Para buscar fechas, utilice el formato aaaa-mm-dd". |

**Cómo se combinan**: todos se envían juntos (Y lógico) a `POST /leads/paginate` (`getData`, pretty L13869):

```
{ period, start_date, end_date, pipeline, stage, class, origin, type: <estado o tag:x>,
  user: (admin o sin restricción) ? itemUser : AppUser.id,
  expired: itemExpired=="true", pageNumber, pageSize, sortBy, sortDir: "ASC"/"DESC", searchTerm }
```
Respuesta: `{ rows: [...], count }`.

**Se recuerdan (localStorage)**: `lead_itemCategory`, `lead_itemPipeline`, `lead_itemStage`, `lead_itemPeriod`, `lead_itemStartDate`, `lead_itemEndDate`, `lead_itemClass`, `lead_itemOrigin`, `lead_sortby`, `lead_reverseSort` y `pageSize` (**compartido con todos los listados del sistema**). Si la URL trae el parámetro, pisa lo guardado. **No se recuerdan** `itemUser`, `itemExpired` ni el texto de búsqueda (`getData`, pretty L13834-13868).

Qué hace el servidor con `searchTerm` ("todos los campos incluyendo adicionales"), cómo interpreta `period` y qué considera "vencida": **No determinable estáticamente** (probablemente `due_date < hoy` y estado Abierto).

### 2.4 Columnas de la tabla

| # | Columna (es / en) | Campo | Orden por | Visible en |
|---|---|---|---|---|
| 1 | # | `id` | `id` | siempre |
| 2 | Estado | etiqueta de color según `status_id` (verde 421, azul 422, amarilla 423/426, gris 424, roja 425 — directiva `colorType`, pretty L808) | `status_id` | siempre |
| 3 | Nombre | `name` + debajo nombre del cliente (filtro `showCustomerName`: empresa si `customer_is_company==1`, si no nombre+apellido). Al pasar el mouse muestra emails, teléfono, celular, ciudad/provincia/país del cliente. | `name,customer_name` | siempre |
| 4 | Fecha del trabajo/evento (Job/Event date) | `event_date` + ícono ⚠ si hay conflicto (`lead_conflict>0` amarillo, `order_conflict>0` rojo) y el texto `conflict` | `event_date` | pantallas grandes |
| 5 | Prior (Prior) | ícono de prioridad (`priority_id`: 410 flecha arriba roja = Alta, 411 guion amarillo = Media, 412 flecha abajo azul = Baja; tooltip `priority_name`) | `priority_id` | grandes, se oculta con panel de detalle abierto |
| 6 | Etapa (Stage) | `stage_name` + barra de progreso `stage_percent` | **no ordenable** | ídem |
| 7 | Vendedor (Sales Person) | avatar de `user_avatar`, nombre `user_name` | `user_id` | ídem |
| 8 | Deleg | avatar del delegado | `delegated_id` | **solo pantallas extra grandes** (`hidden-lg`). *Nota*: `es.json` traduce "Deleg" como "Borrar" (error de traducción). |
| 9 | Valor (Amount) | `amount` con moneda | `amount` | grandes |
| 10 | Fecha de cierre (Close Date) | `completed_date` (tooltip "Fecha de finalización de esta oportunidad") | `completed_date` | md+ |
| 11 | Siguiente Acción (Next Action) | `due_date` coloreada: rojo si vencida, verde si es hoy, azul si es futura (directiva `dateColor`, pretty L998) | `due_date` | md+ |
| 12 | ☐ | casilla de selección | — | siempre |
| 13 | acciones | Ver, Editar, Clonar, Borrar (en móvil, menú ⚙) | — | siempre |

**Orden por defecto**: `id` descendente (`sortBy="id"`, `reverseSort=true`). Al hacer clic en una columna distinta ordena ascendente; clic de nuevo invierte. Se guarda en localStorage (`setOrder`).

**Paginación** (`v/views/common/pagination_footer.html`): 10 / 25 / 50 / 100 por página (defecto 10), paginador con primera/última y 7 botones, texto "Mostrando ítem X a Y (Z en total)". Sin resultados: "No se encontraron resultados".

**Clic en una fila** (`index_go`): en pantallas < 1025 px abre la ficha completa (`leads.view`); en escritorio abre el **panel lateral de detalle** (`leads.index.details`, 1/3 de pantalla); un segundo clic en la misma fila abre la ficha completa.

**Nube de etiquetas** (`<tag-cloud>` → `v/views/widgets/tag_cloud.html`): "Búsqueda por etiqueta"; cada etiqueta navega a `itemCategory = 'tag:<nombre>'` (reemplaza el filtro de estado). Carga `Tags.query({type:'leads'})` → `GET /tags?type=leads`.

**Vista lista vs. grilla vs. kanban**: solo existen **lista** (esta) y **kanban** (§3). No hay grilla de tarjetas.

### 2.5 Acciones masivas (menú ▾ que aparece al tildar filas)

| Acción (es / en) | Modal | Endpoint | Qué envía | Efectos secundarios |
|---|---|---|---|---|
| Editar fecha de la siguiente acción (Edit next action) | `leads/modal_duedate_checked.html`: fecha + casilla *Eliminar (Remove)* | `POST /leads/batch_duedate` | `{rows:[…], due_date, remove_due_date}` | Actividad por oportunidad ("La siguiente acción cambió a …" o "fue eliminada"); notificación al dueño si corresponde. Marca `refreshPipeline`. |
| Editar Prioridad (Edit Priority) | `leads/modal_priority_checked.html`: Alta/Media/Baja | `POST /leads/batch_priority` | `{rows:[{id,name,customer_id}], target: "100"/"101"/"102"}` | Actividad "La prioridad fue cambiada". ⚠ Usa códigos 100/101/102 mientras la oportunidad guarda 410/411/412 → ¿traducción en servidor? (duda). |
| Finalizar Oportunidades (Finish Opportunities) | `leads/modal_finish_checked.html`: Estado (lista completa, defecto Ganado) + Fecha de Finalización (defecto hoy). Tooltip: "Esto marcará el estado y la fecha de fin, **pero no cambia la etapa actual**". | `POST /leads/batch_finish` | `{rows, status_id, completed_date}` | Actividad "La oportunidad fue guardada como completada". |
| Cambiar usuarios (Change Users) | `leads/modal_users_checked.html`: Propietario, Delegado a, casilla *Quitar delegados*, *Notifiqueme de cambios* Sí/No | `POST /leads/batch_users` | `{rows, user_id, delegated_id, remove_delegated, follow_delegated}` | Actividades y notificaciones al nuevo dueño/delegado (ver §8.2). ⚠ Ambos selectores tienen `required`, aunque el texto dice "deje en blanco para no cambiar". |
| Cambiar etiquetas (Change Tags) | `common/modal_tags_checked.html`: *Añadir* o *Reemplazar* + etiquetas ("para quitar todas, elija Reemplazar y deje vacío") | `POST /tags/batch` | `{target_id:[ids], tags, type:'leads', action:'add'/'replace'}` | Actividad global "Se cambiaron etiquetas en N ítems". |
| Cambio de embudo de ventas (Change Sales Funnel) | `leads/modal_pipeline_checked.html`: selector de embudo | `POST /leads/batch_pipeline` | `{rows, pipeline_id}` | Actividad "El embudo cambió a X". A qué etapa queda cada oportunidad: **No determinable estáticamente**. |
| Borrar (Delete) | `leads/modal_delete_checked.html`: "¿Borrar N oportunidades? IMPORTANTE: se borrarán también notas, actividades y tareas relacionadas" | `POST /leads/batch_delete` | array de filas | Solo con `user_sales_delete` o admin. |

"Seleccionar todo" solo marca la **página visible**, no todo el resultado filtrado (`selectAll`).

### 2.6 Acciones por fila
- **Ver** → `leads.view`. **Editar** → `leads.edit({id})`. **Clonar** → `leads.edit({from_id})` (§5.4). **Borrar** → `leads/modal_delete.html` ("¿Desea borrar la oportunidad X? IMPORTANTE: se borrarán notas, actividades y tareas") → `DELETE /leads/:id`.

### 2.7 Exportar CSV
`getAllData()` repite la consulta con `pageNumber=1, pageSize=999999, csv_mode=1` y el componente `ng-csv` descarga `leads.csv` con separador `,` y comillas. **Qué columnas trae el CSV: No determinable estáticamente** (las define el servidor con `csv_mode`). Solo admin.

> **Mejora propuesta**
> - Filtros visibles como "chips" removibles y un botón "Limpiar filtros"; guardar **vistas con nombre** ("Mis bodas 2026 abiertas") en el servidor, no en el navegador.
> - Un filtro explícito "Vencidas / Hoy / Próximos 7 días" en la propia pantalla.
> - Selección masiva "todas las N del filtro", no solo la página.
> - Elegir columnas visibles y exportar a CSV **exactamente lo que se ve**, disponible para roles con permiso de exportación, no solo admin.
> - Período configurable sobre distintas fechas (alta, evento, cierre, siguiente acción).

---

## 3. Oportunidades — Vista kanban del embudo (`leads.pipelines`)

**Plantilla**: `v/views/leads/pipelines.html` + panel lateral `v/views/leads/sidebar_leads.html` · **Controlador**: `LeadsController.loadPipelines`, `getPipelines`, `sortableOptions`, `leadPopup`, `changePipeline`, `setStatus`, `modalQuickAdd` (pretty L13982, 14158, 14895-15160).

### 3.1 Para qué sirve y cómo se llega
Tablero con una **columna por etapa** del embudo y una **tarjeta por oportunidad**. Menú *Mi embudo de ventas*, o botón *Modo Embudo* del listado.

### 3.2 Carga
- Embudo mostrado: el de la URL; si es `all` o falta, el último usado (`localStorage.itemPipeline`) o el primero de la lista. Se guarda en `localStorage.itemPipeline` / `itemStage`.
- Consulta: `POST /leads/pipelines` con `{pipeline, type: itemCategory (defecto 'all'), user: itemUser, searchTerm}`. Respuesta `rows` indexada por número de etapa (1..n).
- **Columnas**: se dibujan las etapas **1 a n-1**; la **última etapa no se muestra** (`for i=1; i < stages.length`). Coincide con la ayuda de configuración: "Recuerde mantener la última etapa para los ítems completados. Esta etapa no será visible" (`v/views/settings/pipelines.html`).
- Qué oportunidades trae (¿solo Abiertas?): **No determinable estáticamente** (el filtro `type` va en `all`).
- **Refresco automático**: cada 15 s revisa `localStorage.refreshPipeline`; si otra pantalla del mismo navegador cambió algo (guardar, borrar, masivas lo ponen en `true`), recarga el tablero.

### 3.3 Barra superior
- Título: nombre del embudo · usuario filtrado.
- *Modo de Embudo de Ventas* (activo) / *Modo lista* (→ `leads.index({itemUser:'all'})`).
- *Embudo de ventas ▾*: cambia de embudo.
- *Filtrado por usuario ▾*: oculto si solo ve lo propio. (El menú lo abre ya filtrado por el usuario actual.)
- Botón **Ordenar por fecha de la siguiente acción**: `PUT /leads/save_pipelines_dueDate {pipeline_id}` — reordena en el servidor las tarjetas de cada columna por `due_date` y recarga.
- Interruptor ✉ (solo complemento Avanzado): "Enviar correo electrónico en el cambio de Etapa está activo/inactivo" (`pipeline_modal_onchanged`, recordado en localStorage). Si está activo, al soltar una tarjeta en otra columna se abre el redactor de correo precargado para esa oportunidad (`newMailFromModel('leads', id)`).
- Buscar ("Buscar todos los campos incluyendo campos adicionales"), debounce 500 ms.
- Leyenda de colores: *Sin Conflictos* (verde), *Conflicto con otras oportunidades* (amarillo), *Conflicto con pedidos* (rojo).
- Nube de etiquetas (`Tags.pipeline()` → `GET /tags/pipeline`).

### 3.4 Tarjeta
Color del borde según conflicto (`success/warning/danger-element`). Contenido: nombre (25 caracteres + "…"), valor sin decimales, cliente, fecha de cierre, siguiente acción coloreada (rojo/verde/azul). Clic → abre/cierra el panel lateral.

### 3.5 Alta rápida en la primera columna
Solo en la columna 1 y con permiso de crear: campo "Nueva Oportunidad…" + botón *Añadir* → modal `leads/modal_quick_add.html` (*Adición rápida de Oportunidad*):

| Campo | Tipo | Obligatorio | Validación / defecto |
|---|---|---|---|
| Nombre de la Oportunidad | texto | sí | mínimo 3 caracteres; precargado con lo tipeado |
| Categoría | selector (`lead_type`) | marcado con * pero sin `required` real | — |
| Contacto | buscador remoto (mín. 3 letras, 30 resultados, `GET /contacts/list?type=all_users&query=`) + botón **+** (alta rápida de contacto) | sí (campo oculto `required`) | — |
| Valor | número con máscara | no | — |
| Fecha del Evento | fecha | no | solo si la categoría es de grupo `wedding` o `event` |
| Fecha de cierre | fecha | no | **hoy + 1 mes** |

Al guardar: estado 421 Abierto, prioridad 411 Media, dueño = usuario actual, embudo = el del tablero, etapa 1, `started_date` = hoy, `follow_delegated = 0`, sin etiquetas; `POST /leads/save`; crea las **tareas de la etapa 1** (§6.5) y recarga (`modalQuickAdd`, pretty L15100).

### 3.6 Arrastrar y soltar (drag & drop)
`sortableOptions.stop` (pretty L14165):
1. Si cambió de columna: calcula la nueva **Siguiente Acción = hoy + `offset_days` de la etapa destino** (vacío si la etapa no tiene días).
2. `PUT /leads/progress_change/:id` con `{stage_id: índice+1, stage_name, stage_tasks, stage_memo: "Se ha cambiado la Etapa usando arrastrar y soltar en Modo Embudo", stage_user, due_date}` → queda en el historial de progreso.
3. Crea las **tareas** de la etapa destino (una por línea) y avisa "N tareas fueron añadidas".
4. Si el interruptor ✉ está activo y hay complemento Avanzado → abre el correo.
5. Siempre: `PUT /leads/save_pipelines` con **todas las columnas** (guarda el orden manual de las tarjetas).

Como la última etapa no se ve, **arrastrar no puede marcar Ganada**. No se registra Actividad (solo historial de progreso) en el arrastre.

### 3.7 Panel lateral de la tarjeta (`sidebar_leads.html`)
Se abre a la derecha con `GET /leads/:id` (más `GET /contacts/related/:id` del cliente y `GET /leads/conflict/:id/6`).

- **Botones**: Borrar · Añadir Nota · Añadir Cita (si hay calendario) · Añadir Presupuesto (`quotes.new?lead_id`, pestaña nueva) · Enviar Presupuesto Estándar (§8.3) · Editar (pestaña nueva) · Ver (pestaña nueva).
- **Datos**: Tipo (categoría), Valor, Fecha de cierre, Prioridad, Fecha de inicio, **Siguiente Acción** con lápiz de edición rápida (`leads/modal_single_duedate_checked.html` → `POST /leads/single_duedate {row, due_date, final_due_date, remove_due_date}`), **Pres enviado** (fecha o "No"), **Seg aut** (clic activa/desactiva, §6.7).
- **Cliente**: avatar, nombre (link a la ficha), emails, *Enviar correo*, *Enviar WhatsApp* (si tiene celular), teléfono, celular, empresa, ciudad.
- **Barra de etapas** clicable (cada segmento es una etapa; muestra el nombre de la actual y números del resto): clic → `changePipeline(n, true)`: guarda la oportunidad (`PUT /leads/:id`) con la etapa nueva, luego `progress_change` con memo "Se cambió la etapa usando el cambio rápido en Modo Embudo". Si la etapa elegida es **la última**, la oportunidad pasa a **Ganado** con fecha de cierre = hoy.
- **Embudo** (desplegable): elegir otro embudo muestra el aviso "El embudo fue cambiado a X. Seleccione una etapa para guardar" y obliga a elegir etapa; botón *Cancelar*. Al guardar navega al tablero del nuevo embudo.
- **Finalizar**: botones *Ganado* (422), *Fecha no disponible* (426), *Suspendido* (423), *Abandonado* (424), *Perdido* (425) → `setStatus` (§6.3).
- Bloque de **Boda** (si la categoría es `wedding`): Fecha (con día de la semana), Novia, Novio, Ceremonia, Recepción, ciudad/provincia/país, Invitados. Bloque de **Evento** (si `event`): Fecha, Lugar, ciudad, Invitados.
- **Conflicto**: lista de oportunidades (insignia amarilla) y pedidos (roja) en conflicto, con link.
- Origen, Creado, Finalizado en, Vendedor, Delegado a, Descripción, Etiquetas.

> **Mejora propuesta**
> - Mostrar la columna final como zona de "Ganada / Perdida" a la que se pueda arrastrar (con motivo obligatorio al perder).
> - Totales por columna (cantidad y suma de valor) y valor ponderado por probabilidad de etapa.
> - Refresco en tiempo real entre usuarios (no solo entre pestañas del mismo navegador).
> - Registrar el arrastre también como Actividad visible en la línea de tiempo.
> - Tarjeta configurable (fecha del evento, etiquetas, días en la etapa, ícono de tareas pendientes).

---

## 4. Oportunidades — Ficha (`leads.view`) y panel de detalle (`leads.index.details`)

**Plantillas**: `v/views/leads/view.html` (ficha completa), `v/views/leads/detail.html` (panel derecho del listado) · **Controlador**: `LeadsController.loadRow` (pretty L14364).

### 4.1 Carga
`GET /leads?id=:id` (factory `Leads.query` → `GET /leads/:id`). Si falla: "Oportunidad no encontrada" y vuelve al listado. Si el embudo de la oportunidad no tiene etapas: aviso "Hay un problema con el flujo de trabajo de esta oportunidad…". Además: `GET /contacts/related/:customer_id`, `GET /leads/conflict/:id/6`, categorías `lead_type`, clases, usuarios; si la oportunidad tiene `order_id`, `Orders.get_items`.

### 4.2 Barra de herramientas
- Borrar · Nueva Oportunidad · Añadir Nota · Añadir Cita · Editar. (El panel de detalle agrega *Añadir Presupuesto* y *Ver*.)
- **Crear Pedido (Create Order)**, 3 variantes (`view.html`):
  - Estado Ganado y hay cupo de pedidos → `orders.new({lead_id})`.
  - Estado distinto de Ganado → modal `leads/modal_close_lead.html`: "Al crear un pedido, esta oportunidad se guardará como **Ganado**. ¿Desea continuar?" → *¡Sí! Guárdala y crear el pedido* → `setStatus(row, 422)` y `orders.new({lead_id})`.
  - Sin cupo de pedidos → modal Pro (corona).
- No hay botón de imprimir en la ficha (la ruta `print.lead` existe pero sin acceso, ver §12).

### 4.3 Columna de datos (izquierda)
Estado (etiqueta), Tipo, Valor, Fecha de cierre, Prioridad, Fecha de inicio, **Siguiente Acción** (+lápiz, §3.7), Pres enviado, Seg aut (interruptor), Cliente (igual que el panel del kanban), bloque Boda/Evento (mismos campos; las etiquetas "Novia/Novio" se reemplazan por las del **formulario personalizado** si está activo: `labels.bride.label`, `labels.groom.label`), campos adicionales con nombre configurado (`lead_extra1..4`, `lead_date1..2`, solo si tienen valor), **Conflicto** (muestra 5; botón *Cargar más* abre `leads/modal_load_more_conflicts.html`, que carga `GET /leads/conflict/:id` completo y muestra de a 10), **Referente** (con datos al pasar el mouse), Embudo, Etapa (número + nombre), **Progreso** (barra `stage_percent` + botones − / + → `setNextStage`, §6.2), Clase, Origen, Creado, Finalizado en, Vendedor, Delegado a, Descripción, Etiquetas (link a filtrar por etiqueta).

### 4.4 Pestañas (derecha)
1. **Información general (General Info)**: tarjetas con contadores que abren subvistas: *Presupuestos* (`row.info.quotes`) → `leads.view.quotes`; *Citas* (`row.info.events`) → `leads.view.events` (si hay calendario); *Costos* (`row.info.costs`) → `leads.view.costs` (**solo admin**).
2. **Embudo (Pipeline)**: widget `v/views/widgets/pipeline.html` (§4.5).
3. **Notas (Notes)**: `v/views/widgets/notes.html` (§10.1).
4. **Mensajes (Messages)**: `v/views/widgets/messages.html` (§10.3).
5. **Actividad (Activity)**: `v/views/widgets/activities.html` (§10.2).
6. **Contactos Relacionados (Related Contacts)**: en oportunidades es el widget de **Participantes** `v/views/widgets/participants.html` (§7.4).
7. **Archivos adjuntos (Attaches)**: `v/views/widgets/uploads.html` (§10.4).

El **panel de detalle** del listado muestra la misma columna de datos y abajo la **Línea de tiempo** (`widgets/timeline.html`, §10.2), sin pestañas.

### 4.5 Widget "Embudo de ventas" (pestaña Pipeline)
`v/views/widgets/pipeline.html`:
- Barra de etapas clicable → `changePipeline(n)` (sin guardar).
- Si se cambió de etapa aparece: **Siguiente Acción** (precalculada = hoy + días de la etapa), **Estado** (solo si no es Abierto), **Memo** ("Escriba un memo sobre este cambio de etapa"), **Tareas** (precargadas con las tareas de la etapa, una por línea, editables: "Estas tareas se crearán cuando guarde"), **Delegado a**, **Notifíqueme de cambios**. Aviso "Se realizaron cambios, haga clic en Guardar". Botones *Deshacer* / *Guardar* (`save()` → `PUT /leads/:id`).
- **Histórico (History)**: tabla Fecha · Usuario (avatar) · Etapa (n • nombre) · Vencimiento · Nota, desde `GET /leads/progress/:id/:offset/:count` con scroll infinito (50 por tanda).

### 4.6 Subvista Presupuestos (`leads.view.quotes`)
`v/views/leads/quotes.html` (controlador `QuotesController.loadByType('leads')`):
- Botones *Añadir Presupuesto Personalizado* (`quotes.new?lead_id`) y *Enviar Presupuesto Estándar*.
- Columnas: # · Creado (fecha+hora) · Enviado ("No enviado") · Vendedor · Total · Visto (fecha en que el cliente lo abrió, "No visto"). En plan gratuito, presupuestos de más de 30 días muestran corona en lugar de datos.
- Por fila (menú): Editar (solo si no fue visto), Ver, Imprimir (`print.quote/:unique_id`), Enviar (correo con plantilla `custom_quote`), Enviar por WhatsApp (si hay celular), Clonar, **Crear Pedido** (misma lógica Ganado/no Ganado usando `batch_finish`), Borrar. Masivo: Borrar.
- Scroll infinito.

### 4.7 Subvista Costos (`leads.view.costs`, solo admin)
`v/views/leads/costs.html` (controlador `CostsController.loadCosts`): tabla Proveedor · Cuenta (plan de cuentas de costos, `account_cogs_id - nombre`) · Descripción · Valor, con total. Alta/edición en `leads/modal_costs.html` (Proveedor = contacto buscable, Cuenta obligatoria, Descripción, Valor obligatorio). *Deshacer* / *Guardar* guarda todo junto. Endpoint `GET /costs/leads/:id` (factory `Costs`); el guardado: **No determinable estáticamente** en detalle.

### 4.8 Subvista Citas (`leads.view.events`)
`v/views/leads/events.html` (CalendarController): botón *Nueva Cita*; columnas Fecha (inicio/fin) · Título · Lugar · Tipo · Estado · Dueño; clic abre la cita. Endpoint `/events/leads/:id/:offset/:count`.

> **Mejora propuesta**
> - Ficha con encabezado fijo: estado, etapa, valor, siguiente acción y "próxima tarea" siempre visibles; botones grandes "Ganada" / "Perdida (motivo)".
> - Unificar Notas, Mensajes, Actividad y Línea de tiempo en **una sola línea de tiempo filtrable** (hoy son 4 listas parecidas).
> - Mostrar las **tareas** de la oportunidad dentro de la ficha (hoy solo están en la barra lateral global de tareas).
> - Costos visibles con margen estimado (valor − costos) para quien tenga permiso financiero.

---

## 5. Oportunidades — Formularios de alta y edición

### 5.1 Nueva / Editar oportunidad (`leads.new`, `leads.edit`)
**Plantilla**: `v/views/leads/edit.html` · **Controlador**: `LeadsController.loadEdit` (pretty L14731), `save` (L15906), `process_save` (L15853).

**Valores por defecto al crear** (`loadEdit`, rama "nuevo"): estado 421 Abierto · prioridad 411 Media · dueño = usuario actual · embudo = **primero de la lista** · etapa 1 · `started_date` = hoy · **Fecha de cierre = hoy + 1 mes** · `follow_delegated = 0` · sin etiquetas · si la URL trae `customer_id` (desde la ficha del contacto), precarga el contacto (`GET /contacts/get_to/contacts/:id`). Se ejecuta `changePipeline(0)`, así que la **Siguiente Acción = hoy + días de la etapa 1** y se precargan sus tareas.
Controles de acceso: sin `user_sales_create` (y no admin) → `access_denied`; plan gratuito con límite superado → `access_denied`.

**Pestaña "Información Básica (Basic Info)"**

| Campo (es) | Modelo | Tipo | Obligatorio | Validación / notas |
|---|---|---|---|---|
| Nombre | `name` | texto | sí | mín. 3 caracteres |
| Contacto | `customer_id` | buscador remoto (mín. 3 letras) | sí | "Por favor elija un contacto". Link *Adición rápida* (§7.6). |
| Categoría | `category` → `category_id` | selector de `lead_type` | sí | Define el grupo (boda/evento/…). |
| Origen de la oportunidad | `lead_origin` | selector con las líneas de `AppSettings.lead_origin` | no | Se guarda el **texto**, no un id. |
| Referente | `referrer_id` | buscador de contactos | no | + *Adición rápida* (campo `referrer_id`). |
| Descripción | `description` | área de texto | no | |
| Valor | `amount` | número con máscara | no | "Valor estimado o real de la venta" |
| Fecha de cierre | `completed_date` | fecha | no | |
| **Si grupo = Boda**: Fecha y Hora de la boda | `event_date` (vía `event_date_edit`) | fecha+hora | no | |
| Invitados | `guests` | texto | no | |
| Novia / Novio | `bride_name`, `groom_name` | texto | no | Etiquetas personalizables por el formulario personalizado. |
| Lugar de ceremonia / de recepción | `place_event`, `place_reception` | texto | no | |
| Ciudad / Provincia / País | `city_event`, `state_event`, `country_event` | texto | no | |
| **Si grupo = Evento**: Fecha y Hora del Evento, Invitados, Lugar del evento, Ciudad, Provincia, País | mismos campos | | no | |
| Clase | `class_id` | selector | sí **solo si** `classes_in_leads == 1` | visible con clases activas + complemento Avanzado |
| Dueño (etiqueta con errata "Onwer") | `user_id` | selector de usuarios | sí | |
| Delegado a | `delegated_id` | selector de usuarios | no | |
| Notifíqueme de cambios | `follow_delegated` | Sí/No | no | "Genera una notificación al dueño por cada modificación" |
| Etiquetas | `tags` | autocompletar con etiquetas existentes; permite crear nuevas | no | se guarda como texto separado por comas |

Para los grupos `job_with_date` y `job_no_date` la oportunidad **no pide fecha**: según la ayuda de Categorías, "Trabajo con fecha" solo pide fecha y lugar **en Pedidos** (`v/views/settings/quotes.html`).

**Pestaña "Progreso (Progress)"**

| Campo | Modelo | Tipo | Obligatorio | Notas |
|---|---|---|---|---|
| Estado | `status_id` | selector (6 estados) | sí | Cambiarlo recalcula fechas (§6.3). |
| Prioridad de Oportunidad | `priority_id` | botones Alta (410) / Media (411) / Baja (412) | no | |
| Siguiente Acción | `due_date` | fecha | no | |
| Embudo de ventas | `pipeline_id` | selector | sí | Al cambiar redibuja la barra de etapas. |
| Barra de etapas | `stage_id` | clic en segmento | — | `changePipeline(n)`. |
| Memo | `stage_memo` | texto | no | Solo si cambió la etapa. |
| Tareas | `stage_tasks` | texto multilínea | no | Precargado con las tareas de la etapa. |
| Delegado a / Notifíqueme de cambios | (repetidos de la pestaña 1) | | | |

**Pestaña "Campos Adicionales (Extra Fields)"**: `extra1..extra4` (texto) y `extra_date1`, `extra_date2` (fecha), con los nombres configurados en *Configuración → Campos Adicionales → Oportunidades* (`lead_extra1..4`, `lead_date1..2`). Si no tienen nombre, se muestran sin etiqueta.

**Guardar** (`save`): valida el formulario (si falla: "Ocurrieron errores al enviar el formulario. Revise todas las pestañas"; la pestaña con error se pinta de rojo con *). Convierte fechas a SQL, pone `created` o `modified` con la zona horaria del navegador (`date_tzoffset()`), agrega `stage_change`, `stage_memo`, `stage_tasks`, `stage_name`, `stage_user`, `save_tags = true`. `POST /leads/save` (alta) o `PUT /leads/:id` (edición). Después: Actividad, creación de tareas, notificaciones de cambios (§8.2), refresco de contadores y **vuelve a la ficha**.

### 5.2 Validaciones del servidor
Unicidad, formato de valor, límites de plan del lado servidor: **No determinable estáticamente**.

### 5.3 Oportunidad múltiple basada en un pedido (`leads.batch`)
**Cómo se llega**: ficha de Pedido → botón *Crear una oportunidad basada en este pedido* (`v/views/orders/view.html` ~L278). **Plantilla**: `v/views/leads/new_batch.html` · **Controlador**: `loadByOrder`, `saveBatchLead`, `lead_process_save`, `quote_save` (pretty L14418-14687).

Asistente de 5 pestañas con botones "siguiente": *Seleccione Contactos >>*, *Editar Presupuestos >>* (requiere al menos un contacto), *Editar Progreso >>* (requiere al menos un ítem), *Guardar*.
1. **Información Básica**: Nombre, Categoría, Origen, Referente (precargado con el **cliente del pedido**), Descripción, bloque Boda/Evento, Clase, Dueño, Delegado, Notifíqueme, Etiquetas. Aviso "Está creando una nueva oportunidad basada en el pedido #N".
2. **Contactos**: "Puede elegir más de uno para crear varias oportunidades". Lista dinámica Contacto 1 (obligatorio), 2, 3… con + / −.
3. **Presupuesto**: *Crear Presupuesto* Sí/No (defecto Sí); Válido hasta (días) = 15 (obligatorio); **Ítems** precargados desde el pedido (Id, Nombre, Unidad, Desc %, Cant., Total; agregar/editar con `views/common/modal_items.html`, que alerta si el precio queda **por debajo del precio mínimo** del producto — solo admin puede guardar igual); Total productos, Otros gastos, Descuento (en % o monto), Total; *Mostrar precios de los artículos*, *Mostrar Precios Totales*, *Descuento final en (%)*; Condiciones de pago y Condiciones generales (defecto desde configuración de presupuestos).
4. **Progreso**: Estado, Prioridad (defecto Media), Siguiente Acción, **Fecha de finalización**, Embudo (defecto primero), etapas, Memo, Tareas, Delegado, Notifíqueme.
5. **Campos Adicionales**: ⚠ muestra las etiquetas de **pedidos** (`order_extra1..4`, `order_date1..2`) aunque guarda en la oportunidad (probable error).

Al guardar: por cada contacto, `POST /leads/save_batch {row, user_index}` → crea una oportunidad; Actividad "Oportunidad X fue creada"; notificaciones al dueño y delegado; y si *Crear Presupuesto* = Sí, `POST /quotes` con los ítems (Actividad "Presupuesto #N fue creado"). Vuelve al listado sin esperar a que terminen.

Caso de uso típico (fotografía): a partir de un pedido de colegio o evento, generar oportunidades individuales para cada familia/participante con el mismo presupuesto.

### 5.4 Clonar (`leads.edit({from_id})`)
Carga la oportunidad origen, borra el `id`, agrega "(clone)" al nombre y abre el formulario de edición; al guardar crea una nueva. Copia todo: contacto, fechas, etapa, etiquetas, etc. (`loadEdit`, rama `from_id`).

### 5.5 Importar CSV (`leads.importCSV`)
`v/views/leads/import_csv.html` · `initImportCSV`, `importCSV`, `sendCSV` (pretty L16122-16209).
- Selectores (obligatorios): **Categoría** (defecto la primera), **Embudo** (defecto el primero), **Propietario** (defecto usuario actual). Se aplican a **todas** las filas.
- Archivo: solo `.csv`, **máx. 1 MB**, **máx. 2000 filas**; se lee en el navegador con PapaParse (encabezado en la primera fila, ignora vacías). Muestra vista previa de las primeras 10 filas y el total.
- Columnas admitidas (tabla de ayuda y plantilla descargable `/downloads/leads-sample-fields.csv`): `name`, `description`, `bride_name`, `groom_name`, `place_event`, `place_reception`, `city_event`, `state_event`, `country_event`, `event_date` (AAAA-MM-DD), `event_time` (HH:MM), `lead_origin`, `customer_name`, `customer_lastname`, `customer_email`, `customer_email2`, `customer_phone`, `customer_cellular`, `customer_city`, `customer_state`, `customer_country`, `extra_date1`, `extra_date2`, `extra1..extra4`, `class_id` (solo complemento Avanzado). La vista previa además muestra `costumer_address`/`costumer_address2` (con errata) y `guests`.
- Envío: `POST /leads/import/csv {date, user_id, pipeline_id, category_id, result:[filas]}`. Respuesta: `import_success`, `duplicated_email` ("N contactos no se importaron: el email ya existe"), `empty_name` (contacto sin nombre), `empty_lead_name` (oportunidad sin nombre).
- Reglas: "El nombre de la oportunidad no debe estar vacío", "El nombre del contacto no debe estar vacío". Si el email del contacto ya existe, **¿se asocia la oportunidad al contacto existente o se descarta?** El mensaje dice "contactos no importados", **No determinable estáticamente** si la oportunidad se crea igual.

### 5.6 Formulario público de captación ("Herramienta de formulario", Form Tool)
- `forms.leads` (`v/views/leads/form.html`) solo redirige a **`/form_lead/#/index`**, una aplicación aparte que **no está en el material** (No determinable estáticamente su pantalla). Existe en el controlador `loadForm` (pretty L14868) con los campos: cliente, `bride_name`, `category`, `city_event`, `country_event`, `description`, `event_date`, `groom_name`, `guests`, `lead_origin`, `place_event`, `place_reception`, `state_event`; al terminar redirige a `form_lead_redirect_url` a los **10 segundos** o muestra `form_lead_sent_message` (`form:finalize`, pretty L16115).
- API pública para sitios externos: `POST {rooturl}/api/leads/add` (form HTML o JSON UTF-8). Configuración en §11.2.

> **Mejora propuesta**
> - Formulario de alta en **una sola página** con secciones plegables; que los campos de Boda/Evento los defina la **categoría** con campos configurables (no fijos en código).
> - Detección de **duplicados** al elegir contacto (misma persona con oportunidad abierta para la misma fecha).
> - Importación con **mapeo de columnas** (arrastrar columna del archivo → campo), previsualización de errores por fila y opción "asociar a contacto existente por email/teléfono".
> - Formulario público nativo de FOTOFFICE con anti-spam, UTM/origen automático y webhook documentado.

---

## 6. Estados, etapas y transiciones

### 6.1 Estados (`AppTables.lead_status`, pretty L17462)

| id | Estado (es) | Original | Color | Se considera finalizado |
|---|---|---|---|---|
| 421 | Abierto | Open | verde | no |
| 422 | Ganado | Won | azul | sí |
| 423 | Suspendido | Suspended | amarillo | sí (a efectos de fechas) |
| 424 | Abandonado | Abandoned | gris | sí |
| 425 | Perdido | Lost | rojo | sí |
| 426 | Fecha no disponible | Date unavailable | amarillo | sí |

No hay **motivo de pérdida** como campo: el motivo es el propio estado (Perdido / Abandonado / Fecha no disponible / Suspendido). Tampoco hay texto obligatorio al cerrar.

### 6.2 Etapas
- Cada embudo tiene etapas ordenadas con `name`, `offset_days` (duración en días) y `tasks` (texto, una tarea por línea) (`v/views/settings/pipelines.html`). La respuesta de `GET /stages/list?type=lead_stage` es `{ stage_list: [{id,name}], stages: { <pipeline_id>: [ {id, stage, name, offset_days, tasks}, … ] } }` (uso en `getStages`, `setSlider`, `changePipeline`).
- La oportunidad guarda `stage_id` **como número de posición (1..n)**, no como id de la etapa. Si se reordenan o borran etapas del embudo, las oportunidades existentes pueden quedar apuntando a otra etapa (riesgo para la migración, §13).
- `stage_percent` = etapa / total × 100 (calculado en `setNextStage`; en el listado viene del servidor).

**Formas de cambiar de etapa**

| Dónde | Función | Memo automático | Guarda |
|---|---|---|---|
| Kanban, arrastrar | `sortableOptions.stop` | "Se ha cambiado la Etapa usando arrastrar y soltar en Modo Embudo" | `progress_change` + `save_pipelines` |
| Kanban, panel lateral, clic en barra | `changePipeline(n, true)` | "…cambio rápido en Modo Embudo" | `PUT /leads/:id` + `progress_change` |
| Ficha/detalle, botones − / + | `setNextStage(row, ±1)` | "Se cambió la etapa usando los botones de cambio rápido" | `PUT /leads/:id` |
| Formulario / pestaña Embudo | `changePipeline(n)` + Guardar | lo que escriba el usuario en Memo | `PUT /leads/:id` |

**Regla común** (`changePipeline`, `setNextStage`, `SliderOptions.onChange`):
- Siguiente Acción = hoy + `offset_days` de la etapa nueva (vacía si la etapa no tiene días).
- Si la etapa nueva es **la última** → estado **Ganado (422)**, Siguiente Acción vacía, Fecha de cierre = hoy.
- Si no → estado **Abierto (421)** y Fecha de cierre vacía. ⚠ Esto **reabre** una oportunidad Perdida/Suspendida si se le cambia la etapa, y **borra la Fecha de cierre prevista** que se había cargado al crearla.
- Se crean las tareas de la etapa destino.

### 6.3 Cambio de estado

**Desde el formulario** (vigilancia de `row.status_id`, pretty L15811):
- → Abierto: Siguiente Acción = hoy + días de la etapa actual; Fecha de cierre vacía.
- → Ganado: etapa = última; Siguiente Acción vacía; Fecha de cierre = hoy.
- → cualquier otro: Siguiente Acción vacía; Fecha de cierre = hoy (la etapa no cambia).

**Desde el panel del kanban** (`setStatus`, pretty L15049): Siguiente Acción vacía siempre; para **Ganado y Perdido** la etapa pasa a la última y Fecha de cierre = hoy; para Suspendido/Abandonado/Fecha no disponible **no** se toca la fecha de cierre (inconsistencia con el formulario). Actividad "El estado de la oportunidad X cambió a Y".

**Masivo** (Finalizar Oportunidades): estado y fecha elegidos; **no cambia la etapa** (lo dice el propio tooltip).

**Al crear pedido** desde oportunidad no ganada: se fuerza Ganado (§7.1).

Existe un modal `leads/modal_create_order.html` ("¡Felicitaciones! La oportunidad fue marcada como Ganada. ¿Desea crear un pedido ahora?") que se abre en `setStatus(…, showOrderModal=true)`, pero **ninguna pantalla lo llama con `true`**: está inactivo.

### 6.4 Prioridad
410 Alta · 411 Media (defecto) · 412 Baja. En masivo se envían 100/101/102 (§2.5).

### 6.5 Tareas automáticas por etapa
`createTasks` (pretty L14019): por cada línea no vacía de `stage_tasks` crea `POST /tasks {user_id: USUARIO ACTUAL, type:'leads', target_id, due_date: hoy, title, completed:0}` y emite `refreshTasks`. ⚠ Las tareas quedan asignadas a **quien hizo el cambio**, no al dueño de la oportunidad, y **vencen hoy** (no según los días de la etapa). Se ven en la barra lateral global de tareas (`v/views/common/sidebar_tasks.html`, `TasksController`): filtros Todas/Pendientes/Completadas, Mis tareas / Tareas de todos los usuarios, **Todas las tareas / Tareas de este ítem** (cuando se está en una ficha), doble clic para editar, arrastrar para ordenar (`POST /tasks/sort`), *Eliminar completadas* (`POST /tasks/del_completed`), cambiar fecha (`PUT /tasks/set_date/:id`).

### 6.6 Siguiente Acción (vencimiento)
- `due_date` es la fecha clave de seguimiento. Colores: rojo vencida, verde hoy, azul futura.
- Se calcula sola al cambiar de etapa (§6.2) y se vacía al cerrar.
- Edición rápida individual (`single_duedate`) y masiva (`batch_duedate`), ambas con opción *Eliminar*.
- El modal individual también envía `final_due_date` (plazo final), heredado de Proyectos; en oportunidades no se muestra.
- Contadores de vencidas: `dbStatus.leads.due_user` / `due_all` (servidor).
- **Proyección de plazos**: `loadStages` (pretty L14688) calcula un diagrama por meses de cuándo terminaría cada etapa restante sumando `offset_days`; si la fecha está vencida recalcula desde hoy ("Fecha de vencimiento no definida o vencida…"). Se usa en el widget `progress.html` (proyectos); en oportunidades **no hay plantilla que lo muestre**.

### 6.7 Seguimiento automático por correo ("Seg aut" / follow-up)
- Por oportunidad: interruptor *Seg aut* → `PUT /leads/set_fup/:id/:enable_followup` (0/1). Actividad "El seguimiento automático de la oportunidad X fue puesto en activo/inactivo" (`setFup`, pretty L15826).
- Global: *Configuración → Oportunidades → Seguimiento* (`v/views/settings/followup.html`): **Días para enviar un email de seguimiento automático** (`followup_days`): "número de días después de enviar un presupuesto estándar o personalizado; 0 = no enviar". El texto de "Días para la siguiente acción" quedó obsoleto: ahora se define por la duración de las etapas.
- Plantilla del correo: `followup` (*Configuración → Plantillas de correo → Oportunidades y Presupuestos*).
- El envío lo hace un proceso del servidor: condiciones exactas (¿solo si la oportunidad sigue Abierta?, ¿una sola vez?, ¿se cancela si el cliente responde?) **No determinable estáticamente**. Valor por defecto de `enable_followup` al crear: no se envía desde el panel → **No determinable estáticamente**.

### 6.8 Conflicto de fechas
- `GET /leads/conflict/:id/:per_page` (cache 10 min) devuelve una lista de `{type: 'leads'|'orders', id, name}`; el listado y el kanban reciben `lead_conflict`, `order_conflict` y `conflict` por fila.
- Uso: advertir que ya hay otra oportunidad o un pedido para la **misma fecha** (típico de fotógrafos de bodas: una sola fecha por equipo).
- Criterio exacto (¿mismo día del `event_date`?, ¿excluye cerradas?, ¿considera cantidad de equipos?) **No determinable estáticamente**.
- El estado *Fecha no disponible (426)* es el cierre natural cuando hay conflicto.

> **Mejora propuesta**
> - Guardar la etapa por **id de etapa**, con historial `(etapa, entrada, salida, usuario)` para medir tiempo por etapa.
> - Separar claramente "estado" (abierta/ganada/perdida) de "motivo" (catálogo configurable: precio, fecha no disponible, eligió a otro, sin respuesta…), con motivo obligatorio al perder.
> - Tareas automáticas con **responsable configurable** (dueño/delegado/quien mueve) y **vencimiento relativo** (+N días).
> - Capacidad por fecha (N equipos disponibles) para que el conflicto sea "fecha llena" y no solo "hay otra".
> - Secuencias de seguimiento (varios correos/WhatsApp escalonados) que se detengan solas cuando el cliente responde o la oportunidad cambia de estado.

---

## 7. Relaciones

### 7.1 Oportunidad → Presupuesto → Pedido
- **Presupuesto personalizado**: *Añadir Presupuesto* → `quotes.new?lead_id=<id>` (módulo Presupuestos). El presupuesto guarda `lead_id` y `customer_id`.
- **Presupuesto estándar**: correo con la plantilla de la categoría (`default_quote_<category_id>`, o la maestra `default_quote`) y adjuntos de esa categoría; no crea un registro de presupuesto, solo marca `quote_sent_date` en la oportunidad (§8.3).
- **Pedido**: desde la ficha (*Crear Pedido*) → `orders.new?lead_id`; desde una fila de presupuesto → `orders.new?quote_id`. Si la oportunidad no está Ganada, se pide confirmación y se marca Ganada (`modal_close_lead.html`; en presupuestos vía `POST /leads/batch_finish` con `status_id 422` y fecha hoy). Los parámetros aceptados por `orders.new` son `customer_id`, `quote_id`, `lead_id` (y `orders.express` igual).
- Qué datos copia el pedido desde la oportunidad/presupuesto: se define en `OrdersController` (otro módulo) — fuera de alcance aquí.
- **Pedido → Oportunidades**: `leads.batch?order_id` (§5.3). La oportunidad guarda `order_id` y lee `Orders.get_items`.

### 7.2 Contacto ↔ Oportunidades
- Cada oportunidad tiene **un** cliente (`customer_id`) y opcionalmente **un** referente (`referrer_id`), ambos contactos.
- En la ficha del contacto, tarjeta *Oportunidades* → lista (§9.4) y botón *Nueva Oportunidad* con el contacto precargado.
- El listado de oportunidades trae los datos del cliente "aplanados" (`customer_name`, `customer_lastname`, `customer_company`, `customer_is_company`, `customer_email`, `customer_email2`, `customer_phone`, `customer_cellular`, `customer_city`, `customer_state`, `customer_country`, `customer_avatar`) y del referente (`referrer_*`).

### 7.3 Contactos relacionados (entre contactos)
Pestaña *Contactos Relacionados* de la ficha de contacto: `v/views/contacts/related.html`, `ContactsController.loadRelated/saveRelation` (pretty L11170, L11336).
- Tabla: avatar · Nombre (link, con emails/teléfonos/ciudad) · **Relación** (p. ej. "padre/madre") · herramientas (Editar, Borrar, Confirmar, Cancelar). Fila *Añadir*: elegir contacto + relación.
- Relaciones: `GET /contacts/relation_list` devuelve pares `{id, from_m, from_f}` (forma masculina/femenina); se traducen con `AppTables.relations` (pretty L17487): padre, madre, hijo, hija, hermano, hermana, esposo, esposa, tío, tía, sobrino, sobrina, cuñado/a, suegro/a, yerno, nuera, abuelo/a, nieto/a, prometido/a, primo/a, amigo/a, proveedor, cliente, empleado, empleador.
- Guardar todo junto: `POST /contacts/save_related {id, rows}`; lectura `GET /contacts/related/:id`. Se registra Actividad "Se guardaron los relacionados".
- Si la relación se guarda en ambos sentidos: **No determinable estáticamente**.
- Existe además un widget antiguo `v/views/widgets/contact_related.html` (tarjetas con avatar y botón *Añadir relación*) que no se usa en las pantallas de este módulo.

### 7.4 Participantes (contactos relacionados a una oportunidad)
Pestaña *Contactos Relacionados* de la ficha de oportunidad: `v/views/widgets/participants.html` + `widgets/modal_participants.html`, `ParticipantsController` (pretty L21875).
- Tabla: avatar · Nombre · **Participando como** (categoría de tipo `participant`, configurable en *Configuración → Categorías → Participantes*) · Nota · Editar/Borrar. Botón *Añadir* abre modal: Contacto (buscable, con alta rápida que crea el contacto con categoría `2`), Participando como (obligatorio), Nota.
- Guardar todo: `POST /participants {type:'leads', target_id, rows}`; lectura `POST /participants/paginate`. Actividad "Se guardaron los participantes".
- Uso típico: novia y novio como contactos distintos, organizador, salón, otro proveedor.

### 7.5 Oportunidad ↔ Usuario
`users.view.leads` (`v/views/users/leads.html`): oportunidades de un usuario (columnas #, Nombre, Vendedor, Fecha del evento, Estado, Etapa, Siguiente Acción), desde `GET /leads/user/:id/:offset/:count`.

### 7.6 Alta rápida de contacto (usada desde oportunidades)
`v/views/contacts/modal_quick_add.html`, `ContactsController.modalQuickAdd(type, field, lead_page, user_index)`: Categoría (obligatoria, precargada con `type`: '1' desde cliente/referente, '2' desde participantes), Nombre (obligatorio, mín. 3), Apellido, Email (valida formato y **que no exista** en `GET /users/get_by/email/:email`), Teléfono, Móvil. Al guardar emite `contact_added` y el formulario que lo llamó selecciona al nuevo contacto en el campo indicado.

> **Mejora propuesta**
> - Permitir **varios contactos por oportunidad con roles** (cliente que paga, novia, novio, organizador…) en lugar de cliente + referente + "participantes" separados.
> - Relaciones entre contactos **bidireccionales automáticas** (si A es madre de B, B es hijo/a de A).
> - Un "hogar/familia" o "empresa" como agrupador de contactos (útil para fotografía escolar y corporativa).

---

## 8. Automatizaciones, notificaciones y correos

### 8.1 Actividad (registro de auditoría)
Casi toda acción crea `POST /activities {user_id, customer_id, target_id, type:'leads'|'contacts', text, link, created}`. Textos principales (en `LeadsController`/`ContactsController`): "Oportunidad X fue creada / guardada / borrada", "El estado cambió a …", "La siguiente acción cambió a …", "La fecha de finalización cambió a …", "El flujo cambió a …", "La etapa cambió a …", "El cliente cambió a …", "El dueño cambió a …", "Fue delegada a …", "Prioridad cambiada", "Embudo cambiado", "Etiquetas cambiadas en N ítems", "Presupuesto #N fue creado", "Seguimiento automático activo/inactivo", "Contacto creado/editado/borrado", "Categoría cambiada para N contactos".

### 8.2 Notificaciones internas (campana)
`act_notify` (pretty L14059) + `Notifications.save {sender_id, user_id, type, text, link}`:
- Si `follow_delegated == 1` ("Notifíqueme de cambios") y **quien modifica no es el dueño**, el dueño recibe una notificación por cada cambio.
- Al crear: el dueño recibe "Usted fue asignado como dueño de la oportunidad X (#id)"; el delegado "Usted fue delegado a la oportunidad X".
- Al cambiar delegado: el nuevo delegado recibe "Usted fue delegado…".
- En cambios masivos de usuarios: avisos al nuevo dueño, al dueño original sobre el delegado, y (con una condición que parece errónea) al delegado removido.
- `type` 1 o 2 (significado exacto **No determinable estáticamente**).
- *Configuración → Herramienta de formulario → Notificar al usuario*: aviso al usuario por defecto cuando entra una oportunidad por formulario; plantilla de correo `newlead_notif` ("Notificación de nueva oportunidad") con variables `customer_*`, `lead_category`, `event_date`, `event_place`, `event_city`, `event_state`, `message`, `lead_link`, `lead_number` (pretty L16418).

### 8.3 Correos al cliente
- **Enviar correo** (ficha, panel, detalle): `newMailFromModel('leads', id)` abre el redactor lateral (`MailsController.newMailFromModel`, pretty L16940): *Para* = email principal del cliente (o el secundario), *CC* = email secundario si tiene ambos; variables del cliente (`customer_name`, `firstname`, `lastname`, `company`, `email`, `address`, `address2`, `city`, `state`, `country`, `zipcode`, `doc1` = DNI, `doc2` = NIF, `phone`, `mobile`); firma agregada al final o en `[email_signature]`; se pueden elegir **plantillas personalizadas**. El envío sale desde `noreply@alboomcrm.com` con *Responder a* el usuario, hasta 6 destinatarios + 3 CCO, con adjuntos y reCAPTCHA; queda guardado en `POST /mails/save` (pestaña Mensajes).
- **Enviar Presupuesto Estándar** (`QuotesController.sendStandardQuote`, pretty L27987): plantilla `default_quote_<category_id>` si existe, si no `default_quote`; variables + `pricelist_link` (lista de precios pública) y `lead_number`; `meta.subtype = 'default_quote'`. Al enviarse → `PUT /leads/date_sent/:id` (marca **Pres enviado**).
- **Enviar presupuesto personalizado**: plantilla `custom_quote` con `quote_number`, `link` al presupuesto imprimible, `lead_number`, adjuntos; marca `quote_sent_date` en la oportunidad y `sent_date` en el presupuesto.
- **Respuesta automática del formulario**: plantilla `autoreply`, o el presupuesto estándar de la categoría (según *Respuesta del Formulario*).
- **Seguimiento automático**: plantilla `followup` (§6.7).
- **Correo al cambiar de etapa** (kanban, complemento Avanzado): abre el redactor, no envía solo.
- **WhatsApp**: *Enviar WhatsApp* (`newWhatsAppMessage`) abre un panel con plantillas de WhatsApp (`WhatsappController`); el envío real (¿link wa.me o API?) **No determinable estáticamente**; los mensajes quedan en la pestaña Mensajes con opción *Reenviar*.
- **Cumpleaños**: en *Configuración → Plantillas de correo* se puede activar un correo automático de cumpleaños a clientes (`bday_enabled`, plantilla `birthday_mail_customers`, texto por defecto en portugués/español/inglés, pretty L30279-30340).
- **Acceso al Área de Cliente** (ficha de contacto): plantilla `order_access` con `link` de acceso (`sendCustomerAccess`, pretty L11147).

> **Mejora propuesta**
> - Un motor de **automatizaciones** configurable ("cuando X → hacer Y"): al entrar por formulario, al cambiar a etapa E, N días sin respuesta, al ganar, cumpleaños/aniversario de boda… con acciones: enviar correo/WhatsApp, crear tarea, cambiar etapa, notificar.
> - Envío real de WhatsApp por API oficial y registro de respuestas entrantes en la línea de tiempo.
> - Enviar desde el dominio del estudio (SPF/DKIM) en lugar de `noreply@` genérico.

---

## 9. Contactos

### 9.1 Listado (`contacts.index`)
**Plantilla**: `v/views/contacts/index.html` · **Controlador**: `ContactsController.loadAll/getData` (pretty L10718).

- **Botones**: *Nuevo contacto*; *CSV ▾* (solo admin): Exportar en CSV (`contacts.csv`, `csv_mode=1`) e Importar CSV.
- **Filtro de categoría** en forma de **botones** (no desplegable): *Todo* · una por cada categoría de contacto (`GET /categories?type=contact`) · *Cumpleaños (Birthdays)*. Parámetro `itemCategory` (`all`, id, `birthdays`, o `tag:x` desde la nube de etiquetas).
- **Clase ▾** (si clases activas + Avanzado): `itemClass`.
- **Buscar** (debounce 500 ms, ≥2 caracteres; "incluye campos adicionales"; fechas en aaaa-mm-dd).
- Consulta: `POST /contacts/paginate {type, class_id, role:'contact', pageNumber, pageSize, sortBy, sortDir, searchTerm}`.
- **Recuerda** en localStorage: `contact_itemCategory` (defecto `all`), `contact_itemClass`, `contacts_sortBy`, `contacts_reverseSort`, `pageSize` (compartido).
- **Columnas**: # (`id`) · avatar · Nombre (nombre + apellido; orden `name`) · **Cumpleaños** (`birthday` en formato día/mes, solo con filtro Cumpleaños, orden `Birthday`) o **Empresa** (`company`) · Email · Ciudad · ☐ · acciones.
- **Orden por defecto**: `name` ascendente. Paginación 10/25/50/100.
- **Clic en fila**: panel lateral de detalle en escritorio (`contacts.index.details`), ficha en pantallas chicas; segundo clic abre la ficha.
- **Acciones por fila**: Ver, Editar, Borrar.
- **Masivas**: *Cambiar Categoría* (`contacts/modal_type_checked.html` → `POST /contacts/batch_type {rows:[ids], target:{categoría}}`), *Cambiar etiquetas* (`POST /tags/batch` con `type:'contacts'`), *Borrar* (§9.6).
- Nube de etiquetas.
- Qué rango usa el filtro *Cumpleaños* (¿de hoy?, ¿del mes?): **No determinable estáticamente**.

### 9.2 Modelo "contacto = usuario"
Los contactos viven en la misma entidad que los usuarios del sistema:
- se filtran con `role: "contact"` (`getData`);
- la unicidad del email se valida contra `GET /users/get_by/email/:email` (directiva `uniqueEmailUser`);
- tienen `password` (para entrar al **Área de Cliente**), `notification_email`, `fb_id` (vínculo con Facebook), `avatar`;
- el estado `contacts.profile` es la pantalla del propio cliente logueado.

Consecuencia: **el email es único en todo el sistema** (un contacto no puede tener el mismo email que un usuario del estudio ni que otro contacto) y **puede estar vacío**.

### 9.3 Formulario de contacto (`contacts.new`, `contacts.edit`)
**Plantilla**: `v/views/contacts/edit.html` · `loadEdit`, `save`, `process_save` (pretty L11270-11431).

Defecto al crear: `is_company = false`, `gender = 'male'`, sin etiquetas. Sin permiso de crear → `access_denied`.

**Pestaña Información Básica**

| Campo (es) | Modelo | Tipo | Obligatorio | Validación |
|---|---|---|---|---|
| Categoría | `type` | selector (categorías de contacto) | sí | |
| Tratar como empresa | `is_company` | casilla | — | cambia los campos visibles |
| *(empresa)* Empresa | `company` | texto | sí si empresa | mín. 3 |
| *(empresa)* Sitio web | `site_url` | texto | no | |
| *(empresa)* Negocio ID (Business ID) | `rg` | texto | no | |
| *(empresa)* NIF (Business Tax ID) | `cpf` | texto | no | Si el estudio es de Brasil (`fromBrazil`): máscara y validación **CNPJ** |
| Nombre | `name` | texto | sí si **no** es empresa | mín. 3 |
| Apellido | `lastname` | texto | no | |
| Correo electrónico principal | `email` | email | no | formato + **único** ("Email ya en uso") |
| Correo electrónico secundario | `email2` | email | no | formato |
| Teléfono | `phone` | texto | no | |
| Móvil | `cellular` | texto | no | (usado para WhatsApp) |
| Cumpleaños | `birthday` | fecha | no | |
| Género | `gender` | Hombre / Mujer | no | defecto Hombre |
| *(persona)* DNI/NIE (Driver´s License) | `rg` | texto | no | |
| *(persona)* NIF (Tax ID) | `cpf` | texto | no | Brasil: máscara y validación **CPF** ("CPF Inválido") |
| *(persona)* Empresa, Sitio web | `company`, `site_url` | texto | no | |
| Sobre (About) | `memo` | área de texto | no | |
| Clase | `class_id` | selector | sí si `classes_in_contacts == 1` | |
| Etiquetas | `tags` | autocompletar | no | |

**Pestaña Dirección**: Código postal (`zipcode`; en Brasil, con 8 dígitos autocompleta calle, barrio, ciudad, estado y país vía `viacep.com.br`), País, Dirección (`address1`), Dirección 2 (`address2`), Ciudad, Provincia (`state`).

**Pestaña Campos Adicionales**: `extra1..4`, `extra_date1..2` con nombres `user_extra1..4`, `user_date1..2`.

**Pestaña Contraseña**: aviso "No es necesario crear una contraseña: el CRM envía un Enlace Inteligente de acceso para que el cliente cree la suya en el primer ingreso". Si ya tiene: "Este contacto ya tiene contraseña. Haga clic aquí para quitarla" → `DELETE /contacts/remove_password/:id`. Campos Contraseña / Confirmar (mín. 6, deben coincidir).

Guardar: `POST /contacts` o `PUT /contacts/:id` → Actividad "Contacto creado/editado" → va a la ficha.

### 9.4 Ficha del contacto (`contacts.view`)
**Plantilla**: `v/views/contacts/view.html` (+ panel `detail.html` en el listado).
- Barra: Borrar · Nuevo contacto · Añadir Cita · Editar.
- Columna izquierda: nombre (o empresa), **foto con recorte** (`image-crop-widget`), categoría (`type_name`), persona de contacto si es empresa, emails, teléfonos, empresa, sitio web, ciudad/provincia/país, dirección y CP, cumpleaños, botones *Enviar correo*, *Enviar WhatsApp*, **Enviar acceso al Área de Cliente**; documentos (Negocio ID/NIF o DNI/NIF), Clase, campos adicionales, *Sobre*, Etiquetas.
- Pestaña **Información general**: tarjetas con contadores (`GET /contacts/info/:id`) que abren subvistas:

| Tarjeta (es) | Condición | Subvista | Columnas |
|---|---|---|---|
| Oportunidades | módulo ventas | `contacts/leads.html` (`/leads/contact/:id/…`) | #, Nombre, Vendedor, Fecha del evento, Estado, Etapa (n • nombre), Siguiente Acción. Botón *Nueva Oportunidad*. |
| Presupuestos | módulo ventas | `contacts/quotes.html` | #, Enviado, Vendedor, Oportunidad, Total (oculto si solo ve lo propio y no es suyo), Visto |
| Pedidos | módulo pedidos | `contacts/orders.html` | #, Nombre, Tipo, Total, Vendedor, Fecha del evento, Estado. Botón *Nuevo Pedido*. |
| Contratos | plan pago | `contacts/agreements.html` | #, Creado, Pedido#, Por, Enviado, Nombre, Visto; acciones Borrar, Enviar, WhatsApp, Imprimir, Ver, Clonar, Editar (si no visto) |
| Proyectos | módulo proyectos | `contacts/projects.html` | #, Nombre, Dueño, Tipo, Estado, Etapa, Vence. Botón *Nuevo Proyecto* (con control de límite). |
| Pruebas (galerías de selección/aprobación) | módulo pruebas | `contacts/proofs.html` | #, Tipo, Nombre, Fecha Final, Fin, Vistas, Imágenes; acciones Desbloquear, Forzar finalización, Cambiar plazo, +30 días, Reiniciar, ver selección/aprobación |
| Por cobrar | finanzas | `contacts/ar.html` | Vence, Pedido, Tipo, Doc, Memo, Valor, Recordatorio |
| Recibidas | finanzas | `contacts/ar_paid.html` | Fecha, Pedido, Tipo, Doc, Memo, Valor, *Imprimir Recibo* |
| Por pagar | finanzas | `contacts/ap.html` | Vence, Pedido, Tipo, Doc, Memo, Valor |
| Pagado | finanzas | `contacts/ap_paid.html` | Fecha, Pedido, Tipo, Doc, Memo, Valor, *Imprimir Recibo* |

  Todas con scroll infinito. (⚠ `ap_paid.html` al hacer scroll carga `ar_paid`: error.)
- Otras pestañas: **Notas**, **Mensajes**, **Actividad**, **Contactos Relacionados** (§7.3), **Archivos adjuntos**.

### 9.5 Importar CSV de contactos (`contacts.importCSV`)
`v/views/contacts/import_csv.html`, `initImportCSV/importCSV/sendCSV` (pretty L11451-11515).
- **Categoría de contactos** obligatoria (defecto id `2`).
- Mismas reglas de archivo que oportunidades (CSV, 1 MB, 2000 filas, vista previa de 10).
- Columnas de la vista previa: `name`, `lastname`, `email`, `email2`, `address1`, `address2`, `city`, `state`, `zipcode`, `country`, `site_url`, `phone`, `cellular`, `gender`, `doc1` (DNI), `doc2` (NIF), `birthday` (AAAA-MM-DD), `extra1..4`, `extra_date1..2`. Plantilla `/downloads/contacts-sample-fields.csv`.
- `POST /contacts/import/csv {type, result}` → `import_success`, `duplicated_email` (se descartan los emails existentes), `empty_name`.
- No importa: empresa (`company`, `is_company`), memo, etiquetas, clase.

### 9.6 Borrar contacto
`modalDelete` (pretty L10894): tras confirmar, consulta `GET /contacts/info/:id`; si tiene **oportunidades, presupuestos, pedidos, contratos o proyectos**, **no borra** y muestra `contacts/notification_delete.html`: "No es posible borrar este contacto, está vinculado en: Cantidad de Oportunidades N, … Para eliminarlo, primero debe eliminar todo lo vinculado". En masivo hace lo mismo por cada id y, si alguno tiene vínculos, **no borra ninguno**. Si no hay vínculos: `DELETE /contacts/:id` o `POST /contacts/batch_delete`.

### 9.7 Cumpleaños y aniversarios
Las rutas `contacts.birthdays` / `contacts.anniversary` apuntan a plantillas que en el material son una página **404** y el menú está oculto: función retirada. Lo que queda: el botón-filtro *Cumpleaños* del listado y el correo automático de cumpleaños (§8.3). No existe campo "aniversario" (fecha de boda) en el contacto; la fecha de boda está en la oportunidad (`event_date`).

### 9.8 Perfil del cliente (Área de Cliente, rol `contact`)
`v/views/contacts/profile.html` y `profile_edit.html`: el cliente ve sus datos, foto, y (si `customer_area_edit_profile == 1`) puede editar: Nombre (obligatorio), Apellido, emails, teléfonos, Cumpleaños, Género, DNI, NIF, Sobre, **Notificaciones por correo** (resumen diario), Contraseña, Dirección completa; *Desvincular de Facebook*. Guarda con `PUT /contacts/:id` (`saveProfile`).

> **Mejora propuesta**
> - Separar **Contacto** (persona/empresa del CRM) de **Cuenta de acceso** (login al portal): un contacto puede no tener acceso y el email no tiene por qué ser único globalmente. Esto evita el problema de importar dos personas con el mismo email (parejas que comparten correo, muy común).
> - Deduplicación asistida (por email, teléfono normalizado, nombre) y **fusión** de contactos.
> - Teléfonos en formato internacional (E.164) con validación, y WhatsApp como canal verificado.
> - Documentos por país (Argentina: DNI/CUIT con validación de dígito verificador) en vez de CPF/CNPJ fijos.
> - Fechas especiales configurables por contacto (cumpleaños, aniversario de boda, egreso) con recordatorios y automatizaciones.
> - Borrado "blando" (archivar) en vez de bloquear cuando hay vínculos.

---

## 10. Widgets transversales usados en fichas

### 10.1 Notas (`v/views/widgets/notes.html`, `NotesController`)
- Buscar, *Nueva Nota*. Lista tipo línea de tiempo: ícono del tipo, link al ítem, *Acción* (categoría), "Oportunidad #id", texto recortado a 100 caracteres con expandir/contraer, fecha, "hace X", autor.
- Modal `views/common/modal_note_edit.html`: **Acción** (obligatoria; categorías de tipo `action` = *Categorías de notas*, se guarda el **nombre**, no el id) y **Nota** (obligatoria).
- `POST /notes`, `PUT /notes/:id`, `DELETE /notes/:id`, lista `POST /notes/paginate {type, id, offset, count, searchTerm}` de a 50.
- Plan gratuito: solo 30 días.

### 10.2 Actividad y Línea de tiempo (`widgets/activities.html`, `widgets/timeline.html`, `ActivitiesController`)
- Actividad: registro automático (§8.1) con búsqueda, `POST /activities/paginate`.
- Línea de tiempo (en paneles de detalle): mezcla de tablas (`table_type`), `GET /activities/timeline/:model/:id/:offset/:count` (este endpoint **no figura** en `endpoints.txt`, se llama por `$http` directo).

### 10.3 Mensajes (`widgets/messages.html`, `MailsController`)
Correos y WhatsApp enviados desde el ítem: asunto, tipo, extracto; expandido: De, Para, CC, CCO, Asunto, cuerpo, adjuntos; *Reenviar*.

### 10.4 Archivos adjuntos (`widgets/uploads.html`, `UploadsController`)
Arrastrar y soltar, múltiples archivos, **máx. 10 MB** por archivo, subida directa a S3 (`GET /uploads/policy/:max_filesize`), miniaturas, estados (procesando/subiendo/errores), *Borrar todo*, *Cancelar todo*, *Quitar fallidos*, *Reemplazar* si ya existe. Recomienda Chrome y nombres sin caracteres especiales.

### 10.5 Etiquetas (`tag_item.html`, `tag_cloud.html`, directiva `tagcomplete`)
Etiquetas libres por tipo de ítem; se guardan como texto separado por comas en el registro (`row.tags`), con catálogo en `/tags`.

### 10.6 Participantes, Embudo, Progreso
Descritos en §7.4 y §4.5. `widgets/progress.html` es la versión de **Proyectos** (con "Proyección de Plazo"); no se usa en oportunidades.

> **Mejora propuesta**: una única "Línea de tiempo del cliente" que agrupe notas, correos, WhatsApp, cambios de etapa, tareas, citas, presupuestos y pagos de **todas** sus oportunidades, con filtros por tipo.

---

## 11. Configuración relacionada

Menú de configuración: `settings_menu.txt`.

### 11.1 Embudos de venta (Sales Funnels → `settings/pipelines.html`)
- Lista de embudos: Nombre, cantidad de Etapas, **Días** (suma de duraciones), herramientas: Editar nombre, **Editar etapas**, Borrar (solo si hay más de uno: "Debe tener al menos un flujo"), **Clonar** (`POST /categories/clone_workflow`), Añadir. Guardar: `POST /categories/save_workflow`. Lectura: `GET /categories/stages?type=lead_stage`.
- Editor de etapas: Nombre de la Etapa, **Duración (días)** (entero, vacío = 0), **Tareas** (una por línea; se limpian líneas vacías), ordenar arrastrando, Borrar (mínimo una). *Guardar Embudo* → `POST /stages` (lista completa). Lectura `GET /stages?type_id=<embudo>`.
- Ayuda: "Recuerde mantener la última etapa para los ítems completados. Esta etapa no será visible."
- Los mismos "workflows" se usan para proyectos (`type` distinto).

### 11.2 Oportunidades → Herramienta de formulario (`settings/formtool.html`, `loadFormTool`)
Pestañas:
- **Configuración (Setup)**: *Embudo de ventas predeterminado* (`form_lead_pipeline_id`), *Usuario predeterminado* (`default_lead_user`, dueño de las oportunidades del formulario), *Notificar al usuario* (`notify_form_lead`), *Respuesta del Formulario* (`form_lead_reply`: Desactivado / Respuesta automática / Presupuesto Estándar), *Mostrar encabezado* (`form_lead_show_header`), *Mostrar información* (`form_lead_contact`: 0 no mostrar, 1 contacto completo, 2 sin dirección), URL del formulario y código `<iframe>`, *Mensaje tras enviar* (`form_lead_sent_message`, admite código de seguimiento de Google Ads/Facebook), *Página tras enviar* (`form_lead_redirect_url`, URL válida). Texto clave: "Todas las solicitudes crean automáticamente un nuevo Contacto y una Oportunidad… Si el cliente envía varios formularios con un email ya registrado, se crea una nueva Oportunidad con el contacto existente."
- **Logo** del formulario (máx. 512 KB, sugerido 350×100).
- **Personalización del formulario**: *Activar formulario personalizado* (`custom_form_lead.is_active`) y tabla Campo / Etiqueta / Visible / Obligatorio para: General → Nombre (siempre visible y obligatorio), Apellido, Celular, Email (siempre), Categoría, Mensaje, Origen; **Boda** (solo perfil fotógrafo `persona_id == 1`) → fecha, invitados, novia, novio, lugar ceremonia, recepción, ciudad, provincia, país; **Evento** → fecha, invitados, lugar, ciudad, provincia, país. Se guarda como JSON en `custom_form_lead` (`Settings.save_custom_form_lead`); sus etiquetas de novia/novio se reutilizan en la ficha de la oportunidad.
- **Formulario Externo** (para programadores): Opción 1, `<form method="post" action="{rooturl}/api/leads/add">` con `return_url`, `date_format` y campos `name`, `lastname`, `cellular`, `email`, `category_id`, `event_date`, `bride_name`, `groom_name`, `place_event`, `place_reception`, `city_event`, `state_event`, `country_event`, `description`, `lead_origin`, `pipeline_id` (opcional). Opción 2, webhook JSON al mismo URL con los campos obligatorios `name`, `email` y opcionales anteriores + `extra1..4`, `extra_date1..2`, `date_format` (dd/mm/yyyy, mm/dd/yyyy o yyyy-mm-dd).
- Hay una lista de temas visuales (`amelia`, `cyborg`, …) cargada en el controlador sin control visible en la plantilla.

### 11.3 Oportunidades → Origen de la oportunidad (`settings/leadorigin.html`)
Área de texto: **una opción por línea** ("no deje líneas en blanco al final"). Campo `lead_origin`. Lo usan el formulario público y el alta de oportunidades. Es texto libre sin id: renombrar una opción **no actualiza** las oportunidades existentes.

### 11.4 Oportunidades → Seguimiento (`settings/followup.html`)
`followup_days` (§6.7).

### 11.5 Categorías (`settings/categories.html`, `loadCategories/saveCategories`)
Pantalla genérica por `type`:
- `contact` → *Categorías de contactos* (usadas en contactos; ids `1` y `2` se usan como valores fijos en el código de alta rápida e importación).
- `participant` → *Participantes* (roles en una oportunidad).
- `action` → *Categorías de notas* (el "Acción" de cada nota).
- (también `product`, `payment`, fuera de alcance).
Columnas: Nombre, herramientas (Editar, Borrar si `locked == 0`, Confirmar, Cancelar), ordenar arrastrando, Añadir. Guardar todo `POST /categories` (mínimo una categoría). Lectura `GET /categories?type=`.

### 11.6 Clases (`settings/classes.html`, `loadClasses`)
*Activar* (`classes_active`) y "Campo obligatorio en" Calendario, Contactos, **Oportunidades** (`classes_in_leads`), Pedidos, Proyectos, Finanzas. Editor de clases (type `class`). Requiere complemento Avanzado para verse en oportunidades/contactos.

### 11.7 Campos adicionales (`settings/extrafields.html`)
Nombres de 4 textos + 2 fechas para Contactos (`user_*`), Oportunidades (`lead_*`), Pedidos (`order_*`), Proyectos (`project_*`). Solo cambian la etiqueta; el tipo es fijo.

### 11.8 Categorías de Presupuestos = categorías de oportunidad (`settings/quotes.html`)
Aquí se crean las **categorías de oportunidad** (`type = lead_type`): Nombre, **Grupo** (`subtype`: Boda — solo perfil fotógrafo —, Evento, Trabajo con fecha, Trabajo sin fecha; `AppTables.lead_subtypes`), Activo, orden, y **Presupuesto estándar por categoría** (asunto, cuerpo HTML, adjuntos; clave `default_quote_<id>`; si no existe, usa la maestra). Variables disponibles: `[customer_name]`, `[customer_firstname]`, `[customer_lastname]`, `[customer_company]`, `[customer_email]`, `[my_name]`, `[my_firstname]`, `[my_lastname]`, `[my_email]`, `[company_name]`, `[company_email]`, `[company_website]`, `[company_phone]`, `[pricelist_link]`.

### 11.9 Plantillas de correo → Oportunidades y Presupuestos
Claves: `newlead_notif`, `autoreply`, `default_quote` (maestra), `custom_quote`, `followup` (pretty L16418-16530). Sistema: `birthday_mail_customers`. Pedidos: `order_access` (acceso al área de cliente).

> **Mejora propuesta**
> - Orígenes como catálogo con id (y opción "Otro: ___"), con UTM automáticas para el formulario web.
> - Campos adicionales **ilimitados y tipados** (texto, número, fecha, lista, casilla, moneda) por categoría de oportunidad, reemplazando los 4+2 fijos y los bloques Boda/Evento hardcodeados.
> - Categorías de oportunidad con: campos propios, embudo por defecto, plantilla de presupuesto y automatizaciones.

---

## 12. Informes e impresiones

### 12.1 Informe de oportunidades ganadas (`reports.opportunities`)
`v/views/reports/opportunities.html`, `ReportsController.loadOpportunities` (pretty L28133+).
- Título "Oportunidades Ganadas"; "Ventas por <agrupación> • <período>".
- **Filtrar por período**: Este mes, Mes pasado, Últimos 3 meses, Últimos 6 meses, Este año, Último año, Otro período (`period_table_results`).
- **Agrupar por** (menú *Informes*): Vendedor (defecto), Cliente, Origen de la oportunidad (cuenta **cantidad**, sin decimales), Ventas por Origen de la oportunidad (suma valores), Categoría de Presupuestos. Menú *Avanzado* (plan pago): Referente, Clase, Etiqueta de Oportunidades, Etiqueta de Vendedores.
- Tabla cruzada: filas = grupos, columnas = **meses**, celda = suma de `amount` de oportunidades **Ganadas** (nota al pie: "Este informe usa el campo Valor de las oportunidades con estado Ganado"); totales por fila, columna y general. Cada celda es un link al detalle. En plan gratuito solo el mes actual es clicable.
- *Exportar en CSV* (`sales_reports.csv`, separador según idioma) e *Imprimir* (`print.reports({link:'opportunities'})`).
- Recuerda en localStorage: `report_sales_group_by`, `report_period`, `report_start_date`, `report_end_date` (compartidos con el informe de ventas).
- Endpoint `POST /reports/opportunities {group, period, start_date, end_date [, csv_mode, language]}` → `{cols, r, r_labels, r_total_row, r_total_col, r_total}`. Qué fecha usa para el mes (¿`completed_date`?): **No determinable estáticamente**.

### 12.2 Detalle (`reports.opportunities_details`)
`v/views/reports/opportunities_details.html`: encabezado "Grupo: nombre • Período: mes"; buscador; columnas # · Emisión (`created`) · Fecha de cierre · Nombre (+cliente) · Fecha del trabajo/evento · Categoría · Valor · Vendedor; totales "Total de esta página" y "Total"; paginado. `POST /reports/opportunities_details {group, id, start_date, pageNumber, pageSize, sortBy, sortDir, searchTerm}`. ⚠ La columna Fecha de cierre ordena por `add_date`.

### 12.3 Impresiones
- **Resumen** (`print.leads_summary`, `index_print_summary.html`): encabezado con logo y datos del estudio, filtros aplicados, fecha de emisión; columnas # · Estado · Nombre · Cliente · Fecha del trabajo · Conflicto · % / Etapa · Valor · Fecha de cierre · Siguiente Acción · Propietario · Clase (si no se filtró por clase). Trae **todas** las filas (pageSize 999999) y lanza la impresión al terminar (`after-render-print`).
- **Detallado** (`print.leads`, `index_print.html`) y **ficha individual** (`print.lead`, `view_print.html`): ⚠ ambas plantillas son **copias de Proyectos** (usan `ProjectsController`, títulos "Proyectos • Detallado" y "Proyecto #"), y ninguna pantalla enlaza a ellas. Están rotas/abandonadas.

> **Mejora propuesta**
> - Tablero de ventas: embudo de conversión por etapa, tasa de cierre por origen/categoría/vendedor, tiempo promedio de cierre, motivos de pérdida, valor en curso ponderado, pronóstico por mes del evento.
> - Informe de **fuentes**: cuántas consultas → cuántas ventas → cuánto dinero por origen (hoy hay que combinar dos agrupaciones).
> - Impresión/PDF de la ficha de oportunidad con resumen de presupuestos y línea de tiempo.

---

## 13. Modelo de datos inferido

### 13.1 Oportunidad (`leads`)
Fuentes: `ng-model` de `edit.html`/`new_batch.html`, columnas de `index.html`/prints, lo enviado en `save`, `process_save`, `modalQuickAdd`, `loadByOrder`, `import_csv.html`, API pública.

| Campo | Tipo inferido | Significado |
|---|---|---|
| `id` | entero | número visible "#" |
| `name` | texto (≥3) | nombre de la oportunidad |
| `customer_id` | FK contacto | cliente |
| `referrer_id` | FK contacto | referente |
| `category_id` | FK categoría `lead_type` | tipo de trabajo; trae `category_name`, `category_subtype` |
| `class_id` | FK categoría `class` | clase; trae `class` (nombre) |
| `lead_origin` | texto | origen (texto libre de la lista) |
| `description` | texto largo | descripción / mensaje del cliente |
| `amount` | decimal | valor |
| `status_id` | 421–426 | estado |
| `priority_id` | 410/411/412 | prioridad; trae `priority_name` |
| `pipeline_id` | FK embudo | trae `pipeline_name` |
| `stage_id` | entero (posición 1..n) | etapa; trae `stage_name`, `stage_percent` |
| `due_date` | fecha | Siguiente Acción |
| `final_due_date` | fecha | (heredado de proyectos, sin uso visible) |
| `completed_date` | fecha | Fecha de cierre / Finalizado en |
| `started_date` | fecha | Fecha de inicio |
| `event_date` | fecha-hora | fecha de la boda/evento |
| `guests` | texto | invitados |
| `bride_name`, `groom_name` | texto | novia, novio |
| `place_event`, `place_reception` | texto | lugar ceremonia/evento, recepción |
| `city_event`, `state_event`, `country_event` | texto | ubicación del evento |
| `user_id` | FK usuario | dueño/vendedor; trae `user_name`, `user_lastname`, `user_avatar` |
| `delegated_id` | FK usuario | delegado; trae `delegated_name`, `delegated_lastname`, `delegated_avatar` |
| `follow_delegated` | 0/1 | notificar al dueño de cambios ajenos |
| `enable_followup` | 0/1 | seguimiento automático por correo |
| `quote_sent_date` | fecha-hora | último presupuesto enviado |
| `tags` | texto CSV | etiquetas |
| `extra1..extra4` | texto | campos adicionales |
| `extra_date1`, `extra_date2` | fecha | campos adicionales de fecha |
| `order_id` | FK pedido | pedido de origen (alta múltiple) |
| `created`, `modified` | fecha-hora (hora local del navegador) | alta / modificación |
| (calculados) `lead_conflict`, `order_conflict`, `conflict` | enteros/texto | conflictos de fecha |
| (calculado) `info.quotes`, `info.events`, `info.costs` | enteros | contadores de la ficha |
| (lectura) `customer_*`, `referrer_*` | varios | datos aplanados del cliente/referente |
| (solo al guardar) `stage_change`, `stage_memo`, `stage_tasks`, `stage_name`, `stage_user`, `save_tags` | — | instrucciones para el servidor (historial y tareas) |

### 13.2 Historial de progreso (`/leads/progress`)
`{created, user_id (+user_name, user_avatar), stage_id, stage_name, due_date, note}` (`widgets/pipeline.html`). Se genera con `progress_change` y (probablemente) al guardar con `stage_change`.

### 13.3 Embudo y etapa
- Embudo (`categories` con `type = 'lead_stage'`): `id`, `name`, `type`, `stage_count`, `total_days`.
- Etapa (`stages`): `id`, `type_id` (embudo), `stage` (posición), `name`, `offset_days`, `tasks` (texto multilínea).
- Orden manual de tarjetas en el kanban: guardado por `save_pipelines` (estructura **No determinable estáticamente**; probablemente un campo de orden en la oportunidad).

### 13.4 Contacto (tabla de usuarios, `role = contact`)
`id`, `type` (categoría; trae `type_name`), `is_company`, `company`, `name`, `lastname`, `email` (único global, opcional), `email2`, `phone`, `cellular`, `birthday`, `gender` (`male`/`female`), `rg` (DNI o ID empresa), `cpf` (NIF/CPF/CNPJ), `site_url`, `memo`, `class_id`, `tags`, `zipcode`, `country`, `address1`, `address2`, `city`, `state`, `extra1..4`, `extra_date1..2`, `avatar`, `password`, `notification_email`, `fb_id`, `created`, `modified`. Contadores (`/contacts/info`): `leads`, `quotes`, `orders`, `agreements`, `projects`, `proof_customers`, `ar`, `ar_paid`, `ap`, `ap_paid`.

### 13.5 Otras entidades del módulo
| Entidad | Campos | Endpoints |
|---|---|---|
| Relación entre contactos | `contact_id`, `relation_id` (+`relation_name`), datos aplanados del contacto | `/contacts/related/:id`, `/contacts/save_related`, `/contacts/relation_list` |
| Participante | `type` (leads), `target_id`, `contact_id`, `category_id` (+`category_name`), `memo` | `/participants`, `/participants/paginate` |
| Nota | `id`, `user_id`, `type`, `target_id`, `customer_id`, `action` (texto de categoría), `text`, `created` | `/notes`, `/notes/paginate` |
| Actividad | `user_id`, `customer_id`, `target_id`, `type`, `text`, `link`, `created` | `/activities`, `/activities/paginate`, `/activities/timeline/…` |
| Mensaje | `user_id`, `customer_id`, `type`, `target_id`, `message_type` (mail/whatsapp), `from_mail`, `to_mail`, `cc_mail`, `bcc_mail`, `subject`, `body`, `attachments` | `/mails/save`, `/mails/send` |
| Tarea | `id`, `user_id`, `type`, `target_id`, `due_date`, `title`, `completed`, orden | `/tasks`, `/tasks/sort`, `/tasks/del_completed`, `/tasks/set_date/:id` |
| Notificación | `sender_id`, `user_id`, `type`, `text`, `link` | `/notifications` |
| Etiqueta | `tag`/`name`, `type`, `target_id` | `/tags`, `/tags/batch`, `/tags/pipeline` |
| Categoría | `id`, `name`, `type` (contact/participant/action/class/lead_type/lead_stage/…), `subtype`, `active`, `locked`, orden | `/categories`, `/categories/list`, `/categories/stages`, `/categories/save_workflow`, `/categories/clone_workflow` |
| Costo de oportunidad | `vendor_id` (+`vendor_name`), `account_cogs_id` (+nombre), `name`, `cost` | `/costs/leads/:id` |
| Configuración | `lead_origin`, `followup_days`, `form_lead_*`, `default_lead_user`, `notify_form_lead`, `custom_form_lead` (JSON), `lead_extra*`, `lead_date*`, `user_extra*`, `user_date*`, `classes_*`, `lead_pipeline_type`, `MailTemplates{…}` | `/settings` |

### 13.6 Endpoints del módulo (resumen)
- `/leads`: `GET /leads/:id`, `POST /leads/save`, `PUT /leads/:id`, `DELETE /leads/:id`, `POST /leads/paginate`, `POST /leads/pipelines`, `PUT /leads/save_pipelines`, `PUT /leads/save_pipelines_dueDate`, `PUT /leads/progress_change/:id`, `GET /leads/progress/:id/:offset/:count`, `GET /leads/:type/:id/:offset/:count` (type `contact`/`user`), `GET /leads/conflict/:id/:per_page`, `PUT /leads/date_sent/:id`, `PUT /leads/set_fup/:id/:enable_followup`, `POST /leads/single_duedate`, `POST /leads/batch_{delete,duedate,finish,pipeline,priority,users}`, `POST /leads/save_batch`, `POST /leads/import/csv`, `GET /leads/list`, `GET /leads/all`; público `POST /api/leads/add`.
- `/contacts`: `GET/POST/PUT/DELETE /contacts[/:id]`, `POST /contacts/paginate`, `GET /contacts/list?type=all_users&query=&limit=`, `GET /contacts/all`, `GET /contacts/info/:id`, `GET /contacts/get_to/:model/:id` (datos del contacto dueño de un ítem), `GET /contacts/tag`, `GET /contacts/related/:id`, `GET /contacts/relation_list`, `POST /contacts/save_related`, `POST /contacts/add_update`, `POST /contacts/batch_delete`, `POST /contacts/batch_type`, `POST /contacts/import/csv`, `DELETE /contacts/remove_password/:id`.
- Otros: `/stages/list`, `/tags`, `/tags/batch`, `/tags/pipeline`, `/notes`, `/notes/paginate`, `/activities`, `/activities/paginate`, `/mails/save`, `/mails/send`, `/tasks…`, `/categories…`, `/participants…`, `/costs/:type/:id`, `/reports/opportunities`, `/reports/opportunities_details`.

### 13.7 Riesgos para la migración
1. `stage_id` es **posición**, no id: exportar también el embudo con sus etapas en orden **al momento** de la exportación.
2. `lead_origin` y `notes.action` son **texto**: normalizar a catálogos al importar (agrupar variantes).
3. `tags` es texto separado por comas: convertir a tabla de etiquetas.
4. Contactos comparten tabla con usuarios; filtrar `role = contact`. Emails únicos globales → verificar colisiones con usuarios del estudio.
5. `priority_id` 410/411/412 (y posibles 100/101/102 si el masivo no los traduce).
6. `created`/`modified` se guardan con la **hora local del navegador**, sin zona horaria explícita.
7. Datos de boda/evento viven en la oportunidad, no en el contacto.
8. `extra1..4` tienen significados distintos por cliente de Alboom: mapear usando los nombres de configuración (`lead_extra*`, `user_extra*`).
9. Oportunidades con estado cerrado pero etapa intermedia (por cierre masivo) y oportunidades Abiertas en la última etapa pueden coexistir.

---

## 14. Errores y rarezas detectadas en el código (útiles para no copiarlos)

| # | Hallazgo | Origen |
|---|---|---|
| 1 | Impresión detallada y ficha impresa de oportunidades son copias de Proyectos (`ProjectsController`, "Proyecto #"). | `v/views/leads/index_print.html`, `view_print.html` |
| 2 | Cumpleaños y Aniversarios: rutas con plantilla 404 y menú oculto (`&& false`). | `v/views/contacts/birthdays.html`, `navigation.html` |
| 3 | Modal "¿Crear pedido ahora?" nunca se muestra (nadie llama `setStatus(…, true)`). | `leads/modal_create_order.html`, `LeadsController.setStatus` |
| 4 | Prioridad masiva envía 100/101/102; la oportunidad usa 410/411/412. | `modal_priority_checked.html` vs `edit.html` |
| 5 | Cambiar de etapa reabre la oportunidad y borra la Fecha de cierre. | `changePipeline`, `setNextStage` |
| 6 | Cerrar desde el kanban como Suspendido/Abandonado/Fecha no disponible no pone fecha de cierre; desde el formulario sí. | `setStatus` vs `$watch('row.status_id')` |
| 7 | Tareas automáticas se asignan a quien mueve y vencen hoy. | `createTasks` |
| 8 | Selectores de "Cambiar usuarios" son obligatorios aunque el texto diga "deje en blanco". | `modal_users_checked.html` |
| 9 | Alta múltiple muestra etiquetas de campos adicionales de **Pedidos**. | `new_batch.html` |
| 10 | Scroll infinito de "Pagado" del contacto carga "Recibidas". | `contacts/ap_paid.html` |
| 11 | Informe detalle: "Fecha de cierre" ordena por `add_date`. | `reports/opportunities_details.html` |
| 12 | Etiqueta "Onwer" (errata) y traducción "Deleg" → "Borrar". | `edit.html`, `es.json` |
| 13 | Filtro por período del evento (`itemPeriodJob`) programado pero no declarado en la ruta: no funciona. | `selectPeriod`, estado `leads.index` |
| 14 | `LeadsController.loadInfo` llama `Leads.get_info`, que no existe en el servicio. | factory `Leads` |
| 15 | `pageSize` se comparte entre todos los listados del sistema. | `getData` |
| 16 | Vista previa de importación de oportunidades usa `costumer_address` y muestra `lead_extra1` como título de `extra4`. | `leads/import_csv.html` |

---

## 15. Resumen de mejoras propuestas para FOTOFFICE (consolidado)

1. **Embudo**: etapas por id con historial de tiempos; columnas finales Ganada/Perdida arrastrables; motivo de pérdida obligatorio desde catálogo; totales y valor ponderado por columna; tiempo real entre usuarios.
2. **Siguiente acción + tareas**: toda oportunidad abierta debe tener una próxima acción; tareas automáticas con responsable y vencimiento relativos; vista "Mi día" (vencidas, hoy, próximas).
3. **Automatizaciones** configurables (disparador → condiciones → acciones) reemplazando follow-up fijo, respuesta automática y correo por etapa.
4. **Categorías de trabajo con campos propios** (boda, evento, escolar, corporativo, retrato…), en lugar de bloques Boda/Evento en código y 4+2 campos extra.
5. **Contactos**: separar contacto de acceso al portal; email no único; deduplicación y fusión; varios contactos con rol por oportunidad; relaciones bidireccionales; fechas especiales.
6. **Disponibilidad de fechas** con capacidad por día/equipo y bloqueo al ganar.
7. **Línea de tiempo unificada** por cliente y por oportunidad (notas, mensajes, WhatsApp entrante/saliente, cambios, tareas, citas, presupuestos, pagos).
8. **Listados**: vistas guardadas en servidor, filtros visibles, columnas elegibles, export fiel, selección de todo el resultado.
9. **Captación**: formulario público propio con anti-spam, UTM, webhook, y deduplicación de contactos por email/teléfono.
10. **Informes**: conversión por etapa/origen/categoría/vendedor, motivos de pérdida, pronóstico por mes del evento.
11. **Migración**: importador específico de Alboom que resuelva posiciones de etapa, orígenes/etiquetas en texto, prioridades y zonas horarias (§13.7).

---

## 16. Dudas a verificar en el sistema en vivo

1. ¿Qué campos incluye el **CSV exportado** de oportunidades y de contactos (`csv_mode=1`)?
2. Criterio exacto de **"vencida"** (`itemExpired`, contadores `due_user`/`due_all`): ¿`due_date < hoy` y estado Abierto?
3. Criterio de **conflicto de fecha**: ¿mismo día de `event_date`?, ¿incluye oportunidades cerradas o pedidos cancelados?
4. ¿Qué oportunidades aparecen en el **kanban** (solo Abiertas o todas las que no están en la última etapa)?
5. **Seguimiento automático**: ¿cuándo se dispara exactamente, cuántas veces, se detiene si cambia el estado?, ¿`enable_followup` nace en 1 o 0?
6. **Prioridad masiva**: ¿el servidor traduce 100/101/102 a 410/411/412 o quedan valores inválidos?
7. **Cambio de embudo masivo**: ¿a qué etapa quedan las oportunidades?
8. Qué hace el servidor con `stage_change/stage_memo` al guardar: ¿siempre agrega línea al historial de progreso?
9. **Importación de oportunidades** con email de contacto existente: ¿se crea la oportunidad asociada al contacto o se descarta la fila?
10. Filtro **Cumpleaños** de contactos: ¿qué rango de fechas muestra?
11. Estructura de `save_pipelines` (orden manual de tarjetas) y si persiste entre usuarios.
12. Significado de los tipos de notificación 1 y 2.
13. Pantalla real del formulario público `/form_lead/#/index` (no está en el material) y comportamiento de `POST /api/leads/add` (duplicados, validaciones, `return_url`).
14. ¿La relación entre contactos se guarda en ambos sentidos?
15. ¿Qué fecha usa el **informe de oportunidades ganadas** para asignar el mes (`completed_date`, `created`, `event_date`)?
16. ¿Cómo funciona el envío de **WhatsApp** (enlace wa.me o API) y si registra respuestas?
17. ¿Qué pasa con las oportunidades cuando se **borra o reordena una etapa** en la configuración del embudo?
18. Valores por defecto de las categorías de contacto `1` y `2` (usados fijos en el código): ¿"Cliente" y "Proveedor"?
