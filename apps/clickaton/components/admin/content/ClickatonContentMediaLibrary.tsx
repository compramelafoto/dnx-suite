"use client";

import { useMemo } from "react";
import { ContentMediaLibrary } from "@repo/content-ui";
import { createClickatonContentMediaAdapter } from "@/lib/content/clickaton-content-admin-adapter";

export default function ClickatonContentMediaLibrary() {
  const mediaAdapter = useMemo(() => createClickatonContentMediaAdapter(), []);
  return <ContentMediaLibrary mediaAdapter={mediaAdapter} mode="page" />;
}
