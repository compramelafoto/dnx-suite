"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ImagePlus } from "lucide-react";
import { cambiarModo } from "@/lib/impresion/encuadre";
import { CANTIDAD_MAX_LAB, FOTOS_MAX_LAB, type OpcionesLab, type PapelLab, type PlazoLab } from "@/lib/impresion/laboratorio";
import {
  TEXTO_PAPEL,
  TEXTO_PLAZO,
  acotarCantidadLab,
  aplicarGuardadoLab,
  calidadLab,
  cambiosLab,
  papelDeMedida,
  piezaNueva,
  piezasFaltantes,
  plazoParaMedida,
  resumenPorGrupo,
  valoresIniciales,
  type CambioLab,
  type FotoLabVista,
  type PiezaLabAGuardar,
  type ValoresLab,
} from "@/lib/impresion/lote-laboratorio";
import { SUBIDAS_A_LA_VEZ, conLimite, validarArchivoFoto } from "@/lib/impresion/subidas";
import type { FotoLab } from "@/lib/impresion/laboratorio-servidor";
import {
  confirmarOriginalAction,
  estadoLaboratorioAction,
  guardarPiezasLaboratorioAction,
  listoLaboratorioAction,
  pedirSubidaOriginalAction,
  quitarFotoLaboratorioAction,
} from "@/app/(shell)/ventas/impresion/actions";
import { EditorUnaFoto } from "./editor-una-foto";
import { TarjetaFotoLab } from "./tarjeta-foto-lab";

/** Un renglón para el ticket del Mostrador (precio en centavos). */
export type RenglonTicketLab = { productId: string; nombre: string; cantidad: number; precioUnitarioMinor: number };

/** Error con un texto que se le puede mostrar a quien atiende. */
class ErrorVisible extends Error {}

const aVista = (f: FotoLab): FotoLabVista => ({
  originalId: f.originalId,
  nombre: f.nombre,
  ancho: f.ancho,
  alto: f.alto,
  pieza: f.pieza
    ? { medida: f.pieza.medida, plazo: f.pieza.plazo, papel: f.pieza.papel, cantidad: f.pieza.cantidad, receta: f.pieza.receta, revisada: f.pieza.revisada }
    : null,
});

/**
 * Pedido para laboratorio: se suben muchas fotos, cada una llega con los valores de «Para las
 * fotos nuevas» (medida, plazo, papel, copias) y la propuesta automática de recorte; se cambian
 * en lote o de a una, y «Listo» devuelve los renglones del ticket (con precio) que arma el
 * servidor desde lo guardado, no desde la pantalla. No arma hojas: el laboratorio imprime.
 */
