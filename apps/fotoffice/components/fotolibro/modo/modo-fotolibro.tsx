"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PhotoCrop, TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import {
  escribirEstadoFotolibro,
  leerEstadoFotolibro,
  usosPorFoto,
  type EstadoFotolibro,
  type FotoDelLibro,
  type LadoPliego,
} from "@/lib/fotolibro/modo/estado";
import { generarBloques, idDeBloque, reindexarHojas } from "@/lib/fotolibro/modo/bloques";
import {
  agregarAPagina,
  agregarPliego,
  armarPliego,
  cambiarVariante,
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
import { PanelLateral } from "./panel-lateral";
import { PliegoVista } from "./pliego-vista";
import { TiraFotos } from "./tira-fotos";
import { subirFoto } from "./subir-fotos";

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

  // Lo último, para el guardado y las subidas, que corren fuera del ciclo de dibujo.
  const ref = useRef({ cargado, estado, bloques });
  ref.current = { cargado, estado, bloques };
  const historia = useRef<{ estado: EstadoFotolibro; bloques: TemplateV2Block[] }[]>([]);
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
      if (guardado === "pendiente" || guardado === "guardando") e.preventDefault();
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [guardado]);

  // ── Cambios ──
  const aplicar = useCallback(
    (cambio: (e: EstadoFotolibro) => EstadoFotolibro, ajusteBloques?: (b: TemplateV2Block[]) => TemplateV2Block[]) => {
      const { cargado: c, estado: e, bloques: b } = ref.current;
      if (!c || !e) return;
      const nuevo = cambio(e);
      if (nuevo === e) return;
      historia.current = [...historia.current.slice(-49), { estado: e, bloques: b }];
      const base = ajusteBloques ? ajusteBloques(b) : b;
      const siguientes = generarBloques(nuevo, c.canvas, base);
      ref.current = { cargado: c, estado: nuevo, bloques: siguientes };
      setEstado(nuevo);
      setBloques(siguientes);
      setGuardado("pendiente");
    },
    [],
  );

  const cambiarRecorte = useCallback((blockId: string, crop: PhotoCrop | null) => {
    setBloques((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const { crop: _viejo, ...resto } = b.configJson;
        return { ...b, configJson: crop ? { ...resto, crop } : resto };
      }),
    );
    setGuardado("pendiente");
  }, []);

  const deshacer = useCallback(() => {
    const ultimo = historia.current.pop();
    if (!ultimo) return;
    ref.current = { ...ref.current, estado: ultimo.estado, bloques: ultimo.bloques };
    setEstado(ultimo.estado);
    setBloques(ultimo.bloques);
    setGuardado("pendiente");
  }, []);

  const cantidad = estado?.pliegos.length ?? 1;
  const irA = useCallback(
    (i: number) => {
      setPliego(Math.max(0, Math.min(cantidad - 1, i)));
      setSeleccionada(null);
      setRecortando(null);
    },
    [cantidad],
  );

  // ── Subida ──
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
            const foto = await subirFoto(templateId, archivo);
            aplicar((e) => sumarFotos(e, [foto]));
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
    [templateId, aplicar],
  );

  // ── Teclado ──
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (recortando || esEditable(ev.target)) return;
      const tecla = ev.key.toLowerCase();
      if ((ev.metaKey || ev.ctrlKey) && tecla === "z") {
        ev.preventDefault();
        deshacer();
        return;
      }
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      if (ev.key === "ArrowLeft") return void (ev.preventDefault(), irA(pliego - 1));
      if (ev.key === "ArrowRight") return void (ev.preventDefault(), irA(pliego + 1));
      if (ev.key === "Enter" && seleccionTira.length) {
        ev.preventDefault();
        aplicar((e) => armarPliego(e, pliego, seleccionTira));
        setSeleccionTira([]);
        return;
      }
      if ((ev.key === "Delete" || ev.key === "Backspace") && seleccionada) {
        ev.preventDefault();
        aplicar((e) => quitarDePagina(e, seleccionada));
        setSeleccionada(null);
        return;
      }
      // Las teclas de los diseñadores de fotolibro: A/Q página izquierda, S/W página derecha.
      const atajos: Record<string, [LadoPliego, number]> = { a: ["izq", 1], q: ["izq", -1], s: ["der", 1], w: ["der", -1] };
      const atajo = atajos[tecla];
      if (atajo) {
        ev.preventDefault();
        aplicar((e) => cambiarVariante(e, pliego, atajo[0], atajo[1]));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recortando, pliego, seleccionTira, seleccionada, aplicar, deshacer, irA]);

  const fotosPorId = useMemo(() => new Map((estado?.fotos ?? []).map((f) => [f.id, f])), [estado]);
  const usos = useMemo(() => (estado ? usosPorFoto(estado) : new Map<string, number>()), [estado]);

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
  const estadoGuardado =
    guardado === "guardando" ? "Guardando…" : guardado === "pendiente" ? "Cambios sin guardar" : guardado === "error" ? "No se guardó" : "Guardado";

  async function salirA(href: string) {
    if (ref.current.estado && guardado !== "al-dia") await guardar();
    router.push(href);
  }

  return (
    <div className="flex h-full flex-col bg-[#18191b] text-white">
      <header className="flex flex-none items-center gap-3 border-b border-white/10 bg-[#202124] px-4 py-2 text-sm">
        <button type="button" onClick={() => void salirA(salirHref)} className="rounded px-2 py-1 text-white/80 hover:bg-white/10">
          ← Fotolibros
        </button>
        <h1 className="truncate font-semibold">{cargado.nombre}</h1>
        <span className="text-white/50">
          Pliego {pliego + 1} de {cantidad}
        </span>
        <span className={`ml-auto text-xs ${guardado === "error" ? "text-red-300" : "text-white/50"}`}>{estadoGuardado}</span>
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
            <PliegoVista
              canvas={cargado.canvas}
              bloques={bloques}
              pliego={pliego}
              cantidad={cantidad}
              seleccionada={seleccionada}
              recortando={recortando}
              onIrA={irA}
              onSeleccionar={(u) => {
                setSeleccionada(u);
                if (!u) setRecortando(null);
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
          </div>
          <div className="flex flex-none items-center justify-center gap-1 pb-2">
            {estado.pliegos.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => irA(i)}
                title={`Pliego ${i + 1}`}
                className={`h-2.5 rounded-full transition-all ${i === pliego ? "w-6 bg-[var(--fo-accent)]" : p.izq.fotos.length || p.der.fotos.length ? "w-2.5 bg-white/50" : "w-2.5 bg-white/15"}`}
              />
            ))}
          </div>
        </main>

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
          onSeparacion={(mm) => aplicar((e) => ({ ...e, separacionMm: mm }))}
          onMargen={(mm) => aplicar((e) => ({ ...e, margenMm: mm }))}
          onVaciar={() => aplicar((e) => vaciarPliego(e, pliego))}
          onAgregarPliego={() => {
            aplicar((e) => agregarPliego(e, pliego), (b) => reindexarHojas(b, { tipo: "insertar", indice: pliego + 1 }));
            setPliego(pliego + 1);
          }}
          onQuitarPliego={() => {
            aplicar((e) => quitarPliego(e, pliego), (b) => reindexarHojas(b, { tipo: "quitar", indice: pliego }));
            setPliego(Math.max(0, Math.min(pliego, cantidad - 2)));
          }}
        />
      </div>

      <div className="h-40 flex-none">
        <TiraFotos
          fotos={estado.fotos}
          usos={usos}
          seleccion={seleccionTira}
          onSeleccion={setSeleccionTira}
          onSubir={(a) => void subir(a)}
          subiendo={subiendo}
        />
      </div>
    </div>
  );
}
