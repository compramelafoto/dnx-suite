"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  idsMarcadosDeEntrada,
  type DisenoAnteCambio,
  type ResultadoDeCambio,
  type ResumenDeCambio,
} from "@/lib/design-v2/cambio-de-plantilla-tipos";
import { designStatusLabel } from "@/lib/design-v2/labels";

/**
 * «¿A qué diseños aplico el cambio?»: después de cambiar una plantilla con diseños armados, el
 * fotógrafo elige cuáles pasan a la versión nueva.
 *
 * - Para revisar: marcados de entrada.
 * - Aprobados sin imprimir: sin marcar; si se marcan, vuelven a revisión.
 * - En imprenta, impresos o entregados, editados a mano y los que perderían una foto: se muestran
 *   para que se sepa que existen, sin casilla.
 */
export default function CambioDePlantillaDialog({
  templateId,
  resumen,
  onClose,
  onApplied,
}: {
  templateId: string;
  resumen: ResumenDeCambio;
  onClose: () => void;
  onApplied: (r: ResultadoDeCambio) => void;
}) {
  const [marcados, setMarcados] = useState<Set<number>>(() => new Set(idsMarcadosDeEntrada(resumen.disenos)));
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoDeCambio | null>(null);

  const grupos = useMemo(() => {
    const por = (c: DisenoAnteCambio["categoria"]) => resumen.disenos.filter((d) => d.categoria === c);
    return {
      pendientes: por("pendiente"),
      aprobados: por("aprobado"),
      produccion: por("produccion"),
      aMano: por("editado-a-mano"),
      revisar: por("revision-manual"),
    };
  }, [resumen]);

  const aprobadosMarcados = grupos.aprobados.filter((d) => marcados.has(d.id)).length;

  function alternar(id: number) {
    setMarcados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function alternarGrupo(ds: DisenoAnteCambio[], valor: boolean) {
    setMarcados((prev) => {
      const next = new Set(prev);
      for (const d of ds) {
        if (valor) next.add(d.id);
        else next.delete(d.id);
      }
      return next;
    });
  }

  async function aplicar() {
    if (marcados.size === 0) return;
    if (
      aprobadosMarcados > 0 &&
      !window.confirm(
        aprobadosMarcados === 1
          ? "Hay 1 diseño aprobado marcado: va a volver a revisión y vas a tener que aprobarlo de nuevo. ¿Seguimos?"
          : `Hay ${aprobadosMarcados} diseños aprobados marcados: van a volver a revisión y vas a tener que aprobarlos de nuevo. ¿Seguimos?`,
      )
    ) {
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`/api/fotografo/diseno/plantillas/${encodeURIComponent(templateId)}/cambio-de-plantilla`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...marcados] }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) throw new Error(body.error || "No se pudo aplicar el cambio.");
      setResultado(body as ResultadoDeCambio);
      onApplied(body as ResultadoDeCambio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo aplicar el cambio.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cambio-plantilla-titulo"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="border-b border-[#e5e7eb] px-5 py-4">
          <h2 id="cambio-plantilla-titulo" className="text-lg font-bold text-[#111827]">
            ¿A qué diseños aplico el cambio?
          </h2>
          <p className="mt-1 text-sm text-[#6b7280]">
            Cambiaste «{resumen.template.name}» (ahora va por la versión {resumen.template.versionNumber}). Estos diseños
            se armaron con una versión anterior y siguen saliendo exactamente como estaban hasta que los pases. Al pasarlos
            se conservan las fotos, los encuadres y los textos de cada uno.
          </p>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {resultado ? (
            <Resultado resultado={resultado} />
          ) : (
            <>
              <Grupo
                titulo="Para revisar"
                detalle="Todavía no los aprobaste: conviene pasarlos."
                disenos={grupos.pendientes}
                marcados={marcados}
                onToggle={alternar}
                onToggleAll={(v) => alternarGrupo(grupos.pendientes, v)}
              />
              <Grupo
                titulo="Aprobados, sin mandar a imprimir"
                detalle="Si los pasás, vuelven a revisión: se borra la aprobación y el archivo generado, y los tenés que aprobar de nuevo."
                disenos={grupos.aprobados}
                marcados={marcados}
                onToggle={alternar}
                onToggleAll={(v) => alternarGrupo(grupos.aprobados, v)}
              />
              <GrupoSinCasilla
                titulo="Ya en imprenta, impresos o entregados"
                detalle="No se tocan: salen como se mandaron."
                disenos={grupos.produccion}
              />
              <GrupoSinCasilla
                titulo="Editados a mano"
                detalle="Tienen su propio armado: los cambios de la plantilla no les llegan."
                disenos={grupos.aMano}
              />
              <GrupoSinCasilla
                titulo="Necesitan revisión manual"
                detalle="Pasarlos solos perdería una foto que eligió la familia. Abrilos y corregilos desde la revisión."
                disenos={grupos.revisar}
                conMotivo
              />
            </>
          )}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[#e5e7eb] px-5 py-3">
          {resultado ? (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a8662f]"
            >
              Listo
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                disabled={enviando}
                className="rounded-lg border border-[#d1d5db] px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#f9fafb]"
              >
                Ahora no
              </button>
              <button
                type="button"
                onClick={() => void aplicar()}
                disabled={enviando || marcados.size === 0}
                className="rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a8662f] disabled:opacity-50"
              >
                {enviando
                  ? "Aplicando…"
                  : marcados.size === 1
                    ? "Aplicar el cambio a 1 diseño"
                    : `Aplicar el cambio a ${marcados.size} diseños`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Fila({ d, conMotivo }: { d: DisenoAnteCambio; conMotivo?: boolean }) {
  return (
    <span className="min-w-0 flex-1">
      <Link href={`/fotografo/disenos/${d.id}`} target="_blank" className="font-medium text-[#111827] hover:underline">
        {d.quien}
      </Link>
      <span className="ml-2 text-xs text-[#6b7280]">
        {designStatusLabel(d.status)}
        {d.versionNumber != null ? ` · versión ${d.versionNumber}` : ""}
        {d.huecosNuevos > 0
          ? ` · ${d.huecosNuevos === 1 ? "1 hueco nuevo queda" : `${d.huecosNuevos} huecos nuevos quedan`} sin foto`
          : ""}
      </span>
      {conMotivo && d.motivo ? <span className="block text-xs text-amber-800">{d.motivo}</span> : null}
    </span>
  );
}

function Grupo({
  titulo,
  detalle,
  disenos,
  marcados,
  onToggle,
  onToggleAll,
}: {
  titulo: string;
  detalle: string;
  disenos: DisenoAnteCambio[];
  marcados: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (valor: boolean) => void;
}) {
  if (disenos.length === 0) return null;
  const todos = disenos.every((d) => marcados.has(d.id));
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#111827]">
          {titulo} <span className="font-normal text-[#6b7280]">({disenos.length})</span>
        </h3>
        <button type="button" onClick={() => onToggleAll(!todos)} className="text-xs text-[#c27b3d] underline">
          {todos ? "Desmarcar todos" : "Marcar todos"}
        </button>
      </div>
      <p className="text-xs text-[#6b7280]">{detalle}</p>
      <ul className="mt-2 space-y-1">
        {disenos.map((d) => (
          <li key={d.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={marcados.has(d.id)}
              onChange={() => onToggle(d.id)}
              aria-label={`Pasar el diseño de ${d.quien}`}
            />
            <Fila d={d} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function GrupoSinCasilla({
  titulo,
  detalle,
  disenos,
  conMotivo,
}: {
  titulo: string;
  detalle: string;
  disenos: DisenoAnteCambio[];
  conMotivo?: boolean;
}) {
  if (disenos.length === 0) return null;
  return (
    <section>
      <h3 className="text-sm font-semibold text-[#111827]">
        {titulo} <span className="font-normal text-[#6b7280]">({disenos.length})</span>
      </h3>
      <p className="text-xs text-[#6b7280]">{detalle}</p>
      <ul className="mt-2 space-y-1">
        {disenos.map((d) => (
          <li key={d.id} className="flex items-start gap-2 pl-5 text-sm">
            <Fila d={d} conMotivo={conMotivo} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Resultado({ resultado }: { resultado: ResultadoDeCambio }) {
  const n = resultado.pasados.length;
  return (
    <div className="space-y-2 text-sm text-[#111827]">
      <p className="font-semibold">
        {n === 0 ? "No se pasó ningún diseño." : n === 1 ? "Listo: 1 diseño pasó a la versión nueva." : `Listo: ${n} diseños pasaron a la versión nueva.`}
      </p>
      {resultado.volvieronARevision.length > 0 ? (
        <p>
          {resultado.volvieronARevision.length === 1
            ? "1 estaba aprobado y volvió a revisión."
            : `${resultado.volvieronARevision.length} estaban aprobados y volvieron a revisión.`}
        </p>
      ) : null}
      {resultado.autorizacionesAnuladas.length > 0 ? (
        <p>
          {resultado.autorizacionesAnuladas.length === 1
            ? "1 familia ya lo había autorizado: esa autorización quedó sin efecto y hay que volver a revisarlo."
            : `${resultado.autorizacionesAnuladas.length} familias ya los habían autorizado: esas autorizaciones quedaron sin efecto y hay que volver a revisarlos.`}
        </p>
      ) : null}
      {resultado.omitidos.length > 0 ? (
        <div>
          <p>No se pasaron:</p>
          <ul className="ml-4 list-disc text-[#6b7280]">
            {resultado.omitidos.map((o) => (
              <li key={o.id}>
                <Link href={`/fotografo/disenos/${o.id}`} target="_blank" className="underline">
                  Diseño #{o.id}
                </Link>
                : {o.motivo}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
