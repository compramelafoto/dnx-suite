import { describe, expect, it, vi } from "vitest";
import { validateFile } from "./archivos";
import { EquipoError, MENSAJE_IDENTIDAD_CON_PUBLICACION } from "./inventario/equipos";
import { listingBlocker, validateListingInput } from "./publicaciones/reglas";
import {
  AVISOS_ERROR,
  AVISOS_OK,
  avisoDeCodigo,
  codigoDeError,
  codigoDeMensaje,
  TEXTO_EN_REVISION,
} from "./avisos";

describe("avisoDeCodigo", () => {
  const mapa = { LISTO: "Listo." } as const;

  it("un código del mapa devuelve su texto fijo", () => {
    expect(avisoDeCodigo(mapa, "LISTO")).toBe("Listo.");
    expect(avisoDeCodigo(mapa, ["LISTO", "OTRO"])).toBe("Listo.");
  });

  it("texto libre, propiedades heredadas, vacío o nada: sin aviso", () => {
    expect(avisoDeCodigo(mapa, "texto falso")).toBeNull();
    expect(avisoDeCodigo(mapa, "Pagá la seña al CBU 000")).toBeNull();
    expect(avisoDeCodigo(mapa, "toString")).toBeNull();
    expect(avisoDeCodigo(mapa, "__proto__")).toBeNull();
    expect(avisoDeCodigo(mapa, "")).toBeNull();
    expect(avisoDeCodigo(mapa, undefined)).toBeNull();
    expect(avisoDeCodigo(mapa, null)).toBeNull();
  });

  it("los mapas de la app traducen sus códigos", () => {
    expect(avisoDeCodigo(AVISOS_OK, "EN_REVISION")).toBe(TEXTO_EN_REVISION);
    expect(avisoDeCodigo(AVISOS_ERROR, "ERROR")).toBe("No pudimos completar la operación. Probá de nuevo.");
    expect(avisoDeCodigo(AVISOS_OK, "Cambios guardados.")).toBeNull();
  });
});

describe("codigoDeError", () => {
  it("un mensaje fijo de la librería viaja como su código", () => {
    expect(codigoDeError(new EquipoError("CON_PUBLICACION", MENSAJE_IDENTIDAD_CON_PUBLICACION))).toBe(
      "CON_PUBLICACION_IDENTIDAD",
    );
    const blocker = listingBlocker(
      { status: "IN_USE", kind: "BODY", serialNormalized: null, photoKeys: ["a"] },
      { ownReportOpen: false, activeListing: false, serialPhotoKey: null },
    );
    expect(codigoDeError(new EquipoError("DATO_INVALIDO", blocker!))).toBe("FALTA_SERIE");
    let err: unknown;
    try {
      validateListingInput(
        { priceArs: 0, condition: "GOOD", province: "Santa Fe", city: "x", socialConsent: true },
        "BODY",
      );
    } catch (e) {
      err = e;
    }
    expect(codigoDeError(err)).toBe("PRECIO");
    expect(codigoDeMensaje(validateFile({ type: "application/pdf", size: 10 }, "photo")!)).toBe(
      "FORMATO_FOTO",
    );
  });

  it("un mensaje con datos cae en el texto general de su code", () => {
    expect(codigoDeError(new EquipoError("FALTA_VALOR", "Canon R5: cargá el valor…"))).toBe("FALTA_VALOR");
    expect(codigoDeError(new EquipoError("DATO_INVALIDO", "algo nuevo"))).toBe("DATO_INVALIDO");
    expect(codigoDeError(new EquipoError("CON_DENUNCIA", "x"))).toBe("DATO_INVALIDO");
  });

  it("NO_ENCONTRADO usa el código de la pantalla", () => {
    expect(codigoDeError(new EquipoError("NO_ENCONTRADO"))).toBe("NO_ENCONTRADO");
    expect(
      codigoDeError(new EquipoError("NO_ENCONTRADO"), { noEncontrado: "NO_ENCONTRADA_PUBLICACION" }),
    ).toBe("NO_ENCONTRADA_PUBLICACION");
  });

  it("un error inesperado se registra y queda como ERROR", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(codigoDeError(new Error("db caída"), { origen: "prueba" })).toBe("ERROR");
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("ningún código es texto libre: todos son identificadores cortos", () => {
    for (const k of [...Object.keys(AVISOS_OK), ...Object.keys(AVISOS_ERROR)]) {
      expect(k).toMatch(/^[A-Z_]+$/);
    }
  });
});
