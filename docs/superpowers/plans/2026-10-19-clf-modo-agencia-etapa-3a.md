# Modo agencia — Etapa 3a (puerta DNX FLUX en CLF: vínculo, subida directa y espera del filtro) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un fotógrafo de una agencia vincule DNX FLUX con su cuenta de CLF mediante un código corto, y que DNX FLUX pueda pedir sus agencias y lugares, subir fotos JPG directo a R2 con URLs firmadas y confirmarlas para que entren a la fila de ingesta común con autor, álbum de la agencia y punto declarado; además, dejar listo el estado de espera del filtro de la nube (`Agency.publishMode = AWAIT_FILTER`) con su señal interna firmada. Sólo el lado servidor de CLF: el programa DNX FLUX es la etapa 3b (otro repo, otra sesión).

**Architecture:** Tres tablas nuevas: `AgencyLinkCode` (código de un solo uso, 10 minutos, guardado con SHA-256), `AgencyDeviceKey` (llave de dispositivo **por usuario**, `clf_dev_…`, guardada con SHA-256 y mostrada una sola vez) y `AgencyFluxUpload` (cada archivo pedido por DNX FLUX: su `rawKey` en R2, punto declarado y estado `UPLOADING` → `CONFIRMED`/`REJECTED`). Una columna nueva en `CameraIngestJob` (`agencyDeviceKeyId`) y dos valores de enum nuevos: `AlbumPhotoIngestSource.FLUX` y `CameraIngestJobStatus.AWAITING_FILTER`. Las rutas `POST /api/agency-ingest/v1/link`, `GET …/me`, `POST …/batches` y `POST …/photos/[id]/confirm` se autentican con `Authorization: Bearer clf_dev_…`, re-chequean en **cada** pedido que el fotógrafo sea miembro ACTIVE con condiciones al día (`checkAgencyUploadTarget`, que comparte la lógica con el FTP de la etapa 2b) y encolan con `enqueueAlbumPhotoIngest` (el mismo encolado de la subida web, extendido con campos opcionales). Las repetidas no se reconstruyen: las descarta `finalizeAlbumPhotoFromRaw` (etapa 2a) al procesar; DNX FLUX además puede mandar la huella `sha256` para que el servidor le diga "ya estaba" antes de subir. El modo `AWAIT_FILTER` frena el trabajo **antes** de crear la `Photo` (estado `AWAITING_FILTER` del job, que el cron nunca toma); la señal firmada `POST /api/internal/agency-filter/decisions` lo pasa a `PENDING` (aprobada) o lo cierra y borra el raw (rechazada). Así ninguna de las ~130 consultas que muestran fotos a compradores cambia.

**Tech Stack:** Next.js App Router (`params` como `Promise`, ver `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`), Prisma (`@/lib/prisma`), PostgreSQL Neon, Cloudflare R2 (`getSignedPutUrl`), `node:crypto` (SHA-256, HMAC), vitest (`../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-18-clf-modo-agencia-design.md` (Parte 2: "Puerta DNX FLUX", "Repetidas", "Encaje con el filtrado"; Parte 5: credenciales revocables; Parte 6: etapa 3).

## Global Constraints

- Todo texto visible en español rioplatense (voseo), claro para fotógrafos no técnicos. Horas mostradas en hora argentina (`America/Argentina/Buenos_Aires`).
- **CLF vende en producción: cambios aditivos.** Los álbumes que NO son de agencia, la subida web, el FTP viejo (`CameraConnectionSettings`) y el cron de ingesta se comportan exactamente igual que antes.
- **Nunca credenciales en archivos.** Códigos y llaves se guardan sólo como SHA-256 (hex); la llave completa se devuelve **una sola vez** (al canjear el código). El secreto de la señal del filtro vive sólo en Vercel (`AGENCY_FILTER_SIGNAL_SECRET`).
- Código de vínculo: 8 caracteres del alfabeto `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sin 0/O/1/I), se muestra como `XXXX-XXXX`, vence a los **10 minutos**, sirve **una vez**; generar uno nuevo anula los anteriores sin usar. Canje: tope de **10 pedidos por minuto por IP**.
- Llave de dispositivo: `clf_dev_` + 43 caracteres base64url (32 bytes al azar), **por usuario** (sirve para todas sus agencias activas), tope **10 activas por usuario**, revocable desde "Mis agencias". Tope de **120 pedidos por minuto por llave**.
- DNX FLUX sube **sólo JPG** (`image/jpeg`, nombre `.jpg`/`.jpeg`) de hasta `getAlbumPhotoMaxBytes()` (10 MB por defecto, el tope de CLF), **máximo 50 archivos por pedido**, URLs firmadas de PUT por **15 minutos**, directo a R2: nunca pasa un archivo por Vercel.
- En **cada** pedido de `batches` y `confirm` se vuelve a chequear: álbum existente, de **esa** agencia, miembro ACTIVE con las condiciones vigentes aceptadas (`checkAgencyUploadTarget`) y Mercado Pago conectado (`ensureMpConnected`, la regla de siempre).
- `Agency.publishMode` ya existe (columna `String`, por defecto `"IMMEDIATE"`, etapa 1). **En esta etapa queda sólo en la base:** no se agrega selector en "Mi agencia" porque el filtro todavía no existe y una agencia que lo encienda dejaría todas sus fotos esperando para siempre. Se enciende a mano por SQL cuando el filtro esté andando.
- La migración `20261125120000_clf_agencia_flux` es idempotente (`CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `ADD VALUE IF NOT EXISTS`, claves foráneas dentro de bloques `DO` que miran `pg_constraint`, partes de `CameraIngestJob` y de sus enums dentro de bloques `DO` que miran si existen). Se aplica **a mano** en producción de CLF **antes** de fusionar. (`20261124120000` ya lo usa `fotoffice_qr_mostrador`: por eso el día 25.)
- Tests: `beforeEach(() => { ... })` siempre con llaves. Si una ruta testeada importa algo nuevo de un módulo que el test mockea con `vi.mock`, la fábrica del mock tiene que incluirlo.
- Typecheck: `NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck; echo exit=$?` desde `apps/compramelafoto`. Puede morir por memoria y aun así terminar con apariencia de éxito: revisar que no haya líneas `error TS` ni `FATAL ERROR`.
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/wt-clf-agencia-3a` (rama `feat/clf-agencia-etapa-3a`).

## Review Focus

1. **Se corta la conexión a mitad de una tanda y DNX FLUX vuelve a pedir los mismos archivos:** recibe la **misma** fila de subida (misma `uploadId`, URL nueva) para los que no confirmó y `{ alreadyThere: true }` para los confirmados o ya publicados; nunca se crean filas ni fotos dobles. Tests en Task 6.
2. **La confirmación llega dos veces (reintento de red) o dos a la vez:** un solo `CameraIngestJob` (idempotente por `rawKey`) y la fila pasa a `CONFIRMED` una sola vez (`updateMany` con `status: "UPLOADING"`). Test en Task 7.
3. **Al fotógrafo lo dan de baja, la agencia cambia sus condiciones o el álbum deja de ser de la agencia después de vincular:** `batches` y `confirm` responden 403 con el motivo y no encolan nada; la misma llave sigue sirviendo para sus otras agencias. Tests en Task 6 y Task 7.
4. **Código de vínculo vencido, ya usado, mal tipeado o adivinado a fuerza bruta:** 400 con un mensaje claro, sin crear llave; el pedido 11 del mismo minuto desde la misma IP recibe 429; si el usuario ya tiene 10 computadoras vinculadas, 409 **sin gastar el código**. Tests en Task 2 y Task 4.
5. **Álbum común (no de agencia) y FTP viejo:** `enqueueAlbumPhotoIngest` sin opciones arma exactamente los mismos datos que antes (`WEB_UPLOAD`, `PENDING`) y el FTP sin agencia sigue encolando `PENDING`; un job `AWAITING_FILTER` nunca lo toma el cron. Tests en Task 5 y Task 8.

---

## File Structure

```
packages/db/prisma/schema.prisma                                              (modificar)
packages/db/prisma/migrations/20261125120000_clf_agencia_flux/migration.sql   (crear)

apps/compramelafoto/lib/agencies/flux-keys.ts            código de vínculo, llave de dispositivo, autenticación
apps/compramelafoto/lib/agencies/flux-keys.test.ts
apps/compramelafoto/lib/agencies/flux-http.ts            respuestas JSON sin caché, freno por llave, lectura del cuerpo
apps/compramelafoto/lib/agencies/upload-target.ts        "¿puede este usuario subir a este álbum de esta agencia?" (FTP y FLUX)
apps/compramelafoto/lib/agencies/upload-target.test.ts
apps/compramelafoto/lib/agencies/ftp-login.ts            (modificar: usa upload-target; devuelve awaitFilter)
apps/compramelafoto/lib/agencies/ftp-login.test.ts       (modificar)
apps/compramelafoto/lib/agencies/publish-mode.ts         IMMEDIATE | AWAIT_FILTER
apps/compramelafoto/lib/agencies/publish-mode.test.ts
apps/compramelafoto/lib/agencies/flux-uploads.ts         validar tanda, punto, pedir subidas, confirmar
apps/compramelafoto/lib/agencies/flux-uploads.test.ts
apps/compramelafoto/lib/agencies/filter-signal.ts        firma HMAC y decisiones del filtro
apps/compramelafoto/lib/agencies/filter-signal.test.ts
apps/compramelafoto/lib/albums/enqueue-album-photo-ingest.ts                     (modificar: opciones FLUX)
apps/compramelafoto/lib/albums/enqueue-album-photo-ingest.test.ts
apps/compramelafoto/lib/camera-connection/create-camera-upload-log-and-enqueue.ts (modificar: awaitFilter)
apps/compramelafoto/lib/camera-connection/create-camera-upload-log-and-enqueue.agency.test.ts
apps/compramelafoto/lib/camera-connection/claim-camera-ingest-job.agency.test.ts
apps/compramelafoto-workers/camera-ftp-gateway/src/handle-upload.ts             (modificar: pasa awaitFilter)

apps/compramelafoto/app/api/fotografo/agencias/flux/route.ts                 GET dispositivos, POST código
apps/compramelafoto/app/api/fotografo/agencias/flux/[deviceId]/route.ts      DELETE desvincular
apps/compramelafoto/app/api/fotografo/agencias/flux/flux-devices.test.ts
apps/compramelafoto/app/api/agency-ingest/v1/link/route.ts
apps/compramelafoto/app/api/agency-ingest/v1/me/route.ts
apps/compramelafoto/app/api/agency-ingest/v1/link-me.test.ts
apps/compramelafoto/app/api/agency-ingest/v1/batches/route.ts
apps/compramelafoto/app/api/agency-ingest/v1/photos/[id]/confirm/route.ts
apps/compramelafoto/app/api/agency-ingest/v1/batches-confirm.test.ts
apps/compramelafoto/app/api/internal/agency-filter/decisions/route.ts
apps/compramelafoto/app/api/internal/agency-filter/decisions/route.test.ts

apps/compramelafoto/components/agencies/FluxDevicesCard.tsx                   tarjeta "Subir desde la computadora"
apps/compramelafoto/app/fotografo/agencias/mis-agencias/[agencyId]/camara/page.tsx (modificar: título + tarjeta)
apps/compramelafoto/app/fotografo/agencias/mis-agencias/page.tsx                    (modificar: texto del botón)
apps/compramelafoto/vitest.bot.config.ts                                            (modificar include)
```

### Decisiones de diseño (para quien revise)

- **Tablas nuevas en vez de reutilizar `AgencyUploadCredential`.** Esa tabla es por miembro **y álbum**, con `ftpUsername` y `ftpPasswordHash` obligatorios y únicos; meter llaves de dispositivo ahí obligaría a volver opcionales columnas de un login que ya está en producción. Una tabla propia (`AgencyDeviceKey`, forma de `FotofficeDispositivo`) no toca el FTP.
- **Llave por usuario, no por membresía.** El spec dice que DNX FLUX "elige agencia (sólo si tiene más de una)": una sola vinculación tiene que servir para todas. Como el acceso se re-chequea en cada pedido, dar de baja a un miembro le corta esa agencia en el acto sin revocar nada; por eso la baja no toca las llaves.
- **El dueño de la agencia no vincula DNX FLUX en esta etapa.** `/me` lista sólo membresías ACTIVE y el código se genera desde "Mis agencias" (pantalla del miembro). Si Diego quiere subir con DNX FLUX, se suma en otra etapa con la misma tarjeta en "Mi agencia".
- **El álbum lo elige DNX FLUX con `albumId`** (siempre obligatorio en `batches`): `/me` devuelve los álbumes de cada agencia del más nuevo al más viejo; con uno solo (lo normal por D4, "un álbum por temporada"), DNX FLUX lo usa sin preguntar.
- **Espera del filtro antes de procesar, no una columna nueva en `Photo`.** Agregar un estado a `Photo` obligaría a revisar ~130 archivos que filtran fotos visibles (`isRemoved`) y la limpieza; reusar `isRemoved` mezclaría con las remociones y la limpieza de 45 días. Frenar el job (`AWAITING_FILTER`) deja la foto fuera de la vista de compradores sin tocar nada de lo que se ve, y el filtro trabaja sobre el JPG original (el `rawKey` en R2). Costo: la foto esperando no se analiza ni aparece en el panel del dueño hasta que la aprueban. La rechazada cierra el job como `COMPLETED` con la nota "Descartada por el filtro" (igual que hoy las repetidas), así no aparece como error.
- **La subida web del miembro (etapa 2a) no respeta `AWAIT_FILTER`**: finaliza en el acto, sin fila. Se acepta mientras el modo esté apagado en todas las agencias; queda anotado para cuando se diseñe el filtro. El FTP sí lo respeta (cambio de una línea en el gateway).
- **Sólo la señal, no una cola para el filtro.** El spec define el estado y la señal; cómo descubre el filtro qué fotos esperan (consulta directa a `CameraIngestJob` con `status = 'AWAITING_FILTER'` o un listado firmado) se decide al diseñar el filtro.
- **Repetidas:** no se reconstruye nada. La regla de la etapa 2a (`contentSha256` o `cameraSerial` + `cameraImageNumber` + `capturedAt` en el mismo álbum) corre al procesar el job. El `sha256` opcional de la tanda sólo ahorra la subida.

---

### Task 1: Tablas, columna y valores de enum

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20261125120000_clf_agencia_flux/migration.sql`

**Interfaces:**
- Produces: `prisma.agencyLinkCode`, `prisma.agencyDeviceKey`, `prisma.agencyFluxUpload`; `CameraIngestJob.agencyDeviceKeyId Int?`; `AlbumPhotoIngestSource.FLUX`; `CameraIngestJobStatus.AWAITING_FILTER`; back-relations `User.agencyDeviceKeys`, `User.agencyLinkCodes`, `AgencyDeviceKey.uploads`.

- [ ] **Step 1: Dependencias del worktree**

Run: `cd /Users/danielcuart/Desktop/PROGRAMACIONES/wt-clf-agencia-3a && pnpm install --frozen-lockfile`
Expected: termina sin errores (el postinstall genera Prisma).

- [ ] **Step 2: Confirmar que el nombre de la migración está libre**

Run: `ls packages/db/prisma/migrations | grep -E "^2026112[5-9]"`
Expected: sin salida. Si apareciera algo con `20261125`, usar el primer día libre siguiente y cambiar el nombre en todo el plan.

- [ ] **Step 3: Schema.** Agregar al final de `schema.prisma`:

```prisma
/// Modo agencia: código corto de un solo uso para vincular DNX FLUX (sólo el SHA-256; vence a los 10 minutos).
model AgencyLinkCode {
  id          Int       @id @default(autoincrement())
  userId      Int
  codeHash    String    @unique
  expiresAt   DateTime
  usedAt      DateTime?
  /// Llave creada al canjearlo (sin clave foránea: es sólo un rastro).
  deviceKeyId Int?
  createdAt   DateTime  @default(now())
  user        User      @relation("AgencyLinkCodeUser", fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

/// Modo agencia: llave de dispositivo de DNX FLUX (`clf_dev_…`) de un fotógrafo. Sirve para todas sus agencias
/// activas; el acceso se re-chequea en cada pedido. En la base sólo vive el SHA-256 y los primeros 8 caracteres.
model AgencyDeviceKey {
  id         Int                @id @default(autoincrement())
  userId     Int
  keyHash    String             @unique
  keyPrefix  String
  label      String
  lastUsedAt DateTime?
  revokedAt  DateTime?
  createdAt  DateTime           @default(now())
  user       User               @relation("AgencyDeviceKeyUser", fields: [userId], references: [id], onDelete: Cascade)
  uploads    AgencyFluxUpload[]

  @@index([userId])
}

/// Modo agencia: un archivo que DNX FLUX pidió subir. UPLOADING (tiene URL firmada) → CONFIRMED (encolado) | REJECTED.
model AgencyFluxUpload {
  id               String          @id @default(cuid())
  deviceKeyId      Int
  userId           Int
  agencyId         Int
  albumId          Int
  rawKey           String          @unique
  originalFilename String
  sizeBytes        Int
  contentSha256    String?
  declaredLat      Float?
  declaredLng      Float?
  status           String          @default("UPLOADING")
  ingestJobId      String?
  confirmedAt      DateTime?
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt
  deviceKey        AgencyDeviceKey @relation(fields: [deviceKeyId], references: [id], onDelete: Cascade)

  @@index([deviceKeyId])
  @@index([userId, albumId, contentSha256])
  @@index([userId, albumId, originalFilename])
}
```

En `model User` (junto a `agencyMemberships`, ~línea 247) agregar:

```prisma
  agencyDeviceKeys                      AgencyDeviceKey[]                      @relation("AgencyDeviceKeyUser")
  agencyLinkCodes                       AgencyLinkCode[]                       @relation("AgencyLinkCodeUser")
```

En `model CameraIngestJob`, debajo de `agencyCredentialId Int?`:

```prisma
  /// Modo agencia: llave de DNX FLUX con la que llegó la foto.
  agencyDeviceKeyId  Int?
```

En `enum CameraIngestJobStatus` agregar `AWAITING_FILTER` (después de `FAILED`) y en `enum AlbumPhotoIngestSource` agregar `FLUX` (después de `WEB_UPLOAD`), cada uno con un comentario `/// Modo agencia: …`.

- [ ] **Step 4: Migración** `packages/db/prisma/migrations/20261125120000_clf_agencia_flux/migration.sql`:

```sql
-- Modo agencia de CompraMeLaFoto (etapa 3a): puerta de DNX FLUX.
-- Crea AgencyLinkCode, AgencyDeviceKey y AgencyFluxUpload; agrega "agencyDeviceKeyId" a "CameraIngestJob" y los
-- valores FLUX (AlbumPhotoIngestSource) y AWAITING_FILTER (CameraIngestJobStatus).
-- No toca filas existentes. Idempotente. Schema compartido: se aplica a mano ANTES del deploy.
-- "CameraIngestJob" y sus enums existen sólo en la base de producción de CLF: en las otras bases esos bloques no hacen nada.

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyLinkCode" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "deviceKeyId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyLinkCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyDeviceKey" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgencyDeviceKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AgencyFluxUpload" (
    "id" TEXT NOT NULL,
    "deviceKeyId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "albumId" INTEGER NOT NULL,
    "rawKey" TEXT NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "contentSha256" TEXT,
    "declaredLat" DOUBLE PRECISION,
    "declaredLng" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'UPLOADING',
    "ingestJobId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AgencyFluxUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyLinkCode_codeHash_key" ON "AgencyLinkCode"("codeHash");
CREATE INDEX IF NOT EXISTS "AgencyLinkCode_userId_idx" ON "AgencyLinkCode"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyDeviceKey_keyHash_key" ON "AgencyDeviceKey"("keyHash");
CREATE INDEX IF NOT EXISTS "AgencyDeviceKey_userId_idx" ON "AgencyDeviceKey"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "AgencyFluxUpload_rawKey_key" ON "AgencyFluxUpload"("rawKey");
CREATE INDEX IF NOT EXISTS "AgencyFluxUpload_deviceKeyId_idx" ON "AgencyFluxUpload"("deviceKeyId");
CREATE INDEX IF NOT EXISTS "AgencyFluxUpload_userId_albumId_contentSha256_idx" ON "AgencyFluxUpload"("userId", "albumId", "contentSha256");
CREATE INDEX IF NOT EXISTS "AgencyFluxUpload_userId_albumId_originalFilename_idx" ON "AgencyFluxUpload"("userId", "albumId", "originalFilename");

-- AddForeignKey (idempotente)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyLinkCode_userId_fkey') THEN
    ALTER TABLE "AgencyLinkCode" ADD CONSTRAINT "AgencyLinkCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyDeviceKey_userId_fkey') THEN
    ALTER TABLE "AgencyDeviceKey" ADD CONSTRAINT "AgencyDeviceKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AgencyFluxUpload_deviceKeyId_fkey') THEN
    ALTER TABLE "AgencyFluxUpload" ADD CONSTRAINT "AgencyFluxUpload_deviceKeyId_fkey" FOREIGN KEY ("deviceKeyId") REFERENCES "AgencyDeviceKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Sólo donde existe la fila de ingesta (producción de CLF).
DO $$ BEGIN
  IF to_regclass('"CameraIngestJob"') IS NOT NULL THEN
    ALTER TABLE "CameraIngestJob" ADD COLUMN IF NOT EXISTS "agencyDeviceKeyId" INTEGER;
  END IF;
END $$;

-- AlterEnum. ADD VALUE no puede usarse en la misma transacción en que se agrega: acá no se usa.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlbumPhotoIngestSource') THEN
    ALTER TYPE "AlbumPhotoIngestSource" ADD VALUE IF NOT EXISTS 'FLUX';
  END IF;
END $$;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CameraIngestJobStatus') THEN
    ALTER TYPE "CameraIngestJobStatus" ADD VALUE IF NOT EXISTS 'AWAITING_FILTER';
  END IF;
END $$;
```

- [ ] **Step 5: Validar y generar**

Run: `cd packages/db && DATABASE_URL=postgresql://x:x@localhost/x DIRECT_URL=postgresql://x:x@localhost/x pnpm exec prisma validate && pnpm exec prisma generate`
Expected: "The schema … is valid" y el cliente generado. Comparar a ojo nombres y tipos de columnas entre el schema y el SQL (en particular `AgencyFluxUpload.updatedAt` sin default en SQL, como hace Prisma con `@updatedAt`).

- [ ] **Step 6: Commit**

```bash
git add packages/db
git commit -m "Modo agencia: tablas de vínculo y subida de DNX FLUX"
```

---

### Task 2: Código de vínculo y llave de dispositivo

**Files:**
- Create: `apps/compramelafoto/lib/agencies/flux-keys.ts`
- Test: `apps/compramelafoto/lib/agencies/flux-keys.test.ts` (ya lo cubre el include `lib/agencies/**/*.test.ts`)

**Interfaces:**
- Consumes: delegados de Task 1.
- Produces:
  - `DEVICE_KEY_PREFIX = "clf_dev_"`, `LINK_CODE_TTL_MS = 600000`, `MAX_ACTIVE_DEVICE_KEYS = 10`, `MAX_DEVICE_LABEL = 60`
  - `FLUX_KEY_MESSAGES: { codeInvalid: string; tooManyDevices: string; notMember: string }`
  - `sha256Hex(text: string): string`
  - `generateLinkCode(): { code: string; display: string; hash: string }`
  - `normalizeLinkCode(input: unknown): string | null`
  - `generateDeviceKey(): { key: string; hash: string; prefix: string }`
  - `normalizeDeviceLabel(input: unknown): string`
  - `userCanLinkFlux(userId: number): Promise<boolean>`
  - `issueLinkCode(userId: number, now?: Date): Promise<{ code: string; expiresAt: Date }>` — `code` en formato `XXXX-XXXX`
  - `redeemLinkCode(rawCode: unknown, rawLabel: unknown, now?: Date): Promise<{ ok: true; key: string; deviceKeyId: number; userId: number } | { ok: false; status: 400 | 409; error: string }>`
  - `type FluxDeviceCtx = { deviceKeyId: number; userId: number; role: Role }`
  - `authenticateAgencyDevice(authorization: string | null, now?: Date): Promise<FluxDeviceCtx | null>`
  - `type FluxDeviceView = { id: number; label: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null }`
  - `listDeviceKeys(userId: number): Promise<FluxDeviceView[]>`
  - `revokeDeviceKey(userId: number, id: number): Promise<boolean>`

- [ ] **Step 1: Test** `lib/agencies/flux-keys.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const codeFindUnique = vi.fn();
const codeUpdateMany = vi.fn();
const codeUpdate = vi.fn();
const codeCreate = vi.fn();
const keyCount = vi.fn();
const keyCreate = vi.fn();
const keyFindUnique = vi.fn();
const keyFindMany = vi.fn();
const keyUpdateMany = vi.fn();
const memberCount = vi.fn();
vi.mock("@/lib/prisma", () => {
  const client = {
    agencyLinkCode: {
      findUnique: (...a: unknown[]) => codeFindUnique(...a),
      updateMany: (...a: unknown[]) => codeUpdateMany(...a),
      update: (...a: unknown[]) => codeUpdate(...a),
      create: (...a: unknown[]) => codeCreate(...a),
    },
    agencyDeviceKey: {
      count: (...a: unknown[]) => keyCount(...a),
      create: (...a: unknown[]) => keyCreate(...a),
      findUnique: (...a: unknown[]) => keyFindUnique(...a),
      findMany: (...a: unknown[]) => keyFindMany(...a),
      updateMany: (...a: unknown[]) => keyUpdateMany(...a),
    },
    agencyMember: { count: (...a: unknown[]) => memberCount(...a) },
  };
  return {
    prisma: {
      ...client,
      $transaction: (arg: unknown) =>
        typeof arg === "function" ? (arg as (tx: unknown) => unknown)(client) : Promise.all(arg as unknown[]),
    },
  };
});

import {
  authenticateAgencyDevice,
  generateDeviceKey,
  generateLinkCode,
  issueLinkCode,
  normalizeLinkCode,
  redeemLinkCode,
  revokeDeviceKey,
  sha256Hex,
} from "./flux-keys";

const NOW = new Date("2027-01-18T13:00:00Z");

beforeEach(() => {
  for (const f of [codeFindUnique, codeUpdateMany, codeUpdate, codeCreate, keyCount, keyCreate, keyFindUnique, keyFindMany, keyUpdateMany, memberCount]) f.mockReset();
  codeUpdateMany.mockResolvedValue({ count: 1 });
  codeCreate.mockResolvedValue({ id: 1 });
  codeUpdate.mockResolvedValue({});
  keyCount.mockResolvedValue(0);
  keyCreate.mockResolvedValue({ id: 33 });
  keyUpdateMany.mockResolvedValue({ count: 1 });
});

describe("códigos", () => {
  it("8 caracteres sin letras confusas, mostrados con guion, guardados con SHA-256", () => {
    const c = generateLinkCode();
    expect(c.code).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect(c.display).toBe(`${c.code.slice(0, 4)}-${c.code.slice(4)}`);
    expect(c.hash).toBe(sha256Hex(c.code));
  });
  it("normaliza lo que tipea el fotógrafo y rechaza lo que no puede ser un código", () => {
    expect(normalizeLinkCode(" k7qm-4pxt ")).toBe("K7QM4PXT");
    expect(normalizeLinkCode("K7QM 4PXT")).toBe("K7QM4PXT");
    expect(normalizeLinkCode("K7QM-4PX0")).toBe(null); // 0 no está en el alfabeto
    expect(normalizeLinkCode("K7QM4PX")).toBe(null);
    expect(normalizeLinkCode(12345678)).toBe(null);
  });
  it("issueLinkCode anula los códigos vigentes sin usar y guarda sólo el hash, con 10 minutos", async () => {
    const r = await issueLinkCode(20, NOW);
    expect(codeUpdateMany).toHaveBeenCalledWith({
      where: { userId: 20, usedAt: null, expiresAt: { gt: NOW } },
      data: { expiresAt: NOW },
    });
    const data = codeCreate.mock.calls[0][0].data;
    expect(data.userId).toBe(20);
    expect(data.codeHash).toBe(sha256Hex(normalizeLinkCode(r.code) as string));
    expect(data.expiresAt.toISOString()).toBe("2027-01-18T13:10:00.000Z");
    expect(r.expiresAt.toISOString()).toBe("2027-01-18T13:10:00.000Z");
    expect(JSON.stringify(codeCreate.mock.calls[0][0])).not.toContain(normalizeLinkCode(r.code) as string);
  });
});

describe("redeemLinkCode", () => {
  const valid = { id: 5, userId: 20, usedAt: null, expiresAt: new Date("2027-01-18T13:05:00Z") };

  it("canje válido: crea la llave con su hash y devuelve la llave completa una vez", async () => {
    codeFindUnique.mockResolvedValue(valid);
    const r = await redeemLinkCode("K7QM-4PXT", "  Notebook   de Juan ", NOW);
    expect(codeFindUnique.mock.calls[0][0].where).toEqual({ codeHash: sha256Hex("K7QM4PXT") });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.key).toMatch(/^clf_dev_[A-Za-z0-9_-]{43}$/);
    const data = keyCreate.mock.calls[0][0].data;
    expect(data).toEqual({ userId: 20, keyHash: sha256Hex(r.key), keyPrefix: r.key.slice(8, 16), label: "Notebook de Juan" });
    expect(codeUpdateMany).toHaveBeenCalledWith({ where: { id: 5, usedAt: null }, data: { usedAt: NOW } });
    expect(codeUpdate).toHaveBeenCalledWith({ where: { id: 5 }, data: { deviceKeyId: 33 } });
    expect(r).toMatchObject({ deviceKeyId: 33, userId: 20 });
  });
  it("sin nombre de computadora usa 'Computadora'", async () => {
    codeFindUnique.mockResolvedValue(valid);
    await redeemLinkCode("K7QM4PXT", undefined, NOW);
    expect(keyCreate.mock.calls[0][0].data.label).toBe("Computadora");
  });
  it("vencido, usado, inexistente o mal formado: 400 sin crear llave", async () => {
    codeFindUnique.mockResolvedValue({ ...valid, expiresAt: new Date("2027-01-18T12:59:59Z") });
    expect(await redeemLinkCode("K7QM4PXT", "x", NOW)).toMatchObject({ ok: false, status: 400 });
    codeFindUnique.mockResolvedValue({ ...valid, usedAt: new Date() });
    expect(await redeemLinkCode("K7QM4PXT", "x", NOW)).toMatchObject({ ok: false, status: 400 });
    codeFindUnique.mockResolvedValue(null);
    expect(await redeemLinkCode("K7QM4PXT", "x", NOW)).toMatchObject({ ok: false, status: 400 });
    expect(await redeemLinkCode("hola", "x", NOW)).toMatchObject({ ok: false, status: 400 });
    expect(keyCreate).not.toHaveBeenCalled();
  });
  it("dos canjes a la vez: el que pierde la marca de usado no crea llave", async () => {
    codeFindUnique.mockResolvedValue(valid);
    codeUpdateMany.mockResolvedValue({ count: 0 });
    expect(await redeemLinkCode("K7QM4PXT", "x", NOW)).toMatchObject({ ok: false, status: 400 });
    expect(keyCreate).not.toHaveBeenCalled();
  });
  it("con 10 computadoras vinculadas: 409 y el código NO se gasta", async () => {
    codeFindUnique.mockResolvedValue(valid);
    keyCount.mockResolvedValue(10);
    expect(await redeemLinkCode("K7QM4PXT", "x", NOW)).toMatchObject({ ok: false, status: 409 });
    expect(codeUpdateMany).not.toHaveBeenCalled();
    expect(keyCreate).not.toHaveBeenCalled();
  });
});

describe("authenticateAgencyDevice", () => {
  const key = generateDeviceKey().key;
  it("sin encabezado, con otro formato o revocada: null", async () => {
    expect(await authenticateAgencyDevice(null)).toBe(null);
    expect(await authenticateAgencyDevice("Bearer fo_dev_abc")).toBe(null);
    keyFindUnique.mockResolvedValue({ id: 33, userId: 20, revokedAt: new Date(), user: { role: "PHOTOGRAPHER" } });
    expect(await authenticateAgencyDevice(`Bearer ${key}`)).toBe(null);
  });
  it("vigente: busca por hash y devuelve el usuario", async () => {
    keyFindUnique.mockResolvedValue({ id: 33, userId: 20, revokedAt: null, user: { role: "PHOTOGRAPHER" } });
    expect(await authenticateAgencyDevice(`Bearer ${key}`, NOW)).toEqual({ deviceKeyId: 33, userId: 20, role: "PHOTOGRAPHER" });
    expect(keyFindUnique.mock.calls[0][0].where).toEqual({ keyHash: sha256Hex(key) });
  });
});

describe("revokeDeviceKey", () => {
  it("sólo revoca una llave propia y vigente", async () => {
    expect(await revokeDeviceKey(20, 33)).toBe(true);
    expect(keyUpdateMany.mock.calls[0][0].where).toEqual({ id: 33, userId: 20, revokedAt: null });
    keyUpdateMany.mockResolvedValue({ count: 0 });
    expect(await revokeDeviceKey(20, 99)).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver que falla**

Run (desde `apps/compramelafoto`): `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/flux-keys.test.ts`
Expected: FAIL ("Failed to resolve import ./flux-keys").

- [ ] **Step 3: Implementación** `lib/agencies/flux-keys.ts`:

```ts
import { createHash, randomBytes, randomInt } from "node:crypto";
import { prisma, type Role } from "@/lib/prisma";

/**
 * DNX FLUX en CLF (modo agencia, etapa 3a): el fotógrafo genera un código corto en "Mis agencias" y DNX FLUX lo
 * canjea por una llave de dispositivo `clf_dev_…`. Del código y de la llave sólo se guarda el SHA-256; la llave
 * completa se devuelve una sola vez. La llave es del usuario: el acceso a cada agencia se chequea en cada pedido.
 */

export const DEVICE_KEY_PREFIX = "clf_dev_";
const DEVICE_KEY_FORMAT = /^clf_dev_[A-Za-z0-9_-]{43}$/;
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const MAX_ACTIVE_DEVICE_KEYS = 10;
export const MAX_DEVICE_LABEL = 60;
/** Sin 0/O ni 1/I para que no se confundan al tipear. */
const LINK_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const LINK_CODE_LENGTH = 8;
/** El último uso se actualiza como mucho cada 5 minutos. */
const LAST_USED_EVERY_MS = 5 * 60 * 1000;

export const FLUX_KEY_MESSAGES = {
  codeInvalid: "El código no es válido o ya venció. Generá uno nuevo en ComprameLaFoto (Agencias → Mis agencias).",
  tooManyDevices: `Ya tenés ${MAX_ACTIVE_DEVICE_KEYS} computadoras vinculadas. Desvinculá alguna en Agencias → Mis agencias.`,
  notMember: "Para vincular DNX FLUX tenés que ser parte del equipo de una agencia.",
} as const;

export function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function generateLinkCode(): { code: string; display: string; hash: string } {
  let code = "";
  for (let i = 0; i < LINK_CODE_LENGTH; i += 1) code += LINK_CODE_ALPHABET[randomInt(LINK_CODE_ALPHABET.length)];
  return { code, display: `${code.slice(0, 4)}-${code.slice(4)}`, hash: sha256Hex(code) };
}

/** "k7qm-4pxt" → "K7QM4PXT"; null si no puede ser un código. */
export function normalizeLinkCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const c = input.toUpperCase().replace(/[\s-]/g, "");
  if (c.length !== LINK_CODE_LENGTH) return null;
  for (const ch of c) if (!LINK_CODE_ALPHABET.includes(ch)) return null;
  return c;
}

export function generateDeviceKey(): { key: string; hash: string; prefix: string } {
  const secret = randomBytes(32).toString("base64url");
  const key = `${DEVICE_KEY_PREFIX}${secret}`;
  return { key, hash: sha256Hex(key), prefix: secret.slice(0, 8) };
}

export function normalizeDeviceLabel(input: unknown): string {
  const t = typeof input === "string" ? input.replace(/\s+/g, " ").trim().slice(0, MAX_DEVICE_LABEL) : "";
  return t || "Computadora";
}

export async function userCanLinkFlux(userId: number): Promise<boolean> {
  return (await prisma.agencyMember.count({ where: { userId, status: "ACTIVE" } })) > 0;
}

export async function issueLinkCode(userId: number, now: Date = new Date()): Promise<{ code: string; expiresAt: Date }> {
  const c = generateLinkCode();
  const expiresAt = new Date(now.getTime() + LINK_CODE_TTL_MS);
  await prisma.$transaction([
    prisma.agencyLinkCode.updateMany({ where: { userId, usedAt: null, expiresAt: { gt: now } }, data: { expiresAt: now } }),
    prisma.agencyLinkCode.create({ data: { userId, codeHash: c.hash, expiresAt } }),
  ]);
  return { code: c.display, expiresAt };
}

