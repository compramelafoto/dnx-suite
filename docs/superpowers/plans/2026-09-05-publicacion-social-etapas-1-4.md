# Publicación social de DNX Suite — Etapas 1 a 4

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que CompraMeLaFoto publique en Instagram un carrusel y una historia cuando un álbum queda analizado, etiquetando al fotógrafo como colaborador, con aprobación humana obligatoria.

**Architecture:** Tres paquetes compartidos y una app que los usa. `@repo/social-publisher` habla con Meta (conexión, tokens, publicación, estados). `@repo/design-studio` arma la imagen y no sabe de red. `@repo/social-pieces` (nuevo) une los dos: toma una plantilla y datos, produce un JPEG, lo sube a R2 y crea la solicitud. `apps/compramelafoto` decide cuándo, con qué fotos y con qué permiso.

**Tech Stack:** TypeScript, Node 22, pnpm workspaces, Prisma, Next.js 16, `tsx --test` (node:test) para los paquetes, vitest para CLF, `sharp` para la conversión a JPEG, R2 (S3 compatible).

**Spec:** `docs/superpowers/specs/2026-09-05-publicacion-social-dnx-suite-design.md`

## Global Constraints

- **Sin cambios de schema de Prisma.** Un campo nuevo hay que aplicarlo a mano en las cinco bases Neon o rompe las escrituras de las otras apps. Todo lo que haga falta va en los campos `Json` que ya existen (`DnxSocialPublishRequest.metadata`, `DnxSocialAccount.metadata`).
- **Nada se publica sin aprobación humana.** Toda solicitud nace en `PENDING_APPROVAL`.
- **Simulacro por defecto.** Sin `DNX_SOCIAL_PUBLISHER_LIVE=true` el provider no llama a Meta.
- **Meta acepta únicamente JPEG.** Ni PNG, ni WEBP, ni JPEG extendido (MPO/JPS).
- **Meta exige URL pública** para el media: no acepta recibir bytes. Todo asset sube a R2 antes.
- **El parámetro `collaborators` va en el contenedor padre del carrusel, nunca en los hijos.**
- **Historias:** sin copy, sin colaboradores, sin stickers. Meta no lo permite por API.
- **Límite Meta:** 100 publicaciones por API cada 24 h por cuenta; un carrusel cuenta como una.
- **Los tokens duran 60 días.** Se renuevan si tienen ≥24 h de vida y no vencieron.
- **Ningún dato de documento** (`documentType`, `documentNumber`) puede entrar en una plantilla de publicación.
- **Los disparadores son soft-fail:** si crear la solicitud falla, no debe romper la operación que la disparó.
- **Idioma:** comentarios, mensajes de error de cara al usuario y textos de UI en español rioplatense.
- Versión de Graph API fija en el cliente: `v21.0` (constante ya existente en `graph-client.ts`).

---

## Estructura de archivos

**`packages/social-publisher/src/`** — el motor
- `providers/instagram/oauth.ts` (nuevo) — construir la URL de login y canjear el código por token largo
- `providers/instagram/token-refresh.ts` (nuevo) — decidir y ejecutar la renovación
- `providers/instagram/publishing-limit.ts` (nuevo) — consultar el cupo de 100/24 h
- `providers/instagram/instagram-publish.ts` (modificar) — carrusel e historia
- `mentions.ts` (nuevo) — repartir menciones entre colaboradores y copy
- `types.ts` (modificar) — `PublishFormat`, `collaborators`
- `providers/types.ts` (modificar) — pasar formato y colaboradores al provider
- `engine.ts` (modificar) — leer formato y colaboradores de `metadata` y pasarlos
- `index.ts` (modificar) — exportar lo nuevo
- `oauth.test.ts`, `token-refresh.test.ts`, `mentions.test.ts`, `carousel.test.ts` (nuevos)

**`packages/social-pieces/src/`** — el puente (paquete nuevo)
- `types.ts` — contrato de pieza y puertos
- `render.ts` — documento del Designer + datos → JPEG
- `publish-piece.ts` — JPEG → R2 → solicitud
- `social-pieces.test.ts`

**`apps/compramelafoto/`** — el cableado
- `lib/social/album-social-consent.ts` — permiso y selección de fotos (decisión pura + consulta)
- `lib/social/album-piece-templates.ts` — los dos documentos del Designer
- `lib/social/build-album-pieces.ts` — arma carrusel e historia de un álbum
- `lib/social/prisma-store.ts` — almacén Prisma del motor
- `lib/social/worker.ts` — worker que procesa lo vencido
- `lib/cron/send-album-notifications.ts` (modificar) — disparador soft-fail
- `app/api/cron/social-publish/route.ts` — cron
- `app/api/social/instagram/connect/route.ts` y `.../callback/route.ts` — conexión
- `app/admin/social/page.tsx` — panel de aprobación
- `vitest.social.config.ts` + script `test:social`

---

## Etapa 1 — Conexión con Meta

### Task 1: Login de Instagram y canje del código por token largo

**Files:**
- Create: `packages/social-publisher/src/providers/instagram/oauth.ts`
- Create: `packages/social-publisher/src/providers/instagram/oauth.test.ts`
- Modify: `packages/social-publisher/src/index.ts`
- Modify: `packages/social-publisher/package.json` (script `test`)

**Interfaces:**
- Consumes: `SocialPublisherError` de `../../types`.
- Produces: `InstagramOAuthConfig`, `buildInstagramAuthorizeUrl(config, state)`, `InstagramConnectedAccount`, `exchangeInstagramCode(config, code, deps?)`.

**Contexto que el implementador necesita.** Se usa **Instagram Login** (no Facebook Login) porque no exige una página de Facebook vinculada. El canje son tres llamadas encadenadas, a **tres hosts distintos**, y es fácil equivocarse:

1. `POST https://api.instagram.com/oauth/access_token` con cuerpo `application/x-www-form-urlencoded`: `client_id`, `client_secret`, `grant_type=authorization_code`, `redirect_uri`, `code`. Devuelve `{ access_token, user_id, permissions }`. Ese token es **de corta duración**.
2. `GET https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=...&access_token=...`. Devuelve `{ access_token, token_type, expires_in }` con `expires_in` en **segundos** (unos 5.184.000 = 60 días).
3. `GET https://graph.instagram.com/v21.0/me?fields=user_id,username&access_token=...` para saber a qué cuenta corresponde.

El `redirect_uri` del paso 1 tiene que ser **idéntico** al que se usó al pedir el código, o Meta rechaza el canje.

- [ ] **Step 1: Escribir el test que falla**

```ts
// packages/social-publisher/src/providers/instagram/oauth.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildInstagramAuthorizeUrl,
  exchangeInstagramCode,
  type InstagramOAuthConfig,
} from "./oauth";

const config: InstagramOAuthConfig = {
  appId: "111",
  appSecret: "secreto",
  redirectUri: "https://clf.test/api/social/instagram/callback",
};

test("la URL de autorización lleva los permisos y el state", () => {
  const url = new URL(buildInstagramAuthorizeUrl(config, "estado-123"));
  assert.equal(url.host, "www.instagram.com");
  assert.equal(url.pathname, "/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "111");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("state"), "estado-123");
  assert.equal(
    url.searchParams.get("scope"),
    "instagram_business_basic,instagram_business_content_publish",
  );
  assert.equal(url.searchParams.get("redirect_uri"), config.redirectUri);
});

test("el canje encadena las tres llamadas y devuelve el token largo", async () => {
  const llamadas: string[] = [];
  const fetchImpl = (async (input: string | URL) => {
    const url = String(input);
    llamadas.push(url);
    if (url.startsWith("https://api.instagram.com/oauth/access_token")) {
      return new Response(
        JSON.stringify({ access_token: "corto", user_id: "17841400000000000" }),
        { status: 200 },
      );
    }
    if (url.startsWith("https://graph.instagram.com/access_token")) {
      return new Response(
        JSON.stringify({ access_token: "largo", expires_in: 5184000 }),
        { status: 200 },
      );
    }
    return new Response(
      JSON.stringify({ user_id: "17841400000000000", username: "compramelafoto" }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const cuenta = await exchangeInstagramCode(config, "codigo-abc", {
    fetchImpl,
    now: () => new Date("2026-09-05T12:00:00Z"),
  });

  assert.equal(cuenta.accessToken, "largo");
  assert.equal(cuenta.externalAccountId, "17841400000000000");
  assert.equal(cuenta.username, "compramelafoto");
  assert.equal(cuenta.expiresAt.toISOString(), "2026-11-04T12:00:00.000Z");
  assert.equal(llamadas.length, 3);
});

test("un error de Meta no filtra el secreto de la app", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error_message: "código vencido" }), {
      status: 400,
    })) as unknown as typeof fetch;

  await assert.rejects(
    () => exchangeInstagramCode(config, "viejo", { fetchImpl }),
    (e: Error) => !e.message.includes("secreto"),
  );
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/social-publisher exec tsx --test src/providers/instagram/oauth.test.ts`
Expected: FAIL — `Cannot find module './oauth'`

- [ ] **Step 3: Implementar**

```ts
// packages/social-publisher/src/providers/instagram/oauth.ts
import { SocialPublisherError } from "../../types";

/** Permisos mínimos para publicar. Ver spec §7. */
export const INSTAGRAM_PUBLISH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
] as const;

export type InstagramOAuthConfig = {
  appId: string;
  appSecret: string;
  /** Debe coincidir carácter por carácter con el usado al pedir el código. */
  redirectUri: string;
  scopes?: readonly string[];
  apiVersion?: string;
};

export type InstagramConnectedAccount = {
  externalAccountId: string;
  username: string | null;
  accessToken: string;
  expiresAt: Date;
  scopes: string[];
};

type Deps = { fetchImpl?: typeof fetch; now?: () => Date };

export function buildInstagramAuthorizeUrl(
  config: InstagramOAuthConfig,
  state: string,
): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", config.appId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "scope",
    (config.scopes ?? INSTAGRAM_PUBLISH_SCOPES).join(","),
  );
  url.searchParams.set("state", state);
  return url.toString();
}

/**
 * Lee la respuesta y falla con un mensaje acotado.
 *
 * Nunca incluye el cuerpo de la request: ahí viaja `client_secret`, y estos errores
 * terminan en logs.
 */
async function leerJson<T>(res: Response, contexto: string): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T & {
    error?: { message?: string };
    error_message?: string;
  };
  if (!res.ok || json.error || json.error_message) {
    const msg = json.error?.message ?? json.error_message ?? `HTTP ${res.status}`;
    throw new SocialPublisherError(
      "INSTAGRAM_OAUTH_ERROR",
      `${contexto}: ${String(msg).slice(0, 200)}`,
      res.status === 429 || res.status >= 500,
    );
  }
  return json;
}

export async function exchangeInstagramCode(
  config: InstagramOAuthConfig,
  code: string,
  deps: Deps = {},
): Promise<InstagramConnectedAccount> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());
  const version = config.apiVersion ?? "v21.0";

  // 1. Código → token corto. Va por POST y en formulario: Meta rechaza JSON acá.
  const cuerpo = new URLSearchParams({
    client_id: config.appId,
    client_secret: config.appSecret,
    grant_type: "authorization_code",
    redirect_uri: config.redirectUri,
    code,
  });
  const corto = await leerJson<{ access_token: string; user_id: string | number }>(
    await fetchImpl("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: cuerpo.toString(),
    }),
    "canje del código",
  );

  // 2. Token corto → token largo (60 días).
  const urlLargo = new URL("https://graph.instagram.com/access_token");
  urlLargo.searchParams.set("grant_type", "ig_exchange_token");
  urlLargo.searchParams.set("client_secret", config.appSecret);
  urlLargo.searchParams.set("access_token", corto.access_token);
  const largo = await leerJson<{ access_token: string; expires_in: number }>(
    await fetchImpl(urlLargo.toString()),
    "canje a token largo",
  );

  // 3. Quién es la cuenta.
  const urlYo = new URL(`https://graph.instagram.com/${version}/me`);
  urlYo.searchParams.set("fields", "user_id,username");
  urlYo.searchParams.set("access_token", largo.access_token);
  const yo = await leerJson<{ user_id?: string; username?: string }>(
    await fetchImpl(urlYo.toString()),
    "identificación de la cuenta",
  );

  return {
    externalAccountId: String(yo.user_id ?? corto.user_id),
    username: yo.username ?? null,
    accessToken: largo.access_token,
    expiresAt: new Date(now().getTime() + largo.expires_in * 1000),
    scopes: [...(config.scopes ?? INSTAGRAM_PUBLISH_SCOPES)],
  };
}
```

- [ ] **Step 4: Exportar y ampliar el script de test**

En `packages/social-publisher/src/index.ts`, agregar al final:

```ts
export {
  buildInstagramAuthorizeUrl,
  exchangeInstagramCode,
  INSTAGRAM_PUBLISH_SCOPES,
  type InstagramConnectedAccount,
  type InstagramOAuthConfig,
} from "./providers/instagram/oauth";
```

En `packages/social-publisher/package.json`, cambiar el script `test` para que tome todos los archivos de prueba:

```json
"test": "tsx --test src/social-publisher.test.ts src/providers/instagram/oauth.test.ts"
```

- [ ] **Step 5: Correr el test y verificar que pasa**

Run: `pnpm --filter @repo/social-publisher test`
Expected: PASS, incluidos los tres tests nuevos y los que ya existían.

- [ ] **Step 6: Verificar tipos**

Run: `pnpm --filter @repo/social-publisher check-types`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add packages/social-publisher/
git commit -m "Conexión con Instagram: login y canje del código por token de 60 días"
```

---

### Task 2: Renovación del token antes de que venza

**Files:**
- Create: `packages/social-publisher/src/providers/instagram/token-refresh.ts`
- Create: `packages/social-publisher/src/providers/instagram/token-refresh.test.ts`
- Modify: `packages/social-publisher/src/index.ts`
- Modify: `packages/social-publisher/package.json`

**Interfaces:**
- Consumes: `SocialPublisherError`.
- Produces: `decideTokenRefresh(input)`, `TokenRefreshDecision`, `refreshInstagramToken(accessToken, deps?)`, `TOKEN_REFRESH_THRESHOLD_DAYS`, `TOKEN_MIN_AGE_HOURS`.

**Por qué esta tarea existe.** Sin renovación, todo funciona 60 días y después deja de funcionar **sin ningún error visible** hasta que alguien nota que no salió un post. Es la forma más común en que estas integraciones se rompen en producción.

