"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  calidadDeLaFoto,
  copiasPorTamano,
  textoDelPeso,
  type ArchivoAVerificar,
} from "@/lib/orders/print-export/verificacion-reglas";

/**
 * «Verificar lote»: pasa uno por uno los archivos que recibe el laboratorio, con el nombre, la
 * carpeta del ZIP, las copias, el tamaño, el acabado, el peso y la resolución. Lo arma el servidor
 * con lo mismo que el ZIP, así lo que se ve acá es lo que llega.
 *
 * ← → para moverse, espacio para pasarlos solos, Esc para cerrar.
 */

type Archivo = ArchivoAVerificar & { pesoBytes: number | null; falta: boolean; url: string | null; vistas: string[] };

type Respuesta = { nombre: string; zips: string[]; archivos: Archivo[]; omitidos: string[]; control: string[] };

export type FuenteDeVerificacion = { etiqueta: string; url: string };

type Props = {
  titulo: string;
  /** Una por formato del ZIP (p. ej. PDF y JPG en los lotes escolares). La primera se abre sola. */
  fuentes: FuenteDeVerificacion[];
  /** Lo que el laboratorio ve además de los archivos: laboratorio, mensaje, fecha prometida… */
  envio?: Array<{ etiqueta: string; valor: string }>;
  onCerrar: () => void;
};

const VELOCIDADES = [
  { ms: 1000, texto: "Rápido (1 s)" },
  { ms: 2000, texto: "Normal (2 s)" },
  { ms: 4000, texto: "Lento (4 s)" },
];

const BOTON = "rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/15 disabled:opacity-40";

