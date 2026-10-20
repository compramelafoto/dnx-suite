"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, MapPin, Minus, Plus, Printer, Store, Trash2, TriangleAlert, X } from "lucide-react";
import { BuscarDireccion, type DireccionElegida } from "@/components/impresiones/buscar-direccion";
import { EditorRecorte } from "@/components/impresiones/editor-recorte";
import { ETIQUETA_PAPEL, PPP_MINIMO, type Papel } from "@/lib/impresiones/constantes";
import { cotizarEnvio, type Punto } from "@/lib/impresiones/envio";
import { cotizar, type LineaCarrito } from "@/lib/impresiones/precios";
import { coincideProporcion, pppDelRecorte, recorteInicial, type Recorte } from "@/lib/impresiones/recorte";

/** La foto tal como viaja al navegador: sin la clave del original. */
type Foto = { id: string; nombre: string; mini: string; width: number | null; height: number | null };
/** De dónde salen las fotos (carpeta o galería). Es la `Fuente` del servidor (`fuentes-servidor.ts`) sin datos internos. */
export type FuenteCliente = { tipo: "CARPETA" | "GALERIA"; fotos: Foto[] };
/** El envío que ofrece el estudio, para mostrar el costo. El que vale lo recalcula el servidor al pagar. */
export type EnvioCliente = { baseCents: number; porKmCents: number; maxKm: number | null; estudio: Punto };
export type ResultadoPagar = { ok: true; checkoutUrl: string; pedidoId: string } | { ok: false; error: string };
type Tamano = { id: string; widthCm: number; heightCm: number; priceCents: number };
/** `recorte: null` = automático (centrado, lo más grande posible). */
type Copia = { id: string; sizeId: string; quantity: number; recorte: Recorte | null };
type Paso = "elegir" | "recorte" | "datos";
type Entrega = "RETIRO" | "ENVIO";
type Medidas = { w: number; h: number };

const MAX_CANTIDAD = 99;
const ENTERO = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const CON_CENTAVOS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 2 });
const plata = (cents: number) => (cents % 100 === 0 ? ENTERO : CON_CENTAVOS).format(cents / 100);
const cm = (n: number) => String(n).replace(".", ",");
const nombreTamano = (t: Tamano) => `${cm(t.widthCm)}x${cm(t.heightCm)}`;
let siguiente = 0;
const nuevoId = () => `c${++siguiente}`;

/** Mide una imagen en el navegador (la miniatura conserva la proporción de la foto). */
function medir(src: string): Promise<Medidas | null> {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok(img.naturalWidth > 0 && img.naturalHeight > 0 ? { w: img.naturalWidth, h: img.naturalHeight } : null);
    img.onerror = () => ok(null);
    img.src = src;
  });
}

/**
 * Pantalla del cliente para pedir copias impresas, común a la carpeta de archivos y a la galería: elegir fotos y
 * tamaños, revisar el encuadre, sus datos, cómo recibirlas (retiro o envío) y pagar. `pagar` es la acción del
 * servidor ya atada al enlace (slug y token): allá se vuelve a validar y calcular todo.
 */
