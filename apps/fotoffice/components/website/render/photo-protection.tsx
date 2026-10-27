"use client";

import { useEffect } from "react";

/** Hasta cuántos niveles hacia arriba se busca una foto de fondo desde donde se hizo clic. */
const NIVELES = 6;

function esFoto(target: EventTarget | null): boolean {
  let el = target instanceof Element ? target : null;
  for (let i = 0; el && i < NIVELES; i++, el = el.parentElement) {
    if (el.tagName === "IMG" || el.tagName === "PICTURE" || el.tagName === "VIDEO") return true;
    const fondo = window.getComputedStyle(el).backgroundImage;
    if (fondo && fondo !== "none" && fondo.includes("url(")) return true;
  }
  return false;
}

/**
 * Protección de fotos del sitio público (Sitio web → Ajustes): bloquea el menú del clic derecho y
 * el arrastre sobre las fotos (`<img>` y fondos con imagen). Disuade, no impide: una captura de
 * pantalla o las herramientas del navegador siguen funcionando, y así se dice en el panel.
 * El resto del sitio (texto, enlaces, formularios) mantiene su menú normal.
 */
export function PhotoProtection() {
  useEffect(() => {
    const bloquear = (e: Event) => {
      if (esFoto(e.target)) e.preventDefault();
    };
    document.addEventListener("contextmenu", bloquear);
    document.addEventListener("dragstart", bloquear);
    return () => {
      document.removeEventListener("contextmenu", bloquear);
      document.removeEventListener("dragstart", bloquear);
    };
  }, []);

  // En el celular, el toque largo sobre una foto abre "Guardar imagen": se apaga con CSS.
  return <style>{`img{-webkit-touch-callout:none;-webkit-user-drag:none;user-select:none}`}</style>;
}
