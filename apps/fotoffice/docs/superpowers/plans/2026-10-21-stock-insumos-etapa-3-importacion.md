# Stock — Etapa 3 (importar facturas y remitos: IA, CSV y prompt externo) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Desde el borrador de una recepción (etapa 2), cargar las líneas leyendo una foto/PDF/captura/texto de la factura o remito con Claude, o subiendo un CSV (plantilla propia o el que devuelva un prompt externo), siempre con revisión humana antes de confirmar.

**Architecture:** Módulos puros en `apps/fotoffice/lib/stock/importacion/` (`esquema.ts`, `csv.ts`, `asociar.ts`), un servidor que llama a Claude (`ia.ts`), un servidor que vuelca filas en la recepción y guarda alias (`importar-servidor.ts`), tabla nueva `FotofficeAliasProveedor`, y la sección «Importar» en el editor de la recepción. La IA nunca confirma.

**Tech Stack:** Next.js server actions, Prisma, Vitest, `Anthropic` re-exportado por `@repo/dnx-bot` (SDK `@anthropic-ai/sdk` ^0.133; FOTOFFICE no depende directo del SDK y no se agregan dependencias), `sharp` (ya en FOTOFFICE), zod 3 de FOTOFFICE.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-21-stock-insumos-recepcion-e-importacion-design.md` §6.

## Global Constraints

- Tabla nueva `FotofficeAliasProveedor`: `id` cuid, `workspaceId` (Cascade), `proveedorId` (FK `FotofficeProveedor`, Cascade), `textoNormalizado String`, `productId` (FK `Product`, Cascade), `createdAt`, `updatedAt`; `@@unique([proveedorId, textoNormalizado])`, `@@index([workspaceId, proveedorId])`. Migración idempotente `20261205120000_fotoffice_stock_alias_proveedor` (verificar que sea posterior a la última de `main`), aplicada a mano en FOTOFFICE y registrada con SHA-256 antes del merge. Sin columnas nuevas en tablas compartidas.
- **Llamada a Claude** (exacta): `client.beta.messages.create({ model, max_tokens: 16000, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default", output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA_FACTURA } }, system, messages })`. `model` = `process.env.FOTOFFICE_STOCK_IMPORT_MODEL?.trim()` || `leerConfigBot().model`. Sin `thinking`, sin `temperature`, sin prefill. Cliente: `new Anthropic({ apiKey: leerConfigBot().anthropicApiKey, maxRetries: 1, timeout: 120_000 })`. Si el SDK instalado no tipa `fallbacks`/`betas`, pasarlos igual con el mecanismo de cuerpo extra del SDK y dejarlo comentado; si la API los rechaza (400), quitar `fallbacks`/`betas` y dejarlo anotado en el informe (no inventar parámetros).
- Respuesta: revisar `stop_reason` antes de leer. `refusal` ⇒ «No pudimos leer este archivo. Probá con otra foto o cargalo a mano.»; `max_tokens` ⇒ «La factura es muy larga: dividila o usá la plantilla CSV.». Tomar el primer bloque `text`, `JSON.parse` y validar con el zod de FOTOFFICE; inválido ⇒ «La lectura salió incompleta. Probá de nuevo o usá la plantilla CSV.».
- Sin clave (`anthropicApiKey` nulo) ⇒ la opción IA aparece deshabilitada con «La lectura con IA no está configurada.»; CSV y prompt externo siguen.
- **Gasto:** antes de llamar, comparar `gastoDelMes({ plataforma: plataformaDe(workspaceId) })` y `gastoDelMes({})` contra `leerConfigBot().limits.workspaceMonthlyCapMicroUsd` / `monthlyCapMicroUsd`; si se pasó ⇒ «Se alcanzó el tope de gasto de IA de este mes. Usá la plantilla CSV.». Después, registrar con una función nueva `registrarUsoImportacion({ plataforma, userId, usage, costMicroUsd })` en `lib/dnx-bot/store.ts` que hace el mismo upsert de `botUsageDaily` que `registrarUso` (sin conversación, `messages` no se incrementa). `costMicroUsd` de `@repo/dnx-bot`. Permiso: `requireSalesStaff` (no depende del acceso a DNX Bot).
- **Archivos:** JPG/PNG/WEBP/HEIC/HEIF o PDF; máximo 10 MB y 20 páginas de PDF (si no se puede contar páginas, confiar en el tamaño). Imágenes con `sharp`: `.rotate()` (EXIF), JPEG calidad 85, lado mayor ≤ 2000 px. PDF: bloque `document` base64 (`media_type: "application/pdf"`), antes del texto. Texto pegado: hasta 20 000 caracteres, bloque `text`. El archivo original se sube al R2 de FOTOFFICE con el helper de servidor existente (`lib/ficha/adjuntos-r2.ts` o `lib/images/r2-client.ts`, el que suba objetos privados) bajo `recepciones/<workspaceId>/<recepcionId>/<timestamp>-<nombre>` y su clave va a `FotofficeRecepcion.archivoKey`; si la subida falla, se sigue igual y se registra en consola.
- **Esquema de salida** (`SCHEMA_FACTURA`, JSON Schema con `additionalProperties: false` y todos los campos en `required`, nulos permitidos con `type: ["string","null"]` / `["number","null"]`): documento `{ proveedor, cuit, fecha (AAAA-MM-DD o null), comprobante, precios_con_iva (boolean o null), total (number o null), filas: [{ codigo_barras, codigo_proveedor, descripcion (string), cantidad (number), unidad, unidades_por_paquete (integer o null), costo_unitario (number o null), alicuota_iva (number o null), subtotal (number o null) }] }`. Montos en pesos con decimales con punto.
- **System prompt** (fijo, en español): explica que es una factura/remito/captura/lista de un comercio fotográfico argentino; una fila por artículo; no inventar códigos ni precios (null si no figura); `cantidad` es lo comprado tal como dice el documento; si el artículo es un pack/caja con N unidades, `unidades_por_paquete` = N; costos tal como figuran (con o sin IVA, indicar en `precios_con_iva`); ignorar renglones de envío, descuentos generales y totales; números argentinos "1.234,50" ⇒ 1234.5.
- **CSV:** separador `;` o `,` (detectar por el encabezado), UTF-8 con o sin BOM, decimales con coma o punto, comillas dobles, encabezado exacto `codigo_barras;codigo_proveedor;descripcion;cantidad;unidad;unidades_por_paquete;costo_unitario;alicuota_iva;tipo`, máximo 500 filas. Plantilla: ese encabezado + `7790000000001;K305;Kit Kodak 305 6R;2;kit;640;120000;21;INSUMO`. Archivos CSV hasta 1 MB.
- **Prompt externo** (`PROMPT_EXTERNO`, texto fijo copiable): pide devolver SÓLO un CSV con ese encabezado exacto, separador `;`, una fila por artículo, decimales con coma, sin totales ni envíos, campos vacíos si no figuran.
- **Asociación** (orden): 1) `codigo_barras` normalizado = `barcode` de un producto activo del workspace (incluye insumos); 2) `codigo_proveedor` = `sku` exacto activo; 3) alias del proveedor de la recepción (`textoNormalizado` de la descripción: minúsculas, sin tildes, sin signos, espacios colapsados); 4) sin asociar, con hasta 3 sugerencias por nombre (palabras de ≥3 letras compartidas, ordenadas por cantidad compartida). Al elegir a mano el producto de una línea `IMPORTACION` en una recepción con proveedor, se crea/actualiza el alias.
- **Volcado:** cada fila ⇒ línea `origen: "IMPORTACION"`, `descripcionOriginal` = descripción, `codigoBarras`, `cantidad` = `max(1, round(cantidad))`, `enUnidadDeCompra` = `unidades_por_paquete > 1`, `unidadesPorCompra` = ese valor, `costoUnitarioMinor` = costo × 100 redondeado (por paquete si es en bultos), `productId` de la asociación o null. Filas sin descripción se descartan. Encabezado: si la recepción no tiene comprobante/fecha, se completan con los del documento; `preciosConIva` si viene. El proveedor detectado NO se crea solo: si coincide por nombre normalizado con uno existente activo, se asigna; si no, se muestra «Proveedor detectado: X» para que la persona lo elija o lo cree en Proveedores.
- **Cuadre:** si `total` viene y |Σ subtotales (o cantidad×costo) − total| > max(1 % de total, 100 pesos) ⇒ aviso «Lo leído no suma igual que el total de la factura: revisá las líneas.» (no bloquea).
- Una línea sin producto bloquea confirmar (ya lo hace etapa 2).
- Textos en español rioplatense llano. Todo filtrado por workspace. `.fo-input` necesita `style={{ width }}` para campos angostos.

