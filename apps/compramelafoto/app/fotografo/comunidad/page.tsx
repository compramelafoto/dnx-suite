"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";

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

type CommunityProfile = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  province: string | null;
  city: string | null;
  address: string | null;
  email: string | null;
  whatsapp: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  logoUrl: string | null;
  isFeatured: boolean;
  categories: { name: string; slug: string }[];
  workReferences: string[];
};

function whatsAppLink(whatsapp: string | null): string | null {
  if (!whatsapp?.trim()) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (!digits.length) return null;
  const withCountry = digits.startsWith("54") ? digits : "54" + digits;
  return `https://wa.me/${withCountry}`;
}

const TABS = [
  { id: "fotografos", label: "Fotógrafos" },
  { id: "laboratorios", label: "Laboratorios" },
  { id: "para-fotografos", label: "Para fotógrafos" },
  { id: "proveedores", label: "Proveedores" },
] as const;

export default function ComunidadPage() {
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]["id"]>("fotografos");
  const [photographers, setPhotographers] = useState<Photographer[]>([]);
  const [labs, setLabs] = useState<Lab[]>([]);
  const [paraFotografos, setParaFotografos] = useState<CommunityProfile[]>([]);
  const [proveedores, setProveedores] = useState<CommunityProfile[]>([]);
  const [loadingPhoto, setLoadingPhoto] = useState(true);
  const [loadingLabs, setLoadingLabs] = useState(true);
  const [loadingParaFotografos, setLoadingParaFotografos] = useState(true);
  const [loadingProveedores, setLoadingProveedores] = useState(true);

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

  useEffect(() => {
    fetch("/api/public/community-profiles?type=PHOTOGRAPHER_SERVICE")
      .then((r) => r.json())
      .then((data) => setParaFotografos(Array.isArray(data?.profiles) ? data.profiles : []))
      .catch(() => setParaFotografos([]))
      .finally(() => setLoadingParaFotografos(false));
  }, []);

  useEffect(() => {
    fetch("/api/public/community-profiles?type=EVENT_VENDOR")
      .then((r) => r.json())
      .then((data) => setProveedores(Array.isArray(data?.profiles) ? data.profiles : []))
      .catch(() => setProveedores([]))
      .finally(() => setLoadingProveedores(false));
  }, []);

  const visiblePhotographers = photographers.filter(
    (p) => p.logoUrl && (p.companyName?.trim() || p.name?.trim())
  );
  const visibleLabs = labs.filter((l) => l.logoUrl && l.name?.trim());

  return (
    <>
      <PhotographerDashboardHeader photographer={null} />
      <section className="py-12 md:py-16 bg-white min-h-screen">
        <div className="container-custom">
          <div className="max-w-6xl mx-auto space-y-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-[#1a1a1a] mb-2">
                Comunidad
              </h1>
              <p className="text-[#6b7280]">
                Fotógrafos, laboratorios, servicios para fotógrafos y proveedores de eventos.
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
                      ? "bg-[#c27b3d]/12 text-[#c27b3d]"
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
                    className="text-sm font-medium text-[#c27b3d] hover:underline"
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
                            className="mt-2 text-sm font-medium text-[#c27b3d] hover:underline"
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
                    className="text-sm font-medium text-[#c27b3d] hover:underline"
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
                    {visibleLabs.slice(0, 24).map((lab) => (
                      <Card key={lab.id} className="p-4 flex flex-col">
                        {lab.logoUrl && (
                          <div className="w-full h-24 bg-gray-50 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                            <Image
                              src={lab.logoUrl}
                              alt={lab.name}
                              width={80}
                              height={80}
                              className="object-contain"
                              unoptimized={lab.logoUrl.startsWith("http")}
                            />
                          </div>
                        )}
                        <h3 className="font-semibold text-[#1a1a1a] truncate">{lab.name}</h3>
                        {(lab.city || lab.province) && (
                          <p className="text-sm text-[#6b7280] truncate">
                            {[lab.city, lab.province].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {lab.publicPageHandler ? (
                          <Link
                            href={`/l/${lab.publicPageHandler}`}
                            className="mt-2 text-sm font-medium text-[#c27b3d] hover:underline"
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

            {activeTab === "para-fotografos" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[#6b7280]">
                    {paraFotografos.length} servicios para fotógrafos en la plataforma
                  </span>
                </div>
                {loadingParaFotografos ? (
                  <p className="text-[#6b7280] py-8">Cargando...</p>
                ) : paraFotografos.length === 0 ? (
                  <p className="text-[#6b7280] py-8">Aún no hay entradas en este directorio.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {paraFotografos.map((p) => (
                      <Card key={p.id} className="p-4 flex flex-col">
                        {p.logoUrl && (
                          <div className="w-full h-24 bg-gray-50 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                            <Image
                              src={p.logoUrl}
                              alt={p.name}
                              width={80}
                              height={80}
                              className="object-contain"
                              unoptimized={p.logoUrl.startsWith("http")}
                            />
                          </div>
                        )}
                        <h3 className="font-semibold text-[#1a1a1a] truncate">{p.name}</h3>
                        {p.categories.length > 0 && (
                          <p className="text-sm text-[#6b7280] truncate">
                            {p.categories.map((c) => c.name).join(", ")}
                          </p>
                        )}
                        {(p.city || p.province) && (
                          <p className="text-sm text-[#6b7280] truncate">
                            {[p.city, p.province].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {(whatsAppLink(p.whatsapp) || p.website) && (
                          <a
                            href={whatsAppLink(p.whatsapp) || (p.website?.startsWith("http") ? p.website : `https://${p.website}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 text-sm font-medium text-[#c27b3d] hover:underline"
                          >
                            Contactar →
                          </a>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}

            {activeTab === "proveedores" && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-[#6b7280]">
                    {proveedores.length} proveedores en la plataforma
                  </span>
                </div>
                {loadingProveedores ? (
                  <p className="text-[#6b7280] py-8">Cargando...</p>
                ) : proveedores.length === 0 ? (
                  <p className="text-[#6b7280] py-8">Aún no hay proveedores en este directorio.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {proveedores.map((p) => (
                      <Card key={p.id} className="p-4 flex flex-col">
                        {p.logoUrl && (
                          <div className="w-full h-24 bg-gray-50 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                            <Image
                              src={p.logoUrl}
                              alt={p.name}
                              width={80}
                              height={80}
                              className="object-contain"
                              unoptimized={p.logoUrl.startsWith("http")}
                            />
                          </div>
                        )}
                        <h3 className="font-semibold text-[#1a1a1a] truncate">{p.name}</h3>
                        {p.categories.length > 0 && (
                          <p className="text-sm text-[#6b7280] truncate">
                            {p.categories.map((c) => c.name).join(", ")}
                          </p>
                        )}
                        {(p.city || p.province) && (
                          <p className="text-sm text-[#6b7280] truncate">
                            {[p.city, p.province].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {(whatsAppLink(p.whatsapp) || p.website) && (
                          <a
                            href={whatsAppLink(p.whatsapp) || (p.website?.startsWith("http") ? p.website : `https://${p.website}`)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 text-sm font-medium text-[#c27b3d] hover:underline"
                          >
                            Contactar →
                          </a>
                        )}
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
