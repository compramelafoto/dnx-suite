"use client";

import { DnxBotBubble } from "@repo/dnx-bot/ui";

/**
 * La burbuja de DNX Bot en el panel de FOTOFFICE. Sólo la monta `AdminShell` cuando pasan todas las
 * puertas (`botEnPanel`); `rutas` son los prefijos que la persona puede abrir. Sin tickets: en
 * FOTOFFICE no hay «Hablar con una persona».
 */
export function BurbujaDnxBot({ rutas }: { rutas: string[] }) {
  return <DnxBotBubble basePath="/api/dnx-bot" mascotSrc="/dnx-bot/mascota.webp" rutasPermitidas={rutas} conTickets={false} />;
}
