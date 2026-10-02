# 06 — Galerías de prueba, Aplicaciones de Galería y galería pública

**Módulo documentado:** "Pruebas" / "Galerías de pruebas" (selección de fotos, aprobación de álbum, aprobación de video), "Aplicaciones de Galería" (apps móviles), galería pública (`/photos`), pestañas de Pruebas en contactos/proyectos/usuarios, y el Área de clientes vista desde la galería.

**Método:** análisis estático de `app.js` (formateado localmente para poder leerlo), plantillas `v/views/**`, `endpoints.txt`, `es.json` y `settings_menu.txt`. No se usó navegador ni internet.

**Convenciones:**
- Los nombres de pantallas, botones y columnas se dan **en español tal como los ve el usuario** (según `es.json`), con el original en inglés entre paréntesis cuando ayuda a ubicarlo en el código.
- `app.js:L` = número de línea en la versión formateada de `app.js` (el original minificado es una sola línea; buscar el nombre de la función citada).
- "**No determinable estáticamente**" = depende del servidor (PHP/API) o de un complemento JS que no está en el material.

---

## 0. Resumen ejecutivo

1. En Alboom **todo es una "Prueba" (`proof`)**: una misma tabla con un campo `type` que vale `S` (Selección de fotos), `A` (Aprobación del álbum), `V` (Aprobación de video) o `M` (Aplicación de Galería móvil). Las "Aplicaciones de Galería" son pruebas de tipo `M` con otra pantalla (`AppsController`, `app.js:11148`).
2. Una prueba tiene **muchos clientes** (tabla intermedia "clientes de la prueba"). **Cada cliente tiene su propio plazo, su propio recordatorio, su propia selección y su propio estado** (completada / vencida / cambios solicitados). El estado NO es de la galería sino de cada par galería‑cliente.
3. El cliente **necesita cuenta (rol `contact`)** para seleccionar o aprobar: entra por el enlace, ve las fotos en modo lectura, aprieta "Empezar Selección" y se registra o inicia sesión (email/contraseña o Facebook). En ese momento se lo **auto‑asocia** a la galería (`/proofs/add_customer`).
4. Selección: marcar ✓ (seleccionada), ★ (favorita, sólo sobre seleccionadas), comentario por foto; límite de fotos con bloqueo o sólo aviso; **precio por foto adicional** (sólo informativo, no cobra); "Preferidas del Estudio" sugeridas por el fotógrafo (manual o desde metadatos de Lightroom).
5. Al terminar: se envían correos (al cliente y al fotógrafo), se crean **notas con la lista de archivos lista para pegar en Lightroom / Finder / Explorador**, notificación y actividad.
6. El fotógrafo puede **Desbloquear** (reabrir sin perder la selección), **Reiniciar** (borra la selección), **Forzar finalización**, **cambiar plazo / +30 días**, reenviar acceso por email o WhatsApp.
7. Álbum: visor tipo libro 3D (complemento `flipbook`), aprobación y anotación por página; el cierre puede ser "¡Aprobado!" o "Solicitar Cambios". Video: YouTube/Vimeo/alojado, comentarios con marca de tiempo.
8. Hay **errores y huecos de seguridad** visibles en el código (código de acceso validado en el navegador, borrado de archivos en S3 desde el navegador, plantillas 404, funciones inexistentes). Ver §12.

---

## 1. Mapa de pantallas y rutas

Definidas en `app.js:2929–3300` y `app.js:3755–3800` (impresión).

### 1.1 Panel del fotógrafo (roles `user`/`admin`, requiere `modules.proofs == 1`)

| Ruta (estado) | URL | Plantilla | Nombre visible |
|---|---|---|---|
| `proofs.index` | `/proofs/index/{itemCategory}/{itemUser}` | `views/proofs/index.html` | Pruebas (listado) |
| `proofs.index_exp` | `/proofs/index_exp/{itemStatus}` | `views/proofs/index_exp.html` | Clientes de Pruebas (Expirado / Realizadas) |
| `proofs.index_grid` | `/proofs/index_grid/{itemCategory}` | `views/proofs/index_grid.html` | Pruebas – Modo de cuadrícula |
| `proofs.index.details`, `proofs.index_exp.details` | `…/details/:id` | `detail.html`, `detail_exp.html` | **Plantillas devuelven 404** (no existen) |
| `proofs.dashboard` | `/proofs/proofs/dashboard` | `index.html` | (alias del listado) |
| `proofs.new` | `/proofs/new` (params `project_id`, `proof_id`, `project_customer_id`) | `views/proofs/edit.html` | Nueva Prueba (y Clonar) |
| `proofs.edit` | `/proofs/edit/{id}` | `views/proofs/edit.html` | Editar Prueba |
| `proofs.view` | `/proofs/view/:id` (param `proof_customer_id`) | `views/proofs/view.html` | Detalles de Prueba |
| `proofs.select_marking` | `/proofs/select_marking/{id}` | `select_marking.html` | Selección de Portada y Preferidas de lo Estudio |
| `proofs.select_user_view` | `/proofs/select_user_view/:id` | `select_user_view.html` | Vista previa (selección) |
| `proofs.album_user_view` | `/proofs/album_user_view/:id` | `album_user_view.html` | Vista previa (álbum) |
| `proofs.video_user_view` | `/proofs/video_user_view/:id` | `video_user_view.html` | **404** |
| `proofs.select_view_selection` | `/proofs/select_view_selection/{id}/{customer_id}` | `select_view_selection.html` | Ver Selección del Cliente |
| `proofs.select_list_selection` | `/proofs/select_list_selection/{id}/{customer_id}` | `select_list_selection.html` | Lista de selección |
| `proofs.album_view_approval` | `/proofs/album_view_approval/{id}/{customer_id}` | `album_view_approval.html` | Vista de la Aprobación |
| `proofs.album_list_approval` | `/proofs/album_list_approval/{id}/{customer_id}` | `album_list_approval.html` | Lista de Aprobación (álbum) |
| `proofs.video_list_approval` | `/proofs/video_list_approval/{id}/{customer_id}` | `video_list_approval.html` | Lista de Aprobación (video) |
| `print.select_list_selection` / `print.album_list_approval` / `print.video_list_approval` | `/print/…/{id}/{customer_id}` | `*_print.html` | Versiones imprimibles |
| `apps.index` | `/apps/index/{itemCategory}` | `views/apps/index.html` | Aplicaciones de Galería |
| `apps.index_grid` | `/apps/index_grid/{itemCategory}` | `views/apps/index_grid.html` | idem, cuadrícula |
| `apps.new` / `apps.edit` | `/apps/new` (type `M`) / `/apps/edit/{id}` | `views/apps/edit.html` | Nueva Aplicación / Editar |
| `apps.view` | `/apps/view/:id` | `views/apps/view.html` | Ficha de la app |
| `contacts.view.proofs` | `/contacts/view/:id/proofs` | `views/contacts/proofs.html` | Pestaña Pruebas del contacto |
| `projects.view.proofs` | `/projects/view/:id/proofs` | `views/projects/proofs.html` | Pestaña Pruebas del proyecto |
| `users.view.proofs`, `users.profile.proofs` | `…/proofs` | `views/users/proofs.html` | Pruebas de un usuario del estudio |
| Configuración → Galerías de pruebas | `settings/…/proofs` | `views/settings/proofs.html` | |
| Configuración → Aplicación Móvil de Galería | `settings/…/mobile` | `views/settings/mobile.html` | |
| Configuración → Plantillas de email → Galerías de pruebas | `email_templates` tipo `proofs` | (común) | |
| Configuración → Área de Clientes | `customer_area` | `views/settings/customer_area.html` | |

### 1.2 Lado cliente / público

