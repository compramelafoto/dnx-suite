import { describe, expect, it } from "vitest";
import { coincide, generarCodigo, planillaInscriptos, resumir, unidadesDeEntrada } from "./reglas";
import { fechaDeInput, validarEvento, validarInscripto } from "./validar";

const getter = (o: Record<string, string>) => (k: string) => o[k] ?? "";

describe("unidadesDeEntrada", () => {
  const entradas = [{ eventoId: "ev27", productId: "preventa", tipo: "Preventa 2027" }];

  it("cada unidad de un producto-entrada es un inscripto; lo demás no cuenta", () => {
    const u = unidadesDeEntrada(
      [
        { id: "it1", productId: "preventa", productName: "Preventa", variantName: null, qty: 3, unitPriceArs: "100000.00" },
        { id: "it2", productId: "remera", productName: "Remera", variantName: "M", qty: 1, unitPriceArs: "32000.00" },
        { id: "it3", productId: null, productName: "Obra", variantName: null, qty: 1, unitPriceArs: "1" },
      ],
      entradas,
    );
    expect(u.map((x) => `${x.storeOrderItemId}:${x.unidad}`)).toEqual(["it1:1", "it1:2", "it1:3"]);
    expect(u[0]).toMatchObject({ eventoId: "ev27", tipo: "Preventa 2027", montoArs: "100000.00" });
  });

  it("sin tipo propio usa el nombre del producto y del talle", () => {
    const [u] = unidadesDeEntrada(
      [{ id: "a", productId: "p", productName: "Entrada", variantName: "Día 1", qty: 1, unitPriceArs: "1" }],
      [{ eventoId: "e", productId: "p", tipo: "  " }],
    );
    expect(u.tipo).toBe("Entrada · Día 1");
  });
});

describe("generarCodigo", () => {
  it("6 caracteres sin letras que se confunden", () => {
    for (let i = 0; i < 200; i++) expect(generarCodigo()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  });
});

describe("coincide", () => {
  const i = { nombre: "José Pérez", email: "jose@mail.com", telefono: "+54 9 3492 41-7703", dni: "30.123.456", codigo: "AB7K2M" };
  it("sin tildes, por palabras, por teléfono o DNI parcial y por código", () => {
    expect(coincide(i, "jose perez")).toBe(true);
    expect(coincide(i, "417703")).toBe(true);
    expect(coincide(i, "30123")).toBe(true);
    expect(coincide(i, "ab7k")).toBe(true);
    expect(coincide(i, "maria")).toBe(false);
    expect(coincide(i, "")).toBe(true);
  });
});

describe("planillaInscriptos", () => {
  it("separa con ; , escapa comillas y desarma fórmulas", () => {
    const csv = planillaInscriptos([
      {
        nombre: '=HYPERLINK("x")',
        email: null,
        telefono: null,
        dni: null,
        codigo: "AAA",
        tipo: "General; día 1",
        origen: "MANUAL",
        estadoPago: "CORTESIA",
        montoArs: null,
        acreditadoAt: null,
        createdAt: new Date("2026-11-01T12:00:00Z"),
        notas: null,
      },
    ]);
    expect(csv.startsWith("﻿Código;Nombre")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"General; día 1"');
    expect(csv).toContain("Carga manual;Cortesía");
  });
});

describe("resumir", () => {
  it("los anulados no cuentan", () => {
    const r = resumir([
      { estadoPago: "PAGADO", acreditadoAt: new Date() },
      { estadoPago: "PENDIENTE", acreditadoAt: null },
      { estadoPago: "CORTESIA", acreditadoAt: null },
      { estadoPago: "ANULADO", acreditadoAt: null },
    ]);
    expect(r).toEqual({ total: 3, pagados: 1, pendientes: 1, cortesias: 1, acreditados: 1 });
  });
});

describe("validar", () => {
  it("evento: nombre obligatorio, fin no antes del inicio, cupo positivo", () => {
    expect(validarEvento(getter({ nombre: " " }))).toBeNull();
    const e = validarEvento(getter({ nombre: "Congreso", fechaInicio: "2027-11-06", fechaFin: "2027-11-01", cupo: "0" }))!;
    expect(e.fechaFin).toEqual(e.fechaInicio);
    expect(e.cupo).toBeNull();
    expect(fechaDeInput("2027-11-06")!.toISOString()).toBe("2027-11-06T15:00:00.000Z");
  });

  it("inscripto: correo inválido rechaza, monto con puntos de miles, ANULADO no se elige al cargar", () => {
    expect(validarInscripto(getter({ nombre: "Ana", email: "no-es-correo" }))).toBeNull();
    const d = validarInscripto(getter({ nombre: "Ana", email: "ANA@X.COM", montoArs: "110.000", dni: "30.123.456", estadoPago: "ANULADO" }))!;
    expect(d).toMatchObject({ email: "ana@x.com", montoArs: "110000", dni: "30123456", estadoPago: "PENDIENTE" });
  });
});
