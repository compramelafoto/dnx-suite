"use client";

import { useRef, useEffect, useState } from "react";
import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from "react-konva";
import type Konva from "konva";

export type SlotBbox = { x: number; y: number; width: number; height: number };
export type TemplateSlot = { index: number; bbox: SlotBbox };

type Props = {
  imageUrl: string;
  imageSize: { w: number; h: number };
  slots: TemplateSlot[];
  onSlotsChange: (slots: TemplateSlot[]) => void;
  selectedIndex: number | null;
  onSelectIndex: (index: number | null) => void;
};

export default function TemplateSlotsCanvas({
  imageUrl,
  imageSize,
  slots,
  onSlotsChange,
  selectedIndex,
  onSelectIndex,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stageSize, setStageSize] = useState({ w: 0, h: 0 });
  const [imageNode, setImageNode] = useState<HTMLImageElement | null>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const rectRefs = useRef<(Konva.Rect | null)[]>([]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width && rect.height) setStageSize({ w: rect.width, h: rect.height });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [imageUrl]);

  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.onload = () => setImageNode(img);
    img.src = imageUrl;
    return () => setImageNode(null);
  }, [imageUrl]);

  useEffect(() => {
    if (selectedIndex === null || !transformerRef.current) return;
    const node = rectRefs.current[selectedIndex];
    if (node) transformerRef.current.nodes([node]);
    return () => {
      transformerRef.current?.nodes([]);
    };
  }, [selectedIndex, slots.length]);

  // Contener imagen sin desproporción: escala para que quepa en el stage manteniendo relación de aspecto
  const imgW = Math.max(1, imageSize.w);
  const imgH = Math.max(1, imageSize.h);
  const scale = Math.min(stageSize.w / imgW, stageSize.h / imgH, 10) || 1;
  const drawW = imgW * scale;
  const drawH = imgH * scale;
  const offsetX = (stageSize.w - drawW) / 2;
  const offsetY = (stageSize.h - drawH) / 2;

  const updateSlot = (index: number, bbox: SlotBbox) => {
    onSlotsChange(
      slots.map((s, i) => (i === index ? { ...s, bbox } : s))
    );
  };

  return (
    <div ref={containerRef} className="w-full h-full min-h-[360px] bg-[#f8fafc] overflow-hidden rounded-xl border border-[#e2e8f0]" style={{ minHeight: 360 }}>
      {stageSize.w > 0 && stageSize.h > 0 && (
        <Stage
          width={stageSize.w}
          height={stageSize.h}
          onClick={(e) => e.target === e.target.getStage() && onSelectIndex(null)}
          onTap={(e) => e.target === e.target.getStage() && onSelectIndex(null)}
        >
          <Layer>
            {imageNode && (
              <KonvaImage
                image={imageNode}
                x={offsetX}
                y={offsetY}
                width={drawW}
                height={drawH}
                listening={false}
              />
            )}
            {slots.map((s, i) => {
              const b = s.bbox;
              const x = offsetX + b.x * scale;
              const y = offsetY + b.y * scale;
              const w = Math.max(20, b.width * scale);
              const h = Math.max(20, b.height * scale);
              const isSelected = selectedIndex === i;
              return (
                <Rect
                  key={i}
                  ref={(r) => {
                    rectRefs.current[i] = r;
                  }}
                  x={x}
                  y={y}
                  width={w}
                  height={h}
                  stroke={isSelected ? "#c27b3d" : "#e5e7eb"}
                  strokeWidth={isSelected ? 3 : 2}
                  fill="rgba(255,255,255,0.2)"
                  draggable
                  onClick={(e) => {
                    e.cancelBubble = true;
                    onSelectIndex(i);
                  }}
                  onTap={(e) => {
                    e.cancelBubble = true;
                    onSelectIndex(i);
                  }}
                  dragBoundFunc={(pos) => ({
                    x: Math.max(offsetX, Math.min(offsetX + drawW - w, pos.x)),
                    y: Math.max(offsetY, Math.min(offsetY + drawH - h, pos.y)),
                  })}
                  onDragEnd={(e) => {
                    const node = e.target;
                    const nx = Math.round((node.x() - offsetX) / scale);
                    const ny = Math.round((node.y() - offsetY) / scale);
                    const nw = Math.round(node.width() / scale);
                    const nh = Math.round(node.height() / scale);
                    updateSlot(i, {
                      x: Math.max(0, nx),
                      y: Math.max(0, ny),
                      width: Math.max(20, nw),
                      height: Math.max(20, nh),
                    });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const scaleXLocal = node.scaleX();
                    const scaleYLocal = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    const nx = Math.round((node.x() - offsetX) / scale);
                    const ny = Math.round((node.y() - offsetY) / scale);
                    const nw = Math.round((node.width() * scaleXLocal) / scale);
                    const nh = Math.round((node.height() * scaleYLocal) / scale);
                    updateSlot(i, {
                      x: Math.max(0, nx),
                      y: Math.max(0, ny),
                      width: Math.max(20, nw),
                      height: Math.max(20, nh),
                    });
                  }}
                />
              );
            })}
            {selectedIndex !== null && slots[selectedIndex] && (
              <Transformer
                ref={transformerRef}
                nodes={[]}
                boundBoxFunc={(oldBox, newBox) => {
                  const min = 20;
                  if (Math.abs(newBox.width) < min || Math.abs(newBox.height) < min) return oldBox;
                  return newBox;
                }}
              />
            )}
          </Layer>
        </Stage>
      )}
    </div>
  );
}
