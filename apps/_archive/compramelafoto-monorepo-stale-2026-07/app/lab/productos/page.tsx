"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LabHeader from "@/components/lab/LabDashboardHeader";
import LabProductosSection from "@/components/lab/LabProductosSection";
import { ensureLabSession } from "@/lib/lab-session-client";

export default function LabProductosPage() {
  const router = useRouter();
  const [labId, setLabId] = useState<number | null>(null);
  const [lab, setLab] = useState<{
    id: number;
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
  } | null>(null);

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
    fetch(`/api/lab/${labId}`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setLab({
            id: data.id,
            name: data.name,
            logoUrl: data.logoUrl ?? null,
            primaryColor: data.primaryColor ?? null,
            secondaryColor: data.secondaryColor ?? null,
          });
        }
      })
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
      <section className="py-12 md:py-16 bg-white min-h-screen">
        <div className="container-custom">
          <div className="max-w-7xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-[#1a1a1a] mb-2">Productos</h1>
                <p className="text-[#6b7280] text-lg">Gestioná tus productos, precios y descuentos por cantidad</p>
              </div>
              <Link
                href="/lab/dashboard"
                className="flex items-center gap-2 px-4 py-2 text-[#6b7280] hover:text-[#1a1a1a] transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Volver al Panel
              </Link>
            </div>

            <LabProductosSection labId={labId} />
          </div>
        </div>
      </section>
    </div>
  );
}
