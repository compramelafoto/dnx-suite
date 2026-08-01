import { routes } from "@/config/navigation";

export const storePageContent = {
  meta: {
    title: "Tienda",
    absoluteTitle: "Tienda | Clickatón",
    description: "Comprá productos oficiales de Clickatón.",
    path: routes.store,
  },
  hero: {
    eyebrow: "Tienda oficial",
    title: "TIENDA CLICKATÓN",
    description: "Productos oficiales de la comunidad Clickatón.",
  },
  empty: {
    title: "Estamos preparando la Tienda Oficial de Clickatón.",
    body: "Muy pronto vas a poder comprar productos oficiales desde aquí.",
  },
  badge: "Oficial Clickatón",
  cta: "Ver producto",
  catalogTitle: "Catálogo",
} as const;
