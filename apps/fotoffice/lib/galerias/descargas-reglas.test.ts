import { describe, expect, it } from "vitest";
import {
  ARCHIVO_MAXIMO_EN_ZIP, MAX_ARCHIVOS_POR_PARTE, PARTE_MAXIMA, SOBRECARGA_POR_ARCHIVO, analizarClaveDeParte, claveDeParte, esClaveDeParte, formatearBytes, planificarPartes,
} from "./descargas-reglas";

const MB = 1024 * 1024;
const GB = 1024 * MB;
const clave = (n: number) => claveDeParte("ws1", "g1", "d1", n);
const f = (id: string, mb: number) => ({ id, fileName: `${id}.jpg`, bytes: mb * MB });

describe("claves de las partes", () => {
  it("tienen la forma galerias/<ws>/<galeria>/descargas/<descarga>/parte-<n>.zip y se analizan de vuelta", () => {
    expect(claveDeParte("ws1", "g1", "d1", 3)).toBe("galerias/ws1/g1/descargas/d1/parte-3.zip");
    expect(analizarClaveDeParte(claveDeParte("ws1", "g1", "d1", 12))).toEqual({ workspaceId: "ws1", galeriaId: "g1", descargaId: "d1", n: 12 });
  });
  it("rechaza ids raros y números inválidos", () => {
    expect(() => claveDeParte("ws/1", "g1", "d1", 1)).toThrow();
    expect(() => claveDeParte("ws1", "..", "d1", 1)).toThrow();
    expect(() => claveDeParte("ws1", "g1", "d1", 0)).toThrow();
    expect(() => claveDeParte("ws1", "g1", "d1", 1.5)).toThrow();
  });
  it("sólo reconoce claves de partes: no las de originales ni intentos de salirse", () => {
    expect(esClaveDeParte("galerias/ws1/g1/f1/original")).toBe(false);
    expect(esClaveDeParte("galerias/ws1/g1/descargas/d1/parte-0.zip")).toBe(false);
    expect(esClaveDeParte("galerias/ws1/g1/descargas/../d1/parte-1.zip")).toBe(false);
    expect(esClaveDeParte("galerias/ws1/g1/descargas/d1/parte-1.zip/")).toBe(false);
    expect(esClaveDeParte(null)).toBe(false);
  });
});

describe("planificarPartes", () => {
  it("fotos chicas: una sola parte, en el mismo orden", () => {
    const p = planificarPartes([f("a", 10), f("b", 20), f("c", 5)], clave);
    expect(p.partes).toHaveLength(1);
    expect(p.partes[0]).toMatchObject({ tipo: "ZIP", n: 1, key: clave(1), files: 3, estado: "PENDIENTE", fileIds: ["a", "b", "c"] });
    expect(p.totalFiles).toBe(3);
    expect(p.totalBytes).toBe(35 * MB);
  });

  it("parte nueva cuando el siguiente archivo haría pasar el GB; ninguna parte supera 1 GB", () => {
    const archivos = Array.from({ length: 30 }, (_, i) => f(`f${i}`, 100)); // 3 GB en total
    const p = planificarPartes(archivos, clave);
    expect(p.partes.length).toBeGreaterThanOrEqual(3);
    let vistos: string[] = [];
    for (const parte of p.partes) {
      if (parte.tipo !== "ZIP") throw new Error("todas son ZIP");
      const suma = parte.fileIds.reduce((s, id) => s + archivos.find((a) => a.id === id)!.bytes + SOBRECARGA_POR_ARCHIVO, 0);
      expect(suma).toBeLessThanOrEqual(PARTE_MAXIMA);
      expect(parte.bytes).toBeLessThanOrEqual(PARTE_MAXIMA);
      vistos = vistos.concat(parte.fileIds);
    }
    // Todo está, en el mismo orden y sin repetirse.
    expect(vistos).toEqual(archivos.map((a) => a.id));
    expect(p.partes.map((x) => x.n)).toEqual(p.partes.map((_, i) => i + 1));
  });

  it("un video de más de 1 GB va solo, en su propia parte, entre las fotos", () => {
    const p = planificarPartes([f("a", 10), { id: "v", fileName: "v.mp4", bytes: 2 * GB }, f("b", 10)], clave);
    expect(p.partes.map((x) => (x.tipo === "ZIP" ? x.fileIds : x.tipo))).toEqual([["a"], ["v"], ["b"]]);
    expect(p.partes.every((x) => x.tipo === "ZIP" && x.estado === "PENDIENTE")).toBe(true);
  });

  it("un archivo justo de 1 GB (con sus encabezados ya se pasa) también va solo", () => {
    const p = planificarPartes([f("a", 1), { id: "v", fileName: "v.mp4", bytes: PARTE_MAXIMA }, f("b", 1)], clave);
    expect(p.partes.map((x) => (x.tipo === "ZIP" ? x.fileIds : x.tipo))).toEqual([["a"], ["v"], ["b"]]);
  });

  it("un video de más de 4 GB no se mete en un ZIP: queda «suelto» y ya listo", () => {
    const grande = { id: "v5", fileName: "boda.mov", bytes: 5 * GB };
    const p = planificarPartes([f("a", 10), grande, f("b", 10)], clave);
    expect(p.partes).toHaveLength(3);
    expect(p.partes[0]).toMatchObject({ tipo: "ZIP", n: 1, fileIds: ["a"] });
    expect(p.partes[1]).toEqual({ tipo: "SUELTO", n: 1, fotoId: "v5", nombre: "boda.mov", bytes: 5 * GB, files: 1, estado: "LISTA" });
    expect(p.partes[2]).toMatchObject({ tipo: "ZIP", n: 2, fileIds: ["b"] });
    expect(p.totalBytes).toBe(20 * MB + 5 * GB);
  });

  it("el borde de 4 GB: apenas por debajo del máximo entra en un ZIP solo; apenas por encima va suelto", () => {
    expect(planificarPartes([{ id: "x", fileName: "x.mp4", bytes: ARCHIVO_MAXIMO_EN_ZIP }], clave).partes[0]).toMatchObject({ tipo: "ZIP", fileIds: ["x"] });
    expect(planificarPartes([{ id: "x", fileName: "x.mp4", bytes: ARCHIVO_MAXIMO_EN_ZIP + 1 }], clave).partes[0]).toMatchObject({ tipo: "SUELTO" });
  });

  it("nunca más de 65.535 archivos por parte", () => {
    const muchos = Array.from({ length: MAX_ARCHIVOS_POR_PARTE + 5 }, (_, i) => ({ id: `f${i}`, fileName: "a", bytes: 1 }));
    const p = planificarPartes(muchos, clave);
    expect(p.partes).toHaveLength(2);
    expect(p.partes[0]).toMatchObject({ files: MAX_ARCHIVOS_POR_PARTE });
    expect(p.partes[1]).toMatchObject({ files: 5 });
  });

  it("sin archivos no hay partes", () => {
    expect(planificarPartes([], clave)).toEqual({ partes: [], totalFiles: 0, totalBytes: 0 });
  });
});

describe("formatearBytes", () => {
  it("usa KB, MB y GB con coma decimal", () => {
    expect(formatearBytes(512 * 1024)).toBe("512 KB");
    expect(formatearBytes(84.3 * MB)).toBe("84,3 MB");
    expect(formatearBytes(1.02 * GB)).toBe("1,02 GB");
    expect(formatearBytes(0)).toBe("1 KB");
  });
});
