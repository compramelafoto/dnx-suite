"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

type Product = {
  id: number;
  name: string;
  description: string | null;
  price: number;
  mockupUrl: string | null;
  minFotos: number;
  maxFotos: number;
  requiresDesign: boolean;
  suggestionText: string | null;
};

type SchoolCourse = { id: number; name: string; division: string | null };

type Catalog = {
  album: {
    id: number;
    title: string;
    publicSlug: string;
    preCompraCloseAt: string | null;
    requireClientApproval: boolean;
    photographer: { id: number; name: string | null; logoUrl: string | null } | null;
    lab: { id: number; name: string; logoUrl: string | null } | null;
    isSchool?: boolean;
    school?: { id: number; name: string; courses: SchoolCourse[] } | null;
  };
  products: Product[];
};

export default function PreventaPage() {
  const params = useParams();
  const router = useRouter();
  const slug = String(params?.slug ?? "");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [schoolCourseId, setSchoolCourseId] = useState<number | null>(null);
  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");
  const [quantities, setQuantities] = useState<Record<number, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/album/${encodeURIComponent(slug)}/precompra`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("No disponible"))))
      .then(setCatalog)
      .catch(() => setError("No se pudo cargar el catálogo o la pre-venta está cerrada."))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleQuantity = (productId: number, delta: number) => {
    setQuantities((prev) => {
      const current = prev[productId] ?? 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [productId]: next };
    });
  };

  const isSchool = catalog?.album?.isSchool && catalog?.album?.school;
  const courses = catalog?.album?.school?.courses ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catalog || !buyerEmail.trim()) return;
    const items = Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([albumProductId, quantity]) => ({ albumProductId: Number(albumProductId), quantity }));
    if (items.length === 0) {
      setError("Agregá al menos un producto.");
      return;
    }
    if (isSchool) {
      if (!buyerName.trim()) {
        setError("El nombre y apellido del adulto es requerido.");
        return;
      }
      if (!buyerPhone.trim()) {
        setError("El teléfono es requerido.");
        return;
      }
      if (!schoolCourseId) {
        setError("Seleccioná el curso/división del alumno.");
        return;
      }
      if (!studentFirstName.trim()) {
        setError("El nombre del alumno es requerido.");
        return;
      }
      if (!studentLastName.trim()) {
        setError("El apellido del alumno es requerido.");
        return;
      }
      if (courses.length === 0) {
        setError("Esta escuela no tiene cursos cargados. Contactá al fotógrafo.");
        return;
      }
    }
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        albumId: catalog.album.id,
        buyerEmail: buyerEmail.trim(),
        items,
      };
      if (isSchool) {
        body.buyerName = buyerName.trim();
        body.buyerPhone = buyerPhone.trim();
        body.schoolCourseId = schoolCourseId;
        body.studentFirstName = studentFirstName.trim();
        body.studentLastName = studentLastName.trim();
      }
      const res = await fetch("/api/precompra/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Error al crear el pedido");

      const orderId = data.order?.id;
      if (!orderId) throw new Error("Error al crear el pedido");

      // Crear preferencia MP y redirigir a pago
      const prefRes = await fetch("/api/payments/mp/create-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, orderType: "PRECOMPRA_ORDER" }),
      });
      const prefData = await prefRes.json();
      if (prefRes.ok && prefData?.initPoint) {
        window.location.href = prefData.initPoint;
        return;
      }
      // Si falla MP (ej. total 0 o MP no conectado), ir directo a selfies
      router.push(`/order/${orderId}/selfies`);
    } catch (err: any) {
      setError(err?.message || "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
        <p className="text-[#6b7280]">Cargando catálogo…</p>
      </div>
    );
  }

  if (error && !catalog) {
    return (
      <div className="min-h-screen bg-[#f9fafb] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <Link href="/" className="text-[#c27b3d] underline">
            Volver al inicio
          </Link>
        </div>
      </div>
    );
  }

  if (!catalog) return null;

  const totalItems = Object.values(quantities).reduce((a, b) => a + b, 0);
  const totalArs = catalog.products.reduce(
    (sum, p) => sum + (quantities[p.id] ?? 0) * p.price,
    0
  );

  const brand = catalog.album.lab ?? catalog.album.photographer;
  const brandLabel = catalog.album.lab ? "Laboratorio" : "Fotógrafo";

  return (
    <div className="min-h-screen bg-[#f9fafb]">
      <header className="bg-white border-b border-gray-200 py-5 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {brand?.logoUrl && (
                <img
                  src={brand.logoUrl}
                  alt=""
                  className="h-12 w-12 sm:h-14 sm:w-14 rounded-lg object-contain bg-gray-50 border border-gray-100"
                />
              )}
              <div>
                <h1 className="text-xl sm:text-2xl font-semibold text-[#1a1a1a]">{catalog.album.title}</h1>
                {brand && (
                  <p className="text-sm text-[#6b7280] mt-0.5">
                    {brandLabel}: {brand.name}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        <p className="text-sm text-[#6b7280] mb-6">
          Pre-venta: elegí los productos. Después de confirmar podrás cargar la selfie de cada niño y ver tus fotos cuando estén listas.
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {catalog.products.map((product) => (
            <Card key={product.id} className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-5">
              {product.mockupUrl && (
                <div className="w-full sm:w-40 h-40 sm:h-36 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex-shrink-0">
                  <img
                    src={product.mockupUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h2 className="text-lg font-semibold text-[#1a1a1a]">{product.name}</h2>
                {product.description && (
                  <p className="text-sm text-[#6b7280] mt-1 line-clamp-3">{product.description}</p>
                )}
                <p className="text-base text-[#1a1a1a] mt-2 font-semibold">
                  ${product.price.toLocaleString("es-AR")} ARS
                </p>
                {product.requiresDesign && (
                  <p className="text-xs text-amber-700 mt-1">Incluye diseño en plantilla</p>
                )}
                <div className="flex items-center gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => handleQuantity(product.id, -1)}
                    className="w-9 h-9 rounded-lg border border-gray-300 text-[#374151] flex items-center justify-center hover:bg-gray-50 transition-colors"
                    aria-label="Menos"
                  >
                    −
                  </button>
                  <span className="min-w-[2.5rem] text-center font-semibold text-[#1a1a1a]">
                    {quantities[product.id] ?? 0}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleQuantity(product.id, 1)}
                    className="w-9 h-9 rounded-lg border border-gray-300 text-[#374151] flex items-center justify-center hover:bg-gray-50 transition-colors"
                    aria-label="Más"
                  >
                    +
                  </button>
                </div>
              </div>
            </Card>
          ))}

          {isSchool && (
            <Card className="space-y-4 p-4 sm:p-5">
              <h3 className="font-semibold text-[#1a1a1a]">Datos del adulto responsable</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre y apellido <span className="text-red-500">*</span></label>
                <Input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="María García"
                  required={!!isSchool}
                  className="max-w-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                <Input
                  type="email"
                  required
                  placeholder="tu@email.com"
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="max-w-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono <span className="text-red-500">*</span></label>
                <Input
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="+54 11 1234-5678"
                  required={!!isSchool}
                  className="max-w-md"
                />
              </div>
              <h3 className="font-semibold text-[#1a1a1a] pt-2">Datos del alumno</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre <span className="text-red-500">*</span></label>
                <Input
                  value={studentFirstName}
                  onChange={(e) => setStudentFirstName(e.target.value)}
                  placeholder="Juan"
                  required={!!isSchool}
                  className="max-w-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Apellido <span className="text-red-500">*</span></label>
                <Input
                  value={studentLastName}
                  onChange={(e) => setStudentLastName(e.target.value)}
                  placeholder="Pérez"
                  required={!!isSchool}
                  className="max-w-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Curso / División <span className="text-red-500">*</span></label>
                <select
                  value={schoolCourseId ?? ""}
                  onChange={(e) => setSchoolCourseId(e.target.value ? Number(e.target.value) : null)}
                  required={!!isSchool}
                  className="w-full max-w-md px-4 py-3 border border-[#e5e7eb] rounded-lg text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-[#c27b3d] focus:border-transparent"
                >
                  <option value="">-- Seleccionar --</option>
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.division ? ` ${c.division}` : ""}
                    </option>
                  ))}
                </select>
                {courses.length === 0 && isSchool && (
                  <p className="text-amber-700 text-sm mt-1">La escuela no tiene cursos cargados. Contactá al fotógrafo.</p>
                )}
              </div>
            </Card>
          )}

          {!isSchool && (
            <Card>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email para el pedido <span className="text-red-500">*</span>
              </label>
              <Input
                type="email"
                required
                placeholder="tu@email.com"
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                className="max-w-md"
              />
            </Card>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" variant="primary" disabled={submitting || totalItems === 0}>
              {submitting ? "Enviando…" : "Confirmar pre-venta"}
            </Button>
            {totalItems > 0 && (
              <span className="text-sm text-[#6b7280]">
                {totalItems} producto(s) · ${totalArs.toLocaleString("es-AR")} ARS
              </span>
            )}
          </div>
        </form>

        <p className="text-xs text-[#9ca3af] mt-8">
          Al confirmar serás redirigido a cargar la selfie de cada niño (recomendado desde el celular).
        </p>
      </main>
    </div>
  );
}
