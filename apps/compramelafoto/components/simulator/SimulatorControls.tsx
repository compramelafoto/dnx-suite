const CONTROLS = [
  { keys: ["W", "A", "S", "D"], action: "Moverse" },
  { keys: ["Mouse"], action: "Mirar" },
  { keys: ["Espacio"], action: "Obturar" },
  { keys: ["Shift"], action: "Caminar rápido" },
  { keys: ["↑", "↓"], action: "Cambiar parámetro" },
  { keys: ["←", "→"], action: "Ajustar valor" },
] as const;

export default function SimulatorControls() {
  return (
    <div className="cod-controls" aria-label="Controles del simulador">
      {CONTROLS.map((control) => (
        <div key={control.action} className="cod-controls__row">
          <span className="cod-controls__keys">
            {control.keys.map((key) => (
              <kbd key={key} className="cod-kbd">
                {key}
              </kbd>
            ))}
          </span>
          <span className="cod-controls__action">{control.action}</span>
        </div>
      ))}
    </div>
  );
}
