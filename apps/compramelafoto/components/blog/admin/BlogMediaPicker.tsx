"use client";

import { useMemo } from "react";
import { ContentMediaPicker, type ContentMediaItem } from "@repo/content-ui";
import { createClfContentMediaAdapter } from "@/lib/blog/clf-content-admin-adapter";

export type BlogMediaItem = ContentMediaItem;

type BlogMediaPickerProps = {
  open: boolean;
  onClose: () => void;
  onSelect: (item: BlogMediaItem) => void;
};

const ACCENT_STYLE = { ["--content-ui-accent" as string]: "#c27b3d" };

export default function BlogMediaPicker({ open, onClose, onSelect }: BlogMediaPickerProps) {
  const mediaAdapter = useMemo(() => createClfContentMediaAdapter(), []);
  return (
    <div style={ACCENT_STYLE}>
      <ContentMediaPicker
        open={open}
        onClose={onClose}
        onSelect={onSelect}
        mediaAdapter={mediaAdapter}
      />
    </div>
  );
}
