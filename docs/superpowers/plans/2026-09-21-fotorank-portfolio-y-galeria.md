# Portfolio del jurado y galería para convocar — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un jurado muestre hasta doce fotos de su trabajo, cargue su retrato en el mismo formulario de postulación, y que el organizador lo encuentre viendo su obra, no leyendo su descripción.

**Architecture:** El portfolio reutiliza entero el mecanismo de la foto de perfil, que ya está en producción: bucket privado, hash del contenido en la clave, y una ruta de Next que sirve los bytes. Lo único nuevo es una tabla con orden y el redimensionado en el navegador, que evita depender del CORS del bucket. El directorio no cambia su búsqueda: cambia cómo se ve cada resultado.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions), Prisma 6.19 sobre Neon, TypeScript, `node:test` con `tsx --test`, `canvas` del navegador para redimensionar.

**Spec:** `docs/superpowers/specs/2026-09-21-fotorank-portfolio-y-galeria-de-jurados-design.md`

**Worktree:** `.claude/worktrees/fotorank-portfolio-jurados`, rama `worktree-fotorank-portfolio-jurados`.

**Alcance:** partes A y B del spec. La parte C (cobro por foto) **no se construye**: está bloqueada por la homologación de Mercado Pago.

## Global Constraints

- **Ninguna dependencia nueva.** El lockfile es de toda la suite y agregar un paquete a una app ya rompió el build de otra. El redimensionado usa `canvas`, que trae el navegador.
- **No se usa la subida directa al bucket.** Necesita CORS en `fotorank-private-prod`, pendiente. Todo va por acción de servidor, bajo el tope de 4,5 MB de Vercel.
- **Tope de 12 imágenes por jurado**, controlado en el servidor.
- **Cada borrado toca las dos cosas:** la fila y el objeto del bucket. Un huérfano en R2 se paga y nadie lo nota.
- **Ninguna pantalla muestra palabras de la base.** La prueba `test:judge-sin-enums` ya lo vigila y va a mirar también las pantallas nuevas.
- **La migración se aplica a mano en las 5 bases** y se registra en `_prisma_migrations`. El despliegue no corre `migrate deploy`.
- Piezas existentes que se reutilizan, sin reescribirlas:
  ```ts
  // app/lib/fotorank/judges/judgeAvatar.ts  (puro, seguro en el navegador)
  buildJudgeAvatarKey / parseJudgeAvatarKey / isJudgeAvatarKey
  // app/lib/fotorank/judges/judgeAssetStorage.ts  (servidor)
  saveJudgeAvatar / deleteJudgeAvatarByKey / hashJudgeAvatarContent
  // app/lib/fotorank/storage/provider.ts
  getPrivateContestStorageProvider(): { putObject, deleteObject, readObject, ... }
  // app/components/public-ui
  StatusBadge, EmptyState
  ```

---