| Ruta | URL | Plantilla | Quién |
|---|---|---|---|
| `photos.index` | `/photos/index/{type}/{target_id}` | `views/proofs/index_public.html` | Público (sin login): **Índice de Galerías** |
| `gallery.select_view` | `/gallery/select_view/:unique_id/{dark}` | `select_view.html` | Público: galería de selección en lectura |
| `gallery.album_view` | `/gallery/album_view/:unique_id/{dark}` | `album_view.html` | Público: álbum en lectura |
| `gallery.video_view` | `/gallery/video_view/:unique_id/{dark}` | `video_view.html` | Público: video en lectura |
| `proofs.my_grid` | `/proofs/my_grid/{itemCategory}` | `index_my_grid.html` | Cliente logueado: **Sus galerías** / Mis Galerías |
| `proofs.select_grid` | `/proofs/select_grid/{id}/{customer_id}` | `select_grid.html` | Cliente: **selecciona** |
| `proofs.album_approval` | `/proofs/album_approval/{id}/{customer_id}` | `album_approval.html` | Cliente: **aprueba álbum** |
| `proofs.video_approval` | `/proofs/video_approval/{id}/{customer_id}` | `video_approval.html` | Cliente: **aprueba video** |

El parámetro `{dark}` de las rutas `gallery.*` sólo cambia el modal del código de acceso a una versión oscura con el nombre del estudio (`modal_getcode_dark.html`).

Nota: las rutas `proofs.select_grid`, `album_approval`, `video_approval`, `my_grid`, `select_user_view`, etc. **no tienen restricción de rol** (no llevan `restrict`), sólo heredan la del padre `proofs` (`modules.proofs == 1`). No determinable estáticamente si el servidor valida que `customer_id` de la URL sea el usuario logueado.

---

## 2. Conceptos y estados

### 2.1 Tipos de prueba (`AppTables.proof_categories`, `app.js:24179`)

| Código | Nombre visible | Qué hace el cliente |
|---|---|---|
| `S` | Selección de fotos | Elige fotos (✓), marca favoritas (★), comenta fotos |
| `A` | Aprobación del álbum | Hojea el álbum diagramado, aprueba páginas, anota páginas |
| `V` | Aprobación de video | Mira el video y deja comentarios con marca de tiempo |
| `M` | (Aplicación de Galería) | Sólo mira; es una "app" web móvil con marca del estudio |

### 2.2 Estados de la GALERÍA (a nivel prueba)

| Estado | Cómo se representa | Efecto |
|---|---|---|
| **Sin activar** ("Sin activar") | `published_date = null` | El enlace no se muestra ("Gallery must be active to view link"); los botones de invitación no aparecen. Modal "Activar / Desactivar Pruebas": "Inactive proofs will be not available to customers". |
| **Activa** ("Activado" + fecha) | `published_date = fecha y hora` | Se puede compartir e invitar. |
| **Sólo ver** (`view_only = 1`) | bandera | No hay plazo ni botón "Empezar Selección/Aprobación": es sólo exhibición. |
| **Privada** (`public = 0`) | + `access_code` | Pide código de acceso para ver. |
| **Pública** (`public = 1`) | | Se puede compartir en redes (`social`) y listar en el Índice (`show_in_gallery`). |

La galería **no tiene** estado "completada" propio: se muestran contadores `contact_count` (Contactos) y `completed_count` (Realizadas).

### 2.3 Estados del CLIENTE dentro de la galería (tabla intermedia)

Reconstruido de `views/proofs/contacts.html` (leyenda "A note about Deadline column") y del controlador.

| Estado | Condición de datos | Ícono/leyenda | Qué puede hacer el cliente |
|---|---|---|---|
| **Pendiente** (invitado, sin empezar) | sin `completed_date`, `proof_is_due != 1`, sin marcas | "Just a date": fecha límite | Todo |
| **En selección / en revisión** | sin `completed_date`, `taken_count>0` o `comment_count>0` | fecha límite | Todo; se guarda cada clic al instante |
| **Vencida / pausada** ("Prueba has caducado") | `proof_is_due == 1` y sin `completed_date` | ⏸ + fecha: "This gallery is paused because the deadline for selection / approval expired" | Sólo revisar ("You only can review it"); desde "Sus galerías" ni siquiera abre: "You cannot open this gallery, because it's overdue. Please contact us to reactivate it." |
| **Completada / Aprobada** ("Prueba ha finalizado") | `completed_date` y (`approved == 1` o tipo `S`) | ✔ + fecha de finalización | Sólo revisar |
| **Cambios solicitados** | `completed_date` y `approved != 1` (sólo A/V) | ⚠ + fecha | Sólo revisar |

`proof_is_due` / `is_due` se calcula en el servidor (No determinable estáticamente: probablemente `due_date < hoy`).

### 2.4 Transiciones

```
[Cliente agregado a la galería] --(entra y marca)--> [En selección]
[Pendiente/En selección] --(pasa la fecha límite)--> [Vencida]
[Vencida] --(fotógrafo: "Cambiar Fecha límite" o "30 días para fecha límite")--> [Pendiente/En selección]
[En selección] --(cliente: "Terminar Selection"/"Completar Aprobación")--> [Completada] o [Cambios solicitados]
[Pendiente/En selección/Vencida] --(fotógrafo: "Forzar finalización")--> [Completada] (approved=1, comentario automático)
[Completada/Cambios solicitados] --(fotógrafo: "Desbloquear")--> [En selección] (conserva marcas)
[Cualquiera] --(fotógrafo: "Reiniciar")--> [Pendiente] (BORRA la selección/anotaciones)
[Cualquiera] --(fotógrafo: "Borrar" cliente)--> eliminado (borra sus selecciones)
```

Fuentes: `unlockProof` (`app.js:37122`), `restartProof` (`app.js:37149`), `forceFinish` (`app.js:36801`), `duedateProof`/`duedateProofChecked` (`app.js:37260–37379`), `removeCustomerProof` (`app.js:37210`), modales `modal_restart_customers_checked.html` ("IMPORTANT: All related selections will be deleted") y `modal_delete_customers_checked.html` ("All selections will be also deleted"). Qué hace exactamente el servidor en "Desbloquear" (¿borra `completed_date` y `approved`? ¿extiende plazo?) es **No determinable estáticamente**.

---

## 3. Listado de Pruebas (`proofs.index`)

**Archivo:** `views/proofs/index.html`; lógica `getData()` `app.js:34316`.
**Acceso:** menú lateral "Pruebas" → "Mis pruebas" (`itemUser = yo`) o "Todas las pruebas" (`itemUser = all`, con globo de cantidad vencida `dbStatus.proofs.due_all`) — `views/common/navigation.html`. También ícono en la barra superior "Pruebas expiradas" que lleva a `proofs.index_exp({itemStatus:'expired'})` (`views/common/topnavbar.html`, visible si `user_proofs == 1` o admin).

**Botones superiores:** "Nueva Prueba"; "Exportar en CSV" (sólo admin; exporta todo lo filtrado, `getAllData()` con `csv_mode: 1`); conmutador "Modo lista" / "Modo de cuadrícula".

**Filtros:**
- Estado (botonera): "Todos" | "Expirado" | "Realizadas" (las dos últimas saltan a `proofs.index_exp`, que lista **clientes** y no galerías).
- "Filtrar por tipo": Todos / Selección de fotos / Aprobación del álbum / Aprobación de video. (También acepta `tag:xxx` desde la nube de etiquetas `<tag-cloud>`.)
- "Filtrado por usuario" (propietario). Si el usuario tiene `user_access_itens_only = 1` y no es admin, siempre ve sólo lo suyo.
- Buscador de texto libre (debounce 500 ms, mínimo 2 caracteres). Qué campos busca: No determinable estáticamente.

**Columnas (todas ordenables, orden por defecto `id` descendente, se recuerda en `localStorage` `proof_sortBy`/`proof_reverseSort`):**

| Columna (ES) | Campo |
|---|---|
| # | `id` |
| Tipo | `type` (ícono libro / cuadrícula / YouTube) |
| Nombre | `name` |
| Proyecto# | `project_id` (enlace al proyecto) |
| Activado | `published_date` |
| Contactos | `proof_customer_count` |
| Fin | `proof_completed_count` |
| Visualizaciones | `views` |
| Imágenes | `attach_count` |
| Tamaño | `proof_size` (bytes, formateado) |
| Propietario | `user_id` (avatar) |

**Paginación:** `pagination-footer`, tamaño por defecto 10, configurable y recordado (`localStorage.pageSize`).

**Acciones por fila (menú ⚙):** Ver · Vista previa (S/A) · Editar · Clonar · Borrar.
**Acciones masivas (con casillas):** Cambiar Fecha límite · Activar / Desactivar · Cambiar usuarios (propietario) · Borrar.

