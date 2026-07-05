import type { JSONContent } from "@tiptap/core";
import { generateBlogHtml } from "@/lib/blog/generate-blog-html";
import { calculateReadingTimeFromContentJson } from "@/lib/blog/reading-time";
import type {
  BlogArticleImagePlan,
  BlogSeoGoalPayload,
  Phase7ArticleDraft,
} from "@/data/blog/phase7/types";

const IMAGE_STYLE_SUFFIX =
  "Ultra-realistic documentary photograph, natural ambient light, subtle film grain, 35mm lens aesthetic, authentic Latin American people and environments, candid corporate or editorial style, anatomically correct hands, no text, no logos, no watermarks, not CGI, not illustration, not cinematic exaggeration";

export function buildImagePlan(scene: string, altSubject: string): BlogArticleImagePlan {
  const sceneBlock = `${scene.trim()}. ${IMAGE_STYLE_SUFFIX}`;
  return {
    hero: {
      prompt: `${sceneBlock} Wide horizontal composition suitable for article hero banner.`,
      altText: `${altSubject} — guía en ComprameLaFoto`,
      caption: undefined,
    },
    thumbnail: {
      prompt: `${sceneBlock} Square-friendly crop with clear focal subject for listing cards.`,
      altText: `${altSubject} — miniatura del artículo`,
    },
    og: {
      prompt: `${sceneBlock} Balanced 1.91:1 social preview composition, realistic and trustworthy.`,
      altText: `${altSubject} — ComprameLaFoto`,
    },
  };
}

export function serializeSeoGoal(payload: BlogSeoGoalPayload): string {
  return JSON.stringify(payload, null, 2);
}

export function buildSeoGoalPayload(draft: Phase7ArticleDraft): BlogSeoGoalPayload {
  return {
    version: 1,
    audience: draft.audience,
    intents: draft.intents,
    imagePlan: buildImagePlan(draft.imageScene, draft.imageAltSubject),
    notes: draft.seoGoalNotes,
  };
}

function paragraph(text: string): JSONContent {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function heading(level: 2 | 3, text: string): JSONContent {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function bulletList(items: string[]): JSONContent {
  return {
    type: "bulletList",
    content: items.map((item) => ({
      type: "listItem",
      content: [paragraph(item)],
    })),
  };
}

export function buildDraftContentJson(
  intro: string,
  sections: string[],
  footer?: string
): JSONContent {
  const content: JSONContent[] = [paragraph(intro)];

  for (const section of sections) {
    content.push(heading(2, section));
    content.push(
      paragraph(
        "Contenido pendiente de redacción editorial. Este borrador define la estructura estratégica del artículo para SEO, IA y soporte."
      )
    );
  }

  if (footer) {
    content.push(heading(2, "Notas editoriales"));
    content.push(paragraph(footer));
  }

  return { type: "doc", content };
}

export async function prepareDraftForSeed(draft: Phase7ArticleDraft) {
  const contentJson =
    draft.contentJson ??
    buildDraftContentJson(
      draft.intro,
      draft.sections,
      "Borrador estratégico Fase 7 — expandir en edición antes de publicar. Los prompts de imagen están en seoGoal (imagePlan)."
    );
  const contentHtml = await generateBlogHtml(contentJson);
  const readingTimeMin = calculateReadingTimeFromContentJson(contentJson);
  const seoGoal = serializeSeoGoal(buildSeoGoalPayload(draft));

  return {
    ...draft,
    contentJson,
    contentHtml,
    readingTimeMin,
    seoGoal,
  };
}
