"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, LayoutGrid, Printer } from "lucide-react";
import { papelOrientado, propuestaAutomatica } from "@/lib/impresion/encuadre";
import { calidadDeCopia } from "@/lib/impresion/geometria";
import {
  CANTIDAD_MAX,
  FOTOS_MAX,
  aplicarGuardado,
  cambiosEnLote,
  cantidadParaElTicket,
  resultadoDeArmado,
  totalDeCopias,
  type CambioEnLote,
  type PiezaAGuardar,
} from "@/lib/impresion/lote";
import { SUBIDAS_A_LA_VEZ, conLimite, validarArchivoFoto } from "@/lib/impresion/subidas";
import type { EstadoCopias, FotoCopia } from "@/lib/impresion/copias";
import {
  confirmarOriginalAction,
  estadoCopiasAction,
  generarHojaCopiaAction,
  guardarPiezasCopiaAction,
  pedirSubidaOriginalAction,
  quitarFotoCopiaAction,
} from "@/app/(shell)/ventas/impresion/actions";
import { EditorUnaFoto } from "./editor-una-foto";
import { TarjetaFoto } from "./tarjeta-foto";

/** Error con un texto que se le puede mostrar a quien atiende. */
class ErrorVisible extends Error {}

/**
 * Copias instantáneas (spec §6 y §9): se cargan las fotos que trae el cliente, cada una llega con
 * la propuesta automática, se revisan en la grilla o de a una, y se arman las hojas (una por foto,
 * de a una llamada). "Listo" vuelve al ticket con el total de copias. El navegador sólo guarda
 * recetas: los archivos los arma el servidor desde el original. La cantidad que vuelve al ticket
 * sale de lo guardado en el servidor, no de la pantalla.
 */
