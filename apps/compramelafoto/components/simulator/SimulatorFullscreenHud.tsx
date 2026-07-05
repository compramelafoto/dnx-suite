"use client";

export interface SimulatorFullscreenHudProps {
  onOpenHelp: () => void;
}

/** Botón de ayuda mínimo en pantalla completa (abajo a la derecha). */
export default function SimulatorFullscreenHud({ onOpenHelp }: SimulatorFullscreenHudProps) {
  return (
    <button
      type="button"
      className="cod-fs-hud__help"
      onClick={onOpenHelp}
      aria-label="Abrir ayuda de controles"
      title="Ayuda (?)"
    >
      ?
    </button>
  );
}
