import { notFound } from "next/navigation";
import { marcaPorSegmento, type Marca, type SegmentoMarca } from "./marca";

/**
 * Las páginas viven bajo `app/[marca]` y `next.config.ts` reescribe cada dominio a su carpeta
 * (`/fotografia/…` o `/arte/…`). Del lado del cliente, `usePathname()` puede devolver la ruta ya
 * reescrita: esto le saca el primer segmento si es exactamente una marca.
 */
export function sinPrefijoDeMarca(pathname: string): string {
  const coincide = /^\/(fotografia|arte)(?=\/|$)(.*)$/.exec(pathname);
  if (!coincide) return pathname;
  return coincide[2] || "/";
}

/** La marca del segmento `[marca]`; si no es una marca conocida, la página es un 404. */
export async function marcaDeParams(params: Promise<{ marca: SegmentoMarca | string }>): Promise<Marca> {
  const { marca } = await params;
  return marcaPorSegmento(marca) ?? notFound();
}
