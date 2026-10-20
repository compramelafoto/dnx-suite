"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { HOJAS, LADO_MINIMO_CM, MEDIDAS_CARNET, grillaDe } from "@/lib/foto-carnet/medidas";
import { AJUSTES_NEUTROS, type Ajustes as ValoresAjustes } from "@/lib/impresion/ajustes";
import type { SalidaVista } from "@/lib/impresion/configuracion";
import type { Receta } from "@/lib/impresion/receta";
import {
  asignarClienteAction,
  confirmarOriginalAction,
  crearPreparacionAction,
  estadoPreparacionAction,
  pedirSubidaOriginalAction,
  usarFotoAnteriorAction,
} from "@/app/(shell)/ventas/impresion/actions";
import { ClienteBuscador } from "@/app/(shell)/ventas/cliente-buscador";
import type { ClienteBuscado } from "@/app/(shell)/ventas/mostrador-actions";
import { Recorte, type PixelesRecorte } from "./recorte";
import { Ajustes } from "./ajustes";
import { VistaRecorte } from "./vistas";
import { FotosAnteriores } from "./fotos-anteriores";
import { PasoPlancha } from "./paso-plancha";
import { recetaDesdeEditor } from "./receta-desde-editor";

/** Igual que el servidor (`lib/impresion/almacen.ts`): 60 MB; HEIC se intenta. */
const TAMANO_MAXIMO_FOTO = 60 * 1024 * 1024;
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
/** El servidor acepta piezas de 20 a 100 mm por lado. */
const LADO_MAXIMO_CM = 10;

const PASOS = [
  { n: 1, titulo: "Foto y medida" },
  { n: 2, titulo: "Encuadre" },
  { n: 3, titulo: "Retoque" },
  { n: 4, titulo: "Plancha" },
] as const;
type Paso = (typeof PASOS)[number]["n"];

export type ModoEditorFotoCarnet =
  | { tipo: "suelto"; salidas: SalidaVista[] }
  | {
      tipo: "mostrador";
      preparacionId: string;
      clienteInicial: ClienteBuscado | null;
      /** La impresora y la hoja del producto del ticket (nombres, para mostrarlos en la plancha). */
      produccion: { salida: string; hoja: string };
      onListo: (r: { hojas: number; preparacionId: string }) => void;
      onCancelar: () => void;
    };

export type EditorFotoCarnetProps = {
  puedeBuscarClientes: boolean;
  /** Ya no se usa: el original se guarda solo en la ficha (lo hace el servidor). Se acepta para no romper a quien lo pasa. */
  puedeGuardarEnFicha?: boolean;
  puedeAltaCliente: boolean;
  modo: ModoEditorFotoCarnet;
};

type Original = { id: string; vista: { ancho: number; alto: number }; ancho: number; alto: number };
type OriginalProcesado = { originalId: string; ancho: number; alto: number; vistaAncho: number; vistaAlto: number };
/** Lo ya armado al reabrir una preparación del Mostrador: se muestra tal cual hasta que se vuelva a encuadrar. */
type PiezaGuardada = {
  pieza: { originalId: string; anchoMm: number; altoMm: number; receta: Receta };
  calidad: { ppp: number; aviso: "OK" | "BLANDA" | "PIXELADA" };
  hoja: { id: string; fotosPorHoja: number; copias: number } | null;
};

/** Error con un texto que se le puede mostrar a quien atiende. */
class ErrorVisible extends Error {}

/** El tipo de la foto; algunos navegadores dejan vacío el de las HEIC del iPhone. */
function tipoDeFoto(file: File): string | null {
  if (TIPOS_FOTO.includes(file.type)) return file.type;
  const nombre = file.name.toLowerCase();
  if (!file.type && nombre.endsWith(".heic")) return "image/heic";
  if (!file.type && nombre.endsWith(".heif")) return "image/heif";
  return null;
}

const cm = (n: number) => String(n).replace(".", ",");

