# FotoOffice — Arquitectura de navegación

**Fecha:** 2026-08-28
**Alcance:** todos los menús de FotoOffice, en todas las superficies y para todos los roles.
**Para qué sirve:** que cada módulo que se implemente sepa **de antemano** dónde va su opción
de menú, con qué nombre, en qué orden, para quién y bajo qué condición aparece.

> Documentos relacionados:
> [ESTADO-ACTUAL.md](ESTADO-ACTUAL.md) — qué está construido de verdad.
> [ROADMAP-PORTAL-SOCIO.md](ROADMAP-PORTAL-SOCIO.md) — orden de los subproyectos.
> [CONTEXTO-SFPR.md](CONTEXTO-SFPR.md) — la visión y las 16 etapas.
>
> Este documento manda sobre **dónde va cada cosa en el menú**. No decide qué se construye.

## 0. Cómo leer las tablas

| Marca | Significado |
|---|---|
| ✅ | **Activo hoy.** Tiene pantalla real y está en el menú. |
| 🟡 | **Parcial.** Existe algo, le falta para estar completo. |
| ⬜ | **Planificado.** Reservado en este documento. **No aparece en el menú todavía.** |
| 🔓 | **Activo sin control de módulo.** Deuda registrada: funciona, pero no se puede apagar por institución. |

**Regla de oro de este documento:** una fila ⬜ es una promesa hecha al futuro, no al usuario.
Nadie ve en pantalla una opción marcada ⬜ — ni gris, ni con cartel de "próximamente".

---

## 1. Las superficies de FotoOffice

FotoOffice no tiene "un menú": tiene **seis superficies** con navegaciones distintas, porque
son seis personas distintas usando el mismo sistema. Una persona nunca ve dos menús a la vez.

| # | Superficie | Quién la ve | Ruta base | Navegación | Estado |
|---|---|---|---|---|---|
| S1 | **Panel de institución** | Equipo de una institución (dueño, admin, staff) | `/dashboard`, `/members`, … | Menú lateral izquierdo, agrupado por dominio | ✅ |
| S2 | **Panel de negocio** | Fotógrafo o empresa con workspace propio | `/workspace` | Menú lateral simple, generado desde el catálogo de módulos | 🟡 |
| S3 | **Portal del socio** | Socio de una institución | `/portal` | Sin menú lateral: tarjetas y vuelta al inicio | 🟡 |
| S4 | **Panel de plataforma** | Super Admin de DNX | `/admin` | Sección dentro del menú de S1 | ✅ |
| S5 | **Sitio público** | Cualquiera, sin sesión | `/w/[slug]`, `/cursos/…`, `/c/[token]` | Navegación pública editable desde el Website Builder | ✅ |
| S6 | **Pantallas de foco** | Quien esté en un trámite | `/login`, `/invitacion/…`, `/onboarding`, `/elegir-perfil`, inscripciones | **Sin menú, a propósito** | ✅ |

### La frontera entre superficies

Está resuelta en el código y **no se toca desde el menú**:

- `resolveFotofficeUserKind()` decide a dónde va cada persona al entrar: equipo → panel,
  socio → portal, nuevo → se le prepara su negocio.
- Un socio que escribe `/members` en la barra del navegador **no ve el panel**: lo redirige el
  layout, no el menú. Ocultar el link nunca es el control de acceso; es solo cortesía visual.
- `/elegir-perfil` existe para quien es las dos cosas (dueña de su estudio y socia de una
  institución). Cambiar de perfil cambia de superficie entera, no de sección del menú.

### Deuda registrada: S1 y S2 son dos cáscaras distintas

Hoy conviven dos paneles administrativos con su propio encabezado, su propio menú y su propio
estilo: `app/(shell)/` (el de la institución) y `app/workspace/` (el del negocio). El segundo
arma su menú automáticamente desde el catálogo de módulos; el primero lo tiene escrito a mano.

