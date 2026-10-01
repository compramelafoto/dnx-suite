import assert from "node:assert/strict";
import test from "node:test";

import { estadoDeFinalizacion, puedeFinalizarAhora } from "./finalizar-entrega";

const base = {
  finalizadaEn: null as Date | null,
  fotosEnviadas: 3,
  entregaAbierta: true,
};

test("con fotos enviadas y la entrega abierta, se puede finalizar", () => {
  assert.equal(estadoDeFinalizacion(base), "PUEDE_FINALIZAR");
  assert.equal(puedeFinalizarAhora(base), true);
});

test("una vez finalizada, queda finalizada", () => {
  const estado = estadoDeFinalizacion({ ...base, finalizadaEn: new Date() });
  assert.equal(estado, "YA_FINALIZADA");
  assert.equal(puedeFinalizarAhora({ ...base, finalizadaEn: new Date() }), false);
});

test("finalizar sigue disponible aunque la ventana ya haya cerrado", () => {
  // Cerrar la ventana no entrega nada: si no declaró, tiene que poder hacerlo.
  assert.equal(estadoDeFinalizacion({ ...base, entregaAbierta: false }), "PUEDE_FINALIZAR");
});

test("sin ninguna foto no se ofrece finalizar", () => {
  assert.equal(estadoDeFinalizacion({ ...base, fotosEnviadas: 0 }), "SIN_FOTOS");
  assert.equal(puedeFinalizarAhora({ ...base, fotosEnviadas: 0 }), false);
});

test("una entrega ya finalizada sin fotos sigue mostrandose como finalizada", () => {
  // El orden importa: lo que ya pasó manda sobre lo que se podria hacer.
  assert.equal(
    estadoDeFinalizacion({ finalizadaEn: new Date(), fotosEnviadas: 0, entregaAbierta: false }),
    "YA_FINALIZADA",
  );
});
