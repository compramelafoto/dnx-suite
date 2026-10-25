"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFullscreenElement } from "@/components/simulator/useFullscreenElement";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import { INFO_PASOS, PASOS_EMBUDO, textoCurso, type PasoEmbudo, type UbicacionEnEmbudo } from "@/lib/schools/embudo-pedidos-escolares";
import {
  RESERVA_CAMARA,
  SEGUNDOS_ENTRE_ACTUALIZACIONES,
  SEGUNDOS_POR_PAGINA,
  calcularGrilla,
  contadoresPorPaso,
  paginaDeLaVuelta,
  paginar,
  pedidosParaTarjetas,
  ubicarEnCeldas,
} from "@/lib/schools/pantalla-pedidos";

/**
 * Pantalla de pedidos escolares para un televisor o una videollamada: oscura, con letra grande.
 * Arriba los siete pasos con su contador; abajo las tarjetas de los pedidos, que pasan de página
 * solas. Se actualiza sola. Los controles van arriba a la izquierda y el rincón de abajo a la
 * derecha queda vacío para la cámara del que presenta.
 */

type Pedido = {
  kind?: "TIENDA_ESCOLAR" | "PACK_EXTERNO";
  id: number;
  buyerEmail: string;
  buyerName: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  isDemo?: boolean;
  paso: UbicacionEnEmbudo;
  album: { id: number; title: string; school: { id: number; name: string } | null } | null;
  schoolCourse: { id: number; name: string; division: string | null } | null;
};

type Tarjeta = {
  clave: string;
  nombre: string;
  curso: string | null;
  escuela: string | null;
  paso: UbicacionEnEmbudo;
  demo: boolean;
};

/** Tamaño mínimo de una tarjeta para que se lea de lejos. */
const TARJETA = { ancho: 380, alto: 168, separacion: 20 } as const;
/** Margen de la grilla contra el borde de la pantalla (p-6). */
const MARGEN = 24;

/** Color de cada paso sobre fondo oscuro: del naranja de la marca al verde de "entregado". */
const COLOR_PASO: Record<PasoEmbudo, { fondo: string; tinta: string }> = {
  POR_CANJEAR: { fondo: "#3a2a1d", tinta: "#f3d9c2" },
  REVISAR_DISENO: { fondo: "#c27b3d", tinta: "#ffffff" },
  CAMBIOS_PEDIDOS: { fondo: "#b45309", tinta: "#ffffff" },
  PARA_IMPRIMIR: { fondo: "#7c4a1f", tinta: "#ffffff" },
  EN_IMPRENTA: { fondo: "#5b3518", tinta: "#f3d9c2" },
  PARA_ENTREGAR: { fondo: "#1f5d4a", tinta: "#d1fae5" },
  ENTREGADO: { fondo: "#14532d", tinta: "#bbf7d0" },
};

const horaArgentina = (d: Date) =>
  new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(d);

function aTarjeta(o: Pedido): Tarjeta {
  const nombre =
    [o.studentFirstName, o.studentLastName].filter(Boolean).join(" ").trim() ||
    o.buyerName ||
    o.buyerEmail ||
    "Sin nombre";
  return {
    clave: `${o.kind ?? "TIENDA_ESCOLAR"}-${o.id}`,
    nombre,
    curso: textoCurso(o.schoolCourse),
    escuela: o.album?.school?.name ?? null,
    paso: o.paso,
    demo: Boolean(o.isDemo),
  };
}

/** Mide el elemento y vuelve a medir cuando cambia de tamaño (pantalla completa, ventana). */
function useMedidas<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [medidas, setMedidas] = useState({ ancho: 0, alto: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => setMedidas({ ancho: el.clientWidth, alto: el.clientHeight });
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, medidas] as const;
}