**No se unifican en este trabajo.** Queda anotado como el próximo paso de esta arquitectura:
S2 debería ser el mismo componente que S1 con otro conjunto de secciones. Mientras tanto, todo
módulo nuevo que se registre en `lib/modules/registry.ts` con `route` aparece **solo** en S2.

---

## 2. Los once principios

Estos principios son la razón de cada decisión de las tablas que siguen. Cuando aparezca un
caso no previsto, se resuelve con ellos.

**P1 — Un módulo apagado no existe.**
No se muestra gris, ni con candado, ni con cartel. Si la institución no tiene Reservas, la
palabra "Reservas" no aparece en ninguna parte de su pantalla.

**P2 — El menú nunca promete.**
Nada de "Próximamente" ni "En desarrollo". Un menú que promete se convierte en una lista de
deudas que el usuario relee cada día.

**P3 — El control es de dos niveles, y el menú es el más débil.**
Nivel 1: el módulo está habilitado para *ese* workspace. Nivel 2: la persona tiene el rol.
Los dos se verifican **en el servidor, en cada request**. Esconder el link es el tercer nivel,
el cosmético.

**P4 — Las secciones son dominios, no tipos de pantalla.**
"Socios", "Cursos", "Tesorería" son dominios. "Configuraciones", "Listados", "Reportes" no lo
son: obligan a saber de antemano qué tipo de pantalla se busca.

**P5 — Toda sección con nombre lleva su encabezado.**
Sin excepción por cantidad. La regla vieja —"un grupo de un solo ítem no lleva título"— produjo
exactamente el defecto que se ve en la captura del panel de la SFPR: **"Sitio web" quedó colgado
debajo de "Valores y calendario" y parece parte de Socios.** Un ítem sin encabezado se lee como
parte de la sección de arriba.

**P6 — El orden es fijo y está declarado.**
Cada ítem tiene un número de orden en este documento. Un módulo nuevo se inserta en su lugar,
no al final. El menú no es un historial de cuándo se programó cada cosa.

**P7 — Siete ítems por sección como máximo.**
Al octavo, la sección se parte o su configuración se va a una pestaña dentro de la pantalla
principal. Socios está hoy en el límite (7).

**P8 — Cada ítem se ilumina solo en sus propias pantallas.**
"Padrón" no puede quedar marcado mientras se mira "Cuotas", aunque las dos rutas empiecen con
`/members`. Si el menú miente sobre dónde estás, deja de servir para orientarte.

**P9 — La configuración de un dominio vive al final de ese dominio.**
"Valores y calendario" va al final de Socios, no en una sección "Configuración" general.
Excepción: lo que es de la institución entera (datos, cobros) tiene su propia sección.

**P10 — El menú se puede ocultar por completo.**
Un padrón de 152 filas, un diseñador de carnets o un calendario de reservas necesitan la
pantalla entera. Ocultar el menú expande el contenido a todo el ancho, y la preferencia se
recuerda entre sesiones.

**P11 — El vocabulario es de la organización, no de la SFPR.**
FotoOffice sirve a asociaciones, a estudios y a empresas. "Socios" para una asociación puede
ser "Clientes" para un estudio y "Alumnos" para una escuela. Las etiquetas de este documento
son los **valores por defecto del perfil institucional**; el día que exista la personalización
de vocabulario, se resuelve por workspace y ninguna etiqueta se hardcodea.

---

## 3. Roles y quién ve qué

### Roles que existen hoy en el código

