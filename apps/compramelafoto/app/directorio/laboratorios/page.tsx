"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER } from "@/lib/public-flow-config";
import HomeBanner from "@/components/HomeBanner";
import { DirectoryCardContent, DirectoryLogoArea } from "@/components/directorio/DirectoryLogoArea";
import { DirectorySocialRow } from "@/components/directorio/DirectorySocialRow";
import { cmlfDirCard } from "@/components/directorio/directoryCardClasses";

type Lab = {
  id: number;
  name: string;
  logoUrl: string | null;
  phone: string | null;
  city: string | null;
  province: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  publicPageHandler: string | null;
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

export default function DirectorioLaboratoriosPage() {
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");

  useEffect(() => {
    fetch("/api/public/directory/labs")
      .then((r) => r.json())
      .then((data) => {
        setLabs(Array.isArray(data) ? data : []);
      })
      .catch(() => setLabs([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () => labs.filter((l) => l.logoUrl && l.name?.trim()),
    [labs]
  );

  const searchLower = search.trim().toLowerCase();
  const filteredBySearch = useMemo(() => {
    if (!searchLower) return visible;
    return visible.filter(
      (l) =>
        l.name.toLowerCase().includes(searchLower) ||
        (l.city ?? "").toLowerCase().includes(searchLower) ||
        normalizeProvince(l.province).includes(normalizeProvince(searchLower))
    );
  }, [visible, searchLower]);

  const filtered = useMemo(() => {
    if (!selectedProvince) return filteredBySearch;
    return filteredBySearch.filter(
      (l) => normalizeProvince(l.province ?? l.city) === selectedProvince
    );
  }, [filteredBySearch, selectedProvince]);

  const provincesOptions = useMemo(() => {
    const byNorm = new Map<string, string>();
    for (const l of visible) {
      const raw = (l.province ?? l.city ?? "").trim();
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
              Nuestros Laboratorios
            </h1>
            <p className="text-lg text-[#6b7280] mb-6">
              Conocé los laboratorios de impresión asociados a ComprameLaFoto. Elegí el que más te convenga para imprimir fotos, fotos carnet o polaroids con calidad profesional.
            </p>
            <div className="flex flex-wrap gap-3 justify-center mb-6">
              <Link
                href={`/${DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER}/imprimir`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#c27b3d] text-white font-medium hover:bg-[#a86a33] transition-colors"
              >
                Imprimir mis fotos
              </Link>
              <Link
                href={`/${DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER}/fotocarnet`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-black/10 bg-white font-medium hover:bg-[#f9fafb] transition-colors"
              >
                Foto carnet
              </Link>
              <Link
                href={`/${DEFAULT_PUBLIC_PHOTOGRAPHER_HANDLER}/polaroids`}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-black/10 bg-white font-medium hover:bg-[#f9fafb] transition-colors"
              >
                Polaroids
              </Link>
            </div>
            <p className="text-base text-[#1a1a1a] font-medium">
              Buscá abajo por nombre, ciudad o provincia para encontrar tu laboratorio.
            </p>
          </div>

          <div id="directorio-laboratorios">

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
              <p className="text-[#6b7280]">Cargando laboratorios...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#6b7280]">No se encontraron laboratorios.</p>
              <Link href="/" className="text-[#c27b3d] hover:underline mt-2 inline-block">
                Volver al inicio
              </Link>
            </div>
          ) : (
            <div className={cmlfDirCard.grid}>
              {sorted.map((lab) => {
                const hasMeta = Boolean(lab.city || lab.province || lab.phone);
                return (
                  <Card key={lab.id} className={`${cmlfDirCard.shell} p-0`}>
                    {lab.logoUrl && (
                      <DirectoryLogoArea>
                        <Image
                          src={lab.logoUrl}
                          alt={lab.name}
                          width={560}
                          height={560}
                          className="h-full w-auto max-h-full max-w-full object-contain"
                          unoptimized={lab.logoUrl.startsWith("http")}
                        />
                      </DirectoryLogoArea>
                    )}
                    <DirectoryCardContent>
                      <div className={cmlfDirCard.bodyInner}>
                        <h3 className={cmlfDirCard.title}>{lab.name}</h3>
                        {hasMeta && (
                          <div className={`${cmlfDirCard.metaStack} mt-4`}>
                            {(lab.city || lab.province) && (
                              <p className={cmlfDirCard.metaRow}>
                                <span aria-hidden>📍</span>
                                <span>{[lab.city, lab.province].filter(Boolean).join(", ")}</span>
                              </p>
                            )}
                            {lab.phone && (
                              <p className={cmlfDirCard.metaRow}>
                                <span aria-hidden>📞</span> <span>{lab.phone}</span>
                              </p>
                            )}
                          </div>
                        )}
                        <DirectorySocialRow
                          className={hasMeta ? "mt-6" : "mt-4"}
                          instagram={lab.instagram}
                          facebook={lab.facebook}
                          whatsapp={lab.whatsapp}
                        />
                        {lab.publicPageHandler && (
                          <div className={cmlfDirCard.ctaWrap}>
                            <Link href={`/l/${lab.publicPageHandler}`} className={cmlfDirCard.ctaLink}>
                              Ver perfil →
                            </Link>
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
