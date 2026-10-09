import Link from "next/link";
import { notFound } from "next/navigation";
import { REVIEW_STATUS_LABELS, canEdit, type ReviewStatus } from "@repo/muestras";
import { FormularioActividad } from "@/components/formulario/formulario-actividad";
import { BotonesPublicada } from "@/components/formulario/botones-publicada";
import { buscarPropia } from "@/lib/actividades/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";

export default async function EditarActividad({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const usuario = await requireUsuario(`/mis-muestras/${id}`);
  const a = await buscarPropia(id, usuario);
  if (!a) notFound();
  const estado = a.reviewStatus as ReviewStatus;
  const editable = canEdit({ ...a, reviewStatus: estado }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin });
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <Link href="/mis-muestras" className="text-sm underline">← Mis muestras</Link>
      <h1 className="font-[family-name:var(--mf-serif)] text-3xl">{a.title}</h1>
      <p>Estado: <strong>{REVIEW_STATUS_LABELS[estado]}</strong>{a.isCancelled ? " · Cancelada" : ""}</p>
      {estado === "REJECTED" && a.rejectionReason ? <p className="rounded-md bg-red-50 p-3 text-red-800">Motivo del rechazo: {a.rejectionReason}. Corregí y volvé a enviarla.</p> : null}
      {estado === "APPROVED" ? (
        <>
          <p><Link href={`/m/${a.slug}`} className="underline">Ver publicada</Link>. Los cambios se publican sin volver a revisión.</p>
          <BotonesPublicada id={a.id} cancelada={a.isCancelled} />
        </>
      ) : null}
      {estado === "IN_REVIEW" ? <p className="text-[var(--mf-muted)]">Está en revisión. No se puede editar hasta que la revisemos.</p> : null}
      {editable ? <FormularioActividad inicial={a} /> : null}
    </main>
  );
}
