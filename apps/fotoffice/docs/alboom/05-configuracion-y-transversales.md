# 05 · Configuración completa y funciones transversales de Alboom CRM

> Documento de análisis funcional para replicar (mejorado) en FOTOFFICE.
> Fuente: análisis estático de `app.js` (formateado con prettier, ~33.000 líneas), `v/views/**` (443 plantillas), `endpoints.txt`, `es.json`, `settings_menu.txt`.
> No se usó el sistema en vivo: todo lo que depende del servidor (tareas programadas, envío real de correos) está **inferido** y marcado como tal. Las dudas a confirmar están al final (sección 12).
> Los nombres de pantallas y campos se dan **como los ve el usuario en español** (`es.json`), con el identificador técnico entre paréntesis cuando ayuda.

---

## 0. Resumen ejecutivo (para leer primero)

1. **Alboom CRM es "multi-empresa por subdominio"**: cada estudio es un *Suscriptor* (`Subscriber`) con su subdominio `usuario.alboomcrm.com`. Todo lo que ven los usuarios depende de dos objetos que se cargan al entrar y se guardan en el navegador (`$localStorage`): `AppSettings` (la configuración del estudio + el plan) y `AppUser` (el usuario con sus permisos).
2. **Configuración (Ajustes)** es una sola pantalla con menú de 2 niveles (22 grupos, ~45 destinos). Solo la ve el **Administrador**. Casi todo se guarda en una única tabla clave-valor (`POST /settings/`), salvo catálogos (categorías, flujos, plantillas, cuentas contables) que tienen su propio guardado.
3. **Planes y módulos**: el acceso se decide con banderas del suscriptor (`module_sales`, `module_orders`, `module_projects`, `module_finance`, `module_calendar`, `module_proofs`, `addon_advanced`, `addon_signature`, `addon_tasks`, `addon_boleto`, `addon_lrmeta`, …) combinadas con el **plan** (`plan_id`: 1/2 = Lite/Estándar, 11 = CRM Free, 12 = CRM Pro, 22 = otro pago) y con **límites** (`n_leads`, `n_orders`, `n_users`, `n_active_projects`, `n_gallery_mobiles`…). Lo bloqueado no se oculta: se muestra con una corona 👑 y lleva a una página de venta (`support.resources`).
4. **Permisos de usuario**: 3 tipos internos (Administrador, Usuario, Independiente/Freelancer) + el tipo Contacto (cliente que entra al Área de Clientes). El Usuario tiene interruptores por módulo (Contactos, Ventas, Proyectos, Financiero, Pruebas, Calendario, Informes) con sub-permisos Crear/Borrar, y un interruptor clave: **"Acceso limitado sólo a sus propios artículos"** que convierte todos los listados en "sólo lo mío".
5. **Comunicación**: un único "motor de variables" con marcadores `[variable]` y bloques condicionales `[variable:start]…[variable:end]`. Hay 21 plantillas de correo del sistema (8 grupos), plantillas de correo personalizadas con adjuntos, plantillas de WhatsApp (que **no** reemplazan variables, es un defecto) y plantillas de contrato con ~110 variables.
6. **No existe buscador global** ni atajos de teclado. Cada listado tiene su propia búsqueda. Hay 5 paneles laterales globales: Tareas, Notificaciones, Redactar correo, Enviar WhatsApp, Soporte (+ edición rápida de cita).
7. **Todas las fichas** (Contacto, Oportunidad, Pedido, Proyecto, Prueba, Producto, Usuario, Cuenta bancaria, App) reutilizan los mismos componentes: Etiquetas, Notas, Mensajes, Actividad, Contactos relacionados/Participantes, Archivos adjuntos, y un "Progreso/Embudo" con historial.
8. **Listados**: patrón uniforme (filtros en la URL + recordados en el navegador, orden por columna, búsqueda con espera de 0,5 s, 10/25/50/100 por página, selección masiva con acciones, vista "maestro-detalle", impresión "Resumen" y exportación CSV sólo para administradores).

---

## 1. Arquitectura transversal (lo que "orquesta" todo)

| Pieza | Qué es | Dónde | Detalle relevante |
|---|---|---|---|
| **Suscriptor / subdominio** | Cada estudio es una cuenta con su subdominio. | `getSubdomain()`, `general_login.html` | La pantalla "general_login" pide el *nombre de usuario de la cuenta* y redirige a `https://{usuario}.alboomcrm.com`. El subdominio `admin` es el backoffice de Alboom (Suscriptores, informes de cuentas). |
| **AppSettings** | Toda la configuración del estudio + objeto `Subscriber` (plan, módulos, contadores, límites, tarjeta, api_key). | `$rootScope.getSettings()` → `GET /settings/` | Se cachea en el navegador; se refresca "completo" como máximo cada 30–40 s (`lastSettingsFull`, `force_full` con `refresh_usage`). Incluye `MailTemplates` (todas las plantillas del sistema). |
| **AppUser** | Usuario conectado con rol, permisos y `modules` calculados al iniciar sesión. | `UsersController.submitLogin` | `modules` = módulo del plan **Y** permiso del usuario (función `stringAnd`). Ver sección 4. |
| **AppTables** | Listas fijas traducidas (estados, períodos, intervalos, colores, parentescos, tipos de usuario, monedas). | `MainController.setLanguage` | Ver anexo 12.3. Los estados tienen códigos numéricos fijos (Oportunidad 421–426, Proyecto 200–204, Pedido 471–476). |
| **Registro de actividad** | Casi toda acción llama `Activities.save({user_id, customer_id, type, target_id, text, link})`. | Todos los controladores | Incluye inicios/cierres de sesión, ediciones de ajustes, borrados, numeración cambiada (con los valores). Es la "auditoría" del sistema. |
| **Notificaciones** | Mensajes internos a un usuario (`Notifications.save`) generados **desde el navegador** al asignar/delegar/cambiar etapas y por alarmas de citas. | `NotificationsController` | Sondeo cada **5 minutos**; toast "Tienes N notificación(es) nueva(s)". |
| **Mensajes** | Historial de correos y WhatsApp enviados, ligado a la ficha (`/mails/save`, `message_type = mail | whatsapp`). | `MailsController`, `WhatsappController` | Se ve en la pestaña "Mensajes" de cada ficha; permite "Reenviar". |
| **Idioma** | en, es, pt_BR, pt_PT (ru parcial). Define formato de fecha y separador CSV. | `setLanguage` | es/pt: fecha `DD/MM/YYYY`, CSV con `;` y decimal `,`. en: `MM/DD/YYYY`, `,` y `.`. |
| **Sesión** | Token Bearer en `$localStorage.token`. Error 400/401/403 en cualquier llamada ⇒ cierre de sesión. | `httpInterceptor` | Inactividad de **4 horas** ⇒ aviso con cuenta regresiva de 30 s y cierre. "Mantenme conectado" (`keepme`) desactiva el cierre. Si se cerró el navegador sin `keepme`, al volver se cierra la sesión. |
| **Aviso de versión nueva** | Cada 10 min revisa si hay versión nueva y muestra "Actualización disponible → Reiniciar". | `appcache.checkUpdate` | |
| **Carga perezosa de módulos** | `ocLazyLoad` por estado. | `config()` | Irrelevante para FOTOFFICE. |

**Mejora propuesta (arquitectura)**
- En FOTOFFICE la "empresa del fotógrafo" (institución) ya separa datos; mantener una sola fuente de verdad de configuración **en servidor** (no confiar en permisos calculados en el navegador como hace Alboom: en Alboom los `modules` se calculan en el cliente y cualquier persona podría alterarlos).
- Generar notificaciones y actividad **en el servidor** (hoy Alboom las crea desde el navegador: si falla la pestaña, no se crean).
- Reemplazar el sondeo de 5 min por notificaciones en tiempo real o al menos al cambiar de pantalla.

---

## 2. Módulos, planes y límites

### 2.1 `Resources.check(recurso)` — tabla completa (app.js, fábrica `Resources`)

| Recurso | Devuelve verdadero cuando… | Qué habilita / bloquea en pantalla |
|---|---|---|
| `free_plan` | `plan_id == 11` (CRM Free) | Muestra ítems con candado/corona que llevan a venta; limita Actividad/Notas/Mensajes a **últimos 30 días**; bloquea "Enviar" correo (abre venta), plantillas de correo personalizadas, WhatsApp con modelos, Integraciones de terceros, Plantillas personalizadas, Calendario, Finanzas y Plan de cuentas en Ajustes. |
| `paid_plan` | `plan_id` ∈ {2, 12, 22} | Permite elegir plantilla personalizada en el panel "Enviar correo". |
| `logo_screen` | Hay logo de pantalla cargado **y** plan pago | Muestra el logo del estudio en el login y en el menú lateral (si no, logo de Alboom). |
| `module_sales` | `Subscriber.module_sales == 1` | Oportunidades, Presupuestos, Productos, Embudos, Formulario, Origen, Seguimiento, Categorías de productos, plantillas "Oportunidades y Presupuestos", campos extra de Oportunidades/Pedidos, numeración de ventas. |
| `lead_creation_allowed` | `module_sales` y `lead_count < n_leads` | Botón "Crear Nuevo" oportunidad; si se superó, abre "Excediste el máximo de oportunidades". |
| `module_orders` | `module_orders == 1` | Pedidos, Pedido Rápido, Contratos, Tareas de Pedidos, plantillas de Pedidos. |
| `order_creation_allowed` | `module_orders` y `order_count < n_orders` | Botón "Crear Nuevo" pedido. |
| `module_calendar` | `module_calendar == 1` | Calendario, plantillas de Calendario, **permite crear Independientes (freelancers)**, enlace público de calendario del usuario. |
| `module_finance` | `AppUser.modules.finance == 1` (ojo: mira al usuario, no al plan) | Plantillas de Finanzas; menú Financiero. |
| `module_projects` | `module_projects == 1` | Proyectos, Ajustes → Proyectos, campos extra de proyectos, numeración de proyectos. |
| `module_projects_or_sales` | **Ni** proyectos **ni** ventas (nombre engañoso: es "bloquear") | Bloquea "Numeración de Tablas". |
| `module_finance_or_sales` | **Ni** ventas **ni** finanzas | Bloquea "Métodos de pago". (En el menú se llama `module_finances_or_sales` con "s": **no existe** ese caso ⇒ nunca se bloquea. Defecto.) |
| `addon_signature` | `addon_signature == 1` | Pestaña "Firma online de cliente" (firma de contratos online). |
| `addon_advanced` | `addon_advanced == 1` | "Clases" (centros de costo), Ajustes → Productos (precio mínimo), "Resultados de Ventas", costos en pedidos/productos, permiso "Editar Contratos / Descripción de productos", filtro por Clase en todos los listados, "Enviar correo al cambiar etapa" en embudos. Es el paquete "avanzado". |

Otras banderas del suscriptor usadas directamente (sin `Resources`):

| Bandera | Uso |
|---|---|
| `module_proofs` | Galerías de prueba, Aplicaciones de Galería, plantillas de Pruebas, Ajustes de Pruebas y App móvil, área de clientes "Sus galerías". |
| `addon_tasks` | Panel de Tareas (icono en barra superior) y tarjeta "Tareas" del inicio. |
| `addon_mail` | Icono de "Nuevos Mensajes" (casilla de correo; con número fijo "16" en la plantilla ⇒ función a medio hacer). |
| `addon_boleto` | Pestaña "Boleto Bancário" en Finanzas (Brasil). |
| `addon_lrmeta` | Pestaña "Metadatos" (Lightroom) en Pruebas. |
| `addon_video`, `addon_shop`, `addon_gallery_mobile`, `module_campaings`, `module_schedule` | Se copian a `AppUser.modules` pero casi no tienen pantallas en este material. |
| `persona_id == '1'` | Perfil "fotógrafo de bodas": aparece el grupo "Boda" y variables/campos de boda en formularios, contratos y Mailchimp. |
| `trial_account`, `blocked_account`, `days_due`, `migrated_pm`, `disable_pm`, `is_bf` | Avisos de cobro, bloqueo por falta de pago, migración a "PhotoManager", promociones Black Friday. |

### 2.2 Límites de uso (`checkOverLimit(tipo)`)
Compara `Subscriber[tipo+'_count'] >= Subscriber['n_'+tipo+'s']`. Tipos usados: `user`, `active_project`, `gallery_mobile` (+ lead/order vía `Resources`). Al superar: modal "Límite de recursos alcanzado — Alcanzaste el límite de X permitido (N)" con botón "Actualización" que lleva a la pantalla de mejora de plan.

### 2.3 Menú de Ajustes: qué se bloquea
Cada ítem puede estar `show` (visible) y/o `blocked` (visible con corona; al hacer clic va a `support.resources({resource})`, una página de venta). Ver tabla de la sección 3.1.

