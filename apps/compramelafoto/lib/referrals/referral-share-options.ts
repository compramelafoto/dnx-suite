import { DNX_SUITE_PORTAL_URL, type ReferralSharePath } from "@/lib/referral-link";

export type ReferralShareOption = {
  label: string;
  path: ReferralSharePath;
  whatsappMessage: string;
};

export const REFERRAL_SHARE_OPTIONS: ReferralShareOption[] = [
  {
    label: "Página principal",
    path: "/",
    whatsappMessage:
      "Estoy usando ComprameLaFoto para vender mis fotos online. Mirá cómo funciona 👇",
  },
  {
    label: "DNX Suite (todas las herramientas)",
    path: "dnx-suite",
    whatsappMessage:
      "Te comparto DNX Suite: herramientas para fotógrafos para vender fotos, organizar el estudio, concursos y más. Mirá 👇",
  },
  {
    label: "Landing general",
    path: "/land",
    whatsappMessage:
      "Estoy usando ComprameLaFoto para vender mis fotos online. Mirá cómo funciona 👇",
  },
  {
    label: "Fotografía escolar (fotógrafos)",
    path: "/landescolar",
    whatsappMessage:
      "Estoy usando este sistema para organizar fotografía escolar. Es muy práctico 👇",
  },
  {
    label: "Recomendar a una escuela",
    path: "/Escuelas",
    whatsappMessage:
      "Te comparto ComprameLaFoto para que puedan gestionar fotos escolares, preventas y ventas online de forma simple. Podés completar la solicitud acá 👇",
  },
];

export function buildReferralUrlForPath(
  referralCodeUrl: string,
  referralCode: string,
  path: ReferralSharePath
): string {
  if (path === "dnx-suite") {
    const portal = new URL(DNX_SUITE_PORTAL_URL);
    portal.searchParams.set("ref", referralCode);
    return portal.toString();
  }
  try {
    const parsed = new URL(referralCodeUrl);
    parsed.pathname = path;
    parsed.search = "";
    parsed.searchParams.set("ref", referralCode);
    return parsed.toString();
  } catch {
    const normalizedPath = path === "/" ? "/" : path;
    return `${normalizedPath}?ref=${encodeURIComponent(referralCode)}`;
  }
}

export function referralShareHelperText(path: ReferralSharePath): string {
  if (path === "dnx-suite") {
    return "Lleva al portal de DNX Suite. Si la persona crea su cuenta en cualquier herramienta (ComprameLaFoto, FOTOFFICE, FotoRank, Muestras y las demás), queda registrado que la referiste vos.";
  }
  if (path === "/Escuelas") {
    return "Compartí este link para que la escuela complete su solicitud. Si avanza, quedará identificado que la recomendaste vos.";
  }
  return "Elegí la landing según a quién le compartís el link. Para fotógrafos escolares, la de fotografía escolar; para instituciones, «Recomendar a una escuela».";
}
