"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import { formatDate, getRoleLabel } from "@/lib/admin/helpers";

const ROLES = [
  { value: "CUSTOMER", label: "Cliente" },
  { value: "PHOTOGRAPHER", label: "Fotógrafo" },
  { value: "LAB", label: "Laboratorio" },
  { value: "LAB_PHOTOGRAPHER", label: "Lab + Fotógrafo" },
  { value: "ORGANIZER", label: "Organizador" },
  { value: "ADMIN", label: "Administrador" },
] as const;

type UserConfig = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  phone: string | null;
  createdAt: string;
  isBlocked: boolean;
  blockedAt: string | null;
  blockedReason: string | null;
  lastLoginAt: string | null;
  platformCommissionPercentOverride: number | null;
  address: string | null;
  city: string | null;
  province: string | null;
  country: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  birthDate: string | null;
  companyName: string | null;
  companyOwner: string | null;
  cuit: string | null;
  companyAddress: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  facebook: string | null;
  whatsapp: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  tertiaryColor: string | null;
  fontColor: string | null;
  preferredLabId: number | null;
  profitMarginPercent: number | null;
  isPublicPageEnabled: boolean;
  publicPageHandler: string | null;
  enableAlbumsPage: boolean;
  enablePrintPage: boolean;
  showCarnetPrints: boolean;
  showPolaroidPrints: boolean;
  defaultDigitalPhotoPrice: number | null;
  digitalDiscountsEnabled: boolean;
  digitalDiscount5Plus: number | null;
  digitalDiscount10Plus: number | null;
  digitalDiscount20Plus: number | null;
  mpUserId: string | null;
  mpConnectedAt: string | null;
  preferredLab: { id: number; name: string; city: string | null; province: string | null } | null;
  lab?: {
    id: number;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
    latitude: number | null;
    longitude: number | null;
    logoUrl: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    isPublicPageEnabled: boolean;
    publicPageHandler: string | null;
    showCarnetPrints: boolean;
    showPolaroidPrints: boolean;
    approvalStatus: string;
    isSuspended: boolean;
    suspendedReason: string | null;
    mpUserId: string | null;
    mpConnectedAt: string | null;
    radiusKm: number | null;
    shippingEnabled: boolean;
    fulfillmentMode: string;
    defaultSlaDays: number | null;
    soyFotografo: boolean;
    usePriceForPhotographerOrders: string;
    basePrices: Array<{ id: number; size: string; unitPrice: number; currency: string; isActive: boolean }>;
    discounts: Array<{ id: number; size: string; minQty: number; discountPercent: number; isActive: boolean }>;
    products: Array<{
      id: number;
      name: string;
      size: string | null;
      acabado: string | null;
      photographerPrice: number;
      retailPrice: number;
      currency: string;
      isActive: boolean;
    }>;
  } | null;
  products?: Array<{
    id: number;
    name: string;
    size: string | null;
    acabado: string | null;
    retailPrice: number;
    currency: string;
    isActive: boolean;
  }>;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  const v = value ?? "—";
  return (
    <div className="py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-xs font-medium text-gray-500 block">{label}</span>
      <span className="text-sm text-gray-900">{v}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{title}</h3>
      <div className="space-y-0">{children}</div>
    </Card>
  );
}

