# FOTOFFICE Digitalización · Parte 2 (Conversión) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Un Cloud Run Job que toma cada grabación terminada, la convierte con ffmpeg en un MP4 Full HD 16:9 recortado, con la marca animada del negocio, la guarda en el R2 privado y borra los crudos; y la lista de FOTOFFICE muestra el estado y deja ver o descargar el video.

**Architecture:** Cola en `DigitalizacionGrabacion` (columnas nuevas). Worker Node en `apps/fotoffice-workers/digitalizacion`:
- toma una grabación con `SKIP LOCKED`;
- arma un plan puro (entradas, recortes, filtros);
- alimenta ffmpeg por FIFO, una parte por vez y bufferizada, desde R2;
- sube el `stdout` (MP4 fragmentado) con multiparte;
- marca LISTA y borra los pedacitos.

Se dispara por Cloud Scheduler.

**Tech Stack:** Node 20, TypeScript, Prisma (`@repo/db`), `@aws-sdk/client-s3` + `@aws-sdk/lib-storage`, `sharp`, ffmpeg 6+, vitest; Next.js 16 (FOTOFFICE); Google Cloud Run Jobs + Cloud Scheduler.

**Spec:** `docs/superpowers/specs/2026-10-20-fotoffice-digitalizacion-conversion-design.md` (decisiones P1–P15). Parte 1: `docs/superpowers/specs/2026-10-20-fotoffice-digitalizacion-grabadora-design.md`.

## Global Constraints

- **Salida:** 1920×1080, `fps=30`, H.264 High `yuv420p`, `-crf 21 -maxrate 10M -bufsize 20M`, preset por variable (default `veryfast`), AAC 192k 48 kHz, `-movflags frag_keyframe+empty_moov+default_base_moof -f mp4 pipe:1`.
- **Imagen:**
  - `yadif=deint=interlaced`, después `scale=iw*sar:ih,setsar=1`.
  - Estirada: `scale=1440:1080`. Si no: `scale=1920:1080:force_original_aspect_ratio=decrease`.
  - Después `pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p`.
- **Recortes:** margen 5 s. Tramo 1 desde `max(0, primera−5)`; tramo `ultimaImagenTramo` hasta `ultima+5`; tramos posteriores se descartan; `sinImagen` (VHS) → SIN_IMAGEN.
- **Marca:**
  - Aparece en `t = 60 + 600·k`, visible 8 s, entra y sale en 0,6 s desde la derecha.
  - Posición: abajo a la derecha, a 40 px del borde.
  - Contenido: "Digitalizado por:", el logo (o `commercialName`) y WhatsApp + número (si hay).
- **Cola:**
  - Toma sólo PENDIENTE con `terminadaAt` ≤ ahora − 15 min y sin partes PENDIENTE creadas hace menos de 30 min.
  - Máximo 3 intentos.
  - PROCESANDO de más de 6 h → PENDIENTE, o ERROR si ya hizo 3 intentos.
