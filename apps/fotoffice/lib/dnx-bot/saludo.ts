import type { Capacidades } from "./acceso";
import type { Pantalla } from "./contexto";

/**
 * Saludo y sugerencias de la burbuja según la pantalla y lo que la persona puede hacer. Las
 * sugerencias son los mismos primeros mensajes de los botones «Preguntale al bot» (spec §4.1).
 * Quien no tiene `configurar` nunca ve sugerencias de perfil ni de cálculo.
 */
const SALUDO = "Hola, soy DNX Bot. Te ayudo con tus precios y tus presupuestos.";

/** Ayuda con el formulario (barato). Armarlo conversando no se sugiere: se ofrece si la persona se traba. */
const QUE_FALTA = "¿Qué me falta para completar mi perfil?";
const COTIZAR = "Quiero saber cuánto cobrar un trabajo.";
const SUMAR = "Quiero sumar ítems calculados a este presupuesto.";
const RESPONDER = "Ayudame a responder esta consulta.";
const SEGUIMIENTOS = "¿Qué presupuestos tengo sin respuesta?";
const COMO_ARMAR = "¿Cómo armo un presupuesto?";

export function saludoPara(pantalla: Pantalla, c: Capacidades): { saludo: string; sugerencias: string[] } {
  const lista: string[] = [];
  if (c.configurar) {
    if (pantalla === "precios") lista.push(QUE_FALTA, COTIZAR);
    else if (pantalla === "presupuesto") lista.push(SUMAR, COTIZAR);
    else if (pantalla === "consulta") lista.push(RESPONDER, COTIZAR);
    else lista.push(COTIZAR);
    lista.push(SEGUIMIENTOS);
  } else {
    if (pantalla === "consulta" && c.verConsultas) lista.push(RESPONDER);
    lista.push(SEGUIMIENTOS, COMO_ARMAR);
  }
  return { saludo: SALUDO, sugerencias: [...new Set(lista)].slice(0, 3) };
}
