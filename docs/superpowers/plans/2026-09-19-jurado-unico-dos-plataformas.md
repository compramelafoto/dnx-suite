# Jurado único para Clickatón y FotoRank — plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que un jurado entre a un solo portal y pueda ver y puntuar las fotos de una maratón de Clickatón, con un padrón de jurados único mantenible desde ambas plataformas.

**Architecture:** El portal vive en FotoRank. El padrón maestro de jurados vive en la base de FotoRank; las obras y los votos de una maratón se quedan en la base de Clickatón, alcanzados por un cliente Prisma cruzado. Las fotos las sirve Clickatón por una ruta con enlace firmado y vencimiento corto, para no repartir las llaves del bucket privado.

**Tech Stack:** Next.js (App Router), Prisma, PostgreSQL en Neon, R2 (S3), `node:test` vía `tsx`, TypeScript.

**Spec:** `docs/superpowers/specs/2026-09-19-jurado-unico-dos-plataformas-design.md`

## Global Constraints

- **Ningún campo nuevo en `schema.prisma`.** Las 29 tablas necesarias ya existen en las dos bases. Si una tarea pareciera necesitar una columna nueva, detenerse y avisar: deja de ser un cambio de código y pasa a ser trabajo manual en cinco bases Neon.
- **Zona horaria:** las fechas de Prisma son `timestamp without time zone` y guardan UTC. Nunca usar `AT TIME ZONE 'America/...'` a secas sobre esas columnas; el doble casteo correcto es `col AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires'`.
- **Anonimato:** ningún dato que llegue a la pantalla del jurado puede identificar al autor. Prohibido `authorUserId`, nombre, email, `clickatonParticipantNumber` y `externalRegistrationId`.
- **Idioma:** comentarios y textos de interfaz en español rioplatense. Identificadores técnicos en inglés, como el resto del repo.
- **Tests:** `node:test` con `tsx --test`. Cada archivo de prueba se registra como script `test:<nombre>` en el `package.json` de su app.
- **Secreto de firma:** `CLICKATON_JURY_MEDIA_SECRET`, con respaldo en `DNX_SESSION_SECRET`, mínimo 16 caracteres. Mismo criterio que `getClickatonQrSigningSecret`.
- **Lint:** `pnpm lint` con `--max-warnings 0`. Los archivos tocados no deben sumar advertencias.
- **Chequeo de tipos:** requiere `NODE_OPTIONS="--max-old-space-size=8192"` o se queda sin memoria.

---

## File Structure

**Clickatón** (`apps/clickaton`)

| Archivo | Responsabilidad |
|---|---|
| `lib/jury-media/signed-link.ts` | Firmar y verificar enlaces de vista previa. Puro, sin base ni red. |
| `lib/jury-media/signed-link.test.ts` | Pruebas de firma, vencimiento y adulteración. |
| `lib/jury-media/resolve-preview.ts` | De un `assetId` a los bytes: valida que sea vista previa activa y admitida. |
| `lib/jury-media/resolve-preview.test.ts` | Pruebas de las reglas de acceso, con repositorio falso. |
| `app/api/jurado/media/[assetId]/route.ts` | Sirve la imagen. Verifica firma y delega en `resolve-preview`. |
| `lib/jury-mirror/mirror-judge.ts` | Crea el `Workspace` de jurados y la ficha espejo, en una transacción. |
| `lib/jury-mirror/mirror-judge.test.ts` | Pruebas del centinela y de que no autentica. |

**Compartido** (`packages/db/src`)

| Archivo | Responsabilidad |
|---|---|
| `clickaton-jury-client.ts` | Cliente Prisma de FotoRank hacia la base de Clickatón, con escritura. |

**FotoRank** (`apps/fotorank`)

| Archivo | Responsabilidad |
|---|---|
| `app/lib/fotorank/jury/assignment-source.ts` | Decide qué base corresponde a cada asignación. |
| `app/lib/fotorank/jury/assignment-source.test.ts` | Pruebas de esa decisión. |
| `app/lib/fotorank/jury/entry-for-juror.ts` | Arma el objeto que ve el jurado. Único lugar que decide qué se expone. |
| `app/lib/fotorank/jury/entry-for-juror.test.ts` | Prueba de anonimato: falla si se cuela un dato del autor. |
| `app/actions/judges.ts` | Se modifica: listado de asignaciones, listado de obras, guardado del voto. |
| `app/jurado/asignaciones/[assignmentId]/evaluar/page.tsx` | Se modifica: sale el `as any[]`. |
| `app/jurado/asignaciones/[assignmentId]/evaluar/EvaluationClient.tsx` | Se modifica: usa la vista previa, no `imageUrl`. |

---

### Task 1: Firmar y verificar el enlace de la vista previa

Pieza pura y aislada: dado un `assetId` y un vencimiento, produce una firma; y a la inversa, valida. No toca base ni red, así que se prueba entera.

