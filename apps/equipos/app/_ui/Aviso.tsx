import type { ReactNode } from "react";

export type TipoAviso = "exito" | "revision" | "error";

function Icono({ tipo }: { tipo: TipoAviso }) {
  const comun = {
    className: "aviso-icono",
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };
  if (tipo === "exito") {
    return (
      <svg {...comun}>
        <circle cx="10" cy="10" r="8.5" />
        <path d="M6 10.4l2.6 2.6L14 7.6" />
      </svg>
    );
  }
  if (tipo === "revision") {
    return (
      <svg {...comun}>
        <circle cx="10" cy="10" r="8.5" />
        <path d="M10 5.5V10l3 2" />
      </svg>
    );
  }
  return (
    <svg {...comun}>
      <path d="M10 2.2l8.3 14.6H1.7z" />
      <path d="M10 8v3.6M10 14.2v.1" />
    </svg>
  );
}

/** Aviso de resultado: dice qué pasó y qué sigue; nunca se disculpa. */
export function Aviso({ tipo, children }: { tipo: TipoAviso; children: ReactNode }) {
  return (
    <div className={`aviso aviso-${tipo}`} role={tipo === "error" ? "alert" : "status"}>
      <Icono tipo={tipo} />
      <div>{children}</div>
    </div>
  );
}
