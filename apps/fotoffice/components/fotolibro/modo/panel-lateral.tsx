"use client";

import type { PhotoCrop, TemplateV2Block } from "@repo/template-editor-core";
import type { EstadoFotolibro, FotoDelLibro, LadoPliego } from "@/lib/fotolibro/modo/estado";
import type { Ubicacion } from "@/lib/fotolibro/modo/operaciones";

type Props = {
  estado: EstadoFotolibro;
  pliego: number;
  dpi: number;
  seleccionada: Ubicacion | null;
  foto: FotoDelLibro | null;
  bloque: TemplateV2Block | null;
  onCrop: (crop: PhotoCrop | null) => void;
  onQuitar: () => void;
  onVariante: (lado: LadoPliego, paso: number) => void;
  onSeparacion: (mm: number) => void;
  onMargen: (mm: number) => void;
  onVaciar: () => void;
  onAgregarPliego: () => void;
  onQuitarPliego: () => void;
  estilo: { nombre: string; roles: { rol: string; etiqueta: string; ejemplo: string }[]; textos: Record<string, string | undefined> } | null;
  onAbrirEstilos: () => void;
  onSacarEstilo: () => void;
  onTexto: (rol: string, valor: string) => void;
};

const Titulo = ({ children }: { children: React.ReactNode }) => (
  <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-white/50">{children}</h3>
);

const boton =
  "rounded border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/90 hover:bg-white/10 disabled:opacity-40";

function Deslizador({ etiqueta, valor, min, max, paso, onChange, sufijo = "" }: { etiqueta: string; valor: number; min: number; max: number; paso: number; onChange: (v: number) => void; sufijo?: string }) {
  return (
    <label className="block text-xs text-white/80">
      <span className="flex justify-between">
        <span>{etiqueta}</span>
        <span className="tabular-nums text-white/60">
          {valor.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
          {sufijo}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={paso}
        value={valor}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--fo-accent)]"
      />
    </label>
  );
}

/**
 * Resolución con la que va a salir impresa la foto: los píxeles del original que se ven en el
 * marco, divididos por las pulgadas que mide el marco. Debajo de 200 ppp se nota.
 */
function resolucion(foto: FotoDelLibro, bloque: TemplateV2Block, dpi: number): number {
  const zoom = typeof bloque.configJson.crop === "object" && bloque.configJson.crop ? Number((bloque.configJson.crop as PhotoCrop).zoom ?? 1) : 1;
  const anchoPulgadas = bloque.layout.width / dpi;
  const altoPulgadas = bloque.layout.height / dpi;
  // La foto cubre el marco: manda el lado que más la estira.
  const ppp = Math.min(foto.w / anchoPulgadas, foto.h / altoPulgadas) / Math.max(1, zoom);
  return Math.round(ppp);
}