## Review Focus

1. **Factura con números argentinos y IVA** ("$ 1.234,50", "21 %"): bien interpretados en CSV y en la validación → tests en Task 2/3.
2. **Fila que la IA devuelve con cantidad 0 o negativa o descripción vacía**: no rompe; se descarta o se lleva a 1 con aviso → test en Task 6.
3. **Tope de gasto alcanzado**: no llama a la API → test en Task 5.
4. **Mismo proveedor, misma descripción la segunda vez**: queda asociada sola por el alias → test en Task 4/6.
5. **Recepción ya confirmada**: importar es rechazado sin escribir → test en Task 6.

---

### Task 1: Tabla de alias y migración

**Files:** `packages/db/prisma/schema.prisma`, migración nueva, `lib/stock/importacion/constantes.ts` (+ test).
- [ ] Modelo y SQL según Global Constraints; `prisma validate/generate`; test de constantes (`MAX_FILAS_CSV = 500`, `MAX_BYTES_ARCHIVO = 10 * 1024 * 1024`, `MAX_PAGINAS_PDF = 20`, `MAX_CARACTERES_TEXTO = 20000`, `ENCABEZADO_CSV`). Commit `Tabla de alias de proveedor para importar`.

### Task 2: Esquema de la factura (puro)

**Files:** `lib/stock/importacion/esquema.ts` (+ test).
**Produces:** `type FilaImportada`, `type DocumentoImportado`, `SCHEMA_FACTURA` (JSON Schema), `documentoSchema` (zod), `validarDocumento(json: unknown): { ok: true; doc } | { ok: false }`, `normalizarNumero(texto: string): number | null` ("1.234,50" ⇒ 1234.5; "1234.50" ⇒ 1234.5; "$ 2.000" ⇒ 2000; "21 %" ⇒ 21; "" ⇒ null), `cuadre(doc): { cuadra: boolean; sumaPesos: number }`.
- [ ] Tests (incluye Review Focus 1 y un test que verifica que `SCHEMA_FACTURA` tiene `additionalProperties: false` y `required` con todas las propiedades en cada objeto). Commit `Esquema de lectura de facturas`.

