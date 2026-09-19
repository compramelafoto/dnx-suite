import assert from "node:assert/strict";
import test from "node:test";

import { nuevaEntrada, type EntradaOffline } from "./offline-queue";
import { vaciarCola, type RespuestaEnvio, type Transporte } from "./offline-sync";

const AHORA = new Date("2026-09-20T13:00:00.000Z");

function entrada(clave: string, qr: string, parcial: Partial<EntradaOffline> = {}): EntradaOffline {
  return {
    ...nuevaEntrada({
      qr,
      registrationIdHint: null,
      etiqueta: `QR …${qr}`,
      deviceId: "dev-1",
      ahora: AHORA,
      clave,
    }),
    ...parcial,
  };
}

/** Transporte de mentira: registra qué se envió y contesta lo que le pidamos. */
function transporteFalso(opciones: {
  envios?: Record<string, RespuestaEnvio>;
  proceso?: Awaited<ReturnType<Transporte["procesar"]>>;
}) {
  const enviados: string[] = [];
  let vecesProcesado = 0;
  const transporte: Transporte = {
    enviar: async (e) => {
      enviados.push(e.idempotencyKey);
      return opciones.envios?.[e.idempotencyKey] ?? { ok: true, id: `evt-${e.idempotencyKey}` };
    },
    procesar: async () => {
      vecesProcesado += 1;
      return opciones.proceso ?? { ok: true, resultados: [] };
    },
  };
  return { transporte, enviados, vecesProcesado: () => vecesProcesado };
}

test("sin pendientes no molesta al servidor", async () => {
  const doble = transporteFalso({});
  const r = await vaciarCola([entrada("a", "QR-A", { estado: "SINCRONIZADA" })], doble.transporte);
  assert.deepEqual(doble.enviados, []);
  assert.equal(doble.vecesProcesado(), 0);
  assert.equal(r.mensaje, null);
});

test("sube cada pendiente y las deja acreditadas", async () => {
  const doble = transporteFalso({
    proceso: {
      ok: true,
      resultados: [
        { id: "evt-a", syncStatus: "SYNCED" },
        { id: "evt-b", syncStatus: "SYNCED" },
      ],
    },
  });
  const r = await vaciarCola([entrada("a", "QR-A"), entrada("b", "QR-B")], doble.transporte);
  assert.deepEqual(doble.enviados, ["a", "b"]);
  assert.deepEqual(
    r.cola.map((e) => e.estado),
    ["SINCRONIZADA", "SINCRONIZADA"],
  );
});

test("no vuelve a subir lo que el servidor ya tiene", async () => {
  const doble = transporteFalso({});
  await vaciarCola(
    [entrada("a", "QR-A", { eventoServidorId: "evt-a" }), entrada("b", "QR-B")],
    doble.transporte,
  );
  assert.deepEqual(doble.enviados, ["b"], "la que ya tenía id no se reenvía");
});

test("un evento que el servidor rechaza al recibirlo no se reintenta para siempre", async () => {
  const doble = transporteFalso({
    envios: { a: { ok: false, motivo: "OFFLINE_DISABLED" } },
  });
  const r = await vaciarCola([entrada("a", "QR-A")], doble.transporte);
  const primera = r.cola[0];
  assert.ok(primera);
  assert.equal(primera.estado, "RECHAZADA");
  assert.equal(primera.motivo, "OFFLINE_DISABLED");
});

test("si una falla al subir, las demás igual suben", async () => {
  const doble = transporteFalso({
    envios: { a: { ok: false, motivo: "HTTP_400" } },
    proceso: { ok: true, resultados: [{ id: "evt-b", syncStatus: "SYNCED" }] },
  });
  const r = await vaciarCola([entrada("a", "QR-A"), entrada("b", "QR-B")], doble.transporte);
  assert.deepEqual(
    r.cola.map((e) => e.estado),
    ["RECHAZADA", "SINCRONIZADA"],
  );
});

test("si el procesamiento falla, lo subido queda pendiente para el próximo intento", async () => {
  const doble = transporteFalso({
    proceso: { ok: false, motivo: "No se pudo sincronizar." },
  });
  const r = await vaciarCola([entrada("a", "QR-A")], doble.transporte);
  const primera = r.cola[0];
  assert.ok(primera);
  assert.equal(primera.estado, "PENDIENTE");
  assert.equal(primera.eventoServidorId, "evt-a", "conserva el id para no duplicar el envío");
  assert.equal(r.mensaje, "No se pudo sincronizar.");
});

test("un conflicto del servidor llega al operador con su motivo", async () => {
  const doble = transporteFalso({
    proceso: {
      ok: true,
      resultados: [{ id: "evt-a", syncStatus: "CONFLICT", reason: "ALREADY_CHECKED_IN" }],
    },
  });
  const r = await vaciarCola([entrada("a", "QR-A")], doble.transporte);
  const primera = r.cola[0];
  assert.ok(primera);
  assert.equal(primera.estado, "CONFLICTO");
  assert.equal(primera.motivo, "ALREADY_CHECKED_IN");
});
