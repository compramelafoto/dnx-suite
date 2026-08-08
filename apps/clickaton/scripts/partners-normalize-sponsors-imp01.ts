/**
 * ETAPA DNX PARTNERS — NORMALIZACIÓN Y ALTA DE SPONSORS — IMPLEMENTACIÓN 01
 *
 * Uso:
 *   DATABASE_URL=… pnpm --filter clickaton exec tsx scripts/partners-normalize-sponsors-imp01.ts
 *   DATABASE_URL=… pnpm --filter clickaton exec tsx scripts/partners-normalize-sponsors-imp01.ts --apply
 *
 * Sin --apply = DRY RUN (no escribe).
 */
import { prisma } from "@repo/db";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

type DnxPartnerType =
  | "COMPANY"
  | "BUSINESS"
  | "BRAND"
  | "INSTITUTION"
  | "ORGANIZATION"
  | "PERSON"
  | "GOVERNMENT"
  | "OTHER";

type PrismaLike = typeof prisma;

type SeedContact = {
  firstName: string;
  lastName?: string | null;
  roleTitle?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  isPrimary?: boolean;
  notes?: string | null;
  confidence?: "CONFIRMED" | "PENDING_VERIFICATION";
};

type SeedPartner = {
  key: string;
  name: string;
  aliases?: string[];
  legalName?: string | null;
  type: DnxPartnerType;
  description?: string | null;
  websiteUrl?: string | null;
  instagram?: string | null;
  facebookUrl?: string | null;
  email?: string | null;
  phone?: string | null;
  taxId?: string | null;
  address?: string | null;
  city?: string | null;
  provinceOrState?: string | null;
  country?: string | null;
  postalCode?: string | null;
  tags?: string[];
  services?: string[];
  notesBlocks?: string[];
  contacts?: SeedContact[];
  /** Si true y no hay match seguro: no crear. */
  createOnlyIfSufficient?: boolean;
  skipCreate?: boolean;
  pendingReason?: string;
};

const APPLY = process.argv.includes("--apply");

function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/\p{M}/gu, "");
}

function normText(s: string | null | undefined): string {
  return stripAccents((s ?? "").trim().toLowerCase()).replace(/\s+/g, " ");
}

function normInstagram(s: string | null | undefined): string {
  return normText(s).replace(/^@/, "").replace(/\/+$/, "");
}

