# Etapa 7 · Galería · Entrega B (Entrega en alta, ZIP por correo y DNX FLUX) — Plan de construcción

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** galería de entrega con fotos y videos en alta, "Recibir todo por correo" con ZIP en partes armado en
segundo plano, y publicación automática desde DNX FLUX con clave de dispositivo.

**Architecture:** sobre A1 y A2 (en producción, PR 484 y 505): `lib/galerias/*`, ficha del estudio, página
pública `app/w/[workspaceSlug]/galeria/[token]`. ZIP en funciones de Vercel con cron (una parte por corrida),
sin dependencias nuevas. API de DNX FLUX en `app/api/flux/v1/*`. Cliente en el repo aparte
`~/Desktop/PROGRAMACIONES/dnx-flux` (Python 3, sólo biblioteca estándar).

**Spec:** `apps/fotoffice/docs/superpowers/specs/2026-10-10-etapa-7-galeria-design.md` §5.

## Global Constraints

- **Rama y worktree (FOTOFFICE):** `feat/fotoffice-etapa-7-galeria-entrega` desde `origin/main`, worktree
  `~/Desktop/PROGRAMACIONES/dnx-fotoffice-etapa-3`. **DNX FLUX:** rama `feat/publicar-en-fotoffice` en su repo.
- **Sin dependencias nuevas** (ni en FOTOFFICE ni en DNX FLUX).
- **Base de datos:** migración `packages/db/prisma/migrations/20261103120000_fotoffice_etapa_7_galeria_entrega/migration.sql`
  (verificar que el nombre completo no exista), sólo sobre tablas `FotofficeGaleria*` y tablas nuevas; prueba
  de fuente; no se aplica en la rama; documento `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-B.md` con checksum.
  - `FotofficeGaleriaFoto` suma `mediaType` TEXT NOT NULL DEFAULT `'FOTO'` (CHECK `FOTO|VIDEO`) y
    `contentType` TEXT?; para `VIDEO` no hay vista ni miniatura (quedan nulas).
  - **Nueva** `FotofficeGaleriaDescarga` (pedido de ZIP): workspaceId, galeriaId (CASCADE), galeriaClienteId?
    (CASCADE; nulo si lo pidió el estudio), status (CHECK `PENDIENTE|ARMANDO|LISTA|ERROR|VENCIDA`),
    totalFiles INT, totalBytes BIGINT, parts JSONB (lista `{n, key, bytes, files, estado}`), cursor JSONB
    (estado de la parte en curso: uploadId de R2, partes subidas, índice del archivo), errorReason?,
    requestedEmail?, notifiedAt?, expiresAt, createdAt, updatedAt. Índices `(status, updatedAt)`,
    `(galeriaClienteId, createdAt)`.
  - **Nueva** `FotofficeDispositivo`: workspaceId (CASCADE), name (≤ 60, no vacío), keyHash TEXT único (hex 64),
    keyPrefix TEXT (primeros 8 caracteres, para reconocerla), createdByUserId?, lastUsedAt?, revokedAt?,
    createdAt.
- **Videos:** `video/mp4` y `video/quicktime`, hasta **5 GB** (5_368_709_120) por archivo, una sola URL firmada
  PUT de 60 minutos; las fotos siguen con 50 MB. El confirmar de un video sólo comprueba tamaño real =
  declarado y deja `LISTA` sin `sharp`. Tope 200 videos por galería.
- **Galería de entrega (`kind = ENTREGA`):** se crea desde el Proyecto ("Nueva galería de entrega") o la crea
  DNX FLUX; `saleMode` queda `SELECCION` y la selección/venta no se muestran; la página pública en modo
  entrega: grilla (los videos con una tapa genérica e ícono de play), visor con `<video controls>` sobre una URL
  firmada GET del original (1 h, `inline`), "Descargar" por archivo (original, 5 min, `attachment`) y
  **"Recibir todo por correo"**.
- **ZIP:**
  - escritor propio `lib/galerias/zip.ts`: método *store* (sin compresión), encabezados locales con
    data descriptor, directorio central al final, nombres UTF-8 (bit 11), CRC32 con `zlib.crc32` si existe y
    tabla propia si no; **sin ZIP64** porque cada parte ≤ 1 GB y ≤ 65.535 archivos (validar);
  - partes de **≤ 1 GB** (1_073_741_824 bytes): se arma una parte por corrida del cron (`maxDuration = 300`),
    leyendo cada original de R2 en streaming y subiendo a R2 privado con **subida multiparte** (bloques de
    ≥ 8 MB); si la corrida se corta, la siguiente retoma desde `cursor` o rehace esa parte desde cero (lo más
    simple que sea correcto **[decisión del implementador, documentada]**);
  - un archivo más grande que 1 GB (un video) va **solo** en su propia parte (excepción al tope, hasta 5 GB,
    sigue sin ZIP64 porque < 4 GB; un video de más de 4 GB va **sin ZIP**: la página de descargas lo ofrece
    como archivo suelto);
  - claves `galerias/<ws>/<galeriaId>/descargas/<descargaId>/parte-<n>.zip`;
  - cron cada 5 minutos `/api/cron/galerias-zip` (en `vercel.json`), con candado para no armar la misma parte
    dos veces; al terminar: `LISTA`, correo al cliente (o al usuario del estudio que lo pidió) con el enlace a
    `/w/<slug>/galeria/<token>/descargas` (o la ficha del estudio), con `after()` y topes;
  - las partes vencen a los **7 días** (`VENCIDA`, se borran los objetos en el cron diario de galerías); tope de
    **3 pedidos por cliente por día** y uno activo a la vez por cliente.