export async function redeemLinkCode(
  rawCode: unknown,
  rawLabel: unknown,
  now: Date = new Date()
): Promise<{ ok: true; key: string; deviceKeyId: number; userId: number } | { ok: false; status: 400 | 409; error: string }> {
  const code = normalizeLinkCode(rawCode);
  if (!code) return { ok: false, status: 400, error: FLUX_KEY_MESSAGES.codeInvalid };
  const label = normalizeDeviceLabel(rawLabel);
  return prisma.$transaction(async (tx) => {
    const row = await tx.agencyLinkCode.findUnique({
      where: { codeHash: sha256Hex(code) },
      select: { id: true, userId: true, usedAt: true, expiresAt: true },
    });
    if (!row || row.usedAt || row.expiresAt.getTime() <= now.getTime()) {
      return { ok: false as const, status: 400 as const, error: FLUX_KEY_MESSAGES.codeInvalid };
    }
    // El tope se mira antes de gastar el código: si está lleno, puede desvincular una y reusar el mismo código.
    const active = await tx.agencyDeviceKey.count({ where: { userId: row.userId, revokedAt: null } });
    if (active >= MAX_ACTIVE_DEVICE_KEYS) {
      return { ok: false as const, status: 409 as const, error: FLUX_KEY_MESSAGES.tooManyDevices };
    }
    // Marca de usado con condición: si llegan dos canjes juntos, gana uno solo.
    const claimed = await tx.agencyLinkCode.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) return { ok: false as const, status: 400 as const, error: FLUX_KEY_MESSAGES.codeInvalid };
    const k = generateDeviceKey();
    const device = await tx.agencyDeviceKey.create({
      data: { userId: row.userId, keyHash: k.hash, keyPrefix: k.prefix, label },
      select: { id: true },
    });
    await tx.agencyLinkCode.update({ where: { id: row.id }, data: { deviceKeyId: device.id } });
    return { ok: true as const, key: k.key, deviceKeyId: device.id, userId: row.userId };
  });
}

export type FluxDeviceCtx = { deviceKeyId: number; userId: number; role: Role };

/** `Authorization: Bearer clf_dev_…` → llave vigente, o null (sin decir por qué). */
export async function authenticateAgencyDevice(authorization: string | null, now: Date = new Date()): Promise<FluxDeviceCtx | null> {
  if (!authorization) return null;
  const m = /^Bearer\s+(\S+)$/i.exec(authorization.trim());
  if (!m || !DEVICE_KEY_FORMAT.test(m[1])) return null;
  const row = await prisma.agencyDeviceKey.findUnique({
    where: { keyHash: sha256Hex(m[1]) },
    select: { id: true, userId: true, revokedAt: true, user: { select: { role: true } } },
  });
  if (!row || row.revokedAt) return null;
  void prisma.agencyDeviceKey
    .updateMany({
      where: { id: row.id, revokedAt: null, OR: [{ lastUsedAt: null }, { lastUsedAt: { lt: new Date(now.getTime() - LAST_USED_EVERY_MS) } }] },
      data: { lastUsedAt: now },
    })
    .catch(() => undefined);
  return { deviceKeyId: row.id, userId: row.userId, role: row.user.role };
}

export type FluxDeviceView = { id: number; label: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null };

export async function listDeviceKeys(userId: number): Promise<FluxDeviceView[]> {
  const rows = await prisma.agencyDeviceKey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { id: true, label: true, keyPrefix: true, createdAt: true, lastUsedAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    keyPrefix: r.keyPrefix,
    createdAt: r.createdAt.toISOString(),
    lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
  }));
}

export async function revokeDeviceKey(userId: number, id: number): Promise<boolean> {
  const r = await prisma.agencyDeviceKey.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  return r.count === 1;
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/flux-keys.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies/flux-keys.ts apps/compramelafoto/lib/agencies/flux-keys.test.ts
git commit -m "Modo agencia: código de vínculo y llave de dispositivo de DNX FLUX"
```

---

### Task 3: El fotógrafo genera el código y ve o desvincula sus computadoras

**Files:**
- Create: `apps/compramelafoto/app/api/fotografo/agencias/flux/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/flux/[deviceId]/route.ts`
- Test: `apps/compramelafoto/app/api/fotografo/agencias/flux/flux-devices.test.ts` (lo cubre el include `app/api/fotografo/agencias/**/*.test.ts`)

**Interfaces:**
- Consumes: `userCanLinkFlux`, `issueLinkCode`, `listDeviceKeys`, `revokeDeviceKey`, `FLUX_KEY_MESSAGES` (Task 2); `requireAuth` (`@/lib/auth`).
- Produces:
  - `GET /api/fotografo/agencias/flux` → `200 { devices: FluxDeviceView[] }`
  - `POST /api/fotografo/agencias/flux` → `200 { code: "XXXX-XXXX", expiresAt: string }` | `403 { error }` si no es miembro ACTIVE de ninguna agencia
  - `DELETE /api/fotografo/agencias/flux/{deviceId}` → `200 { ok: true }` | `404 { error }` | `400 { error }`
  - Sin sesión: `401` en los tres.

- [ ] **Step 1: Test** `app/api/fotografo/agencias/flux/flux-devices.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const canLink = vi.fn();
const issue = vi.fn();
const list = vi.fn();
const revoke = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({ Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" } }));
vi.mock("@/lib/agencies/flux-keys", () => ({
  FLUX_KEY_MESSAGES: { notMember: "Para vincular DNX FLUX tenés que ser parte del equipo de una agencia." },
  userCanLinkFlux: (...a: unknown[]) => canLink(...a),
  issueLinkCode: (...a: unknown[]) => issue(...a),
  listDeviceKeys: (...a: unknown[]) => list(...a),
  revokeDeviceKey: (...a: unknown[]) => revoke(...a),
}));

import { GET, POST } from "./route";
import { DELETE } from "./[deviceId]/route";

const ctx = (deviceId: string) => ({ params: Promise.resolve({ deviceId }) });

beforeEach(() => {
  for (const f of [requireAuth, canLink, issue, list, revoke]) f.mockReset();
  requireAuth.mockResolvedValue({ error: null, user: { id: 20 } });
});

describe("dispositivos de DNX FLUX del fotógrafo", () => {
  it("sin sesión: 401 en todo", async () => {
    requireAuth.mockResolvedValue({ error: "No autenticado", user: null });
    expect((await GET()).status).toBe(401);
    expect((await POST()).status).toBe(401);
    expect((await DELETE({} as any, ctx("3"))).status).toBe(401);
  });
  it("GET lista sólo las del usuario", async () => {
    list.mockResolvedValue([{ id: 3, label: "Notebook", keyPrefix: "abcdefgh", createdAt: "2027-01-18T13:00:00.000Z", lastUsedAt: null }]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).devices).toHaveLength(1);
    expect(list).toHaveBeenCalledWith(20);
  });
  it("POST sin agencia activa: 403 y no genera código", async () => {
    canLink.mockResolvedValue(false);
    const res = await POST();
    expect(res.status).toBe(403);
    expect(issue).not.toHaveBeenCalled();
  });
  it("POST con agencia activa: devuelve el código y su vencimiento", async () => {
    canLink.mockResolvedValue(true);
    issue.mockResolvedValue({ code: "K7QM-4PXT", expiresAt: new Date("2027-01-18T13:10:00Z") });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ code: "K7QM-4PXT", expiresAt: "2027-01-18T13:10:00.000Z" });
    expect(issue).toHaveBeenCalledWith(20);
  });
  it("DELETE: id inválido 400, ajeno o ya desvinculado 404, propio 200", async () => {
    expect((await DELETE({} as any, ctx("abc"))).status).toBe(400);
    revoke.mockResolvedValue(false);
    expect((await DELETE({} as any, ctx("9"))).status).toBe(404);
    revoke.mockResolvedValue(true);
    const res = await DELETE({} as any, ctx("3"));
    expect(res.status).toBe(200);
    expect(revoke).toHaveBeenLastCalledWith(20, 3);
  });
});
```

- [ ] **Step 2:** Correr `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias/flux` → FAIL (no existen las rutas).

- [ ] **Step 3: Implementación.**

`app/api/fotografo/agencias/flux/route.ts`:

```ts
import { NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { FLUX_KEY_MESSAGES, issueLinkCode, listDeviceKeys, userCanLinkFlux } from "@/lib/agencies/flux-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function auth() {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return { res: NextResponse.json({ error: error || "No autorizado" }, { status: 401 }) };
  return { user };
}

/** Computadoras vinculadas con DNX FLUX (sirven para todas las agencias del fotógrafo). */
export async function GET() {
  const a = await auth();
  if ("res" in a) return a.res;
  return NextResponse.json({ devices: await listDeviceKeys(a.user.id) });
}

/** Código corto para vincular una computadora nueva (vence a los 10 minutos). */
export async function POST() {
  const a = await auth();
  if ("res" in a) return a.res;
  if (!(await userCanLinkFlux(a.user.id))) return NextResponse.json({ error: FLUX_KEY_MESSAGES.notMember }, { status: 403 });
  const r = await issueLinkCode(a.user.id);
  return NextResponse.json({ code: r.code, expiresAt: r.expiresAt.toISOString() });
}
```

`app/api/fotografo/agencias/flux/[deviceId]/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { revokeDeviceKey } from "@/lib/agencies/flux-keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Desvincula una computadora: su llave deja de servir en el acto. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ deviceId: string }> }) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const id = Number((await params).deviceId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Computadora inválida." }, { status: 400 });
  if (!(await revokeDeviceKey(user.id, id))) {
    return NextResponse.json({ error: "No encontramos esa computadora (quizás ya estaba desvinculada)." }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4:** Correr el mismo comando → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/app/api/fotografo/agencias/flux
git commit -m "Modo agencia: el fotógrafo genera el código de DNX FLUX y desvincula computadoras"
```

---

### Task 4: Puerta de DNX FLUX — canje del código y "mis agencias"

**Files:**
- Create: `apps/compramelafoto/lib/agencies/flux-http.ts`
- Create: `apps/compramelafoto/lib/agencies/upload-target.ts`, `apps/compramelafoto/lib/agencies/upload-target.test.ts`
- Modify: `apps/compramelafoto/lib/agencies/ftp-login.ts` (su `checkAccess` pasa a usar `checkAgencyUploadTarget`)
- Create: `apps/compramelafoto/app/api/agency-ingest/v1/link/route.ts`, `apps/compramelafoto/app/api/agency-ingest/v1/me/route.ts`
- Test: `apps/compramelafoto/app/api/agency-ingest/v1/link-me.test.ts`
- Modify: `apps/compramelafoto/vitest.bot.config.ts` (agregar `"app/api/agency-ingest/**/*.test.ts"`)

**Interfaces:**
- Consumes: `authenticateAgencyDevice`, `redeemLinkCode`, `FluxDeviceCtx` (Task 2); `memberCanUpload`, `memberNeedsTerms` (`@/lib/agencies/rules`); `ensureMpConnected` (`@/app/api/dashboard/albums/[id]/photos/upload-helpers`); `checkRateLimit` (`@/lib/rate-limit`); `validateActiveAlbumForCameraConnection` (`@/lib/camera-connection/camera-connection-service`); `findAgencyAlbumGate` (`@/lib/agencies/queries`).
- Produces:
  - `flux-http.ts`: `FLUX_REQUESTS_PER_MINUTE = 120`, `FLUX_LINKS_PER_MINUTE_PER_IP = 10`, `FLUX_MESSAGES: { badKey; slowDown; data; error }`, `fluxJson(body: unknown, status?: number, headers?: Record<string,string>): NextResponse` (siempre `Cache-Control: no-store`), `fluxError(error: string, status: number, headers?): NextResponse`, `authorizeFluxRequest(request: Request): Promise<{ ctx: FluxDeviceCtx } | { res: NextResponse }>` (401 con `WWW-Authenticate: Bearer`; 429 con `Retry-After`), `readJsonObject(request: Request): Promise<Record<string, unknown> | null>`, `clientIp(request: Request): string`.
  - `upload-target.ts`: `AGENCY_TARGET_DENIED: string`, `checkAgencyUploadTarget(agencyId: number, albumId: number, userId: number, deniedMessage?: string): Promise<{ ok: true } | { ok: false; message: string }>`.
  - `POST /api/agency-ingest/v1/link` body `{ code, deviceName? }` → `201 { deviceKey }` | `400`/`409 { error }` | `429`.
  - `GET /api/agency-ingest/v1/me` → `200 { user: { name: string | null }, mpConnected: boolean, agencies: Array<{ agencyId: number; name: string; logoUrl: string | null; canUpload: boolean; needsTerms: boolean; albums: Array<{ albumId: number; title: string }>; places: Array<{ id: number; name: string; lat: number; lng: number }> }> }` | `401`.

- [ ] **Step 1: Tests.**

`lib/agencies/upload-target.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const validateAlbum = vi.fn();
const findGate = vi.fn();
vi.mock("@/lib/camera-connection/camera-connection-service", () => ({
  validateActiveAlbumForCameraConnection: (...a: unknown[]) => validateAlbum(...a),
}));
vi.mock("@/lib/agencies/queries", () => ({ findAgencyAlbumGate: (...a: unknown[]) => findGate(...a) }));

import { AGENCY_TARGET_DENIED, checkAgencyUploadTarget } from "./upload-target";

beforeEach(() => {
  validateAlbum.mockReset();
  findGate.mockReset();
  validateAlbum.mockResolvedValue({ ok: true, album: { id: 50 } });
  findGate.mockResolvedValue({ agencyId: 3, ownerUserId: 9, termsVersion: 1 });
});

describe("checkAgencyUploadTarget", () => {
  it("álbum de esa agencia y miembro al día: ok", async () => {
    expect(await checkAgencyUploadTarget(3, 50, 20)).toEqual({ ok: true });
    expect(validateAlbum).toHaveBeenCalledWith(20, 50);
  });
  it("el álbum no deja subir (baja, condiciones, borrado): devuelve ese motivo", async () => {
    validateAlbum.mockResolvedValue({ ok: false, error: "La agencia cambió sus condiciones…", status: 403 });
    expect(await checkAgencyUploadTarget(3, 50, 20)).toEqual({ ok: false, message: "La agencia cambió sus condiciones…" });
  });
  it("álbum de otra agencia o que ya no es de agencia: no", async () => {
    findGate.mockResolvedValue({ agencyId: 4, ownerUserId: 9, termsVersion: 1 });
    expect(await checkAgencyUploadTarget(3, 50, 20)).toEqual({ ok: false, message: AGENCY_TARGET_DENIED });
    findGate.mockResolvedValue(null);
    expect(await checkAgencyUploadTarget(3, 50, 20, "otro")).toEqual({ ok: false, message: "otro" });
  });
});
```

`app/api/agency-ingest/v1/link-me.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticate = vi.fn();
const redeem = vi.fn();
const userFindUnique = vi.fn();
const memberFindMany = vi.fn();
const ensureMp = vi.fn();
vi.mock("@/lib/agencies/flux-keys", () => ({
  authenticateAgencyDevice: (...a: unknown[]) => authenticate(...a),
  redeemLinkCode: (...a: unknown[]) => redeem(...a),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    agencyMember: { findMany: (...a: unknown[]) => memberFindMany(...a) },
  },
}));
vi.mock("@/app/api/dashboard/albums/[id]/photos/upload-helpers", () => ({ ensureMpConnected: (...a: unknown[]) => ensureMp(...a) }));

import { POST as LINK } from "./link/route";
import { GET as ME } from "./me/route";

let ipCounter = 0;
const linkReq = (body: unknown, ip = `10.0.0.${++ipCounter}`) =>
  new Request("https://x/api/agency-ingest/v1/link", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
const meReq = (auth?: string) => new Request("https://x/api/agency-ingest/v1/me", { headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  for (const f of [authenticate, redeem, userFindUnique, memberFindMany, ensureMp]) f.mockReset();
  ensureMp.mockResolvedValue({ ok: true, error: null });
});

describe("POST link", () => {
  it("cuerpo que no es JSON: 400", async () => {
    expect((await LINK(linkReq("no-json"))).status).toBe(400);
  });
  it("canje válido: 201 con la llave y sin caché", async () => {
    redeem.mockResolvedValue({ ok: true, key: "clf_dev_x", deviceKeyId: 3, userId: 20 });
    const res = await LINK(linkReq({ code: "K7QM-4PXT", deviceName: "Notebook" }));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ deviceKey: "clf_dev_x" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(redeem).toHaveBeenCalledWith("K7QM-4PXT", "Notebook");
  });
  it("código inválido o tope de computadoras: pasa el estado y el mensaje", async () => {
    redeem.mockResolvedValue({ ok: false, status: 409, error: "Ya tenés 10 computadoras" });
    const res = await LINK(linkReq({ code: "K7QM-4PXT" }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("Ya tenés 10 computadoras");
  });
  it("el pedido 11 del mismo minuto desde la misma IP: 429", async () => {
    redeem.mockResolvedValue({ ok: false, status: 400, error: "x" });
    for (let i = 0; i < 10; i += 1) expect((await LINK(linkReq({ code: "AAAAAAAA" }, "10.9.9.9"))).status).toBe(400);
    const res = await LINK(linkReq({ code: "AAAAAAAA" }, "10.9.9.9"));
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBeTruthy();
  });
});

describe("GET me", () => {
  it("sin llave o llave inválida: 401 con WWW-Authenticate", async () => {
    authenticate.mockResolvedValue(null);
    const res = await ME(meReq());
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
  });
  it("devuelve sólo agencias activas con álbumes y lugares, sin datos de clientes", async () => {
    authenticate.mockResolvedValue({ deviceKeyId: 3, userId: 20, role: "PHOTOGRAPHER" });
    userFindUnique.mockResolvedValue({ name: "Juan" });
    memberFindMany.mockResolvedValue([
      {
        status: "ACTIVE",
        termsVersionAccepted: 1,
        agency: {
          id: 3, name: "Fotoshow", logoUrl: null, termsVersion: 1,
          albums: [{ albumId: 50, album: { title: "Temporada 2027" } }],
          places: [{ id: 1, name: "Playa Grande", lat: -38.02, lng: -57.53 }],
        },
      },
      {
        status: "ACTIVE",
        termsVersionAccepted: 1,
        agency: { id: 4, name: "Otra", logoUrl: null, termsVersion: 2, albums: [], places: [] },
      },
    ]);
    const res = await ME(meReq("Bearer clf_dev_x"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { name: "Juan" },
      mpConnected: true,
      agencies: [
        {
          agencyId: 3, name: "Fotoshow", logoUrl: null, canUpload: true, needsTerms: false,
          albums: [{ albumId: 50, title: "Temporada 2027" }],
          places: [{ id: 1, name: "Playa Grande", lat: -38.02, lng: -57.53 }],
        },
        { agencyId: 4, name: "Otra", logoUrl: null, canUpload: false, needsTerms: true, albums: [], places: [] },
      ],
    });
    expect(memberFindMany.mock.calls[0][0].where).toEqual({ userId: 20, status: "ACTIVE" });
    expect(ensureMp).toHaveBeenCalledWith({ id: 20, role: "PHOTOGRAPHER" });
  });
});
```

Agregar `"app/api/agency-ingest/**/*.test.ts",` al `include` de `vitest.bot.config.ts` (junto a `"app/api/fotografo/agencias/**/*.test.ts"`).

- [ ] **Step 2:** Correr `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/upload-target.test.ts app/api/agency-ingest` → FAIL (módulos inexistentes).

- [ ] **Step 3: Implementación.**

`lib/agencies/upload-target.ts`:

```ts
import { validateActiveAlbumForCameraConnection } from "@/lib/camera-connection/camera-connection-service";
import { findAgencyAlbumGate } from "@/lib/agencies/queries";

export const AGENCY_TARGET_DENIED = "Ya no podés subir a ese álbum de la agencia.";

/**
 * ¿Este usuario puede subir AHORA a este álbum, y el álbum es de ESTA agencia? Lo usan el FTP (etapa 2b) y
 * DNX FLUX (etapa 3a) en cada pedido: miembro ACTIVE con condiciones al día, álbum sin borrar.
 */
export async function checkAgencyUploadTarget(
  agencyId: number,
  albumId: number,
  userId: number,
  deniedMessage: string = AGENCY_TARGET_DENIED
): Promise<{ ok: true } | { ok: false; message: string }> {
  const album = await validateActiveAlbumForCameraConnection(userId, albumId);
  if (!album.ok) return { ok: false, message: album.error || deniedMessage };
  const gate = await findAgencyAlbumGate(albumId);
  if (!gate || gate.agencyId !== agencyId) return { ok: false, message: deniedMessage };
  return { ok: true };
}
```

En `lib/agencies/ftp-login.ts`: borrar el cuerpo de `checkAccess` y el import de `findAgencyAlbumGate`/`validateActiveAlbumForCameraConnection` que queden sin uso (dejar `verifyFtpPassword`), y escribir:

```ts
import { checkAgencyUploadTarget } from "@/lib/agencies/upload-target";

/** El álbum existe, es de ESTA agencia y el miembro puede subirle fotos ahora. */
function checkAccess(agencyId: number, albumId: number, userId: number) {
  return checkAgencyUploadTarget(agencyId, albumId, userId, NO_ACCESS);
}
```

Correr `lib/agencies/ftp-login.test.ts`: tiene que seguir en verde sin tocarlo (mockea los mismos módulos que usa `upload-target`).

`lib/agencies/flux-http.ts`:

```ts
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { authenticateAgencyDevice, type FluxDeviceCtx } from "@/lib/agencies/flux-keys";

/** Piezas comunes de la API de DNX FLUX en CLF (`/api/agency-ingest/v1/*`). Nunca se loguean datos personales. */

export const FLUX_REQUESTS_PER_MINUTE = 120;
export const FLUX_LINKS_PER_MINUTE_PER_IP = 10;
const MINUTE_MS = 60_000;

export const FLUX_MESSAGES = {
  badKey: "Llave inválida o desvinculada. Volvé a vincular DNX FLUX desde Agencias → Mis agencias.",
  slowDown: "Demasiados pedidos seguidos. Esperá un momento y reintentá.",
  data: "Los datos no son válidos.",
  error: "No pudimos completar el pedido. Reintentá en un momento.",
} as const;

const NO_STORE = { "Cache-Control": "no-store" } as const;

export function fluxJson(body: unknown, status = 200, headers: Record<string, string> = {}): NextResponse {
  return NextResponse.json(body, { status, headers: { ...NO_STORE, ...headers } });
}

export function fluxError(error: string, status: number, headers: Record<string, string> = {}): NextResponse {
  return fluxJson({ error }, status, headers);
}

function retryAfter(resetAt: number): Record<string, string> {
  return { "Retry-After": String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))) };
}

export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
}

