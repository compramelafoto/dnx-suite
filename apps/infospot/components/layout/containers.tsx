/**
 * Compat layer — reexporta foundations.
 * Preferir imports desde `@/components/foundations`.
 */

export {
  SiteContainer,
  EditorialContainer,
  ArticleContainer,
  WideContainer,
  Section,
} from "@/components/foundations";

/** @deprecated Preferir `ArticleContainer` */
export { ArticleContainer as ArticleBodyContainer } from "@/components/foundations";

/** @deprecated Preferir `WideContainer` */
export { WideContainer as WideMediaContainer } from "@/components/foundations";
