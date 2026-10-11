"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  comentarAction,
  descargarAction,
  descargarOriginalAction,
  elegirFotoAction,
  enviarSeleccionAction,
  pagarFotosExtraAction,
  vistasAction,
} from "@/app/w/[workspaceSlug]/galeria/[token]/acciones";
import { calcularCarrito } from "@/lib/galerias/precios";
import { MENSAJES_PAGO_GALERIA, mensajeExtrasSinPagar, textoBarraExtras, type AvisoDePagoGaleria } from "@/lib/galerias/venta-publica";
import { puedeAgregar, progresoSeleccion, puedeEditarElCliente, type ConfigSeleccion } from "@/lib/galerias/seleccion";
import {
  MAX_VISTAS_POR_LOTE,
  MENSAJES_PUBLICO,
  comentariosPorFoto as agruparComentarios,
  filtrarFotos,
  fotosConComentarios as idsConComentarios,
  idsParaPrecargar,
  type ComentarioPublico,
  type FiltroGaleria,
  type VistaGaleria,
} from "@/lib/galerias/publico-tipos";
import { BarraFija } from "./barra-fija";
import { CarritoExtras } from "./carrito";
import { DescargarTodas } from "./descargar-todas";
import { Grilla } from "./grilla";
import { Repaso } from "./repaso";
import { Visor } from "./visor";

const sinMenu = (e: React.SyntheticEvent) => e.preventDefault();

/** Cambia una foto en el conjunto sin mutarlo. */
function conCambio(s: ReadonlySet<string>, id: string, marcar: boolean): Set<string> {
  const n = new Set(s);
  if (marcar) n.add(id);
  else n.delete(id);
  return n;
}

/**
 * La galería del cliente: encabezado, grilla, visor, barra fija y repaso. Todo lo que cambia (elegir,
 * comentar, enviar) pasa por acciones que revalidan el token; acá el estado se actualiza al instante y se
 * deshace si el servidor dice que no.
 */
