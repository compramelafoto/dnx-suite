import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

/*
 * Tipografías guardadas en el proyecto (app/_fonts, del juego latino de Fontsource) en lugar de
 * `next/font/google`: esa opción las bajaba de Google en cada publicación y, cuando Google
 * tardaba o respondía mal, la publicación fallaba ("An error occurred in next/font"). Son las
 * mismas familias, en su versión variable (todos los pesos).
 */
const geistSans = localFont({
  variable: "--font-geist-sans",
  src: [{ path: "./_fonts/geist-variable.woff2", weight: "100 900", style: "normal" }],
});

const geistMono = localFont({
  variable: "--font-geist-mono",
  src: [{ path: "./_fonts/geist-mono-variable.woff2", weight: "100 900", style: "normal" }],
});

export const metadata: Metadata = {
  title: "Fotoffice — DNX Suite",
  description: "Panel y venta de cursos por workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased bg-[var(--fo-bg)]`}
      data-theme="light"
    >
      <body className="min-h-full flex flex-col bg-[var(--fo-bg)] text-[var(--fo-text)]">{children}</body>
    </html>
  );
}
