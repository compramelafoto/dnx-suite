import type { RenderedEmailSignature } from "@repo/communications/signature";
import { C, FUENTE, escapeHtml } from "@/lib/communications/html";
import { button, safeAccent, safeHttpsUrl, textFooter, wrapMailing, type MailingBrand, type MailingFooter } from "./layout";

/**
 * Los correos del blog a los socios: un artículo, o el resumen semanal. Módulo puro.
 */

export type BlogEmailPost = {
  title: string;
  excerpt: string | null;
  heroImageUrl: string | null;
  url: string;
  categoryName?: string | null;
};

export type EmailBody = { subject: string; html: string; text: string };

const MAX_EXCERPT = 320;

function recortar(texto: string | null | undefined, max = MAX_EXCERPT): string | null {
  const t = (texto ?? "").replace(/\s+/g, " ").trim();
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}

function saludo(firstName: string | null): string {
  return firstName ? `Hola ${firstName},` : "Hola,";
}

/** Asunto del correo de un artículo: el título, que es lo que hace abrirlo. */
export function blogPostSubject(post: { title: string }): string {
  return post.title.replace(/\s+/g, " ").trim().slice(0, 150);
}

export function buildBlogPostEmail(input: {
  brand: MailingBrand;
  post: BlogEmailPost;
  firstName: string | null;
  signature: RenderedEmailSignature | null;
  footer: MailingFooter;
}): EmailBody {
  const accent = safeAccent(input.brand.accentColor);
  const hero = safeHttpsUrl(input.post.heroImageUrl);
  const bajada = recortar(input.post.excerpt);
  const categoria = input.post.categoryName?.trim();
  const intro = `${input.brand.name} publicó un artículo nuevo en su blog:`;

  const contentHtml = [
    `<p style="margin:0 0 12px;">${escapeHtml(saludo(input.firstName))}</p>`,
    `<p style="margin:0 0 16px;">${escapeHtml(intro)}</p>`,
    hero
      ? `<a href="${escapeHtml(input.post.url)}"><img src="${escapeHtml(hero)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px;margin:0 0 16px;"></a>`
      : "",
    categoria
      ? `<p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${accent};">${escapeHtml(categoria)}</p>`
      : "",
    `<h1 style="margin:0 0 8px;font-family:${FUENTE};font-size:22px;line-height:1.3;color:${C.tinta};"><a href="${escapeHtml(input.post.url)}" style="color:${C.tinta};text-decoration:none;">${escapeHtml(input.post.title)}</a></h1>`,
    bajada ? `<p style="margin:0 0 16px;">${escapeHtml(bajada)}</p>` : "",
    button("Leer el artículo", input.post.url, accent),
  ].join("\n");

  const html = wrapMailing({
    brand: input.brand,
    preheader: bajada ?? intro,
    contentHtml,
    signature: input.signature,
    footer: input.footer,
  });

  const text = [
    saludo(input.firstName),
    "",
    intro,
    "",
    input.post.title,
    ...(bajada ? ["", bajada] : []),
    "",
    `Leer el artículo: ${input.post.url}`,
    ...(input.signature ? ["", input.signature.text] : []),
    "",
    textFooter(input.footer),
  ].join("\n");

  return { subject: blogPostSubject(input.post), html, text };
}

export function blogDigestSubject(brandName: string, posts: { title: string }[]): string {
  if (posts.length === 1) return `Esta semana en ${brandName}: ${blogPostSubject(posts[0])}`.slice(0, 150);
  return `Esta semana en el blog de ${brandName}: ${posts.length} artículos nuevos`;
}

export function buildBlogDigestEmail(input: {
  brand: MailingBrand;
  posts: BlogEmailPost[];
  firstName: string | null;
  signature: RenderedEmailSignature | null;
  footer: MailingFooter;
  blogUrl: string;
}): EmailBody {
  const accent = safeAccent(input.brand.accentColor);
  const intro =
    input.posts.length === 1
      ? `Esto es lo que publicamos esta semana en el blog de ${input.brand.name}:`
      : `Estos son los ${input.posts.length} artículos que publicamos esta semana en el blog de ${input.brand.name}:`;

  const tarjetas = input.posts
    .map((p) => {
      const hero = safeHttpsUrl(p.heroImageUrl);
      const bajada = recortar(p.excerpt, 200);
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;border-top:1px solid ${C.borde};"><tr><td style="padding-top:16px;">
${hero ? `<a href="${escapeHtml(p.url)}"><img src="${escapeHtml(hero)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border:0;border-radius:8px;margin:0 0 12px;"></a>` : ""}
<h2 style="margin:0 0 6px;font-family:${FUENTE};font-size:18px;line-height:1.3;color:${C.tinta};"><a href="${escapeHtml(p.url)}" style="color:${C.tinta};text-decoration:none;">${escapeHtml(p.title)}</a></h2>
${bajada ? `<p style="margin:0 0 8px;">${escapeHtml(bajada)}</p>` : ""}
<a href="${escapeHtml(p.url)}" style="font-weight:600;color:${accent};text-decoration:none;">Leer →</a>
</td></tr></table>`;
    })
    .join("\n");

  const contentHtml = [
    `<p style="margin:0 0 12px;">${escapeHtml(saludo(input.firstName))}</p>`,
    `<p style="margin:0 0 16px;">${escapeHtml(intro)}</p>`,
    tarjetas,
    button("Ver todo el blog", input.blogUrl, accent),
  ].join("\n");

  const html = wrapMailing({
    brand: input.brand,
    preheader: input.posts.map((p) => p.title).join(" · ").slice(0, 140),
    contentHtml,
    signature: input.signature,
    footer: input.footer,
  });

  const text = [
    saludo(input.firstName),
    "",
    intro,
    ...input.posts.flatMap((p) => ["", `• ${p.title}`, `  ${p.url}`]),
    "",
    `Ver todo el blog: ${input.blogUrl}`,
    ...(input.signature ? ["", input.signature.text] : []),
    "",
    textFooter(input.footer),
  ].join("\n");

  return { subject: blogDigestSubject(input.brand.name, input.posts), html, text };
}