### Task 3: CSV y prompt externo (puro)

**Files:** `lib/stock/importacion/csv.ts` (+ test).
**Produces:** `leerCsv(texto: string): { ok: true; filas: FilaImportada[] } | { ok: false; error: string }`, `escribirCsv(filas: FilaImportada[]): string`, `PLANTILLA_CSV`, `PROMPT_EXTERNO`.
Errores: «El archivo no tiene el encabezado de la plantilla.», «El archivo tiene más de 500 filas.», «La fila N tiene una cantidad que no se entiende.».
- [ ] Tests: `;` y `,`, BOM, decimales con coma, comillas con separador adentro, filas vacías ignoradas, ida y vuelta `leerCsv(escribirCsv(x))`. Commit `Plantilla CSV y prompt para importar`.

### Task 4: Asociación (pura) y alias (servidor)

**Files:** `lib/stock/importacion/asociar.ts` (+ test), `lib/stock/importacion/alias-servidor.ts` (+ test).
**Produces:** `normalizarTexto(s)`, `asociarFilas(filas, indice: { porBarcode: Map; porSku: Map; porAlias: Map; catalogo: { id; nombre }[] }): { fila; productId: string | null; via: "barcode" | "sku" | "alias" | null; sugerencias: { id; nombre }[] }[]`; servidor `indiceParaAsociar(workspaceId, proveedorId | null)`, `guardarAlias(tx, { workspaceId, proveedorId, descripcion, productId })` (upsert).
- [ ] Tests (Review Focus 4). Commit `Asociar filas importadas a productos`.

### Task 5: Lectura con IA

