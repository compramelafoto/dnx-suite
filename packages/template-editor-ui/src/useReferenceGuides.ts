"use client";

import { useCallback, useEffect, useState } from "react";
import {
  parseStoredReferenceGuides,
  REFERENCE_GUIDES_STORAGE_KEY,
  resolveReferenceGuides,
  withReferenceGuides,
  type ReferenceGuideSettings,
  type StoredReferenceGuides,
} from "@repo/template-editor-core";

function readStored(): StoredReferenceGuides {
  try {
    return parseStoredReferenceGuides(window.localStorage.getItem(REFERENCE_GUIDES_STORAGE_KEY));
  } catch {
    return {};
  }
}

/**
 * Qué guías de referencia (mitades y cuartos) se ven en el lienzo. Es una preferencia de quien
 * diseña, no de la plantilla: la recuerda el navegador, con una elección para libritos abiertos
 * y otra para hojas comunes. Sin almacenamiento (ventana privada) vale lo de fábrica y los
 * cambios duran la sesión.
 */
export function useReferenceGuides(isSpread: boolean): [ReferenceGuideSettings, (next: ReferenceGuideSettings) => void] {
  // Hasta montar se usa lo de fábrica, igual que en el servidor: así no hay diferencias al hidratar.
  const [stored, setStored] = useState<StoredReferenceGuides>({});
  useEffect(() => {
    setStored(readStored());
  }, []);

  const set = useCallback(
    (next: ReferenceGuideSettings) => {
      setStored((prev) => {
        const updated = withReferenceGuides(prev, isSpread, next);
        try {
          window.localStorage.setItem(REFERENCE_GUIDES_STORAGE_KEY, JSON.stringify(updated));
        } catch {
          // Sin almacenamiento: vale para esta sesión.
        }
        return updated;
      });
    },
    [isSpread]
  );

  return [resolveReferenceGuides(stored, isSpread), set];
}
