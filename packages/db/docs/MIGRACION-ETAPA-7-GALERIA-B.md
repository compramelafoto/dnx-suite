# Aplicar la migración de la Galería (FOTOFFICE, etapa 7, Entrega B: entregas, ZIP por correo y DNX FLUX)

Procedimiento manual, sin staging: el SQL va directo a la base de producción de FOTOFFICE (rama
`development`), **antes** que el código. No se fusiona el PR sin haber aplicado esto.

**Publicar el código antes que el SQL rompe** toda la Galería (el modelo `FotofficeGaleriaFoto` suma
columnas que Prisma lee en cada consulta), el cron `/api/cron/galerias-zip`, Configuración → Galería →
Dispositivos y la API `/api/flux/v1/*`.

| | |
|---|---|
| Migración | `20261103120000_fotoffice_etapa_7_galeria_entrega` |
| Archivo | `packages/db/prisma/migrations/20261103120000_fotoffice_etapa_7_galeria_entrega/migration.sql` |
| Checksum (sha256) | `e3907d579134282417354b33e996252179c09ab3375a177d6de64d6a3662270e` |
| Qué hace | Suma a `FotofficeGaleriaFoto` las columnas `mediaType` (NOT NULL, por omisión `'FOTO'`, CHECK `FOTO`/`VIDEO`) y `contentType`; crea `FotofficeGaleriaDescarga` (pedidos de ZIP) y `FotofficeDispositivo` (claves de DNX FLUX) con sus índices, claves foráneas y CHECK. No borra ni actualiza filas: las fotos existentes quedan como `FOTO`. |

## Aplicar

1. Correr el contenido de `migration.sql` en la base de producción, todo junto en una transacción.
2. Registrarla sin volver a correrla: insertar en `_prisma_migrations` el nombre con el checksum de arriba.
3. Comprobar: las columnas `mediaType` y `contentType` existen; las dos tablas nuevas existen y están vacías;
   `SELECT count(*) FROM "FotofficeGaleriaFoto" WHERE "mediaType" <> 'FOTO'` da 0.

## Funcionamiento

- **Videos:** MP4 y MOV de hasta 5 GB, una sola subida firmada; se ven con el reproductor del navegador.
- **ZIP:** el cron `/api/cron/galerias-zip` (cada 5 minutos, con `CRON_SECRET`) arma una parte de hasta 1 GB
  por corrida en el bucket privado (`galerias/<ws>/<galeriaId>/descargas/<id>/parte-N.zip`) y al terminar
  manda el correo `GALERIA_DESCARGA_LISTA`. Las partes se borran a los 7 días.
- **DNX FLUX:** en Configuración → Galería → Dispositivos se genera la clave (se ve una sola vez). En DNX
  FLUX se pega en su ventana; queda en el llavero de la computadora. DNX FLUX busca el proyecto por el
  número de pedido (número de FOTOFFICE, `externalId` o nombre del proyecto que lo contenga), crea la galería
  de entrega en borrador y sube lo que falta.

## Prueba en producción

1. Crear una galería de entrega desde un Proyecto; subir 5 fotos y un video corto.
2. Publicar, agregar un cliente con un correo propio, abrir su enlace desde el celular: ver el video,
   descargar una foto, pedir "Recibir todo por correo" y esperar el correo (hasta 10 minutos).
3. Conectar DNX FLUX con una clave y publicar un pedido de prueba cuyo número figure en el nombre del
   proyecto.

## Deshacer

`DROP TABLE "FotofficeGaleriaDescarga"; DROP TABLE "FotofficeDispositivo";` y
`ALTER TABLE "FotofficeGaleriaFoto" DROP COLUMN "mediaType", DROP COLUMN "contentType";` (sólo si todavía no
hay videos cargados), borrar la fila de `_prisma_migrations` y los objetos `galerias/*/descargas/` del bucket
privado.
