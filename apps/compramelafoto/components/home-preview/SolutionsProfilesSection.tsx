"use client";

import { useState } from "react";
import Image from "next/image";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewProse from "@/components/home-preview/PreviewProse";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import PreviewVisual from "@/components/home-preview/PreviewVisual";
import { PreviewButtonLink } from "@/components/home-preview/PreviewButton";
import { PREVIEW_PROFILES, type ProfileId } from "@/components/home-preview/preview-nav";
import { cn } from "@/lib/utils";

const PROFILE_IMAGES: Partial<Record<ProfileId, string>> = {
  photographers: "/images/landescolar/fotografo-curso-bandera-argentina.jpg",
  schools: "/images/landescolar/sobres-etiquetados-compramelafoto.jpg",
  organizers: "/images/organizador/hero-marketing.jpg",
};

export default function SolutionsProfilesSection() {
  const [active, setActive] = useState<ProfileId>("photographers");
  const profile = PREVIEW_PROFILES.find((p) => p.id === active)!;
  const imageSrc = PROFILE_IMAGES[active];

  return (
    <PreviewSection id="soluciones-perfiles" variant="muted">
      <PreviewReveal>
        <PreviewProse className="mb-8 md:mb-10 max-w-[min(100%,42rem)] mx-auto md:mx-0 md:text-left text-center">
          <h2 className="text-2xl sm:text-3xl font-semibold text-[#111827] m-0 tracking-tight">
            Soluciones para cada perfil
          </h2>
          <p className="text-[#6b7280] text-base mt-3 mb-0 leading-relaxed">
            Elegí tu rol: cada flujo está pensado para compradores, vendedores u operadores de eventos.
          </p>
        </PreviewProse>
      </PreviewReveal>

      <div
        className="flex flex-wrap gap-2 mb-8 w-full min-w-0"
        role="tablist"
        aria-label="Perfiles"
      >
        {PREVIEW_PROFILES.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={active === p.id}
            onClick={() => setActive(p.id)}
            className={cn(
              "px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors min-w-0",
              active === p.id
                ? "bg-[#111827] text-white border-[#111827]"
                : "bg-white text-[#4b5563] border-[#e5e7eb] hover:bg-[#f9fafb]"
            )}
          >
            {p.title}
          </button>
        ))}
      </div>

      <PreviewReveal delay={80}>
        <article
          id={profile.anchor}
          className="hp-card grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-center rounded-2xl border border-[#e5e7eb] bg-white p-6 sm:p-8 md:p-10 min-w-0 w-full scroll-mt-28"
          role="tabpanel"
        >
          <div className="min-w-0 order-2 lg:order-1">
            <h3 className="text-xl sm:text-2xl font-semibold text-[#111827] m-0">{profile.title}</h3>
            <ul className="mt-5 space-y-3 m-0 p-0 list-none min-w-0">
              {profile.benefits.map((b) => (
                <li key={b} className="flex gap-3 text-[#374151] text-sm sm:text-base min-w-0">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c27b3d]" aria-hidden />
                  <span className="min-w-0 leading-relaxed">{b}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8">
              <PreviewButtonLink href={profile.href} variant="accent" size="md">
                {profile.cta}
              </PreviewButtonLink>
            </div>
          </div>
          <div className="min-w-0 order-1 lg:order-2 w-full max-w-md mx-auto lg:max-w-none">
            {imageSrc ? (
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-[#e5e7eb] bg-[#f9fafb]">
                {/* TODO: reemplazar por asset de marca por perfil */}
                <Image
                  src={imageSrc}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
            ) : (
              <PreviewVisual variant={profile.visual} aspect="portrait" />
            )}
          </div>
        </article>
      </PreviewReveal>
    </PreviewSection>
  );
}