**Mejora propuesta (planes)**
- Definir en FOTOFFICE un único catálogo de "capacidades" en servidor (`capacidades: ventas, pedidos, proyectos, finanzas, calendario, galerías, firma_online, avanzado…`) y una función `puede(capacidad)` usada igual en servidor y pantalla. Evitar nombres negados confusos (`module_projects_or_sales` que en realidad significa "ninguno").
- Los límites deberían validarse en el servidor al crear (Alboom sólo cambia el botón).
- Mostrar lo bloqueado con candado + explicación (bueno para vender), pero sin romper enlaces profundos.

---

## 3. Configuración (Ajustes) — pantalla por pantalla

### 3.1 Estructura del menú (orden exacto, `SettingsController`, `views/settings/index.html`)

Ruta: `#/settings/index/action/{link}?type=…&label2=…` → carga `views/settings/{link}.html`. Estado `settings` restringido a `role == 'admin'`. Además del menú, en la columna izquierda hay "Inicio" y **"Usuarios"** (este último oculto si el plan se llama "Lite").

| # | Grupo (es) | Sub-ítem (es) | `link` / `type` | Visible si | Bloqueado (corona) si |
|---|---|---|---|---|---|
| 1 | **Sistema** | Información Comercial | `company` | siempre | — |
| | | Logotipos | `logos` | siempre | — |
| | | Internacional | `international` | siempre | — |
| | | Firmas | `signatures` | siempre | — |
| | | Correo electrónico | `email` | siempre | — |
| | | Integración Alboom Prosite | `prosite` | siempre | — |
| | | Integraciones de terceros | `apikey` | free o ventas | plan free |
| | | Campos Adicionales | `extrafields` | siempre | — |
| | | Numeración de Tablas | `tables` | siempre | sin proyectos ni ventas |
| 2 | **Categorías** | Categorías de contactos | `categories` / `contact` | siempre | — |
| | | Clases | `classes` / `class` | `addon_advanced` | — |
| | | Participantes | `categories` / `participant` | siempre | — |
| | | Categorías de notas | `categories` / `action` | siempre | — |
| | | Categorías de Productos | `categories` / `product` | siempre | sin ventas |
| | | Métodos de pago | `categories` / `payment` | siempre | (nunca, por defecto de código) |
| 3 | **Plantillas de Correo • Sistema** | Firma del correo electrónico | `email_templates` / `email_signature` | siempre | — |
| | | Oportunidades y Presupuestos | `email_templates` / `leads` | siempre | sin ventas |
| | | Pedidos | `email_templates` / `orders` | siempre | sin pedidos |
| | | Contratos | `email_templates` / `agreements` | siempre | plan free |
| | | Galerías de pruebas | `email_templates` / `proofs` | `module_proofs` | — |
| | | Calendario | `email_templates` / `calendar` | siempre | sin calendario |
| | | Financiero | `email_templates` / `finance` | siempre | sin finanzas |
| | | Sistema (Utilidades del sistema) | `email_templates` / `system` | siempre | — |
| 4 | **Plantillas de Correo • Personal** | — | `email_templates_custom` | siempre | plan free |
| 5 | **Plantillas de mensajes - WhatsApp** | — | `whatsapp_templates_custom` | siempre | plan free |
| 6 | **Galerías de pruebas** | — | `proofs` | `module_proofs` | — |
| 7 | **Aplicación Móvil de Galería** | — | `mobile` | `module_proofs` | — |
| 8 | **Flujo de trabajo** (Flujos de trabajo de Proyectos) | — | `workflows` / `stage` | siempre | — |
| 9 | **Proyectos** | — | `projects` | siempre | sin proyectos |
| 10 | **Embudos de Venta** | — | `pipelines` / `pipeline` | free o ventas | sin ventas |
| 11 | **Presupuestos** | Categorías de Presupuestos · Condiciones | `quotes` · `terms` | free o ventas | sin ventas |
| 12 | **Oportunidades** | Herramienta de formulario · Origen de la oportunidad · Seguimiento | `formtool` · `leadorigin` · `followup` | free o ventas | sin ventas |
| 13 | **Productos** | — | `products` | avanzado **y** ventas | — |
| 14 | **Pedidos** | — | `orders` | free o pedidos | sin pedidos |
| 15 | **Tareas de Pedidos** | — | `order_tasks` / `order_stage` | free o pedidos | sin pedidos |
| 16 | **Contratos** | — | `agreements` | free o pedidos | sin pedidos |
| 17 | **Calendario** | — | `calendar` | free o calendario | plan free |
| 18 | **Financiero** (Recordatorios de vencimiento) | — | `finance` | free o finanzas | plan free |
| 19 | **Plan de cuentas** | Ingresos · Costos · Gastos | `chartaccounts` / `R` · `C` · `D` | free, ventas, pedidos o finanzas | plan free |
| 20 | **Área de Clientes** | — | `customer_area` | siempre | — |
| 21 | **Sesión** (Sesiones) | — | `sessions` | siempre | — |

> Nota: el acceso directo "Ajustes" del menú de usuario apunta a `link: 'dashboard'` (no existe `settings/dashboard.html` en el material): probablemente muestra la portada con el menú. Verificar.

**Comportamiento común de todas las pantallas de Ajustes**
- Botones **Deshacer** (recarga desde servidor) y **Guardar** (`saveSettings` → `POST /settings/` con el objeto completo). Mientras guarda: "Guardando".
- Al guardar: aviso "Se guardaron los ajustes" + actividad "Settings were edited" + recarga de `AppSettings`.
- Las tablas editables (categorías, flujos, plantillas) funcionan en "modo borrador": agregar/editar/borrar filas marca "Se hicieron cambios. Por favor haga clic en Guardar" y **nada se guarda hasta pulsar Guardar**. Filas reordenables arrastrando (el orden se guarda como `weight`).
- Editor de texto enriquecido (Summernote) con: deshacer/rehacer, negrita/cursiva/subrayado/super/sub/tachado, fuente, tamaño, color, listas, párrafo, interlineado, tabla, enlace, imagen, línea, **vista de código**. Al pegar, pega sólo texto plano.

**Mejora propuesta (general de Ajustes)**
- Buscador dentro de Ajustes ("¿qué quiero configurar?") y agrupar por tarea ("Mi estudio", "Ventas", "Comunicación", "Clientes", "Finanzas", "Seguridad").
- Guardado por sección con indicador de cambios sin guardar y aviso al salir (Alboom no avisa si salís sin guardar).
- Historial de cambios de configuración con valor anterior/nuevo (Alboom sólo registra "Settings were edited").
- En FOTOFFICE ya existe **Configuración → Palabras** (terminología): integrar ahí las etiquetas renombrables (campos extra, grupos) en lugar de pantallas sueltas.

---

### 3.2 Sistema → Información Comercial (`company.html`)
**Qué configura:** los datos del estudio que aparecen en documentos, correos y área de clientes.

| Campo (es) | Clave | Obligatorio | Dónde se usa |
|---|---|---|---|
| Nombre del estudio | `site_name` | Sí | Título del panel, login ("Bienvenido al Panel de Control · {nombre}"), pie de impresiones ("©año, {nombre}. Impreso usando Alboom CRM"), `[company_name]` en plantillas, App móvil. |
| Nombre Comercial | `company` | No | `[company_trade_name]` en contratos (razón social vs nombre de fantasía: ver duda 12). |
| Teléfono | `phone` | No | `[company_phone]`; checklist de bienvenida. |
| Móvil | `cellular` | No | App móvil. |
| Correo electrónico | `site_email` | No | `[company_email]`. |
| URL del sitio web | `site_url` | No | `[company_website]`. |
| Facebook / Twitter / Instagram URL | `social_*` | No | App móvil de galería. |
| Dirección, Dirección 2, Ciudad, Provincia, Código postal, País | `address1…country` | No | Encabezado de impresos, `[company_address…]`. |
| NIF (Business Tax ID) | `cnpj` | No | `[company_doc2]`. |

El nombre del estudio en la barra superior tiene un lápiz al pasar el mouse que lleva a esta pantalla.
**Mejora:** validación de CUIT/condición IVA para Argentina, logo y colores en la misma pantalla ("identidad"), vista previa de cómo sale en un presupuesto.

### 3.3 Sistema → Logotipos (`logos.html`)
Dos pestañas:
- **Documentos impresos**: imagen (`logo_print`, máx. 500 KB, sugerido 350×100) + "Alineación en documentos impresos" Izquierda/Centro/Derecha (`logo_print_hpos`) + "Alineación en contratos" (`logo_print_agreement_hpos`, sólo con ventas). Se usa en presupuestos, lista de precios, pedidos, facturas, contratos, informes e impresiones de listados.
- **Logotipo de la pantalla**: `logo_screen` (160×60) para la interfaz; sólo se muestra con plan pago (`Resources.check('logo_screen')`).

Reglas de carga comunes: arrastrar y soltar, un archivo, sin espacios ni signos en el nombre (sólo `_` y `-`), muestra tamaño en píxeles.
**Mejora:** recorte y previsualización en vivo; versión clara/oscura; favicon.

### 3.4 Sistema → Internacional (`international.html`)
| Campo | Clave | Efecto |
|---|---|---|
| Detectar idioma automáticamente (Sí/No) | `default_language_autodetect` | Si Sí, usa el idioma del navegador; el usuario o cliente puede cambiarlo siempre. |
| Idioma predeterminado | `default_language` | Idioma inicial del sistema y del área de clientes. También elige el texto del correo de cumpleaños por defecto. |
| Divisa | `currency` | Símbolo en importes (filtro `mycurrency`). |
| Moneda por extenso (singular / plural) | `currency_singular` / `currency_plural` | Importe en letras en recibos (`/account_trans/amount_in_words`). |
| Posición: Anteponer / Posponer | `currency_prepend` | "$ 100" o "100 $". |

**Mejora:** separar idioma de formato numérico; zona horaria acá (hoy está en Calendario).

### 3.5 Sistema → Firmas (`signatures.html`)
Pestaña **Firma digitalizada de la empresa**: imagen escaneada (`signature`, máx. 2 MB) + "Desplazamiento de posición" (`signature_offset`, positivo = sube, negativo = baja). Se aplica automáticamente en **recibos** y en contratos donde se ponga `[company_signature]`.
Pestaña **Firma online de cliente** (requiere `addon_signature`; en plan free muestra venta):
- "Activar firma en línea de contratos" (`signature_online`).
- "Firmas deben ser": **Escribir** (sólo tipea su nombre) o **Escribir y Dibujar** (además dibuja con mouse/tableta) (`signature_online_typed_only`).
- Se inserta con `[contractor1_signature]` y/o `[contractor2_signature]`.
- Advertencia legal: no usa certificado digital.

**Mejora:** firma con registro de evidencia (IP, fecha, hash del documento, correo verificado), PDF final sellado y enviado a ambas partes.

### 3.6 Sistema → Correo electrónico (`email.html`)
- **Copia Oculta de Correo** (`email_bcc`): "¿Desea recibir una copia de todos los correos enviados a sus clientes?" — lo aplica el servidor (inferido).
- **Configuración predeterminada del servidor SMTP**: Servidor (`smtp_host`), Puerto (`smtp_port`), Cifrado Ninguno/SSL/TLS (`smtp_ssl`). Son sólo **valores por defecto** que se copian al activar "SMTP personalizado" en cada usuario (ver 4.4). Usuario/contraseña se cargan por usuario.
- Importante del motor: el navegador envía por `/mails/send` con remitente `noreply@alboomcrm.com` y **responder a** = correo del usuario; con SMTP propio o Gmail, el servidor usaría la casilla del usuario (inferido).

**Mejora:** en FOTOFFICE los correos a clientes salen por Resend con dominio verificado del estudio (SPF/DKIM) y "responder a" del usuario; ofrecer "conectar Gmail/Outlook" por OAuth sólo como opción. Botón "Enviar correo de prueba" en la misma pantalla.

### 3.7 Sistema → Integración Alboom Prosite (`prosite.html`)
Muestra la **Clave API** del suscriptor (`Subscriber.api_key`), botón "Generar nueva clave" (`GET /settings/update_apikey`) y "Copiar al portapapeles". Sirve para que el sitio web Alboom Prosite cree Oportunidades en el CRM.
**Mejora:** varias claves con nombre, permisos y fecha de último uso; revocación individual.

### 3.8 Sistema → Integraciones de terceros (`apikey.html`) = **Mailchimp**
A pesar del nombre, la pantalla sólo contiene Mailchimp (el texto menciona "use la clave API siguiente" pero la clave está en Prosite).

