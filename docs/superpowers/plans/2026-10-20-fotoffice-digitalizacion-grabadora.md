# FOTOFFICE Digitalización · Parte 1 (Grabadora) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Una estación de grabación en FOTOFFICE que captura VHS desde una capturadora USB en el navegador, sube el video en pedacitos al R2 privado mientras graba en segundo plano, corta sola tras N minutos sin imagen, y sube DVD caseros desde su carpeta `VIDEO_TS`.

**Architecture:**
- **Navegador.** `MediaRecorder` corta pedacitos de 10 s que van a una cola persistente (IndexedDB). La cola los sube con URLs firmadas de R2 y los confirma con acciones de servidor.
- **Análisis de señal.** Un Web Worker recibe los cuadros por `MediaStreamTrackProcessor` y clasifica un cuadro por segundo. Una máquina de estados pura decide el corte y los puntos de recorte.
- **Servidor.** Guarda grabaciones, partes, equipos y ajustes en cuatro tablas nuevas, y nunca deja que el navegador elija una clave de R2.

**Tech Stack:**
- Next.js 16.2 (App Router, server actions, `next build --webpack`), React, TypeScript.
- Prisma (`@repo/db`) sobre Postgres (Neon).
- `@aws-sdk/client-s3` y `s3-request-presigner` sobre R2.
- Vitest (entorno `node`).
- APIs de Chrome/Edge: `MediaRecorder`, `MediaStreamTrackProcessor`, Document Picture-in-Picture, File System Access, IndexedDB.

**Spec:** `docs/superpowers/specs/2026-10-20-fotoffice-digitalizacion-grabadora-design.md`

## Global Constraints

- Todo el código vive en `apps/fotoffice`; el schema en `packages/db/prisma/schema.prisma`.
- **Next.js 16 no es el que conocés**: antes de escribir una página, una acción o un worker, leé la guía correspondiente en `apps/fotoffice/node_modules/next/dist/docs/` (`AGENTS.md`).
- Clave del módulo: `digitalizacion`. Ruta principal: `/digitalizacion`. Estación: `/digitalizacion/grabar`.
- Navegador: **Chrome o Edge de escritorio 116+**. Sin `documentPictureInPicture` o sin `MediaStreamTrackProcessor`, la estación avisa y no deja grabar.
- Pedacitos de grabación: `timeslice` de **10 s**. Pedacitos de DVD: **16 MB**. Tope por parte: **64 MB**.
- Calidad: Alta 6 Mbps · **Media 4 Mbps (por defecto)** · Baja 2,5 Mbps; audio 128 kbps; se piden 1920×1080 a 30 cuadros.
- Formatos en orden: `video/mp4;codecs=avc1,mp4a.40.2`, `video/webm;codecs=h264,opus`, `video/webm;codecs=vp9,opus`.
- Corte: **5 minutos** sin imagen por defecto (configurable 1–30 por negocio). Reinicio tras **3 s** seguidos con imagen. Imagen quieta **60 s** o más = congelada. Tope **8 h 30 min**. Latido cada **30 s**; **180 s** sin latido = Interrumpida.
- Clave de R2: `digitalizacion/<workspaceId>/<grabacionId>/t<tramo>/<indice 6 dígitos>.<mp4|webm|vob>`, siempre en `R2_PRIVATE_BUCKET` (nunca el bucket público).
- Textos en español rioplatense ("Grabá", "Elegí"). Clases de estilo existentes: `fo-btn`, `fo-btn-primary`, `fo-alert-error`, `fo-alert-success`, `fo-alert-warning`; encabezado con `PageHeader`.
- Tests junto al código (`*.test.ts`), corridos con `pnpm --filter fotoffice test -- <ruta>`.
- Migración escrita a mano, idempotente (`IF NOT EXISTS`), **sólo tablas nuevas**, aplicada en producción **antes** de fusionar (FOTOFFICE no tiene staging).
- Commits con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; `git add` con rutas explícitas, nunca `-A`.

## Review Focus

Casos que el spec implica, que ningún test unitario recorre de punta a punta y que más le pueden doler a quien graba:

1. **Pestaña minimizada durante 2 horas.** Se espera que el corte, el latido y la subida sigan funcionando. Por eso el latido sale de los mensajes del worker y no de `setInterval`. Lo fijan el test de `latidoDebido` (Tarea 4) y la prueba real (Tarea 13).
2. **Una parte ya subida que se vuelve a pedir** (reintento después de un corte de red, o "Continuar" un DVD). Se espera que no se pise ni se cuente dos veces. Lo fijan el test de `pedirParte` con una parte `LISTA` y el de `confirmarParte` dos veces (Tarea 6).
3. **Una película con una escena quieta o muy oscura de menos de 5 minutos.** Se espera que no corte. Lo fijan los tests de "quieta 30 s" y "parpadeo negro" (Tarea 4).
4. **Una grabación de otro negocio o un `proyectoId` ajeno.** Se espera que se rechace sin decir por qué. Lo fija el test de `crearGrabacion` y `pedirParte` con otro `workspaceId` (Tarea 6).
5. **Se cerró el navegador con pedacitos sin subir en IndexedDB.** Se espera que al reabrir la estación se suban antes de cualquier otra cosa. Lo fija el test de `reanudar` de la cola (Tarea 7).

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `lib/digitalizacion/constants.ts` | Clave del módulo y números del spec. |
| `lib/digitalizacion/claves.ts` | Claves de R2 y tipos de contenido. |
| `lib/digitalizacion/senal/rasgos.ts` | Números de un cuadro de 64×36 (brillo, color, huella, luma). |
| `lib/digitalizacion/senal/clasificador.ts` | Clase de un cuadro. |
| `lib/digitalizacion/senal/corte.ts` | Máquina de estados segundo a segundo: corte, recortes, tramos sin señal. |
| `lib/digitalizacion/dvd.ts` | Orden y filtro de VOB; cortes de 16 MB. |
| `lib/digitalizacion/validar.ts` | Validación pura de lo que manda el navegador; estado visible. |
| `lib/digitalizacion/contexto.ts` | Sesión, negocio y nivel del módulo (acciones y páginas). |
| `lib/digitalizacion/servidor/almacen.ts` | URLs firmadas, tamaño y borrado de partes en R2 privado. |
| `lib/digitalizacion/servidor/grabaciones.ts` | Base de datos: grabaciones, partes, equipos, ajustes, trabajos. |
| `app/(shell)/digitalizacion/actions.ts` | Acciones de servidor (envoltorios con contexto). |
| `lib/digitalizacion/cliente/apis-navegador.ts` | Acceso tipado a las APIs nuevas del navegador. |
| `lib/digitalizacion/cliente/formato.ts` | Elegir formato de `MediaRecorder`. |
| `lib/digitalizacion/cliente/cola.ts` | Cola de subida con reintentos (pura, almacén inyectado). |
| `lib/digitalizacion/cliente/almacen-indexeddb.ts` | Almacén de la cola en IndexedDB. |
| `lib/digitalizacion/cliente/grabador.ts` | Envoltorio de `MediaRecorder`. |
| `lib/digitalizacion/cliente/analisis.worker.ts` | Worker: cuadros → clases → corte; calibración. |
| `lib/digitalizacion/cliente/descargar-crudo.ts` | Escribir las partes en un archivo local, en orden. |
| `components/digitalizacion/estacion.tsx` | La estación: equipo, vista previa, asignación, grabar. |
| `components/digitalizacion/ventanita.tsx` | Ventanita flotante (raíz React propia en el documento PiP). |
| `components/digitalizacion/dvd.tsx` | "Digitalizar DVD". |
| `components/digitalizacion/acciones-grabacion.tsx` | Botones de la lista (Continuar, Terminar, Descartar, Descargar crudo). |
| `app/(shell)/digitalizacion/page.tsx` | Lista de grabaciones y ajuste de minutos. |
| `app/(shell)/digitalizacion/grabar/page.tsx` | Página de la estación. |
| `packages/db/prisma/migrations/20261126120000_fotoffice_digitalizacion/migration.sql` | Tablas nuevas. |

Todas las rutas de `lib/`, `components/` y `app/` son relativas a `apps/fotoffice/`.

---

### Task 1: Módulo, constantes y claves de R2

**Files:**
- Create: `apps/fotoffice/lib/digitalizacion/constants.ts`
- Create: `apps/fotoffice/lib/digitalizacion/claves.ts`
- Test: `apps/fotoffice/lib/digitalizacion/claves.test.ts`
- Modify: `apps/fotoffice/lib/modules/registry.ts` (import y una entrada en `MODULE_REGISTRY`)

**Interfaces:**
- Produces: `DIGITALIZACION_MODULE_KEY`, todas las constantes de abajo; `Extension`, `extensionDeMime(mime): Extension | null`, `tipoContenido(ext): string`, `claveDeParte({ workspaceId, grabacionId, tramo, indice, extension }): string`, `esClaveDeParte(k): boolean`, `prefijoDeGrabacion(workspaceId, grabacionId): string`, `ID_VALIDO: RegExp`.

- [ ] **Step 1: Escribir las constantes**

```ts
// apps/fotoffice/lib/digitalizacion/constants.ts
/** Las constantes del módulo de digitalización de VHS y DVD (spec 2026-10-20, parte 1). */

export const DIGITALIZACION_MODULE_KEY = "digitalizacion";

/** Cada cuánto `MediaRecorder` entrega un pedacito. */
export const SEGUNDOS_POR_PARTE = 10;
/** Tamaño de cada pedacito de un VOB. */
export const BYTES_PEDACITO_DVD = 16 * 1024 * 1024;
/** Ninguna parte puede pesar más (10 s a 6 Mbps son ~7,5 MB). */
export const MAX_BYTES_PARTE = 64 * 1024 * 1024;
/** Cintas LP/EP: hasta 8 h; tope de seguridad 8 h 30 min. */
export const TOPE_SEGUNDOS = 8 * 3600 + 30 * 60;
export const SEGUNDOS_LATIDO = 30;
export const SEGUNDOS_SIN_LATIDO = 180;
export const MINUTOS_SIN_SENAL_POR_DEFECTO = 5;
export const MINUTOS_SIN_SENAL_MIN = 1;
export const MINUTOS_SIN_SENAL_MAX = 30;

export const CALIDADES = { ALTA: 6_000_000, MEDIA: 4_000_000, BAJA: 2_500_000 } as const;
export type Calidad = keyof typeof CALIDADES;
export const BITS_AUDIO = 128_000;

export const TIPOS_GRABACION = ["VHS", "DVD"] as const;
export type TipoGrabacion = (typeof TIPOS_GRABACION)[number];

export const MOTIVOS_FIN_DE_LA_ESTACION = ["MANUAL", "SIN_SENAL", "TOPE", "DVD_COMPLETO"] as const;
export type MotivoFin = (typeof MOTIVOS_FIN_DE_LA_ESTACION)[number] | "TERMINADA_CON_LO_GRABADO";
```

- [ ] **Step 2: Escribir el test de claves (falla)**

```ts
// apps/fotoffice/lib/digitalizacion/claves.test.ts
import { describe, expect, it } from "vitest";
import { claveDeParte, esClaveDeParte, extensionDeMime, prefijoDeGrabacion, tipoContenido } from "./claves";

describe("claves de digitalización", () => {
  it("arma la clave con tramo e índice de 6 dígitos", () => {
    expect(claveDeParte({ workspaceId: "ws_1", grabacionId: "g1", tramo: 2, indice: 37, extension: "mp4" }))
      .toBe("digitalizacion/ws_1/g1/t2/000037.mp4");
  });
  it("rechaza ids, tramos e índices fuera de rango", () => {
    expect(() => claveDeParte({ workspaceId: "../x", grabacionId: "g1", tramo: 1, indice: 0, extension: "mp4" })).toThrow();
    expect(() => claveDeParte({ workspaceId: "w", grabacionId: "g1", tramo: 0, indice: 0, extension: "mp4" })).toThrow();
    expect(() => claveDeParte({ workspaceId: "w", grabacionId: "g1", tramo: 1, indice: 1_000_000, extension: "mp4" })).toThrow();
  });
  it("reconoce sólo claves propias", () => {
    expect(esClaveDeParte("digitalizacion/w/g/t1/000000.webm")).toBe(true);
    expect(esClaveDeParte("fotoffice/member-portfolio/x.jpg")).toBe(false);
    expect(esClaveDeParte("digitalizacion/w/g/t1/000000.exe")).toBe(false);
  });
  it("traduce el mime de MediaRecorder y el de DVD", () => {
    expect(extensionDeMime("video/mp4;codecs=avc1,mp4a.40.2")).toBe("mp4");
    expect(extensionDeMime("video/webm;codecs=vp9,opus")).toBe("webm");
    expect(extensionDeMime("video/dvd")).toBe("vob");
    expect(extensionDeMime("image/png")).toBeNull();
    expect(tipoContenido("vob")).toBe("application/octet-stream");
    expect(tipoContenido("mp4")).toBe("video/mp4");
  });
  it("el prefijo de una grabación termina en barra", () => {
    expect(prefijoDeGrabacion("w", "g")).toBe("digitalizacion/w/g/");
  });
});
```

- [ ] **Step 3: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/claves.test.ts`
Expected: FAIL ("Failed to resolve import ./claves").

- [ ] **Step 4: Implementar `claves.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/claves.ts
/** Claves de R2 de la digitalización. Las arma SIEMPRE el servidor; el navegador nunca elige una. */

export const ID_VALIDO = /^[A-Za-z0-9_-]{1,64}$/;
export type Extension = "mp4" | "webm" | "vob";

const REGEX_CLAVE_PARTE = /^digitalizacion\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/t\d{1,3}\/\d{6}\.(mp4|webm|vob)$/;

/** "video/dvd" es el mime interno con que la estación pide una grabación de DVD. */
export function extensionDeMime(mime: string): Extension | null {
  const base = mime.split(";")[0]?.trim().toLowerCase();
  if (base === "video/mp4") return "mp4";
  if (base === "video/webm") return "webm";
  if (base === "video/dvd") return "vob";
  return null;
}

export function tipoContenido(ext: Extension): string {
  return ext === "vob" ? "application/octet-stream" : `video/${ext}`;
}

export function prefijoDeGrabacion(workspaceId: string, grabacionId: string): string {
  if (!ID_VALIDO.test(workspaceId) || !ID_VALIDO.test(grabacionId)) throw new Error("Id no válido");
  return `digitalizacion/${workspaceId}/${grabacionId}/`;
}

export function claveDeParte(p: { workspaceId: string; grabacionId: string; tramo: number; indice: number; extension: Extension }): string {
  if (!Number.isInteger(p.tramo) || p.tramo < 1 || p.tramo > 999) throw new Error("Tramo no válido");
  if (!Number.isInteger(p.indice) || p.indice < 0 || p.indice > 999_999) throw new Error("Índice no válido");
  const clave = `${prefijoDeGrabacion(p.workspaceId, p.grabacionId)}t${p.tramo}/${String(p.indice).padStart(6, "0")}.${p.extension}`;
  if (!REGEX_CLAVE_PARTE.test(clave)) throw new Error("Clave no válida");
  return clave;
}

export function esClaveDeParte(k: string): boolean {
  return REGEX_CLAVE_PARTE.test(k);
}
```

- [ ] **Step 5: Correr el test**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/claves.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6: Registrar el módulo**

En `apps/fotoffice/lib/modules/registry.ts`, agregá el import junto a los otros:

```ts
import { DIGITALIZACION_MODULE_KEY } from "@/lib/digitalizacion/constants";
```

Y esta entrada dentro de `MODULE_REGISTRY`, después de la de `SALES_MODULE_KEY`:

```ts
  {
    key: DIGITALIZACION_MODULE_KEY,
    label: "Digitalización",
    description:
      "Digitalización de VHS y DVD: graba desde la capturadora en segundo plano, sube en tiempo real y corta sola cuando la cinta termina.",
    category: "GENERAL",
    order: 37,
    route: "/digitalizacion",
    status: "AVAILABLE",
    family: "negocio",
    platformFee: true,
  },
```

`platformFee: true` hace que no se encienda solo: lo enciende el super admin (DNX primero, spec D18).

- [ ] **Step 7: Correr los tests del registro**

Run: `pnpm --filter fotoffice test -- lib/modules`
Expected: PASS. Si un test enumera los módulos AVAILABLE con una lista fija, agregale `digitalizacion` en ese test.

- [ ] **Step 8: Commit**

```bash
git add apps/fotoffice/lib/digitalizacion/constants.ts apps/fotoffice/lib/digitalizacion/claves.ts apps/fotoffice/lib/digitalizacion/claves.test.ts apps/fotoffice/lib/modules/registry.ts
git commit -m "Digitalización: módulo, constantes y claves de R2

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Tablas nuevas (schema y migración)

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelo `Workspace` ~línea 7189, `FotofficeProyecto` ~línea 21700, y cuatro modelos nuevos al final del bloque de FOTOFFICE)
- Create: `packages/db/prisma/migrations/20261126120000_fotoffice_digitalizacion/migration.sql`

**Interfaces:**
- Produces: modelos Prisma `DigitalizacionGrabacion`, `DigitalizacionParte`, `DigitalizacionEquipo`, `DigitalizacionAjustes` (accesores `prisma.digitalizacionGrabacion`, etc.). Campos exactamente como abajo; las tareas 6 y 9 los usan por nombre.

- [ ] **Step 1: Agregar los modelos al schema**

Pegá después del modelo `FotofficeArchivoTrabajo`:

```prisma
/// Digitalización (VHS/DVD): una grabación es un cassette o un DVD. Sus pedacitos viven en el R2
/// privado bajo `digitalizacion/<workspaceId>/<id>/`. "Interrumpida" no se guarda: se calcula por latido.
model DigitalizacionGrabacion {
  id                 String    @id @default(cuid())
  workspaceId        String
  /// Trabajo del pedido; null = grabación de prueba.
  proyectoId         String?
  cassetteNumero     Int?
  /// VHS | DVD
  tipo               String
  /// GRABANDO | COMPLETA | DESCARTADA
  estado             String    @default("GRABANDO")
  /// MANUAL | SIN_SENAL | TOPE | DVD_COMPLETO | TERMINADA_CON_LO_GRABADO
  motivoFin          String?
  mimeType           String
  /// ALTA | MEDIA | BAJA (null en DVD)
  calidad            String?
  corregirProporcion Boolean   @default(false)
  equipoId           String?
  tramos             Int       @default(1)
  duracionSeg        Int       @default(0)
  bytesSubidos       BigInt    @default(0)
  partesListas       Int       @default(0)
  /// Primer segundo con imagen del tramo 1.
  primeraImagenSeg   Int?
  /// Último segundo con imagen, en el tramo `ultimaImagenTramo`.
  ultimaImagenSeg    Int?
  ultimaImagenTramo  Int?
  sinImagen          Boolean   @default(false)
  /// [{ tramo, desde, hasta, clase }]
  tramosSinSenal     Json?
  /// [{ nombre, bytes }] en el orden en que se suben.
  dvdArchivos        Json?
  ultimoLatidoAt     DateTime?
  iniciadaAt         DateTime  @default(now())
  terminadaAt        DateTime?
  createdByUserId    Int?
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  workspace Workspace             @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  proyecto  FotofficeProyecto?    @relation(fields: [proyectoId], references: [id], onDelete: SetNull)
  equipo    DigitalizacionEquipo? @relation(fields: [equipoId], references: [id], onDelete: SetNull)
  partes    DigitalizacionParte[]

  @@index([workspaceId, createdAt])
  @@index([proyectoId])
  @@index([equipoId])
}

model DigitalizacionParte {
  id          String   @id @default(cuid())
  grabacionId String
  tramo       Int
  indice      Int
  key         String   @unique
  bytes       BigInt   @default(0)
  /// PENDIENTE (pidió la subida) | LISTA (confirmada en R2)
  estado      String   @default("PENDIENTE")
  createdAt   DateTime @default(now())

  grabacion DigitalizacionGrabacion @relation(fields: [grabacionId], references: [id], onDelete: Cascade)

  @@unique([grabacionId, tramo, indice])
}

/// Capturadora + conversor de un negocio, por la etiqueta del dispositivo de video.
model DigitalizacionEquipo {
  id                 String   @id @default(cuid())
  workspaceId        String
  etiqueta           String
  /// Grilla 8×6 de colores promedio (144 números) de la pantalla "sin señal".
  huellaSinSenal     Json?
  corregirProporcion Boolean  @default(false)
  updatedAt          DateTime @updatedAt

  workspace   Workspace                 @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  grabaciones DigitalizacionGrabacion[]

  @@unique([workspaceId, etiqueta])
}

model DigitalizacionAjustes {
  workspaceId     String @id
  minutosSinSenal Int    @default(5)

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}
```

En `model Workspace`, junto a `fotofficeArchivosTrabajo`, agregá:

```prisma
  digitalizacionGrabaciones DigitalizacionGrabacion[]
  digitalizacionEquipos     DigitalizacionEquipo[]
  digitalizacionAjustes     DigitalizacionAjustes?
```

En `model FotofficeProyecto`, junto a `archivos`, agregá:

```prisma
  grabaciones   DigitalizacionGrabacion[]
```

- [ ] **Step 2: Validar y generar el cliente**

Run: `pnpm --filter @repo/db exec prisma validate && pnpm --filter @repo/db db:generate`
Expected: "The schema at prisma/schema.prisma is valid" y "Generated Prisma Client".

- [ ] **Step 3: Escribir la migración a mano**

```sql
-- packages/db/prisma/migrations/20261126120000_fotoffice_digitalizacion/migration.sql
-- FOTOFFICE: digitalización de VHS y DVD (parte 1, la grabadora). Sólo tablas nuevas. Idempotente.
CREATE TABLE IF NOT EXISTS "DigitalizacionEquipo" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "etiqueta" TEXT NOT NULL,
    "huellaSinSenal" JSONB,
    "corregirProporcion" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DigitalizacionEquipo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionEquipo_workspaceId_etiqueta_key" ON "DigitalizacionEquipo"("workspaceId", "etiqueta");

CREATE TABLE IF NOT EXISTS "DigitalizacionGrabacion" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "proyectoId" TEXT,
    "cassetteNumero" INTEGER,
    "tipo" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'GRABANDO',
    "motivoFin" TEXT,
    "mimeType" TEXT NOT NULL,
    "calidad" TEXT,
    "corregirProporcion" BOOLEAN NOT NULL DEFAULT false,
    "equipoId" TEXT,
    "tramos" INTEGER NOT NULL DEFAULT 1,
    "duracionSeg" INTEGER NOT NULL DEFAULT 0,
    "bytesSubidos" BIGINT NOT NULL DEFAULT 0,
    "partesListas" INTEGER NOT NULL DEFAULT 0,
    "primeraImagenSeg" INTEGER,
    "ultimaImagenSeg" INTEGER,
    "ultimaImagenTramo" INTEGER,
    "sinImagen" BOOLEAN NOT NULL DEFAULT false,
    "tramosSinSenal" JSONB,
    "dvdArchivos" JSONB,
    "ultimoLatidoAt" TIMESTAMP(3),
    "iniciadaAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "terminadaAt" TIMESTAMP(3),
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DigitalizacionGrabacion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DigitalizacionGrabacion_workspaceId_createdAt_idx" ON "DigitalizacionGrabacion"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "DigitalizacionGrabacion_proyectoId_idx" ON "DigitalizacionGrabacion"("proyectoId");
CREATE INDEX IF NOT EXISTS "DigitalizacionGrabacion_equipoId_idx" ON "DigitalizacionGrabacion"("equipoId");

CREATE TABLE IF NOT EXISTS "DigitalizacionParte" (
    "id" TEXT NOT NULL,
    "grabacionId" TEXT NOT NULL,
    "tramo" INTEGER NOT NULL,
    "indice" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "bytes" BIGINT NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DigitalizacionParte_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionParte_key_key" ON "DigitalizacionParte"("key");
CREATE UNIQUE INDEX IF NOT EXISTS "DigitalizacionParte_grabacionId_tramo_indice_key" ON "DigitalizacionParte"("grabacionId", "tramo", "indice");

CREATE TABLE IF NOT EXISTS "DigitalizacionAjustes" (
    "workspaceId" TEXT NOT NULL,
    "minutosSinSenal" INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT "DigitalizacionAjustes_pkey" PRIMARY KEY ("workspaceId")
);

DO $$ BEGIN
  ALTER TABLE "DigitalizacionEquipo" ADD CONSTRAINT "DigitalizacionEquipo_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionGrabacion" ADD CONSTRAINT "DigitalizacionGrabacion_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionGrabacion" ADD CONSTRAINT "DigitalizacionGrabacion_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "FotofficeProyecto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionGrabacion" ADD CONSTRAINT "DigitalizacionGrabacion_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "DigitalizacionEquipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionParte" ADD CONSTRAINT "DigitalizacionParte_grabacionId_fkey" FOREIGN KEY ("grabacionId") REFERENCES "DigitalizacionGrabacion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DigitalizacionAjustes" ADD CONSTRAINT "DigitalizacionAjustes_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
```

- [ ] **Step 4: Comprobar que el SQL coincide con el schema**

Run: `cd packages/db && npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --script --shadow-database-url "$SHADOW_DATABASE_URL"`

Expected: ninguna sentencia sobre tablas `Digitalizacion*`. Si no hay base sombra disponible (las migraciones no se reproducen desde cero), saltá este paso y anotalo en el PR. La Tarea 13 lo verifica contra la rama de Neon.

- [ ] **Step 5: Commit**

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20261126120000_fotoffice_digitalizacion/migration.sql
git commit -m "Digitalización: tablas de grabaciones, partes, equipos y ajustes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Rasgos y clasificador de cuadros

**Files:**
- Create: `apps/fotoffice/lib/digitalizacion/senal/rasgos.ts`
- Create: `apps/fotoffice/lib/digitalizacion/senal/clasificador.ts`
- Test: `apps/fotoffice/lib/digitalizacion/senal/clasificador.test.ts`

**Interfaces:**
- Produces: `ANCHO = 64`, `ALTO = 36`, `Rasgos`, `calcularRasgos(rgba: Uint8ClampedArray, ancho?, alto?): Rasgos`, `diferenciaMedia(a, b): number`, `correlacion(a, b): number`, `distanciaHuella(a: number[], b: number[]): number`, `promediarHuellas(hs: number[][]): number[]`; `ClaseCuadro`, `CLASES_SIN_SENAL`, `UMBRALES`, `clasificar(actual, anterior, huella, u?): ClaseCuadro`.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// apps/fotoffice/lib/digitalizacion/senal/clasificador.test.ts
import { describe, expect, it } from "vitest";
import { ALTO, ANCHO, calcularRasgos } from "./rasgos";
import { clasificar } from "./clasificador";

function cuadro(fn: (x: number, y: number) => [number, number, number]): Uint8ClampedArray {
  const d = new Uint8ClampedArray(ANCHO * ALTO * 4);
  for (let y = 0; y < ALTO; y++) for (let x = 0; x < ANCHO; x++) {
    const [r, g, b] = fn(x, y);
    const i = (y * ANCHO + x) * 4;
    d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
  }
  return d;
}
function azar(semilla: number) {
  let s = semilla;
  return () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
}
const uniforme = (r: number, g: number, b: number) => calcularRasgos(cuadro(() => [r, g, b]));
const escena = (corrimiento: number) =>
  calcularRasgos(cuadro((x, y) => [(x * 4 + corrimiento) % 256, (y * 7) % 256, ((x + y) * 3) % 256]));
const nieve = (semilla: number) => {
  const r = azar(semilla);
  return calcularRasgos(cuadro(() => { const v = Math.floor(r() * 256); return [v, v, v]; }));
};
const noSignal = () => calcularRasgos(cuadro((x, y) => (x > 20 && x < 44 && y > 14 && y < 22 ? [230, 230, 230] : [30, 30, 30])));