export default function PantallaPedidos() {
  const router = useRouter();
  const raizRef = useRef<HTMLDivElement | null>(null);
  const enPantallaCompleta = useFullscreenElement(raizRef);
  const [grillaRef, medidas] = useMedidas<HTMLDivElement>();

  const [listo, setListo] = useState(false);
  const [pedidos, setPedidos] = useState<Pedido[] | null>(null);
  const [error, setError] = useState(false);
  const [actualizado, setActualizado] = useState<Date | null>(null);
  const [vuelta, setVuelta] = useState(0);
  const [filtro, setFiltro] = useState<{ schoolId: string; curso: string }>({ schoolId: "", curso: "" });

  // Escuela y curso pueden venir en la dirección (?schoolId=3&curso=5°%20A), desde Pedidos escolares.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setFiltro({ schoolId: q.get("schoolId") ?? "", curso: q.get("curso") ?? "" });
  }, []);

  useEffect(() => {
    let activo = true;
    ensurePhotographerSession().then((session) => {
      if (!activo) return;
      if (!session) router.push("/fotografo/login");
      else setListo(true);
    });
    return () => {
      activo = false;
    };
  }, [router]);

  const recargar = useCallback(async () => {
    const params = new URLSearchParams();
    if (filtro.schoolId && Number.isFinite(Number(filtro.schoolId))) params.set("schoolId", filtro.schoolId);
    try {
      const res = await fetch(`/api/fotografo/school-orders?${params}`, { credentials: "include", cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      setPedidos(Array.isArray(data) ? data : []);
      setActualizado(new Date());
      setError(false);
    } catch {
      // Se queda con lo último que tenía: en un televisor es mejor eso que una pantalla vacía.
      setError(true);
    }
  }, [filtro.schoolId]);

  useEffect(() => {
    if (!listo) return;
    void recargar();
    const id = window.setInterval(() => void recargar(), SEGUNDOS_ENTRE_ACTUALIZACIONES * 1000);
    return () => window.clearInterval(id);
  }, [listo, recargar]);

  useEffect(() => {
    const id = window.setInterval(() => setVuelta((v) => v + 1), SEGUNDOS_POR_PAGINA * 1000);
    return () => window.clearInterval(id);
  }, []);

  const delCurso = useMemo(
    () => (pedidos ?? []).filter((o) => !filtro.curso || textoCurso(o.schoolCourse) === filtro.curso),
    [pedidos, filtro.curso],
  );
  const contadores = useMemo(() => contadoresPorPaso(delCurso.map((o) => o.paso)), [delCurso]);
  const tarjetas = useMemo(() => pedidosParaTarjetas(delCurso.map(aTarjeta)), [delCurso]);

  const grilla = useMemo(
    () =>
      calcularGrilla({
        ancho: medidas.ancho,
        alto: medidas.alto,
        anchoTarjeta: TARJETA.ancho,
        altoTarjeta: TARJETA.alto,
        separacion: TARJETA.separacion,
        // El rincón se mide desde el borde de la pantalla; la grilla ya está separada por el margen.
        reserva: { ancho: RESERVA_CAMARA.ancho - MARGEN, alto: RESERVA_CAMARA.alto - MARGEN },
      }),
    [medidas.ancho, medidas.alto],
  );
  const paginas = useMemo(() => paginar(tarjetas, grilla.porPagina), [tarjetas, grilla.porPagina]);
  const indicePagina = paginaDeLaVuelta(vuelta, paginas.length);
  const celdas = ubicarEnCeldas(paginas[indicePagina] ?? [], grilla);

  const escuela = filtro.schoolId ? (delCurso.find((o) => o.album?.school)?.album?.school?.name ?? null) : null;
  const subtitulo = [escuela, filtro.curso || null].filter(Boolean).join(" · ") || "Todas las escuelas";

  const alternarPantallaCompleta = useCallback(async () => {
    const el = raizRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement === el) await document.exitFullscreen();
      else await el.requestFullscreen();
    } catch {
      /* el navegador no dejó */
    }
  }, []);

  const boton =
    "rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-base font-semibold text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#c27b3d]";

  return (
    <div
      ref={raizRef}
      className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#0b0d12] text-white"
      style={{ colorScheme: "dark" }}
    >
      {/* Arriba a la izquierda: controles y estado. */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 pt-5">
        <div className="flex items-center gap-3">
          {!enPantallaCompleta ? (
            <Link href="/fotografo/escuelas/pedidos" className={boton}>
              ← Volver
            </Link>
          ) : null}
          <button type="button" onClick={() => void alternarPantallaCompleta()} className={boton}>
            {enPantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
          </button>
        </div>
        <div className="min-w-0">
          <h1 className="text-[clamp(26px,2.6vw,44px)] font-bold leading-tight">Pedidos escolares</h1>
          <p className="text-[clamp(16px,1.3vw,22px)] text-white/60">{subtitulo}</p>
        </div>
        <div className="ml-auto text-right text-[clamp(14px,1.1vw,20px)] text-white/60">
          {actualizado ? <p>Actualizado {horaArgentina(actualizado)}</p> : null}
          {error ? <p className="text-amber-400">Sin conexión: muestro lo último que llegó</p> : null}
          {paginas.length > 1 ? (
            <p>
              Página {indicePagina + 1} de {paginas.length}
            </p>
          ) : null}
        </div>
      </header>

      {/* Los siete pasos, encadenados como en Pedidos escolares. */}
      <nav aria-label="Pedidos por paso" className="px-6 pt-5">
        <ol className="m-0 flex list-none p-0">
          {contadores.map((c, i) => {
            const primero = i === 0;
            const ultimo = i === PASOS_EMBUDO.length - 1;
            const punta = 26;
            const forma = `polygon(0 0, calc(100% - ${ultimo ? 0 : punta}px) 0, 100% 50%, calc(100% - ${
              ultimo ? 0 : punta
            }px) 100%, 0 100%, ${primero ? 0 : punta}px 50%)`;
            const color = COLOR_PASO[c.paso];
            const vacio = c.cantidad === 0;
            return (
              <li key={c.paso} className="relative min-w-0 flex-1" style={{ marginLeft: primero ? 0 : -punta + 6 }}>
                <div
                  title={INFO_PASOS[c.paso].ayuda}
                  className="flex h-[clamp(92px,13vh,150px)] w-full flex-col justify-center"
                  style={{
                    clipPath: forma,
                    background: vacio ? "#1a1d24" : color.fondo,
                    color: vacio ? "#6b7280" : color.tinta,
                    paddingLeft: primero ? 20 : punta + 14,
                    paddingRight: ultimo ? 16 : punta + 6,
                  }}
                >
                  <span className="text-[clamp(36px,4.4vw,84px)] font-bold leading-none tabular-nums">{c.cantidad}</span>
                  <span className="mt-1 truncate text-[clamp(13px,1.15vw,22px)] font-semibold leading-tight">
                    {c.numero}. {c.titulo}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Las tarjetas. La celda de abajo a la derecha queda vacía para la cámara. */}
      <div className="min-h-0 flex-1 p-6">
        <div ref={grillaRef} className="relative h-full w-full">
          {pedidos === null ? (
            <p className="absolute inset-0 flex items-center justify-center text-2xl text-white/50">
              {error ? "No pude traer los pedidos. Reintento en unos segundos…" : "Cargando pedidos…"}
            </p>
          ) : tarjetas.length === 0 ? (
            <p className="absolute inset-0 flex items-center justify-center pb-24 text-[clamp(22px,2vw,36px)] text-white/50">
              No hay pedidos en curso.
            </p>
          ) : medidas.ancho > 0 ? (
            <ol
              key={indicePagina}
              aria-label={`Pedidos, página ${indicePagina + 1} de ${paginas.length}`}
              className="m-0 grid h-full list-none p-0"
              style={{
                gridTemplateColumns: `repeat(${grilla.columnas}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${grilla.filas}, minmax(0, 1fr))`,
                gap: TARJETA.separacion,
              }}
            >
              {celdas.map((celda, i) =>
                celda.tipo === "pedido" ? (
                  <TarjetaPedido key={celda.pedido.clave} t={celda.pedido} />
                ) : (
                  <li key={`${celda.tipo}-${i}`} aria-hidden="true" />
                ),
              )}
            </ol>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TarjetaPedido({ t }: { t: Tarjeta }) {
  const paso = t.paso as PasoEmbudo;
  const color = COLOR_PASO[paso];
  const lugar = [t.curso, t.escuela].filter(Boolean).join(" · ");
  return (
    <li className="flex min-h-0 min-w-0 flex-col justify-between overflow-hidden rounded-2xl border border-white/10 bg-[#161a22] p-5">
      <div className="min-w-0">
        <p className="truncate text-[clamp(22px,2vw,38px)] font-bold leading-tight">{t.nombre}</p>
        {lugar ? <p className="mt-1 truncate text-[clamp(16px,1.3vw,24px)] text-white/60">{lugar}</p> : null}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <span
          className="inline-flex max-w-full items-center truncate rounded-full px-3 py-1 text-[clamp(14px,1.05vw,20px)] font-semibold"
          style={{ background: color.fondo, color: color.tinta }}
        >
          {INFO_PASOS[paso].numero}. {INFO_PASOS[paso].titulo}
        </span>
        {t.demo ? (
          <span className="rounded-full border border-white/20 px-2 py-0.5 text-sm font-semibold text-white/60">
            DEMO
          </span>
        ) : null}
      </div>
    </li>
  );
}
