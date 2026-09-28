import { describe, expect, it } from "vitest";
import { armarContexto, SugerenciaSchema } from "./prompt";
import type { OportunidadVenta } from "./opportunity";

const op: OportunidadVenta = {
  fuente: "ALBOOM", idExterno: "9", titulo: "Cumple de XV", tipoEvento: "Cumple de XV",
  nombreCliente: "Sabrina", apellidoCliente: "Berdónez", telefono: "3412717813",
  email: "sabri@example.com", fechaEvento: new Date("2027-01-01T17:00:00Z"), lugar: "Salón X",
  ciudad: "Rosario", invitados: "120", origen: "Instagram", descripcionCliente: "Quiero foto y video",
  embudo: "Embudo DNX", etapa: "Cliente potencial", etapaOrden: 4, etapasTotal: 6, abierta: true,
  creadaEn: new Date("2026-09-20T15:00:00Z"), presupuestoEnviadoEn: new Date("2026-09-20T15:05:00Z"),
  modificadaEn: new Date("2026-09-24T15:00:00Z"),
  movimientos: [{ fecha: new Date("2026-09-22T12:00:00Z"), tipo: "CORREO", texto: "Te mando el presupuesto" }],
};

describe("armarContexto", () => {
  const ctx = armarContexto({
    oportunidad: op,
    seguimientos: [{ fecha: new Date("2026-09-25T12:00:00Z"), tipo: "RESULTADO", resultado: "PIDIO_DESCUENTO", texto: "dice que es caro" }],
    sugerenciasPrevias: [],
    voz: { firma: "Dani de DNX", indicaciones: "La seña es del 30 %" },
    hoy: new Date("2026-09-28T10:00:00Z"),
  });
  it("no incluye teléfono, email ni apellido", () => {
    expect(ctx).not.toContain("3412717813");
    expect(ctx).not.toContain("sabri@example.com");
    expect(ctx).not.toContain("Berdónez");
  });
  it("incluye lo necesario para decidir", () => {
    for (const s of ["Sabrina", "Cliente potencial", "Rosario", "Instagram", "Quiero foto y video", "Pidió descuento", "dice que es caro", "La seña es del 30 %", "Dani de DNX", "Te mando el presupuesto"]) {
      expect(ctx).toContain(s);
    }
  });
  it("dice cuántos días faltan y cuántos pasaron del presupuesto", () => {
    expect(ctx).toMatch(/faltan 95 días/);
    expect(ctx).toMatch(/hace 8 días/);
  });
});

describe("armarContexto oculta datos de contacto metidos en texto libre", () => {
  const conDatos: OportunidadVenta = {
    ...op,
    telefono: "+54 9 341 271-7813",
    titulo: "XV de Sabrina Berdónez",
    descripcionCliente: "Soy Sabrina BERDÓNEZ, mi cel es 341 271-7813 o 5493412717813, mail sabri@example.com. Somos 120.",
    movimientos: [
      {
        fecha: new Date("2026-09-22T12:00:00Z"),
        tipo: "CORREO",
        texto: "Respondió desde Sabri@Example.com: llamame al (0341) 15-555-1234 o escribí a otra.persona@gmail.com",
      },
    ],
  };
  const ctx = armarContexto({
    oportunidad: conDatos,
    seguimientos: [{ fecha: new Date("2026-09-25T12:00:00Z"), tipo: "NOTA", resultado: null, texto: "Me pasó el de la mamá: +54 9 11 4444-5555" }],
    sugerenciasPrevias: [{ fecha: new Date("2026-09-24T12:00:00Z"), accion: "ESCRIBIR", estado: "ENVIADA", mensaje: "Hola Sabrina Berdónez, te escribo al 3412717813" }],
    voz: { firma: "Dani de DNX", indicaciones: null },
    hoy: new Date("2026-09-28T10:00:00Z"),
  });

  it("no deja pasar el teléfono, el email ni el apellido en ninguna forma", () => {
    for (const dato of ["3412717813", "271-7813", "5493412717813", "sabri@example.com", "Sabri@Example.com", "Berdónez", "BERDÓNEZ", "otra.persona@gmail.com", "555-1234", "4444-5555"]) {
      expect(ctx).not.toContain(dato);
    }
    expect(ctx).toContain("[dato oculto]");
  });
  it("conserva lo demás: nombre de pila, fechas y números cortos", () => {
    expect(ctx).toContain("Sabrina");
    expect(ctx).toContain("Somos 120.");
    expect(ctx).toContain("Hoy es 28/09/2026.");
    expect(ctx).toContain("22/09/2026");
  });
});

describe("SugerenciaSchema", () => {
  it("acepta una respuesta válida y rechaza una acción inventada", () => {
    expect(SugerenciaSchema.safeParse({ accion: "ESCRIBIR", prioridad: "ALTA", motivo: "x", mensaje: "Hola", esperarDias: null }).success).toBe(true);
    expect(SugerenciaSchema.safeParse({ accion: "LLAMAR", prioridad: "ALTA", motivo: "x", mensaje: null, esperarDias: null }).success).toBe(false);
  });
});
