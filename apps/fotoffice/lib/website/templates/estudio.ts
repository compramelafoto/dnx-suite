import { TESTIMONIALS_DEFAULT_CTA } from "../blocks";
import { FOTOS_DE_MUESTRA as F } from "./fotos";
import { bloque, diseno, enOrden, hero, menuDe, placa, type SiteTemplate } from "./tipos";

/**
 * Estudio — estudio con local a la calle: servicios, fotos, dónde queda y cómo llegar.
 * El bloque de contacto toma los datos de la institución (`useWorkspaceData`); el mapa de
 * muestra es una búsqueda genérica de Google Maps que el dueño cambia por su dirección.
 */
const MAPA_DE_MUESTRA = "https://www.google.com/maps/search/?api=1&query=Tu+direcci%C3%B3n";

const contacto = (id: string, title: string) =>
  bloque(id, "CONTACT", {
    title,
    useWorkspaceData: true,
    address: "Escribí acá la dirección de tu estudio",
    mapsUrl: MAPA_DE_MUESTRA,
    socials: [],
  });

const servicios = (id: string, title: string) =>
  bloque(id, "RICH_TEXT", {
    title,
    html:
      "<p>Contá acá qué hacés en el estudio. Por ejemplo:</p>" +
      "<ul>" +
      "<li><strong>Retratos y book de fotos</strong> — sesiones en el estudio, con fondo y luz armados.</li>" +
      "<li><strong>Fotos para documentos</strong> — en el momento, listas para llevar.</li>" +
      "<li><strong>Impresiones y ampliaciones</strong> — de tus archivos o del celular.</li>" +
      "<li><strong>Turnos para sesiones</strong> — reservá con anticipación.</li>" +
      "</ul>" +
      "<p>Sumá precios de referencia si querés que la gente sepa cuánto dinero tiene que prever.</p>",
    align: "left",
    width: "normal",
  });

export const PLANTILLA_ESTUDIO: SiteTemplate = {
  id: "estudio",
  nombre: "Estudio",
  descripcion: "Servicios, fotos del estudio, dirección con mapa y lo que dicen tus clientes.",
  paraQuien: "Estudios con local: retratos, fotos carnet, impresiones y turnos.",
  recommendedFor: ["PHOTO_STUDIO", "PHOTOGRAPHY_COMPANY"],
  tier: "free",
  design: diseno({ headerPreset: "logo-left", buttonPreset: "rounded", typographyPreset: "contemporary", animationPreset: "soft", footerPreset: "columns" }),
  coloresSugeridos: {
    primaryColor: "#2f5d62",
    secondaryColor: "#1b2a2f",
    backgroundColor: "#ffffff",
    textColor: "#1b2a2f",
    accentColor: "#e07a5f",
  },
  paginas: [
    {
      clave: "home",
      bloques: enOrden([
        hero(
          "estudio-portada",
          [
            placa("estudio-portada-1", {
              imageUrl: F.retratoEncaje.url,
              imageAlt: F.retratoEncaje.alt,
              title: "El nombre de tu estudio",
              subtitle: "Retratos, fotos carnet e impresiones. Cambiá esta frase por la tuya.",
              showButton: true,
              buttonLabel: "Cómo llegar",
              buttonUrl: "#visitanos",
              align: "left",
              overlay: "medium",
            }),
          ],
          { heightPreset: "large" },
        ),
        servicios("estudio-servicios", "Qué hacemos"),
        bloque("estudio-galeria", "GALLERY", {
          title: "En el estudio",
          photos: [
            { id: "estudio-g1", url: F.retratoAnteojos.url, alt: F.retratoAnteojos.alt },
            { id: "estudio-g2", url: F.retratoSonrisa.url, alt: F.retratoSonrisa.alt },
            { id: "estudio-g3", url: F.parejaPared.url, alt: F.parejaPared.alt },
            { id: "estudio-g4", url: F.retratoEstudio.url, alt: F.retratoEstudio.alt },
            { id: "estudio-g5", url: F.noviosMadera.url, alt: F.noviosMadera.alt },
            { id: "estudio-g6", url: F.retratoEncaje.url, alt: F.retratoEncaje.alt },
          ],
          layout: "grid",
          columns: 3,
          lightbox: true,
        }),
        contacto("estudio-contacto", "Visitanos"),
        bloque("estudio-testimonios", "TESTIMONIALS", {
          title: "Lo que dicen nuestros clientes",
          count: 6,
          layout: "grid",
          showCta: true,
          ctaLabel: TESTIMONIALS_DEFAULT_CTA,
        }),
      ]),
    },
    {
      clave: "servicios",
      meta: { slug: "servicios", title: "Servicios" },
      bloques: enOrden([
        servicios("servicios-texto", "Servicios"),
        bloque("servicios-foto", "IMAGE", { imageUrl: F.retratoAnteojos.url, alt: F.retratoAnteojos.alt, caption: "", widthPreset: "contained" }),
        contacto("servicios-turnos", "Reservá tu turno"),
      ]),
    },
    {
      clave: "visitanos",
      meta: { slug: "visitanos", title: "Visitanos" },
      bloques: enOrden([
        bloque("visitanos-texto", "TEXT", {
          title: "Horarios",
          content: "Escribí acá tus horarios de atención. Por ejemplo: lunes a viernes de 9 a 13 y de 16 a 20; sábados de 9 a 13.",
          align: "left",
        }),
        contacto("visitanos-contacto", "Cómo llegar"),
      ]),
    },
  ],
  menu: menuDe(["servicios", "visitanos"]),
};