### Task 1: Claves y guardado de las imágenes de portfolio

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/judges/portfolioKeys.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/portfolioKeys.test.ts`
- Modify: `apps/fotorank/app/lib/fotorank/judges/judgeAssetStorage.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Consumes: `getPrivateContestStorageProvider()`, `hashJudgeAvatarContent`.
- Produces:
  ```ts
  // portfolioKeys.ts — puro, sin fs ni proveedor: lo puede importar el navegador
  export const PORTFOLIO_MAX_IMAGENES = 12;
  export const PORTFOLIO_MAX_BYTES = 4 * 1024 * 1024;
  export type PortfolioExtension = "jpg" | "png" | "webp";
  export function buildPortfolioKey(judgeAccountId: string, hash: string, ext: PortfolioExtension): string;
  export function parsePortfolioKey(key: string): { judgeAccountId: string; hash: string; ext: string } | null;
  export function extensionForPortfolioMime(mime: string): PortfolioExtension | null;
  export function contentTypeForPortfolioExtension(ext: PortfolioExtension): string;

  // judgeAssetStorage.ts — servidor
  export async function savePortfolioImage(input: { judgeAccountId: string; body: Uint8Array; mime: string }):
    Promise<{ ok: true; key: string; hash: string; ext: PortfolioExtension; sizeBytes: number } | { ok: false; error: string }>;
  export async function deletePortfolioImageByKey(key: string): Promise<void>;
  ```

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/judges/portfolioKeys.test.ts`:

```ts
/**
 * Las claves del portfolio siguen el mismo patrón que las del avatar: el hash
 * del contenido va EN la clave, así la ruta se puede cachear para siempre.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPortfolioKey,
  parsePortfolioKey,
  extensionForPortfolioMime,
  contentTypeForPortfolioExtension,
  PORTFOLIO_MAX_IMAGENES,
  PORTFOLIO_MAX_BYTES,
} from "./portfolioKeys";

test("la clave separa el portfolio del avatar", () => {
  assert.equal(
    buildPortfolioKey("cuenta1", "abc123", "jpg"),
    "fotorank/judges/cuenta1/portfolio/abc123.jpg",
  );
});

test("la clave se puede volver a leer", () => {
  assert.deepEqual(parsePortfolioKey("fotorank/judges/cuenta1/portfolio/abc123.webp"), {
    judgeAccountId: "cuenta1",
    hash: "abc123",
    ext: "webp",
  });
});

test("una clave de avatar NO se acepta como portfolio", () => {
  assert.equal(parsePortfolioKey("fotorank/judges/cuenta1/avatar/abc123.jpg"), null);
});

test("una clave ajena no se interpreta", () => {
  assert.equal(parsePortfolioKey("fotorank/contests/x/entries/y/original"), null);
  assert.equal(parsePortfolioKey("../../etc/passwd"), null);
  assert.equal(parsePortfolioKey(""), null);
});

test("sólo se aceptan los tres formatos de imagen", () => {
  assert.equal(extensionForPortfolioMime("image/jpeg"), "jpg");
  assert.equal(extensionForPortfolioMime("image/png"), "png");
  assert.equal(extensionForPortfolioMime("image/webp"), "webp");
  assert.equal(extensionForPortfolioMime("image/gif"), null);
  assert.equal(extensionForPortfolioMime("application/pdf"), null);
});

test("cada extensión declara su tipo de contenido", () => {
  assert.equal(contentTypeForPortfolioExtension("jpg"), "image/jpeg");
  assert.equal(contentTypeForPortfolioExtension("png"), "image/png");
  assert.equal(contentTypeForPortfolioExtension("webp"), "image/webp");
});

test("los topes son los que dice el diseño", () => {
  assert.equal(PORTFOLIO_MAX_IMAGENES, 12);
  assert.equal(PORTFOLIO_MAX_BYTES, 4 * 1024 * 1024);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/portfolioKeys.test.ts
```
Esperado: FAIL con "Cannot find module './portfolioKeys'".

- [ ] **Step 3: Write portfolioKeys.ts**

```ts
/**
 * Claves de las imágenes de portfolio de un jurado.
 *
 * Módulo puro, igual que judgeAvatar.ts: no toca el disco ni el proveedor de
 * almacenamiento, así que lo puede importar tanto el servidor como una pantalla
 * de cliente.
 */
export const PORTFOLIO_MAX_IMAGENES = 12;

/** Por debajo del tope de 4,5 MB de Vercel para una acción de servidor. */
export const PORTFOLIO_MAX_BYTES = 4 * 1024 * 1024;

export type PortfolioExtension = "jpg" | "png" | "webp";

const MIME_A_EXT: Record<string, PortfolioExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXT_A_MIME: Record<PortfolioExtension, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const CLAVE_RE =
  /^fotorank\/judges\/([A-Za-z0-9_-]+)\/portfolio\/([a-f0-9]+)\.(jpg|png|webp)$/;

export function extensionForPortfolioMime(mime: string): PortfolioExtension | null {
  return MIME_A_EXT[mime.trim().toLowerCase()] ?? null;
}

export function contentTypeForPortfolioExtension(ext: PortfolioExtension): string {
  return EXT_A_MIME[ext];
}

export function buildPortfolioKey(
  judgeAccountId: string,
  hash: string,
  ext: PortfolioExtension,
): string {
  return `fotorank/judges/${judgeAccountId}/portfolio/${hash}.${ext}`;
}

export function parsePortfolioKey(
  key: string,
): { judgeAccountId: string; hash: string; ext: string } | null {
  const m = CLAVE_RE.exec(key);
  if (!m) return null;
  return { judgeAccountId: m[1]!, hash: m[2]!, ext: m[3]! };
}
```

- [ ] **Step 4: Add the save/delete functions**

En `apps/fotorank/app/lib/fotorank/judges/judgeAssetStorage.ts`, agregar al final:

```ts
export async function savePortfolioImage(input: {
  judgeAccountId: string;
  body: Uint8Array;
  mime: string;
}): Promise<
  | { ok: true; key: string; hash: string; ext: PortfolioExtension; sizeBytes: number }
  | { ok: false; error: string }
