import type { TrustLevel } from "@/lib/publicaciones/confianza";

const NIVELES: { level: TrustLevel; nombre: string }[] = [
  { level: "BASICO", nombre: "Básico" },
  { level: "BUENO", nombre: "Bueno" },
  { level: "ALTO", nombre: "Alto" },
  { level: "MAXIMO", nombre: "Máximo" },
];

/** Escala del visor: los números caen en los bordes de los cuatro tramos. */
const ESCALA = ["−2", "·", "·", "−1", "·", "·", "0", "·", "·", "+1", "·", "·", "+2"];

export function nombreDelNivel(level: TrustLevel): string {
  return NIVELES.find((n) => n.level === level)?.nombre ?? level;
}

/**
 * Nivel de confianza dibujado como el indicador de exposición del visor: la única pieza llamativa
 * del portal. Lo visual es decorativo; la información la llevan `role="meter"` y el texto.
 */
export function MedidorConfianza({
  level,
  size = "chico",
}: {
  level: TrustLevel;
  size?: "chico" | "grande";
}) {
  const actual = NIVELES.findIndex((n) => n.level === level) + 1;
  const nombre = nombreDelNivel(level);
  const grande = size === "grande";

  return (
    <div
      className={grande ? "medidor medidor-grande" : "medidor medidor-chico"}
      role="meter"
      aria-label="Nivel de confianza"
      aria-valuemin={1}
      aria-valuemax={4}
      aria-valuenow={actual}
      aria-valuetext={`${nombre}, ${actual} de 4`}
    >
      <div className="medidor-visor" aria-hidden="true">
        {grande ? (
          <div className="medidor-escala">
            {ESCALA.map((s, i) => (
              <span key={i}>{s}</span>
            ))}
          </div>
        ) : null}
        <div className="medidor-tramos">
          {NIVELES.map((n, i) => (
            <span
              key={n.level}
              className="medidor-tramo"
              data-encendido={i < actual ? "true" : "false"}
              data-actual={i + 1 === actual ? "true" : "false"}
            />
          ))}
        </div>
        {grande ? (
          <div className="medidor-nombres">
            {NIVELES.map((n, i) => (
              <span
                key={n.level}
                className="medidor-nombre"
                data-actual-nombre={i + 1 === actual ? "true" : undefined}
              >
                {n.nombre}
              </span>
            ))}
          </div>
        ) : null}
      </div>
      <span className="medidor-nivel">{nombre}</span>
    </div>
  );
}
