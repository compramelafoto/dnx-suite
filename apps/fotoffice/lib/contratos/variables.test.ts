import { describe, expect, it } from "vitest";
import { aBloques, MARCA } from "./formato";
import {
  clavesContrato, completarContrato, contextoContrato, revisarPlantillaContrato, VARIABLES_CONTRATO,
  type ContextoContratoEntrada,
} from "./variables";

const ENTRADA: ContextoContratoEntrada = {
  pedido: { numero: "P-0007", totalArs: 150000 },
  items: [
    { nombre: "Cobertura de boda", cantidad: 1, precioUnitario: 120000, total: 120000 },
    { nombre: "Álbum 30x30", cantidad: 2, precioUnitario: 15000, total: 30000 },
    { nombre: "Drone (opcional)", cantidad: 1, precioUnitario: 50000, total: 50000, opcional: true },
  ],
  cuotas: [
    { position: 2, dueDate: "2026-12-10", amountArs: 75000 },
    { position: 1, dueDate: "2026-11-10", amountArs: 75000 },
  ],
  contratantes: [
    { nombre: "Ana Pérez", docType: "DNI", docNumber: "30.111.222", address: "Mitre 100", city: "Rosario", email: "ana@x.com", phone: "341 555" },
    { nombre: "Luis Gómez", docType: null, docNumber: null, address: null, city: null, email: null, phone: null },
  ],
  empresa: { nombre: "Estudio Luz", cuit: "20-1-3", domicilio: null },
  evento: { nombre: "Casamiento", fecha: "2026-12-12" },
  numero: "C-0001",
  // 02:00 UTC del 11/10 es el 10/10 a las 23 en Buenos Aires
  hoy: new Date("2026-10-11T02:00:00.000Z"),
};

describe("catálogo", () => {
  it("tiene las variables del spec, con descripción en español y sin repetidos", () => {
    const claves = VARIABLES_CONTRATO.map((v) => v.clave);
    expect(new Set(claves).size).toBe(claves.length);
    for (const n of [1, 2]) for (const s of ["nombre", "documento", "domicilio", "correo", "telefono"]) expect(claves).toContain(`contratante${n}_${s}`);
    for (const c of ["pedido_numero", "pedido_total", "pedido_items", "pedido_cuotas", "evento", "evento_fecha", "empresa_nombre", "empresa_cuit", "empresa_domicilio", "fecha_hoy", "contrato_numero", "salto_de_pagina"]) {
      expect(claves).toContain(c);
    }
    expect(claves).toHaveLength(22);
    for (const v of VARIABLES_CONTRATO) expect(v.descripcion.length).toBeGreaterThan(10);
    expect(clavesContrato().has("firma")).toBe(false);
  });
});

describe("contextoContrato", () => {
  const v = contextoContrato(ENTRADA);
  it("datos de las personas, empresa y fechas (hora de Buenos Aires)", () => {
    expect(v("contratante1_nombre")).toBe("Ana Pérez");
    expect(v("contratante1_documento")).toBe("DNI 30.111.222");
    expect(v("contratante1_domicilio")).toBe("Mitre 100, Rosario");
    expect(v("contratante2_nombre")).toBe("Luis Gómez");
    expect(v("contratante2_documento")).toBeNull();
    expect(v("empresa_domicilio")).toBeNull();
    expect(v("fecha_hoy")).toBe("10/10/2026");
    expect(v("evento_fecha")).toBe("12/12/2026");
    expect(v("contrato_numero")).toBe("C-0001");
    expect(v("desconocida")).toBeNull();
  });
  it("sin contratante 2 sus variables quedan vacías", () => {
    const solo = contextoContrato({ ...ENTRADA, contratantes: [ENTRADA.contratantes[0]!] });
    expect(solo("contratante2_nombre")).toBeNull();
  });
  it("el total va en pesos", () => {
    expect(v("pedido_total")).toMatch(/150\.000/);
  });
  it("la tabla de ítems deja afuera los opcionales; la de cuotas va ordenada y numerada", () => {
    const items = aBloques(v("pedido_items")!)[0];
    expect(items).toMatchObject({ tipo: "tabla" });
    if (items?.tipo !== "tabla") throw new Error();
    expect(items.filas).toHaveLength(3);
    expect(items.filas[0]).toEqual(["Descripción", "Cantidad", "Precio unitario", "Importe"]);
    expect(items.filas.flat().join(" ")).not.toContain("Drone");
    const cuotas = aBloques(v("pedido_cuotas")!)[0];
    if (cuotas?.tipo !== "tabla") throw new Error();
    expect(cuotas.filas.map((f) => f.slice(0, 2))).toEqual([["Cuota", "Vencimiento"], ["1", "10/11/2026"], ["2", "10/12/2026"]]);
  });
  it("sin cuotas o sin ítems, la variable queda vacía", () => {
    const vacio = contextoContrato({ ...ENTRADA, cuotas: [], items: [] });
    expect(vacio("pedido_cuotas")).toBeNull();
    expect(vacio("pedido_items")).toBeNull();
  });
  it("lo que escriben las personas no puede fabricar tablas ni saltos", () => {
    const malo = contextoContrato({
      ...ENTRADA,
      contratantes: [{ ...ENTRADA.contratantes[0]!, nombre: `Ana${MARCA}salto${MARCA}` }],
    });
    expect(malo("contratante1_nombre")).toBe("Anasalto");
    expect(malo("contratante1_nombre")).not.toContain(MARCA);
  });
});

describe("completarContrato y revisarPlantillaContrato", () => {
  const v = contextoContrato(ENTRADA);
  it("completa variables y bloques [si:…]", () => {
    const r = completarContrato(
      "# Contrato [contrato_numero]\n\nEntre [empresa_nombre] y [contratante1_nombre][si:contratante2_nombre] y [contratante2_nombre][/si].[si:empresa_domicilio] Domicilio: [empresa_domicilio][/si]",
      v,
    );
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) return;
    expect(r.texto).toBe("# Contrato C-0001\n\nEntre Estudio Luz y Ana Pérez y Luis Gómez.");
    expect(r.vacias).toEqual([]); // el bloque [si:…] vacío desaparece sin contar como variable vacía
    expect(completarContrato("Hola [contratante2_documento].", v)).toMatchObject({ ok: true, vacias: ["contratante2_documento"] });
  });
  it("[salto_de_pagina] y [pedido_items] se convierten en bloques", () => {
    const r = completarContrato("Detalle:\n\n[pedido_items]\n\n[salto_de_pagina]\n\nFin", v);
    if (!r.ok) throw new Error("no ok");
    expect(aBloques(r.texto).map((b) => b.tipo)).toEqual(["parrafo", "tabla", "salto", "parrafo"]);
  });
  it("informa las variables desconocidas, sin completar", () => {
    const r = completarContrato("Hola [nombre_inventado] y [firma] y [contratante1_nombre]", v);
    expect(r).toMatchObject({ ok: false, desconocidas: ["nombre_inventado", "firma"] });
    expect(revisarPlantillaContrato("[otra]")).toMatchObject({ ok: false, desconocidas: ["otra"] });
    expect(revisarPlantillaContrato("[contratante1_nombre]")).toEqual({ ok: true });
  });
  it("una marca escrita en la plantilla se descarta", () => {
    const r = completarContrato(`Hola ${MARCA}salto${MARCA} chau`, v);
    if (!r.ok) throw new Error("no ok");
    expect(r.texto).toBe("Hola salto chau");
  });
});
