import type { PaginaComprador } from "./pagina";

export type GlobitoComprador = {
  campaign: string;
  texto: string;
  botones: Array<{ label: string; mensaje: string | null; accion: "CLICKED" | "DISMISSED" }>;
};

export type SaludoComprador = {
  saludo: string;
  sugerencias: string[];
  globito: GlobitoComprador | null;
  globitoDemoraMs: number | null;
};

const DEMORA_GLOBITO_MS = 20000;

const GLOBITO_ALBUM: GlobitoComprador = {
  campaign: "comprador_album",
  texto: "¿Te ayudo a encontrar tus fotos o a elegir un pack?",
  botones: [
    { label: "Encontrar mis fotos", mensaje: "¿Cómo encuentro mis fotos en este álbum?", accion: "CLICKED" },
    { label: "Elegir un pack", mensaje: "¿Qué packs o descuentos tiene este álbum?", accion: "CLICKED" },
  ],
};

const GLOBITO_DESCARGA: GlobitoComprador = {
  campaign: "comprador_descarga",
  texto: "¿Problemas para bajar tus fotos?",
  botones: [{ label: "Sí, ayudame", mensaje: "Tengo problemas para bajar mis fotos", accion: "CLICKED" }],
};

function sinGlobito(saludo: string, sugerencias: string[]): SaludoComprador {
  return { saludo, sugerencias, globito: null, globitoDemoraMs: null };
}

/** Saludo, sugerencias y globito de DNX Bot según la página del comprador. Puro. */
export function saludoComprador(p: PaginaComprador): SaludoComprador {
  switch (p.tipo) {
    case "album":
    case "album_id": {
      const remover = p.tipo === "album_id" && p.photoId != null;
      return {
        saludo: "Hola, soy DNX Bot. Te ayudo a encontrar tus fotos o a elegir qué comprar.",
        sugerencias: remover
          ? ["Quiero que saquen esta foto", "¿Cuánto tarda?"]
          : ["¿Cómo encuentro mis fotos?", "¿Cuánto salen las fotos?", "¿Hay packs o descuentos?"],
        globito: GLOBITO_ALBUM,
        globitoDemoraMs: DEMORA_GLOBITO_MS,
      };
    }
    case "descarga":
      return {
        saludo: "Hola, soy DNX Bot. ¿Problemas para bajar tus fotos?",
        sugerencias: ["No puedo bajar el ZIP", "Se me venció el enlace", "Reenviame el enlace por mail"],
        globito: GLOBITO_DESCARGA,
        globitoDemoraMs: DEMORA_GLOBITO_MS,
      };
    case "pack":
    case "recuperar_pack":
      return sinGlobito("Hola, soy DNX Bot. Te ayudo con tu pack de preventa.", [
        "¿Cómo elijo mis fotos?",
        "No me llegó el enlace del pack",
        "El alumno está mal cargado",
      ]);
    case "pago":
      return sinGlobito(
        "Hola, soy DNX Bot. ¿Te ayudo con tu pago?",
        p.resultado === "success"
          ? ["No me llegó el mail con las fotos", "¿Cuándo puedo descargar?"]
          : ["¿En qué quedó mi pago?", "Quiero reintentar el pago", "Me cobraron dos veces"],
      );
    case "mis_pedidos":
    case "soporte":
      return sinGlobito("Hola, soy DNX Bot. ¿En qué te ayudo con tus compras?", [
        "¿En qué quedó mi pedido?",
        "Reenviame el enlace de descarga",
        "Quiero que saquen una foto",
      ]);
  }
}
