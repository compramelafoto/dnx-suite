# Etapa 0.5 · Campos personalizados y numeración

> 01/10/2026 · Diseñado de forma autónoma por pedido de Daniel ("seguí, no te detengas, no me preguntes
> más"): las decisiones están marcadas **[decisión]** para revisarlas. Parte de la Etapa 0 (Cimientos) del
> reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §2 y §4). Se apoya en 0.1–0.4
> (PR 277, 281, 286, 290).

## 1. Qué problema resuelve

**Campos.** Alboom tiene "Campos Adicionales" fijos: 4 de texto y 2 de fecha por entidad (Contacto,
Oportunidad, Pedido, Proyecto), sólo se les cambia el nombre, no tienen tipo, no se filtran ni se ven en
listas, y tienen errores (la Oportunidad muestra las etiquetas del Pedido). DNX usa uno solo: el enlace a
los archivos del cliente (`docs/alboom/05-…` §3.9, `09-…`). FOTOFFICE no tiene ningún campo propio:
`Client` y `Member` tienen columnas fijas y `ServiceSalesLead.metaJson` no se muestra en ningún lado.

**Numeración.** Alboom tiene un contador por tabla (Oportunidades, Presupuestos, Pedidos, Facturas,
Contratos, Proyectos): sólo se fija el número inicial, no se puede bajar, sin prefijo ni año. DNX hoy:
Presupuestos 2025261, Pedidos 2025094, Contratos 2025093, Proyectos 2025566. En FOTOFFICE cada número se
calcula leyendo el último y sumando uno (clientes, carnets, coberturas), sin configuración, y las
consultas de Captación no tienen número.

## 2. Alcance

**Entra:**

1. Campos personalizados por organización para **Cliente**, **Socio** y **Consulta** (Captación), con
   tipo, obligatorio, orden y archivo; se ven y se editan en la ficha, se muestran como columna y filtro
   en los listados, se exportan y se buscan.
2. Numeración configurable por organización (Configuración → Numeración) con contador real en la base.
3. **Estreno de la numeración en Captación**: cada consulta tiene número ("Consulta N° 2026-0042" o el
   formato elegido), visible en el tablero, la lista y la ficha, y buscable.
4. Secuencias declaradas y listas para Presupuestos, Pedidos, Contratos y Proyectos (sin registros que
   las usen todavía).

**No entra (queda anotado):**

- Campos en Presupuestos, Pedidos, Contratos y Proyectos: se suman cuando existan esos módulos (el diseño
  ya los admite).
- Usar campos y números como variables de plantillas: etapa 0.6.
- Campos visibles o editables en el portal del cliente/socio.
- Campos por categoría de trabajo (boda, evento…): llegan con Consultas (etapa 1).
- Fijar los números de DNX desde Alboom: se hace en la migración (etapa 8), con la regla "no se puede
  bajar".

## 3. Cómo lo vive quien usa el sistema

### 3.1 Campos personalizados (Configuración → Campos)

- Una pestaña por tipo de registro: **Clientes**, **Socios** (con el vocabulario de la organización),
  **Consultas**.
- Cada campo: nombre (1–60), **tipo**, obligatorio sí/no, "mostrar en el listado" sí/no, orden
  (arrastrar o subir/bajar) y, para "Lista", sus opciones.
- Tipos **[decisión]**: Texto corto, Texto largo, Número, Fecha, Sí/No, Lista (una opción), Enlace
  (URL que se abre en otra pestaña). Moneda y lista de varias opciones quedan para después.
- Un campo no se borra si tiene valores: se **archiva** (deja de verse en fichas y listados; los valores
  quedan guardados y vuelven si se desarchiva). Sin valores, se borra.
- Cambiar el tipo de un campo con valores no se permite (se crea uno nuevo).
- Las opciones de una Lista se pueden agregar y renombrar; una opción usada no se borra, se archiva.
- Máximo 40 campos activos por tipo de registro **[decisión]**.
- Permiso: `configurar`.
- **DNX arranca con un campo** en Clientes: "Archivos del cliente" (Enlace), el único que usa en Alboom
  **[decisión]**; la migración (etapa 8) lo completa.