**Modales:**
- `modal_activate_checked.html`: "Change state of N proofs to: Activo / Inactivo". Activo pone `published_date = ahora`.
- `modal_users_checked.html`: elegir Propietario; registra actividad "Owner was changed to …".
- `modal_delete_checked.html` / `modal_delete.html`: advierte "All related data, including images, selections, activities, notes and tasks will be also deleted".
- `modal_duedate_customers_checked.html`: fecha; con `is_proof=1` cambia el plazo **de todos los clientes de esas galerías** (No determinable si también cambia `due_date` de la galería).

### 3.1 Clientes de Pruebas: Expirado / Realizadas (`proofs.index_exp`)

**Archivo:** `views/proofs/index_exp.html`. Cada fila es un **par galería‑cliente**.

Columnas: # (de la prueba) · Tipo · Nombre (+ nombre del cliente con tarjeta flotante email/teléfonos/ciudad) · Proyecto# · **Expira** (sólo filtro Expirado; fecha en color) · **Realizadas** (fecha de finalización, sólo filtro Realizadas) · Visualizaciones · Imágenes · **Sel/Apr** (`taken_count`) · **Fav/anot** (`starred_count` en S, `comment_count` en A/V — *la plantilla usa `item.` en vez de `row.`, así que la columna sale vacía: error*) · Propietario.
Buscador: "Search all fields including Extra Fields".
Acciones por fila: Ver (abre la prueba resaltando al cliente), atajo a Lista de selección / aprobación / comentarios.
Masivas: Cambiar Fecha límite · Borrar (*borra galerías completas, no la relación: `modalDeleteChecked(rows,1)` envía `proof_id`* — riesgo alto).

### 3.2 Modo cuadrícula (`proofs.index_grid`)

`views/proofs/index_grid.html`: tarjetas con portada (o miniatura de YouTube/Vimeo), nombre, fecha de activación, cantidad de imágenes. Carga infinita de a 100 (`Proofs.get_grid`). Filtro por tipo y búsqueda. Menú "Resumen" / "Detallado" apunta a estados `print.proofs_summary` y `print.proofs` **que no existen** (enlaces rotos).

---

## 4. Alta / edición de una prueba (`proofs.new` / `proofs.edit`)

**Archivo:** `views/proofs/edit.html`; `loadEdit()` `app.js:34944`; `save()` `app.js:37535`.
**Acceso:** "Nueva Prueba" (menú, listado, ficha), "Nueva Prueba" dentro de un Proyecto (precarga proyecto y cliente del proyecto), "Clonar" (copia todo, nombre + " (Copia)", y copia la lista de clientes sin su estado).

### 4.1 Pestaña "Información Básica"

| Campo (ES) | Modelo | Reglas / valores | Por defecto |
|---|---|---|---|
| Nombre | `name` | obligatorio, mínimo 3 caracteres | — |
| Descripción | `description` | texto libre (se muestra al cliente en "Información sobre esta galería") | — |
| Instrucciones | `instructions` | texto libre; **se abre solo al cliente la primera vez** que entra (una vez por galería, recordado en el navegador) | — |
| Proyecto | `project_id` | selector de proyectos | del parámetro |
| Tipo | `type` | Selección de fotos / Aprobación del álbum / Video (si el plan no permite video → modal de límite) | `S` |
| Sólo ver | `view_only` | Sí/No | No |
| Fecha Final | `due_date` | fecha (oculto si Sólo ver) | hoy + 30 días |
| Enviar Recordatorios | `reminder` | Sí/No (valor por defecto para cada cliente nuevo) | Sí |
| **Sólo tipo S:** Marca de agua | `watermark` | Sí/No | No |
| ¿Cliente puede guardar la imagen? | `images_download` | Sí/No (botón de descarga en el visor, oculto en móviles en la vista previa) | No |
| Permitir favoritos | `images_favorites` | Sí/No | Sí |
| Límite de Selección | `images_limit_type` | **No (0) / Sí (1, bloquea) / Alerta sólo (2, sólo avisa)** | 0 |
| Número de imágenes | `images_on_pack` | número (si límite ≠ 0) | — |
| Mostrar precio por imagen adicional | `images_show_price` | Sí/No | No |
| Precio por imagen adicional | `images_price` | importe (moneda de la cuenta) | — |
| **Sólo tipo A:** Páginas | `spread` | Doble (pliegos) / Simple | Simple |
| Marca de agua | `watermark` | Sí/No | No |
| **Sólo tipo V:** Fuente del video | `video_type` | Vimeo (`V`) / Youtube (`Y`) / Videos almacenados en Alboom CRM (`H`, requiere complemento de video) | según plan |
| ID del video | `video_id` | sólo el ID (no la URL) | — |
| Propietario | `user_id` | obligatorio | usuario actual |

Campos que se guardan pero no se editan en esta pantalla: `dynamic_load` (=1), `images_bw` (=0, "Permite B&N"), `play_music` (Música), `extra_date1/2`, `final_due_date`, `completed_date`. `published_date` se toma de `extra_date1` al guardar (`app.js:37549`) — probablemente legado.

### 4.2 Pestaña "Acceso / Redes sociales"

| Campo | Modelo | Reglas |
|---|---|---|
| Privado | `public` (0 = privado) | Sí/No |
| Código de acceso | `access_code` | **sólo letras y números, máx. 20** (`filterCode`, `app.js:36957`); botón "Validar" consulta `/proofs/check_code/:code` (unicidad en la cuenta, supuesto); no se puede guardar sin código válido |
| Redes Sociales | `social` | (si pública) muestra botones Facebook/Twitter/Google+ |
| Ver Índice de Galerías | `show_in_gallery` | (si pública) lista la galería en `/photos` |

### 4.3 Pestaña "Metadatos" (sólo tipo S y complemento `addon_lrmeta`)

Configura el uso de metadatos XMP de Adobe Lightroom leídos al subir (`UploadsController.on_success`, `app.js:45769`):

| Campo | Modelo | Valores |
|---|---|---|
| Usar metadatos de LR | `meta.proof_metadata` | Sí/No |
| Mostrar Calificación para los clientes | `meta.proof_show_rating` | Sí/No (estrellas bajo cada foto) |
| Ordenar Galerías por calificación | `meta.proof_sort_rating` | No / Ascendente / Descendente |
| Utilice metadatos para Preferidas de lo Estudio | `meta.proof_use_meta_choices` | No / Estrellas (`S`) / Etiquetas (`L`) |
| ¿Cuántas estrellas? | `meta.proof_rating_choices` | 1–5 |
| ¿Qué etiqueta de color? | `meta.proof_label_choices` | 6 rojo, 7 amarillo, 8 verde, 9 azul, 10 púrpura |
| Mostrar Etiquetas de Color a los clientes | `meta.proof_show_labels` | Sí/No (agrega filtros por color en la galería del cliente) |
| Texto personalizado por etiqueta | `meta.proof_label_text`, `proof_label_6..10` | textos |

Los valores por defecto salen de Configuración → Galerías de pruebas (§10).

**Botonera:** en alta, "Editar acceso >>" pasa a la pestaña 2 y recién ahí aparece "Guardar". Al guardar: actividad "Proof was created/edited"; si vino de un proyecto, **agrega automáticamente al cliente del proyecto** como cliente de la galería con el mismo plazo y recordatorio.

---

## 5. Ficha de la prueba (`proofs.view`)

**Archivo:** `views/proofs/view.html`; `loadRow()` `app.js:34855`.

**Barra de acciones:** Borrar · Clonar · Añadir Nota · Activar/Desactivar · Nueva Prueba · Editar.

**Panel de datos** (varios con interruptor en línea `setActive`, que registra actividad):
Portada (clic → Vista previa) o reproductor de video · Tipo (+ "Ver Álbum"/"Ver Pruebas") · Imágenes · Activado (o enlace "Sin activar" para activar) · Sólo ver · Fecha Final · Recordatorio (interruptor) · Contactos · Realizadas · Páginas y Marca de agua (A) · Marca de agua, Descarga (interruptor), Favoritos (interruptor), Límite, Imágenes, Mostrar precio, Precio (S) · Metadatos (resumen al pasar el mouse) · Privado (interruptor + código, o aviso "Please edit proof to create an access code") · Redes Sociales (interruptor + compartir Facebook/Twitter/Google+/WhatsApp) · Índice de Galerías (interruptor + "Open Gallery Index") · Proyecto · Propietario · Creado · Última visita · Visualizaciones · Descripción · Instrucciones · **Enlace directo** (sólo si activa; aviso: para verla como cliente hay que cerrar sesión o usar ventana privada) · Etiquetas.

