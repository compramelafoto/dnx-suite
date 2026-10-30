import { describe, expect, it } from "vitest";
import {
  codigoDesdeBytes,
  codigoLegible,
  comandoMac,
  diaDeToma,
  fechaTomaLegible,
  normalizarCodigo,
  validarArchivoEntrante,
} from "./constantes";

describe("código del caso", () => {
  it("se arma sin letras que se confunden al dictarlo", () => {
    const c = codigoDesdeBytes(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 255, 254]));
    expect(c).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$/);
  });

  it("acepta minúsculas, espacios y guion", () => {
    expect(normalizarCodigo("k7qm-2xpa")).toBe("K7QM2XPA");
    expect(normalizarCodigo(" K7QM 2XPA ")).toBe("K7QM2XPA");
    expect(normalizarCodigo("K7QM2XP")).toBeNull();
    expect(normalizarCodigo(12345678)).toBeNull();
  });

  it("el comando para Mac lleva el código legible", () => {
    expect(codigoLegible("K7QM2XPA")).toBe("K7QM-2XPA");
    expect(comandoMac("https://fotoffice.com", "K7QM2XPA")).toBe(
      "curl -fsSL https://fotoffice.com/api/recuperacion/instalar | sh -s K7QM-2XPA",
    );
  });
});

describe("fecha de toma", () => {
  it("se muestra como día/mes/año", () => {
    expect(fechaTomaLegible("2026:10:12 15:30:22")).toBe("12/10/2026 15:30");
    expect(diaDeToma("2026:10:12 15:30:22")).toBe("2026-10-12");
  });

  it("las cámaras sin hora configurada no muestran fecha", () => {
    expect(fechaTomaLegible("0000:00:00 00:00:00")).toBeNull();
    expect(fechaTomaLegible(null)).toBeNull();
  });
});

describe("archivo que informa el programa", () => {
  const base = { indice: 3, tipo: "RAW", extension: "arw", tamanio: 24_000_000, offset: 1_048_576, nombreLocal: "00003.arw" };

  it("acepta un archivo bien formado y limpia los textos de la cámara", () => {
    const a = validarArchivoEntrante({ ...base, camara: "ILCE-7M4\u0000\u0007", fechaToma: "2026:10:26 11:35:07", bytesMiniatura: 40_000, ancho: 7008, alto: 4672 });
    expect(a).toMatchObject({ indice: 3, tipo: "RAW", camara: "ILCE-7M4", fechaToma: "2026:10:26 11:35:07", bytesMiniatura: 40_000 });
  });

  it("descarta lo que no cierra", () => {
    expect(validarArchivoEntrante({ ...base, tipo: "EXE" })).toBeNull();
    expect(validarArchivoEntrante({ ...base, extension: "../x" })).toBeNull();
    expect(validarArchivoEntrante({ ...base, indice: 0 })).toBeNull();
    expect(validarArchivoEntrante({ ...base, tamanio: -1 })).toBeNull();
  });

  it("ignora una fecha mal formada o una miniatura enorme sin descartar el archivo", () => {
    const a = validarArchivoEntrante({ ...base, fechaToma: "ayer", bytesMiniatura: 50_000_000 });
    expect(a?.fechaToma).toBeNull();
    expect(a?.bytesMiniatura).toBeNull();
  });
});
