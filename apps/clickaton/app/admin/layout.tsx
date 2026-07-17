import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Panel admin",
  robots: { index: false, follow: false },
};

/**
 * Layout raíz de /admin — sin chrome público.
 * El shell autenticado vive en `(panel)/layout.tsx`.
 */
export default function AdminRootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
