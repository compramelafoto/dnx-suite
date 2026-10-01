import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildQrDataUrl, buildQrPng } from "./instructivo-qr";

describe("buildQrPng", () => {
  it("devuelve un PNG real", async () => {
    const png = await buildQrPng("https://compramelafoto.com/a/maraton-2026");
    // Firma PNG: 89 50 4E 47
    assert.deepEqual([...png.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
  });

  it("respeta el tamaño pedido", async () => {
    const chico = await buildQrPng("https://compramelafoto.com/a/x", 120);
    const grande = await buildQrPng("https://compramelafoto.com/a/x", 600);
    assert.ok(grande.length > chico.length);
  });

  it("rechaza una dirección vacía", async () => {
    await assert.rejects(() => buildQrPng("  "));
  });
});

describe("buildQrDataUrl", () => {
  it("devuelve algo incrustable en un img", async () => {
    const dataUrl = await buildQrDataUrl("https://compramelafoto.com/a/x", 120);
    assert.ok(dataUrl.startsWith("data:image/png;base64,"));
  });
});