| Campo | Clave | Efecto |
|---|---|---|
| Usar Mailchimp (Sí/No) | `mailchimp_api` | Activa la sincronización. |
| Clave API de Mailchimp + Conectar/Reconectar | `mailchimp_api_key` | Llama `/mailchimp/getLists` y trae las listas. |
| Lista predeterminada | `mailchimp_default_list` | Lista donde se agregan los contactos nuevos. |
| Categoría de contacto Alboom CRM | `mailchimp_default_category` | Sólo se envían a Mailchimp los contactos de esa categoría (o "Todos"). |
| Atribuir listas a categorías de Oportunidades (Sí/No) | `mailchimp_relation_active` | Pestaña "Listas y Categorías": por cada Categoría de Presupuesto elegir una lista. |
| Campos personalizados (informativo) | — | Campos de combinación que Alboom completa si existen en la lista (todos tipo TEXT): `FNAME, LNAME, ADDRESS1, ADDRESS2, CITY, STATE, ZIPCODE, COUNTRY, CATEGORY, PHONE, CELLULAR, LEADCAT, LEADORIGIN, EVENTDATE, BRIDENAME, GROOMNAME, PLACEEVENT, PLACERECPT, CITYEVENT, STATEEVENT, COUNTEVENT, GUESTS`. |

Guardado: `Settings.update` + `Mailchimp.save({lists, relations})`.
**Mejora:** integración genérica por webhooks salientes ("cuando se crea contacto/oportunidad/pedido…") para Zapier/Make/n8n; sincronización bidireccional de bajas. No aparece Zapier en el código.

### 3.9 Sistema → Campos Adicionales (`extrafields.html`)
Renombra 4 campos de texto + 2 de fecha por entidad (el valor vacío = no se usa). Pestañas:

| Pestaña | Claves de etiqueta | Visible si | Dónde aparecen |
|---|---|---|---|
| Contactos | `user_extra1..4`, `user_date1..2` | siempre | Ficha y edición de contacto, **y también en usuarios** (inferido: contactos y usuarios comparten tabla — el listado de contactos pide `role: "contact"` y las etiquetas `user_extra*` se usan en ambos), importación CSV, variables `[customer_extra1..4]`, `[customer_date1..2]`. |
| Oportunidades | `lead_extra1..4`, `lead_date1..2` | ventas | Edición/vista de oportunidad, importación CSV de oportunidades, API del formulario (`extra1..4`, `extra_date1..2`). |
| Pedidos | `order_extra1..4`, `order_date1..2` | ventas | Edición/vista/impresión de pedido y factura, pedido rápido, variables de contrato `[extra1..4]`, `[date1..2]`. |
| Proyectos | `project_extra1..4`, `project_date1..2` | proyectos | Edición, vista e impresión de proyecto. |

La búsqueda de los listados "Busca en todos los campos incluyendo campos adicionales".
**Mejora:** campos personalizados ilimitados con tipo (texto, número, fecha, lista, casilla, moneda), obligatoriedad, orden, visibilidad en portal y uso como variable/filtro/columna.

### 3.10 Sistema → Numeración de Tablas (`tables.html`)
"Establece el número inicial de la secuencia" para: Oportunidades (`leads`), Presupuestos (`quotes`), Pedidos (`orders`), Facturas (`invoices`), Contratos (`agreements`) —estos 5 con ventas— y Proyectos (`projects`, con proyectos). Reglas: sólo números; **no se puede bajar** una secuencia; se registra en actividad con los valores. `GET/POST /settings/numbering`.
**Mejora:** prefijos y formato por tipo (`P-2026-0001`), reinicio anual opcional, vista previa del próximo número.

### 3.11 Categorías (`categories.html`, parámetro `type`)
Una sola pantalla para varios catálogos (`/categories`), con columnas según el tipo:

| Tipo (menú) | `type` | Columnas extra | Uso en el sistema |
|---|---|---|---|
| Categorías de contactos | `contact` | — | Filtro "Categoría" de Contactos, selector en alta rápida, importación CSV (categoría destino), filtro de Mailchimp. |
| Participantes | `participant` | — | Opciones de "Participando como" al agregar un contacto relacionado a una Oportunidad/Pedido/Proyecto (ej.: novia, padrino, planner). |
| Categorías de notas | `action` | — | Campo **"Acción"** obligatorio al crear una nota (ej.: llamada, reunión, WhatsApp). |
| Categorías de Productos | `product` | "Lista de precios" (activo) | Agrupa productos; si está activo, la categoría aparece en la Lista de precios pública. |
| Métodos de pago | `payment` | "Recordatorio" (activo), "¿Ocultar?", "Instrucciones de pago" (texto) | Métodos al cargar pagos de un pedido. El texto de instrucciones se muestra al cliente en el Área de Clientes al pulsar "Ver instrucciones". "Recordatorio" habilita el envío automático de recordatorios de vencimiento (ver 3.26). Algunos métodos del sistema están **bloqueados** (`locked`): no se pueden borrar ni renombrar (ej. Boleto 52, PagSeguro 56, PayPal 57). |

Filas: nombre editable, confirmar/cancelar por fila, borrar (salvo bloqueadas), reordenar arrastrando.
**Mejora:** un "gestor de listas" unificado con color e icono por opción, desactivar sin borrar, y aviso de cuántos registros usan la opción antes de borrarla.

### 3.12 Categorías → Clases (`classes.html`, requiere `addon_advanced`)
"Clases" = centros de costo/unidades de negocio para clasificar proyectos, pedidos, contactos, etc.
- "Activar" (`classes_active`).
- Obligatoriedad por módulo (Sí/No): Calendario (`classes_in_calendar`), Contactos (`classes_in_contacts`), Oportunidades (`classes_in_leads`), Pedidos (`classes_in_orders`), Proyectos (`classes_in_projects`), Finanzas (`classes_in_finances`).
- Lista de clases (tipo `class`).
**Efecto:** aparece el selector "Clase" en esas fichas (obligatorio si se marcó), el filtro "Clase" en todos los listados e impresiones (`itemClass`), en informes financieros y de ventas.
Defecto observado: `loadOrder` lee `classes_in_fanances` (mal escrito).
**Mejora:** en FOTOFFICE esto encaja como "Unidad de negocio / Línea" (ej.: Colegios, Eventos, Estudio) con informes de rentabilidad por línea.

### 3.13 Plantillas de Correo • Sistema (`email_templates.html`)
Pantalla con una pestaña por plantilla del grupo (`$rootScope.MailVariables[type]`). Cada pestaña: descripción, **Asunto**, **Cuerpo** (editor enriquecido), **Archivos adjuntos** (sólo en las que lo permiten, hasta 10 MB c/u) y tabla "Utilice las variables abajo…" con los marcadores disponibles. Guardado: `POST /settings/mail_templates`. Catálogo completo en la **sección 5**.

Caso especial **Correo de cumpleaños**: interruptor "Activar envío de correo de cumpleaños" (`bday_enabled`). Al activarlo, **sobrescribe** la plantilla con un texto por defecto según el idioma predeterminado (pt/es/en) y luego se puede editar.

### 3.14 Plantillas de Correo • Personal (`email_templates_custom.html`)
Lista de plantillas propias (Asunto como nombre). Acciones: editar nombre, editar texto, borrar (si hay más de una), reordenar, agregar. Al editar: cuerpo enriquecido + **adjuntos** (se habilitan después del primer guardado) + variables:
`[customer_name] [customer_firstname] [customer_lastname] [customer_email] [customer_company] [customer_address] [customer_address2] [customer_city] [customer_state] [customer_zipcode] [customer_country] [customer_phone] [customer_mobile] [customer_doc1] [customer_doc2] [user_name] [user_firstname] [user_lastname] [user_email] [company_name] [company_email] [company_website] [company_phone] [email_signature] [attaches_box]`.
**Uso:** en el panel "Enviar correo", pestaña "Plantillas de Correo" → desplegable de asuntos → reemplaza asunto y cuerpo con los datos del contacto de la ficha desde donde se abrió. Sólo planes pagos.

### 3.15 Plantillas de mensajes - WhatsApp (`whatsapp_templates_custom.html`)
Igual que la anterior pero cuerpo en **texto plano** (textarea) y sin adjuntos. Se usan en el panel "Enviar WhatsApp" → "Modelos".
**Defecto importante:** al elegir un modelo, el texto se copia **tal cual** (no reemplaza `[customer_name]` etc.). Sólo la plantilla interna `receipt_whats` (recibo) pasa por el motor de variables.
**Mejora:** mismas variables que el correo, vista previa con el contacto real, y envío por WhatsApp Business API (hoy abre `api.whatsapp.com/send?phone=…&text=…` y registra el mensaje como enviado aunque el usuario no lo envíe).

### 3.16 Galerías de pruebas (`proofs.html`, requiere `module_proofs`)
Pestañas:
- **Configuración de prueba**: "Cambiar el tamaño de imágenes antes de subir" (`proof_reducing`) + ancho/alto máximos en px (`proof_max_x`, `proof_max_y`). Lo usan los cargadores de pruebas, álbumes y apps (redimensionan en el navegador).
- **Metadatos** (requiere `addon_lrmeta`, Lightroom): Usar metadatos (`proof_metadata`); Mostrar calificación a clientes (`proof_show_rating`); Ordenar galerías por calificación No/Ascendente/Descendente (`proof_sort_rating`); "Preferidas del estudio" por No/Estrellas/Etiquetas (`proof_use_meta_choices`) con cantidad de estrellas (`proof_rating_choices`) o color de etiqueta 6–10 (`proof_label_choices`: rojo, amarillo, verde, azul, violeta); Mostrar etiquetas de color a clientes (`proof_show_labels`); Texto personalizado por color (`proof_label_6..10`).
- **Marca de agua**: imagen PNG/GIF transparente (`watermark`), posición en grilla 3×3 (`watermark_vpos` + `watermark_hpos`), margen en px (`watermark_margin`). Se activa por galería.
- **Recordatorios**: lista de días (uno por línea, `proof_fup_days`) en que se envía al cliente el correo "Recordatorio" (plantilla `proof_fup`) antes del vencimiento de la galería. Lo ejecuta el servidor (inferido).
(Detalle funcional de galerías: ver documento del analista de Galerías.)

### 3.17 Aplicación Móvil de Galería (`mobile.html`)
Logo (`mobile_logo`, 1 MB), colores Fondo (`mobile_background_color`) y Textos e iconos (`mobile_color`), datos del negocio (nombre, móvil, correo, web) y redes. **Ojo:** estos campos son los **mismos** que Información Comercial (`site_name`, `cellular`, `site_email`, `site_url`, `social_*`): editarlos acá los cambia allá. Vista previa `mobile_preview.html`.

### 3.18 Flujo de trabajo — Flujos de trabajo de Proyectos (`workflows.html`, `type=stage`)
Lista de flujos: Nombre, Etapas (cantidad), Días (total), herramientas: editar nombre, **editar etapas**, borrar (debe quedar al menos uno), **clonar**. Edición de etapas: Nombre de la etapa, Duración (días), **Tareas** (una por línea, se crean automáticamente al entrar en la etapa), reordenar. Guardado `POST /categories/save_workflow`; clonar `/categories/clone_workflow`.
**Efecto:** el proyecto elige un flujo; el widget "Progreso" muestra etapas, calcula **Proyección de Plazo** (fecha estimada de fin de cada etapa según días) y crea tareas. `workflows_saved` cuenta para el checklist de bienvenida.

### 3.19 Proyectos (`projects.html`)
"Opciones de Impresión" de la ficha de proyecto: Imprimir Participantes (`projects_print_participants`), Contactos relacionados con el cliente (`projects_print_related`), Historial de Progreso (`projects_print_history`), Proyección de Plazo (`projects_print_projection`), Notas (`projects_print_notes`). Los widgets de impresión se muestran u ocultan según esto.

### 3.20 Embudos de Venta (`pipelines.html`, `type=lead_stage`)
Igual a Flujos de trabajo, para Oportunidades. Diferencias: botón "Guardar Embudo"; consejo "mantenga la última etapa para ítems completados: no será visible". La "Duración (días)" de cada etapa define la **fecha de Siguiente Acción** al pasar a esa etapa (reemplazó al viejo "Días a la siguiente acción" de Seguimiento). Tareas por etapa igual que proyectos.

### 3.21 Presupuestos → Categorías de Presupuestos (`quotes.html`, tipo `lead_type`)
"Son como una familia de productos/servicios". Columnas: Nombre, **Grupo**, Activo, herramientas (editar, **Editar presupuesto estándar**, borrar).
- **Grupo** (`subtype`) define qué datos extra pide la Oportunidad/Pedido:
  - Boda (sólo perfil bodas): fecha/hora, invitados, novia, novio, lugar de ceremonia y recepción.
  - Evento: fecha/hora, invitados, lugar.
  - Trabajo con fecha: fecha/hora y lugar sólo en Pedidos.
  - Trabajo sin fecha: nada extra.
- **Presupuesto estándar por categoría** (clave `default_quote_{id}`): asunto, cuerpo, adjuntos. Si no se editó, usa una copia del "Presupuesto Estándar Master". Variables: `[customer_name] [customer_firstname] [customer_lastname] [customer_company] [customer_email] [my_name] [my_firstname] [my_lastname] [my_email] [company_name] [company_email] [company_website] [company_phone] [pricelist_link]`.
- Uso: respuesta automática del formulario ("Presupuesto Estándar") y envío manual desde la Oportunidad.
- La categoría es además el **"tipo"** que filtra Oportunidades, se vincula a listas de Mailchimp y aparece en el formulario como "Me gustaría solicitar un presupuesto para".

