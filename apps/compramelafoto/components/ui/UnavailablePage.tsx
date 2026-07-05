export default function UnavailablePage({
  title = "No disponible",
  subtitle = "Esta opción no está habilitada en esta tienda.",
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-[70vh] w-full flex flex-col items-center justify-center text-center gap-4 px-4">
      <div className="flex items-center gap-3">
        <span className="text-3xl font-semibold text-[#1a1a1a]">ComprameLaFoto</span>
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-[#1a1a1a]">{title}</h1>
        <p className="text-sm text-[#6b7280]">{subtitle}</p>
      </div>
    </div>
  );
}
