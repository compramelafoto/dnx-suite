# Clickatón: Personas, resultados por edición y mapa

Fecha: 2026-09-25 · Pedido del dueño en chat (sin reunión).

## Qué se pidió

1. Una sección con **todos los datos de cada participante** en una tabla que se pueda
   ordenar y filtrar (fecha de nacimiento, fecha, nombre, ciudad…), con el historial de
   ediciones, cuántas Clickatones hizo, su rango de puntuación, Instagram y un botón que
   abra un **mapa** con la ubicación de cada uno según su ciudad.
2. En cada edición, un botón **Resultados** con el listado parcial o final según
   corresponda, y sobre todo el **ranking por consigna**.
3. Que desde ahora cada inscripción quede **geolocalizada**, y corregir las ciudades ya
   cargadas (el dueño corrige las dudosas).

## Decisiones

### Resultados (`/admin/ediciones/[id]/resultados`)

- Las obras, las calificaciones y los lotes de resultados de una maratón viven en la
  **base de Clickatón** (FotoRank las lee con `baseDelConcurso`). Clickatón las lee con su
  cliente de siempre: no hace falta ninguna conexión nueva.
- El cálculo es el **mismo motor** que usa FotoRank para cerrar el ranking
  (`clickaton-ranking-v2`). Se mueve, sin cambios, a un paquete puro
  `@repo/jury-ranking`; `apps/fotorank/.../ranking-engine.ts` pasa a reexportarlo. Así el
  parcial de Clickatón y el final de FotoRank no pueden divergir.
- **Final**: si hay un lote `FINALIZED` o `PUBLISHED`, se muestra ese (puesto final,
  premio). **Parcial**: si no, se calcula en vivo con las calificaciones **enviadas**
  (`SUBMITTED`/`LOCKED`) y la regla activa (o la de fábrica de la maratón: promedio
  ponderado, desempate por adecuación a la consigna, top 3). En el parcial el mínimo de
  miradas baja a 1 para que toda obra con al menos una nota tenga un puesto
  provisorio; la columna "miradas" dice cuántas tiene de cuántas.
- Se muestra por consigna: puesto, foto, participante (nombre, número, Instagram),
  código anónimo, nota, miradas y premio. El admin ve identidades: es el panel interno.

### Personas (`/admin/personas`)

- Una persona = un email (en minúsculas). Todas sus inscripciones se agrupan ahí.
- **Ediciones en las que participó** = inscripciones vigentes (`CONFIRMED`,
  `DISQUALIFIED`, `REFUND_REQUESTED`) de ediciones reales. Las ediciones cuyo nombre
  dice "DEMO" o "ENSAYO" no cuentan.
- Los datos personales salen de la inscripción más reciente.
- Rango de puntuación: la nota mínima y máxima de sus obras en todas las ediciones
  (parcial o final, igual que Resultados), más su mejor puesto.
- La tabla es un componente cliente con orden por columna, filtros y exportación CSV;
  el volumen (cientos de personas) lo permite sin paginar en el servidor.

### Geolocalización

- Tabla nueva `ClickatonLocality`: una fila por ciudad+provincia **normalizada**
  (sin tildes, minúsculas, sin "CP 2000", alias de provincia). Guarda nombre canónico,
  coordenadas, origen (`GEOREF` o `MANUAL`) y estado (`RESOLVED`, `DOUBTFUL`,
  `NOT_FOUND`). Es tabla nueva a propósito: agregar columnas a `ClickatonRegistration`
  rompería toda lectura de inscripciones en cualquier base donde la migración no se
  aplicó.
- La inscripción no cambia: se une con su localidad por la clave normalizada.
- Geocodificador: API oficial **Georef** (`apis.datos.gob.ar`), sin clave y pensada
  para localidades argentinas. Un único resultado exacto → `RESOLVED`; varios o parecidos →
  `DOUBTFUL`; ninguno → `NOT_FOUND`.
- Al inscribirse, la localidad se resuelve **después** de responder (`after()`); si falla,
  la inscripción no se entera.
- En Personas, una pestaña "Ciudades a revisar" permite corregir a mano.
- Mapa sin dependencias nuevas: teselas de OpenStreetMap posicionadas con Web
  Mercator y círculos proporcionales a la cantidad de personas. Agregar Leaflet
  habría regenerado el lockfile de toda la suite.

## Fuera de alcance

- Enviar correos a un segmento desde la tabla (se exporta CSV).
- Publicar resultados al público (sigue en FotoRank).
- Desempatar desde Clickatón (sigue en FotoRank).
