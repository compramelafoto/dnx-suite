import { describe, expect, it } from "vitest";
import { safeContentType, safeFilename } from "./file-names";

describe("nombres de archivo", () => {
  it("saca rutas, comillas y caracteres de control", () => {
    expect(safeFilename("C:\\fotos\\presupuesto \"final\".pdf")).toBe("presupuesto final.pdf");
    expect(safeFilename("../../etc/passwd")).toBe("passwd");
    expect(safeFilename("a\u0000b.txt")).toBe("ab.txt");
  });

  it("nunca queda vacío", () => {
    expect(safeFilename("")).toBe("archivo");
    expect(safeFilename("..")).toBe("archivo");
  });

  it("acorta conservando la extensión", () => {
    const largo = `${"x".repeat(300)}.xlsx`;
    const r = safeFilename(largo);
    expect(r.length).toBe(150);
    expect(r.endsWith(".xlsx")).toBe(true);
  });
});

describe("tipos de archivo", () => {
  it("acepta un MIME bien formado", () => {
    expect(safeContentType("application/pdf")).toBe("application/pdf");
    expect(safeContentType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  });

  it("cualquier otra cosa pasa a genérico", () => {
    expect(safeContentType("")).toBe("application/octet-stream");
    expect(safeContentType("text/html; charset=utf-8")).toBe("application/octet-stream");
    expect(safeContentType("pdf")).toBe("application/octet-stream");
  });
});
