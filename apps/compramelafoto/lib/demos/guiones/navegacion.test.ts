import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  debeMostrarAclaracion,
  indiceValido,
  pasoAnterior,
  siguientePaso,
  ventanaAparteViva,
} from "@/lib/demos/guiones/navegacion";
import { GUION_ESCOLAR } from "@/lib/demos/guiones/escolar";

describe("demos — navegación del guion", () => {
  it("no se pasa de los bordes", () => {
    assert.equal(siguientePaso(0, 3), 1);
    assert.equal(siguientePaso(2, 3), 2);
    assert.equal(pasoAnterior(0), 0);
    assert.equal(pasoAnterior(2), 1);
  });

  it("corrige un índice guardado inválido o viejo", () => {
    assert.equal(indiceValido("4", 10), 4);
    assert.equal(indiceValido("99", 10), 9);
    assert.equal(indiceValido("x", 10), 0);
    assert.equal(indiceValido(-1, 10), 0);
  });

  it("la aclaración sale una sola vez, solo avanzando", () => {
    const paso = { id: "a", aclaracion: { titulo: "t", texto: "x" } };
    assert.equal(debeMostrarAclaracion(paso, new Set(), "adelante"), true);
    assert.equal(debeMostrarAclaracion(paso, new Set(["a"]), "adelante"), false);
    assert.equal(debeMostrarAclaracion(paso, new Set(), "atras"), false);
    assert.equal(debeMostrarAclaracion({ id: "b" }, new Set(), "adelante"), false);
  });

  it("la ventana aparte se da por cerrada si deja de latir", () => {
    assert.equal(ventanaAparteViva(null, 10_000), false);
    assert.equal(ventanaAparteViva(9_000, 10_000), true);
    assert.equal(ventanaAparteViva(5_000, 10_000), false);
  });

  it("el guion escolar tiene ids únicos y rutas armables", () => {
    const ids = GUION_ESCOLAR.pasos.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    const ctx = { albumId: 7, albumSlug: "demo", schoolId: 3, handler: "estudiodemo", ultimoPedidoId: null, plantillaId: null };
    for (const p of GUION_ESCOLAR.pasos) {
      const ruta = p.ruta?.(ctx);
      if (ruta != null) assert.ok(ruta.startsWith("/"), `${p.id}: ${ruta}`);
    }
  });

  it("ningún texto usa el signo $ (en las charlas se dice pesos)", () => {
    for (const p of GUION_ESCOLAR.pasos) {
      assert.ok(!`${p.texto} ${p.aclaracion?.texto ?? ""}`.includes("$"), p.id);
    }
  });
});
