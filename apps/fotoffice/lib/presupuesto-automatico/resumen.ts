/**
 * El aviso que le llega a Daniel por Telegram cuando entra una consulta con el presupuesto armado
 * solo (spec 2026-10-25 §2). Módulo PURO: arma el texto (HTML de Telegram, todo escapado) y los
 * botones. Lo que se muestra es para el dueño: lleva costo, horas y margen (nunca va al cliente).
 */
import { pesos } from "@/lib/presupuestos/editor";
import type { BotonTelegram, TecladoTelegram } from "@/lib/telegram/api";
import { datoDeAprobar } from "@/lib/telegram/webhook";
import { textoDeCanales, type ResultadoCanales } from "./canales";

export type ItemDelResumen = { nombre: string; cantidad: number; neto: number; opcional: boolean; horas: number | null };

export type PresupuestoDelResumen = {
  items: ItemDelResumen[];
  total: number;
  /** Costo conocido de lo que suma (null si ningún renglón tiene costo). */
  costo: number | null;
  margen: number | null;
  margenProporcion: number | null;
  /** Horas de trabajo de los conceptos calculados con ¿Cuánto Cobro? (null si no hay). */
  horas: number | null;
  itemsSinCosto: number;
};

export type DatosResumen = {
  aprobacionId: string;
  origen: "WEB" | "WHATSAPP";
  numeroConsulta: string | null;
  cliente: string;
  email: string | null;
  telefono: string | null;
  categoria: string | null;
  /** "dd/mm/aaaa" */
  fechaEvento: string | null;
  lugar: string | null;
  invitados: number | null;
  mensaje: string | null;
  /** null: la categoría no tiene propuesta modelo (o no se pudo armar). */
  presupuesto: PresupuestoDelResumen | null;
  /** Por qué no hay presupuesto, para decirlo claro. */
  motivoSinPresupuesto?: "SIN_PROPUESTA" | "NO_SE_PUDO_ARMAR" | null;
  urlPresupuesto: string | null;
  urlConsulta: string | null;
};

export type EstadoDelAviso =
  | { tipo: "PENDIENTE" }
  | { tipo: "ENVIADO"; canales: ResultadoCanales; via: "TELEGRAM" | "PANEL" }
  | { tipo: "FALLO"; motivo: string };

const MAX_ITEMS = 12;
const MAX_MENSAJE = 300;

/** Escapa para `parse_mode: HTML` de Telegram (sólo hacen falta &, < y >). */
export function escaparHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const e = (s: string | null | undefined) => escaparHtml((s ?? "").replace(/\s+/g, " ").trim());

function horasDe(h: number): string {
  const r = Math.round(h * 10) / 10;
  return `${String(r).replace(".", ",")} h`;
}

function porcentaje(p: number): string {
  return `${Math.round(p * 100)} %`;
}

/** Botones del aviso: Aprobar y enviar (callback) + Corregir (abre el presupuesto); sin presupuesto, Abrir consulta. */
export function botonesDelAviso(d: Pick<DatosResumen, "aprobacionId" | "presupuesto" | "urlPresupuesto" | "urlConsulta">): TecladoTelegram | null {
  const fila: BotonTelegram[] = [];
  if (d.presupuesto) {
    fila.push({ text: "✅ Aprobar y enviar", callback_data: datoDeAprobar(d.aprobacionId) });
    if (urlValida(d.urlPresupuesto)) fila.push({ text: "✏️ Corregir", url: d.urlPresupuesto });
    return { inline_keyboard: [fila] };
  }
  if (urlValida(d.urlConsulta)) return { inline_keyboard: [[{ text: "Abrir la consulta", url: d.urlConsulta }]] };
  return null;
}

/** Telegram sólo acepta botones con direcciones http(s) públicas. */
function urlValida(u: string | null): u is string {
  return typeof u === "string" && /^https?:\/\/[^\s]+$/.test(u) && !/\/\/(localhost|127\.0\.0\.1)/.test(u);
}

