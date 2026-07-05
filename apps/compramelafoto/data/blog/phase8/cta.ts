import type { CtaAudience } from "@/data/blog/phase8/types";

const CTA_URLS: Record<CtaAudience, string> = {
  fotografos: "https://www.compramelafoto.com",
  organizadores: "https://www.compramelafoto.com/organizador",
  escuelas: "https://www.compramelafoto.com/escuelas",
  clientes: "https://www.compramelafoto.com",
};

const CTA_LABELS: Record<CtaAudience, string> = {
  fotografos: "Crear cuenta de fotógrafo en ComprameLaFoto",
  organizadores: "Registrarme como organizador",
  escuelas: "Conocer soluciones para escuelas",
  clientes: "Buscar mis fotografías",
};

/** Resuelve el público CTA principal según audiencias del artículo. */
export function resolveCtaAudience(audience: string[]): CtaAudience {
  if (audience.includes("escuelas")) return "escuelas";
  if (audience.includes("organizadores")) return "organizadores";
  if (audience.includes("clientes") && !audience.includes("fotografos")) return "clientes";
  return "fotografos";
}

export function buildCtaParagraph(audience: CtaAudience): string {
  const url = CTA_URLS[audience];
  const label = CTA_LABELS[audience];
  return `¿Listo para el siguiente paso? ${label}: ${url}`;
}

export { CTA_URLS, CTA_LABELS };