**Pestañas:**
1. **Clientes** — widget `proof-contacts-widget` (§5.1).
2. **Imágenes** (S) — `uploads-proofs-widget` (§9.1).
3. **Imágenes de álbum** (A) — `uploads-album-widget` (§9.2).
4. **Archivos de video** (V alojado) — `uploads-video-widget` (§9.3).
5. Notas · Mensajes · Actividad (widgets comunes).

### 5.1 Widget "Clientes" de la galería

**Archivo:** `views/proofs/contacts.html`; `loadContacts()` `app.js:34929`, `saveItems()` `app.js:37380`.

**Botones superiores (sólo si la galería está activa):** "Enviar invitación" (abre el redactor de email con plantilla `proof_access`, sin destinatario, con el enlace general) · "Enviar invitación por WhatsApp".

**Columnas:** avatar · Nombre (enlace al contacto + tarjeta con emails/teléfonos/ciudad) · Fecha Final (con íconos de estado §2.3) · Recordatorio (interruptor por cliente) · Visualizaciones · Último (última visita) · Aprob (A) / Sei (S) = `taken_count` · Nota (A/V) = `comment_count` · Fav (S) = `starred_count`.

**Agregar clientes:**
- "Añadir" → `modal_contacts.html`: buscar contacto (mínimo 3 letras, busca en todos los contactos, 30 resultados), Fecha Final (por defecto la de la galería si es futura, si no hoy+30), Enviar Recordatorios. En edición muestra "Concluido el" (fecha de finalización editable a mano).
- "Añadir Grupo" → `modal_contacts_tags.html`: elegir una **etiqueta de contactos**; agrega todos los contactos con esa etiqueta que no estén ya.
- Los cambios quedan en memoria con aviso "Changes were made to data. Please click Save button." + "Deshacer" / "Guardar" (`/proofs/customers` POST).

**Acciones por cliente:** Ver la lista de Selección / Aprobación / Comentarios · Ver Selección / Aprobación del Cliente · Editar · Enviar Enlace de Acceso (email con plantilla `proof_access` usando `customer_link`, enlace **personal** del cliente) · Enlace de acceso por WhatsApp · Desbloquear (si completó) · Forzar finalización (si no completó) · 30 días para fecha límite (si vencida) · Reiniciar · Borrar.

**Acciones masivas:** Enviar Enlace de Acceso (envío directo por servidor `notify_users type=proof_access`, sin abrir el redactor) · Desbloquear · Forzar finalización · Cambiar Fecha límite · 30 días para fecha límite · Reiniciar · Borrar.

**Ayuda:** según plan, enlace a "Tutorial Video #7 / #2" sobre cómo enviar pruebas.

### 5.2 Selección de Portada y Preferidas del Estudio (`proofs.select_marking`)

**Archivo:** `select_marking.html`; `loadSelectMarking()` `app.js:35416`, `setMarkingActive()` `app.js:37719`.
El fotógrafo marca sobre las fotos subidas:
- **Preferidas de lo Estudio** (`taken` en el archivo) → al cliente le aparecen con cinta y un filtro "Preferidas de lo Estudio" (`suggestion == 1`). No disponible en apps `M`.
- **Portada** (`starred` en el archivo) → **una sola** (al marcar una se desmarcan las demás, `app.js:37729`). Es la imagen que se usa en listados/índice.
Filtros: Todos / Preferidas / Portada; contadores; visor a pantalla completa con botones de marcar.

### 5.3 Revisar lo que hizo un cliente

- **Ver Selección del Cliente** (`select_view_selection.html`): cuadrícula en lectura con filtros Seleccionado / Favoritos / Preferidas, contador "Seleccionado X/Total", aviso de límite alcanzado y **costo adicional total** = `images_price × (seleccionadas − images_on_pack)`; muestra el comentario de cada foto.
- **Lista de selección** (`select_list_selection.html`): tabla # / miniatura / Nombre / Sel / Fav / Nota / Fecha; "Comentarios Finales del cliente"; **Lista para Lightroom** (`nombre. , nombre. , …`), **Lista para Finder / Windows Explorer** (`nombre. OR nombre. OR …`), **Lista en texto**, para Seleccionadas y Favoritas por separado, con instrucciones de uso; botón imprimir.
- **Impresión** (`select_list_selection_print.html`): logo, datos del estudio, cliente, fecha de emisión, estado, tabla y comentarios finales.
- **Álbum:** "Vista de la Aprobación" (el libro en solo lectura con las marcas del cliente) y "Lista de Aprobación" (`album_list_approval.html`): # / miniatura / nombre / Aprobado / Anotaciones; clic en la miniatura abre en ventana la página renderizada por el servidor `/api/proofs/album_comments_page/{attach}/{proof}/{customer}/{idioma}/true` (No determinable estáticamente su contenido); imprimible.
- **Video:** "Lista de Aprobación" (`video_list_approval.html`): reproductor + comentarios con tiempo (clic salta a ese segundo) + comentarios finales; imprimible.

---

## 6. Flujo completo del cliente

### 6.1 Cómo le llega

| Vía | Qué recibe | Fuente |
|---|---|---|
| Email "Activación" (`proof_access`) desde la ficha (general) | enlace general `link`, código si es privada, plazo, enlace al Índice si aplica | `sendInvitationAccess` `app.js:37403` |
| Email "Enviar Enlace de Acceso" por cliente | enlace personal `customer_link` | `sendOneAccess` `app.js:37444`, `sendAccess` `app.js:37488` |
| WhatsApp | enlace general o personal | `sendWhatsappInvitation`, `sendWhatsappOneAccess` |
| Área de Clientes | menú "Sus galerías" | `navigation.html` (si `customer_area_proofs == 1`) |
| Índice público `/photos` | tarjeta de la galería o campo "código de acceso" | `index_public.html` |
| Enlace de galerías del proyecto | `{rooturl}/proofs/project/{id}` | `projects/proofs.html` |
| Redes sociales | enlace general | `sharePop` |

Formato real de `link` y `customer_link` (¿`/#/gallery/select_view/{unique_id}`? ¿token de auto‑login?): **No determinable estáticamente** (los arma el servidor).

### 6.2 Paso a paso (selección de fotos)

1. **Abre el enlace general** → `gallery.select_view/:unique_id` (`startSelectView`, `app.js:35459`). Se pide `/proofs/get_by_unique_id/{unique_id}/published/S`.
2. **Si es privada**: modal "Acceso a Galería — Por favor, introduzca el código de acceso para {nombre}". El código **se compara en el navegador** contra `row.access_code` que vino del servidor (`ModalGetCodeInstanceCtrl`, `app.js:34409`). Si acierta, se recuerda en el navegador (`localStorage.proof_access[unique_id]`) **por 11 horas** (`check_last_access`, `app.js:34300`). Si cancela: "Sorry. You need access code to view this gallery." y vuelve al Índice.
3. **Ve las fotos en modo lectura** (carga infinita de a 100), puede abrir el visor a pantalla completa. Clic derecho bloqueado.
4. **"Empezar Selección"** (si no es "Sólo ver"):
   - Sin sesión → modal de acceso (`views/users/modal_signin.html`): "¿tu primera vez aquí?" (Nombre, Email, Contraseña ≥6, Confirmar) "¡Registrarse!" o "Tiene una cuenta?" (Email, Contraseña, "¿Olvidó su contraseña?"), también Facebook (`FBCustomerCheckLogin`). Luego `check_customer` y, si no estaba asociado, **`add_customer` lo agrega a la galería** y redirige a `/proofs/select_grid/{id}/{customer_id}` (`ModalSignInInstanceCtrl`, `app.js:46441`).
   - Con sesión de cliente (`role == 'contact'`) → `signInGallery()` (`app.js:34809`) hace lo mismo.