export function armarResumen(d: DatosResumen, estado: EstadoDelAviso = { tipo: "PENDIENTE" }): { html: string; teclado: TecladoTelegram | null } {
  const l: string[] = [];
  const titulo = d.origen === "WHATSAPP" ? "Consulta nueva por WhatsApp" : "Consulta nueva desde la web";
  l.push(`<b>📩 ${titulo}${d.numeroConsulta ? ` · N° ${e(d.numeroConsulta)}` : ""}</b>`);
  l.push("");
  l.push(`👤 <b>${e(d.cliente) || "Sin nombre"}</b>`);
  const contacto = [d.email ? e(d.email) : null, d.telefono ? e(d.telefono) : null].filter(Boolean).join(" · ");
  l.push(contacto ? `   ${contacto}` : "   Sin correo ni teléfono");
  const evento = [d.categoria ? e(d.categoria) : "Sin categoría", d.fechaEvento ? `📅 ${e(d.fechaEvento)}` : "sin fecha"].join(" · ");
  l.push(`🎉 ${evento}`);
  if (d.lugar) l.push(`📍 ${e(d.lugar)}`);
  if (d.invitados) l.push(`👥 ${d.invitados} invitados`);
  if (d.mensaje) {
    const m = d.mensaje.replace(/\s+/g, " ").trim();
    l.push(`💬 <i>${e(m.length > MAX_MENSAJE ? `${m.slice(0, MAX_MENSAJE - 1)}…` : m)}</i>`);
  }
  l.push("");

  const p = d.presupuesto;
  if (!p) {
    l.push(
      d.motivoSinPresupuesto === "NO_SE_PUDO_ARMAR"
        ? "⚠️ <b>No se pudo armar el presupuesto solo</b> (revisá la propuesta modelo de esta categoría: algún producto inactivo o un concepto sin precio)."
        : "⚠️ <b>Esta categoría no tiene propuesta modelo</b>, así que no armé presupuesto. Abrí la consulta y respondé a mano, o cargá la propuesta en Configuración → Presupuestos → Propuestas.",
    );
  } else {
    l.push("<b>Qué incluye</b>");
    const suman = p.items.filter((i) => !i.opcional);
    for (const i of suman.slice(0, MAX_ITEMS)) {
      l.push(`• ${i.cantidad !== 1 ? `${i.cantidad} × ` : ""}${e(i.nombre)} — ${pesos(i.neto)}`);
    }
    if (suman.length > MAX_ITEMS) l.push(`• … y ${suman.length - MAX_ITEMS} más`);
    const opcionales = p.items.filter((i) => i.opcional);
    if (opcionales.length > 0) l.push(`<i>Opcionales: ${opcionales.map((i) => `${e(i.nombre)} (${pesos(i.neto)})`).join(", ")}</i>`);
    l.push("");
    l.push(`💰 <b>Precio: ${pesos(p.total)}</b>`);
    const como: string[] = [];
    if (p.costo !== null) como.push(`costo ${pesos(p.costo)}`);
    if (p.horas !== null && p.horas > 0) como.push(horasDe(p.horas));
    if (p.margen !== null) como.push(`margen ${pesos(p.margen)}${p.margenProporcion !== null ? ` (${porcentaje(p.margenProporcion)})` : ""}`);
    if (como.length > 0) l.push(`📊 Cómo se calculó: ${como.join(" · ")}`);
    if (p.itemsSinCosto > 0) l.push(`<i>${p.itemsSinCosto === 1 ? "Un renglón no tiene" : `${p.itemsSinCosto} renglones no tienen`} costo cargado: el margen real puede ser menor.</i>`);
  }

  if (estado.tipo === "ENVIADO") {
    l.push("");
    l.push(`✅ <b>${estado.via === "PANEL" ? "Aprobado desde FOTOFFICE" : "Aprobado"}.</b> ${e(textoDeCanales(estado.canales))}`);
    return { html: l.join("\n"), teclado: null };
  }
  if (estado.tipo === "FALLO") {
    l.push("");
    l.push(`❌ <b>No salió.</b> ${e(estado.motivo)}`);
    return { html: l.join("\n"), teclado: urlValida(d.urlPresupuesto) ? { inline_keyboard: [[{ text: "Abrir el presupuesto", url: d.urlPresupuesto }]] } : null };
  }
  return { html: l.join("\n"), teclado: botonesDelAviso(d) };
}
