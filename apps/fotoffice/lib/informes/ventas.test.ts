import { describe, expect, it } from "vitest";
import { calcularTotales } from "@/lib/presupuestos/totales";
import type { ItemPresupuesto } from "@/lib/presupuestos/constantes";
import { csvDeVentas, csvDeVentasDetalle } from "./csv";
import { aportesDePedido, armarVentas, centavosDeItem, detalleDeVentas, leerFiltroVentas, agrupamientoElegido, type PedidoVenta } from "./ventas";
import { diaEnBuenosAires } from "./fechas";

const item = (id: string, extra: Partial<ItemPresupuesto> = {}): ItemPresupuesto => ({
  id, productId: `prod-${id}`, nombre: `Producto ${id}`, descripcion: null, cantidad: 1, precioUnitario: 100, descuento: null,
  modoPrecio: "LISTA", calculo: null, seccion: null, opcional: false, ...extra,
});

const pedido = (id: string, extra: Partial<PedidoVenta> = {}): PedidoVenta => ({
  id, numero: `P-${id}`, confirmadoEn: new Date("2026-10-05T15:00:00Z"), fechaEvento: "2026-12-12", totalCentavos: 10000,
  items: [item("a")], clienteId: "cl1", cliente: "Ana Gómez", vendedorId: 7, vendedor: "Vera", tieneConsulta: true,
  categoriaId: "cat1", categoria: "Bodas", origenId: "or1", origen: "Instagram", ...extra,
});

const MESES = ["2026-09", "2026-10", "2026-11"];

describe("importe de ítem", () => {
  it("es el neto de totales.ts: cantidad × precio − descuento del ítem", () => {
    const casos: ItemPresupuesto[] = [
      item("1", { cantidad: 3, precioUnitario: 33.33 }),
      item("2", { cantidad: 2, precioUnitario: 1000, descuento: { tipo: "PORCENTAJE", valor: 15 } }),
      item("3", { cantidad: 1, precioUnitario: 500, descuento: { tipo: "MONTO", valor: 9999 } }),
      item("4", { cantidad: 0.1, precioUnitario: 0.3 }),
    ];
    for (const it of casos) {
      expect(centavosDeItem(it)).toBe(Math.round(calcularTotales([it], null).renglones[it.id].neto * 100));
    }
    expect(centavosDeItem(casos[0])).toBe(9999);
    expect(centavosDeItem(casos[1])).toBe(170000);
    expect(centavosDeItem(casos[2])).toBe(0);
  });
});

describe("armarVentas por producto", () => {
  it("una fila por producto, unidades sumadas, ítems opcionales fuera, sin prorratear descuento global", () => {
    const p1 = pedido("1", { items: [item("a", { cantidad: 2, precioUnitario: 100 }), item("b", { opcional: true, precioUnitario: 999 })], totalCentavos: 18000 });
    const p2 = pedido("2", { confirmadoEn: new Date("2026-11-02T15:00:00Z"), items: [item("a", { cantidad: 1, precioUnitario: 100 })] });
    const m = armarVentas({ pedidos: [p1, p2], meses: MESES, agrupar: "producto" });
    expect(m.filas.map((f) => f.etiqueta)).toEqual(["Producto a"]);
    expect(m.filas[0].porMes).toEqual([0, 20000, 10000]);
    expect(m.filas[0].cantidad).toBe(3);
    expect(m.unidad).toBe("Unidades");
    // el descuento global del pedido (totalCentavos 18000 < 20000) no se reparte
    expect(m.total).toBe(30000);
  });

  it("sin productId agrupa por nombre y lo marca; mismo producto dos veces en un pedido cuenta una vez en el detalle", () => {
    const p = pedido("1", { items: [item("x", { productId: null, nombre: " Álbum " }), item("y", { productId: null, nombre: "álbum" }), item("z", { productId: "P9" }), item("w", { productId: "P9" })] });
    const a = aportesDePedido(p, "producto");
    expect(a.map((x) => x.clave).sort()).toEqual(["n:álbum", "p:P9"]);
    expect(a.find((x) => x.clave === "n:álbum")!.etiqueta).toContain("sin producto del catálogo");
    const d = detalleDeVentas([p], { agrupar: "producto", grupo: "p:P9", mes: null }, diaEnBuenosAires);
    expect(d.filas).toHaveLength(1);
    expect(d.filas[0].centavos).toBe(20000);
  });
});

