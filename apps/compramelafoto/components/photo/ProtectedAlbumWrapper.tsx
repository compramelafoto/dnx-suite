"use client";

import { GateVisibilityProvider } from "@/contexts/GateVisibilityContext";
import ScreenshotProtection from "./ScreenshotProtection";

export default function ProtectedAlbumWrapper({
  children,
  enableProtection = true,
  albumId,
}: {
  children: React.ReactNode;
  enableProtection?: boolean;
  albumId?: number;
}) {
  return (
    <GateVisibilityProvider>
      <div data-protected-album={enableProtection ? "true" : undefined}>
        {enableProtection && <ScreenshotProtection albumId={albumId} />}
        {children}
      </div>
    </GateVisibilityProvider>
  );
}
