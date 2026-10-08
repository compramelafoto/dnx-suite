import { describe, expect, it } from "vitest";
import {
  diasEntre,
  esMesValido,
  informeACobrar,
  informeAPagar,
  informeCobrado,
  mesElegido,
  pesosInforme,
  rangoDelMes,
  semanaDe,
  tramoDe,
  type SaldoDeCuota,
} from "./informes";

const s = (dueDate: string, saldo: number, extra: Partial<SaldoDeCuota> = {}): SaldoDeCuota => ({
  pedidoId: "p1",
  pedidoNumero: "P-1",
  clienteId: "c1",
  clienteNombre: "Ana",
  dueDate,
  saldo,
  ...extra,
});

describe("semana y mes", () => {
  it("la semana va de lunes a domingo", () => {
    // 2026-10-07 es miércoles.
    expect(semanaDe("2026-10-07")).toEqual({ lunes: "2026-10-05", domingo: "2026-10-11" });
    expect(semanaDe("2026-10-05")).toEqual({ lunes: "2026-10-05", domingo: "2026-10-11" });
    expect(semanaDe("2026-10-11")).toEqual({ lunes: "2026-10-05", domingo: "2026-10-11" });
    expect(semanaDe("2026-10-12")).toEqual({ lunes: "2026-10-12", domingo: "2026-10-18" });
    // Cruza el fin de año.
    expect(semanaDe("2026-12-31")).toEqual({ lunes: "2026-12-28", domingo: "2027-01-03" });
  });

  it("valida el mes pedido y no deja ir al futuro", () => {
    expect(esMesValido("2026-10")).toBe(true);
    expect(esMesValido("2026-13")).toBe(false);
    expect(esMesValido("2026-1")).toBe(false);
    expect(mesElegido("2026-09", "2026-10-08")).toBe("2026-09");
    expect(mesElegido("2026-11", "2026-10-08")).toBe("2026-10-08".slice(0, 7));
    expect(mesElegido("basura", "2026-10-08")).toBe("2026-10");
    expect(mesElegido(undefined, "2026-10-08")).toBe("2026-10");
    expect(mesElegido(["2026-08", "x"], "2026-10-08")).toBe("2026-08");
  });

  it("el mes calendario es de Argentina (UTC-3)", () => {
    const r = rangoDelMes("2026-10");
    expect(r.desde.toISOString()).toBe("2026-10-01T03:00:00.000Z");
    expect(r.hasta.toISOString()).toBe("2026-11-01T03:00:00.000Z");
    expect(rangoDelMes("2026-12").hasta.toISOString()).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("A cobrar", () => {
  it("separa vencido, esta semana y total; lo posterior sólo suma al total", () => {
    const r = informeACobrar(
      [s("2026-10-06", 100), s("2026-10-07", 200), s("2026-10-11", 300), s("2026-10-12", 400), s("2026-12-01", 500)],
      "2026-10-07",
    );
    expect(r.vencido).toBe(100);
    expect(r.estaSemana).toBe(500); // hoy (200) y el domingo (300)
    expect(r.total).toBe(1500);
    expect(r.semana).toEqual({ lunes: "2026-10-05", domingo: "2026-10-11" });
  });

  it("antigüedad: 1–30, 31–60 y más de 60 días de atraso", () => {
    expect(tramoDe(1)).toBe("0-30");
    expect(tramoDe(30)).toBe("0-30");
    expect(tramoDe(31)).toBe("31-60");
    expect(tramoDe(60)).toBe("31-60");
    expect(tramoDe(61)).toBe("60+");
    expect(diasEntre("2026-09-07", "2026-10-07")).toBe(30);
    const r = informeACobrar([s("2026-09-07", 10), s("2026-09-06", 20), s("2026-08-08", 30), s("2026-08-07", 40)], "2026-10-07");
    expect(r.antiguedad).toEqual({ "0-30": 10, "31-60": 50, "60+": 40 });
    expect(r.vencido).toBe(100);
  });

  it("agrupa por cliente, ordena por lo vencido y cuenta pedidos", () => {
    const r = informeACobrar(
      [
        s("2026-10-01", 100, { clienteId: "a", clienteNombre: "Ana", pedidoId: "p1" }),
        s("2026-09-01", 50, { clienteId: "a", clienteNombre: "Ana", pedidoId: "p2" }),
        s("2026-10-01", 500, { clienteId: "b", clienteNombre: "Beto", pedidoId: "p3" }),
        s("2026-11-01", 1000, { clienteId: "c", clienteNombre: "Cora", pedidoId: "p4" }),
      ],
      "2026-10-07",
    );
    expect(r.clientes.map((c) => c.clienteId)).toEqual(["b", "a", "c"]);
    const a = r.clientes.find((c) => c.clienteId === "a")!;
    expect(a.pedidos).toBe(2);
    expect(a.total).toBe(150);
    expect(a.porTramo).toEqual({ "0-30": 100, "31-60": 50, "60+": 0 });
  });

  it("ignora saldos en cero y suma en centavos sin errores de punto flotante", () => {
    const r = informeACobrar([s("2026-10-01", 0), s("2026-10-01", 0.1), s("2026-10-01", 0.2)], "2026-10-07");
    expect(r.vencido).toBe(0.3);
    expect(r.clientes).toHaveLength(1);
  });
});

describe("Cobrado del mes", () => {
  const c = (iso: string, method: string, amountArs: number) => ({ paidAt: new Date(iso), method, amountArs });
  it("cuenta por mes de Argentina: el límite es la medianoche local, no la UTC", () => {
    const r = informeCobrado(
      [
        c("2026-10-01T02:59:59.999Z", "EFECTIVO", 1), // 30/09 23:59 en Argentina: septiembre
        c("2026-10-01T03:00:00.000Z", "EFECTIVO", 10), // 01/10 00:00: octubre
        c("2026-10-31T23:00:00.000Z", "TRANSFERENCIA", 20), // 31/10 20:00: octubre
        c("2026-11-01T02:59:59.999Z", "TRANSFERENCIA", 30), // 31/10 23:59: octubre
        c("2026-11-01T03:00:00.000Z", "TARJETA", 40), // noviembre
      ],
      "2026-10",
    );
    expect(r.total).toBe(60);
    expect(r.cantidad).toBe(3);
    expect(r.porMedio.find((m) => m.medio === "EFECTIVO")!.total).toBe(10);
    expect(r.porMedio.find((m) => m.medio === "TRANSFERENCIA")!.total).toBe(50);
  });

  it("devuelve los 5 medios con etiqueta en español y manda lo desconocido a Otro", () => {
    const r = informeCobrado([c("2026-10-15T15:00:00.000Z", "RARO", 5)], "2026-10");
    expect(r.porMedio.map((m) => m.etiqueta)).toEqual(["Efectivo", "Transferencia", "Mercado Pago", "Tarjeta", "Otro"]);
    expect(r.porMedio.find((m) => m.medio === "OTRO")!.total).toBe(5);
  });
});

describe("A pagar", () => {
  const q = (id: string, dueDate: string | null, importe: number, prov: string | null = "pr1") => ({
    id,
    proveedorId: prov,
    proveedorNombre: prov ?? "Sin proveedor",
    dueDate,
    importe,
  });
  it("vencidas y próximos 30 días (inclusive); más lejos no entra; sin fecha, aparte", () => {
    const r = informeAPagar(
      [q("1", "2026-10-06", 100), q("2", "2026-10-07", 200), q("3", "2026-11-06", 300), q("4", "2026-11-07", 400), q("5", null, 50), q("6", null, 25, null)],
      "2026-10-07",
    );
    expect(r.hasta).toBe("2026-11-06");
    expect(r.vencido).toBe(100);
    expect(r.proximos).toBe(500);
    expect(r.total).toBe(600);
    expect(r.proveedores).toHaveLength(1);
    expect(r.proveedores[0]).toMatchObject({ proveedorId: "pr1", vencido: 100, proximos: 500, total: 600, cuentas: 3 });
    expect(r.sinVencimiento.total).toBe(75);
    expect(r.sinVencimiento.cuentas).toBe(2);
    expect(r.sinVencimiento.proveedores.map((p) => p.proveedorId).sort()).toEqual([null, "pr1"].sort());
  });
});

describe("formato", () => {
  it("pesos es-AR sin decimales salvo que haya centavos", () => {
    expect(pesosInforme(1500)).toMatch(/1\.500$/);
    expect(pesosInforme(1500)).not.toMatch(/,/);
    expect(pesosInforme(1500.5)).toMatch(/1\.500,50$/);
  });
});
