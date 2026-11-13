import { describe, expect, it } from "vitest";
import { claveDeEstudiante, leerPadron, separarApellidoNombre } from "./padron";

describe("leerPadron", () => {
  it("lee columnas de Excel con encabezado", () => {
    const r = leerPadron("Apellido\tNombre\tDNI\nGómez\tAna Laura\t45.123.456\nPérez\tJuan\t44123457\n");
    expect(r.filas.map((f) => [f.apellido, f.nombre, f.dni])).toEqual([
      ["Gómez", "Ana Laura", "45123456"],
      ["Pérez", "Juan", "44123457"],
    ]);
    expect(r.avisos).toEqual([]);
  });

  it("lee «Apellido y nombre» en una columna, con coma o con el apellido en mayúsculas", () => {
    const r = leerPadron("N°\tApellido y nombre\tCondición\n1\tGÓMEZ, Ana\tR\n2\tDE LA FUENTE Juan Ignacio\tNR");
    expect(r.filas.map((f) => [f.apellido, f.nombre, f.condicion])).toEqual([
      ["GÓMEZ", "Ana", "R"],
      ["DE LA FUENTE", "Juan Ignacio", "NR"],
    ]);
  });

  it("sin encabezado: ignora el número de orden y detecta el DNI", () => {
    const r = leerPadron("1\tPÉREZ Juan\t44123457\n2\tLÓPEZ María\t44123458");
    expect(r.filas.map((f) => [f.apellido, f.nombre, f.dni])).toEqual([
      ["PÉREZ", "Juan", "44123457"],
      ["LÓPEZ", "María", "44123458"],
    ]);
  });

  it("una lista simple de una columna, con aviso cuando adivina", () => {
    const r = leerPadron("Juan Pérez\n\nAna Gómez\n");
    expect(r.filas).toHaveLength(2);
    expect(r.filas[0]).toMatchObject({ apellido: "Juan", nombre: "Pérez", revisar: true });
    expect(r.avisos.at(-1)).toContain("revisalos");
  });

  it("saltea repetidos y renglones sin apellido", () => {
    const r = leerPadron("Apellido;Nombre;DNI\nGómez;Ana;45123456\nGómez;Ana B.;45123456\n;Juan;");
    expect(r.filas).toHaveLength(1);
    expect(r.avisos).toEqual(["Renglón 3: repite al renglón 2; se salteó.", "Renglón 4: no se encontró el apellido; se salteó."]);
  });

  it("separa con dos columnas sin encabezado", () => {
    expect(leerPadron("Gómez\tAna").filas[0]).toMatchObject({ apellido: "Gómez", nombre: "Ana", revisar: false });
  });
});

describe("separarApellidoNombre y clave", () => {
  it("separa por coma", () => {
    expect(separarApellidoNombre("Gómez Paz, Ana")).toEqual({ apellido: "Gómez Paz", nombre: "Ana", revisar: false });
  });
  it("la clave usa DNI si hay, si no el nombre sin tildes", () => {
    expect(claveDeEstudiante({ apellido: "Gómez", nombre: "Ana", dni: "1" })).toBe("dni:1");
    expect(claveDeEstudiante({ apellido: "Gómez", nombre: "Ána", dni: null })).toBe("nom:gomez ana");
  });
});
