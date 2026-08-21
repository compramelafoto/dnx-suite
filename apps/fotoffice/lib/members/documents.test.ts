import { describe, expect, it } from "vitest";
import {
  documentChanged,
  documentDedupKey,
  documentDigits,
  formatDocumentForDisplay,
  normalizeDocument,
} from "./documents";

describe("DNI", () => {
  it("los tres formatos del enunciado producen el mismo resultado", () => {
    const a = normalizeDocument("DNI", "12.345.678");
    const b = normalizeDocument("DNI", "12345678");
    const c = normalizeDocument("DNI", "12 345 678");
    expect(a.normalizedNumber).toBe("12345678");
    expect(b.normalizedNumber).toBe("12345678");
    expect(c.normalizedNumber).toBe("12345678");
    expect([a, b, c].every((r) => r.validationStatus === "VALID")).toBe(true);
  });

  it("7 dígitos es válido", () => {
    expect(normalizeDocument("DNI", "1234567").validationStatus).toBe("VALID");
  });

  it("8 dígitos es válido", () => {
    expect(normalizeDocument("DNI", "12345678").validationStatus).toBe("VALID");
  });

  it("6 dígitos es inválido, con mensaje explicativo", () => {
    const r = normalizeDocument("DNI", "123456");
    expect(r.validationStatus).toBe("INVALID");
    expect(r.message).toContain("7");
    expect(r.message).toContain("6");
  });

  it("9 dígitos es inválido", () => {
    expect(normalizeDocument("DNI", "123456789").validationStatus).toBe("INVALID");
  });

  it("el tipo se canoniza sin importar mayúsculas ni espacios", () => {
    expect(normalizeDocument(" dni ", "12345678").canonicalType).toBe("DNI");
    expect(normalizeDocument("Dni", "12345678").canonicalType).toBe("DNI");
  });

  it("se guarda sin puntos, aunque se haya escrito con puntos", () => {
    expect(normalizeDocument("DNI", "12.345.678").normalizedNumber).toBe("12345678");
  });
});

describe("CUIT/CUIL", () => {
  it("los tres formatos del enunciado producen el mismo resultado", () => {
    const a = normalizeDocument("CUIT", "20-12345678-3");
    const b = normalizeDocument("CUIT", "20123456783");
    const c = normalizeDocument("CUIT", "20 12345678 3");
    expect(a.normalizedNumber).toBe("20123456783");
    expect(b.normalizedNumber).toBe("20123456783");
    expect(c.normalizedNumber).toBe("20123456783");
    expect([a, b, c].every((r) => r.validationStatus === "VALID")).toBe(true);
  });

  it("10 y 11 dígitos son válidos", () => {
    expect(normalizeDocument("CUIT", "2012345678").validationStatus).toBe("VALID");
    expect(normalizeDocument("CUIL", "20123456783").validationStatus).toBe("VALID");
  });

  it("CUIL canoniza al mismo tipo que CUIT", () => {
    expect(normalizeDocument("CUIL", "20123456783").canonicalType).toBe("CUIT");
    expect(normalizeDocument("CUIT/CUIL", "20123456783").canonicalType).toBe("CUIT");
  });

  it("9 dígitos es inválido", () => {
    expect(normalizeDocument("CUIT", "201234567").validationStatus).toBe("INVALID");
  });
});

describe("OTR histórico", () => {
  it("OTR con 11 dígitos se normaliza como CUIT/CUIL", () => {
    const r = normalizeDocument("OTR", "20-12345678-3");
    expect(r.canonicalType).toBe("CUIT");
    expect(r.normalizedNumber).toBe("20123456783");
    expect(r.validationStatus).toBe("VALID");
  });

  it("OTR con 10 dígitos también", () => {
    expect(normalizeDocument("OTR", "2012345678").canonicalType).toBe("CUIT");
  });

  it("un OTR con 11 dígitos y un CUIT escrito con guiones comparten clave de duplicado", () => {
    expect(documentDedupKey("OTR", "20123456783")).toBe(documentDedupKey("CUIT", "20-12345678-3"));
  });

  it("OTR que NO es un CUIT no se fuerza a numérico: se conserva", () => {
    const r = normalizeDocument("OTR", "AB-123");
    expect(r.canonicalType).toBe("OTR");
    expect(r.validationStatus).toBe("VALID");
  });
});

