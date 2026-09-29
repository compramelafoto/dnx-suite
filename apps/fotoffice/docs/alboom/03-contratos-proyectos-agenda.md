# 03 · Contratos, Proyectos (con Flujos de trabajo) y Calendario / Agenda

> Análisis funcional **estático** del panel "Alboom CRM" (AngularJS 1.x) para replicarlo mejorado en FOTOFFICE y migrar datos.
> Fuentes: `app.js` (controladores `AgreementsController`, `ProjectsController`, `CalendarController`, `ParticipantsController`, `TasksController`, `SettingsController`, `ActivitiesController`; servicios `$resource`), `v/views/**`, `endpoints.txt`, `es.json`, `settings_menu.txt`.
> Nombres en **español tal como los ve el usuario** (según `es.json`), con el inglés entre paréntesis la primera vez.
> "**No determinable estáticamente**" = depende del servidor (PHP/API) y no hay forma de verlo en el código del navegador.

---

## 0. Resumen ejecutivo (cómo encaja todo)

1. **El Pedido (Order) es el centro.** Los Contratos sólo se pueden crear desde un Pedido; los Proyectos y las Citas pueden crearse **automáticamente** al completar un Pedido según la configuración de cada **Producto**.
2. **Proyecto = trabajo de producción** (edición, álbum, entrega). Lleva un **Flujo de trabajo** (Workflow) con **Etapas** (Stages); cada etapa tiene **duración en días** y una **lista de tareas modelo**. Cambiar de etapa recalcula la **fecha límite de la etapa**, cambia el **estado** del proyecto, crea **Tareas** y deja un registro en el **Histórico de progreso**.
3. **Calendario** agrupa en "capas" las Citas propias más, como superposición, Proyectos (por fecha límite), Oportunidades, Cuentas (finanzas), Tareas y Cumpleaños. Se puede arrastrar para cambiar fechas y publicar como iCal.
4. **Contrato** = texto HTML generado desde una **plantilla** con variables `[clave]` que se reemplazan **una sola vez al crearlo** con datos del Pedido, Cliente, Contratantes y Empresa. El cliente lo **ve**, lo **acepta o rechaza** y **firma** (nombre escrito + firma dibujada opcional) con IP y fecha.

```
Producto (config. proyecto/cita) ──┐
                                   ▼
Oportunidad → Presupuesto → PEDIDO ──(estado "Venta Completada")──► PROYECTO(s) + CITA(s) automáticos
                              │                                        │
                              ├─ Contratos (desde plantilla)            ├─ Flujo de trabajo → Etapas → Tareas
                              ├─ Citas (pestaña Citas)                  ├─ Galerías de prueba (project_id)
                              └─ Tareas de Pedido (flujo order_stage)   ├─ Citas (type=projects)
                                                                        └─ Contactos relacionados, Notas, Adjuntos
```

---

## 1. Rutas (estados ui-router) del módulo

Fuente: `app.js` (`.state(...)`).

| Estado | URL | Plantilla | Restricción / notas |
|---|---|---|---|
| `index.dashboard` | `/index/dashboard` | `views/main.html` → directiva `dashboard-widget` | Carga `views/dashboard/{user\|contact\|backend}.html` según rol. **Esas plantillas no están en el material** → Inicio del usuario interno: No determinable estáticamente. |
| `index.dashboard.projects/quotes/orders/agreements/events/ar/ar_paid` | `/projects`, … | `views/dashboard/*.html` | Son las **pestañas del Área de Clientes** (portal del cliente): todas usan `loadByType('customer')`. `events/ar/ar_paid` exigen módulo calendario activo. |
| `projects.dashboard` | `/projects/projects/dashboard` | `views/projects/index.html` | Mismo listado. |
| `projects.index` | `/projects/index/{itemCategory}/{itemUser}/{itemExpired}/{itemPipeline}/{itemStage}` | `views/projects/index.html` | Módulo proyectos activo (`user.modules.projects == 1`). Parámetros extra: `itemClass`, `itemFilter`. |
| `projects.index.details` | `…/details/:id` | `views/projects/detail.html` | Panel lateral (vista dividida). |
| `projects.view` (+ `.order`, `.proofs`, `.events`) | `/projects/view/:id` | `views/projects/view.html` | Requiere `user_projects_create == 1` o admin. |
| `projects.edit` | `/projects/edit/{id}` | `views/projects/edit.html` | Ídem. Carga plugin `ionRangeSlider`. |
| `projects.new` | `/projects/new?customer_id` | `views/projects/edit.html` | Params ocultos `customer_id`, `order_id`. |
| `agreements.index` | `/agreements/index/{itemUser}` | `views/agreements/index.html` | Requiere módulo **Pedidos** (`modules.orders`). |
| `agreements.index.details` | `…/details/:id` | `views/agreements/detail.html` | **Plantilla 404 en el material.** |
| `agreements.new` | `/agreements/new` | `views/agreements/edit.html` | Params `order_id`, `template` (objeto). |
| `agreements.edit` / `agreements.clone` / `agreements.view` | `/edit/:id`, `/clone/:from_id`, `/view/:id` | edit/edit/view | Ver bug de clonado en §3.9. |
| `agreement_review.sign` | `/agreement_review/sign/:unique_id` | `views/agreements/view_sign.html` | Página de **revisión y firma** del cliente. Requiere sesión (`return !!user`). |
| `print.agreement` | `/print/agreement/:unique_id` | `views/agreements/view_print.html` | Imprimible (también usado como vista pública). |
| `print.agreements`, `print.agreements_summary` | `/print/agreements/{itemCategory}/{itemUser}/{sortBy}/{reverseSort}/{searchTerm}` | `index_print*.html` | **Plantillas 404 en el material.** |
| `print.projects` / `print.projects_summary` | `/print/projects/{itemCategory}/{itemUser}/{sortBy}/{reverseSort}/{searchTerm}/{itemExpired}` | `index_print.html` / `index_print_summary.html` | Listados imprimibles. |
| `print.project` | `/print/project/:id` | `view_print.html` | Ficha imprimible. |
| `calendar.index` / `calendar.index2` | `/calendar/index`, `/calendar/index2` | `calendar/index.html`, `index2.html` | `index2` es idéntico pero con enlaces iCal por `http` (`insecure_rooturl`). |
| `calendar.list` | `/calendar/list` | `calendar/list.html` | Modo lista. |
| `calendar.view` / `calendar.view_list` | `/calendar/view/:unique_id`, `/view_list/:unique_id` | index/list | **Vista pública de solo lectura** del calendario de un usuario (por su `unique_id`). |
| `print.calendar_list` | `/print/calendar_list/{itemStartType}/{itemCategory}/{itemUser}/{itemStatus}/{sortBy}/{reverseSort}/{searchTerm}/{itemStartDate}/{itemEndDate}` | `calendar/list_print.html` | |

Menú lateral (`views/common/navigation.html`): **Inicio** (Home), **Calendario**, en Ventas: **Mis Contratos** (`agreements.index({itemUser: yo})`) y **Todos los Contratos** (sólo si no está restringido a "sus ítems"); en Proyectos: **Mis Proyectos** (`itemUser: yo, itemExpired:false`) y **Todos los Proyectos**, cada uno con un **globo rojo** con la cantidad de proyectos vencidos (`dbStatus.projects.due_user` / `due_all`, obtenidos por `Settings.get_due`). La barra superior (`topnavbar.html`) muestra el mismo contador y enlaza a `projects.index({itemExpired:true, itemUser: yo})`.

---

## 2. API (endpoints) del módulo

Fuente: `endpoints.txt` + fábricas `$resource` en `app.js`. `SERVER_URL` = base de la API.

| Recurso (servicio) | Operaciones |
|---|---|
| **Agreements** | `GET /agreements/:id` (query), `GET /agreements` (get), `POST /agreements` (crear), `PUT /agreements/:id` (update), `DELETE /agreements/:id`, `POST /agreements/paginate`, `GET /agreements/:type/:id/:offset/:count` (por tipo: `order(s)`, `customer`, `user`, `contact`), `GET /agreements/unique/:unique_id`, `PUT /agreements/viewed` (marca visto), `PUT /agreements/date_sent/:id`, `PUT /agreements/sign/:id`, `PUT /agreements/force_sign/:id`, `POST /agreements/batch_delete` |
| Plantillas de contrato | `GET /agreement_templates/:id` (lista, filtro `active`), `POST /agreement_templates` (actualizar existente, "save_templates"), `POST /agreement_template` (crear), `DELETE /agreement_templates/:id` |
| Pedidos (relacionado) | `PUT /orders/agreement_date_sent/:id` |
| **Projects** | `GET/POST/PUT/DELETE /projects/:id`, `GET /projects/all`, `GET /projects/list`, `POST /projects/paginate`, `GET /projects/:type/:id/:offset/:count` (`order`, `contact`, `customer`, `user`), `GET /projects/progress/:id/:offset/:count` (histórico de etapas), `PUT /projects/set_date/:id` (cambia fecha límite desde calendario), `POST /projects/batch_delete`, `batch_duedate`, `batch_finish`, `batch_priority`, `batch_users`, `POST /projects/single_duedate` |
| **Categories** (flujos) | `GET /categories/stages?type=` (lista de flujos con `stage_count`, `total_days`), `POST /categories/save_workflow`, `POST /categories/clone_workflow`, `GET /categories/list?type=` (clases, etc.), `GET /categories?type=participant` |
| **Stages** | `GET /stages?type_id=` (etapas de un flujo), `POST /stages` (guardar todas), `GET /stages/list?type=stage` → `{stage_list:[flujos], stages:{<pipeline_id>:[etapas]}}` |
| **Tasks** | `GET /tasks` (paginado por `offset`, filtros `user_id`, `model`, `target_id`), `POST /tasks`, `PUT /tasks/:id`, `DELETE /tasks/:id`, `PUT /tasks/set_date/:id`, `POST /tasks/del_completed`, `POST /tasks/sort` |
| **Events** (citas) | `GET/POST/PUT/DELETE /events/:id`, `POST /events/paginate`, `POST /events/feed` (para el calendario, con capas), `PUT /events/quick_update/:id` (arrastrar/redimensionar), `GET /events/:type/:id/:offset/:count`, `GET /events/alerts/:user_id/:localtime` (alarmas vencidas), `POST /events/notify_participants` |
| **EventTypes** | `GET /eventtypes`, `POST /eventtypes` (guardar todos) |
| **Participants** | `POST /participants/paginate`, `POST /participants` (guarda la lista completa de un ítem) |
| **Sessions** | `GET /sessions`, `DELETE /sessions/:id` (revocar). **Son sesiones de inicio de sesión (login), no "sesiones de fotos".** |
| iCal (fuera de la API) | `{rooturl}/calendar/ical/{all\|user}/{unique_id}/{type_id\|projects\|leads\|finance\|tasks\|birthdays}` |
| Galerías del proyecto (público) | `{rooturl}/proofs/project/{project_id}` |
| Contrato público | `{rooturl}/agreement/{unique_id}` (enlace del correo) |

