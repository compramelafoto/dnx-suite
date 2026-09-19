/**
 * Self-check del ensayo de edición en seco.
 *
 * La prueba que le da sentido a toda la herramienta: una edición sana recorre
 * los diez pasos, y cada rotura conocida corta el recorrido en el paso exacto
 * donde la cortaría en la vida real. Si el ensayo no detecta las roturas que ya
 * ocurrieron de verdad, no sirve para nada.
 *
 *   pnpm --filter clickaton selfcheck:edition-rehearsal
 */

import assert from "node:assert/strict";
import { fixedClock } from "@/lib/timeline/clock";
import { correrPasosEnSeco } from "@/lib/edition-rehearsal/application/dry-run-steps";
import {
  COMIENZA,
  edicionConConsignasEnBorrador,
  edicionConFaseDePrecioVencida,
  edicionSana,
} from "@/lib/edition-rehearsal/domain/fixtures";
import type { FotoDeEdicion, ResultadoPaso } from "@/lib/edition-rehearsal/domain/types";

/** En plena maratón: consignas abiertas y ventana de subida activa. */
const EN_PLENA_MARATON = fixedClock(new Date("2026-10-10T20:00:00.000Z"));
/** Antes de que abra la inscripción. */
const MUY_ANTES = fixedClock(new Date("2026-08-01T12:00:00.000Z"));
/** Con la inscripción abierta pero la maratón todavía lejos. */
const DURANTE_LA_VENTA = fixedClock(new Date("2026-09-19T15:00:00.000Z"));

/** Modo recorrido: cada paso en el momento en que de verdad ocurriría. */
async function correr(foto: FotoDeEdicion, clock: ReturnType<typeof fixedClock>) {
  return correrPasosEnSeco({ foto, clock, modo: "RECORRIDO" });
}

/** Modo instante: qué le pasa a alguien que entra exactamente a esa hora. */
async function correrParadoEn(foto: FotoDeEdicion, clock: ReturnType<typeof fixedClock>) {
  return correrPasosEnSeco({ foto, clock, modo: "INSTANTE" });
}

function numerosConEstado(pasos: ResultadoPaso[], estado: ResultadoPaso["estado"]): number[] {
  return pasos.filter((p) => p.estado === estado).map((p) => p.numero);
}