| Rol | Dónde vive | Qué es |
|---|---|---|
| `SUPER_ADMIN` | `GlobalRole` | DNX. Ve la sección Plataforma en cualquier workspace. |
| `PLATFORM_SUPPORT` | `GlobalRole` | Soporte de DNX. Hoy sin secciones propias. |
| `WORKSPACE_OWNER` | `WorkspaceRole` | Dueño de la institución o del negocio. Ve todo lo de su workspace. |
| `WORKSPACE_ADMIN` | `WorkspaceRole` | Administra igual que el dueño, salvo lo que se reserve explícitamente. |
| `STAFF` | `WorkspaceRole` | Consulta. Ve el padrón y las fichas; no gestiona ni exporta. |
| `MEMBER` | `Member` con `userId` | Socio. Solo el portal. |
| Operador de carnet | `MemberCardOperator` | Permiso puntual para verificar carnets. No es un rol de menú. |

### Roles institucionales previstos (⬜)

`CONTEXTO-SFPR.md` los anticipa y el módulo de Gobierno los va a necesitar. **No existen
todavía**; se listan para que las tablas de más abajo tengan a quién referirse.

| Rol previsto | Secciones que abriría |
|---|---|
| Tesorería | Tesorería completa, Cuotas, pagos manuales |
| Secretaría | Socios, Solicitudes, Comunicación, Actas |
| Prensa / Comunicación | Comunicación, Sitio web, Redes |
| Docente | Solo sus cursos y sus evaluaciones |
| Comisión Directiva | Gobierno, Transparencia, lectura de Tesorería |

**Regla de transición:** mientras esos roles no existan, todo lo que les correspondería es de
`WORKSPACE_OWNER` y `WORKSPACE_ADMIN`. Nunca se le abre una sección a `STAFF` "por ahora".

---

## 4. S1 · Panel de institución — mapa completo del menú

Es el menú de la captura. Se lee de arriba hacia abajo en este orden exacto.

### 4.0 · Sin encabezado — la entrada

| Orden | Etiqueta | Ruta | Ícono | Módulo | Rol | Estado |
|---:|---|---|---|---|---|---|
| 0 | Inicio | `/dashboard` | `LayoutDashboard` | — (siempre) | cualquiera del equipo | ✅ |

Único ítem sin encabezado del menú, y la única excepción legítima a **P5**: está solo, arriba
de todo, separado del resto. No puede confundirse con la sección de abajo porque no hay
sección arriba.

### 4.1 · SOCIOS

Módulo `members`. Se muestra la sección completa solo si el módulo está habilitado.
Con rol `STAFF` aparece únicamente "Padrón".

| Orden | Etiqueta | Ruta | Ícono | Rol | Estado |
|---:|---|---|---|---|---|
| 10 | Padrón | `/members` | `Users` | STAFF+ | ✅ |
| 20 | Solicitudes | `/members/solicitudes` | `Inbox` | ADMIN+ | ✅ |
| 30 | Cuotas | `/members/cuotas` | `Wallet` | ADMIN+ | ✅ |
| 40 | Carnets | `/members/carnets` | `CreditCard` | ADMIN+ | ✅ |
| 50 | Diseñador | `/members/disenador` | `Palette` | ADMIN+ | ✅ |
| 60 | Categorías | `/members/categories` | `Tag` | ADMIN+ | ✅ |
| 70 | Valores y calendario | `/members/cuotas/configuracion` | `CalendarClock` | ADMIN+ | ✅ |

**Sección llena (P7).** Todo lo que llegue a Socios de acá en adelante va **adentro de una de
estas siete pantallas**, no como ítem nuevo:

| Lo que viene | Dónde va |
|---|---|
| Importar padrón (`/members/import`) | Botón dentro de Padrón. Ya es así. |
| Alta y ficha de socio | Dentro de Padrón. Ya es así. |
| Permisos de carnet (`/members/carnets/permisos`) | Pestaña dentro de Carnets. Ya es así. |
| Registro de pago manual ⬜ | Acción dentro de Cuotas y dentro de la ficha del socio |
| Referido con mes bonificado ⬜ | Pestaña dentro de Solicitudes |
| Cuenta corriente del socio ⬜ | Pestaña dentro de la ficha del socio |
| Sincronización con Google Contacts ⬜ | Ajuste dentro de Datos de la institución |

