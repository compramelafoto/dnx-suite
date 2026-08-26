"use client";

import { useMemo } from "react";
import {
  ContentMediaLibrary,
  type ContentMediaItem,
  type ContentMediaLibraryProps,
} from "@repo/content-ui";
import { createClfContentMediaAdapter } from "@/lib/blog/clf-content-admin-adapter";

export type BlogMediaItem = ContentMediaItem;

type BlogMediaLibraryProps = {
  mode?: ContentMediaLibraryProps["mode"];
  onSelect?: (item: BlogMediaItem) => void;
};

const ACCENT_STYLE = { ["--content-ui-accent" as string]: "#c27b3d" };

export default function BlogMediaLibrary({ mode = "page", onSelect }: BlogMediaLibraryProps) {
  const mediaAdapter = useMemo(() => createClfContentMediaAdapter(), []);
  return (
    <div style={ACCENT_STYLE}>
      <ContentMediaLibrary mediaAdapter={mediaAdapter} mode={mode} onSelect={onSelect} />
    </div>
  );
}
