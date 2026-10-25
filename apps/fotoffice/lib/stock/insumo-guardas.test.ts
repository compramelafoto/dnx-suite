import { describe, expect, it, vi } from "vitest";
import { guardarInsumo, validarCambioDeTipo } from "./insumo-guardas";

function fakeTx(over: { enRecetas?: number; enConsumos?: number; recetaPropia?: number } = {}) {
  return {
    fotofficeRecetaInsumo: {
      count: vi.fn(async ({ where }: { where: { insumoId?: string; productId?: string } }) =>
        where.insumoId !== undefined ? (over.enRecetas ?? 0) : (over.recetaPropia ?? 0),
      ),
    },
    fotofficeConsumoTamano: { count: vi.fn(async () => over.enConsumos ?? 0) },
    fotofficeInsumo: { upsert: vi.fn(async () => ({})) },
  };
}

const base = { workspaceId: "w1", productId: "p1" };

describe("validarCambioDeTipo", () => {
  it("un producto nuevo o que no cambia de tipo no se toca", async () => {
    const tx = fakeTx({ enRecetas: 3 });
    expect(await validarCambioDeTipo(tx, { ...base, kindAnterior: null, kindNuevo: "INSUMO" })).toBeNull();
    expect(await validarCambioDeTipo(tx, { ...base, kindAnterior: "INSUMO", kindNuevo: "INSUMO" })).toBeNull();
    expect(await validarCambioDeTipo(tx, { ...base, kindAnterior: "PRODUCTO", kindNuevo: "SERVICIO" })).toBeNull();
  });

  it("un insumo que está en recetas no puede cambiar de tipo", async () => {
    const tx = fakeTx({ enRecetas: 1 });
    expect(await validarCambioDeTipo(tx, { ...base, kindAnterior: "INSUMO", kindNuevo: "PRODUCTO" })).toBe(
      "Ese insumo está en recetas: sacalo de ellas antes de cambiarle el tipo.",
    );
  });

  it("tampoco si está en los consumos por tamaño", async () => {
    const tx = fakeTx({ enConsumos: 2 });
    expect(await validarCambioDeTipo(tx, { ...base, kindAnterior: "INSUMO", kindNuevo: "SERVICIO" })).toBe(
      "Ese insumo está en recetas: sacalo de ellas antes de cambiarle el tipo.",
    );
  });

  it("un insumo sin usos sí puede cambiar de tipo", async () => {
    const tx = fakeTx();
    expect(await validarCambioDeTipo(tx, { ...base, kindAnterior: "INSUMO", kindNuevo: "PRODUCTO" })).toBeNull();
  });

  it("un producto con receta propia no puede convertirse en insumo", async () => {
    const tx = fakeTx({ recetaPropia: 2 });
    expect(await validarCambioDeTipo(tx, { ...base, kindAnterior: "PRODUCTO", kindNuevo: "INSUMO" })).toBe(
      "Ese producto tiene receta de consumo: sacala antes de convertirlo en insumo.",
    );
  });

  it("un producto sin receta propia sí puede convertirse en insumo", async () => {
    const tx = fakeTx();
    expect(await validarCambioDeTipo(tx, { ...base, kindAnterior: "PRODUCTO", kindNuevo: "INSUMO" })).toBeNull();
  });
});

describe("guardarInsumo", () => {
  it("crea o actualiza la ficha por productId", async () => {
    const tx = fakeTx();
    const values = { unidad: "copias 10x15", unidadCompra: "Kit 305 6R", unidadesPorCompra: 640 };
    await guardarInsumo(tx, { workspaceId: "w1", productId: "p1", values });
    expect(tx.fotofficeInsumo.upsert).toHaveBeenCalledWith({
      where: { productId: "p1" },
      create: { workspaceId: "w1", productId: "p1", ...values },
      update: values,
    });
  });
});
