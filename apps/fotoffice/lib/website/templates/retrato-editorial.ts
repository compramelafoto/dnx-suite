import { FOTOS_DE_MUESTRA as F } from "./fotos";
import { bloque, diseno, enOrden, hero, menuDe, placa, type SiteTemplate } from "./tipos";

/**
 * Retrato editorial — minimal, tipografía serif y mucho blanco: pocas palabras, fotos grandes.
 * Reemplaza a la vieja «Minimal».
 */
export const PLANTILLA_RETRATO_EDITORIAL: SiteTemplate = {
  id: "retrato-editorial",
  nombre: "Retrato editorial",
  descripcion: "Minimal, con letra serif y mucho blanco: las fotos hablan solas.",
  paraQuien: "Retratistas, fotografía de autor y editorial.",
  recommendedFor: ["FREELANCE_PHOTOGRAPHER", "PHOTOGRAPHY_COMMUNITY", "OTHER"],
  tier: "free",
  layoutPreview: ["hero", "text", "image"],
  design: diseno({ headerPreset: "centered", buttonPreset: "square", typographyPreset: "editorial", animationPreset: "soft" }),
  coloresSugeridos: {
    primaryColor: "#111111",
    secondaryColor: "#111111",
    backgroundColor: "#fbfaf7",
    textColor: "#1a1a1a",
    accentColor: "#8a6f4d",
  },
  paginas: [
    {
      clave: "home",
      bloques: enOrden([
        hero(
          "editorial-portada",
          [
            placa("editorial-portada-1", {
              imageUrl: F.retratoFondoNegro.url,
              imageAlt: F.retratoFondoNegro.alt,
              title: "Tu nombre",
              subtitle: "Retratos. Cambiá esta línea por la tuya.",
              align: "left",
              contentPosition: "bottom",
              overlay: "soft",
            }),
          ],
          { heightPreset: "large" },
        ),
        bloque("editorial-intro", "RICH_TEXT", {
          html: "<p>Contá acá, en una o dos frases, qué buscás cuando hacés un retrato.</p>",
          align: "center",
          width: "narrow",
        }),
        bloque("editorial-foto", "IMAGE", { imageUrl: F.retratoEditorial.url, alt: F.retratoEditorial.alt, caption: "", widthPreset: "narrow" }),
        bloque("editorial-espacio", "SPACER", { sizePreset: "lg" }),
        bloque("editorial-galeria", "GALLERY", {
          photos: [
            { id: "editorial-g1", url: F.noviosEscalera.url, alt: F.noviosEscalera.alt },
            { id: "editorial-g2", url: F.retratoEncaje.url, alt: F.retratoEncaje.alt },
            { id: "editorial-g3", url: F.noviosParaguas.url, alt: F.noviosParaguas.alt },
            { id: "editorial-g4", url: F.noviosCampo.url, alt: F.noviosCampo.alt },
          ],
          layout: "grid",
          columns: 2,
          lightbox: true,
        }),
      ]),
    },
    {
      clave: "portfolio",
      meta: { slug: "portfolio", title: "Portfolio" },
      bloques: enOrden([
        bloque("portfolio-galeria", "GALLERY", {
          title: "Portfolio",
          photos: [
            { id: "portfolio-g1", url: F.retratoFondoNegro.url, alt: F.retratoFondoNegro.alt },
            { id: "portfolio-g2", url: F.retratoEditorial.url, alt: F.retratoEditorial.alt },
            { id: "portfolio-g3", url: F.noviosEscalera.url, alt: F.noviosEscalera.alt },
            { id: "portfolio-g4", url: F.retratoEncaje.url, alt: F.retratoEncaje.alt },
            { id: "portfolio-g5", url: F.noviosParaguas.url, alt: F.noviosParaguas.alt },
            { id: "portfolio-g6", url: F.noviosCampo.url, alt: F.noviosCampo.alt },
          ],
          layout: "masonry",
          columns: 3,
          lightbox: true,
        }),
        bloque("portfolio-trabajos", "PORTFOLIO", { title: "Series", count: 6, layout: "grid", showViewAll: true }),
      ]),
    },
    {
      clave: "sobre_mi",
      meta: { slug: "sobre-mi", title: "Sobre mí" },
      bloques: enOrden([
        bloque("sobre-mi-foto", "IMAGE", { imageUrl: F.retratoEditorial.url, alt: F.retratoEditorial.alt, caption: "", widthPreset: "narrow" }),
        bloque("sobre-mi-texto", "RICH_TEXT", {
          title: "Sobre mí",
          html:
            "<p>Contá acá quién sos: dónde te formaste, qué te interesa retratar y con quién trabajaste.</p>" +
            "<p>Si publicaste o expusiste, nombralo en una línea.</p>",
          align: "left",
          width: "narrow",
        }),
        bloque("sobre-mi-contacto", "CONTACT", { title: "Escribime", useWorkspaceData: true, socials: [] }),
      ]),
    },
  ],
  menu: menuDe(["portfolio", "sobre_mi"]),
};
