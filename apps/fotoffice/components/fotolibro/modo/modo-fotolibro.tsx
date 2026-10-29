"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PhotoCrop, TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import {
  escribirEstadoFotolibro,
  fotosSinOriginal,
  leerEstadoFotolibro,
  usosPorFoto,
  type EstadoFotolibro,
  type FotoDelLibro,
  type Lado,
  type TapaDelLibro,
} from "@/lib/fotolibro/modo/estado";
import { modelosParaLibro } from "@/lib/fotolibro/tapa/catalogo";
import { DISENOS_TAPA, bloquesDeTapa, disenoDeTapa, esDisenoIlustrado, tapaDelLibro } from "@/lib/fotolibro/tapa/bloques";
import { TapaVista, type CaraTapa } from "./tapa-vista";
import { PanelTapa } from "./panel-tapa";
import { cantidadDeDistribuciones, generarBloques, idDeBloque, marcosEnProporcion, permutarHojas, reindexarHojas } from "@/lib/fotolibro/modo/bloques";
import type { Favorita } from "@/lib/fotolibro/favoritas-tipos";
import {
  agregarAPagina,
  agregarPliego,
  armarPliego,
  cambiarModo,
  cambiarVariante,
  confirmarOriginales,
  aplicarFavorita,
  cambiarFondo,
  duplicarPliego,
  moverPliego,
  ordenTrasMover,
  intercambiar,
  moverAPagina,
  quitarDePagina,
  quitarPliego,
  reemplazar,
  sumarFotos,
  vaciarPliego,
  type Ubicacion,
} from "@/lib/fotolibro/modo/operaciones";
import { ExportarBoton } from "./exportar-boton";
import { GoogleFontsLoader } from "@repo/template-editor-ui";
import { estiloPorId } from "@/lib/fotolibro/estilos/catalogo";
import type { EstiloFotolibro, RolTexto } from "@/lib/fotolibro/estilos/tipos";
import { claveDeMedida, medidasDelLienzo } from "@/lib/fotolibro/modo/bloques";
import { dibujarYSubirFondos, dibujarYSubirPortada } from "./aplicar-estilo";
import { claveDeArte } from "@/lib/fotolibro/tapa/ilustrada";
import { SelectorEstilo } from "./selector-estilo";
import { ArmadoAutomatico } from "./armado-automatico";
import { VistaLibro } from "./vista-libro";
import { RevisionClienteVentana, useRevisionCliente } from "./revision-cliente";
import { revisarLibro } from "@/lib/fotolibro/modo/revision";
import { conCuerpo, moverTexto, nuevoTexto } from "@/lib/fotolibro/modo/textos-libres";
import { ordenarFotos } from "@/lib/fotolibro/modo/armado";
import { PanelLateral } from "./panel-lateral";
import { PliegoVista } from "./pliego-vista";
import { TiraFotos } from "./tira-fotos";
import { confirmarOriginalesEnServidor, subirFoto } from "./subir-fotos";
import { detectarCarasDeUrl } from "./detectar-caras";

type Props = {
  templateId: string;
  versionId: string;
  /** Adónde vuelve "Salir": la lista de fotolibros. */
  salirHref: string;
  /** El editor de siempre, para agregar textos o mover algo a mano. */
  libreHref: string;
};

type Cargado = {
  nombre: string;
  canvas: TemplateV2Canvas;
  meta: Record<string, unknown>;
  bindings: unknown[];
  revision: number;
};

type Guardado = "al-dia" | "pendiente" | "guardando" | "error";

const RUTA_GUARDAR = (t: string, v: string) =>
  `/api/template-v2/templates/${encodeURIComponent(t)}/versions/${encodeURIComponent(v)}/save`;

const esEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));

/**
 * El Modo Fotolibro: la pantalla para armar un libro como en los diseñadores de fotolibro.
 *
 * Tres zonas fijas: el pliego grande en el centro (con el anterior y el siguiente), la tira con
 * todas las fotos del trabajo abajo y el panel de la foto o del pliego a la derecha. Las fotos se
 * acomodan solas al soltarlas; lo que se guarda son bloques comunes del editor, así que la vista
 * previa, el diseño libre y la impresión funcionan igual que con cualquier plantilla.
 */
