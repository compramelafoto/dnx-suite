"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type Subject = { id: number; label: string; selfies: { id: number; imageUrl: string }[] };
type Order = {
  id: number;
  buyerEmail: string;
  album: { id: number; title: string; publicSlug: string };
  items: { id: number; albumProduct: { name: string }; subjectId: number | null }[];
  subjects: Subject[];
};

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    setMobile(mq.matches);
    const fn = () => setMobile(window.matchMedia("(max-width: 768px)").matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  return mobile;
}

export default function SelfiesPage() {
  const params = useParams();
  const orderId = params?.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const loadOrder = () => {
    if (!orderId) return;
    fetch(`/api/precompra/order/${orderId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No encontrado"))))
      .then((data) => setOrder(data.order))
      .catch(() => setError("No se pudo cargar el pedido."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const addSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabel.trim() || !orderId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/precompra/order/${orderId}/subjects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      if (!res.ok) throw new Error("Error al agregar");
      setNewLabel("");
      loadOrder();
    } catch {
      setError("No se pudo agregar el niño.");
    } finally {
      setAdding(false);
    }
  };

  const triggerUpload = (subjectId: number) => {
    setUploadingFor(subjectId);
    fileInputRef.current?.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
        <p className="text-[#6b7280]">Cargando…</p>
      </div>
    );
  }

  if (error && !order) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/" className="text-[#c27b3d] underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (!order) return null;

  const selfieUrl = typeof window !== "undefined" ? `${window.location.origin}/order/${orderId}/selfies/capture` : "";

  return (
    <div className="min-h-screen bg-[#f9fafb] w-full min-w-0">
      <header className="bg-white border-b border-gray-200 py-4 px-4 w-full">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6">
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Selfies para tus fotos</h1>
          <p className="text-sm text-[#6b7280] mt-1 max-w-2xl">
            Álbum: {order.album.title}. Agregá cada niño y subí su selfie para que podamos mostrar solo sus fotos.
          </p>
        </div>
      </header>

      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {!isMobile && (
          <Card className="bg-amber-50 border-amber-200">
            <p className="text-sm font-medium text-amber-800 mb-2">Recomendado: usar el celular</p>
            <p className="text-sm text-amber-700 mb-4">
              Para tomar la selfie con la cámara frontal, abrí este mismo link en tu celular. Escaneá el QR:
            </p>
            <div className="inline-block p-3 bg-white rounded-lg">
              {/* QR placeholder: in production use a lib like qrcode.react */}
              <div className="w-32 h-32 bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                QR
              </div>
            </div>
            <p className="text-xs text-amber-600 mt-2 break-all">{selfieUrl}</p>
          </Card>
        )}

        <Card>
          <h2 className="font-medium text-[#1a1a1a] mb-3">Niños en este pedido</h2>
          <form onSubmit={addSubject} className="flex gap-2 mb-4">
            <Input
              placeholder="Nombre del niño (ej. Gime)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" variant="secondary" disabled={adding}>
              {adding ? "…" : "Agregar"}
            </Button>
          </form>

          {order.subjects.length === 0 ? (
            <p className="text-sm text-[#6b7280]">Agregá al menos un niño y luego subí su selfie.</p>
          ) : (
            <ul className="space-y-4">
              {order.subjects.map((s) => (
                <li key={s.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                  <div className="font-medium text-[#1a1a1a]">{s.label}</div>
                  {s.selfies.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={s.selfies[0].imageUrl}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover"
                      />
                      <span className="text-sm text-green-600">Selfie cargada</span>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => triggerUpload(s.id)}
                      disabled={uploadingFor !== null}
                    >
                      {uploadingFor === s.id ? "Subiendo…" : "Subir selfie"}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="user"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file || uploadingFor == null || !orderId) return;
            const form = new FormData();
            form.set("subjectId", String(uploadingFor));
            form.set("file", file);
            try {
              const res = await fetch(`/api/precompra/order/${orderId}/selfie`, {
                method: "POST",
                body: form,
              });
              if (!res.ok) throw new Error("Error al subir");
              loadOrder();
            } catch {
              setError("No se pudo subir la selfie.");
            }
            setUploadingFor(null);
            e.target.value = "";
          }}
        />

        <div className="flex flex-wrap gap-3">
          <Link href={`/order/${orderId}`}>
            <Button variant="secondary">Mi pedido</Button>
          </Link>
          <Link href={`/a/${order.album.publicSlug}`}>
            <Button variant="secondary">Ver álbum</Button>
          </Link>
          <Link href={`/album/${order.album.publicSlug}/preventa`}>
            <Button variant="secondary">Volver al catálogo</Button>
          </Link>
        </div>
      </main>
    </div>
  );
}
