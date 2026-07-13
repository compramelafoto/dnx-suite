"use client";

import { useParams } from "next/navigation";
import PreventaSelfieStep from "@/components/preventa/PreventaSelfieStep";

export default function SelfiesPage() {
  const params = useParams();
  const orderId = params?.id;
  const preCompraOrderId =
    orderId != null && /^\d+$/.test(String(orderId)) ? parseInt(String(orderId), 10) : null;

  if (preCompraOrderId == null || preCompraOrderId <= 0) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
        <p className="text-red-600">Pedido inválido.</p>
      </div>
    );
  }

  return <PreventaSelfieStep preCompraOrderId={preCompraOrderId} variant="standalone" />;
}
