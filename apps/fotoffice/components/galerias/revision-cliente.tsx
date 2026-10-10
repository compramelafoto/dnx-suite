"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { finalizarSeleccionGaleriaAction, fotosPorIdsAction, reactivarSeleccionGaleriaAction, responderComentarioGaleriaAction } from "@/app/actions/galerias";
import { ETIQUETA_ESTADO_CLIENTE, MAX_COMENTARIO, type EstadoCliente } from "@/lib/galerias/constantes";
import { fechaHoraBA } from "@/lib/ficha/formato";
import type { ComentarioRevision, FotoRevision } from "@/lib/galerias/revision";

const ERROR_CONEXION = "No pudimos conectar con el servidor. Probá de nuevo.";
const DE_A = 120;

const CLASE_ESTADO: Record<EstadoCliente, string> = {
  EN_PROGRESO: "bg-blue-100 text-blue-800",
  EN_REVISION: "bg-violet-100 text-violet-800",
  FINALIZADO: "bg-green-100 text-green-800",
};

export type DatosRevision = {
  galeriaId: string;
  clienteId: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  estado: EstadoCliente;
  anulado: boolean;
  primeraVez: string | null;
  enviadoEn: string | null;
  finalizadoEn: string | null;
  reactivadoEn: string | null;
  mensaje: string | null;
  fotos: FotoRevision[];
};

type Filtro = "seleccionadas" | "comentarios";

