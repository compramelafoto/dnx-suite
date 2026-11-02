import type { Metadata, Viewport } from "next";
import ControlCelular from "@/components/control-remoto/ControlCelular";

export const metadata: Metadata = {
  title: "Control remoto",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, maximumScale: 1, themeColor: "#020617" };

/** El control remoto en el celular. La credencial es el código del QR (va después de `#`). */
export default async function ControlRemotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ControlCelular id={id} />;
}
