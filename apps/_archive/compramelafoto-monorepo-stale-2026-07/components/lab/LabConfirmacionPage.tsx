"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import LabHeader from "./LabHeader";
import LabPublicFooter from "./LabPublicFooter";

type Lab = {
  id: number;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

export default function LabConfirmacionPage({
  lab,
  handler,
}: {
  lab: Lab;
  handler: string;
}) {
  const router = useRouter();
  const primaryColor = lab.primaryColor || "#c27b3d";
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("orderId");
    if (!saved) {
      router.push(`/l/${handler}/imprimir`);
      return;
    }
    setOrderId(saved);
  }, [router, handler]);

  if (!orderId) {
    return null;
  }

  return (
    <>
      <LabHeader lab={lab} handler={handler} />
      <main className="flex-1">
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-4xl mx-auto space-y-8" style={{ wordBreak: "normal", overflowWrap: "normal" }}>
              {/* Header */}
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
                <div className="text-6xl mb-4">✅</div>
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
              </div>

              <Card className="text-center space-y-6">
                <div>
                  <p className="text-sm text-[#6b7280] mb-2">Número de pedido</p>
                  <p className="text-2xl font-medium text-[#1a1a1a]">#{orderId}</p>
                </div>

                <div className="pt-6 border-t border-[#e5e7eb] space-y-4">
                  <p className="text-sm text-[#6b7280]">
                    Te enviamos un email con los detalles de tu pedido. En breve nos pondremos en contacto para coordinar el pago y la entrega.
                  </p>
                  <p className="text-sm text-[#6b7280]">
                    Podés hacer un seguimiento del estado de tu pedido desde tu cuenta.
                  </p>
                </div>

                <div className="pt-6 flex justify-center">
                  <Link href={`/l/${handler}`}>
                    <Button
                      variant="secondary"
                    >
                      Volver al inicio
                    </Button>
                  </Link>
                </div>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <LabPublicFooter lab={lab} />
    </>
  );
}