### 3.22 Presupuestos → Condiciones (`terms.html`)
"Condiciones de pago" (`quote_payment_conditions`) y "Mensaje personalizado" (`quote_general_conditions`): textos que se imprimen en la **Lista de precios** y en los **Presupuestos**.

### 3.23 Oportunidades → Herramienta de formulario (`formtool.html`)
Formulario público de captación ("Todas las solicitudes crean automáticamente un Contacto y una Oportunidad"). 4 pestañas:

**a) Configuración**
| Campo | Clave | Efecto |
|---|---|---|
| Embudo de ventas por defecto | `form_lead_pipeline_id` | Embudo de las oportunidades creadas por el formulario. |
| Usuario por defecto | `default_lead_user` | Responsable de la oportunidad creada. |
| Notificar usuario (Sí/No) | `notify_form_lead` | Notificación al usuario por cada nueva oportunidad (y correo "Notificación de Nueva Oportunidad", inferido). |
| Respuesta del formulario: Desactivado / Respuesta automática / Presupuesto Estándar | `form_lead_reply` | Qué correo recibe el cliente al enviar: plantilla `autoreply` o el presupuesto estándar de la categoría elegida. |
| Mostrar encabezado (logo y título) | `form_lead_show_header` | |
| Mostrar información: No mostrar / Contacto completo / Contacto sin dirección | `form_lead_contact` | Datos del estudio visibles en el formulario. |
| URL de la herramienta | (fija) `{raíz}/form_lead/#/index` | Enlace para compartir. |
| Ejemplo de iframe | (fijo) | Código para incrustar en la web (contenedor 16:9 responsive). |
| Mensaje en pantalla tras enviar | `form_lead_sent_message` | Admite código de seguimiento (Google Ads / Facebook). |
| Página tras enviar (opcional) | `form_lead_redirect_url` | Redirige a una página de "gracias" propia. |

**b) Logo**: `logo_form` (350×100).

**c) Personalización del formulario** ("Activar formulario personalizado", `custom_form.is_active`; también afecta al formulario de Prosite). Por campo: **Etiqueta**, **Visible**, **Obligatorio** (obligatorio se desactiva si no es visible). Valores por defecto:

| Grupo | Campo | Etiqueta por defecto | Visible | Obligatorio |
|---|---|---|---|---|
| General | Nombre | Nombre | fijo Sí | fijo Sí |
| | Apellido | Apellido | Sí | No |
| | Móvil | Móvil | Sí | Sí |
| | Correo | Correo | fijo Sí | fijo Sí |
| | Categoría | "Me gustaría solicitar un presupuesto para" | Sí | Sí |
| | Mensaje | Mensaje | Sí | No |
| | Origen | "¿Cómo se enteró de nuestro trabajo?" | Sí | Sí |
| Boda (perfil bodas) | Fecha de la boda, Invitados, Novia, Novio, Lugar de ceremonia, Lugar de recepción, Ciudad, Provincia, País | — | Sí | No |
| Eventos | Fecha del evento, Invitados, Lugar, Ciudad, Provincia, País | — | Sí | No |

Guardado `POST /settings/custom_form_lead`. (Existe en código una lista de "temas" visuales — Amelia, Cyborg, Standard, Readable… — sin pantalla visible: posible función retirada.)

**d) Formulario Externo** (para programadores):
- Opción 1 – HTML `POST {raíz}/api/leads/add` con `return_url` oculto y `date_format` (dd/mm/yyyy o mm/dd/yyyy).
- Opción 2 – Webhook JSON UTF-8 al mismo endpoint.
- Campos: `name*`, `lastname`, `cellular`, `email*`, `category_id` (ids listados), `lead_origin` (opciones listadas), `pipeline_id`, `description` (multilínea), `extra1..4`, `extra_date1..2` (aaaa-mm-dd); bodas: `event_date`, `date_format`, `bride_name`, `groom_name`, `place_event`, `place_reception`, `city_event`, `state_event`, `country_event`; eventos: `event_date`, `date_format`, `place_event`, `city_event`, `state_event`, `country_event`.
- Respuesta: `{"status":"OK","data":{…,"customer_id":…}}` o `{"status":"Error","error_message":"Field 'email' cannot be null or empty"}`.
- Observación: **el endpoint no pide clave**; identifica la cuenta por subdominio ⇒ expuesto a spam.

**Mejora:** constructor de formularios con varios formularios (por campaña/servicio), campos personalizados, anti-spam (captcha invisible/honeypot), UTM automáticos al origen, clave pública por formulario y webhook firmado.

### 3.24 Oportunidades → Origen de la oportunidad (`leadorigin.html`)
Textarea "una opción por línea, sin líneas en blanco al final" (`lead_origin`). Se usa en: formulario público, alta de oportunidad, filtro "Origen" del listado e impresión, informe de oportunidades, campo `LEADORIGIN` de Mailchimp.
**Mejora:** lista administrable con activar/desactivar y agrupación (Instagram, Recomendación, Google…), y origen automático por UTM.

### 3.25 Oportunidades → Seguimiento (`followup.html`)
- "Días a la siguiente acción": **ya no se edita aquí** (nota que remite a Embudos de Venta).
- "Días para enviar un correo automático de seguimiento" (`followup_days`): N días después de enviar un presupuesto estándar o personalizado se envía la plantilla "Seguimiento" (`followup`). 0 = no enviar. Lo ejecuta el servidor (inferido).
**Mejora:** secuencias de seguimiento de varios pasos (día 2 WhatsApp, día 5 correo…) que se detienen al responder o al ganar/perder.

### 3.26 Productos (`products.html`, avanzado + ventas)
"Precio Mínimo" → Activar (`products_min_price`). Agrega un campo obligatorio "Precio mínimo" a cada producto. Efecto al cargar ítems en Oportunidad/Pedido/Presupuesto (`modal_items.html`): si precio con descuento < mínimo muestra "El precio es menor que el mínimo permitido" y **bloquea Guardar**.

### 3.27 Pedidos (`orders.html`)
- **Cuentas en Pedidos**: cuenta contable para "Otros gastos" (`order_account_other_expenses`) y para "Descuento" (`order_account_discount`) al emitir un pedido.
- **Edición de pedidos**: "No permitir la edición de pedidos completados o cancelados" (`order_edit_blocked`). Si Sí, sólo el administrador edita pedidos Completados/Cancelados (y los "Pedido Rápido").
- **IVA y Facturas** (no se muestra para Brasil): Activar IVA (`vat_active`), IVA % (`vat_percentage`), "El precio del producto incluye IVA" (`price_include_vat`, por defecto Sí), cuenta contable del IVA si no está incluido (`vat_account`, def. 3.9), "Datos fiscales para el encabezado de la factura" (`vat_header`, texto enriquecido). Con IVA activo aparecen en el menú **Facturas** e **Informes de IVA**, y numeración de facturas.
**Mejora (Argentina):** factura electrónica AFIP/ARCA (CAE, puntos de venta, tipos A/B/C) en lugar de IVA genérico.

### 3.28 Tareas de Pedidos (`order_tasks.html`, `type=order_stage`)
Flujos para pedidos con **un solo lote de tareas** (sin días): "contiene las Tareas que desee crearse automáticamente cuando se agrega un Pedido con estado Abierto". Lista de flujos con clonar/borrar; editor de tareas una por línea.

### 3.29 Contratos (`agreements.html`)
Plantillas de contrato (`/agreement_templates`): Nombre, Activo, herramientas: editar nombre, **editar texto** (editor enriquecido), **ver** (vista previa imprimible con logo y pie), **clonar** (requiere permiso "Editar Contratos" o admin), borrar (si hay más de una), reordenar.
Advertencia clave: "Las variables se reemplazan **sólo al crear el contrato** desde el modelo; luego hay que editarlo a mano o crear uno nuevo". Variables completas en la sección 5.4.

### 3.30 Calendario (`calendar.html`)
Pestañas:
- **Categorías**: tipos de cita (`EventTypes`) con Nombre y **Color** (16 colores con nombre: azul, verde, rojo, naranja, magenta, azul marino, gris, negro, violeta, verde oscuro, vino, amarillo, rosa, marrón, azul pizarra, gris oscuro).
- **Modo de edición**: ver/editar citas en **Pop up** o **Barra lateral** (`calendar_sidebar_mode`).
- **Alertas**: Alerta 1 y 2 por defecto = número + unidad (minutos/horas/días/semanas/meses antes) → se guardan en minutos (`alert1_minutes`, `alert2_minutes`). Precargan las alarmas de cada cita nueva.
- **Notificación de Cita**: "¿Enviar notificación de cita a los usuarios?" (`event_alert_message`) → correo a participantes al crear/modificar (plantillas "Confirmación/Cancelación de Cita – Usuarios").
- **Inicio de la Semana**: Domingo/Lunes (`date_week_start`; si vacío, lunes en español, domingo en otros).
- **Zona Horaria**: usar zona (`timezone_active`) + selección (`timezone`, ~80 zonas, incluye Buenos Aires). Se graba en cada cita nueva.
Guardado `EventTypes.save(rows)` + ajustes.

### 3.31 Financiero (`finance.html`)
- **Recordatorios de vencimiento**: Activar (`boleto_reminder`), Días de anticipación (`boleto_reminder_days`), Usuario por defecto responsable (`default_reminder_user`). Sólo para métodos de pago con "Recordatorio" activo (3.11). Plantilla "Recordatorios de vencimiento" (`boleto_reminder`).
- **Boleto Bancário** (Brasil, `addon_boleto`): tokens de BoletoCloud.
- **PayPal**: correo y código de moneda (para enlaces de pago en recordatorios y botón "Pagar con PayPal" en el Área de Clientes).
- **PagSeguro** (sólo pt_BR).
- **Restablecer datos del Financiero** (zona roja): borra transacciones bancarias, cuentas por pagar y por cobrar; confirmación del navegador; irreversible; queda en actividad.
**Mejora:** Mercado Pago / DNX Payments como método nativo con link de pago y conciliación automática; el "reset" debería exigir escribir el nombre del estudio y dejar copia descargable.

### 3.32 Plan de cuentas (`chartaccounts.html`, `type` R/C/D)
Tres listas: **Ingresos** (códigos `3.x`), **Costos** (`4.x`), **Gastos** (`5.x`). Validaciones: sólo números y puntos, debe empezar con el prefijo, mínimo 3 caracteres, sin duplicados. Se usa en pedidos (descuento, otros gastos, IVA), transacciones e informes financieros.

### 3.33 Área de Clientes (`customer_area.html`)
Interruptores de lo que ve el **cliente** al entrar (rol `contact`):
| Opción | Clave | Requiere |
|---|---|---|
| El cliente puede editar su perfil | `customer_area_edit_profile` | — |
| Mostrar Pruebas | `customer_area_proofs` | módulo pruebas |
| Mostrar enlace a Galerías Públicas | `customer_area_proofs_public` | lo anterior |
| Mostrar Proyectos | `customer_area_projects` | proyectos |
| Mostrar Calendario | `customer_area_calendar` | calendario |
| Mostrar Presupuestos / Pedidos / Contratos | `customer_area_quotes` / `_orders` / `_agreements` | ventas |
| Mostrar Cuentas por Cobrar | `customer_area_ar` | finanzas |
Ver sección 8.1.

### 3.34 Sesión (`sessions.html`)
Tabla de sesiones abiertas de **todos** los usuarios y clientes: Nombre, Email, Papel (icono: estrella admin, usuario, cámara freelancer, niño contacto), Creado, Expira, IP, Dispositivo (PC/móvil), Aplicación (Chrome, Edge, Firefox, Safari, Opera, "App Alboom CRM"). Botón **Revocar sesión** (salvo la actual). `GET/DELETE /sessions`.
**Mejora:** además, cerrar todas las sesiones de un usuario, 2FA, alertas de inicio desde dispositivo nuevo.

---

## 4. Usuarios y permisos (`views/users/**`, `UsersController`)

### 4.1 Tipos de usuario (`AppTables.user_type` + rol contacto)
| Tipo (es) | `role` | Qué puede | Cuenta en el plan |
|---|---|---|---|
| **Administrador** | `admin` | Todo, incluidos Ajustes, Usuarios, Mi Cuenta, CSV. El usuario #1 es el "Administrador Maestro": no se puede borrar, desactivar ni cambiar de tipo. | Sí |
| **Usuario** | `user` | Sólo los módulos que el administrador le habilite. | Sí |
| **Independiente (Photographer/Freelancer)** | `freelance` | Sólo su calendario y mensajes internos. Tiene enlace público de calendario. **Ilimitados y gratis**; sólo si hay módulo calendario. | No |
| **Contacto** (cliente) | `contact` | Área de Clientes (sección 8). No se gestiona desde Usuarios sino desde Contactos. | No |

