import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { SiteNavItem } from "@/lib/website/site-nav";
import { WebsiteHeaderNavClient } from "./website-header-nav-client";

/**
 * Header real del sitio. NO es una sección: vive en Diseño global, no en `sectionsJson`. Los
 * presets sólo cambian layout vía clases — nunca CSS libre.
 *
 * Server Component: el logo, el botón de login y el marco del `<header>` se dibujan acá, sin
 * JavaScript. Lo único que cruza al navegador es el menú (`WebsiteHeaderNavClient`, en
 * `website-header-nav-client.tsx`) — porque necesita saber en qué página está el visitante para
 * marcarla, y `buildSiteNav` corre en el servidor sin esa información (ver el comentario ahí).
 * El resto del header — y el pie entero — siguen sin ningún JS.
 *
 * El botón "Iniciar sesión" apunta siempre a `/login` — nunca a una URL que el usuario escriba:
 * evita convertirlo sin querer en un vector de phishing.
 */
export function WebsiteHeaderView({
  logoUrl,
  workspaceName,
  navItems,
  designPresets,
  homeHref,
}: {
  logoUrl: string | null;
  workspaceName: string;
  navItems: SiteNavItem[];
  designPresets: WebsiteDesignPresets;
  /** A dónde lleva el logo. En la vista previa del panel no hay sitio público al que ir. */
  homeHref: string;
}) {
  const preset = designPresets.headerPreset;
  const overlay = preset === "transparent-hero";
  const floating = preset === "floating";
  const centered = preset === "centered";
  const minimal = preset === "minimal";

  const colorTexto = overlay ? "#ffffff" : "var(--wsite-text)";

  const logo = (
    <a href={homeHref} className="flex shrink-0 items-center gap-2" style={{ color: colorTexto }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- el logo vive en R2
        <img src={logoUrl} alt={workspaceName} style={{ height: "var(--wsite-logo-size, 40px)", width: "auto" }} />
      ) : (
        <span className="text-lg font-bold" style={{ fontFamily: "var(--wsite-heading-font)" }}>
          {workspaceName}
        </span>
      )}
    </a>
  );

  const botonLogin = designPresets.showLoginButton ? (
    <a
      href="/login"
      className="shrink-0 text-sm"
      style={{
        backgroundColor: "var(--wsite-accent)",
        color: "#ffffff",
        borderRadius: "var(--wsite-button-radius)",
        paddingInline: "var(--wsite-button-padding-x)",
        paddingBlock: "var(--wsite-button-padding-y)",
        fontWeight: "var(--wsite-button-weight)",
      }}
    >
      {designPresets.loginButtonLabel || "Iniciar sesión"}
    </a>
  ) : null;

  const wrapperClass = overlay ? "absolute inset-x-0 top-0 z-10" : floating ? "relative mx-4 mt-4 rounded-2xl shadow-md" : "relative";
  const wrapperStyle = overlay
    ? undefined
    : { backgroundColor: "var(--wsite-bg)", borderBottom: floating ? undefined : "1px solid rgba(127,127,127,0.15)" };

  return (
    <header className={wrapperClass} style={wrapperStyle}>
      <div className={`mx-auto flex max-w-6xl items-center gap-4 px-6 py-4 ${centered ? "flex-col text-center" : "justify-between"}`}>
        {logo}
        <div className={`flex items-center gap-4 ${centered ? "flex-col" : ""}`}>
          <WebsiteHeaderNavClient navItems={navItems} colorTexto={colorTexto} minimal={minimal} centered={centered}>
            {botonLogin}
          </WebsiteHeaderNavClient>
        </div>
      </div>
    </header>
  );
}