export function linkRateLimit(request: Request): NextResponse | null {
  const r = checkRateLimit({ key: `flux-link:${clientIp(request)}`, limit: FLUX_LINKS_PER_MINUTE_PER_IP, windowMs: MINUTE_MS });
  return r.allowed ? null : fluxError(FLUX_MESSAGES.slowDown, 429, retryAfter(r.resetAt));
}

/** Llave → contexto (401) y freno por llave (429). */
export async function authorizeFluxRequest(request: Request): Promise<{ ctx: FluxDeviceCtx } | { res: NextResponse }> {
  const ctx = await authenticateAgencyDevice(request.headers.get("authorization"));
  if (!ctx) return { res: fluxError(FLUX_MESSAGES.badKey, 401, { "WWW-Authenticate": "Bearer" }) };
  const r = checkRateLimit({ key: `flux:${ctx.deviceKeyId}`, limit: FLUX_REQUESTS_PER_MINUTE, windowMs: MINUTE_MS });
  if (!r.allowed) return { res: fluxError(FLUX_MESSAGES.slowDown, 429, retryAfter(r.resetAt)) };
  return { ctx };
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const v: unknown = await request.json();
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
```

Agregar `linkRateLimit` a la lista de **Produces** de esta tarea (lo usa sólo `link`).

`app/api/agency-ingest/v1/link/route.ts`:

```ts
import { redeemLinkCode } from "@/lib/agencies/flux-keys";
import { FLUX_MESSAGES, fluxError, fluxJson, linkRateLimit, readJsonObject } from "@/lib/agencies/flux-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DNX FLUX canjea el código de "Mis agencias" por su llave de dispositivo (se devuelve una sola vez). */
export async function POST(request: Request) {
  const limited = linkRateLimit(request);
  if (limited) return limited;
  const body = await readJsonObject(request);
  if (!body) return fluxError(FLUX_MESSAGES.data, 400);
  try {
    const r = await redeemLinkCode(body.code, body.deviceName);
    if (!r.ok) return fluxError(r.error, r.status);
    return fluxJson({ deviceKey: r.key }, 201);
  } catch {
    return fluxError(FLUX_MESSAGES.error, 503);
  }
}
```

`app/api/agency-ingest/v1/me/route.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { memberCanUpload, memberNeedsTerms } from "@/lib/agencies/rules";
import { ensureMpConnected } from "@/app/api/dashboard/albums/[id]/photos/upload-helpers";
import { FLUX_MESSAGES, authorizeFluxRequest, fluxError, fluxJson } from "@/lib/agencies/flux-http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DNX FLUX: agencias activas del fotógrafo con sus álbumes (el más nuevo primero) y lugares. Sin datos de clientes. */
export async function GET(request: Request) {
  const a = await authorizeFluxRequest(request);
  if ("res" in a) return a.res;
  try {
    const [user, memberships, mp] = await Promise.all([
      prisma.user.findUnique({ where: { id: a.ctx.userId }, select: { name: true } }),
      prisma.agencyMember.findMany({
        where: { userId: a.ctx.userId, status: "ACTIVE" },
        orderBy: { createdAt: "asc" },
        select: {
          status: true,
          termsVersionAccepted: true,
          agency: {
            select: {
              id: true, name: true, logoUrl: true, termsVersion: true,
              albums: {
                where: { album: { deletedAt: null } },
                orderBy: { createdAt: "desc" },
                select: { albumId: true, album: { select: { title: true } } },
              },
              places: { orderBy: { name: "asc" }, select: { id: true, name: true, lat: true, lng: true } },
            },
          },
        },
      }),
      ensureMpConnected({ id: a.ctx.userId, role: a.ctx.role }),
    ]);
    return fluxJson({
      user: { name: user?.name ?? null },
      mpConnected: mp.ok,
      agencies: memberships.map((m) => ({
        agencyId: m.agency.id,
        name: m.agency.name,
        logoUrl: m.agency.logoUrl,
        canUpload: memberCanUpload(m, m.agency),
        needsTerms: memberNeedsTerms(m, m.agency),
        albums: m.agency.albums.map((al) => ({ albumId: al.albumId, title: al.album.title })),
        places: m.agency.places,
      })),
    });
  } catch {
    return fluxError(FLUX_MESSAGES.error, 503);
  }
}
```

- [ ] **Step 4:** Correr `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies app/api/agency-ingest` → PASS (incluye `ftp-login.test.ts` sin cambios).

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies apps/compramelafoto/app/api/agency-ingest apps/compramelafoto/vitest.bot.config.ts
git commit -m "Modo agencia: DNX FLUX canjea el código y lee sus agencias"
```

---

### Task 5: Encolado con origen FLUX y modo de publicación

**Files:**
- Modify: `apps/compramelafoto/lib/albums/enqueue-album-photo-ingest.ts`
- Create: `apps/compramelafoto/lib/albums/enqueue-album-photo-ingest.test.ts`
- Create: `apps/compramelafoto/lib/agencies/publish-mode.ts`, `apps/compramelafoto/lib/agencies/publish-mode.test.ts`
- Modify: `apps/compramelafoto/vitest.bot.config.ts` (agregar `"lib/albums/enqueue-album-photo-ingest.test.ts"`)

**Interfaces:**
- Produces:
  - `EnqueueAlbumPhotoIngestInput` gana (todos opcionales; ausentes = exactamente como hoy): `source?: "WEB_UPLOAD" | "FLUX"`, `declaredPoint?: { lat: number; lng: number } | null`, `agencyDeviceKeyId?: number | null`, `awaitFilter?: boolean`.
  - `AGENCY_PUBLISH_MODES = ["IMMEDIATE", "AWAIT_FILTER"] as const`, `awaitsFilter(mode: string | null | undefined): boolean`, `agencyAwaitsFilter(agencyId: number): Promise<boolean>`.

- [ ] **Step 1: Tests.**

`lib/albums/enqueue-album-photo-ingest.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const jobFindUnique = vi.fn();
const jobCreate = vi.fn();
const getMeta = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: { cameraIngestJob: { findUnique: (...a: unknown[]) => jobFindUnique(...a), create: (...a: unknown[]) => jobCreate(...a) } },
  AlbumPhotoIngestSource: { CAMERA: "CAMERA", WEB_UPLOAD: "WEB_UPLOAD", FLUX: "FLUX" },
}));
vi.mock("@/lib/r2-client", () => ({ getR2ObjectMetadata: (...a: unknown[]) => getMeta(...a) }));

import { enqueueAlbumPhotoIngest } from "./enqueue-album-photo-ingest";

const base = { userId: 20, albumId: 50, rawKey: "albums/50/raw/abc-DSC_1.jpg", originalFilename: "DSC_1.JPG" };

beforeEach(() => {
  for (const f of [jobFindUnique, jobCreate, getMeta]) f.mockReset();
  jobFindUnique.mockResolvedValue(null);
  jobCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "j1", ...data }));
  getMeta.mockResolvedValue({ size: 2_000_000, contentType: "image/jpeg" });
});

describe("enqueueAlbumPhotoIngest", () => {
  it("sin opciones nuevas: los mismos datos que antes (subida web, PENDING)", async () => {
    await enqueueAlbumPhotoIngest(base);
    expect(jobCreate.mock.calls[0][0].data).toEqual({
      user: { connect: { id: 20 } },
      album: { connect: { id: 50 } },
      rawKey: "albums/50/raw/abc-DSC_1.jpg",
      source: "WEB_UPLOAD",
      status: "PENDING",
      originalFilename: "DSC_1.JPG",
      filesizeBytes: 2_000_000,
    });
  });
  it("DNX FLUX: origen FLUX, punto declarado y llave usada", async () => {
    await enqueueAlbumPhotoIngest({ ...base, source: "FLUX", declaredPoint: { lat: -38.02, lng: -57.53 }, agencyDeviceKeyId: 33 });
    expect(jobCreate.mock.calls[0][0].data).toMatchObject({
      source: "FLUX", status: "PENDING", declaredLat: -38.02, declaredLng: -57.53, agencyDeviceKeyId: 33,
    });
  });
  it("agencia que espera al filtro: el job nace AWAITING_FILTER", async () => {
    await enqueueAlbumPhotoIngest({ ...base, source: "FLUX", awaitFilter: true });
    expect(jobCreate.mock.calls[0][0].data.status).toBe("AWAITING_FILTER");
  });
  it("ya encolado con ese rawKey: devuelve el existente sin crear", async () => {
    jobFindUnique.mockResolvedValue({ id: "j0", status: "PENDING" });
    expect(await enqueueAlbumPhotoIngest({ ...base, source: "FLUX" })).toEqual({ job: { id: "j0", status: "PENDING" }, created: false });
    expect(jobCreate).not.toHaveBeenCalled();
  });
});
```

`lib/agencies/publish-mode.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const agencyFindUnique = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { agency: { findUnique: (...a: unknown[]) => agencyFindUnique(...a) } } }));

import { agencyAwaitsFilter, awaitsFilter } from "./publish-mode";

beforeEach(() => { agencyFindUnique.mockReset(); });

describe("modo de publicación", () => {
  it("sólo AWAIT_FILTER espera; cualquier otro valor publica en el acto", () => {
    expect(awaitsFilter("AWAIT_FILTER")).toBe(true);
    for (const v of ["IMMEDIATE", "await_filter", "", null, undefined]) expect(awaitsFilter(v)).toBe(false);
  });
  it("agencia inexistente: no espera", async () => {
    agencyFindUnique.mockResolvedValue(null);
    expect(await agencyAwaitsFilter(3)).toBe(false);
    agencyFindUnique.mockResolvedValue({ publishMode: "AWAIT_FILTER" });
    expect(await agencyAwaitsFilter(3)).toBe(true);
    expect(agencyFindUnique.mock.calls[1][0]).toEqual({ where: { id: 3 }, select: { publishMode: true } });
  });
});
```

Agregar `"lib/albums/enqueue-album-photo-ingest.test.ts",` al `include` de `vitest.bot.config.ts`.

- [ ] **Step 2:** Correr `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/albums/enqueue-album-photo-ingest.test.ts lib/agencies/publish-mode.test.ts` → FAIL (el primer test de enqueue puede pasar; los de FLUX y `publish-mode` fallan).

- [ ] **Step 3: Implementación.**

`lib/agencies/publish-mode.ts`:

```ts
import { prisma } from "@/lib/prisma";

/**
 * Modo de publicación de una agencia (spec, "Encaje con el filtrado"): IMMEDIATE publica al procesar; AWAIT_FILTER
 * deja el trabajo de ingesta en AWAITING_FILTER hasta la señal del filtro de la nube. En la etapa 3a se cambia
 * sólo por SQL (no hay selector) porque el filtro todavía no existe.
 */
export const AGENCY_PUBLISH_MODES = ["IMMEDIATE", "AWAIT_FILTER"] as const;
export type AgencyPublishMode = (typeof AGENCY_PUBLISH_MODES)[number];

export function awaitsFilter(mode: string | null | undefined): boolean {
  return mode === "AWAIT_FILTER";
}

export async function agencyAwaitsFilter(agencyId: number): Promise<boolean> {
  const a = await prisma.agency.findUnique({ where: { id: agencyId }, select: { publishMode: true } });
  return awaitsFilter(a?.publishMode);
}
```

En `lib/albums/enqueue-album-photo-ingest.ts`:
1. Agregar al tipo `EnqueueAlbumPhotoIngestInput`:

```ts
  /** Modo agencia (etapa 3a): origen de la foto; por defecto la subida web. */
  source?: "WEB_UPLOAD" | "FLUX";
  /** Punto que eligió el fotógrafo al empezar la tanda (sólo se usa si la foto no trae GPS). */
  declaredPoint?: { lat: number; lng: number } | null;
  /** Llave de DNX FLUX con la que llegó. */
  agencyDeviceKeyId?: number | null;
  /** La agencia espera al filtro de la nube: el job nace AWAITING_FILTER y el cron no lo toma. */
  awaitFilter?: boolean;
```

2. Reemplazar la construcción de `data` por:

```ts
  const data: Prisma.CameraIngestJobCreateInput = {
    user: { connect: { id: input.userId } },
    album: { connect: { id: input.albumId } },
    rawKey,
    source: input.source === "FLUX" ? AlbumPhotoIngestSource.FLUX : AlbumPhotoIngestSource.WEB_UPLOAD,
    status: input.awaitFilter ? "AWAITING_FILTER" : "PENDING",
    originalFilename: trimOrNull(input.originalFilename ?? null),
    filesizeBytes: input.filesizeBytes ?? size,
    ...(input.eventFolderId != null ? { eventFolderId: input.eventFolderId } : {}),
    ...(input.folderId != null ? { folderId: input.folderId } : {}),
    ...(input.declaredPoint ? { declaredLat: input.declaredPoint.lat, declaredLng: input.declaredPoint.lng } : {}),
    ...(input.agencyDeviceKeyId != null ? { agencyDeviceKeyId: input.agencyDeviceKeyId } : {}),
  };
```

3. Actualizar el comentario de la función: "encola job WEB_UPLOAD o FLUX (idempotente por rawKey)". Nada más cambia; los dos llamadores actuales (`proxy-upload`, `complete-light`) no pasan las opciones nuevas.

- [ ] **Step 4:** Correr el mismo comando → PASS. Después `NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck; echo exit=$?` → `exit=0` y sin líneas `error TS` (confirma que el cliente de Prisma ya conoce `FLUX`, `AWAITING_FILTER` y `agencyDeviceKeyId`).

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/albums apps/compramelafoto/lib/agencies/publish-mode.ts apps/compramelafoto/lib/agencies/publish-mode.test.ts apps/compramelafoto/vitest.bot.config.ts
git commit -m "Modo agencia: la fila de ingesta acepta fotos de DNX FLUX y la espera del filtro"
```

---

### Task 6: Pedir una tanda de subidas (`POST /api/agency-ingest/v1/batches`)

**Files:**
- Create: `apps/compramelafoto/lib/agencies/flux-uploads.ts` (validación, punto, pedido de subidas)
- Test: `apps/compramelafoto/lib/agencies/flux-uploads.test.ts`
- Create: `apps/compramelafoto/app/api/agency-ingest/v1/batches/route.ts`
- Test: `apps/compramelafoto/app/api/agency-ingest/v1/batches-confirm.test.ts` (la parte de `batches`)

**Interfaces:**
- Consumes: `FluxDeviceCtx` (Task 2); `authorizeFluxRequest`, `readJsonObject`, `fluxJson`, `fluxError`, `FLUX_MESSAGES` (Task 4); `checkAgencyUploadTarget` (Task 4); `ensureMpConnected`; `parseDeclaredPoint` (`@/lib/agencies/photo-facts`); `generateR2Key`, `getSignedPutUrl` (`@/lib/r2-client`); `getAlbumPhotoMaxBytes`, `getAlbumPhotoMaxMb` (`@/lib/albums/album-photo-upload-limits`).
- Produces (en `flux-uploads.ts`):
  - `MAX_FLUX_FILES_PER_BATCH = 50`, `FLUX_PUT_TTL_SECONDS = 900`
  - `type FluxFile = { name: string; size: number; sha256: string | null }`
  - `validateFluxFiles(v: unknown): { ok: true; files: FluxFile[] } | { ok: false; error: string }`
  - `resolveFluxPoint(agencyId: number, body: Record<string, unknown>): Promise<{ ok: true; point: { lat: number; lng: number } | null } | { ok: false; error: string }>`
  - `type FluxUploadItem = { alreadyThere: true } | { uploadId: string; uploadUrl: string; method: "PUT"; headers: { "Content-Type": "image/jpeg" }; expiresInSeconds: number }`
  - `requestFluxUploads(ctx: FluxDeviceCtx, target: { agencyId: number; albumId: number }, files: FluxFile[], point: { lat: number; lng: number } | null): Promise<FluxUploadItem[]>`
  - Ruta: `POST /api/agency-ingest/v1/batches` body `{ agencyId, albumId, placeId? | (lat?, lng?), files: [{ name, size, contentType, sha256? }] }` → `200 { files: FluxUploadItem[] }` (mismo orden) | `400` | `401` | `403` | `429` | `503`.

- [ ] **Step 1: Tests** `lib/agencies/flux-uploads.test.ts` (esta tarea agrega los `describe` de validación, punto y pedido; Task 7 agrega el de confirmación al mismo archivo):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const photoFindMany = vi.fn();
const upFindMany = vi.fn();
const upFindFirst = vi.fn();
const upCreate = vi.fn();
const upUpdate = vi.fn();
const upUpdateMany = vi.fn();
const placeFindFirst = vi.fn();
const jobFindUnique = vi.fn();
const signPut = vi.fn();
const deleteR2 = vi.fn();
const target = vi.fn();
const ensureMp = vi.fn();
const enqueue = vi.fn();
const awaitsFilterMock = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    photo: { findMany: (...a: unknown[]) => photoFindMany(...a) },
    agencyFluxUpload: {
      findMany: (...a: unknown[]) => upFindMany(...a),
      findFirst: (...a: unknown[]) => upFindFirst(...a),
      create: (...a: unknown[]) => upCreate(...a),
      update: (...a: unknown[]) => upUpdate(...a),
      updateMany: (...a: unknown[]) => upUpdateMany(...a),
    },
    agencyPlace: { findFirst: (...a: unknown[]) => placeFindFirst(...a) },
    cameraIngestJob: { findUnique: (...a: unknown[]) => jobFindUnique(...a) },
  },
}));
vi.mock("@/lib/r2-client", () => ({
  generateR2Key: (name: string, prefix: string) => `${prefix}/uuid-${name}`,
  getSignedPutUrl: (...a: unknown[]) => signPut(...a),
  deleteFromR2: (...a: unknown[]) => deleteR2(...a),
}));
vi.mock("@/lib/agencies/upload-target", () => ({ checkAgencyUploadTarget: (...a: unknown[]) => target(...a) }));
vi.mock("@/app/api/dashboard/albums/[id]/photos/upload-helpers", () => ({ ensureMpConnected: (...a: unknown[]) => ensureMp(...a) }));
vi.mock("@/lib/albums/enqueue-album-photo-ingest", () => ({ enqueueAlbumPhotoIngest: (...a: unknown[]) => enqueue(...a) }));
vi.mock("@/lib/agencies/publish-mode", () => ({ agencyAwaitsFilter: (...a: unknown[]) => awaitsFilterMock(...a) }));

import { requestFluxUploads, resolveFluxPoint, validateFluxFiles } from "./flux-uploads";

const ctx = { deviceKeyId: 33, userId: 20, role: "PHOTOGRAPHER" } as const;
const tgt = { agencyId: 3, albumId: 50 };
const H = "a".repeat(64);

beforeEach(() => {
  for (const f of [photoFindMany, upFindMany, upFindFirst, upCreate, upUpdate, upUpdateMany, placeFindFirst, jobFindUnique, signPut, deleteR2, target, ensureMp, enqueue, awaitsFilterMock]) f.mockReset();
  photoFindMany.mockResolvedValue([]);
  upFindMany.mockResolvedValue([]);
  let n = 0;
  upCreate.mockImplementation(async () => ({ id: `up${++n}` }));
  upUpdate.mockResolvedValue({});
  upUpdateMany.mockResolvedValue({ count: 1 });
  signPut.mockImplementation(async (key: string) => `https://r2/${key}?firma`);
  deleteR2.mockResolvedValue(undefined);
  target.mockResolvedValue({ ok: true });
  ensureMp.mockResolvedValue({ ok: true, error: null });
  awaitsFilterMock.mockResolvedValue(false);
});