async function main() {
  // 1) Una edición sana, en plena maratón: los diez pasos funcionan.
  {
    const pasos = await correr(edicionSana(), EN_PLENA_MARATON);
    assert.equal(pasos.length, 10, "el recorrido tiene que tener diez pasos");
    assert.deepEqual(
      pasos.map((p) => p.numero),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      "los pasos tienen que venir numerados del 1 al 10",
    );
    assert.deepEqual(
      numerosConEstado(pasos, "FALLO"),
      [],
      "una edición sana no debería fallar ningún paso",
    );
  }

  // 2) La rotura de las consignas en borrador: corta exactamente en el paso 8.
  {
    const pasos = await correr(edicionConConsignasEnBorrador(), EN_PLENA_MARATON);
    const fallidos = numerosConEstado(pasos, "FALLO");
    assert.ok(
      fallidos.includes(8),
      `las consignas en borrador tienen que romper el paso 8, y fallaron: ${fallidos.join(", ") || "ninguno"}`,
    );
    const paso8 = pasos.find((p) => p.numero === 8);
    assert.match(
      paso8?.detalle ?? "",
      /borrador/i,
      "el paso 8 tiene que explicar que la causa es el borrador",
    );
    assert.ok(paso8?.comoArreglar, "el paso 8 tiene que decir cómo arreglarlo");
  }

  // 3) La rotura de las dos fechas: con la fase vencida no se puede vender.
  {
    const despuesDeLaFase = fixedClock(new Date("2026-10-01T12:00:00.000Z"));
    const pasos = await correrParadoEn(edicionConFaseDePrecioVencida(), despuesDeLaFase);
    const paso2 = pasos.find((p) => p.numero === 2);
    assert.ok(paso2, "falta el paso 2");
    assert.notEqual(
      paso2.estado,
      "PASO",
      "con la fase de precio vencida la inscripción no debería completarse",
    );
  }

  // 4) Antes de que abra: no es un error, es un "todavía no".
  {
    const pasos = await correrParadoEn(edicionSana(), MUY_ANTES);
    assert.deepEqual(
      numerosConEstado(pasos, "FALLO"),
      [1],
      "antes de abrir, lo único que no corresponde es la página ofreciendo inscripción",
    );
    assert.ok(
      numerosConEstado(pasos, "NO_CORRESPONDE").length > 0,
      "los pasos posteriores tienen que quedar en «todavía no»",
    );
  }

  // 5) Con la inscripción abierta pero la maratón lejos: se inscribe y espera.
  {
    const pasos = await correrParadoEn(edicionSana(), DURANTE_LA_VENTA);
    assert.equal(pasos.find((p) => p.numero === 2)?.estado, "PASO", "debería poder inscribirse");
    assert.equal(
      pasos.find((p) => p.numero === 8)?.estado,
      "NO_CORRESPONDE",
      "las consignas todavía no abrieron, no es un error",
    );
  }

  // 6) La subida apagada corta el paso 9 aunque todo lo demás esté bien.
  {
    const pasos = await correr(edicionSana({ subidaHabilitada: false }), EN_PLENA_MARATON);
    const fallidos = numerosConEstado(pasos, "FALLO");
    assert.ok(fallidos.includes(9), "la subida apagada tiene que romper el paso 9");
    assert.equal(
      pasos.find((p) => p.numero === 8)?.estado,
      "PASO",
      "las consignas se abren igual: el problema es sólo la subida",
    );
  }

  // 7) Mercado Pago desconectado con entradas pagas: corta en el pago.
  {
    const pasos = await correr(edicionSana({ mercadoPagoConectado: false }), EN_PLENA_MARATON);
    assert.equal(
      pasos.find((p) => p.numero === 3)?.estado,
      "FALLO",
      "sin cuenta de cobro el pago tiene que fallar",
    );
    assert.equal(
      pasos.find((p) => p.numero === 4)?.estado,
      "NO_CORRESPONDE",
      "sin pago no se manda el correo de confirmación",
    );
  }

  // 8) Acreditación apagada: corta en la puerta, no antes.
  {
    const pasos = await correr(edicionSana({ acreditacionHabilitada: false }), EN_PLENA_MARATON);
    assert.equal(pasos.find((p) => p.numero === 5)?.estado, "PASO", "la credencial se emite igual");
    assert.equal(
      pasos.find((p) => p.numero === 6)?.estado,
      "FALLO",
      "con la acreditación apagada el escáner no deja pasar",
    );
  }

  // 9) Una edición gratuita no necesita Mercado Pago para completar el recorrido.
  {
    const gratuita = edicionSana({
      mercadoPagoConectado: false,
      entradas: [
        { id: "t1", codigo: "FREE", nombre: "Gratuita", precio: 0, agotada: false, cupo: 300 },
      ],
      fasesDePrecio: [],
    });
    const pasos = await correr(gratuita, EN_PLENA_MARATON);
    assert.deepEqual(
      numerosConEstado(pasos, "FALLO"),
      [],
      "una edición gratuita bien configurada no debería fallar ningún paso",
    );
  }

  // 10) Después de que cerró todo: la subida ya no corresponde.
  {
    const despues = fixedClock(new Date("2026-10-11T02:00:00.000Z"));
    const pasos = await correrParadoEn(edicionSana(), despues);
    assert.equal(
      pasos.find((p) => p.numero === 9)?.estado,
      "NO_CORRESPONDE",
      "con la ventana cerrada, subir no es un error: es que ya no corresponde",
    );
  }

  // 11) Cada paso se explica solo: nada de textos vacíos.
  {
    const pasos = await correr(edicionSana(), EN_PLENA_MARATON);
    for (const p of pasos) {
      assert.ok(p.nombre.trim().length > 0, `el paso ${p.numero} no tiene nombre`);
      assert.ok(p.queVeria.trim().length > 0, `el paso ${p.numero} no dice qué vería la persona`);
      assert.ok(p.detalle.trim().length > 0, `el paso ${p.numero} no tiene detalle`);
    }
    for (const p of pasos.filter((x) => x.estado === "FALLO")) {
      assert.ok(p.comoArreglar, `el paso ${p.numero} falló y no dice cómo arreglarlo`);
    }
  }

  // 12) El ensayo respeta el reloj: el mismo dato da resultados distintos.
  {
    const antes = await correrParadoEn(edicionSana(), fixedClock(new Date(COMIENZA.getTime() - 60_000)));
    const despues = await correrParadoEn(edicionSana(), fixedClock(new Date(COMIENZA.getTime() + 60_000)));
    assert.equal(antes.find((p) => p.numero === 8)?.estado, "NO_CORRESPONDE");
    assert.equal(despues.find((p) => p.numero === 8)?.estado, "PASO");
  }

  console.log("edition-rehearsal.selfcheck: OK");
}

await main();
