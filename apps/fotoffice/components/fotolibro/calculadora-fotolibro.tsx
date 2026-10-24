"use client";

import { useMemo, useState } from "react";
import { formatMinorArs } from "@/lib/membership/money";
import {
  cotizarFotolibro,
  fotosPorHoja,
  hojasSugeridas,
  medidasDe,
  modelosDe,
  tablaSugerencias,
  tieneCaja,
  MAXIMO_HOJAS,
  type CatalogoFotolibro,
  type TipoTapa,
} from "@/lib/fotolibro/cotizar";
import type { FotolibroVendido } from "@/lib/fotolibro/venta";

export type LineaFotolibro = { descripcion: string; precioMinor: number; costoMinor: number | null };

/** El libro, la caja en su propio renglón (si se pidió) y lo elegido, para crear el fotolibro. */
export type FotolibroAgregado = {
  libro: LineaFotolibro;
  caja: LineaFotolibro | null;
  eleccion: Omit<FotolibroVendido, "templateId">;
};

function pesos(minor: number): string {
  return formatMinorArs(minor).replace(/,00$/, "");
}

/**
 * Calculadora de fotolibros: cuántas fotos → hojas sugeridas por medida → modelo (la tapa),
 * medida, hojas y caja → el renglón del libro y, aparte, el de la caja. La cantidad de hojas es
 * sólo una sugerencia: se puede cambiar. Se usa en el mostrador y en los presupuestos.
 *
 * Con `tipo` (los productos "Fotolibro tapa flexible" / "tapa rígida") sólo ofrece esos modelos.
 */
