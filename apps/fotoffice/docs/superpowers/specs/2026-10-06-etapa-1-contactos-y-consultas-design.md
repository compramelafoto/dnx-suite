# Etapa 1 · Contactos y Consultas

> 06/10/2026 · Reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §4). Se apoya en la Etapa 0, que
> está en producción desde el 06/10 (PR 277). Decisiones de Daniel del 06/10:
> - toda consulta tiene contacto;
> - se usan las 21 categorías de DNX con grupo;
> - aviso de consulta nueva al responsable, por correo y con una tarea;
> - sin prioridad.
>
> Las demás decisiones están marcadas **[decisión]**. **Sin staging:** todo va directo a producción. El
> análisis de brecha está en la conversación del 06/10, resumido en §1.

## 1. Qué problema resuelve

Después de la Etapa 0, **Consultas** (antes "Captación") tiene tablero con etapas, lista, ficha, tareas,
número, campos propios y respuesta automática. Faltan las piezas de fondo que DNX usa todos los días en
Alboom:

- **La consulta no está atada a nadie.** `ServiceSalesLead` copia nombre, correo y teléfono, pero no
  apunta a un Cliente. Una misma persona con tres consultas aparece tres veces, sin historial común.
- **Los tipos no son los de DNX.** Hay 9 tipos de evento fijos. DNX trabaja con 21 categorías en 4
  grupos, y cada grupo pide datos distintos: novios y lugares en una boda, invitados en un evento.
- **No se puede cargar a mano.** No hay "Nueva consulta", ni alta rápida en el tablero, ni importación.
- **Nadie del equipo se entera** cuando entra una consulta: sólo se le responde al cliente.
- **Los contactos tienen pocos datos:** falta categoría, celular, segundo correo, cumpleaños, web y
  dirección completa.
- **La lista no tiene acciones en lote**, ni filtros por origen, categoría o responsable.

## 2. Alcance

**Entra:**

1. **Contacto obligatorio en cada consulta.** Al crearla se busca por correo o teléfono; si no existe,
   se crea un Cliente con categoría "Contacto". La ficha del contacto lista todas sus consultas.
2. **Categorías de consulta por organización**, cada una con su grupo: Boda, Evento, Trabajo con fecha
   o Trabajo sin fecha. DNX arranca con sus 21. Los formularios existentes pasan a la categoría
   equivalente.
3. **Datos de la consulta según el grupo:**
   - fecha y hora del evento;
   - lugar o, en una boda, lugar de ceremonia y de recepción;
   - ciudad;
   - invitados;
   - nombres de los novios.

   Para todas, además: origen, referente, valor estimado, fecha de cierre prevista y participantes con
   su rol.
4. **Orígenes** como catálogo por organización ("¿Cómo nos conociste?").
5. **Altas:**
   - "Nueva consulta" manual;
   - alta rápida desde la primera columna del tablero;
   - formulario web con categoría y origen;
   - importación CSV de consultas y de contactos, con detección de duplicados.
6. **Aviso de consulta nueva:** correo al responsable de consultas nuevas (o al dueño si no hay uno) y
   una tarea "Responder consulta" que vence ese mismo día.
7. **Siguiente acción editable a mano** en la ficha y en lote. Hoy sólo la calcula la etapa.
8. **Aviso de fechas superpuestas:** si otra consulta abierta tiene el mismo día de evento, se avisa en
   el alta y en la ficha. No bloquea.
9. **Lista y tablero:**
   - acciones en lote: responsable, siguiente acción, cerrar como perdida y mover de circuito;
   - filtros por categoría, origen y responsable;
   - columna "Valor" y total de valor por columna del tablero.
10. **Contactos ampliados:** categoría (Contacto, Cliente, Proveedor o Colaborador), celular, segundo
    correo, cumpleaños, sitio web, provincia, país, código postal y "Sobre". Se ven y se editan en la
    ficha del cliente y se pueden usar como filtros en Clientes.

**No entra (queda anotado):**

- **Prioridad** (decisión de Daniel).
- **Seguimiento automático a los N días del presupuesto:** llega con Presupuestos (etapa 2).
- **Notas, etiquetas y adjuntos propios de la consulta [decisión]:** la ficha de la consulta muestra los
  de su contacto. Se suman a la consulta si hace falta más adelante.
