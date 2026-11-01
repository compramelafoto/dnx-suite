import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";

import {
  estadoDeLaObra,
  filasDelListado,
  libroDelListado,
  type InscripcionParaListar,
} from "./listadoDeParticipantes";

function inscripcion(parcial: Partial<InscripcionParaListar> = {}): InscripcionParaListar {
  return {
    numero: "RETRAT-0001",
    estado: "CONFIRMED",
    pago: "NOT_REQUIRED",
    inscriptaEl: new Date("2026-10-14T15:00:00.000Z"),
    aceptaNovedades: true,
    persona: {
      nombre: "Ana Pérez",
      email: "ana@example.com",
      telefono: "341 555-0000",
      whatsapp: null,
      instagram: "@ana",
      ciudad: "Rosario",
      provincia: "Santa Fe",
      pais: "Argentina",
    },
    obras: [
      { numero: "RETRAT-E-000001", categoria: "Color", estado: "CONFIRMED", admision: "FROZEN_FOR_JURY" },
      { numero: "RETRAT-E-000002", categoria: "Monocromo", estado: "REJECTED", admision: "REJECTED" },
    ],
    ...parcial,
  };
}

test("el estado de la obra se dice en castellano y gana el rechazo", () => {
  assert.equal(estadoDeLaObra({ estado: "CONFIRMED", admision: "FROZEN_FOR_JURY" }), "En el jurado");
  assert.equal(estadoDeLaObra({ estado: "CONFIRMED", admision: "ADMITTED" }), "Admitida");
  assert.equal(estadoDeLaObra({ estado: "CONFIRMED", admision: "ELIGIBLE" }), "Confirmada");
  assert.equal(estadoDeLaObra({ estado: "REJECTED", admision: "REJECTED" }), "Rechazada");
  assert.equal(estadoDeLaObra({ estado: "CONFIRMED", admision: "REJECTED" }), "Rechazada");
  assert.equal(estadoDeLaObra({ estado: "WITHDRAWN", admision: "WITHDRAWN" }), "Retirada");
  assert.equal(estadoDeLaObra({ estado: "UPLOADED", admision: null }), "Sin confirmar");
});

test("una fila por participante, con una columna por categoría", () => {
  const filas = filasDelListado([inscripcion()], ["Color", "Monocromo"]);
  assert.equal(filas.length, 1);
  const f = filas[0]!;
  assert.equal(f["Nombre"], "Ana Pérez");
  assert.equal(f["Correo"], "ana@example.com");
  assert.equal(f["Inscripción"], "Confirmada");
  assert.equal(f["Pago"], "Sin cargo");
  assert.equal(f["Obras en Color"], 1);
  // La de Monocromo está rechazada: aparece en el detalle, no en el conteo.
  assert.equal(f["Obras en Monocromo"], 0);
  assert.equal(f["Obras en concurso"], 1);
  assert.equal(f["Obras rechazadas"], 1);
  assert.equal(f["Acepta novedades"], "Sí");
  assert.match(String(f["Detalle de obras"]), /RETRAT-E-000001 \(Color, En el jurado\)/);
});

test("la fecha de inscripción va en hora argentina", () => {
  // 01:30 UTC del 15 son las 22:30 del 14 en Buenos Aires.
  const [f] = filasDelListado([inscripcion({ inscriptaEl: new Date("2026-10-15T01:30:00.000Z") })], []);
  assert.equal(f!["Fecha de inscripción"], "14/10/2026 22:30");
});

test("un dato que falta en una fila queda vacío, no como null", () => {
  const otra = inscripcion({ persona: { ...inscripcion().persona, whatsapp: "341 555-1111" } });
  const [f] = filasDelListado([inscripcion(), otra], []);
  assert.equal(f!["WhatsApp"], "");
});

test("una columna de contacto que nadie completó no sale", () => {
  const [f] = filasDelListado([inscripcion()], []);
  assert.equal("WhatsApp" in f!, false);
  assert.equal(f!["Teléfono"], "341 555-0000");
  // Nombre y correo salen siempre.
  assert.equal("Correo" in f!, true);
});

test("el libro abre en Excel con los encabezados en la primera fila", () => {
  const filas = filasDelListado([inscripcion()], ["Color", "Monocromo"]);
  const libro = XLSX.read(libroDelListado(filas, "Retratos del mundo 2026"), { type: "buffer" });
  const hoja = libro.Sheets[libro.SheetNames[0]!]!;
  const leidas = XLSX.utils.sheet_to_json<Record<string, unknown>>(hoja);
  assert.equal(leidas.length, 1);
  assert.equal(leidas[0]!["Nombre"], "Ana Pérez");
});
