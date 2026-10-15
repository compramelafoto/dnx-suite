"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import { DsEmptyState } from "@/components/ui/DsEmptyState";
import { DsDashboardInner, DsPageShell } from "@/components/ui/DsLayout";
import PhotographerDashboardHeader from "@/components/photographer/PhotographerDashboardHeader";
import RevisionDeCorrido, {
  type DisenoEnFila,
  type ResumenRevision,
} from "@/components/fotografo/escolar/RevisionDeCorrido";
import { ensurePhotographerSession } from "@/lib/photographer-session-client";
import {
  INFO_FUERA,
  INFO_PASOS,
  PASOS_EMBUDO,
  contarPorPaso,
  disenosParaRevisar,
  esPasoEmbudo,
  textoCurso,
  type PasoEmbudo,
  type UbicacionEnEmbudo,
} from "@/lib/schools/embudo-pedidos-escolares";

/**
 * Pedidos escolares como LÍNEA DE PRODUCCIÓN: desde que la familia paga hasta que se le entrega.
 * Arriba, los siete pasos con su contador (tocarlos filtra); abajo, los pedidos de ese paso con
 * casillas y una acción principal por paso.
 */

type Diseno = {
  id: number;
  status: string;
  reviewNote: string | null;
  emptySlots: number;
  printBatchName?: string | null;
  sentToPrintAt?: string | null;
  printedAt?: string | null;
  deliveredAt?: string | null;
};

type Lote = { nombre: string; cantidad: number; enviadoAt: string | null; impresos: number; entregados: number };

const APROBADO = new Set(["APPROVED_FOR_EXPORT", "EXPORTED"]);

/** Diseños de los pedidos elegidos (o de todo el paso) que cumplen una condición. */
function disenosDe(pedidos: Order[], cumple: (d: Diseno) => boolean): number[] {
  return [...new Set(pedidos.flatMap((o) => o.disenos).filter(cumple).map((d) => d.id))];
}

type Order = {
  /** Pedido de la tienda escolar, o pack cobrado por fuera (San Patricio) y sus pruebas DEMO. */
  kind?: "TIENDA_ESCOLAR" | "PACK_EXTERNO";
  redemptionOrderId?: number | null;
  id: number;
  buyerEmail: string;
  buyerName: string | null;
  buyerPhone: string | null;
  studentFirstName: string | null;
  studentLastName: string | null;
  status: string;
  totalCents: number;
  createdAt: string;
  isDemo?: boolean;
  paso: UbicacionEnEmbudo;
  disenos: Diseno[];
  album: { id: number; title: string; publicSlug: string; school: { id: number; name: string } | null } | null;
  schoolCourse: { id: number; name: string; division: string | null } | null;
  items?: Array<{ id: number; status: string; designProjectId: number | null; designProjectStatus: string | null }>;
};

type Vista = PasoEmbudo | "FUERA";

/** Pasos que para los packs cobrados por fuera todavía no se registran (tanda 2). */
const PASOS_PROXIMAMENTE: PasoEmbudo[] = [];

const clave = (o: Order) => `${o.kind ?? "TIENDA_ESCOLAR"}-${o.id}`;
const alumnoDe = (o: Order) =>
  [o.studentFirstName, o.studentLastName].filter(Boolean).join(" ").trim() || o.buyerName || o.buyerEmail || "Sin nombre";
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