La decisión se separa de la llamada a propósito: decidir es puro y se testea sin red; llamar necesita `fetch`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// packages/social-publisher/src/providers/instagram/token-refresh.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { decideTokenRefresh, refreshInstagramToken } from "./token-refresh";

const ahora = new Date("2026-09-05T12:00:00Z");
const hace = (horas: number) => new Date(ahora.getTime() - horas * 3600_000);
const dentroDe = (dias: number) => new Date(ahora.getTime() + dias * 86400_000);

test("renueva cuando quedan menos de 10 días", () => {
  const d = decideTokenRefresh({
    createdAt: hace(50 * 24),
    expiresAt: dentroDe(9),
    now: ahora,
  });
  assert.deepEqual(d, { action: "REFRESH" });
});

test("no renueva si al token le queda mucho", () => {
  const d = decideTokenRefresh({
    createdAt: hace(48),
    expiresAt: dentroDe(40),
    now: ahora,
  });
  assert.deepEqual(d, { action: "SKIP", reason: "NOT_DUE" });
});

test("no renueva un token con menos de 24 horas: Meta lo rechaza", () => {
  const d = decideTokenRefresh({
    createdAt: hace(3),
    expiresAt: dentroDe(2),
    now: ahora,
  });
  assert.deepEqual(d, { action: "SKIP", reason: "TOO_YOUNG" });
});

test("un token ya vencido no se renueva: hay que reconectar", () => {
  const d = decideTokenRefresh({
    createdAt: hace(70 * 24),
    expiresAt: hace(1),
    now: ahora,
  });
  assert.deepEqual(d, { action: "SKIP", reason: "EXPIRED" });
});

test("sin fecha de vencimiento se renueva igual, por las dudas", () => {
  const d = decideTokenRefresh({
    createdAt: hace(48),
    expiresAt: null,
    now: ahora,
  });
  assert.deepEqual(d, { action: "REFRESH" });
});

test("la renovación devuelve el token nuevo y su vencimiento", async () => {
  const fetchImpl = (async (input: string | URL) => {
    assert.ok(String(input).includes("grant_type=ig_refresh_token"));
    return new Response(
      JSON.stringify({ access_token: "renovado", expires_in: 5184000 }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const r = await refreshInstagramToken("viejo", { fetchImpl, now: () => ahora });
  assert.equal(r.accessToken, "renovado");
  assert.equal(r.expiresAt.toISOString(), "2026-11-04T12:00:00.000Z");
});

test("si Meta rechaza la renovación, el error es reintentable solo si es de servidor", async () => {
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ error: { message: "token inválido" } }), {
      status: 400,
    })) as unknown as typeof fetch;

  await assert.rejects(
    () => refreshInstagramToken("roto", { fetchImpl }),
    (e: Error & { retryable?: boolean }) => e.retryable === false,
  );
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/social-publisher exec tsx --test src/providers/instagram/token-refresh.test.ts`
Expected: FAIL — `Cannot find module './token-refresh'`

- [ ] **Step 3: Implementar**

```ts
// packages/social-publisher/src/providers/instagram/token-refresh.ts
import { SocialPublisherError } from "../../types";

/** Se renueva cuando le quedan menos de estos días. */
export const TOKEN_REFRESH_THRESHOLD_DAYS = 10;
/** Meta rechaza renovar un token con menos de esta edad. */
export const TOKEN_MIN_AGE_HOURS = 24;

export type TokenRefreshDecision =
  | { action: "REFRESH" }
  | { action: "SKIP"; reason: "TOO_YOUNG" | "NOT_DUE" | "EXPIRED" };

export function decideTokenRefresh(input: {
  createdAt: Date;
  expiresAt: Date | null;
  now: Date;
}): TokenRefreshDecision {
  const { createdAt, expiresAt, now } = input;

  // Un token vencido no se renueva: hay que volver a conectar la cuenta a mano.
  if (expiresAt && expiresAt.getTime() <= now.getTime()) {
    return { action: "SKIP", reason: "EXPIRED" };
  }

  const edadHoras = (now.getTime() - createdAt.getTime()) / 3600_000;
  if (edadHoras < TOKEN_MIN_AGE_HOURS) {
    return { action: "SKIP", reason: "TOO_YOUNG" };
  }

  // Sin fecha de vencimiento no se puede calcular el margen. Se renueva: el costo de
  // renovar de más es una llamada; el de renovar de menos es quedarse sin publicar.
  if (!expiresAt) return { action: "REFRESH" };

  const diasRestantes = (expiresAt.getTime() - now.getTime()) / 86400_000;
  return diasRestantes < TOKEN_REFRESH_THRESHOLD_DAYS
    ? { action: "REFRESH" }
    : { action: "SKIP", reason: "NOT_DUE" };
}

export async function refreshInstagramToken(
  accessToken: string,
  deps: { fetchImpl?: typeof fetch; now?: () => Date } = {},
): Promise<{ accessToken: string; expiresAt: Date }> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? (() => new Date());

  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", accessToken);

  const res = await fetchImpl(url.toString());
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: { message?: string };
  };

  if (!res.ok || json.error || !json.access_token) {
    throw new SocialPublisherError(
      "INSTAGRAM_TOKEN_REFRESH_FAILED",
      String(json.error?.message ?? `HTTP ${res.status}`).slice(0, 200),
      res.status === 429 || res.status >= 500,
    );
  }

  return {
    accessToken: json.access_token,
    expiresAt: new Date(now().getTime() + (json.expires_in ?? 5184000) * 1000),
  };
}
```

- [ ] **Step 4: Exportar y sumar al script de test**

En `index.ts`:

```ts
export {
  decideTokenRefresh,
  refreshInstagramToken,
  TOKEN_MIN_AGE_HOURS,
  TOKEN_REFRESH_THRESHOLD_DAYS,
  type TokenRefreshDecision,
} from "./providers/instagram/token-refresh";
```

En `package.json`, agregar `src/providers/instagram/token-refresh.test.ts` al script `test`.

- [ ] **Step 5: Correr los tests**

Run: `pnpm --filter @repo/social-publisher test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/social-publisher/
git commit -m "Renovar el token de Instagram antes de que venza a los 60 días"
```

---

## Etapa 2 — Carrusel, historia y menciones

### Task 3: Repartir las menciones entre colaboradores y copy

**Files:**
- Create: `packages/social-publisher/src/mentions.ts`
- Create: `packages/social-publisher/src/mentions.test.ts`
- Modify: `packages/social-publisher/src/index.ts`, `package.json`

**Interfaces:**
- Produces: `MentionCandidate`, `MentionPlan`, `planMentions(candidates, maxCollaborators?)`, `degradeMentionPlan(plan)`, `DEFAULT_MAX_COLLABORATORS`.

**Por qué esta tarea existe.** Cuántos colaboradores admite Instagram no está documentado de forma estable: las fuentes dan 3, 4 o 5 según la época y el tipo de cuenta. El diseño no puede depender de ese número. Se arma una lista priorizada; las primeras entran como colaboradores y **las que sobran caen al copy**. Si Meta rechaza por exceso, `degradeMentionPlan` mueve una más al copy y se reintenta.

**Regla dura: nadie desaparece.** Toda cuenta candidata termina o etiquetada o mencionada.

- [ ] **Step 1: Escribir el test que falla**

```ts
// packages/social-publisher/src/mentions.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { degradeMentionPlan, planMentions } from "./mentions";

const candidatos = [
  { handle: "fotografo", priority: 1, role: "PHOTOGRAPHER" },
  { handle: "organizador", priority: 2, role: "ORGANIZER" },
  { handle: "sponsor", priority: 3, role: "SPONSOR" },
  { handle: "compramelafoto", priority: 4, role: "PLATFORM" },
];

test("los primeros van como colaboradores y el resto al copy", () => {
  const plan = planMentions(candidatos, 3);
  assert.deepEqual(plan.collaborators, ["fotografo", "organizador", "sponsor"]);
  assert.deepEqual(plan.captionMentions, ["compramelafoto"]);
});

test("respeta la prioridad aunque lleguen desordenados", () => {
  const plan = planMentions([...candidatos].reverse(), 2);
  assert.deepEqual(plan.collaborators, ["fotografo", "organizador"]);
  assert.deepEqual(plan.captionMentions, ["sponsor", "compramelafoto"]);
});

test("no repite un handle que viene dos veces", () => {
  const plan = planMentions(
    [...candidatos, { handle: "fotografo", priority: 9, role: "OTRO" }],
    3,
  );
  assert.equal(plan.collaborators.filter((h) => h === "fotografo").length, 1);
  assert.ok(!plan.captionMentions.includes("fotografo"));
});

test("ignora handles vacíos en vez de mandar basura a Meta", () => {
  const plan = planMentions(
    [{ handle: "  ", priority: 1, role: "X" }, ...candidatos],
    3,
  );
  assert.ok(!plan.collaborators.includes("  "));
  assert.equal(plan.collaborators.length + plan.captionMentions.length, 4);
});

test("con cero candidatos el plan queda vacío, no falla", () => {
  assert.deepEqual(planMentions([], 3), { collaborators: [], captionMentions: [] });
});

test("degradar mueve el último colaborador al frente del copy", () => {
  const plan = planMentions(candidatos, 3);
  const menor = degradeMentionPlan(plan);
  assert.deepEqual(menor?.collaborators, ["fotografo", "organizador"]);
  assert.deepEqual(menor?.captionMentions, ["sponsor", "compramelafoto"]);
});

test("degradar sin colaboradores devuelve null: no hay nada más que bajar", () => {
  assert.equal(degradeMentionPlan({ collaborators: [], captionMentions: ["a"] }), null);
});

