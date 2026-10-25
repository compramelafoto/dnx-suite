import { describe, expect, it } from "vitest";
import { enlaceDeDescargaDirecta } from "./video-link";

const DESCARGA = "https://drive.usercontent.google.com/download?id=1gJqrXR_JeXJkZJ8FMnwBYo21KjG0M7nL&export=download&confirm=t";

describe("enlace de video para el proveedor", () => {
  it("convierte el enlace para ver de Drive en descarga directa", () => {
    expect(
      enlaceDeDescargaDirecta(
        "https://drive.google.com/file/d/1gJqrXR_JeXJkZJ8FMnwBYo21KjG0M7nL/view?hl=es",
      ),
    ).toEqual({ ok: true, url: DESCARGA });
  });

  it("acepta el enlace con ?id= y el de descarga", () => {
    expect(
      enlaceDeDescargaDirecta("https://drive.google.com/open?id=1gJqrXR_JeXJkZJ8FMnwBYo21KjG0M7nL"),
    ).toEqual({ ok: true, url: DESCARGA });
    expect(enlaceDeDescargaDirecta(DESCARGA)).toEqual({ ok: true, url: DESCARGA });
  });

  it("una carpeta no sirve y lo dice", () => {
    const r = enlaceDeDescargaDirecta(
      "https://drive.google.com/drive/folders/1AYxJ3T8-lKg8BaqqMsLbB7MRA1XoHE_z",
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/carpeta/);
  });

  it("otro sitio pasa tal cual, pero sólo con https", () => {
    expect(enlaceDeDescargaDirecta(" https://ejemplo.com/clase.mp4 ")).toEqual({
      ok: true,
      url: "https://ejemplo.com/clase.mp4",
    });
    expect(enlaceDeDescargaDirecta("http://ejemplo.com/clase.mp4").ok).toBe(false);
    expect(enlaceDeDescargaDirecta("clase.mp4").ok).toBe(false);
  });
});