**Files:** `lib/stock/importacion/ia.ts` (+ test con cliente falso), `lib/dnx-bot/store.ts` (`registrarUsoImportacion` + test).
**Produces:** `iaDisponible(): boolean`, `prepararEntrada(archivo: { nombre; tipo; bytes: Buffer } | { texto: string }): Promise<{ ok: true; bloques } | { ok: false; error }>`, `leerConIa(workspaceId: string, userId: number, entrada, deps?: { cliente?; ahora? }): Promise<{ ok: true; doc: DocumentoImportado } | { ok: false; error: string }>`.
Errores de archivo: «El archivo pesa más de 10 MB.», «Ese tipo de archivo no se puede leer: usá JPG, PNG, HEIC o PDF.».
- [ ] Tests: arma la llamada con los parámetros exactos de Global Constraints (modelo por env, effort, format, betas/fallbacks); refusal; max_tokens; JSON inválido; tope alcanzado ⇒ no llama (Review Focus 3); sin clave; registra uso con `costMicroUsd`; imagen pasa por sharp (mock) y PDF va como `document`. Commit `Leer facturas con IA`.

### Task 6: Volcar en la recepción

**Files:** `lib/stock/importacion/importar-servidor.ts` (+ test), `app/(shell)/ventas/stock/recepcion/actions.ts` (acciones nuevas).
**Produces:** `importarEnRecepcion(workspaceId, recepcionId, userId, origen: "IA" | "CSV", doc: DocumentoImportado, archivoKey?: string): Promise<{ ok: true; agregadas: number; descartadas: number; sinAsociar: number; cuadra: boolean; proveedorDetectado: string | null } | { ok: false; error }>` (usa `enBorrador` de etapa 2, todo en su transacción); `elegirProductoDeLineaImportada(...)` que además guarda el alias; acciones `importarArchivoAction(formData)`, `importarTextoAction`, `importarCsvAction`, `descargarCsvAction(recepcionId)`, `elegirProductoImportadoAction`; todas con `requireSalesStaff`.
- [ ] Tests (Review Focus 2 y 5; volcado con bultos y costo por paquete; proveedor detectado existente se asigna; comprobante/fecha sólo si estaban vacíos). Commit `Importar filas en la recepción`.

### Task 7: Pantalla

**Files:** `app/(shell)/ventas/stock/recepcion/[id]/importar-seccion.tsx` (cliente) y su uso en `recepcion-editor.tsx`.
Sección «Importar desde factura o remito» (sólo en BORRADOR): subir archivo (input file, acepta `image/*,application/pdf`), pegar texto, subir CSV, «Descargar plantilla CSV», «Copiar instrucciones para la IA» (copia `PROMPT_EXTERNO` al portapapeles), «Descargar CSV» de la recepción; estado «Leyendo…» mientras corre; resultado: «Se agregaron N líneas (M sin asociar).», aviso de cuadre, «Proveedor detectado: X». En la tabla, las líneas sin producto muestran «Elegí el producto» con las sugerencias y el buscador; opción IA deshabilitada con su motivo cuando corresponde.
- [ ] Typecheck + eslint de los archivos. Commit `Pantalla para importar facturas`.

### Task 8: Guía «Importar una factura»

**Files:** `lib/instructivos/guias/stock-importar-factura.ts`, `capturas/stock-importar-factura.json`, `catalogo.ts`, test del catálogo. Contenido: sacar la foto o bajar el PDF, subirla en la recepción, revisar (sin asociar, sugerencias, el sistema recuerda para la próxima), cuadre, proveedor detectado, confirmar como siempre; variante sin IA: copiar instrucciones, pegarlas en su ChatGPT/Claude con la foto, subir el CSV que devuelve; plantilla CSV para cargar a mano. Etiquetas exactas de la UI.
- [ ] Test del catálogo → implementar → PASS. Commit `Guía para importar una factura`.

### Task 9: Verificación, migración, PR y prueba real
- [ ] Suite + typecheck + lint; revisión general; aplicar y registrar migración; PR; CI; merge; en fotoffice.com abrir un borrador de recepción, importar el CSV de plantilla y una foto de prueba (sin confirmar), y descartar el borrador.