### 3.2 En la ficha

- Una tarjeta **"Más datos"** en la columna de datos de la ficha de Cliente, de Socio y de Consulta, con
  los campos activos en su orden. Cada uno muestra su valor (fecha en dd/mm/aaaa, Sí/No, enlace
  clicable) y se edita en el lugar (botón "Editar" de la tarjeta → formulario con todos los campos →
  Guardar).
- Obligatorio: no deja guardar la tarjeta vacío ese campo. **[decisión]** No bloquea el resto de la ficha
  ni el alta de clientes/socios/consultas (que no piden campos personalizados): el obligatorio vale
  cuando se edita "Más datos", y la tarjeta marca en rojo los obligatorios vacíos.
- Cada cambio queda en el historial: en la línea de tiempo de la persona (Cliente/Socio, tipo "Cambios")
  y en el historial de la Consulta, con antes → después.
- Permiso para editar valores: `operar`.

### 3.3 En los listados (0.2)

- Los campos con "mostrar en el listado" aparecen como columnas secundarias en Clientes, Socios y
  Captación (lista).
- Filtros: Lista y Sí/No como filtros de opción; Fecha como período; Número sin filtro **[decisión]**.
- La búsqueda general también busca en los campos de Texto corto, Texto largo y Enlace.
- La exportación a Excel incluye todos los campos activos (no sólo los del listado).

### 3.4 Numeración (Configuración → Numeración)

- Una fila por secuencia: **Consultas**, **Presupuestos**, **Pedidos**, **Contratos**, **Proyectos**.
- Formato, por secuencia **[decisión]**:
  - **Prefijo** opcional (hasta 8 caracteres, letras/números/guion), p. ej. "P-".
  - **Año** sí/no: si sí, el número incluye el año de creación (hora de Buenos Aires) y el contador
    vuelve a 1 cada año.
  - **Dígitos** mínimos (1–8; se completa con ceros).
  - **Próximo número**.
  - Vista previa del próximo: "P-2026-0042".
- **Regla de Alboom que se conserva:** el próximo número no se puede bajar por debajo del último usado
  ("No se puede volver a un número ya usado"). Cada cambio queda registrado (quién, cuándo, antes → después).
- Valores iniciales: Consultas con año y 4 dígitos ("2026-0001"); Presupuestos, Pedidos, Contratos y
  Proyectos **sin año, sin prefijo**, empezando en 1 — así DNX puede continuar exactamente la numeración
  de Alboom (2025262, 2025095…) fijando el próximo número en la migración. **[decisión]**
- Permiso: `configurar`.

### 3.5 Captación con número

- Cada consulta nueva recibe su número al crearse (formulario público incluido); las existentes reciben
  número en el enganche que ya corre al abrir Captación (0.4), en orden de fecha de alta y con el año de
  su fecha de alta.
- Se ve en la tarjeta del tablero, en la lista (columna "N°", ordenable y buscable) y en el título de la
  ficha ("Consulta N° 2026-0042 · Nombre").

## 4. Cómo está hecho

### 4.1 Campos

- `FotofficeCustomField`: workspaceId, entityType (`CLIENTE` | `SOCIO` | `CONSULTA`; reservados
  `PRESUPUESTO`, `PEDIDO`, `CONTRATO`, `PROYECTO`), key (estable, generada del nombre al crear; nunca
  cambia), name, type, required, showInList, order, archivedAt, createdAt; único (workspaceId,
  entityType, key).
- `FotofficeCustomFieldOption`: fieldId, label, order, archivedAt.
- `FotofficeCustomValue`: workspaceId, fieldId, entityType, entityId, valueText, valueNumber (Decimal),
  valueDate, valueBool, optionId, updatedAt, updatedByUserId; único (fieldId, entityId). Sin FK al
  registro (polimórfico, como `FotofficeJourney`): se valida en el código que el registro sea del
  workspace.
- Historial: `FotofficeCustomValueChange` (workspaceId, entityType, entityId, fieldId, before, after
  como texto legible, actorUserId, actorLabel, createdAt); la línea de tiempo de la ficha (0.3) suma un
  proveedor que lo lee para Cliente/Socio; la ficha de Consulta lo muestra en su historial.
