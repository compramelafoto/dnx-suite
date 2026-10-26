// apps/fotoffice/components/digitalizacion/dvd.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { buscarTrabajosAction, cerrarGrabacionAction, continuarGrabacionAction, crearGrabacionAction, latidoAction } from "@/app/(shell)/digitalizacion/actions";
import { elegirCarpeta } from "@/lib/digitalizacion/cliente/apis-navegador";
import { ColaDeSubida, almacenEnMemoria, idParte, type ResumenCola } from "@/lib/digitalizacion/cliente/cola";
import { cortesDeArchivo, vobsEnOrden } from "@/lib/digitalizacion/dvd";
import { EVENTO_DVD_SUBIENDO, conPreseleccion, crearSubidor, type Continuacion, type Preseleccion } from "./estacion";
import { Ventanita, type EstadoVentanita } from "./ventanita";

async function carpetaVideoTs(raiz: FileSystemDirectoryHandle): Promise<FileSystemDirectoryHandle> {
  if (raiz.name.toUpperCase() === "VIDEO_TS") return raiz;
  for await (const [nombre, h] of (raiz as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
    if (h.kind === "directory" && nombre.toUpperCase() === "VIDEO_TS") return h as FileSystemDirectoryHandle;
  }
  throw new Error("No encontramos la carpeta VIDEO_TS. Elegí el disco o la carpeta VIDEO_TS.");
}

async function archivosDe(dir: FileSystemDirectoryHandle): Promise<File[]> {
  const files: File[] = [];
  for await (const [, h] of (dir as unknown as { entries(): AsyncIterable<[string, FileSystemHandle]> }).entries()) {
    if (h.kind === "file") files.push(await (h as FileSystemFileHandle).getFile());
  }
  return vobsEnOrden(files.map((f) => ({ nombre: f.name, f }))).map((x) => x.f);
}

function esElMismoDvd(archivos: File[], guardados: { nombre: string; bytes: number }[] | null): boolean {
  if (!guardados || guardados.length !== archivos.length) return false;
  return archivos.every((f, i) => f.name.toLowerCase() === guardados[i].nombre.toLowerCase() && f.size === guardados[i].bytes);
}

export function DigitalizarDvd({ continuar, preseleccion = null }: { continuar: Continuacion | null; preseleccion?: Preseleccion | null }) {
  const [fase, setFase] = useState<"listo" | "subiendo" | "terminada">("listo");
  const [aviso, setAviso] = useState<string | null>(null);
  const [avance, setAvance] = useState({ hechos: 0, total: 0 });
  // Con el trabajo elegido desde su ficha (`?proyecto=`), el DVD también arranca con ese trabajo.
  const [sinPedido, setSinPedido] = useState(preseleccion === null);
  const [titulo, setTitulo] = useState("");
  const [proyectoId, setProyectoId] = useState<string | null>(preseleccion?.id ?? null);
  const [trabajos, setTrabajos] = useState<{ id: string; numero: string; nombre: string }[]>(conPreseleccion([], preseleccion));

  const [fallo, setFallo] = useState(false);
  const ocupado = useRef(false);
  const ultimoLatido = useRef(0);

  // La estación de VHS escucha esto para no dejar grabar mientras el DVD sube.
  useEffect(() => {
    window.dispatchEvent(new CustomEvent(EVENTO_DVD_SUBIENDO, { detail: fase === "subiendo" }));
    return () => { window.dispatchEvent(new CustomEvent(EVENTO_DVD_SUBIENDO, { detail: false })); };
  }, [fase]);

  useEffect(() => {
    if (fase !== "subiendo") return;
    const avisar = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [fase]);

  const ventanitaRef = useRef<Ventanita | null>(null);
  const ultimoEstado = useRef<EstadoVentanita | null>(null);
  const [, redibujar] = useState(0);

  const abrirVentanita = async (): Promise<boolean> => {
    try {
      ventanitaRef.current = await Ventanita.abrir(() => setAviso("El DVD sigue subiendo; esperá a que termine."));
      if (ultimoEstado.current) ventanitaRef.current.mostrar(ultimoEstado.current);
      redibujar((n) => n + 1);
      return true;
    } catch {
      ventanitaRef.current = null;
      return false;
    }
  };

  const empezar = async () => {
    if (ocupado.current) return;
    ocupado.current = true;
    setAviso(null);
    setFallo(false);
    try {
      const archivos = await archivosDe(await carpetaVideoTs(await elegirCarpeta()));
      if (archivos.length === 0) { setAviso("No hay videos en esa carpeta (sólo menús o nada)."); return; }
      if (continuar && !esElMismoDvd(archivos, continuar.dvdArchivos)) {
        setAviso("Ese no es el mismo DVD: los archivos no coinciden con la grabación.");
        return;
      }
      if (!(await abrirVentanita())) setAviso("Podés abrir la ventanita con el botón.");
      let grabacionId = continuar?.grabacionId ?? null;
      if (continuar && grabacionId) {
        const c = await continuarGrabacionAction(grabacionId);
        if (!c.ok) { setAviso(c.error); return; }
      } else {
        const r = await crearGrabacionAction({
          titulo, tipo: "DVD", proyectoId: sinPedido ? null : proyectoId, cassetteNumero: null, calidad: null, mimeType: "video/dvd",
          corregirProporcion: false, equipoId: null, dvdArchivos: archivos.map((f) => ({ nombre: f.name, bytes: f.size })),
        });
        if (!r.ok) { setAviso(r.error); return; }
        grabacionId = r.id;
      }
      if (!grabacionId) return;
      const id = grabacionId;
      ultimoLatido.current = Date.now();
      const pedacitos = archivos.flatMap((f) => cortesDeArchivo(f.size).map((c) => f.slice(c.desde, c.hasta)));
      setAvance({ hechos: 0, total: pedacitos.length });
      setFase("subiendo");
      let encoladas = 0;
      const pintar = (r: ResumenCola) => {
        const hechos = Math.max(0, Math.min(pedacitos.length, encoladas - r.pendientes));
        if (Date.now() - ultimoLatido.current >= 30_000) {
          ultimoLatido.current = Date.now();
          void latidoAction(id, { tramo: 1, duracionSeg: 0, primeraImagenSeg: null, ultimaImagenSeg: null, sinImagen: false, tramosSinSenal: [] }).catch(() => {});
        }
        setAvance({ hechos, total: pedacitos.length });
        const estado: EstadoVentanita = { modo: "DVD", stream: null, segundos: 0, bytesPendientes: r.bytesPendientes, ultimoError: r.ultimoError, sinImagenHaceSeg: null, minutosSinSenal: 0, avanceDvd: { hechos, total: pedacitos.length }, terminando: false };
        ultimoEstado.current = estado;
        if (ventanitaRef.current && !ventanitaRef.current.cerrada()) ventanitaRef.current.mostrar(estado);
      };
      const cola = new ColaDeSubida(almacenEnMemoria(), crearSubidor(), { alCambiar: pintar });
      for (let indice = 0; indice < pedacitos.length; indice++) {
        await cola.agregar({ id: idParte(id, 1, indice), grabacionId: id, tramo: 1, indice, datos: pedacitos[indice] });
        encoladas = indice + 1;
      }
      pintar(cola.resumen());
      await cola.vaciada();
      if (cola.resumen().descartadas > 0) {
        setFallo(true);
        setAviso("Algunas partes no se pudieron subir. El DVD no se cerró: volvé a elegir la carpeta con Continuar desde la lista.");
        return;
      }
      const r = await cerrarGrabacionAction(id, { tramo: 1, duracionSeg: 0, primeraImagenSeg: null, ultimaImagenSeg: null, sinImagen: false, tramosSinSenal: [], motivoFin: "DVD_COMPLETO" });
      setFase("terminada");
      setAviso(r.ok ? "DVD subido completo." : r.error);
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") {
        setAviso(e instanceof Error ? e.message : "No se pudo leer el DVD.");
        setFallo(true);
      }
    } finally {
      ocupado.current = false;
      ventanitaRef.current?.cerrar();
      ventanitaRef.current = null;
      ultimoEstado.current = null;
    }
  };

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Digitalizar DVD</h2>
      {aviso ? <p className="fo-alert-warning p-3 text-sm">{aviso}</p> : null}
      {continuar ? <p className="text-sm">Elegí de nuevo la carpeta del mismo DVD: se sube sólo lo que faltó.</p> : (
        <>
          <label className="block text-sm">Título del video (opcional)
            <input className="mt-1 block w-full max-w-md rounded border p-2 text-sm" maxLength={120} placeholder="Ej.: Casamiento de Juan y Ana, 1998" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sinPedido} onChange={(e) => setSinPedido(e.target.checked)} /> Sin pedido (prueba)
          </label>
          {!sinPedido ? (
            <div className="space-y-2">
              <input className="w-full max-w-md rounded border p-2 text-sm" placeholder="Buscá por número de trabajo o cliente" onChange={(e) => void buscarTrabajosAction(e.target.value).then((r) => r.ok && setTrabajos(r.trabajos))} />
              <ul className="max-w-md divide-y rounded border text-sm">
                {trabajos.map((t) => (
                  <li key={t.id}><button type="button" className={`w-full p-2 text-left ${proyectoId === t.id ? "bg-gray-100 font-semibold" : ""}`} onClick={() => setProyectoId(t.id)}>{t.numero} · {t.nombre}</button></li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      )}
      {fase === "listo" ? (
        <button type="button" className="fo-btn fo-btn-primary" disabled={!continuar && !sinPedido && !proyectoId} onClick={() => void empezar()}>Elegir la carpeta del DVD</button>
      ) : null}
      {fase === "subiendo" && (!ventanitaRef.current || ventanitaRef.current.cerrada()) ? (
        <button type="button" className="fo-btn fo-btn-secondary" onClick={() => void abrirVentanita()}>Abrir ventanita</button>
      ) : null}
      {fase === "subiendo" && !fallo ? <p className="text-sm">Subiendo parte {avance.hechos} de {avance.total}… podés seguir usando la computadora.</p> : null}
      {fase === "subiendo" && fallo ? <button type="button" className="fo-btn fo-btn-secondary" onClick={() => { setFase("listo"); setFallo(false); }}>Volver</button> : null}
      {fase === "terminada" ? <a className="fo-btn fo-btn-primary" href="/digitalizacion">Ver grabaciones</a> : null}
    </div>
  );
}
