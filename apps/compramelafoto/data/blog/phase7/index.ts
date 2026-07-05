import { CASOS_ARTICLES } from "@/data/blog/phase7/catalog-casos";
import { COMPARATIVAS_ARTICLES } from "@/data/blog/phase7/catalog-comparativas";
import { FUNCIONALIDADES_ARTICLES } from "@/data/blog/phase7/catalog-funcionalidades";
import { NEGOCIO_ARTICLES } from "@/data/blog/phase7/catalog-negocio";
import { REFERIDOS_FEATURED_ARTICLE, REFERIDOS_PROGRAMA_ARTICLE } from "@/data/blog/phase7/catalog-referidos";
import { TUTORIALES_ARTICLES } from "@/data/blog/phase7/catalog-tutoriales";
import type { Phase7ArticleDraft } from "@/data/blog/phase7/types";

export { PHASE7_CATEGORIES, PHASE7_TAGS } from "@/data/blog/phase7/categories";
export type {
  BlogArticleImagePlan,
  BlogImageAssetBrief,
  BlogSeoGoalPayload,
  Phase7ArticleDraft,
} from "@/data/blog/phase7/types";
export {
  buildDraftContentJson,
  buildImagePlan,
  buildSeoGoalPayload,
  prepareDraftForSeed,
  serializeSeoGoal,
} from "@/data/blog/phase7/builders";

export const PHASE7_ALL_ARTICLES: Phase7ArticleDraft[] = [
  ...TUTORIALES_ARTICLES,
  ...FUNCIONALIDADES_ARTICLES,
  ...COMPARATIVAS_ARTICLES,
  ...NEGOCIO_ARTICLES,
  ...CASOS_ARTICLES,
  REFERIDOS_FEATURED_ARTICLE,
  REFERIDOS_PROGRAMA_ARTICLE,
];

export const PHASE7_ARTICLE_COUNT = PHASE7_ALL_ARTICLES.length;