> {
  const ext = extensionForPortfolioMime(input.mime);
  if (!ext) return { ok: false, error: "Formato no permitido. Usá JPEG, PNG o WebP." };
  if (input.body.length === 0) return { ok: false, error: "El archivo está vacío." };
  if (input.body.length > PORTFOLIO_MAX_BYTES) {
    return { ok: false, error: "La imagen supera los 4 MB incluso después de achicarla." };
  }

  const hash = hashJudgeAvatarContent(input.body);
  const key = buildPortfolioKey(input.judgeAccountId, hash, ext);
  const storage = getPrivateContestStorageProvider();
  await storage.putObject(key, input.body, contentTypeForPortfolioExtension(ext));
  return { ok: true, key, hash, ext, sizeBytes: input.body.length };
}

export async function deletePortfolioImageByKey(key: string): Promise<void> {
  // Una clave que no es de portfolio no se borra: no vaya a ser que llegue
  // acá la de un avatar o la de una obra de concurso.
  if (!parsePortfolioKey(key)) return;
  const storage = getPrivateContestStorageProvider();
  await storage.deleteObject(key);
}
```

Con los imports correspondientes desde `./portfolioKeys`.

- [ ] **Step 5: Run test to verify it passes**

```bash
cd apps/fotorank && pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/portfolioKeys.test.ts
```
Esperado: PASS, 7 pruebas.

- [ ] **Step 6: Register and commit**

En `apps/fotorank/package.json`:
```json
"test:judge-portfolio-keys": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/portfolioKeys.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-portfolio-keys && npx tsc --noEmit
git add apps/fotorank
git commit -m "Guardar las imágenes de portfolio en el bucket, como la foto de perfil

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: El orden de las imágenes

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/judges/portfolioOrder.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/portfolioOrder.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Produces:
  ```ts
  export type ImagenOrdenable = { id: string; sortOrder: number };
  /** Devuelve el orden nuevo completo: [{id, sortOrder}], contiguo desde 0. */
  export function moverImagen(imagenes: ImagenOrdenable[], id: string, hacia: "arriba" | "abajo"): ImagenOrdenable[];
  export function ordenTrasBorrar(imagenes: ImagenOrdenable[], idBorrado: string): ImagenOrdenable[];
  export function ordenParaNueva(imagenes: ImagenOrdenable[]): number;
  ```

- [ ] **Step 1: Write the failing test**

```ts
/**
 * Reordenar parece trivial hasta que quedan huecos, empates o dos imágenes con
 * el mismo número. Entonces la galería se ordena distinto en cada recarga.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { moverImagen, ordenTrasBorrar, ordenParaNueva } from "./portfolioOrder";

const tres = () => [
  { id: "a", sortOrder: 0 },
  { id: "b", sortOrder: 1 },
  { id: "c", sortOrder: 2 },
];

test("subir la del medio la pone primera", () => {
  assert.deepEqual(moverImagen(tres(), "b", "arriba"), [
    { id: "b", sortOrder: 0 },
    { id: "a", sortOrder: 1 },
    { id: "c", sortOrder: 2 },
  ]);
});

test("bajar la del medio la pone última", () => {
  assert.deepEqual(moverImagen(tres(), "b", "abajo"), [
    { id: "a", sortOrder: 0 },
    { id: "c", sortOrder: 1 },
    { id: "b", sortOrder: 2 },
  ]);
});

test("subir la primera no hace nada, y no rompe el orden", () => {
  assert.deepEqual(moverImagen(tres(), "a", "arriba"), tres());
});

test("bajar la última no hace nada", () => {
  assert.deepEqual(moverImagen(tres(), "c", "abajo"), tres());
});

test("mover una que no existe deja todo como estaba", () => {
  assert.deepEqual(moverImagen(tres(), "zzz", "arriba"), tres());
});

test("borrar la del medio no deja huecos", () => {
  assert.deepEqual(ordenTrasBorrar(tres(), "b"), [
    { id: "a", sortOrder: 0 },
    { id: "c", sortOrder: 1 },
  ]);
});

test("un orden desordenado o con empates se normaliza", () => {
  const roto = [
    { id: "a", sortOrder: 5 },
    { id: "b", sortOrder: 5 },
    { id: "c", sortOrder: 0 },
  ];
  const arreglado = moverImagen(roto, "c", "abajo");
  assert.deepEqual(
    arreglado.map((i) => i.sortOrder),
    [0, 1, 2],
    "los números tienen que quedar contiguos desde 0",
  );
});

test("una imagen nueva va al final", () => {
  assert.equal(ordenParaNueva(tres()), 3);
  assert.equal(ordenParaNueva([]), 0);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/portfolioOrder.test.ts
```
Esperado: FAIL, módulo inexistente.