- **Participantes en proyectos y citas:** etapa 4.
- **Conflicto de fechas con pedidos:** etapa 3.

## 3. Cómo lo vive quien usa el sistema

### 3.1 Nueva consulta

- **Botón "Nueva consulta"** en el tablero y en la lista. El formulario pide:
  1. contacto: buscador por nombre, correo o teléfono, o "Contacto nuevo" con nombre, correo y teléfono;
  2. categoría;
  3. los datos del grupo;
  4. origen;
  5. valor estimado;
  6. responsable;
  7. mensaje o nota inicial.
- **Contacto duplicado:** si el correo o el teléfono ya existen, ofrece usar ese contacto en lugar de
  crear otro.
- **Alta rápida en el tablero:** en la primera columna, un renglón con nombre, teléfono o correo y
  categoría. El resto se completa en la ficha.
- **Al guardar:**
  - se asigna número (0.5);
  - entra al circuito predeterminado (0.4);
  - se crea la tarea "Responder consulta" para el responsable;
  - se manda el aviso.

  En las altas manuales no hay respuesta automática al cliente.
- **Aviso de fecha superpuesta:** si el día del evento coincide con otra consulta abierta, se muestra un
  cartel con un enlace a esa consulta. No bloquea.

### 3.2 Ficha de la consulta

- **Título:** "Consulta N° 2026-0042 · Nombre", y debajo la categoría.
- **Columna de datos:**
  - contacto (enlace a su ficha);
  - categoría;
  - los datos del grupo;
  - origen;
  - referente;
  - valor;
  - cierre previsto;
  - responsable;
  - siguiente acción, editable;
  - participantes.
- **Lo demás sigue igual:** recorrido, tareas, mensajes, "Más datos" e historial.
- **Notas, etiquetas y adjuntos:** se muestran los del contacto, con un enlace "Ver ficha del contacto"
  **[decisión]**.
- **Participantes:**
  - cada uno es un contacto con un rol (Salón, DJ, Fotógrafo secundario…) y una nota;
  - DNX arranca con sus 16 roles;
  - el rol se elige de una lista que cada organización edita.

### 3.3 Ficha del contacto

- **Tarjeta "Consultas"** con todas sus consultas: número, categoría, fecha del evento, etapa o
  resultado, y valor. Incluye el botón "Nueva consulta para este contacto".
- **Datos ampliados** en la columna de datos, editables con `operar` en Clientes.
- **Categoría del contacto:** Contacto, Cliente, Proveedor o Colaborador.
  - Una consulta ganada pasa al contacto de "Contacto" a "Cliente" de forma automática **[decisión]**.
  - Las otras categorías no se tocan solas.

### 3.4 Configuración → Consultas

Una pantalla nueva, con permiso `configurar` y pestañas:

- **Categorías:**
  - nombre, grupo, orden y archivar;
  - una categoría con consultas no se borra: se archiva;
  - el grupo de una categoría usada no cambia **[decisión]**.
- **Orígenes:** nombre, orden y archivar.
  - DNX arranca con Instagram, Facebook, Google, Recomendación, Sitio web, WhatsApp, Cliente anterior y
    Otro **[decisión: el relevamiento no listó los 8 de Alboom]**.
- **Roles de participante:** nombre, orden y archivar.
- **Avisos:**
  - responsable de consultas nuevas: una persona del equipo con "Gestionar" en Consultas, o vacío, que
    avisa al dueño;
  - mandar correo: sí o no;
  - crear tarea: sí o no.

### 3.5 Formulario web

- **El formulario elige una categoría propia** en lugar de los 9 tipos. Los formularios existentes se
  pasan solos a la categoría equivalente.
- **Campos según el grupo:**
  - el visitante ve los campos del grupo de esa categoría;
  - el `metaJson` actual se sigue leyendo, por compatibilidad;
  - lo nuevo va a las tablas nuevas.
- **"¿Cómo nos conociste?"** es opcional, con los orígenes activos.
- **Contacto:** se busca por correo y luego por teléfono; si no aparece, se crea un "Contacto".
- **Después del alta,** en este orden:
  1. número;
  2. circuito;
  3. aviso al equipo y tarea;
  4. respuesta automática (0.6).

  Cada paso va separado: si uno falla, la consulta queda igual.

