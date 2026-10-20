// apps/fotoffice/components/digitalizacion/dvd.tsx
"use client";

import { useRef, useState } from "react";
import { buscarTrabajosAction, cerrarGrabacionAction, crearGrabacionAction } from "@/app/(shell)/digitalizacion/actions";
import { elegirCarpeta } from "@/lib/digitalizacion/cliente/apis-navegador";
import { ColaDeSubida, almacenEnMemoria, idParte, type ResumenCola } from "@/lib/digitalizacion/cliente/cola";
import { cortesDeArchivo, vobsEnOrden } from "@/lib/digitalizacion/dvd";
import { crearSubidor, type Continuacion } from "./estacion";
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

export function DigitalizarDvd({ continuar }: { continuar: Continuacion | null }) {
  const [fase, setFase] = useState<"listo" | "subiendo" | "terminada">("listo");
  const [aviso, setAviso] = useState<string | null>(null);
  const [avance, setAvance] = useState({ hechos: 0, total: 0 });
  const [sinPedido, setSinPedido] = useState(true);
  const [proyectoId, setProyectoId] = useState<string | null>(null);
  const [trabajos, setTrabajos] = useState<{ id: string; numero: string; nombre: string }[]>([]);

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
    try {
      const archivos = await archivosDe(await carpetaVideoTs(await elegirCarpeta()));
      if (archivos.length === 0) { setAviso("No hay videos en esa carpeta (sólo menús o nada)."); return; }
      if (!(await abrirVentanita())) setAviso("No se pudo abrir la ventanita; el DVD se sube igual.");
      let grabacionId = continuar?.grabacionId ?? null;
      if (!grabacionId) {
        const r = await crearGrabacionAction({
          tipo: "DVD", proyectoId: sinPedido ? null : proyectoId, cassetteNumero: null, calidad: null, mimeType: "video/dvd",
          corregirProporcion: false, equipoId: null, dvdArchivos: archivos.map((f) => ({ nombre: f.name, bytes: f.size })),
        });
        if (!r.ok) { setAviso(r.error); return; }
        grabacionId = r.id;
      }
      const id = grabacionId;
      const pedacitos = archivos.flatMap((f) => cortesDeArchivo(f.size).map((c) => f.slice(c.desde, c.hasta)));
      setAvance({ hechos: 0, total: pedacitos.length });
      setFase("subiendo");
      const pintar = (r: ResumenCola) => {
        const hechos = pedacitos.length - r.pendientes;
        setAvance({ hechos, total: pedacitos.length });
        const estado: EstadoVentanita = { modo: "DVD", stream: null, segundos: 0, bytesPendientes: r.bytesPendientes, ultimoError: r.ultimoError, sinImagenHaceSeg: null, minutosSinSenal: 0, avanceDvd: { hechos, total: pedacitos.length }, terminando: false };
        ultimoEstado.current = estado;
        if (ventanitaRef.current && !ventanitaRef.current.cerrada()) ventanitaRef.current.mostrar(estado);
      };
      const cola = new ColaDeSubida(almacenEnMemoria(), crearSubidor(), { alCambiar: pintar });
      await Promise.all(pedacitos.map((datos, indice) => cola.agregar({ id: idParte(id, 1, indice), grabacionId: id, tramo: 1, indice, datos })));
      await cola.vaciada();
      const r = await cerrarGrabacionAction(id, { tramo: 1, duracionSeg: 0, primeraImagenSeg: null, ultimaImagenSeg: null, sinImagen: false, tramosSinSenal: [], motivoFin: "DVD_COMPLETO" });
      setFase("terminada");
      setAviso(r.ok ? "DVD subido completo." : r.error);
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setAviso(e instanceof Error ? e.message : "No se pudo leer el DVD.");
    } finally {
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
        <button type="button" className="fo-btn" onClick={() => void abrirVentanita()}>Abrir ventanita</button>
      ) : null}
      {fase === "subiendo" ? <p className="text-sm">Subiendo parte {avance.hechos} de {avance.total}… podés seguir usando la computadora.</p> : null}
      {fase === "terminada" ? <a className="fo-btn fo-btn-primary" href="/digitalizacion">Ver grabaciones</a> : null}
    </div>
  );
}