describe("validateFluxFiles", () => {
  it("acepta JPG de hasta 10 MB y normaliza la huella", () => {
    expect(validateFluxFiles([{ name: "DSC_0001.JPG", size: 5_000_000, contentType: "image/jpeg", sha256: H.toUpperCase() }])).toEqual({
      ok: true,
      files: [{ name: "DSC_0001.JPG", size: 5_000_000, sha256: H }],
    });
  });
  it("rechaza la tanda entera si un archivo no es JPG, pesa de más, no tiene tamaño o la huella está mal", () => {
    const ok = { name: "a.jpg", size: 1000, contentType: "image/jpeg" };
    expect(validateFluxFiles([ok, { ...ok, name: "a.png", contentType: "image/png" }])).toMatchObject({ ok: false, error: expect.stringContaining("JPG") });
    expect(validateFluxFiles([{ ...ok, name: "a.heic", contentType: "image/jpeg" }])).toMatchObject({ ok: false });
    expect(validateFluxFiles([{ ...ok, size: 10 * 1024 * 1024 + 1 }])).toMatchObject({ ok: false, error: expect.stringContaining("10 MB") });
    expect(validateFluxFiles([{ ...ok, size: 0 }])).toMatchObject({ ok: false });
    expect(validateFluxFiles([{ ...ok, sha256: "xyz" }])).toMatchObject({ ok: false });
    expect(validateFluxFiles([])).toMatchObject({ ok: false });
    expect(validateFluxFiles(Array.from({ length: 51 }, () => ok))).toMatchObject({ ok: false });
    expect(validateFluxFiles("hola")).toMatchObject({ ok: false });
  });
  it("se queda sólo con el nombre del archivo, sin carpetas", () => {
    expect(validateFluxFiles([{ name: "C:\\DCIM\\100NIKON\\DSC_1.jpg", size: 10, contentType: "image/jpeg" }])).toEqual({
      ok: true, files: [{ name: "DSC_1.jpg", size: 10, sha256: null }],
    });
  });
});

describe("resolveFluxPoint", () => {
  it("sin punto: null", async () => {
    expect(await resolveFluxPoint(3, {})).toEqual({ ok: true, point: null });
  });
  it("lugar de la agencia: su punto; lugar ajeno: error", async () => {
    placeFindFirst.mockResolvedValue({ lat: -38.02, lng: -57.53 });
    expect(await resolveFluxPoint(3, { placeId: 1 })).toEqual({ ok: true, point: { lat: -38.02, lng: -57.53 } });
    expect(placeFindFirst.mock.calls[0][0].where).toEqual({ id: 1, agencyId: 3 });
    placeFindFirst.mockResolvedValue(null);
    expect(await resolveFluxPoint(3, { placeId: 9 })).toMatchObject({ ok: false });
  });
  it("lat/lng válidos: el punto; inválidos o a medias: error (no se ignora en silencio)", async () => {
    expect(await resolveFluxPoint(3, { lat: -38.02, lng: -57.53 })).toEqual({ ok: true, point: { lat: -38.02, lng: -57.53 } });
    expect(await resolveFluxPoint(3, { lat: 200, lng: 0 })).toMatchObject({ ok: false });
    expect(await resolveFluxPoint(3, { lat: -38 })).toMatchObject({ ok: false });
  });
});

describe("requestFluxUploads", () => {
  const f1 = { name: "DSC_1.JPG", size: 100, sha256: H };
  const f2 = { name: "DSC_2.JPG", size: 200, sha256: null };

  it("archivos nuevos: una fila por archivo con su rawKey en el álbum y URL firmada de 15 minutos", async () => {
    const items = await requestFluxUploads(ctx, tgt, [f1, f2], { lat: -38, lng: -57.5 });
    expect(items).toEqual([
      { uploadId: "up1", uploadUrl: "https://r2/albums/50/raw/uuid-DSC_1.JPG?firma", method: "PUT", headers: { "Content-Type": "image/jpeg" }, expiresInSeconds: 900 },
      { uploadId: "up2", uploadUrl: "https://r2/albums/50/raw/uuid-DSC_2.JPG?firma", method: "PUT", headers: { "Content-Type": "image/jpeg" }, expiresInSeconds: 900 },
    ]);
    expect(upCreate.mock.calls[0][0].data).toEqual({
      deviceKeyId: 33, userId: 20, agencyId: 3, albumId: 50, rawKey: "albums/50/raw/uuid-DSC_1.JPG",
      originalFilename: "DSC_1.JPG", sizeBytes: 100, contentSha256: H, declaredLat: -38, declaredLng: -57.5,
    });
    expect(signPut).toHaveBeenCalledWith("albums/50/raw/uuid-DSC_1.JPG", "image/jpeg", 900);
  });
  it("la huella ya está publicada en el álbum: alreadyThere sin crear fila", async () => {
    photoFindMany.mockResolvedValue([{ contentSha256: H }]);
    expect(await requestFluxUploads(ctx, tgt, [f1], null)).toEqual([{ alreadyThere: true }]);
    expect(photoFindMany.mock.calls[0][0].where).toEqual({ albumId: 50, isRemoved: false, contentSha256: { in: [H] } });
    expect(upCreate).not.toHaveBeenCalled();
  });
  it("retoma: la fila sin confirmar se reusa con URL nueva; la confirmada responde alreadyThere", async () => {
    upFindMany.mockResolvedValue([
      { id: "old1", rawKey: "albums/50/raw/k1", originalFilename: "DSC_1.JPG", sizeBytes: 100, contentSha256: H, status: "UPLOADING" },
      { id: "old2", rawKey: "albums/50/raw/k2", originalFilename: "DSC_2.JPG", sizeBytes: 200, contentSha256: null, status: "CONFIRMED" },
    ]);
    const items = await requestFluxUploads(ctx, tgt, [f1, f2], null);
    expect(items[0]).toMatchObject({ uploadId: "old1", uploadUrl: "https://r2/albums/50/raw/k1?firma" });
    expect(items[1]).toEqual({ alreadyThere: true });
    expect(upCreate).not.toHaveBeenCalled();
    expect(upUpdate).toHaveBeenCalledWith({ where: { id: "old1" }, data: { deviceKeyId: 33, declaredLat: null, declaredLng: null } });
  });
  it("una fila rechazada (pesaba de más) no se reusa: se arma una nueva", async () => {
    upFindMany.mockResolvedValue([{ id: "old1", rawKey: "k", originalFilename: "DSC_1.JPG", sizeBytes: 100, contentSha256: H, status: "REJECTED" }]);
    expect(await requestFluxUploads(ctx, tgt, [f1], null)).toEqual([expect.objectContaining({ uploadId: "up1" })]);
  });
  it("el mismo archivo dos veces en la tanda: una sola fila, la misma respuesta", async () => {
    const items = await requestFluxUploads(ctx, tgt, [f1, f1], null);
    expect(upCreate).toHaveBeenCalledTimes(1);
    expect(items[1]).toEqual(items[0]);
  });
});
```

En `app/api/agency-ingest/v1/batches-confirm.test.ts` (Task 7 le agrega el `describe` de `confirm`):

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticate = vi.fn();
const target = vi.fn();
const ensureMp = vi.fn();
const requestUploads = vi.fn();
const resolvePoint = vi.fn();
const confirm = vi.fn();
vi.mock("@/lib/agencies/flux-keys", () => ({ authenticateAgencyDevice: (...a: unknown[]) => authenticate(...a) }));
vi.mock("@/lib/agencies/upload-target", () => ({ checkAgencyUploadTarget: (...a: unknown[]) => target(...a) }));
vi.mock("@/app/api/dashboard/albums/[id]/photos/upload-helpers", () => ({ ensureMpConnected: (...a: unknown[]) => ensureMp(...a) }));
vi.mock("@/lib/agencies/flux-uploads", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agencies/flux-uploads")>()),
  requestFluxUploads: (...a: unknown[]) => requestUploads(...a),
  resolveFluxPoint: (...a: unknown[]) => resolvePoint(...a),
  confirmFluxUpload: (...a: unknown[]) => confirm(...a),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/r2-client", () => ({}));

import { POST as BATCHES } from "./batches/route";

let keyN = 0;
const AUTH = () => ({ authorization: `Bearer clf_dev_${++keyN}` });
const batchReq = (body: unknown, headers: Record<string, string> = AUTH()) =>
  new Request("https://x/api/agency-ingest/v1/batches", { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) });
const okBody = { agencyId: 3, albumId: 50, placeId: 1, files: [{ name: "DSC_1.JPG", size: 100, contentType: "image/jpeg" }] };

beforeEach(() => {
  for (const f of [authenticate, target, ensureMp, requestUploads, resolvePoint, confirm]) f.mockReset();
  authenticate.mockImplementation(async () => ({ deviceKeyId: ++keyN + 1000, userId: 20, role: "PHOTOGRAPHER" }));
  target.mockResolvedValue({ ok: true });
  ensureMp.mockResolvedValue({ ok: true, error: null });
  resolvePoint.mockResolvedValue({ ok: true, point: { lat: -38, lng: -57.5 } });
  requestUploads.mockResolvedValue([{ alreadyThere: true }]);
});

describe("POST batches", () => {
  it("sin llave: 401", async () => {
    authenticate.mockResolvedValue(null);
    expect((await BATCHES(batchReq(okBody, {}))).status).toBe(401);
  });
  it("datos mal (agencia, álbum o archivos): 400 sin tocar nada", async () => {
    expect((await BATCHES(batchReq({ ...okBody, albumId: "x" }))).status).toBe(400);
    expect((await BATCHES(batchReq({ ...okBody, files: [{ name: "a.png", size: 1, contentType: "image/png" }] }))).status).toBe(400);
    expect(requestUploads).not.toHaveBeenCalled();
  });
  it("lo dieron de baja o el álbum no es de esa agencia: 403 con el motivo", async () => {
    target.mockResolvedValue({ ok: false, message: "Ya no podés subir a ese álbum de la agencia." });
    const res = await BATCHES(batchReq(okBody));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Ya no podés subir a ese álbum de la agencia.");
    expect(target).toHaveBeenCalledWith(3, 50, 20);
    expect(requestUploads).not.toHaveBeenCalled();
  });
  it("sin Mercado Pago conectado: 403", async () => {
    ensureMp.mockResolvedValue({ ok: false, error: "Debés conectar Mercado Pago para subir fotos." });
    expect((await BATCHES(batchReq(okBody))).status).toBe(403);
    expect(requestUploads).not.toHaveBeenCalled();
  });
  it("punto inválido: 400", async () => {
    resolvePoint.mockResolvedValue({ ok: false, error: "Ese lugar no es de la agencia." });
    expect((await BATCHES(batchReq(okBody))).status).toBe(400);
  });
  it("válido: 200 con un ítem por archivo", async () => {
    const res = await BATCHES(batchReq(okBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ files: [{ alreadyThere: true }] });
    expect(requestUploads.mock.calls[0][1]).toEqual({ agencyId: 3, albumId: 50 });
    expect(requestUploads.mock.calls[0][3]).toEqual({ lat: -38, lng: -57.5 });
  });
});
```

(Cada test usa una llave distinta para que el freno de 120 por minuto no se mezcle entre tests.)

- [ ] **Step 2:** Correr `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/flux-uploads.test.ts app/api/agency-ingest/v1/batches-confirm.test.ts` → FAIL.

- [ ] **Step 3: Implementación.**

`lib/agencies/flux-uploads.ts` (la parte de esta tarea; Task 7 agrega `confirmFluxUpload` al final):