**Files:**
- Create: `apps/clickaton/lib/jury-media/signed-link.ts`
- Test: `apps/clickaton/lib/jury-media/signed-link.test.ts`
- Modify: `apps/clickaton/package.json` (script `test:jury-media`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `signJuryPreviewLink(input: { assetId: string; expiresAt: Date; secret?: string }): string` — devuelve la firma en base64url.
  - `verifyJuryPreviewLink(input: { assetId: string; exp: string; sig: string; now?: Date; secret?: string }): { ok: true } | { ok: false; reason: "EXPIRED" | "BAD_SIGNATURE" | "MALFORMED" }`
  - `buildJuryPreviewPath(input: { assetId: string; expiresAt: Date; secret?: string }): string` — ruta relativa lista para usar como `src`.
  - `getJuryMediaSecret(env?: NodeJS.ProcessEnv): string`

- [ ] **Step 1: Write the failing test**

```ts
// apps/clickaton/lib/jury-media/signed-link.test.ts
/**
 * Enlace firmado de vista previa para jurado.
 * Un enlace copiado no debe servir mañana, y una firma adulterada nunca.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJuryPreviewPath,
  signJuryPreviewLink,
  verifyJuryPreviewLink,
} from "./signed-link";

const SECRET = "secreto-de-prueba-largo-1234";
const ASSET = "asset-abc123";
const AHORA = new Date("2026-09-19T20:00:00.000Z");
const VENCE = new Date("2026-09-19T20:05:00.000Z");

test("una firma recién emitida se acepta", () => {
  const sig = signJuryPreviewLink({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  const r = verifyJuryPreviewLink({
    assetId: ASSET,
    exp: String(VENCE.getTime()),
    sig,
    now: AHORA,
    secret: SECRET,
  });
  assert.deepEqual(r, { ok: true });
});

test("vencida se rechaza", () => {
  const sig = signJuryPreviewLink({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  const r = verifyJuryPreviewLink({
    assetId: ASSET,
    exp: String(VENCE.getTime()),
    sig,
    now: new Date("2026-09-19T20:05:01.000Z"),
    secret: SECRET,
  });
  assert.equal(r.ok, false);
  assert.equal(r.ok === false && r.reason, "EXPIRED");
});

test("firma adulterada se rechaza", () => {
  const r = verifyJuryPreviewLink({
    assetId: ASSET,
    exp: String(VENCE.getTime()),
    sig: "firmafalsa",
    now: AHORA,
    secret: SECRET,
  });
  assert.equal(r.ok === false && r.reason, "BAD_SIGNATURE");
});

test("la firma de una obra no sirve para otra", () => {
  const sig = signJuryPreviewLink({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  const r = verifyJuryPreviewLink({
    assetId: "otro-asset",
    exp: String(VENCE.getTime()),
    sig,
    now: AHORA,
    secret: SECRET,
  });
  assert.equal(r.ok === false && r.reason, "BAD_SIGNATURE");
});

test("mover el vencimiento invalida la firma", () => {
  const sig = signJuryPreviewLink({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  const r = verifyJuryPreviewLink({
    assetId: ASSET,
    exp: String(new Date("2026-09-20T20:00:00.000Z").getTime()),
    sig,
    now: AHORA,
    secret: SECRET,
  });
  assert.equal(r.ok === false && r.reason, "BAD_SIGNATURE");
});

test("otro secreto no valida", () => {
  const sig = signJuryPreviewLink({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  const r = verifyJuryPreviewLink({
    assetId: ASSET,
    exp: String(VENCE.getTime()),
    sig,
    now: AHORA,
    secret: "otro-secreto-igual-de-largo",
  });
  assert.equal(r.ok === false && r.reason, "BAD_SIGNATURE");
});

test("entradas mal formadas se rechazan sin romper", () => {
  for (const exp of ["", "no-es-numero", "-1"]) {
    const r = verifyJuryPreviewLink({
      assetId: ASSET,
      exp,
      sig: "x",
      now: AHORA,
      secret: SECRET,
    });
    assert.equal(r.ok === false && r.reason, "MALFORMED");
  }
});

test("la ruta lleva el asset, el vencimiento y la firma", () => {
  const path = buildJuryPreviewPath({ assetId: ASSET, expiresAt: VENCE, secret: SECRET });
  assert.ok(path.startsWith(`/api/jurado/media/${ASSET}?`));
  const qs = new URLSearchParams(path.split("?")[1]);
  assert.equal(qs.get("exp"), String(VENCE.getTime()));
  assert.ok((qs.get("sig") ?? "").length > 20);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/clickaton && npx tsx --test lib/jury-media/signed-link.test.ts`
Expected: FAIL con `ERR_MODULE_NOT_FOUND` — el archivo `signed-link` no existe.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/clickaton/lib/jury-media/signed-link.ts
/**
 * Enlace firmado para que el jurado vea una vista previa alojada en el bucket
 * privado de Clickatón.
 *
 * FotoRank no recibe las llaves del bucket: firma un enlace con el secreto
 * compartido y el navegador del jurado le pide la imagen a Clickatón. El
 * vencimiento corto hace que un enlace copiado deje de servir solo.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const PURPOSE = "clickaton:jury-preview:v1";

export function getJuryMediaSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret =
    env.CLICKATON_JURY_MEDIA_SECRET?.trim() || env.DNX_SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "CLICKATON_JURY_MEDIA_SECRET (o DNX_SESSION_SECRET) es obligatorio para firmar vistas previas de jurado",
    );
  }
  return secret;
}

function computeSignature(assetId: string, expMs: number, secret: string): string {
  return createHmac("sha256", secret)
    .update(`${PURPOSE}:${assetId}:${expMs}`)
    .digest("base64url");
}

export function signJuryPreviewLink(input: {
  assetId: string;
  expiresAt: Date;
  secret?: string;
}): string {
  const secret = input.secret ?? getJuryMediaSecret();
  return computeSignature(input.assetId, input.expiresAt.getTime(), secret);
}

export type JuryPreviewLinkVerification =
  | { ok: true }
  | { ok: false; reason: "EXPIRED" | "BAD_SIGNATURE" | "MALFORMED" };

export function verifyJuryPreviewLink(input: {
  assetId: string;
  exp: string;
  sig: string;
  now?: Date;
  secret?: string;
}): JuryPreviewLinkVerification {
  const expMs = Number(input.exp);
  if (!input.assetId || !input.exp || !Number.isSafeInteger(expMs) || expMs <= 0) {
    return { ok: false, reason: "MALFORMED" };
  }

  const secret = input.secret ?? getJuryMediaSecret();
  const expected = computeSignature(input.assetId, expMs, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(input.sig ?? "");
  // Comparar siempre con el mismo costo: una comparación corta filtra información.
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "BAD_SIGNATURE" };
  }

  const now = (input.now ?? new Date()).getTime();
  // Vencimiento exclusivo: al milisegundo exacto todavía vale.
  if (expMs < now) return { ok: false, reason: "EXPIRED" };

  return { ok: true };
}

export function buildJuryPreviewPath(input: {
  assetId: string;
  expiresAt: Date;
  secret?: string;
}): string {
  const sig = signJuryPreviewLink(input);
  const qs = new URLSearchParams({
    exp: String(input.expiresAt.getTime()),
    sig,
  });
  return `/api/jurado/media/${encodeURIComponent(input.assetId)}?${qs.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/clickaton && npx tsx --test lib/jury-media/signed-link.test.ts`
Expected: PASS, 8 pruebas.

Nota: el test de "vencida" usa `20:05:01` contra un vencimiento de `20:05:00`, así que el orden `BAD_SIGNATURE` antes que `EXPIRED` no lo afecta: la firma es válida y sólo falla el vencimiento.

- [ ] **Step 5: Register the test script**

En `apps/clickaton/package.json`, junto a los otros `test:*`:

```json
"test:jury-media": "tsx --test lib/jury-media/*.test.ts",
```

- [ ] **Step 6: Commit**

```bash
git add apps/clickaton/lib/jury-media/signed-link.ts apps/clickaton/lib/jury-media/signed-link.test.ts apps/clickaton/package.json
git commit -m "Firmar los enlaces de vista previa del jurado"
```

---

### Task 2: Resolver la vista previa y servirla

Separa la **regla de acceso** (qué obra puede verse) de la **entrega** (los bytes). La regla se prueba con un repositorio falso; la ruta sólo pega las piezas.

**Files:**
- Create: `apps/clickaton/lib/jury-media/resolve-preview.ts`
- Create: `apps/clickaton/lib/jury-media/resolve-preview.test.ts`
- Create: `apps/clickaton/app/api/jurado/media/[assetId]/route.ts`

**Interfaces:**
- Consumes: `verifyJuryPreviewLink` de la Tarea 1.
- Produces:
  - `type JuryPreviewAsset = { id: string; storageKey: string; mimeType: string | null; isActive: boolean; kind: string; storageProvider: string }`
  - `type JuryPreviewRepo = { findAsset(assetId: string): Promise<JuryPreviewAsset | null> }`
  - `resolveJuryPreviewAccess(input: { assetId: string; repo: JuryPreviewRepo }): Promise<{ ok: true; storageKey: string; contentType: string } | { ok: false; reason: "NOT_FOUND" | "NOT_A_JURY_PREVIEW" | "INACTIVE" | "FOREIGN_STORAGE" }>`

- [ ] **Step 1: Write the failing test**

```ts
// apps/clickaton/lib/jury-media/resolve-preview.test.ts
/**
 * Reglas de acceso a una vista previa de jurado.
 * Sólo se sirve un asset ACTIVO, de tipo JURY_PREVIEW y guardado en el
 * almacenamiento privado de Clickatón. Cualquier otra cosa es 404.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { resolveJuryPreviewAccess, type JuryPreviewAsset } from "./resolve-preview";

function repoCon(asset: JuryPreviewAsset | null) {
  return { findAsset: async () => asset };
}

const VALIDO: JuryPreviewAsset = {
  id: "a1",
  storageKey: "clickaton/private/entries/e1/s1/preview/x.jpg",
  mimeType: "image/jpeg",
  isActive: true,
  kind: "JURY_PREVIEW",
  storageProvider: "clickaton_private",
};

test("un asset válido se sirve", async () => {
  const r = await resolveJuryPreviewAccess({ assetId: "a1", repo: repoCon(VALIDO) });
  assert.equal(r.ok, true);
  assert.equal(r.ok === true && r.storageKey, VALIDO.storageKey);
  assert.equal(r.ok === true && r.contentType, "image/jpeg");
});

test("un asset inexistente no se sirve", async () => {
  const r = await resolveJuryPreviewAccess({ assetId: "a1", repo: repoCon(null) });
  assert.equal(r.ok === false && r.reason, "NOT_FOUND");
});

test("un asset que no es vista previa de jurado no se sirve", async () => {
  const r = await resolveJuryPreviewAccess({
    assetId: "a1",
    repo: repoCon({ ...VALIDO, kind: "ORIGINAL" }),
  });
  assert.equal(r.ok === false && r.reason, "NOT_A_JURY_PREVIEW");
});

test("un asset dado de baja no se sirve", async () => {
  const r = await resolveJuryPreviewAccess({
    assetId: "a1",
    repo: repoCon({ ...VALIDO, isActive: false }),
  });
  assert.equal(r.ok === false && r.reason, "INACTIVE");
});

test("un asset de otro almacenamiento no se sirve", async () => {
  const r = await resolveJuryPreviewAccess({
    assetId: "a1",
    repo: repoCon({ ...VALIDO, storageProvider: "r2_private" }),
  });
  assert.equal(r.ok === false && r.reason, "FOREIGN_STORAGE");
});

test("nunca sale del prefijo privado de Clickatón", async () => {
  const r = await resolveJuryPreviewAccess({
    assetId: "a1",
    repo: repoCon({ ...VALIDO, storageKey: "clickaton/blog/hero/x.jpg" }),
  });
  assert.equal(r.ok === false && r.reason, "FOREIGN_STORAGE");
});

test("sin mimeType declarado cae a jpeg", async () => {
  const r = await resolveJuryPreviewAccess({
    assetId: "a1",
    repo: repoCon({ ...VALIDO, mimeType: null }),
  });
  assert.equal(r.ok === true && r.contentType, "image/jpeg");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/clickaton && npx tsx --test lib/jury-media/resolve-preview.test.ts`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/clickaton/lib/jury-media/resolve-preview.ts
/**
 * Regla de acceso a una vista previa de jurado, separada de la entrega de bytes.
 * Se prueba sola, con un repositorio falso.
 */

/** Prefijo del almacenamiento privado de Clickatón. Nada fuera de acá se sirve. */
const PRIVATE_PREFIX = "clickaton/private/";

export type JuryPreviewAsset = {
  id: string;
  storageKey: string;
  mimeType: string | null;
  isActive: boolean;
  kind: string;
  storageProvider: string;
};

export type JuryPreviewRepo = {
  findAsset(assetId: string): Promise<JuryPreviewAsset | null>;
};

export type JuryPreviewAccess =
  | { ok: true; storageKey: string; contentType: string }
  | {
      ok: false;
      reason: "NOT_FOUND" | "NOT_A_JURY_PREVIEW" | "INACTIVE" | "FOREIGN_STORAGE";
    };

export async function resolveJuryPreviewAccess(input: {
  assetId: string;
  repo: JuryPreviewRepo;
}): Promise<JuryPreviewAccess> {
  const asset = await input.repo.findAsset(input.assetId);
  if (!asset) return { ok: false, reason: "NOT_FOUND" };
  if (asset.kind !== "JURY_PREVIEW") return { ok: false, reason: "NOT_A_JURY_PREVIEW" };
  if (!asset.isActive) return { ok: false, reason: "INACTIVE" };
  if (
    asset.storageProvider !== "clickaton_private" ||
    !asset.storageKey.startsWith(PRIVATE_PREFIX)
  ) {
    return { ok: false, reason: "FOREIGN_STORAGE" };
  }

  return {
    ok: true,
    storageKey: asset.storageKey,
    contentType: asset.mimeType ?? "image/jpeg",
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/clickaton && npx tsx --test lib/jury-media/resolve-preview.test.ts`
Expected: PASS, 7 pruebas.

- [ ] **Step 5: Write the route**

```ts
// apps/clickaton/app/api/jurado/media/[assetId]/route.ts
/**
 * Sirve la vista previa de una obra al jurado.
 *
 * No hay sesión de jurado en Clickatón: la autorización viaja en la firma que
 * emite FotoRank. Por eso el enlace vence rápido y la regla de acceso vuelve a
 * comprobarse acá contra la base, nunca sólo contra la firma.
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/admin/db";
import { getPrivateEntryStorage } from "@/lib/photo-upload/storage";
import { resolveJuryPreviewAccess } from "@/lib/jury-media/resolve-preview";
import { verifyJuryPreviewLink } from "@/lib/jury-media/signed-link";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Params = { params: Promise<{ assetId: string }> };

const NOT_FOUND = NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

export async function GET(request: Request, { params }: Params) {
  const { assetId } = await params;
  const url = new URL(request.url);

  const verification = verifyJuryPreviewLink({
    assetId,
    exp: url.searchParams.get("exp") ?? "",
    sig: url.searchParams.get("sig") ?? "",
  });
  if (!verification.ok) {
    // Un enlace vencido merece un mensaje propio: es el caso normal, no un ataque.
    const status = verification.reason === "EXPIRED" ? 410 : 403;
    return NextResponse.json({ ok: false, error: verification.reason }, { status });
  }

  const access = await resolveJuryPreviewAccess({
    assetId,
    repo: {
      findAsset: (id) =>
        prisma.fotorankContestEntryAsset.findUnique({
          where: { id },
          select: {
            id: true,
            storageKey: true,
            mimeType: true,
            isActive: true,
            kind: true,
            storageProvider: true,
          },
        }),
    },
  });
  if (!access.ok) return NOT_FOUND;

  try {
    const body = await getPrivateEntryStorage().get(access.storageKey);
    return new NextResponse(new Uint8Array(body), {
      status: 200,
      headers: {
        "Content-Type": access.contentType,
        // Privada y corta: el enlace vence, la caché no debe sobrevivirlo.
        "Cache-Control": "private, max-age=60, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  } catch {
    return NOT_FOUND;
  }
}
```

- [ ] **Step 6: Verify types and lint**

Run: `cd apps/clickaton && NODE_OPTIONS="--max-old-space-size=8192" pnpm check-types`
Expected: sin errores.

Run: `cd apps/clickaton && npx eslint --max-warnings 0 lib/jury-media app/api/jurado`
Expected: sin salida.

- [ ] **Step 7: Commit**

```bash
git add apps/clickaton/lib/jury-media apps/clickaton/app/api/jurado
git commit -m "Servir la vista previa de una obra al jurado"
```

---

### Task 3: Que la admisión muestre las fotos

Hoy la pantalla de admisión decide sin ver. Con la ruta de la Tarea 2 ya se puede mostrar la vista previa. Esta tarea entrega valor sola, sin que exista ningún jurado.

**Files:**
- Modify: `apps/clickaton/app/admin/(panel)/ediciones/[editionId]/admision/page.tsx`

**Interfaces:**
- Consumes: `buildJuryPreviewPath` de la Tarea 1.
- Produces: nada que otras tareas usen.

- [ ] **Step 1: Read the current screen**

Run: `cd apps/clickaton && sed -n '1,120p' 'app/admin/(panel)/ediciones/[editionId]/admision/page.tsx'`

Identificar dónde se listan las obras y qué campos trae cada fila. La consulta debe pasar a incluir el asset activo de tipo `JURY_PREVIEW` (`select: { id: true }`, `take: 1`).

- [ ] **Step 2: Add the thumbnail**

Para cada fila con asset, calcular la ruta en el servidor y renderizar la miniatura. El vencimiento es corto porque la página se recarga:

```tsx
const previewPath = asset
  ? buildJuryPreviewPath({
      assetId: asset.id,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    })
  : null;
```

```tsx
{previewPath ? (
  <img
    src={previewPath}
    alt="Vista previa de la obra"
    className="h-20 w-20 rounded-md border border-ck-border object-cover"
  />
) : (
  <span className="ck-caption text-ck-text-muted">Sin vista previa</span>
)}
```

- [ ] **Step 3: Verify types and lint**

Run: `cd apps/clickaton && NODE_OPTIONS="--max-old-space-size=8192" pnpm check-types`
Run: `cd apps/clickaton && npx eslint --max-warnings 0 'app/admin/(panel)/ediciones/[editionId]/admision/page.tsx'`
Expected: ambos sin errores.

- [ ] **Step 4: Commit**

```bash
git add 'apps/clickaton/app/admin/(panel)/ediciones/[editionId]/admision/page.tsx'
git commit -m "Ver la foto antes de admitirla"
```

---

### Task 4: Cliente de FotoRank hacia la base de Clickatón

Espejo de `packages/db/src/clf-write-client.ts`. Sin él, ninguna tarea posterior puede leer obras ni guardar votos.

**Files:**
- Create: `packages/db/src/clickaton-jury-client.ts`
- Modify: `packages/db/src/index.ts` (exportar)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `getClickatonJuryPrisma(): PrismaClient | null` — `null` cuando no está configurado.
  - `getClickatonJuryConnectionInfo(): { configured: boolean; hostMasked: string | null }`

- [ ] **Step 1: Read the existing pattern**

Run: `cd packages/db && sed -n '1,120p' src/clf-write-client.ts`

Copiar la forma: resolución por variable de entorno, cliente memorizado en `globalThis`, host enmascarado en el diagnóstico. Variable: `CLICKATON_JURY_DATABASE_URL`.

- [ ] **Step 2: Write the client**

```ts
// packages/db/src/clickaton-jury-client.ts
/**
 * Cliente Prisma de FotoRank hacia la base operativa de Clickatón.
 *
 * El portal del jurado vive en FotoRank, pero las obras de una maratón y sus
 * votos viven en la base de Clickatón: las claves foráneas no cruzan bases.
 * Este cliente es la única puerta autorizada para esa lectura y escritura.
 */
import { PrismaClient } from "@prisma/client";

const globalForClickatonJury = globalThis as unknown as {
  clickatonJuryPrisma?: PrismaClient;
};

function resolveUrl(): string | null {
  return process.env.CLICKATON_JURY_DATABASE_URL?.trim() || null;
}

export function getClickatonJuryConnectionInfo(): {
  configured: boolean;
  hostMasked: string | null;
} {
  const url = resolveUrl();
  if (!url) return { configured: false, hostMasked: null };
  try {
    const u = new URL(url);
    return { configured: true, hostMasked: `${u.hostname.slice(0, 14)}…` };
  } catch {
    return { configured: false, hostMasked: null };
  }
}

export function getClickatonJuryPrisma(): PrismaClient | null {
  const url = resolveUrl();
  if (!url) return null;
  if (!globalForClickatonJury.clickatonJuryPrisma) {
    globalForClickatonJury.clickatonJuryPrisma = new PrismaClient({
      datasources: { db: { url } },
    });
  }
  return globalForClickatonJury.clickatonJuryPrisma;
}
```

- [ ] **Step 3: Export it**

Agregar en `packages/db/src/index.ts`, junto a los otros clientes cruzados:

```ts
export {
  getClickatonJuryPrisma,
  getClickatonJuryConnectionInfo,
} from "./clickaton-jury-client";
```

- [ ] **Step 4: Verify it compiles**

Run: `cd packages/db && npx tsc --noEmit -p tsconfig.json`
Expected: sin errores. Si el paquete no tiene ese script, alcanza con el `check-types` de FotoRank en la tarea siguiente.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/clickaton-jury-client.ts packages/db/src/index.ts
git commit -m "Abrir la base de Clickatón al portal del jurado"
```

---

### Task 5: Decidir a qué base pertenece cada asignación

Pieza pura: dada una asignación, decir si sus obras y votos viven en la base propia o en la de Clickatón. Aísla la decisión más fácil de equivocar del plan.

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/jury/assignment-source.ts`
- Create: `apps/fotorank/app/lib/fotorank/jury/assignment-source.test.ts`
- Modify: `apps/fotorank/package.json` (script `test:jury-source`)

**Interfaces:**
- Consumes: `getClickatonJuryPrisma` de la Tarea 4.
- Produces:
  - `type JuryPlatform = "fotorank" | "clickaton"`
  - `platformForContest(contest: { distributionChannel: string | null }): JuryPlatform`
  - `prismaForPlatform(platform: JuryPlatform): PrismaClient` — lanza `JuryPlatformUnavailableError` si la de Clickatón no está configurada.
  - `class JuryPlatformUnavailableError extends Error`

- [ ] **Step 1: Write the failing test**

```ts
// apps/fotorank/app/lib/fotorank/jury/assignment-source.test.ts
/**
 * Un concurso distribuido por Clickatón guarda obras y votos en la base de
 * Clickatón. Equivocar esta decisión escribe el voto en la base que no es.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { platformForContest } from "./assignment-source";

test("un concurso de Clickatón vive en la base de Clickatón", () => {
  assert.equal(platformForContest({ distributionChannel: "CLICKATON" }), "clickaton");
});

test("un concurso propio vive en la base de FotoRank", () => {
  assert.equal(platformForContest({ distributionChannel: "FOTORANK" }), "fotorank");
});

test("sin canal declarado se asume FotoRank", () => {
  assert.equal(platformForContest({ distributionChannel: null }), "fotorank");
});

test("un canal desconocido se asume FotoRank y no rompe", () => {
  assert.equal(platformForContest({ distributionChannel: "OTRO" }), "fotorank");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/fotorank && npx tsx --test app/lib/fotorank/jury/assignment-source.test.ts`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/fotorank/app/lib/fotorank/jury/assignment-source.ts
/**
 * A qué base pertenecen las obras y los votos de una asignación.
 *
 * El portal es uno solo, pero los datos están repartidos: un concurso
 * distribuido por Clickatón tiene sus obras en la base de Clickatón.
 */
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@repo/db";
import { getClickatonJuryPrisma } from "@repo/db";

export type JuryPlatform = "fotorank" | "clickaton";

export class JuryPlatformUnavailableError extends Error {
  constructor() {
    super(
      "No se puede acceder a las obras de Clickatón en este momento. Volvé a intentar en un rato.",
    );
    this.name = "JuryPlatformUnavailableError";
  }
}

export function platformForContest(contest: {
  distributionChannel: string | null;
}): JuryPlatform {
  return contest.distributionChannel === "CLICKATON" ? "clickaton" : "fotorank";
}

export function prismaForPlatform(platform: JuryPlatform): PrismaClient {
  if (platform === "fotorank") return prisma as unknown as PrismaClient;
  const client = getClickatonJuryPrisma();
  if (!client) throw new JuryPlatformUnavailableError();
  return client;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/fotorank && npx tsx --test app/lib/fotorank/jury/assignment-source.test.ts`
Expected: PASS, 4 pruebas.

- [ ] **Step 5: Register the test script**

En `apps/fotorank/package.json`:

```json
"test:jury-source": "tsx --test app/lib/fotorank/jury/assignment-source.test.ts",
```

- [ ] **Step 6: Commit**

```bash
git add apps/fotorank/app/lib/fotorank/jury apps/fotorank/package.json
git commit -m "Decidir en qué base vive cada asignación de jurado"
```

---

### Task 6: El objeto que ve el jurado, con el anonimato vigilado

Un solo lugar decide qué se expone. La prueba falla si se cuela un dato del autor, así que el anonimato deja de depender de la memoria de quien edite.

**Files:**
- Create: `apps/fotorank/app/lib/fotorank/jury/entry-for-juror.ts`
- Create: `apps/fotorank/app/lib/fotorank/jury/entry-for-juror.test.ts`
- Modify: `apps/fotorank/package.json` (script `test:jury-entry`)

**Interfaces:**
- Consumes: `buildJuryPreviewPath` de la Tarea 1, reimplementado del lado de FotoRank (la firma es la misma; el secreto se comparte por variable de entorno).
- Produces:
  - `type JurorEntry = { id: string; anonymousCode: number | null; previewUrl: string | null; technicalSummaryStatus: string | null; warningCount: number; currentVote: JurorVote | null }`
  - `serializeEntryForJuror(input: { entry: RawEntry; clickatonBaseUrl: string | null; now?: Date }): JurorEntry`
  - `CAMPOS_PROHIBIDOS: readonly string[]`

- [ ] **Step 1: Write the failing test**

```ts
// apps/fotorank/app/lib/fotorank/jury/entry-for-juror.test.ts
/**
 * El objeto que llega a la pantalla del jurado no puede identificar al autor.
 * Esta prueba es la que sostiene el anonimato: si alguien agrega un campo del
 * autor "para mostrarlo en el tooltip", acá se entera.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { CAMPOS_PROHIBIDOS, serializeEntryForJuror } from "./entry-for-juror";

const CRUDA = {
  id: "e1",
  entryNumber: 7,
  technicalSummaryStatus: "APPROVED",
  authorUserId: 42,
  clickatonParticipantNumber: "CK-0123",
  externalRegistrationId: "reg-1",
  imageUrl: "https://ejemplo/original.jpg",
  title: "Retrato de mi hermana",
  description: "Tomada en el patio de casa",
  assets: [{ id: "asset-1" }],
  votes: [],
  checks: [{ status: "WARNING" }, { status: "OK" }],
};

const BASE = "https://maratonfotografica.com";

test("expone el código anónimo y no el autor", () => {
  const out = serializeEntryForJuror({ entry: CRUDA, clickatonBaseUrl: BASE });
  assert.equal(out.anonymousCode, 7);
  const claves = Object.keys(out);
  for (const prohibido of CAMPOS_PROHIBIDOS) {
    assert.ok(!claves.includes(prohibido), `se filtró "${prohibido}"`);
  }
});

test("ningún valor del objeto contiene datos del autor", () => {
  const out = serializeEntryForJuror({ entry: CRUDA, clickatonBaseUrl: BASE });
  const serializado = JSON.stringify(out);
  for (const rastro of ["CK-0123", "reg-1", "Retrato de mi hermana", "42"]) {
    assert.ok(!serializado.includes(rastro), `se filtró "${rastro}"`);
  }
});

test("arma el enlace de vista previa apuntando a Clickatón", () => {
  const out = serializeEntryForJuror({ entry: CRUDA, clickatonBaseUrl: BASE });
  assert.ok(out.previewUrl?.startsWith(`${BASE}/api/jurado/media/asset-1?`));
  assert.ok(out.previewUrl?.includes("sig="));
  assert.ok(out.previewUrl?.includes("exp="));
});

test("sin vista previa el enlace es nulo, no una cadena vacía", () => {
  const out = serializeEntryForJuror({
    entry: { ...CRUDA, assets: [] },
    clickatonBaseUrl: BASE,
  });
  assert.equal(out.previewUrl, null);
});

test("cuenta las advertencias técnicas", () => {
  const out = serializeEntryForJuror({ entry: CRUDA, clickatonBaseUrl: BASE });
  assert.equal(out.warningCount, 1);
});

test("un concurso propio de FotoRank no necesita base externa", () => {
  const out = serializeEntryForJuror({ entry: CRUDA, clickatonBaseUrl: null });
  assert.equal(out.previewUrl, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/fotorank && npx tsx --test app/lib/fotorank/jury/entry-for-juror.test.ts`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/fotorank/app/lib/fotorank/jury/entry-for-juror.ts
/**
 * Único lugar que decide qué ve el jurado de una obra.
 *
 * Todo lo que no esté acá, no llega a la pantalla. La lista de campos
 * prohibidos existe para que la prueba pueda vigilarla.
 */
import { createHmac } from "node:crypto";

/** Debe coincidir con PURPOSE de apps/clickaton/lib/jury-media/signed-link.ts */
const PURPOSE = "clickaton:jury-preview:v1";
const VIGENCIA_MS = 15 * 60 * 1000;

export const CAMPOS_PROHIBIDOS = [
  "authorUserId",
  "clickatonParticipantNumber",
  "externalRegistrationId",
  "externalParticipantId",
  "imageUrl",
  "title",
  "description",
] as const;

export type JurorVote = {
  id: string;
  valueNumeric: number | null;
  valueBoolean: boolean | null;
  isFavorite: boolean | null;
  selectedRank: number | null;
  version: number;
};

export type JurorEntry = {
  id: string;
  anonymousCode: number | null;
  previewUrl: string | null;
  technicalSummaryStatus: string | null;
  warningCount: number;
  currentVote: JurorVote | null;
};

type RawEntry = {
  id: string;
  entryNumber: number | null;
  technicalSummaryStatus: string | null;
  assets: Array<{ id: string }>;
  votes: Array<JurorVote>;
  checks: Array<{ status: string }>;
};

function juryMediaSecret(): string {
  const secret =
    process.env.CLICKATON_JURY_MEDIA_SECRET?.trim() ||
    process.env.DNX_SESSION_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error(
      "CLICKATON_JURY_MEDIA_SECRET (o DNX_SESSION_SECRET) es obligatorio para mostrar obras de Clickatón",
    );
  }
  return secret;
}

function signedPreviewUrl(assetId: string, baseUrl: string, now: Date): string {
  const expMs = now.getTime() + VIGENCIA_MS;
  const sig = createHmac("sha256", juryMediaSecret())
    .update(`${PURPOSE}:${assetId}:${expMs}`)
    .digest("base64url");
  const qs = new URLSearchParams({ exp: String(expMs), sig });
  return `${baseUrl}/api/jurado/media/${encodeURIComponent(assetId)}?${qs.toString()}`;
}

export function serializeEntryForJuror(input: {
  entry: RawEntry;
  clickatonBaseUrl: string | null;
  now?: Date;
}): JurorEntry {
  const asset = input.entry.assets[0];
  return {
    id: input.entry.id,
    anonymousCode: input.entry.entryNumber,
    previewUrl:
      asset && input.clickatonBaseUrl
        ? signedPreviewUrl(asset.id, input.clickatonBaseUrl, input.now ?? new Date())
        : null,
    technicalSummaryStatus: input.entry.technicalSummaryStatus,
    warningCount: input.entry.checks.filter(
      (c) => c.status === "WARNING" || c.status === "REQUIRES_REVIEW",
    ).length,
    currentVote: input.entry.votes[0] ?? null,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `CLICKATON_JURY_MEDIA_SECRET=secreto-de-prueba-largo-1234 npx tsx --test app/lib/fotorank/jury/entry-for-juror.test.ts`
Expected: PASS, 6 pruebas.

- [ ] **Step 5: Register the test script**

En `apps/fotorank/package.json`:

```json
"test:jury-entry": "CLICKATON_JURY_MEDIA_SECRET=secreto-de-prueba-largo-1234 tsx --test app/lib/fotorank/jury/entry-for-juror.test.ts",
```

- [ ] **Step 6: Commit**

```bash
git add apps/fotorank/app/lib/fotorank/jury/entry-for-juror.ts apps/fotorank/app/lib/fotorank/jury/entry-for-juror.test.ts apps/fotorank/package.json
git commit -m "Vigilar el anonimato de la obra con una prueba"
```

---

### Task 7: La pantalla de evaluación muestra la foto

Arregla el defecto que hoy rompe la evaluación en las dos plataformas: la pantalla pide `entry.imageUrl`, que la consulta nunca devuelve, y el `as any[]` lo tapaba.

**Files:**
- Modify: `apps/fotorank/app/actions/judges.ts:1318-1372` (`listEntriesForAssignment`)
- Modify: `apps/fotorank/app/jurado/asignaciones/[assignmentId]/evaluar/page.tsx:62`
- Modify: `apps/fotorank/app/jurado/asignaciones/[assignmentId]/evaluar/EvaluationClient.tsx:12-31,279-287`

**Interfaces:**
- Consumes: `serializeEntryForJuror` y `JurorEntry` de la Tarea 6; `platformForContest` y `prismaForPlatform` de la Tarea 5.
- Produces: `listEntriesForAssignment(assignmentId: string): Promise<JudgeActionResult<JurorEntry[]>>` — el tipo deja de ser `Array<Record<string, unknown>>`.

- [ ] **Step 1: Type the action's return**

En `listEntriesForAssignment`, cambiar la firma a `Promise<JudgeActionResult<JurorEntry[]>>`, leer el concurso para saber la plataforma, elegir el cliente y devolver el resultado de `serializeEntryForJuror`. Eliminar el campo `evaluationMessage` y el `hasJuryPreview` booleano: los reemplaza `previewUrl`.

El `where` de la consulta no cambia: `status: "CONFIRMED"`, `withdrawnAt: null`, `entryNumber: { not: null }`, y el asset `isActive: true, kind: "JURY_PREVIEW"`.

- [ ] **Step 2: Remove the `as any[]`**

En `page.tsx`, reemplazar:

```tsx
entries={(entriesResult.data ?? []) as any[]}
```

por:

```tsx
entries={entriesResult.data ?? []}
```

- [ ] **Step 3: Use the preview in the screen**

En `EvaluationClient.tsx`, reemplazar el tipo `Entry` por `JurorEntry` importado de la Tarea 6, y el bloque de imagen y encabezado:

```tsx
{entry.previewUrl ? (
  <img
    src={entry.previewUrl}
    alt={`Obra ${entry.anonymousCode ?? ""}`}
    className="w-full max-h-[520px] rounded-lg border border-zinc-700 object-contain"
  />
) : (
  <div className="flex h-64 items-center justify-center rounded-lg border border-zinc-700 text-sm text-fr-muted">
    Esta obra todavía no tiene vista previa lista para evaluar.
  </div>
)}
<div>
  <h2 className="text-lg font-semibold text-fr-primary">
    Obra {entry.anonymousCode ?? "sin número"}
  </h2>
  <p className="text-sm text-fr-muted">
    Evaluación anónima: no se muestra quién tomó la fotografía.
  </p>
</div>
```

- [ ] **Step 4: Verify types catch what the `as any` hid**

Run: `cd apps/fotorank && NODE_OPTIONS="--max-old-space-size=8192" pnpm check-types`
Expected: sin errores. Si aparece un error por `title` o `description`, es el defecto que estaba tapado: quitar esos usos.

- [ ] **Step 5: Run the jury tests**

Run: `cd apps/fotorank && pnpm test:jury-entry && pnpm test:jury-source`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/fotorank/app/actions/judges.ts 'apps/fotorank/app/jurado/asignaciones/[assignmentId]/evaluar'
git commit -m "Mostrarle la foto al jurado"
```

---

### Task 8: El panel junta las asignaciones de ambas plataformas

**Files:**
- Modify: `apps/fotorank/app/actions/judges.ts:1262-1317` (`listJudgeAssignmentsForCurrentJudge`)
- Modify: `apps/fotorank/app/jurado/panel/page.tsx`

**Interfaces:**
- Consumes: `prismaForPlatform`, `JuryPlatformUnavailableError` de la Tarea 5.
- Produces: cada fila del listado suma `platform: JuryPlatform` y `platformLabel: string`.

- [ ] **Step 1: Read assignments from both bases**

En `listJudgeAssignmentsForCurrentJudge`, además de la consulta actual sobre `prisma`, consultar `getClickatonJuryPrisma()` con el mismo `where: { judgeAccountId: judge.id }`. Si el cliente no está configurado o la consulta falla, **no romper el panel**: devolver las propias y marcar el faltante.

```ts
let clickatonAssignments: typeof assignments = [];
let clickatonUnavailable = false;
const clickatonPrisma = getClickatonJuryPrisma();
if (clickatonPrisma) {
  try {
    clickatonAssignments = await clickatonPrisma.fotorankJudgeAssignment.findMany({
      where: { judgeAccountId: judge.id },
      include: { contest: true, category: true, votes: true },
      orderBy: { updatedAt: "desc" },
    });
  } catch {
    // Clickatón caído no puede dejar al jurado sin ver sus otras asignaciones.
    clickatonUnavailable = true;
  }
}
```

Etiquetar cada fila con `platform` y `platformLabel` ("Clickatón" / "FotoRank") antes de concatenar.

- [ ] **Step 2: Show the label and the warning**

En `app/jurado/panel/page.tsx`, mostrar `platformLabel` como insignia en cada tarjeta, y cuando `clickatonUnavailable` sea verdadero, un aviso explícito:

```tsx
<Card>
  <p className="text-sm text-amber-300" role="status">
    No pudimos traer tus asignaciones de Clickatón en este momento. Volvé a
    entrar en un rato; las demás se muestran igual.
  </p>
</Card>
```

Este aviso es lo que evita que una caída se vea como "no tengo trabajo asignado".

- [ ] **Step 3: Verify types and lint**

Run: `cd apps/fotorank && NODE_OPTIONS="--max-old-space-size=8192" pnpm check-types`
Run: `cd apps/fotorank && npx eslint --max-warnings 0 app/actions/judges.ts app/jurado/panel/page.tsx`
Expected: ambos sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/fotorank/app/actions/judges.ts apps/fotorank/app/jurado/panel/page.tsx
git commit -m "Juntar las asignaciones de las dos plataformas en un panel"
```

---

### Task 9: El voto se guarda en la base correcta

**Files:**
- Modify: `apps/fotorank/app/actions/judges.ts:1373-1450` (`saveJudgeVote`)
- Modify: `apps/fotorank/app/lib/fotorank/judgeEvaluationGate.ts` (el portón debe consultar la base correcta)

**Interfaces:**
- Consumes: `platformForContest`, `prismaForPlatform` de la Tarea 5.
- Produces: nada nuevo; cambia hacia dónde escribe.

- [ ] **Step 1: Resolve the client once, at the top**

En `saveJudgeVote`, después de obtener la asignación por el portón, resolver el cliente y **usarlo en todas** las consultas siguientes: la búsqueda de la obra, la búsqueda del voto existente y la escritura. Un cliente mezclado es el error más probable de esta tarea.

- [ ] **Step 2: Do the same in the gate**

`gateJudgeEvaluationForJudge` y `loadJudgeAssignmentScoped` cargan la asignación. Deben buscarla primero en la base propia y, si no está, en la de Clickatón — o recibir la plataforma como parámetro. Preferir lo segundo: explícito y sin consultas de más.

- [ ] **Step 3: Verify types**

Run: `cd apps/fotorank && NODE_OPTIONS="--max-old-space-size=8192" pnpm check-types`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/fotorank/app/actions/judges.ts apps/fotorank/app/lib/fotorank/judgeEvaluationGate.ts
git commit -m "Guardar el voto en la base de la plataforma que corresponde"
```

---

### Task 10: La ficha espejo del jurado en Clickatón

Sin esto no se puede asignar un jurado a una maratón: la asignación tiene clave foránea a la cuenta, y la cuenta exige `workspaceId` y `passwordHash`.

**Files:**
- Create: `apps/clickaton/lib/jury-mirror/mirror-judge.ts`
- Create: `apps/clickaton/lib/jury-mirror/mirror-judge.test.ts`
- Modify: `apps/clickaton/package.json` (script `test:jury-mirror`)

**Interfaces:**
- Consumes: nada.
- Produces:
  - `SENTINEL_PASSWORD_HASH: string`
  - `isSentinelPasswordHash(value: string): boolean`
  - `JURY_WORKSPACE_ID: string`
  - `mirrorJudgeAccount(input: { prisma: PrismaLike; judge: { id: string; email: string } }): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
// apps/clickaton/lib/jury-mirror/mirror-judge.test.ts
/**
 * La ficha espejo del jurado existe sólo para que las claves foráneas cierren.
 * No es una cuenta: su passwordHash es un centinela que ninguna contraseña
 * puede satisfacer.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  SENTINEL_PASSWORD_HASH,
  isSentinelPasswordHash,
} from "./mirror-judge";

test("el centinela no parece un hash válido de bcrypt ni de argon2", () => {
  assert.ok(!SENTINEL_PASSWORD_HASH.startsWith("$2"));
  assert.ok(!SENTINEL_PASSWORD_HASH.startsWith("$argon2"));
  assert.ok(!SENTINEL_PASSWORD_HASH.startsWith("$"));
});

test("el centinela se reconoce", () => {
  assert.equal(isSentinelPasswordHash(SENTINEL_PASSWORD_HASH), true);
});

test("un hash real no se confunde con el centinela", () => {
  assert.equal(
    isSentinelPasswordHash("$2b$10$abcdefghijklmnopqrstuv0123456789012345678901234567890"),
    false,
  );
  assert.equal(isSentinelPasswordHash(""), false);
});

test("el centinela dice en texto que no es una cuenta", () => {
  assert.match(SENTINEL_PASSWORD_HASH, /no-login/);
});

test("ninguna ruta de Clickatón autentica contra la tabla espejo", async () => {
  // La copia no es una puerta de entrada. Si alguien más adelante intenta
  // usarla para iniciar sesión, esta prueba se lo dice.
  const { execFileSync } = await import("node:child_process");
  let salida = "";
  try {
    salida = execFileSync(
      "grep",
      ["-rn", "fotorankJudgeAccount", "app", "lib"],
      { encoding: "utf8" },
    );
  } catch {
    // grep sale con 1 cuando no encuentra nada: es el caso bueno.
    salida = "";
  }
  const sospechosas = salida
    .split("\n")
    .filter((l) => l.trim() && !l.includes("lib/jury-mirror/"));
  assert.deepEqual(
    sospechosas,
    [],
    `Sólo lib/jury-mirror puede tocar fotorankJudgeAccount en Clickatón:\n${sospechosas.join("\n")}`,
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/clickaton && npx tsx --test lib/jury-mirror/mirror-judge.test.ts`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Write minimal implementation**

```ts
// apps/clickaton/lib/jury-mirror/mirror-judge.ts
/**
 * Ficha espejo del jurado en la base de Clickatón.
 *
 * No es una cuenta y no sirve para entrar: la identidad se valida siempre
 * contra el padrón maestro, que vive en la base de FotoRank. Esta fila existe
 * únicamente porque `FotorankJudgeAssignment` tiene clave foránea a
 * `FotorankJudgeAccount`, y las claves foráneas no cruzan bases.
 */

/**
 * Valor imposible para `passwordHash`. No empieza con `$`, así que ningún
 * verificador de bcrypt o argon2 lo acepta como hash, y el texto avisa qué es.
 */
export const SENTINEL_PASSWORD_HASH = "espejo-no-login:sin-credencial-en-clickaton";

export function isSentinelPasswordHash(value: string): boolean {
  return value === SENTINEL_PASSWORD_HASH;
}

/** Workspace único que sostiene las fichas espejo. */
export const JURY_WORKSPACE_ID = "ck-workspace-jurados";
export const JURY_WORKSPACE_NAME = "Jurados";

type PrismaLike = {
  workspace: {
    upsert(args: unknown): Promise<unknown>;
  };
  fotorankJudgeAccount: {
    upsert(args: unknown): Promise<unknown>;
  };
  $transaction<T>(fn: (tx: PrismaLike) => Promise<T>): Promise<T>;
};

export async function mirrorJudgeAccount(input: {
  prisma: PrismaLike;
  judge: { id: string; email: string };
}): Promise<void> {
  await input.prisma.$transaction(async (tx) => {
    await tx.workspace.upsert({
      where: { id: JURY_WORKSPACE_ID },
      create: { id: JURY_WORKSPACE_ID, name: JURY_WORKSPACE_NAME },
      update: {},
    });
    await tx.fotorankJudgeAccount.upsert({
      where: { id: input.judge.id },
      create: {
        id: input.judge.id,
        workspaceId: JURY_WORKSPACE_ID,
        email: input.judge.email,
        passwordHash: SENTINEL_PASSWORD_HASH,
        accountStatus: "ACTIVE",
      },
      update: { email: input.judge.email },
    });
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/clickaton && npx tsx --test lib/jury-mirror/mirror-judge.test.ts`
Expected: PASS, 5 pruebas.

- [ ] **Step 5: Check the Workspace model's required columns**

Antes de dar por buena la creación del workspace, verificar qué columnas obligatorias tiene `Workspace` en el esquema:

Run: `grep -n -A20 "^model Workspace" packages/db/prisma/schema.prisma`

Si hay más columnas obligatorias sin valor por defecto, agregarlas al `create`. **No agregar columnas nuevas al esquema.**

- [ ] **Step 6: Register the test script and commit**

En `apps/clickaton/package.json`:

```json
"test:jury-mirror": "tsx --test lib/jury-mirror/*.test.ts",
```

```bash
git add apps/clickaton/lib/jury-mirror apps/clickaton/package.json
git commit -m "Crear la ficha espejo del jurado sin credencial"
```

---

### Task 11: La marca del concurso en el portal

Último por ser lo único puramente estético.

**Files:**
- Modify: `apps/fotorank/app/jurado/panel/page.tsx`
- Modify: `apps/fotorank/app/jurado/asignaciones/[assignmentId]/evaluar/page.tsx`

**Interfaces:**
- Consumes: `platform` de la Tarea 8.
- Produces: nada.

- [ ] **Step 1: Show the platform in the header**

En la pantalla de evaluación, encabezar con el nombre del concurso y la plataforma, para que el jurado sepa dónde está parado:

```tsx
<h1 className="text-2xl font-semibold text-fr-primary">
  {assignment.contest.title}
</h1>
<p className="text-sm text-fr-muted">{platformLabel}</p>
```

- [ ] **Step 2: Verify types and commit**

Run: `cd apps/fotorank && NODE_OPTIONS="--max-old-space-size=8192" pnpm check-types`

```bash
git add 'apps/fotorank/app/jurado'
git commit -m "Mostrar de qué plataforma es cada concurso"
```

---

### Task 12: Mantener el padrón desde Clickatón

El pedido explícito: que el padrón de jurados se mantenga desde las dos
plataformas. Clickatón no tiene su propio padrón — escribe contra el maestro,
que vive en la base de FotoRank.

**Files:**
- Create: `packages/db/src/jury-directory-client.ts`
- Modify: `packages/db/src/index.ts`
- Create: `apps/clickaton/lib/jury-directory/service.ts`
- Create: `apps/clickaton/lib/jury-directory/service.test.ts`
- Modify: `apps/clickaton/package.json` (script `test:jury-directory`)

**Interfaces:**
- Consumes: `mirrorJudgeAccount`, `JURY_WORKSPACE_ID` de la Tarea 10.
- Produces:
  - `getJuryDirectoryPrisma(): PrismaClient | null` — cliente hacia el padrón maestro.
  - `listJudges(): Promise<Array<{ id: string; email: string; accountStatus: string }>>`
  - `inviteJudge(input: { email: string; workspaceId: string }): Promise<{ ok: true; judgeId: string } | { ok: false; reason: "NOT_CONFIGURED" | "ALREADY_EXISTS" | "INVALID_EMAIL" }>`

- [ ] **Step 1: Write the directory client**

Copia exacta de la forma de `clickaton-jury-client.ts` de la Tarea 4, cambiando
la variable de entorno a `JURY_DIRECTORY_DATABASE_URL` y el nombre memorizado a
`juryDirectoryPrisma`. Es el mismo patrón en el sentido inverso: Clickatón
alcanzando la base de FotoRank.

- [ ] **Step 2: Write the failing test**

```ts
// apps/clickaton/lib/jury-directory/service.test.ts
/**
 * El alta de un jurado desde Clickatón escribe en el padrón maestro, nunca en
 * la copia local. Sin padrón configurado, avisa en vez de inventar una cuenta.
 */
import assert from "node:assert/strict";
import test from "node:test";

import { inviteJudge, validateJudgeEmail } from "./service";

test("un email inválido se rechaza antes de tocar la base", async () => {
  const r = await inviteJudge({
    email: "no-es-un-email",
    workspaceId: "w1",
    prisma: null,
  });
  assert.equal(r.ok === false && r.reason, "INVALID_EMAIL");
});

test("sin padrón configurado avisa y no crea nada local", async () => {
  const r = await inviteJudge({
    email: "jurado@ejemplo.com",
    workspaceId: "w1",
    prisma: null,
  });
  assert.equal(r.ok === false && r.reason, "NOT_CONFIGURED");
});

test("un email repetido no crea una segunda cuenta", async () => {
  const prisma = {
    fotorankJudgeAccount: {
      findUnique: async () => ({ id: "j1" }),
      create: async () => {
        throw new Error("no debería crear");
      },
    },
  };
  const r = await inviteJudge({
    email: "jurado@ejemplo.com",
    workspaceId: "w1",
    prisma,
  });
  assert.equal(r.ok === false && r.reason, "ALREADY_EXISTS");
});

test("un alta nueva devuelve el identificador del maestro", async () => {
  const prisma = {
    fotorankJudgeAccount: {
      findUnique: async () => null,
      create: async () => ({ id: "j-nuevo" }),
    },
  };
  const r = await inviteJudge({
    email: "jurado@ejemplo.com",
    workspaceId: "w1",
    prisma,
  });
  assert.equal(r.ok === true && r.judgeId, "j-nuevo");
});

test("el email se normaliza a minúsculas y sin espacios", () => {
  assert.equal(validateJudgeEmail("  Jurado@Ejemplo.COM "), "jurado@ejemplo.com");
  assert.equal(validateJudgeEmail("roto@"), null);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd apps/clickaton && npx tsx --test lib/jury-directory/service.test.ts`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Write minimal implementation**

```ts
// apps/clickaton/lib/jury-directory/service.ts
/**
 * Alta y consulta de jurados desde Clickatón.
 *
 * El padrón es uno solo y vive en la base de FotoRank. Acá nunca se crea una
 * cuenta local: la ficha espejo (lib/jury-mirror) es otra cosa y no autentica.
 */

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateJudgeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  return EMAIL.test(email) ? email : null;
}

type DirectoryPrisma = {
  fotorankJudgeAccount: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
};

export type InviteJudgeResult =
  | { ok: true; judgeId: string }
  | { ok: false; reason: "NOT_CONFIGURED" | "ALREADY_EXISTS" | "INVALID_EMAIL" };

export async function inviteJudge(input: {
  email: string;
  workspaceId: string;
  prisma: DirectoryPrisma | null;
}): Promise<InviteJudgeResult> {
  const email = validateJudgeEmail(input.email);
  if (!email) return { ok: false, reason: "INVALID_EMAIL" };
  if (!input.prisma) return { ok: false, reason: "NOT_CONFIGURED" };

  const existing = await input.prisma.fotorankJudgeAccount.findUnique({
    where: { workspaceId_email: { workspaceId: input.workspaceId, email } },
  });
  if (existing) return { ok: false, reason: "ALREADY_EXISTS" };

  // accountStatus INVITED es el valor por defecto: la contraseña la crea la
  // persona desde el correo de invitación, nunca desde acá.
  const created = await input.prisma.fotorankJudgeAccount.create({
    data: { workspaceId: input.workspaceId, email },
  });
  return { ok: true, judgeId: created.id };
}
```

- [ ] **Step 5: Verify the unique key exists**

El `findUnique` usa `workspaceId_email`. Confirmar que ese índice único existe:

Run: `grep -n -A12 "^model FotorankJudgeAccount" packages/db/prisma/schema.prisma | grep -i unique`

Si el índice único tiene otro nombre o es sólo `email`, ajustar el `where` a lo
que exista. **No agregar índices nuevos al esquema.**

- [ ] **Step 6: Run test to verify it passes**

Run: `cd apps/clickaton && npx tsx --test lib/jury-directory/service.test.ts`
Expected: PASS, 5 pruebas.

- [ ] **Step 7: Register and commit**

En `apps/clickaton/package.json`:

```json
"test:jury-directory": "tsx --test lib/jury-directory/*.test.ts",
```

```bash
git add apps/clickaton/lib/jury-directory packages/db/src/jury-directory-client.ts packages/db/src/index.ts apps/clickaton/package.json
git commit -m "Dar de alta jurados desde Clickatón contra el padrón único"
```

---

### Task 13: Documentar las variables de entorno

Sin estas variables nada de lo anterior funciona en producción, y el síntoma es
silencioso: el panel muestra menos asignaciones de las que hay.

**Files:**
- Modify: `apps/clickaton/.env.example`
- Modify: `apps/fotorank/.env.example`

**Interfaces:**
- Consumes: todas las tareas anteriores.
- Produces: nada.

- [ ] **Step 1: Document them**

En `apps/clickaton/.env.example`:

```bash
# Firma de los enlaces de vista previa del jurado. Debe ser EL MISMO valor que
# en FotoRank, o el jurado no ve ninguna foto. Mínimo 16 caracteres.
CLICKATON_JURY_MEDIA_SECRET=
# Padrón maestro de jurados (base de FotoRank). Sin esto no se pueden dar de
# alta jurados desde Clickatón.
JURY_DIRECTORY_DATABASE_URL=
```

En `apps/fotorank/.env.example`:

```bash
# Base operativa de Clickatón: de ahí salen las obras de una maratón y ahí van
# los votos. Sin esto el panel del jurado muestra sólo los concursos propios.
CLICKATON_JURY_DATABASE_URL=
# Mismo valor que CLICKATON_JURY_MEDIA_SECRET en Clickatón.
CLICKATON_JURY_MEDIA_SECRET=
# Origen público de Clickatón, para armar los enlaces de vista previa.
CLICKATON_PUBLIC_BASE_URL=https://maratonfotografica.com
```

- [ ] **Step 2: Commit**

```bash
git add apps/clickaton/.env.example apps/fotorank/.env.example
git commit -m "Documentar las variables del jurado compartido"
```

---

## Verificación final

- [ ] **Todas las pruebas nuevas**

```bash
cd apps/clickaton && pnpm test:jury-media && pnpm test:jury-mirror && pnpm test:jury-directory
cd ../fotorank && pnpm test:jury-source && pnpm test:jury-entry
```

- [ ] **Tipos y lint de las dos apps**

```bash
cd apps/clickaton && NODE_OPTIONS="--max-old-space-size=8192" pnpm check-types
cd ../fotorank && NODE_OPTIONS="--max-old-space-size=8192" pnpm check-types
```

- [ ] **Compilar Clickatón**

```bash
cd apps/clickaton && NODE_OPTIONS="--max-old-space-size=8192" SKIP_ENV_VALIDATION=1 pnpm build
```

- [ ] **Lo que NO queda verificado y hay que decir**

El recorrido completo contra bases reales (alta, asignación, listado, voto) necesita `CLICKATON_JURY_DATABASE_URL` y `CLICKATON_JURY_MEDIA_SECRET` configurados en Vercel, y ramas Neon de prueba. Mientras eso no exista, el trabajo está verificado por pruebas y tipos, **no** por un jurado real evaluando una foto real. Decirlo así, sin adornar.
