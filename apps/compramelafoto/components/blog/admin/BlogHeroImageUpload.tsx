"use client";

import { useMemo } from "react";
import { ContentHeroImageField } from "@repo/content-ui";
import { createClfContentMediaAdapter } from "@/lib/blog/clf-content-admin-adapter";

type BlogHeroImageUploadProps = {
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
};

const ACCENT_STYLE = { ["--content-ui-accent" as string]: "#c27b3d" };

export default function BlogHeroImageUpload({ value, onChange, disabled }: BlogHeroImageUploadProps) {
  const mediaAdapter = useMemo(() => createClfContentMediaAdapter(), []);
  return (
    <div style={ACCENT_STYLE}>
      <ContentHeroImageField
        value={value}
        onChange={onChange}
        disabled={disabled}
        mediaAdapter={mediaAdapter}
      />
    </div>
  );
}
