"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Card from "@/components/ui/Card";
import HomeBanner from "@/components/HomeBanner";

type OrganizerDirectoryItem = {
  id: number;
  displayName: string;
  tagline: string | null;
  publicSlug: string;
  logoUrl: string;
  city: string | null;
  zone: string | null;
  website: string | null;
  instagram: string | null;
  whatsapp: string | null;
  publicEmail: string | null;
};

function getInitials(name: string): string {
  const text = name.trim();
  if (!text) return "?";
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return text.slice(0, 2).toUpperCase();
}

export default function DirectorioOrganizadoresPage() {
  const [organizers, setOrganizers] = useState<OrganizerDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/public/directory/organizers")
      .then((r) => r.json())
      .then((data) => setOrganizers(Array.isArray(data) ? data : []))
      .catch(() => setOrganizers([]))
      .finally(() => setLoading(false));
  }, []);

  const searchLower = search.trim().toLowerCase();
  const filtered = useMemo(() => {
    const list = organizers.filter((o) => o.displayName?.trim());
    if (!searchLower) return list;
    return list.filter(
      (o) =>
        o.displayName.toLowerCase().includes(searchLower) ||
        (o.tagline ?? "").toLowerCase().includes(searchLower) ||
        (o.city ?? "").toLowerCase().includes(searchLower) ||
        (o.zone ?? "").toLowerCase().includes(searchLower)
    );
  }, [organizers, searchLower]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.displayName.localeCompare(b.displayName, "es")),
    [filtered]
  );

  return (
    <div className="min-h-screen bg-[#f7f5f2]">
      <HomeBanner />
      <section className="section-spacing bg-[#f9fafb]">
        <div className="container-custom">
          <div className="max-w-5xl mx-auto text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-semibold text-[#1a1a1a] mb-4">
              Organizadores de eventos
            </h1>
            <p className="text-lg text-[#6b7280] mb-6">
              Clubes, torneos y productoras que usan ComprameLaFoto para sus eventos. Visitá su página
              pública y conocé sus próximos encuentros.
            </p>
          </div>

          <div className="max-w-5xl mx-auto mb-10">
            <div className="relative">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre, ciudad o zona..."
                className="w-full px-4 py-3 pl-10 rounded-2xl border border-black/10 bg-white text-[#1a1a1a] placeholder:text-[#6b7280] focus:outline-none focus:ring-2 focus:ring-[#c27b3d]/30 focus:border-[#c27b3d]"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[#6b7280]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-[#6b7280] py-16">Cargando organizadores…</p>
          ) : sorted.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-[#6b7280]">No hay organizadores publicados en el directorio.</p>
              <Link href="/" className="text-[#c27b3d] hover:underline mt-2 inline-block">
                Volver al inicio
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {sorted.map((o) => (
                <Card key={o.id} className="overflow-hidden h-full flex flex-col">
                  <div className="w-full aspect-square max-h-40 bg-[#f9fafb] flex items-center justify-center p-4 -mx-6 -mt-6 mb-4 rounded-t-3xl overflow-hidden">
                    {o.logoUrl ? (
                      <Image
                        src={o.logoUrl}
                        alt={o.displayName}
                        width={120}
                        height={120}
                        className="object-contain max-h-full max-w-full"
                        unoptimized={o.logoUrl.startsWith("http")}
                      />
                    ) : (
                      <span className="text-3xl font-semibold text-[#c27b3d]/70 bg-[#c27b3d]/10 w-20 h-20 rounded-full flex items-center justify-center">
                        {getInitials(o.displayName)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-[#1a1a1a] mb-2">{o.displayName}</h3>
                    {o.tagline ? (
                      <p className="text-sm text-[#6b7280] mb-2 line-clamp-2">{o.tagline}</p>
                    ) : null}
                    {(o.city || o.zone) && (
                      <p className="text-sm text-[#6b7280] mb-2 flex items-center gap-1">
                        <span>📍</span> {[o.city, o.zone].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/${o.publicSlug}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[#c27b3d] hover:underline whitespace-nowrap"
                  >
                    Ver página pública →
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
