import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { copyPendingText } from "./copy-pending-text";

class FakeItem {
  constructor(public items: Record<string, Promise<Blob>>) {}
}

describe("copyPendingText", () => {
  it("arranca la escritura antes de que llegue el texto (sirve en Safari)", async () => {
    const orden: string[] = [];
    let resolver!: (t: string) => void;
    const pending = new Promise<string>((r) => (resolver = r));
    const resultado = copyPendingText(pending, {
      clipboard: {
        write: async (items) => {
          orden.push("write");
          const blob = await (items[0] as FakeItem).items["text/plain"];
          orden.push(`copiado:${await blob.text()}`);
        },
      },
      ClipboardItemCtor: FakeItem,
    });
    orden.push("llega el texto");
    resolver("https://www.compramelafoto.com/canje/preventa/abc");
    assert.deepEqual(await resultado, { text: "https://www.compramelafoto.com/canje/preventa/abc", copied: true });
    assert.equal(orden[0], "write");
    assert.equal(orden[2], "copiado:https://www.compramelafoto.com/canje/preventa/abc");
  });

  it("sin permiso de portapapeles devuelve el texto para copiarlo a mano", async () => {
    const r = await copyPendingText(Promise.resolve("link"), {
      clipboard: {
        write: async () => {
          throw new Error("Write permission denied.");
        },
        writeText: async () => {
          throw new Error("Write permission denied.");
        },
      },
      ClipboardItemCtor: FakeItem,
    });
    assert.deepEqual(r, { text: "link", copied: false });
  });

  it("sin ClipboardItem usa writeText", async () => {
    let copiado = "";
    const r = await copyPendingText(Promise.resolve("mensaje"), {
      clipboard: { writeText: async (t) => void (copiado = t) },
      ClipboardItemCtor: null,
    });
    assert.deepEqual(r, { text: "mensaje", copied: true });
    assert.equal(copiado, "mensaje");
  });

  it("si el servidor falla, el error sale para mostrarlo", async () => {
    await assert.rejects(
      copyPendingText(Promise.reject(new Error("No pudimos generar el link.")), { clipboard: null }),
      /No pudimos generar el link/
    );
  });
});