export function PedidoCliente({
  fuente,
  pagar: pagarAccion,
  estudio,
  volver,
  tamanos,
  papeles,
  envio,
  cliente,
  plazo,
}: {
  fuente: FuenteCliente;
  pagar: (datos: unknown) => Promise<ResultadoPagar>;
  estudio: string;
  volver: { href: string; texto: string };
  tamanos: Tamano[];
  papeles: Papel[];
  envio: EnvioCliente | null;
  cliente: { nombre: string; email: string; telefono: string };
  plazo: string;
}) {
  const fotos = fuente.fotos;
  const [paso, setPaso] = useState<Paso>("elegir");
  const [copias, setCopias] = useState<Record<string, Copia[]>>({});
  const [papel, setPapel] = useState<Papel>(papeles[0]);
  const [abierta, setAbierta] = useState<number | null>(null);
  // Proporción vista en el navegador, para las fotos que el servidor todavía no midió.
  const [medidasVistas, setMedidasVistas] = useState<Record<string, Medidas>>({});
  const [todasTam, setTodasTam] = useState(tamanos[0]?.id ?? "");
  const [todasCant, setTodasCant] = useState(1);
  const [nombre, setNombre] = useState(cliente.nombre);
  const [email, setEmail] = useState(cliente.email);
  const [telefono, setTelefono] = useState(cliente.telefono);
  const [entrega, setEntrega] = useState<Entrega>("RETIRO");
  const [direccion, setDireccion] = useState<DireccionElegida | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [midiendo, setMidiendo] = useState(false);
  const [pagando, empezar] = useTransition();
  const titulo = useRef<HTMLHeadingElement>(null);

  const tamPorId = useMemo(() => new Map(tamanos.map((t) => [t.id, t])), [tamanos]);

  /** Medidas reales (del servidor) o, si no hay, las de la miniatura. */
  const medidasDe = (f: Foto): Medidas | null =>
    f.width && f.height ? { w: f.width, h: f.height } : (medidasVistas[f.id] ?? null);
  const anotarMedidas = (archivoId: string, img: HTMLImageElement) => {
    if (img.naturalWidth > 0 && img.naturalHeight > 0 && !medidasVistas[archivoId]) {
      setMedidasVistas((m) => (m[archivoId] ? m : { ...m, [archivoId]: { w: img.naturalWidth, h: img.naturalHeight } }));
    }
  };

  const recorteDe = (f: Foto, c: Copia): Recorte => {
    const m = medidasDe(f);
    const t = tamPorId.get(c.sizeId);
    if (c.recorte) return c.recorte;
    if (!m || !t) return { x: 0, y: 0, w: 1, h: 1 };
    return recorteInicial(m.w, m.h, t.widthCm, t.heightCm);
  };

  // Para mostrar: el total de verdad lo calcula el servidor al pagar.
  const lineas: LineaCarrito[] = fotos.flatMap((f) =>
    (copias[f.id] ?? []).map((c) => ({ archivoId: f.id, sizeId: c.sizeId, quantity: c.quantity, recorte: recorteDe(f, c) })),
  );
  const cot = lineas.length > 0 ? cotizar(lineas, tamanos.map((t) => ({ ...t, proveedorId: null, costCents: 0 }))) : null;
  const subtotalCents = cot && !("error" in cot) ? cot.subtotalCents : 0;
  const totalCopias = cot && !("error" in cot) ? cot.copias : 0;
  const conEnvio = envio !== null && entrega === "ENVIO";
  const cotEnvio = conEnvio && direccion ? cotizarEnvio({ ...envio, destino: { lat: direccion.lat, lon: direccion.lon } }) : null;
  const envioCents = cotEnvio?.ok ? cotEnvio.cents : 0;
  const totalCents = subtotalCents + envioCents;
  // Con envío hace falta una dirección dentro de la zona.
  const entregaLista = !conEnvio || cotEnvio?.ok === true;

  // Las copias que hay que encuadrar: la foto no tiene la proporción del tamaño elegido.
  const paraRecortar = fotos.flatMap((f) => {
    const m = medidasDe(f);
    if (!m) return [];
    return (copias[f.id] ?? [])
      .filter((c) => {
        const t = tamPorId.get(c.sizeId);
        return t ? !coincideProporcion(m.w, m.h, t.widthCm, t.heightCm) : false;
      })
      .map((c) => ({ foto: f, copia: c, medidas: m, tam: tamPorId.get(c.sizeId)! }));
  });

  useEffect(() => {
    titulo.current?.focus();
    window.scrollTo({ top: 0 });
  }, [paso]);

  // --- Cambios en las copias ---------------------------------------------------------------------

  const cambiarCopias = (archivoId: string, f: (actual: Copia[]) => Copia[]) =>
    setCopias((todo) => {
      const nuevas = f(todo[archivoId] ?? []);
      const resto = { ...todo };
      if (nuevas.length === 0) delete resto[archivoId];
      else resto[archivoId] = nuevas;
      return resto;
    });
  const agregarCopia = (archivoId: string) =>
    cambiarCopias(archivoId, (a) => [...a, { id: nuevoId(), sizeId: a[a.length - 1]?.sizeId ?? tamanos[0].id, quantity: 1, recorte: null }]);
  const editarCopia = (archivoId: string, id: string, cambio: Partial<Copia>) =>
    cambiarCopias(archivoId, (a) => a.map((c) => (c.id === id ? { ...c, ...cambio } : c)));
  const quitarCopia = (archivoId: string, id: string) => cambiarCopias(archivoId, (a) => a.filter((c) => c.id !== id));

  function aplicarATodas() {
    if (!tamPorId.has(todasTam)) return;
    const todo: Record<string, Copia[]> = {};
    for (const f of fotos) todo[f.id] = [{ id: nuevoId(), sizeId: todasTam, quantity: todasCant, recorte: null }];
    setCopias(todo);
  }

  /** Antes de encuadrar hace falta la proporción de cada foto elegida (la miniatura puede no haber cargado). */
  async function irARecorte() {
    setError(null);
    const faltan = fotos.filter((f) => copias[f.id] && !medidasDe(f));
    if (faltan.length > 0) {
      setMidiendo(true);
      const medidas = await Promise.all(faltan.map(async (f) => [f.id, await medir(f.mini)] as const));
      setMidiendo(false);
      const nuevas: Record<string, Medidas> = {};
      for (const [id, m] of medidas) if (m) nuevas[id] = m;
      setMedidasVistas((v) => ({ ...v, ...nuevas }));
      if (Object.keys(nuevas).length < faltan.length) {
        setError("No pudimos cargar algunas fotos. Revisá tu conexión y probá de nuevo.");
        return;
      }
    }
    setPaso("recorte");
  }

  function pagar() {
    setError(null);
    const datos = {
      carrito: { papel, lineas: lineas.map((l) => ({ archivoId: l.archivoId, sizeId: l.sizeId, quantity: l.quantity, recorte: l.recorte })) },
      nombre,
      email,
      telefono,
      // Sólo la dirección y su punto: el costo del envío lo calcula el servidor.
      entrega: conEnvio && direccion ? { tipo: "ENVIO", direccion: direccion.direccion, lat: direccion.lat, lon: direccion.lon } : { tipo: "RETIRO" },
    };
    empezar(async () => {
      try {
        const r = await pagarAccion(datos);
        if (r.ok) window.location.href = r.checkoutUrl;
        else setError(r.error);
      } catch {
        setError("No pudimos abrir el pago. Probá de nuevo en un rato.");
      }
    });
  }

  // --- Pantallas ---------------------------------------------------------------------------------

  if (fotos.length === 0) {
    return (
      <main className="min-h-screen bg-[var(--fo-bg)] px-4 py-10">
        <div className="fo-card mx-auto max-w-md space-y-3 p-8 text-center">
          <p className="text-sm text-[var(--fo-text-secondary)]">
            {fuente.tipo === "CARPETA" ? "Esta carpeta no tiene fotos para imprimir." : "Esta galería no tiene fotos para imprimir."}
          </p>
          <a href={volver.href} className="fo-btn fo-btn-secondary text-sm">
            Volver
          </a>
        </div>
      </main>
    );
  }

  const fotoAbierta = abierta !== null ? fotos[abierta] : null;
  const pasos: { id: Paso; nombre: string }[] = [
    { id: "elegir", nombre: "Elegir" },
    { id: "recorte", nombre: "Encuadre" },
    { id: "datos", nombre: "Tus datos" },
  ];

  return (
    <main className="min-h-screen bg-[var(--fo-bg)] px-4 pb-32 pt-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="space-y-3">
          <a href={volver.href} className="inline-flex items-center gap-1 text-sm text-[var(--fo-muted)] hover:text-[var(--fo-text)]">
            <ArrowLeft className="size-4" aria-hidden />
            {volver.texto}
          </a>
          <p className="text-sm text-[var(--fo-muted)]">{estudio}</p>
          <h1 ref={titulo} tabIndex={-1} className="flex items-center gap-2 text-2xl font-bold outline-none">
            <Printer className="size-6 text-[var(--fo-accent)]" aria-hidden />
            {paso === "elegir" ? "Pedí copias impresas" : paso === "recorte" ? "Revisá el encuadre" : "Tus datos y pago"}
          </h1>
          <ol className="flex gap-2 text-xs" aria-label="Pasos del pedido">
            {pasos.map((p, i) => (
              <li
                key={p.id}
                aria-current={p.id === paso ? "step" : undefined}
                className={`rounded-full px-3 py-1 ${p.id === paso ? "bg-[var(--fo-accent)] text-white" : "bg-[var(--fo-surface-hover)] text-[var(--fo-muted)]"}`}
              >
                {i + 1}. {p.nombre}
              </li>
            ))}
          </ol>
        </header>

        {error ? (
          <p role="alert" className="rounded-[var(--fo-radius-sm)] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </p>
        ) : null}

        {paso === "elegir" ? (
          <>
            <section className="fo-card space-y-3 p-4" aria-labelledby="todas-titulo">
              <h2 id="todas-titulo" className="text-sm font-semibold">
                ¿Querés la misma copia de todas?
              </h2>
              <div className="flex flex-wrap items-end gap-3">
                <label className="space-y-1 text-sm">
                  <span className="fo-label">Tamaño</span>
                  <select className="fo-input" value={todasTam} onChange={(e) => setTodasTam(e.target.value)}>
                    {tamanos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {nombreTamano(t)} cm · {plata(t.priceCents)}
                      </option>
                    ))}
                  </select>
                </label>
                <Cantidad valor={todasCant} onCambio={setTodasCant} etiqueta="Copias de cada foto" />
                <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={aplicarATodas}>
                  Aplicar a todas las fotos
                </button>
              </div>
              <p className="text-xs text-[var(--fo-muted)]">Reemplaza lo que ya elegiste. Después podés cambiar cada foto.</p>
            </section>

            <p className="text-sm text-[var(--fo-text-secondary)]">Tocá una foto para elegir el tamaño y cuántas copias querés.</p>
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-5">
              {fotos.map((f, i) => {
                const n = (copias[f.id] ?? []).reduce((s, c) => s + c.quantity, 0);
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setAbierta(i)}
                      aria-label={`${f.nombre}: ${n === 0 ? "sin copias" : n === 1 ? "1 copia" : `${n} copias`}`}
                      className={`relative block aspect-square w-full overflow-hidden rounded-[var(--fo-radius-sm)] bg-[var(--fo-surface-hover)] outline-none ring-[var(--fo-accent)] focus-visible:ring-2 ${n > 0 ? "ring-2" : ""}`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- miniatura firmada de la carpeta */}
                      <img
                        src={f.mini}
                        alt=""
                        loading="lazy"
                        onLoad={(e) => anotarMedidas(f.id, e.currentTarget)}
                        className="size-full object-cover"
                      />
                      {n > 0 ? (
                        <span className="absolute right-2 top-2 rounded-full bg-[var(--fo-accent)] px-2.5 py-1 text-sm font-semibold text-white shadow">
                          {n}
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}

        {paso === "recorte" ? (
          <section className="space-y-4">
            {paraRecortar.length === 0 ? (
              <p className="fo-card p-6 text-sm text-[var(--fo-text-secondary)]">
                Todas tus fotos entran justas en los tamaños que elegiste: no hace falta recortar nada.
              </p>
            ) : (
              <>
                <p className="text-sm text-[var(--fo-text-secondary)]">
                  Estas fotos no tienen la misma forma que el papel. Mové la foto dentro del marco para elegir qué parte se imprime; lo que
                  queda afuera se corta.
                </p>
                <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {paraRecortar.map(({ foto, copia, medidas, tam }) => {
                    const r = recorteDe(foto, copia);
                    const real = foto.width && foto.height ? { w: foto.width, h: foto.height } : null;
                    const pixelada = real ? pppDelRecorte(real.w, real.h, r, tam.widthCm, tam.heightCm) < PPP_MINIMO : false;
                    return (
                      <li key={copia.id} className="fo-card space-y-3 p-4">
                        <p className="truncate text-sm font-medium">
                          {foto.nombre} · {nombreTamano(tam)} cm · {copia.quantity === 1 ? "1 copia" : `${copia.quantity} copias`}
                        </p>
                        <EditorRecorte
                          src={foto.mini}
                          fotoW={medidas.w}
                          fotoH={medidas.h}
                          tamW={tam.widthCm}
                          tamH={tam.heightCm}
                          valor={r}
                          onCambio={(nuevo) => editarCopia(foto.id, copia.id, { recorte: nuevo })}
                          etiqueta={`Encuadre de ${foto.nombre} en ${nombreTamano(tam)}`}
                        />
                        {pixelada ? (
                          <p className="flex items-start gap-2 text-sm text-amber-800">
                            <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                            Puede verse pixelada en este tamaño. Probá alejar el zoom o elegir un tamaño más chico.
                          </p>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </section>
        ) : null}

        {paso === "datos" ? (
          <section className="mx-auto max-w-lg space-y-5">
            <div className="fo-card space-y-4 p-5">
              <label className="block space-y-1">
                <span className="fo-label">Nombre y apellido</span>
                <input className="fo-input w-full" value={nombre} onChange={(e) => setNombre(e.target.value)} autoComplete="name" required />
              </label>
              <label className="block space-y-1">
                <span className="fo-label">Correo</span>
                <input
                  className="fo-input w-full"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
                <span className="text-xs text-[var(--fo-muted)]">Te avisamos ahí cuando estén listas.</span>
              </label>
              <label className="block space-y-1">
                <span className="fo-label">Teléfono (opcional)</span>
                <input className="fo-input w-full" type="tel" value={telefono} onChange={(e) => setTelefono(e.target.value)} autoComplete="tel" />
              </label>
              {papeles.length > 1 ? (
                <fieldset className="space-y-2">
                  <legend className="fo-label">Papel</legend>
                  <div className="flex gap-4">
                    {papeles.map((p) => (
                      <label key={p} className="flex items-center gap-2 text-sm">
                        <input type="radio" name="papel" value={p} checked={papel === p} onChange={() => setPapel(p)} />
                        {ETIQUETA_PAPEL[p]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <p className="text-sm text-[var(--fo-text-secondary)]">Papel: {ETIQUETA_PAPEL[papel]}</p>
              )}
            </div>
            {envio ? (
              <fieldset className="fo-card space-y-3 p-5 text-sm">
                <legend className="sr-only">Cómo recibir las copias</legend>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="radio" name="entrega" className="mt-1" checked={entrega === "RETIRO"} onChange={() => setEntrega("RETIRO")} />
                  <span className="space-y-1">
                    <span className="flex items-center gap-2 font-medium">
                      <Store className="size-4 text-[var(--fo-accent)]" aria-hidden />
                      Retiro en el local (gratis)
                    </span>
                    <span className="block text-[var(--fo-text-secondary)]">Las tenés listas {plazo}. Te avisamos por correo.</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="radio" name="entrega" className="mt-1" checked={entrega === "ENVIO"} onChange={() => setEntrega("ENVIO")} />
                  <span className="space-y-1">
                    <span className="flex items-center gap-2 font-medium">
                      <MapPin className="size-4 text-[var(--fo-accent)]" aria-hidden />
                      Envío a domicilio
                    </span>
                    <span className="block text-[var(--fo-text-secondary)]">Salen {plazo}. El costo depende de la distancia.</span>
                  </span>
                </label>
                {entrega === "ENVIO" ? <BuscarDireccion envio={envio} elegida={direccion} onElegir={setDireccion} /> : null}
              </fieldset>
            ) : (
              <div className="fo-card flex items-start gap-3 p-5 text-sm">
                <Store className="mt-0.5 size-5 shrink-0 text-[var(--fo-accent)]" aria-hidden />
                <div className="space-y-1">
                  <p className="font-medium">Retiro en el local</p>
                  <p className="text-[var(--fo-text-secondary)]">Las tenés listas {plazo}. Te avisamos por correo.</p>
                </div>
              </div>
            )}
            {conEnvio && cotEnvio?.ok ? (
              <dl className="fo-card space-y-1 p-5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--fo-muted)]">Copias</dt>
                  <dd className="tabular-nums">{plata(subtotalCents)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--fo-muted)]">Envío</dt>
                  <dd className="tabular-nums">{plata(envioCents)}</dd>
                </div>
                <div className="flex justify-between gap-2 font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{plata(totalCents)}</dd>
                </div>
              </dl>
            ) : null}
            <button
              type="button"
              className="fo-btn fo-btn-primary w-full text-base"
              onClick={pagar}
              disabled={pagando || totalCopias === 0 || !entregaLista}
            >
              {pagando ? "Abriendo Mercado Pago…" : conEnvio && !entregaLista ? "Elegí una dirección de envío" : `Pagar ${plata(totalCents)} con Mercado Pago`}
            </button>
          </section>
        ) : null}
      </div>

      {/* Barra fija: copias, total y el paso siguiente. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--fo-border)] bg-[var(--fo-surface)] px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <p className="text-sm" aria-live="polite">
            <span className="font-semibold">{totalCopias === 1 ? "1 copia" : `${totalCopias} copias`}</span>
            <span className="text-[var(--fo-muted)]"> · </span>
            <span className="font-semibold tabular-nums">{plata(totalCents)}</span>
          </p>
          <div className="flex gap-2">
            {paso !== "elegir" ? (
              <button type="button" className="fo-btn fo-btn-ghost text-sm" onClick={() => setPaso(paso === "datos" ? "recorte" : "elegir")}>
                Volver
              </button>
            ) : null}
            {paso === "elegir" ? (
              <button type="button" className="fo-btn fo-btn-primary text-sm" disabled={totalCopias === 0 || midiendo} onClick={irARecorte}>
                {midiendo ? "Preparando…" : "Seguir"}
              </button>
            ) : paso === "recorte" ? (
              <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => setPaso("datos")}>
                Seguir
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {fotoAbierta && abierta !== null ? (
        <PanelFoto
          foto={fotoAbierta}
          posicion={abierta}
          total={fotos.length}
          copias={copias[fotoAbierta.id] ?? []}
          tamanos={tamanos}
          onCerrar={() => setAbierta(null)}
          onIr={(i) => setAbierta(i)}
          onAgregar={() => agregarCopia(fotoAbierta.id)}
          onEditar={(id, cambio) => editarCopia(fotoAbierta.id, id, cambio)}
          onQuitar={(id) => quitarCopia(fotoAbierta.id, id)}
          onMedidas={(img) => anotarMedidas(fotoAbierta.id, img)}
        />
      ) : null}
    </main>
  );
}

function Cantidad({ valor, onCambio, etiqueta }: { valor: number; onCambio: (n: number) => void; etiqueta: string }) {
  return (
    <div className="space-y-1 text-sm">
      <span className="fo-label block">{etiqueta}</span>
      <div className="flex items-center gap-1" role="group" aria-label={etiqueta}>
        <button
          type="button"
          className="fo-btn fo-btn-secondary size-10 p-0"
          onClick={() => onCambio(Math.max(1, valor - 1))}
          disabled={valor <= 1}
          aria-label="Una menos"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <span className="w-8 text-center font-semibold tabular-nums" aria-live="polite">
          {valor}
        </span>
        <button
          type="button"
          className="fo-btn fo-btn-secondary size-10 p-0"
          onClick={() => onCambio(Math.min(MAX_CANTIDAD, valor + 1))}
          disabled={valor >= MAX_CANTIDAD}
          aria-label="Una más"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

/** La foto grande con sus copias: tamaño, cantidad, quitar y agregar otra. */
function PanelFoto({
  foto,
  posicion,
  total,
  copias,
  tamanos,
  onCerrar,
  onIr,
  onAgregar,
  onEditar,
  onQuitar,
  onMedidas,
}: {
  foto: Foto;
  posicion: number;
  total: number;
  copias: Copia[];
  tamanos: Tamano[];
  onCerrar: () => void;
  onIr: (i: number) => void;
  onAgregar: () => void;
  onEditar: (id: string, cambio: Partial<Copia>) => void;
  onQuitar: (id: string) => void;
  onMedidas: (img: HTMLImageElement) => void;
}) {
  const cerrar = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    cerrar.current?.focus();
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", tecla);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", tecla);
      document.body.style.overflow = overflow;
      previo?.focus();
    };
    // Sólo al abrir y cerrar el panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 md:items-center md:p-6" onClick={onCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="panel-foto-titulo"
        className="flex max-h-[95vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[var(--fo-radius)] bg-[var(--fo-surface)] md:flex-row md:rounded-[var(--fo-radius)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black md:min-h-[60vh]">
          {/* eslint-disable-next-line @next/next/no-img-element -- miniatura firmada de la carpeta */}
          <img src={foto.mini} alt={foto.nombre} onLoad={(e) => onMedidas(e.currentTarget)} className="max-h-[45vh] w-auto object-contain md:max-h-[85vh]" />
          {posicion > 0 ? (
            <button
              type="button"
              onClick={() => onIr(posicion - 1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button>
          ) : null}
          {posicion < total - 1 ? (
            <button
              type="button"
              onClick={() => onIr(posicion + 1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white"
              aria-label="Foto siguiente"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button>
          ) : null}
        </div>
        <div className="flex w-full flex-col gap-4 overflow-y-auto p-4 md:w-80">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 id="panel-foto-titulo" className="truncate text-sm font-semibold">
                {foto.nombre}
              </h2>
              <p className="text-xs text-[var(--fo-muted)]">
                Foto {posicion + 1} de {total}
              </p>
            </div>
            <button ref={cerrar} type="button" onClick={onCerrar} className="fo-btn fo-btn-ghost size-9 p-0" aria-label="Cerrar">
              <X className="size-5" aria-hidden />
            </button>
          </div>

          {copias.length === 0 ? <p className="text-sm text-[var(--fo-text-secondary)]">Todavía no pediste copias de esta foto.</p> : null}
          <ul className="space-y-3">
            {copias.map((c, i) => (
              <li key={c.id} className="space-y-2 rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-[var(--fo-muted)]">Copia {i + 1}</span>
                  <button type="button" onClick={() => onQuitar(c.id)} className="fo-btn fo-btn-ghost gap-1 px-2 text-xs" aria-label={`Quitar copia ${i + 1}`}>
                    <Trash2 className="size-4" aria-hidden />
                    Quitar
                  </button>
                </div>
                <label className="block space-y-1 text-sm">
                  <span className="fo-label">Tamaño</span>
                  <select
                    className="fo-input w-full"
                    value={c.sizeId}
                    // Otro tamaño, otra forma: el encuadre vuelve a ser automático.
                    onChange={(e) => onEditar(c.id, { sizeId: e.target.value, recorte: null })}
                  >
                    {tamanos.map((t) => (
                      <option key={t.id} value={t.id}>
                        {nombreTamano(t)} cm · {plata(t.priceCents)}
                      </option>
                    ))}
                  </select>
                </label>
                <Cantidad valor={c.quantity} onCambio={(n) => onEditar(c.id, { quantity: n })} etiqueta="Cantidad" />
              </li>
            ))}
          </ul>
          <button type="button" onClick={onAgregar} className="fo-btn fo-btn-secondary gap-1.5 text-sm">
            <Plus className="size-4" aria-hidden />
            {copias.length === 0 ? "Agregar una copia" : "Agregar otra copia"}
          </button>
          <button type="button" onClick={onCerrar} className="fo-btn fo-btn-primary mt-auto text-sm">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}
