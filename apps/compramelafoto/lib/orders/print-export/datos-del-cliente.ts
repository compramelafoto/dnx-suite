/**
 * Datos del cliente que van en la carpeta de impresión de un pedido (MANIFEST.txt, RESUMEN_PEDIDO.pdf
 * y nombre de la carpeta). Puro, para poder probarlo.
 *
 * - Para el fotógrafo (su propia descarga): nombre, correo, teléfono y total, como siempre.
 * - Para el laboratorio (ZIP del lote de impresión): sin correo, sin teléfono y sin total, y el nombre
 *   nunca es un correo o un teléfono.
 */

import type { AlumnoDelPedido } from "./alumno-del-pedido";

export type DatosDelComprador = { name: string | null; email: string | null; phone: string | null };

/**
 * El nombre del cliente sin datos de contacto: un correo o algo que parece un teléfono (a veces se
 * guarda el correo cuando el pedido no tiene nombre) se cambia por «Cliente».
 */
export function nombreSinContacto(cliente: string): string {
  const t = cliente.trim();
  const pareceTelefono = /^[+\d\s().-]+$/.test(t) && (t.match(/\d/g)?.length ?? 0) >= 6;
  if (!t || t.includes("@") || pareceTelefono) return "Cliente";
  return t;
}

/** Lo que encabeza la carpeta del pedido (sin código ni alumno; eso lo arma `carpetaDePedido`). */
export function rotuloDelCliente(buyer: DatosDelComprador, paraLaboratorio: boolean): string {
  if (paraLaboratorio) return nombreSinContacto(buyer.name || "");
  return buyer.name || buyer.email || "Cliente";
}

/** Las líneas del encabezado del MANIFEST.txt. */
export function encabezadoDelManifest(p: {
  orderId: number;
  alumno: AlumnoDelPedido | null;
  buyer: DatosDelComprador;
  createdAt: Date;
  totalCents: number;
  paraLaboratorio: boolean;
}): string[] {
  const { alumno, buyer, paraLaboratorio } = p;
  const nombre = paraLaboratorio ? nombreSinContacto(buyer.name || "") : buyer.name || "-";
  return [
    `Pedido Álbum: ${p.orderId}`,
    ...(alumno ? [`Alumno: ${alumno.alumno}`, `Curso: ${alumno.curso || "-"}`] : []),
    `${alumno ? "Adulto" : "Nombre"}: ${nombre}`,
    ...(paraLaboratorio ? [] : [`Email: ${buyer.email || "-"}`, `WhatsApp / teléfono: ${buyer.phone || "-"}`]),
    `Fecha: ${p.createdAt.toISOString()}`,
    ...(paraLaboratorio ? [] : [`Total: ${p.totalCents} ARS`]),
    "",
    "ITEMS IMPRESIÓN:",
    "Producto | Acabado | Tamaño | Cantidad | Ruta ZIP",
  ];
}

/** Líneas de la cabecera del RESUMEN_PEDIDO.pdf (pedido, fecha y, para el fotógrafo, total). */
export function cabeceraDelPdf(p: { orderId: number; fecha: string; totalCents: number; paraLaboratorio: boolean }): string[] {
  return [
    `Pedido N°: ${p.orderId}`,
    `Fecha: ${p.fecha}`,
    ...(p.paraLaboratorio ? [] : [`Total: $${p.totalCents} ARS`]),
  ];
}

/** Líneas de «Datos del cliente» del RESUMEN_PEDIDO.pdf. */
export function clienteEnElPdf(buyer: DatosDelComprador, paraLaboratorio: boolean): string[] {
  if (paraLaboratorio) return [`Nombre: ${nombreSinContacto(buyer.name || "")}`];
  return [`Nombre: ${buyer.name || "-"}`, `Email: ${buyer.email || "-"}`, `WhatsApp / teléfono: ${buyer.phone || "-"}`];
}
