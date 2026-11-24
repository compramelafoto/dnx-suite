/**
 * Píxel de Meta en la página de un turno (sólo navegador). Dos cosas:
 * - `sumarPixelDelTurno`: el píxel adicional del tipo de turno (ej. el de otra marca que paga la
 *   publicidad) recibe la vista de esa página. Convive con el píxel del sitio: cada uno manda su vista
 *   con `trackSingle`, así ninguno cuenta la del otro.
 * - `avisarReservaAMeta`: al reservar, el evento estándar `Schedule` va a todos los píxeles de la página.
 *
 * Nunca se manda un dato de la persona (nombre, correo, teléfono): sólo el nombre del tipo de turno.
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  push?: unknown;
  loaded?: boolean;
  version?: string;
  disablePushState?: boolean;
};

type ConFbq = { fbq?: Fbq; _fbq?: Fbq };

const iniciados = new Set<string>();

/** El cargador oficial de Meta, igual al del sitio (`buildTrackingScripts`), sin el aviso automático de cambio de página. */
function asegurarFbq(): Fbq {
  const w = window as unknown as ConFbq;
  if (w.fbq) return w.fbq;
  const n = function (...args: unknown[]) {
    if (n.callMethod) n.callMethod(...args);
    else n.queue!.push(args);
  } as Fbq;
  if (!w._fbq) w._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = "2.0";
  n.queue = [];
  n.disablePushState = true;
  w.fbq = n;
  const t = document.createElement("script");
  t.async = true;
  t.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(t);
  return n;
}

export function sumarPixelDelTurno(pixelId: string): void {
  if (!/^\d{6,20}$/.test(pixelId) || iniciados.has(pixelId)) return;
  const fbq = asegurarFbq();
  iniciados.add(pixelId);
  fbq("init", pixelId);
  fbq("trackSingle", pixelId, "PageView");
}

export function avisarReservaAMeta(tipoNombre: string): void {
  const w = window as unknown as ConFbq;
  w.fbq?.("track", "Schedule", { content_name: tipoNombre.slice(0, 120) });
}
