"use client";

import { useCallback, useEffect, useRef } from "react";
import type { TemplateV2EditorState } from "@/lib/template-v2/editor-store";

/**
 * Tiempo de inactividad antes de disparar el guardado automático (ms).
 * Entre 1200–2500; 2000 equilibra respuesta y menos requests durante drag continuo.
 */
export const TEMPLATE_V2_AUTOSAVE_DEBOUNCE_MS = 2000;

type Options = {
  /** Por defecto {@link TEMPLATE_V2_AUTOSAVE_DEBOUNCE_MS}. */
  debounceMs?: number;
  state: TemplateV2EditorState;
  /** Equivalente a `loadStatus === "ready"`. */
  loadReady: boolean;
  templateId: string;
  versionId: string;
  /** Debe leer el estado actual (p. ej. vía ref) y reutilizar la lógica del guardado manual. */
  performSave: () => void | Promise<void>;
};

/**
 * Programa un guardado tras inactividad cuando hay cambios pendientes.
 * No ejecuta si no está cargado, no hay dirty, o ya hay un save en curso.
 * Limpia el timer al cambiar de plantilla/versión o al desmontar.
 */
export function useTemplateEditorAutosave(options: Options): { cancelPendingAutosave: () => void } {
  const {
    debounceMs = TEMPLATE_V2_AUTOSAVE_DEBOUNCE_MS,
    state,
    loadReady,
    templateId,
    versionId,
    performSave,
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelPendingAutosave = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!loadReady || !state.isDirty || state.isSaving) {
      return;
    }

    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      void Promise.resolve(performSave());
    }, debounceMs);

    return () => {
      cancelPendingAutosave();
    };
  }, [
    debounceMs,
    loadReady,
    templateId,
    versionId,
    cancelPendingAutosave,
    performSave,
    state.isDirty,
    state.isSaving,
    state.canvas,
    state.blocks,
    state.variableBindings,
  ]);

  return { cancelPendingAutosave };
}