### 4.2 · CURSOS

Módulos `courses-sales` y `evaluaciones`. Evaluaciones vive acá porque evalúa actividades de
los cursos: si algún día evalúa otra cosa, se muda a su propia sección.

| Orden | Etiqueta | Ruta | Ícono | Módulo | Rol | Estado |
|---:|---|---|---|---|---|---|
| 10 | Cursos | `/dashboard/courses` | `GraduationCap` | `courses-sales` | equipo | ✅ |
| 20 | Ventas | `/dashboard/sales` | `LayoutGrid` | `courses-sales` | equipo | ✅ |
| 30 | Docentes | `/courses/teachers` | `Users` | `courses-sales` | equipo | ✅ |
| 40 | Inscripciones | `/courses/leads` | `Inbox` | `courses-sales` | equipo | ✅ |
| 50 | Evaluaciones | `/evaluaciones` | `ClipboardCheck` | `evaluaciones` | equipo | ✅ |
| 90 | Configuración | `/courses/settings` | `Settings` | `courses-sales` | equipo | ✅ |

**"equipo" quiere decir que hoy no hay distinción de rol**: `STAFF` ve y edita los cursos igual
que el dueño. Es una diferencia real con Socios, donde `STAFF` solo consulta. Cuando exista
"Equipo y permisos" (sección 4.10) corresponde revisar esto — **no** se corrige escondiendo el
link, que es el nivel más débil del control (P3): se corrige en el servidor.

El orden 90 de Configuración es deliberado (**P9**): deja libre el rango 60-80 para lo que
venga —certificados, asistencia, aula— sin que Configuración deje de ser lo último.

### 4.3 · CAPTACIÓN

Formularios compartibles para juntar contactos. Existe y funciona.

| Orden | Etiqueta | Ruta | Ícono | Módulo | Rol | Estado |
|---:|---|---|---|---|---|---|
| 10 | Formularios | `/dashboard/service-leads/forms` | `FileText` | — | equipo | 🔓 |
| 20 | Leads | `/dashboard/service-leads` | `Inbox` | — | equipo | 🔓 |

**Deuda registrada.** No tiene clave de módulo: hoy lo ve cualquier institución, incluso una que
no capta clientes, y no se puede apagar. Le corresponde la clave `service-leads` en el catálogo.
**No se agrega en este trabajo**: crear la clave sin migrar la habilitación de los workspaces
existentes le apagaría el módulo a quien hoy lo usa.

### 4.4 · PRESENCIA PÚBLICA

Módulo `website`. Sección propia desde ahora, aunque hoy tenga un solo ítem: es la que arregla
el defecto de la captura (**P5**), y es donde aterrizan blog, portfolio y redes.

| Orden | Etiqueta | Ruta | Ícono | Módulo | Rol | Estado |
|---:|---|---|---|---|---|---|
| 10 | Sitio web | `/website` | `Globe` | `website` | equipo | ✅ |
| 20 | Blog | `/website/blog` | `Newspaper` | `website` | ADMIN+ | ⬜ |
| 30 | Redes | `/redes` | `Share2` | `social` | ADMIN+ | ⬜ |
| 40 | Portfolios | `/portfolios` | `Images` | `portfolio` | ADMIN+ | ⬜ |

Historial, Navegación, SEO y Diseño son **pestañas dentro de Sitio web**, no ítems del menú.
Ya es así, y así queda: son configuraciones de una sola cosa publicada.

### 4.5 · COMUNIDAD ⬜

Etapa 11 y 14. Todo planificado. Depende de traer DNX Partners a FotoOffice.

