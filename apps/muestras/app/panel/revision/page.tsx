import Link from "next/link";
import { ACTIVITY_TYPE_LABELS, REVIEW_STATUS_LABELS, formatArDay, type ActivityType, type ReviewStatus } from "@repo/muestras";
import { AccionesRevision } from "@/components/admin/acciones-revision";
import { listarParaRevisar } from "@/lib/actividades/consultas";
import { esUrlWeb } from "@/lib/url";
import { requireSuperAdmin } from "@/lib/usuario";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revisión", robots: { index: false } };

type Fila = Awaited<ReturnType<typeof listarParaRevisar>>[number];

function Tarjeta({ f }: { f: Fila }) {
  return (
    <li className="grid gap-3 rounded-[2px] border border-[var(--mf-line)] bg-white p-4 sm:grid-cols-[1fr_18rem]">
      <div className="space-y-1">
        <p className="text-sm text-[var(--mf-muted)]">{REVIEW_STATUS_LABELS[f.reviewStatus as ReviewStatus] ?? f.reviewStatus}, {ACTIVITY_TYPE_LABELS[f.type as ActivityType] ?? f.type}</p>
        <h2 className="text-lg font-medium">{f.title}</h2>
        <p className="text-sm">Del {formatArDay(f.startsAt)} al {formatArDay(f.endsAt)}. {f.isVirtualOnly ? "Virtual" : [f.address, f.city, f.province].filter(Boolean).join(", ")}</p>
        <p className="text-sm">Organiza: {f.organizersText}</p>
        <p className="line-clamp-3 text-sm text-[var(--mf-muted)]">{f.description}</p>
        <div className="flex gap-1">
          {f.works.filter((w) => esUrlWeb(w.imageUrl)).map((w) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={w.id} src={w.imageUrl} alt="" className="h-14 w-14 object-cover" />
          ))}
        </div>
        <Link href={`/panel/muestras/${f.id}`} className="text-sm underline">Ver o corregir la ficha completa</Link>
      </div>
      <AccionesRevision id={f.id} estado={f.reviewStatus} />
    </li>
  );
}

export default async function Admin() {
  await requireSuperAdmin();
  const filas = await listarParaRevisar();
  const pendientes = filas.filter((f) => f.reviewStatus === "IN_REVIEW");
  const resto = filas.filter((f) => f.reviewStatus !== "IN_REVIEW");
  return (
    <main className="max-w-5xl space-y-8">
      <h1 className="mf-titulo text-[2.45rem]">Revisión</h1>
      <section className="space-y-3">
        <h2 className="text-xl">Para revisar ({pendientes.length})</h2>
        {pendientes.length ? <ul className="space-y-3">{pendientes.map((f) => <Tarjeta key={f.id} f={f} />)}</ul> : <p>No hay propuestas pendientes.</p>}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl">Publicadas y despublicadas</h2>
        <ul className="space-y-3">{resto.map((f) => <Tarjeta key={f.id} f={f} />)}</ul>
      </section>
    </main>
  );
}
