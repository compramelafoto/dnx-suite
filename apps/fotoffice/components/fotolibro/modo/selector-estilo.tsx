"use client";

import { useMemo, useState } from "react";
import { ESTILOS, temasConEstilos } from "@/lib/fotolibro/estilos/catalogo";
import type { EstiloFotolibro, Medidas, TemaId } from "@/lib/fotolibro/estilos/tipos";
import { aislarIds, vistaPreviaPliego } from "@/lib/fotolibro/estilos/vista-previa";

type Props = {
  medidas: Medidas;
  actual: string | null;
  aplicando: string | null;
  onElegir: (estilo: EstiloFotolibro) => void;
  onCerrar: () => void;
};

/** La vista previa entra como SVG en línea: así usa las tipografías ya cargadas en la página. */
function Previa({ svg, clave }: { svg: string; clave: string }) {
  // Cada vista previa con sus propios ids: si no, los estilos se roban degradados entre sí.
  const html = aislarIds(svg, `${clave.replace(/[^a-z0-9]/gi, "")}-`).replace(/width="[^"]*mm" height="[^"]*mm"/, 'width="100%"');
  return <div className="w-full leading-[0] shadow" dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * El catálogo de estilos, por temática. Cada estilo se muestra con la portada y un interior, a la
 * medida de este libro: lo que se ve es lo que va a quedar.
 */
export function SelectorEstilo({ medidas, actual, aplicando, onElegir, onCerrar }: Props) {
  const temas = temasConEstilos();
  const inicial = (ESTILOS.find((e) => e.id === actual)?.tema ?? temas[0]?.id ?? "bodas") as TemaId;
  const [tema, setTema] = useState<TemaId>(inicial);
  const estilos = useMemo(() => ESTILOS.filter((e) => e.tema === tema), [tema]);

  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/70 p-6" onClick={onCerrar}>
      <div className="flex max-h-full w-full max-w-6xl flex-col overflow-hidden rounded-lg bg-[#202124] text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
          <h2 className="text-base font-semibold">Elegí un estilo</h2>
          <span className="text-xs text-white/50">Fondos, adornos, tipografías, portada y cierre. Las fotos siguen siendo tuyas.</span>
          <button type="button" onClick={onCerrar} className="ml-auto rounded px-2 py-1 text-white/70 hover:bg-white/10">
            Cerrar
          </button>
        </header>
        <nav className="flex flex-wrap gap-1 border-b border-white/10 px-5 py-2">
          {temas.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTema(t.id)}
              className={`rounded px-2.5 py-1 text-xs ${tema === t.id ? "bg-[var(--fo-accent)] text-white" : "text-white/70 hover:bg-white/10"}`}
            >
              {t.nombre}
            </button>
          ))}
        </nav>
        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 md:grid-cols-2">
          {estilos.map((e) => (
            <button
              key={e.id}
              type="button"
              disabled={aplicando !== null}
              onClick={() => onElegir(e)}
              className={`group space-y-2 rounded-md p-3 text-left transition-colors ${actual === e.id ? "bg-white/15 ring-2 ring-[var(--fo-accent)]" : "bg-white/5 hover:bg-white/10"} disabled:opacity-60`}
            >
              <div className="grid grid-cols-2 gap-2">
                <Previa clave={`${e.id}-ap`} svg={vistaPreviaPliego(e, "apertura", medidas)} />
                <Previa clave={`${e.id}-in`} svg={vistaPreviaPliego(e, "interior", medidas)} />
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{e.nombre}</span>
                {aplicando === e.id ? <span className="text-xs text-white/70">Aplicando…</span> : actual === e.id ? <span className="text-xs text-[var(--fo-accent)]">En uso</span> : null}
              </div>
              <p className="text-xs text-white/55">{e.descripcion}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
