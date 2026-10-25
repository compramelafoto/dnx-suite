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
import TouchGameControls from "@/components/simulator/TouchGameControls";
import LessonPanel from "@/components/camofduty/course/LessonPanel";
import StreetLessonShots from "@/components/camofduty/course/StreetLessonShots";
import { lessonById } from "@/lib/camofduty/course/lessons";
import type { Lesson } from "@/lib/camofduty/course/types";
import { weatherStore } from "@/lib/simulator/weather";
import TouchGameStart from "@/components/simulator/TouchGameStart";
import { isTouchGameDevice } from "@/lib/simulator/touch-input";
import { setViewfinderCompact } from "@/lib/simulator/viewfinder-frame";
import { CameraProvider, useCameraStore } from "@/lib/simulator/camera-store";
import { useFullscreenElement } from "@/components/simulator/useFullscreenElement";
import { useEffect, useRef, useState } from "react";

function SimulatorSimContent() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [sideTab, setSideTab] = useState<SimulatorSideTabId>("camera");
  const isFullscreen = useFullscreenElement(viewportRef);
  const { gallery, setViewfinderMode, setMode, setIso, setTimeOfDayMinutes } = useCameraStore();
  // Tarea del curso (?leccion=…): prepara la escena y muestra la consigna.
  const [lesson, setLesson] = useState<Lesson | null>(null);
  // Celular: pantalla de juego con controles táctiles y el panel como cajón.
  const [touchMode, setTouchMode] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  // Los márgenes del visor se fijan antes de que el visor (hijo) mida su recuadro.
  useState(() => {
    if (typeof window !== "undefined") setViewfinderCompact(isTouchGameDevice());
  });
  useEffect(() => {
    const touch = isTouchGameDevice();
    setTouchMode(touch);
    // En el celular la pantalla muestra la exposición real (como la del teléfono):
    // con el visor óptico (DSLR) mover ISO, tiempo o diafragma no cambia la imagen.
    // Y arranca en prioridad de diafragma con ISO 100: en manual con los valores de
    // fábrica, de día, la primera imagen salía quemada (y con ISO 400 a f/2.8 ni 1/8000
    // alcanzaba). Se puede pasar a M desde los ajustes.
    if (touch) {
      setViewfinderMode("live-view");
      setMode("A");
      setIso(100);
    }
    const id = new URLSearchParams(window.location.search).get("leccion");
    const task = id ? lessonById(id) : null;
    if (task?.simulator === "calle") {
      if (task.setup.timeOfDayMinutes != null) setTimeOfDayMinutes(task.setup.timeOfDayMinutes);
      if (task.setup.weather) weatherStore.set(task.setup.weather);
      if (task.setup.mode) setMode(task.setup.mode);
      // En las tareas el visor muestra la exposición real: así se ve el efecto de cada ajuste.
      setViewfinderMode("live-view");
      setLesson(task);
    }
  }, [setViewfinderMode, setMode, setIso, setTimeOfDayMinutes]);

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
        <main className={`cod-sim${touchMode ? " cod-sim--touch" : ""}`}>
          <div className="cod-sim__body">
            <SimulatorViewport
              ref={viewportRef}
              isFullscreen={isFullscreen}
              helpOpen={helpOpen}
              onOpenHelp={() => setHelpOpen(true)}
              onCloseHelp={() => setHelpOpen(false)}
              onOpenGallery={() => setGalleryOpen(true)}
              photoCount={gallery.length}
              touchOverlay={touchMode ? <TouchGameControls onOpenPanel={() => setPanelOpen(true)} /> : null}
            />

            {touchMode && panelOpen ? (
              <button type="button" className="cod-sim__drawer-backdrop" aria-label="Cerrar ajustes" onClick={() => setPanelOpen(false)} />
            ) : null}
            <aside
              className={`cod-sim__sidebar${touchMode && panelOpen ? " cod-sim__sidebar--open" : ""}`}
              aria-label="Panel de cámara y controles"
            >
              {touchMode ? (
                <button type="button" className="cod-sim__drawer-close" onClick={() => setPanelOpen(false)}>
                  Volver a la cámara
                </button>
              ) : null}
              <SimulatorParamPanel
                activeIndex={activeIndex}
                sideTab={sideTab}
                onSideTabChange={setSideTab}
              />
            </aside>
          </div>
        </main>
      </SimulatorShell>

      {touchMode ? <TouchGameStart /> : null}
      {lesson ? (
        <>
          <StreetLessonShots />
          <LessonPanel lesson={lesson} />
        </>
      ) : null}

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
