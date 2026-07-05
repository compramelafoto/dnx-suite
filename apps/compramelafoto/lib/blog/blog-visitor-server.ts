import { headers } from "next/headers";
import { BLOG_VISITOR_HEADER } from "@/lib/blog/blog-visitor";

/** Lee la clave de visitante que middleware dejó en el request actual. */
export async function getBlogVisitorKeyFromHeaders(): Promise<string | null> {
  const key = (await headers()).get(BLOG_VISITOR_HEADER)?.trim() ?? "";
  if (key.length < 8) return null;
  return key.slice(0, 64);
}
