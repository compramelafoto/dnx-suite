export type {
  CtaAudience,
  EditorialBlock,
  EditorialFaqItem,
  Phase8ArticleContent,
  Phase8PreparedArticle,
} from "@/data/blog/phase8/types";
export { resolveCtaAudience, buildCtaParagraph, CTA_URLS } from "@/data/blog/phase8/cta";
export { assembleContentJson, p, h2, h3, ul } from "@/data/blog/phase8/editorial-nodes";
export { generatePhase8Content, listPhase8ContentSlugs } from "@/data/blog/phase8/generate";
export { preparePhase8Article } from "@/data/blog/phase8/prepare-phase8";
export { wordTargetForCategory, countWords, countBlocksWords, WORD_TARGETS } from "@/data/blog/phase8/word-targets";
