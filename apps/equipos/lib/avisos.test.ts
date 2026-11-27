import { describe, expect, it, vi } from "vitest";
import { validateFile } from "./archivos";
import { EquipoError, MENSAJE_IDENTIDAD_CON_PUBLICACION } from "./inventario/equipos";
import { VentaError } from "./ventas/ventas";
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

  it("los errores de ventas viajan como su código; «no encontrada» respeta la pantalla", () => {
    expect(codigoDeError(new VentaError("NO_CONSULTO"))).toBe("NO_CONSULTO");
    expect(codigoDeError(new VentaError("VENCIDA"))).toBe("VENCIDA");
    expect(codigoDeError(new VentaError("NO_ENCONTRADA"))).toBe("NO_ENCONTRADA_VENTA");
    expect(
      codigoDeError(new VentaError("NO_ENCONTRADA"), { noEncontrado: "NO_ENCONTRADA_PUBLICACION" }),
    ).toBe("NO_ENCONTRADA_PUBLICACION");
    for (const code of ["NO_CONSULTO", "YA_VENDIDA", "NO_PENDIENTE", "VENCIDA"] as const) {
      expect(AVISOS_ERROR[code]).toBe(new VentaError(code).message);
    }
    expect(codigoDeError(new EquipoError("DATO_INVALIDO", "Ya calificaste esta operación."))).toBe(
      "YA_CALIFICASTE",
    );
    expect(codigoDeError(new EquipoError("DATO_INVALIDO", "La calificación va de 1 a 5 estrellas."))).toBe(
      "ELEGI_ESTRELLAS",
    );
  });

  it("cuenta suspendida y reportes de usuario viajan como su código", () => {
    const sus = "Tu cuenta está suspendida.";
    expect(codigoDeError(new VentaError("CUENTA_SUSPENDIDA"))).toBe("CUENTA_SUSPENDIDA");
    expect(codigoDeError(new EquipoError("DATO_INVALIDO", sus))).toBe("CUENTA_SUSPENDIDA");
    expect(AVISOS_ERROR.CUENTA_SUSPENDIDA).toBe(sus);
    expect(
      codigoDeError(new EquipoError("DATO_INVALIDO", "El motivo tiene que tener entre 10 y 500 caracteres.")),
    ).toBe("MOTIVO_REPORTE");
    expect(codigoDeError(new EquipoError("DATO_INVALIDO", "No podés reportarte a vos mismo."))).toBe(
      "REPORTE_PROPIO",
    );
    expect(
      codigoDeError(
        new EquipoError(
          "DATO_INVALIDO",
          "Sólo podés reportar a alguien con quien tuviste una consulta o una venta.",
        ),
      ),
    ).toBe("REPORTE_SIN_RELACION");
    expect(avisoDeCodigo(AVISOS_OK, "REPORTE_USUARIO_ENVIADO")).toMatch(/Recibimos tu reporte/);
  });

  it("comprador bloqueado y equipo fuera del inventario tienen su texto fijo", () => {
    expect(codigoDeError(new VentaError("COMPRADOR_BLOQUEADO"))).toBe("COMPRADOR_BLOQUEADO");
    expect(AVISOS_ERROR.COMPRADOR_BLOQUEADO).toBe("Esta persona no puede comprar en este momento.");
    expect(
      codigoDeError(new EquipoError("DATO_INVALIDO", "Este equipo ya no está en tu inventario.")),
    ).toBe("EQUIPO_FUERA_DE_INVENTARIO");
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
