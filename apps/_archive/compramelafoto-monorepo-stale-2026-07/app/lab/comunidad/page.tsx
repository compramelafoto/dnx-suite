"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import LabHeader from "@/components/lab/LabDashboardHeader";
import { ensureLabSession } from "@/lib/lab-session-client";

type Photographer = {
  id: number;
  name: string | null;
  companyName: string | null;
  logoUrl: string | null;
  city: string | null;
  province: string | null;
  publicPageHandler: string | null;
};

type Lab = {
  id: number;
  name: string;
  logoUrl: string | null;
  city: string | null;
  province: string | null;
  publicPageHandler: string | null;
};

const TABS = [
  { id: "fotografos", label: "Fotógrafos" },
  { id: "laboratorios", label: "Laboratorios" },
] as const;

export default function LabComunidadPage() {
  const router = useRouter();
  const [lab, setLab] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"fotografos" | "laboratorios">("fotografos");
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loadingPhoto, setLoadingPhoto] = useState(true);
  const [loadingLabs, setLoadingLabs] = useState(true);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensureLabSession();
      if (!active) return;
      if (!session) {
        router.push("/lab/login");
        return;
      }
      try {
        const res = await fetch(`/api/lab/${session.labId}`);
        if (res.ok) {
          const data = await res.json();
          setLab(data);
        }
      } catch {
        // ignore
      } finally {
        setAuthLoading(false);
      }
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    fetch("/api/public/directory/photographers")
      .then((r) => r.json())
      .then((data) => setPhotographers(Array.isArray(data) ? data : []))
      .catch(() => setPhotographers([]))
      .finally(() => setLoadingPhoto(false));
  }, []);

  useEffect(() => {
    fetch("/api/public/directory/labs")
      .then((r) => r.json())
      .then((data) => setLabs(Array.isArray(data) ? data : []))
      .catch(() => setLabs([]))
      .finally(() => setLoadingLabs(false));
  }, []);

  const visiblePhotographers = photographers.filter(
    (p) => p.logoUrl && (p.companyName?.trim() || p.name?.trim())
  );
  const visibleLabs = labs.filter((l) => l.logoUrl && l.name?.trim());

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <LabHeader lab={lab} />
        <section className="py-12 md:py-16 bg-white min-h-screen">
          <div className="container-custom">
            <div className="max-w-6xl mx-auto text-center">
              <p className="text-[#6b7280]">Cargando...</p>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LabHeader lab={lab} />
      <section className="py-12 md:py-16 bg-white min-h-screen">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-[#1a1a1a] mb-2">
                Comunidad
              </h1>
              <p className="text-[#6b7280]">
                Fotógrafos y laboratorios que trabajan con ComprameLaFoto.
              </p>
            </div>

            <div className="flex gap-2 border-b border-gray-200 pb-2">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-[#3b82f6]/12 text-[#2563eb]"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === "fotografos" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[#6b7280]">
                    {visiblePhotographers.length} fotógrafos en la plataforma
                  </span>
                  <Link
                    href="/directorio/fotografos"
                    className="text-sm font-medium text-[#2563eb] hover:underline"
                  >
                    Ver directorio completo →
                  </Link>
                </div>
                {loadingPhoto ? (
                  <p className="text-[#6b7280] py-8">Cargando fotógrafos...</p>
                ) : visiblePhotographers.length === 0 ? (
                  <p className="text-[#6b7280] py-8">No hay fotógrafos publicados en el directorio.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visiblePhotographers.slice(0, 24).map((p) => (
                      <Card key={p.id} className="p-4 flex flex-col">
                        {p.logoUrl && (
                          <div className="w-full h-24 bg-gray-50 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                            <Image
                              src={p.logoUrl}
                              alt={p.companyName || p.name || ""}
                              width={80}
                              height={80}
                              className="object-contain"
                              unoptimized={p.logoUrl.startsWith("http")}
                            />
                          </div>
                        )}
                        <h3 className="font-semibold text-[#1a1a1a] truncate">
                          {p.companyName || p.name || "Sin nombre"}
                        </h3>
                        {(p.city || p.province) && (
                          <p className="text-sm text-[#6b7280] truncate">
                            {[p.city, p.province].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {p.publicPageHandler ? (
                          <Link
                            href={`/f/${p.publicPageHandler}`}
                            className="mt-2 text-sm font-medium text-[#2563eb] hover:underline"
                          >
                            Ver perfil →
                          </Link>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "laboratorios" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[#6b7280]">
                    {visibleLabs.length} laboratorios en la plataforma
                  </span>
                  <Link
                    href="/directorio/laboratorios"
                    className="text-sm font-medium text-[#2563eb] hover:underline"
                  >
                    Ver directorio completo →
                  </Link>
                </div>
                {loadingLabs ? (
                  <p className="text-[#6b7280] py-8">Cargando laboratorios...</p>
                ) : visibleLabs.length === 0 ? (
                  <p className="text-[#6b7280] py-8">No hay laboratorios publicados en el directorio.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {visibleLabs.slice(0, 24).map((labItem) => (
                      <Card key={labItem.id} className="p-4 flex flex-col">
                        {labItem.logoUrl && (
                          <div className="w-full h-24 bg-gray-50 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                            <Image
                              src={labItem.logoUrl}
                              alt={labItem.name}
                              width={80}
                              height={80}
                              className="object-contain"
                              unoptimized={labItem.logoUrl.startsWith("http")}
                            />
                          </div>
                        )}
                        <h3 className="font-semibold text-[#1a1a1a] truncate">{labItem.name}</h3>
                        {(labItem.city || labItem.province) && (
                          <p className="text-sm text-[#6b7280] truncate">
                            {[labItem.city, labItem.province].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {labItem.publicPageHandler ? (
                          <Link
                            href={`/l/${labItem.publicPageHandler}`}
                            className="mt-2 text-sm font-medium text-[#2563eb] hover:underline"
                          >
                            Ver perfil →
                          </Link>
                        ) : null}
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
