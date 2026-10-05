import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { cumpleanosDeLaSemana, diasDeLaSemana } from "./cumpleanos-semana";
import { validarFechaNacimiento } from "../registration/domain/fecha-nacimiento";

const persona = (clave: string, fechaNacimiento: string | null, instagram: string | null = null) => ({
  clave,
  nombre: `Ana ${clave}`,
  fechaNacimiento,
  instagram,
});

describe("cumpleaños de la semana", () => {
  it("la semana va de lunes a domingo y cruza el fin de año", () => {
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    assert.deepEqual(diasDeLaSemana("2026-10-07").map(iso)[0], "2026-10-05");
    assert.deepEqual(diasDeLaSemana("2026-10-11").map(iso)[6], "2026-10-11");
    const finDeAnio = diasDeLaSemana("2026-12-31").map(iso);
    assert.equal(finDeAnio[0], "2026-12-28");
    assert.equal(finDeAnio[6], "2027-01-03");
  });

  it("toma sólo los de la semana, en orden, y marca hoy y los que ya pasaron", () => {
    const r = cumpleanosDeLaSemana(
      [
        persona("Viernes", "1980-10-09"),
        persona("Lunes", "1975-10-05"),
        persona("Miercoles", "1990-10-07"),
        persona("Afuera", "1990-10-12"),
        persona("SinFecha", null),
      ],
      "2026-10-07",
    );
    assert.deepEqual(
      r.map((c) => [c.dia, c.yaPaso, c.esHoy]),
      [
        ["Lunes 5", true, false],
        ["Miércoles 7", false, true],
        ["Viernes 9", false, false],
      ],
    );
  });

  it("arma el enlace de Instagram con lo que haya y lo omite si no sirve", () => {
    const r = cumpleanosDeLaSemana(
      [
        persona("A", "1990-10-06", "@Juan.Foto"),
        persona("B", "1990-10-06", "https://www.instagram.com/maria_ph/?hl=es"),
        persona("C", "1990-10-06", "no es usuario!"),
      ],
      "2026-10-07",
    );
    assert.deepEqual(
      r.map((c) => c.instagramUrl),
      ["https://instagram.com/juan.foto", "https://instagram.com/maria_ph", null],
    );
  });

  it("el 29 de febrero se festeja el 28 en años no bisiestos", () => {
    const r = cumpleanosDeLaSemana([persona("X", "1988-02-29")], "2027-02-26");
    assert.deepEqual(r.map((c) => c.dia), ["Domingo 28"]);
  });
});

describe("fecha de nacimiento obligatoria", () => {
  const ahora = new Date("2026-10-05T12:00:00Z");
  it("acepta una fecha real", () => {
    const r = validarFechaNacimiento("1990-04-12", ahora);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.fecha.toISOString(), "1990-04-12T00:00:00.000Z");
  });
  it("rechaza vacía, inexistente o fuera de rango", () => {
    assert.equal(validarFechaNacimiento("", ahora).ok, false);
    assert.equal(validarFechaNacimiento("1990-02-31", ahora).ok, false);
    assert.equal(validarFechaNacimiento("2024-01-01", ahora).ok, false);
    assert.equal(validarFechaNacimiento("1900-01-01", ahora).ok, false);
    assert.equal(validarFechaNacimiento("12/04/1990", ahora).ok, false);
  });
});
