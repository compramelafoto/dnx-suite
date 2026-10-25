"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { firmarAction, rechazarAction, solicitarCodigoAction, verificarCodigoAction } from "./actions";
import { FirmaCanvas } from "./firma-canvas";

type Paso = "inicio" | "codigo" | "firma" | "rechazo";

/**
 * El recorrido del firmante: 1) nombre y "leí y acepto" → 2) código por correo → 3) firma dibujada.
 * "No estoy de acuerdo" pide un motivo. Cada paso lo vuelve a validar el servidor; esto sólo guía.
 */
export function FirmaFlujo({
  slug,
  token,
  nombreInicial,
  clausula,
  leyenda,
  verificado,
}: {
  slug: string;
  token: string;
  nombreInicial: string;
  clausula: string;
  leyenda: string;
  verificado: boolean;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [paso, setPaso] = useState<Paso>(verificado ? "firma" : "inicio");
  const [nombre, setNombre] = useState(nombreInicial);
  const [acepto, setAcepto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [correo, setCorreo] = useState<string | null>(null);
  const [png, setPng] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  function pedirCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await solicitarCodigoAction(slug, token, nombre, acepto);
      if (!r.ok) return setError(r.error);
      setCorreo(r.correo);
      setCodigo("");
      setPaso("codigo");
    });
  }

  function verificar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await verificarCodigoAction(slug, token, codigo.trim());
      if (!r.ok) return setError(r.error);
      setPaso("firma");
    });
  }

  function enviarFirma(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!png) return setError("Dibujá tu firma en el recuadro antes de firmar.");
    iniciar(async () => {
      const r = await firmarAction(slug, token, nombre, png);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  function enviarRechazo(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await rechazarAction(slug, token, motivo);
      if (!r.ok) return setError(r.error);
      router.refresh();
    });
  }

  const volverAlInicio = () => {
    setError(null);
    setPaso("inicio");
  };

  return (
    <section className="no-imprimir fo-card space-y-4 p-4" aria-live="polite">
      {paso === "inicio" && (
        <form onSubmit={pedirCodigo} className="space-y-3">
          <h2 className="text-base font-semibold">Firmar el contrato</h2>
          <label className="block space-y-1 text-sm">
            <span>Tu nombre completo</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} autoComplete="name" className="fo-input w-full" required />
          </label>
          <div className="max-h-40 overflow-y-auto rounded border p-3 text-sm whitespace-pre-line">{clausula}</div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={acepto} onChange={(e) => setAcepto(e.target.checked)} className="mt-1" />
            <span>Leí el contrato y acepto firmarlo con firma electrónica.</span>
          </label>
          <p className="text-xs opacity-70">{leyenda}</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pendiente || !acepto || nombre.trim().length < 2} className="fo-btn fo-btn-primary">
              {pendiente ? "Enviando…" : "Enviarme el código por correo"}
            </button>
            <button type="button" onClick={() => { setError(null); setPaso("rechazo"); }} className="fo-btn fo-btn-secondary" disabled={pendiente}>
              No estoy de acuerdo
            </button>
          </div>
        </form>
      )}

      {paso === "codigo" && (
        <form onSubmit={verificar} className="space-y-3">
          <h2 className="text-base font-semibold">Ingresá el código</h2>
          <p className="text-sm">Te mandamos un código de 6 números a {correo ?? "tu correo"}. Vale 15 minutos.</p>
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            aria-label="Código de 6 números"
            className="fo-input w-40 text-center text-lg tracking-widest"
            required
          />
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pendiente || codigo.length !== 6} className="fo-btn fo-btn-primary">
              {pendiente ? "Verificando…" : "Verificar"}
            </button>
            <button type="button" onClick={() => pedirCodigo()} disabled={pendiente} className="fo-btn fo-btn-secondary">
              Pedir otro código
            </button>
            <button type="button" onClick={volverAlInicio} disabled={pendiente} className="fo-btn fo-btn-secondary">
              Volver
            </button>
          </div>
        </form>
      )}

      {paso === "firma" && (
        <form onSubmit={enviarFirma} className="space-y-3">
          <h2 className="text-base font-semibold">Dibujá tu firma</h2>
          <label className="block space-y-1 text-sm">
            <span>Tu nombre (el mismo que escribiste antes)</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={120} className="fo-input w-full" required />
          </label>
          <FirmaCanvas onChange={setPng} disabled={pendiente} />
          <p className="text-xs opacity-70">{leyenda}</p>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pendiente || !png} className="fo-btn fo-btn-primary">
              {pendiente ? "Firmando…" : "Firmar el contrato"}
            </button>
            <button type="button" onClick={volverAlInicio} disabled={pendiente} className="fo-btn fo-btn-secondary">
              Volver
            </button>
          </div>
        </form>
      )}

      {paso === "rechazo" && (
        <form onSubmit={enviarRechazo} className="space-y-3">
          <h2 className="text-base font-semibold">No estoy de acuerdo</h2>
          <label className="block space-y-1 text-sm">
            <span>Contanos el motivo</span>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={1000} rows={4} className="fo-input w-full" required />
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={pendiente || motivo.trim().length === 0} className="fo-btn fo-btn-primary">
              {pendiente ? "Enviando…" : "Enviar"}
            </button>
            <button type="button" onClick={volverAlInicio} disabled={pendiente} className="fo-btn fo-btn-secondary">
              Volver
            </button>
          </div>
        </form>
      )}

      {error && <p role="alert" className="text-sm font-medium text-red-700">{error}</p>}
    </section>
  );
}