function mensajeDeError(data: Record<string, unknown>, res: Response, generico: string): string {
  for (const k of ["message", "reason", "error"] as const) {
    const v = data[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  return res.ok ? generico : `Error (${res.status})`;
}

export default function FotografoEscuelasPedidosPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [photographer, setPhotographer] = useState<any>(null);
  const [filterSchool, setFilterSchool] = useState<string>("");
  const [filterCurso, setFilterCurso] = useState<string>("");
  const [vista, setVista] = useState<Vista | null>(null);
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set());
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ tono: "ok" | "error"; texto: string } | null>(null);
  const [revision, setRevision] = useState<DisenoEnFila[] | null>(null);
  const [accionFila, setAccionFila] = useState<Record<string, boolean>>({});

  // El paso puede venir en la dirección (?paso=REVISAR_DISENO), p. ej. desde "Revisiones".
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("paso");
    if (esPasoEmbudo(p) || p === "FUERA") setVista(p);
  }, []);

  useEffect(() => {
    let active = true;
    async function init() {
      const session = await ensurePhotographerSession();
      if (!active) return;
      if (!session) {
        router.push("/fotografo/login");
        return;
      }
      fetch(`/api/fotografo/${session.photographerId}`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setPhotographer(data))
        .catch(() => {});
      const schoolsRes = await fetch("/api/fotografo/schools", { credentials: "include" });
      if (schoolsRes.ok) {
        const data = await schoolsRes.json();
        setSchools(Array.isArray(data) ? data.map((s: any) => ({ id: s.id, name: s.name })) : []);
      }
      if (active) setLoading(false);
    }
    init();
    return () => {
      active = false;
    };
  }, [router]);

  const recargar = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterSchool) params.set("schoolId", filterSchool);
    setCargandoLista(true);
    try {
      const res = await fetch(`/api/fotografo/school-orders?${params}`, { credentials: "include", cache: "no-store" });
      const data = res.ok ? await res.json() : [];
      setOrders(Array.isArray(data) ? data : []);
    } catch {
      setOrders([]);
    } finally {
      setCargandoLista(false);
    }
  }, [filterSchool]);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  const cursos = useMemo(
    () =>
      [...new Set(orders.map((o) => textoCurso(o.schoolCourse)).filter((c): c is string => c != null))].sort((a, b) =>
        a.localeCompare(b, "es", { numeric: true }),
      ),
    [orders],
  );

  const delCurso = useMemo(
    () => (filterCurso ? orders.filter((o) => textoCurso(o.schoolCourse) === filterCurso) : orders),
    [orders, filterCurso],
  );
  const conteo = useMemo(() => contarPorPaso(delCurso.map((o) => o.paso)), [delCurso]);
  const fuera = conteo.PAGO_PENDIENTE + conteo.CANCELADO;

  // Sin paso elegido: el primero con trabajo, empezando por revisar diseños.
  const vistaEfectiva: Vista =
    vista ??
    (conteo.REVISAR_DISENO > 0
      ? "REVISAR_DISENO"
      : (PASOS_EMBUDO.find((p) => p !== "ENTREGADO" && conteo[p] > 0) ?? "POR_CANJEAR"));

  const filas = useMemo(
    () =>
      delCurso.filter((o) =>
        vistaEfectiva === "FUERA" ? o.paso === "PAGO_PENDIENTE" || o.paso === "CANCELADO" : o.paso === vistaEfectiva,
      ),
    [delCurso, vistaEfectiva],
  );
  const elegidas = filas.filter((o) => seleccion.has(clave(o)));
  const todasElegidas = filas.length > 0 && elegidas.length === filas.length;

  function elegirVista(v: Vista) {
    setVista(v);
    setSeleccion(new Set());
    setMensaje(null);
    const url = new URL(window.location.href);
    url.searchParams.set("paso", v);
    window.history.replaceState(null, "", url.toString());
  }

  function alternar(o: Order) {
    setSeleccion((s) => {
      const n = new Set(s);
      if (n.has(clave(o))) n.delete(clave(o));
      else n.add(clave(o));
      return n;
    });
  }

  function alternarTodas() {
    setSeleccion(todasElegidas ? new Set() : new Set(filas.map(clave)));
  }

  // ------------------------------------------------------------------ acciones del paso

  /** Por canjear · principal: el aviso "ya están las fotos" de cada álbum (el mismo del álbum). */
  async function avisarFamilias() {
    const base = elegidas.length ? elegidas : filas;
    const albumes = [
      ...new Set(base.filter((o) => o.kind === "PACK_EXTERNO" && !o.isDemo && o.album).map((o) => o.album!.id)),
    ];
    if (albumes.length === 0) return;
    setOcupado("avisar");
    setMensaje(null);
    try {
      const estados = await Promise.all(
        albumes.map(async (id) => {
          const r = await fetch(`/api/dashboard/albums/${id}/preventa-aviso`, { cache: "no-store" });
          return r.ok ? ((await r.json()) as { pendientes: number; ultimoAvisoAt: string | null }) : null;
        }),
      );
      const pendientes = estados.reduce((s, e) => s + (e?.pendientes ?? 0), 0);
      if (pendientes === 0) {
        setMensaje({ tono: "ok", texto: "No hay familias pendientes de canjear en esos álbumes." });
        return;
      }
      const yaAvisadas = estados.some((e) => e?.ultimoAvisoAt);
      const ok = window.confirm(
        `Vamos a mandarle un correo a ${plural(pendientes, "familia", "familias")} ` +
          `(${plural(albumes.length, "álbum", "álbumes")}) con su link para elegir las fotos del pack. ` +
          "Le llega a todas las que todavía no canjearon en esos álbumes, no sólo a las de esta lista." +
          (yaAvisadas ? " Ya les avisaste antes: les va a llegar otro correo." : "") +
          " Las pruebas DEMO no reciben nada. ¿Seguimos?",
      );
      if (!ok) return;
      let enviados = 0;
      let sinEmail = 0;
      for (const id of albumes) {
        const r = await fetch(`/api/dashboard/albums/${id}/preventa-aviso`, { method: "POST" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(mensajeDeError(d, r, "No se pudo mandar el aviso."));
        enviados += Number(d.enviados ?? 0);
        sinEmail += Number(d.sinEmail ?? 0);
      }
      setMensaje({
        tono: "ok",
        texto: `Listo: ${plural(enviados, "correo", "correos")} en camino.${sinEmail ? ` ${sinEmail} sin email válido.` : ""}`,
      });
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo mandar el aviso." });
    } finally {
      setOcupado(null);
    }
  }

  /** Por canjear · secundaria: el link personal de nuevo, a cada familia elegida. */
  async function reenviarLink() {
    const packs = elegidas.filter((o) => o.kind === "PACK_EXTERNO" && !o.isDemo);
    const demos = elegidas.filter((o) => o.isDemo).length;
    if (packs.length === 0) return;
    const ok = window.confirm(
      `Le vamos a reenviar su link para canjear a ${plural(packs.length, "familia", "familias")}. ` +
        "Cada una recibe un link nuevo y el anterior deja de andar." +
        (demos ? ` Las ${demos} DEMO elegidas no reciben nada.` : "") +
        " ¿Seguimos?",
    );
    if (!ok) return;
    setOcupado("reenviar");
    setMensaje(null);
    try {
      const r = await fetch("/api/fotografo/school-orders/reenviar-link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: packs.map((o) => o.id) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(mensajeDeError(d, r, "No se pudo reenviar."));
      setMensaje({
        tono: "ok",
        texto:
          `Listo: ${plural(Number(d.enviados ?? 0), "link reenviado", "links reenviados")}.` +
          (d.sinEmail ? ` ${d.sinEmail} sin email válido.` : "") +
          (d.salteados ? ` ${d.salteados} no se tocaron (ya canjeados o no son tuyos).` : ""),
      });
      setSeleccion(new Set());
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo reenviar." });
    } finally {
      setOcupado(null);
    }
  }

  /** Revisar diseño · principal: uno atrás del otro, en el orden de la lista. */
  function revisarDeCorrido() {
    const base = elegidas.length ? elegidas : filas;
    const porId = new Map<number, Order>();
    for (const o of base) for (const d of o.disenos) porId.set(d.id, o);
    const ids = disenosParaRevisar(base);
    if (ids.length === 0) return;
    setMensaje(null);
    setRevision(
      ids.map((id) => {
        const o = porId.get(id)!;
        return {
          designId: id,
          alumno: alumnoDe(o),
          curso: textoCurso(o.schoolCourse),
          escuela: o.album?.school?.name ?? null,
          isDemo: o.isDemo === true,
        };
      }),
    );
  }

  function alCerrarRevision(r: ResumenRevision) {
    setRevision(null);
    setSeleccion(new Set());
    if (r.aprobados + r.cambios + r.errores + r.guardando > 0) {
      setMensaje({
        tono: r.errores ? "error" : "ok",
        texto:
          `Aprobaste ${r.aprobados}, pediste cambios en ${r.cambios}.` +
          (r.errores ? ` ${r.errores} no se pudieron guardar.` : "") +
          (r.guardando ? ` ${r.guardando} se terminan de guardar en unos segundos.` : ""),
      });
    }
    void recargar();
    // Las aprobaciones que quedaron en camino cambian de paso un rato después.
    if (r.guardando > 0) setTimeout(() => void recargar(), 20_000);
  }

  /** Revisar diseño · secundaria: aprobar en lote con la misma aprobación de la pantalla del diseño. */
  async function aprobarElegidos() {
    const ids = disenosParaRevisar(elegidas);
    if (ids.length === 0) return;
    const conHuecos = elegidas.flatMap((o) => o.disenos).filter((d) => ids.includes(d.id) && d.emptySlots > 0).length;
    const ok = window.confirm(
      `Vas a aprobar ${plural(ids.length, "diseño", "diseños")} sin mirarlos uno por uno. ` +
        "Pasan a «Para imprimir» y a cada familia le llega un correo avisando que su librito está aprobado (las DEMO no reciben nada)." +
        (conHuecos ? `\n\nOjo: ${plural(conHuecos, "tiene", "tienen")} huecos sin foto y van a salir vacíos.` : "") +
        "\n\n¿Seguimos?",
    );
    if (!ok) return;
    setMensaje(null);
    let bien = 0;
    const fallas: string[] = [];
    for (const [i, id] of ids.entries()) {
      setOcupado(`Aprobando ${i + 1} de ${ids.length}…`);
      try {
        const r = await fetch(`/api/fotografo/disenos/${id}/approve`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.ok) throw new Error(d.error || "No se pudo aprobar.");
        bien += 1;
      } catch (e) {
        fallas.push(`#${id}: ${e instanceof Error ? e.message : "error"}`);
      }
    }
    setOcupado(null);
    setSeleccion(new Set());
    setMensaje({
      tono: fallas.length ? "error" : "ok",
      texto:
        `Aprobaste ${plural(bien, "diseño", "diseños")}.` +
        (fallas.length ? ` No se pudieron aprobar ${fallas.length}: ${fallas.slice(0, 3).join(" · ")}` : ""),
    });
    void recargar();
  }

  // ------------------------------------------------------------------ lotes de impresión

  const [lotes, setLotes] = useState<Lote[]>([]);
  const cargarLotes = useCallback(async () => {
    const r = await fetch("/api/fotografo/escolar/lotes", { credentials: "include", cache: "no-store" });
    const d = await r.json().catch(() => ({}));
    if (r.ok && Array.isArray(d.lotes)) setLotes(d.lotes);
  }, []);
  useEffect(() => {
    void cargarLotes();
  }, [cargarLotes]);

  const descargar = (ruta: string, filtro: { ids?: number[]; lote?: string }) => {
    const q = new URLSearchParams();
    if (filtro.ids?.length) q.set("ids", filtro.ids.join(","));
    if (filtro.lote) q.set("lote", filtro.lote);
    window.open(`/api/fotografo/escolar/${ruta}?${q.toString()}`, "_blank");
  };

  /** Para imprimir · principal: junta los aprobados en un lote nuevo y los pasa a «En imprenta». */
  async function crearLote() {
    const ids = disenosDe(elegidas.length ? elegidas : filas, (d) => APROBADO.has(d.status) && !d.sentToPrintAt);
    if (ids.length === 0) return;
    const ok = window.confirm(
      `Vas a mandar a imprimir ${plural(ids.length, "librito", "librititos")}${elegidas.length ? "" : " (todos los de este paso)"}. ` +
        "Se arma un lote nuevo y pasan a «En imprenta». Después bajás el ZIP o el PDF único para la imprenta.\n\n¿Seguimos?",
    );
    if (!ok) return;
    setOcupado("lote");
    setMensaje(null);
    try {
      const r = await fetch("/api/fotografo/escolar/lotes", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo armar el lote.");
      setMensaje({
        tono: "ok",
        texto: `Listo: ${d.nombre} con ${plural(d.cantidad, "librito", "librititos")}. Lo encontrás en «En imprenta» para descargarlo.`,
      });
      setSeleccion(new Set());
      await Promise.all([recargar(), cargarLotes()]);
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo armar el lote." });
    } finally {
      setOcupado(null);
    }
  }

  async function marcar(paso: "IMPRESO" | "ENTREGADO" | "VOLVER_A_IMPRIMIR", filtro: { ids?: number[]; lote?: string }, texto: string) {
    if (!window.confirm(texto)) return;
    setOcupado(paso);
    setMensaje(null);
    try {
      const r = await fetch("/api/fotografo/escolar/lotes/marcar", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...filtro, paso }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "No se pudo actualizar.");
      setMensaje({ tono: "ok", texto: `Actualizados: ${plural(d.actualizados ?? 0, "librito", "librititos")}.` });
      setSeleccion(new Set());
      await Promise.all([recargar(), cargarLotes()]);
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : "No se pudo actualizar." });
    } finally {
      setOcupado(null);
    }
  }

  // ------------------------------------------------------------------ acciones por fila (tienda escolar)

  async function accionDeFila(o: Order, url: string, generico: string) {
    const k = clave(o);
    setAccionFila((s) => ({ ...s, [k]: true }));
    try {
      const res = await fetch(url, { method: "POST", credentials: "include" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok !== true) throw new Error(mensajeDeError(data, res, generico));
      await recargar();
    } catch (e) {
      setMensaje({ tono: "error", texto: e instanceof Error ? e.message : generico });
    } finally {
      setAccionFila((s) => ({ ...s, [k]: false }));
    }
  }

  const primerItem = (o: Order) => (o.kind === "PACK_EXTERNO" ? undefined : o.items?.[0]);

  function accionesDeFila(o: Order) {
    const ocupada = accionFila[clave(o)] === true;
    const link = "text-left text-[#c27b3d] hover:underline text-xs font-medium disabled:opacity-60 disabled:no-underline";
    const item = primerItem(o);
    const verPedido =
      o.kind === "PACK_EXTERNO" && o.redemptionOrderId ? (
        <Link href="/fotografo/pedidos" className={link}>
          Ver pedido #{o.redemptionOrderId}
        </Link>
      ) : null;

    switch (o.paso) {
      case "POR_CANJEAR":
        return (
          <span className="text-xs text-gray-500">
            {o.kind === "PACK_EXTERNO" ? "Todavía no eligió sus fotos" : "La familia todavía no terminó de elegir"}
          </span>
        );
      case "REVISAR_DISENO":
        if (o.disenos.length === 0 && item) {
          return (
            <button
              type="button"
              disabled={ocupada}
              onClick={() =>
                void accionDeFila(o, `/api/fotografo/school-order-items/${item.id}/generate-design`, "No se pudo generar el diseño")
              }
              className={link}
            >
              {ocupada ? "Generando…" : "Generar diseño"}
            </button>
          );
        }
        return (
          <div className="flex flex-col gap-0.5">
            {o.disenos.map((d, i) => (
              <Link key={d.id} href={`/fotografo/disenos/${d.id}`} className={link}>
                {o.disenos.length > 1 ? `Abrir librito ${i + 1}` : "Abrir diseño"}
                {d.status === "PENDING_PHOTOGRAPHER_APPROVAL" && d.emptySlots > 0 ? (
                  <span className="ml-1 font-normal text-red-700">({d.emptySlots} sin foto)</span>
                ) : null}
              </Link>
            ))}
          </div>
        );
      case "CAMBIOS_PEDIDOS":
        return (
          <div className="flex max-w-xs flex-col gap-1">
            {o.disenos
              .filter((d) => d.status === "NEEDS_ADJUSTMENT")
              .map((d) => (
                <div key={d.id}>
                  {d.reviewNote ? <p className="m-0 text-xs text-sky-900">“{d.reviewNote}”</p> : null}
                  <Link href={`/fotografo/disenos/${d.id}`} className={link}>
                    Abrir diseño
                  </Link>
                </div>
              ))}
          </div>
        );
      case "PARA_IMPRIMIR":
        return (
          <div className="flex flex-col gap-0.5">
            {o.disenos.map((d, i) => (
              <a key={d.id} href={`/api/fotografo/disenos/${d.id}/pdf`} className={link}>
                {o.disenos.length > 1 ? `Descargar PDF ${i + 1}` : "Descargar PDF"}
              </a>
            ))}
            {o.disenos.length === 0 ? <span className="text-xs text-gray-600">Copias sueltas, sin librito</span> : null}
            {verPedido}
            {item && item.status === "EXPORTED" ? (
              <button
                type="button"
                disabled={ocupada}
                onClick={() =>
                  void accionDeFila(
                    o,
                    `/api/fotografo/school-order-items/${item.id}/start-physical-fulfillment`,
                    "No se pudo iniciar la impresión",
                  )
                }
                className={link}
              >
                {ocupada ? "Marcando…" : "Marcar en imprenta"}
              </button>
            ) : null}
          </div>
        );
      case "EN_IMPRENTA":
        if (o.kind === "PACK_EXTERNO") {
          return <span className="text-xs text-gray-600">{o.disenos.find((d) => d.printBatchName)?.printBatchName ?? "En imprenta"}</span>;
        }
        return item ? (
          <button
            type="button"
            disabled={ocupada}
            onClick={() =>
              void accionDeFila(o, `/api/fotografo/school-order-items/${item.id}/mark-at-school`, "No se pudo marcar como en escuela")
            }
            className={link}
          >
            {ocupada ? "Marcando…" : "Marcar en la escuela"}
          </button>
        ) : null;
      case "PARA_ENTREGAR":
        if (o.kind === "PACK_EXTERNO") {
          return <span className="text-xs text-gray-600">Impreso · {o.disenos.find((d) => d.printBatchName)?.printBatchName ?? ""}</span>;
        }
        return item ? (
          <button
            type="button"
            disabled={ocupada}
            onClick={() =>
              void accionDeFila(o, `/api/fotografo/school-order-items/${item.id}/mark-delivered`, "No se pudo marcar como entregado")
            }
            className={link}
          >
            {ocupada ? "Marcando…" : "Marcar entregado"}
          </button>
        ) : null;
      case "ENTREGADO":
        return (
          <span className="text-xs text-gray-600">
            {o.kind === "PACK_EXTERNO" && o.disenos.length === 0 ? "Sólo digital: ya lo descargó" : "Entregado"}
          </span>
        );
      default:
        return <span className="text-xs text-gray-500">{INFO_FUERA[o.paso]}</span>;
    }
  }

  // ------------------------------------------------------------------ barra de acciones del paso

  function barraDeAcciones() {
    const btnPrincipal =
      "inline-flex items-center gap-2 rounded-lg bg-[#c27b3d] px-4 py-2 text-sm font-semibold text-white hover:bg-[#a9682f] disabled:cursor-not-allowed disabled:opacity-50";
    const btnSecundario =
      "inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-gray-800 ring-1 ring-gray-200 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50";
    const nota = (t: string) => <p className="m-0 text-xs text-gray-500">{t}</p>;

    switch (vistaEfectiva) {
      case "POR_CANJEAR": {
        const albumes = new Set(
          (elegidas.length ? elegidas : filas)
            .filter((o) => o.kind === "PACK_EXTERNO" && !o.isDemo && o.album)
            .map((o) => o.album!.id),
        ).size;
        const reenviables = elegidas.filter((o) => o.kind === "PACK_EXTERNO" && !o.isDemo).length;
        return (
          <>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrincipal} disabled={!!ocupado || albumes === 0} onClick={() => void avisarFamilias()}>
                {ocupado === "avisar" ? "Mandando…" : "Avisar a las familias"}
              </button>
              <button type="button" className={btnSecundario} disabled={!!ocupado || reenviables === 0} onClick={() => void reenviarLink()}>
                {ocupado === "reenviar" ? "Reenviando…" : `Reenviar link${reenviables ? ` (${reenviables})` : ""}`}
              </button>
            </div>
            {nota(
              albumes === 0
                ? "El aviso por correo es para los packs cobrados por fuera; las pruebas DEMO nunca reciben correos."
                : "«Avisar» les manda a las familias que no canjearon su link para elegir fotos. Para reenviarle el link a alguien puntual, marcalo y tocá «Reenviar link».",
            )}
          </>
        );
      }
      case "REVISAR_DISENO": {
        const aRevisar = disenosParaRevisar(elegidas.length ? elegidas : filas).length;
        const aAprobar = disenosParaRevisar(elegidas).length;
        return (
          <>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrincipal} disabled={!!ocupado || aRevisar === 0} onClick={revisarDeCorrido}>
                Revisar de corrido{aRevisar ? ` (${aRevisar})` : ""}
              </button>
              <button type="button" className={btnSecundario} disabled={!!ocupado || aAprobar === 0} onClick={() => void aprobarElegidos()}>
                {ocupado?.startsWith("Aprobando") ? ocupado : `Aprobar seleccionados${aAprobar ? ` (${aAprobar})` : ""}`}
              </button>
            </div>
            {nota(
              "«Revisar de corrido» te los muestra uno atrás del otro, grandes: A aprueba, C pide cambios, E abre el editor, ← → para moverte." +
                (elegidas.length ? " Recorre sólo los que marcaste." : ""),
            )}
          </>
        );
      }
      case "CAMBIOS_PEDIDOS":
        return nota("Le pediste algo a cada familia. Cuando te responda, abrí el diseño, corregilo y aprobalo.");
      case "PARA_IMPRIMIR": {
        const base = elegidas.length ? elegidas : filas;
        const paraLote = disenosDe(base, (d) => APROBADO.has(d.status) && !d.sentToPrintAt);
        return (
          <>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrincipal} disabled={!!ocupado || paraLote.length === 0} onClick={() => void crearLote()}>
                {ocupado === "lote" ? "Armando el lote…" : `Crear lote de impresión${paraLote.length ? ` (${paraLote.length})` : ""}`}
              </button>
              <button
                type="button"
                className={btnSecundario}
                disabled={paraLote.length === 0}
                onClick={() => descargar("lotes/zip", { ids: paraLote })}
              >
                Descargar ZIP sin armar lote
              </button>
            </div>
            {nota(
              (elegidas.length ? "Va sólo lo que marcaste. " : "Sin marcar nada, va todo lo de este paso. ") +
                "El lote junta los PDF finales en orden de impresión (colegio, curso y alumno). Conviene un lote por curso: el PDF único admite hasta 40 librititos y el ZIP hasta 60.",
            )}
          </>
        );
      }
      case "EN_IMPRENTA": {
        const impresos = disenosDe(elegidas, (d) => !!d.sentToPrintAt && !d.printedAt);
        const enCurso = lotes.filter((l) => l.impresos < l.cantidad);
        return (
          <>
            {enCurso.length === 0 ? nota("No hay lotes esperando a la imprenta.") : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {enCurso.map((l) => (
                <div key={l.nombre} className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="m-0 text-sm font-semibold text-gray-900">{l.nombre}</p>
                  <p className="m-0 text-xs text-gray-600">
                    {plural(l.cantidad, "librito", "librititos")} · {l.impresos} impresos
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" className={btnSecundario} onClick={() => descargar("lotes/zip", { lote: l.nombre })}>
                      ZIP
                    </button>
                    <button
                      type="button"
                      className={btnSecundario}
                      disabled={l.cantidad > 40}
                      title={l.cantidad > 40 ? "El PDF único admite hasta 40: bajá el ZIP." : undefined}
                      onClick={() => descargar("lotes/pdf", { lote: l.nombre })}
                    >
                      PDF único
                    </button>
                    <button
                      type="button"
                      className={btnPrincipal}
                      disabled={!!ocupado}
                      onClick={() =>
                        void marcar("IMPRESO", { lote: l.nombre }, `¿Volvió impreso todo el ${l.nombre}? Pasa a «Para entregar».`)
                      }
                    >
                      Marcar lote impreso
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {impresos.length ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnSecundario}
                  disabled={!!ocupado}
                  onClick={() =>
                    void marcar("IMPRESO", { ids: impresos }, `¿Volvieron impresos los ${impresos.length} que marcaste?`)
                  }
                >
                  Marcar impresos los elegidos ({impresos.length})
                </button>
                <button
                  type="button"
                  className={btnSecundario}
                  disabled={!!ocupado}
                  onClick={() =>
                    void marcar(
                      "VOLVER_A_IMPRIMIR",
                      { ids: impresos },
                      `¿Sacar ${impresos.length} del lote? Vuelven a «Para imprimir» para armar otro lote.`,
                    )
                  }
                >
                  Sacar del lote
                </button>
              </div>
            ) : null}
            {nota("Cuando la imprenta te los devuelva, marcá el lote impreso. Si alguno salió mal, marcalo y «Sacar del lote» para reimprimirlo.")}
          </>
        );
      }
      case "PARA_ENTREGAR": {
        const base = elegidas.length ? elegidas : filas;
        const ids = disenosDe(base, (d) => !!d.printedAt && !d.deliveredAt);
        return (
          <>
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btnPrincipal} disabled={ids.length === 0} onClick={() => descargar("etiquetas", { ids })}>
                Imprimir etiquetas{ids.length ? ` (${ids.length})` : ""}
              </button>
              <button
                type="button"
                className={btnSecundario}
                disabled={!!ocupado || ids.length === 0}
                onClick={() =>
                  void marcar(
                    "ENTREGADO",
                    { ids },
                    `¿Marcar entregados ${plural(ids.length, "librito", "librititos")}${elegidas.length ? "" : " (todos los de este paso)"}?`,
                  )
                }
              >
                Marcar entregados{ids.length ? ` (${ids.length})` : ""}
              </button>
            </div>
            {nota(
              (elegidas.length ? "Va sólo lo que marcaste. " : "Sin marcar nada, va todo lo de este paso. ") +
                "Las etiquetas salen en hoja A4 (24 por hoja), en el mismo orden que el lote: alumno, curso y colegio. Filtrá por curso para armar los sobres de a un curso.",
            )}
          </>
        );
      }
      case "ENTREGADO":
        return nota("Listo: estos pedidos ya terminaron.");
      default:
        return nota("Pedidos de la tienda escolar con el pago pendiente o cancelados: no entran en la línea.");
    }
  }

  // ------------------------------------------------------------------ pantalla

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PhotographerDashboardHeader photographer={photographer} />
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-gray-600">Cargando pedidos...</p>
        </div>
      </div>
    );
  }

  const formatARS = (cents: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(cents / 100);
  const tituloVista = vistaEfectiva === "FUERA" ? "Fuera de la línea" : INFO_PASOS[vistaEfectiva].titulo;

  return (
    <div className="min-h-screen bg-gray-50">
      <PhotographerDashboardHeader photographer={photographer} />
      <DsPageShell className="py-8">
        <DsDashboardInner className="space-y-6">
          <div className="ds-split-panel sm:items-start sm:justify-between">
            <div className="ds-split-panel__main">
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 mb-2">Pedidos escolares</h1>
              <p className="ds-readable-text ds-readable-text--fluid text-gray-600">
                Cada pedido, desde que la familia paga hasta que lo recibe. Tocá un paso para ver sus pedidos y lo que
                tenés que hacer.
              </p>
            </div>
            <div className="ds-split-panel__aside shrink-0">
              <Link href="/fotografo/escuelas" className="text-[#c27b3d] hover:underline text-sm">
                ← Volver a Escolar
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-xs text-gray-600 mb-1" htmlFor="filtro-escuela">
                Escuela
              </label>
              <select
                id="filtro-escuela"
                value={filterSchool}
                onChange={(e) => {
                  setFilterSchool(e.target.value);
                  setFilterCurso("");
                  setSeleccion(new Set());
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Todas</option>
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1" htmlFor="filtro-curso">
                Curso
              </label>
              <select
                id="filtro-curso"
                value={filterCurso}
                onChange={(e) => {
                  setFilterCurso(e.target.value);
                  setSeleccion(new Set());
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">Todos</option>
                {cursos.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/*
            Los pasos de la línea, como un embudo de ventas: flechas encadenadas, cada una entra en
            la siguiente. El tono se va oscureciendo a medida que el pedido avanza; el paso elegido
            va en naranja lleno y los pasos vacíos quedan apagados.
          */}
          <nav aria-label="Pasos del pedido" className="overflow-x-auto pb-1">
            <ol className="m-0 flex min-w-[860px] list-none p-0">
              {PASOS_EMBUDO.map((p, i) => {
                const activo = vistaEfectiva === p;
                const n = conteo[p];
                const primero = i === 0;
                const ultimo = i === PASOS_EMBUDO.length - 1;
                const punta = 18;
                const forma = `polygon(0 0, calc(100% - ${ultimo ? 0 : punta}px) 0, 100% 50%, calc(100% - ${
                  ultimo ? 0 : punta
                }px) 100%, 0 100%, ${primero ? 0 : punta}px 50%)`;
                const tono = 96 - i * 4;
                const fondo = activo ? "#c27b3d" : n === 0 ? "#f3f4f6" : `hsl(28 45% ${tono}%)`;
                const tinta = activo ? "#ffffff" : n === 0 ? "#9ca3af" : "#5b3518";
                return (
                  <li key={p} className="relative min-w-0 flex-1" style={{ marginLeft: primero ? 0 : -punta + 4 }}>
                    <button
                      type="button"
                      onClick={() => elegirVista(p)}
                      aria-current={activo ? "step" : undefined}
                      title={INFO_PASOS[p].ayuda}
                      className="group flex h-[72px] w-full items-center gap-2.5 text-left transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:brightness-90"
                      style={{
                        clipPath: forma,
                        background: fondo,
                        color: tinta,
                        paddingLeft: primero ? 14 : punta + 10,
                        paddingRight: ultimo ? 12 : punta + 4,
                      }}
                    >
                      <span className="text-[26px] font-bold leading-none tabular-nums">{n}</span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                          Paso {INFO_PASOS[p].numero}
                        </span>
                        <span className="text-[13px] font-semibold leading-tight">{INFO_PASOS[p].titulo}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          {fuera > 0 ? (
            <button
              type="button"
              onClick={() => elegirVista("FUERA")}
              className={`-mt-3 text-xs ${vistaEfectiva === "FUERA" ? "font-semibold text-[#c27b3d]" : "text-gray-500 hover:text-[#c27b3d]"}`}
            >
              Fuera de la línea: {conteo.PAGO_PENDIENTE} con pago pendiente · {conteo.CANCELADO} cancelados
            </button>
          ) : null}

          {/* Lo que hay que hacer en este paso */}
          <Card className="space-y-2 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="m-0 text-base font-semibold text-gray-900">
                {vistaEfectiva === "FUERA" ? tituloVista : `${INFO_PASOS[vistaEfectiva].numero}. ${tituloVista}`}
                <span className="ml-2 text-sm font-normal text-gray-500">
                  {vistaEfectiva === "FUERA" ? "" : INFO_PASOS[vistaEfectiva].ayuda}
                </span>
              </h2>
              {elegidas.length > 0 ? (
                <span className="text-sm text-gray-700">{plural(elegidas.length, "marcado", "marcados")}</span>
              ) : null}
            </div>
            {barraDeAcciones()}
            {mensaje ? (
              <p
                role="status"
                className={`m-0 rounded-lg px-3 py-2 text-sm ${
                  mensaje.tono === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"
                }`}
              >
                {mensaje.texto}
              </p>
            ) : null}
          </Card>

          {filas.length === 0 ? (
            <Card className="overflow-hidden p-0">
              <DsEmptyState variant="tight">
                {cargandoLista
                  ? "Cargando pedidos…"
                  : vistaEfectiva !== "FUERA" && PASOS_PROXIMAMENTE.includes(vistaEfectiva)
                    ? "No hay pedidos en este paso. Para los packs cobrados por fuera, la imprenta y la entrega se van a registrar muy pronto."
                    : "No hay pedidos en este paso con estos filtros."}
              </DsEmptyState>
            </Card>
          ) : (
            <div className="ds-table-scroll overflow-x-auto rounded-xl border border-gray-100 bg-white">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="w-10 py-3 px-3">
                      <input
                        type="checkbox"
                        aria-label="Seleccionar todos"
                        checked={todasElegidas}
                        onChange={alternarTodas}
                        className="h-4 w-4 accent-[#c27b3d]"
                      />
                    </th>
                    <th className="text-left py-3 px-3 font-medium">Alumno</th>
                    <th className="text-left py-3 px-3 font-medium">Curso</th>
                    <th className="text-left py-3 px-3 font-medium">Escuela</th>
                    <th className="text-left py-3 px-3 font-medium">Adulto</th>
                    <th className="text-left py-3 px-3 font-medium">Pagó</th>
                    <th className="text-left py-3 px-3 font-medium">Qué hacer</th>
                    <th className="text-left py-3 px-3 font-medium">Etiquetas</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((o) => (
                    <tr
                      key={clave(o)}
                      className={`border-b border-gray-100 align-top ${seleccion.has(clave(o)) ? "bg-[#c27b3d]/5" : "hover:bg-gray-50"}`}
                    >
                      <td className="py-3 px-3">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${alumnoDe(o)}`}
                          checked={seleccion.has(clave(o))}
                          onChange={() => alternar(o)}
                          className="h-4 w-4 accent-[#c27b3d]"
                        />
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-medium text-gray-900">{alumnoDe(o)}</span>
                        {o.isDemo ? (
                          <span
                            className="ml-2 inline-flex rounded bg-fuchsia-100 px-1.5 py-0.5 text-[11px] font-bold text-fuchsia-800"
                            title="Tu prueba del canje con «Probar canje»: no se cobra, no entra en tus ventas y nunca manda correos."
                          >
                            DEMO
                          </span>
                        ) : null}
                        <div className="text-xs text-gray-500">
                          {o.kind === "PACK_EXTERNO" ? "Pack cobrado por fuera" : "Tienda escolar"}
                        </div>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">{textoCurso(o.schoolCourse) ?? "—"}</td>
                      <td className="py-3 px-3">
                        <div>{o.album?.school?.name ?? "—"}</div>
                        {o.album ? (
                          <Link href={`/dashboard/albums/${o.album.id}`} className="text-xs text-[#c27b3d] hover:underline">
                            {o.album.title}
                          </Link>
                        ) : null}
                      </td>
                      <td className="py-3 px-3">
                        <div>{o.buyerName ?? "—"}</div>
                        <div className="text-xs text-gray-500 break-all">{o.buyerEmail}</div>
                        {o.buyerPhone ? <div className="text-xs text-gray-500">{o.buyerPhone}</div> : null}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <div>
                          {new Date(o.createdAt).toLocaleDateString("es-AR", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            timeZone: "America/Argentina/Buenos_Aires",
                          })}
                        </div>
                        <div className="text-xs text-gray-500">{o.isDemo ? "Prueba" : formatARS(o.totalCents)}</div>
                      </td>
                      <td className="py-3 px-3">{accionesDeFila(o)}</td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        {o.kind === "PACK_EXTERNO" ? (
                          <span className="text-gray-400 text-xs">—</span>
                        ) : (
                          <a
                            href={`/api/fotografo/escuelas/pedidos/${o.id}/labels`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#c27b3d] hover:underline text-xs"
                          >
                            Imprimir etiquetas
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DsDashboardInner>
      </DsPageShell>

      {revision ? <RevisionDeCorrido disenos={revision} onClose={alCerrarRevision} /> : null}
    </div>
  );
}
