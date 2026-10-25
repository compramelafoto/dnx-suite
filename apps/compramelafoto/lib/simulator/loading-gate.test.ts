import assert from "node:assert/strict";
import { test } from "node:test";
import * as THREE from "three";
import { loadingGate, loadingPercent, type LoadingSnapshot } from "./loading-gate";

const snap = (p: Partial<LoadingSnapshot>): LoadingSnapshot => ({ requested: 0, finished: 0, base: 0, holds: 0, warmup: 0, ready: false, ...p });

test("barra: nunca llega a 100 hasta que la escena está lista", () => {
  assert.equal(loadingPercent(snap({})), 0);
  assert.equal(loadingPercent(snap({ requested: 10, finished: 5 })), 42);
  // Todo bajado pero falta compilar: se queda en la parte de la bajada.
  assert.equal(loadingPercent(snap({ requested: 10, finished: 10 })), 85);
  assert.equal(loadingPercent(snap({ requested: 10, finished: 10, warmup: 1 })), 99);
  assert.equal(loadingPercent(snap({ requested: 10, finished: 10, ready: true })), 100);
});

test("barra: con partes suspendidas no da la bajada por completa", () => {
  assert.ok(loadingPercent(snap({ requested: 4, finished: 4, holds: 1 })) < 85);
});

test("barra: al volver a entrar no cuenta lo que ya estaba bajado", () => {
  assert.equal(loadingPercent(snap({ requested: 30, finished: 30, base: 30 })), 0);
  assert.equal(loadingPercent(snap({ requested: 40, finished: 35, base: 30 })), 42);
});

test("puerta: cuenta los archivos de un LoadingManager y las partes suspendidas", () => {
  const manager = new THREE.LoadingManager();
  loadingGate.restart();
  loadingGate.track(manager);
  const start = loadingGate.getSnapshot().requested;
  manager.itemStart("a.glb");
  manager.itemStart("b.glb");
  assert.equal(loadingGate.idle(), false);
  manager.itemEnd("a.glb");
  manager.itemError("b.glb");
  manager.itemEnd("b.glb");
  assert.equal(loadingGate.getSnapshot().requested - start, 2);
  assert.equal(loadingGate.idle(), true);
  const release = loadingGate.hold();
  assert.equal(loadingGate.idle(), false);
  release();
  release();
  assert.equal(loadingGate.getSnapshot().holds, 0);
  loadingGate.markReady();
  assert.equal(loadingPercent(loadingGate.getSnapshot()), 100);
});
