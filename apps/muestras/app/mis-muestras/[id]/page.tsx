import Link from "next/link";
import { notFound } from "next/navigation";
import { REVIEW_STATUS_LABELS, canEdit, type ReviewStatus } from "@repo/muestras";
import { FormularioActividad } from "@/components/formulario/formulario-actividad";
import { BotonesPublicada } from "@/components/formulario/botones-publicada";
import { buscarPropia } from "@/lib/actividades/consultas";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";

/** Los faltantes que dejó un "Enviar a revisión" fallido al crear el borrador. Sólo se muestran. */
function faltantes(raw: string | string[] | undefined): string[] {
  if (typeof raw !== "string" || !raw) return [];
  return raw.split("|").map((m) => m.trim().slice(0, 300)).filter(Boolean).slice(0, 20);
}

export default async function EditarActividad({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ faltan?: string | string[] }>;
}) {
  const { id } = await params;
  const faltan = faltantes((await searchParams).faltan);
  const usuario = await requireUsuario(`/mis-muestras/${id}`);
  const a = await buscarPropia(id, usuario);
  if (!a) notFound();
  const estado = a.reviewStatus as ReviewStatus;
  const editable = canEdit({ ...a, reviewStatus: estado }, { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin });
  return (
    <main className="mx-auto max-w-3xl space-y-6 p-4 sm:p-8">
      <Link href="/mis-muestras" className="text-sm text-[var(--mf-accent)] underline underline-offset-4">Volver a mis muestras</Link>
      <h1 className="mf-titulo text-[2.45rem]">{a.title}</h1>
      <p>Estado: <strong>{REVIEW_STATUS_LABELS[estado]}</strong>{a.isCancelled ? ". Cancelada" : ""}</p>
      {estado === "REJECTED" && a.rejectionReason ? <p className="rounded-[2px] bg-red-50 p-3 text-red-800">Motivo del rechazo: {a.rejectionReason}. Corregí y volvé a enviarla.</p> : null}
      {estado === "APPROVED" ? (
        <>
          <p><Link href={`/m/${a.slug}`} className="underline">Ver publicada</Link>. Los cambios se publican sin volver a revisión.</p>
          <BotonesPublicada id={a.id} cancelada={a.isCancelled} />
        </>
      ) : null}
      {estado === "IN_REVIEW" ? <p className="text-[var(--mf-muted)]">Está en revisión. No se puede editar hasta que la revisemos.</p> : null}
      {faltan.length && editable ? (
        <div role="alert" className="rounded-[2px] bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Guardamos el borrador, pero todavía no se puede enviar a revisión:</p>
          <ul className="list-disc pl-5">{faltan.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}
      {editable ? <FormularioActividad inicial={a} /> : null}
    </main>
  );
}