```ts
import { prisma } from "@/lib/prisma";
import { generateR2Key, getSignedPutUrl } from "@/lib/r2-client";
import { getAlbumPhotoMaxBytes, getAlbumPhotoMaxMb } from "@/lib/albums/album-photo-upload-limits";
import { parseDeclaredPoint } from "@/lib/agencies/photo-facts";
import type { FluxDeviceCtx } from "@/lib/agencies/flux-keys";

/**
 * DNX FLUX sube directo a R2 (nunca por Vercel): pide una tanda, recibe una URL firmada de PUT por archivo y
 * después confirma cada uno. CLF acepta sólo JPG de hasta 10 MB. Las repetidas las descarta la ingesta (etapa 2a);
 * la huella opcional sólo ahorra subir lo que ya está publicado.
 */

export const MAX_FLUX_FILES_PER_BATCH = 50;
export const FLUX_PUT_TTL_SECONDS = 900;
const JPEG = "image/jpeg";
const MAX_NAME = 200;

export type FluxFile = { name: string; size: number; sha256: string | null };

function baseName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const n = v.split(/[\\/]/).pop()?.trim() ?? "";
  return n && n.length <= MAX_NAME ? n : null;
}

export function validateFluxFiles(v: unknown): { ok: true; files: FluxFile[] } | { ok: false; error: string } {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_FLUX_FILES_PER_BATCH) {
    return { ok: false, error: `Mandá entre 1 y ${MAX_FLUX_FILES_PER_BATCH} fotos por pedido.` };
  }
  const maxBytes = getAlbumPhotoMaxBytes();
  const files: FluxFile[] = [];
  for (const raw of v as unknown[]) {
    if (!raw || typeof raw !== "object") return { ok: false, error: "Los datos de las fotos no son válidos." };
    const r = raw as Record<string, unknown>;
    const name = baseName(r.name);
    if (!name) return { ok: false, error: "Falta el nombre de una foto." };
    const type = typeof r.contentType === "string" ? r.contentType.toLowerCase() : "";
    if (!/\.jpe?g$/i.test(name) || (type !== JPEG && type !== "image/jpg")) {
      return { ok: false, error: `${name}: ComprameLaFoto sólo acepta fotos JPG.` };
    }
    if (typeof r.size !== "number" || !Number.isInteger(r.size) || r.size <= 0) {
      return { ok: false, error: `${name}: falta el tamaño del archivo.` };
    }
    if (r.size > maxBytes) {
      return { ok: false, error: `${name}: la foto pesa más de ${getAlbumPhotoMaxMb()} MB. Achicala antes de subirla.` };
    }
    let sha256: string | null = null;
    if (r.sha256 !== undefined && r.sha256 !== null) {
      if (typeof r.sha256 !== "string" || !/^[a-f0-9]{64}$/i.test(r.sha256)) return { ok: false, error: `${name}: la huella no es válida.` };
      sha256 = r.sha256.toLowerCase();
    }
    files.push({ name, size: r.size, sha256 });
  }
  return { ok: true, files };
}

/** Punto declarado de la tanda: un lugar de la agencia (`placeId`) o `lat`/`lng`; nada = sin punto. */
export async function resolveFluxPoint(
  agencyId: number,
  body: Record<string, unknown>
): Promise<{ ok: true; point: { lat: number; lng: number } | null } | { ok: false; error: string }> {
  if (body.placeId !== undefined && body.placeId !== null) {
    const id = Number(body.placeId);
    const place = Number.isInteger(id) && id > 0
      ? await prisma.agencyPlace.findFirst({ where: { id, agencyId }, select: { lat: true, lng: true } })
      : null;
    return place ? { ok: true, point: { lat: place.lat, lng: place.lng } } : { ok: false, error: "Ese lugar no es de la agencia." };
  }
  const hasLat = body.lat !== undefined && body.lat !== null;
  const hasLng = body.lng !== undefined && body.lng !== null;
  if (!hasLat && !hasLng) return { ok: true, point: null };
  const point = parseDeclaredPoint(body.lat, body.lng);
  return point ? { ok: true, point } : { ok: false, error: "El punto del mapa no es válido." };
}

export type FluxUploadItem =
  | { alreadyThere: true }
  | { uploadId: string; uploadUrl: string; method: "PUT"; headers: { "Content-Type": "image/jpeg" }; expiresInSeconds: number };

const matchKey = (f: { name: string; size: number; sha256: string | null }) => (f.sha256 ? `h:${f.sha256}` : `n:${f.name}:${f.size}`);

function signed(uploadId: string, uploadUrl: string): FluxUploadItem {
  return { uploadId, uploadUrl, method: "PUT", headers: { "Content-Type": JPEG }, expiresInSeconds: FLUX_PUT_TTL_SECONDS };
}

/**
 * Un ítem por archivo, en el mismo orden: `alreadyThere` si la huella ya está publicada en el álbum o el archivo ya
 * se confirmó; la MISMA fila con URL nueva si quedó sin confirmar (DNX FLUX retoma sin duplicar); o una fila nueva.
 * Se reconoce un archivo por su huella si la manda, o por nombre + tamaño.
 */
export async function requestFluxUploads(
  ctx: FluxDeviceCtx,
  target: { agencyId: number; albumId: number },
  files: FluxFile[],
  point: { lat: number; lng: number } | null
): Promise<FluxUploadItem[]> {
  const hashes = [...new Set(files.map((f) => f.sha256).filter((h): h is string => h !== null))];
  const names = [...new Set(files.map((f) => f.name))];
  const published = hashes.length
    ? new Set(
        (
          await prisma.photo.findMany({
            where: { albumId: target.albumId, isRemoved: false, contentSha256: { in: hashes } },
            select: { contentSha256: true },
          })
        ).map((p) => p.contentSha256)
      )
    : new Set<string | null>();
  const previous = await prisma.agencyFluxUpload.findMany({
    where: {
      userId: ctx.userId,
      albumId: target.albumId,
      OR: [...(hashes.length ? [{ contentSha256: { in: hashes } }] : []), { originalFilename: { in: names } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, rawKey: true, originalFilename: true, sizeBytes: true, contentSha256: true, status: true },
  });
  const prevByKey = new Map<string, (typeof previous)[number]>();
  for (const p of previous) {
    const k = matchKey({ name: p.originalFilename, size: p.sizeBytes, sha256: p.contentSha256 });
    if (!prevByKey.has(k)) prevByKey.set(k, p);
  }

  const declared = { declaredLat: point?.lat ?? null, declaredLng: point?.lng ?? null };
  const resolved = new Map<string, FluxUploadItem>();
  const items: FluxUploadItem[] = [];
  for (const f of files) {
    const k = matchKey(f);
    const done = resolved.get(k);
    if (done) {
      items.push(done);
      continue;
    }
    const prev = prevByKey.get(k);
    let item: FluxUploadItem;
    if ((f.sha256 && published.has(f.sha256)) || prev?.status === "CONFIRMED") {
      item = { alreadyThere: true };
    } else if (prev?.status === "UPLOADING") {
      await prisma.agencyFluxUpload.update({ where: { id: prev.id }, data: { deviceKeyId: ctx.deviceKeyId, ...declared } });
      item = signed(prev.id, await getSignedPutUrl(prev.rawKey, JPEG, FLUX_PUT_TTL_SECONDS));
    } else {
      const rawKey = generateR2Key(f.name, `albums/${target.albumId}/raw`);
      const row = await prisma.agencyFluxUpload.create({
        data: {
          deviceKeyId: ctx.deviceKeyId, userId: ctx.userId, agencyId: target.agencyId, albumId: target.albumId, rawKey,
          originalFilename: f.name, sizeBytes: f.size, contentSha256: f.sha256, ...declared,
        },
        select: { id: true },
      });
      item = signed(row.id, await getSignedPutUrl(rawKey, JPEG, FLUX_PUT_TTL_SECONDS));
    }
    resolved.set(k, item);
    items.push(item);
  }
  return items;
}
```

`app/api/agency-ingest/v1/batches/route.ts`:

```ts
import { checkAgencyUploadTarget } from "@/lib/agencies/upload-target";
import { ensureMpConnected } from "@/app/api/dashboard/albums/[id]/photos/upload-helpers";
import { FLUX_MESSAGES, authorizeFluxRequest, fluxError, fluxJson, readJsonObject } from "@/lib/agencies/flux-http";
import { requestFluxUploads, resolveFluxPoint, validateFluxFiles } from "@/lib/agencies/flux-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const positiveInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/** DNX FLUX pide subir hasta 50 JPG al álbum de una agencia: devuelve una URL firmada de R2 por archivo. */
export async function POST(request: Request) {
  const a = await authorizeFluxRequest(request);
  if ("res" in a) return a.res;
  const body = await readJsonObject(request);
  if (!body) return fluxError(FLUX_MESSAGES.data, 400);
  const agencyId = positiveInt(body.agencyId);
  const albumId = positiveInt(body.albumId);
  if (!agencyId || !albumId) return fluxError(FLUX_MESSAGES.data, 400);
  const v = validateFluxFiles(body.files);
  if (!v.ok) return fluxError(v.error, 400);
  try {
    const target = await checkAgencyUploadTarget(agencyId, albumId, a.ctx.userId);
    if (!target.ok) return fluxError(target.message, 403);
    const mp = await ensureMpConnected({ id: a.ctx.userId, role: a.ctx.role });
    if (!mp.ok) return fluxError(mp.error ?? FLUX_MESSAGES.error, 403);
    const p = await resolveFluxPoint(agencyId, body);
    if (!p.ok) return fluxError(p.error, 400);
    const files = await requestFluxUploads(a.ctx, { agencyId, albumId }, v.files, p.point);
    return fluxJson({ files });
  } catch {
    return fluxError(FLUX_MESSAGES.error, 503);
  }
}
```

- [ ] **Step 4:** Correr el mismo comando → PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies/flux-uploads.ts apps/compramelafoto/lib/agencies/flux-uploads.test.ts apps/compramelafoto/app/api/agency-ingest/v1/batches apps/compramelafoto/app/api/agency-ingest/v1/batches-confirm.test.ts
git commit -m "Modo agencia: DNX FLUX pide URLs firmadas para subir directo a R2"
```

---

### Task 7: Confirmar una foto (`POST /api/agency-ingest/v1/photos/[id]/confirm`)

**Files:**
- Modify: `apps/compramelafoto/lib/agencies/flux-uploads.ts` (agregar `confirmFluxUpload`)
- Modify: `apps/compramelafoto/lib/agencies/flux-uploads.test.ts` (agregar `describe("confirmFluxUpload")`)
- Create: `apps/compramelafoto/app/api/agency-ingest/v1/photos/[id]/confirm/route.ts`
- Modify: `apps/compramelafoto/app/api/agency-ingest/v1/batches-confirm.test.ts` (agregar `describe("POST confirm")`)

**Interfaces:**
- Consumes: `enqueueAlbumPhotoIngest` con `source: "FLUX"`, `declaredPoint`, `agencyDeviceKeyId`, `awaitFilter` (Task 5); `agencyAwaitsFilter` (Task 5); `checkAgencyUploadTarget` (Task 4); `ensureMpConnected`; `deleteFromR2` (`@/lib/r2-client`).
- Produces:
  - `confirmFluxUpload(ctx: FluxDeviceCtx, uploadId: string): Promise<{ status: number; body: Record<string, unknown> }>`
    - `200 { ok: true, state: "QUEUED" | "AWAITING_FILTER" }` (también si ya estaba confirmada, con `alreadyConfirmed: true`)
    - `404` ajena o inexistente · `400` id mal formado · `403` sin acceso o sin MP · `409 { ok: false, state: "PENDING_UPLOAD", error }` el archivo no llegó a R2 · `422 { ok: false, state: "REJECTED", error }` pesa de más · `503` error transitorio.
  - Ruta: `POST /api/agency-ingest/v1/photos/{id}/confirm` → lo mismo (y `401`/`429` de la autorización).

- [ ] **Step 1: Tests.** Agregar al final de `lib/agencies/flux-uploads.test.ts` (y sumar `confirmFluxUpload` al `import` de `./flux-uploads`):

```ts
describe("confirmFluxUpload", () => {
  const up = {
    id: "up1", userId: 20, agencyId: 3, albumId: 50, rawKey: "albums/50/raw/uuid-DSC_1.JPG", originalFilename: "DSC_1.JPG",
    deviceKeyId: 33, declaredLat: -38, declaredLng: -57.5, status: "UPLOADING", ingestJobId: null,
  };

  beforeEach(() => {
    upFindFirst.mockResolvedValue(up);
    enqueue.mockResolvedValue({ job: { id: "j1", status: "PENDING" }, created: true });
  });

  it("id mal formado: 400; ajena o inexistente: 404 (busca con el usuario de la llave)", async () => {
    expect((await confirmFluxUpload(ctx, "../x")).status).toBe(400);
    upFindFirst.mockResolvedValue(null);
    expect((await confirmFluxUpload(ctx, "up9")).status).toBe(404);
    expect(upFindFirst.mock.calls[0][0].where).toEqual({ id: "up9", userId: 20 });
  });
  it("válida: encola FLUX con autor, álbum, punto y llave, y la marca confirmada una sola vez", async () => {
    expect(await confirmFluxUpload(ctx, "up1")).toEqual({ status: 200, body: { ok: true, state: "QUEUED" } });
    expect(enqueue).toHaveBeenCalledWith({
      userId: 20, albumId: 50, rawKey: "albums/50/raw/uuid-DSC_1.JPG", originalFilename: "DSC_1.JPG",
      source: "FLUX", declaredPoint: { lat: -38, lng: -57.5 }, agencyDeviceKeyId: 33, awaitFilter: false,
    });
    expect(upUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "up1", status: "UPLOADING" },
      data: { status: "CONFIRMED", ingestJobId: "j1", confirmedAt: expect.any(Date) },
    });
  });
  it("agencia que espera al filtro: estado AWAITING_FILTER", async () => {
    awaitsFilterMock.mockResolvedValue(true);
    enqueue.mockResolvedValue({ job: { id: "j1", status: "AWAITING_FILTER" }, created: true });
    expect((await confirmFluxUpload(ctx, "up1")).body).toEqual({ ok: true, state: "AWAITING_FILTER" });
    expect(enqueue.mock.calls[0][0].awaitFilter).toBe(true);
  });
  it("confirmada dos veces: no vuelve a encolar", async () => {
    upFindFirst.mockResolvedValue({ ...up, status: "CONFIRMED", ingestJobId: "j1" });
    jobFindUnique.mockResolvedValue({ status: "COMPLETED" });
    expect(await confirmFluxUpload(ctx, "up1")).toEqual({ status: 200, body: { ok: true, state: "QUEUED", alreadyConfirmed: true } });
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("lo dieron de baja entre la tanda y la confirmación: 403 sin encolar", async () => {
    target.mockResolvedValue({ ok: false, message: "Ya no podés subir a ese álbum de la agencia." });
    expect(await confirmFluxUpload(ctx, "up1")).toEqual({ status: 403, body: { error: "Ya no podés subir a ese álbum de la agencia." } });
    expect(target).toHaveBeenCalledWith(3, 50, 20);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it("el archivo no llegó a R2: 409 y la fila sigue esperando", async () => {
    enqueue.mockRejectedValue(Object.assign(new Error("NotFound"), { name: "NotFound", $metadata: { httpStatusCode: 404 } }));
    expect(await confirmFluxUpload(ctx, "up1")).toMatchObject({ status: 409, body: { ok: false, state: "PENDING_UPLOAD" } });
    expect(upUpdateMany).not.toHaveBeenCalled();
    expect(upUpdate).not.toHaveBeenCalled();
  });
  it("subió algo de más de 10 MB: 422, fila REJECTED y se borra el archivo", async () => {
    enqueue.mockRejectedValue(new Error("El archivo supera el límite de 10MB."));
    expect(await confirmFluxUpload(ctx, "up1")).toMatchObject({ status: 422, body: { ok: false, state: "REJECTED" } });
    expect(upUpdate).toHaveBeenCalledWith({ where: { id: "up1" }, data: { status: "REJECTED" } });
    expect(deleteR2).toHaveBeenCalledWith("albums/50/raw/uuid-DSC_1.JPG");
  });
});
```

Agregar a `app/api/agency-ingest/v1/batches-confirm.test.ts` (import `POST as CONFIRM` desde `./photos/[id]/confirm/route`):

```ts
describe("POST confirm", () => {
  const confirmReq = (headers: Record<string, string> = AUTH()) =>
    new Request("https://x/api/agency-ingest/v1/photos/up1/confirm", { method: "POST", headers });
  const params = (id: string) => ({ params: Promise.resolve({ id }) });

  it("sin llave: 401", async () => {
    authenticate.mockResolvedValue(null);
    expect((await CONFIRM(confirmReq({}), params("up1"))).status).toBe(401);
    expect(confirm).not.toHaveBeenCalled();
  });
  it("devuelve el estado y el cuerpo de confirmFluxUpload", async () => {
    confirm.mockResolvedValue({ status: 409, body: { ok: false, state: "PENDING_UPLOAD", error: "x" } });
    const res = await CONFIRM(confirmReq(), params("up1"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ ok: false, state: "PENDING_UPLOAD", error: "x" });
    expect(confirm.mock.calls[0][1]).toBe("up1");
  });
  it("error inesperado: 503", async () => {
    confirm.mockRejectedValue(new Error("db"));
    expect((await CONFIRM(confirmReq(), params("up1"))).status).toBe(503);
  });
});
```

- [ ] **Step 2:** Correr `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/flux-uploads.test.ts app/api/agency-ingest` → FAIL.

- [ ] **Step 3: Implementación.** Agregar a `lib/agencies/flux-uploads.ts` (y sumar a los imports `deleteFromR2` de `@/lib/r2-client`, `checkAgencyUploadTarget` de `@/lib/agencies/upload-target`, `ensureMpConnected` de `@/app/api/dashboard/albums/[id]/photos/upload-helpers`, `enqueueAlbumPhotoIngest` de `@/lib/albums/enqueue-album-photo-ingest` y `agencyAwaitsFilter` de `@/lib/agencies/publish-mode`):

```ts
const UPLOAD_ID = /^[A-Za-z0-9_-]{1,64}$/;

function isR2NotFound(err: unknown): boolean {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } } | null;
  return Boolean(e && (e.name === "NotFound" || e.name === "NoSuchKey" || e.$metadata?.httpStatusCode === 404));
}

const stateOf = (status: string | null | undefined) => (status === "AWAITING_FILTER" ? "AWAITING_FILTER" : "QUEUED");

/**
 * DNX FLUX avisa que terminó el PUT: se vuelve a chequear el acceso y se encola en la fila común (autor = el
 * fotógrafo, álbum de la agencia, punto declarado, origen FLUX). Idempotente: confirmar dos veces no duplica.
 */
