import { clavesPublicas } from "@/lib/ventas/certificado";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Las claves públicas Ed25519 con las que se verifican los certificados (etapa 8, D18), por `kid`:
 * la actual y las anteriores si se rotó. Nunca la privada.
 */
export function GET() {
  const claves = clavesPublicas();
  const texto = Object.keys(claves).length
    ? Object.entries(claves).map(([kid, pem]) => `# ${kid}\n${pem.trim()}\n`).join("\n")
    : "# Todavía no hay claves publicadas.\n";
  return new Response(texto, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" } });
}
