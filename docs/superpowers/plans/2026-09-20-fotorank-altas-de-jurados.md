# Altas de jurados de FotoRank — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un fotógrafo pueda presentarse solo como jurado, cargar toda su información, y que aparezca presentado en cada concurso donde fue confirmado.

**Architecture:** Se apoya en el módulo de jurados que ya existe. Tres cambios de fondo: la foto deja el disco del servidor y va al bucket privado que FotoRank ya usa; se agrega una puerta de entrada pública con revisión previa de DNX; y el perfil del jurado gana los campos que hoy sólo puede cargar el organizador. La visibilidad pasa a depender de un estado de revisión, separado de la capacidad de entrar.

**Tech Stack:** Next.js 16.2 (App Router, Server Actions), Prisma 6.19 sobre Neon, TypeScript, `node:test` corrido con `tsx --test`, Playwright para punta a punta, Resend por el outbox propio.

**Spec:** `docs/superpowers/specs/2026-09-20-fotorank-altas-de-jurados-y-ux-design.md`

**Worktree:** `/Users/danielcuart/Desktop/PROGRAMACIONES/dnx-jurado-unico`, rama `feat/jurado-unico-dos-plataformas` (o una rama hija).

## Global Constraints

- **Ninguna pantalla muestra palabras de la base de datos.** Todo estado se traduce al castellano antes de renderizarse.
- **No se crea un bucket nuevo ni se toca CORS.** Todo va por `getPrivateContestStorageProvider()`.
- **La foto tiene tope de 2 MB** y admite sólo `image/jpeg`, `image/png`, `image/webp`.
- **El teléfono no se muestra nunca en público.** Sólo a organizadores.
- **La migración se aplica a mano en las 5 bases Neon** del schema compartido y se registra en `_prisma_migrations` con el checksum de una base sana. El despliegue no corre `prisma migrate deploy`.
- **Las filas preexistentes quedan `APPROVED`** y con `signupSource = ORGANIZER_CREATED`.
- **Sin las variables del jurado único, todo sigue funcionando** como hoy: `getClickatonJuryPrisma()` devuelve `null` y no se rompe nada.
- **Cada prueba nueva se registra como script** en `apps/fotorank/package.json`, siguiendo el patrón `test:<area>`.
- Interfaz del almacenamiento, ya existente en `app/lib/fotorank/storage/contest-entry-storage.ts`:
  ```ts
  type ContestEntryStorageAdapter = {
    putObject(key: string, body: Uint8Array, contentType: string): Promise<void>;
    getSignedUrl(key: string, purpose: "read" | "write", expiresInSeconds: number): Promise<string>;
    deleteObject(key: string): Promise<void>;
  };
  type PrivateContestStorageProvider = ContestEntryStorageAdapter & {
    streamObject?(key: string): Promise<ReadableStream<Uint8Array> | NodeJS.ReadableStream | null>;
  };
  ```

---

## Etapa A — Cimientos

### Task 1: Claves y guardado de la foto en el bucket privado

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/judges/judgeAssetStorage.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/judgeAssetStorage.test.ts`
- Modify: `apps/fotorank/package.json` (agregar script `test:judge-assets`)

**Interfaces:**
- Consumes: `getPrivateContestStorageProvider()` de `app/lib/fotorank/storage/provider.ts`.
- Produces:
  ```ts
  export function buildJudgeAvatarKey(judgeAccountId: string, hash: string, ext: JudgeAvatarExtension): string;
  export function parseJudgeAvatarKey(key: string): { judgeAccountId: string; hash: string; ext: string } | null;
  export function hashJudgeAvatarContent(body: Uint8Array): string;
  export type JudgeAvatarExtension = "jpg" | "png" | "webp";
  export function extensionForJudgeAvatarMime(mime: string): JudgeAvatarExtension | null;
  export function contentTypeForJudgeAvatarExtension(ext: JudgeAvatarExtension): string;
  export async function saveJudgeAvatar(input: { judgeAccountId: string; body: Uint8Array; mime: string }): Promise<{ ok: true; key: string } | { ok: false; error: string }>;
  export async function deleteJudgeAvatarByKey(key: string): Promise<void>;
  ```

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/judges/judgeAssetStorage.test.ts`:

```ts
/**
 * La clave lleva el hash del contenido: al cambiar la foto cambia la URL y
 * ningún navegador se queda con la anterior.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJudgeAvatarKey,
  parseJudgeAvatarKey,
  hashJudgeAvatarContent,
  extensionForJudgeAvatarMime,
  contentTypeForJudgeAvatarExtension,
} from "./judgeAssetStorage";

test("la clave incluye la cuenta, el hash y la extensión", () => {
  assert.equal(
    buildJudgeAvatarKey("cuenta123", "abc123", "jpg"),
    "fotorank/judges/cuenta123/avatar/abc123.jpg",
  );
});

test("la clave se puede volver a leer", () => {
  const key = buildJudgeAvatarKey("cuenta123", "abc123", "webp");
  assert.deepEqual(parseJudgeAvatarKey(key), {
    judgeAccountId: "cuenta123",
    hash: "abc123",
    ext: "webp",
  });
});

test("una clave ajena no se interpreta como avatar de jurado", () => {
  assert.equal(parseJudgeAvatarKey("fotorank/entries/x/original.jpg"), null);
  assert.equal(parseJudgeAvatarKey("../../etc/passwd"), null);
});

test("el mismo contenido da el mismo hash y otro contenido da otro", () => {
  const a = hashJudgeAvatarContent(new Uint8Array([1, 2, 3]));
  const b = hashJudgeAvatarContent(new Uint8Array([1, 2, 3]));
  const c = hashJudgeAvatarContent(new Uint8Array([1, 2, 4]));
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("sólo se aceptan los tres formatos de imagen", () => {
  assert.equal(extensionForJudgeAvatarMime("image/jpeg"), "jpg");
  assert.equal(extensionForJudgeAvatarMime("image/png"), "png");
  assert.equal(extensionForJudgeAvatarMime("image/webp"), "webp");
  assert.equal(extensionForJudgeAvatarMime("image/gif"), null);
  assert.equal(extensionForJudgeAvatarMime(""), null);
});

test("cada extensión declara su tipo de contenido", () => {
  assert.equal(contentTypeForJudgeAvatarExtension("jpg"), "image/jpeg");
  assert.equal(contentTypeForJudgeAvatarExtension("png"), "image/png");
  assert.equal(contentTypeForJudgeAvatarExtension("webp"), "image/webp");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/judgeAssetStorage.test.ts
```

Esperado: FAIL con "Cannot find module './judgeAssetStorage'".

- [ ] **Step 3: Write minimal implementation**

Crear `apps/fotorank/app/lib/fotorank/judges/judgeAssetStorage.ts`:

```ts
/**
 * Almacenamiento de la foto del jurado en el bucket privado de FotoRank.
 *
 * Reemplaza a judgeAvatarStorage.ts, que escribía en el disco del servidor:
 * en Vercel ese disco se borra en cada despliegue.
 *
 * El hash del contenido va EN LA CLAVE: al cambiar la foto cambia la URL, así
 * que la ruta se puede cachear sin miedo a que quede pegada la anterior.
 */
import { createHash } from "node:crypto";

import { getPrivateContestStorageProvider } from "../storage/provider";

export type JudgeAvatarExtension = "jpg" | "png" | "webp";

export const JUDGE_AVATAR_MAX_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, JudgeAvatarExtension> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const EXT_TO_MIME: Record<JudgeAvatarExtension, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const KEY_RE = /^fotorank\/judges\/([A-Za-z0-9_-]+)\/avatar\/([a-f0-9]+)\.(jpg|png|webp)$/;

export function extensionForJudgeAvatarMime(mime: string): JudgeAvatarExtension | null {
  return MIME_TO_EXT[mime.trim().toLowerCase()] ?? null;
}

export function contentTypeForJudgeAvatarExtension(ext: JudgeAvatarExtension): string {
  return EXT_TO_MIME[ext];
}

export function hashJudgeAvatarContent(body: Uint8Array): string {
  return createHash("sha256").update(body).digest("hex").slice(0, 32);
}

export function buildJudgeAvatarKey(
  judgeAccountId: string,
  hash: string,
  ext: JudgeAvatarExtension,
): string {
  return `fotorank/judges/${judgeAccountId}/avatar/${hash}.${ext}`;
}

export function parseJudgeAvatarKey(
  key: string,
): { judgeAccountId: string; hash: string; ext: string } | null {
  const m = KEY_RE.exec(key);
  if (!m) return null;
  return { judgeAccountId: m[1]!, hash: m[2]!, ext: m[3]! };
}

export async function saveJudgeAvatar(input: {
  judgeAccountId: string;
  body: Uint8Array;
  mime: string;
}): Promise<{ ok: true; key: string } | { ok: false; error: string }> {
  const ext = extensionForJudgeAvatarMime(input.mime);
  if (!ext) return { ok: false, error: "Formato no permitido. Usá JPEG, PNG o WebP." };
  if (input.body.length > JUDGE_AVATAR_MAX_BYTES) {
    return { ok: false, error: "La imagen supera los 2 MB." };
  }
  if (input.body.length === 0) return { ok: false, error: "El archivo está vacío." };

  const hash = hashJudgeAvatarContent(input.body);
  const key = buildJudgeAvatarKey(input.judgeAccountId, hash, ext);
  const storage = getPrivateContestStorageProvider();
  await storage.putObject(key, input.body, contentTypeForJudgeAvatarExtension(ext));
  return { ok: true, key };
}

export async function deleteJudgeAvatarByKey(key: string): Promise<void> {
  if (!parseJudgeAvatarKey(key)) return;
  const storage = getPrivateContestStorageProvider();
  await storage.deleteObject(key);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/judgeAssetStorage.test.ts
```

Esperado: PASS, 6 pruebas.

- [ ] **Step 5: Register the test script**

En `apps/fotorank/package.json`, dentro de `"scripts"`, agregar:

```json
"test:judge-assets": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/judgeAssetStorage.test.ts",
```

Verificar: `cd apps/fotorank && pnpm test:judge-assets` → PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotorank/app/lib/fotorank/judges/judgeAssetStorage.ts \
        apps/fotorank/app/lib/fotorank/judges/judgeAssetStorage.test.ts \
        apps/fotorank/package.json
git commit -m "Guardar la foto del jurado en el bucket, no en el disco del servidor

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: La ruta que sirve la foto y el helper de la pantalla

