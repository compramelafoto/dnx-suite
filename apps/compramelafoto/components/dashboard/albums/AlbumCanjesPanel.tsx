"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import type { AlbumVoucherRow } from "@/lib/canje-externo/album-vouchers";

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
  const [copiado, setCopiado] = useState<number | null>(null);

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

  async function copiarMensaje(comboId: number) {
    setError(null);
    try {
      const share = await pedirLink(comboId);
      await navigator.clipboard.writeText(share.message);
      setCopiado(comboId);
      setTimeout(() => setCopiado((c) => (c === comboId ? null : c)), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos copiar el mensaje.");
    }
  }

  const resumen = useMemo(() => {
    if (!combos) return null;
    const canjeados = combos.filter((c) => c.estado === "canjeado").length;
    return { total: combos.length, canjeados, pendientes: combos.length - canjeados };
  }, [combos]);

  return (
    <div className="ds-stack-section w-full min-w-0 gap-5">
      <Card className="ds-fill-width w-full min-w-0 border border-[#e5e7eb] p-4 sm:p-5">
        <div className="space-y-1">
          <h3 className="m-0 text-base font-semibold text-[#1a1a1a]">Combos cobrados por fuera</h3>
          <p className="ds-readable-text ds-readable-text--fluid m-0 text-sm text-[#6b7280]">
            Cada familia tiene su propio link para elegir las fotos del combo sin pagar. Tocá{" "}
            <strong>Enviar por WhatsApp</strong>: se abre el chat con ese número y el mensaje listo. Cada link sirve
            para un solo canje y vence a los 60 días; si lo mandás de nuevo, el anterior sigue funcionando.
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

        {combos && combos.length > 0 ? (
          <ul className="m-0 mt-4 list-none divide-y divide-[#eee9e3] p-0">
            {combos.map((c) => {
              const estado = ESTADO[c.estado];
              const yaEnviado = enviados.has(c.comboId);
              return (
                <li key={c.comboId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="m-0 font-medium text-[#1a1a1a]">{c.studentName ?? "Sin nombre"}</p>
                    <p className="m-0 text-sm text-[#6b7280]">
                      {c.parentName ?? "—"} · {telefonoVisible(c.phone)}
                    </p>
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
                      <button
                        type="button"
                        onClick={() => void copiarMensaje(c.comboId)}
                        className="min-h-10 rounded-lg border border-[#d8d0c7] px-3 text-sm font-medium text-[#3d4148] hover:bg-[#f6f3ef]"
                      >
                        {copiado === c.comboId ? "Copiado" : "Copiar mensaje"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
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