describe("clasificar", () => {
  it("negro", () => expect(clasificar(uniforme(5, 5, 5), null, null)).toBe("NEGRO"));
  it("pantalla azul de la videocasetera", () => expect(clasificar(uniforme(20, 40, 200), null, null)).toBe("AZUL"));
  it("nieve: ruido gris sin relación con el cuadro anterior", () => {
    expect(clasificar(nieve(2), nieve(1), null)).toBe("NIEVE");
  });
  it("una escena que se mueve es imagen", () => expect(clasificar(escena(3), escena(0), null)).toBe("IMAGEN"));
  it("la misma escena dos veces es quieta", () => expect(clasificar(escena(0), escena(0), null)).toBe("QUIETA"));
  it("sin cuadro anterior una escena es imagen", () => expect(clasificar(escena(0), null, null)).toBe("IMAGEN"));
  it("la pantalla calibrada se reconoce por su huella", () => {
    const ns = noSignal();
    expect(clasificar(noSignal(), ns, ns.huella)).toBe("SIN_SENAL_CALIBRADA");
  });
  it("una escena no se confunde con la huella calibrada", () => {
    expect(clasificar(escena(3), escena(0), noSignal().huella)).toBe("IMAGEN");
  });
  it("una escena oscura pero con detalle no es negro", () => {
    const oscura = calcularRasgos(cuadro((x) => [x % 2 ? 40 : 0, x % 2 ? 40 : 0, x % 2 ? 40 : 0]));
    expect(clasificar(oscura, null, null)).toBe("IMAGEN");
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/senal/clasificador.test.ts`
Expected: FAIL (no existe `./rasgos`).

- [ ] **Step 3: Implementar `rasgos.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/senal/rasgos.ts
/** Los números de un cuadro achicado a 64×36. Puro: lo usa el worker y lo prueban los tests. */

export const ANCHO = 64;
export const ALTO = 36;
const COLS = 8;
const FILAS = 6;

export type Rasgos = {
  /** Luma media 0–255. */
  brillo: number;
  /** Desvío estándar de la luma. */
  desvio: number;
  /** Saturación media 0–1. */
  saturacion: number;
  r: number;
  g: number;
  b: number;
  /** Grilla 8×6 de [r, g, b] promedio: 144 números. */
  huella: number[];
  luma: Float32Array;
};

export function calcularRasgos(rgba: Uint8ClampedArray, ancho = ANCHO, alto = ALTO): Rasgos {
  const n = ancho * alto;
  const luma = new Float32Array(n);
  const celdas = new Float64Array(COLS * FILAS * 3);
  const cuentas = new Uint32Array(COLS * FILAS);
  let sr = 0, sg = 0, sb = 0, sl = 0, ss = 0;
  for (let p = 0; p < n; p++) {
    const r = rgba[p * 4], g = rgba[p * 4 + 1], b = rgba[p * 4 + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[p] = l;
    sr += r; sg += g; sb += b; sl += l;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    ss += max === 0 ? 0 : (max - min) / max;
    const x = p % ancho, y = Math.floor(p / ancho);
    const c = Math.min(FILAS - 1, Math.floor((y * FILAS) / alto)) * COLS + Math.min(COLS - 1, Math.floor((x * COLS) / ancho));
    celdas[c * 3] += r; celdas[c * 3 + 1] += g; celdas[c * 3 + 2] += b;
    cuentas[c] += 1;
  }
  const brillo = sl / n;
  let varianza = 0;
  for (let p = 0; p < n; p++) varianza += (luma[p] - brillo) ** 2;
  const huella: number[] = [];
  for (let c = 0; c < COLS * FILAS; c++) {
    const k = cuentas[c] || 1;
    huella.push(celdas[c * 3] / k, celdas[c * 3 + 1] / k, celdas[c * 3 + 2] / k);
  }
  return { brillo, desvio: Math.sqrt(varianza / n), saturacion: ss / n, r: sr / n, g: sg / n, b: sb / n, huella, luma };
}

export function diferenciaMedia(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

/** Correlación de Pearson de la luma de dos cuadros; 0 si alguno es plano. */
export function correlacion(a: Float32Array, b: Float32Array): number {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va < 1e-6 || vb < 1e-6) return 0;
  return cov / Math.sqrt(va * vb);
}

export function distanciaHuella(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

export function promediarHuellas(hs: readonly number[][]): number[] {
  if (hs.length === 0) return [];
  return hs[0].map((_, i) => hs.reduce((s, h) => s + h[i], 0) / hs.length);
}
```

- [ ] **Step 4: Implementar `clasificador.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/senal/clasificador.ts
import { correlacion, diferenciaMedia, distanciaHuella, type Rasgos } from "./rasgos";

/** QUIETA no es "sin señal" por sí sola: lo decide `corte.ts` si dura 60 s o más. */
export type ClaseCuadro = "IMAGEN" | "QUIETA" | "SIN_SENAL_CALIBRADA" | "NEGRO" | "AZUL" | "NIEVE";
export const CLASES_SIN_SENAL: ReadonlySet<ClaseCuadro> = new Set(["SIN_SENAL_CALIBRADA", "NEGRO", "AZUL", "NIEVE"]);

/** Umbrales iniciales; se ajustan con el equipo real en la prueba de la Tarea 13. */
export const UMBRALES = {
  huella: 12,
  negroBrillo: 20,
  negroDesvio: 8,
  azulMin: 100,
  azulSobreRojo: 50,
  azulSobreVerde: 30,
  azulDesvio: 15,
  nieveDesvio: 35,
  nieveSaturacion: 0.12,
  nieveCorrelacion: 0.3,
  quietaDiferencia: 0.5,
} as const;

export function clasificar(
  actual: Rasgos,
  anterior: Rasgos | null,
  huella: readonly number[] | null,
  u: typeof UMBRALES = UMBRALES,
): ClaseCuadro {
  if (huella && distanciaHuella(actual.huella, huella) < u.huella) return "SIN_SENAL_CALIBRADA";
  if (actual.brillo < u.negroBrillo && actual.desvio < u.negroDesvio) return "NEGRO";
  if (actual.b >= u.azulMin && actual.b - actual.r >= u.azulSobreRojo && actual.b - actual.g >= u.azulSobreVerde && actual.desvio <= u.azulDesvio) {
    return "AZUL";
  }
  if (anterior) {
    if (actual.desvio > u.nieveDesvio && actual.saturacion < u.nieveSaturacion && Math.abs(correlacion(actual.luma, anterior.luma)) < u.nieveCorrelacion) {
      return "NIEVE";
    }
    if (diferenciaMedia(actual.luma, anterior.luma) < u.quietaDiferencia) return "QUIETA";
  }
  return "IMAGEN";
}
```

- [ ] **Step 5: Correr el test**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/senal/clasificador.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/digitalizacion/senal/rasgos.ts apps/fotoffice/lib/digitalizacion/senal/clasificador.ts apps/fotoffice/lib/digitalizacion/senal/clasificador.test.ts
git commit -m "Digitalización: clasificar cada cuadro (imagen, negro, azul, nieve, quieta, calibrada)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Máquina de corte y recortes

**Files:**
- Create: `apps/fotoffice/lib/digitalizacion/senal/corte.ts`
- Test: `apps/fotoffice/lib/digitalizacion/senal/corte.test.ts`

**Interfaces:**
- Consumes: `ClaseCuadro`, `CLASES_SIN_SENAL` (Tarea 3); `SEGUNDOS_LATIDO` (Tarea 1).
- Produces: `TramoSinSenal = { desde: number; hasta: number; clase: ClaseSinSenal }`, `ClaseSinSenal`, `EstadoCorte`, `estadoInicial(): EstadoCorte`, `avanzarSegundo(e, clase, minutosSinSenal): { estado; cortar: boolean; sinImagenHaceSeg: number | null }`, `cerrarCorte(e): ResumenCorte`, `ResumenCorte = { duracionSeg; primeraImagenSeg; ultimaImagenSeg; sinImagen; tramos: TramoSinSenal[] }`, `latidoDebido(seg: number): boolean`.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// apps/fotoffice/lib/digitalizacion/senal/corte.test.ts
import { describe, expect, it } from "vitest";
import type { ClaseCuadro } from "./clasificador";
import { avanzarSegundo, cerrarCorte, estadoInicial, latidoDebido } from "./corte";

function correr(clases: ClaseCuadro[], minutos = 5) {
  let e = estadoInicial();
  let cortoEn: number | null = null;
  clases.forEach((c, t) => {
    const r = avanzarSegundo(e, c, minutos);
    e = r.estado;
    if (r.cortar && cortoEn === null) cortoEn = t;
  });
  return { cortoEn, resumen: cerrarCorte(e) };
}
const rep = (c: ClaseCuadro, n: number): ClaseCuadro[] => Array(n).fill(c);

describe("corte automático", () => {
  it("todo imagen: no corta; primera 0 y última la del final", () => {
    const { cortoEn, resumen } = correr(rep("IMAGEN", 50));
    expect(cortoEn).toBeNull();
    expect(resumen).toMatchObject({ duracionSeg: 50, primeraImagenSeg: 0, ultimaImagenSeg: 49, sinImagen: false });
  });
  it("30 s negros al empezar: la primera imagen es la 30", () => {
    expect(correr([...rep("NEGRO", 30), ...rep("IMAGEN", 20)]).resumen.primeraImagenSeg).toBe(30);
  });
  it("corta justo a los 5 minutos sin imagen y recuerda la última imagen", () => {
    const { cortoEn, resumen } = correr([...rep("IMAGEN", 100), ...rep("NIEVE", 400)]);
    expect(cortoEn).toBe(100 + 299);
    expect(resumen.ultimaImagenSeg).toBe(99);
    expect(resumen.tramos).toEqual([{ desde: 100, hasta: 499, clase: "NIEVE" }]);
  });
  it("respeta los minutos configurados", () => {
    expect(correr([...rep("IMAGEN", 10), ...rep("AZUL", 200)], 2).cortoEn).toBe(10 + 119);
  });
  it("dos segundos de imagen no reinician la cuenta; tres sí", () => {
    const dos = [...rep("IMAGEN", 10), ...rep("NEGRO", 150), ...rep("IMAGEN", 2), ...rep("NEGRO", 150)];
    expect(correr(dos).cortoEn).toBe(10 + 299 + 2);
    const tres = [...rep("IMAGEN", 10), ...rep("NEGRO", 150), ...rep("IMAGEN", 3), ...rep("NEGRO", 150)];
    expect(correr(tres).cortoEn).toBeNull();
  });
  it("un parpadeo negro en medio de la película no corta ni se registra", () => {
    const { cortoEn, resumen } = correr([...rep("IMAGEN", 60), "NEGRO", ...rep("IMAGEN", 60)]);
    expect(cortoEn).toBeNull();
    expect(resumen.tramos).toEqual([]);
    expect(resumen.ultimaImagenSeg).toBe(120);
  });
  it("una escena quieta de 30 s es imagen", () => {
    const { cortoEn, resumen } = correr([...rep("IMAGEN", 10), ...rep("QUIETA", 30), ...rep("NEGRO", 20)]);
    expect(cortoEn).toBeNull();
    expect(resumen.ultimaImagenSeg).toBe(39);
  });
  it("quieta 60 s o más es imagen congelada: cuenta desde que se quedó quieta", () => {
    const { cortoEn, resumen } = correr([...rep("IMAGEN", 10), ...rep("QUIETA", 400)]);
    expect(cortoEn).toBe(10 + 299);
    expect(resumen.ultimaImagenSeg).toBe(9);
    expect(resumen.tramos[0]).toMatchObject({ desde: 10, clase: "CONGELADA" });
  });
  it("si termina con una escena quieta corta, esa escena cuenta", () => {
    expect(correr([...rep("IMAGEN", 10), ...rep("QUIETA", 20)]).resumen.ultimaImagenSeg).toBe(29);
  });
  it("todo sin imagen: sinImagen", () => {
    expect(correr(rep("NEGRO", 30)).resumen).toMatchObject({ sinImagen: true, primeraImagenSeg: null, ultimaImagenSeg: null });
  });
  it("informa hace cuánto no hay imagen", () => {
    let e = estadoInicial();
    for (const c of [...rep("IMAGEN", 5), ...rep("NEGRO", 7)] as ClaseCuadro[]) {
      const r = avanzarSegundo(e, c, 5);
      e = r.estado;
      if (e.seg === 12) expect(r.sinImagenHaceSeg).toBe(7);
    }
  });
  it("el latido toca cada 30 segundos", () => {
    expect([0, 29, 30, 59, 60].map(latidoDebido)).toEqual([false, false, true, false, true]);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/senal/corte.test.ts`
Expected: FAIL (no existe `./corte`).

- [ ] **Step 3: Implementar `corte.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/senal/corte.ts
import { SEGUNDOS_LATIDO } from "../constants";
import { CLASES_SIN_SENAL, type ClaseCuadro } from "./clasificador";

export const SEGUNDOS_IMAGEN_PARA_REINICIAR = 3;
export const SEGUNDOS_QUIETA_CONGELADA = 60;
/** Tramos sin señal más cortos no se guardan (un parpadeo no le sirve a nadie). */
export const MIN_SEGUNDOS_TRAMO = 10;

export type ClaseSinSenal = "SIN_SENAL_CALIBRADA" | "NEGRO" | "AZUL" | "NIEVE" | "CONGELADA";
export type TramoSinSenal = { desde: number; hasta: number; clase: ClaseSinSenal };

export type EstadoCorte = {
  /** Próximo segundo a procesar (= segundos ya procesados). */
  seg: number;
  imagenSeguida: number;
  quietaDesde: number | null;
  sinSenalDesde: number | null;
  claseSinSenal: ClaseSinSenal | null;
  primeraImagenSeg: number | null;
  ultimaImagenSeg: number | null;
  tramos: TramoSinSenal[];
};

export type ResumenCorte = {
  duracionSeg: number;
  primeraImagenSeg: number | null;
  ultimaImagenSeg: number | null;
  sinImagen: boolean;
  tramos: TramoSinSenal[];
};

export function estadoInicial(): EstadoCorte {
  return { seg: 0, imagenSeguida: 0, quietaDesde: null, sinSenalDesde: null, claseSinSenal: null, primeraImagenSeg: null, ultimaImagenSeg: null, tramos: [] };
}

export function latidoDebido(seg: number): boolean {
  return seg > 0 && seg % SEGUNDOS_LATIDO === 0;
}

function registrarTramo(tramos: TramoSinSenal[], t: TramoSinSenal): TramoSinSenal[] {
  return t.hasta - t.desde + 1 >= MIN_SEGUNDOS_TRAMO ? [...tramos, t] : tramos;
}

/** Suma `n` segundos de imagen que terminan en `fin`; cierra el tramo sin señal si corresponde. */
function sumarImagen(e: EstadoCorte, n: number, fin: number): EstadoCorte {
  const imagenSeguida = e.imagenSeguida + n;
  let { primeraImagenSeg, sinSenalDesde, claseSinSenal, tramos } = e;
  if (primeraImagenSeg === null && imagenSeguida >= SEGUNDOS_IMAGEN_PARA_REINICIAR) primeraImagenSeg = fin - imagenSeguida + 1;
  if (sinSenalDesde !== null && imagenSeguida >= SEGUNDOS_IMAGEN_PARA_REINICIAR) {
    tramos = registrarTramo(tramos, { desde: sinSenalDesde, hasta: fin - imagenSeguida, clase: claseSinSenal ?? "NEGRO" });
    sinSenalDesde = null;
    claseSinSenal = null;
  }
  return { ...e, imagenSeguida, primeraImagenSeg, ultimaImagenSeg: fin, sinSenalDesde, claseSinSenal, tramos };
}

export function avanzarSegundo(
  anterior: EstadoCorte,
  clase: ClaseCuadro,
  minutosSinSenal: number,
): { estado: EstadoCorte; cortar: boolean; sinImagenHaceSeg: number | null } {
  const t = anterior.seg;
  let e: EstadoCorte = { ...anterior, seg: t + 1 };

  if (clase === "QUIETA") {
    const desde = e.quietaDesde ?? t;
    e = { ...e, quietaDesde: desde };
    if (t - desde + 1 >= SEGUNDOS_QUIETA_CONGELADA && e.sinSenalDesde === null) {
      e = { ...e, sinSenalDesde: desde, claseSinSenal: "CONGELADA", imagenSeguida: 0 };
    }
  } else {
    if (e.quietaDesde !== null) {
      const corrida = t - e.quietaDesde;
      // Una escena quieta corta era imagen; una larga ya quedó como congelada.
      if (corrida < SEGUNDOS_QUIETA_CONGELADA) e = sumarImagen(e, corrida, t - 1);
      e = { ...e, quietaDesde: null };
    }
    if (clase === "IMAGEN") {
      e = sumarImagen(e, 1, t);
    } else if (CLASES_SIN_SENAL.has(clase)) {
      e = { ...e, imagenSeguida: 0 };
      if (e.sinSenalDesde === null) e = { ...e, sinSenalDesde: t, claseSinSenal: clase as ClaseSinSenal };
    }
  }

  const sinImagenHaceSeg = e.sinSenalDesde === null ? null : t - e.sinSenalDesde + 1;
  const cortar = sinImagenHaceSeg !== null && sinImagenHaceSeg >= minutosSinSenal * 60;
  return { estado: e, cortar, sinImagenHaceSeg };
}

export function cerrarCorte(original: EstadoCorte): ResumenCorte {
  let e = original;
  const ultimo = e.seg - 1;
  if (e.quietaDesde !== null && e.seg - e.quietaDesde < SEGUNDOS_QUIETA_CONGELADA) {
    e = sumarImagen({ ...e, quietaDesde: null }, e.seg - e.quietaDesde, ultimo);
  }
  let tramos = e.tramos;
  if (e.sinSenalDesde !== null) tramos = registrarTramo(tramos, { desde: e.sinSenalDesde, hasta: ultimo, clase: e.claseSinSenal ?? "NEGRO" });
  return {
    duracionSeg: e.seg,
    primeraImagenSeg: e.primeraImagenSeg,
    ultimaImagenSeg: e.ultimaImagenSeg,
    sinImagen: e.primeraImagenSeg === null,
    tramos,
  };
}
```

- [ ] **Step 4: Correr el test**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/senal/corte.test.ts`
Expected: PASS (12 tests). Si "dos segundos no reinician" falla por uno, revisá que `imagenSeguida` vuelva a 0 en cada segundo sin señal.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/digitalizacion/senal/corte.ts apps/fotoffice/lib/digitalizacion/senal/corte.test.ts
git commit -m "Digitalización: corte automático y puntos de recorte segundo a segundo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: DVD, validaciones y estado visible

**Files:**
- Create: `apps/fotoffice/lib/digitalizacion/dvd.ts`
- Create: `apps/fotoffice/lib/digitalizacion/validar.ts`
- Test: `apps/fotoffice/lib/digitalizacion/dvd.test.ts`
- Test: `apps/fotoffice/lib/digitalizacion/validar.test.ts`

**Interfaces:**
- Consumes: constantes (Tarea 1), `TramoSinSenal`, `ClaseSinSenal` (Tarea 4), `extensionDeMime`, `ID_VALIDO` (Tarea 1).
- Produces:
  - `ArchivoDvd = { nombre: string; bytes: number }`, `vobsEnOrden<T extends { nombre: string }>(a: T[]): T[]`, `cortesDeArchivo(bytes, tam?): { desde: number; hasta: number }[]`.
  - `EstadoVisible`, `estadoVisible(g, ahora): EstadoVisible`.
  - `NuevaGrabacion`, `validarNuevaGrabacion(x: unknown): NuevaGrabacion | null`.
  - `PedidoParte`, `validarPedidoParte(x: unknown): PedidoParte | null`.
  - `TramoGuardado = TramoSinSenal & { tramo: number }`, `Latido`, `validarLatido(x: unknown): Latido | null`.
  - `Cierre = Latido & { motivoFin }`, `validarCierre(x: unknown): Cierre | null`.

- [ ] **Step 1: Escribir los tests (fallan)**

```ts
// apps/fotoffice/lib/digitalizacion/dvd.test.ts
import { describe, expect, it } from "vitest";
import { cortesDeArchivo, vobsEnOrden } from "./dvd";

describe("DVD", () => {
  it("saltea menús y ordena por título y número", () => {
    const nombres = ["VIDEO_TS.VOB", "VTS_02_1.VOB", "VTS_01_0.VOB", "VTS_01_2.VOB", "VTS_01_1.VOB", "VTS_01_1.IFO", "vts_02_2.vob"];
    expect(vobsEnOrden(nombres.map((nombre) => ({ nombre }))).map((a) => a.nombre))
      .toEqual(["VTS_01_1.VOB", "VTS_01_2.VOB", "VTS_02_1.VOB", "vts_02_2.vob"]);
  });
  it("corta un archivo en pedacitos de 16 MB", () => {
    const mb = 1024 * 1024;
    expect(cortesDeArchivo(40 * mb)).toEqual([
      { desde: 0, hasta: 16 * mb },
      { desde: 16 * mb, hasta: 32 * mb },
      { desde: 32 * mb, hasta: 40 * mb },
    ]);
    expect(cortesDeArchivo(0)).toEqual([]);
  });
});
```

```ts
// apps/fotoffice/lib/digitalizacion/validar.test.ts
import { describe, expect, it } from "vitest";
import { estadoVisible, validarCierre, validarLatido, validarNuevaGrabacion, validarPedidoParte } from "./validar";

const ahora = new Date("2026-11-01T15:00:00Z");
const hace = (s: number) => new Date(ahora.getTime() - s * 1000);

describe("estado visible", () => {
  it("una grabación sin latido hace más de 3 minutos está interrumpida", () => {
    expect(estadoVisible({ estado: "GRABANDO", ultimoLatidoAt: hace(181), iniciadaAt: hace(900) }, ahora)).toBe("INTERRUMPIDA");
    expect(estadoVisible({ estado: "GRABANDO", ultimoLatidoAt: hace(60), iniciadaAt: hace(900) }, ahora)).toBe("GRABANDO");
    expect(estadoVisible({ estado: "GRABANDO", ultimoLatidoAt: null, iniciadaAt: hace(200) }, ahora)).toBe("INTERRUMPIDA");
    expect(estadoVisible({ estado: "COMPLETA", ultimoLatidoAt: hace(9999), iniciadaAt: hace(9999) }, ahora)).toBe("COMPLETA");
  });
});

describe("validaciones", () => {
  it("nueva grabación de VHS y de DVD", () => {
    expect(validarNuevaGrabacion({ tipo: "VHS", proyectoId: "p1", cassetteNumero: 2, calidad: "MEDIA", mimeType: "video/webm;codecs=vp9,opus", corregirProporcion: true, equipoId: null, dvdArchivos: null }))
      .toMatchObject({ tipo: "VHS", cassetteNumero: 2 });
    expect(validarNuevaGrabacion({ tipo: "DVD", proyectoId: null, cassetteNumero: null, calidad: null, mimeType: "video/dvd", corregirProporcion: false, equipoId: null, dvdArchivos: [{ nombre: "VTS_01_1.VOB", bytes: 1000 }] }))
      .toMatchObject({ tipo: "DVD" });
    expect(validarNuevaGrabacion({ tipo: "VHS", proyectoId: "p1", cassetteNumero: 1, calidad: "ULTRA", mimeType: "video/webm", corregirProporcion: false, equipoId: null, dvdArchivos: null })).toBeNull();
    expect(validarNuevaGrabacion({ tipo: "VHS", proyectoId: "../x", cassetteNumero: 1, calidad: "MEDIA", mimeType: "video/webm", corregirProporcion: false, equipoId: null, dvdArchivos: null })).toBeNull();
    expect(validarNuevaGrabacion({ tipo: "DVD", proyectoId: null, cassetteNumero: null, calidad: null, mimeType: "video/dvd", corregirProporcion: false, equipoId: null, dvdArchivos: [] })).toBeNull();
  });
  it("pedido de parte", () => {
    expect(validarPedidoParte({ grabacionId: "g1", tramo: 1, indice: 0, bytes: 1000 })).toEqual({ grabacionId: "g1", tramo: 1, indice: 0, bytes: 1000 });
    expect(validarPedidoParte({ grabacionId: "g1", tramo: 1, indice: 0, bytes: 0 })).toBeNull();
    expect(validarPedidoParte({ grabacionId: "g1", tramo: 1, indice: 0, bytes: 65 * 1024 * 1024 })).toBeNull();
  });
  it("latido y cierre", () => {
    const latido = { tramo: 1, duracionSeg: 120, primeraImagenSeg: 3, ultimaImagenSeg: 119, sinImagen: false, tramosSinSenal: [{ tramo: 1, desde: 0, hasta: 2, clase: "NEGRO" }] };
    expect(validarLatido(latido)).toEqual(latido);
    expect(validarLatido({ ...latido, tramosSinSenal: [{ tramo: 1, desde: 5, hasta: 2, clase: "NEGRO" }] })).toBeNull();
    expect(validarLatido({ ...latido, tramosSinSenal: [{ tramo: 1, desde: 0, hasta: 2, clase: "ROJO" }] })).toBeNull();
    expect(validarCierre({ ...latido, motivoFin: "SIN_SENAL" })).toMatchObject({ motivoFin: "SIN_SENAL" });
    expect(validarCierre({ ...latido, motivoFin: "TERMINADA_CON_LO_GRABADO" })).toBeNull();
  });
});
```

- [ ] **Step 2: Correrlos y ver que fallan**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/dvd.test.ts lib/digitalizacion/validar.test.ts`
Expected: FAIL (no existen los módulos).

- [ ] **Step 3: Implementar `dvd.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/dvd.ts
import { BYTES_PEDACITO_DVD } from "./constants";

export type ArchivoDvd = { nombre: string; bytes: number };

const VOB = /^VTS_(\d{2})_(\d)\.VOB$/i;

/** Los VOB de video en el orden en que se reproducen. Los `_0.VOB` son menús y se saltean. */
export function vobsEnOrden<T extends { nombre: string }>(archivos: T[]): T[] {
  return archivos
    .map((a) => ({ a, m: VOB.exec(a.nombre) }))
    .filter((x): x is { a: T; m: RegExpExecArray } => x.m !== null && Number(x.m[2]) >= 1)
    .sort((x, y) => Number(x.m[1]) - Number(y.m[1]) || Number(x.m[2]) - Number(y.m[2]))
    .map((x) => x.a);
}

export function cortesDeArchivo(bytes: number, tam = BYTES_PEDACITO_DVD): { desde: number; hasta: number }[] {
  const cortes: { desde: number; hasta: number }[] = [];
  for (let desde = 0; desde < bytes; desde += tam) cortes.push({ desde, hasta: Math.min(bytes, desde + tam) });
  return cortes;
}
```

- [ ] **Step 4: Implementar `validar.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/validar.ts
/** Lo que manda el navegador, validado sin base ni sesión. Devuelve null ante cualquier duda. */
import { ID_VALIDO, extensionDeMime } from "./claves";
import { CALIDADES, MAX_BYTES_PARTE, MOTIVOS_FIN_DE_LA_ESTACION, SEGUNDOS_SIN_LATIDO, TOPE_SEGUNDOS, type Calidad, type TipoGrabacion } from "./constants";
import type { ArchivoDvd } from "./dvd";
import type { ClaseSinSenal, TramoSinSenal } from "./senal/corte";

export type EstadoVisible = "GRABANDO" | "COMPLETA" | "DESCARTADA" | "INTERRUMPIDA";

export function estadoVisible(g: { estado: string; ultimoLatidoAt: Date | null; iniciadaAt: Date }, ahora: Date): EstadoVisible {
  if (g.estado === "COMPLETA" || g.estado === "DESCARTADA") return g.estado;
  const ultimo = g.ultimoLatidoAt ?? g.iniciadaAt;
  return ahora.getTime() - ultimo.getTime() > SEGUNDOS_SIN_LATIDO * 1000 ? "INTERRUMPIDA" : "GRABANDO";
}

const esObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const entero = (x: unknown, min: number, max: number): x is number => Number.isInteger(x) && (x as number) >= min && (x as number) <= max;
const idONull = (x: unknown): x is string | null => x === null || (typeof x === "string" && ID_VALIDO.test(x));
const MAX_SEG = TOPE_SEGUNDOS + 600;

export type NuevaGrabacion = {
  tipo: TipoGrabacion;
  proyectoId: string | null;
  cassetteNumero: number | null;
  calidad: Calidad | null;
  mimeType: string;
  corregirProporcion: boolean;
  equipoId: string | null;
  dvdArchivos: ArchivoDvd[] | null;
};

export function validarNuevaGrabacion(x: unknown): NuevaGrabacion | null {
  if (!esObj(x)) return null;
  const { tipo, proyectoId, cassetteNumero, calidad, mimeType, corregirProporcion, equipoId, dvdArchivos } = x;
  if (tipo !== "VHS" && tipo !== "DVD") return null;
  if (!idONull(proyectoId) || !idONull(equipoId)) return null;
  if (cassetteNumero !== null && !entero(cassetteNumero, 1, 999)) return null;
  if (typeof corregirProporcion !== "boolean") return null;
  if (typeof mimeType !== "string" || mimeType.length > 100) return null;
  const ext = extensionDeMime(mimeType);
  if (tipo === "VHS") {
    if (ext !== "mp4" && ext !== "webm") return null;
    if (typeof calidad !== "string" || !(calidad in CALIDADES)) return null;
    if (dvdArchivos !== null) return null;
    return { tipo, proyectoId, cassetteNumero: cassetteNumero as number | null, calidad: calidad as Calidad, mimeType, corregirProporcion, equipoId, dvdArchivos: null };
  }
  if (ext !== "vob" || calidad !== null) return null;
  if (!Array.isArray(dvdArchivos) || dvdArchivos.length === 0 || dvdArchivos.length > 200) return null;
  const archivos: ArchivoDvd[] = [];
  for (const a of dvdArchivos) {
    if (!esObj(a) || typeof a.nombre !== "string" || !/^VTS_\d{2}_[1-9]\.VOB$/i.test(a.nombre) || !entero(a.bytes, 1, 2 ** 31)) return null;
    archivos.push({ nombre: a.nombre, bytes: a.bytes as number });
  }
  return { tipo, proyectoId, cassetteNumero: cassetteNumero as number | null, calidad: null, mimeType, corregirProporcion, equipoId, dvdArchivos: archivos };
}

export type PedidoParte = { grabacionId: string; tramo: number; indice: number; bytes: number };

export function validarPedidoParte(x: unknown): PedidoParte | null {
  if (!esObj(x)) return null;
  const { grabacionId, tramo, indice, bytes } = x;
  if (typeof grabacionId !== "string" || !ID_VALIDO.test(grabacionId)) return null;
  if (!entero(tramo, 1, 999) || !entero(indice, 0, 999_999) || !entero(bytes, 1, MAX_BYTES_PARTE)) return null;
  return { grabacionId, tramo, indice, bytes };
}

const CLASES: ReadonlySet<string> = new Set<ClaseSinSenal>(["SIN_SENAL_CALIBRADA", "NEGRO", "AZUL", "NIEVE", "CONGELADA"]);
export type TramoGuardado = TramoSinSenal & { tramo: number };
export type Latido = {
  /** Tramo al que se refieren duración y última imagen. */
  tramo: number;
  duracionSeg: number;
  primeraImagenSeg: number | null;
  ultimaImagenSeg: number | null;
  sinImagen: boolean;
  tramosSinSenal: TramoGuardado[];
};

export function validarLatido(x: unknown): Latido | null {
  if (!esObj(x)) return null;
  const { tramo, duracionSeg, primeraImagenSeg, ultimaImagenSeg, sinImagen, tramosSinSenal } = x;
  if (!entero(tramo, 1, 999) || !entero(duracionSeg, 0, MAX_SEG) || typeof sinImagen !== "boolean") return null;
  if (primeraImagenSeg !== null && !entero(primeraImagenSeg, 0, MAX_SEG)) return null;
  if (ultimaImagenSeg !== null && !entero(ultimaImagenSeg, 0, MAX_SEG)) return null;
  if (!Array.isArray(tramosSinSenal) || tramosSinSenal.length > 2000) return null;
  const tramos: TramoGuardado[] = [];
  for (const t of tramosSinSenal) {
    if (!esObj(t) || !entero(t.tramo, 1, 999) || !entero(t.desde, 0, MAX_SEG) || !entero(t.hasta, 0, MAX_SEG)) return null;
    if ((t.hasta as number) < (t.desde as number) || typeof t.clase !== "string" || !CLASES.has(t.clase)) return null;
    tramos.push({ tramo: t.tramo as number, desde: t.desde as number, hasta: t.hasta as number, clase: t.clase as ClaseSinSenal });
  }
  return {
    tramo,
    duracionSeg,
    primeraImagenSeg: primeraImagenSeg as number | null,
    ultimaImagenSeg: ultimaImagenSeg as number | null,
    sinImagen,
    tramosSinSenal: tramos,
  };
}

export type Cierre = Latido & { motivoFin: (typeof MOTIVOS_FIN_DE_LA_ESTACION)[number] };

export function validarCierre(x: unknown): Cierre | null {
  const latido = validarLatido(x);
  if (!latido || !esObj(x)) return null;
  const motivo = x.motivoFin;
  if (typeof motivo !== "string" || !(MOTIVOS_FIN_DE_LA_ESTACION as readonly string[]).includes(motivo)) return null;
  return { ...latido, motivoFin: motivo as Cierre["motivoFin"] };
}
```

- [ ] **Step 5: Correr los tests**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/dvd.test.ts lib/digitalizacion/validar.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/digitalizacion/dvd.ts apps/fotoffice/lib/digitalizacion/dvd.test.ts apps/fotoffice/lib/digitalizacion/validar.ts apps/fotoffice/lib/digitalizacion/validar.test.ts
git commit -m "Digitalización: orden de los VOB, validaciones y estado Interrumpida

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Servidor (contexto, almacén, base y acciones)

**Files:**
- Create: `apps/fotoffice/lib/digitalizacion/contexto.ts`
- Create: `apps/fotoffice/lib/digitalizacion/servidor/almacen.ts`
- Create: `apps/fotoffice/lib/digitalizacion/servidor/grabaciones.ts`
- Test: `apps/fotoffice/lib/digitalizacion/servidor/grabaciones.test.ts`
- Create: `apps/fotoffice/app/(shell)/digitalizacion/actions.ts`

**Interfaces:**
- Consumes:
  - `getAuthUser` (`@/lib/auth`), `resolveActiveWorkspace` y `requireActiveWorkspace` (`@/lib/workspace`).
  - `getModuleLevel` (`@/lib/permissions/module-access`), `hasLevel` (`@/lib/permissions/levels`).
  - `bucketR2Privado`, `clienteR2Privado`, `esNoEncontrado` (`@/lib/ficha/adjuntos-r2`).
  - Tareas 1, 2 y 5.
- Produces:
  - `CtxDigitalizacion = { workspaceId: string; userId: number }`.
  - `contextoDigitalizacion(nivel: "VIEW" | "MANAGE"): Promise<CtxDigitalizacion | null>`.
  - `requireDigitalizacion(nivel): Promise<{ user; workspace; puedeGrabar: boolean }>`.
  - `Resultado<T> = ({ ok: true } & T) | { ok: false; error: string; definitivo?: boolean }`.
  - Acciones con estas firmas:
    - `crearGrabacionAction(input: unknown): Promise<Resultado<{ id: string; tramo: number }>>`
    - `pedirParteAction(input: unknown): Promise<Resultado<{ yaEstaba: true } | { yaEstaba: false; url: string; tipoContenido: string }>>`
    - `confirmarParteAction(input: unknown): Promise<Resultado<Nada>>`
    - `latidoAction(grabacionId: string, latido: unknown): Promise<Resultado<Nada>>`
    - `cerrarGrabacionAction(grabacionId: string, cierre: unknown): Promise<Resultado<Nada>>`
    - `continuarGrabacionAction(grabacionId: string): Promise<Resultado<{ tramo: number; tipo: "VHS" | "DVD"; proyectoId: string | null; cassetteNumero: number | null; calidad: string | null; corregirProporcion: boolean }>>`
    - `terminarConLoGrabadoAction(grabacionId: string): Promise<Resultado<Nada>>`
    - `descartarGrabacionAction(grabacionId: string): Promise<Resultado<Nada>>`
    - `urlsDeLecturaAction(grabacionId: string): Promise<Resultado<{ urls: string[]; nombre: string }>>`
    - `buscarTrabajosAction(q: string): Promise<Resultado<{ trabajos: { id: string; numero: string; nombre: string }[] }>>`
    - `guardarEquipoAction(input: unknown): Promise<Resultado<{ id: string }>>`
    - `guardarAjustesAction(minutos: number): Promise<Resultado<Nada>>`
  - Lectura para páginas: `listarGrabaciones(workspaceId)`, `leerAjustes(workspaceId): Promise<{ minutosSinSenal: number }>`, `listarEquipos(workspaceId)`, `leerGrabacionParaContinuar(workspaceId, id)`.

- [ ] **Step 1: Escribir el test de la base (falla)**

```ts
// apps/fotoffice/lib/digitalizacion/servidor/grabaciones.test.ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  fotofficeProyecto: { findFirst: vi.fn() },
  digitalizacionGrabacion: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  digitalizacionParte: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  digitalizacionEquipo: { findFirst: vi.fn() },
  $transaction: vi.fn(async (fn: (tx: unknown) => unknown) => fn(db)),
}));
vi.mock("@repo/db", () => ({ prisma: db }));
const almacen = vi.hoisted(() => ({ urlDeSubidaParte: vi.fn(async () => "https://r2/firmada"), tamanoDeParte: vi.fn(), urlDeLecturaParte: vi.fn(), borrarPrefijo: vi.fn() }));
vi.mock("./almacen", () => almacen);

import { confirmarParte, crearGrabacion, pedirParte } from "./grabaciones";

const ctx = { workspaceId: "ws1", userId: 7 };
const vhs = { tipo: "VHS", proyectoId: "p1", cassetteNumero: 1, calidad: "MEDIA", mimeType: "video/webm;codecs=vp9,opus", corregirProporcion: false, equipoId: null, dvdArchivos: null };

beforeEach(() => vi.clearAllMocks());

describe("crearGrabacion", () => {
  it("rechaza un trabajo de otro negocio", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue(null);
    expect(await crearGrabacion(ctx, vhs)).toMatchObject({ ok: false });
    expect(db.fotofficeProyecto.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "p1", workspaceId: "ws1" } }));
    expect(db.digitalizacionGrabacion.create).not.toHaveBeenCalled();
  });
  it("crea la grabación del negocio", async () => {
    db.fotofficeProyecto.findFirst.mockResolvedValue({ id: "p1" });
    db.digitalizacionGrabacion.create.mockResolvedValue({ id: "g1" });
    expect(await crearGrabacion(ctx, vhs)).toEqual({ ok: true, id: "g1", tramo: 1 });
  });
});

describe("pedirParte", () => {
  it("no firma partes de una grabación ajena", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue(null);
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0, bytes: 10 })).toMatchObject({ ok: false, definitivo: true });
  });
  it("una parte ya LISTA no se vuelve a subir", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue({ estado: "LISTA" });
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 3, bytes: 10 })).toEqual({ ok: true, yaEstaba: true });
    expect(almacen.urlDeSubidaParte).not.toHaveBeenCalled();
  });
  it("firma la clave armada por el servidor", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue(null);
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 1, indice: 3, bytes: 10 })).toEqual({ ok: true, yaEstaba: false, url: "https://r2/firmada", tipoContenido: "video/webm" });
    expect(almacen.urlDeSubidaParte).toHaveBeenCalledWith("digitalizacion/ws1/g1/t1/000003.webm", "video/webm", 10);
  });
  it("no acepta un tramo que todavía no existe", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    expect(await pedirParte(ctx, { grabacionId: "g1", tramo: 2, indice: 0, bytes: 10 })).toMatchObject({ ok: false, definitivo: true });
  });
});

describe("confirmarParte", () => {
  it("cuenta los bytes una sola vez aunque se confirme dos veces", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue({ id: "pa1", key: "digitalizacion/ws1/g1/t1/000000.webm", bytes: BigInt(10), estado: "PENDIENTE" });
    almacen.tamanoDeParte.mockResolvedValue(10);
    db.digitalizacionParte.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    await confirmarParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0 });
    await confirmarParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0 });
    expect(db.digitalizacionGrabacion.update).toHaveBeenCalledTimes(1);
  });
  it("si el tamaño en R2 no coincide, no la confirma", async () => {
    db.digitalizacionGrabacion.findFirst.mockResolvedValue({ id: "g1", workspaceId: "ws1", estado: "GRABANDO", mimeType: "video/webm", tramos: 1 });
    db.digitalizacionParte.findUnique.mockResolvedValue({ id: "pa1", key: "k", bytes: BigInt(10), estado: "PENDIENTE" });
    almacen.tamanoDeParte.mockResolvedValue(4);
    expect(await confirmarParte(ctx, { grabacionId: "g1", tramo: 1, indice: 0 })).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/servidor/grabaciones.test.ts`
Expected: FAIL (no existe `./grabaciones`).

- [ ] **Step 3: Implementar el contexto**

```ts
// apps/fotoffice/lib/digitalizacion/contexto.ts
import "server-only";
import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { requireActiveWorkspace, resolveActiveWorkspace } from "@/lib/workspace";
import { getModuleLevel } from "@/lib/permissions/module-access";
import { hasLevel } from "@/lib/permissions/levels";
import { DIGITALIZACION_MODULE_KEY } from "./constants";

/**
 * Guarda de Digitalización. `getModuleLevel` ya incluye si el módulo está encendido en ESE negocio
 * y el rol de la persona. VIEW = ver la lista; MANAGE = grabar, continuar, terminar y descartar.
 */
export type CtxDigitalizacion = { workspaceId: string; userId: number };

export async function contextoDigitalizacion(nivel: "VIEW" | "MANAGE"): Promise<CtxDigitalizacion | null> {
  const user = await getAuthUser();
  if (!user) return null;
  const workspace = await resolveActiveWorkspace(user.id);
  if (!workspace) return null;
  const level = await getModuleLevel(user.id, workspace.id, DIGITALIZACION_MODULE_KEY);
  if (!hasLevel(level, nivel)) return null;
  return { workspaceId: workspace.id, userId: user.id };
}

export async function requireDigitalizacion(nivel: "VIEW" | "MANAGE") {
  const { user, workspace } = await requireActiveWorkspace();
  if (!workspace) redirect("/workspace");
  const level = await getModuleLevel(user.id, workspace.id, DIGITALIZACION_MODULE_KEY);
  if (!hasLevel(level, nivel)) redirect("/dashboard");
  return { user, workspace, puedeGrabar: hasLevel(level, "MANAGE") };
}
```

- [ ] **Step 4: Implementar el almacén**

```ts
// apps/fotoffice/lib/digitalizacion/servidor/almacen.ts
import "server-only";
import { DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { bucketR2Privado, clienteR2Privado, esNoEncontrado } from "@/lib/ficha/adjuntos-r2";
import { MAX_BYTES_PARTE } from "../constants";
import { esClaveDeParte } from "../claves";

const SEGUNDOS_SUBIDA = 15 * 60;
/** "Descargar crudo" de 3 horas puede tardar: la lectura dura 6 horas. */
const SEGUNDOS_LECTURA = 6 * 3600;

export async function urlDeSubidaParte(clave: string, tipo: string, bytes: number): Promise<string> {
  if (!esClaveDeParte(clave)) throw new Error("Clave no válida");
  if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_BYTES_PARTE) throw new Error("Tamaño no permitido");
  const cmd = new PutObjectCommand({ Bucket: bucketR2Privado(), Key: clave, ContentType: tipo, ContentLength: bytes });
  return getSignedUrl(clienteR2Privado(), cmd, { expiresIn: SEGUNDOS_SUBIDA, signableHeaders: new Set(["content-type", "content-length"]) });
}

export async function urlDeLecturaParte(clave: string): Promise<string> {
  if (!esClaveDeParte(clave)) throw new Error("Clave no válida");
  return getSignedUrl(clienteR2Privado(), new GetObjectCommand({ Bucket: bucketR2Privado(), Key: clave }), { expiresIn: SEGUNDOS_LECTURA });
}

export async function tamanoDeParte(clave: string): Promise<number | null> {
  try {
    const r = await clienteR2Privado().send(new HeadObjectCommand({ Bucket: bucketR2Privado(), Key: clave }));
    return typeof r.ContentLength === "number" ? r.ContentLength : null;
  } catch (e) {
    if (esNoEncontrado(e)) return null;
    throw e;
  }
}

/** Borra todo lo que esté bajo `digitalizacion/<ws>/<grabacion>/`, de a 1000 objetos. */
export async function borrarPrefijo(prefijo: string): Promise<void> {
  if (!/^digitalizacion\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9_-]{1,64}\/$/.test(prefijo)) throw new Error("Prefijo no válido");
  const s3 = clienteR2Privado();
  let token: string | undefined;
  do {
    const lista = await s3.send(new ListObjectsV2Command({ Bucket: bucketR2Privado(), Prefix: prefijo, ContinuationToken: token }));
    const claves = (lista.Contents ?? []).map((o) => o.Key).filter((k): k is string => typeof k === "string");
    if (claves.length) await s3.send(new DeleteObjectsCommand({ Bucket: bucketR2Privado(), Delete: { Objects: claves.map((Key) => ({ Key })), Quiet: true } }));
    token = lista.IsTruncated ? lista.NextContinuationToken : undefined;
  } while (token);
}
```

- [ ] **Step 5: Implementar `grabaciones.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/servidor/grabaciones.ts
import "server-only";
import { prisma } from "@repo/db";
import { ID_VALIDO, claveDeParte, extensionDeMime, prefijoDeGrabacion, tipoContenido } from "../claves";
import { MINUTOS_SIN_SENAL_MAX, MINUTOS_SIN_SENAL_MIN, MINUTOS_SIN_SENAL_POR_DEFECTO } from "../constants";
import type { CtxDigitalizacion } from "../contexto";
import type { Cierre, Latido, NuevaGrabacion, PedidoParte } from "../validar";
import { borrarPrefijo, tamanoDeParte, urlDeLecturaParte, urlDeSubidaParte } from "./almacen";

export type Nada = Record<never, never>;
export type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string; definitivo?: boolean };

const NO_EXISTE = { ok: false as const, error: "No encontramos esa grabación.", definitivo: true };
const CERRADA = { ok: false as const, error: "Esa grabación ya está cerrada.", definitivo: true };

async function grabacionDelNegocio(ctx: CtxDigitalizacion, id: string) {
  if (!ID_VALIDO.test(id)) return null;
  return prisma.digitalizacionGrabacion.findFirst({
    where: { id, workspaceId: ctx.workspaceId },
    select: { id: true, workspaceId: true, estado: true, mimeType: true, tramos: true, tipo: true, proyectoId: true, cassetteNumero: true, calidad: true, corregirProporcion: true },
  });
}

export async function crearGrabacion(ctx: CtxDigitalizacion, g: NuevaGrabacion): Promise<Resultado<{ id: string; tramo: number }>> {
  if (g.proyectoId) {
    const p = await prisma.fotofficeProyecto.findFirst({ where: { id: g.proyectoId, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!p) return { ok: false, error: "No encontramos ese trabajo." };
  }
  if (g.equipoId) {
    const e = await prisma.digitalizacionEquipo.findFirst({ where: { id: g.equipoId, workspaceId: ctx.workspaceId }, select: { id: true } });
    if (!e) return { ok: false, error: "No encontramos ese equipo." };
  }
  const creada = await prisma.digitalizacionGrabacion.create({
    data: {
      workspaceId: ctx.workspaceId,
      proyectoId: g.proyectoId,
      cassetteNumero: g.cassetteNumero,
      tipo: g.tipo,
      mimeType: g.mimeType,
      calidad: g.calidad,
      corregirProporcion: g.corregirProporcion,
      equipoId: g.equipoId,
      dvdArchivos: g.dvdArchivos ?? undefined,
      ultimoLatidoAt: new Date(),
      createdByUserId: ctx.userId,
    },
    select: { id: true },
  });
  return { ok: true, id: creada.id, tramo: 1 };
}

export async function pedirParte(
  ctx: CtxDigitalizacion,
  p: PedidoParte,
): Promise<Resultado<{ yaEstaba: true } | { yaEstaba: false; url: string; tipoContenido: string }>> {
  const g = await grabacionDelNegocio(ctx, p.grabacionId);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  if (p.tramo > g.tramos) return { ok: false, error: "Ese tramo no existe.", definitivo: true };
  const ext = extensionDeMime(g.mimeType);
  if (!ext) return { ok: false, error: "Formato no válido.", definitivo: true };
  const existente = await prisma.digitalizacionParte.findUnique({
    where: { grabacionId_tramo_indice: { grabacionId: g.id, tramo: p.tramo, indice: p.indice } },
    select: { estado: true },
  });
  if (existente?.estado === "LISTA") return { ok: true, yaEstaba: true };
  const key = claveDeParte({ workspaceId: ctx.workspaceId, grabacionId: g.id, tramo: p.tramo, indice: p.indice, extension: ext });
  await prisma.digitalizacionParte.upsert({
    where: { grabacionId_tramo_indice: { grabacionId: g.id, tramo: p.tramo, indice: p.indice } },
    create: { grabacionId: g.id, tramo: p.tramo, indice: p.indice, key, bytes: BigInt(p.bytes) },
    update: { bytes: BigInt(p.bytes) },
  });
  const tipo = tipoContenido(ext);
  return { ok: true, yaEstaba: false, url: await urlDeSubidaParte(key, tipo, p.bytes), tipoContenido: tipo };
}

export async function confirmarParte(ctx: CtxDigitalizacion, p: Omit<PedidoParte, "bytes">): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, p.grabacionId);
  if (!g) return NO_EXISTE;
  const parte = await prisma.digitalizacionParte.findUnique({
    where: { grabacionId_tramo_indice: { grabacionId: g.id, tramo: p.tramo, indice: p.indice } },
    select: { id: true, key: true, bytes: true, estado: true },
  });
  if (!parte) return { ok: false, error: "No encontramos esa parte." };
  if (parte.estado === "LISTA") return { ok: true };
  const tamano = await tamanoDeParte(parte.key);
  if (tamano === null || BigInt(tamano) !== parte.bytes) return { ok: false, error: "La parte no llegó completa." };
  await prisma.$transaction(async (tx) => {
    const r = await tx.digitalizacionParte.updateMany({ where: { id: parte.id, estado: "PENDIENTE" }, data: { estado: "LISTA" } });
    if (r.count === 1) {
      await tx.digitalizacionGrabacion.update({ where: { id: g.id }, data: { bytesSubidos: { increment: parte.bytes }, partesListas: { increment: 1 } } });
    }
  });
  return { ok: true };
}

function datosDeLatido(l: Latido, tramoActual: number, previo: unknown) {
  // Los tramos sin señal de tramos anteriores se conservan; los del tramo actual se reemplazan.
  const anteriores = Array.isArray(previo) ? (previo as { tramo: number }[]).filter((t) => t.tramo !== tramoActual) : [];
  return {
    duracionSeg: l.duracionSeg,
    ...(tramoActual === 1 ? { primeraImagenSeg: l.primeraImagenSeg, sinImagen: l.sinImagen } : {}),
    ...(l.ultimaImagenSeg !== null ? { ultimaImagenSeg: l.ultimaImagenSeg, ultimaImagenTramo: tramoActual } : {}),
    tramosSinSenal: [...anteriores, ...l.tramosSinSenal.filter((t) => t.tramo === tramoActual)],
    ultimoLatidoAt: new Date(),
  };
}

export async function registrarLatido(ctx: CtxDigitalizacion, id: string, l: Latido): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  if (l.tramo !== g.tramos) return { ok: false, error: "Ese tramo ya no es el actual.", definitivo: true };
  const previo = await prisma.digitalizacionGrabacion.findFirst({ where: { id: g.id }, select: { tramosSinSenal: true } });
  await prisma.digitalizacionGrabacion.update({ where: { id: g.id }, data: datosDeLatido(l, g.tramos, previo?.tramosSinSenal) });
  return { ok: true };
}

export async function cerrarGrabacion(ctx: CtxDigitalizacion, id: string, c: Cierre): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  if (c.tramo !== g.tramos) return { ok: false, error: "Ese tramo ya no es el actual.", definitivo: true };
  const previo = await prisma.digitalizacionGrabacion.findFirst({ where: { id: g.id }, select: { tramosSinSenal: true } });
  await prisma.digitalizacionGrabacion.update({
    where: { id: g.id },
    data: { ...datosDeLatido(c, g.tramos, previo?.tramosSinSenal), estado: "COMPLETA", motivoFin: c.motivoFin, terminadaAt: new Date() },
  });
  return { ok: true };
}

export async function continuarGrabacion(ctx: CtxDigitalizacion, id: string) {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  if (g.estado !== "GRABANDO") return CERRADA;
  // Un DVD se retoma en el mismo tramo: las partes ya LISTAS se saltean solas.
  const tramo = g.tipo === "DVD" ? 1 : g.tramos + 1;
  await prisma.digitalizacionGrabacion.update({ where: { id: g.id }, data: { tramos: tramo, ultimoLatidoAt: new Date() } });
  return {
    ok: true as const,
    tramo,
    tipo: g.tipo as "VHS" | "DVD",
    proyectoId: g.proyectoId,
    cassetteNumero: g.cassetteNumero,
    calidad: g.calidad,
    corregirProporcion: g.corregirProporcion,
  };
}

export async function terminarConLoGrabado(ctx: CtxDigitalizacion, id: string): Promise<Resultado<Nada>> {
  const r = await prisma.digitalizacionGrabacion.updateMany({
    where: { id, workspaceId: ctx.workspaceId, estado: "GRABANDO" },
    data: { estado: "COMPLETA", motivoFin: "TERMINADA_CON_LO_GRABADO", terminadaAt: new Date() },
  });
  return r.count === 1 ? { ok: true } : NO_EXISTE;
}

export async function descartarGrabacion(ctx: CtxDigitalizacion, id: string): Promise<Resultado<Nada>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  await prisma.digitalizacionGrabacion.update({ where: { id: g.id }, data: { estado: "DESCARTADA", terminadaAt: new Date() } });
  await borrarPrefijo(prefijoDeGrabacion(ctx.workspaceId, g.id));
  return { ok: true };
}

export async function urlsDeLectura(ctx: CtxDigitalizacion, id: string): Promise<Resultado<{ urls: string[]; nombre: string }>> {
  const g = await grabacionDelNegocio(ctx, id);
  if (!g) return NO_EXISTE;
  const partes = await prisma.digitalizacionParte.findMany({
    where: { grabacionId: g.id, estado: "LISTA" },
    orderBy: [{ tramo: "asc" }, { indice: "asc" }],
    select: { key: true },
  });
  const urls = await Promise.all(partes.map((p) => urlDeLecturaParte(p.key)));
  return { ok: true, urls, nombre: `grabacion-${g.id}.${extensionDeMime(g.mimeType) ?? "bin"}` };
}

export async function buscarTrabajos(ctx: CtxDigitalizacion, q: string) {
  const texto = q.trim().slice(0, 60);
  const trabajos = await prisma.fotofficeProyecto.findMany({
    where: {
      workspaceId: ctx.workspaceId,
      ...(texto ? { OR: [{ number: { contains: texto } }, { name: { contains: texto, mode: "insensitive" as const } }] } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { id: true, number: true, name: true },
  });
  return { ok: true as const, trabajos: trabajos.map((t) => ({ id: t.id, numero: t.number, nombre: t.name })) };
}

export async function guardarEquipo(ctx: CtxDigitalizacion, x: unknown): Promise<Resultado<{ id: string }>> {
  if (typeof x !== "object" || x === null) return { ok: false, error: "Los datos no son válidos." };
  const { etiqueta, huellaSinSenal, corregirProporcion } = x as Record<string, unknown>;
  if (typeof etiqueta !== "string" || etiqueta.length < 1 || etiqueta.length > 200) return { ok: false, error: "Los datos no son válidos." };
  if (typeof corregirProporcion !== "boolean") return { ok: false, error: "Los datos no son válidos." };
  const huellaOk = huellaSinSenal === null || (Array.isArray(huellaSinSenal) && huellaSinSenal.length === 144 && huellaSinSenal.every((n) => typeof n === "number" && n >= 0 && n <= 255));
  if (!huellaOk) return { ok: false, error: "Los datos no son válidos." };
  const e = await prisma.digitalizacionEquipo.upsert({
    where: { workspaceId_etiqueta: { workspaceId: ctx.workspaceId, etiqueta } },
    create: { workspaceId: ctx.workspaceId, etiqueta, huellaSinSenal: huellaSinSenal ?? undefined, corregirProporcion },
    update: { ...(huellaSinSenal ? { huellaSinSenal } : {}), corregirProporcion },
    select: { id: true },
  });
  return { ok: true, id: e.id };
}

export async function guardarAjustes(ctx: CtxDigitalizacion, minutos: number): Promise<Resultado<Nada>> {
  if (!Number.isInteger(minutos) || minutos < MINUTOS_SIN_SENAL_MIN || minutos > MINUTOS_SIN_SENAL_MAX) {
    return { ok: false, error: `Elegí entre ${MINUTOS_SIN_SENAL_MIN} y ${MINUTOS_SIN_SENAL_MAX} minutos.` };
  }
  await prisma.digitalizacionAjustes.upsert({
    where: { workspaceId: ctx.workspaceId },
    create: { workspaceId: ctx.workspaceId, minutosSinSenal: minutos },
    update: { minutosSinSenal: minutos },
  });
  return { ok: true };
}

export async function leerAjustes(workspaceId: string): Promise<{ minutosSinSenal: number }> {
  const a = await prisma.digitalizacionAjustes.findUnique({ where: { workspaceId }, select: { minutosSinSenal: true } });
  return { minutosSinSenal: a?.minutosSinSenal ?? MINUTOS_SIN_SENAL_POR_DEFECTO };
}

export async function listarEquipos(workspaceId: string) {
  const equipos = await prisma.digitalizacionEquipo.findMany({
    where: { workspaceId },
    select: { id: true, etiqueta: true, huellaSinSenal: true, corregirProporcion: true },
  });
  return equipos.map((e) => ({ ...e, huellaSinSenal: Array.isArray(e.huellaSinSenal) ? (e.huellaSinSenal as number[]) : null }));
}

export async function listarGrabaciones(workspaceId: string) {
  return prisma.digitalizacionGrabacion.findMany({
    where: { workspaceId, estado: { not: "DESCARTADA" } },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true, tipo: true, estado: true, motivoFin: true, cassetteNumero: true, duracionSeg: true, bytesSubidos: true,
      tramos: true, ultimoLatidoAt: true, iniciadaAt: true, sinImagen: true,
      proyecto: { select: { number: true, name: true } },
    },
  });
}
```

Agregale a `db` del test los métodos `findMany` que use la implementación si el test los necesita. Los cinco casos del Step 1 sólo usan los que ya están en el `vi.hoisted`.

- [ ] **Step 6: Correr el test**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/servidor/grabaciones.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 7: Escribir las acciones de servidor**

```ts
// apps/fotoffice/app/(shell)/digitalizacion/actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { contextoDigitalizacion } from "@/lib/digitalizacion/contexto";
import * as G from "@/lib/digitalizacion/servidor/grabaciones";
import { validarCierre, validarLatido, validarNuevaGrabacion, validarPedidoParte } from "@/lib/digitalizacion/validar";

const SIN_PERMISO = { ok: false as const, error: "No tenés permiso para hacer esto.", definitivo: true };
const INVALIDO = { ok: false as const, error: "Los datos no son válidos.", definitivo: true };

export async function crearGrabacionAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const g = validarNuevaGrabacion(input);
  return g ? G.crearGrabacion(ctx, g) : INVALIDO;
}

export async function pedirParteAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const p = validarPedidoParte(input);
  return p ? G.pedirParte(ctx, p) : INVALIDO;
}

export async function confirmarParteAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const p = validarPedidoParte({ ...(input as object), bytes: 1 });
  return p ? G.confirmarParte(ctx, { grabacionId: p.grabacionId, tramo: p.tramo, indice: p.indice }) : INVALIDO;
}

export async function latidoAction(grabacionId: string, latido: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const l = validarLatido(latido);
  return l ? G.registrarLatido(ctx, grabacionId, l) : INVALIDO;
}

export async function cerrarGrabacionAction(grabacionId: string, cierre: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const c = validarCierre(cierre);
  if (!c) return INVALIDO;
  const r = await G.cerrarGrabacion(ctx, grabacionId, c);
  revalidatePath("/digitalizacion");
  return r;
}

export async function continuarGrabacionAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  return ctx ? G.continuarGrabacion(ctx, grabacionId) : SIN_PERMISO;
}

export async function terminarConLoGrabadoAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.terminarConLoGrabado(ctx, grabacionId);
  revalidatePath("/digitalizacion");
  return r;
}

export async function descartarGrabacionAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.descartarGrabacion(ctx, grabacionId);
  revalidatePath("/digitalizacion");
  return r;
}

export async function urlsDeLecturaAction(grabacionId: string) {
  const ctx = await contextoDigitalizacion("VIEW");
  return ctx ? G.urlsDeLectura(ctx, grabacionId) : SIN_PERMISO;
}

export async function buscarTrabajosAction(q: string) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  return G.buscarTrabajos(ctx, typeof q === "string" ? q : "");
}

export async function guardarEquipoAction(input: unknown) {
  const ctx = await contextoDigitalizacion("MANAGE");
  return ctx ? G.guardarEquipo(ctx, input) : SIN_PERMISO;
}

export async function guardarAjustesAction(minutos: number) {
  const ctx = await contextoDigitalizacion("MANAGE");
  if (!ctx) return SIN_PERMISO;
  const r = await G.guardarAjustes(ctx, minutos);
  revalidatePath("/digitalizacion");
  return r;
}
```

- [ ] **Step 8: Typecheck de lo nuevo**

Run: `pnpm --filter fotoffice typecheck 2>&1 | tail -20; echo "salida=$?"`

Expected: sin errores en `lib/digitalizacion` ni en `app/(shell)/digitalizacion`. **Ojo:** el typecheck puede morir por memoria y devolver éxito. Si la salida no muestra el final normal de `tsc`, repetilo con `NODE_OPTIONS=--max-old-space-size=8192`.

- [ ] **Step 9: Commit**

```bash
git add apps/fotoffice/lib/digitalizacion/contexto.ts apps/fotoffice/lib/digitalizacion/servidor apps/fotoffice/app/\(shell\)/digitalizacion/actions.ts
git commit -m "Digitalización: servidor de grabaciones, partes firmadas, equipos y ajustes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Cola de subida persistente

**Files:**
- Create: `apps/fotoffice/lib/digitalizacion/cliente/cola.ts`
- Create: `apps/fotoffice/lib/digitalizacion/cliente/almacen-indexeddb.ts`
- Test: `apps/fotoffice/lib/digitalizacion/cliente/cola.test.ts`

**Interfaces:**
- Produces:
  - `ParteEnCola = { id: string; grabacionId: string; tramo: number; indice: number; datos: Blob }`, `idParte(grabacionId, tramo, indice): string`.
  - `AlmacenCola` (interfaz con `guardar`, `borrar`, `pendientes`), `almacenEnMemoria(): AlmacenCola`.
  - `ErrorDefinitivo`, `esperaReintento(intento): number`.
  - `ResumenCola = { pendientes: number; bytesPendientes: number; ultimoError: string | null; descartadas: number }`.
  - `class ColaDeSubida { constructor(almacen, subir, opciones?); agregar(p): Promise<void>; reanudar(): Promise<void>; resumen(): ResumenCola; vaciada(): Promise<void> }`.
  - `almacenIndexedDb(): AlmacenCola`.

- [ ] **Step 1: Escribir el test (falla)**

```ts
// apps/fotoffice/lib/digitalizacion/cliente/cola.test.ts
import { describe, expect, it, vi } from "vitest";
import { ColaDeSubida, ErrorDefinitivo, almacenEnMemoria, esperaReintento, idParte, type ParteEnCola } from "./cola";

const parte = (indice: number, grabacionId = "g1"): ParteEnCola => ({ id: idParte(grabacionId, 1, indice), grabacionId, tramo: 1, indice, datos: new Blob([new Uint8Array(10)]) });
const sinEspera = async () => {};

describe("ColaDeSubida", () => {
  it("la espera crece y tiene techo", () => {
    expect([0, 1, 2, 5, 10].map(esperaReintento)).toEqual([2000, 4000, 8000, 60000, 60000]);
  });
  it("sube todo, reintenta lo que falla y borra lo subido del almacén", async () => {
    const almacen = almacenEnMemoria();
    let fallas = 2;
    const subir = vi.fn(async (p: ParteEnCola) => { if (p.indice === 1 && fallas-- > 0) throw new Error("sin red"); });
    const cola = new ColaDeSubida(almacen, subir, { dormir: sinEspera });
    await Promise.all([0, 1, 2].map((i) => cola.agregar(parte(i))));
    await cola.vaciada();
    expect(subir).toHaveBeenCalledTimes(5);
    expect(await almacen.pendientes()).toEqual([]);
    expect(cola.resumen()).toMatchObject({ pendientes: 0, bytesPendientes: 0 });
  });
  it("nunca sube más de 2 a la vez", async () => {
    let enVuelo = 0, maximo = 0;
    const subir = async () => { enVuelo++; maximo = Math.max(maximo, enVuelo); await new Promise((r) => setTimeout(r, 5)); enVuelo--; };
    const cola = new ColaDeSubida(almacenEnMemoria(), subir, { dormir: sinEspera });
    await Promise.all([0, 1, 2, 3, 4].map((i) => cola.agregar(parte(i))));
    await cola.vaciada();
    expect(maximo).toBe(2);
  });
  it("un error definitivo descarta la parte en vez de reintentar para siempre", async () => {
    const almacen = almacenEnMemoria();
    const cola = new ColaDeSubida(almacen, async () => { throw new ErrorDefinitivo("cerrada"); }, { dormir: sinEspera });
    await cola.agregar(parte(0));
    await cola.vaciada();
    expect(await almacen.pendientes()).toEqual([]);
    expect(cola.resumen().descartadas).toBe(1);
  });
  it("reanudar sube primero lo que quedó guardado, en orden", async () => {
    const almacen = almacenEnMemoria();
    await almacen.guardar(parte(1));
    await almacen.guardar(parte(0));
    const orden: number[] = [];
    const cola = new ColaDeSubida(almacen, async (p) => { orden.push(p.indice); }, { dormir: sinEspera, concurrencia: 1 });
    await cola.reanudar();
    await cola.vaciada();
    expect(orden).toEqual([0, 1]);
  });
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/cliente/cola.test.ts`
Expected: FAIL (no existe `./cola`).

- [ ] **Step 3: Implementar `cola.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/cliente/cola.ts
/**
 * Cola de subida de pedacitos: los guarda antes de intentar (sobreviven a un corte de red o a
 * recargar), sube de a 2 y reintenta con espera creciente mientras la página esté abierta.
 * El almacén y la subida se inyectan: los tests usan memoria; la estación, IndexedDB.
 */

export type ParteEnCola = { id: string; grabacionId: string; tramo: number; indice: number; datos: Blob };

export interface AlmacenCola {
  guardar(p: ParteEnCola): Promise<void>;
  borrar(id: string): Promise<void>;
  pendientes(): Promise<ParteEnCola[]>;
}

export type ResumenCola = { pendientes: number; bytesPendientes: number; ultimoError: string | null; descartadas: number };

/** El servidor dijo que no tiene sentido reintentar (grabación cerrada, ajena o descartada). */
export class ErrorDefinitivo extends Error {}

export function idParte(grabacionId: string, tramo: number, indice: number): string {
  return `${grabacionId}:${tramo}:${String(indice).padStart(6, "0")}`;
}

export function esperaReintento(intento: number): number {
  return Math.min(60_000, 2000 * 2 ** intento);
}

export function almacenEnMemoria(): AlmacenCola {
  const m = new Map<string, ParteEnCola>();
  return {
    async guardar(p) { m.set(p.id, p); },
    async borrar(id) { m.delete(id); },
    async pendientes() { return [...m.values()]; },
  };
}

type Opciones = {
  concurrencia?: number;
  dormir?: (ms: number) => Promise<void>;
  alCambiar?: (r: ResumenCola) => void;
};

export class ColaDeSubida {
  private readonly esperando: ParteEnCola[] = [];
  private readonly enCurso = new Map<string, number>();
  private readonly conocidas = new Set<string>();
  private ultimoError: string | null = null;
  private descartadas = 0;
  private avisosVacia: (() => void)[] = [];
  private readonly concurrencia: number;
  private readonly dormir: (ms: number) => Promise<void>;

  constructor(
    private readonly almacen: AlmacenCola,
    private readonly subir: (p: ParteEnCola) => Promise<void>,
    private readonly opciones: Opciones = {},
  ) {
    this.concurrencia = opciones.concurrencia ?? 2;
    this.dormir = opciones.dormir ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  }

  async agregar(p: ParteEnCola): Promise<void> {
    await this.almacen.guardar(p);
    this.encolar([p]);
  }

  /** Lo que quedó guardado de una sesión anterior, en orden de grabación. */
  async reanudar(): Promise<void> {
    const guardadas = (await this.almacen.pendientes()).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    this.encolar(guardadas);
  }

  resumen(): ResumenCola {
    const bytes = this.esperando.reduce((s, p) => s + p.datos.size, 0) + [...this.enCurso.values()].reduce((s, n) => s + n, 0);
    return { pendientes: this.esperando.length + this.enCurso.size, bytesPendientes: bytes, ultimoError: this.ultimoError, descartadas: this.descartadas };
  }

  vaciada(): Promise<void> {
    if (this.esperando.length === 0 && this.enCurso.size === 0) return Promise.resolve();
    return new Promise((r) => this.avisosVacia.push(r));
  }

  private encolar(ps: ParteEnCola[]) {
    for (const p of ps) {
      if (this.conocidas.has(p.id)) continue;
      this.conocidas.add(p.id);
      this.esperando.push(p);
    }
    this.avisar();
    this.bombear();
  }

  private bombear() {
    while (this.enCurso.size < this.concurrencia && this.esperando.length > 0) {
      const p = this.esperando.shift()!;
      this.enCurso.set(p.id, p.datos.size);
      void this.procesar(p);
    }
    if (this.esperando.length === 0 && this.enCurso.size === 0) {
      const avisos = this.avisosVacia;
      this.avisosVacia = [];
      avisos.forEach((r) => r());
    }
  }

  private async procesar(p: ParteEnCola) {
    for (let intento = 0; ; intento++) {
      try {
        await this.subir(p);
        this.ultimoError = null;
        break;
      } catch (e) {
        if (e instanceof ErrorDefinitivo) {
          this.descartadas += 1;
          this.ultimoError = e.message;
          break;
        }
        this.ultimoError = e instanceof Error ? e.message : "Error de subida";
        this.avisar();
        await this.dormir(esperaReintento(intento));
      }
    }
    await this.almacen.borrar(p.id);
    this.enCurso.delete(p.id);
    this.conocidas.delete(p.id);
    this.avisar();
    this.bombear();
  }

  private avisar() {
    this.opciones.alCambiar?.(this.resumen());
  }
}
```

- [ ] **Step 4: Correr el test**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/cliente/cola.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Implementar el almacén de IndexedDB** (sin test unitario: lo prueba la Tarea 13)

```ts
// apps/fotoffice/lib/digitalizacion/cliente/almacen-indexeddb.ts
import type { AlmacenCola, ParteEnCola } from "./cola";

const BASE = "fotoffice-digitalizacion";
const TABLA = "partes";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(BASE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(TABLA, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function pedido<T>(db: IDBDatabase, modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TABLA, modo);
    const req = fn(tx.objectStore(TABLA));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error);
  });
}

/** Sólo para la grabación de VHS. Un DVD no pasa por acá: sus pedacitos ya están en el disco. */
export function almacenIndexedDb(): AlmacenCola {
  const db = abrir();
  return {
    async guardar(p: ParteEnCola) { await pedido(await db, "readwrite", (s) => s.put(p)); },
    async borrar(id: string) { await pedido(await db, "readwrite", (s) => s.delete(id)); },
    async pendientes() { return (await pedido(await db, "readonly", (s) => s.getAll())) as ParteEnCola[]; },
  };
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/fotoffice/lib/digitalizacion/cliente/cola.ts apps/fotoffice/lib/digitalizacion/cliente/cola.test.ts apps/fotoffice/lib/digitalizacion/cliente/almacen-indexeddb.ts
git commit -m "Digitalización: cola de subida que sobrevive a cortes de red y recargas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Formato, grabador, APIs del navegador y worker de análisis

**Files:**
- Create: `apps/fotoffice/lib/digitalizacion/cliente/formato.ts`
- Test: `apps/fotoffice/lib/digitalizacion/cliente/formato.test.ts`
- Create: `apps/fotoffice/lib/digitalizacion/cliente/apis-navegador.ts`
- Create: `apps/fotoffice/lib/digitalizacion/cliente/grabador.ts`
- Create: `apps/fotoffice/lib/digitalizacion/cliente/analisis.worker.ts`
- Create: `apps/fotoffice/lib/digitalizacion/cliente/analisis.ts`

**Interfaces:**
- Consumes: Tareas 3 y 4; `CALIDADES`, `BITS_AUDIO`, `SEGUNDOS_POR_PARTE`.
- Produces:
  - `FORMATOS_PREFERIDOS`, `elegirFormato(soporta): string | null`.
  - `navegadorCompatible(): boolean`, `pedirVentanaFlotante(ancho, alto): Promise<Window>`, `elegirCarpeta(): Promise<FileSystemDirectoryHandle>`, `elegirArchivoDeDestino(nombre): Promise<FileSystemWritableFileStream>`, `procesadorDeCuadros(track): ReadableStream<VideoFrame>`.
  - `class Grabador { constructor(o: { stream; mimeType; bitsVideo; alPedacito: (b: Blob, indice: number) => void }); iniciar(): void; detener(): Promise<void> }`.
  - Mensajes del worker:
    - `MensajeAlWorker = { tipo: "iniciar"; cuadros: ReadableStream<VideoFrame>; huella: number[] | null; minutosSinSenal: number } | { tipo: "calibrar"; cuadros: ReadableStream<VideoFrame> } | { tipo: "detener" }`.
    - `MensajeDelWorker = { tipo: "segundo"; seg: number; clase: ClaseCuadro; sinImagenHaceSeg: number | null; cortar: boolean; latido: boolean; resumen: ResumenCorte } | { tipo: "huella"; huella: number[] } | { tipo: "error"; mensaje: string }`.
  - `class Analizador { constructor(alMensaje: (m: MensajeDelWorker) => void); iniciar(track, huella, minutos): void; calibrar(track): Promise<number[]>; detener(): void }`.

- [ ] **Step 1: Escribir el test de formato (falla)**

```ts
// apps/fotoffice/lib/digitalizacion/cliente/formato.test.ts
import { describe, expect, it } from "vitest";
import { FORMATOS_PREFERIDOS, elegirFormato } from "./formato";

describe("elegirFormato", () => {
  it("prefiere MP4 si el navegador lo soporta", () => expect(elegirFormato(() => true)).toBe(FORMATOS_PREFERIDOS[0]));
  it("cae a WebM H.264 y después a VP9", () => {
    expect(elegirFormato((m) => m.startsWith("video/webm"))).toBe("video/webm;codecs=h264,opus");
    expect(elegirFormato((m) => m.includes("vp9"))).toBe("video/webm;codecs=vp9,opus");
  });
  it("null si no soporta ninguno", () => expect(elegirFormato(() => false)).toBeNull());
});
```

- [ ] **Step 2: Correrlo y ver que falla**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/cliente/formato.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implementar `formato.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/cliente/formato.ts
export const FORMATOS_PREFERIDOS = [
  "video/mp4;codecs=avc1,mp4a.40.2",
  "video/webm;codecs=h264,opus",
  "video/webm;codecs=vp9,opus",
] as const;

export function elegirFormato(soporta: (mime: string) => boolean): string | null {
  return FORMATOS_PREFERIDOS.find((m) => soporta(m)) ?? null;
}
```

- [ ] **Step 4: Correr el test**

Run: `pnpm --filter fotoffice test -- lib/digitalizacion/cliente/formato.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implementar `apis-navegador.ts`**

Tipos propios en lugar de `declare global`: algunas de estas APIs ya están en `lib.dom` y redeclararlas choca.

```ts
// apps/fotoffice/lib/digitalizacion/cliente/apis-navegador.ts
/** Acceso tipado a APIs de Chrome/Edge que todavía no están (o no completas) en lib.dom. */

type ConPip = { documentPictureInPicture?: { requestWindow(o: { width: number; height: number }): Promise<Window>; window: Window | null } };
type ConArchivos = {
  showDirectoryPicker?: (o?: { mode?: "read" }) => Promise<FileSystemDirectoryHandle>;
  showSaveFilePicker?: (o?: { suggestedName?: string }) => Promise<FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }>;
};
type ConProcesador = { MediaStreamTrackProcessor?: new (o: { track: MediaStreamTrack }) => { readable: ReadableStream<VideoFrame> } };

const w = () => window as unknown as Window & ConPip & ConArchivos & ConProcesador;

export function navegadorCompatible(): boolean {
  if (typeof window === "undefined") return false;
  const v = w();
  return Boolean(v.documentPictureInPicture && v.MediaStreamTrackProcessor && v.showDirectoryPicker && v.showSaveFilePicker && typeof MediaRecorder !== "undefined" && "indexedDB" in v);
}

export function pedirVentanaFlotante(ancho: number, alto: number): Promise<Window> {
  const pip = w().documentPictureInPicture;
  if (!pip) throw new Error("Este navegador no tiene ventanita flotante.");
  return pip.requestWindow({ width: ancho, height: alto });
}

export function elegirCarpeta(): Promise<FileSystemDirectoryHandle> {
  const f = w().showDirectoryPicker;
  if (!f) throw new Error("Este navegador no deja elegir carpetas.");
  return f({ mode: "read" });
}

export async function elegirArchivoDeDestino(nombre: string): Promise<FileSystemWritableFileStream> {
  const f = w().showSaveFilePicker;
  if (!f) throw new Error("Este navegador no deja guardar archivos.");
  return (await f({ suggestedName: nombre })).createWritable();
}

/** Un lector de cuadros sobre una COPIA de la pista: se puede pasar al worker sin tocar la grabación. */
export function procesadorDeCuadros(track: MediaStreamTrack): ReadableStream<VideoFrame> {
  const P = w().MediaStreamTrackProcessor;
  if (!P) throw new Error("Este navegador no deja analizar el video.");
  return new P({ track: track.clone() }).readable;
}
```

- [ ] **Step 6: Implementar `grabador.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/cliente/grabador.ts
import { BITS_AUDIO, SEGUNDOS_POR_PARTE } from "../constants";

type Opciones = { stream: MediaStream; mimeType: string; bitsVideo: number; alPedacito: (b: Blob, indice: number) => void };

/** `MediaRecorder` con un pedacito cada 10 s. `detener` espera el último pedacito. */
export class Grabador {
  private rec: MediaRecorder | null = null;
  private indice = 0;

  constructor(private readonly o: Opciones, indiceInicial = 0) {
    this.indice = indiceInicial;
  }

  iniciar(): void {
    const rec = new MediaRecorder(this.o.stream, { mimeType: this.o.mimeType, videoBitsPerSecond: this.o.bitsVideo, audioBitsPerSecond: BITS_AUDIO });
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) this.o.alPedacito(e.data, this.indice++);
    };
    rec.start(SEGUNDOS_POR_PARTE * 1000);
    this.rec = rec;
  }

  detener(): Promise<void> {
    const rec = this.rec;
    if (!rec || rec.state === "inactive") return Promise.resolve();
    return new Promise((resolve) => {
      rec.addEventListener("stop", () => resolve(), { once: true });
      rec.stop();
    });
  }
}
```

- [ ] **Step 7: Implementar el worker**

```ts
// apps/fotoffice/lib/digitalizacion/cliente/analisis.worker.ts
/// <reference lib="webworker" />
import { ALTO, ANCHO, calcularRasgos, promediarHuellas, type Rasgos } from "../senal/rasgos";
import { clasificar, type ClaseCuadro } from "../senal/clasificador";
import { avanzarSegundo, cerrarCorte, estadoInicial, latidoDebido, type ResumenCorte } from "../senal/corte";

export type MensajeAlWorker =
  | { tipo: "iniciar"; cuadros: ReadableStream<VideoFrame>; huella: number[] | null; minutosSinSenal: number }
  | { tipo: "calibrar"; cuadros: ReadableStream<VideoFrame> }
  | { tipo: "detener" };

export type MensajeDelWorker =
  | { tipo: "segundo"; seg: number; clase: ClaseCuadro; sinImagenHaceSeg: number | null; cortar: boolean; latido: boolean; resumen: ResumenCorte }
  | { tipo: "huella"; huella: number[] }
  | { tipo: "error"; mensaje: string };

const lienzo = new OffscreenCanvas(ANCHO, ALTO);
const ctx2d = lienzo.getContext("2d", { willReadFrequently: true })!;
let lector: ReadableStreamDefaultReader<VideoFrame> | null = null;
const enviar = (m: MensajeDelWorker) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(m);

function rasgosDe(cuadro: VideoFrame): Rasgos {
  ctx2d.drawImage(cuadro, 0, 0, ANCHO, ALTO);
  return calcularRasgos(ctx2d.getImageData(0, 0, ANCHO, ALTO).data);
}

/** Recorre los cuadros y entrega uno por segundo de video (por su marca de tiempo, no por reloj). */
async function porSegundo(cuadros: ReadableStream<VideoFrame>, fn: (r: Rasgos, seg: number) => boolean | void) {
  lector = cuadros.getReader();
  let inicio: number | null = null;
  let proximo = 0;
  for (;;) {
    const { value: cuadro, done } = await lector.read();
    if (done || !cuadro) return;
    try {
      inicio ??= cuadro.timestamp;
      const seg = Math.floor((cuadro.timestamp - inicio) / 1_000_000);
      if (seg >= proximo) {
        proximo = seg + 1;
        if (fn(rasgosDe(cuadro), seg) === false) return;
      }
    } finally {
      cuadro.close();
    }
  }
}

self.onmessage = async (ev: MessageEvent<MensajeAlWorker>) => {
  const m = ev.data;
  try {
    if (m.tipo === "detener") {
      await lector?.cancel();
      lector = null;
      return;
    }
    if (m.tipo === "calibrar") {
      const huellas: number[][] = [];
      await porSegundo(m.cuadros, (r) => { huellas.push(r.huella); return huellas.length < 5; });
      await lector?.cancel();
      enviar({ tipo: "huella", huella: promediarHuellas(huellas) });
      return;
    }
    let estado = estadoInicial();
    let anterior: Rasgos | null = null;
    await porSegundo(m.cuadros, (r) => {
      const clase = clasificar(r, anterior, m.huella);
      anterior = r;
      const paso = avanzarSegundo(estado, clase, m.minutosSinSenal);
      estado = paso.estado;
      enviar({
        tipo: "segundo",
        seg: estado.seg,
        clase,
        sinImagenHaceSeg: paso.sinImagenHaceSeg,
        cortar: paso.cortar,
        latido: latidoDebido(estado.seg),
        resumen: cerrarCorte(estado),
      });
    });
  } catch (e) {
    enviar({ tipo: "error", mensaje: e instanceof Error ? e.message : "Error del análisis" });
  }
};
```

- [ ] **Step 8: Implementar `analisis.ts` (el lado de la página)**

```ts
// apps/fotoffice/lib/digitalizacion/cliente/analisis.ts
import { procesadorDeCuadros } from "./apis-navegador";
import type { MensajeAlWorker, MensajeDelWorker } from "./analisis.worker";

/** Dueño del worker. Los mensajes del worker no los frena el navegador con la ventana minimizada. */
export class Analizador {
  private readonly worker: Worker;

  constructor(alMensaje: (m: MensajeDelWorker) => void) {
    this.worker = new Worker(new URL("./analisis.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (e: MessageEvent<MensajeDelWorker>) => alMensaje(e.data);
  }

  iniciar(track: MediaStreamTrack, huella: number[] | null, minutosSinSenal: number): void {
    const cuadros = procesadorDeCuadros(track);
    const m: MensajeAlWorker = { tipo: "iniciar", cuadros, huella, minutosSinSenal };
    this.worker.postMessage(m, [cuadros as unknown as Transferable]);
  }

  calibrar(track: MediaStreamTrack): Promise<number[]> {
    return new Promise((resolve, reject) => {
      const previo = this.worker.onmessage;
      this.worker.onmessage = (e: MessageEvent<MensajeDelWorker>) => {
        if (e.data.tipo === "huella") { this.worker.onmessage = previo; resolve(e.data.huella); }
        if (e.data.tipo === "error") { this.worker.onmessage = previo; reject(new Error(e.data.mensaje)); }
      };
      const cuadros = procesadorDeCuadros(track);
      this.worker.postMessage({ tipo: "calibrar", cuadros } satisfies MensajeAlWorker, [cuadros as unknown as Transferable]);
    });
  }

  detener(): void {
    this.worker.postMessage({ tipo: "detener" } satisfies MensajeAlWorker);
    this.worker.terminate();
  }
}
```

- [ ] **Step 9: Typecheck**

Run: `pnpm --filter fotoffice typecheck 2>&1 | grep -E "digitalizacion|error TS" | head -20`

Expected: ningún error en `lib/digitalizacion/cliente`. Si `VideoFrame` o `OffscreenCanvas` no existen en la versión de TS, agregá `"webworker"` sólo con la directiva `/// <reference lib="webworker" />` (ya está en el worker). No toques `tsconfig.json`.

- [ ] **Step 10: Commit**

```bash
git add apps/fotoffice/lib/digitalizacion/cliente/formato.ts apps/fotoffice/lib/digitalizacion/cliente/formato.test.ts apps/fotoffice/lib/digitalizacion/cliente/apis-navegador.ts apps/fotoffice/lib/digitalizacion/cliente/grabador.ts apps/fotoffice/lib/digitalizacion/cliente/analisis.worker.ts apps/fotoffice/lib/digitalizacion/cliente/analisis.ts
git commit -m "Digitalización: grabador por pedacitos y análisis de señal en un worker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Ventanita flotante

**Files:**
- Create: `apps/fotoffice/components/digitalizacion/ventanita.tsx`

**Interfaces:**
- Consumes: `pedirVentanaFlotante` (Tarea 8).
- Produces:
  - `EstadoVentanita = { modo: "VHS" | "DVD"; stream: MediaStream | null; segundos: number; bytesPendientes: number; ultimoError: string | null; sinImagenHaceSeg: number | null; minutosSinSenal: number; avanceDvd: { hechos: number; total: number } | null; terminando: boolean }`.
  - `class Ventanita { static abrir(alDetener: () => void): Promise<Ventanita>; mostrar(e: EstadoVentanita): void; cerrada(): boolean; cerrar(): void }`.

- [ ] **Step 1: Implementar la ventanita**

Se usa **una raíz React propia** dentro del documento de la ventanita, no un portal: React delega los eventos en el documento de su raíz y los clics de un portal en otro documento no llegarían.

```tsx
// apps/fotoffice/components/digitalizacion/ventanita.tsx
"use client";

import { useEffect, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { pedirVentanaFlotante } from "@/lib/digitalizacion/cliente/apis-navegador";

export type EstadoVentanita = {
  modo: "VHS" | "DVD";
  stream: MediaStream | null;
  segundos: number;
  bytesPendientes: number;
  ultimoError: string | null;
  sinImagenHaceSeg: number | null;
  minutosSinSenal: number;
  avanceDvd: { hechos: number; total: number } | null;
  terminando: boolean;
};

const reloj = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return `${h ? `${h}:` : ""}${String(m).padStart(h ? 2 : 1, "0")}:${String(x).padStart(2, "0")}`;
};
const mb = (b: number) => `${(b / 1024 / 1024).toFixed(0)} MB`;

function Vista({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);
  return <video ref={ref} autoPlay muted playsInline style={{ width: "100%", background: "#000", aspectRatio: "16/9" }} />;
}

function Panel({ e, alDetener }: { e: EstadoVentanita; alDetener: () => void }) {
  const restan = e.sinImagenHaceSeg === null ? null : Math.max(0, e.minutosSinSenal * 60 - e.sinImagenHaceSeg);
  return (
    <div style={{ font: "13px system-ui, sans-serif", color: "#fff", background: "#111", height: "100vh", display: "flex", flexDirection: "column" }}>
      {e.stream ? <Vista stream={e.stream} /> : null}
      <div style={{ padding: 8, display: "grid", gap: 4 }}>
        <strong style={{ color: e.terminando ? "#fbbf24" : "#ef4444" }}>
          {e.terminando ? "Terminando de subir…" : `● ${e.modo === "DVD" ? "SUBIENDO DVD" : "GRABANDO"}`} {e.modo === "VHS" ? reloj(e.segundos) : ""}
        </strong>
        {e.avanceDvd ? <span>Parte {e.avanceDvd.hechos} de {e.avanceDvd.total}</span> : null}
        <span>{e.bytesPendientes > 0 ? `Pendiente: ${mb(e.bytesPendientes)}` : "Subida al día ✓"}</span>
        {e.ultimoError ? <span style={{ color: "#fbbf24" }}>Reintentando: {e.ultimoError}</span> : null}
        {e.modo === "VHS" ? (
          <span>{restan === null ? "Señal: OK" : `Sin imagen hace ${reloj(e.sinImagenHaceSeg ?? 0)} — se corta en ${reloj(restan)}`}</span>
        ) : null}
        <button type="button" onClick={alDetener} disabled={e.terminando} style={{ marginTop: 4, padding: "6px 10px", borderRadius: 6, border: 0, background: "#ef4444", color: "#fff", cursor: "pointer" }}>
          ⏹ Detener
        </button>
      </div>
    </div>
  );
}

export class Ventanita {
  private constructor(private readonly win: Window, private readonly raiz: Root, private readonly alDetener: () => void) {}

  /** Llamar dentro del clic de "Grabar": el navegador sólo abre la ventanita con un gesto del usuario. */
  static async abrir(alDetener: () => void): Promise<Ventanita> {
    const win = await pedirVentanaFlotante(320, 330);
    win.document.body.style.margin = "0";
    const div = win.document.createElement("div");
    win.document.body.appendChild(div);
    return new Ventanita(win, createRoot(div), alDetener);
  }

  mostrar(e: EstadoVentanita): void {
    if (!this.cerrada()) this.raiz.render(<Panel e={e} alDetener={this.alDetener} />);
  }

  cerrada(): boolean {
    return this.win.closed;
  }

  cerrar(): void {
    this.raiz.unmount();
    if (!this.win.closed) this.win.close();
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter fotoffice typecheck 2>&1 | grep -E "components/digitalizacion" | head`
Expected: sin salida.

- [ ] **Step 3: Commit**

```bash
git add apps/fotoffice/components/digitalizacion/ventanita.tsx
git commit -m "Digitalización: ventanita flotante con vista previa, subida, señal y Detener

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: La estación de grabación (VHS)

**Files:**
- Create: `apps/fotoffice/components/digitalizacion/estacion.tsx`
- Create: `apps/fotoffice/app/(shell)/digitalizacion/grabar/page.tsx`

**Interfaces:**
- Consumes: acciones (Tarea 6), `ColaDeSubida`, `ErrorDefinitivo`, `idParte` (Tarea 7), `almacenIndexedDb` (Tarea 7), `Grabador`, `Analizador`, `elegirFormato`, `navegadorCompatible` (Tarea 8), `Ventanita` (Tarea 9), `CALIDADES`, `TOPE_SEGUNDOS` (Tarea 1), `leerAjustes`, `listarEquipos`, `requireDigitalizacion` (Tarea 6).
- Produces:
  - `Estacion` (client) con props `{ minutosSinSenal: number; equipos: EquipoGuardado[]; continuar: Continuacion | null; dvd: React.ReactNode }`.
  - `EquipoGuardado = { id; etiqueta; huellaSinSenal: number[] | null; corregirProporcion: boolean }`.
  - `Continuacion = { grabacionId; tramo; tipo: "VHS" | "DVD"; proyectoId; cassetteNumero; calidad; corregirProporcion }`.
  - `crearSubidor(): (p: ParteEnCola) => Promise<void>`, exportado para que lo reutilice la Tarea 11.

- [ ] **Step 1: Escribir la página**

```tsx
// apps/fotoffice/app/(shell)/digitalizacion/grabar/page.tsx
import { PageHeader } from "@/components/page-header";
import { DigitalizarDvd } from "@/components/digitalizacion/dvd";
import { Estacion } from "@/components/digitalizacion/estacion";
import { contextoDigitalizacion, requireDigitalizacion } from "@/lib/digitalizacion/contexto";
import { continuarGrabacion, leerAjustes, listarEquipos } from "@/lib/digitalizacion/servidor/grabaciones";

export const dynamic = "force-dynamic";

export default async function GrabarPage({ searchParams }: { searchParams: Promise<{ continuar?: string }> }) {
  const { workspace } = await requireDigitalizacion("MANAGE");
  const sp = await searchParams;
  const [ajustes, equipos] = await Promise.all([leerAjustes(workspace.id), listarEquipos(workspace.id)]);
  let continuar = null;
  if (typeof sp.continuar === "string") {
    const ctx = await contextoDigitalizacion("MANAGE");
    const r = ctx ? await continuarGrabacion(ctx, sp.continuar) : null;
    if (r?.ok) continuar = { grabacionId: sp.continuar, tramo: r.tramo, tipo: r.tipo, proyectoId: r.proyectoId, cassetteNumero: r.cassetteNumero, calidad: r.calidad, corregirProporcion: r.corregirProporcion };
  }
  return (
    <div className="space-y-6">
      <PageHeader title="Grabar" description="Elegí la capturadora, revisá la vista previa y grabá. Podés seguir usando la computadora mientras graba." />
      <Estacion
        minutosSinSenal={ajustes.minutosSinSenal}
        equipos={equipos}
        continuar={continuar}
        dvd={<DigitalizarDvd continuar={continuar?.tipo === "DVD" ? continuar : null} />}
      />
    </div>
  );
}
```

**Ojo:** `continuarGrabacion` incrementa el tramo, y un render de servidor puede repetirse (por ejemplo, con un prefetch). Por eso el enlace "Continuar" de la lista (Tarea 12) es un `<a>` común con `prefetch={false}`. Leé la guía de `searchParams` de `node_modules/next/dist/docs/` antes de escribir esta página.

- [ ] **Step 2: Escribir la estación**

```tsx
// apps/fotoffice/components/digitalizacion/estacion.tsx
"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cerrarGrabacionAction, confirmarParteAction, crearGrabacionAction, guardarEquipoAction, latidoAction, pedirParteAction, buscarTrabajosAction } from "@/app/(shell)/digitalizacion/actions";
import { CALIDADES, TOPE_SEGUNDOS, type Calidad } from "@/lib/digitalizacion/constants";
import { Analizador } from "@/lib/digitalizacion/cliente/analisis";
import type { MensajeDelWorker } from "@/lib/digitalizacion/cliente/analisis.worker";
import { almacenIndexedDb } from "@/lib/digitalizacion/cliente/almacen-indexeddb";
import { navegadorCompatible } from "@/lib/digitalizacion/cliente/apis-navegador";
import { ColaDeSubida, ErrorDefinitivo, idParte, type ParteEnCola, type ResumenCola } from "@/lib/digitalizacion/cliente/cola";
import { elegirFormato } from "@/lib/digitalizacion/cliente/formato";
import { Grabador } from "@/lib/digitalizacion/cliente/grabador";
import type { ResumenCorte } from "@/lib/digitalizacion/senal/corte";
import { Ventanita, type EstadoVentanita } from "./ventanita";

export type EquipoGuardado = { id: string; etiqueta: string; huellaSinSenal: number[] | null; corregirProporcion: boolean };
export type Continuacion = { grabacionId: string; tramo: number; tipo: "VHS" | "DVD"; proyectoId: string | null; cassetteNumero: number | null; calidad: string | null; corregirProporcion: boolean };

const CLAVE_EQUIPO = "fo-digitalizacion-equipo";
const CLAVE_LISTA = "fo-digitalizacion-lista-ok";
const leerLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardarLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento local */ } };

/** Pide la URL, sube a R2 y confirma. Lo comparte "Digitalizar DVD". */
export function crearSubidor() {
  return async (p: ParteEnCola) => {
    const r = await pedirParteAction({ grabacionId: p.grabacionId, tramo: p.tramo, indice: p.indice, bytes: p.datos.size });
    if (!r.ok) throw r.definitivo ? new ErrorDefinitivo(r.error) : new Error(r.error);
    if (r.yaEstaba) return;
    const res = await fetch(r.url, { method: "PUT", body: p.datos, headers: { "Content-Type": r.tipoContenido } });
    if (!res.ok) throw new Error(`El almacenamiento respondió ${res.status}`);
    const c = await confirmarParteAction({ grabacionId: p.grabacionId, tramo: p.tramo, indice: p.indice });
    if (!c.ok) throw c.definitivo ? new ErrorDefinitivo(c.error) : new Error(c.error);
  };
}

function latidoDe(resumen: ResumenCorte, tramo: number) {
  return {
    tramo,
    duracionSeg: resumen.duracionSeg,
    primeraImagenSeg: resumen.primeraImagenSeg,
    ultimaImagenSeg: resumen.ultimaImagenSeg,
    sinImagen: resumen.sinImagen,
    tramosSinSenal: resumen.tramos.map((t) => ({ ...t, tramo })),
  };
}

export function Estacion({ minutosSinSenal, equipos, continuar, dvd }: { minutosSinSenal: number; equipos: EquipoGuardado[]; continuar: Continuacion | null; dvd: ReactNode }) {
  const [compatible, setCompatible] = useState<boolean | null>(null);
  const [videos, setVideos] = useState<MediaDeviceInfo[]>([]);
  const [audios, setAudios] = useState<MediaDeviceInfo[]>([]);
  const [videoId, setVideoId] = useState("");
  const [audioId, setAudioId] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [nivelAudio, setNivelAudio] = useState(0);
  const [calidad, setCalidad] = useState<Calidad>((continuar?.calidad as Calidad) ?? "MEDIA");
  const [estirada, setEstirada] = useState(continuar?.corregirProporcion ?? false);
  const [equipo, setEquipo] = useState<EquipoGuardado | null>(null);
  const [calibrando, setCalibrando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [trabajos, setTrabajos] = useState<{ id: string; numero: string; nombre: string }[]>([]);
  const [proyectoId, setProyectoId] = useState<string | null>(continuar?.proyectoId ?? null);
  const [sinPedido, setSinPedido] = useState(continuar ? continuar.proyectoId === null : false);
  const [cassette, setCassette] = useState(continuar?.cassetteNumero ?? 1);
  const [listaOk, setListaOk] = useState(false);
  const [fase, setFase] = useState<"preparando" | "grabando" | "terminando" | "terminada">("preparando");
  const [aviso, setAviso] = useState<string | null>(null);
  const [cola, setCola] = useState<ResumenCola>({ pendientes: 0, bytesPendientes: 0, ultimoError: null, descartadas: 0 });

  const vistaRef = useRef<HTMLVideoElement>(null);
  const colaRef = useRef<ColaDeSubida | null>(null);
  const sesion = useRef<{ grabacionId: string; tramo: number; grabador: Grabador; analizador: Analizador; ventanita: Ventanita | null; resumen: ResumenCorte | null; segundos: number; sinImagen: number | null; deteniendo: boolean } | null>(null);

  // Compatibilidad, cola persistente (sube primero lo que quedó de antes) y la lista de chequeo.
  useEffect(() => {
    setCompatible(navegadorCompatible());
    setListaOk(leerLocal(CLAVE_LISTA) === "si");
    if (!navegadorCompatible()) return;
    const c = new ColaDeSubida(almacenIndexedDb(), crearSubidor(), { alCambiar: setCola });
    colaRef.current = c;
    void c.reanudar();
  }, []);

  // Pedir permiso una vez para ver los nombres de los dispositivos.
  const cargarDispositivos = useCallback(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    s.getTracks().forEach((t) => t.stop());
    const todos = await navigator.mediaDevices.enumerateDevices();
    setVideos(todos.filter((d) => d.kind === "videoinput"));
    setAudios(todos.filter((d) => d.kind === "audioinput"));
    const guardado = JSON.parse(leerLocal(CLAVE_EQUIPO) ?? "{}") as { video?: string; audio?: string };
    setVideoId(todos.find((d) => d.kind === "videoinput" && d.label === guardado.video)?.deviceId ?? "");
    setAudioId(todos.find((d) => d.kind === "audioinput" && d.label === guardado.audio)?.deviceId ?? "");
  }, []);

  // Abrir la vista previa con el equipo elegido.
  useEffect(() => {
    if (!videoId || !audioId) return;
    let vivo: MediaStream | null = null;
    let cancelado = false;
    void navigator.mediaDevices
      .getUserMedia({
        video: { deviceId: { exact: videoId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { deviceId: { exact: audioId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      .then((s) => {
        if (cancelado) { s.getTracks().forEach((t) => t.stop()); return; }
        vivo = s;
        setStream(s);
        const etiquetaVideo = s.getVideoTracks()[0]?.label ?? "";
        guardarLocal(CLAVE_EQUIPO, JSON.stringify({ video: etiquetaVideo, audio: s.getAudioTracks()[0]?.label ?? "" }));
        const e = equipos.find((x) => x.etiqueta === etiquetaVideo) ?? null;
        setEquipo(e);
        if (e && !continuar) setEstirada(e.corregirProporcion);
      })
      .catch(() => setAviso("No pudimos abrir la capturadora. ¿Está abierta en Meet, Zoom u otro programa?"));
    return () => { cancelado = true; if (fase === "preparando") vivo?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, audioId]);

  // Vista previa y medidor de audio (nunca suena por los parlantes).
  useEffect(() => {
    if (!stream) return;
    if (vistaRef.current) vistaRef.current.srcObject = stream;
    const ac = new AudioContext();
    const an = ac.createAnalyser();
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const id = window.setInterval(() => {
      an.getByteTimeDomainData(buf);
      setNivelAudio(Math.min(1, Math.max(...buf.map((v) => Math.abs(v - 128))) / 128));
    }, 200);
    return () => { window.clearInterval(id); void ac.close(); };
  }, [stream]);

  const guardarEquipo = async (cambios: { huellaSinSenal?: number[] | null; corregirProporcion?: boolean }) => {
    const etiqueta = stream?.getVideoTracks()[0]?.label;
    if (!etiqueta) return;
    const nuevo = { etiqueta, huellaSinSenal: cambios.huellaSinSenal ?? equipo?.huellaSinSenal ?? null, corregirProporcion: cambios.corregirProporcion ?? estirada };
    const r = await guardarEquipoAction(nuevo);
    if (r.ok) setEquipo({ id: r.id, ...nuevo });
    else setAviso(r.error);
  };

  const calibrar = async () => {
    if (!stream) return;
    setCalibrando(true);
    const a = new Analizador(() => {});
    try {
      await guardarEquipo({ huellaSinSenal: await a.calibrar(stream.getVideoTracks()[0]) });
      setAviso("Listo: ya reconocemos la pantalla sin señal de este equipo.");
    } catch {
      setAviso("No pudimos calibrar. Probá de nuevo con la videocasetera apagada.");
    } finally {
      a.detener();
      setCalibrando(false);
    }
  };

  const buscar = async (q: string) => {
    setBusqueda(q);
    const r = await buscarTrabajosAction(q);
    if (r.ok) setTrabajos(r.trabajos);
  };

  const pintarVentanita = useCallback(() => {
    const s = sesion.current;
    if (!s?.ventanita) return;
    const e: EstadoVentanita = {
      modo: "VHS", stream, segundos: s.segundos, bytesPendientes: cola.bytesPendientes, ultimoError: cola.ultimoError,
      sinImagenHaceSeg: s.sinImagen, minutosSinSenal, avanceDvd: null, terminando: fase === "terminando",
    };
    s.ventanita.mostrar(e);
  }, [stream, cola, minutosSinSenal, fase]);
  useEffect(pintarVentanita, [pintarVentanita]);

  const detener = useCallback(async (motivoFin: "MANUAL" | "SIN_SENAL" | "TOPE") => {
    const s = sesion.current;
    if (!s || s.deteniendo) return;
    s.deteniendo = true;
    setFase("terminando");
    await s.grabador.detener();
    s.analizador.detener();
    await colaRef.current?.vaciada();
    const resumen = s.resumen ?? { duracionSeg: s.segundos, primeraImagenSeg: null, ultimaImagenSeg: null, sinImagen: true, tramos: [] };
    const r = await cerrarGrabacionAction(s.grabacionId, { ...latidoDe(resumen, s.tramo), motivoFin });
    s.ventanita?.cerrar();
    stream?.getTracks().forEach((t) => t.stop());
    setFase("terminada");
    setAviso(r.ok ? (motivoFin === "SIN_SENAL" ? `Se cortó sola: ${minutosSinSenal} minutos sin imagen.` : "Grabación terminada y subida.") : r.error);
  }, [stream, minutosSinSenal]);

  const alMensaje = useCallback((m: MensajeDelWorker) => {
    const s = sesion.current;
    if (!s || m.tipo !== "segundo") return;
    s.segundos = m.seg;
    s.sinImagen = m.sinImagenHaceSeg;
    s.resumen = m.resumen;
    // El latido sale de los mensajes del worker: los temporizadores de la página se frenan en segundo plano.
    if (m.latido) void latidoAction(s.grabacionId, latidoDe(m.resumen, s.tramo));
    if (m.cortar) void detener("SIN_SENAL");
    else if (m.seg >= TOPE_SEGUNDOS) void detener("TOPE");
    pintarVentanita();
  }, [detener, pintarVentanita]);

  // El worker y la ventanita viven toda la grabación: llaman siempre a la versión más nueva por ref,
  // no a la que existía al tocar Grabar (verían la cola y la señal viejas).
  const alMensajeRef = useRef(alMensaje);
  const detenerRef = useRef(detener);
  useEffect(() => { alMensajeRef.current = alMensaje; detenerRef.current = detener; }, [alMensaje, detener]);

  const grabar = async () => {
    if (!stream || !colaRef.current) return;
    const mime = elegirFormato((m) => MediaRecorder.isTypeSupported(m));
    if (!mime) { setAviso("Este navegador no puede grabar video. Usá Chrome o Edge actualizados."); return; }
    // Primero la ventanita: el navegador sólo la abre dentro del clic.
    let ventanita: Ventanita | null = null;
    try { ventanita = await Ventanita.abrir(() => void detenerRef.current("MANUAL")); } catch { setAviso("No se pudo abrir la ventanita; la grabación sigue igual."); }
    let grabacionId = continuar?.grabacionId ?? null;
    const tramo = continuar?.tramo ?? 1;
    if (!grabacionId) {
      const r = await crearGrabacionAction({
        tipo: "VHS", proyectoId: sinPedido ? null : proyectoId, cassetteNumero: sinPedido ? null : cassette, calidad, mimeType: mime,
        corregirProporcion: estirada, equipoId: equipo?.id ?? null, dvdArchivos: null,
      });
      if (!r.ok) { ventanita?.cerrar(); setAviso(r.error); return; }
      grabacionId = r.id;
    }
    const cola = colaRef.current;
    const id = grabacionId;
    const grabador = new Grabador({
      stream, mimeType: mime, bitsVideo: CALIDADES[calidad],
      alPedacito: (datos, indice) => void cola.agregar({ id: idParte(id, tramo, indice), grabacionId: id, tramo, indice, datos }),
    });
    const analizador = new Analizador((m) => alMensajeRef.current(m));
    sesion.current = { grabacionId: id, tramo, grabador, analizador, ventanita, resumen: null, segundos: 0, sinImagen: null, deteniendo: false };
    grabador.iniciar();
    analizador.iniciar(stream.getVideoTracks()[0], equipo?.huellaSinSenal ?? null, minutosSinSenal);
    setFase("grabando");
  };

  // Cerrar la pestaña mientras graba o sube pide confirmación.
  useEffect(() => {
    if (fase !== "grabando" && fase !== "terminando" && cola.pendientes === 0) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [fase, cola.pendientes]);

  if (compatible === false) {
    return <p className="fo-alert-error p-4 text-sm">La estación necesita Chrome o Edge de escritorio actualizados (versión 116 o mayor).</p>;
  }

  const puedeGrabar = Boolean(stream) && listaOk && (sinPedido || proyectoId) && fase === "preparando";
  return (
    <div className="space-y-6">
      {aviso ? <p className="fo-alert-warning p-3 text-sm">{aviso}</p> : null}
      {cola.pendientes > 0 && fase === "preparando" ? (
        <p className="fo-alert-warning p-3 text-sm">Subiendo {cola.pendientes} pedacitos que quedaron de una grabación anterior…</p>
      ) : null}

      {!listaOk ? (
        <div className="fo-alert-warning space-y-2 p-4 text-sm">
          <p className="font-semibold">Antes de la primera grabación, chequeá:</p>
          <p>☐ La computadora no se suspende nunca (Configuración → Sistema → Energía → Suspender: Nunca). La pantalla sí puede apagarse.</p>
          <p>☐ La capturadora no se usa en Meet, Zoom ni otro programa.</p>
          <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => { guardarLocal(CLAVE_LISTA, "si"); setListaOk(true); }}>Listo, ya lo chequeé</button>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Equipo</h2>
        {videos.length === 0 ? (
          <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => void cargarDispositivos()}>Buscar la capturadora</button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Video
              <select className="mt-1 block w-full rounded border p-2" value={videoId} onChange={(e) => setVideoId(e.target.value)} disabled={fase !== "preparando"}>
                <option value="">Elegí la capturadora</option>
                {videos.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Cámara sin nombre"}</option>)}
              </select>
            </label>
            <label className="text-sm">Audio
              <select className="mt-1 block w-full rounded border p-2" value={audioId} onChange={(e) => setAudioId(e.target.value)} disabled={fase !== "preparando"}>
                <option value="">Elegí la entrada de audio</option>
                {audios.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Micrófono sin nombre"}</option>)}
              </select>
            </label>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Vista previa</h2>
        <div className="relative w-full max-w-2xl overflow-hidden rounded bg-black" style={{ aspectRatio: "16/9" }}>
          <video ref={vistaRef} autoPlay muted playsInline className="h-full w-full object-contain" style={estirada ? { transform: "scaleX(0.75)" } : undefined} />
        </div>
        <div className="h-2 w-full max-w-2xl rounded bg-gray-200" aria-label="Nivel de audio">
          <div className="h-2 rounded bg-green-500" style={{ width: `${Math.round(nivelAudio * 100)}%` }} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={estirada} disabled={fase !== "preparando"} onChange={(e) => { setEstirada(e.target.checked); void guardarEquipo({ corregirProporcion: e.target.checked }); }} />
          La imagen se ve estirada (la gente se ve ancha)
        </label>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className="fo-btn text-sm" disabled={!stream || calibrando || fase !== "preparando"} onClick={() => void calibrar()}>
            {calibrando ? "Calibrando…" : "Calibrar “sin señal”"}
          </button>
          <span>{equipo?.huellaSinSenal ? "✓ Calibrado" : "Sin calibrar: apagá la videocasetera y tocá Calibrar."}</span>
        </div>
        <label className="text-sm">Calidad
          <select className="ml-2 rounded border p-1" value={calidad} disabled={fase !== "preparando" || Boolean(continuar)} onChange={(e) => setCalidad(e.target.value as Calidad)}>
            <option value="ALTA">Alta (~2,7 GB por hora)</option>
            <option value="MEDIA">Media (~1,8 GB por hora)</option>
            <option value="BAJA">Baja (~1,2 GB por hora, deja más internet libre)</option>
          </select>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. ¿De qué pedido es?</h2>
        {continuar ? (
          <p className="text-sm">Continuás la grabación (tramo {continuar.tramo}).</p>
        ) : (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sinPedido} onChange={(e) => setSinPedido(e.target.checked)} /> Sin pedido (prueba)
            </label>
            {!sinPedido ? (
              <div className="space-y-2">
                <input className="w-full max-w-md rounded border p-2 text-sm" placeholder="Buscá por número de trabajo o cliente" value={busqueda} onChange={(e) => void buscar(e.target.value)} />
                <ul className="max-w-md divide-y rounded border text-sm">
                  {trabajos.map((t) => (
                    <li key={t.id}>
                      <button type="button" className={`w-full p-2 text-left ${proyectoId === t.id ? "bg-gray-100 font-semibold" : ""}`} onClick={() => setProyectoId(t.id)}>
                        {t.numero} · {t.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
                <label className="text-sm">Cassette n.º
                  <input type="number" min={1} max={999} className="ml-2 w-20 rounded border p-1" value={cassette} onChange={(e) => setCassette(Math.max(1, Number(e.target.value) || 1))} />
                </label>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-3">
        {fase === "preparando" && continuar?.tipo !== "DVD" ? (
          <button type="button" className="fo-btn fo-btn-primary" disabled={!puedeGrabar} onClick={() => void grabar()}>● Grabar</button>
        ) : null}
        {fase === "grabando" ? <button type="button" className="fo-btn" onClick={() => void detener("MANUAL")}>⏹ Detener</button> : null}
        {fase === "terminando" ? <p className="text-sm">Terminando de subir… no cierres esta página.</p> : null}
        {fase === "terminada" ? <a className="fo-btn fo-btn-primary" href="/digitalizacion">Ver grabaciones</a> : null}
      </section>

      {fase === "preparando" && !continuar ? <section className="space-y-3 border-t pt-6">{dvd}</section> : null}
      {continuar?.tipo === "DVD" ? dvd : null}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter fotoffice typecheck 2>&1 | grep -E "digitalizacion" | head -20`

Expected: sin errores. Hasta la Tarea 11 va a faltar `@/components/digitalizacion/dvd`: creá un stub mínimo que la Tarea 11 reemplaza:

```tsx
// apps/fotoffice/components/digitalizacion/dvd.tsx (stub, la Tarea 11 lo completa)
"use client";
import type { Continuacion } from "./estacion";
export function DigitalizarDvd(_: { continuar: Continuacion | null }) {
  return null;
}
```

- [ ] **Step 4: Probar en local con una cámara web**

Run (usar `preview_start` con una configuración `fotoffice-digitalizacion` en `.claude/launch.json` que corra `pnpm --filter fotoffice exec next dev --webpack --port 3010` en el worktree, **sin claves en el archivo**).

Con el módulo encendido para el negocio de prueba:
1. Entrá a `http://localhost:3010/digitalizacion/grabar` y tocá "Buscar la capturadora". Elegí la cámara web y el micrófono: ves la vista previa y el medidor se mueve.
2. Tildá la lista, marcá "Sin pedido (prueba)" y tocá **Grabar**: se abre la ventanita.
3. Esperá 40 s: en la ventanita, el tiempo avanza y "Subida al día ✓".
4. Tapá la cámara con la mano: aparece "Sin imagen hace…".
5. Tocá Detener: "Grabación terminada y subida".
6. En la consola del navegador no hay errores. En la base, `DigitalizacionParte` tiene 4 o 5 filas `LISTA`.

Si el `PUT` falla por CORS, pasá a la Tarea 13, Step 2, antes de seguir.

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/components/digitalizacion/estacion.tsx apps/fotoffice/components/digitalizacion/dvd.tsx apps/fotoffice/app/\(shell\)/digitalizacion/grabar/page.tsx
git commit -m "Digitalización: estación de grabación con calibración, asignación y corte automático

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: Digitalizar DVD

**Files:**
- Modify: `apps/fotoffice/components/digitalizacion/dvd.tsx` (reemplaza el stub)

**Interfaces:**
- Consumes: `elegirCarpeta` (Tarea 8), `vobsEnOrden`, `cortesDeArchivo` (Tarea 5), `ColaDeSubida`, `almacenEnMemoria`, `idParte` (Tarea 7), `crearSubidor`, `Continuacion` (Tarea 10), `crearGrabacionAction`, `cerrarGrabacionAction`, `buscarTrabajosAction` (Tarea 6), `Ventanita` (Tarea 9).
- Produces: `DigitalizarDvd({ continuar })`.

- [ ] **Step 1: Implementar**

Los pedacitos de un DVD **no** van a IndexedDB: `File.slice` es una referencia al disco y guardarla copiaría 4,7 GB. Si se interrumpe, "Continuar" pide la carpeta de nuevo y el servidor saltea las partes ya LISTAS.

```tsx
// apps/fotoffice/components/digitalizacion/dvd.tsx
"use client";

import { useState } from "react";
import { buscarTrabajosAction, cerrarGrabacionAction, crearGrabacionAction } from "@/app/(shell)/digitalizacion/actions";
import { elegirCarpeta } from "@/lib/digitalizacion/cliente/apis-navegador";
import { ColaDeSubida, almacenEnMemoria, idParte, type ResumenCola } from "@/lib/digitalizacion/cliente/cola";
import { cortesDeArchivo, vobsEnOrden } from "@/lib/digitalizacion/dvd";
import { crearSubidor, type Continuacion } from "./estacion";
import { Ventanita } from "./ventanita";

async function carpetaVideoTs(raiz: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  if (raiz.name.toUpperCase() === "VIDEO_TS") return raiz;
  for await (const [nombre, h] of (raiz as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
    if (h.kind === "directory" && nombre.toUpperCase() === "VIDEO_TS") return h as FileSystemDirectoryHandle;
  }
  throw new Error("No encontramos la carpeta VIDEO_TS. Elegí el disco o la carpeta VIDEO_TS.");
}

async function archivosDe(dir: FileSystemDirectoryHandle): Promise<File[]> {
  const files: File[] = [];
  for await (const [, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
    if (h.kind === "file") files.push(await (h as FileSystemFileHandle).getFile());
  }
  return vobsEnOrden(files.map((f) => ({ nombre: f.name, f }))).map((x) => x.f);
}

export function DigitalizarDvd({ continuar }: { continuar: Continuacion | null }) {
  const [fase, setFase] = useState<"listo" | "subiendo" | "terminada">("listo");
  const [aviso, setAviso] = useState<string | null>(null);
  const [avance, setAvance] = useState({ hechos: 0, total: 0 });
  const [sinPedido, setSinPedido] = useState(true);
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [trabajos, setTrabajos] = useState<{ id: string; numero: string; nombre: string }[]>([]);

  const empezar = async () => {
    let ventanita: Ventanita | null = null;
    try {
      const archivos = await archivosDe(await carpetaVideoTs(await elegirCarpeta()));
      if (archivos.length === 0) { setAviso("No hay videos en esa carpeta (sólo menús o nada)."); return; }
      ventanita = await Ventanita.abrir(() => setAviso("El DVD sigue subiendo; esperá a que termine."));
      let grabacionId = continuar?.grabacionId ?? null;
      if (!grabacionId) {
        const r = await crearGrabacionAction({
          tipo: "DVD", proyectoId: sinPedido ? null : proyectoId, cassetteNumero: null, calidad: null, mimeType: "video/dvd",
          corregirProporcion: false, equipoId: null, dvdArchivos: archivos.map((f) => ({ nombre: f.name, bytes: f.size })),
        });
        if (!r.ok) { ventanita.cerrar(); setAviso(r.error); return; }
        grabacionId = r.id;
      }
      const id = grabacionId;
      const pedacitos = archivos.flatMap((f) => cortesDeArchivo(f.size).map((c) => f.slice(c.desde, c.hasta)));
      setAvance({ hechos: 0, total: pedacitos.length });
      setFase("subiendo");
      const pintar = (r: ResumenCola) => {
        const hechos = pedacitos.length - r.pendientes;
        setAvance({ hechos, total: pedacitos.length });
        ventanita?.mostrar({ modo: "DVD", stream: null, segundos: 0, bytesPendientes: r.bytesPendientes, ultimoError: r.ultimoError, sinImagenHaceSeg: null, minutosSinSenal: 0, avanceDvd: { hechos, total: pedacitos.length }, terminando: false });
      };
      const cola = new ColaDeSubida(almacenEnMemoria(), crearSubidor(), { alCambiar: pintar });
      await Promise.all(pedacitos.map((datos, indice) => cola.agregar({ id: idParte(id, 1, indice), grabacionId: id, tramo: 1, indice, datos })));
      await cola.vaciada();
      const r = await cerrarGrabacionAction(id, { tramo: 1, duracionSeg: 0, primeraImagenSeg: null, ultimaImagenSeg: null, sinImagen: false, tramosSinSenal: [], motivoFin: "DVD_COMPLETO" });
      setFase("terminada");
      setAviso(r.ok ? "DVD subido completo." : r.error);
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setAviso(e instanceof Error ? e.message : "No se pudo leer el DVD.");
    } finally {
      ventanita?.cerrar();
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Digitalizar DVD</h2>
      {aviso ? <p className="fo-alert-warning p-3 text-sm">{aviso}</p> : null}
      {continuar ? <p className="text-sm">Elegí de nuevo la carpeta del mismo DVD: se sube sólo lo que faltó.</p> : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sinPedido} onChange={(e) => setSinPedido(e.target.checked)} /> Sin pedido (prueba)
          </label>
          {!sinPedido ? (
            <div className="space-y-2">
              <input className="w-full max-w-md rounded border p-2 text-sm" placeholder="Buscá por número de trabajo o cliente" onChange={(e) => void buscarTrabajosAction(e.target.value).then((r) => r.ok && setTrabajos(r.trabajos))} />
              <ul className="max-w-md divide-y rounded border text-sm">
                {trabajos.map((t) => (
                  <li key={t.id}><button type="button" className={`w-full p-2 text-left ${proyectoId === t.id ? "bg-gray-100 font-semibold" : ""}`} onClick={() => setProyectoId(t.id)}>{t.numero} · {t.nombre}</button></li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
      {fase === "listo" ? (
        <button type="button" className="fo-btn fo-btn-primary" disabled={!continuar && !sinPedido && !proyectoId} onClick={() => void empezar()}>Elegir la carpeta del DVD</button>
      ) : null}
      {fase === "subiendo" ? <p className="text-sm">Subiendo parte {avance.hechos} de {avance.total}… podés seguir usando la computadora.</p> : null}
      {fase === "terminada" ? <a className="fo-btn fo-btn-primary" href="/digitalizacion">Ver grabaciones</a> : null}
    </div>
  );
}
```

**Ojo con `cerrarGrabacionAction` para DVD.** `validarCierre` exige un `Latido` válido; el objeto de arriba lo es (`duracionSeg: 0`, sin tramos).

- [ ] **Step 2: Probar en local**

Con una carpeta de prueba `VIDEO_TS` que tenga `VIDEO_TS.VOB` (menú, 1 MB), `VTS_01_0.VOB` (1 MB), `VTS_01_1.VOB` (40 MB) y `VTS_01_2.VOB` (20 MB), con bytes al azar (`head -c 40m /dev/urandom > VTS_01_1.VOB`):

1. "Elegir la carpeta del DVD" → la carpeta.
2. Verificá que se suben **4 partes** (3 de VTS_01_1 y 1 de VTS_01_2) y que termina con "DVD subido completo".
3. En la base, `dvdArchivos` lista sólo `VTS_01_1.VOB` y `VTS_01_2.VOB`, en ese orden.

- [ ] **Step 3: Commit**

```bash
git add apps/fotoffice/components/digitalizacion/dvd.tsx
git commit -m "Digitalización: subir un DVD casero desde su carpeta VIDEO_TS

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Lista de grabaciones, acciones y "Descargar crudo"

**Files:**
- Create: `apps/fotoffice/lib/digitalizacion/cliente/descargar-crudo.ts`
- Create: `apps/fotoffice/components/digitalizacion/acciones-grabacion.tsx`
- Create: `apps/fotoffice/app/(shell)/digitalizacion/page.tsx`

**Interfaces:**
- Consumes: `elegirArchivoDeDestino` (Tarea 8); `urlsDeLecturaAction`, `terminarConLoGrabadoAction`, `descartarGrabacionAction`, `guardarAjustesAction` (Tarea 6); `listarGrabaciones`, `leerAjustes`, `requireDigitalizacion` (Tarea 6); `estadoVisible` (Tarea 5).
- Produces: `descargarCrudo(urls, nombre, alAvance): Promise<void>`; `AccionesGrabacion({ id, estado, tipo })`; `AjusteMinutos({ minutos })`.

- [ ] **Step 1: Implementar `descargar-crudo.ts`**

```ts
// apps/fotoffice/lib/digitalizacion/cliente/descargar-crudo.ts
import { elegirArchivoDeDestino } from "./apis-navegador";

/**
 * Escribe las partes, en orden, en un archivo que elige el usuario. No pasa por Vercel ni por la
 * memoria: cada parte va del almacenamiento al disco en streaming. Herramienta de verificación.
 */
export async function descargarCrudo(urls: string[], nombre: string, alAvance: (hechas: number, total: number) => void): Promise<void> {
  const destino = await elegirArchivoDeDestino(nombre);
  try {
    for (let i = 0; i < urls.length; i++) {
      const res = await fetch(urls[i]);
      if (!res.ok || !res.body) throw new Error(`La parte ${i + 1} no se pudo leer (${res.status}).`);
      await res.body.pipeTo(destino, { preventClose: true });
      alAvance(i + 1, urls.length);
    }
    await destino.close();
  } catch (e) {
    await destino.abort();
    throw e;
  }
}
```

- [ ] **Step 2: Implementar los botones**

```tsx
// apps/fotoffice/components/digitalizacion/acciones-grabacion.tsx
"use client";

import { useState, useTransition } from "react";
import { descartarGrabacionAction, guardarAjustesAction, terminarConLoGrabadoAction, urlsDeLecturaAction } from "@/app/(shell)/digitalizacion/actions";
import { descargarCrudo } from "@/lib/digitalizacion/cliente/descargar-crudo";
import type { EstadoVisible } from "@/lib/digitalizacion/validar";

export function AccionesGrabacion({ id, estado }: { id: string; estado: EstadoVisible }) {
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const bajar = async () => {
    const r = await urlsDeLecturaAction(id);
    if (!r.ok) { setAviso(r.error); return; }
    if (r.urls.length === 0) { setAviso("Todavía no hay partes subidas."); return; }
    try {
      await descargarCrudo(r.urls, r.nombre, (h, t) => setAviso(`Descargando ${h} de ${t}…`));
      setAviso("Descarga completa.");
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setAviso(e instanceof Error ? e.message : "No se pudo descargar.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {estado === "INTERRUMPIDA" ? (
        <>
          <a className="fo-btn fo-btn-primary text-xs" href={`/digitalizacion/grabar?continuar=${id}`}>Continuar</a>
          <button type="button" className="fo-btn text-xs" disabled={pendiente} onClick={() => empezar(async () => { const r = await terminarConLoGrabadoAction(id); if (!r.ok) setAviso(r.error); })}>Terminar con lo grabado</button>
        </>
      ) : null}
      <button type="button" className="fo-btn text-xs" onClick={() => void bajar()}>Descargar crudo</button>
      <button
        type="button"
        className="fo-btn text-xs"
        disabled={pendiente || estado === "GRABANDO"}
        onClick={() => {
          if (!window.confirm("¿Descartar esta grabación? Se borra todo lo subido y no se puede deshacer.")) return;
          empezar(async () => { const r = await descartarGrabacionAction(id); if (!r.ok) setAviso(r.error); });
        }}
      >
        Descartar
      </button>
      {aviso ? <span className="text-gray-600">{aviso}</span> : null}
    </div>
  );
}

export function AjusteMinutos({ minutos }: { minutos: number }) {
  const [valor, setValor] = useState(minutos);
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <form className="flex items-center gap-2 text-sm" action={async () => { const r = await guardarAjustesAction(valor); setAviso(r.ok ? "Guardado." : r.error); }}>
      <label>Cortar tras
        <input type="number" min={1} max={30} className="mx-2 w-16 rounded border p-1" value={valor} onChange={(e) => setValor(Number(e.target.value))} />
        minutos sin imagen
      </label>
      <button type="submit" className="fo-btn text-xs">Guardar</button>
      {aviso ? <span>{aviso}</span> : null}
    </form>
  );
}
```

`<a>` común para "Continuar", no `<Link>`: el render de `/digitalizacion/grabar?continuar=` agrega un tramo, y un prefetch lo haría sin que nadie toque.

- [ ] **Step 3: Implementar la página**

```tsx
// apps/fotoffice/app/(shell)/digitalizacion/page.tsx
import { PageHeader } from "@/components/page-header";
import { AccionesGrabacion, AjusteMinutos } from "@/components/digitalizacion/acciones-grabacion";
import { requireDigitalizacion } from "@/lib/digitalizacion/contexto";
import { leerAjustes, listarGrabaciones } from "@/lib/digitalizacion/servidor/grabaciones";
import { estadoVisible } from "@/lib/digitalizacion/validar";

export const dynamic = "force-dynamic";

const ESTADOS: Record<string, string> = { GRABANDO: "Grabando", COMPLETA: "Completa", INTERRUMPIDA: "Interrumpida" };
const MOTIVOS: Record<string, string> = {
  MANUAL: "Detenida a mano",
  SIN_SENAL: "Se cortó sola (sin imagen)",
  TOPE: "Llegó al tope de 8 h 30 min",
  DVD_COMPLETO: "DVD completo",
  TERMINADA_CON_LO_GRABADO: "Terminada con lo grabado",
};
const duracion = (s: number) => `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, "0")} min`;
const gb = (b: bigint) => `${(Number(b) / 1024 ** 3).toFixed(2)} GB`;
const fecha = (d: Date) => d.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", dateStyle: "short", timeStyle: "short" });

export default async function DigitalizacionPage() {
  const { workspace, puedeGrabar } = await requireDigitalizacion("VIEW");
  const [grabaciones, ajustes] = await Promise.all([listarGrabaciones(workspace.id), leerAjustes(workspace.id)]);
  const ahora = new Date();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Digitalización"
        description="Cassettes VHS y DVD grabados o subidos. La conversión a Full HD llega en la próxima etapa."
        actions={puedeGrabar ? <a href="/digitalizacion/grabar" className="fo-btn fo-btn-primary text-sm">● Grabar</a> : undefined}
      />
      {puedeGrabar ? <AjusteMinutos minutos={ajustes.minutosSinSenal} /> : null}
      {grabaciones.length === 0 ? <p className="text-sm text-gray-600">Todavía no hay grabaciones.</p> : (
        <ul className="divide-y rounded border">
          {grabaciones.map((g) => {
            const estado = estadoVisible(g, ahora);
            return (
              <li key={g.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">
                    {g.tipo === "DVD" ? "DVD" : `VHS${g.cassetteNumero ? ` · cassette ${g.cassetteNumero}` : ""}`}
                    {g.proyecto ? ` · ${g.proyecto.number} · ${g.proyecto.name}` : " · prueba"}
                  </p>
                  <span className={estado === "INTERRUMPIDA" ? "fo-alert-warning px-2 text-xs" : "text-xs text-gray-600"}>{ESTADOS[estado] ?? estado}</span>
                </div>
                <p className="text-sm text-gray-600">
                  {fecha(g.iniciadaAt)} · {g.tipo === "VHS" ? `${duracion(g.duracionSeg)} · ` : ""}{gb(g.bytesSubidos)}
                  {g.tramos > 1 ? ` · ${g.tramos} tramos` : ""}
                  {g.motivoFin ? ` · ${MOTIVOS[g.motivoFin] ?? g.motivoFin}` : ""}
                  {g.sinImagen && g.tipo === "VHS" ? " · ¡no se vio imagen en ningún momento!" : ""}
                </p>
                {puedeGrabar ? <AccionesGrabacion id={g.id} estado={estado} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Probar en local**

1. Abrí `/digitalizacion`: aparecen las grabaciones de las Tareas 10 y 11 con su estado, duración y tamaño.
2. "Descargar crudo" de la de cámara web: elegí dónde guardarla. El archivo se abre en VLC y se ve y escucha completo.
3. Empezá otra grabación y cerrá la pestaña a la fuerza (esperá 3 minutos o cambiá `ultimoLatidoAt` en la base de desarrollo): aparece **Interrumpida**.
4. "Continuar" graba el tramo 2.
5. "Terminar con lo grabado" la deja Completa.
6. "Descartar" la saca de la lista y borra sus objetos (verificalo en R2 con el prefijo).

- [ ] **Step 5: Commit**

```bash
git add apps/fotoffice/lib/digitalizacion/cliente/descargar-crudo.ts apps/fotoffice/components/digitalizacion/acciones-grabacion.tsx apps/fotoffice/app/\(shell\)/digitalizacion/page.tsx
git commit -m "Digitalización: lista de grabaciones con continuar, terminar, descartar y descargar crudo

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Verificación completa, CORS, migración, PR y prueba real

**Files:**
- Ninguno nuevo. Los ajustes de umbrales que salgan de la prueba real van a `lib/digitalizacion/senal/clasificador.ts` (`UMBRALES`), con su test.

- [ ] **Step 1: Toda la batería**

Run: `pnpm --filter fotoffice test && NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter fotoffice typecheck; echo "salida=$?" && pnpm --filter fotoffice lint`

Expected: tests en verde, typecheck terminado de verdad (que la salida llegue al final, no un corte por memoria) y lint sin errores en archivos nuevos.

- [ ] **Step 2: CORS del bucket privado**

El navegador hace `PUT` (subida) y `GET` con `fetch` (Descargar crudo) contra el bucket `R2_PRIVATE_BUCKET`. Consultá la regla actual con la herramienta de R2 del MCP de DNX (validar el bucket). Tiene que permitir `PUT` y `GET` desde `https://fotoffice.com`, `https://www.fotoffice.com` y `http://localhost:3010`, con las cabeceras `content-type`.

**Si falta algo, pedile autorización a Daniel antes de cambiar la regla:** es una configuración en producción que comparte la carpeta del trabajo. Explicale qué se agrega.

- [ ] **Step 3: Aplicar la migración en producción**

Seguí la memoria de migraciones de FOTOFFICE: SQL a mano en la base de producción (rama "development" del proyecto Neon de FOTOFFICE) y después registrala con `prisma migrate resolve --applied 20261126120000_fotoffice_digitalizacion`, usando el checksum de una base sana. Verificá con:

```sql
SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'Digitalizacion%' ORDER BY 1;
```

Expected: las 4 tablas. Esto va **antes** de fusionar, porque una tabla que falta rompe el cliente de Prisma.

- [ ] **Step 4: PR**

```bash
git branch -m feat/fotoffice-digitalizacion-grabadora
git push -u origin feat/fotoffice-digitalizacion-grabadora
gh pr create --title "FOTOFFICE: grabadora de VHS y DVD (Digitalización, parte 1)" --body "$(cat <<'EOF'
Estación de grabación en el navegador: capturadora USB, ventanita flotante, subida en pedacitos al R2 privado mientras graba en segundo plano, corte automático tras N minutos sin imagen y DVD desde VIDEO_TS.

- Spec: docs/superpowers/specs/2026-10-20-fotoffice-digitalizacion-grabadora-design.md
- Plan: docs/superpowers/plans/2026-10-20-fotoffice-digitalizacion-grabadora.md
- Migración: sólo tablas nuevas, aplicada en producción antes de fusionar.
- Falta: prueba real con la capturadora de DNX (ver checklist del plan, Tarea 13).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Después vinculá el PR con las herramientas de PR de la app y mirá el CI. Con CI en verde, se fusiona (memoria: los PR en verde se fusionan sin preguntar).

- [ ] **Step 4b: Encender el módulo para DNX**

En `/admin/workspaces` (super admin), encendé **Digitalización** sólo para el negocio de DNX. Verificá que aparece en el menú de DNX y en ningún otro negocio.

- [ ] **Step 5: Prueba real con Daniel (criterio de aceptación)**

En la computadora del local, con Chrome o Edge, la videocasetera, el **conversor AV a HDMI** y la capturadora:

1. "Buscar la capturadora" → elegir la capturadora y su audio. La vista previa se ve; si la gente se ve ancha, tildar "estirada" y comprobar que la vista previa se corrige.
2. Videocasetera **apagada** → "Calibrar “sin señal”" → "✓ Calibrado".
3. Asignar un trabajo real (o "Sin pedido") → **Grabar** una cinta de unas 2 horas. Minimizar la ventana y usar la computadora normalmente (navegador, Office, etc.) todo el tiempo.
4. A los ~30 minutos, desenchufar el cable de red 2 minutos y volver a enchufarlo: la ventanita muestra "Pendiente" y después vuelve a "Subida al día ✓".
5. Dejar que la cinta termine: la grabación **se corta sola** 5 minutos después del final.
6. En la lista, la grabación figura con "Se cortó sola (sin imagen)" y una duración ≈ largo real + 5 min.
7. "Descargar crudo" → el archivo se reproduce entero, con sonido, sin saltos.
8. Grabar otra cinta 5 minutos y **cerrar el navegador a la fuerza**. Volver a abrir: la grabación figura "Interrumpida" a los 3 minutos; "Continuar" graba el tramo 2.
9. Un DVD casero: se suben todos sus VOB y termina con "DVD subido completo".

Anotá en la descripción del PR lo que se vio en cada punto. Si el corte no detectó la pantalla de fin de cinta, revisá la clase que mandó el worker en esos segundos y ajustá `UMBRALES` con un test nuevo que la reproduzca.
