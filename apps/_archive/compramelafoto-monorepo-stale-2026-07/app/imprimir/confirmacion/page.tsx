"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

export default function ConfirmacionPage() {
  const router = useRouter();
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const savedOrderId = sessionStorage.getItem("orderId");
    if (!savedOrderId) {
      router.push("/");
      return;
    }
    setOrderId(savedOrderId);
  }, [router]);

  if (!orderId) {
    return null;
  }

  return (
    <section className="py-12 md:py-16 bg-white">
      <div className="container-custom">
        <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
          {/* Header actualizado */}
          <div
            style={{
              textAlign: "center",
              padding: "0 16px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              alignItems: "center",
            }}
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-[#10b981]/10 rounded-full">
              <svg
                className="w-10 h-10 text-[#10b981]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1
              style={{
                fontSize: "clamp(24px, 5vw, 36px)",
                fontWeight: "normal",
                color: "#1a1a1a",
                lineHeight: "1.3",
                margin: 0,
                width: "100%",
                maxWidth: "800px",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
              }}
            >
              ¡Pedido confirmado!
            </h1>
            <p
              style={{
                fontSize: "clamp(16px, 2.5vw, 18px)",
                color: "#6b7280",
                lineHeight: "1.5",
                margin: 0,
                width: "100%",
                maxWidth: "800px",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
              }}
            >
              Tu pedido fue recibido correctamente
            </p>
            <p
              style={{
                fontSize: "14px",
                color: "#6b7280",
                lineHeight: "1.6",
                margin: 0,
                width: "100%",
                maxWidth: "672px",
                wordBreak: "normal",
                overflowWrap: "normal",
                whiteSpace: "normal",
                wordSpacing: "normal",
                letterSpacing: "normal",
                textAlign: "center",
                display: "block",
              }}
            >
              Recibirás un email de confirmación con los detalles de tu pedido. Te contactaremos cuando esté listo para retirar o cuando lo enviemos.
            </p>
          </div>

          <Card className="text-center space-y-6">
            <div>
              <p className="text-sm text-[#6b7280] mb-2">Número de pedido</p>
              <p className="text-4xl font-normal text-[#1a1a1a]">#{orderId}</p>
            </div>

            <div className="pt-6 border-t border-[#e5e7eb] space-y-4 text-left">
              <p className="text-[#1a1a1a]">
                Recibirás un email de confirmación con los detalles de tu pedido.
              </p>
              <p className="text-[#6b7280] text-sm">
                Te contactaremos cuando tu pedido esté listo para retirar o cuando lo
                enviemos, según la opción que hayas elegido.
              </p>
            </div>
          </Card>

          <div className="flex justify-center pt-6">
            <Link href="/">
              <Button variant="primary">Volver al inicio</Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
