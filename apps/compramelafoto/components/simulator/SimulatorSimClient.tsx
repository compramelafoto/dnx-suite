"use client";

import { useSimulatorParamKeyboard } from "@/components/simulator/useSimulatorParamKeyboard";
import SimulatorCaptureSync from "@/components/simulator/SimulatorCaptureSync";
import SimulatorFocusKeyboardListener from "@/components/simulator/SimulatorFocusKeyboardListener";
import SimulatorParamPanel, {
  type SimulatorSideTabId,
} from "@/components/simulator/SimulatorParamPanel";
import SimulatorPhotoGallery from "@/components/simulator/SimulatorPhotoGallery";
import SimulatorRuntimeSync from "@/components/simulator/SimulatorRuntimeSync";
import SimulatorShell from "@/components/simulator/SimulatorShell";
import SimulatorShutterListener from "@/components/simulator/SimulatorShutterListener";
import SimulatorViewport from "@/components/simulator/SimulatorViewport";
import SimulatorZoomKeyboardListener from "@/components/simulator/SimulatorZoomKeyboardListener";
import { CameraProvider, useCameraStore } from "@/lib/simulator/camera-store";
import { useFullscreenElement } from "@/components/simulator/useFullscreenElement";
import { useRef, useState } from "react";

function SimulatorSimContent() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [sideTab, setSideTab] = useState<SimulatorSideTabId>("camera");
  const isFullscreen = useFullscreenElement(viewportRef);
  const { gallery } = useCameraStore();

  const { activeIndex } = useSimulatorParamKeyboard({
    onOpenHelp: () => setHelpOpen(true),
    disabled: helpOpen || galleryOpen || sideTab !== "camera",
  });

  return (
    <>
      <SimulatorRuntimeSync />
      <SimulatorCaptureSync />
      <SimulatorFocusKeyboardListener />
      <SimulatorShutterListener />
      <SimulatorZoomKeyboardListener />
      <SimulatorShell variant="simulator">
        <main className="cod-sim">
          <div className="cod-sim__body">
            <SimulatorViewport
              ref={viewportRef}
              isFullscreen={isFullscreen}
              helpOpen={helpOpen}
              onOpenHelp={() => setHelpOpen(true)}
              onCloseHelp={() => setHelpOpen(false)}
              onOpenGallery={() => setGalleryOpen(true)}
              photoCount={gallery.length}
            />

            <aside className="cod-sim__sidebar" aria-label="Panel de cámara y controles">
              <SimulatorParamPanel
                activeIndex={activeIndex}
                sideTab={sideTab}
                onSideTabChange={setSideTab}
              />
            </aside>
          </div>
        </main>
      </SimulatorShell>

      <SimulatorPhotoGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} />
    </>
  );
}

export default function SimulatorSimClient() {
  return (
    <CameraProvider>
      <SimulatorSimContent />
    </CameraProvider>
  );
}
