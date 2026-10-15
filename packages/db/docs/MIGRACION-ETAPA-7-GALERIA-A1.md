# Aplicar la migración de la Galería (FOTOFFICE, etapa 7, Entrega A1: Selección)

Procedimiento manual, sin staging: el SQL va directo a la base de producción de FOTOFFICE (rama
`development`), **antes** que el código. No se fusiona el PR sin haber aplicado esto.

**Publicar el código antes que el SQL rompe** el listado `/galerias`, la tarjeta "Galerías" de la ficha del
Proyecto, Configuración → Galería, la página pública `/w/<slug>/galeria/<token>` y el cron
`/api/cron/galerias`. También rompe guardar plantillas de tipo `GALERIA` (CHECK de `entityType`).

| | |
|---|---|
| Migración | `20261101120000_fotoffice_etapa_7_galeria` |
| Archivo | `packages/db/prisma/migrations/20261101120000_fotoffice_etapa_7_galeria/migration.sql` |
| Checksum (sha256) | `e590fd84557d0a2f573cae75c7cc51a94f2cc0518fb72f02f1e187a29f2e3e5a` |
| Qué hace | Crea 7 tablas nuevas (`FotofficeGaleria`, `FotofficeGaleriaFoto`, `FotofficeGaleriaCliente`, `FotofficeGaleriaSeleccion`, `FotofficeGaleriaComentario`, `FotofficeGaleriaEvento`, `FotofficeGaleriaAjustes`) con sus índices, claves foráneas y CHECK, y reemplaza el CHECK de `FotofficeMessageTemplate.entityType` sumando `'GALERIA'` a los nueve valores que ya tenía. No borra ni actualiza filas. |

## Aplicar

1. Correr el contenido de `migration.sql` en la base de producción, todo junto en una transacción.
2. Registrarla sin volver a correrla: insertar en `_prisma_migrations` el nombre de la migración con el
   checksum de arriba (o `prisma migrate resolve --applied 20261101120000_fotoffice_etapa_7_galeria`).
3. Comprobar:
   - las 7 tablas existen y están vacías;
   - `pg_get_constraintdef` de `FotofficeMessageTemplate_entityType` incluye `GALERIA` y los nueve anteriores;
   - el índice parcial único de cliente por contacto existe.

## Almacenamiento

- Las fotos van al **bucket privado** de los adjuntos (`R2_PRIVATE_BUCKET`), bajo
  `galerias/<workspaceId>/<galeriaId>/<fotoId>/{original,vista.jpg,mini.jpg}`.
- El navegador sube directo con una URL firmada (PUT). El CORS del bucket privado ya acepta PUT desde la app
  porque lo usan los adjuntos de Proyectos; si la subida falla con un error de CORS, sumar el origen de la app.
- La lectura usa URLs firmadas (GET) de una hora; no hace falta CORS para mostrar imágenes.

## Encender

```sql
INSERT INTO "WorkspaceFeatureModule" (id,"workspaceId","moduleKey",enabled,"createdAt","updatedAt")
VALUES (gen_random_uuid()::text,'<workspaceId>','gallery',true,now(),now())
ON CONFLICT ("workspaceId","moduleKey") DO UPDATE SET enabled=true,"updatedAt"=now();
```

El módulo depende de `projects` (Proyectos).

## Prueba en producción

1. Crear una galería de prueba desde un Proyecto y subir unas 10 fotos (una vertical, una PNG).
2. Ver que aparezcan las miniaturas y que la foto grande se abra.
3. Publicar, agregar un cliente de prueba con un correo propio y abrir su enlace **desde el celular**:
   elegir, comentar, enviar.
4. En el estudio: ver la selección, responder un comentario, exportar los bloques para Lightroom y el CSV,
   finalizar y reactivar.
5. Archivar la galería de prueba.

## Deshacer

Borrar las 7 tablas en orden inverso a las claves foráneas (`FotofficeGaleriaSeleccion`,
`FotofficeGaleriaComentario`, `FotofficeGaleriaEvento`, `FotofficeGaleriaCliente`, `FotofficeGaleriaFoto`,
`FotofficeGaleria`, `FotofficeGaleriaAjustes`), volver el CHECK de `entityType` a los nueve valores, borrar la
fila de `_prisma_migrations` y los objetos `galerias/` del bucket privado.