export default function VerificarLote({ titulo, fuentes, envio = [], onCerrar }: Props) {
  const [fuente, setFuente] = useState(0);
  const [datos, setDatos] = useState<Respuesta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [i, setI] = useState(0);
  const [pasando, setPasando] = useState(false);
  const [velocidad, setVelocidad] = useState(2000);
  const [vista, setVista] = useState<"uno" | "lista">("uno");
  const [medidas, setMedidas] = useState<Record<number, { w: number; h: number }>>({});

  const url = fuentes[fuente]?.url;
  useEffect(() => {
    if (!url) return;
    let vivo = true;
    setDatos(null);
    setError(null);
    setI(0);
    setPasando(false);
    setMedidas({});
    fetch(url, { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as Partial<Respuesta> & { error?: string };
        if (!vivo) return;
        if (!r.ok) setError(j.error || "No se pudo armar la verificación.");
        else setDatos(j as Respuesta);
      })
      .catch(() => vivo && setError("No se pudo armar la verificación. Revisá la conexión."));
    return () => {
      vivo = false;
    };
  }, [url]);

  const archivos = useMemo(() => datos?.archivos ?? [], [datos]);
  const total = archivos.length;
  const actual = archivos[i] ?? null;
  const ir = useCallback((paso: number) => setI((x) => Math.min(Math.max(x + paso, 0), Math.max(total - 1, 0))), [total]);

  // Pasarlos solos: se frena al llegar al último.
  useEffect(() => {
    if (!pasando) return;
    if (i >= total - 1) {
      setPasando(false);
      return;
    }
    const t = window.setTimeout(() => ir(1), velocidad);
    return () => window.clearTimeout(t);
  }, [pasando, i, total, velocidad, ir]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
      else if (e.key === "ArrowRight") ir(1);
      else if (e.key === "ArrowLeft") ir(-1);
      else if (e.key === " " && vista === "uno") {
        e.preventDefault();
        setPasando((p) => !p);
      } else return;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ir, onCerrar, vista]);

  const totalCopias = archivos.reduce((s, a) => s + a.copias, 0);
  const grupos = useMemo(() => copiasPorTamano(archivos), [archivos]);
  const faltan = archivos.filter((a) => a.falta).length;
  const calidad = (a: Archivo) => {
    const m = medidas[a.n];
    return m && a.tipo === "FOTO" ? calidadDeLaFoto(m.w, m.h, a.tamano) : null;
  };
  const conAviso = archivos.filter((a) => (calidad(a)?.avisos.length ?? 0) > 0).length;
  const siguiente = archivos[i + 1];

  return (
    <div role="dialog" aria-modal="true" aria-label={`Verificar ${titulo}`} className="fixed inset-0 z-[60] flex flex-col bg-gray-950 text-white">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-white/10 px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="m-0 truncate text-base font-semibold">Verificar lote · {titulo}</h2>
          {datos ? (
            <p className="m-0 text-xs text-white/60">
              {total} {total === 1 ? "archivo" : "archivos"} · {totalCopias} {totalCopias === 1 ? "copia" : "copias"}
              {datos.zips.length > 1 ? ` · en ${datos.zips.length} ZIP` : ""}
              {faltan ? <span className="text-red-300"> · {faltan} sin archivo</span> : null}
              {conAviso ? <span className="text-amber-300"> · {conAviso} con aviso</span> : null}
            </p>
          ) : null}
        </div>
        {fuentes.length > 1 ? (
          <div className="flex rounded-lg border border-white/15 p-0.5" role="group" aria-label="Formato del ZIP">
            {fuentes.map((f, k) => (
              <button
                key={f.url}
                type="button"
                onClick={() => setFuente(k)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium", k === fuente ? "bg-white text-gray-900" : "text-white/80 hover:bg-white/10")}
              >
                {f.etiqueta}
              </button>
            ))}
          </div>
        ) : null}
        {total > 0 ? (
          <div className="flex rounded-lg border border-white/15 p-0.5" role="group" aria-label="Vista">
            {(["uno", "lista"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => {
                  setVista(v);
                  setPasando(false);
                }}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium", v === vista ? "bg-white text-gray-900" : "text-white/80 hover:bg-white/10")}
              >
                {v === "uno" ? "De a uno" : "Lista"}
              </button>
            ))}
          </div>
        ) : null}
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg px-3 py-1 text-2xl leading-none text-white/80 hover:bg-white/10">
          ✕
        </button>
      </header>

      {datos && (grupos.length > 0 || envio.length > 0 || datos.omitidos.length > 0) ? (
        <div className="space-y-2 border-b border-white/10 px-4 py-2 text-xs">
          {grupos.length ? (
            <div className="flex flex-wrap gap-1.5">
              {grupos.map((g) => (
                <span key={g.texto} className="rounded-full bg-white/10 px-2.5 py-0.5">
                  <b>{g.texto}</b>: {g.copias} {g.copias === 1 ? "copia" : "copias"} ({g.archivos} {g.archivos === 1 ? "archivo" : "archivos"})
                </span>
              ))}
            </div>
          ) : null}
          {envio.length ? (
            <p className="m-0 text-white/70">
              {envio.map((e, k) => (
                <span key={e.etiqueta}>
                  {k ? " · " : ""}
                  {e.etiqueta}: <span className="text-white">{e.valor}</span>
                </span>
              ))}
            </p>
          ) : null}
          {datos.omitidos.length ? (
            <div className="rounded-lg border border-red-400/40 bg-red-500/10 px-3 py-2 text-red-200">
              <p className="m-0 font-semibold">No entran al ZIP:</p>
              <ul className="m-0 list-disc pl-5">
                {datos.omitidos.map((o) => (
                  <li key={o}>{o}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <main className="min-h-0 flex-1 overflow-auto">
        {error ? (
          <p className="m-6 rounded-lg border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-200">{error}</p>
        ) : !datos ? (
          <p className="m-6 text-sm text-white/70">Armando la lista de archivos, igual que el ZIP…</p>
        ) : total === 0 ? (
          <p className="m-6 text-sm text-white/70">Este lote no tiene archivos para el laboratorio.</p>
        ) : vista === "lista" ? (
          <Lista
            archivos={archivos}
            calidad={calidad}
            onElegir={(k) => {
              setI(k);
              setVista("uno");
            }}
          />
        ) : actual ? (
          <div className="grid h-full gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Vista
              key={actual.n}
              a={actual}
              onMedida={(w, h) => setMedidas((m) => (m[actual.n]?.w === w && m[actual.n]?.h === h ? m : { ...m, [actual.n]: { w, h } }))}
            />
            <Ficha a={actual} calidad={calidad(actual)} medida={medidas[actual.n] ?? null} />
          </div>
        ) : null}
        {/* Precarga la siguiente para que el paso sea instantáneo. */}
        {vista === "uno" && siguiente?.tipo === "FOTO" && siguiente.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={siguiente.url} alt="" aria-hidden className="hidden" />
        ) : null}
      </main>

      {datos && total > 0 && vista === "uno" ? (
        <footer className="space-y-2 border-t border-white/10 px-4 py-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden>
            <div className="h-full bg-[#c27b3d] transition-all" style={{ width: `${((i + 1) / total) * 100}%` }} />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button type="button" className={BOTON} disabled={i === 0} onClick={() => ir(-1)}>
                ‹ Anterior
              </button>
              <span className="min-w-[6rem] text-center text-sm tabular-nums">
                {i + 1} de {total}
              </span>
              <button type="button" className={BOTON} disabled={i >= total - 1} onClick={() => ir(1)}>
                Siguiente ›
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(BOTON, pasando && "border-[#c27b3d] bg-[#c27b3d] hover:bg-[#b06a2f]")}
                onClick={() => {
                  if (!pasando && i >= total - 1) setI(0);
                  setPasando((p) => !p);
                }}
              >
                {pasando ? "❚❚ Pausar" : "▶ Pasarlos solos"}
              </button>
              <select
                value={velocidad}
                onChange={(e) => setVelocidad(Number(e.target.value))}
                aria-label="Velocidad"
                className="rounded-lg border border-white/15 bg-gray-900 px-2 py-1.5 text-sm text-white"
              >
                {VELOCIDADES.map((v) => (
                  <option key={v.ms} value={v.ms}>
                    {v.texto}
                  </option>
                ))}
              </select>
            </div>
            <p className="m-0 hidden text-[11px] text-white/50 md:block">← → para moverte · espacio pasa solos · Esc cierra</p>
          </div>
          {i >= total - 1 && datos.control.length ? (
            <p className="m-0 text-xs text-white/60">
              Además de estos archivos, el ZIP lleva: {datos.control.join(" · ")}.
            </p>
          ) : null}
        </footer>
      ) : null}
    </div>
  );
}

function Vista({ a, onMedida }: { a: Archivo; onMedida: (w: number, h: number) => void }) {
  // Se monta de nuevo con cada archivo (`key`), así «rota» arranca en falso.
  const [rota, setRota] = useState(false);
  const caja = "relative flex min-h-[50dvh] items-center justify-center rounded-xl bg-black/40 p-2";
  const insignia = (
    <span className="absolute left-3 top-3 rounded-full bg-[#c27b3d] px-3 py-1 text-sm font-bold shadow">
      × {a.copias} {a.copias === 1 ? "copia" : "copias"}
    </span>
  );
  if (a.falta || !a.url) {
    return (
      <div className={cn(caja, "border border-red-400/50")}>
        {insignia}
        <p className="max-w-sm text-center text-sm text-red-200">
          Este archivo no está guardado. El laboratorio lo va a recibir anotado como <b>FALTA</b> en el control del ZIP.
        </p>
      </div>
    );
  }
  if (a.tipo === "PDF") {
    return (
      <div className={cn(caja, "flex-col gap-3")}>
        {insignia}
        {a.vistas.length ? (
          <div className="flex max-h-[70dvh] flex-wrap items-center justify-center gap-3 overflow-auto">
            {a.vistas.map((v, k) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={v} src={v} alt={`Cara ${k + 1} de ${a.archivo}`} className="max-h-[62dvh] max-w-full rounded bg-white object-contain" />
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/70">Archivo PDF.</p>
        )}
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#e7a86b] hover:underline">
          Abrir el PDF que recibe el laboratorio
        </a>
      </div>
    );
  }
  return (
    <div className={caja}>
      {insignia}
      {rota ? (
        <p className="text-sm text-red-200">No se pudo abrir la imagen. Probá con «Abrir el original».</p>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={a.url}
          src={a.url}
          alt={a.archivo}
          onLoad={(e) => onMedida(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
          onError={() => setRota(true)}
          className="max-h-[70dvh] max-w-full rounded object-contain"
        />
      )}
    </div>
  );
}

function Ficha({ a, calidad, medida }: { a: Archivo; calidad: ReturnType<typeof calidadDeLaFoto>; medida: { w: number; h: number } | null }) {
  const filas: Array<[string, string | null]> = [
    ["Carpeta", a.carpeta || "(raíz del ZIP)"],
    ["ZIP", a.zip],
    ["Pedido", a.pedido ? `#${a.pedido}` : null],
    ["Cliente", a.cliente],
    ["Trabajo", a.detalle],
    ["Producto", a.producto],
    ["Tamaño", a.tamano],
    ["Acabado", a.acabado || (a.tamano ? "Sin acabado cargado" : null)],
    ["Peso", textoDelPeso(a.pesoBytes)],
    [
      "Resolución",
      medida ? `${medida.w} × ${medida.h} px${calidad ? ` · ${calidad.dpi} dpi a ${a.tamano}` : ""}` : a.tipo === "FOTO" ? "midiendo…" : null,
    ],
  ];
  return (
    <aside className="space-y-3 overflow-auto rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <p className="m-0 text-[11px] uppercase tracking-wide text-white/50">Archivo #{a.n}</p>
        <p className="m-0 break-all font-mono text-sm">{a.archivo}</p>
      </div>
      <div className="rounded-lg bg-[#c27b3d]/15 px-3 py-2">
        <p className="m-0 text-[11px] uppercase tracking-wide text-[#e7a86b]">Copias</p>
        <p className="m-0 text-3xl font-bold tabular-nums">{a.copias}</p>
        {a.tamano ? (
          <p className="m-0 text-sm text-white/80">
            {a.tamano}
            {a.acabado ? ` · ${a.acabado}` : ""}
          </p>
        ) : null}
      </div>
      <dl className="m-0 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-x-2 gap-y-1.5 text-sm">
        {filas
          .filter((f): f is [string, string] => !!f[1])
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-white/50">{k}</dt>
              <dd className="m-0 break-words">{v}</dd>
            </div>
          ))}
      </dl>
      {a.falta ? <p className="m-0 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-200">Falta el archivo.</p> : null}
      {calidad?.avisos.map((t) => (
        <p key={t} className="m-0 rounded-lg bg-amber-500/15 px-3 py-2 text-sm text-amber-200">
          {t}
        </p>
      ))}
      {a.url && a.tipo === "FOTO" ? (
        <a href={a.url} target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-medium text-[#e7a86b] hover:underline">
          Abrir el original
        </a>
      ) : null}
    </aside>
  );
}

function Lista({
  archivos,
  calidad,
  onElegir,
}: {
  archivos: Archivo[];
  calidad: (a: Archivo) => ReturnType<typeof calidadDeLaFoto>;
  onElegir: (indice: number) => void;
}) {
  return (
    <div className="p-4">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-gray-950 text-xs text-white/60">
          <tr>
            <th className="py-2 pr-3 font-medium">#</th>
            <th className="py-2 pr-3 font-medium">Archivo</th>
            <th className="py-2 pr-3 font-medium">Carpeta</th>
            <th className="py-2 pr-3 font-medium">Pedido / trabajo</th>
            <th className="py-2 pr-3 text-right font-medium">Copias</th>
            <th className="py-2 pr-3 font-medium">Peso</th>
            <th className="py-2 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {archivos.map((a, k) => {
            const avisos = calidad(a)?.avisos ?? [];
            return (
              <tr key={a.n} onClick={() => onElegir(k)} className="cursor-pointer border-t border-white/10 hover:bg-white/5">
                <td className="py-1.5 pr-3 tabular-nums text-white/50">{a.n}</td>
                <td className="max-w-[22rem] truncate py-1.5 pr-3 font-mono text-xs" title={a.archivo}>
                  {a.archivo}
                </td>
                <td className="py-1.5 pr-3 text-white/80">{a.carpeta || "—"}</td>
                <td className="max-w-[16rem] truncate py-1.5 pr-3 text-white/80">
                  {a.pedido ? `#${a.pedido} ${a.cliente ?? ""}` : (a.detalle ?? "—")}
                </td>
                <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{a.copias}</td>
                <td className="py-1.5 pr-3 text-white/70">{textoDelPeso(a.pesoBytes)}</td>
                <td className="py-1.5">
                  {a.falta ? (
                    <span className="text-red-300">Falta</span>
                  ) : avisos.length ? (
                    <span className="text-amber-300" title={avisos.join("\n")}>
                      Revisar
                    </span>
                  ) : (
                    <span className="text-emerald-300">OK</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
