import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEventos } from "@/lib/eventos/contexto";
import { ESTADO_PAGO_LABEL } from "@/lib/eventos/constants";
import { coincide, resumir } from "@/lib/eventos/reglas";
import { listarInscriptos, obtenerEvento, sincronizarInscriptos } from "@/lib/eventos/servidor";
import { acreditarAction } from "../../actions";

export const dynamic = "force-dynamic";

/**
 * La puerta: pensada para el celular de quien recibe. Se busca por nombre, DNI, teléfono o código
 * y se acredita con un toque. Muestra el estado de pago bien grande, porque es lo que se mira.
 */
export default async function PuertaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { workspace } = await requireEventos("MANAGE");
  const { id } = await params;
  const { q = "" } = await searchParams;
  await sincronizarInscriptos(workspace.id);
  const evento = await obtenerEvento(workspace.id, id);
  if (!evento) notFound();
  const todos = await listarInscriptos(workspace.id, id);
  const r = resumir(todos);
  const resultados = q.trim() ? todos.filter((i) => i.estadoPago !== "ANULADO" && coincide(i, q)).slice(0, 30) : [];
  const volver = `/eventos/${id}/puerta?q=${encodeURIComponent(q)}`;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--fo-muted)]">Acreditación</p>
          <h1 className="text-xl font-semibold">{evento.nombre}</h1>
        </div>
        <Link href={`/eventos/${id}`} className="fo-btn fo-btn-ghost">
          Listado
        </Link>
      </div>

      <p className="text-sm">
        <strong>{r.acreditados}</strong> de <strong>{r.total}</strong> acreditados
      </p>

      <form method="get" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Nombre, DNI, teléfono o código"
          className="fo-input min-w-0 flex-1 text-lg"
          autoComplete="off"
        />
        <button className="fo-btn fo-btn-primary">Buscar</button>
      </form>

      {q.trim() && resultados.length === 0 ? (
        <div className="fo-card p-5 text-center">
          <p className="font-medium">No está en el listado.</p>
          <p className="text-sm text-[var(--fo-muted)]">Probá con otro dato o cargalo a mano desde el listado.</p>
        </div>
      ) : null}

      <ul className="space-y-3">
        {resultados.map((i) => {
          const pagado = i.estadoPago === "PAGADO" || i.estadoPago === "CORTESIA";
          return (
            <li key={i.id} className={`fo-card space-y-3 p-4 ${i.acreditadoAt ? "opacity-70" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-lg font-semibold">{i.nombre}</p>
                  <p className="text-sm text-[var(--fo-muted)]">
                    {[i.tipo, i.dni ? `DNI ${i.dni}` : null, i.telefono, i.codigo].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${
                    pagado ? "bg-emerald-600 text-white" : "bg-amber-500 text-black"
                  }`}
                >
                  {ESTADO_PAGO_LABEL[i.estadoPago as keyof typeof ESTADO_PAGO_LABEL] ?? i.estadoPago}
                </span>
              </div>
              <form action={acreditarAction}>
                <input type="hidden" name="eventoId" value={id} />
                <input type="hidden" name="inscriptoId" value={i.id} />
                <input type="hidden" name="volver" value={volver} />
                <input type="hidden" name="si" value={i.acreditadoAt ? "0" : "1"} />
                <button className={`fo-btn w-full py-3 text-base ${i.acreditadoAt ? "fo-btn-ghost" : "fo-btn-primary"}`}>
                  {i.acreditadoAt ? "Ya acreditado · deshacer" : "Acreditar"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