| Orden | Etiqueta | Ruta prevista | Ícono | Módulo | Rol | Estado |
|---:|---|---|---|---|---|---|
| 10 | Beneficios | `/beneficios` | `BadgePercent` | `benefits` | ADMIN+ | ⬜ |
| 20 | Sponsors | `/sponsors` | `Handshake` | `sponsors` | ADMIN+ | ⬜ |
| 30 | Convenios | `/convenios` | `FileSignature` | `benefits` | ADMIN+ | ⬜ |
| 40 | Sorteos | `/sorteos` | `Gift` | `raffles` | ADMIN+ | ⬜ |
| 50 | Muestras | `/muestras` | `Frame` | `exhibitions` | ADMIN+ | ⬜ |

Sorteos depende de Sponsors: sin sponsors no hay premio. **No se habilita Sorteos antes que
Beneficios**, aunque técnicamente se pueda.

### 4.6 · RESERVAS ⬜

Etapa 9. Cero código hoy. Es el módulo más grande de los que faltan.

| Orden | Etiqueta | Ruta prevista | Ícono | Módulo | Rol | Estado |
|---:|---|---|---|---|---|---|
| 10 | Agenda | `/reservas` | `CalendarDays` | `bookings` | STAFF+ | ⬜ |
| 20 | Espacios | `/reservas/espacios` | `DoorOpen` | `bookings` | ADMIN+ | ⬜ |
| 30 | Tarifas y reglas | `/reservas/configuracion` | `Settings` | `bookings` | ADMIN+ | ⬜ |

La conexión con el Google Calendar de la institución es un ajuste dentro de "Tarifas y reglas",
no un ítem propio.

### 4.7 · TESORERÍA ⬜

Etapa 12. Consolida lo que hoy está repartido entre Cuotas, Ventas y Cobros.

| Orden | Etiqueta | Ruta prevista | Ícono | Módulo | Rol | Estado |
|---:|---|---|---|---|---|---|
| 10 | Caja | `/tesoreria` | `Wallet2` | `cash` | Tesorería / ADMIN+ | ⬜ |
| 20 | Movimientos | `/tesoreria/movimientos` | `ArrowLeftRight` | `cash` | Tesorería / ADMIN+ | ⬜ |
| 30 | Facturación | `/tesoreria/facturas` | `Receipt` | `billing` | Tesorería / ADMIN+ | ⬜ |
| 40 | Cierre anual | `/tesoreria/cierre` | `Archive` | `cash` | Tesorería / ADMIN+ | ⬜ |
| 50 | Cuenta con la plataforma | `/tesoreria/fee` | `Scale` | `cash` | OWNER | ⬜ |

**"Cuenta con la plataforma" no es opcional.** Es el libro del fee: cuánto se le debe a DNX por
los pagos cobrados en efectivo y cómo se fue descontando de los cobros por Mercado Pago. La
decisión de retener sin tope obliga a que el desglose esté a la vista —está explicado en
[ROADMAP-PORTAL-SOCIO.md](ROADMAP-PORTAL-SOCIO.md)—. Sin esta pantalla, el primer tesorero que
vea una retención grande va a pensar que el sistema le robó.

### 4.8 · GOBIERNO ⬜

Etapa 12. Vida institucional formal.

| Orden | Etiqueta | Ruta prevista | Ícono | Módulo | Rol | Estado |
|---:|---|---|---|---|---|---|
| 10 | Proyectos | `/gobierno/proyectos` | `FolderKanban` | `governance` | Comisión / ADMIN+ | ⬜ |
| 20 | Orden del día | `/gobierno/orden-del-dia` | `ListChecks` | `governance` | Comisión / ADMIN+ | ⬜ |
| 30 | Votaciones | `/gobierno/votaciones` | `Vote` | `governance` | Comisión / ADMIN+ | ⬜ |
| 40 | Actas | `/gobierno/actas` | `ScrollText` | `governance` | Comisión / ADMIN+ | ⬜ |
| 50 | Transparencia | `/gobierno/transparencia` | `Eye` | `transparency` | ADMIN+ | ⬜ |

### 4.9 · COMUNICACIÓN ⬜

