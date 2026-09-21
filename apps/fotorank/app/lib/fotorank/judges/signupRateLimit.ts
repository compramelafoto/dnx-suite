/**
 * Tope de altas públicas por IP.
 *
 * Vive en la memoria del proceso, como el freno de las credenciales de
 * Clickatón (`lib/participant-cards/participant-card-rate-limit.ts`). Eso
 * significa que cada instancia de Vercel lleva su propia cuenta: frena el abuso
 * casual, no un ataque repartido. Si algún día hace falta más, se mueve a la
 * base; hasta entonces, no vale una tabla.
 */
export const ALTAS_MAXIMAS_POR_IP_POR_DIA = 5;

const VENTANA_MS = 24 * 60 * 60 * 1000;

const altasPorIp = new Map<string, number[]>();

function podar(marcas: number[], ahora: number): number[] {
  return marcas.filter((t) => ahora - t < VENTANA_MS);
}

/** La IP del visitante, o "" si el proxy no la informó. */
export function ipDelPedido(headers: Headers): string {
  const reenviada = headers.get("x-forwarded-for");
  if (reenviada) {
    // La primera de la lista es la del visitante; las siguientes son proxies.
    const primera = reenviada.split(",")[0]?.trim();
    if (primera) return primera;
  }
  return headers.get("x-real-ip")?.trim() || "";
}

export function puedeAltaDesdeIp(ip: string, ahora: Date): boolean {
  // Sin IP no se frena: bloquear por "IP desconocida" frenaría a todos juntos.
  if (!ip) return true;
  const marcas = podar(altasPorIp.get(ip) ?? [], ahora.getTime());
  altasPorIp.set(ip, marcas);
  return marcas.length < ALTAS_MAXIMAS_POR_IP_POR_DIA;
}

export function registrarAltaDesdeIp(ip: string, ahora: Date): void {
  if (!ip) return;
  const marcas = podar(altasPorIp.get(ip) ?? [], ahora.getTime());
  marcas.push(ahora.getTime());
  altasPorIp.set(ip, marcas);
}

export function limpiarAltasParaPruebas(): void {
  altasPorIp.clear();
}
