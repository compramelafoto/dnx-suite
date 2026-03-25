import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Testimonios - ComprameLaFoto",
  description:
    "Lo que dicen los fotógrafos que usan ComprameLaFoto. Dejá tu testimonio y contactá a otros fotógrafos por Instagram.",
};

export default function TestimoniosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