export function EditorCopias({
  preparacionId,
  onListo,
  onCancelar,
}: {
  preparacionId: string;
  onListo: (r: { cantidad: number }) => void;
  onCancelar: () => void;
}) {
  const [estado, setEstado] = useState<EstadoCopias | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [avisosSubida, setAvisosSubida] = useState<string[]>([]);
  const [subida, setSubida] = useState<{ hechas: number; total: number } | null>(null);
  const [armado, setArmado] = useState<{ hechas: number; total: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  /** El error de cada foto (por originalId) que no se pudo armar: se ve en su tarjeta. */
  const [errores, setErrores] = useState<Map<string, string>>(new Map());
  const [abierta, setAbierta] = useState<string | null>(null);
  const [cantidadLote, setCantidadLote] = useState(1);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let vigente = true;
    estadoCopiasAction(preparacionId)
      .then((e) => {
        if (!vigente) return;
        if (!e) setError("Esa preparación ya no existe. Cerrá y volvé a tocar «Preparar».");
        else setEstado(e);
      })
      .catch(() => {
        if (vigente) setError("No se pudo leer lo ya preparado. Probá de nuevo.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [preparacionId]);

  const fotos = estado?.fotos ?? [];
  const papel = estado ? { ...estado.papel } : null;
  const total = totalDeCopias(fotos);
  const todasArmadas = fotos.length > 0 && fotos.every((f) => f.hoja !== null);
  const trabajando = ocupado || subida !== null || armado !== null;

  async function guardar(items: PiezaAGuardar[]): Promise<boolean> {
    if (items.length === 0) return true;
    try {
      const r = await guardarPiezasCopiaAction(preparacionId, items);
      if (!r.ok) {
        setError(r.error);
        return false;
      }
    } catch {
      setError("No se pudo guardar. Revisá la conexión y probá de nuevo.");
      return false;
    }
    setError(null);
    olvidarErrores(items.map((i) => i.originalId));
    setEstado((e) => (e ? { ...e, fotos: aplicarGuardado(e.fotos, items, e.papel) } : e));
    return true;
  }

  function olvidarErrores(ids: string[]) {
    setErrores((m) => {
      if (!ids.some((id) => m.has(id))) return m;
      const n = new Map(m);
      for (const id of ids) n.delete(id);
      return n;
    });
  }

  /** Una foto: pedir la subida, subirla directo a R2, confirmarla y guardar su propuesta automática. */
  async function subirUna(file: File, tipo: string): Promise<void> {
    if (!estado) return;
    const s = await pedirSubidaOriginalAction(preparacionId, { nombre: file.name, tipo, bytes: file.size });
    if (!s.ok) throw new ErrorVisible(s.error);
    const put = await fetch(s.url, { method: "PUT", headers: { "Content-Type": tipo }, body: file });
    if (!put.ok) throw new ErrorVisible("No se pudo subir. Probá de nuevo.");
    const c = await confirmarOriginalAction(s.originalId);
    if (!c.ok) throw new ErrorVisible(c.error);
    const receta = propuestaAutomatica(c.ancho, c.alto, estado.papel);
    const g = await guardarPiezasCopiaAction(preparacionId, [{ originalId: c.originalId, cantidad: 1, receta, revisada: false }]);
    if (!g.ok) throw new ErrorVisible(g.error);
    const calidad = calidadDeCopia({ ancho: c.ancho, alto: c.alto }, receta, papelOrientado(estado.papel, receta.orientacion ?? "VERTICAL"));
    const nueva: FotoCopia = {
      originalId: c.originalId,
      nombre: file.name,
      ancho: c.ancho,
      alto: c.alto,
      pieza: { receta, cantidad: 1, revisada: false, ...calidad },
      hoja: null,
    };
    setEstado((e) => (e ? { ...e, fotos: [...e.fotos, nueva] } : e));
  }

  async function subir(lista: File[]) {
    if (!estado || lista.length === 0) return;
    const avisos: string[] = [];
    const validos: { file: File; tipo: string }[] = [];
    const lugar = FOTOS_MAX - fotos.length;
    for (const file of lista) {
      const v = validarArchivoFoto(file);
      if (!v.ok) avisos.push(`${file.name}: ${v.error}`);
      else if (validos.length >= lugar) avisos.push(`${file.name}: una preparación admite hasta ${FOTOS_MAX} fotos.`);
      else validos.push({ file, tipo: v.tipo });
    }
    setAvisosSubida(avisos);
    if (validos.length === 0) return;
    setSubida({ hechas: 0, total: validos.length });
    const resultados = await conLimite(validos, SUBIDAS_A_LA_VEZ, async ({ file, tipo }) => {
      try {
        await subirUna(file, tipo);
      } finally {
        setSubida((s) => (s ? { ...s, hechas: s.hechas + 1 } : s));
      }
    });
    resultados.forEach((r, i) => {
      if (r.status === "rejected") {
        const motivo = r.reason instanceof ErrorVisible ? r.reason.message : "no se pudo subir. Probá de nuevo.";
        avisos.push(`${validos[i]!.file.name}: ${motivo}`);
      }
    });
    setAvisosSubida([...avisos]);
    setSubida(null);
  }

  async function enLote(cambio: CambioEnLote, soloElegidas: boolean) {
    if (!estado) return;
    setOcupado(true);
    await guardar(cambiosEnLote(estado.fotos, soloElegidas ? elegidas : new Set(), cambio, estado.papel));
    setOcupado(false);
  }

  async function cambiarCantidad(f: FotoCopia, n: number) {
    if (!f.pieza) return;
    const cantidad = Math.min(CANTIDAD_MAX, Math.max(1, Math.round(n) || 1));
    if (cantidad === f.pieza.cantidad) return;
    await guardar([{ originalId: f.originalId, receta: f.pieza.receta, cantidad, revisada: false }]);
  }

  async function quitar(f: FotoCopia) {
    if (!confirm(`¿Quitar «${f.nombre}» de la preparación?`)) return;
    setOcupado(true);
    try {
      const r = await quitarFotoCopiaAction(preparacionId, f.originalId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setEstado((e) => (e ? { ...e, fotos: e.fotos.filter((x) => x.originalId !== f.originalId) } : e));
      setElegidas((s) => {
        const n = new Set(s);
        n.delete(f.originalId);
        return n;
      });
      olvidarErrores([f.originalId]);
    } catch {
      setError("No se pudo quitar la foto. Probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  /** Una foto sin pieza (falló el guardado al subirla): se le guarda la propuesta antes de abrirla. */
  async function abrir(f: FotoCopia) {
    // Mientras se arman las hojas no se edita: lo guardado ahora quedaría pisado por la hoja vieja.
    if (!estado || trabajando) return;
    if (!f.pieza) {
      const receta = propuestaAutomatica(f.ancho, f.alto, estado.papel);
      if (!(await guardar([{ originalId: f.originalId, receta, cantidad: 1, revisada: false }]))) return;
    }
    setAbierta(f.originalId);
  }

  /**
   * Arma las hojas que falten, una llamada por foto y de a una por vez (nada de pedidos largos ni
   * de cargar el servidor). Si una foto falla (aunque el servidor tire una excepción), el error
   * queda en su tarjeta y se sigue con las demás. true si quedaron todas armadas.
   */
  async function armarHojas(): Promise<boolean> {
    const faltan = fotos.filter((f) => f.pieza && !f.hoja);
    if (faltan.length === 0) return true;
    setError(null);
    setArmado({ hechas: 0, total: faltan.length });
    const resultados = await conLimite(faltan, 1, async (f) => {
      try {
        return await generarHojaCopiaAction(preparacionId, f.originalId);
      } finally {
        setArmado((a) => (a ? { ...a, hechas: a.hechas + 1 } : a));
      }
    });
    const { armadas, errores: nuevos } = resultadoDeArmado(
      faltan.map((f) => f.originalId),
      resultados,
    );
    setEstado((e) => (e ? { ...e, fotos: e.fotos.map((x) => ({ ...x, hoja: armadas.get(x.originalId) ?? x.hoja })) } : e));
    setErrores((m) => {
      const n = new Map(m);
      for (const f of faltan) n.delete(f.originalId);
      for (const [id, texto] of nuevos) n.set(id, texto);
      return n;
    });
    setArmado(null);
    if (nuevos.size > 0) {
      setError(nuevos.size === 1 ? "Una foto no se pudo armar: mirá su tarjeta." : `${nuevos.size} fotos no se pudieron armar: mirá sus tarjetas.`);
      return false;
    }
    return true;
  }

  /** Arma lo que falte y vuelve al ticket con el total de copias que quedó guardado en el servidor. */
  async function listo() {
    if (fotos.length === 0) return;
    if (fotos.some((f) => f.pieza?.aviso === "PIXELADA") && !confirm("Hay fotos que se van a ver pixeladas. ¿Imprimirlas igual?")) return;
    if (!(await armarHojas())) return;
    setOcupado(true);
    try {
      const e = await estadoCopiasAction(preparacionId);
      if (!e) {
        setError("Esa preparación ya no existe. Cerrá y volvé a tocar «Preparar».");
        return;
      }
      setEstado(e);
      const r = cantidadParaElTicket(e.fotos);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onListo({ cantidad: r.cantidad });
    } catch {
      setError("No se pudo confirmar lo preparado. Revisá la conexión y probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  if (cargando) return <p className="text-sm text-[var(--fo-muted)]">Buscando lo ya preparado…</p>;
  if (!estado || !papel) {
    return (
      <div className="space-y-3">
        <p className="fo-alert-error">{error ?? "No se pudo abrir la preparación."}</p>
        <button type="button" className="fo-btn fo-btn-secondary" onClick={onCancelar}>
          Volver al ticket
        </button>
      </div>
    );
  }

  const indice = abierta ? fotos.findIndex((f) => f.originalId === abierta) : -1;
  const actual = indice >= 0 ? fotos[indice] : undefined;
  if (actual?.pieza) {
    return (
      <div className="space-y-4">
        {error ? <p className="fo-alert-error">{error}</p> : null}
        <EditorUnaFoto
          key={actual.originalId}
          foto={{ ...actual, pieza: actual.pieza }}
          papel={papel}
          indice={indice}
          total={fotos.length}
          onGuardar={({ receta, cantidad, revisada }) => guardar([{ originalId: actual.originalId, receta, cantidad, revisada }])}
          onIr={(d) => setAbierta(fotos[indice + d]?.originalId ?? null)}
          onPegarATodas={(c) => void enLote(c, false)}
          onCerrar={() => setAbierta(null)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error ? <p className="fo-alert-error">{error}</p> : null}

      <section className="fo-card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">
              Copias {papel.nombre} · {estado.salida}
            </h2>
            <p className="text-xs text-[var(--fo-muted)]">
              {fotos.length} {fotos.length === 1 ? "foto" : "fotos"} · {total} {total === 1 ? "copia" : "copias"}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const lista = Array.from(e.target.files ?? []);
              e.currentTarget.value = "";
              void subir(lista);
            }}
          />
          <button type="button" className="fo-btn fo-btn-primary" disabled={trabajando || fotos.length >= FOTOS_MAX} onClick={() => inputRef.current?.click()}>
            <ImagePlus className="size-4" aria-hidden />
            {subida ? `Subiendo ${subida.hechas} de ${subida.total}…` : "Agregar fotos"}
          </button>
        </div>
        <p className="text-xs text-[var(--fo-muted)]">
          JPG, PNG o WebP de hasta 60 MB, hasta {FOTOS_MAX} fotos. Cada foto llega con una propuesta: si se pierde poco se recorta; si no,
          se encaja con borde blanco. Tocá una foto para moverla, hacer zoom o retocarla.
        </p>
        {avisosSubida.length > 0 ? (
          <ul className="fo-alert-warning list-disc space-y-1 pl-5 text-sm">
            {avisosSubida.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        ) : null}
      </section>

      {fotos.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>{elegidas.size > 0 ? `${elegidas.size} ${elegidas.size === 1 ? "elegida" : "elegidas"}:` : "A todas:"}</span>
            <button type="button" className="fo-btn fo-btn-secondary h-8 px-2 text-xs" disabled={trabajando} onClick={() => void enLote({ modo: "RECORTAR" }, true)}>
              Recortar
            </button>
            <button type="button" className="fo-btn fo-btn-secondary h-8 px-2 text-xs" disabled={trabajando} onClick={() => void enLote({ modo: "ENCAJAR" }, true)}>
              Encajar
            </button>
            <label className="flex items-center gap-1 text-xs">
              Copias
              <input
                type="number"
                min={1}
                max={CANTIDAD_MAX}
                value={cantidadLote}
                onChange={(e) => setCantidadLote(Math.min(CANTIDAD_MAX, Math.max(1, Math.round(Number(e.target.value)) || 1)))}
                className="fo-input h-8 w-16"
              />
            </label>
            <button type="button" className="fo-btn fo-btn-secondary h-8 px-2 text-xs" disabled={trabajando} onClick={() => void enLote({ cantidad: cantidadLote }, true)}>
              Aplicar copias
            </button>
            <button
              type="button"
              className="ml-auto text-xs underline"
              onClick={() => setElegidas(elegidas.size === fotos.length ? new Set() : new Set(fotos.map((f) => f.originalId)))}
            >
              {elegidas.size === fotos.length ? "Ninguna" : "Elegir todas"}
            </button>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {fotos.map((f) => (
              <TarjetaFoto
                key={f.originalId}
                foto={f}
                papel={papel}
                salida={estado.salida}
                elegida={elegidas.has(f.originalId)}
                ocupado={trabajando}
                error={errores.get(f.originalId) ?? null}
                onElegir={(v) =>
                  setElegidas((s) => {
                    const n = new Set(s);
                    if (v) n.add(f.originalId);
                    else n.delete(f.originalId);
                    return n;
                  })
                }
                onAbrir={() => void abrir(f)}
                onCantidad={(n) => void cambiarCantidad(f, n)}
                onQuitar={() => void quitar(f)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="fo-btn fo-btn-secondary" onClick={onCancelar}>
          Cancelar
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="fo-btn fo-btn-secondary" disabled={trabajando || fotos.length === 0 || todasArmadas} onClick={() => void armarHojas()}>
            <LayoutGrid className="size-4" aria-hidden />
            {armado ? `Armando ${armado.hechas} de ${armado.total}…` : todasArmadas ? "Hojas armadas" : "Armar hojas"}
          </button>
          <button
            type="button"
            className="fo-btn fo-btn-secondary"
            disabled={!todasArmadas || trabajando}
            onClick={() => window.open(`/imprimir/preparacion/${preparacionId}`, "_blank")}
          >
            <Printer className="size-4" aria-hidden />
            Imprimir todo
          </button>
          <button type="button" className="fo-btn fo-btn-primary" disabled={fotos.length === 0 || trabajando} onClick={() => void listo()}>
            <Check className="size-4" aria-hidden />
            Listo · {total} {total === 1 ? "copia" : "copias"}
          </button>
        </div>
      </div>
    </div>
  );
}