### 3.6 Importación CSV

- **Consultas** (Consultas → Importar) **[decisión]**:
  - columnas reconocidas: nombre, correo, teléfono, categoría (por nombre), fecha del evento, lugar,
    invitados, origen, valor, responsable (por correo), etapa (por nombre) y nota;
  - vista previa con errores por fila antes de confirmar;
  - el contacto se busca o se crea igual que en el alta;
  - hasta 2.000 filas por vez;
  - no manda respuestas automáticas ni avisos.
- **Contactos** (Clientes → Importar): se amplía la importación existente con los datos nuevos y la
  categoría.

### 3.7 Lista y tablero

- **Lista:**
  - columnas nuevas: categoría, origen, valor y responsable;
  - filtros por categoría, origen, responsable y siguiente acción (vencida, hoy, esta semana).
- **Acciones en lote** (con `operar`):
  - asignar responsable;
  - fijar siguiente acción;
  - cerrar como perdida, con motivo;
  - mover a otro circuito.

  Cada acción queda en la bitácora de la lista (0.2) y en el historial de cada consulta.
- **Tablero:**
  - total de valor por columna;
  - la tarjeta muestra categoría, fecha del evento y valor.

## 4. Cómo está hecho

### 4.1 Datos (sólo tablas nuevas de FOTOFFICE)

`ServiceSalesLead` y `Client` no reciben columnas. CompraMeLaFoto lee `ServiceSalesLead` y el esquema es
compartido.

- **`FotofficeConsulta`** (1:1 con `ServiceSalesLead` por `leadId`, único):
  - workspaceId;
  - **clientId** (obligatorio, FK a `Client`);
  - categoryId;
  - originId;
  - referrerClientId (opcional);
  - estimatedValue (Decimal);
  - expectedCloseDate (date);
  - eventStartsAt (timestamp, opcional; el día también se refleja en `ServiceSalesLead.eventDate` para
    lo existente);
  - eventTimeKnown (bool);
  - venue;
  - ceremonyVenue;
  - receptionVenue;
  - city;
  - guests (int);
  - partnerOneName;
  - partnerTwoName;
  - createdAt;
  - updatedAt.

  Índices: (workspaceId, clientId), (workspaceId, categoryId), (workspaceId, originId) y
  (workspaceId, eventStartsAt).
- **`FotofficeConsultaCategoria`:**
  - workspaceId, name, group (`BODA` | `EVENTO` | `TRABAJO_CON_FECHA` | `TRABAJO_SIN_FECHA`), order,
    archivedAt, legacyEventType (para mapear los 9 tipos viejos y los formularios);
  - único (workspaceId, name).
- **`FotofficeOrigen`:** workspaceId, name, order, archivedAt; único (workspaceId, name).
- **`FotofficeRolParticipante`:** workspaceId, name, order, archivedAt.
- **`FotofficeConsultaParticipante`:** workspaceId, consultaId, clientId, roleId, note, createdAt; único
  (consultaId, clientId, roleId).
- **`FotofficeContactoPerfil`** (1:1 con `Client` por `clientId`, único):
  - workspaceId;
  - category (`CONTACTO` | `CLIENTE` | `PROVEEDOR` | `COLABORADOR`, por defecto `CLIENTE` para los que ya
    existen y `CONTACTO` para los creados por una consulta);
  - mobile;
  - email2;
  - birthday (date);
  - website;
  - province;
  - country;
  - postalCode;
  - about;
  - updatedAt.
- **`FotofficeConsultaAjustes`** (1 por workspace): defaultOwnerUserId, notifyEmail, createTask.
- **Siguiente acción manual:** se guarda en `FotofficeJourney.stageDueAt`, el mismo vencimiento de 0.4.
  Al editarlo a mano queda en el historial. Al cambiar de etapa se vuelve a calcular, como hoy
  **[decisión]**.
- **Enganche de lo existente** (en código, en lotes, como el de 0.4 y 0.5):
  - cada `ServiceSalesLead` sin `FotofficeConsulta` busca o crea su contacto por correo o teléfono;
  - recibe la categoría equivalente a su `eventType`;
  - copia lugar y fecha.

  Es idempotente y tiene un tope por llamada.

