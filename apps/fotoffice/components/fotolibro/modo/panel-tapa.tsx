"use client";

import type { PhotoCrop } from "@repo/template-editor-core";
import type { FotoDelLibro, TapaDelLibro } from "@/lib/fotolibro/modo/estado";
import type { ModeloTapa } from "@/lib/fotolibro/tapa/catalogo";
import type { GeometriaTapa } from "@/lib/fotolibro/tapa/geometria";
import type { CaraTapa } from "./tapa-vista";
import { DISENOS_TAPA, disenoDeTapa, type DisenoTapa } from "@/lib/fotolibro/tapa/bloques";

type Props = {
  modelos: ModeloTapa[];
  tapa: TapaDelLibro | null;
  geometria: GeometriaTapa | null;
  seleccion: CaraTapa | null;
  foto: FotoDelLibro | null;
  /** Lo que se ve escrito en la tapa (propio de la tapa o, si no, del estilo). */
  textos: { titulo?: string; subtitulo?: string; frase?: string };
  onDiseno: (d: DisenoTapa) => void;
  onTexto: (rol: "titulo" | "subtitulo" | "frase", valor: string) => void;
  onModelo: (id: string | null) => void;
  onEncuadre: (crop: PhotoCrop | null) => void;
  onQuitarFoto: () => void;
};

const boton = "rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/90 hover:bg-white/10 disabled:opacity-40";
const mm = (n: number) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });

function Deslizador({ etiqueta, valor, min, max, paso, onChange }: { etiqueta: string; valor: number; min: number; max: number; paso: number; onChange: (v: number) => void }) {
  return (
    <label className="block text-xs text-white/80">
      <span className="flex justify-between">
        <span>{etiqueta}</span>
        <span className="tabular-nums text-white/60">{valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })}</span>
      </span>
      <input type="range" min={min} max={max} step={paso} value={valor} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-[var(--fo-accent)]" />
    </label>
  );
}

/** El panel de la tapa: el modelo del laboratorio, la foto elegida y su encuadre. */
export function PanelTapa({ modelos, tapa, geometria, seleccion, foto, textos, ...props }: Props) {
  const modelo = modelos.find((m) => m.id === tapa?.modeloId) ?? null;
  const encuadre = (seleccion === "contratapa" ? tapa?.contratapaEncuadre : tapa?.encuadre) ?? { zoom: 1, x: 0, y: 0 };

  return (
    <aside className="flex h-full w-72 flex-none flex-col gap-5 overflow-y-auto border-l border-white/10 bg-[#26272b] p-4 text-white">
      <section>
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Modelo de tapa</h3>
        {modelos.length === 0 ? (
          <p className="text-xs leading-relaxed text-white/60">
            Todavía no tenemos la plantilla de tapa de este laboratorio para esta medida. Pasanos su PSD y la sumamos.
          </p>
        ) : (
          <div className="space-y-1.5">
            {modelos.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => props.onModelo(m.id)}
                className={`block w-full rounded px-2.5 py-2 text-left text-xs ${m.id === tapa?.modeloId ? "bg-white/15 ring-1 ring-[var(--fo-accent)]" : "bg-white/5 hover:bg-white/10"}`}
              >
                <span className="block font-medium">{[m.laboratorio, m.modelo].filter(Boolean).join(" · ")}</span>
                <span className="block text-white/55">{m.descripcion}</span>
                {m.estimada ? <span className="mt-1 inline-block rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">Medidas estimadas</span> : null}
              </button>
            ))}
            {tapa ? (
              <button type="button" className={`${boton} mt-1`} onClick={() => props.onModelo(null)}>
                Sin tapa
              </button>
            ) : null}
          </div>
        )}
        {modelo && geometria ? (
          <p className="mt-2 text-[11px] leading-snug text-white/50">
            Pieza de {mm(geometria.pieza.ancho)} × {mm(geometria.pieza.alto)} mm.
            {modelo.tipo === "flexible" ? " Del mismo tamaño que el pliego, abierta al revés." : " Lo sombreado se dobla sobre el cartón: no pongas ahí nada importante."}
            {geometria.lomo ? ` Lomo de ${mm(geometria.lomo.w)} mm para estas hojas.` : ""}
          </p>
        ) : null}
      </section>

      {foto && seleccion ? (
        <section className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Foto de {seleccion === "tapa" ? "la tapa" : "la contratapa"}</h3>
          <p className="truncate text-sm">{foto.nombre || "Foto"}</p>
          <p className="text-[11px] leading-snug text-white/50">Doble clic sobre la foto para arrastrarla dentro del marco; la rueda acerca y aleja.</p>
          <Deslizador etiqueta="Zoom" valor={encuadre.zoom} min={1} max={4} paso={0.05} onChange={(zoom) => props.onEncuadre({ ...encuadre, zoom })} />
          <Deslizador etiqueta="Horizontal" valor={encuadre.x} min={-1} max={1} paso={0.01} onChange={(x) => props.onEncuadre({ ...encuadre, x })} />
          <Deslizador etiqueta="Vertical" valor={encuadre.y} min={-1} max={1} paso={0.01} onChange={(y) => props.onEncuadre({ ...encuadre, y })} />
          <div className="flex gap-2">
            <button type="button" className={boton} onClick={() => props.onEncuadre(null)}>
              Centrar
            </button>
            <button type="button" className={boton} onClick={props.onQuitarFoto}>
              Quitar foto
            </button>
          </div>
        </section>
      ) : modelo ? (
        <section className="text-xs leading-relaxed text-white/60">
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">Cómo se arma</h3>
          <ul className="list-disc space-y-1 pl-4">
            <li>Arrastrá una foto de la tira a la tapa{modelo.tipo === "frente" ? "" : " o a la contratapa"}.</li>
            <li>
              <b>→</b> va al primer pliego.
            </li>
          </ul>
        </section>
      ) : null}

      {modelo ? (
        <section className="space-y-1.5">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Diseño de portada</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {DISENOS_TAPA.map((d) => (
              <button
                key={d.id}
                type="button"
                title={d.detalle}
                onClick={() => props.onDiseno(d.id)}
                className={`rounded px-2 py-1.5 text-left text-xs ${disenoDeTapa(tapa?.diseno) === d.id ? "bg-white/15 ring-1 ring-[var(--fo-accent)]" : "bg-white/5 hover:bg-white/10"}`}
              >
                {d.nombre}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-white/45">
            <b>↑</b>/<b>↓</b> (o <b>Q</b>/<b>A</b>) también los recorren.
          </p>
        </section>
      ) : null}

      {modelo ? (
        <section className="space-y-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Textos de la tapa</h3>
          {textos ? (
            (
              [
                ["titulo", "Título"],
                ["subtitulo", "Debajo del título"],
                ...(modelo.tipo === "frente" ? [] : [["frase", "Frase de la contratapa (si no lleva foto)"]]),
              ] as ["titulo" | "subtitulo" | "frase", string][]
            ).map(([rol, etiqueta]) => (
              <label key={rol} className="block text-xs text-white/70">
                {etiqueta}
                <input
                  value={textos[rol] ?? ""}
                  onChange={(e) => props.onTexto(rol, e.target.value)}
                  className="mt-1 w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-sm text-white"
                />
              </label>
            ))
          ) : null}
          {/* Sin estilo, la letra es una clásica; con estilo, la del estilo. */}
        </section>
      ) : null}
    </aside>
  );
}
