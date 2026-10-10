import Link from "next/link";
import { notFound } from "next/navigation";
import { ACTIVITY_ROLE_LABELS, AVISO_PERFIL_EN_PUBLICADA, REVIEW_STATUS_LABELS, canEdit, canEditTexts, type ReviewStatus } from "@repo/muestras";
import { FormularioActividad } from "@/components/formulario/formulario-actividad";
import { FormularioTextos } from "@/components/formulario/formulario-textos";
import { DescargarFichas } from "@/components/panel/descargar-fichas";
import { BotonesPublicada } from "@/components/formulario/botones-publicada";
import { buscarParaEditar } from "@/lib/actividades/consultas";
import { puede } from "@/lib/equipo/permisos";
import { textoDelUltimoCambio } from "@/lib/equipo/registro";
import { requireUsuario } from "@/lib/usuario";

export const dynamic = "force-dynamic";

/** Los faltantes que dejó un "Enviar a revisión" fallido. Sólo se muestran. */
function faltantes(raw: string | string[] | undefined): string[] {
  if (typeof raw !== "string" || !raw) return [];
  return raw.split("|").map((m) => m.trim().slice(0, 300)).filter(Boolean).slice(0, 20);
}

export default async function EditarActividad({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ faltan?: string | string[]; aviso?: string | string[] }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const faltan = faltantes(sp.faltan);
  // Sólo una marca conocida: el texto del aviso nunca sale de la URL.
  const avisoPerfiles = sp.aviso === "perfiles";
  const usuario = await requireUsuario(`/panel/muestras/${id}`);
  const r = await buscarParaEditar(id, usuario);
  if (!r) notFound();
  const { actividad: a, rol } = r;
  const estado = a.reviewStatus as ReviewStatus;
  const actor = { userId: usuario.id, isSuperAdmin: usuario.esSuperAdmin, role: rol };
  // Ficha completa (`editActivity`), sólo textos (`editTexts`, rol de textos) o lectura.
  const editable = canEdit({ ...a, reviewStatus: estado }, actor);
  const soloTextos = !editable && a.type === "MUESTRA" && canEditTexts({ ...a, reviewStatus: estado }, actor);
  const ultimo = await textoDelUltimoCambio(a);
  const enlaces = a.type === "MUESTRA"
    ? [
        puede(usuario, "hanging", rol) ? { href: `/panel/montaje/${a.id}`, texto: "Montaje e impresión" } : null,
        estado === "APPROVED" && puede(usuario, "stats", rol) ? { href: `/panel/estadisticas/${a.id}`, texto: "Estadísticas y libro de visitas" } : null,
        estado === "APPROVED" && puede(usuario, "promote", rol) ? { href: `/panel/difusion/${a.id}`, texto: "Difusión" } : null,
        puede(usuario, "view", rol) ? { href: `/panel/muestras/${a.id}/equipo`, texto: "Equipo" } : null,
      ].filter((x): x is { href: string; texto: string } => x !== null)
    : [];
  return (
    <main className="max-w-3xl space-y-6">
      <Link href="/panel/muestras" className="text-sm text-[var(--mf-accent)] underline underline-offset-4">Volver a mis muestras</Link>
      {rol && rol !== "OWNER" ? <p className="text-sm text-[var(--mf-muted)]">Tu rol: {ACTIVITY_ROLE_LABELS[rol]}</p> : null}
      <h1 className="mf-titulo text-[2.45rem]">{a.title}</h1>
      <p>Estado: <strong>{REVIEW_STATUS_LABELS[estado]}</strong>{a.isCancelled ? ". Cancelada" : ""}</p>
      {ultimo ? <p className="text-sm text-[var(--mf-muted)]">{ultimo}</p> : null}
      {estado === "REJECTED" && a.rejectionReason ? <p className="rounded-[2px] bg-red-50 p-3 text-red-800">Motivo del rechazo: {a.rejectionReason}. Corregí y volvé a enviarla.</p> : null}
      {estado === "APPROVED" ? (
        <>
          <p><Link href={`/m/${a.slug}`} className="underline">Ver publicada</Link>. Los cambios se publican sin volver a revisión.</p>
          {puede(usuario, "cancel", rol) ? <BotonesPublicada id={a.id} cancelada={a.isCancelled} /> : null}
          {a.type === "MUESTRA" && puede(usuario, "pieces", rol) ? (
            <section className="space-y-2 border-t border-[var(--mf-line)] pt-4">
              <h2 className="text-sm text-[var(--mf-muted)]">Fichas de sala con QR</h2>
              <DescargarFichas id={a.id} obras={a.works} />
            </section>
          ) : null}
        </>
      ) : null}
      {enlaces.length ? (
        <p>
          {enlaces.map((e, i) => (
            <span key={e.href}>{i > 0 ? " · " : ""}<Link href={e.href} className="underline">{e.texto}</Link></span>
          ))}
        </p>
      ) : null}
      {!editable && !soloTextos && estado !== "IN_REVIEW" && rol !== "OWNER" ? <p className="text-[var(--mf-muted)]">Tu rol no edita la ficha completa: la ves en modo lectura.</p> : null}
      {estado === "IN_REVIEW" ? <p className="text-[var(--mf-muted)]">Está en revisión. No se puede editar hasta que la revisemos.</p> : null}
      {faltan.length && editable ? (
        <div role="alert" className="rounded-[2px] bg-red-50 p-3 text-sm text-red-800">
          <p className="font-medium">Guardamos el borrador, pero todavía no se puede enviar a revisión:</p>
          <ul className="list-disc pl-5">{faltan.map((m) => <li key={m}>{m}</li>)}</ul>
        </div>
      ) : null}
      {avisoPerfiles ? (
        <p role="status" className="rounded-[2px] bg-amber-50 p-3 text-sm text-amber-900">Guardamos los cambios. {AVISO_PERFIL_EN_PUBLICADA}</p>
      ) : null}
      {/* La clave cambia con cada guardado: el editor vuelve a cargar las obras con sus ids nuevos. */}
      {editable ? <FormularioActividad key={a.updatedAt.toISOString()} inicial={a} /> : null}
      {soloTextos ? (
        <section className="space-y-4 border-t border-[var(--mf-line)] pt-6">
          <p className="text-[15px] text-[var(--mf-muted)]">Tu rol en esta muestra es Textos y curaduría: podés editar el texto curatorial, los créditos y los textos de cada obra.</p>
          {/* La clave son las obras: si cambian, el formulario se vuelve a armar; la versión llega por props al guardar. */}
          <FormularioTextos
            key={a.works.map((w) => w.id).join(",")}
            inicial={{
              id: a.id, editVersion: a.editVersion, curatorialText: a.curatorialText, curatorCredits: a.curatorCredits,
              obras: a.works.map((w) => ({ id: w.id, imageUrl: w.imageUrl, title: w.title, authorName: w.authorName, year: w.year, technique: w.technique })),
            }}
          />
        </section>
      ) : null}
    </main>
  );
}
