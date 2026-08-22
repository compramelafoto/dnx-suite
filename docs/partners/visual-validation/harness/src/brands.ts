/**
 * Marcas de la demo comercial, en orden intercalado: cliente · ecosistema.
 *
 * Cinco clientes y cinco plataformas propias. Los archivos son los mismos que
 * sirve `apps/<app>/public/partners-demo/`.
 *
 * `logo`     placa uniforme para la franja de logos
 * `banner`   variante apaisada 4:1 para el banner horizontal
 * `creative` pieza gráfica completa 1:1 para la placa de bienvenida — cuando
 *            existe, el modal la muestra sola: el mensaje ya está en la imagen,
 *            que es lo que entrega un anunciante real.
 */
export type DemoBrand = {
  slug: string;
  name: string;
  kind: "cliente" | "ecosistema";
  logo: string;
  banner: string;
  creative?: string;
  title: string;
  body: string;
  ctaText: string;
};

export const BRANDS: DemoBrand[] = [
  {
    slug: "copy-express",
    name: "COPY express",
    kind: "cliente",
    logo: "/partners-demo/copy-express.png",
    banner: "/partners-demo/banner-copy-express.png",
    title: "COPY express acompaña este evento",
    body: "Centro de imágenes digitales. Impresión y copias en el día.",
    ctaText: "Conocer COPY express",
  },
  {
    slug: "clickaton",
    name: "Clickatón",
    kind: "ecosistema",
    logo: "/partners-demo/clickaton.png",
    banner: "/partners-demo/banner-clickaton.png",
    title: "Se viene una nueva Clickatón",
    body: "La maratón fotográfica que recorre la ciudad en un solo día.",
    ctaText: "Ver la próxima edición",
  },
  {
    slug: "dvv",
    name: "DVV",
    kind: "cliente",
    logo: "/partners-demo/dvv.png",
    banner: "/partners-demo/banner-dvv.png",
    title: "DVV Digital Video",
    body: "Producción audiovisual para eventos y marcas.",
    ctaText: "Conocer DVV",
  },
  {
    slug: "fotorank",
    name: "FotoRank",
    kind: "ecosistema",
    logo: "/partners-demo/fotorank.png",
    banner: "/partners-demo/banner-fotorank.png",
    title: "¿Ya conocés FotoRank?",
    body: "Concursos de fotografía con jurado y votación del público.",
    ctaText: "Ver los concursos abiertos",
  },
  {
    slug: "photostraps",
    name: "PhotoStraps",
    kind: "cliente",
    logo: "/partners-demo/photostraps.png",
    banner: "/partners-demo/banner-photostraps.png",
    creative: "/partners-demo/creative-photostraps.jpg",
    title: "Tu cámara merece una buena correa",
    body: "Cuero genuino, cosida a mano.",
    ctaText: "Ver el catálogo",
  },
  {
    slug: "compramelafoto",
    name: "ComprameLaFoto",
    kind: "ecosistema",
    logo: "/partners-demo/compramelafoto.png",
    banner: "/partners-demo/banner-compramelafoto.png",
    title: "Tus fotos del evento, en un solo lugar",
    body: "Buscá y comprá las fotos donde aparecés.",
    ctaText: "Buscar mis fotos",
  },
  {
    slug: "mucha-escuela",
    name: "Mucha Escuela",
    kind: "cliente",
    logo: "/partners-demo/mucha-escuela.png",
    banner: "/partners-demo/banner-mucha-escuela.png",
    title: "Mucha Escuela",
    body: "Formación para creadores. Cursos y talleres todo el año.",
    ctaText: "Ver los cursos",
  },
  {
    slug: "infospot",
    name: "InfoSpot",
    kind: "ecosistema",
    logo: "/partners-demo/infospot.png",
    banner: "/partners-demo/banner-infospot.png",
    title: "InfoSpot",
    body: "Cobertura editorial de eventos.",
    ctaText: "Leer InfoSpot",
  },
  {
    slug: "terraza-bistro",
    name: "Terraza Bistró",
    kind: "cliente",
    logo: "/partners-demo/terraza-bistro.png",
    banner: "/partners-demo/banner-terraza-bistro.png",
    creative: "/partners-demo/creative-terraza-bistro.jpg",
    title: "Después de la foto, la mesa",
    body: "Reservá online y sentate donde termina el día.",
    ctaText: "Reservar mesa",
  },
  {
    slug: "fotoffice",
    name: "FotoOffice",
    kind: "ecosistema",
    logo: "/partners-demo/fotoffice.png",
    banner: "/partners-demo/banner-fotoffice.png",
    title: "¿Sos fotógrafo? Conocé FotoOffice",
    body: "Gestión de estudio, clientes y entregas en un solo lugar.",
    ctaText: "Conocer FotoOffice",
  },
];

export function brandBySlug(slug: string | null): DemoBrand {
  return BRANDS.find((b) => b.slug === slug) ?? BRANDS[0];
}
