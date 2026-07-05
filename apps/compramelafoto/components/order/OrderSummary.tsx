"use client";

import Card from "@/components/ui/Card";
import Image from "next/image";

interface OrderItem {
  id: string;
  previewUrl: string;
  originalName: string;
  size: string;
  finish: string;
  quantity: number;
  unitPrice: number;
}

interface OrderSummaryProps {
  items: OrderItem[];
}

export default function OrderSummary({ items }: OrderSummaryProps) {
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-normal text-[#1a1a1a]">Resumen del pedido</h2>

      <div className="space-y-4">
        {items.map((item) => (
          <Card key={item.id} className="p-4">
            <div className="flex gap-4">
              <div className="relative w-20 max-h-20 rounded-lg overflow-hidden flex-shrink-0 bg-[#f3f4f6] flex items-center justify-center p-1">
                <img
                  src={item.previewUrl}
                  alt={item.originalName}
                  className="max-w-full max-h-full object-contain"
                  style={{ width: "auto", height: "auto", maxWidth: "80px", maxHeight: "80px" }}
                />
              </div>
              <div className="flex-1">
                <h3 className="font-medium text-[#1a1a1a] mb-1">{item.originalName}</h3>
                <p className="text-sm text-[#6b7280]">
                  {item.size} - {item.finish === "BRILLO" ? "Brillo" : "Mate"} -{" "}
                  {item.quantity} unidad{item.quantity !== 1 ? "es" : ""}
                </p>
                <p className="text-sm font-medium text-[#1a1a1a] mt-2">
                  ${(item.unitPrice * item.quantity).toLocaleString("es-AR")}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="bg-[#f8f9fa]">
        <div className="flex justify-between items-center">
          <span className="text-xl font-medium text-[#1a1a1a]">Total</span>
          <span className="text-3xl font-normal text-[#1a1a1a]">
            ${total.toLocaleString("es-AR")}
          </span>
        </div>
      </Card>
    </div>
  );
}
