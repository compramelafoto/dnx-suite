import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ESTADOS_PRESUPUESTO, esModoPrecio, validarDescuento, validarItem, validarItems } from "./constantes";

const base = { id: "a", nombre: "Cobertura", cantidad: 1, precioUnitario: 1000, modoPrecio: "LISTA" };

describe("validarItem", () => {
  it("acepta un ítem de lista y normaliza textos vacíos a null", () => {
    const v = validarItem({ ...base, descripcion: "  ", seccion: "", productId: "" });
    expect(v).toEqual({
      ok: true,
      valor: {
        id: "a", productId: null, nombre: "Cobertura", descripcion: null, cantidad: 1, precioUnitario: 1000,
        descuento: null, modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false,
      },
    });
  });

  it("rechaza un modo de precio que no existe (el SQL no lo puede chequear dentro del JSON)", () => {
    expect(validarItem({ ...base, modoPrecio: "GRATIS" }).ok).toBe(false);
    expect(esModoPrecio("CALCULO")).toBe(true);
    expect(esModoPrecio("lista")).toBe(false);
  });

  it("rechaza cantidad, precio o nombre imposibles", () => {
    expect(validarItem({ ...base, cantidad: 0 }).ok).toBe(false);
    expect(validarItem({ ...base, cantidad: "2" }).ok).toBe(false);
    expect(validarItem({ ...base, precioUnitario: -1 }).ok).toBe(false);
    expect(validarItem({ ...base, precioUnitario: Number.POSITIVE_INFINITY }).ok).toBe(false);
    expect(validarItem({ ...base, nombre: "  " }).ok).toBe(false);
    expect(validarItem(null).ok).toBe(false);
  });

  it("descarta la instantánea de cálculo en un ítem de lista", () => {
    const v = validarItem({ ...base, calculo: { costoHumano: 1 } });
    expect(v.ok && v.valor.calculo).toBeNull();
  });

  it("redondea el precio a dos decimales", () => {
    const v = validarItem({ ...base, precioUnitario: 10.005 });
    expect(v.ok && v.valor.precioUnitario).toBe(10.01);
  });
});

describe("validarDescuento", () => {
  it("% entre 0 y 100, $ positivo; cero es sin descuento", () => {
    expect(validarDescuento({ tipo: "PORCENTAJE", valor: 101 }).ok).toBe(false);
    expect(validarDescuento({ tipo: "MONTO", valor: -1 }).ok).toBe(false);
    expect(validarDescuento({ tipo: "OTRO", valor: 1 }).ok).toBe(false);
    expect(validarDescuento({ tipo: "MONTO", valor: 0 })).toEqual({ ok: true, valor: null });
    expect(validarDescuento(undefined)).toEqual({ ok: true, valor: null });
  });
});

describe("validarItems", () => {
  it("frena claves repetidas", () => {
    expect(validarItems([base, base]).ok).toBe(false);
    expect(validarItems([base, { ...base, id: "b" }]).ok).toBe(true);
    expect(validarItems("x").ok).toBe(false);
  });
});

describe("estados", () => {
  it("coinciden con el CHECK de la migración", () => {
    const sql = readFileSync(
      join(__dirname, "..", "..", "..", "..", "packages/db/prisma/migrations/20261020120000_fotoffice_etapa_2_presupuestos/migration.sql"),
      "utf8",
    );
    const lista = ESTADOS_PRESUPUESTO.map((e) => `'${e}'`).join(", ");
    expect(sql).toContain(`CHECK ("status" IN (${lista}))`);
  });
});
