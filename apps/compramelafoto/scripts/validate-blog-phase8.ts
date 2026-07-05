/**
 * Valida contenido Fase 8: cobertura, palabras, estructura, seoGoal, sin placeholders.
 * Ejecutar: npx tsx scripts/validate-blog-phase8.ts
 */

import { PHASE7_ALL_ARTICLES } from "@/data/blog/phase7";
import { CTA_URLS } from "@/data/blog/phase8/cta";
import { generatePhase8Content, listPhase8ContentSlugs } from "@/data/blog/phase8/generate";
import { assembleContentJson } from "@/data/blog/phase8/editorial-nodes";
import { countBlocksWords, countWords, wordTargetForCategory } from "@/data/blog/phase8/word-targets";
import { parseBlogSeoGoal } from "@/lib/blog/blog-seo-goal";

const PLACEHOLDER_PATTERNS = [
  /contenido pendiente de redacción/i,
  /borrador estratégico fase 7/i,
  /pendiente de redacción editorial/i,
  /completar con tabla/i,
  /notas editoriales/i,
];

function extractTextFromJson(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const n = node as { type?: string; text?: string; content?: unknown[] };
  let text = n.text ?? "";
  if (Array.isArray(n.content)) {
    for (const child of n.content) {
      text += " " + extractTextFromJson(child);
    }
  }
  return text;
}

function hasStructure(contentJson: ReturnType<typeof assembleContentJson>): boolean {
  const text = extractTextFromJson(contentJson);
  const hasH2 = contentJson.content?.some(
    (n) => (n as { type?: string; attrs?: { level?: number } }).type === "heading" &&
      (n as { attrs?: { level?: number } }).attrs?.level === 2
  );
  const hasH3 = contentJson.content?.some(
    (n) => (n as { type?: string; attrs?: { level?: number } }).type === "heading" &&
      (n as { attrs?: { level?: number } }).attrs?.level === 3
  );
  const hasFaq = /preguntas frecuentes/i.test(text);
  const hasConclusion = /conclusión/i.test(text);
  const hasCta = Object.values(CTA_URLS).some((url) => text.includes(url));
  return Boolean(hasH2 && hasH3 && hasFaq && hasConclusion && hasCta);
}

async function main() {
  console.log("🔍 Validación Fase 8 — contenido editorial del blog\n");

  const phase8Slugs = new Set(listPhase8ContentSlugs());
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const draft of PHASE7_ALL_ARTICLES) {
    if (!phase8Slugs.has(draft.slug)) {
      errors.push(`[${draft.slug}] Sin contenido Fase 8`);
      continue;
    }

    const content = generatePhase8Content(draft);
    const contentJson = assembleContentJson(
      content.blocks,
      content.faq,
      content.conclusion,
      content.ctaAudience
    );
    const fullText = extractTextFromJson(contentJson);
    const wordCount =
      countBlocksWords(content.blocks) +
      countWords(content.conclusion) +
      content.faq.reduce((acc, f) => acc + countWords(f.q) + countWords(f.a), 0);

    const target = wordTargetForCategory(draft.categorySlug);
    if (wordCount < target.min) {
      warnings.push(
        `[${draft.slug}] ${wordCount} palabras (mínimo ${target.min} para ${draft.categorySlug})`
      );
    }
    if (wordCount > target.max + 500) {
      warnings.push(`[${draft.slug}] ${wordCount} palabras (máximo sugerido ${target.max})`);
    }

    if (!content.seoTitle?.trim()) errors.push(`[${draft.slug}] seoTitle vacío`);
    if (!content.seoDescription?.trim()) errors.push(`[${draft.slug}] seoDescription vacío`);
    if (!content.excerpt?.trim()) errors.push(`[${draft.slug}] excerpt vacío`);
    if (content.faq.length < 4) errors.push(`[${draft.slug}] FAQ insuficiente (${content.faq.length})`);
    if (!content.conclusion?.trim()) errors.push(`[${draft.slug}] conclusion vacía`);

    for (const pattern of PLACEHOLDER_PATTERNS) {
      if (pattern.test(fullText)) {
        errors.push(`[${draft.slug}] Contiene placeholder: ${pattern}`);
      }
    }

    if (!hasStructure(contentJson)) {
      errors.push(`[${draft.slug}] Estructura incompleta (H2/H3/FAQ/Conclusión/CTA)`);
    }

    const seoGoalPayload = {
      version: 1 as const,
      audience: draft.audience,
      intents: draft.intents,
      imagePlan: {
        hero: {
          prompt: content.imageScene,
          altText: content.imageAltSubject,
          caption: content.imageCaption,
        },
        thumbnail: { prompt: content.imageScene, altText: content.imageAltSubject },
        og: { prompt: content.imageScene, altText: content.imageAltSubject },
      },
    };
    const parsed = parseBlogSeoGoal(JSON.stringify(seoGoalPayload));
    if (!parsed?.imagePlan?.hero?.prompt) {
      errors.push(`[${draft.slug}] imagePlan inválido`);
    }
    if (/text overlay|futuristic|cgi|illustration/i.test(content.imageScene)) {
      warnings.push(`[${draft.slug}] imageScene podría violar guía de estilo`);
    }
  }

  const extraSlugs = [...phase8Slugs].filter(
    (s) => !PHASE7_ALL_ARTICLES.some((d) => d.slug === s)
  );
  if (extraSlugs.length > 0) {
    warnings.push(`Slugs Fase 8 sin draft Fase 7: ${extraSlugs.join(", ")}`);
  }

  console.log(`Artículos validados: ${PHASE7_ALL_ARTICLES.length}`);
  console.log(`Contenidos Fase 8: ${phase8Slugs.size}`);

  if (warnings.length > 0) {
    console.log(`\n⚠ Advertencias (${warnings.length}):`);
    for (const w of warnings) console.log(`  - ${w}`);
  }

  if (errors.length > 0) {
    console.log(`\n❌ Errores (${errors.length}):`);
    for (const e of errors) console.log(`  - ${e}`);
    process.exit(1);
  }

  console.log("\n✅ Validación Fase 8 OK.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
