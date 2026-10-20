# Modo agencia — Etapa 2a (el equipo sube fotos con ubicación) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un fotógrafo del equipo pueda subir fotos desde la web al álbum de su agencia (desde "Mis agencias"), que cada foto de un álbum de agencia guarde su ubicación (GPS de la cámara o el punto que eligió el fotógrafo), que una misma foto subida dos veces no se duplique y que el análisis facial atienda primero a los álbumes de agencia.

**Architecture:** Columnas nuevas y opcionales en `Photo` (migración aditiva aplicada a mano en las cinco bases ANTES del deploy). Datos de la foto (huella sha256, número de serie y número de imagen de la cámara, GPS) en `lib/agencies/photo-facts.ts`. `finalizeAlbumPhotoFromRaw` sólo cambia su conducta para álbumes de agencia (ubicación + repetidas); los álbumes comunes siguen idénticos. La ruta `direct-upload/complete` acepta el punto declarado. Prioridad del análisis: antes de la toma FIFO de siempre se toma hasta la mitad del lote de fotos de álbumes de agencia. Página nueva del miembro para subir, con un hook propio (no se toca la página de 2.952 líneas del dueño). FTP por miembro y DNX FLUX: fuera de esta etapa (2b y 3).

**Tech Stack:** Next.js App Router (`params` como `Promise`), Prisma (`@repo/db` vía `@/lib/prisma`), PostgreSQL Neon, exifr, vitest (`../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts`), Tailwind.

**Spec:** `docs/superpowers/specs/2026-10-18-clf-modo-agencia-design.md` (Parte 2: ubicación, repetidas, prioridad; D4, D5, D9).

## Global Constraints

- Todo texto visible en español rioplatense, claro y no técnico.
- **Los álbumes que NO son de agencia se comportan exactamente igual que antes** (sin huella, sin ubicación, sin descarte de repetidas, misma respuesta de la API).
- Ubicación de cada foto de agencia: **GPS de la foto si lo trae (`geoSource = "EXIF_GPS"`)**; si no, **el punto declarado por el fotógrafo (`"DECLARED"`)**; si no hay ninguno, sin ubicación.
- Repetida = misma `contentSha256` en el mismo álbum, **o** mismo `cameraSerial` + `cameraImageNumber` + `capturedAt` en el mismo álbum. La segunda copia no crea `Photo` y su archivo raw se borra.
- Prioridad del análisis: hasta `Math.ceil(lote / 2)` trabajos de álbumes de agencia por ronda, el resto FIFO como siempre (nunca se deja sin turno al resto).
- Migración aditiva `20261122120000_clf_agencia_fotos`: sólo `ADD COLUMN IF NOT EXISTS` (nullable) y `CREATE INDEX IF NOT EXISTS`. Se aplica a mano en las cinco bases (CLF production, development, Clickatón, InfoSpot, compramelafoto-staging) **antes** de fusionar, y se registra con su checksum.
- El miembro necesita su Mercado Pago conectado para subir (regla existente `ensureMpConnected`); la página lo dice y enlaza a `/fotografo/configuracion?tab=mercadopago`.
- Trabajar en el worktree `/Users/danielcuart/Desktop/PROGRAMACIONES/wt-clf-agencia-2` (rama `feat/clf-agencia-etapa-2a`).

## Review Focus

1. **Subir a un álbum común (no de agencia):** misma respuesta y mismas columnas que antes; no se calcula huella ni se descarta nada. Test en Task 3.
2. **Subir dos veces la misma foto a un álbum de agencia** (mismo archivo, o la misma toma reexportada con otro tamaño): la segunda responde `duplicate: true`, no crea `Photo`, borra el raw. Tests en Task 2 y Task 3.
3. **Foto sin EXIF / con EXIF roto / con GPS (0,0):** no rompe la subida; (0,0) no cuenta como GPS. Tests en Task 2.
4. **Punto declarado inválido** (`"abc"`, lat 200, sólo lat sin lng): se ignora el punto y la foto se crea sin ubicación declarada, nunca 500. Tests en Task 3.
5. **Ráfaga de 10.000 fotos de agencia en la cola:** los álbumes comunes siguen recibiendo turno en cada ronda. Test en Task 4.

---

## File Structure

```
packages/db/prisma/schema.prisma                                        (modificar: 7 columnas + 2 índices en Photo)
packages/db/prisma/migrations/20261122120000_clf_agencia_fotos/migration.sql (crear)

apps/compramelafoto/lib/agencies/photo-facts.ts          huella, datos de cámara, GPS y elección de ubicación
apps/compramelafoto/lib/agencies/photo-facts.test.ts
apps/compramelafoto/lib/albums/finalize-album-photo-from-raw.ts         (modificar: rama de agencia)
apps/compramelafoto/lib/albums/finalize-album-photo-from-raw.agency.test.ts
apps/compramelafoto/app/api/dashboard/albums/[id]/photos/direct-upload/complete/route.ts (modificar)
apps/compramelafoto/app/api/dashboard/albums/[id]/photos/direct-upload/complete/route.agency.test.ts
apps/compramelafoto/lib/analysis/agency-priority.ts       toma prioritaria de trabajos de agencia
apps/compramelafoto/lib/analysis/agency-priority.test.ts
apps/compramelafoto/lib/analysis/analysis-runner.ts      (modificar claimJobsAtomic)
apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/route.ts     (modificar: albumId)
apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/[agencyId]/lugares/route.ts (crear)
apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/albumes/route.ts (modificar DELETE: orden de chequeos)
apps/compramelafoto/lib/agencies/use-agency-photo-upload.ts   hook de subida del miembro
apps/compramelafoto/app/fotografo/agencias/mis-agencias/[agencyId]/subir/page.tsx
apps/compramelafoto/app/fotografo/agencias/mis-agencias/page.tsx        (modificar: botón Subir fotos)
apps/compramelafoto/vitest.bot.config.ts                                 (modificar include)
```

---

### Task 1: Columnas de foto y migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `Photo`, ~línea 3172)
- Create: `packages/db/prisma/migrations/20261122120000_clf_agencia_fotos/migration.sql`

**Interfaces:**
- Produces: campos de `Photo`: `geoLat Float?`, `geoLng Float?`, `geoSource String?`, `originalFilename String?`, `contentSha256 String?`, `cameraSerial String?`, `cameraImageNumber Int?`; índices `@@index([albumId, contentSha256])`, `@@index([albumId, cameraSerial, cameraImageNumber])`.

- [ ] **Step 1: Instalar dependencias del worktree**

Run: `cd /Users/danielcuart/Desktop/PROGRAMACIONES/wt-clf-agencia-2 && pnpm install --frozen-lockfile`
Expected: termina sin errores (postinstall genera Prisma).

- [ ] **Step 2: Agregar las columnas al modelo `Photo`**

Dentro de `model Photo {`, después de `capturedAt               DateTime?`, agregar:

```prisma
  /// Modo agencia: ubicación de la toma. EXIF_GPS (de la cámara) | DECLARED (la eligió el fotógrafo).
  geoLat                   Float?
  geoLng                   Float?
  geoSource                String?
  /// Modo agencia: nombre del archivo en la cámara (p. ej. DSC_1234.JPG) y datos para detectar repetidas.
  originalFilename         String?
  contentSha256            String?
  cameraSerial             String?
  cameraImageNumber        Int?
```

y, junto a los demás `@@index` del modelo:

```prisma
  @@index([albumId, contentSha256])
  @@index([albumId, cameraSerial, cameraImageNumber])
```

- [ ] **Step 3: Escribir la migración**

