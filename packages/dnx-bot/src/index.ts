export * from "./types";
export * from "./limits";
export * from "./cost";
export * from "./schema";
export * from "./sse";
export * from "./signature";
export * from "./engine";
export * from "./history";
export * from "./telegram";
// Las apps usan el SDK a través de este paquete para no sumar la dependencia en cada una.
export { default as Anthropic } from "@anthropic-ai/sdk";
// La misma zod (v4) con la que el motor convierte los esquemas a JSON Schema: las apps que usan otra
// versión (FOTOFFICE tiene zod 3) arman los esquemas de sus herramientas con esta.
export { z } from "zod";
