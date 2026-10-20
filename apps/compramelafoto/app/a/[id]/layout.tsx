import { CompradorBot } from "@/components/bot/CompradorBot";

/** DNX Bot para compradores: la burbuja decide con el servidor si se muestra en cada página. */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <CompradorBot />
    </>
  );
}