5. **Pantalla de selección** (`select_grid.html`, `loadSelectGrid` `app.js:35586`):
   - La primera vez se abre solo el popup de **Instrucciones**.
   - Barra fija superior: filtros **Todos / Seleccionado / Favoritos / Preferidas de lo Estudio / etiquetas de color**; botón **"Terminar Selection"**; contador `X/límite seleccionadas · Y favoritas`.
   - Por foto: ✓ seleccionar/deseleccionar, ★ favorita (sólo si está seleccionada y `images_favorites`), 💬 comentario (`modal_proof_comment.html` "Comentar una foto"), estrellas de Lightroom si se muestran. Cada clic se guarda **inmediatamente** (`/proofs/set_select_active`). Deseleccionar una foto le quita la favorita.
   - Visor a pantalla completa con botones seleccionar/favorito y descarga (si está permitida) que baja por `/download.php?link=…`.
   - **Límite**: si `images_limit_type == 1` y llegó al número, **no puede seleccionar más** (alerta roja); si es `2` sólo ve alerta amarilla. Si hay precio adicional ve "Costo adicional por imagen: $X. Costo adicional total: $Y". **No hay cobro ni pedido**: sólo informa.
   - Botones de compartir si la galería es pública y tiene redes.
6. **Terminar**: modal `select_modal_finish.html`: si no eligió nada, "You need select at least one image to finish"; si no, "¿Seguro?" + **Comentarios Finales** + "¡Terminar!". Llama `finishProofs()` (`app.js:34431`):
   - `PUT /proofs/complete` {approved, user_comment, proof_id, customer_id}.
   - Notificación interna al propietario: "Customer finished the Proof {nombre} (#id)" + actividad.
   - Para tipo S: **3 notas** en la galería con la lista de archivos (Lightroom, Finder/Explorador, Texto) y una cuarta si hay fotos no seleccionadas con comentario ("There are images not selected with notes").
   - `POST /proofs/notify_users` dos veces: `proof_completion` (email al fotógrafo con la lista) y `proof_done` (email de confirmación al cliente).
   - Recarga: ya en modo sólo lectura ("Selection Completed … You only can review it").

### 6.3 Aprobación de álbum (`album_approval.html`, `loadAlbumApproval` `app.js:36039`)

Libro 3D (complemento `flipbook`, `js/plugins/album/flip/flipbook.js`, **no incluido**): portada, páginas o pliegos, contratapa. Botones del libro: miniaturas, pantalla completa, sonido, **"Mark a page as approved"** (aprobar página) y **"Annotate the page"** (anotar). Contador "X/Y aprobadas · Z comentarios". Cómo guarda el complemento cada aprobación/anotación: **No determinable estáticamente** (probablemente contra `/proofs/…` usando `proofId`/`userId`).
Terminar (`album_modal_finish.html`): advierte si faltan páginas ("By clicking Approved! button, all pages will be considered approved") o si hay anotaciones ("If you want request changes on Album, please click on Request Changes"); botones **"Solicitar Cambios"** (sólo si hay anotaciones → `approved=0`) y **"¡Aprobado!"** (`approved=1`). Correo `approv_done` con estado.

### 6.4 Aprobación de video (`video_approval.html`, `loadVideoApproval` `app.js:36234`)

Reproductor YouTube/Vimeo (API JS) o HTML5 alojado, con controles −15 s / +15 s / inicio / fin. Tabla **Comentarios del video**: Hora (tiempo del video) · Comentario · Herramientas (editar, ir a ese momento, borrar). "Añadir" **pausa el video** y toma el segundo actual; confirmar reanuda. Los comentarios se guardan en bloque con "Guardar" (`/proofs/save_comments`), con "Deshacer". Terminar (`video_modal_finish.html`): "Solicitar Cambios" (si hay comentarios) o "¡Aprobado!". Correo `video_done`.

### 6.5 "Sus galerías" (Área de Clientes, `proofs.my_grid`)

`index_my_grid.html`: tarjetas de las galerías donde el cliente está asociado: portada, nombre, #, imágenes, seleccionadas, fecha límite (roja si vencida) o fecha de finalización. Filtro por tipo. Abrir: si completó → entra en lectura; si no vencida → entra; si vencida → alerta de bloqueo (`openSelect`, `app.js:35231`). Botón de ayuda "Cómo seleccionar y aprobar" (video de YouTube). Opcional "Galerías Públicas" (abre `/photos`).

### 6.6 Notificaciones y recordatorios

| Evento | Destinatario | Mecanismo | Plantilla |
|---|---|---|---|
| Invitación / enlace de acceso | Cliente | email (redactor o envío directo) / WhatsApp manual | `proof_access` ("Activación") |
| Recordatorio de vencimiento | Cliente con `reminder = 1` | **automático del servidor** según los días de Configuración → Recordatorios (`proof_fup_days`, "un valor por línea") | `proof_fup` ("Recordatorio"; campo `days` = días para expirar) |
| Cliente terminó selección | Cliente | automático | `proof_done` ("Selección finalizada") |
| Cliente terminó álbum | Cliente | automático | `approv_done` ("Aprobación del álbum", campo `status`) |
| Cliente terminó video | Cliente | automático | `video_done` ("Aprobación de video") |
| Cliente terminó (cualquiera) | Fotógrafo (propietario) | automático + notificación interna + actividad | `proof_completion` ("Informe de finalización": `selection_list`, `link` a la lista, `proof_number`, `status`) |
| Finalización forzada | Propietario (si no es quien la forzó) | notificación interna + actividad + notas | — |

Variables de las plantillas (`app.js:22980–23170`): `customer_name/firstname/lastname/company/email/mobile`, `link`, `deadline`, `proof_name`, `proof_type`, `access_code` y `gallery_index` (bloques condicionales con `:start` y `:end`), `days`, `selection_list`, `status`, `user_name/firstname/lastname`, `proof_number`, `email_signature`.

Qué días exactos y a qué hora corre el envío de recordatorios: **No determinable estáticamente**.

---

## 7. Galería pública / Índice de Galerías (`photos.index`)

**Archivo:** `views/proofs/index_public.html`; `loadPublicGrid()` `app.js:35389` → `POST /proofs/index_public`.
- Título "Galerias de pruebas" + nombre del estudio.
- Campo "Por favor, introduzca el código de acceso" + "Ver": busca la galería **por código** (`/proofs/get_by_access_code/:code`) y abre. *Error: para álbum y video usa una variable inexistente (`row.type`), sólo funciona bien para selección* (`openByCode`, `app.js:35270`).
- Filtro por tipo (desplegable).
- Tarjetas de galerías con `show_in_gallery = 1` (las privadas con candado); al hacer clic: si es privada pide código; si el visitante es cliente asociado va directo a seleccionar/aprobar; si no, a la vista pública.
- Pie: © estudio, "Alboom CRM", cambio de idioma EN/PT/ES.
- Variante por proyecto: `photos.index/{type}/{target_id}` (p. ej. todas las galerías de un proyecto). El enlace mostrado en la pestaña del proyecto es `{rooturl}/proofs/project/{id}`: la conversión es del servidor, **No determinable estáticamente**.

---

## 8. Aplicaciones de Galería (tipo `M`)

**Controlador:** `AppsController` (`app.js:11148`), usa el mismo recurso `Proofs` y los mismos endpoints con `type: "M"`.
**Acceso:** menú "Aplicaciones de Galería" → "Nueva Aplicación" / "Aplicaciones" (requiere `modules.proofs`). Límite por plan `n_gallery_mobiles` (si se supera, modal de límite con enlace a mejorar plan).

**Listado** (`views/apps/index.html`): columnas # · Nombre · Activado · Visualizaciones · Imágenes · Tamaño. Búsqueda. Acciones: Ver · Vista previa (abre `row.link` en otra pestaña) · Editar · Borrar. Masivas: Cambiar Fecha límite · Activar/Desactivar (*su modal es 404*) · Cambiar etiquetas (*la función no existe en el controlador: botón muerto*) · Borrar. Modo cuadrícula igual que pruebas.

**Formulario** (`views/apps/edit.html`): Nombre (obligatorio, ≥3), Descripción, Marca de agua, Propietario. Valores por defecto internos iguales a una prueba (plazo +30 días, público, etc.), sin clientes.

**Ficha** (`views/apps/view.html`): portada, Imágenes, Activado, Marca de agua, Propietario, Creado, Última visita, Descripción, **Enlace** (sólo si activa), Compartir (Facebook, Twitter, Google+, WhatsApp — *el de WhatsApp envía un enlace de presupuesto `/#/print/quote/…`: error*). Pestañas: **Opciones de aplicación** · Imágenes · Notas · Mensajes · Actividad.

