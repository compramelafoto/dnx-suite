# Aplicar la migración de la Migración desde Alboom (FOTOFFICE, etapa 8A: conectar y extraer)

Procedimiento manual, sin staging: el SQL va directo a la base de producción de FOTOFFICE (rama
`development`), **antes** que el código. No se fusiona el PR sin haber aplicado esto.

**Publicar el código antes que el SQL** rompe Configuración → Migración desde Alboom y hace fallar el cron
`/api/cron/alboom-extraccion` cada 5 minutos (las tablas no existen). El resto de FOTOFFICE no lee estas tablas.

| | |
|---|---|
| Migración | `20261105120000_fotoffice_etapa_8_alboom_extraccion` |
| Archivo | `packages/db/prisma/migrations/20261105120000_fotoffice_etapa_8_alboom_extraccion/migration.sql` |
| Checksum (sha256) | `ae97cabdf0e1a6e5ac17649d518587e95d788ac44d9c27f8547714324a160fa0` |
| Qué hace | Crea `FotofficeAlboomCrudo` (respuesta cruda de Alboom: `workspaceId`, `entity`, `alboomId`, `payload` JSONB, `hash` sha256 de 64 hex, `fetchedAt`, `firstSeenAt`; único `(workspaceId, entity, alboomId)`, índice `(workspaceId, entity)`) y `FotofficeAlboomExtraccion` (`status` PENDIENTE/CORRIENDO/LISTA/ERROR/CANCELADA, `mode` TODO/INCREMENTAL, `progress` JSONB, `startedByUserId`, `startedAt`, `finishedAt`, `errorReason` ≤ 500, `lockedUntil`, `updatedAt`), las dos con clave foránea a `Workspace` en cascada y CHECK. Un índice único parcial impide dos extracciones activas (PENDIENTE o CORRIENDO) en el mismo workspace. No toca ninguna tabla existente ni filas. |

Si la copia que vas a correr tiene otro checksum que el de arriba, **no la corras**: el archivo cambió. Se
comprueba con `shasum -a 256 packages/db/prisma/migrations/20261105120000_fotoffice_etapa_8_alboom_extraccion/migration.sql`.

## Aplicar

1. Correr el contenido de `migration.sql` en la base de producción, todo junto en una transacción.
2. Registrarla sin volver a correrla: insertar en `_prisma_migrations` el nombre con el checksum de arriba
   (como las demás migraciones a mano: `migrate resolve` con el checksum del archivo).
3. Comprobar con las consultas de abajo.
4. Recién ahí fusionar el PR y dejar que se publique el código (suma el cron `/api/cron/alboom-extraccion`,
   cada 5 minutos, en `apps/fotoffice/vercel.json`).

## Comprobar

```sql
-- 1. Las dos tablas existen y están vacías.
SELECT (SELECT count(*) FROM "FotofficeAlboomCrudo")      AS crudos,
       (SELECT count(*) FROM "FotofficeAlboomExtraccion") AS extracciones;
--   0 y 0.

-- 2. Índices.
SELECT indexname FROM pg_indexes
 WHERE tablename IN ('FotofficeAlboomCrudo', 'FotofficeAlboomExtraccion')
 ORDER BY indexname;
--   incluye FotofficeAlboomCrudo_workspaceId_entity_alboomId_key y FotofficeAlboomExtraccion_workspaceId_activa_key.

-- 3. Restricciones CHECK.
SELECT conname FROM pg_constraint
 WHERE conname IN ('FotofficeAlboomCrudo_entity', 'FotofficeAlboomCrudo_alboomId', 'FotofficeAlboomCrudo_hash',
                   'FotofficeAlboomExtraccion_status', 'FotofficeAlboomExtraccion_mode',
                   'FotofficeAlboomExtraccion_errorReason', 'FotofficeAlboomExtraccion_finishedAt');
--   siete filas.
```

## Funcionamiento

- **Pantalla:** Configuración → **Migración desde Alboom** (`/workspace/configuracion/alboom`), sólo dueño o
  administrador (`puede(rol, "configurar")`), sin módulo propio. También aparece en el menú Institución.
- **Conectar:** subdominio (lo de antes de `.alboomcrm.com`; acepta la dirección completa), usuario y contraseña
  del panel de Alboom. Se prueba el inicio de sesión (`POST /api/users/login`) y recién ahí se guarda **cifrado**
  en `WorkspaceIntegration` (clave `alboom-crm`, proveedor `ALBOOM`), con el mismo baúl que Google. La pantalla
  sólo muestra usuario, subdominio, estado y fechas. «Probar conexión» vuelve a iniciar sesión; si Alboom la
  rechaza, queda «hay que volver a conectar». «Desconectar» borra la credencial y cancela la extracción en curso.
- **Extraer todo / Volver a extraer:** deja una extracción PENDIENTE; el cron la toma en tandas de hasta 270 s, a
  **un pedido por segundo**, y guarda el avance después de cada pedido (retoma donde quedó). Cada registro se
  guarda crudo (`payload`) con su huella: volver a extraer sólo reescribe lo que cambió y cuenta nuevos,
  cambiados e iguales. Una sola extracción activa por workspace; dos tandas no corren la misma (`lockedUntil`).
- **Errores:** un 401 de Alboom marca la conexión para volver a conectar y frena con ERROR. Un 429/5xx o la red
  caída esperan 1, 2, 4… minutos (hasta una hora) y reintentan en una tanda posterior; tras 8 seguidos, ERROR. Un
  404 o una respuesta con forma desconocida frenan sólo esa parte (se ve en la tabla) y la extracción sigue.
- **Sólo lectura:** el cliente tiene una lista blanca exacta de rutas de lectura (`lib/alboom/client.ts`) y
  rechaza cualquier otra antes de salir a la red, incluidos los `GET` de Alboom que escriben
  (`/settings/erase_finance`, `/settings/update_apikey`, `/products/clone_costs/…`).
- **Privacidad:** el contenido crudo nunca va al navegador (sólo contadores); la contraseña nunca aparece en
  registros, eventos ni respuestas. «Borrar lo extraído» (escribiendo BORRAR) borra los datos crudos y el
  historial de extracciones del workspace.

## Prueba en producción

1. Configuración → Migración desde Alboom: conectar con la cuenta de DNX (`dnxfotografia`). Debe decir
   «Conectada». Tocar «Probar conexión».
2. «Extraer todo». En los próximos 5 minutos el estado pasa a «En curso» y la tabla empieza a llenarse
   (Configuración, Usuarios, Embudos…). La pantalla se actualiza sola cada 20 segundos.
3. Dejarla correr (varias horas para ~500 pedidos con sus detalles). Revisar que no queden partes «Con error»
   salvo las que se expliquen en la tabla; anotar las dudas.
4. Comparar cantidades a ojo contra Alboom: contactos, oportunidades, pedidos (~500), proyectos, contratos.
5. «Volver a extraer»: al terminar, «Nuevos / cambiados» debe dar casi todo 0 / 0.
6. Probar «Cancelar la extracción» en una segunda corrida y que la pantalla lo muestre.

## Deshacer

Sólo mientras no haga falta lo extraído:

```sql
DROP TABLE "FotofficeAlboomCrudo";
DROP TABLE "FotofficeAlboomExtraccion";
```

Después borrar la fila de `_prisma_migrations` y sacar el cron de `vercel.json` (o publicar antes el código sin
esta etapa). La credencial guardada en `WorkspaceIntegration` (`alboom-crm`) se borra con «Desconectar».
