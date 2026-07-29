/**
 * Catálogo interno (equivalente Storybook) — historias declarativas.
 * Consumir en una página de design-system o Storybook futuro.
 */

import type { DnxAuthBrandConfig } from "../types";
import { listAuthBrandConfigs } from "../brand";

export type AuthUiStoryId =
  | "login-standard"
  | "login-clickaton"
  | "login-fotorank"
  | "login-clf"
  | "login-infospot"
  | "login-fotoffice"
  | "register"
  | "forgot"
  | "reset"
  | "error"
  | "loading"
  | "google-only"
  | "invitation-only"
  | "mobile";

export type AuthUiStory = {
  id: AuthUiStoryId;
  title: string;
  brand: DnxAuthBrandConfig;
  panel: "login" | "register" | "forgot" | "reset";
  props?: Record<string, unknown>;
  notes?: string;
};

function brand(id: string): DnxAuthBrandConfig {
  const found = listAuthBrandConfigs().find((b) => b.applicationId === id);
  if (!found) throw new Error(`brand ${id}`);
  return found;
}

export function listAuthUiStories(): AuthUiStory[] {
  return [
    {
      id: "login-standard",
      title: "Login estándar",
      brand: brand("fotorank"),
      panel: "login",
    },
    {
      id: "login-clickaton",
      title: "Login Clickatón",
      brand: brand("clickaton"),
      panel: "login",
      props: { contextualNotice: "Estás iniciando sesión para participar en Clickatón." },
    },
    {
      id: "login-fotorank",
      title: "Login FotoRank",
      brand: brand("fotorank"),
      panel: "login",
    },
    {
      id: "login-clf",
      title: "Login ComprameLaFoto",
      brand: brand("compramelafoto"),
      panel: "login",
    },
    {
      id: "login-infospot",
      title: "Login InfoSpot (invitation-only)",
      brand: brand("infospot"),
      panel: "login",
      notes: "Sin enlace Crear cuenta; hint de invitación.",
    },
    {
      id: "login-fotoffice",
      title: "Login FotoOffice (Google emphasized)",
      brand: brand("fotoffice"),
      panel: "login",
      notes: "Google con énfasis visual; orden canónico intacto (después del CTA email).",
    },
    {
      id: "register",
      title: "Registro",
      brand: brand("clickaton"),
      panel: "register",
    },
    {
      id: "forgot",
      title: "Forgot",
      brand: brand("fotorank"),
      panel: "forgot",
    },
    {
      id: "reset",
      title: "Reset",
      brand: brand("fotorank"),
      panel: "reset",
      props: { token: "demo-token" },
    },
    {
      id: "error",
      title: "Error de credenciales",
      brand: brand("clickaton"),
      panel: "login",
      props: { error: "Email o contraseña incorrectos." },
    },
    {
      id: "loading",
      title: "Loading",
      brand: brand("compramelafoto"),
      panel: "login",
      props: { loading: "submitting" },
    },
    {
      id: "google-only",
      title: "Google-only hint",
      brand: brand("fotoffice"),
      panel: "forgot",
      props: {
        notice:
          "Si tu cuenta solo usa Google, vas a poder crear una contraseña desde el enlace del email.",
      },
    },
    {
      id: "invitation-only",
      title: "Invitation-only register blocked",
      brand: brand("infospot"),
      panel: "register",
    },
    {
      id: "mobile",
      title: "Mobile width",
      brand: brand("clickaton"),
      panel: "login",
      notes: "Probar max-width content + una columna.",
    },
  ];
}
