/**
 * El botón de una campaña libre es una dirección cualquiera. Si apunta a un artículo del blog de la
 * propia institución que todavía no es público, el socio llega a una página inexistente (pasó en la
 * SFPR el 20/10/2026: la campaña salía antes que el artículo programado). Módulo puro.
 */

export type BlogSite = {
  /** Dirección pública de FOTOFFICE, p. ej. `https://fotoffice.com` (los sitios viven en `/w/<slug>`). */
  appBase: string | null;
  /** `publicSlug` de la institución. */
  publicSlug: string | null;
  /** Dominio propio sin `www.` (p. ej. `sfpr.com.ar`), conectado o no: el enlace se arma igual. */
  domain: string | null;
};

export type LinkedPost = { title: string; status: string; publishedAt: Date | null };

/** Por qué el artículo no se puede ver en `at`. null = se ve. */
export type LinkedPostIssue = "MISSING" | "DRAFT" | "ARCHIVED" | "NOT_YET";

const sinWww = (host: string) => host.toLowerCase().replace(/^www\./, "");

function hostDe(url: string | null): string | null {
  if (!url) return null;
  try {
    return sinWww(new URL(url).hostname);
  } catch {
    return null;
  }
}

function tramos(pathname: string): string[] | null {
  try {
    return pathname
      .split("/")
      .filter(Boolean)
      .map((t) => decodeURIComponent(t));
  } catch {
    return null;
  }
}

/**
 * Slug del artículo del blog de la institución al que lleva `ctaUrl`, o null si no lleva a uno.
 * Reconoce `<app>/w/<publicSlug>/blog/<post>` y `<dominio propio>/blog/<post>` (con o sin `www.`).
 */
export function linkedBlogPostSlug(ctaUrl: string | null | undefined, site: BlogSite): string | null {
  if (!ctaUrl) return null;
  let url: URL;
  try {
    url = new URL(ctaUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = sinWww(url.hostname);
  const partes = tramos(url.pathname);
  if (!partes) return null;

  const dominio = site.domain ? sinWww(site.domain) : null;
  if (dominio && host === dominio && partes.length === 2 && partes[0] === "blog") return partes[1];

  const app = hostDe(site.appBase);
  const slug = site.publicSlug?.toLowerCase();
  if (
    app &&
    slug &&
    host === app &&
    partes.length === 4 &&
    partes[0] === "w" &&
    partes[1].toLowerCase() === slug &&
    partes[2] === "blog"
  ) {
    return partes[3];
  }
  return null;
}

/** Mismo criterio que el sitio público y que el envío de artículos: publicado y con fecha ya cumplida. */
export function linkedPostIssue(post: LinkedPost | null, at: Date): LinkedPostIssue | null {
  if (!post) return "MISSING";
  if (post.status === "ARCHIVED") return "ARCHIVED";
  if (post.status !== "PUBLISHED" || !post.publishedAt) return "DRAFT";
  if (post.publishedAt > at) return "NOT_YET";
  return null;
}

/** La tarea programada no manda una campaña cuyo botón lleva a un artículo que todavía no se ve. */
export function holdForLinkedPost(slug: string | null, post: LinkedPost | null, now: Date): LinkedPostIssue | null {
  if (!slug) return null;
  return linkedPostIssue(post, now);
}

const fechaAR = (v: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(v);

/**
 * Aviso para el panel. `sendAt` es la fecha programada, o null si sale al enviarla (se compara con
 * `now`). `test` = es el aviso de «Enviarme una prueba», que sale en el momento.
 */
export function linkedPostWarning(input: {
  slug: string | null;
  post: LinkedPost | null;
  sendAt: Date | null;
  now: Date;
  test?: boolean;
}): string | null {
  const { slug, post, now, test } = input;
  if (!slug) return null;
  const at = test ? now : (input.sendAt ?? now);
  const issue = linkedPostIssue(post, at);
  if (!issue) return null;
  const nombre = post ? `«${post.title}»` : `«${slug}»`;
  const consecuencia = test
    ? "En la prueba el enlace del botón no va a abrir el artículo."
    : input.sendAt
      ? "Si llega la hora de envío y el artículo todavía no se ve, la campaña espera y sale sola cuando se publique."
      : "Así no se puede enviar en el momento: programala para cuando el artículo ya se vea.";

  if (issue === "MISSING") {
    return `El botón lleva a un artículo del blog que no existe (${nombre}). Revisá la dirección. ${consecuencia}`;
  }
  if (issue === "ARCHIVED") return `El botón lleva al artículo ${nombre}, que está archivado: no se ve en el sitio. ${consecuencia}`;
  if (issue === "DRAFT") {
    return `El botón lleva al artículo ${nombre}, que está en borrador: todavía no se ve en el sitio. Publicalo o programalo. ${consecuencia}`;
  }
  const cuando = fechaAR(post!.publishedAt!);
  if (test || !input.sendAt) {
    return `El botón lleva al artículo ${nombre}, que se publica el ${cuando} (hora argentina). ${consecuencia}`;
  }
  return `El botón lleva al artículo ${nombre}, que se publica el ${cuando} (hora argentina), después de la fecha de envío (${fechaAR(input.sendAt)}). ${consecuencia}`;
}
