"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Download, ImagePlus, Save } from "lucide-react";
import {
  DPI_IMPRESION,
  HOJAS,
  LADO_MINIMO_CM,
  MARGEN_CM,
  MEDIDAS_CARNET,
  SEPARACION_CM,
  cmAPx,
  grillaDe,
  nombreDePlancha,
  type HojaImpresion,
} from "@/lib/foto-carnet/medidas";
import { subirAdjuntoConId } from "@/components/ficha/subir-adjunto";
import { ClienteBuscador } from "@/app/(shell)/ventas/cliente-buscador";
import type { ClienteBuscado } from "@/app/(shell)/ventas/mostrador-actions";
import { generarPlanchaJpeg, type AdjustmentSettings, type CropAreaPixels } from "./procesar";
import { Recorte } from "./recorte";
import { Ajustes } from "./ajustes";
import { VistaPlancha, VistaRecorte } from "./vistas";

const AJUSTES_INICIALES: AdjustmentSettings = {
  exposure: 0,
  contrast: 0,
  shadows: 0,
  blacks: 0,
  lights: 0,
  highlights: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  sharpen: 10,
  backgroundWhiten: 0,
  backgroundSmooth: 0,
};

/** La foto original no se sube a ningún lado: se procesa en el navegador. */
const TAMANO_MAXIMO_FOTO = 40 * 1024 * 1024;
const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"];

const PASOS = [
  { n: 1, titulo: "Foto y medida" },
  { n: 2, titulo: "Encuadre" },
  { n: 3, titulo: "Retoque" },
  { n: 4, titulo: "Plancha" },
] as const;
type Paso = (typeof PASOS)[number]["n"];

