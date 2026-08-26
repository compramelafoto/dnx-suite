# Design Studio — núcleo de render — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `@repo/design-studio` como paquete puro de dominio que recibe un documento
de diseño neutral más los datos de una pieza y devuelve el archivo final (PDF y PNG), con
reproducción garantizada y sin emitir en silencio campos vacíos.

**Architecture:** Un único camino de entrada (`emitDesign`) encadena seis etapas puras y
testeables por separado: parsear el documento → resolver variables contra un contrato tipado →
validar → calcular un plan de maquetado con cajas absolutas → dibujar → sellar con checksum.
El paquete no sabe de base de datos, de R2 ni de React: los recursos entran por un puerto que
inyecta el producto.

**Tech Stack:** TypeScript 5.9.2 · Node 18+ · `pdf-lib` + `@pdf-lib/fontkit` (PDF vectorial) ·
`pdf-to-png-converter` (PNG desde el mismo PDF) · `qrcode` · `@fontsource/*` (WOFF empaquetado) ·
`node --test` con `tsx`.

**Spec:** `docs/superpowers/specs/2026-08-26-modulo-de-diseno-design.md`

---

## Alcance de este plan

La spec aprobada describe el módulo completo. Este plan implementa **solo el núcleo de render**:
lo que hace falta para que un producto emita una pieza real. Quedan fuera, cada uno con su
plan propio:

| Fuera de este plan | Por qué |
|---|---|
| Persistencia (`DesignTemplate`, `Version`, `Draft`, `Published`, `RenderedArtifact`) | Es un subsistema con su propio esquema Prisma y sus propias migraciones |
| Editor `react-rnd` | Depende de que el documento neutral ya exista y esté probado |
| Congelado de recursos al publicar | Depende de la persistencia |
| Permisos y propiedad multi-workspace | Depende de la persistencia |

Los tipos que esos planes necesitan (`ownerType`, `visibility`, `RenderedArtifact`) **no** se
inventan acá. Lo que sí produce este plan es el dato que la emisión tiene que registrar:
`rendererVersion`, `schemaVersion` y `checksum` salen de `emitDesign`.

## Desvío respecto de la spec, documentado

La spec (§4, "Por qué SVG") propone SVG como paso intermedio hacia PDF y PNG. **Este plan usa
SVG solo para la vista de pantalla, y genera el PDF directamente con `pdf-lib` + `fontkit`.**

El motivo es concreto y verificable en este repositorio: convertir SVG a PNG con `sharp` resuelve
las tipografías por `fontconfig` del sistema operativo, que en Vercel no contiene las fuentes de
`@fontsource`. El resultado sería una pieza impresa con la fuente equivocada y sin aviso. El
camino `pdf-lib` + `fontkit` incrusta el WOFF en el archivo, ya está en producción en fotorank
(`apps/fotorank/app/lib/fotorank/diplomas/renderDiploma.ts`) y produce **texto vectorial**, que es
mejor para imprenta que un raster.

El PNG se obtiene **del mismo PDF** con `pdf-to-png-converter`. Así la impresión y la pantalla no
pueden divergir: son el mismo archivo rasterizado.

Ambos backends consumen el mismo `LayoutPlan`, así que la decisión pantalla/impresión sigue
tomándose al exportar y no al diseñar, que es el requisito real de la spec.

## Global Constraints

- Nombre del paquete: **`@repo/design-studio`**, privado, `"type": "module"`.
- TypeScript **5.9.2**; `tsconfig` extiende `@repo/typescript-config/base.json`, que tiene
  `strict: true` y **`noUncheckedIndexedAccess: true`**: todo acceso por índice devuelve
  `T | undefined` y hay que estrecharlo.
- Origen de coordenadas del documento: **esquina superior izquierda, `y` hacia abajo**.
- Unidad interna de maquetado: **puntos PDF (1/72")**. `PRINT` declara milímetros, `SCREEN`
  declara píxeles.
- Toda función que pueda fallar devuelve un resultado explícito
  (`{ ok: true; value } | { ok: false; errors: string[] }`), nunca un valor por defecto silencioso.
- **Una variable requerida ausente hace fallar la emisión.** Nunca `?? ""`.
- Los mensajes de error son para una persona no técnica, en español, y nombran el campo.
- Fechas: formateo propio a partir de componentes **UTC**. Prohibido `toLocaleDateString`
  y `Intl` en el camino de render: el resultado dependería del servidor y rompería la reproducción.
- `RENDERER_VERSION` arranca en `"1.0.0"` y sube con cualquier cambio que altere el archivo emitido.
- `DESIGN_SCHEMA_VERSION` arranca en `1`.
- Tests: `node --import tsx --test "src/**/*.test.ts"`, con `node:test` y `node:assert/strict`.
- Ningún archivo del paquete importa React, Prisma ni `@repo/db`.

---

## Estructura de archivos

```
packages/design-studio/
  package.json
  tsconfig.json
  README.md
  src/
    index.ts                       Barril público
    result.ts                      El tipo Result y sus ayudas
    document/
      units.ts                     mm ↔ puntos ↔ píxeles
      schema.ts                    Tipos del documento neutral + DESIGN_SCHEMA_VERSION
      parse.ts                     Validación estructural con rechazo explícito
      migrate.ts                   Migraciones entre versiones de esquema
      __fixtures__/carnet-v1.json  Documento histórico de regresión
      document.test.ts
    variables/
      contract.ts                  VariableDeclaration y VariableContract
      dates.ts                     Formatos de fecha deterministas en UTC
      resolve.ts                   Contrato + valores → variables resueltas
      variables.test.ts
    fonts/
      catalog.ts                   Catálogo controlado de fuentes
      load.ts                      Lectura de los WOFF de @fontsource
      fonts.test.ts
    validation/
      qr.ts                        Legibilidad del QR en tres niveles
      publish.ts                   Validación previa a publicar
      validation.test.ts
    layout/
      wrap.ts                      Corte de líneas medido con la fuente real
      plan.ts                      Documento + variables → LayoutPlan
      layout.test.ts
    render/
      version.ts                   RENDERER_VERSION
      pdf.ts                       LayoutPlan → PDF
      png.ts                       PDF → PNG
      svg.ts                       LayoutPlan → SVG de pantalla
      render.test.ts
    export/
      contract.ts                  ExportRequest, ExportResult, checksum
      emit.ts                      emitDesign: la única puerta de entrada
      emit.test.ts
```

Cada archivo tiene una responsabilidad y ninguno pasa de unas 300 líneas. `plan.ts` es el único
que conoce a la vez el documento y las variables resueltas; los backends de dibujo solo ven el
`LayoutPlan`, así que agregar un tercer formato de salida no toca el documento.

---

### Task 1: Andamiaje del paquete y unidades

**Files:**
- Create: `packages/design-studio/package.json`
- Create: `packages/design-studio/tsconfig.json`
- Create: `packages/design-studio/src/result.ts`
- Create: `packages/design-studio/src/document/units.ts`
- Test: `packages/design-studio/src/document/document.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `Result<T>`, `ok(value)`, `fail(...errors)`, `mmToPt(mm)`, `ptToMm(pt)`,
  `mmToPx(mm, dpi)`, `pxToPt(px)`.

- [ ] **Step 1: Crear el paquete**

`packages/design-studio/package.json`:

```json
{
  "name": "@repo/design-studio",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "DNX Design Studio — documento de diseño neutral, contrato de variables y render reproducible a PDF/PNG.",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./document": "./src/document/schema.ts",
    "./variables": "./src/variables/contract.ts",
    "./fonts": "./src/fonts/catalog.ts",
    "./validation": "./src/validation/publish.ts",
    "./render": "./src/export/emit.ts"
  },
  "scripts": {
    "check-types": "tsc --noEmit -p tsconfig.json",
    "test": "node --import tsx --test \"src/**/*.test.ts\""
  },
  "dependencies": {
    "@fontsource/cinzel": "^5.2.8",
    "@fontsource/dm-sans": "^5.2.8",
    "@fontsource/great-vibes": "^5.2.8",
    "@fontsource/inter": "^5.2.8",
    "@fontsource/merriweather": "^5.2.11",
    "@fontsource/playfair-display": "^5.2.8",
    "@pdf-lib/fontkit": "^1.1.1",
    "pdf-lib": "^1.17.1",
    "pdf-to-png-converter": "^3.14.0",
    "qrcode": "^1.5.4"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^22.15.3",
    "@types/qrcode": "^1.5.6",
    "tsx": "^4.19.2",
    "typescript": "5.9.2"
  }
}
```

`packages/design-studio/tsconfig.json`:

```json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "noEmit": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["node"],
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 2: Instalar dependencias**

Run: `pnpm install`
Expected: `packages/design-studio/node_modules` existe y `pnpm --filter @repo/design-studio exec tsc --version` imprime `Version 5.9.2`.

- [ ] **Step 3: Escribir el test que falla**

`packages/design-studio/src/document/document.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mmToPt, ptToMm, mmToPx, pxToPt } from "./units";

test("una pulgada son 25,4 mm y 72 puntos", () => {
  assert.equal(Math.round(mmToPt(25.4) * 1000) / 1000, 72);
});

test("mmToPt y ptToMm son inversas", () => {
  const original = 85.6;
  assert.ok(Math.abs(ptToMm(mmToPt(original)) - original) < 1e-9);
});

test("mmToPx respeta los puntos por pulgada", () => {
  assert.equal(Math.round(mmToPx(25.4, 300)), 300);
  assert.equal(Math.round(mmToPx(25.4, 96)), 96);
});

test("un pixel de pantalla vale 0,75 puntos", () => {
  assert.equal(pxToPt(96), 72);
});
```

- [ ] **Step 4: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './units'`

- [ ] **Step 5: Implementar `result.ts`**

```ts
/**
 * Resultado explícito. El módulo nunca devuelve un valor por defecto cuando algo falla:
 * un diseño que se emite mal en silencio es peor que uno que no se emite.
 */
export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T>(...errors: string[]): Result<T> {
  return { ok: false, errors };
}

export function isOk<T>(r: Result<T>): r is { ok: true; value: T } {
  return r.ok;
}
```

- [ ] **Step 6: Implementar `document/units.ts`**

```ts
/**
 * El documento declara milímetros cuando el medio es PRINT y píxeles cuando es SCREEN.
 * El maquetado trabaja siempre en puntos PDF (1/72 de pulgada), que es la unidad de pdf-lib.
 */

const MM_PER_INCH = 25.4;
const PT_PER_INCH = 72;
/** Densidad de referencia de CSS: 96 px equivalen a una pulgada. */
const CSS_PX_PER_INCH = 96;

export function mmToPt(mm: number): number {
  return (mm / MM_PER_INCH) * PT_PER_INCH;
}

export function ptToMm(pt: number): number {
  return (pt / PT_PER_INCH) * MM_PER_INCH;
}

export function mmToPx(mm: number, dpi: number): number {
  return (mm / MM_PER_INCH) * dpi;
}

export function pxToPt(px: number): number {
  return (px / CSS_PX_PER_INCH) * PT_PER_INCH;
}

export function ptToPx(pt: number, dpi: number): number {
  return (pt / PT_PER_INCH) * dpi;
}
```

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 4 tests.

- [ ] **Step 8: Commit**

```bash
git add packages/design-studio pnpm-lock.yaml
git commit -m "feat(design-studio): andamiaje del paquete y conversion de unidades"
```

---

### Task 2: El documento neutral y su lectura estricta

El motor de diplomas actual, ante un JSON que no entiende, devuelve la plantilla por defecto
(`parseDiplomaLayoutJson` en `apps/fotorank/app/lib/fotorank/diplomas/layoutSchema.ts`). Eso
significa emitir un diploma que no es el que el usuario diseñó, sin avisar. Acá se hace lo
contrario: **un documento que no se entiende se rechaza con el motivo**.

**Files:**
- Create: `packages/design-studio/src/document/schema.ts`
- Create: `packages/design-studio/src/document/parse.ts`
- Test: `packages/design-studio/src/document/document.test.ts` (agregar casos)

**Interfaces:**
- Consumes: `Result<T>`, `ok`, `fail` de `src/result.ts`.
- Produces: `DESIGN_SCHEMA_VERSION`, tipos `DesignDocument`, `DesignFormat`, `DesignSide`,
  `DesignBlock`, `TextBlock`, `QrBlock`, `ImageBlock`, `LineBlock`, `RectBlock`,
  y `parseDesignDocument(raw: unknown): Result<DesignDocument>`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar al final de `packages/design-studio/src/document/document.test.ts`:

```ts
import { parseDesignDocument } from "./parse";
import { DESIGN_SCHEMA_VERSION } from "./schema";

function carnetValido() {
  return {
    schemaVersion: DESIGN_SCHEMA_VERSION,
    metadata: { name: "Carnet SFPR" },
    format: {
      medium: "PRINT",
      width: 85.6,
      height: 54,
      dpi: 300,
      bleedMm: 3,
      safeAreaMm: 3,
    },
    sides: [
      {
        id: "frente",
        name: "Frente",
        background: "#ffffff",
        blocks: [
          {
            id: "nombre",
            type: "text",
            x: 6,
            y: 20,
            width: 55,
            height: 8,
            fontId: "dmSans",
            fontSize: 11,
            color: "#111111",
            align: "left",
            content: "{{fullName}}",
          },
        ],
      },
      {
        id: "dorso",
        name: "Dorso",
        background: "#ffffff",
        blocks: [
          {
            id: "qr",
            type: "qrcode",
            x: 55,
            y: 14,
            width: 26,
            height: 26,
            variableKey: "verificationUrl",
            errorCorrection: "M",
            quietZoneModules: 4,
          },
        ],
      },
    ],
  };
}

test("acepta un carnet bien formado", () => {
  const r = parseDesignDocument(carnetValido());
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.sides.length, 2);
  assert.equal(r.value.format.medium, "PRINT");
});

test("rechaza un documento que no es un objeto", () => {
  const r = parseDesignDocument("no soy un documento");
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /documento/i);
});

test("rechaza un bloque de tipo desconocido en vez de ignorarlo", () => {
  const doc = carnetValido();
  doc.sides[0]!.blocks.push({ id: "raro", type: "video", x: 0, y: 0, width: 1, height: 1 } as never);
  const r = parseDesignDocument(doc);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /video/);
});

test("rechaza un PRINT sin dpi porque no se podria rasterizar", () => {
  const doc = carnetValido();
  delete (doc.format as Record<string, unknown>).dpi;
  const r = parseDesignDocument(doc);
  assert.equal(r.ok, false);
});

test("rechaza identificadores de cara repetidos", () => {
  const doc = carnetValido();
  doc.sides[1]!.id = "frente";
  const r = parseDesignDocument(doc);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /frente/);
});

test("rechaza un documento sin caras", () => {
  const doc = carnetValido();
  doc.sides = [];
  const r = parseDesignDocument(doc);
  assert.equal(r.ok, false);
});

test("acumula todos los errores, no solo el primero", () => {
  const r = parseDesignDocument({ schemaVersion: DESIGN_SCHEMA_VERSION, metadata: {}, format: {}, sides: [] });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.ok(r.errors.length >= 2, `esperaba varios errores, hubo ${r.errors.length}`);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './parse'`

- [ ] **Step 3: Implementar `document/schema.ts`**

```ts
/**
 * El documento neutral. Es lo único que el editor produce y lo único que el renderizador
 * consume. No contiene estructuras de ninguna librería de edición: cambiar react-rnd por
 * otra cosa no debe obligar a migrar una sola plantilla.
 *
 * Coordenadas: origen arriba a la izquierda, `y` hacia abajo.
 * Unidades: milímetros si `format.medium` es PRINT, píxeles si es SCREEN.
 */

export const DESIGN_SCHEMA_VERSION = 1;

export type DesignMedium = "PRINT" | "SCREEN";

export type DesignFormat = {
  medium: DesignMedium;
  /** mm en PRINT, px en SCREEN */
  width: number;
  height: number;
  /** Solo PRINT: densidad a la que se rasteriza. Obligatorio en PRINT. */
  dpi?: number;
  /** Solo PRINT: milímetros de sangrado por lado. */
  bleedMm?: number;
  /** Solo PRINT: milímetros de margen seguro por lado. */
  safeAreaMm?: number;
};

/** Metadatos de capa del editor. Solo `hidden` afecta al dibujo. */
export type BlockChrome = {
  locked?: boolean;
  hidden?: boolean;
  layerName?: string;
};

export type BlockGeometry = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Grados en sentido horario alrededor del centro de la caja. */
  rotation?: number;
  /** 0 a 1. */
  opacity?: number;
};

export type TextAlign = "left" | "center" | "right";
export type FontWeight = "normal" | "bold";
export type FontStyle = "normal" | "italic";

export type TextBlock = BlockGeometry &
  BlockChrome & {
    type: "text";
    fontId: string;
    /** Cuerpo tipográfico en PUNTOS, en los dos medios. No en las unidades del documento. */
    fontSize: number;
    fontWeight?: FontWeight;
    fontStyle?: FontStyle;
    color: string;
    align?: TextAlign;
    /** Texto fijo o con marcadores `{{clave}}` declarados en el contrato de variables. */
    content: string;
    /** Si el texto no entra en estas líneas, la validación de publicación lo rechaza. */
    maxLines?: number;
  };

export type QrErrorCorrection = "L" | "M" | "Q" | "H";

export type QrBlock = BlockGeometry &
  BlockChrome & {
    type: "qrcode";
    /** Clave de la variable de tipo `qrPayload` que trae la URL corta o el token. */
    variableKey: string;
    errorCorrection: QrErrorCorrection;
    /** Módulos de zona de silencio por lado. El estándar recomienda 4. */
    quietZoneModules: number;
    darkColor?: string;
    lightColor?: string;
  };

export type ImageFit = "cover" | "contain";

export type ImageBlock = BlockGeometry &
  BlockChrome & {
    type: "image";
    /**
     * Referencia de recurso que el producto resuelve a bytes, o clave de una variable de
     * tipo `image`. Exactamente una de las dos.
     */
    resourceRef?: string;
    variableKey?: string;
    fit: ImageFit;
  };

export type LineBlock = BlockGeometry &
  BlockChrome & {
    type: "line";
    strokeColor: string;
    strokeWidth: number;
  };

export type RectBlock = BlockGeometry &
  BlockChrome & {
    type: "rect";
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    /** Radio de esquina, en las unidades del documento. */
    cornerRadius?: number;
  };

export type DesignBlock = TextBlock | QrBlock | ImageBlock | LineBlock | RectBlock;

export type DesignSide = {
  id: string;
  name: string;
  background: string;
  blocks: DesignBlock[];
};

export type DesignDocument = {
  schemaVersion: number;
  metadata: { name: string; description?: string };
  format: DesignFormat;
  /** Arreglo, no campos por cara: así el fotolibro entra después sin rediseñar el esquema. */
  sides: DesignSide[];
};

export const BLOCK_TYPES = ["text", "qrcode", "image", "line", "rect"] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];
```

- [ ] **Step 4: Implementar `document/parse.ts`**

```ts
import { fail, ok, type Result } from "../result";
import {
  BLOCK_TYPES,
  DESIGN_SCHEMA_VERSION,
  type BlockChrome,
  type BlockGeometry,
  type DesignBlock,
  type DesignDocument,
  type DesignFormat,
  type DesignSide,
} from "./schema";

