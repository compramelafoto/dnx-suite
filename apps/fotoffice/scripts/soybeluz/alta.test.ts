import { describe, expect, it } from "vitest";
import { ADMINISTRADORES, CONTACTO, MODULOS, TIEMPO_TRANSACCION_MS, planDeAlta, type EstadoActual } from "./alta";

const VACIO: EstadoActual = { workspace: false, branding: false, membresias: [], vocabulario: false, modulos: [], sitio: null };

const TODO_CREADO: EstadoActual = {
  workspace: true,
  branding: true,
  membresias: [
    { email: "belenfister@gmail.com", role: "WORKSPACE_OWNER" },
    { email: "dnxfotografia@gmail.com", role: "WORKSPACE_ADMIN" },
  ],
  vocabulario: true,
  modulos: [...MODULOS],
  sitio: { tienePaginas: true },
};

const tipos = (estado: EstadoActual) => planDeAlta(estado).map((a) => a.tipo);

describe("planDeAlta", () => {
  it("en una base sin nada, crea todo y deja el sitio sin publicar", () => {
    expect(tipos(VACIO)).toEqual([
      "crearWorkspace",
      "crearBranding",
      "crearMembresia",
      "crearMembresia",
      "crearVocabulario",
      "encenderModulo",
      "encenderModulo",
      "encenderModulo",
      "encenderModulo",
      "crearSitio",
    ]);
    expect(planDeAlta(VACIO).filter((a) => a.tipo === "crearMembresia")).toEqual([
      { tipo: "crearMembresia", email: "belenfister@gmail.com", role: "WORKSPACE_OWNER" },
      { tipo: "crearMembresia", email: "dnxfotografia@gmail.com", role: "WORKSPACE_ADMIN" },
    ]);
  });

  it("los administradores son los dos que pidió Daniel", () => {
    expect(ADMINISTRADORES).toEqual([
      { email: "belenfister@gmail.com", role: "WORKSPACE_OWNER" },
      { email: "dnxfotografia@gmail.com", role: "WORKSPACE_ADMIN" },
    ]);
  });

  it("correrlo dos veces no hace nada la segunda", () => {
    expect(planDeAlta(TODO_CREADO).every((a) => a.tipo === "saltear")).toBe(true);
  });

  it("si el sitio ya tiene páginas, no lo toca aunque falte otra cosa", () => {
    const acciones = planDeAlta({ ...TODO_CREADO, modulos: ["website"] });
    expect(acciones.some((a) => a.tipo === "crearSitio")).toBe(false);
    expect(acciones.filter((a) => a.tipo === "encenderModulo").length).toBe(3);
  });

  it("si existe el registro del sitio pero sin páginas, lo carga", () => {
    expect(tipos({ ...TODO_CREADO, sitio: { tienePaginas: false } })).toContain("crearSitio");
  });

  it("no baja de rol a quien ya está con otro rol", () => {
    const acciones = planDeAlta({
      ...TODO_CREADO,
      membresias: [
        { email: "dnxfotografia@gmail.com", role: "WORKSPACE_OWNER" },
        { email: "belenfister@gmail.com", role: "WORKSPACE_OWNER" },
      ],
    });
    expect(acciones.some((a) => a.tipo === "crearMembresia")).toBe(false);
  });

  it("los emails se comparan sin importar mayúsculas", () => {
    const acciones = planDeAlta({ ...TODO_CREADO, membresias: [{ email: "BelenFister@Gmail.com", role: "WORKSPACE_OWNER" }, TODO_CREADO.membresias[1]] });
    expect(acciones.some((a) => a.tipo === "crearMembresia")).toBe(false);
  });
});

describe("transacción del alta", () => {
  it("le da tiempo a las ~14 consultas contra Neon (el límite de Prisma por omisión es 5 s)", () => {
    expect(TIEMPO_TRANSACCION_MS).toBeGreaterThanOrEqual(20_000);
  });
});

describe("contacto público", () => {
  it("es el de SOYBELUZ, no el correo personal de quien administra", () => {
    expect(CONTACTO).toEqual({ email: "info.soybeluz@gmail.com", whatsapp: "3412121469" });
  });
});
