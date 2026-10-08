# FotoRank: diplomas e imágenes de ganadores con el diseñador de FOTOFFICE

Fecha: 2026-10-08 · Pedido de Daniel: "plantillas para exportar fotografías de los ganadores" y
"plantillas para los diplomas", usando "el mismo diseñador de FOTOFFICE". Opción elegida: **A —
reemplazar** el editor propio de diplomas de FotoRank. No hay diplomas que conservar.

## Punto de partida (verificado en `origin/main`)

- El diseñador (Template V2) vive en paquetes compartidos: `@repo/template-editor-ui`,
  `@repo/template-editor-core` y `@repo/design-studio`. Ya lo hospedan FOTOFFICE, Clickatón y
  ComprameLaFoto. Genera PDF y PNG sin navegador (`pdf-lib` + `mupdf`).
- El producto `"fotorank"` **ya existe** en el registro de variables
  (`packages/template-engine/src/plugins/fotorank`): nombre del premiado, obra (imagen), título,
  premio, categoría, concurso, organizador, logo, fecha, código y URL de verificación (QR).
- FotoRank y FOTOFFICE comparten base (`divine-hall` / rama `development`), donde las tablas
  `TemplateV2*` ya existen. **No hace falta ninguna migración.**
- El editor propio de FotoRank guarda los PDF/PNG en `public/uploads` (no sirve en Vercel).

## Decisiones

1. **Hospedar el diseñador en FotoRank** igual que FOTOFFICE: un adaptador
   (`app/lib/fotorank/design/server.ts`) que registra el runtime (sesión de FotoRank, organización
   activa, almacenamiento), las rutas `app/api/template-v2/**` y la página del editor a pantalla
   completa en `/dashboard/disenador/[templateId]/[versionId]`.
   - La plantilla es **de la organización**: `TemplateV2.workspaceId = ContestOrganization.id`
     (la columna no tiene clave foránea; los ids de FOTOFFICE y de FotoRank no chocan).
   - `metaJson.product = "fotorank"` y una marca `templateKey` + `contestId` para encontrarla.
   - Las imágenes que se suben en el editor van al almacenamiento privado de FotoRank (R2 en
     producción) bajo `fotorank/design-templates/…` y se sirven por una ruta propia.
2. **Diplomas**: `FotorankDiplomaTemplate` sigue siendo la fila por concurso (la usan los
   diplomas emitidos), pero su `layoutJson` pasa a ser `{ engine: "designer", designTemplateId }`.
   Crear una plantilla de diploma crea su diseño en el diseñador a partir de un diploma base
   (A4 apaisado). La emisión dibuja con `editorADocumento` + `emitDesign` y **guarda PDF y PNG en
   el almacenamiento privado**, no en disco. La descarga sigue por
   `/api/diplomas/[issuedId]/file`.
   - Se borran el editor visual viejo, su vista previa, la galería y el render con
     `pdf-to-png-converter`.
3. **Imágenes de ganadores**: pantalla nueva por concurso (`/dashboard/concursos/[id]/ganadores`)
   con dos diseños —**cuadrada 1080×1080** y **historia 1080×1920**— editables en el diseñador, y
   la lista de premiados del último resultado FINALIZADO o PUBLICADO (misma regla que los
   diplomas a ganadores). Cada imagen se genera **a pedido** (como las placas de FOTOFFICE), sin
   guardarse, y se descarga una por una o todas en un ZIP. La foto premiada se lee del
   almacenamiento privado (vista de jurado o, si no hay, el original) y se achica con `sharp`.
4. Lo que no tenga dato no se dibuja (poda de bloques de imagen/QR vacíos, como las placas): un
   ganador sin logo de organizador recibe su imagen igual.

## Fuera de alcance (anotado como pendiente)

- La importación de diplomas por Excel (pestaña oculta y herramienta interna
  `diplomas-masivos`) guarda borradores e historial en disco. La emisión y el ZIP pasan al
  almacenamiento nuevo, pero el borrador del Excel sigue en disco.
- Publicar las imágenes en redes en forma automática (la compuerta de resultados sigue cerrada).

## Verificación

- Pruebas unitarias de lo puro: valores del diploma/ganador, poda, marcas de plantilla.
- `next build` de FotoRank (Turbopack) y chequeo de tipos de FotoRank, FOTOFFICE y Clickatón
  (los paquetes compartidos cambian).
- Prueba local con `next dev`: crear diploma, abrir el diseñador, generar diploma, generar
  imagen de ganador.
