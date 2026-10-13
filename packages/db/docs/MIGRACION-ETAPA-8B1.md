# Aplicar la migración de la Migración desde Alboom (FOTOFFICE, etapa 8B-1: simular y cargar los datos base)

Procedimiento manual, sin staging: el SQL va directo a la base de producción de FOTOFFICE (rama
`development`), **antes** que el código. No se fusiona el PR sin haber aplicado esto. Requiere la etapa 8A
(`20261105120000_fotoffice_etapa_8_alboom_extraccion`) ya aplicada.

**Publicar el código antes que el SQL** rompe Configuración → Migración desde Alboom (la pantalla lee
`FotofficeAlboomCarga`), hace fallar «Extraer» y «Borrar lo extraído» (miran si hay una carga activa) y el cron
`/api/cron/alboom-carga` cada 5 minutos. El resto de FOTOFFICE no lee estas tablas.

| | |
|---|---|
| Migración | `20261114120000_fotoffice_etapa_8b_alboom_carga` |
| Archivo | `packages/db/prisma/migrations/20261114120000_fotoffice_etapa_8b_alboom_carga/migration.sql` |
| Checksum (sha256) | `2eae37280f25f47a54f800800ef9783ca42a89ea269a2e401114dd3bfc12b3f0` |
| Qué hace | Crea `FotofficeAlboomMapa` (`workspaceId`, `entity`, `alboomId`, `targetType`, `targetId`, `payloadHash` sha256 de 64 hex, `fieldHashes` JSONB, `loadedAt`, `updatedAt`; único `(workspaceId, entity, alboomId)`, índice `(workspaceId, targetType, targetId)`) y `FotofficeAlboomCarga` (`mode` SIMULACION/CARGA, `status` PENDIENTE/CORRIENDO/LISTA/ERROR/CANCELADA, `entities`, `report` y `progress` JSONB, `fingerprint` sha256, `startedByUserId`, `startedAt`, `finishedAt`, `errorReason` ≤ 500, `lockedUntil`, `updatedAt`), las dos con clave foránea a `Workspace` en cascada y CHECK. Un índice único parcial impide dos simulaciones/cargas activas en el mismo workspace. No toca ninguna tabla existente ni filas. |

Si la copia que vas a correr tiene otro checksum que el de arriba, **no la corras**: el archivo cambió. Se
comprueba con `shasum -a 256 packages/db/prisma/migrations/20261114120000_fotoffice_etapa_8b_alboom_carga/migration.sql`.

## Aplicar

1. Correr el contenido de `migration.sql` en la base de producción, todo junto en una transacción.
2. Registrarla sin volver a correrla: insertar en `_prisma_migrations` el nombre con el checksum de arriba
   (como las demás migraciones a mano: `migrate resolve` con el checksum del archivo).
3. Comprobar con las consultas de abajo.
4. Recién ahí fusionar el PR y dejar que se publique el código (suma el cron `/api/cron/alboom-carga`, cada 5
   minutos, en `apps/fotoffice/vercel.json`).

## Comprobar

```sql
-- 1. Las dos tablas existen y están vacías.
SELECT (SELECT count(*) FROM "FotofficeAlboomMapa")  AS mapa,
       (SELECT count(*) FROM "FotofficeAlboomCarga") AS cargas;
--   0 y 0.

-- 2. Índices.
SELECT indexname FROM pg_indexes
 WHERE tablename IN ('FotofficeAlboomMapa', 'FotofficeAlboomCarga')
 ORDER BY indexname;
--   incluye FotofficeAlboomMapa_workspaceId_entity_alboomId_key, FotofficeAlboomMapa_workspaceId_targetType_targetId_idx
--   y FotofficeAlboomCarga_workspaceId_activa_key.

-- 3. Restricciones CHECK.
SELECT conname FROM pg_constraint
 WHERE conname IN ('FotofficeAlboomMapa_entity', 'FotofficeAlboomMapa_alboomId', 'FotofficeAlboomMapa_targetType',
                   'FotofficeAlboomMapa_targetId', 'FotofficeAlboomMapa_payloadHash', 'FotofficeAlboomCarga_mode',
                   'FotofficeAlboomCarga_status', 'FotofficeAlboomCarga_fingerprint',
                   'FotofficeAlboomCarga_errorReason', 'FotofficeAlboomCarga_finishedAt');
--   diez filas.
```

## Funcionamiento

