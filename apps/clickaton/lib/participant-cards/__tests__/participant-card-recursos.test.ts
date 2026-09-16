/* eslint-disable turbo/no-undeclared-env-vars -- el test fija la dirección pública documentada */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createParticipantCardResourceResolver } from "../participant-card-design-studio-renderer";

/**
 * Una plantilla del editor guarda las imágenes que se suben con dirección **relativa**
 * (`/api/media/clickaton/products/…`). El motor de dibujo corre en el servidor y no tiene
 * navegador que complete el dominio: una dirección relativa no apunta a ningún lado y la placa
 * falla con "No se encontró la imagen", aunque el archivo esté perfectamente subido.
 */
const ORIGINAL = process.env.CLICKATON_PUBLIC_URL;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.CLICKATON_PUBLIC_URL;
  else process.env.CLICKATON_PUBLIC_URL = ORIGINAL;
});

describe("de dónde saca el motor las imágenes de una plantilla", () => {
  it("completa el dominio de una dirección relativa", async () => {
    process.env.CLICKATON_PUBLIC_URL = "https://maratonfotografica.com";
    const pedidas: string[] = [];

    const resolver = createParticipantCardResourceResolver({
      fetchImpl: async (url) => {
        pedidas.push(String(url));
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 });
      },
    });

    await resolver.read("/api/media/clickaton/products/2026-09-15/marco.png");

    assert.deepEqual(pedidas, [
      "https://maratonfotografica.com/api/media/clickaton/products/2026-09-15/marco.png",
    ]);
  });

  it("no toca una dirección que ya viene completa", async () => {
    const pedidas: string[] = [];
    const resolver = createParticipantCardResourceResolver({
      fetchImpl: async (url) => {
        pedidas.push(String(url));
        return new Response(new Uint8Array([1]), { status: 200 });
      },
    });

    await resolver.read("https://cdn.example.com/foto.jpg");

    assert.deepEqual(pedidas, ["https://cdn.example.com/foto.jpg"]);
  });

  it("sigue leyendo las imágenes que vienen incrustadas", async () => {
    const resolver = createParticipantCardResourceResolver({
      fetchImpl: async () => {
        throw new Error("una imagen incrustada no se descarga");
      },
    });

    const bytes = await resolver.read(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5/hPwAIAgL/4d1j8wAAAABJRU5ErkJggg==",
    );

    assert.ok(bytes && bytes.byteLength > 0);
  });
});
