import assert from "node:assert/strict";
import test from "node:test";

import { fixedClock } from "@/lib/timeline/clock";
import { revisarEdicion } from "./checks";
import {
  edicionConConsignasEnBorrador,
  edicionConFaseDePrecioVencida,
  edicionSana,
  INSCRIPCION_ABRE,
  MOMENTO_DE_PRUEBA,
} from "./fixtures";

const AHORA = fixedClock(MOMENTO_DE_PRUEBA);

function buscar(hallazgos: ReturnType<typeof revisarEdicion>, id: string) {
  return hallazgos.find((h) => h.id === id);
}

test("una edición sana no tiene hallazgos bloqueantes", () => {
  const hallazgos = revisarEdicion(edicionSana(), AHORA);
  const bloqueantes = hallazgos.filter((h) => h.severidad === "BLOQUEANTE");
  assert.deepEqual(
    bloqueantes.map((h) => h.id),
    [],
    "una edición bien configurada no debería tener nada bloqueante",
  );
});

test("consignas en borrador son bloqueantes y explican la consecuencia", () => {
  const hallazgos = revisarEdicion(edicionConConsignasEnBorrador(), AHORA);
  const hallazgo = buscar(hallazgos, "consignas-en-borrador");
  assert.ok(hallazgo, "falta el hallazgo de consignas en borrador");
  assert.equal(hallazgo.severidad, "BLOQUEANTE");
  assert.match(hallazgo.detalle, /no las libera|no se liberan/i);
});

test("una edición sin ninguna consigna es bloqueante", () => {
  const hallazgos = revisarEdicion(edicionSana({ consignas: [] }), AHORA);
  const hallazgo = buscar(hallazgos, "sin-consignas");
  assert.ok(hallazgo);
  assert.equal(hallazgo.severidad, "BLOQUEANTE");
});

test("las consignas canceladas no cuentan como consignas cargadas", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      consignas: edicionSana().consignas.map((c) => ({ ...c, estado: "CANCELLED" as const })),
    }),
    AHORA,
  );
  assert.ok(buscar(hallazgos, "sin-consignas"));
});

test("la fase de precio que vence antes que la ventana de inscripción es bloqueante", () => {
  const hallazgos = revisarEdicion(edicionConFaseDePrecioVencida(), AHORA);
  const hallazgo = buscar(hallazgos, "fase-de-precio-mas-corta-que-la-ventana");
  assert.ok(hallazgo, "falta el hallazgo de las dos fechas de inscripción");
  assert.equal(hallazgo.severidad, "BLOQUEANTE");
  assert.match(hallazgo.detalle, /dos fechas|fase de precio/i);
});

test("sin ninguna fase de precio no se puede vender una entrada paga", () => {
  const hallazgos = revisarEdicion(edicionSana({ fasesDePrecio: [] }), AHORA);
  const hallazgo = buscar(hallazgos, "sin-fase-de-precio");
  assert.ok(hallazgo);
  assert.equal(hallazgo.severidad, "BLOQUEANTE");
});

test("una edición gratuita no necesita fase de precio", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      fasesDePrecio: [],
      entradas: [{ id: "t1", nombre: "Gratuita", precio: 0, agotada: false, cupo: 300 }],
    }),
    AHORA,
  );
  assert.equal(buscar(hallazgos, "sin-fase-de-precio")?.severidad, "BIEN");
});

test("sin entradas cargadas no se puede inscribir nadie", () => {
  const hallazgos = revisarEdicion(edicionSana({ entradas: [] }), AHORA);
  const hallazgo = buscar(hallazgos, "sin-entradas");
  assert.ok(hallazgo);
  assert.equal(hallazgo.severidad, "BLOQUEANTE");
});

test("todas las entradas agotadas avisan pero no bloquean", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      entradas: [{ id: "t1", nombre: "General", precio: 1_500_000, agotada: true, cupo: 300 }],
    }),
    AHORA,
  );
  assert.equal(buscar(hallazgos, "entradas-agotadas")?.severidad, "ATENCION");
});

