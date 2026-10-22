"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cerrarGrabacionAction, confirmarParteAction, continuarGrabacionAction, crearGrabacionAction, guardarEquipoAction, latidoAction, pedirParteAction, buscarTrabajosAction } from "@/app/(shell)/digitalizacion/actions";
import { CALIDADES, TOPE_SEGUNDOS, type Calidad } from "@/lib/digitalizacion/constants";
import { Analizador } from "@/lib/digitalizacion/cliente/analisis";
import type { MensajeDelWorker } from "@/lib/digitalizacion/cliente/analisis.worker";
import { almacenIndexedDb } from "@/lib/digitalizacion/cliente/almacen-indexeddb";
import { navegadorCompatible } from "@/lib/digitalizacion/cliente/apis-navegador";
import { AVISO_SIN_ESPACIO, ColaDeSubida, ErrorDefinitivo, idParte, type ParteEnCola, type ResumenCola } from "@/lib/digitalizacion/cliente/cola";
import { faltantesParaGrabar } from "@/lib/digitalizacion/cliente/faltantes";
import { elegirFormato, elegirFormatoQueFunciona } from "@/lib/digitalizacion/cliente/formato";
import { Grabador, probarFormato } from "@/lib/digitalizacion/cliente/grabador";
import type { ResumenCorte } from "@/lib/digitalizacion/senal/corte";
import { evaluarFin } from "@/lib/digitalizacion/cliente/apagado";
import { AvisoApagadoEnPagina, PanelApagado, useApagado } from "./apagado";
import { Ventanita, type EstadoVentanita } from "./ventanita";

export type EquipoGuardado = { id: string; etiqueta: string; huellaSinSenal: number[] | null; corregirProporcion: boolean };
/** `tramo`: el último tramo guardado (un VHS pide el siguiente al tocar Grabar; un DVD usa siempre el 1). */
export type Continuacion = { grabacionId: string; tramo: number; tipo: "VHS" | "DVD"; proyectoId: string | null; cassetteNumero: number | null; calidad: string | null; corregirProporcion: boolean; dvdArchivos: { nombre: string; bytes: number }[] | null };

/** Lo emite "Digitalizar DVD" (detail: true mientras sube) para que acá no se pueda grabar un VHS a la vez. */
export const EVENTO_DVD_SUBIENDO = "fo-digitalizacion-dvd-subiendo";
const LATIDO_CADA_MS = 30_000;
const RESPALDO_CADA_MS = 60_000;

const CLAVE_EQUIPO = "fo-digitalizacion-equipo";
const CLAVE_LISTA = "fo-digitalizacion-lista-ok";
const leerLocal = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardarLocal = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento local */ } };

/** Pide la URL, sube a R2 y confirma. Lo comparte "Digitalizar DVD". */
export function crearSubidor() {
  return async (p: ParteEnCola) => {
    const r = await pedirParteAction({ grabacionId: p.grabacionId, tramo: p.tramo, indice: p.indice, bytes: p.datos.size });
    if (!r.ok) throw r.definitivo ? new ErrorDefinitivo(r.error) : new Error(r.error);
    if (r.yaEstaba) return;
    const res = await fetch(r.url, { method: "PUT", body: p.datos, headers: { "Content-Type": r.tipoContenido } });
    if (!res.ok) throw new Error(`El almacenamiento respondió ${res.status}`);
    const c = await confirmarParteAction({ grabacionId: p.grabacionId, tramo: p.tramo, indice: p.indice });
    if (!c.ok) throw c.definitivo ? new ErrorDefinitivo(c.error) : new Error(c.error);
  };
}

function latidoDe(resumen: ResumenCorte, tramo: number) {
  return {
    tramo,
    duracionSeg: resumen.duracionSeg,
    primeraImagenSeg: resumen.primeraImagenSeg,
    ultimaImagenSeg: resumen.ultimaImagenSeg,
    sinImagen: resumen.sinImagen,
    tramosSinSenal: resumen.tramos.map((t) => ({ ...t, tramo })),
  };
}

