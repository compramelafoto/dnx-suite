import { describe, expect, test } from "vitest";
import { claveDeArchivo, validarArchivo, TAMANO_MAXIMO } from "./archivo-subido";

describe("qué archivo se acepta del invitado", () => {
  test("una foto común pasa", () => {
    expect(validarArchivo({ tipo: "image/jpeg", bytes: 3_000_000 }).ok).toBe(true);
  });

  test("acepta los formatos que sacan los celulares", () => {
    for (const t of ["image/jpeg", "image/png", "image/webp", "image/heic"]) {
      expect(validarArchivo({ tipo: t, bytes: 1000 }).ok).toBe(true);
    }
  });

  test("un ejecutable disfrazado de foto no pasa", () => {
    const r = validarArchivo({ tipo: "application/x-msdownload", bytes: 1000 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toMatch(/no es una foto/i);
  });

  test("un archivo enorme no pasa, y el mensaje dice cuánto se puede", () => {
    const r = validarArchivo({ tipo: "image/jpeg", bytes: TAMANO_MAXIMO + 1 });
    expect(r.ok).toBe(false);
    expect(r.motivo).toContain("25");
  });

  test("un archivo vacío no pasa", () => {
    expect(validarArchivo({ tipo: "image/jpeg", bytes: 0 }).ok).toBe(false);
  });
});

describe("dónde se guarda el archivo", () => {
  test("cada evento tiene su carpeta", () => {
    const c = claveDeArchivo("EVT123", "abc-def", "image/jpeg");
    expect(c.startsWith("eventos/EVT123/")).toBe(true);
  });

  test("la extensión sale del tipo, no del nombre que mandó el celular", () => {
    // El nombre original puede venir con "../" o con una extensión mentirosa.
    expect(claveDeArchivo("EVT123", "abc", "image/png").endsWith(".png")).toBe(true);
    expect(claveDeArchivo("EVT123", "abc", "image/jpeg").endsWith(".jpg")).toBe(true);
  });

  test("un identificador con caracteres raros no arma una ruta fuera de la carpeta", () => {
    const c = claveDeArchivo("EVT123", "../../otro-evento/x", "image/jpeg");
    expect(c).not.toContain("..");
    expect(c.startsWith("eventos/EVT123/")).toBe(true);
  });

  test("un código de evento con barras tampoco escapa", () => {
    const c = claveDeArchivo("../admin", "abc", "image/jpeg");
    expect(c).not.toContain("..");
  });
});