describe("documentos alfanuméricos (pasaporte)", () => {
  it("un pasaporte alfanumérico NO se rompe ni se marca inválido", () => {
    const r = normalizeDocument("Pasaporte", "AB123456");
    expect(r.validationStatus).toBe("VALID");
    expect(r.canonicalType).toBe("PASAPORTE");
    expect(r.normalizedNumber).toBe("AB123456");
  });

  it("no se le aplican las reglas numéricas de DNI: 5 caracteres sigue siendo válido", () => {
    expect(normalizeDocument("Pasaporte", "AB123").validationStatus).toBe("VALID");
  });

  it("espacios y minúsculas se unifican para no duplicar la misma persona", () => {
    expect(documentDedupKey("pasaporte", "ab 123 456")).toBe(documentDedupKey("PASAPORTE", "AB123456"));
  });
});

describe("ausencia de documento", () => {
  it("sin número devuelve ABSENT y ambos campos en null", () => {
    const r = normalizeDocument("DNI", "");
    expect(r.validationStatus).toBe("ABSENT");
    expect(r.canonicalType).toBeNull();
    expect(r.normalizedNumber).toBeNull();
  });

  it("null, undefined y espacios son todos ausencia de documento", () => {
    expect(normalizeDocument("DNI", null).validationStatus).toBe("ABSENT");
    expect(normalizeDocument("DNI", undefined).validationStatus).toBe("ABSENT");
    expect(normalizeDocument("DNI", "   ").validationStatus).toBe("ABSENT");
  });

  it("la ausencia NUNCA genera clave de duplicado: dos socios sin documento no chocan", () => {
    expect(documentDedupKey("DNI", "")).toBeNull();
    expect(documentDedupKey(null, null)).toBeNull();
    expect(documentDedupKey("", "  ")).toBeNull();
  });
});

describe("clave de deduplicación", () => {
  it("mismo documento escrito distinto comparte clave", () => {
    expect(documentDedupKey("DNI", "12.345.678")).toBe(documentDedupKey("DNI", "12345678"));
    expect(documentDedupKey("DNI", "12 345 678")).toBe(documentDedupKey("dni", "12345678"));
  });

  it("distinto número NO comparte clave", () => {
    expect(documentDedupKey("DNI", "12345678")).not.toBe(documentDedupKey("DNI", "87654321"));
  });

  it("mismo número bajo tipos distintos NO comparte clave (un DNI y un CUIT pueden coincidir)", () => {
    expect(documentDedupKey("DNI", "12345678")).not.toBe(documentDedupKey("CUIT", "12345678"));
  });
});

describe("validación NO retroactiva", () => {
  it("un documento sin cambios no se considera modificado, aunque sea inválido", () => {
    // El caso real del padrón: un DNI de 5 dígitos cargado hace años.
    expect(documentChanged("DNI", "36879", "DNI", "36879")).toBe(false);
  });

  it("reformatear el MISMO documento no cuenta como cambio", () => {
    expect(documentChanged("DNI", "12345678", "DNI", "12.345.678")).toBe(false);
  });

  it("cambiar el número sí cuenta como cambio", () => {
    expect(documentChanged("DNI", "12345678", "DNI", "87654321")).toBe(true);
  });

  it("cambiar el tipo sí cuenta como cambio", () => {
    expect(documentChanged("DNI", "20123456783", "CUIT", "20123456783")).toBe(true);
  });

  it("pasar de sin documento a con documento cuenta como cambio", () => {
    expect(documentChanged(null, null, "DNI", "12345678")).toBe(true);
  });

  it("borrar el documento cuenta como cambio", () => {
    expect(documentChanged("DNI", "12345678", null, null)).toBe(true);
  });
});

describe("formato para pantalla (nunca es lo que se guarda)", () => {
  it("el DNI se muestra con puntos", () => {
    expect(formatDocumentForDisplay("DNI", "12345678")).toBe("DNI 12.345.678");
  });

  it("el CUIT se muestra con guiones", () => {
    expect(formatDocumentForDisplay("CUIT", "20123456783")).toBe("CUIT 20-12345678-3");
  });

  it("sin documento muestra un guion", () => {
    expect(formatDocumentForDisplay(null, null)).toBe("—");
  });

  it("un documento inválido heredado se sigue mostrando, no se oculta", () => {
    expect(formatDocumentForDisplay("DNI", "36879")).toContain("36879");
  });
});

describe("documentDigits", () => {
  it("descarta todo lo que no sea dígito", () => {
    expect(documentDigits("20-12.345.678 3")).toBe("20123456783");
    expect(documentDigits("AB123")).toBe("123");
    expect(documentDigits(null)).toBe("");
  });
});