/**
 * Foto carnet: el cliente trae o se saca la foto, acá se encuadra a la medida del trámite, se
 * retoca y el servidor arma la plancha desde el original. El navegador sólo guarda la RECETA
 * (encuadre en proporciones, giro y ajustes) y muestra una vista previa; nunca genera el archivo.
 * Sirve suelto (Ventas → Foto carnet) y dentro del Mostrador, atado a una preparación del ticket.
 */
export function EditorFotoCarnet({ puedeBuscarClientes, puedeAltaCliente, modo }: EditorFotoCarnetProps) {
  const [paso, setPaso] = useState<Paso>(1);
  const [preparacionId, setPreparacionId] = useState<string | null>(modo.tipo === "mostrador" ? modo.preparacionId : null);
  const [cliente, setCliente] = useState<ClienteBuscado | null>(modo.tipo === "mostrador" ? modo.clienteInicial : null);
  const [original, setOriginal] = useState<Original | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [errorCliente, setErrorCliente] = useState<string | null>(null);
  const [medida, setMedida] = useState({ anchoCm: 4, altoCm: 4 });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.1);
  const [giro90, setGiro90] = useState(0);
  const [enderezar, setEnderezar] = useState(0);
  const [cropPixels, setCropPixels] = useState<PixelesRecorte | null>(null);
  const [ajustes, setAjustes] = useState<ValoresAjustes>(AJUSTES_NEUTROS);
  const [guardada, setGuardada] = useState<PiezaGuardada | null>(null);
  /** En el Mostrador se lee primero lo ya armado ("Editar fotos" retoma donde quedó). */
  const [cargando, setCargando] = useState(modo.tipo === "mostrador");
  const inputRef = useRef<HTMLInputElement | null>(null);
  /** La preparación se crea una sola vez aunque se pida dos veces seguidas. */
  const creando = useRef<Promise<string> | null>(null);

  const imageSrc = original ? `/api/impresion/vista/${original.id}` : null;
  const rotacion = giro90 + enderezar;
  const medidaValida =
    medida.anchoCm >= LADO_MINIMO_CM && medida.altoCm >= LADO_MINIMO_CM && medida.anchoCm <= LADO_MAXIMO_CM && medida.altoCm <= LADO_MAXIMO_CM;
  const medidaElegida = MEDIDAS_CARNET.find((m) => m.anchoCm === medida.anchoCm && m.altoCm === medida.altoCm);
  const puedeSeguir = (paso === 1 && Boolean(original) && medidaValida && !subiendo) || (paso === 2 && Boolean(cropPixels)) || paso === 3;

  // Una sola vez al abrir: el editor se monta con `key={preparacionId}`.
  const preparacionInicial = modo.tipo === "mostrador" ? modo.preparacionId : null;
  useEffect(() => {
    if (!preparacionInicial) return;
    let vigente = true;
    estadoPreparacionAction(preparacionInicial)
      .then((e) => {
        if (!vigente) return;
        if (!e) return setErrorFoto("Esa preparación ya no existe. Cerrá y volvé a tocar «Preparar».");
        if (!e.original) return;
        setOriginal({ id: e.original.id, vista: { ancho: e.original.vistaAncho, alto: e.original.vistaAlto }, ancho: e.original.ancho, alto: e.original.alto });
        if (!e.pieza) return;
        setMedida({ anchoCm: e.pieza.anchoMm / 10, altoCm: e.pieza.altoMm / 10 });
        // Si se vuelve a encuadrar, arranca con el giro y los ajustes que tenía.
        setGiro90(e.pieza.receta.rotacion90);
        setEnderezar(e.pieza.receta.enderezar);
        setAjustes({ ...e.pieza.receta.ajustes });
        setGuardada({
          pieza: { originalId: e.original.id, anchoMm: e.pieza.anchoMm, altoMm: e.pieza.altoMm, receta: e.pieza.receta },
          calidad: { ppp: e.pieza.ppp, aviso: e.pieza.aviso },
          hoja: e.hoja,
        });
        // Con la plancha ya armada, abre en la plancha; si no, en la foto (con la pieza guardada a mano).
        if (e.hoja) setPaso(4);
      })
      .catch(() => {
        if (vigente) setErrorFoto("No se pudo leer lo ya preparado. Probá de nuevo.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [preparacionInicial]);

  /** Ir a un paso. Volver a encuadrar o retocar descarta lo guardado: la plancha se arma de nuevo. */
  function irAPaso(n: Paso) {
    if (n === 2 || n === 3) setGuardada(null);
    // Sin encuadre hecho en esta pantalla (se reabrió lo guardado), "Atrás" desde la plancha va al encuadre.
    setPaso(n === 3 && !cropPixels ? 2 : n);
  }

  function asegurarPreparacion(): Promise<string> {
    if (preparacionId) return Promise.resolve(preparacionId);
    creando.current ??= crearPreparacionAction({ productId: null, clientId: cliente?.id ?? null }).then((r) => {
      if (!r.ok) {
        creando.current = null;
        throw new ErrorVisible(r.error);
      }
      setPreparacionId(r.id);
      return r.id;
    });
    return creando.current;
  }

  function cambiarMedida(m: { anchoCm: number; altoCm: number }) {
    setMedida(m);
    setGuardada(null);
    // Con otra proporción el encuadre anterior ya no sirve: se rehace en el paso 2.
    setCropPixels(null);
  }

  function usarOriginal(o: OriginalProcesado) {
    setOriginal({ id: o.originalId, vista: { ancho: o.vistaAncho, alto: o.vistaAlto }, ancho: o.ancho, alto: o.alto });
    setCrop({ x: 0, y: 0 });
    setZoom(1.1);
    setGiro90(0);
    setEnderezar(0);
    setCropPixels(null);
    setAjustes(AJUSTES_NEUTROS);
    setGuardada(null);
  }

  /** Sube, confirma u obtiene el original con `traer`; los errores del servidor se muestran tal cual. */
  async function conOriginal(traer: (preparacionId: string) => Promise<({ ok: true } & OriginalProcesado) | { ok: false; error: string }>) {
    setErrorFoto(null);
    setSubiendo(true);
    try {
      const r = await traer(await asegurarPreparacion());
      if (!r.ok) return setErrorFoto(r.error);
      usarOriginal(r);
    } catch (e) {
      setErrorFoto(e instanceof ErrorVisible ? e.message : "No se pudo subir la foto. Probá de nuevo.");
    } finally {
      setSubiendo(false);
    }
  }

  function elegirFoto(file: File | undefined) {
    setErrorFoto(null);
    if (!file) return;
    const tipo = tipoDeFoto(file);
    if (!tipo) return setErrorFoto("La foto tiene que ser JPG, PNG, WebP o HEIC.");
    if (file.size > TAMANO_MAXIMO_FOTO) {
      return setErrorFoto(`La foto pesa ${(file.size / 1024 / 1024).toFixed(1)} MB: el máximo es 60 MB.`);
    }
    void conOriginal(async (id) => {
      const s = await pedirSubidaOriginalAction(id, { nombre: file.name, tipo, bytes: file.size });
      if (!s.ok) return s;
      const put = await fetch(s.url, { method: "PUT", headers: { "Content-Type": tipo }, body: file });
      if (!put.ok) throw new ErrorVisible("No se pudo subir la foto. Probá de nuevo.");
      return confirmarOriginalAction(s.originalId);
    });
  }

  async function cambiarCliente(c: ClienteBuscado | null) {
    setCliente(c);
    setErrorCliente(null);
    const id = preparacionId ?? (creando.current ? await creando.current.catch(() => null) : null);
    if (!id) return;
    const r = await asignarClienteAction(id, c?.id ?? null).catch(() => ({ ok: false as const, error: "No se pudo cambiar el cliente. Probá de nuevo." }));
    if (!r.ok) setErrorCliente(r.error);
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Pasos" className="flex flex-wrap gap-2">
        {PASOS.map((p) => {
          const alcanzable =
            p.n === 1 || (p.n === 2 && Boolean(original) && medidaValida) || (p.n > 2 && Boolean(cropPixels)) || (p.n === 4 && Boolean(guardada));
          return (
            <button
              key={p.n}
              type="button"
              disabled={!alcanzable}
              onClick={() => irAPaso(p.n)}
              aria-current={paso === p.n ? "step" : undefined}
              className={`rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-40 ${
                paso === p.n
                  ? "border-[var(--fo-accent)] bg-[var(--fo-accent)] text-[var(--fo-on-accent,#fff)]"
                  : "border-[var(--fo-border)] text-[var(--fo-text)] hover:border-[var(--fo-accent)]"
              }`}
            >
              {p.n}. {p.titulo}
            </button>
          );
        })}
      </nav>

      {cargando ? <p className="text-sm text-[var(--fo-muted)]">Buscando lo ya preparado…</p> : null}

      {paso === 1 && !cargando ? (
        <section className="fo-card space-y-5 p-5">
          {puedeBuscarClientes ? (
            <div className="space-y-3">
              <h2 className="text-base font-semibold">El cliente (opcional)</h2>
              <ClienteBuscador cliente={cliente} onElegir={(c) => void cambiarCliente(c)} puedeAlta={puedeAltaCliente} />
              {errorCliente ? <p className="fo-alert-error">{errorCliente}</p> : null}
              {cliente ? (
                <FotosAnteriores
                  clientId={cliente.id}
                  deshabilitado={subiendo}
                  onElegir={(adjuntoId) => void conOriginal((id) => usarFotoAnteriorAction(id, adjuntoId))}
                />
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3">
            <h2 className="text-base font-semibold">La foto</h2>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              className="hidden"
              onChange={(e) => {
                elegirFoto(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="fo-btn fo-btn-primary" disabled={subiendo} onClick={() => inputRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden />
                {subiendo ? "Subiendo la foto…" : original ? "Elegir otra foto" : "Elegir la foto"}
              </button>
            </div>
            <p className="text-xs text-[var(--fo-muted)]">
              JPG, PNG, WebP o HEIC de hasta 60 MB. El original se guarda en la ficha del cliente para la próxima vez.
            </p>
            {errorFoto ? <p className="fo-alert-error">{errorFoto}</p> : null}
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista previa privada del original, servida por nuestra ruta
              <img src={imageSrc} alt="La foto elegida" className="max-h-72 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)]" />
            ) : null}
          </div>

          <div className="space-y-3">
            <h2 className="text-base font-semibold">La medida del trámite</h2>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <label className="block">
                <span className="fo-label">Medidas más usadas</span>
                <select
                  className="fo-input"
                  value={medidaElegida ? `${medida.anchoCm}x${medida.altoCm}` : "otra"}
                  onChange={(e) => {
                    const m = MEDIDAS_CARNET.find((x) => `${x.anchoCm}x${x.altoCm}` === e.target.value);
                    if (m) cambiarMedida({ anchoCm: m.anchoCm, altoCm: m.altoCm });
                  }}
                >
                  {MEDIDAS_CARNET.map((m) => (
                    <option key={m.etiqueta} value={`${m.anchoCm}x${m.altoCm}`}>
                      {m.etiqueta} · entran {grillaDe(m, HOJAS[0]!).total} en una 10 × 15
                    </option>
                  ))}
                  <option value="otra">Otra medida</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="fo-label">Ancho (cm)</span>
                  <input
                    type="number"
                    min={LADO_MINIMO_CM}
                    max={LADO_MAXIMO_CM}
                    step={0.1}
                    className="fo-input"
                    value={medida.anchoCm}
                    onChange={(e) => cambiarMedida({ ...medida, anchoCm: Number(e.target.value) || 0 })}
                  />
                </label>
                <label className="block">
                  <span className="fo-label">Alto (cm)</span>
                  <input
                    type="number"
                    min={LADO_MINIMO_CM}
                    max={LADO_MAXIMO_CM}
                    step={0.1}
                    className="fo-input"
                    value={medida.altoCm}
                    onChange={(e) => cambiarMedida({ ...medida, altoCm: Number(e.target.value) || 0 })}
                  />
                </label>
              </div>
            </div>
            {!medidaValida ? (
              <p className="fo-alert-warning">
                Cada lado tiene que medir entre {LADO_MINIMO_CM} y {LADO_MAXIMO_CM} cm.
              </p>
            ) : null}
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Cómo sacar una buena foto carnet</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[var(--fo-muted)]">
              <li>Fondo liso y claro, ideal blanco o gris muy claro.</li>
              <li>Luz suave de frente, sin sombras duras ni luz de arriba que marque ojeras.</li>
              <li>Cámara a la altura de los ojos; rostro centrado, hombros derechos, mirando al lente.</li>
              <li>Expresión neutra, boca cerrada, sin filtros de belleza.</li>
              <li>Pelo despejado de la cara, sin reflejos en los anteojos. Si el trámite lo pide: sin gorra ni accesorios.</li>
            </ul>
          </details>
        </section>
      ) : null}

      {paso === 2 && imageSrc ? (
        <section className="fo-card space-y-4 p-5">
          <h2 className="text-base font-semibold">
            Encuadre · {cm(medida.anchoCm)} × {cm(medida.altoCm)} cm
          </h2>
          <Recorte
            imageSrc={imageSrc}
            crop={crop}
            zoom={zoom}
            giro90={giro90}
            enderezar={enderezar}
            aspect={medida.anchoCm / medida.altoCm}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onGiro90Change={setGiro90}
            onEnderezarChange={setEnderezar}
            onCropComplete={setCropPixels}
          />
        </section>
      ) : null}

      {paso === 3 && imageSrc && cropPixels ? (
        <section className="fo-card space-y-4 p-5">
          <h2 className="text-base font-semibold">Retoque</h2>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <VistaRecorte imageSrc={imageSrc} crop={cropPixels} rotacion={rotacion} ajustes={ajustes} medida={medida} />
            <Ajustes ajustes={ajustes} onChange={setAjustes} onRestablecer={() => setAjustes(AJUSTES_NEUTROS)} />
          </div>
        </section>
      ) : null}

      {paso === 4 && original && (guardada || cropPixels) && preparacionId ? (
        <section className="fo-card space-y-5 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">La plancha para imprimir</h2>
            {guardada ? (
              <button type="button" className="fo-btn fo-btn-secondary" onClick={() => irAPaso(2)}>
                Volver a encuadrar
              </button>
            ) : null}
          </div>
          <PasoPlancha
            modo={modo}
            preparacionId={preparacionId}
            pieza={
              guardada?.pieza ?? {
                originalId: original.id,
                anchoMm: Math.round(medida.anchoCm * 100) / 10,
                altoMm: Math.round(medida.altoCm * 100) / 10,
                receta: recetaDesdeEditor({ cropPx: cropPixels!, vista: original.vista, rotacion, ajustes }),
              }
            }
            inicial={guardada?.hoja ? { ...guardada.hoja, ...guardada.calidad } : null}
          />
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button type="button" className="fo-btn fo-btn-secondary" disabled={paso === 1} onClick={() => irAPaso(Math.max(1, paso - 1) as Paso)}>
            Atrás
          </button>
          {modo.tipo === "mostrador" ? (
            <button type="button" className="fo-btn fo-btn-secondary" onClick={modo.onCancelar}>
              Cancelar
            </button>
          ) : null}
        </div>
        {paso < 4 ? (
          <button type="button" className="fo-btn fo-btn-primary" disabled={!puedeSeguir} onClick={() => irAPaso(Math.min(4, paso + 1) as Paso)}>
            Siguiente
          </button>
        ) : null}
      </div>
    </div>
  );
}
