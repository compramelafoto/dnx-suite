import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@repo/db";
import { acceptsSubmissions, callPhase, formatArDay, submitterConflict } from "@repo/muestras";
import { FormularioEnvio } from "@/components/envios/formulario-envio";
import { buscarConvocatoriaPublica } from "@/lib/convocatorias/consultas";
import { dondePuede } from "@/lib/equipo/permisos";
import { buscarMiEnvio } from "@/lib/envios/consultas";
import { buscarPerfilPropio } from "@/lib/perfiles/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Enviar obras", robots: { index: false } };

type Props = { params: Promise<{ slug: string }> };

export default async function EnviarObras({ params }: Props) {
  const { slug } = await params;
  const usuario = await requireUsuario(`/convocatorias/${slug}/enviar`);
  const c = await buscarConvocatoriaPublica(slug);
  if (!c) notFound();
  const fase = callPhase(c, new Date());
  // Sólo choca el dueño (`manageCall`): la coorganización puede enviar obras (D4). El super admin
  // se evalúa como cualquiera: este conflicto no es un permiso.
  const organiza = await prisma.culturalCall.count({ where: { id: c.id, activity: dondePuede({ ...usuario, esSuperAdmin: false }, "manageCall") } });
  const curador = await prisma.culturalCallCurator.findFirst({
    where: { callId: c.id, status: { not: "REVOKED" }, OR: [{ userId: usuario.id }, { email: usuario.email.toLowerCase() }] },
    select: { id: true },
  });
  const a = c.activity;
  // `buscarConvocatoriaPublica` sólo devuelve convocatorias de muestras con lugar físico.
  const lugar = [a.venueName, a.city, a.province].filter(Boolean).join(", ");
  const conflicto = submitterConflict({ isOwner: organiza > 0, isCurator: !!curador });
  const [previo, perfil] = await Promise.all([buscarMiEnvio(c.id, usuario.id), buscarPerfilPropio(usuario.id)]);

  return (
    <main className="mf-marco max-w-3xl space-y-8 py-10 sm:py-16">
      <header className="space-y-3">
        <p className="text-sm text-[var(--mf-muted)]"><Link href={`/convocatorias/${c.slug}`} className="underline underline-offset-4">{c.title}</Link></p>
        <h1 className="mf-titulo text-[clamp(2.2rem,4vw,3rem)]">{previo?.status === "ACTIVE" ? "Tu envío" : "Enviar obras"}</h1>
        <p className="text-lg text-[var(--mf-muted)]">Para exponer en la muestra {a.title}{lugar ? `. ${lugar}` : ""}</p>
        <p className="text-lg leading-snug text-[var(--mf-muted)]">
          Hasta {c.maxWorksPerPerson} {c.maxWorksPerPerson === 1 ? "obra" : "obras"}. Podés cambiarlas o retirar el envío hasta el {formatArDay(c.closesAt)}. El equipo curatorial no ve tu nombre: no lo pongas en la imagen ni en los textos.
        </p>
      </header>
      {!acceptsSubmissions(fase) ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">Esta convocatoria no recibe obras en este momento.</p>
      ) : conflicto ? (
        <p className="border-t border-[var(--mf-line)] pt-6 text-lg">{conflicto}</p>
      ) : (
        <FormularioEnvio
          callId={c.id}
          maxObras={c.maxWorksPerPerson}
          bases={c.basesText}
          derechos={c.rightsText}
          retirable={previo?.status === "ACTIVE"}
          inicial={{
            authorName: previo?.authorName ?? perfil?.displayName ?? usuario.name ?? "",
            works: previo?.status === "ACTIVE" ? previo.works.map((w) => ({ ...w, technique: w.technique ?? "", statement: w.statement ?? "" })) : [],
          }}
        />
      )}
    </main>
  );
}
