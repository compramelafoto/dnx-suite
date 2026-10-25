import { describe, expect, it } from "vitest";
import {
  ENCABEZADO_CSV,
  MAX_BYTES_ARCHIVO,
  MAX_CARACTERES_TEXTO,
  MAX_FILAS_CSV,
  MAX_PAGINAS_PDF,
} from "./constantes";

describe("constantes de importación", () => {
  it("topes exactos", () => {
    expect(MAX_FILAS_CSV).toBe(500);
    expect(MAX_BYTES_ARCHIVO).toBe(10 * 1024 * 1024);
    expect(MAX_PAGINAS_PDF).toBe(20);
    expect(MAX_CARACTERES_TEXTO).toBe(20000);
  });
  it("encabezado del CSV exacto", () => {
    expect(ENCABEZADO_CSV).toBe(
      "codigo_barras;codigo_proveedor;descripcion;cantidad;unidad;unidades_por_paquete;costo_unitario;alicuota_iva;tipo",
    );
  });
});
