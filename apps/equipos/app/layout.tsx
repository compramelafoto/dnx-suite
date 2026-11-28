import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Equipos verificados",
  description: "Equipos fotográficos usados, verificados.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