- **Pantalla:** Configuración → Migración desde Alboom, sección **«Cargar en FOTOFFICE»** (aparece cuando hay
  datos extraídos). Sólo dueño o administrador. Se eligen las partes (por omisión, todas; las dependencias se
  suman solas: etapas → embudos y flujos; combos y costos → productos).
- **Simular:** deja una SIMULACION pendiente que el cron corre en tandas. Traduce todo y arma el informe sin
  escribir nada (ni registros ni mapa); sólo se escribe la fila de `FotofficeAlboomCarga`. Guarda la huella de los
  datos crudos que leyó; si cambian mientras simula, termina en error.
- **Cargar:** sólo con la última simulación LISTA, posterior a la última carga y con los datos crudos iguales
  (misma huella). Pide escribir CARGAR. Carga exactamente las partes simuladas, en tandas de hasta 270 s, lotes
  de 100 registros, con turno (`lockedUntil`) y avance guardado para retomar.
- **Nunca duplica:** cada registro de Alboom queda en `FotofficeAlboomMapa` con el registro de FOTOFFICE que le
  corresponde, escrito en la misma transacción que el registro. Volver a cargar con el mismo crudo no escribe
  nada.
- **No pisa lo editado:** el mapa guarda la huella de cada campo tal como vino de Alboom (`fieldHashes`, sin el
  dato). Si Alboom cambió un campo y en FOTOFFICE sigue como se cargó, se actualiza; si alguien lo editó, se
  conserva y se informa como conflicto. Con un registro que ya existía, sólo se completan los campos vacíos. Las
  etiquetas sólo se agregan; una que alguien sacó no vuelve.
- **Lo que se carga en 8B-1:** usuarios del equipo (sólo se emparejan por correo; nunca se crean usuarios),
  orígenes, categorías de consulta (portugués unificado y emparejadas con las 21 de DNX), etiquetas de contactos,
  embudos y flujos con sus etapas (sólo se emparejan con los sembrados; cada etapa deja su fila de posición
  `posicion_embudo`/`posicion_flujo` para la 8B-2), contactos (correo y teléfono normalizados, datos de prueba
  descartados, duplicados de Alboom fusionados, emparejados por correo y teléfono), productos con su catálogo,
  combos y costos-plantilla.
- **Nunca fusiona personas ni productos distintos:** un correo o un teléfono solos no alcanzan; además el nombre
  tiene que ser compatible (mismo nombre, uno contiene nombre + apellido del otro, o 60 % de palabras en común). Los
  correos de relleno (`sincorreo@`, `no@`, `@example.`…) y los del propio estudio (miembros, contacto del branding) no
  se guardan ni se usan; un correo o teléfono que en Alboom usan 3 o más contactos de nombres distintos no se usa
  para emparejar. Mismo correo con otro nombre → dos clientes y conflicto «correo compartido». Productos con el mismo
  nombre en Alboom: el inactivo se saltea si hay otro (informado); dos activos se crean por separado (conflicto). Con
  productos o costos que ya estaban en FOTOFFICE se empareja sólo si hay exactamente un candidato, y nunca con lo
  creado en la misma carga ni sólo por código.
- **Privacidad:** el informe sólo guarda cantidades, motivos (textos fijos) e ids de Alboom como ejemplo. Nunca
  nombres, correos ni teléfonos.
- **Sin Alboom:** esta etapa no llama a Alboom: sólo lee `FotofficeAlboomCrudo`. Mientras hay una simulación o
  carga activa no se puede extraer ni borrar lo extraído (y al revés).

## Prueba en producción

1. Con una extracción LISTA: «Simular» con todas las partes. En los próximos minutos pasa a «En curso» y al
   terminar muestra el informe por parte. Comprobar que no cambió nada en Clientes, Productos ni Configuración.
2. Revisar el informe: motivos de omitidos, conflictos y dudas (con ids de Alboom para buscar a mano).
3. «Cargar», escribir CARGAR. Al terminar, el informe de la carga tiene que coincidir con el de la simulación.
4. Revisar algunos clientes, productos y categorías creados. Simular de nuevo: todo tiene que dar «Iguales».

## Deshacer

Antes de cargar, alcanza con borrar las tablas. Después de una carga, borrar las tablas **no** borra lo creado en
FOTOFFICE (clientes, productos, categorías…): el mapa es la única forma de saber qué vino de Alboom, así que
conviene conservarlo.

```sql
DROP TABLE "FotofficeAlboomMapa";
DROP TABLE "FotofficeAlboomCarga";
```

Después borrar la fila de `_prisma_migrations` y sacar el cron de `vercel.json` (o publicar antes el código sin
esta etapa).