Etapa 13. Hoy solo existe la firma de correo del workspace, que es un campo dentro de "Datos de
la institución" — no justifica una sección.

| Orden | Etiqueta | Ruta prevista | Ícono | Módulo | Rol | Estado |
|---:|---|---|---|---|---|---|
| 10 | Bandeja de sucesos | `/comunicacion` | `Bell` | `communications` | Prensa / ADMIN+ | ⬜ |
| 20 | Envíos | `/comunicacion/envios` | `Send` | `communications` | Prensa / ADMIN+ | ⬜ |
| 30 | Plantillas | `/comunicacion/plantillas` | `LayoutTemplate` | `communications` | Prensa / ADMIN+ | ⬜ |

### 4.10 · INSTITUCIÓN

Lo que es de la organización entera, no de un dominio. Requiere permiso de configuración.

| Orden | Etiqueta | Ruta | Ícono | Rol | Estado |
|---:|---|---|---|---|---|
| 10 | Datos de la institución | `/workspace/configuracion` | `Settings` | ADMIN+ | ✅ |
| 20 | Cobros | `/workspace/configuracion/cobros` | `Wallet2` | ADMIN+ | ✅ |
| 30 | Equipo y permisos | `/workspace/configuracion/equipo` | `UserCog` | OWNER | ⬜ |
| 40 | Auditoría | `/workspace/configuracion/auditoria` | `History` | OWNER | ⬜ |

"Equipo y permisos" es el que va a habilitar los roles institucionales de la sección 3. Hasta
que exista, sumar gente al equipo es tarea del Super Admin.

### 4.11 · PLATAFORMA

Solo `SUPER_ADMIN`. Es DNX administrando FotoOffice, no la institución administrándose.

| Orden | Etiqueta | Ruta | Ícono | Estado |
|---:|---|---|---|---|
| 10 | Administración | `/admin` | `Shield` | ✅ |
| 20 | Workspaces | `/admin/workspaces` | `Building2` | ✅ |
| 30 | Usuarios | `/admin/users` | `UserCog` | ✅ |
| 40 | Dueños | `/admin/owners` | `Users` | ✅ |

**Encender y apagar módulos no es un ítem del menú, y está bien así.** Se hace dentro de la
ficha de cada workspace (`/admin/workspaces/[id]`), porque la decisión es siempre *de un
workspace*. La pantalla vieja `/admin/workspace-modules` —una matriz de todos los workspaces
contra todos los módulos— quedó reemplazada por no escalar; hoy solo redirige, y por eso no
lleva ítem propio.

---

## 5. S3 · Portal del socio — mapa completo

Hoy son cuatro pantallas sin menú: se navega con tarjetas desde `/portal` y se vuelve con un
enlace. **Funciona con cuatro; no funciona con doce.**

### Regla de crecimiento del portal

| Cantidad de secciones | Navegación que corresponde |
|---|---|
| Hasta 5 | Tarjetas en la portada, como hoy ✅ |
| 6 a 9 | Barra inferior fija en el teléfono, y menú lateral en pantalla grande ⬜ |
| 10 o más | Revisar: el portal se convirtió en un panel y el socio no es administrativo |

El portal se usa desde el teléfono. La navegación va **abajo**, al alcance del pulgar, no en un
menú lateral copiado del panel.

### Mapa

