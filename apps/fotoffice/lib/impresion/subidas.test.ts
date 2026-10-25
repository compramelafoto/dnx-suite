import { describe, expect, it } from "vitest";
import { conLimite, validarArchivoFoto } from "./subidas";

describe("subir fotos", () => {
  it("acepta JPG, PNG y WebP de hasta 60 MB; avisa HEIC y lo demás", () => {
    expect(validarArchivoFoto({ name: "a.jpg", type: "image/jpeg", size: 1000 })).toEqual({ ok: true, tipo: "image/jpeg" });
    expect(validarArchivoFoto({ name: "a.png", type: "image/png", size: 1000 })).toEqual({ ok: true, tipo: "image/png" });
    expect(validarArchivoFoto({ name: "IMG_1.HEIC", type: "", size: 1000 })).toEqual({
      ok: false,
      error: "Las fotos HEIC del iPhone no se pueden abrir acá: exportala como JPG (en WhatsApp sale así).",
    });
    expect(validarArchivoFoto({ name: "a.pdf", type: "application/pdf", size: 10 })).toEqual({ ok: false, error: "La foto tiene que ser JPG, PNG o WebP." });
    expect(validarArchivoFoto({ name: "a.jpg", type: "image/jpeg", size: 61 * 1024 * 1024 })).toEqual({
      ok: false,
      error: "La foto pesa 61.0 MB: el máximo es 60 MB.",
    });
  });

  it("de a 3 a la vez, con los resultados en orden y sin cortar por una que falla", async () => {
    let activas = 0;
    let maximo = 0;
    const r = await conLimite([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      activas++;
      maximo = Math.max(maximo, activas);
      await new Promise((ok) => setTimeout(ok, 5 + (n % 3)));
      activas--;
      if (n === 4) throw new Error("cuatro");
      return n * 10;
    });
    expect(maximo).toBe(3);
    expect(r.map((x) => (x.status === "fulfilled" ? x.value : "falló"))).toEqual([10, 20, 30, "falló", 50, 60, 70]);
  });

  it("sin nada para subir, no hace nada", async () => {
    expect(await conLimite([], 3, async () => 1)).toEqual([]);
  });
});
