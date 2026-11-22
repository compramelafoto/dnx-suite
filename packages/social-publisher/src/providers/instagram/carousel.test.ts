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
    fetchImpl: fetchEspia(llamadas, ["hijo1", "hijo2", "hijo3", "padre", "estado", "post"]),
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

  // Entre crear el padre y publicarlo se consulta su estado (ver «espera a que Meta…»).
  assert.ok(llamadas[4]!.url.includes("/padre?fields=status_code"));
  const publicar = llamadas.find((l) => l.url.includes("/media_publish"))!;
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

test("la historia etiqueta al fotógrafo con user_tags, sin coordenadas", async () => {
  const llamadas: Llamada[] = [];
  const provider = createInstagramPublishProvider({
    fetchImpl: fetchEspia(llamadas, ["cont", "post"]),
  });

  await provider.publish({
    account: cuenta,
    accessToken: "t",
    caption: "",
    format: "STORY",
    userTags: ["fotografo"],
    assets: [{ assetId: "1", kind: "IMAGE", publicUrl: "https://cdn.test/s.jpg" }],
    dryRun: false,
  });

  assert.equal(llamadas[0]!.body.media_type, "STORIES");
  assert.deepEqual(JSON.parse(llamadas[0]!.body.user_tags!), [{ username: "fotografo" }]);
});

test("si Meta rechaza la etiqueta, la historia sale igual sin etiqueta", async () => {
  const llamadas: Llamada[] = [];
  let n = 0;
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const body = Object.fromEntries(
      new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    ) as Record<string, string>;
    llamadas.push({ url: String(input), body });
    n++;
    if (body.user_tags?.includes("no_existe")) {
      return new Response(
        JSON.stringify({ error: { message: "Invalid user_tags: user not found", code: 100 } }),
        { status: 400 },
      );
    }
    return new Response(JSON.stringify({ id: `id${n}`, permalink: "https://ig.test/s/1/" }), {
      status: 200,
    });
  }) as unknown as typeof fetch;
  const provider = createInstagramPublishProvider({ fetchImpl });

  const r = await provider.publish({
    account: cuenta,
    accessToken: "t",
    caption: "",
    format: "STORY",
    userTags: ["no_existe"],
    assets: [{ assetId: "1", kind: "IMAGE", publicUrl: "https://cdn.test/s.jpg" }],
    dryRun: false,
  });

  assert.equal(r.ok, true);
  const creaciones = llamadas.filter((l) => l.url.endsWith("/media"));
  assert.equal(creaciones.at(-1)!.body.user_tags, undefined);
  assert.deepEqual((r.providerRawSanitized as { droppedUserTags?: string[] }).droppedUserTags, [
    "no_existe",
  ]);
});

test("si una etiqueta extra falla, la historia sale con la del fotógrafo", async () => {
  const llamadas: Llamada[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const body = Object.fromEntries(
      new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    ) as Record<string, string>;
    llamadas.push({ url: String(input), body });
    if (body.user_tags && JSON.parse(body.user_tags).length > 1) {
      return new Response(JSON.stringify({ error: { message: "Invalid user_tags", code: 100 } }), {
        status: 400,
      });
    }
    return new Response(JSON.stringify({ id: `id${llamadas.length}` }), { status: 200 });
  }) as unknown as typeof fetch;
  const provider = createInstagramPublishProvider({ fetchImpl });

  const r = await provider.publish({
    account: cuenta,
    accessToken: "t",
    caption: "",
    format: "STORY",
    userTags: ["fotografo", "cuenta_privada"],
    assets: [{ assetId: "1", kind: "IMAGE", publicUrl: "https://cdn.test/s.jpg" }],
    dryRun: false,
  });

  assert.equal(r.ok, true);
  assert.deepEqual(JSON.parse(llamadas[1]!.body.user_tags!), [{ username: "fotografo" }]);
  assert.deepEqual((r.providerRawSanitized as { droppedUserTags?: string[] }).droppedUserTags, [
    "cuenta_privada",
  ]);
});

test("con 20 etiquetas y dos cuentas malas, saca solo esas dos", async () => {
  const malas = new Set(["mala_7", "mala_15"]);
  const etiquetas = ["fotografo", ...Array.from({ length: 19 }, (_, i) => (i + 1 === 7 || i + 1 === 15 ? `mala_${i + 1}` : `cuenta_${i + 1}`))];
  const llamadas: Llamada[] = [];
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const body = Object.fromEntries(
      new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    ) as Record<string, string>;
    llamadas.push({ url: String(input), body });
    const lista: Array<{ username: string }> = body.user_tags ? JSON.parse(body.user_tags) : [];
    if (lista.some((t) => malas.has(t.username))) {
      return new Response(JSON.stringify({ error: { message: "Invalid user_tags", code: 100 } }), { status: 400 });
    }
    return new Response(JSON.stringify({ id: `id${llamadas.length}` }), { status: 200 });
  }) as unknown as typeof fetch;
  const provider = createInstagramPublishProvider({ fetchImpl });

  const r = await provider.publish({
    account: cuenta,
    accessToken: "t",
    caption: "",
    format: "STORY",
    userTags: etiquetas,
    assets: [{ assetId: "1", kind: "IMAGE", publicUrl: "https://cdn.test/s.jpg" }],
    dryRun: false,
  });

  assert.equal(r.ok, true);
  assert.deepEqual(
    [...((r.providerRawSanitized as { droppedUserTags?: string[] }).droppedUserTags ?? [])].sort(),
    ["mala_15", "mala_7"],
  );
  // El contenedor que se publica lleva a las otras 18, fotógrafo incluido.
  const publicar = llamadas.find((l) => l.url.includes("media_publish"))!;
  const creado = llamadas.find((l) => l.body.user_tags && `id${llamadas.indexOf(l) + 1}` === publicar.body.creation_id)!;
  const usadas = (JSON.parse(creado.body.user_tags!) as Array<{ username: string }>).map((t) => t.username);
  assert.equal(usadas.length, 18);
  assert.ok(usadas.includes("fotografo"));
  assert.ok(llamadas.length <= 32, `demasiados pedidos: ${llamadas.length}`);
});

