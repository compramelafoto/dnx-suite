import type { Instructivo } from "../tipos";
import { PORTFOLIO_MODULE_KEY } from "@/lib/portfolio/constants";

export const guia: Instructivo = {
  slug: "ventas-portfolios-del-estudio",
  titulo: "Mandarle a cada cliente el portfolio que corresponde",
  resumen:
    "Encontrar en segundos la presentación y los trabajos que se parecen a lo que pide el cliente, y mandarle el enlace por WhatsApp.",
  seccion: "Ventas",
  moduleKey: PORTFOLIO_MODULE_KEY,
  minutos: 3,
  pasos: [
    {
      titulo: "Abrí Portfolios",
      texto: [
        "En el menú tocá «Portfolios». Si arriba ves dos solapas, elegí «Del estudio».",
        "Los trabajos están ordenados por rubro (XV, Bodas, Sesiones infantiles…) y, dentro de cada rubro, por estilo (Book previo, Fiesta, Sesión temática…).",
      ],
    },
    {
      titulo: "Andá al rubro de la consulta",
      texto: [
        "Usá «Ir a un rubro…» para saltar directo, por ejemplo a XV.",
        "Si te piden algo puntual («una sesión en Funes», «la boda de Lara»), escribilo en «Buscar por nombre o lugar».",
      ],
    },
    {
      titulo: "Empezá por la presentación de venta",
      texto: [
        "Arriba de cada rubro están sus «Presentaciones de venta»: la versión con precio y la versión sin precio.",
        "Mandá la que corresponda a esa consulta.",
      ],
    },
    {
      titulo: "Sumá dos o tres trabajos parecidos a lo que pide",
      texto: [
        "Buscá el estilo que coincide con lo que quiere el cliente: si pregunta por la fiesta, mirá «Fiesta»; si quiere fotos antes del cumple, «Book previo».",
        "Los trabajos destacados aparecen primero. Con dos o tres alcanza: más enlaces confunden.",
      ],
      nota: "Tocá «Abrir» para mirarlo antes de mandarlo. Se abre igual que lo va a ver el cliente.",
    },
    {
      titulo: "Copiá el enlace y pegalo en WhatsApp",
      texto: [
        "Tocá «Copiar enlace». El botón cambia a «Copiado».",
        "Pegalo en la conversación con el cliente, con una frase corta: «Te paso una sesión parecida a lo que buscás».",
        "Si en vez de «Copiado» aparece un recuadro con el enlace y «Copialo a mano», mantené apretado el recuadro, elegí «Copiar» y pegalo igual.",
      ],
    },
    {
      titulo: "Si no encontrás lo que buscás",
      texto: [
        "Sólo ves los trabajos que están publicados en el sitio y que tienen un rubro elegido. Si falta alguno, avisale a quien carga los trabajos del sitio para que lo etiquete.",
        "Los videos se van a sumar más adelante: por ahora, cada rubro muestra «Videos — próximamente».",
      ],
    },
  ],
};