export function PanelLateral(props: Props) {
  const { estado, pliego, foto, bloque, dpi } = props;
  const crop = (bloque?.configJson.crop as PhotoCrop | undefined) ?? { zoom: 1, x: 0, y: 0 };
  const p = estado.pliegos[pliego];

  return (
    <aside className="flex h-full w-72 flex-none flex-col gap-5 overflow-y-auto border-l border-white/10 bg-[#26272b] p-4 text-white">
      {foto && bloque ? (
        <section>
          <Titulo>Foto elegida</Titulo>
          <p className="truncate text-sm">{foto.nombre || "Foto"}</p>
          <p className="text-xs text-white/50">
            {foto.w} × {foto.h} px
          </p>
          {(() => {
            const ppp = resolucion(foto, bloque, dpi);
            return (
              <p className={`mt-1 text-xs ${ppp < 200 ? "text-amber-300" : "text-emerald-300"}`}>
                {ppp < 200 ? `⚠ Va a salir a ${ppp} ppp: puede verse pixelada. Achicá el marco o usá otra foto.` : `Sale a ${ppp} ppp: bien.`}
              </p>
            );
          })()}
          <div className="mt-3 space-y-3">
            <p className="text-[11px] leading-snug text-white/50">Doble clic sobre la foto para arrastrarla dentro del marco; la rueda acerca y aleja.</p>
            <Deslizador etiqueta="Zoom" valor={crop.zoom} min={1} max={4} paso={0.05} onChange={(zoom) => props.onCrop({ ...crop, zoom })} />
            <Deslizador etiqueta="Horizontal" valor={crop.x} min={-1} max={1} paso={0.01} onChange={(x) => props.onCrop({ ...crop, x })} />
            <Deslizador etiqueta="Vertical" valor={crop.y} min={-1} max={1} paso={0.01} onChange={(y) => props.onCrop({ ...crop, y })} />
            <div className="flex gap-2">
              <button type="button" className={boton} onClick={() => props.onCrop(null)}>
                Centrar
              </button>
              <button type="button" className={boton} onClick={props.onQuitar}>
                Quitar del pliego
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className="text-xs leading-relaxed text-white/60">
          <Titulo>Cómo se arma</Titulo>
          <ul className="list-disc space-y-1 pl-4">
            <li>Arrastrá fotos de la tira a una página: se acomodan solas.</li>
            <li>Elegí varias y apretá <b>Enter</b>: se reparten en las dos páginas.</li>
            <li>
              <b>A</b>/<b>Q</b> cambian el acomodo de la página izquierda; <b>S</b>/<b>W</b>, el de la derecha.
            </li>
            <li>Arrastrá una foto sobre otra para intercambiarlas.</li>
            <li>Doble clic en una foto para encuadrarla.</li>
            <li>
              <b>←</b>/<b>→</b> pasan de pliego.
            </li>
          </ul>
        </section>
      )}

      <section>
        <Titulo>Estilo</Titulo>
        {props.estilo ? (
          <div className="space-y-2">
            <p className="text-sm">{props.estilo.nombre}</p>
            {props.estilo.roles.map((r) => (
              <label key={r.rol} className="block text-xs text-white/70">
                {r.etiqueta}
                <input
                  value={props.estilo?.textos[r.rol] ?? ""}
                  placeholder={r.ejemplo}
                  onChange={(e) => props.onTexto(r.rol, e.target.value)}
                  className="mt-1 w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-sm text-white placeholder:text-white/30"
                />
              </label>
            ))}
            <div className="flex gap-2 pt-1">
              <button type="button" className={boton} onClick={props.onAbrirEstilos}>
                Cambiar estilo
              </button>
              <button type="button" className={boton} onClick={props.onSacarEstilo}>
                Sacar estilo
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-white/55">Fondos, adornos, portada y tipografías listos, por temática.</p>
            <button type="button" className="rounded bg-[var(--fo-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90" onClick={props.onAbrirEstilos}>
              Elegir estilo
            </button>
          </div>
        )}
      </section>

      {p ? (
        <section>
          <Titulo>Pliego {pliego + 1}</Titulo>
          {(["izq", "der"] as const).map((lado) => (
            <div key={lado} className="mb-2 flex items-center justify-between text-xs text-white/80">
              <span>
                {lado === "izq" ? "Izquierda" : "Derecha"} · {p[lado].fotos.length} {p[lado].fotos.length === 1 ? "foto" : "fotos"}
              </span>
              <span className="flex gap-1">
                <button type="button" className={boton} disabled={p[lado].fotos.length < 2} title={lado === "izq" ? "Q" : "W"} onClick={() => props.onVariante(lado, -1)}>
                  ◀
                </button>
                <button type="button" className={boton} disabled={p[lado].fotos.length < 2} title={lado === "izq" ? "A" : "S"} onClick={() => props.onVariante(lado, 1)}>
                  ▶
                </button>
              </span>
            </div>
          ))}
          <button type="button" className={boton} onClick={props.onVaciar} disabled={!p.izq.fotos.length && !p.der.fotos.length}>
            Vaciar pliego
          </button>
        </section>
      ) : null}

      <section className="space-y-3">
        <Titulo>Todo el libro</Titulo>
        <Deslizador etiqueta="Separación entre fotos" valor={estado.separacionMm} min={0} max={20} paso={0.5} sufijo=" mm" onChange={props.onSeparacion} />
        <Deslizador etiqueta="Margen de la página" valor={estado.margenMm} min={0} max={30} paso={0.5} sufijo=" mm" onChange={props.onMargen} />
        <div className="flex gap-2">
          <button type="button" className={boton} onClick={props.onAgregarPliego}>
            + Pliego
          </button>
          <button type="button" className={boton} onClick={props.onQuitarPliego} disabled={estado.pliegos.length <= 1}>
            Quitar este pliego
          </button>
        </div>
        <p className="text-[11px] text-white/45">
          {estado.pliegos.length} {estado.pliegos.length === 1 ? "pliego" : "pliegos"} · {estado.pliegos.length * 2} páginas
        </p>
      </section>
    </aside>
  );
}
