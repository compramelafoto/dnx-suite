"use client";

import { useEffect, useState, useRef } from "react";
import { useGateVisibility } from "@/contexts/GateVisibilityContext";

export default function ScreenshotProtection({ albumId }: { albumId?: number }) {
  const gate = useGateVisibility();
  const [isBlurred, setIsBlurred] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [popup, setPopup] = useState<{ x: number; y: number } | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastLogRef = useRef<number>(0);
  const visibilityChangeTimeRef = useRef<number>(0);
  const modifierKeyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function clearModifierKeyTimeout() {
      if (modifierKeyTimeoutRef.current) {
        clearTimeout(modifierKeyTimeoutRef.current);
        modifierKeyTimeoutRef.current = null;
      }
    }

    function clearBlurTimeout() {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
    }

    function clearBlockTimeout() {
      if (blockTimeoutRef.current) {
        clearTimeout(blockTimeoutRef.current);
        blockTimeoutRef.current = null;
      }
    }

    async function logScreenshotAttempt(reason: string) {
      if (!albumId) return;
      const now = Date.now();
      if (now - lastLogRef.current < 5000) return;
      lastLogRef.current = now;
      try {
        await fetch(`/api/a/${albumId}/screenshot-log`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
      } catch {}
    }

    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const blurDurationMs = isMobile ? 2000 : 4000;
    const blockDurationMs = isMobile ? 2500 : 4000;
    const mobileCooldownRef = { current: 0 };
    const MOBILE_COOLDOWN_MS = 20000; // En móvil no disparar de nuevo por 20s (evita racha de falsos positivos)

    function triggerBlur() {
      if (isMobile && Date.now() < mobileCooldownRef.current) return;
      if (isMobile) mobileCooldownRef.current = Date.now() + MOBILE_COOLDOWN_MS;
      setIsBlurred(true);
      clearBlurTimeout();
      blurTimeoutRef.current = setTimeout(() => {
        setIsBlurred(false);
        blurTimeoutRef.current = null;
      }, blurDurationMs);
      void logScreenshotAttempt("shortcut_detected");
    }

    function triggerBlock() {
      if (isMobile && Date.now() < mobileCooldownRef.current) return;
      if (isMobile) mobileCooldownRef.current = Date.now() + MOBILE_COOLDOWN_MS;
      setIsBlocked(true);
      setIsBlurred(true);
      clearBlockTimeout();
      clearBlurTimeout();
      void logScreenshotAttempt("visibility_lost_mobile");
      blockTimeoutRef.current = setTimeout(() => {
        setIsBlocked(false);
        setIsBlurred(false);
        blockTimeoutRef.current = null;
      }, blockDurationMs);
    }

    function isScreenshotShortcut(e: KeyboardEvent) {
      const key = e.key.toLowerCase();
      if (e.key === "PrintScreen") return true;
      const isCmd = e.metaKey && e.shiftKey && (key === "3" || key === "4" || key === "5");
      const isCtrl = e.ctrlKey && e.shiftKey && key === "s";
      return isCmd || isCtrl;
    }

    function isModifierOnlyKey(e: KeyboardEvent) {
      const k = e.key;
      return k === "Meta" || k === "Shift" || k === "Alt";
    }

    const MODIFIER_TRIGGER_DELAY_MS = 350;

    function handleKeyDown(e: KeyboardEvent) {
      if (isScreenshotShortcut(e)) {
        clearModifierKeyTimeout();
        triggerBlur();
        return;
      }
      if (isModifierOnlyKey(e)) {
        clearModifierKeyTimeout();
        modifierKeyTimeoutRef.current = setTimeout(() => {
          modifierKeyTimeoutRef.current = null;
          triggerBlur();
          void logScreenshotAttempt("modifier_key_held");
        }, MODIFIER_TRIGGER_DELAY_MS);
        return;
      }
      clearModifierKeyTimeout();
    }

    function handleContextMenu(e: MouseEvent) {
      e.preventDefault();
      e.stopPropagation();
      setPopup({ x: e.clientX, y: e.clientY });
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
      popupTimeoutRef.current = setTimeout(() => {
        setPopup(null);
        popupTimeoutRef.current = null;
      }, 2000);
    }

    function handleTouchStart(e: TouchEvent) {
      // Long-press en imágenes: umbral alto en móvil para no interferir con deslizar/scroll
      const longPressThreshold = isMobile ? 850 : 500;
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG" || target.closest("img")) {
        const touch = e.touches[0];
        if (touch) {
          const startTime = Date.now();
          const startX = touch.clientX;
          const startY = touch.clientY;
          const maxMovePx = isMobile ? 15 : 10; // En móvil permitir más movimiento para no confundir con scroll
          const handleTouchEnd = (e2: TouchEvent) => {
            const duration = Date.now() - startTime;
            const endTouch = e2.changedTouches?.[0];
            const moved = endTouch
              ? Math.hypot(endTouch.clientX - startX, endTouch.clientY - startY) > maxMovePx
              : false;
            if (duration > longPressThreshold && !moved) {
              triggerBlur();
              void logScreenshotAttempt("long_press_detected");
            }
          };
          document.addEventListener("touchend", handleTouchEnd, { once: true });
        }
      }
      hidePopup();
    }

    function hidePopup() {
      setPopup(null);
      if (popupTimeoutRef.current) {
        clearTimeout(popupTimeoutRef.current);
        popupTimeoutRef.current = null;
      }
    }

    function onVisibilityChange() {
      if (document.hidden) {
        visibilityChangeTimeRef.current = Date.now();
        clearBlurTimeout();
        // En móvil NO bloquear por pérdida de visibilidad: cambia de app, notificaciones, etc. = muchos falsos positivos
        if (!isMobile) {
          // Solo en desktop: si la pestaña se oculta, opcionalmente avisar (menos agresivo)
          // No llamamos triggerBlock aquí para no molestar al cambiar de pestaña
        }
      } else {
        const timeHidden = visibilityChangeTimeRef.current > 0
          ? Date.now() - visibilityChangeTimeRef.current
          : 0;
        // En móvil no bloquear al volver (era muy molesto: cada vuelta de otra app = bloqueo)
        if (isMobile) {
          clearBlurTimeout();
          setIsBlurred(false);
          return;
        }
        if (isBlocked) {
          clearBlockTimeout();
          blockTimeoutRef.current = setTimeout(() => {
            setIsBlocked(false);
            setIsBlurred(false);
            blockTimeoutRef.current = null;
          }, blockDurationMs);
        } else {
          clearBlurTimeout();
          setIsBlurred(false);
        }
      }
    }

    function onBlur() {
      if (isMobile) visibilityChangeTimeRef.current = Date.now();
    }

    function onFocus() {
      // En móvil no disparar bloqueo al volver (cambiar app/notificación = foco constante)
      if (isMobile) return;
      if (visibilityChangeTimeRef.current > 0) {
        const timeHidden = Date.now() - visibilityChangeTimeRef.current;
        if (timeHidden > 0 && timeHidden < 1500) triggerBlock();
      }
    }

    // Prevenir selección de texto e imágenes
    function preventSelection(e: Event) {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG" || target.closest("img")) {
        e.preventDefault();
        return false;
      }
    }

    // Prevenir drag de imágenes
    function preventDrag(e: DragEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "IMG" || target.closest("img")) {
        e.preventDefault();
        return false;
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("contextmenu", handleContextMenu, true);
    document.addEventListener("click", hidePopup);
    document.addEventListener("touchstart", handleTouchStart, { passive: false });
    document.addEventListener("visibilitychange", onVisibilityChange);
    document.addEventListener("selectstart", preventSelection);
    document.addEventListener("dragstart", preventDrag);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);

    // Agregar estilos CSS para prevenir selección, long-press y drag en móvil (Android/iOS)
    const style = document.createElement("style");
    style.textContent = `
      img {
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
        user-select: none !important;
        -webkit-touch-callout: none !important;
        -webkit-user-drag: none !important;
        -khtml-user-drag: none !important;
        -moz-user-drag: none !important;
        -ms-user-drag: none !important;
        user-drag: none !important;
        pointer-events: auto !important;
      }
      * {
        -webkit-tap-highlight-color: transparent !important;
      }
      ${isMobile ? `
      [data-protected-album] img, [data-protected-album] [role="img"] {
        -webkit-touch-callout: none !important;
        -webkit-user-select: none !important;
        user-select: none !important;
      }
      ` : ""}
    `;
    document.head.appendChild(style);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu, true);
      document.removeEventListener("click", hidePopup);
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      document.removeEventListener("selectstart", preventSelection);
      document.removeEventListener("dragstart", preventDrag);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      clearModifierKeyTimeout();
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (blockTimeoutRef.current) clearTimeout(blockTimeoutRef.current);
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, [albumId, isBlocked]);

  // Deshabilitar protección durante pantallas de carga/selfie para validar identidad
  if (gate?.gateVisible) return null;

  return (
    <>
      {(isBlurred || isBlocked) && (
        <div className="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center">
          <div
            className="absolute inset-0"
            style={{
              background: isBlocked ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.04)",
              backdropFilter: "blur(80px)",
              WebkitBackdropFilter: "blur(80px)",
            }}
          />
          <div className="relative z-10 flex flex-col items-center justify-center gap-4 px-4 w-full min-w-[min(100%,20rem)] max-w-2xl sm:min-w-[28rem]">
            <img src="/watermark.png" alt="" className="w-36 h-36 object-contain opacity-90" />
            <p className={`font-medium text-center text-sm sm:text-base drop-shadow-sm ${
              isBlocked ? "text-white" : "text-[#1a1a1a]"
            }`}>
              {isBlocked ? "Captura de pantalla detectada" : "Contenido protegido"}
            </p>
            <p className={`text-xs text-center ${
              isBlocked ? "text-white/80" : "text-[#6b7280]"
            }`}>
              {isBlocked
                ? "El contenido está protegido. Por favor, no captures pantallas."
                : "Esta protección es disuasiva, no garantiza seguridad total."}
            </p>
            {/* Advertencia muy visible sobre consecuencias y registro */}
            <div
              className={`mt-2 w-full min-w-0 rounded-lg border-2 px-4 py-3 text-center ${
                isBlocked
                  ? "border-amber-400 bg-amber-500/30 text-amber-50"
                  : "border-amber-500 bg-amber-50 text-amber-900"
              }`}
              role="alert"
            >
              <p className="text-xs sm:text-sm font-bold uppercase tracking-wide">
                ⚠️ Aviso importante
              </p>
              <p className="text-xs sm:text-sm font-semibold mt-1">
                Los intentos reiterados de captura de pantalla pueden resultar en el bloqueo de tu usuario. Cada intento queda registrado en nuestro sistema.
              </p>
            </div>
          </div>
        </div>
      )}
      {popup && (
        <div
          className="fixed z-[10000] rounded-lg shadow-xl pointer-events-none max-w-[280px] overflow-hidden"
          style={{ left: popup.x + 8, top: popup.y - 36 }}
        >
          <div className="px-3 py-2 bg-[#1a1a1a] text-white text-sm font-medium">
            @compramelafoto
          </div>
          <div className="px-3 py-2 bg-amber-500 text-amber-950 text-xs font-semibold border-t-2 border-amber-600">
            Los intentos de captura se registran y pueden bloquear tu usuario.
          </div>
        </div>
      )}
    </>
  );
}
