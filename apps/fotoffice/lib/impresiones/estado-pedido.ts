/** Cómo se lee el estado de un pedido de copias en la ficha del trabajo. Módulo PURO. */

export type Instantaneas = "TODAS" | "ALGUNAS" | "NINGUNA";

const ESTADOS: Record<string, string> = {
  PAGADO: "Pagado, por preparar",
  PREPARANDO: "Preparando la carpeta",
  ENVIADO: "Enviado al laboratorio",
  PAGADO_SIN_ENVIAR: "Pagado, sin enviar",
};

export function instantaneasDe(plazos: (string | null | undefined)[]): Instantaneas {
  const n = plazos.filter((p) => p === "INSTANTANEA").length;
  return n === 0 ? "NINGUNA" : n === plazos.length ? "TODAS" : "ALGUNAS";
}

/** Las instantáneas se imprimen en el estudio: el pedido queda «enviado» pero no fue a ningún laboratorio. */
export function etiquetaDelEstado(estado: string, instantaneas: Instantaneas): string {
  if (instantaneas === "TODAS") {
    if (estado === "ENVIADO") return "Para imprimir en el estudio";
    if (estado === "PAGADO" || estado === "PREPARANDO") return "Pagado, para imprimir en el estudio";
  }
  const base = ESTADOS[estado] ?? estado;
  return instantaneas === "ALGUNAS" && estado === "ENVIADO" ? `${base} · las instantáneas se imprimen en el estudio` : base;
}

/** Una instantánea pagada sigue «para imprimir» hasta que su trabajo llega a Listo (o se cierra). */
export function quedaPorImprimir(fase: string | null, cerrado: boolean): boolean {
  return !cerrado && fase !== "LISTO" && fase !== "ENTREGADO";
}

const PAPEL: Record<string, string> = { BRILLO: "Brillo", MATE: "Mate" };
const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1))));

/** Las copias instantáneas del pedido, por medida y papel. */
export function copiasInstantaneas(
  items: { widthCm: number; heightCm: number; quantity: number; paper: string | null; plazo: string | null }[],
  papelDelPedido: string,
): { tamano: string; papel: string; cantidad: number }[] {
  const m = new Map<string, { tamano: string; papel: string; cantidad: number }>();
  for (const i of items) {
    if (i.plazo !== "INSTANTANEA") continue;
    const tamano = `${num(Math.min(i.widthCm, i.heightCm))}x${num(Math.max(i.widthCm, i.heightCm))}`;
    const papel = PAPEL[i.paper ?? papelDelPedido] ?? i.paper ?? papelDelPedido;
    const r = m.get(`${tamano}|${papel}`) ?? { tamano, papel, cantidad: 0 };
    r.cantidad += i.quantity;
    m.set(`${tamano}|${papel}`, r);
  }
  return [...m.values()];
}
