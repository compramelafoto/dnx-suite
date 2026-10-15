import { formatearEnAr } from "@/lib/fecha-ar";

export function formatBlogDate(value: Date | string | null | undefined): string {
  return formatearEnAr(value, { day: "2-digit", month: "long", year: "numeric" }, null, "");
}
