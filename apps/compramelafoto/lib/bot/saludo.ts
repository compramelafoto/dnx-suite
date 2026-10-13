/** Saludo según la hora argentina (UTC-3, sin horario de verano). */
export function saludoPorHora(now: Date): "Buen día" | "Buenas tardes" | "Buenas noches" {
  const h = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", hourCycle: "h23" }).format(now)
  );
  if (h >= 5 && h < 13) return "Buen día";
  if (h >= 13 && h < 20) return "Buenas tardes";
  return "Buenas noches";
}
