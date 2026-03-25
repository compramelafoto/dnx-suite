"use client";

type Lab = {
  id: number;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
};

export default function LabHeader({ lab, handler }: { lab: Lab; handler: string }) {
  const bgColor = lab.secondaryColor || "#2d2d2d";
  
  // Header simple sin logo ni nombre (igual que PhotographerHeader)
  return (
    <header
      className="text-white sticky top-0 z-40 shadow-sm"
      style={{ backgroundColor: bgColor }}
    >
      <div className="container-custom py-4 md:py-5">
        {/* Header vacío - el logo se mostrará en el hero section si es necesario */}
      </div>
    </header>
  );
}
