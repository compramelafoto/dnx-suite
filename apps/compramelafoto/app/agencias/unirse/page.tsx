"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type Preview = {
  agency: { name: string; description: string | null; commissionLabel: string; terms: string };
  alreadyActive: boolean;
  isOwner: boolean;
};

function Join() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accept, setAccept] = useState(false);
  const [requested, setRequested] = useState(false);

  useEffect(() => {
    fetch(`/api/fotografo/agencias/unirse?token=${encodeURIComponent(token)}`, { credentials: "include" }).then(async (res) => {
      if (res.status === 401) {
        router.push(`/fotografo/login?redirect=${encodeURIComponent(`/agencias/unirse?token=${token}`)}`);
        return;
      }
      const d = await res.json().catch(() => ({}));
      if (res.ok) setPreview(d);
      else setError(d.error || "Este link no funciona.");
    });
  }, [token, router]);

  if (error) return <Card>{error}</Card>;
  if (!preview) return <p className="text-gray-600">Cargando...</p>;
  if (preview.isOwner) return <Card>Sos el dueño de {preview.agency.name}. Este link es para tu equipo.</Card>;
  if (requested) {
    return (
      <Card className="space-y-3">
        <p>Tu pedido para volver al equipo de {preview.agency.name} quedó enviado. La agencia lo tiene que aprobar.</p>
        <Button onClick={() => router.push("/fotografo/agencias/mis-agencias")}>Ir a Mis agencias</Button>
      </Card>
    );
  }
  if (preview.alreadyActive) {
    return (
      <Card className="space-y-3">
        <p>Ya sos parte del equipo de {preview.agency.name}.</p>
        <Button onClick={() => router.push("/fotografo/agencias/mis-agencias")}>Ir a Mis agencias</Button>
      </Card>
    );
  }
  return (
    <Card className="space-y-4">
      <h1 className="text-2xl font-semibold">Sumate al equipo de {preview.agency.name}</h1>
      {preview.agency.description && <p className="text-[#6b7280]">{preview.agency.description}</p>}
      <p>Por cada venta de tus fotos cobrás <strong>{preview.agency.commissionLabel}</strong>, directo en tu Mercado Pago.</p>
      <pre className="whitespace-pre-wrap rounded-xl bg-gray-50 p-3 text-sm">{preview.agency.terms}</pre>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} />
        Leí y acepto las condiciones de la agencia.
      </label>
      <Button disabled={!accept} onClick={async () => {
        const res = await fetch("/api/fotografo/agencias/unirse", {
          method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, acceptTerms: true }),
        });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) setError(d.error || "No pudimos sumarte.");
        else if (d.outcome === "requested") setRequested(true);
        else router.push("/fotografo/agencias/mis-agencias");
      }}>Sumarme al equipo</Button>
    </Card>
  );
}

export default function UnirseAgenciaPage() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Suspense fallback={<p className="text-gray-600">Cargando...</p>}>
          <Join />
        </Suspense>
      </div>
    </div>
  );
}