export function GaleriaCliente({ slug, token, vista, avisoPago = null }: { slug: string; token: string; vista: VistaGaleria; avisoPago?: AvisoDePagoGaleria | null }) {
  const [estado, setEstado] = useState(vista.cliente.estado);
  const [enviadaEn, setEnviadaEn] = useState(vista.cliente.enviadaEn);
  const [elegidas, setElegidas] = useState<Set<string>>(() => new Set(vista.seleccionadas));
  const [comentarios, setComentarios] = useState<ComentarioPublico[]>(vista.comentarios);
  const [filtro, setFiltro] = useState<FiltroGaleria>("TODAS");
  const [visor, setVisor] = useState<{ ids: string[]; indice: number } | null>(null);
  const [repaso, setRepaso] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);
  const [pagando, setPagando] = useState(false);
  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [vistas, setVistas] = useState<Record<string, string>>({});
  const [originales, setOriginales] = useState<ReadonlySet<string>>(() => new Set(vista.originales));

  const pendientes = useRef(new Set<string>());
  const pedidas = useRef(new Set<string>());
  const reintentadas = useRef(new Set<string>());
  const elegidasRef = useRef(elegidas);
  useEffect(() => {
    elegidasRef.current = elegidas;
  }, [elegidas]);

  const editable = puedeEditarElCliente(estado);
  const config: ConfigSeleccion = useMemo(
    () => ({ selectionMode: vista.galeria.modo, minSelect: vista.galeria.minimo, maxSelect: vista.galeria.maximo }),
    [vista.galeria.modo, vista.galeria.minimo, vista.galeria.maximo],
  );

  const porId = useMemo(() => new Map(vista.fotos.map((f) => [f.id, f])), [vista.fotos]);
  const numeros = useMemo(() => new Map(vista.fotos.map((f, i) => [f.id, i])), [vista.fotos]);
  const porFoto = useMemo(() => agruparComentarios(comentarios), [comentarios]);
  const conteoPorFoto = useMemo(() => new Map([...porFoto].map(([id, l]) => [id, l.length])), [porFoto]);
  const conComentarios = useMemo(() => idsConComentarios(comentarios), [comentarios]);
  const visibles = useMemo(() => filtrarFotos(vista.fotos, filtro, elegidas, conComentarios), [vista.fotos, filtro, elegidas, conComentarios]);

  const avisar = useCallback((texto: string) => {
    setAviso(texto);
  }, []);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(null), 6000);
    return () => clearTimeout(t);
  }, [aviso]);

  /** El enlace dejó de servir o la selección ya se envió desde otra pestaña: se vuelve a cargar la página. */
  const recargar = useCallback(() => {
    window.location.reload();
  }, []);

  const alternar = useCallback(
    async (id: string) => {
      if (!editable || pendientes.current.has(id)) return;
      const marcar = !elegidasRef.current.has(id);
      if (marcar) {
        const tope = puedeAgregar(config, elegidasRef.current.size);
        if (!tope.ok) return avisar(tope.error);
      }
      pendientes.current.add(id);
      elegidasRef.current = conCambio(elegidasRef.current, id, marcar);
      setElegidas((s) => conCambio(s, id, marcar));
      let r: Awaited<ReturnType<typeof elegirFotoAction>> | null = null;
      try {
        r = await elegirFotoAction(slug, token, id, marcar);
      } catch {
        r = null;
      }
      pendientes.current.delete(id);
      if (r && r.ok) return;
      elegidasRef.current = conCambio(elegidasRef.current, id, !marcar);
      setElegidas((s) => conCambio(s, id, !marcar));
      avisar(r ? r.error : MENSAJES_PUBLICO.generico);
      if (r && !r.ok && (r.codigo === "SOLO_LECTURA" || r.codigo === "INVALIDO")) setTimeout(recargar, 2500);
    },
    [editable, config, slug, token, avisar, recargar],
  );

  // --- Vistas grandes, a pedido ---
  const pedirVistas = useCallback(
    async (ids: string[]) => {
      const faltan = ids.filter((id) => !pedidas.current.has(id)).slice(0, MAX_VISTAS_POR_LOTE);
      if (faltan.length === 0) return;
      faltan.forEach((id) => pedidas.current.add(id));
      try {
        const r = await vistasAction(slug, token, faltan);
        if (r.ok) setVistas((v) => ({ ...v, ...r.urls }));
        else faltan.forEach((id) => pedidas.current.delete(id));
      } catch {
        faltan.forEach((id) => pedidas.current.delete(id));
      }
    },
    [slug, token],
  );
  const vistaFallida = useCallback(
    (id: string) => {
      // Venció la firma (1 h): se pide una nueva, una sola vez por foto.
      if (reintentadas.current.has(id)) return;
      reintentadas.current.add(id);
      pedidas.current.delete(id);
      setVistas((v) => {
        const n = { ...v };
        delete n[id];
        return n;
      });
      void pedirVistas([id]);
    },
    [pedirVistas],
  );
  useEffect(() => {
    if (visor) void pedirVistas(idsParaPrecargar(visor.ids, visor.indice));
  }, [visor, pedirVistas]);

  const abrir = useCallback(
    (id: string) => {
      const ids = visibles.map((f) => f.id);
      const indice = ids.indexOf(id);
      if (indice >= 0) setVisor({ ids, indice });
    },
    [visibles],
  );
  const irA = useCallback((indice: number) => setVisor((v) => (v ? { ...v, indice } : v)), []);
  const cerrarVisor = useCallback(() => setVisor(null), []);

  const comentar = useCallback(
    async (fotoId: string, texto: string): Promise<{ ok: true } | { ok: false; error: string }> => {
      try {
        const r = await comentarAction(slug, token, fotoId, texto);
        if (!r.ok) {
          if (r.codigo === "SOLO_LECTURA" || r.codigo === "INVALIDO") setTimeout(recargar, 2500);
          return { ok: false, error: r.error };
        }
        setComentarios((l) => [...l, r.comentario]);
        return { ok: true };
      } catch {
        return { ok: false, error: MENSAJES_PUBLICO.generico };
      }
    },
    [slug, token, recargar],
  );

  const descargar = useCallback(
    async (fotoId: string) => {
      try {
        // Si es una foto entregada en alta se baja el original; si no, la vista (cuando la galería la permite).
        const r = originales.has(fotoId) ? await descargarOriginalAction(slug, token, fotoId) : await descargarAction(slug, token, fotoId);
        if (!r.ok) return avisar(r.error);
        const a = document.createElement("a");
        a.href = r.url;
        a.rel = "noreferrer noopener";
        document.body.appendChild(a);
        a.click();
        a.remove();
      } catch {
        avisar(MENSAJES_PUBLICO.generico);
      }
    },
    [slug, token, avisar, originales],
  );

  const enviar = useCallback(
    async (mensaje: string): Promise<{ ok: true; cantidad: number; enviadaEn: string } | { ok: false; error: string }> => {
      try {
        const r = await enviarSeleccionAction(slug, token, mensaje);
        if (!r.ok) {
          if (r.codigo === "SOLO_LECTURA" || r.codigo === "INVALIDO") setTimeout(recargar, 2500);
          return { ok: false, error: r.error };
        }
        setEstado("EN_REVISION");
        setEnviadaEn(r.enviadaEn);
        // Con la selección enviada, lo elegido (que ya no tiene extras sin pagar) pasa a poder bajarse en alta.
        // Sólo las incluidas: las extras sin pagar siguen sin poder bajarse (el servidor lo vuelve a verificar).
        if (vista.galeria.permiteOriginales) {
          const incluidas = vista.venta
            ? calcularCarrito({ config: vista.venta.config, seleccion: [...elegidasRef.current].map((fotoId, i) => ({ fotoId, seleccionadaEn: new Date(i) })), pagadas: new Set(vista.venta.pagadas) }).incluidas
            : [...elegidasRef.current];
          setOriginales((o) => new Set([...o, ...incluidas]));
        }
        return { ok: true, cantidad: r.cantidad, enviadaEn: r.enviadaEn };
      } catch {
        return { ok: false, error: MENSAJES_PUBLICO.generico };
      }
    },
    [slug, token, recargar, vista.galeria.permiteOriginales, vista.venta],
  );

  // Carrito de fotos extra: la misma cuenta que hace el servidor (que es quien fija el importe al pagar).
  const venta = vista.venta;
  const pagadasSet = useMemo(() => new Set(venta?.pagadas ?? []), [venta]);
  const carrito = useMemo(
    () =>
      venta
        ? calcularCarrito({ config: venta.config, seleccion: [...elegidas].map((fotoId, i) => ({ fotoId, seleccionadaEn: new Date(i) })), pagadas: pagadasSet })
        : null,
    [venta, elegidas, pagadasSet],
  );
  const extras = carrito?.extras.length ?? 0;
  const bloqueoEnvio = extras > 0 ? mensajeExtrasSinPagar(extras) : null;

  const pagar = useCallback(async () => {
    if (pagando) return;
    setPagando(true);
    setErrorPago(null);
    try {
      const r = await pagarFotosExtraAction(slug, token);
      if (r.ok) {
        // El checkout es de Mercado Pago: se sale de la página y se vuelve con ?pago=...
        window.location.assign(r.url);
        return;
      }
      setErrorPago(r.error);
      if (r.codigo === "SOLO_LECTURA" || r.codigo === "INVALIDO") setTimeout(recargar, 2500);
    } catch {
      setErrorPago(MENSAJES_PAGO_GALERIA.fallo);
    }
    setPagando(false);
  }, [pagando, slug, token, recargar]);

  const progreso = progresoSeleccion(config, elegidas.size);
  const requisito =
    config.selectionMode !== "CANTIDAD"
      ? null
      : config.minSelect !== null && config.maxSelect !== null
        ? `Elegí entre ${config.minSelect} y ${config.maxSelect}`
        : config.minSelect !== null
          ? `Elegí al menos ${config.minSelect}`
          : `Podés elegir hasta ${config.maxSelect}`;
  const hayComentarios = vista.galeria.permiteComentarios || comentarios.length > 0;
  const elegidasEnOrden = useMemo(() => vista.fotos.filter((f) => elegidas.has(f.id)), [vista.fotos, elegidas]);
  const textoLectura =
    venta?.config.saleMode === "VENTA" && venta.pagadas.length > 0
      ? "¡Gracias por tu compra! Recibimos tu pago."
      : estado === "FINALIZADO"
      ? `Tu selección quedó cerrada${enviadaEn ? ` (la enviaste el ${enviadaEn})` : ""}.`
      : `Tu selección fue enviada${enviadaEn ? ` el ${enviadaEn}` : ""}.`;

  const estilo = { "--fo-accent": "var(--wsite-primary, #0ea5e9)", "--fo-accent-hover": "var(--wsite-primary, #0284c7)" } as CSSProperties;

  return (
    <div className="select-none pb-40" style={estilo} onContextMenu={sinMenu}>
      {vista.portadaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={vista.portadaUrl}
          alt=""
          draggable={false}
          onContextMenu={sinMenu}
          onDragStart={sinMenu}
          referrerPolicy="no-referrer"
          className="max-h-[55vh] w-full object-cover [-webkit-touch-callout:none]"
        />
      ) : null}

      <main className="mx-auto max-w-6xl space-y-5 px-3 py-6 md:px-6">
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            {vista.organizacion.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={vista.organizacion.logoUrl} alt="" className="h-10 w-auto" referrerPolicy="no-referrer" />
            ) : null}
            {vista.organizacion.nombre ? <p className="text-sm opacity-70">{vista.organizacion.nombre}</p> : null}
          </div>
          <h1 className="text-2xl font-semibold md:text-3xl">{vista.galeria.nombre}</h1>
          <p className="text-sm opacity-70">Hola, {vista.cliente.nombre}.</p>
          {vista.galeria.mensaje ? <p className="max-w-3xl whitespace-pre-line text-base">{vista.galeria.mensaje}</p> : null}
          {editable ? (
            <p className="text-sm opacity-80">
              {venta?.config.saleMode === "VENTA"
                ? "Tocá una foto para verla en grande y el círculo de arriba a la derecha para elegirla para comprar. Cuando termines, tocá «Pagar fotos extra»."
                : "Tocá una foto para verla en grande y el círculo de arriba a la derecha para elegirla. Cuando termines, tocá «Enviar selección»."}
              {venta && venta.config.saleMode === "SELECCION_Y_VENTA" && venta.config.includedCount > 0
                ? ` Tu galería incluye ${venta.config.includedCount === 1 ? "1 foto" : `${venta.config.includedCount} fotos`}; las demás que elijas se pagan.`
                : ""}
            </p>
          ) : null}
          {avisoPago ? (
            <p
              role="status"
              className={`rounded-lg p-3 text-sm ${avisoPago.tono === "ok" ? "bg-green-50 text-green-900" : avisoPago.tono === "error" ? "bg-red-50 text-red-900" : "bg-sky-50 text-sky-900"}`}
            >
              {avisoPago.texto}
            </p>
          ) : null}
        </header>

        {!editable ? (
          <section className="fo-card space-y-1 p-4 text-sm" aria-live="polite">
            <h2 className="text-base font-semibold">{estado === "FINALIZADO" ? "Selección cerrada" : "¡Gracias! Recibimos tu selección"}</h2>
            <p>{textoLectura}</p>
            <p className="opacity-70">Elegiste {elegidas.size === 1 ? "1 foto" : `${elegidas.size} fotos`}. Si querés cambiar algo, escribinos.</p>
            {vista.cliente.mensajeEnviado ? <p className="whitespace-pre-line border-l-2 pl-3 opacity-80">Tu mensaje: {vista.cliente.mensajeEnviado}</p> : null}
          </section>
        ) : null}

        {originales.size > 0 ? <DescargarTodas slug={slug} token={token} ids={vista.fotos.map((f) => f.id).filter((id) => originales.has(id))} /> : null}

        {visibles.length === 0 ? (
          <p className="py-10 text-center opacity-70">
            {filtro === "SELECCIONADAS" ? "Todavía no elegiste ninguna foto." : filtro === "CON_COMENTARIOS" ? "Todavía no hay fotos con comentarios." : "Esta galería todavía no tiene fotos."}
          </p>
        ) : (
          <Grilla
            fotos={visibles}
            indices={numeros}
            seleccionadas={elegidas}
            comentariosPorFoto={conteoPorFoto}
            pagadas={pagadasSet}
            descargables={originales}
            editable={editable}
            onAbrir={abrir}
            onAlternar={alternar}
            onDescargar={descargar}
          />
        )}
      </main>

      <BarraFija
        filtro={filtro}
        onFiltro={setFiltro}
        cantidades={{ todas: vista.fotos.length, seleccionadas: elegidas.size, conComentarios: conComentarios.size }}
        mostrarComentarios={hayComentarios}
        contador={progreso.texto}
        requisito={requisito}
        cumpleMinimo={progreso.cumpleMinimo}
        editable={editable}
        textoLectura={textoLectura}
        onEnviar={() => {
          setVisor(null);
          setRepaso(true);
        }}
        venta={
          venta && carrito
            ? {
                soloVenta: venta.config.saleMode === "VENTA",
                extras,
                textoExtras: textoBarraExtras(extras, carrito.totalCents),
                onPagar: () => {
                  setVisor(null);
                  setErrorPago(null);
                  setCarritoAbierto(true);
                },
              }
            : null
        }
      />

      {carritoAbierto && carrito ? <CarritoExtras carrito={carrito} pagando={pagando} error={errorPago} onPagar={pagar} onCerrar={() => setCarritoAbierto(false)} /> : null}

      {visor ? (
        <Visor
          fotos={visor.ids.map((id) => porId.get(id)).filter((f): f is NonNullable<typeof f> => !!f)}
          indice={visor.indice}
          numeros={numeros}
          total={vista.fotos.length}
          vistas={vistas}
          seleccionadas={elegidas}
          comentarios={(id) => porFoto.get(id) ?? []}
          nombreEstudio={vista.organizacion.nombre}
          editable={editable}
          permiteComentarios={vista.galeria.permiteComentarios}
          permiteDescarga={vista.galeria.permiteDescarga}
          descargables={originales}
          onIr={irA}
          onCerrar={cerrarVisor}
          onAlternar={alternar}
          onComentar={comentar}
          onDescargar={descargar}
          onVistaFallida={vistaFallida}
        />
      ) : null}

      {repaso ? (
        <Repaso
          config={config}
          fotos={elegidasEnOrden}
          nombre={vista.cliente.nombre}
          bloqueo={bloqueoEnvio}
          onVolver={() => setRepaso(false)}
          onEnviar={enviar}
          onTerminar={() => setRepaso(false)}
        />
      ) : null}

      {aviso ? (
        <div role="alert" className="fixed inset-x-3 top-3 z-[60] mx-auto max-w-md rounded-lg bg-red-700 px-4 py-3 text-sm text-white shadow-lg" onClick={() => setAviso(null)}>
          {aviso}
        </div>
      ) : null}
    </div>
  );
}