---

## 3. CONTRATOS (Agreements)

### 3.1 Concepto y reglas de negocio

- Un **Contrato** siempre pertenece a un **Pedido** (`order_id`) y a su **Cliente** (`customer_id`). Si se intenta crear sin pedido: aviso "Por favor agregue un contrato desde un Pedido" y redirige a Pedidos (`AgreementsController.loadEdit`).
- Se genera desde una **Plantilla de contrato** (Configuración → Contratos). Las variables `[clave]` se reemplazan **en el navegador, una sola vez, al crear**; lo que se guarda es HTML ya "congelado". La propia pantalla de configuración lo advierte: si cambian los datos, hay que editar el contrato a mano o crear uno nuevo.
- Hasta **dos contratantes** (Contratante 1 y 2 = `contractor1_*`, `contractor2_*`, que son contactos elegidos en el Pedido; por defecto el Contratante 1 es el cliente — `OrdersController`: `contractor1_id = customer_id` si está vacío).
- Estados derivados (no hay un campo "estado"; se infiere de fechas):
  - **No ha enviado** / **Enviado** (`sent_date`).
  - **No visto** / **Visto** (`viewed`, fecha+hora).
  - **No Firmado** / **Firmado** (`signed`, fecha+hora).
  - **Falta 1 firma** (Missing 1 signature): hay contratante 2 (o 1) sin firmar y el cliente ya aceptó.
  - **No Estoy de Acuerdo** (Not Agree): `signature.agree == false`; clic muestra el motivo (`modal_view_disagree.html`).

### 3.2 Listado de Contratos (`views/agreements/index.html`)

- **Acceso**: menú Ventas → Mis Contratos / Todos los Contratos. Migas: Inicio › Pedidos › Contratos. Botón superior **Nuevo Pedido** (no hay "Nuevo contrato" directo).
- **Columnas** (todas ordenables con clic; flecha indica sentido): `#` (id), **Creado** (`created`), **Enviado** (`sent_date`, o "No ha enviado"), **Cliente** (`customer_name`; al pasar el mouse muestra email, email2, teléfono, celular, ciudad/estado/país), **Fecha del trabajo/evento** (`orders.event_date`), **Pedido** (`order_id`), **Total** (`order_total`), **Vendedor** (Sales Person, `user_id`, avatar), **Vistos** (`viewed`), **Firmado** (`signed`), columna de alertas (Falta 1 firma / No Estoy de Acuerdo), casilla de selección, acciones.
- Clic en una fila → va a **Pedido › pestaña Contratos** (`orders.view.agreements`) con el contrato resaltado.
- **Orden por defecto**: `id` descendente. **Paginación** del servidor (`/agreements/paginate`): `pageNumber`, `pageSize` (por defecto 10; el tamaño elegido se guarda en `localStorage.pageSize`, común a todos los listados), pie `<pagination-footer>`.
- **Buscador**: texto libre, espera 500 ms y mínimo 2 caracteres (`searchTerm`). Campos buscados: No determinable estáticamente.
- **Filtro por usuario**: desplegable "Filtrado por usuario" (sólo si el usuario no está limitado a "sus ítems" o es admin). Va por URL (`itemUser`).
- **Nube de etiquetas** (`<tag-cloud>`) presente al pie.
- **Acciones por fila** (botones y menú): Borrar contrato; **Marcar como Firmado** / **Marcar como No Firmado** (sólo con permiso `user_agreements_edit` o admin); **Enviar** (correo); **Enviar por WhatsApp** (si el cliente tiene celular); **Ver**; **Editar** (sólo si **no fue visto** y el usuario tiene permiso o el plan no tiene "addon_advanced"); **Clonar**.
- **Acciones masivas**: sólo **Borrar** (`/agreements/batch_delete`) con confirmación "¿Desea borrar N contratos seleccionados?".
- **Imprimir listado / resumen**: los estados existen (`print.agreements`, `print.agreements_summary`) pero las plantillas no están disponibles (404) y no hay botón visible en el listado.
- No hay exportación CSV de contratos.

### 3.3 Contratos dentro del Pedido (`views/orders/agreements.html`)

- Botón **Añadir Contrato** → modal `modal_add.html`: "Seleccione una plantilla para añadir al pedido #N": **Plantilla** (obligatoria; sólo plantillas **activas**). Al aceptar → `agreements.new` con `order_id` y la plantilla.
- Columnas: `#`, **Creado / Por**, **Enviado** (fecha+hora), **Nombre**, **Vistos**, **Firmado** (sólo si la firma online está activa), alertas.
- Acciones: **Clonar** (copia con nombre "… (clone)" dentro del mismo pedido), **Ver**, **Imprimir** (abre `print.agreement` en pestaña nueva), **Enviar**, **Enviar por WhatsApp** (si no tiene `sig_hash` y hay celular), **Editar** (no visto y no firmado), Marcar firmado/no firmado, Borrar.
- Carga por desplazamiento infinito (`loadByType`), de a 50.

### 3.4 Crear / editar contrato (`views/agreements/edit.html`)

- Título "Añadir Contrato" / "Editar Contrato #N". Migas: Inicio › Pedidos › Pedido #N › …
- **Formulario**:
  - **Nombre** * (texto, mínimo 3 caracteres). Se precarga con el nombre de la plantilla.
  - **Texto**: editor enriquecido (Summernote, 500 px) con negrita, cursiva, subrayado, fuentes, color, listas, tablas, enlaces, imágenes, línea, código. **Al pegar, se pega como texto plano**.
  - Si el plan tiene "addon_advanced" y el usuario **no** tiene permiso de edición de contratos ni es admin → el editor queda **bloqueado** (sólo lectura) y se oculta la barra.
- **Guardar**: crea (`POST`) y luego reemplaza `[agreement_id]` por el número real y vuelve a guardar (`PUT`). Registra Actividad en el Pedido ("Contrato #N fue creado/guardado"). Vuelve a la pestaña Contratos del Pedido.
- **Cancelar** vuelve atrás.

### 3.5 Variables de plantilla (reemplazo)

Fuente: `AgreementsController.agreement_vars` y `views/settings/agreements.html`. Formato `[clave]`. Se toman del **Pedido** (`Orders.query`) enriquecido con datos del usuario y la empresa.

| Grupo | Claves |
|---|---|
| Cliente | `customer_name` (nombre completo), `customer_firstname`, `customer_lastname`, `customer_email`, `customer_email2`, `customer_company`, `customer_address`, `customer_address2`, `customer_city`, `customer_state`, `customer_zipcode`, `customer_country`, `customer_phone`, `customer_mobile`, `customer_doc1` (en pantalla: "licencia de conducir"/doc. 1 = `rg`), `customer_doc2` (identificación fiscal = `cpf`), `customer_extra1..4`, `customer_date1..2` |
| Contratante 1 y 2 | `contractorN_name`, `_firstname`, `_lastname`, `_email`, `_email2`, `_company`, `_address`, `_address2`, `_city`, `_state`, `_zipcode`, `_country`, `_phone`, `_mobile`, `_doc1`, `_doc2`, `_extra1..4`, `_date1..2`, **`contractorN_signature`** (lugar de la firma online) |
| Pedido | `order_number`, `order_items` (lista "- **Producto** (xN) + descripción"), `order_details_amount` (tabla: Cantidad, Servicio, Descripción, Vl Total, Descuento %, Valor final + totales y descuento del pedido), `order_total_amount`, `order_pay_number` (cantidad de cuotas), `order_pay_sched` (tabla: Pago N°, Vencimiento, Monto, Medio de pago, N° documento), `order_memo`, `extra1..4`, `date1..2` |
| Usuario que crea | `my_name`, `my_firstname`, `my_lastname`, `my_email` |
| Empresa | `company_name` (razón social), `company_trade_name`, `company_email`, `company_website`, `company_phone`, `company_address`, `company_address2`, `company_city`, `company_state`, `company_zipcode`, `company_country`, `company_doc2` (CUIT/CNPJ), **`company_signature`** (firma digitalizada) |
| Fechas | `current_date` (fecha larga de hoy) |
| Boda (sólo si `persona_id == 1`) | `wedding_date`, `wedding_time`, `wedding_bride`, `wedding_groom`, `wedding_ceremony_place`, `wedding_reception_place`, `wedding_city`, `wedding_state`, `wedding_country`, `wedding_guests` |
| Evento | `event_name`, `event_date`, `event_time`, `event_place`, `event_city`, `event_state`, `event_country`, `event_guests` |
| Otros trabajos | `job_name`, `job_date`, `job_time`, `job_place`, `job_city`, `job_state`, `job_country` |
| Otros | `page_break` (salto de página al imprimir), `agreement_id` (número de contrato; se completa tras guardar) |