test("la captura que cierra después de la subida es bloqueante", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      consignas: [
        {
          id: "c1",
          estado: "READY",
          capturaAbreEl: new Date("2026-10-10T19:00:00.000Z"),
          capturaCierraEl: new Date("2026-10-10T23:00:00.000Z"),
          subidaAbreEl: new Date("2026-10-10T19:00:00.000Z"),
          subidaCierraEl: new Date("2026-10-10T21:00:00.000Z"),
        },
      ],
    }),
    AHORA,
  );
  const hallazgo = buscar(hallazgos, "captura-cierra-despues-que-la-subida");
  assert.ok(hallazgo);
  assert.equal(hallazgo.severidad, "BLOQUEANTE");
});

test("consignas sin ventana de captura avisan", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      consignas: [
        {
          id: "c1",
          estado: "READY",
          capturaAbreEl: null,
          capturaCierraEl: null,
          subidaAbreEl: null,
          subidaCierraEl: null,
        },
      ],
    }),
    AHORA,
  );
  assert.equal(buscar(hallazgos, "sin-ventanas-de-captura")?.severidad, "ATENCION");
});

test("sin cronograma activo es bloqueante", () => {
  const hallazgos = revisarEdicion(edicionSana({ tieneCronogramaActivo: false }), AHORA);
  assert.equal(buscar(hallazgos, "sin-cronograma")?.severidad, "BLOQUEANTE");
});

test("un cronograma que termina antes de empezar es bloqueante", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      comienzaEl: new Date("2026-10-10T23:00:00.000Z"),
      terminaEl: new Date("2026-10-10T19:00:00.000Z"),
    }),
    AHORA,
  );
  assert.equal(buscar(hallazgos, "cronograma-invertido")?.severidad, "BLOQUEANTE");
});

test("edición no publicada avisa pero no bloquea", () => {
  const hallazgos = revisarEdicion(edicionSana({ publicada: false }), AHORA);
  assert.equal(buscar(hallazgos, "edicion-no-publicada")?.severidad, "ATENCION");
});

test("inscripción deshabilitada avisa", () => {
  const hallazgos = revisarEdicion(edicionSana({ inscripcionHabilitada: false }), AHORA);
  assert.equal(buscar(hallazgos, "inscripcion-deshabilitada")?.severidad, "ATENCION");
});

test("Mercado Pago desconectado con entradas pagas es bloqueante", () => {
  const hallazgos = revisarEdicion(edicionSana({ mercadoPagoConectado: false }), AHORA);
  assert.equal(buscar(hallazgos, "mercado-pago-sin-conectar")?.severidad, "BLOQUEANTE");
});

test("Mercado Pago desconectado con edición gratuita no molesta", () => {
  const hallazgos = revisarEdicion(
    edicionSana({
      mercadoPagoConectado: false,
      entradas: [{ id: "t1", nombre: "Gratuita", precio: 0, agotada: false, cupo: 300 }],
    }),
    AHORA,
  );
  assert.equal(buscar(hallazgos, "mercado-pago-sin-conectar")?.severidad, "BIEN");
});

test("sin configuración de subida es bloqueante", () => {
  const hallazgos = revisarEdicion(edicionSana({ hayConfiguracionDeSubida: false }), AHORA);
  assert.equal(buscar(hallazgos, "sin-configuracion-de-subida")?.severidad, "BLOQUEANTE");
});

test("acreditación apagada avisa", () => {
  const hallazgos = revisarEdicion(edicionSana({ acreditacionHabilitada: false }), AHORA);
  assert.equal(buscar(hallazgos, "acreditacion-apagada")?.severidad, "ATENCION");
});

test("la subida apagada es bloqueante aunque la configuración exista", () => {
  const hallazgos = revisarEdicion(
    edicionSana({ hayConfiguracionDeSubida: true, subidaHabilitada: false }),
    AHORA,
  );
  const hallazgo = buscar(hallazgos, "subida-apagada");
  assert.ok(hallazgo, "falta el control del interruptor de subida");
  assert.equal(hallazgo.severidad, "BLOQUEANTE");
  assert.match(hallazgo.detalle, /no pueden? (subir|cargar)/i);
});

