import {
  emptyJudgeBioDocument,
  emptyJudgeOtherLinksDocument,
  parseAndValidateJudgeBioDocument,
  parseAndValidateJudgeOtherLinks,
  type JudgeBioDocument,
  type JudgeOtherLinksDocument,
} from "./judgeBioRich";

export function safeJudgeBioForPublicRender(input: unknown): JudgeBioDocument {
  const p = parseAndValidateJudgeBioDocument(input);
  return p.ok ? p.doc : emptyJudgeBioDocument();
}

export function safeJudgeOtherLinksForPublicRender(input: unknown): JudgeOtherLinksDocument {
  const p = parseAndValidateJudgeOtherLinks(input);
  return p.ok ? p.doc : emptyJudgeOtherLinksDocument();
}

/** Construye URL de perfil de Instagram a partir del valor guardado (handle o URL). */
export function instagramProfileHref(stored: string | null | undefined): string | null {
  if (!stored?.trim()) return null;
  const s = stored.trim();
  if (/^https?:\/\//i.test(s)) return s;
  const handle = s.replace(/^@+/, "").replace(/\/+$/, "");
  if (!handle) return null;
  return `https://www.instagram.com/${encodeURIComponent(handle)}`;
}