**Imágenes** (`widgets/uploads_apps.html`): tope **30 imágenes, o 60 con el complemento `addon_gallery_mobile`**; máx. 20 MB por archivo; JPG/GIF/PNG; botón "Seleccionar Portada" (usa `select_marking`, sólo portada).

**Opciones de aplicación** (`views/apps/mobile.html` + vista previa `apps/mobile_preview.html`):
- Sin complemento: sólo aviso "To customize your Gallery App, please edit Mobile Apps Galleries Settings" (usa la configuración global).
- Con complemento: "This Gallery is using the default … Do you want customize?" → "Personalizar": Logo (subida, 1 MB), colores **Fondo** y **Textos e iconos**, Información del negocio (Nombre, Móvil, Email, Sitio), URLs de Facebook/Twitter/Instagram; vista previa tipo celular; "Restablecer por defecto" (borra el logo propio) / "Guardar". Se guarda en `mobile_meta` (JSON) + `mobile_custom = 1`.

Cómo se ve la app publicada para el visitante (¿PWA? ¿"agregar a pantalla de inicio"?): **No determinable estáticamente** (la vista pública la sirve otro frontend).

---

## 9. Subida de archivos (widgets `uploads_*`, `UploadsController`)

**Controlador:** `app.js:45530`. Flujo: pide una **política de subida firmada** `GET /uploads/policy/:max_filesize` y el navegador **sube directo a Amazon S3** (directiva `s3`, complemento no incluido), con redimensión y **marca de agua aplicadas en el navegador antes de subir** (opciones `resize`, `maxWidth/maxHeight`, `watermark_apply`, `watermark_hpos/vpos/margin`), miniatura 150×150, cola de 5 en paralelo, hasta 3.000 archivos por tanda (el texto dice 1.000). Luego registra cada archivo con `POST /attaches` (tipo, `target_id`, archivo, tamaño, `taken`, `rating`, `starred`, `label`).
Rutas en S3: `ups/{cuenta}/files/proofs/{id}/{archivo}` y `ups/{cuenta}/thumbnails/proofs/{id}/{archivo}`.

Consecuencia importante: **la marca de agua queda "quemada" en el archivo subido**; cambiar el interruptor después no afecta fotos ya subidas (deducido de que se aplica en la subida).

Controles del límite del plan: cada imagen subida suma al contador; si `proof_count + subidas ≥ n_proofs` corta la subida ("You reached the maximum of allowed images"). Es decir, **el plan limita la cantidad total de imágenes de pruebas**.

Lectura de Lightroom: si el archivo trae XMP, toma `rating` (estrellas) y `label` (Rojo/Amarillo/Verde/Azul/Púrpura en PT/EN/ES → 6..10) y, según la configuración, marca automáticamente la foto como **Preferida del Estudio**.

### 9.1 Imágenes de selección (`widgets/uploads_proofs.html`)
Arrastrar y soltar; JPEG/GIF/PNG; 20 MB por archivo; contadores "por procesar / por subir / errores"; lista de errores en formato Lightroom/Finder; tabla # / miniatura / Nombre (+ etiqueta de color y estrellas) / Estado / Tamaño; acciones Cancelar, Quitar, Borrar, **Borrar Todos**, **Cancelar Todos**, **Eliminar errores**; recomienda Chrome. **Borrar está oculto cuando algún cliente ya seleccionó/aprobó** (`check_approvals`).

### 9.2 Imágenes de álbum (`widgets/uploads_albums.html`)
Tres bloques: **Archivo de Portada** (`starred = 3`, 1 archivo, JPG/GIF/PNG), **Archivo de Contraportada** (`starred = 1`), **Archivos de las Páginas** o **Archivos de Doble Página** según `spread` (`starred = 2`, múltiples, 20 MB). Botón "Reemplazar" si el archivo ya existe. Textos dicen 4 MB para tapas pero el código usa 2 MB (inconsistencia).

### 9.3 Video alojado (`widgets/uploads_videos.html`)
**Archivo del video** (`starred = 1`, MP4/WEBM/OGG, **hasta 4 GB**) y **Archivo de Portada** del video (`starred = 2`, 1 MB). Aviso: no usar caracteres especiales en el nombre.

### 9.4 Otros usos del mismo componente
Logo de la app (`type: mobile_logo`), marca de agua y logo móvil en Configuración (`type: settings`), adjuntos genéricos de contactos/proyectos/pedidos (`widgets/uploads.html`, 10 MB), foto de perfil (`uploads_profile.html`).

Borrado: **se hace desde el navegador directamente contra S3** (`DELETE` y borrado múltiple por XML de a 490 objetos, `app.js:45563` y `45979`) y luego `DELETE /attaches`.

---

## 10. Configuración

### 10.1 Configuración → Galerías de pruebas (`views/settings/proofs.html`)
- **Configuración de prueba:** Cambiar el tamaño de imágenes antes de subir (Sí/No) · Max. Anchura (px) · Max Altura (px).
- **Metadatos** (con complemento LR): mismos campos de §4.3 como valores por defecto de cada galería nueva.
- **Marca de agua:** imagen (PNG recomendable; 512 KB), posición en grilla 3×3 (arriba/centro/abajo × izquierda/centro/derecha), margen en píxeles. Se habilita galería por galería.
- **Recordatorios:** lista de días (uno por línea) en los que el sistema envía el aviso de vencimiento (`proof_fup_days`).

### 10.2 Configuración → Aplicación Móvil de Galería (`views/settings/mobile.html`)
Logo (1 MB), colores Fondo / Textos e iconos, Información del negocio (Nombre, Móvil, Email, Sitio — **son los mismos campos globales de la empresa**: `site_name`, `cellular`, `site_email`, `site_url`), URLs de redes; vista previa.

### 10.3 Configuración → Plantillas de email → Galerías de pruebas
Pestañas: Activación (`proof_access`) · Recordatorio (`proof_fup`) · Selección finalizada (`proof_done`) · Aprobación del álbum (`approv_done`) · Aprobación de video (`video_done`) · Informe de finalización (`proof_completion`). Variables en §6.6.

### 10.4 Configuración → Área de Clientes (`views/settings/customer_area.html`)
"Mostrar Pruebas" (`customer_area_proofs`) y "Mostrar enlace a galerías públicas" (`customer_area_proofs_public`), además de las opciones de otros módulos.

### 10.5 Plan / suscripción (lo que habilita o limita)
`module_proofs` (módulo), `n_proofs` vs `proof_count` (imágenes de pruebas), `addon_lrmeta` (metadatos LR), `addon_video` + `n_videos`/`n_hosted_videos` (videos incrustados / alojados), `addon_gallery_mobile` + `n_gallery_mobiles` (apps; 60 imágenes en vez de 30). Función `checkOverLimit(tipo)` (`app.js:24711`): `{tipo}_count >= n_{tipo}s`.

---

## 11. Relaciones con otros módulos

| Entidad | Relación | Dónde se ve |
|---|---|---|
| **Proyecto** | Prueba N:1 Proyecto (`project_id`). Crear desde el proyecto precarga proyecto y agrega al cliente del proyecto. | Pestaña Pruebas del proyecto (`projects/proofs.html`): # · Tipo · Nombre · Activado · Cli · Fin · Visualizaciones · Imágenes; masivas: Cambiar fecha límite, +30 días, Activar/Desactivar, Borrar; "Enlace de las Galerías del Proyecto". Tarjeta con contador en la ficha del proyecto (`row.info.proofs`). |
| **Contacto (cliente)** | N:M vía "clientes de la prueba"; el cliente se loguea con rol `contact` (la misma persona del CRM). | Pestaña Pruebas del contacto (`contacts/proofs.html`): # · Tipo · Nombre · Fecha Final · Fin · Visualizaciones · Imágenes; acciones Desbloquear / Forzar / Cambiar plazo / +30 / Reiniciar (sin borrar). Tarjeta en la ficha (`row_info.proof_customers`). Etiquetas de contacto → "Añadir Grupo". |
| **Usuario del estudio** | Propietario (`user_id`) | Pestaña Pruebas del usuario (`users/proofs.html`), filtro por usuario, cambio masivo de propietario. |
| **Pedido / venta** | **No hay relación.** El precio por foto adicional sólo se muestra. | — |
| Notas, Actividades, Notificaciones, Mensajes, Etiquetas | comunes (tipo `proofs` / `apps`) | pestañas de la ficha |
| Tablero | tarjeta "Pruebas – Esta semana" (`card_proofs_week`) | `app.js:16508` |