/** Acumulador de errores: se informan todos juntos, no de a uno por intento. */
class Errores {
  readonly list: string[] = [];
  add(mensaje: string): void {
    this.list.push(mensaje);
  }
}

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function numeroFinito(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function color(v: unknown): string | null {
  return typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v) ? v : null;
}

function texto(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function leerGeometria(o: Record<string, unknown>, donde: string, e: Errores): BlockGeometry | null {
  const id = texto(o.id);
  if (!id) {
    e.add(`${donde}: falta el identificador del bloque.`);
    return null;
  }
  const x = numeroFinito(o.x);
  const y = numeroFinito(o.y);
  const width = numeroFinito(o.width);
  const height = numeroFinito(o.height);
  if (x === null || y === null || width === null || height === null) {
    e.add(`${donde} "${id}": la posición y el tamaño tienen que ser números.`);
    return null;
  }
  if (width <= 0 || height <= 0) {
    e.add(`${donde} "${id}": el ancho y el alto tienen que ser mayores que cero.`);
    return null;
  }
  const rotation = numeroFinito(o.rotation);
  const opacity = numeroFinito(o.opacity);
  return {
    id,
    x,
    y,
    width,
    height,
    ...(rotation !== null ? { rotation } : {}),
    ...(opacity !== null && opacity >= 0 && opacity <= 1 ? { opacity } : {}),
  };
}

function leerChrome(o: Record<string, unknown>): BlockChrome {
  const layerName = texto(o.layerName);
  return {
    ...(typeof o.locked === "boolean" ? { locked: o.locked } : {}),
    ...(typeof o.hidden === "boolean" ? { hidden: o.hidden } : {}),
    ...(layerName ? { layerName: layerName.slice(0, 120) } : {}),
  };
}

function leerBloque(raw: unknown, donde: string, e: Errores): DesignBlock | null {
  if (!esObjeto(raw)) {
    e.add(`${donde}: cada bloque tiene que ser un objeto.`);
    return null;
  }
  const tipo = texto(raw.type);
  if (!tipo || !(BLOCK_TYPES as readonly string[]).includes(tipo)) {
    e.add(`${donde}: tipo de bloque desconocido "${String(raw.type)}". Este documento fue creado con una versión más nueva del editor.`);
    return null;
  }
  const geo = leerGeometria(raw, donde, e);
  if (!geo) return null;
  const chrome = leerChrome(raw);

  if (tipo === "text") {
    const fontId = texto(raw.fontId);
    const fontSize = numeroFinito(raw.fontSize);
    const contenido = texto(raw.content);
    const col = color(raw.color);
    if (!fontId) e.add(`Bloque de texto "${geo.id}": falta la tipografía.`);
    if (fontSize === null || fontSize < 4) e.add(`Bloque de texto "${geo.id}": el cuerpo tiene que ser un número de 4 o más.`);
    if (contenido === null) e.add(`Bloque de texto "${geo.id}": falta el contenido.`);
    if (!col) e.add(`Bloque de texto "${geo.id}": el color tiene que ser un hexadecimal como #112233.`);
    if (!fontId || fontSize === null || contenido === null || !col) return null;
    const align = raw.align === "center" || raw.align === "right" ? raw.align : "left";
    const maxLines = numeroFinito(raw.maxLines);
    return {
      ...geo,
      ...chrome,
      type: "text",
      fontId,
      fontSize,
      fontWeight: raw.fontWeight === "bold" ? "bold" : "normal",
      fontStyle: raw.fontStyle === "italic" ? "italic" : "normal",
      color: col,
      align,
      content: contenido,
      ...(maxLines !== null && maxLines > 0 ? { maxLines: Math.floor(maxLines) } : {}),
    };
  }

  if (tipo === "qrcode") {
    const variableKey = texto(raw.variableKey);
    const quiet = numeroFinito(raw.quietZoneModules);
    const ec = raw.errorCorrection;
    const ecOk = ec === "L" || ec === "M" || ec === "Q" || ec === "H";
    if (!variableKey) e.add(`Bloque QR "${geo.id}": falta la variable que trae el contenido.`);
    if (!ecOk) e.add(`Bloque QR "${geo.id}": el nivel de corrección tiene que ser L, M, Q o H.`);
    if (quiet === null || quiet < 0) e.add(`Bloque QR "${geo.id}": la zona de silencio tiene que ser un número de 0 o más.`);
    if (!variableKey || !ecOk || quiet === null || quiet < 0) return null;
    const dark = color(raw.darkColor);
    const light = color(raw.lightColor);
    return {
      ...geo,
      ...chrome,
      type: "qrcode",
      variableKey,
      errorCorrection: ec,
      quietZoneModules: Math.floor(quiet),
      ...(dark ? { darkColor: dark } : {}),
      ...(light ? { lightColor: light } : {}),
    };
  }

  if (tipo === "image") {
    const resourceRef = texto(raw.resourceRef);
    const variableKey = texto(raw.variableKey);
    if (!resourceRef === !variableKey) {
      e.add(`Bloque de imagen "${geo.id}": tiene que declarar un recurso o una variable, y solo una de las dos.`);
      return null;
    }
    return {
      ...geo,
      ...chrome,
      type: "image",
      ...(resourceRef ? { resourceRef } : {}),
      ...(variableKey ? { variableKey } : {}),
      fit: raw.fit === "contain" ? "contain" : "cover",
    };
  }

  if (tipo === "line") {
    const strokeColor = color(raw.strokeColor);
    const strokeWidth = numeroFinito(raw.strokeWidth);
    if (!strokeColor) e.add(`Bloque de línea "${geo.id}": el color tiene que ser un hexadecimal como #112233.`);
    if (strokeWidth === null || strokeWidth <= 0) e.add(`Bloque de línea "${geo.id}": el grosor tiene que ser mayor que cero.`);
    if (!strokeColor || strokeWidth === null || strokeWidth <= 0) return null;
    return { ...geo, ...chrome, type: "line", strokeColor, strokeWidth };
  }

  const fillColor = color(raw.fillColor);
  const strokeColor = color(raw.strokeColor);
  const strokeWidth = numeroFinito(raw.strokeWidth);
  const cornerRadius = numeroFinito(raw.cornerRadius);
  if (!fillColor && !strokeColor) {
    e.add(`Bloque de rectángulo "${geo.id}": tiene que declarar relleno o borde.`);
    return null;
  }
  return {
    ...geo,
    ...chrome,
    type: "rect",
    ...(fillColor ? { fillColor } : {}),
    ...(strokeColor ? { strokeColor } : {}),
    ...(strokeColor && strokeWidth !== null && strokeWidth > 0 ? { strokeWidth } : {}),
    ...(cornerRadius !== null && cornerRadius > 0 ? { cornerRadius } : {}),
  };
}

function leerFormato(raw: unknown, e: Errores): DesignFormat | null {
  if (!esObjeto(raw)) {
    e.add("El documento no declara un formato.");
    return null;
  }
  const medium = raw.medium === "PRINT" || raw.medium === "SCREEN" ? raw.medium : null;
  const width = numeroFinito(raw.width);
  const height = numeroFinito(raw.height);
  if (!medium) e.add("El formato tiene que declarar el medio: PRINT o SCREEN.");
  if (width === null || width <= 0) e.add("El formato tiene que declarar un ancho mayor que cero.");
  if (height === null || height <= 0) e.add("El formato tiene que declarar un alto mayor que cero.");
  if (!medium || width === null || height === null || width <= 0 || height <= 0) return null;

  if (medium === "SCREEN") {
    return { medium, width, height };
  }

  const dpi = numeroFinito(raw.dpi);
  if (dpi === null || dpi < 72) {
    e.add("Un formato de impresión tiene que declarar los puntos por pulgada (72 o más).");
    return null;
  }
  const bleedMm = numeroFinito(raw.bleedMm);
  const safeAreaMm = numeroFinito(raw.safeAreaMm);
  return {
    medium,
    width,
    height,
    dpi,
    ...(bleedMm !== null && bleedMm >= 0 ? { bleedMm } : {}),
    ...(safeAreaMm !== null && safeAreaMm >= 0 ? { safeAreaMm } : {}),
  };
}

function leerCara(raw: unknown, indice: number, e: Errores): DesignSide | null {
  if (!esObjeto(raw)) {
    e.add(`La cara ${indice + 1} no es un objeto.`);
    return null;
  }
  const id = texto(raw.id);
  const name = texto(raw.name);
  const background = color(raw.background);
  if (!id) e.add(`La cara ${indice + 1} no tiene identificador.`);
  if (!name) e.add(`La cara ${indice + 1} no tiene nombre.`);
  if (!background) e.add(`La cara ${indice + 1} tiene que declarar un fondo hexadecimal como #ffffff.`);
  if (!Array.isArray(raw.blocks)) {
    e.add(`La cara ${indice + 1} no tiene una lista de bloques.`);
    return null;
  }
  if (!id || !name || !background) return null;

  const blocks: DesignBlock[] = [];
  const vistos = new Set<string>();
  raw.blocks.forEach((b, i) => {
    const bloque = leerBloque(b, `Cara "${name}", bloque ${i + 1}`, e);
    if (!bloque) return;
    if (vistos.has(bloque.id)) {
      e.add(`Cara "${name}": el identificador de bloque "${bloque.id}" está repetido.`);
      return;
    }
    vistos.add(bloque.id);
    blocks.push(bloque);
  });

  return { id, name, background, blocks };
}

/**
 * Lee un documento y lo rechaza con motivo si no lo entiende. Nunca devuelve una plantilla
 * por defecto: emitir un diseño que no es el que la persona hizo es peor que no emitir.
 */
export function parseDesignDocument(raw: unknown): Result<DesignDocument> {
  if (!esObjeto(raw)) {
    return fail("Esto no es un documento de diseño.");
  }
  const e = new Errores();

  const schemaVersion = numeroFinito(raw.schemaVersion);
  if (schemaVersion === null) {
    return fail("El documento no declara su versión de esquema.");
  }
  if (schemaVersion !== DESIGN_SCHEMA_VERSION) {
    return fail(
      `El documento usa la versión de esquema ${schemaVersion} y este renderizador entiende la ${DESIGN_SCHEMA_VERSION}. Migralo antes de leerlo.`,
    );
  }

  const metadata = esObjeto(raw.metadata) ? raw.metadata : null;
  const nombre = metadata ? texto(metadata.name) : null;
  if (!nombre) e.add("El documento tiene que tener un nombre.");
  const descripcion = metadata ? texto(metadata.description) : null;

  const format = leerFormato(raw.format, e);

  if (!Array.isArray(raw.sides) || raw.sides.length === 0) {
    e.add("El documento tiene que tener al menos una cara.");
    return fail(...e.list);
  }

  const sides: DesignSide[] = [];
  const idsVistos = new Set<string>();
  raw.sides.forEach((s, i) => {
    const cara = leerCara(s, i, e);
    if (!cara) return;
    if (idsVistos.has(cara.id)) {
      e.add(`El identificador de cara "${cara.id}" está repetido.`);
      return;
    }
    idsVistos.add(cara.id);
    sides.push(cara);
  });

  if (e.list.length > 0 || !format || !nombre) {
    return fail(...(e.list.length > 0 ? e.list : ["El documento no se pudo leer."]));
  }

  return ok({
    schemaVersion: DESIGN_SCHEMA_VERSION,
    metadata: { name: nombre, ...(descripcion ? { description: descripcion } : {}) },
    format,
    sides,
  });
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 11 tests.

- [ ] **Step 6: Verificar los tipos**

Run: `pnpm --filter @repo/design-studio check-types`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add packages/design-studio/src
git commit -m "feat(design-studio): documento neutral con lectura estricta y rechazo explicito"
```

---

### Task 3: Migraciones de esquema y documento histórico de regresión

Sin esto, la primera vez que el esquema cambie, todas las plantillas guardadas dejan de abrirse.
La maquinaria se construye ahora, cuando no hay ninguna migración todavía y por lo tanto es
barata; y el fixture congelado es lo que va a avisar el día que una actualización del editor
rompa una plantilla vieja.

**Files:**
- Create: `packages/design-studio/src/document/migrate.ts`
- Create: `packages/design-studio/src/document/__fixtures__/carnet-v1.json`
- Test: `packages/design-studio/src/document/document.test.ts` (agregar casos)

**Interfaces:**
- Consumes: `parseDesignDocument`, `DESIGN_SCHEMA_VERSION`, `Result`.
- Produces: `type DocumentMigration = (doc: Record<string, unknown>) => Record<string, unknown>`,
  `DOCUMENT_MIGRATIONS: Record<number, DocumentMigration>`,
  `migrateDesignDocument(raw, migrations?): Result<Record<string, unknown>>`,
  `readDesignDocument(raw, migrations?): Result<DesignDocument>` ← **esta es la puerta pública**;
  a partir de acá nadie llama a `parseDesignDocument` directamente.

- [ ] **Step 1: Crear el fixture histórico**

`packages/design-studio/src/document/__fixtures__/carnet-v1.json` — un carnet real de dos caras
en esquema 1. **Este archivo no se edita nunca**: su valor es ser viejo.

```json
{
  "schemaVersion": 1,
  "metadata": { "name": "Carnet SFPR", "description": "Fixture congelado de regresión" },
  "format": { "medium": "PRINT", "width": 85.6, "height": 54, "dpi": 300, "bleedMm": 3, "safeAreaMm": 3 },
  "sides": [
    {
      "id": "frente",
      "name": "Frente",
      "background": "#ffffff",
      "blocks": [
        { "id": "fondo", "type": "rect", "x": 0, "y": 0, "width": 85.6, "height": 14, "fillColor": "#0f3d3d" },
        { "id": "institucion", "type": "text", "x": 6, "y": 4, "width": 60, "height": 6, "fontId": "cinzel", "fontSize": 9, "fontWeight": "bold", "color": "#ffffff", "align": "left", "content": "Sociedad de Fotógrafos" },
        { "id": "nombre", "type": "text", "x": 6, "y": 22, "width": 52, "height": 7, "fontId": "dmSans", "fontSize": 11, "fontWeight": "bold", "color": "#111111", "align": "left", "content": "{{fullName}}", "maxLines": 2 },
        { "id": "numero", "type": "text", "x": 6, "y": 32, "width": 52, "height": 5, "fontId": "dmSans", "fontSize": 8, "color": "#555555", "align": "left", "content": "Socio N° {{memberNumber}}" },
        { "id": "categoria", "type": "text", "x": 6, "y": 39, "width": 52, "height": 5, "fontId": "dmSans", "fontSize": 8, "color": "#555555", "align": "left", "content": "{{category}}" },
        { "id": "foto", "type": "image", "x": 62, "y": 20, "width": 18, "height": 24, "variableKey": "photo", "fit": "cover" }
      ]
    },
    {
      "id": "dorso",
      "name": "Dorso",
      "background": "#ffffff",
      "blocks": [
        { "id": "qr", "type": "qrcode", "x": 6, "y": 14, "width": 26, "height": 26, "variableKey": "verificationUrl", "errorCorrection": "M", "quietZoneModules": 4 },
        { "id": "leyenda", "type": "text", "x": 36, "y": 16, "width": 44, "height": 16, "fontId": "dmSans", "fontSize": 7, "color": "#333333", "align": "left", "content": "Escaneá este código para ver el estado del socio." },
        { "id": "vigencia", "type": "text", "x": 36, "y": 36, "width": 44, "height": 5, "fontId": "dmSans", "fontSize": 7, "color": "#555555", "align": "left", "content": "Vigente hasta {{validUntil}}" },
        { "id": "linea", "type": "line", "x": 6, "y": 46, "width": 74, "height": 0.3, "strokeColor": "#0f3d3d", "strokeWidth": 0.3 }
      ]
    }
  ]
}
```

- [ ] **Step 2: Escribir los tests que fallan**

Agregar a `packages/design-studio/src/document/document.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { migrateDesignDocument, readDesignDocument, type DocumentMigration } from "./migrate";

const fixtureV1 = JSON.parse(
  readFileSync(fileURLToPath(new URL("./__fixtures__/carnet-v1.json", import.meta.url)), "utf8"),
) as unknown;

test("el documento historico congelado sigue leyendose", () => {
  const r = readDesignDocument(fixtureV1);
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.value.sides.length, 2);
  assert.equal(r.value.sides[0]?.blocks.length, 6);
  assert.equal(r.value.sides[1]?.blocks.length, 4);
});

test("encadena migraciones sucesivas hasta la version actual", () => {
  const migraciones: Record<number, DocumentMigration> = {
    // 0 → 1: la cara única pasa a ser un arreglo de caras
    0: (doc) => ({
      schemaVersion: 1,
      metadata: doc.metadata,
      format: doc.format,
      sides: [{ id: "unica", name: "Única", background: "#ffffff", blocks: doc.blocks }],
    }),
  };
  const viejo = {
    schemaVersion: 0,
    metadata: { name: "Viejo" },
    format: { medium: "SCREEN", width: 1080, height: 1080 },
    blocks: [
      { id: "t", type: "text", x: 0, y: 0, width: 100, height: 20, fontId: "dmSans", fontSize: 24, color: "#000000", content: "Hola" },
    ],
  };
  const r = readDesignDocument(viejo, migraciones);
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.value.schemaVersion, 1);
  assert.equal(r.value.sides.length, 1);
});