- **API de DNX FLUX (`app/api/flux/v1/`):**
  - auth `Authorization: Bearer fo_dev_<secreto>`; se busca por hash; clave anulada o inexistente → 401;
    actualiza `lastUsedAt` como mucho cada 5 min; freno por clave (p. ej. 120 pedidos/min);
  - `GET proyectos?pedido=<número>` → proyectos del pedido con ese número (el número de pedido de FOTOFFICE;
    DNX FLUX usa el mismo número que el CRM) con nombre, cliente y fecha;
  - `POST galerias` `{ proyectoId, nombre? }` → crea o devuelve la galería de entrega (`kind ENTREGA`) en
    borrador de ese proyecto (una por proyecto, idempotente);
  - `POST galerias/:id/archivos` `{ archivos: [{ nombre, tipo, tamano }] }` (hasta 50 por pedido) → por cada
    uno: si ya existe uno `LISTA` con ese nombre, `{ yaEstaba: true }`; si no, crea la fila y devuelve la URL
    firmada; `POST galerias/:id/archivos/:fotoId/confirmar` → procesa como el confirmar del estudio;
  - `GET galerias/:id` → conteos por estado (para el reintento);
  - todo acotado al workspace de la clave; respuestas en JSON con mensajes en español; nunca datos personales
    en los registros.
- **Estudio:** Configuración → Galería → **Dispositivos** (conectar, nombre, prefijo, último uso, anular; la
  clave completa se muestra **una sola vez**); en la ficha de una galería de entrega: subir fotos y videos,
  "Preparar descarga" (ZIP para el estudio) y estado de los pedidos de descarga.
- **DNX FLUX (Python):**
  - módulo `dnxflux/fotoffice.py`: cliente HTTP con `urllib`, reintentos con espera creciente, subida PUT de
    cada archivo de `Entregas` (JPG y videos), confirmación, resumen;
  - paso nuevo `publicar_fotoffice` en `pasos.py` después de exportar las entregas: busca el proyecto por el
    número de pedido, crea/completa la galería, sube lo que falta, registra en el estado del pedido (`paso
    "fotoffice"`) y en el registro; respeta el modo simulación;
  - configuración: dirección de FOTOFFICE en `config.json` (`fotoffice.url`, por omisión
    `https://fotoffice.com`) y la **clave en el llavero** (como la contraseña de Alboom), con un campo en la
    ventana para pegarla; opción "publicar en Proof" / "publicar en FOTOFFICE" / ambos;
  - pruebas con `unittest` y un servidor HTTP falso local.
- **Textos:** español rioplatense; "dinero", nunca "plata"; **DNX FLUX** en mayúsculas.
- **Verificación (FOTOFFICE):** vitest completo; tsc con `NODE_OPTIONS=--max-old-space-size=8192` (código de
  salida y salida); prisma validate/generate; `next build --webpack` y `rm -rf apps/fotoffice/.next`.
  **DNX FLUX:** `python3 -m unittest` completo.
- **Commits:** en español, con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

### Task 1: Datos, videos y galería de entrega
**Files:** schema, migración y prueba de fuente; `lib/galerias/*` (tipo de medio, límites de video, crear galería de entrega, URLs de video); ficha del estudio (subir videos, crear entrega desde el Proyecto); página pública en modo entrega con visor de video y descarga por archivo; pruebas.
- [ ] Commit `Galería: entregas con fotos y videos (SQL sin aplicar)`.

### Task 2: ZIP por correo
**Files:** `lib/galerias/{zip,descargas}.ts`, cron `app/api/cron/galerias-zip`, `vercel.json`, botón "Recibir todo por correo" y página `/descargas`, "Preparar descarga" en el estudio, correo `GALERIA_DESCARGA_LISTA` (tipo de plantilla GALERIA), limpieza a los 7 días; pruebas (ZIP válido: armarlo en memoria y abrirlo con `unzip -t` o leyendo el directorio central; partes; retomar; topes).
- [ ] Commit `Galería: descargar todo por correo, en partes de hasta 1 GB`.

### Task 3: API para DNX FLUX y dispositivos
**Files:** `lib/galerias/{dispositivos,flux}.ts`, `app/api/flux/v1/**`, Configuración → Galería → Dispositivos; pruebas (clave anulada, otro workspace, idempotencia por nombre, tope por pedido, freno).
- [ ] Commit `Galería: API para que DNX FLUX publique las entregas`.

### Task 4: DNX FLUX publica en FOTOFFICE (repo `dnx-flux`)
**Files:** `dnxflux/fotoffice.py`, `dnxflux/pasos.py`, `dnxflux/config.py`, ventana (`dnxflux/web/*`), `config.example.json`, README; pruebas `unittest`.
- [ ] Commit `Publicar las entregas en FOTOFFICE`.

### Task 5: Documento y verificación final
**Files:** `packages/db/docs/MIGRACION-ETAPA-7-GALERIA-B.md`.
- [ ] Commit `Galería: documento de migración de la Entrega B`.
