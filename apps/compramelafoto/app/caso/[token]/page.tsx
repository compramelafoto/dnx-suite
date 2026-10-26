import type { Metadata } from "next";
import { CompradorBot } from "@/components/bot/CompradorBot";
import { leerTokenCaso } from "@/lib/soporte/token-caso";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu consulta · CompraMeLaFoto", robots: { index: false, follow: false } };

/**
 * Página del link del mail de respuesta de soporte (compradores). Es mínima a propósito: el reclamo se
 * sigue en la ventana del DNX Bot, que se abre sola con la historia. No muestra datos del pedido.
 */
export default async function CasoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const caso = await leerTokenCaso(token);
  return (
    <main style={{ minHeight: "100vh", background: "#faf6f1", padding: "48px 16px", fontFamily: "inherit" }}>
      <div style={{ maxWidth: 520, margin: "0 auto", textAlign: "center", color: "#1f2937" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-compramelafoto.svg" alt="CompraMeLaFoto" style={{ height: 40, margin: "0 auto" }} />
        {caso ? (
          <>
            <h1 style={{ fontSize: 24, margin: "16px 0 8px" }}>Consulta #{caso.ticketId}</h1>
            <p style={{ margin: 0, color: "#4b5563" }}>
              Seguí la conversación en la ventana de DNX Bot. Si se cerró, tocá el robot de abajo a la derecha.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 24, margin: "16px 0 8px" }}>Este link venció</h1>
            <p style={{ margin: 0, color: "#4b5563" }}>
              Por seguridad, los links de soporte duran 30 días. Podés seguir tu consulta desde{" "}
              <a href="/cliente/soporte" style={{ color: "#c27b3d" }}>soporte</a>.
            </p>
          </>
        )}
      </div>
      {caso ? <CompradorBot /> : null}
    </main>
  );
}
