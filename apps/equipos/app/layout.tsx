import type { Metadata } from "next";
import { getPortalUser } from "@/lib/guards";
import { fuenteSerie, fuenteTexto } from "./_fonts";
import { Encabezado } from "./_ui";
import { MARCA } from "./_ui/marca";
import "./globals.css";

export const metadata: Metadata = {
  title: MARCA,
  description: "Equipos fotográficos usados de fotógrafos con identidad verificada.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const usuario = await getPortalUser();

  return (
    <html lang="es" className={`${fuenteTexto.variable} ${fuenteSerie.variable}`}>
      <body>
        <a className="saltar" href="#contenido">
          Ir al contenido
        </a>
        <Encabezado usuario={usuario} />
        {children}
      </body>
    </html>
  );
}