Create `packages/db/prisma/migrations/20261122120000_clf_agencia_fotos/migration.sql`:

```sql
-- Modo agencia de CompraMeLaFoto (etapa 2a): ubicación y datos para detectar repetidas en cada foto.
-- Sólo agrega columnas opcionales a "Photo" y dos índices: no toca filas existentes. El schema es compartido:
-- se aplica a mano en las cinco bases ANTES del deploy (si falta la columna, Prisma rompe todas las lecturas
-- de Photo) y se registra con el checksum del archivo.

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "geoLat" DOUBLE PRECISION;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "geoLng" DOUBLE PRECISION;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "geoSource" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "originalFilename" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "contentSha256" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "cameraSerial" TEXT;
ALTER TABLE "Photo" ADD COLUMN IF NOT EXISTS "cameraImageNumber" INTEGER;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Photo_albumId_contentSha256_idx" ON "Photo"("albumId", "contentSha256");
CREATE INDEX IF NOT EXISTS "Photo_albumId_cameraSerial_cameraImageNumber_idx" ON "Photo"("albumId", "cameraSerial", "cameraImageNumber");
```

- [ ] **Step 4: Validar**

Run: `cd packages/db && DATABASE_URL=postgresql://x:x@localhost/x DIRECT_URL=postgresql://x:x@localhost/x pnpm exec prisma validate && pnpm exec prisma generate`
Expected: schema válido y cliente generado. Comparar a ojo nombres y tipos del Step 2 con el Step 3 (Prisma llama a los índices `Photo_albumId_contentSha256_idx` y `Photo_albumId_cameraSerial_cameraImageNumber_idx`).

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261122120000_clf_agencia_fotos
git commit -m "Modo agencia: ubicación y datos de repetidas en cada foto"
```

---

### Task 2: Datos de la foto (huella, cámara, GPS, ubicación)

**Files:**
- Create: `apps/compramelafoto/lib/agencies/photo-facts.ts`
- Create: `apps/compramelafoto/lib/agencies/photo-facts.test.ts`

**Interfaces:**
- Produces:
  - `type PhotoFacts = { contentSha256: string; cameraSerial: string | null; cameraImageNumber: number | null; exifLat: number | null; exifLng: number | null }`
  - `sha256Hex(buffer: Buffer): string`
  - `parseImageNumber(raw: unknown): number | null` (acepta `1234`, `"1234"`, `"100-1234"` → 1001234; rechaza negativos, 0 y no numéricos)
  - `cameraFactsFromExif(exif: Record<string, unknown> | null | undefined): { cameraSerial: string | null; cameraImageNumber: number | null; exifLat: number | null; exifLng: number | null }` — serial de `BodySerialNumber` ?? `SerialNumber` ?? `InternalSerialNumber` (texto recortado, sin vacíos); número de `ImageNumber` ?? `FileNumber`; GPS de `latitude`/`longitude` sólo si son finitos, dentro de ±90/±180 y no (0,0)
  - `imageNumberFromFilename(name: string | null | undefined): number | null` — `DSC_1234.JPG`, `IMG_0042.jpg`, `_MG_9876.JPG`, `DSCF5555.JPG` → número; otro formato → null
  - `extractPhotoFacts(buffer: Buffer, originalFilename?: string | null): Promise<PhotoFacts>` — lee EXIF con exifr (`gps: true`, `makerNote: false`), nunca lanza; si el EXIF no trae número de imagen usa `imageNumberFromFilename`
  - `parseDeclaredPoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null` — números o textos con punto/coma, ambos presentes, dentro de rango y no (0,0)
  - `resolvePhotoLocation(facts: { exifLat: number | null; exifLng: number | null }, declared: { lat: number; lng: number } | null): { geoLat: number; geoLng: number; geoSource: "EXIF_GPS" | "DECLARED" } | null`

- [ ] **Step 1: Write the failing test**

Create `apps/compramelafoto/lib/agencies/photo-facts.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const exifrParse = vi.fn();
vi.mock("exifr", () => ({ default: { parse: (...a: unknown[]) => exifrParse(...a) } }));

import {
  cameraFactsFromExif,
  extractPhotoFacts,
  imageNumberFromFilename,
  parseDeclaredPoint,
  parseImageNumber,
  resolvePhotoLocation,
  sha256Hex,
} from "./photo-facts";

beforeEach(() => exifrParse.mockReset());

describe("sha256Hex", () => {
  it("devuelve la huella en hexadecimal", () => {
    expect(sha256Hex(Buffer.from("hola"))).toBe("b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79");
  });
});

describe("parseImageNumber", () => {
  it("acepta números y textos de cámara", () => {
    expect(parseImageNumber(1234)).toBe(1234);
    expect(parseImageNumber("1234")).toBe(1234);
    expect(parseImageNumber("100-1234")).toBe(1001234);
  });
  it("rechaza lo que no sirve", () => {
    for (const bad of [0, -3, "abc", "", null, undefined, 1.5]) expect(parseImageNumber(bad)).toBe(null);
  });
});

describe("cameraFactsFromExif", () => {
  it("toma serial, número y GPS", () => {
    expect(
      cameraFactsFromExif({ BodySerialNumber: " 4021234 ", ImageNumber: 77, latitude: -38.0, longitude: -57.55 })
    ).toEqual({ cameraSerial: "4021234", cameraImageNumber: 77, exifLat: -38.0, exifLng: -57.55 });
  });
  it("cae a SerialNumber y FileNumber", () => {
    expect(cameraFactsFromExif({ SerialNumber: "X1", FileNumber: "100-0042" })).toMatchObject({
      cameraSerial: "X1",
      cameraImageNumber: 1000042,
    });
  });
  it("GPS (0,0) o fuera de rango no cuenta", () => {
    expect(cameraFactsFromExif({ latitude: 0, longitude: 0 })).toMatchObject({ exifLat: null, exifLng: null });
    expect(cameraFactsFromExif({ latitude: 200, longitude: 10 })).toMatchObject({ exifLat: null, exifLng: null });
  });
  it("sin EXIF devuelve todo null", () => {
    expect(cameraFactsFromExif(null)).toEqual({ cameraSerial: null, cameraImageNumber: null, exifLat: null, exifLng: null });
    expect(cameraFactsFromExif({ SerialNumber: "   " }).cameraSerial).toBe(null);
  });
});

describe("imageNumberFromFilename", () => {
  it("reconoce los nombres típicos", () => {
    expect(imageNumberFromFilename("DSC_1234.JPG")).toBe(1234);
    expect(imageNumberFromFilename("IMG_0042.jpg")).toBe(42);
    expect(imageNumberFromFilename("_MG_9876.JPG")).toBe(9876);
    expect(imageNumberFromFilename("DSCF5555.JPG")).toBe(5555);
  });
  it("otro formato: null", () => {
    expect(imageNumberFromFilename("foto final.jpg")).toBe(null);
    expect(imageNumberFromFilename(null)).toBe(null);
  });
});

