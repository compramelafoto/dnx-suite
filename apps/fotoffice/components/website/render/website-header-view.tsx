import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { SiteNavItem } from "@/lib/website/site-nav";
import { WebsiteHeaderNavClient } from "./website-header-nav-client";
import { WebsiteMenuOverlay } from "./website-menu-overlay";

/**
 * Header real del sitio. NO es una sección: vive en Diseño global, no en `sectionsJson`. Los
 * presets sólo cambian layout vía clases — nunca CSS libre.
 *
 * `menuLayout` decide dónde vive el menú:
 * - `topbar`: la barra de siempre, con sus estilos (`headerPreset`).
 * - `sidebar`: una columna fija al costado en pantallas grandes (el marco la acomoda: ver
 *   `SiteFrame`).
 * - `drawer` / `fullscreen` / `modal`: logo y botón de menú; el menú se abre encima.
 * En el celular, todas terminan en el botón de menú con panel lateral.
 *
 * Server Component: el logo, el botón de login y el marco se dibujan acá, sin JavaScript. Lo que
 * cruza al navegador son los enlaces (necesitan saber la página actual) y el panel que se abre.
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
  const layout = designPresets.menuLayout;
  const side = designPresets.menuSide;
  const preset = designPresets.headerPreset;
  // Los estilos de barra sólo existen en la barra superior.
  const overlay = layout === "topbar" && preset === "transparent-hero";
  const floating = layout === "topbar" && preset === "floating";
  const centered = layout === "topbar" && preset === "centered";
  const minimal = layout === "topbar" && preset === "minimal";

  const colorTexto = overlay ? "#ffffff" : "var(--wsite-text)";

  const logo = (
    <a href={homeHref} className="flex shrink-0 items-center gap-2" style={{ color: colorTexto }}>
      {logoUrl ? (
        // En el teléfono se limita al 18% del ancho: un logo de 160 px taparía media pantalla.
        // eslint-disable-next-line @next/next/no-img-element -- el logo vive en R2
        <img
          src={logoUrl}
          alt={workspaceName}
          style={{ height: "min(var(--wsite-logo-size, 40px), 18vw)", width: "auto" }}
        />
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
      className="inline-block shrink-0 text-sm"
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

  const borde = "1px solid rgba(127,127,127,0.15)";

  if (layout === "sidebar") {
    return (
      <header
        className={`relative border-b @3xl:w-64 @3xl:shrink-0 @3xl:border-b-0 ${side === "left" ? "@3xl:border-r" : "@3xl:border-l"}`}
        style={{ backgroundColor: "var(--wsite-bg)", borderColor: "rgba(127,127,127,0.15)" }}
      >
        <div className="flex items-center justify-between gap-4 px-6 py-4 @3xl:sticky @3xl:top-0 @3xl:flex-col @3xl:items-start @3xl:gap-8 @3xl:py-10">
          {logo}
          <WebsiteHeaderNavClient navItems={navItems} colorTexto={colorTexto} vertical />
          {botonLogin ? <div className="hidden @3xl:block">{botonLogin}</div> : null}
          <WebsiteMenuOverlay navItems={navItems} variant="drawer" side={side} colorTexto={colorTexto} triggerClassName="@3xl:hidden">
            {botonLogin}
          </WebsiteMenuOverlay>
        </div>
      </header>
    );
  }

  if (layout === "drawer" || layout === "fullscreen" || layout === "modal") {
    const boton = (
      <WebsiteMenuOverlay navItems={navItems} variant={layout} side={side} colorTexto={colorTexto}>
        {botonLogin}
      </WebsiteMenuOverlay>
    );
    // El botón va del lado del que sale el panel; en las demás, a la derecha.
    const botonALaIzquierda = layout === "drawer" && side === "left";
    return (
      <header className="relative" style={{ backgroundColor: "var(--wsite-bg)", borderBottom: borde }}>
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-4">
          {botonALaIzquierda ? boton : null}
          {logo}
          <div className="ml-auto flex items-center gap-4">
            {botonLogin ? <div className="hidden @3xl:block">{botonLogin}</div> : null}
            {botonALaIzquierda ? null : boton}
          </div>
        </div>
      </header>
    );
  }

  const wrapperClass = overlay ? "absolute inset-x-0 top-0 z-10" : floating ? "relative mx-4 mt-4 rounded-2xl shadow-md" : "relative";
  const wrapperStyle = overlay ? undefined : { backgroundColor: "var(--wsite-bg)", borderBottom: floating ? undefined : borde };

  return (
    <header className={wrapperClass} style={wrapperStyle}>
      <div className={`mx-auto flex max-w-6xl items-center gap-4 px-6 py-4 ${centered ? "flex-col text-center" : "justify-between"}`}>
        {logo}
        <div className={`flex items-center gap-4 ${centered ? "flex-col" : ""}`}>
          <WebsiteHeaderNavClient navItems={navItems} colorTexto={colorTexto} minimal={minimal} centered={centered} />
          {botonLogin}
          <WebsiteMenuOverlay navItems={navItems} variant="drawer" side={side} colorTexto={colorTexto} triggerClassName="@3xl:hidden" />
        </div>
      </div>
    </header>
  );
}
