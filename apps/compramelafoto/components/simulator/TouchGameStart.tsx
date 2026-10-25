"use client";

import { loadingGate } from "@/lib/simulator/loading-gate";
import { unlockSimulatorAudioFromGesture } from "@/lib/simulator/sound-engine";
import { useState, useSyncExternalStore } from "react";

/** Pide pantalla completa y bloquea la pantalla en horizontal (donde el navegador lo permite). */
async function enterGameScreen() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: "hide" });
    }
  } catch {
    // iPhone no deja poner una página en pantalla completa: se juega igual.
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await orientation.lock?.("landscape");
  } catch {
    // Sin bloqueo de orientación: el aviso de girar el teléfono alcanza.
  }
}

/**
 * Celular: al terminar de cargar, "Tocá para jugar" (pantalla completa y
 * horizontal); con el teléfono parado, un aviso para girarlo.
 */
export default function TouchGameStart() {
  const ready = useSyncExternalStore(loadingGate.subscribe, () => loadingGate.getSnapshot().ready, () => false);
  const [started, setStarted] = useState(false);

  return (
    <>
      <div className="cod-touch-rotate" role="status">
        <div className="cod-touch-rotate__phone" aria-hidden="true" />
        <p>Girá el celular para jugar</p>
        <span>Cam Of Duty se juega con el teléfono acostado</span>
      </div>
      {ready && !started ? (
        <div className="cod-touch-start">
          <button
            type="button"
            className="cod-touch-start__btn"
            onClick={() => {
              unlockSimulatorAudioFromGesture();
              void enterGameScreen();
              setStarted(true);
            }}
          >
            Tocá para jugar
          </button>
          <ul className="cod-touch-start__help">
            <li>Pulgar izquierdo: caminar (al borde, correr)</li>
            <li>Arrastrar a la derecha: mirar · tocar: enfocar</li>
            <li>Botón blanco: sacar la foto · arriba a la izquierda: ajustes de cámara</li>
          </ul>
        </div>
      ) : null}
    </>
  );
}
