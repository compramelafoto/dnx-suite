# Etapa 0.2 · El listado estándar

> 29/09/2026 · Diseño aprobado por Daniel en la conversación del 29/09. Parte de la Etapa 0 (Cimientos)
> del plan de reemplazo de Alboom (`docs/alboom/00-mapa-general-y-plan.md` §3.2 y §4). Se apoya en la
> 0.1 (`2026-09-29-etapa-0-1-quien-ve-que-design.md`, PR 277): usa `puede(rol, capacidad)`.

## 1. Qué problema resuelve

Hoy cada lista de FOTOFFICE está hecha a mano y ninguna se parece a otra (relevamiento del 29/09 sobre
`origin/main`):

- Sólo **Socios** tiene páginas, buscador, filtros y exportación.
- **Clientes, Caja/movimientos, Coberturas, Solicitudes, Turnos y Pases cortan en silencio a 200 filas**:
  la 201 no aparece y la pantalla no avisa. Cuotas (deudores), Cursos y Captación traen todo sin límite.
- Ninguna lista se ordena por columna; no hay vistas guardadas ni filtros recordados.
- No hay componentes compartidos de tabla, filtros o paginación: el mismo bloque `<table>` está copiado
  en cuatro pantallas y el `where` de búsqueda, en otras cuatro.

Alboom, en cambio, tiene **una sola forma de lista** (ver `docs/alboom/05-configuracion-y-transversales.md`
§10), y DNX Estudio trabaja así todos los días. La 0.2 construye esa pieza una vez, mejorada, y la
estrena en tres listas reales antes de que el CRM (etapa 1) la necesite.

## 2. Alcance

**Entra:**

1. La pieza de listado (motor + componentes).
2. Tres listas pasan a usarla: **Clientes**, **Socios** y **Caja / movimientos**.
3. Funciones: búsqueda al escribir, filtros con etiquetas removibles, orden por columna, 10/25/50/100
   filas, filtros recordados por persona, vistas guardadas (personales y del equipo), selección de
   varias filas o de todo el resultado con acciones en lote, exportación a Excel, panel de detalle al
   costado.

**No entra (queda anotado):**

- Impresión Resumen/Detallado (Excel la cubre por ahora).
- Elegir qué columnas se ven.
- Borrar en lote.
- Cambiar el estado de socios en lote (baja pide motivo y fecha; reactivar no devuelve la cuota del mes:
  ver memoria del proyecto). Se hace de a uno, como hoy.
- Pasar el resto de las listas: cada una se pasa cuando se toque su módulo.
- Tablero kanban: llega con el motor de etapas (0.4) y Consultas (etapa 1).

## 3. Cómo lo vive quien usa el sistema

### 3.1 Buscar, filtrar, ordenar, paginar

- **Búsqueda**: una caja que busca mientras escribís (espera medio segundo, desde 2 letras o al borrar)
  y vuelve a la página 1.
- **Filtros**: desplegables arriba de la tabla. Cada filtro activo aparece como etiqueta removible
  ("Estado: Activo ✕") y hay un "Limpiar todo". En el celular se pliegan en un botón "Filtros (3)".
- **Período** (en las listas con fechas): Hoy, Esta semana, Semana pasada, Este mes, Mes pasado, Últimos
  3 meses, Este año, Año pasado, u Otro período (desde/hasta). Siempre en hora de Buenos Aires.
- **Orden**: clic en el encabezado de una columna ordenable; otro clic invierte; flecha indicadora.
- **Paginación**: pie con "Mostrando 51 a 100 de 1.240", anterior/siguiente, número de página y
  10/25/50/100 filas. **Ninguna lista corta en silencio.** Sin resultados: "No hay resultados con estos
  filtros" y un botón para limpiarlos.
- **La dirección de la página lleva todo** (`?q=perez&estado=ACTIVE&orden=-alta&pagina=2&filas=50`):
  copiarla y mandarla reproduce exactamente la misma vista, respetando los permisos de quien la abre.

### 3.2 Lo que la lista recuerda

