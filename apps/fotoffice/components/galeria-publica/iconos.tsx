import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>) => ({ width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true, ...p });

export const IconoCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
export const IconoCerrar = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>
);
export const IconoFlechaIzq = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M15 5l-7 7 7 7" /></svg>
);
export const IconoFlechaDer = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M9 5l7 7-7 7" /></svg>
);
export const IconoComentario = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 5h16v11H9l-5 4z" /></svg>
);
export const IconoDescarga = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M12 4v11m0 0l-4-4m4 4l4-4M5 20h14" /></svg>
);
