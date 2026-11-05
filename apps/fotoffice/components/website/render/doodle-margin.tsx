import { WEBSITE_DOODLES, type WebsiteDoodleId } from "@/lib/website/doodles";

/** Orden de aparición: se van alternando para que dos secciones seguidas no repitan dibujo. */
const SECUENCIA: WebsiteDoodleId[] = ["rulo", "puntos", "espiral", "ondas", "chispa", "garabato"];

/**
 * Un dibujo a mano en el margen de una sección, alternando izquierda y derecha. Solo en pantallas
 * anchas (donde sobra margen); en el celular taparía el contenido. Es decoración: no recibe clics
 * ni lo leen los lectores de pantalla.
 */
export function DoodleMargin({ index }: { index: number }) {
  const id = SECUENCIA[index % SECUENCIA.length];
  const izquierda = index % 2 === 1;
  // Un color fuerte (el de acento) y uno suave (el de los títulos), alternados.
  const color = index % 3 === 0 ? "var(--wsite-accent)" : "var(--wsite-primary)";
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 200 200"
      className={`pointer-events-none absolute top-6 hidden h-28 w-28 xl:block 2xl:h-36 2xl:w-36 ${izquierda ? "left-4 2xl:left-10" : "right-4 2xl:right-10"}`}
      style={{ color, opacity: 0.55, transform: `rotate(${izquierda ? -8 : 7}deg)` }}
    >
      <path d={WEBSITE_DOODLES[id]} fill="currentColor" />
    </svg>
  );
}
