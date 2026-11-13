import { describe, expect, it } from "vitest";
import { armarPlanillaMiEscuela, type FilaParaPlanilla } from "./planilla-mi-escuela";

const P = [{ clave: "T1", nombre: "1.er trimestre" }, { clave: "T2", nombre: "2.º trimestre" }];
const fila = (x: Partial<FilaParaPlanilla>): FilaParaPlanilla => ({
  orden: 1, apellido: "GÓMEZ", nombre: "Ana", dni: "45123456", condicion: "R", baja: null, redondeo: "mitad-arriba", notas: {}, faltas: 0, asistencia: null, ...x,
});

describe("planilla para Mi Escuela", () => {
  it("convierte a entero, pone los especiales y ordena por el padrón", () => {
    const csv = armarPlanillaMiEscuela(P, [
      fila({ orden: 2, apellido: "PÉREZ", nombre: "Juan", notas: { T1: { final: 6.5, especial: null }, T2: { final: null, especial: "EXCEPTUADO" } }, faltas: 2.5, asistencia: 90 }),
      fila({ orden: 1, notas: { T1: { final: 6.49, especial: null } } }),
    ], true);
    const lineas = csv.replace(/^﻿/, "").trim().split("\r\n");
    expect(lineas[0]).toBe("N.°;Apellido y nombre;DNI;Condición;1.er trimestre;1.er trimestre (con decimales);2.º trimestre;2.º trimestre (con decimales);Nota final;Nota final (con decimales);Faltas;Asistencia %;Pasada");
    expect(lineas[1]).toBe("1;GÓMEZ, Ana;45123456;R;6;6,49;;;;;0;;");
    expect(lineas[2]).toBe("2;PÉREZ, Juan;45123456;R;7;6,5;Exceptuado;;;;2,5;90;");
  });

  it("una baja queda sin notas y lo dice", () => {
    const csv = armarPlanillaMiEscuela(P, [fila({ baja: "2027-05-10", notas: { T1: { final: 8, especial: null } } })], false);
    expect(csv).toContain("Baja 10/05/2027;;;;0;;");
  });
});
