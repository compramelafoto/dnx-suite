"use client";

import { EDITOR_FONT_CATALOG, type PhotoCrop, type TemplateV2Block } from "@repo/template-editor-core";
import { puntosDe } from "@/lib/fotolibro/modo/textos-libres";
import type { Favorita } from "@/lib/fotolibro/favoritas-tipos";
import type { EstadoFotolibro, FotoDelLibro, Lado, ModoPliego } from "@/lib/fotolibro/modo/estado";
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
  onVariante: (lado: Lado, paso: number) => void;
  /** Cuántas distribuciones tiene el pliego entero con sus fotos. */
  distribuciones: number;
  onModo: (modo: ModoPliego) => void;
  onSeparacion: (mm: number) => void;
  onMargen: (mm: number) => void;
  onVaciar: () => void;
  onAgregarPliego: () => void;
  onQuitarPliego: () => void;
  estilo: { nombre: string; roles: { rol: string; etiqueta: string; ejemplo: string }[]; textos: Record<string, string | undefined> } | null;
  onAbrirEstilos: () => void;
  onSacarEstilo: () => void;
  onTexto: (rol: string, valor: string) => void;
  /** El texto agregado a mano que está elegido, si hay. */
  textoLibre: TemplateV2Block | null;
  onAgregarTexto: () => void;
  onCambiarTexto: (cambio: { content?: string; fontFamily?: string; puntos?: number; color?: string; textAlign?: string; fontWeight?: number; fontItalic?: boolean }) => void;
  onQuitarTexto: () => void;
  onFondo: (color: string | null) => void;
  onBorde: (mm: number, color: string) => void;
  favoritas: Favorita[];
  onGuardarFavorita: () => void;
  onAplicarFavorita: (f: Favorita) => void;
  onBorrarFavorita: (id: string) => void;
};

