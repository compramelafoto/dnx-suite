# Etapa 0.6 · Plantillas de mensajes

> 01/10/2026 · Diseñado de forma autónoma por pedido de Daniel ("seguí, no te detengas, no me preguntes
> más"). Las decisiones están marcadas **[decisión]** para revisarlas. Es la última parte de la Etapa 0
> (Cimientos) del reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §2.6 y §4) y se apoya en
> 0.1–0.5 (PR 277, 281, 286, 290, 294). **Sin staging:** todo va directo a producción (pedido de Daniel
> del 01/10).

## 1. Qué problema resuelve

**En Alboom** (`05-…` §3.13–3.15 y §5, `09-…`):

- Hay 21 correos "del sistema" con variables `[clave]` y bloques condicionales.
- Hay plantillas de correo "personales" y plantillas de WhatsApp.
- Las de WhatsApp **no reemplazan las variables**: copian el texto tal cual, abren `api.whatsapp.com` y
  registran el mensaje como enviado aunque nadie lo haya mandado.
- Las de DNX están incompletas o son de prueba ("o", "PRUEBA HTML", la pestaña en portugués).
- El "Presupuesto Estándar Master" tiene el cuerpo vacío.

**En FOTOFFICE hoy:**

- Todo correo está escrito en el código: coberturas, membresía, invitaciones.
- La organización sólo puede editar la nota de su firma.
- WhatsApp es un enlace sin texto en la ficha.
- No queda registro, en la ficha de la persona, de qué se le mandó.

## 2. Alcance

**Entra:**

1. **Plantillas de mensajes por organización** (Configuración → Plantillas), de dos canales:
   **Correo** (asunto + cuerpo) y **WhatsApp** (cuerpo). Las dos usan las mismas variables.
2. **Motor de variables** en español, con bloques condicionales y vista previa con datos reales.
3. **"Enviar mensaje" desde la ficha** de Cliente, Socio y Consulta. Se elige una plantilla (o se escribe
   libre), se ve con los datos de esa persona, se puede retocar y:
   - **Correo:** se envía desde FOTOFFICE.
   - **WhatsApp:** se abre WhatsApp con el texto ya completo.
4. **Registro de mensajes**: cada envío queda en la línea de tiempo de la persona (tipo "Mensajes") y en
   el historial de la Consulta.
   - WhatsApp queda como **"Abierto en WhatsApp"**, no como "enviado" (corrige el defecto de Alboom).
5. **Un mensaje automático**: "Respuesta automática a una consulta nueva" de Captación. Es editable y
   viene **apagado** de fábrica.
6. **Plantillas iniciales de DNX** corregidas y completas (§3.6).

**No entra (queda anotado):**

- **Adjuntos en plantillas.** Llegan con Presupuestos (etapa 2). Mientras tanto, un enlace dentro del
  texto cumple esa función.
- **Pasar a plantillas editables los correos que hoy están en el código** (coberturas, membresía,
  invitaciones). Siguen como están; cada módulo los suma al catálogo de "automáticos" cuando se rehaga.
- **Envío por la API de WhatsApp Business.**
- **Correo masivo o a varios destinatarios.**
- **Seguimiento de apertura del correo.**
- **Editor con formato.** Ver la [decisión] de §3.2.
- **Variables de Presupuesto, Pedido, Contrato, Proyecto y Galería.** Cada etapa agrega las suyas al
  catálogo.

## 3. Cómo lo vive quien usa el sistema

### 3.1 Configuración → Plantillas

- Hay dos pestañas: **Correo** y **WhatsApp**. Cada una tiene la lista de plantillas con nombre, "para
  qué ficha" y orden (subir/bajar), y las acciones archivar, desarchivar, duplicar y borrar.
- **Para qué ficha [decisión]:** General, Cliente, Socio (con el vocabulario de la organización) o
  Consulta.
  - Define qué variables se pueden usar y en qué ficha se ofrece la plantilla.
  - Las "General" se ofrecen en todas las fichas y sólo usan variables de persona, organización y
    usuario.