- Si entrás a una lista sin nada en la dirección, se aplican **los últimos filtros, orden y cantidad de
  filas que usaste en esa lista**. Se guardan en la base por persona y por organización, así siguen en
  otra computadora o en el celular.
- "Limpiar todo" también se recuerda (la próxima vez entra limpia).
- La cantidad de filas se recuerda **por lista**, no una para todo el sistema.

### 3.3 Vistas guardadas

- Menú "Vistas" junto a los filtros: guardar la combinación actual con un nombre ("Deudores de más de 2
  meses"), elegir una, renombrar, borrar.
- Una vista es **personal** o **del equipo**. Las del equipo las crean, renombran y borran Dueño y
  Administrador (capacidad `configurar`); el Equipo las usa. Las personales, cada uno las suyas.
- Si una vista guarda un filtro que dejó de existir (una categoría borrada), la lista lo ignora y lo
  avisa en una línea, no se rompe.

### 3.4 Selección y acciones en lote

- Casilla por fila y casilla para toda la página. Al tildar la página aparece: "Seleccionaste 25 ·
  Seleccionar los 1.240 resultados".
- Con algo tildado aparece una barra fija abajo con las acciones de esa lista y "Quitar selección".
- **Antes de aplicar, confirmación con la cantidad exacta**: "Vas a cambiar la categoría de 1.240 socios
  a Vitalicio".
- Si se eligió "todos los resultados", el servidor **vuelve a calcular el conjunto** con los filtros al
  momento de aplicar; si la cantidad no coincide con la confirmada, no aplica y vuelve a preguntar con el
  número nuevo.
- Cada acción en lote queda registrada: quién, cuándo, qué lista, qué acción, a cuántos y el antes y
  después de cada fila. Además, cada fila deja su rastro en el historial propio del módulo cuando existe
  (`MemberAudit` para socios).
- Tope por acción: 5.000 filas. Más que eso: "Filtrá un poco más".
- Las acciones exigen la capacidad `operar`.

**Acciones de esta etapa:**

| Lista | Acción | Regla |
|---|---|---|
| Socios | Cambiar categoría | Pasa por la misma función que el cambio individual, con `MemberAudit` |
| Socios | Invitar al portal | La que ya existe (`inviteMembersBatchAction`) pasa a la pieza; ahora también con "todos los resultados" |
| Caja / movimientos | Cambiar rubro | **Sólo movimientos cargados a mano** (`sourceModule = "manual"`) y no anulados: los que vienen de Cuotas, Reservas o Ventas se corrigen en su módulo (regla de `lib/cash/constants.ts`). La confirmación dice cuántos quedan afuera y por qué. Es el primer cambio que se permite sobre un movimiento: sólo toca la clasificación, nunca el importe, la cuenta ni la fecha |
| Clientes | Exportar selección | Las etiquetas llegan con la ficha estándar (0.3) |

### 3.5 Exportar

- Botón "Exportar": archivo `.csv` que Excel abre directo (UTF-8 con marca BOM, separador `;`,
  importes con coma decimal, fechas `dd/mm/aaaa` en hora de Buenos Aires).
- Trae **todo el resultado** con los mismos filtros y orden, no sólo la página; si hay filas tildadas,
  sólo ésas. Columnas: las de la lista más las que la definición agregue para exportar.
- Permiso: capacidad `verDinero` (Dueño, Administrador, Equipo). Colaborador no.
- Cada exportación queda registrada (quién, lista, filtros, cantidad de filas): el archivo lleva datos
  personales.
- Tope 20.000 filas; si el resultado es mayor, avisa y pide filtrar.
- Los botones existentes de Socios ("Exportar padrón completo" / "resultados actuales") pasan a ser este
  mismo botón; la ruta vieja `app/api/members/export` se mantiene hasta que nada la use.

### 3.6 Panel al costado

- En pantallas de 1024 px o más, clic en una fila abre un **panel a la derecha** con un resumen; la tabla
  se angosta y esconde columnas secundarias. Segundo clic en la misma fila, o el botón "Abrir ficha", va
  a la ficha completa.
- Flechas ↑/↓ pasan a la fila anterior/siguiente de la página; Esc cierra.
- La fila abierta va en la dirección (`?ver=<id>`): se puede compartir.
- En pantallas más chicas, el clic va directo a la ficha.
- Contenido en esta etapa:
  - **Socio**: estado, categoría, número, deuda, carnet, últimos pagos, acceso al portal.
  - **Cliente**: datos de contacto, condición frente al IVA, últimos movimientos de Caja.
  - **Movimiento**: fecha, cuenta, rubro, medio de pago, cliente, comprobante, origen y, si fue anulado,
    el contramovimiento.

## 4. Las tres listas

| | Clientes | Socios | Caja / movimientos |
|---|---|---|---|
| Ruta | `/clientes` | `/members` | `/caja/movimientos` |
| Buscar en | nombre, apellido, razón social, documento, correo, teléfono, número | nombre, apellido, número, documento, correo | descripción, número de comprobante, nombre del cliente |
| Filtros | tipo (`kind`: persona/empresa), estado, fecha de alta (período), con/sin movimientos | estado, categoría, acceso al portal, con deuda / al día | cuenta, rubro, ingreso/egreso (`kind`), medio de pago, origen, cliente, período (`occurredAt`) |
| Columnas ordenables | número, nombre, alta | apellido, número, categoría, alta | fecha, importe |
| Orden por defecto | número descendente | apellido y nombre | fecha descendente |
| Acciones en lote | exportar selección | cambiar categoría, invitar al portal | cambiar rubro |

Se conservan: los guardas de cada página, el vocabulario por organización ("socio", "voluntario"…),
las tarjetas de conteo de Socios, el alta de movimiento en Caja y los botones propios de cada módulo.
El filtro "cliente" de Caja deja de cargar todos los clientes en un desplegable: pasa a un buscador.

## 5. Cómo está hecho

**Enfoque:** el servidor arma la lista y la dirección de la página guarda el estado (elegido sobre una
tabla en el navegador con TanStack Table —librería nueva, otra capa de permisos— y sobre traer todo y
filtrar en el navegador, que no escala). Es como ya funcionan todas las pantallas: server components que
leen `searchParams`.

### 5.1 Definición de una lista

Cada lista se describe en un archivo propio (`lib/clients/listado.ts`, `lib/members/listado.ts`,
`lib/cash/listado-movimientos.ts`) con:

- `clave` estable (`clientes`, `socios`, `caja-movimientos`): identifica la lista en preferencias,
  vistas y registros.
- Columnas (título, cómo se muestra, si es ordenable, si se esconde con el panel abierto, si va a Excel).
- Filtros declarados, de pocos tipos: **opción** (lista blanca de valores), **relación** (id que se
  valida contra la organización), **período**, **sí/no**.
- Órdenes permitidos y el orden por defecto.
- Funciones que sólo la lista conoce: armar el `where` y el `orderBy` de Prisma a partir de la consulta
  ya validada, contar y traer filas. **Siempre reciben el `workspaceId` y lo ponen en el `where`.**
- Acciones en lote (clave, etiqueta, capacidad, formulario de parámetros, función que aplica).
- El contenido del panel lateral.

### 5.2 Motor común (`lib/listado/`)

- **Leer la dirección**: convierte los parámetros en una consulta validada contra la definición.
  Cualquier filtro, valor u orden no declarado se descarta (nunca llega a la base). `filas` sólo acepta
  10/25/50/100; `pagina` fuera de rango va a la última.
- **Períodos**: traduce los atajos a un rango de fechas en hora de Buenos Aires.
- **Paginar**: cuenta, calcula páginas y trae la página pedida (desplazamiento; las listas de esta
  etapa no justifican cursor).
- **Recordar**: guarda la última consulta por persona, organización y lista; si la dirección llega
  vacía, redirige a la recordada.
- **Vistas guardadas**: alta, baja, renombrar, listar, con los permisos de §3.3.
- **Lote**: recibe ids o "todos los resultados + cantidad confirmada"; recalcula, compara, aplica en
  transacción y registra.
- **Exportar**: una ruta común `app/api/listados/[clave]/exportar` que reusa la misma definición y el
  mismo guarda de la página, más `verDinero`.

### 5.3 Componentes (`components/listado/`)

`Listado` (server, arma todo), `CajaDeBusqueda` (client, con la espera), `BarraDeFiltros` y
`EtiquetasDeFiltro`, `MenuDeVistas`, `Tabla` (encabezados ordenables, casillas), `Paginador`,
`BarraDeSeleccion` (client), `PanelLateral` (client para teclado; el contenido lo renderiza el
servidor). Estilos con las clases y tokens `fo-*` que ya existen, sin librerías nuevas.

### 5.4 Datos nuevos

Dos tablas propias de FOTOFFICE; no se toca ninguna tabla que lean otras apps:

- `FotofficeListView`: `id`, `workspaceId`, `listKey`, `kind` (`ULTIMA` | `GUARDADA`), `name`
  (sólo las guardadas), `query` (la consulta en texto de dirección), `ownerUserId`, `shared`,
  `createdAt`, `updatedAt`. Una `ULTIMA` por persona, organización y lista.
- `FotofficeListActivity`: `id`, `workspaceId`, `listKey`, `kind` (`EXPORT` | `BULK_ACTION`),
  `action` (clave de la acción), `actorUserId`, `actorLabel`, `rowCount`, `query`, `detail` (JSON con
  antes/después por fila en las acciones), `createdAt`.

Migración aplicada a mano en cada base con su registro en `_prisma_migrations`, **las tablas antes que
el código**, como en la 0.1.

### 5.5 Permisos

| Qué | Capacidad |
|---|---|
| Ver la lista | el guarda de cada página, sin cambios |
| Filtros recordados y vistas personales | cualquiera que vea la lista |
| Vistas del equipo (crear, renombrar, borrar) | `configurar` |
| Acciones en lote | `operar` (y lo que exija cada acción) |
| Exportar | `verDinero` |

## 6. Errores y casos borde

- Filtro inválido o viejo en la dirección o en una vista: se ignora y se avisa en una línea.
- Página inexistente: se muestra la última.
- La cantidad cambió entre confirmar y aplicar: no se aplica, se vuelve a preguntar.
- Una acción falla a mitad: la transacción no deja nada a medias; el mensaje dice qué pasó.
- Exportación o lote por encima del tope: se avisa antes de hacer nada.
- Una fila del lote que no se puede tocar (movimiento no manual o anulado): queda afuera y se cuenta en
  la confirmación.

## 7. Pruebas

- **Motor**: rechaza filtros, valores y órdenes no declarados; nunca devuelve filas de otra
  organización; recuento y páginas coinciden; los períodos dan los rangos correctos en hora de Buenos
  Aires (incluido fin de mes).
- **Lote**: aplica con ids; con "todos los resultados" recalcula; si la cantidad cambió no aplica;
  respeta el tope; en Caja excluye los no manuales y los anulados; registra antes/después.
- **Exportar**: formato que abre Excel (BOM, `;`, coma decimal), respeta filtros y selección, pide
  `verDinero`, registra.
- **Vistas**: permisos de las del equipo; una vista con filtro viejo no rompe.
- **Las tres listas**: las pruebas actuales de Socios (exportación, filtros) siguen pasando.

## 8. Criterios para el tablero de avance

Se agregan a `docs/estado-de-obra/fotoffice/crm-del-estudio.json` cuando el código esté fusionado:

1. Clientes, Socios y Caja muestran todas las filas, con páginas, sin cortar a 200.
2. Se busca, filtra y ordena igual en las tres listas.
3. Una persona entra otro día (u otro dispositivo) y encuentra sus últimos filtros.
4. Se guarda una vista del equipo y otra persona la usa.
5. Se cambia la categoría de varios socios o el rubro de varios movimientos, y queda registrado.
6. Se exporta a Excel con los filtros aplicados, y queda registrado.
7. El panel al costado muestra el resumen sin salir de la lista.

## 9. Orden de publicación

1. La 0.1 (PR 277) tiene que estar fusionada: esta etapa usa sus capacidades.
2. SQL de las dos tablas nuevas en staging y en las bases de producción.
3. Código.
4. Prueba en producción con DNX Estudio (Clientes, Caja) y SFPR (Socios).