/** Dibujito de una distribución: los marcos sobre un pliego chico, con el lomo marcado. */
function Croquis({ marcos }: { marcos: Favorita["marcos"] }) {
  return (
    <svg viewBox="0 0 200 100" className="w-full rounded-sm bg-white/90">
      {marcos.map((m, i) => (
        <rect key={i} x={m.x * 200 + 0.6} y={m.y * 100 + 0.6} width={Math.max(0, m.w * 200 - 1.2)} height={Math.max(0, m.h * 100 - 1.2)} fill="#94a3b8" />
      ))}
      <line x1="100" y1="0" x2="100" y2="100" stroke="#475569" strokeDasharray="3 3" strokeWidth="0.6" />
    </svg>
  );
}

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

  const t = props.textoLibre;
  return (
    <aside className="flex h-full w-72 flex-none flex-col gap-5 overflow-y-auto border-l border-white/10 bg-[#26272b] p-4 text-white">
      {t ? (
        <section className="space-y-2">
          <Titulo>Texto</Titulo>
          <textarea
            value={String(t.configJson.content ?? "")}
            onChange={(e) => props.onCambiarTexto({ content: e.target.value })}
            rows={3}
            className="w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-sm text-white"
          />
          <select
            value={String(t.configJson.fontFamily ?? "Playfair Display")}
            onChange={(e) => props.onCambiarTexto({ fontFamily: e.target.value })}
            className="w-full rounded border border-white/15 bg-black/30 px-2 py-1 text-sm text-white"
          >
            {EDITOR_FONT_CATALOG.map((f) => (
              <option key={f.family} value={f.family} style={{ fontFamily: f.family }}>
                {f.family}
              </option>
            ))}
          </select>
          <Deslizador etiqueta="Tamaño" valor={puntosDe(t, dpi)} min={6} max={120} paso={1} sufijo=" pt" onChange={(puntos) => props.onCambiarTexto({ puntos })} />
          <div className="flex items-center gap-2">
            <input type="color" value={String(t.configJson.color ?? "#222222")} onChange={(e) => props.onCambiarTexto({ color: e.target.value })} className="h-7 w-9 rounded border border-white/15 bg-transparent" title="Color" />
            {(["left", "center", "right"] as const).map((a) => (
              <button key={a} type="button" className={`${boton} ${t.configJson.textAlign === a ? "bg-white/20" : ""}`} onClick={() => props.onCambiarTexto({ textAlign: a })} title={a === "left" ? "A la izquierda" : a === "center" ? "Centrado" : "A la derecha"}>
                {a === "left" ? "⇤" : a === "center" ? "≡" : "⇥"}
              </button>
            ))}
            <button type="button" className={`${boton} font-bold ${Number(t.configJson.fontWeight) >= 700 ? "bg-white/20" : ""}`} onClick={() => props.onCambiarTexto({ fontWeight: Number(t.configJson.fontWeight) >= 700 ? 400 : 700 })}>
              N
            </button>
            <button type="button" className={`${boton} italic ${t.configJson.fontItalic ? "bg-white/20" : ""}`} onClick={() => props.onCambiarTexto({ fontItalic: !t.configJson.fontItalic })}>
              K
            </button>
          </div>
          <button type="button" className={boton} onClick={props.onQuitarTexto}>
            Borrar texto
          </button>
        </section>
      ) : foto && bloque ? (
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
            <li>Arrastrá fotos de la tira al pliego: se acomodan solas.</li>
            <li>Elegí varias y apretá <b>Enter</b>: arman el pliego.</li>
            <li>
              <b>A</b>/<b>Q</b> recorren las distribuciones del pliego (por páginas: <b>A</b>/<b>Q</b> la izquierda, <b>S</b>/<b>W</b> la derecha).
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
          <div className="mb-3 grid grid-cols-2 rounded-md bg-black/30 p-0.5 text-xs" role="radiogroup" aria-label="Cómo se arma el pliego">
            {(
              [
                ["pliego", "Pliego entero"],
                ["paginas", "Por páginas"],
              ] as const
            ).map(([m, etiqueta]) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={p.modo === m}
                onClick={() => props.onModo(m)}
                className={`rounded px-2 py-1 transition-colors ${p.modo === m ? "bg-[var(--fo-accent)] text-white shadow" : "text-white/70 hover:text-white"}`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          {p.modo === "pliego" ? (
            <div className="mb-2 flex items-center justify-between text-xs text-white/80">
              <span>
                {p.todo.fotos.length ? (
                  <>
                    Distribución{" "}
                    <span className="tabular-nums">
                      {(((p.todo.variante % props.distribuciones) + props.distribuciones) % props.distribuciones) + 1} de {props.distribuciones}
                    </span>
                  </>
                ) : (
                  "Sin fotos"
                )}
              </span>
              <span className="flex gap-1">
                <button type="button" className={boton} disabled={props.distribuciones < 2} title="Q" onClick={() => props.onVariante("todo", -1)}>
                  ◀
                </button>
                <button type="button" className={boton} disabled={props.distribuciones < 2} title="A" onClick={() => props.onVariante("todo", 1)}>
                  ▶
                </button>
              </span>
            </div>
          ) : (
            (["izq", "der"] as const).map((lado) => (
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
            ))
          )}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <button type="button" className={boton} onClick={props.onAgregarTexto}>
              ＋ Texto
            </button>
            <label className="flex items-center gap-1 text-xs text-white/70" title="Color de fondo de este pliego">
              Fondo
              <input type="color" value={p.fondo ?? "#ffffff"} onChange={(e) => props.onFondo(e.target.value)} className="h-6 w-8 rounded border border-white/15 bg-transparent" />
            </label>
            {p.fondo ? (
              <button type="button" className={boton} onClick={() => props.onFondo(null)} title="Volver al papel o al fondo del estilo">
                Quitar color
              </button>
            ) : null}
          </div>
          {p.modo === "pliego" ? (
            <div className="mb-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white/70">Favoritas</span>
                <button type="button" className={boton} disabled={!p.todo.fotos.length} onClick={props.onGuardarFavorita} title="Guardar esta distribución para usarla en otros pliegos y libros">
                  ★ Guardar esta
                </button>
              </div>
              {(() => {
                const sirven = props.favoritas.filter((f) => f.marcos.length === p.todo.fotos.length);
                if (!props.favoritas.length) return <p className="text-[11px] text-white/40">Guardá las distribuciones que más usás.</p>;
                if (!sirven.length) return <p className="text-[11px] text-white/40">Ninguna favorita para {p.todo.fotos.length} {p.todo.fotos.length === 1 ? "foto" : "fotos"}.</p>;
                return (
                  <div className="grid grid-cols-3 gap-1.5">
                    {sirven.map((f) => (
                      <div key={f.id} className="group relative">
                        <button type="button" onClick={() => props.onAplicarFavorita(f)} title={f.nombre || "Aplicar"} className="block w-full hover:opacity-80">
                          <Croquis marcos={f.marcos} />
                        </button>
                        <button
                          type="button"
                          onClick={() => props.onBorrarFavorita(f.id)}
                          title="Borrar de favoritas"
                          className="absolute -right-1 -top-1 hidden h-4 w-4 rounded-full bg-black/80 text-[9px] leading-4 text-white group-hover:block"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          ) : null}
          <button type="button" className={boton} onClick={props.onVaciar} disabled={!p.todo.fotos.length && !p.izq.fotos.length && !p.der.fotos.length}>
            Vaciar pliego
          </button>
        </section>
      ) : null}

      <section className="space-y-3">
        <Titulo>Todo el libro</Titulo>
        <Deslizador etiqueta="Separación entre fotos" valor={estado.separacionMm} min={0} max={20} paso={0.5} sufijo=" mm" onChange={props.onSeparacion} />
        <Deslizador etiqueta="Margen de la página" valor={estado.margenMm} min={0} max={30} paso={0.5} sufijo=" mm" onChange={props.onMargen} />
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Deslizador etiqueta="Borde de las fotos" valor={estado.bordeMm} min={0} max={10} paso={0.5} sufijo=" mm" onChange={(mm) => props.onBorde(mm, estado.bordeColor)} />
          </div>
          <input type="color" value={estado.bordeColor} onChange={(e) => props.onBorde(estado.bordeMm, e.target.value)} className="mb-0.5 h-6 w-8 rounded border border-white/15 bg-transparent" title="Color del borde" />
        </div>
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
