"use client";

import { useEffect, useState } from "react";

export type EscolarPanelInfo = {
  name: string | null;
  phone: string | null;
  schoolsCount: number;
  hasPublicHandler: boolean;
  isPublicPageEnabled: boolean;
  openRequest: { id: number } | null;
};

/** "forbidden": no es fotógrafo (o no hay sesión) → los llamadores no se muestran. */
export type EscolarPanelInfoState =
  | { status: "loading"; info: null }
  | { status: "ready"; info: EscolarPanelInfo }
  | { status: "forbidden"; info: null }
  | { status: "error"; info: null };

// Una sola consulta por carga de página aunque haya varios llamadores.
let pending: Promise<EscolarPanelInfoState> | null = null;

function fetchInfo(): Promise<EscolarPanelInfoState> {
  if (!pending) {
    pending = fetch("/api/fotografo/escolar/asistencia", { credentials: "include", cache: "no-store" })
      .then(async (res): Promise<EscolarPanelInfoState> => {
        if (res.status === 401 || res.status === 403) return { status: "forbidden", info: null };
        if (!res.ok) return { status: "error", info: null };
        const json = (await res.json()) as EscolarPanelInfo;
        return { status: "ready", info: json };
      })
      .catch((): EscolarPanelInfoState => ({ status: "error", info: null }));
    // Que la próxima navegación vuelva a preguntar (puede haber cargado una institución).
    pending.finally(() => {
      setTimeout(() => {
        pending = null;
      }, 0);
    });
  }
  return pending;
}

/**
 * `initial` permite a la página temporal de vista previa (y a tests) inyectar datos
 * sin pegarle a la API.
 */
export function useEscolarPanelInfo(initial?: EscolarPanelInfo | null): EscolarPanelInfoState {
  const [state, setState] = useState<EscolarPanelInfoState>(
    initial ? { status: "ready", info: initial } : { status: "loading", info: null }
  );
  useEffect(() => {
    if (initial) return;
    let active = true;
    fetchInfo().then((s) => {
      if (active) setState(s);
    });
    return () => {
      active = false;
    };
  }, [initial]);
  return state;
}