---

## 12. Errores, rarezas y riesgos detectados (para NO copiar)

1. **Código de acceso validado en el navegador**: el servidor manda `access_code` junto con la galería y el JS lo compara. Cualquiera con las herramientas del navegador lo ve. (`app.js:34409`, `35468`).
2. **Borrado de archivos en S3 desde el navegador** (`XMLHttpRequest DELETE` al bucket). Implica que el bucket acepta borrados con credenciales en el cliente o política muy abierta.
3. Imágenes servidas por URL pública fija de S3 (`ups/{cuenta}/files/proofs/{id}/{archivo}`) — adivinables; descarga por `/download.php?link=` (posible descarga abierta).
4. Rutas del cliente con `customer_id` en la URL y sin `restrict` de rol: depende totalmente de que el servidor valide.
5. Plantillas que devuelven **404**: `proofs/detail.html`, `proofs/detail_exp.html`, `proofs/modal_priority_checked.html`, `proofs/video_user_view.html`, `apps/modal_activate_checked.html`.
6. Funciones llamadas que **no existen** en el recurso: `Proofs.get_info` (panel lateral), `Proofs.batch_type` (cambio de categoría); `modalTagChecked` en Apps; `$scope.updateTotals` en `removeItem`; estados `print.proofs` / `print.proofs_summary`; `apps.album_user_view`.
7. `openByCode` usa `row` indefinido para álbum/video; WhatsApp de Apps y de pruebas (`sendWhatsapp`) comparte un enlace de **presupuesto**.
8. En "Clientes de Pruebas" la columna Fav/anot y en la pestaña del contacto el ícono de completado usan la variable equivocada (`item` en vez de `row`): se ven vacíos.
9. "Borrar" masivo en Clientes de Pruebas borra **galerías completas**, no la relación con el cliente.
10. Botón Google+ (servicio cerrado en 2019); `Attaches.get_music` / `play_music` definidos pero sin pantalla (legado).
11. Recordatorio de acceso por código: 11 horas en `localStorage`; se guarda por navegador, no por persona.
12. Límites de tamaño con textos que no coinciden con el código (4 MB vs 2 MB; 1.000 vs 3.000 archivos).

---

## 13. Endpoints

### 13.1 `/proofs` (43 operaciones en `endpoints.txt`) y su uso

| Endpoint | Método (según `$resource`) | Uso en el frontend |
|---|---|---|
| `/proofs` , `/proofs/:id` | GET/POST/PUT/DELETE | CRUD de la prueba o app (`query`, `save`, `update`, `delete`) |
| `/proofs/paginate` | POST | Listados (pruebas y apps); `csv_mode` para exportar |
| `/proofs/all/:status` | GET | `get_all` — definido, **sin uso** visible |
| `/proofs/:type/:id/:offset/:count` | GET | `by_type`: pestañas de contacto/proyecto/usuario |
| `/proofs/grid` | POST | Modo cuadrícula |
| `/proofs/my_grid` | POST | "Sus galerías" del cliente |
| `/proofs/index_public` | POST | Índice público `/photos` |
| `/proofs/check_code/:code` | GET | Validar código de acceso al editar |
| `/proofs/get_by_access_code/:unique_id` | GET | Abrir galería por código en el Índice |
| `/proofs/get_by_unique_id/:unique_id/:status/:type` | GET | Cargar galería pública |
| `/proofs/check_customer/:proof_unique_id/:customer_id` | GET | ¿El cliente ya está asociado? |
| `/proofs/add_customer` | POST | Auto‑asociar al cliente que se registra/loguea |
| `/proofs/customers/:id` | GET | Lista de clientes de la galería |
| `/proofs/customers` | POST | Guardar lista de clientes |
| `/proofs/customer_remove` | POST | Quitar clientes (borra selecciones) |
| `/proofs/check_approvals/:id` | GET | Si hay selecciones/aprobaciones (bloquea borrar archivos) |
| `/proofs/set_active` | POST | Interruptores de la galería (activar, descarga, favoritos, privado, redes, índice, recordatorio…) |
| `/proofs/set_customers_active` | POST | Interruptor de recordatorio por cliente |
| `/proofs/set_marking_active` | POST | Portada / Preferidas del Estudio |
| `/proofs/set_select_active` | POST | Selección/favorito del cliente (foto por foto) |
| `/proofs/put_comment` | PUT | Comentario del cliente en una foto |
| `/proofs/get_comment/:attach_id/:proof_id/:customer_id` | GET | definido, **sin uso** visible |
| `/proofs/get_comments/:proof_id/:customer_id` | GET | Comentarios del video |
| `/proofs/save_comments` | POST | Guardar comentarios del video (en bloque) |
| `/proofs/select_view` | POST | Fotos de la vista pública |
| `/proofs/select_user_view` | POST | Vista previa del fotógrafo |
| `/proofs/select_marking` | POST | Pantalla de marcado |
| `/proofs/select_grid` | POST | Pantalla de selección del cliente (incluye contadores, etiquetas, sugerencias) |
| `/proofs/select_list` | POST | Listas de selección/aprobación (y cálculo de notas al terminar) |
| `/proofs/album_view` · `/album_user_view` · `/album_approval` | POST | Álbum público / vista previa / aprobación |
| `/proofs/video_view` · `/video_user_view` · `/video_approval` | POST | Video público / vista previa (sin uso: se usa `video_view`) / aprobación |
| `/proofs/complete` | PUT | Terminar (cliente) o Forzar finalización |
| `/proofs/unlock` | POST | Desbloquear |
| `/proofs/restart` | POST | Reiniciar |
| `/proofs/batch_active` · `/batch_delete` · `/batch_duedate` · `/batch_users` | POST | Acciones masivas |
| `/proofs/notify_users` | POST | Disparar emails (`proof_access`, `proof_completion`, `proof_done`, `approv_done`, `video_done`) |

Fuera de la lista: `/api/proofs/album_comments_page/…` (página HTML del servidor con las anotaciones de una página del álbum) y `/proofs/project/{id}` (índice de galerías de un proyecto).

### 13.2 `/attaches` y `/uploads`
- `/attaches` — GET (lista por `type` + `target_id` [+ `starred`]), POST (registrar archivo), PUT `/:id`, DELETE `/:id` o por `type`+`target_id` (borrar todo), POST de borrado múltiple.
- `/attaches/music` — lista de músicas (legado, sin pantalla).
- `/uploads/policy/:max_filesize` — política firmada para subir a S3 (devuelve `bucket` y credenciales temporales; contenido exacto No determinable).

---

## 14. Modelo de datos inferido

**`proofs`** (galería de prueba / app)
`id`, `unique_id` (para URL pública), `type` (S/A/V/M), `name`, `description`, `instructions`, `project_id`, `user_id` (propietario), `published_date` (activación), `view_only`, `due_date`, `final_due_date`, `extra_date1`, `extra_date2`, `completed_date`, `reminder`, `watermark`, `images_download`, `images_favorites`, `images_bw`, `images_limit_type` (0/1/2), `images_on_pack`, `images_show_price`, `images_price`, `spread`, `video_type` (V/Y/H), `video_id`, `video_file`, `video_cover`, `public`, `access_code`, `social`, `show_in_gallery`, `dynamic_load`, `play_music`, `meta` (JSON de metadatos LR y etiquetas), `mobile_custom`, `mobile_meta` (JSON: colores, logo, negocio, redes), `file` (portada), `tags`, `views`, `last_customer_view`, `created`, `modified`, `link` (calculado). Calculados en listados: `attach_count`/`image_count`, `proof_size`, `proof_customer_count`/`contact_count`, `proof_completed_count`/`completed_count`.

**`proof_customers`** (cliente dentro de la galería)
`id`, `proof_id`, `customer_id`, `due_date`, `reminder`, `completed_date`, `approved` (1 aprobado / 0 cambios), `user_comment` (comentarios finales), `views`, `last_customer_view`, `customer_link` (calculado), `proof_is_due` (calculado), contadores `taken_count`, `starred_count`, `comment_count`, `tag` (si vino por grupo).

