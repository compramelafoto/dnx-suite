"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import type { AlbumVoucherRow } from "@/lib/canje-externo/album-vouchers";
import { copyPendingText } from "@/lib/clipboard/copy-pending-text";

/**
 * Panel "Canjes": los combos que la fotógrafa cobró por fuera, con el estado de cada familia
 * y el botón para mandarle su link por WhatsApp. Reemplaza al PDF con los links: los datos
 * quedan dentro de la plataforma, detrás de la sesión de la fotógrafa.
 */

const FECHA = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

function telefonoVisible(phone: string | null): string {
  if (!phone) return "Sin teléfono";
  const d = phone.replace(/\D/g, "");
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)}-${d.slice(6)}` : phone;
}

const ESTADO: Record<AlbumVoucherRow["estado"], { texto: string; clase: string }> = {
  sin_canjear: { texto: "Sin canjear", clase: "bg-[#f1ede8] text-[#5b5148]" },
  esperando_pago: { texto: "Eligió fotos extra, falta que pague", clase: "bg-[#fff4e5] text-[#7a4a12]" },
  canjeado: { texto: "Canjeado", clase: "bg-[#e6f4ec] text-[#1f6b45]" },
};

export default function AlbumCanjesPanel({ albumId }: { albumId: number }) {
  const [combos, setCombos] = useState<AlbumVoucherRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<number | null>(null);
  const [enviados, setEnviados] = useState<Set<number>>(new Set());
  const [copiado, setCopiado] = useState<{ id: number; que: "link" | "mensaje" } | null>(null);
  /** El navegador no dejó copiar: el texto queda a la vista para copiarlo a mano. */
  const [aMano, setAMano] = useState<{ id: number; texto: string } | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [curso, setCurso] = useState("");

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/albums/${albumId}/canjes`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos cargar los canjes.");
      setCombos(Array.isArray(data.combos) ? data.combos : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos cargar los canjes.");
    }
  }, [albumId]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const pedirLink = useCallback(
    async (comboId: number) => {
      const res = await fetch(`/api/dashboard/albums/${albumId}/canjes/${comboId}/link`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "No pudimos generar el link.");
      return data as { link: string; message: string; whatsappUrl: string | null };
    },
    [albumId]
  );

  async function enviarWhatsApp(comboId: number) {
    setError(null);
    setEnviando(comboId);
    // La pestaña se abre antes de esperar al servidor: si se abre después, el celular la
    // toma como ventana emergente y la bloquea.
    const ventana = window.open("about:blank", "_blank");
    try {
      const share = await pedirLink(comboId);
      if (!share.whatsappUrl) {
        ventana?.close();
        throw new Error("Esta familia no tiene un teléfono válido. Copiá el link y mandáselo por otro medio.");
      }
      if (ventana) ventana.location.href = share.whatsappUrl;
      else window.location.href = share.whatsappUrl;
      setEnviados((prev) => new Set(prev).add(comboId));
    } catch (e) {
      ventana?.close();
      setError(e instanceof Error ? e.message : "No pudimos abrir WhatsApp.");
    } finally {
      setEnviando(null);
    }
  }

  // Sin `await` antes de copiar: el permiso del toque se pierde mientras se espera el link
  // (ver `copy-pending-text`).
  async function copiar(comboId: number, que: "link" | "mensaje") {
    setError(null);
    setAMano(null);
    try {
      const { text, copied } = await copyPendingText(
        pedirLink(comboId).then((share) => (que === "link" ? share.link : share.message))
      );
      setEnviados((prev) => new Set(prev).add(comboId));
      if (!copied) {
        setAMano({ id: comboId, texto: text });
        return;
      }
      setCopiado({ id: comboId, que });
      setTimeout(() => setCopiado((c) => (c?.id === comboId && c.que === que ? null : c)), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos generar el link. Probá de nuevo.");
    }
  }

  const cursos = useMemo(
    () => [...new Set((combos ?? []).map((c) => c.courseName).filter((x): x is string => Boolean(x)))],
    [combos]
  );

  const visibles = useMemo(() => {
    if (!combos) return null;
    const q = busqueda
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase();
    return combos.filter((c) => {
      if (curso && c.courseName !== curso) return false;
      if (!q) return true;
      return [c.studentName, c.parentName, c.courseName]
        .filter(Boolean)
        .join(" ")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(q);
    });
  }, [combos, busqueda, curso]);

  const resumen = useMemo(() => {
    if (!combos) return null;
    const canjeados = combos.filter((c) => c.estado === "canjeado").length;
    return { total: combos.length, canjeados, pendientes: combos.length - canjeados };
  }, [combos]);

  return (
    <div className="ds-stack-section w-full min-w-0 gap-5">
      <Card className="ds-fill-width w-full min-w-0 border border-[#e5e7eb] p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">Compras cobradas por fuera</h3>
          <p className="ds-readable-text ds-readable-text--fluid m-0 text-sm text-[#6b7280]">
            Cada familia tiene su propio link para elegir las fotos de lo que ya pagó. Tocá{" "}
            <strong>Copiar mensaje</strong> (o <strong>Copiar link</strong>) y pegalo en el chat de esa familia; si
            tiene teléfono cargado, <strong>Enviar por WhatsApp</strong> abre el chat directo. Cada link sirve para
            un solo canje; si lo copiás de nuevo, el anterior sigue funcionando.
          </p>
          {resumen && resumen.total > 0 ? (
            <p className="m-0 pt-2 text-sm font-medium text-[#1a1a1a]">
              {resumen.total} combos · {resumen.canjeados} canjeados · {resumen.pendientes} sin canjear
            </p>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="m-0 mt-4 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-[#9b1c1c]">
            {error}
          </p>
        ) : null}

        {combos == null && !error ? <p className="m-0 mt-4 text-sm text-[#6b7280]">Cargando…</p> : null}

        {combos && combos.length === 0 ? (
          <p className="m-0 mt-4 text-sm text-[#6b7280]">
            Este álbum no tiene combos cobrados por fuera. Si cobraste combos en mano o por transferencia,
            escribinos con la lista de familias y los cargamos.
          </p>
        ) : null}

        {combos && combos.length > 8 ? (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar alumno o familia"
              aria-label="Buscar alumno o familia"
              className="min-h-10 flex-1 rounded-lg border border-[#d8d0c7] px-3 text-sm focus:border-[#c27b3d] focus:outline-none"
            />
            {cursos.length > 1 ? (
              <select
                value={curso}
                onChange={(e) => setCurso(e.target.value)}
                aria-label="Filtrar por curso"
                className="min-h-10 rounded-lg border border-[#d8d0c7] bg-white px-3 text-sm"
              >
                <option value="">Todos los cursos</option>
                {cursos.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}

        {visibles && visibles.length > 0 ? (
          <ul className="m-0 mt-4 list-none divide-y divide-[#eee9e3] p-0">
            {visibles.map((c) => {
              const estado = ESTADO[c.estado];
              const yaEnviado = enviados.has(c.comboId);
              return (
                <li key={c.comboId} className="flex flex-col gap-2 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="m-0 font-medium text-[#1a1a1a]">
                      {c.studentName ?? "Sin nombre"}
                      {c.courseName ? <span className="font-normal text-[#6b7280]"> · {c.courseName}</span> : null}
                    </p>
                    <p className="m-0 text-sm text-[#6b7280]">
                      {c.parentName ?? "—"}
                      {c.phone ? ` · ${telefonoVisible(c.phone)}` : ""}
                    </p>
                    <p className="m-0 text-sm text-[#3d4148]">{c.comboLabel}</p>
                    <p className="m-0 mt-1 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`rounded-full px-2 py-0.5 font-medium ${estado.clase}`}>{estado.texto}</span>
                      {c.pedido ? (
                        <span className="text-[#6b7280]">
                          Pedido #{c.pedido.id} · {FECHA.format(new Date(c.pedido.createdAt))}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  {c.estado === "canjeado" ? null : (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {c.phone ? (
                        <button
                          type="button"
                          disabled={enviando === c.comboId}
                          onClick={() => void enviarWhatsApp(c.comboId)}
                          className={`min-h-10 rounded-lg px-3 text-sm font-semibold text-white disabled:opacity-60 ${
                            yaEnviado ? "bg-[#7aa88c]" : "bg-[#1f8f4e] hover:bg-[#1a7a43]"
                          }`}
                        >
                          {enviando === c.comboId ? "Abriendo…" : yaEnviado ? "Enviado · reenviar" : "Enviar por WhatsApp"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void copiar(c.comboId, "mensaje")}
                        className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${
                          c.phone
                            ? "border border-[#d8d0c7] font-medium text-[#3d4148] hover:bg-[#f6f3ef]"
                            : yaEnviado
                              ? "bg-[#7aa88c] text-white"
                              : "bg-[#1f8f4e] text-white hover:bg-[#1a7a43]"
                        }`}
                      >
                        {copiado?.id === c.comboId && copiado.que === "mensaje"
                          ? "Copiado"
                          : !c.phone && yaEnviado
                            ? "Copiado antes · copiar otra vez"
                            : "Copiar mensaje"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void copiar(c.comboId, "link")}
                        className="min-h-10 rounded-lg border border-[#d8d0c7] px-3 text-sm font-medium text-[#3d4148] hover:bg-[#f6f3ef]"
                      >
                        {copiado?.id === c.comboId && copiado.que === "link" ? "Link copiado" : "Copiar link"}
                      </button>
                    </div>
                  )}
                  {aMano?.id === c.comboId ? (
                    <div className="w-full basis-full rounded-lg bg-[#fff4e5] p-3 text-sm text-[#7a4a12]">
                      <p className="m-0 font-medium">
                        Este navegador no dejó copiar solo. Está seleccionado: copialo (mantené apretado o Cmd/Ctrl+C)
                        y pegalo en el chat.
                      </p>
                      <textarea
                        readOnly
                        value={aMano.texto}
                        rows={aMano.texto.length > 120 ? 5 : 2}
                        autoFocus
                        onFocus={(e) => e.currentTarget.select()}
                        className="mt-2 w-full rounded-md border border-[#e8c99a] bg-white p-2 text-[13px] text-[#1f2328]"
                        aria-label="Texto para copiar"
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : null}

        {visibles && visibles.length === 0 && combos && combos.length > 0 ? (
          <p className="m-0 mt-4 text-sm text-[#6b7280]">Ninguna familia coincide con la búsqueda.</p>
        ) : null}

        {combos && combos.length > 0 ? (
          <button
            type="button"
            onClick={() => void cargar()}
            className="mt-3 text-sm font-medium text-[#a8652e] underline"
          >
            Actualizar estados
          </button>
        ) : null}
      </Card>
    </div>
  );
}