Observaciones:
- Variables heredadas en portugués aceptadas para firma: `[cliente_assinatura]`, `[cliente2_assinatura]`, `[empresa_assinatura]` (contratos "legacy").
- `[pricelist_link]` aparece en la ayuda de Configuración pero **no está** en la lista del controlador → no se reemplaza (inconsistencia).
- Fechas se formatean con el formato corto del idioma; montos con la moneda de la cuenta.

### 3.6 Ver contrato (`views/agreements/view.html`) e imprimir

- "Ver Contrato": botones Borrar, **Enviar Contrato**, **Imprimir** (`print.agreement`), **Editar** (si no fue visto). Muestra el logo de impresión de la empresa y el texto con las firmas aplicadas (`apply_signature`): firmas existentes se dibujan como imagen + nombre en fuente azul + leyenda "Firmado digitalmente el {fecha}, IP: {ip}, por {nombre}"; firma de empresa como imagen (`AppSettings.signature`, con desplazamiento vertical `signature_offset`) o línea para firmar.
- `print.agreement/:unique_id` (`view_print.html`): si quien abre **no tiene sesión** o es **contacto**, marca el contrato como **visto** (`PUT /agreements/viewed`).

### 3.7 Firma electrónica por el cliente (`view_sign.html` + `view_sign_include.html`)

Flujo (`AgreementsController.loadSignUniqueId`, `view_sign`, `saveSignature`):
1. El cliente entra por el enlace del correo/WhatsApp (`/agreement/{unique_id}`) o desde el **Área de Clientes → Contratos → "Ver y Firmar"**. Se registra **visto** y se obtiene su **IP** (`getUsersIP`).
2. Ve el contrato. Donde está `[contractor1_signature]` aparece la etiqueta "Este documento puede ser firmado digitalmente" (sólo si la cuenta tiene el complemento de firma y "Activar firma en línea de contratos" = Sí).
3. Botones: **Volver y firmar más tarde** · **Estoy de Acuerdo** · **No Estoy de Acuerdo**.
4. **Si acepta**: por cada contratante pendiente, "Firma de {nombre}": **Escriba su nombre completo** (se aplica con una fuente azul ilustrativa) + **Dibujar su Firma** (panel de firma; botón **Limpiar**) salvo que la configuración sea "sólo Escribir". Botón **Guardar Firma**. Validaciones: nombre obligatorio; firma dibujada obligatoria si no es "sólo Escribir".
5. **Si no acepta**: "Describa por qué usted no está de acuerdo con este contrato:" (texto obligatorio) → Guardar. Redirige al Área de Clientes.
6. Se guarda `PUT /agreements/sign/:id` con `{signature:{agree, contractor1, signature1 (imagen base64), ip1, signed1, contractor2, signature2, ip2, signed2, not_agree_reason}, signed, signature_saved: 1|2, ip}`.
7. Automatizaciones: Actividad en el Pedido ("Firma N del contrato #X guardada" o "guardado como No Estoy de Acuerdo") y **Notificación** interna al dueño del contrato (tipo 2 = positiva / tipo 1 = aviso).

Configuración relacionada (`views/settings/signatures.html`, Configuración → Sistema → Firmas):
- Pestaña **Firma digitalizada de la empresa**: subir imagen (JPG/GIF/PNG, máx. 2 MB) + **Desviación de posición** (px; positivo = más arriba). Se inserta con `[company_signature]`; también se usa en recibos.
- Pestaña **Firma online de cliente** (requiere complemento `addon_signature`; en plan gratuito aparece con corona "premium"): **Activar firma en línea de contratos** Sí/No; **Las firmas deben ser**: **Escribir** / **Escribir y Dibujar**. Advertencia legal: no usa certificado digital.

### 3.8 Marcar firmado / no firmado (forzado)

- **Marcar como Firmado**: `PUT /agreements/force_sign/:id {signed: ahora}` (firma manual, p. ej. contrato en papel). Actividad en el pedido.
- **Marcar como No Firmado**: modal "Borrar Firma de Contrato — ¿Desea marcar como No Firmado el contrato #N?" → `signed: null` y **borra la firma** (`signature = null`).
- Permiso: `user_agreements_edit == 1` o admin.

### 3.9 Enviar, clonar, borrar

- **Enviar** (correo): abre el compositor de correo con la plantilla de sistema **"Contrato"** (`agreement`) y campos: `customer_name/firstname/lastname/company/email/mobile`, `company_name/email/website/phone`, `link` (= `{rooturl}/agreement/{unique_id}`), `order_number`, `email_signature`. Al enviarse (`mail:sent`) marca `sent_date` en el contrato **y** en el pedido (`/orders/agreement_date_sent`).
- **WhatsApp**: abre el módulo de WhatsApp con el celular del cliente y el enlace.
- **Clonar** desde el Pedido: copia todo (texto ya renderizado), nombre + " (clone)".
- **Clonar** desde el listado general: usa `agreements.clone({id})` pero el estado espera `from_id` y `loadEdit` no contempla clonar → **probablemente no funciona** (verificar en vivo).
- **Borrar**: individual o masivo; Actividad "Contrato #N fue borrado" y notificación al dueño si sigue el ítem.

### 3.10 Plantillas de contrato (Configuración → Contratos, `views/settings/agreements.html`)

- Texto guía: "Edite los modelos de contratos que se usarán con los pedidos". Tabla: **Nombre**, **Activo** (interruptor), **Herramientas**: Editar nombre, **Editar texto**, **Ver** (vista previa), **Clonar**, Borrar (si hay más de una), Confirmar/Cancelar. **Arrastrar y soltar para reordenar** (campo `weight`).
- Guardado diferencial: crea nuevas (`POST /agreement_template`), actualiza modificadas (`POST /agreement_templates`), borra eliminadas (`DELETE`). Aviso "Se hicieron cambios. Haga clic en Guardar" con **Deshacer**.
- Edición del texto: Summernote + tablas de variables (ver §3.5).
- Validaciones: nombre no vacío; al menos una plantilla (no se puede borrar la última).

### 3.11 Correo de contrato (Configuración → Plantillas de email • Contratos)

Una pestaña **Contrato** (`agreement`): Asunto + Cuerpo (editor) + adjuntos opcionales. Variables en §3.9.

### 3.12 Modelo de datos inferido — Contratos

```
agreement: id, order_id, customer_id, user_id (creador/vendedor), name, text (HTML renderizado),
  unique_id (token público), created, modified, sent_date, viewed, signed,
  signature (JSON: agree, not_agree_reason, contractor1, signature1(base64), signed1, ip1,
             contractor2, signature2, signed2, ip2),
  legacy (bool) + campos legacy: signator, ip, signature(img), signed,
  sig_hash (No determinable: parece hash/versión de firma; oculta WhatsApp),
  stage_id (se fuerza a 1 si viene vacío; uso no determinable),
  follow_delegated (heredado para notificaciones)
  + campos de lectura unidos: customer_*, contractor1_*/contractor2_* (fullname, name…), orders_event_date,
    orders_total, user_name, user_avatar
agreement_template: id, name, text, active, weight, created, modified
settings: signature (archivo), signature_offset, signature_online, signature_online_typed_only
```

### 3.13 Mejora propuesta para FOTOFFICE (Contratos)

1. **Versionado y bloqueo real**: congelar el contrato al **enviarlo** (no al crearlo), con historial de versiones y hash SHA-256 del PDF firmado (evidencia). Hoy se puede editar hasta que el cliente lo abre.
2. **Variables vivas hasta el envío** (re-renderizar desde la plantilla con un botón "Actualizar datos") y validación de variables sin reemplazar (`[algo]` sobrante → alerta).
3. **Estado explícito** (Borrador → Enviado → Visto → Aceptado/Rechazado → Firmado parcial → Firmado → Anulado) con fechas por transición, en lugar de inferirlo.
4. **Firma sin exigir sesión** del cliente (enlace con token de un solo uso + verificación por correo/WhatsApp con código), registrando IP, agente de navegador y geolocalización aproximada; PDF final con certificado de auditoría adjunto y enviado a ambas partes.
5. **Contrato también desde Presupuesto/Oportunidad** (no sólo Pedido) y múltiples firmantes (N, no sólo 2), con orden de firma.
6. **Recordatorios automáticos** si no se firma en X días; filtro "sin firmar" y "rechazados" en el listado; exportación CSV.
7. Arreglar clonado desde el listado y la variable `[pricelist_link]`.

---

## 4. FLUJOS DE TRABAJO (Workflows) y ETAPAS (Stages)

### 4.1 Concepto

"Los **Flujos de trabajo** son una secuencia de etapas, usadas para identificar el estado actual, crear tareas automáticamente y fijar fechas límite para cada etapa." (`views/settings/workflows.html`).

El mismo mecanismo (tabla `categories` + `stages`) se usa para tres cosas, distinguidas por `type`:
| type | Menú | Uso |
|---|---|---|
| `stage` | Configuración → **Flujo de trabajo** ("Flujos de trabajo de Proyectos") | Proyectos |
| `order_stage` | Configuración → **Tareas de Pedidos** (`order_tasks`) | Tareas creadas automáticamente al añadir un Pedido (sin duración en días; no se pueden borrar etapas) |
| `pipeline` | Configuración → **Embudos de Venta** | Oportunidades (fuera de este módulo) |

