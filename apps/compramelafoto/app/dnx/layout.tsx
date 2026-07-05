import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  openGraph: {
    images: [
      {
        url: "/dnx/logo-dnx.png",
        width: 512,
        height: 512,
        alt: "Logo DNX Estudio",
      },
    ],
  },
  twitter: {
    card: "summary",
    images: ["/dnx/logo-dnx.png"],
  },
};

export default function DnxLayout({ children }: { children: ReactNode }) {
  return children;
}
