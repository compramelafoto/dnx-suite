import { describe, expect, it } from "vitest";
import {
  DIAS_PURGA,
  HORAS_PENDIENTE,
  SEGUNDOS_ENLACE,
  TAMANO_MAXIMO,
  TIPOS_PERMITIDOS,
  claveDeAdjunto,
  esClaveDeAdjunto,
  validarArchivo,
} from "./adjuntos-reglas";

const PDF = { nombre: "dni.pdf", tipo: "application/pdf", tamano: 1000 };

describe("constantes", () => {
  it("valores exactos", () => {
    expect(TAMANO_MAXIMO).toBe(10_485_760);
    expect(SEGUNDOS_ENLACE).toBe(300);
    expect(DIAS_PURGA).toBe(30);
    expect(HORAS_PENDIENTE).toBe(24);
    expect(TIPOS_PERMITIDOS).toHaveLength(10);
  });
});

describe("validarArchivo", () => {
  it("acepta todos los tipos permitidos", () => {
    for (const tipo of TIPOS_PERMITIDOS) expect(validarArchivo({ ...PDF, tipo }).ok).toBe(true);
  });
  it.each(["application/x-msdownload", "application/octet-stream", "text/html", "image/svg+xml", "", undefined, 5])(
    "rechaza %s",
    (tipo) => expect(validarArchivo({ ...PDF, tipo })).toEqual({ ok: false, error: "Ese tipo de archivo no se puede adjuntar." }),
  );
  it("un .exe con tipo inventado no pasa", () => {
    expect(validarArchivo({ nombre: "virus.exe", tipo: "application/x-msdownload", tamano: 10 }).ok).toBe(false);
  });
  it("10 MB exactos pasa; un byte más no", () => {
    expect(validarArchivo({ ...PDF, tamano: 10_485_760 }).ok).toBe(true);
    expect(validarArchivo({ ...PDF, tamano: 10_485_761 })).toEqual({ ok: false, error: "El archivo supera los 10 MB." });
  });
  it("tamaño vacío, negativo o no entero no pasa", () => {
    for (const tamano of [0, -1, 1.5, NaN, "10", null]) expect(validarArchivo({ ...PDF, tamano }).ok).toBe(false);
  });
  it("nombre con ../ queda sin barras", () => {
    const r = validarArchivo({ ...PDF, nombre: "../../etc\\passwd.pdf" });
    expect(r.ok && r.nombre).toBe("....etcpasswd.pdf");
    expect(r.ok && /[/\\]/.test(r.nombre)).toBe(false);
  });
  it("saca caracteres de control y corta a 180", () => {
    const r = validarArchivo({ ...PDF, nombre: "a\u0000b\nc\u007f" + "x".repeat(300) });
    expect(r.ok && r.nombre.startsWith("abc")).toBe(true);
    expect(r.ok && r.nombre.length).toBe(180);
  });
  it("sin nombre usable queda 'archivo'", () => {
    const r = validarArchivo({ ...PDF, nombre: "///" });
    expect(r.ok && r.nombre).toBe("archivo");
  });
});

describe("claveDeAdjunto", () => {
  const uuid = "123e4567-e89b-12d3-a456-426614174000";
  it("adjuntos/<workspaceId>/<uuid>, sin el nombre original", () => {
    const k = claveDeAdjunto("ws_1", uuid);
    expect(k).toBe(`adjuntos/ws_1/${uuid}`);
    expect(k).not.toContain("dni");
    expect(esClaveDeAdjunto(k)).toBe(true);
  });
  it("esClaveDeAdjunto rechaza lo que no sea del namespace", () => {
    for (const k of ["fotoffice/x", `adjuntos/../${uuid}`, `adjuntos/ws/${uuid}/x`, "adjuntos/ws/no-uuid", 7]) {
      expect(esClaveDeAdjunto(k)).toBe(false);
    }
  });
});
