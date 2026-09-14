import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  DoorOpen,
  GraduationCap,
  Inbox,
  LayoutGrid,
  Package,
  PackageCheck,
  PackagePlus,
  Palette,
  ReceiptText,
  Settings,
  ShoppingCart,
  Tag,
  Ticket,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";

/**
 * Los íconos que puede nombrar un submódulo. Cerrado a propósito: un nombre suelto no dibuja nada.
 *
 * Vive en un archivo aparte de `shell-nav.tsx` a propósito: ese componente lleva "use client"
 * y hooks de React, y las pruebas de este repo corren en entorno node (sin DOM). Separando el
 * mapa en un módulo sin JSX, una prueba puede importarlo solo y comparar sus claves contra los
 * íconos que declara `lib/modules/submodules.ts`, sin arrastrar React ni el navegador.
 *
 * Antes esta lista vivía adentro de `shell-nav.tsx` y nada la comparaba con `submodules.ts`:
 * declarar ahí un ícono que no estuviera acá caía en silencio en el ícono genérico de
 * reserva, sin que ninguna prueba se enterara.
 */
export const ICONOS: Record<string, ComponentType<{ className?: string }>> = {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  DoorOpen,
  GraduationCap,
  Inbox,
  LayoutGrid,
  Package,
  PackageCheck,
  PackagePlus,
  Palette,
  ReceiptText,
  Settings,
  ShoppingCart,
  Tag,
  Ticket,
  UserPlus,
  Users,
  Wallet,
};
