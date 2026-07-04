"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import PolaroidEditor from "@/components/polaroid/PolaroidEditor";
import UnavailablePage from "@/components/ui/UnavailablePage";
import { POLAROID_PRESETS } from "@/components/polaroid/presets";
import type { PolaroidItem } from "@/components/polaroid/export";

const DRAFT_KEY = "polaroidsDraft";

type PendingGroup = {
  presetId: string;
  size: string;
  finish: "BRILLO" | "MATE";
  quantity: number;
};

function formatSize(value: number) {
  return Number.isInteger(value) ? String(value) : String(value).replace(/\.0+$/, "");
}

export default function PolaroidFlow({
  enabled,
  checkoutPath,
}: {
  enabled: boolean;
  checkoutPath: string;
}) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

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

  const handleExport = async (payload: { blob: Blob; filename: string; items: PolaroidItem[] }) => {
    setError(null);
    if (payload.blob.size > MAX_UPLOAD_BYTES) {
      setError(`El archivo supera el límite de 10 MB (${(payload.blob.size / 1024 / 1024).toFixed(1)} MB).`);
      return;
    }
    const formData = new FormData();
    formData.append("file", payload.blob, payload.filename);
    formData.append("folder", "polaroids");
    formData.append("filename", payload.filename);
    const res = await fetch("/api/prints/upload-final", {
      method: "POST",
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.key) {
      setError(data?.error || "No se pudo subir el ZIP de polaroids.");
      return;
    }

    const groups = new Map<string, PendingGroup>();
    payload.items.forEach((item) => {
      const preset = POLAROID_PRESETS.find((p) => p.id === item.presetId);
      if (!preset) return;
      const finish = item.finish || "BRILLO";
      const quantity = Math.max(1, Math.round(item.copies || 1));
      const size = `${formatSize(preset.widthCm)}x${formatSize(preset.heightCm)}`;
      const key = `${preset.id}__${finish}`;
      const current = groups.get(key) ?? {
        presetId: preset.id,
        size,
        finish,
        quantity: 0,
      };
      current.quantity += quantity;
      groups.set(key, current);
    });

    const orderItems = Array.from(groups.values()).map((group) => ({
      fileKey: data.key,
      originalName: payload.filename,
      size: group.size,
      finish: group.finish,
      quantity: group.quantity,
      productName: "Polaroid",
      meta: {
        printType: "POLAROID",
        presetId: group.presetId,
        size: group.size,
        finish: group.finish,
      },
    }));

    sessionStorage.setItem("orderItems", JSON.stringify(orderItems));
    router.push(checkoutPath);
  };

  if (!allowed) {
    return (
      <UnavailablePage
        title="No disponible"
        subtitle="Las polaroids no están habilitadas en esta tienda."
      />
    );
  }

  return (
    <div className="space-y-4">
      <PolaroidEditor onExport={handleExport} submitLabel="Continuar al pago" />
      {error && (
        <Card className="p-4 text-sm text-red-600 border-red-200 bg-red-50">
          {error}
        </Card>
      )}
    </div>
  );
}
