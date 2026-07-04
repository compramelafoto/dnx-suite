"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";

type Subject = { id: number; label: string; selfies: { id: number; imageUrl: string }[] };
type Order = {
  id: number;
  buyerEmail: string;
  album: { id: number; title: string; publicSlug: string };
  items: { id: number; albumProduct: { name: string; requiresDesign: boolean }; subjectId: number | null; status: string }[];
  subjects: Subject[];
};

export default function OrderStatusPage() {
  const params = useParams();
  const orderId = params?.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    fetch(`/api/precompra/order/${orderId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No encontrado"))))
      .then((data) => setOrder(data.order))
      .catch(() => setError("No se pudo cargar el pedido."))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
        <p className="text-[#6b7280]">Cargando tu pedido…</p>
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

  const hasSelfies = order.subjects.length > 0 && order.subjects.every((s) => s.selfies.length > 0);
  const selfiesUrl = `/order/${orderId}/selfies`;

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <header className="bg-white border-b border-gray-200 py-4 px-4">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-[#1a1a1a]">Tu pedido de pre-venta</h1>
          <p className="text-sm text-[#6b7280] mt-1">
            Álbum: {order.album.title}
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <Card>
          <h2 className="font-medium text-[#1a1a1a] mb-2">Resumen</h2>
          <p className="text-sm text-[#6b7280] mb-4">
            Email del pedido: {order.buyerEmail}
          </p>
          <ul className="space-y-2">
            {order.items.map((item) => (
              <li key={item.id} className="text-sm flex items-center gap-2">
                <span className="text-[#1a1a1a]">{item.albumProduct.name}</span>
                {item.albumProduct.requiresDesign && (
                  <span className="text-xs text-amber-700">(incluye diseño)</span>
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card className={!hasSelfies ? "border-2 border-[#c27b3d]/30 bg-amber-50/50" : ""}>
          <h2 className="font-medium text-[#1a1a1a] mb-2">Próximo paso: selfies</h2>
          <p className="text-sm text-[#6b7280] mb-4">
            Para que podamos mostrarte solo las fotos de cada niño, necesitamos una selfie de cada uno. Es rápido y se hace desde el celular.
          </p>
          {hasSelfies ? (
            <p className="text-sm text-green-700 mb-4">
              Ya cargaste la selfie de todos los niños. Cuando el fotógrafo tenga las fotos listas, podrás elegir las que van en cada producto (y diseñar si corresponde).
            </p>
          ) : null}
          <Link
            href={selfiesUrl}
            className="inline-block rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 text-white shadow-lg shadow-black/10 hover:opacity-90"
            style={{ backgroundColor: "#c27b3d" }}
          >
            {hasSelfies ? "Ver o cambiar selfies" : "Cargar selfies"}
          </Link>
        </Card>

        <p className="text-xs text-[#9ca3af] text-center">
          Guardá este enlace para volver a tu pedido:{" "}
          <a href={typeof window !== "undefined" ? window.location.href : "#"} className="text-[#c27b3d] hover:underline">
            {typeof window !== "undefined" ? window.location.href : ""}
          </a>
        </p>
      </main>
    </div>
  );
}
