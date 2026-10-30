import { informarArchivos } from "@/lib/recuperacion/casos";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lo llama el programa de recuperación de tarjetas (`tools/recuperador-tarjetas`), no el navegador. */
export async function POST(request: Request) {
  return informarArchivos(request);
}