| Orden | Etiqueta | Ruta | Qué muestra | Estado |
|---:|---|---|---|---|
| 10 | Inicio | `/portal` | Identidad: número, categoría, antigüedad y estado de cuenta real | ✅ |
| 20 | Mi carnet | `/portal/carnet` | Carnet emitido, con su QR de verificación | 🟡 |
| 30 | Mis cuotas | `/portal/cuotas` | Estado de cuenta y pago por Mercado Pago | ✅ |
| 40 | Mi perfil | `/portal/perfil` | Datos, foto y presencia profesional | ✅ |
| 50 | Beneficios | `/portal/beneficios` | Descuentos y convenios vigentes | ⬜ |
| 60 | Reservas | `/portal/reservas` | Reservar salón o estudio, y ver las propias | ⬜ |
| 70 | Sorteos | `/portal/sorteos` | Sorteo del mes y resultados verificables | ⬜ |
| 80 | Cursos | `/portal/cursos` | Cursos de la institución e inscripción | ⬜ |
| 90 | Institucional | `/portal/institucional` | Novedades, actas y transparencia | ⬜ |
| 100 | Mis referidos | `/portal/referidos` | A quién recomendé y qué mes me bonificaron | ⬜ |

### Lo que el portal nunca muestra

- Datos de otros socios. Ni el padrón, ni quién debe.
- Números de la institución que no sean los públicos por decisión de la Comisión.
- Nada del panel administrativo, aunque la persona además trabaje ahí: para eso está
  `/elegir-perfil`.

### Advertencia de diseño, ya registrada

"Institucional" (orden 90) depende de que **alguien cargue contenido**. Hoy no se está cargando
ninguno. Poner esa sección antes de que exista quien la sostenga es dejarle al socio una puerta
que siempre está vacía. Va después de Beneficios y Reservas por eso, no por dificultad técnica.

---

## 6. S2 · Panel de negocio (fotógrafo o empresa)

Menú generado automáticamente desde el catálogo de módulos: Inicio, los módulos habilitados con
`route`, y Configuración al final.

| Orden | Etiqueta | Ruta | Estado |
|---:|---|---|---|
| 0 | Inicio | `/workspace` | ✅ |
| 10-89 | Los módulos habilitados, en el orden del catálogo | según módulo | ✅ |
| 90 | Configuración | `/workspace/configuracion` | ✅ |

Cuando llegue el perfil comercial completo, este menú recibe **las mismas secciones de S1 con
otro vocabulario** (P11): Clientes en vez de Socios, Presupuestos y Trabajos en vez de Cuotas.
Por eso conviene unificar las dos cáscaras antes, y no después, de construir esos módulos.

---

## 7. S5 · Sitio público

No es un menú del sistema: **lo arma la institución** desde el Website Builder
(`/website/navegacion`). FotoOffice solo garantiza que existan las páginas.

| Página | Ruta | Estado |
|---|---|---|
| Portada del workspace | `/w/[slug]` | ✅ |
| Asociarse | `/w/[slug]/asociarse` | ✅ |
| Cursos y ficha de curso | `/w/[slug]/cursos/…` | ✅ |
| Verificación de carnet por QR | `/c/[token]` | ✅ |
| Blog público | `/w/[slug]/blog` | ⬜ |
| Portfolios de socios | `/w/[slug]/socios` | ⬜ |

"Asociarse" solo se ofrece si la institución **puede cobrar**. Es deliberado: repartir un enlace
que recibe a la gente con "las inscripciones no están abiertas" es peor que no repartirlo.

---

## 8. S6 · Pantallas de foco

Sin menú, a propósito. Quien está en un trámite no necesita opciones: necesita terminarlo.

`/login` · `/invitacion/[token]` · `/recuperar/[token]` · `/onboarding` · `/elegir-perfil` ·
`/soy-socio` · inscripción a curso y sus desenlaces (éxito, pendiente, fallo).

**Regla:** nunca se le agrega menú a estas pantallas. Si una necesita que la persona vaya a otro
lado, lleva **un** enlace de salida, no una navegación.

---

## 9. Reglas de UX/UI del componente de menú

### 9.1 Ocultar el menú (pantalla completa)

