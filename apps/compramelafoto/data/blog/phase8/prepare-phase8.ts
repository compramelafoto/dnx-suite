import {
  buildImagePlan,
  serializeSeoGoal,
} from "@/data/blog/phase7/builders";
import type { BlogSeoGoalPayload, Phase7ArticleDraft } from "@/data/blog/phase7/types";
import { assembleContentJson } from "@/data/blog/phase8/editorial-nodes";
import { generatePhase8Content } from "@/data/blog/phase8/generate";
import type { Phase8ArticleContent, Phase8PreparedArticle } from "@/data/blog/phase8/types";
import { buildBlogPromoCtaHtml } from "@/lib/blog/blog-promo-cta-html";
import { generateBlogHtml } from "@/lib/blog/generate-blog-html";
import { calculateReadingTimeFromContentJson } from "@/lib/blog/reading-time";

function buildSeoGoalFromPhase8(
  draft: Phase7ArticleDraft,
  content: Phase8ArticleContent
): string {
  const imagePlan = buildImagePlan(content.imageScene, content.imageAltSubject);
  if (content.imageAltSubject) {
    imagePlan.hero.altText = content.imageAltSubject;
    imagePlan.og.altText = content.imageAltSubject;
    imagePlan.thumbnail.altText = content.imageAltSubject;
  }
  if (content.imageCaption) {
    imagePlan.hero.caption = content.imageCaption;
  }
  const payload: BlogSeoGoalPayload = {
    version: 1,
    audience: draft.audience,
    intents: draft.intents,
    imagePlan,
    notes: draft.seoGoalNotes,
    ...(content.faq.length > 0 ? { faq: content.faq } : {}),
  };
  return serializeSeoGoal(payload);
}

export async function preparePhase8Article(
  draft: Phase7ArticleDraft
): Promise<Phase8PreparedArticle> {
  const content = generatePhase8Content(draft);
  const contentJson = assembleContentJson(
    content.blocks,
    content.faq,
    content.conclusion,
    content.ctaAudience,
    content.promoCta,
  );
  let contentHtml = await generateBlogHtml(contentJson);
  if (content.promoCta) {
    contentHtml += buildBlogPromoCtaHtml(content.promoCta);
  }
  const readingTimeMin = calculateReadingTimeFromContentJson(contentJson);
  const seoGoal = buildSeoGoalFromPhase8(draft, content);

  return {
    ...draft,
    excerpt: content.excerpt,
    seoTitle: content.seoTitle,
    seoDescription: content.seoDescription,
    contentJson,
    contentHtml,
    readingTimeMin,
    seoGoal,
  };
}
