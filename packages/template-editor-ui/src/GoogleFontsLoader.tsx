"use client";

import { useEffect } from "react";
import { buildEditorGoogleFontsStylesheetHrefs } from "@/lib/template-v2/editor-font-catalog";

const BUNDLE_ID = "template-v2-editor-google-fonts-0";

/** Inyecta hojas de estilo de Google Fonts para la barra de tipografía del editor (una sola vez). */
export function GoogleFontsLoader() {
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById(BUNDLE_ID)) return;
    const pre = document.createElement("link");
    pre.rel = "preconnect";
    pre.href = "https://fonts.googleapis.com";
    document.head.appendChild(pre);
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect";
    pre2.href = "https://fonts.gstatic.com";
    pre2.setAttribute("crossorigin", "");
    document.head.appendChild(pre2);

    const hrefs = buildEditorGoogleFontsStylesheetHrefs();
    hrefs.forEach((href, i) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.id = i === 0 ? BUNDLE_ID : `${BUNDLE_ID}-${i}`;
      document.head.appendChild(link);
    });
  }, []);
  return null;
}