Cuando se alcanza el límite de usuarios, el botón "Nuevo Usuario" pasa a "Nuevo Independiente" (si hay calendario) o abre "Límite alcanzado".

### 4.2 Ficha de edición de usuario (`users/edit.html`)
Datos: Nombre*, Apellido, Correo principal* (único), Correo secundario, Teléfono, Móvil, Cumpleaños, Género, DNI/NIE (`rg`), NIF (`cpf`), Empresa, Sobre, **Etiquetas**, **Activo** (si No, no aparece en las listas de responsables), **Notificaciones por mail** ("recibir un informe diario de notificaciones pendientes"), Contraseña + Confirmar (mín. 6), dirección con autocompletado por código postal, campos extra de contacto.

**Nivel de Acceso** y permisos (sólo para `user`; `stringAnd` con el plan):

| Permiso (es) | Clave | Visible si | Efecto |
|---|---|---|---|
| Permitir el acceso a los informes | `user_reports` | finanzas o ventas | Menús "Informes" de Ventas/Pedidos/Financiero; estado `reports`. |
| Acceso limitado sólo a sus propios artículos | `user_access_itens_only` | siempre | Ver 4.3. |
| Administración de calendario | `user_calendar` | calendario | Gestiona los calendarios de todos. |
| Ver el Calendario de otros usuarios (solo visualización) | `user_calendar_read_only` | calendario y no admin de calendario | |
| Acceso a contactos → Crear / Borrar | `user_contacts`, `_create`, `_delete` | siempre | Menú Contactos, botones Nuevo/Borrar, alta rápida desde otras fichas. |
| Acceso a Ventas → Crear / Borrar | `user_sales`, `_create`, `_delete` | ventas | Oportunidades **y Pedidos** (el mismo permiso cubre ambos), acciones masivas de borrado. |
| Editar Contratos / Descripción de productos | `user_agreements_edit` | ventas + avanzado | Si No, la descripción de ítems queda de sólo lectura y no puede clonar plantillas de contrato. |
| Acceso a Proyectos → Crear/Editar / Borrar | `user_projects`, `_create`, `_delete` | proyectos | Sin "Crear/Editar" no puede cambiar etapas del Progreso. |
| Acceso al Financiero → Crear retroactivo / Borrar | `user_finance`, `_create`, `_delete` | finanzas | "Crear retroactivo" = cargar transacciones con fecha pasada. |
| Acceso a las pruebas | `user_proofs` | pruebas | |

Pestaña **SMTP Personalizado** (usuarios y admin): "Utilice la configuración personalizada" (`smtp.custom_host`) → tipo **Gmail** (botón "Conectar con Gmail" por OAuth en `admin.alboomcrm.com/api/users/googleAuth`) u **Otros** (servidor, puerto, usuario, contraseña, cifrado) + "Probar configuraciones guardadas" (`/settings/test_smtp/:user_id`).

### 4.3 "Sólo lo mío" vs "Todos" (regla transversal)
- Los menús tienen pares "Mis X" (`itemUser = AppUser.id`) y "Todos los X" (`itemUser = 'all'`), para Oportunidades, Pedidos, Contratos, Proyectos, Pruebas; y "Mi embudo de ventas".
- Si `user_access_itens_only = 1` (y no es admin):
  - Se ocultan "Todos los…" y el filtro "Usuario".
  - Los listados **fuerzan** `user = AppUser.id` aunque la URL diga `all` (Leads, Orders, Projects, Proofs, Quotes…).
  - Al abrir un ítem ajeno (ni responsable `user_id` ni delegado `delegated_id`) aparece "Acceso restringido — La página requiere permisos extra".
- "Responsable" (`user_id`, "Vendedor"/"Propietario") y "Delegado a" (`delegated_id`) son los dos vínculos usuario-registro; "Notifíqueme de cambios" (`follow_delegated`) avisa al responsable de cada modificación del delegado.
- Contactos no tienen dueño: el permiso es sólo de módulo.