function descargar(blob: Blob, nombre: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Foto carnet en el mostrador: el cliente trae o se saca la foto, acá se encuadra a la medida
 * del trámite, se retoca y se arma la plancha para imprimir en una copia 10x15 o 13x18.
 */
export function EditorFotoCarnet({ puedeBuscarClientes, puedeGuardarEnFicha, puedeAltaCliente }: {
  puedeBuscarClientes: boolean;
  puedeGuardarEnFicha: boolean;
  puedeAltaCliente: boolean;
}) {
  const [paso, setPaso] = useState<Paso>(1);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [errorFoto, setErrorFoto] = useState<string | null>(null);
  const [medida, setMedida] = useState({ anchoCm: 4, altoCm: 4 });
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.1);
  const [rotation, setRotation] = useState(0);
  const [cropPixels, setCropPixels] = useState<CropAreaPixels | null>(null);
  const [settings, setSettings] = useState<AdjustmentSettings>(AJUSTES_INICIALES);
  const [hoja, setHoja] = useState<HojaImpresion>(HOJAS[0]!);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [cliente, setCliente] = useState<ClienteBuscado | null>(null);
  const [trabajando, setTrabajando] = useState<"descarga" | "guardado" | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "error"; texto: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // La URL local de la foto se libera al cambiarla o al salir.
  useEffect(() => () => void (imageSrc && URL.revokeObjectURL(imageSrc)), [imageSrc]);

  const medidaValida = medida.anchoCm >= LADO_MINIMO_CM && medida.altoCm >= LADO_MINIMO_CM;
  const entranComoMucho = useMemo(() => (medidaValida ? grillaDe(medida, hoja).total : 0), [medida, hoja, medidaValida]);
  const grilla = useMemo(
    () => grillaDe(medida, hoja, cantidad ?? undefined),
    [medida, hoja, cantidad],
  );
  const medidaElegida = MEDIDAS_CARNET.find((m) => m.anchoCm === medida.anchoCm && m.altoCm === medida.altoCm);

  // Si cambia la medida o la hoja y la cantidad pedida ya no entra, vuelve a "todas las que entran".
  useEffect(() => {
    if (cantidad !== null && cantidad > entranComoMucho) setCantidad(null);
  }, [cantidad, entranComoMucho]);

  const puedeSeguir = (paso === 1 && Boolean(imageSrc) && medidaValida) || (paso === 2 && Boolean(cropPixels)) || paso === 3;

  function elegirFoto(file: File | undefined) {
    setErrorFoto(null);
    if (!file) return;
    if (!TIPOS_FOTO.includes(file.type)) {
      setErrorFoto(
        file.name.toLowerCase().endsWith(".heic")
          ? "Las fotos HEIC del iPhone no se pueden abrir acá. Pedile al cliente que la mande como JPG (en WhatsApp sale así) o pasala a JPG."
          : "La foto tiene que ser JPG, PNG o WebP.",
      );
      return;
    }
    if (file.size > TAMANO_MAXIMO_FOTO) {
      setErrorFoto(`La foto pesa ${(file.size / 1024 / 1024).toFixed(1)} MB: el máximo es 40 MB.`);
      return;
    }
    setImageSrc(URL.createObjectURL(file));
    setCrop({ x: 0, y: 0 });
    setZoom(1.1);
    setRotation(0);
    setCropPixels(null);
    setSettings(AJUSTES_INICIALES);
    setAviso(null);
  }

  async function generar(): Promise<{ blob: Blob; nombre: string } | null> {
    if (!imageSrc || !cropPixels) return null;
    const blob = await generarPlanchaJpeg({
      imageSrc,
      crop: cropPixels,
      settings,
      rotation,
      grilla,
      config: {
        sheetWidthPx: cmAPx(hoja.anchoCm, DPI_IMPRESION),
        sheetHeightPx: cmAPx(hoja.altoCm, DPI_IMPRESION),
        photoWidthPx: cmAPx(medida.anchoCm, DPI_IMPRESION),
        photoHeightPx: cmAPx(medida.altoCm, DPI_IMPRESION),
        marginPx: cmAPx(MARGEN_CM, DPI_IMPRESION),
        gapPx: cmAPx(SEPARACION_CM, DPI_IMPRESION),
      },
    });
    return { blob, nombre: nombreDePlancha(medida, hoja, grilla.total, new Date(), cliente?.nombre) };
  }

  async function alDescargar() {
    setTrabajando("descarga");
    setAviso(null);
    try {
      const r = await generar();
      if (r) {
        descargar(r.blob, r.nombre);
        setAviso({ tipo: "ok", texto: `Listo: se descargó «${r.nombre}». Mandala a imprimir en una ${hoja.etiqueta.toLowerCase()}, sin ajustar al tamaño.` });
      }
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo generar la plancha. Probá de nuevo." });
    } finally {
      setTrabajando(null);
    }
  }

  async function alGuardar() {
    if (!cliente) return;
    setTrabajando("guardado");
    setAviso(null);
    try {
      const r = await generar();
      if (!r) return;
      const archivo = new File([r.blob], r.nombre, { type: "image/jpeg" });
      const subido = await subirAdjuntoConId({ tipo: "CLIENTE", id: cliente.id }, archivo, () => {});
      setAviso(
        subido.ok
          ? { tipo: "ok", texto: `Guardada en la ficha de ${cliente.nombre}, en «Adjuntos».` }
          : { tipo: "error", texto: subido.error },
      );
    } catch {
      setAviso({ tipo: "error", texto: "No se pudo guardar la plancha. Probá de nuevo." });
    } finally {
      setTrabajando(null);
    }
  }

  return (
    <div className="space-y-5">
      <nav aria-label="Pasos" className="flex flex-wrap gap-2">
        {PASOS.map((p) => {
          const alcanzable = p.n === 1 || (p.n === 2 && Boolean(imageSrc) && medidaValida) || (p.n > 2 && Boolean(cropPixels));
          return (
            <button
              key={p.n}
              type="button"
              disabled={!alcanzable}
              onClick={() => setPaso(p.n)}
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

      {paso === 1 ? (
        <section className="fo-card space-y-5 p-5">
          <div className="space-y-3">
            <h2 className="text-base font-semibold">La foto</h2>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                elegirFoto(e.target.files?.[0]);
                e.currentTarget.value = "";
              }}
            />
            <div className="flex flex-wrap gap-2">
              <button type="button" className="fo-btn fo-btn-primary" onClick={() => inputRef.current?.click()}>
                <ImagePlus className="size-4" aria-hidden />
                {imageSrc ? "Elegir otra foto" : "Elegir la foto"}
              </button>
            </div>
            {errorFoto ? <p className="fo-alert-error">{errorFoto}</p> : null}
            {imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- vista local (blob:) de la foto elegida
              <img src={imageSrc} alt="La foto elegida" className="max-h-72 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)]" />
            ) : (
              <p className="text-xs text-[var(--fo-muted)]">
                JPG, PNG o WebP de hasta 40 MB. La foto no se sube a ningún lado: se trabaja en esta computadora.
              </p>
            )}
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
                    if (m) setMedida({ anchoCm: m.anchoCm, altoCm: m.altoCm });
                  }}
                >
                  {MEDIDAS_CARNET.map((m) => (
                    <option key={m.etiqueta} value={`${m.anchoCm}x${m.altoCm}`}>
                      {m.etiqueta} · entran {grillaDe(m, hoja).total} en una {hoja.etiqueta.toLowerCase()}
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
                    step={0.1}
                    className="fo-input"
                    value={medida.anchoCm}
                    onChange={(e) => setMedida((m) => ({ ...m, anchoCm: Number(e.target.value) || 0 }))}
                  />
                </label>
                <label className="block">
                  <span className="fo-label">Alto (cm)</span>
                  <input
                    type="number"
                    min={LADO_MINIMO_CM}
                    step={0.1}
                    className="fo-input"
                    value={medida.altoCm}
                    onChange={(e) => setMedida((m) => ({ ...m, altoCm: Number(e.target.value) || 0 }))}
                  />
                </label>
              </div>
            </div>
            {!medidaValida ? <p className="fo-alert-warning">Cada lado tiene que medir al menos {LADO_MINIMO_CM} cm.</p> : null}
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
            Encuadre · {String(medida.anchoCm).replace(".", ",")} × {String(medida.altoCm).replace(".", ",")} cm
          </h2>
          <Recorte
            imageSrc={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={medida.anchoCm / medida.altoCm}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onRotationChange={setRotation}
            onCropComplete={setCropPixels}
          />
        </section>
      ) : null}

      {paso === 3 && imageSrc && cropPixels ? (
        <section className="fo-card space-y-4 p-5">
          <h2 className="text-base font-semibold">Retoque</h2>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
            <VistaRecorte imageSrc={imageSrc} crop={cropPixels} rotation={rotation} settings={settings} medida={medida} />
            <Ajustes settings={settings} onChange={setSettings} onReset={() => setSettings(AJUSTES_INICIALES)} />
          </div>
        </section>
      ) : null}

      {paso === 4 && imageSrc && cropPixels ? (
        <section className="fo-card space-y-5 p-5">
          <h2 className="text-base font-semibold">La plancha para imprimir</h2>
          <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <VistaPlancha
              imageSrc={imageSrc}
              crop={cropPixels}
              rotation={rotation}
              settings={settings}
              medida={medida}
              hoja={hoja}
              grilla={grilla}
            />
            <div className="space-y-4">
              <label className="block">
                <span className="fo-label">Se imprime en</span>
                <select className="fo-input" value={hoja.clave} onChange={(e) => setHoja(HOJAS.find((h) => h.clave === e.target.value) ?? HOJAS[0]!)}>
                  {HOJAS.map((h) => (
                    <option key={h.clave} value={h.clave}>
                      {h.etiqueta}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="fo-label">Cantidad de fotos</span>
                <select
                  className="fo-input"
                  value={cantidad ?? "todas"}
                  onChange={(e) => setCantidad(e.target.value === "todas" ? null : Number(e.target.value))}
                >
                  <option value="todas">Todas las que entran ({entranComoMucho})</option>
                  {Array.from({ length: Math.max(0, entranComoMucho - 1) }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs leading-relaxed text-[var(--fo-muted)]">
                {grilla.total} fotos de {String(medida.anchoCm).replace(".", ",")} × {String(medida.altoCm).replace(".", ",")} cm ({grilla.cols}{" "}
                columnas × {grilla.rows} filas), con guías grises para cortar. El archivo sale en JPG a {DPI_IMPRESION} dpi: imprimilo
                en tamaño real, sin «ajustar a la página».
              </p>

              <button type="button" className="fo-btn fo-btn-primary w-full" disabled={trabajando !== null} onClick={() => void alDescargar()}>
                <Download className="size-4" aria-hidden />
                {trabajando === "descarga" ? "Preparando…" : "Descargar para imprimir"}
              </button>

              {puedeGuardarEnFicha && puedeBuscarClientes ? (
                <div className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
                  <p className="text-sm font-medium">Guardarla en la ficha del cliente (opcional)</p>
                  <p className="text-xs text-[var(--fo-muted)]">Queda en sus «Adjuntos» para volver a imprimirla otro día.</p>
                  <ClienteBuscador cliente={cliente} onElegir={setCliente} puedeAlta={puedeAltaCliente} />
                  <button
                    type="button"
                    className="fo-btn fo-btn-secondary w-full"
                    disabled={!cliente || trabajando !== null}
                    onClick={() => void alGuardar()}
                  >
                    <Save className="size-4" aria-hidden />
                    {trabajando === "guardado" ? "Guardando…" : "Guardar en la ficha"}
                  </button>
                </div>
              ) : null}

              {aviso ? (
                <p className={aviso.tipo === "ok" ? "fo-alert-success flex gap-2" : "fo-alert-error"}>
                  {aviso.tipo === "ok" ? <Check className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
                  {aviso.texto}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button type="button" className="fo-btn fo-btn-secondary" disabled={paso === 1} onClick={() => setPaso((p) => Math.max(1, p - 1) as Paso)}>
          Atrás
        </button>
        {paso < 4 ? (
          <button type="button" className="fo-btn fo-btn-primary" disabled={!puedeSeguir} onClick={() => setPaso((p) => Math.min(4, p + 1) as Paso)}>
            Siguiente
          </button>
        ) : null}
      </div>
    </div>
  );
}