- [ ] **Step 3: Write the implementation**

`portfolioOrder.ts`: ordena por `sortOrder` y después por `id` (para que un empate se resuelva siempre igual), aplica el movimiento con un intercambio de posiciones, y **renumera desde 0 de forma contigua** antes de devolver. `ordenTrasBorrar` saca el elemento y renumera. `ordenParaNueva` devuelve la cantidad actual.

- [ ] **Step 4: Run test to verify it passes**

Esperado: PASS, 8 pruebas.

- [ ] **Step 5: Register and commit**

```json
"test:judge-portfolio-order": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/portfolioOrder.test.ts",
```

```bash
git commit -m "Ordenar el portfolio sin huecos ni empates

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: La migración

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/20260921120000_fotorank_judge_portfolio/migration.sql`
- Modify: `docs/fotorank/migracion-alta-jurados.md` (sumar esta migración)

- [ ] **Step 1: Add the model to the schema**

En `packages/db/prisma/schema.prisma`, después de `model FotorankJudgeProfile`:

```prisma
model FotorankJudgePortfolioImage {
  id             String   @id @default(cuid())
  judgeProfileId String
  storageKey     String
  /// Va en la URL pública: si cambia la imagen, cambia la ruta.
  contentHash    String
  contentType    String
  sizeBytes      Int
  width          Int?
  height         Int?
  title          String?
  sortOrder      Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  judgeProfile FotorankJudgeProfile @relation(fields: [judgeProfileId], references: [id], onDelete: Cascade)

  @@index([judgeProfileId, sortOrder])
}
```

Y en `model FotorankJudgeProfile`, la relación inversa:
```prisma
  portfolioImages FotorankJudgePortfolioImage[]
```

- [ ] **Step 2: Write the migration SQL**

`packages/db/prisma/migrations/20260921120000_fotorank_judge_portfolio/migration.sql`:

```sql
-- El portfolio del jurado: hasta 12 imágenes por ficha.
--
-- No toca ninguna tabla existente: sólo agrega. Es la migración más segura
-- posible de este módulo.

CREATE TABLE "FotorankJudgePortfolioImage" (
  "id"             TEXT NOT NULL,
  "judgeProfileId" TEXT NOT NULL,
  "storageKey"     TEXT NOT NULL,
  "contentHash"    TEXT NOT NULL,
  "contentType"    TEXT NOT NULL,
  "sizeBytes"      INTEGER NOT NULL,
  "width"          INTEGER,
  "height"         INTEGER,
  "title"          TEXT,
  "sortOrder"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "FotorankJudgePortfolioImage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FotorankJudgePortfolioImage_judgeProfileId_sortOrder_idx"
  ON "FotorankJudgePortfolioImage"("judgeProfileId", "sortOrder");

ALTER TABLE "FotorankJudgePortfolioImage"
  ADD CONSTRAINT "FotorankJudgePortfolioImage_judgeProfileId_fkey"
  FOREIGN KEY ("judgeProfileId") REFERENCES "FotorankJudgeProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
```

- [ ] **Step 3: Verify the schema and client**

```bash
cd packages/db && npx prisma format && npx prisma generate
cd ../../apps/fotorank && npx tsc --noEmit
```
Esperado: cliente generado, 0 errores de tipos.

Comprobar que ningún campo existente se perdió, comparando los campos del modelo antes y después con `git show HEAD:packages/db/prisma/schema.prisma`.

- [ ] **Step 4: Commit (sin aplicar todavía)**

La migración se aplica en la Task 9, cuando el código esté listo.

