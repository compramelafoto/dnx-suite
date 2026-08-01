"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LabHeader from "@/components/lab/LabDashboardHeader";
import OrdersTable from "./orders-table";
import { ensureLabSession } from "@/lib/lab-session-client";

type OrderRow = {
  id: number;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  photographerId: number | null;
  photographerName: string | null;
  photographerAddress: string | null;
  pickupBy: string;
  labAddress: string | null;
  labName: string | null;
  createdAtText: string;
  statusUpdatedAtText: string;
  itemsCount: number;
  currency: string;
  total: number;
  status: string;
  paymentStatus?: string | null;
  origin?: "LAB_LANDING" | "PHOTOGRAPHER_DEFAULT_LAB";
};

export default function LabPedidosPage() {
  const router = useRouter();
  const [labId, setLabId] = useState<number | null>(null);
  const [lab, setLab] = useState<{
    id: number;
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  } | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensureLabSession();
      if (!active) return;
      if (!session) {
        router.push("/lab/login");
        return;
      }
      setLabId(session.labId);
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    if (!labId) return;
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/print-orders?labId=${labId}&limit=200`, { credentials: "include" });
        if (!res.ok) {
          if (res.status === 403) {
            router.push("/lab/login");
            return;
          }
          throw new Error("Error cargando pedidos");
        }
        const data = await res.json();
        if (!active) return;
        const rows: OrderRow[] = (Array.isArray(data) ? data : []).map((o: any) => {
          const ownerType = (o.ownerType || "").toString().toUpperCase();
          const origin: "LAB_LANDING" | "PHOTOGRAPHER_DEFAULT_LAB" =
            ownerType === "LAB" ? "LAB_LANDING" : "PHOTOGRAPHER_DEFAULT_LAB";
          return {
            id: o.id,
            customerName: o.customerName,
            customerEmail: o.customerEmail,
            customerPhone: o.customerPhone,
            photographerId: o.photographerId,
            photographerName: o.photographer?.name || null,
            photographerAddress: o.photographer?.companyAddress || o.photographer?.address || null,
            pickupBy: o.pickupBy || "CLIENT",
            labAddress: o.lab?.address || null,
            labName: o.lab?.name || null,
            createdAtText: new Intl.DateTimeFormat("es-AR", {
              dateStyle: "short",
              timeStyle: "medium",
              timeZone: "America/Argentina/Buenos_Aires",
            }).format(new Date(o.createdAt)),
            statusUpdatedAtText: new Intl.DateTimeFormat("es-AR", {
              dateStyle: "short",
              timeStyle: "medium",
              timeZone: "America/Argentina/Buenos_Aires",
            }).format(new Date(o.statusUpdatedAt)),
            itemsCount: o.items?.length || 0,
            currency: o.currency || "ARS",
            total: o.total ?? 0,
            status: o.status || "CREATED",
            paymentStatus: o.paymentStatus ?? null,
            origin,
          };
        });
        setOrders(rows);
      } catch (err) {
        console.error("Error cargando pedidos:", err);
        setOrders([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [labId, router]);

  useEffect(() => {
    if (!labId) return;
    fetch(`/api/lab/${labId}`, { credentials: "include" })
      .then((res) => res.ok ? res.json() : null)
      .then((data) =>
        data &&
        setLab({
          id: data.id,
          name: data.name ?? "",
          logoUrl: data.logoUrl ?? null,
          primaryColor: data.primaryColor ?? null,
          secondaryColor: data.secondaryColor ?? null,
        })
      )
      .catch(() => {});
  }, [labId]);

  if (!labId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-[#6b7280]">Verificando sesión...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LabHeader lab={lab} />
      <main className="p-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-semibold text-[#1a1a1a] mb-2">Pedidos</h1>
        <p className="text-[#6b7280] mb-6">
          Solo ves los pedidos asignados a tu laboratorio. Filtrá por origen (Público/Profesional), estado y buscá por cliente.
        </p>

        {loading ? (
          <div className="py-12 text-center text-[#6b7280]">Cargando pedidos...</div>
        ) : (
          <OrdersTable orders={orders} showOrigin />
        )}

        <div className="mt-6">
          <Link href="/lab/dashboard" className="text-[#6b7280] hover:text-[#1a1a1a]">
            ← Volver al panel
          </Link>
        </div>
      </main>
    </div>
  );
}