describe("armarVentas por otros criterios", () => {
  it("cliente, vendedor, categoría y origen usan el total del pedido y cuentan pedidos", () => {
    const pedidos = [
      pedido("1"),
      pedido("2", { vendedorId: null, vendedor: "", tieneConsulta: false, categoriaId: null, categoria: null, origenId: null, origen: null, clienteId: "cl2", cliente: "Beto" }),
      pedido("3", { origenId: null, origen: null }),
    ];
    const por = (a: Parameters<typeof armarVentas>[0]["agrupar"]) => armarVentas({ pedidos, meses: MESES, agrupar: a });
    expect(por("cliente").filas.map((f) => [f.etiqueta, f.total, f.cantidad])).toEqual([["Ana Gómez", 20000, 2], ["Beto", 10000, 1]]);
    expect(por("vendedor").filas.map((f) => f.etiqueta).sort()).toEqual(["Sin vendedor", "Vera"]);
    expect(por("categoria").filas.map((f) => f.etiqueta).sort()).toEqual(["Bodas", "Sin consulta"]);
    expect(por("origen").filas.map((f) => f.etiqueta).sort()).toEqual(["Instagram", "Sin consulta", "Sin origen"]);
    expect(por("cliente").unidad).toBe("Pedidos");
    expect(por("cliente").total).toBe(30000);
    expect(por("cliente").cantidad).toBe(3);
  });

  it("el mes sale de la hora argentina y cruza el año; fuera del período no cuenta", () => {
    // 01/01/2027 01:00 en Buenos Aires = 04:00 UTC; 31/12 23:30 en Buenos Aires = 01/01 02:30 UTC
    const pedidos = [
      pedido("1", { confirmadoEn: new Date("2027-01-01T02:30:00Z") }),
      pedido("2", { confirmadoEn: new Date("2027-01-01T04:00:00Z") }),
      pedido("3", { confirmadoEn: new Date("2027-03-01T04:00:00Z") }),
    ];
    const m = armarVentas({ pedidos, meses: ["2026-12", "2027-01"], agrupar: "cliente" });
    expect(m.filas[0].porMes).toEqual([10000, 10000]);
    expect(m.total).toBe(20000);
  });

  it("sin pedidos no hay filas", () => {
    const m = armarVentas({ pedidos: [], meses: MESES, agrupar: "producto" });
    expect(m.filas).toEqual([]);
    expect(m.total).toBe(0);
  });
});

describe("filtro y desglose", () => {
  it("lee la celda: sin grupo es inválida; el mes sólo vale dentro del período; agrupar inválido vuelve a producto", () => {
    expect(leerFiltroVentas({}, MESES)).toBeNull();
    expect(leerFiltroVentas({ grupo: "x".repeat(301) }, MESES)).toBeNull();
    expect(leerFiltroVentas({ grupo: "c:1", mes: "2030-01", agrupar: "raro" }, MESES)).toEqual({ agrupar: "producto", grupo: "c:1", mes: null });
    expect(leerFiltroVentas({ grupo: "c:1", mes: "2026-10", agrupar: "cliente" }, MESES)).toEqual({ agrupar: "cliente", grupo: "c:1", mes: "2026-10" });
    expect(agrupamientoElegido(undefined)).toBe("producto");
  });

  it("el desglose de un mes trae sólo ese mes con las columnas pedidas", () => {
    const pedidos = [pedido("1"), pedido("2", { confirmadoEn: new Date("2026-11-02T15:00:00Z") })];
    const d = detalleDeVentas(pedidos, { agrupar: "cliente", grupo: "c:cl1", mes: "2026-10" }, diaEnBuenosAires);
    expect(d.etiqueta).toBe("Ana Gómez");
    expect(d.filas).toEqual([
      { clave: "1", pedidoId: "1", numero: "P-1", confirmado: "2026-10-05", cliente: "Ana Gómez", fechaEvento: "2026-12-12", categoria: "Bodas", vendedor: "Vera", centavos: 10000 },
    ]);
  });
});

describe("CSV de Ventas", () => {
  it("matriz: encabezados por agrupamiento y mes, importes en pesos con coma, total y unidades", () => {
    const m = armarVentas({ pedidos: [pedido("1", { items: [item("a", { cantidad: 2, precioUnitario: 1234.5 })] })], meses: MESES, agrupar: "producto" });
    const csv = csvDeVentas(m);
    const lineas = csv.replace(/^﻿/, "").trim().split(/\r?\n/);
    expect(lineas[0]).toBe("Producto;09/2026;10/2026;11/2026;Total;Unidades");
    expect(lineas[1]).toContain("Producto a;");
    expect(lineas[1]).toContain("2469,00");
    expect(lineas[1].endsWith(";2")).toBe(true);
    expect(lineas[lineas.length - 1].startsWith("Total;")).toBe(true);
  });

  it("detalle: columnas pedidas y total al final; protege contra fórmulas", () => {
    const filas = detalleDeVentas([pedido("1", { cliente: "=CMD()" })], { agrupar: "vendedor", grupo: "u:7", mes: null }, diaEnBuenosAires).filas;
    const csv = csvDeVentasDetalle(filas, 10000).replace(/^﻿/, "");
    const lineas = csv.trim().split(/\r?\n/);
    expect(lineas[0]).toBe("Pedido;Fecha de confirmación;Cliente;Fecha del evento;Categoría;Vendedor;Importe");
    expect(lineas[1]).toContain("05/10/2026");
    expect(lineas[1]).toContain("12/12/2026");
    expect(lineas[1]).not.toContain(";=CMD");
    expect(lineas[2].startsWith("Total;")).toBe(true);
  });
});
