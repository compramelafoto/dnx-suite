import { atributo, buscar, buscarTodos, parsearHtml, textoConSaltos, textoDe } from "./dom";
import { mejorUrlDeImagen } from "./fotos";

/**
 * Los testimonios de la portada de Alboom (`figure.testimonial-section`). Cada uno tiene nombre
 * (`cite.tsa__cite`), texto (`p.tsc__text`, con los saltos de línea que escribió el autor), foto
 * opcional y un enlace opcional (el `cite` del `blockquote`). Cuando el enlace es a un trabajo del
 * mismo sitio (`/portfolio/...`, `/album.php?id=`, `/gallery/...`), va también en
 * `trabajoAlboomUrl` para poder unir el testimonio con el trabajo importado.
 */
export type TestimonioAlboom = {
  nombre: string;
  texto: string;
  fotoUrl: string | null;
  enlace: string | null;
  trabajoAlboomUrl: string | null;
};

const HOST_PROPIO = /^(?:www\.)?dnxfotografia\.com\.ar$/i;

export function esUrlDeTrabajoAlboom(url: string): boolean {
  try {
    const u = new URL(url);
    if (!HOST_PROPIO.test(u.hostname)) return false;
    return /^\/portfolio\/[^/]+\/\d+-/i.test(u.pathname) || /^\/gallery\/\d+-/i.test(u.pathname) || (/^\/album\.php$/i.test(u.pathname) && /^\d+$/.test(u.searchParams.get("id") ?? ""));
  } catch {
    return false;
  }
}

function limpiarEnlace(v: string | null): string | null {
  const t = v?.trim();
  return t && /^https?:\/\//i.test(t) ? t : null;
}

export function leerTestimonios(htmlPortada: string): TestimonioAlboom[] {
  const raiz = parsearHtml(htmlPortada);
  const out: TestimonioAlboom[] = [];
  for (const fig of buscarTodos(raiz, "figure.testimonial-section")) {
    const nombre = textoDe(buscar(fig, "cite.tsa__cite"));
    const texto = textoConSaltos(buscar(fig, ".tsc__text"));
    if (!nombre || !texto) continue;
    const img = buscar(fig, ".ts__image img") ?? buscar(fig, "img");
    const enlace = limpiarEnlace(atributo(buscar(fig, "blockquote"), "cite")) ?? limpiarEnlace(atributo(buscar(fig, "cite.tsa__cite a"), "href"));
    out.push({
      nombre,
      texto,
      fotoUrl: img ? mejorUrlDeImagen(img) : null,
      enlace,
      trabajoAlboomUrl: enlace && esUrlDeTrabajoAlboom(enlace) ? enlace : null,
    });
  }
  return out;
}
