// apps/fotoffice/components/digitalizacion/no-digitalizable.tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { quitarNoDigitalizableAction, registrarNoDigitalizableAction } from "@/app/(shell)/digitalizacion/actions";
import { MAX_MOTIVO_OTRO, MOTIVOS_NO_DIGITALIZABLE, type MotivoNoDigitalizable } from "@/lib/digitalizacion/no-digitalizable";

/**
 * «Registrar cassette que no se pudo digitalizar» de la ficha del trabajo: el número (por defecto,
 * el siguiente), el tipo y el motivo. Queda como un cassette hecho, así el pedido se puede completar
 * (18 grabados + 2 que no se pudieron de 20 vendidos). El servidor vuelve a validar todo.
 */
export function RegistrarNoDigitalizable({ proyectoId, siguiente, tipo: tipoInicial }: { proyectoId: string; siguiente: number; tipo: "VHS" | "DVD" }) {
  const [abierto, setAbierto] = useState(false);
  const [numero, setNumero] = useState(String(siguiente));
  const [tipo, setTipo] = useState<"VHS" | "DVD">(tipoInicial);
  const [motivo, setMotivo] = useState<MotivoNoDigitalizable>("CORTADA");
  const [otro, setOtro] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendiente, empezar] = useTransition();
  const router = useRouter();

  if (!abierto) {
    return (
      <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => { setNumero(String(siguiente)); setAviso(null); setAbierto(true); }}>
        Registrar cassette que no se pudo digitalizar
      </button>
    );
  }

  const guardar = () =>
    empezar(async () => {
      const n = numero.trim() === "" ? null : Number(numero);
      if (n !== null && (!Number.isInteger(n) || n < 1 || n > 999)) { setAviso("El número tiene que ser entre 1 y 999."); return; }
      if (tipo === "VHS" && n === null) { setAviso("Poné el número de cassette."); return; }
      if (motivo === "OTRO" && !otro.trim()) { setAviso("Escribí el motivo."); return; }
      const r = await registrarNoDigitalizableAction({ proyectoId, tipo, cassetteNumero: n, motivo, otro: motivo === "OTRO" ? otro : undefined });
      if (!r.ok) { setAviso(r.error); return; }
      setAbierto(false);
      setOtro("");
      router.refresh();
    });

  return (
    <div className="space-y-2 rounded border border-[var(--fo-border)] p-3 text-sm">
      <p className="font-medium">Cassette que no se pudo digitalizar</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          Tipo
          <select className="rounded border p-1" value={tipo} onChange={(e) => setTipo(e.target.value === "DVD" ? "DVD" : "VHS")}>
            <option value="VHS">VHS</option>
            <option value="DVD">DVD</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          N.°
          <input type="number" min={1} max={999} className="w-20 rounded border p-1" value={numero} onChange={(e) => setNumero(e.target.value)} />
        </label>
        <label className="flex items-center gap-2">
          Motivo
          <select className="rounded border p-1" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoNoDigitalizable)}>
            {(Object.keys(MOTIVOS_NO_DIGITALIZABLE) as MotivoNoDigitalizable[]).map((k) => (
              <option key={k} value={k}>{MOTIVOS_NO_DIGITALIZABLE[k]}</option>
            ))}
          </select>
        </label>
        {motivo === "OTRO" ? (
          <input
            className="w-72 max-w-full rounded border p-1"
            aria-label="Motivo"
            maxLength={MAX_MOTIVO_OTRO}
            placeholder="Ej.: la cinta se trabó y se rompió"
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="fo-btn fo-btn-primary text-xs" disabled={pendiente} onClick={guardar}>Registrar</button>
        <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente} onClick={() => setAbierto(false)}>Cancelar</button>
        {aviso ? <span className="text-gray-600">{aviso}</span> : null}
      </div>
    </div>
  );
}

/** «Quitar» un cassette que no se pudo digitalizar (por si se registró por error): deja de contar. */
export function QuitarNoDigitalizable({ id }: { id: string }) {
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);
  const router = useRouter();
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm">
      <button
        type="button"
        className="fo-btn fo-btn-secondary text-xs"
        disabled={pendiente}
        onClick={() => {
          if (!window.confirm("¿Quitar este cassette? Deja de contar como hecho.")) return;
          empezar(async () => {
            const r = await quitarNoDigitalizableAction(id);
            if (!r.ok) { setAviso(r.error); return; }
            router.refresh();
          });
        }}
      >
        Quitar
      </button>
      {aviso ? <span className="text-gray-600">{aviso}</span> : null}
    </span>
  );
}