test("rechaza un documento de una version futura sin intentar interpretarlo", () => {
  const futuro = { schemaVersion: 99, metadata: { name: "Futuro" }, format: {}, sides: [] };
  const r = readDesignDocument(futuro);
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /más nueva|mas nueva|99/);
});

test("rechaza una version vieja para la que no hay migracion escrita", () => {
  const huerfano = { schemaVersion: 0, metadata: { name: "Huérfano" }, format: {}, sides: [] };
  const r = migrateDesignDocument(huerfano, {});
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /0/);
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './migrate'`

- [ ] **Step 4: Implementar `document/migrate.ts`**

```ts
import { fail, ok, type Result } from "../result";
import { parseDesignDocument } from "./parse";
import { DESIGN_SCHEMA_VERSION, type DesignDocument } from "./schema";

/** Lleva un documento de la versión N a la N+1. */
export type DocumentMigration = (doc: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registro de migraciones, indexado por la versión de origen.
 * Está vacío porque hoy la única versión es la 1. La maquinaria existe igual: escribirla
 * cuando ya haya plantillas guardadas es mucho más caro.
 */
export const DOCUMENT_MIGRATIONS: Record<number, DocumentMigration> = {};

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Sube un documento hasta la versión actual del esquema aplicando migraciones sucesivas.
 * Nunca adivina: si falta una migración o el documento viene del futuro, falla con el motivo.
 */
export function migrateDesignDocument(
  raw: unknown,
  migrations: Record<number, DocumentMigration> = DOCUMENT_MIGRATIONS,
): Result<Record<string, unknown>> {
  if (!esObjeto(raw)) return fail("Esto no es un documento de diseño.");

  const declarada = raw.schemaVersion;
  if (typeof declarada !== "number" || !Number.isInteger(declarada)) {
    return fail("El documento no declara su versión de esquema.");
  }
  if (declarada > DESIGN_SCHEMA_VERSION) {
    return fail(
      `El documento fue creado con una versión más nueva del editor (esquema ${declarada}; este entiende hasta el ${DESIGN_SCHEMA_VERSION}). Actualizá la aplicación para abrirlo.`,
    );
  }

  let actual: Record<string, unknown> = raw;
  let version = declarada;
  /** Tope defensivo: una migración mal escrita no puede colgar el proceso. */
  let vueltas = 0;

  while (version < DESIGN_SCHEMA_VERSION) {
    if (vueltas++ > 100) {
      return fail("Las migraciones del documento no terminan. Es un error del propio módulo.");
    }
    const migracion = migrations[version];
    if (!migracion) {
      return fail(
        `No hay forma de actualizar un documento de esquema ${version} al ${DESIGN_SCHEMA_VERSION}. Falta escribir esa migración.`,
      );
    }
    const siguiente = migracion(actual);
    const nuevaVersion = siguiente.schemaVersion;
    if (typeof nuevaVersion !== "number" || nuevaVersion <= version) {
      return fail(
        `La migración de esquema ${version} no avanzó la versión del documento. Es un error del propio módulo.`,
      );
    }
    actual = siguiente;
    version = nuevaVersion;
  }

  return ok(actual);
}

/**
 * Puerta pública de lectura: migra y después valida. Todo el módulo entra por acá.
 */
export function readDesignDocument(
  raw: unknown,
  migrations: Record<number, DocumentMigration> = DOCUMENT_MIGRATIONS,
): Result<DesignDocument> {
  const migrado = migrateDesignDocument(raw, migrations);
  if (!migrado.ok) return migrado;
  return parseDesignDocument(migrado.value);
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 15 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/design-studio/src
git commit -m "feat(design-studio): migraciones de esquema y documento historico de regresion"
```

---

### Task 4: Contrato de variables y su resolución

Esta es la tarea que corrige el problema que hoy está en producción. En
`apps/fotorank/app/lib/fotorank/diplomas/mergeFields.ts:6` el motor de diplomas hace
`vars[key] ?? ""`: una variable ausente se convierte en silencio en una cadena vacía y el
diploma se emite con el nombre en blanco. Acá, una variable requerida ausente **detiene la
emisión y dice cuál falta**.

**Files:**
- Create: `packages/design-studio/src/variables/contract.ts`
- Create: `packages/design-studio/src/variables/dates.ts`
- Create: `packages/design-studio/src/variables/resolve.ts`
- Test: `packages/design-studio/src/variables/variables.test.ts`

**Interfaces:**
- Consumes: `Result`, `ok`, `fail`.
- Produces: `VariableType`, `DateFormatId`, `VariableDeclaration`, `VariableContract`,
  `VariableValues`, `ResolvedVariables`, `resolveVariables(contract, values): Result<ResolvedVariables>`,
  `formatDateUtc(date, formato): string`, `interpolate(plantilla, resueltas): string`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/design-studio/src/variables/variables.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDateUtc } from "./dates";
import { interpolate, resolveVariables } from "./resolve";
import type { VariableContract } from "./contract";

const contrato: VariableContract = {
  variables: [
    { key: "fullName", type: "text", label: "Nombre completo", required: true, sampleValue: "Daniel Cuart", maxLength: 40 },
    { key: "memberNumber", type: "number", label: "Número de socio", required: true, sampleValue: "128", decimals: 0 },
    { key: "validUntil", type: "date", label: "Vigente hasta", required: true, sampleValue: "2028-08-26", dateFormat: "es-AR-short" },
    { key: "verificationUrl", type: "qrPayload", label: "Enlace de verificación", required: true, sampleValue: "https://fotoffice.com/c/AB12CD34" },
    { key: "category", type: "text", label: "Categoría", required: false, sampleValue: "Activo" },
  ],
};

test("resuelve todas las variables presentes", () => {
  const r = resolveVariables(contrato, {
    fullName: "Daniel Cuart",
    memberNumber: 128,
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
    category: "Activo",
  });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.value.values.fullName, "Daniel Cuart");
  assert.equal(r.value.values.memberNumber, "128");
  assert.equal(r.value.values.validUntil, "26/08/2028");
  assert.equal(r.value.omitted.length, 0);
});

test("una variable requerida ausente hace fallar y dice cual es", () => {
  const r = resolveVariables(contrato, {
    memberNumber: 128,
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /Nombre completo/);
  assert.match(r.errors.join(" "), /fullName/);
});

test("una cadena vacia cuenta como ausente, no como valor", () => {
  const r = resolveVariables(contrato, {
    fullName: "   ",
    memberNumber: 128,
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
  });
  assert.equal(r.ok, false);
});

test("una variable opcional ausente queda vacia y registrada", () => {
  const r = resolveVariables(contrato, {
    fullName: "Daniel Cuart",
    memberNumber: 128,
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.values.category, "");
  assert.deepEqual(r.value.omitted, ["category"]);
});

test("rechaza un numero que no es un numero", () => {
  const r = resolveVariables(contrato, {
    fullName: "Daniel Cuart",
    memberNumber: "ciento veintiocho",
    validUntil: new Date(Date.UTC(2028, 7, 26)),
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /Número de socio/);
});

test("rechaza una fecha invalida", () => {
  const r = resolveVariables(contrato, {
    fullName: "Daniel Cuart",
    memberNumber: 128,
    validUntil: "no soy una fecha",
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
  });
  assert.equal(r.ok, false);
});

test("los formatos de fecha son deterministas y en UTC", () => {
  const d = new Date(Date.UTC(2028, 0, 5));
  assert.equal(formatDateUtc(d, "es-AR-short"), "05/01/2028");
  assert.equal(formatDateUtc(d, "es-AR-long"), "5 de enero de 2028");
  assert.equal(formatDateUtc(d, "iso"), "2028-01-05");
});

test("una fecha cerca de medianoche no se corre de dia por la zona horaria", () => {
  const d = new Date("2028-01-05T00:30:00.000Z");
  assert.equal(formatDateUtc(d, "iso"), "2028-01-05");
});

test("interpola marcadores y deja el texto fijo intacto", () => {
  const resueltas = { fullName: "Daniel Cuart", memberNumber: "128" };
  assert.equal(interpolate("Socio N° {{memberNumber}} — {{fullName}}", resueltas), "Socio N° 128 — Daniel Cuart");
});

test("interpolar un marcador no declarado es un error, no una cadena vacia", () => {
  assert.throws(() => interpolate("Hola {{noExiste}}", { fullName: "Daniel" }), /noExiste/);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './dates'`

- [ ] **Step 3: Implementar `variables/contract.ts`**

```ts
/**
 * El contrato lo declara el producto (el carnet, el diploma), no la plantilla. La plantilla
 * usa los marcadores; el contrato dice qué significa cada uno y qué pasa si falta.
 */

export type VariableType = "text" | "number" | "date" | "image" | "url" | "qrPayload";

export type DateFormatId = "es-AR-short" | "es-AR-long" | "iso";

export type VariableDeclaration = {
  key: string;
  type: VariableType;
  /** Cómo se llama para una persona. Aparece en los mensajes de error y en el editor. */
  label: string;
  required: boolean;
  /**
   * Obligatorio: es lo que el editor muestra mientras se diseña, y contra esto se valida
   * el largo al publicar.
   */
  sampleValue: string;
  /** Solo `text`. Se controla al publicar, no al emitir. */
  maxLength?: number;
  /** Solo `date`. Sin esto no se sabe cómo escribirla. */
  dateFormat?: DateFormatId;
  /** Solo `number`. Cantidad de decimales. */
  decimals?: number;
};

export type VariableContract = {
  variables: VariableDeclaration[];
};

/** Lo que entrega el producto en cada emisión. */
export type VariableValues = Record<string, string | number | Date | null | undefined>;

export type ResolvedVariables = {
  /** Ya convertidas a texto, listas para interpolar. */
  values: Record<string, string>;
  /** Opcionales que no vinieron. Se registran en la emisión. */
  omitted: string[];
};

export function findDeclaration(
  contract: VariableContract,
  key: string,
): VariableDeclaration | undefined {
  return contract.variables.find((v) => v.key === key);
}
```

- [ ] **Step 4: Implementar `variables/dates.ts`**

```ts
import type { DateFormatId } from "./contract";

/**
 * Formateo propio a partir de componentes UTC.
 *
 * No se usa `toLocaleDateString` ni `Intl`: el resultado dependería de la zona horaria y de
 * los datos de localización del servidor que corra el render. Una pieza emitida hoy en Vercel
 * y reproducida mañana en otra máquina tiene que dar el mismo archivo.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

function dosDigitos(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

export function formatDateUtc(date: Date, formato: DateFormatId): string {
  const dia = date.getUTCDate();
  const mes = date.getUTCMonth();
  const anio = date.getUTCFullYear();

  if (formato === "iso") {
    return `${anio}-${dosDigitos(mes + 1)}-${dosDigitos(dia)}`;
  }
  if (formato === "es-AR-long") {
    return `${dia} de ${MESES[mes] ?? ""} de ${anio}`;
  }
  return `${dosDigitos(dia)}/${dosDigitos(mes + 1)}/${anio}`;
}

/**
 * Acepta un Date o una fecha en texto. Para el texto solo se admite `AAAA-MM-DD` o un ISO
 * completo: cualquier otro formato es ambiguo (03/04 puede ser marzo o abril) y se rechaza.
 */
export function parseDateUtc(valor: string | Date): Date | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor;
  }
  const texto = valor.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(texto)) {
    const d = new Date(`${texto}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}T/.test(texto)) {
    const d = new Date(texto);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}
```

- [ ] **Step 5: Implementar `variables/resolve.ts`**

```ts
import { fail, ok, type Result } from "../result";
import { formatDateUtc, parseDateUtc } from "./dates";
import type { ResolvedVariables, VariableContract, VariableDeclaration, VariableValues } from "./contract";

const MARCADOR = /\{\{\s*([A-Za-z_][\w]*)\s*\}\}/g;

function ausente(valor: unknown): boolean {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") return valor.trim() === "";
  return false;
}

function convertir(
  decl: VariableDeclaration,
  valor: string | number | Date,
): { ok: true; texto: string } | { ok: false; motivo: string } {
  switch (decl.type) {
    case "number": {
      const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
      if (!Number.isFinite(n)) {
        return { ok: false, motivo: `"${decl.label}" (${decl.key}) tiene que ser un número.` };
      }
      const decimales = decl.decimals ?? 0;
      return { ok: true, texto: n.toFixed(decimales) };
    }
    case "date": {
      if (typeof valor === "number") {
        return { ok: false, motivo: `"${decl.label}" (${decl.key}) tiene que ser una fecha.` };
      }
      const d = parseDateUtc(valor);
      if (!d) {
        return {
          ok: false,
          motivo: `"${decl.label}" (${decl.key}) no es una fecha válida. Usá el formato AAAA-MM-DD.`,
        };
      }
      return { ok: true, texto: formatDateUtc(d, decl.dateFormat ?? "es-AR-short") };
    }
    case "url":
    case "qrPayload": {
      const texto = String(valor).trim();
      if (!/^https?:\/\/\S+$/.test(texto) && decl.type === "url") {
        return { ok: false, motivo: `"${decl.label}" (${decl.key}) tiene que ser un enlace que empiece con http.` };
      }
      return { ok: true, texto };
    }
    case "image":
    case "text":
    default:
      return { ok: true, texto: String(valor) };
  }
}

/**
 * Convierte los valores del producto en texto listo para dibujar.
 *
 * `maxLength` NO se controla acá: la spec lo pone en la validación de publicación, contra el
 * valor de ejemplo. Frenar una emisión real porque un apellido es largo sería peor que
 * dejarla salir; frenar la publicación de una plantilla que no da el ancho es correcto.
 */
export function resolveVariables(
  contract: VariableContract,
  values: VariableValues,
): Result<ResolvedVariables> {
  const errores: string[] = [];
  const resueltas: Record<string, string> = {};
  const omitidas: string[] = [];

  for (const decl of contract.variables) {
    const bruto = values[decl.key];
    if (ausente(bruto)) {
      if (decl.required) {
        errores.push(
          `Falta un dato obligatorio: "${decl.label}" (${decl.key}). No se emite la pieza con ese campo vacío.`,
        );
      } else {
        resueltas[decl.key] = "";
        omitidas.push(decl.key);
      }
      continue;
    }
    const convertido = convertir(decl, bruto as string | number | Date);
    if (!convertido.ok) {
      errores.push(convertido.motivo);
      continue;
    }
    resueltas[decl.key] = convertido.texto;
  }

  if (errores.length > 0) return fail(...errores);
  return ok({ values: resueltas, omitted: omitidas });
}

/**
 * Reemplaza los marcadores `{{clave}}`. Un marcador sin declarar es un error del diseño, no
 * un hueco que se rellena con nada: por eso lanza en vez de devolver cadena vacía.
 */
export function interpolate(plantilla: string, resueltas: Record<string, string>): string {
  return plantilla.replace(MARCADOR, (_todo, clave: string) => {
    const valor = resueltas[clave];
    if (valor === undefined) {
      throw new Error(
        `El diseño usa la variable "${clave}" pero el contrato no la declara. Revisá la plantilla.`,
      );
    }
    return valor;
  });
}

/** Marcadores que aparecen en un texto. Lo usa la validación de publicación. */
export function placeholdersOf(plantilla: string): string[] {
  const encontrados = new Set<string>();
  for (const m of plantilla.matchAll(MARCADOR)) {
    const clave = m[1];
    if (clave) encontrados.add(clave);
  }
  return [...encontrados];
}
```

- [ ] **Step 6: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 25 tests.

- [ ] **Step 7: Commit**

```bash
git add packages/design-studio/src
git commit -m "feat(design-studio): contrato de variables que falla ante un dato obligatorio ausente"
```

---

### Task 5: Catálogo controlado de fuentes

Reproducir un diseño exige controlar de qué depende. Un catálogo cerrado evita los problemas
de licencia, de seguridad y de reproducción que traería dejar subir cualquier tipografía.

Los identificadores son **los mismos que usa fotorank** (`dmSans`, `inter`, `playfairDisplay`,
`merriweather`, `cinzel`, `greatVibes`). No es casualidad: cuando diplomas migre —cuarto en el
orden— la correspondencia va a ser directa en vez de una tabla de traducción.

La ruta a los archivos se resuelve con `createRequire`, no con
`path.join(process.cwd(), "node_modules", …)` como hace hoy fotorank: con pnpm los paquetes
están enlazados y `process.cwd()` es el de la aplicación, no el del paquete.

**Files:**
- Create: `packages/design-studio/src/fonts/catalog.ts`
- Create: `packages/design-studio/src/fonts/load.ts`
- Test: `packages/design-studio/src/fonts/fonts.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `FONT_IDS`, `FontId`, `FontSlot` (`"normal" | "bold" | "italic" | "boldItalic"`),
  `FONT_CATALOG: Record<FontId, FontDefinition>`, `isFontId(v: unknown): v is FontId`,
  `slotFor(weight, style): FontSlot`, `readFontBytes(id, slot): Promise<Uint8Array>`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/design-studio/src/fonts/fonts.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { FONT_CATALOG, FONT_IDS, isFontId, slotFor } from "./catalog";
import { readFontBytes } from "./load";

test("el catalogo declara los cuatro archivos de cada fuente", () => {
  for (const id of FONT_IDS) {
    const def = FONT_CATALOG[id];
    assert.ok(def, `falta la definición de ${id}`);
    for (const slot of ["normal", "bold", "italic", "boldItalic"] as const) {
      assert.ok(def.files[slot].endsWith(".woff"), `${id}.${slot} no apunta a un .woff`);
    }
    assert.ok(def.fallbackStack.length > 0, `${id} no declara alternativa`);
  }
});

test("reconoce un identificador del catalogo y rechaza uno de afuera", () => {
  assert.equal(isFontId("dmSans"), true);
  assert.equal(isFontId("comicSans"), false);
  assert.equal(isFontId(42), false);
});

test("elige la variante segun peso y estilo", () => {
  assert.equal(slotFor("normal", "normal"), "normal");
  assert.equal(slotFor("bold", "normal"), "bold");
  assert.equal(slotFor("normal", "italic"), "italic");
  assert.equal(slotFor("bold", "italic"), "boldItalic");
});

test("lee los bytes reales de cada archivo del catalogo", async () => {
  for (const id of FONT_IDS) {
    const bytes = await readFontBytes(id, "normal");
    assert.ok(bytes.byteLength > 1000, `${id} devolvió ${bytes.byteLength} bytes`);
    // Cabecera de un archivo WOFF: los cuatro primeros bytes son "wOFF".
    assert.equal(String.fromCharCode(...bytes.slice(0, 4)), "wOFF", `${id} no parece un WOFF`);
  }
});

test("una fuente fuera del catalogo falla con un mensaje entendible", async () => {
  await assert.rejects(
    () => readFontBytes("comicSans" as never, "normal"),
    /comicSans/,
  );
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './catalog'`

- [ ] **Step 3: Implementar `fonts/catalog.ts`**

```ts
/**
 * Catálogo cerrado de tipografías.
 *
 * Los identificadores coinciden con los de fotorank para que la migración de diplomas sea
 * una correspondencia directa y no una tabla de traducción.
 *
 * Las fuentes de un solo peso reutilizan el archivo de 400 en todas las variantes: es lo que
 * hay, y es preferible a un fallback silencioso a otra familia.
 */

export const FONT_IDS = [
  "dmSans",
  "inter",
  "playfairDisplay",
  "merriweather",
  "cinzel",
  "greatVibes",
] as const;

export type FontId = (typeof FONT_IDS)[number];

export type FontSlot = "normal" | "bold" | "italic" | "boldItalic";

export type FontDefinition = {
  /** Nombre para la persona que diseña. */
  label: string;
  /** Familia CSS, para la vista de pantalla. */
  cssFamily: string;
  /** Alternativa declarada si la familia no carga en el navegador. */
  fallbackStack: string;
  /** Paquete de npm que trae los binarios. */
  pkg: string;
  files: Record<FontSlot, string>;
};

export const FONT_CATALOG: Record<FontId, FontDefinition> = {
  dmSans: {
    label: "DM Sans",
    cssFamily: "DM Sans",
    fallbackStack: "'DM Sans', 'Helvetica Neue', Arial, sans-serif",
    pkg: "@fontsource/dm-sans",
    files: {
      normal: "dm-sans-latin-400-normal.woff",
      bold: "dm-sans-latin-700-normal.woff",
      italic: "dm-sans-latin-400-italic.woff",
      boldItalic: "dm-sans-latin-700-italic.woff",
    },
  },
  inter: {
    label: "Inter",
    cssFamily: "Inter",
    fallbackStack: "Inter, 'Helvetica Neue', Arial, sans-serif",
    pkg: "@fontsource/inter",
    files: {
      normal: "inter-latin-400-normal.woff",
      bold: "inter-latin-700-normal.woff",
      italic: "inter-latin-400-italic.woff",
      boldItalic: "inter-latin-700-italic.woff",
    },
  },
  playfairDisplay: {
    label: "Playfair Display",
    cssFamily: "Playfair Display",
    fallbackStack: "'Playfair Display', Georgia, 'Times New Roman', serif",
    pkg: "@fontsource/playfair-display",
    files: {
      normal: "playfair-display-latin-400-normal.woff",
      bold: "playfair-display-latin-700-normal.woff",
      italic: "playfair-display-latin-400-italic.woff",
      boldItalic: "playfair-display-latin-700-italic.woff",
    },
  },
  merriweather: {
    label: "Merriweather",
    cssFamily: "Merriweather",
    fallbackStack: "Merriweather, Georgia, 'Times New Roman', serif",
    pkg: "@fontsource/merriweather",
    files: {
      normal: "merriweather-latin-400-normal.woff",
      bold: "merriweather-latin-700-normal.woff",
      italic: "merriweather-latin-400-italic.woff",
      boldItalic: "merriweather-latin-700-italic.woff",
    },
  },
  cinzel: {
    label: "Cinzel",
    cssFamily: "Cinzel",
    fallbackStack: "Cinzel, Georgia, 'Times New Roman', serif",
    pkg: "@fontsource/cinzel",
    files: {
      // Cinzel no trae cursiva: la variante reutiliza el archivo recto a propósito.
      normal: "cinzel-latin-400-normal.woff",
      bold: "cinzel-latin-700-normal.woff",
      italic: "cinzel-latin-400-normal.woff",
      boldItalic: "cinzel-latin-700-normal.woff",
    },
  },
  greatVibes: {
    label: "Great Vibes",
    cssFamily: "Great Vibes",
    fallbackStack: "'Great Vibes', 'Brush Script MT', cursive",
    pkg: "@fontsource/great-vibes",
    files: {
      // Un solo peso disponible: las cuatro variantes son el mismo archivo.
      normal: "great-vibes-latin-400-normal.woff",
      bold: "great-vibes-latin-400-normal.woff",
      italic: "great-vibes-latin-400-normal.woff",
      boldItalic: "great-vibes-latin-400-normal.woff",
    },
  },
};

export function isFontId(v: unknown): v is FontId {
  return typeof v === "string" && (FONT_IDS as readonly string[]).includes(v);
}

export function slotFor(
  weight: "normal" | "bold" | undefined,
  style: "normal" | "italic" | undefined,
): FontSlot {
  const negrita = weight === "bold";
  const cursiva = style === "italic";
  if (negrita && cursiva) return "boldItalic";
  if (negrita) return "bold";
  if (cursiva) return "italic";
  return "normal";
}
```

- [ ] **Step 4: Implementar `fonts/load.ts`**

```ts
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { FONT_CATALOG, isFontId, type FontId, type FontSlot } from "./catalog";

/**
 * Resolución por `createRequire` y no por `process.cwd()`: con pnpm los paquetes están
 * enlazados y el directorio de trabajo es el de la aplicación, no el de este paquete.
 */
const require = createRequire(import.meta.url);

const cache = new Map<string, Uint8Array>();

/** Solo servidor. Lee el WOFF que empaqueta @fontsource. */
export async function readFontBytes(id: FontId, slot: FontSlot): Promise<Uint8Array> {
  if (!isFontId(id)) {
    throw new Error(`La tipografía "${String(id)}" no está en el catálogo del módulo de diseño.`);
  }
  const clave = `${id}:${slot}`;
  const enCache = cache.get(clave);
  if (enCache) return enCache;

  const def = FONT_CATALOG[id];
  const archivo = def.files[slot];
  let ruta: string;
  try {
    ruta = require.resolve(`${def.pkg}/files/${archivo}`);
  } catch {
    throw new Error(
      `No se encontró el archivo de la tipografía ${def.label} (${def.pkg}/files/${archivo}). Falta instalar la dependencia.`,
    );
  }
  const bytes = new Uint8Array(await readFile(ruta));
  cache.set(clave, bytes);
  return bytes;
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 30 tests. Si el último falla con "no se encontró el archivo", correr
`pnpm install` de nuevo: significa que las dependencias de `@fontsource` no quedaron enlazadas.

- [ ] **Step 6: Commit**

```bash
git add packages/design-studio/src
git commit -m "feat(design-studio): catalogo controlado de tipografias"
```

---

### Task 6: Maquetado — del documento a cajas absolutas

Esta capa es la que hace que la pantalla y la impresión no se separen: **las dos salidas
dibujan el mismo `LayoutPlan`**. Si el corte de líneas se calculara dos veces, un nombre largo
podría entrar en el PDF y desbordar en la vista digital.

El medidor de texto entra por un puerto (`TextMeasurer`) para que esta capa sea pura y se
pueda probar sin abrir un PDF. La implementación real llega en la Task 9.

**Files:**
- Create: `packages/design-studio/src/layout/wrap.ts`
- Create: `packages/design-studio/src/layout/plan.ts`
- Test: `packages/design-studio/src/layout/layout.test.ts`

**Interfaces:**
- Consumes: `DesignDocument`, `ResolvedVariables`, `interpolate`, `mmToPt`, `pxToPt`,
  `slotFor`, `isFontId`, `FontId`, `FontSlot`, `Result`.
- Produces: `TextMeasurer`, `wrapText(...)`, `LayoutPlan`, `LayoutPage`, `LayoutItem`,
  `LayoutTextItem`, `LayoutQrItem`, `LayoutImageItem`, `LayoutLineItem`, `LayoutRectItem`,
  `buildLayoutPlan(doc, resolved, opciones): Result<LayoutPlan>`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/design-studio/src/layout/layout.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildLayoutPlan, type TextMeasurer } from "./plan";
import { wrapText } from "./wrap";
import { readDesignDocument } from "../document/migrate";

/** Medidor de prueba: cada carácter mide 0,5 del cuerpo. Determinista y suficiente. */
const medidor: TextMeasurer = {
  widthOf: (texto, _fontId, _slot, sizePt) => texto.length * sizePt * 0.5,
};

const documento = (() => {
  const raw = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../document/__fixtures__/carnet-v1.json", import.meta.url)),
      "utf8",
    ),
  ) as unknown;
  const r = readDesignDocument(raw);
  if (!r.ok) throw new Error(r.errors.join(" | "));
  return r.value;
})();

const resueltas = {
  values: {
    fullName: "Daniel Cuart",
    memberNumber: "128",
    category: "Activo",
    validUntil: "26/08/2028",
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
    photo: "socios/128/foto.jpg",
  },
  omitted: [] as string[],
};

test("corta el texto en lineas que entran en el ancho", () => {
  const lineas = wrapText("uno dos tres cuatro", 30, (t) => t.length * 2, undefined);
  assert.ok(lineas.length > 1);
  assert.equal(lineas.join(" "), "uno dos tres cuatro");
});

test("una palabra mas ancha que la caja ocupa su propia linea sin colgarse", () => {
  const lineas = wrapText("inconmensurablemente", 10, (t) => t.length * 2, undefined);
  assert.deepEqual(lineas, ["inconmensurablemente"]);
});

test("respeta los saltos de linea escritos a mano", () => {
  const lineas = wrapText("uno\ndos", 1000, (t) => t.length, undefined);
  assert.deepEqual(lineas, ["uno", "dos"]);
});

test("produce una pagina por cara, en orden", () => {
  const r = buildLayoutPlan(documento, resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.value.pages.length, 2);
  assert.equal(r.value.pages[0]?.sideId, "frente");
  assert.equal(r.value.pages[1]?.sideId, "dorso");
});

test("convierte milimetros a puntos: 85,6 mm son 242,6 puntos", () => {
  const r = buildLayoutPlan(documento, resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(Math.round((r.value.pages[0]?.widthPt ?? 0) * 10) / 10, 242.6);
});

test("con sangrado la pagina crece y el contenido se corre", () => {
  const sin = buildLayoutPlan(documento, resueltas, { measurer: medidor, includeBleed: false });
  const con = buildLayoutPlan(documento, resueltas, { measurer: medidor, includeBleed: true });
  assert.equal(sin.ok && con.ok, true);
  if (!sin.ok || !con.ok) return;
  const anchoSin = sin.value.pages[0]?.widthPt ?? 0;
  const anchoCon = con.value.pages[0]?.widthPt ?? 0;
  // 3 mm por lado = 6 mm = 17,01 puntos
  assert.ok(Math.abs(anchoCon - anchoSin - 17.008) < 0.01, `creció ${anchoCon - anchoSin}`);
  const xSin = sin.value.pages[0]?.items[0]?.xPt ?? 0;
  const xCon = con.value.pages[0]?.items[0]?.xPt ?? 0;
  assert.ok(Math.abs(xCon - xSin - 8.504) < 0.01);
});

test("interpola las variables en el texto", () => {
  const r = buildLayoutPlan(documento, resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const nombre = r.value.pages[0]?.items.find((i) => i.id === "nombre");
  assert.ok(nombre && nombre.kind === "text");
  if (!nombre || nombre.kind !== "text") return;
  assert.equal(nombre.lines.join(" "), "Daniel Cuart");
});

test("el bloque QR toma su contenido de la variable declarada", () => {
  const r = buildLayoutPlan(documento, resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const qr = r.value.pages[1]?.items.find((i) => i.id === "qr");
  assert.ok(qr && qr.kind === "qr");
  if (!qr || qr.kind !== "qr") return;
  assert.equal(qr.payload, "https://fotoffice.com/c/AB12CD34");
});

test("marca desbordado el texto que no entra en las lineas permitidas", () => {
  const largo = { ...resueltas, values: { ...resueltas.values, fullName: "Daniel Alejandro Cuart de la Fuente y Martínez" } };
  const r = buildLayoutPlan(documento, largo, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const nombre = r.value.pages[0]?.items.find((i) => i.id === "nombre");
  assert.ok(nombre && nombre.kind === "text" && nombre.overflow === true);
});

test("omite los bloques ocultos", () => {
  const conOculto = structuredClone(documento);
  const frente = conOculto.sides[0];
  if (frente?.blocks[1]) frente.blocks[1].hidden = true;
  const r = buildLayoutPlan(conOculto, resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.value.pages[0]?.items.length, 5);
});

test("falla si un bloque usa una tipografia que no esta en el catalogo", () => {
  const roto = structuredClone(documento);
  const bloque = roto.sides[0]?.blocks[1];
  if (bloque && bloque.type === "text") bloque.fontId = "comicSans";
  const r = buildLayoutPlan(roto, resueltas, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /comicSans/);
});

test("falla si el QR apunta a una variable que no llego", () => {
  const sinQr = { ...resueltas, values: { ...resueltas.values, verificationUrl: "" } };
  const r = buildLayoutPlan(documento, sinQr, { measurer: medidor, includeBleed: false });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /verificationUrl/);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './plan'`

- [ ] **Step 3: Implementar `layout/wrap.ts`**

```ts
/**
 * Corte de líneas. Recibe la función de medida en vez de la fuente: así esta capa no depende
 * de pdf-lib y se puede probar con un medidor de mentira.
 */
export function wrapText(
  texto: string,
  anchoMax: number,
  medir: (t: string) => number,
  maxLines: number | undefined,
): string[] {
  const lineas: string[] = [];

  for (const parrafo of texto.split("\n")) {
    const palabras = parrafo.split(/\s+/).filter(Boolean);
    if (palabras.length === 0) {
      lineas.push("");
      continue;
    }
    let actual = "";
    for (const palabra of palabras) {
      const prueba = actual ? `${actual} ${palabra}` : palabra;
      // `!actual` deja pasar una palabra sola más ancha que la caja: cortarla por la mitad
      // sería peor, y el desbordamiento se informa aparte.
      if (medir(prueba) <= anchoMax || !actual) {
        actual = prueba;
      } else {
        lineas.push(actual);
        actual = palabra;
      }
    }
    if (actual) lineas.push(actual);
  }

  if (lineas.length === 0) return [""];
  if (maxLines !== undefined && lineas.length > maxLines) {
    // Se devuelven todas: quien llama decide qué hacer con el exceso. Recortar en silencio
    // sería exactamente el problema que este módulo viene a evitar.
    return lineas;
  }
  return lineas;
}
```

- [ ] **Step 4: Implementar `layout/plan.ts`**

```ts
import { fail, ok, type Result } from "../result";
import { mmToPt, pxToPt } from "../document/units";
import type { DesignDocument, DesignMedium, TextAlign } from "../document/schema";
import type { ResolvedVariables } from "../variables/contract";
import { interpolate } from "../variables/resolve";
import { isFontId, slotFor, type FontId, type FontSlot } from "../fonts/catalog";
import { wrapText } from "./wrap";

/** Puerto de medida. La implementación real usa la fuente ya incrustada en el PDF. */
export type TextMeasurer = {
  widthOf(texto: string, fontId: FontId, slot: FontSlot, sizePt: number): number;
};

type ItemBase = {
  id: string;
  xPt: number;
  yPt: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
  opacity: number;
};

export type LayoutTextItem = ItemBase & {
  kind: "text";
  fontId: FontId;
  slot: FontSlot;
  sizePt: number;
  lineHeightPt: number;
  color: string;
  align: TextAlign;
  lines: string[];
  /** El texto no entra en `maxLines` o excede el alto de la caja. */
  overflow: boolean;
};

export type LayoutQrItem = ItemBase & {
  kind: "qr";
  payload: string;
  errorCorrection: "L" | "M" | "Q" | "H";
  quietZoneModules: number;
  darkColor: string;
  lightColor: string;
};

export type LayoutImageItem = ItemBase & {
  kind: "image";
  /** Referencia que el producto resuelve a bytes. */
  ref: string;
  fit: "cover" | "contain";
};

export type LayoutLineItem = ItemBase & {
  kind: "line";
  strokeColor: string;
  strokeWidthPt: number;
};

export type LayoutRectItem = ItemBase & {
  kind: "rect";
  fillColor?: string;
  strokeColor?: string;
  strokeWidthPt?: number;
  cornerRadiusPt?: number;
};

export type LayoutItem =
  | LayoutTextItem
  | LayoutQrItem
  | LayoutImageItem
  | LayoutLineItem
  | LayoutRectItem;

export type LayoutPage = {
  sideId: string;
  name: string;
  widthPt: number;
  heightPt: number;
  /** Ya incluido en el tamaño de página si se pidió sangrado; 0 si no. */
  bleedPt: number;
  safeAreaPt: number;
  background: string;
  items: LayoutItem[];
};

export type LayoutPlan = {
  medium: DesignMedium;
  /** Puntos por pulgada declarados para PRINT; 96 para SCREEN. */
  dpi: number;
  pages: LayoutPage[];
};

export type LayoutOptions = {
  measurer: TextMeasurer;
  /** PRINT: agrandar la página con el sangrado y correr el contenido. */
  includeBleed: boolean;
};

/** Proporción de interlineado. 1,2 es el valor tipográfico habitual para texto corto. */
const LINE_HEIGHT_RATIO = 1.2;

export function buildLayoutPlan(
  doc: DesignDocument,
  resolved: ResolvedVariables,
  options: LayoutOptions,
): Result<LayoutPlan> {
  const errores: string[] = [];
  const esImpresion = doc.format.medium === "PRINT";
  const aPuntos = esImpresion ? mmToPt : pxToPt;

  const sangradoPt =
    esImpresion && options.includeBleed && doc.format.bleedMm ? mmToPt(doc.format.bleedMm) : 0;
  const areaSeguraPt = esImpresion && doc.format.safeAreaMm ? mmToPt(doc.format.safeAreaMm) : 0;

  const pages: LayoutPage[] = [];

  for (const cara of doc.sides) {
    const items: LayoutItem[] = [];

    for (const bloque of cara.blocks) {
      if (bloque.hidden) continue;

      const base: ItemBase = {
        id: bloque.id,
        xPt: aPuntos(bloque.x) + sangradoPt,
        yPt: aPuntos(bloque.y) + sangradoPt,
        widthPt: aPuntos(bloque.width),
        heightPt: aPuntos(bloque.height),
        rotation: bloque.rotation ?? 0,
        opacity: bloque.opacity ?? 1,
      };

      if (bloque.type === "text") {
        if (!isFontId(bloque.fontId)) {
          errores.push(
            `El bloque "${bloque.id}" usa la tipografía "${bloque.fontId}", que no está en el catálogo.`,
          );
          continue;
        }
        let texto: string;
        try {
          texto = interpolate(bloque.content, resolved.values);
        } catch (e) {
          errores.push(e instanceof Error ? e.message : String(e));
          continue;
        }
        const fontId = bloque.fontId;
        const slot = slotFor(bloque.fontWeight, bloque.fontStyle);
        // El cuerpo tipográfico se declara SIEMPRE en puntos, en los dos medios: nadie
        // diseña texto en milímetros, y así el mismo valor significa lo mismo en una
        // tarjeta impresa y en una placa de pantalla.
        const sizePt = bloque.fontSize;
        const lineHeightPt = sizePt * LINE_HEIGHT_RATIO;
        const lines = wrapText(
          texto,
          base.widthPt,
          (t) => options.measurer.widthOf(t, fontId, slot, sizePt),
          bloque.maxLines,
        );
        const excedeLineas = bloque.maxLines !== undefined && lines.length > bloque.maxLines;
        const excedeAlto = lines.length * lineHeightPt > base.heightPt + 0.01;
        items.push({
          ...base,
          kind: "text",
          fontId,
          slot,
          sizePt,
          lineHeightPt,
          color: bloque.color,
          align: bloque.align ?? "left",
          lines,
          overflow: excedeLineas || excedeAlto,
        });
        continue;
      }

      if (bloque.type === "qrcode") {
        const payload = resolved.values[bloque.variableKey];
        if (payload === undefined) {
          errores.push(
            `El bloque QR "${bloque.id}" usa la variable "${bloque.variableKey}", que el contrato no declara.`,
          );
          continue;
        }
        if (payload.trim() === "") {
          errores.push(
            `El bloque QR "${bloque.id}" quedaría vacío: la variable "${bloque.variableKey}" no trae contenido.`,
          );
          continue;
        }
        items.push({
          ...base,
          kind: "qr",
          payload,
          errorCorrection: bloque.errorCorrection,
          quietZoneModules: bloque.quietZoneModules,
          darkColor: bloque.darkColor ?? "#000000",
          lightColor: bloque.lightColor ?? "#ffffff",
        });
        continue;
      }

      if (bloque.type === "image") {
        let ref: string | undefined;
        if (bloque.resourceRef) {
          ref = bloque.resourceRef;
        } else if (bloque.variableKey) {
          const valor = resolved.values[bloque.variableKey];
          if (valor === undefined) {
            errores.push(
              `La imagen "${bloque.id}" usa la variable "${bloque.variableKey}", que el contrato no declara.`,
            );
            continue;
          }
          ref = valor;
        }
        if (!ref || ref.trim() === "") {
          errores.push(`La imagen "${bloque.id}" no tiene de dónde salir.`);
          continue;
        }
        items.push({ ...base, kind: "image", ref, fit: bloque.fit });
        continue;
      }

      if (bloque.type === "line") {
        items.push({
          ...base,
          kind: "line",
          strokeColor: bloque.strokeColor,
          strokeWidthPt: aPuntos(bloque.strokeWidth),
        });
        continue;
      }

      items.push({
        ...base,
        kind: "rect",
        ...(bloque.fillColor ? { fillColor: bloque.fillColor } : {}),
        ...(bloque.strokeColor ? { strokeColor: bloque.strokeColor } : {}),
        ...(bloque.strokeWidth !== undefined ? { strokeWidthPt: aPuntos(bloque.strokeWidth) } : {}),
        ...(bloque.cornerRadius !== undefined ? { cornerRadiusPt: aPuntos(bloque.cornerRadius) } : {}),
      });
    }

    pages.push({
      sideId: cara.id,
      name: cara.name,
      widthPt: aPuntos(doc.format.width) + sangradoPt * 2,
      heightPt: aPuntos(doc.format.height) + sangradoPt * 2,
      bleedPt: sangradoPt,
      safeAreaPt: areaSeguraPt,
      background: cara.background,
      items,
    });
  }

  if (errores.length > 0) return fail(...errores);
  return ok({ medium: doc.format.medium, dpi: doc.format.dpi ?? 96, pages });
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 42 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/design-studio/src
git commit -m "feat(design-studio): maquetado a cajas absolutas compartido por pantalla e impresion"
```

---

### Task 7: Legibilidad del QR

Un mínimo fijo en milímetros sería falso: la legibilidad depende de cuánta información se
codifica. Un token corto entra en un QR de 29 módulos por lado; una URL larga necesita 37, y
en el mismo cuadradito de 26 mm cada módulo pasa de 0,70 mm a 0,58 mm. El sistema lo calcula
con el contenido real.

Umbrales, con su fundamento: **0,5 mm por módulo** es el piso habitual para impresión
comercial con lectores de teléfono, y **0,65 mm** el valor por debajo del cual conviene avisar.
En pantalla, **2 píxeles** por módulo es el piso y **3** el umbral de aviso. Son constantes
con nombre para que se puedan revisar con una prueba de impresión real.

**Files:**
- Create: `packages/design-studio/src/validation/qr.ts`
- Test: `packages/design-studio/src/validation/validation.test.ts`

**Interfaces:**
- Consumes: `ptToMm`, `ptToPx` de `document/units`; `qrcode`.
- Produces: `QrLegibilityLevel` (`"OK" | "WARNING" | "BLOCKS_PUBLISH" | "INVALID"`),
  `QrLegibility`, `evaluateQrLegibility(entrada): QrLegibility`,
  `MIN_MODULE_MM`, `WARN_MODULE_MM`, `MIN_MODULE_PX`, `WARN_MODULE_PX`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/design-studio/src/validation/validation.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { mmToPt } from "../document/units";
import { evaluateQrLegibility } from "./qr";

const TOKEN_CORTO = "https://fotoffice.com/c/AB12CD34";

test("un QR de 26 mm con un token corto es legible", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "OK");
  assert.ok(r.moduleSizeMm && r.moduleSizeMm > 0.5);
});

test("el mismo QR en 8 mm bloquea la publicacion", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(8),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "BLOCKS_PUBLISH");
  assert.match(r.message, /chico|pequeñ/i);
});

test("un tamano intermedio avisa sin bloquear", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(19),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "WARNING");
});

test("mas informacion codificada empeora la legibilidad en el mismo tamano", () => {
  const corto = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  const largo = evaluateQrLegibility({
    payload: "https://fotoffice.com/carnet/verificar?socio=128&token=abcdefghijklmnopqrstuvwxyz012345&emitido=2026-08-26",
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.ok((largo.moduleSizeMm ?? 0) < (corto.moduleSizeMm ?? 0));
});

test("un contenido que no entra en ningun QR es invalido", () => {
  const r = evaluateQrLegibility({
    payload: "x".repeat(5000),
    errorCorrection: "H",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "INVALID");
});

test("un contenido vacio es invalido", () => {
  const r = evaluateQrLegibility({
    payload: "",
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: mmToPt(26),
    medium: "PRINT",
    dpi: 300,
  });
  assert.equal(r.level, "INVALID");
});

test("en pantalla la medida es en pixeles, no en milimetros", () => {
  const r = evaluateQrLegibility({
    payload: TOKEN_CORTO,
    errorCorrection: "M",
    quietZoneModules: 4,
    sidePt: 200,
    medium: "SCREEN",
    dpi: 96,
  });
  assert.equal(r.moduleSizeMm, undefined);
  assert.ok(r.moduleSizePx && r.moduleSizePx > 2);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './qr'`

- [ ] **Step 3: Implementar `validation/qr.ts`**

```ts
import QRCode from "qrcode";
import { ptToMm, ptToPx } from "../document/units";
import type { DesignMedium } from "../document/schema";

/**
 * Piso de tamaño de módulo para impresión comercial leída con teléfonos. Por debajo, la
 * lectura empieza a depender de la impresora y de la luz.
 */
export const MIN_MODULE_MM = 0.5;
/** Por debajo de esto conviene avisar aunque técnicamente entre. */
export const WARN_MODULE_MM = 0.65;
/** En pantalla el límite lo pone el píxel, no la tinta. */
export const MIN_MODULE_PX = 2;
export const WARN_MODULE_PX = 3;

export type QrLegibilityLevel = "OK" | "WARNING" | "BLOCKS_PUBLISH" | "INVALID";

export type QrLegibility = {
  level: QrLegibilityLevel;
  message: string;
  /** Versión del QR: 1 a 40. Más versión, más módulos. */
  version?: number;
  /** Módulos por lado, sin contar la zona de silencio. */
  modules?: number;
  moduleSizeMm?: number;
  moduleSizePx?: number;
};

export type QrLegibilityInput = {
  payload: string;
  errorCorrection: "L" | "M" | "Q" | "H";
  quietZoneModules: number;
  /** Lado del cuadrado en puntos PDF. */
  sidePt: number;
  medium: DesignMedium;
  dpi: number;
};

export function evaluateQrLegibility(input: QrLegibilityInput): QrLegibility {
  if (input.payload.trim() === "") {
    return { level: "INVALID", message: "El código QR no tiene contenido." };
  }

  let version: number;
  let modules: number;
  try {
    const qr = QRCode.create(input.payload, { errorCorrectionLevel: input.errorCorrection });
    version = qr.version;
    modules = qr.modules.size;
  } catch (e) {
    return {
      level: "INVALID",
      message: `El contenido no entra en un código QR: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const total = modules + input.quietZoneModules * 2;

  if (input.medium === "SCREEN") {
    const moduleSizePx = ptToPx(input.sidePt, input.dpi) / total;
    if (moduleSizePx < MIN_MODULE_PX) {
      return {
        level: "BLOCKS_PUBLISH",
        message: `El código QR queda muy chico: cada módulo mediría ${moduleSizePx.toFixed(2)} píxeles y el mínimo es ${MIN_MODULE_PX}. Agrandalo o acortá el contenido.`,
        version,
        modules,
        moduleSizePx,
      };
    }
    if (moduleSizePx < WARN_MODULE_PX) {
      return {
        level: "WARNING",
        message: `El código QR entra justo: cada módulo mide ${moduleSizePx.toFixed(2)} píxeles. Va a leerse, pero con poco margen.`,
        version,
        modules,
        moduleSizePx,
      };
    }
    return { level: "OK", message: "El código QR se lee bien en pantalla.", version, modules, moduleSizePx };
  }

  const moduleSizeMm = ptToMm(input.sidePt) / total;
  if (moduleSizeMm < MIN_MODULE_MM) {
    return {
      level: "BLOCKS_PUBLISH",
      message: `El código QR queda muy chico para imprimir: cada módulo mediría ${moduleSizeMm.toFixed(2)} mm y el mínimo es ${MIN_MODULE_MM} mm. Agrandalo o acortá el contenido.`,
      version,
      modules,
      moduleSizeMm,
    };
  }
  if (moduleSizeMm < WARN_MODULE_MM) {
    return {
      level: "WARNING",
      message: `El código QR va a leerse en pantalla, pero impreso es riesgoso: cada módulo mide ${moduleSizeMm.toFixed(2)} mm.`,
      version,
      modules,
      moduleSizeMm,
    };
  }
  return { level: "OK", message: "El código QR es legible impreso.", version, modules, moduleSizeMm };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 49 tests.

Si el caso de 19 mm no diera `WARNING`, **no cambiar el test para que pase**: recalcular.
Con el token corto son 29 módulos más 8 de zona de silencio, es decir 37; 19 mm ÷ 37 = 0,51 mm,
que está entre 0,5 y 0,65. Si el resultado real difiere, el error está en la implementación.

- [ ] **Step 5: Commit**

```bash
git add packages/design-studio/src
git commit -m "feat(design-studio): legibilidad del QR calculada con el contenido real"
```

---

### Task 8: Validación previa a publicar

Publicar una versión es lo que habilita emisiones reales, así que es el momento de mirar todo
junto con los valores de ejemplo del contrato. Lo que se detecta acá no vuelve a molestar en
cada emisión.

La división es deliberada: **lo que depende del diseño se controla al publicar; lo que depende
de los datos de cada persona, al emitir.** Por eso `maxLength` se mide contra el valor de
ejemplo y no contra el apellido real de nadie.

**Files:**
- Create: `packages/design-studio/src/validation/publish.ts`
- Test: `packages/design-studio/src/validation/validation.test.ts` (agregar casos)

**Interfaces:**
- Consumes: `DesignDocument`, `VariableContract`, `findDeclaration`, `placeholdersOf`,
  `buildLayoutPlan`, `TextMeasurer`, `evaluateQrLegibility`, `isFontId`, `ptToMm`.
- Produces: `PublishValidation` (`{ ok: boolean; errors: string[]; warnings: string[] }`),
  `validateForPublish(doc, contract, { measurer }): PublishValidation`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `packages/design-studio/src/validation/validation.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readDesignDocument } from "../document/migrate";
import { validateForPublish } from "./publish";
import type { VariableContract } from "../variables/contract";
import type { TextMeasurer } from "../layout/plan";

const medidor: TextMeasurer = {
  widthOf: (texto, _f, _s, sizePt) => texto.length * sizePt * 0.5,
};

function documentoCarnet() {
  const raw = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../document/__fixtures__/carnet-v1.json", import.meta.url)),
      "utf8",
    ),
  ) as unknown;
  const r = readDesignDocument(raw);
  if (!r.ok) throw new Error(r.errors.join(" | "));
  return r.value;
}

const contratoCarnet: VariableContract = {
  variables: [
    { key: "fullName", type: "text", label: "Nombre completo", required: true, sampleValue: "Daniel Cuart", maxLength: 34 },
    { key: "memberNumber", type: "number", label: "Número de socio", required: true, sampleValue: "128", decimals: 0 },
    { key: "category", type: "text", label: "Categoría", required: false, sampleValue: "Activo" },
    { key: "validUntil", type: "date", label: "Vigente hasta", required: true, sampleValue: "2028-08-26", dateFormat: "es-AR-short" },
    { key: "verificationUrl", type: "qrPayload", label: "Enlace de verificación", required: true, sampleValue: "https://fotoffice.com/c/AB12CD34" },
    { key: "photo", type: "image", label: "Foto del socio", required: true, sampleValue: "socios/ejemplo/foto.jpg" },
  ],
};

test("el carnet de ejemplo se puede publicar", () => {
  const r = validateForPublish(documentoCarnet(), contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, true, r.errors.join(" | "));
});

test("rechaza un marcador que el contrato no declara", () => {
  const doc = documentoCarnet();
  const bloque = doc.sides[0]?.blocks[1];
  if (bloque && bloque.type === "text") bloque.content = "{{inventado}}";
  const r = validateForPublish(doc, contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /inventado/);
});

test("rechaza un QR apuntado a una variable que no es de tipo qrPayload ni url", () => {
  const doc = documentoCarnet();
  const qr = doc.sides[1]?.blocks[0];
  if (qr && qr.type === "qrcode") qr.variableKey = "fullName";
  const r = validateForPublish(doc, contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /fullName/);
});

test("rechaza una imagen apuntada a una variable que no es de tipo image", () => {
  const doc = documentoCarnet();
  const foto = doc.sides[0]?.blocks[5];
  if (foto && foto.type === "image") foto.variableKey = "fullName";
  const r = validateForPublish(doc, contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, false);
});

test("rechaza si el valor de ejemplo mas largo permitido no entra en la caja", () => {
  const contratoLargo: VariableContract = {
    ...contratoCarnet,
    variables: contratoCarnet.variables.map((v) =>
      v.key === "fullName" ? { ...v, maxLength: 200, sampleValue: "Ma ".repeat(60).trim() } : v,
    ),
  };
  const r = validateForPublish(documentoCarnet(), contratoLargo, { measurer: medidor });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /no entra|desborda/i);
});

test("rechaza un QR demasiado chico para el contenido de ejemplo", () => {
  const doc = documentoCarnet();
  const qr = doc.sides[1]?.blocks[0];
  if (qr && qr.type === "qrcode") {
    qr.width = 8;
    qr.height = 8;
  }
  const r = validateForPublish(doc, contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /QR/);
});

test("avisa sin bloquear cuando un bloque invade el area segura", () => {
  const doc = documentoCarnet();
  const bloque = doc.sides[0]?.blocks[1];
  if (bloque) bloque.x = 0.5;
  const r = validateForPublish(doc, contratoCarnet, { measurer: medidor });
  assert.equal(r.ok, true, r.errors.join(" | "));
  assert.ok(r.warnings.some((w) => /área segura|area segura/i.test(w)));
});

test("rechaza una variable requerida por el contrato que ningun bloque usa", () => {
  const contratoDeMas: VariableContract = {
    variables: [
      ...contratoCarnet.variables,
      { key: "huerfana", type: "text", label: "Huérfana", required: true, sampleValue: "x" },
    ],
  };
  const r = validateForPublish(documentoCarnet(), contratoDeMas, { measurer: medidor });
  assert.equal(r.ok, false);
  assert.match(r.errors.join(" "), /huerfana/);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './publish'`

- [ ] **Step 3: Implementar `validation/publish.ts`**

```ts
import { ptToMm } from "../document/units";
import type { DesignDocument } from "../document/schema";
import { isFontId } from "../fonts/catalog";
import { buildLayoutPlan, type TextMeasurer } from "../layout/plan";
import { findDeclaration, type VariableContract } from "../variables/contract";
import { placeholdersOf } from "../variables/resolve";
import { evaluateQrLegibility } from "./qr";

export type PublishValidation = {
  ok: boolean;
  errors: string[];
  warnings: string[];
};

/** Valores de ejemplo del contrato, que es contra lo que se valida el diseño. */
function valoresDeEjemplo(contract: VariableContract): { values: Record<string, string>; omitted: string[] } {
  const values: Record<string, string> = {};
  for (const v of contract.variables) {
    values[v.key] = v.sampleValue;
  }
  return { values, omitted: [] };
}

export function validateForPublish(
  doc: DesignDocument,
  contract: VariableContract,
  opciones: { measurer: TextMeasurer },
): PublishValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const usadas = new Set<string>();

  for (const cara of doc.sides) {
    for (const bloque of cara.blocks) {
      if (bloque.type === "text") {
        if (!isFontId(bloque.fontId)) {
          errors.push(`El bloque "${bloque.id}" usa la tipografía "${bloque.fontId}", que no está en el catálogo.`);
        }
        for (const clave of placeholdersOf(bloque.content)) {
          usadas.add(clave);
          const decl = findDeclaration(contract, clave);
          if (!decl) {
            errors.push(`El bloque "${bloque.id}" usa la variable "${clave}", que el contrato no declara.`);
            continue;
          }
          if (decl.maxLength !== undefined && decl.sampleValue.length > decl.maxLength) {
            errors.push(
              `El valor de ejemplo de "${decl.label}" (${decl.key}) tiene ${decl.sampleValue.length} caracteres y el máximo declarado es ${decl.maxLength}.`,
            );
          }
        }
      }

      if (bloque.type === "qrcode") {
        usadas.add(bloque.variableKey);
        const decl = findDeclaration(contract, bloque.variableKey);
        if (!decl) {
          errors.push(`El bloque QR "${bloque.id}" usa la variable "${bloque.variableKey}", que el contrato no declara.`);
        } else if (decl.type !== "qrPayload" && decl.type !== "url") {
          errors.push(
            `El bloque QR "${bloque.id}" apunta a "${decl.key}", que es de tipo ${decl.type}. Un QR necesita una variable de tipo qrPayload o url.`,
          );
        }
      }

      if (bloque.type === "image" && bloque.variableKey) {
        usadas.add(bloque.variableKey);
        const decl = findDeclaration(contract, bloque.variableKey);
        if (!decl) {
          errors.push(`La imagen "${bloque.id}" usa la variable "${bloque.variableKey}", que el contrato no declara.`);
        } else if (decl.type !== "image") {
          errors.push(
            `La imagen "${bloque.id}" apunta a "${decl.key}", que es de tipo ${decl.type}. Tiene que ser una variable de tipo image.`,
          );
        }
      }
    }
  }

  for (const decl of contract.variables) {
    if (decl.required && !usadas.has(decl.key)) {
      errors.push(
        `El contrato declara "${decl.label}" (${decl.key}) como obligatoria, pero ningún bloque del diseño la usa. O la usás o dejala opcional.`,
      );
    }
  }

  // Maquetar con los valores de ejemplo revela desbordes y permite medir el QR de verdad.
  const plan = buildLayoutPlan(doc, valoresDeEjemplo(contract), {
    measurer: opciones.measurer,
    includeBleed: false,
  });

  if (!plan.ok) {
    errors.push(...plan.errors);
    return { ok: false, errors, warnings };
  }

  for (const pagina of plan.value.pages) {
    for (const item of pagina.items) {
      if (item.kind === "text" && item.overflow) {
        errors.push(
          `En la cara "${pagina.name}", el texto del bloque "${item.id}" no entra en su caja con el valor de ejemplo más largo.`,
        );
      }

      if (item.kind === "qr") {
        const legibilidad = evaluateQrLegibility({
          payload: item.payload,
          errorCorrection: item.errorCorrection,
          quietZoneModules: item.quietZoneModules,
          sidePt: Math.min(item.widthPt, item.heightPt),
          medium: plan.value.medium,
          dpi: plan.value.dpi,
        });
        if (legibilidad.level === "INVALID" || legibilidad.level === "BLOCKS_PUBLISH") {
          errors.push(`Bloque QR "${item.id}": ${legibilidad.message}`);
        } else if (legibilidad.level === "WARNING") {
          warnings.push(`Bloque QR "${item.id}": ${legibilidad.message}`);
        }
      }

      // Un fondo a sangre TIENE que llegar al borde: avisar por eso sería ruido. Lo que no
      // puede quedar cortado es lo que se lee.
      const puedeCortarse = item.kind === "text" || item.kind === "qr" || item.kind === "image";
      if (pagina.safeAreaPt > 0 && puedeCortarse) {
        const margen = pagina.safeAreaPt;
        const invade =
          item.xPt < margen ||
          item.yPt < margen ||
          item.xPt + item.widthPt > pagina.widthPt - margen ||
          item.yPt + item.heightPt > pagina.heightPt - margen;
        if (invade) {
          warnings.push(
            `En la cara "${pagina.name}", el bloque "${item.id}" invade el área segura de ${ptToMm(margen).toFixed(1)} mm. Al recortar la tarjeta puede quedar cortado.`,
          );
        }
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 57 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/design-studio/src
git commit -m "feat(design-studio): validacion previa a publicar una version"
```

---

### Task 9: Render a PDF

Acá aparece el medidor de texto real. Es el mismo objeto `PDFDocument` el que incrusta las
fuentes, mide y dibuja: por construcción, lo que se midió es lo que se imprime.

**Files:**
- Create: `packages/design-studio/src/render/version.ts`
- Create: `packages/design-studio/src/render/resources.ts`
- Create: `packages/design-studio/src/render/fonts-pdf.ts`
- Create: `packages/design-studio/src/render/pdf.ts`
- Test: `packages/design-studio/src/render/render.test.ts`

**Interfaces:**
- Consumes: `LayoutPlan`, `LayoutPage`, `LayoutItem`, `buildLayoutPlan`, `TextMeasurer`,
  `readFontBytes`, `FONT_CATALOG`, `DesignDocument`, `ResolvedVariables`, `Result`.
- Produces: `RENDERER_VERSION`, `ResourceResolver`, `createPdfFontSet(fontRefs)`,
  `renderPdf(doc, resolved, opciones): Promise<Result<Uint8Array>>`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/design-studio/src/render/render.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { readDesignDocument } from "../document/migrate";
import { renderPdf } from "./pdf";
import { RENDERER_VERSION } from "./version";
import type { ResourceResolver } from "./resources";

function documentoCarnet() {
  const raw = JSON.parse(
    readFileSync(
      fileURLToPath(new URL("../document/__fixtures__/carnet-v1.json", import.meta.url)),
      "utf8",
    ),
  ) as unknown;
  const r = readDesignDocument(raw);
  if (!r.ok) throw new Error(r.errors.join(" | "));
  return r.value;
}

/** PNG de 1×1 píxel gris, suficiente para probar que la imagen se incrusta. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const recursos: ResourceResolver = {
  read: async (ref) => (ref.endsWith(".jpg") || ref.endsWith(".png") ? new Uint8Array(PNG_1X1) : null),
};

const resueltas = {
  values: {
    fullName: "Daniel Cuart",
    memberNumber: "128",
    category: "Activo",
    validUntil: "26/08/2028",
    verificationUrl: "https://fotoffice.com/c/AB12CD34",
    photo: "socios/128/foto.jpg",
  },
  omitted: [] as string[],
};

test("la version del renderizador esta declarada", () => {
  assert.match(RENDERER_VERSION, /^\d+\.\d+\.\d+$/);
});

test("produce un PDF de dos paginas", async () => {
  const r = await renderPdf(documentoCarnet(), resueltas, { includeBleed: false, resources: recursos });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  const cabecera = String.fromCharCode(...r.value.slice(0, 5));
  assert.equal(cabecera, "%PDF-");
  const texto = Buffer.from(r.value).toString("latin1");
  assert.match(texto, /\/Count 2/);
});

test("el PDF cambia de tamano cuando se pide sangrado", async () => {
  const sin = await renderPdf(documentoCarnet(), resueltas, { includeBleed: false, resources: recursos });
  const con = await renderPdf(documentoCarnet(), resueltas, { includeBleed: true, resources: recursos });
  assert.equal(sin.ok && con.ok, true);
  if (!sin.ok || !con.ok) return;
  assert.notEqual(sin.value.byteLength, con.value.byteLength);
});

test("una imagen que no se puede resolver detiene la emision", async () => {
  const vacio: ResourceResolver = { read: async () => null };
  const r = await renderPdf(documentoCarnet(), resueltas, { includeBleed: false, resources: vacio });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /socios\/128\/foto\.jpg/);
});

test("dos renders del mismo documento con los mismos datos dan el mismo archivo", async () => {
  const a = await renderPdf(documentoCarnet(), resueltas, { includeBleed: false, resources: recursos });
  const b = await renderPdf(documentoCarnet(), resueltas, { includeBleed: false, resources: recursos });
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.deepEqual(Buffer.from(a.value), Buffer.from(b.value), "el render no es reproducible");
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './pdf'`

- [ ] **Step 3: Implementar `render/version.ts`**

```ts
/**
 * Versión del renderizador. Cada emisión la guarda, y reproducir una pieza vieja significa
 * volver a correr esta versión.
 *
 * Subir el número ante CUALQUIER cambio que altere los bytes de salida: interlineado, corte
 * de líneas, incrustado de fuentes, márgenes del QR.
 */
export const RENDERER_VERSION = "1.0.0";
```

- [ ] **Step 4: Implementar `render/resources.ts`**

```ts
/**
 * Puerto de recursos. El módulo no sabe de R2 ni del sistema de archivos: el producto le
 * entrega los bytes. Devolver `null` significa "no existe", y eso detiene la emisión.
 */
export type ResourceResolver = {
  read(ref: string): Promise<Uint8Array | null>;
};

/** Reconoce el formato por los bytes, no por la extensión del nombre. */
export function detectImageFormat(bytes: Uint8Array): "png" | "jpg" | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return "png";
  }
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  return null;
}
```

- [ ] **Step 5: Implementar `render/fonts-pdf.ts`**

```ts
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFFont } from "pdf-lib";
import { FONT_CATALOG, type FontId, type FontSlot } from "../fonts/catalog";
import { readFontBytes } from "../fonts/load";
import type { TextMeasurer } from "../layout/plan";

export type PdfFontSet = {
  doc: PDFDocument;
  get(fontId: FontId, slot: FontSlot): PDFFont;
  measurer: TextMeasurer;
};

function clave(fontId: FontId, slot: FontSlot): string {
  return `${fontId}:${slot}`;
}

/**
 * Crea el documento PDF con las fuentes ya incrustadas y un medidor que usa esas mismas
 * fuentes. Medir con una tipografía y dibujar con otra es la forma clásica de que un texto
 * entre en la vista previa y desborde en el archivo final.
 */
export async function createPdfFontSet(
  refs: Array<{ fontId: FontId; slot: FontSlot }>,
): Promise<PdfFontSet> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  const fuentes = new Map<string, PDFFont>();
  const vistos = new Set<string>();
  for (const ref of refs) {
    const k = clave(ref.fontId, ref.slot);
    if (vistos.has(k)) continue;
    vistos.add(k);
    const bytes = await readFontBytes(ref.fontId, ref.slot);
    fuentes.set(k, await doc.embedFont(bytes, { subset: false }));
  }

  function get(fontId: FontId, slot: FontSlot): PDFFont {
    const f = fuentes.get(clave(fontId, slot));
    if (!f) {
      throw new Error(
        `La tipografía ${FONT_CATALOG[fontId].label} (${slot}) no fue incrustada. Es un error del propio módulo.`,
      );
    }
    return f;
  }

  return {
    doc,
    get,
    measurer: {
      widthOf: (texto, fontId, slot, sizePt) => get(fontId, slot).widthOfTextAtSize(texto, sizePt),
    },
  };
}
```

Nota sobre `subset: false`: incrustar la fuente completa hace el archivo más grande, pero el
subconjunto depende de los caracteres presentes, y eso haría que dos emisiones con nombres
distintos produzcan estructuras distintas. Con la fuente entera, el archivo es función de la
plantilla y de los datos, que es lo que la reproducción necesita.

- [ ] **Step 6: Implementar `render/pdf.ts`**

```ts
import { degrees, rgb, type PDFImage, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { fail, ok, type Result } from "../result";
import type { DesignDocument } from "../document/schema";
import type { ResolvedVariables } from "../variables/contract";
import { buildLayoutPlan, type LayoutPage, type LayoutTextItem } from "../layout/plan";
import { isFontId, slotFor, type FontId, type FontSlot } from "../fonts/catalog";
import { createPdfFontSet, type PdfFontSet } from "./fonts-pdf";
import { RENDERER_VERSION } from "./version";
import { detectImageFormat, type ResourceResolver } from "./resources";

export type RenderPdfOptions = {
  includeBleed: boolean;
  resources: ResourceResolver;
};

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Fuentes que el documento necesita, para incrustarlas antes de medir. */
function fuentesUsadas(doc: DesignDocument): Array<{ fontId: FontId; slot: FontSlot }> {
  const refs: Array<{ fontId: FontId; slot: FontSlot }> = [];
  for (const cara of doc.sides) {
    for (const bloque of cara.blocks) {
      if (bloque.type !== "text" || bloque.hidden) continue;
      // Una tipografía fuera del catálogo NO se intenta cargar acá: buildLayoutPlan la
      // rechaza con un mensaje entendible, y así el error llega como resultado y no como
      // una excepción cruda de lectura de archivo.
      if (!isFontId(bloque.fontId)) continue;
      refs.push({ fontId: bloque.fontId, slot: slotFor(bloque.fontWeight, bloque.fontStyle) });
    }
  }
  return refs;
}

function dibujarTexto(page: PDFPage, item: LayoutTextItem, altoPagina: number, fuentes: PdfFontSet): void {
  const font = fuentes.get(item.fontId, item.slot);
  // Alto de la mayúscula, sin descendente: fija la primera línea de base bajo el borde
  // superior de la caja.
  const ascenso = font.heightAtSize(item.sizePt, { descender: false });
  const color = hexToRgb(item.color);

  item.lines.forEach((linea, i) => {
    const ancho = font.widthOfTextAtSize(linea, item.sizePt);
    const desplazamiento =
      item.align === "center" ? (item.widthPt - ancho) / 2 : item.align === "right" ? item.widthPt - ancho : 0;
    const baseY = altoPagina - (item.yPt + ascenso + i * item.lineHeightPt);
    page.drawText(linea, {
      x: item.xPt + desplazamiento,
      y: baseY,
      size: item.sizePt,
      font,
      color,
      opacity: item.opacity,
      ...(item.rotation ? { rotate: degrees(-item.rotation) } : {}),
    });
  });
}

async function dibujarPagina(
  page: PDFPage,
  plan: LayoutPage,
  fuentes: PdfFontSet,
  resources: ResourceResolver,
  errores: string[],
): Promise<void> {
  const alto = plan.heightPt;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: plan.widthPt,
    height: alto,
    color: hexToRgb(plan.background),
  });

  for (const item of plan.items) {
    const yPdf = alto - item.yPt - item.heightPt;

    if (item.kind === "rect") {
      page.drawRectangle({
        x: item.xPt,
        y: yPdf,
        width: item.widthPt,
        height: item.heightPt,
        opacity: item.opacity,
        ...(item.fillColor ? { color: hexToRgb(item.fillColor) } : {}),
        ...(item.strokeColor ? { borderColor: hexToRgb(item.strokeColor) } : {}),
        ...(item.strokeWidthPt ? { borderWidth: item.strokeWidthPt } : {}),
        ...(item.rotation ? { rotate: degrees(-item.rotation) } : {}),
      });
      continue;
    }

    if (item.kind === "line") {
      page.drawLine({
        start: { x: item.xPt, y: alto - item.yPt },
        end: { x: item.xPt + item.widthPt, y: alto - item.yPt },
        thickness: item.strokeWidthPt,
        color: hexToRgb(item.strokeColor),
        opacity: item.opacity,
      });
      continue;
    }

    if (item.kind === "text") {
      dibujarTexto(page, item, alto, fuentes);
      continue;
    }

    if (item.kind === "qr") {
      const lado = Math.min(item.widthPt, item.heightPt);
      const png = await QRCode.toBuffer(item.payload, {
        type: "png",
        errorCorrectionLevel: item.errorCorrection,
        margin: item.quietZoneModules,
        // Alto suficiente para que el raster no limite la nitidez a 300 puntos por pulgada.
        width: 1024,
        color: { dark: item.darkColor, light: item.lightColor },
      });
      const imagen = await fuentes.doc.embedPng(png);
      page.drawImage(imagen, {
        x: item.xPt,
        y: alto - item.yPt - lado,
        width: lado,
        height: lado,
        opacity: item.opacity,
      });
      continue;
    }

    const bytes = await resources.read(item.ref);
    if (!bytes) {
      errores.push(
        `No se encontró la imagen "${item.ref}" que usa el bloque "${item.id}". No se emite la pieza sin ella.`,
      );
      continue;
    }
    const formato = detectImageFormat(bytes);
    if (!formato) {
      errores.push(`El archivo "${item.ref}" del bloque "${item.id}" no es un PNG ni un JPG.`);
      continue;
    }
    let imagen: PDFImage;
    try {
      imagen = formato === "png" ? await fuentes.doc.embedPng(bytes) : await fuentes.doc.embedJpg(bytes);
    } catch (e) {
      errores.push(
        `No se pudo leer la imagen "${item.ref}": ${e instanceof Error ? e.message : String(e)}`,
      );
      continue;
    }

    // `cover` llena la caja recortando lo que sobra; `contain` entra entera y deja aire.
    const escalaCover = Math.max(item.widthPt / imagen.width, item.heightPt / imagen.height);
    const escalaContain = Math.min(item.widthPt / imagen.width, item.heightPt / imagen.height);
    const escala = item.fit === "cover" ? escalaCover : escalaContain;
    const ancho = imagen.width * escala;
    const altoImg = imagen.height * escala;

    page.drawImage(imagen, {
      x: item.xPt + (item.widthPt - ancho) / 2,
      y: yPdf + (item.heightPt - altoImg) / 2,
      width: ancho,
      height: altoImg,
      opacity: item.opacity,
      ...(item.rotation ? { rotate: degrees(-item.rotation) } : {}),
    });
  }
}

export async function renderPdf(
  doc: DesignDocument,
  resolved: ResolvedVariables,
  options: RenderPdfOptions,
): Promise<Result<Uint8Array>> {
  const fuentes = await createPdfFontSet(fuentesUsadas(doc));

  const plan = buildLayoutPlan(doc, resolved, {
    measurer: fuentes.measurer,
    includeBleed: options.includeBleed,
  });
  if (!plan.ok) return plan;

  const errores: string[] = [];
  for (const pagina of plan.value.pages) {
    const page = fuentes.doc.addPage([pagina.widthPt, pagina.heightPt]);
    await dibujarPagina(page, pagina, fuentes, options.resources, errores);
  }
  if (errores.length > 0) return fail(...errores);

  // Fechas fijas: pdf-lib estampa la de creación y la de modificación, y con la hora del
  // reloj dos emisiones idénticas darían archivos distintos. La fecha real de la emisión la
  // guarda el producto, no el archivo.
  const epoch = new Date(0);
  fuentes.doc.setCreationDate(epoch);
  fuentes.doc.setModificationDate(epoch);
  fuentes.doc.setProducer(`DNX Design Studio ${RENDERER_VERSION}`);
  fuentes.doc.setCreator("DNX Design Studio");
  fuentes.doc.setTitle(doc.metadata.name);

  return ok(await fuentes.doc.save({ useObjectStreams: false }));
}
```

- [ ] **Step 7: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 62 tests.

La prueba de reproducibilidad es la que más fácil se rompe. Si falla, el culpable casi siempre
es una fecha o un identificador aleatorio metido en el PDF: revisar que
`setCreationDate`/`setModificationDate` estén fijos antes de `save`.

- [ ] **Step 8: Commit**

```bash
git add packages/design-studio/src
git commit -m "feat(design-studio): render a PDF con tipografia incrustada y salida reproducible"
```

---

### Task 10: PNG desde el mismo PDF, y SVG para pantalla

El PNG **no se dibuja de nuevo**: se rasteriza el PDF ya generado. Así la imagen que ve el
socio en el teléfono y el archivo que va a la imprenta no pueden diferir.

El SVG es para la vista en vivo del editor y del carnet digital en el navegador. Ahí las
tipografías las carga el navegador por CSS, por eso cada bloque sale con su familia y su
alternativa declarada. **El SVG no es el camino a la imprenta**: para eso está el PDF.

**Files:**
- Create: `packages/design-studio/src/render/png.ts`
- Create: `packages/design-studio/src/render/svg.ts`
- Test: `packages/design-studio/src/render/render.test.ts` (agregar casos)

**Interfaces:**
- Consumes: `renderPdf`, `LayoutPage`, `LayoutPlan`, `FONT_CATALOG`, `createPdfFontSet`,
  `buildLayoutPlan`, `Result`.
- Produces: `pdfToPng(pdf, { dpi, pageIndex }): Promise<Result<Uint8Array>>`,
  `renderSvgPages(doc, resolved): Promise<Result<string[]>>`.

- [ ] **Step 1: Escribir los tests que fallan**

Agregar a `packages/design-studio/src/render/render.test.ts`:

```ts
import { pdfToPng } from "./png";
import { renderSvgPages } from "./svg";

test("rasteriza la primera cara del PDF a PNG", async () => {
  const pdf = await renderPdf(documentoCarnet(), resueltas, { includeBleed: false, resources: recursos });
  assert.equal(pdf.ok, true);
  if (!pdf.ok) return;
  const png = await pdfToPng(pdf.value, { dpi: 300, pageIndex: 0 });
  assert.equal(png.ok, true, png.ok ? "" : png.errors.join(" | "));
  if (!png.ok) return;
  // Firma de un PNG.
  assert.deepEqual(Array.from(png.value.slice(0, 4)), [0x89, 0x50, 0x4e, 0x47]);
  assert.ok(png.value.byteLength > 2000);
});

test("pedir una cara que no existe falla con un mensaje claro", async () => {
  const pdf = await renderPdf(documentoCarnet(), resueltas, { includeBleed: false, resources: recursos });
  assert.equal(pdf.ok, true);
  if (!pdf.ok) return;
  const png = await pdfToPng(pdf.value, { dpi: 300, pageIndex: 7 });
  assert.equal(png.ok, false);
});

test("produce un SVG por cara con el texto ya interpolado", async () => {
  const r = await renderSvgPages(documentoCarnet(), resueltas);
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.value.length, 2);
  assert.match(r.value[0] ?? "", /^<svg /);
  assert.match(r.value[0] ?? "", /Daniel Cuart/);
  assert.match(r.value[0] ?? "", /font-family/);
});

test("el SVG escapa los caracteres que romperian el XML", async () => {
  // Se comprueban los caracteres uno por uno y no la cadena entera: el corte de líneas puede
  // repartirlos en dos <text>, y eso no tiene nada de malo.
  const conAmpersand = { ...resueltas, values: { ...resueltas.values, fullName: 'Ana&Co <x>' } };
  const r = await renderSvgPages(documentoCarnet(), conAmpersand);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  const svg = r.value[0] ?? "";
  assert.match(svg, /Ana&amp;Co/);
  assert.match(svg, /&lt;x&gt;/);
  assert.doesNotMatch(svg, /Ana&Co/);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './png'`

- [ ] **Step 3: Implementar `render/png.ts`**

```ts
import { fail, ok, type Result } from "../result";

export type PdfToPngOptions = {
  /** Puntos por pulgada del raster. El PDF está en puntos, que son 72 por pulgada. */
  dpi: number;
  /** Cara a rasterizar, empezando en 0. */
  pageIndex: number;
};

/**
 * Rasteriza una cara del PDF ya emitido.
 *
 * El import es dinámico a propósito: `pdf-to-png-converter` arrastra un binario nativo
 * (@napi-rs/canvas) y no debe entrar en el grafo de módulos de quien solo quiera leer un
 * documento o validar una plantilla.
 */
export async function pdfToPng(pdf: Uint8Array, options: PdfToPngOptions): Promise<Result<Uint8Array>> {
  if (options.pageIndex < 0) {
    return fail("El número de cara no puede ser negativo.");
  }
  try {
    const { pdfToPng: convertir } = await import("pdf-to-png-converter");
    const salida = await convertir(Buffer.from(pdf), {
      pagesToProcess: [options.pageIndex + 1],
      viewportScale: options.dpi / 72,
    });
    const primera = salida[0];
    if (!primera?.content) {
      return fail(`El PDF no tiene una cara número ${options.pageIndex + 1}.`);
    }
    return ok(new Uint8Array(primera.content));
  } catch (e) {
    return fail(
      `No se pudo convertir el PDF a imagen: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
}
```

- [ ] **Step 4: Implementar `render/svg.ts`**

```ts
import QRCode from "qrcode";
import { ok, type Result } from "../result";
import type { DesignDocument } from "../document/schema";
import type { ResolvedVariables } from "../variables/contract";
import { buildLayoutPlan, type LayoutPage } from "../layout/plan";
import { FONT_CATALOG, isFontId, slotFor, type FontId, type FontSlot } from "../fonts/catalog";
import { createPdfFontSet } from "./fonts-pdf";

export function escapeXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function svgDePagina(pagina: LayoutPage, qrPorItem: Map<string, string>): string {
  const partes: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${pagina.widthPt}" height="${pagina.heightPt}" viewBox="0 0 ${pagina.widthPt} ${pagina.heightPt}">`,
    `<rect x="0" y="0" width="${pagina.widthPt}" height="${pagina.heightPt}" fill="${pagina.background}"/>`,
  ];

  for (const item of pagina.items) {
    const giro = item.rotation
      ? ` transform="rotate(${item.rotation} ${item.xPt + item.widthPt / 2} ${item.yPt + item.heightPt / 2})"`
      : "";
    const alfa = item.opacity !== 1 ? ` opacity="${item.opacity}"` : "";

    if (item.kind === "rect") {
      const radio = item.cornerRadiusPt ? ` rx="${item.cornerRadiusPt}"` : "";
      partes.push(
        `<rect x="${item.xPt}" y="${item.yPt}" width="${item.widthPt}" height="${item.heightPt}"${radio}` +
          ` fill="${item.fillColor ?? "none"}"` +
          (item.strokeColor ? ` stroke="${item.strokeColor}" stroke-width="${item.strokeWidthPt ?? 1}"` : "") +
          `${alfa}${giro}/>`,
      );
      continue;
    }

    if (item.kind === "line") {
      partes.push(
        `<line x1="${item.xPt}" y1="${item.yPt}" x2="${item.xPt + item.widthPt}" y2="${item.yPt}"` +
          ` stroke="${item.strokeColor}" stroke-width="${item.strokeWidthPt}"${alfa}${giro}/>`,
      );
      continue;
    }

    if (item.kind === "text") {
      const def = FONT_CATALOG[item.fontId];
      const anclaje = item.align === "center" ? "middle" : item.align === "right" ? "end" : "start";
      const x =
        item.align === "center"
          ? item.xPt + item.widthPt / 2
          : item.align === "right"
            ? item.xPt + item.widthPt
            : item.xPt;
      const peso = item.slot === "bold" || item.slot === "boldItalic" ? "700" : "400";
      const estilo = item.slot === "italic" || item.slot === "boldItalic" ? "italic" : "normal";
      partes.push(`<g${alfa}${giro}>`);
      item.lines.forEach((linea, i) => {
        // Sin descendente, la primera línea de base queda a un cuerpo del borde superior.
        const y = item.yPt + item.sizePt + i * item.lineHeightPt;
        partes.push(
          `<text x="${x}" y="${y}" text-anchor="${anclaje}" fill="${item.color}"` +
            ` font-family="${escapeXml(def.fallbackStack)}" font-size="${item.sizePt}"` +
            ` font-weight="${peso}" font-style="${estilo}">${escapeXml(linea)}</text>`,
        );
      });
      partes.push(`</g>`);
      continue;
    }

    if (item.kind === "qr") {
      const lado = Math.min(item.widthPt, item.heightPt);
      const dataUri = qrPorItem.get(item.id) ?? "";
      partes.push(
        `<image x="${item.xPt}" y="${item.yPt}" width="${lado}" height="${lado}" href="${dataUri}"${alfa}${giro}/>`,
      );
      continue;
    }

    // La imagen se referencia por su clave: quien muestre el SVG la resuelve a una URL
    // firmada. El módulo no sabe dónde vive el archivo.
    partes.push(
      `<image x="${item.xPt}" y="${item.yPt}" width="${item.widthPt}" height="${item.heightPt}"` +
        ` data-resource-ref="${escapeXml(item.ref)}" preserveAspectRatio="${item.fit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}"${alfa}${giro}/>`,
    );
  }

  partes.push("</svg>");
  return partes.join("");
}

/**
 * Un SVG por cara, para la vista en vivo. Usa el mismo medidor que el PDF, así que el corte
 * de líneas es idéntico al del archivo que se imprime.
 */
export async function renderSvgPages(
  doc: DesignDocument,
  resolved: ResolvedVariables,
): Promise<Result<string[]>> {
  const refs: Array<{ fontId: FontId; slot: FontSlot }> = [];
  for (const cara of doc.sides) {
    for (const bloque of cara.blocks) {
      if (bloque.type !== "text" || bloque.hidden) continue;
      if (!isFontId(bloque.fontId)) continue;
      refs.push({ fontId: bloque.fontId, slot: slotFor(bloque.fontWeight, bloque.fontStyle) });
    }
  }
  const fuentes = await createPdfFontSet(refs);

  const plan = buildLayoutPlan(doc, resolved, { measurer: fuentes.measurer, includeBleed: false });
  if (!plan.ok) return plan;

  const svgs: string[] = [];
  for (const pagina of plan.value.pages) {
    const qrPorItem = new Map<string, string>();
    for (const item of pagina.items) {
      if (item.kind !== "qr") continue;
      const dataUri = await QRCode.toDataURL(item.payload, {
        errorCorrectionLevel: item.errorCorrection,
        margin: item.quietZoneModules,
        width: 512,
        color: { dark: item.darkColor, light: item.lightColor },
      });
      qrPorItem.set(item.id, dataUri);
    }
    svgs.push(svgDePagina(pagina, qrPorItem));
  }
  return ok(svgs);
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 66 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/design-studio/src
git commit -m "feat(design-studio): PNG rasterizado del propio PDF y SVG para pantalla"
```

---

### Task 11: Contrato de exportación y puerta única de emisión

`emitDesign` es la única función que un producto necesita conocer. Recibe el documento **crudo**
—se encarga de migrarlo y validarlo— y devuelve archivos con su checksum, más los tres datos que
la emisión tiene que registrar para poder reproducirse: versión del renderizador, versión del
esquema y qué variables opcionales no vinieron.

**Files:**
- Create: `packages/design-studio/src/export/contract.ts`
- Create: `packages/design-studio/src/export/emit.ts`
- Test: `packages/design-studio/src/export/emit.test.ts`

**Interfaces:**
- Consumes: `readDesignDocument`, `resolveVariables`, `renderPdf`, `pdfToPng`,
  `renderSvgPages`, `ResourceResolver`, `RENDERER_VERSION`, `DESIGN_SCHEMA_VERSION`.
- Produces: `EmissionFormat`, `EmittedFile`, `EmitRequest`, `EmitOutcome`,
  `checksumOf(bytes): string`, `emitDesign(request): Promise<EmitOutcome>`.

- [ ] **Step 1: Escribir los tests que fallan**

`packages/design-studio/src/export/emit.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { checksumOf, emitDesign } from "./emit";
import { RENDERER_VERSION } from "../render/version";
import type { VariableContract } from "../variables/contract";
import type { ResourceResolver } from "../render/resources";

const documentoCrudo = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../document/__fixtures__/carnet-v1.json", import.meta.url)),
    "utf8",
  ),
) as unknown;

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const recursos: ResourceResolver = { read: async () => new Uint8Array(PNG_1X1) };

const contrato: VariableContract = {
  variables: [
    { key: "fullName", type: "text", label: "Nombre completo", required: true, sampleValue: "Daniel Cuart", maxLength: 34 },
    { key: "memberNumber", type: "number", label: "Número de socio", required: true, sampleValue: "128", decimals: 0 },
    { key: "category", type: "text", label: "Categoría", required: false, sampleValue: "Activo" },
    { key: "validUntil", type: "date", label: "Vigente hasta", required: true, sampleValue: "2028-08-26", dateFormat: "es-AR-short" },
    { key: "verificationUrl", type: "qrPayload", label: "Enlace de verificación", required: true, sampleValue: "https://fotoffice.com/c/AB12CD34" },
    { key: "photo", type: "image", label: "Foto del socio", required: true, sampleValue: "socios/ejemplo/foto.jpg" },
  ],
};

const datos = {
  fullName: "Daniel Cuart",
  memberNumber: 128,
  validUntil: new Date(Date.UTC(2028, 7, 26)),
  verificationUrl: "https://fotoffice.com/c/AB12CD34",
  photo: "socios/128/foto.jpg",
};

test("el checksum es estable y cambia con el contenido", () => {
  const a = checksumOf(new Uint8Array([1, 2, 3]));
  assert.equal(a, checksumOf(new Uint8Array([1, 2, 3])));
  assert.notEqual(a, checksumOf(new Uint8Array([1, 2, 4])));
  assert.equal(a.length, 64);
});

test("emite el PDF, los PNG de cada cara y registra que hace falta para reproducirlo", async () => {
  const r = await emitDesign({
    document: documentoCrudo,
    contract: contrato,
    values: datos,
    formats: ["PDF", "PNG_PER_SIDE"],
    includeBleed: true,
    pngDpi: 300,
    resources: recursos,
    fileBaseName: "carnet-128",
  });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.rendererVersion, RENDERER_VERSION);
  assert.equal(r.schemaVersion, 1);
  assert.deepEqual(r.omittedVariables, ["category"]);
  // La fecha se guarda ya formateada: es el texto que quedó impreso.
  assert.equal(r.resolvedValues.validUntil, "26/08/2028");
  const nombres = r.files.map((f) => f.name).sort();
  assert.deepEqual(nombres, ["carnet-128-dorso.png", "carnet-128-frente.png", "carnet-128.pdf"]);
  for (const f of r.files) {
    assert.equal(f.checksum.length, 64);
    assert.ok(f.bytes.byteLength > 0);
  }
});

test("emite el SVG de cada cara cuando se lo pide", async () => {
  const r = await emitDesign({
    document: documentoCrudo,
    contract: contrato,
    values: datos,
    formats: ["SVG_PER_SIDE"],
    resources: recursos,
    fileBaseName: "carnet-128",
  });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.files.length, 2);
  assert.equal(r.files[0]?.contentType, "image/svg+xml");
});

test("un dato obligatorio ausente detiene la emision antes de dibujar nada", async () => {
  const r = await emitDesign({
    document: documentoCrudo,
    contract: contrato,
    values: { ...datos, fullName: "" },
    formats: ["PDF"],
    resources: recursos,
    fileBaseName: "carnet-128",
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.match(r.errors.join(" "), /Nombre completo/);
});

test("un documento que no se entiende detiene la emision", async () => {
  const r = await emitDesign({
    document: { schemaVersion: 99 },
    contract: contrato,
    values: datos,
    formats: ["PDF"],
    resources: recursos,
    fileBaseName: "carnet-128",
  });
  assert.equal(r.ok, false);
});

test("la misma emision repetida da los mismos checksums", async () => {
  const pedido = {
    document: documentoCrudo,
    contract: contrato,
    values: datos,
    formats: ["PDF"] as const,
    resources: recursos,
    fileBaseName: "carnet-128",
  };
  const a = await emitDesign({ ...pedido, formats: ["PDF"] });
  const b = await emitDesign({ ...pedido, formats: ["PDF"] });
  assert.equal(a.ok && b.ok, true);
  if (!a.ok || !b.ok) return;
  assert.equal(a.files[0]?.checksum, b.files[0]?.checksum);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module './emit'`

- [ ] **Step 3: Implementar `export/contract.ts`**

```ts
import type { VariableContract, VariableValues } from "../variables/contract";
import type { ResourceResolver } from "../render/resources";

/**
 * Formatos de esta primera versión. El contrato admite más —plancha imprimible, ZIP, marcas
 * de corte, perfil de color— y esos llegan cuando haya emisión masiva.
 */
export type EmissionFormat = "PDF" | "PNG_PER_SIDE" | "SVG_PER_SIDE";

export type EmittedFile = {
  name: string;
  contentType: string;
  bytes: Uint8Array;
  /** SHA-256 en hexadecimal. Es lo que permite verificar que un archivo guardado es el emitido. */
  checksum: string;
};

export type EmitRequest = {
  /** Crudo: `emitDesign` lo migra y lo valida. */
  document: unknown;
  contract: VariableContract;
  values: VariableValues;
  formats: EmissionFormat[];
  /** Solo PRINT. Por defecto, sin sangrado. */
  includeBleed?: boolean;
  /** Solo PNG. Por defecto, el dpi que declara el documento. */
  pngDpi?: number;
  resources: ResourceResolver;
  /** Sin extensión. Se le agrega la cara y el formato. */
  fileBaseName: string;
};

export type EmitOutcome =
  | {
      ok: true;
      files: EmittedFile[];
      /** Lo que la emisión tiene que guardar para poder reproducirse. */
      rendererVersion: string;
      schemaVersion: number;
      /**
       * Los valores tal como se dibujaron, ya convertidos a texto. Guardar esto —y no lo que
       * el producto creía estar mandando— es lo que permite reproducir la pieza: si mañana
       * cambia el formato de fecha, la pieza vieja se rehace con el texto que tenía.
       */
      resolvedValues: Record<string, string>;
      /** Variables opcionales que no vinieron. Queda registrado, como pide la spec. */
      omittedVariables: string[];
    }
  | { ok: false; errors: string[] };
```

- [ ] **Step 4: Implementar `export/emit.ts`**

```ts
import { createHash } from "node:crypto";
import { readDesignDocument } from "../document/migrate";
import { DESIGN_SCHEMA_VERSION } from "../document/schema";
import { resolveVariables } from "../variables/resolve";
import { renderPdf } from "../render/pdf";
import { pdfToPng } from "../render/png";
import { renderSvgPages } from "../render/svg";
import { RENDERER_VERSION } from "../render/version";
import type { EmitOutcome, EmitRequest, EmittedFile } from "./contract";

export function checksumOf(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function archivo(name: string, contentType: string, bytes: Uint8Array): EmittedFile {
  return { name, contentType, bytes, checksum: checksumOf(bytes) };
}

/**
 * La única puerta de emisión del módulo.
 *
 * El orden importa: primero se lee el documento, después se resuelven las variables y recién
 * entonces se dibuja. Así un dato obligatorio ausente detiene la emisión **antes** de gastar
 * en incrustar fuentes o rasterizar, y el mensaje de error habla del dato, no del render.
 */
export async function emitDesign(request: EmitRequest): Promise<EmitOutcome> {
  const documento = readDesignDocument(request.document);
  if (!documento.ok) return { ok: false, errors: documento.errors };

  const resueltas = resolveVariables(request.contract, request.values);
  if (!resueltas.ok) return { ok: false, errors: resueltas.errors };

  if (request.formats.length === 0) {
    return { ok: false, errors: ["No se pidió ningún formato de salida."] };
  }

  const doc = documento.value;
  const files: EmittedFile[] = [];
  const necesitaPdf =
    request.formats.includes("PDF") || request.formats.includes("PNG_PER_SIDE");

  let pdfBytes: Uint8Array | null = null;
  if (necesitaPdf) {
    const pdf = await renderPdf(doc, resueltas.value, {
      includeBleed: request.includeBleed ?? false,
      resources: request.resources,
    });
    if (!pdf.ok) return { ok: false, errors: pdf.errors };
    pdfBytes = pdf.value;
  }

  if (request.formats.includes("PDF") && pdfBytes) {
    files.push(archivo(`${request.fileBaseName}.pdf`, "application/pdf", pdfBytes));
  }

  if (request.formats.includes("PNG_PER_SIDE") && pdfBytes) {
    const dpi = request.pngDpi ?? doc.format.dpi ?? 300;
    for (const [indice, cara] of doc.sides.entries()) {
      const png = await pdfToPng(pdfBytes, { dpi, pageIndex: indice });
      if (!png.ok) return { ok: false, errors: png.errors };
      files.push(archivo(`${request.fileBaseName}-${cara.id}.png`, "image/png", png.value));
    }
  }

  if (request.formats.includes("SVG_PER_SIDE")) {
    const svgs = await renderSvgPages(doc, resueltas.value);
    if (!svgs.ok) return { ok: false, errors: svgs.errors };
    svgs.value.forEach((svg, indice) => {
      const cara = doc.sides[indice];
      if (!cara) return;
      files.push(
        archivo(
          `${request.fileBaseName}-${cara.id}.svg`,
          "image/svg+xml",
          new TextEncoder().encode(svg),
        ),
      );
    });
  }

  return {
    ok: true,
    files,
    rendererVersion: RENDERER_VERSION,
    schemaVersion: DESIGN_SCHEMA_VERSION,
    resolvedValues: resueltas.value.values,
    omittedVariables: resueltas.value.omitted,
  };
}
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 72 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/design-studio/src
git commit -m "feat(design-studio): contrato de exportacion y puerta unica de emision"
```

---

### Task 12: Barril, documentación y conexión con FotoOffice

Esta tarea es la que puede romper producción, así que tiene más verificación que código.

**Antecedente concreto:** el 24 de agosto, pasar FotoOffice de Turbopack a webpack dejó el motor
de Prisma fuera del paquete desplegado y `/w/sfpr/cursos` devolvió 500. La compilación local
estaba en verde. **Una compilación que pasa no prueba que el archivo llegue al servidor.**

Acá el riesgo es el mismo con otra pieza: `readFontBytes` resuelve la ruta del `.woff` armando
el nombre en tiempo de ejecución, así que el rastreador de archivos de Next **no puede verla** y
no la copia al paquete. En local anda —están todos los `node_modules`— y en Vercel falla.

**Files:**
- Create: `packages/design-studio/src/index.ts`
- Create: `packages/design-studio/README.md`
- Modify: `apps/fotoffice/package.json` (dependencias)
- Modify: `apps/fotoffice/next.config.ts`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: el barril `@repo/design-studio` con `emitDesign`, `readDesignDocument`,
  `validateForPublish`, `evaluateQrLegibility`, `FONT_CATALOG`, `RENDERER_VERSION`,
  `DESIGN_SCHEMA_VERSION` y los tipos públicos.

- [ ] **Step 1: Escribir el test de punta a punta que falla**

`packages/design-studio/src/export/emit.test.ts`, al final:

```ts
import * as barril from "../index";

test("el barril expone lo que un producto necesita", () => {
  assert.equal(typeof barril.emitDesign, "function");
  assert.equal(typeof barril.readDesignDocument, "function");
  assert.equal(typeof barril.validateForPublish, "function");
  assert.equal(typeof barril.evaluateQrLegibility, "function");
  assert.equal(typeof barril.RENDERER_VERSION, "string");
  assert.equal(barril.DESIGN_SCHEMA_VERSION, 1);
  assert.ok(barril.FONT_CATALOG.dmSans);
});

test("de documento crudo a carnet impreso, en un solo paso", async () => {
  const r = await barril.emitDesign({
    document: documentoCrudo,
    contract: contrato,
    values: datos,
    formats: ["PDF", "PNG_PER_SIDE", "SVG_PER_SIDE"],
    includeBleed: true,
    pngDpi: 300,
    resources: recursos,
    fileBaseName: "carnet-sfpr-128",
  });
  assert.equal(r.ok, true, r.ok ? "" : r.errors.join(" | "));
  if (!r.ok) return;
  assert.equal(r.files.length, 5);

  const pdf = r.files.find((f) => f.name.endsWith(".pdf"));
  assert.ok(pdf);
  // Tarjeta de 85,6 × 54 mm con 3 mm de sangrado por lado = 91,6 × 60 mm = 259,6 × 170,1 pt.
  const texto = Buffer.from(pdf!.bytes).toString("latin1");
  assert.match(texto, /259\.6\d* 170\.0\d*/);

  const pngFrente = r.files.find((f) => f.name.endsWith("-frente.png"));
  assert.ok(pngFrente && pngFrente.bytes.byteLength > 10000);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/design-studio test`
Expected: FAIL — `Cannot find module '../index'`

- [ ] **Step 3: Implementar `src/index.ts`**

```ts
export { emitDesign, checksumOf } from "./export/emit";
export type {
  EmissionFormat,
  EmittedFile,
  EmitRequest,
  EmitOutcome,
} from "./export/contract";

export { readDesignDocument, migrateDesignDocument, DOCUMENT_MIGRATIONS } from "./document/migrate";
export type { DocumentMigration } from "./document/migrate";
export { DESIGN_SCHEMA_VERSION } from "./document/schema";
export type {
  DesignDocument,
  DesignFormat,
  DesignMedium,
  DesignSide,
  DesignBlock,
  TextBlock,
  QrBlock,
  ImageBlock,
  LineBlock,
  RectBlock,
} from "./document/schema";
export { mmToPt, ptToMm, mmToPx, pxToPt, ptToPx } from "./document/units";

export type {
  VariableContract,
  VariableDeclaration,
  VariableType,
  VariableValues,
  ResolvedVariables,
  DateFormatId,
} from "./variables/contract";
export { resolveVariables, placeholdersOf } from "./variables/resolve";
export { formatDateUtc } from "./variables/dates";

export { validateForPublish } from "./validation/publish";
export type { PublishValidation } from "./validation/publish";
export {
  evaluateQrLegibility,
  MIN_MODULE_MM,
  WARN_MODULE_MM,
  MIN_MODULE_PX,
  WARN_MODULE_PX,
} from "./validation/qr";
export type { QrLegibility, QrLegibilityLevel } from "./validation/qr";

export { FONT_CATALOG, FONT_IDS, isFontId, slotFor } from "./fonts/catalog";
export type { FontId, FontSlot, FontDefinition } from "./fonts/catalog";

export { RENDERER_VERSION } from "./render/version";
export type { ResourceResolver } from "./render/resources";
export { renderSvgPages } from "./render/svg";

export type { Result } from "./result";
export type { TextMeasurer, LayoutPlan, LayoutPage, LayoutItem } from "./layout/plan";
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/design-studio test`
Expected: PASS — 74 tests.

- [ ] **Step 5: Escribir el README**

`packages/design-studio/README.md`:

```markdown
# @repo/design-studio

Diseña, valida y renderiza piezas con datos variables. Devuelve el archivo final.

**No hace:** emitir (a quién y cuándo es del producto), verificar (qué significa "habilitado"
lo sabe la página del QR), ni guardar archivos (eso ya está resuelto en R2).

## Uso

```ts
import { emitDesign } from "@repo/design-studio";

const salida = await emitDesign({
  document: plantillaGuardada,      // el JSON tal como salió de la base
  contract: CONTRATO_DEL_CARNET,
  values: { fullName: "Daniel Cuart", memberNumber: 128, /* … */ },
  formats: ["PDF", "PNG_PER_SIDE"],
  includeBleed: true,
  resources: { read: (ref) => leerDeR2(ref) },
  fileBaseName: `carnet-${numeroDeSocio}`,
});

if (!salida.ok) {
  // Los mensajes están escritos para mostrarlos tal cual.
  return { error: salida.errors.join(" ") };
}
// Guardar cada archivo junto con: salida.rendererVersion, salida.schemaVersion y el checksum.
```

## Las reglas que no se negocian

- **Un dato obligatorio ausente detiene la emisión.** No se emite con el campo vacío.
- **Una versión publicada es inmutable.** Editar produce un borrador; publicar mueve el puntero.
- **Cada emisión guarda con qué se hizo**: versión de plantilla, datos, versión del renderizador,
  formato y checksum. Reproducir una pieza de hace dos años es volver a correr lo mismo.
- **El documento no contiene estructuras del editor.** Cambiar `react-rnd` no migra plantillas.
- **Las fechas se formatean en UTC, sin `Intl`.** Si no, el archivo dependería del servidor.

## Requisitos del entorno

Solo servidor. Lee los `.woff` de `@fontsource` en tiempo de ejecución y usa un binario nativo
para rasterizar (`pdf-to-png-converter`). Cualquier aplicación de Next que lo use tiene que
declararlo en `next.config.ts`: ver la sección correspondiente en el plan
`docs/superpowers/plans/2026-08-26-design-studio-nucleo-de-render.md`.
```

- [ ] **Step 6: Agregar la dependencia en FotoOffice**

En `apps/fotoffice/package.json`, dentro de `dependencies`, en orden alfabético entre
`@repo/db` y `@repo/partners`:

```json
    "@repo/design-studio": "workspace:*",
```

Run: `pnpm install`

- [ ] **Step 7: Declararlo en `apps/fotoffice/next.config.ts`**

Reemplazar las líneas 11 a 20 por:

```ts
  transpilePackages: ["@repo/auth", "@repo/auth-ui", "@repo/payments", "@repo/design-studio"],
  serverExternalPackages: [
    "@prisma/client",
    "@repo/db",
    // Binario nativo: si webpack intenta empaquetarlo, la compilación falla.
    "pdf-to-png-converter",
    "@napi-rs/canvas",
  ],
  outputFileTracingRoot: path.join(appDir, "../.."),
  outputFileTracingIncludes: {
    "/**": [
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/.prisma/client/**",
      "../../node_modules/.pnpm/@prisma+client@*/node_modules/@prisma/client/**",
      "../../packages/db/prisma/**",
      // Las tipografías se abren armando la ruta en tiempo de ejecución, así que el
      // rastreador de Next no las ve y no las copia. Sin esto, en local anda y en Vercel
      // falla al emitir el primer carnet.
      //
      // Se listan las seis familias del catálogo, y solo el subconjunto latino: un patrón
      // abierto sobre @fontsource arrastraría las 20 familias que tiene fotorank en el
      // monorepo —30 MB— a todas las rutas de esta aplicación.
      "../../node_modules/.pnpm/@fontsource+dm-sans@*/node_modules/@fontsource/dm-sans/files/*-latin-*.woff",
      "../../node_modules/.pnpm/@fontsource+inter@*/node_modules/@fontsource/inter/files/*-latin-*.woff",
      "../../node_modules/.pnpm/@fontsource+playfair-display@*/node_modules/@fontsource/playfair-display/files/*-latin-*.woff",
      "../../node_modules/.pnpm/@fontsource+merriweather@*/node_modules/@fontsource/merriweather/files/*-latin-*.woff",
      "../../node_modules/.pnpm/@fontsource+cinzel@*/node_modules/@fontsource/cinzel/files/*-latin-*.woff",
      "../../node_modules/.pnpm/@fontsource+great-vibes@*/node_modules/@fontsource/great-vibes/files/*-latin-*.woff",
    ],
  },
```

- [ ] **Step 8: Verificar que la aplicación sigue compilando**

Run: `pnpm --filter fotoffice build`
Expected: termina sin errores.

- [ ] **Step 9: Verificar empíricamente que las tipografías llegan al paquete**

Una compilación en verde **no alcanza**. Comprobar que los archivos están rastreados:

```bash
grep -c "fontsource" apps/fotoffice/.next/server/app/**/*.nft.json 2>/dev/null | head
find apps/fotoffice/.next -name "*.woff" | head
```

Expected: al menos un `.woff` aparece bajo `.next`, o `fontsource` aparece en algún `.nft.json`.
**Si no aparece nada, no seguir**: ajustar el patrón de `outputFileTracingIncludes` hasta que
aparezca. Es exactamente el error que sacó `/w/sfpr/cursos` de servicio en agosto.

- [ ] **Step 10: Verificar que no se rompió lo que ya andaba**

```bash
pnpm --filter fotoffice test
pnpm --filter @repo/design-studio check-types
pnpm --filter fotoffice exec tsc --noEmit
```

Expected: los tres en verde. Si `tsc` de fotoffice muestra errores, comprobar que existan
**antes** del cambio con `git stash && pnpm --filter fotoffice exec tsc --noEmit && git stash pop`:
en este repositorio hay archivos sin seguimiento de otras ramas que ensucian esa comparación.

- [ ] **Step 11: Commit**

```bash
git add packages/design-studio apps/fotoffice/package.json apps/fotoffice/next.config.ts pnpm-lock.yaml
git commit -m "feat(design-studio): barril publico, documentacion y conexion con FotoOffice"
```

---

## Qué queda listo al terminar

Un producto puede tomar un documento de diseño guardado, entregar los datos de un socio y
recibir el PDF listo para imprimir, los PNG de cada cara y el SVG para la vista digital —con
el checksum y las versiones necesarias para reproducir la pieza dentro de dos años.

Lo que **no** queda listo, y necesita su propio plan:

1. **Persistencia** — `DesignTemplate`, `DesignTemplateVersion` inmutable, `Draft`,
   `PublishedVersion`, `RenderedArtifact`, más propiedad y permisos por workspace.
2. **Congelado de recursos al publicar** — mover una imagen externa a almacenamiento
   administrado. Depende de la persistencia.
3. **Editor** — `react-rnd` encapsulado, panel de capas, avisos de QR y de área segura en vivo.
4. **Carnet de socio** — su propia spec: variables, vigencia de dos años, verificación pública,
   estado en vivo y pago de la deuda desde el carnet digital.

## Riesgos de esta implementación

| Riesgo | Dónde se controla |
|---|---|
| Las tipografías no llegan al paquete desplegado | Task 12, paso 9: verificación empírica, no confianza en la compilación |
| El binario nativo de rasterizado rompe la compilación | Task 12, paso 7: `serverExternalPackages` |
| El PDF deja de ser reproducible | Task 9: fechas fijas y prueba de igualdad byte a byte |
| El corte de líneas difiere entre pantalla e impresión | Task 6 y 10: un solo `LayoutPlan` y un solo medidor |
| Los umbrales del QR resultan mal calibrados | Task 7: constantes con nombre; revisar con una prueba de impresión real |
| Una plantilla vieja deja de abrirse | Task 3: fixture congelado que se lee en cada corrida |
