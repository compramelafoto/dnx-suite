"use client";

import { diagnosticsRequested, renderDiagnostics } from "@/lib/simulator/render-diagnostics";
import { useEffect, useState, useSyncExternalStore } from "react";

/** Recuadro con el diagnóstico del render (`?diag=1`), para sacarle una captura en el teléfono. */
export default function RenderDiagnosticsPanel() {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => setEnabled(diagnosticsRequested()), []);
  const diag = useSyncExternalStore(renderDiagnostics.subscribe, renderDiagnostics.get, () => null);
  if (!enabled) return null;
  return (
    <div className="cod-diag" role="status">
      <strong>Diagnóstico</strong>
      {diag ? (
        <>
          <p>{diag.gpu}</p>
          <p>
            {Object.entries(diag.limits)
              .map(([k, v]) => `${k}: ${v === true ? "sí" : v === false ? "no" : v}`)
              .join(" · ")}
          </p>
          {diag.contextLost ? <p className="cod-diag__bad">Se perdió el contexto gráfico (falta de memoria).</p> : null}
          <p className={diag.failures.length ? "cod-diag__bad" : ""}>
            Materiales que fallaron: {diag.failures.length}
          </p>
          {diag.failures.slice(0, 5).map((f) => (
            <p key={f} className="cod-diag__bad">
              {f}
            </p>
          ))}
        </>
      ) : (
        <p>Esperando el lienzo 3D…</p>
      )}
    </div>
  );
}