### 4.2 Pantalla de flujos (`views/settings/workflows.html`, `SettingsController.loadWorkflow`)

- **Listado**: **Nombre**, **Etapas** (`stage_count`), **Días** (`total_days` = suma de duraciones; tooltip "Número total de días de cada flujo"), **Herramientas**: Editar nombre, **Editar Etapas**, Borrar (si hay más de uno), **Clonar**, Confirmar, Cancelar.
- **Añadir**: fila con nombre. Tras añadir o renombrar hay que **Guardar** antes de editar etapas ("Por favor haga clic en Guardar antes de editar las etapas").
- **Guardar** → `POST /categories/save_workflow` (lista completa). Además marca `settings.workflows_saved = 1`. Validación: al menos un flujo ("Debe tener al menos un flujo de trabajo definido").
- **Clonar** → `POST /categories/clone_workflow` (copia flujo y etapas en el servidor).

### 4.3 Editor de etapas

"Editando etapas de '{flujo}'" — tabla ordenable por **arrastrar y soltar**:
| Campo | Tipo | Regla |
|---|---|---|
| **Nombre de la Etapa** | texto | obligatorio para añadir |
| **Duración (días)** (`offset_days`) | número entero | vacío → 0; oculto en Tareas de Pedidos |
| **Tareas** (`tasks`) | texto multilínea | **una tarea por línea**; se eliminan líneas vacías; vacío → null |

- Botones: **Guardar el flujo de trabajo** (`POST /stages`, todas las etapas con `type_id` = id del flujo) / Cancelar. Validación: al menos una etapa. Borrar etapa sólo si hay más de una.
- El orden de la lista define el número de etapa (`stage` = 1, 2, 3…). **Importante para migrar**: el proyecto guarda `stage_id` como **posición ordinal** dentro del flujo (1..N), no como id de la tabla de etapas (el código usa `stages[pipeline_id][stage_id-1]`). Reordenar etapas cambia a qué etapa "apunta" cada proyecto existente.

### 4.4 Mejora propuesta (Flujos)

- Etapas con **id estable** y el proyecto referenciando el id (no la posición); historial resistente a reordenamientos.
- Tareas modelo con **responsable por rol** (editor, retocador, diseñador), **días relativos** (vencimiento = inicio de etapa + n) y checklist obligatorio para avanzar.
- **Disparadores por etapa**: enviar correo/WhatsApp al cliente, crear galería de prueba, crear cita, pedir pago de saldo.
- Fechas relativas al **evento** (antes/después) además de "desde hoy".
- Plantillas de flujo por **tipo de trabajo** (boda, escolar, social) y asignación automática según el producto.

---

## 5. PROYECTOS (Projects)

### 5.1 Cómo se crea un proyecto (orquestación)

| Vía | Dónde | Detalle |
|---|---|---|
| **Automática desde el Pedido** | Servidor, al pasar el Pedido a **"Venta Completada"** (`status 475`) | Por cada **Producto** del pedido con **Configuración del proyecto → Añadir Proyectos = Sí** (`project_create`), usando: **Propietario** (`project_user_id`), **Días** de desplazamiento (`project_offset_days`: "define la fecha final del proyecto desde la fecha del evento; negativo = antes del evento") y **Flujo** (`project_pipeline_id`). Texto en la pestaña Proyectos del pedido: "Proyectos se crearán automáticamente si el estado del pedido es Venta Completada y los productos están configurados con esta opción." (`views/products/edit.html`, `views/orders/projects.html`). Nombre del proyecto, etapa inicial, si es uno por producto o por pedido, y cálculo exacto de fechas: **No determinable estáticamente**. |
| **Recrear al editar el Pedido** | `views/orders/edit.html` | Si el pedido ya generó proyectos/citas (`project_created`, `event_created`): "¿Desea recrear proyectos y citas en base a esta edición del pedido? … los creados previamente se eliminarán y se crearán nuevos". Opciones **Recrear Proyectos** Sí/No, **Crear citas** (recrear) Sí/No y **Borrar todas las citas**: **Todas** / **Sólo citas no editadas** (`recreate_events_force`). Por defecto No. |
| **Manual desde el Pedido** | Pedido → pestaña Proyectos → **Nuevo Proyecto** | Sólo visible si el pedido **no** está "Abierto" (471). Pasa `order_id`; copia `customer_id` y `class_id` del pedido. |
| **Manual desde un Contacto** | Contacto → pestaña Proyectos → Nuevo Proyecto | Pasa `customer_id`. |
| **Manual desde Proyectos** | Botón **Nuevo Proyecto** | Requiere `user_projects_create` o admin. Si se superó el límite del plan de proyectos activos (`checkOverLimit('active_project')`) muestra el modal de límite; en `plan_id 2` bloquea. |

Valores por defecto de un proyecto nuevo (`loadEdit`): Estado **No empezado** (200), Prioridad **Media** (101), **Notifiqueme de cambios** = Sí, Propietario = usuario actual, **Fecha de inicio** = hoy, etiquetas vacías.

En paralelo, el Producto puede crear **Citas automáticas** (§6.9).

### 5.2 Listado de Proyectos (`views/projects/index.html`)

- **Botones**: **Nuevo Proyecto**; **Exportar en CSV** (sólo admin; trae todos los registros filtrados con `csv_mode=1`; separadores según configuración; archivo `projects.csv`); **Imprimir** ▸ **Resumen** / **Detallado** (abren pestaña nueva con los filtros actuales).
- **Encabezado**: nombre del filtro de estado (o "Etiqueta: x"), "• usuario", "• Expirado", "• Clase: x".
- **Filtros** (desplegables):
  | Filtro | Valores | Parámetro |
  |---|---|---|
  | **Estado** (Status) | Todos, No empezado (200), En Proceso (201), Cancelado (202), Suspendido (203), Listo (204); o `tag:<etiqueta>` desde la nube de etiquetas | `itemCategory` (URL) → `type` |
  | **Flujo** (Workflow) | Todos + flujos | `itemPipeline` → `pipeline` |
  | **Etapa** | Todas + etapas del flujo elegido (deshabilitado sin flujo: "Elija un embudo para filtrar por su etapa") | `itemStage` → `stage` (usa el **id** de la etapa) |
  | **Filtrado por usuario** | Todos + usuarios | `itemUser` → `user` (si el usuario está limitado a "sus ítems", se fuerza su propio id) |
  | **Clase** | Todas + clases (sólo si clases activas y plan avanzado) | `itemClass` → `class_id` |
  | **Expirados** | sólo por URL / menú (globo rojo) | `itemExpired` → `expired` |
  | **Buscar** | texto; "Buscar todos los campos incluyendo campos adicionales"; "Para buscar fechas use formato aaaa-mm-dd" | `searchTerm` |
- **Persistencia**: estado, clase, flujo, etapa, columna y sentido de orden se guardan en `localStorage` (`project_itemCategory`, `project_itemClass`, `project_itemPipeline`, `project_itemStage`, `project_sortBy`, `project_reverseSort`) y el tamaño de página en `pageSize`. Al volver se restauran.
- **Columnas** (ordenables salvo Etapa): `#`, **Estado** (etiqueta de color), **Nombre** (+ cliente con datos al pasar el mouse; orden por `name,customer_name`), **Fecha del trabajo/evento** (`event_date`), **Prior** (ícono prioridad), **Etapa** (nombre + barra de progreso `stage_percent`), **Propietario** (avatar), **Deleg.** (delegado; ojo: `es.json` traduce "Deleg" como "Borrar", error de traducción), **Fecha límite** (Stage due = `due_date`, con color según vencimiento), **Fecha Final** (Deadline = `final_due_date`, coloreada), casilla, acciones.
- **Orden por defecto**: `id` descendente. Paginado de servidor 10 por página.
- **Clic en fila**: en escritorio abre el **panel de detalle** a la derecha (`projects.index.details`); segundo clic sobre el mismo abre la ficha completa; en pantallas < 1025 px abre directamente la ficha.
- **Acciones por fila**: Ver, Editar (permiso crear), Borrar (permiso `user_projects_delete`).
- **Acciones masivas** (menú al marcar filas):
  | Acción | Modal | Efecto |
  |---|---|---|
  | **Editar fecha límite** | `modal_duedate_checked.html` | Fija **Fecha límite** (etapa) y/o **Fecha Final**; casillas "Quitar" para vaciar. `POST /projects/batch_duedate`. Actividad + notificación por proyecto. |
  | **Editar Prioridad** | `modal_priority_checked.html` | Alta (100) / Media (101) / Baja (102). `batch_priority`. |
  | **Completar proyectos** | `modal_finish_checked.html` | Pide **Fecha de finalización** (hoy por defecto). "Pondrá el estado en Listo y la fecha de fin, pero **no cambia la etapa actual**". `batch_finish`. |
  | **Cambiar usuarios** | `modal_users_checked.html` | Propietario, Delegado a (vacío = sin cambio), "Quitar delegado", Notifiqueme de cambios. `batch_users`. Notifica al nuevo dueño/delegado. |
  | **Cambiar etiquetas** | `common/modal_tags_checked.html` | Añadir/quitar etiquetas (`Tags.batch`). |
  | **Borrar** | `modal_delete_checked.html` | "IMPORTANTE: también se borran notas, actividades y tareas relacionadas". `batch_delete`. |

### 5.3 Panel de detalle (`views/projects/detail.html`)

