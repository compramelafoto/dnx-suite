import type { ReactNode } from "react";
import type { Metadata } from "next";
import { requireInfoSpotRedaccionAccess } from "@/lib/infospot-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * DIRECTOR y REDACTOR (membresía ACTIVE).
 * No indexar paneles internos.
 */
export default async function RedaccionLayout({ children }: { children: ReactNode }) {
  await requireInfoSpotRedaccionAccess();
  return <div className="min-h-full bg-[var(--is-bg)]">{children}</div>;
}