```bash
git add packages/db docs
git commit -m "Agregar la tabla del portfolio del jurado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: La ruta que sirve las imágenes

**Files:**
- Create: `apps/fotorank/app/api/jurados/portfolio/[imageId]/[hash]/route.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/portfolioSrc.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/portfolioSrc.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function portfolioImageSrc(img: { id: string; contentHash: string; storageKey: string }): string | null;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { portfolioImageSrc } from "./portfolioSrc";

test("arma la ruta con el id y el hash", () => {
  assert.equal(
    portfolioImageSrc({
      id: "img1",
      contentHash: "abc123",
      storageKey: "fotorank/judges/c1/portfolio/abc123.jpg",
    }),
    "/api/jurados/portfolio/img1/abc123.jpg",
  );
});

test("una clave que no es de portfolio no se sirve", () => {
  assert.equal(
    portfolioImageSrc({
      id: "img1",
      contentHash: "abc123",
      storageKey: "fotorank/judges/c1/avatar/abc123.jpg",
    }),
    null,
  );
});

test("sin clave no hay ruta", () => {
  assert.equal(portfolioImageSrc({ id: "img1", contentHash: "abc", storageKey: "" }), null);
});
```

- [ ] **Step 2: Run to verify it fails, then implement**

`portfolioSrc.ts` usa `parsePortfolioKey` y devuelve `/api/jurados/portfolio/<id>/<hash>.<ext>`, o `null` si la clave no es de portfolio.

- [ ] **Step 3: Write the route**

`apps/fotorank/app/api/jurados/portfolio/[imageId]/[hash]/route.ts`, copiando la estructura de la ruta del avatar que ya existe (`app/api/jurados/avatar/[judgeProfileId]/[hash]/route.ts`):

1. Buscar la fila por `imageId`, trayendo `storageKey`, `contentHash` y `contentType`.
2. Si no existe → 404.
3. Comparar el hash pedido (sin la extensión) con `contentHash`; si no coincide → 404.
4. Leer los bytes con `readObject` y devolverlos con `Cache-Control: public, max-age=31536000, immutable`.

- [ ] **Step 4: Verify and commit**

```bash
cd apps/fotorank && pnpm test:judge-portfolio-src && npx tsc --noEmit
git commit -m "Servir las imágenes de portfolio con cache larga

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Las acciones del jurado sobre su portfolio

**Files:**
- Create: `apps/fotorank/app/actions/judgePortfolio.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Consumes: `requireJudgeAuth()`, `savePortfolioImage`, `deletePortfolioImageByKey`, `moverImagen`, `ordenTrasBorrar`, `ordenParaNueva`, `PORTFOLIO_MAX_IMAGENES`.
- Produces:
  ```ts
  export type ResultadoPortfolio<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
  export async function subirImagenDePortfolioAction(formData: FormData): Promise<ResultadoPortfolio<{ id: string; src: string }>>;
  export async function borrarImagenDePortfolioAction(imageId: string): Promise<ResultadoPortfolio>;
  export async function moverImagenDePortfolioAction(imageId: string, hacia: "arriba" | "abajo"): Promise<ResultadoPortfolio>;
  export async function ponerTituloAImagenAction(imageId: string, titulo: string): Promise<ResultadoPortfolio>;
  ```

- [ ] **Step 1: Write the actions**

Reglas que cada una tiene que cumplir:

- **Todas** empiezan por `requireJudgeAuth()` y **verifican que la imagen sea del jurado que la pide**. Sin eso, cualquier jurado borra las fotos de otro con sólo saber el id.
- `subirImagenDePortfolioAction`: cuenta las que ya hay; si llegó a `PORTFOLIO_MAX_IMAGENES`, devuelve *"Llegaste al máximo de 12 imágenes. Borrá alguna para subir otra."* y **no toca el bucket**. Guarda primero el archivo, después la fila; si la fila falla, borra el archivo recién subido.
- `borrarImagenDePortfolioAction`: borra la fila y el objeto, y renumera el resto con `ordenTrasBorrar`.
- `moverImagenDePortfolioAction`: aplica `moverImagen` y escribe el orden nuevo completo en una transacción.
- `ponerTituloAImagenAction`: recorta a 120 caracteres; vacío guarda `null`.
- Todas revalidan `/jurado/perfil`, la página pública del jurado y `/jurados/directorio`.

- [ ] **Step 2: Verify types and commit**

```bash
cd apps/fotorank && npx tsc --noEmit && pnpm lint
git commit -m "Dejar que el jurado suba, ordene y borre su portfolio

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: El redimensionado en el navegador

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/judges/ui/achicarImagen.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/ui/achicarImagen.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const LADO_LARGO_MAXIMO = 2000;
  export const CALIDAD_JPEG = 0.85;
  /** Calcula el tamaño de destino respetando la proporción. Puro: se puede probar. */
  export function medidasDeDestino(ancho: number, alto: number): { ancho: number; alto: number };
  /** Usa canvas. Si algo falla devuelve el archivo original, no rompe. */
  export async function achicarImagen(archivo: File): Promise<File>;
  ```

- [ ] **Step 1: Write the failing test**

La parte probable sin navegador es el cálculo de medidas:

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { medidasDeDestino, LADO_LARGO_MAXIMO } from "./achicarImagen";

test("una foto chica no se agranda", () => {
  assert.deepEqual(medidasDeDestino(800, 600), { ancho: 800, alto: 600 });
});

test("una apaisada se achica por el ancho", () => {
  assert.deepEqual(medidasDeDestino(6000, 4000), { ancho: 2000, alto: 1333 });
});

test("una vertical se achica por el alto", () => {
  assert.deepEqual(medidasDeDestino(4000, 6000), { ancho: 1333, alto: 2000 });
});

test("una cuadrada queda cuadrada", () => {
  assert.deepEqual(medidasDeDestino(5000, 5000), {
    ancho: LADO_LARGO_MAXIMO,
    alto: LADO_LARGO_MAXIMO,
  });
});

test("una panorámica extrema no queda con altura cero", () => {
  const m = medidasDeDestino(12000, 300);
  assert.equal(m.ancho, 2000);
  assert.ok(m.alto >= 1, "el alto mínimo es 1 píxel");
});

test("medidas inválidas no rompen", () => {
  assert.deepEqual(medidasDeDestino(0, 0), { ancho: 0, alto: 0 });
});
```

