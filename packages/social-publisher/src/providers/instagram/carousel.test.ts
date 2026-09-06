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