- **Editor:**
  - nombre (1–80);
  - asunto (sólo Correo, hasta 200);
  - cuerpo (hasta 10.000 en Correo y 4.000 en WhatsApp);
  - al costado, la **lista de variables disponibles**: un clic las inserta donde está el cursor;
  - **vista previa** con datos de ejemplo, o con un registro real elegido de un buscador.
- Al guardar se rechaza una variable que no existe para ese tipo de ficha (por ejemplo,
  `[consulta_numero]` en una plantilla de Socio), y se dice cuál es.
- Una plantilla se **borra** si nunca se usó. Si se usó, sólo se **archiva**: el registro de mensajes
  guarda el texto enviado, no depende de la plantilla.
- Máximo **100 plantillas activas por canal [decisión]**.
- **Mensajes automáticos:** una tercera sección con la lista de momentos. En 0.6 hay uno solo:
  "Respuesta automática a una consulta nueva". Tiene interruptor, asunto y cuerpo, y por qué ficha y
  canal se manda (Consulta, Correo).
- Permiso: `configurar`.

### 3.2 Cómo se escribe una plantilla

- **Variables entre corchetes y en español [decisión]:** `[nombre]`, `[consulta_numero]`,
  `[organizacion_telefono]`.
  - Se usan corchetes, como en Alboom, para que la migración (etapa 8) traduzca sus textos con una tabla
    de equivalencias (`[customer_firstname]` → `[nombre]`).
- **Bloque condicional:** `[si:clave]…[/si]`. Desaparece entero si la variable está vacía. Ejemplo:
  `[si:consulta_fecha]para tu evento del [consulta_fecha][/si]`.
- **Campos personalizados (0.5):** `[campo:clave]`. Se ofrecen en la lista según la ficha.
- **Formato del cuerpo [decisión]: texto plano**, sin editor de formato. Es la misma regla que la firma
  hoy ("texto plano, nunca HTML") y evita sumar una dependencia nueva.
  - En el correo, cada línea en blanco arma un párrafo y los enlaces `http(s)://` se vuelven clicables.
  - Todo lo demás se escapa: un nombre con `<` nunca rompe el correo.
- **Firma:** `[firma]` pone la firma de la organización que ya existe (`FotofficeWorkspaceBranding`).
  - En Correo, si el cuerpo no la tiene, se agrega al final.
  - En WhatsApp nunca se agrega sola.
- Una variable vacía queda vacía (no deja `[nombre]` a la vista), y la vista previa la marca en
  amarillo para que se note antes de enviar.

### 3.3 Variables (catálogo inicial)

| Grupo | Variables | Disponibles en |
|---|---|---|
| Persona | `[nombre]` (nombre de pila), `[nombre_completo]`, `[apellido]`, `[email]`, `[telefono]` | todas |
| Organización | `[organizacion]`, `[organizacion_email]`, `[organizacion_telefono]`, `[organizacion_whatsapp]`, `[organizacion_web]`, `[organizacion_instagram]`, `[organizacion_ciudad]`, `[firma]` | todas |
| Usuario que envía | `[usuario_nombre]`, `[usuario_email]` | todas |
| Fecha | `[hoy]` (dd/mm/aaaa, hora de Buenos Aires) | todas |
| Consulta | `[consulta_numero]`, `[consulta_tipo]`, `[consulta_fecha]`, `[consulta_lugar]`, `[consulta_mensaje]`, `[consulta_etapa]` | Consulta |
| Socio | `[socio_numero]` (si la organización usa número de socio) | Socio |
| Campos | `[campo:<clave>]` de los campos activos del tipo de ficha | Cliente, Socio y Consulta |

- "Nombre de pila" es la primera palabra del nombre.
- El catálogo es **código, no base**: una lista con nombre, descripción, grupo, tipos de ficha y cómo
  se obtiene. Cada etapa futura agrega filas (Presupuesto, Pedido…).

### 3.4 Enviar un mensaje desde la ficha

- La ficha de Cliente, Socio y Consulta tiene un botón **"Mensaje"** con dos opciones: Correo y
  WhatsApp.
- Se abre un panel:
  - plantilla (las activas del canal para esa ficha, más las "General") o "Sin plantilla";
  - asunto y cuerpo ya completos con los datos;
  - las variables vacías marcadas;
  - se puede retocar el texto antes de enviar.