- [ ] **Step 2: Implement**

`medidasDeDestino` es aritmética pura. `achicarImagen` usa `createImageBitmap` + `canvas` + `toBlob`, y **envuelve todo en try/catch: si el navegador no puede, devuelve el archivo original**. El servidor lo rechazará con un mensaje claro si excede el tope, que es mejor que romper la pantalla.

- [ ] **Step 3: Register, verify and commit**

```json
"test:judge-achicar-imagen": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/ui/achicarImagen.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-achicar-imagen && npx tsc --noEmit
git commit -m "Achicar las fotos en el navegador antes de subirlas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: La sección de portfolio en el perfil del jurado

**Files:**
- Create: `apps/fotorank/app/jurado/perfil/PortfolioDelJurado.tsx`
- Modify: `apps/fotorank/app/jurado/perfil/page.tsx`

**Interfaces:**
- Consumes: las cuatro acciones de la Task 5, `achicarImagen`, `portfolioImageSrc`, `PORTFOLIO_MAX_IMAGENES`.

- [ ] **Step 1: Write the component**

Debajo de `FotoDePerfil`, una sección con:

- Título *"Tu portfolio"* y la cuenta: *"3 de 12 imágenes"*.
- Un `<input type="file" multiple accept="image/jpeg,image/png,image/webp">`. Cada archivo pasa por `achicarImagen` antes de enviarse, **de a uno**, mostrando cuál va.
- Cada imagen: miniatura, campo de título, flechas de subir y bajar, y borrar.
- La primera tiene su flecha de subir deshabilitada; la última, la de bajar.
- Cuando no hay ninguna: *"Todavía no subiste ninguna foto. Las que subas se ven en tu página pública y ayudan a que te convoquen."*
- Al llegar a 12: el selector se deshabilita y aparece *"Llegaste al máximo. Borrá alguna para subir otra."*

- [ ] **Step 2: Mount it in the page**

`page.tsx` trae las imágenes ordenadas por `sortOrder` y se las pasa al componente con su `src` ya calculado.

- [ ] **Step 3: Verify and commit**

```bash
cd apps/fotorank && npx tsc --noEmit && pnpm lint && pnpm test:judge-sin-enums
git commit -m "Cargar y ordenar el portfolio desde el perfil del jurado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: La foto en el formulario de postulación

**Files:**
- Modify: `apps/fotorank/app/jurados/postulacion/PostulacionForm.tsx`
- Modify: `apps/fotorank/app/actions/judgePublicSignup.ts`

- [ ] **Step 1: Add the field to the form**

