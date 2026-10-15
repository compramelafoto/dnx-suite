"use client";

import { ContentEditor, type ContentEditorProps } from "@repo/content-ui";

/** El editor TipTap, aparte para cargarlo sólo en el navegador (`next/dynamic` con `ssr: false`). */
export default function BlogEditorClient(props: ContentEditorProps) {
  return <ContentEditor {...props} />;
}
