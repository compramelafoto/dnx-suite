/**
 * Variables de las plantillas de CONTRATO (etapa 5) y armado del contexto desde datos ya leídos.
 * Módulo PURO: no consulta la base. Usa el motor de `lib/plantillas/motor.ts` (`analizar`, `completar`),
 * así que también valen los bloques `[si:variable]…[/si]`.
 *
 * Las tablas (`[pedido_items]`, `[pedido_cuotas]`) y el salto de página se arman con regiones que
 * reconoce `formato.ts`: texto tabulado para la vista, tabla real en el PDF.
 */
import { analizar, completar, type ErrorPlantilla } from "@/lib/plantillas/motor";
import { fechaAR } from "@/lib/plantillas/variables";
import { pesosPedido } from "@/lib/pedidos/pantalla";
import { REGION_SALTO, regionTabla, sinMarca } from "./formato";

export type GrupoVariableContrato = "Contratante 1" | "Contratante 2" | "Pedido" | "Evento" | "Empresa" | "Contrato";

export type VariableContrato = {
  clave: string;
  etiqueta: string;
  descripcion: string;
  grupo: GrupoVariableContrato;
};

const DATOS_CONTRATANTE: ReadonlyArray<{ sufijo: string; etiqueta: string; descripcion: string }> = [
  { sufijo: "nombre", etiqueta: "Nombre", descripcion: "Nombre completo o razón social" },
  { sufijo: "documento", etiqueta: "Documento", descripcion: "Tipo y número de documento (por ejemplo, DNI 30.111.222)" },
  { sufijo: "domicilio", etiqueta: "Domicilio", descripcion: "Domicilio y ciudad" },
  { sufijo: "correo", etiqueta: "Correo", descripcion: "Correo electrónico" },
  { sufijo: "telefono", etiqueta: "Teléfono", descripcion: "Teléfono" },
];

function deContratante(n: 1 | 2): VariableContrato[] {
  return DATOS_CONTRATANTE.map((d) => ({
    clave: `contratante${n}_${d.sufijo}`,
    etiqueta: `${d.etiqueta} del contratante ${n}`,
    descripcion: `${d.descripcion} del contratante ${n}.${n === 2 ? " Queda vacío si el pedido tiene un solo contratante." : ""}`,
    grupo: n === 1 ? "Contratante 1" : "Contratante 2",
  }));
}

export const VARIABLES_CONTRATO: readonly VariableContrato[] = [
  ...deContratante(1),
  ...deContratante(2),
  { clave: "pedido_numero", etiqueta: "Número de pedido", descripcion: "El número del pedido del que sale el contrato.", grupo: "Pedido" },
  { clave: "pedido_total", etiqueta: "Total del pedido", descripcion: "El total del pedido, en pesos.", grupo: "Pedido" },
  { clave: "pedido_items", etiqueta: "Detalle del pedido", descripcion: "Tabla con lo contratado: producto, cantidad, precio e importe.", grupo: "Pedido" },
  { clave: "pedido_cuotas", etiqueta: "Plan de cuotas", descripcion: "Tabla con las cuotas: número, vencimiento e importe. Vacía si el pedido no tiene cuotas.", grupo: "Pedido" },
  { clave: "evento", etiqueta: "Evento", descripcion: "El nombre del evento del pedido.", grupo: "Evento" },
  { clave: "evento_fecha", etiqueta: "Fecha del evento", descripcion: "El día del evento, en dd/mm/aaaa.", grupo: "Evento" },
  { clave: "empresa_nombre", etiqueta: "Nombre de la empresa", descripcion: "El nombre o razón social que se cargó en Ajustes de contratos.", grupo: "Empresa" },
  { clave: "empresa_cuit", etiqueta: "CUIT de la empresa", descripcion: "El CUIT cargado en Ajustes de contratos.", grupo: "Empresa" },
  { clave: "empresa_domicilio", etiqueta: "Domicilio de la empresa", descripcion: "El domicilio cargado en Ajustes de contratos.", grupo: "Empresa" },
  { clave: "fecha_hoy", etiqueta: "Fecha de hoy", descripcion: "La fecha en que se genera el contrato, en dd/mm/aaaa (hora de Buenos Aires).", grupo: "Contrato" },
  { clave: "contrato_numero", etiqueta: "Número de contrato", descripcion: "El número del contrato.", grupo: "Contrato" },
  { clave: "salto_de_pagina", etiqueta: "Salto de página", descripcion: "Pasa a una página nueva en el PDF.", grupo: "Contrato" },
];

const CLAVES = new Set(VARIABLES_CONTRATO.map((v) => v.clave));

/** Claves (sin corchetes) que el motor acepta en una plantilla de contrato. */
export function clavesContrato(): ReadonlySet<string> {
  return CLAVES;
}

// --- Datos de entrada (ya leídos de la base) --------------------------------------------------

export type ItemParaContrato = {
  nombre: string;
  cantidad: number;
  /** Pesos. */
  precioUnitario: number;
  /** Pesos: el importe del renglón, ya con descuentos. */
  total: number;
  /** Los opcionales no se incluyen en el contrato. */
  opcional?: boolean;
};