- **Correo:**
  - Va **sólo a la dirección de la persona [decisión]**, sin otros destinatarios.
  - Sale con el remitente de FOTOFFICE que ya existe (`FOTOFFICE_NOTIFICATIONS_FROM`), con el nombre
    de la organización como nombre visible y **"responder a"** el correo de contacto de la
    organización.
  - Si la persona no tiene correo, el botón lo dice y no deja enviar.
  - **Tope: 200 correos por día por organización [decisión]**, para cuidar la reputación del remitente.
    Al llegar al tope se avisa.
- **WhatsApp:**
  - Arma el enlace `wa.me` con el texto completo, con el número normalizado como ya hace
    `lib/contact/whatsapp.ts`.
  - Lo abre en otra pestaña y lo registra como "Abierto en WhatsApp".
  - Sin teléfono, no se ofrece.
- Cada mensaje queda en el registro con canal, plantilla usada, destino, asunto, cuerpo final, estado
  ("Enviado", "Falló: motivo", "Abierto en WhatsApp"), quién y cuándo.
  - Se ve en la línea de tiempo (proveedor nuevo `mensajes`) de Cliente/Socio y en el historial de la
    Consulta.
  - El cuerpo se muestra recortado, con "ver completo".
- Permiso: `operar`.

### 3.5 Respuesta automática a una consulta nueva

- Si está encendida y la consulta trae correo, al llegar una consulta por el formulario público se le
  manda el correo con la plantilla.
- **No se manda** en las consultas cargadas a mano ni en las inscripciones presenciales **[decisión]**.
- **Va después de guardar la consulta y después del número (0.5):** si el correo falla, la consulta queda
  igual y el fallo queda registrado.
- Queda en el registro de la consulta como "Automático".
- **Contra el abuso del formulario público (ruling R11):** sólo con Captación activa (apagarla
  siempre se puede); tope propio de **50 automáticos por día** y organización, que no consume los 200
  manuales; **una sola respuesta por dirección cada 24 h**; largos máximos en el formulario y un freno
  por IP; las respuestas iniciales no repiten `[consulta_mensaje]`.

### 3.6 Plantillas iniciales de DNX [decisión]

Se crean en código, una sola vez, al abrir Configuración → Plantillas o el panel "Mensaje" (como los
circuitos en 0.4). Son textos nuevos en español rioplatense, escritos a partir de lo que dicen las de
Alboom, no copiados (decisión del 29/09):

- **Correo:**
  - "¡Gracias por elegirnos!" (Cliente)
  - "Ya falta poco para tu evento" (Consulta, con fecha y lugar condicionales)
  - "Te enviamos tu foto carnet" (Cliente)
  - "Propuesta para tu evento" (Consulta: reemplaza al "Presupuesto personalizado" con enlace a la agenda)
  - "Seguimiento de la propuesta" (Consulta)
- **WhatsApp:**
  - "Recibimos tu consulta" (Consulta)
  - "Coordinar entrevista" (Consulta)
- **Respuesta automática** a la consulta nueva (Consulta), con el texto de Alboom corregido. **Queda
  apagada** hasta que Daniel la encienda.

## 4. Cómo está hecho

### 4.1 Datos

- `FotofficeMessageTemplate`: workspaceId, channel (`EMAIL` | `WHATSAPP`), entityType (`GENERAL` |
  `CLIENTE` | `SOCIO` | `CONSULTA`), name, subject (sólo correo), body, systemKey (null en las comunes;
  `CONSULTA_AUTORESPUESTA` en la automática), enabled (sólo automáticas), order, archivedAt, createdAt,
  updatedAt, updatedByUserId.
  - Índice único parcial (workspaceId, systemKey) donde systemKey no es null.
  - CHECK: asunto obligatorio en correo y nulo en WhatsApp.
