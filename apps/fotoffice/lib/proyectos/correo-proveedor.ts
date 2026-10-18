/**
 * El correo con el que se le manda un trabajo al proveedor (laboratorio). Módulo PURO: arma el
 * asunto y el cuerpo; el envío lo hace `lib/proyectos/proveedor.ts`.
 */

export type DatosCorreoProveedor = {
  estudio: string;
  proveedor: string;
  numeroTrabajo: string;
  producto: string | null;
  cantidad: number | null;
  /** Nombre del cliente, para que el laboratorio rotule el sobre. */
  cliente: string;
  /** "aaaa-mm-dd" o null. */
  entregaDeseada: string | null;
  notas: string | null;
  /** Enlace para descargar los archivos (cuando la carpeta del pedido esté cargada). */
  enlaceArchivos: string | null;
};

function escapar(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fecha(ymd: string): string {
  const [a, m, d] = ymd.split("-");
  return `${d}/${m}/${a}`;
}

export function correoParaProveedor(d: DatosCorreoProveedor): { subject: string; text: string; html: string } {
  const queEs = [d.cantidad && d.cantidad > 1 ? `${d.cantidad} ×` : null, d.producto].filter(Boolean).join(" ") || "Trabajo";
  const subject = `Pedido ${d.numeroTrabajo} de ${d.estudio}: ${queEs}`;
  const filas: [string, string][] = [
    ["Pedido", d.numeroTrabajo],
    ["Qué es", queEs],
    ["Cliente", d.cliente],
    ...(d.entregaDeseada ? ([["Lo necesitamos para", fecha(d.entregaDeseada)]] as [string, string][]) : []),
    ...(d.notas ? ([["Indicaciones", d.notas]] as [string, string][]) : []),
    ...(d.enlaceArchivos ? ([["Archivos", d.enlaceArchivos]] as [string, string][]) : []),
  ];
  const text = [
    `Hola ${d.proveedor}:`,
    "",
    `Les mandamos este pedido de ${d.estudio}.`,
    "",
    ...filas.map(([k, v]) => `${k}: ${v}`),
    "",
    "Cuando tengan el número de pedido o esté listo, respondan este correo.",
    "",
    "Gracias.",
    d.estudio,
  ].join("\n");
  const html = `<p>Hola ${escapar(d.proveedor)}:</p>
<p>Les mandamos este pedido de ${escapar(d.estudio)}.</p>
<table cellpadding="6" style="border-collapse:collapse">${filas
    .map(
      ([k, v]) =>
        `<tr><td style="color:#666">${escapar(k)}</td><td><strong>${
          k === "Archivos" ? `<a href="${escapar(v)}">Descargar los archivos</a>` : escapar(v).replace(/\n/g, "<br>")
        }</strong></td></tr>`,
    )
    .join("")}</table>
<p>Cuando tengan el número de pedido o esté listo, respondan este correo.</p>
<p>Gracias.<br>${escapar(d.estudio)}</p>`;
  return { subject, text, html };
}
