"use client";

import { useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import SizeSelector from "./SizeSelector";
import UploadSingle from "./UploadSingle";
import CropperPanel from "./CropperPanel";
import AdjustmentsPanel from "./AdjustmentsPanel";
import Guidelines from "./Guidelines";
import TemplatePreview from "./TemplatePreview";
import CroppedPreview from "./CroppedPreview";
import { cmToPx, calculateGrid } from "./math";
import ScreenshotProtection from "@/components/photo/ScreenshotProtection";
import { exportTemplateImage, type AdjustmentSettings, type CropAreaPixels } from "./export";

const SHEET_CM = { width: 10.2, height: 15.2 };
const DPI = 300;
const DEFAULT_MARGIN_CM = 0.3;
const DEFAULT_GAP_CM = 0.05;

const DEFAULT_SETTINGS: AdjustmentSettings = {
  exposure: 0,
  contrast: 0,
  shadows: 0,
  blacks: 0,
  lights: 0,
  highlights: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  sharpen: 10,
  backgroundWhiten: 0,
  backgroundSmooth: 0,
};

export default function CarnetEditor({
  mode = "test",
  onExport,
  submitLabel,
}: {
  mode?: "test" | "live";
  onExport?: (payload: {
    blob: Blob;
    filename: string;
    grid: ReturnType<typeof calculateGrid>;
    sizeCm: { widthCm: number; heightCm: number };
  }) => Promise<void>;
  submitLabel?: string;
}) {
  const [sizeCm, setSizeCm] = useState({ widthCm: 4, heightCm: 4 });
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalFileType, setOriginalFileType] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.1);
  const [rotation, setRotation] = useState(0);
  const [cropPixels, setCropPixels] = useState<CropAreaPixels | null>(null);
  const [settings, setSettings] = useState<AdjustmentSettings>(DEFAULT_SETTINGS);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [exporting, setExporting] = useState(false);

  const photoPx = useMemo(() => {
    return {
      width: cmToPx(sizeCm.widthCm, DPI),
      height: cmToPx(sizeCm.heightCm, DPI),
    };
  }, [sizeCm.widthCm, sizeCm.heightCm]);

  const sheetPx = useMemo(() => {
    return {
      width: cmToPx(SHEET_CM.width, DPI),
      height: cmToPx(SHEET_CM.height, DPI),
    };
  }, []);

  const grid = useMemo(() => {
    return calculateGrid({
      sheetWidthPx: sheetPx.width,
      sheetHeightPx: sheetPx.height,
      photoWidthPx: photoPx.width,
      photoHeightPx: photoPx.height,
      marginPx: cmToPx(DEFAULT_MARGIN_CM, DPI),
      gapPx: cmToPx(DEFAULT_GAP_CM, DPI),
      maxTotal: 6,
    });
  }, [sheetPx.width, sheetPx.height, photoPx.width, photoPx.height]);

  const canGoNext =
    (step === 1 && Boolean(imageSrc)) ||
    (step === 2 && Boolean(cropPixels)) ||
    step === 3;
  const isLive = mode === "live";

  const handleFinalExport = async () => {
    if (!imageSrc || !cropPixels) return;
    setExporting(true);
    try {
      const { blob, filename, grid: exportGrid } = await exportTemplateImage({
        imageSrc,
        crop: cropPixels,
        settings,
        rotation,
        originalMimeType: originalFileType,
        config: {
          sheetWidthPx: sheetPx.width,
          sheetHeightPx: sheetPx.height,
          photoWidthPx: photoPx.width,
          photoHeightPx: photoPx.height,
          marginPx: cmToPx(DEFAULT_MARGIN_CM, DPI),
          gapPx: cmToPx(DEFAULT_GAP_CM, DPI),
        },
      });
      if (onExport) {
        await onExport({
          blob,
          filename,
          grid: exportGrid,
          sizeCm: { widthCm: sizeCm.widthCm, heightCm: sizeCm.heightCm },
        });
      } else {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {[
            { id: 1, label: "1) Subir foto" },
            { id: 2, label: "2) Recorte + tamaño" },
            { id: 3, label: "3) Edición" },
            { id: 4, label: "4) Plantilla" },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStep(item.id as 1 | 2 | 3 | 4)}
              className={`px-3 py-1.5 rounded-full border text-xs ${
                step === item.id
                  ? "bg-[#c27b3d] text-white border-[#c27b3d]"
                  : "bg-white text-[#6b7280] border-[#e5e7eb]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>

      {step === 1 && (
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold text-[#1a1a1a]">Guía rápida</h2>
          <Guidelines />
          <h3 className="text-lg font-semibold text-[#1a1a1a]">Seleccionar foto</h3>
          <UploadSingle
            imageSrc={imageSrc}
            onUpload={(file, previewUrl) => {
              setImageSrc(previewUrl);
              setOriginalFileType(file.type || "image/jpeg");
              setCrop({ x: 0, y: 0 });
              setZoom(1.1);
              setRotation(0);
            }}
            onClear={() => {
              setImageSrc(null);
              setOriginalFileType(null);
              setCropPixels(null);
              setRotation(0);
            }}
          />
        </Card>
      )}

      {step === 2 && (
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold text-[#1a1a1a]">Recorte y tamaño</h2>
          <p className="text-sm text-[#6b7280]">
            Ajustá el tamaño del carnet y encuadrá la cara.
          </p>
          <SizeSelector
            widthCm={sizeCm.widthCm}
            heightCm={sizeCm.heightCm}
            sheetWidthCm={SHEET_CM.width}
            sheetHeightCm={SHEET_CM.height}
            marginCm={DEFAULT_MARGIN_CM}
            gapCm={DEFAULT_GAP_CM}
            dpi={DPI}
            onChange={setSizeCm}
          />
          <CropperPanel
            imageSrc={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={sizeCm.widthCm / sizeCm.heightCm}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={setCropPixels}
          />
        </Card>
      )}

      {step === 3 && (
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-semibold text-[#1a1a1a]">Edición y retoque</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="relative">
              <CroppedPreview
                imageSrc={imageSrc}
                crop={cropPixels}
                rotation={rotation}
                settings={settings}
                sizeCm={{ width: sizeCm.widthCm, height: sizeCm.heightCm }}
              />
              {isLive && (
                <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3 text-[11px] sm:text-sm font-semibold text-[#111111] opacity-55 rotate-[-18deg]">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <div key={`wm-${idx}`} className="flex items-center justify-center">
                      ComprameLaFoto
                    </div>
                  ))}
                </div>
              )}
            </div>
            <AdjustmentsPanel
              settings={settings}
              onChange={setSettings}
              onReset={() => setSettings(DEFAULT_SETTINGS)}
            />
          </div>
        </Card>
      )}

      {step === 4 && (
        <Card className="p-6 space-y-4">
          <ScreenshotProtection />
          <h2 className="text-xl font-semibold text-[#1a1a1a]">Plantilla (vista protegida)</h2>
          <div className="text-sm text-[#6b7280]">
            Entran {grid.total} fotos ({grid.cols} columnas x {grid.rows} filas).
          </div>
          <div onContextMenu={(e) => e.preventDefault()}>
            <TemplatePreview
              imageSrc={imageSrc}
              crop={cropPixels}
              rotation={rotation}
              settings={settings}
              sizeCm={{ width: sizeCm.widthCm, height: sizeCm.heightCm }}
              marginCm={DEFAULT_MARGIN_CM}
              gapCm={DEFAULT_GAP_CM}
              watermarkText="@ComprameLaFoto"
              watermarkOpacity={isLive ? 0.8 : 0.5}
            />
          </div>
          <p className="text-xs text-[#6b7280]">
            {isLive
              ? "Vista en baja calidad con marca de agua. El archivo final se genera al confirmar el pedido."
              : "Vista en baja calidad con marca de agua. La descarga genera el archivo final en alta calidad."}
          </p>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="secondary"
          type="button"
          onClick={() => setStep((Math.max(1, step - 1) as 1 | 2 | 3 | 4))}
          disabled={step === 1}
        >
          Atrás
        </Button>
        <Button
          variant="primary"
          type="button"
          onClick={() => {
            if (step === 4) {
              void handleFinalExport();
              return;
            }
            setStep((Math.min(4, step + 1) as 1 | 2 | 3 | 4));
          }}
          disabled={(step < 4 && !canGoNext) || (step === 4 && (!imageSrc || !cropPixels || exporting))}
        >
          {step === 4
            ? (exporting
                ? (onExport ? "Generando..." : "Descargando...")
                : submitLabel || (onExport ? "Continuar al pago" : "Finalizar y descargar"))
            : "Siguiente"}
        </Button>
      </div>

    </div>
  );
}
