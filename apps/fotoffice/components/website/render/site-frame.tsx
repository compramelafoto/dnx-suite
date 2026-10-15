import type { CSSProperties, ReactNode } from "react";
import { websiteFontsHref, type WebsiteDesignPresets } from "@/lib/website/design-presets";

/**
 * El marco común del sitio: encabezado, contenido y pie. Lo usan el sitio público
 * (`PublicSiteShell`) y las dos vistas previas del panel, así las tres se acomodan igual.
 *
 * Es el contenedor de las consultas `@3xl:` del encabezado: con la barra lateral fija, el
 * encabezado pasa a ser una columna al costado cuando el MARCO es ancho — no la ventana. Por
 * eso la vista previa en modo celular del constructor muestra el menú de celular de verdad.
 */
export function SiteFrame({
  designPresets,
  header,
  footer,
  children,
  style,
  minHeight,
}: {
  designPresets: WebsiteDesignPresets;
  header: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
  /** `100vh` en el sitio público; en las vistas previas lo da su propio recuadro. */
  minHeight?: string;
}) {
  const sidebar = designPresets.menuLayout === "sidebar";
  const fila = sidebar ? (designPresets.menuSide === "left" ? "@3xl:flex-row" : "@3xl:flex-row-reverse") : "";
  // Sólo las letras de Google que el diseño usa. React 19 sube este `<link>` al `<head>` (por
  // `precedence`) y no lo repite aunque se dibuje dos veces.
  const fuentes = websiteFontsHref(designPresets);
  return (
    <div className="@container" style={{ ...style, minHeight }}>
      {fuentes ? <link rel="stylesheet" href={fuentes} precedence="wsite-fonts" /> : null}
      <div className={`flex flex-col ${fila}`} style={{ minHeight }}>
        {header}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex-1">{children}</div>
          {footer}
        </div>
      </div>
    </div>
  );
}