### 4.4 Listado de usuarios (`users/index.html`)
Filtros por tipo (Todo, Usuario, Administrador, Independiente si hay calendario), búsqueda, columnas Nombre, Tipo, Activo (clic para activar/desactivar, salvo #1), Permisos (iconos: calendario admin, contactos, ventas, proyectos, finanzas), Último acceso. Acción masiva: Cambiar etiquetas. Cuadro "Acerca de los tipos de usuario". Vista de usuario (`users/view.html`): datos, "Enviar e-mail", **Enlace del Calendario** público `/calendar/view/{unique_id}`, SMTP, contadores clicables (Oportunidades, Presupuestos, Pedidos, Contratos, Proyectos, Pruebas del usuario) y pestañas Notas / Mensajes / Actividad / Adjuntos.

### 4.5 Perfil propio (`profile`, `profile_edit`, `profile_freela`)
El usuario ve/edita sus datos (sin permisos), SMTP (sólo lectura), vincular/desvincular **Facebook**, contadores de sus registros. El freelancer tiene su propia variante.

### 4.6 Inicio de sesión
- `login.html`: correo + contraseña (mín. 6) + "Mantenme conectado"; recuerda el último correo; "¿Olvidó la contraseña?" (correo `reset_password`). Selector EN/ES/PT/PT-BR. Si el subdominio no existe: "No se puede conectar a la base de datos".
- Parámetros: `?uid={unique_id}` = **primer acceso** (invitación): saluda por nombre y pide crear contraseña ("Guardar Contraseña e Iniciar"). `?quicklogin={unique_id}` = **entrada directa sin contraseña** usada por soporte de Alboom desde el backoffice ("Inicio rápido"): la "contraseña" enviada es el propio `unique_id` ⇒ riesgo de seguridad si el id se filtra.
- `general_login.html`: pide el nombre de cuenta y redirige al subdominio; "¿Olvidó su nombre de usuario?".
- Facebook: clientes pueden registrarse/entrar con Facebook (`modal_signin`, `modal_signin_fb_email_pass`); usuarios pueden vincular Facebook. Existe `googleLogin` (OAuth implícito) sin botón visible.
- Cada inicio/cierre de sesión queda en Actividad ("X has logged in/off"), salvo el quicklogin.

**Mejora propuesta (usuarios)**
- Roles con plantillas (Administrador, Vendedor, Editor, Asistente, Fotógrafo externo) editables por matriz módulo × acción (ver/crear/editar/borrar/exportar), en vez de interruptores sueltos. Separar permiso de Oportunidades y de Pedidos (hoy es el mismo).
- Alcance por registro: "propios", "de mi equipo", "todos".
- Invitación por correo con enlace de un solo uso y vencimiento (en vez de `uid` permanente); nunca "quicklogin" con id fijo: usar suplantación auditada con tiempo límite.
- Fotógrafos externos con app/agenda y confirmación de asignaciones (encaja con Coberturas de FOTOFFICE).

---

## 5. Motor de plantillas y catálogo de mensajes

### 5.1 Reglas del motor (`mail_render_vars`, `message_render_vars`)
- Marcador simple `[clave]` → valor.
- Bloque condicional: `[clave:start] … [clave:end]` se **elimina entero si la clave viene vacía** (ej.: mostrar "Tu código de acceso es [access_code]" sólo si la galería es privada).
- Siempre disponibles: `[company_name] [company_email] [company_website] [company_phone]` (del estudio) y `[user_name] [user_firstname] [user_lastname] [user_email]` (usuario conectado).
- `[email_signature]` se reemplaza por la plantilla "Firma"; si el cuerpo no la tiene, en correos nuevos desde una ficha se **agrega al final**.
- `[attaches_box]` = recuadro gris "Adjuntos:" con enlaces a los archivos de la plantilla.
- Límites del envío desde el navegador: hasta 6 destinatarios (Para+CC), 3 CCO, adjuntos manuales ≤ 7,5 MB en total; reCAPTCHA invisible antes de enviar.
- Todo envío se guarda en "Mensajes" de la ficha (`/mails/save`) con tipo, destino, cuerpo y nombres de adjuntos.

### 5.2 Correos del sistema (21) — cuándo se envían y variables
"Auto" = lo dispara el servidor/proceso (inferido por el texto de ayuda); "Manual" = se abre el panel "Enviar correo" pre-cargado y el usuario lo revisa y envía.

| Grupo (menú) | Plantilla (pestaña) | Clave | Cuándo | Destinatario | Variables específicas (además de cliente/estudio) | Adjuntos |
|---|---|---|---|---|---|---|
| Firma | Firma del correo electrónico | `signature` | Se agrega a todos los correos | — | `user_*`, `company_*` (sin asunto) | No |
| Sistema | Restablecer contraseña | `reset_password` | Auto al pedir "¿Olvidó la contraseña?" | Usuario o cliente | `[link]` para restablecer, `[email_signature]` | No |
| Oportunidades y Presupuestos | Notificación de Nueva Oportunidad | `newlead_notif` | Auto al llegar una oportunidad del formulario | **Usuario** del estudio | `[lead_category] [event_date] [event_place] [event_city] [event_state] [message] [lead_link] [lead_number]` | No |
| | Respuesta automática | `autoreply` | Auto tras el formulario si "Respuesta" = Respuesta automática | Cliente | `[pricelist_link]` | No |
| | Presupuesto Estándar Master | `default_quote` (+`default_quote_{categoría}`) | Auto tras el formulario si "Respuesta" = Presupuesto Estándar; o manual desde la oportunidad | Cliente | `[lead_number] [attaches_box] [pricelist_link]` | Sí |
| | Presupuesto personalizado | `custom_quote` | Manual al enviar un presupuesto armado | Cliente | `[quote_number] [lead_number] [link]` (presupuesto online) `[attaches_box] [pricelist_link]` | Sí |
| | Seguimiento | `followup` | Auto `followup_days` días después de enviar un presupuesto | Cliente | `[lead_number] [pricelist_link]` | No |
| Pedidos | Acceso a la Área de Cliente | `order_access` | Manual desde Pedido o Contacto ("Enviar acceso") | Cliente | `[link]` (acceso `…/login?uid=`), `[order_number]` | No |
| | Factura | `order` | Manual desde el pedido | Cliente | `[link]` factura, `[order_number]` | No |
| Contratos | Contrato | `agreement` | Manual desde el contrato | Cliente | `[link]` (`/agreement/{unique_id}` para ver/firmar), `[order_number]` | No |
| Galerías de pruebas | Activación | `proof_access` | Manual al activar/compartir la galería | Cliente | `[link] [deadline] [proof_name] [proof_type]` (Selección / Aprobación de álbum) `[access_code]` y `[gallery_index]` (condicionales) | No |
| | Recordatorio | `proof_fup` | Auto en los días de `proof_fup_days` | Cliente | `[days]` para vencer, `[link] [deadline] [proof_name]` | No |
| | Selección finalizada | `proof_done` | Auto al terminar la selección | Cliente | `[selection_list] [link] [proof_name]` | No |
| | Aprobación del álbum | `approv_done` | Auto al aprobar/pedir cambios | Cliente | `[selection_list] [link] [proof_name] [status]` (Aprobado / Cambios solicitados) | No |
| | Aprobación de video | `video_done` | Auto idem video | Cliente | idem | No |
| | Informe de finalización | `proof_completion` | Auto al terminar selección/aprobación | **Usuario** | `[user_*] [link] [selection_list] [proof_name] [proof_number] [status]` | No |
| Calendario | Confirmación de Cita - Cliente | `event_confirmation` | Al crear/editar cita con "Enviar confirmación = Sí" | Cliente | `[appointment_name] [appointment_location] [appointment_start_date] [appointment_end_date] [appointment_all_day] [appointment_details]` | No |
| | Confirmación de Cita - Usuarios | `event_confirmation_user` | Al crear/editar si `event_alert_message = 1` | Participantes | `[participant_name/firstname/lastname] [calendar_link]` + datos de cita | No |
| | Cancelación de cita - Usuarios | `event_cancellation_user` | Al cancelar | Participantes | idem | No |
| | Email de cumpleaños - Cliente | `birthday_mail_customers` | Auto el día del cumpleaños si `bday_enabled` | Cliente | cliente + `[company_name]` | No |
| Financiero | Recordatorios de vencimiento | `boleto_reminder` | Auto N días antes del vencimiento (métodos con recordatorio); también manual | Cliente | `[order_number] [payment_document_type] [payment_document_number] [payment_date] [payment_amount] [instructions] [payment_link]` | No |
| | Correo de justificante (recibo) | `receipt` | Manual desde la transacción | Cliente | `[link]`/`[receipt_link] [receipt_number]` | No |

Variables de cliente comunes: `[customer_name] [customer_firstname] [customer_lastname] [customer_company] [customer_email] [customer_mobile]` (en contratos y personalizadas también dirección, teléfono, documentos).
Plantillas internas sin pantalla: `receipt_whats` (recibo por WhatsApp), `confirmation_link`, `welcome`, `welcome_{idioma}` (alta de cuentas Alboom).

### 5.3 WhatsApp
- Panel "Enviar WhatsApp": Para (con prefijo país), pestañas "Estándar" / "Modelos", texto, ayuda de formato (`*negrita*`, `_cursiva_`), Cancelar/Enviar.
- Enviar = abre `https://api.whatsapp.com/send?phone=…&text=…` y guarda el mensaje en Mensajes.
- Se abre desde fichas (`newWhatsAppMessage(model, id)`), compartir presupuesto (enlace al presupuesto online), recibo (`receipt_whats`) y "Reenviar" en Mensajes.

### 5.4 Variables de contrato (`settings/agreements.html`)
- **Cliente:** `[customer_name] [customer_firstname] [customer_lastname] [customer_email] [customer_company] [customer_address] [customer_address2] [customer_city] [customer_state] [customer_zipcode] [customer_country] [customer_phone] [customer_mobile] [customer_doc1]` (identificación) `[customer_doc2]` (NIF) `[customer_extra1..4] [customer_date1..2]`.
- **Contratante 1 y 2** (dos firmantes, ej. novios o padres): `[contractorN_name|firstname|lastname|email|company|address|address2|city|state|zipcode|country|phone|mobile|doc1|doc2|extra1..4|date1..2|signature]` (N = 1, 2).
- **Pedido:** `[order_number] [order_items]` (lista de productos) `[order_total_amount] [order_details_amount]` (detalle) `[order_pay_number]` (cantidad de cuotas) `[order_pay_sched]` (cronograma de pagos) `[order_memo] [extra1..4] [date1..2]`.
- **Estudio/usuario:** `[my_name] [my_firstname] [my_lastname] [my_email] [company_name] [company_trade_name] [company_email] [company_website] [company_phone] [company_address] [company_address2] [company_city] [company_state] [company_zipcode] [company_country] [company_doc2] [company_signature] [current_date] [pricelist_link]`.
- **Bodas** (perfil bodas): `[wedding_date] [wedding_time] [wedding_bride] [wedding_groom] [wedding_ceremony_place] [wedding_reception_place] [wedding_city] [wedding_state] [wedding_country] [wedding_guests]`.
- **Eventos:** `[event_name] [event_date] [event_time] [event_place] [event_city] [event_state] [event_country] [event_guests]`.
- **Otros trabajos:** `[job_name] [job_date] [job_time] [job_place] [job_city] [job_state] [job_country]`.
- **Otros:** `[page_break]` (salto de página al imprimir), `[agreement_id]`.

**Mejora propuesta (comunicación)**
- Un solo motor con sintaxis `{{cliente.nombre}}` y autocompletado al escribir, vista previa con un registro real y validación de variables inexistentes.
- Bloques condicionales como en Alboom (muy útil) pero también "si/si no".
- Correos automáticos con **registro de entrega** (enviado, rebotado, abierto) usando webhooks de Resend, y una pantalla "Automatizaciones" que liste todos los disparadores en un solo lugar con interruptor (hoy están dispersos en 6 pantallas).
- Variables de contrato con "congelado" explícito (el contrato guarda una copia) — mismo comportamiento que Alboom, pero avisando qué datos cambiaron desde que se generó.

---

## 6. Navegación

### 6.1 Menú lateral completo (`views/common/navigation.html`)
Encabezado: logo del estudio (o de Alboom) y menú del usuario. Ítems (según rol/módulo):

| Ítem (es) | Submenú | Condición |
|---|---|---|
| (aviso) "Em Teste de Migração" | abre modal de migración a PhotoManager | cuenta migrada |
| **Inicio** | — | todos |
| **Calendario** | — | `modules.calendar` y usuario/admin |
| **Contactos** | Crear Nuevo · Contactos · (Cumpleaños, Aniversarios: ocultos con `&& false`) | admin o `user_contacts`; no en subdominio admin |
| **Oportunidades** | Crear Nuevo (o corona si superó límite) · Mis Oportunidades (contador de vencidas) · Todas las oportunidades (contador) · Mi embudo de ventas · Presupuestos · Informes | `modules.sales` |
| **Productos** | Crear Nuevo (admin) · Productos (admin) · Lista de precios | `modules.sales` |
| **Pedidos** | Crear Nuevo · Pedido Rápido · Mis Pedidos · Todos los pedidos · Mis Contratos · Todos los Contratos · Informes (o Informes de pedidos / Informes de IVA si IVA) · Facturas (si IVA) | `modules.orders` |
| **Proyectos** | Crear Nuevo (o límite) · Mis Proyectos (vencidos) · Todos los Proyectos (vencidos) | `modules.projects` (en plan free: mismos ítems llevan a venta) |
| **Aplicaciones de Galería** | Nueva Aplicación (o límite) · Aplicaciones | `modules.proofs` |
| **Pruebas** | Nueva Prueba · Mis pruebas · Todas las pruebas (vencidas) | `modules.proofs` |
| **Financiero** | Cuentas Bancarias · Transacciones · Cuentas por Cobrar (Por cobrar · Recibidas · Por Cliente) · Cuentas por Pagar (Por pagar · Pagado · Por Proveedor) · Informes (Resultados · Resultados de Ventas [avanzado] · Flujo de caja) | `modules.finance` (en free: todo lleva a venta) |
| "Como Implantar" | — | idioma portugués |
| **Soporte** | Tutoriales (Primeros pasos · Plan Estándar/CRM Pro · Módulo Comercial · Proyectos · Calendario · Finanzas · Pruebas · Aplicaciones de Galería) | usuario/admin |
| *(Cliente)* Sus galerías · Galerías Públicas · Proyectos · Presupuestos · Pedidos · Contratos · Por pagar · Pagado · video "Cómo seleccionar y aprobar" | — | `role == contact` + interruptores del Área de Clientes |
| *(Backoffice Alboom)* Suscriptores · Informes (Nuevas Cuentas · Activaciones · Renovación) | — | subdominio `admin` |

Ajustes **no** está en el menú lateral: está en el menú del usuario (barra superior).

### 6.2 Barra superior (`topnavbar.html`)
- Avisos: "Serás desconectado por inactividad en N segundos"; "Actualización disponible → Reiniciar"; cobro fallido ("No pudimos procesar tu factura… Actualizar detalles"); cuenta pasada a gratuita por falta de pago; banners promocionales.
- Nombre del estudio (lápiz → Información Comercial).
- Menú del usuario: **Perfil**, **Ajustes**, **Mi Cuenta** (sólo admin), **Idioma** (lista), **Cerrar sesión**.
- Iconos con contadores (usuario/admin):
  - Oportunidades expiradas (mías, con fecha de siguiente acción vencida) → listado filtrado `itemExpired: true`.
  - Proyectos expirados (míos).
  - Pruebas expiradas (todas).
  - Nuevos mensajes (addon_mail; número fijo "16": no funcional).
  - **Tareas pendientes** (addon_tasks) → panel de tareas.
  - **Notificaciones** (no leídas) → panel de notificaciones.
- Los contadores vienen de `GET /settings/due/{user}/user` (`dbStatus`).

### 6.3 Buscador global
**No existe.** Sólo búsqueda por listado (con "Busca en todos los campos, incluidos los adicionales; para fechas use aaaa-mm-dd"). Tampoco hay atajos de teclado (sólo doble clic para editar una tarea y Enter en formularios).
**Mejora:** el buscador ⌘K de DNX (ya diseñado) debería buscar contactos, oportunidades, pedidos, proyectos, galerías y acciones ("nuevo pedido", "ir a Ajustes → Plantillas").

### 6.4 Paneles laterales globales (`content.html`)
| Panel | Contenido | Detalle |
|---|---|---|
| **Tareas** (`sidebar_tasks`) | Escribir tarea + Enter; filtros Todas/Pendientes/Completadas; "Borrar completadas"; cada tarea: casilla completar, título, enlace al registro de origen (`#/{tipo}/view/{id}`), responsable (si ves todas), vencimiento, editar (Tarea, Vencimiento, Propietario) y borrar; "Mis tareas / Las tareas de todos los usuarios"; en una ficha: "Todas las tareas / Tareas de este ítem"; doble clic edita; arrastrar reordena; "Cargar más". | Las tareas automáticas de embudos/flujos/pedidos llegan aquí ligadas al registro. |
| **Notificaciones** (`sidebar_notifications`) | "N notificaciones sin leer", Marcar todos como leídos, Borrar todos, lista con texto, "hace X por Fulano", marcar leída/borrar, scroll infinito. | Tipos vistos: 4 (cita asignada), 5 (alarma de cita); asignación/delegación de oportunidades y proyectos, cambios. |
| **Enviar Correo** (`sidebar_mail_compose`) | De, Para (varios con coma), CC/CCO (ícono), Asunto o selector de plantilla, cuerpo enriquecido, adjuntos, Cancelar/Enviar. | Ver 5.1. En plan free "Enviar" abre venta. |
| **Enviar WhatsApp** | Ver 5.3. | |
| **Obtener ayuda** (soporte) | De, Título, cuerpo, captura de pantalla, adjuntos. | Ticket a Alboom (`/support/createTicket`). |
| **Cita** (edición rápida) | General (nombre, lugar, inicio, fin, tipo, estado, clase, todo el día, detalles, origen), Participantes (usuarios, dueño), Contacto (cliente + alta rápida + "Enviar confirmación"), Alarma/Recurrente (2 alarmas, frecuencia diaria/semanal/mensual/cada 2 o 4 semanas, fin). | Si `calendar_sidebar_mode = 1`. |

### 6.5 Alertas de citas
En cada sondeo de notificaciones (5 min) se consulta `Events.alerts(user, hora local)`: por cada alarma vencida muestra un aviso rojo "Calendario: {cita} a las {hora} Contacto: {nombre} Teléfono … Móvil …" y crea una notificación tipo 5 con enlace a la cita.

### 6.6 Inicio (panel, `DashboardController`)
- Usuario/admin: "¡Bienvenido, {nombre}!" + **checklist de puesta en marcha** con % (teléfono en perfil, avatar, datos del estudio, flujos guardados) + tarjetas ocultables/reordenables recordadas en el navegador (`db_cards`): Tareas (Para hacer), Calendario (Próximos 7 días), Proyectos (Esta semana), Pruebas (Esta semana), Oportunidades (Esta semana), Cuentas por Cobrar, Cuentas por Pagar, Gráficos "Mis Proyectos" y "Mis Oportunidades" por estado (mío vs todos). Clic en una tarea abre el panel de tareas resaltándola.
- Cliente: "¡Hola, {nombre}!" + botones a sus secciones.
(La plantilla `views/dashboard/user.html` no está en el material; ver duda 12.)

**Mejora propuesta (navegación)**
- Menú agrupado por flujo de trabajo del fotógrafo (Captar → Vender → Producir → Entregar → Cobrar) y "Mis/Todos" como filtro guardado en vez de ítems duplicados.
- Bandeja única "Hoy": tareas, citas, seguimientos vencidos, cobros del día.

---

## 7. Componentes reutilizados (widgets)

### 7.1 Matriz de pestañas por ficha
| Ficha | Etiquetas | Info general | Específica | Notas | Mensajes | Actividad | Relacionados | Adjuntos |
|---|---|---|---|---|---|---|---|---|
| Contacto | ✔ (+avatar) | ✔ | — | ✔ | ✔ | ✔ | Contactos relacionados (parentescos) | ✔ |
| Oportunidad | ✔ | ✔ | **Embudo** | ✔ | ✔ | ✔ | Participantes | ✔ |
| Pedido | ✔ | ✔ | (costos/contratos) | ✔ | ✔ | ✔ | Participantes | ✔ |
| Proyecto | ✔ | ✔ | **Progreso** | ✔ | ✔ | ✔ | Participantes | ✔ |
| Prueba (galería) | ✔ | — | Clientes, Imágenes, Imágenes de álbum, Videos | ✔ | ✔ | ✔ | — | — |
| Producto | ✔ (+foto) | ✔ | Costos, Paquete | ✔ | — | ✔ | — | ✔ |
| Usuario | ✔ (+avatar) | ✔ | — | ✔ | ✔ | ✔ | — | ✔ |
| Cuenta bancaria | ✔ | ✔ | — | ✔ | ✔ | ✔ | — | ✔ |
| App de galería | ✔ | — | Opciones, Imágenes | ✔ | ✔ | ✔ | — | — |
| Detalle lateral de Oportunidad / Contacto | ✔ | — | **Línea de tiempo** | | | | | |

### 7.2 Comportamiento de cada widget
- **Etiquetas** (`item-tags`, `tag_cloud`): etiquetas libres por registro con autocompletado; al hacer clic en una etiqueta filtra el listado (`itemCategory = 'tag:NOMBRE'`); nube "Búsqueda por etiqueta" en listados; acción masiva "Cambiar etiquetas" con modo **Agregar** o **Reemplazar** (reemplazar vacío = quitar todas). `/tags`, `/tags/batch`.
- **Notas** (`notes-widget`): búsqueda, "Nueva Nota" con **Acción** (categoría de notas, obligatoria) + texto; lista con acción, tipo y número de registro, extracto de 100 caracteres expandible, fecha, "hace X", autor; editar/borrar. En plan free sólo últimos 30 días. Imprimible (proyectos).
- **Mensajes** (`messages-widget`): correos y WhatsApp enviados ligados al registro; ícono por tipo; asunto + extracto; expandir (De, Para, CC, CCO, Asunto, cuerpo, adjuntos); **Reenviar**; 30 días en free.
- **Actividad** (`activities-widget`): bitácora automática con búsqueda, enlace, tipo #id, texto, fecha y autor. 30 días en free.
- **Línea de tiempo** (`timeline-widget`, `timeline-user-widget`): versión compacta en el panel de detalle lateral; la del contacto mezcla actividades y otros tipos (`table_type`).
- **Contactos relacionados** (`related-widget`, `contact_related`): relaciones entre contactos con parentesco (padre, madre, hijo/a, hermano/a, esposo/a, tío/a, sobrino/a, cuñado/a, suegro/a, yerno/nuera, abuelo/a, nieto/a, prometido/a, primo/a, amigo/a, proveedor, cliente, empleado, empleador); "Agregar Relación".
- **Participantes** (`participants-widget`): contactos vinculados al registro con "Participando como" (categorías de Participantes) y Nota; alta rápida de contacto; modo borrador con Guardar/Deshacer. Imprimible.
- **Adjuntos** (`uploads-widget`): arrastrar y soltar múltiples archivos (≤10 MB c/u; total según plan); cola con procesar/subir/errores; miniaturas; Cancelar/Eliminar/Reemplazar si existe; "Borrar todos", "Cancelar todos", "Eliminar errores"; recomendación de Chrome; subida directa a S3 con política (`/uploads/policy/:max`), ruta `ups/{cuenta}/files/{tipo}/{id}/`.
- **Embudo** (`pipeline-widget`) y **Progreso** (`progress-widget`): barra de etapas clicable; al cambiar etapa pide Siguiente acción/Vencimiento, Estado (si no está "Abierto"/"No empezado"), Memo del cambio, **Tareas** a crear (precargadas desde la etapa, editables), Propietario (proyecto), Delegado, "Notifíqueme de cambios"; **Historial** (fecha, usuario, etapa, vencimiento, nota); en Progreso además **Proyección de Plazo** (barra por meses, tabla de etapas con días y fecha estimada; aviso si la fecha está vencida y se recalculó desde hoy).
- **Avatar/foto** (`image-crop-widget`): subir y recortar, borrar.
- **Transacciones** (`transactions-widget`): últimas transacciones de una cuenta.

**Mejora propuesta (widgets)**
- Unificar Notas + Mensajes + Actividad en una sola **línea de tiempo filtrable** (con opción de fijar notas), y agregar menciones @usuario que generen notificación.
- Adjuntos con carpetas/etiquetas, visibilidad para el cliente (portal) y versión.
- Participantes con rol + datos de contacto rápidos (WhatsApp/llamar) y reutilizables entre oportunidad → pedido → proyecto (hoy se cargan por separado).

---

## 8. Área de clientes, formularios públicos, integraciones, importación y exportación

### 8.1 Área de Clientes (portal)
- **Acceso**: el cliente es un contacto (`role = contact`). El estudio envía "Acceso a la Área de Cliente" (`order_access`) con enlace `…/#/login?uid={unique_id}`; en el primer ingreso crea su contraseña. También puede entrar con Facebook.
- **Inicio del cliente**: "¡Hola, {nombre}! Bienvenido a tu espacio… mantené tu perfil actualizado".
- **Perfil** (`contacts/profile`): datos personales; editar sólo si `customer_area_edit_profile`; avatar; desvincular Facebook.
- **Secciones** (según 3.33): Sus galerías (seleccionar/aprobar fotos, álbum, video; video tutorial), Galerías Públicas, Proyectos (estado), Presupuestos, Pedidos, Contratos (**ver y firmar online** `/agreement/{unique_id}`, `agreement_review.sign`), **Por pagar** (fecha, pedido, tipo, documento, memo, monto, "Ver instrucciones" del método de pago, "Pagar con PayPal"/"Pagar con PagSeguro" `/pay/{id}`, descarga de boleto) y **Pagado**.
- Documentos públicos sin sesión (`restrict: true`): presupuesto `print/quote/:unique_id`, pedido `print/order/:unique_id`, factura `print/invoice/:id`, contrato `print/agreement/:unique_id`, recibo `print/receipt/:id.{clave}`, lista de precios `/pricelist/{unique_id}`, calendario del usuario `calendar/view/:unique_id`, galerías `gallery.*`.
- **Mejora:** portal FOTOFFICE con enlace mágico (sin contraseña), todo en una línea de tiempo del trabajo ("tu boda": contrato → pagos → sesión → galería → álbum), pagos con Mercado Pago, subida de archivos del cliente y chat.

### 8.2 Formularios públicos
- Formulario de oportunidades (3.23) — iframe/URL/POST/JSON.
- Firma de contratos online (3.5, 5.4).
- Selección/aprobación de galerías (ver doc. de Galerías).
- Registro de nuevas cuentas Alboom (`register`, `register_pro`) — ver 9.

### 8.3 Integraciones encontradas
| Integración | Tipo | Dónde |
|---|---|---|
| Mailchimp | Clave API, listas y campos | Ajustes → Integraciones de terceros |
| Alboom Prosite | Clave API del suscriptor | Ajustes → Integración Alboom Prosite |
| Gmail | OAuth para enviar desde la casilla del usuario | Usuario → SMTP |
| SMTP propio | Servidor/puerto/usuario/clave | Usuario → SMTP (+ valores por defecto en Ajustes → Correo) |
| WhatsApp | Enlace `api.whatsapp.com/send` (no API) | Panel WhatsApp |
| Facebook | Inicio de sesión de clientes y vinculación de usuarios | Login / Perfil |
| Google | OAuth implícito (`googleLogin`) sin botón visible | UsersController |
| PayPal, PagSeguro, BoletoCloud | Cobro al cliente | Ajustes → Financiero, Área de Clientes |
| Stripe | Cobro de la suscripción del estudio | Mi Cuenta → Método de pago |
| Zendesk, LogRocket, Bugsnag, Google Analytics/GTM | Soporte y monitoreo | MainController |
| Zapier | **No aparece** en el código | — |

### 8.4 Importaciones CSV
- **Contactos** (`contacts/importCsv`): elegir **Categoría de contactos** destino; arrastrar CSV (**máx. 2000 filas** por vez); vista previa de las 10 primeras; columnas fijas: Nombre, Apellido, Email, Email 2, Dirección, Dirección 2, Ciudad, Provincia, Código postal, País, Sitio web, Teléfono, Móvil, Género, DNI, NIF, Cumpleaños, Extra 1–4, Fecha extra 1–2 (fechas AAAA-MM-DD); plantilla descargable `/downloads/contacts-sample-fields.csv`; "no insertar columnas nuevas". `POST /contacts/import/csv`.
- **Oportunidades** (`leads/importCsv`, requiere ventas): análogo, con campos extra de oportunidad (detalle en doc. de Oportunidades).
- En el listado, el botón "CSV → Importar CSV" sólo lo ve el administrador.

### 8.5 Exportaciones
- Botón **CSV → Exportar en CSV** (sólo admin) en: Contactos, Oportunidades, Presupuestos, Pedidos, Facturas, Proyectos, Productos, Pruebas (y vencidas), Calendario (lista), Transacciones, Cuentas por cobrar/pagar (y pagadas, por cliente) e informes (Ventas, IVA, Oportunidades, Resultados, Resultados de Ventas, Flujo de caja, Diario; backoffice: Nuevas cuentas, Activaciones, Renovación).
- Mecánica: vuelve a pedir el listado con los **mismos filtros** y `pageSize 999999`, `csv_mode=1`; archivo `{modelo}.csv`; separador según idioma (`;` en español).
- **Impresión**: "Imprimir → Resumen" abre `print.{modelo}_summary` con todos los filtros en la URL; hay versión detallada (`print.{modelo}`) y ficha individual (`print.lead`, `print.project`…). Pie "©año, {estudio}. Impreso usando Alboom CRM".

**Mejora propuesta (datos)**
- Importador genérico con **mapeo de columnas** (arrastrar la columna del archivo al campo), detección de duplicados por correo/teléfono con opción fusionar, prueba en seco y deshacer importación. Clave para la **migración desde Alboom**.
- Exportación a Excel (xlsx) además de CSV, con columnas elegibles; exportación completa de la cuenta (ZIP) para cumplimiento de datos personales.

---

## 9. Mi Cuenta, suscripción y referidos (modelo comercial, breve)

- **Mi Cuenta** (sólo admin): Panel · Actualización (Upgrade) · Método de pago · Mis Compras · (Mis facturas, oculto) · Recompensas (sólo planes 1/2).
- **Panel**: plan actual (Lite si prueba), vencimiento y monto mensual, avisos de cuenta bloqueada (pasa a Lite/CRM Free por falta de pago; tras 30 días "contactar soporte"), uso vs. disponible: Usuarios, Oportunidades y Pedidos (en CRM Free), Proyectos abiertos, Imágenes, Aplicaciones de Galería, Videos (YouTube/Vimeo) y Videos alojados; estadísticas (contactos, usuarios, freelancers, proyectos, imágenes, apps, videos, oportunidades, presupuestos, pedidos, citas).
- **Planes vistos**: CRM **Free** (1 usuario, contactos/calendario/tareas ilimitados, embudo, presupuestos y seguimiento automático, publicidad "Alboom Ads", **25 oportunidades, 5 pedidos, historial 30 días**) vs **CRM Pro** (todo ilimitado + Finanzas + Proyectos + historial ilimitado + sin anuncios + chat), mensual o anual, precio por cantidad de usuarios (más de 15 → ventas). Planes Estándar/Lite (ids 1/2) con "Marketplace" de productos arrastrables (recursos extra: usuarios, módulos) y simulación del nuevo total. Monedas BRL/USD/EUR. Cupones de descuento. Pago con tarjeta vía Stripe.
- **Recompensas/referidos**: enlace único `https://www.alboomcrm.com/{idioma}/a/{id}`; en Lite cada amigo que crea cuenta suma +1 proyecto, +50 imágenes, +1 app (máx. 20 amigos, deben seguir activos); en Estándar se gana `comission`% de lo que paguen los referidos, acreditado en la cuenta o retirable por PayPal. Pantallas Mi enlace (compartir en Facebook/Twitter/Google+), Mis amigos, Mis recompensas (comisiones por cobrar/recibidas).
- **Backoffice** (`admin.alboomcrm.com`): Suscriptores (alta/edición de cuentas, compras, facturas, mapa, "Inicio rápido" a cualquier cuenta), informes Nuevas cuentas / Activaciones / Renovación.

**Mejora:** FOTOFFICE cobra por institución/plan; reutilizar la idea de "uso vs. límite" en un panel claro y el programa de referidos (ya previsto en SubiLaFoto/Clickatón).

---

## 10. Convenciones generales de listados (para replicar de forma uniforme)

| Aspecto | Cómo lo hace Alboom | Detalle técnico |
|---|---|---|
| **Estructura** | Encabezado con título + migas (Inicio › Módulo); botón principal "Nuevo X" (o con corona si límite); menú CSV (admin); menú Imprimir; título dinámico con los filtros activos ("Todas • Embudo X • Etapa Y • Origen • Período • Usuario • Clase"). | `views_main.html` (Oportunidades) como patrón. |
| **Filtros** | Botones desplegables: Estado/Categoría, Embudo, Etapa (deshabilitado hasta elegir embudo, con tooltip), Período (tabla de períodos + "Otro período" con rango), Usuario (oculto si "sólo lo mío"), Origen, Clase (si clases activas), etiqueta (nube). | Cada filtro es un **parámetro de la URL** (`itemCategory`, `itemPipeline`, `itemStage`, `itemUser`, `itemOrigin`, `itemClass`, `itemPeriod`, `itemExpired`, `itemStatus`…). |
| **Recordar filtros** | Si la URL no trae el filtro, se usa el último elegido guardado en el navegador por módulo. | `$localStorage.{modulo}_itemCategory`, `_itemClass`, `_itemPipeline`, `_itemStage`, `_itemOrigin`, `_itemPeriod`, `_itemStartDate/EndDate`, `period`, `start_date`, `end_date`, `class_id`… |
| **Búsqueda** | Caja "Buscar" que busca en todos los campos (incluidos extra). Se dispara al escribir con espera de 500 ms y a partir de 2 caracteres (o al borrar). Fechas en aaaa-mm-dd. | `debounce(…, 500)`; vuelve a página 1. |
| **Orden** | Clic en el encabezado de columna; segundo clic invierte; flecha indicadora; tooltip "Haga clic en el nombre de la columna para ordenar. Haga clic en la fila para ver más información." | Guardado por módulo: `{modulo}_sortBy`, `{modulo}_reverseSort`. Se envía `sortBy`, `sortDir ASC/DESC`. |
| **Paginación (tablas)** | Pie con "Elementos por página 10/25/50/100", paginador, "Mostrando X a Y (N totales)", "No se encontraron resultados". | `pageSize` **global** para todos los listados (`$localStorage.pageSize`); `pageNumber`; endpoint `/{modelo}/paginate` devuelve `{rows, count}`. |
| **Paginación (widgets/listas secundarias)** | Scroll infinito de 50 en 50: "Cargando…", "Desplácese para ver más". | `offset`/`count` en la URL del recurso. |
| **Maestro-detalle** | En escritorio, clic en la fila abre un **panel de detalle** a la derecha (la tabla se angosta y oculta columnas); segundo clic en la misma fila abre la ficha completa. En pantallas < 1025 px va directo a la ficha. | Estados `*.index.details` → `*.view`. |
| **Acciones por fila** | Íconos Ver / Editar / Clonar / Borrar (según permiso) + menú desplegable con lo mismo. Contacto del cliente visible al pasar el mouse. | Borrar exige `user_{modulo}_delete` o admin. |
| **Selección masiva** | Casilla por fila + "seleccionar todo" de la página; aparece menú de acciones: (Oportunidades) Editar fecha de la siguiente acción, Editar prioridad, Finalizar oportunidades, Cambiar usuarios, Cambiar etiquetas, Cambio de embudo, Borrar; (Usuarios) Cambiar etiquetas; (Contactos) cambiar categoría/tipo, etiquetas, borrar. | `batch_*` endpoints (`/contacts/batch_type`, `/tags/batch`, `/…/batch_delete`). La selección es sólo de la página visible. |
| **Contadores de vencidos** | En menú y barra superior (oportunidades con siguiente acción vencida, proyectos y pruebas vencidas). | `/settings/due`. |
| **Impresión** | Resumen y detalle con los filtros en la URL; logo según `logo_print_hpos`; pie estándar. | Estados `print.*`. |
| **CSV** | Sólo admin; mismos filtros; todo el conjunto (no sólo la página). | `ng-csv`, separador por idioma. |
| **Vacío / carga** | "No hay filas a mostrar", "Cargando…", indicador global de carga en cada llamada. | `loader_show/hide`. |
| **Permisos en listas** | Botones y columnas se ocultan por permiso; "sólo lo mío" fuerza el filtro de usuario. | Ver 4.3. |

**Mejora propuesta (listados FOTOFFICE)**
- Un componente único de tabla con: filtros como "chips" removibles, **vistas guardadas con nombre** (compartibles con el equipo), columnas configurables, selección "todos los N resultados" (no sólo la página), acciones masivas uniformes, exportar CSV/Excel con permiso propio (no sólo admin), impresión/PDF, y URL compartible que reproduzca exactamente la vista.
- Guardar preferencias por usuario en servidor (no en el navegador) para que sigan en otro dispositivo.
- Tamaño de página por listado (no global).

---

## 11. Defectos y riesgos detectados en Alboom (para no copiarlos)

1. Plantillas de WhatsApp personalizadas **no reemplazan variables**.
2. El WhatsApp se registra como "enviado" apenas se abre el enlace, aunque el usuario no lo mande.
3. `quicklogin` usa el `unique_id` como contraseña; el enlace de acceso de clientes (`?uid=`) no vence.
4. Permisos (`AppUser.modules`) calculados en el navegador.
5. Endpoint público `/api/leads/add` sin clave ni anti-spam.
6. `module_finances_or_sales` (con "s") no existe ⇒ "Métodos de pago" nunca se bloquea; `classes_in_fanances` mal escrito.
7. Aplicación Móvil comparte campos con Información Comercial (editar uno cambia el otro sin avisar).
8. "Integraciones de terceros" dice mostrar la clave API pero sólo tiene Mailchimp.
9. Ícono de "Nuevos mensajes" con número fijo (16).
10. Notificaciones y actividad generadas desde el navegador.
11. Un mismo permiso "Ventas" cubre oportunidades y pedidos.
12. Activar el correo de cumpleaños **pisa** la plantilla editada con el texto por defecto.

---

## 12. Dudas para verificar en vivo

1. `Ajustes` desde el menú del usuario (`link: 'dashboard'`): ¿qué muestra exactamente? (no está `settings/dashboard.html`).
2. `Nombre Comercial` (`company`) vs `Nombre del estudio` (`site_name`): ¿cuál sale como `[company_name]` y cuál como `[company_trade_name]` en contratos? (el texto de ayuda sugiere lo contrario al nombre del campo).
3. Correos automáticos (autoreply, presupuesto estándar, seguimiento, recordatorios de prueba y de vencimiento, cumpleaños, selección finalizada): confirmar que efectivamente salen, a qué hora y desde qué remitente (¿`noreply@alboomcrm.com` o SMTP del usuario?).
4. `email_bcc`: ¿la copia llega al usuario remitente o al correo del estudio?
5. "Notificación de Nueva Oportunidad": ¿a quién va (usuario por defecto o todos los admin)?
6. Métodos de pago: qué hace "¿Ocultar?" (¿oculta en el portal, en el selector o en informes?) y cuáles vienen bloqueados en una cuenta argentina.
7. ¿Hay más tipos de categorías no expuestos en el menú (por ejemplo prioridades de oportunidades)?
8. Numeración: ¿qué pasa si se intenta un número menor? ¿mensaje de error o se ignora?
9. Área de Clientes: ¿"Mostrar Calendario" tiene alguna pantalla para el cliente? (no hay ítem de menú para el contacto).
10. Firma online: flujo completo del cliente (¿pide correo/DNI? ¿envía copia firmada?).
11. Sesiones: ¿cuánto dura una sesión "Mantenme conectado"? (`expires_at`).
12. Contenido de `views/dashboard/user.html` (panel de inicio del usuario) y de `leads/sidebar_leads.html`, `calendar/sidebar_calendar_view.html` (faltan en el material).
13. Plantilla `order` ("Factura"): desde qué botón exacto se envía y si adjunta PDF.
14. ¿Existe exportación completa de la cuenta o API de lectura para migrar (además de CSV por módulo)? La clave API de Prosite: ¿sirve para leer datos?
15. Mailchimp: ¿sincroniza sólo altas nuevas o también ediciones/históricos? ¿se puede forzar sincronización masiva?
16. Formulario: con "Formulario personalizado" desactivado, ¿qué campos muestra por defecto?
17. Recordatorios de vencimiento: ¿se envía uno solo o se repite? ¿el "usuario por defecto" recibe copia o notificación?

---

## 13. Anexos

### 13.1 Endpoints transversales (de `endpoints.txt` y fábricas de `app.js`)
- `/settings/` (GET/POST), `/settings/info`, `/settings/mail_templates`, `/settings/custom_mail_templates`, `/settings/custom_messages_whatsapp`, `/settings/custom_form_lead`, `/settings/numbering`, `/settings/quotes`, `/settings/due/:id/:type`, `/settings/test_smtp/:user_id`, `/settings/update_apikey`, `/settings/update_field/:field`, `/settings/get_field/:field`, `/settings/erase_finance`.
- `/categories` (+ `/list`, `/payments`, `/stages`, `/save_workflow`, `/clone_workflow`), `/stages/list`, `/eventtypes`.
- `/users` (+ `/login`, `/paginate`, `/list/:type`, `/info/:id`, `/projects/:id`, `/related/:id`, `/get_by/:field/:value`, `/set_active/:id/:active`, `/batch_delete`, `/batch_type`, `/recover_password`, `/reset_password`, `/set_validation_code/:id`, `/fb_check_id`, `/fb_check_login`, `/fb_add_check_login`, `/check_login`, `/add_check_login`, `/:id/smtp_host`).
- `/sessions` (GET, DELETE `/:id`).
- `/activities` (+ `/paginate`), `/notes` (+ `/paginate`), `/notifications` (+ `/set_all_read`, `/del_user`), `/tasks` (+ `/sort`, `/del_completed`, `/set_date/:id`), `/tags` (+ `/batch`, `/pipeline`), `/uploads/policy/:max_filesize`, `/attaches`, `/mails/send`, `/mails/save`, `/mails/{modelo}/{id}/{offset}/{count}`.
- `/mailchimp/getLists`, `/mailchimp/lists`, `/mailchimp/lists/:api_key`.
- `/contacts/import/csv`, `/contacts/get_to/:model/:id`.
- Públicos: `/api/leads/add`, `/form_lead/#/index`, `/pricelist/{unique_id}`, `/agreement/{unique_id}`, `/pay/{id}`, `/calendar/view/{unique_id}`.
- Suscripción: `/subscribers/*` (register, products/:type/:plan, invoices, get_rewards, get_friends, update_last_login…), `/purchases/save`, `/cupoms/get_by/:field/:value`, `/support/createTicket`.

### 13.2 Claves de configuración (resumen por pantalla)
`site_name, company, phone, cellular, site_email, site_url, social_facebook, social_twitter, social_instagram, address1, address2, city, state, zipcode, country, cnpj` · `logo_print, logo_print_hpos, logo_print_agreement_hpos, logo_screen, logo_form, mobile_logo, watermark, signature` · `default_language_autodetect, default_language, currency, currency_singular, currency_plural, currency_prepend` · `signature_offset, signature_online, signature_online_typed_only` · `email_bcc, smtp_host, smtp_port, smtp_ssl` · `mailchimp_api, mailchimp_api_key, mailchimp_default_list, mailchimp_default_category, mailchimp_relation_active` · `user_/lead_/order_/project_ extra1..4, date1..2` · `classes_active, classes_in_calendar|contacts|leads|orders|projects|finances` · `MailTemplates.{clave}.{subject,body,files}, bday_enabled` · `proof_reducing, proof_max_x, proof_max_y, proof_metadata, proof_show_rating, proof_sort_rating, proof_use_meta_choices, proof_rating_choices, proof_label_choices, proof_show_labels, proof_label_text, proof_label_6..10, watermark_vpos, watermark_hpos, watermark_margin, proof_fup_days` · `mobile_background_color, mobile_color` · `projects_print_participants|related|history|projection|notes` · `quote_payment_conditions, quote_general_conditions` · `form_lead_pipeline_id, default_lead_user, notify_form_lead, form_lead_reply, form_lead_show_header, form_lead_contact, form_lead_sent_message, form_lead_redirect_url, custom_form.*` · `lead_origin, followup_days` · `products_min_price` · `order_account_other_expenses, order_account_discount, order_edit_blocked, vat_active, vat_percentage, price_include_vat, vat_account, vat_header` · `calendar_sidebar_mode, alert1_minutes, alert2_minutes, event_alert_message, date_week_start, timezone_active, timezone` · `boleto_reminder, boleto_reminder_days, default_reminder_user, boleto_token_api_user, boleto_token_api_banco, paypal_email, paypal_currency_code, pagseguro_email, pagseguro_currency_code` · `customer_area_edit_profile, customer_area_proofs, customer_area_proofs_public, customer_area_projects, customer_area_calendar, customer_area_quotes, customer_area_orders, customer_area_agreements, customer_area_ar` · numeración: `leads, quotes, orders, invoices, agreements, projects` · indicadores: `workflows_saved, proof_settings_saved`.

### 13.3 Tablas fijas (`AppTables`)
- Estados de Oportunidad: 421 Abierto, 422 Ganado, 423 Suspendido, 424 Abandonado, 425 Perdido, 426 Fecha no disponible.
- Estados de Proyecto: 200 No empezado, 201 En Proceso, 202 Cancelado, 203 Suspendido, 204 Listo.
- Estados de Pedido: 471 Abierto, 474 Cancelado, 475 Venta Completada, 476 Pedido Rápido (oculto).
- Estados de Cita: Agendado, Confirmado, En curso, Reprogramado, Realizadas, Anulado.
- Tipos de galería: S Selección de fotos, A Aprobación del álbum, V Aprobación de video.
- Grupos de presupuesto: Boda (sólo perfil bodas), Evento, Trabajo con fecha, Trabajo sin fecha.
- Períodos (listados): Todo, Esta semana, Semana pasada, Este mes, Mes pasado, Últimos 3/6 meses, Este año, Año pasado, Otro período; variantes futuras (Vencidas, Hoy, Próxima semana/mes/3/6 meses, Próximo año) para cobros.
- Intervalos de pago: mensual, semanal, cada 2 semanas, cada 15 días, cada 4 semanas, cada 30 días, bimestral, trimestral, semestral, anual.
- Recurrencia de citas: diaria, semanal, mensual, cada 2 semanas, cada 4 semanas.
- Tipos de cuenta bancaria: 1000 Corriente, 1001 Caja, 1002 Ahorro, 1003 Otros.
- Monedas de suscripción: BRL, USD, EUR.
