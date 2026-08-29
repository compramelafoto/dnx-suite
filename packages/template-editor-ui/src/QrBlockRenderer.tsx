"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Dibuja el código QR dentro del lienzo.
 *
 * Se genera en el navegador, a partir del valor de la variable. Mientras no haya variable
 * elegida —o su valor esté vacío— se muestra un marcador, no un QR de mentira: un código que
 * lleva a ninguna parte se ve igual de bien que uno correcto, y el error aparecería recién
 * cuando alguien lo escanea con la credencial ya impresa.
 */
export function QrBlockRenderer({
  config,
  resolvedVariables,
  layoutWidth,
  layoutHeight,
}: {
  config: Record<string, unknown>;
  resolvedVariables?: Record<string, unknown>;
  layoutWidth: number;
  layoutHeight: number;
}) {
  const mode = config.mode === "FIXED" ? "FIXED" : "VARIABLE";
  const variableKey = typeof config.variableKey === "string" ? config.variableKey : "";
  const fijo = typeof config.value === "string" ? config.value.trim() : "";

  const valorVariable = variableKey ? resolvedVariables?.[variableKey] : undefined;
  const texto =
    mode === "FIXED"
      ? fijo
      : typeof valorVariable === "string"
        ? valorVariable.trim()
        : "";

  const foreground = typeof config.foreground === "string" ? config.foreground : "#000000";
  const background = typeof config.background === "string" ? config.background : "var(--te-surface)";
  const ec = typeof config.errorCorrection === "string" ? config.errorCorrection : "M";
  const quiet = typeof config.quietZoneModules === "number" ? config.quietZoneModules : 4;

  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    if (!texto) {
      setDataUrl(null);
      return () => {
        vigente = false;
      };
    }
    // El lado se toma del bloque para que el QR salga nítido al tamaño en que se ve.
    const lado = Math.max(64, Math.round(Math.min(layoutWidth, layoutHeight)));
    QRCode.toDataURL(texto, {
      errorCorrectionLevel: (["L", "M", "Q", "H"].includes(ec) ? ec : "M") as "L" | "M" | "Q" | "H",
      margin: quiet,
      width: lado,
      color: { dark: foreground, light: background },
    })
      .then((url) => {
        if (vigente) setDataUrl(url);
      })
      .catch(() => {
        if (vigente) setDataUrl(null);
      });
    return () => {
      vigente = false;
    };
  }, [texto, foreground, background, ec, quiet, layoutWidth, layoutHeight]);

  if (!dataUrl) {
    return (
      <div
        className="flex h-full w-full items-center justify-center border border-dashed text-center"
        style={{ borderColor: "var(--te-ink-faint)", background }}
      >
        <span className="px-2 text-[10px] leading-tight text-slate-500">
          {mode === "FIXED"
            ? "Escribí la dirección"
            : variableKey
              ? "Sin valor todavía"
              : "Elegí qué dato codificar"}
        </span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- es un data URI generado acá
    <img
      src={dataUrl}
      alt=""
      className="h-full w-full"
      style={{ objectFit: "contain", background }}
      draggable={false}
    />
  );
}