export type CuotaParaContrato = {
  position: number;
  /** "aaaa-mm-dd" (día de Argentina). */
  dueDate: string;
  /** Pesos. */
  amountArs: number;
};

export type ContratanteParaContrato = {
  nombre: string;
  docType: string | null;
  docNumber: string | null;
  address: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
};

export type ContextoContratoEntrada = {
  pedido: { numero: string; totalArs: number };
  items: readonly ItemParaContrato[];
  cuotas: readonly CuotaParaContrato[];
  /** El primero es el contratante 1; el segundo, si hay, el 2. */
  contratantes: readonly ContratanteParaContrato[];
  empresa: { nombre: string | null; cuit: string | null; domicilio: string | null };
  evento: { nombre: string | null; fecha: string | null };
  numero: string;
  hoy: Date;
};

function limpio(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = sinMarca(v).trim();
  return t ? t : null;
}

function fechaYmd(ymd: string | null): string | null {
  const m = ymd ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : null;
}

function datosDe(c: ContratanteParaContrato | undefined): Record<"nombre" | "documento" | "domicilio" | "correo" | "telefono", string | null> {
  if (!c) return { nombre: null, documento: null, domicilio: null, correo: null, telefono: null };
  const documento = [limpio(c.docType), limpio(c.docNumber)].filter(Boolean).join(" ") || null;
  const domicilio = [limpio(c.address), limpio(c.city)].filter(Boolean).join(", ") || null;
  return { nombre: limpio(c.nombre), documento, domicilio, correo: limpio(c.email), telefono: limpio(c.phone) };
}

function cantidad(n: number): string {
  return Number.isInteger(n) ? String(n) : new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n);
}

/**
 * Valores de todas las variables. Una variable sin dato es null (el motor la deja vacía). Todo texto
 * que viene de afuera pasa por `sinMarca`: nadie puede fabricar una tabla o un salto escribiendo.
 */
export function contextoContrato(entrada: ContextoContratoEntrada): (clave: string) => string | null {
  const valores = new Map<string, string | null>();
  ([1, 2] as const).forEach((n, i) => {
    const d = datosDe(entrada.contratantes[i]);
    for (const [k, v] of Object.entries(d)) valores.set(`contratante${n}_${k}`, v);
  });

  const items = entrada.items.filter((i) => !i.opcional);
  valores.set("pedido_numero", limpio(entrada.pedido.numero));
  valores.set("pedido_total", pesosPedido(entrada.pedido.totalArs));
  valores.set(
    "pedido_items",
    items.length
      ? regionTabla([
          ["Descripción", "Cantidad", "Precio unitario", "Importe"],
          ...items.map((i) => [i.nombre, cantidad(i.cantidad), pesosPedido(i.precioUnitario), pesosPedido(i.total)]),
        ])
      : null,
  );
  const cuotas = [...entrada.cuotas].sort((a, b) => a.position - b.position);
  valores.set(
    "pedido_cuotas",
    cuotas.length
      ? regionTabla([
          ["Cuota", "Vencimiento", "Importe"],
          ...cuotas.map((c, i) => [String(i + 1), fechaYmd(c.dueDate) ?? "", pesosPedido(c.amountArs)]),
        ])
      : null,
  );
  valores.set("evento", limpio(entrada.evento.nombre));
  valores.set("evento_fecha", fechaYmd(entrada.evento.fecha));
  valores.set("empresa_nombre", limpio(entrada.empresa.nombre));
  valores.set("empresa_cuit", limpio(entrada.empresa.cuit));
  valores.set("empresa_domicilio", limpio(entrada.empresa.domicilio));
  valores.set("fecha_hoy", fechaAR(entrada.hoy));
  valores.set("contrato_numero", limpio(entrada.numero));
  valores.set("salto_de_pagina", REGION_SALTO);
  return (clave) => valores.get(clave) ?? null;
}

// --- Analizar y completar ---------------------------------------------------------------------

export type ResultadoContrato =
  | { ok: true; texto: string; vacias: string[] }
  | { ok: false; errores: ErrorPlantilla[]; desconocidas: string[] };

/** Revisa una plantilla: variables desconocidas, bloques mal cerrados. No completa nada. */
export function revisarPlantillaContrato(cuerpo: string): { ok: true } | { ok: false; errores: ErrorPlantilla[]; desconocidas: string[] } {
  const r = analizar(sinMarca(cuerpo), CLAVES);
  if (r.ok) return { ok: true };
  const desconocidas = [...new Set(r.errores.flatMap((e) => (e.variable ? [e.variable] : [])))];
  return { ok: false, errores: r.errores, desconocidas };
}

/**
 * Cuerpo de plantilla + valores → texto final del contrato. Si la plantilla usa una variable
 * desconocida no se completa: devuelve los errores y la lista de variables desconocidas.
 */
export function completarContrato(cuerpo: string, valores: (clave: string) => string | null): ResultadoContrato {
  const r = analizar(sinMarca(cuerpo), CLAVES);
  if (!r.ok) {
    const desconocidas = [...new Set(r.errores.flatMap((e) => (e.variable ? [e.variable] : [])))];
    return { ok: false, errores: r.errores, desconocidas };
  }
  const c = completar(r.piezas, valores);
  return { ok: true, texto: c.texto, vacias: c.vacias };
}
