/** Nombre con el que se baja un video: se arma con datos del pedido, sin base ni sesión. */

const MAX_BASE = 150;

export type DatosNombreVideo = {
  pedidoNumero: string | null;
  clienteNombre: string | null;
  titulo: string | null;
  tipo: "VHS" | "DVD";
  cassetteNumero: number | null;
};

// Además de lo que prohíben los sistemas de archivos: controles C1, marcas de dirección y
// caracteres invisibles (con ellos un nombre se puede mostrar "dado vuelta" al guardarlo).
const PROHIBIDOS = /[\/\\:*?"<>|\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩﻿]/g;

function limpiar(s: string): string {
  return s.replace(PROHIBIDOS, "").replace(/\s+/g, " ").trim();
}

/** Corta por caracteres completos: partir un emoji deja una mitad que rompe la codificación de la descarga. */
function cortar(s: string, max: number): string {
  return Array.from(s).slice(0, max).join("");
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
  const base = limpiar(cortar(partes.join(" - "), MAX_BASE)) || "Video";
  return `${base}.${extension.replace(/[^A-Za-z0-9]/g, "") || "bin"}`;
}
