import { redirect } from "next/navigation";
import {
  CLICKATON_LOGIN_PATH,
  sanitizeClickatonReturnPath,
} from "@/lib/auth/return-path";
import { adminRoutes } from "@/config/admin/navigation";

type Props = {
  searchParams: Promise<{ next?: string; error?: string }>;
};

/**
 * Compat: `/admin/login` → login unificado `/login`.
 * Conserva `next` administrativo seguro y errores OAuth legados.
 */
export default async function AdminLoginRedirectPage({ searchParams }: Props) {
  const sp = await searchParams;
  const next = sanitizeClickatonReturnPath(sp.next, adminRoutes.dashboard);
  const safeNext = next.startsWith("/admin") ? next : adminRoutes.dashboard;

  const url = new URL(CLICKATON_LOGIN_PATH, "http://local.invalid");
  url.searchParams.set("next", safeNext);
  if (sp.error?.trim()) {
    url.searchParams.set("error", sp.error.trim().slice(0, 160));
  }

  redirect(`${CLICKATON_LOGIN_PATH}?${url.searchParams.toString()}`);
}