test("nadie se pierde al degradar", () => {
  let plan = planMentions(candidatos, 4);
  for (let i = 0; i < 4; i++) {
    const siguiente = degradeMentionPlan(plan);
    if (!siguiente) break;
    plan = siguiente;
  }
  assert.equal(plan.collaborators.length + plan.captionMentions.length, 4);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/social-publisher exec tsx --test src/mentions.test.ts`
Expected: FAIL — `Cannot find module './mentions'`

- [ ] **Step 3: Implementar**

```ts
// packages/social-publisher/src/mentions.ts

/**
 * Reparto de menciones entre etiqueta de colaborador y texto del copy.
 *
 * Instagram no documenta un límite estable de colaboradores (3, 4 o 5 según la época y el
 * tipo de cuenta), así que el reparto es dinámico y degradable: si Meta rechaza la lista,
 * se baja una al copy y se reintenta. Nadie desaparece.
 */

export const DEFAULT_MAX_COLLABORATORS = 3;

export type MentionCandidate = {
  /** Usuario de Instagram ya normalizado, sin @. */
  handle: string;
  /** Menor es más importante. */
  priority: number;
  /** Para qué está: PHOTOGRAPHER, ORGANIZER, SPONSOR, PLATFORM… */
  role: string;
};

export type MentionPlan = {
  collaborators: string[];
  captionMentions: string[];
};

export function planMentions(
  candidates: MentionCandidate[],
  maxCollaborators: number = DEFAULT_MAX_COLLABORATORS,
): MentionPlan {
  const vistos = new Set<string>();
  const ordenados = [...candidates]
    .sort((a, b) => a.priority - b.priority)
    .map((c) => c.handle.trim())
    .filter((h) => {
      if (!h) return false;
      if (vistos.has(h)) return false;
      vistos.add(h);
      return true;
    });

  const tope = Math.max(0, maxCollaborators);
  return {
    collaborators: ordenados.slice(0, tope),
    captionMentions: ordenados.slice(tope),
  };
}

/**
 * Baja un colaborador al copy. Devuelve null cuando ya no queda ninguno para bajar,
 * que es la señal de que el error de Meta no era por exceso de colaboradores.
 */
export function degradeMentionPlan(plan: MentionPlan): MentionPlan | null {
  if (plan.collaborators.length === 0) return null;
  const ultimo = plan.collaborators[plan.collaborators.length - 1] as string;
  return {
    collaborators: plan.collaborators.slice(0, -1),
    captionMentions: [ultimo, ...plan.captionMentions],
  };
}
```

- [ ] **Step 4: Exportar y sumar al script de test**

En `index.ts`:

```ts
export {
  degradeMentionPlan,
  planMentions,
  DEFAULT_MAX_COLLABORATORS,
  type MentionCandidate,
  type MentionPlan,
} from "./mentions";
```

En `package.json`, agregar `src/mentions.test.ts` al script `test`.

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `pnpm --filter @repo/social-publisher test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/social-publisher/
git commit -m "Repartir menciones entre colaboradores y copy sin perder a nadie"
```

---

### Task 4: Formato y colaboradores en el contrato del motor

**Files:**
- Modify: `packages/social-publisher/src/types.ts`
- Modify: `packages/social-publisher/src/providers/types.ts`
- Modify: `packages/social-publisher/src/engine.ts:262-280`
- Modify: `packages/social-publisher/src/index.ts`

**Interfaces:**
- Produces: `PublishFormat = "SINGLE_IMAGE" | "CAROUSEL" | "STORY"`, y los campos `format` y `collaborators` en `ProviderPublishInput`.
- Consumes: `MentionPlan` de Task 3.

**Por qué va en `metadata`.** No se puede tocar el schema de Prisma (ver Global Constraints), así que el formato y los colaboradores viajan en `DnxSocialPublishRequest.metadata`, que es un campo `Json` que ya existe. El motor los lee de ahí y se los pasa al provider.

**Compatibilidad:** sin `metadata.format`, el formato es `SINGLE_IMAGE`. Así Clickatón sigue funcionando sin cambios.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `packages/social-publisher/src/social-publisher.test.ts`:

```ts
test("el motor pasa formato y colaboradores desde metadata", async () => {
  const store = createInMemorySocialPublisherStore();
  store.accounts.set("acc1", {
    id: "acc1",
    platform: "INSTAGRAM",
    ownerUserId: 1,
    externalAccountId: "178414000",
    businessId: null,
    username: "clf",
    displayName: "CLF",
    scopes: ["instagram_business_content_publish"],
    status: "ACTIVE",
    expiresAt: null,
    lastValidatedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  store.tokens.set("acc1", "token");

  let recibido: { format?: string; collaborators?: string[] } | null = null;
  const providers = new Map([
    [
      "INSTAGRAM" as const,
      {
        platform: "INSTAGRAM" as const,
        async publish(input: { format?: string; collaborators?: string[] }) {
          recibido = { format: input.format, collaborators: input.collaborators };
          return {
            ok: true as const,
            dryRun: true,
            externalMediaId: "m1",
            externalPostId: "p1",
            permalink: null,
            providerRawSanitized: {},
          };
        },
      },
    ],
  ]);
  const eng = createSocialPublisherEngine(store, providers as never, {
    livePublish: false,
  });

  const req = eng.createRequest({
    application: "COMPRAMELAFOTO",
    entityType: "ALBUM",
    entityId: "42",
    caption: "Álbum nuevo",
    assets: [
      { assetId: "a1", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/1.jpg" },
      { assetId: "a2", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/2.jpg" },
    ],
    target: { platform: "INSTAGRAM", socialAccountId: "acc1" },
    idempotencyKey: "clf:album-carousel:42",
    metadata: { format: "CAROUSEL", collaborators: ["fotografo"] },
  });
  eng.approve(req.id, 1);
  await eng.processDue(new Date());

  assert.equal(recibido?.format, "CAROUSEL");
  assert.deepEqual(recibido?.collaborators, ["fotografo"]);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/social-publisher test`
Expected: FAIL — `recibido.format` es `undefined`.

- [ ] **Step 3: Implementar**

En `packages/social-publisher/src/types.ts`, agregar cerca de `PublishAssetKind`:

```ts
/** Cómo se publica el conjunto de assets. Sin especificar, una imagen sola. */
export type PublishFormat = "SINGLE_IMAGE" | "CAROUSEL" | "STORY";
```

En `packages/social-publisher/src/providers/types.ts`, ampliar la entrada:

```ts
import type {
  PublishAsset,
  PublishFormat,
  PublishResult,
  SocialAccount,
  SocialPlatform,
} from "../types";

export type ProviderPublishInput = {
  account: SocialAccount;
  accessToken: string;
  caption: string;
  assets: PublishAsset[];
  /** Sin especificar, SINGLE_IMAGE — así lo existente sigue igual. */
  format?: PublishFormat;
  /** Usuarios sin @, ya repartidos por planMentions. */
  collaborators?: string[];
  /** Si true, no llama a Meta; simula éxito. */
  dryRun: boolean;
};
```

En `packages/social-publisher/src/engine.ts`, en la llamada a `provider.publish` (alrededor de la línea 270), agregar la lectura de `metadata`:

```ts
        // Formato y colaboradores viajan en metadata: no se puede tocar el schema.
        const meta = (r.metadata ?? {}) as {
          format?: PublishFormat;
          collaborators?: string[];
        };
        const result = await provider.publish({
          account,
          accessToken: token,
          caption,
          assets: r.assets,
          format: meta.format ?? "SINGLE_IMAGE",
          collaborators: Array.isArray(meta.collaborators) ? meta.collaborators : [],
          dryRun,
        });
```

Agregar `PublishFormat` al `import type` que ya trae tipos de `./types` en `engine.ts`, y exportarlo desde `index.ts` junto a los demás tipos.

- [ ] **Step 4: Correr los tests y verificar que pasan**

Run: `pnpm --filter @repo/social-publisher test && pnpm --filter @repo/social-publisher check-types`
Expected: PASS y sin errores de tipo. Los tests viejos de Clickatón deben seguir pasando: sin `metadata.format` el formato es `SINGLE_IMAGE`.

- [ ] **Step 5: Commit**

```bash
git add packages/social-publisher/
git commit -m "El motor pasa formato y colaboradores al provider desde metadata"
```

---

### Task 5: Publicar carrusel e historia en Instagram

**Files:**
- Modify: `packages/social-publisher/src/providers/instagram/instagram-publish.ts`
- Create: `packages/social-publisher/src/providers/instagram/carousel.test.ts`
- Modify: `packages/social-publisher/package.json`

**Interfaces:**
- Consumes: `ProviderPublishInput` con `format` y `collaborators` (Task 4).
- Produces: el mismo `createInstagramPublishProvider(options?)`, ahora capaz de los tres formatos.

**Los tres formatos, con sus reglas.**

- **`SINGLE_IMAGE`** — como hoy: contenedor con `image_url` + `caption`, después `media_publish`. Ahora también acepta `collaborators`.
- **`CAROUSEL`** — tres pasos: (1) un contenedor por foto con `image_url` e `is_carousel_item=true`, **sin caption y sin collaborators**; (2) un contenedor padre con `media_type=CAROUSEL`, `children` (los ids separados por coma), `caption` y `collaborators`; (3) `media_publish` del padre. **Poner `collaborators` en los hijos es un error conocido que hace fallar la publicación.**
- **`STORY`** — contenedor con `image_url` y `media_type=STORIES`, después `media_publish`. **Sin caption y sin collaborators**: Meta no los acepta.

`collaborators` se manda como JSON de un arreglo de strings, por ejemplo `["fotografo","organizador"]`.

- [ ] **Step 1: Escribir el test que falla**

```ts
// packages/social-publisher/src/providers/instagram/carousel.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import type { SocialAccount } from "../../types";
import { createInstagramPublishProvider } from "./instagram-publish";

const cuenta: SocialAccount = {
  id: "acc1",
  platform: "INSTAGRAM",
  ownerUserId: 1,
  externalAccountId: "17841400000000000",
  businessId: null,
  username: "compramelafoto",
  displayName: "CLF",
  scopes: ["instagram_business_content_publish"],
  status: "ACTIVE",
  expiresAt: null,
  lastValidatedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

type Llamada = { url: string; body: Record<string, string> };

function fetchEspia(llamadas: Llamada[], respuestas: string[]): typeof fetch {
  let i = 0;
  return (async (input: string | URL, init?: RequestInit) => {
    const body = Object.fromEntries(
      new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    ) as Record<string, string>;
    llamadas.push({ url: String(input), body });
    const id = respuestas[i++] ?? "x";
    return new Response(JSON.stringify({ id, permalink: "https://ig.test/p/1/" }), {
      status: 200,
    });
  }) as unknown as typeof fetch;
}

test("el carrusel crea un hijo por foto y un padre con caption y colaboradores", async () => {
  const llamadas: Llamada[] = [];
  const provider = createInstagramPublishProvider({
    fetchImpl: fetchEspia(llamadas, ["hijo1", "hijo2", "hijo3", "padre", "post"]),
  });

  const r = await provider.publish({
    account: cuenta,
    accessToken: "t",
    caption: "Las fotos ya están en compramelafoto.com",
    format: "CAROUSEL",
    collaborators: ["fotografo", "organizador"],
    assets: [
      { assetId: "1", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/1.jpg" },
      { assetId: "2", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/2.jpg" },
      { assetId: "3", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/3.jpg" },
    ],
    dryRun: false,
  });

  assert.equal(r.ok, true);

  const hijos = llamadas.slice(0, 3);
  for (const hijo of hijos) {
    assert.equal(hijo.body.is_carousel_item, "true");
    // Los colaboradores en el hijo hacen fallar la publicación.
    assert.equal(hijo.body.collaborators, undefined);
    assert.equal(hijo.body.caption, undefined);
  }

  const padre = llamadas[3]!;
  assert.equal(padre.body.media_type, "CAROUSEL");
  assert.equal(padre.body.children, "hijo1,hijo2,hijo3");
  assert.equal(padre.body.caption, "Las fotos ya están en compramelafoto.com");
  assert.deepEqual(JSON.parse(padre.body.collaborators!), ["fotografo", "organizador"]);

  const publicar = llamadas[4]!;
  assert.ok(publicar.url.includes("/media_publish"));
  assert.equal(publicar.body.creation_id, "padre");
});

test("la historia va sin caption y sin colaboradores", async () => {
  const llamadas: Llamada[] = [];
  const provider = createInstagramPublishProvider({
    fetchImpl: fetchEspia(llamadas, ["cont", "post"]),
  });

  await provider.publish({
    account: cuenta,
    accessToken: "t",
    caption: "esto no se manda",
    format: "STORY",
    collaborators: ["fotografo"],
    assets: [{ assetId: "1", kind: "IMAGE", publicUrl: "https://cdn.test/s.jpg" }],
    dryRun: false,
  });

  const contenedor = llamadas[0]!;
  assert.equal(contenedor.body.media_type, "STORIES");
  assert.equal(contenedor.body.caption, undefined);
  assert.equal(contenedor.body.collaborators, undefined);
});

test("un carrusel necesita al menos dos fotos", async () => {
  const provider = createInstagramPublishProvider({
    fetchImpl: fetchEspia([], []),
  });
  await assert.rejects(
    () =>
      provider.publish({
        account: cuenta,
        accessToken: "t",
        caption: "c",
        format: "CAROUSEL",
        assets: [{ assetId: "1", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/1.jpg" }],
        dryRun: false,
      }),
    /CAROUSEL_TOO_FEW_ITEMS/,
  );
});

test("un carrusel no puede pasar de diez fotos", async () => {
  const provider = createInstagramPublishProvider({ fetchImpl: fetchEspia([], []) });
  await assert.rejects(
    () =>
      provider.publish({
        account: cuenta,
        accessToken: "t",
        caption: "c",
        format: "CAROUSEL",
        assets: Array.from({ length: 11 }, (_, i) => ({
          assetId: String(i),
          kind: "CAROUSEL_ITEM" as const,
          publicUrl: `https://cdn.test/${i}.jpg`,
        })),
        dryRun: false,
      }),
    /CAROUSEL_TOO_MANY_ITEMS/,
  );
});

test("en simulacro no llama a Meta pero distingue el formato", async () => {
  const llamadas: Llamada[] = [];
  const provider = createInstagramPublishProvider({ fetchImpl: fetchEspia(llamadas, []) });
  const r = await provider.publish({
    account: cuenta,
    accessToken: "t",
    caption: "c",
    format: "CAROUSEL",
    assets: [
      { assetId: "1", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/1.jpg" },
      { assetId: "2", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/2.jpg" },
    ],
    dryRun: true,
  });
  assert.equal(r.dryRun, true);
  assert.equal(llamadas.length, 0);
  assert.ok(r.externalMediaId?.startsWith("dry_media_"));
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/social-publisher exec tsx --test src/providers/instagram/carousel.test.ts`
Expected: FAIL — el provider ignora `format` y publica una sola imagen.

- [ ] **Step 3: Implementar**

Reemplazar el cuerpo de `publish` en `instagram-publish.ts` por un despacho según formato. El bloque de simulacro y la resolución del permalink se conservan; lo que cambia es cómo se arman los contenedores.

```ts
import { createHash, randomUUID } from "node:crypto";
import type { PublishAsset, PublishResult } from "../../types";
import { SocialPublisherError } from "../../types";
import type { ProviderPublishInput, SocialPublishProvider } from "../types";
import { createMetaGraphClient } from "./graph-client";

const CAROUSEL_MIN = 2;
/** Tope de Meta para un carrusel. */
const CAROUSEL_MAX = 10;

function assetsConUrl(assets: PublishAsset[]): PublishAsset[] {
  return [...assets]
    .filter((a) => Boolean(a.publicUrl))
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function createInstagramPublishProvider(options?: {
  apiVersion?: string;
  fetchImpl?: typeof fetch;
}): SocialPublishProvider {
  const client = createMetaGraphClient({
    apiVersion: options?.apiVersion,
    fetchImpl: options?.fetchImpl,
  });

  return {
    platform: "INSTAGRAM",
    async publish(input: ProviderPublishInput): Promise<PublishResult> {
      const format = input.format ?? "SINGLE_IMAGE";
      const fotos = assetsConUrl(input.assets);

      if (fotos.length === 0) {
        throw new SocialPublisherError(
          "ASSET_URL_REQUIRED",
          "Instagram requiere publicUrl del asset",
          false,
        );
      }
      if (input.account.status !== "ACTIVE") {
        throw new SocialPublisherError("ACCOUNT_INACTIVE", "Cuenta social no activa", false);
      }
      if (format === "CAROUSEL" && fotos.length < CAROUSEL_MIN) {
        throw new SocialPublisherError(
          "CAROUSEL_TOO_FEW_ITEMS",
          `Un carrusel necesita al menos ${CAROUSEL_MIN} fotos`,
          false,
        );
      }
      if (format === "CAROUSEL" && fotos.length > CAROUSEL_MAX) {
        throw new SocialPublisherError(
          "CAROUSEL_TOO_MANY_ITEMS",
          `Un carrusel admite hasta ${CAROUSEL_MAX} fotos`,
          false,
        );
      }

      if (input.dryRun) {
        const hash = createHash("sha256")
          .update(fotos.map((f) => f.publicUrl).join("|"))
          .update(input.caption)
          .update(format)
          .digest("hex")
          .slice(0, 16);
        return {
          ok: true,
          dryRun: true,
          externalMediaId: `dry_media_${hash}`,
          externalPostId: `dry_post_${randomUUID().slice(0, 8)}`,
          permalink: `https://www.instagram.com/p/dry_${hash}/`,
          providerRawSanitized: { mode: "dry_run", format },
        };
      }

      const igUserId = input.account.externalAccountId;
      const colaboradores = (input.collaborators ?? []).filter(Boolean);

      async function crearContenedor(body: Record<string, string>): Promise<string> {
        const r = await client.request<{ id: string }>(`/${igUserId}/media`, {
          method: "POST",
          accessToken: input.accessToken,
          form: true,
          body,
        });
        return r.id;
      }

      let contenedorId: string;

      if (format === "CAROUSEL") {
        // Los hijos van pelados: caption y collaborators en un hijo hacen fallar
        // la publicación entera.
        const hijos: string[] = [];
        for (const foto of fotos) {
          hijos.push(
            await crearContenedor({
              image_url: foto.publicUrl as string,
              is_carousel_item: "true",
            }),
          );
        }
        const padre: Record<string, string> = {
          media_type: "CAROUSEL",
          children: hijos.join(","),
          caption: input.caption,
        };
        if (colaboradores.length > 0) {
          padre.collaborators = JSON.stringify(colaboradores);
        }
        contenedorId = await crearContenedor(padre);
      } else if (format === "STORY") {
        // Meta no acepta caption ni colaboradores en historias.
        contenedorId = await crearContenedor({
          image_url: fotos[0]!.publicUrl as string,
          media_type: "STORIES",
        });
      } else {
        const body: Record<string, string> = {
          image_url: fotos[0]!.publicUrl as string,
          caption: input.caption,
        };
        if (colaboradores.length > 0) {
          body.collaborators = JSON.stringify(colaboradores);
        }
        contenedorId = await crearContenedor(body);
      }

      const published = await client.request<{ id: string }>(
        `/${igUserId}/media_publish`,
        {
          method: "POST",
          accessToken: input.accessToken,
          form: true,
          body: { creation_id: contenedorId },
        },
      );

      let permalink: string | null = null;
      try {
        const conCampos = await client.request<{ permalink?: string }>(
          `/${published.id}?fields=permalink`,
          { accessToken: input.accessToken },
        );
        permalink = conCampos.permalink ?? null;
      } catch {
        permalink = null;
      }

      return {
        ok: true,
        dryRun: false,
        externalMediaId: contenedorId,
        externalPostId: published.id,
        permalink,
        providerRawSanitized: {
          containerId: contenedorId,
          mediaId: published.id,
          format,
        },
      };
    },
  };
}
```

- [ ] **Step 4: Escribir el test de la degradación de colaboradores**

Agregar a `carousel.test.ts`. Instagram no documenta un límite estable de colaboradores,
así que cuando rechaza la lista hay que reintentar con una menos, no fallar.

```ts
test("si Meta rechaza los colaboradores, reintenta con uno menos", async () => {
  const llamadas: Llamada[] = [];
  let padresIntentados = 0;
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const body = Object.fromEntries(
      new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    ) as Record<string, string>;
    llamadas.push({ url: String(input), body });
    if (body.media_type === "CAROUSEL") {
      padresIntentados += 1;
      // El primer intento, con tres colaboradores, lo rechaza Meta.
      if (padresIntentados === 1) {
        return new Response(
          JSON.stringify({
            error: { message: "Too many collaborators requested", code: 100 },
          }),
          { status: 400 },
        );
      }
      return new Response(JSON.stringify({ id: "padre" }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: `c${llamadas.length}` }), { status: 200 });
  }) as unknown as typeof fetch;

  const provider = createInstagramPublishProvider({ fetchImpl });
  const r = await provider.publish({
    account: cuenta,
    accessToken: "t",
    caption: "Álbum nuevo",
    format: "CAROUSEL",
    collaborators: ["fotografo", "organizador", "sponsor"],
    assets: [
      { assetId: "1", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/1.jpg" },
      { assetId: "2", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/2.jpg" },
    ],
    dryRun: false,
  });

  assert.equal(r.ok, true);
  assert.equal(padresIntentados, 2);
  const segundoPadre = llamadas.filter((l) => l.body.media_type === "CAROUSEL")[1]!;
  assert.deepEqual(JSON.parse(segundoPadre.body.collaborators!), ["fotografo", "organizador"]);
  // El que se cayó de la etiqueta queda anotado para que el motor lo sume al copy.
  assert.deepEqual(r.providerRawSanitized?.droppedCollaborators, ["sponsor"]);
});

test("si el rechazo no es por colaboradores, no reintenta", async () => {
  let intentos = 0;
  const fetchImpl = (async (_i: string | URL, init?: RequestInit) => {
    const body = Object.fromEntries(
      new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    ) as Record<string, string>;
    if (body.media_type === "CAROUSEL") {
      intentos += 1;
      return new Response(
        JSON.stringify({ error: { message: "Media URL unreachable" } }),
        { status: 400 },
      );
    }
    return new Response(JSON.stringify({ id: "c" }), { status: 200 });
  }) as unknown as typeof fetch;

  const provider = createInstagramPublishProvider({ fetchImpl });
  await assert.rejects(() =>
    provider.publish({
      account: cuenta,
      accessToken: "t",
      caption: "c",
      format: "CAROUSEL",
      collaborators: ["a", "b"],
      assets: [
        { assetId: "1", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/1.jpg" },
        { assetId: "2", kind: "CAROUSEL_ITEM", publicUrl: "https://cdn.test/2.jpg" },
      ],
      dryRun: false,
    }),
  );
  assert.equal(intentos, 1);
});
```

- [ ] **Step 5: Implementar la degradación**

En `instagram-publish.ts`, envolver la creación del contenedor que lleva colaboradores. Los
hijos del carrusel ya están creados y se reusan: no se vuelven a subir.

```ts
import { degradeMentionPlan, type MentionPlan } from "../../mentions";

/** Meta no tiene un código propio para esto; el mensaje es lo único que lo distingue. */
function esErrorDeColaboradores(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : "";
  return msg.includes("collaborator");
}

/**
 * Crea el contenedor bajando un colaborador por intento.
 *
 * Instagram no documenta un límite estable (3, 4 o 5 según la época y el tipo de cuenta),
 * así que en vez de adivinar el número se prueba y se degrada. Quien se cae de la etiqueta
 * vuelve en `droppedCollaborators` para que el motor lo sume al copy: nadie desaparece.
 */
async function crearConColaboradores(
  crear: (body: Record<string, string>) => Promise<string>,
  base: Record<string, string>,
  colaboradores: string[],
): Promise<{ id: string; dropped: string[] }> {
  let plan: MentionPlan | null = { collaborators: colaboradores, captionMentions: [] };
  let ultimoError: unknown = null;

  while (plan) {
    const body = { ...base };
    if (plan.collaborators.length > 0) {
      body.collaborators = JSON.stringify(plan.collaborators);
    }
    try {
      return { id: await crear(body), dropped: plan.captionMentions };
    } catch (e) {
      if (!esErrorDeColaboradores(e)) throw e;
      ultimoError = e;
      plan = degradeMentionPlan(plan);
    }
  }
  throw ultimoError;
}
```

Usarla en las dos ramas que llevan colaboradores (`CAROUSEL` para el padre y
`SINGLE_IMAGE`), y devolver `droppedCollaborators` dentro de `providerRawSanitized`. La
rama `STORY` no cambia: no admite colaboradores.

- [ ] **Step 6: Sumar el test al script y correr todo**

Agregar `src/providers/instagram/carousel.test.ts` al script `test` del `package.json`.

Run: `pnpm --filter @repo/social-publisher test && pnpm --filter @repo/social-publisher check-types`
Expected: PASS. El test viejo de imagen sola debe seguir pasando sin cambios.

- [ ] **Step 7: Commit**

```bash
git add packages/social-publisher/
git commit -m "Publicar carrusel e historia en Instagram, con colaboradores en el padre"
```

---

### Task 6: Respetar el cupo de 100 publicaciones por día

**Files:**
- Create: `packages/social-publisher/src/providers/instagram/publishing-limit.ts`
- Create: `packages/social-publisher/src/providers/instagram/publishing-limit.test.ts`
- Modify: `packages/social-publisher/src/index.ts`, `package.json`

**Interfaces:**
- Produces: `fetchPublishingLimit(igUserId, accessToken, deps?)`, `hasQuotaFor(limit, needed)`, `PublishingLimit`.

**Contexto.** Meta permite 100 publicaciones por API cada 24 horas móviles por cuenta. Un carrusel cuenta como una. Se consulta con `GET /{ig-user-id}/content_publishing_limit?fields=config,quota_usage`. Conviene **diferir en vez de fallar**: quedarse sin cupo no es un error, es esperar.

- [ ] **Step 1: Escribir el test que falla**

```ts
// packages/social-publisher/src/providers/instagram/publishing-limit.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchPublishingLimit, hasQuotaFor } from "./publishing-limit";

test("lee el cupo usado y el total", async () => {
  const fetchImpl = (async (input: string | URL) => {
    assert.ok(String(input).includes("/content_publishing_limit"));
    return new Response(
      JSON.stringify({ data: [{ quota_usage: 12, config: { quota_total: 100 } }] }),
      { status: 200 },
    );
  }) as unknown as typeof fetch;

  const limite = await fetchPublishingLimit("17841400000000000", "t", { fetchImpl });
  assert.deepEqual(limite, { used: 12, total: 100 });
});

test("si Meta no contesta el cupo, se asume disponible y no se frena la publicación", async () => {
  const fetchImpl = (async () =>
    new Response("{}", { status: 500 })) as unknown as typeof fetch;
  const limite = await fetchPublishingLimit("1", "t", { fetchImpl });
  assert.equal(limite, null);
});

test("hay cupo si entra lo que falta publicar", () => {
  assert.equal(hasQuotaFor({ used: 98, total: 100 }, 2), true);
  assert.equal(hasQuotaFor({ used: 99, total: 100 }, 2), false);
});

test("sin dato de cupo se deja pasar", () => {
  assert.equal(hasQuotaFor(null, 5), true);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/social-publisher exec tsx --test src/providers/instagram/publishing-limit.test.ts`
Expected: FAIL — `Cannot find module './publishing-limit'`

- [ ] **Step 3: Implementar**

```ts
// packages/social-publisher/src/providers/instagram/publishing-limit.ts
import { createMetaGraphClient } from "./graph-client";

export type PublishingLimit = { used: number; total: number };

/**
 * Cupo de publicaciones de la cuenta (100 cada 24 h móviles; un carrusel cuenta 1).
 *
 * Devuelve null si Meta no contesta: no saber el cupo no es razón para no publicar.
 * El límite real lo aplica Meta igual, y ahí sí el error se registra y se reintenta.
 */
export async function fetchPublishingLimit(
  igUserId: string,
  accessToken: string,
  deps: { fetchImpl?: typeof fetch; apiVersion?: string } = {},
): Promise<PublishingLimit | null> {
  const client = createMetaGraphClient({
    apiVersion: deps.apiVersion,
    fetchImpl: deps.fetchImpl,
  });
  try {
    const r = await client.request<{
      data?: { quota_usage?: number; config?: { quota_total?: number } }[];
    }>(`/${igUserId}/content_publishing_limit?fields=config,quota_usage`, {
      accessToken,
    });
    const fila = r.data?.[0];
    if (!fila) return null;
    return {
      used: Number(fila.quota_usage ?? 0),
      total: Number(fila.config?.quota_total ?? 100),
    };
  } catch {
    return null;
  }
}

export function hasQuotaFor(limit: PublishingLimit | null, needed: number): boolean {
  if (!limit) return true;
  return limit.used + needed <= limit.total;
}
```

- [ ] **Step 4: Exportar, sumar al script y correr**

En `index.ts`:

```ts
export {
  fetchPublishingLimit,
  hasQuotaFor,
  type PublishingLimit,
} from "./providers/instagram/publishing-limit";
```

Agregar el test al script `test`.

Run: `pnpm --filter @repo/social-publisher test && pnpm --filter @repo/social-publisher check-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/social-publisher/
git commit -m "Consultar el cupo diario de publicaciones de Instagram"
```

---

## Etapa 3 — El puente entre el Designer y el motor

### Task 7: Paquete `@repo/social-pieces` y render a JPEG

**Files:**
- Create: `packages/social-pieces/package.json`, `tsconfig.json`, `eslint.config.js`
- Create: `packages/social-pieces/src/types.ts`
- Create: `packages/social-pieces/src/render.ts`
- Create: `packages/social-pieces/src/index.ts`
- Create: `packages/social-pieces/src/social-pieces.test.ts`

**Interfaces:**
- Consumes: `emitDesign`, `EmittedFile`, `ResourceResolver`, `VariableContract`, `VariableValues` de `@repo/design-studio`.
- Produces: `SocialPieceSpec`, `RenderedPiece`, `renderSocialPiece(spec, deps)`.

**Por qué este paquete existe.** El Designer no sabe de red y el motor no sabe de diseño. Alguien tiene que tomar una plantilla y datos, producir un JPEG y dejarlo donde Meta pueda leerlo. Ese alguien es este paquete, y es fino a propósito: no decide **cuándo** publicar (eso es de la app) ni **cómo** publicar (eso es del motor).

**Por qué hay conversión a JPEG.** El Designer emite PNG. **Meta acepta únicamente JPEG.** La conversión va con `sharp`, que ya está en el monorepo (`@repo/media-composition` lo usa).

**Cuidado con el empaquetado.** `emitDesign` con formato PNG arrastra `pdf-to-png-converter` → `@napi-rs/canvas`, que son binarios nativos. Las apps que usen este paquete tienen que declararlos en `serverExternalPackages` de su `next.config.ts`. Ya está resuelto así en `apps/compramelafoto/next.config.ts:90` y en `apps/fotorank/next.config.ts:10` — copiar ese patrón, no inventar otro.

- [ ] **Step 1: Crear el andamiaje del paquete**

`packages/social-pieces/package.json`:

```json
{
  "name": "@repo/social-pieces",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Puente entre @repo/design-studio y @repo/social-publisher: plantilla + datos → JPEG → solicitud de publicación.",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "scripts": {
    "check-types": "tsc --noEmit -p tsconfig.json",
    "test": "tsx --test src/social-pieces.test.ts",
    "lint": "eslint ."
  },
  "dependencies": {
    "@repo/design-studio": "workspace:*",
    "@repo/social-publisher": "workspace:*",
    "sharp": "^0.34.2"
  },
  "devDependencies": {
    "@repo/eslint-config": "workspace:*",
    "@repo/typescript-config": "workspace:*",
    "@types/node": "^22.15.3",
    "eslint": "^9.39.1",
    "tsx": "^4.21.0",
    "typescript": "5.9.2"
  }
}
```

Copiar `tsconfig.json` y `eslint.config.js` de `packages/media-composition/`, cambiando solo lo que nombre al paquete.

Run: `pnpm install`

- [ ] **Step 2: Escribir el test que falla**

```ts
// packages/social-pieces/src/social-pieces.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { renderSocialPiece } from "./render";
import type { SocialPieceSpec } from "./types";

/** PNG de 1×1 rojo, suficiente para que sharp tenga algo real que convertir. */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const spec: SocialPieceSpec = {
  pieceId: "clf-album-story",
  format: "STORY",
  document: { fake: true },
  contract: { variables: [] },
  values: { nombreAlbum: "Maratón 2026" },
  resources: { async read() { return null; } },
};

test("convierte lo que emite el Designer a JPEG", async () => {
  const pieza = await renderSocialPiece(spec, {
    emit: async () => ({
      ok: true,
      files: [
        {
          name: "story.png",
          contentType: "image/png",
          bytes: new Uint8Array(PNG_1X1),
          checksum: "abc",
        },
      ],
      rendererVersion: "1.0.0",
      schemaVersion: 1,
      resolvedValues: { nombreAlbum: "Maratón 2026" },
      omittedVariables: [],
    }),
  });

  assert.equal(pieza.contentType, "image/jpeg");
  assert.ok(pieza.fileName.endsWith(".jpg"));
  // Firma de un JPEG: empieza con FF D8 FF.
  assert.equal(pieza.bytes[0], 0xff);
  assert.equal(pieza.bytes[1], 0xd8);
  assert.equal(pieza.bytes[2], 0xff);
});

test("si el Designer falla, el error explica qué faltó", async () => {
  await assert.rejects(
    () =>
      renderSocialPiece(spec, {
        emit: async () => ({ ok: false, errors: ["Falta la variable nombreAlbum."] }),
      }),
    /Falta la variable nombreAlbum/,
  );
});

test("si el Designer no devuelve ninguna cara, falla claro", async () => {
  await assert.rejects(
    () =>
      renderSocialPiece(spec, {
        emit: async () => ({
          ok: true,
          files: [],
          rendererVersion: "1.0.0",
          schemaVersion: 1,
          resolvedValues: {},
          omittedVariables: [],
        }),
      }),
    /no produjo ninguna imagen/,
  );
});

test("guarda los valores resueltos para poder reproducir la pieza", async () => {
  const pieza = await renderSocialPiece(spec, {
    emit: async () => ({
      ok: true,
      files: [
        { name: "s.png", contentType: "image/png", bytes: new Uint8Array(PNG_1X1), checksum: "a" },
      ],
      rendererVersion: "1.2.3",
      schemaVersion: 4,
      resolvedValues: { nombreAlbum: "Maratón 2026" },
      omittedVariables: ["fecha"],
    }),
  });
  assert.equal(pieza.rendererVersion, "1.2.3");
  assert.deepEqual(pieza.resolvedValues, { nombreAlbum: "Maratón 2026" });
});
```

- [ ] **Step 3: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/social-pieces test`
Expected: FAIL — `Cannot find module './render'`

- [ ] **Step 4: Implementar los tipos**

```ts
// packages/social-pieces/src/types.ts
import type {
  EmitOutcome,
  ResourceResolver,
  VariableContract,
  VariableValues,
} from "@repo/design-studio";
import type { PublishFormat } from "@repo/social-publisher";

export type SocialPieceSpec = {
  /** Identificador estable de la plantilla, p. ej. "clf-album-carousel". */
  pieceId: string;
  format: PublishFormat;
  /** Documento del Designer, crudo: emitDesign lo migra y valida. */
  document: unknown;
  contract: VariableContract;
  values: VariableValues;
  /** Puerto de bytes: el producto entrega las fotos, el Designer no sabe de red. */
  resources: ResourceResolver;
  /** Resolución del raster. Por defecto la del documento. */
  dpi?: number;
};

export type RenderedPiece = {
  fileName: string;
  contentType: "image/jpeg";
  bytes: Uint8Array;
  rendererVersion: string;
  schemaVersion: number;
  resolvedValues: Record<string, string>;
  omittedVariables: string[];
};

/** Puerto de emisión. En producción es emitDesign; en test, una función. */
export type EmitPort = (input: {
  document: unknown;
  contract: VariableContract;
  values: VariableValues;
  resources: ResourceResolver;
  fileBaseName: string;
  pngDpi?: number;
}) => Promise<EmitOutcome>;
```

- [ ] **Step 5: Implementar el render**

```ts
// packages/social-pieces/src/render.ts
import { emitDesign } from "@repo/design-studio";
import type { EmitPort, RenderedPiece, SocialPieceSpec } from "./types";

/** Meta acepta únicamente JPEG. Ver spec §9. */
const JPEG_QUALITY = 88;

const emitPorDefecto: EmitPort = (input) =>
  emitDesign({ ...input, formats: ["PNG_PER_SIDE"] });

export async function renderSocialPiece(
  spec: SocialPieceSpec,
  deps: { emit?: EmitPort } = {},
): Promise<RenderedPiece> {
  const emit = deps.emit ?? emitPorDefecto;

  const salida = await emit({
    document: spec.document,
    contract: spec.contract,
    values: spec.values,
    resources: spec.resources,
    fileBaseName: spec.pieceId,
    pngDpi: spec.dpi,
  });

  if (!salida.ok) {
    throw new Error(`No se pudo emitir la pieza ${spec.pieceId}: ${salida.errors.join(" ")}`);
  }

  const primera = salida.files[0];
  if (!primera) {
    throw new Error(`La plantilla ${spec.pieceId} no produjo ninguna imagen.`);
  }

  // El import es dinámico: sharp trae binarios nativos y no debe entrar en el grafo de
  // quien solo importe los tipos de este paquete.
  const { default: sharp } = await import("sharp");
  const jpeg = await sharp(Buffer.from(primera.bytes))
    // Sobre fondo blanco: un PNG con transparencia se vuelve negro al pasar a JPEG.
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();

  return {
    fileName: `${spec.pieceId}.jpg`,
    contentType: "image/jpeg",
    bytes: new Uint8Array(jpeg),
    rendererVersion: salida.rendererVersion,
    schemaVersion: salida.schemaVersion,
    resolvedValues: salida.resolvedValues,
    omittedVariables: salida.omittedVariables,
  };
}
```

`packages/social-pieces/src/index.ts`:

```ts
export { renderSocialPiece } from "./render";
export type { EmitPort, RenderedPiece, SocialPieceSpec } from "./types";
```

- [ ] **Step 6: Correr los tests y los tipos**

Run: `pnpm --filter @repo/social-pieces test && pnpm --filter @repo/social-pieces check-types`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/social-pieces/ pnpm-lock.yaml
git commit -m "Paquete social-pieces: del documento del Designer a un JPEG para Meta"
```

---

### Task 8: Subir la pieza a R2 y crear la solicitud

**Files:**
- Create: `packages/social-pieces/src/publish-piece.ts`
- Modify: `packages/social-pieces/src/index.ts`
- Modify: `packages/social-pieces/src/social-pieces.test.ts`

**Interfaces:**
- Consumes: `RenderedPiece` (Task 7), `planMentions` y `MentionCandidate` (Task 3), `CreatePublishRequestInput` de `@repo/social-publisher`.
- Produces: `AssetUploader`, `PublishPieceInput`, `buildPublishRequestInput(input, uploadedUrls)`, `publishPiece(input, deps)`.

**Diseño.** La subida a R2 es un **puerto** (`AssetUploader`), no una dependencia: cada app tiene su propio cliente de R2 con su bucket y su dominio público. Así el paquete se testea sin red y sin credenciales.

`buildPublishRequestInput` es puro y es donde vive la decisión interesante: repartir menciones y armar el `metadata` que el motor va a leer.

- [ ] **Step 1: Escribir el test que falla**

Agregar a `packages/social-pieces/src/social-pieces.test.ts`:

```ts
import { buildPublishRequestInput } from "./publish-piece";

test("arma la solicitud con formato, colaboradores y menciones sobrantes", () => {
  const input = buildPublishRequestInput(
    {
      application: "COMPRAMELAFOTO",
      entityType: "ALBUM",
      entityId: "42",
      pieceId: "clf-album-carousel",
      format: "CAROUSEL",
      caption: "Las fotos de la Maratón ya están disponibles.",
      hashtags: ["compramelafoto"],
      mentionCandidates: [
        { handle: "fotografo", priority: 1, role: "PHOTOGRAPHER" },
        { handle: "organizador", priority: 2, role: "ORGANIZER" },
        { handle: "sponsor", priority: 3, role: "SPONSOR" },
        { handle: "compramelafoto", priority: 4, role: "PLATFORM" },
      ],
      socialAccountId: "acc1",
      idempotencyKey: "clf:album-carousel:42",
      maxCollaborators: 3,
    },
    ["https://cdn.test/1.jpg", "https://cdn.test/2.jpg", "https://cdn.test/3.jpg"],
  );

  assert.equal(input.idempotencyKey, "clf:album-carousel:42");
  assert.equal(input.assets.length, 3);
  assert.equal(input.assets[0]!.kind, "CAROUSEL_ITEM");
  assert.equal(input.assets[0]!.sortOrder, 0);
  assert.deepEqual(input.mentions, ["compramelafoto"]);
  assert.equal((input.metadata as { format: string }).format, "CAROUSEL");
  assert.deepEqual((input.metadata as { collaborators: string[] }).collaborators, [
    "fotografo",
    "organizador",
    "sponsor",
  ]);
});

test("una historia va como imagen sola y sin colaboradores", () => {
  const input = buildPublishRequestInput(
    {
      application: "COMPRAMELAFOTO",
      entityType: "ALBUM",
      entityId: "42",
      pieceId: "clf-album-story",
      format: "STORY",
      caption: "no se manda",
      mentionCandidates: [{ handle: "fotografo", priority: 1, role: "PHOTOGRAPHER" }],
      socialAccountId: "acc1",
      idempotencyKey: "clf:album-story:42",
    },
    ["https://cdn.test/s.jpg"],
  );

  assert.equal(input.assets[0]!.kind, "IMAGE");
  assert.deepEqual((input.metadata as { collaborators: string[] }).collaborators, []);
  // En una historia nadie se pierde: quien no puede ir etiquetado queda registrado.
  assert.deepEqual(input.mentions, ["fotografo"]);
});

test("la solicitud nace pendiente de aprobación", () => {
  const input = buildPublishRequestInput(
    {
      application: "COMPRAMELAFOTO",
      entityType: "ALBUM",
      entityId: "1",
      pieceId: "p",
      format: "SINGLE_IMAGE",
      caption: "c",
      mentionCandidates: [],
      socialAccountId: "acc1",
      idempotencyKey: "k",
    },
    ["https://cdn.test/a.jpg"],
  );
  assert.equal(input.approvalRequired, true);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @repo/social-pieces test`
Expected: FAIL — `Cannot find module './publish-piece'`

- [ ] **Step 3: Implementar**

```ts
// packages/social-pieces/src/publish-piece.ts
import {
  planMentions,
  type CreatePublishRequestInput,
  type MentionCandidate,
  type PublishAsset,
  type PublishFormat,
  type SocialApplication,
} from "@repo/social-publisher";
import type { RenderedPiece, SocialPieceSpec } from "./types";
import { renderSocialPiece } from "./render";

/** Puerto de almacenamiento: cada app trae su R2. Devuelve la URL pública. */
export type AssetUploader = (file: {
  fileName: string;
  contentType: string;
  bytes: Uint8Array;
}) => Promise<string>;

export type PublishPieceInput = {
  application: SocialApplication;
  entityType: string;
  entityId: string;
  pieceId: string;
  format: PublishFormat;
  caption: string;
  hashtags?: string[];
  mentionCandidates: MentionCandidate[];
  socialAccountId: string;
  idempotencyKey: string;
  maxCollaborators?: number;
  createdByUserId?: number | null;
  extraMetadata?: Record<string, unknown>;
};

/**
 * Arma la solicitud a partir de las URLs ya subidas. Puro: acá vive el reparto de
 * menciones y el `metadata` que después lee el motor.
 */
export function buildPublishRequestInput(
  input: PublishPieceInput,
  uploadedUrls: string[],
): CreatePublishRequestInput {
  const esCarrusel = input.format === "CAROUSEL";
  // Las historias no admiten colaboradores: todo el mundo va al copy.
  const admiteColaboradores = input.format !== "STORY";

  const plan = admiteColaboradores
    ? planMentions(input.mentionCandidates, input.maxCollaborators)
    : { collaborators: [], captionMentions: planMentions(input.mentionCandidates, 0).captionMentions };

  const assets: PublishAsset[] = uploadedUrls.map((url, i) => ({
    assetId: `${input.pieceId}-${i}`,
    kind: esCarrusel ? "CAROUSEL_ITEM" : "IMAGE",
    publicUrl: url,
    mimeType: "image/jpeg",
    sortOrder: i,
  }));

  return {
    application: input.application,
    entityType: input.entityType,
    entityId: input.entityId,
    templateRef: input.pieceId,
    caption: input.caption,
    hashtags: input.hashtags ?? [],
    mentions: plan.captionMentions,
    assets,
    target: { platform: "INSTAGRAM", socialAccountId: input.socialAccountId },
    approvalRequired: true,
    idempotencyKey: input.idempotencyKey,
    createdByUserId: input.createdByUserId ?? null,
    metadata: {
      ...(input.extraMetadata ?? {}),
      format: input.format,
      collaborators: plan.collaborators,
      pieceId: input.pieceId,
    },
  };
}

/** Renderiza cada pieza, la sube y devuelve la solicitud lista para crear. */
export async function publishPiece(
  input: PublishPieceInput,
  deps: {
    specs: SocialPieceSpec[];
    upload: AssetUploader;
    render?: (spec: SocialPieceSpec) => Promise<RenderedPiece>;
  },
): Promise<CreatePublishRequestInput> {
  const render = deps.render ?? ((s: SocialPieceSpec) => renderSocialPiece(s));
  const urls: string[] = [];
  for (const spec of deps.specs) {
    const pieza = await render(spec);
    urls.push(
      await deps.upload({
        fileName: pieza.fileName,
        contentType: pieza.contentType,
        bytes: pieza.bytes,
      }),
    );
  }
  return buildPublishRequestInput(input, urls);
}
```

Exportar en `index.ts`:

```ts
export {
  buildPublishRequestInput,
  publishPiece,
  type AssetUploader,
  type PublishPieceInput,
} from "./publish-piece";
```

- [ ] **Step 4: Correr los tests y los tipos**

Run: `pnpm --filter @repo/social-pieces test && pnpm --filter @repo/social-pieces check-types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/social-pieces/
git commit -m "Armar la solicitud de publicación a partir de las piezas subidas"
```

---

## Etapa 4 — Cableado en CompraMeLaFoto

### Task 9: Permiso de difusión y elección de fotos

**Files:**
- Create: `apps/compramelafoto/lib/social/album-social-consent.ts`
- Create: `apps/compramelafoto/lib/social/album-social-consent.test.ts`
- Create: `apps/compramelafoto/vitest.social.config.ts`
- Modify: `apps/compramelafoto/package.json` (script `test:social`)

**Interfaces:**
- Consumes: `normalizeInstagramHandle` de `@repo/media-composition`.
- Produces: `AlbumSocialConsent`, `SocialGenerationDecision`, `decideAlbumSocialGeneration(input)`, `MIN_SOCIAL_PHOTOS`, `MAX_SOCIAL_PHOTOS`, `saveAlbumSocialConsent(...)`, `getAlbumSocialConsent(albumId)`.

**Dónde se guarda esto sin tocar el schema.** El permiso y la selección viven en un
`DnxSocialPublishRequest` en estado `DRAFT`, con clave idempotente
`clf:album-consent:{albumId}` y todo el detalle en `metadata`. Cuando el álbum queda
analizado, el disparador lee ese borrador, renderiza las piezas y crea las solicitudes
reales. Se usan tablas que ya existen y que además dejan auditoría (`DnxSocialPublishLog`)
sin trabajo extra.

**Reglas, del spec §8:**
- Mínimo 3 fotos, máximo 4. Con menos de 3 no se genera nada.
- El orden de selección es el orden del carrusel.
- Sin permiso tildado no se genera nada.
- El `@usuario` se normaliza; si es inválido, se guarda sin handle y el fotógrafo no se
  etiqueta (pero la publicación igual puede salir).

- [ ] **Step 1: Escribir el test que falla**

```ts
// apps/compramelafoto/lib/social/album-social-consent.test.ts
import { describe, expect, it } from "vitest";
import {
  decideAlbumSocialGeneration,
  MAX_SOCIAL_PHOTOS,
  MIN_SOCIAL_PHOTOS,
} from "./album-social-consent";

const base = {
  consentGiven: true,
  selectedPhotoIds: [1, 2, 3],
  photographerHandle: "fotografo",
  albumIsReady: true,
  alreadyGenerated: false,
};

describe("decideAlbumSocialGeneration", () => {
  it("genera cuando hay permiso, fotos y el álbum está analizado", () => {
    expect(decideAlbumSocialGeneration(base)).toEqual({ generate: true });
  });

  it("no genera sin permiso, aunque estén todas las fotos elegidas", () => {
    expect(decideAlbumSocialGeneration({ ...base, consentGiven: false })).toEqual({
      generate: false,
      reason: "NO_CONSENT",
    });
  });

  it("no genera con menos de tres fotos", () => {
    expect(
      decideAlbumSocialGeneration({ ...base, selectedPhotoIds: [1, 2] }),
    ).toEqual({ generate: false, reason: "TOO_FEW_PHOTOS" });
  });

  it("no genera con más de cuatro fotos", () => {
    expect(
      decideAlbumSocialGeneration({ ...base, selectedPhotoIds: [1, 2, 3, 4, 5] }),
    ).toEqual({ generate: false, reason: "TOO_MANY_PHOTOS" });
  });

  it("no genera si el álbum todavía se está analizando", () => {
    expect(decideAlbumSocialGeneration({ ...base, albumIsReady: false })).toEqual({
      generate: false,
      reason: "ALBUM_NOT_READY",
    });
  });

  it("no genera dos veces el mismo álbum", () => {
    expect(decideAlbumSocialGeneration({ ...base, alreadyGenerated: true })).toEqual({
      generate: false,
      reason: "ALREADY_GENERATED",
    });
  });

  it("genera igual sin usuario de Instagram: no etiquetar no es motivo para no publicar", () => {
    expect(
      decideAlbumSocialGeneration({ ...base, photographerHandle: null }),
    ).toEqual({ generate: true });
  });

  it("los límites son 3 y 4", () => {
    expect(MIN_SOCIAL_PHOTOS).toBe(3);
    expect(MAX_SOCIAL_PHOTOS).toBe(4);
  });
});
```

- [ ] **Step 2: Crear la configuración de test y verificar que falla**

`apps/compramelafoto/vitest.social.config.ts` — copiar `vitest.analysis.config.ts` cambiando el `include` a `["lib/social/**/*.test.ts"]`.

En `apps/compramelafoto/package.json`, agregar:

```json
"test:social": "../../services/dnx-mcp/node_modules/.bin/vitest run --config vitest.social.config.ts"
```

Run: `pnpm --filter compramelafoto test:social`
Expected: FAIL — no existe `./album-social-consent`.

- [ ] **Step 3: Implementar la decisión pura**

```ts
// apps/compramelafoto/lib/social/album-social-consent.ts
import { normalizeInstagramHandle } from "@repo/media-composition";

/** Ver spec §8: mínimo 3, máximo 4. */
export const MIN_SOCIAL_PHOTOS = 3;
export const MAX_SOCIAL_PHOTOS = 4;

export type AlbumSocialConsent = {
  albumId: number;
  consentGiven: boolean;
  consentAt: string | null;
  consentByUserId: number | null;
  /** En orden de selección: es el orden del carrusel. */
  selectedPhotoIds: number[];
  photographerHandle: string | null;
};

export type SocialGenerationReason =
  | "NO_CONSENT"
  | "TOO_FEW_PHOTOS"
  | "TOO_MANY_PHOTOS"
  | "ALBUM_NOT_READY"
  | "ALREADY_GENERATED";

export type SocialGenerationDecision =
  | { generate: true }
  | { generate: false; reason: SocialGenerationReason };

/**
 * Decide si corresponde generar las piezas sociales de un álbum.
 *
 * Puro a propósito, como `decideAlbumReadiness`: la regla que protege a la gente
 * fotografiada tiene que poder testearse sin base de datos.
 */
export function decideAlbumSocialGeneration(input: {
  consentGiven: boolean;
  selectedPhotoIds: number[];
  photographerHandle: string | null;
  albumIsReady: boolean;
  alreadyGenerated: boolean;
}): SocialGenerationDecision {
  if (input.alreadyGenerated) return { generate: false, reason: "ALREADY_GENERATED" };
  if (!input.consentGiven) return { generate: false, reason: "NO_CONSENT" };
  if (input.selectedPhotoIds.length < MIN_SOCIAL_PHOTOS) {
    return { generate: false, reason: "TOO_FEW_PHOTOS" };
  }
  if (input.selectedPhotoIds.length > MAX_SOCIAL_PHOTOS) {
    return { generate: false, reason: "TOO_MANY_PHOTOS" };
  }
  if (!input.albumIsReady) return { generate: false, reason: "ALBUM_NOT_READY" };
  // Sin usuario de Instagram se publica igual: no poder etiquetar al fotógrafo no es
  // motivo para no difundir su álbum.
  return { generate: true };
}

export function normalizeConsentHandle(raw: string | null | undefined): string | null {
  return normalizeInstagramHandle(raw)?.handle ?? null;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter compramelafoto test:social`
Expected: PASS, 8 tests.

- [ ] **Step 5: Implementar la persistencia**

En el mismo archivo, agregar las funciones que hablan con Prisma. Van separadas de la
decisión: la decisión se testea sin base, la consulta no se testea.

```ts
import { prisma } from "@repo/db";

const CONSENT_ENTITY_TYPE = "ALBUM_SOCIAL_CONSENT";

export function albumConsentKey(albumId: number): string {
  return `clf:album-consent:${albumId}`;
}

/**
 * Guarda permiso y selección como un borrador de publicación.
 *
 * No hay campos nuevos en `Album`: un cambio de schema hay que aplicarlo a mano en las
 * cinco bases Neon. `DnxSocialPublishRequest` en DRAFT ya sirve para esto y además deja
 * auditoría en `DnxSocialPublishLog` sin trabajo extra.
 */
export async function saveAlbumSocialConsent(input: {
  albumId: number;
  socialAccountId: string;
  consentGiven: boolean;
  selectedPhotoIds: number[];
  photographerHandle: string | null;
  userId: number;
}): Promise<void> {
  const metadata = {
    consentGiven: input.consentGiven,
    consentAt: input.consentGiven ? new Date().toISOString() : null,
    consentByUserId: input.userId,
    selectedPhotoIds: input.selectedPhotoIds.slice(0, MAX_SOCIAL_PHOTOS),
    photographerHandle: normalizeConsentHandle(input.photographerHandle),
  };

  await prisma.dnxSocialPublishRequest.upsert({
    where: { idempotencyKey: albumConsentKey(input.albumId) },
    create: {
      application: "COMPRAMELAFOTO",
      entityType: CONSENT_ENTITY_TYPE,
      entityId: String(input.albumId),
      caption: "",
      assets: [],
      socialAccountId: input.socialAccountId,
      platform: "INSTAGRAM",
      status: "DRAFT",
      approvalRequired: true,
      idempotencyKey: albumConsentKey(input.albumId),
      createdByUserId: input.userId,
      metadata,
    },
    update: { metadata },
  });
}

export async function getAlbumSocialConsent(
  albumId: number,
): Promise<AlbumSocialConsent | null> {
  const fila = await prisma.dnxSocialPublishRequest.findUnique({
    where: { idempotencyKey: albumConsentKey(albumId) },
    select: { metadata: true },
  });
  if (!fila?.metadata) return null;
  const m = fila.metadata as Record<string, unknown>;
  return {
    albumId,
    consentGiven: m.consentGiven === true,
    consentAt: typeof m.consentAt === "string" ? m.consentAt : null,
    consentByUserId: typeof m.consentByUserId === "number" ? m.consentByUserId : null,
    selectedPhotoIds: Array.isArray(m.selectedPhotoIds)
      ? (m.selectedPhotoIds as number[])
      : [],
    photographerHandle:
      typeof m.photographerHandle === "string" ? m.photographerHandle : null,
  };
}
```

Agregar `@repo/media-composition` a las dependencias de `apps/compramelafoto/package.json` y correr `pnpm install`.

- [ ] **Step 6: Verificar tipos y commit**

Run: `pnpm --filter compramelafoto typecheck && pnpm --filter compramelafoto test:social`
Expected: sin errores, tests en verde.

```bash
git add apps/compramelafoto/ pnpm-lock.yaml
git commit -m "Permiso de difusión y elección de fotos para redes, por álbum"
```

---

### Task 10: Las dos plantillas y el armado de las piezas del álbum

**Files:**
- Create: `apps/compramelafoto/lib/social/album-piece-templates.ts`
- Create: `apps/compramelafoto/lib/social/build-album-pieces.ts`
- Create: `apps/compramelafoto/lib/social/build-album-pieces.test.ts`

**Interfaces:**
- Consumes: `SocialPieceSpec`, `PublishPieceInput` de `@repo/social-pieces`; `MentionCandidate` de `@repo/social-publisher`; `getPublicUrl` de `@/lib/r2-public-url`.
- Produces: `ALBUM_CAROUSEL_DOCUMENT`, `ALBUM_STORY_DOCUMENT`, `ALBUM_VARIABLE_CONTRACT`, `buildAlbumCaption(datos)`, `buildAlbumMentions(datos)`, `buildAlbumPieceSpecs(datos)`.

**Datos que entran (`AlbumSocialData`):** `albumId`, `albumName`, `eventDate`, `publicSlug`, `photographerHandle`, `organizerHandle`, `sponsorHandles`, `photoUrls` (ya con marca de agua).

**Las fotos van con marca de agua.** Se usa `Photo.previewWatermarkedKey` resuelto con
`getPublicUrl`. Publicar el original en alta sería regalar el producto que se vende.

**Prohibido en estas plantillas:** cualquier campo de documento. El contrato de variables
solo declara las que están abajo; si alguien agrega una de documento, el test de
privacidad falla.

- [ ] **Step 1: Escribir el test que falla**

```ts
// apps/compramelafoto/lib/social/build-album-pieces.test.ts
import { describe, expect, it } from "vitest";
import {
  buildAlbumCaption,
  buildAlbumMentions,
  buildAlbumPieceSpecs,
} from "./build-album-pieces";
import { ALBUM_VARIABLE_CONTRACT } from "./album-piece-templates";

const datos = {
  albumId: 42,
  albumName: "Maratón de Santa Fe 2026",
  eventDate: new Date("2026-08-30T00:00:00Z"),
  publicSlug: "maraton-santa-fe-2026",
  photographerHandle: "fotografo",
  organizerHandle: "maratonsantafe",
  sponsorHandles: ["sponsoruno"],
  photoUrls: [
    "https://cdn.test/1.jpg",
    "https://cdn.test/2.jpg",
    "https://cdn.test/3.jpg",
  ],
};

describe("copy del álbum", () => {
  it("nombra el álbum, la web y el link", () => {
    const copy = buildAlbumCaption(datos);
    expect(copy).toContain("Maratón de Santa Fe 2026");
    expect(copy).toContain("compramelafoto.com/a/maraton-santa-fe-2026");
  });

  it("no incluye las menciones: de eso se ocupa el motor", () => {
    expect(buildAlbumCaption(datos)).not.toContain("@fotografo");
  });
});

describe("menciones del álbum", () => {
  it("prioriza fotógrafo, organizador, sponsor y la plataforma", () => {
    const m = buildAlbumMentions(datos);
    expect(m.map((c) => c.handle)).toEqual([
      "fotografo",
      "maratonsantafe",
      "sponsoruno",
      "compramelafoto",
    ]);
    expect(m[0]!.priority).toBeLessThan(m[1]!.priority);
  });

  it("omite los que no tienen usuario", () => {
    const m = buildAlbumMentions({ ...datos, organizerHandle: null, sponsorHandles: [] });
    expect(m.map((c) => c.handle)).toEqual(["fotografo", "compramelafoto"]);
  });
});

describe("piezas del álbum", () => {
  it("arma un carrusel y una historia", () => {
    const specs = buildAlbumPieceSpecs(datos);
    expect(specs.map((s) => s.format)).toEqual(["CAROUSEL", "STORY"]);
    expect(specs[0]!.pieceId).toBe("clf-album-carousel");
    expect(specs[1]!.pieceId).toBe("clf-album-story");
  });

  it("la historia lleva el link impreso, porque no puede ser tocable", () => {
    const historia = buildAlbumPieceSpecs(datos)[1]!;
    expect(String(historia.values.urlAlbum)).toContain("compramelafoto.com/a/");
  });
});

describe("privacidad", () => {
  it("el contrato no declara ninguna variable de documento", () => {
    const claves = ALBUM_VARIABLE_CONTRACT.variables.map((v) => v.key.toLowerCase());
    for (const prohibida of ["documento", "dni", "documentnumber", "documenttype"]) {
      expect(claves.some((k) => k.includes(prohibida))).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter compramelafoto test:social`
Expected: FAIL — no existen los módulos.

- [ ] **Step 3: Implementar las plantillas**

`album-piece-templates.ts` exporta `ALBUM_VARIABLE_CONTRACT` y los dos documentos del
Designer. El contrato declara exactamente estas variables, y ninguna más:

```ts
import type { DesignDocument, VariableContract } from "@repo/design-studio";

export const ALBUM_VARIABLE_CONTRACT: VariableContract = {
  variables: [
    { key: "nombreAlbum", type: "text", label: "Nombre del álbum", required: true, sampleValue: "Maratón de Santa Fe 2026", maxLength: 60 },
    { key: "fecha", type: "date", label: "Fecha del evento", required: false, sampleValue: "30/08/2026", dateFormat: "es-AR-short" },
    { key: "arrobaFotografo", type: "text", label: "Usuario de Instagram del fotógrafo", required: false, sampleValue: "@fotografo", maxLength: 31 },
    { key: "urlAlbum", type: "url", label: "Dirección del álbum", required: true, sampleValue: "compramelafoto.com/a/maraton" },
    { key: "foto1", type: "image", label: "Foto 1", required: true, sampleValue: "https://cdn/1.jpg" },
    { key: "foto2", type: "image", label: "Foto 2", required: true, sampleValue: "https://cdn/2.jpg" },
    { key: "foto3", type: "image", label: "Foto 3", required: true, sampleValue: "https://cdn/3.jpg" },
    { key: "foto4", type: "image", label: "Foto 4", required: false, sampleValue: "https://cdn/4.jpg" },
  ],
};
```

Los dos documentos se escriben siguiendo `DesignDocument` de `@repo/design-studio`, con la
misma forma que `apps/fotoffice/lib/carnet/template.ts` — **leer ese archivo antes de
escribir estos**, es el ejemplo vivo del formato. Medidas: carrusel 1080×1350 px, historia
1080×1920 px, ambas con `medium` de pantalla y sin sangrado.

La historia lleva, además de las fotos: el logo, `{{nombreAlbum}}`, `{{arrobaFotografo}}` y
`{{urlAlbum}}` **impresos como texto**, porque Meta no permite stickers por API.

- [ ] **Step 4: Implementar el armado**

```ts
// apps/compramelafoto/lib/social/build-album-pieces.ts
import type { MentionCandidate } from "@repo/social-publisher";
import type { SocialPieceSpec } from "@repo/social-pieces";
import {
  ALBUM_CAROUSEL_DOCUMENT,
  ALBUM_STORY_DOCUMENT,
  ALBUM_VARIABLE_CONTRACT,
} from "./album-piece-templates";

export type AlbumSocialData = {
  albumId: number;
  albumName: string;
  eventDate: Date | null;
  publicSlug: string;
  photographerHandle: string | null;
  organizerHandle: string | null;
  sponsorHandles: string[];
  /** Ya con marca de agua, en orden de selección. */
  photoUrls: string[];
};

export const PLATFORM_HANDLE = "compramelafoto";

export function albumPublicUrl(slug: string): string {
  return `compramelafoto.com/a/${slug}`;
}

export function buildAlbumCaption(datos: AlbumSocialData): string {
  const lineas = [
    `📸 ${datos.albumName}`,
    "",
    "Las fotos ya están disponibles. Buscá las tuyas y llevátelas:",
    albumPublicUrl(datos.publicSlug),
  ];
  return lineas.join("\n");
}

/**
 * Menciones en orden de importancia. El motor decide cuáles entran como colaboradores y
 * cuáles caen al copy: el límite de Instagram no está documentado de forma estable.
 */
export function buildAlbumMentions(datos: AlbumSocialData): MentionCandidate[] {
  const candidatos: MentionCandidate[] = [];
  if (datos.photographerHandle) {
    candidatos.push({ handle: datos.photographerHandle, priority: 1, role: "PHOTOGRAPHER" });
  }
  if (datos.organizerHandle) {
    candidatos.push({ handle: datos.organizerHandle, priority: 2, role: "ORGANIZER" });
  }
  datos.sponsorHandles.forEach((h, i) => {
    candidatos.push({ handle: h, priority: 3 + i * 0.1, role: "SPONSOR" });
  });
  candidatos.push({ handle: PLATFORM_HANDLE, priority: 100, role: "PLATFORM" });
  return candidatos;
}

export function buildAlbumPieceSpecs(datos: AlbumSocialData): SocialPieceSpec[] {
  const values = {
    nombreAlbum: datos.albumName,
    fecha: datos.eventDate,
    arrobaFotografo: datos.photographerHandle ? `@${datos.photographerHandle}` : "",
    urlAlbum: albumPublicUrl(datos.publicSlug),
    foto1: datos.photoUrls[0] ?? "",
    foto2: datos.photoUrls[1] ?? "",
    foto3: datos.photoUrls[2] ?? "",
    foto4: datos.photoUrls[3] ?? "",
  };

  // El Designer no sabe de red: se le entregan los bytes de cada foto.
  const resources = {
    async read(ref: string): Promise<Uint8Array | null> {
      if (!/^https?:\/\//.test(ref)) return null;
      try {
        const r = await fetch(ref);
        if (!r.ok) return null;
        return new Uint8Array(await r.arrayBuffer());
      } catch {
        return null;
      }
    },
  };

  return [
    {
      pieceId: "clf-album-carousel",
      format: "CAROUSEL",
      document: ALBUM_CAROUSEL_DOCUMENT,
      contract: ALBUM_VARIABLE_CONTRACT,
      values,
      resources,
    },
    {
      pieceId: "clf-album-story",
      format: "STORY",
      document: ALBUM_STORY_DOCUMENT,
      contract: ALBUM_VARIABLE_CONTRACT,
      values,
      resources,
    },
  ];
}
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `pnpm --filter compramelafoto test:social && pnpm --filter compramelafoto typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/compramelafoto/lib/social/
git commit -m "Plantillas del carrusel y la historia del álbum, con menciones priorizadas"
```

---

### Task 11: Almacén Prisma, worker y cron

**Files:**
- Create: `apps/compramelafoto/lib/social/prisma-store.ts`
- Create: `apps/compramelafoto/lib/social/worker.ts`
- Create: `apps/compramelafoto/app/api/cron/social-publish/route.ts`
- Modify: `apps/compramelafoto/next.config.ts` (empaquetado de binarios nativos)
- Modify: `apps/compramelafoto/vercel.json` (cron cada 5 minutos)

**Interfaces:**
- Consumes: `createSocialPublisherEngine`, `SocialPublisherStore` de `@repo/social-publisher`.
- Produces: `createClfSocialStore()`, `runSocialPublishWorker()`, la ruta `GET /api/cron/social-publish`.

**Copiar, no inventar.** El patrón ya existe y funciona en producción:
`apps/clickaton/lib/social-publisher/prisma-store.ts`, `worker.ts` y
`app/api/cron/social-publish/route.ts`. **Leer esos tres archivos primero** y adaptarlos
cambiando la aplicación a `COMPRAMELAFOTO` y la variable de cuenta a
`CLF_SOCIAL_ACCOUNT_ID`. No hay decisión de diseño nueva acá.

- [ ] **Step 1: Leer el patrón existente**

```bash
cat apps/clickaton/lib/social-publisher/prisma-store.ts
cat apps/clickaton/lib/social-publisher/worker.ts
cat apps/clickaton/app/api/cron/social-publish/route.ts
cat apps/clickaton/vercel.json
```

- [ ] **Step 2: Escribir el almacén y el worker**

`prisma-store.ts` implementa `SocialPublisherStore` contra `prisma.dnxSocialAccount`,
`prisma.dnxSocialPublishRequest`, `dnxSocialPublishAttempt` y `dnxSocialPublishLog`,
filtrando siempre por `application: "COMPRAMELAFOTO"`. **Los borradores de permiso
(`entityType: "ALBUM_SOCIAL_CONSENT"`) quedan excluidos de `processDue`**: son datos, no
publicaciones. El filtro de estado (`APPROVED`/`SCHEDULED`/`FAILED` con `nextRetryAt`) ya
los deja afuera porque están en `DRAFT`, pero conviene además excluirlos por `entityType`
para que un cambio futuro de estado no los publique por accidente.

`worker.ts` arma el motor con `createInstagramPublishProvider()` y
`livePublish: process.env.DNX_SOCIAL_PUBLISHER_LIVE === "true"`, y expone
`runSocialPublishWorker()`.

- [ ] **Step 3: Escribir la ruta del cron**

La ruta valida `CRON_SECRET` con el helper que ya existe en
`apps/compramelafoto/lib/cron-auth.ts` (leerlo antes: CLF tiene su propia convención de
autenticación de cron, distinta de la de Clickatón), llama a `runSocialPublishWorker()` y
devuelve el resumen en JSON.

- [ ] **Step 4: Configurar el empaquetado y el cron**

En `apps/compramelafoto/next.config.ts` ya está declarado `pdf-to-png-converter` en
`serverExternalPackages` (línea 90) — verificar que `sharp` también esté; si no, agregarlo.

En `apps/compramelafoto/vercel.json`, agregar el cron:

```json
{ "path": "/api/cron/social-publish", "schedule": "*/5 * * * *" }
```

- [ ] **Step 5: Aplicar el cupo diario en el worker**

Usar lo de Task 6. Quedarse sin cupo **no es un error: es esperar**. Antes de procesar la
tanda, el worker consulta el cupo de la cuenta y, si no entra lo pendiente, difiere en vez
de fallar — así no gasta intentos ni marca solicitudes como fallidas por algo que se
resuelve solo en unas horas.

```ts
import { fetchPublishingLimit, hasQuotaFor } from "@repo/social-publisher";

// …dentro de runSocialPublishWorker, antes de llamar a processDue:
const pendientes = await contarPendientes(); // APPROVED/SCHEDULED vencidas
if (pendientes > 0) {
  const limite = await fetchPublishingLimit(cuenta.externalAccountId, token);
  if (!hasQuotaFor(limite, pendientes)) {
    console.warn(
      `[social] cupo de Instagram casi agotado (${limite?.used}/${limite?.total}); ` +
        `se difieren ${pendientes} publicaciones`,
    );
    return { processed: 0, deferred: pendientes, reason: "QUOTA" };
  }
}
```

El cupo solo se consulta cuando hay algo para publicar: es una llamada a Meta y no tiene
sentido gastarla en los ciclos en que la cola está vacía.

- [ ] **Step 6: Verificar**

Run: `pnpm --filter compramelafoto typecheck && pnpm --filter compramelafoto build`
Expected: compila. El build es la prueba que importa acá: es donde aparecen los problemas
de binarios nativos.

- [ ] **Step 7: Commit**

```bash
git add apps/compramelafoto/
git commit -m "Almacén, worker y cron de publicación social en CompraMeLaFoto"
```

---

### Task 12: Conectar la cuenta de Instagram desde CLF

**Files:**
- Create: `apps/compramelafoto/app/api/social/instagram/connect/route.ts`
- Create: `apps/compramelafoto/app/api/social/instagram/callback/route.ts`
- Create: `apps/compramelafoto/app/api/cron/social-token-refresh/route.ts`
- Create: `apps/compramelafoto/lib/social/connect-account.ts`
- Modify: `apps/compramelafoto/vercel.json`

**Interfaces:**
- Consumes: `buildInstagramAuthorizeUrl`, `exchangeInstagramCode`, `decideTokenRefresh`, `refreshInstagramToken`, `encryptSecret`, `tryLoadSocialMasterKeyFromEnv` de `@repo/social-publisher`.
- Produces: `startInstagramConnection(userId)`, `completeInstagramConnection(code, state)`, `runSocialTokenRefresh()`.

**Seguridad, sin excepciones:**
- Las dos rutas son **solo para administradores**. Usar el guard de admin que ya existe en
  `apps/compramelafoto/lib/auth-guards.ts` (leerlo antes de escribir).
- El `state` es un valor aleatorio guardado en cookie `httpOnly` y verificado en el
  retorno. Sin eso, cualquiera puede hacer que se conecte una cuenta ajena.
- El token **nunca** se escribe en un log ni se devuelve en una respuesta. Se cifra con
  `encryptSecret` y se guarda en `tokenCiphertext`/`tokenNonce`/`tokenAuthTag`.
- Si falta `DNX_SOCIAL_VAULT_MASTER_KEY`, la conexión falla con un mensaje claro en vez de
  guardar el token en claro.

- [ ] **Step 1: Escribir `connect-account.ts`**

`startInstagramConnection` genera el `state`, lo devuelve junto con la URL de
`buildInstagramAuthorizeUrl`. `completeInstagramConnection` llama a
`exchangeInstagramCode`, cifra el token y hace `upsert` de `DnxSocialAccount` por
`[platform, externalAccountId]` con `status: "ACTIVE"`, `expiresAt` y `scopes`; después
crea el `DnxSocialAccountGrant` con `application: "COMPRAMELAFOTO"` y `canPublish: true`.

- [ ] **Step 2: Escribir las dos rutas**

`connect/route.ts`: valida admin, arma la URL, setea la cookie `httpOnly` con el `state` y
redirige a Instagram.

`callback/route.ts`: valida admin, compara el `state` de la query con el de la cookie
(rechaza si no coinciden), llama a `completeInstagramConnection` y redirige a
`/admin/social` con un mensaje de éxito o de error. **La respuesta no incluye el token.**

- [ ] **Step 3: Escribir el cron de renovación**

`social-token-refresh/route.ts`: valida `CRON_SECRET`, recorre las cuentas
`INSTAGRAM` con grant de `COMPRAMELAFOTO`, y para cada una aplica `decideTokenRefresh`
usando `createdAt` y `expiresAt`. Si la decisión es `REFRESH`, descifra el token, llama a
`refreshInstagramToken`, vuelve a cifrar y actualiza `expiresAt` y `lastValidatedAt`. Si
falla, pone `status: "EXPIRED"` y registra el error. Devuelve cuántas revisó, renovó y
falló.

En `vercel.json`:

```json
{ "path": "/api/cron/social-token-refresh", "schedule": "0 4 * * *" }
```

Una vez por día alcanza: el margen es de 10 días.

- [ ] **Step 4: Probar la conexión de punta a punta**

Con `DNX_SOCIAL_PUBLISHER_LIVE` **sin definir**, entrar a `/api/social/instagram/connect`
como admin, completar el login de Instagram y verificar en la base:

```sql
SELECT id, username, status, "expiresAt", "tokenCiphertext" IS NOT NULL AS tiene_token
FROM "DnxSocialAccount" WHERE platform = 'INSTAGRAM';
```

Expected: una fila `ACTIVE`, con `expiresAt` a unos 60 días y `tiene_token = true`.

Verificar además que el token **no** aparece en los logs de la función.

- [ ] **Step 5: Commit**

```bash
git add apps/compramelafoto/
git commit -m "Conectar y renovar la cuenta de Instagram de CompraMeLaFoto"
```

---

### Task 13: Disparador al quedar el álbum analizado

**Files:**
- Create: `apps/compramelafoto/lib/social/enqueue-album-pieces.ts`
- Create: `apps/compramelafoto/lib/social/enqueue-album-pieces.test.ts`
- Modify: `apps/compramelafoto/lib/cron/send-album-notifications.ts:76-131`

**Interfaces:**
- Consumes: `decideAlbumSocialGeneration`, `getAlbumSocialConsent` (Task 9); `buildAlbumPieceSpecs`, `buildAlbumCaption`, `buildAlbumMentions` (Task 10); `publishPiece` (Task 8); `uploadToR2`, `getPublicUrl` de CLF.
- Produces: `enqueueAlbumSocialPieces(albumId, deps?)` → `{ enqueued: boolean; reason?: string }`.

**Soft-fail, obligatorio.** Este disparador cuelga del mismo lugar donde se manda el correo
de "las fotos ya están disponibles". **Si falla, no debe romper el correo.** Va envuelto en
`try/catch` con un `console.warn`, igual que hace Clickatón tras el pago
(`apps/clickaton/lib/checkout/application/apply-payment-event.ts` — leerlo como referencia).

**Dos solicitudes, no una.** Carrusel e historia son publicaciones distintas para Meta, con
claves `clf:album-carousel:{albumId}` y `clf:album-story:{albumId}`, enlazadas por
`metadata.groupKey = "clf:album:{albumId}"` para que el panel las muestre juntas.

- [ ] **Step 1: Escribir el test que falla**

```ts
// apps/compramelafoto/lib/social/enqueue-album-pieces.test.ts
import { describe, expect, it, vi } from "vitest";
import { enqueueAlbumSocialPieces } from "./enqueue-album-pieces";

const consentOk = {
  albumId: 42,
  consentGiven: true,
  consentAt: "2026-09-01T10:00:00Z",
  consentByUserId: 7,
  selectedPhotoIds: [1, 2, 3],
  photographerHandle: "fotografo",
};

const albumOk = {
  id: 42,
  name: "Maratón 2026",
  eventDate: new Date("2026-08-30T00:00:00Z"),
  publicSlug: "maraton-2026",
  organizerHandle: null,
  sponsorHandles: [],
  photoUrls: ["https://cdn/1.jpg", "https://cdn/2.jpg", "https://cdn/3.jpg"],
};

function deps(over: Record<string, unknown> = {}) {
  return {
    getConsent: vi.fn(async () => consentOk),
    getAlbum: vi.fn(async () => albumOk),
    isReady: vi.fn(async () => true),
    alreadyEnqueued: vi.fn(async () => false),
    socialAccountId: async () => "acc1",
    upload: vi.fn(async () => "https://cdn.test/pieza.jpg"),
    render: vi.fn(async () => ({
      fileName: "p.jpg",
      contentType: "image/jpeg" as const,
      bytes: new Uint8Array([0xff, 0xd8, 0xff]),
      rendererVersion: "1",
      schemaVersion: 1,
      resolvedValues: {},
      omittedVariables: [],
    })),
    createRequest: vi.fn(async () => undefined),
    ...over,
  };
}

describe("enqueueAlbumSocialPieces", () => {
  it("crea dos solicitudes: carrusel e historia", async () => {
    const d = deps();
    const r = await enqueueAlbumSocialPieces(42, d);
    expect(r.enqueued).toBe(true);
    expect(d.createRequest).toHaveBeenCalledTimes(2);
    const claves = d.createRequest.mock.calls.map(
      (c) => (c[0] as { idempotencyKey: string }).idempotencyKey,
    );
    expect(claves).toEqual(["clf:album-carousel:42", "clf:album-story:42"]);
  });

  it("las enlaza con la misma clave de grupo", async () => {
    const d = deps();
    await enqueueAlbumSocialPieces(42, d);
    for (const call of d.createRequest.mock.calls) {
      const meta = (call[0] as { metadata: Record<string, unknown> }).metadata;
      expect(meta.groupKey).toBe("clf:album:42");
    }
  });

  it("no crea nada sin permiso", async () => {
    const d = deps({
      getConsent: vi.fn(async () => ({ ...consentOk, consentGiven: false })),
    });
    const r = await enqueueAlbumSocialPieces(42, d);
    expect(r).toEqual({ enqueued: false, reason: "NO_CONSENT" });
    expect(d.createRequest).not.toHaveBeenCalled();
  });

  it("no crea nada si nunca se configuró el permiso", async () => {
    const d = deps({ getConsent: vi.fn(async () => null) });
    const r = await enqueueAlbumSocialPieces(42, d);
    expect(r).toEqual({ enqueued: false, reason: "NO_CONSENT" });
  });

  it("no duplica si ya se encoló", async () => {
    const d = deps({ alreadyEnqueued: vi.fn(async () => true) });
    const r = await enqueueAlbumSocialPieces(42, d);
    expect(r).toEqual({ enqueued: false, reason: "ALREADY_GENERATED" });
  });

  it("no crea nada si el álbum todavía se analiza", async () => {
    const d = deps({ isReady: vi.fn(async () => false) });
    const r = await enqueueAlbumSocialPieces(42, d);
    expect(r).toEqual({ enqueued: false, reason: "ALBUM_NOT_READY" });
  });

  it("sin cuenta conectada no explota: informa y sigue", async () => {
    const d = deps({ socialAccountId: async () => null });
    const r = await enqueueAlbumSocialPieces(42, d);
    expect(r).toEqual({ enqueued: false, reason: "NO_ACCOUNT" });
    expect(d.createRequest).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter compramelafoto test:social`
Expected: FAIL — no existe `./enqueue-album-pieces`.

- [ ] **Step 3: Implementar**

`enqueueAlbumSocialPieces(albumId, deps)` con todas las dependencias inyectables (así se
testea sin base ni red), en este orden:

1. `alreadyEnqueued(albumId)` → si es true, devolver `ALREADY_GENERATED`.
2. `getConsent(albumId)` → si es null o `consentGiven: false`, devolver `NO_CONSENT`.
3. `isReady(albumId)` → si es false, devolver `ALBUM_NOT_READY`.
4. `decideAlbumSocialGeneration(...)` con lo anterior; si dice que no, devolver su motivo.
5. `socialAccountId()` → si es null, devolver `NO_ACCOUNT`.
6. `getAlbum(albumId)` para los datos y las URLs con marca de agua.
7. Para cada spec de `buildAlbumPieceSpecs`, llamar a `publishPiece` con `render` y
   `upload` inyectados, y pasar a `createRequest` el resultado con
   `metadata.groupKey = "clf:album:{albumId}"`.

En producción, las dependencias por defecto son: `getAlbumSocialConsent`, una consulta
Prisma del álbum con `previewWatermarkedKey` resuelto por `getPublicUrl`,
`getAlbumReadiness` de `@/lib/analysis/album-analysis-readiness`, `uploadToR2` de
`@/lib/r2-client` con prefijo `social/albums/{albumId}/`, y el motor de Task 11.

- [ ] **Step 4: Enganchar el disparador en el cron de avisos**

En `apps/compramelafoto/lib/cron/send-album-notifications.ts`, dentro del bucle que ya
recorre los álbumes listos (alrededor de la línea 76), después de encolar el correo:

```ts
      // Soft-fail: la difusión en redes no puede romper el aviso al cliente.
      try {
        await enqueueAlbumSocialPieces(album.id);
      } catch (error) {
        console.warn(
          `[social] no se pudieron encolar las piezas del álbum ${album.id}`,
          error instanceof Error ? error.message : error,
        );
      }
```

- [ ] **Step 5: Correr los tests y verificar que pasan**

Run: `pnpm --filter compramelafoto test:social && pnpm --filter compramelafoto typecheck`
Expected: PASS, 7 tests nuevos.

- [ ] **Step 6: Commit**

```bash
git add apps/compramelafoto/
git commit -m "Encolar carrusel e historia cuando el álbum queda analizado"
```

---

### Task 14: Panel de aprobación

**Files:**
- Create: `apps/compramelafoto/app/admin/social/page.tsx`
- Create: `apps/compramelafoto/app/admin/social/actions.ts`
- Create: `apps/compramelafoto/lib/social/panel-presentation.ts`
- Create: `apps/compramelafoto/lib/social/panel-presentation.test.ts`

**Interfaces:**
- Consumes: el motor de Task 11.
- Produces: `groupRequestsForPanel(requests)`, `PanelGroup`, y las acciones de servidor `approveGroup`, `rejectRequest`, `retryRequest`, `scheduleGroup`.

**Qué muestra.** Una tarjeta por álbum (agrupando por `metadata.groupKey`) con las dos
piezas, el copy, los colaboradores que van etiquetados, las menciones que caen al copy, el
estado de cada una y el permalink si ya se publicó. Un botón aprueba las dos; cada pieza se
puede rechazar por separado.

**Referencia:** `apps/clickaton/app/admin/(panel)/social/page.tsx` ya resuelve el listado,
las acciones y los estados. Leerlo antes de escribir. Lo único nuevo es el agrupado.

- [ ] **Step 1: Escribir el test del agrupado**

```ts
// apps/compramelafoto/lib/social/panel-presentation.test.ts
import { describe, expect, it } from "vitest";
import { groupRequestsForPanel } from "./panel-presentation";

const base = {
  status: "PENDING_APPROVAL" as const,
  caption: "Álbum nuevo",
  permalink: null,
  createdAt: new Date("2026-09-05T10:00:00Z"),
};

describe("groupRequestsForPanel", () => {
  it("junta el carrusel y la historia del mismo álbum", () => {
    const grupos = groupRequestsForPanel([
      { ...base, id: "a", entityId: "42", metadata: { groupKey: "clf:album:42", format: "CAROUSEL", collaborators: ["fotografo"] } },
      { ...base, id: "b", entityId: "42", metadata: { groupKey: "clf:album:42", format: "STORY", collaborators: [] } },
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.pieces.map((p) => p.format)).toEqual(["CAROUSEL", "STORY"]);
    expect(grupos[0]!.collaborators).toEqual(["fotografo"]);
  });

  it("separa álbumes distintos", () => {
    const grupos = groupRequestsForPanel([
      { ...base, id: "a", entityId: "42", metadata: { groupKey: "clf:album:42", format: "CAROUSEL" } },
      { ...base, id: "b", entityId: "43", metadata: { groupKey: "clf:album:43", format: "CAROUSEL" } },
    ]);
    expect(grupos).toHaveLength(2);
  });

  it("una solicitud sin clave de grupo queda sola, no se pierde", () => {
    const grupos = groupRequestsForPanel([
      { ...base, id: "a", entityId: "9", metadata: {} },
    ]);
    expect(grupos).toHaveLength(1);
    expect(grupos[0]!.pieces).toHaveLength(1);
  });

  it("el grupo se puede aprobar solo si todas sus piezas están pendientes", () => {
    const grupos = groupRequestsForPanel([
      { ...base, id: "a", entityId: "42", metadata: { groupKey: "g", format: "CAROUSEL" } },
      { ...base, id: "b", entityId: "42", status: "PUBLISHED", metadata: { groupKey: "g", format: "STORY" } },
    ]);
    expect(grupos[0]!.canApproveAll).toBe(false);
  });

  it("ordena del más nuevo al más viejo", () => {
    const grupos = groupRequestsForPanel([
      { ...base, id: "a", entityId: "1", createdAt: new Date("2026-09-01T00:00:00Z"), metadata: { groupKey: "g1" } },
      { ...base, id: "b", entityId: "2", createdAt: new Date("2026-09-05T00:00:00Z"), metadata: { groupKey: "g2" } },
    ]);
    expect(grupos[0]!.groupKey).toBe("g2");
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter compramelafoto test:social`
Expected: FAIL — no existe `./panel-presentation`.

- [ ] **Step 3: Implementar el agrupado**

`groupRequestsForPanel` agrupa por `metadata.groupKey` (y por `id` cuando no hay clave, para
que nada se pierda), ordena los grupos por `createdAt` descendente, ordena las piezas
dentro del grupo poniendo el carrusel antes que la historia, junta los colaboradores de
todas las piezas sin repetir, y calcula `canApproveAll` como "todas las piezas están en
`PENDING_APPROVAL`".

- [ ] **Step 4: Escribir la página y las acciones**

La página valida admin con el guard existente, lista los grupos, muestra la miniatura de
cada pieza, el copy, los colaboradores y las menciones, y ofrece aprobar el grupo,
rechazar una pieza con motivo, programar y reintentar. Las acciones de servidor delegan en
el motor de Task 11 y registran quién hizo qué (`approvedByUserId`).

Mostrar arriba, siempre visible, el estado de la cuenta conectada y si
`DNX_SOCIAL_PUBLISHER_LIVE` está activo: sin eso, alguien va a aprobar diez publicaciones
sin entender por qué no aparecen en Instagram.

- [ ] **Step 5: Verificar**

Run: `pnpm --filter compramelafoto test:social && pnpm --filter compramelafoto typecheck && pnpm --filter compramelafoto build`
Expected: PASS y build limpio.

- [ ] **Step 6: Commit**

```bash
git add apps/compramelafoto/
git commit -m "Panel de aprobación de publicaciones sociales en CompraMeLaFoto"
```

---

## Verificación final de la etapa

Antes de dar por cerrado el plan, con `DNX_SOCIAL_PUBLISHER_LIVE` **sin definir**:

- [ ] `pnpm --filter @repo/social-publisher test` — verde
- [ ] `pnpm --filter @repo/social-pieces test` — verde
- [ ] `pnpm --filter compramelafoto test:social` — verde
- [ ] `pnpm --filter compramelafoto typecheck` — sin errores
- [ ] `pnpm --filter compramelafoto build` — compila (es donde aparecen los problemas de binarios nativos)
- [ ] `pnpm --filter clickaton test` y `selfcheck:social-publisher` — **siguen verdes**: el motor se amplió sin romper a Clickatón
- [ ] Conectar la cuenta y verificar en la base que el token quedó cifrado y `expiresAt` a ~60 días
- [ ] Marcar 3 fotos en un álbum de prueba, dar el permiso, forzar el cron de avisos y verificar que aparecen **dos** solicitudes en el panel, agrupadas
- [ ] Aprobar y confirmar que el intento quedó registrado como simulacro (`dryRun: true`), sin llamadas a Meta
- [ ] Recién entonces, y como decisión aparte, activar `DNX_SOCIAL_PUBLISHER_LIVE=true`

## Lo que queda para otros planes

- **CLF, bienvenida a fotógrafo nuevo** ("yo uso CompraMeLaFoto"). Está en el catálogo del spec §5 pero fuera de este plan: reusa todo lo de acá y solo agrega una plantilla y un disparador en el alta verificada. Entra como plan corto una vez que las etapas 1-4 estén en producción.
- **Etapa 5** — fotoffice: bienvenida a socio (automática) y a sponsor (a mano), con una cuenta por workspace.
- **Etapa 6** — FotoRank: bienvenida a participante y obras ganadoras.
- **Etapa 7** — Clickatón: migrar lo existente al motor ampliado.
- **Fuera de alcance del proyecto entero:** que cada persona conecte su cuenta (requiere revisión de app de Meta), stickers tocables en historias (Meta no lo permite), Reels y YouTube.
