"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    instgrm?: { Embeds?: { process: () => void } };
  }
}

const SCRIPT_SRC = "https://www.instagram.com/embed.js";
const SCRIPT_ATTR = "data-infospot-instagram-embed";

let scriptPromise: Promise<void> | null = null;

function ensureInstagramEmbedScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.instgrm?.Embeds?.process) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[${SCRIPT_ATTR}]`);
    if (existing) {
      if (window.instgrm?.Embeds?.process) {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => resolve(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.setAttribute(SCRIPT_ATTR, "true");
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.body.appendChild(script);
  });

  return scriptPromise;
}

function processInstagramEmbeds() {
  window.instgrm?.Embeds?.process();
}

/**
 * Carga embed.js de Instagram una sola vez y reprocesa todos los blockquotes.
 * No bloquea el paint inicial: idle / timeout corto.
 */
export function useInstagramEmbedScript(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    let cancelled = false;
    let idleId = 0;
    let timeoutId = 0;

    const run = () => {
      if (cancelled) return;
      void ensureInstagramEmbedScript().then(() => {
        if (!cancelled) processInstagramEmbeds();
      });
    };

    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(run, { timeout: 2500 });
    } else {
      timeoutId = window.setTimeout(run, 50);
    }

    return () => {
      cancelled = true;
      if (idleId && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleId);
      }
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [enabled]);
}
