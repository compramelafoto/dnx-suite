"use client";

import CuantoCobroFeatureGrid from "@/components/cuantocobro/CuantoCobroFeatureGrid";
import CuantoCobroHero from "@/components/cuantocobro/CuantoCobroHero";
import {
  CC_APP_PATH,
  getCuantoCobroLoginUrl,
  getCuantoCobroRegisterUrl,
} from "@/lib/cuantocobro/constants";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function CuantoCobroPageClient() {
  const searchParams = useSearchParams();
  const [accessError, setAccessError] = useState(false);

  useEffect(() => {
    setAccessError(searchParams?.get("error") === "acceso");
  }, [searchParams]);

  const openWizard = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { credentials: "include", cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data?.user) {
          window.location.href = CC_APP_PATH;
          return;
        }
      }
    } catch {
      /* redirect to login below */
    }
    window.location.href = getCuantoCobroLoginUrl();
  }, []);

  useEffect(() => {
    if (window.location.hash === "#calculo") {
      void openWizard();
    }
    const onHashChange = () => {
      if (window.location.hash === "#calculo") void openWizard();
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [openWizard]);

  return (
    <>
      {accessError ? (
        <div className="container-custom pt-4">
          <div className="ds-info-panel cc-info-panel--warning" role="alert">
            <p className="ds-info-panel__body m-0 text-sm">
              Tu cuenta no tiene acceso a ¿Cuánto Cobro? con el rol actual. Iniciá sesión como fotógrafo o{" "}
              <a href={getCuantoCobroRegisterUrl()} className="underline font-medium">
                creá una cuenta de fotógrafo
              </a>
              .
            </p>
          </div>
        </div>
      ) : null}
      <CuantoCobroHero onStart={openWizard} />
      <CuantoCobroFeatureGrid />
    </>
  );
}