**Files:**
- Create: `apps/fotorank/app/api/jurados/avatar/[judgeProfileId]/[hash]/route.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/judgeAvatarSrc.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/judgeAvatarSrc.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Consumes: `parseJudgeAvatarKey`, `contentTypeForJudgeAvatarExtension` de la Task 1.
- Produces:
  ```ts
  export function judgeAvatarSrc(profile: { id: string; avatarUrl: string | null }): string | null;
  ```
  Devuelve `/api/jurados/avatar/<profileId>/<hash>.<ext>` cuando `avatarUrl` es una clave del bucket, la propia `avatarUrl` cuando es una URL externa (`http://` o `https://`), y `null` cuando no hay foto.

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/judges/judgeAvatarSrc.test.ts`:

```ts
/**
 * avatarUrl pasó a guardar la clave del bucket. La pantalla nunca arma esa
 * ruta a mano: si lo hiciera, cada lugar la armaría distinto.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { judgeAvatarSrc } from "./judgeAvatarSrc";

test("una clave del bucket se sirve por la ruta propia", () => {
  assert.equal(
    judgeAvatarSrc({ id: "perfil1", avatarUrl: "fotorank/judges/cuenta1/avatar/abc123.jpg" }),
    "/api/jurados/avatar/perfil1/abc123.jpg",
  );
});

test("sin foto devuelve null", () => {
  assert.equal(judgeAvatarSrc({ id: "perfil1", avatarUrl: null }), null);
  assert.equal(judgeAvatarSrc({ id: "perfil1", avatarUrl: "   " }), null);
});

test("una URL externa se respeta tal cual", () => {
  assert.equal(
    judgeAvatarSrc({ id: "perfil1", avatarUrl: "https://ejemplo.com/foto.jpg" }),
    "https://ejemplo.com/foto.jpg",
  );
});

test("una clave que no es de avatar de jurado no se sirve", () => {
  assert.equal(judgeAvatarSrc({ id: "perfil1", avatarUrl: "fotorank/entries/x/original.jpg" }), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/judgeAvatarSrc.test.ts
```

Esperado: FAIL con "Cannot find module './judgeAvatarSrc'".

- [ ] **Step 3: Write minimal implementation**

Crear `apps/fotorank/app/lib/fotorank/judges/judgeAvatarSrc.ts`:

```ts
/**
 * Única forma de armar el src de la foto de un jurado. No duplicar en pantallas.
 */
import { parseJudgeAvatarKey } from "./judgeAssetStorage";