function Conversacion({
  galeriaId, clienteId, foto, puedeResponder, alResponder,
}: {
  galeriaId: string;
  clienteId: string;
  foto: FotoRevision;
  puedeResponder: boolean;
  alResponder: (c: ComentarioRevision) => void;
}) {
  const [texto, setTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await responderComentarioGaleriaAction(galeriaId, clienteId, foto.id, texto).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      alResponder(r.comentario);
      setTexto("");
    });
  }

  return (
    <div className="space-y-3">
      {foto.comentarios.length === 0 ? (
        <p className="text-sm text-[var(--fo-muted)]">Sin comentarios en esta foto.</p>
      ) : (
        <ul className="space-y-2" aria-label="Conversación de la foto">
          {foto.comentarios.map((c) => (
            <li key={c.id} className={`rounded-lg px-3 py-2 text-sm ${c.autor === "ESTUDIO" ? "ml-6 bg-[var(--fo-surface-muted)]" : "mr-6 border border-[var(--fo-border)]"}`}>
              <p className="text-xs text-[var(--fo-muted)]">
                {c.autor === "ESTUDIO" ? `${c.nombreAutor} (estudio)` : c.nombreAutor} · <time dateTime={c.fecha}>{fechaHoraBA(c.fecha)}</time>
              </p>
              <p className="whitespace-pre-wrap break-words text-[var(--fo-text)]">{c.texto}</p>
            </li>
          ))}
        </ul>
      )}
      {puedeResponder ? (
        <form onSubmit={enviar} className="space-y-2">
          <label className="text-xs font-medium text-[var(--fo-muted)]" htmlFor={`responder-${foto.id}`}>
            Responder
          </label>
          <textarea
            id={`responder-${foto.id}`}
            className="fo-input w-full"
            rows={3}
            maxLength={MAX_COMENTARIO}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            disabled={pendiente}
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--fo-muted)]">
              {texto.length.toLocaleString("es-AR")} / {MAX_COMENTARIO.toLocaleString("es-AR")}
            </span>
            <button type="submit" className="fo-btn fo-btn-primary text-sm" disabled={pendiente || texto.trim() === ""}>
              Responder
            </button>
          </div>
          <div aria-live="polite">
            {error ? (
              <p role="alert" className="text-sm text-[var(--fo-danger)]">
                {error}
              </p>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
}

/**
 * Revisión de la selección de un cliente: estado y fechas, las fotos que eligió (o comentó) con filtros, la
 * conversación de cada una con "Responder", y finalizar / reactivar con confirmación. El servidor vuelve a decidir
 * permisos y estados en cada acción.
 */
export function RevisionCliente({ d, puedeGestionar }: { d: DatosRevision; puedeGestionar: boolean }) {
  const router = useRouter();
  const [fotos, setFotos] = useState(d.fotos);
  const [filtro, setFiltro] = useState<Filtro>("seleccionadas");
  const [visibles, setVisibles] = useState(DE_A);
  const [abiertaId, setAbiertaId] = useState<string | null>(null);
  const [grande, setGrande] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const seleccionadas = fotos.filter((f) => f.seleccionada).length;
  const conComentarios = fotos.filter((f) => f.comentarios.length > 0).length;
  const lista = fotos.filter((f) => (filtro === "seleccionadas" ? f.seleccionada : f.comentarios.length > 0));
  const abierta = fotos.find((f) => f.id === abiertaId) ?? null;
  const puedeFinalizar = puedeGestionar && d.estado === "EN_REVISION";
  const puedeReactivar = puedeGestionar && (d.estado === "EN_REVISION" || d.estado === "FINALIZADO") && !d.anulado;

  function abrir(f: FotoRevision) {
    setAbiertaId(f.id);
    if (grande[f.id] === undefined) {
      setGrande((g) => ({ ...g, [f.id]: null }));
      fotosPorIdsAction(d.galeriaId, [f.id])
        .then((r) => setGrande((g) => ({ ...g, [f.id]: (r.ok ? r.fotos[0]?.viewUrl : null) ?? f.thumbUrl })))
        .catch(() => setGrande((g) => ({ ...g, [f.id]: f.thumbUrl })));
    }
  }

  function cambiarFiltro(f: Filtro) {
    setFiltro(f);
    setVisibles(DE_A);
  }

  function transicion(tipo: "finalizar" | "reactivar") {
    const texto =
      tipo === "finalizar"
        ? `¿Finalizar la selección de ${d.nombre}? Queda cerrada: el cliente ya no puede cambiarla.`
        : `¿Devolverle la selección a ${d.nombre}? Va a poder seguir eligiendo y comentando. Conserva lo que ya eligió. No le mandamos ningún correo: si querés avisarle, reenviale el enlace desde la pestaña Clientes.`;
    if (!window.confirm(texto)) return;
    setError(null);
    setAviso(null);
    iniciar(async () => {
      const accion = tipo === "finalizar" ? finalizarSeleccionGaleriaAction : reactivarSeleccionGaleriaAction;
      const r = await accion(d.galeriaId, d.clienteId).catch(() => ({ ok: false as const, error: ERROR_CONEXION }));
      if (!r.ok) return setError(r.error);
      setAviso(tipo === "finalizar" ? "Listo: la selección quedó finalizada." : "Listo: el cliente puede seguir eligiendo.");
      router.refresh();
    });
  }

  function agregarRespuesta(c: ComentarioRevision) {
    setFotos((fs) => fs.map((f) => (f.id === c.fotoId ? { ...f, comentarios: [...f.comentarios, c] } : f)));
  }

  return (
    <div className="space-y-4">
      <section aria-labelledby="estado-cliente-titulo" className="fo-card space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="estado-cliente-titulo" className="text-lg font-semibold text-[var(--fo-text)]">
              {d.nombre}
            </h2>
            <p className="break-all text-xs text-[var(--fo-muted)]">{[d.email, d.telefono].filter(Boolean).join(" · ") || "Sin correo ni teléfono"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {d.anulado ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Enlace anulado</span> : null}
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CLASE_ESTADO[d.estado]}`}>{ETIQUETA_ESTADO_CLIENTE[d.estado]}</span>
          </div>
        </div>
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-[var(--fo-muted)]">Entró por primera vez</dt>
            <dd>{d.primeraVez ? fechaHoraBA(d.primeraVez) : "Todavía no entró"}</dd>
          </div>
          <div>
            <dt className="text-xs text-[var(--fo-muted)]">Envió su selección</dt>
            <dd>{d.enviadoEn ? fechaHoraBA(d.enviadoEn) : "Todavía no la envió"}</dd>
          </div>
          {d.finalizadoEn ? (
            <div>
              <dt className="text-xs text-[var(--fo-muted)]">Finalizada</dt>
              <dd>{fechaHoraBA(d.finalizadoEn)}</dd>
            </div>
          ) : null}
          {d.reactivadoEn ? (
            <div>
              <dt className="text-xs text-[var(--fo-muted)]">Devuelta al cliente</dt>
              <dd>{fechaHoraBA(d.reactivadoEn)}</dd>
            </div>
          ) : null}
        </dl>
        {d.mensaje ? (
          <blockquote className="whitespace-pre-wrap break-words rounded-lg bg-[var(--fo-surface-muted)] px-3 py-2 text-sm">
            <span className="block text-xs text-[var(--fo-muted)]">Mensaje que dejó al enviar</span>
            {d.mensaje}
          </blockquote>
        ) : null}
        {puedeFinalizar || puedeReactivar ? (
          <div className="flex flex-wrap gap-2 pt-1">
            {puedeFinalizar ? (
              <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={pendiente} onClick={() => transicion("finalizar")}>
                Finalizar selección
              </button>
            ) : null}
            {puedeReactivar ? (
              <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={pendiente} onClick={() => transicion("reactivar")}>
                Reactivar para que siga eligiendo
              </button>
            ) : null}
          </div>
        ) : null}
        {d.anulado && (d.estado === "EN_REVISION" || d.estado === "FINALIZADO") ? (
          <p className="text-xs text-[var(--fo-muted)]">Para reactivarla primero habilitá su enlace con uno nuevo desde la pestaña Clientes.</p>
        ) : null}
        <div aria-live="polite">
          {error ? (
            <p role="alert" className="text-sm text-[var(--fo-danger)]">
              {error}
            </p>
          ) : aviso ? (
            <p role="status" className="text-sm text-[var(--fo-muted)]">
              {aviso}
            </p>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="fotos-cliente-titulo" className="fo-card space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="fotos-cliente-titulo" className="text-sm font-semibold uppercase tracking-wide text-[var(--fo-muted-soft)]">
            Fotos
          </h2>
          <div role="group" aria-label="Filtro de fotos" className="flex gap-1">
            <button type="button" aria-pressed={filtro === "seleccionadas"} className={`fo-btn text-xs ${filtro === "seleccionadas" ? "fo-btn-primary" : "fo-btn-secondary"}`} onClick={() => cambiarFiltro("seleccionadas")}>
              Seleccionadas ({seleccionadas.toLocaleString("es-AR")})
            </button>
            <button type="button" aria-pressed={filtro === "comentarios"} className={`fo-btn text-xs ${filtro === "comentarios" ? "fo-btn-primary" : "fo-btn-secondary"}`} onClick={() => cambiarFiltro("comentarios")}>
              Con comentarios ({conComentarios.toLocaleString("es-AR")})
            </button>
          </div>
        </div>

        {lista.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">{filtro === "seleccionadas" ? "Este cliente todavía no eligió fotos." : "Ninguna foto tiene comentarios."}</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="min-w-0 space-y-3">
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {lista.slice(0, visibles).map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => abrir(f)}
                      aria-pressed={abiertaId === f.id}
                      className={`block w-full overflow-hidden rounded-lg border text-left ${abiertaId === f.id ? "border-[var(--fo-accent,#1d4ed8)] ring-2 ring-[var(--fo-accent,#1d4ed8)]" : "border-[var(--fo-border)]"}`}
                    >
                      <span className="block aspect-[4/3] bg-[var(--fo-surface-muted)]">
                        {f.thumbUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={f.thumbUrl} alt={f.fileName} loading="lazy" className="h-full w-full object-cover" />
                        ) : null}
                      </span>
                      <span className="flex items-center justify-between gap-1 px-2 py-1 text-xs">
                        <span className="min-w-0 truncate">{f.fileName}</span>
                        {f.comentarios.length > 0 ? (
                          <span className="shrink-0 rounded-full bg-amber-100 px-1.5 text-amber-800" aria-label={`${f.comentarios.length} comentarios`}>
                            {f.comentarios.length}
                          </span>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {lista.length > visibles ? (
                <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={() => setVisibles((v) => v + DE_A)}>
                  Mostrar más ({(lista.length - visibles).toLocaleString("es-AR")} restantes)
                </button>
              ) : null}
            </div>

            <div className="min-w-0 space-y-3 self-start lg:sticky lg:top-4">
              {abierta ? (
                <>
                  <p className="break-all text-sm font-medium">
                    {abierta.fileName}
                    {!abierta.seleccionada ? <span className="ml-2 text-xs font-normal text-[var(--fo-muted)]">(la desmarcó, pero la comentó)</span> : null}
                  </p>
                  {grande[abierta.id] || abierta.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={grande[abierta.id] ?? abierta.thumbUrl ?? undefined} alt={abierta.fileName} className="max-h-[60vh] w-full rounded-lg object-contain" />
                  ) : null}
                  <Conversacion key={abierta.id} galeriaId={d.galeriaId} clienteId={d.clienteId} foto={abierta} puedeResponder={puedeGestionar} alResponder={agregarRespuesta} />
                </>
              ) : (
                <p className="text-sm text-[var(--fo-muted)]">Tocá una foto para verla en grande y leer su conversación.</p>
              )}
            </div>
          </div>
        )}
        <p className="text-xs text-[var(--fo-muted)]">
          <Link href={`/galerias/${encodeURIComponent(d.galeriaId)}?tab=clientes`} className="hover:underline">
            Volver a los clientes de la galería
          </Link>
        </p>
      </section>
    </div>
  );
}
