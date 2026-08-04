/**
 * Cuerpo de la nota. El HTML llega ya saneado desde la base
 * (`sanitizeContentHtml` de `@repo/content` corre al guardar el post).
 *
 * Los estilos viven acá y no en `globals.css` para mantener la tipografía
 * editorial acotada al blog.
 */
export function BlogArticleBody({ html }: { html: string }) {
  return (
    <>
      <div className="ck-blog-prose" dangerouslySetInnerHTML={{ __html: html }} />
      <style>{`
        .ck-blog-prose {
          color: var(--ck-text-secondary);
          font-size: 1.0625rem;
          line-height: 1.75;
        }
        .ck-blog-prose > * + * {
          margin-top: 1.5rem;
        }
        .ck-blog-prose h2,
        .ck-blog-prose h3,
        .ck-blog-prose h4 {
          color: var(--ck-text-primary);
          font-family: var(--ck-font-display), var(--ck-font-sans), sans-serif;
          line-height: 1.25;
        }
        .ck-blog-prose h2 {
          font-size: 1.75rem;
          margin-top: 3rem;
        }
        .ck-blog-prose h3 {
          font-size: 1.375rem;
          margin-top: 2.5rem;
        }
        .ck-blog-prose h4 {
          font-size: 1.125rem;
          margin-top: 2rem;
        }
        .ck-blog-prose a {
          color: var(--ck-brand-primary);
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .ck-blog-prose strong {
          color: var(--ck-text-primary);
        }
        .ck-blog-prose ul,
        .ck-blog-prose ol {
          padding-left: 1.5rem;
        }
        .ck-blog-prose ul {
          list-style: disc;
        }
        .ck-blog-prose ol {
          list-style: decimal;
        }
        .ck-blog-prose li + li {
          margin-top: 0.5rem;
        }
        .ck-blog-prose blockquote {
          border-left: 3px solid var(--ck-brand-primary);
          padding-left: 1.25rem;
          color: var(--ck-text-muted);
          font-style: italic;
        }
        .ck-blog-prose img,
        .ck-blog-prose iframe {
          border-radius: var(--ck-radius-card);
          max-width: 100%;
          height: auto;
        }
        .ck-blog-prose iframe {
          aspect-ratio: 16 / 9;
          width: 100%;
        }
        .ck-blog-prose figcaption {
          color: var(--ck-text-muted);
          font-size: 0.875rem;
          margin-top: 0.75rem;
        }
        .ck-blog-prose table {
          border-collapse: collapse;
          width: 100%;
        }
        .ck-blog-prose th,
        .ck-blog-prose td {
          border: 1px solid var(--ck-border);
          padding: 0.75rem;
          text-align: left;
        }
        .ck-blog-prose th {
          background: var(--ck-surface);
          color: var(--ck-text-primary);
        }
      `}</style>
    </>
  );
}