- Un módulo `lib/campos/` con: validación por tipo (pura), lectura de definiciones con caché por
  request, `valoresDe(entityType, ids)` en lote (para listados), guardado con diff y registro en la
  misma transacción, y un ayudante para listados (columnas, filtros, búsqueda y exportación) al estilo
  de `lib/ficha/etiquetas-listado.tsx`.

### 4.2 Numeración

- `FotofficeSequence`: workspaceId, key (`CONSULTA` | `PRESUPUESTO` | `PEDIDO` | `CONTRATO` |
  `PROYECTO`), prefix, withYear, digits, nextValue, currentYear; único (workspaceId, key).
- `FotofficeSequenceChange`: historial de configuración (antes/después en JSON, actor, fecha).
- `FotofficeRecordNumber`: workspaceId, sequenceKey, entityType, entityId, year (null si sin año),
  value (int), display (texto); únicos (workspaceId, sequenceKey, year, value) y (entityType, entityId).
- **Asignación atómica [decisión]**: un `UPDATE "FotofficeSequence" SET … RETURNING` dentro de la
  transacción del alta (si `withYear` y cambió el año, reinicia a 1 en la misma sentencia), en vez de leer
  el último y sumar uno — dos altas simultáneas nunca chocan. Las secuencias se crean con sus valores
  iniciales la primera vez que se necesitan (idempotente).
- Los números ya existentes (clientes, carnets, coberturas) **no cambian** en esta etapa.

### 4.3 Permisos

| Qué | Capacidad |
|---|---|
| Ver campos y números | la guarda de cada módulo |
| Editar valores de campos | `operar` |
| Configurar campos y numeración | `configurar` |

### 4.4 Datos

Seis tablas nuevas, sólo de FOTOFFICE; ninguna columna en tablas existentes. Migración a mano, **tablas
antes que el código**. El campo "Archivos del cliente" de DNX y las secuencias se crean en código al
abrir Configuración o al necesitarse (como los circuitos en 0.4).

## 5. Errores y casos borde

- Valor que no corresponde al tipo (fecha inválida, número con letras, URL sin http/https, opción de
  otro campo): se rechaza con el motivo.
- Campo archivado: no se muestra ni se edita; sus valores no se borran.
- Dos personas editan "Más datos" a la vez: gana la última, y las dos ediciones quedan en el historial
  **[decisión]** (no hay control optimista en esta tarjeta).
- Secuencia: bajar el próximo número por debajo del último usado → rechazado; cambio de año con
  `withYear` → reinicia a 1 sólo para el año nuevo.
- Alta de consulta cuando la numeración falla: la consulta se crea igual y recibe número en el próximo
  enganche (nunca se pierde una consulta por la numeración).

## 6. Pruebas

- Validación por tipo; obligatorio en la tarjeta.
- Archivar/desarchivar conserva valores; no se cambia el tipo con valores.
- Aislamiento por workspace en definiciones, valores, historial y números.
- Asignación de números: secuencial, sin repetidos con altas concurrentes (simulado), reinicio anual,
  formato con prefijo/año/dígitos, "no se puede bajar".
- Listados: columnas, filtros, búsqueda y exportación con campos.
- Enganche numera las consultas viejas por fecha de alta, una sola vez.

## 7. Criterios para el tablero de avance

1. Daniel crea un campo "Lista" para Clientes y lo filtra en el listado.
2. Se completa "Más datos" en la ficha de un socio y el cambio aparece en su historial.
3. Cada consulta nueva de Captación tiene número y se encuentra buscándolo.
4. Se cambia el formato de Presupuestos y la vista previa muestra el próximo número.
5. El listado exportado a Excel incluye los campos personalizados.

## 8. Orden de publicación

1. 0.1–0.4 fusionadas (PR 277, 281, 286, 290).
2. SQL de las tablas nuevas en staging y en FOTOFFICE.
3. Código.
4. Prueba en producción con DNX (campo "Archivos del cliente", números de consultas) y SFPR (un campo en
   Socios).
