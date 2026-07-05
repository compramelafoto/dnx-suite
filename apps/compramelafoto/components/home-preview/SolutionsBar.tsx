"use client";

import Link from "next/link";
import PreviewSection from "@/components/home-preview/PreviewSection";
import PreviewReveal from "@/components/home-preview/PreviewReveal";
import { PREVIEW_SOLUTIONS_BAR } from "@/components/home-preview/preview-nav";
import { cn } from "@/lib/utils";

export default function SolutionsBar() {
  return (
    <PreviewSection id="barra-soluciones" variant="default" className="!py-8 md:!py-10 border-b border-[#f3f4f6]">
      <PreviewReveal>
        <p className="text-center text-xs font-medium uppercase tracking-[0.16em] text-[#9ca3af] m-0 mb-5">
          Explorá la plataforma
        </p>
        <ul className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory m-0 p-0 list-none min-w-0 md:grid md:grid-cols-3 lg:grid-cols-6 md:gap-3 md:overflow-visible md:snap-none">
          {PREVIEW_SOLUTIONS_BAR.map((item) => (
            <li key={item.label} className="snap-start shrink-0 md:shrink min-w-0 flex">
              <Link
                href={item.href}
                className={cn(
                  "hp-card flex items-center justify-center min-h-[3.25rem] px-4 py-3 rounded-xl border border-[#e5e7eb] bg-white",
                  "text-sm font-medium text-[#374151] hover:text-[#111827] text-center whitespace-nowrap md:whitespace-normal",
                  "w-full min-w-[10.5rem] md:min-w-0 transition-colors"
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </PreviewReveal>
    </PreviewSection>
  );
}