export function EditorLaboratorio({
  preparacionId,
  onListo,
  onCerrar,
}: {
  preparacionId: string;
  onListo: (renglones: RenglonTicketLab[]) => void;
  onCerrar: () => void;
}) {
  const [fotos, setFotos] = useState<FotoLabVista[]>([]);
  const [opciones, setOpciones] = useState<OpcionesLab | null>(null);
  const [nuevas, setNuevas] = useState<ValoresLab | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorListo, setErrorListo] = useState<string | null>(null);
  const [avisosSubida, setAvisosSubida] = useState<string[]>([]);
  const [subida, setSubida] = useState<{ hechas: number; total: number } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [elegidas, setElegidas] = useState<Set<string>>(new Set());
  const [lote, setLote] = useState<CambioLab>({});
  const [abierta, setAbierta] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  // Los valores de las fotos nuevas se leen al terminar cada subida (pueden cambiar mientras sube).
  const nuevasRef = useRef<ValoresLab | null>(null);
  useEffect(() => {
    nuevasRef.current = nuevas;
  }, [nuevas]);

  useEffect(() => {
    let vigente = true;
    estadoLaboratorioAction(preparacionId)
      .then((e) => {
        if (!vigente) return;
        if (!e) {
          setError("Ese pedido ya no existe. Cerrá y volvé a empezar.");
          return;
        }
        setFotos(e.fotos.map(aVista));
        setOpciones(e.opciones);
        setNuevas(valoresIniciales(e.opciones));
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

  const trabajando = ocupado || subida !== null;
  const totalCopias = fotos.reduce((s, f) => s + (f.pieza?.cantidad ?? 0), 0);

  async function guardar(items: PiezaLabAGuardar[]): Promise<boolean> {
    if (items.length === 0) return true;
    try {
      const r = await guardarPiezasLaboratorioAction(preparacionId, items);
      if (!r.ok) {
        setError(r.error);
        return false;
      }
    } catch {
      setError("No se pudo guardar. Revisá la conexión y probá de nuevo.");
      return false;
    }
    setError(null);
    setErrorListo(null);
    setFotos((fs) => aplicarGuardadoLab(fs, items));
    return true;
  }

  /** Una foto: pedir la subida, subirla directo a R2, confirmarla y guardarle su pieza con los valores de las fotos nuevas. */
  async function subirUna(file: File, tipo: string): Promise<void> {
    const s = await pedirSubidaOriginalAction(preparacionId, { nombre: file.name, tipo, bytes: file.size });
    if (!s.ok) throw new ErrorVisible(s.error);
    const put = await fetch(s.url, { method: "PUT", headers: { "Content-Type": tipo }, body: file });
    if (!put.ok) throw new ErrorVisible("No se pudo subir. Probá de nuevo.");
    const c = await confirmarOriginalAction(s.originalId);
    if (!c.ok) throw new ErrorVisible(c.error);
    const base: FotoLabVista = { originalId: c.originalId, nombre: file.name, ancho: c.ancho, alto: c.alto, pieza: null };
    // La foto ya está subida: aparece en la grilla aunque falle guardar su pieza (se completa al abrirla o en «Listo»).
    setFotos((fs) => [...fs, base]);
    const v = nuevasRef.current;
    const pieza = v ? piezaNueva(base, v) : null;
    if (!pieza) return;
    const g = await guardarPiezasLaboratorioAction(preparacionId, [pieza]);
    if (!g.ok) throw new ErrorVisible(g.error);
    setFotos((fs) => aplicarGuardadoLab(fs, [pieza]));
  }

  async function subir(lista: File[]) {
    if (!opciones || lista.length === 0) return;
    const avisos: string[] = [];
    const validos: { file: File; tipo: string }[] = [];
    const lugar = FOTOS_MAX_LAB - fotos.length;
    for (const file of lista) {
      const v = validarArchivoFoto(file);
      if (!v.ok) avisos.push(`${file.name}: ${v.error}`);
      else if (validos.length >= lugar) avisos.push(`${file.name}: un pedido para laboratorio admite hasta ${FOTOS_MAX_LAB} fotos.`);
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

  async function aplicarLote() {
    if (!opciones) return;
    setOcupado(true);
    const ok = await guardar(cambiosLab(fotos, elegidas, lote, opciones));
    setOcupado(false);
    if (ok) setLote({});
  }

  async function quitar(f: FotoLabVista) {
    if (!confirm(`¿Quitar «${f.nombre}» del pedido?`)) return;
    setOcupado(true);
    try {
      const r = await quitarFotoLaboratorioAction(preparacionId, f.originalId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setFotos((fs) => fs.filter((x) => x.originalId !== f.originalId));
      setElegidas((s) => {
        const n = new Set(s);
        n.delete(f.originalId);
        return n;
      });
      setErrorListo(null);
    } catch {
      setError("No se pudo quitar la foto. Probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  /** Una foto sin pieza (falló el guardado al subirla) recibe antes los valores de las fotos nuevas. */
  async function abrir(f: FotoLabVista) {
    if (trabajando) return;
    if (!f.pieza) {
      if (!nuevas) return;
      setOcupado(true);
      const ok = await guardar(piezasFaltantes([f], nuevas));
      setOcupado(false);
      if (!ok) return;
    }
    setAbierta(f.originalId);
  }

  /** «Listo»: completa las fotos sin pieza y pide al servidor los renglones del ticket. */
  async function listo() {
    if (fotos.length === 0 || trabajando) return;
    if (fotos.some((f) => f.pieza && calidadLab(f, f.pieza)?.aviso === "PIXELADA") && !confirm("Hay fotos que se van a ver pixeladas. ¿Mandarlas igual?")) return;
    setOcupado(true);
    setErrorListo(null);
    try {
      if (nuevas && !(await guardar(piezasFaltantes(fotos, nuevas)))) return;
      const r = await listoLaboratorioAction(preparacionId);
      if (!r.ok) {
        setErrorListo(r.error);
        return;
      }
      onListo(r.renglones);
    } catch {
      setErrorListo("No se pudo confirmar el pedido. Revisá la conexión y probá de nuevo.");
    } finally {
      setOcupado(false);
    }
  }

  if (cargando) return <p className="text-sm text-[var(--fo-muted)]">Buscando lo ya preparado…</p>;
  if (!opciones) {
    return (
      <div className="space-y-3">
        <p className="fo-alert-error">{error ?? "No se pudo abrir el pedido."}</p>
        <button type="button" className="fo-btn fo-btn-secondary" onClick={onCerrar}>
          <ArrowLeft className="size-4" aria-hidden />
          Volver
        </button>
      </div>
    );
  }

  const indice = abierta ? fotos.findIndex((f) => f.originalId === abierta) : -1;
  const actual = indice >= 0 ? fotos[indice] : undefined;
  const piezaActual = actual?.pieza;
  const papelActual = piezaActual ? papelDeMedida(piezaActual.medida) : null;
  if (actual && piezaActual && papelActual) {
    const calidad = calidadLab(actual, piezaActual) ?? { ppp: 0, aviso: "OK" as const };
    return (
      <div className="space-y-4">
        {error ? <p className="fo-alert-error">{error}</p> : null}
        <p className="text-sm text-[var(--fo-muted)]">
          {piezaActual.medida} · {TEXTO_PAPEL[piezaActual.papel]} · {TEXTO_PLAZO[piezaActual.plazo]}
        </p>
        <EditorUnaFoto
          key={actual.originalId}
          foto={{ ...actual, pieza: { receta: piezaActual.receta, cantidad: piezaActual.cantidad, revisada: piezaActual.revisada, ...calidad }, hoja: null }}
          papel={papelActual}
          indice={indice}
          total={fotos.length}
          cantidadMax={CANTIDAD_MAX_LAB}
          onGuardar={({ receta, cantidad, revisada }) =>
            guardar([{ originalId: actual.originalId, medida: piezaActual.medida, plazo: piezaActual.plazo, papel: piezaActual.papel, receta, cantidad, revisada }])
          }
          onIr={(d) => setAbierta(fotos[indice + d]?.originalId ?? null)}
          onPegarATodas={({ modo, cantidad }) => {
            // Cada foto cambia de modo sobre su propia medida; la cantidad va a todas.
            const n = acotarCantidadLab(cantidad);
            const items: PiezaLabAGuardar[] = [];
            for (const f of fotos) {
              const papel = f.pieza ? papelDeMedida(f.pieza.medida) : null;
              if (!f.pieza || !papel) continue;
              const receta = cambiarModo(f.pieza.receta, modo, { foto: { ancho: f.ancho, alto: f.alto }, papel });
              if (receta === f.pieza.receta && n === f.pieza.cantidad) continue;
              items.push({ ...f.pieza, originalId: f.originalId, cantidad: n, receta, revisada: false });
            }
            setOcupado(true);
            void guardar(items).finally(() => setOcupado(false));
          }}
          onCerrar={() => setAbierta(null)}
        />
      </div>
    );
  }

  const resumen = resumenPorGrupo(fotos, opciones);
  const plazosDelLote: PlazoLab[] = lote.medida
    ? (opciones.medidas.find((m) => m.medida === lote.medida)?.plazos ?? [])
    : (["MANANA", "SEMANA"] as PlazoLab[]).filter((p) => opciones.medidas.some((m) => m.plazos.includes(p)));
  const loteVacio = Object.values(lote).every((x) => x === undefined);

  return (
    <div className="space-y-5">
      {error ? <p className="fo-alert-error">{error}</p> : null}

      <section
        className={`fo-card space-y-3 p-5 ${arrastrando ? "ring-2 ring-[var(--fo-accent)]" : ""}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          if (trabajando || !nuevas) return;
          void subir(Array.from(e.dataTransfer.files));
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Pedido para laboratorio</h2>
            <p className="text-xs text-[var(--fo-muted)]">
              {fotos.length} {fotos.length === 1 ? "foto" : "fotos"} · {totalCopias} {totalCopias === 1 ? "copia" : "copias"}
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
          <button
            type="button"
            className="fo-btn fo-btn-primary"
            disabled={trabajando || !nuevas || fotos.length >= FOTOS_MAX_LAB}
            onClick={() => inputRef.current?.click()}
          >
            <ImagePlus className="size-4" aria-hidden />
            {subida ? `Subiendo ${subida.hechas} de ${subida.total}…` : "Agregar fotos"}
          </button>
        </div>

        {nuevas ? (
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <span className="pb-1.5 font-medium">Para las fotos nuevas:</span>
            <Selectores opciones={opciones} valores={nuevas} sinCambiar={false} onCambio={(c) => setNuevas((v) => (v ? completar(v, c, opciones) : v))} />
          </div>
        ) : (
          <p className="fo-alert-warning text-sm">
            No hay copias para laboratorio en el catálogo (productos «Copia para mañana» o «Copia próxima semana», o falta habilitar un papel).
            Cargalas en el catálogo para poder armar el pedido.
          </p>
        )}

        <p className="text-xs text-[var(--fo-muted)]">
          Arrastrá las fotos acá o tocá «Agregar fotos». JPG, PNG o WebP de hasta 60 MB, hasta {FOTOS_MAX_LAB} fotos. Cada foto llega con los
          valores de arriba y un recorte propuesto: tocala para moverla, girarla o encajarla.
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
          <div className="flex flex-wrap items-end gap-2 text-sm">
            <span className="pb-1.5 font-medium">
              {elegidas.size > 0 ? `A ${elegidas.size === 1 ? "la elegida" : `las ${elegidas.size} elegidas`}:` : "A todas:"}
            </span>
            <Selectores opciones={opciones} valores={lote} plazos={plazosDelLote} sinCambiar onCambio={(c) =>
                setLote((l) => {
                  const n = { ...l, ...c };
                  // Un plazo que la medida elegida no ofrece vuelve a «sin cambiar».
                  if (n.medida && n.plazo && !opciones.medidas.find((m) => m.medida === n.medida)?.plazos.includes(n.plazo)) n.plazo = undefined;
                  return n;
                })
              } />
            <button type="button" className="fo-btn fo-btn-secondary h-8 px-3 text-xs" disabled={trabajando || loteVacio} onClick={() => void aplicarLote()}>
              Aplicar
            </button>
            <button
              type="button"
              className="ml-auto pb-1.5 text-xs underline"
              onClick={() => setElegidas(elegidas.size === fotos.length ? new Set() : new Set(fotos.map((f) => f.originalId)))}
            >
              {elegidas.size === fotos.length ? "Ninguna" : "Elegir todas"}
            </button>
          </div>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {fotos.map((f) => (
              <TarjetaFotoLab
                key={f.originalId}
                foto={f}
                elegida={elegidas.has(f.originalId)}
                ocupado={trabajando}
                onElegir={(v) =>
                  setElegidas((s) => {
                    const n = new Set(s);
                    if (v) n.add(f.originalId);
                    else n.delete(f.originalId);
                    return n;
                  })
                }
                onAbrir={() => void abrir(f)}
                onQuitar={() => void quitar(f)}
              />
            ))}
          </ul>
        </section>
      ) : null}

      <section className="fo-card space-y-3 p-5">
        {resumen.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {resumen.map((g) => (
              <li key={`${g.medida}|${g.papel}|${g.plazo}`} className="flex justify-between gap-3">
                <span>
                  {g.medida} · {TEXTO_PAPEL[g.papel]} · {TEXTO_PLAZO[g.plazo]}
                </span>
                <span className="text-[var(--fo-muted)]">
                  {g.copias} {g.copias === 1 ? "copia" : "copias"} ({g.fotos} {g.fotos === 1 ? "foto" : "fotos"})
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">Todavía no hay fotos en el pedido.</p>
        )}
        <p className="text-xs text-[var(--fo-muted)]">El precio en pesos aparece en el ticket al tocar «Listo».</p>
        {errorListo ? (
          <p className="fo-alert-error" role="alert">
            {errorListo}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" className="fo-btn fo-btn-secondary" disabled={trabajando} onClick={onCerrar}>
            <ArrowLeft className="size-4" aria-hidden />
            Volver al ticket
          </button>
          <button type="button" className="fo-btn fo-btn-primary" disabled={fotos.length === 0 || trabajando} onClick={() => void listo()}>
            <Check className="size-4" aria-hidden />
            {ocupado ? "Un momento…" : `Listo · ${totalCopias} ${totalCopias === 1 ? "copia" : "copias"}`}
          </button>
        </div>
      </section>
    </div>
  );
}

/** Los valores de las fotos nuevas tras un cambio: si la medida nueva no ofrece el plazo, el que tenga. */
function completar(v: ValoresLab, c: CambioLab, opciones: OpcionesLab): ValoresLab {
  const medida = c.medida ?? v.medida;
  const plazo = plazoParaMedida(opciones, medida, c.plazo ?? v.plazo) ?? v.plazo;
  return { medida, plazo, papel: c.papel ?? v.papel, cantidad: c.cantidad === undefined ? v.cantidad : acotarCantidadLab(c.cantidad) };
}

/**
 * Los cuatro selectores (medida · plazo · papel · copias). Con `sinCambiar`, cada uno puede quedar
 * en «sin cambiar» (para el cambio en lote).
 */
function Selectores({
  opciones,
  valores,
  plazos,
  sinCambiar,
  onCambio,
}: {
  opciones: OpcionesLab;
  valores: CambioLab;
  plazos?: PlazoLab[];
  sinCambiar: boolean;
  onCambio: (c: CambioLab) => void;
}) {
  const listaPlazos = plazos ?? opciones.medidas.find((m) => m.medida === valores.medida)?.plazos ?? [];
  const clase = "fo-input h-8 w-auto py-0 text-xs";
  const vacio = sinCambiar ? <option value="">Sin cambiar</option> : null;
  return (
    <>
      <label className="text-xs">
        <span className="block text-[var(--fo-muted)]">Tamaño</span>
        <select className={clase} value={valores.medida ?? ""} onChange={(e) => onCambio({ medida: e.target.value || undefined })}>
          {vacio}
          {opciones.medidas.map((m) => (
            <option key={m.medida} value={m.medida}>
              {m.medida}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="block text-[var(--fo-muted)]">Para cuándo</span>
        <select className={clase} value={valores.plazo ?? ""} onChange={(e) => onCambio({ plazo: (e.target.value || undefined) as PlazoLab | undefined })}>
          {vacio}
          {listaPlazos.map((p) => (
            <option key={p} value={p}>
              {TEXTO_PLAZO[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="block text-[var(--fo-muted)]">Papel</span>
        <select className={clase} value={valores.papel ?? ""} onChange={(e) => onCambio({ papel: (e.target.value || undefined) as PapelLab | undefined })}>
          {vacio}
          {opciones.papeles.map((p) => (
            <option key={p} value={p}>
              {TEXTO_PAPEL[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs">
        <span className="block text-[var(--fo-muted)]">Copias</span>
        <input
          key={valores.cantidad ?? "sin"}
          type="number"
          min={1}
          max={CANTIDAD_MAX_LAB}
          placeholder={sinCambiar ? "—" : undefined}
          defaultValue={valores.cantidad ?? ""}
          onBlur={(e) => {
            const t = e.target.value.trim();
            onCambio({ cantidad: t === "" && sinCambiar ? undefined : acotarCantidadLab(Number(t)) });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="fo-input h-8 w-16 py-0 text-xs"
        />
      </label>
    </>
  );
}
