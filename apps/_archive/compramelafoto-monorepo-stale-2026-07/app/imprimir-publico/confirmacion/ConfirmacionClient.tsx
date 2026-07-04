"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";

type PrintOrderResponse = {
  id: number;
  total: number;
  status: string;
  paymentStatus: string | null;
  lab: {
    id: number;
    name: string;
    address: string | null;
    phone: string | null;
    city: string | null;
    province: string | null;
  } | null;
  photographer: {
    id: number;
    name: string | null;
    address: string | null;
    companyAddress: string | null;
    phone: string | null;
  } | null;
  items: Array<{
    id: number;
    fileKey: string;
    originalName: string | null;
    size: string;
    acabado: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
  }>;
};

export default function ConfirmacionClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId");
  const isPaid = searchParams.get("paid") === "true";
  const [order, setOrder] = useState<PrintOrderResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orderId) {
      router.push("/imprimir-publico");
      return;
    }

    async function loadOrder() {
      try {
        const res = await fetch(`/api/print-orders/${orderId}`);
        if (res.ok) {
          const data = await res.json();
          setOrder(data);
        }
      } catch (err) {
        console.error("Error cargando pedido:", err);
      } finally {
        setLoading(false);
      }
    }

    loadOrder();
  }, [orderId, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[#6b7280]">Cargando...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <p className="text-[#ef4444]">No se pudo cargar el pedido</p>
          <Link href="/imprimir-publico">
            <Button variant="primary" className="mt-4">
              Volver
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <>
      {/* Header con logo */}
      <header className="bg-white border-b border-[#e5e7eb]">
        <div className="container-custom">
          <div className="flex items-center justify-between py-4">
            <Link href="/" className="flex items-center">
              <Image
                src="/LOGO CLF.png"
                alt="ComprameLaFoto"
                width={200}
                height={60}
                className="h-12 w-auto object-contain"
                priority
              />
            </Link>
            <Link href="/" className="text-sm text-[#6b7280] hover:text-[#1a1a1a]">
              Volver al inicio
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-6xl mx-auto space-y-8">
              {/* Mensaje principal de confirmación */}
              <div className="text-center px-4 md:px-8">
                <div className="w-20 h-20 bg-[#10b981] rounded-full flex items-center justify-center mx-auto mb-6">
                  <svg
                    className="w-10 h-10 text-white"
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
                <h1 className="text-4xl md:text-5xl font-medium text-[#1a1a1a] mb-6">
                  ✅ Pedido confirmado
                </h1>
                {(isPaid || order.paymentStatus === "PAID" || order.status === "PAID" || order.status === "IN_PRODUCTION") ? (
                  <>
                    <p className="text-xl md:text-2xl lg:text-3xl text-[#6b7280] w-full max-w-full mx-auto leading-relaxed px-4 md:px-12">
                      Tu pedido fue pagado correctamente y ya fue enviado al laboratorio seleccionado para su producción.
                    </p>
                    <p className="text-lg md:text-xl lg:text-2xl text-[#6b7280] mt-4 w-full max-w-full mx-auto leading-relaxed px-4 md:px-12">
                      Te avisaremos cuando esté listo para retirar o coordinar la entrega.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xl md:text-2xl lg:text-3xl text-[#6b7280] w-full max-w-full mx-auto leading-relaxed px-4 md:px-12">
                      Tu pedido fue creado exitosamente.
                    </p>
                    <p className="text-lg md:text-xl lg:text-2xl text-[#6b7280] mt-4 w-full max-w-full mx-auto leading-relaxed px-4 md:px-12">
                      El laboratorio procesará tu pedido y te contactará cuando esté listo.
                    </p>
                  </>
                )}
              </div>

              {/* Detalles del pedido */}
              <Card className="bg-white border-2 border-[#e5e7eb]">
                <div className="p-8 md:p-10 lg:p-12">
                  <h2 className="text-2xl md:text-3xl font-medium text-[#1a1a1a] mb-8">Detalles del pedido</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 lg:gap-10">
                    <div>
                      <span className="text-base md:text-lg text-[#6b7280] block mb-2">Número de pedido</span>
                      <span className="text-xl md:text-2xl font-semibold text-[#1a1a1a]">#{order.id}</span>
                    </div>
                    <div>
                      <span className="text-base md:text-lg text-[#6b7280] block mb-2">Laboratorio</span>
                      <span className="text-xl md:text-2xl font-medium text-[#1a1a1a]">{order.lab?.name || "N/A"}</span>
                    </div>
                    <div>
                      <span className="text-base md:text-lg text-[#6b7280] block mb-2">Total pagado</span>
                      <span className="text-3xl md:text-4xl font-semibold text-[#10b981]">
                        ${order.total.toLocaleString("es-AR")}
                      </span>
                    </div>
                    <div>
                      <span className="text-base md:text-lg text-[#6b7280] block mb-2">Estado</span>
                      <span className="inline-flex items-center px-4 py-2 rounded-full text-base md:text-lg font-medium bg-[#10b981]/10 text-[#10b981]">
                        {order.status === "IN_PRODUCTION" ? "En producción" : 
                         order.status === "READY" || order.status === "READY_TO_PICKUP" ? "Listo para retirar" :
                         order.status === "DELIVERED" ? "Entregado" :
                         order.paymentStatus === "PAID" || order.status === "PAID" ? "Pagado" :
                         "Confirmado"}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Información del laboratorio */}
              {order.lab && (
                <Card className="bg-[#f8f9fa] border border-[#e5e7eb]">
                  <div className="p-8 md:p-10 lg:p-12">
                    <h3 className="text-xl md:text-2xl font-medium text-[#1a1a1a] mb-6">Información del laboratorio</h3>
                    <div className="space-y-3">
                      <p className="text-lg md:text-xl text-[#1a1a1a] font-medium">{order.lab.name}</p>
                      {order.lab.address && (
                        <p className="text-base md:text-lg text-[#6b7280]">📍 {order.lab.address}</p>
                      )}
                      {(order.lab.city || order.lab.province) && (
                        <p className="text-base md:text-lg text-[#6b7280]">
                          {order.lab.city}
                          {order.lab.city && order.lab.province && ", "}
                          {order.lab.province}
                        </p>
                      )}
                      {order.lab.phone && (
                        <p className="text-base md:text-lg text-[#6b7280]">📞 {order.lab.phone}</p>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* Botón de acción */}
              <div className="flex justify-center pt-4">
                <Link href="/">
                  <Button 
                    variant="primary" 
                    accentColor="#c27b3d"
                    className="px-10 py-4 text-lg md:text-xl"
                  >
                    Volver al inicio
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
