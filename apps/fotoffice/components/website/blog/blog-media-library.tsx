"use client";

import { useMemo } from "react";
import { ContentMediaLibrary } from "@repo/content-ui";
import { createBlogMediaAdapter } from "@/lib/blog/admin-client";
import { BLOG_EDITOR_ACCENT_STYLE, BLOG_EDITOR_LABELS } from "@/lib/blog/admin-labels";

/** La biblioteca de imágenes del blog como pantalla propia (la misma que se abre desde el editor). */
export function BlogMediaLibrary() {
  const mediaAdapter = useMemo(() => createBlogMediaAdapter(), []);
  return (
    <div style={BLOG_EDITOR_ACCENT_STYLE} className="fo-card">
      <ContentMediaLibrary mediaAdapter={mediaAdapter} mode="page" labels={BLOG_EDITOR_LABELS} />
    </div>
  );
}
