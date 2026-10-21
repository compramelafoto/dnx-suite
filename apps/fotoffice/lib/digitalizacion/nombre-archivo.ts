/** Nombre con el que se baja un video: se arma con datos del pedido, sin base ni sesión. */

const MAX_BASE = 150;

export type DatosNombreVideo = {
  pedidoNumero: string | null;
  clienteNombre: string | null;
  titulo: string | null;
  tipo: "VHS" | "DVD";
  cassetteNumero: number | null;
};

const PROHIBIDOS = /[\/\\:*?"<>|\u0000-\u001f\u007f]/g;

function limpiar(s: string): string {
  return s.replace(PROHIBIDOS, "").replace(/\s+/g, " ").trim();
}

export function nombreCliente(c: { firstName: string | null; lastName: string | null; businessName: string | null } | null | undefined): string | null {
  if (!c) return null;
  const empresa = c.businessName?.trim();
  if (empresa) return empresa;
  const persona = [c.firstName, c.lastName].map((x) => x?.trim() ?? "").filter(Boolean).join(" ");
  return persona || null;
}

export function nombreArchivoVideo(d: DatosNombreVideo, extension: string): string {
  const titulo = d.titulo?.trim() ? d.titulo : d.tipo === "DVD" ? "DVD" : d.cassetteNumero != null ? `Cassette ${d.cassetteNumero}` : "Cassette";
  const pedido = d.pedidoNumero?.trim() ? `Pedido ${d.pedidoNumero}` : "Prueba";
  const partes = [pedido, d.clienteNombre ?? "", titulo].map(limpiar).filter(Boolean);
  const base = limpiar(partes.join(" - ").slice(0, MAX_BASE)) || "Video";
  return `${base}.${extension.replace(/[^A-Za-z0-9]/g, "") || "bin"}`;
}
