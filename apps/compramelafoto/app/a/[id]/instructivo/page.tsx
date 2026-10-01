// app/a/[id]/instructivo/page.tsx — Instructivo público del álbum.
//
// Se arma en el momento, no se guarda: un enlace compartido hace un mes tiene que decir
// la verdad sobre el álbum de hoy. El segmento se llama `[id]` (no `[slug]`) porque así
// se llama ya en `app/a/`: Next no admite dos nombres para el mismo nivel dinámico.
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { loadAlbumInstructivo } from "@/lib/instructivos/load-album-instructivo";
import { buildInstructivoSteps } from "@/lib/instructivos/album-instructivo-steps";
import { buildQrDataUrl } from "@/lib/instructivos/instructivo-qr";
import InstructivoView from "@/components/instructivos/InstructivoView";

export default async function InstructivoPage({
  params,
}: {
  params: Promise<{ id?: string }>;
}) {
  const { id } = await params;
  const profile = await loadAlbumInstructivo(String(id || "").trim());
  if (!profile) notFound();

  const steps = buildInstructivoSteps(profile);
  const qrDataUrl = await buildQrDataUrl(profile.album.url, 320);

  return (
    <InstructivoView
      profile={profile}
      steps={steps}
      qrDataUrl={qrDataUrl}
      pdfHref={`/api/a/${profile.album.slug}/instructivo/pdf`}
    />
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id?: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const profile = await loadAlbumInstructivo(String(id || "").trim());
  if (!profile) return {};
  return {
    title: `Cómo comprar tus fotos — ${profile.album.titulo}`,
    description: `Instructivo de ${profile.fotografo.nombre} para encontrar y comprar tus fotos.`,
  };
}
