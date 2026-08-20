import type { WebsiteDesignPresets } from "@/lib/website/design-presets";
import type { WebsiteNavItem } from "@/lib/website/navigation";

/**
 * Header real del sitio (Parte 6-7). NO es un `WebsiteBlock` — vive en Diseño global, no en
 * `sectionsJson.pages.home` (decisión ya tomada, ver informe de la etapa del rediseño UX). Los
 * 5 presets solo cambian layout/posicionamiento vía clases — nunca CSS libre.
 *
 * El botón "Iniciar sesión" apunta siempre a `/login` (la ruta real de FotoOffice) — nunca a
 * una URL que el usuario pueda escribir, por diseño: no tiene sentido un botón de login que
 * mande a otro lado, y evita convertirlo sin querer en un vector de phishing.
 */
export function WebsiteHeaderView({
  logoUrl,
  workspaceName,
  navItems,
  designPresets,
}: {
  logoUrl: string | null;
  workspaceName: string;
  navItems: WebsiteNavItem[];
  designPresets: WebsiteDesignPresets;
}) {
  const preset = designPresets.headerPreset;
  const overlay = preset === "transparent-hero";
  const floating = preset === "floating";
  const centered = preset === "centered";
  const minimal = preset === "minimal";

  const logo = (
    <a href="#" className="flex items-center gap-2 shrink-0" style={{ color: overlay ? "#ffffff" : "var(--wsite-text)" }}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={workspaceName} style={{ height: "var(--wsite-logo-size, 40px)", width: "auto" }} />
      ) : (
        <span className="text-lg font-bold" style={{ fontFamily: "var(--wsite-heading-font)" }}>
          {workspaceName}
        </span>
      )}
    </a>
  );

  const nav = (
    <nav className={`flex items-center gap-6 text-sm ${centered ? "flex-wrap justify-center" : ""}`}>
      {(minimal ? navItems.slice(0, 1) : navItems).map((item) => (
        <a
          key={item.id}
          href={item.anchor ? `#${item.anchor}` : "#"}
          className="hover:opacity-70 transition-opacity"
          style={{ color: overlay ? "#ffffff" : "var(--wsite-text)" }}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );

  const loginButton = designPresets.showLoginButton ? (
    <a
      href="/login"
      className="text-sm shrink-0"
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

  const containerBase = "flex items-center gap-4 px-6 py-4";
  const containerLayout = centered ? "flex-col text-center" : "justify-between";
  const wrapperClass = overlay
    ? "absolute inset-x-0 top-0 z-10"
    : floating
      ? "mx-4 mt-4 rounded-2xl shadow-md"
      : "";
  const wrapperStyle = overlay
    ? undefined
    : { backgroundColor: floating ? "var(--wsite-bg)" : "var(--wsite-bg)", borderBottom: floating ? undefined : "1px solid rgba(0,0,0,0.06)" };

  return (
    <header className={wrapperClass} style={wrapperStyle}>
      <div className={`${containerBase} ${containerLayout}`}>
        {logo}
        <div className={`flex items-center gap-4 ${centered ? "flex-col" : ""}`}>
          {nav}
          {loginButton}
        </div>
      </div>
    </header>
  );
}
