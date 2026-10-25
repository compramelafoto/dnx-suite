/**
 * Puerta de carga de los simuladores: el lienzo no se muestra hasta que bajaron
 * todos los archivos (modelos, texturas, animaciones), no queda ninguna parte de
 * la escena esperando (Suspense) y la placa de video ya compiló todo.
 *
 * Es un almacén chico sin React para que lo usen el lienzo (adentro del Canvas)
 * y la pantalla de carga (afuera) a la vez.
 */

import * as THREE from "three";

export interface LoadingSnapshot {
  /** Archivos pedidos y terminados (bien o mal) desde que arrancó la escena. */
  requested: number;
  finished: number;
  /** Los que ya estaban terminados al arrancar (de una escena anterior). */
  base: number;
  /** Partes de la escena todavía suspendidas. */
  holds: number;
  /** 0–1 de la preparación final (compilar y dibujar los primeros cuadros). */
  warmup: number;
  ready: boolean;
}

/** Peso de la bajada de archivos en la barra; el resto es la preparación. */
const DOWNLOAD_SHARE = 0.85;

/**
 * Porcentaje para la barra (0–100). Nunca marca 100 hasta que la escena está
 * lista, aunque ya no queden archivos: falta compilar y dibujar.
 */
export function loadingPercent(s: LoadingSnapshot): number {
  if (s.ready) return 100;
  const download = s.requested > s.base ? (s.finished - s.base) / (s.requested - s.base) : 0;
  // Mientras haya partes suspendidas, la bajada no está completa aunque los
  // archivos pedidos hasta ahora hayan terminado (pueden venir más).
  const capped = s.holds > 0 ? Math.min(download, 0.97) : download;
  return Math.min(99, Math.floor((capped * DOWNLOAD_SHARE + s.warmup * (1 - DOWNLOAD_SHARE)) * 100));
}

let snapshot: LoadingSnapshot = { requested: 0, finished: 0, base: 0, holds: 0, warmup: 0, ready: false };
const listeners = new Set<() => void>();
const tracked = new WeakSet<THREE.LoadingManager>();

function update(patch: Partial<LoadingSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const l of listeners) l();
}

export const loadingGate = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): LoadingSnapshot {
    return snapshot;
  },
  /** Una escena nueva arranca de cero (al entrar de nuevo al simulador). */
  restart() {
    // Los contadores siguen: puede haber archivos de esta escena ya pedidos.
    // Sólo se descuenta lo que estaba todo terminado de antes.
    const base = snapshot.finished >= snapshot.requested ? snapshot.requested : snapshot.base;
    update({ base, warmup: 0, ready: false });
  },
  /** Cuenta los archivos de un LoadingManager (el de three.js o uno propio). */
  track(manager: THREE.LoadingManager) {
    if (tracked.has(manager)) return;
    tracked.add(manager);
    const start = manager.itemStart.bind(manager);
    const end = manager.itemEnd.bind(manager);
    manager.itemStart = (url) => {
      update({ requested: snapshot.requested + 1 });
      start(url);
    };
    // Un archivo que falla también termina (three.js llama itemError y después itemEnd).
    manager.itemEnd = (url) => {
      update({ finished: snapshot.finished + 1 });
      end(url);
    };
  },
  /** Una parte de la escena suspendida; devuelve cómo soltarla. */
  hold(): () => void {
    update({ holds: snapshot.holds + 1 });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      update({ holds: snapshot.holds - 1 });
    };
  },
  setWarmup(value: number) {
    if (value !== snapshot.warmup) update({ warmup: value });
  },
  markReady() {
    update({ warmup: 1, ready: true });
  },
  /** ¿Terminó la bajada? (nada suspendido y todo lo pedido, terminado). */
  idle(): boolean {
    return snapshot.holds === 0 && snapshot.finished >= snapshot.requested;
  },
};

loadingGate.track(THREE.DefaultLoadingManager);