export function CalculadoraFotolibro({
  catalogo,
  verCostos,
  onAgregar,
  onCerrar,
  textoAgregar = "Agregar",
  tipo = null,
  titulo = "Fotolibro",
  proveedorInicial = null,
}: {
  catalogo: CatalogoFotolibro;
  verCostos: boolean;
  onAgregar: (f: FotolibroAgregado) => void;
  onCerrar: () => void;
  textoAgregar?: string;
  tipo?: TipoTapa | null;
  titulo?: string;
  /** El proveedor por omisión (el del producto); si no tiene lista, el primero. */
  proveedorInicial?: string | null;
}) {
  const conModelos = useMemo(() => catalogo.ofertas.filter((o) => modelosDe(o, tipo).length > 0), [catalogo, tipo]);
  const ofertas = conModelos.length > 0 ? conModelos : catalogo.ofertas;
  const [proveedorId, setProveedorId] = useState(
    ofertas.find((o) => o.proveedorId === proveedorInicial)?.proveedorId ?? ofertas[0]?.proveedorId ?? "",
  );
  const oferta = ofertas.find((o) => o.proveedorId === proveedorId) ?? ofertas[0]!;
  const modelos = useMemo(() => modelosDe(oferta, tipo), [oferta, tipo]);
  const [modelo, setModelo] = useState(modelos[0] ?? "");
  const modeloVigente = modelos.includes(modelo) ? modelo : (modelos[0] ?? "");
  const medidas = useMemo(() => medidasDe(oferta, modeloVigente), [oferta, modeloVigente]);
  const [medida, setMedida] = useState("");
  const medidaVigente = medidas.includes(medida) ? medida : (medidas[0] ?? "");
  const [fotosTexto, setFotosTexto] = useState("");
  const fotos = Number(fotosTexto) || 0;
  // null = seguir la sugerencia; un número = lo que escribió la persona.
  const [hojasTexto, setHojasTexto] = useState<string | null>(null);
  const [conCaja, setConCaja] = useState(false);

  const sugeridas = hojasSugeridas(fotos, fotosPorHoja(medidaVigente, catalogo.fotosPorHoja));
  const hojas = hojasTexto === null ? sugeridas : Number(hojasTexto);
  const cajaPosible = tieneCaja(oferta, modeloVigente, medidaVigente);
  const tabla = fotos > 0 ? tablaSugerencias(catalogo, oferta.proveedorId, modeloVigente, fotos) : [];
  const r = medidaVigente
    ? cotizarFotolibro(catalogo, { proveedorId: oferta.proveedorId, modelo: modeloVigente, medida: medidaVigente, hojas, conCaja: conCaja && cajaPosible })
    : ({ ok: false, error: "Este modelo no tiene medidas con hojas en la lista." } as const);

  return (
    <div className="space-y-4 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-[var(--fo-surface)] p-4 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold">{titulo}</p>
          <p className="fo-helper">Tapa + hojas, con los precios de la última lista del proveedor. La caja va en un renglón aparte.</p>
        </div>
        <button type="button" className="fo-btn fo-btn-ghost text-xs" onClick={onCerrar}>
          Cerrar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="fo-field-stack">
          <span className="fo-label">¿Cuántas fotos quiere imprimir?</span>
          <input autoFocus className="fo-input" inputMode="numeric" value={fotosTexto} onChange={(e) => { setFotosTexto(e.target.value.replace(/\D/g, "")); setHojasTexto(null); }} placeholder="Ej.: 100" />
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Proveedor</span>
          <select className="fo-input" value={oferta.proveedorId} onChange={(e) => { setProveedorId(e.target.value); setHojasTexto(null); }}>
            {ofertas.map((o) => (
              <option key={o.proveedorId} value={o.proveedorId}>
                {o.proveedor} · lista {o.vigencia}
              </option>
            ))}
          </select>
        </label>
        <label className="fo-field-stack sm:col-span-2">
          <span className="fo-label">Modelo (la tapa)</span>
          <select className="fo-input" value={modeloVigente} onChange={(e) => setModelo(e.target.value)}>
            {modelos.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      {tabla.length > 0 ? (
        <div className="space-y-1">
          <p className="fo-label">Sugerencia para {fotos} fotos (tocá una medida para elegirla)</p>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="text-xs text-[var(--fo-muted)]">
                <tr>
                  <th className="py-1 pr-3 font-semibold">Medida</th>
                  <th className="py-1 pr-3 font-semibold">Fotos por hoja</th>
                  <th className="py-1 pr-3 font-semibold">Hojas</th>
                  <th className="py-1 font-semibold">Precio</th>
                </tr>
              </thead>
              <tbody>
                {tabla.map((f) => (
                  <tr
                    key={f.medida}
                    className={`cursor-pointer hover:bg-[var(--fo-surface-hover)] ${f.medida === medidaVigente ? "font-semibold text-[var(--fo-accent)]" : ""}`}
                    onClick={() => { setMedida(f.medida); setHojasTexto(null); }}
                  >
                    <td className="py-1 pr-3">{f.medida}</td>
                    <td className="py-1 pr-3 tabular-nums">~{f.fotosPorHoja}</td>
                    <td className="py-1 pr-3 tabular-nums">{f.hojas}</td>
                    <td className="py-1 tabular-nums">{pesos(f.precioMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="fo-field-stack">
          <span className="fo-label">Medida (abierto)</span>
          <select className="fo-input" value={medidaVigente} onChange={(e) => { setMedida(e.target.value); setHojasTexto(null); }}>
            {medidas.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <label className="fo-field-stack">
          <span className="fo-label">Hojas {hojasTexto === null && fotos > 0 ? "(sugeridas)" : ""}</span>
          <input
            className="fo-input tabular-nums"
            inputMode="numeric"
            value={hojasTexto ?? String(sugeridas)}
            onChange={(e) => setHojasTexto(e.target.value.replace(/\D/g, ""))}
            aria-label="Cantidad de hojas"
            title={`1 hoja = 2 páginas. Máximo ${MAXIMO_HOJAS}.`}
          />
        </label>
        <label className={`flex items-center gap-2 pt-6 ${cajaPosible ? "" : "opacity-50"}`}>
          <input type="checkbox" checked={conCaja && cajaPosible} disabled={!cajaPosible} onChange={(e) => setConCaja(e.target.checked)} />
          Con caja
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--fo-border)] pt-3">
        {r.ok ? (
          <div>
            <p className="font-medium">{r.descripcion}</p>
            <p className="text-lg font-semibold tabular-nums">{pesos(r.precioMinor)}</p>
            {r.caja ? (
              <p className="tabular-nums">
                + {r.caja.descripcion}: <span className="font-semibold">{pesos(r.caja.precioMinor)}</span>
              </p>
            ) : null}
            {verCostos && r.costoMinor !== null ? (
              <p className="fo-helper tabular-nums">
                Costo {pesos(r.costoMinor + (r.caja?.costoMinor ?? 0))} · margen {catalogo.marginPct} % (×{String(1 + catalogo.marginPct / 100).replace(".", ",")})
              </p>
            ) : null}
          </div>
        ) : (
          <p className="text-[var(--fo-danger)]">{r.error}</p>
        )}
        <button
          type="button"
          className="fo-btn fo-btn-primary text-sm"
          disabled={!r.ok}
          onClick={() =>
            r.ok &&
            onAgregar({
              libro: { descripcion: r.descripcion, precioMinor: r.precioMinor, costoMinor: r.costoMinor },
              caja: r.caja,
              eleccion: {
                proveedorId: oferta.proveedorId,
                modelo: modeloVigente,
                medida: medidaVigente,
                hojas,
                fotos: fotos > 0 ? fotos : null,
                costoMinor: r.costoMinor,
                cajaCostoMinor: r.caja?.costoMinor ?? null,
              },
            })
          }
        >
          {textoAgregar}
        </button>
      </div>
    </div>
  );
}
