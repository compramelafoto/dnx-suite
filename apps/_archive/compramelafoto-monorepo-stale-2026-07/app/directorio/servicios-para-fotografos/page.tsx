"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import HomeBanner from "@/components/HomeBanner";
import { DirectoryCardContent, DirectoryLogoArea } from "@/components/directorio/DirectoryLogoArea";
import { DirectorySocialRow } from "@/components/directorio/DirectorySocialRow";
import { cmlfDirCard } from "@/components/directorio/directoryCardClasses";

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

const PROVINCIAS_CANONICAS = [
  "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut",
  "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis",
  "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

function normalizeProvince(s: string | null | undefined): string {
  if (!s || !s.trim()) return "";
  return s
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function canonicalProvinceLabel(norm: string): string {
  if (!norm) return "";
  const found = PROVINCIAS_CANONICAS.find(
    (c) => normalizeProvince(c) === norm
  );
  return found ?? norm;
}

function whatsAppLink(whatsapp: string | null): string | null {
  if (!whatsapp?.trim()) return null;
  const digits = whatsapp.replace(/\D/g, "");
  if (!digits.length) return null;
  const withCountry = digits.startsWith("54") ? digits : "54" + digits;
  return `https://wa.me/${withCountry}`;
}

export default function DirectorioServiciosParaFotografosPage() {
  const [profiles, setProfiles] = useState<CommunityProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");

  useEffect(() => {
    fetch("/api/public/community-profiles?type=PHOTOGRAPHER_SERVICE")
      .then((r) => r.json())
      .then((data) => {
        setProfiles(Array.isArray(data?.profiles) ? data.profiles : []);
      })
      .catch(() => setProfiles([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => profiles.filter((p) => p.logoUrl && p.name?.trim()),
    [profiles]
  );

  const searchLower = search.trim().toLowerCase();
  const filteredBySearch = useMemo(() => {
    if (!searchLower) return visible;
    return visible.filter(
      (p) =>
        p.name.toLowerCase().includes(searchLower) ||
        (p.city ?? "").toLowerCase().includes(searchLower) ||
        normalizeProvince(p.province).includes(normalizeProvince(searchLower)) ||
        p.categories.some(
          (c) =>
            c.name.toLowerCase().includes(searchLower) ||
            c.slug.toLowerCase().includes(searchLower)
        )
    );
  }, [visible, searchLower]);

  const filtered = useMemo(() => {
    if (!selectedProvince) return filteredBySearch;
    return filteredBySearch.filter(
      (p) => normalizeProvince(p.province ?? p.city) === selectedProvince
    );
  }, [filteredBySearch, selectedProvince]);

  const provincesOptions = useMemo(() => {
    const byNorm = new Map<string, string>();
    for (const p of visible) {
      const raw = (p.province ?? p.city ?? "").trim();
      if (!raw) continue;
      const norm = normalizeProvince(raw);
      if (!byNorm.has(norm)) byNorm.set(norm, canonicalProvinceLabel(norm));
    }
    return [...byNorm.entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "es"))
      .map(([value, label]) => ({ value, label }));
  }, [visible]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [filtered]);

  return (
    <div className={cmlfDirCard.page}>
      <HomeBanner />
      <section className={`section-spacing ${cmlfDirCard.section}`}>
        <div className="container-custom">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-4">
              Servicios para Fotógrafos
            </h1>
            <p className="text-lg text-[#6b7280] mb-6">
              Empresas y servicios pensados para fotógrafos: tiendas, educación, comunidades y más. Encontrá proveedores con la misma calidad que en el resto del directorio.
            </p>
            <p className="text-base text-[#1a1a1a] font-medium">
              Buscá por nombre, ciudad o provincia.
            </p>
          </div>

          <div id="directorio-servicios-para-fotografos">
            <div className="max-w-5xl mx-auto mb-10 mt-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar por nombre, ciudad o provincia..."
                    className="w-full px-4 py-3 pl-10 rounded-2xl border border-black/10 bg-white text-[#1a1a1a] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/30 focus:border-[#c27b3d]"
                  />
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b7280]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <select
                  value={selectedProvince}
                  onChange={(e) => setSelectedProvince(e.target.value)}
                  className="px-4 py-3 rounded-2xl border border-black/10 bg-white text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/30 focus:border-[#c27b3d] min-w-[200px]"
                >
                  <option value="">Todas las provincias</option>
                  {provincesOptions.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16">
                <p className="text-[#6b7280]">Cargando...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[#6b7280]">No se encontraron servicios.</p>
                <Link href="/" className="text-[#c27b3d] hover:underline mt-2 inline-block">
                  Volver al inicio
                </Link>
              </div>
            ) : (
              <div className={cmlfDirCard.grid}>
                {sorted.map((p) => {
                  const hasMeta =
                    p.categories.length > 0 ||
                    Boolean(p.city || p.province || p.whatsapp);
                  return (
                    <Card key={p.id} className={`${cmlfDirCard.shell} p-0`}>
                      {p.logoUrl && (
                        <DirectoryLogoArea>
                          <Image
                            src={p.logoUrl}
                            alt={p.name}
                            width={560}
                            height={560}
                            className="h-full w-auto max-h-full max-w-full object-contain"
                            unoptimized={p.logoUrl.startsWith("http")}
                          />
                        </DirectoryLogoArea>
                      )}
                      <DirectoryCardContent>
                        <div className={cmlfDirCard.bodyInner}>
                          <h3 className={cmlfDirCard.title}>{p.name}</h3>
                          {hasMeta && (
                            <div className={`${cmlfDirCard.metaStack} mt-4`}>
                              {p.categories.length > 0 && (
                                <p className={`${cmlfDirCard.metaRow} text-balance`}>
                                  {p.categories.map((c) => c.name).join(", ")}
                                </p>
                              )}
                              {(p.city || p.province) && (
                                <p className={cmlfDirCard.metaRow}>
                                  <span aria-hidden>📍</span>
                                  <span>{[p.city, p.province].filter(Boolean).join(", ")}</span>
                                </p>
                              )}
                              {p.whatsapp && (
                                <p className={cmlfDirCard.metaRow}>
                                  <span aria-hidden>📞</span> <span className="tabular-nums">{p.whatsapp}</span>
                                </p>
                              )}
                            </div>
                          )}
                          <DirectorySocialRow
                            className={hasMeta ? "mt-6" : "mt-4"}
                            instagram={p.instagram}
                            facebook={p.facebook}
                            whatsapp={p.whatsapp}
                          />
                          {(whatsAppLink(p.whatsapp) || p.website) && (
                            <div className={cmlfDirCard.ctaWrap}>
                              <a
                                href={
                                  whatsAppLink(p.whatsapp) ||
                                  (p.website?.startsWith("http") ? p.website : `https://${p.website}`)
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cmlfDirCard.ctaLink}
                              >
                                Contactar →
                              </a>
                            </div>
                          )}
                        </div>
                      </DirectoryCardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