export default function AdminUserConfigPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string | undefined;
  const [data, setData] = useState<UserConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleEdit, setRoleEdit] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/users/${id}`)
      .then((res) => {
        if (!res.ok) return res.json().then((body) => Promise.reject(body?.error || res.statusText));
        return res.json();
      })
      .then((user: UserConfig) => {
        if (!cancelled) {
          setData(user);
          setRoleEdit(user.role);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(typeof err === "string" ? err : err?.error || "Error cargando configuración");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!id) {
    return (
      <div className="p-6">
        <p className="text-gray-600">ID de usuario no válido.</p>
        <Link href="/admin/usuarios" className="text-blue-600 hover:underline mt-2 inline-block">
          Volver a usuarios
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-gray-600">Cargando configuración del usuario...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">{error || "Usuario no encontrado"}</p>
        <Link href="/admin/usuarios" className="text-blue-600 hover:underline mt-2 inline-block">
          Volver a usuarios
        </Link>
      </div>
    );
  }

  const isPhotographer = data.role === "PHOTOGRAPHER" || data.role === "LAB_PHOTOGRAPHER";
  const hasLab = !!data.lab;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/usuarios"
            className="text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 text-sm"
          >
            ← Volver a usuarios
          </Link>
          <h1 className="text-xl font-semibold text-gray-900">
            Configuración del usuario
          </h1>
        </div>
      </div>

      {/* Cuenta y estado */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Section title="Cuenta y estado">
          <Field label="ID" value={data.id} />
          <Field label="Email" value={data.email} />
          <Field label="Nombre" value={data.name} />
          <div className="py-1.5 border-b border-gray-100 last:border-0">
            <span className="text-xs font-medium text-gray-500 block mb-2">Rol</span>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={roleEdit}
                onChange={(e) => {
                  setRoleEdit(e.target.value);
                  setRoleError(null);
                }}
                className="text-sm border border-gray-200 rounded-md px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                disabled={savingRole || roleEdit === data.role}
                onClick={async () => {
                  setRoleError(null);
                  setSavingRole(true);
                  try {
                    const res = await fetch(`/api/admin/users/${id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ role: roleEdit }),
                    });
                    const body = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      setRoleError(body?.error || "Error al guardar");
                      return;
                    }
                    setData((prev) => (prev ? { ...prev, role: roleEdit } : null));
                  } catch {
                    setRoleError("Error de conexión");
                  } finally {
                    setSavingRole(false);
                  }
                }}
              >
                {savingRole ? "Guardando…" : "Guardar rol"}
              </Button>
            </div>
            {roleError && (
              <p className="text-sm text-red-600 mt-1">{roleError}</p>
            )}
          </div>
          <Field label="Creado" value={formatDate(data.createdAt)} />
          <Field label="Último login" value={formatDate(data.lastLoginAt)} />
          <Field
            label="Estado"
            value={
              <span
                className={
                  data.isBlocked ? "text-red-600 font-medium" : "text-green-600 font-medium"
                }
              >
                {data.isBlocked ? "Bloqueado" : "Activo"}
              </span>
            }
          />
          {data.isBlocked && data.blockedReason && (
            <Field label="Motivo bloqueo" value={data.blockedReason} />
          )}
          {data.platformCommissionPercentOverride != null && (
            <Field label="Fee override (%)" value={data.platformCommissionPercentOverride} />
          )}
        </Section>

        <Section title="Contacto y ubicación">
          <Field label="Teléfono" value={data.phone} />
          <Field label="WhatsApp" value={data.whatsapp} />
          <Field label="Ciudad" value={data.city} />
          <Field label="Provincia" value={data.province} />
          <Field label="País" value={data.country} />
          <Field label="Dirección" value={data.address} />
          <Field label="Código postal" value={data.postalCode} />
          {(data.latitude != null || data.longitude != null) && (
            <Field
              label="Coordenadas"
              value={`${data.latitude ?? ""}, ${data.longitude ?? ""}`}
            />
          )}
        </Section>
      </div>

      {/* Empresa y redes (si aplica) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Section title="Empresa / datos fiscales">
          <Field label="Razón social" value={data.companyName} />
          <Field label="Titular" value={data.companyOwner} />
          <Field label="CUIT" value={data.cuit} />
          <Field label="Dirección fiscal" value={data.companyAddress} />
          <Field label="Fecha de nacimiento" value={data.birthDate ? formatDate(data.birthDate) : null} />
        </Section>
        <Section title="Redes y web">
          <Field label="Sitio web" value={data.website} />
          <Field label="Instagram" value={data.instagram} />
          <Field label="TikTok" value={data.tiktok} />
          <Field label="Facebook" value={data.facebook} />
        </Section>
      </div>

      {/* Logo y colores */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Section title="Marca (logo y colores)">
          {data.logoUrl ? (
            <div className="py-2">
              <span className="text-xs font-medium text-gray-500 block mb-1">Logo</span>
              <Image
                src={data.logoUrl}
                alt="Logo"
                width={120}
                height={80}
                className="object-contain border rounded"
              />
            </div>
          ) : (
            <Field label="Logo" value="Sin logo" />
          )}
          <Field label="Color primario" value={data.primaryColor} />
          <Field label="Color secundario" value={data.secondaryColor} />
          <Field label="Color terciario" value={data.tertiaryColor} />
          <Field label="Color de fuente" value={data.fontColor} />
        </Section>

        {isPhotographer && (
          <Section title="Página pública (fotógrafo)">
            <Field label="Página pública habilitada" value={data.isPublicPageEnabled ? "Sí" : "No"} />
            <Field label="Handler URL" value={data.publicPageHandler ? `/${data.publicPageHandler}` : null} />
            <Field label="Álbumes en landing" value={data.enableAlbumsPage ? "Sí" : "No"} />
            <Field label="Imprimir en landing" value={data.enablePrintPage ? "Sí" : "No"} />
            <Field label="Mostrar carnet" value={data.showCarnetPrints ? "Sí" : "No"} />
            <Field label="Mostrar polaroid" value={data.showPolaroidPrints ? "Sí" : "No"} />
            <Field label="Laboratorio preferido" value={data.preferredLab ? `${data.preferredLab.name} (ID ${data.preferredLab.id})` : null} />
            <Field label="Margen de ganancia (%)" value={data.profitMarginPercent} />
            <Field label="Precio digital por defecto" value={data.defaultDigitalPhotoPrice} />
            <Field label="Descuentos digitales" value={data.digitalDiscountsEnabled ? "Sí" : "No"} />
            {data.digitalDiscountsEnabled && (
              <>
                <Field label="Descuento 5+" value={data.digitalDiscount5Plus != null ? `${data.digitalDiscount5Plus}%` : null} />
                <Field label="Descuento 10+" value={data.digitalDiscount10Plus != null ? `${data.digitalDiscount10Plus}%` : null} />
                <Field label="Descuento 20+" value={data.digitalDiscount20Plus != null ? `${data.digitalDiscount20Plus}%` : null} />
              </>
            )}
          </Section>
        )}
      </div>

      {/* Mercado Pago */}
      <div className="mb-4">
        <Section title="Mercado Pago">
          <Field label="Conectado" value={data.mpUserId || data.mpConnectedAt ? "Sí" : "No"} />
          {data.mpUserId && <Field label="MP User ID" value={data.mpUserId} />}
          {data.mpConnectedAt && (
            <Field label="Conectado el" value={formatDate(data.mpConnectedAt)} />
          )}
        </Section>
      </div>

      {/* Productos del fotógrafo */}
      {isPhotographer && data.products && data.products.length > 0 && (
        <div className="mb-4">
          <Section title="Productos del fotógrafo">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b">
                    <th className="py-2 pr-2">Nombre</th>
                    <th className="py-2 pr-2">Tamaño</th>
                    <th className="py-2 pr-2">Acabado</th>
                    <th className="py-2 pr-2">Precio retail</th>
                    <th className="py-2 pr-2">Moneda</th>
                    <th className="py-2">Activo</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((p) => (
                    <tr key={p.id} className="border-b border-gray-100">
                      <td className="py-2 pr-2">{p.name}</td>
                      <td className="py-2 pr-2">{p.size ?? "—"}</td>
                      <td className="py-2 pr-2">{p.acabado ?? "—"}</td>
                      <td className="py-2 pr-2">{p.retailPrice}</td>
                      <td className="py-2 pr-2">{p.currency}</td>
                      <td className="py-2">{p.isActive ? "Sí" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      )}

      {/* Datos del laboratorio (si es usuario de lab) */}
      {hasLab && data.lab && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <Section title="Laboratorio — Datos generales">
              <Field label="ID Lab" value={data.lab.id} />
              <Field label="Nombre" value={data.lab.name} />
              <Field label="Email" value={data.lab.email} />
              <Field label="Teléfono" value={data.lab.phone} />
              <Field label="Ciudad" value={data.lab.city} />
              <Field label="Provincia" value={data.lab.province} />
              <Field label="País" value={data.lab.country} />
              <Field label="Dirección" value={data.lab.address} />
              <Field label="Estado aprobación" value={data.lab.approvalStatus} />
              <Field label="Suspendido" value={data.lab.isSuspended ? "Sí" : "No"} />
              {data.lab.suspendedReason && (
                <Field label="Motivo suspensión" value={data.lab.suspendedReason} />
              )}
              <Field label="Página pública" value={data.lab.isPublicPageEnabled ? "Sí" : "No"} />
              <Field label="Handler" value={data.lab.publicPageHandler ? `/l/${data.lab.publicPageHandler}` : null} />
              <Field label="MP conectado" value={data.lab.mpUserId || data.lab.mpConnectedAt ? "Sí" : "No"} />
              <Field label="Envíos" value={data.lab.shippingEnabled ? "Sí" : "No"} />
              <Field label="Modo entrega" value={data.lab.fulfillmentMode} />
              <Field label="Radio (km)" value={data.lab.radiusKm} />
              <Field label="SLA por defecto (días)" value={data.lab.defaultSlaDays} />
              <Field label="Soy fotógrafo" value={data.lab.soyFotografo ? "Sí" : "No"} />
              <Field label="Precio pedidos fotógrafo" value={data.lab.usePriceForPhotographerOrders} />
            </Section>
            {data.lab.logoUrl && (
              <Section title="Logo del laboratorio">
                <Image
                  src={data.lab.logoUrl}
                  alt="Logo lab"
                  width={160}
                  height={100}
                  className="object-contain border rounded"
                />
                <Field label="Color primario" value={data.lab.primaryColor} />
                <Field label="Color secundario" value={data.lab.secondaryColor} />
              </Section>
            )}
          </div>

          {data.lab.basePrices && data.lab.basePrices.length > 0 && (
            <div className="mb-4">
              <Section title="Precios base del laboratorio">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-2">Tamaño</th>
                        <th className="py-2 pr-2">Precio unit.</th>
                        <th className="py-2 pr-2">Moneda</th>
                        <th className="py-2">Activo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lab.basePrices.map((bp) => (
                        <tr key={bp.id} className="border-b border-gray-100">
                          <td className="py-2 pr-2">{bp.size}</td>
                          <td className="py-2 pr-2">{bp.unitPrice}</td>
                          <td className="py-2 pr-2">{bp.currency}</td>
                          <td className="py-2">{bp.isActive ? "Sí" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          )}

          {data.lab.discounts && data.lab.discounts.length > 0 && (
            <div className="mb-4">
              <Section title="Descuentos por cantidad">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-2">Tamaño</th>
                        <th className="py-2 pr-2">Cant. mín.</th>
                        <th className="py-2 pr-2">% desc.</th>
                        <th className="py-2">Activo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lab.discounts.map((d) => (
                        <tr key={d.id} className="border-b border-gray-100">
                          <td className="py-2 pr-2">{d.size}</td>
                          <td className="py-2 pr-2">{d.minQty}</td>
                          <td className="py-2 pr-2">{d.discountPercent}%</td>
                          <td className="py-2">{d.isActive ? "Sí" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          )}

          {data.lab.products && data.lab.products.length > 0 && (
            <div className="mb-4">
              <Section title="Productos del laboratorio">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-2">Nombre</th>
                        <th className="py-2 pr-2">Tamaño</th>
                        <th className="py-2 pr-2">Acabado</th>
                        <th className="py-2 pr-2">Precio fotógrafo</th>
                        <th className="py-2 pr-2">Precio retail</th>
                        <th className="py-2 pr-2">Moneda</th>
                        <th className="py-2">Activo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.lab.products.map((p) => (
                        <tr key={p.id} className="border-b border-gray-100">
                          <td className="py-2 pr-2">{p.name}</td>
                          <td className="py-2 pr-2">{p.size ?? "—"}</td>
                          <td className="py-2 pr-2">{p.acabado ?? "—"}</td>
                          <td className="py-2 pr-2">{p.photographerPrice}</td>
                          <td className="py-2 pr-2">{p.retailPrice}</td>
                          <td className="py-2 pr-2">{p.currency}</td>
                          <td className="py-2">{p.isActive ? "Sí" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            </div>
          )}
        </>
      )}

      <div className="mt-6">
        <Button variant="secondary" onClick={() => router.push("/admin/usuarios")}>
          Volver a usuarios
        </Button>
      </div>
    </div>
  );
}
