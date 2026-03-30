"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import QRCode from "qrcode";
import type { DiplomaLayoutJson } from "../../lib/fotorank/diplomas/layoutSchema";
import { mergeDiplomaTemplate, type DiplomaMergeVariables } from "../../lib/fotorank/diplomas/mergeFields";

type DiplomaLayoutPreviewProps = {
  layout: DiplomaLayoutJson;
  variables: DiplomaMergeVariables;
  widthPt: number;
  heightPt: number;
  backgroundColor: string;
  backgroundImageUrl?: string | null;
  className?: string;
};

/**
 * Preview HTML: lienzo en pt (igual que PDF), escalado para encajar en el ancho del contenedor.
 */
export function DiplomaLayoutPreview({
  layout,
  variables,
  widthPt,
  heightPt,
  backgroundColor,
  backgroundImageUrl,
  className = "",
}: DiplomaLayoutPreviewProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [qrSrc, setQrSrc] = useState<Record<string, string>>({});
  const vUrl = variables.verificationUrl ?? "";

  const blocks = layout.blocks;
  const qrIds = useMemo(
    () => blocks.filter((b) => b.type === "qrcode").map((b) => b.id),
    [blocks]
  );

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / widthPt);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [widthPt]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!vUrl || qrIds.length === 0) return;
      const next: Record<string, string> = {};
      for (const id of qrIds) {
        try {
          next[id] = await QRCode.toDataURL(vUrl, {
            margin: 1,
            width: 200,
            errorCorrectionLevel: "M",
          });
        } catch {
          /* noop */
        }
      }
      if (!cancelled) setQrSrc(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [vUrl, qrIds]);

  return (
    <div ref={outerRef} className={`w-full max-w-3xl ${className}`}>
      <div
        style={{
          height: heightPt * scale,
          position: "relative",
        }}
      >
        <div
          style={{
            width: widthPt,
            height: heightPt,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            position: "absolute",
            top: 0,
            left: 0,
            backgroundColor,
            backgroundImage: backgroundImageUrl ? `url(${backgroundImageUrl})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
            borderRadius: 8,
            boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}
        >
          {blocks.map((block) => {
            const op = block.opacity != null && Number.isFinite(block.opacity) ? block.opacity : 1;

            if (block.type === "qrcode") {
              const src = qrSrc[block.id];
              return (
                <div
                  key={block.id}
                  className="absolute flex items-center justify-center bg-white p-0.5"
                  style={{
                    left: block.x,
                    top: block.y,
                    width: block.width,
                    height: block.height,
                    opacity: op,
                  }}
                >
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-black">QR</span>
                  )}
                </div>
              );
            }

            const text = mergeDiplomaTemplate(block.content, variables);
            const align = block.textAlign ?? "left";
            const weight = block.fontWeight === "bold" ? 700 : 400;

            return (
              <div
                key={block.id}
                className="absolute overflow-hidden leading-snug"
                style={{
                  left: block.x,
                  top: block.y,
                  width: block.width,
                  height: block.height,
                  opacity: op,
                  color: block.color,
                  fontSize: block.fontSize,
                  fontWeight: weight,
                  textAlign: align,
                }}
              >
                <span className="block whitespace-pre-wrap break-words">{text}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