Resumen con acciones al pasar el mouse (Borrar, Imprimir, Añadir Nota, **Añadir Cita**, Editar, Ver): Estado, Finalizado en, Prioridad, Fecha de inicio, **Fecha Límite** (con lápiz para edición rápida → `modal_single_duedate_checked.html` → `POST /projects/single_duedate`), Fecha Final, Flujo, Etapa ("N nombre"), **Progreso** con botones **– / +** (retroceder/avanzar etapa), Cliente (con **Enviar e-mail** y **Enviar WhatsApp**), **Pedido** (#id + nombre, enlace), Propietario, Delegado, Clase, Productos a entregar, Descripción, Etiquetas y **Línea de tiempo** (actividades).

### 5.4 Ficha del proyecto (`views/projects/view.html`, "Detalles del Proyecto")

- Barra: Borrar, Nuevo Proyecto, Imprimir, **Añadir Nota**, **Añadir Cita** (preasocia la cita al proyecto y a su cliente), Editar.
- Bloques: Estado, Finalizado en, Prioridad, Fecha de inicio, Fecha límite (edición rápida), Fecha Final; Flujo, Etapa, Progreso (– / +); Cliente (datos, enviar e-mail/WhatsApp); Evento (fecha); **Campos adicionales** (4 textos + 2 fechas, con etiquetas definidas en Configuración → Campos Adicionales: `project_extra1..4`, `project_date1..2`); Propietario / Delegado; **Archivado en**; Clase; **Productos a entregar**; **Descripción** ("las descripciones que empiezan con (*) se refieren a paquetes"); Etiquetas.
- **Pestañas**:
  1. **Información general**: contadores clicables **Pruebas** (`info.proofs`) → subpestaña Galerías; **Citas** (`info.events`) → subpestaña Citas; **Pedido** (#id) → subpestaña Pedido.
     - **Pedido** (`projects/order.html`): Pedido #N (enlace) y tabla **Producto / Cantidad** de los ítems.
     - **Pruebas** (`projects/proofs.html`, `ProofsController.loadByType('project')`): botón **Nueva Prueba** (crea galería con `project_id` y cliente del proyecto). Columnas `#`, Tipo (Selección de fotos / Aprobación de álbum / Aprobación de video), Nombre, **Activado** (fecha), **Cli.** (clientes en la galería), **Fin** (clientes que terminaron), **Vistas**, **Imágenes**. Masivas: Cambiar fecha límite, **30 días para fecha límite**, Activar/Desactivar, Borrar. **Enlace de las Galerías del Proyecto**: `{rooturl}/proofs/project/{id}` (página pública con todas las galerías del proyecto).
     - **Citas** (`projects/events.html`): **Nuevo evento**; columnas Fecha (inicio–fin), Título, Lugar, Tipo, Estado, Propietario; clic abre la cita.
  2. **Progreso** (`widgets/progress.html`, ver §5.6).
  3. **Notas**, 4. **Mensajes**, 5. **Actividad**, 6. **Contactos Relacionados** (`widgets/participants.html`, §5.8), 7. **Archivos adjuntos** (subidas). Las pestañas 1, 6 y 7 requieren permiso de crear proyectos o admin.

### 5.5 Formulario Nuevo / Editar proyecto (`views/projects/edit.html`)

Tres pestañas; en alta hay un asistente "**Editar Progreso >>**" antes de guardar. Si hay errores: "Ocurrieron errores al enviar el formulario. Revise todas las pestañas" y la pestaña con error se marca en rojo.

**Información Básica**
| Campo | Tipo | Validación |
|---|---|---|
| **Nombre** (`name`) | texto | obligatorio, mín. 3 |
| **Contacto** (`customer_id`) | buscador (mín. 3 letras, 30 resultados) + **Adición rápida** de contacto | obligatorio |
| **Fecha del trabajo/evento** (`event_date`) | fecha | formato válido |
| **Pedido** (`order_id`) | selector de pedidos ("Opcional. Seleccione un pedido si desea conectarlo con este proyecto") | sólo si el módulo Ventas está activo |
| **Descripción** | texto largo | — |
| **Productos a entregar** (`products`) | texto | — |
| **Proyecto archivado en** (`archive`) | texto ("dónde está archivado el material") | — |
| **Clase** (`class_id`) | selector | obligatorio si "clases en proyectos" está activo |
| **Propietario** (`user_id`) | usuario | obligatorio (en esta pestaña sólo visible con clases activas; siempre en Progreso) |
| **Delegado a** (`delegated_id`) | usuario | opcional |
| **Notifiqueme de cambios** (`follow_delegated`) | Sí/No | "Genera una notificación al propietario por cada modificación" |
| **Etiquetas** (`tags`) | autocompletar | — |

**Progreso**
| Campo | Tipo | Validación / comportamiento |
|---|---|---|
| **Estado** (`status_id`) | selector (200–204) | obligatorio; cambiarlo recalcula fechas (§5.7) |
| **Fecha de Inicio** (`started_date`) | fecha | — |
| **Prioridad** (`priority_id`) | botones Alta/Media/Baja | — |
| **Fecha de Finalización** (`completed_date`) | fecha | se completa sola al terminar |
| **Fecha Límite** (etapa) (`due_date`) | fecha | se recalcula al cambiar de etapa |
| **Fecha Final** (plazo del proyecto) (`final_due_date`) | fecha | — |
| **Flujo** (`pipeline_id`) | selector de flujos | obligatorio; al cambiar redibuja la barra de etapas |
| Barra de etapas | pasos clicables (actual = nombre, resto = número) | clic = cambio de etapa |
| **Memo** (`stage.memo`) | texto | sólo si hubo cambio de etapa; queda en el histórico |
| **Tareas** (`stage.tasks`) | texto (una por línea) | precargado con las tareas modelo de la etapa destino; editable |
| Propietario / Delegado / Notifiqueme | — | igual que arriba |

Si el proyecto tiene un flujo sin etapas: aviso "Hay un problema con el flujo de trabajo de este proyecto. Probablemente no hay etapas definidas".

**Campos Adicionales**: `extra1..4` (texto), `extra_date1..2` (fecha), con etiquetas configurables.

Al guardar: fechas a formato SQL; se envían `stage_id`, `stage_change`, `stage_tasks`, `stage_memo`, `stage_name`, `stage_user`, `save_tags`. Tras guardar va a la ficha.

### 5.6 Widget de Progreso (`views/widgets/progress.html`) e histórico

- Barra de etapas clicable (sólo con permiso). Al elegir otra etapa se despliega: **Vencimiento** (fecha límite de la etapa, editable), **Estado** (si no es "No empezado"), **Memo**, **Tareas**, Propietario, Delegado, Notifiqueme; aviso de cambios sin guardar con **Deshacer** / **Guardar**.
- **Histórico** (`GET /projects/progress/:id`): columnas **Fecha**, **Usuario**, **Etapa** ("N • nombre"), **Vencimiento**, **Nota** (memo). Lo genera el servidor al guardar con `stage_change`.
- **Proyección de Plazo** (`ProjectsController.loadStages`, cálculo en el navegador):
  - Si el proyecto está "No empezado": arranca en la fecha límite menos la duración de la 1.ª etapa, o en la fecha de inicio (si es futura), o en la fecha del evento, o en `start_date`.
  - Si está "En Proceso": arranca hoy; fin de la etapa actual = fecha límite guardada o hoy + duración.
  - Si la fecha calculada ya pasó, recalcula desde hoy y avisa: "Fecha límite no definida o vencida. Los plazos se calcularon usando la fecha de hoy como referencia."
  - Encadena las etapas restantes sumando sus duraciones. Muestra dos barras (meses y etapas proporcionales) y la tabla `#`, Color, Etapa, **Días**, **Plazo estimado**, Total.
  - Para estados Cancelado/Suspendido/Listo no muestra proyección.

### 5.7 Estados y transiciones del proyecto

Estados (`AppTables.project_status`): **No empezado** 200 · **En Proceso** 201 · **Cancelado** 202 · **Suspendido** 203 · **Listo** 204.

Reglas automáticas al **cambiar de etapa** (barra, widget o botones – / +, `changePipeline`, `SliderOptions.onChange`, `setNextStage`):
| Etapa destino | Estado | Fecha límite (`due_date`) | Fecha fin (`completed_date`) | Fecha Final |
|---|---|---|---|---|
| Primera | No empezado (200) | hoy + duración de la etapa | vacía | sin cambio |
| Intermedia | En Proceso (201) | hoy + duración de la etapa | vacía | sin cambio |
| Última | Listo (204) | vacía | hoy | **se vacía** |

- Botones **– / +** ("Clic en + o – para aumentar/disminuir etapa"): no bajan de 1 ni pasan de la última; memo automático "Se ha cambiado la Etapa usando los botones de cambio rápido"; calculan `stage_percent = etapa / total × 100`; crean las tareas modelo de la etapa destino; refrescan línea de tiempo e histórico.

Reglas al **cambiar el estado a mano** (`$watch row.status_id`):
| Nuevo estado | Etapa | Fecha límite | Fecha fin |
|---|---|---|---|
| No empezado | 1.ª | hoy + duración 1.ª etapa | vacía |
| En Proceso | actual | hoy + duración **de la 1.ª etapa** (posible error: debería ser la actual) | vacía |
| Listo | última | vacía | hoy |
| Cancelado / Suspendido | sin cambio | vacía | hoy |

**Vencido / Expirado**: filtro `expired` del servidor; contadores `due_user` / `due_all`. Criterio exacto (¿`due_date` < hoy? ¿`final_due_date`? ¿excluye Listo/Cancelado?): **No determinable estáticamente**. Las fechas se colorean con la directiva `date-color` (umbral no determinable).

### 5.8 Contactos Relacionados / Participantes (`widgets/participants.html`)

- Lista de contactos vinculados al proyecto (también se usa en otros módulos): avatar, **Nombre** (enlace al contacto + datos), **Participando como** (categoría de tipo `participant`, definida en Configuración → Categorías → **Participantes**; p. ej. novia, madrina, planner), **Nota**.
- Modal "Datos del participante": **Contacto** (buscador + adición rápida, obligatorio), **Participando como** (obligatorio), **Nota**.
- Se editan en memoria y se guardan todos juntos (`POST /participants {type, target_id, rows}` reemplaza la lista). Actividad "Participantes guardados".
- Se pueden imprimir en la ficha (según Configuración → Proyectos).

### 5.9 Tareas (`common/sidebar_tasks.html`, `TasksController`)

- Panel lateral global "Tareas" con contador de pendientes. Alta rápida escribiendo y Enter (si se está dentro de un proyecto, la tarea queda **vinculada** a él: `type=projects`, `target_id`).
- Filtros: **Todos / Pendiente / Realizadas**; **Mis tareas / Las tareas de todos los usuarios**; dentro de un ítem: **Todas las tareas / Tareas de este ítem**. Botón **Borrar realizadas**. **Cargar más tareas** (paginado). Doble clic para editar; arrastrar para reordenar (`/tasks/sort`).
- Modal "Detalles de la tarea": **Tarea** (obligatoria), **Vencimiento**, **Dueño**.
- Las tareas aparecen como capa en el Calendario y se pueden arrastrar para cambiar vencimiento.
- Tareas automáticas: por cambio de etapa (vencen **hoy**, dueño = quien cambia la etapa) y por "Tareas de Pedidos" al crear un pedido.

### 5.10 Impresiones

- **Listado Resumen** (`index_print_summary.html`): logo y datos de la empresa, filtros aplicados, fecha de emisión; columnas `#`, Estado, Nombre, Cliente, Fecha del trabajo, % / Etapa, Fecha límite, Clase.
- **Listado Detallado** (`index_print.html`): `#`, Estado, Nombre + datos del cliente, Fecha del trabajo, Prioridad, Flujo, Etapa / %, Fecha límite / Fecha Final, Clase.
- **Ficha** (`view_print.html`): cliente con dirección; Detalles (Proyecto, Descripción, Productos a entregar, Archivado en, **Pruebas** (cantidad), Etiquetas); Estado, Prioridad, Fecha del evento, Inicio, Fin; Flujo, Etapa, Progreso %, Vencimiento, Fecha Final; Propietario, Delegado; Campos adicionales; y, según **Configuración → Proyectos → Opciones de Impresión**: Imprimir Participantes, Imprimir Contactos relacionados con el cliente, Imprimir Historia de Progreso, Imprimir Proyección de Plazo, Imprimir Notas (cada uno Sí/No).

### 5.11 Otras vistas con proyectos

- **Contacto → Proyectos**, **Pedido → Proyectos**, **Usuario → Proyectos**: tabla `#`, Nombre, Propietario (o Cliente), Tipo/Flujo, Estado, Etapa, Vence.
- **Área de Clientes → Proyectos** (`dashboard/projects.html`): el cliente ve `#`, Nombre, Propietario, Tipo (flujo), Estado, Etapa (sin fechas).
- **Calendario**, capa **Proyectos**: cada proyecto aparece en su **fecha límite**; arrastrarlo cambia `due_date` (`PUT /projects/set_date`); clic abre la ficha.

### 5.12 Automatizaciones y notificaciones de proyectos

Todas por `act_notify` (Actividad en el proyecto + Notificación interna al **propietario** si `follow_delegated = 1` y quien cambia no es el propietario):
- Alta: "{usuario} fue asignado como propietario del proyecto…" + notificación al propietario y al delegado.
- Edición: cambios de **estado**, **fecha límite**, **fecha final**, **fecha de inicio**, **fecha de fin**, **flujo**, **etapa**, **cliente**, **propietario**, **delegado** (este último notifica siempre al nuevo delegado).
- Masivas: prioridad, fechas, finalización, usuarios, borrado.
- Recalcula contadores de vencidos (`getDue`) y de uso del plan (`getSettings('force_full')`).
- **No se envían correos al cliente** por cambios de etapa (no hay plantilla de email de proyectos en `MailVariables`).

### 5.13 Permisos que afectan a Proyectos

`modules.projects` (módulo activo), `user_projects` (ver menú), `user_projects_create` (crear/editar/ver ficha), `user_projects_delete` (borrar), `user_access_itens_only` (sólo ve proyectos propios o delegados; si no, "acceso denegado"), rol `admin` (todo, incluido CSV).

### 5.14 Modelo de datos inferido — Proyectos

```
project: id, name, customer_id, order_id (opcional), referrer_id (se usa en el form, sin campo visible),
  description, products, archive, class_id, tags (texto separado por comas),
  user_id (propietario), delegated_id, follow_delegated,
  status_id (200..204), priority_id (100/101/102),
  pipeline_id (flujo), stage_id (POSICIÓN 1..N), stage_percent,
  event_date, start_date (?), started_date, completed_date, due_date (fecha límite de etapa), final_due_date,
  extra1..4, extra_date1..2, created, modified
  + lectura: customer_*, pipeline_name, stage_name, user_name/avatar, delegated_name/avatar, priority_name,
    order_name, proof_count, info{proofs, events}
project_progress: id, project_id, created, user_id, stage_id, stage_name, due_date, note
workflow (categories type='stage'): id, name, type, weight?, stage_count*, total_days*
stage: id, type_id (workflow), stage (orden), name, offset_days, tasks (texto)
task: id, user_id, type (modelo: projects|orders|leads|contacts…), target_id, title, due_date, completed, sort
participant: id, type, target_id, contact_id, category_id, memo
product (config.): project_create, project_user_id, project_offset_days, project_pipeline_id,
  event_create, event_user_id, event_offset_days, event_duration, event_type_id
order (flags): project_created, event_created, recreate_projects, recreate_events, recreate_events_force
settings: project_extra1..4, project_date1..2, projects_print_*, project_pipeline_type, workflows_saved
```

### 5.15 Mejora propuesta para FOTOFFICE (Proyectos)

1. **Creación automática configurable y visible**: regla "al confirmar/cobrar seña del pedido → crear proyecto con flujo X", con vista previa y registro de qué producto lo generó; nombre por plantilla (`{cliente} – {evento} – {fecha}`).
2. **Fechas relativas al evento** en todo el flujo (hoy se calcula "desde hoy" en cada cambio de etapa, lo que corre los plazos si alguien se atrasa); mostrar **atraso acumulado** vs. plan original.
3. **Tablero Kanban** por etapas (arrastrar tarjetas), vista **Gantt**/línea de tiempo con la proyección, y "Mis entregas de la semana".
4. **Tareas con responsable por rol** y vencimiento relativo; bloqueo de avance si hay tareas obligatorias pendientes.
5. **Portal del cliente** con barra de progreso y fechas comprometidas (hoy el cliente ve sólo etapa y estado) y avisos automáticos por correo/WhatsApp al pasar hitos (galería lista, álbum en diseño, entrega).
6. **Vínculo fuerte** proyecto ↔ galería de prueba ↔ selección terminada: avanzar etapa automáticamente cuando el cliente finaliza la selección o aprueba el álbum.
7. Corregir: `stage_id` por posición; estado "En Proceso" usando la duración de la 1.ª etapa; Cancelado/Suspendido poniendo fecha de fin; traducción "Deleg" = "Borrar".

---

## 6. CALENDARIO / AGENDA (Calendar, Events)

### 6.1 Conceptos

- **Cita** (Appointment/Event): compromiso con fecha y hora (sesión de fotos, reunión, entrega, evento). Tiene **Tipo** (categoría con color = `EventTypes`), **Estado**, **participantes** (usuarios internos / freelancers), **propietario**, **cliente** opcional y **origen** opcional (ítem al que pertenece: proyecto, pedido, oportunidad, contacto).
- Estados de cita (`AppTables.event_status`): **Agendado** (Scheduled, por defecto) · **Confirmado** · **En curso** (On going) · **Reprogramado** · **Realizadas** (Completed) · **Anulado** (Cancelled). Se cambian libremente a mano; no hay transiciones automáticas visibles.

### 6.2 Modo Calendario (`views/calendar/index.html`)

- Calendario FullCalendar con vistas **mes / semana / día**, botones anterior/siguiente/hoy. Primer día de la semana según configuración (en español, lunes por defecto). Formato de hora 24 h (salvo inglés).
- **Filtros**: **Tipo** (Todos + categorías), **Clase** (si clases activas), **Usuario** (selector; sólo admin o usuarios con permiso `user_calendar` o `user_calendar_read_only`). Por defecto se ven las citas del usuario actual.
- **Capas** (botones de conmutación, guardadas en `localStorage.calendar_layers`; si se apagan todas vuelve "Eventos del Calendario"):
  | Capa | Muestra | Clic | Arrastrar |
  |---|---|---|---|
  | **Eventos do Calendario** | Citas | abre edición (o vista si es de sólo lectura) | cambia inicio/fin (`quick_update`) |
  | **Proyectos** | proyectos en su fecha límite | abre ficha del proyecto | cambia fecha límite |
  | **Oportunidades** | oportunidades (fecha de próxima acción, presumiblemente) | abre la oportunidad | — |
  | **Cuentas** (finanzas) | cuentas a cobrar/pagar por vencimiento | abre Finanzas | cambia vencimiento (`AccountTrans.set_date`) |
  | **Tareas** (si el plan tiene `addon_tasks`) | tareas por vencimiento | abre panel de tareas resaltando | cambia vencimiento |
  | **Cumpleaños** | cumpleaños de contactos | abre el contacto | — |
- **Clic en un día vacío**: nueva cita a la hora siguiente (duración 1 h; en vista mes toma la hora actual redondeada). **Botón Publicar**: ver §6.6.
- Permiso de edición por cita (`event_read_only`): puede editar el **propietario**, un **admin** o quien tenga `user_calendar = 1`; si `user_calendar_read_only = 1` y no es el dueño, sólo ve. Roles **Independiente** (freelance) y **Contacto** sólo ven (modal de vista).

### 6.3 Modo lista (`views/calendar/list.html`)

- Botones: **Nuevo evento**, **Exportar en CSV** (`calendar.csv`, con `is_csv=1`), **Imprimir** (con todos los filtros en la URL). Conmutador a Modo Calendario.
- **Filtros** (persisten en `localStorage`: `start_type`, `type_id`, `class_id`, `status`, `start_date`, `end_date`):
  | Filtro | Valores |
  |---|---|
  | **Fecha** (desde) | Hace 6/3/2/1 meses, **Hoy** (por defecto), en 1/2/3 meses, **Otro período** (modal rango de fechas) |
  | **Estado** | Todos + 6 estados |
  | **Tipo** | Todos + categorías |
  | **Clase** | Todas + clases |
  | **Usuario** | (igual que en calendario) |
  | **Buscar** | texto; fechas en aaaa-mm-dd |
- **Columnas** (ordenables): **Fecha** (inicio y fin; `Event.start`, orden por defecto ascendente), **Nombre de la Cita** (`Event.title`; debajo el cliente; al pasar el mouse datos del cliente, detalles y enlace al origen), **Fecha del Evento** (fecha del evento del pedido vinculado, `order_event_date`), **Lugar de la Cita**, **Estado**, **Propietario**, **Participantes**, **Categoría** (`event_type_id`), acciones (editar o ver).
- Paginación de servidor (10 por defecto).
- Error detectado: `store_filters` guarda `localStorage.endDate` pero se lee `end_date` → la fecha "hasta" del rango personalizado no persiste bien.

### 6.4 Formulario de Cita (`views/calendar/modal_edit.html` o barra lateral en `list.html`)

Según Configuración → Calendario → Modo de edición: **Pop up** (modal grande) o **Barra lateral**.

**General**
| Campo | Tipo | Validación / default |
|---|---|---|
| **Nombre del Evento** (`title`) | texto | obligatorio, mín. 3 |
| **Lugar del evento** (`location`) | texto | — |
| **Inicio** (`start`) | fecha y hora | obligatorio; al moverlo, el fin se corre manteniendo la duración (salvo que el fin se haya tocado a mano) |
| **Fin** (`end`) | fecha y hora | obligatorio; si queda antes del inicio se iguala al inicio |
| **Tipo** (`event_type_id`) | selector de categorías | obligatorio; default "1" |
| **Estado** (`status`) | selector | obligatorio; default Agendado |
| **Clase** (`class_id`) | selector | obligatorio si "clases en calendario" |
| **Todo el día** (`all_day`) | Sí/No | default No |
| **Detalles** (`details`) | texto largo | no se muestra a contactos |
| **Origen** | enlace al ítem (`type` + `target_id`) | sólo lectura |

**Alarma/recurrente**
| Campo | Tipo | Validación |
|---|---|---|
| **Alarma 1** / **Alarma 2** (`alertN_n` + `alertN_interval`) | número + unidad (minutos/horas/días/semanas/meses antes) | unidad obligatoria; se guarda en minutos (`alertN_minutes`); defaults de configuración (120 y 60 min si no hay) |
| **Recurrente** (`recurrence`) | Sí/No | — |
| **Frecuencia** (`recurrence_freq`) | Diario (1), Semanal (7), Mensual (30), Cada 2 semanas (14), Cada 4 semanas (28) → regla RRULE | obligatoria si recurrente |
| **Fin** de recurrencia (`recurrence_end`) | fecha | obligatoria si recurrente |

**Participantes**
| **Participantes en esta cita** (`participants_list`) | múltiples usuarios (incluye freelancers) | obligatorio; default el usuario actual |
| **Propietario de la Cita** (`user_id`) | usuario | obligatorio |

**Contacto**
| **Cliente/Contacto** (`customer_id`) | buscador + adición rápida | muestra datos del contacto |
| **Enviar confirmación** (`customer_confirmation`) | Sí/No | default No |

Botones: **Borrar** (pide confirmación; borra a los 3 s tras notificar), Cancelar, Guardar. Campo oculto `timezone` (si la zona horaria está activa).

Vista de sólo lectura (`modal_view.html`, `sidebar_calendar_view.html`): Fecha, Todo el día, Lugar, Tipo, Estado, Origen, Detalles, Cliente, Alarmas, Recurrencia, Propietario, **En esta cita** (participantes).

### 6.5 Automatizaciones y correos del calendario

`CalendarController.act_notify`, al crear, modificar o borrar:
1. Actividad en el registro.
2. Si **Configuración → Calendario → Notificación de Cita** = Sí (`event_alert_message`): notificación interna (tipo 4) a **cada participante** + `POST /events/notify_participants` (tipo `user`) → correo **Confirmación de Cita – Usuarios** o, si se borró, **Cancelación de cita – Usuarios**.
3. Si la cita tiene cliente y **Enviar confirmación** = Sí: `notify_participants` tipo `customer` → correo **Confirmación de Cita – Cliente** (también al borrar, con `cancel=true`; qué plantilla usa para cancelar al cliente: No determinable estáticamente).
4. **Alarmas**: el panel de notificaciones consulta periódicamente `GET /events/alerts/{user}/{hora local}` y, por cada cita con alarma cumplida, muestra un aviso ("Calendario: {título} a las {hora} Contacto… Teléfono…") y crea una notificación tipo 5. No hay evidencia de alarmas por correo/push: **No determinable estáticamente**.

Plantillas de email • Calendario (Configuración → Plantillas de email • Calendario):
| Pestaña | Variables |
|---|---|
| **Confirmación de Cita – Cliente** (`event_confirmation`) | `customer_name/firstname/lastname/company/email/mobile`, `appointment_name`, `appointment_location`, `appointment_start_date`, `appointment_end_date`, `appointment_all_day`, `appointment_details` |
| **Confirmación de Cita – Usuarios** (`event_confirmation_user`) | `user_name/firstname/lastname`, `participant_name/firstname/lastname`, `user_email`, `appointment_*`, `calendar_link` |
| **Cancelación de cita – Usuarios** (`event_cancellation_user`) | ídem |
| **Email de cumpleaños – Cliente** (`birthday_mail_customers`) | activable Sí/No; `customer_*`, `company_name` |

### 6.6 Publicar (iCal)

"Feeds iCal para su Calendario": por cada capa activa muestra una URL de suscripción `{rooturl}/calendar/ical/{all|user}/{unique_id del usuario o de la cuenta}/{tipo|projects|leads|finance|tasks|birthdays}` con instrucciones para Apple iCal, iPhone/iPad y Google Calendar (advierte que Google actualiza cada ~6 h y que las horas pueden fallar). `index2` usa `http`.

Además, `calendar.view/:unique_id` y `calendar.view_list/:unique_id` son vistas **públicas de sólo lectura** del calendario de un usuario (sin menú).

### 6.7 Configuración → Calendario (`views/settings/calendar.html`)

| Pestaña | Contenido |
|---|---|
| **Categorías** | Tipos de cita: **Nombre**, **Color** (16 colores con nombre: azul, verde, rojo, naranja, magenta, marino, gris, negro, púrpura, verde oscuro, vino, amarillo, rosa, marrón, azul pizarra, gris oscuro). Alta/edición/borrado en línea. Se guarda con `POST /eventtypes`. |
| **Modo de edición** | Ver y editar en **Pop up** / **Barra lateral** (`calendar_sidebar_mode`). |
| **Alertas** | Alarma 1 y Alarma 2 por defecto: número + unidad. |
| **Notificación de Cita** | ¿Enviar la notificación a los usuarios? Sí/No (`event_alert_message`). |
| **Inicio de la Semana** | Domingo / Lunes. |
| **Zona Horaria** | Usar zona horaria Sí/No + selector (incluye Buenos Aires, Montevideo, etc.). |

### 6.8 Citas en otras pantallas

- Pestañas "Citas" en **Proyecto**, **Pedido**, **Oportunidad** y **Contacto** (`CalendarController.loadByType`), con **Nuevo evento** que precarga `type`/`target_id` y el **cliente** del ítem (`Contacts.get_to`).
- **Área de Clientes → Citas** (`dashboard/events.html`): el cliente ve Fecha, Título, Lugar, Tipo, Estado, Propietario y **Ver**.

### 6.9 Citas automáticas desde Producto/Pedido

Producto → pestaña **Configuración de citas automáticas** (sólo si módulo calendario): **Añadir Cita** Sí/No (`event_create`), **Persona designada** (`event_user_id`, incluye freelancers), **Días** respecto de la fecha del evento (`event_offset_days`, negativo = antes), **Duración (horas)** (`event_duration`), **Categoría del Evento** (`event_type_id`). "Al emitir un Pedido, creará automáticamente una cita con fecha basada en la fecha del evento." Momento exacto (¿al crear el pedido o al completarlo?), hora de inicio y título: **No determinable estáticamente**. Recreación: ver §5.1 ("Sólo citas no editadas" sugiere que el servidor marca si la cita fue editada a mano).

### 6.10 Modelo de datos inferido — Calendario

```
event: id, title, location, start, end, start_date*, end_date*, all_day, details,
  event_type_id, status (texto: Scheduled|Confirmed|On going|Rescheduled|Completed|Cancelled),
  class_id, user_id (propietario), participants_list [user_id…] (tabla puente event_participants),
  customer_id, customer_confirmation, type (modelo origen), target_id,
  alert1_minutes, alert2_minutes, recurrence, recurrence_freq, recurrence_end, timezone,
  (¿edited? flag para "sólo citas no editadas"), created, modified
  + lectura: event_type_name, user_name/avatar, participants[], participants_fulllist[], customer_*, order_event_date, icon, layer, editable
event_type: id, name, color
settings: alert1_minutes, alert2_minutes, event_alert_message, event_confirmation_subject/message,
  date_week_start, timezone, timezone_active, calendar_sidebar_mode, classes_in_calendar
user: unique_id (para iCal/vista pública), user_calendar, user_calendar_read_only
```

### 6.11 Mejora propuesta para FOTOFFICE (Agenda)

1. **Sincronización bidireccional con Google Calendar** (FOTOFFICE ya planifica Google; hoy Alboom sólo publica iCal de lectura, con problemas de hora).
2. **Disponibilidad y reservas**: bloquear fechas ya vendidas (una boda por día por fotógrafo), alerta de choque de horarios entre participantes, y **reserva online** por el cliente de turnos (sesiones) con seña.
3. **Recordatorios al cliente** por WhatsApp/correo (24 h y 2 h antes) y confirmación con un clic que cambie el estado a "Confirmado".
4. **Equipo y recursos**: asignar segundo fotógrafo, asistente, equipo y estudio a la cita; hoja de ruta con mapa y horarios.
5. Estados con transiciones y motivo de cancelación/reprogramación; historial de cambios de fecha.
6. Corregir persistencia del filtro de fechas y unificar la vista pública/iCal con token revocable (hoy es el `unique_id` fijo del usuario).

---

## 7. INICIO (Dashboard) y Área de Clientes

- `views/main.html` sólo contiene `<dashboard-widget>` que incluye `views/dashboard/user.html` (usuario/admin), `contact.html` (cliente) o `backend.html` (subdominio admin). **Ninguna de esas tres plantillas está en el material** → el contenido del Inicio interno es **No determinable estáticamente** (hay que relevarlo en vivo).
- Las subpantallas `views/dashboard/*.html` son las **pestañas del Área de Clientes** (lo que ve el cliente al ingresar):
  | Pestaña | Columnas | Acciones |
  |---|---|---|
  | **Proyectos** | `#`, Nombre, Propietario, Tipo (flujo), Estado, Etapa | — |
  | **Presupuestos** | `#`, Enviado, Vendedor, Oportunidad, Total, Vistos | Imprimir presupuesto |
  | **Pedidos** | `#`, Nombre, Tipo, Total, Vendedor, Fecha del Evento, Estado | Imprimir pedido |
  | **Contratos** | `#`, Creado, Pedido, Nombre, Por, Vistos, Firmado, alertas | **Imprimir**, **Ver y Firmar** (si la firma online está activa y no lo rechazó) |
  | **Citas** | Fecha, Título, Lugar, Tipo, Estado, Propietario | Ver |
  | **Cuentas por Pagar** (`ar`) | Fecha (coloreada), Pedido, Tipo, Doc, Memo, Monto | Ver instrucciones, descargar boleto, pagar con PagSeguro/PayPal |
  | **Cuentas Pagadas** (`ar_paid`) | ídem | Imprimir recibo |
- Todas cargan con desplazamiento infinito (50 por página).

---

## 8. Configuración → Sesiones (`views/settings/sessions.html`)

Aclaración: **no son sesiones fotográficas**. Es la lista de **sesiones de inicio de sesión** abiertas en la cuenta: Nombre de usuario, E-mail, Rol (Usuario/Administrador/Independiente/Contacto), Creada, Expira, IP, Plataforma, Navegador; "Sesión actual" o botón **Revocar la sesión** (`DELETE /sessions/:id`). Útil para FOTOFFICE como pantalla de seguridad, no para migración de datos.

---

## 9. Errores e inconsistencias detectados en el código (para no replicarlos)

1. Clonar contrato desde el listado general pasa `id` a un estado que espera `from_id`; `loadEdit` no maneja clonado.
2. `[pricelist_link]` documentado pero no reemplazado.
3. `stage_id` del proyecto es la **posición** en el flujo; reordenar etapas altera proyectos existentes.
4. Estado "En Proceso" manual calcula la fecha límite con la duración de la **primera** etapa.
5. Cancelar/Suspender un proyecto pone **fecha de finalización = hoy**.
6. `modalEditSingleDueDate` al quitar la Fecha Final usa una variable inexistente (`item`) → probable error; y el texto de notificación de Fecha Final muestra la fecha límite de etapa.
7. Notificación de cambio de cliente busca en `contact_list` (no cargada en el formulario) → posible error al cambiar cliente.
8. Filtro "Etapa" deshabilitado enlaza a `leads.index` (copiado de Oportunidades).
9. Filtro de fechas del Modo lista guarda `endDate` y lee `end_date`.
10. Traducción "Deleg" → "Borrar" (debería ser "Delegado"); "Workflows" → "Flujo de trabajo" (singular); "Appointment" → "Citas".
11. Plantillas `agreements/detail.html`, `index_print.html`, `index_print_summary.html` devuelven 404 (función a medio implementar o retirada).

---

## 10. Datos a migrar (checklist)

| Entidad | Endpoint de lectura sugerido | Claves / cuidados |
|---|---|---|
| Plantillas de contrato | `GET /agreement_templates` | nombre, texto HTML, activo, orden |
| Contratos | `POST /agreements/paginate` (pageSize grande) + `GET /agreements/:id` | texto ya renderizado; `signature` JSON con imágenes base64 e IP; fechas enviado/visto/firmado; `unique_id`; contratos `legacy` |
| Flujos y etapas | `GET /categories/stages?type=stage` + `GET /stages?type_id=` o `GET /stages/list?type=stage` | convertir `stage_id` ordinal del proyecto a id de etapa |
| Tareas de pedido | ídem con `type=order_stage` | |
| Proyectos | `POST /projects/paginate` con `csv_mode=1` | fechas, estado, prioridad, flujo/etapa, dueño/delegado, extras, etiquetas, pedido |
| Histórico de etapas | `GET /projects/progress/:id/0/9999` | por proyecto |
| Participantes | `POST /participants/paginate {type:'projects', id}` | categoría "participante" |
| Tareas | `GET /tasks` (todas, `filteruser=all`) | vínculo `type/target_id` |
| Tipos de cita | `GET /eventtypes` | color |
| Citas | `POST /events/paginate` con `is_csv=1` y rango amplio | participantes, recurrencia, alarmas en minutos, origen |
| Configuración | `GET /settings` | firmas (imagen), alertas, zona horaria, etiquetas de campos extra, opciones de impresión |
| Plantillas de correo | `mail_templates` (agreement, event_confirmation, event_confirmation_user, event_cancellation_user) | asunto/cuerpo con variables `[x]` |

---

## 11. Dudas para verificar en vivo

1. ¿Qué muestra el **Inicio** del usuario interno (`views/dashboard/user.html`)? Widgets, contadores, agenda del día.
2. Creación automática de proyectos: ¿uno **por producto** o uno por pedido? ¿Nombre asignado? ¿Etapa inicial? ¿`due_date` y `final_due_date` = fecha del evento + `project_offset_days`? ¿Se dispara sólo al pasar a "Venta Completada" o también al crear un "Pedido Rápido" (476)?
3. Citas automáticas: ¿se crean al crear el pedido o al completarlo? ¿A qué hora empiezan? ¿Título?
4. Criterio exacto de **proyecto vencido/expirado** (¿`due_date` o `final_due_date`? ¿excluye Listo/Cancelado/Suspendido?) y umbrales de color de `date-color`.
5. ¿El servidor guarda `stage_percent` o lo calcula? ¿Qué pasa con los proyectos al **reordenar o borrar etapas** de un flujo en uso?
6. ¿Qué campos cubre el **buscador** de proyectos, contratos y citas?
7. ¿El enlace `/agreement/{unique_id}` del correo exige **iniciar sesión** como contacto o permite firmar sin cuenta? ¿Se crea usuario del Área de Clientes automáticamente?
8. ¿Qué es `sig_hash` en contratos? ¿Qué pasa con la firma de la empresa (¿se firma sola?) y con `stage_id` en contratos?
9. ¿Funciona **Clonar** desde el listado general de contratos?
10. ¿Qué plantilla recibe el **cliente** cuando se borra/cancela una cita con "Enviar confirmación"?
11. ¿Las **alarmas** de citas llegan también por correo o push al celular, o sólo como aviso en pantalla con el panel abierto? ¿Cada cuánto consulta?
12. ¿Cómo se marca una cita como "editada" para la opción "Sólo citas no editadas" al recrear?
13. En la capa **Oportunidades** del calendario, ¿qué fecha se usa (próxima acción, fecha del evento)?
14. ¿`project_pipeline_type` (ajuste) cambia algo en la interfaz? ¿Existe un "tablero" de proyectos por etapas?
15. Contenido de las impresiones de listados de contratos (plantillas 404) y del panel de detalle de contrato.
16. Volumen real de datos (cantidad de proyectos, contratos, citas, tareas) y si la API permite `pageSize` grande para la migración.