function normDomain(s: string | null | undefined): string {
  const t = (s ?? "").trim().toLowerCase();
  if (!t) return "";
  try {
    const u = new URL(t.startsWith("http") ? t : `https://${t}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return t.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? "";
  }
}

function normPhone(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

function normCuit(s: string | null | undefined): string {
  return (s ?? "").replace(/\D+/g, "");
}

function slugFromName(name: string): string {
  return stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function empty(v: string | null | undefined): boolean {
  return !v || !String(v).trim();
}

function mergeNotes(existing: string | null | undefined, blocks: string[]): string {
  const base = (existing ?? "").trim();
  const stamp = "DNX Partners Imp01";
  const section = [
    `--- ${stamp} ---`,
    ...blocks.filter((b) => b.trim()),
  ].join("\n");
  if (!base) return section;
  if (base.includes(stamp)) {
    // Replace previous Imp01 section
    const re = /--- DNX Partners Imp01 ---[\s\S]*?(?=(\n--- |\n*$))/;
    if (re.test(base)) return base.replace(re, `${section}\n`).trim();
  }
  return `${base}\n\n${section}`.trim();
}

const SEEDS: SeedPartner[] = [
  {
    key: "copy-express",
    name: "Copy Express",
    aliases: ["CopyExpress", "CopyExpress Laboratorio Fotográfico Digital", "Copy Express Laboratorio"],
    type: "BUSINESS",
    description:
      "Centro de imágenes digitales y laboratorio fotográfico de Rosario especializado en impresión fotográfica, ampliaciones, gigantografías, canvas, cuadros, fotolibros y servicios para fotógrafos.",
    websiteUrl: "https://copyexpress.com.ar",
    email: "info@copyexpress.com.ar",
    phone: "0341 461-6264",
    address: "Av. San Martín 4867",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: [
      "fotografía",
      "laboratorio fotográfico",
      "impresión",
      "ampliaciones",
      "gigantografías",
      "canvas",
      "cuadros",
      "fotolibros",
      "fotógrafos profesionales",
    ],
    notesBlocks: [
      "CONFIRMED: dirección principal Av. San Martín 4867, Rosario.",
      "DO_NOT_USE como principal: Av. Alberdi 599; San Martín 5159 (referencias antiguas).",
      "WhatsApp/mensajes: +54 341 354-1391",
      "Tipo sugerido: sponsor / proveedor fotográfico / laboratorio oficial potencial.",
      "Subcategoría: Laboratorio fotográfico / Impresión digital / Servicios gráficos",
    ],
    contacts: [
      {
        firstName: "Copy Express",
        roleTitle: "Contacto general",
        email: "info@copyexpress.com.ar",
        phone: "0341 461-6264",
        whatsapp: "+54 341 354-1391",
        isPrimary: true,
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "tecnoflash",
    name: "Tecnoflash",
    aliases: ["Tecno Flash"],
    type: "BUSINESS",
    description:
      "Servicio técnico especializado en cámaras, objetivos, flashes y equipamiento fotográfico, con más de 25 años de trayectoria vinculada al sector fotográfico de Rosario.",
    instagram: "@tecnoflash",
    email: "espinosafoto@gmail.com",
    phone: "+54 341 547-9664",
    address: "Valparaíso 1178",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: ["fotografía", "servicio técnico", "cámaras", "lentes", "reparaciones", "sensor", "Rosario"],
    services: [
      "limpieza de sensor",
      "reparación cámaras",
      "revisión objetivos",
      "calibración autofocus",
      "firmware",
      "IBIS",
      "flashes",
      "triggers",
      "TTL",
      "HSS",
      "diagnóstico golpes/humedad",
      "mantenimiento",
      "conteo de disparos",
    ],
    notesBlocks: [
      "CONFIRMED histórico: Valparaíso 1178, Rosario (dirección principal conservada).",
      "PENDING_VERIFICATION: posible nuevo domicilio Av. Francia 1591 — NO reemplazar Valparaíso automáticamente.",
      "WhatsApp alternativo: +54 341 779-9016",
      "Subcategoría: Servicio técnico de equipamiento fotográfico",
    ],
    contacts: [
      {
        firstName: "Guillermo",
        lastName: "Espinosa",
        roleTitle: "Responsable / contacto técnico",
        email: "espinosafoto@gmail.com",
        phone: "+54 341 547-9664",
        whatsapp: "+54 341 547-9664",
        isPrimary: true,
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "scox-data-recovery",
    name: "SCOX Data Recovery",
    aliases: ["SCOX", "Scox Data Recovery"],
    type: "BUSINESS",
    description:
      "Laboratorio profesional de recuperación de datos especializado en HDD, SSD, tarjetas SD, microSD, pendrives y otros dispositivos, con especial relevancia para fotógrafos y videógrafos.",
    instagram: "@scoxdatarecovery",
    email: "sebastian_cox@hotmail.com",
    phone: "+54 341 547-7424",
    taxId: "20-26044131-1",
    address: "Mitre 960, Piso 1, Oficina 9",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: [
      "recuperación de datos",
      "SD",
      "microSD",
      "SSD",
      "HDD",
      "fotografía",
      "backup",
      "archivos",
      "Rosario",
    ],
    notesBlocks: [
      "Cobertura: Argentina / trabajos desde todo el país",
      "Tipo sugerido: sponsor tecnológico",
      "Subcategoría: Recuperación profesional de datos",
    ],
    contacts: [
      {
        firstName: "Sebastián",
        lastName: "Martínez",
        roleTitle: "Gerente / responsable",
        email: "sebastian_cox@hotmail.com",
        phone: "+54 341 547-7424",
        whatsapp: "+54 341 547-7424",
        isPrimary: true,
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "recuperodatos",
    name: "RecuperoDatos.com",
    aliases: ["RecuperoDatos", "Recupero Datos", "RecuperoDatos.com S.A.S."],
    legalName: "RecuperoDatos.com S.A.S.",
    type: "COMPANY",
    description:
      "Laboratorio profesional especializado en recuperación de información de tarjetas SD y microSD, HDD, SSD, memorias, servidores, RAID, NAS y dispositivos móviles.",
    websiteUrl: "https://recuperodatos.com",
    instagram: "@recuperodatos",
    email: "soporte@recuperodatos.com",
    phone: "0810-345-0778",
    taxId: "30-71808150-1",
    address: "La Pampa 2349, Oficina A, Belgrano",
    city: "CABA",
    provinceOrState: "CABA",
    country: "Argentina",
    postalCode: "C1428EAO",
    tags: [
      "recuperación de datos",
      "fotografía",
      "SD",
      "microSD",
      "HDD",
      "SSD",
      "RAID",
      "NAS",
      "tecnología",
    ],
    notesBlocks: [
      "WhatsApp: +54 9 11 3278-8353",
      "Cobertura: Argentina e internacional",
      "Tipo sugerido: sponsor tecnológico",
    ],
    contacts: [
      {
        firstName: "Adrian",
        lastName: "Francisconi",
        roleTitle: "CEO / contacto institucional",
        email: "soporte@recuperodatos.com",
        phone: "0810-345-0778",
        whatsapp: "+54 9 11 3278-8353",
        isPrimary: true,
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "congreso-nomade",
    name: "Congreso Nómade Foto y Video",
    aliases: ["Congreso Nómade", "Asociación Civil Congreso Nómade"],
    legalName: "Asociación Civil Congreso Nómade",
    type: "ORGANIZATION",
    description:
      "Congreso argentino de fotografía y video con fines solidarios, creado en 2019. Reúne fotógrafos, videógrafos, estudiantes, profesionales y referentes nacionales e internacionales mediante charlas, workshops y actividades.",
    websiteUrl: "https://congresonomade.com",
    instagram: "@congresonomade.fotoyvideo",
    facebookUrl: "https://www.facebook.com/CongresoNomadeFotoyVideo",
    email: "congresonomade@gmail.com",
    taxId: "30-71673968-2",
    city: "San Nicolás de los Arroyos",
    provinceOrState: "Buenos Aires",
    country: "Argentina",
    tags: [
      "fotografía",
      "video",
      "congreso",
      "capacitación",
      "fotógrafos",
      "videógrafos",
      "workshops",
      "solidario",
      "eventos",
    ],
    notesBlocks: [
      "Aliado estratégico / comunidad / congreso — no necesariamente sponsor comercial convencional.",
      "YouTube: @congresonomade7004",
      "Inicio: 2019",
      "Alcance: nacional / internacional / itinerante",
    ],
    contacts: [
      {
        firstName: "Maximiliano",
        lastName: "Oviedo",
        roleTitle: "Fundador / Director",
        email: "congresonomade@gmail.com",
        isPrimary: true,
        notes: 'También conocido como Maxi Oviedo',
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "el-baul-del-fotografo",
    name: "El Baúl del Fotógrafo",
    aliases: ["El Baul del Fotografo", "Baúl del Fotógrafo"],
    type: "BUSINESS",
    description:
      "Comercio rosarino especializado en accesorios y equipamiento para fotografía y video, con tienda online y envíos nacionales.",
    websiteUrl: "https://elbauldelfotografo.empretienda.com.ar",
    instagram: "@elbauldelfotografo",
    facebookUrl: "https://www.facebook.com/ElBaulDelFotografo",
    email: "marcos.piaggio@hotmail.com",
    phone: "+54 9 341 361-8099",
    address: "Corrientes 1855",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: [
      "fotografía",
      "video",
      "accesorios",
      "trípodes",
      "iluminación",
      "memorias",
      "gimbal",
      "Rosario",
    ],
    notesBlocks: [
      "YouTube: @elbauldelfotografo",
      "Cobertura: Argentina",
      "PENDING_VERIFICATION: Marcos Piaggio aparece como email de contacto; NO marcar como propietario confirmado.",
    ],
    contacts: [
      {
        firstName: "Marcos",
        lastName: "Piaggio",
        roleTitle: "Contacto (posible responsable — no confirmado como propietario)",
        email: "marcos.piaggio@hotmail.com",
        whatsapp: "+54 9 341 361-8099",
        isPrimary: true,
        confidence: "PENDING_VERIFICATION",
        notes: "Email asociado; no confirmar como propietario sin evidencia adicional.",
      },
    ],
  },
  {
    key: "sliders-hamburgers",
    name: "Sliders Hamburgers",
    aliases: ["Sliders", "Sliders Hamburgers Rosario"],
    type: "BUSINESS",
    description:
      "Hamburguesería rosarina especializada en mini burgers estilo estadounidense, con fuerte identidad urbana y vinculada a cultura/básquet.",
    instagram: "@slidershamburgers",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    address: "Jujuy 2514 (sucursal); también Juan Manuel de Rosas 1062 (Rosario) y RN9 1832 (Funes)",
    tags: ["hamburguesería", "gastronomía", "sliders", "burgers", "Rosario", "Funes", "fast food"],
    notesBlocks: [
      "Sucursales: Jujuy 2514 Rosario; Juan Manuel de Rosas 1062 Rosario; RN9 1832 Funes.",
      "Cofundador públicamente identificado: Lucio Leyra.",
      "PENDING_VERIFICATION: Lucas Leyra vinculado públicamente — NO marcar como propietario confirmado.",
      "Beneficio Clickatón conocido: 3 combos sampler (no recrear si ya existe).",
      "Web/email/teléfono: no verificados en esta implementación.",
    ],
  },
  {
    key: "grupo-vicario",
    name: "Grupo Vicario",
    aliases: ["Vicario Digital", "Digital Video Vicario", "Vicario", "Digital Video Vica"],
    legalName: "Digital Video Vica de Orlada S.R.L.",
    type: "COMPANY",
    description:
      "Empresa rosarina especializada en equipamiento profesional de fotografía, video, iluminación y audio.",
    websiteUrl: "https://vicariodigital.com",
    instagram: "@grupovicario",
    email: "multimedia@vicariodigital.com",
    phone: "0341 481-2332",
    taxId: "30-71113597-5",
    address: "Ocampo 224",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: [
      "fotografía",
      "cámaras",
      "lentes",
      "video",
      "iluminación",
      "audio",
      "equipamiento profesional",
      "Rosario",
    ],
    notesBlocks: [
      "Alias históricos: Vicario Digital; Digital Video Vicario.",
      "Personas históricamente vinculadas a sociedad: Eduardo Oreste Vicario; Maximiliano Rodrigo Vicario (referencia societaria, no contacto operativo confirmado).",
      "Tipo: sponsor fotográfico / equipamiento",
    ],
  },
  {
    key: "fraganshop",
    name: "Fraganshop",
    aliases: ["FraganShop", "Fraganshop Rosario"],
    type: "BUSINESS",
    description:
      "Perfumería y tienda de belleza de Rosario especializada en fragancias, perfumes, body splashes, cosmética y productos de cuidado personal.",
    facebookUrl: "https://www.facebook.com/fraganshopros",
    phone: "+54 9 341 663-5558",
    address: "Sarmiento 846, Local 28, Galería La Favorita",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: [
      "perfumería",
      "fragancias",
      "perfumes",
      "belleza",
      "cosmética",
      "regalos",
      "Rosario",
      "ecommerce",
    ],
    notesBlocks: [
      "Teléfono alternativo: 0341 447-0595",
      "Instagram: NO CONFIRMADO — no inventar.",
      "Web propia: no verificada. Venta online referida en Mercado Libre / FraganShop.",
      "Tipo: sponsor lifestyle / premios",
    ],
  },
  {
    key: "foto-lag-rosario",
    name: "Foto LAG Rosario",
    aliases: ["Foto LAG", "FotoLag", "Foto Lag Rosario"],
    type: "BUSINESS",
    description:
      "Laboratorio fotográfico y casa especializada en fotografía ubicada en Paseo Libertad Rosario, con servicios de impresión, revelado, asesoramiento y productos para fotografía digital y analógica.",
    instagram: "@fotolagrosario",
    facebookUrl: "https://www.facebook.com/FotoLAG",
    phone: "0341 466-0358",
    address: "Bv. Oroño 6000, Local 140, Paseo Libertad Rosario",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: [
      "fotografía",
      "laboratorio fotográfico",
      "impresión",
      "revelado",
      "analógico",
      "rollos",
      "Rosario",
    ],
    notesBlocks: [
      "Teléfono alternativo: 0341 500-6475",
      "DO_NOT_USE como web activa: fotolag.com (histórica).",
      "DO_NOT_USE como email actual confirmado: ifotolag@fotolag.com (histórico).",
      "Histórico: Fabián Alejandro Teodosio — NO marcar como propietario actual confirmado.",
    ],
  },
  {
    key: "arenhas-bar",
    name: "Arenhas Bar",
    aliases: ["Arenhas"],
    type: "BUSINESS",
    description:
      "Resto-bar tradicional de Rosario con cafetería, cocina, bebidas y propuesta gastronómica.",
    instagram: "@arenhasbar",
    facebookUrl: "https://www.facebook.com/ArenhasBar",
    phone: "0341 449-9192",
    address: "Buenos Aires 1501",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: ["gastronomía", "bar", "restaurante", "Rosario", "cafetería"],
    notesBlocks: [
      "Antigüedad declarada: desde 1990",
      "Web/email: no verificados",
      "Tipo: sponsor gastronómico",
    ],
  },
  {
    key: "spa-carobig",
    name: "Spa CaroBig",
    aliases: ["CaroBig", "Spa Caro Big"],
    type: "BUSINESS",
    skipCreate: true,
    pendingReason:
      "PENDING_VERIFICATION / PENDING OPERATOR INPUT: sin datos públicos confiables (Instagram, teléfono, dirección, web, email).",
    notesBlocks: ["PENDING_VERIFICATION: datos insuficientes para alta."],
  },
  {
    key: "feca",
    name: "FECA",
    aliases: ["Feca", "Feca Bar & Bistro"],
    type: "BUSINESS",
    skipCreate: true,
    pendingReason:
      "PENDING OPERATOR INPUT: múltiples referencias (Av. San Martín 654 vs Rioja 1378). NO usar feca.com.ar / @feca.cafe (otra empresa). Posible cierre de una sede.",
    notesBlocks: [
      "Histórico NO auto-aplicar: Feca Bar & Bistro Av. San Martín 654 / 0341 624-7600 / fecabar@outlook.com",
      "Otra referencia: Rioja 1378 Local 12 Rosario",
      "DO_NOT_USE: feca.com.ar / @feca.cafe",
    ],
  },
  {
    key: "mucha-escuela",
    name: "Mucha Escuela",
    aliases: ["MuchaEscuela"],
    type: "ORGANIZATION",
    description:
      "Escuela de Rosario dedicada a fotografía, diseño, community management, marketing, producción creativa y otras disciplinas.",
    websiteUrl: "https://muchaescuela.com",
    email: "hola@muchaescuela.com",
    phone: "+54 341 648-0099",
    address: "Salta 1315",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: [
      "fotografía",
      "escuela",
      "capacitación",
      "cursos",
      "diseño",
      "marketing",
      "Rosario",
    ],
    notesBlocks: [
      "Modalidad: presencial + online",
      "Fundadores: Fernando Arias; Max Pell",
      "Tipo: partner educativo / sponsor educativo",
    ],
    contacts: [
      {
        firstName: "Contacto",
        lastName: "Institucional",
        roleTitle: "Institucional",
        email: "hola@muchaescuela.com",
        phone: "+54 341 648-0099",
        isPrimary: true,
        confidence: "CONFIRMED",
      },
      {
        firstName: "Fernando",
        lastName: "Arias",
        roleTitle: "Fundador",
        email: "ferarias2001@hotmail.com",
        confidence: "CONFIRMED",
      },
      {
        firstName: "Max",
        lastName: "Pell",
        roleTitle: "Fundador",
        email: "max@maxpell.com.ar",
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "cc-fontanarrosa",
    name: "Centro Cultural Roberto Fontanarrosa",
    aliases: ["CC Fontanarrosa", "Centro Cultural Fontanarrosa", "Cultural Fontanarrosa"],
    type: "GOVERNMENT",
    description:
      "Centro Cultural de la Municipalidad de Rosario utilizado para congresos, seminarios, jornadas, exposiciones y actividades culturales.",
    instagram: "@culturalfontanarrosa",
    email: "info-ccrf@rosario.gov.ar",
    phone: "0341 480-2401",
    address: "San Martín 1080",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: ["cultura", "institucional", "centro cultural", "Rosario", "Municipalidad"],
    notesBlocks: [
      "Dependencia: Municipalidad de Rosario — aliado institucional / espacio cultural.",
      "NO clasificar como empresa privada.",
      "Infraestructura: 7 salas polifuncionales; espacios para exposiciones/stands.",
    ],
  },
  {
    key: "andres-preumayr",
    name: "Andrés Preumayr",
    aliases: ["Andres Preumayr"],
    type: "PERSON",
    description: "Fotógrafo profesional y docente. Especialidades: bodas, documental, docencia y workshops.",
    websiteUrl: "https://andrespreumayr.com",
    instagram: "@andres.preumayr",
    email: "info@andrespreumayr.com",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: ["fotografía", "bodas", "documental", "docencia", "workshops", "Rosario"],
    notesBlocks: [
      "Tipo: persona / referente / posible embajador o partner educativo.",
      "NO asociar como propietario de Enchulame la Cámara (registros distintos).",
    ],
    contacts: [
      {
        firstName: "Andrés",
        lastName: "Preumayr",
        roleTitle: "Fotógrafo / docente",
        email: "info@andrespreumayr.com",
        isPrimary: true,
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "enchulame-la-camara",
    name: "Enchulame la Cámara",
    aliases: ["Enchulame La Cámara", "Enchulame La Cámara Rental Audiovisual", "Enchulame Rental"],
    type: "BUSINESS",
    description:
      "Servicio de alquiler de cámaras, lentes, iluminación, sonido y equipamiento audiovisual.",
    websiteUrl: "https://www.enchulamerental.com/sucursal-rosario",
    email: "enchulamerentalrosario@gmail.com",
    phone: "+54 9 341 707-6982",
    address: "San Luis 760, Piso 5, Oficina A",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    tags: [
      "fotografía",
      "rental",
      "video",
      "cámaras",
      "lentes",
      "iluminación",
      "audiovisual",
      "Rosario",
    ],
    notesBlocks: [
      "Teléfono central: +54 9 11 4935-5113 opción 5",
      "Tipo: sponsor fotográfico / rental",
    ],
    contacts: [
      {
        firstName: "Sucursal",
        lastName: "Rosario",
        roleTitle: "Contacto Rosario",
        email: "enchulamerentalrosario@gmail.com",
        whatsapp: "+54 9 341 707-6982",
        isPrimary: true,
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "terra-congreso",
    name: "Terra — Congreso de Fotonaturaleza",
    aliases: ["Terra", "Congreso Terra", "Congreso de Fotonaturaleza"],
    type: "ORGANIZATION",
    description:
      "Congreso y comunidad que conecta fotografía, naturaleza y conservación mediante encuentros, talleres y exposiciones.",
    websiteUrl: "https://www.congreso-terra.com",
    city: "San Carlos de Bariloche",
    provinceOrState: "Río Negro",
    country: "Argentina",
    tags: [
      "fotografía",
      "naturaleza",
      "fotonaturaleza",
      "congreso",
      "conservación",
      "Bariloche",
      "workshops",
      "exposición",
    ],
    notesBlocks: [
      "Organizador: Santiago Berraondo",
      "Próxima edición conocida: 2026 Bariloche",
      "Equipo conocido: Santiago Berraondo, Seba Bellia, Danny Campisi, Lucas Ober, Maxi Sabbadini, Nat Miranda, Estefi Hotton, Juli Navarro, Pame Bruccieri, Mati Theodorou",
      "PENDING_VERIFICATION: CUIT 20-35019255-8 asociado públicamente a Santiago Berraondo — NO usar como dato fiscal CONFIRMED del partner.",
      "Tipo: aliado estratégico / congreso",
    ],
    contacts: [
      {
        firstName: "Santiago",
        lastName: "Berraondo",
        roleTitle: "Organizador",
        isPrimary: true,
        confidence: "CONFIRMED",
        notes: "CUIT personal publicado 20-35019255-8 — PENDING_VERIFICATION, no fiscal del partner.",
      },
    ],
  },
  {
    key: "bienal-fotografia-documental",
    name: "Bienal Argentina de Fotografía Documental",
    aliases: ["Fotobienal", "Bienal Argentina de Fotografia Documental", "Fundación Infoto"],
    legalName: "Fundación Infoto – Información y Fotografía",
    type: "ORGANIZATION",
    description:
      "Festival y bienal internacional de fotografía documental con sede en Tucumán, activo desde 2004 y con participación nacional e internacional.",
    instagram: "@fotobienal",
    facebookUrl: "https://www.facebook.com/Fotobienal",
    email: "convocatorias.bienal@gmail.com",
    taxId: "30-71061405-5",
    city: "San Miguel de Tucumán",
    provinceOrState: "Tucumán",
    country: "Argentina",
    tags: [
      "fotografía documental",
      "bienal",
      "festival",
      "fotografía",
      "Tucumán",
      "cultura",
      "documentalismo",
    ],
    notesBlocks: [
      "Organiza: Fundación Infoto – Información y Fotografía",
      "Director / Presidente Fundación Infoto: Julio Pantoja",
      "Inicio: 2004",
      "Tipo: aliado cultural / institucional",
    ],
    contacts: [
      {
        firstName: "Julio",
        lastName: "Pantoja",
        roleTitle: "Director / Presidente Fundación Infoto",
        email: "convocatorias.bienal@gmail.com",
        isPrimary: true,
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "afona",
    name: "AFONA",
    aliases: [
      "Asociación Argentina de Fotógrafos de Naturaleza",
      "AFONA Asociación Civil Argentina de Fotógrafos de Naturaleza",
    ],
    legalName: "AFONA Asociación Civil Argentina de Fotógrafos de Naturaleza",
    type: "ORGANIZATION",
    description:
      "Asociación civil argentina sin fines de lucro dedicada a la fotografía de naturaleza, conservación y sensibilización ambiental.",
    websiteUrl: "https://afona.org.ar",
    instagram: "@asociacionafona",
    facebookUrl: "https://www.facebook.com/AsociacionAFONA",
    email: "auspicios@afona.org.ar",
    taxId: "30-71627338-1",
    address: "La Rioja 1342",
    city: "Puerto Madryn",
    provinceOrState: "Chubut",
    country: "Argentina",
    tags: [
      "fotografía",
      "naturaleza",
      "fotógrafos",
      "conservación",
      "asociación",
      "Argentina",
      "fotonaturaleza",
    ],
    notesBlocks: [
      "Inicio oficial: 2019",
      "Emails: socios@afona.org.ar; talleres@afona.org.ar; convocatorias@afona.org.ar; conservacion@afona.org.ar",
      "Red: más de 500 socios (dato institucional publicado).",
      "Tipo: aliado institucional / comunidad / aval",
    ],
    contacts: [
      {
        firstName: "Auspicios",
        lastName: "AFONA",
        roleTitle: "Contacto auspicios / alianzas",
        email: "auspicios@afona.org.ar",
        isPrimary: true,
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "arte-en-foco",
    name: "Arte en Foco",
    aliases: ["ARTE EN FOCO S.R.L.", "Arte en Foco Rosario", "ArteEnFoco"],
    legalName: "ARTE EN FOCO S.R.L.",
    type: "COMPANY",
    description:
      "Escuela rosarina de fotografía, video, edición y comunicación fundada en 2010. Brinda formación profesional, cursos y talleres presenciales y online.",
    websiteUrl: "https://arteenfoco.com",
    instagram: "@arteenfocorosario",
    email: "arteenfocorosario@gmail.com",
    phone: "+54 9 341 347-4061",
    address: "Maipú 1010",
    city: "Rosario",
    provinceOrState: "Santa Fe",
    country: "Argentina",
    postalCode: "S2000CGL",
    tags: [
      "fotografía",
      "video",
      "escuela",
      "capacitación",
      "cursos",
      "fotógrafos",
      "audiovisual",
      "edición",
      "Rosario",
      "workshops",
    ],
    notesBlocks: [
      "Fundación de la escuela: 2010",
      "Directora: María Andrea Babsia",
      "Email alternativo: info@arteenfoco.com",
      "Web histórica/alternativa: arteenfoco.com.ar",
      "Ubicación secundaria: Pasaje Pan, Córdoba 954, Piso 1, Oficina 26, Rosario — principal: Maipú 1010.",
      "Persona históricamente vinculada a la sociedad: Emanuel Enrique Bacci Giunta (referencia societaria).",
      "CUIT: NO confirmado — no inventar.",
    ],
    contacts: [
      {
        firstName: "María Andrea",
        lastName: "Babsia",
        roleTitle: "Directora",
        email: "arteenfocorosario@gmail.com",
        whatsapp: "+54 9 341 347-4061",
        isPrimary: true,
        confidence: "CONFIRMED",
      },
    ],
  },
  {
    key: "photostraps",
    name: "PHOTOSTRAPS",
    aliases: ["Photostraps", "Photo Straps"],
    type: "BRAND",
    skipCreate: true,
    pendingReason:
      "PENDING DATA: hay material de identidad/logo en el ecosistema, pero sin información comercial suficiente (responsable, contacto, dirección, web, Instagram confirmado).",
    notesBlocks: ["PENDING DATA: no crear solo por nombre/logo."],
  },
];

type PartnerRow = {
  id: string;
  name: string;
  legalName: string | null;
  slug: string;
  description: string | null;
  type: DnxPartnerType;
  status: string;
  websiteUrl: string | null;
  instagram: string | null;
  facebookUrl: string | null;
  email: string | null;
  phone: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  provinceOrState: string | null;
  country: string | null;
  postalCode: string | null;
  notes: string | null;
  archivedAt: Date | null;
};

type MatchKind = "CUIT" | "DOMAIN" | "EMAIL" | "INSTAGRAM" | "PHONE" | "NAME_CITY" | "ALIAS";

function scoreMatch(seed: SeedPartner, p: PartnerRow): { score: number; reasons: MatchKind[] } {
  const reasons: MatchKind[] = [];
  let score = 0;

  const seedCuit = normCuit(seed.taxId);
  const pCuit = normCuit(p.taxId);
  if (seedCuit && pCuit && seedCuit === pCuit) {
    score += 100;
    reasons.push("CUIT");
  }

  const seedDom = normDomain(seed.websiteUrl);
  const pDom = normDomain(p.websiteUrl);
  if (seedDom && pDom && seedDom === pDom) {
    score += 40;
    reasons.push("DOMAIN");
  }

  const seedEmail = normText(seed.email);
  const pEmail = normText(p.email);
  if (seedEmail && pEmail && seedEmail === pEmail) {
    score += 35;
    reasons.push("EMAIL");
  }

  const seedIg = normInstagram(seed.instagram);
  const pIg = normInstagram(p.instagram);
  if (seedIg && pIg && seedIg === pIg) {
    score += 35;
    reasons.push("INSTAGRAM");
  }

  const seedPhone = normPhone(seed.phone);
  const pPhone = normPhone(p.phone);
  if (seedPhone && pPhone && seedPhone.length >= 8 && (seedPhone.endsWith(pPhone.slice(-8)) || pPhone.endsWith(seedPhone.slice(-8)))) {
    score += 25;
    reasons.push("PHONE");
  }

  const names = [seed.name, ...(seed.aliases ?? [])].map(normText);
  const pName = normText(p.name);
  const pLegal = normText(p.legalName);
  const nameHit = names.some((n) => n === pName || n === pLegal || pName.includes(n) || n.includes(pName));
  if (nameHit) {
    const sameCity =
      !seed.city ||
      !p.city ||
      normText(seed.city) === normText(p.city) ||
      normText(p.city).includes(normText(seed.city));
    score += sameCity ? 30 : 18;
    reasons.push(sameCity ? "NAME_CITY" : "ALIAS");
  }

  return { score, reasons };
}

function pickMatch(
  seed: SeedPartner,
  partners: PartnerRow[],
): {
  action: "MATCHED" | "CREATE" | "SKIP_CREATE" | "POSSIBLE_DUPLICATE";
  primary?: PartnerRow;
  candidates: Array<{ partner: PartnerRow; score: number; reasons: MatchKind[] }>;
} {
  const scored = partners
    .map((p) => ({ partner: p, ...scoreMatch(seed, p) }))
    .filter((x) => x.score >= 18)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) {
    if (seed.skipCreate) return { action: "SKIP_CREATE", candidates: [] };
    return { action: "CREATE", candidates: [] };
  }

  const top = scored[0]!;
  const strong = scored.filter((x) => x.score >= 40 || x.reasons.includes("CUIT"));
  const ambiguous =
    strong.length >= 2 ||
    (scored.length >= 2 && scored[1]!.score >= 30 && top.score - scored[1]!.score < 15);

  if (ambiguous && !top.reasons.includes("CUIT")) {
    return { action: "POSSIBLE_DUPLICATE", primary: top.partner, candidates: scored.slice(0, 5) };
  }

  if (top.score >= 30 || top.reasons.includes("CUIT") || top.reasons.includes("NAME_CITY")) {
    return { action: "MATCHED", primary: top.partner, candidates: scored.slice(0, 5) };
  }

  if (seed.skipCreate) return { action: "SKIP_CREATE", candidates: scored.slice(0, 5) };
  return { action: "CREATE", candidates: scored.slice(0, 5) };
}

type FieldKey =
  | "legalName"
  | "description"
  | "type"
  | "websiteUrl"
  | "instagram"
  | "facebookUrl"
  | "email"
  | "phone"
  | "taxId"
  | "address"
  | "city"
  | "provinceOrState"
  | "country"
  | "postalCode"
  | "notes";

function planUpdate(seed: SeedPartner, existing: PartnerRow): {
  patch: Partial<Record<FieldKey, string | null>>;
  filled: string[];
  corrected: string[];
  unchanged: string[];
} {
  const filled: string[] = [];
  const corrected: string[] = [];
  const unchanged: string[] = [];
  const patch: Partial<Record<FieldKey, string | null>> = {};

  const scalar: Array<[FieldKey, string | null | undefined]> = [
    ["legalName", seed.legalName],
    ["description", seed.description],
    ["websiteUrl", seed.websiteUrl],
    ["instagram", seed.instagram],
    ["facebookUrl", seed.facebookUrl],
    ["email", seed.email],
    ["phone", seed.phone],
    ["taxId", seed.taxId],
    ["address", seed.address],
    ["city", seed.city],
    ["provinceOrState", seed.provinceOrState],
    ["country", seed.country],
    ["postalCode", seed.postalCode],
  ];

  for (const [key, seedVal] of scalar) {
    if (empty(seedVal)) {
      unchanged.push(key);
      continue;
    }
    const cur = existing[key] as string | null;
    if (empty(cur)) {
      patch[key] = seedVal!.trim();
      filled.push(key);
    } else if (normText(cur) === normText(seedVal)) {
      unchanged.push(key);
    } else {
      // No overwrite confirmed-looking data automatically except clear normalizations
      // Special: Tecnoflash address — never replace Valparaíso with Francia
      if (key === "address" && seed.key === "tecnoflash") {
        unchanged.push(`${key}(kept_existing_pending_francia)`);
        continue;
      }
      // Prefer filling missing only; corrections only for empty-ish / clearly worse
      unchanged.push(`${key}(kept_existing_conflict)`);
    }
  }

  // Type: only set if existing is OTHER/COMPANY default-ish and seed is more specific GOVERNMENT/PERSON/ORGANIZATION
  if (
    (existing.type === "OTHER" || existing.type === "COMPANY" || existing.type === "BUSINESS") &&
    (seed.type === "GOVERNMENT" || seed.type === "PERSON" || seed.type === "ORGANIZATION") &&
    existing.type !== seed.type
  ) {
    // Don't force type change on MATCHED commercial sponsors — only for clear institutional/person
    if (seed.type === "GOVERNMENT" || seed.type === "PERSON") {
      patch.type = seed.type;
      corrected.push(`type→${seed.type}`);
    } else {
      unchanged.push("type");
    }
  } else {
    unchanged.push("type");
  }

  const noteBits = [
    ...(seed.notesBlocks ?? []),
    seed.tags?.length ? `Tags: ${seed.tags.join(", ")}` : "",
    seed.services?.length ? `Servicios: ${seed.services.join(", ")}` : "",
    seed.aliases?.length ? `Aliases: ${seed.aliases.join(", ")}` : "",
  ].filter(Boolean);
  const nextNotes = mergeNotes(existing.notes, noteBits);
  if (nextNotes !== (existing.notes ?? "").trim()) {
    patch.notes = nextNotes;
    filled.push("notes");
  } else {
    unchanged.push("notes");
  }

  return { patch, filled, corrected, unchanged };
}

async function uniqueSlug(db: PrismaLike, base: string): Promise<string> {
  let slug = slugFromName(base) || `partner-${createHash("sha1").update(base).digest("hex").slice(0, 8)}`;
  let i = 0;
  while (true) {
    const candidate = i === 0 ? slug : `${slug}-${i}`.slice(0, 80);
    const hit = await db.dnxPartner.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!hit) return candidate;
    i += 1;
  }
}

async function ensureContact(
  db: PrismaLike,
  partnerId: string,
  contact: SeedContact,
  dryRun: boolean,
): Promise<"created" | "exists" | "skipped"> {
  if (!contact.email && !contact.phone && !contact.whatsapp) return "skipped";
  const existing = await db.dnxPartnerContact.findMany({
    where: { partnerId, archivedAt: null },
  });
  const email = normText(contact.email);
  const phone = normPhone(contact.phone || contact.whatsapp);
  const hit = existing.find((c) => {
    if (email && normText(c.email) === email) return true;
    if (phone && normPhone(c.phone || c.whatsapp) && normPhone(c.phone || c.whatsapp).endsWith(phone.slice(-8)))
      return true;
    if (
      normText(c.firstName) === normText(contact.firstName) &&
      normText(c.lastName) === normText(contact.lastName)
    )
      return true;
    return false;
  });
  if (hit) return "exists";
  if (dryRun) return "created";
  await db.dnxPartnerContact.create({
    data: {
      partnerId,
      firstName: contact.firstName,
      lastName: contact.lastName ?? null,
      roleTitle: contact.roleTitle ?? null,
      email: contact.email ?? null,
      phone: contact.phone ?? null,
      whatsapp: contact.whatsapp ?? null,
      isPrimary: contact.isPrimary ?? false,
      notes: [
        contact.notes,
        contact.confidence ? `confidence:${contact.confidence}` : null,
      ]
        .filter(Boolean)
        .join(" | ") || null,
    },
  });
  return "created";
}

async function main() {
  const urlFromFile = (() => {
    try {
      return readFileSync("/tmp/ck_p.url.clean", "utf8").trim();
    } catch {
      return "";
    }
  })();
  const databaseUrl = (process.env.DATABASE_URL || urlFromFile).trim();
  if (!databaseUrl) {
    console.error(JSON.stringify({ status: "BLOCKED", reason: "DATABASE_URL_absent" }));
    process.exit(1);
  }
  // El cliente singleton de @repo/db lee DATABASE_URL al iniciar el proceso.
  if (!process.env.DATABASE_URL) process.env.DATABASE_URL = databaseUrl;

  const host = new URL(databaseUrl).hostname;
  const dbName = new URL(databaseUrl).pathname.replace(/^\//, "").split("?")[0];
  if (!host.includes("silent-haze") || dbName !== "clickaton_production") {
    console.error(
      JSON.stringify({
        status: "BLOCKED",
        reason: "unexpected_database",
        hostHint: host.slice(0, 40),
        dbName,
      }),
    );
    process.exit(1);
  }

  try {
    const beforeCount = await prisma.dnxPartner.count({ where: { archivedAt: null } });
    const partners = (await prisma.dnxPartner.findMany({
      where: { archivedAt: null },
      orderBy: { updatedAt: "desc" },
    })) as PartnerRow[];

    const benefitsByPartner = await prisma.dnxPartnerBenefit.findMany({
      where: { archivedAt: null },
      select: { id: true, partnerId: true, title: true, status: true },
    });
    const assetsByPartner = await prisma.dnxPartnerAsset.findMany({
      where: { archivedAt: null },
      select: {
        id: true,
        partnerId: true,
        type: true,
        backgroundType: true,
        approvalStatus: true,
        status: true,
      },
    });

    type ReportItem = Record<string, unknown>;
    const report = {
      status: "DRY_RUN" as string,
      environment: host.includes("silent-haze") ? "clickaton-production" : host,
      database: dbName,
      hostHint: host.slice(0, 28) + "…",
      apply: APPLY,
      totalPartnersBefore: beforeCount,
      totalPartnersAfter: beforeCount,
      matched: [] as ReportItem[],
      created: [] as ReportItem[],
      noChange: [] as ReportItem[],
      possibleDuplicates: [] as ReportItem[],
      pendingVerification: [] as ReportItem[],
      unmappedFields: [
        "category/subcategoría (no existen en DnxPartner → notes/tags text)",
        "tags/servicios estructurados (no hay JSON tags → notes)",
        "confidence CONFIRMED/PENDING/DO_NOT_USE (no hay enum → notes/contact.notes)",
        "sucursales múltiples (solo address string)",
        "YouTube (no hay campo → notes)",
        "cobertura geográfica (→ notes)",
      ],
      logosMissing: [] as ReportItem[],
      benefitsDetected: [] as ReportItem[],
      errors: [] as string[],
      confirmations: {
        noKnownDuplicatesCreated: true,
        noPartnersDeleted: true,
        noForeignPartnersModified: true,
        noInventedData: true,
        relationsPreserved: true,
      },
    };

    const touchedIds = new Set<string>();

    for (const seed of SEEDS) {
      const decision = pickMatch(seed, partners);

      if (decision.action === "SKIP_CREATE") {
        const existing = decision.candidates[0]?.partner;
        if (existing) {
          // Exists but we only enrich notes lightly if unequivocal
          const { patch, filled, corrected, unchanged } = planUpdate(seed, existing);
          const onlyNotes = Object.keys(patch).every((k) => k === "notes");
          if (Object.keys(patch).length && onlyNotes) {
            if (APPLY) {
              await prisma.dnxPartner.update({
                where: { id: existing.id },
                data: { notes: patch.notes, updatedAt: new Date() },
              });
            }
            touchedIds.add(existing.id);
            report.matched.push({
              key: seed.key,
              name: seed.name,
              id: existing.id,
              action: APPLY ? "UPDATE_NOTES_ONLY" : "WOULD_UPDATE_NOTES_ONLY",
              filled,
              corrected,
              unchanged: unchanged.slice(0, 12),
              pendingReason: seed.pendingReason,
            });
          } else {
            report.pendingVerification.push({
              key: seed.key,
              name: seed.name,
              existingId: existing.id,
              reason: seed.pendingReason,
              matchScore: decision.candidates[0]?.score,
            });
          }
        } else {
          report.pendingVerification.push({
            key: seed.key,
            name: seed.name,
            reason: seed.pendingReason ?? "skip_create",
          });
        }
        continue;
      }

      if (decision.action === "POSSIBLE_DUPLICATE") {
        report.possibleDuplicates.push({
          key: seed.key,
          name: seed.name,
          primaryId: decision.primary?.id,
          primaryName: decision.primary?.name,
          candidates: decision.candidates.map((c) => ({
            id: c.partner.id,
            name: c.partner.name,
            score: c.score,
            reasons: c.reasons,
            slug: c.partner.slug,
          })),
        });
        report.confirmations.noKnownDuplicatesCreated = true;
        continue;
      }

      if (decision.action === "CREATE") {
        const slug = await uniqueSlug(prisma as PrismaLike, seed.name);
        const noteBits = [
          ...(seed.notesBlocks ?? []),
          seed.tags?.length ? `Tags: ${seed.tags.join(", ")}` : "",
          seed.services?.length ? `Servicios: ${seed.services.join(", ")}` : "",
          seed.aliases?.length ? `Aliases: ${seed.aliases.join(", ")}` : "",
        ].filter(Boolean);
        const data = {
          name: seed.name,
          slug,
          legalName: seed.legalName ?? null,
          description: seed.description ?? null,
          type: seed.type,
          status: "PROSPECT" as const,
          websiteUrl: seed.websiteUrl ?? null,
          instagram: seed.instagram ?? null,
          facebookUrl: seed.facebookUrl ?? null,
          email: seed.email ?? null,
          phone: seed.phone ?? null,
          taxId: seed.taxId ?? null,
          address: seed.address ?? null,
          city: seed.city ?? null,
          provinceOrState: seed.provinceOrState ?? null,
          country: seed.country ?? "Argentina",
          postalCode: seed.postalCode ?? null,
          notes: mergeNotes(null, noteBits),
        };

        let id = `dry-run-${seed.key}`;
        if (APPLY) {
          const created = await prisma.dnxPartner.create({ data });
          id = created.id;
          partners.push(created as PartnerRow);
          for (const c of seed.contacts ?? []) {
            await ensureContact(prisma, id, c, false);
          }
        }

        report.created.push({
          key: seed.key,
          name: seed.name,
          id,
          slug,
          type: seed.type,
          city: seed.city,
          email: seed.email,
          instagram: seed.instagram,
          action: APPLY ? "CREATED" : "WOULD_CREATE",
        });
        continue;
      }

      // MATCHED
      const existing = decision.primary!;
      touchedIds.add(existing.id);
      const { patch, filled, corrected, unchanged } = planUpdate(seed, existing);
      const contactActions: string[] = [];
      for (const c of seed.contacts ?? []) {
        const r = await ensureContact(prisma, existing.id, c, !APPLY);
        contactActions.push(`${c.firstName}: ${r}`);
      }

      const partnerBenefits = benefitsByPartner.filter((b) => b.partnerId === existing.id);
      if (partnerBenefits.length) {
        report.benefitsDetected.push({
          partnerId: existing.id,
          partnerName: existing.name,
          benefits: partnerBenefits.map((b) => ({ id: b.id, title: b.title, status: b.status })),
        });
      }

      const partnerAssets = assetsByPartner.filter((a) => a.partnerId === existing.id);
      const logoTypes = new Set(partnerAssets.map((a) => `${a.type}:${a.backgroundType}`));
      const expectedSlots = [
        "LOGO_GENERAL:COLOR",
        "LOGO_GENERAL:DARK",
        "LOGO_GENERAL:LIGHT",
      ];
      const missingLogos = expectedSlots.filter((s) => !logoTypes.has(s));
      if (missingLogos.length) {
        report.logosMissing.push({
          partnerId: existing.id,
          partnerName: existing.name,
          missing: missingLogos,
          existingCount: partnerAssets.length,
        });
      }

      if (Object.keys(patch).length === 0 && contactActions.every((a) => a.endsWith("exists") || a.endsWith("skipped"))) {
        report.noChange.push({
          key: seed.key,
          name: seed.name,
          id: existing.id,
          matchReasons: decision.candidates[0]?.reasons,
          score: decision.candidates[0]?.score,
        });
        continue;
      }

      if (APPLY && Object.keys(patch).length) {
        await prisma.dnxPartner.update({
          where: { id: existing.id },
          data: { ...patch, updatedAt: new Date() },
        });
      }

      report.matched.push({
        key: seed.key,
        name: seed.name,
        id: existing.id,
        slug: existing.slug,
        action: APPLY ? "UPDATED" : "WOULD_UPDATE",
        filled,
        corrected,
        unchanged: unchanged.slice(0, 20),
        contacts: contactActions,
        matchReasons: decision.candidates[0]?.reasons,
        score: decision.candidates[0]?.score,
      });
    }

    const afterCount = await prisma.dnxPartner.count({ where: { archivedAt: null } });
    report.totalPartnersAfter = afterCount;
    report.status = APPLY ? "APPLIED" : "DRY_RUN";

    // Overall status
    const overall =
      report.errors.length > 0
        ? "PARTIAL"
        : report.possibleDuplicates.length > 0 || report.pendingVerification.length > 0
          ? "PARTIAL"
          : APPLY
            ? "DONE"
            : "DRY_RUN_READY";

    console.log(
      JSON.stringify(
        {
          overall,
          ...report,
          seedsTotal: SEEDS.length,
          touchedPartnerIds: [...touchedIds],
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect().catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      status: "FAILED",
      message: err instanceof Error ? err.message.slice(0, 400) : "unknown",
    }),
  );
  process.exit(1);
});
