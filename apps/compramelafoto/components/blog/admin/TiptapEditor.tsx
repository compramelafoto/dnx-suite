"use client";

import { ContentEditor, type ContentEditorProps } from "@repo/content-ui";

const ACCENT_STYLE = { ["--content-ui-accent" as string]: "#c27b3d" };

export type TiptapEditorProps = ContentEditorProps;

export default function TiptapEditor(props: TiptapEditorProps) {
  return (
    <div style={ACCENT_STYLE}>
      <ContentEditor {...props} />
    </div>
  );
}
