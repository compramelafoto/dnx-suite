import assert from "node:assert/strict";
import test from "node:test";

import {
  agregarPendiente,
  aplicarResultadosDeSincronizacion,
  contarSinResolver,
  esFalloDeConexion,
  fusionarActualizaciones,
  leerAparato,
  leerCola,
  marcarEnviada,
  nuevaEntrada,
  purgarSincronizadas,
  quitarEntrada,
  guardarAparato,
  guardarCola,
  resumenDeCola,
  type EntradaOffline,
} from "./offline-queue";

const AHORA = new Date("2026-09-20T13:00:00.000Z");

function entrada(parcial: Partial<EntradaOffline> = {}): EntradaOffline {
  return {
    ...nuevaEntrada({
      qr: "QR-AAA",
      registrationIdHint: null,
      etiqueta: "QR …AAA",
      deviceId: "dev-1",
      ahora: AHORA,
      clave: "clave-1",
    }),
    ...parcial,
  };
}

/** La primera entrada de la cola, exigiendo que exista. */
function primera(cola: EntradaOffline[]): EntradaOffline {
  const e = cola[0];
  assert.ok(e, "la cola no debería estar vacía");
  return e;
}

/** Un localStorage de mentira, para probar sin navegador. */
function almacenFalso(inicial: Record<string, string> = {}) {
  const datos = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => datos.get(k) ?? null,
    setItem: (k: string, v: string) => void datos.set(k, v),
    removeItem: (k: string) => void datos.delete(k),
    ver: () => Object.fromEntries(datos),
  };
}

test("una entrada nueva nace pendiente y con la hora del escaneo", () => {
  const e = entrada();
  assert.equal(e.estado, "PENDIENTE");
  assert.equal(e.clientOccurredAt, AHORA.toISOString());
  assert.equal(e.idempotencyKey, "clave-1");
  assert.equal(e.eventoServidorId, null);
});

test("el mismo QR no se encola dos veces: en la puerta se re-escanea solo", () => {
  const inicial = agregarPendiente([], entrada());
  assert.equal(inicial.agregada, true);

  const segunda = agregarPendiente(
    inicial.cola,
    entrada({ idempotencyKey: "clave-2" }),
  );
  assert.equal(segunda.agregada, false, "no debe duplicar el mismo QR pendiente");
  assert.equal(segunda.cola.length, 1);
});

test("un QR ya sincronizado sí se puede volver a encolar", () => {
  const cola = [entrada({ estado: "SINCRONIZADA" })];
  const { agregada } = agregarPendiente(cola, entrada({ idempotencyKey: "clave-2" }));
  assert.equal(agregada, true);
});

test("dos participantes distintos conviven en la cola", () => {
  const uno = agregarPendiente([], entrada());
  const dos = agregarPendiente(
    uno.cola,
    entrada({ idempotencyKey: "clave-2", qr: "QR-BBB" }),
  );
  assert.equal(dos.cola.length, 2);
});

test("no duplica por participante cuando la confirmación se cayó sin QR", () => {
  const base = entrada({ qr: null, registrationIdHint: "reg-9" });
  const uno = agregarPendiente([], base);
  const dos = agregarPendiente(
    uno.cola,
    entrada({ idempotencyKey: "clave-2", qr: null, registrationIdHint: "reg-9" }),
  );
  assert.equal(dos.agregada, false);
  assert.equal(dos.cola.length, 1);
});

test("el número tipeado a mano también se guarda y no se duplica", () => {
  const base = entrada({ qr: null, shortCode: "1234567" });
  const uno = agregarPendiente([], base);
  assert.equal(uno.agregada, true);
  assert.equal(primera(uno.cola).shortCode, "1234567");

  const dos = agregarPendiente(
    uno.cola,
    entrada({ idempotencyKey: "clave-2", qr: null, shortCode: "1234567" }),
  );
  assert.equal(dos.agregada, false);
});

test("marcarEnviada guarda el id del servidor para poder leer el resultado", () => {
  const cola = marcarEnviada([entrada()], "clave-1", "evt-1");
  assert.equal(primera(cola).eventoServidorId, "evt-1");
  assert.equal(primera(cola).estado, "PENDIENTE", "sigue pendiente hasta que el servidor la procese");
});

test("el resultado del servidor se aplica por id de evento", () => {
  const cola = marcarEnviada([entrada()], "clave-1", "evt-1");
  const aplicada = aplicarResultadosDeSincronizacion(cola, [
    { id: "evt-1", syncStatus: "SYNCED" },
  ]);
  assert.equal(primera(aplicada).estado, "SINCRONIZADA");
  assert.equal(primera(aplicada).motivo, null);
});

test("un conflicto queda marcado con su motivo, no se borra", () => {
  const cola = marcarEnviada([entrada()], "clave-1", "evt-1");
  const aplicada = aplicarResultadosDeSincronizacion(cola, [
    { id: "evt-1", syncStatus: "CONFLICT", reason: "ALREADY_CHECKED_IN" },
  ]);
  assert.equal(primera(aplicada).estado, "CONFLICTO");
  assert.equal(primera(aplicada).motivo, "ALREADY_CHECKED_IN");
});

test("un rechazo del servidor queda visible para resolverlo a mano", () => {
  const cola = marcarEnviada([entrada()], "clave-1", "evt-1");
  const aplicada = aplicarResultadosDeSincronizacion(cola, [
    { id: "evt-1", syncStatus: "REJECTED", reason: "QR_INVALID" },
  ]);
  assert.equal(primera(aplicada).estado, "RECHAZADA");
  assert.equal(primera(aplicada).motivo, "QR_INVALID");
});

