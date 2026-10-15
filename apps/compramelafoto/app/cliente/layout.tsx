import ClienteLayoutClient from "@/components/panels/ClienteLayoutClient";
import { CompradorBot } from "@/components/bot/CompradorBot";

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClienteLayoutClient bot={<CompradorBot />}>{children}</ClienteLayoutClient>;
}
