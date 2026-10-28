import { describe, expect, it } from "vitest";
import { guiaDeAtencion, situacionDeAtencion } from "./guia";

describe("guía del bot de atención", () => {
  it("nombra las tres herramientas y las reglas que no se negocian", () => {
    const g = guiaDeAtencion();
    for (const t of ["buscar_productos", "datos_del_estudio", "preparar_presupuesto", "pasar_a_persona"]) expect(g).toContain(t);
    expect(g).toMatch(/Nunca inventes precios/);
    expect(g).toMatch(/markdown/);
  });

  it("sabe pedir la foto como Documento cuando no alcanza la calidad", () => {
    expect(guiaDeAtencion()).toContain("como Documento");
    expect(guiaDeAtencion()).toMatch(/Si ya la mandó como documento/);
  });

  it("habla desde el estudio: traer y venir, nunca llevar", () => {
    const g = guiaDeAtencion();
    expect(g).toMatch(/desde adentro del estudio/);
    expect(g).toContain("Podés traerlos hoy");
    expect(g).toMatch(/nunca "llevar"/);
  });

  it("castellano rioplatense semiformal, sin frases de otros países", () => {
    const g = guiaDeAtencion();
    expect(g).toMatch(/rioplatense de Argentina, semiformal/);
    expect(g).toContain('decí "si no tenés apuro"');
  });

  it("para eventos y sesiones pregunta las horas y, si hay muchos invitados, recomienda un segundo fotógrafo", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("cuántas horas dura");
    expect(g).toContain("más de 200 invitados");
    expect(g).toContain("galería online");
  });

  it("no repite lo que el cliente ya dijo, salvo que algo no cierre; salón y localidad alcanzan", () => {
    const g = guiaDeAtencion();
    expect(g).toContain("No repitas los datos que el cliente ya te dio");
    expect(g).toContain("el nombre del salón y la localidad alcanzan");
  });

  it("para cursos usa cursos_del_estudio y no arma presupuesto", () => {
    expect(guiaDeAtencion()).toContain("cursos_del_estudio");
  });

  it("la situación dice el día y la hora en Argentina y el nombre si lo hay", () => {
    const s = situacionDeAtencion({ estudio: "DNX Estudio", cliente: "Lucía", ahora: new Date("2026-10-20T23:30:00.000Z") });
    expect(s).toContain("DNX Estudio");
    expect(s).toMatch(/martes, 20 de octubre/);
    expect(s).toContain("20:30");
    expect(s).toContain("Lucía");
    expect(situacionDeAtencion({ estudio: "X", cliente: null, ahora: new Date() })).toContain("No sabemos el nombre");
  });
});