- `FotofficeMessage` (registro): workspaceId, channel, entityType, entityId (polimórfico, validado en
  código como en 0.5), templateId (nullable, sin borrar en cascada), toAddress, subject, body,
  status (`SENT` | `FAILED` | `OPENED_WHATSAPP`), automatic, providerId, errorCode, actorUserId,
  actorLabel, createdAt.
  - Índices: (workspaceId, entityType, entityId, createdAt) y (workspaceId, createdAt) para el tope
    diario.
- Dos tablas nuevas, sólo de FOTOFFICE. Ninguna columna en tablas existentes.

### 4.2 Código

- `lib/plantillas/`:
  - `variables.ts`: catálogo, puro.
  - `motor.ts`: análisis del texto (variables, bloques, errores), puro y con pruebas exhaustivas.
  - `render.ts`: texto → HTML seguro del correo y texto de WhatsApp, puro.
  - `contexto.ts`: arma los valores para un registro del workspace, en lote, reutilizando
    `lib/ficha/persona.ts`, `numeroDe` (0.5), `valoresDe` (0.5) y la firma.
  - `definiciones.ts`: altas, bajas y cambios.
  - `semillas.ts`
  - `envio.ts`: correo con `sendTransactionalEmail`, que nunca lanza; enlace de WhatsApp; registro y
    tope.
- `app/workspace/configuracion/plantillas/*`, `components/mensajes/*` (panel de la ficha) y el
  proveedor `lib/ficha/proveedores/mensajes.ts`.
- La autorespuesta se engancha en `app/actions/service-lead.ts`, en el mismo punto posterior al alta
  donde 0.5 asigna el número.

### 4.3 Permisos

| Qué | Capacidad |
|---|---|
| Ver y usar plantillas, enviar mensajes | `operar` |
| Ver el registro de mensajes | la guarda de cada ficha |
| Configurar plantillas y automáticos | `configurar` |

## 5. Errores y casos borde

- **Variable desconocida o bloque mal cerrado:** se rechaza al guardar, con la posición.
- **Variable vacía:** queda vacía. Un bloque condicional se quita.
- **Correo que falla** (Resend caído, falta configuración): se muestra el motivo y queda registrado como
  "Falló". No se reintenta solo **[decisión]**.
- **Tope diario alcanzado:** no se envía, se avisa y no se registra como enviado.
- **Persona de otro workspace o registro inexistente:** "no encontrado".
- **Plantilla archivada o de otra ficha** elegida a mano (id manipulado): se rechaza.
- **Texto con HTML o scripts:** siempre se escapa. Los enlaces sólo se vuelven clicables si son
  `http(s)`.
- **Dos personas editan la misma plantilla:** gana la última [decisión], igual que en "Más datos".

## 6. Pruebas

- **Motor:** variables, bloques (anidados no permitidos [decisión]), escapes, nombre de pila,
  `[campo:…]`, errores con posición.
- **Render:** párrafos, enlaces, XSS, firma agregada sólo en correo.
- **Contexto:** aislamiento por workspace; datos reales de Cliente, Socio y Consulta; número y campos.
- **Envío:**
  - correo enviado, fallido y en el tope;
  - WhatsApp registrado como abierto;
  - permisos (`operar` / `configurar`).
- **Autorespuesta:**
  - sólo desde el formulario público;
  - apagada no se manda;
  - si falla, no rompe el alta.
- **Fichas:** el proveedor `mensajes` está acotado por persona y workspace.

## 7. Criterios para el tablero de avance

1. Daniel edita "Propuesta para tu evento" y la vista previa muestra los datos de una consulta real.
2. Desde la ficha de una consulta se manda un correo y aparece en su historial.
3. Desde la ficha de un cliente se abre WhatsApp con el texto completo, y queda registrado como
   "Abierto en WhatsApp".
4. Encendida la respuesta automática, una consulta del formulario público recibe el correo.

## 8. Orden de publicación (sin staging)

1. 0.1–0.5 fusionadas (PR 277, 281, 286, 290, 294), cada una con su SQL antes que el código.
2. SQL de las dos tablas nuevas en la base de FOTOFFICE de producción.
3. Código.
4. Prueba en producción:
   - mandar un correo de prueba a una ficha propia de Daniel;
   - abrir un WhatsApp al número de Daniel;
   - encender la respuesta automática y hacer una consulta de prueba.