### 4.2 Código

- **`lib/consultas/`:**
  - `contacto.ts`: buscar o crear, reutilizando `lib/clients/find-or-create.ts` y `match.ts`;
  - `categorias.ts`, `origenes.ts`, `participantes.ts`;
  - `alta.ts`: un solo camino para el alta manual, la rápida, el formulario y la importación, que hace
    número, circuito, aviso y tarea, cada paso separado;
  - `aviso.ts`: correo con la plantilla del sistema y tarea;
  - `fechas.ts`: superposición de fechas;
  - `enganche.ts`;
  - `importar.ts`.
- **`lib/contactos/perfil.ts`.**
- **Pantallas:**
  - `app/(shell)/consultas/nueva`;
  - el alta rápida en `components/circuitos/tablero.tsx`;
  - la ficha de la consulta y la del cliente;
  - `app/workspace/configuracion/consultas`;
  - los listados de Consultas y Clientes;
  - el formulario público (`app/actions/service-lead.ts` y la pantalla del formulario).
- **Permisos** (sistema de roles de main):
  - ver y crear consultas: nivel del módulo Consultas (`service-leads`); "Gestionar" para crear y editar;
  - datos del contacto: nivel de Clientes;
  - configurar: dueño o administrador.

### 4.3 Aviso de consulta nueva

- **Correo al responsable** con la plantilla del sistema "Aviso de consulta nueva" (0.6, canal Correo,
  ficha Consulta). Es editable en Configuración → Plantillas → Automáticos, junto a la respuesta
  automática.
- **Tarea** "Responder consulta" para el responsable, que vence el mismo día a las 23:59 (hora de
  Buenos Aires).
- **Uso del tope:** el correo interno no cuenta para el tope de 200 por día. Usa el remitente de
  FOTOFFICE y va sólo a usuarios del equipo **[decisión]**.

## 5. Errores y casos borde

- **Contacto con mismo correo y distinto teléfono, o al revés:** se usa el que coincide por correo. Si
  hay varios, el más reciente, y la ficha muestra "Posible duplicado" con enlace a la fusión de
  contactos (`lib/clients/merge.ts`).
- **Categoría archivada:** las consultas viejas la siguen mostrando, pero no se ofrece en altas nuevas.
- **Formulario con categoría archivada:** usa "Otro" del mismo grupo si existe, o la primera activa del
  grupo, y avisa en Configuración.
- **Fecha superpuesta:** sólo avisa.
- **Importación:** filas inválidas se informan y no se cargan, y el resto sí **[decisión]**. Si se repite
  la misma importación, no duplica las filas con mismo correo + categoría + fecha del evento.
- **Falla del aviso o de la tarea:** la consulta queda creada y el error va al registro, sin datos
  personales.

## 6. Pruebas

- **Alta:**
  - busca y crea el contacto (correo, teléfono, ninguno);
  - número, circuito, tarea y aviso, en orden y cada uno aislado;
  - la respuesta automática sale sólo desde el formulario.
- **Enganche:** las consultas viejas quedan con contacto y categoría una sola vez, en lotes.
- **Categorías:** archivar contra borrar; el grupo no cambia si está usada; los formularios se pasan.
- **Superposición de fechas.**
- **Acciones en lote** con permisos.
- **Importación:** vista previa, errores por fila, duplicados.
- **Contacto:** perfil ampliado; pasa a "Cliente" al ganar.
- **Aislamiento por workspace** en todo.

## 7. Criterios para el tablero de avance

1. Una consulta del formulario web aparece atada a su contacto, y el responsable recibe correo y tarea.
2. Daniel carga una consulta de boda a mano con novios y lugares, y ve el aviso de fecha superpuesta.
3. Desde la ficha de un contacto se ven todas sus consultas.
4. Se importa un CSV de consultas viejas sin duplicar contactos.
5. En la lista se asigna responsable a 10 consultas de una vez.

## 8. Orden de publicación (sin staging)

1. SQL de las tablas nuevas en la base de FOTOFFICE de producción.
2. Código.
3. El enganche ata las consultas existentes al abrir Consultas.
4. Prueba en DNX Estudio con una consulta real del formulario.
