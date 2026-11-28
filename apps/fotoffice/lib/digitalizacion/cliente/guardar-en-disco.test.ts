import { describe, expect, it } from "vitest";
import { guardarVideoEnDisco, nombreDelVideoFinal, textoAvance } from "./guardar-en-disco";

describe("nombreDelVideoFinal", () => {
  it("cambia la extensión del crudo por .mp4", () => {
    expect(nombreDelVideoFinal("Pedido 12 - Ana - Cassette 1.webm")).toBe("Pedido 12 - Ana - Cassette 1.mp4");
    expect(nombreDelVideoFinal("Pedido 12 - Ana - DVD.vob")).toBe("Pedido 12 - Ana - DVD.mp4");
    expect(nombreDelVideoFinal("Casamiento 1998.mp4")).toBe("Casamiento 1998.mp4");
  });
  it("sin nombre queda Video.mp4", () => {
    expect(nombreDelVideoFinal(".bin")).toBe("Video.mp4");
  });
});

describe("textoAvance", () => {
  it("con porcentaje o con MB", () => {
    expect(textoAvance(42, 1)).toBe("Guardando… 42%");
    expect(textoAvance(null, 12_000_000)).toBe("Guardando… 12 MB");
  });
});

describe("guardarVideoEnDisco", () => {
  it("copia el contenido entero y avisa el avance", async () => {
    const datos = new Uint8Array(1000).fill(7);
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response(datos, { headers: { "content-length": "1000" } })) as typeof fetch;
    const recibido: number[] = [];
    let cerrado = false;
    const destino = new WritableStream<Uint8Array>({
      write(t) { recibido.push(...t); },
      close() { cerrado = true; },
    });
    const avances: (number | null)[] = [];
    try {
      await guardarVideoEnDisco(destino, "https://x/video.mp4", (p) => avances.push(p));
    } finally {
      globalThis.fetch = original;
    }
    expect(recibido.length).toBe(1000);
    expect(cerrado).toBe(true);
    expect(avances.at(-1)).toBe(100);
  });

  it("si el almacenamiento responde error, aborta el archivo y avisa", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response("no", { status: 403 })) as typeof fetch;
    let abortado = false;
    const destino = new WritableStream<Uint8Array>({ abort() { abortado = true; } });
    try {
      await expect(guardarVideoEnDisco(destino, "https://x", () => {})).rejects.toThrow("403");
    } finally {
      globalThis.fetch = original;
    }
    expect(abortado).toBe(true);
  });
});
