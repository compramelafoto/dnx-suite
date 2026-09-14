import {
  Banknote,
  Camera,
  HeartHandshake,
  Landmark,
  School,
  Store,
  UsersRound,
  Warehouse,
  BadgeCheck,
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardCheck,
  Contact,
  CreditCard,
  DoorOpen,
  FileText,
  Gavel,
  Globe,
  GraduationCap,
  Image as ImageIcon,
  Inbox,
  Mail,
  Megaphone,
  PieChart,
  QrCode,
  Smartphone,
  Ticket,
  Power,
  UserCog,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

/**
 * Los íconos de la portada, resueltos por nombre.
 *
 * El catálogo (`lib/landing/catalogo.ts`) guarda un nombre y no un componente porque también lo
 * leen los tests, que corren sin React. Acá se hace la traducción, una sola vez.
 *
 * El criterio de elección es que el ícono explique, no que decore: el de Reservas es un
 * calendario y no una puerta, porque lo que la persona busca es la agenda.
 */
const ICONOS: Record<string, LucideIcon> = {
  members: Users,
  "membership-dues": Wallet,
  raffles: Ticket,
  bookings: CalendarDays,
  "courses-sales": GraduationCap,
  evaluaciones: ClipboardCheck,
  clients: Contact,
  cash: Banknote,
  website: Globe,
  consultas: Inbox,
  cobros: CreditCard,
  portal: Smartphone,
  carnets: QrCode,
  correos: Mail,
  equipo: UserCog,

  // En construcción
  presupuestos: FileText,
  comunicacion: Megaphone,
  eventos: CalendarCheck,
  gobierno: Gavel,
  muestras: ImageIcon,
  transparencia: PieChart,

  // Pasos
  espacio: Building2,
  interruptor: Power,
  puerta: DoorOpen,

  // Tipos de organización
  "tipo-freelance": Camera,
  "tipo-local": Store,
  "tipo-escuela": School,
  "tipo-sociedad": Landmark,
  "tipo-agrupacion": UsersRound,
  "tipo-ong": HeartHandshake,
  "tipo-espacio": Warehouse,

  // Puertas de afuera
  sitio: Globe,
  telefono: Smartphone,
  verificado: BadgeCheck,
};

export function IconoDe({ nombre, size = 20 }: { nombre: string; size?: number }) {
  const Icono = ICONOS[nombre] ?? BadgeCheck;
  return <Icono size={size} strokeWidth={1.9} aria-hidden />;
}
