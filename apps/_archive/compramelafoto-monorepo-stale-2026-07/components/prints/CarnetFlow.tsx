"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import CarnetEditor from "@/components/carnet/CarnetEditor";
import UnavailablePage from "@/components/ui/UnavailablePage";

type PendingCarnet = {
  fileKey: string;
  filename: string;
  sizeCm: { widthCm: number; heightCm: number };
  totalPhotos: number;
};

const DRAFT_KEY = "carnetDraft";

function planchaToOrderItem(p: PendingCarnet) {
  return {
    fileKey: p.fileKey,
    originalName: p.filename,
    size: "10x15",
    finish: "BRILLO",
    quantity: 1,
    productName: "Fotos Carnet",
    meta: {
      printType: "CARNET",
      carnetSize: p.sizeCm,
      entra: p.totalPhotos,
    },
  };
}

export default function CarnetFlow({
  enabled,
  checkoutPath,
}: {
  enabled: boolean;
  checkoutPath: string;
}) {
  const router = useRouter();
  const [completedPlanchas, setCompletedPlanchas] = useState<PendingCarnet[]>([]);
  const [ready, setReady] = useState<PendingCarnet | null>(null);
  const [allowed, setAllowed] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (enabled) {
      setAllowed(true);
      sessionStorage.setItem(DRAFT_KEY, Date.now().toString());
      return;
    }
    const draft = sessionStorage.getItem(DRAFT_KEY);
    if (draft) {
      setAllowed(true);
    }
  }, [enabled]);

  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

  const handleExport = async (payload: {
    blob: Blob;
    filename: string;
    grid: { total: number };
    sizeCm: { widthCm: number; heightCm: number };
  }) => {
    setError(null);
    if (payload.blob.size > MAX_UPLOAD_BYTES) {
      setError(`El archivo supera el límite de 10 MB (${(payload.blob.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }
    const formData = new FormData();
    formData.append("file", payload.blob, payload.filename);
    formData.append("folder", "carnet");
    formData.append("filename", payload.filename);
    const res = await fetch("/api/prints/upload-final", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.key) {
      setError(data?.error || "No se pudo subir la plancha.");
      return;
    }
    setReady({
      fileKey: data.key,
      filename: payload.filename,
      sizeCm: payload.sizeCm,
      totalPhotos: payload.grid.total,
    });
  };

  const handleNuevaPlancha = () => {
    if (!ready) return;
    setCompletedPlanchas((prev) => [...prev, ready]);
    setReady(null);
    setError(null);
    setEditorKey((k) => k + 1);
  };

  const handleCheckout = () => {
    if (!ready) return;
    const todas = [...completedPlanchas, ready];
    const orderItems = todas.map(planchaToOrderItem);
    sessionStorage.setItem("orderItems", JSON.stringify(orderItems));
    router.push(checkoutPath);
  };

  if (!allowed) {
    return (
      <UnavailablePage
        title="No disponible"
        subtitle="Las fotos carnet no están habilitadas en esta tienda."
      />
    );
  }

  return (
    <div className="space-y-6">
      <CarnetEditor
        key={`carnet-editor-${editorKey}`}
        mode="live"
        onExport={handleExport}
        submitLabel="Finalizar plancha"
      />

      {error && (
        <Card className="p-4 text-sm text-red-600 border-red-200 bg-red-50">
          {error}
        </Card>
      )}

      {ready && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="carnet-modal-title"
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg min-w-[340px] space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="carnet-modal-title" className="text-lg font-semibold text-[#1a1a1a]">
              Foto carnet guardada
            </h2>
            <p className="text-[#374151]">
              Su foto carnet ha sido guardada. ¿Querés realizar otra foto carnet o ir a pagar?
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="secondary"
                type="button"
                className="flex-1"
                onClick={handleNuevaPlancha}
              >
                Realizar otra foto carnet
              </Button>
              <Button variant="primary" type="button" className="flex-1" onClick={handleCheckout}>
                Ir a pagar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
