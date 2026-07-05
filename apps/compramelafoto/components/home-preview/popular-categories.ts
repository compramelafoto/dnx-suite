/**
 * Categorías del home preview (estilo marketplace).
 * Imágenes en /public/home-preview/categories/
 */
export type PopularCategory = {
  id: string;
  label: string;
  href: string;
  image: string;
  gridClass: string;
  /** Altura fija del card (evita colapso del grid con next/image fill) */
  heightClass: string;
};

export const POPULAR_CATEGORIES: PopularCategory[] = [
  {
    id: "deportes",
    label: "Deportes",
    href: "#proximos-eventos",
    image: "/home-preview/categories/deportes.jpg",
    gridClass: "col-span-2 row-span-2 md:col-span-2 md:row-span-2",
    heightClass: "h-[14rem] sm:h-[18rem] md:h-[22rem]",
  },
  {
    id: "escuelas",
    label: "Escuelas",
    href: "#albumes-disponibles",
    image: "/home-preview/categories/escuelas.jpg",
    gridClass: "col-span-2 md:col-span-2",
    heightClass: "h-[10rem] sm:h-[11rem] md:h-[10.5rem]",
  },
  {
    id: "eventos-sociales",
    label: "Eventos sociales",
    href: "#proximos-eventos",
    image: "/home-preview/categories/eventos-sociales.jpg",
    gridClass: "col-span-1",
    heightClass: "h-[10rem] sm:h-[11rem] md:h-[10.5rem]",
  },
  {
    id: "carreras",
    label: "Carreras",
    href: "#proximos-eventos",
    image: "/home-preview/categories/carreras.jpg",
    gridClass: "col-span-1",
    heightClass: "h-[10rem] sm:h-[11rem] md:h-[10.5rem]",
  },
  {
    id: "clubes",
    label: "Clubes",
    href: "#proximos-eventos",
    image: "/home-preview/categories/clubes.jpg",
    gridClass: "col-span-1",
    heightClass: "h-[10rem] sm:h-[11rem] md:h-[10.5rem]",
  },
  {
    id: "fotografos",
    label: "Fotógrafos",
    href: "#ecosistema",
    image: "/home-preview/categories/fotografos.jpg",
    gridClass: "col-span-1",
    heightClass: "h-[10rem] sm:h-[11rem] md:h-[10.5rem]",
  },
];