export function judgeAvatarSrc(profile: { id: string; avatarUrl: string | null }): string | null {
  const raw = profile.avatarUrl?.trim();
  if (!raw) return null;
  if (raw.startsWith("https://") || raw.startsWith("http://")) return raw;
  const parsed = parseJudgeAvatarKey(raw);
  if (!parsed) return null;
  return `/api/jurados/avatar/${profile.id}/${parsed.hash}.${parsed.ext}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/judgeAvatarSrc.test.ts
```

Esperado: PASS, 4 pruebas.

- [ ] **Step 5: Write the route**

Crear `apps/fotorank/app/api/jurados/avatar/[judgeProfileId]/[hash]/route.ts`:

```ts
/**
 * Sirve la foto del jurado desde el bucket privado.
 *
 * La foto de un perfil es pública por naturaleza (se muestra en la landing del
 * concurso), pero el archivo vive en el bucket privado: la ruta es la que
 * decide qué se entrega, y sólo entrega la clave que ese perfil tiene guardada.
 */
import { prisma } from "@repo/db";

import {
  contentTypeForJudgeAvatarExtension,
  parseJudgeAvatarKey,
  type JudgeAvatarExtension,
} from "../../../../../lib/fotorank/judges/judgeAssetStorage";
import { getPrivateContestStorageProvider } from "../../../../../lib/fotorank/storage/provider";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ judgeProfileId: string; hash: string }> },
) {
  const { judgeProfileId, hash } = await params;

  const profile = await prisma.fotorankJudgeProfile.findUnique({
    where: { id: judgeProfileId },
    select: { avatarUrl: true },
  });
  if (!profile?.avatarUrl) return new Response("No encontrada", { status: 404 });

  const parsed = parseJudgeAvatarKey(profile.avatarUrl);
  if (!parsed) return new Response("No encontrada", { status: 404 });

  // El hash pedido tiene que ser el que este perfil tiene guardado: así una
  // URL vieja no sirve una foto nueva ni al revés.
  const pedido = hash.replace(/\.(jpg|png|webp)$/, "");
  if (pedido !== parsed.hash) return new Response("No encontrada", { status: 404 });

  const storage = getPrivateContestStorageProvider();
  if (!storage.streamObject) return new Response("No disponible", { status: 503 });
  const stream = await storage.streamObject(profile.avatarUrl);
  if (!stream) return new Response("No encontrada", { status: 404 });

  return new Response(stream as ReadableStream<Uint8Array>, {
    headers: {
      "Content-Type": contentTypeForJudgeAvatarExtension(parsed.ext as JudgeAvatarExtension),
      // El hash está en la ruta: si cambia la foto, cambia la URL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
```

- [ ] **Step 6: Register the test script and verify types**

En `apps/fotorank/package.json`, agregar:

```json
"test:judge-avatar-src": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/judgeAvatarSrc.test.ts",
```

Verificar:
```bash
cd apps/fotorank && pnpm test:judge-avatar-src && npx tsc --noEmit
```
Esperado: PASS y 0 errores de tipos.

- [ ] **Step 7: Commit**

```bash
git add apps/fotorank/app/api/jurados apps/fotorank/app/lib/fotorank/judges/judgeAvatarSrc.ts \
        apps/fotorank/app/lib/fotorank/judges/judgeAvatarSrc.test.ts apps/fotorank/package.json
git commit -m "Servir la foto del jurado por una ruta propia con cache larga

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Cambiar las pantallas al nuevo almacenamiento y borrar el viejo

**Files:**
- Modify: `apps/fotorank/app/actions/judges.ts:117-143` (`uploadJudgeAvatarImage`)
- Modify: `apps/fotorank/app/jurados/publico/[publicSlug]/page.tsx:42-48`
- Modify: `apps/fotorank/app/concursos/[slug]/ContestPublicLanding.tsx:475-487`
- Modify: `apps/fotorank/app/concursos/[slug]/jurados/page.tsx:31-42`
- Modify: `apps/fotorank/app/lib/fotorank/publicContestLanding.ts:83-90`
- Modify: `apps/fotorank/app/actions/judges.ts:1618-1657` (`getJudgePublicProfile`)
- Delete: `apps/fotorank/app/lib/fotorank/judges/judgeAvatarStorage.ts`
- Delete: `apps/fotorank/app/lib/fotorank/judges/judgeAvatar.ts` (si sólo lo usa el storage viejo)

**Interfaces:**
- Consumes: `saveJudgeAvatar`, `deleteJudgeAvatarByKey` (Task 1), `judgeAvatarSrc` (Task 2).
- Produces: `uploadJudgeAvatarImage` devuelve `{ ok: true, data: { key: string } }` en lugar de `{ url }`. Toda pantalla que muestre una foto de jurado pasa por `judgeAvatarSrc`.

- [ ] **Step 1: Find every consumer**

```bash
cd apps/fotorank && grep -rn "avatarUrl" app --include="*.ts" --include="*.tsx" | grep -v node_modules
grep -rn "judgeAvatarStorage\|judgeAvatar\b" app --include="*.ts" --include="*.tsx" | grep -v node_modules
```

Anotar cada lugar. Todos deben quedar pasando por `judgeAvatarSrc` o por la clave.

- [ ] **Step 2: Rewrite the organizer upload action**

En `apps/fotorank/app/actions/judges.ts`, reemplazar el cuerpo de `uploadJudgeAvatarImage` (desde la línea 117) por:

```ts
export async function uploadJudgeAvatarImage(
  formData: FormData,
): Promise<JudgeActionResult<{ key: string }>> {
  const scope = await requireOrganizationScope();
  if (!scope.ok) return { ok: false, error: scope.error };

  const judgeAccountId = String(formData.get("judgeAccountId") ?? "").trim();
  if (!judgeAccountId) return { ok: false, error: "Falta indicar de qué jurado es la foto." };

  const file = formData.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  const f = file as File;
  const body = new Uint8Array(await f.arrayBuffer());

  const saved = await saveJudgeAvatar({ judgeAccountId, body, mime: f.type || "" });
  if (!saved.ok) return { ok: false, error: saved.error };
  return { ok: true, data: { key: saved.key } };
}
```

Agregar arriba del archivo:

```ts
import { saveJudgeAvatar, deleteJudgeAvatarByKey } from "../lib/fotorank/judges/judgeAssetStorage";
```

Y quitar el import de `judgeAvatarStorage`.

- [ ] **Step 3: Make the public profile respect the key**

En `getJudgePublicProfile` (`app/actions/judges.ts:1618`), cambiar la línea `avatarUrl: profile.avatarUrl,` por:

```ts
      avatarUrl: judgeAvatarSrc({ id: profile.id, avatarUrl: profile.avatarUrl }),
```

Con el import correspondiente:
```ts
import { judgeAvatarSrc } from "../lib/fotorank/judges/judgeAvatarSrc";
```

Hacer lo mismo en `listPublicJudgesForContestBySlug` (línea 1659) y en
`publicContestLanding.ts` (línea 86), donde hoy dice `avatarUrl: v.profile.avatarUrl`:

```ts
    avatarUrl: judgeAvatarSrc({ id: v.profile.id, avatarUrl: v.profile.avatarUrl }),
```

- [ ] **Step 4: Delete the old storage**

```bash
cd apps/fotorank
git rm app/lib/fotorank/judges/judgeAvatarStorage.ts
grep -rn "judgeAvatar\b" app --include="*.ts" --include="*.tsx" | grep -v judgeAvatarSrc | grep -v node_modules
```

Si `judgeAvatar.ts` ya no tiene consumidores, borrarlo también. Si los tiene, dejarlo.

- [ ] **Step 5: Verify**

```bash
cd apps/fotorank && npx tsc --noEmit && pnpm test:judge-assets && pnpm test:judge-avatar-src
```
Esperado: 0 errores de tipos, todas las pruebas en verde.

Y confirmar que ya no queda rastro del disco:
```bash
grep -rn "public/uploads/judges" app | grep -v node_modules
```
Esperado: sin resultados.

- [ ] **Step 6: Commit**

```bash
git add -A apps/fotorank
git commit -m "Pasar todas las pantallas a la foto servida desde el bucket

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: El jurado sube su propia foto

**Files:**
- Modify: `apps/fotorank/app/actions/judgeProfessionalProfile.ts`
- Modify: `apps/fotorank/app/jurado/perfil/JuradoPerfilProfesionalForm.tsx`
- Modify: `apps/fotorank/app/jurado/perfil/page.tsx`

**Interfaces:**
- Consumes: `requireJudgeAuth()` de `app/lib/judge-auth.ts`, `saveJudgeAvatar` y `deleteJudgeAvatarByKey` (Task 1), `judgeAvatarSrc` (Task 2).
- Produces:
  ```ts
  export async function judgeUploadOwnAvatarAction(formData: FormData): Promise<ProfileActionResult<{ src: string }>>;
  export async function judgeRemoveOwnAvatarAction(): Promise<ProfileActionResult>;
  ```

- [ ] **Step 1: Write the action**

En `apps/fotorank/app/actions/judgeProfessionalProfile.ts`, agregar al final:

```ts
export async function judgeUploadOwnAvatarAction(
  formData: FormData,
): Promise<ProfileActionResult<{ src: string }>> {
  const judge = await requireJudgeAuth();

  const file = formData.get("file");
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  const f = file as File;
  const body = new Uint8Array(await f.arrayBuffer());

  const saved = await saveJudgeAvatar({ judgeAccountId: judge.id, body, mime: f.type || "" });
  if (!saved.ok) return { ok: false, error: saved.error };

  const anterior = await prisma.fotorankJudgeProfile.findUnique({
    where: { judgeAccountId: judge.id },
    select: { id: true, avatarUrl: true },
  });
  if (!anterior) return { ok: false, error: "No se encontró tu perfil." };

  await prisma.fotorankJudgeProfile.update({
    where: { judgeAccountId: judge.id },
    data: { avatarUrl: saved.key },
  });

  // Se borra la anterior DESPUÉS de guardar la nueva: si el borrado falla, el
  // perfil ya tiene foto igual.
  if (anterior.avatarUrl && anterior.avatarUrl !== saved.key) {
    await deleteJudgeAvatarByKey(anterior.avatarUrl);
  }

  revalidatePath("/jurado/perfil");
  const src = judgeAvatarSrc({ id: anterior.id, avatarUrl: saved.key });
  return { ok: true, data: { src: src ?? "" } };
}

export async function judgeRemoveOwnAvatarAction(): Promise<ProfileActionResult> {
  const judge = await requireJudgeAuth();
  const actual = await prisma.fotorankJudgeProfile.findUnique({
    where: { judgeAccountId: judge.id },
    select: { avatarUrl: true },
  });
  if (!actual) return { ok: false, error: "No se encontró tu perfil." };

  await prisma.fotorankJudgeProfile.update({
    where: { judgeAccountId: judge.id },
    data: { avatarUrl: null },
  });
  if (actual.avatarUrl) await deleteJudgeAvatarByKey(actual.avatarUrl);

  revalidatePath("/jurado/perfil");
  return { ok: true };
}
```

Con los imports necesarios al principio del archivo:

```ts
import { saveJudgeAvatar, deleteJudgeAvatarByKey } from "../lib/fotorank/judges/judgeAssetStorage";
import { judgeAvatarSrc } from "../lib/fotorank/judges/judgeAvatarSrc";
```

- [ ] **Step 2: Add the control to the form**

En `apps/fotorank/app/jurado/perfil/JuradoPerfilProfesionalForm.tsx`, agregar arriba del formulario un bloque con la foto actual (o un círculo con las iniciales), un `<input type="file" accept="image/jpeg,image/png,image/webp">` y un botón "Quitar foto" cuando hay una.

El texto de ayuda dice: *"JPEG, PNG o WebP, hasta 2 MB. Se ve en tu página pública y en los concursos donde seas jurado."*

`page.tsx` pasa el `src` inicial calculado con `judgeAvatarSrc`.

- [ ] **Step 3: Verify types**

```bash
cd apps/fotorank && npx tsc --noEmit
```
Esperado: 0 errores.

- [ ] **Step 4: Commit**

```bash
git add apps/fotorank/app/actions/judgeProfessionalProfile.ts apps/fotorank/app/jurado/perfil
git commit -m "Dejar que el jurado suba su propia foto

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: El registro por invitación deja de exigir una asignación previa

**Files:**
- Modify: `apps/fotorank/app/actions/judges.ts:1174-1205` (dentro de `registerJudgeFromInvitation`)
- Create: `apps/fotorank/app/lib/fotorank/judges/inviteAcceptance.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Consumes: `assignmentWhereForInviteAcceptance` (ya existe).
- Produces: sin interfaz nueva. Cambia el comportamiento: con cero asignaciones pendientes, el alta se completa igual.

- [ ] **Step 1: Write the failing test**

El bloque a cambiar hoy hace `return { ok: false, error: … }` cuando
`pendingAssignmentsCount === 0`. La prueba cubre la decisión, extraída a una función pura.

Crear `apps/fotorank/app/lib/fotorank/judges/inviteAcceptance.test.ts`:

```ts
/**
 * Un jurado invitado ANTES de que le asignen una categoría tenía que poder
 * registrarse igual. Antes fallaba con un mensaje que nombraba los estados
 * ASSIGNED e INVITATION_SENT, que no significan nada para quien lo lee.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { resultadoDeAceptarInvitacion } from "./inviteAcceptance";

test("con asignaciones pendientes, se aceptan", () => {
  const r = resultadoDeAceptarInvitacion({ pendingAssignmentsCount: 2 });
  assert.equal(r.aceptaInvitacion, true);
  assert.equal(r.aceptaAsignaciones, true);
  assert.equal(r.aviso, null);
});

test("sin asignaciones pendientes, el alta se completa igual", () => {
  const r = resultadoDeAceptarInvitacion({ pendingAssignmentsCount: 0 });
  assert.equal(r.aceptaInvitacion, true);
  assert.equal(r.aceptaAsignaciones, false);
  assert.equal(
    r.aviso,
    "Todavía no te asignaron ninguna categoría. Escribile al organizador del concurso.",
  );
});

test("el aviso no nombra estados de la base", () => {
  const r = resultadoDeAceptarInvitacion({ pendingAssignmentsCount: 0 });
  assert.ok(r.aviso);
  for (const palabra of ["ASSIGNED", "INVITATION_SENT", "ACCEPTED", "null"]) {
    assert.ok(!r.aviso.includes(palabra), `el aviso no debe nombrar ${palabra}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/inviteAcceptance.test.ts
```
Esperado: FAIL con "Cannot find module './inviteAcceptance'".

- [ ] **Step 3: Write the implementation**

Crear `apps/fotorank/app/lib/fotorank/judges/inviteAcceptance.ts`:

```ts
/**
 * Qué pasa al aceptar una invitación de jurado, según haya o no asignaciones
 * esperando. Antes, no tenerlas cancelaba el alta entera.
 */
export type ResultadoDeAceptarInvitacion = {
  aceptaInvitacion: boolean;
  aceptaAsignaciones: boolean;
  aviso: string | null;
};

export function resultadoDeAceptarInvitacion(input: {
  pendingAssignmentsCount: number;
}): ResultadoDeAceptarInvitacion {
  if (input.pendingAssignmentsCount > 0) {
    return { aceptaInvitacion: true, aceptaAsignaciones: true, aviso: null };
  }
  return {
    aceptaInvitacion: true,
    aceptaAsignaciones: false,
    aviso: "Todavía no te asignaron ninguna categoría. Escribile al organizador del concurso.",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/inviteAcceptance.test.ts
```
Esperado: PASS, 3 pruebas.

- [ ] **Step 5: Use it in the action**

En `apps/fotorank/app/actions/judges.ts`, reemplazar el bloque que hoy empieza en
`const pendingAssignmentsCount = await prisma.fotorankJudgeAssignment.count({ where: assignmentWhere });`
y devuelve el error, por:

```ts
  const pendingAssignmentsCount = await prisma.fotorankJudgeAssignment.count({ where: assignmentWhere });
  const resultado = resultadoDeAceptarInvitacion({ pendingAssignmentsCount });

  const operaciones: Parameters<typeof prisma.$transaction>[0] = [
    prisma.fotorankJudgeInvitation.update({
      where: { id: invitation.id },
      data: {
        invitationStatus: "ACCEPTED",
        acceptedAt: new Date(),
        judgeAccountId: judgeId,
      },
    }),
  ];
  if (resultado.aceptaAsignaciones) {
    operaciones.push(
      prisma.fotorankJudgeAssignment.updateMany({
        where: assignmentWhere,
        data: { assignmentStatus: "ACCEPTED" },
      }),
    );
  }
  await prisma.$transaction(operaciones);
```

Con el import:
```ts
import { resultadoDeAceptarInvitacion } from "../lib/fotorank/judges/inviteAcceptance";
```

El panel del jurado (`app/jurado/panel/page.tsx`) muestra el aviso cuando no tiene
asignaciones: el mismo texto de `resultadoDeAceptarInvitacion`.

- [ ] **Step 6: Register the script, verify and commit**

En `apps/fotorank/package.json`:
```json
"test:judge-invite-acceptance": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/inviteAcceptance.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-invite-acceptance && npx tsc --noEmit
git add apps/fotorank/app/lib/fotorank/judges/inviteAcceptance.ts \
        apps/fotorank/app/lib/fotorank/judges/inviteAcceptance.test.ts \
        apps/fotorank/app/actions/judges.ts apps/fotorank/app/jurado/panel apps/fotorank/package.json
git commit -m "Aceptar la invitación aunque todavía no haya categoría asignada

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Etapa B — El alta por cuenta propia

### Task 6: La máquina de estados de la revisión

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/judges/directoryReview.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/directoryReview.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Produces:
  ```ts
  export type EstadoDeRevision = "PENDING" | "APPROVED" | "REJECTED";
  export type OrigenDeAlta = "ORGANIZER_CREATED" | "ORGANIZER_INVITATION" | "PUBLIC_SIGNUP";
  export type PerfilParaRevision = {
    estado: EstadoDeRevision;
    emailVerificado: boolean;
    quiereEstarEnElDirectorio: boolean;
  };
  export type EfectoDeRevision = {
    estado: EstadoDeRevision;
    isPublic: boolean;
    isListedInProfessionalDirectory: boolean;
  };
  export function estadoInicialParaAlta(origen: OrigenDeAlta): { estado: EstadoDeRevision; isPublic: boolean };
  export function estaEnLaColaDeRevision(p: PerfilParaRevision): boolean;
  export function aprobar(p: PerfilParaRevision): EfectoDeRevision;
  export function rechazar(p: PerfilParaRevision, motivo: string): { ok: true; efecto: EfectoDeRevision } | { ok: false; error: string };
  export function volverAPedirRevision(p: PerfilParaRevision): { ok: true; efecto: EfectoDeRevision } | { ok: false; error: string };
  ```

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/judges/directoryReview.test.ts`:

```ts
/**
 * Cuatro puertas separadas: poder entrar, estar en la lista, tener página
 * pública y estar verificado. Confundirlas publica a alguien que nadie revisó.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  estadoInicialParaAlta,
  estaEnLaColaDeRevision,
  aprobar,
  rechazar,
  volverAPedirRevision,
} from "./directoryReview";

test("quien se postula solo nace pendiente y no público", () => {
  assert.deepEqual(estadoInicialParaAlta("PUBLIC_SIGNUP"), { estado: "PENDING", isPublic: false });
});

test("a quien carga un organizador nace aprobado: ese organizador respondió por él", () => {
  assert.deepEqual(estadoInicialParaAlta("ORGANIZER_CREATED"), { estado: "APPROVED", isPublic: true });
  assert.deepEqual(estadoInicialParaAlta("ORGANIZER_INVITATION"), { estado: "APPROVED", isPublic: true });
});

test("sin el email verificado no entra a la cola", () => {
  assert.equal(
    estaEnLaColaDeRevision({ estado: "PENDING", emailVerificado: false, quiereEstarEnElDirectorio: true }),
    false,
  );
  assert.equal(
    estaEnLaColaDeRevision({ estado: "PENDING", emailVerificado: true, quiereEstarEnElDirectorio: true }),
    true,
  );
});

test("un perfil ya aprobado no vuelve a la cola", () => {
  assert.equal(
    estaEnLaColaDeRevision({ estado: "APPROVED", emailVerificado: true, quiereEstarEnElDirectorio: true }),
    false,
  );
});

test("aprobar publica la página, y el directorio sólo si lo pidió", () => {
  assert.deepEqual(
    aprobar({ estado: "PENDING", emailVerificado: true, quiereEstarEnElDirectorio: true }),
    { estado: "APPROVED", isPublic: true, isListedInProfessionalDirectory: true },
  );
  assert.deepEqual(
    aprobar({ estado: "PENDING", emailVerificado: true, quiereEstarEnElDirectorio: false }),
    { estado: "APPROVED", isPublic: true, isListedInProfessionalDirectory: false },
  );
});

test("rechazar exige un motivo", () => {
  const p = { estado: "PENDING" as const, emailVerificado: true, quiereEstarEnElDirectorio: true };
  const sinMotivo = rechazar(p, "   ");
  assert.equal(sinMotivo.ok, false);
  const conMotivo = rechazar(p, "La bio no describe experiencia en jurados.");
  assert.equal(conMotivo.ok, true);
  assert.deepEqual(conMotivo.ok && conMotivo.efecto, {
    estado: "REJECTED",
    isPublic: false,
    isListedInProfessionalDirectory: false,
  });
});

test("un rechazado puede corregir y volver a pedir revisión", () => {
  const r = volverAPedirRevision({
    estado: "REJECTED",
    emailVerificado: true,
    quiereEstarEnElDirectorio: true,
  });
  assert.equal(r.ok, true);
  assert.equal(r.ok && r.efecto.estado, "PENDING");
});

test("un aprobado no puede volver a pedir revisión", () => {
  const r = volverAPedirRevision({
    estado: "APPROVED",
    emailVerificado: true,
    quiereEstarEnElDirectorio: true,
  });
  assert.equal(r.ok, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/directoryReview.test.ts
```
Esperado: FAIL con "Cannot find module './directoryReview'".

- [ ] **Step 3: Write the implementation**

Crear `apps/fotorank/app/lib/fotorank/judges/directoryReview.ts`:

```ts
/**
 * Las cuatro puertas del jurado, separadas:
 *   poder entrar  → accountStatus
 *   estar listado → isListedInProfessionalDirectory + estado de revisión
 *   página pública→ isPublic
 *   verificado    → isVerifiedByPlatform (fuera de este módulo)
 *
 * Ninguna implica otra. Un perfil puede entrar y trabajar en su ficha desde el
 * minuto cero; lo único que espera la aprobación es la visibilidad.
 */
export type EstadoDeRevision = "PENDING" | "APPROVED" | "REJECTED";

export type OrigenDeAlta = "ORGANIZER_CREATED" | "ORGANIZER_INVITATION" | "PUBLIC_SIGNUP";

export type PerfilParaRevision = {
  estado: EstadoDeRevision;
  emailVerificado: boolean;
  quiereEstarEnElDirectorio: boolean;
};

export type EfectoDeRevision = {
  estado: EstadoDeRevision;
  isPublic: boolean;
  isListedInProfessionalDirectory: boolean;
};

export function estadoInicialParaAlta(
  origen: OrigenDeAlta,
): { estado: EstadoDeRevision; isPublic: boolean } {
  if (origen === "PUBLIC_SIGNUP") return { estado: "PENDING", isPublic: false };
  return { estado: "APPROVED", isPublic: true };
}

export function estaEnLaColaDeRevision(p: PerfilParaRevision): boolean {
  return p.estado === "PENDING" && p.emailVerificado;
}

export function aprobar(p: PerfilParaRevision): EfectoDeRevision {
  return {
    estado: "APPROVED",
    isPublic: true,
    isListedInProfessionalDirectory: p.quiereEstarEnElDirectorio,
  };
}

export function rechazar(
  p: PerfilParaRevision,
  motivo: string,
): { ok: true; efecto: EfectoDeRevision } | { ok: false; error: string } {
  if (!motivo.trim()) {
    return { ok: false, error: "Hace falta un motivo: el jurado lo va a leer para poder corregir." };
  }
  void p;
  return {
    ok: true,
    efecto: { estado: "REJECTED", isPublic: false, isListedInProfessionalDirectory: false },
  };
}

export function volverAPedirRevision(
  p: PerfilParaRevision,
): { ok: true; efecto: EfectoDeRevision } | { ok: false; error: string } {
  if (p.estado !== "REJECTED") {
    return { ok: false, error: "Sólo se puede volver a pedir revisión después de un rechazo." };
  }
  return {
    ok: true,
    efecto: { estado: "PENDING", isPublic: false, isListedInProfessionalDirectory: false },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/directoryReview.test.ts
```
Esperado: PASS, 8 pruebas.

- [ ] **Step 5: Register and commit**

```json
"test:judge-directory-review": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/directoryReview.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-directory-review
git add apps/fotorank/app/lib/fotorank/judges/directoryReview.ts \
        apps/fotorank/app/lib/fotorank/judges/directoryReview.test.ts apps/fotorank/package.json
git commit -m "Separar poder entrar de estar publicado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Validación del formulario público

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/judges/publicSignupForm.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/publicSignupForm.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Produces:
  ```ts
  export type DatosDePostulacion = {
    firstName: string; lastName: string; email: string; password: string;
    city: string; country: string; professionalHeadline: string; shortBio: string;
    specialtiesText: string; experienceYears: number | null;
    aceptaTerminos: boolean; aceptaDatos: boolean;
    phone?: string; website?: string; instagram?: string; portfolioUrl?: string;
    languagesText?: string; region?: string; wantsDirectoryListing?: boolean;
    trampa?: string; segundosDeLlenado?: number;
  };
  export type ErroresDePostulacion = Partial<Record<keyof DatosDePostulacion, string>> & { _general?: string };
  export function validarPostulacion(d: DatosDePostulacion): { ok: true } | { ok: false; errores: ErroresDePostulacion };
  export function normalizarInstagram(raw: string): string | null;
  export function normalizarUrl(raw: string): string | null;
  export const BIO_MINIMA = 120;
  ```

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/judges/publicSignupForm.test.ts`:

```ts
/**
 * Una ficha sin lo indispensable no sirve para contratar a nadie y ensucia el
 * directorio. La validación es la puerta, no un adorno de la pantalla.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  validarPostulacion,
  normalizarInstagram,
  normalizarUrl,
  BIO_MINIMA,
  type DatosDePostulacion,
} from "./publicSignupForm";

const BIO_VALIDA = "a".repeat(BIO_MINIMA);

function datosValidos(): DatosDePostulacion {
  return {
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@ejemplo.com",
    password: "unaclavelarga",
    city: "Santa Fe",
    country: "Argentina",
    professionalHeadline: "Fotógrafa documental",
    shortBio: BIO_VALIDA,
    specialtiesText: "retrato, documental",
    experienceYears: 10,
    aceptaTerminos: true,
    aceptaDatos: true,
    segundosDeLlenado: 30,
  };
}

test("una postulación completa pasa", () => {
  assert.deepEqual(validarPostulacion(datosValidos()), { ok: true });
});

test("faltando cualquier campo obligatorio, no pasa", () => {
  for (const campo of [
    "firstName", "lastName", "email", "city", "country",
    "professionalHeadline", "specialtiesText",
  ] as const) {
    const d = { ...datosValidos(), [campo]: "  " };
    const r = validarPostulacion(d);
    assert.equal(r.ok, false, `${campo} vacío debería fallar`);
  }
});

test("la bio corta no alcanza", () => {
  const r = validarPostulacion({ ...datosValidos(), shortBio: "Soy fotógrafa." });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.errores.shortBio);
});

test("la contraseña necesita 8 caracteres", () => {
  assert.equal(validarPostulacion({ ...datosValidos(), password: "corta" }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), password: "12345678" }).ok, true);
});

test("el email tiene que parecer un email", () => {
  assert.equal(validarPostulacion({ ...datosValidos(), email: "ana" }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), email: "ana@" }).ok, false);
});

test("hay que aceptar los términos y el tratamiento de datos", () => {
  assert.equal(validarPostulacion({ ...datosValidos(), aceptaTerminos: false }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), aceptaDatos: false }).ok, false);
});

test("los años de experiencia son un número razonable", () => {
  assert.equal(validarPostulacion({ ...datosValidos(), experienceYears: null }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), experienceYears: -1 }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), experienceYears: 90 }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), experienceYears: 0 }).ok, true);
});

test("el campo trampa lleno rechaza sin explicar nada", () => {
  const r = validarPostulacion({ ...datosValidos(), trampa: "spam" });
  assert.equal(r.ok, false);
  assert.ok(!r.ok && r.errores._general);
});

test("llenar el formulario en menos de 3 segundos no es humano", () => {
  assert.equal(validarPostulacion({ ...datosValidos(), segundosDeLlenado: 1 }).ok, false);
  assert.equal(validarPostulacion({ ...datosValidos(), segundosDeLlenado: 3 }).ok, true);
});

test("Instagram se normaliza al usuario sin arroba", () => {
  assert.equal(normalizarInstagram("@ana.foto"), "ana.foto");
  assert.equal(normalizarInstagram("ana.foto"), "ana.foto");
  assert.equal(normalizarInstagram("https://instagram.com/ana.foto"), "ana.foto");
  assert.equal(normalizarInstagram("  "), null);
});

test("una URL sin protocolo no se acepta a medias: se completa o se rechaza", () => {
  assert.equal(normalizarUrl("https://ejemplo.com"), "https://ejemplo.com");
  assert.equal(normalizarUrl("ejemplo.com"), "https://ejemplo.com");
  assert.equal(normalizarUrl("javascript:alert(1)"), null);
  assert.equal(normalizarUrl("   "), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/publicSignupForm.test.ts
```
Esperado: FAIL con "Cannot find module './publicSignupForm'".

- [ ] **Step 3: Write the implementation**

Crear `apps/fotorank/app/lib/fotorank/judges/publicSignupForm.ts` con las funciones del
bloque **Interfaces**. Reglas exactas que las pruebas fijan:

- Obligatorios y no vacíos tras `trim()`: `firstName`, `lastName`, `email`, `city`,
  `country`, `professionalHeadline`, `specialtiesText`.
- `email`: debe cumplir `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- `password`: 8 caracteres o más.
- `shortBio`: `BIO_MINIMA = 120` caracteres o más tras `trim()`.
- `experienceYears`: entero entre 0 y 80 inclusive; `null` no vale.
- `aceptaTerminos` y `aceptaDatos`: ambos `true`.
- `trampa`: si viene con algo tras `trim()`, devolver `{ ok: false, errores: { _general: "No pudimos procesar el formulario. Probá de nuevo." } }`.
- `segundosDeLlenado`: si viene y es menor a 3, mismo error general.
- `normalizarInstagram`: saca `@`, saca el prefijo `https://instagram.com/` o `instagram.com/`, saca la barra final, devuelve `null` si queda vacío.
- `normalizarUrl`: acepta sólo `http:` y `https:`; si no trae protocolo, le antepone `https://`; devuelve `null` para vacío o cualquier otro esquema (`javascript:`, `data:`, etc.). Usar `new URL()` dentro de un `try/catch`.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/publicSignupForm.test.ts
```
Esperado: PASS, 12 pruebas.

- [ ] **Step 5: Register and commit**

```json
"test:judge-public-signup": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/publicSignupForm.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-public-signup
git add apps/fotorank/app/lib/fotorank/judges/publicSignupForm.ts \
        apps/fotorank/app/lib/fotorank/judges/publicSignupForm.test.ts apps/fotorank/package.json
git commit -m "Validar la postulación pública antes de crear nada

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Los tokens de verificación de email

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/judges/emailVerification.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/emailVerification.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Produces:
  ```ts
  export const VERIFICACION_VIGENCIA_HORAS = 48;
  export function crearTokenDeVerificacion(ahora: Date): { token: string; tokenHash: string; expiresAt: Date };
  export function hashDeToken(token: string): string;
  export type EstadoDeVerificacion =
    | { ok: true }
    | { ok: false; motivo: "SIN_TOKEN" | "NO_COINCIDE" | "VENCIDO"; mensaje: string };
  export function verificarToken(input: {
    token: string;
    tokenHashGuardado: string | null;
    expiresAt: Date | null;
    ahora: Date;
  }): EstadoDeVerificacion;
  ```

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/judges/emailVerification.test.ts`:

```ts
/**
 * El token se guarda con hash, como el de las invitaciones: quien lea la base
 * no puede usarlo. Vence a las 48 horas y sirve una sola vez.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  crearTokenDeVerificacion,
  hashDeToken,
  verificarToken,
  VERIFICACION_VIGENCIA_HORAS,
} from "./emailVerification";

const AHORA = new Date("2026-09-20T12:00:00.000Z");

test("el token viaja en claro y se guarda con hash", () => {
  const t = crearTokenDeVerificacion(AHORA);
  assert.ok(t.token.length >= 32);
  assert.notEqual(t.token, t.tokenHash);
  assert.equal(t.tokenHash, hashDeToken(t.token));
});

test("vence a las 48 horas", () => {
  const t = crearTokenDeVerificacion(AHORA);
  assert.equal(
    t.expiresAt.getTime() - AHORA.getTime(),
    VERIFICACION_VIGENCIA_HORAS * 60 * 60 * 1000,
  );
});

test("dos tokens seguidos no son iguales", () => {
  assert.notEqual(crearTokenDeVerificacion(AHORA).token, crearTokenDeVerificacion(AHORA).token);
});

test("el token correcto y a tiempo verifica", () => {
  const t = crearTokenDeVerificacion(AHORA);
  const r = verificarToken({
    token: t.token,
    tokenHashGuardado: t.tokenHash,
    expiresAt: t.expiresAt,
    ahora: new Date(AHORA.getTime() + 60_000),
  });
  assert.deepEqual(r, { ok: true });
});

test("un token vencido no verifica", () => {
  const t = crearTokenDeVerificacion(AHORA);
  const r = verificarToken({
    token: t.token,
    tokenHashGuardado: t.tokenHash,
    expiresAt: t.expiresAt,
    ahora: new Date(t.expiresAt.getTime() + 1),
  });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, "VENCIDO");
});

test("un token ajeno no verifica", () => {
  const mio = crearTokenDeVerificacion(AHORA);
  const ajeno = crearTokenDeVerificacion(AHORA);
  const r = verificarToken({
    token: ajeno.token,
    tokenHashGuardado: mio.tokenHash,
    expiresAt: mio.expiresAt,
    ahora: AHORA,
  });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, "NO_COINCIDE");
});

test("un email ya verificado no tiene token guardado, y eso se dice claro", () => {
  const r = verificarToken({
    token: "loquesea",
    tokenHashGuardado: null,
    expiresAt: null,
    ahora: AHORA,
  });
  assert.equal(r.ok, false);
  assert.equal(!r.ok && r.motivo, "SIN_TOKEN");
});

test("ningún mensaje de error nombra la base", () => {
  const r = verificarToken({ token: "x", tokenHashGuardado: null, expiresAt: null, ahora: AHORA });
  assert.ok(!r.ok && !/token|hash|null/i.test(r.mensaje));
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/emailVerification.test.ts
```
Esperado: FAIL con "Cannot find module './emailVerification'".

- [ ] **Step 3: Write the implementation**

Crear `apps/fotorank/app/lib/fotorank/judges/emailVerification.ts`:

```ts
/**
 * Verificación del email de un jurado que se postuló solo.
 *
 * Mismo patrón que FotorankJudgeInvitation.tokenHash: el token viaja en el
 * enlace y en la base queda sólo su hash.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const VERIFICACION_VIGENCIA_HORAS = 48;

export function hashDeToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function crearTokenDeVerificacion(
  ahora: Date,
): { token: string; tokenHash: string; expiresAt: Date } {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    tokenHash: hashDeToken(token),
    expiresAt: new Date(ahora.getTime() + VERIFICACION_VIGENCIA_HORAS * 60 * 60 * 1000),
  };
}

export type EstadoDeVerificacion =
  | { ok: true }
  | { ok: false; motivo: "SIN_TOKEN" | "NO_COINCIDE" | "VENCIDO"; mensaje: string };

function igualesSinFiltrarTiempo(a: string, b: string): boolean {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function verificarToken(input: {
  token: string;
  tokenHashGuardado: string | null;
  expiresAt: Date | null;
  ahora: Date;
}): EstadoDeVerificacion {
  if (!input.tokenHashGuardado || !input.expiresAt) {
    return {
      ok: false,
      motivo: "SIN_TOKEN",
      mensaje: "Este enlace ya se usó. Si tu correo no está confirmado, pedí uno nuevo.",
    };
  }
  if (!igualesSinFiltrarTiempo(hashDeToken(input.token), input.tokenHashGuardado)) {
    return {
      ok: false,
      motivo: "NO_COINCIDE",
      mensaje: "El enlace no es válido. Pedí uno nuevo desde tu panel.",
    };
  }
  if (input.ahora.getTime() > input.expiresAt.getTime()) {
    return {
      ok: false,
      motivo: "VENCIDO",
      mensaje: "El enlace venció. Pedí uno nuevo desde tu panel.",
    };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/emailVerification.test.ts
```
Esperado: PASS, 8 pruebas.

- [ ] **Step 5: Register and commit**

```json
"test:judge-email-verification": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/emailVerification.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-email-verification
git add apps/fotorank/app/lib/fotorank/judges/emailVerification.ts \
        apps/fotorank/app/lib/fotorank/judges/emailVerification.test.ts apps/fotorank/package.json
git commit -m "Verificar el correo con un enlace de un solo uso

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: La migración y los campos nuevos

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (modelos `FotorankJudgeAccount:9494`, `FotorankJudgeProfile:9522`, `FotorankJudgeAuditEvent:9835`)
- Create: `packages/db/prisma/migrations/20260920120000_fotorank_judge_public_signup/migration.sql`
- Create: `docs/migraciones/2026-09-20-fotorank-alta-jurados.md`

**Interfaces:**
- Produces: los enums `FotorankJudgeDirectoryReviewStatus` y `FotorankJudgeSignupSource`, y los campos que las tareas 10 a 13 escriben.

- [ ] **Step 1: Edit the schema**

En `packages/db/prisma/schema.prisma`, agregar los dos enums junto a los demás enums de
jurado (cerca de la línea 10358):

```prisma
enum FotorankJudgeDirectoryReviewStatus {
  PENDING
  APPROVED
  REJECTED
}

enum FotorankJudgeSignupSource {
  ORGANIZER_CREATED
  ORGANIZER_INVITATION
  PUBLIC_SIGNUP
}
```

En `model FotorankJudgeAccount`, después de `lastLoginAt`:

```prisma
  emailVerifiedAt              DateTime?
  emailVerificationTokenHash   String?
  emailVerificationExpiresAt   DateTime?
```

En `model FotorankJudgeProfile`, después de `isVerifiedByPlatform`:

```prisma
  signupSource                    FotorankJudgeSignupSource          @default(ORGANIZER_CREATED)
  directoryReviewStatus           FotorankJudgeDirectoryReviewStatus @default(PENDING)
  directoryReviewedAt             DateTime?
  directoryReviewedByUserId       Int?
  directoryReviewNotes            String?
  wantsDirectoryListing           Boolean                            @default(false)
```

Y agregar el índice, junto a los que ya tiene:

```prisma
  @@index([directoryReviewStatus])
```

En `model FotorankJudgeAuditEvent`, cambiar `organizationId String` por
`organizationId String?` y ajustar la relación a opcional.

- [ ] **Step 2: Write the migration SQL**

Crear `packages/db/prisma/migrations/20260920120000_fotorank_judge_public_signup/migration.sql`:

```sql
-- Alta de jurados por cuenta propia, con revisión previa de DNX.
--
-- Las filas que ya existan quedan APPROVED y ORGANIZER_CREATED: si quedaran
-- PENDING desaparecerían del directorio sin que nadie entienda por qué.

CREATE TYPE "FotorankJudgeDirectoryReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "FotorankJudgeSignupSource" AS ENUM ('ORGANIZER_CREATED', 'ORGANIZER_INVITATION', 'PUBLIC_SIGNUP');

ALTER TABLE "FotorankJudgeAccount"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerificationTokenHash" TEXT,
  ADD COLUMN "emailVerificationExpiresAt" TIMESTAMP(3);

ALTER TABLE "FotorankJudgeProfile"
  ADD COLUMN "signupSource" "FotorankJudgeSignupSource" NOT NULL DEFAULT 'ORGANIZER_CREATED',
  ADD COLUMN "directoryReviewStatus" "FotorankJudgeDirectoryReviewStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "directoryReviewedAt" TIMESTAMP(3),
  ADD COLUMN "directoryReviewedByUserId" INTEGER,
  ADD COLUMN "directoryReviewNotes" TEXT,
  ADD COLUMN "wantsDirectoryListing" BOOLEAN NOT NULL DEFAULT false;

-- Los perfiles que ya existían fueron cargados por un organizador.
UPDATE "FotorankJudgeProfile"
   SET "directoryReviewStatus" = 'APPROVED',
       "wantsDirectoryListing" = "isListedInProfessionalDirectory";

CREATE INDEX "FotorankJudgeProfile_directoryReviewStatus_idx"
  ON "FotorankJudgeProfile"("directoryReviewStatus");

-- Un alta pública no pertenece a ninguna organización.
ALTER TABLE "FotorankJudgeAuditEvent" ALTER COLUMN "organizationId" DROP NOT NULL;
```

- [ ] **Step 3: Test the migration on a throwaway branch**

Crear una rama Neon de prueba a partir de `development` del proyecto
`divine-hall-10689679`, aplicar el SQL ahí, y comprobar:

```sql
SELECT "directoryReviewStatus", "signupSource", COUNT(*)
  FROM "FotorankJudgeProfile" GROUP BY 1, 2;
SELECT is_nullable FROM information_schema.columns
  WHERE table_name = 'FotorankJudgeAuditEvent' AND column_name = 'organizationId';
```

Esperado: ninguna fila queda `PENDING`, y `organizationId` pasa a `YES`.

**No aplicar todavía en las 5 bases**: eso va en la Task 15, cuando el código esté listo.

- [ ] **Step 4: Document the procedure**

Crear `docs/migraciones/2026-09-20-fotorank-alta-jurados.md` con: el SQL, las 5 bases
Neon donde aplicarlo, y el registro en `_prisma_migrations` con el checksum de una base
sana (el procedimiento ya documentado en el repositorio).

- [ ] **Step 5: Verify the client regenerates and commit**

```bash
cd packages/db && npx prisma generate && npx prisma validate
cd ../../apps/fotorank && npx tsc --noEmit
```
Esperado: cliente generado, schema válido, 0 errores de tipos.

```bash
git add packages/db/prisma docs/migraciones
git commit -m "Agregar el estado de revisión y el origen del alta del jurado

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 10: Los dos correos nuevos

**Files:**
- Modify: `apps/fotorank/app/lib/fotorank/notifications/outbox.ts:8-18` y `:149`
- Create: `apps/fotorank/app/lib/fotorank/notifications/judgeEmails.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Produces: dos valores nuevos de `TransactionalEmailKind`: `JUDGE_SIGNUP_VERIFY_EMAIL` y `JUDGE_DIRECTORY_REVIEWED`, con su entrada en `TRANSACTIONAL_EMAIL_TEMPLATES`.

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/notifications/judgeEmails.test.ts`:

```ts
/**
 * Un tipo de correo sin plantilla se encola y nunca se manda.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { TRANSACTIONAL_EMAIL_TEMPLATES } from "./outbox";

test("el correo de verificación tiene plantilla y pide el enlace", () => {
  const t = TRANSACTIONAL_EMAIL_TEMPLATES.JUDGE_SIGNUP_VERIFY_EMAIL;
  assert.ok(t);
  assert.ok(t.requiredVars.includes("verifyUrl"));
  assert.ok(t.subject.length > 0);
});

test("el correo de la revisión dice si fue aprobado o rechazado", () => {
  const t = TRANSACTIONAL_EMAIL_TEMPLATES.JUDGE_DIRECTORY_REVIEWED;
  assert.ok(t);
  assert.ok(t.requiredVars.includes("resultado"));
});

test("ningún asunto de jurado está en inglés o nombra un estado de la base", () => {
  for (const kind of ["JUDGE_SIGNUP_VERIFY_EMAIL", "JUDGE_DIRECTORY_REVIEWED"] as const) {
    const s = TRANSACTIONAL_EMAIL_TEMPLATES[kind].subject;
    for (const palabra of ["PENDING", "APPROVED", "REJECTED", "PUBLIC_SIGNUP"]) {
      assert.ok(!s.includes(palabra), `${kind} no debe nombrar ${palabra}`);
    }
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/notifications/judgeEmails.test.ts
```
Esperado: FAIL (las claves no existen en el objeto).

- [ ] **Step 3: Add the two kinds**

En `apps/fotorank/app/lib/fotorank/notifications/outbox.ts`, agregar a
`TransactionalEmailKind`:

```ts
  | "JUDGE_SIGNUP_VERIFY_EMAIL"
  | "JUDGE_DIRECTORY_REVIEWED";
```

Y a `TRANSACTIONAL_EMAIL_TEMPLATES`:

```ts
  JUDGE_SIGNUP_VERIFY_EMAIL: {
    subject: "Confirmá tu correo para completar tu ficha de jurado",
    requiredVars: ["firstName", "verifyUrl"],
  },
  JUDGE_DIRECTORY_REVIEWED: {
    subject: "Novedades sobre tu ficha de jurado en FotoRank",
    requiredVars: ["firstName", "resultado"],
  },
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/notifications/judgeEmails.test.ts
```
Esperado: PASS, 3 pruebas.

- [ ] **Step 5: Register and commit**

```json
"test:judge-emails": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/notifications/judgeEmails.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-emails && npx tsc --noEmit
git add apps/fotorank/app/lib/fotorank/notifications apps/fotorank/package.json
git commit -m "Sumar el correo de verificación y el del resultado de la revisión

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 11: La página de postulación y su acción

**Files:**
- Create: `apps/fotorank/app/jurados/postulacion/page.tsx`
- Create: `apps/fotorank/app/jurados/postulacion/PostulacionForm.tsx`
- Create: `apps/fotorank/app/jurados/postulacion/gracias/page.tsx`
- Create: `apps/fotorank/app/jurados/verificar/[token]/page.tsx`
- Create: `apps/fotorank/app/actions/judgePublicSignup.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/signupRateLimit.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/signupRateLimit.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Consumes: `validarPostulacion`, `normalizarUrl`, `normalizarInstagram` (Task 7); `crearTokenDeVerificacion`, `verificarToken` (Task 8); `estadoInicialParaAlta` (Task 6); `enqueueTransactionalEmail` (Task 10); `createJudgeSessionForJudge` de `app/lib/judge-auth.ts`.
- Produces:
  ```ts
  export async function postularseComoJuradoAction(prev: unknown, formData: FormData): Promise<{ error: string | null; errores?: Record<string, string> }>;
  export async function verificarEmailDeJuradoAction(token: string): Promise<{ ok: boolean; mensaje: string }>;
  export async function reenviarVerificacionAction(): Promise<{ ok: boolean; mensaje: string }>;
  export function puedeAltaDesdeIp(ip: string, ahora: Date): boolean;
  export function registrarAltaDesdeIp(ip: string, ahora: Date): void;
  export const ALTAS_MAXIMAS_POR_IP_POR_DIA = 5;
  ```

- [ ] **Step 1: Write the failing rate-limit test**

Crear `apps/fotorank/app/lib/fotorank/judges/signupRateLimit.test.ts`:

```ts
/**
 * Un directorio abierto sin freno se llena de basura en una tarde.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  puedeAltaDesdeIp,
  registrarAltaDesdeIp,
  limpiarAltasParaPruebas,
  ALTAS_MAXIMAS_POR_IP_POR_DIA,
} from "./signupRateLimit";

const AHORA = new Date("2026-09-20T12:00:00.000Z");

test("las primeras altas pasan y la que sobra no", () => {
  limpiarAltasParaPruebas();
  for (let i = 0; i < ALTAS_MAXIMAS_POR_IP_POR_DIA; i++) {
    assert.equal(puedeAltaDesdeIp("1.2.3.4", AHORA), true, `el alta ${i + 1} debería pasar`);
    registrarAltaDesdeIp("1.2.3.4", AHORA);
  }
  assert.equal(puedeAltaDesdeIp("1.2.3.4", AHORA), false);
});

test("otra IP no hereda el freno", () => {
  limpiarAltasParaPruebas();
  for (let i = 0; i < ALTAS_MAXIMAS_POR_IP_POR_DIA; i++) registrarAltaDesdeIp("1.2.3.4", AHORA);
  assert.equal(puedeAltaDesdeIp("5.6.7.8", AHORA), true);
});

test("al día siguiente vuelve a poder", () => {
  limpiarAltasParaPruebas();
  for (let i = 0; i < ALTAS_MAXIMAS_POR_IP_POR_DIA; i++) registrarAltaDesdeIp("1.2.3.4", AHORA);
  const manana = new Date(AHORA.getTime() + 24 * 60 * 60 * 1000 + 1);
  assert.equal(puedeAltaDesdeIp("1.2.3.4", manana), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/signupRateLimit.test.ts
```
Esperado: FAIL con "Cannot find module './signupRateLimit'".

- [ ] **Step 3: Implement the rate limit**

Crear `apps/fotorank/app/lib/fotorank/judges/signupRateLimit.ts` con un `Map<string, number[]>`
en memoria del proceso, ventana deslizante de 24 horas, y
`limpiarAltasParaPruebas()` exportada. Comentar arriba que es por instancia: frena el
abuso casual, no un ataque distribuido, y que si hace falta más se mueve a la base.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/signupRateLimit.test.ts
```
Esperado: PASS, 3 pruebas.

- [ ] **Step 5: Write the server action**

Crear `apps/fotorank/app/actions/judgePublicSignup.ts` con `"use server"`. El orden exacto
de `postularseComoJuradoAction`:

1. Leer la IP del encabezado `x-forwarded-for` (primera de la lista). Si `puedeAltaDesdeIp` da `false`, devolver el error general y **no tocar la base**.
2. Armar `DatosDePostulacion` desde el `FormData` y validar con `validarPostulacion`. Si falla, devolver los errores por campo.
3. Buscar la cuenta por email. **Si ya existe:** devolver el mismo mensaje de éxito que el alta buena —*"Si el correo es válido, te llega un mensaje para confirmarlo."*— y encolar un aviso al dueño real de la casilla. No revelar que hay cuenta.
4. Crear cuenta y perfil en una transacción, con `accountStatus: "ACTIVE"`, `signupSource: "PUBLIC_SIGNUP"`, el resultado de `estadoInicialParaAlta("PUBLIC_SIGNUP")`, `wantsDirectoryListing` según la casilla, `publicSlug` con el mismo patrón que `registerJudgeFromInvitation` (`buildPublicSlug(...) + "-" + randomBytes(2).toString("hex")`), y el hash del token de verificación.
5. Encolar `JUDGE_SIGNUP_VERIFY_EMAIL` con `verifyUrl` = `${baseUrl}/jurados/verificar/${token}`.
6. `registrarAltaDesdeIp`.
7. `createJudgeSessionForJudge(judgeId)` — el jurado entra y trabaja en su ficha desde el minuto cero.
8. `redirect("/jurados/postulacion/gracias")`.

`verificarEmailDeJuradoAction` busca la cuenta por el hash del token, llama a
`verificarToken`, y si da bien escribe `emailVerifiedAt` y **borra** el hash y el
vencimiento (un solo uso). Deja evento `JUDGE_PUBLIC_SIGNUP` en
`FotorankJudgeAuditEvent` con `organizationId: null`.

- [ ] **Step 6: Write the pages**

- `/jurados/postulacion`: el formulario. Incluye el campo trampa
  (`<input name="sitioWeb2" tabIndex={-1} autoComplete="off" aria-hidden="true">` oculto
  con CSS, nunca con `type="hidden"`) y un campo oculto con la marca de tiempo de carga
  para calcular `segundosDeLlenado`.
  Arriba del formulario, en un recuadro: *"El directorio de jurados es común a todos los
  organizadores de FotoRank. Si aprobamos tu ficha, cualquiera de ellos va a poder verla y
  proponerte un concurso."*
- `/jurados/postulacion/gracias`: dice que hay que confirmar el correo y qué pasa después.
- `/jurados/verificar/[token]`: llama a la acción y muestra el resultado.

- [ ] **Step 7: Verify and commit**

```json
"test:judge-signup-rate-limit": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/signupRateLimit.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-signup-rate-limit && npx tsc --noEmit && pnpm lint
git add apps/fotorank/app/jurados/postulacion apps/fotorank/app/jurados/verificar \
        apps/fotorank/app/actions/judgePublicSignup.ts \
        apps/fotorank/app/lib/fotorank/judges/signupRateLimit.ts \
        apps/fotorank/app/lib/fotorank/judges/signupRateLimit.test.ts apps/fotorank/package.json
git commit -m "Abrir la puerta: un fotógrafo se postula como jurado por un enlace

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 12: La cola de revisión en Super Admin

**Files:**
- Create: `apps/fotorank/app/(home)/super-admin/jurados/page.tsx`
- Create: `apps/fotorank/app/(home)/super-admin/jurados/ColaDeRevisionClient.tsx`
- Create: `apps/fotorank/app/actions/judgeDirectoryReview.ts`
- Modify: `apps/fotorank/app/(home)/super-admin/page.tsx` (sumar el contador y el enlace)
- Modify: `apps/fotorank/app/actions/judgeProfessionalProfile.ts` (la casilla escribe `wantsDirectoryListing`)

**Interfaces:**
- Consumes: `aprobar`, `rechazar` (Task 6); `enqueueTransactionalEmail` (Task 10).
- Produces:
  ```ts
  export async function aprobarJuradoAction(judgeProfileId: string): Promise<{ ok: boolean; error?: string }>;
  export async function rechazarJuradoAction(judgeProfileId: string, motivo: string): Promise<{ ok: boolean; error?: string }>;
  export async function suspenderCuentaDeJuradoAction(judgeAccountId: string): Promise<{ ok: boolean; error?: string }>;
  export async function contarJuradosPendientes(): Promise<number>;
  ```

- [ ] **Step 1: Gate the route**

`apps/fotorank/app/(home)/super-admin/jurados/page.tsx` repite el gate de
`app/(home)/super-admin/page.tsx:19-21`:

```tsx
const user = await requireAuth();
if (user.globalRole !== "SUPER_ADMIN") redirect("/mi-actividad");
```

Las tres acciones de `judgeDirectoryReview.ts` **repiten el mismo control**: una acción de
servidor es una puerta propia, no confía en que la pantalla la cuidó.

- [ ] **Step 2: Write the actions**

`aprobarJuradoAction`: lee el perfil, arma `PerfilParaRevision`, llama a `aprobar`,
escribe `directoryReviewStatus`, `isPublic`, `isListedInProfessionalDirectory`,
`directoryReviewedAt` y `directoryReviewedByUserId`; deja evento
`JUDGE_DIRECTORY_APPROVED` con `organizationId: null`; encola
`JUDGE_DIRECTORY_REVIEWED` con `resultado: "aprobada"`.

`rechazarJuradoAction`: igual, con `rechazar(perfil, motivo)`. Si devuelve
`{ ok: false }`, no escribe nada. Guarda el motivo en `directoryReviewNotes`, deja evento
`JUDGE_DIRECTORY_REJECTED` y encola el correo con `resultado: "rechazada"` y el motivo.

`suspenderCuentaDeJuradoAction`: pone `accountStatus: "SUSPENDED"` y llama a
`revokeAllJudgeSessionsForJudge` (ya existe en `app/lib/judge-auth.ts:118`).

- [ ] **Step 3: Write the queue screen**

Lista de pendientes —`directoryReviewStatus: "PENDING"` con `emailVerifiedAt` no nulo—
con la ficha completa de cada uno: foto (por `judgeAvatarSrc`), titular, bio,
especialidades, años, links y de dónde salió el alta. Tres botones. El de rechazar abre un
cuadro que **no deja confirmar con el motivo vacío**.

La pantalla vacía dice: *"No hay fichas esperando revisión."*

- [ ] **Step 4: Add the counter to the Super Admin home**

En `app/(home)/super-admin/page.tsx`, sumar a la fila de contadores
`["Jurados por revisar", pendientes]` con enlace a `/super-admin/jurados`.

- [ ] **Step 5: Make the judge's checkbox write the request, not the listing**

En `judgeUpdateProfessionalProfileAction`, cambiar:

```ts
      isListedInProfessionalDirectory: input.isListedInProfessionalDirectory ?? false,
```

por:

```ts
      // Lo que el jurado PIDE. Lo que está publicado lo escribe la aprobación.
      wantsDirectoryListing: input.isListedInProfessionalDirectory ?? false,
```

Y en la pantalla, junto a la casilla, mostrar el estado real: "En revisión", "Aprobado" o
"Rechazado" con su motivo.

- [ ] **Step 6: Verify and commit**

```bash
cd apps/fotorank && npx tsc --noEmit && pnpm lint && pnpm test:judge-directory-review
git add apps/fotorank/app apps/fotorank/package.json
git commit -m "Revisar las postulaciones antes de publicarlas

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Etapa C — El perfil completo y la privacidad

### Task 13: Las URL, el teléfono y los interruptores que hoy se ignoran

**Files:**
- Modify: `apps/fotorank/app/actions/judgeProfessionalProfile.ts`
- Modify: `apps/fotorank/app/jurado/perfil/JuradoPerfilProfesionalForm.tsx`
- Modify: `apps/fotorank/app/jurado/perfil/page.tsx`
- Modify: `apps/fotorank/app/actions/judges.ts:1618-1657` (`getJudgePublicProfile`)
- Create: `apps/fotorank/app/lib/fotorank/judges/publicProfileVisibility.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/publicProfileVisibility.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Consumes: `normalizarUrl`, `normalizarInstagram` (Task 7).
- Produces:
  ```ts
  export type PerfilCompleto = {
    website: string | null; instagram: string | null; otherLinksJson: unknown;
    city: string | null; country: string | null; phone: string | null;
    showWebsitePublicly: boolean; showInstagramPublicly: boolean; showLocationPublicly: boolean;
  };
  export type PerfilVisible = {
    website: string | null; instagram: string | null; otherLinksJson: unknown;
    city: string | null; country: string | null;
  };
  export function recortarPerfilParaElPublico(p: PerfilCompleto): PerfilVisible;
  ```

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/judges/publicProfileVisibility.test.ts`:

```ts
/**
 * El directorio respetaba los interruptores y la página pública no. Un jurado
 * apagaba "mostrar mi web" y su web se mostraba igual.
 *
 * Se recorta en la capa de datos: un dato que no se puede mostrar no sale de
 * la consulta, así ninguna pantalla puede filtrarlo por descuido.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { recortarPerfilParaElPublico } from "./publicProfileVisibility";

function perfilCompleto() {
  return {
    website: "https://ana.com",
    instagram: "ana.foto",
    otherLinksJson: [{ nombre: "Behance", url: "https://behance.net/ana" }],
    city: "Santa Fe",
    country: "Argentina",
    phone: "+54 342 400 0000",
    showWebsitePublicly: true,
    showInstagramPublicly: true,
    showLocationPublicly: true,
  };
}

test("con todo encendido se muestra todo menos el teléfono", () => {
  const v = recortarPerfilParaElPublico(perfilCompleto());
  assert.equal(v.website, "https://ana.com");
  assert.equal(v.instagram, "ana.foto");
  assert.equal(v.city, "Santa Fe");
  assert.equal(v.country, "Argentina");
  assert.ok(!("phone" in v), "el teléfono no sale nunca");
});

test("apagar la web la saca", () => {
  const v = recortarPerfilParaElPublico({ ...perfilCompleto(), showWebsitePublicly: false });
  assert.equal(v.website, null);
  assert.equal(v.instagram, "ana.foto");
});

test("apagar Instagram lo saca", () => {
  const v = recortarPerfilParaElPublico({ ...perfilCompleto(), showInstagramPublicly: false });
  assert.equal(v.instagram, null);
});

test("apagar la ubicación saca ciudad y país juntos", () => {
  const v = recortarPerfilParaElPublico({ ...perfilCompleto(), showLocationPublicly: false });
  assert.equal(v.city, null);
  assert.equal(v.country, null);
});

test("los otros links se muestran siempre: el jurado los cargó para que se vean", () => {
  const v = recortarPerfilParaElPublico({ ...perfilCompleto(), showWebsitePublicly: false });
  assert.deepEqual(v.otherLinksJson, [{ nombre: "Behance", url: "https://behance.net/ana" }]);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/publicProfileVisibility.test.ts
```
Esperado: FAIL con "Cannot find module './publicProfileVisibility'".

- [ ] **Step 3: Write the implementation**

Crear `apps/fotorank/app/lib/fotorank/judges/publicProfileVisibility.ts`:

```ts
/**
 * Qué del perfil de un jurado puede ver cualquiera.
 *
 * Se recorta acá y no en la pantalla: un dato que no se puede mostrar no sale
 * de la capa de datos.
 */
export type PerfilCompleto = {
  website: string | null;
  instagram: string | null;
  otherLinksJson: unknown;
  city: string | null;
  country: string | null;
  phone: string | null;
  showWebsitePublicly: boolean;
  showInstagramPublicly: boolean;
  showLocationPublicly: boolean;
};

export type PerfilVisible = {
  website: string | null;
  instagram: string | null;
  otherLinksJson: unknown;
  city: string | null;
  country: string | null;
};

export function recortarPerfilParaElPublico(p: PerfilCompleto): PerfilVisible {
  return {
    website: p.showWebsitePublicly ? p.website : null,
    instagram: p.showInstagramPublicly ? p.instagram : null,
    otherLinksJson: p.otherLinksJson,
    city: p.showLocationPublicly ? p.city : null,
    country: p.showLocationPublicly ? p.country : null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/publicProfileVisibility.test.ts
```
Esperado: PASS, 5 pruebas.

- [ ] **Step 5: Use it in getJudgePublicProfile**

En `app/actions/judges.ts:1618`, agregar los campos de visibilidad al `select`/`include` y
reemplazar los cuatro campos del `return` por el recorte:

```ts
  const visible = recortarPerfilParaElPublico({
    website: profile.website,
    instagram: profile.instagram,
    otherLinksJson: profile.otherLinksJson,
    city: profile.city,
    country: profile.country,
    phone: profile.phone,
    showWebsitePublicly: profile.showWebsitePublicly,
    showInstagramPublicly: profile.showInstagramPublicly,
    showLocationPublicly: profile.showLocationPublicly,
  });

  return {
    ok: true,
    data: {
      id: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      avatarUrl: judgeAvatarSrc({ id: profile.id, avatarUrl: profile.avatarUrl }),
      shortBio: profile.shortBio,
      fullBioRichJson: profile.fullBioRichJson,
      professionalHeadline: profile.professionalHeadline,
      ...visible,
      assignments: profile.judgeAccount.assignments.map((a) => ({
        contestId: a.contestId,
        contestTitle: a.contest.title,
        categoryName: a.category.name,
        assignmentType: a.assignmentType,
      })),
    },
  };
```

- [ ] **Step 6: Add the missing fields to the judge's own form**

En `judgeUpdateProfessionalProfileAction`, sumar al tipo de entrada y al `data` del
`update`:

```ts
      website: input.website ? normalizarUrl(input.website) : null,
      instagram: input.instagram ? normalizarInstagram(input.instagram) : null,
      portfolioUrl: input.portfolioUrl ? normalizarUrl(input.portfolioUrl) : null,
      phone: input.phone?.trim() || null,
      otherLinksJson: parsearOtrosLinks(input.otherLinksText ?? ""),
```

`parsearOtrosLinks` toma líneas con el formato `Nombre | https://…`, descarta las que no
tienen URL válida según `normalizarUrl`, y devuelve un arreglo de
`{ nombre: string; url: string }`.

En el formulario de `/jurado/perfil`, agregar los campos: teléfono (con la aclaración
*"No se muestra en público; lo ven sólo los organizadores"*), web, Instagram, portfolio y
otros links.

- [ ] **Step 7: Verify and commit**

```json
"test:judge-public-visibility": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/publicProfileVisibility.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judge-public-visibility && npx tsc --noEmit && pnpm lint
git add apps/fotorank/app apps/fotorank/package.json
git commit -m "Que el jurado cargue sus URL y que la página pública respete lo que eligió

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Etapa D — Los jurados en cada concurso

### Task 14: Presencia de los jurados en la landing del concurso

**Files:**
- Modify: `apps/fotorank/app/lib/fotorank/publicContestLanding.ts:29-44` y `:83-90`
- Modify: `apps/fotorank/app/concursos/[slug]/ContestPublicLanding.tsx:454-504`
- Create: `apps/fotorank/app/components/contest-public/ContestJudgesSection.tsx`
- Create: `apps/fotorank/app/lib/fotorank/judges/judgesSectionLayout.ts`
- Create: `apps/fotorank/app/lib/fotorank/judges/judgesSectionLayout.test.ts`
- Modify: `apps/fotorank/package.json`

**Interfaces:**
- Produces:
  ```ts
  export type FormatoDeSeccion = "grilla" | "carrusel";
  export const TOPE_PARA_GRILLA = 6;
  export function formatoDeSeccionDeJurados(cantidad: number): FormatoDeSeccion;
  ```
  Y `PublicContestJudgeCard` suma `professionalHeadline: string | null`.

- [ ] **Step 1: Write the failing test**

Crear `apps/fotorank/app/lib/fotorank/judges/judgesSectionLayout.test.ts`:

```ts
/**
 * Con pocos jurados un carrusel esconde información sin motivo; con muchos,
 * una grilla empuja el resto de la página hacia abajo.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { formatoDeSeccionDeJurados, TOPE_PARA_GRILLA } from "./judgesSectionLayout";

test("hasta seis, grilla", () => {
  for (let n = 1; n <= TOPE_PARA_GRILLA; n++) {
    assert.equal(formatoDeSeccionDeJurados(n), "grilla", `con ${n} debería ser grilla`);
  }
});

test("más de seis, carrusel", () => {
  assert.equal(formatoDeSeccionDeJurados(TOPE_PARA_GRILLA + 1), "carrusel");
  assert.equal(formatoDeSeccionDeJurados(20), "carrusel");
});

test("sin jurados, grilla: la sección no se dibuja igual", () => {
  assert.equal(formatoDeSeccionDeJurados(0), "grilla");
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/judgesSectionLayout.test.ts
```
Esperado: FAIL con "Cannot find module './judgesSectionLayout'".

- [ ] **Step 3: Write the implementation**

```ts
/**
 * Formato de la sección de jurados de un concurso.
 */
export type FormatoDeSeccion = "grilla" | "carrusel";

export const TOPE_PARA_GRILLA = 6;

export function formatoDeSeccionDeJurados(cantidad: number): FormatoDeSeccion {
  return cantidad > TOPE_PARA_GRILLA ? "carrusel" : "grilla";
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/fotorank && npx tsx --test app/lib/fotorank/judges/judgesSectionLayout.test.ts
```
Esperado: PASS, 3 pruebas.

- [ ] **Step 5: Carry the headline through**

En `apps/fotorank/app/lib/fotorank/publicContestLanding.ts`:

- Sumar `professionalHeadline: string | null;` al tipo `PublicContestJudgeCard`.
- En el armado (línea 83), sumar `professionalHeadline: v.profile.professionalHeadline,` y
  cambiar `avatarUrl` por `judgeAvatarSrc({ id: v.profile.id, avatarUrl: v.profile.avatarUrl })`.

Hacer lo mismo en `listPublicJudgesForContestBySlug` y en
`app/concursos/[slug]/jurados/page.tsx`.

- [ ] **Step 6: Extract the section into its own component**

Crear `apps/fotorank/app/components/contest-public/ContestJudgesSection.tsx` con el
contenido que hoy está embebido en `ContestPublicLanding.tsx:454-504`, más:

- Retrato de `h-28 w-28` (hoy `h-24 w-24`).
- El titular profesional debajo del nombre, y la bio corta debajo de ese.
- Cuando `formatoDeSeccionDeJurados(judges.length) === "carrusel"`, la lista se renderiza
  con `overflow-x-auto snap-x snap-mandatory` y cada tarjeta con `snap-start`, más dos
  botones de avance. **Sin JavaScript sigue siendo una lista con scroll horizontal**: los
  botones sólo mejoran la experiencia, no la habilitan.
- Los botones llevan `aria-label` ("Ver jurados anteriores" / "Ver jurados siguientes") y
  el contenedor `tabIndex={0}` para poder recorrerlo con el teclado.

En `ContestPublicLanding.tsx`, reemplazar el bloque por `<ContestJudgesSection judges={judges} contestSlug={contest.slug} />`.

**No tocar ninguna otra sección del archivo.**

- [ ] **Step 7: Verify and commit**

```json
"test:judges-section-layout": "pnpm --filter @repo/db exec tsx --test ../../apps/fotorank/app/lib/fotorank/judges/judgesSectionLayout.test.ts",
```

```bash
cd apps/fotorank && pnpm test:judges-section-layout && npx tsc --noEmit && pnpm lint
git add apps/fotorank/app apps/fotorank/package.json
git commit -m "Presentar a los jurados de cada concurso con su retrato y su titular

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Cierre

### Task 15: Punta a punta, migración y despliegue

**Files:**
- Create: `apps/fotorank/e2e/jurado-alta-publica.spec.ts`
- Modify: `docs/migraciones/2026-09-20-fotorank-alta-jurados.md`

- [ ] **Step 1: Write the end-to-end tests**

Cuatro recorridos, con el patrón de los `e2e/` que ya existen:

1. Autoalta → el correo de verificación queda encolado → el perfil **no** aparece en
   `/jurados/directorio` → aprobación en `/super-admin/jurados` → aparece.
2. Rechazo con motivo: el jurado lo ve en su panel, corrige y vuelve a pedir revisión.
3. El jurado sube su foto y carga su web; apaga "mostrar mi web" y
   `/jurados/publico/<slug>` deja de mostrarla.
4. Un concurso con jurados confirmados muestra la sección en su landing; con siete,
   aparece el carrusel.

- [ ] **Step 2: Run the whole suite**

```bash
cd apps/fotorank
for s in test:judge-assets test:judge-avatar-src test:judge-invite-acceptance \
         test:judge-directory-review test:judge-public-signup test:judge-email-verification \
         test:judge-emails test:judge-signup-rate-limit test:judge-public-visibility \
         test:judges-section-layout test:jury-source test:jury-entry; do
  echo "--- $s ---"; pnpm $s 2>&1 | grep -E "^ℹ (pass|fail)";
done
npx tsc --noEmit && pnpm lint
```
Esperado: todas en verde, 0 fallos, 0 errores de tipos, lint limpio.

- [ ] **Step 3: Apply the migration to the 5 Neon databases**

Seguir `docs/migraciones/2026-09-20-fotorank-alta-jurados.md`. Antes de cada base,
verificar cuántos perfiles tiene:

```sql
SELECT COUNT(*) FROM "FotorankJudgeProfile";
```

Después de cada una, verificar que ninguna fila quedó `PENDING`:

```sql
SELECT "directoryReviewStatus", COUNT(*) FROM "FotorankJudgeProfile" GROUP BY 1;
```

Registrar la migración en `_prisma_migrations` con el checksum de una base sana.

- [ ] **Step 4: Open the pull request**

```bash
git push -u origin <rama>
gh pr create --base main --title "Altas de jurados de FotoRank por cuenta propia" --body-file <archivo>
```

El cuerpo del PR lleva la tabla de verificación con el resultado real de cada prueba, y
dice explícitamente en qué bases se aplicó la migración.

---

## Self-review

**Cobertura del spec:**

| Sección del spec | Tarea |
|---|---|
| 4.1 foto al bucket privado | 1, 2, 3 |
| 4.2 el jurado sube su foto | 4 |
| 4.3 registro sin asignación previa | 5 |
| 5.1 la ruta de postulación | 11 |
| 5.2 verificación del email | 8, 11 |
| 5.3 defensas contra el abuso | 7 (trampa y tiempo), 11 (IP y email repetido) |
| 5.4 las cuatro puertas | 6, 12 |
| 5.5 campos nuevos en la base | 9 |
| 5.6 moderación en Super Admin | 12 |
| 6.1 las URL y el teléfono | 13 |
| 6.2 privacidad de la página pública | 13 |
| 7 los jurados en el concurso | 14 |
| 9 migración en las 5 bases | 9 (SQL y prueba), 15 (aplicación) |
| 10 pruebas | cada tarea; punta a punta en 15 |

Las etapas del CV y de las estadísticas verificables quedan fuera por decisión del spec
(sección 3), y el `DROP` de las cuatro columnas muertas va con ellas.
