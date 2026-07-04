"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Campaña ${new Date().toLocaleDateString("es-AR")}`,
          subject: "Asunto del email",
          html: "<p>Hola {{firstName}},</p><p>Contenido de la campaña.</p>",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al crear");
      router.push(`/admin/email-marketing/${data.campaign.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Nueva campaña</h1>
      <p className="text-gray-600 mb-6">
        Crear una campaña en borrador y configurarla en el editor.
      </p>
      {error && <p className="text-red-600 mb-4">{error}</p>}
      <button
        onClick={handleCreate}
        disabled={loading}
        className="px-4 py-2 bg-[#c27b3d] text-white rounded-lg hover:bg-[#a8682d] disabled:opacity-50"
      >
        {loading ? "Creando..." : "Crear campaña"}
      </button>
    </div>
  );
}
