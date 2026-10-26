import { FOTOS_DE_MUESTRA as F } from "./fotos";
import { bloque, diseno, enOrden, hero, menuDe, placa, type SiteTemplate } from "./tipos";

/**
 * Institución — la vieja «Institucional» (Hero, Sobre nosotros, sumate) más las novedades del
 * blog y el contacto. Pensada para SFPR, Gus Barbers y cualquier asociación o escuela: las
 * páginas de socios, cursos o sorteos las agregan solos sus módulos, por eso no van acá.
 */
export const PLANTILLA_INSTITUCION: SiteTemplate = {
  id: "institucion",
  nombre: "Institución",
  descripcion: "Sobria y clara: quiénes son, cómo sumarse, las novedades del blog y el contacto.",
  paraQuien: "Asociaciones, clubes, escuelas y organizaciones culturales.",
  recommendedFor: ["PHOTOGRAPHERS_ASSOCIATION", "CULTURAL_ORGANIZATION", "NONPROFIT", "EDUCATIONAL_INSTITUTION"],
  tier: "free",
  layoutPreview: ["hero", "text", "cta", "text"],
  design: diseno({ headerPreset: "logo-left", buttonPreset: "square", typographyPreset: "institutional", animationPreset: "none", footerPreset: "columns" }),
  coloresSugeridos: null,
  paginas: [
    {
      clave: "home",
      bloques: enOrden([
        hero(
          "institucion-portada",
          [
            placa("institucion-portada-1", {
              imageUrl: F.ciudadAtardecer.url,
              imageAlt: F.ciudadAtardecer.alt,
              title: "Bienvenidos",
              subtitle: "Contanos quiénes son en una frase. Cambiá esta foto por una de la institución.",
              overlay: "medium",
            }),
          ],
          { heightPreset: "large" },
        ),
        bloque("institucion-nosotros", "TEXT", {
          title: "Sobre nosotros",
          content: "Contá acá la historia de tu organización: cuándo nació, qué hace y a quiénes reúne.",
          align: "left",
        }),
        bloque("institucion-sumate", "CTA", {
          title: "¿Querés sumarte?",
          text: "Contá acá cómo asociarse y qué beneficios tiene.",
          buttonLabel: "Contactanos",
          buttonUrl: "#contacto",
          stylePreset: "solid",
        }),
        bloque("institucion-blog", "BLOG_LATEST", { title: "Novedades", count: 3, showExcerpt: true }),
        bloque("institucion-contacto", "CONTACT", { title: "Contacto", useWorkspaceData: true, socials: [] }),
      ]),
    },
  ],
  menu: menuDe([]),
};
