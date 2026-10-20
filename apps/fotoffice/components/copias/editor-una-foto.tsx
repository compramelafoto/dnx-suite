"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, RectangleHorizontal, RectangleVertical, RotateCw, Undo2 } from "lucide-react";
import { AJUSTES_NEUTROS } from "@/lib/impresion/ajustes";
import {
  aspectosDe,
  cambiarModo,
  cambiarOrientacion,
  conZoom,
  enderezarA,
  girar90,
  moverEncuadre,
  nivelDeZoom,
  papelOrientado,
  rangoDeZoom,
  volverALaPropuesta,
  zoomEncuadre,
  type Contexto,
  type Papel,
} from "@/lib/impresion/encuadre";
import { calidadDeCopia } from "@/lib/impresion/geometria";
import { CANTIDAD_MAX, mismaReceta, textoDeAviso } from "@/lib/impresion/lote";
import { colorBordeDe, type Modo, type Receta } from "@/lib/impresion/receta";
import type { FotoCopia } from "@/lib/impresion/copias";
import { Ajustes } from "@/components/foto-carnet/ajustes";
import { PapelConFoto } from "./papel-con-foto";
import { accionDeTecla, cantidadDesdeTexto } from "./teclas";
import { VistaPieza } from "./vista-pieza";

const coma = (v: number) => String(v).replace(".", ",");

/**
 * Una foto por vez (spec §6): arrastrar mueve la foto, la rueda o el deslizador hacen zoom,
 * girar 90°, enderezar ±10°, papel parado o acostado, "Volver a la propuesta", guías y ajustes.
 * Teclado: ← → foto anterior / siguiente (guarda), R recortar, E encajar, Enter confirma y la
 * marca "Revisada". Todo se guarda como receta (proporciones): la pantalla no cambia el resultado.
 */
