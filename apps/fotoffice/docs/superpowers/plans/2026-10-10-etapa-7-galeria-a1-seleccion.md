# Etapa 7 · Galería · Entrega A1 (Selección) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** galería de selección atada al Proyecto: subir fotos a R2 privado con vista y miniatura
generadas en el servidor, clientes con enlace personal, página del cliente para elegir, comentar y
enviar, y revisión en el estudio con exportación para Lightroom.

**Architecture:**
- Lógica en `lib/galerias/`, cálculo puro separado de la lectura y escritura; acciones en
  `app/actions/galerias.ts`; pantallas internas en `app/(shell)/galerias/**`; página pública en
  `app/w/[workspaceSlug]/galeria/[token]/**`.
- **Reutiliza:**
  - R2 privado de los adjuntos (`lib/ficha/adjuntos-r2.ts`: cliente S3, bucket `R2_PRIVATE_BUCKET`,
    URL firmada de subida y descarga) con funciones nuevas para claves de galería;
  - `sharp` (ya es dependencia y está en `serverExternalPackages`);
  - el patrón de enlace con token HMAC y hash (`lib/presupuestos/enlace.ts`, `lib/contratos/enlace.ts`),
    el freno por IP (`visitanteDelEnlace`, `lib/pedidos/freno-publico.ts`), `noindex` y cabeceras;
  - correos automáticos con topes (`lib/plantillas/automaticos.ts`, como Contratos);
  - numeración (`lib/numeracion/secuencias.ts`), listado estándar 0.2, módulo en el registro;
  - el cron de adjuntos (`app/api/cron/adjuntos`) como modelo.

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-10-etapa-7-galeria-design.md` §2, §3, §7, §8.

## Global Constraints

- **Rama y worktree:** `feat/fotoffice-etapa-7-galeria` desde `origin/main`, worktree
  `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`.
- **Sin dependencias nuevas.** El lockfile no cambia.
- **Base de datos:**
  - una migración `packages/db/prisma/migrations/20261101120000_fotoffice_etapa_7_galeria/migration.sql`;
  - sólo tablas nuevas `Fotoffice*` más el reemplazo del CHECK de `FotofficeMessageTemplate.entityType`
    conservando `'GENERAL','CLIENTE','SOCIO','CONSULTA','PRESUPUESTO','PEDIDO','PROYECTO','CITA','CONTRATO'`
    y sumando `'GALERIA'`; si las secuencias de numeración tienen un CHECK de clave en la base, también se
    reemplaza sumando `'GALERIA'` (verificarlo en el schema y en migraciones anteriores);
  - sin líneas que no sean SQL (prueba de fuente como `lib/proyectos/migracion-proyectos.test.ts`);
  - no se aplica en la rama; documento `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-A1.md` con checksum.
- **Tablas** (todas con `workspaceId` FK a Workspace CASCADE y timestamps):
  - `FotofficeGaleria`: proyectoId (FK FotofficeProyecto RESTRICT), number, name, message TEXT?,
    saleMode TEXT default `'SELECCION'` (CHECK `SELECCION|SELECCION_Y_VENTA|VENTA`), kind TEXT default
    `'SELECCION'` (CHECK `SELECCION|ENTREGA`), selectionMode (CHECK `LIBRE|CANTIDAD`) default `LIBRE`,
    minSelect INT?, maxSelect INT? (CHECK coherentes), allowComments BOOL default true, downloadMode
    (CHECK `NINGUNA|VISTA|SELECCIONADAS`) default `VISTA`, status (CHECK `BORRADOR|PUBLICADA|ARCHIVADA`)
    default `BORRADOR`, coverFotoId? (único, SET NULL), orderMode (CHECK `NOMBRE|MANUAL`) default
    `NOMBRE`, publishedAt?, archivedAt?, ownerUserId?, createdByUserId?. Único `(workspaceId, number)`.
  - `FotofficeGaleriaFoto`: galeriaId (CASCADE), fileName, originalKey (único), viewKey?, thumbKey?,
    status (CHECK `PENDIENTE|LISTA|ERROR`), errorReason?, sizeBytes BIGINT?, width?, height?, order INT,
    attempts INT default 0, uploadedByUserId?. Índices `(galeriaId, status)`, `(galeriaId, order)`.
  - `FotofficeGaleriaCliente`: galeriaId (CASCADE), clientId? (SET NULL), name, email?, phone?,
    tokenHash (único), tokenIssuedAt, revokedAt?, status (CHECK `EN_PROGRESO|EN_REVISION|FINALIZADO`)
    default `EN_PROGRESO`, firstSeenAt?, lastSeenAt?, submittedAt?, submitMessage TEXT?, finalizedAt?,
    reopenedAt?. Único `(galeriaId, clientId)` cuando clientId no es nulo (índice parcial en SQL).
  - `FotofficeGaleriaSeleccion`: galeriaClienteId (CASCADE), fotoId (CASCADE), createdAt; único
    `(galeriaClienteId, fotoId)`.
  - `FotofficeGaleriaComentario`: galeriaClienteId (CASCADE), fotoId (CASCADE), author (CHECK
    `CLIENTE|ESTUDIO`), authorUserId?, body TEXT (CHECK no vacío, ≤ 2000), createdAt.
  - `FotofficeGaleriaEvento`: galeriaId (CASCADE), galeriaClienteId? (SET NULL), type, actorUserId?,
    data JSONB?, createdAt. Índice `(galeriaId, createdAt)`.
  - `FotofficeGaleriaAjustes`: workspaceId único, defaultMessage TEXT?, defaultSelectionMode,
    defaultAllowComments, defaultDownloadMode, updatedAt.
- **Módulo:** `gallery` pasa de `PLANNED` a `AVAILABLE`, `route: "/galerias"`, `dependsOn: ["projects"]`
  (ya está). Ver = leer; Gestionar = crear, subir, publicar, agregar clientes, finalizar; Ajustes con
  `configurar`. Mirar cómo Proyectos y Contratos resuelven el acceso (`requireProyectos`, `lib/contratos/acceso.ts`).
- **R2:** bucket privado de los adjuntos. Claves `galerias/<workspaceId>/<galeriaId>/<fotoId>/original`,
  `.../vista.jpg`, `.../mini.jpg`, con función de clave y regex estricta propias (como
  `lib/ficha/adjuntos-reglas.ts`). Subida: URL firmada PUT de 15 minutos que firma tipo y tamaño;
  **máximo 50 MB** (52_428_800), sólo `image/jpeg` y `image/png`. Lectura: URLs firmadas GET de 1 hora
  para miniatura y vista (inline, no attachment), generadas por lote en el servidor al armar la página.
- **Procesamiento:** al confirmar cada foto: `HeadObject` (tamaño real = declarado), `GetObject` del
  original, `sharp(...).rotate()` → vista 2048 px lado mayor (sin agrandar) JPEG q82 y miniatura 480 px
  JPEG q75, `PutObject` de las dos, guardar ancho/alto del original, `LISTA`. Si falla, `ERROR` con motivo
  y `attempts++`. Ruta con `maxDuration = 60`. Cron diario (sumado al de adjuntos o propio en
  `vercel.json`): reintenta `PENDIENTE` con objeto subido y `attempts < 3`, y borra (objetos y fila) las
  `PENDIENTE` de más de 24 h sin objeto.
- **Topes:** 3.000 fotos por galería; 30 clientes por galería; 300 comentarios por cliente y galería.
- **Enlace del cliente:** mismo esquema que el presupuesto: token = HMAC-SHA256(clave de enlaces,
  `"fotoffice-galeria:v1:<galeriaClienteId>:<tokenIssuedAt ISO>"`) en base64url, **re-derivable** (el
  estudio puede copiarlo cuando quiera); en la base sólo su hash SHA-256 (`tokenHash`, único) para
  buscarlo. Regenerar = nuevo `tokenIssuedAt` (el viejo deja de andar); anular = `revokedAt`.
  URL `urlDeGaleria({customDomain, appOrigin, slug, token})` = `/w/<slug>/galeria/<token>` o
  `/galeria/<token>` en el dominio propio (sumar `galeria` a los segmentos de `lib/website/domain/routing.ts`
  igual que `presupuesto`/`contrato`).
- **Página pública:** `dynamic = "force-dynamic"`, `robots noindex`, cabeceras `no-referrer` y sin marco
  en `next.config.ts` (igual que contrato), freno por IP, vistas del equipo no cuentan como "entró".
  Acciones públicas (seleccionar, quitar, comentar, enviar) validan el token en cada llamada, sólo con
  la galería `PUBLICADA` y el cliente no anulado; seleccionar/comentar sólo en `EN_PROGRESO`; enviar es
  escritura condicional `EN_PROGRESO → EN_REVISION` que valida mínimo/máximo.
- **Correos:** plantillas automáticas `GALERIA_ENVIO` (enlace con `[galeria_enlace]`),
  `GALERIA_SELECCION_ENVIADA` (copia al cliente con la cantidad) y aviso al estudio (correo interno al
  responsable del proyecto o, si no hay, a los administradores); con `after()` y los topes diarios.
- **Exportar selección:** nombres de archivo **sin extensión** **[decisión: Lightroom compara contra el
  nombre; con extensión también funciona "Contiene", pero el RAW tiene otra]**, en bloques de máximo
  **1.000 caracteres** para Lightroom (separados por `, `) y para Windows/Finder (separados por ` OR `),
  más CSV con nombre y comentarios.
- **Textos:** español rioplatense; "dinero", nunca "plata"; fechas en hora argentina.
- **Verificación:** vitest completo; tsc de fotoffice con `NODE_OPTIONS=--max-old-space-size=8192`
  (código de salida y salida); como cambia el schema: `prisma validate`/`generate` y tsc de las apps que
  comparten schema; `next build --webpack` y después `rm -rf apps/fotoffice/.next`; sin tsbuildinfo.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Tablas, módulo y cálculos puros
**Files:** schema, migración y su prueba de fuente; `lib/galerias/{constantes,claves,enlace,seleccion,exportar,orden}.ts` y sus pruebas; registro de módulos; numeración `GALERIA`; tipo de plantilla `GALERIA`.
- [ ] Modelos y SQL según las Global Constraints (incluye índice parcial único de cliente por contacto).
- [ ] `claves.ts`: claves R2 y regex; `enlace.ts`: token re-derivable, hash, URL; `seleccion.ts`: validar
  mínimo/máximo, transición de estados del cliente; `exportar.ts`: bloques para Lightroom y Windows, CSV;
  `orden.ts`: orden natural por nombre (`IMG_2` antes que `IMG_10`).
- [ ] Commit `Galería: tablas, módulo y cálculos (SQL sin aplicar)`.

### Task 2: Almacenamiento y procesamiento de fotos
**Files:** `lib/galerias/{almacen,procesar,fotos}.ts` y pruebas; ruta `app/api/galerias/[id]/fotos/confirmar/route.ts` (o acción) con `maxDuration = 60`; cron de reintento y limpieza; `vercel.json`.
- [ ] Pedir subida (crea fila `PENDIENTE`, valida tipo, tamaño, tope de fotos, permisos) → URL firmada.
- [ ] Confirmar y procesar con `sharp` (vista y miniatura), idempotente; `ERROR` con motivo.
- [ ] Borrar foto (tres objetos), reordenar, portada.
- [ ] URLs firmadas GET por lote para miniaturas y vistas.
- [ ] Cron: reintentos y limpieza.
- [ ] Pruebas con S3 y `sharp` simulados (y una prueba real de `sharp` con una imagen chica generada en
  memoria, rotación EXIF incluida).
- [ ] Commit `Galería: subida directa a R2 y vistas generadas en el servidor`.

### Task 3: Galería en el estudio
**Files:** `lib/galerias/{acceso,galerias,clientes,ajustes,plantillas}.ts` y pruebas; `app/actions/galerias.ts`; `app/(shell)/galerias/{page,[id]/page}` (pestañas Fotos, Clientes, Configuración, Historial); `components/galerias/*` (uploader con 4 en paralelo y reintento, grilla ordenable, tarjeta de cliente); tarjeta "Galerías" en la ficha del Proyecto; menú, ⌘K; `app/workspace/configuracion/galeria`.
- [ ] Crear desde el Proyecto o desde el listado (con ajustes por omisión), editar, publicar, archivar.
- [ ] Clientes: agregar contacto o alta rápida, copiar enlace, mandar correo (`GALERIA_ENVIO`) o WhatsApp,
  regenerar, anular.
- [ ] Listado estándar con estado y "esperando revisión".
- [ ] Pruebas: aislamiento, permisos, estados, topes.
- [ ] Commit `Galería: crear, subir, ordenar y compartir con los clientes`.

### Task 4: Página del cliente
**Files:** `app/w/[workspaceSlug]/galeria/[token]/{page,acciones,visitante}.tsx|ts`, `components/galeria-publica/*` (grilla perezosa, visor con flechas y deslizar, barra fija con contador y "Enviar selección", panel de comentarios, repaso), `lib/galerias/publico.ts` y pruebas; `next.config.ts` (cabeceras); `lib/website/domain/routing.ts`.
- [ ] Ver, seleccionar/quitar, filtros, comentar, enviar con mensaje, sólo lectura después, descarga de la
  vista si corresponde.
- [ ] Correo `GALERIA_SELECCION_ENVIADA` al cliente y aviso al estudio con `after()`.
- [ ] Pruebas: token cruzado entre galerías y workspaces, anulado, galería en borrador, enviar dos veces,
  mínimo/máximo, foto de otra galería, comentario vacío o largo, freno.
- [ ] Commit `Galería: el cliente elige, comenta y envía su selección`.

### Task 5: Revisión en el estudio
**Files:** pestaña por cliente en la ficha; `lib/galerias/revision.ts` y pruebas; exportación (copiar y CSV); historial.
- [ ] Ver selección y comentarios, responder, exportar en bloques, finalizar, reactivar.
- [ ] Historial de la galería.
- [ ] Commit `Galería: revisión de cada selección, exportar para Lightroom, finalizar y reactivar`.

### Task 6: Documento y verificación final
**Files:** `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-A1.md`.
- [ ] Tablas, checksum, verificación, vuelta atrás, CORS del bucket privado (PUT desde la app y dominios
  propios), encender el módulo, prueba real (galería de 10 fotos abierta desde el celular).
- [ ] Verificación completa.
- [ ] Commit `Galería: documento de migración`.
