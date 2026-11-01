/**
 * El listado de participantes que el organizador descarga en Excel.
 *
 * Una fila por persona inscripta, con sus datos de contacto y cuántas obras
 * tiene en cada categoría. Lo pidió El Baúl del Fotógrafo para Retratos del
 * mundo 2026: el panel dejaba revisar las obras de a una, pero no había forma
 * de llevarse la lista para contactar a la gente o cruzarla con otra planilla.
 *
 * Sólo arma las filas y el archivo; quién puede descargarlo lo decide la ruta.
 */
import * as XLSX from "xlsx";

export type ObraParaListar = {
  numero: string | null;
  categoria: string;
  estado: string;
  admision: string | null;
};

export type InscripcionParaListar = {
  numero: string | null;
  estado: string;
  pago: string;
  inscriptaEl: Date;
  aceptaNovedades: boolean;
  persona: {
    nombre: string | null;
    email: string;
    telefono: string | null;
    whatsapp: string | null;
    instagram: string | null;
    ciudad: string | null;
    provincia: string | null;
    pais: string | null;
  };
  obras: ObraParaListar[];
};

const ESTADO_DE_INSCRIPCION: Record<string, string> = {
  DRAFT: "Sin terminar",
  PENDING_PAYMENT: "Esperando el pago",
  CONFIRMED: "Confirmada",
  CANCELLED: "Cancelada",
  DISQUALIFIED: "Descalificada",
};

const ESTADO_DE_PAGO: Record<string, string> = {
  NOT_REQUIRED: "Sin cargo",
  PENDING: "Pendiente",
  PAID: "Pagado",
  FAILED: "Rechazado",
  REFUNDED: "Devuelto",
};

/** Cómo está la obra, dicho como lo diría el organizador. */
export function estadoDeLaObra(obra: Pick<ObraParaListar, "estado" | "admision">): string {
  if (obra.estado === "REJECTED" || obra.admision === "REJECTED" || obra.admision === "EXCLUDED") {
    return "Rechazada";
  }
  if (obra.estado === "WITHDRAWN" || obra.admision === "WITHDRAWN") return "Retirada";
  if (obra.estado === "REPLACED" || obra.admision === "REPLACED") return "Reemplazada";
  if (obra.admision === "FROZEN_FOR_JURY") return "En el jurado";
  if (obra.admision === "ADMITTED") return "Admitida";
  if (obra.estado === "CONFIRMED") return "Confirmada";
  return "Sin confirmar";
}

const ESTADO_TECNICO: Record<string, string> = {
  NOT_EVALUATED: "Sin revisar",
  APPROVED: "Aprobada",
  APPROVED_WITH_WARNINGS: "Aprobada con avisos",
  REQUIRES_REVIEW: "Para revisar",
  TECHNICALLY_REJECTED: "No cumple",
};

/** El control técnico automático (tamaño, formato, metadatos), en castellano. */
export function estadoTecnico(estado: string | null): string {
  return estado ? (ESTADO_TECNICO[estado] ?? estado) : "—";
}

/** Las obras que siguen compitiendo: confirmadas y no rechazadas ni retiradas. */
function sigueEnConcurso(obra: ObraParaListar): boolean {
  return ["Confirmada", "Admitida", "En el jurado"].includes(estadoDeLaObra(obra));
}

function fechaArgentina(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const p = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((x) => x.type === tipo)?.value ?? "";
  return `${p("day")}/${p("month")}/${p("year")} ${p("hour")}:${p("minute")}`;
}

export type FilaDelListado = Record<string, string | number>;

/**
 * `categorias` fija qué columnas "Obras en …" lleva el listado, en el orden
 * del concurso: así una categoría sin obras igual aparece, con ceros.
 */
export function filasDelListado(
  inscripciones: InscripcionParaListar[],
  categorias: string[],
): FilaDelListado[] {
  const filas = inscripciones.map((i) => {
    const fila: FilaDelListado = {
      "Nº de inscripción": i.numero ?? "",
      Nombre: i.persona.nombre ?? "",
      Correo: i.persona.email,
      Teléfono: i.persona.telefono ?? "",
      WhatsApp: i.persona.whatsapp ?? "",
      Instagram: i.persona.instagram ?? "",
      Ciudad: i.persona.ciudad ?? "",
      Provincia: i.persona.provincia ?? "",
      País: i.persona.pais ?? "",
      "Fecha de inscripción": fechaArgentina(i.inscriptaEl),
      Inscripción: ESTADO_DE_INSCRIPCION[i.estado] ?? i.estado,
      Pago: ESTADO_DE_PAGO[i.pago] ?? i.pago,
    };
    for (const c of categorias) {
      fila[`Obras en ${c}`] = i.obras.filter((o) => o.categoria === c && sigueEnConcurso(o)).length;
    }
    fila["Obras en concurso"] = i.obras.filter(sigueEnConcurso).length;
    fila["Obras rechazadas"] = i.obras.filter((o) => estadoDeLaObra(o) === "Rechazada").length;
    fila["Detalle de obras"] = i.obras
      .map((o) => `${o.numero ?? "sin número"} (${o.categoria}, ${estadoDeLaObra(o)})`)
      .join(" · ");
    fila["Acepta novedades"] = i.aceptaNovedades ? "Sí" : "No";
    return fila;
  });

  /*
   * La inscripción de FotoRank pide nombre y correo; teléfono, ciudad e
   * Instagram sólo aparecen si la persona los cargó en su cuenta. En Retratos
   * del mundo no los tenía nadie: seis columnas vacías hacen pensar que el
   * listado salió mal. Se omiten las que nadie completó.
   */
  const vacias = COLUMNAS_OPCIONALES.filter((c) => filas.every((f) => f[c] === ""));
  for (const f of filas) for (const c of vacias) delete f[c];
  return filas;
}

const COLUMNAS_OPCIONALES = ["Teléfono", "WhatsApp", "Instagram", "Ciudad", "Provincia", "País"];

/** El archivo .xlsx, con la fila de encabezados fija al bajar. */
export function libroDelListado(filas: FilaDelListado[], titulo: string): Buffer {
  const hoja = XLSX.utils.json_to_sheet(filas);
  const columnas = filas[0] ? Object.keys(filas[0]) : [];
  hoja["!cols"] = columnas.map((c) => ({
    wch: Math.min(60, Math.max(c.length, ...filas.map((f) => String(f[c] ?? "").length)) + 2),
  }));
  hoja["!freeze"] = { xSplit: 0, ySplit: 1 };
  const libro = XLSX.utils.book_new();
  // Excel no admite más de 31 caracteres ni algunos signos en el nombre de la hoja.
  XLSX.utils.book_append_sheet(libro, hoja, titulo.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Participantes");
  return XLSX.write(libro, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
