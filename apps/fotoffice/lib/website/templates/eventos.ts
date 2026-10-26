import { INQUIRY_DEFAULT_BUTTON_LABEL, INQUIRY_DEFAULT_THANKS, TESTIMONIALS_DEFAULT_CTA } from "../blocks";
import { FOTOS_DE_MUESTRA as F } from "./fotos";
import { bloque, diseno, enOrden, hero, menuDe, placa, type SiteTemplate } from "./tipos";

/**
 * Eventos — fotógrafo de XV y bodas. Sigue la estructura del sitio de DNX: portada con la foto a
 * pantalla completa, trabajos, quién soy en dos líneas, testimonios y el pedido de presupuesto.
 */
const presupuesto = (id: string) =>
  bloque(id, "INQUIRY_FORM", {
    title: "Pedí tu presupuesto",
    intro: "Contá acá qué le pedís a quien te escribe: la fecha, el lugar y qué tipo de evento es. Respondé siempre en el día.",
    categoryIds: [],
    askOrigin: true,
    askEventDate: true,
    askEventLocation: true,
    buttonLabel: INQUIRY_DEFAULT_BUTTON_LABEL,
    thanksMessage: INQUIRY_DEFAULT_THANKS,
  });

export const PLANTILLA_EVENTOS: SiteTemplate = {
  id: "eventos",
  nombre: "Eventos",
  descripcion: "Foto a pantalla completa, tus trabajos, testimonios y el pedido de presupuesto a mano.",
  paraQuien: "Fotógrafos de XV, bodas y eventos sociales.",
  recommendedFor: ["FREELANCE_PHOTOGRAPHER", "PHOTO_STUDIO", "PHOTOGRAPHY_COMPANY", "AGENCY_PRODUCTION"],
  tier: "free",
  layoutPreview: ["hero", "image", "text", "cta"],
  design: diseno({
    headerPreset: "transparent-hero",
    buttonPreset: "pill",
    typographyPreset: "modern",
    animationPreset: "soft",
    typographyLevels: { title: { weight: 500, uppercase: false } },
  }),
  coloresSugeridos: {
    primaryColor: "#b08d57",
    secondaryColor: "#1f1b16",
    backgroundColor: "#ffffff",
    textColor: "#1f1b16",
    accentColor: "#b08d57",
  },
  paginas: [
    {
      clave: "home",
      bloques: enOrden([
        hero(
          "eventos-portada",
          [
            placa("eventos-portada-1", {
              imageUrl: F.quinceTiara.url,
              imageAlt: F.quinceTiara.alt,
              imageFocus: "top",
              title: "Tu nombre o el de tu estudio",
              subtitle: "Fotografía de XV, bodas y eventos. Cambiá esta frase por la tuya.",
              showButton: true,
              buttonLabel: "Pedí tu presupuesto",
              buttonUrl: "#pedi-tu-presupuesto",
              overlay: "soft",
            }),
            placa("eventos-portada-2", {
              imageUrl: F.novios.url,
              imageAlt: F.novios.alt,
              title: "Cada fiesta, una historia distinta",
              subtitle: "Reemplazá estas fotos de muestra por las tuyas.",
              overlay: "soft",
            }),
          ],
          { heightPreset: "screen", intervalMs: 7000 },
        ),
        bloque("eventos-trabajos", "PORTFOLIO", { title: "Trabajos recientes", count: 6, layout: "grid", showViewAll: true }),
        bloque("eventos-quien-soy", "RICH_TEXT", {
          title: "Quién soy",
          html:
            "<p>Contá acá quién sos en dos o tres líneas: desde cuándo fotografiás eventos, en qué zona trabajás y qué te diferencia.</p>" +
            "<p>Hablá de cómo acompañás a la familia el día de la fiesta y de lo que se lleva cada cliente.</p>",
          align: "center",
          width: "narrow",
        }),
        bloque("eventos-testimonios", "TESTIMONIALS", {
          title: "Lo que dicen las familias",
          count: 6,
          layout: "carousel",
          showCta: true,
          ctaLabel: TESTIMONIALS_DEFAULT_CTA,
        }),
        presupuesto("eventos-presupuesto"),
      ]),
    },
    {
      clave: "quien_soy",
      meta: { slug: "quien-soy", title: "Quién soy" },
      bloques: enOrden([
        bloque("quien-soy-foto", "IMAGE", { imageUrl: F.quinceParque.url, alt: F.quinceParque.alt, caption: "", widthPreset: "contained" }),
        bloque("quien-soy-texto", "RICH_TEXT", {
          title: "Quién soy",
          html:
            "<p>Contá acá tu historia: cómo empezaste, cuántos años llevás fotografiando eventos y qué te sigue entusiasmando de cada fiesta.</p>" +
            "<p>Sumá lo que te pide la gente antes de contratarte: cómo trabajás el día del evento, cuándo entregás las fotos y cómo se ven.</p>",
          align: "left",
          width: "normal",
        }),
        bloque("quien-soy-galeria", "GALLERY", {
          title: "Algunas fotos",
          photos: [
            { id: "quien-soy-g1", url: F.noviosLago.url, alt: F.noviosLago.alt },
            { id: "quien-soy-g2", url: F.brindis.url, alt: F.brindis.alt },
            { id: "quien-soy-g3", url: F.noviosAtardecer.url, alt: F.noviosAtardecer.alt },
          ],
          layout: "grid",
          columns: 3,
          lightbox: true,
        }),
      ]),
    },
    {
      clave: "pedi_presupuesto",
      meta: { slug: "pedi-tu-presupuesto", title: "Pedí tu presupuesto" },
      bloques: enOrden([
        hero(
          "presupuesto-portada",
          [
            placa("presupuesto-portada-1", {
              imageUrl: F.brindis.url,
              imageAlt: F.brindis.alt,
              title: "Pedí tu presupuesto",
              subtitle: "Contá acá cuánto tardás en responder y qué datos necesitás para cotizar.",
              overlay: "medium",
            }),
          ],
          { heightPreset: "compact" },
        ),
        presupuesto("presupuesto-formulario"),
      ]),
    },
  ],
  menu: menuDe(["quien_soy", "pedi_presupuesto"]),
};
