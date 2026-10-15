# Aplicar la migración de la Galería (FOTOFFICE, etapa 7, Entrega C: aprobación de álbum por rondas)

Procedimiento manual, sin staging: el SQL va directo a la base de producción de FOTOFFICE (rama
`development`), **antes** que el código. No se fusiona el PR sin haber aplicado esto.

**Publicar el código antes que el SQL rompe** toda la Galería: los modelos `FotofficeGaleriaFoto` y
`FotofficeGaleriaComentario` suman columnas que Prisma lee en cada consulta (subir o mirar fotos, comentar, la
selección del cliente, la página pública). Si el SQL falla a medias, no publicar.

| | |
|---|---|
| Migración | `20261104120000_fotoffice_etapa_7_galeria_album` |
| Archivo | `packages/db/prisma/migrations/20261104120000_fotoffice_etapa_7_galeria_album/migration.sql` |
| Checksum (sha256) | `5e931abbbaea4b8681ca6b7beaa9dad1c6db8f478325ceca04678faed486a260` |
| Qué hace | Cambia el CHECK de `FotofficeGaleria.kind` (mismo nombre de restricción, `FotofficeGaleria_kind`) de `SELECCION`/`ENTREGA` a `SELECCION`/`ENTREGA`/`ALBUM`. Crea `FotofficeGaleriaRonda` (rondas del álbum) y `FotofficeGaleriaDecision` (aprobar o pedir cambios, una por cliente y ronda) con sus índices, claves foráneas y CHECK; un índice único parcial impide dos rondas abiertas en la misma galería. Suma columnas **nulas** a `FotofficeGaleriaFoto` (`rondaId`) y a `FotofficeGaleriaComentario` (`rondaId`, `pinX`, `pinY`, `pinNumber`, con un CHECK: los tres datos del pin van juntos o ninguno). No borra ni actualiza filas: las galerías, fotos y comentarios existentes quedan con `rondaId` y pin en `NULL`. |

Si la copia que vas a correr tiene otro checksum que el de arriba, **no la corras**: el archivo cambió. Se
comprueba con `shasum -a 256 packages/db/prisma/migrations/20261104120000_fotoffice_etapa_7_galeria_album/migration.sql`.

## Aplicar

1. Correr el contenido de `migration.sql` en la base de producción, todo junto en una transacción.
2. Registrarla sin volver a correrla: insertar en `_prisma_migrations` el nombre con el checksum de arriba
   (ver la nota de las migraciones a mano: se registra con el checksum del archivo, `migrate resolve`).
3. Comprobar con las consultas de abajo.
4. Recién ahí fusionar el PR y dejar que se publique el código.

## Comprobar

```sql
-- 1. El CHECK de kind acepta ALBUM y sigue aceptando lo anterior.
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'FotofficeGaleria_kind';
--   debe nombrar 'SELECCION', 'ENTREGA' y 'ALBUM'.

-- 2. Las dos tablas nuevas existen y están vacías.
SELECT (SELECT count(*) FROM "FotofficeGaleriaRonda")   AS rondas,
       (SELECT count(*) FROM "FotofficeGaleriaDecision") AS decisiones;
--   0 y 0.

-- 3. Las columnas nuevas existen y todas las filas viejas las tienen en NULL.
SELECT count(*) FROM "FotofficeGaleriaFoto"       WHERE "rondaId" IS NOT NULL;   -- 0
SELECT count(*) FROM "FotofficeGaleriaComentario"
 WHERE "rondaId" IS NOT NULL OR "pinX" IS NOT NULL OR "pinY" IS NOT NULL OR "pinNumber" IS NOT NULL;  -- 0

-- 4. Los índices y restricciones nuevos.
SELECT indexname FROM pg_indexes
 WHERE tablename IN ('FotofficeGaleriaRonda', 'FotofficeGaleriaDecision')
 ORDER BY indexname;
--   incluye FotofficeGaleriaRonda_galeriaId_number_key, FotofficeGaleriaRonda_galeriaId_abierta_key
--   y FotofficeGaleriaDecision_galeriaClienteId_rondaId_key.
SELECT conname FROM pg_constraint
 WHERE conname IN ('FotofficeGaleriaComentario_pin', 'FotofficeGaleriaRonda_closedAt', 'FotofficeGaleriaDecision_decision');
--   tres filas.

-- 5. Las galerías existentes no cambiaron de tipo.
SELECT kind, count(*) FROM "FotofficeGaleria" GROUP BY kind;   -- sólo SELECCION y ENTREGA.
```

## Funcionamiento

- **Prueba de álbum:** se crea desde el Proyecto con «Nueva prueba de álbum»; nace con la **ronda 1 abierta**.
  Las láminas se suben a la ronda abierta (JPG/PNG de hasta 50 MB, hasta 300 por ronda). No tiene venta, selección
  ni «Recibir todo»; la descarga es «Sin descarga» (por omisión) o «Vista de galería».