describe("extractPhotoFacts", () => {
  it("combina EXIF y huella", async () => {
    exifrParse.mockResolvedValue({ SerialNumber: "S9", ImageNumber: 5, latitude: -38.01, longitude: -57.53 });
    const facts = await extractPhotoFacts(Buffer.from("hola"), "DSC_0001.JPG");
    expect(facts).toEqual({
      contentSha256: "b221d9dbb083a7f33428d7c2a3c3198ae925614d70210e28716ccaa7cd4ddb79",
      cameraSerial: "S9",
      cameraImageNumber: 5,
      exifLat: -38.01,
      exifLng: -57.53,
    });
    expect(exifrParse.mock.calls[0][1]).toMatchObject({ gps: true });
  });
  it("sin número en EXIF usa el del nombre de archivo", async () => {
    exifrParse.mockResolvedValue({ SerialNumber: "S9" });
    expect((await extractPhotoFacts(Buffer.from("x"), "DSC_0099.JPG")).cameraImageNumber).toBe(99);
  });
  it("si exifr falla, no lanza", async () => {
    exifrParse.mockRejectedValue(new Error("roto"));
    const facts = await extractPhotoFacts(Buffer.from("x"), null);
    expect(facts).toMatchObject({ cameraSerial: null, cameraImageNumber: null, exifLat: null, exifLng: null });
    expect(facts.contentSha256).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("parseDeclaredPoint y resolvePhotoLocation", () => {
  it("parsea puntos válidos e ignora los malos", () => {
    expect(parseDeclaredPoint(-38.0, -57.5)).toEqual({ lat: -38.0, lng: -57.5 });
    expect(parseDeclaredPoint("-38,0", "-57,5")).toEqual({ lat: -38.0, lng: -57.5 });
    for (const [a, b] of [["abc", 1], [200, 1], [-38, null], [0, 0], [undefined, undefined]]) {
      expect(parseDeclaredPoint(a, b)).toBe(null);
    }
  });
  it("manda el GPS; si no, el declarado; si no, nada", () => {
    const declared = { lat: -38.1, lng: -57.6 };
    expect(resolvePhotoLocation({ exifLat: -38.0, exifLng: -57.5 }, declared)).toEqual({ geoLat: -38.0, geoLng: -57.5, geoSource: "EXIF_GPS" });
    expect(resolvePhotoLocation({ exifLat: null, exifLng: null }, declared)).toEqual({ geoLat: -38.1, geoLng: -57.6, geoSource: "DECLARED" });
    expect(resolvePhotoLocation({ exifLat: null, exifLng: null }, null)).toBe(null);
  });
});
```

- [ ] **Step 2: Registrar tests y verlo fallar**

En `apps/compramelafoto/vitest.bot.config.ts`, dentro de `include: [`, agregar:

```ts
      "lib/albums/finalize-album-photo-from-raw.agency.test.ts",
      "app/api/dashboard/albums/*/photos/direct-upload/complete/route.agency.test.ts",
      "lib/analysis/agency-priority.test.ts",
```

(`lib/agencies/**/*.test.ts` y `app/api/fotografo/agencias/**/*.test.ts` ya están.)

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/photo-facts.test.ts`
Expected: FAIL (no existe `./photo-facts`).

- [ ] **Step 3: Write minimal implementation**

Create `apps/compramelafoto/lib/agencies/photo-facts.ts`:

```ts
import { createHash } from "crypto";
import exifr from "exifr";

/** Datos de una foto de agencia para ubicarla y detectar repetidas. Nada de esto lanza. */

export type PhotoFacts = {
  contentSha256: string;
  cameraSerial: string | null;
  cameraImageNumber: number | null;
  exifLat: number | null;
  exifLng: number | null;
};

export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export function parseImageNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) && raw > 0 ? raw : null;
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  const dashed = t.match(/^(\d+)-(\d+)$/);
  if (dashed) {
    const n = Number(`${dashed[1]}${dashed[2]}`);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  }
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function validPoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

function cleanText(v: unknown): string | null {
  if (typeof v !== "string" && typeof v !== "number") return null;
  const t = String(v).trim();
  return t ? t.slice(0, 120) : null;
}

export function cameraFactsFromExif(exif: Record<string, unknown> | null | undefined) {
  const e = exif ?? {};
  const gps = validPoint(e.latitude, e.longitude);
  return {
    cameraSerial: cleanText(e.BodySerialNumber) ?? cleanText(e.SerialNumber) ?? cleanText(e.InternalSerialNumber),
    cameraImageNumber: parseImageNumber(e.ImageNumber) ?? parseImageNumber(e.FileNumber),
    exifLat: gps?.lat ?? null,
    exifLng: gps?.lng ?? null,
  };
}

export function imageNumberFromFilename(name: string | null | undefined): number | null {
  if (!name) return null;
  const m = name.match(/^(?:DSC_|DSC|IMG_|_MG_|DSCF|_DSC|P)(\d{3,6})\.[a-z0-9]+$/i);
  return m ? parseImageNumber(m[1]) : null;
}

export async function extractPhotoFacts(buffer: Buffer, originalFilename?: string | null): Promise<PhotoFacts> {
  let exif: Record<string, unknown> | null = null;
  try {
    exif = (await exifr.parse(buffer, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: false,
      iptc: false,
      makerNote: false,
      translateValues: false,
    })) as Record<string, unknown> | null;
  } catch {
    exif = null;
  }
  const camera = cameraFactsFromExif(exif);
  return {
    contentSha256: sha256Hex(buffer),
    ...camera,
    cameraImageNumber: camera.cameraImageNumber ?? imageNumberFromFilename(originalFilename),
  };
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && /^\s*-?\d+([.,]\d+)?\s*$/.test(v)) return Number(v.trim().replace(",", "."));
  return null;
}

export function parseDeclaredPoint(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  return validPoint(toNumber(lat), toNumber(lng));
}

export function resolvePhotoLocation(
  facts: { exifLat: number | null; exifLng: number | null },
  declared: { lat: number; lng: number } | null
): { geoLat: number; geoLng: number; geoSource: "EXIF_GPS" | "DECLARED" } | null {
  if (facts.exifLat !== null && facts.exifLng !== null) {
    return { geoLat: facts.exifLat, geoLng: facts.exifLng, geoSource: "EXIF_GPS" };
  }
  if (declared) return { geoLat: declared.lat, geoLng: declared.lng, geoSource: "DECLARED" };
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/agencies/photo-facts.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies/photo-facts.ts apps/compramelafoto/lib/agencies/photo-facts.test.ts apps/compramelafoto/vitest.bot.config.ts
git commit -m "Modo agencia: huella, datos de cámara y ubicación de cada foto"
```

---

### Task 3: Fotos de agencia al finalizar la subida (ubicación y repetidas)

**Files:**
- Modify: `apps/compramelafoto/lib/albums/finalize-album-photo-from-raw.ts`
- Create: `apps/compramelafoto/lib/albums/finalize-album-photo-from-raw.agency.test.ts`
- Modify: `apps/compramelafoto/app/api/dashboard/albums/[id]/photos/direct-upload/complete/route.ts`
- Create: `apps/compramelafoto/app/api/dashboard/albums/[id]/photos/direct-upload/complete/route.agency.test.ts`

**Interfaces:**
- Consumes: `extractPhotoFacts`, `resolvePhotoLocation`, `parseDeclaredPoint` (Task 2); `findAgencyAlbumGate` (`@/lib/agencies/queries`, etapa 1).
- Produces:
  - `FinalizeAlbumPhotoFromRawInput` gana `declaredPoint?: { lat: number; lng: number } | null` y `originalFilename?: string | null`.
  - `FinalizeAlbumPhotoFromRawResult` pasa a `{ photo: { id; previewUrl; originalKey }; duplicate: boolean }`.
  - `complete` acepta en el body `declaredLat`, `declaredLng`, `originalName` y responde `201 { photo }` (nueva) o `200 { photo, duplicate: true }` (repetida en álbum de agencia).

- [ ] **Step 1: Write the failing tests**

Create `apps/compramelafoto/lib/albums/finalize-album-photo-from-raw.agency.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const photoCreate = vi.fn();
const photoFindFirst = vi.fn();
const jobCreate = vi.fn();
const albumFindUnique = vi.fn();
const albumUpdate = vi.fn();
const findAgencyAlbumGate = vi.fn();
const extractPhotoFacts = vi.fn();
const deleteFromR2 = vi.fn();
const processPhoto = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    photo: { create: (...a: unknown[]) => photoCreate(...a), findFirst: (...a: unknown[]) => photoFindFirst(...a) },
    photoAnalysisJob: { create: (...a: unknown[]) => jobCreate(...a) },
    album: { findUnique: (...a: unknown[]) => albumFindUnique(...a), update: (...a: unknown[]) => albumUpdate(...a) },
  },
}));
vi.mock("@/lib/r2-client", () => ({
  getR2ObjectMetadata: async () => ({ size: 1000 }),
  readFromR2: async () => Buffer.from("foto"),
  deleteFromR2: (...a: unknown[]) => deleteFromR2(...a),
}));
vi.mock("@/lib/image-processing", () => ({ processPhoto: (...a: unknown[]) => processPhoto(...a) }));
vi.mock("@/lib/images/generate-photo-variants", () => ({ schedulePhotoVariantsOnUpload: () => {} }));
vi.mock("@/lib/photo-exif", () => ({ extractCapturedAtFromBuffer: async () => new Date("2027-01-10T15:00:00Z") }));
vi.mock("@/lib/platform-metrics", () => ({ incrementPhotosUploaded: async () => {} }));
vi.mock("@/lib/agencies/queries", () => ({ findAgencyAlbumGate: (...a: unknown[]) => findAgencyAlbumGate(...a) }));
vi.mock("@/lib/agencies/photo-facts", async (orig) => ({
  ...(await orig<typeof import("@/lib/agencies/photo-facts")>()),
  extractPhotoFacts: (...a: unknown[]) => extractPhotoFacts(...a),
}));

import { finalizeAlbumPhotoFromRaw } from "./finalize-album-photo-from-raw";

const base = { albumId: 5, userId: 20, key: "albums/5/raw/abc-DSC_0001.jpg", maxBytes: 10_000_000, maxMb: 10 };
const facts = { contentSha256: "h".repeat(64), cameraSerial: "S9", cameraImageNumber: 1, exifLat: null, exifLng: null };

beforeEach(() => {
  for (const f of [photoCreate, photoFindFirst, jobCreate, albumFindUnique, albumUpdate, findAgencyAlbumGate, extractPhotoFacts, deleteFromR2, processPhoto]) f.mockReset();
  processPhoto.mockResolvedValue({ previewUrl: "p.jpg", originalKey: "o.jpg" });
  photoCreate.mockImplementation(async ({ data }: any) => ({ id: 99, createdAt: new Date(), ...data }));
  albumFindUnique.mockResolvedValue({ coverPhotoId: 1, firstPhotoDate: new Date(), expiresAt: new Date() });
  extractPhotoFacts.mockResolvedValue(facts);
});

describe("finalizeAlbumPhotoFromRaw en álbumes de agencia", () => {
  it("álbum común: igual que antes (sin huella ni ubicación)", async () => {
    findAgencyAlbumGate.mockResolvedValue(null);
    const r = await finalizeAlbumPhotoFromRaw({ ...base, declaredPoint: { lat: -38, lng: -57 } });
    expect(r.duplicate).toBe(false);
    expect(extractPhotoFacts).not.toHaveBeenCalled();
    const data = photoCreate.mock.calls[0][0].data;
    for (const k of ["geoLat", "geoLng", "geoSource", "contentSha256", "cameraSerial", "cameraImageNumber", "originalFilename"]) {
      expect(data).not.toHaveProperty(k);
    }
  });
  it("álbum de agencia: guarda datos de cámara y el punto declarado", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 10, termsVersion: 1 });
    photoFindFirst.mockResolvedValue(null);
    const r = await finalizeAlbumPhotoFromRaw({ ...base, declaredPoint: { lat: -38.1, lng: -57.6 }, originalFilename: "DSC_0001.JPG" });
    expect(r.duplicate).toBe(false);
    expect(extractPhotoFacts).toHaveBeenCalledWith(expect.any(Buffer), "DSC_0001.JPG");
    expect(photoCreate.mock.calls[0][0].data).toMatchObject({
      geoLat: -38.1, geoLng: -57.6, geoSource: "DECLARED",
      contentSha256: "h".repeat(64), cameraSerial: "S9", cameraImageNumber: 1, originalFilename: "DSC_0001.JPG",
    });
  });
  it("álbum de agencia: el GPS de la foto le gana al punto declarado", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 10, termsVersion: 1 });
    photoFindFirst.mockResolvedValue(null);
    extractPhotoFacts.mockResolvedValue({ ...facts, exifLat: -38.0, exifLng: -57.5 });
    await finalizeAlbumPhotoFromRaw({ ...base, declaredPoint: { lat: -38.1, lng: -57.6 } });
    expect(photoCreate.mock.calls[0][0].data).toMatchObject({ geoLat: -38.0, geoLng: -57.5, geoSource: "EXIF_GPS" });
  });
  it("álbum de agencia: una repetida no crea foto y borra el raw", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 10, termsVersion: 1 });
    photoFindFirst.mockResolvedValue({ id: 7, previewUrl: "p7.jpg", originalKey: "o7.jpg" });
    const r = await finalizeAlbumPhotoFromRaw(base);
    expect(r).toEqual({ photo: { id: 7, previewUrl: "p7.jpg", originalKey: "o7.jpg" }, duplicate: true });
    expect(photoCreate).not.toHaveBeenCalled();
    expect(processPhoto).not.toHaveBeenCalled();
    expect(deleteFromR2).toHaveBeenCalledWith(base.key);
    const where = photoFindFirst.mock.calls[0][0].where;
    expect(where).toEqual({
      albumId: 5,
      isRemoved: false,
      OR: [
        { contentSha256: "h".repeat(64) },
        { cameraSerial: "S9", cameraImageNumber: 1, capturedAt: new Date("2027-01-10T15:00:00Z") },
      ],
    });
  });
  it("sin serial o sin número sólo compara la huella", async () => {
    findAgencyAlbumGate.mockResolvedValue({ agencyId: 3, ownerUserId: 10, termsVersion: 1 });
    photoFindFirst.mockResolvedValue(null);
    extractPhotoFacts.mockResolvedValue({ ...facts, cameraSerial: null });
    await finalizeAlbumPhotoFromRaw(base);
    expect(photoFindFirst.mock.calls[0][0].where.OR).toEqual([{ contentSha256: "h".repeat(64) }]);
  });
});
```

Create `apps/compramelafoto/app/api/dashboard/albums/[id]/photos/direct-upload/complete/route.agency.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const finalize = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({ Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" } }));
vi.mock("../../upload-helpers", () => ({
  ensureMpConnected: async () => ({ ok: true }),
  ensureAlbumUploadAccess: async () => ({ ok: true, error: null, status: 200, albumEventId: null }),
  isPhotoFolderValidationError: () => false,
  resolvePhotoUploadFolders: async () => ({}),
}));
vi.mock("@/lib/albums/finalize-album-photo-from-raw", () => ({ finalizeAlbumPhotoFromRaw: (...a: unknown[]) => finalize(...a) }));
vi.mock("@/lib/albums/album-photo-upload-limits", () => ({ getAlbumPhotoMaxBytes: () => 10_000_000, getAlbumPhotoMaxMb: () => 10 }));

import { POST } from "./route";

const req = (body: unknown) => ({ json: async () => body }) as any;
const ctx = { params: Promise.resolve({ id: "5" }) };

beforeEach(() => {
  requireAuth.mockReset().mockResolvedValue({ error: null, user: { id: 20 } });
  finalize.mockReset().mockResolvedValue({ photo: { id: 1, previewUrl: "p", originalKey: "o" }, duplicate: false });
});

describe("complete con datos de agencia", () => {
  it("pasa el punto declarado y el nombre original", async () => {
    const res = await POST(req({ key: "albums/5/raw/x.jpg", declaredLat: "-38,1", declaredLng: -57.6, originalName: "DSC_0001.JPG" }), ctx);
    expect(res.status).toBe(201);
    expect(finalize.mock.calls[0][0]).toMatchObject({ declaredPoint: { lat: -38.1, lng: -57.6 }, originalFilename: "DSC_0001.JPG" });
  });
  it("punto inválido se ignora sin romper", async () => {
    const res = await POST(req({ key: "albums/5/raw/x.jpg", declaredLat: 200, declaredLng: "abc" }), ctx);
    expect(res.status).toBe(201);
    expect(finalize.mock.calls[0][0].declaredPoint).toBe(null);
  });
  it("repetida: 200 con duplicate true", async () => {
    finalize.mockResolvedValue({ photo: { id: 7, previewUrl: "p", originalKey: "o" }, duplicate: true });
    const res = await POST(req({ key: "albums/5/raw/x.jpg" }), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ photo: { id: 7, previewUrl: "p", originalKey: "o" }, duplicate: true });
  });
  it("sin datos nuevos responde como siempre", async () => {
    const res = await POST(req({ key: "albums/5/raw/x.jpg" }), ctx);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ photo: { id: 1, previewUrl: "p", originalKey: "o" } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/albums/finalize-album-photo-from-raw.agency.test.ts "app/api/dashboard/albums/[id]/photos/direct-upload/complete/route.agency.test.ts"`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `lib/albums/finalize-album-photo-from-raw.ts`:

1. Imports: add
```ts
import { findAgencyAlbumGate } from "@/lib/agencies/queries";
import { extractPhotoFacts, resolvePhotoLocation } from "@/lib/agencies/photo-facts";
```
2. Input type: add `declaredPoint?: { lat: number; lng: number } | null;` and `originalFilename?: string | null;`. Result type: `{ photo: {...}; duplicate: boolean }`.
3. After `const capturedAt = await extractCapturedAtFromBuffer(buffer);` and **before** `processPhoto(...)`, insert:

```ts
  // Álbumes de agencia: ubicación de la toma y descarte de repetidas (FTP + tarjeta, doble subida).
  // Los álbumes comunes no pasan por acá y quedan exactamente como antes.
  const agencyGate = await findAgencyAlbumGate(albumId);
  let agencyData: Record<string, unknown> = {};
  if (agencyGate) {
    const facts = await extractPhotoFacts(buffer, input.originalFilename ?? null);
    const sameTake =
      facts.cameraSerial && facts.cameraImageNumber && capturedAt
        ? [{ cameraSerial: facts.cameraSerial, cameraImageNumber: facts.cameraImageNumber, capturedAt }]
        : [];
    const existing = await prisma.photo.findFirst({
      where: { albumId, isRemoved: false, OR: [{ contentSha256: facts.contentSha256 }, ...sameTake] },
      select: { id: true, previewUrl: true, originalKey: true },
    });
    if (existing) {
      try {
        await deleteFromR2(key);
      } catch (deleteErr) {
        console.warn("No se pudo eliminar archivo raw repetido en R2:", deleteErr);
      }
      return {
        photo: { id: existing.id, previewUrl: existing.previewUrl, originalKey: existing.originalKey },
        duplicate: true,
      };
    }
    const location = resolvePhotoLocation(facts, input.declaredPoint ?? null);
    agencyData = {
      ...(location ?? {}),
      contentSha256: facts.contentSha256,
      cameraSerial: facts.cameraSerial,
      cameraImageNumber: facts.cameraImageNumber,
      originalFilename: input.originalFilename ?? null,
    };
  }
```
4. In the main `prisma.photo.create({ data: {...} })`, add `...agencyData,` after `...folderData,`. Leave the fallback create (`{ albumId, previewUrl, originalKey }`) untouched.
5. Final return: `return { photo: { id: photo.id, previewUrl, originalKey }, duplicate: false };`.
6. Check every caller of `finalizeAlbumPhotoFromRaw` still compiles (`grep -rn "finalizeAlbumPhotoFromRaw(" apps/compramelafoto`): they read `.photo`, so the new `duplicate` field is additive. Do not change their behavior.

In `complete/route.ts`: add `import { parseDeclaredPoint } from "@/lib/agencies/photo-facts";`, then before calling finalize:

```ts
    const declaredPoint = parseDeclaredPoint(body?.declaredLat, body?.declaredLng);
    const originalFilename = typeof body?.originalName === "string" ? body.originalName.trim().slice(0, 255) || null : null;
```

pass `declaredPoint, originalFilename` to `finalizeAlbumPhotoFromRaw`, and replace the success response with:

```ts
    if (result.duplicate) {
      return NextResponse.json({ photo: result.photo, duplicate: true }, { status: 200 });
    }
    return NextResponse.json({ photo: result.photo }, { status: 201 });
```

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/albums/finalize-album-photo-from-raw.agency.test.ts "app/api/dashboard/albums/[id]/photos/direct-upload/complete/route.agency.test.ts" lib/agencies && NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck; echo exit=$?`
Expected: PASS y `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/albums apps/compramelafoto/app/api/dashboard/albums
git commit -m "Modo agencia: cada foto guarda su ubicación y no se suben repetidas"
```

---

### Task 4: Prioridad de los álbumes de agencia en el análisis facial

**Files:**
- Create: `apps/compramelafoto/lib/analysis/agency-priority.ts`
- Create: `apps/compramelafoto/lib/analysis/agency-priority.test.ts`
- Modify: `apps/compramelafoto/lib/analysis/analysis-runner.ts` (función `claimJobsAtomic`, ~líneas 63-163)

**Interfaces:**
- Produces:
  - `agencyPriorityQuota(batchSize: number): number` → `Math.ceil(batchSize / 2)` (0 si batchSize ≤ 0)
  - `claimAgencyPriorityJobs(now: Date, limit: number, ageCutoff: Date | null): Promise<Array<{ id: number; photoId: number }>>` — toma con `FOR UPDATE OF j SKIP LOCKED` hasta `limit` trabajos PENDING de fotos no removidas de álbumes con fila en `AgencyAlbum`, FIFO entre ellos, respetando `runAfter` y el `ageCutoff` igual que la variante existente.

- [ ] **Step 1: Write the failing test**

Create `apps/compramelafoto/lib/analysis/agency-priority.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { $queryRaw: (...a: unknown[]) => queryRaw(...a) } }));

import { agencyPriorityQuota, claimAgencyPriorityJobs } from "./agency-priority";

beforeEach(() => queryRaw.mockReset());

describe("agencyPriorityQuota", () => {
  it("la mitad del lote, redondeando para arriba, nunca todo", () => {
    expect(agencyPriorityQuota(12)).toBe(6);
    expect(agencyPriorityQuota(5)).toBe(3);
    expect(agencyPriorityQuota(1)).toBe(1);
    expect(agencyPriorityQuota(0)).toBe(0);
  });
});

describe("claimAgencyPriorityJobs", () => {
  it("sin cupo no consulta", async () => {
    expect(await claimAgencyPriorityJobs(new Date(), 0, null)).toEqual([]);
    expect(queryRaw).not.toHaveBeenCalled();
  });
  it("consulta sólo álbumes de agencia con FOR UPDATE SKIP LOCKED", async () => {
    queryRaw.mockResolvedValue([{ id: 1, photoId: 10 }]);
    const out = await claimAgencyPriorityJobs(new Date("2026-10-18T12:00:00Z"), 6, null);
    expect(out).toEqual([{ id: 1, photoId: 10 }]);
    const sql = (queryRaw.mock.calls[0][0] as TemplateStringsArray).join("?");
    expect(sql).toContain('INNER JOIN "AgencyAlbum" aa ON aa."albumId" = p."albumId"');
    expect(sql).toContain("FOR UPDATE OF j SKIP LOCKED");
    expect(sql).toContain('p."isRemoved" = false');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/analysis/agency-priority.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `apps/compramelafoto/lib/analysis/agency-priority.ts`:

```ts
import { prisma } from "@/lib/prisma";

/**
 * En temporada un álbum de agencia recibe miles de fotos por día y el turista se va de la playa:
 * se le reserva hasta la mitad de cada lote. La otra mitad sigue en orden de llegada para todos.
 */
export function agencyPriorityQuota(batchSize: number): number {
  return batchSize > 0 ? Math.ceil(batchSize / 2) : 0;
}

export async function claimAgencyPriorityJobs(
  now: Date,
  limit: number,
  ageCutoff: Date | null
): Promise<Array<{ id: number; photoId: number }>> {
  if (limit <= 0) return [];
  // Sin tope de antigüedad, el cutoff "en el pasado lejano" deja pasar todo.
  const cutoff = ageCutoff ?? new Date(0);
  return prisma.$queryRaw<Array<{ id: number; photoId: number }>>`
    WITH claimed AS (
      SELECT j.id
      FROM "PhotoAnalysisJob" j
      INNER JOIN "Photo" p ON p.id = j."photoId"
      INNER JOIN "AgencyAlbum" aa ON aa."albumId" = p."albumId"
      WHERE j.status = 'PENDING'
        AND (j."runAfter" IS NULL OR j."runAfter" <= ${now})
        AND p."isRemoved" = false
        AND (p."createdAt" >= ${cutoff} OR j."infraFailureAt" IS NOT NULL)
      ORDER BY j."createdAt" ASC
      LIMIT ${limit}
      FOR UPDATE OF j SKIP LOCKED
    )
    UPDATE "PhotoAnalysisJob"
    SET status = 'PROCESSING', "lockedAt" = ${now}
    WHERE id IN (SELECT id FROM claimed)
    RETURNING id, "photoId"
  `;
}
```

In `lib/analysis/analysis-runner.ts`, `claimJobsAtomic`:
- add `import { agencyPriorityQuota, claimAgencyPriorityJobs } from "./agency-priority";`
- right before `// Usamos FOR UPDATE SKIP LOCKED…`, insert:

```ts
  // Sin álbum fijo (cron general), primero hasta la mitad del lote para álbumes de agencia.
  const priority =
    scopedAlbum == null ? await claimAgencyPriorityJobs(now, agencyPriorityQuota(batchSize), ageCutoff) : [];
  const remaining = batchSize - priority.length;
```

- in the two non-scoped `$queryRaw` variants (the `ageCutoff` one and the default one) replace `LIMIT ${batchSize}` with `LIMIT ${remaining}` (the scoped-album variant keeps `${batchSize}`).
- after computing `locked`, return `{ jobsFound: candidates.length + priority.length, locked: [...priority, ...locked] }`.
- if `remaining <= 0`, skip the second query: wrap it so that `locked = remaining > 0 ? await <existing ternary> : []` for the non-scoped branches (keep the scoped branch as is).

- [ ] **Step 4: Run tests and typecheck**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts lib/analysis/agency-priority.test.ts && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.analysis.config.ts && NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck; echo exit=$?`
Expected: PASS (incluida la suite existente de análisis) y `exit=0`.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/analysis
git commit -m "Modo agencia: el análisis facial atiende primero a los álbumes de agencia"
```

---

### Task 5: APIs del miembro para subir y arreglo pendiente de la etapa 1

**Files:**
- Modify: `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/route.ts` (agregar `albumId` a cada álbum)
- Modify: `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/route.test.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/[agencyId]/lugares/route.ts`
- Create: `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/lugares.test.ts`
- Modify: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/albumes/route.ts` (DELETE)
- Modify: `apps/compramelafoto/app/api/fotografo/agencias/mi-agencia/albumes-lugares.test.ts`

**Interfaces:**
- Produces:
  - `GET /api/fotografo/agencias/mis-agencias` → cada `albums[]` pasa a `{ albumId, title, publicSlug }`.
  - `GET /api/fotografo/agencias/mis-agencias/[agencyId]/lugares` → `{ places: Array<{ id, name, lat, lng }> }`, sólo para miembro `ACTIVE` de esa agencia (404 si no).

- [ ] **Step 1: Write the failing tests**

In `mis-agencias/route.test.ts`, change the expected `albums` of the ACTIVE case to `[{ albumId: 50, title: "Temporada 2027", publicSlug: "temporada-2027-ab" }]`.

Create `apps/compramelafoto/app/api/fotografo/agencias/mis-agencias/lugares.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const requireAuth = vi.fn();
const memberFindUnique = vi.fn();
const placeFindMany = vi.fn();
vi.mock("@/lib/auth", () => ({ requireAuth: (...a: unknown[]) => requireAuth(...a) }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    agencyMember: { findUnique: (...a: unknown[]) => memberFindUnique(...a) },
    agencyPlace: { findMany: (...a: unknown[]) => placeFindMany(...a) },
  },
  Role: { PHOTOGRAPHER: "PHOTOGRAPHER", LAB_PHOTOGRAPHER: "LAB_PHOTOGRAPHER" },
}));

import { GET } from "./[agencyId]/lugares/route";

const ctx = (agencyId: string) => ({ params: Promise.resolve({ agencyId }) });

beforeEach(() => {
  requireAuth.mockReset().mockResolvedValue({ error: null, user: { id: 20 } });
  memberFindUnique.mockReset();
  placeFindMany.mockReset();
});

describe("lugares para el miembro", () => {
  it("miembro activo ve los lugares de su agencia", async () => {
    memberFindUnique.mockResolvedValue({ status: "ACTIVE" });
    placeFindMany.mockResolvedValue([{ id: 1, name: "Playa Grande", lat: -38.02, lng: -57.53 }]);
    const res = await GET({} as any, ctx("3"));
    expect(await res.json()).toEqual({ places: [{ id: 1, name: "Playa Grande", lat: -38.02, lng: -57.53 }] });
    expect(memberFindUnique.mock.calls[0][0].where).toEqual({ agencyId_userId: { agencyId: 3, userId: 20 } });
    expect(placeFindMany.mock.calls[0][0].where).toEqual({ agencyId: 3 });
  });
  it("no miembro o no activo: 404", async () => {
    memberFindUnique.mockResolvedValue({ status: "REQUESTED" });
    expect((await GET({} as any, ctx("3"))).status).toBe(404);
    memberFindUnique.mockResolvedValue(null);
    expect((await GET({} as any, ctx("3"))).status).toBe(404);
  });
});
```

In `mi-agencia/albumes-lugares.test.ts`, add:

```ts
  it("DELETE de un álbum que no es de esta agencia no revela si tiene fotos de otros", async () => {
    agencyAlbumFindFirstMock.mockResolvedValue(null);
    const res = await albumes.DELETE(req(null, "http://x/api?albumId=99"));
    expect(res.status).toBe(404);
    expect(photoCountMock).not.toHaveBeenCalled();
  });
```

adding at the top of that file two mocks wired into the existing `vi.mock("@/lib/prisma", ...)`: `const agencyAlbumFindFirstMock = vi.fn();` as `agencyAlbum.findFirst` and reuse the existing photo count mock if the file already has one (name it `photoCountMock` if you have to create it, as `photo.count`). In the existing DELETE tests set `agencyAlbumFindFirstMock.mockResolvedValue({ id: 1 })` in `beforeEach` (reset it there too).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias`
Expected: FAIL (albumId missing, route missing, DELETE counts first).

- [ ] **Step 3: Implement**

`mis-agencias/route.ts`: in the response mapping use `albums: visibleAlbums(m).map((al) => ({ albumId: al.albumId, title: al.album.title, publicSlug: al.album.publicSlug }))`.

Create `mis-agencias/[agencyId]/lugares/route.ts`:

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma, Role } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lugares frecuentes de la agencia, para que el fotógrafo elija dónde sacó las fotos. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ agencyId: string }> }) {
  const { error, user } = await requireAuth([Role.PHOTOGRAPHER, Role.LAB_PHOTOGRAPHER]);
  if (error || !user) return NextResponse.json({ error: error || "No autorizado" }, { status: 401 });
  const { agencyId } = await params;
  const id = Number(agencyId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Agencia inválida." }, { status: 400 });
  const member = await prisma.agencyMember.findUnique({
    where: { agencyId_userId: { agencyId: id, userId: user.id } },
    select: { status: true },
  });
  if (!member || member.status !== "ACTIVE") {
    return NextResponse.json({ error: "No sos parte del equipo de esa agencia." }, { status: 404 });
  }
  const places = await prisma.agencyPlace.findMany({
    where: { agencyId: id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, lat: true, lng: true },
  });
  return NextResponse.json({ places });
}
```

`mi-agencia/albumes/route.ts` DELETE: before counting photos, check the link belongs to this agency:

```ts
  const link = await prisma.agencyAlbum.findFirst({ where: { agencyId: a.agency.id, albumId }, select: { id: true } });
  if (!link) return NextResponse.json({ error: "Ese álbum no es de la agencia." }, { status: 404 });
```

then keep the existing photo count + 409, then the `deleteMany`.

- [ ] **Step 4: Run tests**

Run: `cd apps/compramelafoto && ../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.bot.config.ts app/api/fotografo/agencias lib/agencies`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/app/api/fotografo/agencias
git commit -m "Modo agencia: lugares para el equipo y album en Mis agencias"
```

---

### Task 6: Pantalla del miembro para subir fotos

**Files:**
- Create: `apps/compramelafoto/lib/agencies/use-agency-photo-upload.ts`
- Create: `apps/compramelafoto/app/fotografo/agencias/mis-agencias/[agencyId]/subir/page.tsx`
- Modify: `apps/compramelafoto/app/fotografo/agencias/mis-agencias/page.tsx`

**Interfaces:**
- Consumes: `runAlbumPhotoUploadQueue` (`@/lib/albums/run-album-photo-upload-queue`, options `{ files, concurrency?, maxAttempts?, uploadFile(file, { onPhase }) => Promise<AlbumPhotoUploadOutcome>, onProgress(progress) }`); `resolveAlbumPhotoContentType(name, type)` (`@/lib/albums/album-photo-content-type`); APIs `POST /api/dashboard/albums/{albumId}/photos/direct-upload/init` (`{ name, contentType, size }` → `{ uploadUrl, key }`), `POST .../direct-upload/complete` (`{ key, originalName, size, declaredLat?, declaredLng? }` → 201 `{ photo }` | 200 `{ photo, duplicate: true }`), `GET /api/fotografo/agencias/mis-agencias`, `GET /api/fotografo/agencias/mis-agencias/{agencyId}/lugares`; `AgencyPageFrame` (`@/components/agencies/AgencyPageFrame`).
- Produces: `useAgencyPhotoUpload()` → `{ upload(params: { albumId: number; files: File[]; point: { lat: number; lng: number } | null }): Promise<void>; progress: AlbumPhotoUploadProgress | null; uploading: boolean; summary: { ok: number; duplicates: number; failed: number } | null; error: string | null }`.

- [ ] **Step 1: El hook**

Create `apps/compramelafoto/lib/agencies/use-agency-photo-upload.ts`:

```ts
"use client";

import { useCallback, useState } from "react";
import { runAlbumPhotoUploadQueue, type AlbumPhotoUploadProgress } from "@/lib/albums/run-album-photo-upload-queue";
import { resolveAlbumPhotoContentType } from "@/lib/albums/album-photo-content-type";

/**
 * Subida web del fotógrafo de una agencia: init → PUT directo a R2 → complete (sincrónico, con el
 * punto donde sacó las fotos). No usa la página del álbum del dueño, que el equipo no puede abrir.
 */
export function useAgencyPhotoUpload() {
  const [progress, setProgress] = useState<AlbumPhotoUploadProgress | null>(null);
  const [uploading, setUploading] = useState(false);
  const [summary, setSummary] = useState<{ ok: number; duplicates: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async ({ albumId, files, point }: { albumId: number; files: File[]; point: { lat: number; lng: number } | null }) => {
      setUploading(true);
      setSummary(null);
      setError(null);
      let ok = 0;
      let duplicates = 0;
      let failed = 0;
      try {
        await runAlbumPhotoUploadQueue({
          files,
          concurrency: 3,
          maxAttempts: 2,
          onProgress: setProgress,
          uploadFile: async (file, { onPhase }) => {
            const contentType = resolveAlbumPhotoContentType(file.name, file.type);
            onPhase("init");
            const initRes = await fetch(`/api/dashboard/albums/${albumId}/photos/direct-upload/init`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ name: file.name, contentType, size: file.size }),
            });
            const init = await initRes.json().catch(() => ({}));
            if (!initRes.ok || !init.uploadUrl || !init.key) {
              failed++;
              throw new Error(init.error || "No se pudo iniciar la subida.");
            }
            onPhase("storage");
            const put = await fetch(init.uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
            if (!put.ok) {
              failed++;
              throw new Error("No se pudo subir el archivo. Revisá tu conexión.");
            }
            onPhase("process");
            const doneRes = await fetch(`/api/dashboard/albums/${albumId}/photos/direct-upload/complete`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: init.key,
                originalName: file.name,
                size: file.size,
                ...(point ? { declaredLat: point.lat, declaredLng: point.lng } : {}),
              }),
            });
            const done = await doneRes.json().catch(() => ({}));
            if (!doneRes.ok || !done.photo) {
              failed++;
              throw new Error(done.error || "No se pudo procesar la foto.");
            }
            if (done.duplicate) duplicates++;
            else ok++;
            return { kind: "sync", photoId: done.photo.id };
          },
        });
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setSummary({ ok, duplicates, failed });
        setUploading(false);
      }
    },
    []
  );

  return { upload, progress, uploading, summary, error };
}
```

Note: if `runAlbumPhotoUploadQueue` retries a file, a failed first attempt counts in `failed` and a later success counts in `ok`; acceptable for a summary. If the queue already reports per-file failures itself, prefer its counters (`progress.failed`, `progress.succeeded`) for `failed`/`ok` and keep only `duplicates` local — check `run-album-photo-upload-queue.ts` and pick whichever is accurate, documenting the choice in one comment.

- [ ] **Step 2: La página**

Create `apps/compramelafoto/app/fotografo/agencias/mis-agencias/[agencyId]/subir/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import { useAgencyPhotoUpload } from "@/lib/agencies/use-agency-photo-upload";

type Album = { albumId: number; title: string; publicSlug: string };
type Place = { id: number; name: string; lat: number; lng: number };

export default function SubirFotosAgenciaPage() {
  const { agencyId } = useParams<{ agencyId: string }>();
  const [agency, setAgency] = useState<{ name: string; albums: Album[] } | null>(null);
  const [mpConnected, setMpConnected] = useState(true);
  const [places, setPlaces] = useState<Place[]>([]);
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [placeChoice, setPlaceChoice] = useState<string>("");
  const [myPoint, setMyPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { upload, progress, uploading, summary, error } = useAgencyPhotoUpload();

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/fotografo/agencias/mis-agencias", { credentials: "include" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) return setLoadError(d.error || "No pudimos cargar tus agencias.");
      const a = (d.agencies ?? []).find((x: any) => String(x.agencyId) === String(agencyId) && x.status === "ACTIVE");
      if (!a) return setLoadError("No sos parte del equipo de esta agencia.");
      setMpConnected(Boolean(d.mpConnected));
      setAgency({ name: a.name, albums: a.albums });
      if (a.albums.length === 1) setAlbumId(a.albums[0].albumId);
      const pr = await fetch(`/api/fotografo/agencias/mis-agencias/${agencyId}/lugares`, { credentials: "include" });
      const pd = await pr.json().catch(() => ({ places: [] }));
      if (pr.ok) setPlaces(pd.places ?? []);
    })().catch(() => setLoadError("No pudimos cargar tus agencias."));
  }, [agencyId]);

  const point =
    placeChoice === "mine"
      ? myPoint
      : placeChoice
        ? (() => {
            const p = places.find((x) => String(x.id) === placeChoice);
            return p ? { lat: p.lat, lng: p.lng } : null;
          })()
        : null;

  return (
    <AgencyPageFrame title="Subir fotos" subtitle="Subí tus fotos al álbum de la agencia. Si tu cámara no tiene GPS, elegí dónde las sacaste.">
      {loadError && <Card>{loadError}</Card>}
      {agency && (
        <Card className="space-y-5">
          <h2 className="text-lg font-medium">{agency.name}</h2>

          {!mpConnected && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
              Para subir fotos tenés que tener tu Mercado Pago conectado: ahí vas a cobrar tu parte.{" "}
              <Link className="underline" href="/fotografo/configuracion?tab=mercadopago">Conectar Mercado Pago</Link>
            </div>
          )}

          {agency.albums.length === 0 ? (
            <p className="text-sm text-[#6b7280]">La agencia todavía no tiene álbumes. Avisale al dueño.</p>
          ) : (
            <label className="block text-sm font-medium">Álbum
              <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={albumId ?? ""} onChange={(e) => setAlbumId(Number(e.target.value) || null)}>
                <option value="">Elegí el álbum…</option>
                {agency.albums.map((a) => <option key={a.albumId} value={a.albumId}>{a.title}</option>)}
              </select>
            </label>
          )}

          <label className="block text-sm font-medium">¿Dónde sacaste estas fotos?
            <select className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" value={placeChoice} onChange={(e) => {
              const v = e.target.value;
              setPlaceChoice(v);
              if (v === "mine" && navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                  (pos) => setMyPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                  () => setMyPoint(null),
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }
            }}>
              <option value="">No sé / la cámara tiene GPS</option>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              <option value="mine">Usar mi ubicación actual</option>
            </select>
          </label>
          {placeChoice === "mine" && !myPoint && <p className="text-xs text-[#6b7280]">Esperando tu ubicación… (aceptá el permiso del navegador)</p>}
          <p className="text-xs text-[#6b7280]">Si la foto trae GPS de la cámara, se usa ese. Si no, el lugar que elijas acá.</p>

          <label className={`block rounded-2xl border-2 border-dashed p-6 text-center text-sm ${!albumId || uploading || !mpConnected ? "opacity-50" : "cursor-pointer hover:bg-gray-50"}`}>
            <input
              type="file"
              accept="image/jpeg,image/jpg"
              multiple
              className="hidden"
              disabled={!albumId || uploading || !mpConnected}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (albumId && files.length) upload({ albumId, files, point });
              }}
            />
            {uploading ? "Subiendo…" : "Tocá acá para elegir las fotos (JPG)"}
          </label>

          {progress && uploading && (
            <div className="space-y-1">
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-2 bg-[#c27b3d]" style={{ width: `${Math.round(progress.progressRatio * 100)}%` }} />
              </div>
              <p className="text-xs text-[#6b7280]">{progress.processed} de {progress.total} fotos</p>
            </div>
          )}
          {summary && !uploading && (
            <p className="text-sm">
              Listo: {summary.ok} subidas{summary.duplicates ? `, ${summary.duplicates} ya estaban (no se repitieron)` : ""}{summary.failed ? `, ${summary.failed} con error` : ""}.
            </p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Link className="text-sm underline" href="/fotografo/agencias/mis-agencias">Volver a Mis agencias</Link>
        </Card>
      )}
    </AgencyPageFrame>
  );
}
```

- [ ] **Step 3: Botón en "Mis agencias"**

In `app/fotografo/agencias/mis-agencias/page.tsx`: add `albumId: number` to the album type, and inside the `a.status === "ACTIVE"` block, after the "Fotos tuyas subidas" line, add:

```tsx
                  <Link href={`/fotografo/agencias/mis-agencias/${a.agencyId}/subir`}>
                    <Button size="sm">Subir fotos</Button>
                  </Link>
```

and replace the line "La subida por FTP y DNX FLUX y el detalle de lo cobrado llegan en las próximas etapas." with "La subida desde la cámara (FTP) y desde DNX FLUX, y el detalle de lo cobrado, llegan en las próximas etapas."

- [ ] **Step 4: Verify**

Run: `cd apps/compramelafoto && NODE_OPTIONS=--max-old-space-size=8192 pnpm typecheck; echo exit=$?`
Expected: `exit=0`. (Sin verificación visual local: la configuración local apunta a una base de auditoría.)

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/lib/agencies/use-agency-photo-upload.ts apps/compramelafoto/app/fotografo/agencias/mis-agencias
git commit -m "Modo agencia: el equipo sube fotos al álbum de la agencia desde la web"
```

---

### Task 7: Migración en las cinco bases, PR, producción

- [ ] **Step 1:** Todos los tests (`vitest.bot.config.ts` y `vitest.analysis.config.ts`) y `pnpm typecheck` con exit 0.
- [ ] **Step 2:** Aplicar `20261122120000_clf_agencia_fotos` en las cinco bases (CLF production `br-autumn-rain-ad18wq7y`, development `br-old-rain-adwthzng` del proyecto `divine-hall-10689679`; `bitter-math-56019731`; `wandering-pine-79918137`; `cold-silence-10115969`) con una transacción por base: las sentencias del archivo + `INSERT INTO "_prisma_migrations"` con el `sha256` del archivo (`shasum -a 256`) y `WHERE NOT EXISTS`. Verificar en cada una que existan las 7 columnas y la fila.
- [ ] **Step 3:** PR contra `main`, esperar `tipos-y-pruebas` y Vercel en verde, fusionar.
- [ ] **Step 4:** Después del deploy: `GET /api/fotografo/agencias/mis-agencias` sin sesión → 401; la página `/fotografo/agencias/mis-agencias/1/subir` responde 200; revisar en la base que sigan entrando fotos en álbumes comunes y que las nuevas tengan `contentSha256` NULL (no son de agencia).
