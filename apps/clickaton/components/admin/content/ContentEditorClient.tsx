"use client";

import { ContentEditor, type ContentEditorProps } from "@repo/content-ui";

export type ContentEditorClientProps = ContentEditorProps;

export default function ContentEditorClient(props: ContentEditorClientProps) {
  return <ContentEditor {...props} />;
}
