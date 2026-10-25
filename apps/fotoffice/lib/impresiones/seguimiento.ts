import type { Fase } from "@/lib/proyectos/en-curso-puro";

/** Los cuatro pasos que ve el cliente al seguir su pedido. */
export type Paso = "RECIBIDO" | "EN_LABORATORIO" | "LISTO" | "ENTREGADO";
export const PASOS: readonly { clave: Paso; titulo: string }[] = [
  { clave: "RECIBIDO", titulo: "Recibido" },
  { clave: "EN_LABORATORIO", titulo: "En el laboratorio" },
  { clave: "LISTO", titulo: "Listo" },
  { clave: "ENTREGADO", titulo: "Entregado" },
];

const ORDEN: Paso[] = ["RECIBIDO", "EN_LABORATORIO", "LISTO", "ENTREGADO"];
const deFase = (f: Fase): Paso => (f === "ENTREGADO" ? "ENTREGADO" : f === "LISTO" ? "LISTO" : f === "EN_PROVEEDOR" ? "EN_LABORATORIO" : "RECIBIDO");

/** En qué paso va el pedido: mientras no se envió a los laboratorios, Recibido; después, el trabajo más atrasado. */
export function pasoDelPedido(estado: string, fases: Fase[]): Paso {
  if (estado !== "ENVIADO" || fases.length === 0) return "RECIBIDO";
  return fases.map(deFase).reduce((min, p) => (ORDEN.indexOf(p) < ORDEN.indexOf(min) ? p : min), "ENTREGADO" as Paso);
}
