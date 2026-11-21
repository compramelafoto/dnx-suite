/**
 * Puntos de retiro que el cliente puede elegir en la compra de un álbum (diseño §4.2).
 * Funciones puras: las usan `order-photos` (para mostrarlos) y `orders` (para validar la
 * elección), así las dos rutas leen lo mismo.
 */

export type PuntoDeRetiro = {
  id: number;
  nombre: string;
  direccion: string;
  horario: string | null;
};

export type ContactoParaRetiro = {
  id: number;
  nombre: string;
  puntoDeRetiro: boolean;
  activo: boolean;
  direccion: string | null;
  horario: string | null;
  lab: { address: string | null; city: string | null } | null;
};

export const ERROR_ELEGIR_RETIRO = "Elegí dónde retirar tus copias.";

/** Consulta de Prisma para traer los contactos candidatos del dueño del álbum. */
export function consultaPuntosDeRetiro(photographerId: number) {
  return {
    where: { photographerId, activo: true, puntoDeRetiro: true },
    select: {
      id: true,
      nombre: true,
      puntoDeRetiro: true,
      activo: true,
      direccion: true,
      horario: true,
      lab: { select: { address: true, city: true } },
    },
    orderBy: [{ esPredeterminado: "desc" as const }, { nombre: "asc" as const }],
  };
}

function limpio(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t ? t : null;
}

/**
 * Los puntos que se ofrecen: sólo si retira el cliente (`pickupBy` nulo cuenta como cliente,
 * igual que en `order-photos`). Sin dirección propia se usa la del laboratorio vinculado.
 */
export function puntosDeRetiroDelAlbum(
  pickupBy: string | null | undefined,
  contactos: ContactoParaRetiro[],
): PuntoDeRetiro[] {
  if ((pickupBy ?? "CLIENT") !== "CLIENT") return [];
  const puntos: PuntoDeRetiro[] = [];
  for (const c of contactos) {
    if (!c.activo || !c.puntoDeRetiro) continue;
    const delLab = [limpio(c.lab?.address), limpio(c.lab?.city)].filter(Boolean).join(", ");
    const direccion = limpio(c.direccion) ?? limpio(delLab);
    if (!direccion) continue;
    puntos.push({ id: c.id, nombre: c.nombre.trim(), direccion, horario: limpio(c.horario) });
  }
  return puntos;
}

/**
 * Resuelve la elección del cliente. Nunca frena una venta: con un id válido devuelve ese; con un
 * solo punto y sin id, ese; en cualquier otro caso `id: null` (al armar el lote se usa el
 * laboratorio predeterminado del fotógrafo). `faltaElegir` avisa que había varios y no eligió
 * uno válido: el carrito lo usa para pedir la elección con `ERROR_ELEGIR_RETIRO`.
 */
export function elegirPuntoDeRetiro(
  puntos: PuntoDeRetiro[],
  pedidoId?: unknown,
): { id: number | null; faltaElegir: boolean } {
  if (puntos.length === 0) return { id: null, faltaElegir: false };
  const n = typeof pedidoId === "number" ? pedidoId : typeof pedidoId === "string" && pedidoId.trim() ? Number(pedidoId) : NaN;
  const punto = Number.isInteger(n) ? puntos.find((p) => p.id === n) : undefined;
  if (punto) return { id: punto.id, faltaElegir: false };
  const vacio = pedidoId === undefined || pedidoId === null || pedidoId === "";
  if (vacio && puntos.length === 1) return { id: puntos[0].id, faltaElegir: false };
  return { id: null, faltaElegir: true };
}
