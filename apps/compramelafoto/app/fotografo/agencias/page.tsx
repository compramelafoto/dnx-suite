"use client";

import Link from "next/link";
import Card from "@/components/ui/Card";
import AgencyPageFrame from "@/components/agencies/AgencyPageFrame";
import { AGENCY_SECTIONS } from "@/lib/agencies/sections";

export default function AgenciasHomePage() {
  return (
    <AgencyPageFrame
      title="Agencias"
      subtitle="Trabajá en equipo: una agencia junta a varios fotógrafos que venden desde un mismo álbum y cada uno cobra su parte."
    >
      <div className="grid gap-4 md:grid-cols-3">
        {AGENCY_SECTIONS.map((s) => (
          <Link key={s.id} href={s.path} className="block">
            <Card className="h-full space-y-2 transition hover:shadow-md">
              <h2 className="text-lg font-semibold text-[#1a1a1a]">{s.label}</h2>
              <p className="text-sm text-[#6b7280]">{s.help}</p>
            </Card>
          </Link>
        ))}
      </div>
    </AgencyPageFrame>
  );
}