test("un resultado de otro aparato no toca mis entradas", () => {
  const cola = marcarEnviada([entrada()], "clave-1", "evt-1");
  const aplicada = aplicarResultadosDeSincronizacion(cola, [
    { id: "evt-ajeno", syncStatus: "SYNCED" },
  ]);
  assert.equal(primera(aplicada).estado, "PENDIENTE");
});

test("el contador sin resolver suma pendientes, conflictos y rechazos", () => {
  const cola = [
    entrada({ idempotencyKey: "a" }),
    entrada({ idempotencyKey: "b", qr: "QR-B", estado: "SINCRONIZADA" }),
    entrada({ idempotencyKey: "c", qr: "QR-C", estado: "CONFLICTO" }),
    entrada({ idempotencyKey: "d", qr: "QR-D", estado: "RECHAZADA" }),
  ];
  assert.equal(contarSinResolver(cola), 3);
  assert.deepEqual(resumenDeCola(cola), {
    pendientes: 1,
    sincronizadas: 1,
    conflictos: 1,
    rechazadas: 1,
  });
});

test("lo escaneado durante la sincronización no se pierde", () => {
  const vieja = entrada({ idempotencyKey: "a" });
  const recienEscaneada = entrada({ idempotencyKey: "z", qr: "QR-Z" });
  const actual = [vieja, recienEscaneada];
  const resultadoDeLaSincronizacion = [{ ...vieja, estado: "SINCRONIZADA" as const }];

  const fusionada = fusionarActualizaciones(actual, resultadoDeLaSincronizacion);
  assert.equal(fusionada.length, 2, "la nueva sobrevive");
  assert.equal(primera(fusionada).estado, "SINCRONIZADA");
  assert.equal(fusionada[1]?.estado, "PENDIENTE");
});

test("una entrada que el operador quitó no revive al sincronizar", () => {
  const quitada = entrada({ idempotencyKey: "a", estado: "SINCRONIZADA" });
  const fusionada = fusionarActualizaciones([], [quitada]);
  assert.deepEqual(fusionada, []);
});

test("purgar deja sólo lo que todavía necesita atención", () => {
  const cola = [
    entrada({ idempotencyKey: "a", estado: "SINCRONIZADA" }),
    entrada({ idempotencyKey: "b", qr: "QR-B", estado: "CONFLICTO" }),
  ];
  const purgada = purgarSincronizadas(cola);
  assert.equal(purgada.length, 1);
  assert.equal(primera(purgada).idempotencyKey, "b");
});

test("quitar una entrada la saca por su clave", () => {
  const cola = [entrada({ idempotencyKey: "a" }), entrada({ idempotencyKey: "b", qr: "QR-B" })];
  assert.deepEqual(
    quitarEntrada(cola, "a").map((e) => e.idempotencyKey),
    ["b"],
  );
});

test("la cola sobrevive a la recarga de la página", () => {
  const almacen = almacenFalso();
  guardarCola("ed-1", [entrada()], almacen);
  const leida = leerCola("ed-1", almacen);
  assert.equal(leida.length, 1);
  assert.equal(primera(leida).qr, "QR-AAA");
});

test("cada edición tiene su propia cola", () => {
  const almacen = almacenFalso();
  guardarCola("ed-1", [entrada()], almacen);
  assert.deepEqual(leerCola("ed-2", almacen), []);
});

test("un almacenamiento con basura no rompe el escáner", () => {
  const almacen = almacenFalso({
    "clickaton.acreditacion.cola.ed-1": "{no es json",
  });
  assert.deepEqual(leerCola("ed-1", almacen), []);
});

test("descarta entradas mal formadas en vez de arrastrarlas", () => {
  const almacen = almacenFalso({
    "clickaton.acreditacion.cola.ed-1": JSON.stringify([
      { idempotencyKey: "ok", clientOccurredAt: AHORA.toISOString(), qr: "QR", estado: "PENDIENTE" },
      { sinClave: true },
      "texto suelto",
    ]),
  });
  const cola = leerCola("ed-1", almacen);
  assert.equal(cola.length, 1);
  assert.equal(primera(cola).idempotencyKey, "ok");
});

test("un almacenamiento que no deja escribir no tumba la acreditación", () => {
  const roto = {
    getItem: () => null,
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
    removeItem: () => {},
  };
  assert.doesNotThrow(() => guardarCola("ed-1", [entrada()], roto));
});

test("el aparato elegido se recuerda por edición", () => {
  const almacen = almacenFalso();
  guardarAparato("ed-1", "dev-7", almacen);
  assert.equal(leerAparato("ed-1", almacen), "dev-7");
  assert.equal(leerAparato("ed-2", almacen), null);
  guardarAparato("ed-1", null, almacen);
  assert.equal(leerAparato("ed-1", almacen), null);
});

test("un fetch caído por red se reconoce como falta de conexión", () => {
  assert.equal(esFalloDeConexion(new TypeError("Failed to fetch")), true);
  assert.equal(esFalloDeConexion(new TypeError("Load failed")), true);
  assert.equal(esFalloDeConexion(new DOMException("aborted", "AbortError")), true);
});

test("un error del servidor no se confunde con falta de conexión", () => {
  assert.equal(esFalloDeConexion(new Error("REGISTRATION_REQUIRED")), false);
  assert.equal(esFalloDeConexion(null), false);
});
