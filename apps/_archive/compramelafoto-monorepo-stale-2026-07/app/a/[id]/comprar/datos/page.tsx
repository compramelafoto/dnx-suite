"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function AlbumDatosPage() {
  const router = useRouter();
  const params = useParams();
  const albumId = params.id as string;

  useEffect(() => {
    router.replace(`/a/${albumId}/comprar/resumen`);
  }, [albumId, router]);

  return null;
}
