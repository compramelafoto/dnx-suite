import assert from "node:assert/strict";
import test from "node:test";

import { armarPersonas, cumpleanos, type InscripcionPlana } from "./armar-personas";

function insc(parcial: Partial<InscripcionPlana>): InscripcionPlana {
  return {
    id: "r1",
    editionId: "e1",
    edicion: "Clickatón - Primavera 2026 - 1º Edición",
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    createdAt: "2026-08-01T12:00:00.000Z",
    firstName: "Ana",
    lastName: "Pérez",
    email: "ana@ejemplo.com",
    phone: null,
    documentNumber: null,
    birthDate: null,
    city: "Rosario",
    province: "Santa Fe",
    country: "AR",
    instagramHandle: "@ana",
    totalAmount: 1000000,
    currency: "ARS",
    promotionCode: null,
    isGift: false,
    visibleCode: "A-001",
    sede: null,
    entrada: null,
    talle: null,
    kitEntregado: false,
    acreditado: true,
    fotosSubidas: 7,
    fotosAdmitidas: 6,
    autorizaRedes: true,
    userId: 10,
    ...parcial,
  };
}

const vacio = {
  notas: [],
  referidosPorUsuario: new Map<number, number>(),
  npsPorUsuario: new Map<number, number>(),
  localidades: new Map(),
  hoy: "2026-09-25",
};

test("dos ediciones con el mismo email son una persona que participó 2 veces", () => {
  const [p, ...resto] = armarPersonas({
    ...vacio,
    inscripciones: [
      insc({}),
      insc({
        id: "r2",
        editionId: "e2",
        edicion: "Clickatón - Navidad 2026 - 2º Edición",
        email: "ANA@ejemplo.com ",
        createdAt: "2026-09-21T12:00:00.000Z",
        city: null,
      }),
    ],
  });
  assert.equal(resto.length, 0);
  assert.equal(p!.ediciones, 2);
  assert.equal(p!.registrationId, "r2");
  // La inscripción nueva no trae ciudad: se conserva la anterior.
  assert.equal(p!.ciudad, "Rosario");
  assert.equal(p!.instagram, "ana");
  assert.equal(p!.totalPagado, 2000000);
});

test("una cancelada o de la edición DEMO no suma ediciones", () => {
  const [p] = armarPersonas({
    ...vacio,
    inscripciones: [
      insc({ status: "CANCELLED", paymentStatus: "EXPIRED" }),
      insc({ id: "r2", editionId: "demo", edicion: "Clickatón DEMO", paymentStatus: "NOT_REQUIRED" }),
    ],
  });
  assert.equal(p!.ediciones, 0);
  assert.equal(p!.historial.length, 2);
});

test("el rango de notas y el mejor puesto salen de todas sus obras", () => {
  const [p] = armarPersonas({
    ...vacio,
    inscripciones: [insc({})],
    notas: [
      { registrationId: "r1", nota: 6.5, puesto: 4, premio: null, final: false },
      { registrationId: "r1", nota: 8.25, puesto: 1, premio: "FIRST_PLACE", final: false },
      { registrationId: "r1", nota: null, puesto: null, premio: null, final: false },
    ],
  });
  assert.equal(p!.notaMin, 6.5);
  assert.equal(p!.notaMax, 8.25);
  assert.equal(p!.mejorPuesto, 1);
  assert.deepEqual(p!.premios, ["FIRST_PLACE"]);
});

test("la localidad se une por la clave normalizada", () => {
  const [p] = armarPersonas({
    ...vacio,
    inscripciones: [insc({ city: "ROSARIO (SANTA FE - CP. 2000)", province: "SANTA FE" })],
    localidades: new Map([
      ["rosario|santa fe", { ciudad: "Rosario", provincia: "Santa Fe", lat: -32.9, lng: -60.6, estado: "RESUELTA" }],
    ]),
  });
  assert.equal(p!.localidad?.ciudad, "Rosario");
  assert.equal(p!.localidad?.lat, -32.9);
});

test("cumpleaños: edad y días que faltan", () => {
  assert.deepEqual(cumpleanos("1990-09-25", "2026-09-25"), { edad: 36, dias: 0 });
  assert.deepEqual(cumpleanos("1990-09-26", "2026-09-25"), { edad: 35, dias: 1 });
  assert.deepEqual(cumpleanos("1990-09-24", "2026-09-25"), { edad: 36, dias: 364 });
  assert.deepEqual(cumpleanos(null, "2026-09-25"), { edad: null, dias: null });
  // 29/2: los años comunes se festeja el 28.
  assert.equal(cumpleanos("2000-02-29", "2027-02-27").dias, 1);
});