export function EditorUnaFoto({
  foto,
  papel,
  indice,
  total,
  onGuardar,
  onIr,
  onPegarATodas,
  onCerrar,
}: {
  foto: FotoCopia & { pieza: NonNullable<FotoCopia["pieza"]> };
  papel: Papel & { nombre: string };
  indice: number;
  total: number;
  /** Guarda esta foto; false si el servidor no la aceptó (el error lo muestra quien llama). */
  onGuardar: (d: { receta: Receta; cantidad: number; revisada: boolean }) => Promise<boolean>;
  onIr: (delta: -1 | 1) => void;
  onPegarATodas: (d: { modo: Modo; cantidad: number }) => void;
  onCerrar: () => void;
}) {
  const [receta, setRecetaLibre] = useState<Receta>(foto.pieza.receta);
  const [cantidad, setCantidadLibre] = useState(foto.pieza.cantidad);
  const [error, setError] = useState<string | null>(null);
  const [pestana, setPestana] = useState<"ENCUADRE" | "RETOQUE">("ENCUADRE");
  const [guias, setGuias] = useState(true);
  const [guardando, setGuardando] = useState(false);
  // El estado tarda un render en verse: la ref frena un segundo guardado (Enter + clic) en el mismo instante.
  const guardandoRef = useRef(false);
  // Mientras se guarda no se edita: lo que se tocara en ese momento no llegaría al servidor y se
  // perdería al pasar a la otra foto.
  const setReceta = (f: (r: Receta) => Receta) => {
    if (!guardandoRef.current) setRecetaLibre(f);
  };
  const setCantidad = (n: number) => {
    if (!guardandoRef.current) setCantidadLibre(n);
  };
  const contenedor = useRef<HTMLDivElement>(null);
  const [lado, setLado] = useState(480);

  const ctx: Contexto = { foto: { ancho: foto.ancho, alto: foto.alto }, papel };
  const { af, ap } = aspectosDe(receta, ctx);
  const rango = rangoDeZoom(receta.modo, af, ap);
  const nivel = nivelDeZoom(receta.encuadre, af, ap);
  const papelPieza = papelOrientado(papel, receta.orientacion ?? "VERTICAL");
  const calidad = calidadDeCopia(ctx.foto, receta, papelPieza);
  const aviso = textoDeAviso(calidad.aviso, papel.nombre);
  const src = `/api/impresion/vista/${foto.originalId}`;
  const cambio = !mismaReceta(receta, foto.pieza.receta) || cantidad !== foto.pieza.cantidad;
  const ultima = indice === total - 1;

  // El papel ocupa el ancho disponible (entre 240 y 640 px).
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setLado(Math.max(240, Math.min(640, Math.floor(e.contentRect.width))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /** Guarda (si hace falta) y después va a otra foto (`delta`) o vuelve a la grilla (0). */
  async function guardarEIr(delta: -1 | 0 | 1, revisada: boolean) {
    if (guardandoRef.current) return;
    if (cambio || revisada) {
      guardandoRef.current = true;
      setGuardando(true);
      setError(null);
      let ok = false;
      try {
        ok = await onGuardar({ receta, cantidad, revisada });
      } catch {
        setError("No se pudo guardar la foto. Probá de nuevo.");
      } finally {
        guardandoRef.current = false;
        setGuardando(false);
      }
      if (!ok) return;
    }
    if (delta === 0) onCerrar();
    else onIr(delta);
  }
  const confirmar = () => guardarEIr(ultima ? 0 : 1, true);

  // Teclado: se lee la última versión de las funciones sin volver a suscribirse en cada cambio.
  const teclas = useRef<(e: KeyboardEvent) => void>(() => undefined);
  useEffect(() => {
    teclas.current = (e) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      const accion = accionDeTecla(
        { key: e.key, target: t, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, repeat: e.repeat },
        { primera: indice === 0, ultima },
      );
      if (!accion) return;
      e.preventDefault();
      if (accion === "ANTERIOR") void guardarEIr(-1, false);
      else if (accion === "SIGUIENTE") void guardarEIr(1, false);
      else if (accion === "RECORTAR") setReceta((r) => cambiarModo(r, "RECORTAR", ctx));
      else if (accion === "ENCAJAR") setReceta((r) => cambiarModo(r, "ENCAJAR", ctx));
      else void confirmar();
    };
  });
  useEffect(() => {
    const f = (e: KeyboardEvent) => teclas.current(e);
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  const pestanaClase = (p: "ENCUADRE" | "RETOQUE") =>
    `rounded-full border px-3 py-1.5 text-xs ${
      pestana === p ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-[var(--fo-on-accent,#fff)]" : "border-[var(--fo-border)]"
    }`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button type="button" className="fo-icon-btn" aria-label="Foto anterior" disabled={indice === 0 || guardando} onClick={() => void guardarEIr(-1, false)}>
            <ArrowLeft className="size-4" aria-hidden />
          </button>
          <span className="text-sm">
            Foto {indice + 1} de {total} · <span className="text-[var(--fo-muted)]">{foto.nombre}</span>
          </span>
          <button type="button" className="fo-icon-btn" aria-label="Foto siguiente" disabled={ultima || guardando} onClick={() => void guardarEIr(1, false)}>
            <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
        <div className="flex gap-2" role="tablist" aria-label="Qué editar">
          <button type="button" role="tab" aria-selected={pestana === "ENCUADRE"} className={pestanaClase("ENCUADRE")} onClick={() => setPestana("ENCUADRE")}>
            Encuadre
          </button>
          <button type="button" role="tab" aria-selected={pestana === "RETOQUE"} className={pestanaClase("RETOQUE")} onClick={() => setPestana("RETOQUE")}>
            Retoque
          </button>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div ref={contenedor} className="min-w-0 space-y-3">
          {pestana === "ENCUADRE" ? (
            <PapelConFoto
              src={src}
              foto={ctx.foto}
              receta={receta}
              papelMm={papelPieza}
              lado={lado}
              guias={guias}
              onArrastrar={(dx, dy) => setReceta((r) => ({ ...r, encuadre: moverEncuadre(r.encuadre, dx, dy, r.modo) }))}
              onZoom={(f) =>
                setReceta((r) => {
                  const a = aspectosDe(r, ctx);
                  return { ...r, encuadre: zoomEncuadre(r.encuadre, f, r.modo, a.af, a.ap) };
                })
              }
            />
          ) : (
            <VistaPieza src={src} receta={receta} papelMm={papelPieza} />
          )}
          {error ? (
            <p className="fo-alert-error" role="alert">
              {error}
            </p>
          ) : null}
          {aviso ? (
            <p className={calidad.aviso === "PIXELADA" ? "fo-alert-error" : "fo-alert-warning"}>
              {aviso} ({calidad.ppp} ppp efectivos).
            </p>
          ) : null}
        </div>

        <div className="space-y-4">
          {pestana === "ENCUADRE" ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={receta.modo === "RECORTAR" ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"}
                  onClick={() => setReceta((r) => cambiarModo(r, "RECORTAR", ctx))}
                >
                  Recortar (R)
                </button>
                <button
                  type="button"
                  className={receta.modo === "ENCAJAR" ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"}
                  onClick={() => setReceta((r) => cambiarModo(r, "ENCAJAR", ctx))}
                >
                  Encajar (E)
                </button>
              </div>
              <label className="block space-y-1">
                <span className="flex justify-between text-sm">
                  <span>Zoom</span>
                  <span className="text-xs text-[var(--fo-muted)]">{coma(Math.round(nivel * 100) / 100)}×</span>
                </span>
                <input
                  type="range"
                  min={rango.min}
                  max={rango.max}
                  step={0.01}
                  value={nivel}
                  onChange={(e) => setReceta((r) => ({ ...r, encuadre: conZoom(r.encuadre, Number(e.target.value), r.modo, af, ap) }))}
                  className="w-full accent-[var(--fo-accent)]"
                />
              </label>
              <label className="block space-y-1">
                <span className="flex justify-between text-sm">
                  <span>Enderezar</span>
                  <span className="text-xs text-[var(--fo-muted)]">{coma(receta.enderezar)}°</span>
                </span>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={0.5}
                  value={receta.enderezar}
                  onChange={(e) => setReceta((r) => enderezarA(r, Number(e.target.value), ctx))}
                  className="w-full accent-[var(--fo-accent)]"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setReceta((r) => girar90(r, ctx))}>
                  <RotateCw className="size-4" aria-hidden />
                  Girar 90°
                </button>
                <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setReceta((r) => cambiarOrientacion(r, ctx))}>
                  {receta.orientacion === "HORIZONTAL" ? <RectangleVertical className="size-4" aria-hidden /> : <RectangleHorizontal className="size-4" aria-hidden />}
                  {receta.orientacion === "HORIZONTAL" ? "Papel parado" : "Papel acostado"}
                </button>
                <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setReceta((r) => volverALaPropuesta(r, ctx))}>
                  <Undo2 className="size-4" aria-hidden />
                  Volver a la propuesta
                </button>
              </div>
              {receta.modo === "ENCAJAR" ? (
                <label className="flex items-center gap-2 text-sm">
                  Color del borde
                  <input
                    type="color"
                    value={colorBordeDe(receta)}
                    onChange={(e) => setReceta((r) => ({ ...r, colorBorde: e.target.value.toLowerCase() }))}
                    className="h-8 w-12 cursor-pointer rounded border border-[var(--fo-border)]"
                  />
                </label>
              ) : null}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={guias} onChange={(e) => setGuias(e.target.checked)} className="accent-[var(--fo-accent)]" />
                Guías (tercios y zona de seguridad de 3 mm)
              </label>
              <p className="text-xs text-[var(--fo-muted)]">
                Arrastrá la foto para moverla; con la rueda del mouse o el zoom la acercás o la achicás. Teclas: ← → foto anterior y
                siguiente, R recortar, E encajar, Enter confirma.
              </p>
            </>
          ) : (
            <Ajustes
              ajustes={receta.ajustes}
              onChange={(a) => setReceta((r) => ({ ...r, ajustes: a }))}
              onRestablecer={() => setReceta((r) => ({ ...r, ajustes: { ...AJUSTES_NEUTROS } }))}
              explicacion="Ajustes suaves de luz y color. Lo que ves al lado es una vista previa: la copia se arma desde la foto original, sin perder calidad."
            />
          )}

          <div className="flex flex-wrap items-end gap-3">
            <label className="block w-28">
              <span className="fo-label">Copias</span>
              <input
                type="number"
                min={1}
                max={CANTIDAD_MAX}
                step={1}
                value={cantidad}
                onChange={(e) => setCantidad(cantidadDesdeTexto(e.target.value))}
                className="fo-input"
              />
            </label>
            <button type="button" className="fo-btn fo-btn-secondary" onClick={() => onPegarATodas({ modo: receta.modo, cantidad })}>
              Usar este modo y cantidad en todas
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="fo-btn fo-btn-secondary" disabled={guardando} onClick={() => void guardarEIr(0, false)}>
              Volver a la grilla
            </button>
            <button type="button" className="fo-btn fo-btn-primary" disabled={guardando} onClick={() => void confirmar()}>
              <Check className="size-4" aria-hidden />
              {guardando ? "Guardando…" : ultima ? "Revisada (Enter)" : "Revisada, siguiente (Enter)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