En la sección "Quién sos", un campo de foto opcional, con vista previa. El archivo pasa por `achicarImagen` antes de enviarse.

- [ ] **Step 2: Save it after creating the account**

En `postularseComoJuradoAction`, después de crear la cuenta y **antes** de encolar el correo:

```ts
  const foto = fd.get("foto");
  if (foto && typeof foto === "object" && "arrayBuffer" in foto && (foto as File).size > 0) {
    try {
      const f = foto as File;
      const guardada = await saveJudgeAvatar({
        judgeAccountId: cuenta.id,
        body: new Uint8Array(await f.arrayBuffer()),
        mime: f.type || "",
      });
      if (guardada.ok) {
        await prisma.fotorankJudgeProfile.update({
          where: { judgeAccountId: cuenta.id },
          data: { avatarUrl: guardada.key },
        });
      }
    } catch (err) {
      // La cuenta ya está creada: perderla por una imagen sería peor que la
      // imagen. Queda sin foto y el panel se lo dice.
      console.warn("[postulacion de jurado] la foto no se pudo guardar", err);
    }
  }
```

- [ ] **Step 3: Verify and commit**

```bash
cd apps/fotorank && npx tsc --noEmit && pnpm lint && pnpm test:judge-public-signup
git commit -m "Subir la foto de perfil en el mismo formulario de postulación

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: El portfolio en la página pública y en el directorio

**Files:**
- Modify: `apps/fotorank/app/actions/judges.ts` (`getJudgePublicProfile`)
- Modify: `apps/fotorank/app/jurados/publico/[publicSlug]/page.tsx`
- Modify: `apps/fotorank/app/lib/fotorank/judges/professionalDirectory.ts`
- Modify: `apps/fotorank/app/(dashboard)/jurados/directorio/DirectorioJuradosClient.tsx`
- Modify: `apps/fotorank/app/(dashboard)/jurados/directorio/[judgeId]/page.tsx`
- Create: `apps/fotorank/app/lib/fotorank/judges/fichaCompleta.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/fichaCompleta.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export const PUNTAJE_MAXIMO = 6;
  export function puntajeDeFicha(p: {
    tieneFoto: boolean; cantidadDePortfolio: number; titular: string | null;
    bio: string | null; aniosDeExperiencia: number | null; especialidades: string[];
  }): number;
  ```

- [ ] **Step 1: Write the failing test for the score**

```ts
import assert from "node:assert/strict";
import test from "node:test";

import { puntajeDeFicha, PUNTAJE_MAXIMO } from "./fichaCompleta";

const vacia = {
  tieneFoto: false, cantidadDePortfolio: 0, titular: null,
  bio: null, aniosDeExperiencia: null, especialidades: [] as string[],
};
const completa = {
  tieneFoto: true, cantidadDePortfolio: 3, titular: "Fotógrafa documental",
  bio: "a".repeat(120), aniosDeExperiencia: 10, especialidades: ["documental"],
};

test("una ficha vacía no suma nada", () => {
  assert.equal(puntajeDeFicha(vacia), 0);
});

test("una ficha completa llega al máximo", () => {
  assert.equal(puntajeDeFicha(completa), PUNTAJE_MAXIMO);
  assert.equal(PUNTAJE_MAXIMO, 6);
});

test("con menos de tres fotos el portfolio no suma", () => {
  assert.equal(puntajeDeFicha({ ...completa, cantidadDePortfolio: 2 }), PUNTAJE_MAXIMO - 1);
  assert.equal(puntajeDeFicha({ ...completa, cantidadDePortfolio: 3 }), PUNTAJE_MAXIMO);
});

test("una bio corta no suma", () => {
  assert.equal(puntajeDeFicha({ ...completa, bio: "Soy fotógrafa." }), PUNTAJE_MAXIMO - 1);
});

test("cero años de experiencia SÍ suma: es un dato declarado", () => {
  assert.equal(puntajeDeFicha({ ...completa, aniosDeExperiencia: 0 }), PUNTAJE_MAXIMO);
  assert.equal(puntajeDeFicha({ ...completa, aniosDeExperiencia: null }), PUNTAJE_MAXIMO - 1);
});

