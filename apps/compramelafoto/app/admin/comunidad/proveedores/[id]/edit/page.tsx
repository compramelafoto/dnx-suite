"use client";

import { useParams } from "next/navigation";
import CommunityProfileEditForm from "@/components/admin/CommunityProfileEditForm";

export default function EditProveedorPage() {
  const params = useParams();
  const id = params?.id as string;

  if (!id) {
    return <p className="text-gray-600">ID no válido</p>;
  }

  return (
    <div className="py-4 w-full">
      <CommunityProfileEditForm
        profileId={id}
        type="EVENT_VENDOR"
        backHref="/admin/comunidad/proveedores"
        backLabel="Volver a Proveedores"
      />
    </div>
  );
}
