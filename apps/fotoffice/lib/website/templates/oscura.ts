import { INQUIRY_DEFAULT_BUTTON_LABEL, INQUIRY_DEFAULT_THANKS } from "../blocks";
import { FOTOS_DE_MUESTRA as F } from "./fotos";
import { bloque, diseno, enOrden, hero, menuDe, placa, type SiteTemplate } from "./tipos";

/**
 * Oscura — fondo oscuro, fotos protagonistas. El fondo oscuro sale de los colores sugeridos
 * (`backgroundColor`), que sólo se aplican si el dueño lo confirma: sin ellos la plantilla se ve
 * igual de ordenada sobre su fondo de siempre.
 */
export const PLANTILLA_OSCURA: SiteTemplate = {
  id: "oscura",
  nombre: "Oscura",
  descripcion: "Fondo oscuro y fotos a todo lo ancho: tu trabajo en primer plano.",
  paraQuien: "Fotografía urbana, de autor, nocturna o de conciertos.",
  recommendedFor: ["FREELANCE_PHOTOGRAPHER", "AGENCY_PRODUCTION"],
  tier: "free",
  layoutPreview: ["hero", "image", "image"],
  design: diseno({ headerPreset: "transparent-hero", buttonPreset: "square", typographyPreset: "photographic", animationPreset: "dynamic" }),
  coloresSugeridos: {
    primaryColor: "#f5f5f4",
    secondaryColor: "#0c0c0d",
    backgroundColor: "#0c0c0d",
    textColor: "#ececec",
    accentColor: "#d4a24c",
  },
  paginas: [
    {
      clave: "home",
      bloques: enOrden([
        hero(
          "oscura-portada",
          [
            placa("oscura-portada-1", {
              imageUrl: F.calleNoche.url,
              imageAlt: F.calleNoche.alt,
              title: "Tu nombre",
              subtitle: "Fotografía. Cambiá esta frase por la tuya.",
              overlay: "dark",
            }),
            placa("oscura-portada-2", {
              imageUrl: F.asfaltoMojado.url,
              imageAlt: F.asfaltoMojado.alt,
              title: "Reemplazá estas fotos por las tuyas",
              overlay: "dark",
            }),
          ],
          { heightPreset: "screen", transition: "slide", intervalMs: 7000 },
        ),
        bloque("oscura-trabajos", "PORTFOLIO", { title: "Trabajos", count: 9, layout: "masonry", showViewAll: true }),
        bloque("oscura-galeria", "GALLERY", {
          photos: [
            { id: "oscura-g1", url: F.calleOscura.url, alt: F.calleOscura.alt },
            { id: "oscura-g2", url: F.puenteNoche.url, alt: F.puenteNoche.alt },
            { id: "oscura-g3", url: F.ciudadLuces.url, alt: F.ciudadLuces.alt },
            { id: "oscura-g4", url: F.ciudadAtardecer.url, alt: F.ciudadAtardecer.alt },
            { id: "oscura-g5", url: F.retratoEstudio.url, alt: F.retratoEstudio.alt },
            { id: "oscura-g6", url: F.asfaltoMojado.url, alt: F.asfaltoMojado.alt },
          ],
          layout: "masonry",
          columns: 3,
          lightbox: true,
        }),
      ]),
    },
    {
      clave: "contacto",
      meta: { slug: "contacto", title: "Contacto" },
      bloques: enOrden([
        bloque("contacto-texto", "RICH_TEXT", {
          title: "Contacto",
          html: "<p>Contá acá para qué te pueden escribir: encargos, publicaciones, copias o exposiciones.</p>",
          align: "left",
          width: "narrow",
        }),
        bloque("contacto-formulario", "INQUIRY_FORM", {
          title: "Escribime",
          intro: "",
          categoryIds: [],
          askOrigin: true,
          askEventDate: false,
          askEventLocation: false,
          buttonLabel: INQUIRY_DEFAULT_BUTTON_LABEL,
          thanksMessage: INQUIRY_DEFAULT_THANKS,
        }),
        bloque("contacto-datos", "CONTACT", { title: "Redes y datos", useWorkspaceData: true, socials: [] }),
      ]),
    },
  ],
  menu: menuDe(["contacto"]),
};