- **Cliente (enlace personal):** mira las láminas de la ronda abierta, toca un punto de la imagen para dejar un
  comentario (el punto se guarda relativo a la imagen, entre 0 y 1, y se numera por lámina y cliente) o escribe un
  comentario general, y al final **aprueba el álbum** o **pide cambios** (con un mensaje o al menos un comentario).
  La decisión pasa al cliente de `EN_PROGRESO` a `EN_REVISION` y al estudio le llega un correo con el enlace a la
  revisión de ese cliente. Hasta 300 comentarios por cliente y ronda.
- **Estudio:** en la ficha de la prueba, pestaña **Clientes**, el resumen por ronda (cuántos aprobaron, pidieron
  cambios o no decidieron, y las láminas con comentarios) y, por cada cliente, «Revisar la prueba»: la ronda
  elegida, las láminas con los puntos del cliente dibujados encima, la conversación de cada punto y de los
  comentarios generales con «Responder» (hasta 2.000 caracteres, 300 respuestas por cliente y ronda), la decisión
  con su mensaje y fecha, y las decisiones de todas las rondas.
  - **Finalizar:** sólo si la última decisión del cliente en la ronda actual es «Aprobó el álbum».
  - **Reactivar:** devuelve al cliente a `EN_PROGRESO` en la ronda abierta para que decida de nuevo; conserva sus
    comentarios y **borra su decisión de esa ronda** (hay una sola por cliente y ronda), dejando constancia en el
    historial con la decisión anterior. No manda correo.
  - **Abrir ronda nueva** (pestaña Láminas): sólo si hay al menos una decisión (o el estudio lo fuerza); cierra la
    ronda, puede copiar las láminas de la anterior (`CopyObject` en R2), vuelve a los clientes a `EN_PROGRESO` y les
    avisa por correo con la nota del estudio. Las rondas cerradas se ven en sólo lectura.
- **Respuestas del estudio:** una respuesta a un punto se guarda como comentario del autor `ESTUDIO` con el mismo
  `pinNumber`, `pinX` y `pinY` del punto (el CHECK exige los tres o ninguno); una respuesta a un comentario general
  lleva los tres en `NULL`. El cliente agrupa la conversación por `pinNumber`.
- Lo que el SQL no puede chequear lo valida el código: el tope de 300 láminas por ronda, el de 300 comentarios por
  cliente y ronda, que sólo las galerías de álbum tengan rondas y que las láminas estén en su ronda abierta.

## Prueba en producción

1. Crear una prueba de álbum desde un Proyecto («Nueva prueba de álbum»); subir **6 láminas** a la ronda 1, publicar
   y agregar un cliente con un correo propio.
2. Abrir el enlace del cliente **desde el celular**: tocar la imagen en dos lugares de una lámina y dejar **dos
   comentarios** (aparecen dos puntos numerados 1 y 2); dejar también uno general en otra lámina.
3. En el estudio: pestaña Clientes → «Revisar la prueba»; ver los dos puntos dibujados sobre la lámina en el lugar
   que se tocó y **responder** a cada uno. Desde el celular del cliente, recargar: ver las respuestas bajo el punto.
4. En el celular, **pedir cambios** con un mensaje: debe llegar el correo al estudio con el enlace a la revisión de
   ese cliente, y «Finalizar» **no** debe estar disponible.
5. En el estudio: pestaña Láminas → **Abrir ronda nueva** copiando las láminas; reemplazar una. Comprobar que la
   ronda 1 queda cerrada y en sólo lectura, y que el cliente vuelve a poder comentar (llega el correo con la nota).
6. En el celular, **aprobar el álbum** en la ronda 2. En el estudio: el resumen muestra 1 aprobó en la ronda 2 y
   1 pidió cambios en la ronda 1; **Finalizar** el cliente. Probar también «Reactivar» en otra prueba y comprobar que
   el cliente puede decidir de nuevo.
7. Mirar el historial de la galería: ronda abierta, cambios pedidos, aprobación, finalización.

## Deshacer

Sólo si todavía no hay pruebas de álbum creadas (ni rondas, ni decisiones, ni comentarios con pin):

```sql
ALTER TABLE "FotofficeGaleriaComentario" DROP CONSTRAINT "FotofficeGaleriaComentario_pin";
ALTER TABLE "FotofficeGaleriaComentario" DROP COLUMN "rondaId", DROP COLUMN "pinX", DROP COLUMN "pinY", DROP COLUMN "pinNumber";
ALTER TABLE "FotofficeGaleriaFoto" DROP COLUMN "rondaId";
DROP TABLE "FotofficeGaleriaDecision";
DROP TABLE "FotofficeGaleriaRonda";
ALTER TABLE "FotofficeGaleria" DROP CONSTRAINT "FotofficeGaleria_kind";
ALTER TABLE "FotofficeGaleria" ADD CONSTRAINT "FotofficeGaleria_kind" CHECK ("kind" IN ('SELECCION', 'ENTREGA'));
```

Después borrar la fila de `_prisma_migrations`. Si ya hay galerías con `kind = 'ALBUM'`, el último `ADD CONSTRAINT`
falla: hay que archivarlas o borrarlas antes (y borrar de R2 sus láminas, claves `galerias/<ws>/<galeriaId>/…`).
Con datos de álbum cargados no se deshace la migración: se corrige hacia adelante.
