import Link from "next/link";
import { CameraProvider } from "@/lib/simulator/camera-store";
import SimulatorCameraHUD from "./SimulatorCameraHUD";

export default function SimulatorPreview() {
  return (
    <section className="cod-preview" aria-labelledby="cod-preview-title">
      <div className="cod-preview__inner">
        <p className="cod-section-label">Vista previa</p>
        <h2 id="cod-preview-title" className="cod-section-title">
          Interfaz del simulador
        </h2>

        <div className="cod-preview__frame">
          <span className="cod-preview__label">Preview — HUD fotográfico</span>
          <CameraProvider>
            <SimulatorCameraHUD />
          </CameraProvider>
          <div className="cod-sim__placeholder">
            <div className="cod-sim__placeholder-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none">
                <path
                  d="M4 7h4l1-2h6l1 2h4v12H4V7Z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="13" r="3" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </div>
            <p className="cod-sim__placeholder-title">Escena 3D próximamente</p>
            <p className="cod-sim__placeholder-hint">
              {/* TODO: React Three Fiber — escena navegable en primera persona */}
              Navegación FPS · Física · Colisiones
            </p>
          </div>
        </div>

        <p className="cod-preview__cta">
          <Link href="/camofduty/simulador" className="cod-btn cod-btn--primary">
            Probar la interfaz
          </Link>
        </p>
      </div>
    </section>
  );
}