- **Claves R2:** final `digitalizacion/<ws>/<id>/final.mp4`; los pedacitos borrados son los de prefijo `digitalizacion/<ws>/<id>/t`.
- **Fechas en SQL crudo:** se pasan como parámetros JS (`Date`), nunca `now() AT TIME ZONE`. Las columnas son `TIMESTAMP(3)` sin zona, en UTC.
- **Dependencias nuevas:** si el lockfile cambia, correr `pnpm install` en la raíz y verificar que `pnpm --filter fotoffice test` sigue en verde. El lockfile es de todas las apps.
- **Migración:** a mano, sólo `ADD COLUMN IF NOT EXISTS` sobre `DigitalizacionGrabacion` + índice. El controlador la aplica en producción **antes** del deploy.
- **Contexto común:** commits en español con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`, `git add` con rutas explícitas, sin push, sin subagentes.

## Review Focus

1. **Una cinta de 3 h no puede llenar la memoria del contenedor:** nada se escribe en `/tmp` salvo el PNG de la marca y los FIFO. Cada parte se bufferiza sola y después se suelta. Tarea 4.
2. **Un tramo sin audio o sin video hace fallar `concat`.** Se espera ERROR con un mensaje legible, no un cuelgue. Tarea 4: timeout por inactividad de ffmpeg (sin progreso en 10 min, se mata).
3. **Dos ejecuciones del job en paralelo no pueden convertir la misma grabación.** Tarea 3: SQL con `SKIP LOCKED` y test de la consulta.
4. **No se pueden borrar los crudos si la subida final no terminó bien.** Tarea 4: borrar sólo después de `Upload.done()` y del `UPDATE` a LISTA.
5. **Pedacitos que llegan después de que la conversión empezó.** Tarea 1: el servidor los rechaza.

---

### Task 1: Columnas de conversión y cambios del servidor de FOTOFFICE

**Files:**
- `packages/db/prisma/schema.prisma`: columnas en `DigitalizacionGrabacion` + `@@index([conversionEstado, terminadaAt])`.
- `packages/db/prisma/migrations/20261128120000_fotoffice_digitalizacion_conversion/migration.sql`
- `apps/fotoffice/lib/digitalizacion/servidor/grabaciones.ts` (+ test)
- `apps/fotoffice/lib/digitalizacion/servidor/almacen.ts`: `urlDeVideo(clave, nombre, modo)`.
- `apps/fotoffice/app/(shell)/digitalizacion/actions.ts`: `urlDeVideoAction`, `reintentarConversionAction`.
- `apps/fotoffice/lib/digitalizacion/constants.ts`: `ESTADOS_CONVERSION`.

**Interfaces:**
- Produces: tipo `EstadoConversion = "PENDIENTE" | "PROCESANDO" | "LISTA" | "ERROR" | "SIN_IMAGEN"`.
- Produces: `urlDeVideoAction(id: string, modo: "ver" | "descargar"): Promise<Resultado<{ url: string }>>`.
- Produces: `reintentarConversionAction(id: string): Promise<Resultado<Nada>>`.
- Produces: `listarGrabaciones` devuelve además `conversionEstado`, `conversionError`, `videoBytes`, `videoDuracionSeg` y `partesBorradasAt`.

Pasos:
- [ ] **Schema.** Agregar las columnas exactamente como el spec (tabla "Modelo de datos"), más `@@index([conversionEstado, terminadaAt])`. Validar con `prisma validate` y regenerar el cliente (`DATABASE_URL` y `DIRECT_URL` de mentira, sin conectarse).
- [ ] **Migración idempotente:**
  ```sql
  ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "conversionEstado" TEXT;
  ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "conversionIntentos" INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "conversionError" TEXT;
  ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "conversionLockAt" TIMESTAMP(3);
  ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "videoKey" TEXT;
  ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "videoBytes" BIGINT;
  ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "videoDuracionSeg" INTEGER;
  ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "convertidaAt" TIMESTAMP(3);
  ALTER TABLE "DigitalizacionGrabacion" ADD COLUMN IF NOT EXISTS "partesBorradasAt" TIMESTAMP(3);
  CREATE INDEX IF NOT EXISTS "DigitalizacionGrabacion_conversionEstado_terminadaAt_idx" ON "DigitalizacionGrabacion"("conversionEstado", "terminadaAt");
  ```
- [ ] **Tests nuevos en `grabaciones.test.ts`** (rojo primero, con el mock de `@repo/db` que ya existe):
  - `cerrarGrabacion` VHS con `sinImagen: true` guarda `conversionEstado: "SIN_IMAGEN"`;
  - `cerrarGrabacion` con imagen o DVD guarda `"PENDIENTE"`;
  - `terminarConLoGrabado` guarda `"PENDIENTE"`;
  - `pedirParte` rechaza (`definitivo`) con `conversionEstado` PROCESANDO o LISTA, o con `partesBorradasAt`;
  - `urlsDeLectura` rechaza con `partesBorradasAt`;
  - `reintentarConversion` sólo pasa de ERROR a PENDIENTE (intentos en 0, error en null);
  - `urlDeVideo` exige `conversionEstado === "LISTA"` y `videoKey`.
- [ ] **Implementar.** `grabacionDelNegocio` selecciona también `conversionEstado` y `partesBorradasAt`. `urlDeVideo` en `almacen.ts` firma un GET por 2 h con `ResponseContentDisposition` inline o attachment (mismo patrón que `lib/carpetas/almacen.ts`, `urlDeLecturaArchivo`); valida que la clave termine en `/final.mp4` bajo el prefijo `digitalizacion/`.
- [ ] **Acciones.** `urlDeVideoAction` con nivel VIEW; `reintentarConversionAction` con MANAGE, más `revalidatePath("/digitalizacion")`.
- [ ] **Verificar y commitear.** `pnpm test -- lib/digitalizacion`, typecheck y commit.

### Task 2: Lista de grabaciones con el estado de conversión

**Files:**
- `apps/fotoffice/app/(shell)/digitalizacion/page.tsx`
- `apps/fotoffice/components/digitalizacion/acciones-grabacion.tsx`

Pasos:
- [ ] **Etiqueta de estado** al lado del de la grabación:

  | Estado de conversión | Texto |
  |---|---|
  | `PENDIENTE` | "En cola para convertir" |
  | `PROCESANDO` | "Convirtiendo…" |
  | `LISTA` | "Video listo" (con duración final y tamaño) |
  | `SIN_IMAGEN` | "Sin imagen: no se convierte" |
  | `ERROR` | "Error: {conversionError}" |

- [ ] **Botones.** Con LISTA: "Ver video" (abre la URL firmada inline en una pestaña nueva) y "Descargar video". Con ERROR y MANAGE: "Reintentar conversión". Con `partesBorradasAt`: ocultar "Descargar crudo".
- [ ] **Variantes de color.** Todos los `fo-btn` con variante; lo verifican `lib/ui/botones.test.ts` y `lib/design-system/botones-con-variante.test.ts`.
- [ ] **Verificar.** typecheck dirigido, eslint, `pnpm test` completo de FOTOFFICE y commit.

### Task 3: Paquete del worker, configuración y cola

**Files:**
- Create `apps/fotoffice-workers/digitalizacion/{package.json,tsconfig.json,vitest.config.ts,src/config.ts,src/prisma.ts,src/cola.ts,src/cola.test.ts}`.
- Agregar `apps/fotoffice-workers/*` a `pnpm-workspace.yaml` si no lo cubre un glob existente (verificar).

**Interfaces:**
- `getConfig(): Config`. Config tiene `databaseUrl`, `r2: { endpoint, accessKeyId, secretAccessKey }` (prefiere `FOTOFFICE_R2_*`), `bucket` (default `fotoffice-private`), `maxHoras` (20), `preset` ("veryfast").
- `tomarSiguiente(prisma, ahora: Date): Promise<string | null>`.
- `recuperarTrabadas(prisma, ahora): Promise<number>`.
- `marcarLista(prisma, id, { videoKey, videoBytes, videoDuracionSeg })`.
- `marcarError(prisma, id, mensaje)`.
- `marcarPartesBorradas(prisma, id)`.

Pasos:
- [ ] **`package.json`** al estilo de `apps/compramelafoto-workers/video`. Nombre `fotoffice-digitalizacion-worker`, `"type": "module"`, scripts `drain`, `once`, `test` (vitest), `typecheck`. Dependencias: `@repo/db`, `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `sharp`, `zod`, `dotenv`. Dev: `tsx`, `typescript`, `vitest`, `@types/node`. Usar las mismas versiones que ya están en el lockfile; verificar con `grep` en `pnpm-lock.yaml`.
- [ ] **`cola.ts` con SQL crudo parametrizado.** La consulta de `tomarSiguiente`:
  ```sql
  UPDATE "DigitalizacionGrabacion" SET "conversionEstado"='PROCESANDO', "conversionLockAt"=$1, "conversionIntentos"="conversionIntentos"+1, "conversionError"=NULL
  WHERE id = (SELECT g.id FROM "DigitalizacionGrabacion" g
    WHERE g."conversionEstado"='PENDIENTE' AND g."terminadaAt" <= $2
      AND NOT EXISTS (SELECT 1 FROM "DigitalizacionParte" p WHERE p."grabacionId"=g.id AND p.estado='PENDIENTE' AND p."createdAt" > $3)
    ORDER BY g."terminadaAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1)
  RETURNING id
  ```
  Con `$1 = ahora`, `$2 = ahora − 15 min`, `$3 = ahora − 30 min`. `recuperarTrabadas` hace dos `UPDATE` para los PROCESANDO con `conversionLockAt < ahora − 6 h`: si `conversionIntentos >= 3`, pasan a ERROR con "La conversión se cortó 3 veces."; si no, vuelven a PENDIENTE.
- [ ] **Tests de `cola.ts`** con un `prisma` falso que captura `$queryRawUnsafe` / `$executeRawUnsafe` y sus parámetros. Verifican:
  - los tres instantes exactos;
  - que la consulta contenga `FOR UPDATE SKIP LOCKED`;
  - que `recuperarTrabadas` use `ahora − 6 h` y el umbral de 3 intentos.
- [ ] **Verificar y commitear.** `pnpm install` en la raíz si cambió algo y `pnpm --filter fotoffice-digitalizacion-worker test`.

### Task 4: Plan, marca y conversión

**Files:**
- Create `src/plan.ts`, `src/plan.test.ts`, `src/marca-tiempo.ts`, `src/marca-tiempo.test.ts`, `src/marca.ts`, `src/marca.test.ts`, `src/r2.ts`, `src/convertir.ts`, `src/index.ts`, `scripts/prueba-local.ts`.

**Interfaces:**
- `armarPlan(g: GrabacionParaPlan, partes: ParteR2[]): Plan`, donde:
  - `Plan = { tipo: "SIN_IMAGEN" } | { tipo: "SIN_PARTES" } | { tipo: "CONVERTIR"; esDvd: boolean; corregirProporcion: boolean; entradas: { tramo: number; claves: string[]; desdeSeg: number | null; hastaSeg: number | null }[] }`;
  - las claves de cada entrada van ordenadas por `indice`.
- `argumentosFfmpeg(plan, rutasEntrada: string[], rutaMarca: string, preset: string): string[]`, con el `-filter_complex` que arma `filtroComplejo(plan)`.
- `posicionMarcaX(t, W, w): number` (JS) y `expresionMarcaX(): string` (ffmpeg), las dos con la misma lógica.
- `armarMarca(branding: { commercialName: string; logoUrl: string | null; whatsapp: string | null }, cargarLogo: (url) => Promise<Buffer | null>): Promise<Buffer>` (PNG).
- `convertirGrabacion(deps, id): Promise<void>`.

Lógica de la marca:
- Con `u = t − 60` y `m = mod(u, 600)`:
  - `t < 60`: oculta (`x = W`);
  - `m < 0.6`: entra (`x = W − (m/0.6)·(w+40)`);
  - `m < 7.4`: quieta (`x = W − w − 40`);
  - `m < 8`: sale (`x = W − w − 40 + ((m−7.4)/0.6)·(w+40)`);
  - el resto: oculta.
- En ffmpeg: `overlay=x='…':y='H-h-40':eval=frame:shortest=1`, con la marca entrando como `-loop 1 -framerate 30 -i marca.png`.

Filtro por entrada `i` (video y audio; `trim`/`atrim` sólo cuando hay recorte):
```
[i:v:0]trim=start=D:end=H,setpts=PTS-STARTPTS,yadif=deint=interlaced,scale=iw*sar:ih,setsar=1,ESCALA,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1,fps=30,format=yuv420p[vi];
[i:a:0]atrim=start=D:end=H,asetpts=PTS-STARTPTS,aresample=48000[ai]
```
Con más de una entrada, se unen con `concat=n=N:v=1:a=1[vc][ac]`; con una sola, `[v0]null[vc];[a0]anull[ac]`. Después va el overlay de la marca sobre `[vc]`, que da `[vout]`. Se mapean `[vout]` y `[ac]`.

Pasos:
- [ ] **Tests puros (rojo → verde):**
  - plan VHS de un tramo con recortes;
  - plan VHS de 3 tramos con `ultimaImagenTramo = 2`: el tramo 3 se descarta, el 1 tiene `desde` y el 2 tiene `hasta`;
  - `primeraImagenSeg = 2`, que da `desde = 0`;
  - `sinImagen`, que da SIN_IMAGEN;
  - DVD: una sola entrada, sin recortes, partes en orden de `indice`;
  - sin partes, que da SIN_PARTES;
  - el filtro contiene `scale=1440:1080` cuando hay `corregirProporcion` y `force_original_aspect_ratio=decrease` cuando no;
  - concat con `n=3`;
  - `posicionMarcaX` en t = 30, 60, 60.3, 64, 67.7, 68.5 y 660.3 (oculta, entra, entra, quieta, sale, oculta, entra);
  - `expresionMarcaX()` contiene `mod(t-60,600)`;
  - `armarMarca` sin logo y sin WhatsApp devuelve un PNG válido (con `sharp` se lee el ancho; mínimo 200 px).
- [ ] **`r2.ts`:**
  - `S3Client` con `requestChecksumCalculation: "WHEN_REQUIRED"`;
  - `leerParte(clave): Promise<Buffer>` (bufferiza el cuerpo entero);
  - `subirStream(clave, stream): Promise<number>`, con `Upload` de lib-storage, `partSize` 64 MB, `queueSize` 2, `ContentType` `video/mp4`; devuelve los bytes subidos (`HeadObject` al final);
  - `borrarPrefijo(prefijo)`, que lista y borra de a 1000.
- [ ] **`convertir.ts`.** Pasos de la conversión:
  1. Leer la grabación (con el `workspaceId`), sus partes LISTA y el branding (`FotofficeWorkspaceBranding`).
  2. Armar el plan. Si sale SIN_IMAGEN, marcar SIN_IMAGEN; si sale SIN_PARTES, marcar ERROR con "No hay partes subidas.".
  3. Crear `mkdtemp` y los FIFO con `mkfifo` (`execFile`).
  4. Escribir el PNG de la marca.
  5. Lanzar ffmpeg con `spawn` y los argumentos.
  6. Arrancar los escritores al mismo tiempo, uno por FIFO. Cada uno abre el FIFO con `fs.createWriteStream`, y para cada clave hace `await leerParte` y escribe respetando la contrapresión (`drain`); al final cierra.
  7. Subir `ffmpeg.stdout` con `subirStream` a la clave final.
  8. Leer `stderr`: guardar la última `time=` para la duración y las últimas 20 líneas para el error.
  9. Timeout por inactividad: si `stderr` no muestra progreso en 10 minutos, matar ffmpeg y marcar ERROR.
  10. Con código 0 y subida completa: `marcarLista`, después `borrarPrefijo` de los pedacitos y después `marcarPartesBorradas`.
  11. Ante cualquier error: `marcarError` con un mensaje corto; si el intento fue el tercero, el mensaje termina en "(último intento)". Borrar la carpeta temporal en `finally`.
- [ ] **`index.ts`.** Modo `drain`: `recuperarTrabadas`, después convertir con `tomarSiguiente` en bucle hasta que devuelva null o pasen `maxHoras`. Modo `once`: una sola.
- [ ] **Prueba local real, `scripts/prueba-local.ts`.** Mismo `convertir` con dependencias falsas: `leerParte` lee archivos de una carpeta, `subirStream` escribe a un archivo local y la base es un objeto en memoria. Genera con ffmpeg:
  - un tramo 1 WebM VP9+Opus de 90 s, 1280×720, `testsrc2` + tono, partido en pedacitos de 10 s con el segmentador por bytes: `head -c` sobre el archivo entero en trozos de unos 1,2 MB, que imita a `MediaRecorder` (pedazos de bytes de un mismo stream, no archivos independientes);
  - un tramo 2 de 30 s;
  - un VOB de prueba de 40 s: MPEG-2 720×480, `-flags +ilme+ildct`, aspecto 4:3, AC3.

  Corre los casos VHS (estirada y no estirada) y DVD, y verifica con `ffprobe`:
  - salida 1920×1080, 30 fps, H.264 y AAC;
  - la duración esperada (con recortes `primera = 20` y `ultima = 15` en el tramo 2: 15 + 20 = 35 s, ±1 s);
  - con `ffmpeg -ss 64 -frames:v 1`, que la esquina inferior derecha del cuadro difiere de la del segundo 70 (marca visible contra oculta).

  Guarda las capturas en la carpeta temporal del script. **Esta prueba es criterio de aceptación de la tarea.**
- [ ] **Verificar y commitear.** Tests del worker, typecheck y commit.

### Task 5: Imagen, deploy y disparo (controlador)

**Files:**
- Create `apps/fotoffice-workers/digitalizacion/Dockerfile`, basado en el de `apps/compramelafoto-workers/video`: `ffmpeg`, `fonts-dejavu-core`, `openssl`, copia de `packages/db` y del worker, `prisma generate`, `CMD ["pnpm","drain"]`.
- Create `apps/fotoffice-workers/digitalizacion/cloudbuild.yaml`, que construye la imagen y la sube a `us-east1-docker.pkg.dev/dnx-video-worker/dnx-video/digitalizacion:<tag>`.
- Create `apps/fotoffice-workers/digitalizacion/README.md`: qué hace, variables y el paso de Daniel (crear el secreto `FOTOFFICE_DATABASE_URL`).

Pasos del controlador:
- [ ] **Construir la imagen.** `gcloud builds submit` desde la raíz con el `cloudbuild.yaml`.
- [ ] **Crear o actualizar el job:**
  ```bash
  gcloud run jobs deploy digitalizacion-worker --region us-east1 --image … --cpu 4 --memory 4Gi --task-timeout 24h --max-retries 0 --tasks 1 --set-secrets DATABASE_URL=FOTOFFICE_DATABASE_URL:latest,R2_ACCOUNT_ID=R2_ACCOUNT_ID:latest,R2_ACCESS_KEY_ID=R2_ACCESS_KEY_ID:latest,R2_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY:latest,R2_ENDPOINT=R2_ENDPOINT:latest --set-env-vars FOTOFFICE_R2_PRIVATE_BUCKET=fotoffice-private
  ```
  Usar la misma cuenta de servicio que `video-worker` (leerla con `gcloud run jobs describe video-worker`).
- [ ] **Disparo.** Cloud Scheduler `disparar-digitalizacion-worker` cada 15 minutos, con la misma cuenta de servicio y la misma forma que `disparar-video-worker` (leerla con `gcloud scheduler jobs describe`).
- [ ] **Bloqueo hasta que Daniel cargue el secreto.** El deploy del job necesita que exista `FOTOFFICE_DATABASE_URL`. Si no existe, se le pide a Daniel con el comando exacto (`printf '%s' '<URL de Vercel>' | gcloud secrets create FOTOFFICE_DATABASE_URL --data-file=- --project dnx-video-worker`) y se espera.
- [ ] **Verificación en producción.** Ejecutar `gcloud run jobs execute digitalizacion-worker --wait` sobre una grabación de prueba. Si no hay, crearla desde `/digitalizacion/grabar` con una cámara web. Mirar los logs: tiene que quedar LISTA y verse en la lista. Si R2 da AccessDenied sobre `fotoffice-private`, pedir a Daniel `FOTOFFICE_R2_ACCESS_KEY_ID` / `FOTOFFICE_R2_SECRET_ACCESS_KEY`.
