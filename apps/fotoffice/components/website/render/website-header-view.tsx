import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { SiteNavItem } from "@/lib/website/site-nav";

/**
 * Header real del sitio. NO es una sección: vive en Diseño global, no en `sectionsJson`. Los
 * presets sólo cambian layout vía clases — nunca CSS libre.
 *
 * El menú de celular es un `<details>` nativo, no un componente con estado: así el header sigue
 * siendo un Server Component y no arrastra JavaScript al sitio público de nadie.
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
  const itemsVisibles = minimal ? navItems.slice(0, 1) : navItems;

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

  const enlace = (item: SiteNavItem) => (
    <a
      key={item.id}
      href={item.href}
      aria-current={item.current ? "page" : undefined}
      className="transition-opacity hover:opacity-70"
      style={{ color: colorTexto, opacity: item.current ? 1 : 0.75, fontWeight: item.current ? 600 : 400 }}
    >
      {item.label}
    </a>
  );

  // En pantalla grande: los ítems en fila. Los submenús de Inicio no se despliegan acá —
  // son anclas de la portada y aparecen sólo en el menú de celular, donde hay lugar.
  const navEscritorio = (
    <nav className={`hidden items-center gap-6 text-sm md:flex ${centered ? "flex-wrap justify-center" : ""}`}>
      {itemsVisibles.map(enlace)}
    </nav>
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

  const navCelular = (
    <details className="md:hidden">
      <summary
        className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-lg"
        aria-label="Abrir el menú"
        style={{ color: colorTexto }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </summary>
      <nav
        className="absolute inset-x-0 z-20 flex flex-col gap-1 border-t p-4 text-sm shadow-lg"
        style={{ backgroundColor: "var(--wsite-bg)", borderColor: "rgba(127,127,127,0.2)" }}
      >
        {navItems.map((item) => (
          <div key={item.id} className="flex flex-col">
            <a
              href={item.href}
              aria-current={item.current ? "page" : undefined}
              className="py-2"
              style={{ color: "var(--wsite-text)", fontWeight: item.current ? 600 : 400 }}
            >
              {item.label}
            </a>
            {item.children.map((hijo) => (
              <a key={hijo.id} href={hijo.href} className="py-1.5 pl-4 text-sm opacity-70" style={{ color: "var(--wsite-text)" }}>
                {hijo.label}
              </a>
            ))}
          </div>
        ))}
      </nav>
    </details>
  );

  const wrapperClass = overlay ? "absolute inset-x-0 top-0 z-10" : floating ? "relative mx-4 mt-4 rounded-2xl shadow-md" : "relative";
  const wrapperStyle = overlay
    ? undefined
    : { backgroundColor: "var(--wsite-bg)", borderBottom: floating ? undefined : "1px solid rgba(127,127,127,0.15)" };

  return (
    <header className={wrapperClass} style={wrapperStyle}>
      <div className={`mx-auto flex max-w-6xl items-center gap-4 px-6 py-4 ${centered ? "flex-col text-center" : "justify-between"}`}>
        {logo}
        <div className={`flex items-center gap-4 ${centered ? "flex-col" : ""}`}>
          {navEscritorio}
          {botonLogin}
          {navCelular}
        </div>
      </div>
    </header>
  );
}
