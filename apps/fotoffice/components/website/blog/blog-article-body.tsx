/**
 * El cuerpo del artículo. El HTML llega YA saneado: el motor (`sanitizeContentHtml` de
 * `@repo/content`) lo limpia al guardar, así que acá sólo se le da forma.
 *
 * Los estilos viven acá y no en `globals.css` para que la tipografía editorial quede acotada al
 * blog y no se filtre al panel. Toman los colores y fuentes del sitio de la institución; el
 * criterio es el de CompraMeLaFoto (`styles/design-system/blog-article.css`): cuerpo grande,
 * interlineado amplio y renglón angosto (el ancho lo pone la página, ~42rem).
 *
 * Lo que trae el blog viejo de Alboom (imágenes con `width`/`height` fijos, iframes de YouTube
 * de 640×360, tablas anchas) se doma acá: nada desborda el ancho de un teléfono de 375 px.
 */
export function BlogArticleBody({ html }: { html: string }) {
  return (
    <>
      <div className="fo-blog-prose" dangerouslySetInnerHTML={{ __html: html }} />
      <style>{`
        .fo-blog-prose {
          color: var(--wsite-text);
          font-family: var(--wsite-body-font);
          font-size: 1.0625rem;
          line-height: 1.75;
          overflow-wrap: anywhere;
        }
        @media (min-width: 640px) {
          .fo-blog-prose { font-size: 1.125rem; }
        }
        .fo-blog-prose > * + * { margin-top: 1.4em; }
        .fo-blog-prose p:empty { display: none; }
        .fo-blog-prose h2,
        .fo-blog-prose h3,
        .fo-blog-prose h4 {
          font-family: var(--wsite-heading-font);
          font-weight: var(--wsite-heading-weight);
          letter-spacing: var(--wsite-letter-spacing);
          line-height: 1.25;
          scroll-margin-top: 6rem;
        }
        .fo-blog-prose h2 { font-size: 1.6em; margin-top: 2.2em; }
        .fo-blog-prose h3 { font-size: 1.3em; margin-top: 1.9em; }
        .fo-blog-prose h4 { font-size: 1.1em; margin-top: 1.6em; }
        .fo-blog-prose h2 + *,
        .fo-blog-prose h3 + *,
        .fo-blog-prose h4 + * { margin-top: 0.75em; }
        .fo-blog-prose a {
          color: var(--wsite-primary);
          text-decoration: underline;
          text-underline-offset: 3px;
          text-decoration-thickness: 1px;
        }
        .fo-blog-prose a:hover { text-decoration-thickness: 2px; }
        .fo-blog-prose strong, .fo-blog-prose b { font-weight: 700; }
        .fo-blog-prose ul, .fo-blog-prose ol { padding-left: 1.4em; }
        .fo-blog-prose ul { list-style: disc; }
        .fo-blog-prose ol { list-style: decimal; }
        .fo-blog-prose li + li { margin-top: 0.4em; }
        .fo-blog-prose li::marker { color: var(--wsite-primary); }
        .fo-blog-prose blockquote {
          border-left: 3px solid var(--wsite-primary);
          padding: 0.25em 0 0.25em 1.2em;
          font-style: italic;
          opacity: 0.85;
        }
        .fo-blog-prose img,
        .fo-blog-prose video {
          display: block;
          max-width: 100%;
          height: auto;
          margin-inline: auto;
          border-radius: 12px;
        }
        .fo-blog-prose figure { margin-inline: 0; }
        .fo-blog-prose figcaption {
          margin-top: 0.6em;
          font-size: 0.85em;
          text-align: center;
          opacity: 0.65;
        }
        .fo-blog-prose iframe {
          display: block;
          width: 100%;
          max-width: 100%;
          height: auto;
          aspect-ratio: 16 / 9;
          border: 0;
          border-radius: 12px;
        }
        .fo-blog-prose hr {
          border: 0;
          height: 1px;
          margin-block: 2.5em;
          background: color-mix(in srgb, var(--wsite-text) 15%, transparent);
        }
        .fo-blog-prose table {
          display: block;
          max-width: 100%;
          overflow-x: auto;
          border-collapse: collapse;
          font-size: 0.9em;
        }
        .fo-blog-prose th,
        .fo-blog-prose td {
          border: 1px solid color-mix(in srgb, var(--wsite-text) 15%, transparent);
          padding: 0.6em 0.8em;
          text-align: left;
          vertical-align: top;
        }
        .fo-blog-prose th { background: color-mix(in srgb, var(--wsite-text) 6%, transparent); font-weight: 600; }
        .fo-blog-prose code {
          font-size: 0.9em;
          padding: 0.1em 0.35em;
          border-radius: 6px;
          background: color-mix(in srgb, var(--wsite-text) 8%, transparent);
        }
        .fo-blog-prose pre {
          overflow-x: auto;
          padding: 1em;
          border-radius: 12px;
          background: color-mix(in srgb, var(--wsite-text) 8%, transparent);
        }
        .fo-blog-prose pre code { padding: 0; background: none; }
      `}</style>
    </>
  );
}