export function ModoFotolibro({ templateId, versionId, salirHref, libreHref }: Props) {
  const router = useRouter();
  const [cargado, setCargado] = useState<Cargado | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [estado, setEstado] = useState<EstadoFotolibro | null>(null);
  const [bloques, setBloques] = useState<TemplateV2Block[]>([]);
  const [pliego, setPliego] = useState(0);
  const [seleccionTira, setSeleccionTira] = useState<string[]>([]);
  const [seleccionada, setSeleccionada] = useState<Ubicacion | null>(null);
  const [recortando, setRecortando] = useState<string | null>(null);
  const [guardado, setGuardado] = useState<Guardado>("al-dia");
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState<{ hechas: number; total: number; errores: string[] } | null>(null);
  // Originales que siguen subiendo de fondo (la foto ya se puede usar).
  const [originales, setOriginales] = useState(0);
  const [eligiendoEstilo, setEligiendoEstilo] = useState(false);
  const [armando, setArmando] = useState(false);
  const [vistaLibro, setVistaLibro] = useState(false);
  const [textoElegido, setTextoElegido] = useState<string | null>(null);
  const [favoritas, setFavoritas] = useState<Favorita[]>([]);
  const [viendoCliente, setViendoCliente] = useState(false);
  const cliente = useRevisionCliente(templateId);

  // Las favoritas son de la persona (valen en todos sus libros): se traen una vez.
  useEffect(() => {
    fetch("/api/fotolibro/favoritas", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { favoritas: [] }))
      .then((d: { favoritas?: Favorita[] }) => setFavoritas(Array.isArray(d.favoritas) ? d.favoritas : []))
      .catch(() => {});
  }, []);
  const pedirFavoritas = useCallback(async (init: RequestInit, url = "/api/fotolibro/favoritas") => {
    const r = await fetch(url, { credentials: "include", headers: { "Content-Type": "application/json" }, ...init });
    const d = (await r.json().catch(() => ({}))) as { favoritas?: Favorita[]; error?: string };
    if (!r.ok) throw new Error(d.error || "No se pudieron guardar las favoritas.");
    setFavoritas(d.favoritas ?? []);
  }, []);
  const [aplicandoEstilo, setAplicandoEstilo] = useState<string | null>(null);
  // La tapa es la "hoja -1": va antes del primer pliego.
  const [caraTapa, setCaraTapa] = useState<CaraTapa | null>(null);
  const [recortandoTapa, setRecortandoTapa] = useState(false);

  // Lo último, para el guardado y las subidas, que corren fuera del ciclo de dibujo.
  const ref = useRef({ cargado, estado, bloques });
  ref.current = { cargado, estado, bloques };
  const historia = useRef<{ estado: EstadoFotolibro; bloques: TemplateV2Block[] }[]>([]);
  // Lo deshecho, para rehacerlo (⌘⇧Z). Cualquier cambio nuevo lo descarta.
  const futuro = useRef<{ estado: EstadoFotolibro; bloques: TemplateV2Block[] }[]>([]);
  const [pasos, setPasos] = useState({ atras: 0, adelante: 0 });
  const contarPasos = () => setPasos({ atras: historia.current.length, adelante: futuro.current.length });
  const guardandoRef = useRef(false);

  // ── Carga ──
  useEffect(() => {
    let vigente = true;
    fetch(RUTA_GUARDAR(templateId, versionId), { credentials: "include", cache: "no-store" })
      .then(async (r) => {
        const data = (await r.json().catch(() => ({}))) as Record<string, unknown>;
        if (!r.ok || data.ok !== true) throw new Error(typeof data.error === "string" ? data.error : "No se pudo abrir el fotolibro.");
        return data;
      })
      .then((data) => {
        if (!vigente) return;
        const meta = (data.meta && typeof data.meta === "object" && !Array.isArray(data.meta) ? data.meta : {}) as Record<string, unknown>;
        const blocks = (Array.isArray(data.blocks) ? data.blocks : []) as TemplateV2Block[];
        const paginas = Math.max(
          Number(meta.templatePageCount ?? 1) || 1,
          ...blocks.map((b) => (b.pageIndex ?? 0) + 1),
        );
        setCargado({
          nombre: ((data.template as { name?: string } | undefined)?.name ?? "Fotolibro").trim(),
          canvas: data.canvas as TemplateV2Canvas,
          meta,
          bindings: Array.isArray(data.variableBindings) ? data.variableBindings : [],
          revision: Number(data.revision ?? 0),
        });
        setEstado(leerEstadoFotolibro(meta, paginas));
        setBloques(blocks);
      })
      .catch((e) => vigente && setErrorCarga(e instanceof Error ? e.message : "No se pudo abrir el fotolibro."));
    return () => {
      vigente = false;
    };
  }, [templateId, versionId]);

  // ── Guardado ──
  const guardar = useCallback(async (): Promise<boolean> => {
    const { cargado: c, estado: e, bloques: b } = ref.current;
    if (!c || !e || guardandoRef.current) return false;
    guardandoRef.current = true;
    setGuardado("guardando");
    try {
      const r = await fetch(RUTA_GUARDAR(templateId, versionId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          revision: c.revision,
          canvas: c.canvas,
          blocks: b.map((x) => ({
            id: x.id,
            type: x.type,
            name: x.name ?? undefined,
            pageIndex: x.pageIndex ?? 0,
            layout: { ...x.layout, opacity: x.layout.opacity ?? 1, locked: x.layout.locked ?? false },
            configJson: x.configJson,
          })),
          variableBindings: c.bindings,
          meta: escribirEstadoFotolibro(c.meta, e),
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string; revision?: number };
      if (r.status === 409) {
        throw new Error("El fotolibro cambió en otra pestaña o en el diseño libre. Recargá la página para seguir sin pisar esos cambios.");
      }
      if (!r.ok || data.ok !== true) throw new Error(data.error || "No se pudo guardar.");
      setCargado((prev) => (prev ? { ...prev, revision: typeof data.revision === "number" ? data.revision : prev.revision + 1 } : prev));
      // Si hubo cambios mientras se guardaba, queda pendiente otra vuelta.
      setGuardado((g) => (g === "guardando" ? "al-dia" : g));
      setErrorGuardado(null);
      return true;
    } catch (err) {
      setGuardado("error");
      setErrorGuardado(err instanceof Error ? err.message : "No se pudo guardar.");
      return false;
    } finally {
      guardandoRef.current = false;
    }
  }, [templateId, versionId]);

  useEffect(() => {
    if (guardado !== "pendiente") return;
    const t = setTimeout(() => void guardar(), 1500);
    return () => clearTimeout(t);
  }, [guardado, estado, bloques, guardar]);

  useEffect(() => {
    const avisar = (e: BeforeUnloadEvent) => {
      if (guardado === "pendiente" || guardado === "guardando" || originales > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [guardado, originales]);

  // ── Cambios ──
  const aplicar = useCallback(
    (cambio: (e: EstadoFotolibro) => EstadoFotolibro, ajusteBloques?: (b: TemplateV2Block[]) => TemplateV2Block[]) => {
      const { cargado: c, estado: e, bloques: b } = ref.current;
      if (!c || !e) return;
      const nuevo = cambio(e);
      if (nuevo === e) return;
      historia.current = [...historia.current.slice(-49), { estado: e, bloques: b }];
      futuro.current = [];
      contarPasos();
      const base = ajusteBloques ? ajusteBloques(b) : b;
      const siguientes = generarBloques(nuevo, c.canvas, base);
      ref.current = { cargado: c, estado: nuevo, bloques: siguientes };
      setEstado(nuevo);
      setBloques(siguientes);
      setGuardado("pendiente");
    },
    [],
  );

  /** Cambios que no van al deshacer (el encuadre mientras se arrastra el deslizador). */
  const aplicarSinHistoria = useCallback((cambio: (e: EstadoFotolibro) => EstadoFotolibro) => {
    const { cargado: c, estado: e, bloques: b } = ref.current;
    if (!c || !e) return;
    const nuevo = cambio(e);
    ref.current = { cargado: c, estado: nuevo, bloques: b };
    setEstado(nuevo);
    setGuardado("pendiente");
  }, []);

  const cambiarRecorte = useCallback((blockId: string, crop: PhotoCrop | null) => {
    setBloques((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        // Encuadrar a mano deja de ser automático: ya no se recalcula con las caras.
        const { crop: _viejo, cropAuto: _auto, ...resto } = b.configJson;
        return { ...b, configJson: crop ? { ...resto, crop } : resto };
      }),
    );
    setGuardado("pendiente");
  }, []);

  /** Cambios de bloques sueltos (textos a mano), sin tocar las fotos del libro. */
  const cambiarBloques = useCallback((cambio: (b: TemplateV2Block[]) => TemplateV2Block[], conHistoria: boolean) => {
    const { estado: e, bloques: b } = ref.current;
    if (!e) return;
    if (conHistoria) {
      historia.current = [...historia.current.slice(-49), { estado: e, bloques: b }];
      futuro.current = [];
      contarPasos();
    }
    const nuevos = cambio(b);
    ref.current = { ...ref.current, bloques: nuevos };
    setBloques(nuevos);
    setGuardado("pendiente");
  }, []);
  const moviendoTexto = useRef(false);

  const volverA = (paso: { estado: EstadoFotolibro; bloques: TemplateV2Block[] }) => {
    ref.current = { ...ref.current, estado: paso.estado, bloques: paso.bloques };
    setEstado(paso.estado);
    setBloques(paso.bloques);
    setGuardado("pendiente");
  };

  const deshacer = useCallback(() => {
    const ultimo = historia.current.pop();
    const { estado: e, bloques: b } = ref.current;
    if (!ultimo || !e) return;
    futuro.current = [...futuro.current, { estado: e, bloques: b }];
    volverA(ultimo);
    contarPasos();
  }, []);

  const rehacer = useCallback(() => {
    const siguiente = futuro.current.pop();
    const { estado: e, bloques: b } = ref.current;
    if (!siguiente || !e) return;
    historia.current = [...historia.current, { estado: e, bloques: b }];
    volverA(siguiente);
    contarPasos();
  }, []);

  const cantidad = estado?.pliegos.length ?? 1;
  const irA = useCallback(
    (i: number) => {
      setPliego(Math.max(-1, Math.min(cantidad - 1, i)));
      setSeleccionada(null);
      setRecortando(null);
      setTextoElegido(null);
      setCaraTapa(null);
      setRecortandoTapa(false);
    },
    [cantidad],
  );

  // ── Subida ──
  // Cola de originales: dos a la vez, para no quitarle ancho de banda a las vistas que se ven ya.
  const colaOriginales = useRef<{ clave: string; subir: () => Promise<void> }[]>([]);
  const subiendoOriginales = useRef(0);
  const marcarOriginal = useCallback(
    (resultado: Record<string, boolean>) => aplicarSinHistoria((e) => confirmarOriginales(e, resultado)),
    [aplicarSinHistoria],
  );
  const seguirConOriginales = useCallback(() => {
    while (subiendoOriginales.current < 2 && colaOriginales.current.length) {
      const tarea = colaOriginales.current.shift()!;
      subiendoOriginales.current += 1;
      void (async () => {
        let llego = false;
        try {
          await tarea.subir();
          llego = (await confirmarOriginalesEnServidor(templateId, [tarea.clave]))[tarea.clave] === true;
        } catch {
          llego = false;
        }
        marcarOriginal({ [tarea.clave]: llego });
        subiendoOriginales.current -= 1;
        setOriginales((n) => Math.max(0, n - 1));
        seguirConOriginales();
      })();
    }
  }, [templateId, marcarOriginal]);

  const subir = useCallback(
    async (archivos: File[]) => {
      let hechas = 0;
      const errores: string[] = [];
      setSubiendo({ hechas, total: archivos.length, errores });
      const cola = [...archivos];
      const trabajador = async () => {
        while (cola.length) {
          const archivo = cola.shift()!;
          try {
            // Primer paso (vista y miniatura): la foto ya se puede usar. El original va a la cola.
            const { foto, subirOriginal } = await subirFoto(templateId, archivo);
            aplicar((e) => sumarFotos(e, [foto]));
            if (foto.claveOriginal) {
              colaOriginales.current.push({ clave: foto.claveOriginal, subir: subirOriginal });
              setOriginales((n) => n + 1);
              seguirConOriginales();
            }
          } catch (err) {
            errores.push(err instanceof Error ? err.message : `${archivo.name}: falló la subida.`);
          }
          hechas += 1;
          setSubiendo({ hechas, total: archivos.length, errores: [...errores] });
        }
      };
      await Promise.all([trabajador(), trabajador(), trabajador()]);
      setTimeout(() => setSubiendo((s) => (s && s.errores.length ? s : null)), errores.length ? 8000 : 1500);
      if (errores.length) setErrorGuardado(errores.slice(0, 3).join(" · "));
    },
    [templateId, aplicar, seguirConOriginales],
  );

  // Fotos subidas antes del encuadre por caras: se buscan de fondo, de a una, sin apurar a nadie.
  const buscandoCaras = useRef(false);
  useEffect(() => {
    if (!estado || buscandoCaras.current) return;
    const pendientes = estado.fotos.filter((f) => f.caras === undefined).map((f) => ({ id: f.id, vista: f.vista }));
    if (!pendientes.length) return;
    buscandoCaras.current = true;
    void (async () => {
      for (const p of pendientes) {
        const caras = await detectarCarasDeUrl(p.vista);
        // Si no se pudo buscar (sin internet, sin permiso para leer la imagen), se deja para la
        // próxima vez que se abra el libro: no se reintenta en cada cambio.
        if (caras === null) return;
        aplicarSinHistoria((e) => ({ ...e, fotos: e.fotos.map((f) => (f.id === p.id ? { ...f, caras } : f)) }));
        // Con caras nuevas, el encuadre automático de esa foto se recalcula al regenerar.
        const { cargado: c, estado: e, bloques: b } = ref.current;
        if (c && e && caras.length) {
          const nuevos = generarBloques(e, c.canvas, b);
          ref.current = { cargado: c, estado: e, bloques: nuevos };
          setBloques(nuevos);
        }
      }
      buscandoCaras.current = false;
    })();
  }, [estado, aplicarSinHistoria]);

  // Al abrir: originales que quedaron a mitad de camino (se cerró la pestaña). Se revisan una vez.
  const revisados = useRef(false);
  useEffect(() => {
    if (!estado || revisados.current) return;
    revisados.current = true;
    const claves = estado.fotos.map((f) => f.claveOriginal).filter((c): c is string => Boolean(c));
    if (claves.length) void confirmarOriginalesEnServidor(templateId, claves).then(marcarOriginal).catch(() => {});
  }, [estado, templateId, marcarOriginal]);

  // ── Estilo ──
  const elegirEstilo = useCallback(
    async (estilo: EstiloFotolibro) => {
      const c = ref.current.cargado;
      if (!c) return;
      setAplicandoEstilo(estilo.id);
      try {
        const fondos = await dibujarYSubirFondos(templateId, estilo, medidasDelLienzo(c.canvas));
        aplicar((e) => ({
          ...e,
          estilo: { id: estilo.id, medida: claveDeMedida(c.canvas), fondos, textos: e.estilo?.textos ?? {} },
          margenMm: estilo.margenMm ?? e.margenMm,
          separacionMm: estilo.separacionMm ?? e.separacionMm,
        }));
        setEligiendoEstilo(false);
      } catch (err) {
        setErrorGuardado(err instanceof Error ? err.message : "No se pudo aplicar el estilo.");
      } finally {
        setAplicandoEstilo(null);
      }
    },
    [templateId, aplicar],
  );

  // ── Teclado ──
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (recortando || recortandoTapa || eligiendoEstilo || armando || viendoCliente || esEditable(ev.target)) return;
      const tecla = ev.key.toLowerCase();
      if ((ev.metaKey || ev.ctrlKey) && (tecla === "y" || (tecla === "z" && ev.shiftKey))) {
        ev.preventDefault();
        rehacer();
        return;
      }
      if ((ev.metaKey || ev.ctrlKey) && tecla === "z") {
        ev.preventDefault();
        deshacer();
        return;
      }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      // G: todo el libro de un vistazo (y de vuelta al pliego).
      if (tecla === "g") {
        ev.preventDefault();
        setVistaLibro((v) => !v);
        return;
      }
      if (vistaLibro) return;
      if (ev.key === "ArrowLeft") return void (ev.preventDefault(), irA(pliego - 1));
      if (ev.key === "ArrowRight") return void (ev.preventDefault(), irA(pliego + 1));
      if (pliego < 0) {
        if (["a", "q", "s", "w", "arrowup", "arrowdown"].includes(tecla)) {
          ev.preventDefault();
          const paso = tecla === "a" || tecla === "s" || tecla === "arrowdown" ? 1 : -1;
          aplicar((e) => {
            if (!e.tapa) return e;
            // Sin estilo, las ilustradas no se ofrecen.
            const lista = DISENOS_TAPA.filter((d) => e.estilo || !esDisenoIlustrado(d.id));
            const i = lista.findIndex((d) => d.id === disenoDeTapa(e.tapa!.diseno));
            const n = lista.length;
            return { ...e, tapa: { ...e.tapa, diseno: lista[(((i + paso) % n) + n) % n]!.id } };
          });
          return;
        }
        if ((ev.key === "Delete" || ev.key === "Backspace") && caraTapa) {
          ev.preventDefault();
          const campo = caraTapa === "tapa" ? "fotoId" : "contratapaFotoId";
          aplicar((e) => (e.tapa ? { ...e, tapa: { ...e.tapa, [campo]: null } } : e));
          setCaraTapa(null);
        }
        return;
      }
      if (ev.key === "Enter" && seleccionTira.length) {
        ev.preventDefault();
        // En el orden de la tira, no en el de los clics.
        aplicar((e) => armarPliego(e, pliego, ordenarFotos(e.fotos, e.orden).map((f) => f.id).filter((id) => seleccionTira.includes(id))));
        setSeleccionTira([]);
        return;
      }
      if ((ev.key === "Delete" || ev.key === "Backspace") && textoElegido) {
        ev.preventDefault();
        const id = textoElegido;
        cambiarBloques((b) => b.filter((x) => x.id !== id), true);
        setTextoElegido(null);
        return;
      }
      if ((ev.key === "Delete" || ev.key === "Backspace") && seleccionada) {
        ev.preventDefault();
        aplicar((e) => quitarDePagina(e, seleccionada));
        setSeleccionada(null);
        return;
      }
      // Las teclas de los diseñadores de fotolibro. En un pliego entero A/S avanzan y Q/W vuelven;
      // por páginas, A/Q son de la izquierda y S/W de la derecha.
      const entero = ref.current.estado?.pliegos[pliego]?.modo === "pliego";
      // ↑/↓ cambian la distribución: la del pliego entero o, por páginas, la de la página de la
      // foto elegida (la izquierda si no hay ninguna).
      const ladoFlechas: Lado = entero ? "todo" : seleccionada?.lado === "der" ? "der" : "izq";
      const atajos: Record<string, [Lado, number]> = entero
        ? { a: ["todo", 1], s: ["todo", 1], q: ["todo", -1], w: ["todo", -1], arrowdown: ["todo", 1], arrowup: ["todo", -1] }
        : { a: ["izq", 1], q: ["izq", -1], s: ["der", 1], w: ["der", -1], arrowdown: [ladoFlechas, 1], arrowup: [ladoFlechas, -1] };
      const atajo = atajos[tecla];
      if (atajo) {
        ev.preventDefault();
        aplicar((e) => cambiarVariante(e, pliego, atajo[0], atajo[1]));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recortando, recortandoTapa, caraTapa, eligiendoEstilo, armando, viendoCliente, vistaLibro, pliego, seleccionTira, seleccionada, textoElegido, cambiarBloques, aplicar, deshacer, rehacer, irA]);

  const fotosPorId = useMemo(() => new Map((estado?.fotos ?? []).map((f) => [f.id, f])), [estado]);
  const usos = useMemo(() => (estado ? usosPorFoto(estado) : new Map<string, number>()), [estado]);
  const minis = useMemo(() => new Map((estado?.fotos ?? []).map((f) => [f.id, f.mini])), [estado?.fotos]);
  const metaLibro = (cargado?.meta.fotolibro ?? {}) as { medidaId?: string; proveedorNombre?: string | null };
  const modelosTapa = useMemo(() => modelosParaLibro(metaLibro.medidaId ?? "", metaLibro.proveedorNombre), [metaLibro.medidaId, metaLibro.proveedorNombre]);
  const armadoTapa = useMemo(() => (estado ? tapaDelLibro(estado, estado.pliegos.length) : null), [estado]);
  // La portada ilustrada se dibuja (y se sube) cuando hace falta: al elegirla, o si cambian el
  // estilo, el modelo o las hojas (el lomo). Una sola a la vez.
  const [dibujandoPortada, setDibujandoPortada] = useState(false);
  const claveTapa = estado && armadoTapa && estado.estilo ? claveDeArte(estado.estilo.id, armadoTapa.modelo.id, armadoTapa.geometria) : null;
  const necesitaArte = Boolean(estado?.tapa && esDisenoIlustrado(disenoDeTapa(estado.tapa.diseno)) && claveTapa && estado.tapa.arte?.clave !== claveTapa);
  useEffect(() => {
    if (!necesitaArte || dibujandoPortada || !armadoTapa || !claveTapa) return;
    const estilo = estiloPorId(ref.current.estado?.estilo?.id);
    if (!estilo) return;
    setDibujandoPortada(true);
    dibujarYSubirPortada(templateId, estilo, armadoTapa.geometria)
      .then((url) => aplicarSinHistoria((e) => (e.tapa ? { ...e, tapa: { ...e.tapa, arte: { clave: claveTapa, url } } } : e)))
      .catch((err: unknown) => setErrorGuardado(err instanceof Error ? err.message : "No se pudo dibujar la portada."))
      .finally(() => setDibujandoPortada(false));
  }, [necesitaArte, dibujandoPortada, armadoTapa, claveTapa, templateId, aplicarSinHistoria]);

  const bloquesTapa = useMemo(
    () => (estado && cargado ? bloquesDeTapa(estado, estado.pliegos.length, medidasDelLienzo(cargado.canvas)) : []),
    [estado, cargado],
  );

  if (errorCarga) {
    return (
      <div className="grid h-full place-items-center bg-[#18191b] p-6 text-center text-white">
        <div className="space-y-3">
          <p>{errorCarga}</p>
          <Link href={salirHref} className="underline">
            Volver a los fotolibros
          </Link>
        </div>
      </div>
    );
  }
  if (!cargado || !estado) {
    return <div className="grid h-full place-items-center bg-[#18191b] text-sm text-white/60">Abriendo el fotolibro…</div>;
  }

  const bloqueElegido = seleccionada ? bloques.find((b) => b.id === idDeBloque(seleccionada.pliego, seleccionada.lado, seleccionada.fotoId)) ?? null : null;
  const fotoElegida: FotoDelLibro | null = seleccionada ? fotosPorId.get(seleccionada.fotoId) ?? null : null;
  const estiloActual = estiloPorId(estado.estilo?.id);
  const ETIQUETAS: Record<RolTexto, string> = { titulo: "Título (portada)", subtitulo: "Subtítulo", fecha: "Fecha o lugar", frase: "Frase del cierre" };
  const medidas = medidasDelLienzo(cargado.canvas);
  const rolesDelEstilo = estiloActual
    ? (["apertura", "cierre"] as const)
        .flatMap((t) => estiloActual.textos?.(t, medidas) ?? [])
        .map((t) => ({ rol: t.rol, etiqueta: ETIQUETAS[t.rol], ejemplo: t.ejemplo }))
    : [];
  const estadoGuardado =
    guardado === "guardando" ? "Guardando…" : guardado === "pendiente" ? "Cambios sin guardar" : guardado === "error" ? "No se guardó" : "Guardado";

  /** Cambia la tapa; si todavía no tenía modelo, usa el primero que corresponde a este libro. */
  function cambiarTapa(cambio: (t: TapaDelLibro) => TapaDelLibro, sinHistoria = false) {
    const modeloId = estado?.tapa?.modeloId ?? modelosTapa[0]?.id;
    if (!modeloId) return;
    const base: TapaDelLibro = { modeloId, fotoId: null, encuadre: null, contratapaFotoId: null, contratapaEncuadre: null };
    const f = (e: EstadoFotolibro) => ({ ...e, tapa: cambio(e.tapa ?? base) });
    if (sinHistoria) aplicarSinHistoria(f);
    else aplicar(f);
  }
  const fotoDeTapa = caraTapa && estado.tapa ? fotosPorId.get((caraTapa === "tapa" ? estado.tapa.fotoId : estado.tapa.contratapaFotoId) ?? "") ?? null : null;

  async function salirA(href: string) {
    if (ref.current.estado && guardado !== "al-dia") await guardar();
    router.push(href);
  }

  return (
    <div className="flex h-full flex-col bg-[#18191b] text-white">
      <GoogleFontsLoader />
      {viendoCliente ? (
        <RevisionClienteVentana
          templateId={templateId}
          guardarAntes={async () => (ref.current.estado && guardado !== "al-dia" ? guardar() : true)}
          onIr={(i) => {
            setViendoCliente(false);
            setVistaLibro(false);
            irA(i);
          }}
          onCerrar={() => {
            setViendoCliente(false);
            void cliente.cargar();
          }}
        />
      ) : null}
      {armando ? (
        <ArmadoAutomatico
          estado={estado}
          elegidas={seleccionTira}
          onCerrar={() => setArmando(false)}
          onArmar={(nuevo) => {
            aplicar(() => nuevo);
            setArmando(false);
            setSeleccionTira([]);
            setSeleccionada(null);
            setPliego(0);
          }}
        />
      ) : null}
      {eligiendoEstilo ? (
        <SelectorEstilo
          medidas={medidas}
          actual={estado.estilo?.id ?? null}
          aplicando={aplicandoEstilo}
          onElegir={(e) => void elegirEstilo(e)}
          onCerrar={() => !aplicandoEstilo && setEligiendoEstilo(false)}
        />
      ) : null}
      <header className="flex flex-none items-center gap-3 border-b border-white/10 bg-[#202124] px-4 py-2 text-sm">
        <button type="button" onClick={() => void salirA(salirHref)} className="rounded px-2 py-1 text-white/80 hover:bg-white/10">
          ← Fotolibros
        </button>
        <h1 className="truncate font-semibold">{cargado.nombre}</h1>
        <span className="text-white/50">{pliego < 0 ? "Tapa" : `Pliego ${pliego + 1} de ${cantidad}`}</span>
        <span className="ml-auto flex gap-0.5">
          <button type="button" onClick={deshacer} disabled={!pasos.atras} title="Deshacer (⌘Z)" className="rounded px-1.5 py-0.5 text-white/80 hover:bg-white/10 disabled:opacity-30">
            ↶
          </button>
          <button type="button" onClick={rehacer} disabled={!pasos.adelante} title="Rehacer (⌘⇧Z)" className="rounded px-1.5 py-0.5 text-white/80 hover:bg-white/10 disabled:opacity-30">
            ↷
          </button>
        </span>
        <span className={`text-xs ${guardado === "error" ? "text-red-300" : "text-white/50"}`}>{estadoGuardado}</span>
        <button
          type="button"
          onClick={() => setViendoCliente(true)}
          title="Mandarle el libro al cliente para que lo comente y lo apruebe"
          className="relative rounded border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10"
        >
          Cliente
          {(() => {
            const r = cliente.datos?.revision;
            if (!r) return null;
            const pendientes = r.comentarios.filter((c) => !c.resuelto).length;
            return r.estado === "aprobado" ? (
              <span className="ml-1 text-emerald-300">✓</span>
            ) : pendientes ? (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-black">{pendientes}</span>
            ) : null;
          })()}
        </button>
        <button
          type="button"
          onClick={() => setVistaLibro((v) => !v)}
          title="Todos los pliegos de un vistazo, para ordenarlos (G)"
          className={`rounded border px-2.5 py-1 text-xs ${vistaLibro ? "border-[var(--fo-accent)] bg-white/10" : "border-white/15 hover:bg-white/10"}`}
        >
          {vistaLibro ? "Volver al pliego" : "Ver libro"}
        </button>
        <button
          type="button"
          onClick={() => setArmando(true)}
          disabled={!estado.fotos.length}
          title="Reparte las fotos en todo el libro, en orden y por momentos"
          className="rounded border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10 disabled:opacity-40"
        >
          ✨ Armado automático
        </button>
        <button
          type="button"
          onClick={() => void salirA(libreHref)}
          title="El editor de siempre: textos, formas y mover cosas a mano"
          className="rounded border border-white/15 px-2.5 py-1 text-xs hover:bg-white/10"
        >
          Diseño libre
        </button>
        <ExportarBoton
          templateId={templateId}
          nombre={cargado.nombre}
          cantidadPliegos={cantidad}
          conTapa={armadoTapa !== null}
          revisar={() => revisarLibro(estado, bloques, cargado.canvas)}
          onIr={(i) => {
            setVistaLibro(false);
            irA(i);
          }}
          guardarAntes={async () => (ref.current.estado && guardado !== "al-dia" ? guardar() : true)}
        />
      </header>

      {errorGuardado ? (
        <div className="flex-none bg-red-900/60 px-4 py-1.5 text-xs text-red-100">
          {errorGuardado}
          <button type="button" className="ml-3 underline" onClick={() => setErrorGuardado(null)}>
            Cerrar
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 py-4">
            {vistaLibro ? (
              <VistaLibro
                canvas={cargado.canvas}
                bloques={bloques}
                estado={estado}
                minis={minis}
                actual={pliego}
                tapa={armadoTapa ? { canvas: armadoTapa.lienzo, bloques: bloquesTapa } : null}
                onAbrir={(i) => {
                  irA(i);
                  setVistaLibro(false);
                }}
                onMover={(desde, hasta) => {
                  aplicar((e) => moverPliego(e, desde, hasta), (b) => permutarHojas(b, ordenTrasMover(cantidad, desde, hasta)));
                  if (pliego === desde) setPliego(hasta);
                }}
                onDuplicar={(i) => aplicar((e) => duplicarPliego(e, i), (b) => reindexarHojas(b, { tipo: "insertar", indice: i + 1 }))}
                onAgregar={(i) => aplicar((e) => agregarPliego(e, i), (b) => reindexarHojas(b, { tipo: "insertar", indice: i + 1 }))}
                onQuitar={(i) => {
                  aplicar((e) => quitarPliego(e, i), (b) => reindexarHojas(b, { tipo: "quitar", indice: i }));
                  setPliego((p) => Math.max(0, Math.min(p, cantidad - 2)));
                }}
              />
            ) : pliego < 0 ? (
              <TapaVista
                armado={armadoTapa}
                bloques={bloquesTapa}
                seleccion={caraTapa}
                recortando={recortandoTapa}
                aviso={modelosTapa.length ? null : "Todavía no tenemos la plantilla de tapa de este laboratorio para esta medida."}
                onSoltar={(cara, fotoId) => {
                  cambiarTapa((t) => (cara === "tapa" ? { ...t, fotoId, encuadre: null } : { ...t, contratapaFotoId: fotoId, contratapaEncuadre: null }));
                  setCaraTapa(cara);
                }}
                onSeleccionar={(c) => {
                  setCaraTapa(c);
                  if (!c) setRecortandoTapa(false);
                }}
                onEmpezarRecorte={() => setRecortandoTapa(true)}
                onRecorte={(cara, crop) => cambiarTapa((t) => (cara === "tapa" ? { ...t, encuadre: crop } : { ...t, contratapaEncuadre: crop }), true)}
                onTerminarRecorte={() => setRecortandoTapa(false)}
              />
            ) : (
            <PliegoVista
              canvas={cargado.canvas}
              bloques={bloques}
              pliego={pliego}
              cantidad={cantidad}
              modo={estado.pliegos[pliego]?.modo ?? "pliego"}
              minis={minis}
              seleccionada={seleccionada}
              recortando={recortando}
              onIrA={irA}
              onSeleccionar={(u) => {
                setSeleccionada(u);
                setTextoElegido(null);
                if (!u) setRecortando(null);
              }}
              textoElegido={textoElegido}
              onElegirTexto={(id) => {
                setTextoElegido(id);
                setSeleccionada(null);
              }}
              onMoverTexto={(id, x, y, fin) => {
                // Un solo paso de deshacer por arrastre: se guarda al empezar a mover.
                const primero = !moviendoTexto.current;
                moviendoTexto.current = !fin;
                cambiarBloques((b) => b.map((t) => (t.id === id ? moverTexto(t, x, y, cargado.canvas) : t)), primero);
              }}
              onSoltarFotos={(lado, ids) => aplicar((e) => agregarAPagina(e, pliego, lado, ids))}
              onSoltarSobreFoto={(destino, ids) =>
                aplicar((e) => (ids.length === 1 ? reemplazar(e, destino, ids[0]!) : agregarAPagina(e, destino.pliego, destino.lado, ids)))
              }
              onIntercambiar={(a, b) => aplicar((e) => intercambiar(e, a, b))}
              onMover={(desde, lado) => aplicar((e) => moverAPagina(e, desde, pliego, lado))}
              onEmpezarRecorte={setRecortando}
              onRecorte={(id, crop) => cambiarRecorte(id, crop)}
              onTerminarRecorte={() => setRecortando(null)}
            />
            )}
          </div>
          <div className="flex flex-none items-center justify-center gap-1 pb-2">
            <button
              type="button"
              onClick={() => irA(-1)}
              title="Tapa"
              className={`mr-1 h-2.5 rounded-sm text-[0] transition-all ${pliego < 0 ? "w-6 bg-[var(--fo-accent)]" : armadoTapa ? "w-3 bg-white/50" : "w-3 bg-white/15"}`}
            >
              Tapa
            </button>
            {estado.pliegos.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => irA(i)}
                title={`Pliego ${i + 1}`}
                className={`h-2.5 rounded-full transition-all ${i === pliego ? "w-6 bg-[var(--fo-accent)]" : p.todo.fotos.length || p.izq.fotos.length || p.der.fotos.length ? "w-2.5 bg-white/50" : "w-2.5 bg-white/15"}`}
              />
            ))}
          </div>
        </main>

        {pliego < 0 ? (
          <PanelTapa
            modelos={modelosTapa}
            tapa={estado.tapa}
            geometria={armadoTapa?.geometria ?? null}
            seleccion={caraTapa}
            foto={fotoDeTapa}
            textos={{ ...(estado.estilo?.textos ?? {}), ...(estado.tapa?.textos ?? {}) }}
            onDiseno={(d) => cambiarTapa((t) => ({ ...t, diseno: d }))}
            hayEstilo={Boolean(estado.estilo)}
            dibujandoPortada={dibujandoPortada}
            onModelo={(id) => {
              if (!id) return aplicar((e) => ({ ...e, tapa: null }));
              cambiarTapa((t) => ({ ...t, modeloId: id, ...(modelosTapa.find((m) => m.id === id)?.tipo === "frente" ? { contratapaFotoId: null, contratapaEncuadre: null } : {}) }));
            }}
            onEncuadre={(crop) => cambiarTapa((t) => (caraTapa === "contratapa" ? { ...t, contratapaEncuadre: crop } : { ...t, encuadre: crop }), true)}
            onQuitarFoto={() => {
              cambiarTapa((t) => (caraTapa === "contratapa" ? { ...t, contratapaFotoId: null, contratapaEncuadre: null } : { ...t, fotoId: null, encuadre: null }));
              setCaraTapa(null);
            }}
            onTexto={(rol, valor) => cambiarTapa((t) => ({ ...t, textos: { ...(t.textos ?? {}), [rol]: valor } }))}
          />
        ) : (
        <PanelLateral
          estado={estado}
          pliego={pliego}
          dpi={cargado.canvas.dpi ?? 300}
          seleccionada={seleccionada}
          foto={fotoElegida}
          bloque={bloqueElegido}
          onCrop={(crop) => bloqueElegido && cambiarRecorte(bloqueElegido.id, crop)}
          onQuitar={() => {
            if (!seleccionada) return;
            aplicar((e) => quitarDePagina(e, seleccionada));
            setSeleccionada(null);
          }}
          onVariante={(lado, paso) => aplicar((e) => cambiarVariante(e, pliego, lado, paso))}
          distribuciones={cantidadDeDistribuciones(estado, cargado.canvas, pliego)}
          onModo={(m) => {
            aplicar((e) => cambiarModo(e, pliego, m));
            setSeleccionada(null);
          }}
          onSeparacion={(mm) => aplicar((e) => ({ ...e, separacionMm: mm }))}
          textoLibre={textoElegido ? bloques.find((b) => b.id === textoElegido) ?? null : null}
          onAgregarTexto={() => {
            const id = `fl-txt-${Date.now().toString(36)}`;
            cambiarBloques((b) => [...b, nuevoTexto(pliego, cargado.canvas, id)], true);
            setTextoElegido(id);
            setSeleccionada(null);
          }}
          onCambiarTexto={(c) => {
            const id = textoElegido;
            if (!id) return;
            const dpi = cargado.canvas.dpi ?? 300;
            cambiarBloques(
              (b) =>
                b.map((t) => {
                  if (t.id !== id) return t;
                  const { puntos, ...resto } = c;
                  const conCambios = { ...t, configJson: { ...t.configJson, ...resto } };
                  return puntos !== undefined || c.content !== undefined ? conCuerpo(conCambios, puntos ?? Math.round((Number(t.configJson.fontSize) * 72) / dpi), dpi) : conCambios;
                }),
              c.content === undefined,
            );
          }}
          onQuitarTexto={() => {
            const id = textoElegido;
            cambiarBloques((b) => b.filter((x) => x.id !== id), true);
            setTextoElegido(null);
          }}
          onFondo={(color) => aplicar((e) => cambiarFondo(e, pliego, color))}
          favoritas={favoritas}
          onGuardarFavorita={() =>
            void pedirFavoritas({ method: "POST", body: JSON.stringify({ nombre: "", marcos: marcosEnProporcion(bloques, pliego, cargado.canvas) }) }).catch((e: Error) => setErrorGuardado(e.message))
          }
          onAplicarFavorita={(f) => aplicar((e) => aplicarFavorita(e, pliego, f.marcos))}
          onBorrarFavorita={(id) => void pedirFavoritas({ method: "DELETE" }, `/api/fotolibro/favoritas?id=${encodeURIComponent(id)}`).catch((e: Error) => setErrorGuardado(e.message))}
          onBorde={(mm, color) => aplicar((e) => ({ ...e, bordeMm: mm, bordeColor: color }))}
          onMargen={(mm) => aplicar((e) => ({ ...e, margenMm: mm }))}
          onVaciar={() => aplicar((e) => vaciarPliego(e, pliego))}
          onAgregarPliego={() => {
            aplicar((e) => agregarPliego(e, pliego), (b) => reindexarHojas(b, { tipo: "insertar", indice: pliego + 1 }));
            setPliego(pliego + 1);
          }}
          estilo={estiloActual ? { nombre: estiloActual.nombre, roles: rolesDelEstilo, textos: estado.estilo?.textos ?? {} } : null}
          onAbrirEstilos={() => setEligiendoEstilo(true)}
          onSacarEstilo={() => aplicar((e) => ({ ...e, estilo: null }))}
          onTexto={(rol, valor) =>
            aplicar((e) => (e.estilo ? { ...e, estilo: { ...e.estilo, textos: { ...e.estilo.textos, [rol]: valor } } } : e))
          }
          onQuitarPliego={() => {
            aplicar((e) => quitarPliego(e, pliego), (b) => reindexarHojas(b, { tipo: "quitar", indice: pliego }));
            setPliego(Math.max(0, Math.min(pliego, cantidad - 2)));
          }}
        />
        )}
      </div>

      <div className="h-40 flex-none">
        <TiraFotos
          fotos={estado.fotos}
          usos={usos}
          seleccion={seleccionTira}
          onSeleccion={setSeleccionTira}
          onSubir={(a) => void subir(a)}
          subiendo={subiendo}
          originales={originales}
          orden={estado.orden}
          onOrden={(o) => aplicar((e) => ({ ...e, orden: o }))}
        />
      </div>
    </div>
  );
}