export async function confirmFluxUpload(ctx: FluxDeviceCtx, uploadId: string): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!UPLOAD_ID.test(uploadId)) return { status: 400, body: { error: "Los datos no son válidos." } };
  const up = await prisma.agencyFluxUpload.findFirst({
    where: { id: uploadId, userId: ctx.userId },
    select: {
      id: true, agencyId: true, albumId: true, rawKey: true, originalFilename: true, deviceKeyId: true,
      declaredLat: true, declaredLng: true, status: true, ingestJobId: true,
    },
  });
  if (!up) return { status: 404, body: { error: "No encontramos esa foto." } };
  if (up.status === "CONFIRMED") {
    const job = up.ingestJobId
      ? await prisma.cameraIngestJob.findUnique({ where: { id: up.ingestJobId }, select: { status: true } })
      : null;
    return { status: 200, body: { ok: true, state: stateOf(job?.status), alreadyConfirmed: true } };
  }
  const tooBig = `La foto pesa más de ${getAlbumPhotoMaxMb()} MB. Achicala y volvé a subirla.`;
  if (up.status === "REJECTED") return { status: 422, body: { ok: false, state: "REJECTED", error: tooBig } };

  const access = await checkAgencyUploadTarget(up.agencyId, up.albumId, ctx.userId);
  if (!access.ok) return { status: 403, body: { error: access.message } };
  const mp = await ensureMpConnected({ id: ctx.userId, role: ctx.role });
  if (!mp.ok) return { status: 403, body: { error: mp.error } };
  const awaitFilter = await agencyAwaitsFilter(up.agencyId);

  let job: { id: string; status: string };
  try {
    ({ job } = await enqueueAlbumPhotoIngest({
      userId: ctx.userId,
      albumId: up.albumId,
      rawKey: up.rawKey,
      originalFilename: up.originalFilename,
      source: "FLUX",
      declaredPoint: up.declaredLat != null && up.declaredLng != null ? { lat: up.declaredLat, lng: up.declaredLng } : null,
      agencyDeviceKeyId: up.deviceKeyId,
      awaitFilter,
    }));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isR2NotFound(err) || /aún no está disponible/i.test(msg)) {
      return { status: 409, body: { ok: false, state: "PENDING_UPLOAD", error: "La foto todavía no llegó. Volvé a subirla." } };
    }
    if (/supera el límite/i.test(msg)) {
      await prisma.agencyFluxUpload.update({ where: { id: up.id }, data: { status: "REJECTED" } });
      await deleteFromR2(up.rawKey).catch(() => undefined);
      return { status: 422, body: { ok: false, state: "REJECTED", error: tooBig } };
    }
    throw err;
  }
  await prisma.agencyFluxUpload.updateMany({
    where: { id: up.id, status: "UPLOADING" },
    data: { status: "CONFIRMED", ingestJobId: job.id, confirmedAt: new Date() },
  });
  return { status: 200, body: { ok: true, state: stateOf(job.status) } };
}
```

`app/api/agency-ingest/v1/photos/[id]/confirm/route.ts`:

```ts
import { FLUX_MESSAGES, authorizeFluxRequest, fluxError, fluxJson } from "@/lib/agencies/flux-http";
import { confirmFluxUpload } from "@/lib/agencies/flux-uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** DNX FLUX confirma que terminó de subir una foto: entra a la fila de ingesta del álbum de la agencia. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const a = await authorizeFluxRequest(request);
  if ("res" in a) return a.res;
  const { id } = await params;
  try {
    const r = await confirmFluxUpload(a.ctx, id);
    return fluxJson(r.body, r.status);
  } catch {
    return fluxError(FLUX_MESSAGES.error, 503);
  }
}
```

- [ ] **Step 4:** Correr el mismo comando → PASS. `NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck; echo exit=$?` → `exit=0` sin `error TS`.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies/flux-uploads.ts apps/compramelafoto/lib/agencies/flux-uploads.test.ts apps/compramelafoto/app/api/agency-ingest
git commit -m "Modo agencia: DNX FLUX confirma cada foto y entra a la fila común"
```

---

### Task 8: Espera del filtro — señal firmada y FTP

**Files:**
- Create: `apps/compramelafoto/lib/agencies/filter-signal.ts`, `apps/compramelafoto/lib/agencies/filter-signal.test.ts`
- Create: `apps/compramelafoto/app/api/internal/agency-filter/decisions/route.ts`, `.../decisions/route.test.ts`
- Modify: `apps/compramelafoto/lib/agencies/ftp-login.ts` (`resolveAgencyFtpUpload` devuelve `awaitFilter`), `apps/compramelafoto/lib/agencies/ftp-login.test.ts`
- Modify: `apps/compramelafoto/lib/camera-connection/create-camera-upload-log-and-enqueue.ts` (`awaitFilter?: boolean`)
- Create: `apps/compramelafoto/lib/camera-connection/create-camera-upload-log-and-enqueue.agency.test.ts`
- Create: `apps/compramelafoto/lib/camera-connection/claim-camera-ingest-job.agency.test.ts`
- Modify: `apps/compramelafoto-workers/camera-ftp-gateway/src/handle-upload.ts`
- Modify: `apps/compramelafoto/vitest.bot.config.ts` (agregar `"app/api/internal/agency-filter/**/*.test.ts"`, `"lib/camera-connection/create-camera-upload-log-and-enqueue.agency.test.ts"`, `"lib/camera-connection/claim-camera-ingest-job.agency.test.ts"`)

**Interfaces:**
- Consumes: `agencyAwaitsFilter` (Task 5); `deleteFromR2`; `CAMERA_UPLOAD_LOG_STATUS` (`@/lib/camera-connection/camera-connection-types`).
- Produces:
  - `FILTER_SIGNATURE_HEADER = "x-dnx-firma"`, `FILTER_SIGNATURE_TOLERANCE_S = 300`, `FILTER_REJECTED_NOTE = "Descartada por el filtro"`, `MAX_FILTER_DECISIONS = 100`
  - `signFilterBody(secret: string, t: number, body: string): string` → `t=<seg>,v1=<HMAC-SHA256(secret, "<t>.<body>") hex>`
  - `verifyFilterSignature(secret: string | undefined, header: string | null, body: string, nowMs: number): boolean`
  - `type FilterDecision = { jobId: string; decision: "APPROVED" | "REJECTED" }`
  - `parseFilterDecisions(v: unknown): { ok: true; decisions: FilterDecision[] } | { ok: false; error: string }`
  - `applyFilterDecisions(decisions: FilterDecision[]): Promise<Array<{ jobId: string; result: "approved" | "rejected" | "not_waiting" }>>`
  - `POST /api/internal/agency-filter/decisions` con encabezado `x-dnx-firma` y cuerpo `{ "decisions": [{ "jobId": "…", "decision": "APPROVED" | "REJECTED" }] }` → `200 { results }` | `400` | `401` (firma mala, vieja o falta `AGENCY_FILTER_SIGNAL_SECRET`).
  - `resolveAgencyFtpUpload` ok gana `awaitFilter: boolean`; `CreateCameraUploadLogAndEnqueueInput` gana `awaitFilter?: boolean`.

- [ ] **Step 1: Tests.**

`lib/agencies/filter-signal.test.ts`:

```ts
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const jobUpdateMany = vi.fn();
const jobFindFirst = vi.fn();
const logUpdate = vi.fn();
const deleteR2 = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cameraIngestJob: { updateMany: (...a: unknown[]) => jobUpdateMany(...a), findFirst: (...a: unknown[]) => jobFindFirst(...a) },
    cameraUploadLog: { update: (...a: unknown[]) => logUpdate(...a) },
  },
}));
vi.mock("@/lib/r2-client", () => ({ deleteFromR2: (...a: unknown[]) => deleteR2(...a) }));

import { applyFilterDecisions, parseFilterDecisions, signFilterBody, verifyFilterSignature } from "./filter-signal";

const SECRET = "secreto-de-prueba";
const BODY = '{"decisions":[]}';
const T = 1_800_000_000;

beforeEach(() => {
  for (const f of [jobUpdateMany, jobFindFirst, logUpdate, deleteR2]) f.mockReset();
  jobUpdateMany.mockResolvedValue({ count: 1 });
  logUpdate.mockResolvedValue({});
  deleteR2.mockResolvedValue(undefined);
});

describe("firma", () => {
  it("formato t=…,v1=HMAC-SHA256(secreto, 't.cuerpo')", () => {
    const v1 = createHmac("sha256", SECRET).update(`${T}.${BODY}`).digest("hex");
    expect(signFilterBody(SECRET, T, BODY)).toBe(`t=${T},v1=${v1}`);
  });
  it("válida dentro de 5 minutos; vieja, adulterada, sin secreto o sin encabezado: no", () => {
    const h = signFilterBody(SECRET, T, BODY);
    expect(verifyFilterSignature(SECRET, h, BODY, (T + 299) * 1000)).toBe(true);
    expect(verifyFilterSignature(SECRET, h, BODY, (T + 301) * 1000)).toBe(false);
    expect(verifyFilterSignature(SECRET, h, '{"decisions":[1]}', T * 1000)).toBe(false);
    expect(verifyFilterSignature(undefined, h, BODY, T * 1000)).toBe(false);
    expect(verifyFilterSignature("", h, BODY, T * 1000)).toBe(false);
    expect(verifyFilterSignature(SECRET, null, BODY, T * 1000)).toBe(false);
    expect(verifyFilterSignature(SECRET, "t=abc,v1=zz", BODY, T * 1000)).toBe(false);
  });
});

describe("parseFilterDecisions", () => {
  it("acepta hasta 100 decisiones válidas", () => {
    expect(parseFilterDecisions([{ jobId: "cj1", decision: "APPROVED" }])).toEqual({ ok: true, decisions: [{ jobId: "cj1", decision: "APPROVED" }] });
    expect(parseFilterDecisions([])).toMatchObject({ ok: false });
    expect(parseFilterDecisions([{ jobId: "cj1", decision: "MAYBE" }])).toMatchObject({ ok: false });
    expect(parseFilterDecisions([{ jobId: "", decision: "APPROVED" }])).toMatchObject({ ok: false });
    expect(parseFilterDecisions(Array.from({ length: 101 }, () => ({ jobId: "a", decision: "APPROVED" })))).toMatchObject({ ok: false });
  });
});

describe("applyFilterDecisions", () => {
  it("aprobada: sólo si estaba esperando, vuelve a PENDING para que el cron la procese", async () => {
    expect(await applyFilterDecisions([{ jobId: "cj1", decision: "APPROVED" }])).toEqual([{ jobId: "cj1", result: "approved" }]);
    expect(jobUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "cj1", status: "AWAITING_FILTER" },
      data: { status: "PENDING", runAfter: null, lastError: null },
    });
  });
  it("rechazada: cierra el job con la nota, borra el raw y marca el log de FTP", async () => {
    jobFindFirst.mockResolvedValue({ id: "cj2", rawKey: "albums/50/raw/k", uploadLogId: 7 });
    expect(await applyFilterDecisions([{ jobId: "cj2", decision: "REJECTED" }])).toEqual([{ jobId: "cj2", result: "rejected" }]);
    expect(jobUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: "cj2", status: "AWAITING_FILTER" },
      data: { status: "COMPLETED", completedAt: expect.any(Date), lastError: "Descartada por el filtro", lockedAt: null, runAfter: null },
    });
    expect(deleteR2).toHaveBeenCalledWith("albums/50/raw/k");
    expect(logUpdate).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: "REJECTED", errorMessage: "Descartada por el filtro" } });
  });
  it("una decisión sobre un job que no está esperando (repetida o tardía): not_waiting y no se borra nada", async () => {
    jobUpdateMany.mockResolvedValue({ count: 0 });
    jobFindFirst.mockResolvedValue(null);
    expect(await applyFilterDecisions([{ jobId: "cj3", decision: "APPROVED" }, { jobId: "cj4", decision: "REJECTED" }])).toEqual([
      { jobId: "cj3", result: "not_waiting" },
      { jobId: "cj4", result: "not_waiting" },
    ]);
    expect(deleteR2).not.toHaveBeenCalled();
  });
});
```

`app/api/internal/agency-filter/decisions/route.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const apply = vi.fn();
vi.mock("@/lib/agencies/filter-signal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/agencies/filter-signal")>()),
  applyFilterDecisions: (...a: unknown[]) => apply(...a),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/r2-client", () => ({}));

import { POST } from "./route";
import { signFilterBody } from "@/lib/agencies/filter-signal";

const body = JSON.stringify({ decisions: [{ jobId: "cj1", decision: "APPROVED" }] });
const req = (headers: Record<string, string>, b = body) =>
  new Request("https://x/api/internal/agency-filter/decisions", { method: "POST", headers, body: b });

beforeEach(() => {
  apply.mockReset();
  apply.mockResolvedValue([{ jobId: "cj1", result: "approved" }]);
  process.env.AGENCY_FILTER_SIGNAL_SECRET = "s3";
});
afterEach(() => {
  delete process.env.AGENCY_FILTER_SIGNAL_SECRET;
});

describe("POST decisiones del filtro", () => {
  it("sin firma o con firma mala: 401 sin tocar nada", async () => {
    expect((await POST(req({}))).status).toBe(401);
    expect((await POST(req({ "x-dnx-firma": "t=1,v1=00" }))).status).toBe(401);
    expect(apply).not.toHaveBeenCalled();
  });
  it("sin secreto configurado: 401 aunque firmen", async () => {
    delete process.env.AGENCY_FILTER_SIGNAL_SECRET;
    const t = Math.floor(Date.now() / 1000);
    expect((await POST(req({ "x-dnx-firma": signFilterBody("s3", t, body) }))).status).toBe(401);
  });
  it("firmado: aplica y devuelve los resultados", async () => {
    const t = Math.floor(Date.now() / 1000);
    const res = await POST(req({ "x-dnx-firma": signFilterBody("s3", t, body) }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ results: [{ jobId: "cj1", result: "approved" }] });
  });
  it("firmado pero con decisiones inválidas: 400", async () => {
    const bad = JSON.stringify({ decisions: [{ jobId: "cj1", decision: "TAL_VEZ" }] });
    const t = Math.floor(Date.now() / 1000);
    expect((await POST(req({ "x-dnx-firma": signFilterBody("s3", t, bad) }, bad))).status).toBe(400);
  });
});
```

`lib/camera-connection/create-camera-upload-log-and-enqueue.agency.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const jobCreate = vi.fn();
vi.mock("@/lib/prisma", () => {
  const tx = {
    cameraIngestJob: { findUnique: async () => null, create: (...a: unknown[]) => jobCreate(...a) },
    cameraUploadLog: { create: async () => ({ id: 1 }) },
  };
  return {
    prisma: {
      cameraIngestJob: { findUnique: async () => null },
      cameraUploadLog: { create: async () => ({ id: 1 }) },
      $transaction: (fn: (t: unknown) => unknown) => fn(tx),
    },
  };
});

import { createCameraUploadLogAndEnqueue } from "./create-camera-upload-log-and-enqueue";

const input = { userId: 20, albumId: 50, rawKey: "albums/50/raw/k.jpg", filename: "DSC_1.JPG", filesizeBytes: 100 };

beforeEach(() => {
  jobCreate.mockReset();
  jobCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "j", ...data }));
});

describe("createCameraUploadLogAndEnqueue y la espera del filtro", () => {
  it("sin awaitFilter (FTP de siempre): PENDING", async () => {
    await createCameraUploadLogAndEnqueue(input);
    expect(jobCreate.mock.calls[0][0].data.status).toBe("PENDING");
  });
  it("agencia que espera al filtro: AWAITING_FILTER", async () => {
    await createCameraUploadLogAndEnqueue({ ...input, awaitFilter: true });
    expect(jobCreate.mock.calls[0][0].data.status).toBe("AWAITING_FILTER");
  });
});
```

`lib/camera-connection/claim-camera-ingest-job.agency.test.ts` (fija que el cron nunca toma un job en espera):

```ts
import { describe, expect, it, vi } from "vitest";
import { claimNextCameraIngestJob } from "./claim-camera-ingest-job";

describe("claimNextCameraIngestJob", () => {
  it("sólo toma trabajos PENDING (un AWAITING_FILTER nunca se procesa sin la señal)", async () => {
    const queryRaw = vi.fn(async () => []);
    await claimNextCameraIngestJob({ $queryRaw: queryRaw } as any);
    const sql = (queryRaw.mock.calls[0] as unknown as [TemplateStringsArray])[0].join("?");
    expect(sql).toContain("WHERE status = 'PENDING'");
    expect(sql).not.toContain("AWAITING_FILTER");
  });
});
```

En `lib/agencies/ftp-login.test.ts`:
- agregar `const awaitsFilterMock = vi.fn();` y `vi.mock("@/lib/agencies/publish-mode", () => ({ agencyAwaitsFilter: (...a: unknown[]) => awaitsFilterMock(...a) }));`
- en el `beforeEach`: sumar `awaitsFilterMock` a la lista de `mockReset()` y `awaitsFilterMock.mockResolvedValue(false);`
- en los dos `toEqual` de éxito de `resolveAgencyFtpUpload` (hoy `{ ok: true, albumId: 50, declaredPoint: {...} }` y `{ ok: true, albumId: 51, declaredPoint: null }`) agregar `awaitFilter: false`.
- agregar el caso:

```ts
  it("agencia que espera al filtro: lo avisa para encolar en espera", async () => {
    validateAlbum.mockResolvedValue({ ok: true, album: { id: 50 } });
    presenceFindUnique.mockResolvedValue(null);
    awaitsFilterMock.mockResolvedValue(true);
    expect(await resolveAgencyFtpUpload(login, new Date())).toMatchObject({ ok: true, awaitFilter: true });
    expect(awaitsFilterMock).toHaveBeenCalledWith(3);
  });
```

(`login` es la constante que ya define el `describe("resolveAgencyFtpUpload")` con `agencyId: 3`; si en el archivo tiene otro nombre, usar ese.)

Agregar al `include` de `vitest.bot.config.ts`: `"app/api/internal/agency-filter/**/*.test.ts"`, `"lib/camera-connection/create-camera-upload-log-and-enqueue.agency.test.ts"`, `"lib/camera-connection/claim-camera-ingest-job.agency.test.ts"`.

- [ ] **Step 2:** Correr `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies lib/camera-connection app/api/internal/agency-filter` → FAIL (falta `filter-signal`, la ruta, `awaitFilter`). El test de `claim` pasa desde el principio: es un candado, no una función nueva.

- [ ] **Step 3: Implementación.**

`lib/agencies/filter-signal.ts`:

```ts
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { deleteFromR2 } from "@/lib/r2-client";
import { CAMERA_UPLOAD_LOG_STATUS } from "@/lib/camera-connection/camera-connection-types";

/**
 * Señal del filtro de la nube (spec, "Encaje con el filtrado"; D13). Con `Agency.publishMode = AWAIT_FILTER` el job
 * de ingesta nace AWAITING_FILTER y el cron no lo toma. El filtro (se diseña aparte) manda, firmado:
 * APPROVED → PENDING (se procesa y publica como siempre); REJECTED → se cierra con nota y se borra el raw.
 * Firma: `x-dnx-firma: t=<segundos>,v1=<HMAC-SHA256(AGENCY_FILTER_SIGNAL_SECRET, "<t>.<cuerpo>") hex>`, 5 minutos.
 */

export const FILTER_SIGNATURE_HEADER = "x-dnx-firma";
export const FILTER_SIGNATURE_TOLERANCE_S = 300;
export const FILTER_REJECTED_NOTE = "Descartada por el filtro";
export const MAX_FILTER_DECISIONS = 100;

export function signFilterBody(secret: string, t: number, body: string): string {
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${v1}`;
}

