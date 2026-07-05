import type { BlogSeoGoalPayload } from "@/data/blog/phase7/types";

/** Parsea el JSON de `BlogPost.seoGoal` (Fase 7+). */
export function parseBlogSeoGoal(raw: string | null | undefined): BlogSeoGoalPayload | null {
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as BlogSeoGoalPayload;
    if (parsed?.version !== 1 || !parsed.imagePlan) return null;
    return parsed;
  } catch {
    return null;
  }
}
