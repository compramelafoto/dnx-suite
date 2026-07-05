"use client";

import { useState } from "react";
import { Images, Loader2 } from "lucide-react";
import AdminIconButton from "@/components/admin/AdminIconButton";

export default function AdminOrderClientViewButton({ orderId }: { orderId: number }) {
  const [busy, setBusy] = useState(false);

  async function handleOpen() {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/client-view-link`, {
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "No se pudo obtener el link");
      }
      if (data?.primaryClientUrl) {
        window.open(data.primaryClientUrl as string, "_blank", "noopener,noreferrer");
      } else {
        alert("No hay link de visualización disponible aún.");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Error al abrir la vista del cliente");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminIconButton
      label="Ver fotos como las ve el cliente"
      onClick={handleOpen}
      disabled={busy}
      variant="primary"
    >
      {busy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        <Images className="h-4 w-4" aria-hidden />
      )}
    </AdminIconButton>
  );
}