export function verifyFilterSignature(secret: string | undefined, header: string | null, body: string, nowMs: number): boolean {
  const s = secret?.trim();
  if (!s || !header) return false;
  const m = /^t=(\d{1,12}),v1=([a-f0-9]{64})$/.exec(header.trim());
  if (!m) return false;
  const t = Number(m[1]);
  if (Math.abs(nowMs / 1000 - t) > FILTER_SIGNATURE_TOLERANCE_S) return false;
  const expected = Buffer.from(signFilterBody(s, t, body).split("v1=")[1], "hex");
  const received = Buffer.from(m[2], "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export type FilterDecision = { jobId: string; decision: "APPROVED" | "REJECTED" };

export function parseFilterDecisions(v: unknown): { ok: true; decisions: FilterDecision[] } | { ok: false; error: string } {
  if (!Array.isArray(v) || v.length < 1 || v.length > MAX_FILTER_DECISIONS) {
    return { ok: false, error: `Mandá entre 1 y ${MAX_FILTER_DECISIONS} decisiones.` };
  }
  const decisions: FilterDecision[] = [];
  for (const raw of v as unknown[]) {
    const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    if (typeof r.jobId !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(r.jobId)) return { ok: false, error: "jobId inválido." };
    if (r.decision !== "APPROVED" && r.decision !== "REJECTED") return { ok: false, error: "decision tiene que ser APPROVED o REJECTED." };
    decisions.push({ jobId: r.jobId, decision: r.decision });
  }
  return { ok: true, decisions };
}

export async function applyFilterDecisions(
  decisions: FilterDecision[]
): Promise<Array<{ jobId: string; result: "approved" | "rejected" | "not_waiting" }>> {
  const results: Array<{ jobId: string; result: "approved" | "rejected" | "not_waiting" }> = [];
  for (const d of decisions) {
    if (d.decision === "APPROVED") {
      const r = await prisma.cameraIngestJob.updateMany({
        where: { id: d.jobId, status: "AWAITING_FILTER" },
        data: { status: "PENDING", runAfter: null, lastError: null },
      });
      results.push({ jobId: d.jobId, result: r.count === 1 ? "approved" : "not_waiting" });
      continue;
    }
    const job = await prisma.cameraIngestJob.findFirst({
      where: { id: d.jobId, status: "AWAITING_FILTER" },
      select: { id: true, rawKey: true, uploadLogId: true },
    });
    if (!job) {
      results.push({ jobId: d.jobId, result: "not_waiting" });
      continue;
    }
    const r = await prisma.cameraIngestJob.updateMany({
      where: { id: job.id, status: "AWAITING_FILTER" },
      data: { status: "COMPLETED", completedAt: new Date(), lastError: FILTER_REJECTED_NOTE, lockedAt: null, runAfter: null },
    });
    if (r.count !== 1) {
      results.push({ jobId: d.jobId, result: "not_waiting" });
      continue;
    }
    await deleteFromR2(job.rawKey).catch(() => undefined);
    if (job.uploadLogId != null) {
      await prisma.cameraUploadLog
        .update({ where: { id: job.uploadLogId }, data: { status: CAMERA_UPLOAD_LOG_STATUS.REJECTED, errorMessage: FILTER_REJECTED_NOTE } })
        .catch(() => undefined);
    }
    results.push({ jobId: d.jobId, result: "rejected" });
  }
  return results;
}
```

Nota: el test mockea `@/lib/prisma` y `@/lib/r2-client`; `camera-connection-types` es puro (sin base) y se importa real.

`app/api/internal/agency-filter/decisions/route.ts`:

```ts
import { NextResponse } from "next/server";
import {
  FILTER_SIGNATURE_HEADER,
  applyFilterDecisions,
  parseFilterDecisions,
  verifyFilterSignature,
} from "@/lib/agencies/filter-signal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Señal interna firmada del filtro de la nube: aprueba o descarta fotos de agencias en espera. */
export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyFilterSignature(process.env.AGENCY_FILTER_SIGNAL_SECRET, request.headers.get(FILTER_SIGNATURE_HEADER), raw, Date.now())) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = parseFilterDecisions((body as { decisions?: unknown } | null)?.decisions);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const results = await applyFilterDecisions(parsed.decisions);
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
```

En `lib/agencies/ftp-login.ts`, `resolveAgencyFtpUpload`: importar `agencyAwaitsFilter` de `@/lib/agencies/publish-mode`; cambiar el tipo de éxito a `{ ok: true; albumId: number; declaredPoint: { lat: number; lng: number } | null; awaitFilter: boolean }` y el `return` final a:

```ts
  const awaitFilter = await agencyAwaitsFilter(login.agencyId);
  return { ok: true, albumId: current.albumId, declaredPoint: activePresencePoint(presence, receivedAt), awaitFilter };
```

En `lib/camera-connection/create-camera-upload-log-and-enqueue.ts`: agregar al input

```ts
  /** Modo agencia: la agencia espera al filtro de la nube (el job nace AWAITING_FILTER). */
  awaitFilter?: boolean;
```

y en `tx.cameraIngestJob.create`, cambiar `status: "PENDING",` por `status: input.awaitFilter ? "AWAITING_FILTER" : "PENDING",`.

En `apps/compramelafoto-workers/camera-ftp-gateway/src/handle-upload.ts`: junto a `let declaredPoint …` declarar `let awaitFilter = false;`; después de `declaredPoint = agencyDest.declaredPoint;` agregar `awaitFilter = agencyDest.awaitFilter;`; en el objeto de `auth.agency ? { … }` que se pasa a `createCameraUploadLogAndEnqueue` agregar `awaitFilter,`. Nada más cambia para usuarios viejos.

Agregar `AGENCY_FILTER_SIGNAL_SECRET=` (sin valor) al final de `apps/compramelafoto/.env.example`, con el comentario `# Modo agencia: secreto de la señal del filtro de la nube (sólo en Vercel; vacío = la señal responde 401)`.

- [ ] **Step 4:** Correr `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts` (toda la suite bot) → PASS. Gateway: `cd apps/compramelafoto-workers/camera-ftp-gateway && pnpm typecheck && pnpm test` → exit 0. `NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck; echo exit=$?` en `apps/compramelafoto` → `exit=0` sin `error TS`.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies apps/compramelafoto/lib/camera-connection apps/compramelafoto/app/api/internal/agency-filter apps/compramelafoto/vitest.bot.config.ts apps/compramelafoto-workers/camera-ftp-gateway/src/handle-upload.ts
git add apps/compramelafoto/.env.example
git commit -m "Modo agencia: espera del filtro de la nube con señal firmada (FLUX y FTP)"
```

---

### Task 9: Tarjeta "Subir desde la computadora (DNX FLUX)" en Mis agencias

**Files:**
- Create: `apps/compramelafoto/components/agencies/FluxDevicesCard.tsx`
- Modify: `apps/compramelafoto/app/fotografo/agencias/mis-agencias/[agencyId]/camara/page.tsx` (título y tarjeta)
- Modify: `apps/compramelafoto/app/fotografo/agencias/mis-agencias/page.tsx` (texto del botón)

**Interfaces:**
- Consumes: `GET`/`POST /api/fotografo/agencias/flux`, `DELETE /api/fotografo/agencias/flux/{id}` (Task 3); `Card`, `Button` (`@/components/ui/*`).
- Produces: `<FluxDevicesCard />` (sin props).

- [ ] **Step 1: Componente** `components/agencies/FluxDevicesCard.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Device = { id: number; label: string; keyPrefix: string; createdAt: string; lastUsedAt: string | null };

const TZ = "America/Argentina/Buenos_Aires";
const API = "/api/fotografo/agencias/flux";

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** Vincular DNX FLUX con un código corto y ver/desvincular las computadoras (sirven para todas tus agencias). */
export default function FluxDevicesCard() {
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(API, { credentials: "include" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) return setError(d.error || "No pudimos cargar tus computadoras vinculadas.");
    setDevices(d.devices ?? []);
  }, []);

  useEffect(() => {
    load().catch(() => setError("No pudimos cargar tus computadoras vinculadas."));
  }, [load]);

  useEffect(() => {
    if (!code) return;
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [code]);

  const expired = code ? new Date(code.expiresAt).getTime() <= now : false;

  async function newCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API, { method: "POST", credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setError(d.error || "No pudimos generar el código.");
      setCode({ code: d.code, expiresAt: d.expiresAt });
      setNow(Date.now());
    } catch {
      setError("No pudimos generar el código.");
    } finally {
      setBusy(false);
    }
  }

  async function unlink(d: Device) {
    if (!confirm(`¿Desvincular "${d.label}"? DNX FLUX deja de poder subir desde esa computadora hasta que la vuelvas a vincular.`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API}/${d.id}`, { method: "DELETE", credentials: "include" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || "No pudimos desvincular esa computadora.");
      await load();
    } catch {
      setError("No pudimos desvincular esa computadora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-xl font-medium text-[#1a1a1a]">Subir desde la computadora (DNX FLUX)</h2>
        <p className="mt-1 text-sm text-gray-600">
          Poné la tarjeta de la cámara en tu computadora y DNX FLUX sube las fotos solas al álbum de la agencia, a tu
          nombre. Vinculás la computadora una sola vez y sirve para todas las agencias en las que estás.
        </p>
      </div>

      {code && !expired ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
          <p>1. Abrí DNX FLUX en tu computadora y elegí <strong>Vincular con ComprameLaFoto</strong>.</p>
          <p>2. Escribí este código:</p>
          <p className="my-2 font-mono text-3xl tracking-widest text-[#1a1a1a]">{code.code}</p>
          <p className="text-gray-600">Vence a las {fmtTime(code.expiresAt)} y sirve una sola vez.</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { setCode(null); load(); }}>Ya lo vinculé</Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {code && expired && <p className="text-sm text-amber-700">El código venció. Generá uno nuevo.</p>}
          <Button size="sm" onClick={newCode} disabled={busy}>Vincular una computadora</Button>
        </div>
      )}

      <div>
        <h3 className="text-sm font-medium text-[#1a1a1a]">Computadoras vinculadas</h3>
        {devices === null ? (
          <p className="text-sm text-gray-500">Cargando…</p>
        ) : devices.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no vinculaste ninguna.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-xl border">
            {devices.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm">
                <div>
                  <p className="font-medium">{d.label}</p>
                  <p className="text-gray-500">
                    Vinculada el {fmtDateTime(d.createdAt)} · {d.lastUsedAt ? `Último uso: ${fmtDateTime(d.lastUsedAt)}` : "Sin usar todavía"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => unlink(d)} disabled={busy}>Desvincular</Button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}
```

- [ ] **Step 2: Página.** En `app/fotografo/agencias/mis-agencias/[agencyId]/camara/page.tsx`:
  - `import FluxDevicesCard from "@/components/agencies/FluxDevicesCard";`
  - Cambiar el `AgencyPageFrame` a `title="Cámara, DNX FLUX y ubicación"` y `subtitle="Subí tus fotos desde la cámara o desde la computadora, y avisá dónde estás trabajando hoy."`.
  - Renderizar `<FluxDevicesCard />` justo **después** de la tarjeta de FTP y **antes** de "Estoy acá" (sólo cuando la agencia cargó sin `loadError`, igual que las otras dos tarjetas).
  - En `app/fotografo/agencias/mis-agencias/page.tsx`, cambiar el texto del botón `Cámara y ubicación` por `Cámara, DNX FLUX y ubicación`.

- [ ] **Step 3:** `NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck; echo exit=$?` → `exit=0` sin `error TS`. Si se puede, probar a mano con `next dev --webpack` (memoria: en worktree, `--webpack`) logueado como miembro de una agencia de prueba: generar código, ver que vence a los 10 minutos en hora argentina, y que "Desvincular" pide confirmación. Si no hay base local, dejarlo dicho en el PR.

- [ ] **Step 4: Commit**

```bash
git add apps/compramelafoto/components/agencies/FluxDevicesCard.tsx "apps/compramelafoto/app/fotografo/agencias/mis-agencias"
git commit -m "Modo agencia: tarjeta para vincular DNX FLUX en Mis agencias"
```

---

### Task 10: Migración en producción, PR y verificación

- [ ] **Step 1: Todo en verde.** Desde `apps/compramelafoto`: `../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts` → PASS; `pnpm test:analysis` → PASS (no se tocó, pero comparte la fila); `NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck; echo exit=$?` → `exit=0` sin `error TS`/`FATAL`. Gateway: `cd ../compramelafoto-workers/camera-ftp-gateway && pnpm typecheck && pnpm test`.

- [ ] **Step 2: Traer `origin/main`.** `git fetch origin && git merge origin/main`. Si entró otra migración con fecha `20261125…` o posterior, no importa el orden (esta es aditiva e independiente); si chocara el nombre exacto, renombrar la carpeta al día libre siguiente. Volver a correr Step 1.

- [ ] **Step 3: Checksum.** `shasum -a 256 packages/db/prisma/migrations/20261125120000_clf_agencia_flux/migration.sql` → anotar el hex (es el `checksum` de `_prisma_migrations`).

- [ ] **Step 4: Producción de CLF** (proyecto Neon `divine-hall-10689679`, rama `br-autumn-rain-ad18wq7y`, siempre con `branch_id` explícito):
  1. Antes: `SELECT to_regclass('"CameraIngestJob"'), to_regclass('"AgencyMember"'), (SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname IN ('AlbumPhotoIngestSource','CameraIngestJobStatus'));` → las dos tablas existen.
  2. Aplicar el archivo completo (con `run_sql_transaction`, anteponiendo `SET LOCAL lock_timeout = '5s';`). Si Neon rechaza `ALTER TYPE … ADD VALUE` dentro del bloque `DO`, correr esas dos sentencias sueltas fuera de la transacción: `ALTER TYPE "AlbumPhotoIngestSource" ADD VALUE IF NOT EXISTS 'FLUX';` y `ALTER TYPE "CameraIngestJobStatus" ADD VALUE IF NOT EXISTS 'AWAITING_FILTER';`.
  3. Registrar: `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (gen_random_uuid()::text, '<sha256 del Step 3>', now(), '20261125120000_clf_agencia_flux', NULL, NULL, now(), 1);` (sólo si no existe ya una fila con ese `migration_name`).
  4. Verificar: las tres tablas con sus índices únicos (`\d`-equivalente vía `describe_table_schema`), la columna `CameraIngestJob.agencyDeviceKeyId`, los valores `FLUX` y `AWAITING_FILTER` en `pg_enum`, las tres claves foráneas en `pg_constraint`, y la fila en `_prisma_migrations`. Confirmar que no cambió ninguna fila: `SELECT status, count(*) FROM "CameraIngestJob" GROUP BY 1;` antes y después da lo mismo.

- [ ] **Step 5: Las otras bases, sólo lo que aplica** (`CameraIngestJob` y sus enums existen **sólo** en producción de CLF):
  - development de CLF (`divine-hall-10689679`, rama `br-old-rain-adwthzng`), `bitter-math-56019731`, `wandering-pine-79918137`, `cold-silence-10115969` (con su rama por defecto, `branch_id` explícito obtenido con `get_default_branch`).
  - En cada una, primero `SELECT to_regclass('"User"'), to_regclass('"CameraIngestJob"');`. Si existe `"User"`, aplicar el archivo entero: los bloques `DO` de `CameraIngestJob` y de los enums no hacen nada donde no existen. Si no existe `"User"`, no aplicar nada y anotarlo.
  - **No registrar** en `_prisma_migrations` las bases donde la parte de `CameraIngestJob`/enums no se aplicó (quedó parcial). Si alguna resultara tener `CameraIngestJob` y quedó completa, ahí sí registrar con el mismo checksum.
  - Anotar en el PR, base por base: qué se aplicó y si quedó registrada.

- [ ] **Step 6: PR.** `git push -u origin feat/clf-agencia-etapa-3a` y `gh pr create` con título "Modo agencia etapa 3a: puerta de DNX FLUX en CLF" y cuerpo en español que diga: qué hace; contrato HTTP para la sesión de DNX FLUX (3b): `POST /api/agency-ingest/v1/link {code, deviceName}` → `{deviceKey}`; `GET /me`; `POST /batches {agencyId, albumId, placeId | lat,lng, files:[{name,size,contentType,sha256?}]}` → `{files:[{uploadId,uploadUrl,method,headers,expiresInSeconds} | {alreadyThere:true}]}`; `PUT` a `uploadUrl` con `Content-Type: image/jpeg`; `POST /photos/{uploadId}/confirm` → `{ok,state}`; códigos 401/403/409/422/429/503 y qué hacer con cada uno (409 = volver a subir con una tanda nueva, 422 = achicar, 429 = esperar `Retry-After`); que `publishMode` queda sólo en la base; que la subida web del miembro no respeta `AWAIT_FILTER`; las bases migradas y registradas; y terminar con la línea `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 7: CI y fusión.** Esperar los chequeos (`chequeos.yml`: tipos y tests). En verde, fusionar (squash o merge según la costumbre del repo) y esperar el deploy de `compramelafoto-dnxsuite` en Vercel.

- [ ] **Step 8: Verificar producción** (sin credenciales):
  - `curl -s -o /dev/null -w "%{http_code}\n" https://compramelafoto.com/api/agency-ingest/v1/me` → `401`
  - `curl -s -o /dev/null -w "%{http_code}\n" -X POST -H 'content-type: application/json' -d '{}' https://compramelafoto.com/api/agency-ingest/v1/batches` → `401`
  - `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://compramelafoto.com/api/agency-ingest/v1/photos/x/confirm` → `401`
  - `curl -s -o /dev/null -w "%{http_code}\n" -X POST -d '{"decisions":[]}' https://compramelafoto.com/api/internal/agency-filter/decisions` → `401`
  - `curl -s -o /dev/null -w "%{http_code}\n" https://compramelafoto.com/api/fotografo/agencias/flux` → `401`
  - `curl -s -w "\n%{http_code}\n" -X POST -H 'content-type: application/json' -d '{"code":"AAAA-AAAA"}' https://compramelafoto.com/api/agency-ingest/v1/link` → `400` con el mensaje "El código no es válido o ya venció…" (prueba que la tabla existe y la ruta está viva).
  - Si alguna responde 404 o el contenido viejo, mirar el encabezado `age:` (el CDN cachea) antes de dudar del deploy.
  - Avisar a la sesión de DNX FLUX (3b) que el contrato está en producción.
