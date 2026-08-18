"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PHOTO_PROTECTION_LEGAL_TEXT } from "./protected-editorial-image";
import {
  INITIAL_CAPTURE_NOTICE_STATE,
  nextCaptureNoticeState,
  shouldTriggerCaptureNotice,
  type CaptureNoticeState,
} from "@/lib/editorial-photos/capture-notice-policy";

const AUTO_HIDE_MS = 5000;
const SESSION_KEY = "infospot.photoCaptureNotice";

function readSessionState(): CaptureNoticeState {
  if (typeof window === "undefined") return INITIAL_CAPTURE_NOTICE_STATE;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return INITIAL_CAPTURE_NOTICE_STATE;
    const parsed = JSON.parse(raw) as Partial<CaptureNoticeState>;
    return {
      count: typeof parsed.count === "number" ? parsed.count : 0,
      lastShownAt: typeof parsed.lastShownAt === "number" ? parsed.lastShownAt : 0,
    };
  } catch {
    return INITIAL_CAPTURE_NOTICE_STATE;
  }
}

function writeSessionState(state: CaptureNoticeState) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(state));
  } catch {
    /* modo privado / storage no disponible: degradar sin romper la página */
  }
}

/**
 * Detector global de señales de intento de captura — una sola instancia por
 * página, nunca una por foto (evita que N fotos protegidas disparen N
 * avisos simultáneos con el mismo PrintScreen).
 *
 * Limitación técnica real: ninguna página web puede detectar de forma
 * confiable ni impedir una captura de pantalla del sistema operativo. Esto
 * solo reacciona a señales parciales y visibles para JavaScript (tecla
 * PrintScreen, pérdida de visibilidad de la pestaña) y muestra un aviso
 * disuasorio con cooldown por sesión. No lee el portapapeles, no registra
 * teclas escritas por el usuario, no bloquea DevTools ni atajos de
 * navegación.
 */
export function PhotoCaptureNotice() {
  const [visible, setVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    const state = readSessionState();
    const now = Date.now();
    if (!shouldTriggerCaptureNotice(state, now)) return;
    writeSessionState(nextCaptureNoticeState(state, now));
    setVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setVisible(false), AUTO_HIDE_MS);
  }, []);

  useEffect(() => {
    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "PrintScreen") trigger();
    }
    function onVisibilityChange() {
      if (document.visibilityState === "hidden") trigger();
    }
    window.addEventListener("keyup", onKeyUp);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("keyup", onKeyUp);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [trigger]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto max-w-md rounded-[var(--is-radius)] border border-[var(--is-border)] bg-white/95 p-4 text-sm shadow-lg backdrop-blur sm:inset-x-auto sm:right-4"
    >
      <p className="font-medium">{PHOTO_PROTECTION_LEGAL_TEXT}</p>
      <button
        type="button"
        className="mt-3 rounded border border-[var(--is-border)] px-3 py-2 text-xs"
        onClick={() => setVisible(false)}
      >
        Entendido
      </button>
    </div>
  );
}