**`attaches`** (archivos; compartida con todo el CRM)
`id`, `type` (`proofs`, `mobile_logo`, `settings`, `contacts`, …), `target_id`, `file`, `size`, `taken` (en pruebas: Preferida del Estudio), `starred` (en S: portada; en A: 3 tapa / 1 contratapa / 2 páginas; en V: 1 video / 2 portada), `rating` (0–5, de Lightroom), `label` (6–10), `user_id`, `created`.

**Selección / aprobación por foto y cliente** (nombre de tabla No determinable)
`attach_id`, `proof_id`, `customer_id`, `file`, `taken` (seleccionada / página aprobada), `starred` (favorita), `note` (comentario), `comment`/`annotations` (álbum), `modified`.

**Comentarios de video**: `proof_id`, `customer_id`, `time` (segundos), `text`, `created`.

**Configuración** (`settings` clave‑valor): `proof_reducing`, `proof_max_x`, `proof_max_y`, `proof_metadata`, `proof_show_rating`, `proof_sort_rating`, `proof_use_meta_choices`, `proof_rating_choices`, `proof_label_choices`, `proof_show_labels`, `proof_label_text`, `proof_label_6..10`, `watermark`, `watermark_hpos`, `watermark_vpos`, `watermark_margin`, `proof_fup_days`, `mobile_logo`, `mobile_background_color`, `mobile_color`, `social_facebook/twitter/instagram`, `customer_area_proofs`, `customer_area_proofs_public`.

**Plantillas de email**: 6 claves del grupo `proofs` (§10.3).

---

## 15. Solapamiento con CompraMeLaFoto (CLF)

| Pieza de Alboom | ¿Existe en CLF? | Recomendación |
|---|---|---|
| Subida masiva de fotos con miniaturas y marca de agua | **Sí** (álbumes, subida directa a R2, marca de agua) | **Reutilizar** el pipeline de CLF / un paquete común; no rehacer. |
| Galería con enlace y código de acceso | **Sí** (álbumes públicos/privados) | Reutilizar visor y control de acceso (validado en servidor). |
| Descarga de fotos | Sí (descargas con token) | Reutilizar enlaces firmados. |
| Foto adicional con precio | **Sí, y con cobro real** (checkout, Mercado Pago) | En FOTOFFICE: al pasarse del paquete, ofrecer **pagar las extra** con el checkout existente (o DNX Payments). |
| Selección / favoritos / comentarios por foto, plazo, finalizar | No (CLF es venta, no selección) | Construir en FOTOFFICE; puede vivir sobre el mismo almacenamiento de CLF. |
| Aprobación de álbum por página | No | Construir (FOTOFFICE); el diagramado vive en el Designer (plantillas escolares) — conectar. |
| Aprobación de video con marcas de tiempo | No (CLF tiene videos de venta) | Construir en FOTOFFICE; reutilizar reproductor/almacenamiento de videos de CLF. |
| Índice público de galerías | Parecido (páginas públicas de álbumes) | Unificar con el sitio público de FOTOFFICE. |
| App móvil de galería con marca | No | Evaluar si hace falta: una galería web responsive con marca del estudio cubre el caso. |
| Cuenta de cliente | CLF y FOTOFFICE **no comparten usuarios** | Decidir identidad del cliente final (ver §16). |

---

## 16. Mejora propuesta para FOTOFFICE

1. **Modelo limpio y separado**: `Galeria` (tipo: selección | álbum | video | exhibición), `GaleriaCliente` (plazo, estado explícito `PENDIENTE | EN_CURSO | VENCIDA | COMPLETADA | CAMBIOS_SOLICITADOS`, fechas de cada transición), `GaleriaArchivo`, `SeleccionFoto`, `AnotacionPagina`, `ComentarioVideo`, `EventoGaleria` (historial). Nada de códigos mágicos en `starred` (1/2/3): usar un campo `rol` (`portada`, `contratapa`, `pagina`, `video`, `poster`).
2. **Acceso sin fricción y seguro**: enlace personal **firmado por cliente** (sin obligar a crear contraseña; "enlace mágico" por email/WhatsApp) + código opcional **validado en el servidor** con límite de intentos. Si hace falta cuenta, reutilizar el Portal de FOTOFFICE.
3. **Selección con historial y rondas**: en vez de "Reiniciar" que borra, guardar **rondas** (versión 1, 2…) para comparar qué cambió; "Desbloquear" crea una nueva ronda.
4. **Paquete y extras con cobro**: paquete incluido por galería (desde el Presupuesto/Pedido), extras con precio y **botón de pago** (checkout CLF / DNX Payments) que genera un cargo en el Pedido del cliente. Alertar al fotógrafo cuando hay extras pagadas.
5. **Integración con el flujo de trabajo**: al completar, avanzar automáticamente la etapa del Proyecto/Pedido (p. ej. "Selección recibida" → "En edición") y crear la tarea de edición con la lista de archivos.
6. **Exportaciones útiles**: además de las listas para Lightroom/Finder, un **archivo .txt/.csv descargable** y un **ZIP de las elegidas** (si está permitido); opción de crear una "colección" para Lightroom Classic mediante lista de nombres.
7. **Recordatorios configurables por galería** (días antes del vencimiento) con registro de envíos (qué se mandó y cuándo), por email y WhatsApp (plantillas). Recordatorio de "empezó pero no terminó".
8. **Álbum**: aprobación por página con anotaciones **dibujadas sobre la página** (marcador de área) y hilo de conversación por página; versiones del diseño (v1, v2…) conectadas al Designer.
9. **Video**: comentarios con marca de tiempo y respuestas; versiones del video.
10. **Panel del fotógrafo**: tablero de galerías por estado (tarjetas "Esperando al cliente / Vencidas / Para editar"), filtros por proyecto, cliente, fecha y propietario, acciones masivas seguras (quitar cliente ≠ borrar galería), exportación CSV.
11. **Seguridad de archivos**: almacenamiento privado con **URLs firmadas y de corta vida**, marca de agua aplicada en servidor (o versión con marca separada del original), borrados sólo desde el servidor, bloqueo de descarga real (no sólo el clic derecho).
12. **Terminología** configurable (Configuración → Palabras) para "Prueba / Galería / Selección".
13. **Migración**: importar `proofs` (tipos S/A/V), `proof_customers` (con fecha de finalización y estado), archivos desde S3 (`ups/{cuenta}/files/proofs/{id}/`) y selecciones; las apps `M` pueden migrarse como galerías de exhibición. Las anotaciones de álbum dependen del complemento `flipbook`: verificar formato antes.

---

## 17. Dudas para verificar en vivo

1. Formato real de `link` y `customer_link`: ¿el enlace personal hace auto‑login o también pide registrarse?
2. ¿Qué hace el servidor exactamente al **Desbloquear** (borra `completed_date` y `approved`? ¿extiende el plazo?) y al **Reiniciar** (¿borra también comentarios de fotos?).
3. ¿Cómo se guardan la aprobación y las anotaciones por página del álbum (complemento `flipbook` no incluido)? ¿Se pueden exportar?
4. ¿Cuándo y a qué hora salen los recordatorios `proof_fup` y qué pasa con clientes que ya completaron?
5. ¿El servidor valida que el `customer_id` de la URL coincide con la sesión? (probar abrir la selección de otro cliente).
6. ¿El código de acceso es único en toda la cuenta o por galería? ¿Aparece en la respuesta de `get_by_unique_id`?
7. ¿Cómo se ve la **Aplicación de Galería** publicada para el visitante (URL, "agregar a inicio", diseño)?
8. ¿El límite `n_proofs` del plan cuenta imágenes, galerías o ambos? ¿Cuánto almacenamiento real hay por cuenta?
9. ¿`is_due` compara con la fecha del cliente o de la galería? ¿Cambiar la fecha de la galería cambia la de los clientes existentes?
10. Contenido de la página `/api/proofs/album_comments_page/…` y del índice `/proofs/project/{id}`.
11. ¿Se puede exportar la base (galerías, clientes, selecciones, archivos) de forma masiva para migrar, o hay que recorrer la API?