| Aspecto | Regla |
|---|---|
| Qué hace | Oculta el menú entero y el contenido pasa a ocupar **todo el ancho** |
| Cómo se activa | Botón en el encabezado del menú y botón en la barra superior |
| Atajo | `Ctrl+B` (`⌘B` en Mac) |
| Se recuerda | Sí, en una cookie por navegador. Al volver, la pantalla está como se dejó |
| Sin parpadeo | La preferencia se lee en el servidor: nunca se ve el menú aparecer y desaparecer |
| En el teléfono | El menú es un cajón que se abre encima del contenido y se cierra al elegir una opción o al tocar afuera |

Por qué importa: el padrón, el diseñador de carnets y —cuando exista— el calendario de reservas
son pantallas anchas. Con 288 px de menú fijo, una tabla de socios queda apretada sin necesidad.

### 9.2 Marcado del ítem actual

Fondo de acento suave y texto en negrita. **Un solo ítem marcado a la vez** (P8). Cuando una
sección tenga subpantallas propias, la sección se marca y la subpantalla se muestra dentro del
contenido, no como segundo ítem iluminado.

### 9.3 Iconografía

Un ícono por ítem, de `lucide-react`, 16 px, alineado a la izquierda. El ícono **acompaña** a la
etiqueta; nunca la reemplaza. No hay menú de solo íconos: obliga a adivinar.

### 9.4 Accesibilidad

- El menú es `<nav aria-label="Principal">`.
- El botón de ocultar declara `aria-expanded` y `aria-controls`.
- Todo se alcanza con teclado, y el foco se ve.
- El estado actual no se comunica solo por color.

### 9.5 Lo que el menú no hace

- No muestra contadores en rojo salvo que exijan una acción concreta ("3 solicitudes sin
  responder" sí; "12 socios" no).
- No se reordena solo por uso: un menú que cambia de lugar obliga a leerlo entero cada vez.
- No tiene buscador. Si hiciera falta uno, es señal de que hay demasiadas opciones.

---

## 10. Cómo se habilita una opción nueva

Cinco pasos, en este orden. Saltarse uno es lo que produce menús incoherentes.

1. **Actualizar este documento.** Cambiar la fila de ⬜ a ✅ con su ruta, ícono, rol y orden
   definitivos. Si el módulo no está acá, primero se agrega.
2. **Registrar el módulo** en `apps/fotoffice/lib/modules/registry.ts` con `status: "AVAILABLE"`
   y su `route`. Mientras sea `PLANNED`, la clave queda reservada y no se ofrece como opción.
3. **Poner el control del servidor**: un `require…Context()` propio del módulo que verifique
   habilitación **y** rol, y redirija si falta alguna. Esto va antes que el menú, no después.
4. **Agregar el ítem al menú** en la sección y el orden que dice este documento.
5. **Encender el módulo** para el workspace que corresponda, desde su ficha en
   `/admin/workspaces/[id]`.

**Nunca al revés.** Un ítem de menú agregado antes del paso 3 es una puerta sin cerradura.

---

## 11. Estado de aplicación — 2026-08-28

Lo que se aplicó hoy sobre el panel de institución (S1), y solo sobre módulos activos:

| Cambio | Motivo |
|---|---|
| "Sitio web" pasó a la sección **Presencia pública**, con su encabezado | P5 — colgaba de Socios y parecía parte del padrón |
| **Evaluaciones** pasó a la sección Cursos | P4 — evalúa actividades de cursos |
| Formularios y Leads pasaron a la sección **Captación**, dentro del menú | Estaban escritos aparte, debajo del menú, con otro estilo |
| El subtítulo del logo muestra **el nombre de la institución** | Decía "Venta de cursos" en instituciones con el módulo de cursos apagado |
| El menú **se oculta** y el contenido pasa a pantalla completa | P10 — pedido explícito |
| Cajón lateral en el teléfono | El menú empujaba el contenido hacia abajo en cada pantalla |

Nada de lo marcado ⬜ se agregó al menú. Las claves de módulo planificadas ya estaban
reservadas en el catálogo desde antes y siguen sin ofrecerse como opción.
