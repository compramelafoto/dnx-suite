import Link from "next/link";
import type { ReactNode } from "react";
import { BLOG_HEADING_STYLE, BLOG_SOFT_BORDER } from "./blog-post-card";

/**
 * El fondo y la tipografía del blog. El armazón del sitio (`PublicSiteShell`) define las
 * variables `--wsite-*` pero a propósito no pinta el `<main>` (las páginas de módulos viejas
 * usan los tokens del panel); el blog es contenido del sitio, así que se pinta como la portada:
 * mismo fondo, mismo color de texto, misma fuente de cuerpo.
 */
export function BlogFrame({ children }: { children: ReactNode }) {
  return (
    <main
      style={{
        backgroundColor: "var(--wsite-bg)",
        color: "var(--wsite-text)",
        fontFamily: "var(--wsite-body-font)",
        lineHeight: "var(--wsite-line-height)",
      }}
    >
      {children}
    </main>
  );
}

/** Encabezado de las páginas de listado (blog, categoría, etiqueta). */
export function BlogListHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string | null }) {
  return (
    <header className="max-w-3xl space-y-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: "var(--wsite-primary)" }}>
        {eyebrow}
      </p>
      <h1 className="text-4xl leading-tight break-words sm:text-5xl" style={BLOG_HEADING_STYLE}>
        {title}
      </h1>
      {description ? (
        <p className="text-base leading-relaxed sm:text-lg" style={{ opacity: 0.75 }}>
          {description}
        </p>
      ) : null}
    </header>
  );
}

export type BlogChip = { href: string; label: string; active: boolean };

/**
 * Las categorías como pastillas. En el teléfono se deslizan de costado en vez de apilarse en
 * cinco renglones que empujan los artículos fuera de la pantalla.
 */
export function BlogChips({ chips, label }: { chips: BlogChip[]; label: string }) {
  if (chips.length <= 1) return null;
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 pb-1 sm:w-auto sm:flex-wrap">
        {chips.map((chip) => (
          <li key={chip.href}>
            <Link
              href={chip.href}
              aria-current={chip.active ? "page" : undefined}
              className="inline-flex min-h-10 items-center whitespace-nowrap px-4 text-sm transition-colors"
              style={{
                borderRadius: "var(--wsite-button-radius)",
                border: `1px solid ${chip.active ? "var(--wsite-primary)" : BLOG_SOFT_BORDER}`,
                backgroundColor: chip.active ? "var(--wsite-primary)" : "transparent",
                color: chip.active ? "#ffffff" : "var(--wsite-text)",
                fontWeight: chip.active ? 600 : 400,
              }}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Botón secundario con la forma de los botones del sitio (radio y relleno de Diseño global). */
export function BlogButtonLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-sm"
      style={{
        borderRadius: "var(--wsite-button-radius)",
        paddingInline: "var(--wsite-button-padding-x)",
        paddingBlock: "var(--wsite-button-padding-y)",
        fontWeight: "var(--wsite-button-weight)",
        border: "2px solid var(--wsite-primary)",
        color: "var(--wsite-primary)",
      }}
    >
      {children}
    </Link>
  );
}

export function BlogEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl px-6 py-16 text-center" style={{ border: `1px dashed ${BLOG_SOFT_BORDER}`, opacity: 0.7 }}>
      {children}
    </p>
  );
}