test("si la cuenta del fotógrafo es la mala, etiqueta igual al resto", async () => {
  const fetchImpl = (async (_input: string | URL, init?: RequestInit) => {
    const body = Object.fromEntries(
      new URLSearchParams(typeof init?.body === "string" ? init.body : ""),
    ) as Record<string, string>;
    const lista: Array<{ username: string }> = body.user_tags ? JSON.parse(body.user_tags) : [];
    if (lista.some((t) => t.username === "fotografo_privado")) {
      return new Response(JSON.stringify({ error: { message: "Invalid user_tags", code: 100 } }), { status: 400 });
    }
    return new Response(JSON.stringify({ id: "ok" }), { status: 200 });
  }) as unknown as typeof fetch;
  const provider = createInstagramPublishProvider({ fetchImpl });
  const r = await provider.publish({
    account: cuenta,
    accessToken: "t",
    caption: "",
    format: "STORY",
    userTags: ["fotografo_privado", "club", "sponsor"],
    assets: [{ assetId: "1", kind: "IMAGE", publicUrl: "https://cdn.test/s.jpg" }],
    dryRun: false,
  });
  assert.deepEqual((r.providerRawSanitized as { droppedUserTags?: string[] }).droppedUserTags, ["fotografo_privado"]);
});

test("espera a que Meta termine de procesar la imagen antes de publicar", async () => {
  const llamadas: string[] = [];
  let consultas = 0;
  const fetchImpl = (async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    llamadas.push(`${init?.method ?? "GET"} ${new URL(url).pathname}`);
    if (url.includes("fields=status_code")) {
      consultas++;
      return new Response(JSON.stringify({ status_code: consultas < 3 ? "IN_PROGRESS" : "FINISHED" }), { status: 200 });
    }
    return new Response(JSON.stringify({ id: url.includes("media_publish") ? "post1" : "cont1" }), { status: 200 });
  }) as unknown as typeof fetch;
  const esperas: number[] = [];
  const provider = createInstagramPublishProvider({ fetchImpl, sleepImpl: async (ms) => void esperas.push(ms) });

  const r = await provider.publish({
    account: cuenta,
    accessToken: "t",
    caption: "",
    format: "STORY",
    assets: [{ assetId: "1", kind: "IMAGE", publicUrl: "https://cdn.test/s.jpg" }],
    dryRun: false,
  });

  assert.equal(r.ok, true);
  assert.equal(consultas, 3);
  assert.equal(esperas.length, 2);
  // Publica recién después de que el contenedor dijo FINISHED.
  const iPublicar = llamadas.findIndex((l) => l.includes("media_publish"));
  const iUltimaConsulta = llamadas.map((l, i) => (l.startsWith("GET /v21.0/cont1") ? i : -1)).filter((i) => i >= 0).pop()!;
  assert.ok(iPublicar > iUltimaConsulta);
});

test("si Meta no puede procesar la imagen, no publica y se reintenta", async () => {
  const fetchImpl = (async (input: string | URL) => {
    const url = String(input);
    if (url.includes("fields=status_code")) return new Response(JSON.stringify({ status_code: "ERROR" }), { status: 200 });
    if (url.includes("media_publish")) throw new Error("no debería publicar");
    return new Response(JSON.stringify({ id: "cont1" }), { status: 200 });
  }) as unknown as typeof fetch;
  const provider = createInstagramPublishProvider({ fetchImpl, sleepImpl: async () => {} });
  await assert.rejects(
    () =>
      provider.publish({
        account: cuenta,
        accessToken: "t",
        caption: "",
        format: "STORY",
        assets: [{ assetId: "1", kind: "IMAGE", publicUrl: "https://cdn.test/s.jpg" }],
        dryRun: false,
      }),
    (e: unknown) => (e as { code?: string; retryable?: boolean }).code === "CONTAINER_FAILED" && (e as { retryable?: boolean }).retryable === true,
  );
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
  // Los hijos se crean una sola vez y se reusan en el reintento del padre: no hay que
  // volver a subir las fotos ni gastar cupo de Meta de nuevo por cada intento.
  const hijosCreados = llamadas.filter((l) => l.body.is_carousel_item === "true");
  assert.equal(hijosCreados.length, 2);
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