export function Estacion({ minutosSinSenal, equipos, continuar, dvd }: { minutosSinSenal: number; equipos: EquipoGuardado[]; continuar: Continuacion | null; dvd: ReactNode }) {
  const [compatible, setCompatible] = useState<boolean | null>(null);
  const [videos, setVideos] = useState<MediaDeviceInfo[]>([]);
  const [audios, setAudios] = useState<MediaDeviceInfo[]>([]);
  const [videoId, setVideoId] = useState("");
  const [audioId, setAudioId] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [nivelAudio, setNivelAudio] = useState(0);
  const [calidad, setCalidad] = useState<Calidad>((continuar?.calidad as Calidad) ?? "MEDIA");
  const [estirada, setEstirada] = useState(continuar?.corregirProporcion ?? false);
  const [equipo, setEquipo] = useState<EquipoGuardado | null>(null);
  const [calibrando, setCalibrando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [trabajos, setTrabajos] = useState<{ id: string; numero: string; nombre: string }[]>([]);
  const [proyectoId, setProyectoId] = useState<string | null>(continuar?.proyectoId ?? null);
  const [sinPedido, setSinPedido] = useState(continuar ? continuar.proyectoId === null : false);
  const [titulo, setTitulo] = useState("");
  const [cassette, setCassette] = useState(continuar?.cassetteNumero ?? 1);
  const [listaOk, setListaOk] = useState(false);
  const [fase, setFase] = useState<"preparando" | "iniciando" | "grabando" | "terminando" | "terminada">("preparando");
  const [cierreFallido, setCierreFallido] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [cola, setCola] = useState<ResumenCola>({ pendientes: 0, bytesPendientes: 0, ultimoError: null, descartadas: 0 });
  // Si la persona cierra la ventanita, la grabación sigue y ofrecemos volver a abrirla.
  const [ventanitaAbierta, setVentanitaAbierta] = useState(false);

  const vistaRef = useRef<HTMLVideoElement>(null);
  const colaRef = useRef<ColaDeSubida | null>(null);
  const sesion = useRef<{
    grabacionId: string; tramo: number; grabador: Grabador; analizador: Analizador; ventanita: Ventanita | null;
    resumen: ResumenCorte | null; segundos: number; sinImagen: number | null; deteniendo: boolean;
    // Pedacitos que todavía se están guardando: hay que esperarlos antes de cerrar.
    pendientes: Set<Promise<void>>;
    cierre: (ReturnType<typeof latidoDe> & { motivoFin: "MANUAL" | "SIN_SENAL" | "TOPE" }) | null;
    // Cuándo arrancó (reloj de pared) y el temporizador de respaldo de la página.
    inicioMs: number; respaldo: number | null;
    // Si la señal se perdió (capturadora desenchufada, error del grabador), se avisa al terminar.
    perdida: string | null;
  } | null>(null);
  const ultimoLatidoMs = useRef(0);
  const [dvdSubiendo, setDvdSubiendo] = useState(false);
  // Evita el doble clic en Grabar (el estado de React no cambia a tiempo).
  const iniciandoRef = useRef(false);
  const faseRef = useRef(fase);
  const montadoRef = useRef(false);
  const cerrandoRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  useEffect(() => { faseRef.current = fase; streamRef.current = stream; }, [fase, stream]);

  // Apagar la computadora al terminar (F3): "terminó todo" = grabación cerrada y cola vacía sin pérdidas.
  const apagado = useApagado(evaluarFin({ fase, cierreFallido, pendientes: cola.pendientes, descartadas: cola.descartadas }));
  // Con la casilla marcada, la ventanita queda abierta al terminar para mostrar la cuenta regresiva.
  const apagadoArmadoRef = useRef(false);
  useEffect(() => { apagadoArmadoRef.current = apagado.marcada; }, [apagado.marcada]);

  // Manda un latido con el último resumen conocido, si pasó al menos `cadaMs` desde el anterior.
  // Lo usan el worker (grabando), la cola (terminando) y el temporizador de respaldo de la página.
  const enviarLatido = useCallback((cadaMs: number) => {
    const s = sesion.current;
    if (!s || Date.now() - ultimoLatidoMs.current < cadaMs) return;
    ultimoLatidoMs.current = Date.now();
    const resumen = s.resumen ?? { duracionSeg: s.segundos, primeraImagenSeg: null, ultimaImagenSeg: null, sinImagen: true, tramos: [] };
    latidoAction(s.grabacionId, latidoDe(resumen, s.tramo)).catch(() => { /* el próximo latido lo reintenta */ });
  }, []);

  useEffect(() => {
    const f = (e: Event) => setDvdSubiendo(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(EVENTO_DVD_SUBIENDO, f);
    return () => window.removeEventListener(EVENTO_DVD_SUBIENDO, f);
  }, []);

  // Compatibilidad, cola persistente (sube primero lo que quedó de antes) y la lista de chequeo.
  useEffect(() => {
    setCompatible(navegadorCompatible());
    setListaOk(leerLocal(CLAVE_LISTA) === "si");
    if (!navegadorCompatible()) return;
    // Una sola cola por pantalla: en desarrollo (Strict Mode) el efecto corre dos veces y subiría doble.
    if (colaRef.current) return;
    const c = new ColaDeSubida(almacenIndexedDb(), crearSubidor(), {
      alCambiar: (r) => {
        setCola(r);
        if (r.ultimoError === AVISO_SIN_ESPACIO) setAviso(AVISO_SIN_ESPACIO);
        // Al terminar ya no llegan mensajes del worker: sin esto, una subida larga parecería Interrumpida.
        if (sesion.current?.deteniendo) enviarLatido(LATIDO_CADA_MS);
      },
    });
    colaRef.current = c;
    void c.reanudar();
  }, [enviarLatido]);

  // Pedir permiso una vez para ver los nombres de los dispositivos.
  const cargarDispositivos = useCallback(async () => {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    s.getTracks().forEach((t) => t.stop());
    const todos = await navigator.mediaDevices.enumerateDevices();
    setVideos(todos.filter((d) => d.kind === "videoinput"));
    setAudios(todos.filter((d) => d.kind === "audioinput"));
    const guardado = JSON.parse(leerLocal(CLAVE_EQUIPO) ?? "{}") as { video?: string; audio?: string };
    setVideoId(todos.find((d) => d.kind === "videoinput" && d.label === guardado.video)?.deviceId ?? "");
    setAudioId(todos.find((d) => d.kind === "audioinput" && d.label === guardado.audio)?.deviceId ?? "");
  }, []);

  // Abrir la vista previa con el equipo elegido.
  useEffect(() => {
    if (!videoId || !audioId) return;
    let vivo: MediaStream | null = null;
    let cancelado = false;
    void navigator.mediaDevices
      .getUserMedia({
        video: { deviceId: { exact: videoId }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
        audio: { deviceId: { exact: audioId }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      .then((s) => {
        if (cancelado) { s.getTracks().forEach((t) => t.stop()); return; }
        vivo = s;
        setStream(s);
        const etiquetaVideo = s.getVideoTracks()[0]?.label ?? "";
        guardarLocal(CLAVE_EQUIPO, JSON.stringify({ video: etiquetaVideo, audio: s.getAudioTracks()[0]?.label ?? "" }));
        const e = equipos.find((x) => x.etiqueta === etiquetaVideo) ?? null;
        setEquipo(e);
        if (e && !continuar) setEstirada(e.corregirProporcion);
      })
      .catch(() => { setStream(null); setAviso("No pudimos abrir la capturadora. ¿Está abierta en Meet, Zoom u otro programa?"); });
    return () => { cancelado = true; if (faseRef.current === "preparando" || faseRef.current === "iniciando") vivo?.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, audioId]);

  // Vista previa y medidor de audio (nunca suena por los parlantes).
  useEffect(() => {
    if (!stream) return;
    if (vistaRef.current) vistaRef.current.srcObject = stream;
    const ac = new AudioContext();
    const an = ac.createAnalyser();
    ac.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const id = window.setInterval(() => {
      an.getByteTimeDomainData(buf);
      setNivelAudio(Math.min(1, Math.max(...buf.map((v) => Math.abs(v - 128))) / 128));
    }, 200);
    return () => { window.clearInterval(id); void ac.close(); };
  }, [stream]);

  const guardarEquipo = async (cambios: { huellaSinSenal?: number[] | null; corregirProporcion?: boolean }) => {
    const etiqueta = stream?.getVideoTracks()[0]?.label;
    if (!etiqueta) return;
    const nuevo = { etiqueta, huellaSinSenal: cambios.huellaSinSenal ?? equipo?.huellaSinSenal ?? null, corregirProporcion: cambios.corregirProporcion ?? estirada };
    const r = await guardarEquipoAction(nuevo);
    if (r.ok) setEquipo({ id: r.id, ...nuevo });
    else setAviso(r.error);
  };

  const calibrar = async () => {
    if (!stream) return;
    setCalibrando(true);
    const a = new Analizador(() => {});
    try {
      await guardarEquipo({ huellaSinSenal: await a.calibrar(stream.getVideoTracks()[0]) });
      setAviso("Listo: ya reconocemos la pantalla sin señal de este equipo.");
    } catch {
      setAviso("No pudimos calibrar. Probá de nuevo con la videocasetera apagada.");
    } finally {
      a.detener();
      setCalibrando(false);
    }
  };

  const buscar = async (q: string) => {
    setBusqueda(q);
    const r = await buscarTrabajosAction(q);
    if (r.ok) setTrabajos(r.trabajos);
  };

  // La lista de pedidos arranca con los últimos trabajos: vacía parecía que no había nada para elegir.
  useEffect(() => {
    if (continuar) return;
    void buscarTrabajosAction("").then((r) => { if (r.ok) setTrabajos(r.trabajos); });
  }, [continuar]);

  const pintarVentanita = useCallback(() => {
    const s = sesion.current;
    if (!s?.ventanita) return;
    const e: EstadoVentanita = {
      modo: "VHS", stream, segundos: s.segundos, bytesPendientes: cola.bytesPendientes, ultimoError: cola.ultimoError,
      sinImagenHaceSeg: s.sinImagen, minutosSinSenal, avanceDvd: null, terminando: fase === "terminando",
      terminada: fase === "terminada", apagado: apagado.aviso ? { aviso: apagado.aviso, alCancelar: apagado.cancelar } : null,
    };
    s.ventanita.mostrar(e);
  }, [stream, cola, minutosSinSenal, fase, apagado.aviso, apagado.cancelar]);
  useEffect(pintarVentanita, [pintarVentanita]);

  const detener = useCallback(async (motivoFin: "MANUAL" | "SIN_SENAL" | "TOPE") => {
    const s = sesion.current;
    if (!s || s.deteniendo) return;
    s.deteniendo = true;
    if (s.respaldo !== null) { window.clearInterval(s.respaldo); s.respaldo = null; }
    setFase("terminando");
    try { await s.grabador.detener(); } catch { /* el grabador ya estaba parado */ }
    s.analizador.detener();
    // El último pedacito llega al parar y se guarda en IndexedDB antes de entrar a la cola:
    // si no lo esperamos, la cola parece vacía, cerramos y ese pedacito se descarta.
    await Promise.allSettled([...s.pendientes]);
    await colaRef.current?.vaciada();
    const resumen = s.resumen ?? { duracionSeg: s.segundos, primeraImagenSeg: null, ultimaImagenSeg: null, sinImagen: true, tramos: [] };
    s.cierre = { ...latidoDe(resumen, s.tramo), motivoFin };
    if (!apagadoArmadoRef.current) { s.ventanita?.cerrar(); s.ventanita = null; }
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null); // apaga el medidor de audio
    await cerrarRef.current();
  }, [stream]);

  // Sólo el cierre en el servidor: si falla, se reintenta sin volver a parar nada.
  const cerrar = useCallback(async () => {
    const s = sesion.current;
    if (!s?.cierre || cerrandoRef.current) return;
    cerrandoRef.current = true;
    setCierreFallido(null);
    let r: { ok: boolean; error?: string };
    try {
      r = await cerrarGrabacionAction(s.grabacionId, s.cierre);
    } catch {
      r = { ok: false, error: "No pudimos cerrar la grabación. Revisá la conexión y reintentá." };
    }
    if (r.ok) {
      setFase("terminada");
      setAviso(s.perdida ?? (s.cierre.motivoFin === "SIN_SENAL" ? `Se cortó sola: ${minutosSinSenal} minutos sin imagen.` : "Grabación terminada y subida."));
    } else {
      setCierreFallido(r.error ?? "No pudimos cerrar la grabación.");
    }
    cerrandoRef.current = false;
  }, [minutosSinSenal]);
  const cerrarRef = useRef(cerrar);
  useEffect(() => { cerrarRef.current = cerrar; }, [cerrar]);

  const alMensaje = useCallback((m: MensajeDelWorker) => {
    const s = sesion.current;
    if (!s) return;
    if (m.tipo === "error") {
      // Sin el analizador no hay latido ni corte automático: mejor parar y subir lo que hay.
      s.perdida = "Falló el análisis de la imagen y paramos la grabación. Lo grabado hasta acá se sube.";
      setAviso(s.perdida);
      void detener("MANUAL");
      return;
    }
    if (m.tipo !== "segundo") return;
    s.segundos = m.seg;
    s.sinImagen = m.sinImagenHaceSeg;
    s.resumen = m.resumen;
    // El latido sale de los mensajes del worker: los temporizadores de la página se frenan en segundo plano.
    if (m.latido) { ultimoLatidoMs.current = Date.now(); latidoAction(s.grabacionId, latidoDe(m.resumen, s.tramo)).catch(() => { /* el próximo latido lo reintenta */ }); }
    if (m.cortar) void detener("SIN_SENAL");
    else if (m.seg >= TOPE_SEGUNDOS) void detener("TOPE");
    setVentanitaAbierta(Boolean(s.ventanita && !s.ventanita.cerrada()));
    pintarVentanita();
  }, [detener, pintarVentanita]);

  // El worker y la ventanita viven toda la grabación: llaman siempre a la versión más nueva por ref,
  // no a la que existía al tocar Grabar (verían la cola y la señal viejas).
  const alMensajeRef = useRef(alMensaje);
  const detenerRef = useRef(detener);
  useEffect(() => { alMensajeRef.current = alMensaje; detenerRef.current = detener; }, [alMensaje, detener]);

  const grabar = async () => {
    if (iniciandoRef.current || sesion.current || !stream || !colaRef.current) return;
    if (!elegirFormato((m) => MediaRecorder.isTypeSupported(m))) { setAviso("Este navegador no puede grabar video. Usá Chrome o Edge actualizados."); return; }
    iniciandoRef.current = true;
    setFase("iniciando");
    // Primero la ventanita: el navegador sólo la abre dentro del clic.
    let ventanita: Ventanita | null = null;
    try { ventanita = await Ventanita.abrir(() => void detenerRef.current("MANUAL")); } catch { setAviso("No se pudo abrir la ventanita; la grabación sigue igual."); }
    // Si salieron de la pantalla mientras esperábamos, no arrancamos nada. Si la grabación ya se
    // creó o continuó, queda así: la lista la va a mostrar como Interrumpida.
    const abandonada = () => {
      if (montadoRef.current) return false;
      ventanita?.cerrar();
      stream.getTracks().forEach((t) => t.stop());
      iniciandoRef.current = false;
      return true;
    };
    if (abandonada()) return;
    const fallar = (error: string) => {
      ventanita?.cerrar();
      setAviso(error);
      iniciandoRef.current = false;
      setFase("preparando");
    };
    // "Lo soporto" no alcanza: con algunas capturadoras el codificador falla al arrancar (así se
    // cortaba la grabación al instante). Se prueba con la señal real y se usa el que graba.
    setAviso("Probando con tu capturadora el formato de grabación…");
    const eleccion = await elegirFormatoQueFunciona(
      (m) => MediaRecorder.isTypeSupported(m),
      (m) => probarFormato(stream, m, CALIDADES[calidad]),
    );
    if (abandonada()) return;
    if (!eleccion.ok) {
      return fallar(`El navegador no puede grabar con esta capturadora. Probamos: ${eleccion.fallas.join("; ")}. Probá con Chrome actualizado o con otra capturadora.`);
    }
    const mime = eleccion.mime;
    setAviso(null);
    let id: string;
    let tramo: number;
    try {
      if (continuar) {
        // El tramo nuevo se pide recién acá, no al cargar la página (recargar no debe sumar tramos).
        const r = await continuarGrabacionAction(continuar.grabacionId);
        if (abandonada()) return;
        if (!r.ok) return fallar(r.error);
        id = continuar.grabacionId;
        tramo = r.tramo;
      } else {
        const r = await crearGrabacionAction({
          titulo, tipo: "VHS", proyectoId: sinPedido ? null : proyectoId, cassetteNumero: sinPedido ? null : cassette, calidad, mimeType: mime,
          corregirProporcion: estirada, equipoId: equipo?.id ?? null, dvdArchivos: null,
        });
        if (abandonada()) return;
        if (!r.ok) return fallar(r.error);
        id = r.id;
        tramo = r.tramo;
      }
    } catch {
      if (abandonada()) return;
      return fallar("No pudimos empezar la grabación. Revisá la conexión y probá de nuevo.");
    }
    const cola = colaRef.current;
    // Se corta a mano si la capturadora se va (pista terminada) o el grabador falla.
    const perder = (mensaje: string) => {
      const s = sesion.current;
      if (!s || s.deteniendo) return;
      s.perdida = mensaje;
      setAviso(mensaje);
      void detenerRef.current("MANUAL");
    };
    const pendientes = new Set<Promise<void>>();
    const grabador = new Grabador({
      stream, mimeType: mime, bitsVideo: CALIDADES[calidad],
      alError: (detalle) => perder(`El grabador del navegador falló (${detalle}). Lo grabado hasta acá se sube.`),
      alPedacito: (datos, indice) => {
        const guardado = cola
          .agregar({ id: idParte(id, tramo, indice), grabacionId: id, tramo, indice, datos })
          .catch((e: unknown) => setAviso(`No pudimos guardar un pedacito de la grabación: ${e instanceof Error ? e.message : "error"}.`));
        pendientes.add(guardado);
        void guardado.finally(() => pendientes.delete(guardado));
      },
    });
    const analizador = new Analizador((m) => alMensajeRef.current(m));
    sesion.current = { grabacionId: id, tramo, grabador, analizador, ventanita, resumen: null, segundos: 0, sinImagen: null, deteniendo: false, pendientes, cierre: null, inicioMs: Date.now(), respaldo: null, perdida: null };
    ultimoLatidoMs.current = Date.now();
    const pista = stream.getVideoTracks()[0];
    pista?.addEventListener("ended", () => perder("La capturadora dejó de enviar imagen: se desconectó o la tomó otro programa."), { once: true });
    // Respaldo de la página: si el worker se calla, igual hay latido y se respeta el tope por reloj de pared.
    sesion.current.respaldo = window.setInterval(() => {
      const s = sesion.current;
      if (!s || s.deteniendo) return;
      enviarLatido(RESPALDO_CADA_MS);
      if ((Date.now() - s.inicioMs) / 1000 >= TOPE_SEGUNDOS) void detenerRef.current("TOPE");
    }, RESPALDO_CADA_MS);
    grabador.iniciar();
    analizador.iniciar(stream.getVideoTracks()[0], equipo?.huellaSinSenal ?? null, minutosSinSenal);
    setVentanitaAbierta(Boolean(ventanita));
    iniciandoRef.current = false;
    setFase("grabando");
  };

  // Navegar a otra pantalla de la app no dispara beforeunload: al desmontar, paramos todo.
  // Lo que ya está en la cola se sigue subiendo mientras la pestaña siga abierta.
  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      const s = sesion.current;
      if (!s || s.deteniendo) return;
      s.deteniendo = true;
      if (s.respaldo !== null) window.clearInterval(s.respaldo);
      void s.grabador.detener().catch(() => {});
      s.analizador.detener();
      s.ventanita?.cerrar();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // La ventanita que quedó abierta por el apagado se cierra cuando ya no hay nada que avisar
  // (casilla desmarcada o cancelado). Si el apagado falló, queda abierta mostrando por qué.
  useEffect(() => {
    const s = sesion.current;
    if (!s?.ventanita || fase !== "terminada" || apagado.marcada || apagado.estado.tipo === "error") return;
    s.ventanita.cerrar();
    s.ventanita = null;
  }, [fase, apagado.marcada, apagado.estado.tipo]);

  // Volver a abrir la ventanita si la cerraron: tiene que ser dentro del clic.
  const abrirVentanita = async () => {
    const s = sesion.current;
    if (!s || (s.ventanita && !s.ventanita.cerrada())) return;
    try {
      s.ventanita = await Ventanita.abrir(() => void detenerRef.current("MANUAL"));
      setVentanitaAbierta(true);
      pintarVentanita();
    } catch {
      setAviso("No se pudo abrir la ventanita; la grabación sigue igual.");
    }
  };

  // Cerrar la pestaña mientras graba o sube pide confirmación.
  useEffect(() => {
    if (fase !== "grabando" && fase !== "terminando" && cola.pendientes === 0) return;
    const f = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [fase, cola.pendientes]);

  if (compatible === false) {
    return <p className="fo-alert-error p-4 text-sm">La estación necesita Chrome o Edge de escritorio actualizados (versión 116 o mayor).</p>;
  }

  const faltan = faltantesParaGrabar({
    videoElegido: Boolean(videoId),
    audioElegido: Boolean(audioId),
    vistaPrevia: Boolean(stream),
    listaOk,
    sinPedido,
    proyectoElegido: Boolean(proyectoId),
    dvdSubiendo,
    continuando: Boolean(continuar),
  });
  const puedeGrabar = faltan.length === 0 && fase === "preparando";
  return (
    <div className="space-y-6">
      <AvisoApagadoEnPagina apagado={apagado} />
      {aviso ? <p className="fo-alert-warning p-3 text-sm">{aviso}</p> : null}
      {fase === "grabando" ? (
        <p className="fo-alert-warning p-3 text-sm">No salgas de esta página mientras graba: la grabación sigue con la ventana minimizada.</p>
      ) : null}
      {cola.pendientes > 0 && fase === "preparando" ? (
        <p className="fo-alert-warning p-3 text-sm">Subiendo {cola.pendientes} pedacitos que quedaron de una grabación anterior…</p>
      ) : null}

      {!listaOk ? (
        <div className="fo-alert-warning space-y-2 p-4 text-sm">
          <p className="font-semibold">Antes de la primera grabación, chequeá:</p>
          <p>☐ La computadora no se suspende nunca (Configuración → Sistema → Energía → Suspender: Nunca). La pantalla sí puede apagarse.</p>
          <p>☐ La capturadora no se usa en Meet, Zoom ni otro programa.</p>
          <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => { guardarLocal(CLAVE_LISTA, "si"); setListaOk(true); }}>Listo, ya lo chequeé</button>
        </div>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">1. Equipo</h2>
        {videos.length === 0 ? (
          <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => void cargarDispositivos()}>Buscar la capturadora</button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Video
              <select className="mt-1 block w-full rounded border p-2" value={videoId} onChange={(e) => setVideoId(e.target.value)} disabled={fase !== "preparando"}>
                <option value="">Elegí la capturadora</option>
                {videos.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Cámara sin nombre"}</option>)}
              </select>
            </label>
            <label className="text-sm">Audio
              <select className="mt-1 block w-full rounded border p-2" value={audioId} onChange={(e) => setAudioId(e.target.value)} disabled={fase !== "preparando"}>
                <option value="">Elegí la entrada de audio</option>
                {audios.map((d) => <option key={d.deviceId} value={d.deviceId}>{d.label || "Micrófono sin nombre"}</option>)}
              </select>
            </label>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">2. Vista previa</h2>
        <div className="relative w-full max-w-2xl overflow-hidden rounded bg-black" style={{ aspectRatio: "16/9" }}>
          <video ref={vistaRef} autoPlay muted playsInline className="h-full w-full object-contain" style={estirada ? { transform: "scaleX(0.75)" } : undefined} />
        </div>
        <div className="h-2 w-full max-w-2xl rounded bg-gray-200" aria-label="Nivel de audio">
          <div className="h-2 rounded bg-green-500" style={{ width: `${Math.round(nivelAudio * 100)}%` }} />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={estirada} disabled={fase !== "preparando"} onChange={(e) => { setEstirada(e.target.checked); void guardarEquipo({ corregirProporcion: e.target.checked }); }} />
          La imagen se ve estirada (la gente se ve ancha)
        </label>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" className="fo-btn fo-btn-secondary text-sm" disabled={!stream || calibrando || fase !== "preparando"} onClick={() => void calibrar()}>
            {calibrando ? "Calibrando…" : "Calibrar “sin señal”"}
          </button>
          <span>{equipo?.huellaSinSenal ? "✓ Calibrado" : "Sin calibrar: apagá la videocasetera y tocá Calibrar."}</span>
        </div>
        <label className="text-sm">Calidad
          <select className="ml-2 rounded border p-1" value={calidad} disabled={fase !== "preparando" || Boolean(continuar)} onChange={(e) => setCalidad(e.target.value as Calidad)}>
            <option value="ALTA">Alta (~2,7 GB por hora)</option>
            <option value="MEDIA">Media (~1,8 GB por hora)</option>
            <option value="BAJA">Baja (~1,2 GB por hora, deja más internet libre)</option>
          </select>
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">3. ¿De qué pedido es?</h2>
        {continuar ? (
          <p className="text-sm">Continuás la grabación (tramo {continuar.tipo === "DVD" ? 1 : continuar.tramo + 1}).</p>
        ) : (
          <>
            <label className="block text-sm">Título del video (opcional)
              <input className="mt-1 block w-full max-w-md rounded border p-2 text-sm" maxLength={120} placeholder="Ej.: Casamiento de Juan y Ana, 1998" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sinPedido} onChange={(e) => setSinPedido(e.target.checked)} /> Sin pedido (prueba)
            </label>
            {!sinPedido ? (
              <div className="space-y-2">
                <input className="w-full max-w-md rounded border p-2 text-sm" placeholder="Buscá por número de trabajo o cliente" value={busqueda} onChange={(e) => void buscar(e.target.value)} />
                <ul className="max-w-md divide-y rounded border text-sm">
                  {trabajos.map((t) => (
                    <li key={t.id}>
                      <button type="button" className={`w-full p-2 text-left ${proyectoId === t.id ? "bg-gray-100 font-semibold" : ""}`} onClick={() => setProyectoId(t.id)}>
                        {t.numero} · {t.nombre}
                      </button>
                    </li>
                  ))}
                </ul>
                <label className="text-sm">Cassette n.º
                  <input type="number" min={1} max={999} className="ml-2 w-20 rounded border p-1" value={cassette} onChange={(e) => setCassette(Math.max(1, Number(e.target.value) || 1))} />
                </label>
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-3">
        {(fase === "preparando" || fase === "iniciando") && continuar?.tipo !== "DVD" ? (
          <button type="button" className="fo-btn fo-btn-primary" disabled={!puedeGrabar} onClick={() => void grabar()}>
            {fase === "iniciando" ? "Empezando…" : "● Grabar"}
          </button>
        ) : null}
        {fase === "preparando" && continuar?.tipo !== "DVD" && faltan.length > 0 ? (
          <div className="text-sm text-gray-600">
            <p className="font-semibold">Para poder grabar falta:</p>
            <ul className="ml-5 list-disc">
              {faltan.map((f) => <li key={f}>{f}</li>)}
            </ul>
          </div>
        ) : null}
        {fase === "grabando" ? <button type="button" className="fo-btn fo-btn-danger" onClick={() => void detener("MANUAL")}>⏹ Detener</button> : null}
        {fase === "grabando" && !ventanitaAbierta ? (
          <button type="button" className="fo-btn fo-btn-secondary ml-2" onClick={() => void abrirVentanita()}>Abrir ventanita</button>
        ) : null}
        {fase === "terminando" && !cierreFallido ? <p className="text-sm">Terminando de subir… no cierres esta página.</p> : null}
        {fase === "terminando" && cierreFallido ? (
          <div className="fo-alert-error space-y-2 p-3 text-sm">
            <p>
              {cola.descartadas > 0 ? "Algunos pedacitos no se pudieron subir y no pudimos cerrar la grabación" : "Todo quedó subido, pero no pudimos cerrar la grabación"}: {cierreFallido}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => void cerrar()}>Reintentar cierre</button>
              <a className="fo-btn fo-btn-secondary text-sm" href="/digitalizacion">Ver grabaciones</a>
            </div>
          </div>
        ) : null}
        {fase === "terminada" ? <a className="fo-btn fo-btn-primary" href="/digitalizacion">Ver grabaciones</a> : null}
        {continuar?.tipo !== "DVD" ? <PanelApagado apagado={apagado} /> : null}
      </section>

      {fase === "preparando" && !continuar ? <section className="space-y-3 border-t pt-6">{dvd}</section> : null}
      {continuar?.tipo === "DVD" ? dvd : null}
    </div>
  );
}
