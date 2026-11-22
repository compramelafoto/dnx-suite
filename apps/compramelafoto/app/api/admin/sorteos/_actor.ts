import { Role } from "@prisma/client";
import { requireAuth } from "@/lib/auth";

/** Sólo el admin de CLF maneja los sorteos. Devuelve quién actúa, para la historia. */
export async function requireRaffleAdmin(): Promise<
  { ok: true; actor: { userId: number; label: string } } | { ok: false }
> {
  const { error, user } = await requireAuth([Role.ADMIN]);
  if (error || !user) return { ok: false };
  return { ok: true, actor: { userId: user.id, label: user.name || user.email } };
}