test("la subida encendida no se queja", () => {
  const hallazgos = revisarEdicion(edicionSana(), AHORA);
  assert.equal(buscar(hallazgos, "subida-apagada")?.severidad, "BIEN");
});

test("la admisión apagada avisa sin bloquear", () => {
  const hallazgos = revisarEdicion(edicionSana({ admisionHabilitada: false }), AHORA);
  assert.equal(buscar(hallazgos, "admision-apagada")?.severidad, "ATENCION");
});

test("consignas en borrador y subida apagada se reportan como dos problemas distintos", () => {
  const hallazgos = revisarEdicion(
    edicionConConsignasEnBorrador2({ subidaHabilitada: false }),
    AHORA,
  );
  const bloqueantes = hallazgos.filter((h) => h.severidad === "BLOQUEANTE").map((h) => h.id);
  assert.ok(bloqueantes.includes("consignas-en-borrador"));
  assert.ok(bloqueantes.includes("subida-apagada"));
});

function edicionConConsignasEnBorrador2(over: Parameters<typeof edicionSana>[0] = {}) {
  return { ...edicionConConsignasEnBorrador(), ...over };
}

test("la ventana de inscripción ya cerrada avisa cuando la maratón no pasó", () => {
  const hallazgos = revisarEdicion(
    edicionSana({ inscripcionCierraEl: new Date("2026-09-10T23:59:00.000Z") }),
    AHORA,
  );
  assert.equal(buscar(hallazgos, "inscripcion-cerrada")?.severidad, "ATENCION");
});

test("la ventana de inscripción que todavía no abrió se informa sin alarmar", () => {
  const hallazgos = revisarEdicion(
    edicionSana({ inscripcionAbreEl: new Date("2026-09-30T12:00:00.000Z") }),
    AHORA,
  );
  const hallazgo = buscar(hallazgos, "inscripcion-no-abrio");
  assert.ok(hallazgo);
  assert.equal(hallazgo.severidad, "ATENCION");
});

test("todo hallazgo trae título y detalle legibles", () => {
  const hallazgos = revisarEdicion(
    edicionSana({ consignas: [], fasesDePrecio: [], entradas: [] }),
    AHORA,
  );
  assert.ok(hallazgos.length > 0);
  for (const h of hallazgos) {
    assert.ok(h.titulo.trim().length > 0, `el hallazgo ${h.id} no tiene título`);
    assert.ok(h.detalle.trim().length > 0, `el hallazgo ${h.id} no tiene detalle`);
  }
});

test("todo hallazgo que no está bien explica cómo arreglarlo", () => {
  const hallazgos = revisarEdicion(
    edicionSana({ consignas: [], fasesDePrecio: [], publicada: false }),
    AHORA,
  );
  for (const h of hallazgos.filter((x) => x.severidad !== "BIEN")) {
    assert.ok(
      h.comoArreglar && h.comoArreglar.trim().length > 0,
      `el hallazgo ${h.id} no dice cómo arreglarlo`,
    );
  }
});

test("los identificadores de los hallazgos no se repiten", () => {
  const hallazgos = revisarEdicion(edicionSana(), AHORA);
  const ids = hallazgos.map((h) => h.id);
  assert.equal(new Set(ids).size, ids.length, "hay hallazgos con el mismo id");
});

test("el chequeo usa el reloj que se le pasa, no la hora real", () => {
  const antesDeAbrir = fixedClock(new Date("2026-08-01T12:00:00.000Z"));
  const hallazgos = revisarEdicion(
    edicionSana({ inscripcionAbreEl: INSCRIPCION_ABRE }),
    antesDeAbrir,
  );
  assert.equal(buscar(hallazgos, "inscripcion-no-abrio")?.severidad, "ATENCION");
});