test("un titular en blanco no suma", () => {
  assert.equal(puntajeDeFicha({ ...completa, titular: "   " }), PUNTAJE_MAXIMO - 1);
});
```

- [ ] **Step 2: Implement and run**

Esperado: PASS, 6 pruebas.

- [ ] **Step 3: Show the portfolio on the public page**

`getJudgePublicProfile` trae `portfolioImages` ordenadas y devuelve su `src` ya armado. La página muestra la galería completa debajo de la bio. Sin imágenes, no se dibuja nada.

- [ ] **Step 4: Show the strip in the directory**

`professionalDirectory.ts` trae **las tres primeras** imágenes de cada jurado (`take: 3`, ordenadas por `sortOrder`) y calcula `puntajeDeFicha`. La lista ordena por puntaje descendente y, a igual puntaje, por más reciente.

`DirectorioJuradosClient.tsx` muestra la tira de tres bajo el retrato. Un jurado sin portfolio se ve como hoy, sin marcos vacíos.

La ficha (`[judgeId]/page.tsx`) muestra la galería completa.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/fotorank && pnpm test:judge-ficha-completa && npx tsc --noEmit && pnpm lint
git commit -m "Mostrar el portfolio en la página pública y en el directorio

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Migración, verificación y despliegue

- [ ] **Step 1: Run the whole suite**

```bash
cd apps/fotorank
for s in test:judge-portfolio-keys test:judge-portfolio-order test:judge-portfolio-src \
         test:judge-achicar-imagen test:judge-ficha-completa test:judge-status-ui \
         test:judge-tiempo-relativo test:judge-sin-enums test:judge-assets \
         test:judge-avatar-src test:judge-directory-review test:judge-public-signup \
         test:judge-email-verification test:judge-emails test:judge-signup-rate-limit \
         test:judge-public-visibility test:judge-other-links test:judges-section-layout \
         test:judge-invite-acceptance; do
  printf "%-32s " "$s"; pnpm $s 2>&1 | grep -E "^ℹ (pass|fail)" | tr '\n' ' '; echo
done
npx tsc --noEmit && pnpm lint
```
Esperado: todas en verde, 0 errores de tipos, el lint sin avisos nuevos respecto del baseline.

- [ ] **Step 2: Test the migration on a throwaway Neon branch**

Crear una rama descartable desde `development`, aplicar el SQL y verificar:

```sql
SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'FotorankJudgePortfolioImage';  -- 1
SELECT COUNT(*) FROM pg_indexes WHERE indexname = 'FotorankJudgePortfolioImage_judgeProfileId_sortOrder_idx';  -- 1
```

Después **borrar la rama**.

- [ ] **Step 3: Apply to the five databases**

Siguiendo `docs/fotorank/migracion-alta-jurados.md`: FotoRank/FOTOFFICE (`divine-hall-10689679` / `development`), CompraMeLaFoto (mismo proyecto / `production`), Clickatón (`bitter-math-56019731`), InfoSpot (`wandering-pine-79918137`) y DNX Suite staging (`fragrant-union-80829821`). Registrar en `_prisma_migrations` con el checksum del archivo.

- [ ] **Step 4: End-to-end in a real browser**

Levantar la aplicación y recorrer: subir tres fotos, ponerles título, reordenarlas, borrar una, y comprobar que la página pública y el directorio reflejan el orden.

- [ ] **Step 5: Open the pull request**

Con la tabla de verificación real y las bases donde se aplicó la migración.

---

## Self-review

**Cobertura del spec:**

| Sección | Tarea |
|---|---|
| 4.1 foto en el formulario de alta | 8 |
| 4.2 redimensionado en el navegador | 6 |
| 4.3 el modelo y el tope de 12 | 3, 5 |
| 4.4 cómo se sirven | 4 |
| 4.5 cargar, titular, ordenar, borrar | 2, 5, 7 |
| 4.6 dónde se ven | 7, 9 |
| 5.1 la tarjeta del directorio | 9 |
| 5.2 el orden por ficha completa | 9 |
| 7 migración en las cinco bases | 3, 10 |
| 8 pruebas | cada tarea; de punta a punta en 10 |

La parte C del spec (cobro por foto) **no tiene tareas a propósito**: está bloqueada por la homologación de Mercado Pago.

**Consistencia de tipos:** `PortfolioExtension` se define en `portfolioKeys.ts` (Task 1) y lo usan las tareas 1, 4 y 5. `portfolioImageSrc` se define en la Task 4 y lo usan la 7 y la 9. `puntajeDeFicha` se define en la 9 y sólo la usa ella.
