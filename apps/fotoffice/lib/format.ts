import type { Prisma } from "@repo/db";

export function decimalToString(d: Prisma.Decimal | null | undefined): string {
  if (d === null || d === undefined) return "";
  return d.toString();
}

export function formatMoney(amount: Prisma.Decimal | string | number, currency: string): string {
  let n: number;
  if (typeof amount === "number") n = amount;
  else if (typeof amount === "string") n = Number(amount.replace(",", "."));
  else n = amount.toNumber();
  if (!Number.isFinite(n)) return "—";
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: currency || "ARS",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(0)}`;
  }
}

export function toDatetimeLocalInput(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
