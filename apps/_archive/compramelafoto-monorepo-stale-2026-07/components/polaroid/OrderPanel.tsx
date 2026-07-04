"use client";

import Button from "@/components/ui/Button";
export default function OrderPanel({
  itemCount,
  onExport,
  exporting,
  submitLabel,
  helperText,
}: {
  itemCount: number;
  onExport: () => void;
  exporting: boolean;
  submitLabel?: string;
  helperText?: string;
}) {
  return (
    <div className="space-y-3 p-4 rounded-xl border border-[#e5e7eb] bg-white">
      <div className="text-sm text-[#6b7280]">Resumen del pedido</div>
      <div className="text-sm">
        <span className="font-medium text-[#1a1a1a]">{itemCount}</span>{" "}
        fotos cargadas
      </div>
      <Button
        variant="primary"
        type="button"
        onClick={onExport}
        disabled={itemCount === 0 || exporting}
      >
        {exporting ? "Exportando..." : submitLabel || "Exportar ZIP"}
      </Button>
      <p className="text-xs text-[#6b7280]">
        {helperText || "Se exportan solo hojas finales listas para imprimir (300 DPI)."}
      </p>
    </div>
  );
}
