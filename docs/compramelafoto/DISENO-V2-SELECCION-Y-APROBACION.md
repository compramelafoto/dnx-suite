# Diseño V2: probar, armar y aprobar diseños con el diseñador nuevo (CLF)

Fecha: 08/10/2026. Pedido de Daniel: que todo el circuito de diseño —probar una plantilla con
fotos, armar el diseño cuando el cliente elige y que el fotógrafo lo apruebe o corrija— use el
diseñador nuevo (`TemplateV2`), y migrar lo del diseñador viejo (`Template` + `TemplateSlot`).

## Punto de partida (producción, 08/10/2026)

- Diseñador viejo: 1 plantilla ("ejemplo", de sistema, 1 hueco) y **0 diseños** (`DesignProject`).
  Ningún beneficio de preventa la usa. Migrarlo no pone en riesgo nada en curso.
- Diseñador nuevo: 43 plantillas de 25 fotógrafos. Las que tienen huecos de foto usan bloques
  `IMAGE` con `source.variableKey = photo_1 / photo_2 / photo_3` (copias de "Carpeta escolar 3
  fotos (Minimal)"), más `metaJson.photoInputs` con etiqueta y rol de cada hueco.
- 2 packs de galería con `requiresDesign` + `templateV2Id` (Ayelen Caballero, álbum 700). Hoy no
  hacen nada: la plantilla se guarda y ningún paso posterior la lee, y esos packs están ocultos.
- `photo_N` no está declarada en el catálogo del producto escolar, así que la vista previa del
  editor falla con esas plantillas ("variable de imagen inválida").

## Convención: el hueco de foto del cliente

Un bloque `IMAGE` (o `PHOTO` legacy) cuyo `source.variableKey` es `photo_<n>`. El número ordena
el armado automático: la primera foto que eligió el cliente va a `photo_1`, la segunda a
`photo_2`, y así. Se declaran `photo_1` … `photo_12` en el catálogo escolar para que el editor
las ofrezca ("Foto del cliente N") y la validación las acepte.

## Modelo de un diseño (`DesignRevision.dataJson`, `schemaVersion: 4`)

```
{ schemaVersion: 4, engine: "TEMPLATE_V2",
  templateV2Id, templateV2VersionId,
  photoIds: number[]            // las que eligió el cliente, en orden: el banco para corregir
  slots: { [blockId]: { photoId: number | null, crop: { zoom, x, y } } },
  values: { [variable]: string } // textos (alumno, escuela, curso) cuando los hay
  export?: { pdfUrl, jpgUrls[], generatedAt, error? } }
```

El recorte es `zoom ≥ 1` y un desplazamiento `x, y` entre -1 y 1 sobre el sobrante de la foto
cuando se la ajusta "cubriendo" el hueco. La misma cuenta la hacen la pantalla (CSS) y la
exportación (`sharp`), así lo que se ve es lo que se imprime.

## Dibujo

- **En pantalla**: `TemplateCanvasRenderer` (React, sin servidor) con las fotos y su recorte.
- **Archivo final**: `@repo/design-studio` vía `editorADocumento` (sin navegador, corre en
  Vercel; el mismo motor que el carnet de FOTOFFICE y las placas de Clickatón). Cada hueco
  apunta a una referencia `design-photo:<blockId>` que el lector de recursos resuelve con la
  foto original recortada. Sale un PDF (todas las caras) y un JPG por cara.

## Etapas

1. **Probar con fotos** (`/fotografo/diseno/plantillas/v2/[id]/probar`): el fotógrafo elige un
   álbum suyo y fotos, ve el armado automático con el mismo editor de la revisión, lo corrige y
   descarga un PDF de prueba. No guarda nada.
2. **Armado automático**:
   - Pack de galería con diseño: al confirmarse el pago se crea el diseño con las fotos
     elegidas, en estado "pendiente de aprobación". El cliente recibe sus fotos como hasta hoy;
     el diseño se suma a su centro de descargas cuando el fotógrafo lo aprueba.
   - Preventa escolar: el beneficio guarda `templateV2Id`; al canjear se arma con la V2.
3. **Revisión** (`/fotografo/disenos` y `/fotografo/disenos/[id]`): ver cada cara con las fotos,
   cambiar una foto por otra de la selección, intercambiar, acercar y reencuadrar, volver al
   armado automático, **Aprobar** (genera PDF + JPG) y **Pedir cambios al cliente** (queda
   marcado con la nota y se le escribe al comprador).
4. **Migración**: la plantilla vieja pasa a V2; las entradas del diseñador viejo se retiran o
   redirigen; los crons del render viejo dejan de correr.

## Cambios de base (a mano, aditivos)

- `DesignProject`: `orderItemId` y `templateId` pasan a opcionales; se agregan `templateV2Id`,
  `templateV2VersionId`, `albumOrderId`, `albumPackDraftId` (único), `albumId`,
  `photographerUserId`.
- `BenefitDefinition`: `templateV2Id`.

Se aplican en todas las bases que tengan esas tablas **antes** de desplegar: una columna que el
cliente de Prisma espera y la base no tiene rompe todas las consultas del modelo.

## Fuera de alcance (anotado)

- El pedido al laboratorio de un pack impreso con diseño sigue mandando las fotos sueltas; el
  PDF aprobado se descarga desde el panel.
- Rotación libre de la foto dentro del hueco.

## Dónde quedó cada cosa (implementado)

| Pieza | Archivo |
|---|---|
| Huecos y recorte (pantalla + impresión) | `packages/template-editor-core/src/client-photo-slots.ts` |
| `photo_1…12` en el catálogo escolar | `packages/template-engine/src/plugins/school/definitions.ts` |
| Fotos encuadradas en pantalla | `packages/template-editor-ui/src/TemplateCanvasRenderer.tsx` (`photoOverrides`, `pageIndex`) |
| Formato del diseño y correcciones | `apps/compramelafoto/lib/design-v2/design-data.ts` |
| PDF + JPG sin navegador | `apps/compramelafoto/lib/design-v2/render.ts` |
| Crear / corregir / aprobar / pedir cambios | `apps/compramelafoto/lib/design-v2/projects.ts` |
| Armado al pagar un pack | `lib/design-v2/album-pack-designs.ts`, llamado desde `finalizeAlbumOrderMercadoPagoApproved` |
| Armado al canjear preventa | `lib/school-render/ensure-school-design-for-preventa-order-item.ts` |
| Pantallas | `/fotografo/disenos`, `/fotografo/disenos/[id]`, `/fotografo/diseno/plantillas/v2/[id]/probar` |
| Migración del viejo | `/admin/plantillas` → `lib/design-v2/migrate-legacy.ts` |

Lo retirado: rutas `api/dashboard/design-projects|design-revisions`, crons
`process-design-previews|exports` (y su entrada en `vercel.json`), el render con `sharp` del motor
viejo, el listado y la creación de plantillas viejas (los `POST` responden 410), y el diseñador
clásico (`/admin/plantillas/disenador` redirige al hub V2). Las pantallas viejas de revisión
redirigen a las nuevas.

## Para desplegar

1. Aplicar `packages/db/prisma/migrations/20261023100000_clf_design_v2/migration.sql` en la base
   de CompraMeLaFoto (`divine-hall` rama `production`) **antes** de fusionar, y registrarla en
   `_prisma_migrations`. Las demás apps no usan `DesignProject` ni `BenefitDefinition`.
2. Fusionar. En `/admin/plantillas`, tocar "Migrar al diseñador nuevo" (hoy hay una sola plantilla
   vieja, "ejemplo").
3. Probar un "Aprobar" real: en local no se puede probar la subida de los archivos a R2.

## Probado (08/10/2026, base local)

Armado al pagar (y no se duplica si el pago se confirma dos veces), aviso al fotógrafo, lista,
revisión con cambio de foto, acercar y correr, textos, guardado automático, PDF idéntico a la
pantalla, aprobación con falla de subida (queda "falta generar el archivo" y se reintenta), pedir
cambios (correo a la familia), modo prueba con PDF, migración de una plantilla vieja (idempotente).
Sin probar de punta a punta: el canje de preventa con plantilla nueva (cubierto por tests de la
resolución de plantilla) y la subida real a R2.
