import ClienteLayoutClient from "@/components/panels/ClienteLayoutClient";

export default function ClienteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClienteLayoutClient>{children}</ClienteLayoutClient>;
}
