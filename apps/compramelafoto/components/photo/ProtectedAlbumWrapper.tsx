"use client";

import { GateVisibilityProvider } from "@/contexts/GateVisibilityContext";
import CopyrightNotice from "./CopyrightNotice";
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
        {enableProtection && (
          <div className="mx-auto w-full max-w-[48rem] px-4 pt-2 pb-8">
            <CopyrightNotice />
          </div>
        )}
      </div>
    </GateVisibilityProvider>
  );
}
